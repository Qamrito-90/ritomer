package ch.qamwaq.ritomer.mapping.infrastructure.persistence

import ch.qamwaq.ritomer.mapping.application.ManualMappingRepository
import ch.qamwaq.ritomer.mapping.domain.ManualMapping
import java.time.OffsetDateTime
import java.util.UUID
import org.springframework.context.annotation.Profile
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.core.simple.JdbcClient.StatementSpec
import org.springframework.stereotype.Repository

@Repository
@Profile("!test")
class JdbcManualMappingRepository(
  private val jdbcClient: JdbcClient
) : ManualMappingRepository {
  override fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): List<ManualMapping> =
    jdbcClient.sql(
      """
      select id,
             tenant_id,
             closing_folder_id,
             account_code,
             target_code,
             created_at,
             updated_at,
             created_by_user_id,
             updated_by_user_id
      from manual_mapping
      where tenant_id = :tenantId
        and closing_folder_id = :closingFolderId
      order by account_code asc
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("closingFolderId", closingFolderId)
      .query(MANUAL_MAPPING_ROW_MAPPER)
      .list()

  override fun findByAccountCode(
    tenantId: UUID,
    closingFolderId: UUID,
    accountCode: String
  ): ManualMapping? =
    jdbcClient.sql(
      """
      select id,
             tenant_id,
             closing_folder_id,
             account_code,
             target_code,
             created_at,
             updated_at,
             created_by_user_id,
             updated_by_user_id
      from manual_mapping
      where tenant_id = :tenantId
        and closing_folder_id = :closingFolderId
        and account_code = :accountCode
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("closingFolderId", closingFolderId)
      .param("accountCode", accountCode)
      .query(MANUAL_MAPPING_ROW_MAPPER)
      .optional()
      .orElse(null)

  override fun create(mapping: ManualMapping): ManualMapping {
    jdbcClient.sql(
      """
      insert into manual_mapping (
        id,
        tenant_id,
        closing_folder_id,
        account_code,
        target_code,
        created_at,
        updated_at,
        created_by_user_id,
        updated_by_user_id
      ) values (
        :id,
        :tenantId,
        :closingFolderId,
        :accountCode,
        :targetCode,
        :createdAt,
        :updatedAt,
        :createdByUserId,
        :updatedByUserId
      )
      """.trimIndent()
    )
      .withManualMapping(mapping)
      .update()

    return mapping
  }

  override fun update(mapping: ManualMapping): ManualMapping {
    jdbcClient.sql(
      """
      update manual_mapping
      set target_code = :targetCode,
          updated_at = :updatedAt,
          updated_by_user_id = :updatedByUserId
      where tenant_id = :tenantId
        and id = :id
      """.trimIndent()
    )
      .param("id", mapping.id)
      .param("tenantId", mapping.tenantId)
      .param("targetCode", mapping.targetCode)
      .param("updatedAt", mapping.updatedAt)
      .param("updatedByUserId", mapping.updatedByUserId)
      .update()

    return mapping
  }

  override fun delete(tenantId: UUID, mappingId: UUID) {
    jdbcClient.sql(
      """
      delete from manual_mapping
      where tenant_id = :tenantId
        and id = :id
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("id", mappingId)
      .update()
  }

  companion object {
    private val MANUAL_MAPPING_ROW_MAPPER = RowMapper<ManualMapping> { rs, _ ->
      ManualMapping(
        id = rs.getObject("id", UUID::class.java),
        tenantId = rs.getObject("tenant_id", UUID::class.java),
        closingFolderId = rs.getObject("closing_folder_id", UUID::class.java),
        accountCode = rs.getString("account_code"),
        targetCode = rs.getString("target_code"),
        createdAt = rs.getObject("created_at", OffsetDateTime::class.java),
        updatedAt = rs.getObject("updated_at", OffsetDateTime::class.java),
        createdByUserId = rs.getObject("created_by_user_id", UUID::class.java),
        updatedByUserId = rs.getObject("updated_by_user_id", UUID::class.java)
      )
    }
  }
}

private fun StatementSpec.withManualMapping(mapping: ManualMapping): StatementSpec =
  param("id", mapping.id)
    .param("tenantId", mapping.tenantId)
    .param("closingFolderId", mapping.closingFolderId)
    .param("accountCode", mapping.accountCode)
    .param("targetCode", mapping.targetCode)
    .param("createdAt", mapping.createdAt)
    .param("updatedAt", mapping.updatedAt)
    .param("createdByUserId", mapping.createdByUserId)
    .param("updatedByUserId", mapping.updatedByUserId)
