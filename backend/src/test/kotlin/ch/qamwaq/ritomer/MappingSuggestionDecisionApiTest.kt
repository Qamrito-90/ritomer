package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.ai.access.AiMappingSuggestion
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionEvidence
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionEvidenceType
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionGenerationRequest
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionGenerationResult
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionRiskLevel
import ch.qamwaq.ritomer.ai.access.MappingSuggestionGenerationAccess
import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.imports.domain.BalanceImportSnapshot
import ch.qamwaq.ritomer.mapping.application.MANUAL_MAPPING_CREATED_ACTION
import ch.qamwaq.ritomer.mapping.application.MappingSuggestion
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionDecisionResultKind
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionEvidence
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionEvidenceType
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionFingerprints
import ch.qamwaq.ritomer.mapping.application.MappingSuggestionRiskLevel
import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers.nullValue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.http.MediaType
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@SpringBootTest(properties = ["ritomer.ai.mapping-suggestions.enabled=true"])
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class)
class MappingSuggestionDecisionApiTest {
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
  private lateinit var decisionRequestTestStore: MappingSuggestionDecisionRequestTestStore

  @BeforeEach
  fun resetStores() {
    identityTestStore.reset()
    auditTestStore.reset()
    closingFolderTestStore.reset()
    balanceImportTestStore.reset()
    manualMappingTestStore.reset()
    decisionRequestTestStore.reset()
  }

  @Test
  fun `decision endpoint requires authentication`() {
    mockMvc.post("/api/closing-folders/${UUID.randomUUID()}/mappings/suggestions/1000/decision") {
      header(ACTIVE_TENANT_HEADER, TENANT_ID.toString())
      header("Idempotency-Key", "auth-key-01")
      contentType = MediaType.APPLICATION_JSON
      content = rejectPayload()
    }.andExpect { status { isUnauthorized() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
    assertThat(decisionRequestTestStore.records()).isEmpty()
  }

  @Test
  fun `decision endpoint returns 400 for invalid tenant header invalid payload and malformed idempotency key`() {
    val closingFolder = seedReadyFolder()

    mockMvc.post("/api/closing-folders/${closingFolder.id}/mappings/suggestions/1000/decision") {
      header("Idempotency-Key", "valid-key-01")
      contentType = MediaType.APPLICATION_JSON
      content = rejectPayload()
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.post("/api/closing-folders/${closingFolder.id}/mappings/suggestions/1000/decision") {
      header(ACTIVE_TENANT_HEADER, "not-a-uuid")
      header("Idempotency-Key", "valid-key-02")
      contentType = MediaType.APPLICATION_JSON
      content = rejectPayload()
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    listOf(null, "   ", "bad key").forEach { idempotencyKey ->
      mockMvc.post("/api/closing-folders/${closingFolder.id}/mappings/suggestions/1000/decision") {
        header(ACTIVE_TENANT_HEADER, TENANT_ID.toString())
        if (idempotencyKey != null) {
          header("Idempotency-Key", idempotencyKey)
        }
        contentType = MediaType.APPLICATION_JSON
        content = rejectPayload()
        with(actorJwt("user-123"))
      }.andExpect { status { isBadRequest() } }
    }

    mockMvc.post("/api/closing-folders/${closingFolder.id}/mappings/suggestions/1000/decision") {
      header(ACTIVE_TENANT_HEADER, TENANT_ID.toString())
      header("Idempotency-Key", "valid-key-03")
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"ACCEPT","latestImportVersion":1,"suggestionFingerprint":"${stubFingerprint()}"}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.post("/api/closing-folders/${closingFolder.id}/mappings/suggestions/1000/decision") {
      header(ACTIVE_TENANT_HEADER, TENANT_ID.toString())
      header("Idempotency-Key", "valid-key-04")
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REJECT","latestImportVersion":1,"suggestionFingerprint":"${stubFingerprint()}","unexpected":true}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
    assertThat(decisionRequestTestStore.records()).isEmpty()
  }

  @Test
  fun `decision endpoint returns 403 for insufficient write role`() {
    val closingFolder = seedReadyFolder(role = TenantRole.REVIEWER)

    postDecision(closingFolder.id, rejectPayload(), "reviewer-key")
      .andExpect { status { isForbidden() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
    assertThat(decisionRequestTestStore.records()).isEmpty()
  }

  @Test
  fun `decision endpoint returns 404 when closing is outside active tenant`() {
    val betaClosing = seedClosingFolder(TENANT_BETA_ID)
    seedMembership("user-123", TENANT_ID, TenantRole.ACCOUNTANT)
    seedMembership("user-123", TENANT_BETA_ID, TenantRole.ACCOUNTANT)

    postDecision(betaClosing.id, rejectPayload(), "outside-key")
      .andExpect { status { isNotFound() } }

    assertThat(decisionRequestTestStore.records()).isEmpty()
  }

  @Test
  fun `business conflicts are terminal idempotency results`() {
    val archived = seedReadyFolder(status = ClosingFolderStatus.ARCHIVED)
    postDecision(archived.id, rejectPayload(), "archived-key")
      .andExpect {
        status { isConflict() }
        jsonPath("$.resultKind") { value("CONFLICT_ARCHIVED") }
      }

    val noImport = seedClosingFolder(TENANT_ID)
    postDecision(noImport.id, rejectPayload(), "no-import")
      .andExpect {
        status { isConflict() }
        jsonPath("$.resultKind") { value("CONFLICT_NO_IMPORT") }
      }

    val stale = seedReadyFolder(importVersion = 2)
    postDecision(stale.id, rejectPayload(latestImportVersion = 1), "stale-key")
      .andExpect {
        status { isConflict() }
        jsonPath("$.resultKind") { value("CONFLICT_STALE_IMPORT") }
      }

    val absent = seedReadyFolder()
    postDecision(absent.id, rejectPayload(accountCode = "9999"), "absent-key", accountCode = "9999")
      .andExpect {
        status { isConflict() }
        jsonPath("$.resultKind") { value("CONFLICT_ACCOUNT_ABSENT") }
      }

    val noSuggestion = seedReadyFolder(
      lines = listOf(BalanceImportLine(2, "7000", "Neutral", decimal("0.00"), decimal("0.00")))
    )
    postDecision(noSuggestion.id, rejectPayload(accountCode = "7000"), "missing-suggestion", accountCode = "7000")
      .andExpect {
        status { isConflict() }
        jsonPath("$.resultKind") { value("CONFLICT_SUGGESTION_ABSENT") }
      }

    val mismatch = seedReadyFolder()
    postDecision(mismatch.id, rejectPayload(suggestionFingerprint = "0".repeat(64)), "fingerprint")
      .andExpect {
        status { isConflict() }
        jsonPath("$.resultKind") { value("CONFLICT_FINGERPRINT_MISMATCH") }
      }

    assertThat(decisionRequestTestStore.records()).allSatisfy {
      assertThat(it.resultKind).isNotEqualTo(MappingSuggestionDecisionResultKind.PENDING)
      assertThat(it.completedAt).isNotNull()
    }
  }

  @Test
  fun `accept correct and target gates reject inconsistent human decisions`() {
    val acceptFolder = seedReadyFolder()
    postDecision(
      acceptFolder.id,
      acceptPayload(targetCode = "PL.REVENUE.OPERATING_REVENUE"),
      "accept-mismatch"
    ).andExpect {
      status { isConflict() }
      jsonPath("$.resultKind") { value("CONFLICT_TARGET_MISMATCH") }
    }

    val correctFolder = seedReadyFolder()
    postDecision(
      correctFolder.id,
      correctPayload(targetCode = "BS.ASSET.CASH_AND_EQUIVALENTS"),
      "correct-mismatch"
    ).andExpect {
      status { isConflict() }
      jsonPath("$.resultKind") { value("CONFLICT_TARGET_MISMATCH") }
    }

    val targetFolder = seedReadyFolder()
    postDecision(
      targetFolder.id,
      correctPayload(targetCode = "BS.ASSET.CURRENT_SECTION"),
      "target-bad"
    ).andExpect {
      status { isConflict() }
      jsonPath("$.resultKind") { value("CONFLICT_TARGET_NOT_SELECTABLE") }
    }

    assertThat(manualMappingTestStore.mappings(TENANT_ID, acceptFolder.id)).isEmpty()
    assertThat(manualMappingTestStore.mappings(TENANT_ID, correctFolder.id)).isEmpty()
    assertThat(manualMappingTestStore.mappings(TENANT_ID, targetFolder.id)).isEmpty()
    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `correct applies selectable legacy target through manual mapping business rules`() {
    val closingFolder = seedReadyFolder()

    postDecision(
      closingFolder.id,
      correctPayload(targetCode = "PL.REVENUE"),
      "correct-legacy"
    ).andExpect {
      status { isOk() }
      jsonPath("$.decision") { value("CORRECT") }
      jsonPath("$.resultKind") { value("MANUAL_MAPPING_CREATED") }
      jsonPath("$.appliedMapping.accountCode") { value("1000") }
      jsonPath("$.appliedMapping.targetCode") { value("PL.REVENUE") }
    }

    assertThat(manualMappingTestStore.mappings(TENANT_ID, closingFolder.id).single().targetCode)
      .isEqualTo("PL.REVENUE")
    assertThat(auditTestStore.auditEvents().map { it.command.action }).containsExactly(MANUAL_MAPPING_CREATED_ACTION)
  }

  @Test
  fun `reject records decision without creating manual mapping or audit`() {
    val closingFolder = seedReadyFolder()

    postDecision(closingFolder.id, rejectPayload(reviewComment = "  Human \n rejection\tkept  "), "reject-key")
      .andExpect {
        status { isOk() }
        jsonPath("$.decision") { value("REJECT") }
        jsonPath("$.accountCode") { value("1000") }
        jsonPath("$.resultKind") { value("REJECT_RECORDED") }
        jsonPath("$.appliedMapping") { value(nullValue()) }
      }

    assertThat(manualMappingTestStore.mappings(TENANT_ID, closingFolder.id)).isEmpty()
    assertThat(auditTestStore.auditEvents()).isEmpty()
    assertThat(decisionRequestTestStore.records().single().reviewComment).isEqualTo("Human rejection kept")
  }

  @Test
  fun `reject decision same key and same canonical payload replays without mapping audit or duplicate request`() {
    val closingFolder = seedReadyFolder()
    val payload = rejectPayload()

    postDecision(closingFolder.id, payload, "reject-replay")
      .andExpect {
        status { isOk() }
        jsonPath("$.decision") { value("REJECT") }
        jsonPath("$.accountCode") { value("1000") }
        jsonPath("$.resultKind") { value("REJECT_RECORDED") }
        jsonPath("$.appliedMapping") { value(nullValue()) }
      }

    postDecision(closingFolder.id, payload, "reject-replay")
      .andExpect {
        status { isOk() }
        jsonPath("$.decision") { value("REJECT") }
        jsonPath("$.accountCode") { value("1000") }
        jsonPath("$.resultKind") { value("REJECT_RECORDED") }
        jsonPath("$.appliedMapping") { value(nullValue()) }
      }

    assertThat(auditTestStore.auditEvents()).isEmpty()
    assertThat(manualMappingTestStore.mappings(TENANT_ID, closingFolder.id)).isEmpty()
    assertThat(decisionRequestTestStore.records()).hasSize(1)
    assertThat(decisionRequestTestStore.records().single().resultKind)
      .isEqualTo(MappingSuggestionDecisionResultKind.REJECT_RECORDED)
  }

  @Test
  fun `same key and same payload replays stored success without duplicate mapping or audit after state changes`() {
    val closingFolder = seedReadyFolder()

    postDecision(closingFolder.id, acceptPayload(), "same-success")
      .andExpect {
        status { isOk() }
        jsonPath("$.resultKind") { value("MANUAL_MAPPING_CREATED") }
        jsonPath("$.appliedMapping.accountCode") { value("1000") }
        jsonPath("$.appliedMapping.targetCode") { value("BS.ASSET.CASH_AND_EQUIVALENTS") }
      }

    seedImportVersion(
      TENANT_ID,
      closingFolder.id,
      2,
      listOf(BalanceImportLine(2, "2000", "Revenue", decimal("0.00"), decimal("100.00")))
    )
    closingFolderTestStore.save(closingFolder.copy(status = ClosingFolderStatus.ARCHIVED))

    postDecision(closingFolder.id, acceptPayload(), "same-success")
      .andExpect {
        status { isOk() }
        jsonPath("$.resultKind") { value("MANUAL_MAPPING_CREATED") }
      }

    assertThat(manualMappingTestStore.mappings(TENANT_ID, closingFolder.id)).hasSize(1)
    assertThat(auditTestStore.auditEvents().map { it.command.action }).containsExactly(MANUAL_MAPPING_CREATED_ACTION)
    assertThat(decisionRequestTestStore.records()).hasSize(1)
    assertThat(decisionRequestTestStore.records()).noneMatch { it.resultKind == MappingSuggestionDecisionResultKind.PENDING }
  }

  @Test
  fun `same key with different payload is rejected without replacing the terminal result`() {
    val closingFolder = seedReadyFolder()

    postDecision(closingFolder.id, rejectPayload(reviewComment = "first"), "same-key-diff")
      .andExpect { status { isOk() } }

    postDecision(closingFolder.id, rejectPayload(reviewComment = "second"), "same-key-diff")
      .andExpect { status { isConflict() } }

    assertThat(decisionRequestTestStore.records()).hasSize(1)
    assertThat(decisionRequestTestStore.records().single().resultKind)
      .isEqualTo(MappingSuggestionDecisionResultKind.REJECT_RECORDED)
  }

  @Test
  fun `concurrent same key same payload creates one manual mapping effect`() {
    val closingFolder = seedReadyFolder()
    val executor = Executors.newFixedThreadPool(2)
    val statuses = java.util.Collections.synchronizedList(mutableListOf<Int>())

    repeat(2) {
      executor.submit {
        statuses += postDecisionResultStatus(closingFolder.id, acceptPayload(), "concurrent-same")
      }
    }

    executor.shutdown()
    assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue()

    assertThat(statuses).containsExactlyInAnyOrder(200, 200)
    assertThat(manualMappingTestStore.mappings(TENANT_ID, closingFolder.id)).hasSize(1)
    assertThat(auditTestStore.auditEvents().map { it.command.action }).containsExactly(MANUAL_MAPPING_CREATED_ACTION)
    assertThat(decisionRequestTestStore.records()).hasSize(1)
    assertThat(decisionRequestTestStore.records()).noneMatch { it.resultKind == MappingSuggestionDecisionResultKind.PENDING }
  }

  @Test
  fun `concurrent same key different payload leaves one terminal result and one conflict`() {
    val closingFolder = seedReadyFolder()
    val executor = Executors.newFixedThreadPool(2)
    val statuses = java.util.Collections.synchronizedList(mutableListOf<Int>())

    executor.submit {
      statuses += postDecisionResultStatus(closingFolder.id, rejectPayload(reviewComment = "first"), "concurrent-diff")
    }
    executor.submit {
      statuses += postDecisionResultStatus(closingFolder.id, rejectPayload(reviewComment = "second"), "concurrent-diff")
    }

    executor.shutdown()
    assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue()

    assertThat(statuses).containsExactlyInAnyOrder(200, 409)
    assertThat(decisionRequestTestStore.records()).hasSize(1)
    assertThat(decisionRequestTestStore.records()).noneMatch { it.resultKind == MappingSuggestionDecisionResultKind.PENDING }
  }

  private fun postDecision(
    closingFolderId: UUID,
    payload: String,
    idempotencyKey: String,
    accountCode: String = "1000"
  ) =
    mockMvc.post("/api/closing-folders/$closingFolderId/mappings/suggestions/$accountCode/decision") {
      header(ACTIVE_TENANT_HEADER, TENANT_ID.toString())
      header("Idempotency-Key", idempotencyKey)
      contentType = MediaType.APPLICATION_JSON
      content = payload
      with(actorJwt("user-123"))
    }

  private fun postDecisionResultStatus(
    closingFolderId: UUID,
    payload: String,
    idempotencyKey: String
  ): Int =
    postDecision(closingFolderId, payload, idempotencyKey).andReturn().response.status

  private fun seedReadyFolder(
    role: TenantRole = TenantRole.ACCOUNTANT,
    status: ClosingFolderStatus = ClosingFolderStatus.DRAFT,
    importVersion: Int = 1,
    lines: List<BalanceImportLine> = listOf(BalanceImportLine(2, "1000", "Bank CHF", decimal("100.00"), decimal("0.00")))
  ): ClosingFolder {
    val closingFolder = seedClosingFolder(TENANT_ID, status = status)
    seedMembership("user-123", TENANT_ID, role)
    seedImportVersion(TENANT_ID, closingFolder.id, importVersion, lines)
    return closingFolder
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
    status: ClosingFolderStatus = ClosingFolderStatus.DRAFT
  ): ClosingFolder {
    val now = OffsetDateTime.now(ZoneOffset.UTC)
    val folder = ClosingFolder(
      id = UUID.randomUUID(),
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
    lines: List<BalanceImportLine>
  ) {
    balanceImportTestStore.save(
      BalanceImportSnapshot(
        import = BalanceImport(
          id = UUID.randomUUID(),
          tenantId = tenantId,
          closingFolderId = closingFolderId,
          version = version,
          sourceFileName = "seed.csv",
          importedAt = OffsetDateTime.now(ZoneOffset.UTC).minusHours(version.toLong()),
          importedByUserId = UUID.randomUUID(),
          rowCount = lines.size,
          totalDebit = lines.fold(decimal("0")) { sum, line -> sum + line.debit },
          totalCredit = lines.fold(decimal("0")) { sum, line -> sum + line.credit }
        ),
        lines = lines
      )
    )
  }
}

@SpringBootTest(properties = ["ritomer.ai.mapping-suggestions.enabled=false"])
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class)
class MappingSuggestionDecisionFlagOffApiTest {
  @Autowired
  private lateinit var mockMvc: MockMvc

  @Autowired
  private lateinit var identityTestStore: IdentityTestStore

  @Autowired
  private lateinit var closingFolderTestStore: ClosingFolderTestStore

  @Autowired
  private lateinit var balanceImportTestStore: BalanceImportTestStore

  @Autowired
  private lateinit var decisionRequestTestStore: MappingSuggestionDecisionRequestTestStore

  @BeforeEach
  fun resetStores() {
    identityTestStore.reset()
    closingFolderTestStore.reset()
    balanceImportTestStore.reset()
    decisionRequestTestStore.reset()
  }

  @Test
  fun `feature flag off is a terminal 409 decision result`() {
    val closingFolder = seedClosingFolder()
    identityTestStore.seedActiveMembership("user-123", TENANT_ID, "tenant-alpha", "Tenant", TenantRole.ACCOUNTANT)
    seedImportVersion(closingFolder.id)

    mockMvc.post("/api/closing-folders/${closingFolder.id}/mappings/suggestions/1000/decision") {
      header(ACTIVE_TENANT_HEADER, TENANT_ID.toString())
      header("Idempotency-Key", "flag-off-key")
      contentType = MediaType.APPLICATION_JSON
      content = rejectPayload()
      with(actorJwt("user-123"))
    }.andExpect {
      status { isConflict() }
      jsonPath("$.resultKind") { value("CONFLICT_FLAG_OFF") }
    }

    assertThat(decisionRequestTestStore.records().single().resultKind)
      .isEqualTo(MappingSuggestionDecisionResultKind.CONFLICT_FLAG_OFF)
  }

  private fun seedClosingFolder(): ClosingFolder {
    val now = OffsetDateTime.now(ZoneOffset.UTC)
    val folder = ClosingFolder(
      id = UUID.randomUUID(),
      tenantId = TENANT_ID,
      name = "Closing FY24",
      periodStartOn = LocalDate.parse("2024-01-01"),
      periodEndOn = LocalDate.parse("2024-12-31"),
      externalRef = null,
      status = ClosingFolderStatus.DRAFT,
      archivedAt = null,
      archivedByUserId = null,
      createdAt = now.minusDays(1),
      updatedAt = now
    )
    closingFolderTestStore.save(folder)
    return folder
  }

  private fun seedImportVersion(closingFolderId: UUID) {
    val line = BalanceImportLine(2, "1000", "Bank CHF", decimal("100.00"), decimal("0.00"))
    balanceImportTestStore.save(
      BalanceImportSnapshot(
        import = BalanceImport(
          id = UUID.randomUUID(),
          tenantId = TENANT_ID,
          closingFolderId = closingFolderId,
          version = 1,
          sourceFileName = "seed.csv",
          importedAt = OffsetDateTime.now(ZoneOffset.UTC),
          importedByUserId = UUID.randomUUID(),
          rowCount = 1,
          totalDebit = line.debit,
          totalCredit = line.credit
        ),
        lines = listOf(line)
      )
    )
  }
}

@SpringBootTest(properties = ["ritomer.ai.mapping-suggestions.enabled=true"])
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class, MappingSuggestionDecisionInvalidOutputConfiguration::class)
class MappingSuggestionDecisionNonDecisionableApiTest {
  @Autowired
  private lateinit var mockMvc: MockMvc

  @Autowired
  private lateinit var identityTestStore: IdentityTestStore

  @Autowired
  private lateinit var closingFolderTestStore: ClosingFolderTestStore

  @Autowired
  private lateinit var balanceImportTestStore: BalanceImportTestStore

  @Autowired
  private lateinit var decisionRequestTestStore: MappingSuggestionDecisionRequestTestStore

  @BeforeEach
  fun resetStores() {
    identityTestStore.reset()
    closingFolderTestStore.reset()
    balanceImportTestStore.reset()
    decisionRequestTestStore.reset()
  }

  @Test
  fun `non decisionable read model is a terminal 409 decision result`() {
    val closingFolder = seedClosingFolder()
    identityTestStore.seedActiveMembership("user-123", TENANT_ID, "tenant-alpha", "Tenant", TenantRole.ACCOUNTANT)
    seedImportVersion(closingFolder.id)

    mockMvc.post("/api/closing-folders/${closingFolder.id}/mappings/suggestions/1000/decision") {
      header(ACTIVE_TENANT_HEADER, TENANT_ID.toString())
      header("Idempotency-Key", "non-decision")
      contentType = MediaType.APPLICATION_JSON
      content = rejectPayload()
      with(actorJwt("user-123"))
    }.andExpect {
      status { isConflict() }
      jsonPath("$.resultKind") { value("CONFLICT_NON_DECISIONABLE") }
    }

    assertThat(decisionRequestTestStore.records().single().resultKind)
      .isEqualTo(MappingSuggestionDecisionResultKind.CONFLICT_NON_DECISIONABLE)
  }

  private fun seedClosingFolder(): ClosingFolder {
    val now = OffsetDateTime.now(ZoneOffset.UTC)
    val folder = ClosingFolder(
      id = UUID.randomUUID(),
      tenantId = TENANT_ID,
      name = "Closing FY24",
      periodStartOn = LocalDate.parse("2024-01-01"),
      periodEndOn = LocalDate.parse("2024-12-31"),
      externalRef = null,
      status = ClosingFolderStatus.DRAFT,
      archivedAt = null,
      archivedByUserId = null,
      createdAt = now.minusDays(1),
      updatedAt = now
    )
    closingFolderTestStore.save(folder)
    return folder
  }

  private fun seedImportVersion(closingFolderId: UUID) {
    val line = BalanceImportLine(2, "1000", "Bank CHF", decimal("100.00"), decimal("0.00"))
    balanceImportTestStore.save(
      BalanceImportSnapshot(
        import = BalanceImport(
          id = UUID.randomUUID(),
          tenantId = TENANT_ID,
          closingFolderId = closingFolderId,
          version = 1,
          sourceFileName = "seed.csv",
          importedAt = OffsetDateTime.now(ZoneOffset.UTC),
          importedByUserId = UUID.randomUUID(),
          rowCount = 1,
          totalDebit = line.debit,
          totalCredit = line.credit
        ),
        lines = listOf(line)
      )
    )
  }
}

@TestConfiguration(proxyBeanMethods = false)
class MappingSuggestionDecisionInvalidOutputConfiguration {
  @Bean
  @Primary
  fun invalidOutputGenerationAccess(): MappingSuggestionGenerationAccess =
    MappingSuggestionGenerationAccess { _: AiMappingSuggestionGenerationRequest ->
      AiMappingSuggestionGenerationResult(
        suggestions = listOf(
          AiMappingSuggestion(
            accountCode = "1000",
            suggestedTargetCode = "BS.ASSET.CURRENT_SECTION",
            confidence = 0.82,
            riskLevel = AiMappingSuggestionRiskLevel.MEDIUM,
            rationale = "Invalid non selectable target.",
            evidence = listOf(
              AiMappingSuggestionEvidence(
                type = AiMappingSuggestionEvidenceType.ACCOUNT_LABEL,
                ref = "balance_import_line:1000",
                snippet = "Bank CHF"
              )
            ),
            requiresHumanReview = true,
            schemaVersion = "mapping-suggestion-v1",
            promptVersion = "not_applicable_for_stub",
            modelVersion = "not_applicable_for_stub"
          )
        )
      )
    }
}

private val TENANT_ID: UUID = UUID.fromString("11111111-1111-1111-1111-111111111111")
private val TENANT_BETA_ID: UUID = UUID.fromString("22222222-2222-2222-2222-222222222222")

private fun rejectPayload(
  latestImportVersion: Int = 1,
  accountCode: String = "1000",
  suggestionFingerprint: String = stubFingerprint(latestImportVersion = latestImportVersion, accountCode = accountCode),
  reviewComment: String? = null
): String =
  buildJsonPayload(
    decision = "REJECT",
    latestImportVersion = latestImportVersion,
    suggestionFingerprint = suggestionFingerprint,
    targetCode = null,
    reviewComment = reviewComment
  )

private fun acceptPayload(
  latestImportVersion: Int = 1,
  accountCode: String = "1000",
  targetCode: String = "BS.ASSET.CASH_AND_EQUIVALENTS",
  suggestionFingerprint: String = stubFingerprint(latestImportVersion = latestImportVersion, accountCode = accountCode)
): String =
  buildJsonPayload(
    decision = "ACCEPT",
    latestImportVersion = latestImportVersion,
    suggestionFingerprint = suggestionFingerprint,
    targetCode = targetCode,
    reviewComment = null
  )

private fun correctPayload(
  latestImportVersion: Int = 1,
  accountCode: String = "1000",
  targetCode: String = "PL.REVENUE.OPERATING_REVENUE",
  suggestionFingerprint: String = stubFingerprint(latestImportVersion = latestImportVersion, accountCode = accountCode)
): String =
  buildJsonPayload(
    decision = "CORRECT",
    latestImportVersion = latestImportVersion,
    suggestionFingerprint = suggestionFingerprint,
    targetCode = targetCode,
    reviewComment = null
  )

private fun buildJsonPayload(
  decision: String,
  latestImportVersion: Int,
  suggestionFingerprint: String,
  targetCode: String?,
  reviewComment: String?
): String {
  val target = targetCode?.let { ",\"targetCode\":\"${escapeJson(it)}\"" } ?: ""
  val comment = reviewComment?.let { ",\"reviewComment\":\"${escapeJson(it)}\"" } ?: ""
  return """{"decision":"$decision","latestImportVersion":$latestImportVersion,"suggestionFingerprint":"$suggestionFingerprint"$target$comment}"""
}

private fun escapeJson(value: String): String =
  value
    .replace("\\", "\\\\")
    .replace("\"", "\\\"")
    .replace("\n", "\\n")
    .replace("\t", "\\t")

private fun stubFingerprint(
  latestImportVersion: Int = 1,
  accountCode: String = "1000",
  suggestedTargetCode: String = "BS.ASSET.CASH_AND_EQUIVALENTS"
): String =
  MappingSuggestionFingerprints.calculate(
    latestImportVersion = latestImportVersion,
    taxonomyVersion = 2,
    suggestion = MappingSuggestion(
      accountCode = accountCode,
      accountLabel = "not-used-by-fingerprint",
      suggestedTargetCode = suggestedTargetCode,
      confidence = 0.82,
      riskLevel = MappingSuggestionRiskLevel.MEDIUM,
      rationale = "not used by fingerprint",
      evidence = listOf(
        MappingSuggestionEvidence(
          type = MappingSuggestionEvidenceType.ACCOUNT_LABEL,
          ref = "balance_import_line:$accountCode",
          snippet = "not used"
        ),
        MappingSuggestionEvidence(
          type = MappingSuggestionEvidenceType.TARGET_TAXONOMY,
          ref = "manual-mapping-targets-v2:$suggestedTargetCode",
          snippet = "not used"
        )
      ),
      requiresHumanReview = true,
      schemaVersion = "mapping-suggestion-v1",
      promptVersion = "not_applicable_for_stub",
      modelVersion = "not_applicable_for_stub"
    )
  )

private fun actorJwt(subject: String) = jwt().jwt { token -> token.subject(subject) }

private fun decimal(value: String) = java.math.BigDecimal(value)
