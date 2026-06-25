package ch.qamwaq.ritomer.mapping.infrastructure.local

import ch.qamwaq.ritomer.mapping.application.MAPPING_SUGGESTIONS_V2_OFFLINE_ENABLED_PROPERTY
import ch.qamwaq.ritomer.mapping.application.OfflineMappingEvalAbstentionReasonCode
import ch.qamwaq.ritomer.mapping.application.OfflineMappingEvalEngine042a2
import ch.qamwaq.ritomer.mapping.application.OfflineMappingEvalExplanationCode
import ch.qamwaq.ritomer.mapping.application.OfflineMappingEvalProvider
import ch.qamwaq.ritomer.mapping.application.OfflineMappingEvalProviderAccount
import ch.qamwaq.ritomer.mapping.application.OfflineMappingEvalProviderRequest
import ch.qamwaq.ritomer.mapping.application.OfflineMappingEvalProviderResponse
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Component

@Component
@Profile("local")
@ConditionalOnProperty(
  name = [MAPPING_SUGGESTIONS_V2_OFFLINE_ENABLED_PROPERTY],
  havingValue = "true"
)
class LocalDemoOfflineMappingEvalProvider : OfflineMappingEvalProvider {
  override fun generate(request: OfflineMappingEvalProviderRequest): OfflineMappingEvalProviderResponse {
    val targetCode = targetCodeFor(request.account)
    val target = targetCode?.let { code -> request.candidateTargets.firstOrNull { it.code == code } }

    val rawJson = if (target == null) {
      abstentionJson(
        accountCode = request.account.accountCode,
        reasonCode = OfflineMappingEvalAbstentionReasonCode.INSUFFICIENT_EVIDENCE.name
      )
    } else {
      suggestionJson(
        accountCode = request.account.accountCode,
        targetCode = target.code
      )
    }

    return OfflineMappingEvalProviderResponse(
      rawJson = rawJson,
      promptVersion = OfflineMappingEvalEngine042a2.PROVIDER_PROMPT_VERSION,
      modelVersion = OfflineMappingEvalEngine042a2.PROVIDER_MODEL_VERSION
    )
  }

  private fun targetCodeFor(account: OfflineMappingEvalProviderAccount): String? {
    val label = account.sanitizedAccountLabel.lowercase()
    return when {
      label == "synthetic operating expenses" -> null
      "other operating expenses" in label -> "PL.EXPENSE.OTHER_OPERATING_EXPENSES"
      "cash" in label || "bank" in label -> "BS.ASSET.CASH_AND_EQUIVALENTS"
      "receivable" in label -> "BS.ASSET.TRADE_RECEIVABLES"
      "payable" in label -> "BS.LIABILITY.TRADE_PAYABLES"
      "retained earnings" in label -> "BS.EQUITY.RETAINED_EARNINGS"
      "operating revenue" in label || "sales" in label -> "PL.REVENUE.OPERATING_REVENUE"
      else -> null
    }
  }

  private fun suggestionJson(accountCode: String, targetCode: String): String =
    """
    {
      "outcome": "SUGGESTION",
      "accountCode": "$accountCode",
      "suggestedTargetCode": "$targetCode",
      "evidence": [
        { "type": "ACCOUNT_LABEL" },
        { "type": "TARGET_TAXONOMY" }
      ],
      "explanationCode": "${OfflineMappingEvalExplanationCode.TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE.name}",
      "schemaVersion": "${OfflineMappingEvalEngine042a2.PROVIDER_SCHEMA_VERSION}"
    }
    """.trimIndent()

  private fun abstentionJson(accountCode: String, reasonCode: String): String =
    """
    {
      "outcome": "ABSTENTION",
      "accountCode": "$accountCode",
      "reasonCode": "$reasonCode",
      "evidence": [
        { "type": "ACCOUNT_LABEL" }
      ],
      "explanationCode": "${OfflineMappingEvalExplanationCode.EVIDENCE_NOT_SUFFICIENT_FOR_AFFECTATION.name}",
      "schemaVersion": "${OfflineMappingEvalEngine042a2.PROVIDER_SCHEMA_VERSION}"
    }
    """.trimIndent()
}
