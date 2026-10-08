package ch.qamwaq.ritomer.shared.infrastructure.security

import ch.qamwaq.ritomer.shared.application.OidcActorAdmission
import ch.qamwaq.ritomer.shared.application.OidcAdmissionDeniedException
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
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
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm
import org.springframework.security.oauth2.jwt.JwtTimestampValidator
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy
import org.springframework.security.web.context.HttpSessionSecurityContextRepository
import org.springframework.security.web.savedrequest.NullRequestCache
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.support.TransactionTemplate
import java.time.Duration

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
    DefaultOAuth2AuthorizationRequestResolver(registrations, "/oauth2/authorization").apply {
      setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce())
    }
  ).apply {
    setAuthorizationRequestRepository(requests)
    setRequestCache(NullRequestCache())
    setAuthenticationFailureHandler { _, response, _ -> failOidc(response) }
  }
  private val login = MinimalActorOidcLoginFilter(registrations, admission).apply {
    val provider = OidcAuthorizationCodeAuthenticationProvider(
      RestClientAuthorizationCodeTokenResponseClient(),
      OidcUserService().apply { setRetrieveUserInfo { false } }
    )
    provider.setJwtDecoderFactory(OidcIdTokenDecoderFactory().apply {
      setJwsAlgorithmResolver { SignatureAlgorithm.RS256 }
      setJwtValidatorFactory { registration ->
        DelegatingOAuth2TokenValidator(OidcIdTokenValidator(registration), JwtTimestampValidator(Duration.ZERO))
      }
    })
    setAuthenticationManager(ProviderManager(listOf(provider)))
    setAuthorizationRequestRepository(requests)
    setSecurityContextRepository(contextRepository)
    setSessionAuthenticationStrategy(sessionStrategy)
    setAuthenticationSuccessHandler { request, response, _ ->
      response.setHeader("Cache-Control", "no-store")
      response.sendRedirect(safeSharedReturnPath(request.getAttribute(OIDC_TRANSACTION_RETURN_PATH) as? String))
    }
    setAuthenticationFailureHandler { _, response, _ -> failOidc(response) }
  }

  fun configure(http: HttpSecurity) {
    http.addFilterAt(redirect, OAuth2AuthorizationRequestRedirectFilter::class.java)
    http.addFilterAt(login, OAuth2LoginAuthenticationFilter::class.java)
  }
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
    val validated = super.attemptAuthentication(request, response) as? OAuth2AuthenticationToken ?: oidcDenied()
    val oidc = validated.principal as? OidcUser ?: oidcDenied()
    val actor = try {
      admission.admit(oidc.issuer.toString(), oidc.subject)
    } catch (_: OidcAdmissionDeniedException) {
      oidcDenied()
    }
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
    val session = request.getSession(false) ?: oidcDenied()
    if (authorizationRequest == null) { store.clear(digest(session.id)); return }
    val nonce = authorizationRequest.getAttribute<String>("nonce") ?: oidcDenied()
    val verifier = authorizationRequest.getAttribute<String>("code_verifier") ?: oidcDenied()
    val state = authorizationRequest.state?.takeIf { it.length in 1..256 } ?: oidcDenied()
    if (authorizationRequest.redirectUri != registration.redirectUri ||
      authorizationRequest.scopes != setOf("openid")
    ) oidcDenied()
    store.save(
      digest(state), digest(session.id),
      OidcTransaction(nonce, verifier, safeSharedReturnPath(request.getParameter("returnPath")))
    )
  }

  override fun loadAuthorizationRequest(request: HttpServletRequest): OAuth2AuthorizationRequest? = restore(request, false)

  override fun removeAuthorizationRequest(
    request: HttpServletRequest, response: HttpServletResponse
  ): OAuth2AuthorizationRequest? = restore(request, true)

  private fun restore(request: HttpServletRequest, consume: Boolean): OAuth2AuthorizationRequest? {
    val stateValues = request.getParameterValues("state") ?: return null
    if (stateValues.size != 1 || stateValues[0].length !in 1..256) return null
    if (request.getParameterValues("code")?.size?.let { it != 1 } == true ||
      request.getParameterValues("error")?.size?.let { it != 1 } == true) return null
    val session = request.getSession(false) ?: return null
    val state = stateValues[0]
    val transaction = if (consume) store.consume(digest(state), digest(session.id))
      else store.read(digest(state), digest(session.id))
    if (transaction == null) return null
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

