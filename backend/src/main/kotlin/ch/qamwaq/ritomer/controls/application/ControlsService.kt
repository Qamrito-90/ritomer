package ch.qamwaq.ritomer.controls.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccess
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.identity.access.CONTROLS_READ_ROLE_NAMES
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.mapping.access.CurrentManualMappingProjection
import ch.qamwaq.ritomer.mapping.access.ManualMappingAccess
import java.math.BigDecimal
import java.util.UUID
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service

data class ClosingControls(
  val closingFolderId: UUID,
  val closingFolderStatus: ClosingFolderAccessStatus,
  val readiness: ClosingReadiness,
  val latestImportPresent: Boolean,
  val latestImportVersion: Int?,
  val mappingSummary: ControlsMappingSummary,
  val unmappedAccounts: List<UnmappedAccount>,
  val controls: List<ControlResult>,
  val nextAction: ControlsNextAction?
)

data class ControlsMappingSummary(
  val total: Int,
  val mapped: Int,
  val unmapped: Int
)

data class UnmappedAccount(
  val accountCode: String,
  val accountLabel: String,
  val debit: BigDecimal,
  val credit: BigDecimal
)

data class ControlResult(
  val code: ControlCode,
  val status: ControlStatus,
  val severity: ControlSeverity,
  val message: String
)

data class ControlsNextAction(
  val code: ControlsNextActionCode,
  val path: String,
  val actionable: Boolean
)

enum class ClosingReadiness {
  READY,
  BLOCKED
}

enum class ControlCode {
  LATEST_VALID_BALANCE_IMPORT_PRESENT,
  MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT
}

enum class ControlStatus {
  PASS,
  FAIL,
  NOT_APPLICABLE
}

enum class ControlSeverity {
  BLOCKER
}

enum class ControlsNextActionCode {
  IMPORT_BALANCE,
  COMPLETE_MANUAL_MAPPING
}

@Service
class ControlsService(
  private val closingFolderAccess: ClosingFolderAccess,
  private val manualMappingAccess: ManualMappingAccess
) {
  fun getControls(access: TenantAccessContext, closingFolderId: UUID): ClosingControls {
    requireAnyRole(access, READ_ROLES)

    val closingFolder = closingFolderAccess.getRequired(access.tenantId, closingFolderId)
    val projection = manualMappingAccess.getCurrentProjection(access.tenantId, closingFolderId)
    val latestImportPresent = projection.latestImportVersion != null
    val unmappedAccounts = projection.unmappedAccounts()

    val importControl = if (latestImportPresent) {
      ControlResult(
        code = ControlCode.LATEST_VALID_BALANCE_IMPORT_PRESENT,
        status = ControlStatus.PASS,
        severity = ControlSeverity.BLOCKER,
        message = "Latest valid balance import version ${projection.latestImportVersion} is available."
      )
    } else {
      ControlResult(
        code = ControlCode.LATEST_VALID_BALANCE_IMPORT_PRESENT,
        status = ControlStatus.FAIL,
        severity = ControlSeverity.BLOCKER,
        message = "No valid balance import is available."
      )
    }

    val mappingControl = when {
      !latestImportPresent ->
        ControlResult(
          code = ControlCode.MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT,
          status = ControlStatus.NOT_APPLICABLE,
          severity = ControlSeverity.BLOCKER,
          message = "Manual mapping completeness is not applicable until a valid balance import is available."
        )

      projection.summary.unmapped == 0 ->
        ControlResult(
          code = ControlCode.MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT,
          status = ControlStatus.PASS,
          severity = ControlSeverity.BLOCKER,
          message = "Manual mapping is complete on the latest import."
        )

      else ->
        ControlResult(
          code = ControlCode.MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT,
          status = ControlStatus.FAIL,
          severity = ControlSeverity.BLOCKER,
          message = "${projection.summary.unmapped} account(s) remain unmapped on the latest import."
        )
    }

    return ClosingControls(
      closingFolderId = closingFolderId,
      closingFolderStatus = closingFolder.status,
      readiness = deriveReadiness(importControl, mappingControl),
      latestImportPresent = latestImportPresent,
      latestImportVersion = projection.latestImportVersion,
      mappingSummary = ControlsMappingSummary(
        total = projection.summary.total,
        mapped = projection.summary.mapped,
        unmapped = projection.summary.unmapped
      ),
      unmappedAccounts = unmappedAccounts,
      controls = listOf(importControl, mappingControl),
      nextAction = nextActionFor(
        closingFolderId = closingFolderId,
        closingFolderStatus = closingFolder.status,
        latestImportPresent = latestImportPresent,
        hasUnmappedAccounts = projection.summary.unmapped > 0
      )
    )
  }

  private fun deriveReadiness(
    importControl: ControlResult,
    mappingControl: ControlResult
  ): ClosingReadiness =
    if (importControl.status == ControlStatus.PASS && mappingControl.status == ControlStatus.PASS) {
      ClosingReadiness.READY
    } else {
      ClosingReadiness.BLOCKED
    }

  private fun nextActionFor(
    closingFolderId: UUID,
    closingFolderStatus: ClosingFolderAccessStatus,
    latestImportPresent: Boolean,
    hasUnmappedAccounts: Boolean
  ): ControlsNextAction? {
    val actionable = closingFolderStatus != ClosingFolderAccessStatus.ARCHIVED

    return when {
      !latestImportPresent ->
        ControlsNextAction(
          code = ControlsNextActionCode.IMPORT_BALANCE,
          path = "/api/closing-folders/$closingFolderId/imports/balance",
          actionable = actionable
        )

      hasUnmappedAccounts ->
        ControlsNextAction(
          code = ControlsNextActionCode.COMPLETE_MANUAL_MAPPING,
          path = "/api/closing-folders/$closingFolderId/mappings/manual",
          actionable = actionable
        )

      else -> null
    }
  }

  private fun CurrentManualMappingProjection.unmappedAccounts(): List<UnmappedAccount> {
    val mappedAccountCodes = mappings.asSequence().map { it.accountCode }.toSet()
    return lines
      .filter { it.accountCode !in mappedAccountCodes }
      .map {
        UnmappedAccount(
          accountCode = it.accountCode,
          accountLabel = it.accountLabel,
          debit = it.debit,
          credit = it.credit
        )
      }
  }

  private fun requireAnyRole(access: TenantAccessContext, allowedRoles: Set<String>) {
    if (access.effectiveRoles.none { it in allowedRoles }) {
      throw AccessDeniedException("Insufficient role for controls operation.")
    }
  }

  companion object {
    private val READ_ROLES = CONTROLS_READ_ROLE_NAMES
  }
}
