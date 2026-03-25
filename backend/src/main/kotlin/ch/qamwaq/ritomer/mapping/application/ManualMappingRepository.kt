package ch.qamwaq.ritomer.mapping.application

import ch.qamwaq.ritomer.mapping.domain.ManualMapping
import java.util.UUID

interface ManualMappingRepository {
  fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): List<ManualMapping>

  fun findByAccountCode(tenantId: UUID, closingFolderId: UUID, accountCode: String): ManualMapping?

  fun create(mapping: ManualMapping): ManualMapping

  fun update(mapping: ManualMapping): ManualMapping

  fun delete(tenantId: UUID, mappingId: UUID)
}
