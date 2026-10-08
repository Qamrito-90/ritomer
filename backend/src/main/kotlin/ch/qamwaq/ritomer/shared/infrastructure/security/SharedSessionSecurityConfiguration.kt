package ch.qamwaq.ritomer.shared.infrastructure.security

import jakarta.servlet.DispatcherType
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.core.env.Environment
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.session.Session
import org.springframework.session.jdbc.config.annotation.web.http.EnableJdbcHttpSession
import org.springframework.session.web.http.DefaultCookieSerializer
import org.springframework.session.web.http.SessionRepositoryFilter
import org.springframework.transaction.PlatformTransactionManager

@Configuration(proxyBeanMethods = false)
@Profile("shared-internal")
@EnableConfigurationProperties(SharedSessionProperties::class)
@EnableJdbcHttpSession(maxInactiveIntervalInSeconds = 1800, tableName = "SPRING_SESSION")
@EnableScheduling
class SharedSessionSecurityConfiguration {
  @Bean
  fun validatedSharedProperties(properties: SharedSessionProperties, environment: Environment): SharedSessionBoundaryFilter {
    properties.validate(environment.activeProfiles.toSet(), environment.getProperty("K_SERVICE"))
    require(environment.getProperty("ritomer.security.session.enabled", Boolean::class.java) == true)
    require(environment.getProperty("ritomer.security.jwt.hmac-secret").isNullOrBlank()) {
      "Legacy credentials are forbidden in the shared profile."
    }
    require(environment.getProperty("server.forward-headers-strategy") == "none") {
      "Shared origin validation must inspect the original headers."
    }
    require(environment.getProperty("server.servlet.session.cookie.domain").isNullOrEmpty())
    return SharedSessionBoundaryFilter(properties)
  }

  @Bean
  fun sharedBoundaryRegistration(filter: SharedSessionBoundaryFilter) =
    FilterRegistrationBean(filter).apply { isEnabled = false; setDispatcherTypes(DispatcherType.REQUEST) }

  @Bean
  fun sharedSessionFilterRegistration(filter: SessionRepositoryFilter<out Session>) =
    FilterRegistrationBean(filter).apply {
      order = SessionRepositoryFilter.DEFAULT_ORDER
      setDispatcherTypes(DispatcherType.REQUEST, DispatcherType.ASYNC, DispatcherType.ERROR)
    }

  @Bean
  fun cookieSerializer() = DefaultCookieSerializer().apply {
    setCookieName(SESSION_COOKIE_NAME)
    setCookiePath("/")
    setUseSecureCookie(true)
    setUseHttpOnlyCookie(true)
    setSameSite("Lax")
    setUseBase64Encoding(false)
  }

  @Bean
  fun oidcTransactions(jdbc: JdbcTemplate, transactionManager: PlatformTransactionManager): OidcTransactionStore =
    JdbcOidcTransactionStore(jdbc, transactionManager)

  @Bean
  fun expiredOidcTransactionCleanup(store: OidcTransactionStore) = ExpiredOidcTransactionCleanup(store)
}

class ExpiredOidcTransactionCleanup(private val store: OidcTransactionStore) {
  @Scheduled(fixedDelay = 60000)
  fun purge() { store.purgeExpired() }
}

