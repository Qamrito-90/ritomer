package ch.qamwaq.ritomer.devtools

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.mock.env.MockEnvironment

class DemoSeedLocalActivationTest {
  @Test
  fun `seed is disabled by default`() {
    val activation = activation("local")

    assertThat(activation.enabled).isFalse()
    assertThat(activation.seedVariant).isNull()
  }

  @Test
  fun `seed refuses to run when explicit property is absent`() {
    val activation = activation("local")

    assertThatThrownBy { activation.requireEnabled() }
      .isInstanceOf(IllegalStateException::class.java)
      .hasMessageContaining("$DEMO_SEED_ENABLED_PROPERTY=true")
  }

  @Test
  fun `seed refuses to run when explicit property is false`() {
    val activation = activation("local", enabled = "false")

    assertThat(activation.enabled).isFalse()
    assertThatThrownBy { activation.requireEnabled() }
      .isInstanceOf(IllegalStateException::class.java)
      .hasMessageContaining("must be explicitly set to true")
  }

  @Test
  fun `seed refuses explicit local activation without visible datasource`() {
    assertThatThrownBy { activation("local", enabled = "true").requireEnabled() }
      .isInstanceOf(IllegalStateException::class.java)
      .hasMessageContaining("local PostgreSQL target")
      .hasMessageNotContaining("jdbc:")
  }

  @Test
  fun `seed accepts explicit activation with spring datasource localhost`() {
    activation("local", enabled = "true", datasourceUrl = "jdbc:postgresql://localhost:5432/ritomer").requireEnabled()
  }

  @Test
  fun `seed accepts the explicit mixed v2 variant`() {
    val activation = activation(
      "local",
      enabled = "true",
      datasourceUrl = "jdbc:postgresql://localhost:5432/ritomer",
      properties = mapOf(DEMO_SEED_VARIANT_PROPERTY to DEMO_SEED_VARIANT_042A2A5D_MIXED_V2)
    )

    activation.requireEnabled()

    assertThat(activation.seedVariant).isEqualTo(DemoSeedLocalVariant.MIXED_V2_042A2A5D)
  }

  @Test
  fun `seed accepts the explicit 043b two actor pilot variant`() {
    val activation = activation(
      "local",
      enabled = "true",
      datasourceUrl = "jdbc:postgresql://127.0.0.1:5432/ritomer",
      properties = mapOf(DEMO_SEED_VARIANT_PROPERTY to DEMO_SEED_VARIANT_043B_TWO_ACTOR_PILOT)
    )

    activation.requireEnabled()

    assertThat(activation.seedVariant).isEqualTo(DemoSeedLocalVariant.TWO_ACTOR_PILOT_043B)
  }

  @Test
  fun `seed rejects unsupported variants`() {
    val activation = activation(
      "local",
      enabled = "true",
      datasourceUrl = "jdbc:postgresql://localhost:5432/ritomer",
      properties = mapOf(DEMO_SEED_VARIANT_PROPERTY to "unsupported-local-demo")
    )

    assertThatThrownBy { activation.requireEnabled() }
      .isInstanceOf(IllegalArgumentException::class.java)
      .hasMessageContaining(DEMO_SEED_VARIANT_PROPERTY)
      .hasMessageContaining(DEMO_SEED_VARIANT_042A2A5D_MIXED_V2)
      .hasMessageContaining(DEMO_SEED_VARIANT_043B_TWO_ACTOR_PILOT)
  }

  @Test
  fun `seed accepts explicit activation with spring datasource environment variable`() {
    activation(
      "local",
      enabled = "true",
      properties = mapOf("SPRING_DATASOURCE_URL" to "jdbc:postgresql://localhost:5432/ritomer")
    ).requireEnabled()
  }

  @Test
  fun `seed accepts explicit activation on dbtest profile`() {
    activation("dbtest", enabled = "true", datasourceUrl = "jdbc:postgresql://localhost:5432/ritomer").requireEnabled()
  }

  @Test
  fun `seed accepts explicit dbtest datasource property before Spring context starts`() {
    listOf(
      "jdbc:postgresql://localhost:5432/ritomer",
      "jdbc:postgresql://127.0.0.1:5432/ritomer"
    ).forEach { datasourceUrl ->
      activation(
        "dbtest",
        enabled = "true",
        properties = mapOf("RITOMER_DB_TEST_JDBC_URL" to datasourceUrl)
      ).requireEnabled()
    }
  }

  @Test
  fun `seed refuses explicit activation when Cloud Run runtime marker is present`() {
    val activation = activation(
      "local",
      enabled = "true",
      datasourceUrl = "jdbc:postgresql://localhost:5432/ritomer",
      properties = mapOf("K_SERVICE" to "ritomer-backend")
    )

    assertThatThrownBy { activation.requireEnabled() }
      .isInstanceOf(IllegalStateException::class.java)
      .hasMessageContaining("Cloud Run")
      .hasMessageContaining("K_SERVICE")
  }

  @Test
  fun `seed refuses explicit activation when production runtime marker is present`() {
    val activation = activation(
      "local",
      enabled = "true",
      datasourceUrl = "jdbc:postgresql://localhost:5432/ritomer",
      properties = mapOf("RITOMER_ENVIRONMENT" to "production")
    )

    assertThatThrownBy { activation.requireEnabled() }
      .isInstanceOf(IllegalStateException::class.java)
      .hasMessageContaining("production-like")
      .hasMessageContaining("RITOMER_ENVIRONMENT")
  }

  @Test
  fun `seed refuses explicit activation on prod profile`() {
    val activation = activation("prod", enabled = "true")

    assertThatThrownBy { activation.requireEnabled() }
      .isInstanceOf(IllegalStateException::class.java)
      .hasMessageContaining("local, test or dbtest profiles")
  }

  @Test
  fun `seed refuses explicit activation on mixed local and prod profiles`() {
    val activation = activation("local", "prod", enabled = "true")

    assertThatThrownBy { activation.requireEnabled() }
      .isInstanceOf(IllegalStateException::class.java)
      .hasMessageContaining("unsupported active profiles")
      .hasMessageContaining("prod")
  }

  @Test
  fun `seed refuses explicit activation on mixed dbtest and prod profiles`() {
    val activation = activation("dbtest", "prod", enabled = "true")

    assertThatThrownBy { activation.requireEnabled() }
      .isInstanceOf(IllegalStateException::class.java)
      .hasMessageContaining("unsupported active profiles")
      .hasMessageContaining("prod")
  }

  @Test
  fun `seed accepts explicit activation with local datasource targets`() {
    listOf(
      "jdbc:postgresql://localhost:5432/ritomer",
      "jdbc:postgresql://127.0.0.1:5432/ritomer",
      "jdbc:postgresql://[::1]:5432/ritomer"
    ).forEach { datasourceUrl ->
      activation("local", enabled = "true", datasourceUrl = datasourceUrl).requireEnabled()
    }
  }

  @Test
  fun `seed refuses explicit activation with non local or prod like datasource targets`() {
    listOf(
      "jdbc:postgresql://10.0.0.8:5432/ritomer",
      "jdbc:postgresql://db.internal:5432/ritomer",
      "jdbc:postgresql://localhost:5432/ritomer-prod",
      "jdbc:postgresql://google/ritomer?cloudSqlInstance=project:europe-west6:ritomer",
      "jdbc:postgresql://user:password@localhost:5432/ritomer",
      "jdbc:mysql://localhost:3306/ritomer",
      "jdbc:postgresql:ritomer"
    ).forEach { datasourceUrl ->
      assertThatThrownBy { activation("local", enabled = "true", datasourceUrl = datasourceUrl).requireEnabled() }
        .isInstanceOf(IllegalStateException::class.java)
        .hasMessageContaining("local PostgreSQL target")
        .hasMessageNotContaining(datasourceUrl)
    }
  }

  private fun activation(
    vararg profiles: String,
    enabled: String? = null,
    datasourceUrl: String? = null,
    properties: Map<String, String> = emptyMap()
  ): DemoSeedLocalActivation {
    val environment = MockEnvironment().apply {
      setActiveProfiles(*profiles)
      enabled?.let { withProperty(DEMO_SEED_ENABLED_PROPERTY, it) }
      datasourceUrl?.let { withProperty("spring.datasource.url", it) }
      properties.forEach { (key, value) -> withProperty(key, value) }
    }
    return DemoSeedLocalActivation.from(environment)
  }
}
