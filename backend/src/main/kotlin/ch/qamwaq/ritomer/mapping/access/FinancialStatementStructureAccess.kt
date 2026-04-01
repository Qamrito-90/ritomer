package ch.qamwaq.ritomer.mapping.access

import ch.qamwaq.ritomer.mapping.application.ManualMappingStatement
import ch.qamwaq.ritomer.mapping.application.ManualMappingTargetCatalog
import java.math.BigDecimal
import java.util.UUID
import org.springframework.stereotype.Service

data class StructuredFinancialStatementProjection(
  val closingFolderId: UUID,
  val taxonomyVersion: Int,
  val latestImportVersion: Int?,
  val coverage: StructuredFinancialStatementCoverage,
  val summaryBuckets: List<StructuredFinancialStatementBucket>,
  val mappedEntries: List<StructuredFinancialStatementEntry>
)

data class StructuredFinancialStatementCoverage(
  val totalLines: Int,
  val mappedLines: Int,
  val unmappedLines: Int
)

data class StructuredFinancialStatementBucket(
  val code: String,
  val label: String,
  val statement: StructuredFinancialStatementKind
)

data class StructuredFinancialStatementEntry(
  val accountCode: String,
  val targetCode: String,
  val summaryBucketCode: String,
  val sectionCode: String,
  val sectionLabel: String,
  val sectionDisplayOrder: Int,
  val usesLegacyBucketFallback: Boolean,
  val debit: BigDecimal,
  val credit: BigDecimal
)

enum class StructuredFinancialStatementKind {
  BALANCE_SHEET,
  INCOME_STATEMENT
}

fun interface FinancialStatementStructureAccess {
  fun getStructuredProjection(tenantId: UUID, closingFolderId: UUID): StructuredFinancialStatementProjection
}

@Service
class CatalogBackedFinancialStatementStructureAccess(
  private val manualMappingAccess: ManualMappingAccess,
  private val manualMappingTargetCatalog: ManualMappingTargetCatalog
) : FinancialStatementStructureAccess {
  override fun getStructuredProjection(
    tenantId: UUID,
    closingFolderId: UUID
  ): StructuredFinancialStatementProjection {
    val projection = manualMappingAccess.getCurrentProjection(tenantId, closingFolderId)
    val linesByAccountCode = projection.lines.associateBy { it.accountCode }

    val summaryBuckets = manualMappingTargetCatalog.all()
      .filter { it.code == it.summaryBucketCode && it.code == it.sectionCode }
      .distinctBy { it.code }
      .map {
        StructuredFinancialStatementBucket(
          code = it.code,
          label = it.label,
          statement = it.statement.toAccessKind()
        )
      }

    val mappedEntries = projection.mappings.map { mapping ->
      val line = linesByAccountCode[mapping.accountCode]
        ?: error("Missing import line for mapped account '${mapping.accountCode}'.")
      val target = manualMappingTargetCatalog.findByCode(mapping.targetCode)
        ?: error("Unknown manual mapping target code '${mapping.targetCode}'.")
      val section = manualMappingTargetCatalog.findByCode(target.sectionCode)
        ?: error("Unknown section code '${target.sectionCode}' for target '${mapping.targetCode}'.")

      StructuredFinancialStatementEntry(
        accountCode = mapping.accountCode,
        targetCode = mapping.targetCode,
        summaryBucketCode = target.summaryBucketCode,
        sectionCode = target.sectionCode,
        sectionLabel = section.label,
        sectionDisplayOrder = section.displayOrder,
        usesLegacyBucketFallback = target.deprecated &&
          target.code == target.summaryBucketCode &&
          target.code == target.sectionCode,
        debit = line.debit,
        credit = line.credit
      )
    }

    return StructuredFinancialStatementProjection(
      closingFolderId = closingFolderId,
      taxonomyVersion = manualMappingTargetCatalog.taxonomyVersion(),
      latestImportVersion = projection.latestImportVersion,
      coverage = StructuredFinancialStatementCoverage(
        totalLines = projection.summary.total,
        mappedLines = projection.summary.mapped,
        unmappedLines = projection.summary.unmapped
      ),
      summaryBuckets = summaryBuckets,
      mappedEntries = mappedEntries
    )
  }

  private fun ManualMappingStatement.toAccessKind(): StructuredFinancialStatementKind =
    when (this) {
      ManualMappingStatement.BALANCE_SHEET -> StructuredFinancialStatementKind.BALANCE_SHEET
      ManualMappingStatement.INCOME_STATEMENT -> StructuredFinancialStatementKind.INCOME_STATEMENT
    }
}
