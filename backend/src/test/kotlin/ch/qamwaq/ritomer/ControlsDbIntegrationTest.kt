package ch.qamwaq.ritomer

import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dbtest")
@Tag("db-integration")
@EnabledIfEnvironmentVariable(named = "RITOMER_DB_TESTS_ENABLED", matches = "true")
class ControlsDbIntegrationTest {
  @Autowired
  private lateinit var jdbcTemplate: JdbcTemplate

  @Autowired
  private lateinit var mockMvc: MockMvc

  @BeforeEach
  fun resetDatabaseState() {
    jdbcTemplate.execute(
      "truncate table audit_event, manual_mapping, balance_import_line, balance_import, closing_folder, tenant_membership, app_user, tenant cascade"
    )
  }

  @Test
  fun `controls endpoint derives blocked state from real PostgreSQL rows without writing audit`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val userId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    val closingFolderId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    val importId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc")

    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    insertUser(userId, "controls-user")
    insertMembership(userId, tenantId, "ACCOUNTANT")
    insertClosingFolder(closingFolderId, tenantId)
    insertBalanceImport(importId, tenantId, closingFolderId, userId, 1)
    insertBalanceImportLine(importId, tenantId, 3, "2000", "Revenue", "0.00", "100.00")
    insertBalanceImportLine(importId, tenantId, 2, "1000", "Cash", "100.00", "0.00")
    insertManualMapping(tenantId, closingFolderId, userId, "1000", "BS.ASSET")

    val auditBefore = countAuditEvents()

    mockMvc.get("/api/closing-folders/$closingFolderId/controls") {
      header("X-Tenant-Id", tenantId.toString())
      with(actorJwt("controls-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.readiness") { value("BLOCKED") }
      jsonPath("$.latestImportPresent") { value(true) }
      jsonPath("$.latestImportVersion") { value(1) }
      jsonPath("$.mappingSummary.unmapped") { value(1) }
      jsonPath("$.unmappedAccounts[0].accountCode") { value("2000") }
      jsonPath("$.nextAction.code") { value("COMPLETE_MANUAL_MAPPING") }
      jsonPath("$.nextAction.path") { value("/api/closing-folders/$closingFolderId/mappings/manual") }
      jsonPath("$.nextAction.actionable") { value(true) }
    }

    assertThat(countAuditEvents()).isEqualTo(auditBefore)
  }

  private fun countAuditEvents(): Int =
    jdbcTemplate.queryForObject("select count(*) from audit_event", Int::class.java) ?: 0

  private fun insertTenant(tenantId: UUID, tenantSlug: String, tenantName: String) {
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

  private fun insertUser(userId: UUID, externalSubject: String) {
    jdbcTemplate.update(
      """
      insert into app_user (id, external_subject, email, display_name, status)
      values (?, ?, ?, ?, 'ACTIVE')
      """.trimIndent(),
      userId,
      externalSubject,
      "$externalSubject@example.com",
      "Controls User"
    )
  }

  private fun insertMembership(userId: UUID, tenantId: UUID, roleCode: String) {
    jdbcTemplate.update(
      """
      insert into tenant_membership (id, tenant_id, user_id, role_code, status)
      values (?, ?, ?, ?, 'ACTIVE')
      """.trimIndent(),
      UUID.randomUUID(),
      tenantId,
      userId,
      roleCode
    )
  }

  private fun insertClosingFolder(closingFolderId: UUID, tenantId: UUID) {
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
  }

  private fun insertBalanceImport(
    importId: UUID,
    tenantId: UUID,
    closingFolderId: UUID,
    importedByUserId: UUID,
    version: Int
  ) {
    jdbcTemplate.update(
      """
      insert into balance_import (
        id,
        tenant_id,
        closing_folder_id,
        version,
        source_file_name,
        imported_at,
        imported_by_user_id,
        row_count,
        total_debit,
        total_credit
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """.trimIndent(),
      importId,
      tenantId,
      closingFolderId,
      version,
      "seed.csv",
      OffsetDateTime.parse("2025-01-02T00:00:00Z"),
      importedByUserId,
      2,
      java.math.BigDecimal("100.00"),
      java.math.BigDecimal("100.00")
    )
  }

  private fun insertBalanceImportLine(
    importId: UUID,
    tenantId: UUID,
    lineNo: Int,
    accountCode: String,
    accountLabel: String,
    debit: String,
    credit: String
  ) {
    jdbcTemplate.update(
      """
      insert into balance_import_line (
        id,
        tenant_id,
        balance_import_id,
        line_no,
        account_code,
        account_label,
        debit,
        credit
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      """.trimIndent(),
      UUID.randomUUID(),
      tenantId,
      importId,
      lineNo,
      accountCode,
      accountLabel,
      java.math.BigDecimal(debit),
      java.math.BigDecimal(credit)
    )
  }

  private fun insertManualMapping(
    tenantId: UUID,
    closingFolderId: UUID,
    userId: UUID,
    accountCode: String,
    targetCode: String
  ) {
    jdbcTemplate.update(
      """
      insert into manual_mapping (
        id,
        tenant_id,
        closing_folder_id,
        account_code,
        target_code,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      """.trimIndent(),
      UUID.randomUUID(),
      tenantId,
      closingFolderId,
      accountCode,
      targetCode,
      OffsetDateTime.parse("2025-01-02T00:00:00Z"),
      OffsetDateTime.parse("2025-01-02T00:00:00Z"),
      userId,
      userId
    )
  }
}

private fun actorJwt(subject: String) = jwt().jwt { token ->
  token.subject(subject)
}
