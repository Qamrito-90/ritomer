package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import ch.qamwaq.ritomer.shared.infrastructure.persistence.JdbcAuditTrail
import ch.qamwaq.ritomer.workpapers.application.WORKPAPER_CREATED_ACTION
import ch.qamwaq.ritomer.workpapers.application.WORKPAPER_REVIEW_STATUS_CHANGED_ACTION
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dbtest")
@Import(WorkpapersDbIntegrationTestConfig::class)
@Tag("db-integration")
@EnabledIfEnvironmentVariable(named = "RITOMER_DB_TESTS_ENABLED", matches = "true")
class WorkpapersDbIntegrationTest {
  @Autowired
  private lateinit var jdbcTemplate: JdbcTemplate

  @Autowired
  private lateinit var mockMvc: MockMvc

  @Autowired
  private lateinit var rollbackAwareAuditTrail: RollbackAwareAuditTrail

  @BeforeEach
  fun resetDatabaseState() {
    jdbcTemplate.execute(
      "truncate table audit_event, workpaper_evidence, workpaper, manual_mapping, balance_import_line, balance_import, closing_folder, tenant_membership, app_user, tenant cascade"
    )
  }

  @Test
  fun `flyway applies migrations from scratch through V7 and keeps workpaper schema intact`() {
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

    assertThat(versions).containsExactly("1", "2", "3", "4", "5", "6", "7")
    assertThat(tableExists("workpaper")).isTrue()
    assertThat(tableExists("workpaper_evidence")).isTrue()
    assertThat(tableExists("document")).isTrue()
    assertThat(uniqueConstraintExists("workpaper", "uk_workpaper_tenant_closing_anchor")).isTrue()
    assertThat(foreignKeyExists("workpaper", "fk_workpaper_closing_folder")).isTrue()
    assertThat(foreignKeyExists("workpaper_evidence", "fk_workpaper_evidence_workpaper")).isTrue()
    assertThat(indexExists("workpaper", "idx_workpaper_tenant_closing_anchor")).isTrue()
    assertThat(indexExists("workpaper", "idx_workpaper_tenant_status")).isTrue()
    assertThat(indexExists("workpaper_evidence", "idx_workpaper_evidence_tenant_workpaper_position")).isTrue()
  }

  @Test
  fun `workpaper persists evidences audits mutations and get stays silent`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val userId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    val closingFolderId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    val importId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc")

    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    insertUser(userId, "workpaper-user")
    insertMembership(userId, tenantId, "MANAGER")
    insertClosingFolder(closingFolderId, tenantId)
    insertBalanceImport(importId, tenantId, closingFolderId, userId, 2, 2, "100.00", "100.00")
    insertBalanceImportLine(importId, tenantId, 2, "1000", "Cash", "100.00", "0.00")
    insertBalanceImportLine(importId, tenantId, 3, "3000", "Revenue", "0.00", "100.00")
    insertManualMapping(tenantId, closingFolderId, userId, "1000", "BS.ASSET.CASH_AND_EQUIVALENTS")
    insertManualMapping(tenantId, closingFolderId, userId, "3000", "PL.REVENUE.OPERATING_REVENUE")

    val auditBefore = countAuditEvents()

    mockMvc.get("/api/closing-folders/$closingFolderId/workpapers") {
      header("X-Tenant-Id", tenantId.toString())
      with(actorJwt("workpaper-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.items.length()") { value(2) }
      jsonPath("$.summaryCounts.withWorkpaperCount") { value(0) }
    }

    assertThat(countAuditEvents()).isEqualTo(auditBefore)

    mockMvc.put("/api/closing-folders/$closingFolderId/workpapers/BS.ASSET.CURRENT_SECTION") {
      header("X-Tenant-Id", tenantId.toString())
      contentType = org.springframework.http.MediaType.APPLICATION_JSON
      content = """
        {
          "noteText":" Cash tie-out ",
          "status":"READY_FOR_REVIEW",
          "evidences":[
            {
              "position":2,
              "fileName":" bank.csv ",
              "mediaType":"TEXT/CSV",
              "sourceLabel":" Bank portal ",
              "verificationStatus":"VERIFIED",
              "externalReference":" bank://42 ",
              "checksumSha256":"ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789"
            },
            {
              "position":1,
              "fileName":" invoice.pdf ",
              "mediaType":"APPLICATION/PDF",
              "sourceLabel":" ERP ",
              "verificationStatus":"UNVERIFIED"
            }
          ]
        }
      """.trimIndent()
      with(actorJwt("workpaper-user"))
    }.andExpect {
      status { isCreated() }
      jsonPath("$.workpaper.status") { value("READY_FOR_REVIEW") }
      jsonPath("$.workpaper.evidences[0].position") { value(1) }
      jsonPath("$.workpaper.evidences[1].mediaType") { value("text/csv") }
    }

    val auditAfterCreate = countAuditEvents()
    assertThat(auditAfterCreate).isEqualTo(auditBefore + 1)
    assertThat(auditActions()).containsExactly(WORKPAPER_CREATED_ACTION)

    val workpaperRows = jdbcTemplate.queryForList(
      """
      select anchor_code, note_text, status, basis_import_version, basis_taxonomy_version
      from workpaper
      where tenant_id = ?
      """.trimIndent(),
      tenantId
    )
    assertThat(workpaperRows).hasSize(1)
    assertThat(workpaperRows.single()["anchor_code"]).isEqualTo("BS.ASSET.CURRENT_SECTION")
    assertThat(workpaperRows.single()["note_text"]).isEqualTo("Cash tie-out")
    assertThat(workpaperRows.single()["status"]).isEqualTo("READY_FOR_REVIEW")
    assertThat(workpaperRows.single()["basis_import_version"]).isEqualTo(2)
    assertThat(workpaperRows.single()["basis_taxonomy_version"]).isEqualTo(2)

    val evidenceRows = jdbcTemplate.queryForList(
      """
      select position, file_name, media_type, source_label, external_reference, checksum_sha256
      from workpaper_evidence
      order by position asc
      """.trimIndent(),
    )
    assertThat(evidenceRows).hasSize(2)
    assertThat(evidenceRows[0]["position"]).isEqualTo(1)
    assertThat(evidenceRows[0]["file_name"]).isEqualTo("invoice.pdf")
    assertThat(evidenceRows[0]["media_type"]).isEqualTo("application/pdf")
    assertThat(evidenceRows[1]["position"]).isEqualTo(2)
    assertThat(evidenceRows[1]["source_label"]).isEqualTo("Bank portal")
    assertThat(evidenceRows[1]["external_reference"]).isEqualTo("bank://42")
    assertThat(evidenceRows[1]["checksum_sha256"]).isEqualTo("abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789")

    mockMvc.get("/api/closing-folders/$closingFolderId/workpapers") {
      header("X-Tenant-Id", tenantId.toString())
      with(actorJwt("workpaper-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.summaryCounts.withWorkpaperCount") { value(1) }
    }

    assertThat(countAuditEvents()).isEqualTo(auditAfterCreate)

    mockMvc.post("/api/closing-folders/$closingFolderId/workpapers/BS.ASSET.CURRENT_SECTION/review-decision") {
      header("X-Tenant-Id", tenantId.toString())
      contentType = org.springframework.http.MediaType.APPLICATION_JSON
      content = """{"decision":"CHANGES_REQUESTED","comment":"Need tie-out details"}"""
      with(actorJwt("workpaper-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.workpaper.status") { value("CHANGES_REQUESTED") }
      jsonPath("$.workpaper.reviewComment") { value("Need tie-out details") }
    }

    assertThat(auditActions()).containsExactly(WORKPAPER_CREATED_ACTION, WORKPAPER_REVIEW_STATUS_CHANGED_ACTION)
  }

  @Test
  fun `workpaper becomes stale after remapping and invalid request leaves no rows`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val userId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    val closingFolderId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    val importId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc")

    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    insertUser(userId, "workpaper-user")
    insertMembership(userId, tenantId, "MANAGER")
    insertClosingFolder(closingFolderId, tenantId)
    insertBalanceImport(importId, tenantId, closingFolderId, userId, 2, 2, "100.00", "100.00")
    insertBalanceImportLine(importId, tenantId, 2, "1000", "Cash", "100.00", "0.00")
    insertBalanceImportLine(importId, tenantId, 3, "3000", "Revenue", "0.00", "100.00")
    insertManualMapping(tenantId, closingFolderId, userId, "1000", "BS.ASSET.CASH_AND_EQUIVALENTS")
    insertManualMapping(tenantId, closingFolderId, userId, "3000", "PL.REVENUE.OPERATING_REVENUE")

    mockMvc.put("/api/closing-folders/$closingFolderId/workpapers/BS.ASSET.CURRENT_SECTION") {
      header("X-Tenant-Id", tenantId.toString())
      contentType = org.springframework.http.MediaType.APPLICATION_JSON
      content = """{"noteText":"Cash tie-out","status":"DRAFT","evidences":[]}"""
      with(actorJwt("workpaper-user"))
    }.andExpect { status { isCreated() } }

    jdbcTemplate.update(
      """
      update manual_mapping
      set target_code = 'BS.ASSET'
      where tenant_id = ?
        and closing_folder_id = ?
        and account_code = '1000'
      """.trimIndent(),
      tenantId,
      closingFolderId
    )

    mockMvc.get("/api/closing-folders/$closingFolderId/workpapers") {
      header("X-Tenant-Id", tenantId.toString())
      with(actorJwt("workpaper-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.items[0].anchorCode") { value("BS.ASSET.LEGACY_BUCKET_FALLBACK") }
      jsonPath("$.staleWorkpapers[0].anchorCode") { value("BS.ASSET.CURRENT_SECTION") }
      jsonPath("$.staleWorkpapers[0].isCurrentStructure") { value(false) }
    }

    val auditBeforeInvalid = countAuditEvents()
    mockMvc.put("/api/closing-folders/$closingFolderId/workpapers/BS.ASSET.LEGACY_BUCKET_FALLBACK") {
      header("X-Tenant-Id", tenantId.toString())
      contentType = org.springframework.http.MediaType.APPLICATION_JSON
      content = """
        {
          "noteText":"bad",
          "status":"DRAFT",
          "evidences":[
            {"position":1,"fileName":"a","mediaType":"text/plain","sourceLabel":"x","verificationStatus":"UNVERIFIED"},
            {"position":1,"fileName":"b","mediaType":"text/plain","sourceLabel":"x","verificationStatus":"UNVERIFIED"}
          ]
        }
      """.trimIndent()
      with(actorJwt("workpaper-user"))
    }.andExpect { status { isBadRequest() } }

    assertThat(countAuditEvents()).isEqualTo(auditBeforeInvalid)
    assertThat(countWorkpapers(tenantId)).isEqualTo(1)
  }

  @Test
  fun `audit failure rolls back workpaper and evidence writes atomically`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val userId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    val closingFolderId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    val importId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc")

    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    insertUser(userId, "workpaper-user")
    insertMembership(userId, tenantId, "MANAGER")
    insertClosingFolder(closingFolderId, tenantId)
    insertBalanceImport(importId, tenantId, closingFolderId, userId, 2, 2, "100.00", "100.00")
    insertBalanceImportLine(importId, tenantId, 2, "1000", "Cash", "100.00", "0.00")
    insertBalanceImportLine(importId, tenantId, 3, "3000", "Revenue", "0.00", "100.00")
    insertManualMapping(tenantId, closingFolderId, userId, "1000", "BS.ASSET.CASH_AND_EQUIVALENTS")
    insertManualMapping(tenantId, closingFolderId, userId, "3000", "PL.REVENUE.OPERATING_REVENUE")

    rollbackAwareAuditTrail.failNextAppend()

    assertThatThrownBy {
      mockMvc.put("/api/closing-folders/$closingFolderId/workpapers/BS.ASSET.CURRENT_SECTION") {
        header("X-Tenant-Id", tenantId.toString())
        contentType = org.springframework.http.MediaType.APPLICATION_JSON
        content = """
          {
            "noteText":"Cash tie-out",
            "status":"DRAFT",
            "evidences":[
              {
                "position":1,
                "fileName":"invoice.pdf",
                "mediaType":"application/pdf",
                "sourceLabel":"ERP",
                "verificationStatus":"UNVERIFIED"
              }
            ]
          }
        """.trimIndent()
        with(actorJwt("workpaper-user"))
      }
    }
      .isInstanceOf(jakarta.servlet.ServletException::class.java)
      .hasRootCauseInstanceOf(IllegalStateException::class.java)
      .hasRootCauseMessage("Intentional test failure after audit append.")

    assertThat(countWorkpapers(tenantId)).isZero()
    assertThat(countWorkpaperEvidences(tenantId)).isZero()
    assertThat(countAuditEvents()).isZero()
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

  private fun indexExists(tableName: String, indexName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists(
        select 1
        from pg_indexes
        where schemaname = 'public'
          and tablename = ?
          and indexname = ?
      )
      """.trimIndent(),
      Boolean::class.java,
      tableName,
      indexName
    ) ?: false

  private fun countAuditEvents(): Int =
    jdbcTemplate.queryForObject("select count(*) from audit_event", Int::class.java) ?: 0

  private fun countWorkpapers(tenantId: UUID): Int =
    jdbcTemplate.queryForObject("select count(*) from workpaper where tenant_id = ?", Int::class.java, tenantId) ?: 0

  private fun countWorkpaperEvidences(tenantId: UUID): Int =
    jdbcTemplate.queryForObject(
      "select count(*) from workpaper_evidence where tenant_id = ?",
      Int::class.java,
      tenantId
    ) ?: 0

  private fun auditActions(): List<String> =
    jdbcTemplate.queryForList(
      """
      select action
      from audit_event
      order by occurred_at asc, id asc
      """.trimIndent(),
      String::class.java
    )

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
      "Workpaper User"
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
    version: Int,
    rowCount: Int,
    totalDebit: String,
    totalCredit: String
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
      OffsetDateTime.parse("2025-01-02T00:00:00Z").plusDays(version.toLong()),
      importedByUserId,
      rowCount,
      java.math.BigDecimal(totalDebit),
      java.math.BigDecimal(totalCredit)
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

@TestConfiguration(proxyBeanMethods = false)
class WorkpapersDbIntegrationTestConfig {
  @Bean
  @Primary
  fun rollbackAwareAuditTrail(delegate: JdbcAuditTrail): RollbackAwareAuditTrail =
    RollbackAwareAuditTrail(delegate)
}

class RollbackAwareAuditTrail(
  private val delegate: JdbcAuditTrail
) : AuditTrail {
  private val failAfterAppend = AtomicBoolean(false)

  fun failNextAppend() {
    failAfterAppend.set(true)
  }

  override fun append(command: AppendAuditEventCommand): UUID {
    val auditEventId = delegate.append(command)
    if (failAfterAppend.compareAndSet(true, false)) {
      throw IllegalStateException("Intentional test failure after audit append.")
    }
    return auditEventId
  }
}
