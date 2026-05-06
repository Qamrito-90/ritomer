package ch.qamwaq.ritomer.mapping.api

import ch.qamwaq.ritomer.identity.access.TenantAccessResolver
import ch.qamwaq.ritomer.mapping.application.MappingSuggestion
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionError
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionEvidence
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionsReadModel
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionsService
import com.fasterxml.jackson.annotation.JsonInclude
import java.util.UUID
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@Validated
@RestController
@RequestMapping("/api/closing-folders/{closingFolderId}/mappings/suggestions")
class MappingSuggestionsController(
  private val tenantAccessResolver: TenantAccessResolver,
  private val mappingSuggestionsService: MappingSuggestionsService
) {
  @GetMapping
  fun getSuggestions(
    @PathVariable closingFolderId: UUID
  ): MappingSuggestionsReadModelResponse =
    mappingSuggestionsService
      .getSuggestions(tenantAccessResolver.resolveRequiredTenantAccess(), closingFolderId)
      .toResponse()
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
  val modelVersion: String
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
    modelVersion = modelVersion
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
