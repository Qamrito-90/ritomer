package ch.qamwaq.ritomer.workpapers.api

import ch.qamwaq.ritomer.identity.access.TenantAccessResolver
import ch.qamwaq.ritomer.workpapers.application.DocumentPayloadTooLargeException
import ch.qamwaq.ritomer.workpapers.application.DocumentSummary
import ch.qamwaq.ritomer.workpapers.application.DocumentService
import ch.qamwaq.ritomer.workpapers.application.UploadDocumentCommand
import ch.qamwaq.ritomer.workpapers.application.WorkpaperDocumentsView
import java.net.URI
import java.time.LocalDate
import java.util.UUID
import org.springframework.core.io.InputStreamResource
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.ContentDisposition
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MaxUploadSizeExceededException
import org.springframework.web.multipart.MultipartFile

@Validated
@RestController
@RequestMapping("/api/closing-folders/{closingFolderId}")
class DocumentsController(
  private val tenantAccessResolver: TenantAccessResolver,
  private val documentService: DocumentService
) {
  @PostMapping("/workpapers/{anchorCode}/documents", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
  fun upload(
    @PathVariable closingFolderId: UUID,
    @PathVariable anchorCode: String,
    @RequestPart("file") file: MultipartFile,
    @RequestParam("sourceLabel") sourceLabel: String,
    @RequestParam("documentDate", required = false)
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    documentDate: LocalDate?
  ): ResponseEntity<DocumentSummaryResponse> {
    val created = documentService.uploadDocument(
      tenantAccessResolver.resolveRequiredTenantAccess(),
      closingFolderId,
      anchorCode,
      file,
      UploadDocumentCommand(
        sourceLabel = sourceLabel,
        documentDate = documentDate
      )
    )

    return ResponseEntity.created(
      URI.create("/api/closing-folders/$closingFolderId/documents/${created.id}/content")
    ).body(created.toResponse())
  }

  @GetMapping("/workpapers/{anchorCode}/documents")
  fun list(
    @PathVariable closingFolderId: UUID,
    @PathVariable anchorCode: String
  ): WorkpaperDocumentsResponse =
    documentService.listDocuments(
      tenantAccessResolver.resolveRequiredTenantAccess(),
      closingFolderId,
      anchorCode
    ).toResponse()

  @GetMapping("/documents/{documentId}/content")
  fun content(
    @PathVariable closingFolderId: UUID,
    @PathVariable documentId: UUID
  ): ResponseEntity<InputStreamResource> {
    val downloaded = documentService.downloadDocument(
      tenantAccessResolver.resolveRequiredTenantAccess(),
      closingFolderId,
      documentId
    )

    return ResponseEntity.ok()
      .contentType(MediaType.parseMediaType(downloaded.document.mediaType))
      .contentLength(downloaded.document.byteSize)
      .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
      .header(
        HttpHeaders.CONTENT_DISPOSITION,
        ContentDisposition.attachment().filename(downloaded.document.fileName).build().toString()
      )
      .body(InputStreamResource(downloaded.inputStream))
  }

  @ExceptionHandler(MaxUploadSizeExceededException::class)
  fun handleMaxUploadSizeExceeded(): ResponseEntity<DocumentErrorResponse> =
    ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(
      DocumentErrorResponse("file exceeds the 25 MiB limit.")
    )

  @ExceptionHandler(DocumentPayloadTooLargeException::class)
  fun handlePayloadTooLarge(exception: DocumentPayloadTooLargeException): ResponseEntity<DocumentErrorResponse> =
    ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(
      DocumentErrorResponse(exception.message ?: "file exceeds the 25 MiB limit.")
    )
}

data class WorkpaperDocumentsResponse(
  val closingFolderId: String,
  val anchorCode: String,
  val isCurrentStructure: Boolean,
  val documents: List<DocumentSummaryResponse>
)

data class DocumentErrorResponse(
  val message: String
)

private fun WorkpaperDocumentsView.toResponse(): WorkpaperDocumentsResponse =
  WorkpaperDocumentsResponse(
    closingFolderId = closingFolderId.toString(),
    anchorCode = anchorCode,
    isCurrentStructure = isCurrentStructure,
    documents = documents.map { it.toResponse() }
  )

private fun DocumentSummary.toResponse(): DocumentSummaryResponse =
  DocumentSummaryResponse(
    id = id.toString(),
    fileName = fileName,
    mediaType = mediaType,
    byteSize = byteSize,
    checksumSha256 = checksumSha256,
    sourceLabel = sourceLabel,
    documentDate = documentDate?.toString(),
    createdAt = createdAt.toString(),
    createdByUserId = createdByUserId.toString()
  )
