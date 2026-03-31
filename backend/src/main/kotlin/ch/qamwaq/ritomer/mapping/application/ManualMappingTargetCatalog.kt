package ch.qamwaq.ritomer.mapping.application

import java.util.LinkedHashSet
import org.springframework.beans.factory.config.YamlMapFactoryBean
import org.springframework.core.io.ClassPathResource
import org.springframework.core.io.Resource
import org.springframework.stereotype.Component

enum class ManualMappingStatement {
  BALANCE_SHEET,
  INCOME_STATEMENT
}

enum class ManualMappingNormalSide {
  DEBIT,
  CREDIT
}

enum class ManualMappingTargetGranularity {
  LEAF,
  SECTION
}

data class ManualMappingTarget(
  val code: String,
  val label: String,
  val statement: ManualMappingStatement,
  val summaryBucketCode: String,
  val sectionCode: String,
  val normalSide: ManualMappingNormalSide,
  val granularity: ManualMappingTargetGranularity,
  val deprecated: Boolean,
  val selectable: Boolean,
  val displayOrder: Int
)

data class ManualMappingTaxonomy(
  val version: Int,
  val targets: List<ManualMappingTarget>
) {
  private val targetsByCode = targets.associateBy { it.code }

  fun findByCode(code: String): ManualMappingTarget? = targetsByCode[code]
}

interface ManualMappingTargetCatalog {
  fun taxonomyVersion(): Int

  fun all(): List<ManualMappingTarget>

  fun findByCode(code: String): ManualMappingTarget?
}

@Component
class ClasspathManualMappingTargetCatalog : ManualMappingTargetCatalog {
  private val taxonomy = ManualMappingTaxonomyLoader.load(
    resource = ClassPathResource(TAXONOMY_RESOURCE),
    legacyResource = ClassPathResource(LEGACY_RESOURCE)
  )

  override fun taxonomyVersion(): Int = taxonomy.version

  override fun all(): List<ManualMappingTarget> = taxonomy.targets

  override fun findByCode(code: String): ManualMappingTarget? = taxonomy.findByCode(code)

  companion object {
    private const val TAXONOMY_RESOURCE = "manual-mapping-targets-v2.yaml"
    private const val LEGACY_RESOURCE = "manual-mapping-targets-v1.yaml"
  }
}

internal object ManualMappingTaxonomyLoader {
  fun load(
    resource: Resource,
    legacyResource: Resource
  ): ManualMappingTaxonomy {
    val root = loadRoot(resource)
    val version = readRequiredInt(root, "version", resourceDescription(resource))
    val targets = loadTargets(root, resource)
    val sortedTargets = validateAndSortTargets(targets, resource)
    validateLegacyCompatibility(sortedTargets, legacyResource)
    return ManualMappingTaxonomy(version = version, targets = sortedTargets)
  }

  private fun loadTargets(
    root: Map<*, *>,
    resource: Resource
  ): List<ManualMappingTarget> {
    val context = resourceDescription(resource)
    val rawTargets = root["targets"] as? List<*>
      ?: error("$context must define a 'targets' array.")

    return rawTargets.mapIndexed { index, raw ->
      val entry = raw as? Map<*, *> ?: error("$context target at index $index must be an object.")
      ManualMappingTarget(
        code = readRequiredString(entry, "code", "$context target[$index]"),
        label = readRequiredString(entry, "label", "$context target[$index]"),
        statement = readRequiredEnum(entry, "statement", "$context target[$index]"),
        summaryBucketCode = readRequiredString(entry, "summaryBucketCode", "$context target[$index]"),
        sectionCode = readRequiredString(entry, "sectionCode", "$context target[$index]"),
        normalSide = readRequiredEnum(entry, "normalSide", "$context target[$index]"),
        granularity = readRequiredEnum(entry, "granularity", "$context target[$index]"),
        deprecated = readRequiredBoolean(entry, "deprecated", "$context target[$index]"),
        selectable = readRequiredBoolean(entry, "selectable", "$context target[$index]"),
        displayOrder = readRequiredInt(entry, "displayOrder", "$context target[$index]")
      )
    }
  }

  private fun validateAndSortTargets(
    targets: List<ManualMappingTarget>,
    resource: Resource
  ): List<ManualMappingTarget> {
    require(targets.isNotEmpty()) { "${resourceDescription(resource)} must define at least one target." }

    val seenCodes = LinkedHashSet<String>()
    targets.forEach {
      require(seenCodes.add(it.code)) { "${resourceDescription(resource)} target code '${it.code}' is duplicated." }
      require(it.displayOrder >= 0) { "${resourceDescription(resource)} target code '${it.code}' must define a non-negative displayOrder." }
      require(!it.selectable || it.granularity == ManualMappingTargetGranularity.LEAF) {
        "${resourceDescription(resource)} target code '${it.code}' cannot be selectable unless its granularity is LEAF."
      }
    }

    val codes = targets.asSequence().map { it.code }.toSet()
    targets.forEach {
      require(it.summaryBucketCode in codes) {
        "${resourceDescription(resource)} target code '${it.code}' references unknown summaryBucketCode '${it.summaryBucketCode}'."
      }
      require(it.sectionCode in codes) {
        "${resourceDescription(resource)} target code '${it.code}' references unknown sectionCode '${it.sectionCode}'."
      }
    }

    return targets.sortedWith(compareBy<ManualMappingTarget> { it.displayOrder }.thenBy { it.code })
  }

  private fun validateLegacyCompatibility(
    targets: List<ManualMappingTarget>,
    legacyResource: Resource
  ) {
    val targetsByCode = targets.associateBy { it.code }
    loadLegacyTargets(legacyResource).forEach { legacy ->
      val current = targetsByCode[legacy.code]
        ?: error("${resourceDescription(legacyResource)} code '${legacy.code}' must remain published in manual-mapping-targets-v2.yaml.")

      require(current.label == legacy.label) {
        "${resourceDescription(legacyResource)} code '${legacy.code}' must keep its published label '${legacy.label}'."
      }
      require(current.deprecated) {
        "${resourceDescription(legacyResource)} code '${legacy.code}' must be marked deprecated in manual-mapping-targets-v2.yaml."
      }
      require(current.selectable) {
        "${resourceDescription(legacyResource)} code '${legacy.code}' must remain selectable for V1 compatibility."
      }
      require(current.granularity == ManualMappingTargetGranularity.LEAF) {
        "${resourceDescription(legacyResource)} code '${legacy.code}' must remain a leaf target for V1 compatibility."
      }
      require(current.summaryBucketCode == legacy.code) {
        "${resourceDescription(legacyResource)} code '${legacy.code}' must keep summaryBucketCode '${legacy.code}'."
      }
      require(current.sectionCode == legacy.code) {
        "${resourceDescription(legacyResource)} code '${legacy.code}' must keep sectionCode '${legacy.code}'."
      }
    }
  }

  private fun loadLegacyTargets(resource: Resource): List<LegacyManualMappingTarget> {
    val root = loadRoot(resource)
    val rawTargets = root["targets"] as? List<*>
      ?: error("${resourceDescription(resource)} must define a 'targets' array.")

    return rawTargets.mapIndexed { index, raw ->
      val entry = raw as? Map<*, *> ?: error("${resourceDescription(resource)} target at index $index must be an object.")
      LegacyManualMappingTarget(
        code = readRequiredString(entry, "code", "${resourceDescription(resource)} target[$index]"),
        label = readRequiredString(entry, "label", "${resourceDescription(resource)} target[$index]")
      )
    }
  }

  private fun loadRoot(resource: Resource): Map<*, *> {
    val factory = YamlMapFactoryBean()
    factory.setResources(resource)
    factory.afterPropertiesSet()
    return factory.`object` ?: error("${resourceDescription(resource)} could not be loaded.")
  }

  private fun readRequiredString(
    entry: Map<*, *>,
    key: String,
    context: String
  ): String =
    entry[key]?.toString()?.trim()?.takeUnless { it.isEmpty() }
      ?: error("$context must define a non-blank '$key'.")

  private inline fun <reified T : Enum<T>> readRequiredEnum(
    entry: Map<*, *>,
    key: String,
    context: String
  ): T {
    val rawValue = readRequiredString(entry, key, context)
    return try {
      enumValueOf<T>(rawValue)
    } catch (_: IllegalArgumentException) {
      error("$context has unsupported '$key' value '$rawValue'.")
    }
  }

  private fun readRequiredBoolean(
    entry: Map<*, *>,
    key: String,
    context: String
  ): Boolean {
    val rawValue = entry[key] ?: error("$context must define '$key'.")
    return when (rawValue) {
      is Boolean -> rawValue
      else -> rawValue.toString().trim().toBooleanStrictOrNull()
        ?: error("$context has unsupported '$key' value '$rawValue'.")
    }
  }

  private fun readRequiredInt(
    entry: Map<*, *>,
    key: String,
    context: String
  ): Int {
    val rawValue = entry[key] ?: error("$context must define '$key'.")
    return when (rawValue) {
      is Number -> rawValue.toInt()
      else -> rawValue.toString().trim().toIntOrNull()
        ?: error("$context has unsupported '$key' value '$rawValue'.")
    }
  }

  private fun resourceDescription(resource: Resource): String =
    resource.filename ?: resource.description

  private data class LegacyManualMappingTarget(
    val code: String,
    val label: String
  )
}
