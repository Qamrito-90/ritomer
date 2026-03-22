package ch.qamwaq.ritomer.imports.api

import com.fasterxml.jackson.annotation.JsonInclude
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.identity.access.TenantAccessResolver
import ch.qamwaq.ritomer.imports.application.BalanceImportBadRequestException
import ch.qamwaq.ritomer.imports.application.BalanceImportService
import ch.qamwaq.ritomer.imports.application.BalanceImportValidationError
import ch.qamwaq.ritomer.imports.application.CreatedBalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportDiff
import ch.qamwaq.ritomer.imports.domain.BalanceImportDiffSummary
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.imports.domain.BalanceImportLineChange
import java.math.BigDecimal
import java.net.URI
import java.time.OffsetDateTime
import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

@Validated
@RestController
@RequestMapping("/api/closing-folders/{closingFolderId}/imports/balance")
class BalanceImportController(
  private val tenantAccessResolver: TenantAccessResolver,
  private val balanceImportService: BalanceImportService
) {
  @PostMapping(consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
  fun create(
    @PathVariable closingFolderId: UUID,
    @RequestPart("file") file: MultipartFile
  ): ResponseEntity<CreatedBalanceImportResponse> {
    val created = balanceImportService.create(resolveTenantAccess(), closingFolderId, file)

    return ResponseEntity
      .created(URI.create("/api/closing-folders/$closingFolderId/imports/balance/versions/${created.balanceImport.version}"))
      .body(created.toResponse())
  }

  @GetMapping("/versions")
  fun listVersions(
    @PathVariable closingFolderId: UUID
  ): List<BalanceImportVersionResponse> =
    balanceImportService.listVersions(resolveTenantAccess(), closingFolderId).map { it.toVersionResponse() }

  @GetMapping("/versions/{version}/diff-previous")
  fun getDiff(
    @PathVariable closingFolderId: UUID,
    @PathVariable version: Int
  ): BalanceImportDiffResponse =
    balanceImportService.getDiff(resolveTenantAccess(), closingFolderId, version).toResponse()

  @ExceptionHandler(BalanceImportBadRequestException::class)
  fun handleBadRequest(exception: BalanceImportBadRequestException): ResponseEntity<BalanceImportErrorResponse> =
    ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
      BalanceImportErrorResponse(
        message = exception.message ?: "Balance import request is invalid.",
        errors = exception.errors.map { it.toResponse() }
      )
    )

  private fun resolveTenantAccess(): TenantAccessContext =
    tenantAccessResolver.resolveRequiredTenantAccess()
}

data class CreatedBalanceImportResponse(
  val importId: String,
  val version: Int,
  val closingFolderId: String,
  val importedAt: OffsetDateTime,
  val importedByUserId: String,
  val rowCount: Int,
  val totalDebit: String,
  val totalCredit: String,
  val diffSummary: BalanceImportDiffSummaryResponse
)

data class BalanceImportVersionResponse(
  val importId: String,
  val version: Int,
  val closingFolderId: String,
  val importedAt: OffsetDateTime,
  val importedByUserId: String,
  val rowCount: Int,
  val totalDebit: String,
  val totalCredit: String
)

@JsonInclude(JsonInclude.Include.ALWAYS)
data class BalanceImportDiffResponse(
  val version: Int,
  val previousVersion: Int?,
  val added: List<BalanceImportLineResponse>,
  val removed: List<BalanceImportLineResponse>,
  val changed: List<BalanceImportLineChangeResponse>
)

data class BalanceImportLineResponse(
  val accountCode: String,
  val accountLabel: String,
  val debit: String,
  val credit: String
)

data class BalanceImportLineChangeResponse(
  val accountCode: String,
  val before: BalanceImportLineResponse,
  val after: BalanceImportLineResponse
)

@JsonInclude(JsonInclude.Include.ALWAYS)
data class BalanceImportDiffSummaryResponse(
  val previousVersion: Int?,
  val addedCount: Int,
  val removedCount: Int,
  val changedCount: Int
)

data class BalanceImportErrorResponse(
  val message: String,
  val errors: List<BalanceImportValidationErrorResponse>
)

data class BalanceImportValidationErrorResponse(
  val line: Int?,
  val field: String?,
  val message: String
)

private fun CreatedBalanceImport.toResponse(): CreatedBalanceImportResponse =
  CreatedBalanceImportResponse(
    importId = balanceImport.id.toString(),
    version = balanceImport.version,
    closingFolderId = balanceImport.closingFolderId.toString(),
    importedAt = balanceImport.importedAt,
    importedByUserId = balanceImport.importedByUserId.toString(),
    rowCount = balanceImport.rowCount,
    totalDebit = balanceImport.totalDebit.toApiDecimal(),
    totalCredit = balanceImport.totalCredit.toApiDecimal(),
    diffSummary = diffSummary.toResponse()
  )

private fun BalanceImport.toVersionResponse(): BalanceImportVersionResponse =
  BalanceImportVersionResponse(
    importId = id.toString(),
    version = version,
    closingFolderId = closingFolderId.toString(),
    importedAt = importedAt,
    importedByUserId = importedByUserId.toString(),
    rowCount = rowCount,
    totalDebit = totalDebit.toApiDecimal(),
    totalCredit = totalCredit.toApiDecimal()
  )

private fun BalanceImportDiff.toResponse(): BalanceImportDiffResponse =
  BalanceImportDiffResponse(
    version = version,
    previousVersion = previousVersion,
    added = added.map { it.toResponse() },
    removed = removed.map { it.toResponse() },
    changed = changed.map { it.toResponse() }
  )

private fun BalanceImportLine.toResponse(): BalanceImportLineResponse =
  BalanceImportLineResponse(
    accountCode = accountCode,
    accountLabel = accountLabel,
    debit = debit.toApiDecimal(),
    credit = credit.toApiDecimal()
  )

private fun BalanceImportLineChange.toResponse(): BalanceImportLineChangeResponse =
  BalanceImportLineChangeResponse(
    accountCode = accountCode,
    before = before.toResponse(),
    after = after.toResponse()
  )

private fun BalanceImportDiffSummary.toResponse(): BalanceImportDiffSummaryResponse =
  BalanceImportDiffSummaryResponse(
    previousVersion = previousVersion,
    addedCount = addedCount,
    removedCount = removedCount,
    changedCount = changedCount
  )

private fun BalanceImportValidationError.toResponse(): BalanceImportValidationErrorResponse =
  BalanceImportValidationErrorResponse(
    line = line,
    field = field,
    message = message
  )

private fun BigDecimal.toApiDecimal(): String = stripTrailingZeros().toPlainString()
