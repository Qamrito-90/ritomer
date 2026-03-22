package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.imports.application.BALANCE_IMPORT_CREATED_ACTION
import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.imports.domain.BalanceImportSnapshot
import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import java.nio.charset.StandardCharsets
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
import org.springframework.mock.web.MockMultipartFile
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class)
class BalanceImportApiTest {
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

  @BeforeEach
  fun resetStores() {
    identityTestStore.reset()
    auditTestStore.reset()
    closingFolderTestStore.reset()
    balanceImportTestStore.reset()
  }

  @Test
  fun `balance import endpoints require authentication`() {
    val closingFolderId = uuid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

    mockMvc.perform(
      multipart("/api/closing-folders/$closingFolderId/imports/balance")
        .file(csvFile(validCsvV1()))
        .header(ACTIVE_TENANT_HEADER, uuid("11111111-1111-1111-1111-111111111111").toString())
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized)

    mockMvc.get("/api/closing-folders/$closingFolderId/imports/balance/versions") {
      header(ACTIVE_TENANT_HEADER, uuid("11111111-1111-1111-1111-111111111111").toString())
    }.andExpect { status { isUnauthorized() } }

    mockMvc.get("/api/closing-folders/$closingFolderId/imports/balance/versions/1/diff-previous") {
      header(ACTIVE_TENANT_HEADER, uuid("11111111-1111-1111-1111-111111111111").toString())
    }.andExpect { status { isUnauthorized() } }
  }

  @Test
  fun `balance import endpoints require X-Tenant-Id`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    mockMvc.perform(
      multipart("/api/closing-folders/${closingFolder.id}/imports/balance")
        .file(csvFile(validCsvV1()))
        .with(actorJwt("user-123"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/imports/balance/versions") {
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/imports/balance/versions/1/diff-previous") {
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }
  }

  @Test
  fun `reviewer cannot import but can read without audit`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.REVIEWER)
    seedImportVersion(tenantId, closingFolder.id, 1, validLinesV1())

    mockMvc.perform(
      multipart("/api/closing-folders/${closingFolder.id}/imports/balance")
        .file(csvFile(validCsvV1()))
        .header(ACTIVE_TENANT_HEADER, tenantId.toString())
        .with(actorJwt("user-123"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/imports/balance/versions") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$[0].version") { value(1) }
    }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/imports/balance/versions/1/diff-previous") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.previousVersion") { value(nullValue()) }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `balance import endpoints return 404 when closing belongs to another tenant`() {
    val tenantAlphaId = uuid("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = uuid("22222222-2222-2222-2222-222222222222")
    val betaClosing = seedClosingFolder(tenantId = tenantBetaId)
    seedMembership("user-123", tenantAlphaId, TenantRole.ACCOUNTANT)
    seedMembership("user-123", tenantBetaId, TenantRole.ACCOUNTANT)

    mockMvc.perform(
      multipart("/api/closing-folders/${betaClosing.id}/imports/balance")
        .file(csvFile(validCsvV1()))
        .header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
        .with(actorJwt("user-123"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isNotFound)

    mockMvc.get("/api/closing-folders/${betaClosing.id}/imports/balance/versions") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }

    mockMvc.get("/api/closing-folders/${betaClosing.id}/imports/balance/versions/1/diff-previous") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `archived closing returns 409 without audit or version`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId, status = ClosingFolderStatus.ARCHIVED)
    seedMembership("user-123", tenantId, TenantRole.MANAGER)

    mockMvc.perform(
      multipart("/api/closing-folders/${closingFolder.id}/imports/balance")
        .file(csvFile(validCsvV1()))
        .header(ACTIVE_TENANT_HEADER, tenantId.toString())
        .with(actorJwt("user-123"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isConflict)

    assertThat(balanceImportTestStore.versions(tenantId, closingFolder.id)).isEmpty()
    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `invalid csv returns 400 without version or audit`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    mockMvc.perform(
      multipart("/api/closing-folders/${closingFolder.id}/imports/balance")
        .file(csvFile(invalidCsv()))
        .header(ACTIVE_TENANT_HEADER, tenantId.toString())
        .with(actorJwt("user-123"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest)
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.errors").isArray)

    assertThat(balanceImportTestStore.versions(tenantId, closingFolder.id)).isEmpty()
    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `successful import creates version one with useful diff and one audit`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    mockMvc.perform(
      multipart("/api/closing-folders/${closingFolder.id}/imports/balance")
        .file(csvFile(validCsvV1()))
        .header(ACTIVE_TENANT_HEADER, tenantId.toString())
        .with(actorJwt("user-123"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isCreated)
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.version").value(1))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.rowCount").value(2))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.totalDebit").value("100"))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.diffSummary.previousVersion").value(nullValue()))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.diffSummary.addedCount").value(2))

    assertThat(auditTestStore.auditEvents()).hasSize(1)
    assertThat(auditTestStore.auditEvents().single().command.action).isEqualTo(BALANCE_IMPORT_CREATED_ACTION)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/imports/balance/versions/1/diff-previous") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.version") { value(1) }
      jsonPath("$.previousVersion") { value(nullValue()) }
      jsonPath("$.added.length()") { value(2) }
      jsonPath("$.removed.length()") { value(0) }
      jsonPath("$.changed.length()") { value(0) }
    }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/imports/balance/versions") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$[0].version") { value(1) }
    }

    assertThat(auditTestStore.auditEvents()).hasSize(1)
  }

  @Test
  fun `second import creates version two and exposes diff n vs n minus one`() {
    val tenantId = uuid("11111111-1111-1111-1111-111111111111")
    val closingFolder = seedClosingFolder(tenantId = tenantId)
    seedMembership("user-123", tenantId, TenantRole.MANAGER)

    mockMvc.perform(
      multipart("/api/closing-folders/${closingFolder.id}/imports/balance")
        .file(csvFile(validCsvV1()))
        .header(ACTIVE_TENANT_HEADER, tenantId.toString())
        .with(actorJwt("user-123"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isCreated)

    mockMvc.perform(
      multipart("/api/closing-folders/${closingFolder.id}/imports/balance")
        .file(csvFile(validCsvV2()))
        .header(ACTIVE_TENANT_HEADER, tenantId.toString())
        .with(actorJwt("user-123"))
    ).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isCreated)
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.version").value(2))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.diffSummary.previousVersion").value(1))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.diffSummary.addedCount").value(1))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.diffSummary.removedCount").value(1))
      .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.diffSummary.changedCount").value(1))

    assertThat(auditTestStore.auditEvents()).hasSize(2)

    mockMvc.get("/api/closing-folders/${closingFolder.id}/imports/balance/versions") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$[0].version") { value(2) }
      jsonPath("$[1].version") { value(1) }
    }

    mockMvc.get("/api/closing-folders/${closingFolder.id}/imports/balance/versions/2/diff-previous") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.previousVersion") { value(1) }
      jsonPath("$.added.length()") { value(1) }
      jsonPath("$.added[0].accountCode") { value("3000") }
      jsonPath("$.removed.length()") { value(1) }
      jsonPath("$.removed[0].accountCode") { value("2000") }
      jsonPath("$.changed.length()") { value(1) }
      jsonPath("$.changed[0].accountCode") { value("1000") }
      jsonPath("$.changed[0].before.debit") { value("100") }
      jsonPath("$.changed[0].after.debit") { value("120") }
    }

    assertThat(auditTestStore.auditEvents()).hasSize(2)
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
    val totalDebit = lines.fold(java.math.BigDecimal.ZERO) { sum, line -> sum + line.debit }
    val totalCredit = lines.fold(java.math.BigDecimal.ZERO) { sum, line -> sum + line.credit }
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

  private fun validLinesV1(): List<BalanceImportLine> =
    listOf(
      BalanceImportLine(2, "1000", "Cash", java.math.BigDecimal("100.00"), java.math.BigDecimal("0.00")),
      BalanceImportLine(3, "2000", "Revenue", java.math.BigDecimal("0.00"), java.math.BigDecimal("100.00"))
    )

  private fun csvFile(content: String): MockMultipartFile =
    MockMultipartFile("file", "balance.csv", MediaType.TEXT_PLAIN_VALUE, content.toByteArray(StandardCharsets.UTF_8))

  private fun validCsvV1(): String =
    """
    accountCode,accountLabel,debit,credit
    1000,Cash,100.00,0.00
    2000,Revenue,0.00,100.00
    """.trimIndent()

  private fun validCsvV2(): String =
    """
    accountCode,accountLabel,debit,credit
    1000,Cash,120.00,0.00
    3000,Receivable,0.00,120.00
    """.trimIndent()

  private fun invalidCsv(): String =
    """
    accountCode,accountLabel,debit,credit
    1000,Cash,100.00,0.00
    1000,Cash duplicate,0.00,10.00
    """.trimIndent()

  private fun uuid(value: String): UUID = UUID.fromString(value)
}

private fun actorJwt(
  subject: String,
  extraClaims: Map<String, Any> = emptyMap()
) = jwt().jwt { token ->
  token.subject(subject)
  extraClaims.forEach { (claimName, value) -> token.claim(claimName, value) }
}
