package ch.qamwaq.ritomer.mapping.api

import ch.qamwaq.ritomer.identity.access.TenantAccessResolver
import ch.qamwaq.ritomer.mapping.application.MappingSuggestion
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionDecisionCommand
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionDecisionBadRequestException
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionDecisionResult
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionDecisionService
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionError
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionEvidence
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionsReadModel
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionsService
import com.fasterxml.jackson.annotation.JsonAnySetter
import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonInclude
import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@Validated
@RestController
@RequestMapping("/api/closing-folders/{closingFolderId}/mappings/suggestions")
class MappingSuggestionsController(
  private val tenantAccessResolver: TenantAccessResolver,
  private val mappingSuggestionsService: MappingSuggestionsService,
  private val mappingSuggestionDecisionService: MappingSuggestionDecisionService
) {
  @GetMapping
  fun getSuggestions(
    @PathVariable closingFolderId: UUID
  ): MappingSuggestionsReadModelResponse =
    mappingSuggestionsService
      .getSuggestions(tenantAccessResolver.resolveRequiredTenantAccess(), closingFolderId)
      .toResponse()

  @PostMapping("/{accountCode}/decision")
  fun recordDecision(
    @PathVariable closingFolderId: UUID,
    @PathVariable accountCode: String,
    @RequestHeader("Idempotency-Key", required = false) idempotencyKey: String?,
    @RequestBody request: MappingSuggestionDecisionRequest
  ): ResponseEntity<MappingSuggestionDecisionResultResponse> {
    if (request.unknownProperties.isNotEmpty()) {
      throw MappingSuggestionDecisionBadRequestException("Decision request contains unknown fields.")
    }

    val result = mappingSuggestionDecisionService.recordDecision(
      access = tenantAccessResolver.resolveRequiredTenantAccess(),
      closingFolderId = closingFolderId,
      command = MappingSuggestionDecisionCommand(
        accountCode = accountCode,
        idempotencyKey = idempotencyKey,
        decision = request.decision,
        latestImportVersion = request.latestImportVersion,
        suggestionFingerprint = request.suggestionFingerprint,
        targetCode = request.targetCode,
        reviewComment = request.reviewComment
      )
    )

    val status = if (result.resultKind.isConflict) HttpStatus.CONFLICT else HttpStatus.OK
    return ResponseEntity.status(status).body(result.toResponse())
  }
}

@JsonInclude(JsonInclude.Include.ALWAYS)
data class MappingSuggestionsReadModelResponse(
  val state: String,
  val closingFolderId: String,
  val latestImportVersion: Int?,
  val taxonomyVersion: Int,
  val suggestions: List<MappingSuggestionResponse>,
  val errors: List<MappingSuggestionErrorResponse>
)

data class MappingSuggestionResponse(
  val accountCode: String,
  val accountLabel: String,
  val suggestedTargetCode: String,
  val confidence: Double,
  val riskLevel: String,
  val rationale: String,
  val evidence: List<MappingSuggestionEvidenceResponse>,
  val requiresHumanReview: Boolean,
  val schemaVersion: String,
  val promptVersion: String,
  val modelVersion: String,
  val suggestionFingerprint: String
)

data class MappingSuggestionEvidenceResponse(
  val type: String,
  val ref: String,
  val snippet: String
)

data class MappingSuggestionErrorResponse(
  val code: String,
  val message: String
)

data class MappingSuggestionDecisionRequest(
  val decision: String? = null,
  val latestImportVersion: Int? = null,
  val suggestionFingerprint: String? = null,
  val targetCode: String? = null,
  val reviewComment: String? = null
) {
  @get:JsonIgnore
  val unknownProperties: MutableSet<String> = linkedSetOf()

  @JsonAnySetter
  @Suppress("UNUSED_PARAMETER")
  fun captureUnknownProperty(name: String, value: Any?) {
    unknownProperties += name
  }
}

@JsonInclude(JsonInclude.Include.ALWAYS)
data class MappingSuggestionDecisionResultResponse(
  val decision: String,
  val accountCode: String,
  val resultKind: String,
  val appliedMapping: AppliedManualMappingResponse?
)

data class AppliedManualMappingResponse(
  val accountCode: String,
  val targetCode: String
)

private fun MappingSuggestionsReadModel.toResponse(): MappingSuggestionsReadModelResponse =
  MappingSuggestionsReadModelResponse(
    state = state.name,
    closingFolderId = closingFolderId.toString(),
    latestImportVersion = latestImportVersion,
    taxonomyVersion = taxonomyVersion,
    suggestions = suggestions.map { it.toResponse() },
    errors = errors.map { it.toResponse() }
  )

private fun MappingSuggestion.toResponse(): MappingSuggestionResponse =
  MappingSuggestionResponse(
    accountCode = accountCode,
    accountLabel = accountLabel,
    suggestedTargetCode = suggestedTargetCode,
    confidence = confidence,
    riskLevel = riskLevel.name,
    rationale = rationale,
    evidence = evidence.map { it.toResponse() },
    requiresHumanReview = requiresHumanReview,
    schemaVersion = schemaVersion,
    promptVersion = promptVersion,
    modelVersion = modelVersion,
    suggestionFingerprint = suggestionFingerprint
  )

private fun MappingSuggestionEvidence.toResponse(): MappingSuggestionEvidenceResponse =
  MappingSuggestionEvidenceResponse(
    type = type.name,
    ref = ref,
    snippet = snippet
  )

private fun MappingSuggestionError.toResponse(): MappingSuggestionErrorResponse =
  MappingSuggestionErrorResponse(
    code = code.name,
    message = message
  )

private fun MappingSuggestionDecisionResult.toResponse(): MappingSuggestionDecisionResultResponse =
  MappingSuggestionDecisionResultResponse(
    decision = decision.name,
    accountCode = accountCode,
    resultKind = resultKind.name,
    appliedMapping = appliedMapping?.let {
      AppliedManualMappingResponse(
        accountCode = it.accountCode,
        targetCode = it.targetCode
      )
    }
  )
