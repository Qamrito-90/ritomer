package ch.qamwaq.ritomer.workpapers.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.controls.access.ClosingControlsSnapshot
import ch.qamwaq.ritomer.controls.access.ControlsAccess
import ch.qamwaq.ritomer.controls.access.ControlsReadiness
import ch.qamwaq.ritomer.financials.access.WorkpaperAnchorAccess
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContextProvider
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.workpapers.domain.Document
import ch.qamwaq.ritomer.workpapers.domain.DocumentStorageBackend
import ch.qamwaq.ritomer.workpapers.domain.DocumentVerificationStatus
import ch.qamwaq.ritomer.workpapers.domain.Workpaper
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatus
import java.io.IOException
import java.io.InputStream
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.multipart.MultipartFile

data class DocumentSummary(
  val id: UUID,
  val fileName: String,
  val mediaType: String,
  val byteSize: Long,
  val checksumSha256: String,
  val sourceLabel: String,
  val documentDate: LocalDate?,
  val createdAt: OffsetDateTime,
  val createdByUserId: UUID,
  val verificationStatus: DocumentVerificationStatus,
  val reviewComment: String?,
  val reviewedAt: OffsetDateTime?,
  val reviewedByUserId: UUID?
)

data class WorkpaperDocumentsView(
  val closingFolderId: UUID,
  val anchorCode: String,
  val isCurrentStructure: Boolean,
  val documents: List<DocumentSummary>
)

data class UploadDocumentCommand(
  val sourceLabel: String,
  val documentDate: LocalDate?
)

data class DocumentVerificationDecisionCommand(
  val decision: DocumentVerificationStatus,
  val comment: String?
)

data class DownloadedDocument(
  val document: DocumentSummary,
  val inputStream: InputStream
)

@Service
class DocumentService(
  private val controlsAccess: ControlsAccess,
  private val workpaperAnchorAccess: WorkpaperAnchorAccess,
  private val workpaperRepository: WorkpaperRepository,
  private val documentRepository: DocumentRepository,
  private val binaryObjectStore: BinaryObjectStore,
  private val auditTrail: AuditTrail,
  private val auditCorrelationContextProvider: AuditCorrelationContextProvider,
  private val transactionTemplate: TransactionTemplate
) {
  fun listDocuments(
    access: TenantAccessContext,
    closingFolderId: UUID,
    anchorCode: String
  ): WorkpaperDocumentsView {
    requireAnyRole(access, READ_ROLES, "document list")
    val normalizedAnchorCode = normalizeRequired(anchorCode, "anchorCode")
    val workpaper = workpaperRepository.findByAnchorCode(access.tenantId, closingFolderId, normalizedAnchorCode)
      ?: throw DocumentNotFoundException("workpaper not found for anchor.")
    val currentAnchorCodes = currentAnchorCodes(access.tenantId, closingFolderId)

    return WorkpaperDocumentsView(
      closingFolderId = closingFolderId,
      anchorCode = normalizedAnchorCode,
      isCurrentStructure = normalizedAnchorCode in currentAnchorCodes,
      documents = documentRepository.findByWorkpaper(access.tenantId, workpaper.id).map { it.toSummary() }
    )
  }

  fun downloadDocument(
    access: TenantAccessContext,
    closingFolderId: UUID,
    documentId: UUID
  ): DownloadedDocument {
    requireAnyRole(access, READ_ROLES, "document content")
    val document = documentRepository.findByIdWithinClosingFolder(access.tenantId, closingFolderId, documentId)
      ?: throw DocumentNotFoundException("document not found.")

    if (document.storageBackend != binaryObjectStore.storageBackend()) {
      throw DocumentStorageException(
        "Configured binary store ${binaryObjectStore.storageBackend()} cannot open document stored as ${document.storageBackend}."
      )
    }

    return DownloadedDocument(
      document = document.toSummary(),
      inputStream = binaryObjectStore.open(document.storageObjectKey).inputStream
    )
  }

  fun uploadDocument(
    access: TenantAccessContext,
    closingFolderId: UUID,
    anchorCode: String,
    file: MultipartFile,
    command: UploadDocumentCommand
  ): DocumentSummary {
    requireAnyRole(access, MAKER_ROLES, "document upload")

    val normalizedAnchorCode = normalizeRequired(anchorCode, "anchorCode")
    val normalizedSourceLabel = normalizeRequired(command.sourceLabel, "sourceLabel")
    val normalizedFileName = normalizeFileName(file.originalFilename)
    val normalizedMediaType = normalizeAllowedMediaType(file.contentType)
    validateFileSize(file.size)
    val uploadTarget = resolveUploadTarget(access, closingFolderId, normalizedAnchorCode)
    val documentId = UUID.randomUUID()
    val storageObjectKey = buildStorageObjectKey(access.tenantId, closingFolderId, uploadTarget.workpaper.id, documentId)

    val storedObject = try {
      file.inputStream.use { inputStream ->
        binaryObjectStore.store(
          StoreBinaryObjectCommand(
            objectKey = storageObjectKey,
            mediaType = normalizedMediaType,
            inputStream = inputStream
          )
        )
      }
    } catch (exception: IOException) {
      logger.error(
        "Document upload storage write failed: tenantId={}, closingFolderId={}, anchorCode={}, documentId={}, reason={}",
        access.tenantId,
        closingFolderId,
        normalizedAnchorCode,
        documentId,
        exception.message
      )
      throw DocumentStorageException("Document binary could not be stored.", exception)
    } catch (exception: RuntimeException) {
      logger.error(
        "Document upload storage write failed: tenantId={}, closingFolderId={}, anchorCode={}, documentId={}, reason={}",
        access.tenantId,
        closingFolderId,
        normalizedAnchorCode,
        documentId,
        exception.message
      )
      throw DocumentStorageException("Document binary could not be stored.", exception)
    }

    return try {
      transactionTemplate.execute {
        persistUploadedDocument(
          access = access,
          closingFolderId = closingFolderId,
          anchorCode = normalizedAnchorCode,
          documentId = documentId,
          fileName = normalizedFileName,
          sourceLabel = normalizedSourceLabel,
          documentDate = command.documentDate,
          storedObject = storedObject
        )
      } ?: error("Document upload transaction returned null.")
    } catch (exception: RuntimeException) {
      compensateStorageFailure(access, closingFolderId, normalizedAnchorCode, documentId, storedObject.storageObjectKey)
      throw exception
    }
  }

  @Transactional
  fun reviewVerificationDecision(
    access: TenantAccessContext,
    closingFolderId: UUID,
    documentId: UUID,
    command: DocumentVerificationDecisionCommand
  ): DocumentSummary {
    requireAnyRole(access, REVIEWER_ROLES, "document verification")
    if (command.decision !in REVIEWER_ALLOWED_STATUSES) {
      throw DocumentBadRequestException("decision is not accepted by verification-decision.")
    }

    val normalizedComment = when (command.decision) {
      DocumentVerificationStatus.REJECTED -> normalizeRequired(command.comment, "comment")
      DocumentVerificationStatus.VERIFIED -> {
        if (normalizeOptional(command.comment) != null) {
          throw DocumentBadRequestException("comment is not accepted when decision is VERIFIED.")
        }
        null
      }
      else -> throw DocumentBadRequestException("decision is not accepted by verification-decision.")
    }

    val target = resolveVerificationTarget(access, closingFolderId, documentId)
    val existing = target.document
    if (existing.verificationStatus == command.decision && existing.reviewComment == normalizedComment) {
      return existing.toSummary()
    }

    val reviewedAt = OffsetDateTime.now(ZoneOffset.UTC)
    val updated = documentRepository.updateVerification(
      existing.copy(
        verificationStatus = command.decision,
        reviewComment = normalizedComment,
        reviewedAt = reviewedAt,
        reviewedByUserId = access.actorUserId
      )
    )
    appendVerificationUpdatedAudit(access, closingFolderId, target.workpaper, before = existing, after = updated)
    return updated.toSummary()
  }

  private fun persistUploadedDocument(
    access: TenantAccessContext,
    closingFolderId: UUID,
    anchorCode: String,
    documentId: UUID,
    fileName: String,
    sourceLabel: String,
    documentDate: LocalDate?,
    storedObject: StoredBinaryObject
  ): DocumentSummary {
    val uploadTarget = resolveUploadTarget(access, closingFolderId, anchorCode)
    val now = OffsetDateTime.now(ZoneOffset.UTC)
    val document = Document(
      id = documentId,
      tenantId = access.tenantId,
      workpaperId = uploadTarget.workpaper.id,
      storageBackend = storedObject.storageBackend,
      storageObjectKey = storedObject.storageObjectKey,
      fileName = fileName,
      mediaType = storedObject.mediaType,
      byteSize = storedObject.byteSize,
      checksumSha256 = storedObject.checksumSha256,
      sourceLabel = sourceLabel,
      documentDate = documentDate,
      createdAt = now,
      createdByUserId = access.actorUserId
    )
    val created = documentRepository.create(document)
    appendCreatedAudit(access, closingFolderId, uploadTarget.workpaper, created)
    return created.toSummary()
  }

  private fun resolveUploadTarget(
    access: TenantAccessContext,
    closingFolderId: UUID,
    anchorCode: String
  ): UploadTarget {
    val controls = controlsAccess.getSnapshot(access, closingFolderId)
    ensureWritable(controls)
    val workpaper = workpaperRepository.findByAnchorCode(access.tenantId, closingFolderId, anchorCode)
      ?: throw DocumentNotFoundException("workpaper not found for anchor.")
    val currentAnchorCodes = currentAnchorCodes(access.tenantId, closingFolderId)
    if (anchorCode !in currentAnchorCodes) {
      throw DocumentConflictException("anchorCode is not part of the current structure.")
    }
    if (workpaper.status !in MAKER_EDITABLE_STATUSES) {
      throw DocumentConflictException("workpaper status does not allow document uploads.")
    }
    return UploadTarget(workpaper)
  }

  private fun resolveVerificationTarget(
    access: TenantAccessContext,
    closingFolderId: UUID,
    documentId: UUID
  ): VerificationTarget {
    val controls = controlsAccess.getSnapshot(access, closingFolderId)
    ensureWritable(controls)
    val document = documentRepository.findByIdWithinClosingFolder(access.tenantId, closingFolderId, documentId)
      ?: throw DocumentNotFoundException("document not found.")
    val workpaper = workpaperRepository.findById(access.tenantId, document.workpaperId)
      ?: throw DocumentNotFoundException("workpaper not found for document.")
    val currentAnchorCodes = currentAnchorCodes(access.tenantId, closingFolderId)
    if (workpaper.anchorCode !in currentAnchorCodes) {
      throw DocumentConflictException("document belongs to a stale workpaper.")
    }
    if (workpaper.status != WorkpaperStatus.READY_FOR_REVIEW) {
      throw DocumentConflictException("document verification requires a workpaper in READY_FOR_REVIEW.")
    }
    return VerificationTarget(document, workpaper)
  }

  private fun currentAnchorCodes(tenantId: UUID, closingFolderId: UUID): Set<String> =
    workpaperAnchorAccess.getCurrentAnchors(tenantId, closingFolderId).anchors.asSequence().map { it.code }.toSet()

  private fun ensureWritable(controls: ClosingControlsSnapshot) {
    if (controls.closingFolderStatus == ClosingFolderAccessStatus.ARCHIVED) {
      throw DocumentConflictException("Closing folder is archived and documents cannot be modified.")
    }
    if (controls.readiness != ControlsReadiness.READY) {
      throw DocumentConflictException("Documents can only be modified when controls.readiness is READY.")
    }
  }

  private fun appendCreatedAudit(
    access: TenantAccessContext,
    closingFolderId: UUID,
    workpaper: Workpaper,
    document: Document
  ) {
    auditTrail.append(
      AppendAuditEventCommand(
        tenantId = access.tenantId,
        actorUserId = access.actorUserId,
        actorSubject = access.actorSubject,
        actorRoles = access.effectiveRoles,
        correlation = auditCorrelationContextProvider.currentCorrelationContext(),
        action = DOCUMENT_CREATED_ACTION,
        resourceType = DOCUMENT_RESOURCE_TYPE,
        resourceId = document.id.toString(),
        metadata = mapOf(
          "closingFolderId" to closingFolderId.toString(),
          "workpaperId" to workpaper.id.toString(),
          "anchorCode" to workpaper.anchorCode,
          "fileName" to document.fileName,
          "mediaType" to document.mediaType,
          "byteSize" to document.byteSize,
          "checksumSha256" to document.checksumSha256,
          "sourceLabel" to document.sourceLabel,
          "documentDate" to document.documentDate?.toString(),
          "storageBackend" to document.storageBackend.name
        )
      )
    )
  }

  private fun appendVerificationUpdatedAudit(
    access: TenantAccessContext,
    closingFolderId: UUID,
    workpaper: Workpaper,
    before: Document,
    after: Document
  ) {
    auditTrail.append(
      AppendAuditEventCommand(
        tenantId = access.tenantId,
        actorUserId = access.actorUserId,
        actorSubject = access.actorSubject,
        actorRoles = access.effectiveRoles,
        correlation = auditCorrelationContextProvider.currentCorrelationContext(),
        action = DOCUMENT_VERIFICATION_UPDATED_ACTION,
        resourceType = DOCUMENT_RESOURCE_TYPE,
        resourceId = after.id.toString(),
        metadata = mapOf(
          "closingFolderId" to closingFolderId.toString(),
          "workpaperId" to workpaper.id.toString(),
          "anchorCode" to workpaper.anchorCode,
          "verificationStatus" to mapOf("before" to before.verificationStatus.name, "after" to after.verificationStatus.name),
          "reviewComment" to mapOf("before" to before.reviewComment, "after" to after.reviewComment),
          "reviewedAt" to after.reviewedAt?.toString(),
          "reviewedByUserId" to after.reviewedByUserId?.toString()
        )
      )
    )
  }

  private fun compensateStorageFailure(
    access: TenantAccessContext,
    closingFolderId: UUID,
    anchorCode: String,
    documentId: UUID,
    storageObjectKey: String
  ) {
    try {
      binaryObjectStore.deleteIfExists(storageObjectKey)
    } catch (compensationException: RuntimeException) {
      logger.error(
        "Document upload compensation failed: tenantId={}, closingFolderId={}, anchorCode={}, documentId={}, storageObjectKey={}, reason={}",
        access.tenantId,
        closingFolderId,
        anchorCode,
        documentId,
        storageObjectKey,
        compensationException.message
      )
    }
  }

  private fun normalizeAllowedMediaType(rawValue: String?): String {
    val normalized = normalizeRequired(rawValue?.substringBefore(";"), "file.mediaType").lowercase()
    if (normalized !in ALLOWED_MEDIA_TYPES) {
      throw DocumentBadRequestException("file.mediaType is not allowed.")
    }
    return normalized
  }

  private fun validateFileSize(byteSize: Long) {
    if (byteSize <= 0) {
      throw DocumentBadRequestException("file must not be empty.")
    }
    if (byteSize > MAX_FILE_SIZE_BYTES) {
      throw DocumentPayloadTooLargeException("file exceeds the 25 MiB limit.")
    }
  }

  private fun normalizeFileName(originalFilename: String?): String {
    val lastSegment = originalFilename
      ?.replace('\\', '/')
      ?.substringAfterLast('/')
      ?.trim()
      .orEmpty()
    val cleaned = lastSegment
      .map { character ->
        when {
          character.code < 32 -> '_'
          character in setOf('\\', '/', ':', '*', '?', '"', '<', '>', '|') -> '_'
          else -> character
        }
      }
      .joinToString("")
      .replace(WHITESPACE_REGEX, " ")
      .trim()
      .trim('.')
      .take(MAX_FILE_NAME_LENGTH)

    return cleaned.ifBlank { DEFAULT_FILE_NAME }
  }

  private fun buildStorageObjectKey(
    tenantId: UUID,
    closingFolderId: UUID,
    workpaperId: UUID,
    documentId: UUID
  ): String =
    "tenants/$tenantId/closing-folders/$closingFolderId/workpapers/$workpaperId/documents/$documentId"

  private fun normalizeRequired(rawValue: String?, fieldName: String): String =
    rawValue?.trim()?.takeUnless { it.isEmpty() }
      ?: throw DocumentBadRequestException("$fieldName must not be blank.")

  private fun normalizeOptional(rawValue: String?): String? =
    rawValue?.trim()?.takeUnless { it.isEmpty() }

  private fun requireAnyRole(access: TenantAccessContext, allowedRoles: Set<String>, operation: String) {
    if (access.effectiveRoles.none { it in allowedRoles }) {
      throw AccessDeniedException("Insufficient role for $operation.")
    }
  }

  private fun Document.toSummary(): DocumentSummary =
    DocumentSummary(
      id = id,
      fileName = fileName,
      mediaType = mediaType,
      byteSize = byteSize,
      checksumSha256 = checksumSha256,
      sourceLabel = sourceLabel,
      documentDate = documentDate,
      createdAt = createdAt,
      createdByUserId = createdByUserId,
      verificationStatus = verificationStatus,
      reviewComment = reviewComment,
      reviewedAt = reviewedAt,
      reviewedByUserId = reviewedByUserId
    )

  private data class UploadTarget(
    val workpaper: Workpaper
  )

  private data class VerificationTarget(
    val document: Document,
    val workpaper: Workpaper
  )

  companion object {
    private val logger = LoggerFactory.getLogger(DocumentService::class.java)
    private const val MAX_FILE_SIZE_BYTES = 25L * 1024L * 1024L
    private const val MAX_FILE_NAME_LENGTH = 255
    private const val DEFAULT_FILE_NAME = "document"
    private val WHITESPACE_REGEX = Regex("\\s+")
    private val READ_ROLES = setOf("ACCOUNTANT", "REVIEWER", "MANAGER", "ADMIN")
    private val MAKER_ROLES = setOf("ACCOUNTANT", "MANAGER", "ADMIN")
    private val REVIEWER_ROLES = setOf("REVIEWER", "MANAGER", "ADMIN")
    private val MAKER_EDITABLE_STATUSES = setOf(WorkpaperStatus.DRAFT, WorkpaperStatus.CHANGES_REQUESTED)
    private val REVIEWER_ALLOWED_STATUSES = setOf(DocumentVerificationStatus.VERIFIED, DocumentVerificationStatus.REJECTED)
    private val ALLOWED_MEDIA_TYPES = setOf(
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/tiff",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
  }
}

@ResponseStatus(HttpStatus.BAD_REQUEST)
class DocumentBadRequestException(message: String) : RuntimeException(message)

@ResponseStatus(HttpStatus.CONFLICT)
class DocumentConflictException(message: String) : RuntimeException(message)

@ResponseStatus(HttpStatus.NOT_FOUND)
class DocumentNotFoundException(message: String) : RuntimeException(message)

@ResponseStatus(HttpStatus.PAYLOAD_TOO_LARGE)
class DocumentPayloadTooLargeException(message: String) : RuntimeException(message)

@ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
class DocumentStorageException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)
