package ch.qamwaq.ritomer.mapping.application

import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class MappingSuggestionCanonicalizationTest {
  @Test
  fun `suggestion fingerprint is stable and excludes labels rationale snippets and tenant data`() {
    val first = suggestion(
      accountLabel = "Bank CHF tenant alpha",
      rationale = "Detailed rationale one",
      snippets = listOf("Bank CHF", "Cash target")
    )
    val second = suggestion(
      accountLabel = "Sensitive client label",
      rationale = "Different rationale",
      snippets = listOf("Sensitive snippet", "Different target snippet")
    )

    assertThat(MappingSuggestionFingerprints.calculate(3, 2, first))
      .isEqualTo(MappingSuggestionFingerprints.calculate(3, 2, second))
  }

  @Test
  fun `decision payload canonical string is stable LF-delimited and hashes normalized values`() {
    val payload = NormalizedMappingSuggestionDecisionPayload(
      decision = MappingSuggestionHumanDecision.CORRECT,
      closingFolderId = UUID.fromString("AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA"),
      accountCode = "1000",
      latestImportVersion = 4,
      targetCode = "PL.REVENUE.OPERATING_REVENUE",
      reviewComment = MappingSuggestionDecisionPayloads.normalizeReviewComment("  Human \n correction\tkept  "),
      suggestionFingerprint = "0".repeat(64)
    )

    val canonical = MappingSuggestionDecisionPayloads.canonicalString(payload)

    assertThat(canonical).isEqualTo(
      """
      mapping-suggestion-decision-payload-v1
      decision=CORRECT
      closingFolderId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
      accountCode=1000
      latestImportVersion=4
      targetCode=PL.REVENUE.OPERATING_REVENUE
      reviewComment=Human correction kept
      suggestionFingerprint=${"0".repeat(64)}
      """.trimIndent()
    )
    assertThat(canonical).doesNotEndWith("\n")
    assertThat(MappingSuggestionDecisionPayloads.hash(payload)).matches("^[0-9a-f]{64}$")
  }

  private fun suggestion(
    accountLabel: String,
    rationale: String,
    snippets: List<String>
  ): MappingSuggestion =
    MappingSuggestion(
      accountCode = "1000",
      accountLabel = accountLabel,
      suggestedTargetCode = "BS.ASSET.CASH_AND_EQUIVALENTS",
      confidence = 0.82,
      riskLevel = MappingSuggestionRiskLevel.MEDIUM,
      rationale = rationale,
      evidence = listOf(
        MappingSuggestionEvidence(
          type = MappingSuggestionEvidenceType.TARGET_TAXONOMY,
          ref = "manual-mapping-targets-v2:BS.ASSET.CASH_AND_EQUIVALENTS",
          snippet = snippets[1]
        ),
        MappingSuggestionEvidence(
          type = MappingSuggestionEvidenceType.ACCOUNT_LABEL,
          ref = "balance_import_line:1000",
          snippet = snippets[0]
        )
      ),
      requiresHumanReview = true,
      schemaVersion = "mapping-suggestion-v1",
      promptVersion = "not_applicable_for_stub",
      modelVersion = "not_applicable_for_stub"
    )
}
