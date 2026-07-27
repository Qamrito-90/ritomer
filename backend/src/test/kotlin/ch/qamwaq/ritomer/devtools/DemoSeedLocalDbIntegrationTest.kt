package ch.qamwaq.ritomer.devtools

import ch.qamwaq.ritomer.closing.application.ClosingFolderRepository
import ch.qamwaq.ritomer.identity.application.TenantMembershipRepository
import ch.qamwaq.ritomer.imports.application.BalanceImportRepository
import ch.qamwaq.ritomer.mapping.application.ManualMappingRepository
import ch.qamwaq.ritomer.mapping.application.ManualMappingTargetCatalog
import ch.qamwaq.ritomer.testsupport.DisposablePostgresTestDatabase
import ch.qamwaq.ritomer.testsupport.DisposablePostgresTestDatabaseGuardInitializer
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
import org.springframework.test.context.ContextConfiguration

@SpringBootTest(properties = ["ritomer.demo.seed.enabled=true"])
@ActiveProfiles("dbtest")
@ContextConfiguration(
  initializers = [
    DisposablePostgresTestDatabaseGuardInitializer::class
  ]
)
@Tag("db-integration")
@EnabledIfEnvironmentVariable(named = "RITOMER_DB_TESTS_ENABLED", matches = "(?i:true)")
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
    DisposablePostgresTestDatabase.truncateAllCurrentTables(
      jdbcTemplate.dataSource ?: error("DataSource is required for guarded database reset."),
      environment
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

  @Test
  fun `two actor pilot variant is deterministic exact role scoped and seeds no review artifacts`() {
    environment.propertySources.addFirst(
      MapPropertySource(
        VARIANT_PROPERTY_SOURCE_NAME,
        mapOf(DEMO_SEED_VARIANT_PROPERTY to DEMO_SEED_VARIANT_043B_TWO_ACTOR_PILOT)
      )
    )

    val databaseVersion = jdbcTemplate.queryForObject("select version()", String::class.java)
    assertThat(databaseVersion).contains("PostgreSQL")

    val firstRun = demoSeedLocalService.seed()
    val firstSnapshot = twoActorBusinessSnapshot()
    val firstAuditIds = seedAuditIds()

    assertThat(firstRun.changedRows).isGreaterThan(0)
    assertThat(firstRun.auditEventId).isNotNull()
    assertThat(firstRun.variantResults).hasSize(1)
    assertThat(firstRun.variantResults.single().variant).isEqualTo(DEMO_SEED_VARIANT_043B_TWO_ACTOR_PILOT)
    assertThat(firstRun.variantResults.single().datasetClassification)
      .isEqualTo(DEMO_SEED_DATASET_CLASSIFICATION_043B)
    assertThat(firstRun.variantResults.single().closingFolderId)
      .isEqualTo(DemoSeedLocalDataset.variant043bTwoActorPilotFolder.closingFolderId)
    assertThat(firstRun.variantResults.single().balanceImportId)
      .isEqualTo(DemoSeedLocalDataset.variant043bTwoActorPilotFolder.balanceImportId)
    assertThat(firstRun.variantResults.single().balanceImportLineCount)
      .isEqualTo(DemoSeedLocalDataset.variant043bTwoActorPilotFolder.balanceLines.size)
    assertThat(firstRun.variantResults.single().manualMappingCount)
      .isEqualTo(DemoSeedLocalDataset.variant043bTwoActorPilotFolder.manualMappings.size)

    assertDemoTenant(firstRun.tenantId)
    assertExactTwoActorIdentitiesAndMemberships()
    assertTwoActorFolderDatasets()
    assertTwoActorSeedCounts()
    assertNoPreseededWorkpaperDocumentExportOrDecision()
    assertTwoActorDatasetAudit(firstRun.auditEventId)

    val secondRun = demoSeedLocalService.seed()

    assertThat(secondRun.changedRows).isZero()
    assertThat(secondRun.auditEventId).isNull()
    assertThat(secondRun.variantResults).isEqualTo(firstRun.variantResults)
    assertThat(twoActorBusinessSnapshot()).isEqualTo(firstSnapshot)
    assertThat(seedAuditIds()).containsExactlyElementsOf(firstAuditIds)
    assertDemoTenant(secondRun.tenantId)
    assertExactTwoActorIdentitiesAndMemberships()
    assertTwoActorFolderDatasets()
    assertTwoActorSeedCounts()
    assertNoPreseededWorkpaperDocumentExportOrDecision()
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

  private fun assertExactTwoActorIdentitiesAndMemberships() {
    val accountant = jdbcTemplate.queryForMap(
      """
      select id, external_subject, email, display_name, status
      from app_user
      where id = ?
      """.trimIndent(),
      DemoSeedLocalDataset.userId
    )
    val reviewer = jdbcTemplate.queryForMap(
      """
      select id, external_subject, email, display_name, status
      from app_user
      where id = ?
      """.trimIndent(),
      DemoSeedLocalDataset.reviewerUserId
    )

    assertActorRow(
      accountant,
      DemoSeedLocalDataset.userId,
      DemoSeedLocalDataset.userExternalSubject,
      DemoSeedLocalDataset.userEmail,
      DemoSeedLocalDataset.userDisplayName
    )
    assertActorRow(
      reviewer,
      DemoSeedLocalDataset.reviewerUserId,
      DemoSeedLocalDataset.reviewerExternalSubject,
      DemoSeedLocalDataset.reviewerEmail,
      DemoSeedLocalDataset.reviewerDisplayName
    )
    assertThat(countRows("app_user")).isEqualTo(2)

    assertExactMembership(
      membershipId = DemoSeedLocalDataset.membershipId,
      userId = DemoSeedLocalDataset.userId,
      expectedRole = DemoSeedLocalDataset.membershipRole
    )
    assertExactMembership(
      membershipId = DemoSeedLocalDataset.reviewerMembershipId,
      userId = DemoSeedLocalDataset.reviewerUserId,
      expectedRole = DemoSeedLocalDataset.reviewerMembershipRole
    )
    assertThat(countRows("tenant_membership")).isEqualTo(2)
  }

  private fun assertActorRow(
    row: Map<String, Any>,
    expectedId: UUID,
    expectedSubject: String,
    expectedEmail: String,
    expectedDisplayName: String
  ) {
    assertThat(row["id"]).isEqualTo(expectedId)
    assertThat(row["external_subject"]).isEqualTo(expectedSubject)
    assertThat(row["email"]).isEqualTo(expectedEmail)
    assertThat(row["display_name"]).isEqualTo(expectedDisplayName)
    assertThat(row["status"]).isEqualTo("ACTIVE")
  }

  private fun assertExactMembership(membershipId: UUID, userId: UUID, expectedRole: String) {
    val membership = jdbcTemplate.queryForMap(
      """
      select id, tenant_id, user_id, role_code, status
      from tenant_membership
      where id = ?
      """.trimIndent(),
      membershipId
    )
    val allRoles = jdbcTemplate.queryForList(
      """
      select role_code
      from tenant_membership
      where tenant_id = ?
        and user_id = ?
      order by role_code asc
      """.trimIndent(),
      String::class.java,
      DemoSeedLocalDataset.tenantId,
      userId
    )
    val activeRoles = jdbcTemplate.queryForList(
      """
      select role_code
      from tenant_membership
      where tenant_id = ?
        and user_id = ?
        and status = 'ACTIVE'
      order by role_code asc
      """.trimIndent(),
      String::class.java,
      DemoSeedLocalDataset.tenantId,
      userId
    )

    assertThat(membership["id"]).isEqualTo(membershipId)
    assertThat(membership["tenant_id"]).isEqualTo(DemoSeedLocalDataset.tenantId)
    assertThat(membership["user_id"]).isEqualTo(userId)
    assertThat(membership["role_code"]).isEqualTo(expectedRole)
    assertThat(membership["status"]).isEqualTo("ACTIVE")
    assertThat(allRoles).containsExactly(expectedRole)
    assertThat(activeRoles).containsExactly(expectedRole)
  }

  private fun assertTwoActorFolderDatasets() {
    assertDemoFolderShape(
      tenantId = DemoSeedLocalDataset.tenantId,
      folder = DemoSeedLocalDataset.primaryFolder,
      expectedMappingAccounts = DemoSeedLocalDataset.primaryFolder.manualMappings.map { it.accountCode }
    )
    assertDemoFolderShape(
      tenantId = DemoSeedLocalDataset.tenantId,
      folder = DemoSeedLocalDataset.variant043bTwoActorPilotFolder,
      expectedMappingAccounts = DemoSeedLocalDataset.variant043bTwoActorPilotFolder.manualMappings.map { it.accountCode }
    )
    assertExactFolderDatasetRows(DemoSeedLocalDataset.variant043bTwoActorPilotFolder)
  }

  private fun assertExactFolderDatasetRows(folder: DemoSeedLocalFolderDataset) {
    val closingFolder = jdbcTemplate.queryForMap(
      """
      select tenant_id, name, period_start_on::text as period_start_on,
             period_end_on::text as period_end_on, external_ref, status,
             archived_at, archived_by_user_id
      from closing_folder
      where id = ?
      """.trimIndent(),
      folder.closingFolderId
    )
    val balanceImport = jdbcTemplate.queryForMap(
      """
      select id, tenant_id, closing_folder_id, version, source_file_name, imported_by_user_id,
             row_count, total_debit, total_credit
      from balance_import
      where id = ?
      """.trimIndent(),
      folder.balanceImportId
    )
    val lineRows = jdbcTemplate.queryForList(
      """
      select id, line_no, account_code, account_label, debit, credit
      from balance_import_line
      where tenant_id = ?
        and balance_import_id = ?
      order by line_no asc
      """.trimIndent(),
      DemoSeedLocalDataset.tenantId,
      folder.balanceImportId
    )
    val mappingRows = jdbcTemplate.queryForList(
      """
      select id, account_code, target_code, created_by_user_id, updated_by_user_id
      from manual_mapping
      where tenant_id = ?
        and closing_folder_id = ?
      order by account_code asc
      """.trimIndent(),
      DemoSeedLocalDataset.tenantId,
      folder.closingFolderId
    )

    assertThat(closingFolder["tenant_id"]).isEqualTo(DemoSeedLocalDataset.tenantId)
    assertThat(closingFolder["name"]).isEqualTo(folder.closingFolderName)
    assertThat(closingFolder["period_start_on"]).isEqualTo(folder.periodStartOn.toString())
    assertThat(closingFolder["period_end_on"]).isEqualTo(folder.periodEndOn.toString())
    assertThat(closingFolder["external_ref"]).isEqualTo(folder.closingFolderExternalRef)
    assertThat(closingFolder["status"]).isEqualTo("DRAFT")
    assertThat(closingFolder["archived_at"]).isNull()
    assertThat(closingFolder["archived_by_user_id"]).isNull()

    assertThat(balanceImport["id"]).isEqualTo(folder.balanceImportId)
    assertThat(balanceImport["tenant_id"]).isEqualTo(DemoSeedLocalDataset.tenantId)
    assertThat(balanceImport["closing_folder_id"]).isEqualTo(folder.closingFolderId)
    assertThat(balanceImport["version"]).isEqualTo(folder.balanceImportVersion)
    assertThat(balanceImport["source_file_name"]).isEqualTo(folder.sourceFileName)
    assertThat(balanceImport["imported_by_user_id"]).isEqualTo(DemoSeedLocalDataset.userId)
    assertThat(balanceImport["row_count"]).isEqualTo(folder.balanceLines.size)
    assertThat(balanceImport["total_debit"] as BigDecimal).isEqualByComparingTo(folder.totalDebit)
    assertThat(balanceImport["total_credit"] as BigDecimal).isEqualByComparingTo(folder.totalCredit)

    assertThat(lineRows).hasSize(folder.balanceLines.size)
    folder.balanceLines.zip(lineRows).forEach { (expected, actual) ->
      assertThat(actual["id"]).isEqualTo(expected.id)
      assertThat(actual["line_no"]).isEqualTo(expected.lineNo)
      assertThat(actual["account_code"]).isEqualTo(expected.accountCode)
      assertThat(actual["account_label"]).isEqualTo(expected.accountLabel)
      assertThat(actual["debit"] as BigDecimal).isEqualByComparingTo(expected.debit)
      assertThat(actual["credit"] as BigDecimal).isEqualByComparingTo(expected.credit)
    }

    assertThat(mappingRows).hasSize(folder.manualMappings.size)
    val expectedMappings = folder.manualMappings.associateBy { it.accountCode }
    mappingRows.forEach { actual ->
      val expected = expectedMappings.getValue(actual["account_code"] as String)
      assertThat(actual["id"]).isEqualTo(expected.id)
      assertThat(actual["target_code"]).isEqualTo(expected.targetCode)
      assertThat(actual["created_by_user_id"]).isEqualTo(DemoSeedLocalDataset.userId)
      assertThat(actual["updated_by_user_id"]).isEqualTo(DemoSeedLocalDataset.userId)
    }
  }

  private fun assertTwoActorSeedCounts() {
    assertThat(countRows("tenant")).isEqualTo(1)
    assertThat(countRows("app_user")).isEqualTo(2)
    assertThat(countRows("tenant_membership")).isEqualTo(2)
    assertThat(countRows("closing_folder")).isEqualTo(2)
    assertThat(countRows("balance_import")).isEqualTo(2)
    assertThat(countRows("balance_import_line")).isEqualTo(12)
    assertThat(countRows("manual_mapping")).isEqualTo(12)
  }

  private fun assertNoPreseededWorkpaperDocumentExportOrDecision() {
    assertThat(countRows("workpaper")).isZero()
    assertThat(countRows("workpaper_evidence")).isZero()
    assertThat(countRows("document")).isZero()
    assertThat(countRows("document_verification")).isZero()
    assertThat(countRows("export_pack")).isZero()
    assertThat(countRows("mapping_suggestion_decision_request")).isZero()
    val reviewAuditCount = jdbcTemplate.queryForObject(
      """
      select count(*)
      from audit_event
      where action like 'WORKPAPER.%'
         or action like 'DOCUMENT.%'
         or action like 'EXPORT_PACK.%'
      """.trimIndent(),
      Int::class.java
    )
    assertThat(reviewAuditCount).isZero()
  }

  private fun assertTwoActorDatasetAudit(expectedAuditEventId: UUID?) {
    val audit = jdbcTemplate.queryForMap(
      """
      select id,
             actor_user_id,
             actor_subject,
             actor_roles::text as actor_roles,
             metadata ->> 'dataset' as dataset,
             metadata ->> 'seedVariant' as seed_variant,
             metadata ->> 'variantClosingFolderId' as variant_closing_folder_id,
             metadata ->> 'variantBalanceImportId' as variant_balance_import_id
      from audit_event
      where tenant_id = ?
        and action = 'DEMO_SEED.APPLIED'
      """.trimIndent(),
      DemoSeedLocalDataset.tenantId
    )

    assertThat(audit["id"]).isEqualTo(expectedAuditEventId)
    assertThat(audit["actor_user_id"]).isEqualTo(DemoSeedLocalDataset.userId)
    assertThat(audit["actor_subject"]).isEqualTo(DemoSeedLocalDataset.userExternalSubject)
    assertThat(audit["actor_roles"]).isEqualTo("[\"ACCOUNTANT\"]")
    assertThat(audit["dataset"]).isEqualTo(DEMO_SEED_DATASET_CLASSIFICATION_043B)
    assertThat(audit["seed_variant"]).isEqualTo(DEMO_SEED_VARIANT_043B_TWO_ACTOR_PILOT)
    assertThat(audit["variant_closing_folder_id"])
      .isEqualTo(DemoSeedLocalDataset.variant043bTwoActorPilotFolder.closingFolderId.toString())
    assertThat(audit["variant_balance_import_id"])
      .isEqualTo(DemoSeedLocalDataset.variant043bTwoActorPilotFolder.balanceImportId.toString())
  }

  private fun seedAuditIds(): List<UUID> =
    jdbcTemplate.queryForList(
      """
      select id
      from audit_event
      where action = 'DEMO_SEED.APPLIED'
      order by id asc
      """.trimIndent(),
      UUID::class.java
    )

  private fun twoActorBusinessSnapshot(): TwoActorBusinessSnapshot =
    TwoActorBusinessSnapshot(
      tenants = stableRows(
        """
        select id, slug, legal_name, status
        from tenant
        order by id asc
        """.trimIndent()
      ),
      users = stableRows(
        """
        select id, external_subject, email, display_name, status
        from app_user
        order by id asc
        """.trimIndent()
      ),
      memberships = stableRows(
        """
        select id, tenant_id, user_id, role_code, status
        from tenant_membership
        order by id asc
        """.trimIndent()
      ),
      closingFolders = stableRows(
        """
        select id, tenant_id, name, period_start_on, period_end_on, external_ref, status,
               archived_at, archived_by_user_id
        from closing_folder
        order by id asc
        """.trimIndent()
      ),
      balanceImports = stableRows(
        """
        select id, tenant_id, closing_folder_id, version, source_file_name, imported_by_user_id,
               row_count, total_debit, total_credit
        from balance_import
        order by id asc
        """.trimIndent()
      ),
      balanceImportLines = stableRows(
        """
        select id, tenant_id, balance_import_id, line_no, account_code, account_label, debit, credit
        from balance_import_line
        order by id asc
        """.trimIndent()
      ),
      manualMappings = stableRows(
        """
        select id, tenant_id, closing_folder_id, account_code, target_code,
               created_by_user_id, updated_by_user_id
        from manual_mapping
        order by id asc
        """.trimIndent()
      )
    )

  private fun stableRows(sql: String): List<Map<String, Any>> =
    jdbcTemplate.queryForList(sql).map { it.toMap() }

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

  private data class TwoActorBusinessSnapshot(
    val tenants: List<Map<String, Any>>,
    val users: List<Map<String, Any>>,
    val memberships: List<Map<String, Any>>,
    val closingFolders: List<Map<String, Any>>,
    val balanceImports: List<Map<String, Any>>,
    val balanceImportLines: List<Map<String, Any>>,
    val manualMappings: List<Map<String, Any>>
  )
}
