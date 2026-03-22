package ch.qamwaq.ritomer.imports.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccess
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportDiff
import ch.qamwaq.ritomer.imports.domain.BalanceImportDiffSummary
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.imports.domain.BalanceImportLineChange
import ch.qamwaq.ritomer.imports.domain.BalanceImportSnapshot
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContextProvider
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.multipart.MultipartFile

data class CreatedBalanceImport(
  val balanceImport: BalanceImport,
  val diffSummary: BalanceImportDiffSummary
)

@Service
class BalanceImportService(
  private val closingFolderAccess: ClosingFolderAccess,
  private val balanceImportRepository: BalanceImportRepository,
  private val balanceImportCsvParser: BalanceImportCsvParser,
  private val auditTrail: AuditTrail,
  private val auditCorrelationContextProvider: AuditCorrelationContextProvider
) {
  @Transactional
  fun create(
    access: TenantAccessContext,
    closingFolderId: UUID,
    file: MultipartFile
  ): CreatedBalanceImport {
    requireAnyRole(access, CREATE_ROLES)

    val closingFolder = closingFolderAccess.lockRequired(access.tenantId, closingFolderId)
    if (closingFolder.status != ClosingFolderAccessStatus.DRAFT) {
      logger.warn(
        "Balance import rejected: tenantId={}, closingFolderId={}, reason=closing_folder_archived",
        access.tenantId,
        closingFolderId
      )
      throw BalanceImportConflictException("Closing folder is archived and cannot be imported.")
    }

    val sourceFileName = normalizeSourceFileName(file.originalFilename)
    val parsed = try {
      balanceImportCsvParser.parse(file.bytes)
    } catch (exception: BalanceImportBadRequestException) {
      logger.warn(
        "Balance import rejected: tenantId={}, closingFolderId={}, fileName={}, reason=csv_invalid, errorCount={}",
        access.tenantId,
        closingFolderId,
        sourceFileName,
        exception.errors.size
      )
      throw exception
    }

    val nextVersion = balanceImportRepository.nextVersion(access.tenantId, closingFolderId)
    val previousSnapshot = if (nextVersion == 1) {
      null
    } else {
      balanceImportRepository.findSnapshotByVersion(access.tenantId, closingFolderId, nextVersion - 1)
        ?: error("Previous balance import version ${nextVersion - 1} was not found for closing folder $closingFolderId.")
    }

    val now = OffsetDateTime.now(ZoneOffset.UTC)
    val balanceImport = BalanceImport(
      id = UUID.randomUUID(),
      tenantId = access.tenantId,
      closingFolderId = closingFolderId,
      version = nextVersion,
      sourceFileName = sourceFileName,
      importedAt = now,
      importedByUserId = access.actorUserId,
      rowCount = parsed.rowCount,
      totalDebit = parsed.totalDebit,
      totalCredit = parsed.totalCredit
    )

    val created = balanceImportRepository.create(balanceImport, parsed.lines)
    val diff = diff(created.version, previousSnapshot, parsed.lines)
    val summary = diff.toSummary()

    auditTrail.append(
      AppendAuditEventCommand(
        tenantId = access.tenantId,
        actorUserId = access.actorUserId,
        actorSubject = access.actorSubject,
        actorRoles = access.effectiveRoles,
        correlation = auditCorrelationContextProvider.currentCorrelationContext(),
        action = BALANCE_IMPORT_CREATED_ACTION,
        resourceType = BALANCE_IMPORT_RESOURCE_TYPE,
        resourceId = created.id.toString(),
        metadata = mapOf(
          "closingFolderId" to created.closingFolderId.toString(),
          "importId" to created.id.toString(),
          "version" to created.version,
          "fileName" to created.sourceFileName,
          "rowCount" to created.rowCount,
          "totalDebit" to created.totalDebit.toPlainString(),
          "totalCredit" to created.totalCredit.toPlainString(),
          "diffSummary" to mapOf(
            "previousVersion" to summary.previousVersion,
            "addedCount" to summary.addedCount,
            "removedCount" to summary.removedCount,
            "changedCount" to summary.changedCount
          )
        )
      )
    )

    return CreatedBalanceImport(created, summary)
  }

  fun listVersions(access: TenantAccessContext, closingFolderId: UUID): List<BalanceImport> {
    requireAnyRole(access, READ_ROLES)
    closingFolderAccess.getRequired(access.tenantId, closingFolderId)
    return balanceImportRepository.findVersions(access.tenantId, closingFolderId)
  }

  fun getDiff(access: TenantAccessContext, closingFolderId: UUID, version: Int): BalanceImportDiff {
    requireAnyRole(access, READ_ROLES)
    if (version <= 0) {
      throw BalanceImportBadRequestException(
        "version must be greater than 0.",
        listOf(BalanceImportValidationError(line = null, field = "version", message = "version must be greater than 0."))
      )
    }

    closingFolderAccess.getRequired(access.tenantId, closingFolderId)
    val currentSnapshot = balanceImportRepository.findSnapshotByVersion(access.tenantId, closingFolderId, version)
      ?: throw BalanceImportVersionNotFoundException(version)
    val previousSnapshot = if (version == 1) {
      null
    } else {
      balanceImportRepository.findSnapshotByVersion(access.tenantId, closingFolderId, version - 1)
        ?: error("Previous balance import version ${version - 1} was not found for closing folder $closingFolderId.")
    }

    return diff(currentSnapshot.import.version, previousSnapshot, currentSnapshot.lines)
  }

  private fun diff(
    version: Int,
    previousSnapshot: BalanceImportSnapshot?,
    currentLines: List<BalanceImportLine>
  ): BalanceImportDiff {
    if (previousSnapshot == null) {
      return BalanceImportDiff(
        version = version,
        previousVersion = null,
        added = currentLines.map { it.toApiLine() },
        removed = emptyList(),
        changed = emptyList()
      )
    }

    val previousByAccountCode = previousSnapshot.lines.associateBy { it.accountCode }
    val currentByAccountCode = currentLines.associateBy { it.accountCode }

    val added = currentLines
      .filter { it.accountCode !in previousByAccountCode }
      .map { it.toApiLine() }

    val removed = previousSnapshot.lines
      .filter { it.accountCode !in currentByAccountCode }
      .map { it.toApiLine() }

    val changed = currentLines
      .mapNotNull { current ->
        val previous = previousByAccountCode[current.accountCode] ?: return@mapNotNull null
        if (previous.sameContentAs(current)) {
          null
        } else {
          BalanceImportLineChange(
            accountCode = current.accountCode,
            before = previous.toApiLine(),
            after = current.toApiLine()
          )
        }
      }

    return BalanceImportDiff(
      version = version,
      previousVersion = previousSnapshot.import.version,
      added = added,
      removed = removed,
      changed = changed
    )
  }

  private fun requireAnyRole(access: TenantAccessContext, allowedRoles: Set<String>) {
    if (access.effectiveRoles.none { it in allowedRoles }) {
      throw AccessDeniedException("Insufficient role for balance import operation.")
    }
  }

  private fun normalizeSourceFileName(originalFilename: String?): String =
    originalFilename?.trim()?.takeUnless { it.isEmpty() } ?: "upload.csv"

  private fun BalanceImportDiff.toSummary(): BalanceImportDiffSummary =
    BalanceImportDiffSummary(
      previousVersion = previousVersion,
      addedCount = added.size,
      removedCount = removed.size,
      changedCount = changed.size
    )

  private fun BalanceImportLine.sameContentAs(other: BalanceImportLine): Boolean =
    accountLabel == other.accountLabel &&
      debit.compareTo(other.debit) == 0 &&
      credit.compareTo(other.credit) == 0

  private fun BalanceImportLine.toApiLine(): BalanceImportLine =
    copy(lineNo = 0)

  companion object {
    private val logger = LoggerFactory.getLogger(BalanceImportService::class.java)
    private val CREATE_ROLES = setOf("ACCOUNTANT", "MANAGER", "ADMIN")
    private val READ_ROLES = setOf("ACCOUNTANT", "REVIEWER", "MANAGER", "ADMIN")
  }
}

@ResponseStatus(HttpStatus.CONFLICT)
class BalanceImportConflictException(message: String) : RuntimeException(message)

@ResponseStatus(HttpStatus.NOT_FOUND)
class BalanceImportVersionNotFoundException(version: Int) : RuntimeException("Balance import version not found: $version")
