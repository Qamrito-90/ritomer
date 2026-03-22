package ch.qamwaq.ritomer.imports.domain

import java.math.BigDecimal
import java.time.OffsetDateTime
import java.util.UUID

data class BalanceImport(
  val id: UUID,
  val tenantId: UUID,
  val closingFolderId: UUID,
  val version: Int,
  val sourceFileName: String,
  val importedAt: OffsetDateTime,
  val importedByUserId: UUID,
  val rowCount: Int,
  val totalDebit: BigDecimal,
  val totalCredit: BigDecimal
)

data class BalanceImportLine(
  val lineNo: Int,
  val accountCode: String,
  val accountLabel: String,
  val debit: BigDecimal,
  val credit: BigDecimal
)

data class BalanceImportSnapshot(
  val import: BalanceImport,
  val lines: List<BalanceImportLine>
)

data class BalanceImportDiff(
  val version: Int,
  val previousVersion: Int?,
  val added: List<BalanceImportLine>,
  val removed: List<BalanceImportLine>,
  val changed: List<BalanceImportLineChange>
)

data class BalanceImportLineChange(
  val accountCode: String,
  val before: BalanceImportLine,
  val after: BalanceImportLine
)

data class BalanceImportDiffSummary(
  val previousVersion: Int?,
  val addedCount: Int,
  val removedCount: Int,
  val changedCount: Int
)
