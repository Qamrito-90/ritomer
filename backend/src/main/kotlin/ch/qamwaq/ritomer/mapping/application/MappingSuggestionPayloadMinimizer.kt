package ch.qamwaq.ritomer.mapping.application

import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionAccount
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionBalanceSignal
import ch.qamwaq.ritomer.mapping.access.ProjectedManualMappingLine
import java.math.BigDecimal

object MappingSuggestionPayloadMinimizer {
  const val MAX_SANITIZED_ACCOUNT_LABEL_LENGTH = 120
  const val EMPTY_SANITIZED_ACCOUNT_LABEL = "sanitized_account_label_unavailable"

  fun minimize(line: ProjectedManualMappingLine): AiMappingSuggestionAccount =
    AiMappingSuggestionAccount(
      accountCode = line.accountCode,
      sanitizedAccountLabel = sanitizeAccountLabel(line.accountLabel),
      balanceSignal = deriveBalanceSignal(line.debit, line.credit)
    )

  fun sanitizeAccountLabel(rawLabel: String): String {
    var sanitized = CONTROL_CHARACTERS.replace(rawLabel, " ")
    REDACTION_PATTERNS.forEach { pattern ->
      sanitized = pattern.replace(sanitized, " ")
    }

    sanitized = WHITESPACE.replace(sanitized, " ").trim()
    sanitized = EDGE_PUNCTUATION.replace(sanitized, "")
    sanitized = WHITESPACE.replace(sanitized, " ").trim()
    sanitized = boundLength(sanitized)

    return if (isQuasiEmpty(sanitized)) {
      EMPTY_SANITIZED_ACCOUNT_LABEL
    } else {
      sanitized
    }
  }

  fun deriveBalanceSignal(
    debit: BigDecimal,
    credit: BigDecimal
  ): AiMappingSuggestionBalanceSignal {
    val debitSign = debit.signum()
    val creditSign = credit.signum()

    return when {
      debitSign == 0 && creditSign == 0 -> AiMappingSuggestionBalanceSignal.ZERO
      debitSign != 0 && creditSign == 0 -> AiMappingSuggestionBalanceSignal.DEBIT_ONLY
      debitSign == 0 && creditSign != 0 -> AiMappingSuggestionBalanceSignal.CREDIT_ONLY
      debit > credit -> AiMappingSuggestionBalanceSignal.DEBIT_DOMINANT
      credit > debit -> AiMappingSuggestionBalanceSignal.CREDIT_DOMINANT
      else -> AiMappingSuggestionBalanceSignal.BALANCED_NON_ZERO
    }
  }

  private fun boundLength(value: String): String {
    if (value.length <= MAX_SANITIZED_ACCOUNT_LABEL_LENGTH) return value

    val bounded = value.take(MAX_SANITIZED_ACCOUNT_LABEL_LENGTH).trim()
    val wordBounded = bounded.substringBeforeLast(" ", bounded).trim()
    return if (wordBounded.length >= MIN_MEANINGFUL_CHARACTERS) wordBounded else bounded
  }

  private fun isQuasiEmpty(value: String): Boolean {
    val normalized = value.lowercase()
    val meaningful = MEANINGFUL_CHARACTERS_ONLY.replace(normalized, "")
    return meaningful.length < MIN_MEANINGFUL_CHARACTERS || normalized in QUASI_EMPTY_LABELS
  }

  private const val MIN_MEANINGFUL_CHARACTERS = 3
  private val CONTROL_CHARACTERS = Regex("""\p{Cc}+""")
  private val WHITESPACE = Regex("""\s+""")
  private val EDGE_PUNCTUATION = Regex("""^[\s,;:|/\\._-]+|[\s,;:|/\\._-]+$""")
  private val MEANINGFUL_CHARACTERS_ONLY = Regex("""[^\p{L}\p{N}]""")
  private val QUASI_EMPTY_LABELS = setOf("id", "n/a", "na", "no", "nr", "number", "ref", "reference")
  private val REDACTION_PATTERNS = listOf(
    Regex("""(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b"""),
    Regex("""(?i)\b(?:https?://|www\.)\S+"""),
    Regex("""(?i)\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b"""),
    Regex("""(?i)\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]){10,29}[ -]?\d\b"""),
    Regex(
      """(?x)
      (?<![\p{L}\p{N}])(?:\+|00)\d(?:[\s().-]*\d){7,}(?![\p{L}\p{N}])
      |
      (?<![\p{L}\p{N}])\d{2,4}(?:[\s().-]+\d{2,4}){2,}(?![\p{L}\p{N}])
      """.trimIndent()
    ),
    Regex("""(?i)\b(?:client|customer|kunde|tenant|actor|user|id|ref|reference|nr|no|number|numero|dossier)\s*[:#/-]?\s*[A-Z0-9][A-Z0-9._/-]{4,}\b"""),
    Regex("""(?<!\d)(?:\d[\s._/-]?){8,}(?!\d)""")
  )
}
