package ch.qamwaq.ritomer.identity.application

import java.util.UUID

interface OidcIdentityRepository {
  fun findByIdentity(issuer: String, subject: String): OidcIdentityBinding?
  fun findById(id: UUID): OidcIdentityBinding?
}

data class OidcIdentityBinding(val id: UUID, val actorId: UUID, val active: Boolean)

