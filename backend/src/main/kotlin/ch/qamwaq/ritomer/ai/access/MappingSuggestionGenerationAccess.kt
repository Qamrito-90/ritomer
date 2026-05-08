package ch.qamwaq.ritomer.ai.access

data class AiMappingSuggestionGenerationRequest(
  val latestImportVersion: Int,
  val taxonomyVersion: Int,
  val accounts: List<AiMappingSuggestionAccount>,
  val targets: List<AiMappingSuggestionTarget>
)

data class AiMappingSuggestionAccount(
  val accountCode: String,
  val sanitizedAccountLabel: String,
  val balanceSignal: AiMappingSuggestionBalanceSignal
)

enum class AiMappingSuggestionBalanceSignal {
  DEBIT_ONLY,
  CREDIT_ONLY,
  DEBIT_DOMINANT,
  CREDIT_DOMINANT,
  BALANCED_NON_ZERO,
  ZERO
}

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
