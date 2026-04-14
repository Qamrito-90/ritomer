package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccess
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessNotFoundException
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessView
import ch.qamwaq.ritomer.closing.application.ClosingFolderRepository
import ch.qamwaq.ritomer.exports.application.ExportPackAlreadyExistsException
import ch.qamwaq.ritomer.exports.application.ExportPackRepository
import ch.qamwaq.ritomer.exports.domain.ExportPack
import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.identity.application.AppUserRepository
import ch.qamwaq.ritomer.identity.application.TenantMembershipRepository
import ch.qamwaq.ritomer.identity.domain.AppUser
import ch.qamwaq.ritomer.identity.domain.TenantMembershipGrant
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.imports.application.BalanceImportRepository
import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.imports.domain.BalanceImportSnapshot
import ch.qamwaq.ritomer.mapping.application.ManualMappingRepository
import ch.qamwaq.ritomer.mapping.domain.ManualMapping
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import ch.qamwaq.ritomer.workpapers.application.DocumentRepository
import ch.qamwaq.ritomer.workpapers.application.WorkpaperRepository
import ch.qamwaq.ritomer.workpapers.domain.Document
import ch.qamwaq.ritomer.workpapers.domain.Workpaper
import java.util.UUID
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.TransactionStatus
import org.springframework.transaction.support.SimpleTransactionStatus
import org.springframework.transaction.support.TransactionTemplate

@TestConfiguration(proxyBeanMethods = false)
class IdentityTestConfiguration {
  @Bean
  fun identityTestStore(): IdentityTestStore = IdentityTestStore()

  @Bean
  fun appUserRepository(identityTestStore: IdentityTestStore): AppUserRepository =
    InMemoryAppUserRepository(identityTestStore)

  @Bean
  fun tenantMembershipRepository(identityTestStore: IdentityTestStore): TenantMembershipRepository =
    InMemoryTenantMembershipRepository(identityTestStore)

  @Bean
  fun auditTestStore(): AuditTestStore = AuditTestStore()

  @Bean
  fun auditTrail(auditTestStore: AuditTestStore): AuditTrail =
    InMemoryAuditTrail(auditTestStore)

  @Bean
  fun closingFolderTestStore(): ClosingFolderTestStore = ClosingFolderTestStore()

  @Bean
  fun closingFolderRepository(closingFolderTestStore: ClosingFolderTestStore): ClosingFolderRepository =
    InMemoryClosingFolderRepository(closingFolderTestStore)

  @Bean
  fun closingFolderAccess(closingFolderTestStore: ClosingFolderTestStore): ClosingFolderAccess =
    InMemoryClosingFolderAccess(closingFolderTestStore)

  @Bean
  fun balanceImportTestStore(): BalanceImportTestStore = BalanceImportTestStore()

  @Bean
  fun balanceImportRepository(balanceImportTestStore: BalanceImportTestStore): BalanceImportRepository =
    InMemoryBalanceImportRepository(balanceImportTestStore)

  @Bean
  fun manualMappingTestStore(): ManualMappingTestStore = ManualMappingTestStore()

  @Bean
  fun manualMappingRepository(manualMappingTestStore: ManualMappingTestStore): ManualMappingRepository =
    InMemoryManualMappingRepository(manualMappingTestStore)

  @Bean
  fun workpaperTestStore(): WorkpaperTestStore = WorkpaperTestStore()

  @Bean
  fun workpaperRepository(workpaperTestStore: WorkpaperTestStore): WorkpaperRepository =
    InMemoryWorkpaperRepository(workpaperTestStore)

  @Bean
  fun documentTestStore(): DocumentTestStore = DocumentTestStore()

  @Bean
  fun documentRepository(
    documentTestStore: DocumentTestStore,
    workpaperTestStore: WorkpaperTestStore
  ): DocumentRepository =
    InMemoryDocumentRepository(documentTestStore, workpaperTestStore)

  @Bean
  fun transactionTemplate(): TransactionTemplate =
    TransactionTemplate(NoOpPlatformTransactionManager())

  @Bean
  fun exportPackTestStore(): ExportPackTestStore = ExportPackTestStore()

  @Bean
  fun exportPackRepository(exportPackTestStore: ExportPackTestStore): ExportPackRepository =
    InMemoryExportPackRepository(exportPackTestStore)
}

class IdentityTestStore {
  private val usersBySubject = linkedMapOf<String, AppUser>()
  private val membershipsByUserId = linkedMapOf<UUID, MutableList<StoredTenantMembershipGrant>>()

  fun reset() {
    usersBySubject.clear()
    membershipsByUserId.clear()
  }

  fun userCount(): Int = usersBySubject.size

  fun findUserBySubject(externalSubject: String): AppUser? = usersBySubject[externalSubject]

  fun saveUser(appUser: AppUser) {
    usersBySubject[appUser.externalSubject] = appUser
  }

  fun seedUser(
    externalSubject: String,
    status: String = AppUser.ACTIVE_STATUS,
    email: String? = null,
    displayName: String? = null
  ): AppUser {
    val appUser = AppUser(
      id = UUID.randomUUID(),
      externalSubject = externalSubject,
      email = email,
      displayName = displayName,
      status = status
    )
    saveUser(appUser)
    return appUser
  }

  fun findUserById(userId: UUID): AppUser? = usersBySubject.values.firstOrNull { it.id == userId }

  fun membershipGrantsForUser(userId: UUID): List<TenantMembershipGrant> =
    membershipsByUserId[userId].orEmpty()
      .filter { it.membershipStatus.equals(AppUser.ACTIVE_STATUS, ignoreCase = true) }
      .filter { it.tenantStatus.equals(AppUser.ACTIVE_STATUS, ignoreCase = true) }
      .map { it.grant }

  fun seedActiveMembership(
    externalSubject: String,
    tenantId: UUID,
    tenantSlug: String,
    tenantName: String,
    vararg roles: TenantRole
  ) {
    seedMembership(
      externalSubject,
      tenantId,
      tenantSlug,
      tenantName,
      AppUser.ACTIVE_STATUS,
      AppUser.ACTIVE_STATUS,
      AppUser.ACTIVE_STATUS,
      *roles
    )
  }

  fun seedMembership(
    externalSubject: String,
    tenantId: UUID,
    tenantSlug: String,
    tenantName: String,
    membershipStatus: String = AppUser.ACTIVE_STATUS,
    tenantStatus: String = AppUser.ACTIVE_STATUS,
    userStatus: String = AppUser.ACTIVE_STATUS,
    vararg roles: TenantRole
  ) {
    val user = usersBySubject[externalSubject]
      ?: seedUser(externalSubject = externalSubject, status = userStatus)

    val grants = membershipsByUserId.getOrPut(user.id) { mutableListOf() }
    roles.forEach { role ->
      grants.add(
        StoredTenantMembershipGrant(
          grant = TenantMembershipGrant(
            tenantId = tenantId,
            tenantSlug = tenantSlug,
            tenantName = tenantName,
            role = role
          ),
          membershipStatus = membershipStatus,
          tenantStatus = tenantStatus
        )
      )
    }
  }
}

private data class StoredTenantMembershipGrant(
  val grant: TenantMembershipGrant,
  val membershipStatus: String,
  val tenantStatus: String
)

class AuditTestStore {
  private val recordedEvents = mutableListOf<RecordedAuditEvent>()

  fun reset() {
    recordedEvents.clear()
  }

  fun record(event: RecordedAuditEvent) {
    recordedEvents.add(event)
  }

  fun auditEvents(): List<RecordedAuditEvent> = recordedEvents.toList()
}

class ClosingFolderTestStore {
  private val foldersById = linkedMapOf<UUID, ClosingFolder>()

  fun reset() {
    foldersById.clear()
  }

  fun save(folder: ClosingFolder) {
    foldersById[folder.id] = folder
  }

  fun findById(id: UUID): ClosingFolder? = foldersById[id]

  fun foldersForTenant(tenantId: UUID): List<ClosingFolder> =
    foldersById.values
      .filter { it.tenantId == tenantId }
      .sortedWith(compareByDescending<ClosingFolder> { it.periodEndOn }.thenByDescending { it.createdAt }.thenByDescending { it.id })
}

class BalanceImportTestStore {
  private val snapshotsByImportId = linkedMapOf<UUID, BalanceImportSnapshot>()

  fun reset() {
    snapshotsByImportId.clear()
  }

  fun save(snapshot: BalanceImportSnapshot) {
    snapshotsByImportId[snapshot.import.id] = snapshot
  }

  fun nextVersion(tenantId: UUID, closingFolderId: UUID): Int =
    snapshotsByImportId.values
      .asSequence()
      .filter { it.import.tenantId == tenantId && it.import.closingFolderId == closingFolderId }
      .maxOfOrNull { it.import.version }
      ?.plus(1)
      ?: 1

  fun versions(tenantId: UUID, closingFolderId: UUID): List<BalanceImport> =
    snapshotsByImportId.values
      .asSequence()
      .filter { it.import.tenantId == tenantId && it.import.closingFolderId == closingFolderId }
      .map { it.import }
      .sortedByDescending { it.version }
      .toList()

  fun snapshot(tenantId: UUID, closingFolderId: UUID, version: Int): BalanceImportSnapshot? =
    snapshotsByImportId.values.firstOrNull {
      it.import.tenantId == tenantId &&
        it.import.closingFolderId == closingFolderId &&
        it.import.version == version
    }
}

class ManualMappingTestStore {
  private val mappingsById = linkedMapOf<UUID, ManualMapping>()

  fun reset() {
    mappingsById.clear()
  }

  fun save(mapping: ManualMapping) {
    mappingsById[mapping.id] = mapping
  }

  fun delete(id: UUID) {
    mappingsById.remove(id)
  }

  fun deleteByAccountCode(tenantId: UUID, closingFolderId: UUID, accountCode: String) {
    val matchingIds = mappingsById.values
      .filter {
        it.tenantId == tenantId &&
          it.closingFolderId == closingFolderId &&
          it.accountCode == accountCode
      }
      .map { it.id }

    matchingIds.forEach(mappingsById::remove)
  }

  fun mappings(tenantId: UUID, closingFolderId: UUID): List<ManualMapping> =
    mappingsById.values
      .filter { it.tenantId == tenantId && it.closingFolderId == closingFolderId }
      .sortedBy { it.accountCode }

  fun findByAccountCode(tenantId: UUID, closingFolderId: UUID, accountCode: String): ManualMapping? =
    mappingsById.values.firstOrNull {
      it.tenantId == tenantId &&
        it.closingFolderId == closingFolderId &&
        it.accountCode == accountCode
    }
}

class WorkpaperTestStore {
  private val workpapersById = linkedMapOf<UUID, Workpaper>()

  fun reset() {
    workpapersById.clear()
  }

  fun save(workpaper: Workpaper) {
    workpapersById[workpaper.id] = workpaper
  }

  fun workpapers(tenantId: UUID, closingFolderId: UUID): List<Workpaper> =
    workpapersById.values
      .filter { it.tenantId == tenantId && it.closingFolderId == closingFolderId }
      .sortedBy { it.anchorCode }

  fun findByAnchorCode(tenantId: UUID, closingFolderId: UUID, anchorCode: String): Workpaper? =
    workpapersById.values.firstOrNull {
      it.tenantId == tenantId &&
        it.closingFolderId == closingFolderId &&
        it.anchorCode == anchorCode
    }

  fun findById(id: UUID): Workpaper? = workpapersById[id]
}

class DocumentTestStore {
  private val documentsById = linkedMapOf<UUID, Document>()

  fun reset() {
    documentsById.clear()
  }

  fun save(document: Document) {
    documentsById[document.id] = document
  }

  fun documentsForWorkpaper(tenantId: UUID, workpaperId: UUID): List<Document> =
    documentsById.values
      .filter { it.tenantId == tenantId && it.workpaperId == workpaperId }
      .sortedWith(compareByDescending<Document> { it.createdAt }.thenByDescending { it.id })

  fun findById(id: UUID): Document? = documentsById[id]

  fun all(): List<Document> = documentsById.values.toList()
}

class ExportPackTestStore {
  private val exportPacksById = linkedMapOf<UUID, ExportPack>()

  @Synchronized
  fun reset() {
    exportPacksById.clear()
  }

  @Synchronized
  fun create(exportPack: ExportPack): ExportPack {
    val duplicate = exportPacksById.values.any {
      it.tenantId == exportPack.tenantId &&
        it.closingFolderId == exportPack.closingFolderId &&
        it.idempotencyKey == exportPack.idempotencyKey
    }
    if (duplicate) {
      throw ExportPackAlreadyExistsException("export_pack already exists for the same idempotency key.")
    }
    exportPacksById[exportPack.id] = exportPack
    return exportPack
  }

  @Synchronized
  fun findByIdempotencyKey(tenantId: UUID, closingFolderId: UUID, idempotencyKey: String): ExportPack? =
    exportPacksById.values.firstOrNull {
      it.tenantId == tenantId &&
        it.closingFolderId == closingFolderId &&
        it.idempotencyKey == idempotencyKey
    }

  @Synchronized
  fun findById(tenantId: UUID, closingFolderId: UUID, exportPackId: UUID): ExportPack? =
    exportPacksById[exportPackId]?.takeIf {
      it.tenantId == tenantId &&
        it.closingFolderId == closingFolderId
    }

  @Synchronized
  fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): List<ExportPack> =
    exportPacksById.values
      .filter { it.tenantId == tenantId && it.closingFolderId == closingFolderId }
      .sortedWith(compareByDescending<ExportPack> { it.createdAt }.thenByDescending { it.id })
}

data class RecordedAuditEvent(
  val id: UUID,
  val command: AppendAuditEventCommand
)

private class InMemoryAppUserRepository(
  private val identityTestStore: IdentityTestStore
) : AppUserRepository {
  override fun findByExternalSubject(externalSubject: String): AppUser? =
    identityTestStore.findUserBySubject(externalSubject)

  override fun create(externalSubject: String, email: String?, displayName: String?): AppUser {
    val appUser = AppUser(
      id = UUID.randomUUID(),
      externalSubject = externalSubject,
      email = email,
      displayName = displayName,
      status = AppUser.ACTIVE_STATUS
    )
    identityTestStore.saveUser(appUser)
    return appUser
  }

  override fun updateProfile(userId: UUID, email: String?, displayName: String?): AppUser {
    val existing = identityTestStore.findUserById(userId)
      ?: error("Unknown app_user id: $userId")
    val updated = existing.copy(email = email, displayName = displayName)
    identityTestStore.saveUser(updated)
    return updated
  }
}

private class InMemoryTenantMembershipRepository(
  private val identityTestStore: IdentityTestStore
) : TenantMembershipRepository {
  override fun findActiveMembershipGrants(userId: UUID): List<TenantMembershipGrant> =
    identityTestStore.membershipGrantsForUser(userId)
}

private class InMemoryAuditTrail(
  private val auditTestStore: AuditTestStore
) : AuditTrail {
  override fun append(command: AppendAuditEventCommand): UUID {
    val auditEventId = UUID.randomUUID()
    auditTestStore.record(RecordedAuditEvent(auditEventId, command))
    return auditEventId
  }
}

private class InMemoryClosingFolderRepository(
  private val closingFolderTestStore: ClosingFolderTestStore
) : ClosingFolderRepository {
  override fun create(folder: ClosingFolder): ClosingFolder {
    closingFolderTestStore.save(folder)
    return folder
  }

  override fun findAllByTenantId(tenantId: UUID): List<ClosingFolder> =
    closingFolderTestStore.foldersForTenant(tenantId)

  override fun findByIdAndTenantId(id: UUID, tenantId: UUID): ClosingFolder? =
    closingFolderTestStore.findById(id)?.takeIf { it.tenantId == tenantId }

  override fun update(folder: ClosingFolder): ClosingFolder {
    val existing = closingFolderTestStore.findById(folder.id) ?: error("Unknown closing folder id: ${folder.id}")
    if (existing.tenantId != folder.tenantId) {
      error("Tenant mismatch for closing folder update: ${folder.id}")
    }

    closingFolderTestStore.save(folder)
    return folder
  }
}

private class InMemoryClosingFolderAccess(
  private val closingFolderTestStore: ClosingFolderTestStore
) : ClosingFolderAccess {
  override fun getRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView =
    findRequired(tenantId, closingFolderId)

  override fun lockRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView =
    findRequired(tenantId, closingFolderId)

  private fun findRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView {
    val folder = closingFolderTestStore.findById(closingFolderId)?.takeIf { it.tenantId == tenantId }
      ?: throw ClosingFolderAccessNotFoundException(closingFolderId)

    return ClosingFolderAccessView(
      id = folder.id,
      tenantId = folder.tenantId,
      status = ClosingFolderAccessStatus.fromDomain(folder.status)
    )
  }
}

private class InMemoryBalanceImportRepository(
  private val balanceImportTestStore: BalanceImportTestStore
) : BalanceImportRepository {
  override fun nextVersion(tenantId: UUID, closingFolderId: UUID): Int =
    balanceImportTestStore.nextVersion(tenantId, closingFolderId)

  override fun create(balanceImport: BalanceImport, lines: List<BalanceImportLine>): BalanceImport {
    balanceImportTestStore.save(BalanceImportSnapshot(balanceImport, lines))
    return balanceImport
  }

  override fun findVersions(tenantId: UUID, closingFolderId: UUID): List<BalanceImport> =
    balanceImportTestStore.versions(tenantId, closingFolderId)

  override fun findSnapshotByVersion(
    tenantId: UUID,
    closingFolderId: UUID,
    version: Int
  ): BalanceImportSnapshot? =
    balanceImportTestStore.snapshot(tenantId, closingFolderId, version)
}

private class InMemoryManualMappingRepository(
  private val manualMappingTestStore: ManualMappingTestStore
) : ManualMappingRepository {
  override fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): List<ManualMapping> =
    manualMappingTestStore.mappings(tenantId, closingFolderId)

  override fun findByAccountCode(tenantId: UUID, closingFolderId: UUID, accountCode: String): ManualMapping? =
    manualMappingTestStore.findByAccountCode(tenantId, closingFolderId, accountCode)

  override fun create(mapping: ManualMapping): ManualMapping {
    manualMappingTestStore.save(mapping)
    return mapping
  }

  override fun update(mapping: ManualMapping): ManualMapping {
    manualMappingTestStore.save(mapping)
    return mapping
  }

  override fun delete(tenantId: UUID, mappingId: UUID) {
    manualMappingTestStore.delete(mappingId)
  }
}

private class InMemoryWorkpaperRepository(
  private val workpaperTestStore: WorkpaperTestStore
) : WorkpaperRepository {
  override fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): List<Workpaper> =
    workpaperTestStore.workpapers(tenantId, closingFolderId)

  override fun findByAnchorCode(tenantId: UUID, closingFolderId: UUID, anchorCode: String): Workpaper? =
    workpaperTestStore.findByAnchorCode(tenantId, closingFolderId, anchorCode)

  override fun findById(tenantId: UUID, workpaperId: UUID): Workpaper? =
    workpaperTestStore.findById(workpaperId)?.takeIf { it.tenantId == tenantId }

  override fun create(workpaper: Workpaper): Workpaper {
    workpaperTestStore.save(workpaper)
    return workpaper
  }

  override fun update(workpaper: Workpaper): Workpaper {
    workpaperTestStore.save(workpaper)
    return workpaper
  }
}

private class InMemoryDocumentRepository(
  private val documentTestStore: DocumentTestStore,
  private val workpaperTestStore: WorkpaperTestStore
) : DocumentRepository {
  override fun create(document: Document): Document {
    documentTestStore.save(document)
    return document
  }

  override fun updateVerification(document: Document): Document {
    documentTestStore.save(document)
    return document
  }

  override fun findByWorkpaper(tenantId: UUID, workpaperId: UUID): List<Document> =
    documentTestStore.documentsForWorkpaper(tenantId, workpaperId)

  override fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): Map<UUID, List<Document>> =
    documentTestStore.all()
      .asSequence()
      .filter { it.tenantId == tenantId }
      .filter { document ->
        workpaperTestStore.findById(document.workpaperId)?.closingFolderId == closingFolderId
      }
      .sortedWith(compareBy<Document> { it.workpaperId }.thenByDescending { it.createdAt }.thenByDescending { it.id })
      .groupBy { it.workpaperId }

  override fun findByIdWithinClosingFolder(tenantId: UUID, closingFolderId: UUID, documentId: UUID): Document? =
    documentTestStore.findById(documentId)
      ?.takeIf { it.tenantId == tenantId }
      ?.takeIf { document ->
        workpaperTestStore.findById(document.workpaperId)?.closingFolderId == closingFolderId
      }
}

private class InMemoryExportPackRepository(
  private val exportPackTestStore: ExportPackTestStore
) : ExportPackRepository {
  override fun findByIdempotencyKey(tenantId: UUID, closingFolderId: UUID, idempotencyKey: String): ExportPack? =
    exportPackTestStore.findByIdempotencyKey(tenantId, closingFolderId, idempotencyKey)

  override fun findById(tenantId: UUID, closingFolderId: UUID, exportPackId: UUID): ExportPack? =
    exportPackTestStore.findById(tenantId, closingFolderId, exportPackId)

  override fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): List<ExportPack> =
    exportPackTestStore.findByClosingFolder(tenantId, closingFolderId)

  override fun create(exportPack: ExportPack): ExportPack =
    exportPackTestStore.create(exportPack)
}

private class NoOpPlatformTransactionManager : PlatformTransactionManager {
  override fun getTransaction(definition: TransactionDefinition?): TransactionStatus =
    SimpleTransactionStatus()

  override fun commit(status: TransactionStatus) = Unit

  override fun rollback(status: TransactionStatus) = Unit
}
