package ch.qamwaq.ritomer.closing.infrastructure.persistence

import ch.qamwaq.ritomer.closing.application.ClosingFolderRepository
import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import org.springframework.context.annotation.Profile
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository

@Repository
@Profile("!test")
class JdbcClosingFolderRepository(
  private val jdbcClient: JdbcClient
) : ClosingFolderRepository {
  override fun create(folder: ClosingFolder): ClosingFolder {
    jdbcClient.sql(
      """
      insert into closing_folder (
        id,
        tenant_id,
        name,
        period_start_on,
        period_end_on,
        external_ref,
        status,
        archived_at,
        archived_by_user_id,
        created_at,
        updated_at
      ) values (
        :id,
        :tenantId,
        :name,
        :periodStartOn,
        :periodEndOn,
        :externalRef,
        :status,
        :archivedAt,
        :archivedByUserId,
        :createdAt,
        :updatedAt
      )
      """.trimIndent()
    )
      .param("id", folder.id)
      .param("tenantId", folder.tenantId)
      .param("name", folder.name)
      .param("periodStartOn", folder.periodStartOn)
      .param("periodEndOn", folder.periodEndOn)
      .param("externalRef", folder.externalRef)
      .param("status", folder.status.name)
      .param("archivedAt", folder.archivedAt)
      .param("archivedByUserId", folder.archivedByUserId)
      .param("createdAt", folder.createdAt)
      .param("updatedAt", folder.updatedAt)
      .update()

    return findByIdAndTenantId(folder.id, folder.tenantId)
      ?: error("Created closing folder was not found: ${folder.id}")
  }

  override fun findAllByTenantId(tenantId: UUID): List<ClosingFolder> =
    jdbcClient.sql(
      """
      select id,
             tenant_id,
             name,
             period_start_on,
             period_end_on,
             external_ref,
             status,
             archived_at,
             archived_by_user_id,
             created_at,
             updated_at
      from closing_folder
      where tenant_id = :tenantId
      order by period_end_on desc, created_at desc, id desc
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .query(CLOSING_FOLDER_ROW_MAPPER)
      .list()

  override fun findByIdAndTenantId(id: UUID, tenantId: UUID): ClosingFolder? =
    jdbcClient.sql(
      """
      select id,
             tenant_id,
             name,
             period_start_on,
             period_end_on,
             external_ref,
             status,
             archived_at,
             archived_by_user_id,
             created_at,
             updated_at
      from closing_folder
      where id = :id
        and tenant_id = :tenantId
      """.trimIndent()
    )
      .param("id", id)
      .param("tenantId", tenantId)
      .query(CLOSING_FOLDER_ROW_MAPPER)
      .optional()
      .orElse(null)

  override fun update(folder: ClosingFolder): ClosingFolder {
    val updatedRows = jdbcClient.sql(
      """
      update closing_folder
      set name = :name,
          period_start_on = :periodStartOn,
          period_end_on = :periodEndOn,
          external_ref = :externalRef,
          status = :status,
          archived_at = :archivedAt,
          archived_by_user_id = :archivedByUserId,
          updated_at = :updatedAt
      where id = :id
        and tenant_id = :tenantId
      """.trimIndent()
    )
      .param("id", folder.id)
      .param("tenantId", folder.tenantId)
      .param("name", folder.name)
      .param("periodStartOn", folder.periodStartOn)
      .param("periodEndOn", folder.periodEndOn)
      .param("externalRef", folder.externalRef)
      .param("status", folder.status.name)
      .param("archivedAt", folder.archivedAt)
      .param("archivedByUserId", folder.archivedByUserId)
      .param("updatedAt", folder.updatedAt)
      .update()

    if (updatedRows != 1) {
      error("Closing folder update failed for ${folder.id}.")
    }

    return findByIdAndTenantId(folder.id, folder.tenantId)
      ?: error("Updated closing folder was not found: ${folder.id}")
  }

  companion object {
    private val CLOSING_FOLDER_ROW_MAPPER = RowMapper<ClosingFolder> { rs, _ ->
      ClosingFolder(
        id = rs.getObject("id", UUID::class.java),
        tenantId = rs.getObject("tenant_id", UUID::class.java),
        name = rs.getString("name"),
        periodStartOn = rs.getObject("period_start_on", LocalDate::class.java),
        periodEndOn = rs.getObject("period_end_on", LocalDate::class.java),
        externalRef = rs.getString("external_ref"),
        status = ClosingFolderStatus.fromCode(rs.getString("status")),
        archivedAt = rs.getObject("archived_at", OffsetDateTime::class.java),
        archivedByUserId = rs.getObject("archived_by_user_id", UUID::class.java),
        createdAt = rs.getObject("created_at", OffsetDateTime::class.java),
        updatedAt = rs.getObject("updated_at", OffsetDateTime::class.java)
      )
    }
  }
}
