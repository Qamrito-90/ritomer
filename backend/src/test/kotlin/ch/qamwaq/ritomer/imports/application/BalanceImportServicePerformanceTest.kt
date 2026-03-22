package ch.qamwaq.ritomer.imports.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccess
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessView
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.imports.domain.BalanceImport
import ch.qamwaq.ritomer.imports.domain.BalanceImportLine
import ch.qamwaq.ritomer.imports.domain.BalanceImportSnapshot
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContext
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContextProvider
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import java.math.BigDecimal
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertTimeoutPreemptively
import org.springframework.mock.web.MockMultipartFile

class BalanceImportServicePerformanceTest {
  @Test
  fun `service parses validates and diffs 10k lines under five seconds`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val closingFolderId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    val repository = InMemoryPerformanceBalanceImportRepository()
    val service = BalanceImportService(
      closingFolderAccess = FixedClosingFolderAccess(tenantId, closingFolderId),
      balanceImportRepository = repository,
      balanceImportCsvParser = BalanceImportCsvParser(),
      auditTrail = NoOpAuditTrail(),
      auditCorrelationContextProvider = FixedAuditCorrelationContextProvider()
    )
    val access = TenantAccessContext(
      actorUserId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
      actorSubject = "perf-user",
      tenantId = tenantId,
      effectiveRoles = setOf("ACCOUNTANT")
    )

    assertTimeoutPreemptively(Duration.ofSeconds(5)) {
      val createdV1 = service.create(access, closingFolderId, csvFile(dataset(0)))
      val createdV2 = service.create(access, closingFolderId, csvFile(dataset(1)))

      assertThat(createdV1.balanceImport.version).isEqualTo(1)
      assertThat(createdV2.balanceImport.version).isEqualTo(2)
      assertThat(createdV2.diffSummary.previousVersion).isEqualTo(1)
    }
  }

  private fun csvFile(content: String): MockMultipartFile =
    MockMultipartFile("file", "balance.csv", "text/csv", content.toByteArray(StandardCharsets.UTF_8))

  private fun dataset(offset: Int): String {
    val builder = StringBuilder("accountCode,accountLabel,debit,credit\n")
    for (index in 1..5_000) {
      val debitAmount = BigDecimal(index + offset).toPlainString()
      builder.append("D").append(index.toString().padStart(4, '0'))
        .append(",Debit ").append(index)
        .append(",").append(debitAmount)
        .append(",0\n")
      builder.append("C").append(index.toString().padStart(4, '0'))
        .append(",Credit ").append(index)
        .append(",0,").append(debitAmount)
        .append('\n')
    }
    return builder.toString()
  }
}

private class FixedClosingFolderAccess(
  private val tenantId: UUID,
  private val closingFolderId: UUID
) : ClosingFolderAccess {
  override fun getRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView =
    ClosingFolderAccessView(this.closingFolderId, this.tenantId, ClosingFolderAccessStatus.DRAFT)

  override fun lockRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView =
    getRequired(tenantId, closingFolderId)
}

private class InMemoryPerformanceBalanceImportRepository : BalanceImportRepository {
  private val snapshots = mutableListOf<BalanceImportSnapshot>()

  override fun nextVersion(tenantId: UUID, closingFolderId: UUID): Int =
    snapshots.filter { it.import.tenantId == tenantId && it.import.closingFolderId == closingFolderId }
      .maxOfOrNull { it.import.version }
      ?.plus(1)
      ?: 1

  override fun create(balanceImport: BalanceImport, lines: List<BalanceImportLine>): BalanceImport {
    snapshots.add(BalanceImportSnapshot(balanceImport, lines))
    return balanceImport
  }

  override fun findVersions(tenantId: UUID, closingFolderId: UUID): List<BalanceImport> =
    snapshots.filter { it.import.tenantId == tenantId && it.import.closingFolderId == closingFolderId }
      .map { it.import }
      .sortedByDescending { it.version }

  override fun findSnapshotByVersion(
    tenantId: UUID,
    closingFolderId: UUID,
    version: Int
  ): BalanceImportSnapshot? =
    snapshots.firstOrNull {
      it.import.tenantId == tenantId &&
        it.import.closingFolderId == closingFolderId &&
        it.import.version == version
    }
}

private class NoOpAuditTrail : AuditTrail {
  override fun append(command: AppendAuditEventCommand): UUID = UUID.randomUUID()
}

private class FixedAuditCorrelationContextProvider : AuditCorrelationContextProvider {
  override fun currentCorrelationContext(): AuditCorrelationContext =
    AuditCorrelationContext(requestId = "perf-test")
}
