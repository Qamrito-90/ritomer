package ch.qamwaq.ritomer.controls.api

import ch.qamwaq.ritomer.controls.application.ClosingControls
import ch.qamwaq.ritomer.controls.application.ClosingReadiness
import ch.qamwaq.ritomer.controls.application.ControlCode
import ch.qamwaq.ritomer.controls.application.ControlResult
import ch.qamwaq.ritomer.controls.application.ControlsMappingSummary
import ch.qamwaq.ritomer.controls.application.ControlsNextAction
import ch.qamwaq.ritomer.controls.application.ControlsNextActionCode
import ch.qamwaq.ritomer.controls.application.ControlsService
import ch.qamwaq.ritomer.controls.application.ControlSeverity
import ch.qamwaq.ritomer.controls.application.ControlStatus
import ch.qamwaq.ritomer.controls.application.UnmappedAccount
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
@RequestMapping("/api/closing-folders/{closingFolderId}/controls")
class ControlsController(
  private val tenantAccessResolver: TenantAccessResolver,
  private val controlsService: ControlsService
) {
  @GetMapping
  fun getControls(
    @PathVariable closingFolderId: UUID
  ): ControlsResponse =
    controlsService.getControls(resolveTenantAccess(), closingFolderId).toResponse()

  private fun resolveTenantAccess(): TenantAccessContext =
    tenantAccessResolver.resolveRequiredTenantAccess()
}

@JsonInclude(JsonInclude.Include.ALWAYS)
data class ControlsResponse(
  val closingFolderId: String,
  val closingFolderStatus: String,
  val readiness: String,
  val latestImportPresent: Boolean,
  val latestImportVersion: Int?,
  val mappingSummary: ControlsMappingSummaryResponse,
  val unmappedAccounts: List<UnmappedAccountResponse>,
  val controls: List<ControlResultResponse>,
  val nextAction: ControlsNextActionResponse?
)

data class ControlsMappingSummaryResponse(
  val total: Int,
  val mapped: Int,
  val unmapped: Int
)

data class UnmappedAccountResponse(
  val accountCode: String,
  val accountLabel: String,
  val debit: String,
  val credit: String
)

data class ControlResultResponse(
  val code: String,
  val status: String,
  val severity: String,
  val message: String
)

data class ControlsNextActionResponse(
  val code: String,
  val path: String,
  val actionable: Boolean
)

private fun ClosingControls.toResponse(): ControlsResponse =
  ControlsResponse(
    closingFolderId = closingFolderId.toString(),
    closingFolderStatus = closingFolderStatus.name,
    readiness = readiness.toResponseValue(),
    latestImportPresent = latestImportPresent,
    latestImportVersion = latestImportVersion,
    mappingSummary = mappingSummary.toResponse(),
    unmappedAccounts = unmappedAccounts.map { it.toResponse() },
    controls = controls.map { it.toResponse() },
    nextAction = nextAction?.toResponse()
  )

private fun ControlsMappingSummary.toResponse(): ControlsMappingSummaryResponse =
  ControlsMappingSummaryResponse(
    total = total,
    mapped = mapped,
    unmapped = unmapped
  )

private fun UnmappedAccount.toResponse(): UnmappedAccountResponse =
  UnmappedAccountResponse(
    accountCode = accountCode,
    accountLabel = accountLabel,
    debit = debit.toApiDecimal(),
    credit = credit.toApiDecimal()
  )

private fun ControlResult.toResponse(): ControlResultResponse =
  ControlResultResponse(
    code = code.toResponseValue(),
    status = status.toResponseValue(),
    severity = severity.toResponseValue(),
    message = message
  )

private fun ControlsNextAction.toResponse(): ControlsNextActionResponse =
  ControlsNextActionResponse(
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
