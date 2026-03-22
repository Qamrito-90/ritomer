package ch.qamwaq.ritomer.imports.application

import java.nio.charset.StandardCharsets
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class BalanceImportCsvParserTest {
  private val parser = BalanceImportCsvParser()

  @Test
  fun `parser accepts valid canonical csv`() {
    val parsed = parser.parse(
      """
      accountCode,accountLabel,debit,credit
      1000,Cash,100.00,0.00
      2000,Revenue,0.00,100.00

      """.trimIndent().toByteArray(StandardCharsets.UTF_8)
    )

    assertThat(parsed.rowCount).isEqualTo(2)
    assertThat(parsed.totalDebit.toPlainString()).isEqualTo("100.00")
    assertThat(parsed.totalCredit.toPlainString()).isEqualTo("100.00")
    assertThat(parsed.lines.map { it.accountCode }).containsExactly("1000", "2000")
  }

  @Test
  fun `parser rejects invalid header`() {
    assertThatThrownBy {
      parser.parse(
        """
        account_code,accountLabel,debit,credit
        1000,Cash,10.00,10.00
        """.trimIndent().toByteArray(StandardCharsets.UTF_8)
      )
    }
      .isInstanceOf(BalanceImportBadRequestException::class.java)
      .hasMessage("CSV header is invalid.")
  }

  @Test
  fun `parser rejects duplicate account code and unbalanced totals`() {
    assertThatThrownBy {
      parser.parse(
        """
        accountCode,accountLabel,debit,credit
        1000,Cash,100.00,0.00
        1000,Cash duplicate,0.00,10.00
        """.trimIndent().toByteArray(StandardCharsets.UTF_8)
      )
    }
      .isInstanceOfSatisfying(BalanceImportBadRequestException::class.java) { exception ->
        assertThat(exception.errors.map { it.message })
          .anyMatch { it.contains("Duplicate accountCode") }
          .anyMatch { it.contains("globally balanced") }
      }
  }

  @Test
  fun `parser rejects negative and malformed decimals`() {
    assertThatThrownBy {
      parser.parse(
        """
        accountCode,accountLabel,debit,credit
        1000,Cash,-1.00,0.00
        2000,Revenue,0.00,1e3
        """.trimIndent().toByteArray(StandardCharsets.UTF_8)
      )
    }
      .isInstanceOfSatisfying(BalanceImportBadRequestException::class.java) { exception ->
        assertThat(exception.errors.map { it.field }).contains("debit", "credit")
      }
  }
}
