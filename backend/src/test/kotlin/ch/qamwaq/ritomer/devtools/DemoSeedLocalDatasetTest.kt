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
    assertThat(DemoSeedLocalDataset.userId)
      .isEqualTo(UUID.fromString("036a0000-0000-4000-8000-000000000002"))
    assertThat(DemoSeedLocalDataset.membershipId)
      .isEqualTo(UUID.fromString("036a0000-0000-4000-8000-000000000003"))
    assertThat(DemoSeedLocalDataset.userExternalSubject).isEqualTo("ritomer-demo-user-036a")
    assertThat(DemoSeedLocalDataset.membershipRole).isEqualTo("ACCOUNTANT")
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
    val variantDefinition = DemoSeedLocalVariant.MIXED_V2_042A2A5D
    val variant = variantDefinition.folderDataset

    assertThat(variantDefinition.propertyValue).isEqualTo("042a2a5d-mixed-v2")
    assertThat(variantDefinition.additionalActors).isEmpty()
    assertThat(variantDefinition.datasetClassification).isNull()
    assertThat(variantDefinition.enforceExactActiveRoles).isFalse()
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

  @Test
  fun `043b two actor pilot variant is exact additive harness dataset`() {
    val variantDefinition = DemoSeedLocalVariant.TWO_ACTOR_PILOT_043B
    val variant = variantDefinition.folderDataset

    assertThat(variantDefinition.propertyValue).isEqualTo("043b-two-actor-pilot")
    assertThat(variantDefinition.datasetClassification).isEqualTo("HARNESS_ONLY_AUTH_RBAC_DATASET")
    assertThat(variantDefinition.additionalActors).containsExactly(DemoSeedLocalDataset.reviewer043bActor)
    assertThat(variantDefinition.enforceExactActiveRoles).isTrue()

    assertThat(DemoSeedLocalDataset.reviewerUserId)
      .isEqualTo(UUID.fromString("043b0000-0000-4000-8000-000000000002"))
    assertThat(DemoSeedLocalDataset.reviewerMembershipId)
      .isEqualTo(UUID.fromString("043b0000-0000-4000-8000-000000000003"))
    assertThat(DemoSeedLocalDataset.reviewerExternalSubject).isEqualTo("ritomer-demo-reviewer-043b")
    assertThat(DemoSeedLocalDataset.reviewerEmail).isEqualTo("demo.reviewer.043b@example.invalid")
    assertThat(DemoSeedLocalDataset.reviewerDisplayName).isEqualTo("Demo Reviewer 043b")
    assertThat(DemoSeedLocalDataset.reviewerMembershipRole).isEqualTo("REVIEWER")

    assertThat(variant.closingFolderId)
      .isEqualTo(UUID.fromString("043b0000-0000-4000-8000-000000000004"))
    assertThat(variant.balanceImportId)
      .isEqualTo(UUID.fromString("043b0000-0000-4000-8000-000000000005"))
    assertThat(variant.balanceImportVersion).isEqualTo(1)
    assertThat(variant.sourceFileName).isEqualTo(DemoSeedLocalDataset.sourceFileName)
    assertThat(variant.balanceLines.map { it.id }).containsExactly(
      UUID.fromString("043b0000-0000-4000-8000-000000000101"),
      UUID.fromString("043b0000-0000-4000-8000-000000000102"),
      UUID.fromString("043b0000-0000-4000-8000-000000000103"),
      UUID.fromString("043b0000-0000-4000-8000-000000000104"),
      UUID.fromString("043b0000-0000-4000-8000-000000000105"),
      UUID.fromString("043b0000-0000-4000-8000-000000000106")
    )
    assertThat(variant.manualMappings.map { it.id }).containsExactly(
      UUID.fromString("043b0000-0000-4000-8000-000000000201"),
      UUID.fromString("043b0000-0000-4000-8000-000000000202"),
      UUID.fromString("043b0000-0000-4000-8000-000000000203"),
      UUID.fromString("043b0000-0000-4000-8000-000000000204"),
      UUID.fromString("043b0000-0000-4000-8000-000000000205"),
      UUID.fromString("043b0000-0000-4000-8000-000000000206")
    )
    assertThat(variant.balanceLines.map { it.copy(id = UUID.fromString("00000000-0000-4000-8000-000000000000")) })
      .containsExactlyElementsOf(
        DemoSeedLocalDataset.primaryFolder.balanceLines.map {
          it.copy(id = UUID.fromString("00000000-0000-4000-8000-000000000000"))
        }
      )
    assertThat(variant.manualMappings.map { it.copy(id = UUID.fromString("00000000-0000-4000-8000-000000000000")) })
      .containsExactlyElementsOf(
        DemoSeedLocalDataset.primaryFolder.manualMappings.map {
          it.copy(id = UUID.fromString("00000000-0000-4000-8000-000000000000"))
        }
      )
    assertThat(variant.totalDebit).isEqualByComparingTo(variant.totalCredit)
  }
}
