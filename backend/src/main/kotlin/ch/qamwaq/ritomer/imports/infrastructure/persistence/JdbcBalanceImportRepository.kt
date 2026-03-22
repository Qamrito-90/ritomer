package ch.qamwaq.ritomer.imports.infrastructure.persistence

import ch.qamwaq.ritomer.imports.application.BalanceImportRepository
import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.imports.domain.BalanceImportSnapshot
import java.sql.PreparedStatement
import java.time.OffsetDateTime
import java.util.UUID
import org.springframework.context.annotation.Profile
import org.springframework.jdbc.core.BatchPreparedStatementSetter
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.core.simple.JdbcClient.StatementSpec
import org.springframework.stereotype.Repository

@Repository
@Profile("!test")
class JdbcBalanceImportRepository(
  private val jdbcClient: JdbcClient,
  private val jdbcTemplate: JdbcTemplate
) : BalanceImportRepository {
  override fun nextVersion(tenantId: UUID, closingFolderId: UUID): Int =
    jdbcClient.sql(
      """
      select coalesce(max(version), 0) + 1
      from balance_import
      where tenant_id = :tenantId
        and closing_folder_id = :closingFolderId
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("closingFolderId", closingFolderId)
      .query(Int::class.java)
      .single()

  override fun create(balanceImport: BalanceImport, lines: List<BalanceImportLine>): BalanceImport {
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
        :importedAt,
        :importedByUserId,
        :rowCount,
        :totalDebit,
        :totalCredit
      )
      """.trimIndent()
    )
      .withImport(balanceImport)
      .update()

    jdbcTemplate.batchUpdate(
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
      object : BatchPreparedStatementSetter {
        override fun setValues(ps: PreparedStatement, index: Int) {
          val line = lines[index]
          ps.setObject(1, UUID.randomUUID())
          ps.setObject(2, balanceImport.tenantId)
          ps.setObject(3, balanceImport.id)
          ps.setInt(4, line.lineNo)
          ps.setString(5, line.accountCode)
          ps.setString(6, line.accountLabel)
          ps.setBigDecimal(7, line.debit)
          ps.setBigDecimal(8, line.credit)
        }

        override fun getBatchSize(): Int = lines.size
      }
    )

    return balanceImport
  }

  override fun findVersions(tenantId: UUID, closingFolderId: UUID): List<BalanceImport> =
    jdbcClient.sql(
      """
      select id,
             tenant_id,
             closing_folder_id,
             version,
             source_file_name,
             imported_at,
             imported_by_user_id,
             row_count,
             total_debit,
             total_credit
      from balance_import
      where tenant_id = :tenantId
        and closing_folder_id = :closingFolderId
      order by version desc
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("closingFolderId", closingFolderId)
      .query(BALANCE_IMPORT_ROW_MAPPER)
      .list()

  override fun findSnapshotByVersion(
    tenantId: UUID,
    closingFolderId: UUID,
    version: Int
  ): BalanceImportSnapshot? {
    val balanceImport = jdbcClient.sql(
      """
      select id,
             tenant_id,
             closing_folder_id,
             version,
             source_file_name,
             imported_at,
             imported_by_user_id,
             row_count,
             total_debit,
             total_credit
      from balance_import
      where tenant_id = :tenantId
        and closing_folder_id = :closingFolderId
        and version = :version
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("closingFolderId", closingFolderId)
      .param("version", version)
      .query(BALANCE_IMPORT_ROW_MAPPER)
      .optional()
      .orElse(null)
      ?: return null

    val lines = jdbcClient.sql(
      """
      select line_no,
             account_code,
             account_label,
             debit,
             credit
      from balance_import_line
      where tenant_id = :tenantId
        and balance_import_id = :balanceImportId
      order by line_no asc
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("balanceImportId", balanceImport.id)
      .query(BALANCE_IMPORT_LINE_ROW_MAPPER)
      .list()

    return BalanceImportSnapshot(balanceImport, lines)
  }

  companion object {
    private val BALANCE_IMPORT_ROW_MAPPER = RowMapper<BalanceImport> { rs, _ ->
      BalanceImport(
        id = rs.getObject("id", UUID::class.java),
        tenantId = rs.getObject("tenant_id", UUID::class.java),
        closingFolderId = rs.getObject("closing_folder_id", UUID::class.java),
        version = rs.getInt("version"),
        sourceFileName = rs.getString("source_file_name"),
        importedAt = rs.getObject("imported_at", OffsetDateTime::class.java),
        importedByUserId = rs.getObject("imported_by_user_id", UUID::class.java),
        rowCount = rs.getInt("row_count"),
        totalDebit = rs.getBigDecimal("total_debit"),
        totalCredit = rs.getBigDecimal("total_credit")
      )
    }

    private val BALANCE_IMPORT_LINE_ROW_MAPPER = RowMapper<BalanceImportLine> { rs, _ ->
      BalanceImportLine(
        lineNo = rs.getInt("line_no"),
        accountCode = rs.getString("account_code"),
        accountLabel = rs.getString("account_label"),
        debit = rs.getBigDecimal("debit"),
        credit = rs.getBigDecimal("credit")
      )
    }
  }
}

private fun StatementSpec.withImport(balanceImport: BalanceImport): StatementSpec =
  param("id", balanceImport.id)
    .param("tenantId", balanceImport.tenantId)
    .param("closingFolderId", balanceImport.closingFolderId)
    .param("version", balanceImport.version)
    .param("sourceFileName", balanceImport.sourceFileName)
    .param("importedAt", balanceImport.importedAt)
    .param("importedByUserId", balanceImport.importedByUserId)
    .param("rowCount", balanceImport.rowCount)
    .param("totalDebit", balanceImport.totalDebit)
    .param("totalCredit", balanceImport.totalCredit)
