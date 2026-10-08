package ch.qamwaq.ritomer.identity.infrastructure.persistence

import ch.qamwaq.ritomer.identity.application.OidcIdentityBinding
import ch.qamwaq.ritomer.identity.application.OidcIdentityRepository
import java.util.UUID
import org.springframework.context.annotation.Profile
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository

@Repository
@Profile("shared-internal")
class JdbcOidcIdentityRepository(private val jdbc: JdbcTemplate) : OidcIdentityRepository {
  override fun findByIdentity(issuer: String, subject: String): OidcIdentityBinding? =
    jdbc.query(
      "select id, app_user_id, active from oidc_identity_binding where issuer = ? and subject = ?",
      { rs, _ -> OidcIdentityBinding(rs.getObject("id", UUID::class.java), rs.getObject("app_user_id", UUID::class.java), rs.getBoolean("active")) },
      issuer, subject
    ).singleOrNull()

  override fun findById(id: UUID): OidcIdentityBinding? =
    jdbc.query(
      "select id, app_user_id, active from oidc_identity_binding where id = ?",
      { rs, _ -> OidcIdentityBinding(rs.getObject("id", UUID::class.java), rs.getObject("app_user_id", UUID::class.java), rs.getBoolean("active")) },
      id
    ).singleOrNull()
}

