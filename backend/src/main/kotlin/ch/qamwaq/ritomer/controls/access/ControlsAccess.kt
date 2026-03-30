package ch.qamwaq.ritomer.controls.access

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.controls.application.ClosingControls
import ch.qamwaq.ritomer.controls.application.ClosingReadiness
import ch.qamwaq.ritomer.controls.application.ControlStatus
import ch.qamwaq.ritomer.controls.application.ControlsNextAction
import ch.qamwaq.ritomer.controls.application.ControlsNextActionCode
import ch.qamwaq.ritomer.controls.application.ControlsService
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import java.util.UUID
import org.springframework.stereotype.Service

data class ClosingControlsSnapshot(
  val closingFolderStatus: ClosingFolderAccessStatus,
  val readiness: ControlsReadiness,
  val blockers: List<ControlsBlocker>,
  val nextAction: ControlsNextActionView?
)

data class ControlsBlocker(
  val code: String,
  val message: String
)

data class ControlsNextActionView(
  val code: ControlsNextActionViewCode,
  val path: String,
  val actionable: Boolean
)

enum class ControlsReadiness {
  READY,
  BLOCKED
}

enum class ControlsNextActionViewCode {
  IMPORT_BALANCE,
  COMPLETE_MANUAL_MAPPING
}

fun interface ControlsAccess {
  fun getSnapshot(access: TenantAccessContext, closingFolderId: UUID): ClosingControlsSnapshot
}

@Service
class ServiceBackedControlsAccess(
  private val controlsService: ControlsService
) : ControlsAccess {
  override fun getSnapshot(access: TenantAccessContext, closingFolderId: UUID): ClosingControlsSnapshot =
    controlsService.getControls(access, closingFolderId).toSnapshot()
}

private fun ClosingControls.toSnapshot(): ClosingControlsSnapshot =
  ClosingControlsSnapshot(
    closingFolderStatus = closingFolderStatus,
    readiness = readiness.toAccessReadiness(),
    blockers = controls
      .filter { it.status == ControlStatus.FAIL }
      .map {
        ControlsBlocker(
          code = it.code.name,
          message = it.message
        )
      },
    nextAction = nextAction?.toView()
  )

private fun ClosingReadiness.toAccessReadiness(): ControlsReadiness =
  when (this) {
    ClosingReadiness.READY -> ControlsReadiness.READY
    ClosingReadiness.BLOCKED -> ControlsReadiness.BLOCKED
  }

private fun ControlsNextAction.toView(): ControlsNextActionView =
  ControlsNextActionView(
    code = code.toViewCode(),
    path = path,
    actionable = actionable
  )

private fun ControlsNextActionCode.toViewCode(): ControlsNextActionViewCode =
  when (this) {
    ControlsNextActionCode.IMPORT_BALANCE -> ControlsNextActionViewCode.IMPORT_BALANCE
    ControlsNextActionCode.COMPLETE_MANUAL_MAPPING -> ControlsNextActionViewCode.COMPLETE_MANUAL_MAPPING
  }
