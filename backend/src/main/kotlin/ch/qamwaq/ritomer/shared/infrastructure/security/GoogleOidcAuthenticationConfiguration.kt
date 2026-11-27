package ch.qamwaq.ritomer.shared.infrastructure.security

import ch.qamwaq.ritomer.shared.application.OidcActorAdmission
import ch.qamwaq.ritomer.shared.application.OidcAdmissionDeniedException
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import jakarta.servlet.FilterChain
import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Base64
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.security.authentication.ProviderManager
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.core.Authentication
import org.springframework.security.core.context.SecurityContext
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.security.oauth2.client.endpoint.RestClientAuthorizationCodeTokenResponseClient
import org.springframework.security.oauth2.client.endpoint.OAuth2AccessTokenResponseClient
import org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest
import org.springframework.security.oauth2.client.oidc.authentication.OidcAuthorizationCodeAuthenticationProvider
import org.springframework.security.oauth2.client.oidc.authentication.OidcIdTokenDecoderFactory
import org.springframework.security.oauth2.client.oidc.authentication.OidcIdTokenValidator
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService
import org.springframework.security.oauth2.client.registration.ClientRegistration
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestRedirectFilter
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository
import org.springframework.security.oauth2.client.web.OAuth2LoginAuthenticationFilter
import org.springframework.security.oauth2.core.AuthorizationGrantType
import org.springframework.security.oauth2.core.ClientAuthenticationMethod
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2AuthenticationException
import org.springframework.security.oauth2.core.OAuth2AuthorizationException
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm
import org.springframework.security.oauth2.jwt.JwtTimestampValidator
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtValidationException
import org.springframework.security.oauth2.jwt.JwtException
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy
import org.springframework.security.web.context.HttpSessionSecurityContextRepository
import org.springframework.security.web.context.SecurityContextRepository
import org.springframework.security.web.savedrequest.NullRequestCache
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.support.TransactionTemplate
import java.time.Duration
import java.time.Clock
import java.time.Instant
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger
import org.springframework.web.filter.OncePerRequestFilter

internal const val OIDC_TRANSACTION_RETURN_PATH = "ritomer.oidc.return-path"
internal const val GOOGLE_ISSUER = "https://accounts.google.com"

@Configuration(proxyBeanMethods = false)
@Profile("shared-internal")
class GoogleOidcAuthenticationConfiguration {
  @Bean
  fun googleClientRegistrations(properties: SharedSessionProperties): ClientRegistrationRepository =
    InMemoryClientRegistrationRepository(
      ClientRegistration.withRegistrationId("google")
        .clientId(properties.clientId).clientSecret(properties.clientSecret)
        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
        .redirectUri(properties.canonicalOrigin + OIDC_CALLBACK_PATH)
        .scope("openid")
        .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
        .tokenUri("https://oauth2.googleapis.com/token")
        .jwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
        .issuerUri(GOOGLE_ISSUER)
        .userNameAttributeName("sub").clientName("Google").build()
    )

  @Bean
  fun googleOidcSecurity(
    registrations: ClientRegistrationRepository,
    store: OidcTransactionStore,
    admission: OidcActorAdmission,
    contextRepository: HttpSessionSecurityContextRepository,
    sessionStrategy: SessionAuthenticationStrategy
  ) = GoogleOidcSecurity(registrations, store, admission, contextRepository, sessionStrategy)
}

/** Builds the real Spring OIDC pipeline; tests replace only the remote IdP and storage. */
class GoogleOidcSecurity(
  registrations: ClientRegistrationRepository,
  store: OidcTransactionStore,
  admission: OidcActorAdmission,
  contextRepository: HttpSessionSecurityContextRepository,
  sessionStrategy: SessionAuthenticationStrategy
) {
  private val client = requireNotNull(registrations.findByRegistrationId("google"))
  private val requests = SharedOidcAuthorizationRequestRepository(client, store)
  private val redirect = OAuth2AuthorizationRequestRedirectFilter(
    ObservedAuthorizationRequestResolver(DefaultOAuth2AuthorizationRequestResolver(registrations, "/oauth2/authorization").apply {
      setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce())
    })
  ).apply {
    setAuthorizationRequestRepository(requests)
    setRequestCache(NullRequestCache())
    setAuthenticationFailureHandler { request, response, failure ->
      observeOidc(request, authenticationFailureStage(failure))
      failOidc(response)
    }
  }
  private val login = MinimalActorOidcLoginFilter(registrations, admission).apply {
    val provider = OidcAuthorizationCodeAuthenticationProvider(
      observedTokenClient(RestClientAuthorizationCodeTokenResponseClient()),
      OidcUserService().apply { setRetrieveUserInfo { false } }
    )
    val decoders = OidcIdTokenDecoderFactory().apply {
      setJwsAlgorithmResolver { SignatureAlgorithm.RS256 }
      setJwtValidatorFactory { registration ->
        DelegatingOAuth2TokenValidator(OidcIdTokenValidator(registration), JwtTimestampValidator(Duration.ZERO))
      }
    }
    provider.setJwtDecoderFactory { registration ->
      val delegate = decoders.createDecoder(registration)
      JwtDecoder { token ->
        observeCurrentOidc(ManualOidcStage.JWT_VALIDATION_STARTED)
        try {
          delegate.decode(token).also { observeCurrentOidc(ManualOidcStage.JWT_VALIDATED) }
        } catch (failure: Exception) {
          observeCurrentOidc(when (failure) {
            is JwtValidationException -> ManualOidcStage.FAILURE_JWT_CLAIMS
            is JwtException -> ManualOidcStage.FAILURE_JWT_DECODE
            else -> ManualOidcStage.FAILURE_JWT_UNKNOWN
          })
          throw failure
        }
      }
    }
    setAuthenticationManager(ProviderManager(listOf(provider)))
    setAuthorizationRequestRepository(requests)
    setSecurityContextRepository(object : SecurityContextRepository by contextRepository {
      override fun saveContext(context: SecurityContext, request: HttpServletRequest, response: HttpServletResponse) {
        observeOidc(request, ManualOidcStage.CONTEXT_SAVE_STARTED)
        try {
          contextRepository.saveContext(context, request, response)
          observeOidc(request, ManualOidcStage.CONTEXT_SAVE_COMPLETED)
        } catch (failure: Exception) {
          observeOidc(request, ManualOidcStage.FAILURE_CONTEXT_SAVE)
          throw failure
        }
      }
    })
    setSessionAuthenticationStrategy { authentication, request, response ->
      observeOidc(request, ManualOidcStage.SESSION_STRATEGY_STARTED)
      try {
        sessionStrategy.onAuthentication(authentication, request, response)
        observeOidc(request, ManualOidcStage.SESSION_STRATEGY_COMPLETED)
      } catch (failure: Exception) {
        observeOidc(request, ManualOidcStage.FAILURE_SESSION_STRATEGY)
        throw failure
      }
    }
    setAuthenticationSuccessHandler { request, response, _ ->
      response.setHeader("Cache-Control", "no-store")
      response.sendRedirect(safeSharedReturnPath(request.getAttribute(OIDC_TRANSACTION_RETURN_PATH) as? String))
      observeOidc(request, ManualOidcStage.LOGIN_COMPLETED)
    }
    setAuthenticationFailureHandler { request, response, failure ->
      // Admission denial is an expected product decision, distinct from a protocol error.
      if (!oidcStageObserved(request, ManualOidcStage.ADMISSION_DENIED)) {
        observeOidc(request, authenticationFailureStage(failure))
      }
      failOidc(response)
    }
  }

  fun configure(http: HttpSecurity) {
    http.addFilterAt(redirect, OAuth2AuthorizationRequestRedirectFilter::class.java)
    http.addFilterAt(login, OAuth2LoginAuthenticationFilter::class.java)
  }
}

/** Observes the actual redirect resolver, without changing either resolve overload. */
private class ObservedAuthorizationRequestResolver(
  private val delegate: org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver
) : org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver {
  override fun resolve(request: HttpServletRequest): OAuth2AuthorizationRequest? {
    if (request.requestURI == OIDC_START_PATH) observeOidc(request, ManualOidcStage.REDIRECT_RESOLVER_ENTERED)
    return delegate.resolve(request)
  }
  override fun resolve(request: HttpServletRequest, clientRegistrationId: String): OAuth2AuthorizationRequest? {
    if (request.requestURI == OIDC_START_PATH) observeOidc(request, ManualOidcStage.REDIRECT_RESOLVER_ENTERED)
    return delegate.resolve(request, clientRegistrationId)
  }
}

internal fun observedTokenClient(delegate: OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest>) =
  OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest> { grant ->
    observeCurrentOidc(ManualOidcStage.TOKEN_EXCHANGE_STARTED)
    try {
      delegate.getTokenResponse(grant).also { observeCurrentOidc(ManualOidcStage.TOKEN_RESPONSE_RECEIVED) }
    } catch (failure: Exception) {
      observeCurrentOidc(tokenFailureStage(failure))
      throw failure
    }
  }

/** Only exact standard error codes are recognized. Descriptions, URIs and messages are never read. */
private fun oauthErrorCode(failure: Exception): String? = when (failure) {
  is OAuth2AuthenticationException -> failure.error.errorCode
  is OAuth2AuthorizationException -> failure.error.errorCode
  else -> null
}

internal fun tokenFailureStage(failure: Exception): ManualOidcStage = when (oauthErrorCode(failure)) {
  "invalid_client" -> ManualOidcStage.FAILURE_TOKEN_INVALID_CLIENT
  "invalid_grant" -> ManualOidcStage.FAILURE_TOKEN_INVALID_GRANT
  "invalid_request" -> ManualOidcStage.FAILURE_TOKEN_INVALID_REQUEST
  "unauthorized_client" -> ManualOidcStage.FAILURE_TOKEN_UNAUTHORIZED_CLIENT
  "invalid_scope" -> ManualOidcStage.FAILURE_TOKEN_INVALID_SCOPE
  "invalid_token_response" -> tokenResponseFailureStage(failure)
  else -> ManualOidcStage.FAILURE_TOKEN_UNKNOWN
}

/** Inspect only a bounded chain of types and an HTTP status, never exception text or response data. */
private fun tokenResponseFailureStage(failure: Exception): ManualOidcStage = try {
  val seen = java.util.Collections.newSetFromMap(java.util.IdentityHashMap<Throwable, Boolean>())
  val causes = mutableListOf<Throwable>()
  var current: Throwable? = failure
  while (current != null && causes.size < 8) {
    val item = current
    if (!seen.add(item)) break
    causes.add(item)
    if (causes.size == 8) break
    current = item.cause
  }
  val response = causes.filterIsInstance<org.springframework.web.client.RestClientResponseException>().firstOrNull()
  when {
    response != null -> when (response.statusCode.value()) {
      401 -> ManualOidcStage.FAILURE_TOKEN_HTTP_UNAUTHORIZED
      403 -> ManualOidcStage.FAILURE_TOKEN_HTTP_FORBIDDEN
      in 400..499 -> ManualOidcStage.FAILURE_TOKEN_HTTP_CLIENT
      in 500..599 -> ManualOidcStage.FAILURE_TOKEN_HTTP_SERVER
      else -> ManualOidcStage.FAILURE_TOKEN_HTTP_OTHER
    }
    causes.any { it is javax.net.ssl.SSLException } -> ManualOidcStage.FAILURE_TOKEN_TLS
    causes.any { it is java.net.UnknownHostException || it is java.nio.channels.UnresolvedAddressException } ->
      ManualOidcStage.FAILURE_TOKEN_RESOLUTION
    causes.any { it is java.net.SocketTimeoutException || it is java.net.http.HttpTimeoutException } ->
      ManualOidcStage.FAILURE_TOKEN_TIMEOUT
    causes.any { it is java.net.ConnectException } -> ManualOidcStage.FAILURE_TOKEN_CONNECTION
    causes.any { it is org.springframework.web.client.UnknownContentTypeException } -> ManualOidcStage.FAILURE_TOKEN_CONTENT_TYPE
    causes.any { it is org.springframework.http.converter.HttpMessageNotReadableException } -> ManualOidcStage.FAILURE_TOKEN_DECODE
    causes.any { it is java.io.IOException } -> ManualOidcStage.FAILURE_TOKEN_IO
    else -> ManualOidcStage.FAILURE_TOKEN_RESPONSE
  }
} catch (_: Throwable) {
  // A diagnostic accessor must never replace the original authentication failure.
  ManualOidcStage.FAILURE_TOKEN_RESPONSE
}

internal fun authenticationFailureStage(failure: Exception): ManualOidcStage = when (oauthErrorCode(failure)) {
  "authorization_request_not_found" -> ManualOidcStage.FAILURE_AUTHORIZATION_NOT_FOUND
  "invalid_state_parameter" -> ManualOidcStage.FAILURE_STATE_VALIDATION
  "invalid_nonce" -> ManualOidcStage.FAILURE_NONCE_VALIDATION
  "invalid_id_token" -> ManualOidcStage.FAILURE_ID_TOKEN_VALIDATION
  "invalid_request" -> ManualOidcStage.FAILURE_AUTHENTICATION_REQUEST
  "access_denied" -> ManualOidcStage.FAILURE_PROVIDER_OR_REQUEST_DENIED
  else -> ManualOidcStage.FAILURE_AUTHENTICATION_UNKNOWN
}

internal fun failOidc(response: HttpServletResponse) {
  response.setHeader("Cache-Control", "no-store")
  response.sendRedirect(OIDC_FAILURE_PATH)
}

/** No authorized client or provider token is saved, even transiently in an HTTP session. */
internal object NonPersistingAuthorizedClientRepository : OAuth2AuthorizedClientRepository {
  override fun <T : OAuth2AuthorizedClient?> loadAuthorizedClient(
    clientRegistrationId: String, principal: Authentication?, request: HttpServletRequest
  ): T? = null

  override fun saveAuthorizedClient(
    authorizedClient: OAuth2AuthorizedClient, principal: Authentication?, request: HttpServletRequest,
    response: HttpServletResponse
  ) = Unit

  override fun removeAuthorizedClient(
    clientRegistrationId: String, principal: Authentication?, request: HttpServletRequest,
    response: HttpServletResponse
  ) = Unit
}

internal class MinimalActorOidcLoginFilter(
  registrations: ClientRegistrationRepository,
  private val admission: OidcActorAdmission
) : OAuth2LoginAuthenticationFilter(registrations, NonPersistingAuthorizedClientRepository, OIDC_CALLBACK_PATH) {
  override fun attemptAuthentication(request: HttpServletRequest, response: HttpServletResponse): Authentication {
    observeOidc(request, ManualOidcStage.CALLBACK_FILTER_ENTERED)
    val validated = withOidcObservation(request) {
      super.attemptAuthentication(request, response)
    } as? OAuth2AuthenticationToken ?: oidcDenied()
    val oidc = validated.principal as? OidcUser ?: oidcDenied()
    observeOidc(request, ManualOidcStage.PROTOCOL_VALIDATED)
    val actor = try {
      admission.admit(oidc.issuer.toString(), oidc.subject)
    } catch (_: OidcAdmissionDeniedException) {
      observeOidc(request, ManualOidcStage.ADMISSION_DENIED)
      oidcDenied()
    } catch (failure: Exception) {
      observeOidc(request, ManualOidcStage.FAILURE_ADMISSION_UNKNOWN)
      throw failure
    }
    observeOidc(request, ManualOidcStage.ADMISSION_ACCEPTED)
    // AbstractAuthenticationProcessingFilter only sees this token-free Authentication:
    // session strategy -> saveContext -> success handler all run AFTER this return.
    return AuthenticatedActorAuthentication.fromValidatedActor(actor)
  }
}

internal fun oidcDenied(): Nothing = throw OAuth2AuthenticationException(OAuth2Error("access_denied"))

class MinimalSessionSecurityContextRepository : HttpSessionSecurityContextRepository() {
  override fun saveContext(context: SecurityContext, request: HttpServletRequest, response: HttpServletResponse) {
    val authentication = context.authentication
    check(authentication == null || authentication is AuthenticatedActorAuthentication) {
      "Only the minimal application actor may be stored in a shared session."
    }
    super.saveContext(context, request, response)
  }
}

/** Contains only short-lived protocol material; deliberately has no generated toString. */
class OidcTransaction(val nonce: String, val verifier: String, val returnPath: String) {
  init {
    require(nonce.length in 1..256 && verifier.matches(Regex("[A-Za-z0-9._~-]{43,128}")))
    require(returnPath == safeSharedReturnPath(returnPath))
  }
}

interface OidcTransactionStore {
  fun save(stateHash: String, sessionHash: String, transaction: OidcTransaction)
  fun read(stateHash: String, sessionHash: String): OidcTransaction?
  fun consume(stateHash: String, sessionHash: String): OidcTransaction?
  fun clear(sessionHash: String)
  fun purgeExpired()
}

internal class JdbcOidcTransactionStore(
  private val jdbc: JdbcTemplate, manager: PlatformTransactionManager
) : OidcTransactionStore {
  private val isolated = TransactionTemplate(manager).apply {
    propagationBehavior = TransactionDefinition.PROPAGATION_REQUIRES_NEW
    timeout = 5
  }

  override fun save(stateHash: String, sessionHash: String, transaction: OidcTransaction) {
    isolated.executeWithoutResult {
      purgeExpired()
      jdbc.update(
        """with stamp as (select clock_timestamp() as now)
          insert into oidc_authorization_transaction
            (state_hash, session_hash, nonce, code_verifier, return_path, created_at, expires_at)
          select ?, ?, ?, ?, ?, now, now + interval '5 minutes' from stamp
          on conflict (session_hash) do update set state_hash=excluded.state_hash,
            nonce=excluded.nonce, code_verifier=excluded.code_verifier,
            return_path=excluded.return_path, created_at=excluded.created_at, expires_at=excluded.expires_at""",
        stateHash, sessionHash, transaction.nonce, transaction.verifier, transaction.returnPath
      )
    }
  }

  override fun read(stateHash: String, sessionHash: String): OidcTransaction? =
    jdbc.query(
      """select nonce, code_verifier, return_path from oidc_authorization_transaction
        where state_hash=? and session_hash=? and expires_at>clock_timestamp()""",
      { rs, _ -> OidcTransaction(rs.getString(1), rs.getString(2), rs.getString(3)) }, stateHash, sessionHash
    ).singleOrNull()

  override fun consume(stateHash: String, sessionHash: String): OidcTransaction? =
    isolated.execute {
      jdbc.query(
        """delete from oidc_authorization_transaction
          where state_hash=? and session_hash=? and expires_at>clock_timestamp()
          returning nonce, code_verifier, return_path""",
        { rs, _ -> OidcTransaction(rs.getString(1), rs.getString(2), rs.getString(3)) }, stateHash, sessionHash
      ).singleOrNull()
    } // Commit before the HTTP token exchange; a later failure cannot revive this request.

  override fun clear(sessionHash: String) {
    isolated.executeWithoutResult {
      jdbc.update("delete from oidc_authorization_transaction where session_hash=?", sessionHash)
    }
  }

  override fun purgeExpired() {
    jdbc.update(
      """delete from oidc_authorization_transaction where state_hash in
        (select state_hash from oidc_authorization_transaction where expires_at<=clock_timestamp()
        order by expires_at limit 100)"""
    )
  }
}

internal class SharedOidcAuthorizationRequestRepository(
  private val registration: ClientRegistration, private val store: OidcTransactionStore
) : AuthorizationRequestRepository<OAuth2AuthorizationRequest> {
  override fun saveAuthorizationRequest(
    authorizationRequest: OAuth2AuthorizationRequest?, request: HttpServletRequest, response: HttpServletResponse
  ) {
    val session = request.getSession(false) ?: run {
      observeOidc(request, ManualOidcStage.FAILURE_ANONYMOUS_SESSION_MISSING)
      oidcDenied()
    }
    if (authorizationRequest == null) { store.clear(digest(session.id)); return }
    val nonce = authorizationRequest.getAttribute<String>("nonce") ?: oidcDenied()
    val verifier = authorizationRequest.getAttribute<String>("code_verifier") ?: oidcDenied()
    val state = authorizationRequest.state?.takeIf { it.length in 1..256 } ?: oidcDenied()
    if (authorizationRequest.redirectUri != registration.redirectUri ||
      authorizationRequest.scopes != setOf("openid")
    ) oidcDenied()
    try {
      store.save(
        digest(state), digest(session.id),
        OidcTransaction(nonce, verifier, safeSharedReturnPath(request.getParameter("returnPath")))
      )
    } catch (failure: Exception) {
      observeOidc(request, ManualOidcStage.FAILURE_TRANSACTION_STORAGE)
      throw failure
    }
    observeOidc(request, ManualOidcStage.AUTHORIZATION_SAVED)
  }

  override fun loadAuthorizationRequest(request: HttpServletRequest): OAuth2AuthorizationRequest? = restore(request, false)

  override fun removeAuthorizationRequest(
    request: HttpServletRequest, response: HttpServletResponse
  ): OAuth2AuthorizationRequest? = restore(request, true)

  private fun restore(request: HttpServletRequest, consume: Boolean): OAuth2AuthorizationRequest? {
    observeOidc(request, if (consume) ManualOidcStage.TRANSACTION_CONSUME_STARTED else ManualOidcStage.TRANSACTION_READ_STARTED)
    fun reject(stage: ManualOidcStage): OAuth2AuthorizationRequest? { observeOidc(request, stage); return null }
    val stateValues = request.getParameterValues("state") ?: return reject(ManualOidcStage.FAILURE_CALLBACK_PARAMETERS)
    if (stateValues.size != 1 || stateValues[0].length !in 1..256) return reject(ManualOidcStage.FAILURE_CALLBACK_PARAMETERS)
    if (request.getParameterValues("code")?.size?.let { it != 1 } == true ||
      request.getParameterValues("error")?.size?.let { it != 1 } == true) return reject(ManualOidcStage.FAILURE_CALLBACK_PARAMETERS)
    val session = request.getSession(false) ?: return reject(ManualOidcStage.FAILURE_ANONYMOUS_SESSION_MISSING)
    val state = stateValues[0]
    val transaction = try {
      if (consume) store.consume(digest(state), digest(session.id)) else store.read(digest(state), digest(session.id))
    } catch (failure: Exception) {
      observeOidc(request, ManualOidcStage.FAILURE_TRANSACTION_STORAGE)
      throw failure
    }
    if (transaction == null) return reject(ManualOidcStage.FAILURE_TRANSACTION_UNAVAILABLE)
    observeOidc(request, if (consume) ManualOidcStage.TRANSACTION_CONSUMED else ManualOidcStage.TRANSACTION_READ)
    if (consume) request.setAttribute(OIDC_TRANSACTION_RETURN_PATH, transaction.returnPath)
    return OAuth2AuthorizationRequest.authorizationCode()
      .authorizationUri(registration.providerDetails.authorizationUri).clientId(registration.clientId)
      .redirectUri(registration.redirectUri).scopes(setOf("openid")).state(state)
      .attributes {
        it["registration_id"] = registration.registrationId
        it["nonce"] = transaction.nonce
        it["code_verifier"] = transaction.verifier
      }
      .additionalParameters {
        it["nonce"] = urlHash(transaction.nonce)
        it["code_challenge"] = urlHash(transaction.verifier)
        it["code_challenge_method"] = "S256"
      }.build()
  }
}

internal fun digest(value: String): String =
  MessageDigest.getInstance("SHA-256").digest(value.toByteArray(StandardCharsets.UTF_8))
    .joinToString("") { "%02x".format(it) }

private fun urlHash(value: String): String =
  Base64.getUrlEncoder().withoutPadding()
    .encodeToString(MessageDigest.getInstance("SHA-256").digest(value.toByteArray(StandardCharsets.UTF_8)))

/** Temporary, default-off evidence. No provider/session value enters the closed event schema. */
internal enum class ManualOidcStage {
  START_RECEIVED, REDIRECT_RESOLVER_ENTERED, AUTHORIZATION_SAVED, START_PREPARED, START_NOT_PREPARED,
  CALLBACK_RECEIVED, CALLBACK_FILTER_ENTERED, TRANSACTION_READ_STARTED, TRANSACTION_READ,
  TRANSACTION_CONSUME_STARTED, TRANSACTION_CONSUMED, TOKEN_EXCHANGE_STARTED, TOKEN_RESPONSE_RECEIVED,
  JWT_VALIDATION_STARTED, JWT_VALIDATED, PROTOCOL_VALIDATED, ADMISSION_DENIED, ADMISSION_ACCEPTED,
  SESSION_STRATEGY_STARTED, SESSION_STRATEGY_COMPLETED, CONTEXT_SAVE_STARTED, CONTEXT_SAVE_COMPLETED,
  LOGIN_COMPLETED, PROTOCOL_NOT_COMPLETED, OTHER_FAILURE, CALLBACK_FINISHED, SATURATED,
  FAILURE_HTTP_BOUNDARY, FAILURE_CALLBACK_PARAMETERS, FAILURE_ANONYMOUS_SESSION_MISSING,
  FAILURE_TRANSACTION_STORAGE, FAILURE_TRANSACTION_UNAVAILABLE, FAILURE_AUTHORIZATION_NOT_FOUND,
  FAILURE_TOKEN_INVALID_CLIENT, FAILURE_TOKEN_INVALID_GRANT, FAILURE_TOKEN_INVALID_REQUEST,
  FAILURE_TOKEN_UNAUTHORIZED_CLIENT, FAILURE_TOKEN_INVALID_SCOPE, FAILURE_TOKEN_RESPONSE, FAILURE_TOKEN_UNKNOWN,
  FAILURE_TOKEN_HTTP_UNAUTHORIZED, FAILURE_TOKEN_HTTP_FORBIDDEN, FAILURE_TOKEN_HTTP_CLIENT, FAILURE_TOKEN_HTTP_SERVER,
  FAILURE_TOKEN_HTTP_OTHER, FAILURE_TOKEN_TLS, FAILURE_TOKEN_RESOLUTION, FAILURE_TOKEN_TIMEOUT, FAILURE_TOKEN_CONNECTION,
  FAILURE_TOKEN_CONTENT_TYPE, FAILURE_TOKEN_DECODE, FAILURE_TOKEN_IO,
  FAILURE_JWT_CLAIMS, FAILURE_JWT_DECODE, FAILURE_JWT_UNKNOWN, FAILURE_STATE_VALIDATION,
  FAILURE_NONCE_VALIDATION, FAILURE_ID_TOKEN_VALIDATION, FAILURE_AUTHENTICATION_REQUEST,
  FAILURE_PROVIDER_OR_REQUEST_DENIED, FAILURE_AUTHENTICATION_UNKNOWN, FAILURE_ADMISSION_UNKNOWN,
  FAILURE_SESSION_STRATEGY, FAILURE_CONTEXT_SAVE, FAILURE_REQUEST_UNKNOWN
}

private const val MANUAL_OIDC_ATTRIBUTE = "ritomer.oidc.manual-observation"
private class ManualOidcObservation(val emit: (ManualOidcStage) -> Unit) {
  val stages = mutableSetOf<ManualOidcStage>()
  fun observe(stage: ManualOidcStage) { stages.add(stage); emit(stage) }
}

// Only the synchronous provider call needs ambient observation. No HTTP/session/provider object is kept here.
private val currentOidcObservation = ThreadLocal<ManualOidcObservation>()
internal fun <T> withOidcObservation(request: HttpServletRequest, action: () -> T): T {
  val previous = currentOidcObservation.get()
  val current = request.getAttribute(MANUAL_OIDC_ATTRIBUTE) as? ManualOidcObservation
  if (current == null) currentOidcObservation.remove() else currentOidcObservation.set(current)
  try { return action() }
  finally {
    if (previous == null) currentOidcObservation.remove() else currentOidcObservation.set(previous)
  }
}

internal fun observeCurrentOidc(stage: ManualOidcStage) {
  try { currentOidcObservation.get()?.observe(stage) }
  catch (failure: Exception) { if (failure is InterruptedException) Thread.currentThread().interrupt() }
}

private fun oidcStageObserved(request: HttpServletRequest, stage: ManualOidcStage): Boolean =
  (request.getAttribute(MANUAL_OIDC_ATTRIBUTE) as? ManualOidcObservation)?.stages?.contains(stage) == true

internal fun observeOidc(request: HttpServletRequest, stage: ManualOidcStage) {
  try {
    (request.getAttribute(MANUAL_OIDC_ATTRIBUTE) as? ManualOidcObservation)?.observe(stage)
  } catch (failure: Exception) {
    if (failure is InterruptedException) Thread.currentThread().interrupt()
  }
}

/** Runs outside Spring Session; its final event observes the response after the session filter returns. */
class ManualOidcObservationFilter(
  private val until: Instant?,
  private val canonicalOrigin: String,
  private val revision: String,
  private val clock: Clock = Clock.systemUTC(),
  private val emit: (String) -> Unit = { System.out.println(it) },
  private val authorizationEndpoint: String = "https://accounts.google.com/o/oauth2/v2/auth"
) : OncePerRequestFilter() {
  private val bootId = UUID.randomUUID()
  private val emitted = AtomicInteger()
  init {
    if (until != null) {
      require(SharedQualificationFilter.validRevision(revision)) { "MANUAL_OIDC_REVISION_REJECTED" }
      require(!until.isAfter(clock.instant().plusSeconds(7200))) { "MANUAL_OIDC_DEADLINE_REJECTED" }
    }
  }

  override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
    val start = request.method == "GET" && request.requestURI == OIDC_START_PATH
    val callback = request.method == "GET" && request.requestURI == OIDC_CALLBACK_PATH
    if ((!start && !callback) || until == null || !clock.instant().isBefore(until)) {
      chain.doFilter(request, response); return
    }
    val correlation = UUID.randomUUID()
    val observation = ManualOidcObservation { stage ->
      if (clock.instant().isBefore(until)) {
        val sequence = emitted.updateAndGet { if (it < 64) it + 1 else 65 }
        if (sequence <= 64) {
          val boundedStage = if (sequence == 64) ManualOidcStage.SATURATED else stage
          emit("""{"type":"M12_OIDC_MANUAL_01","correlation":"$correlation","bootId":"$bootId","revision":"$revision","sequence":$sequence,"stage":"$boundedStage"}""")
        }
      }
    }
    request.setAttribute(MANUAL_OIDC_ATTRIBUTE, observation)
    observeOidc(request, if (start) ManualOidcStage.START_RECEIVED else ManualOidcStage.CALLBACK_RECEIVED)
    var returned = false
    try {
      chain.doFilter(request, response)
      returned = true
    } catch (failure: Exception) {
      // An outer/late failure remains visible after any earlier failure. Never replace or stringify it.
      observeOidc(request, ManualOidcStage.FAILURE_REQUEST_UNKNOWN)
      throw failure
    } finally {
      // The diagnostic must not replace a security failure, even when output/response parsing fails.
      try {
        if (start) {
          observeOidc(request, if (returned && ManualOidcStage.AUTHORIZATION_SAVED in observation.stages &&
            response.status == 302 && preparedRedirect(response.getHeader("Location")))
            ManualOidcStage.START_PREPARED else ManualOidcStage.START_NOT_PREPARED)
        } else if (!returned || ManualOidcStage.LOGIN_COMPLETED !in observation.stages &&
          ManualOidcStage.ADMISSION_DENIED !in observation.stages) {
          observeOidc(request, if (ManualOidcStage.PROTOCOL_VALIDATED in observation.stages)
            ManualOidcStage.OTHER_FAILURE else ManualOidcStage.PROTOCOL_NOT_COMPLETED)
        }
        if (callback && returned) observeOidc(request, ManualOidcStage.CALLBACK_FINISHED)
      } catch (failure: Exception) {
        if (failure is InterruptedException) Thread.currentThread().interrupt()
      } finally {
        request.removeAttribute(MANUAL_OIDC_ATTRIBUTE)
      }
    }
  }

  private fun preparedRedirect(location: String?): Boolean = try {
    val uri = URI(location ?: "")
    val endpoint = URI(authorizationEndpoint)
    val query = uri.rawQuery.orEmpty().split('&').map {
      URLDecoder.decode(it.substringBefore('='), StandardCharsets.UTF_8) to
        URLDecoder.decode(it.substringAfter('=', ""), StandardCharsets.UTF_8)
    }.groupBy({ it.first }, { it.second })
    uri.scheme == endpoint.scheme && uri.rawAuthority == endpoint.rawAuthority && uri.rawPath == endpoint.rawPath &&
      uri.rawFragment == null && query["redirect_uri"] == listOf(canonicalOrigin + OIDC_CALLBACK_PATH) &&
      query["scope"] == listOf("openid") && query["response_type"] == listOf("code") &&
      query["code_challenge_method"] == listOf("S256") &&
      query["code_challenge"]?.singleOrNull()?.matches(Regex("[A-Za-z0-9_-]{43}")) == true
  } catch (_: Exception) { false }
}

