package ch.qamwaq.ritomer.devtools

import org.springframework.core.env.Environment

internal const val DEMO_SEED_ENABLED_PROPERTY = "ritomer.demo.seed.enabled"

internal data class DemoSeedLocalActivation(
  val activeProfiles: Set<String>,
  val enabledPropertyValue: String?,
  val datasourceUrl: String?,
  val blockedRuntimeMarkers: Set<String>
) {
  val enabled: Boolean = enabledPropertyValue?.trim()?.equals("true", ignoreCase = true) == true

  fun requireEnabled() {
    if (blockedRuntimeMarkers.isNotEmpty()) {
      throw IllegalStateException(
        "Demo seed is blocked when Cloud Run or production-like runtime markers are present: ${blockedRuntimeMarkers.sorted()}."
      )
    }
    if (activeProfiles.none { it in ALLOWED_PROFILES }) {
      throw IllegalStateException(
        "Demo seed can only run with local, test or dbtest profiles. Active profiles: ${activeProfiles.ifEmpty { setOf("none") }}."
      )
    }

    val forbiddenProfiles = activeProfiles - ALLOWED_PROFILES
    if (forbiddenProfiles.isNotEmpty()) {
      throw IllegalStateException(
        "Demo seed rejects unsupported active profiles: $forbiddenProfiles. Allowed profiles: $ALLOWED_PROFILES."
      )
    }
    if (enabledPropertyValue == null) {
      throw IllegalStateException("Demo seed is disabled by default. Set $DEMO_SEED_ENABLED_PROPERTY=true explicitly.")
    }
    if (!enabled) {
      throw IllegalStateException("$DEMO_SEED_ENABLED_PROPERTY must be explicitly set to true.")
    }
    if (!isAllowedLocalPostgreSqlDatasource(datasourceUrl)) {
      throw IllegalStateException(
        "Demo seed datasource must be a local PostgreSQL target on localhost, 127.0.0.1 or [::1]."
      )
    }
  }

  companion object {
    private val ALLOWED_PROFILES = setOf("local", "test", "dbtest")
    private val CLOUD_RUNTIME_MARKERS = setOf(
      "K_SERVICE",
      "K_REVISION",
      "K_CONFIGURATION",
      "CLOUD_RUN_JOB",
      "CLOUD_RUN_EXECUTION",
      "CLOUD_RUN_TASK_INDEX",
      "CLOUD_RUN_TASK_ATTEMPT",
      "GAE_ENV",
      "KUBERNETES_SERVICE_HOST"
    )
    private val ENVIRONMENT_MARKERS = setOf(
      "RITOMER_ENV",
      "RITOMER_ENVIRONMENT",
      "APP_ENV",
      "ENVIRONMENT",
      "ENV"
    )
    private val PRODUCTION_VALUES = setOf("prod", "production", "prd")
    private val BLOCKED_DATASOURCE_FRAGMENTS = listOf(
      "cloudsql",
      "cloud-sql",
      "google",
      "europe-west"
    )
    private val PROD_LIKE_DATASOURCE_PATTERN = Regex("""(^|[^a-z0-9])(prod|production|prd)([^a-z0-9]|$)""")

    fun from(environment: Environment): DemoSeedLocalActivation =
      environment.activeProfiles.map { it.trim() }.filter { it.isNotEmpty() }.toSet().let { profiles ->
        DemoSeedLocalActivation(
          activeProfiles = profiles,
          enabledPropertyValue = environment.getProperty(DEMO_SEED_ENABLED_PROPERTY),
          datasourceUrl = datasourceUrlFrom(environment),
          blockedRuntimeMarkers = blockedRuntimeMarkersFrom(environment)
        )
      }

    private fun blockedRuntimeMarkersFrom(environment: Environment): Set<String> {
      val cloudMarkers = CLOUD_RUNTIME_MARKERS
        .filter { marker -> !environment.getProperty(marker).isNullOrBlank() }
      val productionMarkers = ENVIRONMENT_MARKERS
        .filter { marker -> environment.getProperty(marker)?.trim()?.lowercase() in PRODUCTION_VALUES }

      return (cloudMarkers + productionMarkers).toSet()
    }

    private fun datasourceUrlFrom(environment: Environment): String? =
      sequenceOf(
        environment.getProperty("spring.datasource.url"),
        environment.getProperty("SPRING_DATASOURCE_URL"),
        environment.getProperty("RITOMER_DB_TEST_JDBC_URL")
      )
        .filterNotNull()
        .map { it.trim() }
        .firstOrNull { it.isNotEmpty() }

    private fun isAllowedLocalPostgreSqlDatasource(datasourceUrl: String?): Boolean {
      val url = datasourceUrl?.trim() ?: return false
      val lowerUrl = url.lowercase()
      if (BLOCKED_DATASOURCE_FRAGMENTS.any { lowerUrl.contains(it) }) {
        return false
      }
      if (PROD_LIKE_DATASOURCE_PATTERN.containsMatchIn(lowerUrl)) {
        return false
      }

      val prefix = "jdbc:postgresql://"
      if (!lowerUrl.startsWith(prefix)) {
        return false
      }

      val authority = url
        .substring(prefix.length)
        .substringBefore("/")
        .substringBefore("?")
        .trim()
      if (authority.isEmpty() || "@" in authority) {
        return false
      }

      return authority.split(",")
        .map { endpoint -> localHostFrom(endpoint) }
        .all { host -> host in setOf("localhost", "127.0.0.1", "::1") }
    }

    private fun localHostFrom(endpoint: String): String {
      val trimmed = endpoint.trim()
      if (trimmed.startsWith("[")) {
        return trimmed.substringAfter("[").substringBefore("]").lowercase()
      }

      return trimmed.substringBefore(":").lowercase()
    }
  }
}
