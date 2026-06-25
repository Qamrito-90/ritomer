package ch.qamwaq.ritomer.mapping.application

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import java.time.Instant
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test

@Tag("offline-mapping-eval-042a2")
class OfflineMappingEval042a2RunnerTest {
  @Test
  fun `run all candidate 042a2 offline mapping cases`() {
    val taxonomy = OfflineMappingEvalFixtures042a2.loadTaxonomy()
    val semanticCases = OfflineMappingEvalFixtures042a2.loadSemanticCases(taxonomy)
    val policyCases = OfflineMappingEvalFixtures042a2.loadPolicyCases(taxonomy)
    val invalidOutputCases = OfflineMappingEvalFixtures042a2.loadInvalidOutputCases(taxonomy)

    val fakeProvider = DeterministicOfflineMappingEvalFakeProvider042a2()
    val semanticAndPolicyEngine = OfflineMappingEvalEngine042a2(fakeProvider)
    val semanticReports = semanticCases.map { evaluateFixtureCase(it, semanticAndPolicyEngine) }
    val policyReports = policyCases.map { evaluateFixtureCase(it, semanticAndPolicyEngine) }

    val faultProvider = OfflineMappingEvalFaultProvider042a2(OfflineMappingEvalFixtures042a2.loadFaultProviderOutputs())
    val faultEngine = OfflineMappingEvalEngine042a2(faultProvider)
    val invalidReports = invalidOutputCases.map { evaluateFixtureCase(it, faultEngine) }

    val caseReports = semanticReports + policyReports + invalidReports
    val results = caseReports.map { it.result }
    val metrics = OfflineMappingEvalMetrics.from(results)
    val report = OfflineMappingEvalReport042a2(
      schemaVersion = "offline-mapping-eval-042a2a3-report-v1",
      status = listOf("CANDIDATE_EVAL", "NOT_GOLDEN", "NOT_AUTHORITATIVE", "NOT_MODEL_QUALITY"),
      generatedAt = Instant.now().toString(),
      sourceArtifacts = mapOf(
        "semanticCases" to relativeRepoPath(OfflineMappingEvalFixtures042a2.semanticCasesPath),
        "policyFaultCases" to relativeRepoPath(OfflineMappingEvalFixtures042a2.policyFaultCasesPath),
        "taxonomySnapshot" to relativeRepoPath(OfflineMappingEvalFixtures042a2.taxonomySnapshotPath),
        "demoInputProjection" to relativeRepoPath(OfflineMappingEvalFixtures042a2.demoInputPath)
      ),
      summary = OfflineMappingEvalSummary042a2(
        totalCases = caseReports.size,
        passed = caseReports.count { it.passed },
        failed = caseReports.count { !it.passed },
        businessCases = semanticCases.size,
        policyPreconditionCases = policyCases.size,
        invalidOutputCases = invalidOutputCases.size,
        providerCalls = metrics.providerCalls,
        providerCallsOnPolicyOrPreconditionBlocks = metrics.providerCallsOnPolicyOrPreconditionBlocks,
        suggestions = metrics.suggestions,
        businessAbstentions = metrics.businessAbstentions,
        policyBlocks = metrics.policyBlocks,
        preconditionBlocks = metrics.preconditionBlocks,
        invalidInputs = metrics.invalidInputs,
        invalidModelOutputs = metrics.invalidModelOutputs,
        technicalFailures = metrics.technicalFailures
      ),
      cases = caseReports.map { it.toReportCase() }
    )

    writeReport(report)
    printConsoleSummary(report)

    val failures = caseReports.flatMap { caseReport ->
      caseReport.failures.map { "${caseReport.id}: $it" }
    }

    assertThat(caseReports).hasSize(17)
    assertThat(semanticCases).hasSize(7)
    assertThat(policyCases).hasSize(5)
    assertThat(invalidOutputCases).hasSize(5)
    assertThat(fakeProvider.callCount).isEqualTo(semanticCases.size)
    assertThat(faultProvider.callCount).isEqualTo(invalidOutputCases.size)
    assertThat(metrics.providerCallsOnPolicyOrPreconditionBlocks).isZero()
    assertThat(report.sourceArtifacts.values).allSatisfy { path ->
      assertThat(java.nio.file.Path.of(path).isAbsolute).isFalse()
      assertThat(path).doesNotContain(":\\", "Users\\", "LuisAllauca")
    }
    assertThat(failures).isEmpty()
  }

  private fun evaluateFixtureCase(
    fixtureCase: OfflineMappingEvalFixtureCase042a2,
    engine: OfflineMappingEvalEngine042a2
  ): OfflineMappingEvalCaseExecution042a2 {
    val result = engine.evaluate(fixtureCase.request)
    return OfflineMappingEvalCaseExecution042a2(
      id = fixtureCase.id,
      category = fixtureCase.category,
      expected = fixtureCase.expected,
      result = result,
      failures = compareExpected(fixtureCase.expected, result)
    )
  }

  private fun compareExpected(
    expected: OfflineMappingEvalExpected042a2,
    result: OfflineMappingEvalResult
  ): List<String> {
    val failures = mutableListOf<String>()
    when (expected) {
      is OfflineMappingEvalExpected042a2.Suggestion -> {
        val suggestion = result as? OfflineMappingEvalSuggestion
        if (suggestion == null) {
          failures += "expected SUGGESTION, got ${result.outcomeName()}"
        } else {
          if (suggestion.suggestedTargetCode != expected.targetCode) {
            failures += "expected target ${expected.targetCode}, got ${suggestion.suggestedTargetCode}"
          }
          if (!suggestion.requiresHumanReview) {
            failures += "requiresHumanReview must be added locally as true"
          }
          val evidenceTypes = suggestion.evidence.map { it.type }.toSet()
          if (!evidenceTypes.containsAll(setOf(OfflineMappingEvalEvidenceType.ACCOUNT_LABEL, OfflineMappingEvalEvidenceType.TARGET_TAXONOMY))) {
            failures += "suggestion evidence must include ACCOUNT_LABEL and TARGET_TAXONOMY"
          }
        }
      }
      is OfflineMappingEvalExpected042a2.Abstention -> {
        val abstention = result as? OfflineMappingEvalAbstention
        if (abstention == null) {
          failures += "expected ABSTENTION, got ${result.outcomeName()}"
        } else {
          if (abstention.reasonCode != expected.reasonCode) {
            failures += "expected reason ${expected.reasonCode}, got ${abstention.reasonCode}"
          }
          if (abstention.evidence.none { it.type == OfflineMappingEvalEvidenceType.ACCOUNT_LABEL }) {
            failures += "abstention evidence must include ACCOUNT_LABEL"
          }
        }
      }
      is OfflineMappingEvalExpected042a2.PolicyBlock -> {
        val block = result as? OfflineMappingEvalPolicyBlock
        if (block == null) {
          failures += "expected POLICY_BLOCK, got ${result.outcomeName()}"
        } else {
          if (block.blockCode != expected.blockCode) {
            failures += "expected block ${expected.blockCode}, got ${block.blockCode}"
          }
          if (block.providerCallCount != 0) {
            failures += "policy block must not call provider"
          }
        }
      }
      is OfflineMappingEvalExpected042a2.PreconditionBlock -> {
        val block = result as? OfflineMappingEvalPreconditionBlock
        if (block == null) {
          failures += "expected PRECONDITION_BLOCK, got ${result.outcomeName()}"
        } else {
          if (block.blockCode != expected.blockCode) {
            failures += "expected block ${expected.blockCode}, got ${block.blockCode}"
          }
          if (block.providerCallCount != 0) {
            failures += "precondition block must not call provider"
          }
        }
      }
      is OfflineMappingEvalExpected042a2.InvalidModelOutput -> {
        val invalid = result as? OfflineMappingEvalInvalidModelOutput
        if (invalid == null) {
          failures += "expected INVALID_MODEL_OUTPUT, got ${result.outcomeName()}"
        } else {
          if (expected.invalidReason !in invalid.invalidReasons) {
            failures += "expected invalid reason ${expected.invalidReason}, got ${invalid.invalidReasons}"
          }
          if (invalid.businessAbstentionCounted) {
            failures += "invalid output must not count as business abstention"
          }
        }
      }
    }

    if (result is OfflineMappingEvalPolicyBlock || result is OfflineMappingEvalPreconditionBlock) {
      if (result.providerCallCount != 0) {
        failures += "blocked case providerCallCount must be 0"
      }
    }
    return failures
  }

  private fun relativeRepoPath(path: java.nio.file.Path): String =
    OfflineMappingEvalFixtures042a2.repoRoot
      .relativize(path)
      .toString()
      .replace('\\', '/')

  private fun writeReport(report: OfflineMappingEvalReport042a2) {
    val reportDirectory = OfflineMappingEvalFixtures042a2.reportDirectory
    java.nio.file.Files.createDirectories(reportDirectory)
    jacksonObjectMapper()
      .writerWithDefaultPrettyPrinter()
      .writeValue(reportDirectory.resolve("offline-mapping-eval-report.json").toFile(), report)
  }

  private fun printConsoleSummary(report: OfflineMappingEvalReport042a2) {
    println("042a2 offline mapping eval")
    println("Status: ${report.status.joinToString(" / ")}")
    println("Total cases: ${report.summary.totalCases}")
    println("Passed: ${report.summary.passed}")
    println("Failed: ${report.summary.failed}")
    println("Business cases: ${report.summary.businessCases}")
    println("Policy/precondition cases: ${report.summary.policyPreconditionCases}")
    println("Invalid output cases: ${report.summary.invalidOutputCases}")
    println("Invalid input cases: ${report.summary.invalidInputs}")
    println("Provider calls: ${report.summary.providerCalls}")
    println("Provider calls on policy/precondition blockers: ${report.summary.providerCallsOnPolicyOrPreconditionBlocks}")
    println("Report: ${OfflineMappingEvalFixtures042a2.reportDirectory.resolve("offline-mapping-eval-report.json")}")
  }
}

private data class OfflineMappingEvalCaseExecution042a2(
  val id: String,
  val category: String,
  val expected: OfflineMappingEvalExpected042a2,
  val result: OfflineMappingEvalResult,
  val failures: List<String>
) {
  val passed: Boolean = failures.isEmpty()

  fun toReportCase(): OfflineMappingEvalReportCase042a2 =
    OfflineMappingEvalReportCase042a2(
      id = id,
      category = category,
      expected = expected.toReportMap(),
      actual = result.toReportMap(),
      providerCallCount = result.providerCallCount,
      businessAbstentionCounted = result.businessAbstentionCounted,
      passed = passed,
      failures = failures
    )
}

private data class OfflineMappingEvalReport042a2(
  val schemaVersion: String,
  val status: List<String>,
  val generatedAt: String,
  val sourceArtifacts: Map<String, String>,
  val summary: OfflineMappingEvalSummary042a2,
  val cases: List<OfflineMappingEvalReportCase042a2>
)

private data class OfflineMappingEvalSummary042a2(
  val totalCases: Int,
  val passed: Int,
  val failed: Int,
  val businessCases: Int,
  val policyPreconditionCases: Int,
  val invalidOutputCases: Int,
  val providerCalls: Int,
  val providerCallsOnPolicyOrPreconditionBlocks: Int,
  val suggestions: Int,
  val businessAbstentions: Int,
  val policyBlocks: Int,
  val preconditionBlocks: Int,
  val invalidInputs: Int,
  val invalidModelOutputs: Int,
  val technicalFailures: Int
)

private data class OfflineMappingEvalReportCase042a2(
  val id: String,
  val category: String,
  val expected: Map<String, Any>,
  val actual: Map<String, Any>,
  val providerCallCount: Int,
  val businessAbstentionCounted: Boolean,
  val passed: Boolean,
  val failures: List<String>
)

private fun OfflineMappingEvalExpected042a2.toReportMap(): Map<String, Any> =
  when (this) {
    is OfflineMappingEvalExpected042a2.Suggestion -> mapOf(
      "outcome" to "SUGGESTION",
      "targetCode" to targetCode
    )
    is OfflineMappingEvalExpected042a2.Abstention -> mapOf(
      "outcome" to "ABSTENTION",
      "reasonCode" to reasonCode.name
    )
    is OfflineMappingEvalExpected042a2.PolicyBlock -> mapOf(
      "outcome" to "POLICY_BLOCK",
      "blockCode" to blockCode.name
    )
    is OfflineMappingEvalExpected042a2.PreconditionBlock -> mapOf(
      "outcome" to "PRECONDITION_BLOCK",
      "blockCode" to blockCode.name
    )
    is OfflineMappingEvalExpected042a2.InvalidModelOutput -> mapOf(
      "outcome" to "INVALID_MODEL_OUTPUT",
      "invalidReason" to invalidReason.name
    )
  }

private fun OfflineMappingEvalResult.toReportMap(): Map<String, Any> =
  when (this) {
    is OfflineMappingEvalSuggestion -> mapOf(
      "outcome" to "SUGGESTION",
      "targetCode" to suggestedTargetCode,
      "requiresHumanReview" to requiresHumanReview,
      "evidenceTypes" to evidence.map { it.type.name },
      "explanationCode" to explanationCode.name
    )
    is OfflineMappingEvalAbstention -> mapOf(
      "outcome" to "ABSTENTION",
      "reasonCode" to reasonCode.name,
      "evidenceTypes" to evidence.map { it.type.name },
      "explanationCode" to explanationCode.name
    )
    is OfflineMappingEvalPolicyBlock -> mapOf(
      "outcome" to "POLICY_BLOCK",
      "blockCode" to blockCode.name
    )
    is OfflineMappingEvalPreconditionBlock -> mapOf(
      "outcome" to "PRECONDITION_BLOCK",
      "blockCode" to blockCode.name
    )
    is OfflineMappingEvalInvalidInput -> mapOf(
      "outcome" to "INVALID_INPUT",
      "invalidReasons" to invalidReasons.map { it.name }
    )
    is OfflineMappingEvalInvalidModelOutput -> mapOf(
      "outcome" to "INVALID_MODEL_OUTPUT",
      "invalidReasons" to invalidReasons.map { it.name }
    )
    is OfflineMappingEvalProviderFailure -> mapOf(
      "outcome" to "TECHNICAL_FAILURE",
      "failureCode" to failureCode.name
    )
  }

private fun OfflineMappingEvalResult.outcomeName(): String =
  when (this) {
    is OfflineMappingEvalSuggestion -> "SUGGESTION"
    is OfflineMappingEvalAbstention -> "ABSTENTION"
    is OfflineMappingEvalPolicyBlock -> "POLICY_BLOCK"
    is OfflineMappingEvalPreconditionBlock -> "PRECONDITION_BLOCK"
    is OfflineMappingEvalInvalidInput -> "INVALID_INPUT"
    is OfflineMappingEvalInvalidModelOutput -> "INVALID_MODEL_OUTPUT"
    is OfflineMappingEvalProviderFailure -> "TECHNICAL_FAILURE"
  }
