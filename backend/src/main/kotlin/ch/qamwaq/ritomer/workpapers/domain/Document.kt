package ch.qamwaq.ritomer.workpapers.domain

import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

data class Document(
  val id: UUID,
  val tenantId: UUID,
  val workpaperId: UUID,
  val storageBackend: DocumentStorageBackend,
  val storageObjectKey: String,
  val fileName: String,
  val mediaType: String,
  val byteSize: Long,
  val checksumSha256: String,
  val sourceLabel: String,
  val documentDate: LocalDate?,
  val createdAt: OffsetDateTime,
  val createdByUserId: UUID
)

enum class DocumentStorageBackend {
  LOCAL_FS,
  GCS
}
