package ch.qamwaq.ritomer.financials.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.controls.access.ClosingControlsSnapshot
import ch.qamwaq.ritomer.controls.access.ControlsAccess
import ch.qamwaq.ritomer.controls.access.ControlsBlocker
import ch.qamwaq.ritomer.controls.access.ControlsNextActionView
import ch.qamwaq.ritomer.controls.access.ControlsNextActionViewCode
import ch.qamwaq.ritomer.controls.access.ControlsReadiness
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.mapping.access.FinancialStatementStructureAccess
import ch.qamwaq.ritomer.mapping.access.StructuredFinancialStatementBucket
import ch.qamwaq.ritomer.mapping.access.StructuredFinancialStatementCoverage
import ch.qamwaq.ritomer.mapping.access.StructuredFinancialStatementEntry
import ch.qamwaq.ritomer.mapping.access.StructuredFinancialStatementKind
import ch.qamwaq.ritomer.mapping.access.StructuredFinancialStatementProjection
import java.math.BigDecimal
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class FinancialStatementsStructuredServiceTest {
  @Test
  fun `no data keeps structured statements null and exposes explicit preview metadata`() {
    val closingFolderId = UUID.randomUUID()
    val service = FinancialStatementsStructuredService(
      controlsAccess = controlsAccess(
        ClosingControlsSnapshot(
          closingFolderStatus = ClosingFolderAccessStatus.DRAFT,
          readiness = ControlsReadiness.BLOCKED,
          blockers = listOf(ControlsBlocker("LATEST_VALID_BALANCE_IMPORT_PRESENT", "No valid balance import is available.")),
          nextAction = ControlsNextActionView(
            code = ControlsNextActionViewCode.IMPORT_BALANCE,
            path = "/api/closing-folders/$closingFolderId/imports/balance",
            actionable = true
          )
        )
      ),
      financialStatementStructureAccess = structureAccess(
        projection(
          closingFolderId = closingFolderId,
          latestImportVersion = null,
          totalLines = 0,
          mappedLines = 0,
          unmappedLines = 0,
          entries = emptyList()
        )
      )
    )

    val statements = service.getStructuredStatements(access(), closingFolderId)

    assertThat(statements.statementState).isEqualTo(StructuredFinancialStatementState.NO_DATA)
    assertThat(statements.presentationType).isEqualTo(StructuredFinancialPresentationType.STRUCTURED_PREVIEW)
    assertThat(statements.isStatutory).isFalse()
    assertThat(statements.taxonomyVersion).isEqualTo(2)
    assertThat(statements.coverage.mappedShare).isEqualByComparingTo("0")
    assertThat(statements.balanceSheet).isNull()
    assertThat(statements.incomeStatement).isNull()
    assertThat(statements.nextAction?.code).isEqualTo(StructuredFinancialNextActionCode.IMPORT_BALANCE)
  }

  @Test
  fun `blocked keeps structured statements null while exposing blockers and next action`() {
    val closingFolderId = UUID.randomUUID()
    val service = FinancialStatementsStructuredService(
      controlsAccess = controlsAccess(
        ClosingControlsSnapshot(
          closingFolderStatus = ClosingFolderAccessStatus.DRAFT,
          readiness = ControlsReadiness.BLOCKED,
          blockers = listOf(ControlsBlocker("MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT", "1 account(s) remain unmapped on the latest import.")),
          nextAction = ControlsNextActionView(
            code = ControlsNextActionViewCode.COMPLETE_MANUAL_MAPPING,
            path = "/api/closing-folders/$closingFolderId/mappings/manual",
            actionable = true
          )
        )
      ),
      financialStatementStructureAccess = structureAccess(
        projection(
          closingFolderId = closingFolderId,
          latestImportVersion = 2,
          totalLines = 3,
          mappedLines = 2,
          unmappedLines = 1,
          entries = listOf(
            entry("1000", "BS.ASSET.CASH_AND_EQUIVALENTS", "BS.ASSET", "BS.ASSET.CURRENT_SECTION", "Current assets", 110, false, "100", "0"),
            entry("2000", "PL.REVENUE.OPERATING_REVENUE", "PL.REVENUE", "PL.REVENUE.OPERATING_SECTION", "Operating revenue", 410, false, "0", "175")
          )
        )
      )
    )

    val statements = service.getStructuredStatements(access(), closingFolderId)

    assertThat(statements.statementState).isEqualTo(StructuredFinancialStatementState.BLOCKED)
    assertThat(statements.coverage.mappedShare).isEqualByComparingTo("0.6667")
    assertThat(statements.blockers.single().code).isEqualTo("MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT")
    assertThat(statements.nextAction?.code).isEqualTo(StructuredFinancialNextActionCode.COMPLETE_MANUAL_MAPPING)
    assertThat(statements.balanceSheet).isNull()
    assertThat(statements.incomeStatement).isNull()
  }

  @Test
  fun `preview ready v2 aggregates sections and computes statement totals`() {
    val closingFolderId = UUID.randomUUID()
    val service = FinancialStatementsStructuredService(
      controlsAccess = controlsAccess(
        ClosingControlsSnapshot(
          closingFolderStatus = ClosingFolderAccessStatus.DRAFT,
          readiness = ControlsReadiness.READY,
          blockers = emptyList(),
          nextAction = null
        )
      ),
      financialStatementStructureAccess = structureAccess(
        projection(
          closingFolderId = closingFolderId,
          latestImportVersion = 3,
          totalLines = 5,
          mappedLines = 5,
          unmappedLines = 0,
          entries = listOf(
            entry("1000", "BS.ASSET.CASH_AND_EQUIVALENTS", "BS.ASSET", "BS.ASSET.CURRENT_SECTION", "Current assets", 110, false, "250", "0"),
            entry("2100", "BS.LIABILITY.TRADE_PAYABLES", "BS.LIABILITY", "BS.LIABILITY.CURRENT_SECTION", "Current liabilities", 210, false, "0", "40"),
            entry("2800", "BS.EQUITY.SHARE_CAPITAL", "BS.EQUITY", "BS.EQUITY.CORE_SECTION", "Equity", 310, false, "0", "60"),
            entry("3000", "PL.REVENUE.OPERATING_REVENUE", "PL.REVENUE", "PL.REVENUE.OPERATING_SECTION", "Operating revenue", 410, false, "0", "175"),
            entry("6200", "PL.EXPENSE.PERSONNEL_EXPENSES", "PL.EXPENSE", "PL.EXPENSE.OPERATING_SECTION", "Operating expenses", 510, false, "25", "0")
          )
        )
      )
    )

    val statements = service.getStructuredStatements(access(), closingFolderId)

    assertThat(statements.statementState).isEqualTo(StructuredFinancialStatementState.PREVIEW_READY)
    assertThat(statements.coverage.mappedShare).isEqualByComparingTo("1")
    assertThat(statements.blockers).isEmpty()
    assertThat(statements.nextAction).isNull()
    assertThat(statements.balanceSheet?.groups?.map { it.code }).containsExactly("BS.ASSET", "BS.LIABILITY", "BS.EQUITY")
    assertThat(statements.balanceSheet?.groups?.first()?.breakdowns?.single()?.code).isEqualTo("BS.ASSET.CURRENT_SECTION")
    assertThat(statements.balanceSheet?.totals?.totalAssets).isEqualByComparingTo("250")
    assertThat(statements.balanceSheet?.totals?.totalLiabilities).isEqualByComparingTo("40")
    assertThat(statements.balanceSheet?.totals?.totalEquity).isEqualByComparingTo("60")
    assertThat(statements.balanceSheet?.totals?.currentPeriodResult).isEqualByComparingTo("150")
    assertThat(statements.balanceSheet?.totals?.totalLiabilitiesAndEquity).isEqualByComparingTo("250")
    assertThat(statements.incomeStatement?.groups?.map { it.code }).containsExactly("PL.REVENUE", "PL.EXPENSE")
    assertThat(statements.incomeStatement?.groups?.first()?.breakdowns?.single()?.code).isEqualTo("PL.REVENUE.OPERATING_SECTION")
    assertThat(statements.incomeStatement?.totals?.totalRevenue).isEqualByComparingTo("175")
    assertThat(statements.incomeStatement?.totals?.totalExpenses).isEqualByComparingTo("25")
    assertThat(statements.incomeStatement?.totals?.netResult).isEqualByComparingTo("150")
  }

  @Test
  fun `preview ready legacy mappings use explicit fallback and never invent a v2 section`() {
    val closingFolderId = UUID.randomUUID()
    val service = FinancialStatementsStructuredService(
      controlsAccess = controlsAccess(
        ClosingControlsSnapshot(
          closingFolderStatus = ClosingFolderAccessStatus.DRAFT,
          readiness = ControlsReadiness.READY,
          blockers = emptyList(),
          nextAction = null
        )
      ),
      financialStatementStructureAccess = structureAccess(
        projection(
          closingFolderId = closingFolderId,
          latestImportVersion = 4,
          totalLines = 3,
          mappedLines = 3,
          unmappedLines = 0,
          entries = listOf(
            entry("1000", "BS.ASSET", "BS.ASSET", "BS.ASSET", "Asset", 10, true, "200", "0"),
            entry("2800", "BS.EQUITY", "BS.EQUITY", "BS.EQUITY", "Equity", 20, true, "0", "100"),
            entry("3000", "PL.REVENUE", "PL.REVENUE", "PL.REVENUE", "Revenue", 50, true, "0", "100")
          )
        )
      )
    )

    val statements = service.getStructuredStatements(access(), closingFolderId)

    assertThat(statements.statementState).isEqualTo(StructuredFinancialStatementState.PREVIEW_READY)
    assertThat(statements.balanceSheet?.groups?.first()?.breakdowns).containsExactly(
      StructuredStatementBreakdown(
        code = "BS.ASSET.LEGACY_BUCKET_FALLBACK",
        label = "Legacy bucket-level mappings",
        breakdownType = StructuredStatementBreakdownType.LEGACY_BUCKET_FALLBACK,
        total = decimal("200")
      )
    )
    assertThat(statements.balanceSheet?.groups?.get(2)?.breakdowns?.single()?.code).isEqualTo("BS.EQUITY.LEGACY_BUCKET_FALLBACK")
    assertThat(statements.incomeStatement?.groups?.first()?.breakdowns?.single()?.code).isEqualTo("PL.REVENUE.LEGACY_BUCKET_FALLBACK")
    assertThat(statements.balanceSheet?.totals?.totalLiabilitiesAndEquity).isEqualByComparingTo("200")
    assertThat(statements.incomeStatement?.totals?.netResult).isEqualByComparingTo("100")
  }

  @Test
  fun `v2 and mixed legacy v1 v2 projections keep the same group totals and statement totals`() {
    val closingFolderId = UUID.randomUUID()
    val controls = ClosingControlsSnapshot(
      closingFolderStatus = ClosingFolderAccessStatus.DRAFT,
      readiness = ControlsReadiness.READY,
      blockers = emptyList(),
      nextAction = null
    )

    val v2Service = FinancialStatementsStructuredService(
      controlsAccess = controlsAccess(controls),
      financialStatementStructureAccess = structureAccess(
        projection(
          closingFolderId = closingFolderId,
          latestImportVersion = 5,
          totalLines = 5,
          mappedLines = 5,
          unmappedLines = 0,
          entries = listOf(
            entry("1000", "BS.ASSET.CASH_AND_EQUIVALENTS", "BS.ASSET", "BS.ASSET.CURRENT_SECTION", "Current assets", 110, false, "250", "0"),
            entry("2100", "BS.LIABILITY.TRADE_PAYABLES", "BS.LIABILITY", "BS.LIABILITY.CURRENT_SECTION", "Current liabilities", 210, false, "0", "40"),
            entry("2800", "BS.EQUITY.SHARE_CAPITAL", "BS.EQUITY", "BS.EQUITY.CORE_SECTION", "Equity", 310, false, "0", "60"),
            entry("3000", "PL.REVENUE.OPERATING_REVENUE", "PL.REVENUE", "PL.REVENUE.OPERATING_SECTION", "Operating revenue", 410, false, "0", "175"),
            entry("6200", "PL.EXPENSE.PERSONNEL_EXPENSES", "PL.EXPENSE", "PL.EXPENSE.OPERATING_SECTION", "Operating expenses", 510, false, "25", "0")
          )
        )
      )
    )

    val mixedService = FinancialStatementsStructuredService(
      controlsAccess = controlsAccess(controls),
      financialStatementStructureAccess = structureAccess(
        projection(
          closingFolderId = closingFolderId,
          latestImportVersion = 5,
          totalLines = 6,
          mappedLines = 6,
          unmappedLines = 0,
          entries = listOf(
            entry("1000", "BS.ASSET", "BS.ASSET", "BS.ASSET", "Asset", 10, true, "200", "0"),
            entry("1010", "BS.ASSET.CASH_AND_EQUIVALENTS", "BS.ASSET", "BS.ASSET.CURRENT_SECTION", "Current assets", 110, false, "50", "0"),
            entry("2100", "BS.LIABILITY.TRADE_PAYABLES", "BS.LIABILITY", "BS.LIABILITY.CURRENT_SECTION", "Current liabilities", 210, false, "0", "40"),
            entry("2800", "BS.EQUITY", "BS.EQUITY", "BS.EQUITY", "Equity", 20, true, "0", "60"),
            entry("3000", "PL.REVENUE.OPERATING_REVENUE", "PL.REVENUE", "PL.REVENUE.OPERATING_SECTION", "Operating revenue", 410, false, "0", "175"),
            entry("6200", "PL.EXPENSE", "PL.EXPENSE", "PL.EXPENSE", "Expense", 40, true, "25", "0")
          )
        )
      )
    )

    val v2 = v2Service.getStructuredStatements(access(), closingFolderId)
    val mixed = mixedService.getStructuredStatements(access(), closingFolderId)

    assertThat(v2.balanceSheet?.groups?.associate { it.code to it.total })
      .isEqualTo(mixed.balanceSheet?.groups?.associate { it.code to it.total })
    assertThat(v2.incomeStatement?.groups?.associate { it.code to it.total })
      .isEqualTo(mixed.incomeStatement?.groups?.associate { it.code to it.total })
    assertThat(v2.balanceSheet?.totals).isEqualTo(mixed.balanceSheet?.totals)
    assertThat(v2.incomeStatement?.totals).isEqualTo(mixed.incomeStatement?.totals)
    assertThat(mixed.balanceSheet?.groups?.first()?.breakdowns?.map { it.code })
      .containsExactly("BS.ASSET.LEGACY_BUCKET_FALLBACK", "BS.ASSET.CURRENT_SECTION")
  }

  @Test
  fun `archived closing stays readable and blocked next action remains non actionable`() {
    val closingFolderId = UUID.randomUUID()
    val service = FinancialStatementsStructuredService(
      controlsAccess = controlsAccess(
        ClosingControlsSnapshot(
          closingFolderStatus = ClosingFolderAccessStatus.ARCHIVED,
          readiness = ControlsReadiness.BLOCKED,
          blockers = listOf(ControlsBlocker("MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT", "1 account(s) remain unmapped on the latest import.")),
          nextAction = ControlsNextActionView(
            code = ControlsNextActionViewCode.COMPLETE_MANUAL_MAPPING,
            path = "/api/closing-folders/$closingFolderId/mappings/manual",
            actionable = false
          )
        )
      ),
      financialStatementStructureAccess = structureAccess(
        projection(
          closingFolderId = closingFolderId,
          latestImportVersion = 1,
          totalLines = 2,
          mappedLines = 1,
          unmappedLines = 1,
          entries = listOf(
            entry("1000", "BS.ASSET", "BS.ASSET", "BS.ASSET", "Asset", 10, true, "100", "0")
          )
        )
      )
    )

    val statements = service.getStructuredStatements(access(), closingFolderId)

    assertThat(statements.closingFolderStatus).isEqualTo("ARCHIVED")
    assertThat(statements.statementState).isEqualTo(StructuredFinancialStatementState.BLOCKED)
    assertThat(statements.nextAction?.actionable).isFalse()
    assertThat(statements.balanceSheet).isNull()
    assertThat(statements.incomeStatement).isNull()
  }

  private fun access() = TenantAccessContext(
    actorUserId = UUID.randomUUID(),
    actorSubject = "financial-structured-user",
    tenantId = UUID.randomUUID(),
    effectiveRoles = setOf("ACCOUNTANT")
  )

  private fun controlsAccess(snapshot: ClosingControlsSnapshot) = ControlsAccess { _, _ -> snapshot }

  private fun structureAccess(projection: StructuredFinancialStatementProjection) =
    FinancialStatementStructureAccess { _, _ -> projection }

  private fun projection(
    closingFolderId: UUID,
    latestImportVersion: Int?,
    totalLines: Int,
    mappedLines: Int,
    unmappedLines: Int,
    entries: List<StructuredFinancialStatementEntry>
  ) = StructuredFinancialStatementProjection(
    closingFolderId = closingFolderId,
    taxonomyVersion = 2,
    latestImportVersion = latestImportVersion,
    coverage = StructuredFinancialStatementCoverage(
      totalLines = totalLines,
      mappedLines = mappedLines,
      unmappedLines = unmappedLines
    ),
    summaryBuckets = summaryBuckets(),
    mappedEntries = entries
  )

  private fun summaryBuckets() = listOf(
    StructuredFinancialStatementBucket("BS.ASSET", "Asset", StructuredFinancialStatementKind.BALANCE_SHEET),
    StructuredFinancialStatementBucket("BS.LIABILITY", "Liability", StructuredFinancialStatementKind.BALANCE_SHEET),
    StructuredFinancialStatementBucket("BS.EQUITY", "Equity", StructuredFinancialStatementKind.BALANCE_SHEET),
    StructuredFinancialStatementBucket("PL.REVENUE", "Revenue", StructuredFinancialStatementKind.INCOME_STATEMENT),
    StructuredFinancialStatementBucket("PL.EXPENSE", "Expense", StructuredFinancialStatementKind.INCOME_STATEMENT)
  )

  private fun entry(
    accountCode: String,
    targetCode: String,
    summaryBucketCode: String,
    sectionCode: String,
    sectionLabel: String,
    sectionDisplayOrder: Int,
    usesLegacyBucketFallback: Boolean,
    debit: String,
    credit: String
  ) = StructuredFinancialStatementEntry(
    accountCode = accountCode,
    targetCode = targetCode,
    summaryBucketCode = summaryBucketCode,
    sectionCode = sectionCode,
    sectionLabel = sectionLabel,
    sectionDisplayOrder = sectionDisplayOrder,
    usesLegacyBucketFallback = usesLegacyBucketFallback,
    debit = decimal(debit),
    credit = decimal(credit)
  )

  private fun decimal(value: String) = BigDecimal(value)
}
