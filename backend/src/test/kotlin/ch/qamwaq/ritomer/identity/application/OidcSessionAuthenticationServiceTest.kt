package ch.qamwaq.ritomer.identity.application

import ch.qamwaq.ritomer.IdentityTestConfiguration
import ch.qamwaq.ritomer.IdentityTestStore
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.shared.application.*
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.support.StaticListableBeanFactory

class OidcSessionAuthenticationServiceTest {
  private val store = IdentityTestStore()
  private val factory = IdentityTestConfiguration()
  private val users = factory.appUserRepository(store)
  private val memberships = factory.tenantMembershipRepository(store)
  private val tenantA = UUID.randomUUID()
  private val tenantB = UUID.randomUUID()
  private val user = store.seedUser("internal-synthetic-id", email = "same@example.test")
  private var binding: OidcIdentityBinding? = OidcIdentityBinding(UUID.randomUUID(), user.id, true)
  private val bindings = object : OidcIdentityRepository {
    override fun findByIdentity(issuer: String, subject: String) =
      binding.takeIf { issuer == "https://accounts.google.com" && subject == "synthetic-subject" }
    override fun findById(id: UUID) = binding?.takeIf { it.id == id }
  }
  private val now = Instant.parse("2026-10-06T10:00:00Z")
  private val clocks = StaticListableBeanFactory(mapOf("clock" to Clock.fixed(now, ZoneOffset.UTC)))
  private val service = OidcSessionAuthenticationService(bindings, users, memberships, clocks.getBeanProvider(Clock::class.java))
  private var boundTenant: UUID? = null
  private val tenants = object : TenantContextProvider {
    override fun currentTenantContext() = TenantContext(TenantHeaderStatus.ABSENT, null)
    override fun bindAuthorizedTenant(tenantId: UUID) { boundTenant = tenantId }
    override fun clearAuthorizedTenant() { boundTenant = null }
  }

  init { store.seedActiveMembership(user.externalSubject, tenantA, "tenant-a", "Synthetic A", TenantRole.ACCOUNTANT) }

  private fun admit() = service.admit("https://accounts.google.com", "synthetic-subject")
  private fun resolver(actor: AuthenticatedActor) = ActorResolutionSupport(users, memberships, { actor }, tenants, bindings)

  @Test
  fun `only exact issuer and subject admit a minimal actor without profile writes`() {
    val actor = admit()
    assertThat(actor.actorId).isEqualTo(user.id)
    assertThat(actor.oidcBindingId).isEqualTo(binding!!.id)
    assertThat(actor.authenticationMechanism).isEqualTo(AuthenticationMechanism.OIDC)
    assertThat(actor.authenticatedAt).isEqualTo(now)
    assertThat(actor.opaqueAuthCorrelation).isNotEqualTo(admit().opaqueAuthCorrelation)
    assertThatThrownBy { service.admit("https://other.example.test", "synthetic-subject") }
      .isInstanceOf(OidcAdmissionDeniedException::class.java)
    // Email is not an input to the admission port, and another subject cannot use it.
    store.seedUser("other-internal-id", email = "same@example.test")
    assertThatThrownBy { service.admit("https://accounts.google.com", "other-subject") }
      .isInstanceOf(OidcAdmissionDeniedException::class.java)
    assertThat(store.repositoryCounters().totalWrites).isZero()
    assertThat(store.repositoryCounters().externalSubjectReads).isZero()
  }

  @Test
  fun `binding user membership and tenant revocation are effective at the next check`() {
    val actor = admit()
    val resolver = resolver(actor)
    assertThat(resolver.verifyFreshAuthority(actor)).isEqualTo(ActorAuthorityFreshness.ACTIVE)
    binding = binding!!.copy(active = false)
    assertThatThrownBy { admit() }.isInstanceOf(OidcAdmissionDeniedException::class.java)
    assertThat(resolver.verifyFreshAuthority(actor)).isEqualTo(ActorAuthorityFreshness.REVOKED)
    binding = binding!!.copy(active = true, id = UUID.randomUUID())
    assertThat(resolver.verifyFreshAuthority(actor)).isEqualTo(ActorAuthorityFreshness.REVOKED)
    val fresh = admit()
    store.setUserStatus(user.id, "INACTIVE")
    assertThatThrownBy { admit() }.isInstanceOf(OidcAdmissionDeniedException::class.java)
    assertThat(resolver.verifyFreshAuthority(fresh)).isEqualTo(ActorAuthorityFreshness.REVOKED)
    store.setUserStatus(user.id, "ACTIVE")
    store.setMembershipStatus(user.id, tenantA, "INACTIVE")
    assertThatThrownBy { admit() }.isInstanceOf(OidcAdmissionDeniedException::class.java)
    store.setMembershipStatus(user.id, tenantA, "ACTIVE")
    store.setTenantStatus(user.id, tenantA, "INACTIVE")
    assertThatThrownBy { admit() }.isInstanceOf(OidcAdmissionDeniedException::class.java)
    assertThat(store.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `binding never grants a foreign tenant and explicit selection retains existing rules`() {
    val actor = admit()
    val resolver = resolver(actor)
    val context = resolver.resolveActorContext()
    assertThat(resolver.resolveActiveTenant(context.memberships, tenantA)?.tenantId).isEqualTo(tenantA)
    assertThat(boundTenant).isEqualTo(tenantA)
    boundTenant = null
    assertThatThrownBy { resolver.resolveActiveTenant(context.memberships, tenantB) }
      .isInstanceOf(RequestedTenantAccessDeniedException::class.java)
    assertThat(boundTenant).isNull()
    store.seedActiveMembership(user.externalSubject, tenantB, "tenant-b", "Synthetic B", TenantRole.REVIEWER)
    val multi = resolver.resolveActorContext()
    assertThat(resolver.resolveActiveTenant(multi.memberships, null)).isNull()
    assertThat(resolver.resolveActiveTenant(multi.memberships, tenantB)?.tenantId).isEqualTo(tenantB)
    assertThat(store.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `missing rebound and unexpected binding references fail closed while legacy overload survives`() {
    val actor = admit()
    assertThat(resolver(actor).verifyFreshAuthority(actor.copy(oidcBindingId = null))).isEqualTo(ActorAuthorityFreshness.REVOKED)
    binding = binding!!.copy(actorId = UUID.randomUUID())
    assertThat(resolver(actor).verifyFreshAuthority(actor)).isEqualTo(ActorAuthorityFreshness.REVOKED)
    assertThatThrownBy { resolver(actor).resolveActorContext() }.isInstanceOf(ActorAccessRevokedException::class.java)
    val legacy = actor.copy(authenticationMechanism = AuthenticationMechanism.LEGACY_JWT, oidcBindingId = null)
    assertThat(resolver(legacy).verifyFreshAuthority(legacy)).isEqualTo(ActorAuthorityFreshness.ACTIVE)
    val oldVerifier = ActorAuthorityFreshnessVerifier { ActorAuthorityFreshness.ACTIVE }
    assertThat(oldVerifier.verifyFreshAuthority(actor)).isEqualTo(ActorAuthorityFreshness.REVOKED)
    assertThat(oldVerifier.verifyFreshAuthority(legacy)).isEqualTo(ActorAuthorityFreshness.ACTIVE)
  }
}
