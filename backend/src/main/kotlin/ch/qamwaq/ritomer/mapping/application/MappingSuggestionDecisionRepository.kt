package ch.qamwaq.ritomer.mapping.application

import java.time.OffsetDateTime
import java.util.UUID

data class NewMappingSuggestionDecisionRequest(
  val id: UUID,
  val tenantId: UUID,
  val closingFolderId: UUID,
  val accountCode: String,
  val idempotencyKey: String,
  val canonicalPayloadHash: String,
  val decision: MappingSuggestionHumanDecision,
  val latestImportVersion: Int,
  val suggestionFingerprint: String,
  val targetCode: String?,
  val reviewComment: String?,
  val actorUserId: UUID,
  val resultKind: MappingSuggestionDecisionResultKind,
  val createdAt: OffsetDateTime
)

data class MappingSuggestionDecisionRequestRecord(
  val id: UUID,
  val tenantId: UUID,
  val closingFolderId: UUID,
  val accountCode: String,
  val idempotencyKey: String,
  val canonicalPayloadHash: String,
  val decision: MappingSuggestionHumanDecision,
  val latestImportVersion: Int,
  val suggestionFingerprint: String,
  val targetCode: String?,
  val reviewComment: String?,
  val actorUserId: UUID,
  val resultKind: MappingSuggestionDecisionResultKind,
  val appliedAccountCode: String?,
  val appliedTargetCode: String?,
  val createdAt: OffsetDateTime,
  val completedAt: OffsetDateTime?
)

interface MappingSuggestionDecisionRequestRepository {
  fun insertPendingIfAbsent(request: NewMappingSuggestionDecisionRequest): Boolean

  fun lockByIdempotencyKey(
    tenantId: UUID,
    closingFolderId: UUID,
    accountCode: String,
    idempotencyKey: String
  ): MappingSuggestionDecisionRequestRecord?

  fun complete(
    id: UUID,
    tenantId: UUID,
    resultKind: MappingSuggestionDecisionResultKind,
    appliedAccountCode: String?,
    appliedTargetCode: String?,
    completedAt: OffsetDateTime
  ): MappingSuggestionDecisionRequestRecord
}
