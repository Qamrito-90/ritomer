package ch.qamwaq.ritomer.exports.domain

import java.time.OffsetDateTime
import java.util.UUID

data class ExportPack(
  val id: UUID,
  val tenantId: UUID,
  val closingFolderId: UUID,
  val idempotencyKey: String,
  val sourceFingerprint: String,
  val storageBackend: String,
  val storageObjectKey: String,
  val fileName: String,
  val mediaType: String,
  val byteSize: Long,
  val checksumSha256: String,
  val basisImportVersion: Int,
  val basisTaxonomyVersion: Int,
  val createdAt: OffsetDateTime,
  val createdByUserId: UUID
)
