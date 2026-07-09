package ch.qamwaq.ritomer.mapping.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccess
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.imports.access.BalanceImportAccess
import ch.qamwaq.ritomer.mapping.access.ManualMappingAccess
import ch.qamwaq.ritomer.mapping.access.ProjectedManualMappingLine
import io.micrometer.core.instrument.MeterRegistry
import java.util.UUID
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Profile
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

const val MAPPING_SUGGESTIONS_V2_OFFLINE_ENABLED_PROPERTY =
  "ritomer.ai.mapping-suggestions-v2.offline.enabled"

data class MappingSuggestionsV2ReadModel(
  val schemaVersion: String,
  val closingFolderId: UUID,
  val latestImportVersion: Int?,
  val taxonomyVersion: Int,
  val taxonomyHash: String,
  val items: List<MappingSuggestionV2Item>
)

@Service
@Profile("local")
@ConditionalOnProperty(
  name = [MAPPING_SUGGESTIONS_V2_OFFLINE_ENABLED_PROPERTY],
  havingValue = "true"
)
class MappingSuggestionsV2OfflineService(
  private val closingFolderAccess: ClosingFolderAccess,
  private val balanceImportAccess: BalanceImportAccess,
  private val manualMappingAccess: ManualMappingAccess,
  private val manualMappingTargetCatalog: ManualMappingTargetCatalog,
  private val offlineMappingEvalProvider: OfflineMappingEvalProvider,
  private val meterRegistry: MeterRegistry
) {
  @Transactional(readOnly = true)
  fun getSuggestions(access: TenantAccessContext, closingFolderId: UUID): MappingSuggestionsV2ReadModel {
    requireAnyRole(access, READ_ROLES)
    closingFolderAccess.getRequired(access.tenantId, closingFolderId)

    val taxonomy = offlineTaxonomy()
    val taxonomyVersion = taxonomy.taxonomyVersion
    val taxonomyHash = taxonomy.hash()

    val allowlistedFolder = allowlistedFolder(access.tenantId, closingFolderId)
    if (allowlistedFolder == null) {
      return readModel(
        closingFolderId = closingFolderId,
        latestImportVersion = null,
        taxonomyVersion = taxonomyVersion,
        taxonomyHash = taxonomyHash,
        items = listOf(
          MappingSuggestionV2Transformer.policyBlock(
            MappingSuggestionV2PolicyBlockCode.OUTSIDE_ALLOWLIST_OR_PROVENANCE
          )
        )
      )
    }

    val latestImport = balanceImportAccess.findLatestImportedBalance(access.tenantId, closingFolderId)
      ?: return readModel(
        closingFolderId = closingFolderId,
        latestImportVersion = null,
        taxonomyVersion = taxonomyVersion,
        taxonomyHash = taxonomyHash,
        items = listOf(
          MappingSuggestionV2Transformer.requestPreconditionBlock(
            MappingSuggestionV2PreconditionBlockCode.STALE_IMPORT
          )
        )
      )

    if (
      latestImport.version != allowlistedFolder.importVersion ||
      latestImport.sourceFileName != allowlistedFolder.sourceFileName
    ) {
      return readModel(
        closingFolderId = closingFolderId,
        latestImportVersion = latestImport.version,
        taxonomyVersion = taxonomyVersion,
        taxonomyHash = taxonomyHash,
        items = listOf(
          MappingSuggestionV2Transformer.policyBlock(
            MappingSuggestionV2PolicyBlockCode.OUTSIDE_ALLOWLIST_OR_PROVENANCE
          )
        )
      )
    }

    val projection = manualMappingAccess.getCurrentProjection(access.tenantId, closingFolderId)
    if (projection.latestImportVersion != latestImport.version) {
      return readModel(
        closingFolderId = closingFolderId,
        latestImportVersion = latestImport.version,
        taxonomyVersion = taxonomyVersion,
        taxonomyHash = taxonomyHash,
        items = listOf(
          MappingSuggestionV2Transformer.requestPreconditionBlock(
            MappingSuggestionV2PreconditionBlockCode.STALE_IMPORT
          )
        )
      )
    }

    val mappedAccountCodes = projection.mappings.map { it.accountCode }.toSet()
    val engine = OfflineMappingEvalEngine042a2(offlineMappingEvalProvider)
    val items = projection.lines.map { line ->
      if (line.accountCode in mappedAccountCodes) {
        MappingSuggestionV2Transformer.accountPreconditionBlock(
          accountCode = line.accountCode,
          localAccountLabel = line.accountLabel,
          code = MappingSuggestionV2PreconditionBlockCode.ACCOUNT_ALREADY_AFFECTED
        )
      } else {
        val result = engine.evaluate(line.toOfflineRequest(taxonomy))
        MappingSuggestionV2Transformer.fromOfflineResult(
          result = result,
          closingFolderId = closingFolderId,
          localAccountLabel = line.accountLabel,
          latestImportVersion = latestImport.version,
          taxonomyVersion = taxonomyVersion,
          taxonomyHash = taxonomyHash
        )
      }
    }

    return readModel(
      closingFolderId = closingFolderId,
      latestImportVersion = latestImport.version,
      taxonomyVersion = taxonomyVersion,
      taxonomyHash = taxonomyHash,
      items = items
    )
  }

  private fun readModel(
    closingFolderId: UUID,
    latestImportVersion: Int?,
    taxonomyVersion: Int,
    taxonomyHash: String,
    items: List<MappingSuggestionV2Item>
  ): MappingSuggestionsV2ReadModel =
    MappingSuggestionsV2ReadModel(
      schemaVersion = MAPPING_SUGGESTION_V2_SCHEMA_VERSION,
      closingFolderId = closingFolderId,
      latestImportVersion = latestImportVersion,
      taxonomyVersion = taxonomyVersion,
      taxonomyHash = taxonomyHash,
      items = items
    ).also { recordMetrics(it) }

  private fun recordMetrics(readModel: MappingSuggestionsV2ReadModel) {
    meterRegistry.counter(
      "ritomer.mapping.suggestions.v2.offline.requests",
      "result",
      readModel.metricResult()
    ).increment()

    readModel.items
      .groupingBy { it.outcome.name to it.scope.name }
      .eachCount()
      .forEach { (key, count) ->
        meterRegistry.counter(
          "ritomer.mapping.suggestions.v2.offline.items",
          "outcome",
          key.first,
          "scope",
          key.second
        ).increment(count.toDouble())
      }
  }

  private fun MappingSuggestionsV2ReadModel.metricResult(): String =
    when {
      items.any { it is MappingSuggestionV2BatchUnavailable } -> "technical_degradation"
      items.any { it is MappingSuggestionV2PolicyBlock } -> "policy_block"
      items.any { it is MappingSuggestionV2RequestPreconditionBlock } -> "request_precondition_block"
      items.any { it is MappingSuggestionV2Suggestion } -> "suggestion"
      items.any { it is MappingSuggestionV2Abstention } -> "abstention"
      else -> "account_precondition_block"
    }

  private fun offlineTaxonomy(): OfflineMappingEvalTaxonomy {
    val targets = manualMappingTargetCatalog.all()
    val targetsByCode = targets.associateBy { it.code }
    val expectedCodes = PILOT_ROOT_TARGET_CODES + PILOT_SECTION_TARGET_CODES + PILOT_CANDIDATE_TARGET_CODES
    val entries = expectedCodes.map { code ->
      val target = targetsByCode[code] ?: error("Pilot mapping target '$code' is not published.")
      target.toOfflineTarget()
    }

    return OfflineMappingEvalTaxonomy(
      id = "RITOMER-MAPPING-PILOT-MINIMAL-LOCAL-V1",
      taxonomyVersion = manualMappingTargetCatalog.taxonomyVersion(),
      entries = entries
    )
  }

  private fun ManualMappingTarget.toOfflineTarget(): OfflineMappingEvalTarget =
    OfflineMappingEvalTarget(
      code = code,
      label = label,
      selectable = selectable,
      deprecated = deprecated,
      granularity = granularity.name,
      pilotRole = when (code) {
        in PILOT_CANDIDATE_TARGET_CODES -> OfflineMappingEvalPilotRole.CANDIDATE_LEAF
        in PILOT_SECTION_TARGET_CODES -> OfflineMappingEvalPilotRole.SECTION
        else -> OfflineMappingEvalPilotRole.ROOT
      },
      displayOrder = displayOrder
    )

  private fun OfflineMappingEvalTaxonomy.hash(): String =
    sha256Hex(
      (
        listOf(
          "mapping-suggestion-v2-offline-taxonomy",
          "taxonomyVersion=$taxonomyVersion",
          "taxonomyId=$id"
        ) + entries.sortedWith(compareBy<OfflineMappingEvalTarget> { it.displayOrder }.thenBy { it.code }).flatMap {
          listOf(
            "target.code=${it.code}",
            "target.label=${it.label}",
            "target.selectable=${it.selectable}",
            "target.deprecated=${it.deprecated}",
            "target.granularity=${it.granularity}",
            "target.pilotRole=${it.pilotRole.name}",
            "target.displayOrder=${it.displayOrder}"
          )
        }
        ).joinToString("\n")
    )

  private fun ProjectedManualMappingLine.toOfflineRequest(taxonomy: OfflineMappingEvalTaxonomy): OfflineMappingEvalRequest =
    OfflineMappingEvalRequest(
      accountCode = accountCode,
      accountLabel = accountLabel,
      balanceSignal = balanceSignal(),
      taxonomy = taxonomy,
      datasetPolicy = "SYNTHETIC_DEMO_ONLY",
      requestSynthetic = true,
      provenanceStatus = "ALLOWLISTED",
      language = "en",
      currentAffectationStatus = "NONE"
    )

  private fun ProjectedManualMappingLine.balanceSignal(): String =
    when {
      debit.signum() == 0 && credit.signum() == 0 -> OfflineMappingEvalBalanceSignal.ZERO_OR_NEAR_ZERO.name
      debit > credit -> OfflineMappingEvalBalanceSignal.DEBIT_DOMINANT.name
      credit > debit -> OfflineMappingEvalBalanceSignal.CREDIT_DOMINANT.name
      else -> OfflineMappingEvalBalanceSignal.MIXED_OR_UNKNOWN.name
    }

  private fun allowlistedFolder(
    tenantId: UUID,
    closingFolderId: UUID
  ): AllowlistedSyntheticDemoFolder? =
    ALLOWLISTED_SYNTHETIC_DEMO_FOLDERS.firstOrNull {
      it.tenantId == tenantId && it.closingFolderId == closingFolderId
    }

  private fun requireAnyRole(access: TenantAccessContext, allowedRoles: Set<String>) {
    if (access.effectiveRoles.none { it in allowedRoles }) {
      throw AccessDeniedException("Insufficient role for mapping suggestions v2.")
    }
  }

  companion object {
    private val READ_ROLES = setOf("ACCOUNTANT", "REVIEWER", "MANAGER", "ADMIN")

    private val DEMO_TENANT_ID: UUID = UUID.fromString("036a0000-0000-4000-8000-000000000001")
    private const val DEMO_IMPORT_VERSION = 1
    private const val DEMO_SOURCE_FILE_NAME = "demo-synthetic-balance.csv"
    private val ALLOWLISTED_SYNTHETIC_DEMO_FOLDERS = setOf(
      AllowlistedSyntheticDemoFolder(
        tenantId = DEMO_TENANT_ID,
        closingFolderId = UUID.fromString("036a0000-0000-4000-8000-000000000004"),
        importVersion = DEMO_IMPORT_VERSION,
        sourceFileName = DEMO_SOURCE_FILE_NAME
      ),
      AllowlistedSyntheticDemoFolder(
        tenantId = DEMO_TENANT_ID,
        closingFolderId = UUID.fromString("042a2a5d-0000-4000-8000-000000000004"),
        importVersion = DEMO_IMPORT_VERSION,
        sourceFileName = DEMO_SOURCE_FILE_NAME
      )
    )

    private val PILOT_ROOT_TARGET_CODES = listOf(
      "BS.ASSET",
      "BS.EQUITY",
      "BS.LIABILITY",
      "PL.EXPENSE",
      "PL.REVENUE"
    )
    private val PILOT_SECTION_TARGET_CODES = listOf(
      "BS.ASSET.CURRENT_SECTION",
      "BS.LIABILITY.CURRENT_SECTION",
      "BS.EQUITY.CORE_SECTION",
      "PL.REVENUE.OPERATING_SECTION",
      "PL.EXPENSE.OPERATING_SECTION"
    )
    private val PILOT_CANDIDATE_TARGET_CODES = setOf(
      "BS.ASSET.CASH_AND_EQUIVALENTS",
      "BS.ASSET.TRADE_RECEIVABLES",
      "BS.LIABILITY.TRADE_PAYABLES",
      "BS.EQUITY.RETAINED_EARNINGS",
      "PL.REVENUE.OPERATING_REVENUE",
      "PL.EXPENSE.OTHER_OPERATING_EXPENSES"
    )
  }
}

private data class AllowlistedSyntheticDemoFolder(
  val tenantId: UUID,
  val closingFolderId: UUID,
  val importVersion: Int,
  val sourceFileName: String
)
