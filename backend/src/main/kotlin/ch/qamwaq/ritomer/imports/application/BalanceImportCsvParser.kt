package ch.qamwaq.ritomer.imports.application

import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import java.io.ByteArrayInputStream
import java.io.InputStreamReader
import java.math.BigDecimal
import java.nio.charset.StandardCharsets
import java.util.LinkedHashSet
import org.apache.commons.csv.CSVFormat
import org.apache.commons.csv.CSVParser
import org.springframework.stereotype.Component

data class ParsedBalanceImport(
  val lines: List<BalanceImportLine>,
  val rowCount: Int,
  val totalDebit: BigDecimal,
  val totalCredit: BigDecimal
)

data class BalanceImportValidationError(
  val line: Int?,
  val field: String?,
  val message: String
)

class BalanceImportBadRequestException(
  message: String,
  val errors: List<BalanceImportValidationError> = emptyList()
) : RuntimeException(message)

@Component
class BalanceImportCsvParser {
  fun parse(content: ByteArray): ParsedBalanceImport {
    if (content.isEmpty()) {
      throw BalanceImportBadRequestException(
        "CSV file must not be empty.",
        listOf(BalanceImportValidationError(line = null, field = "file", message = "CSV file must not be empty."))
      )
    }

    val parser = CSVParser(
      InputStreamReader(ByteArrayInputStream(content), StandardCharsets.UTF_8),
      CSVFormat.DEFAULT.builder()
        .setHeader()
        .setSkipHeaderRecord(true)
        .setIgnoreEmptyLines(true)
        .setTrim(false)
        .build()
    )

    parser.use { csvParser ->
      validateHeader(csvParser.headerNames)

      val errors = mutableListOf<BalanceImportValidationError>()
      val lines = mutableListOf<BalanceImportLine>()
      val seenAccountCodes = LinkedHashSet<String>()
      var totalDebit = BigDecimal.ZERO
      var totalCredit = BigDecimal.ZERO

      csvParser.records.forEach { record ->
        val lineNumber = record.recordNumber.toInt() + 1
        if (record.size() != EXPECTED_HEADERS.size) {
          errors.add(
            BalanceImportValidationError(
              line = lineNumber,
              field = null,
              message = "CSV row must contain exactly ${EXPECTED_HEADERS.size} columns."
            )
          )
          return@forEach
        }

        val accountCode = record.get("accountCode").trim()
        val accountLabel = record.get("accountLabel").trim()
        val debit = parseDecimal(record.get("debit"), "debit", lineNumber, errors)
        val credit = parseDecimal(record.get("credit"), "credit", lineNumber, errors)

        if (accountCode.isEmpty()) {
          errors.add(
            BalanceImportValidationError(
              line = lineNumber,
              field = "accountCode",
              message = "accountCode is required."
            )
          )
        }
        if (accountLabel.isEmpty()) {
          errors.add(
            BalanceImportValidationError(
              line = lineNumber,
              field = "accountLabel",
              message = "accountLabel is required."
            )
          )
        }
        if (accountCode.isNotEmpty() && !seenAccountCodes.add(accountCode)) {
          errors.add(
            BalanceImportValidationError(
              line = lineNumber,
              field = "accountCode",
              message = "Duplicate accountCode '$accountCode' is not allowed."
            )
          )
        }

        if (accountCode.isNotEmpty() && accountLabel.isNotEmpty() && debit != null && credit != null) {
          lines.add(
            BalanceImportLine(
              lineNo = lineNumber,
              accountCode = accountCode,
              accountLabel = accountLabel,
              debit = debit,
              credit = credit
            )
          )
          totalDebit = totalDebit.add(debit)
          totalCredit = totalCredit.add(credit)
        }
      }

      if (lines.isEmpty() && errors.isEmpty()) {
        errors.add(
          BalanceImportValidationError(
            line = null,
            field = "file",
            message = "CSV file must contain at least one data row."
          )
        )
      }
      if (totalDebit.compareTo(totalCredit) != 0) {
        errors.add(
          BalanceImportValidationError(
            line = null,
            field = null,
            message = "Trial balance must be globally balanced: total debit must equal total credit."
          )
        )
      }

      if (errors.isNotEmpty()) {
        throw BalanceImportBadRequestException("CSV validation failed.", errors)
      }

      return ParsedBalanceImport(
        lines = lines,
        rowCount = lines.size,
        totalDebit = totalDebit,
        totalCredit = totalCredit
      )
    }
  }

  private fun validateHeader(headerNames: List<String>) {
    if (headerNames != EXPECTED_HEADERS) {
      throw BalanceImportBadRequestException(
        "CSV header is invalid.",
        listOf(
          BalanceImportValidationError(
            line = 1,
            field = null,
            message = "CSV header must exactly equal ${EXPECTED_HEADERS.joinToString(",")}."
          )
        )
      )
    }
  }

  private fun parseDecimal(
    rawValue: String,
    fieldName: String,
    lineNumber: Int,
    errors: MutableList<BalanceImportValidationError>
  ): BigDecimal? {
    val normalized = rawValue.trim()
    if (!DECIMAL_REGEX.matches(normalized)) {
      errors.add(
        BalanceImportValidationError(
          line = lineNumber,
          field = fieldName,
          message = "$fieldName must be a decimal number using '.' and no thousands separator."
        )
      )
      return null
    }

    val parsed = try {
      BigDecimal(normalized)
    } catch (_: NumberFormatException) {
      errors.add(
        BalanceImportValidationError(
          line = lineNumber,
          field = fieldName,
          message = "$fieldName must be a valid decimal number."
        )
      )
      return null
    }

    if (parsed.signum() < 0) {
      errors.add(
        BalanceImportValidationError(
          line = lineNumber,
          field = fieldName,
          message = "$fieldName must be greater than or equal to 0."
        )
      )
      return null
    }

    return parsed
  }

  companion object {
    private val EXPECTED_HEADERS = listOf("accountCode", "accountLabel", "debit", "credit")
    private val DECIMAL_REGEX = Regex("""^\d+(\.\d+)?$""")
  }
}
