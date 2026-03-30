package ch.qamwaq.ritomer.controls.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccess
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessView
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

class ControlsServiceTest {
  @Test
  fun `no import returns blocked with import next action`() {
    val closingFolderId = UUID.randomUUID()
    val service = ControlsService(
      closingFolderAccess = closingFolderAccess(ClosingFolderAccessStatus.DRAFT),
      manualMappingAccess = projectionAccess(
        CurrentManualMappingProjection(
          closingFolderId = closingFolderId,
          latestImportVersion = null,
          lines = emptyList(),
          mappings = emptyList(),
          summary = ProjectedManualMappingSummary(total = 0, mapped = 0, unmapped = 0)
        )
      )
    )

    val controls = service.getControls(access(setOf("ACCOUNTANT")), closingFolderId)

    assertThat(controls.readiness).isEqualTo(ClosingReadiness.BLOCKED)
    assertThat(controls.latestImportPresent).isFalse()
    assertThat(controls.controls[0].status).isEqualTo(ControlStatus.FAIL)
    assertThat(controls.controls[1].status).isEqualTo(ControlStatus.NOT_APPLICABLE)
    assertThat(controls.nextAction?.code).isEqualTo(ControlsNextActionCode.IMPORT_BALANCE)
    assertThat(controls.nextAction?.actionable).isTrue()
  }

  @Test
  fun `archived closing keeps calculation and marks next action as non actionable`() {
    val closingFolderId = UUID.randomUUID()
    val service = ControlsService(
      closingFolderAccess = closingFolderAccess(ClosingFolderAccessStatus.ARCHIVED),
      manualMappingAccess = projectionAccess(
        CurrentManualMappingProjection(
          closingFolderId = closingFolderId,
          latestImportVersion = 2,
          lines = listOf(
            ProjectedManualMappingLine(2, "1000", "Cash", decimal("100.00"), decimal("0.00")),
            ProjectedManualMappingLine(3, "2000", "Revenue", decimal("0.00"), decimal("100.00"))
          ),
          mappings = listOf(ProjectedManualMappingEntry("1000", "BS.ASSET")),
          summary = ProjectedManualMappingSummary(total = 2, mapped = 1, unmapped = 1)
        )
      )
    )

    val controls = service.getControls(access(setOf("MANAGER")), closingFolderId)

    assertThat(controls.closingFolderStatus).isEqualTo(ClosingFolderAccessStatus.ARCHIVED)
    assertThat(controls.readiness).isEqualTo(ClosingReadiness.BLOCKED)
    assertThat(controls.unmappedAccounts.map { it.accountCode }).containsExactly("2000")
    assertThat(controls.nextAction?.code).isEqualTo(ControlsNextActionCode.COMPLETE_MANUAL_MAPPING)
    assertThat(controls.nextAction?.actionable).isFalse()
  }

  @Test
  fun `unsupported role is rejected`() {
    val closingFolderId = UUID.randomUUID()
    val service = ControlsService(
      closingFolderAccess = closingFolderAccess(ClosingFolderAccessStatus.DRAFT),
      manualMappingAccess = projectionAccess(
        CurrentManualMappingProjection(
          closingFolderId = closingFolderId,
          latestImportVersion = 1,
          lines = emptyList(),
          mappings = emptyList(),
          summary = ProjectedManualMappingSummary(total = 0, mapped = 0, unmapped = 0)
        )
      )
    )

    assertThatThrownBy {
      service.getControls(access(setOf("UNSUPPORTED")), closingFolderId)
    }.isInstanceOf(AccessDeniedException::class.java)
  }

  private fun access(effectiveRoles: Set<String>) = TenantAccessContext(
    actorUserId = UUID.randomUUID(),
    actorSubject = "controls-user",
    tenantId = UUID.randomUUID(),
    effectiveRoles = effectiveRoles
  )

  private fun closingFolderAccess(status: ClosingFolderAccessStatus) = object : ClosingFolderAccess {
    override fun getRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView =
      ClosingFolderAccessView(
        id = closingFolderId,
        tenantId = tenantId,
        status = status
      )

    override fun lockRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView =
      getRequired(tenantId, closingFolderId)
  }

  private fun projectionAccess(projection: CurrentManualMappingProjection) = ManualMappingAccess { _, _ -> projection }

  private fun decimal(value: String) = BigDecimal(value)
}
