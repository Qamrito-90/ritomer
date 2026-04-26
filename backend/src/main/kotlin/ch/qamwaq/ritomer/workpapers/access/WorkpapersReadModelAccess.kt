package ch.qamwaq.ritomer.workpapers.access

import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.workpapers.application.ClosingWorkpapers
import ch.qamwaq.ritomer.workpapers.application.DocumentSummary
import ch.qamwaq.ritomer.workpapers.application.DocumentVerificationSummary
import ch.qamwaq.ritomer.workpapers.application.WorkpaperDetails
import ch.qamwaq.ritomer.workpapers.application.WorkpaperEvidenceDetails
import ch.qamwaq.ritomer.workpapers.application.WorkpaperItem
import ch.qamwaq.ritomer.workpapers.application.WorkpaperService
import java.util.UUID
import org.springframework.stereotype.Service

data class WorkpapersReadModel(
  val closingFolderId: String,
  val closingFolderStatus: String,
  val readiness: String,
  val latestImportVersion: Int?,
  val blockers: List<WorkpapersBlockerReadModel>,
  val nextAction: WorkpapersNextActionReadModel?,
  val summaryCounts: WorkpapersSummaryCountsReadModel,
  val items: List<WorkpaperItemReadModel>,
  val staleWorkpapers: List<WorkpaperItemReadModel>
)

data class WorkpapersSummaryCountsReadModel(
  val totalCurrentAnchors: Int,
  val withWorkpaperCount: Int,
  val readyForReviewCount: Int,
  val reviewedCount: Int,
  val staleCount: Int,
  val missingCount: Int
)

data class WorkpapersBlockerReadModel(
  val code: String,
  val message: String
)

data class WorkpapersNextActionReadModel(
  val code: String,
  val path: String,
  val actionable: Boolean
)

data class WorkpaperItemReadModel(
  val anchorCode: String,
  val anchorLabel: String,
  val summaryBucketCode: String,
  val statementKind: String,
  val breakdownType: String,
  val isCurrentStructure: Boolean,
  val workpaper: WorkpaperDetailsReadModel?,
  val documents: List<WorkpaperDocumentReadModel>,
  val documentVerificationSummary: WorkpaperDocumentVerificationSummaryReadModel?
)

data class WorkpaperDetailsReadModel(
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
  val evidences: List<WorkpaperEvidenceReadModel>
)

data class WorkpaperEvidenceReadModel(
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

data class WorkpaperDocumentVerificationSummaryReadModel(
  val documentsCount: Int,
  val unverifiedCount: Int,
  val verifiedCount: Int,
  val rejectedCount: Int
)

data class WorkpaperDocumentReadModel(
  val documentId: String,
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

fun interface WorkpapersReadModelAccess {
  fun getReadModel(access: TenantAccessContext, closingFolderId: UUID): WorkpapersReadModel
}

@Service
class ServiceBackedWorkpapersReadModelAccess(
  private val workpaperService: WorkpaperService
) : WorkpapersReadModelAccess {
  override fun getReadModel(access: TenantAccessContext, closingFolderId: UUID): WorkpapersReadModel =
    workpaperService.getWorkpapers(access, closingFolderId).toReadModel()
}

private fun ClosingWorkpapers.toReadModel(): WorkpapersReadModel =
  WorkpapersReadModel(
    closingFolderId = closingFolderId.toString(),
    closingFolderStatus = closingFolderStatus,
    readiness = readiness,
    latestImportVersion = latestImportVersion,
    blockers = blockers.map { WorkpapersBlockerReadModel(it.code, it.message) },
    nextAction = nextAction?.let { WorkpapersNextActionReadModel(it.code, it.path, it.actionable) },
    summaryCounts = WorkpapersSummaryCountsReadModel(
      totalCurrentAnchors = summaryCounts.totalCurrentAnchors,
      withWorkpaperCount = summaryCounts.withWorkpaperCount,
      readyForReviewCount = summaryCounts.readyForReviewCount,
      reviewedCount = summaryCounts.reviewedCount,
      staleCount = summaryCounts.staleCount,
      missingCount = summaryCounts.missingCount
    ),
    items = items.map { it.toReadModel() },
    staleWorkpapers = staleWorkpapers.map { it.toReadModel() }
  )

private fun WorkpaperItem.toReadModel(): WorkpaperItemReadModel =
  WorkpaperItemReadModel(
    anchorCode = anchorCode,
    anchorLabel = anchorLabel,
    summaryBucketCode = summaryBucketCode,
    statementKind = statementKind,
    breakdownType = breakdownType,
    isCurrentStructure = isCurrentStructure,
    workpaper = workpaper?.toReadModel(),
    documents = documents.map { it.toReadModel() },
    documentVerificationSummary = documentVerificationSummary?.toReadModel()
  )

private fun WorkpaperDetails.toReadModel(): WorkpaperDetailsReadModel =
  WorkpaperDetailsReadModel(
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
    evidences = evidences.map { it.toReadModel() }
  )

private fun WorkpaperEvidenceDetails.toReadModel(): WorkpaperEvidenceReadModel =
  WorkpaperEvidenceReadModel(
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

private fun DocumentSummary.toReadModel(): WorkpaperDocumentReadModel =
  WorkpaperDocumentReadModel(
    documentId = id.toString(),
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

private fun DocumentVerificationSummary.toReadModel(): WorkpaperDocumentVerificationSummaryReadModel =
  WorkpaperDocumentVerificationSummaryReadModel(
    documentsCount = documentsCount,
    unverifiedCount = unverifiedCount,
    verifiedCount = verifiedCount,
    rejectedCount = rejectedCount
  )
