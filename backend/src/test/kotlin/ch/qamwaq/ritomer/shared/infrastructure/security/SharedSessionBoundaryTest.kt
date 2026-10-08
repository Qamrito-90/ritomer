package ch.qamwaq.ritomer.shared.infrastructure.security

import jakarta.servlet.SessionTrackingMode
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import org.springframework.mock.env.MockEnvironment
import org.springframework.mock.web.MockFilterChain
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.mock.web.MockServletContext

class SharedSessionBoundaryTest {
  private val origin = "https://app.example.test"
  private val properties = SharedSessionProperties(origin, "synthetic-client", "synthetic-secret")
  private fun request(path: String = OIDC_CALLBACK_PATH) = MockHttpServletRequest(
    MockServletContext().apply { setSessionTrackingModes(setOf(SessionTrackingMode.COOKIE)) }, "GET", path
  ).apply { isSecure = true; scheme = "https"; addHeader("Host", "app.example.test") }
  private fun status(request: MockHttpServletRequest, config: SharedSessionProperties = properties): Int {
    val response = MockHttpServletResponse()
    SharedSessionBoundaryFilter(config).doFilter(request, response, MockFilterChain())
    assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store")
    return response.status
  }

  @Test
  fun `legitimate callback without Origin is allowed but forged origins are rejected`() {
    assertThat(status(request())).isEqualTo(200)
    assertThat(status(request().apply { addHeader("Origin", origin) })).isEqualTo(200)
    assertThat(status(request().apply { addHeader("Origin", "https://evil.example.test") })).isEqualTo(403)
    assertThat(status(request().apply { addHeader("Origin", origin); addHeader("Origin", origin) })).isEqualTo(403)
    assertThat(status(request().apply { removeHeader("Host"); addHeader("Host", "evil.example.test") })).isEqualTo(403)
    assertThat(status(request().apply { isSecure = false; scheme = "http" })).isEqualTo(403)
    assertThat(status(request("/api/session/logout").apply { method = "POST" })).isEqualTo(403)
    assertThat(status(request("/api/session/logout").apply { method = "POST"; addHeader("Origin", origin) })).isEqualTo(200)
  }

  @ParameterizedTest
  @ValueSource(strings = ["Forwarded", "X-Forwarded-Host", "X-Forwarded-Proto", "X-Forwarded-Port", "X-Forwarded-For", "X-Forwarded-Prefix"])
  fun `direct HTTPS never trusts proxy headers`(header: String) {
    assertThat(status(request().apply { addHeader(header, "forged") })).isEqualTo(403)
  }

  @Test
  fun `Cloud Run mode checks topology and only normalizes a canonical HTTPS request`() {
    val cloud = properties.copy(proxyMode = "CLOUD_RUN", expectedCloudRunService = "synthetic-service")
    assertThatThrownBy { cloud.validate(setOf("shared-internal"), null) }.isInstanceOf(IllegalArgumentException::class.java)
    cloud.validate(setOf("shared-internal"), "synthetic-service")
    assertThat(status(request().apply { isSecure = false; addHeader("X-Forwarded-Proto", "https") }, cloud)).isEqualTo(200)
    assertThat(status(request(), cloud)).isEqualTo(403)
    assertThat(status(request().apply { addHeader("X-Forwarded-Proto", "https,http") }, cloud)).isEqualTo(403)
    assertThat(status(request().apply { addHeader("X-Forwarded-Proto", "https"); addHeader("X-Forwarded-Host", "app.example.test") }, cloud)).isEqualTo(403)
    assertThat(status(request().apply { addHeader("X-Forwarded-Proto", "https"); addHeader("X-Forwarded-Unknown", "x") }, cloud)).isEqualTo(403)
  }

  @Test
  fun `OIDC and local entrypoints reject cross boundary credentials and methods`() {
    for (path in listOf(OIDC_START_PATH, OIDC_CALLBACK_PATH)) {
      assertThat(status(request(path).apply { addHeader("Authorization", "Bearer synthetic") })).isEqualTo(400)
      assertThat(status(request(path).apply { addHeader("X-Tenant-Id", "11111111-1111-4111-8111-111111111111") })).isEqualTo(400)
      assertThat(status(request(path).apply { method = "POST"; addHeader("Origin", origin) })).isEqualTo(405)
    }
    assertThat(status(request(SESSION_LOCAL_LOGIN_PATH).apply { method = "POST"; addHeader("Origin", origin) })).isEqualTo(404)
  }

  @Test
  fun `startup refuses mixed profiles absent secrets bad origin cookie domain and legacy credentials`() {
    properties.validate(setOf("shared-internal"), null)
    for (profiles in listOf(emptySet(), setOf("shared-internal", "local"), setOf("shared-internal", "test"), setOf("shared-internal", "dbtest"))) {
      assertThatThrownBy { properties.validate(profiles, null) }.isInstanceOf(IllegalArgumentException::class.java)
    }
    for (bad in listOf("", "http://app.example.test", "$origin/", "$origin?x=y", "https://user@app.example.test", "https://app.example.test:444")) {
      assertThatThrownBy { properties.copy(canonicalOrigin = bad).validate(setOf("shared-internal"), null) }.isInstanceOf(IllegalArgumentException::class.java)
    }
    assertThatThrownBy { properties.copy(clientSecret = "").validate(setOf("shared-internal"), null) }.isInstanceOf(IllegalArgumentException::class.java)
    assertThat(properties.toString()).doesNotContain("synthetic-secret", "synthetic-client")
    val environment = MockEnvironment().withProperty("ritomer.security.session.enabled", "true")
      .withProperty("server.forward-headers-strategy", "none")
    environment.setActiveProfiles("shared-internal")
    val config = SharedSessionSecurityConfiguration()
    config.validatedSharedProperties(properties, environment)
    environment.setProperty("ritomer.security.jwt.hmac-secret", "synthetic-override")
    assertThatThrownBy { config.validatedSharedProperties(properties, environment) }.isInstanceOf(IllegalArgumentException::class.java)
    environment.setProperty("ritomer.security.jwt.hmac-secret", "")
    environment.setProperty("server.servlet.session.cookie.domain", "example.test")
    assertThatThrownBy { config.validatedSharedProperties(properties, environment) }.isInstanceOf(IllegalArgumentException::class.java)
  }

  @Test
  fun `return destinations are restricted to existing canonical shell routes`() {
    val folder = "/closing-folders/11111111-1111-4111-8111-111111111111"
    assertThat(safeSharedReturnPath(folder)).isEqualTo(folder)
    for (path in listOf(null, "https://evil.example.test", "//evil.example.test", "$folder?x=y", "$folder#token", "/api/me", "/%2fexample.test", "$folder\n")) {
      assertThat(safeSharedReturnPath(path)).isEqualTo("/")
    }
  }
}
