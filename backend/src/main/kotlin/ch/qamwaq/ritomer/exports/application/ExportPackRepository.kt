package ch.qamwaq.ritomer.exports.application

import ch.qamwaq.ritomer.exports.domain.ExportPack
import java.util.UUID

interface ExportPackRepository {
  fun findByIdempotencyKey(tenantId: UUID, closingFolderId: UUID, idempotencyKey: String): ExportPack?

  fun findById(tenantId: UUID, closingFolderId: UUID, exportPackId: UUID): ExportPack?

  fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): List<ExportPack>

  @Throws(ExportPackAlreadyExistsException::class)
  fun create(exportPack: ExportPack): ExportPack
}

class ExportPackAlreadyExistsException(message: String) : RuntimeException(message)
