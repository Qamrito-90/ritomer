package ch.qamwaq.ritomer.exports.infrastructure.persistence

import ch.qamwaq.ritomer.exports.application.ExportPackAlreadyExistsException
import ch.qamwaq.ritomer.exports.application.ExportPackRepository
import ch.qamwaq.ritomer.exports.domain.ExportPack
import java.time.OffsetDateTime
import java.util.UUID
import org.springframework.context.annotation.Profile
import org.springframework.dao.DuplicateKeyException
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository

@Repository
@Profile("!test")
class JdbcExportPackRepository(
  private val jdbcClient: JdbcClient
) : ExportPackRepository {
  override fun findByIdempotencyKey(tenantId: UUID, closingFolderId: UUID, idempotencyKey: String): ExportPack? =
    jdbcClient.sql(
      """
      select id,
             tenant_id,
             closing_folder_id,
             idempotency_key,
             source_fingerprint,
             storage_backend,
             storage_object_key,
             file_name,
             media_type,
             byte_size,
             checksum_sha256,
             basis_import_version,
             basis_taxonomy_version,
             created_at,
             created_by_user_id
      from export_pack
      where tenant_id = :tenantId
        and closing_folder_id = :closingFolderId
        and idempotency_key = :idempotencyKey
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("closingFolderId", closingFolderId)
      .param("idempotencyKey", idempotencyKey)
      .query(EXPORT_PACK_ROW_MAPPER)
      .optional()
      .orElse(null)

  override fun findById(tenantId: UUID, closingFolderId: UUID, exportPackId: UUID): ExportPack? =
    jdbcClient.sql(
      """
      select id,
             tenant_id,
             closing_folder_id,
             idempotency_key,
             source_fingerprint,
             storage_backend,
             storage_object_key,
             file_name,
             media_type,
             byte_size,
             checksum_sha256,
             basis_import_version,
             basis_taxonomy_version,
             created_at,
             created_by_user_id
      from export_pack
      where tenant_id = :tenantId
        and closing_folder_id = :closingFolderId
        and id = :id
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("closingFolderId", closingFolderId)
      .param("id", exportPackId)
      .query(EXPORT_PACK_ROW_MAPPER)
      .optional()
      .orElse(null)

  override fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): List<ExportPack> =
    jdbcClient.sql(
      """
      select id,
             tenant_id,
             closing_folder_id,
             idempotency_key,
             source_fingerprint,
             storage_backend,
             storage_object_key,
             file_name,
             media_type,
             byte_size,
             checksum_sha256,
             basis_import_version,
             basis_taxonomy_version,
             created_at,
             created_by_user_id
      from export_pack
      where tenant_id = :tenantId
        and closing_folder_id = :closingFolderId
      order by created_at desc, id desc
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("closingFolderId", closingFolderId)
      .query(EXPORT_PACK_ROW_MAPPER)
      .list()

  override fun create(exportPack: ExportPack): ExportPack =
    try {
      jdbcClient.sql(
        """
        insert into export_pack (
          id,
          tenant_id,
          closing_folder_id,
          idempotency_key,
          source_fingerprint,
          storage_backend,
          storage_object_key,
          file_name,
          media_type,
          byte_size,
          checksum_sha256,
          basis_import_version,
          basis_taxonomy_version,
          created_at,
          created_by_user_id
        ) values (
          :id,
          :tenantId,
          :closingFolderId,
          :idempotencyKey,
          :sourceFingerprint,
          :storageBackend,
          :storageObjectKey,
          :fileName,
          :mediaType,
          :byteSize,
          :checksumSha256,
          :basisImportVersion,
          :basisTaxonomyVersion,
          :createdAt,
          :createdByUserId
        )
        """.trimIndent()
      )
        .withExportPack(exportPack)
        .update()
      exportPack
    } catch (_: DuplicateKeyException) {
      throw ExportPackAlreadyExistsException("export_pack already exists for the same idempotency key.")
    }

  companion object {
    private val EXPORT_PACK_ROW_MAPPER = RowMapper<ExportPack> { rs, _ ->
      ExportPack(
        id = rs.getObject("id", UUID::class.java),
        tenantId = rs.getObject("tenant_id", UUID::class.java),
        closingFolderId = rs.getObject("closing_folder_id", UUID::class.java),
        idempotencyKey = rs.getString("idempotency_key"),
        sourceFingerprint = rs.getString("source_fingerprint"),
        storageBackend = rs.getString("storage_backend"),
        storageObjectKey = rs.getString("storage_object_key"),
        fileName = rs.getString("file_name"),
        mediaType = rs.getString("media_type"),
        byteSize = rs.getLong("byte_size"),
        checksumSha256 = rs.getString("checksum_sha256"),
        basisImportVersion = rs.getInt("basis_import_version"),
        basisTaxonomyVersion = rs.getInt("basis_taxonomy_version"),
        createdAt = rs.getObject("created_at", OffsetDateTime::class.java),
        createdByUserId = rs.getObject("created_by_user_id", UUID::class.java)
      )
    }
  }
}

private fun JdbcClient.StatementSpec.withExportPack(exportPack: ExportPack): JdbcClient.StatementSpec =
  param("id", exportPack.id)
    .param("tenantId", exportPack.tenantId)
    .param("closingFolderId", exportPack.closingFolderId)
    .param("idempotencyKey", exportPack.idempotencyKey)
    .param("sourceFingerprint", exportPack.sourceFingerprint)
    .param("storageBackend", exportPack.storageBackend)
    .param("storageObjectKey", exportPack.storageObjectKey)
    .param("fileName", exportPack.fileName)
    .param("mediaType", exportPack.mediaType)
    .param("byteSize", exportPack.byteSize)
    .param("checksumSha256", exportPack.checksumSha256)
    .param("basisImportVersion", exportPack.basisImportVersion)
    .param("basisTaxonomyVersion", exportPack.basisTaxonomyVersion)
    .param("createdAt", exportPack.createdAt)
    .param("createdByUserId", exportPack.createdByUserId)
