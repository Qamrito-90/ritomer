package ch.qamwaq.ritomer.workpapers.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.controls.access.ClosingControlsSnapshot
import ch.qamwaq.ritomer.controls.access.ControlsAccess
import ch.qamwaq.ritomer.controls.access.ControlsReadiness
import ch.qamwaq.ritomer.financials.access.CurrentWorkpaperAnchor
import ch.qamwaq.ritomer.financials.access.CurrentWorkpaperAnchorProjection
import ch.qamwaq.ritomer.financials.access.CurrentWorkpaperBreakdownType
import ch.qamwaq.ritomer.financials.access.CurrentWorkpaperStatementKind
import ch.qamwaq.ritomer.financials.access.WorkpaperAnchorAccess
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContext
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContextProvider
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.workpapers.domain.Document
import ch.qamwaq.ritomer.workpapers.domain.DocumentStorageBackend
import ch.qamwaq.ritomer.workpapers.domain.DocumentVerificationStatus
import ch.qamwaq.ritomer.workpapers.domain.Workpaper
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperBreakdownType
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperEvidence
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatementKind
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatus
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockMultipartFile
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.TransactionStatus
import org.springframework.transaction.support.SimpleTransactionStatus
import org.springframework.transaction.support.TransactionTemplate

class DocumentServiceTest {
  private val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
  private val actorUserId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
  private val closingFolderId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

  @Test
  fun `upload accepts application pdf and computes server metadata`() {
    val workpaper = persistedWorkpaper()
    val workpaperRepository = DocumentServiceFakeWorkpaperRepository(listOf(workpaper))
    val documentRepository = DocumentServiceFakeDocumentRepository()
    val auditTrail = DocumentServiceRecordingAuditTrail()
    val service = service(
      workpaperRepository = workpaperRepository,
      repository = documentRepository,
      binaryObjectStore = RecordingBinaryObjectStore(),
      auditTrail = auditTrail
    )

    val result = service.uploadDocument(
      makerAccess(),
      closingFolderId,
      workpaper.anchorCode,
      MockMultipartFile("file", " ..\\ report:Q4?.pdf ", "application/pdf", "hello".toByteArray()),
      UploadDocumentCommand(sourceLabel = " ERP ", documentDate = LocalDate.parse("2024-12-31"))
    )

    assertThat(result.fileName).isEqualTo("report_Q4_.pdf")
    assertThat(result.mediaType).isEqualTo("application/pdf")
    assertThat(result.byteSize).isEqualTo(5)
    assertThat(result.checksumSha256).isEqualTo(sha256("hello".toByteArray()))
    assertThat(result.sourceLabel).isEqualTo("ERP")
    assertThat(result.verificationStatus).isEqualTo(DocumentVerificationStatus.UNVERIFIED)
    assertThat(result.reviewComment).isNull()
    assertThat(result.reviewedAt).isNull()
    assertThat(result.reviewedByUserId).isNull()
    assertThat(documentRepository.createdDocuments()).hasSize(1)
    assertThat(auditTrail.commands.single().action).isEqualTo(DOCUMENT_CREATED_ACTION)
  }

  @Test
  fun `upload rejects file larger than 25 MiB`() {
    val workpaperRepository = DocumentServiceFakeWorkpaperRepository(listOf(persistedWorkpaper()))
    val service = service(
      workpaperRepository = workpaperRepository,
      repository = DocumentServiceFakeDocumentRepository(),
      binaryObjectStore = RecordingBinaryObjectStore()
    )

    assertThatThrownBy {
      service.uploadDocument(
        makerAccess(),
        closingFolderId,
        "BS.ASSET.CURRENT_SECTION",
        MockMultipartFile("file", "too-large.pdf", "application/pdf", ByteArray(26 * 1024 * 1024)),
        UploadDocumentCommand(sourceLabel = "ERP", documentDate = null)
      )
    }.isInstanceOf(DocumentPayloadTooLargeException::class.java)
  }

  @Test
  fun `upload accepts duplicate binaries as distinct documents`() {
    val workpaper = persistedWorkpaper()
    val workpaperRepository = DocumentServiceFakeWorkpaperRepository(listOf(workpaper))
    val documentRepository = DocumentServiceFakeDocumentRepository()
    val auditTrail = DocumentServiceRecordingAuditTrail()
    val service = service(
      workpaperRepository = workpaperRepository,
      repository = documentRepository,
      binaryObjectStore = RecordingBinaryObjectStore(),
      auditTrail = auditTrail
    )

    val first = service.uploadDocument(
      makerAccess(),
      closingFolderId,
      workpaper.anchorCode,
      MockMultipartFile("file", "support.pdf", "application/pdf", "same".toByteArray()),
      UploadDocumentCommand(sourceLabel = "ERP", documentDate = null)
    )
    val second = service.uploadDocument(
      makerAccess(),
      closingFolderId,
      workpaper.anchorCode,
      MockMultipartFile("file", "support.pdf", "application/pdf", "same".toByteArray()),
      UploadDocumentCommand(sourceLabel = "ERP", documentDate = null)
    )

    assertThat(first.id).isNotEqualTo(second.id)
    assertThat(documentRepository.createdDocuments()).hasSize(2)
    assertThat(auditTrail.commands).hasSize(2)
  }

  @Test
  fun `upload rejects archived closing`() {
    val workpaperRepository = DocumentServiceFakeWorkpaperRepository(listOf(persistedWorkpaper()))
    val service = service(
      controlsSnapshot = ClosingControlsSnapshot(
        closingFolderStatus = ClosingFolderAccessStatus.ARCHIVED,
        readiness = ControlsReadiness.READY,
        blockers = emptyList(),
        nextAction = null
      ),
      workpaperRepository = workpaperRepository,
      repository = DocumentServiceFakeDocumentRepository(),
      binaryObjectStore = RecordingBinaryObjectStore()
    )

    assertThatThrownBy {
      service.uploadDocument(
        makerAccess(),
        closingFolderId,
        "BS.ASSET.CURRENT_SECTION",
        MockMultipartFile("file", "support.pdf", "application/pdf", "x".toByteArray()),
        UploadDocumentCommand(sourceLabel = "ERP", documentDate = null)
      )
    }.isInstanceOf(DocumentConflictException::class.java)
  }

  @Test
  fun `upload rejects stale or non current anchor`() {
    val workpaper = persistedWorkpaper()
    val workpaperRepository = DocumentServiceFakeWorkpaperRepository(listOf(workpaper))
    val service = service(
      anchorProjection = anchorProjection(currentAnchor("PL.REVENUE.OPERATING_REVENUE")),
      workpaperRepository = workpaperRepository,
      repository = DocumentServiceFakeDocumentRepository(),
      binaryObjectStore = RecordingBinaryObjectStore()
    )

    assertThatThrownBy {
      service.uploadDocument(
        makerAccess(),
        closingFolderId,
        workpaper.anchorCode,
        MockMultipartFile("file", "support.pdf", "application/pdf", "x".toByteArray()),
        UploadDocumentCommand(sourceLabel = "ERP", documentDate = null)
      )
    }.isInstanceOf(DocumentConflictException::class.java)
  }

  @Test
  fun `upload rejects non editable workpaper`() {
    val workpaperRepository = DocumentServiceFakeWorkpaperRepository(listOf(persistedWorkpaper(status = WorkpaperStatus.READY_FOR_REVIEW)))
    val service = service(
      workpaperRepository = workpaperRepository,
      repository = DocumentServiceFakeDocumentRepository(),
      binaryObjectStore = RecordingBinaryObjectStore()
    )

    assertThatThrownBy {
      service.uploadDocument(
        makerAccess(),
        closingFolderId,
        "BS.ASSET.CURRENT_SECTION",
        MockMultipartFile("file", "support.pdf", "application/pdf", "x".toByteArray()),
        UploadDocumentCommand(sourceLabel = "ERP", documentDate = null)
      )
    }.isInstanceOf(DocumentConflictException::class.java)
  }

  @Test
  fun `storage failure leaves repository empty and skips audit`() {
    val workpaperRepository = DocumentServiceFakeWorkpaperRepository(listOf(persistedWorkpaper()))
    val documentRepository = DocumentServiceFakeDocumentRepository()
    val auditTrail = DocumentServiceRecordingAuditTrail()
    val service = service(
      workpaperRepository = workpaperRepository,
      repository = documentRepository,
      binaryObjectStore = RecordingBinaryObjectStore(failOnStore = true),
      auditTrail = auditTrail
    )

    assertThatThrownBy {
      service.uploadDocument(
        makerAccess(),
        closingFolderId,
        "BS.ASSET.CURRENT_SECTION",
        MockMultipartFile("file", "support.pdf", "application/pdf", "x".toByteArray()),
        UploadDocumentCommand(sourceLabel = "ERP", documentDate = null)
      )
    }.isInstanceOf(DocumentStorageException::class.java)

    assertThat(documentRepository.createdDocuments()).isEmpty()
    assertThat(auditTrail.commands).isEmpty()
  }

  @Test
  fun `database failure after storage triggers best effort compensation`() {
    val workpaper = persistedWorkpaper()
    val binaryObjectStore = RecordingBinaryObjectStore()
    val workpaperRepository = DocumentServiceFakeWorkpaperRepository(listOf(workpaper))
    val documentRepository = DocumentServiceFakeDocumentRepository(failOnCreate = true)
    val service = service(
      workpaperRepository = workpaperRepository,
      repository = documentRepository,
      binaryObjectStore = binaryObjectStore
    )

    assertThatThrownBy {
      service.uploadDocument(
        makerAccess(),
        closingFolderId,
        workpaper.anchorCode,
        MockMultipartFile("file", "support.pdf", "application/pdf", "x".toByteArray()),
        UploadDocumentCommand(sourceLabel = "ERP", documentDate = null)
      )
    }.isInstanceOf(IllegalStateException::class.java)

    assertThat(binaryObjectStore.deletedObjectKeys).hasSize(1)
    assertThat(documentRepository.createdDocuments()).isEmpty()
  }

  @Test
  fun `verification rejects blank comment on rejected decision`() {
    val workpaper = persistedWorkpaper(status = WorkpaperStatus.READY_FOR_REVIEW)
    val documentRepository = DocumentServiceFakeDocumentRepository().also {
      it.create(
        storedDocument(
          workpaperId = workpaper.id,
          verificationStatus = DocumentVerificationStatus.UNVERIFIED
        )
      )
    }
    val service = service(
      workpaperRepository = DocumentServiceFakeWorkpaperRepository(listOf(workpaper)),
      repository = documentRepository,
      binaryObjectStore = RecordingBinaryObjectStore()
    )

    assertThatThrownBy {
      service.reviewVerificationDecision(
        reviewerAccess(),
        closingFolderId,
        documentRepository.createdDocuments().single().id,
        DocumentVerificationDecisionCommand(
          decision = DocumentVerificationStatus.REJECTED,
          comment = "   "
        )
      )
    }.isInstanceOf(DocumentBadRequestException::class.java)
  }

  @Test
  fun `verification rejects comment on verified decision`() {
    val workpaper = persistedWorkpaper(status = WorkpaperStatus.READY_FOR_REVIEW)
    val documentRepository = DocumentServiceFakeDocumentRepository().also {
      it.create(
        storedDocument(
          workpaperId = workpaper.id,
          verificationStatus = DocumentVerificationStatus.REJECTED,
          reviewComment = "Wrong file"
        )
      )
    }
    val service = service(
      workpaperRepository = DocumentServiceFakeWorkpaperRepository(listOf(workpaper)),
      repository = documentRepository,
      binaryObjectStore = RecordingBinaryObjectStore()
    )

    assertThatThrownBy {
      service.reviewVerificationDecision(
        reviewerAccess(),
        closingFolderId,
        documentRepository.createdDocuments().single().id,
        DocumentVerificationDecisionCommand(
          decision = DocumentVerificationStatus.VERIFIED,
          comment = "Should be rejected"
        )
      )
    }.isInstanceOf(DocumentBadRequestException::class.java)
  }

  @Test
  fun `verification exact noop stays silent in audit`() {
    val workpaper = persistedWorkpaper(status = WorkpaperStatus.READY_FOR_REVIEW)
    val document = storedDocument(
      workpaperId = workpaper.id,
      verificationStatus = DocumentVerificationStatus.REJECTED,
      reviewComment = "Need signed version",
      reviewedAt = OffsetDateTime.parse("2025-01-03T00:00:00Z"),
      reviewedByUserId = actorUserId
    )
    val documentRepository = DocumentServiceFakeDocumentRepository().also { it.create(document) }
    val auditTrail = DocumentServiceRecordingAuditTrail()
    val service = service(
      workpaperRepository = DocumentServiceFakeWorkpaperRepository(listOf(workpaper)),
      repository = documentRepository,
      binaryObjectStore = RecordingBinaryObjectStore(),
      auditTrail = auditTrail
    )

    val result = service.reviewVerificationDecision(
      reviewerAccess(),
      closingFolderId,
      document.id,
      DocumentVerificationDecisionCommand(
        decision = DocumentVerificationStatus.REJECTED,
        comment = " Need signed version "
      )
    )

    assertThat(result.verificationStatus).isEqualTo(DocumentVerificationStatus.REJECTED)
    assertThat(result.reviewComment).isEqualTo("Need signed version")
    assertThat(auditTrail.commands).isEmpty()
  }

  @Test
  fun `verification updates rejected comment and audits real mutation`() {
    val workpaper = persistedWorkpaper(status = WorkpaperStatus.READY_FOR_REVIEW)
    val document = storedDocument(
      workpaperId = workpaper.id,
      verificationStatus = DocumentVerificationStatus.REJECTED,
      reviewComment = "Old comment",
      reviewedAt = OffsetDateTime.parse("2025-01-03T00:00:00Z"),
      reviewedByUserId = UUID.randomUUID()
    )
    val documentRepository = DocumentServiceFakeDocumentRepository().also { it.create(document) }
    val auditTrail = DocumentServiceRecordingAuditTrail()
    val service = service(
      workpaperRepository = DocumentServiceFakeWorkpaperRepository(listOf(workpaper)),
      repository = documentRepository,
      binaryObjectStore = RecordingBinaryObjectStore(),
      auditTrail = auditTrail
    )

    val result = service.reviewVerificationDecision(
      reviewerAccess(),
      closingFolderId,
      document.id,
      DocumentVerificationDecisionCommand(
        decision = DocumentVerificationStatus.REJECTED,
        comment = "Updated comment"
      )
    )

    assertThat(result.reviewComment).isEqualTo("Updated comment")
    assertThat(result.reviewedByUserId).isEqualTo(actorUserId)
    assertThat(auditTrail.commands.single().action).isEqualTo(DOCUMENT_VERIFICATION_UPDATED_ACTION)
  }

  @Test
  fun `verification requires current ready non archived and workpaper ready for review`() {
    val workpaper = persistedWorkpaper(status = WorkpaperStatus.DRAFT)
    val documentRepository = DocumentServiceFakeDocumentRepository().also {
      it.create(storedDocument(workpaperId = workpaper.id))
    }
    val service = service(
      workpaperRepository = DocumentServiceFakeWorkpaperRepository(listOf(workpaper)),
      repository = documentRepository,
      binaryObjectStore = RecordingBinaryObjectStore()
    )

    assertThatThrownBy {
      service.reviewVerificationDecision(
        reviewerAccess(),
        closingFolderId,
        documentRepository.createdDocuments().single().id,
        DocumentVerificationDecisionCommand(
          decision = DocumentVerificationStatus.VERIFIED,
          comment = null
        )
      )
    }.isInstanceOf(DocumentConflictException::class.java)
  }

  private fun service(
    controlsSnapshot: ClosingControlsSnapshot = readyControls(),
    anchorProjection: CurrentWorkpaperAnchorProjection = anchorProjection(currentAnchor("BS.ASSET.CURRENT_SECTION")),
    workpaperRepository: DocumentServiceFakeWorkpaperRepository,
    repository: DocumentServiceFakeDocumentRepository,
    binaryObjectStore: RecordingBinaryObjectStore,
    auditTrail: DocumentServiceRecordingAuditTrail = DocumentServiceRecordingAuditTrail()
  ): DocumentService =
    DocumentService(
      controlsAccess = ControlsAccess { _, _ -> controlsSnapshot },
      workpaperAnchorAccess = WorkpaperAnchorAccess { _, _ -> anchorProjection },
      workpaperRepository = workpaperRepository,
      documentRepository = repository,
      binaryObjectStore = binaryObjectStore,
      auditTrail = auditTrail,
      auditCorrelationContextProvider = AuditCorrelationContextProvider {
        AuditCorrelationContext(requestId = "req-1")
      },
      transactionTemplate = TransactionTemplate(NoOpTransactionManager())
    )

  private fun readyControls(): ClosingControlsSnapshot =
    ClosingControlsSnapshot(
      closingFolderStatus = ClosingFolderAccessStatus.DRAFT,
      readiness = ControlsReadiness.READY,
      blockers = emptyList(),
      nextAction = null
    )

  private fun currentAnchor(code: String): CurrentWorkpaperAnchor =
    CurrentWorkpaperAnchor(
      code = code,
      label = "Current assets",
      summaryBucketCode = "BS.ASSET",
      statementKind = CurrentWorkpaperStatementKind.BALANCE_SHEET,
      breakdownType = CurrentWorkpaperBreakdownType.SECTION
    )

  private fun anchorProjection(vararg anchors: CurrentWorkpaperAnchor): CurrentWorkpaperAnchorProjection =
    CurrentWorkpaperAnchorProjection(
      latestImportVersion = 3,
      taxonomyVersion = 2,
      anchors = anchors.toList()
    )

  private fun makerAccess(): TenantAccessContext =
    TenantAccessContext(
      actorUserId = actorUserId,
      actorSubject = "maker",
      tenantId = tenantId,
      effectiveRoles = setOf("ACCOUNTANT")
    )

  private fun reviewerAccess(): TenantAccessContext =
    TenantAccessContext(
      actorUserId = actorUserId,
      actorSubject = "reviewer",
      tenantId = tenantId,
      effectiveRoles = setOf("REVIEWER")
    )

  private fun persistedWorkpaper(
    anchorCode: String = "BS.ASSET.CURRENT_SECTION",
    status: WorkpaperStatus = WorkpaperStatus.DRAFT
  ): Workpaper =
    Workpaper(
      id = UUID.randomUUID(),
      tenantId = tenantId,
      closingFolderId = closingFolderId,
      anchorCode = anchorCode,
      anchorLabel = "Current assets",
      summaryBucketCode = "BS.ASSET",
      statementKind = WorkpaperStatementKind.BALANCE_SHEET,
      breakdownType = WorkpaperBreakdownType.SECTION,
      noteText = "Justification",
      status = status,
      reviewComment = null,
      basisImportVersion = 3,
      basisTaxonomyVersion = 2,
      createdAt = OffsetDateTime.parse("2025-01-01T00:00:00Z"),
      createdByUserId = actorUserId,
      updatedAt = OffsetDateTime.parse("2025-01-01T00:00:00Z"),
      updatedByUserId = actorUserId,
      reviewedAt = null,
      reviewedByUserId = null,
      evidences = emptyList()
    )

  private fun storedDocument(
    workpaperId: UUID,
    verificationStatus: DocumentVerificationStatus = DocumentVerificationStatus.UNVERIFIED,
    reviewComment: String? = null,
    reviewedAt: OffsetDateTime? = null,
    reviewedByUserId: UUID? = null
  ): Document =
    Document(
      id = UUID.randomUUID(),
      tenantId = tenantId,
      workpaperId = workpaperId,
      storageBackend = DocumentStorageBackend.LOCAL_FS,
      storageObjectKey = "tenants/$tenantId/workpapers/$workpaperId/documents/${UUID.randomUUID()}",
      fileName = "support.pdf",
      mediaType = "application/pdf",
      byteSize = 32,
      checksumSha256 = sha256("support".toByteArray()),
      sourceLabel = "ERP",
      documentDate = LocalDate.parse("2024-12-31"),
      createdAt = OffsetDateTime.parse("2025-01-02T00:00:00Z"),
      createdByUserId = actorUserId,
      verificationStatus = verificationStatus,
      reviewComment = reviewComment,
      reviewedAt = reviewedAt,
      reviewedByUserId = reviewedByUserId
    )

  private fun sha256(bytes: ByteArray): String =
    java.security.MessageDigest.getInstance("SHA-256")
      .digest(bytes)
      .joinToString("") { "%02x".format(it) }
}

private class DocumentServiceFakeWorkpaperRepository(
  workpapers: List<Workpaper>
) : WorkpaperRepository {
  private val workpapersById = workpapers.associateBy { it.id }.toMutableMap()

  override fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): List<Workpaper> =
    workpapersById.values.filter { it.tenantId == tenantId && it.closingFolderId == closingFolderId }

  override fun findByAnchorCode(tenantId: UUID, closingFolderId: UUID, anchorCode: String): Workpaper? =
    workpapersById.values.firstOrNull {
      it.tenantId == tenantId &&
        it.closingFolderId == closingFolderId &&
        it.anchorCode == anchorCode
    }

  override fun findById(tenantId: UUID, workpaperId: UUID): Workpaper? =
    workpapersById[workpaperId]?.takeIf { it.tenantId == tenantId }

  override fun create(workpaper: Workpaper): Workpaper {
    workpapersById[workpaper.id] = workpaper
    return workpaper
  }

  override fun update(workpaper: Workpaper): Workpaper {
    workpapersById[workpaper.id] = workpaper
    return workpaper
  }
}

private class DocumentServiceFakeDocumentRepository(
  private val failOnCreate: Boolean = false
) : DocumentRepository {
  private val documentsById = linkedMapOf<UUID, Document>()

  override fun create(document: Document): Document {
    if (failOnCreate) {
      throw IllegalStateException("intentional document create failure")
    }
    documentsById[document.id] = document
    return document
  }

  override fun updateVerification(document: Document): Document {
    documentsById[document.id] = document
    return document
  }

  override fun findByWorkpaper(tenantId: UUID, workpaperId: UUID): List<Document> =
    documentsById.values
      .filter { it.tenantId == tenantId && it.workpaperId == workpaperId }
      .sortedWith(compareByDescending<Document> { it.createdAt }.thenByDescending { it.id })

  override fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): Map<UUID, List<Document>> =
    emptyMap()

  override fun findByIdWithinClosingFolder(tenantId: UUID, closingFolderId: UUID, documentId: UUID): Document? =
    documentsById[documentId]?.takeIf { it.tenantId == tenantId }

  fun createdDocuments(): List<Document> = documentsById.values.toList()
}

private class RecordingBinaryObjectStore(
  private val failOnStore: Boolean = false
) : BinaryObjectStore {
  val storedObjects = linkedMapOf<String, ByteArray>()
  val deletedObjectKeys = mutableListOf<String>()

  override fun storageBackend(): DocumentStorageBackend = DocumentStorageBackend.LOCAL_FS

  override fun store(command: StoreBinaryObjectCommand): StoredBinaryObject {
    if (failOnStore) {
      throw IllegalStateException("intentional storage failure")
    }

    val bytes = command.inputStream.use(InputStream::readAllBytes)
    storedObjects[command.objectKey] = bytes
    return StoredBinaryObject(
      storageBackend = storageBackend(),
      storageObjectKey = command.objectKey,
      mediaType = command.mediaType,
      byteSize = bytes.size.toLong(),
      checksumSha256 = java.security.MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { "%02x".format(it) }
    )
  }

  override fun open(objectKey: String): BinaryObjectContent =
    BinaryObjectContent(ByteArrayInputStream(storedObjects.getValue(objectKey)))

  override fun deleteIfExists(objectKey: String) {
    deletedObjectKeys.add(objectKey)
    storedObjects.remove(objectKey)
  }
}

private class DocumentServiceRecordingAuditTrail : AuditTrail {
  val commands = mutableListOf<AppendAuditEventCommand>()

  override fun append(command: AppendAuditEventCommand): UUID {
    commands.add(command)
    return UUID.randomUUID()
  }
}

private class NoOpTransactionManager : PlatformTransactionManager {
  override fun getTransaction(definition: TransactionDefinition?): TransactionStatus =
    SimpleTransactionStatus()

  override fun commit(status: TransactionStatus) = Unit

  override fun rollback(status: TransactionStatus) = Unit
}
