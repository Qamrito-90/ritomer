package ch.qamwaq.ritomer.financials.application

import ch.qamwaq.ritomer.controls.access.ControlsAccess
import ch.qamwaq.ritomer.controls.access.ControlsBlocker
import ch.qamwaq.ritomer.controls.access.ControlsNextActionView
import ch.qamwaq.ritomer.controls.access.ControlsNextActionViewCode
import ch.qamwaq.ritomer.controls.access.ControlsReadiness
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.mapping.access.ManualMappingAccess
import ch.qamwaq.ritomer.mapping.access.ProjectedManualMappingLine
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.UUID
import org.springframework.stereotype.Service

data class ClosingFinancialSummary(
  val closingFolderId: UUID,
  val closingFolderStatus: String,
  val readiness: String,
  val statementState: FinancialSummaryState,
  val latestImportVersion: Int?,
  val coverage: FinancialSummaryCoverage,
  val blockers: List<FinancialSummaryBlocker>,
  val nextAction: FinancialSummaryNextAction?,
  val unmappedBalanceImpact: UnmappedBalanceImpact,
  val balanceSheetSummary: BalanceSheetSummary?,
  val incomeStatementSummary: IncomeStatementSummary?
)

data class FinancialSummaryCoverage(
  val totalLines: Int,
  val mappedLines: Int,
  val unmappedLines: Int,
  val mappedShare: BigDecimal
)

data class FinancialSummaryBlocker(
  val code: String,
  val message: String
)

data class FinancialSummaryNextAction(
  val code: FinancialSummaryNextActionCode,
  val path: String,
  val actionable: Boolean
)

data class UnmappedBalanceImpact(
  val debitTotal: BigDecimal,
  val creditTotal: BigDecimal,
  val netDebitMinusCredit: BigDecimal
)

data class BalanceSheetSummary(
  val assets: BigDecimal,
  val liabilities: BigDecimal,
  val equity: BigDecimal,
  val currentPeriodResult: BigDecimal,
  val totalAssets: BigDecimal,
  val totalLiabilitiesAndEquity: BigDecimal
)

data class IncomeStatementSummary(
  val revenue: BigDecimal,
  val expenses: BigDecimal,
  val netResult: BigDecimal
)

enum class FinancialSummaryState {
  NO_DATA,
  PREVIEW_PARTIAL,
  PREVIEW_READY
}

enum class FinancialSummaryNextActionCode {
  IMPORT_BALANCE,
  COMPLETE_MANUAL_MAPPING
}

@Service
class FinancialSummaryService(
  private val controlsAccess: ControlsAccess,
  private val manualMappingAccess: ManualMappingAccess
) {
  fun getFinancialSummary(access: TenantAccessContext, closingFolderId: UUID): ClosingFinancialSummary {
    val controls = controlsAccess.getSnapshot(access, closingFolderId)
    val projection = manualMappingAccess.getCurrentProjection(access.tenantId, closingFolderId)
    val mappedSummaryBucketsByAccountCode = projection.mappings.associateBy({ it.accountCode }, { it.summaryBucketCode })

    val statementState = when {
      projection.latestImportVersion == null -> FinancialSummaryState.NO_DATA
      controls.readiness == ControlsReadiness.READY -> FinancialSummaryState.PREVIEW_READY
      else -> FinancialSummaryState.PREVIEW_PARTIAL
    }

    val mappedLines = projection.lines.filter { it.accountCode in mappedSummaryBucketsByAccountCode }
    val unmappedLines = projection.lines.filter { it.accountCode !in mappedSummaryBucketsByAccountCode }
    val coverage = FinancialSummaryCoverage(
      totalLines = projection.lines.size,
      mappedLines = mappedLines.size,
      unmappedLines = unmappedLines.size,
      mappedShare = mappedShare(
        totalLines = projection.lines.size,
        mappedLines = mappedLines.size,
        statementState = statementState
      )
    )
    val unmappedBalanceImpact = UnmappedBalanceImpact(
      debitTotal = unmappedLines.sumOf { it.debit },
      creditTotal = unmappedLines.sumOf { it.credit },
      netDebitMinusCredit = unmappedLines.sumOf { it.debit - it.credit }
    )

    val aggregated = mappedLines.fold(FinancialAmounts.zero()) { totals, line ->
      totals.add(line, mappedSummaryBucketsByAccountCode.getValue(line.accountCode))
    }
    val incomeStatementSummary = if (statementState == FinancialSummaryState.NO_DATA) {
      null
    } else {
      IncomeStatementSummary(
        revenue = aggregated.revenue,
        expenses = aggregated.expenses,
        netResult = aggregated.netResult()
      )
    }
    val balanceSheetSummary = if (statementState == FinancialSummaryState.NO_DATA) {
      null
    } else {
      BalanceSheetSummary(
        assets = aggregated.assets,
        liabilities = aggregated.liabilities,
        equity = aggregated.equity,
        currentPeriodResult = aggregated.netResult(),
        totalAssets = aggregated.assets,
        totalLiabilitiesAndEquity = aggregated.liabilities + aggregated.equity + aggregated.netResult()
      )
    }

    return ClosingFinancialSummary(
      closingFolderId = closingFolderId,
      closingFolderStatus = controls.closingFolderStatus.name,
      readiness = controls.readiness.name,
      statementState = statementState,
      latestImportVersion = projection.latestImportVersion,
      coverage = coverage,
      blockers = controls.blockers.map { it.toBlocker() },
      nextAction = controls.nextAction?.toNextAction(),
      unmappedBalanceImpact = unmappedBalanceImpact,
      balanceSheetSummary = balanceSheetSummary,
      incomeStatementSummary = incomeStatementSummary
    )
  }

  private fun mappedShare(
    totalLines: Int,
    mappedLines: Int,
    statementState: FinancialSummaryState
  ): BigDecimal =
    when {
      totalLines == 0 && statementState == FinancialSummaryState.NO_DATA -> BigDecimal.ZERO
      totalLines == 0 && statementState == FinancialSummaryState.PREVIEW_READY -> BigDecimal.ONE
      totalLines == 0 -> BigDecimal.ZERO
      else -> BigDecimal(mappedLines).divide(BigDecimal(totalLines), 4, RoundingMode.HALF_UP).stripTrailingZeros()
    }

  private fun ControlsBlocker.toBlocker(): FinancialSummaryBlocker =
    FinancialSummaryBlocker(
      code = code,
      message = message
    )

  private fun ControlsNextActionView.toNextAction(): FinancialSummaryNextAction =
    FinancialSummaryNextAction(
      code = code.toFinancialSummaryCode(),
      path = path,
      actionable = actionable
    )

  private fun ControlsNextActionViewCode.toFinancialSummaryCode(): FinancialSummaryNextActionCode =
    when (this) {
      ControlsNextActionViewCode.IMPORT_BALANCE -> FinancialSummaryNextActionCode.IMPORT_BALANCE
      ControlsNextActionViewCode.COMPLETE_MANUAL_MAPPING -> FinancialSummaryNextActionCode.COMPLETE_MANUAL_MAPPING
    }

  private data class FinancialAmounts(
    val assets: BigDecimal,
    val liabilities: BigDecimal,
    val equity: BigDecimal,
    val revenue: BigDecimal,
    val expenses: BigDecimal
  ) {
    fun add(line: ProjectedManualMappingLine, summaryBucketCode: String): FinancialAmounts =
      when (summaryBucketCode) {
        SUMMARY_BUCKET_ASSET -> copy(assets = assets + (line.debit - line.credit))
        SUMMARY_BUCKET_LIABILITY -> copy(liabilities = liabilities + (line.credit - line.debit))
        SUMMARY_BUCKET_EQUITY -> copy(equity = equity + (line.credit - line.debit))
        SUMMARY_BUCKET_REVENUE -> copy(revenue = revenue + (line.credit - line.debit))
        SUMMARY_BUCKET_EXPENSE -> copy(expenses = expenses + (line.debit - line.credit))
        else -> error("Unsupported summary bucket code: $summaryBucketCode")
      }

    fun netResult(): BigDecimal = revenue - expenses

    companion object {
      private const val SUMMARY_BUCKET_ASSET = "BS.ASSET"
      private const val SUMMARY_BUCKET_LIABILITY = "BS.LIABILITY"
      private const val SUMMARY_BUCKET_EQUITY = "BS.EQUITY"
      private const val SUMMARY_BUCKET_REVENUE = "PL.REVENUE"
      private const val SUMMARY_BUCKET_EXPENSE = "PL.EXPENSE"

      fun zero(): FinancialAmounts =
        FinancialAmounts(
          assets = BigDecimal.ZERO,
          liabilities = BigDecimal.ZERO,
          equity = BigDecimal.ZERO,
          revenue = BigDecimal.ZERO,
          expenses = BigDecimal.ZERO
        )
    }
  }
}
