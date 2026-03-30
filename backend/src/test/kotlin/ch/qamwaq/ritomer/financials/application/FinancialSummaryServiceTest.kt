package ch.qamwaq.ritomer.financials.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.controls.access.ClosingControlsSnapshot
import ch.qamwaq.ritomer.controls.access.ControlsAccess
import ch.qamwaq.ritomer.controls.access.ControlsBlocker
import ch.qamwaq.ritomer.controls.access.ControlsNextActionView
import ch.qamwaq.ritomer.controls.access.ControlsNextActionViewCode
import ch.qamwaq.ritomer.controls.access.ControlsReadiness
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.mapping.access.CurrentManualMappingProjection
import ch.qamwaq.ritomer.mapping.access.ManualMappingAccess
import ch.qamwaq.ritomer.mapping.access.ProjectedManualMappingEntry
import ch.qamwaq.ritomer.mapping.access.ProjectedManualMappingLine
import ch.qamwaq.ritomer.mapping.access.ProjectedManualMappingSummary
import java.math.BigDecimal
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.security.access.AccessDeniedException

class FinancialSummaryServiceTest {
  @Test
  fun `no import returns no data with zero coverage and import next action`() {
    val closingFolderId = UUID.randomUUID()
    val service = FinancialSummaryService(
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
      manualMappingAccess = projectionAccess(
        CurrentManualMappingProjection(
          closingFolderId = closingFolderId,
          latestImportVersion = null,
          lines = emptyList(),
          mappings = emptyList(),
          summary = ProjectedManualMappingSummary(0, 0, 0)
        )
      )
    )

    val summary = service.getFinancialSummary(access(), closingFolderId)

    assertThat(summary.statementState).isEqualTo(FinancialSummaryState.NO_DATA)
    assertThat(summary.coverage.totalLines).isZero()
    assertThat(summary.coverage.mappedLines).isZero()
    assertThat(summary.coverage.unmappedLines).isZero()
    assertThat(summary.coverage.mappedShare).isEqualByComparingTo("0")
    assertThat(summary.unmappedBalanceImpact.debitTotal).isEqualByComparingTo("0")
    assertThat(summary.balanceSheetSummary).isNull()
    assertThat(summary.incomeStatementSummary).isNull()
    assertThat(summary.nextAction?.code).isEqualTo(FinancialSummaryNextActionCode.IMPORT_BALANCE)
  }

  @Test
  fun `preview partial computes mapped totals and unmapped impact separately`() {
    val closingFolderId = UUID.randomUUID()
    val service = FinancialSummaryService(
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
      manualMappingAccess = projectionAccess(
        CurrentManualMappingProjection(
          closingFolderId = closingFolderId,
          latestImportVersion = 2,
          lines = listOf(
            ProjectedManualMappingLine(2, "1000", "Cash", decimal("100.00"), decimal("0.00")),
            ProjectedManualMappingLine(4, "2000", "Revenue", decimal("0.00"), decimal("175.00")),
            ProjectedManualMappingLine(7, "0500", "Receivable", decimal("75.00"), decimal("0.00"))
          ),
          mappings = listOf(
            ProjectedManualMappingEntry("1000", "BS.ASSET"),
            ProjectedManualMappingEntry("2000", "PL.REVENUE")
          ),
          summary = ProjectedManualMappingSummary(3, 2, 1)
        )
      )
    )

    val summary = service.getFinancialSummary(access(), closingFolderId)

    assertThat(summary.statementState).isEqualTo(FinancialSummaryState.PREVIEW_PARTIAL)
    assertThat(summary.coverage.totalLines).isEqualTo(3)
    assertThat(summary.coverage.mappedLines).isEqualTo(2)
    assertThat(summary.coverage.unmappedLines).isEqualTo(1)
    assertThat(summary.coverage.mappedShare).isEqualByComparingTo("0.6667")
    assertThat(summary.unmappedBalanceImpact.debitTotal).isEqualByComparingTo("75")
    assertThat(summary.unmappedBalanceImpact.creditTotal).isEqualByComparingTo("0")
    assertThat(summary.unmappedBalanceImpact.netDebitMinusCredit).isEqualByComparingTo("75")
    assertThat(summary.balanceSheetSummary?.assets).isEqualByComparingTo("100")
    assertThat(summary.balanceSheetSummary?.currentPeriodResult).isEqualByComparingTo("175")
    assertThat(summary.balanceSheetSummary?.totalAssets).isEqualByComparingTo("100")
    assertThat(summary.balanceSheetSummary?.totalLiabilitiesAndEquity).isEqualByComparingTo("175")
    assertThat(summary.incomeStatementSummary?.revenue).isEqualByComparingTo("175")
    assertThat(summary.incomeStatementSummary?.expenses).isEqualByComparingTo("0")
    assertThat(summary.incomeStatementSummary?.netResult).isEqualByComparingTo("175")
    assertThat(summary.blockers.single().code).isEqualTo("MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT")
  }

  @Test
  fun `preview ready computes full totals and clears blockers`() {
    val closingFolderId = UUID.randomUUID()
    val service = FinancialSummaryService(
      controlsAccess = controlsAccess(
        ClosingControlsSnapshot(
          closingFolderStatus = ClosingFolderAccessStatus.DRAFT,
          readiness = ControlsReadiness.READY,
          blockers = emptyList(),
          nextAction = null
        )
      ),
      manualMappingAccess = projectionAccess(
        CurrentManualMappingProjection(
          closingFolderId = closingFolderId,
          latestImportVersion = 3,
          lines = listOf(
            ProjectedManualMappingLine(2, "1000", "Cash", decimal("100.00"), decimal("0.00")),
            ProjectedManualMappingLine(3, "2000", "Revenue", decimal("0.00"), decimal("100.00"))
          ),
          mappings = listOf(
            ProjectedManualMappingEntry("1000", "BS.ASSET"),
            ProjectedManualMappingEntry("2000", "PL.REVENUE")
          ),
          summary = ProjectedManualMappingSummary(2, 2, 0)
        )
      )
    )

    val summary = service.getFinancialSummary(access(), closingFolderId)

    assertThat(summary.statementState).isEqualTo(FinancialSummaryState.PREVIEW_READY)
    assertThat(summary.coverage.mappedShare).isEqualByComparingTo("1")
    assertThat(summary.unmappedBalanceImpact.debitTotal).isEqualByComparingTo("0")
    assertThat(summary.blockers).isEmpty()
    assertThat(summary.nextAction).isNull()
    assertThat(summary.balanceSheetSummary?.totalAssets).isEqualByComparingTo("100")
    assertThat(summary.balanceSheetSummary?.totalLiabilitiesAndEquity).isEqualByComparingTo("100")
    assertThat(summary.incomeStatementSummary?.netResult).isEqualByComparingTo("100")
  }

  @Test
  fun `access denied from controls is propagated`() {
    val service = FinancialSummaryService(
      controlsAccess = ControlsAccess { _, _ -> throw AccessDeniedException("Insufficient role.") },
      manualMappingAccess = projectionAccess(
        CurrentManualMappingProjection(
          closingFolderId = UUID.randomUUID(),
          latestImportVersion = null,
          lines = emptyList(),
          mappings = emptyList(),
          summary = ProjectedManualMappingSummary(0, 0, 0)
        )
      )
    )

    assertThatThrownBy {
      service.getFinancialSummary(access(), UUID.randomUUID())
    }.isInstanceOf(AccessDeniedException::class.java)
  }

  private fun access() = TenantAccessContext(
    actorUserId = UUID.randomUUID(),
    actorSubject = "financial-summary-user",
    tenantId = UUID.randomUUID(),
    effectiveRoles = setOf("ACCOUNTANT")
  )

  private fun controlsAccess(snapshot: ClosingControlsSnapshot) = ControlsAccess { _, _ -> snapshot }

  private fun projectionAccess(projection: CurrentManualMappingProjection) = ManualMappingAccess { _, _ -> projection }

  private fun decimal(value: String) = BigDecimal(value)
}
