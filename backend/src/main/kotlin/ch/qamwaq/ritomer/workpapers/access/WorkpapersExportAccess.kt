package ch.qamwaq.ritomer.workpapers.access

import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.workpapers.application.DocumentService
import ch.qamwaq.ritomer.workpapers.application.WorkpaperService
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatus
import java.io.InputStream
import java.util.UUID
import org.springframework.stereotype.Service

data class CurrentWorkpapersReadModel(
  val closingFolderId: String,
  val closingFolderStatus: String,
  val readiness: String,
  val latestImportVersion: Int?,
  val blockers: List<CurrentWorkpapersBlockerReadModel>,
  val nextAction: CurrentWorkpapersNextActionReadModel?,
  val summaryCounts: CurrentWorkpapersSummaryCountsReadModel,
  val items: List<CurrentPersistedWorkpaperReadModel>
)

data class CurrentWorkpapersSummaryCountsReadModel(
  val totalCurrentAnchors: Int,
  val withWorkpaperCount: Int,
  val readyForReviewCount: Int,
  val reviewedCount: Int,
  val staleCount: Int,
  val missingCount: Int
)

data class CurrentWorkpapersBlockerReadModel(
  val code: String,
  val message: String
)

data class CurrentWorkpapersNextActionReadModel(
  val code: String,
  val path: String,
  val actionable: Boolean
)

data class CurrentPersistedWorkpaperReadModel(
  val anchorCode: String,
  val anchorLabel: String,
  val summaryBucketCode: String,
  val statementKind: String,
  val breakdownType: String,
  val workpaperId: String,
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
  val evidences: List<CurrentWorkpaperEvidenceReadModel>,
  val documentVerificationSummary: CurrentDocumentVerificationSummaryReadModel,
  val documents: List<CurrentDocumentReadModel>
)

data class CurrentWorkpaperEvidenceReadModel(
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

data class CurrentDocumentVerificationSummaryReadModel(
  val documentsCount: Int,
  val unverifiedCount: Int,
  val verifiedCount: Int,
  val rejectedCount: Int
)

data class CurrentDocumentReadModel(
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

data class SelectedDocumentBinary(
  val documentId: UUID,
  val fileName: String,
  val mediaType: String,
  val byteSize: Long,
  val inputStream: InputStream
)

interface WorkpapersExportAccess {
  fun getCurrentPersistedWorkpapers(access: TenantAccessContext, closingFolderId: UUID): CurrentWorkpapersReadModel

  fun openSelectedDocument(access: TenantAccessContext, closingFolderId: UUID, documentId: UUID): SelectedDocumentBinary
}

@Service
class ServiceBackedWorkpapersExportAccess(
  private val workpaperService: WorkpaperService,
  private val documentService: DocumentService
) : WorkpapersExportAccess {
  override fun getCurrentPersistedWorkpapers(access: TenantAccessContext, closingFolderId: UUID): CurrentWorkpapersReadModel {
    val current = workpaperService.getWorkpapers(access, closingFolderId)
    val persistedCurrentItems = current.items
      .asSequence()
      .filter { it.workpaper != null }
      .map { item ->
        val workpaper = item.workpaper ?: error("Persisted current workpaper is required.")
        CurrentPersistedWorkpaperReadModel(
          anchorCode = item.anchorCode,
          anchorLabel = item.anchorLabel,
          summaryBucketCode = item.summaryBucketCode,
          statementKind = item.statementKind,
          breakdownType = item.breakdownType,
          workpaperId = workpaper.id.toString(),
          noteText = workpaper.noteText,
          status = workpaper.status.name,
          reviewComment = workpaper.reviewComment,
          basisImportVersion = workpaper.basisImportVersion,
          basisTaxonomyVersion = workpaper.basisTaxonomyVersion,
          createdAt = workpaper.createdAt.toString(),
          createdByUserId = workpaper.createdByUserId.toString(),
          updatedAt = workpaper.updatedAt.toString(),
          updatedByUserId = workpaper.updatedByUserId.toString(),
          reviewedAt = workpaper.reviewedAt?.toString(),
          reviewedByUserId = workpaper.reviewedByUserId?.toString(),
          evidences = workpaper.evidences
            .sortedBy { it.position }
            .map {
              CurrentWorkpaperEvidenceReadModel(
                id = it.id.toString(),
                position = it.position,
                fileName = it.fileName,
                mediaType = it.mediaType,
                documentDate = it.documentDate?.toString(),
                sourceLabel = it.sourceLabel,
                verificationStatus = it.verificationStatus.name,
                externalReference = it.externalReference,
                checksumSha256 = it.checksumSha256
              )
            },
          documentVerificationSummary = CurrentDocumentVerificationSummaryReadModel(
            documentsCount = item.documentVerificationSummary?.documentsCount ?: 0,
            unverifiedCount = item.documentVerificationSummary?.unverifiedCount ?: 0,
            verifiedCount = item.documentVerificationSummary?.verifiedCount ?: 0,
            rejectedCount = item.documentVerificationSummary?.rejectedCount ?: 0
          ),
          documents = item.documents
            .sortedBy { it.id }
            .map {
              CurrentDocumentReadModel(
                documentId = it.id.toString(),
                fileName = it.fileName,
                mediaType = it.mediaType,
                byteSize = it.byteSize,
                checksumSha256 = it.checksumSha256,
                sourceLabel = it.sourceLabel,
                documentDate = it.documentDate?.toString(),
                createdAt = it.createdAt.toString(),
                createdByUserId = it.createdByUserId.toString(),
                verificationStatus = it.verificationStatus.name,
                reviewComment = it.reviewComment,
                reviewedAt = it.reviewedAt?.toString(),
                reviewedByUserId = it.reviewedByUserId?.toString()
              )
            }
        )
      }
      .sortedWith(compareBy<CurrentPersistedWorkpaperReadModel> { it.anchorCode }.thenBy { it.workpaperId })
      .toList()

    val withWorkpaperCount = persistedCurrentItems.size
    val readyForReviewCount = persistedCurrentItems.count { it.status == WorkpaperStatus.READY_FOR_REVIEW.name }
    val reviewedCount = persistedCurrentItems.count { it.status == WorkpaperStatus.REVIEWED.name }

    return CurrentWorkpapersReadModel(
      closingFolderId = current.closingFolderId.toString(),
      closingFolderStatus = current.closingFolderStatus,
      readiness = current.readiness,
      latestImportVersion = current.latestImportVersion,
      blockers = current.blockers.map { CurrentWorkpapersBlockerReadModel(it.code, it.message) },
      nextAction = current.nextAction?.let {
        CurrentWorkpapersNextActionReadModel(
          code = it.code,
          path = it.path,
          actionable = it.actionable
        )
      },
      summaryCounts = CurrentWorkpapersSummaryCountsReadModel(
        totalCurrentAnchors = current.summaryCounts.totalCurrentAnchors,
        withWorkpaperCount = withWorkpaperCount,
        readyForReviewCount = readyForReviewCount,
        reviewedCount = reviewedCount,
        staleCount = 0,
        missingCount = current.summaryCounts.totalCurrentAnchors - withWorkpaperCount
      ),
      items = persistedCurrentItems
    )
  }

  override fun openSelectedDocument(access: TenantAccessContext, closingFolderId: UUID, documentId: UUID): SelectedDocumentBinary {
    val downloaded = documentService.downloadDocument(access, closingFolderId, documentId)
    return SelectedDocumentBinary(
      documentId = downloaded.document.id,
      fileName = downloaded.document.fileName,
      mediaType = downloaded.document.mediaType,
      byteSize = downloaded.document.byteSize,
      inputStream = downloaded.inputStream
    )
  }
}
