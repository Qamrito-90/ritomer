package ch.qamwaq.ritomer.devtools

import ch.qamwaq.ritomer.closing.application.ClosingFolderRepository
import ch.qamwaq.ritomer.identity.application.TenantMembershipRepository
import ch.qamwaq.ritomer.imports.application.BalanceImportRepository
import ch.qamwaq.ritomer.mapping.application.ManualMappingRepository
import ch.qamwaq.ritomer.mapping.application.ManualMappingTargetCatalog
import java.math.BigDecimal
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.env.ConfigurableEnvironment
import org.springframework.core.env.MapPropertySource
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles

@SpringBootTest(properties = ["ritomer.demo.seed.enabled=true"])
@ActiveProfiles("dbtest")
@Tag("db-integration")
@EnabledIfEnvironmentVariable(named = "RITOMER_DB_TESTS_ENABLED", matches = "true")
class DemoSeedLocalDbIntegrationTest {
  @Autowired
  private lateinit var jdbcTemplate: JdbcTemplate

  @Autowired
  private lateinit var demoSeedLocalService: DemoSeedLocalService

  @Autowired
  private lateinit var tenantMembershipRepository: TenantMembershipRepository

  @Autowired
  private lateinit var closingFolderRepository: ClosingFolderRepository

  @Autowired
  private lateinit var balanceImportRepository: BalanceImportRepository

  @Autowired
  private lateinit var manualMappingRepository: ManualMappingRepository

  @Autowired
  private lateinit var manualMappingTargetCatalog: ManualMappingTargetCatalog

  @Autowired
  private lateinit var environment: ConfigurableEnvironment

  @BeforeEach
  fun resetDatabaseState() {
    environment.propertySources.remove(VARIANT_PROPERTY_SOURCE_NAME)
    jdbcTemplate.execute(
      """
      truncate table
        audit_event,
        mapping_suggestion_decision_request,
        export_pack,
        document_verification,
        document,
        workpaper_evidence,
        workpaper,
        manual_mapping,
        balance_import_line,
        balance_import,
        closing_folder,
        tenant_membership,
        app_user,
        tenant
      cascade
      """.trimIndent()
    )
  }

  @Test
  fun `demo seed is idempotent tenant scoped and creates coherent balance and mappings`() {
    val databaseVersion = jdbcTemplate.queryForObject("select version()", String::class.java)
    assertThat(databaseVersion).contains("PostgreSQL")

    val firstRun = demoSeedLocalService.seed()
    val secondRun = demoSeedLocalService.seed()

    assertThat(firstRun.changedRows).isGreaterThan(0)
    assertThat(firstRun.auditEventId).isNotNull()
    assertThat(secondRun.changedRows).isZero()
    assertThat(secondRun.auditEventId).isNull()

    assertDemoTenant(firstRun.tenantId)
    assertDemoUser(firstRun.userId)
    assertDemoMembership(firstRun.tenantId, firstRun.userId)
    assertDemoClosingFolder(firstRun.tenantId)
    assertDemoBalanceImport(firstRun.tenantId, firstRun.userId, firstRun.balanceImportId)
    assertDemoManualMappings(firstRun.tenantId, firstRun.balanceImportId)
    assertWrongTenantCannotResolveDemoRows()
    assertDemoSeedAuditIsNotDuplicated(firstRun.tenantId)
  }

  @Test
  fun `demo seed mixed v2 variant is opt in idempotent and keeps primary complete`() {
    environment.propertySources.addFirst(
      MapPropertySource(
        VARIANT_PROPERTY_SOURCE_NAME,
        mapOf(DEMO_SEED_VARIANT_PROPERTY to DEMO_SEED_VARIANT_042A2A5D_MIXED_V2)
      )
    )

    val firstRun = demoSeedLocalService.seed()
    val secondRun = demoSeedLocalService.seed()
    val variant = DemoSeedLocalVariant.MIXED_V2_042A2A5D.folderDataset

    assertThat(firstRun.changedRows).isGreaterThan(0)
    assertThat(firstRun.variantResults).hasSize(1)
    assertThat(firstRun.variantResults.single().closingFolderId).isEqualTo(variant.closingFolderId)
    assertThat(firstRun.variantResults.single().balanceImportLineCount).isEqualTo(variant.balanceLines.size)
    assertThat(firstRun.variantResults.single().manualMappingCount).isEqualTo(variant.manualMappings.size)
    assertThat(secondRun.changedRows).isZero()
    assertThat(secondRun.auditEventId).isNull()

    assertDemoFolderShape(
      tenantId = firstRun.tenantId,
      folder = DemoSeedLocalDataset.primaryFolder,
      expectedMappingAccounts = DemoSeedLocalDataset.manualMappings.map { it.accountCode }
    )
    assertDemoFolderShape(
      tenantId = firstRun.tenantId,
      folder = variant,
      expectedMappingAccounts = listOf("1000", "1100", "2000", "2800")
    )
    assertThat(countRows("closing_folder")).isEqualTo(2)
    assertThat(countRows("balance_import")).isEqualTo(2)
    assertThat(countRows("balance_import_line")).isEqualTo(12)
    assertThat(countRows("manual_mapping")).isEqualTo(10)
    assertDemoSeedAuditIsNotDuplicated(firstRun.tenantId)
  }

  private fun assertDemoTenant(tenantId: UUID) {
    val tenant = jdbcTemplate.queryForMap(
      """
      select slug, legal_name, status
      from tenant
      where id = ?
      """.trimIndent(),
      tenantId
    )

    assertThat(tenant["slug"]).isEqualTo(DemoSeedLocalDataset.tenantSlug)
    assertThat(tenant["legal_name"]).isEqualTo(DemoSeedLocalDataset.tenantLegalName)
    assertThat(tenant["status"]).isEqualTo("ACTIVE")
    assertThat(countRows("tenant")).isEqualTo(1)
  }

  private fun assertDemoUser(userId: UUID) {
    val user = jdbcTemplate.queryForMap(
      """
      select external_subject, email, display_name, status
      from app_user
      where id = ?
      """.trimIndent(),
      userId
    )

    assertThat(user["external_subject"]).isEqualTo(DemoSeedLocalDataset.userExternalSubject)
    assertThat(user["email"]).isEqualTo(DemoSeedLocalDataset.userEmail)
    assertThat(user["display_name"]).isEqualTo(DemoSeedLocalDataset.userDisplayName)
    assertThat(user["status"]).isEqualTo("ACTIVE")
    assertThat(countRows("app_user")).isEqualTo(1)
  }

  private fun assertDemoMembership(
    tenantId: UUID,
    userId: UUID
  ) {
    val memberships = tenantMembershipRepository.findActiveMembershipGrants(userId)

    assertThat(memberships).hasSize(1)
    assertThat(memberships.single().tenantId).isEqualTo(tenantId)
    assertThat(memberships.single().tenantSlug).isEqualTo(DemoSeedLocalDataset.tenantSlug)
    assertThat(memberships.single().role.name).isEqualTo(DemoSeedLocalDataset.membershipRole)
    assertThat(countRows("tenant_membership")).isEqualTo(1)
  }

  private fun assertDemoClosingFolder(tenantId: UUID) {
    val folder = jdbcTemplate.queryForMap(
      """
      select tenant_id, name, status, archived_at, archived_by_user_id
      from closing_folder
      where id = ?
      """.trimIndent(),
      DemoSeedLocalDataset.closingFolderId
    )

    assertThat(folder["tenant_id"]).isEqualTo(tenantId)
    assertThat(folder["name"]).isEqualTo(DemoSeedLocalDataset.closingFolderName)
    assertThat(folder["status"]).isEqualTo("DRAFT")
    assertThat(folder["archived_at"]).isNull()
    assertThat(folder["archived_by_user_id"]).isNull()
    assertThat(countRows("closing_folder")).isEqualTo(1)
  }

  private fun assertDemoBalanceImport(
    tenantId: UUID,
    userId: UUID,
    balanceImportId: UUID
  ) {
    val balanceImport = jdbcTemplate.queryForMap(
      """
      select tenant_id,
             closing_folder_id,
             version,
             source_file_name,
             imported_by_user_id,
             row_count,
             total_debit,
             total_credit
      from balance_import
      where id = ?
      """.trimIndent(),
      balanceImportId
    )
    val totalDebit = jdbcTemplate.queryForObject(
      """
      select coalesce(sum(debit), 0)
      from balance_import_line
      where tenant_id = ?
        and balance_import_id = ?
      """.trimIndent(),
      BigDecimal::class.java,
      tenantId,
      balanceImportId
    )
    val totalCredit = jdbcTemplate.queryForObject(
      """
      select coalesce(sum(credit), 0)
      from balance_import_line
      where tenant_id = ?
        and balance_import_id = ?
      """.trimIndent(),
      BigDecimal::class.java,
      tenantId,
      balanceImportId
    )

    assertThat(balanceImport["tenant_id"]).isEqualTo(tenantId)
    assertThat(balanceImport["closing_folder_id"]).isEqualTo(DemoSeedLocalDataset.closingFolderId)
    assertThat(balanceImport["version"]).isEqualTo(DemoSeedLocalDataset.balanceImportVersion)
    assertThat(balanceImport["source_file_name"]).isEqualTo(DemoSeedLocalDataset.sourceFileName)
    assertThat(balanceImport["imported_by_user_id"]).isEqualTo(userId)
    assertThat(balanceImport["row_count"]).isEqualTo(DemoSeedLocalDataset.balanceLines.size)
    assertThat(balanceImport["total_debit"] as BigDecimal).isEqualByComparingTo(DemoSeedLocalDataset.totalDebit)
    assertThat(balanceImport["total_credit"] as BigDecimal).isEqualByComparingTo(DemoSeedLocalDataset.totalCredit)
    assertThat(totalDebit).isEqualByComparingTo(totalCredit)
    assertThat(totalDebit).isEqualByComparingTo(DemoSeedLocalDataset.totalDebit)
    assertThat(countRows("balance_import")).isEqualTo(1)
    assertThat(countRows("balance_import_line")).isEqualTo(DemoSeedLocalDataset.balanceLines.size)
  }

  private fun assertDemoManualMappings(
    tenantId: UUID,
    balanceImportId: UUID
  ) {
    val lineAccountCodes = jdbcTemplate.queryForList(
      """
      select account_code
      from balance_import_line
      where tenant_id = ?
        and balance_import_id = ?
      order by line_no asc
      """.trimIndent(),
      String::class.java,
      tenantId,
      balanceImportId
    ).toSet()
    val mappings = jdbcTemplate.queryForList(
      """
      select account_code, target_code
      from manual_mapping
      where tenant_id = ?
        and closing_folder_id = ?
      order by account_code asc
      """.trimIndent(),
      tenantId,
      DemoSeedLocalDataset.closingFolderId
    )

    assertThat(mappings).hasSize(DemoSeedLocalDataset.manualMappings.size)
    assertThat(mappings.map { it["account_code"] }.toSet()).isSubsetOf(lineAccountCodes)
    mappings.forEach { mapping ->
      val targetCode = mapping["target_code"] as String
      assertThat(manualMappingTargetCatalog.findByCode(targetCode)?.selectable).isTrue()
    }
    assertThat(countRows("manual_mapping")).isEqualTo(DemoSeedLocalDataset.manualMappings.size)
  }

  private fun assertDemoFolderShape(
    tenantId: UUID,
    folder: DemoSeedLocalFolderDataset,
    expectedMappingAccounts: List<String>
  ) {
    val balanceImport = jdbcTemplate.queryForMap(
      """
      select id, version, source_file_name, row_count
      from balance_import
      where tenant_id = ?
        and closing_folder_id = ?
      """.trimIndent(),
      tenantId,
      folder.closingFolderId
    )
    val balanceImportId = balanceImport["id"] as UUID
    val lineAccountCodes = jdbcTemplate.queryForList(
      """
      select account_code
      from balance_import_line
      where tenant_id = ?
        and balance_import_id = ?
      order by line_no asc
      """.trimIndent(),
      String::class.java,
      tenantId,
      balanceImportId
    )
    val mappingAccountCodes = jdbcTemplate.queryForList(
      """
      select account_code
      from manual_mapping
      where tenant_id = ?
        and closing_folder_id = ?
      order by account_code asc
      """.trimIndent(),
      String::class.java,
      tenantId,
      folder.closingFolderId
    )

    assertThat(balanceImport["version"]).isEqualTo(folder.balanceImportVersion)
    assertThat(balanceImport["source_file_name"]).isEqualTo(folder.sourceFileName)
    assertThat(balanceImport["row_count"]).isEqualTo(folder.balanceLines.size)
    assertThat(lineAccountCodes).containsExactlyElementsOf(folder.balanceLines.map { it.accountCode })
    assertThat(mappingAccountCodes).containsExactlyElementsOf(expectedMappingAccounts)
  }

  private fun assertWrongTenantCannotResolveDemoRows() {
    val wrongTenantId = UUID.fromString("036a0000-0000-4000-8000-000000009999")
    jdbcTemplate.update(
      """
      insert into tenant (id, slug, legal_name, status)
      values (?, ?, ?, 'ACTIVE')
      """.trimIndent(),
      wrongTenantId,
      "ritomer-demo-036a-wrong-tenant",
      "Wrong Demo Tenant"
    )

    assertThat(closingFolderRepository.findByIdAndTenantId(DemoSeedLocalDataset.closingFolderId, wrongTenantId)).isNull()
    assertThat(balanceImportRepository.findVersions(wrongTenantId, DemoSeedLocalDataset.closingFolderId)).isEmpty()
    assertThat(manualMappingRepository.findByClosingFolder(wrongTenantId, DemoSeedLocalDataset.closingFolderId)).isEmpty()
  }

  private fun assertDemoSeedAuditIsNotDuplicated(tenantId: UUID) {
    val auditCount = jdbcTemplate.queryForObject(
      """
      select count(*)
      from audit_event
      where tenant_id = ?
        and action = 'DEMO_SEED.APPLIED'
      """.trimIndent(),
      Int::class.java,
      tenantId
    )

    assertThat(auditCount).isEqualTo(1)
  }

  private fun countRows(tableName: String): Int =
    jdbcTemplate.queryForObject("select count(*) from $tableName", Int::class.java) ?: 0

  companion object {
    private const val VARIANT_PROPERTY_SOURCE_NAME = "demoSeedVariantTest"
  }
}
