package ch.qamwaq.ritomer.exports.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccess
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessView
import ch.qamwaq.ritomer.controls.access.ControlResultReadModel
import ch.qamwaq.ritomer.controls.access.ControlsMappingSummaryReadModel
import ch.qamwaq.ritomer.controls.access.ControlsNextActionReadModel
import ch.qamwaq.ritomer.controls.access.ControlsReadModel
import ch.qamwaq.ritomer.controls.access.ControlsReadModelAccess
import ch.qamwaq.ritomer.exports.domain.ExportPack
import ch.qamwaq.ritomer.financials.access.BalanceSheetSummaryReadModel
import ch.qamwaq.ritomer.financials.access.FinancialSummaryBlockerReadModel
import ch.qamwaq.ritomer.financials.access.FinancialSummaryCoverageReadModel
import ch.qamwaq.ritomer.financials.access.FinancialSummaryNextActionReadModel
import ch.qamwaq.ritomer.financials.access.FinancialSummaryReadModel
import ch.qamwaq.ritomer.financials.access.FinancialSummaryReadModelAccess
import ch.qamwaq.ritomer.financials.access.IncomeStatementSummaryReadModel
import ch.qamwaq.ritomer.financials.access.StructuredBalanceSheetReadModel
import ch.qamwaq.ritomer.financials.access.StructuredBalanceSheetTotalsReadModel
import ch.qamwaq.ritomer.financials.access.StructuredFinancialBlockerReadModel
import ch.qamwaq.ritomer.financials.access.StructuredFinancialCoverageReadModel
import ch.qamwaq.ritomer.financials.access.StructuredFinancialNextActionReadModel
import ch.qamwaq.ritomer.financials.access.StructuredFinancialStatementsReadModel
import ch.qamwaq.ritomer.financials.access.StructuredFinancialStatementsReadModelAccess
import ch.qamwaq.ritomer.financials.access.StructuredIncomeStatementReadModel
import ch.qamwaq.ritomer.financials.access.StructuredIncomeStatementTotalsReadModel
import ch.qamwaq.ritomer.financials.access.StructuredStatementBreakdownReadModel
import ch.qamwaq.ritomer.financials.access.StructuredStatementGroupReadModel
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContext
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContextProvider
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.workpapers.access.CurrentDocumentReadModel
import ch.qamwaq.ritomer.workpapers.access.CurrentDocumentVerificationSummaryReadModel
import ch.qamwaq.ritomer.workpapers.access.CurrentPersistedWorkpaperReadModel
import ch.qamwaq.ritomer.workpapers.access.CurrentWorkpaperEvidenceReadModel
import ch.qamwaq.ritomer.workpapers.access.CurrentWorkpapersBlockerReadModel
import ch.qamwaq.ritomer.workpapers.access.CurrentWorkpapersNextActionReadModel
import ch.qamwaq.ritomer.workpapers.access.CurrentWorkpapersReadModel
import ch.qamwaq.ritomer.workpapers.access.CurrentWorkpapersSummaryCountsReadModel
import ch.qamwaq.ritomer.workpapers.access.SelectedDocumentBinary
import ch.qamwaq.ritomer.workpapers.access.WorkpapersExportAccess
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import java.io.ByteArrayInputStream
import java.time.OffsetDateTime
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.zip.ZipInputStream
import kotlin.test.assertFailsWith
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.TransactionStatus
import org.springframework.transaction.support.SimpleTransactionStatus
import org.springframework.transaction.support.TransactionTemplate

class ExportPackServiceTest {
  private val objectMapper = ObjectMapper().registerKotlinModule()
  private val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
  private val actorUserId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
  private val closingFolderId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
  private val workpaperId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc")
  private val documentId = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd")
  private val evidenceId = UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")

  @Test
  fun `first successful generation persists one pack, emits one audit and writes expected archive`() {
    val exportPackRepository = FakeExportPackRepository()
    val storage = RecordingExportPackStorage()
    val auditTrail = RecordingExportAuditTrail()
    val service = service(
      exportPackRepository = exportPackRepository,
      storage = storage,
      auditTrail = auditTrail
    )

    val result = service.createExportPack(makerAccess(), closingFolderId, " export-key-1 ")

    assertThat(result.outcome).isEqualTo(CreateExportPackOutcome.CREATED)
    assertThat(exportPackRepository.exportPacks()).hasSize(1)
    assertThat(storage.storeCount).isEqualTo(1)
    assertThat(auditTrail.commands).hasSize(1)
    assertThat(auditTrail.commands.single().action).isEqualTo(EXPORT_PACK_CREATED_ACTION)

    val archiveEntries = unzip(storage.storedBytes.values.single())
    assertThat(archiveEntries.keys).containsExactly(
      "documents/$workpaperId/${documentId}-report_Q4_.pdf",
      "manifest.json",
      "read-models/controls.json",
      "read-models/financial-statements-structured.json",
      "read-models/financial-summary.json",
      "read-models/workpapers-current.json"
    )
    val manifestJson = String(archiveEntries.getValue("manifest.json"))
    assertThat(manifestJson).doesNotContain("storage_object_key")
    assertThat(manifestJson).contains("report_Q4_.pdf")
    assertThat(manifestJson).contains("\"verificationStatus\":\"VERIFIED\"")
    assertThat(String(archiveEntries.getValue("documents/$workpaperId/${documentId}-report_Q4_.pdf"))).isEqualTo("support-bytes")

    val workpapersCurrentJson = String(archiveEntries.getValue("read-models/workpapers-current.json"))
    assertThat(workpapersCurrentJson).doesNotContain("staleWorkpapers")
    assertThat(workpapersCurrentJson).contains(workpaperId.toString())
  }

  @Test
  fun `replay returns same pack after archived transition and readiness loss`() {
    val closingFolderAccess = MutableClosingFolderAccess()
    val controlsAccess = MutableControlsReadModelAccess()
    val service = service(
      closingFolderAccess = closingFolderAccess,
      controlsReadModelAccess = controlsAccess
    )

    val first = service.createExportPack(makerAccess(), closingFolderId, "replay-key")
    closingFolderAccess.status = ClosingFolderAccessStatus.ARCHIVED
    controlsAccess.readiness = "BLOCKED"

    val replay = service.createExportPack(makerAccess(), closingFolderId, "replay-key")

    assertThat(first.exportPack.exportPackId).isEqualTo(replay.exportPack.exportPackId)
    assertThat(replay.outcome).isEqualTo(CreateExportPackOutcome.REPLAYED)
  }

  @Test
  fun `same key with different logical intention after success returns conflict`() {
    val workpapersAccess = MutableWorkpapersExportAccess()
    val service = service(workpapersExportAccess = workpapersAccess)

    service.createExportPack(makerAccess(), closingFolderId, "same-key")
    workpapersAccess.noteText = "Changed note"

    assertFailsWith<ExportPackConflictException> {
      service.createExportPack(makerAccess(), closingFolderId, "same-key")
    }
  }

  @Test
  fun `same key after failed attempt before persistence is treated as a new attempt`() {
    val storage = RecordingExportPackStorage(failOnStore = true)
    val exportPackRepository = FakeExportPackRepository()
    val service = service(
      exportPackRepository = exportPackRepository,
      storage = storage
    )

    assertFailsWith<ExportPackStorageException> {
      service.createExportPack(makerAccess(), closingFolderId, "retry-after-failure")
    }
    assertThat(exportPackRepository.exportPacks()).isEmpty()

    storage.failOnStore.set(false)
    val created = service.createExportPack(makerAccess(), closingFolderId, "retry-after-failure")

    assertThat(created.outcome).isEqualTo(CreateExportPackOutcome.CREATED)
    assertThat(exportPackRepository.exportPacks()).hasSize(1)
  }

  @Test
  fun `basis mismatch with included current workpaper is rejected`() {
    val workpapersAccess = MutableWorkpapersExportAccess(basisTaxonomyVersion = 99)
    val service = service(workpapersExportAccess = workpapersAccess)

    assertFailsWith<ExportPackConflictException> {
      service.createExportPack(makerAccess(), closingFolderId, "basis-mismatch")
    }
  }

  @Test
  fun `generation rejects archived closing and blocked readiness on first attempt`() {
    val archivedService = service(
      closingFolderAccess = MutableClosingFolderAccess(status = ClosingFolderAccessStatus.ARCHIVED)
    )
    val blockedService = service(
      controlsReadModelAccess = MutableControlsReadModelAccess(readiness = "BLOCKED")
    )

    assertFailsWith<ExportPackConflictException> {
      archivedService.createExportPack(makerAccess(), closingFolderId, "archived")
    }
    assertFailsWith<ExportPackConflictException> {
      blockedService.createExportPack(makerAccess(), closingFolderId, "blocked")
    }
  }

  @Test
  fun `database failure after storage triggers compensation`() {
    val exportPackRepository = FakeExportPackRepository(failOnCreate = true)
    val storage = RecordingExportPackStorage()
    val service = service(
      exportPackRepository = exportPackRepository,
      storage = storage
    )

    assertFailsWith<IllegalStateException> {
      service.createExportPack(makerAccess(), closingFolderId, "db-failure")
    }

    assertThat(storage.deletedKeys).hasSize(1)
    assertThat(exportPackRepository.exportPacks()).isEmpty()
  }

  @Test
  fun `concurrent equivalent requests create one pack one storage object and one audit`() {
    val exportPackRepository = FakeExportPackRepository()
    val storage = RecordingExportPackStorage(delayStoreMillis = 50)
    val auditTrail = RecordingExportAuditTrail()
    val service = service(
      exportPackRepository = exportPackRepository,
      storage = storage,
      auditTrail = auditTrail
    )
    val executor = Executors.newFixedThreadPool(2)
    val ready = CountDownLatch(2)
    val start = CountDownLatch(1)
    val results = mutableListOf<CreateExportPackResult>()

    repeat(2) {
      executor.submit {
        ready.countDown()
        start.await(5, TimeUnit.SECONDS)
        val result = service.createExportPack(makerAccess(), closingFolderId, "concurrent-key")
        synchronized(results) {
          results += result
        }
      }
    }

    ready.await(5, TimeUnit.SECONDS)
    start.countDown()
    executor.shutdown()
    executor.awaitTermination(5, TimeUnit.SECONDS)

    assertThat(results).hasSize(2)
    assertThat(results.map { it.exportPack.exportPackId }.distinct()).hasSize(1)
    assertThat(results.map { it.outcome }).containsExactlyInAnyOrder(CreateExportPackOutcome.CREATED, CreateExportPackOutcome.REPLAYED)
    assertThat(exportPackRepository.exportPacks()).hasSize(1)
    assertThat(storage.storeCount).isEqualTo(1)
    assertThat(auditTrail.commands).hasSize(1)
  }

  private fun service(
    closingFolderAccess: MutableClosingFolderAccess = MutableClosingFolderAccess(),
    controlsReadModelAccess: MutableControlsReadModelAccess = MutableControlsReadModelAccess(),
    financialSummaryReadModelAccess: FinancialSummaryReadModelAccess = FinancialSummaryReadModelAccess { _, _ -> readyFinancialSummary() },
    structuredFinancialStatementsReadModelAccess: StructuredFinancialStatementsReadModelAccess = StructuredFinancialStatementsReadModelAccess { _, _ -> readyStructuredStatements() },
    workpapersExportAccess: MutableWorkpapersExportAccess = MutableWorkpapersExportAccess(),
    exportPackRepository: FakeExportPackRepository = FakeExportPackRepository(),
    storage: RecordingExportPackStorage = RecordingExportPackStorage(),
    auditTrail: RecordingExportAuditTrail = RecordingExportAuditTrail()
  ): ExportPackService =
    ExportPackService(
      closingFolderAccess = closingFolderAccess,
      controlsReadModelAccess = controlsReadModelAccess,
      financialSummaryReadModelAccess = financialSummaryReadModelAccess,
      structuredFinancialStatementsReadModelAccess = structuredFinancialStatementsReadModelAccess,
      workpapersExportAccess = workpapersExportAccess,
      exportPackRepository = exportPackRepository,
      exportPackStorage = storage,
      objectMapper = objectMapper,
      auditTrail = auditTrail,
      auditCorrelationContextProvider = AuditCorrelationContextProvider {
        AuditCorrelationContext(requestId = "req-1")
      },
      transactionTemplate = TransactionTemplate(NoOpTransactionManager())
    )

  private fun makerAccess(): TenantAccessContext =
    TenantAccessContext(
      actorUserId = actorUserId,
      actorSubject = "maker",
      tenantId = tenantId,
      effectiveRoles = setOf("ACCOUNTANT")
    )

  private fun readyControls(readiness: String = "READY"): ControlsReadModel =
    ControlsReadModel(
      closingFolderId = closingFolderId.toString(),
      closingFolderStatus = "DRAFT",
      readiness = readiness,
      latestImportPresent = true,
      latestImportVersion = 3,
      mappingSummary = ControlsMappingSummaryReadModel(total = 2, mapped = 2, unmapped = 0),
      unmappedAccounts = emptyList(),
      controls = listOf(
        ControlResultReadModel(
          code = "LATEST_VALID_BALANCE_IMPORT_PRESENT",
          status = "PASS",
          severity = "BLOCKER",
          message = "Latest valid balance import version 3 is available."
        )
      ),
      nextAction = if (readiness == "READY") null else ControlsNextActionReadModel("COMPLETE_MANUAL_MAPPING", "/api/x", true)
    )

  private fun readyFinancialSummary(): FinancialSummaryReadModel =
    FinancialSummaryReadModel(
      closingFolderId = closingFolderId.toString(),
      closingFolderStatus = "DRAFT",
      readiness = "READY",
      statementState = "PREVIEW_READY",
      latestImportVersion = 3,
      coverage = FinancialSummaryCoverageReadModel(2, 2, 0, "1"),
      blockers = emptyList(),
      nextAction = null,
      unmappedBalanceImpact = ch.qamwaq.ritomer.financials.access.UnmappedBalanceImpactReadModel("0", "0", "0"),
      balanceSheetSummary = BalanceSheetSummaryReadModel("100", "0", "0", "100", "100", "100"),
      incomeStatementSummary = IncomeStatementSummaryReadModel("100", "0", "100")
    )

  private fun readyStructuredStatements(): StructuredFinancialStatementsReadModel =
    StructuredFinancialStatementsReadModel(
      closingFolderId = closingFolderId.toString(),
      closingFolderStatus = "DRAFT",
      readiness = "READY",
      statementState = "PREVIEW_READY",
      presentationType = "STRUCTURED_PREVIEW",
      isStatutory = false,
      taxonomyVersion = 2,
      latestImportVersion = 3,
      coverage = StructuredFinancialCoverageReadModel(2, 2, 0, "1"),
      blockers = emptyList(),
      nextAction = null,
      balanceSheet = StructuredBalanceSheetReadModel(
        groups = listOf(
          StructuredStatementGroupReadModel(
            code = "BS.ASSET",
            label = "Asset",
            total = "100",
            breakdowns = listOf(
              StructuredStatementBreakdownReadModel(
                code = "BS.ASSET.CURRENT_SECTION",
                label = "Current assets",
                breakdownType = "SECTION",
                total = "100"
              )
            )
          )
        ),
        totals = StructuredBalanceSheetTotalsReadModel("100", "0", "0", "100", "100")
      ),
      incomeStatement = StructuredIncomeStatementReadModel(
        groups = listOf(
          StructuredStatementGroupReadModel(
            code = "PL.REVENUE",
            label = "Revenue",
            total = "100",
            breakdowns = listOf(
              StructuredStatementBreakdownReadModel(
                code = "PL.REVENUE.OPERATING_SECTION",
                label = "Operating revenue",
                breakdownType = "SECTION",
                total = "100"
              )
            )
          )
        ),
        totals = StructuredIncomeStatementTotalsReadModel("100", "0", "100")
      )
    )

  private fun unzip(bytes: ByteArray): Map<String, ByteArray> {
    val entries = linkedMapOf<String, ByteArray>()
    ZipInputStream(ByteArrayInputStream(bytes), Charsets.UTF_8).use { zip ->
      while (true) {
        val entry = zip.nextEntry ?: break
        entries[entry.name] = zip.readAllBytes()
      }
    }
    return entries
  }

  private inner class MutableClosingFolderAccess(
    var status: ClosingFolderAccessStatus = ClosingFolderAccessStatus.DRAFT
  ) : ClosingFolderAccess {
    override fun getRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView =
      ClosingFolderAccessView(closingFolderId, tenantId, status)

    override fun lockRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView =
      getRequired(tenantId, closingFolderId)
  }

  private inner class MutableControlsReadModelAccess(
    var readiness: String = "READY"
  ) : ControlsReadModelAccess {
    override fun getReadModel(access: TenantAccessContext, closingFolderId: UUID): ControlsReadModel =
      readyControls(readiness)
  }

  private inner class MutableWorkpapersExportAccess(
    basisTaxonomyVersion: Int = 2
  ) : WorkpapersExportAccess {
    var noteText: String = "Justification"
    var basisTaxonomyVersion: Int = basisTaxonomyVersion

    override fun getCurrentPersistedWorkpapers(access: TenantAccessContext, closingFolderId: UUID): CurrentWorkpapersReadModel =
      CurrentWorkpapersReadModel(
        closingFolderId = closingFolderId.toString(),
        closingFolderStatus = "DRAFT",
        readiness = "READY",
        latestImportVersion = 3,
        blockers = emptyList(),
        nextAction = null,
        summaryCounts = CurrentWorkpapersSummaryCountsReadModel(
          totalCurrentAnchors = 1,
          withWorkpaperCount = 1,
          readyForReviewCount = 0,
          reviewedCount = 1,
          staleCount = 0,
          missingCount = 0
        ),
        items = listOf(
          CurrentPersistedWorkpaperReadModel(
            anchorCode = "BS.ASSET.CURRENT_SECTION",
            anchorLabel = "Current assets",
            summaryBucketCode = "BS.ASSET",
            statementKind = "BALANCE_SHEET",
            breakdownType = "SECTION",
            workpaperId = workpaperId.toString(),
            noteText = noteText,
            status = "REVIEWED",
            reviewComment = null,
            basisImportVersion = 3,
            basisTaxonomyVersion = this.basisTaxonomyVersion,
            createdAt = "2025-01-01T00:00:00Z",
            createdByUserId = actorUserId.toString(),
            updatedAt = "2025-01-02T00:00:00Z",
            updatedByUserId = actorUserId.toString(),
            reviewedAt = "2025-01-03T00:00:00Z",
            reviewedByUserId = actorUserId.toString(),
            evidences = listOf(
              CurrentWorkpaperEvidenceReadModel(
                id = evidenceId.toString(),
                position = 1,
                fileName = "bank.csv",
                mediaType = "text/csv",
                documentDate = null,
                sourceLabel = "ERP",
                verificationStatus = "VERIFIED",
                externalReference = null,
                checksumSha256 = null
              )
            ),
            documentVerificationSummary = CurrentDocumentVerificationSummaryReadModel(
              documentsCount = 1,
              unverifiedCount = 0,
              verifiedCount = 1,
              rejectedCount = 0
            ),
            documents = listOf(
              CurrentDocumentReadModel(
                documentId = documentId.toString(),
                fileName = "..\\report:Q4?.pdf",
                mediaType = "application/pdf",
                byteSize = 13,
                checksumSha256 = sha256("support-bytes".toByteArray()),
                sourceLabel = "ERP",
                documentDate = "2024-12-31",
                createdAt = "2025-01-02T00:00:00Z",
                createdByUserId = actorUserId.toString(),
                verificationStatus = "VERIFIED",
                reviewComment = null,
                reviewedAt = "2025-01-03T00:00:00Z",
                reviewedByUserId = actorUserId.toString()
              )
            )
          )
        )
      )

    override fun openSelectedDocument(access: TenantAccessContext, closingFolderId: UUID, documentId: UUID): SelectedDocumentBinary =
      SelectedDocumentBinary(
        documentId = documentId,
        fileName = "..\\report:Q4?.pdf",
        mediaType = "application/pdf",
        byteSize = 13,
        inputStream = ByteArrayInputStream("support-bytes".toByteArray())
      )
  }

  private class FakeExportPackRepository(
    private val failOnCreate: Boolean = false
  ) : ExportPackRepository {
    private val exportPacksById = linkedMapOf<UUID, ExportPack>()

    override fun findByIdempotencyKey(tenantId: UUID, closingFolderId: UUID, idempotencyKey: String): ExportPack? =
      synchronized(this) {
        exportPacksById.values.firstOrNull {
          it.tenantId == tenantId &&
            it.closingFolderId == closingFolderId &&
            it.idempotencyKey == idempotencyKey
        }
      }

    override fun findById(tenantId: UUID, closingFolderId: UUID, exportPackId: UUID): ExportPack? =
      synchronized(this) {
        exportPacksById[exportPackId]?.takeIf {
          it.tenantId == tenantId &&
            it.closingFolderId == closingFolderId
        }
      }

    override fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): List<ExportPack> =
      synchronized(this) {
        exportPacksById.values
          .filter { it.tenantId == tenantId && it.closingFolderId == closingFolderId }
          .sortedWith(compareByDescending<ExportPack> { it.createdAt }.thenByDescending { it.id })
      }

    override fun create(exportPack: ExportPack): ExportPack =
      synchronized(this) {
        if (failOnCreate) {
          throw IllegalStateException("intentional export_pack create failure")
        }
        val existing = exportPacksById.values.any {
          it.tenantId == exportPack.tenantId &&
            it.closingFolderId == exportPack.closingFolderId &&
            it.idempotencyKey == exportPack.idempotencyKey
        }
        if (existing) {
          throw ExportPackAlreadyExistsException("export_pack already exists for the same idempotency key.")
        }
        exportPacksById[exportPack.id] = exportPack
        exportPack
      }

    fun exportPacks(): List<ExportPack> = synchronized(this) { exportPacksById.values.toList() }
  }

  private class RecordingExportPackStorage(
    failOnStore: Boolean = false,
    private val delayStoreMillis: Long = 0
  ) : ExportPackStorage {
    val failOnStore = AtomicBoolean(failOnStore)
    val storedBytes = linkedMapOf<String, ByteArray>()
    val deletedKeys = mutableListOf<String>()
    var storeCount: Int = 0
      private set

    override fun storageBackendCode(): String = "LOCAL_FS"

    override fun store(command: StoreExportPackCommand): StoredExportPackObject {
      if (failOnStore.get()) {
        throw IllegalStateException("intentional storage failure")
      }
      if (delayStoreMillis > 0) {
        Thread.sleep(delayStoreMillis)
      }
      val bytes = command.inputStream.readAllBytes()
      synchronized(this) {
        storeCount += 1
        storedBytes[command.objectKey] = bytes
      }
      return StoredExportPackObject(
        storageBackend = storageBackendCode(),
        storageObjectKey = command.objectKey,
        mediaType = command.mediaType,
        byteSize = bytes.size.toLong(),
        checksumSha256 = sha256(bytes)
      )
    }

    override fun open(objectKey: String): ExportPackContent =
      ExportPackContent(ByteArrayInputStream(storedBytes.getValue(objectKey)))

    override fun deleteIfExists(objectKey: String) {
      synchronized(this) {
        deletedKeys += objectKey
        storedBytes.remove(objectKey)
      }
    }
  }

  private class RecordingExportAuditTrail : AuditTrail {
    val commands = mutableListOf<AppendAuditEventCommand>()

    override fun append(command: AppendAuditEventCommand): UUID {
      commands += command
      return UUID.randomUUID()
    }
  }

  private class NoOpTransactionManager : PlatformTransactionManager {
    override fun getTransaction(definition: TransactionDefinition?): TransactionStatus =
      SimpleTransactionStatus()

    override fun commit(status: TransactionStatus) = Unit

    override fun rollback(status: TransactionStatus) = Unit
  }

  companion object {
    private fun sha256(bytes: ByteArray): String =
      java.security.MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { "%02x".format(it) }
  }
}
