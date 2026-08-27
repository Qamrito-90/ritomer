package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.closing.application.CLOSING_FOLDER_ARCHIVED_ACTION
import ch.qamwaq.ritomer.closing.application.CLOSING_FOLDER_CREATED_ACTION
import ch.qamwaq.ritomer.closing.application.CLOSING_FOLDER_UPDATED_ACTION
import ch.qamwaq.ritomer.closing.application.ClosingFolderRepository
import ch.qamwaq.ritomer.closing.application.ClosingFolderService
import ch.qamwaq.ritomer.closing.application.CreateClosingFolderCommand
import ch.qamwaq.ritomer.closing.application.FieldPatch
import ch.qamwaq.ritomer.closing.application.PatchClosingFolderCommand
import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.identity.application.IDENTITY_ACTIVE_TENANT_SELECTED_ACTION
import ch.qamwaq.ritomer.identity.application.TENANT_AUDIT_RESOURCE_TYPE
import ch.qamwaq.ritomer.identity.application.AppUserRepository
import ch.qamwaq.ritomer.identity.application.TenantMembershipRepository
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.shared.application.ActorAuthorityFreshness
import ch.qamwaq.ritomer.shared.application.ActorAuthorityFreshnessVerifier
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContext
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import ch.qamwaq.ritomer.testsupport.DisposablePostgresTestDatabase
import ch.qamwaq.ritomer.testsupport.DisposablePostgresTestDatabaseGuardInitializer
import com.nimbusds.jose.jwk.source.ImmutableSecret
import com.nimbusds.jose.proc.SecurityContext
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.temporal.ChronoUnit
import java.util.UUID
import javax.crypto.spec.SecretKeySpec
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.mockito.Mockito.clearInvocations
import org.mockito.Mockito.mockingDetails
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.env.Environment
import org.springframework.dao.DataAccessException
import org.springframework.http.HttpHeaders
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.JwsHeader
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.ContextConfiguration
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.get

@SpringBootTest
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
class PersistenceFoundationIntegrationTest {
  @Autowired
  private lateinit var jdbcTemplate: JdbcTemplate

  @Autowired
  private lateinit var environment: Environment

  @MockitoSpyBean
  private lateinit var appUserRepository: AppUserRepository

  @Autowired
  private lateinit var tenantMembershipRepository: TenantMembershipRepository

  @Autowired
  private lateinit var actorAuthorityFreshnessVerifier: ActorAuthorityFreshnessVerifier

  @Autowired
  private lateinit var auditTrail: AuditTrail

  @Autowired
  private lateinit var closingFolderRepository: ClosingFolderRepository

  @Autowired
  private lateinit var closingFolderService: ClosingFolderService

  @Autowired
  private lateinit var mockMvc: MockMvc

  @BeforeEach
  fun resetDatabaseState() {
    DisposablePostgresTestDatabase.truncateAllCurrentTables(
      jdbcTemplate.dataSource ?: error("DataSource is required for guarded database reset."),
      environment
    )
  }

  @Test
  fun `spring context uses postgresql for integration tests`() {
    val version = jdbcTemplate.queryForObject("select version()", String::class.java)

    assertThat(version).contains("PostgreSQL")
  }

  @Test
  fun `flyway applies migrations from scratch through V3`() {
    val versions = jdbcTemplate.queryForList(
      """
      select version
      from flyway_schema_history
      where success = true
        and version is not null
      order by installed_rank asc
      """.trimIndent(),
      String::class.java
    )

    assertThat(versions).containsSubsequence("1", "2", "3")
  }

  @Test
  fun `flyway creates the core schema`() {
    assertThat(tableExists("tenant")).isTrue()
    assertThat(tableExists("app_user")).isTrue()
    assertThat(tableExists("tenant_membership")).isTrue()
    assertThat(tableExists("closing_folder")).isTrue()
    assertThat(tableExists("audit_event")).isTrue()
  }

  @Test
  fun `tenant scoped tables expose tenant columns and audit correlation metadata`() {
    assertThat(columnExists("tenant_membership", "tenant_id")).isTrue()
    assertThat(columnExists("closing_folder", "tenant_id")).isTrue()
    assertThat(columnExists("closing_folder", "archived_at")).isTrue()
    assertThat(columnExists("audit_event", "tenant_id")).isTrue()
    assertThat(columnExists("audit_event", "ip")).isTrue()
    assertThat(columnExists("audit_event", "user_agent")).isTrue()
    assertThat(columnType("audit_event", "actor_roles")).isEqualTo("jsonb")
    assertThat(columnType("audit_event", "metadata")).isEqualTo("jsonb")
  }

  @Test
  fun `identity jdbc repositories persist users and resolve only active memberships`() {
    val createdUser = appUserRepository.create("db-user", "db-user@example.com", "DB User")
    val updatedUser = appUserRepository.updateProfile(
      createdUser.id,
      "updated@example.com",
      "Updated User"
    )

    val tenantAlphaId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = UUID.fromString("22222222-2222-2222-2222-222222222222")
    val inactiveTenantId = UUID.fromString("33333333-3333-3333-3333-333333333333")
    insertTenant(tenantBetaId, "tenant-beta", "Tenant Beta")
    insertTenant(tenantAlphaId, "tenant-alpha", "Tenant Alpha")
    insertTenant(inactiveTenantId, "tenant-gamma", "Tenant Gamma", status = "INACTIVE")

    insertMembership(updatedUser.id, tenantBetaId, "MANAGER")
    insertMembership(updatedUser.id, tenantAlphaId, "ACCOUNTANT")
    insertMembership(updatedUser.id, inactiveTenantId, "ADMIN")
    insertMembership(updatedUser.id, tenantAlphaId, "REVIEWER", status = "INACTIVE")

    val reloadedUser = appUserRepository.findByExternalSubject("db-user")
    val activeMemberships = tenantMembershipRepository.findActiveMembershipGrants(updatedUser.id)

    assertThat(reloadedUser).isNotNull
    assertThat(reloadedUser?.id).isEqualTo(updatedUser.id)
    assertThat(reloadedUser?.email).isEqualTo("updated@example.com")
    assertThat(reloadedUser?.displayName).isEqualTo("Updated User")
    assertThat(activeMemberships.map { it.tenantSlug to it.role })
      .containsExactly(
        "tenant-alpha" to TenantRole.ACCOUNTANT,
        "tenant-beta" to TenantRole.MANAGER
      )
  }

  @Test
  fun `identity authority reads expose inactive users and observe every database change without auth writes`() {
    val activeUserId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    val inactiveUserId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    val activeTenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val inactiveTenantId = UUID.fromString("22222222-2222-2222-2222-222222222222")
    insertAppUser(activeUserId, "authority-active", status = "ACTIVE")
    insertAppUser(inactiveUserId, "authority-inactive", status = "INACTIVE")
    insertTenant(activeTenantId, "tenant-active", "Tenant Active")
    insertTenant(inactiveTenantId, "tenant-inactive", "Tenant Inactive", status = "INACTIVE")
    val activeMembershipId = insertMembership(activeUserId, activeTenantId, "ACCOUNTANT")
    insertMembership(activeUserId, activeTenantId, "REVIEWER", status = "INACTIVE")
    insertMembership(activeUserId, inactiveTenantId, "ADMIN")
    val rowCountsBeforeAuthReads = identityAuthorityRowCounts()

    assertThat(appUserRepository.findById(activeUserId)?.status).isEqualTo("ACTIVE")
    assertThat(appUserRepository.findById(inactiveUserId)?.status).isEqualTo("INACTIVE")
    assertThat(appUserRepository.findById(UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc"))).isNull()
    assertThat(tenantMembershipRepository.findActiveMembershipGrants(activeUserId).map { it.role })
      .containsExactly(TenantRole.ACCOUNTANT)
    assertThat(actorAuthorityFreshnessVerifier.verifyFreshAuthority(activeUserId))
      .isEqualTo(ActorAuthorityFreshness.ACTIVE)
    assertThat(actorAuthorityFreshnessVerifier.verifyFreshAuthority(inactiveUserId))
      .isEqualTo(ActorAuthorityFreshness.REVOKED)

    jdbcTemplate.update(
      "update tenant_membership set role_code = ? where id = ?",
      "MANAGER",
      activeMembershipId
    )
    assertThat(tenantMembershipRepository.findActiveMembershipGrants(activeUserId).map { it.role })
      .containsExactly(TenantRole.MANAGER)

    jdbcTemplate.update(
      "update tenant_membership set status = ? where id = ?",
      "INACTIVE",
      activeMembershipId
    )
    assertThat(actorAuthorityFreshnessVerifier.verifyFreshAuthority(activeUserId))
      .isEqualTo(ActorAuthorityFreshness.REVOKED)

    jdbcTemplate.update(
      "update tenant_membership set status = ? where id = ?",
      "ACTIVE",
      activeMembershipId
    )
    jdbcTemplate.update(
      "update tenant set status = ? where id = ?",
      "INACTIVE",
      activeTenantId
    )
    assertThat(actorAuthorityFreshnessVerifier.verifyFreshAuthority(activeUserId))
      .isEqualTo(ActorAuthorityFreshness.REVOKED)

    jdbcTemplate.update(
      "update tenant set status = ? where id = ?",
      "ACTIVE",
      activeTenantId
    )
    assertThat(actorAuthorityFreshnessVerifier.verifyFreshAuthority(activeUserId))
      .isEqualTo(ActorAuthorityFreshness.ACTIVE)

    jdbcTemplate.update(
      "update app_user set status = ? where id = ?",
      "INACTIVE",
      activeUserId
    )
    assertThat(appUserRepository.findById(activeUserId)?.status).isEqualTo("INACTIVE")
    assertThat(actorAuthorityFreshnessVerifier.verifyFreshAuthority(activeUserId))
      .isEqualTo(ActorAuthorityFreshness.REVOKED)

    assertThat(identityAuthorityRowCounts()).isEqualTo(rowCountsBeforeAuthReads)
    assertThat(jdbcTemplate.queryForObject("select count(*) from audit_event", Int::class.java)).isZero()
  }

  @Test
  fun `actuator closure and api me use real bearer HTTP without mutating PostgreSQL authority`() {
    assertThat(jdbcTemplate.queryForObject("select version()", String::class.java)).contains("PostgreSQL")

    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val activeUserId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    val inactiveUserId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    val revokedUserId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc")
    insertTenant(tenantId, "authority-tenant", "Authority Tenant")
    insertAppUser(activeUserId, "http-active", status = "ACTIVE")
    insertAppUser(inactiveUserId, "http-inactive", status = "INACTIVE")
    insertAppUser(revokedUserId, "http-revoked", status = "ACTIVE")
    insertMembership(activeUserId, tenantId, "ACCOUNTANT")
    insertMembership(inactiveUserId, tenantId, "MANAGER")
    val revokedMembershipId = insertMembership(
      revokedUserId,
      tenantId,
      "REVIEWER",
      status = "INACTIVE"
    )

    val authorityBeforeRequests = identityAuthoritySnapshot()
    clearInvocations(appUserRepository)

    val configuredKey = configuredSigningKey()
    val wrongSignatureToken = signedCompactBearerToken(
      subject = "http-active",
      signingKey = randomSigningKeyDifferentFrom(configuredKey)
    )
    val activeToken = signedCompactBearerToken("http-active")
    val unknownToken = signedCompactBearerToken("http-unknown")
    val inactiveToken = signedCompactBearerToken("http-inactive")
    val revokedToken = signedCompactBearerToken("http-revoked")

    mockMvc.get("/actuator/prometheus")
      .andExpect {
        status { isUnauthorized() }
      }
      .andReturn()
      .also(::assertNoPrometheusPayload)
    mockMvc.get("/actuator/prometheus") {
      header(HttpHeaders.AUTHORIZATION, "Bearer $wrongSignatureToken")
    }.andExpect {
      status { isUnauthorized() }
    }.andReturn().also(::assertNoPrometheusPayload)

    listOf(activeToken, unknownToken, inactiveToken, revokedToken).forEach { token ->
      mockMvc.get("/actuator/prometheus") {
        header(HttpHeaders.AUTHORIZATION, "Bearer $token")
      }.andExpect {
        status { isNotFound() }
      }.andReturn().also(::assertNoPrometheusPayload)
    }
    assertThat(mockingDetails(appUserRepository).invocations).isEmpty()

    listOf(
      "/actuator/health",
      "/actuator/health/liveness",
      "/actuator/health/readiness",
      "/actuator/info"
    ).forEach { path ->
      mockMvc.get(path)
        .andExpect {
          status { isOk() }
        }
    }

    mockMvc.get("/api/me")
      .andExpect {
        status { isUnauthorized() }
      }
    mockMvc.get("/api/me") {
      header(HttpHeaders.AUTHORIZATION, "Bearer $wrongSignatureToken")
    }.andExpect {
      status { isUnauthorized() }
    }
    mockMvc.get("/api/me") {
      header(HttpHeaders.AUTHORIZATION, "Bearer $activeToken")
    }.andExpect {
      status { isOk() }
      jsonPath("$.actor.externalSubject") { value("http-active") }
    }
    listOf(unknownToken, inactiveToken, revokedToken).forEach { token ->
      mockMvc.get("/api/me") {
        header(HttpHeaders.AUTHORIZATION, "Bearer $token")
      }.andExpect {
        status { isForbidden() }
      }
    }

    val authorityAfterRequests = identityAuthoritySnapshot()
    assertThat(authorityAfterRequests).isEqualTo(authorityBeforeRequests)
    assertThat(
      jdbcTemplate.queryForObject(
        "select count(*) from app_user where external_subject = ?",
        Int::class.java,
        "http-unknown"
      )
    ).isZero()
    assertThat(appUserRepository.findById(activeUserId)?.status).isEqualTo("ACTIVE")
    assertThat(appUserRepository.findById(inactiveUserId)?.status).isEqualTo("INACTIVE")
    assertThat(appUserRepository.findById(revokedUserId)?.status).isEqualTo("ACTIVE")
    assertThat(
      jdbcTemplate.queryForObject(
        "select status from tenant_membership where id = ?",
        String::class.java,
        revokedMembershipId
      )
    ).isEqualTo("INACTIVE")
    assertThat(
      mockingDetails(appUserRepository).invocations
        .map { it.method.name }
        .filter { it == "create" || it == "updateProfile" }
    ).isEmpty()
    assertThat(jdbcTemplate.queryForObject("select count(*) from audit_event", Int::class.java)).isZero()
  }

  @Test
  fun `audit trail appends structured audit_event rows`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    val appUser = appUserRepository.create("audit-user", "audit-user@example.com", "Audit User")

    val auditEventId = auditTrail.append(
      AppendAuditEventCommand(
        tenantId = tenantId,
        actorUserId = appUser.id,
        actorSubject = appUser.externalSubject,
        actorRoles = setOf("MANAGER", "ACCOUNTANT"),
        correlation = AuditCorrelationContext(
          requestId = "req-001",
          traceId = "trace-001",
          ip = "203.0.113.10",
          userAgent = "PersistenceFoundationIntegrationTest"
        ),
        action = IDENTITY_ACTIVE_TENANT_SELECTED_ACTION,
        resourceType = TENANT_AUDIT_RESOURCE_TYPE,
        resourceId = tenantId.toString(),
        metadata = mapOf(
          "selection_source" to "X-Tenant-Id",
          "validated" to true
        )
      )
    )

    val persistedEvent = jdbcTemplate.queryForMap(
      """
      select tenant_id::text as tenant_id,
             actor_user_id::text as actor_user_id,
             actor_subject,
             request_id,
             trace_id,
             ip,
             user_agent,
             action,
             resource_type,
             resource_id,
             actor_roles #>> '{0}' as first_role,
             actor_roles #>> '{1}' as second_role,
             metadata ->> 'selection_source' as selection_source,
             metadata ->> 'validated' as validated
      from audit_event
      where id = ?
      """.trimIndent(),
      auditEventId
    )

    assertThat(persistedEvent["tenant_id"]).isEqualTo(tenantId.toString())
    assertThat(persistedEvent["actor_user_id"]).isEqualTo(appUser.id.toString())
    assertThat(persistedEvent["actor_subject"]).isEqualTo("audit-user")
    assertThat(persistedEvent["request_id"]).isEqualTo("req-001")
    assertThat(persistedEvent["trace_id"]).isEqualTo("trace-001")
    assertThat(persistedEvent["ip"]).isEqualTo("203.0.113.10")
    assertThat(persistedEvent["user_agent"]).isEqualTo("PersistenceFoundationIntegrationTest")
    assertThat(persistedEvent["action"]).isEqualTo(IDENTITY_ACTIVE_TENANT_SELECTED_ACTION)
    assertThat(persistedEvent["resource_type"]).isEqualTo(TENANT_AUDIT_RESOURCE_TYPE)
    assertThat(persistedEvent["resource_id"]).isEqualTo(tenantId.toString())
    assertThat(persistedEvent["first_role"]).isEqualTo("ACCOUNTANT")
    assertThat(persistedEvent["second_role"]).isEqualTo("MANAGER")
    assertThat(persistedEvent["selection_source"]).isEqualTo("X-Tenant-Id")
    assertThat(persistedEvent["validated"]).isEqualTo("true")
  }

  @Test
  fun `V3 hardening constraints reject invalid status and role mutations`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val userId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

    assertThatThrownBy {
      insertTenant(UUID.fromString("99999999-9999-9999-9999-999999999999"), "tenant-invalid", "Tenant Invalid", status = "LOCKED")
    }
      .isInstanceOf(DataAccessException::class.java)

    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    jdbcTemplate.update(
      """
      insert into app_user (id, external_subject, email, display_name, status)
      values (?, ?, ?, ?, ?)
      """.trimIndent(),
      userId,
      "status-user",
      "status-user@example.com",
      "Status User",
      "ACTIVE"
    )
    val membershipId = insertMembership(userId, tenantId, "ACCOUNTANT")

    assertThatThrownBy {
      jdbcTemplate.update(
        """
        update app_user
        set status = ?
        where id = ?
        """.trimIndent(),
        "LOCKED",
        userId
      )
    }
      .isInstanceOf(DataAccessException::class.java)

    assertThatThrownBy {
      jdbcTemplate.update(
        """
        update tenant
        set status = ?
        where id = ?
        """.trimIndent(),
        "LOCKED",
        tenantId
      )
    }
      .isInstanceOf(DataAccessException::class.java)

    assertThatThrownBy {
      insertMembership(userId, tenantId, "AUDITOR")
    }
      .isInstanceOf(DataAccessException::class.java)

    assertThatThrownBy {
      jdbcTemplate.update(
        """
        update tenant_membership
        set status = ?
        where id = ?
        """.trimIndent(),
        "REVOKED",
        membershipId
      )
    }
      .isInstanceOf(DataAccessException::class.java)
  }

  @Test
  fun `audit_event rejects update and delete mutations`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    val appUser = appUserRepository.create("audit-user", "audit-user@example.com", "Audit User")
    val auditEventId = auditTrail.append(
      AppendAuditEventCommand(
        tenantId = tenantId,
        actorUserId = appUser.id,
        actorSubject = appUser.externalSubject,
        actorRoles = setOf("ACCOUNTANT"),
        correlation = AuditCorrelationContext(requestId = "req-002"),
        action = IDENTITY_ACTIVE_TENANT_SELECTED_ACTION,
        resourceType = TENANT_AUDIT_RESOURCE_TYPE,
        resourceId = tenantId.toString()
      )
    )

    assertThatThrownBy {
      jdbcTemplate.update(
        """
        update audit_event
        set action = ?
        where id = ?
        """.trimIndent(),
        "IDENTITY.OTHER_ACTION",
        auditEventId
      )
    }
      .isInstanceOf(DataAccessException::class.java)
      .hasMessageContaining("append-only")

    assertThatThrownBy {
      jdbcTemplate.update(
        """
        delete from audit_event
        where id = ?
        """.trimIndent(),
        auditEventId
      )
    }
      .isInstanceOf(DataAccessException::class.java)
      .hasMessageContaining("append-only")

    val persistedAction = jdbcTemplate.queryForObject(
      """
      select action
      from audit_event
      where id = ?
      """.trimIndent(),
      String::class.java,
      auditEventId
    )
    val auditEventCount = jdbcTemplate.queryForObject(
      "select count(*) from audit_event",
      Int::class.java
    )

    assertThat(persistedAction).isEqualTo(IDENTITY_ACTIVE_TENANT_SELECTED_ACTION)
    assertThat(auditEventCount).isEqualTo(1)
  }

  @Test
  fun `V3 hardening rejects inconsistent closing folder state and null audit request id`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    val appUser = appUserRepository.create("closing-user", "closing-user@example.com", "Closing User")
    val validFolderId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

    assertThatThrownBy {
      jdbcTemplate.update(
        """
        insert into closing_folder (
          id,
          tenant_id,
          name,
          period_start_on,
          period_end_on,
          status,
          archived_at,
          archived_by_user_id,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """.trimIndent(),
        UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
        tenantId,
        "Invalid archived folder",
        LocalDate.parse("2024-01-01"),
        LocalDate.parse("2024-12-31"),
        "ARCHIVED",
        null,
        null,
        OffsetDateTime.parse("2025-01-01T00:00:00Z"),
        OffsetDateTime.parse("2025-01-01T00:00:00Z")
      )
    }
      .isInstanceOf(DataAccessException::class.java)

    jdbcTemplate.update(
      """
      insert into closing_folder (
        id,
        tenant_id,
        name,
        period_start_on,
        period_end_on,
        status,
        archived_at,
        archived_by_user_id,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """.trimIndent(),
      validFolderId,
      tenantId,
      "Valid draft folder",
      LocalDate.parse("2024-01-01"),
      LocalDate.parse("2024-12-31"),
      "DRAFT",
      null,
      null,
      OffsetDateTime.parse("2025-01-01T00:00:00Z"),
      OffsetDateTime.parse("2025-01-01T00:00:00Z")
    )

    assertThatThrownBy {
      jdbcTemplate.update(
        """
        update closing_folder
        set archived_at = ?,
            archived_by_user_id = ?
        where id = ?
        """.trimIndent(),
        OffsetDateTime.parse("2025-02-01T00:00:00Z"),
        appUser.id,
        validFolderId
      )
    }
      .isInstanceOf(DataAccessException::class.java)

    assertThatThrownBy {
      jdbcTemplate.update(
        """
        insert into audit_event (
          id,
          tenant_id,
          actor_user_id,
          actor_subject,
          actor_roles,
          request_id,
          action,
          resource_type,
          resource_id,
          metadata
        ) values (?, ?, ?, ?, cast(? as jsonb), ?, ?, ?, ?, cast(? as jsonb))
        """.trimIndent(),
        UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc"),
        tenantId,
        appUser.id,
        appUser.externalSubject,
        """["ACCOUNTANT"]""",
        null,
        IDENTITY_ACTIVE_TENANT_SELECTED_ACTION,
        TENANT_AUDIT_RESOURCE_TYPE,
        tenantId.toString(),
        """{"selection_source":"X-Tenant-Id"}"""
      )
    }
      .isInstanceOf(DataAccessException::class.java)
  }

  @Test
  fun `closing folder repository always filters by tenant id with deterministic ordering`() {
    val tenantAlphaId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = UUID.fromString("22222222-2222-2222-2222-222222222222")
    insertTenant(tenantAlphaId, "tenant-alpha", "Tenant Alpha")
    insertTenant(tenantBetaId, "tenant-beta", "Tenant Beta")

    closingFolderRepository.create(
      closingFolder(
        id = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        tenantId = tenantAlphaId,
        name = "FY24",
        periodEndOn = LocalDate.parse("2024-12-31"),
        createdAt = OffsetDateTime.parse("2025-01-02T10:00:00Z")
      )
    )
    closingFolderRepository.create(
      closingFolder(
        id = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
        tenantId = tenantAlphaId,
        name = "FY23",
        periodEndOn = LocalDate.parse("2023-12-31"),
        createdAt = OffsetDateTime.parse("2024-01-02T10:00:00Z")
      )
    )
    closingFolderRepository.create(
      closingFolder(
        id = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc"),
        tenantId = tenantBetaId,
        name = "Other Tenant",
        periodEndOn = LocalDate.parse("2025-12-31"),
        createdAt = OffsetDateTime.parse("2026-01-02T10:00:00Z")
      )
    )

    val alphaFolders = closingFolderRepository.findAllByTenantId(tenantAlphaId)

    assertThat(alphaFolders).hasSize(2)
    assertThat(alphaFolders.map { it.name }).containsExactly("FY24", "FY23")
    assertThat(
      closingFolderRepository.findByIdAndTenantId(UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc"), tenantAlphaId)
    ).isNull()
  }

  @Test
  fun `closing service persists create patch archive and writes audit events`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    val appUser = appUserRepository.create("closing-user", "closing-user@example.com", "Closing User")
    val access = TenantAccessContext(
      actorUserId = appUser.id,
      actorSubject = appUser.externalSubject,
      tenantId = tenantId,
      effectiveRoles = setOf("MANAGER")
    )

    val created = closingFolderService.create(
      access,
      CreateClosingFolderCommand(
        name = "FY24",
        periodStartOn = LocalDate.parse("2024-01-01"),
        periodEndOn = LocalDate.parse("2024-12-31"),
        externalRef = "EXT-100"
      )
    )

    val patched = closingFolderService.patch(
      access,
      created.id,
      PatchClosingFolderCommand(
        name = FieldPatch.present("FY24 Updated"),
        externalRef = FieldPatch.present(null)
      )
    )

    val archived = closingFolderService.archive(access, created.id)
    val archivedAgain = closingFolderService.archive(access, created.id)

    val persistedFolder = jdbcTemplate.queryForMap(
      """
      select status,
             archived_at,
             archived_by_user_id::text as archived_by_user_id
      from closing_folder
      where id = ?
      """.trimIndent(),
      created.id
    )

    val persistedAuditActions = jdbcTemplate.queryForList(
      """
      select action
      from audit_event
      where tenant_id = ?
      order by occurred_at asc, id asc
      """.trimIndent(),
      String::class.java,
      tenantId
    )

    assertThat(created.status).isEqualTo(ClosingFolderStatus.DRAFT)
    assertThat(patched.name).isEqualTo("FY24 Updated")
    assertThat(patched.externalRef).isNull()
    assertThat(archived.status).isEqualTo(ClosingFolderStatus.ARCHIVED)
    assertThat(archivedAgain.status).isEqualTo(ClosingFolderStatus.ARCHIVED)
    assertThat(persistedFolder["status"]).isEqualTo("ARCHIVED")
    assertThat(persistedFolder["archived_at"]).isNotNull
    assertThat(persistedFolder["archived_by_user_id"]).isEqualTo(appUser.id.toString())
    assertThat(closingFolderRepository.findByIdAndTenantId(created.id, tenantId)).isNotNull()
    assertThat(persistedAuditActions).containsExactly(
      CLOSING_FOLDER_CREATED_ACTION,
      CLOSING_FOLDER_UPDATED_ACTION,
      CLOSING_FOLDER_ARCHIVED_ACTION
    )
  }

  private fun tableExists(tableName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists(
        select 1
        from information_schema.tables
        where table_schema = 'public' and table_name = ?
      )
      """.trimIndent(),
      Boolean::class.java,
      tableName
    ) ?: false

  private fun columnExists(tableName: String, columnName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists(
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = ?
          and column_name = ?
      )
      """.trimIndent(),
      Boolean::class.java,
      tableName,
      columnName
    ) ?: false

  private fun columnType(tableName: String, columnName: String): String =
    jdbcTemplate.queryForObject(
      """
      select udt_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ?
        and column_name = ?
      """.trimIndent(),
      String::class.java,
      tableName,
      columnName
    ) ?: error("Column $tableName.$columnName not found")

  private fun insertTenant(
    tenantId: UUID,
    tenantSlug: String,
    tenantName: String,
    status: String = "ACTIVE"
  ) {
    jdbcTemplate.update(
      """
      insert into tenant (id, slug, legal_name, status)
      values (?, ?, ?, ?)
      """.trimIndent(),
      tenantId,
      tenantSlug,
      tenantName,
      status
    )
  }

  private fun insertAppUser(
    userId: UUID,
    externalSubject: String,
    status: String
  ) {
    jdbcTemplate.update(
      """
      insert into app_user (id, external_subject, email, display_name, status)
      values (?, ?, ?, ?, ?)
      """.trimIndent(),
      userId,
      externalSubject,
      "$externalSubject@example.test",
      externalSubject,
      status
    )
  }

  private fun identityAuthorityRowCounts(): Map<String, Int> =
    listOf("app_user", "tenant", "tenant_membership", "audit_event")
      .associateWith { tableName ->
        jdbcTemplate.queryForObject("select count(*) from $tableName", Int::class.java)
          ?: error("Missing row count for $tableName")
      }

  private fun identityAuthoritySnapshot(): IdentityAuthoritySnapshot =
    IdentityAuthoritySnapshot(
      appUsers = tableSnapshot("app_user"),
      tenants = tableSnapshot("tenant"),
      memberships = tableSnapshot("tenant_membership"),
      auditEvents = tableSnapshot("audit_event")
    )

  private fun tableSnapshot(tableName: String): List<AuthorityRowSnapshot> =
    jdbcTemplate.query(
      """
      select t.id::text as row_id,
             to_jsonb(t)::text as row_data,
             t.xmin::text as row_version
      from $tableName t
      order by t.id
      """.trimIndent()
    ) { resultSet, _ ->
      AuthorityRowSnapshot(
        id = resultSet.getString("row_id"),
        rowData = resultSet.getString("row_data"),
        rowVersion = resultSet.getString("row_version")
      )
    }

  private fun assertNoPrometheusPayload(result: MvcResult) {
    assertThat(result.response.contentAsString)
      .doesNotContain("# HELP", "# TYPE")
  }

  private fun signedCompactBearerToken(
    subject: String,
    issuedAt: Instant = Instant.now().truncatedTo(ChronoUnit.SECONDS),
    expiresAt: Instant = issuedAt.plusSeconds(DB_JWT_TTL_SECONDS),
    signingKey: ByteArray = configuredSigningKey()
  ): String {
    val encoder = NimbusJwtEncoder(
      ImmutableSecret<SecurityContext>(SecretKeySpec(signingKey, "HmacSHA256"))
    )
    val claims = JwtClaimsSet.builder()
      .subject(subject)
      .issuedAt(issuedAt)
      .expiresAt(expiresAt)
      .id(UUID.randomUUID().toString())
      .build()
    val header = JwsHeader.with(MacAlgorithm.HS256)
      .type("JWT")
      .build()
    return encoder.encode(JwtEncoderParameters.from(header, claims)).tokenValue
  }

  private fun configuredSigningKey(): ByteArray =
    environment.getRequiredProperty("ritomer.security.jwt.hmac-secret")
      .toByteArray(StandardCharsets.UTF_8)

  private fun randomSigningKeyDifferentFrom(configuredSigningKey: ByteArray): ByteArray {
    var candidate: ByteArray
    do {
      candidate = ByteArray(32).also(DB_JWT_SECURE_RANDOM::nextBytes)
    } while (MessageDigest.isEqual(candidate, configuredSigningKey))
    return candidate
  }

  private fun insertMembership(
    userId: UUID,
    tenantId: UUID,
    roleCode: String,
    status: String = "ACTIVE"
  ): UUID {
    val membershipId = UUID.randomUUID()
    jdbcTemplate.update(
      """
      insert into tenant_membership (id, tenant_id, user_id, role_code, status)
      values (?, ?, ?, ?, ?)
      """.trimIndent(),
      membershipId,
      tenantId,
      userId,
      roleCode,
      status
    )
    return membershipId
  }

  private fun closingFolder(
    id: UUID,
    tenantId: UUID,
    name: String,
    periodEndOn: LocalDate,
    createdAt: OffsetDateTime
  ) = ClosingFolder(
    id = id,
    tenantId = tenantId,
    name = name,
    periodStartOn = LocalDate.of(periodEndOn.year, 1, 1),
    periodEndOn = periodEndOn,
    externalRef = null,
    status = ClosingFolderStatus.DRAFT,
    archivedAt = null,
    archivedByUserId = null,
    createdAt = createdAt,
    updatedAt = createdAt
  )
}

private data class IdentityAuthoritySnapshot(
  val appUsers: List<AuthorityRowSnapshot>,
  val tenants: List<AuthorityRowSnapshot>,
  val memberships: List<AuthorityRowSnapshot>,
  val auditEvents: List<AuthorityRowSnapshot>
)

private data class AuthorityRowSnapshot(
  val id: String,
  val rowData: String,
  val rowVersion: String
)

private const val DB_JWT_TTL_SECONDS = 300L
private val DB_JWT_SECURE_RANDOM = SecureRandom()
