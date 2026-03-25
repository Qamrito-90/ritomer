package ch.qamwaq.ritomer.imports.access

import ch.qamwaq.ritomer.imports.application.BalanceImportRepository
import java.math.BigDecimal
import java.util.UUID
import org.springframework.stereotype.Service

data class LatestImportedBalance(
  val version: Int,
  val lines: List<ImportedBalanceLine>
)

data class ImportedBalanceLine(
  val lineNo: Int,
  val accountCode: String,
  val accountLabel: String,
  val debit: BigDecimal,
  val credit: BigDecimal
)

fun interface BalanceImportAccess {
  fun findLatestImportedBalance(tenantId: UUID, closingFolderId: UUID): LatestImportedBalance?
}

@Service
class RepositoryBalanceImportAccess(
  private val balanceImportRepository: BalanceImportRepository
) : BalanceImportAccess {
  override fun findLatestImportedBalance(tenantId: UUID, closingFolderId: UUID): LatestImportedBalance? {
    val latestVersion = balanceImportRepository.findVersions(tenantId, closingFolderId).firstOrNull()?.version ?: return null
    val snapshot = balanceImportRepository.findSnapshotByVersion(tenantId, closingFolderId, latestVersion)
      ?: error("Latest balance import snapshot $latestVersion was not found for closing folder $closingFolderId.")

    return LatestImportedBalance(
      version = snapshot.import.version,
      lines = snapshot.lines.map {
        ImportedBalanceLine(
          lineNo = it.lineNo,
          accountCode = it.accountCode,
          accountLabel = it.accountLabel,
          debit = it.debit,
          credit = it.credit
        )
      }
    )
  }
}
