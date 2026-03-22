package ch.qamwaq.ritomer.closing.application

import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContextProvider
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service

@Service
class ClosingFolderService(
  private val closingFolderRepository: ClosingFolderRepository,
  private val auditTrail: AuditTrail,
  private val auditCorrelationContextProvider: AuditCorrelationContextProvider
) {
  fun create(access: TenantAccessContext, command: CreateClosingFolderCommand): ClosingFolder {
    requireAnyRole(access, CREATE_AND_PATCH_ROLES)

    val normalizedName = normalizeRequiredText(command.name, "name")
    val normalizedExternalRef = normalizeOptionalText(command.externalRef)
    validatePeriodRange(command.periodStartOn, command.periodEndOn)

    val now = OffsetDateTime.now(ZoneOffset.UTC)
    val folder = ClosingFolder(
      id = UUID.randomUUID(),
      tenantId = access.tenantId,
      name = normalizedName,
      periodStartOn = command.periodStartOn,
      periodEndOn = command.periodEndOn,
      externalRef = normalizedExternalRef,
      status = ClosingFolderStatus.DRAFT,
      archivedAt = null,
      archivedByUserId = null,
      createdAt = now,
      updatedAt = now
    )

    val created = closingFolderRepository.create(folder)
    auditTrail.append(
      AppendAuditEventCommand(
        tenantId = access.tenantId,
        actorUserId = access.actorUserId,
        actorSubject = access.actorSubject,
        actorRoles = access.effectiveRoles,
        correlation = auditCorrelationContextProvider.currentCorrelationContext(),
        action = CLOSING_FOLDER_CREATED_ACTION,
        resourceType = CLOSING_FOLDER_RESOURCE_TYPE,
        resourceId = created.id.toString(),
        metadata = mapOf(
          "snapshot" to mapOf(
            "name" to created.name,
            "periodStartOn" to created.periodStartOn.toString(),
            "periodEndOn" to created.periodEndOn.toString(),
            "externalRef" to created.externalRef,
            "status" to created.status.name
          )
        )
      )
    )

    return created
  }

  fun list(access: TenantAccessContext): List<ClosingFolder> {
    requireAnyRole(access, READ_ROLES)
    return closingFolderRepository.findAllByTenantId(access.tenantId)
  }

  fun get(access: TenantAccessContext, folderId: UUID): ClosingFolder {
    requireAnyRole(access, READ_ROLES)
    return findRequiredFolder(access.tenantId, folderId)
  }

  fun patch(
    access: TenantAccessContext,
    folderId: UUID,
    command: PatchClosingFolderCommand
  ): ClosingFolder {
    requireAnyRole(access, CREATE_AND_PATCH_ROLES)
    if (!command.hasAnyPatchableField()) {
      throw ClosingFolderBadRequestException("At least one patchable field is required.")
    }

    val existing = findRequiredFolder(access.tenantId, folderId)
    val patched = existing.copy(
      name = if (command.name.present) normalizeRequiredText(command.name.value, "name") else existing.name,
      periodStartOn = if (command.periodStartOn.present) command.periodStartOn.value ?: invalidField("periodStartOn") else existing.periodStartOn,
      periodEndOn = if (command.periodEndOn.present) command.periodEndOn.value ?: invalidField("periodEndOn") else existing.periodEndOn,
      externalRef = if (command.externalRef.present) normalizeOptionalText(command.externalRef.value) else existing.externalRef,
      updatedAt = OffsetDateTime.now(ZoneOffset.UTC)
    )

    validatePeriodRange(patched.periodStartOn, patched.periodEndOn)
    val changes = changedFields(existing, patched)
    if (changes.isEmpty()) {
      return existing
    }

    val updated = closingFolderRepository.update(patched)
    auditTrail.append(
      AppendAuditEventCommand(
        tenantId = access.tenantId,
        actorUserId = access.actorUserId,
        actorSubject = access.actorSubject,
        actorRoles = access.effectiveRoles,
        correlation = auditCorrelationContextProvider.currentCorrelationContext(),
        action = CLOSING_FOLDER_UPDATED_ACTION,
        resourceType = CLOSING_FOLDER_RESOURCE_TYPE,
        resourceId = updated.id.toString(),
        metadata = mapOf("changes" to changes)
      )
    )

    return updated
  }

  fun archive(access: TenantAccessContext, folderId: UUID): ClosingFolder {
    requireAnyRole(access, ARCHIVE_ROLES)

    val existing = findRequiredFolder(access.tenantId, folderId)
    if (existing.status == ClosingFolderStatus.ARCHIVED) {
      return existing
    }

    val now = OffsetDateTime.now(ZoneOffset.UTC)
    val archived = existing.copy(
      status = ClosingFolderStatus.ARCHIVED,
      archivedAt = now,
      archivedByUserId = access.actorUserId,
      updatedAt = now
    )

    val updated = closingFolderRepository.update(archived)
    auditTrail.append(
      AppendAuditEventCommand(
        tenantId = access.tenantId,
        actorUserId = access.actorUserId,
        actorSubject = access.actorSubject,
        actorRoles = access.effectiveRoles,
        correlation = auditCorrelationContextProvider.currentCorrelationContext(),
        action = CLOSING_FOLDER_ARCHIVED_ACTION,
        resourceType = CLOSING_FOLDER_RESOURCE_TYPE,
        resourceId = updated.id.toString(),
        metadata = mapOf(
          "archivedAt" to updated.archivedAt?.toString(),
          "archivedByUserId" to updated.archivedByUserId?.toString(),
          "status" to mapOf(
            "before" to existing.status.name,
            "after" to updated.status.name
          )
        )
      )
    )

    return updated
  }

  private fun findRequiredFolder(tenantId: UUID, folderId: UUID): ClosingFolder =
    closingFolderRepository.findByIdAndTenantId(folderId, tenantId)
      ?: throw ClosingFolderNotFoundException(folderId)

  private fun validatePeriodRange(periodStartOn: LocalDate, periodEndOn: LocalDate) {
    if (periodEndOn < periodStartOn) {
      throw ClosingFolderBadRequestException("periodEndOn must be greater than or equal to periodStartOn.")
    }
  }

  private fun requireAnyRole(access: TenantAccessContext, allowedRoles: Set<String>) {
    if (access.effectiveRoles.none { it in allowedRoles }) {
      throw AccessDeniedException("Insufficient role for closing folder operation.")
    }
  }

  private fun normalizeRequiredText(value: String?, fieldName: String): String =
    value?.trim()?.takeUnless { it.isEmpty() }
      ?: throw ClosingFolderBadRequestException("$fieldName must not be blank.")

  private fun normalizeOptionalText(value: String?): String? =
    value?.trim()?.takeUnless { it.isEmpty() }

  private fun invalidField(fieldName: String): Nothing =
    throw ClosingFolderBadRequestException("$fieldName is invalid.")

  private fun changedFields(
    before: ClosingFolder,
    after: ClosingFolder
  ): Map<String, Map<String, String?>> {
    val changes = linkedMapOf<String, Map<String, String?>>()

    if (before.name != after.name) {
      changes["name"] = change(before.name, after.name)
    }
    if (before.periodStartOn != after.periodStartOn) {
      changes["periodStartOn"] = change(before.periodStartOn.toString(), after.periodStartOn.toString())
    }
    if (before.periodEndOn != after.periodEndOn) {
      changes["periodEndOn"] = change(before.periodEndOn.toString(), after.periodEndOn.toString())
    }
    if (before.externalRef != after.externalRef) {
      changes["externalRef"] = change(before.externalRef, after.externalRef)
    }

    return changes
  }

  private fun change(before: String?, after: String?): Map<String, String?> =
    mapOf("before" to before, "after" to after)

  companion object {
    private val READ_ROLES = setOf("ACCOUNTANT", "REVIEWER", "MANAGER", "ADMIN")
    private val CREATE_AND_PATCH_ROLES = setOf("ACCOUNTANT", "MANAGER", "ADMIN")
    private val ARCHIVE_ROLES = setOf("MANAGER", "ADMIN")
  }
}
