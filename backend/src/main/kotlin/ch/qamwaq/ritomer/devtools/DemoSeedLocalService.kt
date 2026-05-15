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
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

internal data class DemoSeedLocalResult(
  val tenantId: UUID,
  val userId: UUID,
  val closingFolderId: UUID,
  val balanceImportId: UUID,
  val changedRows: Int,
  val balanceImportLineCount: Int,
  val manualMappingCount: Int,
  val auditEventId: UUID?
)

@Service
@Profile("local", "test", "dbtest")
@ConditionalOnProperty(name = [DEMO_SEED_ENABLED_PROPERTY], havingValue = "true")
internal class DemoSeedLocalService(
  private val jdbcClient: JdbcClient,
  private val auditTrail: AuditTrail
) {
  @Transactional
  fun seed(): DemoSeedLocalResult {
    val now = OffsetDateTime.now(ZoneOffset.UTC)
    var changedRows = 0

    val tenantId = upsertTenant(now).also { changedRows += it.changedRows }.id
    val userId = upsertAppUser(now).also { changedRows += it.changedRows }.id
    changedRows += upsertTenantMembership(tenantId, userId, now)
    changedRows += upsertClosingFolder(tenantId, now)
    changedRows += upsertBalanceImport(tenantId, userId, now)
    val balanceImportId = findDemoBalanceImportId(tenantId)
    DemoSeedLocalDataset.balanceLines.forEach { line ->
      changedRows += upsertBalanceImportLine(tenantId, balanceImportId, line)
    }
    DemoSeedLocalDataset.manualMappings.forEach { mapping ->
      changedRows += upsertManualMapping(tenantId, userId, mapping, now)
    }

    val auditEventId = if (changedRows > 0) {
      appendSeedAudit(tenantId, userId, balanceImportId, changedRows)
    } else {
      null
    }

    return DemoSeedLocalResult(
      tenantId = tenantId,
      userId = userId,
      closingFolderId = DemoSeedLocalDataset.closingFolderId,
      balanceImportId = balanceImportId,
      changedRows = changedRows,
      balanceImportLineCount = DemoSeedLocalDataset.balanceLines.size,
      manualMappingCount = DemoSeedLocalDataset.manualMappings.size,
      auditEventId = auditEventId
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

  private fun upsertAppUser(now: OffsetDateTime): UpsertedId {
    val existingId = findUuidByNaturalKey(
      """
      select id
      from app_user
      where external_subject = :externalSubject
      """.trimIndent(),
      "externalSubject" to DemoSeedLocalDataset.userExternalSubject
    )
    if (existingId == null) {
      val insertedRows = jdbcClient.sql(
        """
        insert into app_user (id, external_subject, email, display_name, status, created_at, updated_at)
        values (:id, :externalSubject, :email, :displayName, 'ACTIVE', :now, :now)
        """.trimIndent()
      )
        .param("id", DemoSeedLocalDataset.userId)
        .param("externalSubject", DemoSeedLocalDataset.userExternalSubject)
        .param("email", DemoSeedLocalDataset.userEmail)
        .param("displayName", DemoSeedLocalDataset.userDisplayName)
        .param("now", now)
        .update()
      return UpsertedId(DemoSeedLocalDataset.userId, insertedRows)
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
      .param("email", DemoSeedLocalDataset.userEmail)
      .param("displayName", DemoSeedLocalDataset.userDisplayName)
      .param("now", now)
      .update()
    return UpsertedId(existingId, updatedRows)
  }

  private fun upsertTenantMembership(
    tenantId: UUID,
    userId: UUID,
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
      .param("id", DemoSeedLocalDataset.membershipId)
      .param("tenantId", tenantId)
      .param("userId", userId)
      .param("roleCode", DemoSeedLocalDataset.membershipRole)
      .param("now", now)
      .update()

  private fun upsertClosingFolder(
    tenantId: UUID,
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
      .param("id", DemoSeedLocalDataset.closingFolderId)
      .param("tenantId", tenantId)
      .param("name", DemoSeedLocalDataset.closingFolderName)
      .param("periodStartOn", DemoSeedLocalDataset.periodStartOn)
      .param("periodEndOn", DemoSeedLocalDataset.periodEndOn)
      .param("externalRef", DemoSeedLocalDataset.closingFolderExternalRef)
      .param("now", now)
      .update()

  private fun upsertBalanceImport(
    tenantId: UUID,
    userId: UUID,
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
      .param("id", DemoSeedLocalDataset.balanceImportId)
      .param("tenantId", tenantId)
      .param("closingFolderId", DemoSeedLocalDataset.closingFolderId)
      .param("version", DemoSeedLocalDataset.balanceImportVersion)
      .param("sourceFileName", DemoSeedLocalDataset.sourceFileName)
      .param("now", now)
      .param("userId", userId)
      .param("rowCount", DemoSeedLocalDataset.balanceLines.size)
      .param("totalDebit", DemoSeedLocalDataset.totalDebit)
      .param("totalCredit", DemoSeedLocalDataset.totalCredit)
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
      .param("closingFolderId", DemoSeedLocalDataset.closingFolderId)
      .param("accountCode", mapping.accountCode)
      .param("targetCode", mapping.targetCode)
      .param("now", now)
      .param("userId", userId)
      .update()

  private fun findDemoBalanceImportId(tenantId: UUID): UUID =
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
      .param("closingFolderId", DemoSeedLocalDataset.closingFolderId)
      .param("version", DemoSeedLocalDataset.balanceImportVersion)
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
    changedRows: Int
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
        )
      )
    )

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

  val closingFolderId: UUID = UUID.fromString("036a0000-0000-4000-8000-000000000004")
  const val closingFolderName: String = "Demo Closing FY2025 (synthetic)"
  const val closingFolderExternalRef: String = "DEMO-036A-FY2025"
  val periodStartOn: LocalDate = LocalDate.parse("2025-01-01")
  val periodEndOn: LocalDate = LocalDate.parse("2025-12-31")

  val balanceImportId: UUID = UUID.fromString("036a0000-0000-4000-8000-000000000005")
  const val balanceImportVersion: Int = 1
  const val sourceFileName: String = "demo-synthetic-balance.csv"

  val balanceLines: List<DemoBalanceLine> = listOf(
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
  )

  val totalDebit: BigDecimal = balanceLines.fold(BigDecimal.ZERO) { total, line -> total + line.debit }
  val totalCredit: BigDecimal = balanceLines.fold(BigDecimal.ZERO) { total, line -> total + line.credit }

  val manualMappings: List<DemoManualMapping> = listOf(
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
}
