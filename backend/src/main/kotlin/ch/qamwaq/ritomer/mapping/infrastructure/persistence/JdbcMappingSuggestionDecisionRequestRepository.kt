package ch.qamwaq.ritomer.mapping.infrastructure.persistence

import ch.qamwaq.ritomer.mapping.application.MappingSuggestionDecisionRequestRecord
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionDecisionRequestRepository
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionDecisionResultKind
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionHumanDecision
import ch.qamwaq.ritomer.mapping.application.NewMappingSuggestionDecisionRequest
import java.time.OffsetDateTime
import java.util.UUID
import org.springframework.context.annotation.Profile
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository

@Repository
@Profile("!test")
class JdbcMappingSuggestionDecisionRequestRepository(
  private val jdbcClient: JdbcClient
) : MappingSuggestionDecisionRequestRepository {
  override fun insertPendingIfAbsent(request: NewMappingSuggestionDecisionRequest): Boolean {
    val insertedRows = jdbcClient.sql(
      """
      insert into mapping_suggestion_decision_request (
        id,
        tenant_id,
        closing_folder_id,
        account_code,
        idempotency_key,
        canonical_payload_hash,
        decision,
        latest_import_version,
        suggestion_fingerprint,
        target_code,
        review_comment,
        actor_user_id,
        result_kind,
        applied_account_code,
        applied_target_code,
        created_at,
        completed_at
      ) values (
        :id,
        :tenantId,
        :closingFolderId,
        :accountCode,
        :idempotencyKey,
        :canonicalPayloadHash,
        :decision,
        :latestImportVersion,
        :suggestionFingerprint,
        :targetCode,
        :reviewComment,
        :actorUserId,
        :resultKind,
        null,
        null,
        :createdAt,
        null
      )
      on conflict (tenant_id, closing_folder_id, account_code, idempotency_key) do nothing
      """.trimIndent()
    )
      .withDecisionRequest(request)
      .update()

    return insertedRows == 1
  }

  override fun lockByIdempotencyKey(
    tenantId: UUID,
    closingFolderId: UUID,
    accountCode: String,
    idempotencyKey: String
  ): MappingSuggestionDecisionRequestRecord? =
    jdbcClient.sql(
      """
      select id,
             tenant_id,
             closing_folder_id,
             account_code,
             idempotency_key,
             canonical_payload_hash,
             decision,
             latest_import_version,
             suggestion_fingerprint,
             target_code,
             review_comment,
             actor_user_id,
             result_kind,
             applied_account_code,
             applied_target_code,
             created_at,
             completed_at
      from mapping_suggestion_decision_request
      where tenant_id = :tenantId
        and closing_folder_id = :closingFolderId
        and account_code = :accountCode
        and idempotency_key = :idempotencyKey
      for update
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("closingFolderId", closingFolderId)
      .param("accountCode", accountCode)
      .param("idempotencyKey", idempotencyKey)
      .query(DECISION_REQUEST_ROW_MAPPER)
      .optional()
      .orElse(null)

  override fun complete(
    id: UUID,
    tenantId: UUID,
    resultKind: MappingSuggestionDecisionResultKind,
    appliedAccountCode: String?,
    appliedTargetCode: String?,
    completedAt: OffsetDateTime
  ): MappingSuggestionDecisionRequestRecord {
    val updatedRows = jdbcClient.sql(
      """
      update mapping_suggestion_decision_request
      set result_kind = :resultKind,
          applied_account_code = :appliedAccountCode,
          applied_target_code = :appliedTargetCode,
          completed_at = :completedAt
      where id = :id
        and tenant_id = :tenantId
      """.trimIndent()
    )
      .param("id", id)
      .param("tenantId", tenantId)
      .param("resultKind", resultKind.name)
      .param("appliedAccountCode", appliedAccountCode)
      .param("appliedTargetCode", appliedTargetCode)
      .param("completedAt", completedAt)
      .update()

    if (updatedRows != 1) {
      error("Mapping suggestion decision request completion failed for $id.")
    }

    return jdbcClient.sql(
      """
      select id,
             tenant_id,
             closing_folder_id,
             account_code,
             idempotency_key,
             canonical_payload_hash,
             decision,
             latest_import_version,
             suggestion_fingerprint,
             target_code,
             review_comment,
             actor_user_id,
             result_kind,
             applied_account_code,
             applied_target_code,
             created_at,
             completed_at
      from mapping_suggestion_decision_request
      where id = :id
        and tenant_id = :tenantId
      """.trimIndent()
    )
      .param("id", id)
      .param("tenantId", tenantId)
      .query(DECISION_REQUEST_ROW_MAPPER)
      .single()
  }

  companion object {
    private val DECISION_REQUEST_ROW_MAPPER = RowMapper<MappingSuggestionDecisionRequestRecord> { rs, _ ->
      MappingSuggestionDecisionRequestRecord(
        id = rs.getObject("id", UUID::class.java),
        tenantId = rs.getObject("tenant_id", UUID::class.java),
        closingFolderId = rs.getObject("closing_folder_id", UUID::class.java),
        accountCode = rs.getString("account_code"),
        idempotencyKey = rs.getString("idempotency_key"),
        canonicalPayloadHash = rs.getString("canonical_payload_hash"),
        decision = MappingSuggestionHumanDecision.valueOf(rs.getString("decision")),
        latestImportVersion = rs.getInt("latest_import_version"),
        suggestionFingerprint = rs.getString("suggestion_fingerprint"),
        targetCode = rs.getString("target_code"),
        reviewComment = rs.getString("review_comment"),
        actorUserId = rs.getObject("actor_user_id", UUID::class.java),
        resultKind = MappingSuggestionDecisionResultKind.valueOf(rs.getString("result_kind")),
        appliedAccountCode = rs.getString("applied_account_code"),
        appliedTargetCode = rs.getString("applied_target_code"),
        createdAt = rs.getObject("created_at", OffsetDateTime::class.java),
        completedAt = rs.getObject("completed_at", OffsetDateTime::class.java)
      )
    }
  }
}

private fun JdbcClient.StatementSpec.withDecisionRequest(
  request: NewMappingSuggestionDecisionRequest
): JdbcClient.StatementSpec =
  param("id", request.id)
    .param("tenantId", request.tenantId)
    .param("closingFolderId", request.closingFolderId)
    .param("accountCode", request.accountCode)
    .param("idempotencyKey", request.idempotencyKey)
    .param("canonicalPayloadHash", request.canonicalPayloadHash)
    .param("decision", request.decision.name)
    .param("latestImportVersion", request.latestImportVersion)
    .param("suggestionFingerprint", request.suggestionFingerprint)
    .param("targetCode", request.targetCode)
    .param("reviewComment", request.reviewComment)
    .param("actorUserId", request.actorUserId)
    .param("resultKind", request.resultKind.name)
    .param("createdAt", request.createdAt)
