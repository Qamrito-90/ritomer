package ch.qamwaq.ritomer.devtools

import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import ch.qamwaq.ritomer.testsupport.DisposablePostgresTestDatabase
import ch.qamwaq.ritomer.testsupport.DisposablePostgresTestDatabaseGuardInitializer
import ch.qamwaq.ritomer.workpapers.application.WORKPAPER_CREATED_ACTION
import ch.qamwaq.ritomer.workpapers.application.WORKPAPER_REVIEW_STATUS_CHANGED_ACTION
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.nimbusds.jose.jwk.source.ImmutableSecret
import com.nimbusds.jose.proc.SecurityContext
import jakarta.servlet.ServletContext
import jakarta.servlet.SessionTrackingMode
import jakarta.servlet.http.Cookie
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.Base64
import java.util.UUID
import javax.crypto.spec.SecretKeySpec
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.env.Environment
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.mock.web.MockHttpSession
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.JwsHeader
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.ContextConfiguration
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import org.springframework.test.web.servlet.request.RequestPostProcessor

@SpringBootTest(
  properties = [
    "ritomer.demo.seed.enabled=true",
    "ritomer.demo.seed.variant=043b-two-actor-pilot",
    "ritomer.security.session.enabled=true",
    "server.address=127.0.0.1",
    "server.port=8080"
  ]
)
@AutoConfigureMockMvc(
  print = MockMvcPrint.NONE,
  printOnlyOnFailure = false
)
@ActiveProfiles("dbtest")
@ContextConfiguration(
  initializers = [
    DisposablePostgresTestDatabaseGuardInitializer::class
  ]
)
@Tag("db-integration")
@EnabledIfEnvironmentVariable(named = "RITOMER_DB_TESTS_ENABLED", matches = "(?i:true)")
class DemoSeedLocalAuthMeDbIntegrationTest {
  @Autowired
  private lateinit var jdbcTemplate: JdbcTemplate

  @Autowired
  private lateinit var demoSeedLocalService: DemoSeedLocalService

  @Autowired
  private lateinit var environment: Environment

  @Autowired
  private lateinit var objectMapper: ObjectMapper

  @Autowired
  private lateinit var mockMvc: MockMvc

  @Autowired
  private lateinit var servletContext: ServletContext

  @BeforeEach
  fun resetDatabaseState() {
    assertThat(servletContext).isSameAs(mockMvc.dispatcherServlet.servletContext)
    servletContext.setSessionTrackingModes(setOf(SessionTrackingMode.COOKIE))
    assertThat(servletContext.effectiveSessionTrackingModes).containsExactly(SessionTrackingMode.COOKIE)

    DisposablePostgresTestDatabase.truncateAllCurrentTables(
      jdbcTemplate.dataSource ?: error("DataSource is required for guarded database reset."),
      environment
    )
    demoSeedLocalService.seed()
    insertPersistentLureTenantDataset()
  }

  @Test
  fun `api me requires authentication even when the session demo seed exists`() {
    mockMvc.get("/api/me")
      .andExpect {
        status { isUnauthorized() }
      }
  }

  @Test
  fun `local sessions resolve all three actors through fresh PostgreSQL authority without writes`() {
    val expectedActors = sessionActorExpectations()
    val before = authenticationTablesSnapshot()

    expectedActors.forEachIndexed { index, expected ->
      val authenticatedSession = authenticateLocalSession(expected.actorKey, assertActorCatalog = index == 0)
      assertSessionMeResponse(authenticatedSession.session, expected.actor)
      logoutLocalSession(authenticatedSession)
    }

    assertThat(authenticationTablesSnapshot()).isEqualTo(before)
  }

  @Test
  fun `unknown local actor fails without any PostgreSQL write`() {
    val bootstrap = bootstrapLocalSession()
    val before = authenticationTablesSnapshot()

    mockMvc.post("/api/session/local") {
      with(localSessionRequest(bootstrap.session))
      header(HttpHeaders.HOST, LOCAL_SESSION_HOST)
      header(HttpHeaders.ORIGIN, LOCAL_SESSION_ORIGIN)
      header(HttpHeaders.COOKIE, sessionCookieHeader(bootstrap.session))
      header(LOCAL_SESSION_CSRF_HEADER, bootstrap.csrfToken)
      contentType = MediaType.APPLICATION_JSON
      content = """{"actorKey":"actor-99"}"""
    }.andExpect {
      status { isUnauthorized() }
      header { string(HttpHeaders.CACHE_CONTROL, "no-store") }
      jsonPath("$.code") { value("AUTHENTICATION_FAILED") }
    }

    assertThat(authenticationTablesSnapshot()).isEqualTo(before)
  }

  @Test
  fun `session authority revocations invalidate user membership and tenant without authentication writes`() {
    val accountant = authenticateLocalSession("actor-01")
    val reviewer = authenticateLocalSession("actor-02")
    val admin = authenticateLocalSession("actor-03")

    assertThat(
      jdbcTemplate.update(
        "update app_user set status = 'INACTIVE', updated_at = current_timestamp where id = ?",
        DemoSeedLocalDataset.userId
      )
    ).isEqualTo(1)
    assertRevokedSessionWithoutAuthenticationWrite(accountant)

    assertThat(
      jdbcTemplate.update(
        "update tenant_membership set status = 'INACTIVE', updated_at = current_timestamp where id = ?",
        DemoSeedLocalDataset.reviewerMembershipId
      )
    ).isEqualTo(1)
    assertRevokedSessionWithoutAuthenticationWrite(reviewer)

    assertThat(
      jdbcTemplate.update(
        "update tenant set status = 'INACTIVE', updated_at = current_timestamp where id = ?",
        DemoSeedLocalDataset.tenantId
      )
    ).isEqualTo(1)
    assertRevokedSessionWithoutAuthenticationWrite(admin)
  }

  @Test
  fun `four claim JWTs without issuer or audience resolve both actors from PostgreSQL`() {
    assertThat(jdbcTemplate.queryForObject("select version()", String::class.java)).contains("PostgreSQL")

    val issuedAt = Instant.now().truncatedTo(ChronoUnit.SECONDS)
    val accountantToken = signedBearerToken(
      subject = DemoSeedLocalDataset.userExternalSubject,
      issuedAt = issuedAt
    )
    val reviewerToken = signedBearerToken(
      subject = DemoSeedLocalDataset.reviewerExternalSubject,
      issuedAt = issuedAt
    )

    val accountantJti = assertExactFourClaimJwt(
      accountantToken,
      DemoSeedLocalDataset.userExternalSubject,
      issuedAt
    )
    val reviewerJti = assertExactFourClaimJwt(
      reviewerToken,
      DemoSeedLocalDataset.reviewerExternalSubject,
      issuedAt
    )
    assertThat(accountantJti).isNotEqualTo(reviewerJti)

    assertMeResponse(
      token = accountantToken,
      expectedUserId = DemoSeedLocalDataset.userId,
      expectedSubject = DemoSeedLocalDataset.userExternalSubject,
      expectedEmail = DemoSeedLocalDataset.userEmail,
      expectedDisplayName = DemoSeedLocalDataset.userDisplayName,
      expectedRole = DemoSeedLocalDataset.membershipRole
    )
    assertMeResponse(
      token = reviewerToken,
      expectedUserId = DemoSeedLocalDataset.reviewerUserId,
      expectedSubject = DemoSeedLocalDataset.reviewerExternalSubject,
      expectedEmail = DemoSeedLocalDataset.reviewerEmail,
      expectedDisplayName = DemoSeedLocalDataset.reviewerDisplayName,
      expectedRole = DemoSeedLocalDataset.reviewerMembershipRole
    )
  }

  @Test
  fun `api me rejects a wrong signature and an expired exact TTL token`() {
    val configuredSigningKey = configuredSigningKey()
    val wrongSignatureToken = signedBearerToken(
      subject = DemoSeedLocalDataset.userExternalSubject,
      signingKey = randomSigningKeyDifferentFrom(configuredSigningKey)
    )
    val expiredIssuedAt = Instant.now().truncatedTo(ChronoUnit.SECONDS).minusSeconds(7_200)
    val expiredToken = signedBearerToken(
      subject = DemoSeedLocalDataset.userExternalSubject,
      issuedAt = expiredIssuedAt,
      expiresAt = expiredIssuedAt.plusSeconds(JWT_TTL_SECONDS)
    )

    mockMvc.get("/api/me") {
      with(bearerRequest(wrongSignatureToken))
    }.andExpect {
      status { isUnauthorized() }
    }

    mockMvc.get("/api/me") {
      with(bearerRequest(expiredToken))
    }.andExpect {
      status { isUnauthorized() }
    }
  }

  @Test
  fun `spoofed claims grant nothing and maker reviewer rails audit the PostgreSQL actors`() {
    val accountantToken = signedBearerToken(DemoSeedLocalDataset.userExternalSubject)
    val reviewerToken = signedBearerToken(DemoSeedLocalDataset.reviewerExternalSubject)
    val spoofedAccountantToken = signedBearerToken(
      subject = DemoSeedLocalDataset.userExternalSubject,
      extraClaims = mapOf(
        "roles" to listOf("ADMIN"),
        "tenant_id" to LURE_TENANT_ID.toString()
      )
    )
    val spoofedPayload = decodeJwtPart(spoofedAccountantToken, JWT_PAYLOAD_PART)
    assertThat(spoofedPayload["roles"].map { it.asText() }).containsExactly("ADMIN")
    assertThat(spoofedPayload["tenant_id"].asText()).isEqualTo(LURE_TENANT_ID.toString())

    assertMeResponse(
      token = spoofedAccountantToken,
      expectedUserId = DemoSeedLocalDataset.userId,
      expectedSubject = DemoSeedLocalDataset.userExternalSubject,
      expectedEmail = DemoSeedLocalDataset.userEmail,
      expectedDisplayName = DemoSeedLocalDataset.userDisplayName,
      expectedRole = DemoSeedLocalDataset.membershipRole
    )

    val closingFolderId = DemoSeedLocalDataset.variant043bTwoActorPilotFolder.closingFolderId
    val workpaperPath = "/api/closing-folders/$closingFolderId/workpapers/$WORKPAPER_ANCHOR_CODE"
    val reviewPath = "$workpaperPath/review-decision"

    mockMvc.put(workpaperPath) {
      with(tenantAndBearerRequest(DemoSeedLocalDataset.tenantId, reviewerToken))
      contentType = MediaType.APPLICATION_JSON
      content = makerReadyForReviewPayload()
    }.andExpect {
      status { isForbidden() }
    }
    assertThat(countWorkpaperBusinessAuditEvents()).isZero()

    mockMvc.put(workpaperPath) {
      with(tenantAndBearerRequest(DemoSeedLocalDataset.tenantId, accountantToken))
      contentType = MediaType.APPLICATION_JSON
      content = makerReadyForReviewPayload()
    }.andExpect {
      status { isCreated() }
      jsonPath("$.anchorCode") { value(WORKPAPER_ANCHOR_CODE) }
      jsonPath("$.workpaper.status") { value("READY_FOR_REVIEW") }
      jsonPath("$.workpaper.createdByUserId") { value(DemoSeedLocalDataset.userId.toString()) }
      jsonPath("$.workpaper.updatedByUserId") { value(DemoSeedLocalDataset.userId.toString()) }
      jsonPath("$.workpaper.reviewedByUserId") { value(null) }
    }
    assertThat(countWorkpaperBusinessAuditEvents()).isEqualTo(1)

    listOf(accountantToken, spoofedAccountantToken).forEach { deniedToken ->
      mockMvc.post(reviewPath) {
        with(tenantAndBearerRequest(DemoSeedLocalDataset.tenantId, deniedToken))
        contentType = MediaType.APPLICATION_JSON
        content = reviewerDecisionPayload()
      }.andExpect {
        status { isForbidden() }
      }
    }
    assertThat(countWorkpaperBusinessAuditEvents()).isEqualTo(1)

    mockMvc.post(reviewPath) {
      with(tenantAndBearerRequest(DemoSeedLocalDataset.tenantId, reviewerToken))
      contentType = MediaType.APPLICATION_JSON
      content = reviewerDecisionPayload()
    }.andExpect {
      status { isOk() }
      jsonPath("$.workpaper.status") { value("REVIEWED") }
      jsonPath("$.workpaper.createdByUserId") { value(DemoSeedLocalDataset.userId.toString()) }
      jsonPath("$.workpaper.updatedByUserId") { value(DemoSeedLocalDataset.reviewerUserId.toString()) }
      jsonPath("$.workpaper.reviewedByUserId") { value(DemoSeedLocalDataset.reviewerUserId.toString()) }
    }

    val persistedWorkpaper = jdbcTemplate.queryForMap(
      """
      select status, created_by_user_id, updated_by_user_id, reviewed_by_user_id
      from workpaper
      where tenant_id = ?
        and closing_folder_id = ?
        and anchor_code = ?
      """.trimIndent(),
      DemoSeedLocalDataset.tenantId,
      closingFolderId,
      WORKPAPER_ANCHOR_CODE
    )
    assertThat(persistedWorkpaper["status"]).isEqualTo("REVIEWED")
    assertThat(persistedWorkpaper["created_by_user_id"]).isEqualTo(DemoSeedLocalDataset.userId)
    assertThat(persistedWorkpaper["updated_by_user_id"]).isEqualTo(DemoSeedLocalDataset.reviewerUserId)
    assertThat(persistedWorkpaper["reviewed_by_user_id"]).isEqualTo(DemoSeedLocalDataset.reviewerUserId)

    assertSingleWorkpaperAudit(
      action = WORKPAPER_CREATED_ACTION,
      expectedActorUserId = DemoSeedLocalDataset.userId,
      expectedActorSubject = DemoSeedLocalDataset.userExternalSubject,
      expectedActorRole = DemoSeedLocalDataset.membershipRole,
      forbiddenActorUserId = DemoSeedLocalDataset.reviewerUserId
    )
    assertSingleWorkpaperAudit(
      action = WORKPAPER_REVIEW_STATUS_CHANGED_ACTION,
      expectedActorUserId = DemoSeedLocalDataset.reviewerUserId,
      expectedActorSubject = DemoSeedLocalDataset.reviewerExternalSubject,
      expectedActorRole = DemoSeedLocalDataset.reviewerMembershipRole,
      forbiddenActorUserId = DemoSeedLocalDataset.userId
    )
    assertThat(countWorkpaperBusinessAuditEvents()).isEqualTo(2)
  }

  @Test
  fun `persistent lure tenant stays inaccessible indistinguishable and unchanged for both actors`() {
    val accountantToken = signedBearerToken(DemoSeedLocalDataset.userExternalSubject)
    val reviewerToken = signedBearerToken(DemoSeedLocalDataset.reviewerExternalSubject)
    val spoofedAccountantToken = signedBearerToken(
      subject = DemoSeedLocalDataset.userExternalSubject,
      extraClaims = mapOf(
        "roles" to listOf("ADMIN"),
        "tenant_id" to LURE_TENANT_ID.toString()
      )
    )

    assertPersistentLureDatasetExistsWithoutActorMemberships()

    listOf(accountantToken, reviewerToken, spoofedAccountantToken).forEach { token ->
      val lureSelection = mockMvc.get("/api/me") {
        header(ACTIVE_TENANT_HEADER, LURE_TENANT_ID.toString())
        with(bearerRequest(token))
      }.andExpect {
        status { isForbidden() }
      }.andReturn()
      val absentSelection = mockMvc.get("/api/me") {
        header(ACTIVE_TENANT_HEADER, ABSENT_TENANT_ID.toString())
        with(bearerRequest(token))
      }.andExpect {
        status { isForbidden() }
      }.andReturn()

      assertOpaqueEquivalentDenial(lureSelection, absentSelection, LURE_TENANT_ID, ABSENT_TENANT_ID)
    }

    listOf(accountantToken, reviewerToken).forEach { token ->
      val lureRead = mockMvc.get("/api/closing-folders/$LURE_CLOSING_FOLDER_ID") {
        with(tenantAndBearerRequest(DemoSeedLocalDataset.tenantId, token))
      }.andExpect {
        status { isNotFound() }
      }.andReturn()
      val absentRead = mockMvc.get("/api/closing-folders/$ABSENT_CLOSING_FOLDER_ID") {
        with(tenantAndBearerRequest(DemoSeedLocalDataset.tenantId, token))
      }.andExpect {
        status { isNotFound() }
      }.andReturn()

      assertOpaqueEquivalentDenial(lureRead, absentRead, LURE_CLOSING_FOLDER_ID, ABSENT_CLOSING_FOLDER_ID)
    }

    val accountantLureMutation = mockMvc.put(
      "/api/closing-folders/$LURE_CLOSING_FOLDER_ID/workpapers/$WORKPAPER_ANCHOR_CODE"
    ) {
      with(tenantAndBearerRequest(DemoSeedLocalDataset.tenantId, accountantToken))
      contentType = MediaType.APPLICATION_JSON
      content = makerReadyForReviewPayload()
    }.andExpect {
      status { isNotFound() }
    }.andReturn()
    val accountantAbsentMutation = mockMvc.put(
      "/api/closing-folders/$ABSENT_CLOSING_FOLDER_ID/workpapers/$WORKPAPER_ANCHOR_CODE"
    ) {
      with(tenantAndBearerRequest(DemoSeedLocalDataset.tenantId, accountantToken))
      contentType = MediaType.APPLICATION_JSON
      content = makerReadyForReviewPayload()
    }.andExpect {
      status { isNotFound() }
    }.andReturn()
    assertOpaqueEquivalentDenial(
      accountantLureMutation,
      accountantAbsentMutation,
      LURE_CLOSING_FOLDER_ID,
      ABSENT_CLOSING_FOLDER_ID
    )

    val reviewerLureMutation = mockMvc.post(
      "/api/closing-folders/$LURE_CLOSING_FOLDER_ID/workpapers/$WORKPAPER_ANCHOR_CODE/review-decision"
    ) {
      with(tenantAndBearerRequest(DemoSeedLocalDataset.tenantId, reviewerToken))
      contentType = MediaType.APPLICATION_JSON
      content = reviewerDecisionPayload()
    }.andExpect {
      status { isNotFound() }
    }.andReturn()
    val reviewerAbsentMutation = mockMvc.post(
      "/api/closing-folders/$ABSENT_CLOSING_FOLDER_ID/workpapers/$WORKPAPER_ANCHOR_CODE/review-decision"
    ) {
      with(tenantAndBearerRequest(DemoSeedLocalDataset.tenantId, reviewerToken))
      contentType = MediaType.APPLICATION_JSON
      content = reviewerDecisionPayload()
    }.andExpect {
      status { isNotFound() }
    }.andReturn()
    assertOpaqueEquivalentDenial(
      reviewerLureMutation,
      reviewerAbsentMutation,
      LURE_CLOSING_FOLDER_ID,
      ABSENT_CLOSING_FOLDER_ID
    )

    assertPersistentLureDatasetExistsWithoutActorMemberships()
    assertThat(
      jdbcTemplate.queryForObject(
        "select count(*) from workpaper where tenant_id = ?",
        Int::class.java,
        LURE_TENANT_ID
      )
    ).isEqualTo(1)
    val unchangedLureWorkpaper = jdbcTemplate.queryForMap(
      """
      select id, note_text, status
      from workpaper
      where tenant_id = ?
        and closing_folder_id = ?
        and anchor_code = ?
      """.trimIndent(),
      LURE_TENANT_ID,
      LURE_CLOSING_FOLDER_ID,
      WORKPAPER_ANCHOR_CODE
    )
    assertThat(unchangedLureWorkpaper["id"]).isEqualTo(LURE_WORKPAPER_ID)
    assertThat(unchangedLureWorkpaper["note_text"]).isEqualTo(LURE_WORKPAPER_NOTE)
    assertThat(unchangedLureWorkpaper["status"]).isEqualTo("READY_FOR_REVIEW")
    assertThat(countWorkpaperBusinessAuditEvents()).isZero()
  }

  private fun assertMeResponse(
    token: String,
    expectedUserId: UUID,
    expectedSubject: String,
    expectedEmail: String,
    expectedDisplayName: String,
    expectedRole: String
  ) {
    val result = mockMvc.get("/api/me") {
      with(bearerRequest(token))
    }.andExpect {
      status { isOk() }
      jsonPath("$.actor.userId") { value(expectedUserId.toString()) }
      jsonPath("$.actor.externalSubject") { value(expectedSubject) }
      jsonPath("$.actor.email") { value(expectedEmail) }
      jsonPath("$.actor.displayName") { value(expectedDisplayName) }
      jsonPath("$.activeTenant.tenantId") { value(DemoSeedLocalDataset.tenantId.toString()) }
      jsonPath("$.activeTenant.tenantSlug") { value(DemoSeedLocalDataset.tenantSlug) }
      jsonPath("$.activeTenant.tenantName") { value(DemoSeedLocalDataset.tenantLegalName) }
      jsonPath("$.effectiveRoles.length()") { value(1) }
      jsonPath("$.effectiveRoles[0]") { value(expectedRole) }
      jsonPath("$.memberships.length()") { value(1) }
      jsonPath("$.memberships[0].tenantId") { value(DemoSeedLocalDataset.tenantId.toString()) }
      jsonPath("$.memberships[0].tenantSlug") { value(DemoSeedLocalDataset.tenantSlug) }
      jsonPath("$.memberships[0].tenantName") { value(DemoSeedLocalDataset.tenantLegalName) }
      jsonPath("$.memberships[0].roles.length()") { value(1) }
      jsonPath("$.memberships[0].roles[0]") { value(expectedRole) }
    }.andReturn()

    assertExactMePayload(
      result = result,
      expectedUserId = expectedUserId,
      expectedSubject = expectedSubject,
      expectedEmail = expectedEmail,
      expectedDisplayName = expectedDisplayName,
      expectedRole = expectedRole
    )
  }

  private fun sessionActorExpectations(): List<LocalSessionActorExpectation> =
    listOf(
      LocalSessionActorExpectation("actor-01", DemoSeedLocalDataset.accountantActor),
      LocalSessionActorExpectation("actor-02", DemoSeedLocalDataset.reviewer043bActor),
      LocalSessionActorExpectation("actor-03", DemoSeedLocalDataset.admin046bActor)
    )

  private fun authenticateLocalSession(
    actorKey: String,
    assertActorCatalog: Boolean = false
  ): AuthenticatedLocalSession {
    val anonymousBootstrap = bootstrapLocalSession()
    assertThat(anonymousBootstrap.payload["sessionState"].asText()).isEqualTo("ANONYMOUS")
    if (assertActorCatalog) {
      assertThat(anonymousBootstrap.payload["actors"].map { it["actorKey"].asText() })
        .containsExactly("actor-01", "actor-02", "actor-03")
      assertThat(anonymousBootstrap.payload["actors"].map { it["displayLabel"].asText() })
        .allSatisfy { label -> assertThat(label).isNotBlank() }
    }
    val anonymousSessionId = anonymousBootstrap.session.id

    val loginResult = mockMvc.post("/api/session/local") {
      with(localSessionRequest(anonymousBootstrap.session))
      header(HttpHeaders.HOST, LOCAL_SESSION_HOST)
      header(HttpHeaders.ORIGIN, LOCAL_SESSION_ORIGIN)
      header(HttpHeaders.COOKIE, sessionCookieHeader(anonymousBootstrap.session))
      header(LOCAL_SESSION_CSRF_HEADER, anonymousBootstrap.csrfToken)
      contentType = MediaType.APPLICATION_JSON
      content = """{"actorKey":"$actorKey"}"""
    }.andExpect {
      status { isNoContent() }
      header { string(HttpHeaders.CACHE_CONTROL, "no-store") }
      content { string("") }
    }.andReturn()
    val rotatedSession = loginResult.request.getSession(false) as? MockHttpSession
      ?: error("A rotated authenticated session is required.")
    assertThat(rotatedSession.id).isNotEqualTo(anonymousSessionId)

    val authenticatedBootstrap = bootstrapLocalSession(rotatedSession)
    assertThat(authenticatedBootstrap.payload["sessionState"].asText()).isEqualTo("AUTHENTICATED")
    assertThat(authenticatedBootstrap.payload.has("actors")).isFalse()
    assertThat(authenticatedBootstrap.csrfToken).isNotEqualTo(anonymousBootstrap.csrfToken)
    return AuthenticatedLocalSession(
      session = authenticatedBootstrap.session,
      csrfToken = authenticatedBootstrap.csrfToken
    )
  }

  private fun bootstrapLocalSession(existingSession: MockHttpSession? = null): LocalSessionBootstrap {
    val result = mockMvc.get("/api/session/bootstrap") {
      with(localSessionTopologyRequest())
      header(HttpHeaders.HOST, LOCAL_SESSION_HOST)
      if (existingSession != null) {
        with(localSessionRequest(existingSession))
        header(HttpHeaders.COOKIE, sessionCookieHeader(existingSession))
      }
    }.andExpect {
      status { isOk() }
      header { string(HttpHeaders.CACHE_CONTROL, "no-store") }
      jsonPath("$.localLoginAvailable") { value(true) }
      jsonPath("$.csrf.headerName") { value(LOCAL_SESSION_CSRF_HEADER) }
    }.andReturn()
    val payload = objectMapper.readTree(result.response.contentAsString)
    val csrfToken = payload["csrf"]?.get("token")?.asText().orEmpty()
    assertThat(csrfToken).isNotBlank()
    val session = result.request.getSession(false) as? MockHttpSession
      ?: error("Session bootstrap must retain a MockHttpSession.")
    return LocalSessionBootstrap(session = session, csrfToken = csrfToken, payload = payload)
  }

  private fun assertSessionMeResponse(session: MockHttpSession, expected: DemoSeedLocalActorDataset) {
    val result = mockMvc.get("/api/me") {
      with(localSessionRequest(session))
      header(HttpHeaders.HOST, LOCAL_SESSION_HOST)
      header(HttpHeaders.COOKIE, sessionCookieHeader(session))
    }.andExpect {
      status { isOk() }
    }.andReturn()
    assertExactMePayload(
      result = result,
      expectedUserId = expected.userId,
      expectedSubject = expected.externalSubject,
      expectedEmail = expected.email,
      expectedDisplayName = expected.displayName,
      expectedRole = expected.membershipRole
    )
  }

  private fun logoutLocalSession(authenticatedSession: AuthenticatedLocalSession) {
    mockMvc.post("/api/session/logout") {
      with(localSessionRequest(authenticatedSession.session))
      header(HttpHeaders.HOST, LOCAL_SESSION_HOST)
      header(HttpHeaders.ORIGIN, LOCAL_SESSION_ORIGIN)
      header(HttpHeaders.COOKIE, sessionCookieHeader(authenticatedSession.session))
      header(LOCAL_SESSION_CSRF_HEADER, authenticatedSession.csrfToken)
    }.andExpect {
      status { isNoContent() }
      header { string(HttpHeaders.CACHE_CONTROL, "no-store") }
      content { string("") }
    }
    assertThat(authenticatedSession.session.isInvalid).isTrue()
  }

  private fun assertRevokedSessionWithoutAuthenticationWrite(authenticatedSession: AuthenticatedLocalSession) {
    val revokedBaseline = authenticationTablesSnapshot()
    mockMvc.get("/api/me") {
      with(localSessionRequest(authenticatedSession.session))
      header(HttpHeaders.HOST, LOCAL_SESSION_HOST)
      header(HttpHeaders.COOKIE, sessionCookieHeader(authenticatedSession.session))
    }.andExpect {
      status { isForbidden() }
      header { string(HttpHeaders.CACHE_CONTROL, "no-store") }
      jsonPath("$.code") { value("ACCESS_REVOKED") }
    }
    assertThat(authenticatedSession.session.isInvalid).isTrue()
    assertThat(authenticationTablesSnapshot()).isEqualTo(revokedBaseline)
  }

  private fun localSessionRequest(session: MockHttpSession): RequestPostProcessor =
    RequestPostProcessor { request ->
      request.setSession(session)
      request.setCookies(
        Cookie(LOCAL_SESSION_COOKIE_NAME, session.id).apply {
          isHttpOnly = true
          secure = true
          path = "/"
        }
      )
      request.remoteAddr = LOCAL_SESSION_ADDRESS
      request.localAddr = LOCAL_SESSION_ADDRESS
      request.localPort = LOCAL_SESSION_PORT
      request.serverName = LOCAL_SESSION_ADDRESS
      request.serverPort = LOCAL_SESSION_PORT
      request
    }

  private fun localSessionTopologyRequest(): RequestPostProcessor =
    RequestPostProcessor { request ->
      request.remoteAddr = LOCAL_SESSION_ADDRESS
      request.localAddr = LOCAL_SESSION_ADDRESS
      request.localPort = LOCAL_SESSION_PORT
      request.serverName = LOCAL_SESSION_ADDRESS
      request.serverPort = LOCAL_SESSION_PORT
      request
    }

  private fun sessionCookieHeader(session: MockHttpSession): String =
    "$LOCAL_SESSION_COOKIE_NAME=${session.id}"

  private fun authenticationTablesSnapshot(): AuthenticationTablesSnapshot =
    AuthenticationTablesSnapshot(
      appUsers = stableAuthenticationRows(
        """
        select xmin::text as row_version, id, external_subject, email, display_name, status,
               created_at, updated_at
        from app_user
        order by id asc
        """.trimIndent()
      ),
      tenants = stableAuthenticationRows(
        """
        select xmin::text as row_version, id, slug, legal_name, status, created_at, updated_at
        from tenant
        order by id asc
        """.trimIndent()
      ),
      memberships = stableAuthenticationRows(
        """
        select xmin::text as row_version, id, tenant_id, user_id, role_code, status,
               created_at, updated_at
        from tenant_membership
        order by id asc
        """.trimIndent()
      ),
      auditEvents = stableAuthenticationRows(
        """
        select xmin::text as row_version, id, tenant_id, occurred_at, actor_user_id, actor_subject,
               actor_roles::text as actor_roles, request_id, trace_id, action, resource_type,
               resource_id, metadata::text as metadata
        from audit_event
        order by id asc
        """.trimIndent()
      )
    )

  private fun stableAuthenticationRows(sql: String): List<Map<String, Any>> =
    jdbcTemplate.queryForList(sql).map { row -> row.toSortedMap() }

  private fun assertExactMePayload(
    result: MvcResult,
    expectedUserId: UUID,
    expectedSubject: String,
    expectedEmail: String,
    expectedDisplayName: String,
    expectedRole: String
  ) {

    val expectedPayload = objectMapper.readTree(
      """
      {
        "actor": {
          "userId": "$expectedUserId",
          "externalSubject": "$expectedSubject",
          "email": "$expectedEmail",
          "displayName": "$expectedDisplayName"
        },
        "memberships": [
          {
            "tenantId": "${DemoSeedLocalDataset.tenantId}",
            "tenantSlug": "${DemoSeedLocalDataset.tenantSlug}",
            "tenantName": "${DemoSeedLocalDataset.tenantLegalName}",
            "roles": ["$expectedRole"]
          }
        ],
        "activeTenant": {
          "tenantId": "${DemoSeedLocalDataset.tenantId}",
          "tenantSlug": "${DemoSeedLocalDataset.tenantSlug}",
          "tenantName": "${DemoSeedLocalDataset.tenantLegalName}"
        },
        "effectiveRoles": ["$expectedRole"]
      }
      """.trimIndent()
    )
    assertThat(objectMapper.readTree(result.response.contentAsString)).isEqualTo(expectedPayload)
  }

  private fun assertExactFourClaimJwt(token: String, expectedSubject: String, issuedAt: Instant): String {
    val header = decodeJwtPart(token, JWT_HEADER_PART)
    val payload = decodeJwtPart(token, JWT_PAYLOAD_PART)

    assertThat(header.isObject).isTrue()
    assertThat(header.size()).isEqualTo(2)
    assertThat(header.fieldNames().asSequence().toSet()).containsExactlyInAnyOrder("alg", "typ")
    assertThat(header["alg"].asText()).isEqualTo("HS256")
    assertThat(header["typ"].asText()).isEqualTo("JWT")

    assertThat(payload.isObject).isTrue()
    assertThat(payload.size()).isEqualTo(4)
    assertThat(payload.fieldNames().asSequence().toSet()).containsExactlyInAnyOrder("sub", "iat", "exp", "jti")
    assertThat(payload["sub"].asText()).isEqualTo(expectedSubject)
    assertThat(payload["iat"].isIntegralNumber).isTrue()
    assertThat(payload["exp"].isIntegralNumber).isTrue()
    assertThat(payload["iat"].asLong()).isEqualTo(issuedAt.epochSecond)
    assertThat(payload["exp"].asLong()).isEqualTo(issuedAt.epochSecond + JWT_TTL_SECONDS)
    assertThat(payload["exp"].asLong() - payload["iat"].asLong()).isEqualTo(JWT_TTL_SECONDS)
    val jti = payload["jti"].asText()
    assertThat(UUID.fromString(jti).toString()).isEqualTo(jti)
    return jti
  }

  private fun assertSingleWorkpaperAudit(
    action: String,
    expectedActorUserId: UUID,
    expectedActorSubject: String,
    expectedActorRole: String,
    forbiddenActorUserId: UUID
  ) {
    val rows = jdbcTemplate.queryForList(
      """
      select actor_user_id, actor_subject, actor_roles::text as actor_roles
      from audit_event
      where tenant_id = ?
        and action = ?
      """.trimIndent(),
      DemoSeedLocalDataset.tenantId,
      action
    )

    assertThat(rows).hasSize(1)
    assertThat(rows.single()["actor_user_id"]).isEqualTo(expectedActorUserId)
    assertThat(rows.single()["actor_user_id"]).isNotEqualTo(forbiddenActorUserId)
    assertThat(rows.single()["actor_subject"]).isEqualTo(expectedActorSubject)
    assertThat(rows.single()["actor_roles"]).isEqualTo("[\"$expectedActorRole\"]")
    assertThat(rows.single()["actor_roles"].toString()).doesNotContain("ADMIN")
  }

  private fun countWorkpaperBusinessAuditEvents(): Int =
    jdbcTemplate.queryForObject(
      """
      select count(*)
      from audit_event
      where action in (?, ?)
      """.trimIndent(),
      Int::class.java,
      WORKPAPER_CREATED_ACTION,
      WORKPAPER_REVIEW_STATUS_CHANGED_ACTION
    ) ?: 0

  private fun assertOpaqueEquivalentDenial(
    lureResult: MvcResult,
    absentResult: MvcResult,
    lureId: UUID,
    absentId: UUID
  ) {
    assertThat(lureResult.response.status).isEqualTo(absentResult.response.status)
    assertThat(lureResult.resolvedException?.javaClass).isEqualTo(absentResult.resolvedException?.javaClass)
    assertThat(normalizeDenialMessage(lureResult.resolvedException?.message, lureId))
      .isEqualTo(normalizeDenialMessage(absentResult.resolvedException?.message, absentId))
    assertThat(normalizeDenialMessage(lureResult.response.errorMessage, lureId))
      .isEqualTo(normalizeDenialMessage(absentResult.response.errorMessage, absentId))
    assertThat(normalizeDenialMessage(lureResult.response.contentAsString, lureId))
      .isEqualTo(normalizeDenialMessage(absentResult.response.contentAsString, absentId))
    assertNoLureBusinessPayload(lureResult.response.contentAsString)
    assertNoLureBusinessPayload(absentResult.response.contentAsString)
  }

  private fun normalizeDenialMessage(message: String?, requestedId: UUID): String? =
    message?.replace(requestedId.toString(), "<opaque-id>")

  private fun assertNoLureBusinessPayload(payload: String) {
    assertThat(payload).doesNotContain(
      LURE_TENANT_SLUG,
      LURE_TENANT_NAME,
      LURE_CLOSING_FOLDER_NAME,
      LURE_CLOSING_FOLDER_EXTERNAL_REF,
      LURE_SOURCE_FILE_NAME,
      LURE_ACCOUNT_LABEL,
      LURE_WORKPAPER_ANCHOR_LABEL,
      LURE_WORKPAPER_NOTE
    )
  }

  private fun assertPersistentLureDatasetExistsWithoutActorMemberships() {
    val lureFolder = jdbcTemplate.queryForMap(
      """
      select tenant_id, name, external_ref, status
      from closing_folder
      where id = ?
      """.trimIndent(),
      LURE_CLOSING_FOLDER_ID
    )
    val lureImport = jdbcTemplate.queryForMap(
      """
      select tenant_id, closing_folder_id, source_file_name, row_count
      from balance_import
      where id = ?
      """.trimIndent(),
      LURE_BALANCE_IMPORT_ID
    )
    val lureLine = jdbcTemplate.queryForMap(
      """
      select tenant_id, balance_import_id, account_code, account_label, debit, credit
      from balance_import_line
      where id = ?
      """.trimIndent(),
      LURE_BALANCE_IMPORT_LINE_ID
    )
    val lureWorkpaper = jdbcTemplate.queryForMap(
      """
      select tenant_id, closing_folder_id, anchor_code, anchor_label, summary_bucket_code,
             statement_kind, breakdown_type, note_text, status, review_comment,
             basis_import_version, basis_taxonomy_version, created_by_user_id,
             updated_by_user_id, reviewed_at, reviewed_by_user_id
      from workpaper
      where id = ?
      """.trimIndent(),
      LURE_WORKPAPER_ID
    )
    val lureMembershipsForActors = jdbcTemplate.queryForObject(
      """
      select count(*)
      from tenant_membership
      where tenant_id = ?
        and user_id in (?, ?, ?)
      """.trimIndent(),
      Int::class.java,
      LURE_TENANT_ID,
      DemoSeedLocalDataset.userId,
      DemoSeedLocalDataset.reviewerUserId,
      DemoSeedLocalDataset.adminUserId
    )

    assertThat(lureFolder["tenant_id"]).isEqualTo(LURE_TENANT_ID)
    assertThat(lureFolder["name"]).isEqualTo(LURE_CLOSING_FOLDER_NAME)
    assertThat(lureFolder["external_ref"]).isEqualTo(LURE_CLOSING_FOLDER_EXTERNAL_REF)
    assertThat(lureFolder["status"]).isEqualTo("DRAFT")
    assertThat(lureImport["tenant_id"]).isEqualTo(LURE_TENANT_ID)
    assertThat(lureImport["closing_folder_id"]).isEqualTo(LURE_CLOSING_FOLDER_ID)
    assertThat(lureImport["source_file_name"]).isEqualTo(LURE_SOURCE_FILE_NAME)
    assertThat(lureImport["row_count"]).isEqualTo(1)
    assertThat(lureLine["tenant_id"]).isEqualTo(LURE_TENANT_ID)
    assertThat(lureLine["balance_import_id"]).isEqualTo(LURE_BALANCE_IMPORT_ID)
    assertThat(lureLine["account_code"]).isEqualTo("LURE-1000")
    assertThat(lureLine["account_label"]).isEqualTo(LURE_ACCOUNT_LABEL)
    assertThat(lureWorkpaper["tenant_id"]).isEqualTo(LURE_TENANT_ID)
    assertThat(lureWorkpaper["closing_folder_id"]).isEqualTo(LURE_CLOSING_FOLDER_ID)
    assertThat(lureWorkpaper["anchor_code"]).isEqualTo(WORKPAPER_ANCHOR_CODE)
    assertThat(lureWorkpaper["anchor_label"]).isEqualTo(LURE_WORKPAPER_ANCHOR_LABEL)
    assertThat(lureWorkpaper["summary_bucket_code"]).isEqualTo("BS.ASSET")
    assertThat(lureWorkpaper["statement_kind"]).isEqualTo("BALANCE_SHEET")
    assertThat(lureWorkpaper["breakdown_type"]).isEqualTo("SECTION")
    assertThat(lureWorkpaper["note_text"]).isEqualTo(LURE_WORKPAPER_NOTE)
    assertThat(lureWorkpaper["status"]).isEqualTo("READY_FOR_REVIEW")
    assertThat(lureWorkpaper["review_comment"]).isNull()
    assertThat(lureWorkpaper["basis_import_version"]).isEqualTo(1)
    assertThat(lureWorkpaper["basis_taxonomy_version"]).isEqualTo(2)
    assertThat(lureWorkpaper["created_by_user_id"]).isEqualTo(LURE_OWNER_USER_ID)
    assertThat(lureWorkpaper["updated_by_user_id"]).isEqualTo(LURE_OWNER_USER_ID)
    assertThat(lureWorkpaper["reviewed_at"]).isNull()
    assertThat(lureWorkpaper["reviewed_by_user_id"]).isNull()
    assertThat(lureMembershipsForActors).isZero()
  }

  private fun insertPersistentLureTenantDataset() {
    jdbcTemplate.update(
      """
      insert into tenant (id, slug, legal_name, status)
      values (?, ?, ?, 'ACTIVE')
      """.trimIndent(),
      LURE_TENANT_ID,
      LURE_TENANT_SLUG,
      LURE_TENANT_NAME
    )
    jdbcTemplate.update(
      """
      insert into app_user (id, external_subject, email, display_name, status)
      values (?, ?, ?, ?, 'ACTIVE')
      """.trimIndent(),
      LURE_OWNER_USER_ID,
      LURE_OWNER_SUBJECT,
      "lure.owner.043b@example.invalid",
      "Lure Owner 043b"
    )
    jdbcTemplate.update(
      """
      insert into closing_folder (
        id, tenant_id, name, period_start_on, period_end_on, external_ref, status,
        archived_at, archived_by_user_id
      ) values (?, ?, ?, date '2025-01-01', date '2025-12-31', ?, 'DRAFT', null, null)
      """.trimIndent(),
      LURE_CLOSING_FOLDER_ID,
      LURE_TENANT_ID,
      LURE_CLOSING_FOLDER_NAME,
      LURE_CLOSING_FOLDER_EXTERNAL_REF
    )
    jdbcTemplate.update(
      """
      insert into balance_import (
        id, tenant_id, closing_folder_id, version, source_file_name, imported_at,
        imported_by_user_id, row_count, total_debit, total_credit
      ) values (?, ?, ?, 1, ?, current_timestamp, ?, 1, 42.00, 42.00)
      """.trimIndent(),
      LURE_BALANCE_IMPORT_ID,
      LURE_TENANT_ID,
      LURE_CLOSING_FOLDER_ID,
      LURE_SOURCE_FILE_NAME,
      LURE_OWNER_USER_ID
    )
    jdbcTemplate.update(
      """
      insert into balance_import_line (
        id, tenant_id, balance_import_id, line_no, account_code, account_label, debit, credit
      ) values (?, ?, ?, 1, 'LURE-1000', ?, 42.00, 42.00)
      """.trimIndent(),
      LURE_BALANCE_IMPORT_LINE_ID,
      LURE_TENANT_ID,
      LURE_BALANCE_IMPORT_ID,
      LURE_ACCOUNT_LABEL
    )
    jdbcTemplate.update(
      """
      insert into workpaper (
        id, tenant_id, closing_folder_id, anchor_code, anchor_label, summary_bucket_code,
        statement_kind, breakdown_type, note_text, status, review_comment,
        basis_import_version, basis_taxonomy_version, created_at, created_by_user_id,
        updated_at, updated_by_user_id, reviewed_at, reviewed_by_user_id
      ) values (
        ?, ?, ?, ?, ?, 'BS.ASSET', 'BALANCE_SHEET', 'SECTION', ?, 'READY_FOR_REVIEW', null,
        1, 2, current_timestamp, ?, current_timestamp, ?, null, null
      )
      """.trimIndent(),
      LURE_WORKPAPER_ID,
      LURE_TENANT_ID,
      LURE_CLOSING_FOLDER_ID,
      WORKPAPER_ANCHOR_CODE,
      LURE_WORKPAPER_ANCHOR_LABEL,
      LURE_WORKPAPER_NOTE,
      LURE_OWNER_USER_ID,
      LURE_OWNER_USER_ID
    )
  }

  private fun makerReadyForReviewPayload(): String =
    """
    {
      "noteText":"Synthetic 043b cash tie-out",
      "status":"READY_FOR_REVIEW",
      "evidences":[]
    }
    """.trimIndent()

  private fun reviewerDecisionPayload(): String =
    """{"decision":"REVIEWED","comment":null}"""

  private fun bearerRequest(token: String): RequestPostProcessor =
    RequestPostProcessor { request ->
      request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer $token")
      request
    }

  private fun tenantAndBearerRequest(tenantId: UUID, token: String): RequestPostProcessor =
    RequestPostProcessor { request ->
      request.addHeader(ACTIVE_TENANT_HEADER, tenantId.toString())
      request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer $token")
      request
    }

  private fun signedBearerToken(
    subject: String,
    issuedAt: Instant = Instant.now().truncatedTo(ChronoUnit.SECONDS),
    expiresAt: Instant = issuedAt.plusSeconds(JWT_TTL_SECONDS),
    jti: String = UUID.randomUUID().toString(),
    extraClaims: Map<String, Any> = emptyMap(),
    signingKey: ByteArray = configuredSigningKey()
  ): String {
    require(extraClaims.keys.none { it in JWT_EXACT_CLAIM_NAMES })
    val secretKey = SecretKeySpec(signingKey, "HmacSHA256")
    val encoder = NimbusJwtEncoder(ImmutableSecret<SecurityContext>(secretKey))
    val claims = JwtClaimsSet.builder()
      .subject(subject)
      .issuedAt(issuedAt)
      .expiresAt(expiresAt)
      .id(jti)
      .apply {
        extraClaims.forEach { (name, value) -> claim(name, value) }
      }
      .build()
    val header = JwsHeader.with(MacAlgorithm.HS256)
      .type("JWT")
      .build()

    return encoder.encode(JwtEncoderParameters.from(header, claims)).tokenValue
  }

  private fun configuredSigningKey(): ByteArray =
    environment.getRequiredProperty("ritomer.security.jwt.hmac-secret").toByteArray(StandardCharsets.UTF_8)

  private fun randomSigningKeyDifferentFrom(configuredSigningKey: ByteArray): ByteArray {
    var candidate: ByteArray
    do {
      candidate = ByteArray(32).also(SECURE_RANDOM::nextBytes)
    } while (MessageDigest.isEqual(candidate, configuredSigningKey))
    return candidate
  }

  private fun decodeJwtPart(token: String, partIndex: Int): JsonNode {
    val parts = token.split('.')
    require(parts.size == 3)
    return objectMapper.readTree(Base64.getUrlDecoder().decode(parts[partIndex]))
  }

  private data class LocalSessionActorExpectation(
    val actorKey: String,
    val actor: DemoSeedLocalActorDataset
  )

  private data class LocalSessionBootstrap(
    val session: MockHttpSession,
    val csrfToken: String,
    val payload: JsonNode
  )

  private data class AuthenticatedLocalSession(
    val session: MockHttpSession,
    val csrfToken: String
  )

  private data class AuthenticationTablesSnapshot(
    val appUsers: List<Map<String, Any>>,
    val tenants: List<Map<String, Any>>,
    val memberships: List<Map<String, Any>>,
    val auditEvents: List<Map<String, Any>>
  )

  companion object {
    private const val JWT_TTL_SECONDS = 3_600L
    private const val JWT_HEADER_PART = 0
    private const val JWT_PAYLOAD_PART = 1
    private val JWT_EXACT_CLAIM_NAMES = setOf("sub", "iat", "exp", "jti")
    private val SECURE_RANDOM = SecureRandom()

    private const val LOCAL_SESSION_COOKIE_NAME = "__Host-ritomer-session"
    private const val LOCAL_SESSION_CSRF_HEADER = "X-CSRF-TOKEN"
    private const val LOCAL_SESSION_ADDRESS = "127.0.0.1"
    private const val LOCAL_SESSION_PORT = 8080
    private const val LOCAL_SESSION_HOST = "127.0.0.1:8080"
    private const val LOCAL_SESSION_ORIGIN = "http://127.0.0.1:5173"

    private const val WORKPAPER_ANCHOR_CODE = "BS.ASSET.CURRENT_SECTION"

    private val LURE_TENANT_ID = UUID.fromString("043b9000-0000-4000-8000-000000000001")
    private const val LURE_TENANT_SLUG = "ritomer-lure-043b"
    private const val LURE_TENANT_NAME = "Lure Tenant 043b Confidential Marker"
    private val LURE_OWNER_USER_ID = UUID.fromString("043b9000-0000-4000-8000-000000000002")
    private const val LURE_OWNER_SUBJECT = "ritomer-lure-owner-043b"
    private val LURE_CLOSING_FOLDER_ID = UUID.fromString("043b9000-0000-4000-8000-000000000004")
    private const val LURE_CLOSING_FOLDER_NAME = "Lure Closing 043b Confidential Marker"
    private const val LURE_CLOSING_FOLDER_EXTERNAL_REF = "LURE-043B-CONFIDENTIAL"
    private val LURE_BALANCE_IMPORT_ID = UUID.fromString("043b9000-0000-4000-8000-000000000005")
    private const val LURE_SOURCE_FILE_NAME = "lure-043b-confidential.csv"
    private val LURE_BALANCE_IMPORT_LINE_ID = UUID.fromString("043b9000-0000-4000-8000-000000000101")
    private const val LURE_ACCOUNT_LABEL = "Lure 043b confidential account"
    private val LURE_WORKPAPER_ID = UUID.fromString("043b9000-0000-4000-8000-000000000006")
    private const val LURE_WORKPAPER_ANCHOR_LABEL = "Lure 043b confidential workpaper anchor"
    private const val LURE_WORKPAPER_NOTE = "Lure 043b confidential workpaper"

    private val ABSENT_TENANT_ID = UUID.fromString("043b9000-0000-4000-8000-000000009991")
    private val ABSENT_CLOSING_FOLDER_ID = UUID.fromString("043b9000-0000-4000-8000-000000009992")
  }
}
