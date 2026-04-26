package ch.qamwaq.ritomer.exports.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccess
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessView
import ch.qamwaq.ritomer.controls.access.ControlResultReadModel
import ch.qamwaq.ritomer.controls.access.ControlsMappingSummaryReadModel
import ch.qamwaq.ritomer.controls.access.ControlsReadModel
import ch.qamwaq.ritomer.controls.access.ControlsReadModelAccess
import ch.qamwaq.ritomer.exports.domain.ExportPack
import ch.qamwaq.ritomer.financials.access.StructuredBalanceSheetReadModel
import ch.qamwaq.ritomer.financials.access.StructuredBalanceSheetTotalsReadModel
import ch.qamwaq.ritomer.financials.access.StructuredFinancialCoverageReadModel
import ch.qamwaq.ritomer.financials.access.StructuredFinancialStatementsReadModel
import ch.qamwaq.ritomer.financials.access.StructuredFinancialStatementsReadModelAccess
import ch.qamwaq.ritomer.financials.access.StructuredIncomeStatementReadModel
import ch.qamwaq.ritomer.financials.access.StructuredIncomeStatementTotalsReadModel
import ch.qamwaq.ritomer.financials.access.StructuredStatementBreakdownReadModel
import ch.qamwaq.ritomer.financials.access.StructuredStatementGroupReadModel
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.workpapers.access.WorkpaperDetailsReadModel
import ch.qamwaq.ritomer.workpapers.access.WorkpaperDocumentReadModel
import ch.qamwaq.ritomer.workpapers.access.WorkpaperDocumentVerificationSummaryReadModel
import ch.qamwaq.ritomer.workpapers.access.WorkpaperItemReadModel
import ch.qamwaq.ritomer.workpapers.access.WorkpapersBlockerReadModel
import ch.qamwaq.ritomer.workpapers.access.WorkpapersReadModel
import ch.qamwaq.ritomer.workpapers.access.WorkpapersReadModelAccess
import ch.qamwaq.ritomer.workpapers.access.WorkpapersSummaryCountsReadModel
import java.time.OffsetDateTime
import java.util.UUID
import kotlin.test.assertFailsWith
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.security.access.AccessDeniedException

class MinimalAnnexServiceTest {
  private val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
  private val closingFolderId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
  private val actorUserId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

  @Test
  fun `statutory structured source is blocked and annex never becomes statutory`() {
    val service = service(
      structuredAccess = StructuredFinancialStatementsReadModelAccess { _, _ -> readyStructuredStatements(isStatutory = true) }
    )

    val result = service.getMinimalAnnex(readAccess(), closingFolderId)

    assertThat(result.annexState).isEqualTo("BLOCKED")
    assertThat(result.isStatutory).isFalse()
    assertThat(result.requiresHumanReview).isTrue()
    assertThat(result.annex).isNull()
    assertThat(result.blockers.map { it.code }).contains("STATUTORY_SOURCE_REJECTED")
  }

  @Test
  fun `role insufficient is denied before read model is built`() {
    val service = service()

    assertFailsWith<AccessDeniedException> {
      service.getMinimalAnnex(
        readAccess(effectiveRoles = emptySet()),
        closingFolderId
      )
    }
  }

  private fun service(
    structuredAccess: StructuredFinancialStatementsReadModelAccess =
      StructuredFinancialStatementsReadModelAccess { _, _ -> readyStructuredStatements(isStatutory = false) },
    exportPackRepository: ExportPackRepository = FakeExportPackRepository(listOf(readyExportPack()))
  ): MinimalAnnexService =
    MinimalAnnexService(
      closingFolderAccess = object : ClosingFolderAccess {
        override fun getRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView =
          ClosingFolderAccessView(closingFolderId, tenantId, ClosingFolderAccessStatus.DRAFT)

        override fun lockRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView =
          getRequired(tenantId, closingFolderId)
      },
      controlsReadModelAccess = ControlsReadModelAccess { _, _ -> readyControls() },
      structuredFinancialStatementsReadModelAccess = structuredAccess,
      workpapersReadModelAccess = WorkpapersReadModelAccess { _, _ -> readyWorkpapers() },
      exportPackRepository = exportPackRepository
    )

  private fun readAccess(effectiveRoles: Set<String> = setOf("ACCOUNTANT")): TenantAccessContext =
    TenantAccessContext(
      actorUserId = actorUserId,
      actorSubject = "actor",
      tenantId = tenantId,
      effectiveRoles = effectiveRoles
    )

  private fun readyControls(): ControlsReadModel =
    ControlsReadModel(
      closingFolderId = closingFolderId.toString(),
      closingFolderStatus = "DRAFT",
      readiness = "READY",
      latestImportPresent = true,
      latestImportVersion = 3,
      mappingSummary = ControlsMappingSummaryReadModel(total = 2, mapped = 2, unmapped = 0),
      unmappedAccounts = emptyList(),
      controls = listOf(
        ControlResultReadModel(
          code = "LATEST_VALID_BALANCE_IMPORT_PRESENT",
          status = "PASS",
          severity = "BLOCKER",
          message = "Latest valid balance import version 3 is available."
        )
      ),
      nextAction = null
    )

  private fun readyStructuredStatements(isStatutory: Boolean): StructuredFinancialStatementsReadModel =
    StructuredFinancialStatementsReadModel(
      closingFolderId = closingFolderId.toString(),
      closingFolderStatus = "DRAFT",
      readiness = "READY",
      statementState = "PREVIEW_READY",
      presentationType = "STRUCTURED_PREVIEW",
      isStatutory = isStatutory,
      taxonomyVersion = 2,
      latestImportVersion = 3,
      coverage = StructuredFinancialCoverageReadModel(2, 2, 0, "1"),
      blockers = emptyList(),
      nextAction = null,
      balanceSheet = StructuredBalanceSheetReadModel(
        groups = listOf(
          StructuredStatementGroupReadModel(
            code = "BS.ASSET",
            label = "Asset",
            total = "100",
            breakdowns = listOf(
              StructuredStatementBreakdownReadModel(
                code = "BS.ASSET.CURRENT_SECTION",
                label = "Current assets",
                breakdownType = "SECTION",
                total = "100"
              )
            )
          )
        ),
        totals = StructuredBalanceSheetTotalsReadModel("100", "0", "0", "100", "100")
      ),
      incomeStatement = StructuredIncomeStatementReadModel(
        groups = listOf(
          StructuredStatementGroupReadModel(
            code = "PL.REVENUE",
            label = "Revenue",
            total = "100",
            breakdowns = listOf(
              StructuredStatementBreakdownReadModel(
                code = "PL.REVENUE.OPERATING_SECTION",
                label = "Operating revenue",
                breakdownType = "SECTION",
                total = "100"
              )
            )
          )
        ),
        totals = StructuredIncomeStatementTotalsReadModel("100", "0", "100")
      )
    )

  private fun readyWorkpapers(): WorkpapersReadModel =
    WorkpapersReadModel(
      closingFolderId = closingFolderId.toString(),
      closingFolderStatus = "DRAFT",
      readiness = "READY",
      latestImportVersion = 3,
      blockers = emptyList<WorkpapersBlockerReadModel>(),
      nextAction = null,
      summaryCounts = WorkpapersSummaryCountsReadModel(
        totalCurrentAnchors = 1,
        withWorkpaperCount = 1,
        readyForReviewCount = 0,
        reviewedCount = 1,
        staleCount = 0,
        missingCount = 0
      ),
      items = listOf(
        WorkpaperItemReadModel(
          anchorCode = "BS.ASSET.CURRENT_SECTION",
          anchorLabel = "Current assets",
          summaryBucketCode = "BS.ASSET",
          statementKind = "BALANCE_SHEET",
          breakdownType = "SECTION",
          isCurrentStructure = true,
          workpaper = WorkpaperDetailsReadModel(
            id = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc").toString(),
            noteText = "Reviewed note",
            status = "REVIEWED",
            reviewComment = null,
            basisImportVersion = 3,
            basisTaxonomyVersion = 2,
            createdAt = "2025-01-01T00:00:00Z",
            createdByUserId = actorUserId.toString(),
            updatedAt = "2025-01-02T00:00:00Z",
            updatedByUserId = actorUserId.toString(),
            reviewedAt = "2025-01-03T00:00:00Z",
            reviewedByUserId = actorUserId.toString(),
            evidences = emptyList()
          ),
          documents = listOf(
            WorkpaperDocumentReadModel(
              documentId = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd").toString(),
              fileName = "support.pdf",
              mediaType = "application/pdf",
              byteSize = 128,
              checksumSha256 = CHECKSUM,
              sourceLabel = "ERP",
              documentDate = "2024-12-31",
              createdAt = "2025-01-02T00:00:00Z",
              createdByUserId = actorUserId.toString(),
              verificationStatus = "VERIFIED",
              reviewComment = null,
              reviewedAt = "2025-01-03T00:00:00Z",
              reviewedByUserId = actorUserId.toString()
            )
          ),
          documentVerificationSummary = WorkpaperDocumentVerificationSummaryReadModel(
            documentsCount = 1,
            unverifiedCount = 0,
            verifiedCount = 1,
            rejectedCount = 0
          )
        )
      ),
      staleWorkpapers = emptyList()
    )

  private fun readyExportPack(): ExportPack =
    ExportPack(
      id = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
      tenantId = tenantId,
      closingFolderId = closingFolderId,
      idempotencyKey = "seed",
      sourceFingerprint = "seed",
      storageBackend = "LOCAL_FS",
      storageObjectKey = "hidden-storage-key",
      fileName = "seed.zip",
      mediaType = "application/zip",
      byteSize = 128,
      checksumSha256 = CHECKSUM,
      basisImportVersion = 3,
      basisTaxonomyVersion = 2,
      createdAt = OffsetDateTime.parse("2025-01-04T00:00:00Z"),
      createdByUserId = actorUserId
    )

  private class FakeExportPackRepository(
    private val exportPacks: List<ExportPack>
  ) : ExportPackRepository {
    override fun findByIdempotencyKey(tenantId: UUID, closingFolderId: UUID, idempotencyKey: String): ExportPack? = null

    override fun findById(tenantId: UUID, closingFolderId: UUID, exportPackId: UUID): ExportPack? =
      exportPacks.firstOrNull { it.tenantId == tenantId && it.closingFolderId == closingFolderId && it.id == exportPackId }

    override fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): List<ExportPack> =
      exportPacks.filter { it.tenantId == tenantId && it.closingFolderId == closingFolderId }

    override fun create(exportPack: ExportPack): ExportPack = exportPack
  }

  companion object {
    private const val CHECKSUM = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
  }
}
