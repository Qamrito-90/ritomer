package ch.qamwaq.ritomer.mapping.application

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class OfflineMappingEvalEngineTest {
  @Test
  fun `policy and precondition blocks happen before provider invocation`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val fakeProvider = DeterministicOfflineMappingEvalFakeProvider042a2()
    val engine = OfflineMappingEvalEngine042a2(fakeProvider)
    val blockedCases = OfflineMappingEvalFixtures042a2.loadPolicyCases(taxonomy)

    val results = blockedCases.map { engine.evaluate(it.request) }

    assertThat(results).hasSize(5)
    assertThat(results).allSatisfy {
      assertThat(it).isInstanceOfAny(
        OfflineMappingEvalPolicyBlock::class.java,
        OfflineMappingEvalPreconditionBlock::class.java
      )
      assertThat(it.providerCallCount).isZero()
      assertThat(it.businessAbstentionCounted).isFalse()
    }
    assertThat(fakeProvider.callCount).isZero()
  }

  @Test
  fun `provider receives only minimized account payload and candidate targets`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val fakeProvider = DeterministicOfflineMappingEvalFakeProvider042a2()
    val engine = OfflineMappingEvalEngine042a2(fakeProvider)

    engine.evaluate(
      OfflineMappingEvalRequest(
        accountCode = "1000",
        accountLabel = "Synthetic cash account jane.doe@example.com +41 79 123 45 67 ref 987654321012",
        balanceSignal = "DEBIT_DOMINANT",
        taxonomy = taxonomy
      )
    )

    val request = fakeProvider.requests.single()
    assertThat(request.account.accountCode).isEqualTo("1000")
    assertThat(request.account.sanitizedAccountLabel).isEqualTo("Synthetic cash account")
    assertThat(request.account.balanceSignal).isEqualTo(OfflineMappingEvalBalanceSignal.DEBIT_DOMINANT)
    assertThat(request::class.java.declaredFields.map { it.name })
      .containsExactlyInAnyOrder("account", "candidateTargets")
    assertThat(request.account::class.java.declaredFields.map { it.name })
      .containsExactlyInAnyOrder("accountCode", "sanitizedAccountLabel", "balanceSignal")
    assertThat(request.toString())
      .doesNotContain(
        "jane.doe@example.com",
        "+41 79 123 45 67",
        "987654321012",
        "tenant",
        "client",
        "actor",
        "expected",
        "caseId",
        "category"
      )
    assertThat(request.candidateTargets).hasSize(6)
    assertThat(request.candidateTargets).allSatisfy {
      assertThat(it.selectable).isTrue()
      assertThat(it.deprecated).isFalse()
    }
  }

  @Test
  fun `unknown bounded input states are invalid input before provider invocation`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val fakeProvider = DeterministicOfflineMappingEvalFakeProvider042a2()
    val engine = OfflineMappingEvalEngine042a2(fakeProvider)
    val baseRequest = request(taxonomy)
    val cases = listOf(
      baseRequest.copy(datasetPolicy = "UNKNOWN_POLICY") to OfflineMappingEvalInvalidInputReasonCode.DATASET_POLICY_UNKNOWN,
      baseRequest.copy(provenanceStatus = "UNKNOWN_PROVENANCE") to OfflineMappingEvalInvalidInputReasonCode.PROVENANCE_STATUS_UNKNOWN,
      baseRequest.copy(crossTenantSignal = "UNKNOWN_CROSS_TENANT_SIGNAL") to OfflineMappingEvalInvalidInputReasonCode.CROSS_TENANT_SIGNAL_UNKNOWN,
      baseRequest.copy(balanceSignal = "UNKNOWN_BALANCE_SIGNAL") to OfflineMappingEvalInvalidInputReasonCode.BALANCE_SIGNAL_UNKNOWN
    )

    cases.forEach { (invalidRequest, expectedReason) ->
      val result = engine.evaluate(invalidRequest)

      assertThat(result).isInstanceOf(OfflineMappingEvalInvalidInput::class.java)
      assertThat((result as OfflineMappingEvalInvalidInput).invalidReasons).contains(expectedReason)
      assertThat(result.providerCallCount).isZero()
      assertThat(result.businessAbstentionCounted).isFalse()
    }
    assertThat(fakeProvider.callCount).isZero()
  }

  @Test
  fun `invalid account code and empty sanitized label are invalid input before provider invocation`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val fakeProvider = DeterministicOfflineMappingEvalFakeProvider042a2()
    val engine = OfflineMappingEvalEngine042a2(fakeProvider)
    val baseRequest = request(taxonomy)
    val cases = listOf(
      baseRequest.copy(accountCode = "") to OfflineMappingEvalInvalidInputReasonCode.ACCOUNT_CODE_INVALID,
      baseRequest.copy(accountCode = "123456789012345678901234567890123") to OfflineMappingEvalInvalidInputReasonCode.ACCOUNT_CODE_INVALID,
      baseRequest.copy(accountCode = "1000!") to OfflineMappingEvalInvalidInputReasonCode.ACCOUNT_CODE_INVALID,
      baseRequest.copy(accountLabel = "jane.doe@example.com") to OfflineMappingEvalInvalidInputReasonCode.EMPTY_SANITIZED_ACCOUNT_LABEL
    )

    cases.forEach { (invalidRequest, expectedReason) ->
      val result = engine.evaluate(invalidRequest)

      assertThat(result).isInstanceOf(OfflineMappingEvalInvalidInput::class.java)
      assertThat((result as OfflineMappingEvalInvalidInput).invalidReasons).contains(expectedReason)
      assertThat(result.providerCallCount).isZero()
    }
    assertThat(fakeProvider.callCount).isZero()
  }

  @Test
  fun `malformed unknown null and invalid enum provider outputs are rejected fail closed`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val request = request(taxonomy)
    val invalidOutputs = listOf(
      "not-json",
      withAdditionalRootField(
        providerSuggestionJson("1000", "BS.ASSET.CASH_AND_EQUIVALENTS"),
        """"unexpected": "field""""
      ),
      withAdditionalRootField(
        providerSuggestionJson("1000", "BS.ASSET.CASH_AND_EQUIVALENTS"),
        """"unexpected": null"""
      ),
      providerAbstentionJson("1000", "NOT_A_REASON")
    )

    val results = invalidOutputs.map { output ->
      OfflineMappingEvalEngine042a2(OfflineMappingEvalProvider { providerResponse(output) }).evaluate(request)
    }

    assertThat(results).allSatisfy {
      assertThat(it).isInstanceOf(OfflineMappingEvalInvalidModelOutput::class.java)
      assertThat((it as OfflineMappingEvalInvalidModelOutput).invalidReasons)
        .containsAnyOf(
          OfflineMappingEvalInvalidReasonCode.MALFORMED_OUTPUT,
          OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID
        )
      assertThat(it.businessAbstentionCounted).isFalse()
    }
  }

  @Test
  fun `raw provider json prompt and model metadata are rejected as unknown properties`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val request = request(taxonomy)
    val validOutput = providerSuggestionJson(
      accountCode = "1000",
      suggestedTargetCode = "BS.ASSET.CASH_AND_EQUIVALENTS"
    )
    val outputs = listOf(
      withAdditionalRootField(
        validOutput,
        """"promptVersion": "${OfflineMappingEvalEngine042a2.PROVIDER_PROMPT_VERSION}""""
      ),
      withAdditionalRootField(
        validOutput,
        """"modelVersion": "${OfflineMappingEvalEngine042a2.PROVIDER_MODEL_VERSION}""""
      )
    )

    val results = outputs.map { output ->
      OfflineMappingEvalEngine042a2(OfflineMappingEvalProvider { providerResponse(output) }).evaluate(request)
    }

    assertThat(results).allSatisfy {
      assertThat(it).isInstanceOf(OfflineMappingEvalInvalidModelOutput::class.java)
      assertThat((it as OfflineMappingEvalInvalidModelOutput).invalidReasons)
        .contains(OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
      assertThat(it.businessAbstentionCounted).isFalse()
    }
  }

  @Test
  fun `raw provider json schema version mismatch is invalid model output`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val output = providerSuggestionJson(
      accountCode = "1000",
      suggestedTargetCode = "BS.ASSET.CASH_AND_EQUIVALENTS"
    ).replace(
      OfflineMappingEvalEngine042a2.PROVIDER_SCHEMA_VERSION,
      "unexpected-schema-version"
    )

    val result = OfflineMappingEvalEngine042a2(OfflineMappingEvalProvider { providerResponse(output) })
      .evaluate(request(taxonomy))

    assertThat(result).isInstanceOf(OfflineMappingEvalInvalidModelOutput::class.java)
    assertThat((result as OfflineMappingEvalInvalidModelOutput).invalidReasons)
      .contains(OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    assertThat(result.businessAbstentionCounted).isFalse()
  }

  @Test
  fun `empty and whitespace provider outputs are malformed invalid model output`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val request = request(taxonomy)

    val results = listOf("", "   ").map { output ->
      OfflineMappingEvalEngine042a2(OfflineMappingEvalProvider { providerResponse(output) }).evaluate(request)
    }

    assertThat(results).allSatisfy {
      assertThat(it).isInstanceOf(OfflineMappingEvalInvalidModelOutput::class.java)
      assertThat((it as OfflineMappingEvalInvalidModelOutput).invalidReasons)
        .contains(OfflineMappingEvalInvalidReasonCode.MALFORMED_OUTPUT)
    }
  }

  @Test
  fun `unexpected local prompt or model versions are invalid model output`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val request = request(taxonomy)
    val output = providerSuggestionJson(
      accountCode = "1000",
      suggestedTargetCode = "BS.ASSET.CASH_AND_EQUIVALENTS"
    )
    val responses = listOf(
      providerResponse(output, promptVersion = "unexpected-prompt-version"),
      providerResponse(output, modelVersion = "unexpected-model-version")
    )

    val results = responses.map { response ->
      OfflineMappingEvalEngine042a2(OfflineMappingEvalProvider { response }).evaluate(request)
    }

    assertThat(results).allSatisfy {
      assertThat(it).isInstanceOf(OfflineMappingEvalInvalidModelOutput::class.java)
      assertThat((it as OfflineMappingEvalInvalidModelOutput).invalidReasons)
        .contains(OfflineMappingEvalInvalidReasonCode.VERSION_PIN_MISMATCH)
    }
  }

  @Test
  fun `invalid provider targets are technical failures and never taxonomy gaps`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val outputsByAccount = OfflineMappingEvalFixtures042a2.loadFaultProviderOutputs()
    val faultProvider = OfflineMappingEvalFaultProvider042a2(outputsByAccount)
    val engine = OfflineMappingEvalEngine042a2(faultProvider)
    val invalidCases = OfflineMappingEvalFixtures042a2.loadInvalidOutputCases(taxonomy)

    invalidCases.forEach { fixture ->
      val result = engine.evaluate(fixture.request)
      val expected = fixture.expected as OfflineMappingEvalExpected042a2.InvalidModelOutput

      assertThat(result).isInstanceOf(OfflineMappingEvalInvalidModelOutput::class.java)
      val invalidResult = result as OfflineMappingEvalInvalidModelOutput
      assertThat(invalidResult.invalidReasons).contains(expected.invalidReason)
      assertThat(invalidResult.businessAbstentionCounted).isFalse()
    }
  }

  @Test
  fun `abstention with target or confidence and suggestion without evidence are rejected`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val request = request(taxonomy)
    val abstentionWithTarget = providerAbstentionJson("1000", "INSUFFICIENT_EVIDENCE")
      .replace(
        """"reasonCode": "INSUFFICIENT_EVIDENCE"""",
        """"reasonCode": "INSUFFICIENT_EVIDENCE", "suggestedTargetCode": "BS.ASSET.CASH_AND_EQUIVALENTS", "confidence": 0.4"""
      )
    val suggestionWithoutEvidence = providerSuggestionJson(
      accountCode = "1000",
      suggestedTargetCode = "BS.ASSET.CASH_AND_EQUIVALENTS"
    ).replace(
      Regex("""(?s),\s*"evidence"\s*:\s*\[.*?]\s*,\s*"explanationCode""""),
      ""","evidence": [], "explanationCode""""
    )

    val results = listOf(abstentionWithTarget, suggestionWithoutEvidence).map { output ->
      OfflineMappingEvalEngine042a2(OfflineMappingEvalProvider { providerResponse(output) }).evaluate(request)
    }

    assertThat(results).allSatisfy {
      assertThat(it).isInstanceOf(OfflineMappingEvalInvalidModelOutput::class.java)
      assertThat((it as OfflineMappingEvalInvalidModelOutput).invalidReasons)
        .contains(OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    }
  }

  @Test
  fun `wrong explanation code for outcome is rejected`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val request = request(taxonomy)
    val suggestionWithAbstentionExplanation = providerSuggestionJson(
      accountCode = "1000",
      suggestedTargetCode = "BS.ASSET.CASH_AND_EQUIVALENTS"
    ).replace(
      OfflineMappingEvalExplanationCode.TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE.name,
      OfflineMappingEvalExplanationCode.EVIDENCE_NOT_SUFFICIENT_FOR_AFFECTATION.name
    )
    val abstentionWithSuggestionExplanation = providerAbstentionJson(
      accountCode = "1000",
      reasonCode = "INSUFFICIENT_EVIDENCE"
    ).replace(
      OfflineMappingEvalExplanationCode.EVIDENCE_NOT_SUFFICIENT_FOR_AFFECTATION.name,
      OfflineMappingEvalExplanationCode.TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE.name
    )

    val results = listOf(suggestionWithAbstentionExplanation, abstentionWithSuggestionExplanation).map { output ->
      OfflineMappingEvalEngine042a2(OfflineMappingEvalProvider { providerResponse(output) }).evaluate(request)
    }

    assertThat(results).allSatisfy {
      assertThat(it).isInstanceOf(OfflineMappingEvalInvalidModelOutput::class.java)
      assertThat((it as OfflineMappingEvalInvalidModelOutput).invalidReasons)
        .contains(OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    }
  }

  @Test
  fun `suggestion requires exactly one account label and one target taxonomy evidence code`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val validOutput = providerSuggestionJson(
      accountCode = "1000",
      suggestedTargetCode = "BS.ASSET.CASH_AND_EQUIVALENTS"
    )
    val invalidOutputs = listOf(
      validOutput.withEvidenceTypes("ACCOUNT_LABEL"),
      validOutput.withEvidenceTypes("TARGET_TAXONOMY"),
      validOutput.withEvidenceTypes("ACCOUNT_LABEL", "ACCOUNT_LABEL", "TARGET_TAXONOMY"),
      validOutput.withEvidenceTypes("ACCOUNT_LABEL", "TARGET_TAXONOMY", "TARGET_TAXONOMY")
    )

    val validResult = OfflineMappingEvalEngine042a2(OfflineMappingEvalProvider { providerResponse(validOutput) })
      .evaluate(request(taxonomy))
    val invalidResults = invalidOutputs.map { output ->
      OfflineMappingEvalEngine042a2(OfflineMappingEvalProvider { providerResponse(output) }).evaluate(request(taxonomy))
    }

    assertThat(validResult).isInstanceOf(OfflineMappingEvalSuggestion::class.java)
    assertThat((validResult as OfflineMappingEvalSuggestion).evidence)
      .containsExactly(
        OfflineMappingEvalEvidence(
          type = OfflineMappingEvalEvidenceType.ACCOUNT_LABEL,
          ref = "candidate-demo-input:1000:accountLabel",
          snippet = "Synthetic cash account"
        ),
        OfflineMappingEvalEvidence(
          type = OfflineMappingEvalEvidenceType.TARGET_TAXONOMY,
          ref = "taxonomy-snapshot-candidate-v1:BS.ASSET.CASH_AND_EQUIVALENTS",
          snippet = "Cash and cash equivalents"
        )
      )
    assertThat(invalidResults).allSatisfy {
      assertThat(it).isInstanceOf(OfflineMappingEvalInvalidModelOutput::class.java)
      assertThat((it as OfflineMappingEvalInvalidModelOutput).invalidReasons)
        .contains(OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
    }
  }

  @Test
  fun `abstention rejects target taxonomy evidence`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val output = providerAbstentionJson(
      accountCode = "1000",
      reasonCode = "INSUFFICIENT_EVIDENCE"
    ).replace(
      Regex("""(?s)"evidence"\s*:\s*\[.*?]\s*,\s*"explanationCode""""),
      """"evidence": [{"type": "ACCOUNT_LABEL"}, {"type": "TARGET_TAXONOMY"}], "explanationCode""""
    )

    val result = OfflineMappingEvalEngine042a2(OfflineMappingEvalProvider { providerResponse(output) })
      .evaluate(request(taxonomy))

    assertThat(result).isInstanceOf(OfflineMappingEvalInvalidModelOutput::class.java)
    assertThat((result as OfflineMappingEvalInvalidModelOutput).invalidReasons)
      .contains(OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
  }

  @Test
  fun `provider free ref or snippet injection in evidence is rejected`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val output = providerSuggestionJson(
      accountCode = "1000",
      suggestedTargetCode = "BS.ASSET.CASH_AND_EQUIVALENTS"
    ).replace(
      """"type": "ACCOUNT_LABEL"""",
      """"type": "ACCOUNT_LABEL", "ref": "C:\\Users\\LuisAllauca\\private", "snippet": "secret token""""
    )

    val result = OfflineMappingEvalEngine042a2(OfflineMappingEvalProvider { providerResponse(output) })
      .evaluate(request(taxonomy))

    assertThat(result).isInstanceOf(OfflineMappingEvalInvalidModelOutput::class.java)
    assertThat((result as OfflineMappingEvalInvalidModelOutput).invalidReasons)
      .contains(OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
  }

  @Test
  fun `requires human review is imposed locally and provider cannot set it false`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val validOutput = providerSuggestionJson(
      accountCode = "1000",
      suggestedTargetCode = "BS.ASSET.CASH_AND_EQUIVALENTS"
    )
    val outputWithProviderOverride = validOutput.replace(
      """"suggestedTargetCode": "BS.ASSET.CASH_AND_EQUIVALENTS"""",
      """"suggestedTargetCode": "BS.ASSET.CASH_AND_EQUIVALENTS", "requiresHumanReview": false"""
    )

    val validResult = OfflineMappingEvalEngine042a2(OfflineMappingEvalProvider { providerResponse(validOutput) })
      .evaluate(request(taxonomy))
    val invalidResult = OfflineMappingEvalEngine042a2(OfflineMappingEvalProvider { providerResponse(outputWithProviderOverride) })
      .evaluate(request(taxonomy))

    assertThat(validResult).isInstanceOf(OfflineMappingEvalSuggestion::class.java)
    assertThat((validResult as OfflineMappingEvalSuggestion).requiresHumanReview).isTrue()
    assertThat(invalidResult).isInstanceOf(OfflineMappingEvalInvalidModelOutput::class.java)
    assertThat((invalidResult as OfflineMappingEvalInvalidModelOutput).invalidReasons)
      .contains(OfflineMappingEvalInvalidReasonCode.SCHEMA_INVALID)
  }

  @Test
  fun `provider exception becomes technical degradation`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val engine = OfflineMappingEvalEngine042a2(OfflineMappingEvalProvider {
      throw IllegalStateException("provider unavailable")
    })

    val result = engine.evaluate(request(taxonomy))

    assertThat(result).isEqualTo(
      OfflineMappingEvalProviderFailure(
        accountCode = "1000",
        failureCode = OfflineMappingEvalProviderFailureCode.PROVIDER_EXCEPTION
      )
    )
  }

  @Test
  fun `metrics count business policy and technical categories separately`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val results = listOf(
      OfflineMappingEvalSuggestion(
        accountCode = "1000",
        suggestedTargetCode = "BS.ASSET.CASH_AND_EQUIVALENTS",
        evidence = evidence("1000"),
        explanationCode = OfflineMappingEvalExplanationCode.TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE
      ),
      OfflineMappingEvalAbstention(
        accountCode = "4000",
        reasonCode = OfflineMappingEvalAbstentionReasonCode.INSUFFICIENT_EVIDENCE,
        evidence = evidence("4000"),
        explanationCode = OfflineMappingEvalExplanationCode.EVIDENCE_NOT_SUFFICIENT_FOR_AFFECTATION
      ),
      OfflineMappingEvalEngine042a2(DeterministicOfflineMappingEvalFakeProvider042a2()).evaluate(
        OfflineMappingEvalRequest(
          accountCode = "1100",
          accountLabel = "Synthetic trade receivables",
          balanceSignal = "DEBIT_DOMINANT",
          requestSynthetic = false,
          taxonomy = taxonomy
        )
      ),
      OfflineMappingEvalInvalidModelOutput(
        accountCode = "9999",
        invalidReasons = setOf(OfflineMappingEvalInvalidReasonCode.TARGET_UNKNOWN)
      )
    )

    val metrics = OfflineMappingEvalMetrics.from(results)

    assertThat(metrics.totalCases).isEqualTo(4)
    assertThat(metrics.suggestions).isEqualTo(1)
    assertThat(metrics.businessAbstentions).isEqualTo(1)
    assertThat(metrics.policyBlocks).isEqualTo(1)
    assertThat(metrics.invalidModelOutputs).isEqualTo(1)
    assertThat(metrics.technicalFailures).isEqualTo(1)
    assertThat(metrics.providerCallsOnPolicyOrPreconditionBlocks).isZero()
  }

  @Test
  fun `engine is not a spring bean and exposes no db audit or network collaborators`() {
    val forbiddenTypeMarkers = listOf(
      "Jd" + "bc",
      "Repo" + "sitory",
      "Au" + "dit",
      "Data" + "Source",
      "Http" + "Client",
      "Web" + "Client",
      "Rest" + "Client",
      "Ok" + "Http"
    )

    assertThat(OfflineMappingEvalEngine042a2::class.java.annotations.map { it.annotationClass.simpleName })
      .doesNotContain("Service", "Component", "Repo" + "sitory", "Controller")
    assertThat(OfflineMappingEvalEngine042a2::class.java.declaredFields.map { it.type.name })
      .noneSatisfy { typeName ->
        assertThat(forbiddenTypeMarkers.any { marker -> marker in typeName }).isTrue()
      }
  }

  @Test
  fun `offline mapping engine source has no spring wiring endpoint db client or runtime provider integration`() {
    val source = java.nio.file.Files.readString(
      OfflineMappingEvalFixtures042a2.repoRoot.resolve(
        "backend/src/main/kotlin/ch/qamwaq/ritomer/mapping/application/OfflineMappingEvalEngine042a2.kt"
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
      "@PutMapping",
      "@DeleteMapping",
      "@RequestMapping",
      "HttpClient",
      "WebClient",
      "RestClient",
      "OkHttp",
      "ktor.client",
      "Repository",
      "DataSource",
      "EntityManager",
      "JdbcTemplate",
      "Flyway",
      "MappingSuggestionsController",
      "MappingSuggestionGenerationAccess",
      "OpenAI",
      "Anthropic",
      "ChatClient"
    )

    assertThat(forbiddenSourceMarkers.filter { marker -> marker in source }).isEmpty()
  }

  private fun request(taxonomy: OfflineMappingEvalTaxonomy): OfflineMappingEvalRequest =
    OfflineMappingEvalRequest(
      accountCode = "1000",
      accountLabel = "Synthetic cash account",
      balanceSignal = "DEBIT_DOMINANT",
      taxonomy = taxonomy
    )

  private fun evidence(accountCode: String): List<OfflineMappingEvalEvidence> =
    listOf(
      OfflineMappingEvalEvidence(
        type = OfflineMappingEvalEvidenceType.ACCOUNT_LABEL,
        ref = "candidate-demo-input:$accountCode:accountLabel",
        snippet = "Synthetic account"
      )
    )

  private fun withAdditionalRootField(output: String, field: String): String =
    output.replace(
      """"schemaVersion": "${OfflineMappingEvalEngine042a2.PROVIDER_SCHEMA_VERSION}"""",
      """"schemaVersion": "${OfflineMappingEvalEngine042a2.PROVIDER_SCHEMA_VERSION}", $field"""
    )

  private fun String.withEvidenceTypes(vararg evidenceTypes: String): String =
    replace(
      Regex("""(?s)"evidence"\s*:\s*\[.*?]\s*,\s*"explanationCode""""),
      """"evidence": [${evidenceTypes.joinToString(", ") { """{"type": "$it"}""" }}], "explanationCode""""
    )
}
