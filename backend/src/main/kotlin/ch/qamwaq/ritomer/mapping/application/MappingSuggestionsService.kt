package ch.qamwaq.ritomer.mapping.application

import ch.qamwaq.ritomer.ai.access.AiMappingSuggestion
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionAccount
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionGenerationRequest
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionTarget
import ch.qamwaq.ritomer.ai.access.MappingSuggestionGenerationAccess
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccess
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.mapping.access.ManualMappingAccess
import ch.qamwaq.ritomer.mapping.access.ProjectedManualMappingLine
import java.util.UUID
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service

data class MappingSuggestionsReadModel(
  val state: MappingSuggestionsState,
  val closingFolderId: UUID,
  val latestImportVersion: Int?,
  val taxonomyVersion: Int,
  val suggestions: List<MappingSuggestion>,
  val errors: List<MappingSuggestionError>
)

enum class MappingSuggestionsState {
  DISABLED,
  NO_IMPORT,
  READY,
  PARTIAL,
  UNAVAILABLE,
  TIMEOUT,
  INVALID_MODEL_OUTPUT,
  INSUFFICIENT_EVIDENCE,
  ARCHIVED_READ_ONLY
}

data class MappingSuggestion(
  val accountCode: String,
  val accountLabel: String,
  val suggestedTargetCode: String,
  val confidence: Double,
  val riskLevel: MappingSuggestionRiskLevel,
  val rationale: String,
  val evidence: List<MappingSuggestionEvidence>,
  val requiresHumanReview: Boolean,
  val schemaVersion: String,
  val promptVersion: String,
  val modelVersion: String
)

enum class MappingSuggestionRiskLevel {
  LOW,
  MEDIUM,
  HIGH
}

data class MappingSuggestionEvidence(
  val type: MappingSuggestionEvidenceType,
  val ref: String,
  val snippet: String
)

enum class MappingSuggestionEvidenceType {
  ACCOUNT_LABEL,
  BALANCE_IMPORT_LINE,
  TARGET_TAXONOMY,
  HISTORICAL_MAPPING,
  RULE_DOC,
  NOTE_TEMPLATE
}

data class MappingSuggestionError(
  val code: MappingSuggestionErrorCode,
  val message: String
)

enum class MappingSuggestionErrorCode {
  AI_MAPPING_SUGGESTIONS_DISABLED,
  NO_LATEST_IMPORT,
  AI_MAPPING_UNAVAILABLE,
  AI_MAPPING_TIMEOUT,
  INVALID_MODEL_OUTPUT,
  INSUFFICIENT_EVIDENCE,
  ARCHIVED_READ_ONLY,
  PARTIAL_SUGGESTIONS
}

@Service
class MappingSuggestionsService(
  private val closingFolderAccess: ClosingFolderAccess,
  private val manualMappingAccess: ManualMappingAccess,
  private val manualMappingTargetCatalog: ManualMappingTargetCatalog,
  private val mappingSuggestionGenerationAccess: MappingSuggestionGenerationAccess,
  @Value("\${ritomer.ai.mapping-suggestions.enabled:false}")
  private val mappingSuggestionsEnabled: Boolean
) {
  fun getSuggestions(access: TenantAccessContext, closingFolderId: UUID): MappingSuggestionsReadModel {
    requireAnyRole(access, READ_ROLES)
    val closingFolder = closingFolderAccess.getRequired(access.tenantId, closingFolderId)
    val taxonomyVersion = manualMappingTargetCatalog.taxonomyVersion()

    if (!mappingSuggestionsEnabled) {
      return MappingSuggestionsReadModel(
        state = MappingSuggestionsState.DISABLED,
        closingFolderId = closingFolderId,
        latestImportVersion = null,
        taxonomyVersion = taxonomyVersion,
        suggestions = emptyList(),
        errors = listOf(
          MappingSuggestionError(
            code = MappingSuggestionErrorCode.AI_MAPPING_SUGGESTIONS_DISABLED,
            message = "Mapping suggestions are disabled."
          )
        )
      )
    }

    val projection = manualMappingAccess.getCurrentProjection(access.tenantId, closingFolderId)
    if (closingFolder.status == ClosingFolderAccessStatus.ARCHIVED) {
      return MappingSuggestionsReadModel(
        state = MappingSuggestionsState.ARCHIVED_READ_ONLY,
        closingFolderId = closingFolderId,
        latestImportVersion = projection.latestImportVersion,
        taxonomyVersion = taxonomyVersion,
        suggestions = emptyList(),
        errors = listOf(
          MappingSuggestionError(
            code = MappingSuggestionErrorCode.ARCHIVED_READ_ONLY,
            message = "Closing folder is archived and mapping suggestions are read-only."
          )
        )
      )
    }

    val latestImportVersion = projection.latestImportVersion
      ?: return MappingSuggestionsReadModel(
        state = MappingSuggestionsState.NO_IMPORT,
        closingFolderId = closingFolderId,
        latestImportVersion = null,
        taxonomyVersion = taxonomyVersion,
        suggestions = emptyList(),
        errors = listOf(
          MappingSuggestionError(
            code = MappingSuggestionErrorCode.NO_LATEST_IMPORT,
            message = "No latest balance import is available for mapping suggestions."
          )
        )
      )

    val mappedAccountCodes = projection.mappings.map { it.accountCode }.toSet()
    val eligibleLines = projection.lines.filter { it.accountCode !in mappedAccountCodes }
    if (eligibleLines.isEmpty()) {
      return readyReadModel(closingFolderId, latestImportVersion, taxonomyVersion, suggestions = emptyList())
    }

    val selectableTargets = manualMappingTargetCatalog.all()
      .filter { it.selectable && !it.deprecated }
    val selectableTargetsByCode = selectableTargets.associateBy { it.code }
    val eligibleLinesByCode = eligibleLines.associateBy { it.accountCode }

    val result = try {
      mappingSuggestionGenerationAccess.generate(
        AiMappingSuggestionGenerationRequest(
          closingFolderId = closingFolderId,
          latestImportVersion = latestImportVersion,
          taxonomyVersion = taxonomyVersion,
          accounts = eligibleLines.map { it.toAiAccount() },
          targets = selectableTargets.map { it.toAiTarget() }
        )
      )
    } catch (_: RuntimeException) {
      return MappingSuggestionsReadModel(
        state = MappingSuggestionsState.UNAVAILABLE,
        closingFolderId = closingFolderId,
        latestImportVersion = latestImportVersion,
        taxonomyVersion = taxonomyVersion,
        suggestions = emptyList(),
        errors = listOf(
          MappingSuggestionError(
            code = MappingSuggestionErrorCode.AI_MAPPING_UNAVAILABLE,
            message = "Mapping suggestions are temporarily unavailable."
          )
        )
      )
    }

    val safeSuggestions = result.suggestions.mapNotNull {
      it.toSafeMappingSuggestion(eligibleLinesByCode, selectableTargetsByCode)
    }
    val rejectedCount = result.suggestions.size - safeSuggestions.size
    if (result.suggestions.isNotEmpty() && safeSuggestions.isEmpty()) {
      return MappingSuggestionsReadModel(
        state = MappingSuggestionsState.INVALID_MODEL_OUTPUT,
        closingFolderId = closingFolderId,
        latestImportVersion = latestImportVersion,
        taxonomyVersion = taxonomyVersion,
        suggestions = emptyList(),
        errors = listOf(
          MappingSuggestionError(
            code = MappingSuggestionErrorCode.INVALID_MODEL_OUTPUT,
            message = "Mapping suggestions were withheld because the adapter output did not satisfy the safety contract."
          )
        )
      )
    }

    val state = if (rejectedCount > 0) MappingSuggestionsState.PARTIAL else MappingSuggestionsState.READY
    val errors = if (state == MappingSuggestionsState.PARTIAL) {
      listOf(
        MappingSuggestionError(
          code = MappingSuggestionErrorCode.PARTIAL_SUGGESTIONS,
          message = "Some mapping suggestions were withheld because they did not satisfy the safety contract."
        )
      )
    } else {
      emptyList()
    }

    return MappingSuggestionsReadModel(
      state = state,
      closingFolderId = closingFolderId,
      latestImportVersion = latestImportVersion,
      taxonomyVersion = taxonomyVersion,
      suggestions = safeSuggestions.sortedBy { it.accountCode },
      errors = errors
    )
  }

  private fun readyReadModel(
    closingFolderId: UUID,
    latestImportVersion: Int,
    taxonomyVersion: Int,
    suggestions: List<MappingSuggestion>
  ): MappingSuggestionsReadModel =
    MappingSuggestionsReadModel(
      state = MappingSuggestionsState.READY,
      closingFolderId = closingFolderId,
      latestImportVersion = latestImportVersion,
      taxonomyVersion = taxonomyVersion,
      suggestions = suggestions,
      errors = emptyList()
    )

  private fun ProjectedManualMappingLine.toAiAccount(): AiMappingSuggestionAccount =
    AiMappingSuggestionAccount(
      accountCode = accountCode,
      accountLabel = accountLabel,
      debit = debit,
      credit = credit
    )

  private fun ManualMappingTarget.toAiTarget(): AiMappingSuggestionTarget =
    AiMappingSuggestionTarget(
      code = code,
      label = label,
      selectable = selectable,
      deprecated = deprecated
    )

  private fun AiMappingSuggestion.toSafeMappingSuggestion(
    eligibleLinesByCode: Map<String, ProjectedManualMappingLine>,
    selectableTargetsByCode: Map<String, ManualMappingTarget>
  ): MappingSuggestion? {
    val line = eligibleLinesByCode[accountCode] ?: return null
    selectableTargetsByCode[suggestedTargetCode] ?: return null
    if (confidence !in 0.0..1.0) return null
    if (!requiresHumanReview) return null
    if (schemaVersion != SCHEMA_VERSION) return null
    if (promptVersion.isBlank() || modelVersion.isBlank()) return null
    if (evidence.isEmpty() || evidence.size > MAX_EVIDENCE_COUNT) return null
    if (rationale.isBlank() || rationale.length > MAX_RATIONALE_LENGTH || rationale.containsForbiddenContent()) return null

    val safeEvidence = evidence.mapNotNull { evidenceItem ->
      if (evidenceItem.ref.isBlank() || evidenceItem.snippet.isBlank()) return@mapNotNull null
      if (evidenceItem.ref.length > MAX_EVIDENCE_REF_LENGTH || evidenceItem.snippet.length > MAX_EVIDENCE_SNIPPET_LENGTH) return@mapNotNull null
      if (evidenceItem.ref.containsForbiddenContent() || evidenceItem.snippet.containsForbiddenContent()) return@mapNotNull null

      MappingSuggestionEvidence(
        type = MappingSuggestionEvidenceType.valueOf(evidenceItem.type.name),
        ref = evidenceItem.ref,
        snippet = evidenceItem.snippet
      )
    }
    if (safeEvidence.size != evidence.size || safeEvidence.isEmpty()) return null

    return MappingSuggestion(
      accountCode = line.accountCode,
      accountLabel = line.accountLabel,
      suggestedTargetCode = suggestedTargetCode,
      confidence = confidence,
      riskLevel = MappingSuggestionRiskLevel.valueOf(riskLevel.name),
      rationale = rationale,
      evidence = safeEvidence,
      requiresHumanReview = true,
      schemaVersion = schemaVersion,
      promptVersion = promptVersion,
      modelVersion = modelVersion
    )
  }

  private fun String.containsForbiddenContent(): Boolean {
    val normalized = lowercase()
    return FORBIDDEN_CONTENT_MARKERS.any { it in normalized }
  }

  private fun requireAnyRole(access: TenantAccessContext, allowedRoles: Set<String>) {
    if (access.effectiveRoles.none { it in allowedRoles }) {
      throw AccessDeniedException("Insufficient role for mapping suggestions.")
    }
  }

  companion object {
    private val READ_ROLES = setOf("ACCOUNTANT", "REVIEWER", "MANAGER", "ADMIN")
    private const val SCHEMA_VERSION = "mapping-suggestion-v1"
    private const val MAX_EVIDENCE_COUNT = 8
    private const val MAX_EVIDENCE_REF_LENGTH = 200
    private const val MAX_EVIDENCE_SNIPPET_LENGTH = 300
    private const val MAX_RATIONALE_LENGTH = 600
    private val FORBIDDEN_CONTENT_MARKERS = listOf(
      ".env",
      "credential",
      "dsn",
      "prompt",
      "raw csv",
      "secret",
      "signed url",
      "storage key",
      "storage_object_key",
      "token"
    )
  }
}
