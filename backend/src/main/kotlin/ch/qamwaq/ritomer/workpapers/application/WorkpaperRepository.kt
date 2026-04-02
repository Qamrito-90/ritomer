package ch.qamwaq.ritomer.workpapers.application

import ch.qamwaq.ritomer.workpapers.domain.Workpaper
import java.util.UUID

interface WorkpaperRepository {
  fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): List<Workpaper>

  fun findByAnchorCode(tenantId: UUID, closingFolderId: UUID, anchorCode: String): Workpaper?

  fun create(workpaper: Workpaper): Workpaper

  fun update(workpaper: Workpaper): Workpaper
}
