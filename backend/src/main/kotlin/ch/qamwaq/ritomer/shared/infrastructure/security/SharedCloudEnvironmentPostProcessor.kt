package ch.qamwaq.ritomer.shared.infrastructure.security

import java.net.URI
import java.nio.file.Files
import java.nio.file.Path
import org.springframework.boot.SpringApplication
import org.springframework.boot.context.config.ConfigDataEnvironmentPostProcessor
import org.springframework.boot.context.properties.bind.Bindable
import org.springframework.boot.context.properties.bind.Binder
import org.springframework.boot.env.EnvironmentPostProcessor
import org.springframework.core.Ordered
import org.springframework.core.env.ConfigurableEnvironment

/** Runs after configuration data, before logging initialization and any application bean. */
class SharedCloudEnvironmentPostProcessor : EnvironmentPostProcessor, Ordered {
  override fun getOrder() = ConfigDataEnvironmentPostProcessor.ORDER + 1

  override fun postProcessEnvironment(environment: ConfigurableEnvironment, application: SpringApplication) {
    // Do not retain causes or resolved configuration values in startup errors.
    try {
      val cloudService = environment.getProperty("K_SERVICE")
      val cloudMode = environment.getProperty("ritomer.security.shared.proxy-mode") == "CLOUD_RUN"
      if (cloudService == null && !cloudMode) return // The separately guarded local rail remains independent.
      validate(environment, cloudService)
    } catch (_: Exception) {
      throw IllegalStateException("SHARED_CLOUD_CONFIGURATION_REJECTED")
    }
  }

  private fun validate(env: ConfigurableEnvironment, service: String?) {
    fun value(key: String) = env.getProperty(key)
    fun exact(key: String, expected: String) { require(value(key) == expected) }
    fun absent(key: String) { require(value(key).isNullOrEmpty()) }
    require(env.activeProfiles.toSet() == setOf("shared-internal"))
    require(service != null && service.matches(Regex("[a-z][a-z0-9-]{0,62}")))
    exact("ritomer.security.shared.proxy-mode", "CLOUD_RUN")
    exact("ritomer.security.shared.expected-cloud-run-service", service)
    SharedSessionProperties(
      canonicalOrigin = value("ritomer.security.shared.canonical-origin") ?: "",
      clientId = value("ritomer.security.shared.client-id") ?: "",
      clientSecret = value("ritomer.security.shared.client-secret") ?: "",
      proxyMode = "CLOUD_RUN", expectedCloudRunService = service
    ).validate(env.activeProfiles.toSet(), service)
    exact("ritomer.security.session.enabled", "true")
    validateEnabledSessionContract(env)
    absent("ritomer.security.jwt.hmac-secret")
    absent("RITOMER_SECURITY_JWT_HMAC_SECRET")
    exact("spring.flyway.enabled", "false")
    exact("spring.sql.init.mode", "never")
    exact("server.forward-headers-strategy", "none")
    exact("server.tomcat.use-relative-redirects", "true")
    // Reject alternate relaxed-binding spellings as well as extra server override channels.
    val server = Binder.get(env).bind("server", Bindable.mapOf(String::class.java, String::class.java)).orElse(emptyMap())
    require(server.keys.all { it in ALLOWED_SERVER_KEYS })
    absent("server.servlet.session.cookie.domain")
    exact("server.address", "0.0.0.0")
    val port = value("PORT")?.toIntOrNull()
    require(port != null && port in 1024..65535)
    exact("server.port", port.toString())
    exact("ritomer.workpapers.documents.storage.backend", "GCS")
    exact("ritomer.workpapers.documents.storage.gcs.bucket", "project-74f86561-bbba-4eb0-aa6-m12")
    exact("spring.datasource.username", "ritomer_m12_runtime_login")
    require(!value("spring.datasource.password").isNullOrBlank())
    val host = value("ritomer.security.shared.expected-db-host") ?: ""
    require(host.length <= (if (host.endsWith('.')) 254 else 253))
    require(host.matches(Regex("(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+sql(?:-psa)?\\.goog\\.?")))
    val url = value("spring.datasource.url") ?: ""
    val uri = URI(url.removePrefix("jdbc:"))
    require(url == "jdbc:postgresql://$host:5432/ritomer_m12")
    require(uri.host == host && uri.userInfo == null && uri.rawQuery == null && uri.rawFragment == null)
    val datasource = Binder.get(env).bind("spring.datasource", Bindable.mapOf(String::class.java, String::class.java))
      .orElse(emptyMap())
    require(datasource.keys.all { it in ALLOWED_DATASOURCE_KEYS })
    exact("spring.datasource.hikari.maximum-pool-size", "5")
    exact("spring.datasource.hikari.minimum-idle", "0")
    exact("spring.datasource.hikari.connection-timeout", "10000")
    exact("spring.datasource.hikari.validation-timeout", "5000")
    exact("spring.datasource.hikari.data-source-properties.sslmode", "verify-full")
    exact("spring.datasource.hikari.data-source-properties.connectTimeout", "10")
    exact("spring.datasource.hikari.data-source-properties.socketTimeout", "30")
    exact("spring.datasource.hikari.data-source-properties.currentSchema", "public")
    val ca = Path.of(value("spring.datasource.hikari.data-source-properties.sslrootcert") ?: "")
    require(ca.isAbsolute && Files.isRegularFile(ca) && Files.isReadable(ca))
    // No alternate logging file/config or HTTP access logger may bypass this closed deployment policy.
    listOf("logging.config", "logging.file.name", "logging.file.path").forEach(::absent)
    listOf("CONSOLE_LOG_PATTERN", "FILE_LOG_PATTERN", "LOG_LEVEL_PATTERN", "LOG_EXCEPTION_CONVERSION_WORD",
      "LOG_FILE", "LOG_PATH", "logback.configurationFile", "java.util.logging.config.file", "java.util.logging.config.class")
      .forEach(::absent)
    val logging = Binder.get(env).bind("logging", Bindable.mapOf(String::class.java, String::class.java)).orElse(emptyMap())
    require(logging.keys.all { it.startsWith("level.") || it == "pattern.level" })
    require(logging["pattern.level"] == null || logging["pattern.level"] == "%5p [tenant:%X{tenant_id:-na}]")
    listOf("debug", "trace", "spring.mvc.log-request-details", "spring.codec.log-request-details",
      "server.tomcat.accesslog.enabled", "server.jetty.accesslog.enabled", "server.undertow.accesslog.enabled")
      .forEach { require(value(it).isNullOrEmpty() || value(it) == "false") }
    val levels = Binder.get(env).bind("logging.level", Bindable.mapOf(String::class.java, String::class.java))
      .orElse(emptyMap())
    require(levels.values.all { it.uppercase() in setOf("OFF", "ERROR", "WARN", "INFO") })
    val enabled = value("ritomer.security.shared.qualification-enabled") ?: "false"
    require(enabled in setOf("true", "false"))
    if (enabled == "true") require(SharedQualificationFilter.validRevision(value("K_REVISION")))
  }

  companion object {
    private val ALLOWED_SERVER_KEYS = setOf(
      "address", "port", "shutdown", "forward-headers-strategy", "tomcat.use-relative-redirects",
      "servlet.session.timeout", "servlet.session.tracking-modes", "servlet.session.cookie.name",
      "servlet.session.cookie.secure", "servlet.session.cookie.http-only", "servlet.session.cookie.path",
      "servlet.session.cookie.same-site", "servlet.session.cookie.domain"
    )
    private val ALLOWED_DATASOURCE_KEYS = setOf(
      "url", "username", "password", "hikari.maximum-pool-size", "hikari.minimum-idle",
      "hikari.connection-timeout", "hikari.validation-timeout", "hikari.data-source-properties.sslmode",
      "hikari.data-source-properties.sslrootcert", "hikari.data-source-properties.connectTimeout",
      "hikari.data-source-properties.socketTimeout", "hikari.data-source-properties.currentSchema"
    )
  }
}
