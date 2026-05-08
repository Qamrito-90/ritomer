package ch.qamwaq.ritomer.mapping.application

import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionBalanceSignal
import java.math.BigDecimal
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class MappingSuggestionPayloadMinimizerTest {
  @Test
  fun `sanitizer trims and collapses whitespace`() {
    assertThat(MappingSuggestionPayloadMinimizer.sanitizeAccountLabel("  Bank    CHF \t cash  "))
      .isEqualTo("Bank CHF cash")
  }

  @Test
  fun `sanitizer removes control characters`() {
    assertThat(MappingSuggestionPayloadMinimizer.sanitizeAccountLabel("Bank\u0000 CHF\r\ncash"))
      .isEqualTo("Bank CHF cash")
  }

  @Test
  fun `sanitizer removes emails`() {
    assertThat(MappingSuggestionPayloadMinimizer.sanitizeAccountLabel("Bank john.doe@example.com cash"))
      .isEqualTo("Bank cash")
  }

  @Test
  fun `sanitizer removes urls`() {
    assertThat(MappingSuggestionPayloadMinimizer.sanitizeAccountLabel("Revenue https://client.example/private sales"))
      .isEqualTo("Revenue sales")
  }

  @Test
  fun `sanitizer removes iban like values`() {
    assertThat(MappingSuggestionPayloadMinimizer.sanitizeAccountLabel("Bank CH93 0076 2011 6238 5295 7 cash"))
      .isEqualTo("Bank cash")
  }

  @Test
  fun `sanitizer removes uuids`() {
    assertThat(
      MappingSuggestionPayloadMinimizer.sanitizeAccountLabel(
        "Receivable 550e8400-e29b-41d4-a716-446655440000 client"
      )
    ).isEqualTo("Receivable client")
  }

  @Test
  fun `sanitizer removes phone numbers`() {
    assertThat(MappingSuggestionPayloadMinimizer.sanitizeAccountLabel("Supplier +41 79 123 45 67 payable"))
      .isEqualTo("Supplier payable")
  }

  @Test
  fun `sanitizer removes long numeric references`() {
    assertThat(MappingSuggestionPayloadMinimizer.sanitizeAccountLabel("Revenue ref 987654321012 expense"))
      .isEqualTo("Revenue expense")
  }

  @Test
  fun `sanitizer bounds max length`() {
    val sanitized = MappingSuggestionPayloadMinimizer.sanitizeAccountLabel("cash ".repeat(80))

    assertThat(sanitized.length)
      .isLessThanOrEqualTo(MappingSuggestionPayloadMinimizer.MAX_SANITIZED_ACCOUNT_LABEL_LENGTH)
    assertThat(sanitized).contains("cash")
  }

  @Test
  fun `sanitizer returns explicit fallback for empty or quasi empty labels`() {
    assertThat(MappingSuggestionPayloadMinimizer.sanitizeAccountLabel("john.doe@example.com https://example.test"))
      .isEqualTo(MappingSuggestionPayloadMinimizer.EMPTY_SANITIZED_ACCOUNT_LABEL)
    assertThat(MappingSuggestionPayloadMinimizer.sanitizeAccountLabel("ID"))
      .isEqualTo(MappingSuggestionPayloadMinimizer.EMPTY_SANITIZED_ACCOUNT_LABEL)
  }

  @Test
  fun `sanitizer preserves useful accounting terms`() {
    val sanitized = MappingSuggestionPayloadMinimizer.sanitizeAccountLabel(
      " bank cash receivable payable supplier revenue expense "
    )

    assertThat(sanitized).contains("bank", "cash", "receivable", "payable", "supplier", "revenue", "expense")
  }

  @Test
  fun `balance signal covers debit only`() {
    assertThat(signal("100.00", "0.00")).isEqualTo(AiMappingSuggestionBalanceSignal.DEBIT_ONLY)
  }

  @Test
  fun `balance signal covers credit only`() {
    assertThat(signal("0.00", "100.00")).isEqualTo(AiMappingSuggestionBalanceSignal.CREDIT_ONLY)
  }

  @Test
  fun `balance signal covers debit dominant`() {
    assertThat(signal("150.00", "100.00")).isEqualTo(AiMappingSuggestionBalanceSignal.DEBIT_DOMINANT)
  }

  @Test
  fun `balance signal covers credit dominant`() {
    assertThat(signal("100.00", "150.00")).isEqualTo(AiMappingSuggestionBalanceSignal.CREDIT_DOMINANT)
  }

  @Test
  fun `balance signal covers balanced non zero`() {
    assertThat(signal("100.00", "100.00")).isEqualTo(AiMappingSuggestionBalanceSignal.BALANCED_NON_ZERO)
  }

  @Test
  fun `balance signal covers zero`() {
    assertThat(signal("0.00", "0.00")).isEqualTo(AiMappingSuggestionBalanceSignal.ZERO)
  }

  @Test
  fun `balance signal exposes no raw amount magnitude or reversible ratio`() {
    val signal = signal("12345.67", "123.45")

    assertThat(signal.name).isEqualTo("DEBIT_DOMINANT")
    assertThat(signal.name).doesNotContain("12345", "123", "67", "45", "ratio", "magnitude")
  }

  private fun signal(
    debit: String,
    credit: String
  ): AiMappingSuggestionBalanceSignal =
    MappingSuggestionPayloadMinimizer.deriveBalanceSignal(BigDecimal(debit), BigDecimal(credit))
}
