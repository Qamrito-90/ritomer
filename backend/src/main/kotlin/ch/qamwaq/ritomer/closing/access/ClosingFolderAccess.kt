package ch.qamwaq.ritomer.closing.access

import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import java.util.UUID
import org.springframework.context.annotation.Profile
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.web.bind.annotation.ResponseStatus

data class ClosingFolderAccessView(
  val id: UUID,
  val tenantId: UUID,
  val status: ClosingFolderAccessStatus
)

enum class ClosingFolderAccessStatus {
  DRAFT,
  ARCHIVED;

  companion object {
    fun fromDomain(status: ClosingFolderStatus): ClosingFolderAccessStatus =
      when (status) {
        ClosingFolderStatus.DRAFT -> DRAFT
        ClosingFolderStatus.ARCHIVED -> ARCHIVED
      }

    fun fromCode(code: String): ClosingFolderAccessStatus =
      fromDomain(ClosingFolderStatus.fromCode(code))
  }
}

interface ClosingFolderAccess {
  fun getRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView

  fun lockRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView
}

@Service
@Profile("!test")
class JdbcClosingFolderAccess(
  private val jdbcClient: JdbcClient
) : ClosingFolderAccess {
  override fun getRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView =
    queryClosingFolder(tenantId, closingFolderId, lock = false)
      ?: throw ClosingFolderAccessNotFoundException(closingFolderId)

  override fun lockRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView =
    queryClosingFolder(tenantId, closingFolderId, lock = true)
      ?: throw ClosingFolderAccessNotFoundException(closingFolderId)

  private fun queryClosingFolder(
    tenantId: UUID,
    closingFolderId: UUID,
    lock: Boolean
  ): ClosingFolderAccessView? {
    val sql = buildString {
      append(
        """
        select id,
               tenant_id,
               status
        from closing_folder
        where id = :id
          and tenant_id = :tenantId
        """.trimIndent()
      )
      if (lock) {
        append("\nfor update")
      }
    }

    return jdbcClient.sql(sql)
      .param("id", closingFolderId)
      .param("tenantId", tenantId)
      .query(CLOSING_FOLDER_ACCESS_ROW_MAPPER)
      .optional()
      .orElse(null)
  }

  companion object {
    private val CLOSING_FOLDER_ACCESS_ROW_MAPPER = RowMapper<ClosingFolderAccessView> { rs, _ ->
      ClosingFolderAccessView(
        id = rs.getObject("id", UUID::class.java),
        tenantId = rs.getObject("tenant_id", UUID::class.java),
        status = ClosingFolderAccessStatus.fromCode(rs.getString("status"))
      )
    }
  }
}

@ResponseStatus(HttpStatus.NOT_FOUND)
class ClosingFolderAccessNotFoundException(
  closingFolderId: UUID
) : RuntimeException("Closing folder not found: $closingFolderId")
