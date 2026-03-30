package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.imports.domain.BalanceImportSnapshot
import ch.qamwaq.ritomer.mapping.domain.ManualMapping
import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
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
import org.springframework.context.annotation.Import
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class)
class FinancialSummaryApiTest {
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
  fun `financial summary endpoint requires authentication and emits no audit`() {
    mockMvc.get("/api/closing-folders/${UUID.randomUUID()}/financial-summary") {
      header(ACTIVE_TENANT_HEADER, uuid("11111111-1111-1111-1111-111111111111").toString())
    }.andExpect { status { isUnauthorized() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `financial summary endpoint returns 400 when tenant header is absent blank malformed and when id is invalid`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-summary") {
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-summary") {
      header(ACTIVE_TENANT_HEADER, "   ")
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-summary") {
      header(ACTIVE_TENANT_HEADER, "not-a-uuid")
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/not-a-uuid/financial-summary") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `all current tenant roles can read financial summary`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("accountant", tenantId, TenantRole.ACCOUNTANT)
    seedMembership("reviewer", tenantId, TenantRole.REVIEWER)
    seedMembership("manager", tenantId, TenantRole.MANAGER)
    seedMembership("admin", tenantId, TenantRole.ADMIN)

    listOf("accountant", "reviewer", "manager", "admin").forEach { subject ->
      mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-summary") {
        header(ACTIVE_TENANT_HEADER, tenantId.toString())
        with(actorJwt(subject))
      }.andExpect { status { isOk() } }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `financial summary returns 403 when tenant is inaccessible membership inactive or tenant inactive`() {
    val tenantAlphaId = uuid("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = uuid("22222222-2222-2222-2222-222222222222")
    val closingFolder = seedClosingFolder(tenantAlphaId)

    seedMembership("user-alpha", tenantAlphaId, TenantRole.ACCOUNTANT)
    seedMembership("user-inactive-membership", tenantAlphaId, TenantRole.ACCOUNTANT, membershipStatus = "INACTIVE")
    seedMembership("user-inactive-tenant", tenantAlphaId, TenantRole.ACCOUNTANT, tenantStatus = "INACTIVE")

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-summary") {
      header(ACTIVE_TENANT_HEADER, tenantBetaId.toString())
      with(actorJwt("user-alpha"))
    }.andExpect { status { isForbidden() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-summary") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-inactive-membership"))
    }.andExpect { status { isForbidden() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-summary") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-inactive-tenant"))
    }.andExpect { status { isForbidden() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `financial summary returns 404 when closing is absent or outside tenant`() {
    val tenantAlphaId = uuid("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = uuid("22222222-2222-2222-2222-222222222222")
    val betaClosing = seedClosingFolder(tenantBetaId)
    seedMembership("user-123", tenantAlphaId, TenantRole.ACCOUNTANT)
    seedMembership("user-123", tenantBetaId, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${UUID.randomUUID()}/financial-summary") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }

    mockMvc.get("/api/closing-folders/${betaClosing.id}/financial-summary") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `financial summary returns no data with explicit blockers when no import exists`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-summary") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.closingFolderStatus") { value("DRAFT") }
      jsonPath("$.readiness") { value("BLOCKED") }
      jsonPath("$.statementState") { value("NO_DATA") }
      jsonPath("$.latestImportVersion") { value(nullValue()) }
      jsonPath("$.coverage.totalLines") { value(0) }
      jsonPath("$.coverage.mappedLines") { value(0) }
      jsonPath("$.coverage.unmappedLines") { value(0) }
      jsonPath("$.coverage.mappedShare") { value("0") }
      jsonPath("$.blockers.length()") { value(1) }
      jsonPath("$.blockers[0].code") { value("LATEST_VALID_BALANCE_IMPORT_PRESENT") }
      jsonPath("$.nextAction.code") { value("IMPORT_BALANCE") }
      jsonPath("$.nextAction.path") { value("/api/closing-folders/${closingFolder.id}/imports/balance") }
      jsonPath("$.nextAction.actionable") { value(true) }
      jsonPath("$.unmappedBalanceImpact.debitTotal") { value("0") }
      jsonPath("$.unmappedBalanceImpact.creditTotal") { value("0") }
      jsonPath("$.unmappedBalanceImpact.netDebitMinusCredit") { value("0") }
      jsonPath("$.balanceSheetSummary") { value(nullValue()) }
      jsonPath("$.incomeStatementSummary") { value(nullValue()) }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `financial summary returns preview partial with exact coverage impact and mapped totals`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)
    seedImportVersion(
      tenantId,
      closingFolder.id,
      2,
      listOf(
        BalanceImportLine(2, "1000", "Cash", decimal("100.00"), decimal("0.00")),
        BalanceImportLine(4, "2000", "Revenue", decimal("0.00"), decimal("175.00")),
        BalanceImportLine(7, "0500", "Receivable", decimal("75.00"), decimal("0.00"))
      )
    )
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1000", "BS.ASSET"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "2000", "PL.REVENUE"))

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-summary") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.readiness") { value("BLOCKED") }
      jsonPath("$.statementState") { value("PREVIEW_PARTIAL") }
      jsonPath("$.latestImportVersion") { value(2) }
      jsonPath("$.coverage.totalLines") { value(3) }
      jsonPath("$.coverage.mappedLines") { value(2) }
      jsonPath("$.coverage.unmappedLines") { value(1) }
      jsonPath("$.coverage.mappedShare") { value("0.6667") }
      jsonPath("$.blockers.length()") { value(1) }
      jsonPath("$.blockers[0].code") { value("MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT") }
      jsonPath("$.nextAction.code") { value("COMPLETE_MANUAL_MAPPING") }
      jsonPath("$.nextAction.path") { value("/api/closing-folders/${closingFolder.id}/mappings/manual") }
      jsonPath("$.nextAction.actionable") { value(true) }
      jsonPath("$.unmappedBalanceImpact.debitTotal") { value("75") }
      jsonPath("$.unmappedBalanceImpact.creditTotal") { value("0") }
      jsonPath("$.unmappedBalanceImpact.netDebitMinusCredit") { value("75") }
      jsonPath("$.balanceSheetSummary.assets") { value("100") }
      jsonPath("$.balanceSheetSummary.liabilities") { value("0") }
      jsonPath("$.balanceSheetSummary.equity") { value("0") }
      jsonPath("$.balanceSheetSummary.currentPeriodResult") { value("175") }
      jsonPath("$.balanceSheetSummary.totalAssets") { value("100") }
      jsonPath("$.balanceSheetSummary.totalLiabilitiesAndEquity") { value("175") }
      jsonPath("$.incomeStatementSummary.revenue") { value("175") }
      jsonPath("$.incomeStatementSummary.expenses") { value("0") }
      jsonPath("$.incomeStatementSummary.netResult") { value("175") }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `financial summary reflects only the latest import after reimport`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)
    seedImportVersion(
      tenantId,
      closingFolder.id,
      1,
      listOf(
        BalanceImportLine(2, "1000", "Cash", decimal("100.00"), decimal("0.00")),
        BalanceImportLine(3, "2000", "Revenue", decimal("0.00"), decimal("100.00"))
      )
    )
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1000", "BS.ASSET"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "2000", "PL.REVENUE"))
    seedImportVersion(
      tenantId,
      closingFolder.id,
      2,
      listOf(
        BalanceImportLine(2, "1000", "Cash", decimal("100.00"), decimal("0.00")),
        BalanceImportLine(4, "3000", "Liability", decimal("0.00"), decimal("100.00"))
      )
    )

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-summary") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.statementState") { value("PREVIEW_PARTIAL") }
      jsonPath("$.latestImportVersion") { value(2) }
      jsonPath("$.coverage.totalLines") { value(2) }
      jsonPath("$.coverage.mappedLines") { value(1) }
      jsonPath("$.coverage.unmappedLines") { value(1) }
      jsonPath("$.coverage.mappedShare") { value("0.5") }
      jsonPath("$.unmappedBalanceImpact.debitTotal") { value("0") }
      jsonPath("$.unmappedBalanceImpact.creditTotal") { value("100") }
      jsonPath("$.unmappedBalanceImpact.netDebitMinusCredit") { value("-100") }
      jsonPath("$.incomeStatementSummary.revenue") { value("0") }
      jsonPath("$.incomeStatementSummary.expenses") { value("0") }
      jsonPath("$.incomeStatementSummary.netResult") { value("0") }
      jsonPath("$.balanceSheetSummary.assets") { value("100") }
      jsonPath("$.balanceSheetSummary.totalLiabilitiesAndEquity") { value("0") }
      jsonPath("$.blockers[0].code") { value("MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT") }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `financial summary returns preview ready when import exists and mapping is complete`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.REVIEWER)
    seedImportVersion(
      tenantId,
      closingFolder.id,
      3,
      listOf(
        BalanceImportLine(2, "1000", "Cash", decimal("100.00"), decimal("0.00")),
        BalanceImportLine(3, "2000", "Revenue", decimal("0.00"), decimal("100.00"))
      )
    )
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1000", "BS.ASSET"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "2000", "PL.REVENUE"))

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-summary") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.readiness") { value("READY") }
      jsonPath("$.statementState") { value("PREVIEW_READY") }
      jsonPath("$.latestImportVersion") { value(3) }
      jsonPath("$.coverage.totalLines") { value(2) }
      jsonPath("$.coverage.mappedLines") { value(2) }
      jsonPath("$.coverage.unmappedLines") { value(0) }
      jsonPath("$.coverage.mappedShare") { value("1") }
      jsonPath("$.blockers.length()") { value(0) }
      jsonPath("$.nextAction") { value(nullValue()) }
      jsonPath("$.unmappedBalanceImpact.debitTotal") { value("0") }
      jsonPath("$.incomeStatementSummary.netResult") { value("100") }
      jsonPath("$.balanceSheetSummary.totalLiabilitiesAndEquity") { value("100") }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `financial summary allows archived closing read and marks next action as not actionable`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId, status = ClosingFolderStatus.ARCHIVED)
    seedMembership("user-123", tenantId, TenantRole.MANAGER)
    seedImportVersion(
      tenantId,
      closingFolder.id,
      1,
      listOf(
        BalanceImportLine(2, "1000", "Cash", decimal("100.00"), decimal("0.00")),
        BalanceImportLine(3, "2000", "Revenue", decimal("0.00"), decimal("100.00"))
      )
    )
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1000", "BS.ASSET"))

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-summary") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.closingFolderStatus") { value("ARCHIVED") }
      jsonPath("$.statementState") { value("PREVIEW_PARTIAL") }
      jsonPath("$.nextAction.code") { value("COMPLETE_MANUAL_MAPPING") }
      jsonPath("$.nextAction.actionable") { value(false) }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  private fun seedMembership(
    subject: String,
    tenantId: UUID,
    vararg roles: TenantRole,
    membershipStatus: String = "ACTIVE",
    tenantStatus: String = "ACTIVE"
  ) {
    identityTestStore.seedMembership(
      subject,
      tenantId,
      "tenant-${tenantId.toString().take(4)}",
      "Tenant",
      membershipStatus,
      tenantStatus,
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

  private fun decimal(value: String) = java.math.BigDecimal(value)

  private fun uuid(value: String): UUID = UUID.fromString(value)
}

private fun actorJwt(
  subject: String,
  extraClaims: Map<String, Any> = emptyMap()
) = jwt().jwt { token ->
  token.subject(subject)
  extraClaims.forEach { (claimName, value) -> token.claim(claimName, value) }
}
