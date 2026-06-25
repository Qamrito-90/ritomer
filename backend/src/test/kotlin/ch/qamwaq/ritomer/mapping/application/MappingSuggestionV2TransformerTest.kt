package ch.qamwaq.ritomer.mapping.application

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.reflect.full.primaryConstructor

class MappingSuggestionV2TransformerTest {
  private val closingFolderId = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
  private val otherClosingFolderId = UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
  private val taxonomyHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  private val otherTaxonomyHash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

  @Test
  fun `suggestion is account scoped and normalized to v2 without confidence provider counters or provider text`() {
    val result = OfflineMappingEvalSuggestion(
      accountCode = "1000",
      suggestedTargetCode = "BS.ASSET.CASH_AND_EQUIVALENTS",
      evidence = listOf(
        OfflineMappingEvalEvidence(
          type = OfflineMappingEvalEvidenceType.ACCOUNT_LABEL,
          ref = "provider-ref-should-not-leak",
          snippet = "provider snippet should not leak"
        ),
        OfflineMappingEvalEvidence(
          type = OfflineMappingEvalEvidenceType.TARGET_TAXONOMY,
          ref = "provider-target-ref-should-not-leak",
          snippet = "provider target snippet should not leak"
        )
      ),
      explanationCode = OfflineMappingEvalExplanationCode.TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE,
      providerCallCount = 99
    )

    val suggestion = transform(result, localAccountLabel = "  Local   Bank   CHF  ")

    assertThat(suggestion).isInstanceOf(MappingSuggestionV2Suggestion::class.java)
    suggestion as MappingSuggestionV2Suggestion
    assertThat(suggestion.schemaVersion).isEqualTo("mapping-suggestion-v2")
    assertThat(suggestion.outcome).isEqualTo(MappingSuggestionV2Outcome.SUGGESTION)
    assertThat(suggestion.scope).isEqualTo(MappingSuggestionV2Scope.ACCOUNT)
    assertThat(suggestion.accountCode).isEqualTo("1000")
    assertThat(suggestion.accountLabel).isEqualTo("Local Bank CHF")
    assertThat(suggestion.targetCode).isEqualTo("BS.ASSET.CASH_AND_EQUIVALENTS")
    assertThat(suggestion.explanationCode)
      .isEqualTo(MappingSuggestionV2ExplanationCode.TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE)
    assertThat(suggestion.evidenceCodes)
      .containsExactly(MappingSuggestionV2EvidenceCode.ACCOUNT_LABEL, MappingSuggestionV2EvidenceCode.TARGET_TAXONOMY)
    assertThat(suggestion.requiresHumanReview).isTrue()
    assertThat(suggestion.suggestionFingerprint).matches("^[0-9a-f]{64}$")
    assertThat(publicFieldNames(suggestion))
      .doesNotContain(
        "confidence",
        "riskLevel",
        "rationale",
        "providerCallCount",
        "suggestedTargetCode",
        "ref",
        "snippet"
      )
  }

  @Test
  fun `suggestion evidence must contain account label and target taxonomy exactly once`() {
    assertThatThrownBy {
      transform(
        suggestionResultWithEvidence(
          listOf(
            OfflineMappingEvalEvidence(
              type = OfflineMappingEvalEvidenceType.ACCOUNT_LABEL,
              ref = "candidate-demo-input:1000:accountLabel",
              snippet = "Synthetic cash account"
            )
          )
        )
      )
    }
      .isInstanceOf(IllegalArgumentException::class.java)
      .hasMessageContaining("SUGGESTION evidenceCodes")

    assertThatThrownBy {
      transform(
        suggestionResultWithEvidence(
          listOf(
            OfflineMappingEvalEvidence(
              type = OfflineMappingEvalEvidenceType.ACCOUNT_LABEL,
              ref = "candidate-demo-input:1000:accountLabel",
              snippet = "Synthetic cash account"
            ),
            OfflineMappingEvalEvidence(
              type = OfflineMappingEvalEvidenceType.ACCOUNT_LABEL,
              ref = "candidate-demo-input:1000:accountLabel-duplicate",
              snippet = "Synthetic duplicate account label"
            )
          )
        )
      )
    }
      .isInstanceOf(IllegalArgumentException::class.java)
      .hasMessageContaining("evidenceCodes must be unique")
  }

  @Test
  fun `schema outcome scope and human review invariants are not constructor parameters`() {
    val suggestionConstructorParameters = MappingSuggestionV2Suggestion::class.primaryConstructor!!.parameters
      .map { it.name }

    assertThat(suggestionConstructorParameters)
      .doesNotContain("schemaVersion", "outcome", "scope", "requiresHumanReview")

    listOf(
      MappingSuggestionV2Abstention::class,
      MappingSuggestionV2PolicyBlock::class,
      MappingSuggestionV2AccountPreconditionBlock::class,
      MappingSuggestionV2RequestPreconditionBlock::class,
      MappingSuggestionV2InvalidModelOutput::class,
      MappingSuggestionV2LocalInputInvalid::class
    ).forEach { itemClass ->
      assertThat(itemClass.primaryConstructor!!.parameters.map { it.name })
        .doesNotContain("schemaVersion", "outcome", "scope")
    }

    assertThat(MappingSuggestionV2PolicyBlock::class.primaryConstructor!!.parameters.map { it.name })
      .doesNotContain("accountCode", "accountLabel")
    assertThat(MappingSuggestionV2RequestPreconditionBlock::class.primaryConstructor!!.parameters.map { it.name })
      .doesNotContain("accountCode", "accountLabel")

    val suggestion = MappingSuggestionV2Suggestion(
      accountCode = "1000",
      accountLabel = "Synthetic cash account",
      targetCode = "BS.ASSET.CASH_AND_EQUIVALENTS",
      explanationCode = MappingSuggestionV2ExplanationCode.TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE,
      evidenceCodes = listOf(
        MappingSuggestionV2EvidenceCode.ACCOUNT_LABEL,
        MappingSuggestionV2EvidenceCode.TARGET_TAXONOMY
      ),
      suggestionFingerprint = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    )

    assertThat(suggestion.schemaVersion).isEqualTo("mapping-suggestion-v2")
    assertThat(suggestion.outcome).isEqualTo(MappingSuggestionV2Outcome.SUGGESTION)
    assertThat(suggestion.scope).isEqualTo(MappingSuggestionV2Scope.ACCOUNT)
    assertThat(suggestion.requiresHumanReview).isTrue()
  }

  @Test
  fun `constructors enforce v2 scope account label fingerprint evidence and invalid reason constraints`() {
    assertThatThrownBy {
      MappingSuggestionV2Suggestion(
        accountCode = "1000a",
        accountLabel = "Synthetic cash account",
        targetCode = "BS.ASSET.CASH_AND_EQUIVALENTS",
        explanationCode = MappingSuggestionV2ExplanationCode.TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE,
        evidenceCodes = listOf(
          MappingSuggestionV2EvidenceCode.ACCOUNT_LABEL,
          MappingSuggestionV2EvidenceCode.TARGET_TAXONOMY
        ),
        suggestionFingerprint = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      )
    }
      .isInstanceOf(IllegalArgumentException::class.java)
      .hasMessageContaining("accountCode")

    assertThatThrownBy {
      MappingSuggestionV2AccountPreconditionBlock(
        accountCode = "1000",
        accountLabel = " ",
        preconditionBlockCode = MappingSuggestionV2PreconditionBlockCode.ACCOUNT_ALREADY_AFFECTED
      )
    }
      .isInstanceOf(IllegalArgumentException::class.java)
      .hasMessageContaining("accountLabel")

    assertThatThrownBy {
      MappingSuggestionV2AccountPreconditionBlock(
        accountCode = "1000",
        accountLabel = "Synthetic cash account",
        preconditionBlockCode = MappingSuggestionV2PreconditionBlockCode.STALE_IMPORT
      )
    }
      .isInstanceOf(IllegalArgumentException::class.java)
      .hasMessageContaining("ACCOUNT scope")

    assertThatThrownBy {
      MappingSuggestionV2RequestPreconditionBlock(
        preconditionBlockCode = MappingSuggestionV2PreconditionBlockCode.NOT_ELIGIBLE
      )
    }
      .isInstanceOf(IllegalArgumentException::class.java)
      .hasMessageContaining("REQUEST scope")

    assertThatThrownBy {
      MappingSuggestionV2Suggestion(
        accountCode = "1000",
        accountLabel = "Synthetic cash account",
        targetCode = "BS.ASSET.CASH_AND_EQUIVALENTS",
        explanationCode = MappingSuggestionV2ExplanationCode.TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE,
        evidenceCodes = listOf(
          MappingSuggestionV2EvidenceCode.ACCOUNT_LABEL,
          MappingSuggestionV2EvidenceCode.TARGET_TAXONOMY
        ),
        suggestionFingerprint = "abc"
      )
    }
      .isInstanceOf(IllegalArgumentException::class.java)
      .hasMessageContaining("suggestionFingerprint")

    assertThatThrownBy {
      MappingSuggestionV2InvalidModelOutput(
        accountCode = "1000",
        accountLabel = "Synthetic cash account",
        invalidReasonCodes = emptyList()
      )
    }
      .isInstanceOf(IllegalArgumentException::class.java)
      .hasMessageContaining("invalidReasonCodes must not be empty")

    assertThatThrownBy {
      MappingSuggestionV2InvalidModelOutput(
        accountCode = "1000",
        accountLabel = "Synthetic cash account",
        invalidReasonCodes = listOf(
          MappingSuggestionV2InvalidReasonCode.SCHEMA_INVALID,
          MappingSuggestionV2InvalidReasonCode.SCHEMA_INVALID
        )
      )
    }
      .isInstanceOf(IllegalArgumentException::class.java)
      .hasMessageContaining("invalidReasonCodes must be unique")
  }

  @Test
  fun `suggestion fingerprint uses taxonomy hash folder target and canonical evidence order`() {
    val first = transform(
      result = suggestionResult("Synthetic cash account"),
      localAccountLabel = "Local label A"
    ) as MappingSuggestionV2Suggestion
    val second = transform(
      result = suggestionResult("Different provider snippet"),
      localAccountLabel = "Local label B"
    ) as MappingSuggestionV2Suggestion
    val changedTarget = transform(
      result = suggestionResult("Synthetic cash account", targetCode = "BS.ASSET.TRADE_RECEIVABLES"),
      localAccountLabel = "Local label A"
    ) as MappingSuggestionV2Suggestion
    val changedFolder = transform(
      result = suggestionResult("Synthetic cash account"),
      closingFolderId = otherClosingFolderId,
      localAccountLabel = "Local label A"
    ) as MappingSuggestionV2Suggestion
    val changedTaxonomyHash = transform(
      result = suggestionResult("Synthetic cash account"),
      localAccountLabel = "Local label A",
      taxonomyHash = otherTaxonomyHash
    ) as MappingSuggestionV2Suggestion
    val reversedEvidenceOrder = transform(
      result = suggestionResultWithEvidence(
        evidence = listOf(
          OfflineMappingEvalEvidence(
            type = OfflineMappingEvalEvidenceType.TARGET_TAXONOMY,
            ref = "taxonomy-snapshot-candidate-v1:BS.ASSET.CASH_AND_EQUIVALENTS",
            snippet = "Target label"
          ),
          OfflineMappingEvalEvidence(
            type = OfflineMappingEvalEvidenceType.ACCOUNT_LABEL,
            ref = "candidate-demo-input:1000:accountLabel",
            snippet = "Synthetic cash account"
          )
        )
      ),
      localAccountLabel = "Local label A"
    ) as MappingSuggestionV2Suggestion

    assertThat(first.suggestionFingerprint).isEqualTo(second.suggestionFingerprint)
    assertThat(first.suggestionFingerprint).isEqualTo(reversedEvidenceOrder.suggestionFingerprint)
    assertThat(first.suggestionFingerprint).isNotEqualTo(changedTarget.suggestionFingerprint)
    assertThat(first.suggestionFingerprint).isNotEqualTo(changedFolder.suggestionFingerprint)
    assertThat(first.suggestionFingerprint).isNotEqualTo(changedTaxonomyHash.suggestionFingerprint)
  }

  @Test
  fun `abstention has account scope reason code and no decision fingerprint or target`() {
    val abstention = transform(
      result = OfflineMappingEvalAbstention(
        accountCode = "4000",
        reasonCode = OfflineMappingEvalAbstentionReasonCode.INSUFFICIENT_EVIDENCE,
        evidence = listOf(
          OfflineMappingEvalEvidence(
            type = OfflineMappingEvalEvidenceType.ACCOUNT_LABEL,
            ref = "candidate-demo-input:4000:accountLabel",
            snippet = "Synthetic operating expenses"
          )
        ),
        explanationCode = OfflineMappingEvalExplanationCode.EVIDENCE_NOT_SUFFICIENT_FOR_AFFECTATION
      ),
      localAccountLabel = "Synthetic operating expenses"
    )

    assertThat(abstention).isInstanceOf(MappingSuggestionV2Abstention::class.java)
    abstention as MappingSuggestionV2Abstention
    assertThat(abstention.scope).isEqualTo(MappingSuggestionV2Scope.ACCOUNT)
    assertThat(abstention.abstentionReasonCode)
      .isEqualTo(MappingSuggestionV2AbstentionReasonCode.INSUFFICIENT_EVIDENCE)
    assertThat(abstention.evidenceCodes).containsExactly(MappingSuggestionV2EvidenceCode.ACCOUNT_LABEL)
    assertThat(publicFieldNames(abstention))
      .doesNotContain("targetCode", "confidence", "suggestionFingerprint")
    assertThat(MappingSuggestionV2DecisionPolicy.allowedDecisionCodes(abstention)).isEmpty()
  }

  @Test
  fun `policy precondition and technical outcomes keep code compatible scopes`() {
    val policy = transform(
      result = OfflineMappingEvalPolicyBlock(
        accountCode = "1000",
        blockCode = OfflineMappingEvalPolicyBlockCode.CROSS_TENANT_REQUEST,
        providerCallCount = 7
      ),
      localAccountLabel = "Synthetic cash account"
    ) as MappingSuggestionV2PolicyBlock
    val accountPrecondition = transform(
      result = OfflineMappingEvalPreconditionBlock(
        accountCode = "2800",
        blockCode = OfflineMappingEvalPreconditionBlockCode.ACCOUNT_ALREADY_AFFECTED,
        providerCallCount = 5
      ),
      localAccountLabel = "Synthetic retained earnings"
    ) as MappingSuggestionV2AccountPreconditionBlock
    val requestPrecondition = transform(
      result = OfflineMappingEvalPreconditionBlock(
        accountCode = "1000",
        blockCode = OfflineMappingEvalPreconditionBlockCode.STALE_IMPORT
      ),
      localAccountLabel = "Synthetic cash account"
    ) as MappingSuggestionV2RequestPreconditionBlock
    val invalidOutput = transform(
      result = OfflineMappingEvalInvalidModelOutput(
        accountCode = "1000",
        invalidReasons = setOf(
          OfflineMappingEvalInvalidReasonCode.TARGET_UNKNOWN,
          OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID
        ),
        providerCallCount = 4
      ),
      localAccountLabel = "Synthetic cash account"
    ) as MappingSuggestionV2InvalidModelOutput
    val localInputInvalid = transform(
      result = OfflineMappingEvalInvalidInput(
        accountCode = "INVALID_INPUT",
        invalidReasons = setOf(OfflineMappingEvalInvalidInputReasonCode.ACCOUNT_CODE_INVALID)
      ),
      localAccountLabel = "Synthetic input"
    ) as MappingSuggestionV2LocalInputInvalid
    val providerFailure = transform(
      result = OfflineMappingEvalProviderFailure(
        accountCode = "1000",
        failureCode = OfflineMappingEvalProviderFailureCode.PROVIDER_EXCEPTION,
        providerCallCount = 2
      ),
      localAccountLabel = "Synthetic cash account"
    ) as MappingSuggestionV2BatchUnavailable

    assertThat(policy.scope).isEqualTo(MappingSuggestionV2Scope.REQUEST)
    assertThat(policy.policyBlockCode).isEqualTo(MappingSuggestionV2PolicyBlockCode.CROSS_TENANT_REQUEST)
    assertThat(publicFieldNames(policy)).doesNotContain("accountCode", "accountLabel", "evidenceCodes", "targetCode", "suggestionFingerprint")

    assertThat(accountPrecondition.scope).isEqualTo(MappingSuggestionV2Scope.ACCOUNT)
    assertThat(accountPrecondition.preconditionBlockCode)
      .isEqualTo(MappingSuggestionV2PreconditionBlockCode.ACCOUNT_ALREADY_AFFECTED)
    assertThat(requestPrecondition.scope).isEqualTo(MappingSuggestionV2Scope.REQUEST)
    assertThat(requestPrecondition.preconditionBlockCode).isEqualTo(MappingSuggestionV2PreconditionBlockCode.STALE_IMPORT)
    assertThat(publicFieldNames(requestPrecondition)).doesNotContain("accountCode", "accountLabel")

    assertThat(invalidOutput.scope).isEqualTo(MappingSuggestionV2Scope.ACCOUNT)
    assertThat(invalidOutput.degradationCode).isEqualTo(MappingSuggestionV2DegradationCode.INVALID_MODEL_OUTPUT)
    assertThat(invalidOutput.invalidReasonCodes)
      .containsExactly(MappingSuggestionV2InvalidReasonCode.SCHEMA_INVALID, MappingSuggestionV2InvalidReasonCode.TARGET_UNKNOWN)
    assertThat(localInputInvalid.scope).isEqualTo(MappingSuggestionV2Scope.ACCOUNT)
    assertThat(providerFailure.scope).isEqualTo(MappingSuggestionV2Scope.BATCH)
    assertThat(providerFailure.degradationCode).isEqualTo(MappingSuggestionV2DegradationCode.UNAVAILABLE)
    assertThat(publicFieldNames(providerFailure)).doesNotContain("accountCode", "accountLabel")

    assertThat(listOf(policy, accountPrecondition, requestPrecondition, invalidOutput, localInputInvalid, providerFailure))
      .allSatisfy { item ->
        assertThat(publicFieldNames(item)).doesNotContain("providerCallCount", "failureCode", "confidence")
        assertThat(MappingSuggestionV2DecisionPolicy.allowedDecisionCodes(item)).isEmpty()
      }
  }

  @Test
  fun `only suggestions expose human decision codes`() {
    val suggestion = transform(suggestionResult("Synthetic cash account"))
    val abstention = transform(
      result = OfflineMappingEvalAbstention(
        accountCode = "4000",
        reasonCode = OfflineMappingEvalAbstentionReasonCode.INSUFFICIENT_EVIDENCE,
        evidence = listOf(
          OfflineMappingEvalEvidence(
            type = OfflineMappingEvalEvidenceType.ACCOUNT_LABEL,
            ref = "candidate-demo-input:4000:accountLabel",
            snippet = "Synthetic operating expenses"
          )
        ),
        explanationCode = OfflineMappingEvalExplanationCode.EVIDENCE_NOT_SUFFICIENT_FOR_AFFECTATION
      ),
      localAccountLabel = "Synthetic operating expenses"
    )

    assertThat(MappingSuggestionV2DecisionPolicy.allowedDecisionCodes(suggestion))
      .containsExactly(
        MappingSuggestionV2DecisionCode.ACCEPT,
        MappingSuggestionV2DecisionCode.CORRECT,
        MappingSuggestionV2DecisionCode.REJECT
      )
    assertThat(MappingSuggestionV2DecisionPolicy.allowedDecisionCodes(abstention)).isEmpty()
  }

  @Test
  fun `shared v2 contract corpus parses valid fixtures and rejects invalid fixtures`() {
    val corpus = loadContractCorpus()

    corpus.requiredArray("valid").forEach { fixture ->
      val id = fixture.requiredText("id")
      assertThat(parseCorpusPayload(fixture.requiredObject("payload")))
        .describedAs(id)
        .isNotNull()
    }

    corpus.requiredArray("invalid").forEach { fixture ->
      val id = fixture.requiredText("id")
      assertThatThrownBy { parseCorpusPayload(fixture.requiredObject("payload")) }
        .describedAs(id)
        .isInstanceOf(RuntimeException::class.java)
    }
  }

  @Test
  fun `transformer source has no spring endpoint db or provider runtime wiring`() {
    val source = java.nio.file.Files.readString(
      OfflineMappingEvalFixtures042a2.repoRoot.resolve(
        "backend/src/main/kotlin/ch/qamwaq/ritomer/mapping/application/MappingSuggestionV2Transformer.kt"
      )
    )
    val forbiddenSourceMarkers = listOf(
      "@Component",
      "@Service",
      "@Controller",
      "@RestController",
      "@Configuration",
      "@Bean",
      "org.springframework",
      "@GetMapping",
      "@PostMapping",
      "@RequestMapping",
      "HttpClient",
      "WebClient",
      "RestClient",
      "Repository",
      "DataSource",
      "JdbcTemplate",
      "MappingSuggestionsController",
      "MappingSuggestionGenerationAccess",
      "OpenAI",
      "Anthropic",
      "ChatClient",
      "enumValueOf"
    )

    assertThat(forbiddenSourceMarkers.filter { marker -> marker in source }).isEmpty()
  }

  private fun transform(
    result: OfflineMappingEvalResult,
    closingFolderId: UUID = this.closingFolderId,
    localAccountLabel: String = "Synthetic cash account",
    latestImportVersion: Int = 3,
    taxonomyVersion: Int = 2,
    taxonomyHash: String = this.taxonomyHash
  ): MappingSuggestionV2Item =
    MappingSuggestionV2Transformer.fromOfflineResult(
      result = result,
      closingFolderId = closingFolderId,
      localAccountLabel = localAccountLabel,
      latestImportVersion = latestImportVersion,
      taxonomyVersion = taxonomyVersion,
      taxonomyHash = taxonomyHash
    )

  private fun suggestionResult(
    accountLabelSnippet: String,
    targetCode: String = "BS.ASSET.CASH_AND_EQUIVALENTS"
  ): OfflineMappingEvalSuggestion =
    suggestionResultWithEvidence(
      evidence = listOf(
        OfflineMappingEvalEvidence(
          type = OfflineMappingEvalEvidenceType.ACCOUNT_LABEL,
          ref = "candidate-demo-input:1000:accountLabel",
          snippet = accountLabelSnippet
        ),
        OfflineMappingEvalEvidence(
          type = OfflineMappingEvalEvidenceType.TARGET_TAXONOMY,
          ref = "taxonomy-snapshot-candidate-v1:$targetCode",
          snippet = "Target label"
        )
      ),
      targetCode = targetCode
    )

  private fun suggestionResultWithEvidence(
    evidence: List<OfflineMappingEvalEvidence>,
    targetCode: String = "BS.ASSET.CASH_AND_EQUIVALENTS"
  ): OfflineMappingEvalSuggestion =
    OfflineMappingEvalSuggestion(
      accountCode = "1000",
      suggestedTargetCode = targetCode,
      evidence = evidence,
      explanationCode = OfflineMappingEvalExplanationCode.TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE
    )

  private fun loadContractCorpus(): JsonNode =
    jacksonObjectMapper().readTree(
      OfflineMappingEvalFixtures042a2.repoRoot
        .resolve("contracts")
        .resolve("ai")
        .resolve("mapping-suggestion-v2.corpus.json")
        .toFile()
    )

  private fun parseCorpusPayload(payload: JsonNode): MappingSuggestionV2Item {
    require(payload.isObject) { "payload must be an object." }
    require(!payload.containsNullRecursively()) { "payload must not contain null." }
    require(payload.requiredText("schemaVersion") == MAPPING_SUGGESTION_V2_SCHEMA_VERSION)

    val outcome = enumValueOf<MappingSuggestionV2Outcome>(payload.requiredText("outcome"))
    val scope = enumValueOf<MappingSuggestionV2Scope>(payload.requiredText("scope"))

    return when (outcome) {
      MappingSuggestionV2Outcome.SUGGESTION -> {
        require(scope == MappingSuggestionV2Scope.ACCOUNT)
        payload.requireExactFields(
          "schemaVersion",
          "outcome",
          "scope",
          "accountCode",
          "accountLabel",
          "targetCode",
          "explanationCode",
          "evidenceCodes",
          "requiresHumanReview",
          "suggestionFingerprint"
        )
        require(payload.requiredBoolean("requiresHumanReview"))
        MappingSuggestionV2Suggestion(
          accountCode = payload.requiredText("accountCode"),
          accountLabel = payload.requiredText("accountLabel"),
          targetCode = payload.requiredText("targetCode"),
          explanationCode = enumValueOf(payload.requiredText("explanationCode")),
          evidenceCodes = payload.requiredTextArray("evidenceCodes").map { enumValueOf(it) },
          suggestionFingerprint = payload.requiredText("suggestionFingerprint")
        )
      }
      MappingSuggestionV2Outcome.ABSTENTION -> {
        require(scope == MappingSuggestionV2Scope.ACCOUNT)
        payload.requireExactFields(
          "schemaVersion",
          "outcome",
          "scope",
          "accountCode",
          "accountLabel",
          "abstentionReasonCode",
          "evidenceCodes"
        )
        MappingSuggestionV2Abstention(
          accountCode = payload.requiredText("accountCode"),
          accountLabel = payload.requiredText("accountLabel"),
          abstentionReasonCode = enumValueOf(payload.requiredText("abstentionReasonCode")),
          evidenceCodes = payload.requiredTextArray("evidenceCodes").map { enumValueOf(it) }
        )
      }
      MappingSuggestionV2Outcome.POLICY_BLOCK -> {
        require(scope == MappingSuggestionV2Scope.REQUEST)
        payload.requireExactFields("schemaVersion", "outcome", "scope", "policyBlockCode")
        MappingSuggestionV2PolicyBlock(
          policyBlockCode = enumValueOf(payload.requiredText("policyBlockCode"))
        )
      }
      MappingSuggestionV2Outcome.PRECONDITION_BLOCK -> {
        when (scope) {
          MappingSuggestionV2Scope.ACCOUNT -> {
            payload.requireExactFields(
              "schemaVersion",
              "outcome",
              "scope",
              "accountCode",
              "accountLabel",
              "preconditionBlockCode"
            )
            MappingSuggestionV2AccountPreconditionBlock(
              accountCode = payload.requiredText("accountCode"),
              accountLabel = payload.requiredText("accountLabel"),
              preconditionBlockCode = enumValueOf(payload.requiredText("preconditionBlockCode"))
            )
          }
          MappingSuggestionV2Scope.REQUEST -> {
            payload.requireExactFields("schemaVersion", "outcome", "scope", "preconditionBlockCode")
            MappingSuggestionV2RequestPreconditionBlock(
              preconditionBlockCode = enumValueOf(payload.requiredText("preconditionBlockCode"))
            )
          }
          MappingSuggestionV2Scope.BATCH -> error("PRECONDITION_BLOCK cannot use BATCH scope.")
        }
      }
      MappingSuggestionV2Outcome.TECHNICAL_DEGRADATION -> {
        val degradationCode = enumValueOf<MappingSuggestionV2DegradationCode>(payload.requiredText("degradationCode"))
        require(degradationCode.scope == scope)
        when (degradationCode) {
          MappingSuggestionV2DegradationCode.INVALID_MODEL_OUTPUT -> {
            payload.requireExactFields(
              "schemaVersion",
              "outcome",
              "scope",
              "accountCode",
              "accountLabel",
              "degradationCode",
              "invalidReasonCodes"
            )
            MappingSuggestionV2InvalidModelOutput(
              accountCode = payload.requiredText("accountCode"),
              accountLabel = payload.requiredText("accountLabel"),
              invalidReasonCodes = payload.requiredTextArray("invalidReasonCodes").map { enumValueOf(it) }
            )
          }
          MappingSuggestionV2DegradationCode.LOCAL_INPUT_INVALID -> {
            payload.requireExactFields(
              "schemaVersion",
              "outcome",
              "scope",
              "accountCode",
              "accountLabel",
              "degradationCode"
            )
            MappingSuggestionV2LocalInputInvalid(
              accountCode = payload.requiredText("accountCode"),
              accountLabel = payload.requiredText("accountLabel")
            )
          }
          MappingSuggestionV2DegradationCode.TIMEOUT -> {
            payload.requireExactFields("schemaVersion", "outcome", "scope", "degradationCode")
            MappingSuggestionV2RequestTimeout
          }
          MappingSuggestionV2DegradationCode.UNAVAILABLE -> {
            payload.requireExactFields("schemaVersion", "outcome", "scope", "degradationCode")
            MappingSuggestionV2BatchUnavailable
          }
        }
      }
    }
  }

  private fun publicFieldNames(value: Any): List<String> =
    value::class.java.declaredFields
      .map { it.name }
      .filterNot { it.startsWith("$") }
      .filterNot { it == "INSTANCE" }
}

private fun JsonNode.requiredObject(fieldName: String): JsonNode {
  val value = get(fieldName) ?: error("Missing object field '$fieldName'.")
  require(value.isObject) { "Field '$fieldName' must be an object." }
  return value
}

private fun JsonNode.requiredArray(fieldName: String): List<JsonNode> {
  val value = get(fieldName) ?: error("Missing array field '$fieldName'.")
  require(value.isArray) { "Field '$fieldName' must be an array." }
  return value.toList()
}

private fun JsonNode.requiredText(fieldName: String): String {
  val value = get(fieldName) ?: error("Missing text field '$fieldName'.")
  require(value.isTextual) { "Field '$fieldName' must be textual." }
  return value.asText()
}

private fun JsonNode.requiredTextArray(fieldName: String): List<String> =
  requiredArray(fieldName).map {
    require(it.isTextual) { "Array field '$fieldName' must contain only text values." }
    it.asText()
  }

private fun JsonNode.requiredBoolean(fieldName: String): Boolean {
  val value = get(fieldName) ?: error("Missing boolean field '$fieldName'.")
  require(value.isBoolean) { "Field '$fieldName' must be boolean." }
  return value.asBoolean()
}

private fun JsonNode.requireExactFields(vararg expectedFields: String) {
  val actual = fieldNames().asSequence().toSet()
  val expected = expectedFields.toSet()
  require(actual == expected) { "Expected fields $expected but got $actual." }
}

private fun JsonNode.containsNullRecursively(): Boolean =
  when {
    isNull -> true
    isObject -> properties().asSequence().any { it.value.containsNullRecursively() }
    isArray -> elements().asSequence().any { it.containsNullRecursively() }
    else -> false
  }
