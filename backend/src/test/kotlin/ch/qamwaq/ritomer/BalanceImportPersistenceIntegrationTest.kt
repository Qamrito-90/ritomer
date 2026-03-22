package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.identity.application.AppUserRepository
import ch.qamwaq.ritomer.imports.application.BALANCE_IMPORT_CREATED_ACTION
import ch.qamwaq.ritomer.imports.application.BalanceImportBadRequestException
import ch.qamwaq.ritomer.imports.application.BalanceImportRepository
import ch.qamwaq.ritomer.imports.application.BalanceImportService
import java.nio.charset.StandardCharsets
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.dao.DataAccessException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.context.ActiveProfiles

@SpringBootTest
@ActiveProfiles("dbtest")
@Tag("db-integration")
@EnabledIfEnvironmentVariable(named = "RITOMER_DB_TESTS_ENABLED", matches = "true")
class BalanceImportPersistenceIntegrationTest {
  @Autowired
  private lateinit var jdbcTemplate: JdbcTemplate

  @Autowired
  private lateinit var appUserRepository: AppUserRepository

  @Autowired
  private lateinit var balanceImportRepository: BalanceImportRepository

  @Autowired
  private lateinit var balanceImportService: BalanceImportService

  @BeforeEach
  fun resetDatabaseState() {
    jdbcTemplate.execute("truncate table audit_event, balance_import_line, balance_import, closing_folder, tenant_membership, app_user, tenant cascade")
  }

  @Test
  fun `flyway applies migrations from scratch through V4`() {
    val versions = jdbcTemplate.queryForList(
      """
      select version
      from flyway_schema_history
      where success = true
        and version is not null
      order by installed_rank asc
      """.trimIndent(),
      String::class.java
    )

    assertThat(versions).containsSubsequence("1", "2", "3", "4")
  }

  @Test
  fun `imports schema is created`() {
    assertThat(tableExists("balance_import")).isTrue()
    assertThat(tableExists("balance_import_line")).isTrue()
    assertThat(columnExists("balance_import", "tenant_id")).isTrue()
    assertThat(columnExists("balance_import_line", "tenant_id")).isTrue()
  }

  @Test
  fun `repository persists versions and lines with tenant scoping`() {
    val tenantAlphaId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = UUID.fromString("22222222-2222-2222-2222-222222222222")
    insertTenant(tenantAlphaId, "tenant-alpha", "Tenant Alpha")
    insertTenant(tenantBetaId, "tenant-beta", "Tenant Beta")
    val user = appUserRepository.create("import-user", "import@example.com", "Import User")
    val closingAlphaId = insertClosingFolder(tenantAlphaId)
    val closingBetaId = insertClosingFolder(tenantBetaId)
    val access = access(user.id, tenantAlphaId)

    val createdV1 = balanceImportService.create(access, closingAlphaId, csvFile(validCsvV1()))
    val createdV2 = balanceImportService.create(access, closingAlphaId, csvFile(validCsvV2()))

    val versions = balanceImportRepository.findVersions(tenantAlphaId, closingAlphaId)
    val snapshotV2 = balanceImportRepository.findSnapshotByVersion(tenantAlphaId, closingAlphaId, 2)
    val crossTenantSnapshot = balanceImportRepository.findSnapshotByVersion(tenantAlphaId, closingBetaId, 1)
    val auditActions = jdbcTemplate.queryForList(
      """
      select action
      from audit_event
      where tenant_id = ?
      order by occurred_at asc, id asc
      """.trimIndent(),
      String::class.java,
      tenantAlphaId
    )

    assertThat(createdV1.balanceImport.version).isEqualTo(1)
    assertThat(createdV2.balanceImport.version).isEqualTo(2)
    assertThat(versions.map { it.version }).containsExactly(2, 1)
    assertThat(snapshotV2?.lines).hasSize(2)
    assertThat(crossTenantSnapshot).isNull()
    assertThat(auditActions).containsExactly(BALANCE_IMPORT_CREATED_ACTION, BALANCE_IMPORT_CREATED_ACTION)
  }

  @Test
  fun `db constraints enforce unique version and unique account code per import`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    val user = appUserRepository.create("import-user", "import@example.com", "Import User")
    val closingFolderId = insertClosingFolder(tenantId)
    val access = access(user.id, tenantId)
    val created = balanceImportService.create(access, closingFolderId, csvFile(validCsvV1())).balanceImport

    assertThatThrownBy {
      jdbcTemplate.update(
        """
        insert into balance_import (
          id,
          tenant_id,
          closing_folder_id,
          version,
          source_file_name,
          imported_at,
          imported_by_user_id,
          row_count,
          total_debit,
          total_credit
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """.trimIndent(),
        UUID.randomUUID(),
        tenantId,
        closingFolderId,
        created.version,
        "duplicate.csv",
        OffsetDateTime.now(),
        user.id,
        1,
        java.math.BigDecimal("10.00"),
        java.math.BigDecimal("10.00")
      )
    }.isInstanceOf(DataAccessException::class.java)

    assertThatThrownBy {
      jdbcTemplate.update(
        """
        insert into balance_import_line (
          id,
          tenant_id,
          balance_import_id,
          line_no,
          account_code,
          account_label,
          debit,
          credit
        ) values (?, ?, ?, ?, ?, ?, ?, ?)
        """.trimIndent(),
        UUID.randomUUID(),
        tenantId,
        created.id,
        99,
        "1000",
        "Duplicate account",
        java.math.BigDecimal("1.00"),
        java.math.BigDecimal("1.00")
      )
    }.isInstanceOf(DataAccessException::class.java)
  }

  @Test
  fun `invalid import rolls back without persisting rows or audit`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    val user = appUserRepository.create("import-user", "import@example.com", "Import User")
    val closingFolderId = insertClosingFolder(tenantId)

    assertThatThrownBy {
      balanceImportService.create(access(user.id, tenantId), closingFolderId, csvFile(invalidCsv()))
    }.isInstanceOf(BalanceImportBadRequestException::class.java)

    assertThat(countRows("balance_import")).isZero()
    assertThat(countRows("balance_import_line")).isZero()
    assertThat(countRows("audit_event")).isZero()
  }

  private fun tableExists(tableName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists(
        select 1
        from information_schema.tables
        where table_schema = 'public' and table_name = ?
      )
      """.trimIndent(),
      Boolean::class.java,
      tableName
    ) ?: false

  private fun columnExists(tableName: String, columnName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists(
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = ?
          and column_name = ?
      )
      """.trimIndent(),
      Boolean::class.java,
      tableName,
      columnName
    ) ?: false

  private fun countRows(tableName: String): Int =
    jdbcTemplate.queryForObject("select count(*) from $tableName", Int::class.java) ?: 0

  private fun insertTenant(
    tenantId: UUID,
    tenantSlug: String,
    tenantName: String
  ) {
    jdbcTemplate.update(
      """
      insert into tenant (id, slug, legal_name, status)
      values (?, ?, ?, 'ACTIVE')
      """.trimIndent(),
      tenantId,
      tenantSlug,
      tenantName
    )
  }

  private fun insertClosingFolder(tenantId: UUID): UUID {
    val closingFolderId = UUID.randomUUID()
    jdbcTemplate.update(
      """
      insert into closing_folder (
        id,
        tenant_id,
        name,
        period_start_on,
        period_end_on,
        status,
        archived_at,
        archived_by_user_id,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """.trimIndent(),
      closingFolderId,
      tenantId,
      "Closing FY24",
      LocalDate.parse("2024-01-01"),
      LocalDate.parse("2024-12-31"),
      "DRAFT",
      null,
      null,
      OffsetDateTime.parse("2025-01-01T00:00:00Z"),
      OffsetDateTime.parse("2025-01-01T00:00:00Z")
    )
    return closingFolderId
  }

  private fun access(userId: UUID, tenantId: UUID): TenantAccessContext =
    TenantAccessContext(
      actorUserId = userId,
      actorSubject = "import-user",
      tenantId = tenantId,
      effectiveRoles = setOf("MANAGER")
    )

  private fun csvFile(content: String): MockMultipartFile =
    MockMultipartFile("file", "balance.csv", "text/csv", content.toByteArray(StandardCharsets.UTF_8))

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
}
