package ch.qamwaq.ritomer.mapping.access

import ch.qamwaq.ritomer.imports.access.BalanceImportAccess
import ch.qamwaq.ritomer.mapping.application.ManualMappingRepository
import java.math.BigDecimal
import java.util.UUID
import org.springframework.stereotype.Service

data class CurrentManualMappingProjection(
  val closingFolderId: UUID,
  val latestImportVersion: Int?,
  val lines: List<ProjectedManualMappingLine>,
  val mappings: List<ProjectedManualMappingEntry>,
  val summary: ProjectedManualMappingSummary
)

data class ProjectedManualMappingLine(
  val lineNo: Int,
  val accountCode: String,
  val accountLabel: String,
  val debit: BigDecimal,
  val credit: BigDecimal
)

data class ProjectedManualMappingEntry(
  val accountCode: String,
  val targetCode: String
)

data class ProjectedManualMappingSummary(
  val total: Int,
  val mapped: Int,
  val unmapped: Int
)

fun interface ManualMappingAccess {
  fun getCurrentProjection(tenantId: UUID, closingFolderId: UUID): CurrentManualMappingProjection
}

@Service
class DerivedManualMappingAccess(
  private val balanceImportAccess: BalanceImportAccess,
  private val manualMappingRepository: ManualMappingRepository
) : ManualMappingAccess {
  override fun getCurrentProjection(tenantId: UUID, closingFolderId: UUID): CurrentManualMappingProjection {
    val latestImport = balanceImportAccess.findLatestImportedBalance(tenantId, closingFolderId)
      ?: return CurrentManualMappingProjection(
        closingFolderId = closingFolderId,
        latestImportVersion = null,
        lines = emptyList(),
        mappings = emptyList(),
        summary = ProjectedManualMappingSummary(total = 0, mapped = 0, unmapped = 0)
      )

    val lines = latestImport.lines
      .sortedBy { it.lineNo }
      .map {
        ProjectedManualMappingLine(
          lineNo = it.lineNo,
          accountCode = it.accountCode,
          accountLabel = it.accountLabel,
          debit = it.debit,
          credit = it.credit
        )
      }

    val visibleAccountCodes = lines.asSequence().map { it.accountCode }.toSet()
    val mappings = manualMappingRepository.findByClosingFolder(tenantId, closingFolderId)
      .filter { it.accountCode in visibleAccountCodes }
      .sortedBy { it.accountCode }
      .map {
        ProjectedManualMappingEntry(
          accountCode = it.accountCode,
          targetCode = it.targetCode
        )
      }

    return CurrentManualMappingProjection(
      closingFolderId = closingFolderId,
      latestImportVersion = latestImport.version,
      lines = lines,
      mappings = mappings,
      summary = ProjectedManualMappingSummary(
        total = lines.size,
        mapped = mappings.size,
        unmapped = lines.size - mappings.size
      )
    )
  }
}
