package ch.qamwaq.ritomer.financials.access

import ch.qamwaq.ritomer.mapping.access.FinancialStatementStructureAccess
import ch.qamwaq.ritomer.mapping.access.StructuredFinancialStatementEntry
import ch.qamwaq.ritomer.mapping.access.StructuredFinancialStatementKind
import java.util.UUID
import org.springframework.stereotype.Service

data class CurrentWorkpaperAnchorProjection(
  val latestImportVersion: Int?,
  val taxonomyVersion: Int,
  val anchors: List<CurrentWorkpaperAnchor>
)

data class CurrentWorkpaperAnchor(
  val code: String,
  val label: String,
  val summaryBucketCode: String,
  val statementKind: CurrentWorkpaperStatementKind,
  val breakdownType: CurrentWorkpaperBreakdownType
)

enum class CurrentWorkpaperStatementKind {
  BALANCE_SHEET,
  INCOME_STATEMENT
}

enum class CurrentWorkpaperBreakdownType {
  SECTION,
  LEGACY_BUCKET_FALLBACK
}

fun interface WorkpaperAnchorAccess {
  fun getCurrentAnchors(tenantId: UUID, closingFolderId: UUID): CurrentWorkpaperAnchorProjection
}

@Service
class StructuredProjectionBackedWorkpaperAnchorAccess(
  private val financialStatementStructureAccess: FinancialStatementStructureAccess
) : WorkpaperAnchorAccess {
  override fun getCurrentAnchors(tenantId: UUID, closingFolderId: UUID): CurrentWorkpaperAnchorProjection {
    val projection = financialStatementStructureAccess.getStructuredProjection(tenantId, closingFolderId)
    val statementKindsBySummaryBucketCode = projection.summaryBuckets.associate { it.code to it.statement.toCurrentStatementKind() }
    val anchors = projection.mappedEntries
      .groupBy { it.summaryBucketCode }
      .entries
      .sortedBy { SUMMARY_BUCKET_ORDER.indexOf(it.key).takeIf { index -> index >= 0 } ?: Int.MAX_VALUE }
      .flatMap { (summaryBucketCode, bucketEntries) ->
        val statementKind = statementKindsBySummaryBucketCode[summaryBucketCode]
          ?: error("Missing summary bucket metadata for '$summaryBucketCode'.")
        bucketEntries
          .groupBy { it.toAnchorKey() }
          .entries
          .sortedWith(compareBy<Map.Entry<AnchorKey, List<StructuredFinancialStatementEntry>>> { it.key.order }.thenBy { it.key.code })
          .map { (key, _) ->
            CurrentWorkpaperAnchor(
              code = key.code,
              label = key.label,
              summaryBucketCode = summaryBucketCode,
              statementKind = statementKind,
              breakdownType = key.breakdownType
            )
          }
      }

    return CurrentWorkpaperAnchorProjection(
      latestImportVersion = projection.latestImportVersion,
      taxonomyVersion = projection.taxonomyVersion,
      anchors = anchors
    )
  }

  private fun StructuredFinancialStatementKind.toCurrentStatementKind(): CurrentWorkpaperStatementKind =
    when (this) {
      StructuredFinancialStatementKind.BALANCE_SHEET -> CurrentWorkpaperStatementKind.BALANCE_SHEET
      StructuredFinancialStatementKind.INCOME_STATEMENT -> CurrentWorkpaperStatementKind.INCOME_STATEMENT
    }

  private fun StructuredFinancialStatementEntry.toAnchorKey(): AnchorKey =
    if (usesLegacyBucketFallback) {
      AnchorKey(
        code = "$summaryBucketCode$LEGACY_BUCKET_FALLBACK_SUFFIX",
        label = LEGACY_BUCKET_FALLBACK_LABEL,
        order = LEGACY_BUCKET_FALLBACK_ORDER,
        breakdownType = CurrentWorkpaperBreakdownType.LEGACY_BUCKET_FALLBACK
      )
    } else {
      AnchorKey(
        code = sectionCode,
        label = sectionLabel,
        order = sectionDisplayOrder,
        breakdownType = CurrentWorkpaperBreakdownType.SECTION
      )
    }

  private data class AnchorKey(
    val code: String,
    val label: String,
    val order: Int,
    val breakdownType: CurrentWorkpaperBreakdownType
  )

  companion object {
    private const val LEGACY_BUCKET_FALLBACK_SUFFIX = ".LEGACY_BUCKET_FALLBACK"
    private const val LEGACY_BUCKET_FALLBACK_LABEL = "Legacy bucket-level mappings"
    private const val LEGACY_BUCKET_FALLBACK_ORDER = 0

    private val SUMMARY_BUCKET_ORDER = listOf(
      "BS.ASSET",
      "BS.LIABILITY",
      "BS.EQUITY",
      "PL.REVENUE",
      "PL.EXPENSE"
    )
  }
}
