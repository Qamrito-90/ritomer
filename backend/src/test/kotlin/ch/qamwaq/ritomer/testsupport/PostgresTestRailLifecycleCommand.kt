package ch.qamwaq.ritomer.testsupport

import ch.qamwaq.ritomer.RitomerBackendApplication
import ch.qamwaq.ritomer.devtools.DemoSeedLocalActivation
import ch.qamwaq.ritomer.devtools.DemoSeedLocalService
import java.util.logging.Level
import java.util.logging.LogManager
import java.util.logging.Logger
import javax.sql.DataSource
import kotlin.system.exitProcess
import org.flywaydb.core.Flyway
import org.springframework.boot.WebApplicationType
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.context.ApplicationContextInitializer
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.core.env.ConfigurableEnvironment
import org.springframework.core.env.EnumerablePropertySource
import org.springframework.core.env.MapPropertySource
import org.springframework.core.env.StandardEnvironment

/** Private operational entrypoint: never registered as a Spring component or a Gradle task. */
internal object PostgresTestRailDBootstrap {
  private val railNames = setOf(
    "RITOMER_DB_RAIL_CAMPAIGN", "RITOMER_DB_RAIL_BUILD_ROOT", "RITOMER_DB_RAIL_RUN_ID",
    "RITOMER_DB_RAIL_RUN_ROOT", "RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256",
    "RITOMER_DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER", "RITOMER_DB_RAIL_POSTMASTER_START_UNIX_MICROS",
    "RITOMER_DB_RAIL_DATABASE_OID", "RITOMER_DB_RAIL_RUNNER_ROLE_OID", "RITOMER_DB_RAIL_RUNTIME_SHA256",
    "RITOMER_DB_TESTS_ENABLED", "RITOMER_DB_TEST_JDBC_URL", "RITOMER_DB_TEST_USERNAME",
    "RITOMER_DB_TEST_PASSWORD", "RITOMER_DB_TEST_DESTRUCTIVE_CONSENT", "RITOMER_DB_TEST_RUN_ROOT",
    "RITOMER_DB_TEST_PHASE", "RITOMER_DB_TEST_STORAGE_LOCAL_ROOT", "RITOMER_DB_TEST_APPLICATION_NAME"
  )
  private val osNames = setOf(
    "COMSPEC", "HOME", "JAVA_HOME", "LANG", "LC_ALL", "NUMBER_OF_PROCESSORS", "OS",
    "PATH", "PATHEXT", "SYSTEMDRIVE", "SYSTEMROOT", "TEMP", "TMP", "USERPROFILE", "WINDIR",
    "APPDATA", "LOCALAPPDATA", "USERNAME", "USERDOMAIN"
  )

  @JvmStatic
  fun main(args: Array<String>) {
    try {
      require(args.size == 1 && args[0] in setOf("seed", "backend"))
      val mode = args.single()
      check(PostgresTestRailJdbcLogging.disableAndVerifyForTest())
      val environment = StandardEnvironment()
      validateLaunchEnvironment(mode, environment)
      // Config data may only come from the reviewed main runtime, never the working directory.
      environment.propertySources.addFirst(MapPropertySource("m1d-config-location", mapOf(
        "spring.config.location" to "classpath:/",
        "spring.config.name" to "application"
      )))
      environment.setActiveProfiles("local")
      val runId = environment.systemEnvironment["RITOMER_DB_RAIL_RUN_ID"] as String
      SpringApplicationBuilder(RitomerBackendApplication::class.java)
        .environment(environment)
        .web(if (mode == "seed") WebApplicationType.NONE else WebApplicationType.SERVLET)
        .initializers(initializer(mode))
        .run()
        .use { context ->
          DisposablePostgresTestDatabase.assertCanonicalDataSourceAndFlyway(
            context.getBean(DataSource::class.java), context.getBean(Flyway::class.java), context.environment
          )
          if (mode == "seed") {
            DemoSeedLocalActivation.from(context.environment).requireEnabled()
            val result = context.getBean(DemoSeedLocalService::class.java).seed()
            check(result.changedRows > 0 && result.auditEventId != null)
            check(result.variantResults.single().let {
              it.variant == "043b-two-actor-pilot" &&
                it.datasetClassification == "HARNESS_ONLY_AUTH_RBAC_DATASET" &&
                it.balanceImportLineCount > 0 && it.manualMappingCount > 0
            })
          } else {
            println("M1D_BACKEND_READY $runId")
            check(readlnOrNull() == "M1D_BACKEND_STOP $runId")
          }
        }
      println(if (mode == "seed") "M1D_SEED_COMPLETED $runId" else "M1D_BACKEND_STOPPED $runId")
    } catch (_: Throwable) {
      // Spring/driver exceptions must never become an unbounded credential-bearing stacktrace.
      System.err.println("M1D_BOOTSTRAP_REJECTED")
      exitProcess(1)
    }
  }

  internal fun validateLaunchEnvironment(mode: String, environment: ConfigurableEnvironment) {
    check(mode in setOf("seed", "backend"))
    val process = environment.propertySources[StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME]
      as? EnumerablePropertySource<*> ?: error("M1D process environment missing.")
    check(process.propertyNames.all { it in railNames || it.uppercase() in osNames })
    check(process.propertyNames.filter { it.uppercase() in railNames }.all { it in railNames })
    check(process.getProperty("RITOMER_DB_RAIL_CAMPAIGN") == "D")
    check(process.getProperty("RITOMER_DB_TEST_PHASE") == "d-$mode")
    val system = environment.propertySources[StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME]
      as? EnumerablePropertySource<*> ?: error("M1D system properties missing.")
    check(system.propertyNames.none {
      val lower = it.lowercase()
      lower.startsWith("spring.") || lower.startsWith("server.") || lower.startsWith("ritomer") || lower.startsWith("logging.") ||
        lower.startsWith("logback.") || lower.startsWith("java.util.logging.")
    })
  }

  internal fun initializer(
    mode: String,
    guard: ApplicationContextInitializer<ConfigurableApplicationContext> =
      DisposablePostgresTestDatabaseGuardInitializer()
  ): ApplicationContextInitializer<ConfigurableApplicationContext> = ApplicationContextInitializer { context ->
    check(PostgresTestRailJdbcLogging.disableAndVerifyForTest())
    val environment = context.environment
    validateLaunchEnvironment(mode, environment)
    check(environment.activeProfiles.toList() == listOf("local"))
    fun rail(name: String): String =
      (environment.propertySources[StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME]
        ?.getProperty(name) as? String)?.takeIf(String::isNotBlank)
        ?: error("M1D required environment missing.")
    environment.propertySources.addFirst(MapPropertySource("m1d-closed-runtime", linkedMapOf<String, Any>(
      "spring.datasource.url" to rail("RITOMER_DB_TEST_JDBC_URL"),
      "spring.datasource.username" to rail("RITOMER_DB_TEST_USERNAME"),
      "spring.datasource.password" to rail("RITOMER_DB_TEST_PASSWORD"),
      "spring.datasource.hikari.data-source-properties.ApplicationName" to rail("RITOMER_DB_TEST_APPLICATION_NAME"),
      "spring.datasource.hikari.data-source-properties.logServerErrorDetail" to "false",
      "spring.datasource.hikari.data-source-properties.sslmode" to "disable",
      "spring.datasource.hikari.data-source-properties.gssEncMode" to "disable",
      "spring.datasource.hikari.maximum-pool-size" to "2",
      "spring.datasource.hikari.minimum-idle" to "0",
      "ritomer.workpapers.documents.storage.backend" to "LOCAL_FS",
      "ritomer.workpapers.documents.storage.local-root" to rail("RITOMER_DB_TEST_STORAGE_LOCAL_ROOT"),
      "spring.flyway.enabled" to "true",
      "spring.flyway.clean-disabled" to "true",
      "spring.sql.init.mode" to "never",
      "ritomer.demo.seed.enabled" to (mode == "seed").toString(),
      "ritomer.demo.seed.variant" to "043b-two-actor-pilot",
      "ritomer.security.session.enabled" to "true",
      "ritomer.security.jwt.hmac-secret" to "",
      "spring.main.banner-mode" to "off"
    )))
    // This common guard opens the first connection, before any bean or Flyway refresh effect.
    guard.initialize(context)
    if (mode == "seed") DemoSeedLocalActivation.from(environment).requireEnabled()
  }
}

internal object PostgresTestRailJdbcLogging {
  fun disableAndVerifyForTest(): Boolean {
    val manager = LogManager.getLogManager()
    val names = linkedSetOf("org.postgresql", "org.postgresql.Driver", "org.postgresql.core")
    val registeredNames = manager.loggerNames
    while (registeredNames.hasMoreElements()) {
      val name = registeredNames.nextElement()
      if (name == "org.postgresql" || name.startsWith("org.postgresql.")) {
        names += name
      }
    }

    names.forEach { name ->
      Logger.getLogger(name).apply {
        level = Level.OFF
        useParentHandlers = false
        handlers.forEach(::removeHandler)
      }
    }

    return names.all { name ->
      Logger.getLogger(name).let { logger ->
        logger.level == Level.OFF &&
          !logger.useParentHandlers &&
          logger.handlers.isEmpty() &&
          !logger.isLoggable(Level.FINEST)
      }
    }
  }
}
