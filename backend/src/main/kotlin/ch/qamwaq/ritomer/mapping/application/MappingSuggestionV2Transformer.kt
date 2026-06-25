package ch.qamwaq.ritomer.mapping.application

import java.util.Locale
import java.util.UUID

const val MAPPING_SUGGESTION_V2_SCHEMA_VERSION = "mapping-suggestion-v2"

sealed interface MappingSuggestionV2Item {
  val schemaVersion: String
  val outcome: MappingSuggestionV2Outcome
  val scope: MappingSuggestionV2Scope
}

sealed interface MappingSuggestionV2AccountScopedItem : MappingSuggestionV2Item {
  val accountCode: String
  val accountLabel: String
}

enum class MappingSuggestionV2Outcome {
  SUGGESTION,
  ABSTENTION,
  POLICY_BLOCK,
  PRECONDITION_BLOCK,
  TECHNICAL_DEGRADATION
}

enum class MappingSuggestionV2Scope {
  ACCOUNT,
  REQUEST,
  BATCH
}

data class MappingSuggestionV2Suggestion(
  override val accountCode: String,
  override val accountLabel: String,
  val targetCode: String,
  val explanationCode: MappingSuggestionV2ExplanationCode,
  val evidenceCodes: List<MappingSuggestionV2EvidenceCode>,
  val suggestionFingerprint: String
) : MappingSuggestionV2AccountScopedItem {
  override val schemaVersion: String = MAPPING_SUGGESTION_V2_SCHEMA_VERSION
  override val outcome: MappingSuggestionV2Outcome = MappingSuggestionV2Outcome.SUGGESTION
  override val scope: MappingSuggestionV2Scope = MappingSuggestionV2Scope.ACCOUNT
  val requiresHumanReview: Boolean = true

  init {
    requireAccountCode(accountCode)
    requireAccountLabel(accountLabel)
    requireTargetCode(targetCode)
    requireSuggestionEvidenceCodes(evidenceCodes)
    requireSuggestionFingerprint(suggestionFingerprint)
  }
}

data class MappingSuggestionV2Abstention(
  override val accountCode: String,
  override val accountLabel: String,
  val abstentionReasonCode: MappingSuggestionV2AbstentionReasonCode,
  val evidenceCodes: List<MappingSuggestionV2EvidenceCode>
) : MappingSuggestionV2AccountScopedItem {
  override val schemaVersion: String = MAPPING_SUGGESTION_V2_SCHEMA_VERSION
  override val outcome: MappingSuggestionV2Outcome = MappingSuggestionV2Outcome.ABSTENTION
  override val scope: MappingSuggestionV2Scope = MappingSuggestionV2Scope.ACCOUNT

  init {
    requireAccountCode(accountCode)
    requireAccountLabel(accountLabel)
    requireAbstentionEvidenceCodes(evidenceCodes)
  }
}

data class MappingSuggestionV2PolicyBlock(
  val policyBlockCode: MappingSuggestionV2PolicyBlockCode
) : MappingSuggestionV2Item {
  override val schemaVersion: String = MAPPING_SUGGESTION_V2_SCHEMA_VERSION
  override val outcome: MappingSuggestionV2Outcome = MappingSuggestionV2Outcome.POLICY_BLOCK
  override val scope: MappingSuggestionV2Scope = MappingSuggestionV2Scope.REQUEST
}

sealed interface MappingSuggestionV2PreconditionBlock : MappingSuggestionV2Item {
  val preconditionBlockCode: MappingSuggestionV2PreconditionBlockCode
}

data class MappingSuggestionV2AccountPreconditionBlock(
  override val accountCode: String,
  override val accountLabel: String,
  override val preconditionBlockCode: MappingSuggestionV2PreconditionBlockCode
) : MappingSuggestionV2PreconditionBlock, MappingSuggestionV2AccountScopedItem {
  override val schemaVersion: String = MAPPING_SUGGESTION_V2_SCHEMA_VERSION
  override val outcome: MappingSuggestionV2Outcome = MappingSuggestionV2Outcome.PRECONDITION_BLOCK
  override val scope: MappingSuggestionV2Scope = MappingSuggestionV2Scope.ACCOUNT

  init {
    require(preconditionBlockCode.scope == MappingSuggestionV2Scope.ACCOUNT) {
      "${preconditionBlockCode.name} is not compatible with ACCOUNT scope."
    }
    requireAccountCode(accountCode)
    requireAccountLabel(accountLabel)
  }
}

data class MappingSuggestionV2RequestPreconditionBlock(
  override val preconditionBlockCode: MappingSuggestionV2PreconditionBlockCode
) : MappingSuggestionV2PreconditionBlock {
  override val schemaVersion: String = MAPPING_SUGGESTION_V2_SCHEMA_VERSION
  override val outcome: MappingSuggestionV2Outcome = MappingSuggestionV2Outcome.PRECONDITION_BLOCK
  override val scope: MappingSuggestionV2Scope = MappingSuggestionV2Scope.REQUEST

  init {
    require(preconditionBlockCode.scope == MappingSuggestionV2Scope.REQUEST) {
      "${preconditionBlockCode.name} is not compatible with REQUEST scope."
    }
  }
}

sealed interface MappingSuggestionV2TechnicalDegradation : MappingSuggestionV2Item {
  val degradationCode: MappingSuggestionV2DegradationCode
}

data class MappingSuggestionV2InvalidModelOutput(
  override val accountCode: String,
  override val accountLabel: String,
  val invalidReasonCodes: List<MappingSuggestionV2InvalidReasonCode>
) : MappingSuggestionV2TechnicalDegradation, MappingSuggestionV2AccountScopedItem {
  override val schemaVersion: String = MAPPING_SUGGESTION_V2_SCHEMA_VERSION
  override val outcome: MappingSuggestionV2Outcome = MappingSuggestionV2Outcome.TECHNICAL_DEGRADATION
  override val scope: MappingSuggestionV2Scope = MappingSuggestionV2Scope.ACCOUNT
  override val degradationCode: MappingSuggestionV2DegradationCode =
    MappingSuggestionV2DegradationCode.INVALID_MODEL_OUTPUT

  init {
    requireAccountCode(accountCode)
    requireAccountLabel(accountLabel)
    requireInvalidReasonCodes(invalidReasonCodes)
  }
}

data class MappingSuggestionV2LocalInputInvalid(
  override val accountCode: String,
  override val accountLabel: String
) : MappingSuggestionV2TechnicalDegradation, MappingSuggestionV2AccountScopedItem {
  override val schemaVersion: String = MAPPING_SUGGESTION_V2_SCHEMA_VERSION
  override val outcome: MappingSuggestionV2Outcome = MappingSuggestionV2Outcome.TECHNICAL_DEGRADATION
  override val scope: MappingSuggestionV2Scope = MappingSuggestionV2Scope.ACCOUNT
  override val degradationCode: MappingSuggestionV2DegradationCode =
    MappingSuggestionV2DegradationCode.LOCAL_INPUT_INVALID

  init {
    requireAccountCode(accountCode)
    requireAccountLabel(accountLabel)
  }
}

data object MappingSuggestionV2RequestTimeout : MappingSuggestionV2TechnicalDegradation {
  override val schemaVersion: String = MAPPING_SUGGESTION_V2_SCHEMA_VERSION
  override val outcome: MappingSuggestionV2Outcome = MappingSuggestionV2Outcome.TECHNICAL_DEGRADATION
  override val scope: MappingSuggestionV2Scope = MappingSuggestionV2Scope.REQUEST
  override val degradationCode: MappingSuggestionV2DegradationCode = MappingSuggestionV2DegradationCode.TIMEOUT
}

data object MappingSuggestionV2BatchUnavailable : MappingSuggestionV2TechnicalDegradation {
  override val schemaVersion: String = MAPPING_SUGGESTION_V2_SCHEMA_VERSION
  override val outcome: MappingSuggestionV2Outcome = MappingSuggestionV2Outcome.TECHNICAL_DEGRADATION
  override val scope: MappingSuggestionV2Scope = MappingSuggestionV2Scope.BATCH
  override val degradationCode: MappingSuggestionV2DegradationCode = MappingSuggestionV2DegradationCode.UNAVAILABLE
}

enum class MappingSuggestionV2EvidenceCode {
  ACCOUNT_LABEL,
  TARGET_TAXONOMY
}

enum class MappingSuggestionV2ExplanationCode {
  TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE
}

enum class MappingSuggestionV2AbstentionReasonCode {
  OUT_OF_SCOPE,
  CONFLICTING_SIGNALS,
  INSUFFICIENT_EVIDENCE,
  TAXONOMY_GAP,
  AMBIGUOUS_TARGET
}

enum class MappingSuggestionV2PolicyBlockCode {
  NON_SYNTHETIC_REQUEST,
  CROSS_TENANT_REQUEST,
  OUTSIDE_ALLOWLIST_OR_PROVENANCE,
  LANGUAGE_OUT_OF_COHORT,
  GATE_INVALID,
  PRIVACY_OR_TENANT_BOUNDARY
}

enum class MappingSuggestionV2PreconditionBlockCode(val scope: MappingSuggestionV2Scope) {
  ACCOUNT_ALREADY_AFFECTED(MappingSuggestionV2Scope.ACCOUNT),
  ACCOUNT_NOT_IN_LATEST_IMPORT(MappingSuggestionV2Scope.ACCOUNT),
  STALE_IMPORT(MappingSuggestionV2Scope.REQUEST),
  NOT_ELIGIBLE(MappingSuggestionV2Scope.ACCOUNT)
}

enum class MappingSuggestionV2DegradationCode(val scope: MappingSuggestionV2Scope) {
  INVALID_MODEL_OUTPUT(MappingSuggestionV2Scope.ACCOUNT),
  UNAVAILABLE(MappingSuggestionV2Scope.BATCH),
  TIMEOUT(MappingSuggestionV2Scope.REQUEST),
  LOCAL_INPUT_INVALID(MappingSuggestionV2Scope.ACCOUNT)
}

enum class MappingSuggestionV2InvalidReasonCode {
  TARGET_UNKNOWN,
  TARGET_DEPRECATED,
  TARGET_NOT_SELECTABLE,
  SECTION_OR_ROOT_PROPOSED,
  MALFORMED_OUTPUT,
  SCHEMA_INVALID,
  CONTEXTUALLY_INADMISSIBLE_TARGET,
  VERSION_PIN_MISMATCH
}

enum class MappingSuggestionV2DecisionCode {
  ACCEPT,
  CORRECT,
  REJECT
}

private const val MAX_ACCOUNT_CODE_LENGTH = 64
private const val MAX_ACCOUNT_LABEL_LENGTH = 300
private const val MAX_TARGET_CODE_LENGTH = 120
private const val MAX_INVALID_REASON_CODES = 8
private val ACCOUNT_CODE_REGEX = Regex("^[0-9A-Z._-]+$")
private val SUGGESTION_FINGERPRINT_REGEX = Regex("^[0-9a-f]{64}$")
private val TAXONOMY_HASH_REGEX = Regex("^[0-9a-f]{64}$")
private val WHITESPACE_REGEX = Regex("\\s+")
private val SUGGESTION_REQUIRED_EVIDENCE_CODES = setOf(
  MappingSuggestionV2EvidenceCode.ACCOUNT_LABEL,
  MappingSuggestionV2EvidenceCode.TARGET_TAXONOMY
)
private val ABSTENTION_REQUIRED_EVIDENCE_CODES = listOf(MappingSuggestionV2EvidenceCode.ACCOUNT_LABEL)

object MappingSuggestionV2DecisionPolicy {
  fun allowedDecisionCodes(item: MappingSuggestionV2Item): List<MappingSuggestionV2DecisionCode> =
    when (item) {
      is MappingSuggestionV2Suggestion -> listOf(
        MappingSuggestionV2DecisionCode.ACCEPT,
        MappingSuggestionV2DecisionCode.CORRECT,
        MappingSuggestionV2DecisionCode.REJECT
      )
      is MappingSuggestionV2Abstention,
      is MappingSuggestionV2PolicyBlock,
      is MappingSuggestionV2PreconditionBlock,
      is MappingSuggestionV2TechnicalDegradation -> emptyList()
    }
}

private fun requireAccountCode(value: String) {
  require(value.isNotEmpty()) { "accountCode must not be empty." }
  require(value.length <= MAX_ACCOUNT_CODE_LENGTH) { "accountCode must not exceed $MAX_ACCOUNT_CODE_LENGTH characters." }
  require(ACCOUNT_CODE_REGEX.matches(value)) { "accountCode must match the v2 contract pattern." }
}

private fun requireAccountLabel(value: String) {
  require(value.isNotBlank()) { "accountLabel must not be blank." }
  require(value.length <= MAX_ACCOUNT_LABEL_LENGTH) {
    "accountLabel must not exceed $MAX_ACCOUNT_LABEL_LENGTH characters."
  }
}

private fun requireTargetCode(value: String) {
  require(value.isNotEmpty()) { "targetCode must not be empty." }
  require(value.length <= MAX_TARGET_CODE_LENGTH) { "targetCode must not exceed $MAX_TARGET_CODE_LENGTH characters." }
}

private fun requireSuggestionFingerprint(value: String) {
  require(SUGGESTION_FINGERPRINT_REGEX.matches(value)) {
    "suggestionFingerprint must be a lowercase SHA-256 hex digest."
  }
}

private fun requireTaxonomyHash(value: String) {
  require(TAXONOMY_HASH_REGEX.matches(value)) {
    "taxonomyHash must be the lowercase SHA-256 hex digest of the exact taxonomy snapshot."
  }
}

private fun requireSuggestionEvidenceCodes(evidenceCodes: List<MappingSuggestionV2EvidenceCode>) {
  require(evidenceCodes.toSet().size == evidenceCodes.size) { "evidenceCodes must be unique." }
  require(evidenceCodes.toSet() == SUGGESTION_REQUIRED_EVIDENCE_CODES && evidenceCodes.size == 2) {
    "SUGGESTION evidenceCodes must contain exactly ACCOUNT_LABEL and TARGET_TAXONOMY."
  }
}

private fun requireAbstentionEvidenceCodes(evidenceCodes: List<MappingSuggestionV2EvidenceCode>) {
  require(evidenceCodes == ABSTENTION_REQUIRED_EVIDENCE_CODES) {
    "ABSTENTION evidenceCodes must contain exactly ACCOUNT_LABEL."
  }
}

private fun requireInvalidReasonCodes(invalidReasonCodes: List<MappingSuggestionV2InvalidReasonCode>) {
  require(invalidReasonCodes.isNotEmpty()) { "invalidReasonCodes must not be empty." }
  require(invalidReasonCodes.size <= MAX_INVALID_REASON_CODES) {
    "invalidReasonCodes must not exceed $MAX_INVALID_REASON_CODES items."
  }
  require(invalidReasonCodes.toSet().size == invalidReasonCodes.size) { "invalidReasonCodes must be unique." }
}

object MappingSuggestionV2Transformer {
  fun policyBlock(
    code: MappingSuggestionV2PolicyBlockCode
  ): MappingSuggestionV2PolicyBlock =
    MappingSuggestionV2PolicyBlock(policyBlockCode = code)

  fun requestPreconditionBlock(
    code: MappingSuggestionV2PreconditionBlockCode
  ): MappingSuggestionV2RequestPreconditionBlock =
    MappingSuggestionV2RequestPreconditionBlock(preconditionBlockCode = code)

  fun accountPreconditionBlock(
    accountCode: String,
    localAccountLabel: String,
    code: MappingSuggestionV2PreconditionBlockCode
  ): MappingSuggestionV2AccountPreconditionBlock =
    MappingSuggestionV2AccountPreconditionBlock(
      accountCode = accountCode,
      accountLabel = normalizeLocalAccountLabel(localAccountLabel),
      preconditionBlockCode = code
    )

  fun batchUnavailable(): MappingSuggestionV2BatchUnavailable =
    MappingSuggestionV2BatchUnavailable

  fun fromOfflineResult(
    result: OfflineMappingEvalResult,
    closingFolderId: UUID,
    localAccountLabel: String,
    latestImportVersion: Int,
    taxonomyVersion: Int,
    taxonomyHash: String
  ): MappingSuggestionV2Item {
    require(latestImportVersion > 0) { "latestImportVersion must be positive." }
    require(taxonomyVersion > 0) { "taxonomyVersion must be positive." }
    requireTaxonomyHash(taxonomyHash)

    return when (result) {
      is OfflineMappingEvalSuggestion -> result.toV2Suggestion(
        closingFolderId,
        normalizeLocalAccountLabel(localAccountLabel),
        latestImportVersion,
        taxonomyVersion,
        taxonomyHash
      )
      is OfflineMappingEvalAbstention -> MappingSuggestionV2Abstention(
        accountCode = result.accountCode,
        accountLabel = normalizeLocalAccountLabel(localAccountLabel),
        abstentionReasonCode = result.reasonCode.toV2(),
        evidenceCodes = result.evidence.toV2EvidenceCodes()
      )
      is OfflineMappingEvalPolicyBlock -> MappingSuggestionV2PolicyBlock(
        policyBlockCode = result.blockCode.toV2()
      )
      is OfflineMappingEvalPreconditionBlock -> result.toV2PreconditionBlock(localAccountLabel)
      is OfflineMappingEvalInvalidInput -> MappingSuggestionV2LocalInputInvalid(
        accountCode = result.accountCode,
        accountLabel = normalizeLocalAccountLabel(localAccountLabel)
      )
      is OfflineMappingEvalInvalidModelOutput -> MappingSuggestionV2InvalidModelOutput(
        accountCode = result.accountCode,
        accountLabel = normalizeLocalAccountLabel(localAccountLabel),
        invalidReasonCodes = result.invalidReasons
          .map { it.toV2() }
          .sortedBy { it.name }
      )
      is OfflineMappingEvalProviderFailure -> result.failureCode.toV2TechnicalDegradation()
    }
  }

  private fun OfflineMappingEvalSuggestion.toV2Suggestion(
    closingFolderId: UUID,
    accountLabel: String,
    latestImportVersion: Int,
    taxonomyVersion: Int,
    taxonomyHash: String
  ): MappingSuggestionV2Suggestion {
    val evidenceCodes = evidence.toV2EvidenceCodes()
    val explanationCode = explanationCode.toV2()
    val fingerprint = MappingSuggestionV2Fingerprints.calculate(
      closingFolderId = closingFolderId,
      latestImportVersion = latestImportVersion,
      taxonomyVersion = taxonomyVersion,
      taxonomyHash = taxonomyHash,
      accountCode = accountCode,
      targetCode = suggestedTargetCode,
      evidenceCodes = evidenceCodes
    )

    return MappingSuggestionV2Suggestion(
      accountCode = accountCode,
      accountLabel = accountLabel,
      targetCode = suggestedTargetCode,
      explanationCode = explanationCode,
      evidenceCodes = evidenceCodes,
      suggestionFingerprint = fingerprint
    )
  }

  private fun OfflineMappingEvalPreconditionBlock.toV2PreconditionBlock(
    localAccountLabel: String
  ): MappingSuggestionV2PreconditionBlock {
    val code = blockCode.toV2()
    return when (code.scope) {
      MappingSuggestionV2Scope.ACCOUNT -> MappingSuggestionV2AccountPreconditionBlock(
        accountCode = accountCode,
        accountLabel = normalizeLocalAccountLabel(localAccountLabel),
        preconditionBlockCode = code
      )
      MappingSuggestionV2Scope.REQUEST -> MappingSuggestionV2RequestPreconditionBlock(
        preconditionBlockCode = code
      )
      MappingSuggestionV2Scope.BATCH -> error("${code.name} cannot use BATCH scope.")
    }
  }

  private fun normalizeLocalAccountLabel(raw: String): String {
    val normalized = raw.trim().replace(WHITESPACE_REGEX, " ")
    require(normalized.isNotBlank()) { "accountLabel must not be blank." }
    return normalized.take(MAX_ACCOUNT_LABEL_LENGTH)
  }

  private fun List<OfflineMappingEvalEvidence>.toV2EvidenceCodes(): List<MappingSuggestionV2EvidenceCode> {
    require(isNotEmpty()) { "evidenceCodes must not be empty." }
    val evidenceCodes = map { it.type.toV2() }
    require(evidenceCodes.toSet().size == evidenceCodes.size) { "evidenceCodes must be unique." }
    return evidenceCodes
  }

  private fun OfflineMappingEvalEvidenceType.toV2(): MappingSuggestionV2EvidenceCode =
    when (this) {
      OfflineMappingEvalEvidenceType.ACCOUNT_LABEL -> MappingSuggestionV2EvidenceCode.ACCOUNT_LABEL
      OfflineMappingEvalEvidenceType.TARGET_TAXONOMY -> MappingSuggestionV2EvidenceCode.TARGET_TAXONOMY
    }

  private fun OfflineMappingEvalExplanationCode.toV2(): MappingSuggestionV2ExplanationCode =
    when (this) {
      OfflineMappingEvalExplanationCode.TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE ->
        MappingSuggestionV2ExplanationCode.TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE
      OfflineMappingEvalExplanationCode.EVIDENCE_NOT_SUFFICIENT_FOR_AFFECTATION ->
        error("ABSTENTION explanations are not exposed as v2 suggestion explanation codes.")
    }

  private fun OfflineMappingEvalAbstentionReasonCode.toV2(): MappingSuggestionV2AbstentionReasonCode =
    when (this) {
      OfflineMappingEvalAbstentionReasonCode.OUT_OF_SCOPE -> MappingSuggestionV2AbstentionReasonCode.OUT_OF_SCOPE
      OfflineMappingEvalAbstentionReasonCode.CONFLICTING_SIGNALS ->
        MappingSuggestionV2AbstentionReasonCode.CONFLICTING_SIGNALS
      OfflineMappingEvalAbstentionReasonCode.INSUFFICIENT_EVIDENCE ->
        MappingSuggestionV2AbstentionReasonCode.INSUFFICIENT_EVIDENCE
      OfflineMappingEvalAbstentionReasonCode.TAXONOMY_GAP -> MappingSuggestionV2AbstentionReasonCode.TAXONOMY_GAP
      OfflineMappingEvalAbstentionReasonCode.AMBIGUOUS_TARGET ->
        MappingSuggestionV2AbstentionReasonCode.AMBIGUOUS_TARGET
    }

  private fun OfflineMappingEvalPolicyBlockCode.toV2(): MappingSuggestionV2PolicyBlockCode =
    when (this) {
      OfflineMappingEvalPolicyBlockCode.NON_SYNTHETIC_REQUEST ->
        MappingSuggestionV2PolicyBlockCode.NON_SYNTHETIC_REQUEST
      OfflineMappingEvalPolicyBlockCode.CROSS_TENANT_REQUEST ->
        MappingSuggestionV2PolicyBlockCode.CROSS_TENANT_REQUEST
      OfflineMappingEvalPolicyBlockCode.OUTSIDE_ALLOWLIST_OR_PROVENANCE ->
        MappingSuggestionV2PolicyBlockCode.OUTSIDE_ALLOWLIST_OR_PROVENANCE
      OfflineMappingEvalPolicyBlockCode.LANGUAGE_OUT_OF_COHORT ->
        MappingSuggestionV2PolicyBlockCode.LANGUAGE_OUT_OF_COHORT
      OfflineMappingEvalPolicyBlockCode.GATE_INVALID -> MappingSuggestionV2PolicyBlockCode.GATE_INVALID
      OfflineMappingEvalPolicyBlockCode.PRIVACY_OR_TENANT_BOUNDARY ->
        MappingSuggestionV2PolicyBlockCode.PRIVACY_OR_TENANT_BOUNDARY
    }

  private fun OfflineMappingEvalPreconditionBlockCode.toV2(): MappingSuggestionV2PreconditionBlockCode =
    when (this) {
      OfflineMappingEvalPreconditionBlockCode.ACCOUNT_ALREADY_AFFECTED ->
        MappingSuggestionV2PreconditionBlockCode.ACCOUNT_ALREADY_AFFECTED
      OfflineMappingEvalPreconditionBlockCode.ACCOUNT_NOT_IN_LATEST_IMPORT ->
        MappingSuggestionV2PreconditionBlockCode.ACCOUNT_NOT_IN_LATEST_IMPORT
      OfflineMappingEvalPreconditionBlockCode.STALE_IMPORT -> MappingSuggestionV2PreconditionBlockCode.STALE_IMPORT
      OfflineMappingEvalPreconditionBlockCode.NOT_ELIGIBLE -> MappingSuggestionV2PreconditionBlockCode.NOT_ELIGIBLE
    }

  private fun OfflineMappingEvalInvalidReasonCode.toV2(): MappingSuggestionV2InvalidReasonCode =
    when (this) {
      OfflineMappingEvalInvalidReasonCode.TARGET_UNKNOWN -> MappingSuggestionV2InvalidReasonCode.TARGET_UNKNOWN
      OfflineMappingEvalInvalidReasonCode.TARGET_DEPRECATED ->
        MappingSuggestionV2InvalidReasonCode.TARGET_DEPRECATED
      OfflineMappingEvalInvalidReasonCode.TARGET_NOT_SELECTABLE ->
        MappingSuggestionV2InvalidReasonCode.TARGET_NOT_SELECTABLE
      OfflineMappingEvalInvalidReasonCode.SECTION_OR_ROOT_PROPOSED ->
        MappingSuggestionV2InvalidReasonCode.SECTION_OR_ROOT_PROPOSED
      OfflineMappingEvalInvalidReasonCode.MALFORMED_OUTPUT -> MappingSuggestionV2InvalidReasonCode.MALFORMED_OUTPUT
      OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID -> MappingSuggestionV2InvalidReasonCode.SCHEMA_INVALID
      OfflineMappingEvalInvalidReasonCode.CONTEXTUALLY_INADMISSIBLE_TARGET ->
        MappingSuggestionV2InvalidReasonCode.CONTEXTUALLY_INADMISSIBLE_TARGET
      OfflineMappingEvalInvalidReasonCode.VERSION_PIN_MISMATCH ->
        MappingSuggestionV2InvalidReasonCode.VERSION_PIN_MISMATCH
    }

  private fun OfflineMappingEvalProviderFailureCode.toV2TechnicalDegradation(): MappingSuggestionV2TechnicalDegradation =
    when (this) {
      OfflineMappingEvalProviderFailureCode.PROVIDER_EXCEPTION -> MappingSuggestionV2BatchUnavailable
    }
}

object MappingSuggestionV2Fingerprints {
  fun calculate(
    closingFolderId: UUID,
    latestImportVersion: Int,
    taxonomyVersion: Int,
    taxonomyHash: String,
    accountCode: String,
    targetCode: String,
    evidenceCodes: List<MappingSuggestionV2EvidenceCode>
  ): String {
    require(latestImportVersion > 0) { "latestImportVersion must be positive." }
    require(taxonomyVersion > 0) { "taxonomyVersion must be positive." }
    requireTaxonomyHash(taxonomyHash)
    requireAccountCode(accountCode)
    requireTargetCode(targetCode)
    requireSuggestionEvidenceCodes(evidenceCodes)

    val evidenceLines = evidenceCodes
      .sortedBy { it.name }
      .mapIndexed { index, evidenceCode -> "evidenceCodes[$index]=${evidenceCode.name}" }

    return sha256Hex(
      (
        listOf(
          "mapping-suggestion-fingerprint-v2",
          "schemaVersion=$MAPPING_SUGGESTION_V2_SCHEMA_VERSION",
          "closingFolderId=$closingFolderId",
          "importVersion=$latestImportVersion",
          "taxonomyVersion=$taxonomyVersion",
          "taxonomyHash=$taxonomyHash",
          "outcome=${MappingSuggestionV2Outcome.SUGGESTION.name}",
          "accountCode=${accountCode.trim().uppercase(Locale.ROOT)}",
          "targetCode=${targetCode.trim()}"
        ) + evidenceLines
        ).joinToString("\n")
    )
  }
}
