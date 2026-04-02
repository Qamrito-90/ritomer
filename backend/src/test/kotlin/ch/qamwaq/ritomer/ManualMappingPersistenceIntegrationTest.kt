package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.identity.application.AppUserRepository
import ch.qamwaq.ritomer.imports.application.BalanceImportService
import ch.qamwaq.ritomer.mapping.application.MANUAL_MAPPING_CREATED_ACTION
import ch.qamwaq.ritomer.mapping.application.MANUAL_MAPPING_DELETED_ACTION
import ch.qamwaq.ritomer.mapping.application.ManualMappingBadRequestException
import ch.qamwaq.ritomer.mapping.application.ManualMappingRepository
import ch.qamwaq.ritomer.mapping.application.ManualMappingService
import ch.qamwaq.ritomer.mapping.application.ManualMappingUpsertCommand
import java.nio.charset.StandardCharsets
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.context.ActiveProfiles

@SpringBootTest
@ActiveProfiles("dbtest")
@Tag("db-integration")
@EnabledIfEnvironmentVariable(named = "RITOMER_DB_TESTS_ENABLED", matches = "true")
class ManualMappingPersistenceIntegrationTest {
  @Autowired
  private lateinit var jdbcTemplate: JdbcTemplate

  @Autowired
  private lateinit var appUserRepository: AppUserRepository

  @Autowired
  private lateinit var balanceImportService: BalanceImportService

  @Autowired
  private lateinit var manualMappingRepository: ManualMappingRepository

  @Autowired
  private lateinit var manualMappingService: ManualMappingService

  @BeforeEach
  fun resetDatabaseState() {
    jdbcTemplate.execute(
      "truncate table audit_event, manual_mapping, balance_import_line, balance_import, closing_folder, tenant_membership, app_user, tenant cascade"
    )
  }

  @Test
  fun `flyway applies migrations through manual-mapping baseline and creates manual_mapping schema`() {
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

    assertThat(versions).containsSubsequence("1", "2", "3", "4", "5")
    assertThat(tableExists("manual_mapping")).isTrue()
    assertThat(columnExists("manual_mapping", "tenant_id")).isTrue()
    assertThat(columnExists("manual_mapping", "account_code")).isTrue()
    assertThat(uniqueConstraintExists("manual_mapping", "uk_manual_mapping_tenant_closing_account")).isTrue()
    assertThat(foreignKeyExists("manual_mapping", "fk_manual_mapping_closing_folder")).isTrue()
  }

  @Test
  fun `manual mapping persists v2 code with tenant scoping and audit without schema change`() {
    val tenantAlphaId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = UUID.fromString("22222222-2222-2222-2222-222222222222")
    insertTenant(tenantAlphaId, "tenant-alpha", "Tenant Alpha")
    insertTenant(tenantBetaId, "tenant-beta", "Tenant Beta")
    val user = appUserRepository.create("mapping-user", "mapping@example.com", "Mapping User")
    val closingAlphaId = insertClosingFolder(tenantAlphaId)
    val closingBetaId = insertClosingFolder(tenantBetaId)
    val access = access(user.id, tenantAlphaId)

    balanceImportService.create(access, closingAlphaId, csvFile(validCsvV1()))
    manualMappingService.upsert(access, closingAlphaId, ManualMappingUpsertCommand("1000", "BS.ASSET.CASH_AND_EQUIVALENTS"))

    val mappings = manualMappingRepository.findByClosingFolder(tenantAlphaId, closingAlphaId)
    val crossTenantMappings = manualMappingRepository.findByClosingFolder(tenantAlphaId, closingBetaId)
    val projection = manualMappingService.getProjection(access, closingAlphaId)
    val auditActions = manualMappingAuditActions(tenantAlphaId)

    assertThat(mappings).hasSize(1)
    assertThat(mappings.single().accountCode).isEqualTo("1000")
    assertThat(crossTenantMappings).isEmpty()
    assertThat(projection.taxonomyVersion).isEqualTo(2)
    assertThat(projection.latestImportVersion).isEqualTo(1)
    assertThat(projection.summary.total).isEqualTo(2)
    assertThat(projection.summary.mapped).isEqualTo(1)
    assertThat(projection.mappings.single().targetCode).isEqualTo("BS.ASSET.CASH_AND_EQUIVALENTS")
    assertThat(auditActions).containsExactly(MANUAL_MAPPING_CREATED_ACTION)
  }

  @Test
  fun `delete remains allowed after reimport when mapping became stale`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    val user = appUserRepository.create("mapping-user", "mapping@example.com", "Mapping User")
    val closingFolderId = insertClosingFolder(tenantId)
    val access = access(user.id, tenantId)

    balanceImportService.create(access, closingFolderId, csvFile(validCsvV1()))
    manualMappingService.upsert(access, closingFolderId, ManualMappingUpsertCommand("2000", "PL.REVENUE"))
    balanceImportService.create(access, closingFolderId, csvFile(validCsvV2()))

    val projectionBeforeDelete = manualMappingService.getProjection(access, closingFolderId)
    manualMappingService.delete(access, closingFolderId, "2000")
    val projectionAfterDelete = manualMappingService.getProjection(access, closingFolderId)
    val auditActions = manualMappingAuditActions(tenantId)

    assertThat(projectionBeforeDelete.latestImportVersion).isEqualTo(2)
    assertThat(projectionBeforeDelete.mappings).isEmpty()
    assertThat(projectionAfterDelete.mappings).isEmpty()
    assertThat(manualMappingRepository.findByClosingFolder(tenantId, closingFolderId)).isEmpty()
    assertThat(auditActions).containsExactly(MANUAL_MAPPING_CREATED_ACTION, MANUAL_MAPPING_DELETED_ACTION)
  }

  @Test
  fun `invalid upsert rolls back without persisting mapping or audit`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    val user = appUserRepository.create("mapping-user", "mapping@example.com", "Mapping User")
    val closingFolderId = insertClosingFolder(tenantId)
    val access = access(user.id, tenantId)

    balanceImportService.create(access, closingFolderId, csvFile(validCsvV1()))

    assertThatThrownBy {
      manualMappingService.upsert(access, closingFolderId, ManualMappingUpsertCommand("1000", "UNKNOWN"))
    }.isInstanceOf(ManualMappingBadRequestException::class.java)

    assertThat(countRows("manual_mapping")).isZero()
    assertThat(countManualMappingAuditRows(tenantId)).isZero()
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

  private fun uniqueConstraintExists(tableName: String, constraintName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists(
        select 1
        from information_schema.table_constraints
        where table_schema = 'public'
          and table_name = ?
          and constraint_name = ?
          and constraint_type = 'UNIQUE'
      )
      """.trimIndent(),
      Boolean::class.java,
      tableName,
      constraintName
    ) ?: false

  private fun foreignKeyExists(tableName: String, constraintName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists(
        select 1
        from information_schema.table_constraints
        where table_schema = 'public'
          and table_name = ?
          and constraint_name = ?
          and constraint_type = 'FOREIGN KEY'
      )
      """.trimIndent(),
      Boolean::class.java,
      tableName,
      constraintName
    ) ?: false

  private fun countRows(tableName: String): Int =
    jdbcTemplate.queryForObject("select count(*) from $tableName", Int::class.java) ?: 0

  private fun manualMappingAuditActions(tenantId: UUID): List<String> =
    jdbcTemplate.queryForList(
      """
      select action
      from audit_event
      where tenant_id = ?
        and action like 'MANUAL_MAPPING.%'
      order by occurred_at asc, id asc
      """.trimIndent(),
      String::class.java,
      tenantId
    )

  private fun countManualMappingAuditRows(tenantId: UUID): Int =
    jdbcTemplate.queryForObject(
      """
      select count(*)
      from audit_event
      where tenant_id = ?
        and action like 'MANUAL_MAPPING.%'
      """.trimIndent(),
      Int::class.java,
      tenantId
    ) ?: 0

  private fun insertTenant(
    tenantId: UUID,
    tenantSlug: String,
    tenantName: String
  ) {
    jdbcTemplate.update(
      """
      insert into tenant (id, slug, legal_name, status)
      values (?, ?, ?, 'ACTIVE')
      """.trimIndent(),
      tenantId,
      tenantSlug,
      tenantName
    )
  }

  private fun insertClosingFolder(tenantId: UUID): UUID {
    val closingFolderId = UUID.randomUUID()
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
      closingFolderId,
      tenantId,
      "Closing FY24",
      LocalDate.parse("2024-01-01"),
      LocalDate.parse("2024-12-31"),
      "DRAFT",
      null,
      null,
      OffsetDateTime.parse("2025-01-01T00:00:00Z"),
      OffsetDateTime.parse("2025-01-01T00:00:00Z")
    )
    return closingFolderId
  }

  private fun access(userId: UUID, tenantId: UUID): TenantAccessContext =
    TenantAccessContext(
      actorUserId = userId,
      actorSubject = "mapping-user",
      tenantId = tenantId,
      effectiveRoles = setOf("MANAGER")
    )

  private fun csvFile(content: String): MockMultipartFile =
    MockMultipartFile("file", "balance.csv", "text/csv", content.toByteArray(StandardCharsets.UTF_8))

  private fun validCsvV1(): String =
    """
    accountCode,accountLabel,debit,credit
    1000,Cash,100.00,0.00
    2000,Revenue,0.00,100.00
    """.trimIndent()

  private fun validCsvV2(): String =
    """
    accountCode,accountLabel,debit,credit
    1000,Cash,120.00,0.00
    3000,Receivable,0.00,120.00
    """.trimIndent()
}
