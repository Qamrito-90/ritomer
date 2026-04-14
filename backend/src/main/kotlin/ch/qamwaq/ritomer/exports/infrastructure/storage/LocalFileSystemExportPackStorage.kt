package ch.qamwaq.ritomer.exports.infrastructure.storage

import ch.qamwaq.ritomer.exports.application.ExportPackContent
import ch.qamwaq.ritomer.exports.application.ExportPackStorage
import ch.qamwaq.ritomer.exports.application.StoreExportPackCommand
import ch.qamwaq.ritomer.exports.application.StoredExportPackObject
import java.io.UncheckedIOException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.security.MessageDigest
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component

@Component
@ConditionalOnProperty(
  prefix = "ritomer.workpapers.documents.storage",
  name = ["backend"],
  havingValue = "LOCAL_FS",
  matchIfMissing = true
)
class LocalFileSystemExportPackStorage(
  @Value("\${ritomer.workpapers.documents.storage.local-root}")
  localRoot: String
) : ExportPackStorage {
  private val rootPath: Path = Paths.get(localRoot).toAbsolutePath().normalize()

  override fun storageBackendCode(): String = LOCAL_FS_BACKEND

  override fun store(command: StoreExportPackCommand): StoredExportPackObject {
    val targetPath = resolvePath(command.objectKey)
    val digest = MessageDigest.getInstance("SHA-256")
    var byteCount = 0L

    try {
      Files.createDirectories(targetPath.parent)
      command.inputStream.use { inputStream ->
        Files.newOutputStream(targetPath).use { outputStream ->
          val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
          while (true) {
            val read = inputStream.read(buffer)
            if (read < 0) {
              break
            }
            outputStream.write(buffer, 0, read)
            digest.update(buffer, 0, read)
            byteCount += read.toLong()
          }
        }
      }
    } catch (exception: java.io.IOException) {
      throw UncheckedIOException(exception)
    }

    return StoredExportPackObject(
      storageBackend = storageBackendCode(),
      storageObjectKey = command.objectKey,
      mediaType = command.mediaType,
      byteSize = byteCount,
      checksumSha256 = digest.digest().toHexLowercase()
    )
  }

  override fun open(objectKey: String): ExportPackContent =
    try {
      ExportPackContent(
        inputStream = Files.newInputStream(resolvePath(objectKey))
      )
    } catch (exception: java.io.IOException) {
      throw UncheckedIOException(exception)
    }

  override fun deleteIfExists(objectKey: String) {
    try {
      Files.deleteIfExists(resolvePath(objectKey))
    } catch (exception: java.io.IOException) {
      throw UncheckedIOException(exception)
    }
  }

  private fun resolvePath(objectKey: String): Path {
    val normalizedKey = objectKey.replace('/', java.io.File.separatorChar)
    val resolved = rootPath.resolve(normalizedKey).normalize()
    if (!resolved.startsWith(rootPath)) {
      error("Resolved export pack path escapes configured storage root.")
    }
    return resolved
  }

  companion object {
    private const val LOCAL_FS_BACKEND = "LOCAL_FS"
  }
}
