package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.imports.domain.BalanceImportSnapshot
import ch.qamwaq.ritomer.mapping.domain.ManualMapping
import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import ch.qamwaq.ritomer.workpapers.application.WORKPAPER_CREATED_ACTION
import ch.qamwaq.ritomer.workpapers.application.WORKPAPER_REVIEW_STATUS_CHANGED_ACTION
import ch.qamwaq.ritomer.workpapers.application.WORKPAPER_UPDATED_ACTION
import ch.qamwaq.ritomer.workpapers.domain.Document
import ch.qamwaq.ritomer.workpapers.domain.DocumentStorageBackend
import ch.qamwaq.ritomer.workpapers.domain.Workpaper
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperBreakdownType
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperEvidence
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperEvidenceVerificationStatus
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatementKind
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatus
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import java.nio.file.Files
import java.nio.file.Path
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers.nullValue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class)
class WorkpapersApiTest {
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
  fun `workpapers endpoints require authentication`() {
    val closingFolderId = UUID.randomUUID()
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")

    mockMvc.get("/api/closing-folders/$closingFolderId/workpapers") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
    }.andExpect { status { isUnauthorized() } }

    mockMvc.put("/api/closing-folders/$closingFolderId/workpapers/BS.ASSET.CURRENT_SECTION") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"noteText":"x","status":"DRAFT","evidences":[]}"""
    }.andExpect { status { isUnauthorized() } }

    mockMvc.post("/api/closing-folders/$closingFolderId/workpapers/BS.ASSET.CURRENT_SECTION/review-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REVIEWED"}"""
    }.andExpect { status { isUnauthorized() } }
  }

  @Test
  fun `workpapers endpoints return 400 on bad tenant header and invalid id`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers") {
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers") {
      header(ACTIVE_TENANT_HEADER, " ")
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers") {
      header(ACTIVE_TENANT_HEADER, "not-a-uuid")
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/not-a-uuid/workpapers") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `all read roles can get workpapers and reads never audit`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedPreviewReadyStructure(tenantId, closingFolder.id)
    seedMembership("accountant", tenantId, TenantRole.ACCOUNTANT)
    seedMembership("reviewer", tenantId, TenantRole.REVIEWER)
    seedMembership("manager", tenantId, TenantRole.MANAGER)
    seedMembership("admin", tenantId, TenantRole.ADMIN)

    listOf("accountant", "reviewer", "manager", "admin").forEach { subject ->
      mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers") {
        header(ACTIVE_TENANT_HEADER, tenantId.toString())
        with(actorJwt(subject))
      }.andExpect { status { isOk() } }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `get returns current anchors even without persisted workpaper`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.REVIEWER)
    seedPreviewReadyStructure(tenantId, closingFolder.id)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.closingFolderStatus") { value("DRAFT") }
      jsonPath("$.readiness") { value("READY") }
      jsonPath("$.summaryCounts.totalCurrentAnchors") { value(2) }
      jsonPath("$.summaryCounts.withWorkpaperCount") { value(0) }
      jsonPath("$.summaryCounts.missingCount") { value(2) }
      jsonPath("$.items.length()") { value(2) }
      jsonPath("$.items[0].anchorCode") { value("BS.ASSET.CURRENT_SECTION") }
      jsonPath("$.items[0].isCurrentStructure") { value(true) }
      jsonPath("$.items[0].workpaper") { value(nullValue()) }
      jsonPath("$.items[0].documents.length()") { value(0) }
      jsonPath("$.items[0].documentVerificationSummary") { value(nullValue()) }
      jsonPath("$.staleWorkpapers.length()") { value(0) }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `get separates stale workpapers from current items`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.MANAGER)
    seedPreviewReadyStructure(tenantId, closingFolder.id)
    workpaperTestStore.save(
      workpaper(
        tenantId = tenantId,
        closingFolderId = closingFolder.id,
        anchorCode = "BS.ASSET.CURRENT_SECTION",
        anchorLabel = "Current assets"
      )
    )
    workpaperTestStore.save(
      workpaper(
        tenantId = tenantId,
        closingFolderId = closingFolder.id,
        anchorCode = "BS.ASSET.LEGACY_BUCKET_FALLBACK",
        anchorLabel = "Legacy bucket-level mappings",
        breakdownType = WorkpaperBreakdownType.LEGACY_BUCKET_FALLBACK
      )
    )
    val currentWorkpaper = workpaperTestStore.findByAnchorCode(tenantId, closingFolder.id, "BS.ASSET.CURRENT_SECTION")!!
    val staleWorkpaper = workpaperTestStore.findByAnchorCode(tenantId, closingFolder.id, "BS.ASSET.LEGACY_BUCKET_FALLBACK")!!
    documentTestStore.save(document(tenantId, currentWorkpaper.id, "current-support.pdf"))
    documentTestStore.save(document(tenantId, staleWorkpaper.id, "legacy-support.xlsx", mediaType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.summaryCounts.totalCurrentAnchors") { value(2) }
      jsonPath("$.summaryCounts.withWorkpaperCount") { value(1) }
      jsonPath("$.summaryCounts.staleCount") { value(1) }
      jsonPath("$.items[0].anchorCode") { value("BS.ASSET.CURRENT_SECTION") }
      jsonPath("$.items[0].workpaper.id") { value(org.hamcrest.Matchers.notNullValue()) }
      jsonPath("$.items[0].documents.length()") { value(1) }
      jsonPath("$.items[0].documents[0].fileName") { value("current-support.pdf") }
      jsonPath("$.items[0].documentVerificationSummary.documentsCount") { value(1) }
      jsonPath("$.items[0].documentVerificationSummary.unverifiedCount") { value(1) }
      jsonPath("$.staleWorkpapers[0].anchorCode") { value("BS.ASSET.LEGACY_BUCKET_FALLBACK") }
      jsonPath("$.staleWorkpapers[0].isCurrentStructure") { value(false) }
      jsonPath("$.staleWorkpapers[0].documents.length()") { value(1) }
      jsonPath("$.staleWorkpapers[0].documents[0].fileName") { value("legacy-support.xlsx") }
      jsonPath("$.staleWorkpapers[0].documentVerificationSummary.documentsCount") { value(1) }
    }
  }

  @Test
  fun `stale workpaper stays visible but both write endpoints reject it`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.MANAGER)
    seedPreviewReadyStructure(tenantId, closingFolder.id)
    workpaperTestStore.save(
      workpaper(
        tenantId = tenantId,
        closingFolderId = closingFolder.id,
        anchorCode = "BS.ASSET.CURRENT_SECTION",
        anchorLabel = "Current assets"
      )
    )

    manualMappingTestStore.deleteByAccountCode(tenantId, closingFolder.id, "1000")
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1000", "BS.ASSET"))

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.items[0].anchorCode") { value("BS.ASSET.LEGACY_BUCKET_FALLBACK") }
      jsonPath("$.staleWorkpapers[0].anchorCode") { value("BS.ASSET.CURRENT_SECTION") }
    }

    mockMvc.put("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"noteText":"x","status":"DRAFT","evidences":[]}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isConflict() } }

    mockMvc.post("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/review-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REVIEWED"}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isConflict() } }
  }

  @Test
  fun `put create update and noop follow audit rules`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.MANAGER)
    seedPreviewReadyStructure(tenantId, closingFolder.id)

    mockMvc.put("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """
        {
          "noteText":" Cash tie-out ",
          "status":"DRAFT",
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
      with(actorJwt("user-123"))
    }.andExpect {
      status { isCreated() }
      jsonPath("$.anchorCode") { value("BS.ASSET.CURRENT_SECTION") }
      jsonPath("$.workpaper.status") { value("DRAFT") }
      jsonPath("$.workpaper.evidences[0].position") { value(1) }
      jsonPath("$.workpaper.evidences[0].fileName") { value("invoice.pdf") }
      jsonPath("$.workpaper.evidences[1].mediaType") { value("text/csv") }
      jsonPath("$.workpaper.evidences[1].checksumSha256") { value("abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789") }
    }

    assertThat(auditTestStore.auditEvents()).hasSize(1)
    assertThat(auditTestStore.auditEvents().last().command.action).isEqualTo(WORKPAPER_CREATED_ACTION)

    mockMvc.put("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """
        {
          "noteText":"Cash tie-out updated",
          "status":"READY_FOR_REVIEW",
          "evidences":[
            {
              "position":1,
              "fileName":"invoice.pdf",
              "mediaType":"application/pdf",
              "sourceLabel":"ERP",
              "verificationStatus":"VERIFIED"
            }
          ]
        }
      """.trimIndent()
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.workpaper.status") { value("READY_FOR_REVIEW") }
      jsonPath("$.workpaper.evidences.length()") { value(1) }
    }

    assertThat(auditTestStore.auditEvents()).hasSize(2)
    assertThat(auditTestStore.auditEvents().last().command.action).isEqualTo(WORKPAPER_UPDATED_ACTION)

    mockMvc.put("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """
        {
          "noteText":"Cash tie-out updated",
          "status":"READY_FOR_REVIEW",
          "evidences":[
            {
              "position":1,
              "fileName":"invoice.pdf",
              "mediaType":"application/pdf",
              "sourceLabel":"ERP",
              "verificationStatus":"VERIFIED"
            }
          ]
        }
      """.trimIndent()
      with(actorJwt("user-123"))
    }.andExpect { status { isOk() } }

    assertThat(auditTestStore.auditEvents()).hasSize(2)
  }

  @Test
  fun `maker update is rejected once workpaper is ready for review`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.MANAGER)
    seedPreviewReadyStructure(tenantId, closingFolder.id)
    workpaperTestStore.save(
      workpaper(
        tenantId = tenantId,
        closingFolderId = closingFolder.id,
        anchorCode = "BS.ASSET.CURRENT_SECTION",
        anchorLabel = "Current assets",
        status = WorkpaperStatus.READY_FOR_REVIEW
      )
    )

    mockMvc.put("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """
        {
          "noteText":"Changed after review",
          "status":"READY_FOR_REVIEW",
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
      with(actorJwt("user-123"))
    }.andExpect { status { isConflict() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `review decision is reviewer only and supports noop`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("reviewer", tenantId, TenantRole.REVIEWER)
    seedMembership("accountant", tenantId, TenantRole.ACCOUNTANT)
    seedPreviewReadyStructure(tenantId, closingFolder.id)
    workpaperTestStore.save(
      workpaper(
        tenantId = tenantId,
        closingFolderId = closingFolder.id,
        anchorCode = "BS.ASSET.CURRENT_SECTION",
        anchorLabel = "Current assets",
        status = WorkpaperStatus.READY_FOR_REVIEW
      )
    )

    mockMvc.post("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/review-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REVIEWED"}"""
      with(actorJwt("accountant"))
    }.andExpect { status { isForbidden() } }

    mockMvc.post("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/review-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REVIEWED"}"""
      with(actorJwt("reviewer"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.workpaper.status") { value("REVIEWED") }
    }

    assertThat(auditTestStore.auditEvents()).hasSize(1)
    assertThat(auditTestStore.auditEvents().last().command.action).isEqualTo(WORKPAPER_REVIEW_STATUS_CHANGED_ACTION)

    mockMvc.post("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/review-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REVIEWED"}"""
      with(actorJwt("reviewer"))
    }.andExpect { status { isOk() } }

    assertThat(auditTestStore.auditEvents()).hasSize(1)
  }

  @Test
  fun `reviewed gate requires documents to leave unverified and have at least one verified when documents exist`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("reviewer", tenantId, TenantRole.REVIEWER)
    seedPreviewReadyStructure(tenantId, closingFolder.id)
    val persistedWorkpaper = workpaper(
      tenantId = tenantId,
      closingFolderId = closingFolder.id,
      anchorCode = "BS.ASSET.CURRENT_SECTION",
      anchorLabel = "Current assets",
      status = WorkpaperStatus.READY_FOR_REVIEW
    )
    workpaperTestStore.save(persistedWorkpaper)
    val unverifiedDocument = document(tenantId, persistedWorkpaper.id, "support.pdf")
    documentTestStore.save(unverifiedDocument)

    mockMvc.post("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/review-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REVIEWED"}"""
      with(actorJwt("reviewer"))
    }.andExpect { status { isConflict() } }

    mockMvc.post("/api/closing-folders/${closingFolder.id}/documents/${unverifiedDocument.id}/verification-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"VERIFIED"}"""
      with(actorJwt("reviewer"))
    }.andExpect { status { isOk() } }

    mockMvc.post("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/review-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REVIEWED"}"""
      with(actorJwt("reviewer"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.workpaper.status") { value("REVIEWED") }
    }
  }

  @Test
  fun `reviewed gate allows rejected documents if at least one verified and none unverified remain`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("reviewer", tenantId, TenantRole.REVIEWER)
    seedPreviewReadyStructure(tenantId, closingFolder.id)
    val persistedWorkpaper = workpaper(
      tenantId = tenantId,
      closingFolderId = closingFolder.id,
      anchorCode = "BS.ASSET.CURRENT_SECTION",
      anchorLabel = "Current assets",
      status = WorkpaperStatus.READY_FOR_REVIEW
    )
    workpaperTestStore.save(persistedWorkpaper)
    val firstDocument = document(tenantId, persistedWorkpaper.id, "first.pdf")
    val secondDocument = document(tenantId, persistedWorkpaper.id, "second.pdf")
    documentTestStore.save(firstDocument)
    documentTestStore.save(secondDocument)

    mockMvc.post("/api/closing-folders/${closingFolder.id}/documents/${firstDocument.id}/verification-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"VERIFIED"}"""
      with(actorJwt("reviewer"))
    }.andExpect { status { isOk() } }

    mockMvc.post("/api/closing-folders/${closingFolder.id}/documents/${secondDocument.id}/verification-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REJECTED","comment":"Duplicate"}"""
      with(actorJwt("reviewer"))
    }.andExpect { status { isOk() } }

    mockMvc.post("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/review-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REVIEWED"}"""
      with(actorJwt("reviewer"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.workpaper.status") { value("REVIEWED") }
    }
  }

  @Test
  fun `archived closing remains readable but writes return 409`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId, status = ClosingFolderStatus.ARCHIVED)
    seedMembership("user-123", tenantId, TenantRole.MANAGER)
    seedPreviewReadyStructure(tenantId, closingFolder.id)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.closingFolderStatus") { value("ARCHIVED") }
    }

    mockMvc.put("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"noteText":"x","status":"DRAFT","evidences":[]}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isConflict() } }

    mockMvc.post("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/review-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REVIEWED"}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isConflict() } }
  }

  @Test
  fun `blocked closing is readable with next action but writes return 409`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.MANAGER)
    seedImportVersion(
      tenantId,
      closingFolder.id,
      1,
      listOf(
        BalanceImportLine(2, "1000", "Cash", decimal("100.00"), decimal("0.00")),
        BalanceImportLine(3, "3000", "Revenue", decimal("0.00"), decimal("100.00"))
      )
    )
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1000", "BS.ASSET.CASH_AND_EQUIVALENTS"))

    mockMvc.get("/api/closing-folders/${closingFolder.id}/workpapers") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.readiness") { value("BLOCKED") }
      jsonPath("$.nextAction.code") { value("COMPLETE_MANUAL_MAPPING") }
      jsonPath("$.items.length()") { value(1) }
      jsonPath("$.items[0].anchorCode") { value("BS.ASSET.CURRENT_SECTION") }
    }

    mockMvc.put("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"noteText":"x","status":"DRAFT","evidences":[]}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isConflict() } }

    mockMvc.post("/api/closing-folders/${closingFolder.id}/workpapers/BS.ASSET.CURRENT_SECTION/review-decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REVIEWED"}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isConflict() } }
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
  ) = ManualMapping(
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

  private fun document(
    tenantId: UUID,
    workpaperId: UUID,
    fileName: String,
    mediaType: String = "application/pdf"
  ) = Document(
    id = UUID.randomUUID(),
    tenantId = tenantId,
    workpaperId = workpaperId,
    storageBackend = DocumentStorageBackend.LOCAL_FS,
    storageObjectKey = "tenants/$tenantId/workpapers/$workpaperId/documents/${UUID.randomUUID()}",
    fileName = fileName,
    mediaType = mediaType,
    byteSize = 128,
    checksumSha256 = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    sourceLabel = "ERP",
    documentDate = LocalDate.parse("2024-12-31"),
    createdAt = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(2),
    createdByUserId = UUID.randomUUID()
  )

  private fun decimal(value: String) = java.math.BigDecimal(value)

  private fun uuid(value: String): UUID = UUID.fromString(value)
}

private fun deleteDirectoryIfExists(path: Path) {
  if (!Files.exists(path)) {
    return
  }

  Files.walk(path)
    .sorted(Comparator.reverseOrder())
    .forEach(Files::deleteIfExists)
}

private fun actorJwt(
  subject: String,
  extraClaims: Map<String, Any> = emptyMap()
) = jwt().jwt { token ->
  token.subject(subject)
  extraClaims.forEach { (claimName, value) -> token.claim(claimName, value) }
}
