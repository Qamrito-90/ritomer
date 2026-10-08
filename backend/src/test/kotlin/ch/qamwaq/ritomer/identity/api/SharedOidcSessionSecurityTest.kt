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
  @Autowired private lateinit var identities: IdentityTestStore
  @Autowired private lateinit var bindings: HarnessBindings
  @Autowired private lateinit var clock: SharedTestClock
  private lateinit var mvc: MockMvc
  private val json = ObjectMapper()
  private lateinit var actorId: UUID
  private val tenant = UUID.fromString("11111111-1111-4111-8111-111111111111")

  @BeforeEach
  fun setup() {
    clock.now = Instant.now()
    identities.reset(); transactions.reset(); sessions.reset(); contextWrites.saves.clear(); idp.reset()
    actorId = identities.seedUser("internal-id", displayName = "Synthetic user").id
    identities.seedActiveMembership("internal-id", tenant, "synthetic", "Synthetic tenant", TenantRole.ACCOUNTANT)
    bindings.binding = OidcIdentityBinding(UUID.randomUUID(), actorId, true)
    context.servletContext!!.setSessionTrackingModes(setOf(SessionTrackingMode.COOKIE))
    val sessionFilter = SessionRepositoryFilter(sessions).apply {
      setHttpSessionIdResolver(CookieHttpSessionIdResolver().apply {
        setCookieSerializer(SharedSessionSecurityConfiguration().cookieSerializer())
      })
    }
    mvc = MockMvcBuilders.webAppContextSetup(context).addFilters<org.springframework.test.web.servlet.setup.DefaultMockMvcBuilder>(sessionFilter)
      .apply<org.springframework.test.web.servlet.setup.DefaultMockMvcBuilder>(springSecurity()).build()
  }

  private fun request(path: String, cookie: Cookie? = null): MockHttpServletRequestBuilder =
    get(path).secure(true).header("Host", "app.example.test").apply { if (cookie != null) cookie(cookie) }
  private fun bootstrap(cookie: Cookie? = null) = mvc.perform(request(SESSION_BOOTSTRAP_PATH, cookie)).andReturn()
  private fun cookie(result: MvcResult): Cookie = requireNotNull(result.response.getCookie(SESSION_COOKIE_NAME))
  private fun csrf(result: MvcResult) = json.readTree(result.response.contentAsString).path("csrf").path("token").asText()
  private fun start(cookie: Cookie, returnPath: String = "/"): Pair<String, String> {
    val result = mvc.perform(request(OIDC_START_PATH, cookie).param("returnPath", returnPath)).andReturn()
    assertThat(result.response.status).isEqualTo(302)
    val authorization = requireNotNull(result.response.redirectedUrl)
    val query = UriComponentsBuilder.fromUriString(authorization).build().queryParams
    assertThat(query.getFirst("scope")).isEqualTo("openid")
    assertThat(query.getFirst("code_challenge_method")).isEqualTo("S256")
    assertThat(query.getFirst("redirect_uri")).isEqualTo(TEST_ORIGIN + OIDC_CALLBACK_PATH)
    val state = URLDecoder.decode(query.getFirst("state")!!, StandardCharsets.UTF_8)
    assertThat(transactions.read(digest(state), digest(cookie.value))).isNotNull()
    return state to idp.authorize(authorization)
  }
  private fun callback(cookie: Cookie, state: String, code: String) =
    mvc.perform(request(OIDC_CALLBACK_PATH, cookie).param("state", state).param("code", code)).andReturn()
  private fun login(): Triple<Cookie, Cookie, String> {
    val anonymous = bootstrap()
    assertThat(anonymous.response.status).isEqualTo(200)
    val old = cookie(anonymous)
    val (state, code) = start(old)
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
    assertThat(result.response.getHeaders("Set-Cookie").joinToString()).contains("Secure", "HttpOnly", "SameSite=Lax", "Path=/").doesNotContain("Domain=")
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

  private fun assertNoProviderMaterial() {
    assertThat(sessions.snapshots).isNotEmpty()
    for (bytes in sessions.snapshots) {
      val wire = bytes.toString(StandardCharsets.ISO_8859_1)
      assertThat(wire).doesNotContain(TEST_SUBJECT, TEST_EMAIL, "OAuth2AuthenticationToken", "DefaultOidcUser", "OAuth2AuthorizedClient", "OidcIdToken", "synthetic-access", "synthetic-refresh")
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
  @Bean fun frontend() = SharedFrontendController(org.springframework.core.io.ByteArrayResource("<!doctype html><p>synthetic shared shell</p>".toByteArray()))
  @Bean fun clock() = SharedTestClock()
  @Bean(destroyMethod = "close") fun idp() = SyntheticOidcProvider()
  @Bean fun transactions(clock: SharedTestClock) = InMemoryOidcTransactions(clock)
  @Bean fun sessions() = RecordingSessionRepository()
  @Bean @Primary fun recordingContexts() = RecordingContextRepository()
  @Bean fun boundary() = SharedSessionBoundaryFilter(SharedSessionProperties(TEST_ORIGIN, "synthetic-client", "synthetic-secret"))
  @Bean fun identities() = IdentityTestStore()
  @Bean fun bindings() = HarnessBindings()
  @Bean fun users(store: IdentityTestStore) = IdentityTestConfiguration().appUserRepository(store)
  @Bean fun memberships(store: IdentityTestStore) = IdentityTestConfiguration().tenantMembershipRepository(store)
  @Bean fun auditTrail(): AuditTrail = object : AuditTrail { override fun append(command: AppendAuditEventCommand) = UUID.randomUUID() }
  @Bean fun registrations(idp: SyntheticOidcProvider): ClientRegistrationRepository = InMemoryClientRegistrationRepository(
    ClientRegistration.withRegistrationId("google").clientId("synthetic-client").clientSecret("synthetic-secret")
      .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE).clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
      .redirectUri(TEST_ORIGIN + OIDC_CALLBACK_PATH).scope("openid")
      .authorizationUri(idp.issuer + "/authorize").tokenUri(idp.issuer + "/token").jwkSetUri(idp.issuer + "/jwks")
      .issuerUri(idp.issuer).userNameAttributeName("sub").build())
  @Bean fun oidc(registrations: ClientRegistrationRepository, transactions: InMemoryOidcTransactions,
    admission: OidcActorAdmission, contexts: RecordingContextRepository, strategy: SessionAuthenticationStrategy) =
    GoogleOidcSecurity(registrations, transactions, admission, contexts, strategy)
}

class SharedTestClock : Clock() {
  @Volatile var now: Instant = Instant.now()
  override fun instant() = now
  override fun getZone() = ZoneOffset.UTC
  override fun withZone(zone: ZoneId): Clock = this
}

class HarnessBindings : OidcIdentityRepository {
  @Volatile var binding: OidcIdentityBinding? = null
  override fun findByIdentity(issuer: String, subject: String) = binding.takeIf { issuer.startsWith("http://127.0.0.1:") && subject == TEST_SUBJECT }
  override fun findById(id: UUID) = binding?.takeIf { it.id == id }
}

class RecordingContextRepository : HttpSessionSecurityContextRepository() {
  data class Save(val actor: AuthenticatedActor, val sid: String, val redirectAlreadyWritten: Boolean)
  val saves = CopyOnWriteArrayList<Save>()
  private val minimal = MinimalSessionSecurityContextRepository()
  override fun saveContext(context: SecurityContext, request: HttpServletRequest, response: HttpServletResponse) {
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
  @Synchronized override fun save(stateHash: String, sessionHash: String, transaction: OidcTransaction) {
    clear(sessionHash); rows[stateHash] = Row(sessionHash, transaction, clock.instant().plusSeconds(300))
  }
  @Synchronized override fun read(stateHash: String, sessionHash: String): OidcTransaction? =
    rows[stateHash]?.takeIf { it.session == sessionHash && clock.instant().isBefore(it.expires) }?.value
  @Synchronized override fun consume(stateHash: String, sessionHash: String): OidcTransaction? =
    read(stateHash, sessionHash)?.also { rows.remove(stateHash) }
  @Synchronized override fun clear(sessionHash: String) { rows.entries.removeIf { it.value.session == sessionHash } }
  @Synchronized override fun purgeExpired() { rows.entries.removeIf { !clock.instant().isBefore(it.value.expires) } }
  @Synchronized fun reset() { rows.clear() }
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
      val authorization = codes.remove(form["code"])
      val verifier = form["code_verifier"].orEmpty()
      val challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))
      val valid = authorization != null && fault != "pkce" && verifier.length in 43..128 &&
        authorization["code_challenge"] == challenge && form["redirect_uri"] == TEST_ORIGIN + OIDC_CALLBACK_PATH &&
        form["grant_type"] == "authorization_code" && exchange.requestHeaders.getFirst("Authorization") ==
        "Basic " + Base64.getEncoder().encodeToString("synthetic-client:synthetic-secret".toByteArray())
      val payload = if (!valid) mapOf("error" to "invalid_grant") else {
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
      val bytes = json.writeValueAsBytes(payload)
      exchange.responseHeaders.add("Content-Type", "application/json")
      exchange.sendResponseHeaders(if (valid) 200 else 400, bytes.size.toLong())
      exchange.responseBody.use { it.write(bytes) }
    }
    server.start()
  }
  fun authorize(uri: String, subject: String = TEST_SUBJECT): String = UUID.randomUUID().toString().also {
    require(subject.isNotBlank() && subject.length <= 255)
    codes[it] = parse(URI(uri).rawQuery) + ("synthetic_subject" to subject)
  }
  private fun parse(query: String) = query.split('&').associate {
    URLDecoder.decode(it.substringBefore('='), StandardCharsets.UTF_8) to URLDecoder.decode(it.substringAfter('=', ""), StandardCharsets.UTF_8)
  }
  fun reset() { codes.clear(); tokenCalls.set(0); issuedTokens.clear(); fault = "" }
  override fun close() { server.stop(0) }
}
