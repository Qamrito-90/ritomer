package ch.qamwaq.ritomer.workpapers.api

import ch.qamwaq.ritomer.identity.access.TenantAccessResolver
import ch.qamwaq.ritomer.workpapers.application.ClosingWorkpapers
import ch.qamwaq.ritomer.workpapers.application.DocumentSummary
import ch.qamwaq.ritomer.workpapers.application.DocumentVerificationSummary
import ch.qamwaq.ritomer.workpapers.application.WorkpaperDetails
import ch.qamwaq.ritomer.workpapers.application.WorkpaperEvidenceCommand
import ch.qamwaq.ritomer.workpapers.application.WorkpaperEvidenceDetails
import ch.qamwaq.ritomer.workpapers.application.WorkpaperItem
import ch.qamwaq.ritomer.workpapers.application.WorkpaperMutationOutcome
import ch.qamwaq.ritomer.workpapers.application.WorkpaperReviewDecisionCommand
import ch.qamwaq.ritomer.workpapers.application.WorkpaperService
import ch.qamwaq.ritomer.workpapers.application.WorkpaperSummaryCounts
import ch.qamwaq.ritomer.workpapers.application.WorkpaperUpsertCommand
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperEvidenceVerificationStatus
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatus
import com.fasterxml.jackson.annotation.JsonInclude
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Positive
import java.time.LocalDate
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@Validated
@RestController
@RequestMapping("/api/closing-folders/{closingFolderId}/workpapers")
class WorkpapersController(
  private val tenantAccessResolver: TenantAccessResolver,
  private val workpaperService: WorkpaperService
) {
  @GetMapping
  fun getWorkpapers(
    @PathVariable closingFolderId: UUID
  ): ClosingWorkpapersResponse =
    workpaperService.getWorkpapers(tenantAccessResolver.resolveRequiredTenantAccess(), closingFolderId).toResponse()

  @PutMapping("/{anchorCode}")
  fun upsert(
    @PathVariable closingFolderId: UUID,
    @PathVariable anchorCode: String,
    @Valid @RequestBody request: WorkpaperUpsertRequest
  ): ResponseEntity<WorkpaperItemResponse> {
    val result = workpaperService.upsert(
      tenantAccessResolver.resolveRequiredTenantAccess(),
      closingFolderId,
      anchorCode,
      request.toCommand()
    )
    val status = when (result.outcome) {
      WorkpaperMutationOutcome.CREATED -> HttpStatus.CREATED
      WorkpaperMutationOutcome.UPDATED,
      WorkpaperMutationOutcome.NOOP -> HttpStatus.OK
    }
    return ResponseEntity.status(status).body(result.item.toResponse())
  }

  @PostMapping("/{anchorCode}/review-decision")
  fun reviewDecision(
    @PathVariable closingFolderId: UUID,
    @PathVariable anchorCode: String,
    @Valid @RequestBody request: WorkpaperReviewDecisionRequest
  ): WorkpaperItemResponse =
    workpaperService.reviewDecision(
      tenantAccessResolver.resolveRequiredTenantAccess(),
      closingFolderId,
      anchorCode,
      request.toCommand()
    ).item.toResponse()
}

data class WorkpaperUpsertRequest(
  @field:NotBlank
  val noteText: String,
  val status: WorkpaperStatus,
  val evidences: List<@Valid WorkpaperEvidenceRequest> = emptyList()
)

data class WorkpaperEvidenceRequest(
  @field:Positive
  val position: Int,
  @field:NotBlank
  val fileName: String,
  @field:NotBlank
  val mediaType: String,
  val documentDate: LocalDate? = null,
  @field:NotBlank
  val sourceLabel: String,
  val verificationStatus: WorkpaperEvidenceVerificationStatus,
  val externalReference: String? = null,
  val checksumSha256: String? = null
)

data class WorkpaperReviewDecisionRequest(
  val decision: WorkpaperStatus,
  val comment: String?
)

@JsonInclude(JsonInclude.Include.ALWAYS)
data class ClosingWorkpapersResponse(
  val closingFolderId: String,
  val closingFolderStatus: String,
  val readiness: String,
  val latestImportVersion: Int?,
  val blockers: List<WorkpaperBlockerResponse>,
  val nextAction: WorkpaperNextActionResponse?,
  val summaryCounts: WorkpaperSummaryCountsResponse,
  val items: List<WorkpaperItemResponse>,
  val staleWorkpapers: List<WorkpaperItemResponse>
)

data class WorkpaperSummaryCountsResponse(
  val totalCurrentAnchors: Int,
  val withWorkpaperCount: Int,
  val readyForReviewCount: Int,
  val reviewedCount: Int,
  val staleCount: Int,
  val missingCount: Int
)

data class WorkpaperBlockerResponse(
  val code: String,
  val message: String
)

data class WorkpaperNextActionResponse(
  val code: String,
  val path: String,
  val actionable: Boolean
)

@JsonInclude(JsonInclude.Include.ALWAYS)
data class WorkpaperItemResponse(
  val anchorCode: String,
  val anchorLabel: String,
  val summaryBucketCode: String,
  val statementKind: String,
  val breakdownType: String,
  val isCurrentStructure: Boolean,
  val workpaper: WorkpaperDetailsResponse?,
  val documents: List<DocumentSummaryResponse>,
  val documentVerificationSummary: DocumentVerificationSummaryResponse?
)

data class DocumentVerificationSummaryResponse(
  val documentsCount: Int,
  val unverifiedCount: Int,
  val verifiedCount: Int,
  val rejectedCount: Int
)

@JsonInclude(JsonInclude.Include.ALWAYS)
data class WorkpaperDetailsResponse(
  val id: String,
  val noteText: String,
  val status: String,
  val reviewComment: String?,
  val basisImportVersion: Int,
  val basisTaxonomyVersion: Int,
  val createdAt: String,
  val createdByUserId: String,
  val updatedAt: String,
  val updatedByUserId: String,
  val reviewedAt: String?,
  val reviewedByUserId: String?,
  val evidences: List<WorkpaperEvidenceResponse>
)

@JsonInclude(JsonInclude.Include.ALWAYS)
data class WorkpaperEvidenceResponse(
  val id: String,
  val position: Int,
  val fileName: String,
  val mediaType: String,
  val documentDate: String?,
  val sourceLabel: String,
  val verificationStatus: String,
  val externalReference: String?,
  val checksumSha256: String?
)

data class DocumentSummaryResponse(
  val id: String,
  val fileName: String,
  val mediaType: String,
  val byteSize: Long,
  val checksumSha256: String,
  val sourceLabel: String,
  val documentDate: String?,
  val createdAt: String,
  val createdByUserId: String,
  val verificationStatus: String,
  val reviewComment: String?,
  val reviewedAt: String?,
  val reviewedByUserId: String?
)

private fun WorkpaperUpsertRequest.toCommand(): WorkpaperUpsertCommand =
  WorkpaperUpsertCommand(
    noteText = noteText,
    status = status,
    evidences = evidences.map { it.toCommand() }
  )

private fun WorkpaperEvidenceRequest.toCommand(): WorkpaperEvidenceCommand =
  WorkpaperEvidenceCommand(
    position = position,
    fileName = fileName,
    mediaType = mediaType,
    documentDate = documentDate,
    sourceLabel = sourceLabel,
    verificationStatus = verificationStatus,
    externalReference = externalReference,
    checksumSha256 = checksumSha256
  )

private fun WorkpaperReviewDecisionRequest.toCommand(): WorkpaperReviewDecisionCommand =
  WorkpaperReviewDecisionCommand(
    decision = decision,
    comment = comment
  )

private fun ClosingWorkpapers.toResponse(): ClosingWorkpapersResponse =
  ClosingWorkpapersResponse(
    closingFolderId = closingFolderId.toString(),
    closingFolderStatus = closingFolderStatus,
    readiness = readiness,
    latestImportVersion = latestImportVersion,
    blockers = blockers.map { WorkpaperBlockerResponse(it.code, it.message) },
    nextAction = nextAction?.let { WorkpaperNextActionResponse(it.code, it.path, it.actionable) },
    summaryCounts = summaryCounts.toResponse(),
    items = items.map { it.toResponse() },
    staleWorkpapers = staleWorkpapers.map { it.toResponse() }
  )

private fun WorkpaperSummaryCounts.toResponse(): WorkpaperSummaryCountsResponse =
  WorkpaperSummaryCountsResponse(
    totalCurrentAnchors = totalCurrentAnchors,
    withWorkpaperCount = withWorkpaperCount,
    readyForReviewCount = readyForReviewCount,
    reviewedCount = reviewedCount,
    staleCount = staleCount,
    missingCount = missingCount
  )

private fun WorkpaperItem.toResponse(): WorkpaperItemResponse =
  WorkpaperItemResponse(
    anchorCode = anchorCode,
    anchorLabel = anchorLabel,
    summaryBucketCode = summaryBucketCode,
    statementKind = statementKind,
    breakdownType = breakdownType,
    isCurrentStructure = isCurrentStructure,
    workpaper = workpaper?.toResponse(),
    documents = documents.map { it.toResponse() },
    documentVerificationSummary = documentVerificationSummary?.toResponse()
  )

private fun DocumentVerificationSummary.toResponse(): DocumentVerificationSummaryResponse =
  DocumentVerificationSummaryResponse(
    documentsCount = documentsCount,
    unverifiedCount = unverifiedCount,
    verifiedCount = verifiedCount,
    rejectedCount = rejectedCount
  )

private fun WorkpaperDetails.toResponse(): WorkpaperDetailsResponse =
  WorkpaperDetailsResponse(
    id = id.toString(),
    noteText = noteText,
    status = status.name,
    reviewComment = reviewComment,
    basisImportVersion = basisImportVersion,
    basisTaxonomyVersion = basisTaxonomyVersion,
    createdAt = createdAt.toString(),
    createdByUserId = createdByUserId.toString(),
    updatedAt = updatedAt.toString(),
    updatedByUserId = updatedByUserId.toString(),
    reviewedAt = reviewedAt?.toString(),
    reviewedByUserId = reviewedByUserId?.toString(),
    evidences = evidences.map { it.toResponse() }
  )

private fun WorkpaperEvidenceDetails.toResponse(): WorkpaperEvidenceResponse =
  WorkpaperEvidenceResponse(
    id = id.toString(),
    position = position,
    fileName = fileName,
    mediaType = mediaType,
    documentDate = documentDate?.toString(),
    sourceLabel = sourceLabel,
    verificationStatus = verificationStatus.name,
    externalReference = externalReference,
    checksumSha256 = checksumSha256
  )

private fun DocumentSummary.toResponse(): DocumentSummaryResponse =
  DocumentSummaryResponse(
    id = id.toString(),
    fileName = fileName,
    mediaType = mediaType,
    byteSize = byteSize,
    checksumSha256 = checksumSha256,
    sourceLabel = sourceLabel,
    documentDate = documentDate?.toString(),
    createdAt = createdAt.toString(),
    createdByUserId = createdByUserId.toString(),
    verificationStatus = verificationStatus.name,
    reviewComment = reviewComment,
    reviewedAt = reviewedAt?.toString(),
    reviewedByUserId = reviewedByUserId?.toString()
  )
