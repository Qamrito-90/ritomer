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
class FinancialStatementsStructuredApiTest {
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
  fun `structured financial statements endpoint requires authentication and emits no audit`() {
    mockMvc.get("/api/closing-folders/${UUID.randomUUID()}/financial-statements/structured") {
      header(ACTIVE_TENANT_HEADER, uuid("11111111-1111-1111-1111-111111111111").toString())
    }.andExpect { status { isUnauthorized() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `structured financial statements returns 400 when tenant header is absent blank malformed and when id is invalid`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-statements/structured") {
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-statements/structured") {
      header(ACTIVE_TENANT_HEADER, "   ")
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-statements/structured") {
      header(ACTIVE_TENANT_HEADER, "not-a-uuid")
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/not-a-uuid/financial-statements/structured") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `all current tenant roles can read structured financial statements`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("accountant", tenantId, TenantRole.ACCOUNTANT)
    seedMembership("reviewer", tenantId, TenantRole.REVIEWER)
    seedMembership("manager", tenantId, TenantRole.MANAGER)
    seedMembership("admin", tenantId, TenantRole.ADMIN)

    listOf("accountant", "reviewer", "manager", "admin").forEach { subject ->
      mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-statements/structured") {
        header(ACTIVE_TENANT_HEADER, tenantId.toString())
        with(actorJwt(subject))
      }.andExpect { status { isOk() } }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `structured financial statements returns 403 when tenant is inaccessible membership inactive or tenant inactive`() {
    val tenantAlphaId = uuid("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = uuid("22222222-2222-2222-2222-222222222222")
    val closingFolder = seedClosingFolder(tenantAlphaId)

    seedMembership("user-alpha", tenantAlphaId, TenantRole.ACCOUNTANT)
    seedMembership("user-inactive-membership", tenantAlphaId, TenantRole.ACCOUNTANT, membershipStatus = "INACTIVE")
    seedMembership("user-inactive-tenant", tenantAlphaId, TenantRole.ACCOUNTANT, tenantStatus = "INACTIVE")

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-statements/structured") {
      header(ACTIVE_TENANT_HEADER, tenantBetaId.toString())
      with(actorJwt("user-alpha"))
    }.andExpect { status { isForbidden() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-statements/structured") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-inactive-membership"))
    }.andExpect { status { isForbidden() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-statements/structured") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-inactive-tenant"))
    }.andExpect { status { isForbidden() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `structured financial statements returns 404 when closing is absent or outside tenant`() {
    val tenantAlphaId = uuid("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = uuid("22222222-2222-2222-2222-222222222222")
    val betaClosing = seedClosingFolder(tenantBetaId)
    seedMembership("user-123", tenantAlphaId, TenantRole.ACCOUNTANT)
    seedMembership("user-123", tenantBetaId, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${UUID.randomUUID()}/financial-statements/structured") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }

    mockMvc.get("/api/closing-folders/${betaClosing.id}/financial-statements/structured") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `structured financial statements returns no data with explicit preview metadata and null statements`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-statements/structured") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.closingFolderStatus") { value("DRAFT") }
      jsonPath("$.readiness") { value("BLOCKED") }
      jsonPath("$.statementState") { value("NO_DATA") }
      jsonPath("$.presentationType") { value("STRUCTURED_PREVIEW") }
      jsonPath("$.isStatutory") { value(false) }
      jsonPath("$.taxonomyVersion") { value(2) }
      jsonPath("$.latestImportVersion") { value(nullValue()) }
      jsonPath("$.coverage.totalLines") { value(0) }
      jsonPath("$.coverage.mappedShare") { value("0") }
      jsonPath("$.blockers[0].code") { value("LATEST_VALID_BALANCE_IMPORT_PRESENT") }
      jsonPath("$.nextAction.code") { value("IMPORT_BALANCE") }
      jsonPath("$.balanceSheet") { value(nullValue()) }
      jsonPath("$.incomeStatement") { value(nullValue()) }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `structured financial statements returns blocked with null statements until preview ready`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)
    seedImportVersion(
      tenantId,
      closingFolder.id,
      2,
      listOf(
        BalanceImportLine(2, "1000", "Cash", decimal("250.00"), decimal("0.00")),
        BalanceImportLine(3, "3000", "Revenue", decimal("0.00"), decimal("175.00")),
        BalanceImportLine(4, "6200", "Expense", decimal("25.00"), decimal("0.00"))
      )
    )
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1000", "BS.ASSET.CASH_AND_EQUIVALENTS"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "3000", "PL.REVENUE.OPERATING_REVENUE"))

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-statements/structured") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.statementState") { value("BLOCKED") }
      jsonPath("$.presentationType") { value("STRUCTURED_PREVIEW") }
      jsonPath("$.isStatutory") { value(false) }
      jsonPath("$.latestImportVersion") { value(2) }
      jsonPath("$.coverage.totalLines") { value(3) }
      jsonPath("$.coverage.mappedLines") { value(2) }
      jsonPath("$.coverage.unmappedLines") { value(1) }
      jsonPath("$.coverage.mappedShare") { value("0.6667") }
      jsonPath("$.blockers[0].code") { value("MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT") }
      jsonPath("$.nextAction.code") { value("COMPLETE_MANUAL_MAPPING") }
      jsonPath("$.balanceSheet") { value(nullValue()) }
      jsonPath("$.incomeStatement") { value(nullValue()) }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `structured financial statements returns preview ready with stable group order and explicit legacy fallback`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.REVIEWER)
    seedImportVersion(
      tenantId,
      closingFolder.id,
      3,
      listOf(
        BalanceImportLine(2, "1000", "Cash legacy", decimal("200.00"), decimal("0.00")),
        BalanceImportLine(3, "1010", "Cash detailed", decimal("50.00"), decimal("0.00")),
        BalanceImportLine(4, "2100", "Trade payables", decimal("0.00"), decimal("40.00")),
        BalanceImportLine(5, "2800", "Share capital", decimal("0.00"), decimal("60.00")),
        BalanceImportLine(6, "3000", "Revenue", decimal("0.00"), decimal("175.00")),
        BalanceImportLine(7, "6200", "Expense", decimal("25.00"), decimal("0.00"))
      )
    )
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1000", "BS.ASSET"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1010", "BS.ASSET.CASH_AND_EQUIVALENTS"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "2100", "BS.LIABILITY.TRADE_PAYABLES"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "2800", "BS.EQUITY"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "3000", "PL.REVENUE.OPERATING_REVENUE"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "6200", "PL.EXPENSE"))

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-statements/structured") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.readiness") { value("READY") }
      jsonPath("$.statementState") { value("PREVIEW_READY") }
      jsonPath("$.presentationType") { value("STRUCTURED_PREVIEW") }
      jsonPath("$.isStatutory") { value(false) }
      jsonPath("$.coverage.mappedShare") { value("1") }
      jsonPath("$.blockers.length()") { value(0) }
      jsonPath("$.nextAction") { value(nullValue()) }
      jsonPath("$.balanceSheet.groups[0].code") { value("BS.ASSET") }
      jsonPath("$.balanceSheet.groups[0].breakdowns[0].code") { value("BS.ASSET.LEGACY_BUCKET_FALLBACK") }
      jsonPath("$.balanceSheet.groups[0].breakdowns[0].breakdownType") { value("LEGACY_BUCKET_FALLBACK") }
      jsonPath("$.balanceSheet.groups[0].breakdowns[0].label") { value("Legacy bucket-level mappings") }
      jsonPath("$.balanceSheet.groups[0].breakdowns[1].code") { value("BS.ASSET.CURRENT_SECTION") }
      jsonPath("$.balanceSheet.groups[1].code") { value("BS.LIABILITY") }
      jsonPath("$.balanceSheet.groups[2].code") { value("BS.EQUITY") }
      jsonPath("$.balanceSheet.totals.totalAssets") { value("250") }
      jsonPath("$.balanceSheet.totals.totalLiabilities") { value("40") }
      jsonPath("$.balanceSheet.totals.totalEquity") { value("60") }
      jsonPath("$.balanceSheet.totals.currentPeriodResult") { value("150") }
      jsonPath("$.balanceSheet.totals.totalLiabilitiesAndEquity") { value("250") }
      jsonPath("$.incomeStatement.groups[0].code") { value("PL.REVENUE") }
      jsonPath("$.incomeStatement.groups[1].code") { value("PL.EXPENSE") }
      jsonPath("$.incomeStatement.totals.totalRevenue") { value("175") }
      jsonPath("$.incomeStatement.totals.totalExpenses") { value("25") }
      jsonPath("$.incomeStatement.totals.netResult") { value("150") }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `canonical v2 and mixed legacy v1 v2 mappings keep the same group and statement totals`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)
    seedImportVersion(
      tenantId,
      closingFolder.id,
      4,
      listOf(
        BalanceImportLine(2, "1000", "Cash legacy", decimal("200.00"), decimal("0.00")),
        BalanceImportLine(3, "1010", "Cash detailed", decimal("50.00"), decimal("0.00")),
        BalanceImportLine(4, "2100", "Trade payables", decimal("0.00"), decimal("40.00")),
        BalanceImportLine(5, "2800", "Share capital", decimal("0.00"), decimal("60.00")),
        BalanceImportLine(6, "3000", "Revenue", decimal("0.00"), decimal("175.00")),
        BalanceImportLine(7, "6200", "Expense", decimal("25.00"), decimal("0.00"))
      )
    )

    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1000", "BS.ASSET.CASH_AND_EQUIVALENTS"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1010", "BS.ASSET.CASH_AND_EQUIVALENTS"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "2100", "BS.LIABILITY.TRADE_PAYABLES"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "2800", "BS.EQUITY.SHARE_CAPITAL"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "3000", "PL.REVENUE.OPERATING_REVENUE"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "6200", "PL.EXPENSE.PERSONNEL_EXPENSES"))

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-statements/structured") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.statementState") { value("PREVIEW_READY") }
      jsonPath("$.balanceSheet.groups[0].total") { value("250") }
      jsonPath("$.balanceSheet.groups[1].total") { value("40") }
      jsonPath("$.balanceSheet.groups[2].total") { value("60") }
      jsonPath("$.balanceSheet.totals.totalAssets") { value("250") }
      jsonPath("$.balanceSheet.totals.totalLiabilitiesAndEquity") { value("250") }
      jsonPath("$.incomeStatement.groups[0].total") { value("175") }
      jsonPath("$.incomeStatement.groups[1].total") { value("25") }
      jsonPath("$.incomeStatement.totals.netResult") { value("150") }
    }

    manualMappingTestStore.reset()
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1000", "BS.ASSET"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1010", "BS.ASSET.CASH_AND_EQUIVALENTS"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "2100", "BS.LIABILITY.TRADE_PAYABLES"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "2800", "BS.EQUITY"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "3000", "PL.REVENUE.OPERATING_REVENUE"))
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "6200", "PL.EXPENSE"))

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-statements/structured") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.statementState") { value("PREVIEW_READY") }
      jsonPath("$.balanceSheet.groups[0].total") { value("250") }
      jsonPath("$.balanceSheet.groups[1].total") { value("40") }
      jsonPath("$.balanceSheet.groups[2].total") { value("60") }
      jsonPath("$.balanceSheet.totals.totalAssets") { value("250") }
      jsonPath("$.balanceSheet.totals.totalLiabilitiesAndEquity") { value("250") }
      jsonPath("$.incomeStatement.groups[0].total") { value("175") }
      jsonPath("$.incomeStatement.groups[1].total") { value("25") }
      jsonPath("$.incomeStatement.totals.netResult") { value("150") }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `structured financial statements allows archived read and keeps blocked next action non actionable`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId, status = ClosingFolderStatus.ARCHIVED)
    seedMembership("user-123", tenantId, TenantRole.MANAGER)
    seedImportVersion(
      tenantId,
      closingFolder.id,
      1,
      listOf(
        BalanceImportLine(2, "1000", "Cash", decimal("100.00"), decimal("0.00")),
        BalanceImportLine(3, "3000", "Revenue", decimal("0.00"), decimal("100.00"))
      )
    )
    manualMappingTestStore.save(manualMapping(tenantId, closingFolder.id, "1000", "BS.ASSET"))

    mockMvc.get("/api/closing-folders/${closingFolder.id}/financial-statements/structured") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.closingFolderStatus") { value("ARCHIVED") }
      jsonPath("$.statementState") { value("BLOCKED") }
      jsonPath("$.nextAction.code") { value("COMPLETE_MANUAL_MAPPING") }
      jsonPath("$.nextAction.actionable") { value(false) }
      jsonPath("$.balanceSheet") { value(nullValue()) }
      jsonPath("$.incomeStatement") { value(nullValue()) }
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
