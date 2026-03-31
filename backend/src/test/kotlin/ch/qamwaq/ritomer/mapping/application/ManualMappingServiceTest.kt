package ch.qamwaq.ritomer.mapping.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccess
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessView
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.mapping.access.CurrentManualMappingProjection
import ch.qamwaq.ritomer.mapping.access.ManualMappingAccess
import ch.qamwaq.ritomer.mapping.access.ProjectedManualMappingEntry
import ch.qamwaq.ritomer.mapping.access.ProjectedManualMappingLine
import ch.qamwaq.ritomer.mapping.access.ProjectedManualMappingSummary
import ch.qamwaq.ritomer.mapping.domain.ManualMapping
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContext
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContextProvider
import ch.qamwaq.ritomer.shared.application.AuditTrail
import java.math.BigDecimal
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class ManualMappingServiceTest {
  @Test
  fun `upsert rejects unknown target code`() {
    val repository = InMemoryManualMappingRepository()
    val service = service(repository)

    assertThatThrownBy {
      service.upsert(access(), UUID.randomUUID(), ManualMappingUpsertCommand("1000", "UNKNOWN"))
    }.isInstanceOf(ManualMappingBadRequestException::class.java)
      .hasMessageContaining("targetCode is unknown")
  }

  @Test
  fun `upsert rejects non selectable target code`() {
    val repository = InMemoryManualMappingRepository()
    val service = service(repository)

    assertThatThrownBy {
      service.upsert(access(), UUID.randomUUID(), ManualMappingUpsertCommand("1000", "BS.ASSET.CURRENT_SECTION"))
    }.isInstanceOf(ManualMappingBadRequestException::class.java)
      .hasMessageContaining("targetCode is not selectable")
  }

  @Test
  fun `upsert accepts both legacy v1 and detailed v2 target codes`() {
    val repository = InMemoryManualMappingRepository()
    val closingFolderId = UUID.randomUUID()
    val service = service(repository, closingFolderId)

    val created = service.upsert(access(), closingFolderId, ManualMappingUpsertCommand("1000", "BS.ASSET"))
    val updated = service.upsert(access(), closingFolderId, ManualMappingUpsertCommand("1000", "BS.ASSET.CASH_AND_EQUIVALENTS"))

    assertThat(created.mapping.targetCode).isEqualTo("BS.ASSET")
    assertThat(updated.mapping.targetCode).isEqualTo("BS.ASSET.CASH_AND_EQUIVALENTS")
    assertThat(repository.findByClosingFolder(TENANT_ID, closingFolderId).single().targetCode)
      .isEqualTo("BS.ASSET.CASH_AND_EQUIVALENTS")
  }

  private fun service(
    repository: ManualMappingRepository,
    closingFolderId: UUID = UUID.randomUUID()
  ) = ManualMappingService(
    closingFolderAccess = object : ClosingFolderAccess {
      override fun getRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView =
        ClosingFolderAccessView(closingFolderId, tenantId, ClosingFolderAccessStatus.DRAFT)

      override fun lockRequired(tenantId: UUID, closingFolderId: UUID): ClosingFolderAccessView =
        ClosingFolderAccessView(closingFolderId, tenantId, ClosingFolderAccessStatus.DRAFT)
    },
    manualMappingAccess = ManualMappingAccess { _, requestedClosingFolderId ->
      CurrentManualMappingProjection(
        closingFolderId = requestedClosingFolderId,
        latestImportVersion = 1,
        lines = listOf(ProjectedManualMappingLine(1, "1000", "Cash", BigDecimal("100.00"), BigDecimal.ZERO)),
        mappings = repository.findByClosingFolder(TENANT_ID, requestedClosingFolderId).map {
          ProjectedManualMappingEntry(
            accountCode = it.accountCode,
            targetCode = it.targetCode,
            summaryBucketCode = if (it.targetCode.startsWith("BS.ASSET")) "BS.ASSET" else "PL.REVENUE"
          )
        },
        summary = ProjectedManualMappingSummary(total = 1, mapped = repository.findByClosingFolder(TENANT_ID, requestedClosingFolderId).size, unmapped = 0)
      )
    },
    manualMappingRepository = repository,
    manualMappingTargetCatalog = ClasspathManualMappingTargetCatalog(),
    auditTrail = object : AuditTrail {
      override fun append(command: AppendAuditEventCommand): UUID = UUID.randomUUID()
    },
    auditCorrelationContextProvider = AuditCorrelationContextProvider {
      AuditCorrelationContext(requestId = "req-1")
    }
  )

  private fun access() = TenantAccessContext(
    actorUserId = UUID.randomUUID(),
    actorSubject = "mapping-user",
    tenantId = TENANT_ID,
    effectiveRoles = setOf("ACCOUNTANT")
  )

  private class InMemoryManualMappingRepository : ManualMappingRepository {
    private val mappingsById = linkedMapOf<UUID, ManualMapping>()

    override fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): List<ManualMapping> =
      mappingsById.values.filter { it.tenantId == tenantId && it.closingFolderId == closingFolderId }.sortedBy { it.accountCode }

    override fun findByAccountCode(tenantId: UUID, closingFolderId: UUID, accountCode: String): ManualMapping? =
      mappingsById.values.firstOrNull {
        it.tenantId == tenantId &&
          it.closingFolderId == closingFolderId &&
          it.accountCode == accountCode
      }

    override fun create(mapping: ManualMapping): ManualMapping {
      mappingsById[mapping.id] = mapping
      return mapping
    }

    override fun update(mapping: ManualMapping): ManualMapping {
      mappingsById[mapping.id] = mapping
      return mapping
    }

    override fun delete(tenantId: UUID, mappingId: UUID) {
      mappingsById.remove(mappingId)
    }
  }

  companion object {
    private val TENANT_ID: UUID = UUID.fromString("11111111-1111-1111-1111-111111111111")
  }
}
