package ch.qamwaq.ritomer.financials.api

import ch.qamwaq.ritomer.financials.application.BalanceSheetSummary
import ch.qamwaq.ritomer.financials.application.ClosingFinancialSummary
import ch.qamwaq.ritomer.financials.application.FinancialSummaryBlocker
import ch.qamwaq.ritomer.financials.application.FinancialSummaryCoverage
import ch.qamwaq.ritomer.financials.application.FinancialSummaryNextAction
import ch.qamwaq.ritomer.financials.application.FinancialSummaryService
import ch.qamwaq.ritomer.financials.application.FinancialSummaryState
import ch.qamwaq.ritomer.financials.application.IncomeStatementSummary
import ch.qamwaq.ritomer.financials.application.UnmappedBalanceImpact
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.identity.access.TenantAccessResolver
import com.fasterxml.jackson.annotation.JsonInclude
import java.math.BigDecimal
import java.util.UUID
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@Validated
@RestController
@RequestMapping("/api/closing-folders/{closingFolderId}/financial-summary")
class FinancialSummaryController(
  private val tenantAccessResolver: TenantAccessResolver,
  private val financialSummaryService: FinancialSummaryService
) {
  @GetMapping
  fun getFinancialSummary(
    @PathVariable closingFolderId: UUID
  ): FinancialSummaryResponse =
    financialSummaryService.getFinancialSummary(resolveTenantAccess(), closingFolderId).toResponse()

  private fun resolveTenantAccess(): TenantAccessContext =
    tenantAccessResolver.resolveRequiredTenantAccess()
}

@JsonInclude(JsonInclude.Include.ALWAYS)
data class FinancialSummaryResponse(
  val closingFolderId: String,
  val closingFolderStatus: String,
  val readiness: String,
  val statementState: String,
  val latestImportVersion: Int?,
  val coverage: FinancialSummaryCoverageResponse,
  val blockers: List<FinancialSummaryBlockerResponse>,
  val nextAction: FinancialSummaryNextActionResponse?,
  val unmappedBalanceImpact: UnmappedBalanceImpactResponse,
  val balanceSheetSummary: BalanceSheetSummaryResponse?,
  val incomeStatementSummary: IncomeStatementSummaryResponse?
)

data class FinancialSummaryCoverageResponse(
  val totalLines: Int,
  val mappedLines: Int,
  val unmappedLines: Int,
  val mappedShare: String
)

data class FinancialSummaryBlockerResponse(
  val code: String,
  val message: String
)

data class FinancialSummaryNextActionResponse(
  val code: String,
  val path: String,
  val actionable: Boolean
)

data class UnmappedBalanceImpactResponse(
  val debitTotal: String,
  val creditTotal: String,
  val netDebitMinusCredit: String
)

data class BalanceSheetSummaryResponse(
  val assets: String,
  val liabilities: String,
  val equity: String,
  val currentPeriodResult: String,
  val totalAssets: String,
  val totalLiabilitiesAndEquity: String
)

data class IncomeStatementSummaryResponse(
  val revenue: String,
  val expenses: String,
  val netResult: String
)

private fun ClosingFinancialSummary.toResponse(): FinancialSummaryResponse =
  FinancialSummaryResponse(
    closingFolderId = closingFolderId.toString(),
    closingFolderStatus = closingFolderStatus,
    readiness = readiness,
    statementState = statementState.toResponseValue(),
    latestImportVersion = latestImportVersion,
    coverage = coverage.toResponse(),
    blockers = blockers.map { it.toResponse() },
    nextAction = nextAction?.toResponse(),
    unmappedBalanceImpact = unmappedBalanceImpact.toResponse(),
    balanceSheetSummary = balanceSheetSummary?.toResponse(),
    incomeStatementSummary = incomeStatementSummary?.toResponse()
  )

private fun FinancialSummaryCoverage.toResponse(): FinancialSummaryCoverageResponse =
  FinancialSummaryCoverageResponse(
    totalLines = totalLines,
    mappedLines = mappedLines,
    unmappedLines = unmappedLines,
    mappedShare = mappedShare.toApiDecimal()
  )

private fun FinancialSummaryBlocker.toResponse(): FinancialSummaryBlockerResponse =
  FinancialSummaryBlockerResponse(
    code = code,
    message = message
  )

private fun FinancialSummaryNextAction.toResponse(): FinancialSummaryNextActionResponse =
  FinancialSummaryNextActionResponse(
    code = code.name,
    path = path,
    actionable = actionable
  )

private fun UnmappedBalanceImpact.toResponse(): UnmappedBalanceImpactResponse =
  UnmappedBalanceImpactResponse(
    debitTotal = debitTotal.toApiDecimal(),
    creditTotal = creditTotal.toApiDecimal(),
    netDebitMinusCredit = netDebitMinusCredit.toApiDecimal()
  )

private fun BalanceSheetSummary.toResponse(): BalanceSheetSummaryResponse =
  BalanceSheetSummaryResponse(
    assets = assets.toApiDecimal(),
    liabilities = liabilities.toApiDecimal(),
    equity = equity.toApiDecimal(),
    currentPeriodResult = currentPeriodResult.toApiDecimal(),
    totalAssets = totalAssets.toApiDecimal(),
    totalLiabilitiesAndEquity = totalLiabilitiesAndEquity.toApiDecimal()
  )

private fun IncomeStatementSummary.toResponse(): IncomeStatementSummaryResponse =
  IncomeStatementSummaryResponse(
    revenue = revenue.toApiDecimal(),
    expenses = expenses.toApiDecimal(),
    netResult = netResult.toApiDecimal()
  )

private fun FinancialSummaryState.toResponseValue(): String = name

private fun BigDecimal.toApiDecimal(): String = stripTrailingZeros().toPlainString()
