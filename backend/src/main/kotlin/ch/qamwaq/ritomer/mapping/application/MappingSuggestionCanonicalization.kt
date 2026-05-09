package ch.qamwaq.ritomer.mapping.application

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.text.Normalizer
import java.util.Locale
import java.util.UUID

object MappingSuggestionFingerprints {
  fun calculate(
    latestImportVersion: Int,
    taxonomyVersion: Int,
    suggestion: MappingSuggestion
  ): String {
    val evidenceLines = suggestion.evidence
      .sortedWith(compareBy<MappingSuggestionEvidence> { it.type.name }.thenBy { it.ref })
      .flatMapIndexed { index, evidence ->
        listOf(
          "evidence[$index].type=${evidence.type.name}",
          "evidence[$index].ref=${evidence.ref.trim()}"
        )
      }

    return sha256Hex(
      (
        listOf(
          "mapping-suggestion-fingerprint-v1",
          "latestImportVersion=$latestImportVersion",
          "taxonomyVersion=$taxonomyVersion",
          "accountCode=${suggestion.accountCode.trim()}",
          "suggestedTargetCode=${suggestion.suggestedTargetCode.trim()}",
          "riskLevel=${suggestion.riskLevel.name}",
          "confidence=${String.format(Locale.ROOT, "%.6f", suggestion.confidence)}",
          "schemaVersion=${suggestion.schemaVersion}",
          "promptVersion=${suggestion.promptVersion}",
          "modelVersion=${suggestion.modelVersion}"
        ) + evidenceLines
        ).joinToString("\n")
    )
  }
}

object MappingSuggestionDecisionPayloads {
  fun hash(payload: NormalizedMappingSuggestionDecisionPayload): String =
    sha256Hex(canonicalString(payload))

  fun canonicalString(payload: NormalizedMappingSuggestionDecisionPayload): String =
    listOf(
      "mapping-suggestion-decision-payload-v1",
      "decision=${payload.decision.name}",
      "closingFolderId=${payload.closingFolderId.toString().lowercase(Locale.ROOT)}",
      "accountCode=${payload.accountCode}",
      "latestImportVersion=${payload.latestImportVersion}",
      "targetCode=${payload.targetCode ?: ABSENT_VALUE}",
      "reviewComment=${payload.reviewComment ?: ABSENT_VALUE}",
      "suggestionFingerprint=${payload.suggestionFingerprint}"
    ).joinToString("\n")

  fun normalizeReviewComment(rawValue: String?): String? {
    if (rawValue == null) {
      return null
    }
    if (rawValue.hasForbiddenControlCharacters()) {
      throw MappingSuggestionDecisionBadRequestException("reviewComment contains unsupported control characters.")
    }
    val normalized = Normalizer.normalize(rawValue, Normalizer.Form.NFC)
      .trim()
      .replace(WHITESPACE_REGEX, " ")
      .takeUnless { it.isBlank() }
      ?: return null

    if (normalized.length > MAX_REVIEW_COMMENT_LENGTH) {
      throw MappingSuggestionDecisionBadRequestException("reviewComment must be at most 600 characters.")
    }
    return normalized
  }

  private const val ABSENT_VALUE = "~"
  private const val MAX_REVIEW_COMMENT_LENGTH = 600
  private val WHITESPACE_REGEX = Regex("\\s+")
}

data class NormalizedMappingSuggestionDecisionPayload(
  val decision: MappingSuggestionHumanDecision,
  val closingFolderId: UUID,
  val accountCode: String,
  val latestImportVersion: Int,
  val targetCode: String?,
  val reviewComment: String?,
  val suggestionFingerprint: String
)

internal fun sha256Hex(value: String): String =
  MessageDigest.getInstance("SHA-256")
    .digest(value.toByteArray(StandardCharsets.UTF_8))
    .joinToString("") { "%02x".format(it) }

internal fun String.hasForbiddenControlCharacters(): Boolean =
  any { character ->
    character.code == 127 || (character.code < 32 && !character.isWhitespace())
  }
