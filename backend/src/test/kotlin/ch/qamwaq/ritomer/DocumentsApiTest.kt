package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.imports.domain.BalanceImportSnapshot
import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import ch.qamwaq.ritomer.workpapers.application.DOCUMENT_CREATED_ACTION
import ch.qamwaq.ritomer.workpapers.application.DOCUMENT_VERIFICATION_UPDATED_ACTION
import ch.qamwaq.ritomer.workpapers.domain.Document
import ch.qamwaq.ritomer.workpapers.domain.DocumentStorageBackend
import ch.qamwaq.ritomer.workpapers.domain.DocumentVerificationStatus
import ch.qamwaq.ritomer.workpapers.domain.Workpaper
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperBreakdownType
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperEvidence
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperEvidenceVerificationStatus
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatementKind
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatus
import com.fasterxml.jackson.databind.ObjectMapper
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.Comparator
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
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
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class)
class DocumentsApiTest {
  @Autowired
  private lateinit var mockMvc: MockMvc

  @Autowired
  private lateinit var objectMapper: ObjectMapper

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

  @BeforeEach
  fun resetStores() {
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
  fun `document endpoints require authentication`() {
    val closingFolderId = UUID.randomUUID()
    val documentId = UUID.randomUUID()
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")

    mockMvc.perform(
      multipart("/api/closing-folders/$closingFolderId/workpapers/BS.ASSET.CURRENT_SECTION/documents")
        .file(pdfFile("support.pdf", "pdf"))
        .param("sourceLabel", "ERP")
        .header(ACTIVE_TENANT_HEADER, tenantId.toString())
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized)

    mockMvc.get("/api/closing-folders/$closingFolderId/workpapers/BS.ASSET.CURRENT_SECTION/documents") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
    }.andExpect { status { isUnauthorized() } }

    mockMvc.get("/api/closing-folders/$closingFolderId/documents/$documentId/content") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
    }.andExpect { status { isUnauthorized() } }

    mockMvc.post("/api/closing-folders/$closingFolderId/documents/$documentId/verification-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"VERIFIED"}"""
    }.andExpect { status { isUnauthorized() } }
  }

  @Test
  fun `upload accepts pdf and get endpoints stay silent in audit across current and stale`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)
    seedPreviewReadyStructure(tenantId, closingFolder.id)
    val currentWorkpaper = workpaper(
      tenantId = tenantId,
      closingFolderId = closingFolder.id,
      anchorCode = "BS.ASSET.CURRENT_SECTION",
      anchorLabel = "Current assets",
      status = WorkpaperStatus.DRAFT
    )
    workpaperTestStore.save(currentWorkpaper)

    val uploadResult = mockMvc.perform(
      multipart("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/documents")
        .file(pdfFile("  support.pdf  ", "hello-pdf"))
        .param("sourceLabel", " ERP ")
        .param("documentDate", "2024-12-31")
        .header(ACTIVE_TENANT_HEADER, tenantId.toString())
        .with(actorJwt("user-123"))
    ).andExpect(
      org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isCreated
    ).andReturn()

    val createdDocumentId = UUID.fromString(
      objectMapper.readTree(uploadResult.response.contentAsString).get("id").asText()
    )

    assertThat(auditTestStore.auditEvents()).hasSize(1)
    assertThat(auditTestStore.auditEvents().single().command.action).isEqualTo(DOCUMENT_CREATED_ACTION)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.items[0].documents.length()") { value(1) }
      jsonPath("$.items[0].documents[0].fileName") { value("support.pdf") }
      jsonPath("$.items[0].documents[0].mediaType") { value("application/pdf") }
      jsonPath("$.items[0].documents[0].verificationStatus") { value("UNVERIFIED") }
      jsonPath("$.items[0].documentVerificationSummary.documentsCount") { value(1) }
      jsonPath("$.items[0].documentVerificationSummary.unverifiedCount") { value(1) }
    }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/documents") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.isCurrentStructure") { value(true) }
      jsonPath("$.documents.length()") { value(1) }
      jsonPath("$.documents[0].fileName") { value("support.pdf") }
      jsonPath("$.documents[0].verificationStatus") { value("UNVERIFIED") }
    }

    val currentContent = mockMvc.get("/api/closing-folders/${closingFolder.id}/documents/$createdDocumentId/content") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      header { string("Cache-Control", "private, no-store") }
      header { string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment")) }
      header { string("Content-Type", "application/pdf") }
    }.andReturn()

    assertThat(String(currentContent.response.contentAsByteArray, StandardCharsets.UTF_8)).isEqualTo("hello-pdf")
    assertThat(auditTestStore.auditEvents()).hasSize(1)

    manualMappingTestStore.deleteByAccountCode(tenantId, closingFolder.id, "1000")
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1000", "BS.ASSET"))

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.staleWorkpapers[0].anchorCode") { value("BS.ASSET.CURRENT_SECTION") }
      jsonPath("$.staleWorkpapers[0].documents.length()") { value(1) }
      jsonPath("$.staleWorkpapers[0].documentVerificationSummary.documentsCount") { value(1) }
    }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/documents") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.isCurrentStructure") { value(false) }
      jsonPath("$.documents.length()") { value(1) }
    }

    val staleContent = mockMvc.get("/api/closing-folders/${closingFolder.id}/documents/$createdDocumentId/content") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isOk() } }.andReturn()

    assertThat(String(staleContent.response.contentAsByteArray, StandardCharsets.UTF_8)).isEqualTo("hello-pdf")
    assertThat(auditTestStore.auditEvents()).hasSize(1)
  }

  @Test
  fun `verification decision is reviewer only supports noop and audits only real mutations`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("reviewer", tenantId, TenantRole.REVIEWER)
    seedMembership("accountant", tenantId, TenantRole.ACCOUNTANT)
    seedPreviewReadyStructure(tenantId, closingFolder.id)
    val persistedWorkpaper = workpaper(
      tenantId = tenantId,
      closingFolderId = closingFolder.id,
      anchorCode = "BS.ASSET.CURRENT_SECTION",
      anchorLabel = "Current assets",
      status = WorkpaperStatus.READY_FOR_REVIEW
    )
    workpaperTestStore.save(persistedWorkpaper)
    val document = storedDocument(tenantId, persistedWorkpaper.id, "support.pdf", "content")
    documentTestStore.save(document)

    mockMvc.post("/api/closing-folders/${closingFolder.id}/documents/${document.id}/verification-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"VERIFIED"}"""
      with(actorJwt("accountant"))
    }.andExpect { status { isForbidden() } }

    mockMvc.post("/api/closing-folders/${closingFolder.id}/documents/${document.id}/verification-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REJECTED","comment":" Wrong period "}"""
      with(actorJwt("reviewer"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.verificationStatus") { value("REJECTED") }
      jsonPath("$.reviewComment") { value("Wrong period") }
    }

    assertThat(auditTestStore.auditEvents()).hasSize(1)
    assertThat(auditTestStore.auditEvents().single().command.action).isEqualTo(DOCUMENT_VERIFICATION_UPDATED_ACTION)

    mockMvc.post("/api/closing-folders/${closingFolder.id}/documents/${document.id}/verification-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REJECTED","comment":"Wrong period"}"""
      with(actorJwt("reviewer"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.verificationStatus") { value("REJECTED") }
    }

    assertThat(auditTestStore.auditEvents()).hasSize(1)

    mockMvc.post("/api/closing-folders/${closingFolder.id}/documents/${document.id}/verification-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REJECTED","comment":"Updated comment"}"""
      with(actorJwt("reviewer"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.reviewComment") { value("Updated comment") }
    }

    assertThat(auditTestStore.auditEvents()).hasSize(2)
    assertThat(auditTestStore.auditEvents().last().command.action).isEqualTo(DOCUMENT_VERIFICATION_UPDATED_ACTION)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("reviewer"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.items[0].documents[0].verificationStatus") { value("REJECTED") }
      jsonPath("$.items[0].documentVerificationSummary.rejectedCount") { value(1) }
    }
  }

  @Test
  fun `verification decision rejects verified comment blocked stale and archived cases`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val currentClosing = seedClosingFolder(tenantId)
    val blockedClosing = seedClosingFolder(tenantId)
    val staleClosing = seedClosingFolder(tenantId)
    val archivedClosing = seedClosingFolder(tenantId, status = ClosingFolderStatus.ARCHIVED)
    seedMembership("reviewer", tenantId, TenantRole.REVIEWER)
    seedPreviewReadyStructure(tenantId, currentClosing.id)
    seedPreviewReadyStructure(tenantId, staleClosing.id)
    seedPreviewReadyStructure(tenantId, archivedClosing.id)
    seedImportVersion(
      tenantId,
      blockedClosing.id,
      1,
      listOf(
        BalanceImportLine(2, "1000", "Cash", decimal("100.00"), decimal("0.00")),
        BalanceImportLine(3, "3000", "Revenue", decimal("0.00"), decimal("100.00"))
      )
    )

    val currentWorkpaper = workpaper(tenantId, currentClosing.id, "BS.ASSET.CURRENT_SECTION", "Current assets", status = WorkpaperStatus.READY_FOR_REVIEW)
    val blockedWorkpaper = workpaper(tenantId, blockedClosing.id, "BS.ASSET.CURRENT_SECTION", "Current assets", status = WorkpaperStatus.READY_FOR_REVIEW)
    val staleWorkpaper = workpaper(tenantId, staleClosing.id, "BS.ASSET.CURRENT_SECTION", "Current assets", status = WorkpaperStatus.READY_FOR_REVIEW)
    val archivedWorkpaper = workpaper(tenantId, archivedClosing.id, "BS.ASSET.CURRENT_SECTION", "Current assets", status = WorkpaperStatus.READY_FOR_REVIEW)
    workpaperTestStore.save(currentWorkpaper)
    workpaperTestStore.save(blockedWorkpaper)
    workpaperTestStore.save(staleWorkpaper)
    workpaperTestStore.save(archivedWorkpaper)

    val currentDocument = storedDocument(tenantId, currentWorkpaper.id, "current.pdf", "current")
    val blockedDocument = storedDocument(tenantId, blockedWorkpaper.id, "blocked.pdf", "blocked")
    val staleDocument = storedDocument(tenantId, staleWorkpaper.id, "stale.pdf", "stale")
    val archivedDocument = storedDocument(tenantId, archivedWorkpaper.id, "archived.pdf", "archived")
    documentTestStore.save(currentDocument)
    documentTestStore.save(blockedDocument)
    documentTestStore.save(staleDocument)
    documentTestStore.save(archivedDocument)

    manualMappingTestStore.deleteByAccountCode(tenantId, staleClosing.id, "1000")
    manualMappingTestStore.save(manualMapping(tenantId, staleClosing.id, "1000", "BS.ASSET"))

    mockMvc.post("/api/closing-folders/${currentClosing.id}/documents/${currentDocument.id}/verification-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"VERIFIED","comment":"not allowed"}"""
      with(actorJwt("reviewer"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.post("/api/closing-folders/${blockedClosing.id}/documents/${blockedDocument.id}/verification-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"VERIFIED"}"""
      with(actorJwt("reviewer"))
    }.andExpect { status { isConflict() } }

    mockMvc.post("/api/closing-folders/${staleClosing.id}/documents/${staleDocument.id}/verification-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"VERIFIED"}"""
      with(actorJwt("reviewer"))
    }.andExpect { status { isConflict() } }

    mockMvc.post("/api/closing-folders/${archivedClosing.id}/documents/${archivedDocument.id}/verification-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"VERIFIED"}"""
      with(actorJwt("reviewer"))
    }.andExpect { status { isConflict() } }
  }

  @Test
  fun `archived closing keeps documents readable and upload returns 409`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId, status = ClosingFolderStatus.ARCHIVED)
    seedMembership("user-123", tenantId, TenantRole.MANAGER)
    seedPreviewReadyStructure(tenantId, closingFolder.id)
    val persistedWorkpaper = workpaper(
      tenantId = tenantId,
      closingFolderId = closingFolder.id,
      anchorCode = "BS.ASSET.CURRENT_SECTION",
      anchorLabel = "Current assets",
      status = WorkpaperStatus.DRAFT
    )
    workpaperTestStore.save(persistedWorkpaper)
    val archivedDocument = storedDocument(
      tenantId = tenantId,
      workpaperId = persistedWorkpaper.id,
      fileName = "archived-support.pdf",
      content = "archived-content"
    )
    documentTestStore.save(archivedDocument)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.closingFolderStatus") { value("ARCHIVED") }
      jsonPath("$.items[0].documents.length()") { value(1) }
    }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/documents") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.documents[0].fileName") { value("archived-support.pdf") }
    }

    val contentResult = mockMvc.get("/api/closing-folders/${closingFolder.id}/documents/${archivedDocument.id}/content") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isOk() } }.andReturn()

    assertThat(String(contentResult.response.contentAsByteArray, StandardCharsets.UTF_8)).isEqualTo("archived-content")

    mockMvc.perform(
      multipart("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/documents")
        .file(pdfFile("support.pdf", "blocked"))
        .param("sourceLabel", "ERP")
        .header(ACTIVE_TENANT_HEADER, tenantId.toString())
        .with(actorJwt("user-123"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isConflict)

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `upload enforces tenant access role and workpaper state rules`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val otherTenantId = uuid("22222222-2222-2222-2222-222222222222")
    val closingFolder = seedClosingFolder(tenantId)
    val otherClosingFolder = seedClosingFolder(otherTenantId)
    seedMembership("reviewer", tenantId, TenantRole.REVIEWER)
    seedMembership("manager", tenantId, TenantRole.MANAGER)
    seedMembership("manager-beta", otherTenantId, TenantRole.MANAGER)
    seedPreviewReadyStructure(tenantId, closingFolder.id)
    seedPreviewReadyStructure(otherTenantId, otherClosingFolder.id)
    workpaperTestStore.save(
      workpaper(
        tenantId = tenantId,
        closingFolderId = closingFolder.id,
        anchorCode = "BS.ASSET.CURRENT_SECTION",
        anchorLabel = "Current assets",
        status = WorkpaperStatus.READY_FOR_REVIEW
      )
    )

    mockMvc.perform(
      multipart("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/documents")
        .file(pdfFile("support.pdf", "forbidden"))
        .param("sourceLabel", "ERP")
        .header(ACTIVE_TENANT_HEADER, tenantId.toString())
        .with(actorJwt("reviewer"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden)

    mockMvc.perform(
      multipart("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/documents")
        .file(pdfFile("support.pdf", "non-editable"))
        .param("sourceLabel", "ERP")
        .header(ACTIVE_TENANT_HEADER, tenantId.toString())
        .with(actorJwt("manager"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isConflict)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/documents") {
      header(ACTIVE_TENANT_HEADER, otherTenantId.toString())
      with(actorJwt("manager-beta"))
    }.andExpect { status { isNotFound() } }
  }

  @Test
  fun `upload rejects missing workpaper blocked closing stale anchor and oversized file`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val missingWorkpaperClosing = seedClosingFolder(tenantId)
    val blockedClosing = seedClosingFolder(tenantId)
    val staleClosing = seedClosingFolder(tenantId)
    seedMembership("manager", tenantId, TenantRole.MANAGER)
    seedPreviewReadyStructure(tenantId, missingWorkpaperClosing.id)
    seedImportVersion(
      tenantId,
      blockedClosing.id,
      1,
      listOf(
        BalanceImportLine(2, "1000", "Cash", decimal("100.00"), decimal("0.00")),
        BalanceImportLine(3, "3000", "Revenue", decimal("0.00"), decimal("100.00"))
      )
    )
    seedPreviewReadyStructure(tenantId, staleClosing.id)
    val staleWorkpaper = workpaper(
      tenantId = tenantId,
      closingFolderId = staleClosing.id,
      anchorCode = "BS.ASSET.CURRENT_SECTION",
      anchorLabel = "Current assets",
      status = WorkpaperStatus.DRAFT
    )
    workpaperTestStore.save(staleWorkpaper)
    manualMappingTestStore.deleteByAccountCode(tenantId, staleClosing.id, "1000")
    manualMappingTestStore.save(manualMapping(tenantId, staleClosing.id, "1000", "BS.ASSET"))

    mockMvc.perform(
      multipart("/api/closing-folders/${missingWorkpaperClosing.id}/workpapers/BS.ASSET.CURRENT_SECTION/documents")
        .file(pdfFile("support.pdf", "missing"))
        .param("sourceLabel", "ERP")
        .header(ACTIVE_TENANT_HEADER, tenantId.toString())
        .with(actorJwt("manager"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isNotFound)

    mockMvc.perform(
      multipart("/api/closing-folders/${blockedClosing.id}/workpapers/BS.ASSET.CURRENT_SECTION/documents")
        .file(pdfFile("support.pdf", "blocked"))
        .param("sourceLabel", "ERP")
        .header(ACTIVE_TENANT_HEADER, tenantId.toString())
        .with(actorJwt("manager"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isConflict)

    mockMvc.perform(
      multipart("/api/closing-folders/${staleClosing.id}/workpapers/BS.ASSET.CURRENT_SECTION/documents")
        .file(pdfFile("support.pdf", "stale"))
        .param("sourceLabel", "ERP")
        .header(ACTIVE_TENANT_HEADER, tenantId.toString())
        .with(actorJwt("manager"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isConflict)

    mockMvc.perform(
      multipart("/api/closing-folders/${missingWorkpaperClosing.id}/workpapers/BS.ASSET.CURRENT_SECTION/documents")
        .file(oversizedPdfFile())
        .param("sourceLabel", "ERP")
        .header(ACTIVE_TENANT_HEADER, tenantId.toString())
        .with(actorJwt("manager"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isPayloadTooLarge)
  }

  private fun seedMembership(
    subject: String,
    tenantId: UUID,
    vararg roles: TenantRole,
    membershipStatus: String = "ACTIVE",
    tenantStatus: String = "ACTIVE"
  ) {
    identityTestStore.seedMembership(
      subject,
      tenantId,
      "tenant-${tenantId.toString().take(4)}",
      "Tenant",
      membershipStatus,
      tenantStatus,
      "ACTIVE",
      *roles
    )
  }

  private fun seedClosingFolder(
    tenantId: UUID,
    id: UUID = UUID.randomUUID(),
    status: ClosingFolderStatus = ClosingFolderStatus.DRAFT
  ): ClosingFolder {
    val now = OffsetDateTime.now(ZoneOffset.UTC)
    val folder = ClosingFolder(
      id = id,
      tenantId = tenantId,
      name = "Closing FY24",
      periodStartOn = LocalDate.parse("2024-01-01"),
      periodEndOn = LocalDate.parse("2024-12-31"),
      externalRef = null,
      status = status,
      archivedAt = if (status == ClosingFolderStatus.ARCHIVED) now else null,
      archivedByUserId = if (status == ClosingFolderStatus.ARCHIVED) UUID.randomUUID() else null,
      createdAt = now.minusDays(1),
      updatedAt = now
    )
    closingFolderTestStore.save(folder)
    return folder
  }

  private fun seedPreviewReadyStructure(tenantId: UUID, closingFolderId: UUID) {
    seedImportVersion(
      tenantId,
      closingFolderId,
      2,
      listOf(
        BalanceImportLine(2, "1000", "Cash", decimal("100.00"), decimal("0.00")),
        BalanceImportLine(3, "3000", "Revenue", decimal("0.00"), decimal("100.00"))
      )
    )
    manualMappingTestStore.save(manualMapping(tenantId, closingFolderId, "1000", "BS.ASSET.CASH_AND_EQUIVALENTS"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolderId, "3000", "PL.REVENUE.OPERATING_REVENUE"))
  }

  private fun seedImportVersion(
    tenantId: UUID,
    closingFolderId: UUID,
    version: Int,
    lines: List<BalanceImportLine>
  ) {
    val totalDebit = lines.fold(decimal("0")) { sum, line -> sum + line.debit }
    val totalCredit = lines.fold(decimal("0")) { sum, line -> sum + line.credit }
    balanceImportTestStore.save(
      BalanceImportSnapshot(
        import = BalanceImport(
          id = UUID.randomUUID(),
          tenantId = tenantId,
          closingFolderId = closingFolderId,
          version = version,
          sourceFileName = "seed.csv",
          importedAt = OffsetDateTime.now(ZoneOffset.UTC).minusHours(version.toLong()),
          importedByUserId = UUID.randomUUID(),
          rowCount = lines.size,
          totalDebit = totalDebit,
          totalCredit = totalCredit
        ),
        lines = lines
      )
    )
  }

  private fun manualMapping(
    tenantId: UUID,
    closingFolderId: UUID,
    accountCode: String,
    targetCode: String
  ) = ch.qamwaq.ritomer.mapping.domain.ManualMapping(
    id = UUID.randomUUID(),
    tenantId = tenantId,
    closingFolderId = closingFolderId,
    accountCode = accountCode,
    targetCode = targetCode,
    createdAt = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(5),
    updatedAt = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(5),
    createdByUserId = UUID.randomUUID(),
    updatedByUserId = UUID.randomUUID()
  )

  private fun workpaper(
    tenantId: UUID,
    closingFolderId: UUID,
    anchorCode: String,
    anchorLabel: String,
    breakdownType: WorkpaperBreakdownType = WorkpaperBreakdownType.SECTION,
    status: WorkpaperStatus = WorkpaperStatus.DRAFT
  ): Workpaper {
    val workpaperId = UUID.randomUUID()
    return Workpaper(
      id = workpaperId,
      tenantId = tenantId,
      closingFolderId = closingFolderId,
      anchorCode = anchorCode,
      anchorLabel = anchorLabel,
      summaryBucketCode = "BS.ASSET",
      statementKind = WorkpaperStatementKind.BALANCE_SHEET,
      breakdownType = breakdownType,
      noteText = "Justification",
      status = status,
      reviewComment = null,
      basisImportVersion = 2,
      basisTaxonomyVersion = 2,
      createdAt = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(5),
      createdByUserId = UUID.randomUUID(),
      updatedAt = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(5),
      updatedByUserId = UUID.randomUUID(),
      reviewedAt = null,
      reviewedByUserId = null,
      evidences = listOf(
        WorkpaperEvidence(
          id = UUID.randomUUID(),
          tenantId = tenantId,
          workpaperId = workpaperId,
          position = 1,
          fileName = "invoice.pdf",
          mediaType = "application/pdf",
          documentDate = null,
          sourceLabel = "ERP",
          verificationStatus = WorkpaperEvidenceVerificationStatus.UNVERIFIED,
          externalReference = null,
          checksumSha256 = null
        )
      )
    )
  }

  private fun storedDocument(
    tenantId: UUID,
    workpaperId: UUID,
    fileName: String,
    content: String,
    mediaType: String = "application/pdf"
  ): Document {
    val documentId = UUID.randomUUID()
    val objectKey = "tenants/$tenantId/workpapers/$workpaperId/documents/$documentId"
    val bytes = content.toByteArray(StandardCharsets.UTF_8)
    val storagePath = Path.of("build", "test-documents").resolve(objectKey.replace('/', java.io.File.separatorChar))
    Files.createDirectories(storagePath.parent)
    Files.write(storagePath, bytes)

    return Document(
      id = documentId,
      tenantId = tenantId,
      workpaperId = workpaperId,
      storageBackend = DocumentStorageBackend.LOCAL_FS,
      storageObjectKey = objectKey,
      fileName = fileName,
      mediaType = mediaType,
      byteSize = bytes.size.toLong(),
      checksumSha256 = sha256(bytes),
      sourceLabel = "ERP",
      documentDate = LocalDate.parse("2024-12-31"),
      createdAt = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(2),
      createdByUserId = UUID.randomUUID()
    )
  }

  private fun pdfFile(fileName: String, content: String): MockMultipartFile =
    MockMultipartFile("file", fileName, "application/pdf", content.toByteArray(StandardCharsets.UTF_8))

  private fun oversizedPdfFile(): MockMultipartFile =
    MockMultipartFile("file", "too-large.pdf", "application/pdf", ByteArray(26 * 1024 * 1024))

  private fun sha256(bytes: ByteArray): String =
    java.security.MessageDigest.getInstance("SHA-256")
      .digest(bytes)
      .joinToString("") { "%02x".format(it) }

  private fun decimal(value: String) = java.math.BigDecimal(value)

  private fun uuid(value: String): UUID = UUID.fromString(value)
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
