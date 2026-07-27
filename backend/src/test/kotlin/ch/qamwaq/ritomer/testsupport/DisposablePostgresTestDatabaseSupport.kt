package ch.qamwaq.ritomer.testsupport

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import java.sql.Connection
import java.sql.DriverManager
import java.sql.ResultSet
import javax.sql.DataSource
import org.springframework.context.ApplicationContextInitializer
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.core.env.ConfigurableEnvironment
import org.springframework.core.env.Environment
import org.springframework.core.env.StandardEnvironment

internal class DisposablePostgresTestDatabaseGuardInitializer :
  ApplicationContextInitializer<ConfigurableApplicationContext> {
  override fun initialize(applicationContext: ConfigurableApplicationContext) {
    val configuration = requireCanonicalRuntimeConfiguration(applicationContext.environment)
    DriverManager.getConnection(
      configuration.jdbcUrl,
      configuration.username,
      configuration.password
    ).use(::validateConnectedPostgresIdentity)
  }
}

internal object DisposablePostgresTestDatabase {
  fun truncateAllCurrentTables(
    dataSource: DataSource,
    environment: Environment
  ) {
    runGuardedDestruction(dataSource, environment, DestructivePrimitive.TRUNCATE_ALL_CURRENT_TABLES)
  }

  fun recreatePublicSchemaForFlyway(
    dataSource: DataSource,
    environment: Environment
  ) {
    runGuardedDestruction(dataSource, environment, DestructivePrimitive.RECREATE_PUBLIC_SCHEMA)
  }
}

private const val EXPECTED_DATABASE = "ritomer_043b_test"
private const val EXPECTED_ROLE = "ritomer_043b_test_runner"
private const val EXPECTED_JDBC_URL = "jdbc:postgresql://127.0.0.1:5432/ritomer_043b_test"
private const val EXPECTED_SERVER_ADDRESS = "127.0.0.1"
private const val EXPECTED_SERVER_PORT = "5432"
private const val DB_TESTS_ENABLED_VARIABLE = "RITOMER_DB_TESTS_ENABLED"
private const val DB_TEST_JDBC_URL_VARIABLE = "RITOMER_DB_TEST_JDBC_URL"
private const val DB_TEST_USERNAME_VARIABLE = "RITOMER_DB_TEST_USERNAME"
private const val DB_TEST_PASSWORD_VARIABLE = "RITOMER_DB_TEST_PASSWORD"
private const val DESTRUCTIVE_CONSENT_VARIABLE = "RITOMER_DB_TEST_DESTRUCTIVE_CONSENT"
private const val DESTRUCTIVE_CONSENT_VALUE = "TRUNCATE_RITOMER_043B_TEST"
private const val SPRING_APPLICATION_JSON_VARIABLE = "SPRING_APPLICATION_JSON"
private const val SPRING_DATASOURCE_URL_VARIABLE = "SPRING_DATASOURCE_URL"
private const val SPRING_DATASOURCE_USERNAME_VARIABLE = "SPRING_DATASOURCE_USERNAME"
private const val SPRING_DATASOURCE_PASSWORD_VARIABLE = "SPRING_DATASOURCE_PASSWORD"
private const val DATASOURCE_URL_PROPERTY = "spring.datasource.url"
private const val DATASOURCE_USERNAME_PROPERTY = "spring.datasource.username"
private const val DATASOURCE_PASSWORD_PROPERTY = "spring.datasource.password"

private val POSTGRES_IDENTITY_SQL =
  """
  SELECT
    current_database(),
    current_user,
    session_user,
    host(inet_server_addr()),
    inet_server_port()::text
  """.trimIndent()

private val POSTGRES_ROLE_SQL =
  """
  SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
  FROM pg_roles
  WHERE rolname = 'ritomer_043b_test_runner'
  """.trimIndent()

private val EXPLICIT_MEMBERSHIP_SQL =
  """
  SELECT count(*)::text
  FROM pg_auth_members membership
  JOIN pg_roles member_role ON member_role.oid = membership.member
  WHERE member_role.rolname = 'ritomer_043b_test_runner'
  """.trimIndent()

private val OWNER_SQL =
  """
  SELECT pg_get_userbyid(database_entry.datdba), pg_get_userbyid(namespace_entry.nspowner)
  FROM pg_database database_entry
  CROSS JOIN pg_namespace namespace_entry
  WHERE database_entry.datname = 'ritomer_043b_test'
    AND namespace_entry.nspname = 'public'
  """.trimIndent()

private val TRUNCATE_ALL_CURRENT_TABLES_SQL =
  """
  DO ${'$'}guard${'$'}
  DECLARE
    table_list text;
  BEGIN
    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ' ORDER BY tablename)
    INTO table_list
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'flyway_schema_history';

    IF table_list IS NOT NULL THEN
      EXECUTE 'TRUNCATE TABLE ' || table_list || ' CASCADE';
    END IF;
  END
  ${'$'}guard${'$'}
  """.trimIndent()

private const val DROP_PUBLIC_SCHEMA_SQL = "DROP SCHEMA public CASCADE"
private const val CREATE_PUBLIC_SCHEMA_SQL =
  "CREATE SCHEMA public AUTHORIZATION ritomer_043b_test_runner"

private data class CanonicalRuntimeConfiguration(
  val jdbcUrl: String,
  val username: String,
  val password: String
)

private enum class DestructivePrimitive {
  TRUNCATE_ALL_CURRENT_TABLES,
  RECREATE_PUBLIC_SCHEMA
}

private fun requireCanonicalRuntimeConfiguration(environment: Environment): CanonicalRuntimeConfiguration {
  requireExact(
    environment.processEnvironmentValue(DB_TESTS_ENABLED_VARIABLE),
    "true",
    "PostgreSQL integration-test activation"
  )
  requireExact(
    environment.processEnvironmentValue(DESTRUCTIVE_CONSENT_VARIABLE),
    DESTRUCTIVE_CONSENT_VALUE,
    "PostgreSQL destructive consent"
  )
  val jdbcUrl = requireExactValue(
    environment.processEnvironmentValue(DB_TEST_JDBC_URL_VARIABLE),
    EXPECTED_JDBC_URL,
    "PostgreSQL integration-test JDBC URL"
  )
  val username = requireExactValue(
    environment.processEnvironmentValue(DB_TEST_USERNAME_VARIABLE),
    EXPECTED_ROLE,
    "PostgreSQL integration-test username"
  )
  val password = environment.processEnvironmentValue(DB_TEST_PASSWORD_VARIABLE)
    ?.takeIf { it.isNotBlank() }
    ?: fail("PostgreSQL integration-test password must be present and non-blank.")

  requireExact(environment.requiredSpringProperty(DATASOURCE_URL_PROPERTY), jdbcUrl, "Spring datasource URL")
  requireExact(
    environment.requiredSpringProperty(DATASOURCE_USERNAME_PROPERTY),
    username,
    "Spring datasource username"
  )
  requireExact(
    environment.requiredSpringProperty(DATASOURCE_PASSWORD_PROPERTY),
    password,
    "Spring datasource password"
  )

  requireOptionalExactProcessValue(environment, SPRING_DATASOURCE_URL_VARIABLE, jdbcUrl)
  requireOptionalExactProcessValue(environment, SPRING_DATASOURCE_USERNAME_VARIABLE, username)
  requireOptionalExactProcessValue(environment, SPRING_DATASOURCE_PASSWORD_VARIABLE, password)
  requireOptionalExactSystemProperty(environment, DATASOURCE_URL_PROPERTY, jdbcUrl)
  requireOptionalExactSystemProperty(environment, DATASOURCE_USERNAME_PROPERTY, username)
  requireOptionalExactSystemProperty(environment, DATASOURCE_PASSWORD_PROPERTY, password)
  requireOptionalExactSystemProperty(environment, SPRING_DATASOURCE_URL_VARIABLE, jdbcUrl)
  requireOptionalExactSystemProperty(environment, SPRING_DATASOURCE_USERNAME_VARIABLE, username)
  requireOptionalExactSystemProperty(environment, SPRING_DATASOURCE_PASSWORD_VARIABLE, password)
  validateSpringApplicationJson(
    environment.processEnvironmentValue(SPRING_APPLICATION_JSON_VARIABLE),
    jdbcUrl,
    username,
    password
  )

  return CanonicalRuntimeConfiguration(jdbcUrl, username, password)
}

private fun runGuardedDestruction(
  dataSource: DataSource,
  environment: Environment,
  primitive: DestructivePrimitive
) {
  requireCanonicalRuntimeConfiguration(environment)
  dataSource.connection.use { connection ->
    val originalAutoCommit = connection.autoCommit
    var primaryFailure: Throwable? = null
    try {
      connection.autoCommit = false
      validateConnectedPostgresIdentity(connection)
      connection.createStatement().use { statement ->
        when (primitive) {
          DestructivePrimitive.TRUNCATE_ALL_CURRENT_TABLES ->
            statement.execute(TRUNCATE_ALL_CURRENT_TABLES_SQL)
          DestructivePrimitive.RECREATE_PUBLIC_SCHEMA -> {
            statement.execute(DROP_PUBLIC_SCHEMA_SQL)
            statement.execute(CREATE_PUBLIC_SCHEMA_SQL)
          }
        }
      }
      connection.commit()
    } catch (failure: Throwable) {
      primaryFailure = failure
      try {
        connection.rollback()
      } catch (rollbackFailure: Throwable) {
        failure.addSuppressed(rollbackFailure)
      }
      throw failure
    } finally {
      try {
        connection.autoCommit = originalAutoCommit
      } catch (restoreFailure: Throwable) {
        if (primaryFailure === null) throw restoreFailure
        primaryFailure.addSuppressed(restoreFailure)
      }
    }
  }
}

private fun validateConnectedPostgresIdentity(connection: Connection) {
  val metadata = connection.metaData ?: fail("PostgreSQL JDBC metadata is required.")
  requireExact(metadata.url, EXPECTED_JDBC_URL, "PostgreSQL JDBC metadata URL")
  requireExact(metadata.userName, EXPECTED_ROLE, "PostgreSQL JDBC metadata username")

  connection.createStatement().use { statement ->
    readExactlyOneRow(statement.executeQuery(POSTGRES_IDENTITY_SQL), "PostgreSQL session identity") { row ->
      requireExact(row.requiredString(1), EXPECTED_DATABASE, "PostgreSQL current database")
      requireExact(row.requiredString(2), EXPECTED_ROLE, "PostgreSQL current role")
      requireExact(row.requiredString(3), EXPECTED_ROLE, "PostgreSQL session role")
      requireExact(row.requiredString(4), EXPECTED_SERVER_ADDRESS, "PostgreSQL server address")
      requireExact(row.requiredString(5), EXPECTED_SERVER_PORT, "PostgreSQL server port")
    }
    readExactlyOneRow(statement.executeQuery(POSTGRES_ROLE_SQL), "PostgreSQL role privileges") { row ->
      for (index in 1..5) {
        if (row.requiredBoolean(index)) {
          fail("PostgreSQL integration-test role has a forbidden privilege.")
        }
      }
    }
    readExactlyOneRow(
      statement.executeQuery(EXPLICIT_MEMBERSHIP_SQL),
      "PostgreSQL explicit role memberships"
    ) { row ->
      requireExact(row.requiredString(1), "0", "PostgreSQL explicit membership count")
    }
    readExactlyOneRow(statement.executeQuery(OWNER_SQL), "PostgreSQL owners") { row ->
      requireExact(row.requiredString(1), EXPECTED_ROLE, "PostgreSQL database owner")
      requireExact(row.requiredString(2), EXPECTED_ROLE, "PostgreSQL public schema owner")
    }
  }
}

private fun validateSpringApplicationJson(
  rawJson: String?,
  expectedUrl: String,
  expectedUsername: String,
  expectedPassword: String
) {
  if (rawJson == null) return
  if (rawJson.isBlank()) fail("SPRING_APPLICATION_JSON must not be blank when present.")
  val root = try {
    ObjectMapper().readTree(rawJson)
  } catch (_: Exception) {
    fail("SPRING_APPLICATION_JSON must be readable JSON when present.")
  }
  if (!root.isObject) fail("SPRING_APPLICATION_JSON must contain a JSON object.")
  val spring = root.get("spring")
  if (spring != null && !spring.isObject) {
    fail("SPRING_APPLICATION_JSON spring configuration must be an object.")
  }
  val datasource = spring?.get("datasource")
  if (datasource != null && !datasource.isObject) {
    fail("SPRING_APPLICATION_JSON datasource configuration must be an object.")
  }
  requireJsonDatasourceValue(root, "url", DATASOURCE_URL_PROPERTY, expectedUrl)
  requireJsonDatasourceValue(root, "username", DATASOURCE_USERNAME_PROPERTY, expectedUsername)
  requireJsonDatasourceValue(root, "password", DATASOURCE_PASSWORD_PROPERTY, expectedPassword)
}

private fun requireJsonDatasourceValue(
  root: JsonNode,
  nestedName: String,
  flatName: String,
  expected: String
) {
  val candidates = listOfNotNull(
    root.path("spring").path("datasource").takeIf { it.isObject }?.get(nestedName),
    root.get(flatName)
  )
  candidates.forEach { candidate ->
    val actual = candidate.takeIf { it.isTextual }?.textValue()
      ?: fail("SPRING_APPLICATION_JSON datasource values must be strings.")
    requireExact(actual, expected, "SPRING_APPLICATION_JSON datasource $nestedName")
  }
}

private fun requireOptionalExactProcessValue(
  environment: Environment,
  name: String,
  expected: String
) {
  environment.processEnvironmentValue(name)?.let { actual ->
    requireExact(actual, expected, "$name process value")
  }
}

private fun requireOptionalExactSystemProperty(
  environment: Environment,
  name: String,
  expected: String
) {
  environment.systemPropertyValue(name)?.let { actual ->
    requireExact(actual, expected, "$name system property")
  }
}

private fun Environment.processEnvironmentValue(name: String): String? =
  rawProperty(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME, name)

private fun Environment.systemPropertyValue(name: String): String? =
  rawProperty(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME, name)

private fun Environment.rawProperty(sourceName: String, name: String): String? {
  val configurable = this as? ConfigurableEnvironment
    ?: fail("Configurable Spring environment is required for PostgreSQL safety checks.")
  val propertySource = configurable.propertySources[sourceName]
    ?: fail("Required Spring property source is unavailable: $sourceName")
  val value = propertySource.getProperty(name) ?: return null
  return value as? String ?: fail("PostgreSQL safety configuration values must be strings.")
}

private fun Environment.requiredSpringProperty(name: String): String =
  getProperty(name)?.takeIf { it.isNotBlank() }
    ?: fail("Required Spring datasource configuration is missing: $name")

private inline fun readExactlyOneRow(
  resultSet: ResultSet,
  description: String,
  read: (ResultSet) -> Unit
) {
  resultSet.use { rows ->
    if (!rows.next()) fail("$description returned no row.")
    read(rows)
    if (rows.next()) fail("$description returned multiple rows.")
  }
}

private fun ResultSet.requiredString(index: Int): String =
  getString(index)?.takeIf { it.isNotBlank() }
    ?: fail("PostgreSQL safety query returned a missing or blank value.")

private fun ResultSet.requiredBoolean(index: Int): Boolean {
  val value = getBoolean(index)
  if (wasNull()) fail("PostgreSQL safety query returned a null boolean.")
  return value
}

private fun requireExact(actual: String?, expected: String, description: String) {
  if (actual == null || actual.isBlank() || actual != expected) {
    fail("$description does not match the dedicated local synthetic PostgreSQL target.")
  }
}

private fun requireExactValue(actual: String?, expected: String, description: String): String {
  requireExact(actual, expected, description)
  return expected
}

private fun fail(message: String): Nothing = throw IllegalStateException(message)
