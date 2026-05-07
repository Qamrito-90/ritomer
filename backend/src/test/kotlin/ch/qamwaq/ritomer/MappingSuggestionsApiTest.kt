package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionGenerationRequest
import ch.qamwaq.ritomer.ai.access.AiMappingSuggestionGenerationResult
import ch.qamwaq.ritomer.ai.access.MappingSuggestionGenerationAccess
import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.identity.access.TenantAccessResolver
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.imports.domain.BalanceImportSnapshot
import ch.qamwaq.ritomer.mapping.domain.ManualMapping
import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import ch.qamwaq.ritomer.shared.application.TenantContextProvider
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
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
class MappingSuggestionsApiTest {
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

  @BeforeEach
  fun resetStores() {
    identityTestStore.reset()
    auditTestStore.reset()
    closingFolderTestStore.reset()
    balanceImportTestStore.reset()
    manualMappingTestStore.reset()
  }

  @Test
  fun `suggestions endpoint requires authentication`() {
    mockMvc.get("/api/closing-folders/${UUID.randomUUID()}/mappings/suggestions") {
      header(ACTIVE_TENANT_HEADER, uuid("11111111-1111-1111-1111-111111111111").toString())
    }.andExpect { status { isUnauthorized() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `suggestions endpoint returns 400 when tenant header is absent blank or malformed`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/suggestions") {
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/suggestions") {
      header(ACTIVE_TENANT_HEADER, "   ")
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/suggestions") {
      header(ACTIVE_TENANT_HEADER, "not-a-uuid")
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `all manual mapping read roles can read suggestions`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("accountant", tenantId, TenantRole.ACCOUNTANT)
    seedMembership("reviewer", tenantId, TenantRole.REVIEWER)
    seedMembership("manager", tenantId, TenantRole.MANAGER)
    seedMembership("admin", tenantId, TenantRole.ADMIN)

    listOf("accountant", "reviewer", "manager", "admin").forEach { subject ->
      mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/suggestions") {
        header(ACTIVE_TENANT_HEADER, tenantId.toString())
        with(actorJwt(subject))
      }.andExpect {
        status { isOk() }
        jsonPath("$.state") { value("NO_IMPORT") }
      }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `suggestions endpoint returns 403 when tenant is inaccessible`() {
    val tenantAlphaId = uuid("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = uuid("22222222-2222-2222-2222-222222222222")
    val closingFolder = seedClosingFolder(tenantId = tenantAlphaId)
    seedMembership("user-alpha", tenantAlphaId, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/suggestions") {
      header(ACTIVE_TENANT_HEADER, tenantBetaId.toString())
      with(actorJwt("user-alpha"))
    }.andExpect { status { isForbidden() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `suggestions endpoint returns 404 when closing is absent or outside active tenant`() {
    val tenantAlphaId = uuid("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = uuid("22222222-2222-2222-2222-222222222222")
    val betaClosing = seedClosingFolder(tenantId = tenantBetaId)
    seedMembership("user-123", tenantAlphaId, TenantRole.ACCOUNTANT)
    seedMembership("user-123", tenantBetaId, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${UUID.randomUUID()}/mappings/suggestions") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }

    mockMvc.get("/api/closing-folders/${betaClosing.id}/mappings/suggestions") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `no import returns no import state without audit`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/suggestions") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.state") { value("NO_IMPORT") }
      jsonPath("$.closingFolderId") { value(closingFolder.id.toString()) }
      jsonPath("$.latestImportVersion") { value(nullValue()) }
      jsonPath("$.taxonomyVersion") { value(2) }
      jsonPath("$.suggestions.length()") { value(0) }
      jsonPath("$.errors[0].code") { value("NO_LATEST_IMPORT") }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
    assertThat(manualMappingTestStore.mappings(tenantId, closingFolder.id)).isEmpty()
  }

  @Test
  fun `archived closing returns archived read only state without audit or write`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId, status = ClosingFolderStatus.ARCHIVED)
    seedMembership("user-123", tenantId, TenantRole.MANAGER)
    seedImportVersion(
      tenantId,
      closingFolder.id,
      2,
      listOf(BalanceImportLine(2, "1000", "Bank CHF", decimal("100.00"), decimal("0.00")))
    )

    mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/suggestions") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.state") { value("ARCHIVED_READ_ONLY") }
      jsonPath("$.latestImportVersion") { value(2) }
      jsonPath("$.suggestions.length()") { value(0) }
      jsonPath("$.errors[0].code") { value("ARCHIVED_READ_ONLY") }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
    assertThat(manualMappingTestStore.mappings(tenantId, closingFolder.id)).isEmpty()
  }

  @Test
  fun `ready state returns deterministic safe suggestion without creating audit or manual mapping`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)
    seedImportVersion(
      tenantId,
      closingFolder.id,
      3,
      listOf(
        BalanceImportLine(2, "1000", "Bank CHF", decimal("100.00"), decimal("0.00")),
        BalanceImportLine(3, "2000", "Revenue", decimal("0.00"), decimal("100.00"))
      )
    )
    manualMappingTestStore.save(
      manualMapping(
        tenantId = tenantId,
        closingFolderId = closingFolder.id,
        accountCode = "2000",
        targetCode = "PL.REVENUE.OPERATING_REVENUE"
      )
    )

    mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/suggestions") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.state") { value("READY") }
      jsonPath("$.latestImportVersion") { value(3) }
      jsonPath("$.taxonomyVersion") { value(2) }
      jsonPath("$.suggestions.length()") { value(1) }
      jsonPath("$.suggestions[0].accountCode") { value("1000") }
      jsonPath("$.suggestions[0].accountLabel") { value("Bank CHF") }
      jsonPath("$.suggestions[0].suggestedTargetCode") { value("BS.ASSET.CASH_AND_EQUIVALENTS") }
      jsonPath("$.suggestions[0].confidence") { value(0.82) }
      jsonPath("$.suggestions[0].riskLevel") { value("MEDIUM") }
      jsonPath("$.suggestions[0].evidence.length()") { value(2) }
      jsonPath("$.suggestions[0].requiresHumanReview") { value(true) }
      jsonPath("$.suggestions[0].schemaVersion") { value("mapping-suggestion-v1") }
      jsonPath("$.suggestions[0].promptVersion") { value("not_applicable_for_stub") }
      jsonPath("$.suggestions[0].modelVersion") { value("not_applicable_for_stub") }
      jsonPath("$.errors.length()") { value(0) }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
    assertThat(manualMappingTestStore.mappings(tenantId, closingFolder.id).map { it.accountCode })
      .containsExactly("2000")
  }

  @Test
  fun `decision post is not implemented in 030b`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    mockMvc.post("/api/closing-folders/${closingFolder.id}/mappings/suggestions/1000/decision") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"decision":"REJECT","latestImportVersion":1}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
    assertThat(manualMappingTestStore.mappings(tenantId, closingFolder.id)).isEmpty()
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
          sourceFileName = "seed.csv",
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

@SpringBootTest(properties = ["ritomer.ai.mapping-suggestions.enabled=false"])
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class, MappingSuggestionsFlagOffTestConfiguration::class)
class MappingSuggestionsFlagOffApiTest {
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
  private lateinit var recordingGenerationAccess: RecordingMappingSuggestionGenerationAccess

  @BeforeEach
  fun resetStores() {
    identityTestStore.reset()
    auditTestStore.reset()
    closingFolderTestStore.reset()
    balanceImportTestStore.reset()
    manualMappingTestStore.reset()
    recordingGenerationAccess.reset()
  }

  @Test
  fun `feature flag off returns disabled and does not call adapter`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)
    seedImportVersion(
      tenantId,
      closingFolder.id,
      3,
      listOf(BalanceImportLine(2, "1000", "Bank CHF", decimal("100.00"), decimal("0.00")))
    )

    mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/suggestions") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.state") { value("DISABLED") }
      jsonPath("$.latestImportVersion") { value(nullValue()) }
      jsonPath("$.taxonomyVersion") { value(2) }
      jsonPath("$.suggestions.length()") { value(0) }
      jsonPath("$.errors[0].code") { value("AI_MAPPING_SUGGESTIONS_DISABLED") }
    }

    assertThat(recordingGenerationAccess.calls).isZero()
    assertThat(auditTestStore.auditEvents()).isEmpty()
    assertThat(manualMappingTestStore.mappings(tenantId, closingFolder.id)).isEmpty()
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
    id: UUID = UUID.randomUUID()
  ): ClosingFolder {
    val now = OffsetDateTime.now(ZoneOffset.UTC)
    val folder = ClosingFolder(
      id = id,
      tenantId = tenantId,
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

  private fun seedImportVersion(
    tenantId: UUID,
    closingFolderId: UUID,
    version: Int,
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
          sourceFileName = "seed.csv",
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
}

@SpringBootTest(properties = ["ritomer.ai.mapping-suggestions.enabled=true"])
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class, MappingSuggestionsInsufficientRoleTestConfiguration::class)
class MappingSuggestionsInsufficientRoleApiTest {
  @Autowired
  private lateinit var mockMvc: MockMvc

  @Autowired
  private lateinit var closingFolderTestStore: ClosingFolderTestStore

  @BeforeEach
  fun resetStores() {
    closingFolderTestStore.reset()
  }

  @Test
  fun `suggestions endpoint returns 403 for insufficient role`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/suggestions") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isForbidden() } }
  }

  private fun seedClosingFolder(
    tenantId: UUID,
    id: UUID = UUID.randomUUID()
  ): ClosingFolder {
    val now = OffsetDateTime.now(ZoneOffset.UTC)
    val folder = ClosingFolder(
      id = id,
      tenantId = tenantId,
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
}

@TestConfiguration(proxyBeanMethods = false)
class MappingSuggestionsFlagOffTestConfiguration {
  @Bean
  @Primary
  fun recordingMappingSuggestionGenerationAccess(): RecordingMappingSuggestionGenerationAccess =
    RecordingMappingSuggestionGenerationAccess()
}

class RecordingMappingSuggestionGenerationAccess : MappingSuggestionGenerationAccess {
  var calls: Int = 0
    private set

  fun reset() {
    calls = 0
  }

  override fun generate(request: AiMappingSuggestionGenerationRequest): AiMappingSuggestionGenerationResult {
    calls += 1
    return AiMappingSuggestionGenerationResult(emptyList())
  }
}

@TestConfiguration(proxyBeanMethods = false)
class MappingSuggestionsInsufficientRoleTestConfiguration {
  @Bean
  @Primary
  fun insufficientRoleTenantAccessResolver(
    tenantContextProvider: TenantContextProvider
  ): TenantAccessResolver =
    TenantAccessResolver {
      TenantAccessContext(
        actorUserId = UUID.fromString("99999999-9999-9999-9999-999999999999"),
        actorSubject = "user-123",
        tenantId = tenantContextProvider.currentTenantContext().requiredTenantId(),
        effectiveRoles = setOf("VIEWER")
      )
    }
}

private fun actorJwt(
  subject: String
) = jwt().jwt { token ->
  token.subject(subject)
}

private fun decimal(value: String) = java.math.BigDecimal(value)

private fun uuid(value: String): UUID = UUID.fromString(value)
