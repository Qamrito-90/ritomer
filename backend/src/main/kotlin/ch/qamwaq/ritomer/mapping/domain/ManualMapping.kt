package ch.qamwaq.ritomer.mapping.domain

import java.time.OffsetDateTime
import java.util.UUID

data class ManualMapping(
  val id: UUID,
  val tenantId: UUID,
  val closingFolderId: UUID,
  val accountCode: String,
  val targetCode: String,
  val createdAt: OffsetDateTime,
  val updatedAt: OffsetDateTime,
  val createdByUserId: UUID,
  val updatedByUserId: UUID
)
