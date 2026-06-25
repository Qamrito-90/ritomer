package ch.qamwaq.ritomer.mapping.api

import ch.qamwaq.ritomer.identity.access.TenantAccessResolver
import ch.qamwaq.ritomer.mapping.application.MAPPING_SUGGESTIONS_V2_OFFLINE_ENABLED_PROPERTY
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionV2Abstention
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionV2AccountPreconditionBlock
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionV2BatchUnavailable
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionV2InvalidModelOutput
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionV2Item
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionV2LocalInputInvalid
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionV2PolicyBlock
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionV2RequestPreconditionBlock
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionV2RequestTimeout
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionV2Suggestion
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionsV2OfflineService
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionsV2ReadModel
import java.util.UUID
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Profile
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@Validated
@RestController
@Profile("local")
@ConditionalOnProperty(
  name = [MAPPING_SUGGESTIONS_V2_OFFLINE_ENABLED_PROPERTY],
  havingValue = "true"
)
@RequestMapping("/api/closing-folders/{closingFolderId}/mappings/suggestions-v2")
class MappingSuggestionsV2Controller(
  private val tenantAccessResolver: TenantAccessResolver,
  private val mappingSuggestionsV2OfflineService: MappingSuggestionsV2OfflineService
) {
  @GetMapping
  fun getSuggestions(
    @PathVariable closingFolderId: UUID
  ): MappingSuggestionsV2ReadModelResponse =
    mappingSuggestionsV2OfflineService
      .getSuggestions(tenantAccessResolver.resolveRequiredTenantAccess(), closingFolderId)
      .toResponse()
}

data class MappingSuggestionsV2ReadModelResponse(
  val schemaVersion: String,
  val closingFolderId: String,
  val latestImportVersion: Int?,
  val taxonomyVersion: Int,
  val taxonomyHash: String,
  val items: List<MappingSuggestionV2ItemResponse>
)

sealed interface MappingSuggestionV2ItemResponse {
  val schemaVersion: String
  val outcome: String
  val scope: String
}

data class MappingSuggestionV2SuggestionResponse(
  override val schemaVersion: String,
  override val outcome: String,
  override val scope: String,
  val accountCode: String,
  val accountLabel: String,
  val targetCode: String,
  val explanationCode: String,
  val evidenceCodes: List<String>,
  val requiresHumanReview: Boolean,
  val suggestionFingerprint: String
) : MappingSuggestionV2ItemResponse

data class MappingSuggestionV2AbstentionResponse(
  override val schemaVersion: String,
  override val outcome: String,
  override val scope: String,
  val accountCode: String,
  val accountLabel: String,
  val abstentionReasonCode: String,
  val evidenceCodes: List<String>
) : MappingSuggestionV2ItemResponse

data class MappingSuggestionV2PolicyBlockResponse(
  override val schemaVersion: String,
  override val outcome: String,
  override val scope: String,
  val policyBlockCode: String
) : MappingSuggestionV2ItemResponse

data class MappingSuggestionV2AccountPreconditionBlockResponse(
  override val schemaVersion: String,
  override val outcome: String,
  override val scope: String,
  val accountCode: String,
  val accountLabel: String,
  val preconditionBlockCode: String
) : MappingSuggestionV2ItemResponse

data class MappingSuggestionV2RequestPreconditionBlockResponse(
  override val schemaVersion: String,
  override val outcome: String,
  override val scope: String,
  val preconditionBlockCode: String
) : MappingSuggestionV2ItemResponse

data class MappingSuggestionV2InvalidModelOutputResponse(
  override val schemaVersion: String,
  override val outcome: String,
  override val scope: String,
  val accountCode: String,
  val accountLabel: String,
  val degradationCode: String,
  val invalidReasonCodes: List<String>
) : MappingSuggestionV2ItemResponse

data class MappingSuggestionV2LocalInputInvalidResponse(
  override val schemaVersion: String,
  override val outcome: String,
  override val scope: String,
  val accountCode: String,
  val accountLabel: String,
  val degradationCode: String
) : MappingSuggestionV2ItemResponse

data class MappingSuggestionV2RequestDegradationResponse(
  override val schemaVersion: String,
  override val outcome: String,
  override val scope: String,
  val degradationCode: String
) : MappingSuggestionV2ItemResponse

data class MappingSuggestionV2BatchDegradationResponse(
  override val schemaVersion: String,
  override val outcome: String,
  override val scope: String,
  val degradationCode: String
) : MappingSuggestionV2ItemResponse

private fun MappingSuggestionsV2ReadModel.toResponse(): MappingSuggestionsV2ReadModelResponse =
  MappingSuggestionsV2ReadModelResponse(
    schemaVersion = schemaVersion,
    closingFolderId = closingFolderId.toString(),
    latestImportVersion = latestImportVersion,
    taxonomyVersion = taxonomyVersion,
    taxonomyHash = taxonomyHash,
    items = items.map { it.toResponse() }
  )

private fun MappingSuggestionV2Item.toResponse(): MappingSuggestionV2ItemResponse =
  when (this) {
    is MappingSuggestionV2Suggestion -> MappingSuggestionV2SuggestionResponse(
      schemaVersion = schemaVersion,
      outcome = outcome.name,
      scope = scope.name,
      accountCode = accountCode,
      accountLabel = accountLabel,
      targetCode = targetCode,
      explanationCode = explanationCode.name,
      evidenceCodes = evidenceCodes.map { it.name },
      requiresHumanReview = requiresHumanReview,
      suggestionFingerprint = suggestionFingerprint
    )
    is MappingSuggestionV2Abstention -> MappingSuggestionV2AbstentionResponse(
      schemaVersion = schemaVersion,
      outcome = outcome.name,
      scope = scope.name,
      accountCode = accountCode,
      accountLabel = accountLabel,
      abstentionReasonCode = abstentionReasonCode.name,
      evidenceCodes = evidenceCodes.map { it.name }
    )
    is MappingSuggestionV2PolicyBlock -> MappingSuggestionV2PolicyBlockResponse(
      schemaVersion = schemaVersion,
      outcome = outcome.name,
      scope = scope.name,
      policyBlockCode = policyBlockCode.name
    )
    is MappingSuggestionV2AccountPreconditionBlock -> MappingSuggestionV2AccountPreconditionBlockResponse(
      schemaVersion = schemaVersion,
      outcome = outcome.name,
      scope = scope.name,
      accountCode = accountCode,
      accountLabel = accountLabel,
      preconditionBlockCode = preconditionBlockCode.name
    )
    is MappingSuggestionV2RequestPreconditionBlock -> MappingSuggestionV2RequestPreconditionBlockResponse(
      schemaVersion = schemaVersion,
      outcome = outcome.name,
      scope = scope.name,
      preconditionBlockCode = preconditionBlockCode.name
    )
    is MappingSuggestionV2InvalidModelOutput -> MappingSuggestionV2InvalidModelOutputResponse(
      schemaVersion = schemaVersion,
      outcome = outcome.name,
      scope = scope.name,
      accountCode = accountCode,
      accountLabel = accountLabel,
      degradationCode = degradationCode.name,
      invalidReasonCodes = invalidReasonCodes.map { it.name }
    )
    is MappingSuggestionV2LocalInputInvalid -> MappingSuggestionV2LocalInputInvalidResponse(
      schemaVersion = schemaVersion,
      outcome = outcome.name,
      scope = scope.name,
      accountCode = accountCode,
      accountLabel = accountLabel,
      degradationCode = degradationCode.name
    )
    is MappingSuggestionV2RequestTimeout -> MappingSuggestionV2RequestDegradationResponse(
      schemaVersion = schemaVersion,
      outcome = outcome.name,
      scope = scope.name,
      degradationCode = degradationCode.name
    )
    is MappingSuggestionV2BatchUnavailable -> MappingSuggestionV2BatchDegradationResponse(
      schemaVersion = schemaVersion,
      outcome = outcome.name,
      scope = scope.name,
      degradationCode = degradationCode.name
    )
  }
