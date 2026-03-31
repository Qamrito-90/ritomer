package ch.qamwaq.ritomer.mapping.application

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.core.io.ByteArrayResource
import org.springframework.core.io.ClassPathResource

class ManualMappingTargetCatalogTest {
  @Test
  fun `v2 taxonomy loads with legacy compatibility and deterministic ordering`() {
    val taxonomy = ManualMappingTaxonomyLoader.load(
      resource = ClassPathResource("manual-mapping-targets-v2.yaml"),
      legacyResource = ClassPathResource("manual-mapping-targets-v1.yaml")
    )

    assertThat(taxonomy.version).isEqualTo(2)
    assertThat(taxonomy.targets.take(5).map { it.code })
      .containsExactly("BS.ASSET", "BS.EQUITY", "BS.LIABILITY", "PL.EXPENSE", "PL.REVENUE")

    val legacyAsset = taxonomy.findByCode("BS.ASSET")
    assertThat(legacyAsset?.deprecated).isTrue()
    assertThat(legacyAsset?.selectable).isTrue()
    assertThat(legacyAsset?.granularity).isEqualTo(ManualMappingTargetGranularity.LEAF)
    assertThat(legacyAsset?.summaryBucketCode).isEqualTo("BS.ASSET")

    val section = taxonomy.findByCode("BS.ASSET.CURRENT_SECTION")
    assertThat(section?.selectable).isFalse()
    assertThat(section?.granularity).isEqualTo(ManualMappingTargetGranularity.SECTION)
  }

  @Test
  fun `loader fails fast when summary bucket is unknown`() {
    val invalidTaxonomy = """
      version: 2
      targets:
        - code: BS.ASSET
          label: Asset
          statement: BALANCE_SHEET
          summaryBucketCode: BS.ASSET.UNKNOWN
          sectionCode: BS.ASSET
          normalSide: DEBIT
          granularity: LEAF
          deprecated: true
          selectable: true
          displayOrder: 10
    """.trimIndent()

    assertThatThrownBy {
      ManualMappingTaxonomyLoader.load(
        resource = byteArrayResource("invalid-summary-bucket.yaml", invalidTaxonomy),
        legacyResource = ClassPathResource("manual-mapping-targets-v1.yaml")
      )
    }.isInstanceOf(IllegalArgumentException::class.java)
      .hasMessageContaining("summaryBucketCode")
  }

  @Test
  fun `loader fails fast when selectable target is not a leaf`() {
    val invalidTaxonomy = """
      version: 2
      targets:
        - code: BS.ASSET
          label: Asset
          statement: BALANCE_SHEET
          summaryBucketCode: BS.ASSET
          sectionCode: BS.ASSET
          normalSide: DEBIT
          granularity: LEAF
          deprecated: true
          selectable: true
          displayOrder: 10
        - code: BS.ASSET.CURRENT_SECTION
          label: Current assets
          statement: BALANCE_SHEET
          summaryBucketCode: BS.ASSET
          sectionCode: BS.ASSET.CURRENT_SECTION
          normalSide: DEBIT
          granularity: SECTION
          deprecated: false
          selectable: true
          displayOrder: 20
    """.trimIndent()

    assertThatThrownBy {
      ManualMappingTaxonomyLoader.load(
        resource = byteArrayResource("invalid-selectable-section.yaml", invalidTaxonomy),
        legacyResource = byteArrayResource(
          "manual-mapping-targets-v1.yaml",
          """
          version: 1
          targets:
            - code: BS.ASSET
              label: Asset
          """.trimIndent()
        )
      )
    }.isInstanceOf(IllegalArgumentException::class.java)
      .hasMessageContaining("selectable")
  }

  private fun byteArrayResource(name: String, content: String) =
    object : ByteArrayResource(content.toByteArray()) {
      override fun getFilename(): String = name
    }
}
