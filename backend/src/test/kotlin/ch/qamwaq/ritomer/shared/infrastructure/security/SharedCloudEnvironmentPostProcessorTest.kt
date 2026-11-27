package ch.qamwaq.ritomer.shared.infrastructure.security

import java.nio.file.Files
import java.nio.file.Path
import java.net.InetAddress
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import jakarta.servlet.http.HttpServlet
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import java.util.concurrent.atomic.AtomicBoolean
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import org.springframework.boot.SpringApplication
import org.springframework.boot.WebApplicationType
import org.springframework.boot.context.event.ApplicationEnvironmentPreparedEvent
import org.springframework.boot.convert.ApplicationConversionService
import org.springframework.boot.context.properties.bind.Binder
import org.springframework.boot.autoconfigure.web.ServerProperties
import org.springframework.boot.autoconfigure.web.servlet.TomcatServletWebServerFactoryCustomizer
import org.springframework.boot.env.YamlPropertySourceLoader
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory
import org.springframework.boot.web.servlet.ServletContextInitializer
import org.springframework.core.io.ClassPathResource
import org.springframework.context.ApplicationListener
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.Ordered
import org.springframework.core.env.MapPropertySource
import org.springframework.mock.env.MockEnvironment

class SharedCloudEnvironmentPostProcessorTest {
  @TempDir lateinit var directory: Path

  private fun properties(): MutableMap<String, Any> {
    val ca = directory.resolve("synthetic-ca.pem")
    Files.writeString(ca, "OFFLINE_FIXTURE_NOT_A_CERTIFICATE")
    return mutableMapOf(
      "K_SERVICE" to "ritomer-m12", "K_REVISION" to "ritomer-m12-00001-abc", "PORT" to "8080",
      "ritomer.security.shared.proxy-mode" to "CLOUD_RUN",
      "ritomer.security.shared.expected-cloud-run-service" to "ritomer-m12",
      "ritomer.security.shared.canonical-origin" to "https://app.example.test",
      "ritomer.security.shared.client-id" to "synthetic-client",
      "ritomer.security.shared.client-secret" to "synthetic-private-value",
      "ritomer.security.shared.expected-db-host" to "synthetic.europe-west6.sql.goog",
      "ritomer.security.session.enabled" to "true", "ritomer.security.jwt.hmac-secret" to "",
      "ritomer.security.session.absolute-timeout" to "8h", "server.servlet.session.timeout" to "30m",
      "server.servlet.session.tracking-modes" to "cookie",
      "server.servlet.session.cookie.name" to "__Host-ritomer-session",
      "server.servlet.session.cookie.secure" to "true", "server.servlet.session.cookie.http-only" to "true",
      "server.servlet.session.cookie.path" to "/", "server.servlet.session.cookie.same-site" to "lax",
      "spring.flyway.enabled" to "false", "server.forward-headers-strategy" to "none",
      "spring.sql.init.mode" to "never",
      "server.tomcat.use-relative-redirects" to "true",
      "server.address" to "0.0.0.0", "server.port" to "8080",
      "ritomer.workpapers.documents.storage.backend" to "GCS",
      "ritomer.workpapers.documents.storage.gcs.bucket" to "project-74f86561-bbba-4eb0-aa6-m12",
      "spring.datasource.url" to "jdbc:postgresql://synthetic.europe-west6.sql.goog:5432/ritomer_m12",
      "spring.datasource.username" to "ritomer_m12_runtime_login", "spring.datasource.password" to "synthetic-private-value",
      "spring.datasource.hikari.maximum-pool-size" to "5", "spring.datasource.hikari.minimum-idle" to "0",
      "spring.datasource.hikari.connection-timeout" to "10000", "spring.datasource.hikari.validation-timeout" to "5000",
      "spring.datasource.hikari.data-source-properties.sslmode" to "verify-full",
      "spring.datasource.hikari.data-source-properties.sslrootcert" to ca.toString(),
      "spring.datasource.hikari.data-source-properties.connectTimeout" to "10",
      "spring.datasource.hikari.data-source-properties.socketTimeout" to "30",
      "spring.datasource.hikari.data-source-properties.currentSchema" to "public"
    )
  }

  private fun environment(values: Map<String, Any>) = MockEnvironment().apply {
    conversionService = ApplicationConversionService()
    propertySources.addFirst(MapPropertySource("cloud-test", values))
    setActiveProfiles("shared-internal")
  }

  private fun check(values: Map<String, Any>) = SharedCloudEnvironmentPostProcessor()
    .postProcessEnvironment(environment(values), SpringApplication(SentinelConfiguration::class.java))

  @Test
  fun `closed cloud configuration passes without opening database or network`() {
    check(properties())
    check(properties().apply { put("ritomer.security.shared.qualification-enabled", "true") })
  }

  @Test
  fun `both official shared CA hostname suffixes keep the exact JDBC and TLS contract`() {
    for (suffix in listOf("sql.goog", "sql-psa.goog")) {
      val host = "synthetic.europe-west6.$suffix"
      val values = properties().apply {
        put("ritomer.security.shared.expected-db-host", host)
        put("spring.datasource.url", "jdbc:postgresql://$host:5432/ritomer_m12")
      }
      check(values)
      for ((key, value) in listOf(
        "spring.datasource.url" to "jdbc:postgresql://other.europe-west6.$suffix:5432/ritomer_m12",
        "spring.datasource.url" to "jdbc:postgresql://$host:5432/ritomer_m12?sslmode=require",
        "spring.datasource.hikari.data-source-properties.sslmode" to "require"
      )) {
        assertThatThrownBy { check(values.toMutableMap().apply { put(key, value) }) }
          .hasMessage("SHARED_CLOUD_CONFIGURATION_REJECTED").hasNoCause()
      }
    }
  }

  @Test
  fun `absolute database hostname is preserved and any JDBC terminal point mismatch is rejected`() {
    for (suffix in listOf("sql.goog", "sql-psa.goog")) {
      val name = "synthetic.europe-west6.$suffix"
      for (host in listOf(name, "$name.")) {
        val values = properties().apply {
          put("ritomer.security.shared.expected-db-host", host)
          put("spring.datasource.url", "jdbc:postgresql://$host:5432/ritomer_m12")
        }
        check(values)
        assertThat(values["ritomer.security.shared.expected-db-host"]).isEqualTo(host)
        assertThat(values["spring.datasource.url"]).isEqualTo("jdbc:postgresql://$host:5432/ritomer_m12")
        val other = if (host.endsWith('.')) name else "$name."
        assertThatThrownBy { check(values.toMutableMap().apply {
          put("spring.datasource.url", "jdbc:postgresql://$other:5432/ritomer_m12")
        }) }.hasMessage("SHARED_CLOUD_CONFIGURATION_REJECTED").hasNoCause()
        for ((key, value) in mapOf(
          "spring.datasource.hikari.data-source-properties.sslhostnameverifier" to "unsafe.Verifier",
          "spring.datasource.hikari.data-source-properties.sslfactory" to "unsafe.Factory",
          "spring.datasource.hikari.data-source-properties.sslmode" to "verify-ca"
        )) assertThatThrownBy { check(values.toMutableMap().apply { put(key, value) }) }
          .hasMessage("SHARED_CLOUD_CONFIGURATION_REJECTED").hasNoCause()
      }
    }
  }

  @Test
  fun `absolute service hostname rejects empty labels invalid lengths and injected components`() {
    for (host in listOf("", ".synthetic.sql-psa.goog.", "a..b.sql-psa.goog.", "synthetic.sql.goog..",
      "synthetic.sql-psa.goog..", "-synthetic.sql.goog.", "synthetic-.sql.goog.", "synthetic .sql.goog.",
      "${"a".repeat(64)}.sql.goog.", "${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.sql.goog.",
      "synthetic.sql-psa.goog.invalid.", "user@synthetic.sql.goog.", "synthetic.sql.goog.:5432",
      "synthetic.sql.goog./postgres", "synthetic.sql.goog.?sslmode=require", "synthetic.sql.goog.#fragment")) {
      assertThatThrownBy { check(properties().apply {
        put("ritomer.security.shared.expected-db-host", host)
        put("spring.datasource.url", "jdbc:postgresql://$host:5432/ritomer_m12")
      }) }.hasMessage("SHARED_CLOUD_CONFIGURATION_REJECTED").hasNoCause()
    }
  }

  @Test
  fun `PSA hostname support refuses lookalike domains and URL metacharacters`() {
    for (host in listOf("synthetic.europe-west6.sql-psa.goog.invalid", "synthetic.europe-west6.sql-psaXgoog",
      "synthetic.europe-west6.sql-other.goog", "127.0.0.1", "user@synthetic.europe-west6.sql-psa.goog",
      "synthetic.europe-west6.sql-psa.goog/path", "synthetic.europe-west6.sql-psa.goog?sslmode=disable")) {
      assertThatThrownBy { check(properties().apply {
        put("ritomer.security.shared.expected-db-host", host)
        put("spring.datasource.url", "jdbc:postgresql://$host:5432/ritomer_m12")
      }) }.hasMessage("SHARED_CLOUD_CONFIGURATION_REJECTED").hasNoCause()
    }
  }

  @Test
  fun `dangerous effective overrides are refused with a value-free error`() {
    val overrides = mapOf(
      "spring.flyway.enabled" to "true", "ritomer.security.shared.proxy-mode" to "NONE",
      "K_SERVICE" to "\${UNRESOLVED_SYNTHETIC_PRIVATE_VALUE}",
      "ritomer.security.shared.expected-cloud-run-service" to "other",
      "ritomer.security.shared.canonical-origin" to "https://user:synthetic-private-value@example.test",
      "ritomer.security.jwt.hmac-secret" to "synthetic-private-value",
      "RITOMER_SECURITY_JWT_HMAC_SECRET" to "synthetic-private-value",
      "spring.datasource.url" to "jdbc:postgresql://synthetic.europe-west6.sql.goog:5432/ritomer_m12?sslmode=disable",
      "spring.datasource.hikari.jdbc-url" to "jdbc:postgresql://other/postgres",
      "spring.datasource.username" to "postgres",
      "spring.datasource.hikari.data-source-class-name" to "unsafe.Factory",
      "spring.datasource.hikari.data-source-properties.sslfactory" to "unsafe.Factory",
      "spring.datasource.hikari.data-source-properties.sslmode" to "require",
      "spring.datasource.hikari.data-source-properties.sslrootcert" to "absent.pem",
      "spring.datasource.hikari.maximum-pool-size" to "6",
      "spring.datasource.hikari.minimum-idle" to "1",
      "server.port" to "8081", "server.address" to "127.0.0.1",
      "server.forward-headers-strategy" to "native", "server.servlet.session.cookie.domain" to "example.test",
      "server.servlet.session.cookie.secure" to "false", "server.servlet.session.tracking-modes" to "url",
      "server.tomcat.use-relative-redirects" to "false", "server.tomcat.useRelativeRedirects" to "false",
      "server.servlet.session.cookie.httpOnly" to "false",
      "ritomer.workpapers.documents.storage.backend" to "LOCAL_FS",
      "ritomer.workpapers.documents.storage.gcs.bucket" to "",
      "logging.level.org.postgresql" to "DEBUG", "logging.level.root" to "TRACE",
      "logging.config" to "synthetic-private-value", "logging.file.name" to "local.log",
      "logging.pattern.console" to "\${RITOMER_SHARED_OIDC_CLIENT_SECRET}",
      "logging.pattern.level" to "\${RITOMER_SHARED_OIDC_CLIENT_SECRET}",
      "CONSOLE_LOG_PATTERN" to "synthetic-private-value", "spring.sql.init.mode" to "always",
      "server.tomcat.accesslog.enabled" to "true", "debug" to "true", "trace" to "true",
      "ritomer.security.shared.qualification-enabled" to "ambiguous"
    )
    for ((key, value) in overrides) {
      assertThatThrownBy { check(properties().apply { put(key, value) }) }.describedAs(key)
        .isInstanceOf(IllegalStateException::class.java).hasMessage("SHARED_CLOUD_CONFIGURATION_REJECTED")
        .hasNoCause()
    }
    assertThatThrownBy { check(properties().apply {
      put("ritomer.security.shared.qualification-enabled", "true"); put("K_REVISION", "bad\nvalue")
    }) }.hasMessage("SHARED_CLOUD_CONFIGURATION_REJECTED")
  }

  @Test
  fun `cloud markers cannot enable a local or mixed profile`() {
    for (profiles in listOf(arrayOf("local"), arrayOf("shared-internal", "local"), emptyArray())) {
      val env = environment(properties()).apply { setActiveProfiles(*profiles) }
      assertThatThrownBy { SharedCloudEnvironmentPostProcessor().postProcessEnvironment(env, SpringApplication()) }
        .hasMessage("SHARED_CLOUD_CONFIGURATION_REJECTED")
    }
    val local = MockEnvironment().withProperty("ritomer.security.shared.proxy-mode", "NONE")
    local.setActiveProfiles("shared-internal")
    SharedCloudEnvironmentPostProcessor().postProcessEnvironment(local, SpringApplication())
  }

  @Test
  fun `native Spring bootstrap refuses before logging environment listener and all beans`() {
    SENTINEL.set(false)
    val afterPostProcessors = AtomicBoolean(false)
    val app = SpringApplication(SentinelConfiguration::class.java).apply {
      webApplicationType = WebApplicationType.NONE
      setEnvironment(environment(properties().apply { put("spring.flyway.enabled", "true") }))
      addListeners(object : ApplicationListener<ApplicationEnvironmentPreparedEvent>, Ordered {
        override fun getOrder() = Ordered.HIGHEST_PRECEDENCE + 19 // Logging listener is +20.
        override fun onApplicationEvent(event: ApplicationEnvironmentPreparedEvent) { afterPostProcessors.set(true) }
      })
      setRegisterShutdownHook(false)
    }
    assertThatThrownBy { app.run() }.hasMessage("SHARED_CLOUD_CONFIGURATION_REJECTED")
    assertThat(afterPostProcessors).isFalse()
    assertThat(SENTINEL).isFalse()
  }

  @Configuration(proxyBeanMethods = false)
  class SentinelConfiguration {
    @Bean fun databaseAndFlywaySentinel(): Any { SENTINEL.set(true); error("MUST_NOT_INITIALIZE") }
  }

  @Test
  fun `actual shared YAML keeps Tomcat redirects relative behind an HTTP proxy`() {
    val env = MockEnvironment().apply { conversionService = ApplicationConversionService() }
    YamlPropertySourceLoader().load("actual-shared", ClassPathResource("application-shared-internal.yml"))
      .forEach { env.propertySources.addLast(it) }
    val settings = Binder.get(env).bind("server", ServerProperties::class.java).get()
    val factory = TomcatServletWebServerFactory(0).apply {
      setAddress(InetAddress.getByName("127.0.0.1"))
      setBaseDirectory(Files.createDirectory(directory.resolve("tomcat")).toFile())
    }
    TomcatServletWebServerFactoryCustomizer(settings).customize(factory)
    val server = factory.getWebServer(ServletContextInitializer { context ->
      context.addServlet("redirect", object : HttpServlet() {
        override fun doGet(request: HttpServletRequest, response: HttpServletResponse) {
          check(request.scheme == "http")
          response.sendRedirect(if (request.requestURI == "/denied") "/?login=failed" else "/")
        }
      }).addMapping("/*")
    })
    try {
      server.start()
      val client = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER)
        .connectTimeout(Duration.ofSeconds(5)).build()
      for ((path, expected) in listOf("/accepted" to "/", "/denied" to "/?login=failed")) {
        val response = client.send(HttpRequest.newBuilder(URI("http://127.0.0.1:${server.port}$path"))
          .timeout(Duration.ofSeconds(5)).GET().build(), HttpResponse.BodyHandlers.discarding())
        assertThat(response.statusCode()).isEqualTo(302)
        assertThat(response.headers().firstValue("Location").orElseThrow()).isEqualTo(expected)
      }
    } finally { server.stop() }
  }

  @Test
  fun `actual Tomcat and YAML pass canonical proxy boundary before denying anonymous actor`() {
    val env = MockEnvironment().withProperty("PORT", "0").apply { conversionService = ApplicationConversionService() }
    for (name in listOf("application-shared-internal.yml", "application.yml")) {
      YamlPropertySourceLoader().load(name, ClassPathResource(name)).forEach { env.propertySources.addLast(it) }
    }
    val settings = Binder.get(env).bind("server", ServerProperties::class.java).get()
    val factory = TomcatServletWebServerFactory(0).apply {
      setAddress(InetAddress.getByName("127.0.0.1"))
      setBaseDirectory(Files.createDirectory(directory.resolve("tomcat-boundary")).toFile())
      setSession(settings.servlet.session)
    }
    TomcatServletWebServerFactoryCustomizer(settings).customize(factory)
    val boundary = SharedSessionBoundaryFilter(SharedSessionProperties(
      "https://app.example.test", "synthetic-client", "synthetic-secret", "CLOUD_RUN", "synthetic-service"
    ))
    val sessions = org.springframework.session.web.http.SessionRepositoryFilter(
      org.springframework.session.MapSessionRepository(java.util.concurrent.ConcurrentHashMap())
    )
    val security = org.springframework.security.web.FilterChainProxy(
      org.springframework.security.web.DefaultSecurityFilterChain(
        org.springframework.security.web.util.matcher.AnyRequestMatcher.INSTANCE,
        boundary,
        org.springframework.security.web.access.ExceptionTranslationFilter { _, response, _ ->
          writeSecurityError(response, 401, "AUTHENTICATION_REQUIRED")
        },
        org.springframework.security.web.access.intercept.AuthorizationFilter(
          org.springframework.security.authorization.AuthenticatedAuthorizationManager.authenticated()
        )
      )
    )
    val cookieTrackingObserved = AtomicBoolean(false)
    val server = factory.getWebServer(ServletContextInitializer { context ->
      context.addServlet("boundary", object : HttpServlet() {
        override fun doGet(request: HttpServletRequest, response: HttpServletResponse) {
          cookieTrackingObserved.set(request.servletContext.effectiveSessionTrackingModes == setOf(jakarta.servlet.SessionTrackingMode.COOKIE))
          sessions.doFilter(request, response, jakarta.servlet.FilterChain { r, s ->
            security.doFilter(r, s, jakarta.servlet.FilterChain { _, _ -> error("BUSINESS_CHAIN_MUST_NOT_RUN") })
          })
        }
      }).addMapping("/*")
    })
    try {
      server.start()
      for ((extra, expected) in listOf("X-Forwarded-Proto: https\r\n" to 401, "" to 403,
        "X-Forwarded-Proto: https\r\nForwarded: for=192.0.2.1;proto=https\r\n" to 401,
        "X-Forwarded-Proto: https\r\nForwarded: for=192.0.2.1;proto=https\r\nForwarded: for=192.0.2.1;proto=https\r\n" to 403,
        "X-Forwarded-Proto: https\r\nX-Forwarded-Host: app.example.test\r\n" to 403)) {
        java.net.Socket().use { socket ->
          socket.connect(java.net.InetSocketAddress("127.0.0.1", server.port), 5000)
          socket.soTimeout = 5000
          socket.getOutputStream().write(("GET /api/me HTTP/1.1\r\nHost: app.example.test\r\n" + extra + "Connection: close\r\n\r\n").toByteArray(Charsets.US_ASCII))
          socket.getOutputStream().flush()
          val response = socket.getInputStream().bufferedReader(Charsets.US_ASCII).readText()
          assertThat(response.substringBefore("\r\n")).contains(" $expected ")
          assertThat(response).contains(if (expected == 401) "AUTHENTICATION_REQUIRED" else "ACCESS_DENIED")
        }
      }
      assertThat(cookieTrackingObserved).isTrue()
    } finally { server.stop() }
  }

  companion object { private val SENTINEL = AtomicBoolean(false) }
}
