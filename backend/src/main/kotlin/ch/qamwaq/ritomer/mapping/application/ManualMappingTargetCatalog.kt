package ch.qamwaq.ritomer.mapping.application

import java.util.LinkedHashSet
import org.springframework.beans.factory.config.YamlMapFactoryBean
import org.springframework.core.io.ClassPathResource
import org.springframework.stereotype.Component

data class ManualMappingTarget(
  val code: String,
  val label: String
)

fun interface ManualMappingTargetCatalog {
  fun all(): List<ManualMappingTarget>
}

@Component
class ClasspathManualMappingTargetCatalog : ManualMappingTargetCatalog {
  private val targets = loadTargets()

  override fun all(): List<ManualMappingTarget> = targets

  private fun loadTargets(): List<ManualMappingTarget> {
    val factory = YamlMapFactoryBean()
    factory.setResources(ClassPathResource("manual-mapping-targets-v1.yaml"))
    factory.afterPropertiesSet()

    val root = factory.`object` ?: error("manual-mapping-targets-v1.yaml could not be loaded.")
    val rawTargets = root["targets"] as? List<*>
      ?: error("manual-mapping-targets-v1.yaml must define a 'targets' array.")

    val seenCodes = LinkedHashSet<String>()
    return rawTargets.mapIndexed { index, raw ->
      val entry = raw as? Map<*, *> ?: error("manual-mapping-targets-v1.yaml target at index $index must be an object.")
      val code = entry["code"]?.toString()?.trim().orEmpty()
      val label = entry["label"]?.toString()?.trim().orEmpty()

      require(code.isNotEmpty()) { "manual-mapping-targets-v1.yaml target at index $index must define a non-blank code." }
      require(label.isNotEmpty()) { "manual-mapping-targets-v1.yaml target at index $index must define a non-blank label." }
      require(seenCodes.add(code)) { "manual-mapping-targets-v1.yaml target code '$code' is duplicated." }

      ManualMappingTarget(code = code, label = label)
    }.sortedBy { it.code }
  }
}
