package ch.qamwaq.ritomer.controls.access

import ch.qamwaq.ritomer.controls.application.ClosingControls
import ch.qamwaq.ritomer.controls.application.ClosingReadiness
import ch.qamwaq.ritomer.controls.application.ControlCode
import ch.qamwaq.ritomer.controls.application.ControlResult
import ch.qamwaq.ritomer.controls.application.ControlSeverity
import ch.qamwaq.ritomer.controls.application.ControlStatus
import ch.qamwaq.ritomer.controls.application.ControlsMappingSummary
import ch.qamwaq.ritomer.controls.application.ControlsNextAction
import ch.qamwaq.ritomer.controls.application.ControlsNextActionCode
import ch.qamwaq.ritomer.controls.application.ControlsService
import ch.qamwaq.ritomer.controls.application.UnmappedAccount
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import java.math.BigDecimal
import java.util.UUID
import org.springframework.stereotype.Service

data class ControlsReadModel(
  val closingFolderId: String,
  val closingFolderStatus: String,
  val readiness: String,
  val latestImportPresent: Boolean,
  val latestImportVersion: Int?,
  val mappingSummary: ControlsMappingSummaryReadModel,
  val unmappedAccounts: List<UnmappedAccountReadModel>,
  val controls: List<ControlResultReadModel>,
  val nextAction: ControlsNextActionReadModel?
)

data class ControlsMappingSummaryReadModel(
  val total: Int,
  val mapped: Int,
  val unmapped: Int
)

data class UnmappedAccountReadModel(
  val accountCode: String,
  val accountLabel: String,
  val debit: String,
  val credit: String
)

data class ControlResultReadModel(
  val code: String,
  val status: String,
  val severity: String,
  val message: String
)

data class ControlsNextActionReadModel(
  val code: String,
  val path: String,
  val actionable: Boolean
)

fun interface ControlsReadModelAccess {
  fun getReadModel(access: TenantAccessContext, closingFolderId: UUID): ControlsReadModel
}

@Service
class ServiceBackedControlsReadModelAccess(
  private val controlsService: ControlsService
) : ControlsReadModelAccess {
  override fun getReadModel(access: TenantAccessContext, closingFolderId: UUID): ControlsReadModel =
    controlsService.getControls(access, closingFolderId).toReadModel()
}

private fun ClosingControls.toReadModel(): ControlsReadModel =
  ControlsReadModel(
    closingFolderId = closingFolderId.toString(),
    closingFolderStatus = closingFolderStatus.name,
    readiness = readiness.toResponseValue(),
    latestImportPresent = latestImportPresent,
    latestImportVersion = latestImportVersion,
    mappingSummary = mappingSummary.toReadModel(),
    unmappedAccounts = unmappedAccounts.map { it.toReadModel() },
    controls = controls.map { it.toReadModel() },
    nextAction = nextAction?.toReadModel()
  )

private fun ControlsMappingSummary.toReadModel(): ControlsMappingSummaryReadModel =
  ControlsMappingSummaryReadModel(
    total = total,
    mapped = mapped,
    unmapped = unmapped
  )

private fun UnmappedAccount.toReadModel(): UnmappedAccountReadModel =
  UnmappedAccountReadModel(
    accountCode = accountCode,
    accountLabel = accountLabel,
    debit = debit.toApiDecimal(),
    credit = credit.toApiDecimal()
  )

private fun ControlResult.toReadModel(): ControlResultReadModel =
  ControlResultReadModel(
    code = code.toResponseValue(),
    status = status.toResponseValue(),
    severity = severity.toResponseValue(),
    message = message
  )

private fun ControlsNextAction.toReadModel(): ControlsNextActionReadModel =
  ControlsNextActionReadModel(
    code = code.toResponseValue(),
    path = path,
    actionable = actionable
  )

private fun ClosingReadiness.toResponseValue(): String = name

private fun ControlCode.toResponseValue(): String = name

private fun ControlStatus.toResponseValue(): String = name

private fun ControlSeverity.toResponseValue(): String = name

private fun ControlsNextActionCode.toResponseValue(): String = name

private fun BigDecimal.toApiDecimal(): String = stripTrailingZeros().toPlainString()
