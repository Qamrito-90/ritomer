package ch.qamwaq.ritomer.ai.application

import ch.qamwaq.ritomer.ai.access.AiMappingSuggestion
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionAccount
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionBalanceSignal
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionEvidence
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionEvidenceType
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionGenerationRequest
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionGenerationResult
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionRiskLevel
import ch.qamwaq.ritomer.ai.access.MappingSuggestionGenerationAccess
import org.springframework.stereotype.Service

@Service
class DeterministicMappingSuggestionAdapterStub : MappingSuggestionGenerationAccess {
  override fun generate(request: AiMappingSuggestionGenerationRequest): AiMappingSuggestionGenerationResult {
    val suggestion = request.accounts
      .sortedBy { it.accountCode }
      .firstNotNullOfOrNull { account ->
        val targetCode = suggestedTargetCodeFor(account) ?: return@firstNotNullOfOrNull null
        val target = request.targets
          .filter { it.selectable && !it.deprecated }
          .firstOrNull { it.code == targetCode }
          ?: return@firstNotNullOfOrNull null

        AiMappingSuggestion(
          accountCode = account.accountCode,
          suggestedTargetCode = target.code,
          confidence = 0.82,
          riskLevel = AiMappingSuggestionRiskLevel.MEDIUM,
          rationale = "Account label and target taxonomy are consistent.",
          evidence = listOf(
            AiMappingSuggestionEvidence(
              type = AiMappingSuggestionEvidenceType.ACCOUNT_LABEL,
              ref = "balance_import_line:${account.accountCode}",
              snippet = account.sanitizedAccountLabel.take(MAX_EVIDENCE_SNIPPET_LENGTH)
            ),
            AiMappingSuggestionEvidence(
              type = AiMappingSuggestionEvidenceType.TARGET_TAXONOMY,
              ref = "manual-mapping-targets-v2:${target.code}",
              snippet = target.label.take(MAX_EVIDENCE_SNIPPET_LENGTH)
            )
          ),
          requiresHumanReview = true,
          schemaVersion = SCHEMA_VERSION,
          promptVersion = NOT_APPLICABLE_FOR_STUB,
          modelVersion = NOT_APPLICABLE_FOR_STUB
        )
      }

    return AiMappingSuggestionGenerationResult(suggestions = listOfNotNull(suggestion))
  }

  private fun suggestedTargetCodeFor(account: AiMappingSuggestionAccount): String? {
    val normalized = account.sanitizedAccountLabel.lowercase()
    return when {
      listOf("bank", "cash", "banque", "caisse").any { it in normalized } ->
        "BS.ASSET.CASH_AND_EQUIVALENTS"
      listOf("receivable", "debtor", "client").any { it in normalized } ->
        "BS.ASSET.TRADE_RECEIVABLES"
      listOf("payable", "creditor", "fournisseur").any { it in normalized } ->
        "BS.LIABILITY.TRADE_PAYABLES"
      listOf("revenue", "sales", "vente").any { it in normalized } ->
        "PL.REVENUE.OPERATING_REVENUE"
      listOf("expense", "charges", "frais").any { it in normalized } ->
        "PL.EXPENSE.OTHER_OPERATING_EXPENSES"
      account.balanceSignal == AiMappingSuggestionBalanceSignal.DEBIT_ONLY ||
        account.balanceSignal == AiMappingSuggestionBalanceSignal.DEBIT_DOMINANT ->
        "BS.ASSET.CASH_AND_EQUIVALENTS"
      account.balanceSignal == AiMappingSuggestionBalanceSignal.CREDIT_ONLY ||
        account.balanceSignal == AiMappingSuggestionBalanceSignal.CREDIT_DOMINANT ->
        "PL.REVENUE.OPERATING_REVENUE"
      else -> null
    }
  }

  companion object {
    const val SCHEMA_VERSION = "mapping-suggestion-v1"
    const val NOT_APPLICABLE_FOR_STUB = "not_applicable_for_stub"
    private const val MAX_EVIDENCE_SNIPPET_LENGTH = 300
  }
}
