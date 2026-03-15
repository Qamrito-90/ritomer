package ch.qamwaq.ritomer.identity.infrastructure.persistence

import ch.qamwaq.ritomer.identity.application.AppUserRepository
import ch.qamwaq.ritomer.identity.domain.AppUser
import java.util.UUID
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository

@Repository
@ConditionalOnBean(JdbcClient::class)
class JdbcAppUserRepository(
  private val jdbcClient: JdbcClient
) : AppUserRepository {
  override fun findByExternalSubject(externalSubject: String): AppUser? =
    jdbcClient.sql(
      """
      select id, external_subject, email, display_name, status
      from app_user
      where external_subject = :externalSubject
      """
    )
      .param("externalSubject", externalSubject)
      .query(APP_USER_ROW_MAPPER)
      .optional()
      .orElse(null)

  override fun create(externalSubject: String, email: String?, displayName: String?): AppUser {
    val appUser = AppUser(
      id = UUID.randomUUID(),
      externalSubject = externalSubject,
      email = email,
      displayName = displayName,
      status = AppUser.ACTIVE_STATUS
    )

    jdbcClient.sql(
      """
      insert into app_user (id, external_subject, email, display_name, status)
      values (:id, :externalSubject, :email, :displayName, :status)
      """
    )
      .param("id", appUser.id)
      .param("externalSubject", appUser.externalSubject)
      .param("email", appUser.email)
      .param("displayName", appUser.displayName)
      .param("status", appUser.status)
      .update()

    return appUser
  }

  override fun updateProfile(userId: UUID, email: String?, displayName: String?): AppUser {
    jdbcClient.sql(
      """
      update app_user
      set email = :email,
          display_name = :displayName,
          updated_at = current_timestamp
      where id = :id
      """
    )
      .param("id", userId)
      .param("email", email)
      .param("displayName", displayName)
      .update()

    return jdbcClient.sql(
      """
      select id, external_subject, email, display_name, status
      from app_user
      where id = :id
      """
    )
      .param("id", userId)
      .query(APP_USER_ROW_MAPPER)
      .single()
  }

  companion object {
    private val APP_USER_ROW_MAPPER = RowMapper<AppUser> { rs, _ ->
      AppUser(
        id = rs.getObject("id", UUID::class.java),
        externalSubject = rs.getString("external_subject"),
        email = rs.getString("email"),
        displayName = rs.getString("display_name"),
        status = rs.getString("status")
      )
    }
  }
}
