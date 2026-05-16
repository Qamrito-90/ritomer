package ch.qamwaq.ritomer.devtools

import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import com.nimbusds.jose.jwk.source.ImmutableSecret
import com.nimbusds.jose.proc.SecurityContext
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.util.UUID
import javax.crypto.spec.SecretKeySpec
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.env.Environment
import org.springframework.http.HttpHeaders
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.JwsHeader
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@SpringBootTest(properties = ["ritomer.demo.seed.enabled=true"])
@AutoConfigureMockMvc
@ActiveProfiles("dbtest")
@Tag("db-integration")
@EnabledIfEnvironmentVariable(named = "RITOMER_DB_TESTS_ENABLED", matches = "true")
class DemoSeedLocalAuthMeDbIntegrationTest {
  @Autowired
  private lateinit var jdbcTemplate: JdbcTemplate

  @Autowired
  private lateinit var demoSeedLocalService: DemoSeedLocalService

  @Autowired
  private lateinit var environment: Environment

  @Autowired
  private lateinit var mockMvc: MockMvc

  @BeforeEach
  fun resetDatabaseState() {
    jdbcTemplate.execute(
      """
      truncate table
        audit_event,
        mapping_suggestion_decision_request,
        export_pack,
        document_verification,
        document,
        workpaper_evidence,
        workpaper,
        manual_mapping,
        balance_import_line,
        balance_import,
        closing_folder,
        tenant_membership,
        app_user,
        tenant
      cascade
      """.trimIndent()
    )
    demoSeedLocalService.seed()
  }

  @Test
  fun `api me requires a bearer token even when demo seed exists`() {
    mockMvc.get("/api/me")
      .andExpect {
        status { isUnauthorized() }
      }
  }

  @Test
  fun `api me resolves active tenant and effective roles from seeded database membership`() {
    val spoofedTenantId = UUID.fromString("036b0000-0000-4000-8000-000000009999")
    val token = signedBearerToken(
      subject = DemoSeedLocalDataset.userExternalSubject,
      extraClaims = mapOf(
        "tenant_id" to spoofedTenantId.toString(),
        "roles" to listOf("ADMIN")
      )
    )

    mockMvc.get("/api/me") {
      header(HttpHeaders.AUTHORIZATION, "Bearer $token")
    }.andExpect {
      status { isOk() }
      jsonPath("$.actor.externalSubject") { value(DemoSeedLocalDataset.userExternalSubject) }
      jsonPath("$.activeTenant.tenantId") { value(DemoSeedLocalDataset.tenantId.toString()) }
      jsonPath("$.activeTenant.tenantSlug") { value(DemoSeedLocalDataset.tenantSlug) }
      jsonPath("$.activeTenant.tenantName") { value(DemoSeedLocalDataset.tenantLegalName) }
      jsonPath("$.effectiveRoles.length()") { value(1) }
      jsonPath("$.effectiveRoles[0]") { value(DemoSeedLocalDataset.membershipRole) }
      jsonPath("$.memberships.length()") { value(1) }
      jsonPath("$.memberships[0].tenantId") { value(DemoSeedLocalDataset.tenantId.toString()) }
      jsonPath("$.memberships[0].roles.length()") { value(1) }
      jsonPath("$.memberships[0].roles[0]") { value(DemoSeedLocalDataset.membershipRole) }
    }
  }

  @Test
  fun `tenant scoped closing endpoint rejects an inaccessible tenant with signed bearer token`() {
    val inaccessibleTenantId = UUID.fromString("036b0000-0000-4000-8000-000000008888")
    val token = signedBearerToken(subject = DemoSeedLocalDataset.userExternalSubject)

    mockMvc.get("/api/closing-folders/${DemoSeedLocalDataset.closingFolderId}") {
      header(HttpHeaders.AUTHORIZATION, "Bearer $token")
      header(ACTIVE_TENANT_HEADER, inaccessibleTenantId.toString())
    }.andExpect {
      status { isForbidden() }
    }
  }

  private fun signedBearerToken(
    subject: String,
    extraClaims: Map<String, Any> = emptyMap()
  ): String {
    val hmacSecret = environment.getRequiredProperty("ritomer.security.jwt.hmac-secret")
    val secretKey = SecretKeySpec(hmacSecret.toByteArray(StandardCharsets.UTF_8), "HmacSHA256")
    val encoder = NimbusJwtEncoder(ImmutableSecret<SecurityContext>(secretKey))
    val now = Instant.now()
    val claims = JwtClaimsSet.builder()
      .issuer("ritomer-db-integration-test")
      .issuedAt(now)
      .expiresAt(now.plusSeconds(300))
      .subject(subject)
      .apply {
        extraClaims.forEach { (name, value) -> claim(name, value) }
      }
      .build()
    val header = JwsHeader.with(MacAlgorithm.HS256).build()

    return encoder.encode(JwtEncoderParameters.from(header, claims)).tokenValue
  }
}
