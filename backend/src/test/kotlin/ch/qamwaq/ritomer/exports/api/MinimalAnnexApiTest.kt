package ch.qamwaq.ritomer.exports.api

import ch.qamwaq.ritomer.AuditTestStore
import ch.qamwaq.ritomer.BalanceImportTestStore
import ch.qamwaq.ritomer.ClosingFolderTestStore
import ch.qamwaq.ritomer.DocumentTestStore
import ch.qamwaq.ritomer.ExportPackTestStore
import ch.qamwaq.ritomer.IdentityTestConfiguration
import ch.qamwaq.ritomer.IdentityTestStore
import ch.qamwaq.ritomer.ManualMappingTestStore
import ch.qamwaq.ritomer.WorkpaperTestStore
import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import ch.qamwaq.ritomer.exports.application.ExportPackRepository
import ch.qamwaq.ritomer.exports.domain.ExportPack
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.imports.domain.BalanceImportSnapshot
import ch.qamwaq.ritomer.mapping.domain.ManualMapping
import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import ch.qamwaq.ritomer.workpapers.domain.Document
import ch.qamwaq.ritomer.workpapers.domain.DocumentStorageBackend
import ch.qamwaq.ritomer.workpapers.domain.DocumentVerificationStatus
import ch.qamwaq.ritomer.workpapers.domain.Workpaper
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperBreakdownType
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatementKind
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatus
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers.hasItem
import org.hamcrest.Matchers.not
import org.hamcrest.Matchers.nullValue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class)
class MinimalAnnexApiTest {
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
  private lateinit var exportPackTestStore: ExportPackTestStore

  @Autowired
  private lateinit var exportPackRepository: ExportPackRepository

  @BeforeEach
  fun resetStores() {
    identityTestStore.reset()
    auditTestStore.reset()
    closingFolderTestStore.reset()
    balanceImportTestStore.reset()
    manualMappingTestStore.reset()
    workpaperTestStore.reset()
    documentTestStore.reset()
    exportPackTestStore.reset()
  }

  @Test
  fun `minimal annex returns READY nominal and emits no audit`() {
    val closingFolder = seedReadyClosing()
    seedMembership("accountant", DEFAULT_TENANT_ID, TenantRole.ACCOUNTANT)

    val response = mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("accountant"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.closingFolderStatus") { value("DRAFT") }
      jsonPath("$.readiness") { value("READY") }
      jsonPath("$.annexState") { value("READY") }
      jsonPath("$.presentationType") { value("MINIMAL_OPERATIONAL_ANNEX") }
      jsonPath("$.isStatutory") { value(false) }
      jsonPath("$.requiresHumanReview") { value(true) }
      jsonPath("$.blockers.length()") { value(0) }
      jsonPath("$.annex.financialStatements.presentationType") { value("STRUCTURED_PREVIEW") }
      jsonPath("$.annex.evidenceSummary.currentWorkpaperCount") { value(2) }
      jsonPath("$.annex.evidenceSummary.verifiedDocumentCount") { value(2) }
      jsonPath("$.annex.workpapers[0].documents[0].evidenceRole") { value("VERIFIED_SUPPORT") }
    }.andReturn().response.contentAsString

    assertThat(response).doesNotContain("storageObjectKey")
    assertThat(response).doesNotContain("storage_object_key")
    assertThat(response).doesNotContain("hidden-storage-key")
    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `minimal annex allows ARCHIVED closing read when sources are coherent`() {
    val closingFolder = seedReadyClosing(status = ClosingFolderStatus.ARCHIVED)
    seedMembership("manager", DEFAULT_TENANT_ID, TenantRole.MANAGER)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("manager"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.closingFolderStatus") { value("ARCHIVED") }
      jsonPath("$.annexState") { value("READY") }
      jsonPath("$.annex") { value(not(nullValue())) }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `minimal annex returns 400 on invalid tenant header and out of scope request`() {
    val closingFolder = seedReadyClosing()
    seedMembership("accountant", DEFAULT_TENANT_ID, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex") {
      with(actorJwt("accountant"))
    }.andExpect {
      status { isBadRequest() }
      jsonPath("$.code") { value("INVALID_TENANT_HEADER") }
    }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, " ")
      with(actorJwt("accountant"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, "not-a-uuid")
      with(actorJwt("accountant"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/not-a-uuid/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("accountant"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex?format=pdf") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("accountant"))
    }.andExpect {
      status { isBadRequest() }
      jsonPath("$.code") { value("ANNEX_OUTPUT_FORMAT_OUT_OF_SCOPE") }
    }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex?download=signed-url") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("accountant"))
    }.andExpect {
      status { isBadRequest() }
      jsonPath("$.code") { value("ANNEX_OUTPUT_FORMAT_OUT_OF_SCOPE") }
    }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex?output=signedUrl") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("accountant"))
    }.andExpect {
      status { isBadRequest() }
      jsonPath("$.code") { value("ANNEX_OUTPUT_FORMAT_OUT_OF_SCOPE") }
    }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex?view=compact") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("accountant"))
    }.andExpect {
      status { isBadRequest() }
      jsonPath("$.code") { value("ANNEX_OUTPUT_FORMAT_OUT_OF_SCOPE") }
    }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex?status=statutory") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("accountant"))
    }.andExpect {
      status { isBadRequest() }
      jsonPath("$.code") { value("ANNEX_STATUTORY_CONFUSION_REJECTED") }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `minimal annex requires authentication`() {
    mockMvc.get("/api/closing-folders/${UUID.randomUUID()}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
    }.andExpect { status { isUnauthorized() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `minimal annex returns 403 for inaccessible tenant inactive membership inactive tenant or no allowed role`() {
    val closingFolder = seedReadyClosing()
    val otherTenantId = uuid("22222222-2222-2222-2222-222222222222")
    seedMembership("accountant", DEFAULT_TENANT_ID, TenantRole.ACCOUNTANT)
    seedMembership("inactive-membership", DEFAULT_TENANT_ID, TenantRole.ACCOUNTANT, membershipStatus = "INACTIVE")
    seedMembership("inactive-tenant", DEFAULT_TENANT_ID, TenantRole.ACCOUNTANT, tenantStatus = "INACTIVE")
    seedMembership("no-grant", DEFAULT_TENANT_ID)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, otherTenantId.toString())
      with(actorJwt("accountant"))
    }.andExpect { status { isForbidden() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("inactive-membership"))
    }.andExpect { status { isForbidden() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("inactive-tenant"))
    }.andExpect { status { isForbidden() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("no-grant"))
    }.andExpect { status { isForbidden() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `minimal annex returns 404 when closing is absent or outside tenant`() {
    val otherTenantId = uuid("22222222-2222-2222-2222-222222222222")
    val betaClosing = seedReadyClosing(tenantId = otherTenantId)
    seedMembership("accountant", DEFAULT_TENANT_ID, TenantRole.ACCOUNTANT)
    seedMembership("accountant", otherTenantId, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${UUID.randomUUID()}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("accountant"))
    }.andExpect { status { isNotFound() } }

    mockMvc.get("/api/closing-folders/${betaClosing.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("accountant"))
    }.andExpect { status { isNotFound() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `minimal annex returns BLOCKED when closing or structured statements are not ready`() {
    val closingFolder = seedClosingFolder(DEFAULT_TENANT_ID)
    seedMembership("accountant", DEFAULT_TENANT_ID, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("accountant"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.annexState") { value("BLOCKED") }
      jsonPath("$.annex") { value(nullValue()) }
      jsonPath("$.blockers[*].code") { value(hasItem("CLOSING_NOT_READY")) }
      jsonPath("$.blockers[*].code") { value(hasItem("STRUCTURED_FINANCIAL_STATEMENTS_MISSING")) }
    }

    resetBusinessStores()
    val incompleteClosing = seedReadyFinancialStructure(completeMapping = false)
    seedMembership("accountant", DEFAULT_TENANT_ID, TenantRole.ACCOUNTANT)
    seedExportPack(DEFAULT_TENANT_ID, incompleteClosing.id, basisImportVersion = 3, basisTaxonomyVersion = 2)

    mockMvc.get("/api/closing-folders/${incompleteClosing.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("accountant"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.annexState") { value("BLOCKED") }
      jsonPath("$.annex") { value(nullValue()) }
      jsonPath("$.blockers[*].code") { value(hasItem("STRUCTURED_FINANCIAL_STATEMENTS_NOT_PREVIEW_READY")) }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `minimal annex returns BLOCKED when current workpaper is missing or not reviewed`() {
    val closingWithoutWorkpapers = seedReadyClosing(seedWorkpapers = false)
    seedMembership("reviewer", DEFAULT_TENANT_ID, TenantRole.REVIEWER)

    mockMvc.get("/api/closing-folders/${closingWithoutWorkpapers.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("reviewer"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.annexState") { value("BLOCKED") }
      jsonPath("$.blockers[*].code") { value(hasItem("CURRENT_WORKPAPER_MISSING")) }
    }

    resetBusinessStores()
    val draftWorkpaperClosing = seedReadyClosing(workpaperStatus = WorkpaperStatus.DRAFT, attachDocuments = false)
    seedMembership("reviewer", DEFAULT_TENANT_ID, TenantRole.REVIEWER)

    mockMvc.get("/api/closing-folders/${draftWorkpaperClosing.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("reviewer"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.annexState") { value("BLOCKED") }
      jsonPath("$.blockers[*].code") { value(hasItem("CURRENT_WORKPAPER_NOT_REVIEWED")) }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `minimal annex returns BLOCKED when current document is unverified`() {
    val closingFolder = seedReadyClosing(documentStatus = DocumentVerificationStatus.UNVERIFIED)
    seedMembership("manager", DEFAULT_TENANT_ID, TenantRole.MANAGER)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("manager"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.annexState") { value("BLOCKED") }
      jsonPath("$.annex") { value(nullValue()) }
      jsonPath("$.blockers[*].code") { value(hasItem("DOCUMENT_UNVERIFIED")) }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `minimal annex returns BLOCKED when export pack is absent or basis mismatched`() {
    val closingWithoutExportPack = seedReadyClosing(withExportPack = false)
    seedMembership("accountant", DEFAULT_TENANT_ID, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${closingWithoutExportPack.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("accountant"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.annexState") { value("BLOCKED") }
      jsonPath("$.blockers[*].code") { value(hasItem("EXPORT_PACK_MISSING")) }
    }

    resetBusinessStores()
    val mismatchedClosing = seedReadyClosing(withExportPack = false)
    seedMembership("accountant", DEFAULT_TENANT_ID, TenantRole.ACCOUNTANT)
    seedExportPack(DEFAULT_TENANT_ID, mismatchedClosing.id, basisImportVersion = 99, basisTaxonomyVersion = 2)

    mockMvc.get("/api/closing-folders/${mismatchedClosing.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("accountant"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.annexState") { value("BLOCKED") }
      jsonPath("$.blockers[*].code") { value(hasItem("EXPORT_PACK_BASIS_MISMATCH")) }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `minimal annex is READY with stale workpapers excluded and warned`() {
    val closingFolder = seedReadyClosing(includeStaleWorkpaper = true)
    seedMembership("admin", DEFAULT_TENANT_ID, TenantRole.ADMIN)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("admin"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.annexState") { value("READY") }
      jsonPath("$.warnings[*].code") { value(hasItem("STALE_WORKPAPERS_EXCLUDED")) }
      jsonPath("$.annex.evidenceSummary.staleWorkpaperExcludedCount") { value(1) }
      jsonPath("$.annex.workpapers[*].anchorCode") { value(not(hasItem("BS.ASSET.LEGACY_BUCKET_FALLBACK"))) }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `minimal annex is READY with warning when reviewed current workpaper has no document`() {
    val closingFolder = seedReadyClosing(attachDocuments = false)
    seedMembership("reviewer", DEFAULT_TENANT_ID, TenantRole.REVIEWER)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("reviewer"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.annexState") { value("READY") }
      jsonPath("$.warnings[*].code") { value(hasItem("NO_DOCUMENT_ATTACHED")) }
      jsonPath("$.annex.evidenceSummary.currentWorkpaperWithoutDocumentCount") { value(2) }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `minimal annex keeps rejected document as trace with warning and no validated evidence role`() {
    val closingFolder = seedReadyClosing(includeRejectedDocument = true)
    seedMembership("manager", DEFAULT_TENANT_ID, TenantRole.MANAGER)

    val response = mockMvc.get("/api/closing-folders/${closingFolder.id}/minimal-annex") {
      header(ACTIVE_TENANT_HEADER, DEFAULT_TENANT_ID.toString())
      with(actorJwt("manager"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.annexState") { value("READY") }
      jsonPath("$.warnings[*].code") { value(hasItem("DOCUMENT_REJECTED_INCLUDED_AS_TRACE")) }
      jsonPath("$.annex.evidenceSummary.rejectedDocumentTraceCount") { value(1) }
      jsonPath("$.annex.workpapers[0].documents[*].evidenceRole") { value(hasItem("REJECTED_TRACE")) }
    }.andReturn().response.contentAsString

    assertThat(response).doesNotContain("SIGNED")
    assertThat(response).doesNotContain("PDF definitif")
    assertThat(response).doesNotContain("conforme CO")
    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  private fun resetBusinessStores() {
    auditTestStore.reset()
    closingFolderTestStore.reset()
    balanceImportTestStore.reset()
    manualMappingTestStore.reset()
    workpaperTestStore.reset()
    documentTestStore.reset()
    exportPackTestStore.reset()
  }

  private fun seedReadyClosing(
    tenantId: UUID = DEFAULT_TENANT_ID,
    status: ClosingFolderStatus = ClosingFolderStatus.DRAFT,
    withExportPack: Boolean = true,
    seedWorkpapers: Boolean = true,
    workpaperStatus: WorkpaperStatus = WorkpaperStatus.REVIEWED,
    attachDocuments: Boolean = true,
    documentStatus: DocumentVerificationStatus = DocumentVerificationStatus.VERIFIED,
    includeRejectedDocument: Boolean = false,
    includeStaleWorkpaper: Boolean = false
  ): ClosingFolder {
    val closingFolder = seedReadyFinancialStructure(tenantId = tenantId, status = status)
    if (seedWorkpapers) {
      CURRENT_ANCHORS.forEach { anchor ->
        val workpaper = workpaper(
          tenantId = tenantId,
          closingFolderId = closingFolder.id,
          anchor = anchor,
          status = workpaperStatus
        )
        workpaperTestStore.save(workpaper)
        if (attachDocuments) {
          documentTestStore.save(document(tenantId, workpaper.id, "${anchor.anchorCode.lowercase()}.pdf", documentStatus))
        }
      }
      if (includeRejectedDocument) {
        val firstWorkpaper = workpaperTestStore.findByAnchorCode(
          tenantId,
          closingFolder.id,
          CURRENT_ANCHORS.first().anchorCode
        ) ?: error("Expected seeded current workpaper.")
        documentTestStore.save(
          document(
            tenantId = tenantId,
            workpaperId = firstWorkpaper.id,
            fileName = "rejected-duplicate.pdf",
            verificationStatus = DocumentVerificationStatus.REJECTED
          )
        )
      }
    }
    if (includeStaleWorkpaper) {
      workpaperTestStore.save(
        workpaper(
          tenantId = tenantId,
          closingFolderId = closingFolder.id,
          anchor = AnchorSeed(
            anchorCode = "BS.ASSET.LEGACY_BUCKET_FALLBACK",
            anchorLabel = "Legacy bucket-level mappings",
            summaryBucketCode = "BS.ASSET",
            statementKind = WorkpaperStatementKind.BALANCE_SHEET,
            breakdownType = WorkpaperBreakdownType.LEGACY_BUCKET_FALLBACK
          ),
          status = WorkpaperStatus.REVIEWED
        )
      )
    }
    if (withExportPack) {
      seedExportPack(tenantId, closingFolder.id, basisImportVersion = 3, basisTaxonomyVersion = 2)
    }
    return closingFolder
  }

  private fun seedReadyFinancialStructure(
    tenantId: UUID = DEFAULT_TENANT_ID,
    status: ClosingFolderStatus = ClosingFolderStatus.DRAFT,
    completeMapping: Boolean = true
  ): ClosingFolder {
    val closingFolder = seedClosingFolder(tenantId, status = status)
    seedImportVersion(
      tenantId,
      closingFolder.id,
      3,
      listOf(
        BalanceImportLine(2, "1000", "Cash", decimal("100.00"), BigDecimal.ZERO),
        BalanceImportLine(3, "3000", "Revenue", BigDecimal.ZERO, decimal("100.00"))
      )
    )
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1000", "BS.ASSET.CASH_AND_EQUIVALENTS"))
    if (completeMapping) {
      manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "3000", "PL.REVENUE.OPERATING_REVENUE"))
    }
    return closingFolder
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
      archivedByUserId = if (status == ClosingFolderStatus.ARCHIVED) DEFAULT_USER_ID else null,
      createdAt = now.minusDays(1),
      updatedAt = now
    )
    closingFolderTestStore.save(folder)
    return folder
  }

  private fun seedImportVersion(
    tenantId: UUID,
    closingFolderId: UUID,
    version: Int,
    lines: List<BalanceImportLine>
  ) {
    val totalDebit = lines.fold(BigDecimal.ZERO) { sum, line -> sum + line.debit }
    val totalCredit = lines.fold(BigDecimal.ZERO) { sum, line -> sum + line.credit }
    balanceImportTestStore.save(
      BalanceImportSnapshot(
        import = BalanceImport(
          id = UUID.randomUUID(),
          tenantId = tenantId,
          closingFolderId = closingFolderId,
          version = version,
          sourceFileName = "seed.csv",
          importedAt = OffsetDateTime.now(ZoneOffset.UTC).minusHours(version.toLong()),
          importedByUserId = DEFAULT_USER_ID,
          rowCount = lines.size,
          totalDebit = totalDebit,
          totalCredit = totalCredit
        ),
        lines = lines
      )
    )
  }

  private fun seedExportPack(
    tenantId: UUID,
    closingFolderId: UUID,
    basisImportVersion: Int,
    basisTaxonomyVersion: Int
  ): ExportPack =
    exportPackRepository.create(
      ExportPack(
        id = UUID.randomUUID(),
        tenantId = tenantId,
        closingFolderId = closingFolderId,
        idempotencyKey = "seed-${UUID.randomUUID()}",
        sourceFingerprint = "seed-source",
        storageBackend = "LOCAL_FS",
        storageObjectKey = "hidden-storage-key-${UUID.randomUUID()}",
        fileName = "seed.zip",
        mediaType = "application/zip",
        byteSize = 128,
        checksumSha256 = CHECKSUM,
        basisImportVersion = basisImportVersion,
        basisTaxonomyVersion = basisTaxonomyVersion,
        createdAt = OffsetDateTime.now(ZoneOffset.UTC),
        createdByUserId = DEFAULT_USER_ID
      )
    )

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
    createdByUserId = DEFAULT_USER_ID,
    updatedByUserId = DEFAULT_USER_ID
  )

  private fun workpaper(
    tenantId: UUID,
    closingFolderId: UUID,
    anchor: AnchorSeed,
    status: WorkpaperStatus
  ): Workpaper {
    val workpaperId = UUID.randomUUID()
    val reviewedAt = if (status == WorkpaperStatus.REVIEWED) OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1) else null
    return Workpaper(
      id = workpaperId,
      tenantId = tenantId,
      closingFolderId = closingFolderId,
      anchorCode = anchor.anchorCode,
      anchorLabel = anchor.anchorLabel,
      summaryBucketCode = anchor.summaryBucketCode,
      statementKind = anchor.statementKind,
      breakdownType = anchor.breakdownType,
      noteText = "Reviewed note for ${anchor.anchorLabel}",
      status = status,
      reviewComment = null,
      basisImportVersion = 3,
      basisTaxonomyVersion = 2,
      createdAt = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(10),
      createdByUserId = DEFAULT_USER_ID,
      updatedAt = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(2),
      updatedByUserId = DEFAULT_USER_ID,
      reviewedAt = reviewedAt,
      reviewedByUserId = reviewedAt?.let { DEFAULT_USER_ID },
      evidences = emptyList()
    )
  }

  private fun document(
    tenantId: UUID,
    workpaperId: UUID,
    fileName: String,
    verificationStatus: DocumentVerificationStatus
  ): Document {
    val reviewedAt = if (verificationStatus == DocumentVerificationStatus.UNVERIFIED) null else OffsetDateTime.now(ZoneOffset.UTC)
    return Document(
      id = UUID.randomUUID(),
      tenantId = tenantId,
      workpaperId = workpaperId,
      storageBackend = DocumentStorageBackend.LOCAL_FS,
      storageObjectKey = "hidden-document-key-${UUID.randomUUID()}",
      fileName = fileName,
      mediaType = "application/pdf",
      byteSize = 128,
      checksumSha256 = CHECKSUM,
      sourceLabel = "ERP",
      documentDate = LocalDate.parse("2024-12-31"),
      createdAt = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(2),
      createdByUserId = DEFAULT_USER_ID,
      verificationStatus = verificationStatus,
      reviewComment = if (verificationStatus == DocumentVerificationStatus.REJECTED) "Duplicate" else null,
      reviewedAt = reviewedAt,
      reviewedByUserId = reviewedAt?.let { DEFAULT_USER_ID }
    )
  }

  private data class AnchorSeed(
    val anchorCode: String,
    val anchorLabel: String,
    val summaryBucketCode: String,
    val statementKind: WorkpaperStatementKind,
    val breakdownType: WorkpaperBreakdownType
  )

  private fun decimal(value: String): BigDecimal = BigDecimal(value)

  private fun uuid(value: String): UUID = UUID.fromString(value)

  companion object {
    private val DEFAULT_TENANT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111")
    private val DEFAULT_USER_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    private const val CHECKSUM = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
    private val CURRENT_ANCHORS = listOf(
      AnchorSeed(
        anchorCode = "BS.ASSET.CURRENT_SECTION",
        anchorLabel = "Current assets",
        summaryBucketCode = "BS.ASSET",
        statementKind = WorkpaperStatementKind.BALANCE_SHEET,
        breakdownType = WorkpaperBreakdownType.SECTION
      ),
      AnchorSeed(
        anchorCode = "PL.REVENUE.OPERATING_SECTION",
        anchorLabel = "Operating revenue",
        summaryBucketCode = "PL.REVENUE",
        statementKind = WorkpaperStatementKind.INCOME_STATEMENT,
        breakdownType = WorkpaperBreakdownType.SECTION
      )
    )
  }
}

private fun actorJwt(subject: String) = jwt().jwt { token ->
  token.subject(subject)
}
