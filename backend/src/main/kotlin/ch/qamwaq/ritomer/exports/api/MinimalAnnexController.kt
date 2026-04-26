package ch.qamwaq.ritomer.exports.api

import ch.qamwaq.ritomer.exports.application.MinimalAnnexBasis
import ch.qamwaq.ritomer.exports.application.MinimalAnnexBadRequestException
import ch.qamwaq.ritomer.exports.application.MinimalAnnexContent
import ch.qamwaq.ritomer.exports.application.MinimalAnnexDocumentTrace
import ch.qamwaq.ritomer.exports.application.MinimalAnnexEvidenceSummary
import ch.qamwaq.ritomer.exports.application.MinimalAnnexExportPackBasis
import ch.qamwaq.ritomer.exports.application.MinimalAnnexFinancialStatements
import ch.qamwaq.ritomer.exports.application.MinimalAnnexIssue
import ch.qamwaq.ritomer.exports.application.MinimalAnnexIssueTarget
import ch.qamwaq.ritomer.exports.application.MinimalAnnexLegalNotice
import ch.qamwaq.ritomer.exports.application.MinimalAnnexReadModel
import ch.qamwaq.ritomer.exports.application.MinimalAnnexService
import ch.qamwaq.ritomer.exports.application.MinimalAnnexWorkpaper
import ch.qamwaq.ritomer.financials.access.StructuredBalanceSheetReadModel
import ch.qamwaq.ritomer.financials.access.StructuredIncomeStatementReadModel
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessNotFoundException
import ch.qamwaq.ritomer.identity.access.TenantAccessResolver
import ch.qamwaq.ritomer.shared.application.InvalidTenantHeaderException
import com.fasterxml.jackson.annotation.JsonInclude
import java.util.UUID
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.AccessDeniedException
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException

@Validated
@RestController
@RequestMapping("/api/closing-folders/{closingFolderId}/minimal-annex")
class MinimalAnnexController(
  private val tenantAccessResolver: TenantAccessResolver,
  private val minimalAnnexService: MinimalAnnexService
) {
  @GetMapping
  fun getMinimalAnnex(
    @PathVariable closingFolderId: UUID,
    @RequestParam queryParameters: Map<String, String>,
    @RequestHeader(HttpHeaders.ACCEPT, required = false) acceptHeader: String?
  ): MinimalAnnexResponse {
    validateOutputRequest(queryParameters, acceptHeader)
    return minimalAnnexService.getMinimalAnnex(
      tenantAccessResolver.resolveRequiredTenantAccess(),
      closingFolderId
    ).toResponse()
  }

  @ExceptionHandler(MinimalAnnexBadRequestException::class)
  fun handleMinimalAnnexBadRequest(exception: MinimalAnnexBadRequestException): ResponseEntity<MinimalAnnexErrorResponse> =
    ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
      MinimalAnnexErrorResponse(code = exception.code, message = exception.message.orEmpty())
    )

  @ExceptionHandler(InvalidTenantHeaderException::class)
  fun handleInvalidTenantHeader(exception: InvalidTenantHeaderException): ResponseEntity<MinimalAnnexErrorResponse> =
    ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
      MinimalAnnexErrorResponse(code = "INVALID_TENANT_HEADER", message = exception.message.orEmpty())
    )

  @ExceptionHandler(AccessDeniedException::class)
  fun handleForbidden(exception: AccessDeniedException): ResponseEntity<MinimalAnnexErrorResponse> =
    ResponseEntity.status(HttpStatus.FORBIDDEN).body(
      MinimalAnnexErrorResponse(code = "TENANT_OR_ROLE_FORBIDDEN", message = exception.message.orEmpty())
    )

  @ExceptionHandler(ClosingFolderAccessNotFoundException::class)
  fun handleClosingNotFound(exception: ClosingFolderAccessNotFoundException): ResponseEntity<MinimalAnnexErrorResponse> =
    ResponseEntity.status(HttpStatus.NOT_FOUND).body(
      MinimalAnnexErrorResponse(code = "CLOSING_FOLDER_NOT_FOUND", message = exception.message.orEmpty())
    )

  @ExceptionHandler(MethodArgumentTypeMismatchException::class)
  fun handleInvalidPathParameter(exception: MethodArgumentTypeMismatchException): ResponseEntity<MinimalAnnexErrorResponse> =
    ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
      MinimalAnnexErrorResponse(code = "INVALID_REQUEST", message = exception.message.orEmpty())
    )

  private fun validateOutputRequest(queryParameters: Map<String, String>, acceptHeader: String?) {
    val accept = acceptHeader.orEmpty().lowercase()
    if (accept.contains("application/pdf") || accept.contains("application/zip")) {
      throw MinimalAnnexBadRequestException(
        code = "ANNEX_OUTPUT_FORMAT_OUT_OF_SCOPE",
        message = "Minimal annex is JSON-only in this slice."
      )
    }

    if (queryParameters.isEmpty()) {
      return
    }

    if (queryParameters.any { (key, value) -> key.hasOutputParameterSignal() || value.hasOutputValueSignal() }) {
      throw MinimalAnnexBadRequestException(
        code = "ANNEX_OUTPUT_FORMAT_OUT_OF_SCOPE",
        message = "Minimal annex is JSON-only in this slice."
      )
    }

    val normalized = queryParameters.flatMap { (key, value) ->
      listOf(key.lowercase(), value.lowercase())
    }
    if (normalized.any { it.hasStatutorySignal() }) {
      throw MinimalAnnexBadRequestException(
        code = "ANNEX_STATUTORY_CONFUSION_REJECTED",
        message = "Statutory, official, signed or definitive annex requests are out of scope."
      )
    }

    throw MinimalAnnexBadRequestException(
      code = "ANNEX_OUTPUT_FORMAT_OUT_OF_SCOPE",
      message = "Query parameters are not supported for minimal annex in this slice."
    )
  }

  private fun String.hasOutputParameterSignal(): Boolean =
    OUTPUT_PARAMETER_SIGNALS.any { compactSignal().contains(it) }

  private fun String.hasOutputValueSignal(): Boolean =
    OUTPUT_VALUE_SIGNALS.any { compactSignal().contains(it) }

  private fun String.compactSignal(): String =
    lowercase().filter { it.isLetterOrDigit() }

  private fun String.hasStatutorySignal(): Boolean =
    contains("statutory") ||
      contains("official") ||
      contains("officiel") ||
      contains("officielle") ||
      contains("signature") ||
      contains("signed") ||
      contains("signe") ||
      contains("signee") ||
      contains("definitif") ||
      contains("definitive") ||
      contains("conforme co")

  private companion object {
    private val OUTPUT_PARAMETER_SIGNALS = setOf(
      "download",
      "exportstorage",
      "pdf",
      "signedurl",
      "storage",
      "storageoutput",
      "zip"
    )

    private val OUTPUT_VALUE_SIGNALS = setOf(
      "download",
      "exportstorage",
      "pdf",
      "signedurl",
      "storage",
      "storageoutput",
      "zip"
    )
  }
}

@JsonInclude(JsonInclude.Include.ALWAYS)
data class MinimalAnnexResponse(
  val closingFolderId: String,
  val closingFolderStatus: String,
  val readiness: String,
  val annexState: String,
  val presentationType: String,
  val isStatutory: Boolean,
  val requiresHumanReview: Boolean,
  val legalNotice: MinimalAnnexLegalNoticeResponse,
  val basis: MinimalAnnexBasisResponse,
  val blockers: List<MinimalAnnexIssueResponse>,
  val warnings: List<MinimalAnnexIssueResponse>,
  val annex: MinimalAnnexContentResponse?
)

data class MinimalAnnexLegalNoticeResponse(
  val title: String,
  val notOfficialCoAnnex: String,
  val noAutomaticValidation: String,
  val humanReviewRequired: String
)

data class MinimalAnnexBasisResponse(
  val controlsReadiness: String?,
  val latestImportVersion: Int?,
  val taxonomyVersion: Int?,
  val structuredStatementState: String?,
  val structuredPresentationType: String?,
  val exportPack: MinimalAnnexExportPackBasisResponse?
)

data class MinimalAnnexExportPackBasisResponse(
  val exportPackId: String,
  val createdAt: String,
  val basisImportVersion: Int,
  val basisTaxonomyVersion: Int
)

data class MinimalAnnexIssueResponse(
  val code: String,
  val message: String,
  val source: String,
  val target: MinimalAnnexIssueTargetResponse?
)

data class MinimalAnnexIssueTargetResponse(
  val type: String,
  val code: String?,
  val id: String?
)

data class MinimalAnnexContentResponse(
  val financialStatements: MinimalAnnexFinancialStatementsResponse,
  val workpapers: List<MinimalAnnexWorkpaperResponse>,
  val evidenceSummary: MinimalAnnexEvidenceSummaryResponse,
  val preparationLimits: List<String>
)

data class MinimalAnnexFinancialStatementsResponse(
  val presentationType: String,
  val latestImportVersion: Int,
  val taxonomyVersion: Int,
  val balanceSheet: StructuredBalanceSheetReadModel,
  val incomeStatement: StructuredIncomeStatementReadModel
)

data class MinimalAnnexWorkpaperResponse(
  val anchorCode: String,
  val anchorLabel: String,
  val summaryBucketCode: String,
  val statementKind: String,
  val breakdownType: String,
  val workpaperId: String,
  val noteText: String,
  val reviewedAt: String?,
  val reviewedByUserId: String?,
  val documents: List<MinimalAnnexDocumentTraceResponse>
)

data class MinimalAnnexDocumentTraceResponse(
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

data class MinimalAnnexEvidenceSummaryResponse(
  val currentWorkpaperCount: Int,
  val attachedDocumentCount: Int,
  val verifiedDocumentCount: Int,
  val rejectedDocumentTraceCount: Int,
  val staleWorkpaperExcludedCount: Int,
  val currentWorkpaperWithoutDocumentCount: Int
)

data class MinimalAnnexErrorResponse(
  val code: String,
  val message: String
)

private fun MinimalAnnexReadModel.toResponse(): MinimalAnnexResponse =
  MinimalAnnexResponse(
    closingFolderId = closingFolderId.toString(),
    closingFolderStatus = closingFolderStatus,
    readiness = readiness,
    annexState = annexState,
    presentationType = presentationType,
    isStatutory = isStatutory,
    requiresHumanReview = requiresHumanReview,
    legalNotice = legalNotice.toResponse(),
    basis = basis.toResponse(),
    blockers = blockers.map { it.toResponse() },
    warnings = warnings.map { it.toResponse() },
    annex = annex?.toResponse()
  )

private fun MinimalAnnexLegalNotice.toResponse(): MinimalAnnexLegalNoticeResponse =
  MinimalAnnexLegalNoticeResponse(
    title = title,
    notOfficialCoAnnex = notOfficialCoAnnex,
    noAutomaticValidation = noAutomaticValidation,
    humanReviewRequired = humanReviewRequired
  )

private fun MinimalAnnexBasis.toResponse(): MinimalAnnexBasisResponse =
  MinimalAnnexBasisResponse(
    controlsReadiness = controlsReadiness,
    latestImportVersion = latestImportVersion,
    taxonomyVersion = taxonomyVersion,
    structuredStatementState = structuredStatementState,
    structuredPresentationType = structuredPresentationType,
    exportPack = exportPack?.toResponse()
  )

private fun MinimalAnnexExportPackBasis.toResponse(): MinimalAnnexExportPackBasisResponse =
  MinimalAnnexExportPackBasisResponse(
    exportPackId = exportPackId,
    createdAt = createdAt,
    basisImportVersion = basisImportVersion,
    basisTaxonomyVersion = basisTaxonomyVersion
  )

private fun MinimalAnnexIssue.toResponse(): MinimalAnnexIssueResponse =
  MinimalAnnexIssueResponse(
    code = code,
    message = message,
    source = source,
    target = target?.toResponse()
  )

private fun MinimalAnnexIssueTarget.toResponse(): MinimalAnnexIssueTargetResponse =
  MinimalAnnexIssueTargetResponse(type = type, code = code, id = id)

private fun MinimalAnnexContent.toResponse(): MinimalAnnexContentResponse =
  MinimalAnnexContentResponse(
    financialStatements = financialStatements.toResponse(),
    workpapers = workpapers.map { it.toResponse() },
    evidenceSummary = evidenceSummary.toResponse(),
    preparationLimits = preparationLimits
  )

private fun MinimalAnnexFinancialStatements.toResponse(): MinimalAnnexFinancialStatementsResponse =
  MinimalAnnexFinancialStatementsResponse(
    presentationType = presentationType,
    latestImportVersion = latestImportVersion,
    taxonomyVersion = taxonomyVersion,
    balanceSheet = balanceSheet,
    incomeStatement = incomeStatement
  )

private fun MinimalAnnexWorkpaper.toResponse(): MinimalAnnexWorkpaperResponse =
  MinimalAnnexWorkpaperResponse(
    anchorCode = anchorCode,
    anchorLabel = anchorLabel,
    summaryBucketCode = summaryBucketCode,
    statementKind = statementKind,
    breakdownType = breakdownType,
    workpaperId = workpaperId,
    noteText = noteText,
    reviewedAt = reviewedAt,
    reviewedByUserId = reviewedByUserId,
    documents = documents.map { it.toResponse() }
  )

private fun MinimalAnnexDocumentTrace.toResponse(): MinimalAnnexDocumentTraceResponse =
  MinimalAnnexDocumentTraceResponse(
    documentId = documentId,
    fileName = fileName,
    mediaType = mediaType,
    byteSize = byteSize,
    checksumSha256 = checksumSha256,
    sourceLabel = sourceLabel,
    documentDate = documentDate,
    verificationStatus = verificationStatus,
    evidenceRole = evidenceRole
  )

private fun MinimalAnnexEvidenceSummary.toResponse(): MinimalAnnexEvidenceSummaryResponse =
  MinimalAnnexEvidenceSummaryResponse(
    currentWorkpaperCount = currentWorkpaperCount,
    attachedDocumentCount = attachedDocumentCount,
    verifiedDocumentCount = verifiedDocumentCount,
    rejectedDocumentTraceCount = rejectedDocumentTraceCount,
    staleWorkpaperExcludedCount = staleWorkpaperExcludedCount,
    currentWorkpaperWithoutDocumentCount = currentWorkpaperWithoutDocumentCount
  )
