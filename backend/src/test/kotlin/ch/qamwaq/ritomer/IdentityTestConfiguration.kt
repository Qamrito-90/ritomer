package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.identity.application.AppUserRepository
import ch.qamwaq.ritomer.identity.application.TenantMembershipRepository
import ch.qamwaq.ritomer.identity.domain.AppUser
import ch.qamwaq.ritomer.identity.domain.TenantMembershipGrant
import ch.qamwaq.ritomer.identity.domain.TenantRole
import java.util.UUID
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean

@TestConfiguration(proxyBeanMethods = false)
class IdentityTestConfiguration {
  @Bean
  fun identityTestStore(): IdentityTestStore = IdentityTestStore()

  @Bean
  fun appUserRepository(identityTestStore: IdentityTestStore): AppUserRepository =
    InMemoryAppUserRepository(identityTestStore)

  @Bean
  fun tenantMembershipRepository(identityTestStore: IdentityTestStore): TenantMembershipRepository =
    InMemoryTenantMembershipRepository(identityTestStore)
}

class IdentityTestStore {
  private val usersBySubject = linkedMapOf<String, AppUser>()
  private val membershipsByUserId = linkedMapOf<UUID, MutableList<TenantMembershipGrant>>()

  fun reset() {
    usersBySubject.clear()
    membershipsByUserId.clear()
  }

  fun findUserBySubject(externalSubject: String): AppUser? = usersBySubject[externalSubject]

  fun saveUser(appUser: AppUser) {
    usersBySubject[appUser.externalSubject] = appUser
  }

  fun findUserById(userId: UUID): AppUser? = usersBySubject.values.firstOrNull { it.id == userId }

  fun membershipGrantsForUser(userId: UUID): List<TenantMembershipGrant> =
    membershipsByUserId[userId].orEmpty().toList()

  fun seedActiveMembership(
    externalSubject: String,
    tenantId: UUID,
    tenantSlug: String,
    tenantName: String,
    vararg roles: TenantRole
  ) {
    val user = usersBySubject[externalSubject]
      ?: AppUser(
        id = UUID.randomUUID(),
        externalSubject = externalSubject,
        email = null,
        displayName = null,
        status = AppUser.ACTIVE_STATUS
      ).also { usersBySubject[externalSubject] = it }

    val grants = membershipsByUserId.getOrPut(user.id) { mutableListOf() }
    roles.forEach { role ->
      grants.add(
        TenantMembershipGrant(
          tenantId = tenantId,
          tenantSlug = tenantSlug,
          tenantName = tenantName,
          role = role
        )
      )
    }
  }
}

private class InMemoryAppUserRepository(
  private val identityTestStore: IdentityTestStore
) : AppUserRepository {
  override fun findByExternalSubject(externalSubject: String): AppUser? =
    identityTestStore.findUserBySubject(externalSubject)

  override fun create(externalSubject: String, email: String?, displayName: String?): AppUser {
    val appUser = AppUser(
      id = UUID.randomUUID(),
      externalSubject = externalSubject,
      email = email,
      displayName = displayName,
      status = AppUser.ACTIVE_STATUS
    )
    identityTestStore.saveUser(appUser)
    return appUser
  }

  override fun updateProfile(userId: UUID, email: String?, displayName: String?): AppUser {
    val existing = identityTestStore.findUserById(userId)
      ?: error("Unknown app_user id: $userId")
    val updated = existing.copy(email = email, displayName = displayName)
    identityTestStore.saveUser(updated)
    return updated
  }
}

private class InMemoryTenantMembershipRepository(
  private val identityTestStore: IdentityTestStore
) : TenantMembershipRepository {
  override fun findActiveMembershipGrants(userId: UUID): List<TenantMembershipGrant> =
    identityTestStore.membershipGrantsForUser(userId)
}
