package ch.qamwaq.ritomer.exports.api

import ch.qamwaq.ritomer.exports.application.CreateExportPackOutcome
import ch.qamwaq.ritomer.exports.application.ExportPackBadRequestException
import ch.qamwaq.ritomer.exports.application.ExportPackService
import ch.qamwaq.ritomer.exports.application.ExportPackSummary
import ch.qamwaq.ritomer.identity.access.TenantAccessResolver
import java.net.URI
import java.util.UUID
import org.springframework.core.io.InputStreamResource
import org.springframework.http.ContentDisposition
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@Validated
@RestController
@RequestMapping("/api/closing-folders/{closingFolderId}/export-packs")
class ExportPacksController(
  private val tenantAccessResolver: TenantAccessResolver,
  private val exportPackService: ExportPackService
) {
  @PostMapping
  fun create(
    @PathVariable closingFolderId: UUID,
    @RequestHeader("Idempotency-Key", required = false) idempotencyKey: String?
  ): ResponseEntity<ExportPackResponse> {
    val result = exportPackService.createExportPack(
      tenantAccessResolver.resolveRequiredTenantAccess(),
      closingFolderId,
      idempotencyKey?.trim().takeUnless { it.isNullOrEmpty() }
        ?: throw ExportPackBadRequestException("Idempotency-Key must not be blank.")
    )

    val response = result.exportPack.toResponse()
    return when (result.outcome) {
      CreateExportPackOutcome.CREATED ->
        ResponseEntity.created(
          URI.create("/api/closing-folders/$closingFolderId/export-packs/${result.exportPack.exportPackId}")
        ).body(response)

      CreateExportPackOutcome.REPLAYED ->
        ResponseEntity.ok(response)
    }
  }

  @GetMapping
  fun list(
    @PathVariable closingFolderId: UUID
  ): ExportPackListResponse =
    ExportPackListResponse(
      items = exportPackService.listExportPacks(
        tenantAccessResolver.resolveRequiredTenantAccess(),
        closingFolderId
      ).map { it.toResponse() }
    )

  @GetMapping("/{exportPackId}")
  fun detail(
    @PathVariable closingFolderId: UUID,
    @PathVariable exportPackId: UUID
  ): ExportPackResponse =
    exportPackService.getExportPack(
      tenantAccessResolver.resolveRequiredTenantAccess(),
      closingFolderId,
      exportPackId
    ).toResponse()

  @GetMapping("/{exportPackId}/content")
  fun content(
    @PathVariable closingFolderId: UUID,
    @PathVariable exportPackId: UUID
  ): ResponseEntity<InputStreamResource> {
    val downloaded = exportPackService.downloadExportPack(
      tenantAccessResolver.resolveRequiredTenantAccess(),
      closingFolderId,
      exportPackId
    )

    return ResponseEntity.ok()
      .contentType(MediaType.parseMediaType(downloaded.exportPack.mediaType))
      .contentLength(downloaded.exportPack.byteSize)
      .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
      .header(
        HttpHeaders.CONTENT_DISPOSITION,
        ContentDisposition.attachment().filename(downloaded.exportPack.fileName).build().toString()
      )
      .body(InputStreamResource(downloaded.inputStream))
  }
}

data class ExportPackListResponse(
  val items: List<ExportPackResponse>
)

data class ExportPackResponse(
  val exportPackId: String,
  val closingFolderId: String,
  val fileName: String,
  val mediaType: String,
  val byteSize: Long,
  val checksumSha256: String,
  val basisImportVersion: Int,
  val basisTaxonomyVersion: Int,
  val createdAt: String,
  val createdByUserId: String
)

private fun ExportPackSummary.toResponse(): ExportPackResponse =
  ExportPackResponse(
    exportPackId = exportPackId.toString(),
    closingFolderId = closingFolderId.toString(),
    fileName = fileName,
    mediaType = mediaType,
    byteSize = byteSize,
    checksumSha256 = checksumSha256,
    basisImportVersion = basisImportVersion,
    basisTaxonomyVersion = basisTaxonomyVersion,
    createdAt = createdAt.toString(),
    createdByUserId = createdByUserId.toString()
  )
