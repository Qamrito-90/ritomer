package ch.qamwaq.ritomer.identity.application

import ch.qamwaq.ritomer.identity.domain.AppUser
import ch.qamwaq.ritomer.identity.domain.TenantMembershipGrant
import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import java.util.UUID

interface AppUserRepository {
  fun findByExternalSubject(externalSubject: String): AppUser?

  fun findById(actorId: UUID): AppUser?

  fun create(externalSubject: String, email: String?, displayName: String?): AppUser

  fun updateProfile(userId: UUID, email: String?, displayName: String?): AppUser
}

interface TenantMembershipRepository {
  fun findActiveMembershipGrants(userId: UUID): List<TenantMembershipGrant>
}

fun interface CurrentAuthenticatedActorProvider {
  fun current(): AuthenticatedActor
}
