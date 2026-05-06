package ch.qamwaq.ritomer.ai.access

import java.math.BigDecimal
import java.util.UUID

data class AiMappingSuggestionGenerationRequest(
  val closingFolderId: UUID,
  val latestImportVersion: Int,
  val taxonomyVersion: Int,
  val accounts: List<AiMappingSuggestionAccount>,
  val targets: List<AiMappingSuggestionTarget>
)

data class AiMappingSuggestionAccount(
  val accountCode: String,
  val accountLabel: String,
  val debit: BigDecimal,
  val credit: BigDecimal
)

data class AiMappingSuggestionTarget(
  val code: String,
  val label: String,
  val selectable: Boolean,
  val deprecated: Boolean
)

data class AiMappingSuggestionGenerationResult(
  val suggestions: List<AiMappingSuggestion>
)

data class AiMappingSuggestion(
  val accountCode: String,
  val accountLabel: String,
  val suggestedTargetCode: String,
  val confidence: Double,
  val riskLevel: AiMappingSuggestionRiskLevel,
  val rationale: String,
  val evidence: List<AiMappingSuggestionEvidence>,
  val requiresHumanReview: Boolean,
  val schemaVersion: String,
  val promptVersion: String,
  val modelVersion: String
)

enum class AiMappingSuggestionRiskLevel {
  LOW,
  MEDIUM,
  HIGH
}

data class AiMappingSuggestionEvidence(
  val type: AiMappingSuggestionEvidenceType,
  val ref: String,
  val snippet: String
)

enum class AiMappingSuggestionEvidenceType {
  ACCOUNT_LABEL,
  BALANCE_IMPORT_LINE,
  TARGET_TAXONOMY,
  HISTORICAL_MAPPING,
  RULE_DOC,
  NOTE_TEMPLATE
}

fun interface MappingSuggestionGenerationAccess {
  fun generate(request: AiMappingSuggestionGenerationRequest): AiMappingSuggestionGenerationResult
}
