package ch.qamwaq.ritomer.financials.access

import ch.qamwaq.ritomer.financials.application.BalanceSheetSummary
import ch.qamwaq.ritomer.financials.application.ClosingFinancialSummary
import ch.qamwaq.ritomer.financials.application.ClosingStructuredFinancialStatements
import ch.qamwaq.ritomer.financials.application.FinancialStatementsStructuredService
import ch.qamwaq.ritomer.financials.application.FinancialSummaryBlocker
import ch.qamwaq.ritomer.financials.application.FinancialSummaryCoverage
import ch.qamwaq.ritomer.financials.application.FinancialSummaryNextAction
import ch.qamwaq.ritomer.financials.application.FinancialSummaryService
import ch.qamwaq.ritomer.financials.application.FinancialSummaryState
import ch.qamwaq.ritomer.financials.application.IncomeStatementSummary
import ch.qamwaq.ritomer.financials.application.StructuredBalanceSheet
import ch.qamwaq.ritomer.financials.application.StructuredBalanceSheetTotals
import ch.qamwaq.ritomer.financials.application.StructuredFinancialBlocker
import ch.qamwaq.ritomer.financials.application.StructuredFinancialCoverage
import ch.qamwaq.ritomer.financials.application.StructuredFinancialNextAction
import ch.qamwaq.ritomer.financials.application.StructuredFinancialPresentationType
import ch.qamwaq.ritomer.financials.application.StructuredFinancialStatementState
import ch.qamwaq.ritomer.financials.application.StructuredIncomeStatement
import ch.qamwaq.ritomer.financials.application.StructuredIncomeStatementTotals
import ch.qamwaq.ritomer.financials.application.StructuredStatementBreakdown
import ch.qamwaq.ritomer.financials.application.StructuredStatementGroup
import ch.qamwaq.ritomer.financials.application.UnmappedBalanceImpact
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import java.math.BigDecimal
import java.util.UUID
import org.springframework.stereotype.Service

data class FinancialSummaryReadModel(
  val closingFolderId: String,
  val closingFolderStatus: String,
  val readiness: String,
  val statementState: String,
  val latestImportVersion: Int?,
  val coverage: FinancialSummaryCoverageReadModel,
  val blockers: List<FinancialSummaryBlockerReadModel>,
  val nextAction: FinancialSummaryNextActionReadModel?,
  val unmappedBalanceImpact: UnmappedBalanceImpactReadModel,
  val balanceSheetSummary: BalanceSheetSummaryReadModel?,
  val incomeStatementSummary: IncomeStatementSummaryReadModel?
)

data class FinancialSummaryCoverageReadModel(
  val totalLines: Int,
  val mappedLines: Int,
  val unmappedLines: Int,
  val mappedShare: String
)

data class FinancialSummaryBlockerReadModel(
  val code: String,
  val message: String
)

data class FinancialSummaryNextActionReadModel(
  val code: String,
  val path: String,
  val actionable: Boolean
)

data class UnmappedBalanceImpactReadModel(
  val debitTotal: String,
  val creditTotal: String,
  val netDebitMinusCredit: String
)

data class BalanceSheetSummaryReadModel(
  val assets: String,
  val liabilities: String,
  val equity: String,
  val currentPeriodResult: String,
  val totalAssets: String,
  val totalLiabilitiesAndEquity: String
)

data class IncomeStatementSummaryReadModel(
  val revenue: String,
  val expenses: String,
  val netResult: String
)

data class StructuredFinancialStatementsReadModel(
  val closingFolderId: String,
  val closingFolderStatus: String,
  val readiness: String,
  val statementState: String,
  val presentationType: String,
  val isStatutory: Boolean,
  val taxonomyVersion: Int,
  val latestImportVersion: Int?,
  val coverage: StructuredFinancialCoverageReadModel,
  val blockers: List<StructuredFinancialBlockerReadModel>,
  val nextAction: StructuredFinancialNextActionReadModel?,
  val balanceSheet: StructuredBalanceSheetReadModel?,
  val incomeStatement: StructuredIncomeStatementReadModel?
)

data class StructuredFinancialCoverageReadModel(
  val totalLines: Int,
  val mappedLines: Int,
  val unmappedLines: Int,
  val mappedShare: String
)

data class StructuredFinancialBlockerReadModel(
  val code: String,
  val message: String
)

data class StructuredFinancialNextActionReadModel(
  val code: String,
  val path: String,
  val actionable: Boolean
)

data class StructuredBalanceSheetReadModel(
  val groups: List<StructuredStatementGroupReadModel>,
  val totals: StructuredBalanceSheetTotalsReadModel
)

data class StructuredIncomeStatementReadModel(
  val groups: List<StructuredStatementGroupReadModel>,
  val totals: StructuredIncomeStatementTotalsReadModel
)

data class StructuredStatementGroupReadModel(
  val code: String,
  val label: String,
  val total: String,
  val breakdowns: List<StructuredStatementBreakdownReadModel>
)

data class StructuredStatementBreakdownReadModel(
  val code: String,
  val label: String,
  val breakdownType: String,
  val total: String
)

data class StructuredBalanceSheetTotalsReadModel(
  val totalAssets: String,
  val totalLiabilities: String,
  val totalEquity: String,
  val currentPeriodResult: String,
  val totalLiabilitiesAndEquity: String
)

data class StructuredIncomeStatementTotalsReadModel(
  val totalRevenue: String,
  val totalExpenses: String,
  val netResult: String
)

fun interface FinancialSummaryReadModelAccess {
  fun getReadModel(access: TenantAccessContext, closingFolderId: UUID): FinancialSummaryReadModel
}

fun interface StructuredFinancialStatementsReadModelAccess {
  fun getReadModel(access: TenantAccessContext, closingFolderId: UUID): StructuredFinancialStatementsReadModel
}

@Service
class ServiceBackedFinancialSummaryReadModelAccess(
  private val financialSummaryService: FinancialSummaryService
) : FinancialSummaryReadModelAccess {
  override fun getReadModel(access: TenantAccessContext, closingFolderId: UUID): FinancialSummaryReadModel =
    financialSummaryService.getFinancialSummary(access, closingFolderId).toReadModel()
}

@Service
class ServiceBackedStructuredFinancialStatementsReadModelAccess(
  private val financialStatementsStructuredService: FinancialStatementsStructuredService
) : StructuredFinancialStatementsReadModelAccess {
  override fun getReadModel(access: TenantAccessContext, closingFolderId: UUID): StructuredFinancialStatementsReadModel =
    financialStatementsStructuredService.getStructuredStatements(access, closingFolderId).toReadModel()
}

private fun ClosingFinancialSummary.toReadModel(): FinancialSummaryReadModel =
  FinancialSummaryReadModel(
    closingFolderId = closingFolderId.toString(),
    closingFolderStatus = closingFolderStatus,
    readiness = readiness,
    statementState = statementState.toResponseValue(),
    latestImportVersion = latestImportVersion,
    coverage = coverage.toReadModel(),
    blockers = blockers.map { it.toReadModel() },
    nextAction = nextAction?.toReadModel(),
    unmappedBalanceImpact = unmappedBalanceImpact.toReadModel(),
    balanceSheetSummary = balanceSheetSummary?.toReadModel(),
    incomeStatementSummary = incomeStatementSummary?.toReadModel()
  )

private fun FinancialSummaryCoverage.toReadModel(): FinancialSummaryCoverageReadModel =
  FinancialSummaryCoverageReadModel(
    totalLines = totalLines,
    mappedLines = mappedLines,
    unmappedLines = unmappedLines,
    mappedShare = mappedShare.toApiDecimal()
  )

private fun FinancialSummaryBlocker.toReadModel(): FinancialSummaryBlockerReadModel =
  FinancialSummaryBlockerReadModel(code = code, message = message)

private fun FinancialSummaryNextAction.toReadModel(): FinancialSummaryNextActionReadModel =
  FinancialSummaryNextActionReadModel(code = code.name, path = path, actionable = actionable)

private fun UnmappedBalanceImpact.toReadModel(): UnmappedBalanceImpactReadModel =
  UnmappedBalanceImpactReadModel(
    debitTotal = debitTotal.toApiDecimal(),
    creditTotal = creditTotal.toApiDecimal(),
    netDebitMinusCredit = netDebitMinusCredit.toApiDecimal()
  )

private fun BalanceSheetSummary.toReadModel(): BalanceSheetSummaryReadModel =
  BalanceSheetSummaryReadModel(
    assets = assets.toApiDecimal(),
    liabilities = liabilities.toApiDecimal(),
    equity = equity.toApiDecimal(),
    currentPeriodResult = currentPeriodResult.toApiDecimal(),
    totalAssets = totalAssets.toApiDecimal(),
    totalLiabilitiesAndEquity = totalLiabilitiesAndEquity.toApiDecimal()
  )

private fun IncomeStatementSummary.toReadModel(): IncomeStatementSummaryReadModel =
  IncomeStatementSummaryReadModel(
    revenue = revenue.toApiDecimal(),
    expenses = expenses.toApiDecimal(),
    netResult = netResult.toApiDecimal()
  )

private fun ClosingStructuredFinancialStatements.toReadModel(): StructuredFinancialStatementsReadModel =
  StructuredFinancialStatementsReadModel(
    closingFolderId = closingFolderId.toString(),
    closingFolderStatus = closingFolderStatus,
    readiness = readiness,
    statementState = statementState.toResponseValue(),
    presentationType = presentationType.toResponseValue(),
    isStatutory = isStatutory,
    taxonomyVersion = taxonomyVersion,
    latestImportVersion = latestImportVersion,
    coverage = coverage.toReadModel(),
    blockers = blockers.map { it.toReadModel() },
    nextAction = nextAction?.toReadModel(),
    balanceSheet = balanceSheet?.toReadModel(),
    incomeStatement = incomeStatement?.toReadModel()
  )

private fun StructuredFinancialCoverage.toReadModel(): StructuredFinancialCoverageReadModel =
  StructuredFinancialCoverageReadModel(
    totalLines = totalLines,
    mappedLines = mappedLines,
    unmappedLines = unmappedLines,
    mappedShare = mappedShare.toApiDecimal()
  )

private fun StructuredFinancialBlocker.toReadModel(): StructuredFinancialBlockerReadModel =
  StructuredFinancialBlockerReadModel(code = code, message = message)

private fun StructuredFinancialNextAction.toReadModel(): StructuredFinancialNextActionReadModel =
  StructuredFinancialNextActionReadModel(code = code.name, path = path, actionable = actionable)

private fun StructuredBalanceSheet.toReadModel(): StructuredBalanceSheetReadModel =
  StructuredBalanceSheetReadModel(
    groups = groups.map { it.toReadModel() },
    totals = totals.toReadModel()
  )

private fun StructuredIncomeStatement.toReadModel(): StructuredIncomeStatementReadModel =
  StructuredIncomeStatementReadModel(
    groups = groups.map { it.toReadModel() },
    totals = totals.toReadModel()
  )

private fun StructuredStatementGroup.toReadModel(): StructuredStatementGroupReadModel =
  StructuredStatementGroupReadModel(
    code = code,
    label = label,
    total = total.toApiDecimal(),
    breakdowns = breakdowns.map { it.toReadModel() }
  )

private fun StructuredStatementBreakdown.toReadModel(): StructuredStatementBreakdownReadModel =
  StructuredStatementBreakdownReadModel(
    code = code,
    label = label,
    breakdownType = breakdownType.name,
    total = total.toApiDecimal()
  )

private fun StructuredBalanceSheetTotals.toReadModel(): StructuredBalanceSheetTotalsReadModel =
  StructuredBalanceSheetTotalsReadModel(
    totalAssets = totalAssets.toApiDecimal(),
    totalLiabilities = totalLiabilities.toApiDecimal(),
    totalEquity = totalEquity.toApiDecimal(),
    currentPeriodResult = currentPeriodResult.toApiDecimal(),
    totalLiabilitiesAndEquity = totalLiabilitiesAndEquity.toApiDecimal()
  )

private fun StructuredIncomeStatementTotals.toReadModel(): StructuredIncomeStatementTotalsReadModel =
  StructuredIncomeStatementTotalsReadModel(
    totalRevenue = totalRevenue.toApiDecimal(),
    totalExpenses = totalExpenses.toApiDecimal(),
    netResult = netResult.toApiDecimal()
  )

private fun FinancialSummaryState.toResponseValue(): String = name

private fun StructuredFinancialStatementState.toResponseValue(): String = name

private fun StructuredFinancialPresentationType.toResponseValue(): String = name

private fun BigDecimal.toApiDecimal(): String = stripTrailingZeros().toPlainString()
