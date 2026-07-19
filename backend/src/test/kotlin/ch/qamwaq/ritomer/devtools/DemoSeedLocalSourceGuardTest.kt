package ch.qamwaq.ritomer.devtools

import java.nio.file.Files
import java.nio.file.Path
import java.sql.DriverManager
import kotlin.io.path.readText
import kotlin.streams.asSequence
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.NullAndEmptySource
import org.junit.jupiter.params.provider.ValueSource
import org.springframework.context.ApplicationContextInitializer
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.JdbcTemplate

internal const val DISPOSABLE_POSTGRES_TEST_DATABASE = "ritomer_043b_test"
internal const val DISPOSABLE_POSTGRES_TEST_LOGIN_ROLE = "ritomer_043b_test_runner"
internal const val DESTRUCTIVE_DB_TEST_CONSENT_VARIABLE = "RITOMER_DB_TEST_DESTRUCTIVE_CONSENT"
internal const val DESTRUCTIVE_DB_TEST_CONSENT_VALUE = "TRUNCATE_RITOMER_043B_TEST"
internal const val POSTGRES_IDENTITY_QUERY = "select current_database(), current_user, session_user"

private const val DATASOURCE_URL_PROPERTY = "spring.datasource.url"
private const val DATASOURCE_USERNAME_PROPERTY = "spring.datasource.username"
private const val DATASOURCE_PASSWORD_PROPERTY = "spring.datasource.password"

internal data class PostgresSessionIdentity(
  val database: String?,
  val currentUser: String?,
  val sessionUser: String?
)

private data class ResolvedTestDatasource(
  val url: String,
  val username: String,
  val password: String
) {
  companion object {
    fun from(environment: Environment): ResolvedTestDatasource =
      ResolvedTestDatasource(
        url = environment.requiredNonBlank(DATASOURCE_URL_PROPERTY),
        username = environment.requiredNonBlank(DATASOURCE_USERNAME_PROPERTY),
        password = environment.requiredNonBlank(DATASOURCE_PASSWORD_PROPERTY)
      )
  }
}

internal class DisposablePostgresTestDatabaseGuardInitializer :
  ApplicationContextInitializer<ConfigurableApplicationContext> {
  override fun initialize(applicationContext: ConfigurableApplicationContext) {
    val environment = applicationContext.environment
    val consent = environment.getProperty(DESTRUCTIVE_DB_TEST_CONSENT_VARIABLE)

    requireExactDestructiveConsent(consent)
    val datasource = ResolvedTestDatasource.from(environment)
    validateDisposablePostgresTestDatabase(consent) {
      DriverManager.getConnection(datasource.url, datasource.username, datasource.password).use { connection ->
        connection.prepareStatement(POSTGRES_IDENTITY_QUERY).use { statement ->
          readPostgresSessionIdentity(statement.executeQuery())
        }
      }
    }
  }
}

internal fun validateDisposablePostgresTestDatabase(
  consent: String?,
  readIdentity: () -> PostgresSessionIdentity
) {
  requireExactDestructiveConsent(consent)
  val identity = try {
    readIdentity()
  } catch (_: Exception) {
    throw IllegalStateException("Disposable PostgreSQL test database identity verification failed.")
  }
  requireExactPostgresIdentity(identity)
}

internal fun runValidatedDestructiveSetup(
  consent: String?,
  readIdentity: () -> PostgresSessionIdentity,
  destructiveSetup: () -> Unit
) {
  validateDisposablePostgresTestDatabase(consent, readIdentity)
  destructiveSetup()
}

internal fun runValidatedDestructiveSetup(
  jdbcTemplate: JdbcTemplate,
  destructiveSetup: () -> Unit
) {
  val dataSource = jdbcTemplate.dataSource
    ?: throw IllegalStateException("Disposable PostgreSQL test DataSource is required.")
  runValidatedDestructiveSetup(
    consent = System.getenv(DESTRUCTIVE_DB_TEST_CONSENT_VARIABLE),
    readIdentity = {
      dataSource.connection.use { connection ->
        connection.prepareStatement(POSTGRES_IDENTITY_QUERY).use { statement ->
          readPostgresSessionIdentity(statement.executeQuery())
        }
      }
    },
    destructiveSetup = destructiveSetup
  )
}

private fun readPostgresSessionIdentity(resultSet: java.sql.ResultSet): PostgresSessionIdentity =
  resultSet.use {
    if (!it.next()) {
      throw IllegalStateException("Disposable PostgreSQL test identity query returned no row.")
    }
    val identity = PostgresSessionIdentity(
      database = it.getString(1),
      currentUser = it.getString(2),
      sessionUser = it.getString(3)
    )
    if (it.next()) {
      throw IllegalStateException("Disposable PostgreSQL test identity query returned multiple rows.")
    }
    identity
  }

private fun requireExactDestructiveConsent(consent: String?) {
  if (consent != DESTRUCTIVE_DB_TEST_CONSENT_VALUE) {
    throw IllegalStateException(
      "$DESTRUCTIVE_DB_TEST_CONSENT_VARIABLE must equal the exact destructive-test consent value."
    )
  }
}

private fun requireExactPostgresIdentity(identity: PostgresSessionIdentity) {
  val exactIdentity = identity.database == DISPOSABLE_POSTGRES_TEST_DATABASE &&
    identity.currentUser == DISPOSABLE_POSTGRES_TEST_LOGIN_ROLE &&
    identity.sessionUser == DISPOSABLE_POSTGRES_TEST_LOGIN_ROLE
  if (!exactIdentity) {
    throw IllegalStateException("Disposable PostgreSQL test database identity is not the dedicated 043b target.")
  }
}

private fun Environment.requiredNonBlank(propertyName: String): String =
  getProperty(propertyName)?.takeIf { it.isNotBlank() }
    ?: throw IllegalStateException("Required disposable PostgreSQL test datasource property is missing: $propertyName")

class DemoSeedLocalSourceGuardTest {
  @Test
  fun `demo seed main source exposes no http endpoint auth bypass or sensitive local value`() {
    val source = mainDevtoolsSource()

    assertThat(source).doesNotContain(
      "@RestController",
      "@Controller",
      "@RequestMapping",
      "@GetMapping",
      "@PostMapping",
      "@PutMapping",
      "@DeleteMapping",
      "SecurityFilterChain",
      "permitAll",
      "JwtDecoder",
      "BearerToken",
      "password",
      "secret",
      "token",
      "credential",
      "GraphQL",
      "OpenAPI"
    )
    assertThat(source).contains(
      DEMO_SEED_VARIANT_043B_TWO_ACTOR_PILOT,
      DEMO_SEED_DATASET_CLASSIFICATION_043B,
      DemoSeedLocalDataset.reviewerExternalSubject
    )
    assertThat(source).doesNotContain(
      "insert into workpaper",
      "insert into workpaper_evidence",
      "insert into document",
      "insert into document_verification",
      "insert into export_pack"
    )
    assertThat(Regex("""(^|[\\/])\.env($|[^A-Za-z])""").containsMatchIn(source)).isFalse()
  }

  @Test
  fun `demo seed Gradle task uses exact documented Gradle property names`() {
    val runbook = Path.of("../runbooks/local-dev.md").readText()
    val buildScript = Path.of("build.gradle.kts").readText()
    val enabledProperty = "ritomerDemoSeedEnabled"
    val profileProperty = "ritomerDemoSeedProfile"
    val variantProperty = "ritomerDemoSeedVariant"

    assertThat(runbook).contains(
      "-P$enabledProperty=true",
      "-P$profileProperty=dbtest",
      "-P$variantProperty=$DEMO_SEED_VARIANT_042A2A5D_MIXED_V2",
      "-P$variantProperty=$DEMO_SEED_VARIANT_043B_TWO_ACTOR_PILOT"
    )
    assertThat(buildScript).contains(
      """providers.gradleProperty("$enabledProperty")""",
      """providers.gradleProperty("$profileProperty")""",
      """providers.gradleProperty("$variantProperty")"""
    )
    assertThat(buildScript).doesNotContain(
      """providers.gradleProperty("RitomerDemoSeedEnabled")""",
      """providers.gradleProperty("RitomerDemoSeedProfile")""",
      """providers.gradleProperty("RitomerDemoSeedVariant")"""
    )
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = [" ", "WRONG", "true", "false"])
  fun `destructive guard rejects absent empty incorrect and textual boolean consent`(consent: String?) {
    assertRejected(consent = consent)
  }

  @ParameterizedTest
  @ValueSource(
    strings = [
      "ritomer",
      "postgres",
      "template0",
      "template1",
      "another_database",
      "another_database_test"
    ]
  )
  fun `destructive guard rejects every database except the exact disposable target`(database: String) {
    assertRejected(identity = exactIdentity().copy(database = database))
  }

  @ParameterizedTest
  @ValueSource(strings = ["ritomer", "another_test_runner"])
  fun `destructive guard rejects non dedicated current and session roles`(role: String) {
    assertRejected(identity = exactIdentity().copy(currentUser = role, sessionUser = role))
  }

  @Test
  fun `destructive guard rejects an incorrect current user`() {
    assertRejected(identity = exactIdentity().copy(currentUser = "another_test_runner"))
  }

  @Test
  fun `destructive guard rejects an incorrect session user`() {
    assertRejected(identity = exactIdentity().copy(sessionUser = "another_test_runner"))
  }

  @Test
  fun `destructive guard rejects null and blank identity values`() {
    val invalidIdentities = listOf(
      exactIdentity().copy(database = null),
      exactIdentity().copy(database = ""),
      exactIdentity().copy(currentUser = null),
      exactIdentity().copy(currentUser = " "),
      exactIdentity().copy(sessionUser = null),
      exactIdentity().copy(sessionUser = "")
    )

    invalidIdentities.forEach(::assertRejected)
  }

  @Test
  fun `destructive guard rejects a connection failure without invoking destructive setup`() {
    assertRejected(readIdentity = { throw IllegalStateException("synthetic connection failure") })
  }

  @Test
  fun `destructive guard rejects an identity select failure without invoking destructive setup`() {
    assertRejected(readIdentity = { throw java.sql.SQLException("synthetic select failure") })
  }

  @Test
  fun `destructive guard checks consent before reading an otherwise correct identity`() {
    var identityReadCount = 0
    var destructiveCallCount = 0

    assertThatThrownBy {
      runValidatedDestructiveSetup(
        consent = "WRONG",
        readIdentity = {
          identityReadCount += 1
          exactIdentity()
        },
        destructiveSetup = { destructiveCallCount += 1 }
      )
    }.isInstanceOf(IllegalStateException::class.java)

    assertThat(identityReadCount).isZero()
    assertThat(destructiveCallCount).isZero()
  }

  @Test
  fun `destructive guard invokes setup exactly once only for exact consent database and roles`() {
    var destructiveCallCount = 0

    runValidatedDestructiveSetup(
      consent = DESTRUCTIVE_DB_TEST_CONSENT_VALUE,
      readIdentity = ::exactIdentity,
      destructiveSetup = { destructiveCallCount += 1 }
    )

    assertThat(destructiveCallCount).isEqualTo(1)
  }

  @Test
  fun `both destructive DB tests declare the pre refresh initializer and guard every truncate`() {
    val dbTestSources = listOf(
      Path.of("src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalDbIntegrationTest.kt").readText(),
      Path.of("src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalAuthMeDbIntegrationTest.kt").readText()
    )
    val guardedTruncate = Regex(
      """runValidatedDestructiveSetup\(jdbcTemplate\)\s*\{\s*jdbcTemplate\.execute\(\s*\"\"\"\s*truncate table""",
      setOf(RegexOption.DOT_MATCHES_ALL, RegexOption.IGNORE_CASE)
    )

    dbTestSources.forEach { source ->
      assertThat(source).contains(
        "@ContextConfiguration(initializers = [DisposablePostgresTestDatabaseGuardInitializer::class])"
      )
      assertThat(guardedTruncate.containsMatchIn(source)).isTrue()
      assertThat(
        Regex("""fun resetDatabaseState\(\)[\s\S]*?runValidatedDestructiveSetup\(jdbcTemplate\)""")
          .containsMatchIn(source)
      ).isTrue()
    }
  }

  private fun assertRejected(
    identity: PostgresSessionIdentity = exactIdentity(),
    consent: String? = DESTRUCTIVE_DB_TEST_CONSENT_VALUE,
    readIdentity: () -> PostgresSessionIdentity = { identity }
  ) {
    var destructiveCallCount = 0

    assertThatThrownBy {
      runValidatedDestructiveSetup(
        consent = consent,
        readIdentity = readIdentity,
        destructiveSetup = { destructiveCallCount += 1 }
      )
    }.isInstanceOf(IllegalStateException::class.java)

    assertThat(destructiveCallCount).isZero()
  }

  private fun exactIdentity(): PostgresSessionIdentity =
    PostgresSessionIdentity(
      database = DISPOSABLE_POSTGRES_TEST_DATABASE,
      currentUser = DISPOSABLE_POSTGRES_TEST_LOGIN_ROLE,
      sessionUser = DISPOSABLE_POSTGRES_TEST_LOGIN_ROLE
    )

  private fun mainDevtoolsSource(): String {
    val root = Path.of("src/main/kotlin/ch/qamwaq/ritomer/devtools")
    return Files.walk(root).use { paths ->
      paths.asSequence()
        .filter { Files.isRegularFile(it) }
        .sorted()
        .joinToString(separator = "\n") { it.readText() }
    }
  }
}
