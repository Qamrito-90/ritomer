package ch.qamwaq.ritomer.workpapers.domain

import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

data class Workpaper(
  val id: UUID,
  val tenantId: UUID,
  val closingFolderId: UUID,
  val anchorCode: String,
  val anchorLabel: String,
  val summaryBucketCode: String,
  val statementKind: WorkpaperStatementKind,
  val breakdownType: WorkpaperBreakdownType,
  val noteText: String,
  val status: WorkpaperStatus,
  val reviewComment: String?,
  val basisImportVersion: Int,
  val basisTaxonomyVersion: Int,
  val createdAt: OffsetDateTime,
  val createdByUserId: UUID,
  val updatedAt: OffsetDateTime,
  val updatedByUserId: UUID,
  val reviewedAt: OffsetDateTime?,
  val reviewedByUserId: UUID?,
  val evidences: List<WorkpaperEvidence>
)

data class WorkpaperEvidence(
  val id: UUID,
  val tenantId: UUID,
  val workpaperId: UUID,
  val position: Int,
  val fileName: String,
  val mediaType: String,
  val documentDate: LocalDate?,
  val sourceLabel: String,
  val verificationStatus: WorkpaperEvidenceVerificationStatus,
  val externalReference: String?,
  val checksumSha256: String?
)

enum class WorkpaperStatus {
  DRAFT,
  READY_FOR_REVIEW,
  CHANGES_REQUESTED,
  REVIEWED
}

enum class WorkpaperStatementKind {
  BALANCE_SHEET,
  INCOME_STATEMENT
}

enum class WorkpaperBreakdownType {
  SECTION,
  LEGACY_BUCKET_FALLBACK
}

enum class WorkpaperEvidenceVerificationStatus {
  UNVERIFIED,
  VERIFIED,
  REJECTED
}
