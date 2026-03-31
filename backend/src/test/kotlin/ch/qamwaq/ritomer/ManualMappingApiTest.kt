package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.imports.domain.BalanceImportSnapshot
import ch.qamwaq.ritomer.mapping.application.MANUAL_MAPPING_CREATED_ACTION
import ch.qamwaq.ritomer.mapping.application.MANUAL_MAPPING_DELETED_ACTION
import ch.qamwaq.ritomer.mapping.application.MANUAL_MAPPING_UPDATED_ACTION
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
import org.springframework.http.MediaType
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.put

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class)
class ManualMappingApiTest {
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
  fun `manual mapping endpoints require authentication`() {
    val closingFolderId = uuid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

    mockMvc.get("/api/closing-folders/$closingFolderId/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, uuid("11111111-1111-1111-1111-111111111111").toString())
    }.andExpect { status { isUnauthorized() } }

    mockMvc.put("/api/closing-folders/$closingFolderId/mappings/manual") {
      contentType = MediaType.APPLICATION_JSON
      content = """{"accountCode":"1000","targetCode":"BS.ASSET"}"""
      header(ACTIVE_TENANT_HEADER, uuid("11111111-1111-1111-1111-111111111111").toString())
    }.andExpect { status { isUnauthorized() } }

    mockMvc.delete("/api/closing-folders/$closingFolderId/mappings/manual") {
      queryParam("accountCode", "1000")
      header(ACTIVE_TENANT_HEADER, uuid("11111111-1111-1111-1111-111111111111").toString())
    }.andExpect { status { isUnauthorized() } }
  }

  @Test
  fun `reviewer can read but cannot write or delete`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.REVIEWER)
    seedImportVersion(tenantId, closingFolder.id, 1, unsortedLinesV1())

    mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.summary.total") { value(2) }
    }

    mockMvc.put("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"accountCode":"1000","targetCode":"BS.ASSET"}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isForbidden() } }

    mockMvc.delete("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      queryParam("accountCode", "1000")
      with(actorJwt("user-123"))
    }.andExpect { status { isForbidden() } }
  }

  @Test
  fun `get returns empty projection when no import exists and targets are sorted`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.closingFolderId") { value(closingFolder.id.toString()) }
      jsonPath("$.taxonomyVersion") { value(2) }
      jsonPath("$.latestImportVersion") { value(nullValue()) }
      jsonPath("$.lines.length()") { value(0) }
      jsonPath("$.mappings.length()") { value(0) }
      jsonPath("$.summary.total") { value(0) }
      jsonPath("$.summary.mapped") { value(0) }
      jsonPath("$.summary.unmapped") { value(0) }
      jsonPath("$.targets[0].code") { value("BS.ASSET") }
      jsonPath("$.targets[1].code") { value("BS.EQUITY") }
      jsonPath("$.targets[2].code") { value("BS.LIABILITY") }
      jsonPath("$.targets[3].code") { value("PL.EXPENSE") }
      jsonPath("$.targets[4].code") { value("PL.REVENUE") }
      jsonPath("$.targets[0].statement") { value("BALANCE_SHEET") }
      jsonPath("$.targets[0].summaryBucketCode") { value("BS.ASSET") }
      jsonPath("$.targets[0].sectionCode") { value("BS.ASSET") }
      jsonPath("$.targets[0].normalSide") { value("DEBIT") }
      jsonPath("$.targets[0].granularity") { value("LEAF") }
      jsonPath("$.targets[0].deprecated") { value(true) }
      jsonPath("$.targets[0].selectable") { value(true) }
    }
  }

  @Test
  fun `closing outside active tenant returns 404 on all mapping endpoints`() {
    val tenantAlphaId = uuid("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = uuid("22222222-2222-2222-2222-222222222222")
    val betaClosing = seedClosingFolder(tenantId = tenantBetaId)
    seedMembership("user-123", tenantAlphaId, TenantRole.ACCOUNTANT)
    seedMembership("user-123", tenantBetaId, TenantRole.ACCOUNTANT)

    mockMvc.get("/api/closing-folders/${betaClosing.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }

    mockMvc.put("/api/closing-folders/${betaClosing.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"accountCode":"1000","targetCode":"BS.ASSET"}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }

    mockMvc.delete("/api/closing-folders/${betaClosing.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      queryParam("accountCode", "1000")
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }
  }

  @Test
  fun `archived closing allows get but blocks put and delete`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId, status = ClosingFolderStatus.ARCHIVED)
    seedMembership("user-123", tenantId, TenantRole.MANAGER)
    seedImportVersion(tenantId, closingFolder.id, 1, unsortedLinesV1())

    mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.summary.total") { value(2) }
    }

    mockMvc.put("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"accountCode":"1000","targetCode":"BS.ASSET"}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isConflict() } }

    mockMvc.delete("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      queryParam("accountCode", "1000")
      with(actorJwt("user-123"))
    }.andExpect { status { isConflict() } }
  }

  @Test
  fun `put returns 409 when no import exists`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    mockMvc.put("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"accountCode":"1000","targetCode":"BS.ASSET"}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isConflict() } }
  }

  @Test
  fun `put validates unknown account code unknown target code and non selectable target code`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)
    seedImportVersion(tenantId, closingFolder.id, 1, unsortedLinesV1())

    mockMvc.put("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"accountCode":"9999","targetCode":"BS.ASSET"}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.put("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"accountCode":"1000","targetCode":"UNKNOWN"}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.put("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"accountCode":"1000","targetCode":"BS.ASSET.CURRENT_SECTION"}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }
  }

  @Test
  fun `put accepts both legacy v1 and selectable v2 target codes`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
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

    mockMvc.put("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"accountCode":"1000","targetCode":"BS.ASSET"}"""
      with(actorJwt("user-123"))
    }.andExpect {
      status { isCreated() }
      jsonPath("$.targetCode") { value("BS.ASSET") }
    }

    mockMvc.put("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"accountCode":"2000","targetCode":"PL.REVENUE.OPERATING_REVENUE"}"""
      with(actorJwt("user-123"))
    }.andExpect {
      status { isCreated() }
      jsonPath("$.targetCode") { value("PL.REVENUE.OPERATING_REVENUE") }
    }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.mappings.length()") { value(2) }
      jsonPath("$.mappings[0].targetCode") { value("BS.ASSET") }
      jsonPath("$.mappings[1].targetCode") { value("PL.REVENUE.OPERATING_REVENUE") }
    }
  }

  @Test
  fun `create update noop delete and idempotent delete follow exact audit rules`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.MANAGER)
    seedImportVersion(tenantId, closingFolder.id, 1, unsortedLinesV1())

    mockMvc.put("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"accountCode":"1000","targetCode":"BS.ASSET"}"""
      with(actorJwt("user-123"))
    }.andExpect {
      status { isCreated() }
      jsonPath("$.accountCode") { value("1000") }
      jsonPath("$.targetCode") { value("BS.ASSET") }
    }

    assertThat(auditTestStore.auditEvents()).hasSize(1)
    assertThat(auditTestStore.auditEvents().last().command.action).isEqualTo(MANUAL_MAPPING_CREATED_ACTION)
    assertThat(auditTestStore.auditEvents().last().command.metadata).isEqualTo(
      mapOf(
        "closingFolderId" to closingFolder.id.toString(),
        "accountCode" to "1000",
        "targetCode" to mapOf("before" to null, "after" to "BS.ASSET"),
        "latestImportVersion" to 1
      )
    )

    mockMvc.put("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"accountCode":"1000","targetCode":"PL.EXPENSE"}"""
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.accountCode") { value("1000") }
      jsonPath("$.targetCode") { value("PL.EXPENSE") }
    }

    assertThat(auditTestStore.auditEvents()).hasSize(2)
    assertThat(auditTestStore.auditEvents().last().command.action).isEqualTo(MANUAL_MAPPING_UPDATED_ACTION)
    assertThat(auditTestStore.auditEvents().last().command.metadata).isEqualTo(
      mapOf(
        "closingFolderId" to closingFolder.id.toString(),
        "accountCode" to "1000",
        "targetCode" to mapOf("before" to "BS.ASSET", "after" to "PL.EXPENSE"),
        "latestImportVersion" to 1
      )
    )

    mockMvc.put("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"accountCode":"1000","targetCode":"PL.EXPENSE"}"""
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.accountCode") { value("1000") }
      jsonPath("$.targetCode") { value("PL.EXPENSE") }
    }

    assertThat(auditTestStore.auditEvents()).hasSize(2)

    mockMvc.delete("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      queryParam("accountCode", "1000")
      with(actorJwt("user-123"))
    }.andExpect { status { isNoContent() } }

    assertThat(auditTestStore.auditEvents()).hasSize(3)
    assertThat(auditTestStore.auditEvents().last().command.action).isEqualTo(MANUAL_MAPPING_DELETED_ACTION)
    assertThat(auditTestStore.auditEvents().last().command.metadata).isEqualTo(
      mapOf(
        "closingFolderId" to closingFolder.id.toString(),
        "accountCode" to "1000",
        "targetCode" to mapOf("before" to "PL.EXPENSE", "after" to null),
        "latestImportVersion" to 1
      )
    )

    mockMvc.delete("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      queryParam("accountCode", "1000")
      with(actorJwt("user-123"))
    }.andExpect { status { isNoContent() } }

    assertThat(auditTestStore.auditEvents()).hasSize(3)
  }

  @Test
  fun `get uses deterministic ordering and decimal strings`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)
    seedImportVersion(tenantId, closingFolder.id, 1, unsortedLinesV1())
    manualMappingTestStore.save(
      manualMapping(
        tenantId = tenantId,
        closingFolderId = closingFolder.id,
        accountCode = "2000",
        targetCode = "PL.REVENUE"
      )
    )
    manualMappingTestStore.save(
      manualMapping(
        tenantId = tenantId,
        closingFolderId = closingFolder.id,
        accountCode = "1000",
        targetCode = "BS.ASSET"
      )
    )

    mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.lines[0].accountCode") { value("1000") }
      jsonPath("$.lines[0].debit") { value("100") }
      jsonPath("$.lines[0].credit") { value("0") }
      jsonPath("$.lines[1].accountCode") { value("2000") }
      jsonPath("$.mappings[0].accountCode") { value("1000") }
      jsonPath("$.mappings[1].accountCode") { value("2000") }
      jsonPath("$.summary.total") { value(2) }
      jsonPath("$.summary.mapped") { value(2) }
      jsonPath("$.summary.unmapped") { value(0) }
    }
  }

  @Test
  fun `reimport hides stale mapping from get and delete still removes it with audit`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.MANAGER)
    seedImportVersion(tenantId, closingFolder.id, 1, unsortedLinesV1())

    mockMvc.put("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"accountCode":"2000","targetCode":"PL.REVENUE"}"""
      with(actorJwt("user-123"))
    }.andExpect { status { isCreated() } }

    seedImportVersion(tenantId, closingFolder.id, 2, listOf(BalanceImportLine(5, "1000", "Cash", decimal("100.00"), decimal("0.00"))))

    mockMvc.get("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.latestImportVersion") { value(2) }
      jsonPath("$.mappings.length()") { value(0) }
      jsonPath("$.summary.total") { value(1) }
      jsonPath("$.summary.mapped") { value(0) }
    }

    mockMvc.delete("/api/closing-folders/${closingFolder.id}/mappings/manual") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      queryParam("accountCode", "2000")
      with(actorJwt("user-123"))
    }.andExpect { status { isNoContent() } }

    assertThat(auditTestStore.auditEvents()).hasSize(2)
    assertThat(auditTestStore.auditEvents().last().command.action).isEqualTo(MANUAL_MAPPING_DELETED_ACTION)
    assertThat(auditTestStore.auditEvents().last().command.metadata).isEqualTo(
      mapOf(
        "closingFolderId" to closingFolder.id.toString(),
        "accountCode" to "2000",
        "targetCode" to mapOf("before" to "PL.REVENUE", "after" to null),
        "latestImportVersion" to 2
      )
    )
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

  private fun unsortedLinesV1(): List<BalanceImportLine> =
    listOf(
      BalanceImportLine(3, "2000", "Revenue", decimal("0.00"), decimal("100.00")),
      BalanceImportLine(2, "1000", "Cash", decimal("100.00"), decimal("0.00"))
    )

  private fun manualMapping(
    tenantId: UUID,
    closingFolderId: UUID,
    accountCode: String,
    targetCode: String
  ) = ch.qamwaq.ritomer.mapping.domain.ManualMapping(
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
