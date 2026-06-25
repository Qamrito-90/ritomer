package ch.qamwaq.ritomer.mapping.application

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper

data class OfflineMappingEvalRequest(
  val accountCode: String,
  val accountLabel: String,
  val balanceSignal: String,
  val taxonomy: OfflineMappingEvalTaxonomy,
  val datasetPolicy: String = "SYNTHETIC_DEMO_ONLY",
  val requestSynthetic: Boolean = true,
  val crossTenantSignal: String? = null,
  val provenanceStatus: String = "ALLOWLISTED",
  val language: String = "en",
  val currentAffectationStatus: String = "NONE"
)

@JvmInline
value class OfflineMappingEvalAccountCode private constructor(val value: String) {
  companion object {
    private const val MAX_LENGTH = 32
    private val PATTERN = Regex("""^[0-9A-Z._-]+$""")

    fun parse(raw: String): OfflineMappingEvalAccountCode? {
      val normalized = raw.trim().uppercase()
      return if (normalized.isNotEmpty() && normalized.length <= MAX_LENGTH && PATTERN.matches(normalized)) {
        OfflineMappingEvalAccountCode(normalized)
      } else {
        null
      }
    }
  }
}

enum class OfflineMappingEvalBalanceSignal {
  DEBIT_DOMINANT,
  CREDIT_DOMINANT,
  ZERO_OR_NEAR_ZERO,
  MIXED_OR_UNKNOWN
}

enum class OfflineMappingEvalDatasetPolicy {
  SYNTHETIC_DEMO_ONLY,
  DECLARED_NON_SYNTHETIC
}

enum class OfflineMappingEvalCrossTenantSignal {
  REQUEST_SCOPE_MISMATCH
}

enum class OfflineMappingEvalProvenanceStatus {
  ALLOWLISTED,
  OUTSIDE_ALLOWLIST
}

enum class OfflineMappingEvalLanguage(val code: String) {
  EN("en"),
  DE("de");

  companion object {
    fun parse(raw: String): OfflineMappingEvalLanguage? =
      values().firstOrNull { it.code == raw.trim().lowercase() }
  }
}

enum class OfflineMappingEvalCurrentAffectationStatus {
  NONE,
  PRESENT_WITHOUT_TARGET
}

private data class ValidatedOfflineMappingEvalRequest(
  val accountCode: OfflineMappingEvalAccountCode,
  val sanitizedAccountLabel: String,
  val balanceSignal: OfflineMappingEvalBalanceSignal,
  val taxonomy: OfflineMappingEvalTaxonomy,
  val datasetPolicy: OfflineMappingEvalDatasetPolicy,
  val requestSynthetic: Boolean,
  val crossTenantSignal: OfflineMappingEvalCrossTenantSignal?,
  val provenanceStatus: OfflineMappingEvalProvenanceStatus,
  val language: OfflineMappingEvalLanguage,
  val currentAffectationStatus: OfflineMappingEvalCurrentAffectationStatus
)

data class OfflineMappingEvalTaxonomy(
  val id: String,
  val taxonomyVersion: Int,
  val entries: List<OfflineMappingEvalTarget>
) {
  private val targetsByCode = entries.associateBy { it.code }

  fun findByCode(code: String): OfflineMappingEvalTarget? = targetsByCode[code]

  fun candidateTargets(): List<OfflineMappingEvalTarget> =
    entries
      .filter {
        it.pilotRole == OfflineMappingEvalPilotRole.CANDIDATE_LEAF &&
          it.granularity == "LEAF" &&
          it.selectable &&
          !it.deprecated
      }
      .sortedWith(compareBy<OfflineMappingEvalTarget> { it.displayOrder }.thenBy { it.code })
}

data class OfflineMappingEvalTarget(
  val code: String,
  val label: String,
  val selectable: Boolean,
  val deprecated: Boolean,
  val granularity: String,
  val pilotRole: OfflineMappingEvalPilotRole,
  val displayOrder: Int
)

enum class OfflineMappingEvalPilotRole {
  ROOT,
  SECTION,
  CANDIDATE_LEAF
}

data class OfflineMappingEvalProviderRequest(
  val account: OfflineMappingEvalProviderAccount,
  val candidateTargets: List<OfflineMappingEvalProviderTarget>
)

data class OfflineMappingEvalProviderAccount(
  val accountCode: String,
  val sanitizedAccountLabel: String,
  val balanceSignal: OfflineMappingEvalBalanceSignal
)

data class OfflineMappingEvalProviderTarget(
  val code: String,
  val label: String,
  val selectable: Boolean,
  val deprecated: Boolean
)

data class OfflineMappingEvalProviderResponse(
  val rawJson: String,
  val promptVersion: String,
  val modelVersion: String
)

fun interface OfflineMappingEvalProvider {
  fun generate(request: OfflineMappingEvalProviderRequest): OfflineMappingEvalProviderResponse
}

sealed interface OfflineMappingEvalResult {
  val accountCode: String
  val providerCallCount: Int
  val businessAbstentionCounted: Boolean
}

data class OfflineMappingEvalSuggestion(
  override val accountCode: String,
  val suggestedTargetCode: String,
  val evidence: List<OfflineMappingEvalEvidence>,
  val explanationCode: OfflineMappingEvalExplanationCode,
  override val providerCallCount: Int = 1,
  override val businessAbstentionCounted: Boolean = false
) : OfflineMappingEvalResult {
  val requiresHumanReview: Boolean
    get() = true
}

data class OfflineMappingEvalAbstention(
  override val accountCode: String,
  val reasonCode: OfflineMappingEvalAbstentionReasonCode,
  val evidence: List<OfflineMappingEvalEvidence>,
  val explanationCode: OfflineMappingEvalExplanationCode,
  override val providerCallCount: Int = 1,
  override val businessAbstentionCounted: Boolean = true
) : OfflineMappingEvalResult

data class OfflineMappingEvalPolicyBlock(
  override val accountCode: String,
  val blockCode: OfflineMappingEvalPolicyBlockCode,
  override val providerCallCount: Int = 0,
  override val businessAbstentionCounted: Boolean = false
) : OfflineMappingEvalResult

data class OfflineMappingEvalPreconditionBlock(
  override val accountCode: String,
  val blockCode: OfflineMappingEvalPreconditionBlockCode,
  override val providerCallCount: Int = 0,
  override val businessAbstentionCounted: Boolean = false
) : OfflineMappingEvalResult

data class OfflineMappingEvalInvalidInput(
  override val accountCode: String,
  val invalidReasons: Set<OfflineMappingEvalInvalidInputReasonCode>,
  override val providerCallCount: Int = 0,
  override val businessAbstentionCounted: Boolean = false
) : OfflineMappingEvalResult

sealed interface OfflineMappingEvalTechnicalFailure : OfflineMappingEvalResult

data class OfflineMappingEvalInvalidModelOutput(
  override val accountCode: String,
  val invalidReasons: Set<OfflineMappingEvalInvalidReasonCode>,
  override val providerCallCount: Int = 1,
  override val businessAbstentionCounted: Boolean = false
) : OfflineMappingEvalTechnicalFailure

data class OfflineMappingEvalProviderFailure(
  override val accountCode: String,
  val failureCode: OfflineMappingEvalProviderFailureCode,
  override val providerCallCount: Int = 1,
  override val businessAbstentionCounted: Boolean = false
) : OfflineMappingEvalTechnicalFailure

data class OfflineMappingEvalEvidence(
  val type: OfflineMappingEvalEvidenceType,
  val ref: String,
  val snippet: String
)

enum class OfflineMappingEvalEvidenceType {
  ACCOUNT_LABEL,
  TARGET_TAXONOMY
}

enum class OfflineMappingEvalAbstentionReasonCode {
  OUT_OF_SCOPE,
  CONFLICTING_SIGNALS,
  INSUFFICIENT_EVIDENCE,
  TAXONOMY_GAP,
  AMBIGUOUS_TARGET
}

enum class OfflineMappingEvalPolicyBlockCode {
  NON_SYNTHETIC_REQUEST,
  CROSS_TENANT_REQUEST,
  OUTSIDE_ALLOWLIST_OR_PROVENANCE,
  LANGUAGE_OUT_OF_COHORT,
  GATE_INVALID,
  PRIVACY_OR_TENANT_BOUNDARY
}

enum class OfflineMappingEvalPreconditionBlockCode {
  ACCOUNT_ALREADY_AFFECTED,
  ACCOUNT_NOT_IN_LATEST_IMPORT,
  STALE_IMPORT,
  NOT_ELIGIBLE
}

enum class OfflineMappingEvalInvalidInputReasonCode {
  ACCOUNT_CODE_INVALID,
  BALANCE_SIGNAL_UNKNOWN,
  DATASET_POLICY_UNKNOWN,
  PROVENANCE_STATUS_UNKNOWN,
  CROSS_TENANT_SIGNAL_UNKNOWN,
  LANGUAGE_UNKNOWN,
  CURRENT_AFFECTATION_STATUS_UNKNOWN,
  EMPTY_SANITIZED_ACCOUNT_LABEL
}

enum class OfflineMappingEvalInvalidReasonCode {
  TARGET_UNKNOWN,
  TARGET_DEPRECATED,
  TARGET_NOT_SELECTABLE,
  SECTION_OR_ROOT_PROPOSED,
  MALFORMED_OUTPUT,
  SCHEMA_INVALID,
  CONTEXTUALLY_INADMISSIBLE_TARGET,
  VERSION_PIN_MISMATCH
}

enum class OfflineMappingEvalProviderFailureCode {
  PROVIDER_EXCEPTION
}

enum class OfflineMappingEvalExplanationCode {
  TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE,
  EVIDENCE_NOT_SUFFICIENT_FOR_AFFECTATION
}

data class OfflineMappingEvalMetrics(
  val totalCases: Int,
  val suggestions: Int,
  val businessAbstentions: Int,
  val policyBlocks: Int,
  val preconditionBlocks: Int,
  val invalidInputs: Int,
  val invalidModelOutputs: Int,
  val providerFailures: Int,
  val technicalFailures: Int,
  val providerCalls: Int,
  val providerCallsOnPolicyOrPreconditionBlocks: Int
) {
  companion object {
    fun from(results: List<OfflineMappingEvalResult>): OfflineMappingEvalMetrics =
      OfflineMappingEvalMetrics(
        totalCases = results.size,
        suggestions = results.count { it is OfflineMappingEvalSuggestion },
        businessAbstentions = results.count { it is OfflineMappingEvalAbstention },
        policyBlocks = results.count { it is OfflineMappingEvalPolicyBlock },
        preconditionBlocks = results.count { it is OfflineMappingEvalPreconditionBlock },
        invalidInputs = results.count { it is OfflineMappingEvalInvalidInput },
        invalidModelOutputs = results.count { it is OfflineMappingEvalInvalidModelOutput },
        providerFailures = results.count { it is OfflineMappingEvalProviderFailure },
        technicalFailures = results.count { it is OfflineMappingEvalTechnicalFailure },
        providerCalls = results.sumOf { it.providerCallCount },
        providerCallsOnPolicyOrPreconditionBlocks = results
          .filter { it is OfflineMappingEvalPolicyBlock || it is OfflineMappingEvalPreconditionBlock }
          .sumOf { it.providerCallCount }
      )
  }
}

class OfflineMappingEvalEngine042a2(
  private val provider: OfflineMappingEvalProvider,
  private val objectMapper: ObjectMapper = jacksonObjectMapper()
) {
  fun evaluate(request: OfflineMappingEvalRequest): OfflineMappingEvalResult {
    val validatedRequest = validateInput(request)
      ?: return OfflineMappingEvalInvalidInput(
        accountCode = accountCodeForResult(request.accountCode),
        invalidReasons = invalidInputReasons(request)
      )

    policyOrPreconditionBlock(validatedRequest)?.let { return it }

    val providerRequest = OfflineMappingEvalProviderRequest(
      account = OfflineMappingEvalProviderAccount(
        accountCode = validatedRequest.accountCode.value,
        sanitizedAccountLabel = validatedRequest.sanitizedAccountLabel,
        balanceSignal = validatedRequest.balanceSignal
      ),
      candidateTargets = validatedRequest.taxonomy.candidateTargets().map {
        OfflineMappingEvalProviderTarget(
          code = it.code,
          label = it.label,
          selectable = it.selectable,
          deprecated = it.deprecated
        )
      }
    )

    val providerResponse = try {
      provider.generate(providerRequest)
    } catch (_: Exception) {
      return OfflineMappingEvalProviderFailure(
        accountCode = validatedRequest.accountCode.value,
        failureCode = OfflineMappingEvalProviderFailureCode.PROVIDER_EXCEPTION
      )
    }

    return validateProviderOutput(validatedRequest, providerResponse)
  }

  private fun validateInput(request: OfflineMappingEvalRequest): ValidatedOfflineMappingEvalRequest? {
    if (invalidInputReasons(request).isNotEmpty()) return null

    return ValidatedOfflineMappingEvalRequest(
      accountCode = OfflineMappingEvalAccountCode.parse(request.accountCode)!!,
      sanitizedAccountLabel = MappingSuggestionPayloadMinimizer.sanitizeAccountLabel(request.accountLabel),
      balanceSignal = request.balanceSignal.toEnumOrNull<OfflineMappingEvalBalanceSignal>()!!,
      taxonomy = request.taxonomy,
      datasetPolicy = request.datasetPolicy.toEnumOrNull<OfflineMappingEvalDatasetPolicy>()!!,
      requestSynthetic = request.requestSynthetic,
      crossTenantSignal = request.crossTenantSignal?.toEnumOrNull<OfflineMappingEvalCrossTenantSignal>(),
      provenanceStatus = request.provenanceStatus.toEnumOrNull<OfflineMappingEvalProvenanceStatus>()!!,
      language = OfflineMappingEvalLanguage.parse(request.language)!!,
      currentAffectationStatus = request.currentAffectationStatus.toEnumOrNull<OfflineMappingEvalCurrentAffectationStatus>()!!
    )
  }

  private fun invalidInputReasons(request: OfflineMappingEvalRequest): Set<OfflineMappingEvalInvalidInputReasonCode> {
    val reasons = linkedSetOf<OfflineMappingEvalInvalidInputReasonCode>()

    if (OfflineMappingEvalAccountCode.parse(request.accountCode) == null) {
      reasons += OfflineMappingEvalInvalidInputReasonCode.ACCOUNT_CODE_INVALID
    }
    if (request.balanceSignal.toEnumOrNull<OfflineMappingEvalBalanceSignal>() == null) {
      reasons += OfflineMappingEvalInvalidInputReasonCode.BALANCE_SIGNAL_UNKNOWN
    }
    if (request.datasetPolicy.toEnumOrNull<OfflineMappingEvalDatasetPolicy>() == null) {
      reasons += OfflineMappingEvalInvalidInputReasonCode.DATASET_POLICY_UNKNOWN
    }
    if (request.provenanceStatus.toEnumOrNull<OfflineMappingEvalProvenanceStatus>() == null) {
      reasons += OfflineMappingEvalInvalidInputReasonCode.PROVENANCE_STATUS_UNKNOWN
    }
    if (request.crossTenantSignal != null && request.crossTenantSignal.toEnumOrNull<OfflineMappingEvalCrossTenantSignal>() == null) {
      reasons += OfflineMappingEvalInvalidInputReasonCode.CROSS_TENANT_SIGNAL_UNKNOWN
    }
    if (OfflineMappingEvalLanguage.parse(request.language) == null) {
      reasons += OfflineMappingEvalInvalidInputReasonCode.LANGUAGE_UNKNOWN
    }
    if (request.currentAffectationStatus.toEnumOrNull<OfflineMappingEvalCurrentAffectationStatus>() == null) {
      reasons += OfflineMappingEvalInvalidInputReasonCode.CURRENT_AFFECTATION_STATUS_UNKNOWN
    }

    val sanitizedAccountLabel = MappingSuggestionPayloadMinimizer.sanitizeAccountLabel(request.accountLabel)
    if (sanitizedAccountLabel == MappingSuggestionPayloadMinimizer.EMPTY_SANITIZED_ACCOUNT_LABEL) {
      reasons += OfflineMappingEvalInvalidInputReasonCode.EMPTY_SANITIZED_ACCOUNT_LABEL
    }

    return reasons
  }

  private fun accountCodeForResult(rawAccountCode: String): String =
    OfflineMappingEvalAccountCode.parse(rawAccountCode)?.value ?: "INVALID_INPUT"

  private fun policyOrPreconditionBlock(request: ValidatedOfflineMappingEvalRequest): OfflineMappingEvalResult? =
    when {
      !request.requestSynthetic || request.datasetPolicy == OfflineMappingEvalDatasetPolicy.DECLARED_NON_SYNTHETIC ->
        OfflineMappingEvalPolicyBlock(request.accountCode.value, OfflineMappingEvalPolicyBlockCode.NON_SYNTHETIC_REQUEST)
      request.crossTenantSignal == OfflineMappingEvalCrossTenantSignal.REQUEST_SCOPE_MISMATCH ->
        OfflineMappingEvalPolicyBlock(request.accountCode.value, OfflineMappingEvalPolicyBlockCode.CROSS_TENANT_REQUEST)
      request.provenanceStatus == OfflineMappingEvalProvenanceStatus.OUTSIDE_ALLOWLIST ->
        OfflineMappingEvalPolicyBlock(request.accountCode.value, OfflineMappingEvalPolicyBlockCode.OUTSIDE_ALLOWLIST_OR_PROVENANCE)
      request.language != OfflineMappingEvalLanguage.EN ->
        OfflineMappingEvalPolicyBlock(request.accountCode.value, OfflineMappingEvalPolicyBlockCode.LANGUAGE_OUT_OF_COHORT)
      request.currentAffectationStatus != OfflineMappingEvalCurrentAffectationStatus.NONE ->
        OfflineMappingEvalPreconditionBlock(request.accountCode.value, OfflineMappingEvalPreconditionBlockCode.ACCOUNT_ALREADY_AFFECTED)
      else -> null
    }

  private fun validateProviderOutput(
    request: ValidatedOfflineMappingEvalRequest,
    providerResponse: OfflineMappingEvalProviderResponse
  ): OfflineMappingEvalResult {
    if (providerResponse.rawJson.isBlank()) {
      return invalid(request, OfflineMappingEvalInvalidReasonCode.MALFORMED_OUTPUT)
    }
    if (
      providerResponse.promptVersion != PROVIDER_PROMPT_VERSION ||
      providerResponse.modelVersion != PROVIDER_MODEL_VERSION
    ) {
      return invalid(request, OfflineMappingEvalInvalidReasonCode.VERSION_PIN_MISMATCH)
    }

    val root = try {
      objectMapper.readTree(providerResponse.rawJson)
        ?: return invalid(request, OfflineMappingEvalInvalidReasonCode.MALFORMED_OUTPUT)
    } catch (_: Exception) {
      return invalid(request, OfflineMappingEvalInvalidReasonCode.MALFORMED_OUTPUT)
    }

    return try {
      validateProviderRoot(request, root)
    } catch (_: RuntimeException) {
      invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    }
  }

  private fun validateProviderRoot(
    request: ValidatedOfflineMappingEvalRequest,
    root: JsonNode
  ): OfflineMappingEvalResult {
    if (!root.isObject || root.containsNullRecursively()) {
      return invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    }

    val outcome = root.requiredText("outcome")
      ?: return invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)

    return when (outcome) {
      "SUGGESTION" -> validateSuggestion(request, root)
      "ABSTENTION" -> validateAbstention(request, root)
      else -> invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    }
  }

  private fun validateSuggestion(
    request: ValidatedOfflineMappingEvalRequest,
    root: JsonNode
  ): OfflineMappingEvalResult {
    if (!root.hasAllowedFields(SUGGESTION_FIELDS)) {
      return invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    }
    if (!root.hasRequiredFields(SUGGESTION_REQUIRED_FIELDS)) {
      return invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    }

    val common = validatedCommonFields(request, root)
      ?: return invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    if (common.explanationCode != OfflineMappingEvalExplanationCode.TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE) {
      return invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    }
    if (
      common.evidenceTypes.count { it == OfflineMappingEvalEvidenceType.ACCOUNT_LABEL } != 1 ||
      common.evidenceTypes.count { it == OfflineMappingEvalEvidenceType.TARGET_TAXONOMY } != 1 ||
      common.evidenceTypes.size != 2
    ) {
      return invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    }

    val suggestedTargetCode = root.requiredText("suggestedTargetCode")
      ?: return invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)

    val targetReasons = validateTarget(request.taxonomy, suggestedTargetCode)
    if (targetReasons.isNotEmpty()) {
      return invalid(request, targetReasons)
    }
    val target = request.taxonomy.findByCode(suggestedTargetCode)
      ?: return invalid(request, OfflineMappingEvalInvalidReasonCode.TARGET_UNKNOWN)

    return OfflineMappingEvalSuggestion(
      accountCode = request.accountCode.value,
      suggestedTargetCode = suggestedTargetCode,
      evidence = listOf(
        accountLabelEvidence(request),
        targetTaxonomyEvidence(target)
      ),
      explanationCode = common.explanationCode
    )
  }

  private fun validateAbstention(
    request: ValidatedOfflineMappingEvalRequest,
    root: JsonNode
  ): OfflineMappingEvalResult {
    if (!root.hasAllowedFields(ABSTENTION_FIELDS)) {
      return invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    }
    if (!root.hasRequiredFields(ABSTENTION_REQUIRED_FIELDS)) {
      return invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    }

    val common = validatedCommonFields(request, root)
      ?: return invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    if (common.explanationCode != OfflineMappingEvalExplanationCode.EVIDENCE_NOT_SUFFICIENT_FOR_AFFECTATION) {
      return invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    }
    if (common.evidenceTypes != listOf(OfflineMappingEvalEvidenceType.ACCOUNT_LABEL)) {
      return invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    }
    val reasonCode = root.requiredText("reasonCode")?.toEnumOrNull<OfflineMappingEvalAbstentionReasonCode>()
      ?: return invalid(request, OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)

    return OfflineMappingEvalAbstention(
      accountCode = request.accountCode.value,
      reasonCode = reasonCode,
      evidence = listOf(accountLabelEvidence(request)),
      explanationCode = common.explanationCode
    )
  }

  private fun validatedCommonFields(
    request: ValidatedOfflineMappingEvalRequest,
    root: JsonNode
  ): ValidatedCommonFields? {
    if (root.requiredText("accountCode") != request.accountCode.value) return null
    if (root.requiredText("schemaVersion") != PROVIDER_SCHEMA_VERSION) return null

    val explanationCode = root.requiredText("explanationCode")?.toEnumOrNull<OfflineMappingEvalExplanationCode>()
      ?: return null
    val evidenceTypes = validatedEvidenceTypes(root.get("evidence")) ?: return null

    return ValidatedCommonFields(
      evidenceTypes = evidenceTypes,
      explanationCode = explanationCode
    )
  }

  private fun validatedEvidenceTypes(node: JsonNode?): List<OfflineMappingEvalEvidenceType>? {
    if (node == null || !node.isArray || node.size() !in 1..MAX_EVIDENCE_ITEMS) {
      return null
    }

    val evidenceTypes = mutableListOf<OfflineMappingEvalEvidenceType>()
    node.forEach { item ->
      if (!item.isObject || !item.hasAllowedFields(EVIDENCE_FIELDS) || !item.hasRequiredFields(EVIDENCE_FIELDS)) {
        return null
      }
      val type = item.requiredText("type")?.toEnumOrNull<OfflineMappingEvalEvidenceType>()
        ?: return null
      evidenceTypes += type
    }
    return evidenceTypes
  }

  private fun validateTarget(
    taxonomy: OfflineMappingEvalTaxonomy,
    targetCode: String
  ): Set<OfflineMappingEvalInvalidReasonCode> {
    val target = taxonomy.findByCode(targetCode)
      ?: return setOf(OfflineMappingEvalInvalidReasonCode.TARGET_UNKNOWN)

    val reasons = linkedSetOf<OfflineMappingEvalInvalidReasonCode>()
    if (target.pilotRole == OfflineMappingEvalPilotRole.ROOT || target.pilotRole == OfflineMappingEvalPilotRole.SECTION) {
      reasons += OfflineMappingEvalInvalidReasonCode.SECTION_OR_ROOT_PROPOSED
    }
    if (target.pilotRole != OfflineMappingEvalPilotRole.CANDIDATE_LEAF) {
      reasons += OfflineMappingEvalInvalidReasonCode.CONTEXTUALLY_INADMISSIBLE_TARGET
    }
    if (target.granularity != "LEAF") {
      reasons += OfflineMappingEvalInvalidReasonCode.CONTEXTUALLY_INADMISSIBLE_TARGET
    }
    if (!target.selectable) {
      reasons += OfflineMappingEvalInvalidReasonCode.TARGET_NOT_SELECTABLE
    }
    if (target.deprecated) {
      reasons += OfflineMappingEvalInvalidReasonCode.TARGET_DEPRECATED
    }
    return reasons
  }

  private fun invalid(
    request: ValidatedOfflineMappingEvalRequest,
    reason: OfflineMappingEvalInvalidReasonCode
  ): OfflineMappingEvalInvalidModelOutput =
    invalid(request, setOf(reason))

  private fun invalid(
    request: ValidatedOfflineMappingEvalRequest,
    reasons: Set<OfflineMappingEvalInvalidReasonCode>
  ): OfflineMappingEvalInvalidModelOutput =
    OfflineMappingEvalInvalidModelOutput(
      accountCode = request.accountCode.value,
      invalidReasons = reasons
    )

  private fun accountLabelEvidence(request: ValidatedOfflineMappingEvalRequest): OfflineMappingEvalEvidence =
    OfflineMappingEvalEvidence(
      type = OfflineMappingEvalEvidenceType.ACCOUNT_LABEL,
      ref = "candidate-demo-input:${request.accountCode.value}:accountLabel",
      snippet = request.sanitizedAccountLabel
    )

  private fun targetTaxonomyEvidence(target: OfflineMappingEvalTarget): OfflineMappingEvalEvidence =
    OfflineMappingEvalEvidence(
      type = OfflineMappingEvalEvidenceType.TARGET_TAXONOMY,
      ref = "taxonomy-snapshot-candidate-v1:${target.code}",
      snippet = target.label
    )

  private data class ValidatedCommonFields(
    val evidenceTypes: List<OfflineMappingEvalEvidenceType>,
    val explanationCode: OfflineMappingEvalExplanationCode
  )

  companion object {
    const val PROVIDER_SCHEMA_VERSION = "mapping-suggestion-offline-042a2a3-v1"
    const val PROVIDER_PROMPT_VERSION = "offline-deterministic-fake-042a2a3-v1"
    const val PROVIDER_MODEL_VERSION = "local-deterministic-fake-042a2a3-v1"

    private const val MAX_EVIDENCE_ITEMS = 8
    private val COMMON_FIELDS = setOf(
      "outcome",
      "accountCode",
      "evidence",
      "explanationCode",
      "schemaVersion"
    )
    private val SUGGESTION_FIELDS = COMMON_FIELDS + "suggestedTargetCode"
    private val SUGGESTION_REQUIRED_FIELDS = SUGGESTION_FIELDS
    private val ABSTENTION_FIELDS = COMMON_FIELDS + "reasonCode"
    private val ABSTENTION_REQUIRED_FIELDS = ABSTENTION_FIELDS
    private val EVIDENCE_FIELDS = setOf("type")
    private val FORBIDDEN_CONTENT_PATTERNS = listOf(
      Regex("""(?i)\bsecret\b"""),
      Regex("""(?i)\btoken\b"""),
      Regex("""(?i)\bcredential\b"""),
      Regex("""(?i)\bcookie\b"""),
      Regex("""(?i)\bdsn\b"""),
      Regex("""(?i)\.env\b"""),
      Regex("""(?i)storage[_\s-]*object[_\s-]*key"""),
      Regex("""(?i)storage\s+key"""),
      Regex("""(?i)signed\s+url"""),
      Regex("""(?i)raw\s+csv"""),
      Regex("""(?i)https?://"""),
      Regex("""(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b"""),
      Regex("""(?i)\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]){10,29}[ -]?\d\b""")
    )

    internal fun containsForbiddenContent(value: String): Boolean =
      FORBIDDEN_CONTENT_PATTERNS.any { it.containsMatchIn(value) }
  }
}

private fun JsonNode.hasAllowedFields(allowed: Set<String>): Boolean =
  fieldNames().asSequence().all { it in allowed }

private fun JsonNode.hasRequiredFields(required: Set<String>): Boolean =
  required.all { has(it) }

private fun JsonNode.requiredText(fieldName: String): String? {
  val value = get(fieldName) ?: return null
  if (!value.isTextual) return null
  return value.asText().trim().takeUnless { it.isBlank() }
}

private fun JsonNode.containsNullRecursively(): Boolean =
  when {
    isNull -> true
    isObject -> properties().asSequence().any { it.value.containsNullRecursively() }
    isArray -> elements().asSequence().any { it.containsNullRecursively() }
    else -> false
  }

private inline fun <reified T : Enum<T>> String.toEnumOrNull(): T? =
  enumValues<T>().firstOrNull { it.name == this }

private fun String.containsForbiddenContent(): Boolean =
  OfflineMappingEvalEngine042a2.containsForbiddenContent(this)
