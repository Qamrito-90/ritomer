package ch.qamwaq.ritomer.closing.domain

import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

data class ClosingFolder(
  val id: UUID,
  val tenantId: UUID,
  val name: String,
  val periodStartOn: LocalDate,
  val periodEndOn: LocalDate,
  val externalRef: String?,
  val status: ClosingFolderStatus,
  val archivedAt: OffsetDateTime?,
  val archivedByUserId: UUID?,
  val createdAt: OffsetDateTime,
  val updatedAt: OffsetDateTime
)

enum class ClosingFolderStatus {
  DRAFT,
  ARCHIVED;

  companion object {
    fun fromCode(code: String): ClosingFolderStatus =
      entries.firstOrNull { it.name == code.trim().uppercase() }
        ?: throw IllegalArgumentException("Unsupported closing folder status: $code")
  }
}
