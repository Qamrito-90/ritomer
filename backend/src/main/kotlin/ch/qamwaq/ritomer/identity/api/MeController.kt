package ch.qamwaq.ritomer.identity.api

import ch.qamwaq.ritomer.identity.application.CurrentActorService
import ch.qamwaq.ritomer.identity.domain.CurrentActor
import com.fasterxml.jackson.annotation.JsonInclude
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class MeController(
  private val currentActorService: CurrentActorService
) {
  @GetMapping("/me")
  fun me(): MeResponse {
    return currentActorService.currentActor().toResponse()
  }
}

data class MeResponse(
  val actor: ActorResponse,
  val memberships: List<TenantMembershipResponse>,
  @field:JsonInclude(JsonInclude.Include.ALWAYS)
  val activeTenant: ActiveTenantResponse?,
  val effectiveRoles: Set<String>
)

data class ActorResponse(
  val userId: String,
  val externalSubject: String,
  val email: String?,
  val displayName: String?
)

data class TenantMembershipResponse(
  val tenantId: String,
  val tenantSlug: String,
  val tenantName: String,
  val roles: Set<String>
)

data class ActiveTenantResponse(
  val tenantId: String,
  val tenantSlug: String,
  val tenantName: String
)

private fun CurrentActor.toResponse(): MeResponse =
  MeResponse(
    actor = ActorResponse(
      userId = actor.userId.toString(),
      externalSubject = actor.externalSubject,
      email = actor.email,
      displayName = actor.displayName
    ),
    memberships = memberships.map { membership ->
      TenantMembershipResponse(
        tenantId = membership.tenantId.toString(),
        tenantSlug = membership.tenantSlug,
        tenantName = membership.tenantName,
        roles = membership.roles.map { it.name }.toSortedSet()
      )
    },
    activeTenant = activeTenant?.let { tenant ->
      ActiveTenantResponse(
        tenantId = tenant.tenantId.toString(),
        tenantSlug = tenant.tenantSlug,
        tenantName = tenant.tenantName
      )
    },
    effectiveRoles = effectiveRoles.map { it.name }.toSortedSet()
  )
