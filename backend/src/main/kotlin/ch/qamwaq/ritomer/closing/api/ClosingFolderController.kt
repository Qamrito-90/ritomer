package ch.qamwaq.ritomer.closing.api

import ch.qamwaq.ritomer.closing.application.CreateClosingFolderCommand
import ch.qamwaq.ritomer.closing.application.ClosingFolderService
import ch.qamwaq.ritomer.closing.application.FieldPatch
import ch.qamwaq.ritomer.closing.application.PatchClosingFolderCommand
import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.identity.access.TenantAccessResolver
import com.fasterxml.jackson.databind.JsonNode
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import java.net.URI
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException
import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

@Validated
@RestController
@RequestMapping("/api/closing-folders")
class ClosingFolderController(
  private val tenantAccessResolver: TenantAccessResolver,
  private val closingFolderService: ClosingFolderService
) {
  @PostMapping
  fun create(
    @Valid @RequestBody request: CreateClosingFolderRequest
  ): ResponseEntity<ClosingFolderResponse> {
    val access = resolveTenantAccess()
    val created = closingFolderService.create(access, request.toCommand())

    return ResponseEntity
      .created(URI.create("/api/closing-folders/${created.id}"))
      .body(created.toResponse())
  }

  @GetMapping
  fun list(): List<ClosingFolderResponse> =
    closingFolderService.list(resolveTenantAccess()).map { it.toResponse() }

  @GetMapping("/{id}")
  fun get(
    @PathVariable id: UUID
  ): ClosingFolderResponse =
    closingFolderService.get(resolveTenantAccess(), id).toResponse()

  @PatchMapping("/{id}")
  fun patch(
    @PathVariable id: UUID,
    @RequestBody request: JsonNode
  ): ClosingFolderResponse =
    closingFolderService.patch(resolveTenantAccess(), id, request.toPatchCommand()).toResponse()

  @PostMapping("/{id}/archive")
  fun archive(
    @PathVariable id: UUID
  ): ClosingFolderResponse =
    closingFolderService.archive(resolveTenantAccess(), id).toResponse()

  private fun resolveTenantAccess(): TenantAccessContext =
    tenantAccessResolver.resolveRequiredTenantAccess()
}

data class CreateClosingFolderRequest(
  @field:NotBlank
  val name: String,
  @field:NotNull
  val periodStartOn: LocalDate,
  @field:NotNull
  val periodEndOn: LocalDate,
  val externalRef: String?
)

data class ClosingFolderResponse(
  val id: String,
  val tenantId: String,
  val name: String,
  val periodStartOn: LocalDate,
  val periodEndOn: LocalDate,
  val externalRef: String?,
  val status: String,
  val archivedAt: OffsetDateTime?,
  val archivedByUserId: String?,
  val createdAt: OffsetDateTime,
  val updatedAt: OffsetDateTime
)

private fun CreateClosingFolderRequest.toCommand(): CreateClosingFolderCommand =
  CreateClosingFolderCommand(
    name = name,
    periodStartOn = periodStartOn,
    periodEndOn = periodEndOn,
    externalRef = externalRef
  )

private fun ClosingFolder.toResponse(): ClosingFolderResponse =
  ClosingFolderResponse(
    id = id.toString(),
    tenantId = tenantId.toString(),
    name = name,
    periodStartOn = periodStartOn,
    periodEndOn = periodEndOn,
    externalRef = externalRef,
    status = status.name,
    archivedAt = archivedAt,
    archivedByUserId = archivedByUserId?.toString(),
    createdAt = createdAt,
    updatedAt = updatedAt
  )

private fun JsonNode.toPatchCommand(): PatchClosingFolderCommand {
  if (!isObject) {
    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "PATCH body must be a JSON object.")
  }

  return PatchClosingFolderCommand(
    name = textFieldPatch("name", allowNull = false),
    periodStartOn = localDateFieldPatch("periodStartOn"),
    periodEndOn = localDateFieldPatch("periodEndOn"),
    externalRef = textFieldPatch("externalRef", allowNull = true)
  )
}

private fun JsonNode.textFieldPatch(fieldName: String, allowNull: Boolean): FieldPatch<String?> {
  if (!has(fieldName)) {
    return FieldPatch.absent()
  }

  val valueNode = get(fieldName)
  if (valueNode.isNull) {
    if (!allowNull) {
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "$fieldName must not be null.")
    }
    return FieldPatch.present(null)
  }

  if (!valueNode.isTextual) {
    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "$fieldName must be a string.")
  }

  val normalized = valueNode.asText().trim()
  if (!allowNull && normalized.isEmpty()) {
    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "$fieldName must not be blank.")
  }

  return FieldPatch.present(normalized.takeUnless { it.isEmpty() })
}

private fun JsonNode.localDateFieldPatch(fieldName: String): FieldPatch<LocalDate> {
  if (!has(fieldName)) {
    return FieldPatch.absent()
  }

  val valueNode = get(fieldName)
  if (!valueNode.isTextual) {
    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "$fieldName must be an ISO-8601 date string.")
  }

  return try {
    FieldPatch.present(LocalDate.parse(valueNode.asText()))
  } catch (_: DateTimeParseException) {
    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "$fieldName must be an ISO-8601 date string.")
  }
}
