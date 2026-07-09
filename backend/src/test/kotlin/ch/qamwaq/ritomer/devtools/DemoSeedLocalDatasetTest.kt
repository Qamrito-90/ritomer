package ch.qamwaq.ritomer.devtools

import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class DemoSeedLocalDatasetTest {
  @Test
  fun `primary 036a dataset remains complete`() {
    assertThat(DemoSeedLocalDataset.tenantId)
      .isEqualTo(UUID.fromString("036a0000-0000-4000-8000-000000000001"))
    assertThat(DemoSeedLocalDataset.closingFolderId)
      .isEqualTo(UUID.fromString("036a0000-0000-4000-8000-000000000004"))
    assertThat(DemoSeedLocalDataset.balanceImportVersion).isEqualTo(1)
    assertThat(DemoSeedLocalDataset.sourceFileName).isEqualTo("demo-synthetic-balance.csv")
    assertThat(DemoSeedLocalDataset.balanceLines.map { it.accountCode })
      .containsExactly("1000", "1100", "2000", "2800", "3000", "4000")
    assertThat(DemoSeedLocalDataset.manualMappings.map { it.accountCode })
      .containsExactly("1000", "1100", "2000", "2800", "3000", "4000")
    assertThat(DemoSeedLocalDataset.manualMappings.map { it.targetCode })
      .containsExactly(
        "BS.ASSET.CASH_AND_EQUIVALENTS",
        "BS.ASSET.TRADE_RECEIVABLES",
        "BS.LIABILITY.TRADE_PAYABLES",
        "BS.EQUITY.RETAINED_EARNINGS",
        "PL.REVENUE.OPERATING_REVENUE",
        "PL.EXPENSE.OTHER_OPERATING_EXPENSES"
      )
  }

  @Test
  fun `mixed v2 variant keeps same balance but only four manual mappings`() {
    val variant = DemoSeedLocalVariant.MIXED_V2_042A2A5D.folderDataset

    assertThat(variant.closingFolderId)
      .isEqualTo(UUID.fromString("042a2a5d-0000-4000-8000-000000000004"))
    assertThat(variant.balanceImportVersion).isEqualTo(1)
    assertThat(variant.sourceFileName).isEqualTo(DemoSeedLocalDataset.sourceFileName)
    assertThat(variant.balanceLines.map { it.accountCode })
      .containsExactlyElementsOf(DemoSeedLocalDataset.balanceLines.map { it.accountCode })
    assertThat(variant.balanceLines.map { it.accountLabel })
      .containsExactlyElementsOf(DemoSeedLocalDataset.balanceLines.map { it.accountLabel })
    assertThat(variant.manualMappings.map { it.accountCode })
      .containsExactly("1000", "1100", "2000", "2800")
    assertThat(variant.manualMappings.map { it.targetCode })
      .containsExactly(
        "BS.ASSET.CASH_AND_EQUIVALENTS",
        "BS.ASSET.TRADE_RECEIVABLES",
        "BS.LIABILITY.TRADE_PAYABLES",
        "BS.EQUITY.RETAINED_EARNINGS"
      )
    assertThat(variant.manualMappings.map { it.accountCode })
      .doesNotContain("3000", "4000")
  }
}
