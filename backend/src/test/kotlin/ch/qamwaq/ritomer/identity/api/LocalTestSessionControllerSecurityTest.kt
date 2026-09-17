package ch.qamwaq.ritomer.identity.api

import ch.qamwaq.ritomer.IdentityRepositoryCounters
import ch.qamwaq.ritomer.IdentityTestConfiguration
import ch.qamwaq.ritomer.IdentityTestStore
import ch.qamwaq.ritomer.identity.application.LOCAL_SESSION_ACCOUNTANT_ACTOR_ID
import ch.qamwaq.ritomer.identity.application.LOCAL_SESSION_ACCOUNTANT_ACTOR_KEY
import ch.qamwaq.ritomer.identity.application.LOCAL_SESSION_ADMIN_ACTOR_ID
import ch.qamwaq.ritomer.identity.application.LOCAL_SESSION_ADMIN_ACTOR_KEY
import ch.qamwaq.ritomer.identity.application.LOCAL_SESSION_REVIEWER_ACTOR_ID
import ch.qamwaq.ritomer.identity.application.LOCAL_SESSION_REVIEWER_ACTOR_KEY
import ch.qamwaq.ritomer.identity.domain.AppUser
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import ch.qamwaq.ritomer.shared.application.AuthenticationMechanism
import ch.qamwaq.ritomer.shared.infrastructure.security.AuthenticatedActorAuthentication
import ch.qamwaq.ritomer.shared.infrastructure.security.CLOUD_RUN_SESSION_DENY_MARKERS
import ch.qamwaq.ritomer.shared.infrastructure.security.LOCAL_AUTH_BOUNDARY_FILTER_INVOCATIONS
import ch.qamwaq.ritomer.shared.infrastructure.security.LocalAuthBoundaryFilter
import ch.qamwaq.ritomer.shared.infrastructure.security.SESSION_AUTHORITY_FILTER_INVOCATIONS
import ch.qamwaq.ritomer.shared.infrastructure.security.SESSION_CONFLICT_FILTER_INVOCATIONS
import ch.qamwaq.ritomer.shared.infrastructure.security.SESSION_COOKIE_NAME
import ch.qamwaq.ritomer.shared.infrastructure.security.SESSION_CSRF_HEADER_NAME
import ch.qamwaq.ritomer.shared.infrastructure.security.SESSION_EXPIRY_FILTER_INVOCATIONS
import ch.qamwaq.ritomer.shared.infrastructure.security.SessionAuthorityFreshnessFilter
import ch.qamwaq.ritomer.shared.infrastructure.security.SessionCredentialConflictFilter
import ch.qamwaq.ritomer.shared.infrastructure.security.SessionExpiryFilter
import ch.qamwaq.ritomer.shared.infrastructure.security.TENANT_MDC_FILTER_INVOCATION_COUNT_ATTRIBUTE
import ch.qamwaq.ritomer.shared.infrastructure.security.TenantMdcFilter
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.DispatcherType
import jakarta.servlet.Filter
import jakarta.servlet.SessionTrackingMode
import jakarta.servlet.ServletContext
import jakarta.servlet.http.Cookie
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.ObjectInputStream
import java.io.ObjectOutputStream
import java.lang.reflect.Modifier
import java.nio.file.Files
import java.nio.file.Path
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.Collections
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.slf4j.MDC
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.core.env.Environment
import org.springframework.core.env.MapPropertySource
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.mock.env.MockEnvironment
import org.springframework.mock.web.MockFilterChain
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.mock.web.MockHttpSession
import org.springframework.mock.web.MockServletContext
import org.springframework.security.core.Authentication
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.core.context.SecurityContextImpl
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter
import org.springframework.security.web.FilterChainProxy
import org.springframework.security.web.access.intercept.AuthorizationFilter
import org.springframework.security.web.authentication.logout.LogoutFilter
import org.springframework.security.web.context.HttpSessionSecurityContextRepository
import org.springframework.security.web.context.SecurityContextHolderFilter
import org.springframework.security.web.csrf.CsrfFilter
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.util.ReflectionTestUtils
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.yaml.snakeyaml.LoaderOptions
import org.yaml.snakeyaml.Yaml
import org.yaml.snakeyaml.constructor.SafeConstructor

@SpringBootTest(
  properties = [
    "ritomer.security.session.enabled=true",
    "server.address=127.0.0.1",
    "server.port=8080"
  ]
)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class, SessionTestClockConfiguration::class)
class LocalTestSessionControllerSecurityTest {
  @Autowired
  private lateinit var mockMvc: MockMvc

  @Autowired
  private lateinit var objectMapper: ObjectMapper

  @Autowired
  private lateinit var identityTestStore: IdentityTestStore

  @Autowired
  private lateinit var applicationContext: ApplicationContext

  @Autowired
  private lateinit var environment: Environment

  @Autowired
  private lateinit var servletContext: ServletContext

  @Autowired
  private lateinit var sessionClock: AdjustableSessionClock

  @Autowired
  private lateinit var filterChainProxy: FilterChainProxy

  @Autowired
  private lateinit var securityContextRepository: HttpSessionSecurityContextRepository

  @BeforeEach
  fun resetFixture() {
    servletContext.setSessionTrackingModes(setOf(SessionTrackingMode.COOKIE))
    sessionClock.setInstant(BASE_INSTANT)
    identityTestStore.reset()
    seedLocalActor(
      LOCAL_SESSION_ACCOUNTANT_ACTOR_ID,
      ACCOUNTANT_SUBJECT,
      "Accountant Test",
      TenantRole.ACCOUNTANT
    )
    seedLocalActor(
      LOCAL_SESSION_REVIEWER_ACTOR_ID,
      REVIEWER_SUBJECT,
      "Reviewer Test",
      TenantRole.REVIEWER
    )
    seedLocalActor(
      LOCAL_SESSION_ADMIN_ACTOR_ID,
      ADMIN_SUBJECT,
      "Admin Test",
      TenantRole.ADMIN
    )
    SecurityContextHolder.clearContext()
    MDC.clear()
  }

  @Test
  fun `anonymous bootstrap is minimal stable no-store and uses the exact session configuration`() {
    val first = bootstrap()
    val firstSessionId = first.session.id
    val second = bootstrap(first.session)

    assertThat(second.session).isSameAs(first.session)
    assertThat(second.session.id).isEqualTo(firstSessionId)
    assertThat(second.csrfToken).isEqualTo(first.csrfToken)
    assertThat(first.body.path("sessionState").asText()).isEqualTo("ANONYMOUS")
    assertThat(first.body.path("localLoginAvailable").asBoolean()).isTrue()
    assertThat(first.body.path("csrf").fieldNames().asSequence().toSet())
      .containsExactlyInAnyOrder("headerName", "token")
    assertThat(first.body.at("/csrf/headerName").asText()).isEqualTo(SESSION_CSRF_HEADER_NAME)

    val actors = first.body.path("actors")
    assertThat(actors).hasSize(3)
    assertThat(actors.map { it.path("actorKey").asText() })
      .containsExactly(
        LOCAL_SESSION_ACCOUNTANT_ACTOR_KEY,
        LOCAL_SESSION_REVIEWER_ACTOR_KEY,
        LOCAL_SESSION_ADMIN_ACTOR_KEY
      )
    actors.forEach { actor ->
      assertThat(actor.fieldNames().asSequence().toSet())
        .containsExactlyInAnyOrder("actorKey", "displayLabel")
    }
    val rawBody = first.rawBody
    listOf(
      LOCAL_SESSION_ACCOUNTANT_ACTOR_ID.toString(),
      LOCAL_SESSION_REVIEWER_ACTOR_ID.toString(),
      LOCAL_SESSION_ADMIN_ACTOR_ID.toString(),
      ACCOUNTANT_SUBJECT,
      REVIEWER_SUBJECT,
      ADMIN_SUBJECT,
      "ACCOUNTANT",
      "REVIEWER",
      "ADMIN",
      "tenantId",
      "membership",
      "@"
    ).forEach { forbidden -> assertThat(rawBody).doesNotContain(forbidden) }

    assertThat(environment.getProperty("server.servlet.session.timeout")).isEqualTo("30m")
    assertThat(environment.getProperty("server.servlet.session.tracking-modes")).isEqualTo("cookie")
    assertThat(environment.getProperty("server.servlet.session.cookie.name")).isEqualTo(SESSION_COOKIE_NAME)
    assertThat(environment.getProperty("server.servlet.session.cookie.secure")).isEqualTo("true")
    assertThat(environment.getProperty("server.servlet.session.cookie.http-only")).isEqualTo("true")
    assertThat(environment.getProperty("server.servlet.session.cookie.path")).isEqualTo("/")
    assertThat(environment.getProperty("server.servlet.session.cookie.same-site")).isEqualTo("lax")
    assertThat(environment.getProperty("server.servlet.session.cookie.domain")).isNull()
    assertThat(servletContext.effectiveSessionTrackingModes).containsExactly(SessionTrackingMode.COOKIE)
    assertThat(ReflectionTestUtils.getField(securityContextRepository, "disableUrlRewriting")).isEqualTo(true)

    val attributes = Collections.list(first.session.attributeNames)
    assertThat(attributes).hasSize(1)
    assertThat(attributes.single()).contains("CSRF_TOKEN")
    assertThat(identityTestStore.repositoryCounters())
      .isEqualTo(IdentityRepositoryCounters(0, 0, 0, 0, 0))
  }

  @Test
  fun `session capability is absent when the default-off flag is not enabled`() {
    ApplicationContextRunner()
      .withInitializer { context -> context.environment.setActiveProfiles("test") }
      .withUserConfiguration(SessionController::class.java)
      .withPropertyValues("ritomer.security.session.enabled=false")
      .run { context ->
        assertThat(context).doesNotHaveBean(SessionController::class.java)
      }
  }

  @Test
  fun `local login parsing is strict and authentication failures are read-only and opaque`() {
    val browser = bootstrap()
    val malformedBodies = listOf<String?>(
      null,
      "",
      "{",
      "{}",
      """{"actorKey":null}""",
      """{"actorKey":7}""",
      """{"actorKey":""}""",
      """{"actorKey":"actor-01","extra":true}""",
      """{"actorKey":"actor-01","actorKey":"actor-02"}"""
    )
    malformedBodies.forEach { body ->
      val result = login(browser.session, browser.csrfToken, body)
      assertError(result, 400, "INVALID_REQUEST", "Request body is invalid.")
    }

    listOf("unknown", "ACTOR-01", " actor-01", "actor-01 ", "   ").forEach { actorKey ->
      val result = login(browser.session, browser.csrfToken, """{"actorKey":"$actorKey"}""")
      assertError(
        result,
        401,
        "AUTHENTICATION_FAILED",
        "Local session authentication failed."
      )
    }

    identityTestStore.setUserStatus(LOCAL_SESSION_ACCOUNTANT_ACTOR_ID, "INACTIVE")
    assertError(
      login(
        browser.session,
        browser.csrfToken,
        """{"actorKey":"$LOCAL_SESSION_ACCOUNTANT_ACTOR_KEY"}"""
      ),
      401,
      "AUTHENTICATION_FAILED",
      "Local session authentication failed."
    )
    identityTestStore.setUserStatus(LOCAL_SESSION_ACCOUNTANT_ACTOR_ID, AppUser.ACTIVE_STATUS)
    identityTestStore.setMembershipStatus(LOCAL_SESSION_ACCOUNTANT_ACTOR_ID, TENANT_ID, "INACTIVE")
    assertError(
      login(
        browser.session,
        browser.csrfToken,
        """{"actorKey":"$LOCAL_SESSION_ACCOUNTANT_ACTOR_KEY"}"""
      ),
      401,
      "AUTHENTICATION_FAILED",
      "Local session authentication failed."
    )

    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `login rotates sid and csrf saves the context and me rereads fresh authority`() {
    val anonymous = bootstrap()
    val anonymousSessionId = anonymous.session.id
    val login = login(
      anonymous.session,
      anonymous.csrfToken,
      """{"actorKey":"$LOCAL_SESSION_ACCOUNTANT_ACTOR_KEY"}"""
    )
    assertThat(login.response.status).isEqualTo(204)
    assertThat(login.response.contentAsByteArray).isEmpty()
    assertThat(login.response.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("no-store")

    val authenticatedSession = login.request.getSession(false) as MockHttpSession
    assertThat(authenticatedSession).isSameAs(anonymous.session)
    assertThat(authenticatedSession.id).isNotEqualTo(anonymousSessionId)
    val contextAttribute = Collections.list(authenticatedSession.attributeNames)
      .single { it.contains("SPRING_SECURITY_CONTEXT") }
    val savedContext = authenticatedSession.getAttribute(contextAttribute) as SecurityContextImpl
    val savedAuthentication = savedContext.authentication
    assertThat(savedAuthentication).isInstanceOf(AuthenticatedActorAuthentication::class.java)
    assertThat((savedAuthentication.principal as AuthenticatedActor).actorId)
      .isEqualTo(LOCAL_SESSION_ACCOUNTANT_ACTOR_ID)
    assertThat(Collections.list(authenticatedSession.attributeNames))
      .containsExactly(contextAttribute)

    val rebootstrap = bootstrap(authenticatedSession)
    assertThat(rebootstrap.session.id).isEqualTo(authenticatedSession.id)
    assertThat(rebootstrap.csrfToken).isNotEqualTo(anonymous.csrfToken)
    assertThat(rebootstrap.body.path("sessionState").asText()).isEqualTo("AUTHENTICATED")
    assertThat(rebootstrap.body.has("actors")).isFalse()
    assertThat(Collections.list(authenticatedSession.attributeNames)).hasSize(2)

    val me = mockMvc.perform(get("/api/me").session(authenticatedSession).onLocalTopology())
      .andExpect(status().isOk)
      .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
      .andReturn()
    val meBody = objectMapper.readTree(me.response.contentAsString)
    assertThat(meBody.at("/actor/userId").asText()).isEqualTo(LOCAL_SESSION_ACCOUNTANT_ACTOR_ID.toString())
    assertThat(meBody.path("effectiveRoles").map(JsonNode::asText)).containsExactly("ACCOUNTANT")
    assertThat(me.request.getAttribute(SESSION_CONFLICT_FILTER_INVOCATIONS)).isEqualTo(1)
    assertThat(me.request.getAttribute(SESSION_EXPIRY_FILTER_INVOCATIONS)).isEqualTo(1)
    assertThat(me.request.getAttribute(LOCAL_AUTH_BOUNDARY_FILTER_INVOCATIONS)).isEqualTo(1)
    assertThat(me.request.getAttribute(TENANT_MDC_FILTER_INVOCATION_COUNT_ATTRIBUTE)).isEqualTo(1)
    assertThat(me.request.getAttribute(SESSION_AUTHORITY_FILTER_INVOCATIONS)).isEqualTo(1)
    assertThat(identityTestStore.repositoryCounters())
      .isEqualTo(IdentityRepositoryCounters(0, 4, 4, 0, 0))

    identityTestStore.replaceRoles(
      LOCAL_SESSION_ACCOUNTANT_ACTOR_ID,
      TENANT_ID,
      TenantRole.ADMIN
    )
    mockMvc.perform(get("/api/me").session(authenticatedSession).onLocalTopology())
      .andExpect(status().isOk)
      .andExpect(content().string(org.hamcrest.Matchers.containsString("ADMIN")))

    val invalidTenantBaseline = identityTestStore.repositoryCounters()
    mockMvc.perform(
      get("/api/me")
        .session(authenticatedSession)
        .header("X-Tenant-Id", "not-a-uuid")
        .onLocalTopology()
    )
      .andExpect(status().isBadRequest)
    assertThat(identityTestStore.repositoryCounters()).isEqualTo(invalidTenantBaseline)

    val deniedTenant = mockMvc.perform(
      get("/api/me")
        .session(authenticatedSession)
        .header("X-Tenant-Id", UUID.randomUUID().toString())
        .onLocalTopology()
    ).andReturn()
    assertError(deniedTenant, 403, "ACCESS_DENIED", "Access is denied.")
    assertThat(authenticatedSession.isInvalid).isFalse()
    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `user membership and tenant revocations invalidate the authenticated session`() {
    listOf<(IdentityTestStore) -> Unit>(
      { store -> store.setUserStatus(LOCAL_SESSION_ACCOUNTANT_ACTOR_ID, "INACTIVE") },
      { store -> store.setMembershipStatus(LOCAL_SESSION_ACCOUNTANT_ACTOR_ID, TENANT_ID, "INACTIVE") },
      { store -> store.setTenantStatus(LOCAL_SESSION_ACCOUNTANT_ACTOR_ID, TENANT_ID, "INACTIVE") }
    ).forEachIndexed { index, revoke ->
      if (index > 0) resetFixture()
      val authenticated = authenticatedBrowser()
      revoke(identityTestStore)
      val baseline = identityTestStore.repositoryCounters()

      val result = mockMvc.perform(get("/api/me").session(authenticated.session).onLocalTopology())
        .andReturn()
      assertError(result, 403, "ACCESS_REVOKED", "Access has been revoked.")
      assertThat(authenticated.session.isInvalid).isTrue()
      assertExpiredCookie(result)
      assertThat(identityTestStore.repositoryCounters().actorIdReads)
        .isEqualTo(baseline.actorIdReads + 1)
      assertThat(identityTestStore.repositoryCounters().membershipGrantReads)
        .isEqualTo(baseline.membershipGrantReads + 1)
      assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
    }
  }

  @Test
  fun `repository failures propagate and are never converted into revocation`() {
    val authenticated = authenticatedBrowser()
    identityTestStore.failActorIdReads()

    assertThatThrownBy {
      mockMvc.perform(get("/api/me").session(authenticated.session).onLocalTopology()).andReturn()
    }
      .isExactlyInstanceOf(IllegalStateException::class.java)
      .hasMessage("Synthetic app_user read failure.")
    assertThat(authenticated.session.isInvalid).isFalse()
    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `csrf is header-only and logout clears context session and cookie`() {
    val anonymous = bootstrap()
    val authenticated = authenticatedBrowser(anonymous)

    val oldCsrfResult = mockMvc.perform(
      post("/api/session/logout")
        .session(authenticated.session)
        .header(SESSION_CSRF_HEADER_NAME, anonymous.csrfToken)
        .onLocalTopology(unsafe = true)
    ).andReturn()
    assertError(oldCsrfResult, 403, "CSRF_REJECTED", "CSRF token is invalid.")
    assertThat(authenticated.session.isInvalid).isFalse()

    val parameterOnly = mockMvc.perform(
      post("/api/session/logout")
        .session(authenticated.session)
        .param("_csrf", authenticated.csrfToken)
        .onLocalTopology(unsafe = true)
    ).andReturn()
    assertError(parameterOnly, 403, "CSRF_REJECTED", "CSRF token is invalid.")

    val oldSessionId = authenticated.session.id
    val logout = mockMvc.perform(
      post("/api/session/logout")
        .session(authenticated.session)
        .header(SESSION_CSRF_HEADER_NAME, authenticated.csrfToken)
        .onLocalTopology(unsafe = true)
    )
      .andExpect(status().isNoContent)
      .andExpect(content().string(""))
      .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
      .andReturn()
    assertThat(authenticated.session.isInvalid).isTrue()
    assertExpiredCookie(logout)

    val staleBootstrap = mockMvc.perform(
      get("/api/session/bootstrap")
        .cookie(Cookie(SESSION_COOKIE_NAME, oldSessionId))
        .onLocalTopology()
    ).andReturn()
    assertError(staleBootstrap, 401, "SESSION_EXPIRED", "The session has expired.")
    assertExpiredCookie(staleBootstrap)

    val stale = mockMvc.perform(
      get("/api/me")
        .cookie(Cookie(SESSION_COOKIE_NAME, oldSessionId))
        .onLocalTopology()
    ).andReturn()
    assertError(stale, 401, "SESSION_EXPIRED", "The session has expired.")

    val restarted = bootstrap()
    assertThat(restarted.session.id).isNotEqualTo(oldSessionId)
    assertThat(restarted.csrfToken).isNotEqualTo(authenticated.csrfToken)
  }

  @Test
  fun `already authenticated ambiguous credentials and bearer session requests respect precedence`() {
    val authenticated = authenticatedBrowser()
    val relogin = mockMvc.perform(
      post("/api/session/local")
        .session(authenticated.session)
        .header(SESSION_CSRF_HEADER_NAME, authenticated.csrfToken)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""{"actorKey":"$LOCAL_SESSION_REVIEWER_ACTOR_KEY"}""")
        .onLocalTopology(unsafe = true)
    ).andReturn()
    assertError(
      relogin,
      409,
      "SESSION_ALREADY_AUTHENTICATED",
      "The session is already authenticated."
    )

    val ambiguous = mockMvc.perform(
      get("/api/me")
        .cookie(Cookie(SESSION_COOKIE_NAME, "opaque-cookie"))
        .header(HttpHeaders.AUTHORIZATION, "Bearer opaque-bearer")
    ).andReturn()
    assertError(
      ambiguous,
      400,
      "AMBIGUOUS_CREDENTIALS",
      "Conflicting credentials are not allowed."
    )
    assertThat(ambiguous.request.getAttribute(SESSION_EXPIRY_FILTER_INVOCATIONS)).isNull()

    listOf(
      get("/api/session/bootstrap"),
      post("/api/session/local"),
      post("/api/session/logout")
    ).forEach { builder ->
      val bearer = mockMvc.perform(
        builder.header(HttpHeaders.AUTHORIZATION, "Bearer opaque-bearer")
      ).andReturn()
      assertError(
        bearer,
        400,
        "BEARER_NOT_ALLOWED_FOR_SESSION_ENDPOINT",
        "Bearer authentication is not allowed on session endpoints."
      )
      assertThat(bearer.request.getAttribute(SESSION_EXPIRY_FILTER_INVOCATIONS)).isNull()
    }

    val invalidBearer = mockMvc.perform(
      get("/api/me")
        .header(HttpHeaders.AUTHORIZATION, "Bearer invalid-bearer")
        .onLocalTopology()
    ).andReturn()
    assertError(invalidBearer, 401, "AUTHENTICATION_REQUIRED", "Authentication is required.")
  }

  @Test
  fun `absolute and idle expiry are enforced exactly at their boundaries`() {
    val absoluteSession = DeterministicMockHttpSession(servletContext, BASE_INSTANT)
    val absoluteAuthenticated = authenticatedBrowser(bootstrap(absoluteSession))
    val absoluteBoundary = BASE_INSTANT.plus(Duration.ofHours(8))
    val beforeAbsoluteBoundary = absoluteBoundary.minusNanos(1)
    absoluteSession.setLastAccessedTime(beforeAbsoluteBoundary.minus(Duration.ofMinutes(1)))
    sessionClock.setInstant(beforeAbsoluteBoundary)
    mockMvc.perform(get("/api/me").session(absoluteAuthenticated.session).onLocalTopology())
      .andExpect(status().isOk)

    absoluteSession.setLastAccessedTime(absoluteBoundary.minus(Duration.ofMinutes(1)))
    sessionClock.setInstant(absoluteBoundary)
    val absolute = mockMvc.perform(
      get("/api/me").session(absoluteAuthenticated.session).onLocalTopology()
    )
      .andReturn()
    assertError(absolute, 401, "SESSION_EXPIRED", "The session has expired.")
    assertThat(absoluteAuthenticated.session.isInvalid).isTrue()

    resetFixture()
    val idleSession = DeterministicMockHttpSession(servletContext, BASE_INSTANT)
    val idleAuthenticated = authenticatedBrowser(bootstrap(idleSession))
    val idleBoundary = BASE_INSTANT.plus(Duration.ofMinutes(30))
    idleSession.setLastAccessedTime(BASE_INSTANT)
    sessionClock.setInstant(idleBoundary.minusNanos(1))
    mockMvc.perform(get("/api/me").session(idleAuthenticated.session).onLocalTopology())
      .andExpect(status().isOk)

    idleSession.setLastAccessedTime(BASE_INSTANT)
    sessionClock.setInstant(idleBoundary)
    val idle = mockMvc.perform(get("/api/me").session(idleAuthenticated.session).onLocalTopology())
      .andReturn()
    assertError(idle, 401, "SESSION_EXPIRED", "The session has expired.")
    assertThat(idleAuthenticated.session.isInvalid).isTrue()
  }

  @Test
  fun `firewall rejects semicolon and url session forms before the security chain`() {
    listOf(
      "/api/session/bootstrap;matrix=value",
      "/api/session/bootstrap;jsessionid=leaked-id",
      "/api/session/bootstrap;__Host-ritomer-session=leaked-id"
    ).forEach { path ->
      val result = mockMvc.perform(get(path)).andReturn()
      assertError(result, 400, "REQUEST_REJECTED", "Request rejected.")
      assertThat(result.response.getHeader(HttpHeaders.LOCATION)).isNull()
      assertThat(result.response.contentAsString).doesNotContain("leaked-id")
      assertThat(result.request.getAttribute(SESSION_CONFLICT_FILTER_INVOCATIONS)).isNull()
    }
    listOf(
      "/api/session/local;matrix=value",
      "/api/session/local;jsessionid=leaked-id",
      "/api/session/local;__Host-ritomer-session=leaked-id"
    ).forEach { path ->
      val result = mockMvc.perform(post(path)).andReturn()
      assertError(result, 400, "REQUEST_REJECTED", "Request rejected.")
      assertThat(result.response.getHeader(HttpHeaders.LOCATION)).isNull()
      assertThat(result.response.contentAsString).doesNotContain("leaked-id")
      assertThat(result.request.getAttribute(SESSION_CONFLICT_FILTER_INVOCATIONS)).isNull()
    }
  }

  @Test
  fun `local boundary is exact fail-closed and treats PORT alone as non-probative`() {
    assertThat(boundaryResult().status).isEqualTo(200)
    assertThat(boundaryResult(profiles = arrayOf("local")).status).isEqualTo(200)
    assertThat(boundaryResult(profiles = arrayOf("dbtest")).status).isEqualTo(200)
    assertThat(boundaryResult(extraProperties = mapOf("PORT" to "8080")).status).isEqualTo(200)

    listOf(
      emptyArray(),
      arrayOf("local", "test"),
      arrayOf("dev"),
      arrayOf("prod")
    ).forEach { profiles -> assertThat(boundaryResult(profiles = profiles).status).isEqualTo(403) }
    listOf("localhost", "0.0.0.0", "::", "::1", "192.168.1.10").forEach { address ->
      assertThat(boundaryResult(serverAddress = address).status).isEqualTo(403)
    }
    assertThat(boundaryResult(serverPort = 8081).status).isEqualTo(403)
    assertThat(boundaryResult(requestCustomizer = { it.remoteAddr = "192.168.1.10" }).status)
      .isEqualTo(403)
    assertThat(boundaryResult(requestCustomizer = { it.localAddr = "::1" }).status).isEqualTo(403)
    assertThat(boundaryResult(requestCustomizer = { it.localPort = 8081 }).status).isEqualTo(403)
    assertThat(boundaryResult(effectiveServerName = "localhost").status).isEqualTo(403)
    assertThat(boundaryResult(effectiveServerPort = 8081).status).isEqualTo(403)
    assertThat(boundaryResult(requestCustomizer = { it.removeHeader(HttpHeaders.HOST) }).status).isEqualTo(403)
    assertThat(boundaryResult(requestCustomizer = { it.addHeader(HttpHeaders.HOST, "localhost:8080") }).status)
      .isEqualTo(403)
    assertThat(boundaryResult(requestCustomizer = { it.removeHeader(HttpHeaders.ORIGIN) }).status).isEqualTo(403)
    assertThat(boundaryResult(requestCustomizer = {
      it.removeHeader(HttpHeaders.ORIGIN)
      it.addHeader(HttpHeaders.ORIGIN, "http://localhost:5173")
    }).status).isEqualTo(403)
    assertThat(boundaryResult(requestCustomizer = { it.addHeader("Forwarded", "") }).status).isEqualTo(403)
    assertThat(boundaryResult(requestCustomizer = { it.addHeader("X-Forwarded-For", "") }).status)
      .isEqualTo(403)
    assertThat(boundaryResult(trackingModes = setOf(SessionTrackingMode.URL)).status).isEqualTo(403)
    assertThat(boundaryResult(commandLineOverride = "server.port").status).isEqualTo(403)
    assertThat(boundaryResult(commandLineOverride = "ritomer.security.session.enabled").status).isEqualTo(403)
    assertThat(boundaryResult(commandLineOverride = "ritomer.security.jwt.hmac-secret").status).isEqualTo(403)

    CLOUD_RUN_SESSION_DENY_MARKERS.forEach { marker ->
      assertThat(boundaryResult(extraProperties = mapOf(marker to "")).status)
        .describedAs(marker)
        .isEqualTo(403)
    }
  }

  @Test
  fun `authentication graph is minimal serializable final and cannot be re-elevated`() {
    val actor = AuthenticatedActor(
      actorId = LOCAL_SESSION_ACCOUNTANT_ACTOR_ID,
      authenticationMechanism = AuthenticationMechanism.LOCAL_SESSION,
      authenticatedAt = BASE_INSTANT,
      opaqueAuthCorrelation = "opaque-correlation"
    )
    val authentication = AuthenticatedActorAuthentication.fromValidatedActor(actor)

    assertThat(Modifier.isFinal(authentication.javaClass.modifiers)).isTrue()
    assertThat(authentication.javaClass.interfaces).containsExactly(Authentication::class.java)
    assertThat(authentication.principal).isSameAs(actor)
    assertThat(authentication.credentials).isNull()
    assertThat(authentication.details).isNull()
    assertThat(authentication.authorities).isEmpty()
    assertThat(authentication.name).isEqualTo("opaque-correlation")
    assertThat(authentication.toString()).isEqualTo("AuthenticatedActorAuthentication[REDACTED]")
    assertThat(authentication.isAuthenticated).isTrue()
    assertThatThrownBy {
      @Suppress("UNCHECKED_CAST")
      (authentication.authorities as MutableCollection<org.springframework.security.core.GrantedAuthority>)
        .add(SimpleGrantedAuthority("ROLE_FORBIDDEN"))
    }.isInstanceOfAny(
      UnsupportedOperationException::class.java,
      ClassCastException::class.java
    )

    val trustedRoundTrip = serializeRoundTrip(authentication)
    assertThat(trustedRoundTrip.isAuthenticated).isTrue()
    assertThat(trustedRoundTrip.principal).isEqualTo(actor)
    assertThat(trustedRoundTrip.toString()).doesNotContain(actor.actorId.toString(), actor.opaqueAuthCorrelation)

    authentication.isAuthenticated = false
    authentication.isAuthenticated = false
    assertThat(authentication.isAuthenticated).isFalse()
    assertThatThrownBy { authentication.isAuthenticated = true }
      .isInstanceOf(IllegalArgumentException::class.java)
    val downgradedRoundTrip = serializeRoundTrip(authentication)
    assertThat(downgradedRoundTrip.isAuthenticated).isFalse()
    assertThatThrownBy { downgradedRoundTrip.isAuthenticated = true }
      .isInstanceOf(IllegalArgumentException::class.java)

    val instanceFields = authentication.javaClass.declaredFields
      .filterNot { Modifier.isStatic(it.modifiers) || it.isSynthetic }
      .map { it.name }
    assertThat(instanceFields).containsExactlyInAnyOrder("actor", "trusted")

    val concurrent = AuthenticatedActorAuthentication.fromValidatedActor(actor)
    val start = CountDownLatch(1)
    val rejectedElevations = AtomicInteger()
    val executor = Executors.newFixedThreadPool(2)
    val downgrade = executor.submit {
      start.await()
      repeat(100) { concurrent.isAuthenticated = false }
    }
    val elevation = executor.submit {
      start.await()
      repeat(100) {
        try {
          concurrent.isAuthenticated = true
        } catch (_: IllegalArgumentException) {
          rejectedElevations.incrementAndGet()
        }
      }
    }
    start.countDown()
    downgrade.get(5, TimeUnit.SECONDS)
    elevation.get(5, TimeUnit.SECONDS)
    executor.shutdownNow()
    assertThat(rejectedElevations).hasValue(100)
    assertThat(concurrent.isAuthenticated).isFalse()
  }

  @Test
  fun `five filters have one disabled request registration and exact security order`() {
    val filterTypes: List<Class<out Filter>> = listOf(
      SessionCredentialConflictFilter::class.java,
      SessionExpiryFilter::class.java,
      LocalAuthBoundaryFilter::class.java,
      TenantMdcFilter::class.java,
      SessionAuthorityFreshnessFilter::class.java
    )
    val customFilters: List<Filter> = filterTypes.map { filterType ->
      applicationContext.getBean(filterType)
    }
    filterTypes.forEach { filterType ->
      assertThat(applicationContext.getBeansOfType(filterType)).hasSize(1)
    }

    val registrations = applicationContext.getBeansOfType(FilterRegistrationBean::class.java).values
    customFilters.forEach { filter ->
      val registration = registrations.single { it.filter === filter }
      assertThat(registration.isEnabled).isFalse()
      @Suppress("UNCHECKED_CAST")
      val dispatchers = ReflectionTestUtils.getField(registration, "dispatcherTypes") as Set<DispatcherType>
      assertThat(dispatchers).containsExactly(DispatcherType.REQUEST)
    }

    val chain = filterChainProxy.getFilters("/api/me")
    val expectedOrder = listOf<Class<out Filter>>(
      SecurityContextHolderFilter::class.java,
      SessionCredentialConflictFilter::class.java,
      SessionExpiryFilter::class.java,
      LocalAuthBoundaryFilter::class.java,
      TenantMdcFilter::class.java,
      SessionAuthorityFreshnessFilter::class.java,
      CsrfFilter::class.java,
      LogoutFilter::class.java,
      BearerTokenAuthenticationFilter::class.java,
      AuthorizationFilter::class.java
    )
    val indexes = expectedOrder.map { expected -> chain.indexOfFirst(expected::isInstance) }
    assertThat(indexes).allMatch { it >= 0 }
    assertThat(indexes).isSorted()
    customFilters.forEach { filter -> assertThat(chain.count { it === filter }).isEqualTo(1) }

    val controllerSource = Files.readString(
      Path.of("src/main/kotlin/ch/qamwaq/ritomer/identity/api/SessionController.kt")
    )
    val freshnessSource = Files.readString(
      Path.of("src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SessionSecurityKernel.kt")
    )
    assertThat(controllerSource).doesNotContain(".devtools.", ".shared.infrastructure.")
    assertThat(freshnessSource.substringAfter("class SessionAuthorityFreshnessFilter"))
      .doesNotContain("ch.qamwaq.ritomer.identity")
  }

  @Test
  fun authSessionOpenApiParsesStructurally() {
    val options = LoaderOptions().apply { isAllowDuplicateKeys = false }
    val contractPath = Path.of("..", "contracts", "openapi", "auth-session-api.yaml").normalize()
    val root = Files.newBufferedReader(contractPath).use { reader ->
      @Suppress("UNCHECKED_CAST")
      (Yaml(SafeConstructor(options)).load<Any>(reader) as Map<String, Any?>)
    }
    assertThat(root["openapi"]).isEqualTo("3.1.1")
    assertThat(root["jsonSchemaDialect"]).isEqualTo("https://json-schema.org/draft/2020-12/schema")

    val paths = root.mapValue("paths")
    val expectedOperations = listOf(
      OpenApiOperationExpectation(
        path = "/api/session/bootstrap",
        method = "get",
        operationId = "getSessionBootstrap",
        security = emptyList(),
        responseCodes = setOf("200", "400", "401", "403", "404"),
        successCodes = setOf("200"),
        capability404WithoutBody = true
      ),
      OpenApiOperationExpectation(
        path = "/api/session/local",
        method = "post",
        operationId = "openLocalSession",
        security = listOf(setOf("cookieSession", "csrfToken")),
        responseCodes = setOf("204", "400", "401", "403", "404", "409"),
        successCodes = setOf("204"),
        capability404WithoutBody = true
      ),
      OpenApiOperationExpectation(
        path = "/api/session/logout",
        method = "post",
        operationId = "closeSession",
        security = listOf(setOf("cookieSession", "csrfToken")),
        responseCodes = setOf("204", "400", "401", "403", "404"),
        successCodes = setOf("204"),
        capability404WithoutBody = true
      ),
      OpenApiOperationExpectation(
        path = "/api/me",
        method = "get",
        operationId = "getCurrentActorContext",
        security = listOf(setOf("cookieSession"), setOf("bearerAuth")),
        responseCodes = setOf("200", "400", "401", "403", "404"),
        successCodes = setOf("200")
      )
    )
    assertThat(paths.keys).containsExactlyInAnyOrderElementsOf(expectedOperations.map { it.path })
    expectedOperations.forEach { expected ->
      val pathItem = paths.mapValue(expected.path)
      assertThat(pathItem.keys.toList()).describedAs(expected.path).containsExactly(expected.method)
      val operation = pathItem.mapValue(expected.method)
      assertThat(operation["operationId"]).describedAs(expected.path).isEqualTo(expected.operationId)
      assertThat(operation.securityRequirements()).describedAs(expected.path).isEqualTo(expected.security)

      val responses = operation.mapValue("responses")
      assertThat(responses.keys.toList())
        .describedAs("${expected.method.uppercase()} ${expected.path}")
        .containsExactlyInAnyOrderElementsOf(expected.responseCodes)
      expected.responseCodes.subtract(expected.successCodes).forEach { responseCode ->
        val response = responses.mapValue(responseCode)
        if (responseCode == "404" && expected.capability404WithoutBody) {
          assertThat(response).describedAs("${expected.path} $responseCode").doesNotContainKey("content")
        } else {
          assertThat(
            response.mapValue("content")
              .mapValue("application/json")
              .mapValue("schema")["\$ref"]
          )
            .describedAs("${expected.path} $responseCode")
            .isEqualTo("#/components/schemas/SessionError")
        }
      }
    }
    assertThat(expectedOperations.map { it.operationId }).doesNotHaveDuplicates()

    val components = root.mapValue("components")
    val schemes = components.mapValue("securitySchemes")
    assertThat(schemes.keys).containsExactlyInAnyOrder("cookieSession", "csrfToken", "bearerAuth")
    val cookieSessionScheme = schemes.mapValue("cookieSession")
    assertThat(cookieSessionScheme.keys).containsExactlyInAnyOrder("type", "in", "name", "description")
    assertThat(cookieSessionScheme)
      .containsEntry("type", "apiKey")
      .containsEntry("in", "cookie")
      .containsEntry("name", SESSION_COOKIE_NAME)
    val csrfTokenScheme = schemes.mapValue("csrfToken")
    assertThat(csrfTokenScheme.keys).containsExactlyInAnyOrder("type", "in", "name", "description")
    assertThat(csrfTokenScheme)
      .containsEntry("type", "apiKey")
      .containsEntry("in", "header")
      .containsEntry("name", SESSION_CSRF_HEADER_NAME)
    val bearerScheme = schemes.mapValue("bearerAuth")
    assertThat(bearerScheme.keys)
      .containsExactlyInAnyOrder("type", "scheme", "bearerFormat", "description")
    assertThat(bearerScheme)
      .containsEntry("type", "http")
      .containsEntry("scheme", "bearer")
      .containsEntry("bearerFormat", "JWT")

    val schemas = components.mapValue("schemas")
    listOf(
      "AnonymousSessionBootstrapResponse",
      "AuthenticatedSessionBootstrapResponse",
      "SessionCsrf",
      "LocalSessionActor",
      "LocalSessionLoginRequest",
      "CurrentActorContext",
      "CurrentActor",
      "TenantMembership",
      "ActiveTenant",
      "SessionError"
    ).forEach { schemaName ->
      assertThat(schemas.mapValue(schemaName)["additionalProperties"])
        .describedAs(schemaName)
        .isEqualTo(false)
    }
    assertThat(schemas.mapValue("SessionError")["required"] as List<*>)
      .containsExactlyInAnyOrder("code", "message")
    val sessionErrorProperties = schemas.mapValue("SessionError").mapValue("properties")
    assertThat(sessionErrorProperties.keys).containsExactlyInAnyOrder("code", "message")
    assertThat(sessionErrorProperties.mapValue("code")["\$ref"])
      .isEqualTo("#/components/schemas/SessionErrorCode")
    assertThat(schemas.mapValue("SessionErrorCode")["enum"] as List<*>)
      .containsExactly(
        "INVALID_REQUEST",
        "REQUEST_REJECTED",
        "AUTHENTICATION_FAILED",
        "AUTHENTICATION_REQUIRED",
        "ACCESS_DENIED",
        "CSRF_REJECTED",
        "AMBIGUOUS_CREDENTIALS",
        "BEARER_NOT_ALLOWED_FOR_SESSION_ENDPOINT",
        "SESSION_EXPIRED",
        "SESSION_ALREADY_AUTHENTICATED",
        "ACCESS_REVOKED",
        "INVALID_TENANT_HEADER",
        "NOT_FOUND"
      )

    val references = mutableListOf<String>()
    collectReferences(root, references)
    assertThat(references).allMatch { it.startsWith("#/components/") }
    references.forEach { reference -> assertThat(resolveLocalReference(root, reference)).isNotNull() }

    val raw = Files.readString(contractPath)
    assertThat(raw.substringBefore("/api/me:"))
      .doesNotContain("X-Tenant-Id", "bearerAuth: []")
    assertThat(raw).doesNotContain("actor-01", "actor-02", "actor-03", ACCOUNTANT_SUBJECT)
  }

  private fun seedLocalActor(id: UUID, subject: String, displayName: String, role: TenantRole) {
    identityTestStore.saveUser(
      AppUser(
        id = id,
        externalSubject = subject,
        email = "$subject@example.invalid",
        displayName = displayName,
        status = AppUser.ACTIVE_STATUS
      )
    )
    identityTestStore.seedActiveMembership(
      subject,
      TENANT_ID,
      "tenant-session-test",
      "Tenant Session Test",
      role
    )
  }

  private fun bootstrap(session: MockHttpSession? = null): BrowserState {
    var builder = get("/api/session/bootstrap").onLocalTopology()
    if (session != null) builder = builder.session(session)
    val result = mockMvc.perform(builder)
      .andExpect(status().isOk)
      .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
      .andReturn()
    val rawBody = result.response.contentAsString
    val body = objectMapper.readTree(rawBody)
    return BrowserState(
      session = result.request.getSession(false) as MockHttpSession,
      csrfToken = body.at("/csrf/token").asText(),
      body = body,
      rawBody = rawBody
    )
  }

  private fun authenticatedBrowser(anonymous: BrowserState = bootstrap()): BrowserState {
    val login = login(
      anonymous.session,
      anonymous.csrfToken,
      """{"actorKey":"$LOCAL_SESSION_ACCOUNTANT_ACTOR_KEY"}"""
    )
    assertThat(login.response.status).isEqualTo(204)
    return bootstrap(login.request.getSession(false) as MockHttpSession)
  }

  private fun login(session: MockHttpSession, csrfToken: String, body: String?): MvcResult {
    var builder = post("/api/session/local")
      .session(session)
      .header(SESSION_CSRF_HEADER_NAME, csrfToken)
      .contentType(MediaType.APPLICATION_JSON)
      .onLocalTopology(unsafe = true)
    if (body != null) builder = builder.content(body)
    return mockMvc.perform(builder).andReturn()
  }

  private fun MockHttpServletRequestBuilder.onLocalTopology(
    unsafe: Boolean = false
  ): MockHttpServletRequestBuilder =
    header(HttpHeaders.HOST, LOCAL_HOST).with { request ->
      request.remoteAddr = LOOPBACK
      request.localAddr = LOOPBACK
      request.localPort = LOCAL_BACKEND_PORT
      request.serverName = LOOPBACK
      request.serverPort = LOCAL_BACKEND_PORT
      if (unsafe) request.addHeader(HttpHeaders.ORIGIN, LOCAL_ORIGIN)
      request
    }

  private fun assertError(
    result: MvcResult,
    expectedStatus: Int,
    expectedCode: String,
    expectedMessage: String
  ) {
    assertThat(result.response.status).isEqualTo(expectedStatus)
    assertThat(result.response.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("no-store")
    val body = objectMapper.readTree(result.response.contentAsString)
    assertThat(body.fieldNames().asSequence().toSet()).containsExactlyInAnyOrder("code", "message")
    assertThat(body.path("code").asText()).isEqualTo(expectedCode)
    assertThat(body.path("message").asText()).isEqualTo(expectedMessage)
  }

  private fun assertExpiredCookie(result: MvcResult) {
    val cookies = result.response.getHeaders(HttpHeaders.SET_COOKIE)
      .filter { it.startsWith("$SESSION_COOKIE_NAME=") }
    assertThat(cookies).hasSize(1)
    val cookie = cookies.single()
    assertThat(cookie).contains("Path=/", "Max-Age=0", "Secure", "HttpOnly", "SameSite=Lax")
    assertThat(cookie).doesNotContain("Domain=")
  }

  private fun boundaryResult(
    profiles: Array<String> = arrayOf("test"),
    serverAddress: String = LOOPBACK,
    serverPort: Int = LOCAL_BACKEND_PORT,
    extraProperties: Map<String, Any> = emptyMap(),
    commandLineOverride: String? = null,
    trackingModes: Set<SessionTrackingMode> = setOf(SessionTrackingMode.COOKIE),
    effectiveServerName: String? = null,
    effectiveServerPort: Int? = null,
    requestCustomizer: (MockHttpServletRequest) -> Unit = {}
  ): MockHttpServletResponse {
    val environment = MockEnvironment()
      .withProperty("server.address", serverAddress)
      .withProperty("server.port", serverPort.toString())
    environment.setActiveProfiles(*profiles)
    if (extraProperties.isNotEmpty()) {
      environment.propertySources.addFirst(MapPropertySource("boundary-test", extraProperties))
    }
    if (commandLineOverride != null) {
      environment.propertySources.addFirst(
        MapPropertySource("commandLineArgs", mapOf(commandLineOverride to "test-value"))
      )
    }
    val context = MockServletContext().apply { setSessionTrackingModes(trackingModes) }
    val request = object : MockHttpServletRequest(context, "POST", "/api/session/local") {
      override fun getServerName(): String = effectiveServerName ?: super.getServerName()

      override fun getServerPort(): Int = effectiveServerPort ?: super.getServerPort()
    }.apply {
      remoteAddr = LOOPBACK
      localAddr = LOOPBACK
      localPort = LOCAL_BACKEND_PORT
      serverName = LOOPBACK
      this.serverPort = LOCAL_BACKEND_PORT
      addHeader(HttpHeaders.HOST, LOCAL_HOST)
      addHeader(HttpHeaders.ORIGIN, LOCAL_ORIGIN)
      requestCustomizer(this)
    }
    val response = MockHttpServletResponse()
    LocalAuthBoundaryFilter(environment).doFilter(request, response, MockFilterChain())
    return response
  }

  private fun serializeRoundTrip(
    authentication: AuthenticatedActorAuthentication
  ): AuthenticatedActorAuthentication {
    val bytes = ByteArrayOutputStream().use { output ->
      ObjectOutputStream(output).use { it.writeObject(authentication) }
      output.toByteArray()
    }
    return ObjectInputStream(ByteArrayInputStream(bytes)).use {
      it.readObject() as AuthenticatedActorAuthentication
    }
  }

  @Suppress("UNCHECKED_CAST")
  private fun Map<String, Any?>.mapValue(key: String): Map<String, Any?> =
    getValue(key) as Map<String, Any?>

  @Suppress("UNCHECKED_CAST")
  private fun Map<String, Any?>.securityRequirements(): List<Set<String>> =
    (getValue("security") as List<Map<String, Any?>>).map { it.keys }

  private fun collectReferences(value: Any?, references: MutableList<String>) {
    when (value) {
      is Map<*, *> -> value.forEach { (key, nested) ->
        if (key == "\$ref" && nested is String) references.add(nested)
        collectReferences(nested, references)
      }
      is Iterable<*> -> value.forEach { collectReferences(it, references) }
    }
  }

  private fun resolveLocalReference(root: Map<String, Any?>, reference: String): Any? =
    reference.removePrefix("#/").split('/').fold(root as Any?) { value, segment ->
      (value as? Map<*, *>)?.get(segment)
    }

  private class DeterministicMockHttpSession(
    servletContext: ServletContext,
    creationTime: Instant
  ) : MockHttpSession(servletContext) {
    private val deterministicCreationTime = creationTime.toEpochMilli()
    private var deterministicLastAccessedTime = deterministicCreationTime

    fun setLastAccessedTime(instant: Instant) {
      deterministicLastAccessedTime = instant.toEpochMilli()
    }

    override fun getCreationTime(): Long = deterministicCreationTime

    override fun getLastAccessedTime(): Long = deterministicLastAccessedTime
  }

  private data class BrowserState(
    val session: MockHttpSession,
    val csrfToken: String,
    val body: JsonNode,
    val rawBody: String
  )

  private data class OpenApiOperationExpectation(
    val path: String,
    val method: String,
    val operationId: String,
    val security: List<Set<String>>,
    val responseCodes: Set<String>,
    val successCodes: Set<String>,
    val capability404WithoutBody: Boolean = false
  )

  private companion object {
    val BASE_INSTANT: Instant = Instant.parse("2026-08-27T10:00:00Z")
    val TENANT_ID: UUID = UUID.fromString("11111111-1111-4111-8111-111111111111")
    const val LOOPBACK = "127.0.0.1"
    const val LOCAL_BACKEND_PORT = 8080
    const val LOCAL_HOST = "$LOOPBACK:$LOCAL_BACKEND_PORT"
    const val LOCAL_ORIGIN = "http://127.0.0.1:5173"
    const val ACCOUNTANT_SUBJECT = "session-test-accountant"
    const val REVIEWER_SUBJECT = "session-test-reviewer"
    const val ADMIN_SUBJECT = "session-test-admin"
  }
}

@TestConfiguration(proxyBeanMethods = false)
class SessionTestClockConfiguration {
  @Bean
  @Primary
  fun adjustableSessionClock(): AdjustableSessionClock =
    AdjustableSessionClock(Instant.parse("2026-08-27T10:00:00Z"))
}

class AdjustableSessionClock(initialInstant: Instant) : Clock() {
  @Volatile
  private var currentInstant: Instant = initialInstant

  fun setInstant(instant: Instant) {
    currentInstant = instant
  }

  override fun getZone(): ZoneId = ZoneOffset.UTC

  override fun withZone(zone: ZoneId): Clock =
    if (zone == ZoneOffset.UTC) this else Clock.fixed(currentInstant, zone)

  override fun instant(): Instant = currentInstant
}
