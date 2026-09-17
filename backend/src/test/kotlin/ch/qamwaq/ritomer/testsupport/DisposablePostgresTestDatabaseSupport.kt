package ch.qamwaq.ritomer.testsupport

import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.attribute.BasicFileAttributes
import java.sql.Connection
import java.sql.DriverManager
import java.sql.ResultSet
import java.sql.SQLException
import java.util.Properties
import javax.sql.DataSource
import org.flywaydb.core.Flyway
import org.springframework.context.ApplicationContextInitializer
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.core.env.ConfigurableEnvironment
import org.springframework.core.env.EnumerablePropertySource
import org.springframework.core.env.Environment
import org.springframework.core.env.StandardEnvironment

internal class DisposablePostgresTestDatabaseGuardInitializer(
  private val connect: (String, Properties) -> Connection = DriverManager::getConnection
) :
  ApplicationContextInitializer<ConfigurableApplicationContext> {
  override fun initialize(applicationContext: ConfigurableApplicationContext) {
    if (!PostgresTestRailJdbcLogging.disableAndVerifyForTest()) {
      fail("PostgreSQL JDBC logging safety gate failed.")
    }
    val configuration = requireCanonicalRuntimeConfiguration(applicationContext.environment)
    val connectionProperties = Properties().apply {
      setProperty("user", configuration.username)
      setProperty("password", configuration.password)
      setProperty("ApplicationName", configuration.applicationName)
      setProperty("logServerErrorDetail", "false")
      setProperty("sslmode", "disable")
      setProperty("gssEncMode", "disable")
    }
    val diagnostics = StartupDiagnostics()
    try {
      connect(configuration.jdbcUrl, connectionProperties).use { connection ->
        validateConnectedPostgresIdentity(connection, configuration, diagnostics)
        diagnostics.checkpoint(StartupControl.CONNECTION_CLOSE)
      }
    } catch (failure: Throwable) {
      throw diagnostics.sanitizedFailure(failure)
    } finally {
      connectionProperties.clear()
    }
  }
}

private enum class StartupStage {
  CONNECTION, JDBC_METADATA, IDENTITY, ROLE, MEMBERSHIPS, OWNERS_ACL, RESOURCE_CLOSE
}

private enum class StartupCategory {
  SQL_ERROR, INVARIANT_REJECTED, UNEXPECTED_ERROR
}

private enum class StartupControl(val stage: StartupStage? = null) {
  OPEN_CONNECTION(StartupStage.CONNECTION),
  METADATA_READ(StartupStage.JDBC_METADATA),
  METADATA_URL, METADATA_USERNAME, METADATA_DRIVER_VERSION,
  STATEMENT_OPEN(StartupStage.IDENTITY),
  IDENTITY_QUERY(StartupStage.IDENTITY),
  CURRENT_DATABASE, CURRENT_ROLE, SESSION_ROLE, SERVER_ADDRESS, SERVER_PORT,
  APPLICATION_NAME, SERVER_VERSION, TRANSPORT_MODE, LOGGING_SETTINGS,
  ROLE_QUERY(StartupStage.ROLE),
  ROLE_OID, ROLE_LOGIN, ROLE_PRIVILEGES, ROLE_CONNECTION_LIMIT, ROLE_PROVENANCE,
  MEMBERSHIPS_QUERY(StartupStage.MEMBERSHIPS),
  MEMBERSHIP_COUNT,
  OWNERS_ACL_QUERY(StartupStage.OWNERS_ACL),
  DATABASE_OID, DATABASE_OWNER, DATABASE_PROVENANCE, DATABASE_FLAGS,
  PUBLIC_SCHEMA_OWNER, DATABASE_ACL, PUBLIC_SCHEMA_ACL, USER_SCHEMA_COUNT,
  ROW_COUNT,
  RESULT_SET_CLOSE(StartupStage.RESOURCE_CLOSE),
  STATEMENT_CLOSE(StartupStage.RESOURCE_CLOSE),
  CONNECTION_CLOSE(StartupStage.RESOURCE_CLOSE)
}

private val STARTUP_ALLOWED_SQLSTATES = setOf(
  "08001", "08003", "08004", "08006", "08007", "08P01", "28000", "28P01",
  "3D000", "42501", "42601", "42703", "42883", "42P01", "53300", "53400",
  "55000", "57014", "57P01", "57P02", "57P03", "58000", "58030", "XX000"
)

private class StartupDiagnostics {
  private var stage = StartupStage.CONNECTION
  private var control = StartupControl.OPEN_CONNECTION

  fun checkpoint(next: StartupControl) {
    stage = next.stage ?: stage
    control = next
  }

  fun sanitizedFailure(failure: Throwable): IllegalStateException {
    val category = when (failure) {
      is SQLException -> StartupCategory.SQL_ERROR
      is GuardInvariantFailure -> StartupCategory.INVARIANT_REJECTED
      else -> StartupCategory.UNEXPECTED_ERROR
    }
    val sqlStateField = if (failure is SQLException) {
      // Even a driver override of getSQLState must not escape the sanitization boundary.
      val sqlState = try {
        val raw = failure.sqlState
        STARTUP_ALLOWED_SQLSTATES.firstOrNull { it == raw } ?: "UNKNOWN"
      } catch (_: Throwable) {
        "UNKNOWN"
      }
      "; sqlstate=$sqlState"
    } else {
      ""
    }
    // Never attach the original throwable: use() may have added raw close failures to it.
    return IllegalStateException(
      "PostgreSQL rail startup rejected; stage=$stage; category=$category; control=$control$sqlStateField"
    )
  }
}

internal object DisposablePostgresTestDatabase {
  fun truncateAllCurrentTables(dataSource: DataSource, environment: Environment) {
    runGuardedDestruction(dataSource, environment, DestructivePrimitive.TRUNCATE_ALL_CURRENT_TABLES)
  }

  fun recreatePublicSchemaForFlyway(dataSource: DataSource, environment: Environment) {
    runGuardedDestruction(dataSource, environment, DestructivePrimitive.RECREATE_PUBLIC_SCHEMA)
  }

  fun assertCanonicalDataSourceAndFlyway(
    dataSource: DataSource,
    flyway: Flyway,
    environment: Environment
  ) {
    if (!PostgresTestRailJdbcLogging.disableAndVerifyForTest()) {
      fail("PostgreSQL JDBC logging safety gate failed.")
    }
    val configuration = requireCanonicalRuntimeConfiguration(environment)
    val flywayDataSource = flyway.configuration.dataSource
      ?: fail("Flyway must expose the application DataSource.")
    if (flywayDataSource !== dataSource) {
      fail("Flyway must reuse the exact application DataSource instance.")
    }
    try {
      dataSource.connection.use { connection ->
        validateConnectedPostgresIdentity(connection, configuration)
      }
    } catch (_: Throwable) {
      fail("DataSource and Flyway identity validation failed.")
    }
  }

  fun requireRunBoundLocalStorageLeaf(environment: Environment): Path =
    requireCanonicalRuntimeConfiguration(environment).storageLocalRoot
}

private const val EXPECTED_DATABASE = "ritomer_043b_test"
private const val EXPECTED_ROLE = "ritomer_043b_test_runner"
private const val EXPECTED_JDBC_URL = "jdbc:postgresql://127.0.0.1:15432/ritomer_043b_test"
private const val EXPECTED_SERVER_ADDRESS = "127.0.0.1"
private const val EXPECTED_SERVER_PORT = "15432"
private const val EXPECTED_POSTGRES_MAJOR = 17
private const val EXPECTED_PGJDBC_VERSION = "42.7.10"
private const val EXPECTED_ROLE_CONNECTION_LIMIT = "16"
private const val DB_TESTS_ENABLED_VARIABLE = "RITOMER_DB_TESTS_ENABLED"
private const val DB_TEST_JDBC_URL_VARIABLE = "RITOMER_DB_TEST_JDBC_URL"
private const val DB_TEST_USERNAME_VARIABLE = "RITOMER_DB_TEST_USERNAME"
private const val DB_TEST_PASSWORD_VARIABLE = "RITOMER_DB_TEST_PASSWORD"
private const val DESTRUCTIVE_CONSENT_VARIABLE = "RITOMER_DB_TEST_DESTRUCTIVE_CONSENT"
private const val DESTRUCTIVE_CONSENT_VALUE = "TRUNCATE_RITOMER_043B_TEST"
private const val DB_RAIL_RUN_ID_VARIABLE = "RITOMER_DB_RAIL_RUN_ID"
private const val DB_RAIL_RUN_ROOT_VARIABLE = "RITOMER_DB_RAIL_RUN_ROOT"
private const val DB_RAIL_REVIEWED_OBJECT_SHA256_VARIABLE = "RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256"
private const val DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER_VARIABLE = "RITOMER_DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER"
private const val DB_RAIL_POSTMASTER_START_UNIX_MICROS_VARIABLE = "RITOMER_DB_RAIL_POSTMASTER_START_UNIX_MICROS"
private const val DB_RAIL_DATABASE_OID_VARIABLE = "RITOMER_DB_RAIL_DATABASE_OID"
private const val DB_RAIL_RUNNER_ROLE_OID_VARIABLE = "RITOMER_DB_RAIL_RUNNER_ROLE_OID"
private const val DB_TEST_RUN_ROOT_VARIABLE = "RITOMER_DB_TEST_RUN_ROOT"
private const val DB_TEST_PHASE_VARIABLE = "RITOMER_DB_TEST_PHASE"
private const val DB_TEST_STORAGE_LOCAL_ROOT_VARIABLE = "RITOMER_DB_TEST_STORAGE_LOCAL_ROOT"
private const val DB_TEST_APPLICATION_NAME_VARIABLE = "RITOMER_DB_TEST_APPLICATION_NAME"
private const val DATASOURCE_URL_PROPERTY = "spring.datasource.url"
private const val DATASOURCE_USERNAME_PROPERTY = "spring.datasource.username"
private const val DATASOURCE_PASSWORD_PROPERTY = "spring.datasource.password"
private const val DATASOURCE_APPLICATION_NAME_PROPERTY =
  "spring.datasource.hikari.data-source-properties.ApplicationName"
private const val DATASOURCE_LOG_DETAIL_PROPERTY =
  "spring.datasource.hikari.data-source-properties.logServerErrorDetail"
private const val DATASOURCE_SSL_MODE_PROPERTY =
  "spring.datasource.hikari.data-source-properties.sslmode"
private const val DATASOURCE_GSS_ENC_MODE_PROPERTY =
  "spring.datasource.hikari.data-source-properties.gssEncMode"
private const val STORAGE_BACKEND_PROPERTY = "ritomer.workpapers.documents.storage.backend"
private const val STORAGE_LOCAL_ROOT_PROPERTY = "ritomer.workpapers.documents.storage.local-root"

private val RUN_ID_PATTERN = Regex("[0-9a-f]{32}")
private val SHA256_PATTERN = Regex("[0-9a-f]{64}")
private val SYSTEM_IDENTIFIER_PATTERN = Regex("[1-9][0-9]{0,19}")
private val POSTMASTER_START_UNIX_MICROS_PATTERN = Regex("\\A[1-9][0-9]{0,18}\\z")
private val EXPECTED_RAIL_RUN_ROOT_PARENT =
  Path.of("C:\\dev\\ritomer-local-evidence\\m1-1b-postgresql")

internal val POSTGRES_TEST_RAIL_SAFE_SESSION_SETTINGS = linkedMapOf(
  "log_statement" to "none",
  "log_min_error_statement" to "panic",
  "log_min_duration_statement" to "-1",
  "log_min_duration_sample" to "-1",
  "log_statement_sample_rate" to "0",
  "log_transaction_sample_rate" to "0",
  "log_parameter_max_length" to "0",
  "log_parameter_max_length_on_error" to "0",
  "log_duration" to "off",
  "log_min_messages" to "panic",
  "log_error_verbosity" to "terse",
  "debug_print_parse" to "off",
  "debug_print_rewritten" to "off",
  "debug_print_plan" to "off",
  "log_statement_stats" to "off",
  "log_parser_stats" to "off",
  "log_planner_stats" to "off",
  "log_executor_stats" to "off",
  "track_activities" to "off",
  "compute_query_id" to "off",
  "local_preload_libraries" to ""
)

// These settings are protected by the administrative provisioning proof, not readable by the runner.
internal val POSTGRES_TEST_RAIL_ADMINISTRATIVE_SETTINGS = linkedMapOf(
  "shared_preload_libraries" to "",
  "session_preload_libraries" to ""
)

internal val POSTGRES_TEST_RAIL_ALL_SAFE_SETTINGS =
  POSTGRES_TEST_RAIL_SAFE_SESSION_SETTINGS + POSTGRES_TEST_RAIL_ADMINISTRATIVE_SETTINGS

private val POSTGRES_IDENTITY_SQL = buildString {
  append(
    """
    SELECT
      current_database(),
      current_user,
      session_user,
      host(inet_server_addr()),
      inet_server_port()::text,
      current_setting('application_name'),
      current_setting('server_version_num'),
      coalesce((select ssl from pg_stat_ssl where pid = pg_backend_pid()), false),
      coalesce((select gss_authenticated or encrypted from pg_stat_gssapi where pid = pg_backend_pid()), false),
      (EXTRACT(EPOCH FROM pg_catalog.pg_postmaster_start_time()) * 1000000)::pg_catalog.int8::pg_catalog.text
    """.trimIndent()
  )
  POSTGRES_TEST_RAIL_SAFE_SESSION_SETTINGS.keys.forEach { setting ->
    append(",\n  current_setting('")
    append(setting)
    append("')")
  }
}

private val POSTGRES_ROLE_SQL =
  """
  SELECT role_entry.oid::text,
         role_entry.rolcanlogin,
         role_entry.rolsuper,
         role_entry.rolcreatedb,
         role_entry.rolcreaterole,
         role_entry.rolinherit,
         role_entry.rolreplication,
         role_entry.rolbypassrls,
         role_entry.rolconnlimit::text,
         shobj_description(role_entry.oid, 'pg_authid')
  FROM pg_roles role_entry
  WHERE role_entry.rolname = 'ritomer_043b_test_runner'
  """.trimIndent()

private val EXPLICIT_MEMBERSHIP_SQL =
  """
  SELECT count(*)::text
  FROM pg_auth_members membership
  JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
  JOIN pg_roles member_role ON member_role.oid = membership.member
  WHERE granted_role.rolname = 'ritomer_043b_test_runner'
     OR member_role.rolname = 'ritomer_043b_test_runner'
  """.trimIndent()

private val OWNER_SQL =
  """
  SELECT database_entry.oid::text,
         pg_get_userbyid(database_entry.datdba),
         shobj_description(database_entry.oid, 'pg_database'),
         database_entry.datallowconn,
         database_entry.datistemplate,
         pg_get_userbyid(namespace_entry.nspowner),
         (
           select count(*) = 3
             and count(*) filter (
               where database_acl.grantee = database_entry.datdba
                 and database_acl.grantor = database_entry.datdba
                 and database_acl.privilege_type in ('CONNECT', 'CREATE', 'TEMPORARY')
                 and not database_acl.is_grantable
             ) = 3
           from aclexplode(coalesce(database_entry.datacl, acldefault('d', database_entry.datdba))) database_acl
         ),
         (
           select count(*) = 3
             and count(*) filter (
               where schema_acl.grantee = 0
                 and schema_acl.grantor = namespace_entry.nspowner
                 and schema_acl.privilege_type = 'USAGE'
                 and not schema_acl.is_grantable
             ) = 1
             and count(*) filter (
               where schema_acl.grantee = namespace_entry.nspowner
                 and schema_acl.grantor = namespace_entry.nspowner
                 and schema_acl.privilege_type in ('CREATE', 'USAGE')
                 and not schema_acl.is_grantable
             ) = 2
           from aclexplode(coalesce(namespace_entry.nspacl, acldefault('n', namespace_entry.nspowner))) schema_acl
         ),
         (
           SELECT count(*)::text
           FROM pg_namespace candidate_namespace
           WHERE candidate_namespace.nspname !~ '^pg_'
             AND candidate_namespace.nspname <> 'information_schema'
         ),
         (
           SELECT pg_catalog.count(*) = 1
             AND pg_catalog.count(*) FILTER (
               WHERE role_setting.entry = 'session_preload_libraries='
             ) = 1
           FROM pg_catalog.pg_db_role_setting role_default
           CROSS JOIN LATERAL pg_catalog.unnest(role_default.setconfig) AS role_setting(entry)
           WHERE role_default.setdatabase = 0
             AND role_default.setrole = runner_role.oid
             AND pg_catalog.lower(pg_catalog.split_part(role_setting.entry, '=', 1)) = 'session_preload_libraries'
         ),
         NOT EXISTS (
           SELECT 1
           FROM pg_catalog.pg_db_role_setting database_default
           CROSS JOIN LATERAL pg_catalog.unnest(database_default.setconfig) AS database_setting(entry)
           WHERE database_default.setdatabase = database_entry.oid
             AND database_default.setrole IN (runner_role.oid, 0)
             AND pg_catalog.lower(pg_catalog.split_part(database_setting.entry, '=', 1)) = 'session_preload_libraries'
         ),
         NOT pg_catalog.has_parameter_privilege(runner_role.oid, 'session_preload_libraries', 'SET')
           AND NOT pg_catalog.has_parameter_privilege(runner_role.oid, 'session_preload_libraries', 'ALTER SYSTEM')
           AND NOT pg_catalog.has_parameter_privilege(runner_role.oid, 'shared_preload_libraries', 'ALTER SYSTEM')
  FROM pg_database database_entry
  CROSS JOIN pg_namespace namespace_entry
  CROSS JOIN pg_catalog.pg_roles runner_role
  WHERE database_entry.datname = 'ritomer_043b_test'
    AND namespace_entry.nspname = 'public'
    AND runner_role.rolname = 'ritomer_043b_test_runner'
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
private const val GRANT_PUBLIC_SCHEMA_USAGE_SQL = "GRANT USAGE ON SCHEMA public TO PUBLIC"

private data class CanonicalRuntimeConfiguration(
  val jdbcUrl: String,
  val username: String,
  val password: String,
  val applicationName: String,
  val databaseOid: Long,
  val roleOid: Long,
  val postmasterStartUnixMicros: String,
  val storageLocalRoot: Path,
  val provenance: String
)

private enum class DestructivePrimitive {
  TRUNCATE_ALL_CURRENT_TABLES,
  RECREATE_PUBLIC_SCHEMA
}

private fun requireCanonicalRuntimeConfiguration(environment: Environment): CanonicalRuntimeConfiguration {
  rejectAlternateConfigurationChannels(environment)
  requireExact(environment.processEnvironmentValue(DB_TESTS_ENABLED_VARIABLE), "true", "PostgreSQL activation")
  requireExact(
    environment.processEnvironmentValue(DESTRUCTIVE_CONSENT_VARIABLE),
    DESTRUCTIVE_CONSENT_VALUE,
    "PostgreSQL destructive consent"
  )
  val jdbcUrl = requireExactValue(
    environment.processEnvironmentValue(DB_TEST_JDBC_URL_VARIABLE),
    EXPECTED_JDBC_URL,
    "PostgreSQL JDBC URL"
  )
  val username = requireExactValue(
    environment.processEnvironmentValue(DB_TEST_USERNAME_VARIABLE),
    EXPECTED_ROLE,
    "PostgreSQL username"
  )
  val password = environment.processEnvironmentValue(DB_TEST_PASSWORD_VARIABLE)
    ?.takeIf { it.isNotBlank() }
    ?: fail("PostgreSQL integration-test password must be present and non-blank.")

  val runId = environment.requiredProcessEnvironmentValue(DB_RAIL_RUN_ID_VARIABLE)
  if (!RUN_ID_PATTERN.matches(runId)) fail("PostgreSQL rail run id is invalid.")
  val reviewedObjectSha256 = environment.requiredProcessEnvironmentValue(DB_RAIL_REVIEWED_OBJECT_SHA256_VARIABLE)
  if (!SHA256_PATTERN.matches(reviewedObjectSha256)) fail("PostgreSQL reviewed object binding is invalid.")
  val clusterSystemIdentifier =
    environment.requiredProcessEnvironmentValue(DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER_VARIABLE)
  if (!SYSTEM_IDENTIFIER_PATTERN.matches(clusterSystemIdentifier)) fail("PostgreSQL cluster binding is invalid.")
  val postmasterStartUnixMicros =
    environment.requiredProcessEnvironmentValue(DB_RAIL_POSTMASTER_START_UNIX_MICROS_VARIABLE)
  if (
    !POSTMASTER_START_UNIX_MICROS_PATTERN.matches(postmasterStartUnixMicros) ||
    postmasterStartUnixMicros.toLongOrNull()?.let { it > 0L } != true
  ) fail("PostgreSQL postmaster start binding is invalid.")
  val databaseOid = parseOid(environment.requiredProcessEnvironmentValue(DB_RAIL_DATABASE_OID_VARIABLE), "database")
  val roleOid = parseOid(environment.requiredProcessEnvironmentValue(DB_RAIL_RUNNER_ROLE_OID_VARIABLE), "role")
  val phase = environment.requiredProcessEnvironmentValue(DB_TEST_PHASE_VARIABLE)
  if (phase != "targeted" && phase != "full") fail("PostgreSQL test phase is invalid.")
  val applicationName = environment.requiredProcessEnvironmentValue(DB_TEST_APPLICATION_NAME_VARIABLE)
  requireExact(applicationName, "ritomer-m1-1b-$runId-$phase", "PostgreSQL application name")

  val runRoot = requireAbsoluteNormalizedLocalPath(
    environment.requiredProcessEnvironmentValue(DB_RAIL_RUN_ROOT_VARIABLE),
    "rail run root"
  )
  val expectedRunRoot = EXPECTED_RAIL_RUN_ROOT_PARENT.resolve(runId)
  if (runRoot.toString() != expectedRunRoot.toString()) {
    fail("PostgreSQL rail run root is not the exact canonical run root.")
  }
  val testRunRoot = requireAbsoluteNormalizedLocalPath(
    environment.requiredProcessEnvironmentValue(DB_TEST_RUN_ROOT_VARIABLE),
    "test run root"
  )
  if (testRunRoot != runRoot) fail("PostgreSQL test run root diverges from the rail run root.")
  val storageLocalRoot = requireAbsoluteNormalizedLocalPath(
    environment.requiredProcessEnvironmentValue(DB_TEST_STORAGE_LOCAL_ROOT_VARIABLE),
    "storage leaf"
  )
  val expectedStorageLeaf = runRoot.resolve("volatile").resolve(phase).resolve("local-fs").normalize()
  if (storageLocalRoot != expectedStorageLeaf || !storageLocalRoot.startsWith(runRoot)) {
    fail("PostgreSQL test storage is not the exact run-bound leaf.")
  }
  requireNoLinksOrReparsePoints(runRoot)
  requireNoLinksOrReparsePoints(storageLocalRoot)

  requireExact(environment.requiredSpringProperty(DATASOURCE_URL_PROPERTY), jdbcUrl, "Spring datasource URL")
  requireExact(environment.requiredSpringProperty(DATASOURCE_USERNAME_PROPERTY), username, "Spring datasource username")
  requireExact(environment.requiredSpringProperty(DATASOURCE_PASSWORD_PROPERTY), password, "Spring datasource password")
  requireExact(
    environment.requiredSpringProperty(DATASOURCE_APPLICATION_NAME_PROPERTY),
    applicationName,
    "PostgreSQL JDBC application name"
  )
  requireExact(environment.requiredSpringProperty(DATASOURCE_LOG_DETAIL_PROPERTY), "false", "JDBC error detail")
  requireExact(environment.requiredSpringProperty(DATASOURCE_SSL_MODE_PROPERTY), "disable", "JDBC SSL mode")
  requireExact(environment.requiredSpringProperty(DATASOURCE_GSS_ENC_MODE_PROPERTY), "disable", "JDBC GSS mode")
  requireExact(environment.requiredSpringProperty(STORAGE_BACKEND_PROPERTY), "LOCAL_FS", "storage backend")
  requireExact(
    environment.requiredSpringProperty(STORAGE_LOCAL_ROOT_PROPERTY),
    storageLocalRoot.toString(),
    "storage local root"
  )
  requireExact(environment.requiredSpringProperty("spring.flyway.enabled"), "true", "Flyway activation")
  requireExact(environment.requiredSpringProperty("spring.flyway.clean-disabled"), "true", "Flyway clean guard")
  requireExact(environment.requiredSpringProperty("spring.sql.init.mode"), "never", "SQL initializer mode")
  listOf("spring.flyway.url", "spring.flyway.user", "spring.flyway.password", "spring.flyway.driver-class-name")
    .forEach { propertyName ->
      if (environment.getProperty(propertyName) != null) fail("Flyway alternate connection is forbidden.")
    }

  return CanonicalRuntimeConfiguration(
    jdbcUrl = jdbcUrl,
    username = username,
    password = password,
    applicationName = applicationName,
    databaseOid = databaseOid,
    roleOid = roleOid,
    postmasterStartUnixMicros = postmasterStartUnixMicros,
    storageLocalRoot = storageLocalRoot,
    provenance = postgresTestRailProvenance(runId, reviewedObjectSha256, clusterSystemIdentifier)
  )
}

private fun runGuardedDestruction(
  dataSource: DataSource,
  environment: Environment,
  primitive: DestructivePrimitive
) {
  if (!PostgresTestRailJdbcLogging.disableAndVerifyForTest()) {
    fail("PostgreSQL JDBC logging safety gate failed.")
  }
  val configuration = requireCanonicalRuntimeConfiguration(environment)
  sanitizePostgresFailure("PostgreSQL guarded destructive operation failed.") {
    dataSource.connection.use { connection ->
      val originalAutoCommit = connection.autoCommit
      var primaryFailure: Throwable? = null
      try {
        connection.autoCommit = false
        validateConnectedPostgresIdentity(connection, configuration)
        connection.createStatement().use { statement ->
          when (primitive) {
            DestructivePrimitive.TRUNCATE_ALL_CURRENT_TABLES -> statement.execute(TRUNCATE_ALL_CURRENT_TABLES_SQL)
            DestructivePrimitive.RECREATE_PUBLIC_SCHEMA -> {
              statement.execute(DROP_PUBLIC_SCHEMA_SQL)
              statement.execute(CREATE_PUBLIC_SCHEMA_SQL)
              statement.execute(GRANT_PUBLIC_SCHEMA_USAGE_SQL)
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
}

private fun validateConnectedPostgresIdentity(
  connection: Connection,
  configuration: CanonicalRuntimeConfiguration,
  diagnostics: StartupDiagnostics? = null
) {
  diagnostics?.checkpoint(StartupControl.METADATA_READ)
  val metadata = connection.metaData ?: fail("PostgreSQL JDBC metadata is required.")
  diagnostics?.checkpoint(StartupControl.METADATA_URL)
  requireExact(metadata.url, EXPECTED_JDBC_URL, "PostgreSQL JDBC metadata URL")
  diagnostics?.checkpoint(StartupControl.METADATA_USERNAME)
  requireExact(metadata.userName, EXPECTED_ROLE, "PostgreSQL JDBC metadata username")
  diagnostics?.checkpoint(StartupControl.METADATA_DRIVER_VERSION)
  requireExact(metadata.driverVersion, EXPECTED_PGJDBC_VERSION, "PostgreSQL JDBC driver version")

  diagnostics?.checkpoint(StartupControl.STATEMENT_OPEN)
  connection.createStatement().use { statement ->
    diagnostics?.checkpoint(StartupControl.IDENTITY_QUERY)
    readExactlyOneRow(statement.executeQuery(POSTGRES_IDENTITY_SQL), "PostgreSQL session identity", diagnostics) { row ->
      diagnostics?.checkpoint(StartupControl.CURRENT_DATABASE)
      requireExact(row.requiredString(1), EXPECTED_DATABASE, "PostgreSQL current database")
      diagnostics?.checkpoint(StartupControl.CURRENT_ROLE)
      requireExact(row.requiredString(2), EXPECTED_ROLE, "PostgreSQL current role")
      diagnostics?.checkpoint(StartupControl.SESSION_ROLE)
      requireExact(row.requiredString(3), EXPECTED_ROLE, "PostgreSQL session role")
      diagnostics?.checkpoint(StartupControl.SERVER_ADDRESS)
      requireExact(row.requiredString(4), EXPECTED_SERVER_ADDRESS, "PostgreSQL server address")
      diagnostics?.checkpoint(StartupControl.SERVER_PORT)
      requireExact(row.requiredString(5), EXPECTED_SERVER_PORT, "PostgreSQL server port")
      diagnostics?.checkpoint(StartupControl.APPLICATION_NAME)
      requireExact(row.requiredString(6), configuration.applicationName, "PostgreSQL application name")
      diagnostics?.checkpoint(StartupControl.SERVER_VERSION)
      val version = row.requiredString(7).toIntOrNull() ?: fail("PostgreSQL server version is invalid.")
      if (version / 10_000 != EXPECTED_POSTGRES_MAJOR) fail("PostgreSQL server major version is invalid.")
      requireExact(
        row.requiredString(10),
        configuration.postmasterStartUnixMicros,
        "PostgreSQL postmaster start"
      )
      diagnostics?.checkpoint(StartupControl.TRANSPORT_MODE)
      if (row.requiredBoolean(8) || row.requiredBoolean(9)) fail("PostgreSQL transport mode is invalid.")
      diagnostics?.checkpoint(StartupControl.LOGGING_SETTINGS)
      POSTGRES_TEST_RAIL_SAFE_SESSION_SETTINGS.values.forEachIndexed { settingIndex, expected ->
        requireExact(row.stringAllowingEmpty(11 + settingIndex), expected, "PostgreSQL logging safety")
      }
    }
    diagnostics?.checkpoint(StartupControl.ROLE_QUERY)
    readExactlyOneRow(statement.executeQuery(POSTGRES_ROLE_SQL), "PostgreSQL role privileges", diagnostics) { row ->
      diagnostics?.checkpoint(StartupControl.ROLE_OID)
      requireExact(row.requiredString(1), configuration.roleOid.toString(), "PostgreSQL runner role OID")
      diagnostics?.checkpoint(StartupControl.ROLE_LOGIN)
      if (!row.requiredBoolean(2)) fail("PostgreSQL runner role must be login-enabled.")
      diagnostics?.checkpoint(StartupControl.ROLE_PRIVILEGES)
      for (index in 3..8) if (row.requiredBoolean(index)) fail("PostgreSQL runner role has a forbidden privilege.")
      diagnostics?.checkpoint(StartupControl.ROLE_CONNECTION_LIMIT)
      requireExact(row.requiredString(9), EXPECTED_ROLE_CONNECTION_LIMIT, "PostgreSQL role connection limit")
      diagnostics?.checkpoint(StartupControl.ROLE_PROVENANCE)
      requireExact(row.requiredString(10), configuration.provenance, "PostgreSQL role provenance")
    }
    diagnostics?.checkpoint(StartupControl.MEMBERSHIPS_QUERY)
    readExactlyOneRow(statement.executeQuery(EXPLICIT_MEMBERSHIP_SQL), "PostgreSQL role memberships", diagnostics) { row ->
      diagnostics?.checkpoint(StartupControl.MEMBERSHIP_COUNT)
      requireExact(row.requiredString(1), "0", "PostgreSQL role membership count")
    }
    diagnostics?.checkpoint(StartupControl.OWNERS_ACL_QUERY)
    readExactlyOneRow(statement.executeQuery(OWNER_SQL), "PostgreSQL owners and provenance", diagnostics) { row ->
      diagnostics?.checkpoint(StartupControl.DATABASE_OID)
      requireExact(row.requiredString(1), configuration.databaseOid.toString(), "PostgreSQL database OID")
      diagnostics?.checkpoint(StartupControl.DATABASE_OWNER)
      requireExact(row.requiredString(2), EXPECTED_ROLE, "PostgreSQL database owner")
      diagnostics?.checkpoint(StartupControl.DATABASE_PROVENANCE)
      requireExact(row.requiredString(3), configuration.provenance, "PostgreSQL database provenance")
      diagnostics?.checkpoint(StartupControl.DATABASE_FLAGS)
      if (!row.requiredBoolean(4) || row.requiredBoolean(5)) fail("PostgreSQL database flags are invalid.")
      diagnostics?.checkpoint(StartupControl.PUBLIC_SCHEMA_OWNER)
      val publicSchemaOwner = row.requiredString(6)
      if (publicSchemaOwner != EXPECTED_ROLE && publicSchemaOwner != "pg_database_owner") {
        fail("PostgreSQL public schema owner is invalid.")
      }
      diagnostics?.checkpoint(StartupControl.DATABASE_ACL)
      if (!row.requiredBoolean(7)) fail("PostgreSQL database ACL inventory is invalid.")
      diagnostics?.checkpoint(StartupControl.PUBLIC_SCHEMA_ACL)
      if (!row.requiredBoolean(8)) fail("PostgreSQL public schema ACL inventory is invalid.")
      diagnostics?.checkpoint(StartupControl.USER_SCHEMA_COUNT)
      requireExact(row.requiredString(9), "1", "PostgreSQL user schema count")
      if (!row.requiredBoolean(10)) fail("PostgreSQL session preload role default is invalid.")
      if (!row.requiredBoolean(11)) fail("PostgreSQL session preload database overrides are forbidden.")
      if (!row.requiredBoolean(12)) fail("PostgreSQL preload mutation privileges are forbidden.")
    }
    diagnostics?.checkpoint(StartupControl.STATEMENT_CLOSE)
  }
}

private fun rejectAlternateConfigurationChannels(environment: Environment) {
  val configurable = environment as? ConfigurableEnvironment
    ?: fail("Configurable Spring environment is required for PostgreSQL safety checks.")
  val processNames = configurable.propertySources[StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME]
    .enumerableNames()
  if (processNames.any { name ->
      val upper = name.uppercase()
      upper == "SPRING_APPLICATION_JSON" || upper.startsWith("SPRING_DATASOURCE_") ||
        upper.startsWith("SPRING_FLYWAY_") || upper.startsWith("RITOMER_WORKPAPERS_DOCUMENTS_STORAGE_")
    }
  ) fail("Alternate PostgreSQL process configuration is forbidden.")

  val systemNames = configurable.propertySources[StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME]
    .enumerableNames()
  if (systemNames.any { name ->
      val lower = name.lowercase()
      lower == "spring.application.json" || lower.startsWith("spring.datasource.") ||
        lower.startsWith("spring.flyway.") || lower.startsWith("ritomer.workpapers.documents.storage.") ||
        lower.startsWith("ritomer_db_test_")
    }
  ) fail("Alternate PostgreSQL system-property configuration is forbidden.")
}

private fun Any?.enumerableNames(): List<String> =
  (this as? EnumerablePropertySource<*>)?.propertyNames?.toList()
    ?: fail("Enumerable Spring property source is required for PostgreSQL safety checks.")

private fun parseOid(raw: String, description: String): Long {
  val oid = raw.toLongOrNull() ?: fail("PostgreSQL $description OID binding is invalid.")
  if (oid !in 1..0xffff_ffffL) fail("PostgreSQL $description OID binding is invalid.")
  return oid
}

private fun requireAbsoluteNormalizedLocalPath(raw: String, description: String): Path {
  if (raw.startsWith("\\\\")) fail("PostgreSQL $description must be local.")
  val path = try {
    Path.of(raw)
  } catch (_: Exception) {
    fail("PostgreSQL $description is invalid.")
  }
  if (!path.isAbsolute || path != path.normalize()) fail("PostgreSQL $description must be absolute and normalized.")
  return path
}

private fun requireNoLinksOrReparsePoints(path: Path) {
  var current = path.root ?: fail("PostgreSQL rail path root is missing.")
  path.forEach { segment ->
    current = current.resolve(segment)
    if (Files.exists(current, LinkOption.NOFOLLOW_LINKS)) {
      val attributes = Files.readAttributes(current, BasicFileAttributes::class.java, LinkOption.NOFOLLOW_LINKS)
      if (Files.isSymbolicLink(current) || attributes.isOther) {
        fail("PostgreSQL rail paths must not traverse links or reparse points.")
      }
    }
  }
}

internal fun postgresTestRailProvenance(
  runId: String,
  reviewedObjectSha256: String,
  clusterSystemIdentifier: String
): String = "ritomer-m1-1b:$runId:$reviewedObjectSha256:$clusterSystemIdentifier"

private fun Environment.requiredProcessEnvironmentValue(name: String): String =
  processEnvironmentValue(name)?.takeIf { it.isNotBlank() }
    ?: fail("Required PostgreSQL rail environment is missing.")

private fun Environment.processEnvironmentValue(name: String): String? {
  val configurable = this as? ConfigurableEnvironment
    ?: fail("Configurable Spring environment is required for PostgreSQL safety checks.")
  val source = configurable.propertySources[StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME]
    ?: fail("Required Spring property source is unavailable.")
  val matchingNames = source.enumerableNames().filter { it.equals(name, ignoreCase = true) }
  if (matchingNames.isEmpty()) return null
  if (matchingNames != listOf(name)) fail("PostgreSQL rail environment variable casing is invalid.")
  val value = source.getProperty(name)
  return value as? String ?: fail("PostgreSQL safety configuration values must be strings.")
}

private fun Environment.requiredSpringProperty(name: String): String =
  getProperty(name)?.takeIf { it.isNotBlank() }
    ?: fail("Required Spring PostgreSQL rail configuration is missing.")

private inline fun readExactlyOneRow(
  resultSet: ResultSet,
  description: String,
  diagnostics: StartupDiagnostics?,
  read: (ResultSet) -> Unit
) {
  resultSet.use { rows ->
    diagnostics?.checkpoint(StartupControl.ROW_COUNT)
    if (!rows.next()) fail("$description returned no row.")
    read(rows)
    diagnostics?.checkpoint(StartupControl.ROW_COUNT)
    if (rows.next()) fail("$description returned multiple rows.")
    diagnostics?.checkpoint(StartupControl.RESULT_SET_CLOSE)
  }
}

private fun ResultSet.requiredString(index: Int): String =
  getString(index)?.takeIf { it.isNotBlank() }
    ?: fail("PostgreSQL safety query returned a missing or blank value.")

private fun ResultSet.stringAllowingEmpty(index: Int): String =
  getString(index) ?: fail("PostgreSQL safety query returned a null value.")

private fun ResultSet.requiredBoolean(index: Int): Boolean {
  val value = getBoolean(index)
  if (wasNull()) fail("PostgreSQL safety query returned a null boolean.")
  return value
}

private fun requireExact(actual: String?, expected: String, description: String) {
  if (actual == null || actual != expected) {
    fail("$description does not match the dedicated local synthetic PostgreSQL rail.")
  }
}

private fun requireExactValue(actual: String?, expected: String, description: String): String {
  requireExact(actual, expected, description)
  return expected
}

private inline fun sanitizePostgresFailure(message: String, operation: () -> Unit) {
  try {
    operation()
  } catch (_: Throwable) {
    fail(message)
  }
}

private class GuardInvariantFailure(message: String) : IllegalStateException(message)

private fun fail(message: String): Nothing = throw GuardInvariantFailure(message)
