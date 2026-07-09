package ch.qamwaq.ritomer.devtools

import ch.qamwaq.ritomer.RitomerBackendApplication
import org.slf4j.LoggerFactory
import org.springframework.boot.WebApplicationType
import org.springframework.boot.builder.SpringApplicationBuilder
import org.springframework.core.env.SimpleCommandLinePropertySource
import org.springframework.core.env.StandardEnvironment

private val logger = LoggerFactory.getLogger("DemoSeedLocalCommand")

fun main(args: Array<String>) {
  val guardEnvironment = StandardEnvironment().apply {
    propertySources.addFirst(SimpleCommandLinePropertySource(*args))
  }
  DemoSeedLocalActivation.from(guardEnvironment).requireEnabled()

  SpringApplicationBuilder(RitomerBackendApplication::class.java)
    .web(WebApplicationType.NONE)
    .properties(
      mapOf(
        "spring.main.web-application-type" to "none",
        "spring.main.banner-mode" to "off"
      )
    )
    .run(*args)
    .use { context ->
      val seedService = context.getBeanProvider(DemoSeedLocalService::class.java).getIfAvailable()
        ?: throw IllegalStateException(
          "Demo seed service is unavailable. Use a local or test database profile with a configured PostgreSQL datasource."
        )

      val result = seedService.seed()
      logger.info(
        "Demo seed local completed: tenantId={}, closingFolderId={}, balanceImportId={}, changedRows={}, lineCount={}, mappingCount={}, variantCount={}",
        result.tenantId,
        result.closingFolderId,
        result.balanceImportId,
        result.changedRows,
        result.balanceImportLineCount,
        result.manualMappingCount,
        result.variantResults.size
      )
    }
}
