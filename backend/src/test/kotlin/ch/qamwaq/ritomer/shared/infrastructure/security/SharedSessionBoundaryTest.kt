package ch.qamwaq.ritomer.shared.infrastructure.security

import jakarta.servlet.SessionTrackingMode
import jakarta.servlet.FilterChain
import jakarta.servlet.DispatcherType
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import org.springframework.session.MapSessionRepository
import org.springframework.session.web.http.SessionRepositoryFilter
import org.springframework.session.web.http.CookieHttpSessionIdResolver
import org.springframework.security.web.context.HttpSessionSecurityContextRepository
import org.springframework.security.web.context.SecurityContextHolderFilter
import org.springframework.security.web.FilterChainProxy
import org.springframework.security.web.DefaultSecurityFilterChain
import org.springframework.security.web.access.ExceptionTranslationFilter
import org.springframework.security.web.access.intercept.AuthorizationFilter
import org.springframework.security.authorization.AuthenticatedAuthorizationManager
import org.springframework.security.web.util.matcher.AnyRequestMatcher
import org.springframework.security.core.context.SecurityContextHolder
import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import ch.qamwaq.ritomer.shared.application.AuthenticationMechanism
import ch.qamwaq.ritomer.shared.application.ActorAuthorityFreshness
import ch.qamwaq.ritomer.shared.application.ActorAuthorityFreshnessVerifier
import jakarta.servlet.http.Cookie
import java.time.Instant
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
  fun `Cloud Run accepts only a closed opaque forwarded pair without granting authority`() {
    val cloud = properties.copy(proxyMode = "CLOUD_RUN", expectedCloudRunService = "synthetic-service")
    for (value in listOf("for=192.0.2.1;proto=https", "proto=https; for=_opaque", "for=\"[2001:db8::1]:443\";proto=https")) {
      val req = request().apply { isSecure = false; scheme = "http"; addHeader("X-Forwarded-Proto", "https"); addHeader("Forwarded", value) }
      val response = MockHttpServletResponse()
      var reached = false
      SharedSessionBoundaryFilter(cloud).doFilter(req, response, FilterChain { actual, _ ->
        val wrapped = actual as jakarta.servlet.http.HttpServletRequest
        reached = true
        assertThat(wrapped.scheme).isEqualTo("https")
        assertThat(wrapped.isSecure).isTrue()
        assertThat(wrapped.serverName).isEqualTo("app.example.test")
        assertThat(wrapped.serverPort).isEqualTo(443)
        assertThat(wrapped.requestURL.toString()).isEqualTo(origin + OIDC_CALLBACK_PATH)
        assertThat(wrapped.userPrincipal).isNull()
        assertThat(wrapped.getSession(false)).isNull()
      })
      assertThat(reached).isTrue()
      assertThat(response.status).isEqualTo(200)
      assertThat(status(request().apply { addHeader("Forwarded", value) })).isEqualTo(403)
      val invalid = listOf<(MockHttpServletRequest) -> Unit>(
        { it.removeHeader("Host"); it.addHeader("Host", "evil.invalid") },
        { it.removeHeader("X-Forwarded-Proto") },
        { it.addHeader("X-Forwarded-Proto", "https") },
        { it.removeHeader("X-Forwarded-Proto"); it.addHeader("X-Forwarded-Proto", "http") },
        { it.addHeader("Origin", "https://evil.invalid") },
        { it.method = "POST" },
        { it.servletContext.setSessionTrackingModes(setOf(SessionTrackingMode.COOKIE, SessionTrackingMode.URL)) }
      )
      for (mutate in invalid) {
        val denied = request().apply { addHeader("X-Forwarded-Proto", "https"); addHeader("Forwarded", value) }
        mutate(denied)
        assertThat(status(denied, cloud)).isEqualTo(403)
      }
    }
  }

  @Test
  fun `Cloud Run rejects forwarded ambiguity contradictions and malformed opaque values`() {
    val cloud = properties.copy(proxyMode = "CLOUD_RUN", expectedCloudRunService = "synthetic-service")
    val rejected = listOf(
      listOf("for=192.0.2.1;proto=https", "for=192.0.2.1;proto=https"),
      listOf("for=192.0.2.1;proto=https,for=192.0.2.2;proto=https"),
      listOf("for=a;For=b;proto=https"), listOf("for=a;proto=https;PROTO=https"),
      listOf("for=a;proto=http"), listOf("for=a;proto=\"https\""), listOf("proto=https"),
      listOf("for=;proto=https"), listOf("for=a=b;proto=https"), listOf("for=\"a;proto=https"),
      listOf("for=\"a\"b\";proto=https"), listOf("for=a\\b;proto=https"),
      listOf("for=a\u0000b;proto=https"), listOf("for=a\r\nb;proto=https"), listOf("for=é;proto=https"),
      listOf("for=a;proto=https;"), listOf("for=a;proto=https;by=b"),
      listOf("for=a;proto=https;host=app.example.test"), listOf("for=a;proto=https;host=evil.invalid"),
      listOf("for=" + "a".repeat(257) + ";proto=https"), listOf("x".repeat(2049))
    )
    for (values in rejected) {
      val req = request().apply { addHeader("X-Forwarded-Proto", "https"); values.forEach { addHeader("Forwarded", it) } }
      assertThat(status(req, cloud)).describedAs("closed forwarded grammar").isEqualTo(403)
    }
  }

  @Test
  fun `anonymous qualification reports only the first closed boundary reason without relaxing guards`() {
    val lines = mutableListOf<String>()
    val cloud = properties.copy(proxyMode = "CLOUD_RUN", expectedCloudRunService = "synthetic-service", qualificationEnabled = true)
    val challenge = "33333333-3333-4333-8333-333333333333"
    fun qualified() = request("/api/me").apply {
      isSecure = false; addHeader("X-Forwarded-Proto", "https")
      addHeader(SharedQualificationFilter.HEADER, challenge)
    }
    val cases = listOf(
      qualified().apply { removeHeader("Host"); addHeader("Host", "synthetic-private.invalid"); addHeader("Forwarded", "private") } to "HOST",
      qualified().apply { addHeader("Forwarded", "synthetic-private") } to "FORWARDED_FORBIDDEN",
      qualified().apply { addHeader("X-Forwarded-Host", "synthetic-private") } to "FORWARDED_FORBIDDEN",
      qualified().apply { removeHeader("X-Forwarded-Proto") } to "PROTO",
      qualified().apply { addHeader("X-Forwarded-Proto", "https") } to "PROTO",
      qualified().apply { addHeader("X-Forwarded-Unknown", "synthetic-private") } to "FORWARDED_UNKNOWN",
      qualified().apply { addHeader("Origin", "https://synthetic-private.invalid") } to "ORIGIN",
      qualified().apply { servletContext.setSessionTrackingModes(setOf(SessionTrackingMode.COOKIE, SessionTrackingMode.URL)) } to "TRACKING"
    )
    for ((req, reason) in cases) {
      val response = MockHttpServletResponse()
      SharedSessionBoundaryFilter(cloud, lines::add).doFilter(req, response, FilterChain { _, _ -> error("DENIED_CHAIN_MUST_NOT_RUN") })
      assertThat(response.status).isEqualTo(403)
      val row = lines.map { com.fasterxml.jackson.databind.ObjectMapper().readTree(it) }.last { it["diagnostic"].asText() == "M12_BOUNDARY_01" }
      assertThat(row.fieldNames().asSequence().toSet()).containsExactlyInAnyOrder("diagnostic", "challenge", "reason")
      assertThat(row["diagnostic"].asText()).isEqualTo("M12_BOUNDARY_01")
      assertThat(row["challenge"].asText()).isEqualTo(challenge)
      assertThat(row["reason"].asText()).isEqualTo(reason)
      assertThat(lines.last()).doesNotContain("synthetic-private", "/api/me")
    }
    assertThat(lines.count { it.contains("\"M12_BOUNDARY_01\"") }).isEqualTo(cases.size)
    assertThat(lines.count { it.contains("\"M12_FORWARDED_01\"") }).isEqualTo(2)
    lines.clear()
    val unqualified = listOf(
      qualified().apply { addHeader("Cookie", "private-cookie") },
      qualified().apply { addHeader("Authorization", "private-token") },
      qualified().apply { queryString = "private-query" },
      qualified().apply { requestURI = OIDC_CALLBACK_PATH },
      qualified().apply { method = "POST" },
      qualified().apply { dispatcherType = DispatcherType.ERROR },
      qualified().apply { addHeader(SharedQualificationFilter.HEADER, challenge) },
      qualified().apply { removeHeader(SharedQualificationFilter.HEADER); addHeader(SharedQualificationFilter.HEADER, "private-invalid") }
    )
    for (req in unqualified) {
      req.removeHeader("Host"); req.addHeader("Host", "synthetic-private.invalid")
      SharedSessionBoundaryFilter(cloud, lines::add).doFilter(req, MockHttpServletResponse(), MockFilterChain())
    }
    SharedSessionBoundaryFilter(cloud.copy(qualificationEnabled = false), lines::add).doFilter(cases.first().first, MockHttpServletResponse(), MockFilterChain())
    SharedSessionBoundaryFilter(cloud, lines::add).doFilter(qualified(), MockHttpServletResponse(), MockFilterChain())
    assertThat(lines).isEmpty()
  }

  @Test
  fun `forwarded diagnostic observes all combinations with closed shapes and no header values`() {
    val cloud = properties.copy(proxyMode = "CLOUD_RUN", expectedCloudRunService = "synthetic-service", qualificationEnabled = true)
    val headers = listOf("Forwarded" to "for=synthetic-private;proto=https", "X-Forwarded-Host" to "app.example.test", "X-Forwarded-Port" to "443", "X-Forwarded-Prefix" to "")
    for (mask in 1..15) {
      val lines = mutableListOf<String>()
      val req = request("/api/me").apply {
        addHeader("X-Forwarded-Proto", "https")
        addHeader(SharedQualificationFilter.HEADER, "33333333-3333-4333-8333-333333333333")
        headers.forEachIndexed { index, (name, value) -> if (mask and (1 shl index) != 0) addHeader(name, value) }
      }
      val response = MockHttpServletResponse()
      var reached = false
      SharedSessionBoundaryFilter(cloud, lines::add).doFilter(req, response, FilterChain { _, _ -> reached = true })
      if (mask == 1) {
        assertThat(reached).isTrue()
        assertThat(response.status).isEqualTo(200)
        assertThat(lines).isEmpty()
        continue
      }
      assertThat(reached).isFalse()
      assertThat(response.status).isEqualTo(403)
      assertThat(lines).hasSize(2)
      val row = com.fasterxml.jackson.databind.ObjectMapper().readTree(lines.last())
      assertThat(row.fieldNames().asSequence().toSet()).containsExactlyInAnyOrder("diagnostic", "challenge", "mask", "forwardedCount", "forwardedShape", "hostShape", "portShape", "prefixShape")
      assertThat(row["diagnostic"].asText()).isEqualTo("M12_FORWARDED_01")
      assertThat(row["mask"].asInt()).isEqualTo(mask)
      assertThat(row["forwardedCount"].asInt()).isEqualTo(if (mask and 1 != 0) 1 else 0)
      assertThat(row["forwardedShape"].asText()).isEqualTo(if (mask and 1 != 0) "KEYS_FOR_PROTO_HTTPS" else "ABSENT")
      assertThat(row["hostShape"].asText()).isEqualTo(if (mask and 2 != 0) "CANONICAL_SINGLE" else "ABSENT")
      assertThat(row["portShape"].asText()).isEqualTo(if (mask and 4 != 0) "HTTPS_SINGLE" else "ABSENT")
      assertThat(row["prefixShape"].asText()).isEqualTo(if (mask and 8 != 0) "EMPTY_SINGLE" else "ABSENT")
      assertThat(lines.joinToString()).doesNotContain("synthetic-private", "app.example.test", "proto=https")
    }
  }

  @Test
  fun `forwarded diagnostic classifies ambiguity without authorizing or exposing it`() {
    val cloud = properties.copy(proxyMode = "CLOUD_RUN", expectedCloudRunService = "synthetic-service", qualificationEnabled = true)
    val cases = listOf(
      listOf("for=private;proto=https;host=app.example.test") to "KEYS_FOR_PROTO_HTTPS_HOST_CANONICAL",
      listOf("for=private;proto=https;host=\"app.example.test\"") to "KEYS_FOR_PROTO_HTTPS_HOST_CANONICAL",
      listOf("for=private;proto=https;host=evil.invalid") to "OTHER",
      listOf("for=private;proto=https;proto=https") to "OTHER",
      listOf("for=private;proto=http") to "OTHER",
      listOf("for=private;proto=https,for=other;proto=https") to "OTHER",
      listOf("for=private;proto=https;by=private") to "OTHER",
      listOf("for=private;proto=https\\") to "OTHER",
      listOf("for=private;proto=https\r\n") to "OTHER",
      listOf("x".repeat(2049)) to "OTHER",
      listOf("for=private;proto=https", "for=other;proto=https") to "MULTIPLE"
    )
    for ((values, shape) in cases) {
      val lines = mutableListOf<String>()
      val req = request("/api/me").apply {
        addHeader("X-Forwarded-Proto", "https")
        addHeader(SharedQualificationFilter.HEADER, "33333333-3333-4333-8333-333333333333")
        values.forEach { addHeader("Forwarded", it) }
        addHeader("X-Forwarded-Host", "private"); addHeader("X-Forwarded-Host", "app.example.test")
        addHeader("X-Forwarded-Port", "private"); addHeader("X-Forwarded-Prefix", "private")
      }
      val response = MockHttpServletResponse()
      SharedSessionBoundaryFilter(cloud, lines::add).doFilter(req, response, FilterChain { _, _ -> error("DENIED_CHAIN_MUST_NOT_RUN") })
      assertThat(response.status).isEqualTo(403)
      val row = com.fasterxml.jackson.databind.ObjectMapper().readTree(lines.last())
      assertThat(row["forwardedShape"].asText()).isEqualTo(shape)
      assertThat(row["forwardedCount"].asInt()).isEqualTo(values.size)
      assertThat(row["hostShape"].asText()).isEqualTo("OTHER")
      assertThat(row["portShape"].asText()).isEqualTo("OTHER")
      assertThat(row["prefixShape"].asText()).isEqualTo("OTHER")
      assertThat(lines.joinToString()).doesNotContain("private", "app.example.test", "evil.invalid", "proto=https")
    }
  }

  @Test
  fun `diagnostic failure preserves rejection and correlation without entering downstream chain`() {
    val cloud = properties.copy(proxyMode = "CLOUD_RUN", expectedCloudRunService = "synthetic-service", qualificationEnabled = true)
    for (failure in listOf(IllegalStateException("synthetic-only"), InterruptedException("synthetic-only"))) {
      val lines = mutableListOf<String>()
      val response = MockHttpServletResponse()
      val req = request("/api/me").apply {
        addHeader(SharedQualificationFilter.HEADER, "33333333-3333-4333-8333-333333333333")
      }
      try {
        SharedQualificationFilter("ritomer-m12-00001-abc", lines::add).doFilter(req, response, FilterChain { r, s ->
          SharedSessionBoundaryFilter(cloud) { throw failure }.doFilter(r, s, FilterChain { _, _ -> error("DENIED_CHAIN_MUST_NOT_RUN") })
        })
        assertThat(response.status).isEqualTo(403)
        assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store")
        assertThat(com.fasterxml.jackson.databind.ObjectMapper().readTree(response.contentAsString)["code"].asText()).isEqualTo("ACCESS_DENIED")
        assertThat(lines).hasSize(1)
        val correlation = com.fasterxml.jackson.databind.ObjectMapper().readTree(lines.single())
        assertThat(correlation.fieldNames().asSequence().toSet()).containsExactlyInAnyOrder("challenge", "bootId", "revision", "status")
        assertThat(correlation["status"].asInt()).isEqualTo(403)
        assertThat(Thread.currentThread().isInterrupted).isEqualTo(failure is InterruptedException)
      } finally {
        Thread.interrupted()
      }
    }
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

  @Test
  fun `qualification registration is disabled by default and precedes Spring Session when enabled`() {
    val config = SharedSessionSecurityConfiguration()
    val env = MockEnvironment().withProperty("K_SERVICE", "ritomer-m12").withProperty("K_REVISION", "ritomer-m12-00001-abc")
    env.setActiveProfiles("shared-internal")
    assertThat(config.sharedQualificationRegistration(properties, env).isEnabled).isFalse()
    val cloud = properties.copy(proxyMode = "CLOUD_RUN", expectedCloudRunService = "ritomer-m12", qualificationEnabled = true)
    val registration = config.sharedQualificationRegistration(cloud, env)
    assertThat(registration.isEnabled).isTrue()
    assertThat(registration.order).isLessThan(SessionRepositoryFilter.DEFAULT_ORDER)
    assertThatThrownBy { config.sharedQualificationRegistration(properties.copy(qualificationEnabled = true), env) }
      .hasMessage("SHARED_QUALIFICATION_CLOUD_REQUIRED")
    env.setProperty("K_REVISION", "bad\nvalue")
    assertThatThrownBy { config.sharedQualificationRegistration(cloud, env) }
      .hasMessage("SHARED_QUALIFICATION_REVISION_REJECTED")
  }

  @Test
  fun `each qualified route is observed outside Spring Session for successful and refused statuses`() {
    val lines = mutableListOf<String>()
    val filter = SharedQualificationFilter("ritomer-m12-00001-abc", lines::add)
    val folder = "11111111-1111-4111-8111-111111111111"
    val document = "22222222-2222-4222-8222-222222222222"
    for ((path, method, expected) in listOf(
      Triple("/api/me", "GET", 401), Triple("/api/me", "GET", 403),
      Triple("/api/closing-folders/$folder/documents/$document/content", "GET", 200),
      Triple("/api/closing-folders/$folder/export-packs/$document/content", "GET", 403),
      Triple(SESSION_LOGOUT_PATH, "POST", 204)
    )) {
      val challenge = UUID.randomUUID().toString()
      val req = request(path).apply { this.method = method; addHeader(SharedQualificationFilter.HEADER, challenge) }
      val response = MockHttpServletResponse()
      val sessions = SessionRepositoryFilter(MapSessionRepository(ConcurrentHashMap()))
      filter.doFilter(req, response, FilterChain { r, s ->
        sessions.doFilter(r, s, FilterChain { _, reply -> (reply as jakarta.servlet.http.HttpServletResponse).status = expected })
      })
      val output = com.fasterxml.jackson.databind.ObjectMapper().readTree(lines.last())
      assertThat(output.fieldNames().asSequence().toSet()).containsExactlyInAnyOrder("challenge", "bootId", "revision", "status")
      assertThat(output["challenge"].asText()).isEqualTo(challenge)
      assertThat(output["status"].asInt()).isEqualTo(expected)
      assertThat(lines.last()).doesNotContain(folder, document, path)
    }
    assertThat(lines).hasSize(5)
    assertThat(lines.map { com.fasterxml.jackson.databind.ObjectMapper().readTree(it)["bootId"].asText() }.toSet()).hasSize(1)
  }

  @Test
  fun `qualification observes real freshness revocation and replay of the deleted session through Security chain`() {
    val lines = mutableListOf<String>()
    val qualification = SharedQualificationFilter("ritomer-m12-00001-abc", lines::add)
    val store = MapSessionRepository(ConcurrentHashMap())
    val session = store.createSession()
    val repository = HttpSessionSecurityContextRepository()
    val context = SecurityContextHolder.createEmptyContext().apply {
      authentication = AuthenticatedActorAuthentication.fromValidatedActor(AuthenticatedActor(
        UUID.randomUUID(), AuthenticationMechanism.OIDC, Instant.now(), "synthetic-correlation", UUID.randomUUID()
      ))
    }
    session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context)
    store.save(session)
    var verified = 0
    val verifier = object : ActorAuthorityFreshnessVerifier {
      override fun verifyFreshAuthority(actorId: UUID) = ActorAuthorityFreshness.REVOKED
      override fun verifyFreshAuthority(actor: AuthenticatedActor): ActorAuthorityFreshness {
        verified++; return ActorAuthorityFreshness.REVOKED
      }
    }
    val sessions = SessionRepositoryFilter(store).apply {
      setHttpSessionIdResolver(CookieHttpSessionIdResolver().apply {
        setCookieSerializer(SharedSessionSecurityConfiguration().cookieSerializer())
      })
    }
    val security = FilterChainProxy(DefaultSecurityFilterChain(AnyRequestMatcher.INSTANCE,
      SecurityContextHolderFilter(repository), SharedSessionBoundaryFilter(properties),
      SessionAuthorityFreshnessFilter(verifier, SessionTerminationSupport(repository)),
      ExceptionTranslationFilter { _, response, _ -> writeSecurityError(response, 401, "AUTHENTICATION_REQUIRED") },
      AuthorizationFilter(AuthenticatedAuthorizationManager.authenticated())
    ))
    for (expected in listOf(403, 401)) {
      val req = request("/api/me").apply {
        setCookies(Cookie(SESSION_COOKIE_NAME, session.id))
        addHeader(SharedQualificationFilter.HEADER, UUID.randomUUID().toString())
      }
      val response = MockHttpServletResponse()
      qualification.doFilter(req, response, FilterChain { r, s -> sessions.doFilter(r, s, FilterChain { sr, ss ->
        security.doFilter(sr, ss, FilterChain { _, _ -> error("BUSINESS_CHAIN_MUST_NOT_RUN") })
      }) })
      assertThat(response.status).isEqualTo(expected)
      assertThat(com.fasterxml.jackson.databind.ObjectMapper().readTree(lines.last())["status"].asInt()).isEqualTo(expected)
      assertThat(store.findById(session.id)).isNull()
    }
    assertThat(verified).isEqualTo(1)
    assertThat(lines).hasSize(2)
    assertThat(SecurityContextHolder.getContext().authentication).isNull()
  }

  @Test
  fun `qualification ignores uncontrolled inputs and never converts exception or async into successful status`() {
    val lines = mutableListOf<String>()
    val filter = SharedQualificationFilter("ritomer-m12-00001-abc", lines::add)
    fun qualified(path: String = "/api/me") = request(path).apply {
      addHeader(SharedQualificationFilter.HEADER, "33333333-3333-4333-8333-333333333333")
    }
    for (req in listOf(
      request("/api/me"), qualified(OIDC_CALLBACK_PATH), qualified().apply { queryString = "synthetic-private-value" },
      qualified().apply { method = "HEAD" }, qualified().apply { dispatcherType = DispatcherType.ERROR },
      qualified().apply { addHeader(SharedQualificationFilter.HEADER, UUID.randomUUID().toString()) },
      qualified().apply { removeHeader(SharedQualificationFilter.HEADER); addHeader(SharedQualificationFilter.HEADER, "bad\nvalue") }
    )) filter.doFilter(req, MockHttpServletResponse(), MockFilterChain())
    assertThat(lines).isEmpty()
    assertThatThrownBy {
      filter.doFilter(qualified(), MockHttpServletResponse(), FilterChain { _, _ -> error("synthetic-private-value") })
    }.hasMessage("synthetic-private-value")
    assertThat(lines.single()).contains("\"status\":\"ERROR\"").doesNotContain("synthetic-private-value")
    filter.doFilter(qualified().apply { isAsyncSupported = true }, MockHttpServletResponse(), FilterChain { req, _ -> req.startAsync() })
    assertThat(lines.last()).contains("\"status\":\"INCONCLUSIVE_ASYNC\"")
  }
}
