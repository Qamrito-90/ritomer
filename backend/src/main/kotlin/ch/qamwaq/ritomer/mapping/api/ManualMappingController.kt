package ch.qamwaq.ritomer.mapping.api

import com.fasterxml.jackson.annotation.JsonInclude
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.identity.access.TenantAccessResolver
import ch.qamwaq.ritomer.mapping.application.ManualMappingEntry
import ch.qamwaq.ritomer.mapping.application.ManualMappingLineProjection
import ch.qamwaq.ritomer.mapping.application.ManualMappingProjection
import ch.qamwaq.ritomer.mapping.application.ManualMappingSummary
import ch.qamwaq.ritomer.mapping.application.ManualMappingTarget
import ch.qamwaq.ritomer.mapping.application.ManualMappingUpsertCommand
import ch.qamwaq.ritomer.mapping.application.ManualMappingUpsertOutcome
import ch.qamwaq.ritomer.mapping.application.ManualMappingService
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import java.math.BigDecimal
import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@Validated
@RestController
@RequestMapping("/api/closing-folders/{closingFolderId}/mappings/manual")
class ManualMappingController(
  private val tenantAccessResolver: TenantAccessResolver,
  private val manualMappingService: ManualMappingService
) {
  @GetMapping
  fun getProjection(
    @PathVariable closingFolderId: UUID
  ): ManualMappingProjectionResponse =
    manualMappingService.getProjection(resolveTenantAccess(), closingFolderId).toResponse()

  @PutMapping
  fun upsert(
    @PathVariable closingFolderId: UUID,
    @Valid @RequestBody request: ManualMappingUpsertRequest
  ): ResponseEntity<ManualMappingEntryResponse> {
    val result = manualMappingService.upsert(resolveTenantAccess(), closingFolderId, request.toCommand())
    val status = when (result.outcome) {
      ManualMappingUpsertOutcome.CREATED -> HttpStatus.CREATED
      ManualMappingUpsertOutcome.UPDATED,
      ManualMappingUpsertOutcome.NOOP -> HttpStatus.OK
    }

    return ResponseEntity.status(status).body(result.mapping.toResponse())
  }

  @DeleteMapping
  fun delete(
    @PathVariable closingFolderId: UUID,
    @RequestParam(required = false) accountCode: String?
  ): ResponseEntity<Void> {
    manualMappingService.delete(resolveTenantAccess(), closingFolderId, accountCode)
    return ResponseEntity.noContent().build()
  }

  private fun resolveTenantAccess(): TenantAccessContext =
    tenantAccessResolver.resolveRequiredTenantAccess()
}

data class ManualMappingUpsertRequest(
  @field:NotBlank
  val accountCode: String,
  @field:NotBlank
  val targetCode: String
)

@JsonInclude(JsonInclude.Include.ALWAYS)
data class ManualMappingProjectionResponse(
  val closingFolderId: String,
  val taxonomyVersion: Int,
  val latestImportVersion: Int?,
  val targets: List<ManualMappingTargetResponse>,
  val lines: List<ManualMappingLineResponse>,
  val mappings: List<ManualMappingEntryResponse>,
  val summary: ManualMappingSummaryResponse
)

data class ManualMappingTargetResponse(
  val code: String,
  val label: String,
  val statement: String,
  val summaryBucketCode: String,
  val sectionCode: String,
  val normalSide: String,
  val granularity: String,
  val deprecated: Boolean,
  val selectable: Boolean,
  val displayOrder: Int
)

data class ManualMappingLineResponse(
  val accountCode: String,
  val accountLabel: String,
  val debit: String,
  val credit: String
)

data class ManualMappingEntryResponse(
  val accountCode: String,
  val targetCode: String
)

data class ManualMappingSummaryResponse(
  val total: Int,
  val mapped: Int,
  val unmapped: Int
)

private fun ManualMappingUpsertRequest.toCommand(): ManualMappingUpsertCommand =
  ManualMappingUpsertCommand(
    accountCode = accountCode,
    targetCode = targetCode
  )

private fun ManualMappingProjection.toResponse(): ManualMappingProjectionResponse =
  ManualMappingProjectionResponse(
    closingFolderId = closingFolderId.toString(),
    taxonomyVersion = taxonomyVersion,
    latestImportVersion = latestImportVersion,
    targets = targets.map { it.toResponse() },
    lines = lines.map { it.toResponse() },
    mappings = mappings.map { it.toResponse() },
    summary = summary.toResponse()
  )

private fun ManualMappingTarget.toResponse(): ManualMappingTargetResponse =
  ManualMappingTargetResponse(
    code = code,
    label = label,
    statement = statement.name,
    summaryBucketCode = summaryBucketCode,
    sectionCode = sectionCode,
    normalSide = normalSide.name,
    granularity = granularity.name,
    deprecated = deprecated,
    selectable = selectable,
    displayOrder = displayOrder
  )

private fun ManualMappingLineProjection.toResponse(): ManualMappingLineResponse =
  ManualMappingLineResponse(
    accountCode = accountCode,
    accountLabel = accountLabel,
    debit = debit.toApiDecimal(),
    credit = credit.toApiDecimal()
  )

private fun ManualMappingEntry.toResponse(): ManualMappingEntryResponse =
  ManualMappingEntryResponse(
    accountCode = accountCode,
    targetCode = targetCode
  )

private fun ManualMappingSummary.toResponse(): ManualMappingSummaryResponse =
  ManualMappingSummaryResponse(
    total = total,
    mapped = mapped,
    unmapped = unmapped
  )

private fun BigDecimal.toApiDecimal(): String = stripTrailingZeros().toPlainString()
