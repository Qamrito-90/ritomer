package ch.qamwaq.ritomer.identity.api

import ch.qamwaq.ritomer.identity.application.ActorAccessRevokedException
import ch.qamwaq.ritomer.identity.application.RequestedTenantAccessDeniedException
import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import jakarta.servlet.http.HttpServletRequest
import org.springframework.context.annotation.Profile
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.web.csrf.CsrfToken
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestController
@Profile("shared-internal")
class SharedSessionController {
  @GetMapping("/api/session/bootstrap")
  fun bootstrap(request: HttpServletRequest, @AuthenticationPrincipal actor: AuthenticatedActor?): SharedBootstrapResponse {
    val csrf = request.getAttribute(CsrfToken::class.java.name) as? CsrfToken
      ?: error("CSRF is required for shared bootstrap.")
    val token = csrf.token
    request.getSession(true)
    return SharedBootstrapResponse(
      if (actor == null) SessionState.ANONYMOUS else SessionState.AUTHENTICATED,
      csrf = SessionCsrfResponse(csrf.headerName, token)
    )
  }
}

data class SharedBootstrapResponse(
  val sessionState: SessionState,
  val localLoginAvailable: Boolean = false,
  val oidcLoginAvailable: Boolean = true,
  val csrf: SessionCsrfResponse
)

@RestControllerAdvice(assignableTypes = [SharedSessionController::class, MeController::class])
@Profile("shared-internal")
class SharedSessionControllerAdvice {
  @ExceptionHandler(ActorAccessRevokedException::class)
  fun revoked() = ResponseEntity.status(403).body(SessionErrorResponse("ACCESS_REVOKED", "Access has been revoked."))

  @ExceptionHandler(RequestedTenantAccessDeniedException::class)
  fun denied() = ResponseEntity.status(403).body(SessionErrorResponse("ACCESS_DENIED", "Access is denied."))
}

