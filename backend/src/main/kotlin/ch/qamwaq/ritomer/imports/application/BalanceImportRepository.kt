package ch.qamwaq.ritomer.imports.application

import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.imports.domain.BalanceImportSnapshot
import java.util.UUID

interface BalanceImportRepository {
  fun nextVersion(tenantId: UUID, closingFolderId: UUID): Int

  fun create(balanceImport: BalanceImport, lines: List<BalanceImportLine>): BalanceImport

  fun findVersions(tenantId: UUID, closingFolderId: UUID): List<BalanceImport>

  fun findSnapshotByVersion(
    tenantId: UUID,
    closingFolderId: UUID,
    version: Int
  ): BalanceImportSnapshot?
}
