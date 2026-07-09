package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.devtools.DemoSeedLocalDataset
import ch.qamwaq.ritomer.devtools.DemoSeedLocalFolderDataset
import ch.qamwaq.ritomer.devtools.DemoSeedLocalVariant
import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.imports.domain.BalanceImportSnapshot
import ch.qamwaq.ritomer.mapping.access.CurrentManualMappingProjection
import ch.qamwaq.ritomer.mapping.access.DerivedManualMappingAccess
import ch.qamwaq.ritomer.mapping.access.ManualMappingAccess
import ch.qamwaq.ritomer.mapping.api.MappingSuggestionsV2Controller
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionsV2OfflineService
import ch.qamwaq.ritomer.mapping.application.OfflineMappingEvalAbstentionReasonCode
import ch.qamwaq.ritomer.mapping.application.OfflineMappingEvalEngine042a2
import ch.qamwaq.ritomer.mapping.application.OfflineMappingEvalExplanationCode
import ch.qamwaq.ritomer.mapping.application.OfflineMappingEvalProvider
import ch.qamwaq.ritomer.mapping.application.OfflineMappingEvalProviderAccount
import ch.qamwaq.ritomer.mapping.application.OfflineMappingEvalProviderRequest
import ch.qamwaq.ritomer.mapping.application.OfflineMappingEvalProviderResponse
import ch.qamwaq.ritomer.mapping.domain.ManualMapping
import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import java.math.BigDecimal
import java.nio.file.Files
import java.nio.file.Path
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import jakarta.servlet.ServletException
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.hamcrest.Matchers.matchesPattern
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@SpringBootTest(
  properties = [
    "ritomer.ai.mapping-suggestions.enabled=false",
    "ritomer.ai.mapping-suggestions-v2.offline.enabled=true"
  ]
)
@AutoConfigureMockMvc
@ActiveProfiles(profiles = ["local", "test"])
@Import(IdentityTestConfiguration::class, MappingSuggestionsV2ProviderTestConfiguration::class)
class MappingSuggestionsV2ApiTest {
  @Autowired
  private lateinit var context: ApplicationContext

  @Autowired
  private lateinit var mockMvc: MockMvc

  @Autowired
  private lateinit var identityTestStore: IdentityTestStore

  @Autowired
  private lateinit var auditTestStore: AuditTestStore

  @Autowired
  private lateinit var closingFolderTestStore: ClosingFolderTestStore

  @Autowired
  private lateinit var balanceImportTestStore: BalanceImportTestStore

  @Autowired
  private lateinit var manualMappingTestStore: ManualMappingTestStore

  @Autowired
  private lateinit var mappingSuggestionDecisionRequestTestStore: MappingSuggestionDecisionRequestTestStore

  @Autowired
  private lateinit var recordingProvider: RecordingMappingSuggestionsV2OfflineProvider

  @Autowired
  private lateinit var controllableManualMappingAccess: ControllableManualMappingAccess

  @BeforeEach
  fun resetStores() {
    identityTestStore.reset()
    auditTestStore.reset()
    closingFolderTestStore.reset()
    balanceImportTestStore.reset()
    manualMappingTestStore.reset()
    mappingSuggestionDecisionRequestTestStore.reset()
    recordingProvider.reset()
    controllableManualMappingAccess.reset()
  }

  @Test
  fun `local flag on registers v2 controller service and offline provider`() {
    assertThat(context.getBeansOfType(MappingSuggestionsV2Controller::class.java)).hasSize(1)
    assertThat(context.getBeansOfType(MappingSuggestionsV2OfflineService::class.java)).hasSize(1)
    assertThat(context.getBeansOfType(OfflineMappingEvalProvider::class.java)).isNotEmpty()
  }

  @Test
  fun `v2 endpoint requires authentication before tenant folder allowlist or engine`() {
    mockMvc.get(v2Path(DEMO_CLOSING_FOLDER_ID)) {
      header(ACTIVE_TENANT_HEADER, DEMO_TENANT_ID.toString())
    }.andExpect { status { isUnauthorized() } }

    assertThat(recordingProvider.calls).isZero()
    assertNoWrites()
  }

  @Test
  fun `v2 endpoint keeps existing tenant header bad request behavior`() {
    mockMvc.get(v2Path(DEMO_CLOSING_FOLDER_ID)) {
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get(v2Path(DEMO_CLOSING_FOLDER_ID)) {
      header(ACTIVE_TENANT_HEADER, "   ")
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get(v2Path(DEMO_CLOSING_FOLDER_ID)) {
      header(ACTIVE_TENANT_HEADER, "not-a-uuid")
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    assertThat(recordingProvider.calls).isZero()
    assertNoWrites()
  }

  @Test
  fun `v2 endpoint returns forbidden when tenant is inaccessible before engine`() {
    val tenantAlphaId = uuid("11111111-1111-4111-8111-111111111111")
    val tenantBetaId = uuid("22222222-2222-4222-8222-222222222222")
    seedClosingFolder(tenantId = tenantBetaId)
    seedMembership("user-alpha", tenantAlphaId, TenantRole.ACCOUNTANT)

    mockMvc.get(v2Path(UUID.randomUUID())) {
      header(ACTIVE_TENANT_HEADER, tenantBetaId.toString())
      with(actorJwt("user-alpha"))
    }.andExpect { status { isForbidden() } }

    assertThat(recordingProvider.calls).isZero()
    assertNoWrites()
  }

  @Test
  fun `v2 endpoint returns not found for absent or cross tenant closing before allowlist and engine`() {
    val tenantAlphaId = uuid("11111111-1111-4111-8111-111111111111")
    val tenantBetaId = uuid("22222222-2222-4222-8222-222222222222")
    val betaClosing = seedClosingFolder(tenantId = tenantBetaId)
    seedMembership("user-123", tenantAlphaId, TenantRole.ACCOUNTANT)
    seedMembership("user-123", tenantBetaId, TenantRole.ACCOUNTANT)

    mockMvc.get(v2Path(UUID.randomUUID())) {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }

    mockMvc.get(v2Path(betaClosing.id)) {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }

    assertThat(recordingProvider.calls).isZero()
    assertNoWrites()
  }

  @Test
  fun `outside immutable allowlist returns request policy block without account context before engine`() {
    val tenantId = uuid("11111111-1111-4111-8111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    mockMvc.get(v2Path(closingFolder.id)) {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.state") { doesNotExist() }
      jsonPath("$.latestImportVersion") { doesNotExist() }
      jsonPath("$.items.length()") { value(1) }
      jsonPath("$.items[0].schemaVersion") { value("mapping-suggestion-v2") }
      jsonPath("$.items[0].outcome") { value("POLICY_BLOCK") }
      jsonPath("$.items[0].scope") { value("REQUEST") }
      jsonPath("$.items[0].policyBlockCode") { value("OUTSIDE_ALLOWLIST_OR_PROVENANCE") }
      jsonPath("$.items[0].accountCode") { doesNotExist() }
      jsonPath("$.items[0].accountLabel") { doesNotExist() }
      jsonPath("$.items[0].evidenceCodes") { doesNotExist() }
    }

    assertThat(recordingProvider.calls).isZero()
    assertNoWrites()
  }

  @Test
  fun `allowed demo without import returns request precondition block before engine`() {
    seedClosingFolder(tenantId = DEMO_TENANT_ID, id = DEMO_CLOSING_FOLDER_ID)
    seedMembership("demo-user", DEMO_TENANT_ID, TenantRole.ACCOUNTANT)

    mockMvc.get(v2Path(DEMO_CLOSING_FOLDER_ID)) {
      header(ACTIVE_TENANT_HEADER, DEMO_TENANT_ID.toString())
      with(actorJwt("demo-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.state") { doesNotExist() }
      jsonPath("$.closingFolderId") { value(DEMO_CLOSING_FOLDER_ID.toString()) }
      jsonPath("$.latestImportVersion") { doesNotExist() }
      jsonPath("$.taxonomyVersion") { value(2) }
      jsonPath("$.taxonomyHash") { value(matchesPattern("^[0-9a-f]{64}$")) }
      jsonPath("$.items.length()") { value(1) }
      jsonPath("$.items[0].outcome") { value("PRECONDITION_BLOCK") }
      jsonPath("$.items[0].scope") { value("REQUEST") }
      jsonPath("$.items[0].preconditionBlockCode") { value("STALE_IMPORT") }
      jsonPath("$.items[0].accountCode") { doesNotExist() }
      jsonPath("$.items[0].accountLabel") { doesNotExist() }
    }

    assertThat(recordingProvider.calls).isZero()
    assertNoWrites()
  }

  @Test
  fun `allowed demo with wrong import version or source returns request policy block without account context`() {
    seedClosingFolder(tenantId = DEMO_TENANT_ID, id = DEMO_CLOSING_FOLDER_ID)
    seedMembership("demo-user", DEMO_TENANT_ID, TenantRole.ACCOUNTANT)
    seedImportVersion(
      tenantId = DEMO_TENANT_ID,
      closingFolderId = DEMO_CLOSING_FOLDER_ID,
      version = 2,
      sourceFileName = "seed.csv",
      lines = listOf(line(1, "1000", "Synthetic cash account", "100.00", "0.00"))
    )

    mockMvc.get(v2Path(DEMO_CLOSING_FOLDER_ID)) {
      header(ACTIVE_TENANT_HEADER, DEMO_TENANT_ID.toString())
      with(actorJwt("demo-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.state") { doesNotExist() }
      jsonPath("$.latestImportVersion") { value(2) }
      jsonPath("$.items.length()") { value(1) }
      jsonPath("$.items[0].outcome") { value("POLICY_BLOCK") }
      jsonPath("$.items[0].scope") { value("REQUEST") }
      jsonPath("$.items[0].policyBlockCode") { value("OUTSIDE_ALLOWLIST_OR_PROVENANCE") }
      jsonPath("$.items[0].accountCode") { doesNotExist() }
      jsonPath("$.items[0].accountLabel") { doesNotExist() }
      jsonPath("$.items[0].evidenceCodes") { doesNotExist() }
    }

    assertThat(recordingProvider.calls).isZero()
    assertNoWrites()
  }

  @Test
  fun `allowed demo maps preconditions suggestions and abstentions through v2 schema without writes`() {
    seedClosingFolder(tenantId = DEMO_TENANT_ID, id = DEMO_CLOSING_FOLDER_ID)
    seedMembership("demo-user", DEMO_TENANT_ID, TenantRole.ACCOUNTANT)
    seedImportVersion(
      tenantId = DEMO_TENANT_ID,
      closingFolderId = DEMO_CLOSING_FOLDER_ID,
      version = 1,
      sourceFileName = DEMO_SOURCE_FILE_NAME,
      lines = listOf(
        line(1, "1000", "Synthetic cash account", "100.00", "0.00"),
        line(2, "4000", "Other operating expenses", "90.00", "0.00"),
        line(3, "4010", "Synthetic operating expenses", "30.00", "0.00")
      )
    )
    manualMappingTestStore.save(
      manualMapping(
        tenantId = DEMO_TENANT_ID,
        closingFolderId = DEMO_CLOSING_FOLDER_ID,
        accountCode = "1000",
        targetCode = "BS.ASSET.CASH_AND_EQUIVALENTS"
      )
    )

    mockMvc.get(v2Path(DEMO_CLOSING_FOLDER_ID)) {
      header(ACTIVE_TENANT_HEADER, DEMO_TENANT_ID.toString())
      with(actorJwt("demo-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.schemaVersion") { value("mapping-suggestion-v2") }
      jsonPath("$.state") { doesNotExist() }
      jsonPath("$.latestImportVersion") { value(1) }
      jsonPath("$.taxonomyVersion") { value(2) }
      jsonPath("$.taxonomyHash") { value(matchesPattern("^[0-9a-f]{64}$")) }
      jsonPath("$.items.length()") { value(3) }
      jsonPath("$.items[0].outcome") { value("PRECONDITION_BLOCK") }
      jsonPath("$.items[0].scope") { value("ACCOUNT") }
      jsonPath("$.items[0].accountCode") { value("1000") }
      jsonPath("$.items[0].accountLabel") { value("Synthetic cash account") }
      jsonPath("$.items[0].preconditionBlockCode") { value("ACCOUNT_ALREADY_AFFECTED") }
      jsonPath("$.items[1].outcome") { value("SUGGESTION") }
      jsonPath("$.items[1].scope") { value("ACCOUNT") }
      jsonPath("$.items[1].accountCode") { value("4000") }
      jsonPath("$.items[1].accountLabel") { value("Other operating expenses") }
      jsonPath("$.items[1].targetCode") { value("PL.EXPENSE.OTHER_OPERATING_EXPENSES") }
      jsonPath("$.items[1].suggestedTargetCode") { doesNotExist() }
      jsonPath("$.items[1].confidence") { doesNotExist() }
      jsonPath("$.items[1].riskLevel") { doesNotExist() }
      jsonPath("$.items[1].requiresHumanReview") { value(true) }
      jsonPath("$.items[1].suggestionFingerprint") { value(matchesPattern("^[0-9a-f]{64}$")) }
      jsonPath("$.items[1].providerCallCount") { doesNotExist() }
      jsonPath("$.items[2].outcome") { value("ABSTENTION") }
      jsonPath("$.items[2].scope") { value("ACCOUNT") }
      jsonPath("$.items[2].accountCode") { value("4010") }
      jsonPath("$.items[2].accountLabel") { value("Synthetic operating expenses") }
      jsonPath("$.items[2].abstentionReasonCode") { value("INSUFFICIENT_EVIDENCE") }
      jsonPath("$.items[2].targetCode") { doesNotExist() }
      jsonPath("$.items[2].suggestionFingerprint") { doesNotExist() }
    }

    assertThat(recordingProvider.calls).isEqualTo(2)
    assertThat(recordingProvider.requests.map { it.account.accountCode }).containsExactly("4000", "4010")
    assertThat(recordingProvider.requests)
      .allSatisfy {
        assertThat(it.account.sanitizedAccountLabel).doesNotContain("@", "http", "secret", ".env")
        assertThat(it.candidateTargets.map { target -> target.code })
          .contains("PL.EXPENSE.OTHER_OPERATING_EXPENSES")
      }
    assertNoWrites(expectedManualMappingAccountCodes = listOf("1000"))
  }

  @Test
  fun `primary 036a demo with six existing mappings remains precondition only`() {
    seedClosingFolder(tenantId = DEMO_TENANT_ID, id = DEMO_CLOSING_FOLDER_ID)
    seedMembership("demo-user", DEMO_TENANT_ID, TenantRole.ACCOUNTANT)
    seedDemoFolderData(DemoSeedLocalDataset.primaryFolder)

    val response = mockMvc.get(v2Path(DEMO_CLOSING_FOLDER_ID)) {
      header(ACTIVE_TENANT_HEADER, DEMO_TENANT_ID.toString())
      with(actorJwt("demo-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.schemaVersion") { value("mapping-suggestion-v2") }
      jsonPath("$.latestImportVersion") { value(1) }
      jsonPath("$.items.length()") { value(6) }
    }.andReturn().response.contentAsString

    val items = jsonItems(response)
    assertThat(items).hasSize(6)
    assertThat(items.map { it.get("outcome").asText() }.toSet()).containsExactly("PRECONDITION_BLOCK")
    assertThat(items.map { it.get("preconditionBlockCode").asText() }.toSet())
      .containsExactly("ACCOUNT_ALREADY_AFFECTED")
    assertThat(items.map { it.get("accountCode").asText() })
      .containsExactly("1000", "1100", "2000", "2800", "3000", "4000")

    assertThat(recordingProvider.calls).isZero()
    assertNoWrites(
      expectedManualMappingAccountCodes = listOf("1000", "1100", "2000", "2800", "3000", "4000")
    )
  }

  @Test
  fun `mixed 042a2a5d demo returns one suggestion one abstention and four preconditions without writes`() {
    val variant = DemoSeedLocalVariant.MIXED_V2_042A2A5D.folderDataset
    seedClosingFolder(tenantId = DEMO_TENANT_ID, id = VARIANT_CLOSING_FOLDER_ID)
    seedMembership("demo-user", DEMO_TENANT_ID, TenantRole.ACCOUNTANT)
    seedDemoFolderData(variant)

    val response = mockMvc.get(v2Path(VARIANT_CLOSING_FOLDER_ID)) {
      header(ACTIVE_TENANT_HEADER, DEMO_TENANT_ID.toString())
      with(actorJwt("demo-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.schemaVersion") { value("mapping-suggestion-v2") }
      jsonPath("$.closingFolderId") { value(VARIANT_CLOSING_FOLDER_ID.toString()) }
      jsonPath("$.latestImportVersion") { value(1) }
      jsonPath("$.items.length()") { value(6) }
    }.andReturn().response.contentAsString

    val items = jsonItems(response)
    assertThat(items.countOutcome("SUGGESTION")).isEqualTo(1)
    assertThat(items.countOutcome("ABSTENTION")).isEqualTo(1)
    assertThat(items.countOutcome("PRECONDITION_BLOCK")).isEqualTo(4)
    assertThat(items.countOutcome("POLICY_BLOCK")).isZero()
    assertThat(items.countOutcome("TECHNICAL_DEGRADATION")).isZero()

    val byAccount = items.associateBy { it.get("accountCode").asText() }
    assertThat(byAccount.getValue("3000").get("outcome").asText()).isEqualTo("SUGGESTION")
    assertThat(byAccount.getValue("3000").get("targetCode").asText()).isEqualTo("PL.REVENUE.OPERATING_REVENUE")
    assertThat(byAccount.getValue("3000").get("requiresHumanReview").asBoolean()).isTrue()
    assertThat(byAccount.getValue("4000").get("outcome").asText()).isEqualTo("ABSTENTION")
    assertThat(byAccount.getValue("4000").get("abstentionReasonCode").asText()).isEqualTo("INSUFFICIENT_EVIDENCE")
    assertThat(byAccount.getValue("4000").has("targetCode")).isFalse()

    assertThat(recordingProvider.calls).isEqualTo(2)
    assertThat(recordingProvider.requests.map { it.account.accountCode }).containsExactly("3000", "4000")
    assertNoWrites(
      closingFolderId = VARIANT_CLOSING_FOLDER_ID,
      expectedManualMappingAccountCodes = listOf("1000", "1100", "2000", "2800")
    )
  }

  @Test
  fun `local provider incident degrades to technical degradation without writes`() {
    recordingProvider.fail = true
    seedClosingFolder(tenantId = DEMO_TENANT_ID, id = DEMO_CLOSING_FOLDER_ID)
    seedMembership("demo-user", DEMO_TENANT_ID, TenantRole.ACCOUNTANT)
    seedImportVersion(
      tenantId = DEMO_TENANT_ID,
      closingFolderId = DEMO_CLOSING_FOLDER_ID,
      version = 1,
      sourceFileName = DEMO_SOURCE_FILE_NAME,
      lines = listOf(line(1, "4000", "Other operating expenses", "90.00", "0.00"))
    )

    mockMvc.get(v2Path(DEMO_CLOSING_FOLDER_ID)) {
      header(ACTIVE_TENANT_HEADER, DEMO_TENANT_ID.toString())
      with(actorJwt("demo-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.state") { doesNotExist() }
      jsonPath("$.latestImportVersion") { value(1) }
      jsonPath("$.items.length()") { value(1) }
      jsonPath("$.items[0].outcome") { value("TECHNICAL_DEGRADATION") }
      jsonPath("$.items[0].scope") { value("BATCH") }
      jsonPath("$.items[0].degradationCode") { value("UNAVAILABLE") }
      jsonPath("$.items[0].accountCode") { doesNotExist() }
      jsonPath("$.items[0].accountLabel") { doesNotExist() }
      jsonPath("$.items[0].providerCallCount") { doesNotExist() }
    }

    assertThat(recordingProvider.calls).isEqualTo(1)
    assertNoWrites()
  }

  @Test
  fun `unexpected projection exception propagates to http 5xx mechanism without v2 read model or writes`() {
    controllableManualMappingAccess.failureMode = ControllableManualMappingFailureMode.UNEXPECTED_RUNTIME
    seedClosingFolder(tenantId = DEMO_TENANT_ID, id = DEMO_CLOSING_FOLDER_ID)
    seedMembership("demo-user", DEMO_TENANT_ID, TenantRole.ACCOUNTANT)
    seedImportVersion(
      tenantId = DEMO_TENANT_ID,
      closingFolderId = DEMO_CLOSING_FOLDER_ID,
      version = 1,
      sourceFileName = DEMO_SOURCE_FILE_NAME,
      lines = listOf(line(1, "4000", "Other operating expenses", "90.00", "0.00"))
    )

    assertThatThrownBy {
      mockMvc.get(v2Path(DEMO_CLOSING_FOLDER_ID)) {
        header(ACTIVE_TENANT_HEADER, DEMO_TENANT_ID.toString())
        with(actorJwt("demo-user"))
      }
    }
      .isInstanceOf(ServletException::class.java)
      .hasRootCauseInstanceOf(IllegalStateException::class.java)

    assertThat(recordingProvider.calls).isZero()
    assertNoWrites()
  }

  @Test
  fun `internal access denied exception is not transformed into a v2 read model`() {
    controllableManualMappingAccess.failureMode = ControllableManualMappingFailureMode.ACCESS_DENIED
    seedClosingFolder(tenantId = DEMO_TENANT_ID, id = DEMO_CLOSING_FOLDER_ID)
    seedMembership("demo-user", DEMO_TENANT_ID, TenantRole.ACCOUNTANT)
    seedImportVersion(
      tenantId = DEMO_TENANT_ID,
      closingFolderId = DEMO_CLOSING_FOLDER_ID,
      version = 1,
      sourceFileName = DEMO_SOURCE_FILE_NAME,
      lines = listOf(line(1, "4000", "Other operating expenses", "90.00", "0.00"))
    )

    val result = mockMvc.get(v2Path(DEMO_CLOSING_FOLDER_ID)) {
      header(ACTIVE_TENANT_HEADER, DEMO_TENANT_ID.toString())
      with(actorJwt("demo-user"))
    }.andExpect {
      status { isForbidden() }
    }.andReturn()

    assertThat(result.response.contentAsString).doesNotContain("mapping-suggestion-v2", "UNAVAILABLE")
    assertThat(recordingProvider.calls).isZero()
    assertNoWrites()
  }

  @Test
  fun `v2 flag does not change v1 suggestions endpoint`() {
    seedClosingFolder(tenantId = DEMO_TENANT_ID, id = DEMO_CLOSING_FOLDER_ID)
    seedMembership("demo-user", DEMO_TENANT_ID, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/$DEMO_CLOSING_FOLDER_ID/mappings/suggestions") {
      header(ACTIVE_TENANT_HEADER, DEMO_TENANT_ID.toString())
      with(actorJwt("demo-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.state") { value("DISABLED") }
      jsonPath("$.suggestions.length()") { value(0) }
      jsonPath("$.errors[0].code") { value("AI_MAPPING_SUGGESTIONS_DISABLED") }
    }

    assertThat(recordingProvider.calls).isZero()
    assertNoWrites()
  }

  @Test
  fun `v2 local runtime source contains no network client or real provider markers`() {
    val sourceRoot = Path.of("").toAbsolutePath().normalize()
    val source = listOf(
      "src/main/kotlin/ch/qamwaq/ritomer/mapping/api/MappingSuggestionsV2Controller.kt",
      "src/main/kotlin/ch/qamwaq/ritomer/mapping/application/MappingSuggestionsV2OfflineService.kt",
      "src/main/kotlin/ch/qamwaq/ritomer/mapping/infrastructure/local/LocalDemoOfflineMappingEvalProvider.kt"
    ).joinToString("\n") { relativePath ->
      Files.readString(sourceRoot.resolve(relativePath))
    }

    val forbiddenMarkers = listOf(
      "HttpClient",
      "WebClient",
      "RestClient",
      "OkHttp",
      "ktor.client",
      "openai",
      "anthropic"
    )

    assertThat(forbiddenMarkers.filter { it in source }).isEmpty()
  }

  private fun assertNoWrites(
    closingFolderId: UUID = DEMO_CLOSING_FOLDER_ID,
    expectedManualMappingAccountCodes: List<String> = emptyList()
  ) {
    assertThat(auditTestStore.auditEvents()).isEmpty()
    assertThat(mappingSuggestionDecisionRequestTestStore.records()).isEmpty()
    assertThat(manualMappingTestStore.mappings(DEMO_TENANT_ID, closingFolderId).map { it.accountCode })
      .containsExactlyElementsOf(expectedManualMappingAccountCodes)
  }

  private fun seedMembership(
    subject: String,
    tenantId: UUID,
    vararg roles: TenantRole
  ) {
    identityTestStore.seedMembership(
      subject,
      tenantId,
      "tenant-${tenantId.toString().take(4)}",
      "Tenant",
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
      *roles
    )
  }

  private fun seedClosingFolder(
    tenantId: UUID,
    id: UUID = UUID.randomUUID(),
    status: ClosingFolderStatus = ClosingFolderStatus.DRAFT
  ): ClosingFolder {
    val now = OffsetDateTime.now(ZoneOffset.UTC)
    val folder = ClosingFolder(
      id = id,
      tenantId = tenantId,
      name = "Closing FY24",
      periodStartOn = LocalDate.parse("2024-01-01"),
      periodEndOn = LocalDate.parse("2024-12-31"),
      externalRef = null,
      status = status,
      archivedAt = if (status == ClosingFolderStatus.ARCHIVED) now else null,
      archivedByUserId = if (status == ClosingFolderStatus.ARCHIVED) UUID.randomUUID() else null,
      createdAt = now.minusDays(1),
      updatedAt = now
    )
    closingFolderTestStore.save(folder)
    return folder
  }

  private fun seedImportVersion(
    tenantId: UUID,
    closingFolderId: UUID,
    version: Int,
    sourceFileName: String,
    lines: List<BalanceImportLine>
  ) {
    val totalDebit = lines.fold(decimal("0")) { sum, line -> sum + line.debit }
    val totalCredit = lines.fold(decimal("0")) { sum, line -> sum + line.credit }
    balanceImportTestStore.save(
      BalanceImportSnapshot(
        import = BalanceImport(
          id = UUID.randomUUID(),
          tenantId = tenantId,
          closingFolderId = closingFolderId,
          version = version,
          sourceFileName = sourceFileName,
          importedAt = OffsetDateTime.now(ZoneOffset.UTC).minusHours(version.toLong()),
          importedByUserId = UUID.randomUUID(),
          rowCount = lines.size,
          totalDebit = totalDebit,
          totalCredit = totalCredit
        ),
        lines = lines
      )
    )
  }

  private fun seedDemoFolderData(folder: DemoSeedLocalFolderDataset) {
    seedImportVersion(
      tenantId = DEMO_TENANT_ID,
      closingFolderId = folder.closingFolderId,
      version = folder.balanceImportVersion,
      sourceFileName = folder.sourceFileName,
      lines = folder.balanceLines.map {
        line(
          lineNo = it.lineNo,
          accountCode = it.accountCode,
          accountLabel = it.accountLabel,
          debit = it.debit.toPlainString(),
          credit = it.credit.toPlainString()
        )
      }
    )
    folder.manualMappings.forEach {
      manualMappingTestStore.save(
        manualMapping(
          tenantId = DEMO_TENANT_ID,
          closingFolderId = folder.closingFolderId,
          accountCode = it.accountCode,
          targetCode = it.targetCode
        )
      )
    }
  }

  private fun manualMapping(
    tenantId: UUID,
    closingFolderId: UUID,
    accountCode: String,
    targetCode: String
  ) = ManualMapping(
    id = UUID.randomUUID(),
    tenantId = tenantId,
    closingFolderId = closingFolderId,
    accountCode = accountCode,
    targetCode = targetCode,
    createdAt = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(5),
    updatedAt = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(5),
    createdByUserId = UUID.randomUUID(),
    updatedByUserId = UUID.randomUUID()
  )
}

@SpringBootTest(properties = ["ritomer.ai.mapping-suggestions-v2.offline.enabled=false"])
@AutoConfigureMockMvc
@ActiveProfiles(profiles = ["local", "test"])
@Import(IdentityTestConfiguration::class)
class MappingSuggestionsV2FlagOffActivationApiTest {
  @Autowired
  private lateinit var context: ApplicationContext

  @Autowired
  private lateinit var mockMvc: MockMvc

  @Test
  fun `v2 local flag false leaves beans and endpoint absent`() {
    assertThat(context.getBeansOfType(MappingSuggestionsV2Controller::class.java)).isEmpty()
    assertThat(context.getBeansOfType(MappingSuggestionsV2OfflineService::class.java)).isEmpty()
    assertThat(context.getBeansOfType(OfflineMappingEvalProvider::class.java)).isEmpty()

    mockMvc.get(v2Path(DEMO_CLOSING_FOLDER_ID)) {
      header(ACTIVE_TENANT_HEADER, DEMO_TENANT_ID.toString())
      with(actorJwt("demo-user"))
    }.andExpect { status { isNotFound() } }
  }
}

@SpringBootTest(properties = ["ritomer.ai.mapping-suggestions-v2.offline.enabled=true"])
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class)
class MappingSuggestionsV2NonLocalActivationApiTest {
  @Autowired
  private lateinit var context: ApplicationContext

  @Autowired
  private lateinit var mockMvc: MockMvc

  @Test
  fun `v2 flag true outside local profile leaves beans and endpoint absent`() {
    assertThat(context.getBeansOfType(MappingSuggestionsV2Controller::class.java)).isEmpty()
    assertThat(context.getBeansOfType(MappingSuggestionsV2OfflineService::class.java)).isEmpty()
    assertThat(context.getBeansOfType(OfflineMappingEvalProvider::class.java)).isEmpty()

    mockMvc.get(v2Path(DEMO_CLOSING_FOLDER_ID)) {
      header(ACTIVE_TENANT_HEADER, DEMO_TENANT_ID.toString())
      with(actorJwt("demo-user"))
    }.andExpect { status { isNotFound() } }
  }
}

@TestConfiguration(proxyBeanMethods = false)
class MappingSuggestionsV2ProviderTestConfiguration {
  @Bean
  @Primary
  fun recordingMappingSuggestionsV2OfflineProvider(): RecordingMappingSuggestionsV2OfflineProvider =
    RecordingMappingSuggestionsV2OfflineProvider()

  @Bean
  @Primary
  fun controllableManualMappingAccess(
    delegate: DerivedManualMappingAccess
  ): ControllableManualMappingAccess =
    ControllableManualMappingAccess(delegate)
}

enum class ControllableManualMappingFailureMode {
  NONE,
  UNEXPECTED_RUNTIME,
  ACCESS_DENIED
}

class ControllableManualMappingAccess(
  private val delegate: ManualMappingAccess
) : ManualMappingAccess {
  var failureMode: ControllableManualMappingFailureMode = ControllableManualMappingFailureMode.NONE

  fun reset() {
    failureMode = ControllableManualMappingFailureMode.NONE
  }

  override fun getCurrentProjection(
    tenantId: UUID,
    closingFolderId: UUID
  ): CurrentManualMappingProjection =
    when (failureMode) {
      ControllableManualMappingFailureMode.NONE -> delegate.getCurrentProjection(tenantId, closingFolderId)
      ControllableManualMappingFailureMode.UNEXPECTED_RUNTIME ->
        throw IllegalStateException("Synthetic unexpected projection failure.")
      ControllableManualMappingFailureMode.ACCESS_DENIED ->
        throw AccessDeniedException("Synthetic projection access denied.")
    }
}

class RecordingMappingSuggestionsV2OfflineProvider : OfflineMappingEvalProvider {
  var calls: Int = 0
    private set
  var fail: Boolean = false
  val requests: MutableList<OfflineMappingEvalProviderRequest> = mutableListOf()

  fun reset() {
    calls = 0
    fail = false
    requests.clear()
  }

  override fun generate(request: OfflineMappingEvalProviderRequest): OfflineMappingEvalProviderResponse {
    calls += 1
    requests += request
    if (fail) {
      throw IllegalStateException("Synthetic local provider failure.")
    }

    val targetCode = targetCodeFor(request.account)
    val target = targetCode?.let { code -> request.candidateTargets.firstOrNull { it.code == code } }
    val rawJson = if (target == null) {
      abstentionJson(
        accountCode = request.account.accountCode,
        reasonCode = OfflineMappingEvalAbstentionReasonCode.INSUFFICIENT_EVIDENCE.name
      )
    } else {
      suggestionJson(
        accountCode = request.account.accountCode,
        targetCode = target.code
      )
    }

    return OfflineMappingEvalProviderResponse(
      rawJson = rawJson,
      promptVersion = OfflineMappingEvalEngine042a2.PROVIDER_PROMPT_VERSION,
      modelVersion = OfflineMappingEvalEngine042a2.PROVIDER_MODEL_VERSION
    )
  }

  private fun targetCodeFor(account: OfflineMappingEvalProviderAccount): String? {
    val label = account.sanitizedAccountLabel.lowercase()
    return when {
      label == "synthetic operating expenses" -> null
      "other operating expenses" in label -> "PL.EXPENSE.OTHER_OPERATING_EXPENSES"
      "cash" in label || "bank" in label -> "BS.ASSET.CASH_AND_EQUIVALENTS"
      "receivable" in label -> "BS.ASSET.TRADE_RECEIVABLES"
      "payable" in label -> "BS.LIABILITY.TRADE_PAYABLES"
      "retained earnings" in label -> "BS.EQUITY.RETAINED_EARNINGS"
      "operating revenue" in label || "sales" in label -> "PL.REVENUE.OPERATING_REVENUE"
      else -> null
    }
  }

  private fun suggestionJson(accountCode: String, targetCode: String): String =
    """
    {
      "outcome": "SUGGESTION",
      "accountCode": "$accountCode",
      "suggestedTargetCode": "$targetCode",
      "evidence": [
        { "type": "ACCOUNT_LABEL" },
        { "type": "TARGET_TAXONOMY" }
      ],
      "explanationCode": "${OfflineMappingEvalExplanationCode.TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE.name}",
      "schemaVersion": "${OfflineMappingEvalEngine042a2.PROVIDER_SCHEMA_VERSION}"
    }
    """.trimIndent()

  private fun abstentionJson(accountCode: String, reasonCode: String): String =
    """
    {
      "outcome": "ABSTENTION",
      "accountCode": "$accountCode",
      "reasonCode": "$reasonCode",
      "evidence": [
        { "type": "ACCOUNT_LABEL" }
      ],
      "explanationCode": "${OfflineMappingEvalExplanationCode.EVIDENCE_NOT_SUFFICIENT_FOR_AFFECTATION.name}",
      "schemaVersion": "${OfflineMappingEvalEngine042a2.PROVIDER_SCHEMA_VERSION}"
    }
    """.trimIndent()
}

private val DEMO_TENANT_ID: UUID = UUID.fromString("036a0000-0000-4000-8000-000000000001")
private val DEMO_CLOSING_FOLDER_ID: UUID = UUID.fromString("036a0000-0000-4000-8000-000000000004")
private val VARIANT_CLOSING_FOLDER_ID: UUID = UUID.fromString("042a2a5d-0000-4000-8000-000000000004")
private const val DEMO_SOURCE_FILE_NAME = "demo-synthetic-balance.csv"
private val jsonMapper = jacksonObjectMapper()

private fun v2Path(closingFolderId: UUID): String =
  "/api/closing-folders/$closingFolderId/mappings/suggestions-v2"

private fun jsonItems(response: String): List<JsonNode> =
  jsonMapper.readTree(response).get("items").toList()

private fun List<JsonNode>.countOutcome(outcome: String): Int =
  count { it.get("outcome").asText() == outcome }

private fun actorJwt(
  subject: String
) = jwt().jwt { token ->
  token.subject(subject)
}

private fun line(
  lineNo: Int,
  accountCode: String,
  accountLabel: String,
  debit: String,
  credit: String
): BalanceImportLine =
  BalanceImportLine(
    lineNo = lineNo,
    accountCode = accountCode,
    accountLabel = accountLabel,
    debit = decimal(debit),
    credit = decimal(credit)
  )

private fun decimal(value: String): BigDecimal = BigDecimal(value)

private fun uuid(value: String): UUID = UUID.fromString(value)
