package ch.qamwaq.ritomer.exports.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccess
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.controls.access.ControlsReadModel
import ch.qamwaq.ritomer.controls.access.ControlsReadModelAccess
import ch.qamwaq.ritomer.exports.domain.ExportPack
import ch.qamwaq.ritomer.financials.access.FinancialSummaryReadModel
import ch.qamwaq.ritomer.financials.access.FinancialSummaryReadModelAccess
import ch.qamwaq.ritomer.financials.access.StructuredFinancialStatementsReadModel
import ch.qamwaq.ritomer.financials.access.StructuredFinancialStatementsReadModelAccess
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContextProvider
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.workpapers.access.CurrentDocumentReadModel
import ch.qamwaq.ritomer.workpapers.access.CurrentDocumentVerificationSummaryReadModel
import ch.qamwaq.ritomer.workpapers.access.CurrentPersistedWorkpaperReadModel
import ch.qamwaq.ritomer.workpapers.access.CurrentWorkpaperEvidenceReadModel
import ch.qamwaq.ritomer.workpapers.access.CurrentWorkpapersReadModel
import ch.qamwaq.ritomer.workpapers.access.WorkpapersExportAccess
import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionTemplate
import org.springframework.web.bind.annotation.ResponseStatus

data class ExportPackSummary(
  val exportPackId: UUID,
  val closingFolderId: UUID,
  val fileName: String,
  val mediaType: String,
  val byteSize: Long,
  val checksumSha256: String,
  val basisImportVersion: Int,
  val basisTaxonomyVersion: Int,
  val createdAt: OffsetDateTime,
  val createdByUserId: UUID
)

data class CreateExportPackResult(
  val exportPack: ExportPackSummary,
  val outcome: CreateExportPackOutcome
)

enum class CreateExportPackOutcome {
  CREATED,
  REPLAYED
}

data class DownloadedExportPack(
  val exportPack: ExportPackSummary,
  val inputStream: java.io.InputStream
)

@Service
class ExportPackService(
  private val closingFolderAccess: ClosingFolderAccess,
  private val controlsReadModelAccess: ControlsReadModelAccess,
  private val financialSummaryReadModelAccess: FinancialSummaryReadModelAccess,
  private val structuredFinancialStatementsReadModelAccess: StructuredFinancialStatementsReadModelAccess,
  private val workpapersExportAccess: WorkpapersExportAccess,
  private val exportPackRepository: ExportPackRepository,
  private val exportPackStorage: ExportPackStorage,
  objectMapper: ObjectMapper,
  private val auditTrail: AuditTrail,
  private val auditCorrelationContextProvider: AuditCorrelationContextProvider,
  private val transactionTemplate: TransactionTemplate
) {
  private val jsonWriter = objectMapper.copy()
    .setSerializationInclusion(JsonInclude.Include.ALWAYS)
    .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true)
    .writer()

  fun createExportPack(
    access: TenantAccessContext,
    closingFolderId: UUID,
    idempotencyKey: String
  ): CreateExportPackResult =
    synchronized(lockFor(access.tenantId, closingFolderId)) {
      createExportPackLocked(access, closingFolderId, idempotencyKey)
    }

  private fun createExportPackLocked(
    access: TenantAccessContext,
    closingFolderId: UUID,
    idempotencyKey: String
  ): CreateExportPackResult {
    requireAnyRole(access, CREATE_ROLES, "export pack generation")
    val normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey)
    val closingFolder = closingFolderAccess.lockRequired(access.tenantId, closingFolderId)
    val existing = exportPackRepository.findByIdempotencyKey(access.tenantId, closingFolderId, normalizedIdempotencyKey)

    if (existing != null) {
      val frozenSource = freezeSource(access, closingFolderId)
      if (existing.sourceFingerprint != frozenSource.sourceFingerprint) {
        throw ExportPackConflictException("Idempotency-Key is already bound to a different logical intention.")
      }
      return CreateExportPackResult(existing.toSummary(), CreateExportPackOutcome.REPLAYED)
    }

    if (closingFolder.status == ClosingFolderAccessStatus.ARCHIVED) {
      throw ExportPackConflictException("Closing folder is archived and export pack generation is not allowed.")
    }

    val frozenSource = freezeSource(access, closingFolderId)
    if (frozenSource.controls.readiness != READY_STATUS) {
      throw ExportPackConflictException("Export pack generation requires controls.readiness to be READY.")
    }

    val exportPackId = UUID.randomUUID()
    val createdAt = OffsetDateTime.now(ZoneOffset.UTC)
    val storageObjectKey = buildStorageObjectKey(access.tenantId, closingFolderId, exportPackId)
    val archiveBytes = buildArchive(exportPackId, access, createdAt, frozenSource)
    val storedObject = try {
      archiveBytes.inputStream().use { inputStream ->
        exportPackStorage.store(
          StoreExportPackCommand(
            objectKey = storageObjectKey,
            mediaType = ZIP_MEDIA_TYPE,
            inputStream = inputStream
          )
        )
      }
    } catch (exception: RuntimeException) {
      logger.error(
        "Export pack storage write failed: tenantId={}, closingFolderId={}, exportPackId={}, reason={}",
        access.tenantId,
        closingFolderId,
        exportPackId,
        exception.message
      )
      throw ExportPackStorageException("Export pack archive could not be stored.", exception)
    }

    val exportPack = ExportPack(
      id = exportPackId,
      tenantId = access.tenantId,
      closingFolderId = closingFolderId,
      idempotencyKey = normalizedIdempotencyKey,
      sourceFingerprint = frozenSource.sourceFingerprint,
      storageBackend = storedObject.storageBackend,
      storageObjectKey = storedObject.storageObjectKey,
      fileName = buildFileName(closingFolderId, exportPackId),
      mediaType = storedObject.mediaType,
      byteSize = storedObject.byteSize,
      checksumSha256 = storedObject.checksumSha256,
      basisImportVersion = frozenSource.basisImportVersion,
      basisTaxonomyVersion = frozenSource.basisTaxonomyVersion,
      createdAt = createdAt,
      createdByUserId = access.actorUserId
    )

    return try {
      transactionTemplate.execute {
        try {
          val created = exportPackRepository.create(exportPack)
          appendCreatedAudit(access, created)
          CreateExportPackResult(created.toSummary(), CreateExportPackOutcome.CREATED)
        } catch (exception: ExportPackAlreadyExistsException) {
          val persisted = exportPackRepository.findByIdempotencyKey(access.tenantId, closingFolderId, normalizedIdempotencyKey)
            ?: throw exception
          if (persisted.sourceFingerprint != frozenSource.sourceFingerprint) {
            throw ExportPackConflictException("Idempotency-Key is already bound to a different logical intention.")
          }
          CreateExportPackResult(persisted.toSummary(), CreateExportPackOutcome.REPLAYED)
        }
      } ?: error("Export pack transaction returned null.")
    } catch (exception: RuntimeException) {
      compensateStorageFailure(exportPack)
      throw exception
    }
  }

  fun listExportPacks(access: TenantAccessContext, closingFolderId: UUID): List<ExportPackSummary> {
    requireAnyRole(access, READ_ROLES, "export pack list")
    closingFolderAccess.getRequired(access.tenantId, closingFolderId)
    return exportPackRepository.findByClosingFolder(access.tenantId, closingFolderId).map { it.toSummary() }
  }

  fun getExportPack(access: TenantAccessContext, closingFolderId: UUID, exportPackId: UUID): ExportPackSummary {
    requireAnyRole(access, READ_ROLES, "export pack detail")
    closingFolderAccess.getRequired(access.tenantId, closingFolderId)
    return exportPackRepository.findById(access.tenantId, closingFolderId, exportPackId)?.toSummary()
      ?: throw ExportPackNotFoundException("Export pack not found.")
  }

  fun downloadExportPack(access: TenantAccessContext, closingFolderId: UUID, exportPackId: UUID): DownloadedExportPack {
    requireAnyRole(access, READ_ROLES, "export pack content")
    closingFolderAccess.getRequired(access.tenantId, closingFolderId)
    val exportPack = exportPackRepository.findById(access.tenantId, closingFolderId, exportPackId)
      ?: throw ExportPackNotFoundException("Export pack not found.")

    if (exportPack.storageBackend != exportPackStorage.storageBackendCode()) {
      throw ExportPackStorageException(
        "Configured export pack store ${exportPackStorage.storageBackendCode()} cannot open pack stored as ${exportPack.storageBackend}."
      )
    }

    return DownloadedExportPack(
      exportPack = exportPack.toSummary(),
      inputStream = exportPackStorage.open(exportPack.storageObjectKey).inputStream
    )
  }

  private fun freezeSource(access: TenantAccessContext, closingFolderId: UUID): FrozenExportSource {
    val controls = controlsReadModelAccess.getReadModel(access, closingFolderId)
    val financialSummary = financialSummaryReadModelAccess.getReadModel(access, closingFolderId)
    val structuredStatements = structuredFinancialStatementsReadModelAccess.getReadModel(access, closingFolderId)
    val currentWorkpapers = workpapersExportAccess.getCurrentPersistedWorkpapers(access, closingFolderId)

    val basisImportVersion = structuredStatements.latestImportVersion
      ?: throw ExportPackConflictException("basisImportVersion is required to generate an export pack.")
    val basisTaxonomyVersion = structuredStatements.taxonomyVersion

    ensureBasisCoherence(
      controls = controls,
      financialSummary = financialSummary,
      structuredStatements = structuredStatements,
      currentWorkpapers = currentWorkpapers,
      basisImportVersion = basisImportVersion,
      basisTaxonomyVersion = basisTaxonomyVersion
    )

    val sourceFingerprint = sha256(
      jsonWriter.writeValueAsBytes(
        SourceFingerprintPayload(
          basisImportVersion = basisImportVersion,
          basisTaxonomyVersion = basisTaxonomyVersion,
          workpapers = currentWorkpapers.items
            .sortedWith(compareBy<CurrentPersistedWorkpaperReadModel> { it.anchorCode }.thenBy { it.workpaperId })
            .map { workpaper ->
              FingerprintWorkpaper(
                anchorCode = workpaper.anchorCode,
                anchorLabel = workpaper.anchorLabel,
                summaryBucketCode = workpaper.summaryBucketCode,
                statementKind = workpaper.statementKind,
                breakdownType = workpaper.breakdownType,
                workpaperId = workpaper.workpaperId,
                noteText = workpaper.noteText,
                status = workpaper.status,
                reviewComment = workpaper.reviewComment,
                basisImportVersion = workpaper.basisImportVersion,
                basisTaxonomyVersion = workpaper.basisTaxonomyVersion,
                createdAt = workpaper.createdAt,
                createdByUserId = workpaper.createdByUserId,
                updatedAt = workpaper.updatedAt,
                updatedByUserId = workpaper.updatedByUserId,
                reviewedAt = workpaper.reviewedAt,
                reviewedByUserId = workpaper.reviewedByUserId,
                evidences = workpaper.evidences,
                documentVerificationSummary = workpaper.documentVerificationSummary,
                documents = workpaper.documents
                  .sortedBy { it.documentId }
                  .map { document ->
                    FingerprintDocument(
                      documentId = document.documentId,
                      fileName = document.fileName,
                      mediaType = document.mediaType,
                      byteSize = document.byteSize,
                      checksumSha256 = document.checksumSha256,
                      sourceLabel = document.sourceLabel,
                      documentDate = document.documentDate,
                      createdAt = document.createdAt,
                      createdByUserId = document.createdByUserId,
                      verificationStatus = document.verificationStatus,
                      reviewComment = document.reviewComment,
                      reviewedAt = document.reviewedAt,
                      reviewedByUserId = document.reviewedByUserId,
                      archivePath = buildArchivePath(workpaper.workpaperId, document.documentId, document.fileName)
                    )
                  }
              )
            }
        )
      )
    )

    return FrozenExportSource(
      controls = controls,
      financialSummary = financialSummary,
      structuredStatements = structuredStatements,
      currentWorkpapers = currentWorkpapers,
      basisImportVersion = basisImportVersion,
      basisTaxonomyVersion = basisTaxonomyVersion,
      sourceFingerprint = sourceFingerprint
    )
  }

  private fun ensureBasisCoherence(
    controls: ControlsReadModel,
    financialSummary: FinancialSummaryReadModel,
    structuredStatements: StructuredFinancialStatementsReadModel,
    currentWorkpapers: CurrentWorkpapersReadModel,
    basisImportVersion: Int,
    basisTaxonomyVersion: Int
  ) {
    if (controls.latestImportVersion != basisImportVersion) {
      throw ExportPackConflictException("controls.latestImportVersion is not coherent with the pack basisImportVersion.")
    }
    if (financialSummary.latestImportVersion != basisImportVersion) {
      throw ExportPackConflictException("financial-summary.latestImportVersion is not coherent with the pack basisImportVersion.")
    }
    if (structuredStatements.latestImportVersion != basisImportVersion) {
      throw ExportPackConflictException("financial-statements-structured.latestImportVersion is not coherent with the pack basisImportVersion.")
    }
    currentWorkpapers.items.forEach { workpaper ->
      if (workpaper.basisImportVersion != basisImportVersion || workpaper.basisTaxonomyVersion != basisTaxonomyVersion) {
        throw ExportPackConflictException("A current workpaper is not coherent with the pack basisImportVersion / basisTaxonomyVersion pair.")
      }
    }
  }

  private fun buildArchive(
    exportPackId: UUID,
    access: TenantAccessContext,
    createdAt: OffsetDateTime,
    frozenSource: FrozenExportSource
  ): ByteArray {
    val manifest = buildManifest(exportPackId, access, createdAt, frozenSource)
    val entries = mutableListOf<ArchiveEntry>()
    entries += ArchiveEntry(MANIFEST_PATH, jsonWriter.writeValueAsBytes(manifest))
    entries += ArchiveEntry(CONTROLS_PATH, jsonWriter.writeValueAsBytes(frozenSource.controls))
    entries += ArchiveEntry(FINANCIAL_SUMMARY_PATH, jsonWriter.writeValueAsBytes(frozenSource.financialSummary))
    entries += ArchiveEntry(STRUCTURED_FINANCIALS_PATH, jsonWriter.writeValueAsBytes(frozenSource.structuredStatements))
    entries += ArchiveEntry(WORKPAPERS_CURRENT_PATH, jsonWriter.writeValueAsBytes(frozenSource.currentWorkpapers))
    frozenSource.currentWorkpapers.items.forEach { workpaper ->
      workpaper.documents.sortedBy { it.documentId }.forEach { document ->
        val binary = try {
          workpapersExportAccess.openSelectedDocument(access, UUID.fromString(frozenSource.currentWorkpapers.closingFolderId), UUID.fromString(document.documentId))
        } catch (exception: RuntimeException) {
          throw ExportPackStorageException("A selected document binary could not be read.", exception)
        }
        val bytes = try {
          binary.inputStream.use { it.readAllBytes() }
        } catch (exception: IOException) {
          throw ExportPackStorageException("A selected document binary could not be read.", exception)
        }
        entries += ArchiveEntry(
          buildArchivePath(workpaper.workpaperId, document.documentId, document.fileName),
          bytes
        )
      }
    }

    return ByteArrayOutputStream().use { output ->
      ZipOutputStream(output, StandardCharsets.UTF_8).use { zip ->
        entries.sortedBy { it.path }.forEach { entry ->
          writeStoredEntry(zip, entry)
        }
      }
      output.toByteArray()
    }
  }

  private fun buildManifest(
    exportPackId: UUID,
    access: TenantAccessContext,
    createdAt: OffsetDateTime,
    frozenSource: FrozenExportSource
  ): ExportPackManifest {
    val documents = frozenSource.currentWorkpapers.items.flatMap { it.documents }
    return ExportPackManifest(
      exportPackId = exportPackId.toString(),
      closingFolderId = frozenSource.currentWorkpapers.closingFolderId,
      closingFolderStatus = frozenSource.currentWorkpapers.closingFolderStatus,
      generatedAt = createdAt.toString(),
      generatedByUserId = access.actorUserId.toString(),
      basisImportVersion = frozenSource.basisImportVersion,
      basisTaxonomyVersion = frozenSource.basisTaxonomyVersion,
      controlsReadiness = frozenSource.controls.readiness,
      includesStaleWorkpapers = false,
      paths = ExportPackPaths(
        controls = CONTROLS_PATH,
        financialSummary = FINANCIAL_SUMMARY_PATH,
        financialStatementsStructured = STRUCTURED_FINANCIALS_PATH,
        workpapersCurrent = WORKPAPERS_CURRENT_PATH
      ),
      summary = ExportPackManifestSummary(
        currentWorkpapersCount = frozenSource.currentWorkpapers.items.size,
        documentsCount = documents.size,
        unverifiedDocumentsCount = documents.count { it.verificationStatus == UNVERIFIED_STATUS },
        verifiedDocumentsCount = documents.count { it.verificationStatus == VERIFIED_STATUS },
        rejectedDocumentsCount = documents.count { it.verificationStatus == REJECTED_STATUS }
      ),
      workpapers = frozenSource.currentWorkpapers.items
        .sortedWith(compareBy<CurrentPersistedWorkpaperReadModel> { it.anchorCode }.thenBy { it.workpaperId })
        .map { workpaper ->
          ExportPackManifestWorkpaper(
            anchorCode = workpaper.anchorCode,
            anchorLabel = workpaper.anchorLabel,
            summaryBucketCode = workpaper.summaryBucketCode,
            statementKind = workpaper.statementKind,
            breakdownType = workpaper.breakdownType,
            workpaperId = workpaper.workpaperId,
            status = workpaper.status,
            noteText = workpaper.noteText,
            reviewComment = workpaper.reviewComment,
            basisImportVersion = workpaper.basisImportVersion,
            basisTaxonomyVersion = workpaper.basisTaxonomyVersion,
            createdAt = workpaper.createdAt,
            createdByUserId = workpaper.createdByUserId,
            updatedAt = workpaper.updatedAt,
            updatedByUserId = workpaper.updatedByUserId,
            reviewedAt = workpaper.reviewedAt,
            reviewedByUserId = workpaper.reviewedByUserId,
            documentVerificationSummary = workpaper.documentVerificationSummary,
            evidences = workpaper.evidences,
            documents = workpaper.documents
              .sortedBy { it.documentId }
              .map { document ->
                ExportPackManifestDocument(
                  documentId = document.documentId,
                  fileName = document.fileName,
                  mediaType = document.mediaType,
                  byteSize = document.byteSize,
                  checksumSha256 = document.checksumSha256,
                  sourceLabel = document.sourceLabel,
                  documentDate = document.documentDate,
                  createdAt = document.createdAt,
                  createdByUserId = document.createdByUserId,
                  verificationStatus = document.verificationStatus,
                  reviewComment = document.reviewComment,
                  reviewedAt = document.reviewedAt,
                  reviewedByUserId = document.reviewedByUserId,
                  archivePath = buildArchivePath(workpaper.workpaperId, document.documentId, document.fileName)
                )
              }
          )
        }
    )
  }

  private fun writeStoredEntry(zip: ZipOutputStream, entry: ArchiveEntry) {
    val crc32 = CRC32().apply { update(entry.bytes) }
    val zipEntry = ZipEntry(entry.path).apply {
      method = ZipEntry.STORED
      size = entry.bytes.size.toLong()
      compressedSize = entry.bytes.size.toLong()
      crc = crc32.value
      time = 0L
    }
    zip.putNextEntry(zipEntry)
    zip.write(entry.bytes)
    zip.closeEntry()
  }

  private fun appendCreatedAudit(access: TenantAccessContext, exportPack: ExportPack) {
    auditTrail.append(
      AppendAuditEventCommand(
        tenantId = access.tenantId,
        actorUserId = access.actorUserId,
        actorSubject = access.actorSubject,
        actorRoles = access.effectiveRoles,
        correlation = auditCorrelationContextProvider.currentCorrelationContext(),
        action = EXPORT_PACK_CREATED_ACTION,
        resourceType = EXPORT_PACK_RESOURCE_TYPE,
        resourceId = exportPack.id.toString(),
        metadata = mapOf(
          "closingFolderId" to exportPack.closingFolderId.toString(),
          "basisImportVersion" to exportPack.basisImportVersion,
          "basisTaxonomyVersion" to exportPack.basisTaxonomyVersion
        )
      )
    )
  }

  private fun compensateStorageFailure(exportPack: ExportPack) {
    try {
      exportPackStorage.deleteIfExists(exportPack.storageObjectKey)
    } catch (compensationException: RuntimeException) {
      logger.error(
        "Export pack compensation failed: tenantId={}, closingFolderId={}, exportPackId={}, storageObjectKey={}, reason={}",
        exportPack.tenantId,
        exportPack.closingFolderId,
        exportPack.id,
        exportPack.storageObjectKey,
        compensationException.message
      )
    }
  }

  private fun buildStorageObjectKey(tenantId: UUID, closingFolderId: UUID, exportPackId: UUID): String =
    "tenants/$tenantId/closing-folders/$closingFolderId/export-packs/$exportPackId.zip"

  private fun buildFileName(closingFolderId: UUID, exportPackId: UUID): String =
    "closing-folder-$closingFolderId-export-pack-$exportPackId.zip"

  private fun buildArchivePath(workpaperId: String, documentId: String, fileName: String): String =
    "documents/$workpaperId/$documentId-${sanitizeFileName(fileName)}"

  private fun sanitizeFileName(rawValue: String): String {
    val withoutUrls = rawValue
      .trim()
      .replace(URL_REGEX, "")
      .replace('\\', '/')
      .substringAfterLast('/')
      .trim()
    val cleaned = withoutUrls
      .map { character ->
        when {
          character.code < 32 -> '_'
          character in setOf('\\', '/', ':', '*', '?', '\"', '<', '>', '|') -> '_'
          else -> character
        }
      }
      .joinToString("")
      .replace(WHITESPACE_REGEX, " ")
      .trim()
      .trim('.')
      .take(MAX_FILE_NAME_LENGTH)

    return cleaned.ifBlank { DEFAULT_DOCUMENT_FILE_NAME }
  }

  private fun normalizeIdempotencyKey(idempotencyKey: String): String =
    idempotencyKey.trim().takeUnless { it.isEmpty() }
      ?: throw ExportPackBadRequestException("Idempotency-Key must not be blank.")

  private fun requireAnyRole(access: TenantAccessContext, allowedRoles: Set<String>, operation: String) {
    if (access.effectiveRoles.none { it in allowedRoles }) {
      throw AccessDeniedException("Insufficient role for $operation.")
    }
  }

  private fun lockFor(tenantId: UUID, closingFolderId: UUID): Any =
    generationLocks.computeIfAbsent("$tenantId:$closingFolderId") { Any() }

  private fun ExportPack.toSummary(): ExportPackSummary =
    ExportPackSummary(
      exportPackId = id,
      closingFolderId = closingFolderId,
      fileName = fileName,
      mediaType = mediaType,
      byteSize = byteSize,
      checksumSha256 = checksumSha256,
      basisImportVersion = basisImportVersion,
      basisTaxonomyVersion = basisTaxonomyVersion,
      createdAt = createdAt,
      createdByUserId = createdByUserId
    )

  private fun sha256(bytes: ByteArray): String =
    MessageDigest.getInstance("SHA-256")
      .digest(bytes)
      .joinToString("") { "%02x".format(it) }

  private data class FrozenExportSource(
    val controls: ControlsReadModel,
    val financialSummary: FinancialSummaryReadModel,
    val structuredStatements: StructuredFinancialStatementsReadModel,
    val currentWorkpapers: CurrentWorkpapersReadModel,
    val basisImportVersion: Int,
    val basisTaxonomyVersion: Int,
    val sourceFingerprint: String
  )

  private data class ArchiveEntry(
    val path: String,
    val bytes: ByteArray
  )

  private data class SourceFingerprintPayload(
    val basisImportVersion: Int,
    val basisTaxonomyVersion: Int,
    val workpapers: List<FingerprintWorkpaper>
  )

  private data class FingerprintWorkpaper(
    val anchorCode: String,
    val anchorLabel: String,
    val summaryBucketCode: String,
    val statementKind: String,
    val breakdownType: String,
    val workpaperId: String,
    val noteText: String,
    val status: String,
    val reviewComment: String?,
    val basisImportVersion: Int,
    val basisTaxonomyVersion: Int,
    val createdAt: String,
    val createdByUserId: String,
    val updatedAt: String,
    val updatedByUserId: String,
    val reviewedAt: String?,
    val reviewedByUserId: String?,
    val evidences: List<CurrentWorkpaperEvidenceReadModel>,
    val documentVerificationSummary: CurrentDocumentVerificationSummaryReadModel,
    val documents: List<FingerprintDocument>
  )

  private data class FingerprintDocument(
    val documentId: String,
    val fileName: String,
    val mediaType: String,
    val byteSize: Long,
    val checksumSha256: String,
    val sourceLabel: String,
    val documentDate: String?,
    val createdAt: String,
    val createdByUserId: String,
    val verificationStatus: String,
    val reviewComment: String?,
    val reviewedAt: String?,
    val reviewedByUserId: String?,
    val archivePath: String
  )

  private data class ExportPackManifest(
    val exportPackId: String,
    val closingFolderId: String,
    val closingFolderStatus: String,
    val generatedAt: String,
    val generatedByUserId: String,
    val basisImportVersion: Int,
    val basisTaxonomyVersion: Int,
    val controlsReadiness: String,
    val includesStaleWorkpapers: Boolean,
    val paths: ExportPackPaths,
    val summary: ExportPackManifestSummary,
    val workpapers: List<ExportPackManifestWorkpaper>
  )

  private data class ExportPackPaths(
    val controls: String,
    val financialSummary: String,
    val financialStatementsStructured: String,
    val workpapersCurrent: String
  )

  private data class ExportPackManifestSummary(
    val currentWorkpapersCount: Int,
    val documentsCount: Int,
    val unverifiedDocumentsCount: Int,
    val verifiedDocumentsCount: Int,
    val rejectedDocumentsCount: Int
  )

  private data class ExportPackManifestWorkpaper(
    val anchorCode: String,
    val anchorLabel: String,
    val summaryBucketCode: String,
    val statementKind: String,
    val breakdownType: String,
    val workpaperId: String,
    val status: String,
    val noteText: String,
    val reviewComment: String?,
    val basisImportVersion: Int,
    val basisTaxonomyVersion: Int,
    val createdAt: String,
    val createdByUserId: String,
    val updatedAt: String,
    val updatedByUserId: String,
    val reviewedAt: String?,
    val reviewedByUserId: String?,
    val documentVerificationSummary: CurrentDocumentVerificationSummaryReadModel,
    val evidences: List<CurrentWorkpaperEvidenceReadModel>,
    val documents: List<ExportPackManifestDocument>
  )

  private data class ExportPackManifestDocument(
    val documentId: String,
    val fileName: String,
    val mediaType: String,
    val byteSize: Long,
    val checksumSha256: String,
    val sourceLabel: String,
    val documentDate: String?,
    val createdAt: String,
    val createdByUserId: String,
    val verificationStatus: String,
    val reviewComment: String?,
    val reviewedAt: String?,
    val reviewedByUserId: String?,
    val archivePath: String
  )

  companion object {
    private val logger = LoggerFactory.getLogger(ExportPackService::class.java)
    private const val ZIP_MEDIA_TYPE = "application/zip"
    private const val READY_STATUS = "READY"
    private const val UNVERIFIED_STATUS = "UNVERIFIED"
    private const val VERIFIED_STATUS = "VERIFIED"
    private const val REJECTED_STATUS = "REJECTED"
    private const val MAX_FILE_NAME_LENGTH = 255
    private const val DEFAULT_DOCUMENT_FILE_NAME = "document"
    private val CREATE_ROLES = setOf("ACCOUNTANT", "MANAGER", "ADMIN")
    private val READ_ROLES = setOf("ACCOUNTANT", "REVIEWER", "MANAGER", "ADMIN")
    private val WHITESPACE_REGEX = Regex("\\s+")
    private val URL_REGEX = Regex("https?://[^\\s]+")
    private const val MANIFEST_PATH = "manifest.json"
    private const val CONTROLS_PATH = "read-models/controls.json"
    private const val FINANCIAL_SUMMARY_PATH = "read-models/financial-summary.json"
    private const val STRUCTURED_FINANCIALS_PATH = "read-models/financial-statements-structured.json"
    private const val WORKPAPERS_CURRENT_PATH = "read-models/workpapers-current.json"
    private val generationLocks = ConcurrentHashMap<String, Any>()
  }
}

@ResponseStatus(HttpStatus.BAD_REQUEST)
class ExportPackBadRequestException(message: String) : RuntimeException(message)

@ResponseStatus(HttpStatus.CONFLICT)
class ExportPackConflictException(message: String) : RuntimeException(message)

@ResponseStatus(HttpStatus.NOT_FOUND)
class ExportPackNotFoundException(message: String) : RuntimeException(message)

@ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
class ExportPackStorageException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)
