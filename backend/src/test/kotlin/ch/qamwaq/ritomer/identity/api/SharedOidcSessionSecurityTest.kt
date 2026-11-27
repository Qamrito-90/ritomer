package ch.qamwaq.ritomer.identity.api

import ch.qamwaq.ritomer.IdentityTestConfiguration
import ch.qamwaq.ritomer.IdentityTestStore
import ch.qamwaq.ritomer.identity.application.*
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.identity.infrastructure.security.SecurityAuthenticatedActorProvider
import ch.qamwaq.ritomer.shared.application.*
import ch.qamwaq.ritomer.shared.infrastructure.security.*
import ch.qamwaq.ritomer.shared.infrastructure.web.SharedFrontendController
import com.fasterxml.jackson.databind.ObjectMapper
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.RSAKey
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import com.sun.net.httpserver.HttpServer
import jakarta.servlet.http.Cookie
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import jakarta.servlet.SessionTrackingMode
import java.io.*
import java.net.InetSocketAddress
import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.*
import java.util.*
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicInteger
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.*
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.convert.ApplicationConversionService
import org.springframework.context.annotation.*
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.core.context.SecurityContext
import org.springframework.security.oauth2.client.registration.*
import org.springframework.security.oauth2.core.*
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy
import org.springframework.security.web.context.HttpSessionSecurityContextRepository
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity
import org.springframework.session.*
import org.springframework.session.web.http.*
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig
import org.springframework.test.web.servlet.*
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.context.WebApplicationContext
import org.springframework.web.servlet.config.annotation.EnableWebMvc
import org.springframework.web.util.UriComponentsBuilder

private const val TEST_ORIGIN = "https://app.example.test"
private const val TEST_SUBJECT = "provider-subject-never-persisted"
private const val TEST_EMAIL = "provider-only@example.test"

@SpringJUnitWebConfig(classes = [SharedOidcHttpHarness::class], initializers = [SharedOidcTestInitializer::class])
@TestPropertySource(properties = [
  "ritomer.security.session.enabled=true", "ritomer.security.session.absolute-timeout=8h",
  "ritomer.security.jwt.hmac-secret=", "server.servlet.session.tracking-modes=cookie",
  "server.servlet.session.cookie.name=__Host-ritomer-session", "server.servlet.session.cookie.secure=true",
  "server.servlet.session.cookie.http-only=true", "server.servlet.session.cookie.path=/",
  "server.servlet.session.cookie.same-site=lax", "server.servlet.session.timeout=30m",
  "logging.level.org.springframework.security=WARN", "logging.level.org.springframework.session=WARN"
])
@ActiveProfiles("shared-internal")
class SharedOidcSessionSecurityTest {
  @Autowired private lateinit var context: WebApplicationContext
  @Autowired private lateinit var idp: SyntheticOidcProvider
  @Autowired private lateinit var transactions: InMemoryOidcTransactions
  @Autowired private lateinit var sessions: RecordingSessionRepository
  @Autowired private lateinit var contextWrites: RecordingContextRepository
  @Autowired private lateinit var strategyFaults: OidcStrategyFaults
  @Autowired private lateinit var identities: IdentityTestStore
  @Autowired private lateinit var bindings: HarnessBindings
  @Autowired private lateinit var clock: SharedTestClock
  private lateinit var mvc: MockMvc
  private val observations = CopyOnWriteArrayList<String>()
  private val json = ObjectMapper()
  private lateinit var actorId: UUID
  private val tenant = UUID.fromString("11111111-1111-4111-8111-111111111111")

  @BeforeEach
  fun setup() {
    clock.now = Instant.now()
    identities.reset(); transactions.reset(); sessions.reset(); contextWrites.saves.clear(); contextWrites.failNextSave = false; idp.reset()
    strategyFaults.failure = null
    actorId = identities.seedUser("internal-id", displayName = "Synthetic user").id
    identities.seedActiveMembership("internal-id", tenant, "synthetic", "Synthetic tenant", TenantRole.ACCOUNTANT)
    bindings.secondBinding = null
    bindings.binding = OidcIdentityBinding(UUID.randomUUID(), actorId, true)
    observations.clear()
    configureMvc(clock.now.plusSeconds(3600))
  }

  private fun configureMvc(until: Instant?, emit: (String) -> Unit = { observations.add(it) }) {
    context.servletContext!!.setSessionTrackingModes(setOf(SessionTrackingMode.COOKIE))
    val sessionFilter = SessionRepositoryFilter(sessions).apply {
      setHttpSessionIdResolver(CookieHttpSessionIdResolver().apply {
        setCookieSerializer(SharedSessionSecurityConfiguration().cookieSerializer())
      })
    }
    val observer = ManualOidcObservationFilter(until, TEST_ORIGIN, "ritomer-m12-test", clock, emit, idp.issuer + "/authorize")
    mvc = MockMvcBuilders.webAppContextSetup(context).addFilters<org.springframework.test.web.servlet.setup.DefaultMockMvcBuilder>(observer, sessionFilter)
      .apply<org.springframework.test.web.servlet.setup.DefaultMockMvcBuilder>(springSecurity()).build()
  }

  private fun stages() = observations.map { json.readTree(it).path("stage").asText() }
  private val preparedStart = listOf("START_RECEIVED", "REDIRECT_RESOLVER_ENTERED", "AUTHORIZATION_SAVED", "START_PREPARED")
  private val validatedCallback = listOf("CALLBACK_RECEIVED", "CALLBACK_FILTER_ENTERED", "TRANSACTION_CONSUME_STARTED",
    "TRANSACTION_CONSUMED", "TOKEN_EXCHANGE_STARTED", "TOKEN_RESPONSE_RECEIVED", "JWT_VALIDATION_STARTED",
    "JWT_VALIDATED", "PROTOCOL_VALIDATED")

  private fun request(path: String, cookie: Cookie? = null): MockHttpServletRequestBuilder =
    get(path).secure(true).header("Host", "app.example.test").apply { if (cookie != null) cookie(cookie) }
  private fun bootstrap(cookie: Cookie? = null) = mvc.perform(request(SESSION_BOOTSTRAP_PATH, cookie)).andReturn()
  private fun cookie(result: MvcResult): Cookie = requireNotNull(result.response.getCookie(SESSION_COOKIE_NAME))
  private fun csrf(result: MvcResult) = json.readTree(result.response.contentAsString).path("csrf").path("token").asText()
  private fun start(cookie: Cookie, returnPath: String = "/", subject: String = TEST_SUBJECT): Pair<String, String> {
    val result = mvc.perform(request(OIDC_START_PATH, cookie).param("returnPath", returnPath)).andReturn()
    assertThat(result.response.status).isEqualTo(302)
    val authorization = requireNotNull(result.response.redirectedUrl)
    val query = UriComponentsBuilder.fromUriString(authorization).build().queryParams
    assertThat(query.getFirst("scope")).isEqualTo("openid")
    assertThat(query.getFirst("code_challenge_method")).isEqualTo("S256")
    assertThat(query.getFirst("redirect_uri")).isEqualTo(TEST_ORIGIN + OIDC_CALLBACK_PATH)
    val state = URLDecoder.decode(query.getFirst("state")!!, StandardCharsets.UTF_8)
    assertThat(transactions.read(digest(state), digest(cookie.value))).isNotNull()
    val code = idp.authorize(authorization, subject)
    val transaction = requireNotNull(transactions.read(digest(state), digest(cookie.value)))
    observations.forEach { assertThat(it).doesNotContain(state, code, cookie.value, transaction.nonce, transaction.verifier) }
    return state to code
  }
  private fun callback(cookie: Cookie, state: String, code: String) =
    mvc.perform(request(OIDC_CALLBACK_PATH, cookie).param("state", state).param("code", code)).andReturn()
  private fun login(subject: String = TEST_SUBJECT): Triple<Cookie, Cookie, String> {
    val anonymous = bootstrap()
    assertThat(anonymous.response.status).isEqualTo(200)
    val old = cookie(anonymous)
    val (state, code) = start(old, subject = subject)
    val result = callback(old, state, code)
    assertThat(result.response.redirectedUrl).isEqualTo("/")
    return Triple(old, cookie(result), csrf(anonymous))
  }

  @Test
  fun `real code exchange rotates SID and CSRF and saves only the actor before redirect`() {
    val (old, authenticated, oldCsrf) = login()
    assertThat(authenticated.value).isNotEqualTo(old.value)
    assertThat(sessions.findById(old.value)).isNull()
    val fresh = bootstrap(authenticated)
    assertThat(json.readTree(fresh.response.contentAsString).path("sessionState").asText()).isEqualTo("AUTHENTICATED")
    assertThat(csrf(fresh)).isNotEqualTo(oldCsrf).isNotBlank()
    assertThat(contextWrites.saves).hasSize(1)
    val saved = contextWrites.saves.single()
    assertThat(saved.sid).isEqualTo(authenticated.value)
    assertThat(saved.redirectAlreadyWritten).isFalse()
    assertThat(saved.actor.actorId).isEqualTo(actorId)
    assertThat(saved.actor.oidcBindingId).isEqualTo(bindings.binding!!.id)
    assertThat(idp.tokenCalls.get()).isEqualTo(1)
    val me = mvc.perform(request("/api/me", authenticated)).andReturn()
    assertThat(me.response.status).isEqualTo(200)
    assertThat(me.response.contentAsString).contains("internal-id").doesNotContain(TEST_SUBJECT, TEST_EMAIL)
    assertThat(mvc.perform(request("/api/me", old)).andReturn().response.status).isEqualTo(401)
    assertThat(identities.repositoryCounters().totalWrites).isZero()
    assertThat(stages()).containsExactlyElementsOf(preparedStart + validatedCallback + listOf("ADMISSION_ACCEPTED",
      "SESSION_STRATEGY_STARTED", "SESSION_STRATEGY_COMPLETED", "CONTEXT_SAVE_STARTED", "CONTEXT_SAVE_COMPLETED",
      "LOGIN_COMPLETED", "CALLBACK_FINISHED"))
    val events = observations.map { json.readTree(it) }
    assertThat(events.take(preparedStart.size).map { it.path("correlation").asText() }.distinct()).hasSize(1)
    assertThat(events.drop(preparedStart.size).map { it.path("correlation").asText() }.distinct()).hasSize(1)
    assertThat(events.first().path("correlation")).isNotEqualTo(events.last().path("correlation"))
    assertThat(events.map { it.path("sequence").asInt() }).containsExactlyElementsOf((1..events.size).toList())
    assertNoProviderMaterial()
  }

  @Test
  fun `same origin CSRF protected logout invalidates the shared session and old mutations`() {
    val (_, authenticated, oldCsrf) = login()
    val newCsrf = csrf(bootstrap(authenticated))
    fun logout(token: String) = mvc.perform(post(SESSION_LOGOUT_PATH).secure(true).header("Host", "app.example.test")
      .header("Origin", TEST_ORIGIN).header(SESSION_CSRF_HEADER_NAME, token).cookie(authenticated)).andReturn()
    assertThat(logout(oldCsrf).response.status).isEqualTo(403)
    val result = logout(newCsrf)
    assertThat(result.response.status).isEqualTo(204)
    val expirations = result.response.getHeaders("Set-Cookie").map { it.split(";").map(String::trim) }
      .filter { it.first().startsWith("$SESSION_COOKIE_NAME=") }
    assertThat(expirations.isNotEmpty()).isTrue()
    for (parts in expirations) {
      assertThat(parts.first() == "$SESSION_COOKIE_NAME=").isTrue()
      val attrs = parts.drop(1).groupBy { it.substringBefore("=").trim().lowercase() }
      assertThat(attrs.values.all { it.size == 1 }).isTrue()
      val expected = listOf("Max-Age=0", "Secure", "HttpOnly", "SameSite=Lax", "Path=/")
      assertThat(expected.all { attr -> attrs[attr.substringBefore("=").lowercase()]?.singleOrNull().equals(attr, ignoreCase = true) }).isTrue()
      assertThat("domain" in attrs).isFalse()
    }
    println("LOGOUT_COOKIE_EXPIRATIONS=" + expirations.size)
    assertThat(sessions.findById(authenticated.value)).isNull()
    assertThat(mvc.perform(request("/api/me", authenticated)).andReturn().response.status).isEqualTo(401)
    assertNoProviderMaterial()
  }

  @ParameterizedTest
  @ValueSource(strings = ["nonce", "signature", "issuer", "audience", "expired", "pkce", "missing_nonce"])
  fun `real cryptographic and protocol violations never establish a session`(fault: String) {
    val anonymous = cookie(bootstrap())
    val (state, code) = start(anonymous)
    idp.fault = fault
    val result = callback(anonymous, state, code)
    assertThat(result.response.redirectedUrl).isEqualTo(OIDC_FAILURE_PATH)
    assertThat(contextWrites.saves).isEmpty()
    assertThat(idp.tokenCalls.get()).isEqualTo(1)
    assertThat(callback(anonymous, state, code).response.redirectedUrl).isEqualTo(OIDC_FAILURE_PATH)
    assertThat(idp.tokenCalls.get()).isEqualTo(1)
    assertThat(json.readTree(bootstrap(anonymous).response.contentAsString).path("sessionState").asText()).isEqualTo("ANONYMOUS")
    assertThat(stages()).contains("PROTOCOL_NOT_COMPLETED").doesNotContain("PROTOCOL_VALIDATED", "ADMISSION_DENIED", "LOGIN_COMPLETED")
    val firstFailure = stages().first { it.startsWith("FAILURE_") }
    assertThat(firstFailure).isEqualTo(when (fault) {
      "pkce" -> "FAILURE_TOKEN_INVALID_GRANT"
      "signature" -> "FAILURE_JWT_DECODE"
      "issuer", "audience", "expired" -> "FAILURE_JWT_CLAIMS"
      else -> "FAILURE_NONCE_VALIDATION"
    })
    assertThat(stages()).contains("TRANSACTION_CONSUMED", "TOKEN_EXCHANGE_STARTED", "FAILURE_TRANSACTION_UNAVAILABLE")
    assertNoProviderMaterial()
  }

  @Test
  fun `state is bound to one anonymous session and expires at exactly five minutes`() {
    val anonymous = cookie(bootstrap())
    val other = cookie(bootstrap())
    val (state, code) = start(anonymous)
    assertThat(callback(other, state, code).response.redirectedUrl).isEqualTo(OIDC_FAILURE_PATH)
    assertThat(callback(anonymous, "incorrect", code).response.redirectedUrl).isEqualTo(OIDC_FAILURE_PATH)
    assertThat(idp.tokenCalls.get()).isZero()
    clock.now = clock.now.plusSeconds(300)
    assertThat(callback(anonymous, state, code).response.redirectedUrl).isEqualTo(OIDC_FAILURE_PATH)
    assertThat(idp.tokenCalls.get()).isZero()
    transactions.purgeExpired()
    assertThat(transactions.size()).isZero()
    assertThat(stages()).doesNotContain("PROTOCOL_VALIDATED", "ADMISSION_DENIED", "LOGIN_COMPLETED")
  }

  @Test
  fun `replay after admission failure cannot repeat the token exchange`() {
    val anonymous = cookie(bootstrap())
    val (state, code) = start(anonymous)
    bindings.binding = null
    assertThat(callback(anonymous, state, code).response.redirectedUrl).isEqualTo(OIDC_FAILURE_PATH)
    assertThat(callback(anonymous, state, code).response.redirectedUrl).isEqualTo(OIDC_FAILURE_PATH)
    assertThat(idp.tokenCalls.get()).isEqualTo(1)
    assertThat(contextWrites.saves).isEmpty()
    assertThat(identities.repositoryCounters().totalWrites).isZero()
    assertThat(stages()).containsExactlyElementsOf(preparedStart + validatedCallback + listOf("ADMISSION_DENIED", "CALLBACK_FINISHED",
      "CALLBACK_RECEIVED", "CALLBACK_FILTER_ENTERED", "TRANSACTION_CONSUME_STARTED", "FAILURE_TRANSACTION_UNAVAILABLE",
      "FAILURE_AUTHORIZATION_NOT_FOUND", "PROTOCOL_NOT_COMPLETED", "CALLBACK_FINISHED"))
    assertNoProviderMaterial()
  }

  @Test
  fun `two concurrent callbacks have only one transaction winner and one exchange`() {
    val anonymous = cookie(bootstrap())
    val (state, code) = start(anonymous)
    val executor = Executors.newFixedThreadPool(2)
    val gate = CountDownLatch(1)
    try {
      val results = (1..2).map { executor.submit<String> { gate.await(); callback(anonymous, state, code).response.redirectedUrl!! } }
      gate.countDown()
      assertThat(results.map { it.get(10, TimeUnit.SECONDS) }).containsExactlyInAnyOrder("/", OIDC_FAILURE_PATH)
      assertThat(idp.tokenCalls.get()).isEqualTo(1)
      assertThat(contextWrites.saves).hasSize(1)
      assertThat(stages().count { it == "PROTOCOL_VALIDATED" }).isEqualTo(1)
      assertThat(stages().count { it == "LOGIN_COMPLETED" }).isEqualTo(1)
      assertNoProviderMaterial()
    } finally { executor.shutdownNow() }
  }

  @Test
  fun `duplicate state or code and bearer tenant ambiguity are rejected without exchange`() {
    val anonymous = cookie(bootstrap())
    val (state, code) = start(anonymous)
    for (duplicate in listOf("state", "code")) {
      val result = mvc.perform(request(OIDC_CALLBACK_PATH, anonymous).param("state", state).param("code", code).param(duplicate, "extra")).andReturn()
      assertThat(result.response.redirectedUrl).isEqualTo(OIDC_FAILURE_PATH)
    }
    assertThat(mvc.perform(request(OIDC_CALLBACK_PATH, anonymous).param("state", state).param("code", code)
      .header("Authorization", "Bearer synthetic")).andReturn().response.status).isEqualTo(400)
    assertThat(mvc.perform(request(OIDC_START_PATH, anonymous).header("X-Tenant-Id", tenant)).andReturn().response.status).isEqualTo(400)
    assertThat(idp.tokenCalls.get()).isZero()
    assertThat(stages()).doesNotContain("PROTOCOL_VALIDATED", "ADMISSION_DENIED", "LOGIN_COMPLETED")
  }

  @Test
  fun `shared bootstrap is explicit and business API and local login remain closed`() {
    val anonymous = bootstrap()
    assertThat(json.readTree(anonymous.response.contentAsString).fieldNames().asSequence().toSet())
      .containsExactlyInAnyOrder("sessionState", "localLoginAvailable", "oidcLoginAvailable", "csrf")
    assertThat(anonymous.response.contentAsString).contains("\"localLoginAvailable\":false", "\"oidcLoginAvailable\":true").doesNotContain("actors")
    assertThat(mvc.perform(request("/api/me")).andReturn().response.status).isEqualTo(401)
    assertThat(mvc.perform(request("/api/me").header("Authorization", "Bearer synthetic")).andReturn().response.status).isEqualTo(401)
    assertThat(mvc.perform(post(SESSION_LOCAL_LOGIN_PATH).secure(true).header("Host", "app.example.test")
      .header("Origin", TEST_ORIGIN)).andReturn().response.status).isEqualTo(404)
    val setCookie = anonymous.response.getHeader("Set-Cookie")!!
    assertThat(setCookie).contains("__Host-ritomer-session=", "Secure", "HttpOnly", "Path=/", "SameSite=Lax").doesNotContain("Domain=")
  }

  @Test
  fun `binding revocation and absolute expiration terminate the session on next request`() {
    val (_, authenticated) = login()
    bindings.binding = bindings.binding!!.copy(active = false)
    val revoked = mvc.perform(request("/api/me", authenticated)).andReturn()
    assertThat(revoked.response.status).isEqualTo(403)
    assertThat(revoked.response.contentAsString).contains("ACCESS_REVOKED")
    assertThat(sessions.findById(authenticated.value)).isNull()
    bindings.binding = bindings.binding!!.copy(active = true, id = UUID.randomUUID())
    val (_, fresh) = login()
    clock.now = clock.now.plus(Duration.ofHours(8))
    val active = sessions.findById(fresh.value)!!
    active.lastAccessedTime = clock.now
    sessions.save(active) // Idle age is zero: only the absolute lifetime can reject.
    assertThat(mvc.perform(request("/api/me", fresh)).andReturn().response.status).isEqualTo(401)
    assertThat(sessions.findById(fresh.value)).isNull()
  }

  @Test
  fun `two clients keep their own sessions through revocation restoration and logout`() {
    val actorB = identities.seedUser("internal-b", displayName = "Synthetic B").id
    val tenantB = UUID.randomUUID()
    identities.seedActiveMembership("internal-b", tenantB, "tenant-b", "Tenant B", TenantRole.ACCOUNTANT)
    bindings.secondBinding = OidcIdentityBinding(UUID.randomUUID(), actorB, true)

    val (_, a) = login()
    val csrfA = csrf(bootstrap(a))
    val (_, b) = login("provider-subject-b")
    fun me(client: Cookie) = mvc.perform(request("/api/me", client)).andReturn().response
    fun assertActor(client: Cookie, actor: UUID, tenantId: UUID) {
      val response = me(client)
      assertThat(response.status).isEqualTo(200)
      val body = json.readTree(response.contentAsString)
      assertThat(body.path("actor").path("userId").asText()).isEqualTo(actor.toString())
      assertThat(body.path("memberships").map { it.path("tenantId").asText() }).containsExactly(tenantId.toString())
    }
    assertActor(a, actorId, tenant)
    assertActor(b, actorB, tenantB)
    bindings.binding = bindings.binding!!.copy(id = UUID.randomUUID(), active = false)
    assertThat(me(a).status).isEqualTo(403)
    assertActor(b, actorB, tenantB)
    bindings.binding = bindings.binding!!.copy(id = UUID.randomUUID(), active = true)
    assertThat(me(a).status).isEqualTo(401)
    assertActor(b, actorB, tenantB)

    val (_, fresh) = login()
    assertThat(fresh.value != a.value).isTrue()
    assertActor(fresh, actorId, tenant)
    fun logout(token: String) = mvc.perform(post(SESSION_LOGOUT_PATH).secure(true)
      .header("Host", "app.example.test").header("Origin", TEST_ORIGIN)
      .header(SESSION_CSRF_HEADER_NAME, token).cookie(fresh)).andReturn().response.status
    assertThat(logout(csrfA)).isEqualTo(403)
    assertActor(fresh, actorId, tenant)
    assertThat(me(a).status).isEqualTo(401)
    assertThat(logout(csrf(bootstrap(fresh)))).isEqualTo(204)
    assertThat(me(fresh).status).isEqualTo(401)
    assertActor(b, actorB, tenantB)
    assertNoProviderMaterial()
  }

  @Test
  fun `idle expiry refuses the persisted cookie and prevents authenticated bootstrap`() {
    val (_, authenticated) = login()
    val idle = sessions.findById(authenticated.value)!!
    idle.lastAccessedTime = Instant.now().minusSeconds(1800)
    sessions.save(idle)
    val response = bootstrap(authenticated).response
    assertThat(response.status).isEqualTo(401)
    assertThat(response.contentAsString).contains("SESSION_EXPIRED").doesNotContain("AUTHENTICATED")
  }

  @Test
  fun `anonymous shell is public while API and OAuth never fall through to HTML`() {
    for (path in listOf("/", "/closing-folders/11111111-1111-4111-8111-111111111111")) {
      val response = mvc.perform(request(path)).andReturn().response
      assertThat(response.status).isEqualTo(200)
      assertThat(response.contentAsString).contains("synthetic shared shell")
    }
    assertThat(mvc.perform(request("/api/missing")).andReturn().response.status).isEqualTo(401)
    assertThat(mvc.perform(request("/assets/missing.js")).andReturn().response.status).isEqualTo(404)
    val callback = mvc.perform(request(OIDC_CALLBACK_PATH)).andReturn().response
    assertThat(callback.redirectedUrl).isEqualTo(OIDC_FAILURE_PATH)
    assertThat(callback.contentAsString).doesNotContain("synthetic shared shell")
  }

  @Test
  fun `shared authority still refuses another tenant at the HTTP boundary`() {
    val (_, authenticated) = login()
    assertThat(mvc.perform(request("/api/me", authenticated).header("X-Tenant-Id", tenant)).andReturn().response.status).isEqualTo(200)
    val denied = mvc.perform(request("/api/me", authenticated).header("X-Tenant-Id", UUID.randomUUID())).andReturn()
    assertThat(denied.response.status).isEqualTo(403)
    assertThat(denied.response.contentAsString).contains("ACCESS_DENIED")
  }

  @Test
  fun `manual observation is silent when disabled or expired and cannot change successful authentication`() {
    for (deadline in listOf(null, clock.now.minusSeconds(1))) {
      configureMvc(deadline)
      login()
      assertThat(observations).isEmpty()
    }
    configureMvc(clock.now.plusSeconds(3600)) { throw IllegalStateException("synthetic secret must not escape") }
    login()
    assertThat(observations).isEmpty()
    assertNoProviderMaterial()
  }

  @Test
  fun `manual observation expires while a request is in flight and has a fixed per boot cap`() {
    val anonymous = cookie(bootstrap())
    val (state, code) = start(anonymous)
    clock.now = clock.now.plusSeconds(3600)
    callback(anonymous, state, code)
    assertThat(stages()).containsExactlyElementsOf(preparedStart)
    observations.clear()
    val inFlight = ManualOidcObservationFilter(clock.now.plusSeconds(1), TEST_ORIGIN, "ritomer-m12-test", clock, { observations.add(it) })
    inFlight.doFilter(org.springframework.mock.web.MockHttpServletRequest("GET", OIDC_START_PATH),
      org.springframework.mock.web.MockHttpServletResponse()) { _, _ -> clock.now = clock.now.plusSeconds(1) }
    assertThat(stages()).containsExactly("START_RECEIVED")
    observations.clear()
    configureMvc(clock.now.plusSeconds(3600))
    repeat(40) { mvc.perform(request(OIDC_CALLBACK_PATH)).andReturn() }
    assertThat(observations).hasSize(64)
    assertThat(stages().last()).isEqualTo("SATURATED")
    assertThat(observations.map { json.readTree(it).path("sequence").asInt() }).containsExactlyElementsOf((1..64).toList())
  }

  @Test
  fun `saved authorization without the exact outgoing redirect is never prepared`() {
    val observer = ManualOidcObservationFilter(clock.now.plusSeconds(3600), TEST_ORIGIN, "ritomer-m12-test", clock, { observations.add(it) })
    val req = org.springframework.mock.web.MockHttpServletRequest("GET", OIDC_START_PATH)
    val res = org.springframework.mock.web.MockHttpServletResponse()
    observer.doFilter(req, res) { request, response ->
      observeOidc(request as HttpServletRequest, ManualOidcStage.AUTHORIZATION_SAVED)
      (response as HttpServletResponse).sendRedirect("https://wrong.example.test/?state=synthetic-private")
    }
    assertThat(stages()).containsExactly("START_RECEIVED", "AUTHORIZATION_SAVED", "START_NOT_PREPARED")
    assertThat(res.redirectedUrl).isEqualTo("https://wrong.example.test/?state=synthetic-private")
    assertThat(observations.joinToString()).doesNotContain("wrong.example.test", "synthetic-private")
  }

  @Test
  fun `late session filter failure after success handler preserves the error and is not a finished callback`() {
    val observer = ManualOidcObservationFilter(clock.now.plusSeconds(3600), TEST_ORIGIN, "ritomer-m12-test", clock, { observations.add(it) })
    val failure = IllegalStateException("synthetic late flush failure")
    assertThatThrownBy {
      observer.doFilter(org.springframework.mock.web.MockHttpServletRequest("GET", OIDC_CALLBACK_PATH),
        org.springframework.mock.web.MockHttpServletResponse()) { request, _ ->
        observeOidc(request as HttpServletRequest, ManualOidcStage.PROTOCOL_VALIDATED)
        observeOidc(request, ManualOidcStage.ADMISSION_ACCEPTED)
        observeOidc(request, ManualOidcStage.LOGIN_COMPLETED)
        throw failure
      }
    }.isSameAs(failure)
    assertThat(stages()).containsExactly("CALLBACK_RECEIVED", "PROTOCOL_VALIDATED", "ADMISSION_ACCEPTED", "LOGIN_COMPLETED", "FAILURE_REQUEST_UNKNOWN", "OTHER_FAILURE")
  }

  @Test
  fun `manual observation separates start rejection and post admission storage failure`() {
    val rejected = mvc.perform(request(OIDC_START_PATH)).andReturn()
    assertThat(rejected.response.redirectedUrl).isEqualTo(OIDC_FAILURE_PATH)
    assertThat(stages()).containsExactly("START_RECEIVED", "REDIRECT_RESOLVER_ENTERED", "FAILURE_ANONYMOUS_SESSION_MISSING",
      "FAILURE_AUTHENTICATION_UNKNOWN", "START_NOT_PREPARED")
    observations.clear()
    val anonymous = cookie(bootstrap())
    val (state, code) = start(anonymous)
    contextWrites.failNextSave = true
    assertThatThrownBy { callback(anonymous, state, code) }.hasMessageContaining("synthetic context save failure")
    assertThat(stages()).containsExactlyElementsOf(preparedStart + validatedCallback + listOf("ADMISSION_ACCEPTED",
      "SESSION_STRATEGY_STARTED", "SESSION_STRATEGY_COMPLETED", "CONTEXT_SAVE_STARTED", "FAILURE_CONTEXT_SAVE",
      "FAILURE_REQUEST_UNKNOWN", "OTHER_FAILURE"))
    assertThat(contextWrites.saves).isEmpty()
  }

  @ParameterizedTest
  @ValueSource(strings = ["invalid_client", "unauthorized_client", "invalid_scope", "invalid_request", "unknown_private_error"])
  fun `real token endpoint failures retain a closed primary category without response details`(error: String) {
    val root = org.slf4j.LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME) as ch.qos.logback.classic.Logger
    val logs = ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>().apply { start() }
    root.addAppender(logs)
    try {
      val anonymous = cookie(bootstrap())
      val (state, code) = start(anonymous)
      idp.fault = "token_error:$error"
      val result = callback(anonymous, state, code)
      assertThat(result.response.redirectedUrl).isEqualTo(OIDC_FAILURE_PATH)
      assertThat(idp.tokenCalls.get()).isEqualTo(1)
      assertThat(transactions.size()).isZero()
      assertThat(contextWrites.saves).isEmpty()
      val failures = stages().filter { it.startsWith("FAILURE_") }
      val expected = when (error) {
        "invalid_client" -> "FAILURE_TOKEN_INVALID_CLIENT"
        "unauthorized_client" -> "FAILURE_TOKEN_UNAUTHORIZED_CLIENT"
        "invalid_scope" -> "FAILURE_TOKEN_INVALID_SCOPE"
        "invalid_request" -> "FAILURE_TOKEN_INVALID_REQUEST"
        else -> "FAILURE_TOKEN_UNKNOWN"
      }
      assertThat(failures.first()).isEqualTo(expected)
      assertThat(stages()).contains("TRANSACTION_CONSUMED", "TOKEN_EXCHANGE_STARTED")
        .doesNotContain("TOKEN_RESPONSE_RECEIVED", "JWT_VALIDATION_STARTED", "PROTOCOL_VALIDATED", "ADMISSION_DENIED")
      val output = observations.joinToString() + logs.list.joinToString { event ->
        event.formattedMessage + (event.throwableProxy?.let { ch.qos.logback.classic.spi.ThrowableProxyUtil.asString(it) } ?: "")
      }
      assertThat(output).doesNotContain("unknown_private_error", "sentinel-code-state-nonce-verifier-token-cookie-secret",
        "https://sensitive.example.test/", TEST_EMAIL, TEST_SUBJECT, state, code, anonymous.value)
      assertNoProviderMaterial()
    } finally { root.detachAppender(logs); logs.stop() }
  }

  @ParameterizedTest
  @ValueSource(strings = ["token_http_401", "token_http_403", "token_http_429", "token_http_503", "token_empty", "token_content_type", "token_disconnect"])
  @Timeout(15)
  fun `real token transport failures preserve protocol boundaries and private response data`(fault: String) {
    val root = org.slf4j.LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME) as ch.qos.logback.classic.Logger
    val logs = ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>().apply { start() }
    root.addAppender(logs)
    try {
      val anonymous = cookie(bootstrap())
      val (state, code) = start(anonymous)
      idp.fault = fault
      assertThat(callback(anonymous, state, code).response.redirectedUrl).isEqualTo(OIDC_FAILURE_PATH)
      val expected = when (fault) {
        "token_http_401" -> "FAILURE_TOKEN_HTTP_UNAUTHORIZED"
        "token_http_403" -> "FAILURE_TOKEN_HTTP_FORBIDDEN"
        "token_http_429" -> "FAILURE_TOKEN_HTTP_CLIENT"
        "token_http_503" -> "FAILURE_TOKEN_HTTP_SERVER"
        "token_content_type" -> "FAILURE_TOKEN_CONTENT_TYPE"
        "token_disconnect" -> "FAILURE_TOKEN_IO"
        else -> "FAILURE_TOKEN_RESPONSE"
      }
      assertThat(stages().first { it.startsWith("FAILURE_") }).isEqualTo(expected)
      assertThat(stages()).contains("TRANSACTION_CONSUMED", "TOKEN_EXCHANGE_STARTED", "PROTOCOL_NOT_COMPLETED")
        .doesNotContain("TOKEN_RESPONSE_RECEIVED", "JWT_VALIDATION_STARTED", "PROTOCOL_VALIDATED", "ADMISSION_DENIED")
      assertThat(transactions.consumeCalls.get()).isEqualTo(1)
      assertThat(transactions.size()).isZero()
      assertThat(contextWrites.saves).isEmpty()
      assertThat(idp.tokenCalls.get()).isEqualTo(1)
      val output = observations.joinToString() + logs.list.joinToString { event ->
        event.formattedMessage + (event.throwableProxy?.let { ch.qos.logback.classic.spi.ThrowableProxyUtil.asString(it) } ?: "")
      }
      assertThat(output).doesNotContain("sentinel-private-token-response", "sentinel-private-response-header",
        TEST_EMAIL, TEST_SUBJECT, state, code, anonymous.value)
      assertNoProviderMaterial()
    } finally { root.detachAppender(logs); logs.stop() }
  }

  @Test
  fun `callback diagnostics separate missing session malformed parameters and prior HTTP rejection`() {
    val anonymous = cookie(bootstrap())
    val (state, code) = start(anonymous)
    observations.clear()
    mvc.perform(request(OIDC_CALLBACK_PATH).param("state", state).param("code", code)).andReturn()
    assertThat(stages()).contains("CALLBACK_FILTER_ENTERED", "FAILURE_ANONYMOUS_SESSION_MISSING")
      .doesNotContain("TOKEN_EXCHANGE_STARTED", "FAILURE_TRANSACTION_UNAVAILABLE")
    observations.clear()
    mvc.perform(request(OIDC_CALLBACK_PATH, anonymous).param("state", state, "duplicate").param("code", code)).andReturn()
    assertThat(stages()).contains("FAILURE_CALLBACK_PARAMETERS").doesNotContain("TOKEN_EXCHANGE_STARTED")
    observations.clear()
    val result = mvc.perform(request(OIDC_CALLBACK_PATH, anonymous).param("state", state).param("code", code)
      .header("Origin", "https://untrusted.example.test")).andReturn()
    assertThat(result.response.status).isEqualTo(403)
    assertThat(stages()).containsExactly("CALLBACK_RECEIVED", "FAILURE_HTTP_BOUNDARY", "PROTOCOL_NOT_COMPLETED", "CALLBACK_FINISHED")
    assertThat(idp.tokenCalls.get()).isZero()
    assertThat(transactions.size()).isEqualTo(1)
  }

  @Test
  fun `transaction store failure is observed once without retry consumption or changing its exception`() {
    val anonymous = cookie(bootstrap())
    val (state, code) = start(anonymous)
    val failure = IllegalStateException("sentinel-code-state-nonce-verifier-token-cookie-secret")
    transactions.consumeFailure = failure
    assertThatThrownBy { callback(anonymous, state, code) }.isSameAs(failure)
    assertThat(transactions.consumeCalls.get()).isEqualTo(1)
    assertThat(transactions.size()).isEqualTo(1)
    assertThat(idp.tokenCalls.get()).isZero()
    assertThat(stages().filter { it.startsWith("FAILURE_") }).containsExactly("FAILURE_TRANSACTION_STORAGE", "FAILURE_REQUEST_UNKNOWN")
    assertThat(observations.joinToString()).doesNotContain(failure.message!!)
  }

  @Test
  fun `malformed token response is distinct from validated JWT or admission denial`() {
    val anonymous = cookie(bootstrap())
    val (state, code) = start(anonymous)
    idp.fault = "token_malformed"
    assertThat(callback(anonymous, state, code).response.redirectedUrl).isEqualTo(OIDC_FAILURE_PATH)
    assertThat(stages().first { it.startsWith("FAILURE_") }).isEqualTo("FAILURE_TOKEN_DECODE")
    assertThat(stages()).doesNotContain("TOKEN_RESPONSE_RECEIVED", "JWT_VALIDATION_STARTED", "PROTOCOL_VALIDATED", "ADMISSION_DENIED")
    assertThat(idp.tokenCalls.get()).isEqualTo(1)
    assertThat(contextWrites.saves).isEmpty()
    assertThat(transactions.size()).isZero()
    assertNoProviderMaterial()
  }

  @Test
  fun `token cause classification preserves specific types boundaries and unknown failures`() {
    fun failure(cause: Throwable) = OAuth2AuthorizationException(OAuth2Error("invalid_token_response"), cause)
    fun classify(cause: Throwable) = tokenFailureStage(failure(cause))
    val sentinel = "sentinel-private-token-response"
    assertThat(classify(java.net.ConnectException(sentinel).apply { initCause(java.nio.channels.UnresolvedAddressException()) }))
      .isEqualTo(ManualOidcStage.FAILURE_TOKEN_RESOLUTION)
    assertThat(classify(IOException(sentinel, javax.net.ssl.SSLHandshakeException(sentinel))))
      .isEqualTo(ManualOidcStage.FAILURE_TOKEN_TLS)
    assertThat(classify(java.net.ConnectException(sentinel).apply { initCause(java.net.http.HttpConnectTimeoutException(sentinel)) }))
      .isEqualTo(ManualOidcStage.FAILURE_TOKEN_TIMEOUT)
    assertThat(classify(java.net.UnknownHostException(sentinel))).isEqualTo(ManualOidcStage.FAILURE_TOKEN_RESOLUTION)
    assertThat(classify(java.net.ConnectException(sentinel))).isEqualTo(ManualOidcStage.FAILURE_TOKEN_CONNECTION)
    assertThat(classify(java.net.SocketTimeoutException(sentinel))).isEqualTo(ManualOidcStage.FAILURE_TOKEN_TIMEOUT)
    fun wrapped(depth: Int): Throwable {
      var cause: Throwable = javax.net.ssl.SSLHandshakeException(sentinel)
      repeat(depth) { cause = IllegalStateException(sentinel, cause) }
      return cause
    }
    assertThat(classify(wrapped(6))).isEqualTo(ManualOidcStage.FAILURE_TOKEN_TLS) // Includes the OAuth wrapper: eighth reference.
    assertThat(classify(wrapped(7))).isEqualTo(ManualOidcStage.FAILURE_TOKEN_RESPONSE)
    val first = IllegalStateException(sentinel)
    val second = IllegalStateException(sentinel, first)
    first.initCause(second)
    assertThat(classify(first)).isEqualTo(ManualOidcStage.FAILURE_TOKEN_RESPONSE)
    val brokenAccessor = object : RuntimeException(sentinel) {
      override val cause: Throwable get() = throw AssertionError(sentinel)
    }
    assertThat(classify(brokenAccessor)).isEqualTo(ManualOidcStage.FAILURE_TOKEN_RESPONSE)
    assertThat(tokenFailureStage(OAuth2AuthorizationException(OAuth2Error("invalid_client"), brokenAccessor)))
      .isEqualTo(ManualOidcStage.FAILURE_TOKEN_INVALID_CLIENT)
    assertThat(classify(org.springframework.web.client.RestClientResponseException(sentinel, 701, sentinel,
      org.springframework.http.HttpHeaders(), sentinel.toByteArray(), StandardCharsets.UTF_8)))
      .isEqualTo(ManualOidcStage.FAILURE_TOKEN_HTTP_OTHER)
    assertThat(observations.joinToString()).doesNotContain(sentinel)
  }

  @Test
  fun `token observation preserves original failure even when its cause accessor fails`() {
    val sentinel = "sentinel-private-token-response"
    val brokenAccessor = object : RuntimeException(sentinel) {
      override val cause: Throwable get() = throw AssertionError(sentinel)
    }
    val original = OAuth2AuthorizationException(OAuth2Error("invalid_token_response"), brokenAccessor)
    val calls = AtomicInteger()
    val client = observedTokenClient(org.springframework.security.oauth2.client.endpoint.OAuth2AccessTokenResponseClient<
      org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest> { calls.incrementAndGet(); throw original })
    val registration = context.getBean(ClientRegistrationRepository::class.java).findByRegistrationId("google")!!
    val authorization = org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest.authorizationCode()
      .authorizationUri(idp.issuer + "/authorize").clientId(registration.clientId)
      .redirectUri(TEST_ORIGIN + OIDC_CALLBACK_PATH).state("synthetic-state").build()
    val response = org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationResponse.success("synthetic-code")
      .redirectUri(TEST_ORIGIN + OIDC_CALLBACK_PATH).state("synthetic-state").build()
    val grant = org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest(registration,
      org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationExchange(authorization, response))
    assertThatThrownBy { client.getTokenResponse(grant) }.isSameAs(original)
    assertThat(calls.get()).isEqualTo(1)
    assertThat(idp.tokenCalls.get()).isZero()
    assertThat(observations.joinToString()).doesNotContain(sentinel)
  }

  @Test
  fun `session strategy failure occurs after admission without pretending context was saved`() {
    val anonymous = cookie(bootstrap())
    val (state, code) = start(anonymous)
    val failure = IllegalStateException("sentinel-private-session-strategy")
    strategyFaults.failure = failure
    assertThatThrownBy { callback(anonymous, state, code) }.isSameAs(failure)
    assertThat(stages()).containsExactlyElementsOf(preparedStart + validatedCallback + listOf("ADMISSION_ACCEPTED",
      "SESSION_STRATEGY_STARTED", "FAILURE_SESSION_STRATEGY", "FAILURE_REQUEST_UNKNOWN", "OTHER_FAILURE"))
    assertThat(contextWrites.saves).isEmpty()
    assertThat(observations.joinToString()).doesNotContain(failure.message!!)
    assertNoProviderMaterial()
  }

  @Test
  fun `scoped provider observation clears on exceptional exit and preserves first and late failures`() {
    val observer = ManualOidcObservationFilter(clock.now.plusSeconds(3600), TEST_ORIGIN, "ritomer-m12-test", clock, { observations.add(it) })
    val failure = IllegalStateException("sentinel-code-state-nonce-verifier-token-cookie-secret")
    assertThatThrownBy {
      observer.doFilter(org.springframework.mock.web.MockHttpServletRequest("GET", OIDC_CALLBACK_PATH),
        org.springframework.mock.web.MockHttpServletResponse()) { request, _ ->
        withOidcObservation(request as HttpServletRequest) {
          observeCurrentOidc(ManualOidcStage.FAILURE_TOKEN_UNKNOWN)
          throw failure
        }
      }
    }.isSameAs(failure)
    val before = observations.toList()
    observeCurrentOidc(ManualOidcStage.TOKEN_RESPONSE_RECEIVED)
    assertThat(observations).containsExactlyElementsOf(before)
    assertThat(stages().filter { it.startsWith("FAILURE_") }).containsExactly("FAILURE_TOKEN_UNKNOWN", "FAILURE_REQUEST_UNKNOWN")
    assertThat(observations.joinToString()).doesNotContain(failure.message!!)
  }

  @Test
  fun `manual observation activation requires qualification Cloud revision and a bounded UTC deadline`() {
    val env = org.springframework.mock.env.MockEnvironment().withProperty("K_SERVICE", "ritomer-m12")
      .withProperty("K_REVISION", "ritomer-m12-test").apply { setActiveProfiles("shared-internal") }
    val props = SharedSessionProperties(TEST_ORIGIN, "synthetic-client", "synthetic-secret", "CLOUD_RUN", "ritomer-m12")
    val config = SharedSessionSecurityConfiguration()
    assertThat(config.manualOidcObservationRegistration(props, env).isEnabled).isFalse()
    assertThat(config.manualOidcObservationRegistration(props.copy(manualOidcObservationUntil = Instant.now().plusSeconds(3600).toString()), env).isEnabled).isFalse()
    val active = props.copy(qualificationEnabled = true, manualOidcObservationUntil = Instant.now().plusSeconds(3600).toString())
    assertThat(config.manualOidcObservationRegistration(active, env).isEnabled).isTrue()
    assertThatThrownBy { config.manualOidcObservationRegistration(active.copy(proxyMode = "NONE"), env) }.isInstanceOf(IllegalArgumentException::class.java)
    assertThatThrownBy { config.manualOidcObservationRegistration(active.copy(manualOidcObservationUntil = "not-a-deadlineZ"), env) }.hasMessage("MANUAL_OIDC_DEADLINE_REJECTED")
    assertThatThrownBy { config.manualOidcObservationRegistration(active.copy(manualOidcObservationUntil = "2026-10-10T08:00:00+02:00"), env) }.hasMessage("MANUAL_OIDC_UTC_REQUIRED")
    assertThatThrownBy { config.manualOidcObservationRegistration(active.copy(manualOidcObservationUntil = Instant.now().plusSeconds(7201).toString()), env) }.hasMessage("MANUAL_OIDC_DEADLINE_REJECTED")
    env.setProperty("K_REVISION", "untrusted\"revision")
    assertThatThrownBy { config.manualOidcObservationRegistration(active, env) }.hasMessage("MANUAL_OIDC_REVISION_REJECTED")
  }

  private fun assertNoProviderMaterial() {
    for (line in observations) {
      val event = json.readTree(line)
      assertThat(event.fieldNames().asSequence().toSet()).containsExactlyInAnyOrder("type", "correlation", "bootId", "revision", "sequence", "stage")
      assertThat(event.path("type").asText()).isEqualTo("M12_OIDC_MANUAL_01")
      assertThat(event.path("stage").asText()).isIn(ManualOidcStage.entries.map { it.name })
      UUID.fromString(event.path("correlation").asText()); UUID.fromString(event.path("bootId").asText())
      assertThat(line).doesNotContain(TEST_SUBJECT, TEST_EMAIL, "synthetic-secret", "synthetic-access", "synthetic-refresh")
      idp.issuedTokens.forEach { assertThat(line).doesNotContain(it) }
    }
    assertThat(sessions.snapshots).isNotEmpty()
    for (bytes in sessions.snapshots) {
      val wire = bytes.toString(StandardCharsets.ISO_8859_1)
      assertThat(wire).doesNotContain(TEST_SUBJECT, TEST_EMAIL, "OAuth2AuthenticationToken", "DefaultOidcUser", "OAuth2AuthorizedClient", "OidcIdToken", "synthetic-access", "synthetic-refresh", "manual-observation", "M12_OIDC_MANUAL_01", "ManualOidcObservation")
      idp.issuedTokens.forEach { assertThat(wire.contains(it)).isFalse() }
    }
  }
}

class SharedOidcTestInitializer : org.springframework.context.ApplicationContextInitializer<org.springframework.context.ConfigurableApplicationContext> {
  override fun initialize(context: org.springframework.context.ConfigurableApplicationContext) {
    context.environment.conversionService = ApplicationConversionService()
  }
}

@TestConfiguration(proxyBeanMethods = false)
@EnableWebMvc
@EnableWebSecurity
@Import(SecurityConfig::class, SessionSecurityKernelConfiguration::class, SessionCredentialConflictFilter::class,
  SessionExpiryFilter::class, LocalAuthBoundaryFilter::class, SessionAuthorityFreshnessFilter::class,
  TenantMdcFilter::class, SecurityTenantContextProvider::class, SecurityAuditCorrelationContextProvider::class,
  SharedSessionController::class, SharedSessionControllerAdvice::class, MeController::class,
  CurrentActorService::class, ActorResolutionSupport::class, SecurityAuthenticatedActorProvider::class,
  OidcSessionAuthenticationService::class)
class SharedOidcHttpHarness {
  @Bean fun frontend(env: org.springframework.core.env.Environment): SharedFrontendController {
    val index = if (env.getProperty("m12.test.browser") == "true")
      org.springframework.core.io.FileSystemResource("../frontend/dist/index.html")
    else org.springframework.core.io.ByteArrayResource("<!doctype html><p>synthetic shared shell</p>".toByteArray())
    return SharedFrontendController(index)
  }
  @Bean fun clock() = SharedTestClock()
  @Bean(destroyMethod = "close") fun idp() = SyntheticOidcProvider()
  @Bean fun transactions(clock: SharedTestClock) = InMemoryOidcTransactions(clock)
  @Bean fun sessions() = RecordingSessionRepository()
  @Bean @Primary fun recordingContexts() = RecordingContextRepository()
  @Bean fun strategyFaults() = OidcStrategyFaults()
  @Bean fun boundary(env: org.springframework.core.env.Environment) = SharedSessionBoundaryFilter(
    SharedSessionProperties(env.getProperty("m12.test.origin", TEST_ORIGIN), "synthetic-client", "synthetic-secret"))
  @Bean fun identities() = IdentityTestStore()
  @Bean fun bindings() = HarnessBindings()
  @Bean fun users(store: IdentityTestStore) = IdentityTestConfiguration().appUserRepository(store)
  @Bean fun memberships(store: IdentityTestStore) = IdentityTestConfiguration().tenantMembershipRepository(store)
  @Bean fun auditTrail(): AuditTrail = object : AuditTrail { override fun append(command: AppendAuditEventCommand) = UUID.randomUUID() }
  @Bean fun registrations(idp: SyntheticOidcProvider, env: org.springframework.core.env.Environment): ClientRegistrationRepository = InMemoryClientRegistrationRepository(
    ClientRegistration.withRegistrationId("google").clientId("synthetic-client").clientSecret("synthetic-secret")
      .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE).clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
      .redirectUri(env.getProperty("m12.test.origin", TEST_ORIGIN) + OIDC_CALLBACK_PATH).scope("openid")
      .authorizationUri(idp.issuer + "/authorize").tokenUri(idp.issuer + "/token").jwkSetUri(idp.issuer + "/jwks")
      .issuerUri(idp.issuer).userNameAttributeName("sub").build())
  @Bean fun oidc(registrations: ClientRegistrationRepository, transactions: InMemoryOidcTransactions,
    admission: OidcActorAdmission, contexts: RecordingContextRepository, strategy: SessionAuthenticationStrategy,
    strategyFaults: OidcStrategyFaults) =
    GoogleOidcSecurity(registrations, transactions, admission, contexts, SessionAuthenticationStrategy { authentication, request, response ->
      strategyFaults.failure?.let { throw it }
      strategy.onAuthentication(authentication, request, response)
    })
}

class OidcStrategyFaults { var failure: RuntimeException? = null }

class SharedTestClock : Clock() {
  @Volatile var now: Instant = Instant.now()
  override fun instant() = now
  override fun getZone() = ZoneOffset.UTC
  override fun withZone(zone: ZoneId): Clock = this
}

class HarnessBindings : OidcIdentityRepository {
  @Volatile var binding: OidcIdentityBinding? = null
  @Volatile var secondBinding: OidcIdentityBinding? = null

  override fun findByIdentity(issuer: String, subject: String): OidcIdentityBinding? {
    if (!issuer.startsWith("http://127.0.0.1:")) return null
    return when (subject) {
      TEST_SUBJECT -> binding
      "provider-subject-b" -> secondBinding
      else -> null
    }
  }
  override fun findById(id: UUID) = listOfNotNull(binding, secondBinding).singleOrNull { it.id == id }
}

class RecordingContextRepository : HttpSessionSecurityContextRepository() {
  data class Save(val actor: AuthenticatedActor, val sid: String, val redirectAlreadyWritten: Boolean)
  val saves = CopyOnWriteArrayList<Save>()
  var failNextSave = false
  private val minimal = MinimalSessionSecurityContextRepository()
  override fun saveContext(context: SecurityContext, request: HttpServletRequest, response: HttpServletResponse) {
    if (failNextSave && context.authentication != null) { failNextSave = false; throw IllegalStateException("synthetic context save failure") }
    context.authentication?.let {
      check(it is AuthenticatedActorAuthentication && it.credentials == null && it.details == null)
      saves.add(Save(it.principal, request.getSession(false).id, response.getHeader("Location") != null))
    }
    minimal.saveContext(context, request, response)
  }
}

/** Serialization on EVERY save and read exposes intermediate token persistence, not only final state. */
class RecordingSessionRepository : SessionRepository<MapSession> {
  private val stored = ConcurrentHashMap<String, ByteArray>()
  val snapshots = CopyOnWriteArrayList<ByteArray>()
  override fun createSession() = MapSession().apply { maxInactiveInterval = Duration.ofMinutes(30) }
  override fun save(session: MapSession) {
    val bytes = ByteArrayOutputStream().use { buffer -> ObjectOutputStream(buffer).use { it.writeObject(session) }; buffer.toByteArray() }
    snapshots.add(bytes); stored[session.id] = bytes
  }
  override fun findById(id: String): MapSession? = stored[id]?.let { bytes ->
    ObjectInputStream(ByteArrayInputStream(bytes)).use { it.readObject() as MapSession }.takeUnless { it.isExpired }
  }
  override fun deleteById(id: String) { stored.remove(id) }
  fun reset() { stored.clear(); snapshots.clear() }
}

/** Replaces only storage, with the production store's one-winner and five-minute contract. */
class InMemoryOidcTransactions(private val clock: Clock) : OidcTransactionStore {
  private data class Row(val session: String, val value: OidcTransaction, val expires: Instant)
  private val rows = mutableMapOf<String, Row>()
  val consumeCalls = AtomicInteger()
  var consumeFailure: RuntimeException? = null
  @Synchronized override fun save(stateHash: String, sessionHash: String, transaction: OidcTransaction) {
    clear(sessionHash); rows[stateHash] = Row(sessionHash, transaction, clock.instant().plusSeconds(300))
  }
  @Synchronized override fun read(stateHash: String, sessionHash: String): OidcTransaction? =
    rows[stateHash]?.takeIf { it.session == sessionHash && clock.instant().isBefore(it.expires) }?.value
  @Synchronized override fun consume(stateHash: String, sessionHash: String): OidcTransaction? {
    consumeCalls.incrementAndGet()
    consumeFailure?.let { throw it }
    return read(stateHash, sessionHash)?.also { rows.remove(stateHash) }
  }
  @Synchronized override fun clear(sessionHash: String) { rows.entries.removeIf { it.value.session == sessionHash } }
  @Synchronized override fun purgeExpired() { rows.entries.removeIf { !clock.instant().isBefore(it.value.expires) } }
  @Synchronized fun reset() { rows.clear(); consumeCalls.set(0); consumeFailure = null }
  @Synchronized fun size() = rows.size
}

/** Real HTTP token/JWKS endpoints and ephemeral RSA signatures; never prints token or key material. */
class SyntheticOidcProvider : AutoCloseable {
  private val key: RSAKey = RSAKeyGenerator(2048).keyID("synthetic-key").generate()
  private val wrongKey: RSAKey = RSAKeyGenerator(2048).keyID("synthetic-key").generate()
  private val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
  val issuer = "http://127.0.0.1:${server.address.port}"
  private val json = ObjectMapper()
  private val codes = ConcurrentHashMap<String, Map<String, String>>()
  val tokenCalls = AtomicInteger()
  val issuedTokens = CopyOnWriteArrayList<String>()
  @Volatile var fault: String = ""
  init {
    server.createContext("/jwks") { exchange ->
      val bytes = JWKSet(key.toPublicJWK()).toString().toByteArray()
      exchange.responseHeaders.add("Content-Type", "application/json")
      exchange.sendResponseHeaders(200, bytes.size.toLong()); exchange.responseBody.use { it.write(bytes) }
    }
    server.createContext("/token") { exchange ->
      tokenCalls.incrementAndGet()
      val form = parse(exchange.requestBody.bufferedReader().readText())
      if (fault == "token_disconnect") {
        exchange.close()
        return@createContext
      }
      if (fault.startsWith("token_http_") || fault == "token_empty" || fault == "token_content_type") {
        val status = if (fault.startsWith("token_http_")) fault.substringAfterLast('_').toInt() else 200
        val bytes = json.writeValueAsBytes(mapOf("error" to "invalid_client",
          "error_description" to "sentinel-private-token-response $TEST_EMAIL $TEST_SUBJECT"))
        exchange.responseHeaders.add("Content-Type", if (fault == "token_content_type") "text/plain" else "application/json")
        exchange.responseHeaders.add("X-Synthetic-Private", "sentinel-private-response-header")
        if (fault == "token_empty") {
          exchange.sendResponseHeaders(status, -1)
          exchange.close()
        } else {
          exchange.sendResponseHeaders(status, bytes.size.toLong())
          exchange.responseBody.use { it.write(bytes) }
        }
        return@createContext
      }
      val authorization = codes.remove(form["code"])
      val verifier = form["code_verifier"].orEmpty()
      val challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))
      val valid = authorization != null && fault != "pkce" && verifier.length in 43..128 &&
        authorization["code_challenge"] == challenge && authorization["redirect_uri"] != null && form["redirect_uri"] == authorization["redirect_uri"] &&
        form["grant_type"] == "authorization_code" && exchange.requestHeaders.getFirst("Authorization") ==
        "Basic " + Base64.getEncoder().encodeToString("synthetic-client:synthetic-secret".toByteArray())
      val tokenError = fault.takeIf { it.startsWith("token_error:") }?.substringAfter(':')
      val payload = if (tokenError != null) mapOf("error" to tokenError,
        "error_description" to "sentinel-code-state-nonce-verifier-token-cookie-secret $TEST_EMAIL $TEST_SUBJECT",
        "error_uri" to "https://sensitive.example.test/?code=sentinel-code-state-nonce-verifier-token-cookie-secret")
      else if (!valid) mapOf("error" to "invalid_grant") else {
        val now = Instant.now()
        val claims = JWTClaimsSet.Builder().issuer(if (fault == "issuer") "https://wrong.example.test" else issuer)
          .subject(authorization!!["synthetic_subject"] ?: TEST_SUBJECT).audience(if (fault == "audience") "wrong-client" else "synthetic-client")
          .issueTime(Date.from(now.minusSeconds(120)))
          .expirationTime(Date.from(if (fault == "expired") now.minusSeconds(1) else now.plusSeconds(300)))
          .claim("email", TEST_EMAIL)
        if (fault != "missing_nonce") claims.claim("nonce", if (fault == "nonce") "wrong-nonce" else authorization!!["nonce"])
        val jwt = SignedJWT(JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.keyID).build(), claims.build())
        jwt.sign(RSASSASigner(if (fault == "signature") wrongKey else key))
        val encoded = jwt.serialize(); issuedTokens.add(encoded)
        mapOf("access_token" to "synthetic-access", "refresh_token" to "synthetic-refresh", "token_type" to "Bearer",
          "expires_in" to 300, "scope" to "openid", "id_token" to encoded)
      }
      val bytes = if (fault == "token_malformed") "{invalid-json".toByteArray() else json.writeValueAsBytes(payload)
      exchange.responseHeaders.add("Content-Type", "application/json")
      exchange.sendResponseHeaders(if (valid && tokenError == null) 200 else 400, bytes.size.toLong())
      exchange.responseBody.use { it.write(bytes) }
    }
    server.start()
  }
  fun authorize(uri: String, subject: String = TEST_SUBJECT): String = UUID.randomUUID().toString().also {
    require(subject.isNotBlank() && subject.length <= 255)
    codes[it] = parse(URI(uri).rawQuery) + ("synthetic_subject" to subject)
  }
  fun enableBrowserAuthorization(callback: URI, nextSubject: () -> String) {
    require(callback.scheme == "https" && callback.host == "localhost" && callback.path == OIDC_CALLBACK_PATH)
    server.createContext("/authorize") { exchange ->
      try {
        val query = parse(exchange.requestURI.rawQuery)
        require(exchange.requestMethod == "GET" && query["redirect_uri"] == callback.toString() &&
          query["client_id"] == "synthetic-client" && query["code_challenge_method"] == "S256")
        val code = authorize(exchange.requestURI.toString(), nextSubject())
        val location = UriComponentsBuilder.fromUri(callback).queryParam("state", query.getValue("state"))
          .queryParam("code", code).build().toUriString()
        exchange.responseHeaders.add("Cache-Control", "no-store")
        exchange.responseHeaders.add("Location", location)
        exchange.sendResponseHeaders(302, -1)
      } catch (_: Exception) {
        exchange.sendResponseHeaders(400, -1)
      } finally {
        exchange.close()
      }
    }
  }
  private fun parse(query: String) = query.split('&').associate {
    URLDecoder.decode(it.substringBefore('='), StandardCharsets.UTF_8) to URLDecoder.decode(it.substringAfter('=', ""), StandardCharsets.UTF_8)
  }
  fun reset() { codes.clear(); tokenCalls.set(0); issuedTokens.clear(); fault = "" }
  override fun close() { server.stop(0) }
}
