package ch.qamwaq.ritomer.exports.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccess
import ch.qamwaq.ritomer.controls.access.ControlsReadModel
import ch.qamwaq.ritomer.controls.access.ControlsReadModelAccess
import ch.qamwaq.ritomer.exports.domain.ExportPack
import ch.qamwaq.ritomer.financials.access.StructuredBalanceSheetReadModel
import ch.qamwaq.ritomer.financials.access.StructuredFinancialStatementsReadModel
import ch.qamwaq.ritomer.financials.access.StructuredFinancialStatementsReadModelAccess
import ch.qamwaq.ritomer.financials.access.StructuredIncomeStatementReadModel
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.workpapers.access.WorkpaperDocumentReadModel
import ch.qamwaq.ritomer.workpapers.access.WorkpaperItemReadModel
import ch.qamwaq.ritomer.workpapers.access.WorkpapersReadModel
import ch.qamwaq.ritomer.workpapers.access.WorkpapersReadModelAccess
import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.web.bind.annotation.ResponseStatus

data class MinimalAnnexReadModel(
  val closingFolderId: UUID,
  val closingFolderStatus: String,
  val readiness: String,
  val annexState: String,
  val presentationType: String,
  val isStatutory: Boolean,
  val requiresHumanReview: Boolean,
  val legalNotice: MinimalAnnexLegalNotice,
  val basis: MinimalAnnexBasis,
  val blockers: List<MinimalAnnexIssue>,
  val warnings: List<MinimalAnnexIssue>,
  val annex: MinimalAnnexContent?
)

data class MinimalAnnexLegalNotice(
  val title: String,
  val notOfficialCoAnnex: String,
  val noAutomaticValidation: String,
  val humanReviewRequired: String
)

data class MinimalAnnexBasis(
  val controlsReadiness: String?,
  val latestImportVersion: Int?,
  val taxonomyVersion: Int?,
  val structuredStatementState: String?,
  val structuredPresentationType: String?,
  val exportPack: MinimalAnnexExportPackBasis?
)

data class MinimalAnnexExportPackBasis(
  val exportPackId: String,
  val createdAt: String,
  val basisImportVersion: Int,
  val basisTaxonomyVersion: Int
)

data class MinimalAnnexIssue(
  val code: String,
  val message: String,
  val source: String,
  val target: MinimalAnnexIssueTarget?
)

data class MinimalAnnexIssueTarget(
  val type: String,
  val code: String?,
  val id: String?
)

data class MinimalAnnexContent(
  val financialStatements: MinimalAnnexFinancialStatements,
  val workpapers: List<MinimalAnnexWorkpaper>,
  val evidenceSummary: MinimalAnnexEvidenceSummary,
  val preparationLimits: List<String>
)

data class MinimalAnnexFinancialStatements(
  val presentationType: String,
  val latestImportVersion: Int,
  val taxonomyVersion: Int,
  val balanceSheet: StructuredBalanceSheetReadModel,
  val incomeStatement: StructuredIncomeStatementReadModel
)

data class MinimalAnnexWorkpaper(
  val anchorCode: String,
  val anchorLabel: String,
  val summaryBucketCode: String,
  val statementKind: String,
  val breakdownType: String,
  val workpaperId: String,
  val noteText: String,
  val reviewedAt: String?,
  val reviewedByUserId: String?,
  val documents: List<MinimalAnnexDocumentTrace>
)

data class MinimalAnnexDocumentTrace(
  val documentId: String,
  val fileName: String,
  val mediaType: String,
  val byteSize: Long,
  val checksumSha256: String,
  val sourceLabel: String,
  val documentDate: String?,
  val verificationStatus: String,
  val evidenceRole: String
)

data class MinimalAnnexEvidenceSummary(
  val currentWorkpaperCount: Int,
  val attachedDocumentCount: Int,
  val verifiedDocumentCount: Int,
  val rejectedDocumentTraceCount: Int,
  val staleWorkpaperExcludedCount: Int,
  val currentWorkpaperWithoutDocumentCount: Int
)

@Service
class MinimalAnnexService(
  private val closingFolderAccess: ClosingFolderAccess,
  private val controlsReadModelAccess: ControlsReadModelAccess,
  private val structuredFinancialStatementsReadModelAccess: StructuredFinancialStatementsReadModelAccess,
  private val workpapersReadModelAccess: WorkpapersReadModelAccess,
  private val exportPackRepository: ExportPackRepository
) {
  fun getMinimalAnnex(access: TenantAccessContext, closingFolderId: UUID): MinimalAnnexReadModel {
    requireAnyRole(access, READ_ROLES, "minimal annex read")
    val closingFolder = closingFolderAccess.getRequired(access.tenantId, closingFolderId)
    val controls = controlsReadModelAccess.getReadModel(access, closingFolderId)
    val structuredStatements = structuredFinancialStatementsReadModelAccess.getReadModel(access, closingFolderId)
    val workpapers = workpapersReadModelAccess.getReadModel(access, closingFolderId)
    val latestExportPack = exportPackRepository.findByClosingFolder(access.tenantId, closingFolderId).firstOrNull()

    val blockers = buildBlockers(controls, structuredStatements, workpapers, latestExportPack)
    val warnings = buildWarnings(workpapers)
    val annex = if (blockers.isEmpty()) {
      buildAnnex(structuredStatements, workpapers)
    } else {
      null
    }

    return MinimalAnnexReadModel(
      closingFolderId = closingFolder.id,
      closingFolderStatus = closingFolder.status.name,
      readiness = controls.readiness,
      annexState = if (blockers.isEmpty()) READY_STATE else BLOCKED_STATE,
      presentationType = PRESENTATION_TYPE,
      isStatutory = false,
      requiresHumanReview = true,
      legalNotice = LEGAL_NOTICE,
      basis = MinimalAnnexBasis(
        controlsReadiness = controls.readiness,
        latestImportVersion = structuredStatements.latestImportVersion,
        taxonomyVersion = structuredStatements.taxonomyVersion,
        structuredStatementState = structuredStatements.statementState,
        structuredPresentationType = structuredStatements.presentationType,
        exportPack = latestExportPack?.toBasis()
      ),
      blockers = blockers,
      warnings = warnings,
      annex = annex
    )
  }

  private fun buildBlockers(
    controls: ControlsReadModel,
    structuredStatements: StructuredFinancialStatementsReadModel,
    workpapers: WorkpapersReadModel,
    latestExportPack: ExportPack?
  ): List<MinimalAnnexIssue> {
    val blockers = mutableListOf<MinimalAnnexIssue>()

    if (controls.readiness != READY_STATE) {
      blockers += issue(
        code = "CLOSING_NOT_READY",
        message = "Closing controls are not ready.",
        source = "CONTROLS"
      )
    }

    blockers += structuredStatementBlockers(structuredStatements)
    blockers += workpaperBlockers(workpapers)
    blockers += exportPackBlockers(structuredStatements, latestExportPack)

    return blockers
  }

  private fun structuredStatementBlockers(
    structuredStatements: StructuredFinancialStatementsReadModel
  ): List<MinimalAnnexIssue> {
    if (structuredStatements.latestImportVersion == null || structuredStatements.statementState == "NO_DATA") {
      return listOf(
        issue(
          code = "STRUCTURED_FINANCIAL_STATEMENTS_MISSING",
          message = "Structured financial statements preview is missing.",
          source = "FINANCIAL_STATEMENTS_STRUCTURED"
        )
      )
    }

    val blockers = mutableListOf<MinimalAnnexIssue>()
    if (structuredStatements.statementState != "PREVIEW_READY") {
      blockers += issue(
        code = "STRUCTURED_FINANCIAL_STATEMENTS_NOT_PREVIEW_READY",
        message = "Structured financial statements are not PREVIEW_READY.",
        source = "FINANCIAL_STATEMENTS_STRUCTURED"
      )
    }
    if (structuredStatements.isStatutory) {
      blockers += issue(
        code = "STATUTORY_SOURCE_REJECTED",
        message = "Statutory structured financial statements cannot feed the minimal operational annex.",
        source = "FINANCIAL_STATEMENTS_STRUCTURED"
      )
    }
    if (structuredStatements.balanceSheet == null || structuredStatements.incomeStatement == null) {
      blockers += issue(
        code = "STRUCTURED_FINANCIAL_STATEMENTS_MISSING",
        message = "Structured balance sheet and income statement are required.",
        source = "FINANCIAL_STATEMENTS_STRUCTURED"
      )
    }
    return blockers
  }

  private fun workpaperBlockers(workpapers: WorkpapersReadModel): List<MinimalAnnexIssue> {
    val blockers = mutableListOf<MinimalAnnexIssue>()
    val currentItems = workpapers.items
    if (currentItems.isEmpty()) {
      blockers += issue(
        code = "CURRENT_WORKPAPER_MISSING",
        message = "No current workpaper anchor is available.",
        source = "WORKPAPERS"
      )
      return blockers
    }

    currentItems
      .filter { it.workpaper == null }
      .forEach { item ->
        blockers += issue(
          code = "CURRENT_WORKPAPER_MISSING",
          message = "A current anchor has no persisted workpaper.",
          source = "WORKPAPERS",
          target = target("WORKPAPER_ANCHOR", code = item.anchorCode)
        )
      }

    currentItems
      .mapNotNull { item -> item.workpaper?.let { item to it } }
      .filter { (_, workpaper) -> workpaper.status != "REVIEWED" }
      .forEach { (item, workpaper) ->
        blockers += issue(
          code = "CURRENT_WORKPAPER_NOT_REVIEWED",
          message = "A current workpaper is not REVIEWED.",
          source = "WORKPAPERS",
          target = target("WORKPAPER_ANCHOR", code = item.anchorCode, id = workpaper.id)
        )
      }

    currentItems
      .flatMap { item ->
        item.documents
          .filter { it.verificationStatus == "UNVERIFIED" }
          .map { item to it }
      }
      .forEach { (item, document) ->
        blockers += issue(
          code = "DOCUMENT_UNVERIFIED",
          message = "A document on a current workpaper is still UNVERIFIED.",
          source = "DOCUMENTS",
          target = target("DOCUMENT", code = item.anchorCode, id = document.documentId)
        )
      }

    return blockers
  }

  private fun exportPackBlockers(
    structuredStatements: StructuredFinancialStatementsReadModel,
    latestExportPack: ExportPack?
  ): List<MinimalAnnexIssue> {
    if (latestExportPack == null) {
      return listOf(
        issue(
          code = "EXPORT_PACK_MISSING",
          message = "No audit-ready export pack exists for this closing folder.",
          source = "EXPORT_PACK"
        )
      )
    }

    val previewImportVersion = structuredStatements.latestImportVersion
    val basisMatches = previewImportVersion != null &&
      latestExportPack.basisImportVersion == previewImportVersion &&
      latestExportPack.basisTaxonomyVersion == structuredStatements.taxonomyVersion

    if (!basisMatches) {
      return listOf(
        issue(
          code = "EXPORT_PACK_BASIS_MISMATCH",
          message = "The latest export pack basis does not match the current structured preview basis.",
          source = "EXPORT_PACK",
          target = target("EXPORT_PACK", id = latestExportPack.id.toString())
        )
      )
    }

    return emptyList()
  }

  private fun buildWarnings(workpapers: WorkpapersReadModel): List<MinimalAnnexIssue> {
    val warnings = mutableListOf<MinimalAnnexIssue>()
    if (workpapers.staleWorkpapers.isNotEmpty()) {
      warnings += issue(
        code = "STALE_WORKPAPERS_EXCLUDED",
        message = "Stale workpapers are historical traces and are excluded from the current annex.",
        source = "WORKPAPERS"
      )
    }

    workpapers.items
      .filter { it.workpaper != null && it.documents.isEmpty() }
      .forEach { item ->
        warnings += issue(
          code = "NO_DOCUMENT_ATTACHED",
          message = "A reviewed current workpaper has no attached document.",
          source = "DOCUMENTS",
          target = target("WORKPAPER_ANCHOR", code = item.anchorCode, id = item.workpaper?.id)
        )
      }

    workpapers.items
      .flatMap { item ->
        item.documents
          .filter { it.verificationStatus == "REJECTED" }
          .map { item to it }
      }
      .forEach { (item, document) ->
        warnings += issue(
          code = "DOCUMENT_REJECTED_INCLUDED_AS_TRACE",
          message = "A rejected document remains visible as a trace and is not treated as verified support.",
          source = "DOCUMENTS",
          target = target("DOCUMENT", code = item.anchorCode, id = document.documentId)
        )
      }

    workpapers.items
      .filter { it.breakdownType == "LEGACY_BUCKET_FALLBACK" }
      .forEach { item ->
        warnings += issue(
          code = "LEGACY_MAPPING_FALLBACK_USED",
          message = "A current anchor uses legacy bucket fallback granularity.",
          source = "FINANCIAL_STATEMENTS_STRUCTURED",
          target = target("WORKPAPER_ANCHOR", code = item.anchorCode)
        )
      }

    return warnings
  }

  private fun buildAnnex(
    structuredStatements: StructuredFinancialStatementsReadModel,
    workpapers: WorkpapersReadModel
  ): MinimalAnnexContent {
    val balanceSheet = requireNotNull(structuredStatements.balanceSheet) {
      "balanceSheet is required when minimal annex is READY."
    }
    val incomeStatement = requireNotNull(structuredStatements.incomeStatement) {
      "incomeStatement is required when minimal annex is READY."
    }
    val latestImportVersion = requireNotNull(structuredStatements.latestImportVersion) {
      "latestImportVersion is required when minimal annex is READY."
    }
    val currentItems = workpapers.items.sortedBy { it.anchorCode }
    val documents = currentItems.flatMap { it.documents }

    return MinimalAnnexContent(
      financialStatements = MinimalAnnexFinancialStatements(
        presentationType = structuredStatements.presentationType,
        latestImportVersion = latestImportVersion,
        taxonomyVersion = structuredStatements.taxonomyVersion,
        balanceSheet = balanceSheet,
        incomeStatement = incomeStatement
      ),
      workpapers = currentItems.map { it.toAnnexWorkpaper() },
      evidenceSummary = MinimalAnnexEvidenceSummary(
        currentWorkpaperCount = currentItems.size,
        attachedDocumentCount = documents.size,
        verifiedDocumentCount = documents.count { it.verificationStatus == "VERIFIED" },
        rejectedDocumentTraceCount = documents.count { it.verificationStatus == "REJECTED" },
        staleWorkpaperExcludedCount = workpapers.staleWorkpapers.size,
        currentWorkpaperWithoutDocumentCount = currentItems.count { it.documents.isEmpty() }
      ),
      preparationLimits = PREPARATION_LIMITS
    )
  }

  private fun WorkpaperItemReadModel.toAnnexWorkpaper(): MinimalAnnexWorkpaper {
    val persistedWorkpaper = requireNotNull(workpaper) {
      "workpaper is required when minimal annex is READY."
    }
    return MinimalAnnexWorkpaper(
      anchorCode = anchorCode,
      anchorLabel = anchorLabel,
      summaryBucketCode = summaryBucketCode,
      statementKind = statementKind,
      breakdownType = breakdownType,
      workpaperId = persistedWorkpaper.id,
      noteText = persistedWorkpaper.noteText,
      reviewedAt = persistedWorkpaper.reviewedAt,
      reviewedByUserId = persistedWorkpaper.reviewedByUserId,
      documents = documents.sortedBy { it.documentId }.map { it.toAnnexTrace() }
    )
  }

  private fun WorkpaperDocumentReadModel.toAnnexTrace(): MinimalAnnexDocumentTrace =
    MinimalAnnexDocumentTrace(
      documentId = documentId,
      fileName = fileName,
      mediaType = mediaType,
      byteSize = byteSize,
      checksumSha256 = checksumSha256,
      sourceLabel = sourceLabel,
      documentDate = documentDate,
      verificationStatus = verificationStatus,
      evidenceRole = when (verificationStatus) {
        "REJECTED" -> "REJECTED_TRACE"
        else -> "VERIFIED_SUPPORT"
      }
    )

  private fun ExportPack.toBasis(): MinimalAnnexExportPackBasis =
    MinimalAnnexExportPackBasis(
      exportPackId = id.toString(),
      createdAt = createdAt.toString(),
      basisImportVersion = basisImportVersion,
      basisTaxonomyVersion = basisTaxonomyVersion
    )

  private fun requireAnyRole(access: TenantAccessContext, allowedRoles: Set<String>, operation: String) {
    if (access.effectiveRoles.none { it in allowedRoles }) {
      throw AccessDeniedException("Insufficient role for $operation.")
    }
  }

  private fun issue(
    code: String,
    message: String,
    source: String,
    target: MinimalAnnexIssueTarget? = null
  ): MinimalAnnexIssue =
    MinimalAnnexIssue(code = code, message = message, source = source, target = target)

  private fun target(type: String, code: String? = null, id: String? = null): MinimalAnnexIssueTarget =
    MinimalAnnexIssueTarget(type = type, code = code, id = id)

  companion object {
    private const val READY_STATE = "READY"
    private const val BLOCKED_STATE = "BLOCKED"
    private const val PRESENTATION_TYPE = "MINIMAL_OPERATIONAL_ANNEX"
    private val READ_ROLES = setOf("ACCOUNTANT", "REVIEWER", "MANAGER", "ADMIN")
    private val LEGAL_NOTICE = MinimalAnnexLegalNotice(
      title = "Annexe minimale operationnelle, non statutaire.",
      notOfficialCoAnnex = "Ne remplace pas une annexe officielle CO.",
      noAutomaticValidation = "Aucune validation comptable automatique n'est effectuee.",
      humanReviewRequired = "Revue humaine requise avant tout usage engageant."
    )
    private val PREPARATION_LIMITS = listOf(
      "Read-model operationnel derive au moment de la requete.",
      "Aucun snapshot d'annexe n'est persiste.",
      "Aucun PDF, signature ou validation automatique n'est produit.",
      "Revue humaine requise avant tout usage engageant."
    )
  }
}

@ResponseStatus(HttpStatus.BAD_REQUEST)
class MinimalAnnexBadRequestException(
  val code: String,
  message: String
) : RuntimeException(message)
