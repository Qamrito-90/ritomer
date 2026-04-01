package ch.qamwaq.ritomer.financials.api

import ch.qamwaq.ritomer.financials.application.ClosingStructuredFinancialStatements
import ch.qamwaq.ritomer.financials.application.FinancialStatementsStructuredService
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
@RequestMapping("/api/closing-folders/{closingFolderId}/financial-statements/structured")
class FinancialStatementsStructuredController(
  private val tenantAccessResolver: TenantAccessResolver,
  private val financialStatementsStructuredService: FinancialStatementsStructuredService
) {
  @GetMapping
  fun getStructuredStatements(
    @PathVariable closingFolderId: UUID
  ): StructuredFinancialStatementsResponse =
    financialStatementsStructuredService.getStructuredStatements(resolveTenantAccess(), closingFolderId).toResponse()

  private fun resolveTenantAccess(): TenantAccessContext =
    tenantAccessResolver.resolveRequiredTenantAccess()
}

@JsonInclude(JsonInclude.Include.ALWAYS)
data class StructuredFinancialStatementsResponse(
  val closingFolderId: String,
  val closingFolderStatus: String,
  val readiness: String,
  val statementState: String,
  val presentationType: String,
  val isStatutory: Boolean,
  val taxonomyVersion: Int,
  val latestImportVersion: Int?,
  val coverage: StructuredFinancialCoverageResponse,
  val blockers: List<StructuredFinancialBlockerResponse>,
  val nextAction: StructuredFinancialNextActionResponse?,
  val balanceSheet: StructuredBalanceSheetResponse?,
  val incomeStatement: StructuredIncomeStatementResponse?
)

data class StructuredFinancialCoverageResponse(
  val totalLines: Int,
  val mappedLines: Int,
  val unmappedLines: Int,
  val mappedShare: String
)

data class StructuredFinancialBlockerResponse(
  val code: String,
  val message: String
)

data class StructuredFinancialNextActionResponse(
  val code: String,
  val path: String,
  val actionable: Boolean
)

data class StructuredBalanceSheetResponse(
  val groups: List<StructuredStatementGroupResponse>,
  val totals: StructuredBalanceSheetTotalsResponse
)

data class StructuredIncomeStatementResponse(
  val groups: List<StructuredStatementGroupResponse>,
  val totals: StructuredIncomeStatementTotalsResponse
)

data class StructuredStatementGroupResponse(
  val code: String,
  val label: String,
  val total: String,
  val breakdowns: List<StructuredStatementBreakdownResponse>
)

data class StructuredStatementBreakdownResponse(
  val code: String,
  val label: String,
  val breakdownType: String,
  val total: String
)

data class StructuredBalanceSheetTotalsResponse(
  val totalAssets: String,
  val totalLiabilities: String,
  val totalEquity: String,
  val currentPeriodResult: String,
  val totalLiabilitiesAndEquity: String
)

data class StructuredIncomeStatementTotalsResponse(
  val totalRevenue: String,
  val totalExpenses: String,
  val netResult: String
)

private fun ClosingStructuredFinancialStatements.toResponse(): StructuredFinancialStatementsResponse =
  StructuredFinancialStatementsResponse(
    closingFolderId = closingFolderId.toString(),
    closingFolderStatus = closingFolderStatus,
    readiness = readiness,
    statementState = statementState.toResponseValue(),
    presentationType = presentationType.toResponseValue(),
    isStatutory = isStatutory,
    taxonomyVersion = taxonomyVersion,
    latestImportVersion = latestImportVersion,
    coverage = coverage.toResponse(),
    blockers = blockers.map { it.toResponse() },
    nextAction = nextAction?.toResponse(),
    balanceSheet = balanceSheet?.toResponse(),
    incomeStatement = incomeStatement?.toResponse()
  )

private fun StructuredFinancialCoverage.toResponse(): StructuredFinancialCoverageResponse =
  StructuredFinancialCoverageResponse(
    totalLines = totalLines,
    mappedLines = mappedLines,
    unmappedLines = unmappedLines,
    mappedShare = mappedShare.toApiDecimal()
  )

private fun StructuredFinancialBlocker.toResponse(): StructuredFinancialBlockerResponse =
  StructuredFinancialBlockerResponse(
    code = code,
    message = message
  )

private fun StructuredFinancialNextAction.toResponse(): StructuredFinancialNextActionResponse =
  StructuredFinancialNextActionResponse(
    code = code.name,
    path = path,
    actionable = actionable
  )

private fun StructuredBalanceSheet.toResponse(): StructuredBalanceSheetResponse =
  StructuredBalanceSheetResponse(
    groups = groups.map { it.toResponse() },
    totals = totals.toResponse()
  )

private fun StructuredIncomeStatement.toResponse(): StructuredIncomeStatementResponse =
  StructuredIncomeStatementResponse(
    groups = groups.map { it.toResponse() },
    totals = totals.toResponse()
  )

private fun StructuredStatementGroup.toResponse(): StructuredStatementGroupResponse =
  StructuredStatementGroupResponse(
    code = code,
    label = label,
    total = total.toApiDecimal(),
    breakdowns = breakdowns.map { it.toResponse() }
  )

private fun StructuredStatementBreakdown.toResponse(): StructuredStatementBreakdownResponse =
  StructuredStatementBreakdownResponse(
    code = code,
    label = label,
    breakdownType = breakdownType.name,
    total = total.toApiDecimal()
  )

private fun StructuredBalanceSheetTotals.toResponse(): StructuredBalanceSheetTotalsResponse =
  StructuredBalanceSheetTotalsResponse(
    totalAssets = totalAssets.toApiDecimal(),
    totalLiabilities = totalLiabilities.toApiDecimal(),
    totalEquity = totalEquity.toApiDecimal(),
    currentPeriodResult = currentPeriodResult.toApiDecimal(),
    totalLiabilitiesAndEquity = totalLiabilitiesAndEquity.toApiDecimal()
  )

private fun StructuredIncomeStatementTotals.toResponse(): StructuredIncomeStatementTotalsResponse =
  StructuredIncomeStatementTotalsResponse(
    totalRevenue = totalRevenue.toApiDecimal(),
    totalExpenses = totalExpenses.toApiDecimal(),
    netResult = netResult.toApiDecimal()
  )

private fun StructuredFinancialStatementState.toResponseValue(): String = name

private fun StructuredFinancialPresentationType.toResponseValue(): String = name

private fun BigDecimal.toApiDecimal(): String = stripTrailingZeros().toPlainString()
