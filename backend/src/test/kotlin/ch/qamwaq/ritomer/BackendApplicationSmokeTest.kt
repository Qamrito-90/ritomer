package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.identity.application.IDENTITY_ACTIVE_TENANT_SELECTED_ACTION
import ch.qamwaq.ritomer.identity.application.TENANT_AUDIT_RESOURCE_TYPE
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import ch.qamwaq.ritomer.shared.application.REQUEST_ID_HEADER
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers.nullValue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.annotation.Import
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.context.ActiveProfiles

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class)
class BackendApplicationSmokeTest {
  @Autowired
  private lateinit var mockMvc: MockMvc

  @Autowired
  private lateinit var identityTestStore: IdentityTestStore

  @Autowired
  private lateinit var auditTestStore: AuditTestStore

  @BeforeEach
  fun resetIdentityTestStore() {
    identityTestStore.reset()
    auditTestStore.reset()
  }

  @Test
  fun `context loads`() {
  }

  @Test
  fun `health endpoint is available without authentication`() {
    mockMvc.get("/actuator/health")
      .andExpect {
        status { isOk() }
        jsonPath("$.status") { value("UP") }
      }
  }

  @Test
  fun `api me requires authentication`() {
    mockMvc.get("/api/me")
      .andExpect {
        status { isUnauthorized() }
      }
  }

  @Test
  fun `api me returns 403 without provisioning when sub is missing`() {
    mockMvc.get("/api/me") {
      with(actorJwt(subject = null))
    }.andExpect {
      status { isForbidden() }
    }

    assertThat(identityTestStore.userCount()).isZero()
    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `api me returns 403 without provisioning when sub is blank`() {
    mockMvc.get("/api/me") {
      with(actorJwt(subject = "   "))
    }.andExpect {
      status { isForbidden() }
    }

    assertThat(identityTestStore.userCount()).isZero()
    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `api me provisions actor from sub and returns 403 without active membership`() {
    mockMvc.get("/api/me") {
      with(
        actorJwt(
          subject = "new-user",
          email = "reviewer@example.com",
          preferredUsername = "reviewer"
        )
      )
    }.andExpect {
      status { isForbidden() }
    }

    val provisionedUser = identityTestStore.findUserBySubject("new-user")
    assertThat(provisionedUser).isNotNull
    assertThat(provisionedUser?.email).isEqualTo("reviewer@example.com")
    assertThat(provisionedUser?.displayName).isEqualTo("reviewer")
  }

  @Test
  fun `api me returns 403 for inactive app user without audit`() {
    identityTestStore.seedUser("inactive-user", status = "INACTIVE")

    mockMvc.get("/api/me") {
      with(actorJwt(subject = "inactive-user"))
    }.andExpect {
      status { isForbidden() }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `api me returns persisted memberships and effective roles for a valid actor`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    identityTestStore.seedActiveMembership(
      "user-123",
      tenantId,
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.ACCOUNTANT
    )

    mockMvc.get("/api/me") {
      with(
        actorJwt(
          subject = "user-123",
          email = "reviewer@example.com",
          name = "Reviewer Example"
        )
      )
    }.andExpect {
      status { isOk() }
      jsonPath("$.actor.externalSubject") { value("user-123") }
      jsonPath("$.actor.email") { value("reviewer@example.com") }
      jsonPath("$.actor.displayName") { value("Reviewer Example") }
      jsonPath("$.memberships[0].tenantId") { value(tenantId.toString()) }
      jsonPath("$.memberships[0].tenantSlug") { value("tenant-alpha") }
      jsonPath("$.memberships[0].roles[0]") { value("ACCOUNTANT") }
      jsonPath("$.activeTenant.tenantId") { value(tenantId.toString()) }
      jsonPath("$.effectiveRoles[0]") { value("ACCOUNTANT") }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `api me resolves active tenant from valid header and ignores jwt tenant and role claims`() {
    val tenantAlphaId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = UUID.fromString("33333333-3333-3333-3333-333333333333")
    identityTestStore.seedActiveMembership(
      "user-123",
      tenantAlphaId,
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.ACCOUNTANT
    )
    identityTestStore.seedActiveMembership(
      "user-123",
      tenantBetaId,
      "tenant-beta",
      "Tenant Beta",
      TenantRole.MANAGER
    )

    mockMvc.get("/api/me") {
      header(ACTIVE_TENANT_HEADER, tenantBetaId.toString())
      with(
        actorJwt(
          subject = "user-123",
          extraClaims = mapOf(
            "tenant_id" to tenantAlphaId.toString(),
            "roles" to listOf("ADMIN")
          )
        )
      )
    }.andExpect {
      status { isOk() }
      jsonPath("$.memberships.length()") { value(2) }
      jsonPath("$.activeTenant.tenantId") { value(tenantBetaId.toString()) }
      jsonPath("$.activeTenant.tenantSlug") { value("tenant-beta") }
      jsonPath("$.effectiveRoles.length()") { value(1) }
      jsonPath("$.effectiveRoles[0]") { value("MANAGER") }
    }

    val auditEvents = auditTestStore.auditEvents()
    assertThat(auditEvents).hasSize(1)
    assertThat(auditEvents.single().command.tenantId).isEqualTo(tenantBetaId)
    assertThat(auditEvents.single().command.actorSubject).isEqualTo("user-123")
    assertThat(auditEvents.single().command.actorRoles).containsExactly("MANAGER")
    assertThat(auditEvents.single().command.action).isEqualTo(IDENTITY_ACTIVE_TENANT_SELECTED_ACTION)
    assertThat(auditEvents.single().command.resourceType).isEqualTo(TENANT_AUDIT_RESOURCE_TYPE)
    assertThat(auditEvents.single().command.resourceId).isEqualTo(tenantBetaId.toString())
    assertThat(auditEvents.single().command.metadata)
      .containsEntry("selection_source", ACTIVE_TENANT_HEADER)
    assertThat(auditEvents.single().command.correlation.requestId).isNotBlank()
  }

  @Test
  fun `api me emits exactly one audit event when explicit valid tenant is selected`() {
    val tenantAlphaId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = UUID.fromString("33333333-3333-3333-3333-333333333333")
    identityTestStore.seedActiveMembership(
      "user-456",
      tenantAlphaId,
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.ACCOUNTANT
    )
    identityTestStore.seedActiveMembership(
      "user-456",
      tenantBetaId,
      "tenant-beta",
      "Tenant Beta",
      TenantRole.ADMIN
    )

    mockMvc.get("/api/me") {
      header(ACTIVE_TENANT_HEADER, tenantBetaId.toString())
      header(REQUEST_ID_HEADER, "req-explicit-tenant")
      header("User-Agent", "BackendApplicationSmokeTest")
      with(actorJwt(subject = "user-456"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.activeTenant.tenantId") { value(tenantBetaId.toString()) }
      jsonPath("$.effectiveRoles[0]") { value("ADMIN") }
    }

    val auditEvents = auditTestStore.auditEvents()
    assertThat(auditEvents).hasSize(1)
    assertThat(auditEvents.single().command.correlation.requestId).isEqualTo("req-explicit-tenant")
    assertThat(auditEvents.single().command.correlation.userAgent).isEqualTo("BackendApplicationSmokeTest")
  }

  @Test
  fun `api me returns 400 when X-Tenant-Id is malformed`() {
    identityTestStore.seedActiveMembership(
      "user-123",
      UUID.fromString("11111111-1111-1111-1111-111111111111"),
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.REVIEWER
    )

    mockMvc.get("/api/me") {
      header(ACTIVE_TENANT_HEADER, "not-a-uuid")
      with(actorJwt(subject = "user-123"))
    }.andExpect {
      status { isBadRequest() }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `api me returns 403 when the requested tenant is not in active memberships`() {
    identityTestStore.seedActiveMembership(
      "user-123",
      UUID.fromString("11111111-1111-1111-1111-111111111111"),
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.REVIEWER
    )

    mockMvc.get("/api/me") {
      header(ACTIVE_TENANT_HEADER, "22222222-2222-2222-2222-222222222222")
      with(actorJwt(subject = "user-123"))
    }.andExpect {
      status { isForbidden() }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `api me leaves active tenant null when multiple memberships exist without explicit tenant`() {
    identityTestStore.seedActiveMembership(
      "user-123",
      UUID.fromString("11111111-1111-1111-1111-111111111111"),
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.ACCOUNTANT
    )
    identityTestStore.seedActiveMembership(
      "user-123",
      UUID.fromString("33333333-3333-3333-3333-333333333333"),
      "tenant-beta",
      "Tenant Beta",
      TenantRole.MANAGER
    )

    mockMvc.get("/api/me") {
      with(actorJwt(subject = "user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.memberships.length()") { value(2) }
      jsonPath("$.activeTenant") { value(nullValue()) }
      jsonPath("$.effectiveRoles.length()") { value(0) }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }
}

private fun actorJwt(
  subject: String? = "user-123",
  email: String? = null,
  name: String? = null,
  preferredUsername: String? = null,
  extraClaims: Map<String, Any> = emptyMap()
) = jwt().jwt { token ->
  token.claims { claims ->
    if (subject == null) {
      claims.remove("sub")
    }
  }
  subject?.let { token.subject(it) }
  email?.let { token.claim("email", it) }
  name?.let { token.claim("name", it) }
  preferredUsername?.let { token.claim("preferred_username", it) }
  extraClaims.forEach { (claimName, value) -> token.claim(claimName, value) }
}
