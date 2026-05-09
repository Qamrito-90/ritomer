package ch.qamwaq.ritomer.mapping.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccess
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.mapping.access.ManualMappingAccess
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionTemplate
import org.springframework.web.bind.annotation.ResponseStatus

data class MappingSuggestionDecisionCommand(
  val accountCode: String,
  val idempotencyKey: String?,
  val decision: String?,
  val latestImportVersion: Int?,
  val suggestionFingerprint: String?,
  val targetCode: String?,
  val reviewComment: String?
)

data class MappingSuggestionDecisionResult(
  val decision: MappingSuggestionHumanDecision,
  val accountCode: String,
  val resultKind: MappingSuggestionDecisionResultKind,
  val appliedMapping: ManualMappingEntry?
)

enum class MappingSuggestionHumanDecision {
  ACCEPT,
  CORRECT,
  REJECT
}

enum class MappingSuggestionDecisionResultKind(val isConflict: Boolean) {
  PENDING(false),
  MANUAL_MAPPING_CREATED(false),
  MANUAL_MAPPING_UPDATED(false),
  MANUAL_MAPPING_NOOP(false),
  REJECT_RECORDED(false),
  CONFLICT_ARCHIVED(true),
  CONFLICT_NO_IMPORT(true),
  CONFLICT_FLAG_OFF(true),
  CONFLICT_NON_DECISIONABLE(true),
  CONFLICT_SUGGESTION_ABSENT(true),
  CONFLICT_FINGERPRINT_MISMATCH(true),
  CONFLICT_STALE_IMPORT(true),
  CONFLICT_ACCOUNT_ABSENT(true),
  CONFLICT_TARGET_MISMATCH(true),
  CONFLICT_TARGET_NOT_SELECTABLE(true)
}

@Service
class MappingSuggestionDecisionService(
  private val closingFolderAccess: ClosingFolderAccess,
  private val manualMappingAccess: ManualMappingAccess,
  private val manualMappingService: ManualMappingService,
  private val manualMappingTargetCatalog: ManualMappingTargetCatalog,
  private val mappingSuggestionsService: MappingSuggestionsService,
  private val decisionRequestRepository: MappingSuggestionDecisionRequestRepository,
  private val transactionTemplate: TransactionTemplate,
  @Value("\${ritomer.ai.mapping-suggestions.enabled:false}")
  private val mappingSuggestionsEnabled: Boolean
) {
  fun recordDecision(
    access: TenantAccessContext,
    closingFolderId: UUID,
    command: MappingSuggestionDecisionCommand
  ): MappingSuggestionDecisionResult {
    requireAnyRole(access, WRITE_ROLES)
    closingFolderAccess.getRequired(access.tenantId, closingFolderId)
    val normalized = normalizeCommand(closingFolderId, command)
    val canonicalPayloadHash = MappingSuggestionDecisionPayloads.hash(normalized)
    val idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey)

    return synchronized(lockFor(access.tenantId, closingFolderId, normalized.accountCode, idempotencyKey)) {
      transactionTemplate.execute {
        val now = OffsetDateTime.now(ZoneOffset.UTC)
        val newlyInserted = decisionRequestRepository.insertPendingIfAbsent(
          NewMappingSuggestionDecisionRequest(
            id = UUID.randomUUID(),
            tenantId = access.tenantId,
            closingFolderId = closingFolderId,
            accountCode = normalized.accountCode,
            idempotencyKey = idempotencyKey,
            canonicalPayloadHash = canonicalPayloadHash,
            decision = normalized.decision,
            latestImportVersion = normalized.latestImportVersion,
            suggestionFingerprint = normalized.suggestionFingerprint,
            targetCode = normalized.targetCode,
            reviewComment = normalized.reviewComment,
            actorUserId = access.actorUserId,
            resultKind = MappingSuggestionDecisionResultKind.PENDING,
            createdAt = now
          )
        )

        val request = decisionRequestRepository.lockByIdempotencyKey(
          tenantId = access.tenantId,
          closingFolderId = closingFolderId,
          accountCode = normalized.accountCode,
          idempotencyKey = idempotencyKey
        ) ?: error("Mapping suggestion decision idempotency row was not found after reservation.")

        if (!newlyInserted) {
          if (request.canonicalPayloadHash != canonicalPayloadHash) {
            throw MappingSuggestionDecisionConflictException(
              "Idempotency-Key is already bound to a different canonical payload."
            )
          }
          return@execute request.toDecisionResult()
        }

        val completion = evaluateNewDecision(access, closingFolderId, normalized)
        decisionRequestRepository.complete(
          id = request.id,
          tenantId = access.tenantId,
          resultKind = completion.resultKind,
          appliedAccountCode = completion.appliedMapping?.accountCode,
          appliedTargetCode = completion.appliedMapping?.targetCode,
          completedAt = OffsetDateTime.now(ZoneOffset.UTC)
        ).toDecisionResult()
      } ?: error("Mapping suggestion decision transaction returned null.")
    }
  }

  private fun evaluateNewDecision(
    access: TenantAccessContext,
    closingFolderId: UUID,
    payload: NormalizedMappingSuggestionDecisionPayload
  ): MappingSuggestionDecisionCompletion {
    val lockedClosingFolder = closingFolderAccess.lockRequired(access.tenantId, closingFolderId)
    if (lockedClosingFolder.status == ClosingFolderAccessStatus.ARCHIVED) {
      return conflict(MappingSuggestionDecisionResultKind.CONFLICT_ARCHIVED)
    }
    if (!mappingSuggestionsEnabled) {
      return conflict(MappingSuggestionDecisionResultKind.CONFLICT_FLAG_OFF)
    }

    val projection = manualMappingAccess.getCurrentProjection(access.tenantId, closingFolderId)
    val latestImportVersion = projection.latestImportVersion
      ?: return conflict(MappingSuggestionDecisionResultKind.CONFLICT_NO_IMPORT)
    if (latestImportVersion != payload.latestImportVersion) {
      return conflict(MappingSuggestionDecisionResultKind.CONFLICT_STALE_IMPORT)
    }
    if (projection.lines.none { it.accountCode == payload.accountCode }) {
      return conflict(MappingSuggestionDecisionResultKind.CONFLICT_ACCOUNT_ABSENT)
    }

    val readModel = mappingSuggestionsService.getSuggestions(access, closingFolderId)
    if (readModel.state !in DECISIONABLE_STATES) {
      return conflict(MappingSuggestionDecisionResultKind.CONFLICT_NON_DECISIONABLE)
    }
    val currentSuggestion = readModel.suggestions.firstOrNull { it.accountCode == payload.accountCode }
      ?: return conflict(MappingSuggestionDecisionResultKind.CONFLICT_SUGGESTION_ABSENT)
    if (currentSuggestion.suggestionFingerprint != payload.suggestionFingerprint) {
      return conflict(MappingSuggestionDecisionResultKind.CONFLICT_FINGERPRINT_MISMATCH)
    }

    if (payload.decision == MappingSuggestionHumanDecision.REJECT) {
      return MappingSuggestionDecisionCompletion(
        resultKind = MappingSuggestionDecisionResultKind.REJECT_RECORDED,
        appliedMapping = null
      )
    }

    val targetCode = payload.targetCode ?: error("ACCEPT/CORRECT payload targetCode was not normalized.")
    val target = manualMappingTargetCatalog.findByCode(targetCode)
    if (target == null || !target.selectable) {
      return conflict(MappingSuggestionDecisionResultKind.CONFLICT_TARGET_NOT_SELECTABLE)
    }
    if (payload.decision == MappingSuggestionHumanDecision.ACCEPT && targetCode != currentSuggestion.suggestedTargetCode) {
      return conflict(MappingSuggestionDecisionResultKind.CONFLICT_TARGET_MISMATCH)
    }
    if (payload.decision == MappingSuggestionHumanDecision.CORRECT && targetCode == currentSuggestion.suggestedTargetCode) {
      return conflict(MappingSuggestionDecisionResultKind.CONFLICT_TARGET_MISMATCH)
    }

    val result = manualMappingService.upsert(
      access = access,
      closingFolderId = closingFolderId,
      command = ManualMappingUpsertCommand(
        accountCode = payload.accountCode,
        targetCode = targetCode
      )
    )

    return MappingSuggestionDecisionCompletion(
      resultKind = when (result.outcome) {
        ManualMappingUpsertOutcome.CREATED -> MappingSuggestionDecisionResultKind.MANUAL_MAPPING_CREATED
        ManualMappingUpsertOutcome.UPDATED -> MappingSuggestionDecisionResultKind.MANUAL_MAPPING_UPDATED
        ManualMappingUpsertOutcome.NOOP -> MappingSuggestionDecisionResultKind.MANUAL_MAPPING_NOOP
      },
      appliedMapping = result.mapping
    )
  }

  private fun normalizeCommand(
    closingFolderId: UUID,
    command: MappingSuggestionDecisionCommand
  ): NormalizedMappingSuggestionDecisionPayload {
    val accountCode = normalizeRequiredText(command.accountCode, "accountCode", maxLength = 64)
    val decision = normalizeDecision(command.decision)
    val latestImportVersion = command.latestImportVersion
      ?.takeIf { it > 0 }
      ?: throw MappingSuggestionDecisionBadRequestException("latestImportVersion must be a positive integer.")
    val suggestionFingerprint = command.suggestionFingerprint
      ?.trim()
      ?.takeIf { HEX_64_REGEX.matches(it) }
      ?: throw MappingSuggestionDecisionBadRequestException("suggestionFingerprint must be 64 lowercase hex characters.")
    val targetCode = when (decision) {
      MappingSuggestionHumanDecision.ACCEPT,
      MappingSuggestionHumanDecision.CORRECT ->
        normalizeRequiredText(command.targetCode, "targetCode", maxLength = 120)

      MappingSuggestionHumanDecision.REJECT -> {
        if (command.targetCode != null) {
          throw MappingSuggestionDecisionBadRequestException("targetCode must be absent or null for REJECT.")
        }
        null
      }
    }
    val reviewComment = MappingSuggestionDecisionPayloads.normalizeReviewComment(command.reviewComment)

    return NormalizedMappingSuggestionDecisionPayload(
      decision = decision,
      closingFolderId = closingFolderId,
      accountCode = accountCode,
      latestImportVersion = latestImportVersion,
      targetCode = targetCode,
      reviewComment = reviewComment,
      suggestionFingerprint = suggestionFingerprint
    )
  }

  private fun normalizeDecision(rawValue: String?): MappingSuggestionHumanDecision {
    val normalized = rawValue?.trim()
      ?: throw MappingSuggestionDecisionBadRequestException("decision is required.")
    return try {
      MappingSuggestionHumanDecision.valueOf(normalized)
    } catch (_: IllegalArgumentException) {
      throw MappingSuggestionDecisionBadRequestException("decision must be ACCEPT, CORRECT or REJECT.")
    }
  }

  private fun normalizeRequiredText(rawValue: String?, fieldName: String, maxLength: Int): String {
    val normalized = rawValue?.trim()?.takeUnless { it.isBlank() }
      ?: throw MappingSuggestionDecisionBadRequestException("$fieldName must not be blank.")
    if (normalized.length > maxLength) {
      throw MappingSuggestionDecisionBadRequestException("$fieldName must be at most $maxLength characters.")
    }
    if (normalized.hasForbiddenControlCharacters()) {
      throw MappingSuggestionDecisionBadRequestException("$fieldName contains unsupported control characters.")
    }
    return normalized
  }

  private fun normalizeIdempotencyKey(rawValue: String?): String {
    val normalized = rawValue?.trim()?.takeUnless { it.isBlank() }
      ?: throw MappingSuggestionDecisionBadRequestException("Idempotency-Key must not be blank.")
    if (normalized.length !in 8..200 || !IDEMPOTENCY_KEY_REGEX.matches(normalized)) {
      throw MappingSuggestionDecisionBadRequestException("Idempotency-Key is malformed.")
    }
    return normalized
  }

  private fun MappingSuggestionDecisionRequestRecord.toDecisionResult(): MappingSuggestionDecisionResult {
    if (resultKind == MappingSuggestionDecisionResultKind.PENDING || completedAt == null) {
      error("Mapping suggestion decision idempotency row is not terminal.")
    }
    return MappingSuggestionDecisionResult(
      decision = decision,
      accountCode = accountCode,
      resultKind = resultKind,
      appliedMapping = if (appliedAccountCode != null && appliedTargetCode != null) {
        ManualMappingEntry(accountCode = appliedAccountCode, targetCode = appliedTargetCode)
      } else {
        null
      }
    )
  }

  private fun conflict(resultKind: MappingSuggestionDecisionResultKind): MappingSuggestionDecisionCompletion =
    MappingSuggestionDecisionCompletion(resultKind = resultKind, appliedMapping = null)

  private fun requireAnyRole(access: TenantAccessContext, allowedRoles: Set<String>) {
    if (access.effectiveRoles.none { it in allowedRoles }) {
      throw AccessDeniedException("Insufficient role for mapping suggestion decision.")
    }
  }

  private fun lockFor(
    tenantId: UUID,
    closingFolderId: UUID,
    accountCode: String,
    idempotencyKey: String
  ): Any =
    decisionLocks.computeIfAbsent("$tenantId:$closingFolderId:$accountCode:$idempotencyKey") { Any() }

  private data class MappingSuggestionDecisionCompletion(
    val resultKind: MappingSuggestionDecisionResultKind,
    val appliedMapping: ManualMappingEntry?
  )

  companion object {
    private val WRITE_ROLES = setOf("ACCOUNTANT", "MANAGER", "ADMIN")
    private val DECISIONABLE_STATES = setOf(MappingSuggestionsState.READY, MappingSuggestionsState.PARTIAL)
    private val HEX_64_REGEX = Regex("^[0-9a-f]{64}$")
    private val IDEMPOTENCY_KEY_REGEX = Regex("^[A-Za-z0-9._:-]{8,200}$")
    private val decisionLocks = ConcurrentHashMap<String, Any>()
  }
}

@ResponseStatus(HttpStatus.BAD_REQUEST)
class MappingSuggestionDecisionBadRequestException(message: String) : RuntimeException(message)

@ResponseStatus(HttpStatus.CONFLICT)
class MappingSuggestionDecisionConflictException(message: String) : RuntimeException(message)
