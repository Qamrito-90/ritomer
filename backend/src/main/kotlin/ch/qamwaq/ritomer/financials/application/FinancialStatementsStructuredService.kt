package ch.qamwaq.ritomer.financials.application

import ch.qamwaq.ritomer.controls.access.ControlsAccess
import ch.qamwaq.ritomer.controls.access.ControlsBlocker
import ch.qamwaq.ritomer.controls.access.ControlsNextActionView
import ch.qamwaq.ritomer.controls.access.ControlsNextActionViewCode
import ch.qamwaq.ritomer.controls.access.ControlsReadiness
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.mapping.access.FinancialStatementStructureAccess
import ch.qamwaq.ritomer.mapping.access.StructuredFinancialStatementEntry
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.UUID
import org.springframework.stereotype.Service

data class ClosingStructuredFinancialStatements(
  val closingFolderId: UUID,
  val closingFolderStatus: String,
  val readiness: String,
  val statementState: StructuredFinancialStatementState,
  val presentationType: StructuredFinancialPresentationType,
  val isStatutory: Boolean,
  val taxonomyVersion: Int,
  val latestImportVersion: Int?,
  val coverage: StructuredFinancialCoverage,
  val blockers: List<StructuredFinancialBlocker>,
  val nextAction: StructuredFinancialNextAction?,
  val balanceSheet: StructuredBalanceSheet?,
  val incomeStatement: StructuredIncomeStatement?
)

data class StructuredFinancialCoverage(
  val totalLines: Int,
  val mappedLines: Int,
  val unmappedLines: Int,
  val mappedShare: BigDecimal
)

data class StructuredFinancialBlocker(
  val code: String,
  val message: String
)

data class StructuredFinancialNextAction(
  val code: StructuredFinancialNextActionCode,
  val path: String,
  val actionable: Boolean
)

data class StructuredBalanceSheet(
  val groups: List<StructuredStatementGroup>,
  val totals: StructuredBalanceSheetTotals
)

data class StructuredIncomeStatement(
  val groups: List<StructuredStatementGroup>,
  val totals: StructuredIncomeStatementTotals
)

data class StructuredStatementGroup(
  val code: String,
  val label: String,
  val total: BigDecimal,
  val breakdowns: List<StructuredStatementBreakdown>
)

data class StructuredStatementBreakdown(
  val code: String,
  val label: String,
  val breakdownType: StructuredStatementBreakdownType,
  val total: BigDecimal
)

data class StructuredBalanceSheetTotals(
  val totalAssets: BigDecimal,
  val totalLiabilities: BigDecimal,
  val totalEquity: BigDecimal,
  val currentPeriodResult: BigDecimal,
  val totalLiabilitiesAndEquity: BigDecimal
)

data class StructuredIncomeStatementTotals(
  val totalRevenue: BigDecimal,
  val totalExpenses: BigDecimal,
  val netResult: BigDecimal
)

enum class StructuredFinancialStatementState {
  NO_DATA,
  BLOCKED,
  PREVIEW_READY
}

enum class StructuredFinancialPresentationType {
  STRUCTURED_PREVIEW
}

enum class StructuredFinancialNextActionCode {
  IMPORT_BALANCE,
  COMPLETE_MANUAL_MAPPING
}

enum class StructuredStatementBreakdownType {
  SECTION,
  LEGACY_BUCKET_FALLBACK
}

@Service
class FinancialStatementsStructuredService(
  private val controlsAccess: ControlsAccess,
  private val financialStatementStructureAccess: FinancialStatementStructureAccess
) {
  fun getStructuredStatements(
    access: TenantAccessContext,
    closingFolderId: UUID
  ): ClosingStructuredFinancialStatements {
    val controls = controlsAccess.getSnapshot(access, closingFolderId)
    val projection = financialStatementStructureAccess.getStructuredProjection(access.tenantId, closingFolderId)
    val bucketLabelsByCode = projection.summaryBuckets.associate { it.code to it.label }

    val statementState = when {
      projection.latestImportVersion == null -> StructuredFinancialStatementState.NO_DATA
      controls.readiness == ControlsReadiness.READY -> StructuredFinancialStatementState.PREVIEW_READY
      else -> StructuredFinancialStatementState.BLOCKED
    }

    val coverage = StructuredFinancialCoverage(
      totalLines = projection.coverage.totalLines,
      mappedLines = projection.coverage.mappedLines,
      unmappedLines = projection.coverage.unmappedLines,
      mappedShare = mappedShare(
        totalLines = projection.coverage.totalLines,
        mappedLines = projection.coverage.mappedLines,
        statementState = statementState
      )
    )

    val incomeStatement = if (statementState == StructuredFinancialStatementState.PREVIEW_READY) {
      buildIncomeStatement(projection.mappedEntries, bucketLabelsByCode)
    } else {
      null
    }
    val balanceSheet = if (statementState == StructuredFinancialStatementState.PREVIEW_READY) {
      buildBalanceSheet(
        entries = projection.mappedEntries,
        bucketLabelsByCode = bucketLabelsByCode,
        currentPeriodResult = incomeStatement?.totals?.netResult ?: BigDecimal.ZERO
      )
    } else {
      null
    }

    return ClosingStructuredFinancialStatements(
      closingFolderId = closingFolderId,
      closingFolderStatus = controls.closingFolderStatus.name,
      readiness = controls.readiness.name,
      statementState = statementState,
      presentationType = StructuredFinancialPresentationType.STRUCTURED_PREVIEW,
      isStatutory = false,
      taxonomyVersion = projection.taxonomyVersion,
      latestImportVersion = projection.latestImportVersion,
      coverage = coverage,
      blockers = controls.blockers.map { it.toBlocker() },
      nextAction = controls.nextAction?.toNextAction(),
      balanceSheet = balanceSheet,
      incomeStatement = incomeStatement
    )
  }

  private fun buildBalanceSheet(
    entries: List<StructuredFinancialStatementEntry>,
    bucketLabelsByCode: Map<String, String>,
    currentPeriodResult: BigDecimal
  ): StructuredBalanceSheet {
    val groups = buildGroups(
      groupCodes = BALANCE_SHEET_GROUP_ORDER,
      entries = entries,
      bucketLabelsByCode = bucketLabelsByCode
    )
    val totalsByCode = groups.associateBy { it.code }

    val totalAssets = totalsByCode.getValue(BUCKET_ASSET).total
    val totalLiabilities = totalsByCode.getValue(BUCKET_LIABILITY).total
    val totalEquity = totalsByCode.getValue(BUCKET_EQUITY).total

    return StructuredBalanceSheet(
      groups = groups,
      totals = StructuredBalanceSheetTotals(
        totalAssets = totalAssets,
        totalLiabilities = totalLiabilities,
        totalEquity = totalEquity,
        currentPeriodResult = currentPeriodResult,
        totalLiabilitiesAndEquity = totalLiabilities + totalEquity + currentPeriodResult
      )
    )
  }

  private fun buildIncomeStatement(
    entries: List<StructuredFinancialStatementEntry>,
    bucketLabelsByCode: Map<String, String>
  ): StructuredIncomeStatement {
    val groups = buildGroups(
      groupCodes = INCOME_STATEMENT_GROUP_ORDER,
      entries = entries,
      bucketLabelsByCode = bucketLabelsByCode
    )
    val totalsByCode = groups.associateBy { it.code }
    val totalRevenue = totalsByCode.getValue(BUCKET_REVENUE).total
    val totalExpenses = totalsByCode.getValue(BUCKET_EXPENSE).total

    return StructuredIncomeStatement(
      groups = groups,
      totals = StructuredIncomeStatementTotals(
        totalRevenue = totalRevenue,
        totalExpenses = totalExpenses,
        netResult = totalRevenue - totalExpenses
      )
    )
  }

  private fun buildGroups(
    groupCodes: List<String>,
    entries: List<StructuredFinancialStatementEntry>,
    bucketLabelsByCode: Map<String, String>
  ): List<StructuredStatementGroup> {
    val entriesByBucketCode = entries.groupBy { it.summaryBucketCode }

    return groupCodes.map { groupCode ->
      val bucketEntries = entriesByBucketCode[groupCode].orEmpty()
      val breakdowns = bucketEntries
        .groupBy { it.toBreakdownKey() }
        .entries
        .sortedWith(compareBy<Map.Entry<BreakdownKey, List<StructuredFinancialStatementEntry>>> { it.key.order }.thenBy { it.key.code })
        .map { (key, groupedEntries) ->
          StructuredStatementBreakdown(
            code = key.code,
            label = key.label,
            breakdownType = key.breakdownType,
            total = groupedEntries.sumAmountsFor(groupCode)
          )
        }

      StructuredStatementGroup(
        code = groupCode,
        label = bucketLabelsByCode[groupCode]
          ?: error("Missing published summary bucket metadata for '$groupCode'."),
        total = bucketEntries.sumAmountsFor(groupCode),
        breakdowns = breakdowns
      )
    }
  }

  private fun StructuredFinancialStatementEntry.toBreakdownKey(): BreakdownKey =
    if (usesLegacyBucketFallback) {
      BreakdownKey(
        code = "$summaryBucketCode$LEGACY_BUCKET_FALLBACK_SUFFIX",
        label = LEGACY_BUCKET_FALLBACK_LABEL,
        order = LEGACY_BUCKET_FALLBACK_ORDER,
        breakdownType = StructuredStatementBreakdownType.LEGACY_BUCKET_FALLBACK
      )
    } else {
      BreakdownKey(
        code = sectionCode,
        label = sectionLabel,
        order = sectionDisplayOrder,
        breakdownType = StructuredStatementBreakdownType.SECTION
      )
    }

  private fun List<StructuredFinancialStatementEntry>.sumAmountsFor(groupCode: String): BigDecimal =
    fold(BigDecimal.ZERO) { sum, entry -> sum + entry.amountFor(groupCode) }

  private fun StructuredFinancialStatementEntry.amountFor(groupCode: String): BigDecimal =
    when (groupCode) {
      BUCKET_ASSET, BUCKET_EXPENSE -> debit - credit
      BUCKET_LIABILITY, BUCKET_EQUITY, BUCKET_REVENUE -> credit - debit
      else -> error("Unsupported summary bucket code '$groupCode'.")
    }

  private fun mappedShare(
    totalLines: Int,
    mappedLines: Int,
    statementState: StructuredFinancialStatementState
  ): BigDecimal =
    when {
      totalLines == 0 && statementState == StructuredFinancialStatementState.NO_DATA -> BigDecimal.ZERO
      totalLines == 0 && statementState == StructuredFinancialStatementState.PREVIEW_READY -> BigDecimal.ONE
      totalLines == 0 -> BigDecimal.ZERO
      else -> BigDecimal(mappedLines).divide(BigDecimal(totalLines), 4, RoundingMode.HALF_UP).stripTrailingZeros()
    }

  private fun ControlsBlocker.toBlocker(): StructuredFinancialBlocker =
    StructuredFinancialBlocker(
      code = code,
      message = message
    )

  private fun ControlsNextActionView.toNextAction(): StructuredFinancialNextAction =
    StructuredFinancialNextAction(
      code = code.toStructuredFinancialCode(),
      path = path,
      actionable = actionable
    )

  private fun ControlsNextActionViewCode.toStructuredFinancialCode(): StructuredFinancialNextActionCode =
    when (this) {
      ControlsNextActionViewCode.IMPORT_BALANCE -> StructuredFinancialNextActionCode.IMPORT_BALANCE
      ControlsNextActionViewCode.COMPLETE_MANUAL_MAPPING -> StructuredFinancialNextActionCode.COMPLETE_MANUAL_MAPPING
    }

  private data class BreakdownKey(
    val code: String,
    val label: String,
    val order: Int,
    val breakdownType: StructuredStatementBreakdownType
  )

  companion object {
    private const val BUCKET_ASSET = "BS.ASSET"
    private const val BUCKET_LIABILITY = "BS.LIABILITY"
    private const val BUCKET_EQUITY = "BS.EQUITY"
    private const val BUCKET_REVENUE = "PL.REVENUE"
    private const val BUCKET_EXPENSE = "PL.EXPENSE"

    private const val LEGACY_BUCKET_FALLBACK_SUFFIX = ".LEGACY_BUCKET_FALLBACK"
    private const val LEGACY_BUCKET_FALLBACK_LABEL = "Legacy bucket-level mappings"
    private const val LEGACY_BUCKET_FALLBACK_ORDER = 0

    private val BALANCE_SHEET_GROUP_ORDER = listOf(
      BUCKET_ASSET,
      BUCKET_LIABILITY,
      BUCKET_EQUITY
    )

    private val INCOME_STATEMENT_GROUP_ORDER = listOf(
      BUCKET_REVENUE,
      BUCKET_EXPENSE
    )
  }
}
