package ch.qamwaq.ritomer.shared.infrastructure.security

import java.nio.charset.StandardCharsets
import javax.crypto.spec.SecretKeySpec
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter
import org.springframework.security.web.SecurityFilterChain

@Configuration
@EnableMethodSecurity
class SecurityConfig(
  @Value("\${ritomer.security.jwt.hmac-secret}")
  private val hmacSecret: String
) {
  @Bean
  fun securityFilterChain(
    http: HttpSecurity,
    jwtAuthenticationConverter: JwtAuthenticationConverter,
    tenantMdcFilter: TenantMdcFilter
  ): SecurityFilterChain {
    http
      .csrf { it.disable() }
      .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
      .authorizeHttpRequests {
        it.requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
        it.requestMatchers(HttpMethod.GET, "/api/me").authenticated()
        it.anyRequest().authenticated()
      }
      .oauth2ResourceServer {
        it.jwt { jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter) }
      }
      .addFilterAfter(tenantMdcFilter, BearerTokenAuthenticationFilter::class.java)

    return http.build()
  }

  @Bean
  fun jwtDecoder(): JwtDecoder {
    val key = SecretKeySpec(hmacSecret.toByteArray(StandardCharsets.UTF_8), "HmacSHA256")
    return NimbusJwtDecoder.withSecretKey(key).build()
  }

  @Bean
  fun jwtAuthenticationConverter(): JwtAuthenticationConverter {
    val scopeAuthoritiesConverter = JwtGrantedAuthoritiesConverter()

    return JwtAuthenticationConverter().apply {
      setJwtGrantedAuthoritiesConverter { jwt -> scopeAuthoritiesConverter.convert(jwt)?.toSet().orEmpty() }
    }
  }
}
