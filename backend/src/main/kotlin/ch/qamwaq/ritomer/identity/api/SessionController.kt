package ch.qamwaq.ritomer.identity.api

import ch.qamwaq.ritomer.identity.application.ActorAccessRevokedException
import ch.qamwaq.ritomer.identity.application.LocalSessionActorOption
import ch.qamwaq.ritomer.identity.application.LocalSessionAuthenticationFailedException
import ch.qamwaq.ritomer.identity.application.RequestedTenantAccessDeniedException
import ch.qamwaq.ritomer.identity.application.SessionAuthenticationService
import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import ch.qamwaq.ritomer.shared.application.AuthenticatedActorContextInstaller
import com.fasterxml.jackson.core.JsonParser
import com.fasterxml.jackson.core.JsonProcessingException
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Profile
import org.springframework.http.CacheControl
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.web.csrf.CsrfToken
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/session")
@Profile("local | test | dbtest")
@ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
class SessionController(
  private val sessionAuthenticationService: SessionAuthenticationService,
  private val authenticatedActorContextInstaller: AuthenticatedActorContextInstaller,
  private val objectMapper: ObjectMapper
) {
  @GetMapping("/bootstrap")
  fun bootstrap(
    request: HttpServletRequest,
    @AuthenticationPrincipal authenticatedActor: AuthenticatedActor?
  ): ResponseEntity<SessionBootstrapResponse> {
    val csrfToken = request.getAttribute(CsrfToken::class.java.name) as? CsrfToken
      ?: request.getAttribute("_csrf") as? CsrfToken
      ?: throw ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR)
    val materializedToken = csrfToken.token
    request.getSession(true)
    val authenticated = authenticatedActor != null

    return ResponseEntity.ok()
      .cacheControl(NO_STORE)
      .body(
        SessionBootstrapResponse(
          sessionState = if (authenticated) SessionState.AUTHENTICATED else SessionState.ANONYMOUS,
          localLoginAvailable = true,
          csrf = SessionCsrfResponse(
            headerName = csrfToken.headerName,
            token = materializedToken
          ),
          actors = if (authenticated) {
            null
          } else {
            sessionAuthenticationService.availableLocalActors().map { actor -> actor.toResponse() }
          }
        )
      )
  }

  @PostMapping("/local")
  fun localLogin(
    @RequestBody(required = false) rawBody: String?,
    @AuthenticationPrincipal authenticatedActor: AuthenticatedActor?
  ): ResponseEntity<Void> {
    if (authenticatedActor != null) {
      throw SessionAlreadyAuthenticatedException()
    }
    val actorKey = parseActorKey(rawBody)
    val actor = sessionAuthenticationService.authenticateLocalActor(actorKey)
    authenticatedActorContextInstaller.installAuthenticatedActor(actor)
    return ResponseEntity.noContent().cacheControl(NO_STORE).build()
  }

  private fun parseActorKey(rawBody: String?): String {
    if (rawBody == null) throw InvalidSessionRequestException()
    val strictMapper = objectMapper.copy()
      .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
      .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
    val root: JsonNode = try {
      strictMapper.readTree(rawBody) ?: throw InvalidSessionRequestException()
    } catch (_: JsonProcessingException) {
      throw InvalidSessionRequestException()
    }
    if (!root.isObject || root.size() != 1 || !root.has("actorKey")) {
      throw InvalidSessionRequestException()
    }
    val actorKey = root.get("actorKey")
    if (!actorKey.isTextual || actorKey.textValue().isEmpty()) {
      throw InvalidSessionRequestException()
    }
    return actorKey.textValue()
  }

  private fun LocalSessionActorOption.toResponse(): LocalSessionActorResponse =
    LocalSessionActorResponse(actorKey = actorKey, displayLabel = displayLabel)

  private companion object {
    val NO_STORE: CacheControl = CacheControl.noStore()
  }
}

enum class SessionState {
  ANONYMOUS,
  AUTHENTICATED
}

data class SessionBootstrapResponse(
  val sessionState: SessionState,
  val localLoginAvailable: Boolean,
  val csrf: SessionCsrfResponse,
  val actors: List<LocalSessionActorResponse>?
)

data class SessionCsrfResponse(
  val headerName: String,
  val token: String
)

data class LocalSessionActorResponse(
  val actorKey: String,
  val displayLabel: String
)

data class SessionErrorResponse(
  val code: String,
  val message: String
)

class InvalidSessionRequestException : RuntimeException("Invalid session request.")

class SessionAlreadyAuthenticatedException : RuntimeException("The session is already authenticated.")

@RestControllerAdvice(assignableTypes = [SessionController::class, MeController::class])
@Profile("local | test | dbtest")
@ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
class SessionControllerAdvice {
  @ExceptionHandler(InvalidSessionRequestException::class)
  fun invalidRequest(): ResponseEntity<SessionErrorResponse> =
    errorResponse(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Request body is invalid.")

  @ExceptionHandler(LocalSessionAuthenticationFailedException::class)
  fun authenticationFailed(): ResponseEntity<SessionErrorResponse> =
    errorResponse(
      HttpStatus.UNAUTHORIZED,
      "AUTHENTICATION_FAILED",
      "Local session authentication failed."
    )

  @ExceptionHandler(SessionAlreadyAuthenticatedException::class)
  fun alreadyAuthenticated(): ResponseEntity<SessionErrorResponse> =
    errorResponse(
      HttpStatus.CONFLICT,
      "SESSION_ALREADY_AUTHENTICATED",
      "The session is already authenticated."
    )

  @ExceptionHandler(ActorAccessRevokedException::class)
  fun accessRevoked(): ResponseEntity<SessionErrorResponse> =
    errorResponse(HttpStatus.FORBIDDEN, "ACCESS_REVOKED", "Access has been revoked.")

  @ExceptionHandler(RequestedTenantAccessDeniedException::class)
  fun accessDenied(): ResponseEntity<SessionErrorResponse> =
    errorResponse(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Access is denied.")

  private fun errorResponse(
    status: HttpStatus,
    code: String,
    message: String
  ): ResponseEntity<SessionErrorResponse> =
    ResponseEntity.status(status)
      .cacheControl(CacheControl.noStore())
      .body(SessionErrorResponse(code, message))
}
