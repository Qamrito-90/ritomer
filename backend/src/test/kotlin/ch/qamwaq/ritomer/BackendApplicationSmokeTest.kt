package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import ch.qamwaq.ritomer.identity.application.CurrentAuthenticatedActorProvider
import ch.qamwaq.ritomer.identity.application.IDENTITY_ACTIVE_TENANT_SELECTED_ACTION
import ch.qamwaq.ritomer.identity.application.TENANT_AUDIT_RESOURCE_TYPE
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.identity.infrastructure.security.SecurityAuthenticatedActorProvider
import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import ch.qamwaq.ritomer.shared.application.ActorAuthorityFreshness
import ch.qamwaq.ritomer.shared.application.ActorAuthorityFreshnessVerifier
import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import ch.qamwaq.ritomer.shared.application.AuthenticationMechanism
import ch.qamwaq.ritomer.shared.application.REQUEST_ID_HEADER
import ch.qamwaq.ritomer.shared.infrastructure.security.TENANT_HEADER_REASON_CODE_ATTRIBUTE
import ch.qamwaq.ritomer.shared.infrastructure.security.TENANT_MDC_AUTHORIZED_VALUE_ATTRIBUTE
import ch.qamwaq.ritomer.shared.infrastructure.security.TENANT_MDC_BIND_COUNT_ATTRIBUTE
import ch.qamwaq.ritomer.shared.infrastructure.security.TENANT_MDC_CLEARED_ATTRIBUTE
import ch.qamwaq.ritomer.shared.infrastructure.security.TENANT_MDC_FILTER_AUTHENTICATED_AT_ENTRY_ATTRIBUTE
import ch.qamwaq.ritomer.shared.infrastructure.security.TENANT_MDC_FILTER_INVOCATION_COUNT_ATTRIBUTE
import ch.qamwaq.ritomer.shared.infrastructure.security.TENANT_MDC_KEY
import ch.qamwaq.ritomer.shared.infrastructure.security.TENANT_MDC_PRESENT_AT_FILTER_ENTRY_ATTRIBUTE
import ch.qamwaq.ritomer.shared.infrastructure.security.TENANT_MDC_PRESENT_BEFORE_BIND_ATTRIBUTE
import ch.qamwaq.ritomer.shared.infrastructure.security.TenantMdcFilter
import jakarta.servlet.DispatcherType
import jakarta.servlet.Filter
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.ObjectInputStream
import java.io.ObjectOutputStream
import java.lang.reflect.Modifier
import java.nio.file.Files
import java.nio.file.Path
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.hamcrest.Matchers.nullValue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito.clearInvocations
import org.mockito.Mockito.mockingDetails
import org.slf4j.MDC
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.Authentication
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.security.web.FilterChainProxy
import org.springframework.security.web.access.intercept.AuthorizationFilter
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean
import org.springframework.test.util.ReflectionTestUtils
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath as mvcJsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status as mvcStatus

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class)
class BackendApplicationSmokeTest {
  @Autowired
  private lateinit var mockMvc: MockMvc

  @Autowired
  private lateinit var applicationContext: ApplicationContext

  @Autowired
  private lateinit var identityTestStore: IdentityTestStore

  @Autowired
  private lateinit var auditTestStore: AuditTestStore

  @Autowired
  private lateinit var closingFolderTestStore: ClosingFolderTestStore

  @Autowired
  private lateinit var currentAuthenticatedActorProvider: CurrentAuthenticatedActorProvider

  @Autowired
  private lateinit var actorAuthorityFreshnessVerifier: ActorAuthorityFreshnessVerifier

  @MockitoSpyBean
  private lateinit var tenantMdcFilter: TenantMdcFilter

  @Autowired
  private lateinit var filterChainProxy: FilterChainProxy

  @BeforeEach
  fun resetTestStores() {
    identityTestStore.reset()
    auditTestStore.reset()
    closingFolderTestStore.reset()
    SecurityContextHolder.clearContext()
    MDC.remove(TENANT_MDC_KEY)
  }

  @Test
  fun `context loads and health endpoint remains public`() {
    mockMvc.get("/actuator/health")
      .andExpect {
        status { isOk() }
        jsonPath("$.status") { value("UP") }
      }
  }

  @Test
  fun `api me rejects missing authentication`() {
    mockMvc.get("/api/me")
      .andExpect {
        status { isUnauthorized() }
      }
  }

  @Test
  fun `legacy jwt rejects missing blank unknown and inactive subjects without writes`() {
    val missing = mockMvc.get("/api/me") {
      with(actorJwt(subject = null))
    }.andExpect {
      status { isForbidden() }
    }.andReturn()
    assertFilterCleared(missing)

    val blank = mockMvc.get("/api/me") {
      with(actorJwt(subject = "   "))
    }.andExpect {
      status { isForbidden() }
    }.andReturn()
    assertFilterCleared(blank)

    val unknown = mockMvc.get("/api/me") {
      with(actorJwt(subject = "unknown-user"))
    }.andExpect {
      status { isForbidden() }
    }.andReturn()
    assertFilterCleared(unknown)

    identityTestStore.seedUser("inactive-user", status = "INACTIVE")
    val inactive = mockMvc.get("/api/me") {
      with(actorJwt(subject = "inactive-user"))
    }.andExpect {
      status { isForbidden() }
    }.andReturn()
    assertFilterCleared(inactive)

    assertThat(identityTestStore.userCount()).isEqualTo(1)
    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `legacy jwt actor is read only ignores claims and uses server clock and correlation`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val persisted = identityTestStore.seedUser(
      externalSubject = "user-123",
      email = "persisted@example.test",
      displayName = "Persisted User"
    )
    identityTestStore.seedActiveMembership(
      "user-123",
      tenantId,
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.ACCOUNTANT
    )

    val jwtAuthentication = JwtAuthenticationToken(
      syntheticJwt(
        subject = "user-123",
        claims = mapOf(
          "email" to "claim@example.test",
          "name" to "Claim User",
          "tenant_id" to UUID.randomUUID().toString(),
          "roles" to listOf("ADMIN")
        )
      ),
      emptyList()
    )
    val actor = withAuthentication(jwtAuthentication) {
      currentAuthenticatedActorProvider.current()
    }

    assertThat(actor.actorId).isEqualTo(persisted.id)
    assertThat(actor.authenticationMechanism).isEqualTo(AuthenticationMechanism.LEGACY_JWT)
    assertThat(actor.authenticatedAt).isEqualTo(AUTHENTICATED_ACTOR_TEST_INSTANT)
    assertThat(actor.opaqueAuthCorrelation).isNotBlank()
    assertThat(actor.opaqueAuthCorrelation).isNotIn("user-123", "claim@example.test", "ADMIN")
    assertThat(UUID.fromString(actor.opaqueAuthCorrelation).toString()).isEqualTo(actor.opaqueAuthCorrelation)

    val response = mockMvc.get("/api/me") {
      with(
        actorJwt(
          subject = "user-123",
          email = "claim@example.test",
          name = "Claim User",
          extraClaims = mapOf(
            "tenant_id" to UUID.randomUUID().toString(),
            "roles" to listOf("ADMIN")
          )
        )
      )
    }.andExpect {
      status { isOk() }
      jsonPath("$.actor.externalSubject") { value("user-123") }
      jsonPath("$.actor.email") { value("persisted@example.test") }
      jsonPath("$.actor.displayName") { value("Persisted User") }
      jsonPath("$.effectiveRoles[0]") { value("ACCOUNTANT") }
    }.andReturn()

    assertAuthorizedTenantTrace(response, tenantId)
    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `authenticated actor has exactly four fields and stable serialization`() {
    val user = identityTestStore.seedUser("serial-user")
    val actor = withAuthentication(JwtAuthenticationToken(syntheticJwt("serial-user"), emptyList())) {
      currentAuthenticatedActorProvider.current()
    }

    val instanceFieldNames = AuthenticatedActor::class.java.declaredFields
      .filterNot { Modifier.isStatic(it.modifiers) }
      .map { it.name }
      .toSet()
    assertThat(instanceFieldNames).containsExactlyInAnyOrder(
      "actorId",
      "authenticationMechanism",
      "authenticatedAt",
      "opaqueAuthCorrelation"
    )

    val serialized = serialize(actor)
    assertThat(serialize(actor)).isEqualTo(serialized)
    val restored = ObjectInputStream(ByteArrayInputStream(serialized)).use {
      it.readObject() as AuthenticatedActor
    }
    assertThat(restored).isEqualTo(actor)
    assertThat(serialize(restored)).isEqualTo(serialized)
    assertThat(restored.actorId).isEqualTo(user.id)
    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `authenticated actor principal is returned as the exact same instance`() {
    val actor = authenticatedActor(UUID.randomUUID())
    val authentication = UsernamePasswordAuthenticationToken(actor, null, emptyList())

    val resolved = withAuthentication(authentication) {
      currentAuthenticatedActorProvider.current()
    }

    assertThat(resolved).isSameAs(actor)
    assertThat(currentAuthenticatedActorProvider).isInstanceOf(SecurityAuthenticatedActorProvider::class.java)
    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `fresh authority rereads user and grants and revokes immediately`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val user = identityTestStore.seedUser("fresh-user")
    identityTestStore.seedActiveMembership(
      "fresh-user",
      tenantId,
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.ACCOUNTANT
    )

    mockMvc.get("/api/me") {
      with(authentication(actorAuthentication(user.id)))
    }.andExpect {
      status { isOk() }
    }

    identityTestStore.setUserStatus(user.id, "INACTIVE")
    val revoked = mockMvc.get("/api/me") {
      with(authentication(actorAuthentication(user.id)))
    }.andExpect {
      status { isForbidden() }
    }.andReturn()

    assertFilterCleared(revoked)
    assertThat(identityTestStore.repositoryCounters().actorIdReads).isEqualTo(2)
    assertThat(identityTestStore.repositoryCounters().membershipGrantReads).isEqualTo(2)
    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `membership revocation is visible on the next request`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val user = identityTestStore.seedUser("membership-user")
    identityTestStore.seedActiveMembership(
      "membership-user",
      tenantId,
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.ACCOUNTANT
    )

    mockMvc.get("/api/me") {
      with(authentication(actorAuthentication(user.id)))
    }.andExpect {
      status { isOk() }
    }

    identityTestStore.setMembershipStatus(user.id, tenantId, "INACTIVE")
    mockMvc.get("/api/me") {
      with(authentication(actorAuthentication(user.id)))
    }.andExpect {
      status { isForbidden() }
    }

    assertThat(identityTestStore.repositoryCounters().actorIdReads).isEqualTo(2)
    assertThat(identityTestStore.repositoryCounters().membershipGrantReads).isEqualTo(2)
    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `freshness verifier distinguishes revoked authority and propagates repository failure`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val user = identityTestStore.seedUser("verifier-user")
    identityTestStore.seedActiveMembership(
      "verifier-user",
      tenantId,
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.REVIEWER
    )

    assertThat(actorAuthorityFreshnessVerifier.verifyFreshAuthority(user.id))
      .isEqualTo(ActorAuthorityFreshness.ACTIVE)
    identityTestStore.setTenantStatus(user.id, tenantId, "INACTIVE")
    assertThat(actorAuthorityFreshnessVerifier.verifyFreshAuthority(user.id))
      .isEqualTo(ActorAuthorityFreshness.REVOKED)

    val unknownActorId = UUID.randomUUID()
    assertThat(actorAuthorityFreshnessVerifier.verifyFreshAuthority(unknownActorId))
      .isEqualTo(ActorAuthorityFreshness.REVOKED)

    identityTestStore.failActorIdReads()
    assertThatThrownBy { actorAuthorityFreshnessVerifier.verifyFreshAuthority(user.id) }
      .isInstanceOf(IllegalStateException::class.java)
      .hasMessage("Synthetic app_user read failure.")
    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `tenant header accepts only one canonical lowercase uuid occurrence`() {
    val tenantId = UUID.fromString("aaaaaaaa-1111-1111-1111-111111111111")
    identityTestStore.seedActiveMembership(
      "header-user",
      tenantId,
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.REVIEWER
    )

    val valid = mockMvc.get("/api/me") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt(subject = "header-user"))
    }.andExpect {
      status { isOk() }
    }.andReturn()
    assertAuthorizedTenantTrace(valid, tenantId)
    auditTestStore.reset()

    val invalidSingleValues = listOf(
      "",
      "   ",
      "not-a-uuid",
      tenantId.toString().uppercase(),
      "1-1-1-1-1",
      " ${tenantId} ",
      "${tenantId},${tenantId}"
    )
    invalidSingleValues.forEach { value ->
      val result = mockMvc.get("/api/me") {
        header(ACTIVE_TENANT_HEADER, value)
        with(actorJwt(subject = "header-user"))
      }.andExpect {
        status { isBadRequest() }
        jsonPath("$.code") { value("INVALID_TENANT_HEADER") }
      }.andReturn()
      assertInvalidTenantTrace(result)
    }

    listOf(
      arrayOf(tenantId.toString(), UUID.randomUUID().toString()),
      arrayOf(tenantId.toString(), tenantId.toString())
    ).forEach { headerValues ->
      val result = mockMvc.perform(
        MockMvcRequestBuilders.get("/api/me")
          .header(ACTIVE_TENANT_HEADER, *headerValues)
          .with(actorJwt(subject = "header-user"))
      )
        .andExpect(mvcStatus().isBadRequest)
        .andExpect(mvcJsonPath("$.code").value("INVALID_TENANT_HEADER"))
        .andReturn()
      assertInvalidTenantTrace(result)
    }

    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `requested inaccessible tenant is 403 without mdc bind or audit`() {
    val authorizedTenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    identityTestStore.seedActiveMembership(
      "tenant-denied-user",
      authorizedTenantId,
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.REVIEWER
    )

    val result = mockMvc.get("/api/me") {
      header(ACTIVE_TENANT_HEADER, "22222222-2222-2222-2222-222222222222")
      with(actorJwt(subject = "tenant-denied-user"))
    }.andExpect {
      status { isForbidden() }
    }.andReturn()

    assertThat(result.request.getAttribute(TENANT_MDC_BIND_COUNT_ATTRIBUTE)).isNull()
    assertFilterCleared(result)
    assertThat(auditTestStore.auditEvents()).isEmpty()
    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `role deny is 403 after authorized tenant bind and then mdc is cleared`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    identityTestStore.seedActiveMembership(
      "role-denied-user",
      tenantId,
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.REVIEWER
    )

    val result = mockMvc.post("/api/closing-folders") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content =
        """{"name":"August close","periodStartOn":"2026-08-01","periodEndOn":"2026-08-31","externalRef":null}"""
      with(actorJwt(subject = "role-denied-user"))
    }.andExpect {
      status { isForbidden() }
    }.andReturn()

    assertAuthorizedTenantTrace(result, tenantId)
    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `cross tenant resource is opaque 404 and mdc is cleared`() {
    val authorizedTenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val otherTenantId = UUID.fromString("22222222-2222-2222-2222-222222222222")
    val folder = closingFolder(otherTenantId)
    closingFolderTestStore.save(folder)
    identityTestStore.seedActiveMembership(
      "cross-tenant-user",
      authorizedTenantId,
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.REVIEWER
    )

    val result = mockMvc.get("/api/closing-folders/${folder.id}") {
      header(ACTIVE_TENANT_HEADER, authorizedTenantId.toString())
      with(actorJwt(subject = "cross-tenant-user"))
    }.andExpect {
      status { isNotFound() }
    }.andReturn()

    assertAuthorizedTenantTrace(result, authorizedTenantId)
    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `mdc is cleared after downstream exception without converting it to authority revoked`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val folder = closingFolder(tenantId)
    closingFolderTestStore.save(folder)
    closingFolderTestStore.failReads()
    identityTestStore.seedActiveMembership(
      "failure-user",
      tenantId,
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.REVIEWER
    )

    lateinit var capturedRequest: org.springframework.mock.web.MockHttpServletRequest
    val request = MockMvcRequestBuilders.get("/api/closing-folders/${folder.id}")
      .header(ACTIVE_TENANT_HEADER, tenantId.toString())
      .with(actorJwt(subject = "failure-user"))
      .with { mockRequest ->
        capturedRequest = mockRequest
        mockRequest
      }

    assertThatThrownBy { mockMvc.perform(request) }
      .hasRootCauseInstanceOf(IllegalStateException::class.java)
      .hasStackTraceContaining("Synthetic closing_folder read failure.")

    assertThat(capturedRequest.getAttribute(TENANT_MDC_BIND_COUNT_ATTRIBUTE)).isEqualTo(1)
    assertThat(capturedRequest.getAttribute(TENANT_MDC_CLEARED_ATTRIBUTE)).isEqualTo(true)
    assertThat(MDC.get(TENANT_MDC_KEY)).isNull()
    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `tenant filter has one disabled container registration and one ordered security chain instance`() {
    val tenantFilterBeans = applicationContext.getBeansOfType(TenantMdcFilter::class.java)
    assertThat(tenantFilterBeans).hasSize(1)
    assertThat(tenantFilterBeans.values.single()).isSameAs(tenantMdcFilter)

    val registrations = applicationContext.getBeansOfType(FilterRegistrationBean::class.java)
      .values
      .filter { it.filter is TenantMdcFilter }
    assertThat(registrations).hasSize(1)
    assertThat(registrations.single().filter).isSameAs(tenantMdcFilter)
    assertThat(registrations.single().isEnabled).isFalse()
    val dispatcherTypes = ReflectionTestUtils.getField(registrations.single(), "dispatcherTypes") as Set<*>
    assertThat(dispatcherTypes).containsExactly(DispatcherType.REQUEST)

    val securityFilterChainBeans = applicationContext.getBeansOfType(FilterChainProxy::class.java)
    assertThat(securityFilterChainBeans).hasSize(1)
    assertThat(securityFilterChainBeans.values.single()).isSameAs(filterChainProxy)
    assertThat(applicationContext.getBean("springSecurityFilterChain")).isSameAs(filterChainProxy)

    val outerFilters = (ReflectionTestUtils.getField(mockMvc, "filters") as Array<*>)
      .filterIsInstance<Filter>()
    val outerDelegates = outerFilters.map { outerFilter ->
      ReflectionTestUtils.getField(outerFilter, "delegate") as? Filter ?: outerFilter
    }
    assertThat(outerFilters.count { it is TenantMdcFilter }).isZero()
    assertThat(outerDelegates.count { it is TenantMdcFilter }).isZero()

    val physicalChains = filterChainProxy.filterChains
    assertThat(physicalChains).hasSize(1)
    val physicalTenantFilters = physicalChains
      .flatMap { it.filters }
      .filterIsInstance<TenantMdcFilter>()
    assertThat(physicalTenantFilters).hasSize(1)
    assertThat(physicalTenantFilters.single()).isSameAs(tenantMdcFilter)

    val filters = filterChainProxy.getFilters("/api/me")
    assertThat(filters.count { it is TenantMdcFilter }).isEqualTo(1)
    assertThat(filters.single { it is TenantMdcFilter }).isSameAs(tenantMdcFilter)
    val configuredBearerIndex = filters.indexOfFirst { it is BearerTokenAuthenticationFilter }
    val configuredTenantIndex = filters.indexOfFirst { it === tenantMdcFilter }
    val configuredAuthorizationIndex = filters.indexOfFirst { it is AuthorizationFilter }
    assertThat(configuredBearerIndex).isGreaterThanOrEqualTo(0)
    assertThat(configuredTenantIndex).isGreaterThanOrEqualTo(0)
    assertThat(configuredAuthorizationIndex).isGreaterThanOrEqualTo(0)
    assertThat(configuredBearerIndex).isLessThan(configuredTenantIndex)
    assertThat(configuredTenantIndex).isLessThan(configuredAuthorizationIndex)

    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    identityTestStore.seedActiveMembership(
      "filter-user",
      tenantId,
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.REVIEWER
    )
    assertThat(mockingDetails(tenantMdcFilter).isSpy).isTrue()
    clearInvocations(tenantMdcFilter)

    val instrumentedFilterChainProxy = ReflectionTestUtils.getField(
      filterChainProxy,
      "springSecurityFilterChain"
    ) as FilterChainProxy
    assertThat(instrumentedFilterChainProxy).isNotSameAs(filterChainProxy)
    val originalDecorator = ReflectionTestUtils.getField(
      instrumentedFilterChainProxy,
      "filterChainDecorator"
    )
      as FilterChainProxy.FilterChainDecorator
    val executedFilters = mutableListOf<Filter>()
    var proxyDecorationCount = 0
    instrumentedFilterChainProxy.setFilterChainDecorator(
      FilterChainProxy.FilterChainDecorator { originalChain, securityFilters ->
        proxyDecorationCount += 1
        val filterSnapshot = securityFilters.toList()
        object : jakarta.servlet.FilterChain {
          private var currentIndex = 0

          override fun doFilter(
            request: jakarta.servlet.ServletRequest,
            response: jakarta.servlet.ServletResponse
          ) {
            if (currentIndex == filterSnapshot.size) {
              originalChain.doFilter(request, response)
              return
            }
            val nextFilter = filterSnapshot[currentIndex++]
            executedFilters += nextFilter
            nextFilter.doFilter(request, response, this)
          }
        }
      }
    )

    val result = try {
      mockMvc.get("/api/me") {
        header(ACTIVE_TENANT_HEADER, tenantId.toString())
        with(actorJwt(subject = "filter-user"))
      }.andExpect {
        status { isOk() }
      }.andReturn()
    } finally {
      instrumentedFilterChainProxy.setFilterChainDecorator(originalDecorator)
    }

    assertThat(ReflectionTestUtils.getField(instrumentedFilterChainProxy, "filterChainDecorator"))
      .isSameAs(originalDecorator)
    assertThat(proxyDecorationCount).isEqualTo(1)
    assertThat(executedFilters).containsExactlyElementsOf(filters)
    assertThat(executedFilters.count { it is TenantMdcFilter }).isEqualTo(1)
    assertThat(executedFilters.single { it is TenantMdcFilter }).isSameAs(tenantMdcFilter)
    val executedBearerIndex = executedFilters.indexOfFirst { it is BearerTokenAuthenticationFilter }
    val executedTenantIndex = executedFilters.indexOfFirst { it === tenantMdcFilter }
    val executedAuthorizationIndex = executedFilters.indexOfFirst { it is AuthorizationFilter }
    assertThat(executedBearerIndex).isGreaterThanOrEqualTo(0)
    assertThat(executedTenantIndex).isGreaterThanOrEqualTo(0)
    assertThat(executedAuthorizationIndex).isGreaterThanOrEqualTo(0)
    assertThat(executedBearerIndex).isLessThan(executedTenantIndex)
    assertThat(executedTenantIndex).isLessThan(executedAuthorizationIndex)
    assertThat(result.request.getAttribute(TENANT_MDC_FILTER_INVOCATION_COUNT_ATTRIBUTE)).isEqualTo(1)
    assertThat(result.request.getAttribute(TENANT_MDC_FILTER_AUTHENTICATED_AT_ENTRY_ATTRIBUTE)).isEqualTo(true)
    assertThat(
      mockingDetails(tenantMdcFilter).invocations.count { it.method.name == "doFilter" }
    ).isEqualTo(1)
    assertAuthorizedTenantTrace(result, tenantId)
  }

  @Test
  fun `shared authority types and identity adapter keep module seams`() {
    val actorSource = Files.readString(
      Path.of("src/main/kotlin/ch/qamwaq/ritomer/shared/application/AuthenticatedActor.kt")
    )
    assertThat(actorSource).doesNotContain(
      "jakarta.servlet",
      "org.springframework",
      "identity.",
      ".infrastructure"
    )

    val resolutionSource = Files.readString(
      Path.of("src/main/kotlin/ch/qamwaq/ritomer/identity/application/ActorResolutionSupport.kt")
    )
    assertThat(resolutionSource).contains("CurrentAuthenticatedActorProvider")
    assertThat(resolutionSource).doesNotContain(
      "org.springframework.security",
      "SecurityAuthenticatedActorProvider",
      "shared.infrastructure"
    )

    val adapters = applicationContext.getBeansOfType(CurrentAuthenticatedActorProvider::class.java)
    assertThat(adapters).hasSize(1)
    assertThat(adapters.values.single()).isInstanceOf(SecurityAuthenticatedActorProvider::class.java)
    assertThat(applicationContext.getBeansOfType(ActorAuthorityFreshnessVerifier::class.java)).hasSize(1)
  }

  @Test
  fun `explicit valid tenant selection emits one audit only after authorization`() {
    val tenantAlphaId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = UUID.fromString("33333333-3333-3333-3333-333333333333")
    identityTestStore.seedActiveMembership(
      "audit-user",
      tenantAlphaId,
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.ACCOUNTANT
    )
    identityTestStore.seedActiveMembership(
      "audit-user",
      tenantBetaId,
      "tenant-beta",
      "Tenant Beta",
      TenantRole.ADMIN
    )

    val result = mockMvc.get("/api/me") {
      header(ACTIVE_TENANT_HEADER, tenantBetaId.toString())
      header(REQUEST_ID_HEADER, "req-explicit-tenant")
      header("User-Agent", "BackendApplicationSmokeTest")
      with(actorJwt(subject = "audit-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.activeTenant.tenantId") { value(tenantBetaId.toString()) }
      jsonPath("$.effectiveRoles[0]") { value("ADMIN") }
    }.andReturn()

    assertAuthorizedTenantTrace(result, tenantBetaId)
    val auditEvents = auditTestStore.auditEvents()
    assertThat(auditEvents).hasSize(1)
    assertThat(auditEvents.single().command.tenantId).isEqualTo(tenantBetaId)
    assertThat(auditEvents.single().command.actorSubject).isEqualTo("audit-user")
    assertThat(auditEvents.single().command.actorRoles).containsExactly("ADMIN")
    assertThat(auditEvents.single().command.action).isEqualTo(IDENTITY_ACTIVE_TENANT_SELECTED_ACTION)
    assertThat(auditEvents.single().command.resourceType).isEqualTo(TENANT_AUDIT_RESOURCE_TYPE)
    assertThat(auditEvents.single().command.resourceId).isEqualTo(tenantBetaId.toString())
    assertThat(auditEvents.single().command.metadata)
      .containsEntry("selection_source", ACTIVE_TENANT_HEADER)
    assertThat(auditEvents.single().command.correlation.requestId).isEqualTo("req-explicit-tenant")
    assertThat(auditEvents.single().command.correlation.userAgent).isEqualTo("BackendApplicationSmokeTest")
    assertThat(identityTestStore.repositoryCounters().totalWrites).isZero()
  }

  @Test
  fun `multiple memberships without a requested tenant do not bind mdc`() {
    identityTestStore.seedActiveMembership(
      "multi-user",
      UUID.fromString("11111111-1111-1111-1111-111111111111"),
      "tenant-alpha",
      "Tenant Alpha",
      TenantRole.ACCOUNTANT
    )
    identityTestStore.seedActiveMembership(
      "multi-user",
      UUID.fromString("33333333-3333-3333-3333-333333333333"),
      "tenant-beta",
      "Tenant Beta",
      TenantRole.MANAGER
    )

    val result = mockMvc.get("/api/me") {
      with(actorJwt(subject = "multi-user"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.activeTenant") { value(nullValue()) }
      jsonPath("$.effectiveRoles.length()") { value(0) }
    }.andReturn()

    assertThat(result.request.getAttribute(TENANT_MDC_BIND_COUNT_ATTRIBUTE)).isNull()
    assertFilterCleared(result)
    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  private fun assertInvalidTenantTrace(result: MvcResult) {
    assertThat(result.request.getAttribute(TENANT_MDC_FILTER_INVOCATION_COUNT_ATTRIBUTE)).isEqualTo(1)
    assertThat(result.request.getAttribute(TENANT_MDC_FILTER_AUTHENTICATED_AT_ENTRY_ATTRIBUTE)).isEqualTo(true)
    assertThat(result.request.getAttribute(TENANT_HEADER_REASON_CODE_ATTRIBUTE)).isNotEqualTo("VALID")
    assertThat(result.request.getAttribute(TENANT_MDC_BIND_COUNT_ATTRIBUTE)).isNull()
    assertFilterCleared(result)
  }

  private fun assertAuthorizedTenantTrace(result: MvcResult, tenantId: UUID) {
    assertThat(result.request.getAttribute(TENANT_MDC_PRESENT_AT_FILTER_ENTRY_ATTRIBUTE)).isEqualTo(false)
    assertThat(result.request.getAttribute(TENANT_MDC_PRESENT_BEFORE_BIND_ATTRIBUTE)).isEqualTo(false)
    assertThat(result.request.getAttribute(TENANT_MDC_BIND_COUNT_ATTRIBUTE)).isEqualTo(1)
    assertThat(result.request.getAttribute(TENANT_MDC_AUTHORIZED_VALUE_ATTRIBUTE)).isEqualTo(tenantId.toString())
    assertFilterCleared(result)
  }

  private fun assertFilterCleared(result: MvcResult) {
    assertThat(result.request.getAttribute(TENANT_MDC_CLEARED_ATTRIBUTE)).isEqualTo(true)
    assertThat(MDC.get(TENANT_MDC_KEY)).isNull()
  }

  private fun actorAuthentication(actorId: UUID): Authentication =
    UsernamePasswordAuthenticationToken(authenticatedActor(actorId), null, emptyList())

  private fun authenticatedActor(actorId: UUID): AuthenticatedActor =
    AuthenticatedActor(
      actorId = actorId,
      authenticationMechanism = AuthenticationMechanism.LOCAL_SESSION,
      authenticatedAt = AUTHENTICATED_ACTOR_TEST_INSTANT,
      opaqueAuthCorrelation = "opaque-test-correlation"
    )

  private fun closingFolder(tenantId: UUID): ClosingFolder {
    val timestamp = OffsetDateTime.ofInstant(Instant.parse("2026-08-22T12:00:00Z"), ZoneOffset.UTC)
    return ClosingFolder(
      id = UUID.randomUUID(),
      tenantId = tenantId,
      name = "Cross-tenant folder",
      periodStartOn = LocalDate.parse("2026-08-01"),
      periodEndOn = LocalDate.parse("2026-08-31"),
      externalRef = null,
      status = ClosingFolderStatus.DRAFT,
      archivedAt = null,
      archivedByUserId = null,
      createdAt = timestamp,
      updatedAt = timestamp
    )
  }

  private fun <T> withAuthentication(authentication: Authentication, block: () -> T): T {
    val context = SecurityContextHolder.createEmptyContext()
    context.authentication = authentication
    SecurityContextHolder.setContext(context)
    return try {
      block()
    } finally {
      SecurityContextHolder.clearContext()
    }
  }
}

private fun actorJwt(
  subject: String? = "user-123",
  email: String? = null,
  name: String? = null,
  preferredUsername: String? = null,
  extraClaims: Map<String, Any> = emptyMap()
) = jwt().jwt { token ->
  token.claims { claims ->
    if (subject == null) {
      claims.remove("sub")
    }
  }
  subject?.let { token.subject(it) }
  email?.let { token.claim("email", it) }
  name?.let { token.claim("name", it) }
  preferredUsername?.let { token.claim("preferred_username", it) }
  extraClaims.forEach { (claimName, value) -> token.claim(claimName, value) }
}

private fun syntheticJwt(
  subject: String,
  claims: Map<String, Any> = emptyMap()
): Jwt {
  val issuedAt = Instant.parse("2026-08-22T10:00:00Z")
  return Jwt.withTokenValue("synthetic-test-value")
    .header("alg", "none")
    .subject(subject)
    .issuedAt(issuedAt)
    .expiresAt(issuedAt.plusSeconds(300))
    .apply { claims.forEach { (name, value) -> claim(name, value) } }
    .build()
}

private fun serialize(actor: AuthenticatedActor): ByteArray =
  ByteArrayOutputStream().use { bytes ->
    ObjectOutputStream(bytes).use { it.writeObject(actor) }
    bytes.toByteArray()
  }
