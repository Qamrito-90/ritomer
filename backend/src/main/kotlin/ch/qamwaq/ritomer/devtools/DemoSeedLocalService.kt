package ch.qamwaq.ritomer.devtools

import ch.qamwaq.ritomer.shared.application.AuditCorrelationContext
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import java.math.BigDecimal
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Profile
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

internal const val DEMO_SEED_DATASET_CLASSIFICATION_043B = "HARNESS_ONLY_AUTH_RBAC_DATASET"

internal data class DemoSeedLocalResult(
  val tenantId: UUID,
  val userId: UUID,
  val closingFolderId: UUID,
  val balanceImportId: UUID,
  val changedRows: Int,
  val balanceImportLineCount: Int,
  val manualMappingCount: Int,
  val auditEventId: UUID?,
  val variantResults: List<DemoSeedLocalVariantResult> = emptyList()
)

internal data class DemoSeedLocalVariantResult(
  val variant: String,
  val closingFolderId: UUID,
  val balanceImportId: UUID,
  val balanceImportLineCount: Int,
  val manualMappingCount: Int,
  val datasetClassification: String? = null
)

@Service
@Profile("local", "test", "dbtest")
@ConditionalOnProperty(name = [DEMO_SEED_ENABLED_PROPERTY], havingValue = "true")
internal class DemoSeedLocalService(
  private val jdbcClient: JdbcClient,
  private val auditTrail: AuditTrail,
  private val environment: Environment
) {
  @Transactional
  fun seed(): DemoSeedLocalResult {
    val requestedVariant = DemoSeedLocalVariant.fromPropertyValue(environment.getProperty(DEMO_SEED_VARIANT_PROPERTY))
    val primaryFolder = DemoSeedLocalDataset.primaryFolder
    val now = OffsetDateTime.now(ZoneOffset.UTC)
    var changedRows = 0

    val tenantId = upsertTenant(now).also { changedRows += it.changedRows }.id
    val accountant = DemoSeedLocalDataset.accountantActor
    val userId = upsertAppUser(accountant, now).also { changedRows += it.changedRows }.id
    changedRows += upsertTenantMembership(tenantId, userId, accountant, now)
    changedRows += upsertClosingFolder(tenantId, primaryFolder, now)
    changedRows += upsertBalanceImport(tenantId, userId, primaryFolder, now)
    val balanceImportId = findDemoBalanceImportId(tenantId, primaryFolder)
    primaryFolder.balanceLines.forEach { line ->
      changedRows += upsertBalanceImportLine(tenantId, balanceImportId, line)
    }
    primaryFolder.manualMappings.forEach { mapping ->
      changedRows += upsertManualMapping(tenantId, userId, primaryFolder, mapping, now)
    }

    val variantResults = mutableListOf<DemoSeedLocalVariantResult>()
    if (requestedVariant != null) {
      if (requestedVariant.enforceExactActiveRoles) {
        changedRows += deactivateUnexpectedActiveRoles(tenantId, userId, accountant, now)
      }
      requestedVariant.additionalActors.forEach { actor ->
        val actorUserId = upsertAppUser(actor, now).also { changedRows += it.changedRows }.id
        changedRows += upsertTenantMembership(tenantId, actorUserId, actor, now)
        if (requestedVariant.enforceExactActiveRoles) {
          changedRows += deactivateUnexpectedActiveRoles(tenantId, actorUserId, actor, now)
        }
      }
      val variantFolder = requestedVariant.folderDataset
      changedRows += upsertClosingFolder(tenantId, variantFolder, now)
      changedRows += upsertBalanceImport(tenantId, userId, variantFolder, now)
      val variantBalanceImportId = findDemoBalanceImportId(tenantId, variantFolder)
      variantFolder.balanceLines.forEach { line ->
        changedRows += upsertBalanceImportLine(tenantId, variantBalanceImportId, line)
      }
      variantFolder.manualMappings.forEach { mapping ->
        changedRows += upsertManualMapping(tenantId, userId, variantFolder, mapping, now)
      }
      variantResults += DemoSeedLocalVariantResult(
        variant = requestedVariant.propertyValue,
        closingFolderId = variantFolder.closingFolderId,
        balanceImportId = variantBalanceImportId,
        balanceImportLineCount = variantFolder.balanceLines.size,
        manualMappingCount = variantFolder.manualMappings.size,
        datasetClassification = requestedVariant.datasetClassification
      )
    }

    val auditEventId = if (changedRows > 0) {
      appendSeedAudit(tenantId, userId, balanceImportId, changedRows, variantResults)
    } else {
      null
    }

    return DemoSeedLocalResult(
      tenantId = tenantId,
      userId = userId,
      closingFolderId = primaryFolder.closingFolderId,
      balanceImportId = balanceImportId,
      changedRows = changedRows,
      balanceImportLineCount = primaryFolder.balanceLines.size,
      manualMappingCount = primaryFolder.manualMappings.size,
      auditEventId = auditEventId,
      variantResults = variantResults
    )
  }

  private fun upsertTenant(now: OffsetDateTime): UpsertedId {
    val existingId = findUuidByNaturalKey(
      """
      select id
      from tenant
      where slug = :slug
      """.trimIndent(),
      "slug" to DemoSeedLocalDataset.tenantSlug
    )
    if (existingId == null) {
      val insertedRows = jdbcClient.sql(
        """
        insert into tenant (id, slug, legal_name, status, created_at, updated_at)
        values (:id, :slug, :legalName, 'ACTIVE', :now, :now)
        """.trimIndent()
      )
        .param("id", DemoSeedLocalDataset.tenantId)
        .param("slug", DemoSeedLocalDataset.tenantSlug)
        .param("legalName", DemoSeedLocalDataset.tenantLegalName)
        .param("now", now)
        .update()
      return UpsertedId(DemoSeedLocalDataset.tenantId, insertedRows)
    }

    val updatedRows = jdbcClient.sql(
      """
      update tenant
      set legal_name = :legalName,
          status = 'ACTIVE',
          updated_at = :now
      where id = :id
        and (
          legal_name is distinct from :legalName
          or status is distinct from 'ACTIVE'
        )
      """.trimIndent()
    )
      .param("id", existingId)
      .param("legalName", DemoSeedLocalDataset.tenantLegalName)
      .param("now", now)
      .update()
    return UpsertedId(existingId, updatedRows)
  }

  private fun upsertAppUser(actor: DemoSeedLocalActorDataset, now: OffsetDateTime): UpsertedId {
    val existingId = findUuidByNaturalKey(
      """
      select id
      from app_user
      where external_subject = :externalSubject
      """.trimIndent(),
      "externalSubject" to actor.externalSubject
    )
    if (existingId == null) {
      val insertedRows = jdbcClient.sql(
        """
        insert into app_user (id, external_subject, email, display_name, status, created_at, updated_at)
        values (:id, :externalSubject, :email, :displayName, 'ACTIVE', :now, :now)
        """.trimIndent()
      )
        .param("id", actor.userId)
        .param("externalSubject", actor.externalSubject)
        .param("email", actor.email)
        .param("displayName", actor.displayName)
        .param("now", now)
        .update()
      return UpsertedId(actor.userId, insertedRows)
    }

    val updatedRows = jdbcClient.sql(
      """
      update app_user
      set email = :email,
          display_name = :displayName,
          status = 'ACTIVE',
          updated_at = :now
      where id = :id
        and (
          email is distinct from :email
          or display_name is distinct from :displayName
          or status is distinct from 'ACTIVE'
        )
      """.trimIndent()
    )
      .param("id", existingId)
      .param("email", actor.email)
      .param("displayName", actor.displayName)
      .param("now", now)
      .update()
    return UpsertedId(existingId, updatedRows)
  }

  private fun upsertTenantMembership(
    tenantId: UUID,
    userId: UUID,
    actor: DemoSeedLocalActorDataset,
    now: OffsetDateTime
  ): Int =
    jdbcClient.sql(
      """
      insert into tenant_membership (id, tenant_id, user_id, role_code, status, created_at, updated_at)
      values (:id, :tenantId, :userId, :roleCode, 'ACTIVE', :now, :now)
      on conflict (tenant_id, user_id, role_code) do update
      set status = 'ACTIVE',
          updated_at = excluded.updated_at
      where tenant_membership.status is distinct from 'ACTIVE'
      """.trimIndent()
    )
      .param("id", actor.membershipId)
      .param("tenantId", tenantId)
      .param("userId", userId)
      .param("roleCode", actor.membershipRole)
      .param("now", now)
      .update()

  private fun deactivateUnexpectedActiveRoles(
    tenantId: UUID,
    userId: UUID,
    actor: DemoSeedLocalActorDataset,
    now: OffsetDateTime
  ): Int =
    jdbcClient.sql(
      """
      update tenant_membership
      set status = 'INACTIVE',
          updated_at = :now
      where tenant_id = :tenantId
        and user_id = :userId
        and role_code is distinct from :expectedRole
        and status is distinct from 'INACTIVE'
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("userId", userId)
      .param("expectedRole", actor.membershipRole)
      .param("now", now)
      .update()

  private fun upsertClosingFolder(
    tenantId: UUID,
    folder: DemoSeedLocalFolderDataset,
    now: OffsetDateTime
  ): Int =
    jdbcClient.sql(
      """
      insert into closing_folder (
        id,
        tenant_id,
        name,
        period_start_on,
        period_end_on,
        external_ref,
        status,
        archived_at,
        archived_by_user_id,
        created_at,
        updated_at
      ) values (
        :id,
        :tenantId,
        :name,
        :periodStartOn,
        :periodEndOn,
        :externalRef,
        'DRAFT',
        null,
        null,
        :now,
        :now
      )
      on conflict (id) do update
      set tenant_id = excluded.tenant_id,
          name = excluded.name,
          period_start_on = excluded.period_start_on,
          period_end_on = excluded.period_end_on,
          external_ref = excluded.external_ref,
          status = 'DRAFT',
          archived_at = null,
          archived_by_user_id = null,
          updated_at = excluded.updated_at
      where closing_folder.tenant_id is distinct from excluded.tenant_id
        or closing_folder.name is distinct from excluded.name
        or closing_folder.period_start_on is distinct from excluded.period_start_on
        or closing_folder.period_end_on is distinct from excluded.period_end_on
        or closing_folder.external_ref is distinct from excluded.external_ref
        or closing_folder.status is distinct from 'DRAFT'
        or closing_folder.archived_at is not null
        or closing_folder.archived_by_user_id is not null
      """.trimIndent()
    )
      .param("id", folder.closingFolderId)
      .param("tenantId", tenantId)
      .param("name", folder.closingFolderName)
      .param("periodStartOn", folder.periodStartOn)
      .param("periodEndOn", folder.periodEndOn)
      .param("externalRef", folder.closingFolderExternalRef)
      .param("now", now)
      .update()

  private fun upsertBalanceImport(
    tenantId: UUID,
    userId: UUID,
    folder: DemoSeedLocalFolderDataset,
    now: OffsetDateTime
  ): Int =
    jdbcClient.sql(
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
      ) values (
        :id,
        :tenantId,
        :closingFolderId,
        :version,
        :sourceFileName,
        :now,
        :userId,
        :rowCount,
        :totalDebit,
        :totalCredit
      )
      on conflict (tenant_id, closing_folder_id, version) do update
      set source_file_name = excluded.source_file_name,
          imported_at = excluded.imported_at,
          imported_by_user_id = excluded.imported_by_user_id,
          row_count = excluded.row_count,
          total_debit = excluded.total_debit,
          total_credit = excluded.total_credit
      where balance_import.source_file_name is distinct from excluded.source_file_name
        or balance_import.imported_by_user_id is distinct from excluded.imported_by_user_id
        or balance_import.row_count is distinct from excluded.row_count
        or balance_import.total_debit is distinct from excluded.total_debit
        or balance_import.total_credit is distinct from excluded.total_credit
      """.trimIndent()
    )
      .param("id", folder.balanceImportId)
      .param("tenantId", tenantId)
      .param("closingFolderId", folder.closingFolderId)
      .param("version", folder.balanceImportVersion)
      .param("sourceFileName", folder.sourceFileName)
      .param("now", now)
      .param("userId", userId)
      .param("rowCount", folder.balanceLines.size)
      .param("totalDebit", folder.totalDebit)
      .param("totalCredit", folder.totalCredit)
      .update()

  private fun upsertBalanceImportLine(
    tenantId: UUID,
    balanceImportId: UUID,
    line: DemoBalanceLine
  ): Int =
    jdbcClient.sql(
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
      ) values (
        :id,
        :tenantId,
        :balanceImportId,
        :lineNo,
        :accountCode,
        :accountLabel,
        :debit,
        :credit
      )
      on conflict (tenant_id, balance_import_id, account_code) do update
      set line_no = excluded.line_no,
          account_label = excluded.account_label,
          debit = excluded.debit,
          credit = excluded.credit
      where balance_import_line.line_no is distinct from excluded.line_no
        or balance_import_line.account_label is distinct from excluded.account_label
        or balance_import_line.debit is distinct from excluded.debit
        or balance_import_line.credit is distinct from excluded.credit
      """.trimIndent()
    )
      .param("id", line.id)
      .param("tenantId", tenantId)
      .param("balanceImportId", balanceImportId)
      .param("lineNo", line.lineNo)
      .param("accountCode", line.accountCode)
      .param("accountLabel", line.accountLabel)
      .param("debit", line.debit)
      .param("credit", line.credit)
      .update()

  private fun upsertManualMapping(
    tenantId: UUID,
    userId: UUID,
    folder: DemoSeedLocalFolderDataset,
    mapping: DemoManualMapping,
    now: OffsetDateTime
  ): Int =
    jdbcClient.sql(
      """
      insert into manual_mapping (
        id,
        tenant_id,
        closing_folder_id,
        account_code,
        target_code,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      ) values (
        :id,
        :tenantId,
        :closingFolderId,
        :accountCode,
        :targetCode,
        :now,
        :now,
        :userId,
        :userId
      )
      on conflict (tenant_id, closing_folder_id, account_code) do update
      set target_code = excluded.target_code,
          updated_at = excluded.updated_at,
          updated_by_user_id = excluded.updated_by_user_id
      where manual_mapping.target_code is distinct from excluded.target_code
        or manual_mapping.updated_by_user_id is distinct from excluded.updated_by_user_id
      """.trimIndent()
    )
      .param("id", mapping.id)
      .param("tenantId", tenantId)
      .param("closingFolderId", folder.closingFolderId)
      .param("accountCode", mapping.accountCode)
      .param("targetCode", mapping.targetCode)
      .param("now", now)
      .param("userId", userId)
      .update()

  private fun findDemoBalanceImportId(
    tenantId: UUID,
    folder: DemoSeedLocalFolderDataset
  ): UUID =
    jdbcClient.sql(
      """
      select id
      from balance_import
      where tenant_id = :tenantId
        and closing_folder_id = :closingFolderId
        and version = :version
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("closingFolderId", folder.closingFolderId)
      .param("version", folder.balanceImportVersion)
      .query(UUID::class.java)
      .single()

  private fun findUuidByNaturalKey(
    sql: String,
    parameter: Pair<String, Any>
  ): UUID? =
    jdbcClient.sql(sql)
      .param(parameter.first, parameter.second)
      .query(UUID::class.java)
      .optional()
      .orElse(null)

  private fun appendSeedAudit(
    tenantId: UUID,
    userId: UUID,
    balanceImportId: UUID,
    changedRows: Int,
    variantResults: List<DemoSeedLocalVariantResult>
  ): UUID =
    auditTrail.append(
      AppendAuditEventCommand(
        tenantId = tenantId,
        actorUserId = userId,
        actorSubject = DemoSeedLocalDataset.userExternalSubject,
        actorRoles = setOf(DemoSeedLocalDataset.membershipRole),
        correlation = AuditCorrelationContext(
          requestId = "demo-seed-local-${OffsetDateTime.now(ZoneOffset.UTC).toEpochSecond()}",
          userAgent = "demoSeedLocal"
        ),
        action = "DEMO_SEED.APPLIED",
        resourceType = "DEMO_SEED",
        resourceId = DemoSeedLocalDataset.closingFolderId.toString(),
        metadata = mapOf(
          "dataset" to "036a-local-demo-synthetic",
          "reason" to "local integrated demo seed",
          "closingFolderId" to DemoSeedLocalDataset.closingFolderId.toString(),
          "balanceImportId" to balanceImportId.toString(),
          "changedRows" to changedRows,
          "balanceImportLineCount" to DemoSeedLocalDataset.balanceLines.size,
          "manualMappingCount" to DemoSeedLocalDataset.manualMappings.size
        ) + variantAuditMetadata(variantResults)
      )
    )

  private fun variantAuditMetadata(variantResults: List<DemoSeedLocalVariantResult>): Map<String, Any> =
    if (variantResults.isEmpty()) {
      emptyMap()
    } else {
      val variant = variantResults.single()
      mapOf<String, Any>(
        "seedVariant" to variant.variant,
        "variantClosingFolderId" to variant.closingFolderId.toString(),
        "variantBalanceImportId" to variant.balanceImportId.toString(),
        "variantBalanceImportLineCount" to variant.balanceImportLineCount,
        "variantManualMappingCount" to variant.manualMappingCount
      ) + variant.datasetClassification?.let { classification ->
        mapOf("dataset" to classification)
      }.orEmpty()
    }

  private data class UpsertedId(
    val id: UUID,
    val changedRows: Int
  )
}

internal data class DemoBalanceLine(
  val id: UUID,
  val lineNo: Int,
  val accountCode: String,
  val accountLabel: String,
  val debit: BigDecimal,
  val credit: BigDecimal
)

internal data class DemoManualMapping(
  val id: UUID,
  val accountCode: String,
  val targetCode: String
)

internal data class DemoSeedLocalActorDataset(
  val userId: UUID,
  val externalSubject: String,
  val email: String,
  val displayName: String,
  val membershipId: UUID,
  val membershipRole: String
)

internal data class DemoSeedLocalFolderDataset(
  val closingFolderId: UUID,
  val closingFolderName: String,
  val closingFolderExternalRef: String,
  val periodStartOn: LocalDate,
  val periodEndOn: LocalDate,
  val balanceImportId: UUID,
  val balanceImportVersion: Int,
  val sourceFileName: String,
  val balanceLines: List<DemoBalanceLine>,
  val manualMappings: List<DemoManualMapping>
) {
  val totalDebit: BigDecimal = balanceLines.fold(BigDecimal.ZERO) { total, line -> total + line.debit }
  val totalCredit: BigDecimal = balanceLines.fold(BigDecimal.ZERO) { total, line -> total + line.credit }
}

internal enum class DemoSeedLocalVariant(
  val propertyValue: String,
  val folderDataset: DemoSeedLocalFolderDataset,
  val additionalActors: List<DemoSeedLocalActorDataset> = emptyList(),
  val datasetClassification: String? = null,
  val enforceExactActiveRoles: Boolean = false
) {
  MIXED_V2_042A2A5D(
    propertyValue = DEMO_SEED_VARIANT_042A2A5D_MIXED_V2,
    folderDataset = DemoSeedLocalDataset.variant042a2a5dMixedV2Folder
  ),
  TWO_ACTOR_PILOT_043B(
    propertyValue = DEMO_SEED_VARIANT_043B_TWO_ACTOR_PILOT,
    folderDataset = DemoSeedLocalDataset.variant043bTwoActorPilotFolder,
    additionalActors = listOf(DemoSeedLocalDataset.reviewer043bActor),
    datasetClassification = DEMO_SEED_DATASET_CLASSIFICATION_043B,
    enforceExactActiveRoles = true
  );

  companion object {
    fun fromPropertyValue(rawValue: String?): DemoSeedLocalVariant? {
      val normalized = rawValue?.trim().orEmpty()
      if (normalized.isBlank()) return null

      return values().firstOrNull { it.propertyValue == normalized }
        ?: throw IllegalArgumentException(
          "$DEMO_SEED_VARIANT_PROPERTY must be one of ${values().map { it.propertyValue }}."
        )
    }
  }
}

internal object DemoSeedLocalDataset {
  val tenantId: UUID = UUID.fromString("036a0000-0000-4000-8000-000000000001")
  const val tenantSlug: String = "ritomer-demo-036a"
  const val tenantLegalName: String = "Ritomer Demo Fiduciaire SA (synthetic)"

  val userId: UUID = UUID.fromString("036a0000-0000-4000-8000-000000000002")
  const val userExternalSubject: String = "ritomer-demo-user-036a"
  const val userEmail: String = "demo.accountant@example.invalid"
  const val userDisplayName: String = "Demo Accountant 036a"

  val membershipId: UUID = UUID.fromString("036a0000-0000-4000-8000-000000000003")
  const val membershipRole: String = "ACCOUNTANT"

  val accountantActor: DemoSeedLocalActorDataset = DemoSeedLocalActorDataset(
    userId = userId,
    externalSubject = userExternalSubject,
    email = userEmail,
    displayName = userDisplayName,
    membershipId = membershipId,
    membershipRole = membershipRole
  )

  val reviewerUserId: UUID = UUID.fromString("043b0000-0000-4000-8000-000000000002")
  const val reviewerExternalSubject: String = "ritomer-demo-reviewer-043b"
  const val reviewerEmail: String = "demo.reviewer.043b@example.invalid"
  const val reviewerDisplayName: String = "Demo Reviewer 043b"
  val reviewerMembershipId: UUID = UUID.fromString("043b0000-0000-4000-8000-000000000003")
  const val reviewerMembershipRole: String = "REVIEWER"

  val reviewer043bActor: DemoSeedLocalActorDataset = DemoSeedLocalActorDataset(
    userId = reviewerUserId,
    externalSubject = reviewerExternalSubject,
    email = reviewerEmail,
    displayName = reviewerDisplayName,
    membershipId = reviewerMembershipId,
    membershipRole = reviewerMembershipRole
  )

  private val periodStart = LocalDate.parse("2025-01-01")
  private val periodEnd = LocalDate.parse("2025-12-31")
  private const val importVersion: Int = 1
  private const val syntheticSourceFileName: String = "demo-synthetic-balance.csv"

  val primaryFolder: DemoSeedLocalFolderDataset = DemoSeedLocalFolderDataset(
    closingFolderId = UUID.fromString("036a0000-0000-4000-8000-000000000004"),
    closingFolderName = "Demo Closing FY2025 (synthetic)",
    closingFolderExternalRef = "DEMO-036A-FY2025",
    periodStartOn = periodStart,
    periodEndOn = periodEnd,
    balanceImportId = UUID.fromString("036a0000-0000-4000-8000-000000000005"),
    balanceImportVersion = importVersion,
    sourceFileName = syntheticSourceFileName,
    balanceLines = listOf(
      DemoBalanceLine(
        id = UUID.fromString("036a0000-0000-4000-8000-000000000101"),
        lineNo = 1,
        accountCode = "1000",
        accountLabel = "Synthetic cash account",
        debit = BigDecimal("100000.00"),
        credit = BigDecimal("0.00")
      ),
      DemoBalanceLine(
        id = UUID.fromString("036a0000-0000-4000-8000-000000000102"),
        lineNo = 2,
        accountCode = "1100",
        accountLabel = "Synthetic trade receivables",
        debit = BigDecimal("25000.00"),
        credit = BigDecimal("0.00")
      ),
      DemoBalanceLine(
        id = UUID.fromString("036a0000-0000-4000-8000-000000000103"),
        lineNo = 3,
        accountCode = "2000",
        accountLabel = "Synthetic trade payables",
        debit = BigDecimal("0.00"),
        credit = BigDecimal("17000.00")
      ),
      DemoBalanceLine(
        id = UUID.fromString("036a0000-0000-4000-8000-000000000104"),
        lineNo = 4,
        accountCode = "2800",
        accountLabel = "Synthetic retained earnings",
        debit = BigDecimal("0.00"),
        credit = BigDecimal("30000.00")
      ),
      DemoBalanceLine(
        id = UUID.fromString("036a0000-0000-4000-8000-000000000105"),
        lineNo = 5,
        accountCode = "3000",
        accountLabel = "Synthetic operating revenue",
        debit = BigDecimal("0.00"),
        credit = BigDecimal("90000.00")
      ),
      DemoBalanceLine(
        id = UUID.fromString("036a0000-0000-4000-8000-000000000106"),
        lineNo = 6,
        accountCode = "4000",
        accountLabel = "Synthetic operating expenses",
        debit = BigDecimal("12000.00"),
        credit = BigDecimal("0.00")
      )
    ),
    manualMappings = listOf(
      DemoManualMapping(
        id = UUID.fromString("036a0000-0000-4000-8000-000000000201"),
        accountCode = "1000",
        targetCode = "BS.ASSET.CASH_AND_EQUIVALENTS"
      ),
      DemoManualMapping(
        id = UUID.fromString("036a0000-0000-4000-8000-000000000202"),
        accountCode = "1100",
        targetCode = "BS.ASSET.TRADE_RECEIVABLES"
      ),
      DemoManualMapping(
        id = UUID.fromString("036a0000-0000-4000-8000-000000000203"),
        accountCode = "2000",
        targetCode = "BS.LIABILITY.TRADE_PAYABLES"
      ),
      DemoManualMapping(
        id = UUID.fromString("036a0000-0000-4000-8000-000000000204"),
        accountCode = "2800",
        targetCode = "BS.EQUITY.RETAINED_EARNINGS"
      ),
      DemoManualMapping(
        id = UUID.fromString("036a0000-0000-4000-8000-000000000205"),
        accountCode = "3000",
        targetCode = "PL.REVENUE.OPERATING_REVENUE"
      ),
      DemoManualMapping(
        id = UUID.fromString("036a0000-0000-4000-8000-000000000206"),
        accountCode = "4000",
        targetCode = "PL.EXPENSE.OTHER_OPERATING_EXPENSES"
      )
    )
  )

  val variant043bTwoActorPilotFolder: DemoSeedLocalFolderDataset = DemoSeedLocalFolderDataset(
    closingFolderId = UUID.fromString("043b0000-0000-4000-8000-000000000004"),
    closingFolderName = "Demo Closing FY2025 043b two-actor pilot (synthetic)",
    closingFolderExternalRef = "DEMO-043B-TWO-ACTOR-PILOT",
    periodStartOn = periodStart,
    periodEndOn = periodEnd,
    balanceImportId = UUID.fromString("043b0000-0000-4000-8000-000000000005"),
    balanceImportVersion = importVersion,
    sourceFileName = syntheticSourceFileName,
    balanceLines = primaryFolder.balanceLines.mapIndexed { index, line ->
      line.copy(id = deterministic043bId(101 + index))
    },
    manualMappings = primaryFolder.manualMappings.mapIndexed { index, mapping ->
      mapping.copy(id = deterministic043bId(201 + index))
    }
  )

  val variant042a2a5dMixedV2Folder: DemoSeedLocalFolderDataset = DemoSeedLocalFolderDataset(
    closingFolderId = UUID.fromString("042a2a5d-0000-4000-8000-000000000004"),
    closingFolderName = "Demo Closing FY2025 042a2a5d mixed v2 (synthetic)",
    closingFolderExternalRef = "DEMO-042A2A5D-MIXED-V2",
    periodStartOn = periodStart,
    periodEndOn = periodEnd,
    balanceImportId = UUID.fromString("042a2a5d-0000-4000-8000-000000000005"),
    balanceImportVersion = importVersion,
    sourceFileName = syntheticSourceFileName,
    balanceLines = listOf(
      DemoBalanceLine(
        id = UUID.fromString("042a2a5d-0000-4000-8000-000000000101"),
        lineNo = 1,
        accountCode = "1000",
        accountLabel = "Synthetic cash account",
        debit = BigDecimal("100000.00"),
        credit = BigDecimal("0.00")
      ),
      DemoBalanceLine(
        id = UUID.fromString("042a2a5d-0000-4000-8000-000000000102"),
        lineNo = 2,
        accountCode = "1100",
        accountLabel = "Synthetic trade receivables",
        debit = BigDecimal("25000.00"),
        credit = BigDecimal("0.00")
      ),
      DemoBalanceLine(
        id = UUID.fromString("042a2a5d-0000-4000-8000-000000000103"),
        lineNo = 3,
        accountCode = "2000",
        accountLabel = "Synthetic trade payables",
        debit = BigDecimal("0.00"),
        credit = BigDecimal("17000.00")
      ),
      DemoBalanceLine(
        id = UUID.fromString("042a2a5d-0000-4000-8000-000000000104"),
        lineNo = 4,
        accountCode = "2800",
        accountLabel = "Synthetic retained earnings",
        debit = BigDecimal("0.00"),
        credit = BigDecimal("30000.00")
      ),
      DemoBalanceLine(
        id = UUID.fromString("042a2a5d-0000-4000-8000-000000000105"),
        lineNo = 5,
        accountCode = "3000",
        accountLabel = "Synthetic operating revenue",
        debit = BigDecimal("0.00"),
        credit = BigDecimal("90000.00")
      ),
      DemoBalanceLine(
        id = UUID.fromString("042a2a5d-0000-4000-8000-000000000106"),
        lineNo = 6,
        accountCode = "4000",
        accountLabel = "Synthetic operating expenses",
        debit = BigDecimal("12000.00"),
        credit = BigDecimal("0.00")
      )
    ),
    manualMappings = listOf(
      DemoManualMapping(
        id = UUID.fromString("042a2a5d-0000-4000-8000-000000000201"),
        accountCode = "1000",
        targetCode = "BS.ASSET.CASH_AND_EQUIVALENTS"
      ),
      DemoManualMapping(
        id = UUID.fromString("042a2a5d-0000-4000-8000-000000000202"),
        accountCode = "1100",
        targetCode = "BS.ASSET.TRADE_RECEIVABLES"
      ),
      DemoManualMapping(
        id = UUID.fromString("042a2a5d-0000-4000-8000-000000000203"),
        accountCode = "2000",
        targetCode = "BS.LIABILITY.TRADE_PAYABLES"
      ),
      DemoManualMapping(
        id = UUID.fromString("042a2a5d-0000-4000-8000-000000000204"),
        accountCode = "2800",
        targetCode = "BS.EQUITY.RETAINED_EARNINGS"
      )
    )
  )

  val closingFolderId: UUID = primaryFolder.closingFolderId
  val closingFolderName: String = primaryFolder.closingFolderName
  val closingFolderExternalRef: String = primaryFolder.closingFolderExternalRef
  val periodStartOn: LocalDate = primaryFolder.periodStartOn
  val periodEndOn: LocalDate = primaryFolder.periodEndOn

  val balanceImportId: UUID = primaryFolder.balanceImportId
  val balanceImportVersion: Int = primaryFolder.balanceImportVersion
  val sourceFileName: String = primaryFolder.sourceFileName
  val balanceLines: List<DemoBalanceLine> = primaryFolder.balanceLines
  val totalDebit: BigDecimal = primaryFolder.totalDebit
  val totalCredit: BigDecimal = primaryFolder.totalCredit
  val manualMappings: List<DemoManualMapping> = primaryFolder.manualMappings

  private fun deterministic043bId(sequence: Int): UUID =
    UUID.fromString("043b0000-0000-4000-8000-${sequence.toString().padStart(12, '0')}")
}
