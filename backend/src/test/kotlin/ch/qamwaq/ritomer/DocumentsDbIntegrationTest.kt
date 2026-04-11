package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.workpapers.application.DOCUMENT_CREATED_ACTION
import ch.qamwaq.ritomer.workpapers.application.DOCUMENT_VERIFICATION_UPDATED_ACTION
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.Comparator
import java.util.UUID
import org.flywaydb.core.Flyway
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.dao.DataAccessException
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dbtest")
@Import(WorkpapersDbIntegrationTestConfig::class)
@Tag("db-integration")
@EnabledIfEnvironmentVariable(named = "RITOMER_DB_TESTS_ENABLED", matches = "true")
class DocumentsDbIntegrationTest {
  @Autowired
  private lateinit var jdbcTemplate: org.springframework.jdbc.core.JdbcTemplate

  @Autowired
  private lateinit var mockMvc: MockMvc

  @BeforeEach
  fun resetDatabaseState() {
    jdbcTemplate.execute(
      "truncate table audit_event, document_verification, document, workpaper_evidence, workpaper, manual_mapping, balance_import_line, balance_import, closing_folder, tenant_membership, app_user, tenant cascade"
    )
    deleteDirectoryIfExists(Path.of("build", "dbtest-documents"))
  }

  @Test
  fun `document schema exists with tenant scoped fk and indexes`() {
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

    assertThat(versions).containsExactly("1", "2", "3", "4", "5", "6", "7", "8")
    assertThat(tableExists("document")).isTrue()
    assertThat(tableExists("document_verification")).isTrue()
    assertThat(columnExists("document", "tenant_id")).isTrue()
    assertThat(columnExists("document", "workpaper_id")).isTrue()
    assertThat(columnExists("document_verification", "document_id")).isTrue()
    assertThat(foreignKeyExists("document", "fk_document_workpaper")).isTrue()
    assertThat(foreignKeyExists("document_verification", "fk_document_verification_document")).isTrue()
    assertThat(uniqueConstraintExists("document", "uk_document_tenant_storage_object_key")).isTrue()
    assertThat(uniqueConstraintExists("document", "uk_document_id_tenant")).isTrue()
    assertThat(indexExists("document", "idx_document_tenant_workpaper_created")).isTrue()
    assertThat(indexExists("document", "idx_document_tenant_id")).isTrue()
    assertThat(indexExists("document_verification", "idx_document_verification_tenant_document")).isTrue()
  }

  @Test
  fun `upload persists document metadata and read endpoints stay silent including stale`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val userId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    val closingFolderId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    val importId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc")
    val workpaperId = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd")

    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    insertUser(userId, "document-user")
    insertMembership(userId, tenantId, "MANAGER")
    insertClosingFolder(closingFolderId, tenantId)
    insertBalanceImport(importId, tenantId, closingFolderId, userId, 2, 2, "100.00", "100.00")
    insertBalanceImportLine(importId, tenantId, 2, "1000", "Cash", "100.00", "0.00")
    insertBalanceImportLine(importId, tenantId, 3, "3000", "Revenue", "0.00", "100.00")
    insertManualMapping(tenantId, closingFolderId, userId, "1000", "BS.ASSET.CASH_AND_EQUIVALENTS")
    insertManualMapping(tenantId, closingFolderId, userId, "3000", "PL.REVENUE.OPERATING_REVENUE")
    insertWorkpaper(workpaperId, tenantId, closingFolderId, userId)

    val auditBefore = countAuditEvents()

    val uploadResult = mockMvc.perform(
      multipart("/api/closing-folders/$closingFolderId/workpapers/BS.ASSET.CURRENT_SECTION/documents")
        .file(MockMultipartFile("file", " support.pdf ", "application/pdf", "db-doc".toByteArray(StandardCharsets.UTF_8)))
        .param("sourceLabel", " ERP ")
        .param("documentDate", "2024-12-31")
        .header("X-Tenant-Id", tenantId.toString())
        .with(actorJwt("document-user"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isCreated)
      .andReturn()

    val documentId = com.fasterxml.jackson.databind.ObjectMapper()
      .readTree(uploadResult.response.contentAsString)
      .get("id")
      .asText()

    assertThat(countAuditEvents()).isEqualTo(auditBefore + 1)
    assertThat(auditActions()).containsExactly(DOCUMENT_CREATED_ACTION)

    val documentRows = jdbcTemplate.queryForList(
      """
      select workpaper_id, storage_backend, file_name, media_type, byte_size, checksum_sha256, source_label
      from document
      where tenant_id = ?
      """.trimIndent(),
      tenantId
    )
    assertThat(documentRows).hasSize(1)
    assertThat(documentRows.single()["workpaper_id"]).isEqualTo(workpaperId)
    assertThat(documentRows.single()["storage_backend"]).isEqualTo("LOCAL_FS")
    assertThat(documentRows.single()["file_name"]).isEqualTo("support.pdf")
    assertThat(documentRows.single()["media_type"]).isEqualTo("application/pdf")
    assertThat(documentRows.single()["byte_size"]).isEqualTo(6L)
    assertThat(documentRows.single()["source_label"]).isEqualTo("ERP")

    val verificationRows = jdbcTemplate.queryForList(
      """
      select document_id, verification_status, review_comment, reviewed_at, reviewed_by_user_id
      from document_verification
      where tenant_id = ?
      """.trimIndent(),
      tenantId
    )
    assertThat(verificationRows).hasSize(1)
    assertThat(verificationRows.single()["document_id"].toString()).isEqualTo(documentId)
    assertThat(verificationRows.single()["verification_status"]).isEqualTo("UNVERIFIED")
    assertThat(verificationRows.single()["review_comment"]).isNull()

    mockMvc.get("/api/closing-folders/$closingFolderId/workpapers") {
      header("X-Tenant-Id", tenantId.toString())
      with(actorJwt("document-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.items[0].documents.length()") { value(1) }
      jsonPath("$.items[0].documents[0].fileName") { value("support.pdf") }
      jsonPath("$.items[0].documents[0].verificationStatus") { value("UNVERIFIED") }
      jsonPath("$.items[0].documentVerificationSummary.documentsCount") { value(1) }
    }

    mockMvc.get("/api/closing-folders/$closingFolderId/workpapers/BS.ASSET.CURRENT_SECTION/documents") {
      header("X-Tenant-Id", tenantId.toString())
      with(actorJwt("document-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.documents.length()") { value(1) }
      jsonPath("$.documents[0].fileName") { value("support.pdf") }
      jsonPath("$.documents[0].verificationStatus") { value("UNVERIFIED") }
    }

    val currentContent = mockMvc.get("/api/closing-folders/$closingFolderId/documents/$documentId/content") {
      header("X-Tenant-Id", tenantId.toString())
      with(actorJwt("document-user"))
    }.andExpect { status { isOk() } }.andReturn()

    assertThat(String(currentContent.response.contentAsByteArray, StandardCharsets.UTF_8)).isEqualTo("db-doc")
    assertThat(countAuditEvents()).isEqualTo(auditBefore + 1)

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
      with(actorJwt("document-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.staleWorkpapers[0].anchorCode") { value("BS.ASSET.CURRENT_SECTION") }
      jsonPath("$.staleWorkpapers[0].documents.length()") { value(1) }
    }

    mockMvc.get("/api/closing-folders/$closingFolderId/workpapers/BS.ASSET.CURRENT_SECTION/documents") {
      header("X-Tenant-Id", tenantId.toString())
      with(actorJwt("document-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.isCurrentStructure") { value(false) }
      jsonPath("$.documents.length()") { value(1) }
    }

    val staleContent = mockMvc.get("/api/closing-folders/$closingFolderId/documents/$documentId/content") {
      header("X-Tenant-Id", tenantId.toString())
      with(actorJwt("document-user"))
    }.andExpect { status { isOk() } }.andReturn()

    assertThat(String(staleContent.response.contentAsByteArray, StandardCharsets.UTF_8)).isEqualTo("db-doc")
    assertThat(countAuditEvents()).isEqualTo(auditBefore + 1)
  }

  @Test
  fun `verification endpoint updates state and exact noop stays silent`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val userId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    val closingFolderId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    val importId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc")
    val workpaperId = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd")

    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    insertUser(userId, "document-user")
    insertMembership(userId, tenantId, "MANAGER")
    insertClosingFolder(closingFolderId, tenantId)
    insertBalanceImport(importId, tenantId, closingFolderId, userId, 2, 2, "100.00", "100.00")
    insertBalanceImportLine(importId, tenantId, 2, "1000", "Cash", "100.00", "0.00")
    insertBalanceImportLine(importId, tenantId, 3, "3000", "Revenue", "0.00", "100.00")
    insertManualMapping(tenantId, closingFolderId, userId, "1000", "BS.ASSET.CASH_AND_EQUIVALENTS")
    insertManualMapping(tenantId, closingFolderId, userId, "3000", "PL.REVENUE.OPERATING_REVENUE")
    insertWorkpaper(workpaperId, tenantId, closingFolderId, userId, status = "DRAFT")

    val uploadResult = mockMvc.perform(
      multipart("/api/closing-folders/$closingFolderId/workpapers/BS.ASSET.CURRENT_SECTION/documents")
        .file(MockMultipartFile("file", "support.pdf", "application/pdf", "db-doc".toByteArray(StandardCharsets.UTF_8)))
        .param("sourceLabel", "ERP")
        .header("X-Tenant-Id", tenantId.toString())
        .with(actorJwt("document-user"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isCreated)
      .andReturn()

    val documentId = com.fasterxml.jackson.databind.ObjectMapper()
      .readTree(uploadResult.response.contentAsString)
      .get("id")
      .asText()

    jdbcTemplate.update(
      "update workpaper set status = 'READY_FOR_REVIEW' where id = ?",
      workpaperId
    )

    mockMvc.post("/api/closing-folders/$closingFolderId/documents/$documentId/verification-decision") {
      header("X-Tenant-Id", tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REJECTED","comment":"Wrong period"}"""
      with(actorJwt("document-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.verificationStatus") { value("REJECTED") }
      jsonPath("$.reviewComment") { value("Wrong period") }
    }

    assertThat(auditActions()).containsExactly(DOCUMENT_CREATED_ACTION, DOCUMENT_VERIFICATION_UPDATED_ACTION)

    val auditBeforeNoop = countAuditEvents()
    mockMvc.post("/api/closing-folders/$closingFolderId/documents/$documentId/verification-decision") {
      header("X-Tenant-Id", tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REJECTED","comment":"Wrong period"}"""
      with(actorJwt("document-user"))
    }.andExpect { status { isOk() } }

    assertThat(countAuditEvents()).isEqualTo(auditBeforeNoop)
  }

  @Test
  fun `v8 backfills document verification for preexisting documents and enforces 1 to 1`() {
    val dataSource = jdbcTemplate.dataSource ?: error("DataSource is required for Flyway verification.")

    jdbcTemplate.execute("drop schema if exists public cascade")
    jdbcTemplate.execute("create schema public")

    Flyway.configure()
      .dataSource(dataSource)
      .locations("classpath:db/migration")
      .target("7")
      .load()
      .migrate()

    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val userId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    val closingFolderId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    val workpaperId = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd")
    val documentId = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")

    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    insertUser(userId, "document-user")
    insertClosingFolder(closingFolderId, tenantId)
    insertWorkpaper(workpaperId, tenantId, closingFolderId, userId, status = "DRAFT")
    jdbcTemplate.update(
      """
      insert into document (
        id, tenant_id, workpaper_id, storage_backend, storage_object_key, file_name, media_type,
        byte_size, checksum_sha256, source_label, document_date, created_at, created_by_user_id
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """.trimIndent(),
      documentId,
      tenantId,
      workpaperId,
      "LOCAL_FS",
      "tenants/$tenantId/workpapers/$workpaperId/documents/$documentId",
      "legacy.pdf",
      "application/pdf",
      10L,
      "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      "ERP",
      LocalDate.parse("2024-12-31"),
      OffsetDateTime.parse("2025-01-02T00:00:00Z"),
      userId
    )

    Flyway.configure()
      .dataSource(dataSource)
      .locations("classpath:db/migration")
      .load()
      .migrate()

    val verificationRows = jdbcTemplate.queryForList(
      """
      select document_id, verification_status, review_comment, reviewed_at, reviewed_by_user_id
      from document_verification
      where tenant_id = ?
      """.trimIndent(),
      tenantId
    )
    assertThat(verificationRows).hasSize(1)
    assertThat(verificationRows.single()["document_id"]).isEqualTo(documentId)
    assertThat(verificationRows.single()["verification_status"]).isEqualTo("UNVERIFIED")
    assertThat(verificationRows.single()["review_comment"]).isNull()

    assertThatThrownBy {
      jdbcTemplate.update(
        """
        insert into document_verification (
          document_id, tenant_id, verification_status, review_comment, reviewed_at, reviewed_by_user_id
        ) values (?, ?, ?, ?, ?, ?)
        """.trimIndent(),
        documentId,
        tenantId,
        "UNVERIFIED",
        null,
        null,
        null
      )
    }.isInstanceOf(DataAccessException::class.java)
  }

  @Test
  fun `db constraints reject invalid checksum and non positive byte size`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val userId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    val closingFolderId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    val workpaperId = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd")

    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    insertUser(userId, "document-user")
    insertClosingFolder(closingFolderId, tenantId)
    insertWorkpaper(workpaperId, tenantId, closingFolderId, userId)

    assertThatThrownBy {
      jdbcTemplate.update(
        """
        insert into document (
          id, tenant_id, workpaper_id, storage_backend, storage_object_key, file_name, media_type,
          byte_size, checksum_sha256, source_label, document_date, created_at, created_by_user_id
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """.trimIndent(),
        UUID.randomUUID(),
        tenantId,
        workpaperId,
        "LOCAL_FS",
        "tenants/$tenantId/workpapers/$workpaperId/documents/bad",
        "bad.pdf",
        "application/pdf",
        0L,
        "not-a-checksum",
        "ERP",
        LocalDate.parse("2024-12-31"),
        OffsetDateTime.parse("2025-01-02T00:00:00Z"),
        userId
      )
    }.isInstanceOf(DataAccessException::class.java)
  }

  private fun tableExists(tableName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = ?
      )
      """.trimIndent(),
      Boolean::class.java,
      tableName
    ) ?: false

  private fun columnExists(tableName: String, columnName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists (
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

  private fun foreignKeyExists(tableName: String, constraintName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists (
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

  private fun uniqueConstraintExists(tableName: String, constraintName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists (
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

  private fun indexExists(tableName: String, indexName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists (
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
      "Document User"
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
        id, tenant_id, name, period_start_on, period_end_on, status,
        archived_at, archived_by_user_id, created_at, updated_at
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
        id, tenant_id, closing_folder_id, version, source_file_name, imported_at,
        imported_by_user_id, row_count, total_debit, total_credit
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
        id, tenant_id, balance_import_id, line_no, account_code, account_label, debit, credit
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
        id, tenant_id, closing_folder_id, account_code, target_code,
        created_at, updated_at, created_by_user_id, updated_by_user_id
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

  private fun insertWorkpaper(
    workpaperId: UUID,
    tenantId: UUID,
    closingFolderId: UUID,
    userId: UUID,
    status: String = "DRAFT"
  ) {
    jdbcTemplate.update(
      """
      insert into workpaper (
        id, tenant_id, closing_folder_id, anchor_code, anchor_label, summary_bucket_code,
        statement_kind, breakdown_type, note_text, status, review_comment, basis_import_version,
        basis_taxonomy_version, created_at, created_by_user_id, updated_at, updated_by_user_id,
        reviewed_at, reviewed_by_user_id
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """.trimIndent(),
      workpaperId,
      tenantId,
      closingFolderId,
      "BS.ASSET.CURRENT_SECTION",
      "Current assets",
      "BS.ASSET",
      "BALANCE_SHEET",
      "SECTION",
      "Justification",
      status,
      null,
      2,
      2,
      OffsetDateTime.parse("2025-01-02T00:00:00Z"),
      userId,
      OffsetDateTime.parse("2025-01-02T00:00:00Z"),
      userId,
      null,
      null
    )
  }
}

private fun actorJwt(subject: String) = jwt().jwt { token ->
  token.subject(subject)
}

private fun deleteDirectoryIfExists(path: Path) {
  if (!Files.exists(path)) {
    return
  }

  Files.walk(path)
    .sorted(Comparator.reverseOrder())
    .forEach { Files.deleteIfExists(it) }
}
