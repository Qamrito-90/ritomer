package ch.qamwaq.ritomer.workpapers.application

import ch.qamwaq.ritomer.workpapers.domain.Document
import java.util.UUID

interface DocumentRepository {
  fun create(document: Document): Document

  fun updateVerification(document: Document): Document

  fun findByWorkpaper(tenantId: UUID, workpaperId: UUID): List<Document>

  fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): Map<UUID, List<Document>>

  fun findByIdWithinClosingFolder(tenantId: UUID, closingFolderId: UUID, documentId: UUID): Document?
}
