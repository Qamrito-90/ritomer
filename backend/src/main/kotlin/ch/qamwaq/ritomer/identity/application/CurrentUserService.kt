package ch.qamwaq.ritomer.identity.application

import ch.qamwaq.ritomer.identity.domain.CurrentUser
import ch.qamwaq.ritomer.shared.application.TenantContextProvider
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Service

@Service
class CurrentUserService(
  private val tenantContextProvider: TenantContextProvider
) {
  fun currentUser(): CurrentUser {
    val authentication = SecurityContextHolder.getContext().authentication as? JwtAuthenticationToken
      ?: throw AccessDeniedException("JWT authentication is required.")

    return CurrentUser(
      subject = authentication.token.subject ?: "unknown",
      email = authentication.token.getClaimAsString("email"),
      tenantId = tenantContextProvider.currentTenantContext().tenantId,
      authorities = authentication.authorities.map { it.authority }.toSortedSet()
    )
  }
}
