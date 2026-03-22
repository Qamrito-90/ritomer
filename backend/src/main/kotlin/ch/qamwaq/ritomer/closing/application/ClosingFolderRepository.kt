package ch.qamwaq.ritomer.closing.application

import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import java.time.LocalDate
import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ResponseStatus

interface ClosingFolderRepository {
  fun create(folder: ClosingFolder): ClosingFolder

  fun findAllByTenantId(tenantId: UUID): List<ClosingFolder>

  fun findByIdAndTenantId(id: UUID, tenantId: UUID): ClosingFolder?

  fun update(folder: ClosingFolder): ClosingFolder
}

data class CreateClosingFolderCommand(
  val name: String,
  val periodStartOn: LocalDate,
  val periodEndOn: LocalDate,
  val externalRef: String?
)

data class FieldPatch<T>(
  val present: Boolean,
  val value: T?
) {
  companion object {
    fun <T> absent(): FieldPatch<T> = FieldPatch(present = false, value = null)

    fun <T> present(value: T?): FieldPatch<T> = FieldPatch(present = true, value = value)
  }
}

data class PatchClosingFolderCommand(
  val name: FieldPatch<String?> = FieldPatch.absent(),
  val periodStartOn: FieldPatch<LocalDate> = FieldPatch.absent(),
  val periodEndOn: FieldPatch<LocalDate> = FieldPatch.absent(),
  val externalRef: FieldPatch<String?> = FieldPatch.absent()
) {
  fun hasAnyPatchableField(): Boolean =
    name.present || periodStartOn.present || periodEndOn.present || externalRef.present
}

@ResponseStatus(HttpStatus.BAD_REQUEST)
class ClosingFolderBadRequestException(message: String) : RuntimeException(message)

@ResponseStatus(HttpStatus.NOT_FOUND)
class ClosingFolderNotFoundException(folderId: UUID) : RuntimeException("Closing folder not found: $folderId")
