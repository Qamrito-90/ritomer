package ch.qamwaq.ritomer.exports.api

import ch.qamwaq.ritomer.AuditTestStore
import ch.qamwaq.ritomer.ClosingFolderTestStore
import ch.qamwaq.ritomer.IdentityTestConfiguration
import ch.qamwaq.ritomer.IdentityTestStore
import ch.qamwaq.ritomer.ManualMappingTestStore
import ch.qamwaq.ritomer.BalanceImportTestStore
import ch.qamwaq.ritomer.WorkpaperTestStore
import ch.qamwaq.ritomer.DocumentTestStore
import ch.qamwaq.ritomer.closing.application.ClosingFolderRepository
import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import ch.qamwaq.ritomer.imports.application.BalanceImportRepository
import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.mapping.application.ManualMappingRepository
import ch.qamwaq.ritomer.mapping.domain.ManualMapping
import ch.qamwaq.ritomer.workpapers.application.DocumentService
import ch.qamwaq.ritomer.workpapers.application.UploadDocumentCommand
import ch.qamwaq.ritomer.workpapers.application.WorkpaperRepository
import ch.qamwaq.ritomer.workpapers.domain.Workpaper
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperBreakdownType
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatementKind
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatus
import java.math.BigDecimal
import java.nio.file.Files
import java.nio.file.Path
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.Comparator
import java.util.UUID
import java.util.zip.ZipInputStream
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.mock.web.MockMultipartFile
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class)
class ExportPacksApiTest {
  @Autowired
  private lateinit var mockMvc: MockMvc

  @Autowired
  private lateinit var identityTestStore: IdentityTestStore

  @Autowired
  private lateinit var auditTestStore: AuditTestStore

  @Autowired
  private lateinit var closingFolderTestStore: ClosingFolderTestStore

  @Autowired
  private lateinit var balanceImportTestStore: BalanceImportTestStore

  @Autowired
  private lateinit var manualMappingTestStore: ManualMappingTestStore

  @Autowired
  private lateinit var workpaperTestStore: WorkpaperTestStore

  @Autowired
  private lateinit var documentTestStore: DocumentTestStore

  @Autowired
  private lateinit var closingFolderRepository: ClosingFolderRepository

  @Autowired
  private lateinit var balanceImportRepository: BalanceImportRepository

  @Autowired
  private lateinit var manualMappingRepository: ManualMappingRepository

  @Autowired
  private lateinit var workpaperRepository: WorkpaperRepository

  @Autowired
  private lateinit var documentService: DocumentService

  private val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
  private val userId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
  private val closingFolderId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
  private val workpaperId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc")

  @BeforeEach
  fun resetState() {
    identityTestStore.reset()
    auditTestStore.reset()
    closingFolderTestStore.reset()
    balanceImportTestStore.reset()
    manualMappingTestStore.reset()
    workpaperTestStore.reset()
    documentTestStore.reset()
    deleteDirectoryIfExists(Path.of("build", "test-documents"))
  }

  @Test
  fun `post requires idempotency key and applies RBAC while get endpoints stay readable`() {
    seedReadyClosing()

    mockMvc.post("/api/closing-folders/$closingFolderId/export-packs") {
      header("X-Tenant-Id", tenantId.toString())
      with(actorJwt("export-user"))
    }.andExpect {
      status { isBadRequest() }
    }

    mockMvc.post("/api/closing-folders/$closingFolderId/export-packs") {
      header("X-Tenant-Id", tenantId.toString())
      header("Idempotency-Key", "   ")
      with(actorJwt("export-user"))
    }.andExpect {
      status { isBadRequest() }
    }

    mockMvc.post("/api/closing-folders/$closingFolderId/export-packs") {
      header("X-Tenant-Id", tenantId.toString())
      header("Idempotency-Key", "rbac-key")
      with(actorJwt("reviewer-user"))
    }.andExpect {
      status { isForbidden() }
    }

    val created = mockMvc.post("/api/closing-folders/$closingFolderId/export-packs") {
      header("X-Tenant-Id", tenantId.toString())
      header("Idempotency-Key", "rbac-key")
      with(actorJwt("export-user"))
    }.andExpect {
      status { isCreated() }
    }.andReturn()

    val exportPackId = objectMapper.readTree(created.response.contentAsString).get("exportPackId").asText()

    listOf("export-user", "reviewer-user", "manager-user", "admin-user").forEach { subject ->
      mockMvc.get("/api/closing-folders/$closingFolderId/export-packs") {
        header("X-Tenant-Id", tenantId.toString())
        with(actorJwt(subject))
      }.andExpect { status { isOk() } }

      mockMvc.get("/api/closing-folders/$closingFolderId/export-packs/$exportPackId") {
        header("X-Tenant-Id", tenantId.toString())
        with(actorJwt(subject))
      }.andExpect { status { isOk() } }

      mockMvc.get("/api/closing-folders/$closingFolderId/export-packs/$exportPackId/content") {
        header("X-Tenant-Id", tenantId.toString())
        with(actorJwt(subject))
      }.andExpect { status { isOk() } }
    }
  }

  @Test
  fun `first generation returns 201 replay returns 200 and gets stay silent in audit`() {
    seedReadyClosing()
    val auditBefore = auditTestStore.auditEvents().size

    val created = mockMvc.post("/api/closing-folders/$closingFolderId/export-packs") {
      header("X-Tenant-Id", tenantId.toString())
      header("Idempotency-Key", "idempotent-key")
      with(actorJwt("export-user"))
    }.andExpect {
      status { isCreated() }
      jsonPath("$.mediaType") { value("application/zip") }
    }.andReturn()

    val createdNode = objectMapper.readTree(created.response.contentAsString)
    val exportPackId = createdNode.get("exportPackId").asText()
    assertThat(auditTestStore.auditEvents()).hasSize(auditBefore + 1)

    val replay = mockMvc.post("/api/closing-folders/$closingFolderId/export-packs") {
      header("X-Tenant-Id", tenantId.toString())
      header("Idempotency-Key", "idempotent-key")
      with(actorJwt("export-user"))
    }.andExpect {
      status { isOk() }
    }.andReturn()

    val replayNode = objectMapper.readTree(replay.response.contentAsString)
    assertThat(replayNode.get("exportPackId").asText()).isEqualTo(exportPackId)
    assertThat(auditTestStore.auditEvents()).hasSize(auditBefore + 1)

    mockMvc.get("/api/closing-folders/$closingFolderId/export-packs") {
      header("X-Tenant-Id", tenantId.toString())
      with(actorJwt("reviewer-user"))
    }.andExpect { status { isOk() } }

    mockMvc.get("/api/closing-folders/$closingFolderId/export-packs/$exportPackId") {
      header("X-Tenant-Id", tenantId.toString())
      with(actorJwt("reviewer-user"))
    }.andExpect { status { isOk() } }

    val content = mockMvc.get("/api/closing-folders/$closingFolderId/export-packs/$exportPackId/content") {
      header("X-Tenant-Id", tenantId.toString())
      with(actorJwt("reviewer-user"))
    }.andExpect {
      status { isOk() }
      header { string("Cache-Control", "private, no-store") }
      header { string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment")) }
    }.andReturn()

    assertThat(auditTestStore.auditEvents()).hasSize(auditBefore + 1)
    val zipEntries = unzip(content.response.contentAsByteArray)
    assertThat(zipEntries.keys).contains("manifest.json")
    assertThat(String(zipEntries.getValue("manifest.json"))).doesNotContain("storage_object_key")
  }

  @Test
  fun `same key with different logical intention returns conflict after persisted success`() {
    seedReadyClosing()
    val createdWorkpaper = workpaperTestStore.findById(workpaperId) ?: error("Expected seeded workpaper.")

    mockMvc.post("/api/closing-folders/$closingFolderId/export-packs") {
      header("X-Tenant-Id", tenantId.toString())
      header("Idempotency-Key", "same-key")
      with(actorJwt("export-user"))
    }.andExpect { status { isCreated() } }

    workpaperRepository.update(
      createdWorkpaper.copy(
        noteText = "Updated note after first export",
        updatedAt = OffsetDateTime.parse("2025-01-05T00:00:00Z")
      )
    )

    mockMvc.post("/api/closing-folders/$closingFolderId/export-packs") {
      header("X-Tenant-Id", tenantId.toString())
      header("Idempotency-Key", "same-key")
      with(actorJwt("export-user"))
    }.andExpect {
      status { isConflict() }
    }
  }

  @Test
  fun `replay remains allowed after closing becomes archived`() {
    seedReadyClosing()

    val created = mockMvc.post("/api/closing-folders/$closingFolderId/export-packs") {
      header("X-Tenant-Id", tenantId.toString())
      header("Idempotency-Key", "archive-replay")
      with(actorJwt("export-user"))
    }.andExpect { status { isCreated() } }.andReturn()

    val exportPackId = objectMapper.readTree(created.response.contentAsString).get("exportPackId").asText()
    val existingClosing = closingFolderRepository.findByIdAndTenantId(closingFolderId, tenantId) ?: error("Closing folder missing.")
    closingFolderRepository.update(
      existingClosing.copy(
        status = ClosingFolderStatus.ARCHIVED,
        archivedAt = OffsetDateTime.parse("2025-01-10T00:00:00Z"),
        archivedByUserId = userId,
        updatedAt = OffsetDateTime.parse("2025-01-10T00:00:00Z")
      )
    )

    mockMvc.post("/api/closing-folders/$closingFolderId/export-packs") {
      header("X-Tenant-Id", tenantId.toString())
      header("Idempotency-Key", "archive-replay")
      with(actorJwt("export-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.exportPackId") { value(exportPackId) }
    }

    mockMvc.get("/api/closing-folders/$closingFolderId/export-packs/$exportPackId") {
      header("X-Tenant-Id", tenantId.toString())
      with(actorJwt("reviewer-user"))
    }.andExpect {
      status { isOk() }
    }
  }

  @Test
  fun `first generation rejects blocked readiness`() {
    seedReadyClosing(completeMapping = false)

    mockMvc.post("/api/closing-folders/$closingFolderId/export-packs") {
      header("X-Tenant-Id", tenantId.toString())
      header("Idempotency-Key", "blocked-readiness")
      with(actorJwt("export-user"))
    }.andExpect {
      status { isConflict() }
    }
  }

  private fun seedReadyClosing(completeMapping: Boolean = true) {
    identityTestStore.seedUser("export-user")
    identityTestStore.seedUser("reviewer-user")
    identityTestStore.seedUser("manager-user")
    identityTestStore.seedUser("admin-user")
    identityTestStore.seedActiveMembership("export-user", tenantId, "tenant-alpha", "Tenant Alpha", ch.qamwaq.ritomer.identity.domain.TenantRole.ACCOUNTANT)
    identityTestStore.seedActiveMembership("reviewer-user", tenantId, "tenant-alpha", "Tenant Alpha", ch.qamwaq.ritomer.identity.domain.TenantRole.REVIEWER)
    identityTestStore.seedActiveMembership("manager-user", tenantId, "tenant-alpha", "Tenant Alpha", ch.qamwaq.ritomer.identity.domain.TenantRole.MANAGER)
    identityTestStore.seedActiveMembership("admin-user", tenantId, "tenant-alpha", "Tenant Alpha", ch.qamwaq.ritomer.identity.domain.TenantRole.ADMIN)

    closingFolderRepository.create(
      ClosingFolder(
        id = closingFolderId,
        tenantId = tenantId,
        name = "Closing FY24",
        periodStartOn = LocalDate.parse("2024-01-01"),
        periodEndOn = LocalDate.parse("2024-12-31"),
        externalRef = null,
        status = ClosingFolderStatus.DRAFT,
        archivedAt = null,
        archivedByUserId = null,
        createdAt = OffsetDateTime.parse("2025-01-01T00:00:00Z"),
        updatedAt = OffsetDateTime.parse("2025-01-01T00:00:00Z")
      )
    )

    balanceImportRepository.create(
      BalanceImport(
        id = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
        tenantId = tenantId,
        closingFolderId = closingFolderId,
        version = 3,
        sourceFileName = "seed.csv",
        importedAt = OffsetDateTime.parse("2025-01-02T00:00:00Z"),
        importedByUserId = userId,
        rowCount = 2,
        totalDebit = BigDecimal("100.00"),
        totalCredit = BigDecimal("100.00")
      ),
      listOf(
        BalanceImportLine(2, "1000", "Cash", BigDecimal("100.00"), BigDecimal.ZERO),
        BalanceImportLine(3, "3000", "Revenue", BigDecimal.ZERO, BigDecimal("100.00"))
      )
    )

    manualMappingRepository.create(
      ManualMapping(
        id = UUID.randomUUID(),
        tenantId = tenantId,
        closingFolderId = closingFolderId,
        accountCode = "1000",
        targetCode = "BS.ASSET.CASH_AND_EQUIVALENTS",
        createdAt = OffsetDateTime.parse("2025-01-02T00:00:00Z"),
        updatedAt = OffsetDateTime.parse("2025-01-02T00:00:00Z"),
        createdByUserId = userId,
        updatedByUserId = userId
      )
    )
    if (completeMapping) {
      manualMappingRepository.create(
        ManualMapping(
          id = UUID.randomUUID(),
          tenantId = tenantId,
          closingFolderId = closingFolderId,
          accountCode = "3000",
          targetCode = "PL.REVENUE.OPERATING_REVENUE",
          createdAt = OffsetDateTime.parse("2025-01-02T00:00:00Z"),
          updatedAt = OffsetDateTime.parse("2025-01-02T00:00:00Z"),
          createdByUserId = userId,
          updatedByUserId = userId
        )
      )
    }

    workpaperRepository.create(
      Workpaper(
        id = workpaperId,
        tenantId = tenantId,
        closingFolderId = closingFolderId,
        anchorCode = "BS.ASSET.CURRENT_SECTION",
        anchorLabel = "Current assets",
        summaryBucketCode = "BS.ASSET",
        statementKind = WorkpaperStatementKind.BALANCE_SHEET,
        breakdownType = WorkpaperBreakdownType.SECTION,
        noteText = "Justification",
        status = WorkpaperStatus.DRAFT,
        reviewComment = null,
        basisImportVersion = 3,
        basisTaxonomyVersion = 2,
        createdAt = OffsetDateTime.parse("2025-01-02T00:00:00Z"),
        createdByUserId = userId,
        updatedAt = OffsetDateTime.parse("2025-01-02T00:00:00Z"),
        updatedByUserId = userId,
        reviewedAt = null,
        reviewedByUserId = null,
        evidences = emptyList()
      )
    )

    if (completeMapping) {
      documentService.uploadDocument(
        makerAccess(),
        closingFolderId,
        "BS.ASSET.CURRENT_SECTION",
        MockMultipartFile("file", "support.pdf", "application/pdf", "support-bytes".toByteArray()),
        UploadDocumentCommand(sourceLabel = "ERP", documentDate = LocalDate.parse("2024-12-31"))
      )
    }
  }

  private fun makerAccess(): TenantAccessContext =
    TenantAccessContext(
      actorUserId = userId,
      actorSubject = "export-user",
      tenantId = tenantId,
      effectiveRoles = setOf("ACCOUNTANT")
    )

  private fun unzip(bytes: ByteArray): Map<String, ByteArray> {
    val entries = linkedMapOf<String, ByteArray>()
    ZipInputStream(bytes.inputStream(), Charsets.UTF_8).use { zip ->
      while (true) {
        val entry = zip.nextEntry ?: break
        entries[entry.name] = zip.readAllBytes()
      }
    }
    return entries
  }

  private fun actorJwt(subject: String) = jwt().jwt { token ->
    token.subject(subject)
  }

  companion object {
    private val objectMapper = com.fasterxml.jackson.databind.ObjectMapper()
  }
}

private fun deleteDirectoryIfExists(path: Path) {
  if (!Files.exists(path)) {
    return
  }

  Files.walk(path)
    .sorted(Comparator.reverseOrder())
    .forEach { Files.deleteIfExists(it) }
}
