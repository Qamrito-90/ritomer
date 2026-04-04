package ch.qamwaq.ritomer.workpapers.infrastructure.persistence

import ch.qamwaq.ritomer.workpapers.application.DocumentRepository
import ch.qamwaq.ritomer.workpapers.domain.Document
import ch.qamwaq.ritomer.workpapers.domain.DocumentStorageBackend
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import org.springframework.context.annotation.Profile
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository

@Repository
@Profile("!test")
class JdbcDocumentRepository(
  private val jdbcClient: JdbcClient
) : DocumentRepository {
  override fun create(document: Document): Document {
    jdbcClient.sql(
      """
      insert into document (
        id,
        tenant_id,
        workpaper_id,
        storage_backend,
        storage_object_key,
        file_name,
        media_type,
        byte_size,
        checksum_sha256,
        source_label,
        document_date,
        created_at,
        created_by_user_id
      ) values (
        :id,
        :tenantId,
        :workpaperId,
        :storageBackend,
        :storageObjectKey,
        :fileName,
        :mediaType,
        :byteSize,
        :checksumSha256,
        :sourceLabel,
        :documentDate,
        :createdAt,
        :createdByUserId
      )
      """.trimIndent()
    )
      .withDocument(document)
      .update()

    return document
  }

  override fun findByWorkpaper(tenantId: UUID, workpaperId: UUID): List<Document> =
    jdbcClient.sql(
      """
      select id,
             tenant_id,
             workpaper_id,
             storage_backend,
             storage_object_key,
             file_name,
             media_type,
             byte_size,
             checksum_sha256,
             source_label,
             document_date,
             created_at,
             created_by_user_id
      from document
      where tenant_id = :tenantId
        and workpaper_id = :workpaperId
      order by created_at desc, id desc
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("workpaperId", workpaperId)
      .query(DOCUMENT_ROW_MAPPER)
      .list()

  override fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): Map<UUID, List<Document>> =
    jdbcClient.sql(
      """
      select d.id,
             d.tenant_id,
             d.workpaper_id,
             d.storage_backend,
             d.storage_object_key,
             d.file_name,
             d.media_type,
             d.byte_size,
             d.checksum_sha256,
             d.source_label,
             d.document_date,
             d.created_at,
             d.created_by_user_id
      from document d
      join workpaper w
        on w.id = d.workpaper_id
       and w.tenant_id = d.tenant_id
      where d.tenant_id = :tenantId
        and w.closing_folder_id = :closingFolderId
      order by d.workpaper_id asc, d.created_at desc, d.id desc
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("closingFolderId", closingFolderId)
      .query(DOCUMENT_ROW_MAPPER)
      .list()
      .groupBy { it.workpaperId }

  override fun findByIdWithinClosingFolder(tenantId: UUID, closingFolderId: UUID, documentId: UUID): Document? =
    jdbcClient.sql(
      """
      select d.id,
             d.tenant_id,
             d.workpaper_id,
             d.storage_backend,
             d.storage_object_key,
             d.file_name,
             d.media_type,
             d.byte_size,
             d.checksum_sha256,
             d.source_label,
             d.document_date,
             d.created_at,
             d.created_by_user_id
      from document d
      join workpaper w
        on w.id = d.workpaper_id
       and w.tenant_id = d.tenant_id
      where d.tenant_id = :tenantId
        and w.closing_folder_id = :closingFolderId
        and d.id = :documentId
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("closingFolderId", closingFolderId)
      .param("documentId", documentId)
      .query(DOCUMENT_ROW_MAPPER)
      .optional()
      .orElse(null)

  companion object {
    private val DOCUMENT_ROW_MAPPER = RowMapper<Document> { rs, _ ->
      Document(
        id = rs.getObject("id", UUID::class.java),
        tenantId = rs.getObject("tenant_id", UUID::class.java),
        workpaperId = rs.getObject("workpaper_id", UUID::class.java),
        storageBackend = DocumentStorageBackend.valueOf(rs.getString("storage_backend")),
        storageObjectKey = rs.getString("storage_object_key"),
        fileName = rs.getString("file_name"),
        mediaType = rs.getString("media_type"),
        byteSize = rs.getLong("byte_size"),
        checksumSha256 = rs.getString("checksum_sha256"),
        sourceLabel = rs.getString("source_label"),
        documentDate = rs.getObject("document_date", LocalDate::class.java),
        createdAt = rs.getObject("created_at", OffsetDateTime::class.java),
        createdByUserId = rs.getObject("created_by_user_id", UUID::class.java)
      )
    }
  }
}

private fun JdbcClient.StatementSpec.withDocument(document: Document): JdbcClient.StatementSpec =
  param("id", document.id)
    .param("tenantId", document.tenantId)
    .param("workpaperId", document.workpaperId)
    .param("storageBackend", document.storageBackend.name)
    .param("storageObjectKey", document.storageObjectKey)
    .param("fileName", document.fileName)
    .param("mediaType", document.mediaType)
    .param("byteSize", document.byteSize)
    .param("checksumSha256", document.checksumSha256)
    .param("sourceLabel", document.sourceLabel)
    .param("documentDate", document.documentDate)
    .param("createdAt", document.createdAt)
    .param("createdByUserId", document.createdByUserId)
