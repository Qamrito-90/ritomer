package ch.qamwaq.ritomer.mapping.application

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import java.nio.file.Files
import java.nio.file.Path

internal data class OfflineMappingEvalFixtureCase042a2(
  val id: String,
  val category: String,
  val request: OfflineMappingEvalRequest,
  val expected: OfflineMappingEvalExpected042a2
)

internal sealed interface OfflineMappingEvalExpected042a2 {
  data class Suggestion(val targetCode: String) : OfflineMappingEvalExpected042a2
  data class Abstention(val reasonCode: OfflineMappingEvalAbstentionReasonCode) : OfflineMappingEvalExpected042a2
  data class PolicyBlock(val blockCode: OfflineMappingEvalPolicyBlockCode) : OfflineMappingEvalExpected042a2
  data class PreconditionBlock(val blockCode: OfflineMappingEvalPreconditionBlockCode) : OfflineMappingEvalExpected042a2
  data class InvalidModelOutput(val invalidReason: OfflineMappingEvalInvalidReasonCode) : OfflineMappingEvalExpected042a2
}

internal object OfflineMappingEvalFixtures042a2 {
  private val objectMapper = jacksonObjectMapper()
  val repoRoot: Path = findRepoRoot()
  val reportDirectory: Path = repoRoot.resolve("backend").resolve("build").resolve("reports").resolve("042a2")

  private val fixturesDirectory = repoRoot.resolve("evals").resolve("mapping").resolve("fixtures").resolve("042a2")
  val semanticCasesPath: Path = fixturesDirectory.resolve("candidate-semantic-cases-v1.json")
  val policyFaultCasesPath: Path = fixturesDirectory.resolve("candidate-policy-fault-cases-v1.json")
  val taxonomySnapshotPath: Path = fixturesDirectory.resolve("taxonomy-snapshot-candidate-v1.json")
  val demoInputPath: Path = fixturesDirectory.resolve("demo-input-unmapped-v1.json")

  fun loadTaxonomy(): OfflineMappingEvalTaxonomy {
    val root = readJson(taxonomySnapshotPath)
    return OfflineMappingEvalTaxonomy(
      id = root.requiredText("id"),
      taxonomyVersion = root.requiredObject("source").requiredInt("version"),
      entries = root.requiredArray("entries").map {
        OfflineMappingEvalTarget(
          code = it.requiredText("code"),
          label = it.requiredText("label"),
          selectable = it.requiredBoolean("selectable"),
          deprecated = it.requiredBoolean("deprecated"),
          granularity = it.requiredText("granularity"),
          pilotRole = enumValueOf(it.requiredText("pilotRole")),
          displayOrder = it.requiredInt("displayOrder")
        )
      }
    )
  }

  fun loadSemanticCases(taxonomy: OfflineMappingEvalTaxonomy = loadTaxonomy()): List<OfflineMappingEvalFixtureCase042a2> {
    val root = readJson(semanticCasesPath)
    return root.requiredArray("cases").map {
      val input = it.requiredObject("input")
      val expected = it.requiredObject("expected")
      OfflineMappingEvalFixtureCase042a2(
        id = it.requiredText("id"),
        category = it.requiredText("category"),
        request = OfflineMappingEvalRequest(
          accountCode = input.requiredText("accountCode"),
          accountLabel = input.requiredText("accountLabel"),
          balanceSignal = input.requiredText("balanceSignal"),
          currentAffectationStatus = input.requiredText("currentAffectationStatus"),
          taxonomy = taxonomy
        ),
        expected = when (expected.requiredText("outcome")) {
          "SUGGESTION" -> OfflineMappingEvalExpected042a2.Suggestion(expected.requiredText("suggestedTargetCode"))
          "ABSTENTION" -> OfflineMappingEvalExpected042a2.Abstention(enumValueOf(expected.requiredText("reasonCode")))
          else -> error("Unsupported semantic expected outcome.")
        }
      )
    }
  }

  fun loadPolicyCases(taxonomy: OfflineMappingEvalTaxonomy = loadTaxonomy()): List<OfflineMappingEvalFixtureCase042a2> {
    val root = readJson(policyFaultCasesPath)
    return root.requiredArray("policyCases").map {
      val input = it.requiredObject("input")
      val expected = it.requiredObject("expected")
      val outcome = expected.requiredText("outcome")
      OfflineMappingEvalFixtureCase042a2(
        id = it.requiredText("id"),
        category = it.requiredText("category"),
        request = OfflineMappingEvalRequest(
          accountCode = input.requiredText("accountCode"),
          accountLabel = input.requiredText("accountLabel"),
          balanceSignal = input.requiredText("balanceSignal"),
          datasetPolicy = input.optionalText("datasetPolicy") ?: "SYNTHETIC_DEMO_ONLY",
          requestSynthetic = input.optionalBoolean("requestSynthetic") ?: true,
          crossTenantSignal = input.optionalText("crossTenantSignal"),
          provenanceStatus = input.optionalText("provenanceStatus") ?: "ALLOWLISTED",
          language = input.optionalText("language") ?: "en",
          currentAffectationStatus = input.optionalText("currentAffectationStatus") ?: "NONE",
          taxonomy = taxonomy
        ),
        expected = if (outcome == "PRECONDITION_BLOCK") {
          OfflineMappingEvalExpected042a2.PreconditionBlock(enumValueOf(expected.requiredText("blockCode")))
        } else {
          OfflineMappingEvalExpected042a2.PolicyBlock(enumValueOf(expected.requiredText("blockCode")))
        }
      )
    }
  }

  fun loadInvalidOutputCases(taxonomy: OfflineMappingEvalTaxonomy = loadTaxonomy()): List<OfflineMappingEvalFixtureCase042a2> {
    val root = readJson(policyFaultCasesPath)
    val labelsByAccountCode = loadDemoLabelsByAccountCode()
    return root.requiredArray("invalidOutputCases").map {
      val simulatedOutput = it.requiredObject("simulatedStructuredOutput")
      val expected = it.requiredObject("expected")
      val accountCode = simulatedOutput.requiredText("accountCode")
      OfflineMappingEvalFixtureCase042a2(
        id = it.requiredText("id"),
        category = it.requiredText("category"),
        request = OfflineMappingEvalRequest(
          accountCode = accountCode,
          accountLabel = labelsByAccountCode[accountCode] ?: "Synthetic fault account $accountCode",
          balanceSignal = "DEBIT_DOMINANT",
          taxonomy = taxonomy
        ),
        expected = OfflineMappingEvalExpected042a2.InvalidModelOutput(enumValueOf(expected.requiredText("invalidReason")))
      )
    }
  }

  fun loadFaultProviderOutputs(): Map<String, String> {
    val root = readJson(policyFaultCasesPath)
    return root.requiredArray("invalidOutputCases").associate {
      val simulatedOutput = it.requiredObject("simulatedStructuredOutput")
      val accountCode = simulatedOutput.requiredText("accountCode")
      val suggestedTargetCode = simulatedOutput.requiredText("suggestedTargetCode")
      accountCode to providerSuggestionJson(
        accountCode = accountCode,
        suggestedTargetCode = suggestedTargetCode
      )
    }
  }

  private fun loadDemoLabelsByAccountCode(): Map<String, String> {
    val root = readJson(demoInputPath)
    return root.requiredArray("accounts").associate {
      it.requiredText("accountCode") to it.requiredText("accountLabel")
    }
  }

  private fun readJson(path: Path): JsonNode =
    objectMapper.readTree(path.toFile())

  private fun findRepoRoot(): Path {
    val current = Path.of("").toAbsolutePath().normalize()
    return generateSequence(current) { it.parent }
      .firstOrNull { Files.exists(it.resolve("evals").resolve("mapping")) && Files.exists(it.resolve("backend")) }
      ?: error("Could not resolve repository root from $current.")
  }
}

internal class DeterministicOfflineMappingEvalFakeProvider042a2 : OfflineMappingEvalProvider {
  var callCount: Int = 0
    private set
  val requests: MutableList<OfflineMappingEvalProviderRequest> = mutableListOf()

  override fun generate(request: OfflineMappingEvalProviderRequest): OfflineMappingEvalProviderResponse {
    callCount += 1
    requests += request

    val targetCode = targetCodeFor(request.account)
      ?: return providerResponse(providerAbstentionJson(
        accountCode = request.account.accountCode,
        reasonCode = OfflineMappingEvalAbstentionReasonCode.INSUFFICIENT_EVIDENCE.name
      ))
    val target = request.candidateTargets.firstOrNull { it.code == targetCode }
      ?: return providerResponse(providerAbstentionJson(
        accountCode = request.account.accountCode,
        reasonCode = OfflineMappingEvalAbstentionReasonCode.INSUFFICIENT_EVIDENCE.name
      ))

    return providerResponse(providerSuggestionJson(
      accountCode = request.account.accountCode,
      suggestedTargetCode = target.code
    ))
  }

  private fun targetCodeFor(account: OfflineMappingEvalProviderAccount): String? {
    val label = account.sanitizedAccountLabel.lowercase()
    return when {
      label == "synthetic operating expenses" -> null
      "other operating expenses" in label -> "PL.EXPENSE.OTHER_OPERATING_EXPENSES"
      "cash" in label -> "BS.ASSET.CASH_AND_EQUIVALENTS"
      "receivable" in label -> "BS.ASSET.TRADE_RECEIVABLES"
      "payable" in label -> "BS.LIABILITY.TRADE_PAYABLES"
      "retained earnings" in label -> "BS.EQUITY.RETAINED_EARNINGS"
      "operating revenue" in label -> "PL.REVENUE.OPERATING_REVENUE"
      else -> null
    }
  }
}

internal class OfflineMappingEvalFaultProvider042a2(
  private val outputsByAccountCode: Map<String, String>
) : OfflineMappingEvalProvider {
  var callCount: Int = 0
    private set
  val requests: MutableList<OfflineMappingEvalProviderRequest> = mutableListOf()

  override fun generate(request: OfflineMappingEvalProviderRequest): OfflineMappingEvalProviderResponse {
    callCount += 1
    requests += request
    return providerResponse(outputsByAccountCode[request.account.accountCode]
      ?: """{"outcome":"SUGGESTION","accountCode":"${request.account.accountCode}"}"""
    )
  }
}

internal fun providerResponse(
  rawJson: String,
  promptVersion: String = OfflineMappingEvalEngine042a2.PROVIDER_PROMPT_VERSION,
  modelVersion: String = OfflineMappingEvalEngine042a2.PROVIDER_MODEL_VERSION
): OfflineMappingEvalProviderResponse =
  OfflineMappingEvalProviderResponse(
    rawJson = rawJson,
    promptVersion = promptVersion,
    modelVersion = modelVersion
  )

internal fun providerSuggestionJson(
  accountCode: String,
  suggestedTargetCode: String
): String =
  """
  {
    "outcome": "SUGGESTION",
    "accountCode": "$accountCode",
    "suggestedTargetCode": "$suggestedTargetCode",
    "evidence": [
      {
        "type": "ACCOUNT_LABEL"
      },
      {
        "type": "TARGET_TAXONOMY"
      }
    ],
    "explanationCode": "${OfflineMappingEvalExplanationCode.TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE.name}",
    "schemaVersion": "${OfflineMappingEvalEngine042a2.PROVIDER_SCHEMA_VERSION}"
  }
  """.trimIndent()

internal fun providerAbstentionJson(
  accountCode: String,
  reasonCode: String
): String =
  """
  {
    "outcome": "ABSTENTION",
    "accountCode": "$accountCode",
    "reasonCode": "$reasonCode",
    "evidence": [
      {
        "type": "ACCOUNT_LABEL"
      }
    ],
    "explanationCode": "${OfflineMappingEvalExplanationCode.EVIDENCE_NOT_SUFFICIENT_FOR_AFFECTATION.name}",
    "schemaVersion": "${OfflineMappingEvalEngine042a2.PROVIDER_SCHEMA_VERSION}"
  }
  """.trimIndent()

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

private fun JsonNode.optionalText(fieldName: String): String? {
  val value = get(fieldName) ?: return null
  require(value.isTextual) { "Field '$fieldName' must be textual." }
  return value.asText()
}

private fun JsonNode.requiredBoolean(fieldName: String): Boolean {
  val value = get(fieldName) ?: error("Missing boolean field '$fieldName'.")
  require(value.isBoolean) { "Field '$fieldName' must be boolean." }
  return value.asBoolean()
}

private fun JsonNode.optionalBoolean(fieldName: String): Boolean? {
  val value = get(fieldName) ?: return null
  require(value.isBoolean) { "Field '$fieldName' must be boolean." }
  return value.asBoolean()
}

private fun JsonNode.requiredInt(fieldName: String): Int {
  val value = get(fieldName) ?: error("Missing integer field '$fieldName'.")
  require(value.isInt) { "Field '$fieldName' must be integer." }
  return value.asInt()
}
