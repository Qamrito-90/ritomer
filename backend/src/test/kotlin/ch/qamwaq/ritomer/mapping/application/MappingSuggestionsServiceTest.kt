package ch.qamwaq.ritomer.mapping.application

import ch.qamwaq.ritomer.ai.access.AiMappingSuggestion
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionAccount
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionBalanceSignal
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionEvidence
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionEvidenceType
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionGenerationRequest
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionGenerationResult
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionRiskLevel
import ch.qamwaq.ritomer.ai.access.MappingSuggestionGenerationAccess
import ch.qamwaq.ritomer.ai.application.DeterministicMappingSuggestionAdapterStub
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
import org.junit.jupiter.api.Test

class MappingSuggestionsServiceTest {
  @Test
  fun `feature flag off returns disabled and does not call adapter`() {
    val generationAccess = RecordingGenerationAccess()
    val service = service(
      mappingSuggestionsEnabled = false,
      generationAccess = generationAccess,
      projection = projection(latestImportVersion = 3)
    )

    val readModel = service.getSuggestions(access(), CLOSING_FOLDER_ID)

    assertThat(readModel.state).isEqualTo(MappingSuggestionsState.DISABLED)
    assertThat(readModel.suggestions).isEmpty()
    assertThat(readModel.latestImportVersion).isNull()
    assertThat(readModel.taxonomyVersion).isEqualTo(2)
    assertThat(generationAccess.calls).isZero()
  }

  @Test
  fun `no import returns no import and does not call adapter`() {
    val generationAccess = RecordingGenerationAccess()
    val service = service(
      generationAccess = generationAccess,
      projection = projection(latestImportVersion = null, lines = emptyList())
    )

    val readModel = service.getSuggestions(access(), CLOSING_FOLDER_ID)

    assertThat(readModel.state).isEqualTo(MappingSuggestionsState.NO_IMPORT)
    assertThat(readModel.suggestions).isEmpty()
    assertThat(readModel.latestImportVersion).isNull()
    assertThat(generationAccess.calls).isZero()
  }

  @Test
  fun `archived closing is read only and does not call adapter`() {
    val generationAccess = RecordingGenerationAccess()
    val service = service(
      closingStatus = ClosingFolderAccessStatus.ARCHIVED,
      generationAccess = generationAccess,
      projection = projection(latestImportVersion = 4)
    )

    val readModel = service.getSuggestions(access(), CLOSING_FOLDER_ID)

    assertThat(readModel.state).isEqualTo(MappingSuggestionsState.ARCHIVED_READ_ONLY)
    assertThat(readModel.latestImportVersion).isEqualTo(4)
    assertThat(readModel.suggestions).isEmpty()
    assertThat(generationAccess.calls).isZero()
  }

  @Test
  fun `latest import version taxonomy version and minimized eligible accounts are passed deterministically`() {
    val generationAccess = RecordingGenerationAccess(
      AiMappingSuggestionGenerationResult(
        suggestions = listOf(validSuggestion(accountCode = "2000", accountLabel = "Revenue"))
      )
    )
    val service = service(
      generationAccess = generationAccess,
      projection = projection(
        latestImportVersion = 7,
        lines = listOf(
          line("1000", "Cash"),
          line("2000", "Revenue john@example.com ref 123456789", debit = BigDecimal.ZERO, credit = BigDecimal("100.00")),
          line("3000", "Payable +41 79 123 45 67", debit = BigDecimal("40.00"), credit = BigDecimal("100.00"))
        ),
        mappings = listOf(ProjectedManualMappingEntry("1000", "BS.ASSET.CASH_AND_EQUIVALENTS", "BS.ASSET"))
      )
    )

    val readModel = service.getSuggestions(access(), CLOSING_FOLDER_ID)

    assertThat(readModel.state).isEqualTo(MappingSuggestionsState.READY)
    assertThat(readModel.latestImportVersion).isEqualTo(7)
    assertThat(readModel.taxonomyVersion).isEqualTo(2)
    assertThat(generationAccess.requests).hasSize(1)
    assertThat(generationAccess.requests.single().latestImportVersion).isEqualTo(7)
    assertThat(generationAccess.requests.single().taxonomyVersion).isEqualTo(2)
    assertThat(generationAccess.requests.single().accounts.map { it.accountCode })
      .containsExactly("2000", "3000")
    assertThat(generationAccess.requests.single().accounts.map { it.sanitizedAccountLabel })
      .containsExactly("Revenue", "Payable")
    assertThat(generationAccess.requests.single().accounts.map { it.balanceSignal })
      .containsExactly(AiMappingSuggestionBalanceSignal.CREDIT_ONLY, AiMappingSuggestionBalanceSignal.CREDIT_DOMINANT)
    assertThat(generationAccess.requests.single().targets)
      .allSatisfy {
        assertThat(it.selectable).isTrue()
        assertThat(it.deprecated).isFalse()
      }
    assertThat(generationAccess.requests.single().targets.map { it.code })
      .doesNotContain("BS.ASSET", "BS.ASSET.CURRENT_SECTION")
    assertThat(readModel.suggestions.map { it.accountCode }).containsExactly("2000")
  }

  @Test
  fun `captured ai access request contains no raw identifiers amounts prompt provider or secrets`() {
    val rawLabel = "Bank CHF secret@example.com +41 79 123 45 67 ref 987654321012"
    val generationAccess = RecordingGenerationAccess()
    val service = service(
      generationAccess = generationAccess,
      projection = projection(
        latestImportVersion = 7,
        lines = listOf(line("1000", rawLabel, debit = BigDecimal("12345.67"), credit = BigDecimal.ZERO))
      )
    )

    service.getSuggestions(access(), CLOSING_FOLDER_ID)

    val request = generationAccess.requests.single()
    assertThat(request::class.java.declaredFields.map { it.name })
      .doesNotContain("tenantId", "actorId", "roles", "closingFolderId", "debit", "credit", "prompt", "provider", "secret")
    assertThat(AiMappingSuggestionAccount::class.java.declaredFields.map { it.name })
      .containsExactlyInAnyOrder("accountCode", "sanitizedAccountLabel", "balanceSignal")
    assertThat(request.toString())
      .doesNotContain(
        TENANT_ID.toString(),
        CLOSING_FOLDER_ID.toString(),
        "99999999-9999-9999-9999-999999999999",
        "ACCOUNTANT",
        rawLabel,
        "secret@example.com",
        "+41 79 123 45 67",
        "987654321012",
        "12345.67",
        "prompt",
        "provider",
        "secret"
      )
    assertThat(request.accounts.single().sanitizedAccountLabel).isEqualTo("Bank CHF")
    assertThat(request.accounts.single().balanceSignal).isEqualTo(AiMappingSuggestionBalanceSignal.DEBIT_ONLY)
  }

  @Test
  fun `deterministic stub uses sanitized label for evidence while read model keeps original tenant scoped label`() {
    val rawLabel = "Bank CHF jane.doe@example.com +41 79 123 45 67 ref 987654321012"
    val service = service(
      generationAccess = DeterministicMappingSuggestionAdapterStub(),
      projection = projection(
        latestImportVersion = 2,
        lines = listOf(line("1000", rawLabel))
      )
    )

    val firstReadModel = service.getSuggestions(access(), CLOSING_FOLDER_ID)
    val secondReadModel = service.getSuggestions(access(), CLOSING_FOLDER_ID)
    val suggestion = firstReadModel.suggestions.single()

    assertThat(secondReadModel).isEqualTo(firstReadModel)
    assertThat(suggestion.accountLabel).isEqualTo(rawLabel)
    assertThat(suggestion.evidence.first { it.type == MappingSuggestionEvidenceType.ACCOUNT_LABEL }.snippet)
      .isEqualTo("Bank CHF")
    assertThat(suggestion.evidence.joinToString(" ") { it.snippet })
      .doesNotContain("jane.doe@example.com", "+41 79 123 45 67", "987654321012")
  }

  @Test
  fun `valid stub-shaped suggestion keeps the evidence first human review contract`() {
    val service = service(
      generationAccess = RecordingGenerationAccess(
        AiMappingSuggestionGenerationResult(
          suggestions = listOf(validSuggestion(accountCode = "1000", accountLabel = "Bank CHF"))
        )
      ),
      projection = projection(
        latestImportVersion = 2,
        lines = listOf(line("1000", "Bank CHF"))
      )
    )

    val suggestion = service.getSuggestions(access(), CLOSING_FOLDER_ID).suggestions.single()

    assertThat(suggestion.accountCode).isEqualTo("1000")
    assertThat(suggestion.accountLabel).isEqualTo("Bank CHF")
    assertThat(suggestion.suggestedTargetCode).isEqualTo("BS.ASSET.CASH_AND_EQUIVALENTS")
    assertThat(suggestion.confidence).isBetween(0.0, 1.0)
    assertThat(suggestion.riskLevel).isIn(MappingSuggestionRiskLevel.LOW, MappingSuggestionRiskLevel.MEDIUM, MappingSuggestionRiskLevel.HIGH)
    assertThat(suggestion.evidence).isNotEmpty()
    assertThat(suggestion.requiresHumanReview).isTrue()
    assertThat(suggestion.schemaVersion).isEqualTo("mapping-suggestion-v1")
    assertThat(suggestion.promptVersion).isEqualTo("not_applicable_for_stub")
    assertThat(suggestion.modelVersion).isEqualTo("not_applicable_for_stub")
  }

  @Test
  fun `suggestions for absent mapped unknown deprecated or non selectable targets are not exposed`() {
    val service = service(
      generationAccess = RecordingGenerationAccess(
        AiMappingSuggestionGenerationResult(
          suggestions = listOf(
            validSuggestion(accountCode = "9999", accountLabel = "Outside import"),
            validSuggestion(accountCode = "1000", accountLabel = "Mapped cash"),
            validSuggestion(accountCode = "2000", accountLabel = "Revenue", suggestedTargetCode = "BS.ASSET"),
            validSuggestion(accountCode = "3000", accountLabel = "Payable", suggestedTargetCode = "BS.ASSET.CURRENT_SECTION"),
            validSuggestion(accountCode = "4000", accountLabel = "Other", suggestedTargetCode = "UNKNOWN")
          )
        )
      ),
      projection = projection(
        latestImportVersion = 5,
        lines = listOf(line("1000", "Mapped cash"), line("2000", "Revenue"), line("3000", "Payable"), line("4000", "Other")),
        mappings = listOf(ProjectedManualMappingEntry("1000", "BS.ASSET.CASH_AND_EQUIVALENTS", "BS.ASSET"))
      )
    )

    val readModel = service.getSuggestions(access(), CLOSING_FOLDER_ID)

    assertThat(readModel.state).isEqualTo(MappingSuggestionsState.INVALID_MODEL_OUTPUT)
    assertThat(readModel.suggestions).isEmpty()
    assertThat(readModel.errors.map { it.code }).containsExactly(MappingSuggestionErrorCode.INVALID_MODEL_OUTPUT)
    assertThat(readModel.errors.joinToString(" ") { "${it.code} ${it.message}" }.lowercase())
      .doesNotContain("secret", "token", "credential", "dsn", ".env", "raw csv", "storage_object_key", "signed url")
  }

  @Test
  fun `valid suggestion plus rejected output returns partial and exposes only safe suggestion`() {
    val service = service(
      generationAccess = RecordingGenerationAccess(
        AiMappingSuggestionGenerationResult(
          suggestions = listOf(
            validSuggestion(accountCode = "1000", accountLabel = "Bank CHF"),
            validSuggestion(
              accountCode = "2000",
              accountLabel = "Revenue",
              suggestedTargetCode = "BS.ASSET.CURRENT_SECTION"
            )
          )
        )
      ),
      projection = projection(
        latestImportVersion = 6,
        lines = listOf(line("1000", "Bank CHF"), line("2000", "Revenue"))
      )
    )

    val readModel = service.getSuggestions(access(), CLOSING_FOLDER_ID)

    assertThat(readModel.state).isEqualTo(MappingSuggestionsState.PARTIAL)
    assertThat(readModel.suggestions.map { it.accountCode }).containsExactly("1000")
    assertThat(readModel.suggestions.single().suggestedTargetCode).isEqualTo("BS.ASSET.CASH_AND_EQUIVALENTS")
    assertThat(readModel.errors.map { it.code }).containsExactly(MappingSuggestionErrorCode.PARTIAL_SUGGESTIONS)
  }

  @Test
  fun `sensitive or non selectable output is rejected with explicit non ready state`() {
    val service = service(
      generationAccess = RecordingGenerationAccess(
        AiMappingSuggestionGenerationResult(
          suggestions = listOf(
            validSuggestion(
              accountCode = "1000",
              accountLabel = "Bank CHF",
              rationale = "Contains secret material",
              evidence = listOf(
                AiMappingSuggestionEvidence(
                  type = AiMappingSuggestionEvidenceType.ACCOUNT_LABEL,
                  ref = "storage_object_key:private",
                  snippet = "raw CSV payload"
                )
              )
            ),
            validSuggestion(
              accountCode = "2000",
              accountLabel = "Revenue",
              suggestedTargetCode = "BS.ASSET.CURRENT_SECTION"
            )
          )
        )
      ),
      projection = projection(
        latestImportVersion = 6,
        lines = listOf(line("1000", "Bank CHF"), line("2000", "Revenue"))
      )
    )

    val readModel = service.getSuggestions(access(), CLOSING_FOLDER_ID)

    assertThat(readModel.state).isEqualTo(MappingSuggestionsState.INVALID_MODEL_OUTPUT)
    assertThat(readModel.suggestions).isEmpty()
    assertThat(readModel.errors.map { it.code }).containsExactly(MappingSuggestionErrorCode.INVALID_MODEL_OUTPUT)
    assertThat(readModel.errors.joinToString(" ") { "${it.code} ${it.message}" }.lowercase())
      .doesNotContain("secret", "token", "credential", "dsn", ".env", "raw csv", "storage_object_key", "signed url")
  }

  private fun service(
    mappingSuggestionsEnabled: Boolean = true,
    closingStatus: ClosingFolderAccessStatus = ClosingFolderAccessStatus.DRAFT,
    generationAccess: MappingSuggestionGenerationAccess = RecordingGenerationAccess(),
    projection: CurrentManualMappingProjection = projection(latestImportVersion = 1)
  ): MappingSuggestionsService =
    MappingSuggestionsService(
      closingFolderAccess = closingFolderAccess(closingStatus),
      manualMappingAccess = ManualMappingAccess { _, _ -> projection },
      manualMappingTargetCatalog = ClasspathManualMappingTargetCatalog(),
      mappingSuggestionGenerationAccess = generationAccess,
      mappingSuggestionsEnabled = mappingSuggestionsEnabled
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

  private class RecordingGenerationAccess(
    private val result: AiMappingSuggestionGenerationResult = AiMappingSuggestionGenerationResult(emptyList())
  ) : MappingSuggestionGenerationAccess {
    var calls: Int = 0
      private set
    val requests = mutableListOf<AiMappingSuggestionGenerationRequest>()

    override fun generate(request: AiMappingSuggestionGenerationRequest): AiMappingSuggestionGenerationResult {
      calls += 1
      requests.add(request)
      return result
    }
  }

  private companion object {
    private val TENANT_ID: UUID = UUID.fromString("11111111-1111-1111-1111-111111111111")
    private val CLOSING_FOLDER_ID: UUID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

    private fun access(roles: Set<String> = setOf("ACCOUNTANT")) = TenantAccessContext(
      actorUserId = UUID.fromString("99999999-9999-9999-9999-999999999999"),
      actorSubject = "mapping-suggestions-user",
      tenantId = TENANT_ID,
      effectiveRoles = roles
    )

    private fun projection(
      latestImportVersion: Int?,
      lines: List<ProjectedManualMappingLine> = listOf(line("1000", "Bank CHF")),
      mappings: List<ProjectedManualMappingEntry> = emptyList()
    ): CurrentManualMappingProjection =
      CurrentManualMappingProjection(
        closingFolderId = CLOSING_FOLDER_ID,
        latestImportVersion = latestImportVersion,
        lines = lines,
        mappings = mappings,
        summary = ProjectedManualMappingSummary(
          total = lines.size,
          mapped = mappings.size,
          unmapped = lines.size - mappings.size
        )
      )

    private fun line(
      accountCode: String,
      accountLabel: String,
      debit: BigDecimal = BigDecimal("100.00"),
      credit: BigDecimal = BigDecimal.ZERO
    ): ProjectedManualMappingLine =
      ProjectedManualMappingLine(
        lineNo = accountCode.toIntOrNull() ?: 1,
        accountCode = accountCode,
        accountLabel = accountLabel,
        debit = debit,
        credit = credit
      )

    private fun validSuggestion(
      accountCode: String,
      accountLabel: String,
      suggestedTargetCode: String = "BS.ASSET.CASH_AND_EQUIVALENTS",
      rationale: String = "Account label and target taxonomy are consistent.",
      evidence: List<AiMappingSuggestionEvidence> = listOf(
        AiMappingSuggestionEvidence(
          type = AiMappingSuggestionEvidenceType.ACCOUNT_LABEL,
          ref = "balance_import_line:$accountCode",
          snippet = accountLabel
        ),
        AiMappingSuggestionEvidence(
          type = AiMappingSuggestionEvidenceType.TARGET_TAXONOMY,
          ref = "manual-mapping-targets-v2:$suggestedTargetCode",
          snippet = "Cash and cash equivalents"
        )
      )
    ): AiMappingSuggestion =
      AiMappingSuggestion(
        accountCode = accountCode,
        suggestedTargetCode = suggestedTargetCode,
        confidence = 0.82,
        riskLevel = AiMappingSuggestionRiskLevel.MEDIUM,
        rationale = rationale,
        evidence = evidence,
        requiresHumanReview = true,
        schemaVersion = "mapping-suggestion-v1",
        promptVersion = "not_applicable_for_stub",
        modelVersion = "not_applicable_for_stub"
      )
  }
}
