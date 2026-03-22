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
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContext
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import java.time.LocalDate
import java.time.OffsetDateTime
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.dao.DataAccessException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles
import java.util.UUID

@SpringBootTest
@ActiveProfiles("dbtest")
@Tag("db-integration")
@EnabledIfEnvironmentVariable(named = "RITOMER_DB_TESTS_ENABLED", matches = "true")
class PersistenceFoundationIntegrationTest {
  @Autowired
  private lateinit var jdbcTemplate: JdbcTemplate

  @Autowired
  private lateinit var appUserRepository: AppUserRepository

  @Autowired
  private lateinit var tenantMembershipRepository: TenantMembershipRepository

  @Autowired
  private lateinit var auditTrail: AuditTrail

  @Autowired
  private lateinit var closingFolderRepository: ClosingFolderRepository

  @Autowired
  private lateinit var closingFolderService: ClosingFolderService

  @BeforeEach
  fun resetDatabaseState() {
    jdbcTemplate.execute("truncate table audit_event, closing_folder, tenant_membership, app_user, tenant cascade")
  }

  @Test
  fun `spring context uses postgresql for integration tests`() {
    val version = jdbcTemplate.queryForObject("select version()", String::class.java)

    assertThat(version).contains("PostgreSQL")
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

  private fun insertMembership(
    userId: UUID,
    tenantId: UUID,
    roleCode: String,
    status: String = "ACTIVE"
  ) {
    jdbcTemplate.update(
      """
      insert into tenant_membership (id, tenant_id, user_id, role_code, status)
      values (?, ?, ?, ?, ?)
      """.trimIndent(),
      UUID.randomUUID(),
      tenantId,
      userId,
      roleCode,
      status
    )
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
