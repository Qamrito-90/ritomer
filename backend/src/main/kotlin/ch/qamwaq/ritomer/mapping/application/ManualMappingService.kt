package ch.qamwaq.ritomer.mapping.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccess
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.mapping.access.ManualMappingAccess
import ch.qamwaq.ritomer.mapping.domain.ManualMapping
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContextProvider
import ch.qamwaq.ritomer.shared.application.AuditTrail
import java.math.BigDecimal
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.ResponseStatus

data class ManualMappingProjection(
  val closingFolderId: UUID,
  val latestImportVersion: Int?,
  val targets: List<ManualMappingTarget>,
  val lines: List<ManualMappingLineProjection>,
  val mappings: List<ManualMappingEntry>,
  val summary: ManualMappingSummary
)

data class ManualMappingLineProjection(
  val accountCode: String,
  val accountLabel: String,
  val debit: BigDecimal,
  val credit: BigDecimal
)

data class ManualMappingEntry(
  val accountCode: String,
  val targetCode: String
)

data class ManualMappingSummary(
  val total: Int,
  val mapped: Int,
  val unmapped: Int
)

data class ManualMappingUpsertCommand(
  val accountCode: String,
  val targetCode: String
)

data class ManualMappingUpsertResult(
  val mapping: ManualMappingEntry,
  val outcome: ManualMappingUpsertOutcome
)

enum class ManualMappingUpsertOutcome {
  CREATED,
  UPDATED,
  NOOP
}

@Service
class ManualMappingService(
  private val closingFolderAccess: ClosingFolderAccess,
  private val manualMappingAccess: ManualMappingAccess,
  private val manualMappingRepository: ManualMappingRepository,
  private val manualMappingTargetCatalog: ManualMappingTargetCatalog,
  private val auditTrail: AuditTrail,
  private val auditCorrelationContextProvider: AuditCorrelationContextProvider
) {
  fun getProjection(access: TenantAccessContext, closingFolderId: UUID): ManualMappingProjection {
    requireAnyRole(access, READ_ROLES)
    closingFolderAccess.getRequired(access.tenantId, closingFolderId)

    val targets = manualMappingTargetCatalog.all()
    val projection = manualMappingAccess.getCurrentProjection(access.tenantId, closingFolderId)
    return ManualMappingProjection(
      closingFolderId = closingFolderId,
      latestImportVersion = projection.latestImportVersion,
      targets = targets,
      lines = projection.lines.map {
        ManualMappingLineProjection(
          accountCode = it.accountCode,
          accountLabel = it.accountLabel,
          debit = it.debit,
          credit = it.credit
        )
      },
      mappings = projection.mappings.map {
        ManualMappingEntry(
          accountCode = it.accountCode,
          targetCode = it.targetCode
        )
      },
      summary = ManualMappingSummary(
        total = projection.summary.total,
        mapped = projection.summary.mapped,
        unmapped = projection.summary.unmapped
      )
    )
  }

  @Transactional
  fun upsert(
    access: TenantAccessContext,
    closingFolderId: UUID,
    command: ManualMappingUpsertCommand
  ): ManualMappingUpsertResult {
    requireAnyRole(access, WRITE_ROLES)

    val accountCode = normalizeRequired(command.accountCode, "accountCode")
    val targetCode = normalizeRequired(command.targetCode, "targetCode")

    val closingFolder = closingFolderAccess.lockRequired(access.tenantId, closingFolderId)
    if (closingFolder.status == ClosingFolderAccessStatus.ARCHIVED) {
      throw ManualMappingConflictException("Closing folder is archived and manual mappings cannot be modified.")
    }

    val projection = manualMappingAccess.getCurrentProjection(access.tenantId, closingFolderId)
    val latestImportVersion = projection.latestImportVersion
      ?: throw ManualMappingConflictException("No balance import is available for manual mapping.")

    if (projection.lines.none { it.accountCode == accountCode }) {
      throw ManualMappingBadRequestException("accountCode is not present in the latest import.")
    }
    if (manualMappingTargetCatalog.all().none { it.code == targetCode }) {
      throw ManualMappingBadRequestException("targetCode is unknown.")
    }

    val existing = manualMappingRepository.findByAccountCode(access.tenantId, closingFolderId, accountCode)
    if (existing == null) {
      val now = OffsetDateTime.now(ZoneOffset.UTC)
      val created = manualMappingRepository.create(
        ManualMapping(
          id = UUID.randomUUID(),
          tenantId = access.tenantId,
          closingFolderId = closingFolderId,
          accountCode = accountCode,
          targetCode = targetCode,
          createdAt = now,
          updatedAt = now,
          createdByUserId = access.actorUserId,
          updatedByUserId = access.actorUserId
        )
      )
      appendAudit(access, latestImportVersion, created, MANUAL_MAPPING_CREATED_ACTION, before = null, after = created.targetCode)
      return ManualMappingUpsertResult(created.toEntry(), ManualMappingUpsertOutcome.CREATED)
    }

    if (existing.targetCode == targetCode) {
      return ManualMappingUpsertResult(existing.toEntry(), ManualMappingUpsertOutcome.NOOP)
    }

    val updated = manualMappingRepository.update(
      existing.copy(
        targetCode = targetCode,
        updatedAt = OffsetDateTime.now(ZoneOffset.UTC),
        updatedByUserId = access.actorUserId
      )
    )
    appendAudit(access, latestImportVersion, updated, MANUAL_MAPPING_UPDATED_ACTION, before = existing.targetCode, after = updated.targetCode)
    return ManualMappingUpsertResult(updated.toEntry(), ManualMappingUpsertOutcome.UPDATED)
  }

  @Transactional
  fun delete(
    access: TenantAccessContext,
    closingFolderId: UUID,
    accountCode: String?
  ) {
    requireAnyRole(access, WRITE_ROLES)
    val normalizedAccountCode = normalizeRequired(accountCode, "accountCode")

    val closingFolder = closingFolderAccess.lockRequired(access.tenantId, closingFolderId)
    if (closingFolder.status == ClosingFolderAccessStatus.ARCHIVED) {
      throw ManualMappingConflictException("Closing folder is archived and manual mappings cannot be modified.")
    }

    val latestImportVersion = manualMappingAccess.getCurrentProjection(access.tenantId, closingFolderId).latestImportVersion
      ?: throw ManualMappingConflictException("No balance import is available for manual mapping.")

    val existing = manualMappingRepository.findByAccountCode(access.tenantId, closingFolderId, normalizedAccountCode) ?: return
    manualMappingRepository.delete(access.tenantId, existing.id)
    appendAudit(access, latestImportVersion, existing, MANUAL_MAPPING_DELETED_ACTION, before = existing.targetCode, after = null)
  }

  private fun appendAudit(
    access: TenantAccessContext,
    latestImportVersion: Int,
    mapping: ManualMapping,
    action: String,
    before: String?,
    after: String?
  ) {
    auditTrail.append(
      AppendAuditEventCommand(
        tenantId = access.tenantId,
        actorUserId = access.actorUserId,
        actorSubject = access.actorSubject,
        actorRoles = access.effectiveRoles,
        correlation = auditCorrelationContextProvider.currentCorrelationContext(),
        action = action,
        resourceType = MANUAL_MAPPING_RESOURCE_TYPE,
        resourceId = mapping.id.toString(),
        metadata = mapOf(
          "closingFolderId" to mapping.closingFolderId.toString(),
          "accountCode" to mapping.accountCode,
          "targetCode" to mapOf(
            "before" to before,
            "after" to after
          ),
          "latestImportVersion" to latestImportVersion
        )
      )
    )
  }

  private fun requireAnyRole(access: TenantAccessContext, allowedRoles: Set<String>) {
    if (access.effectiveRoles.none { it in allowedRoles }) {
      throw AccessDeniedException("Insufficient role for manual mapping operation.")
    }
  }

  private fun normalizeRequired(rawValue: String?, fieldName: String): String =
    rawValue?.trim()?.takeUnless { it.isEmpty() }
      ?: throw ManualMappingBadRequestException("$fieldName must not be blank.")

  private fun ManualMapping.toEntry(): ManualMappingEntry =
    ManualMappingEntry(
      accountCode = accountCode,
      targetCode = targetCode
    )

  companion object {
    private val READ_ROLES = setOf("ACCOUNTANT", "REVIEWER", "MANAGER", "ADMIN")
    private val WRITE_ROLES = setOf("ACCOUNTANT", "MANAGER", "ADMIN")
  }
}

@ResponseStatus(HttpStatus.BAD_REQUEST)
class ManualMappingBadRequestException(message: String) : RuntimeException(message)

@ResponseStatus(HttpStatus.CONFLICT)
class ManualMappingConflictException(message: String) : RuntimeException(message)
