package ch.qamwaq.ritomer.exports.application

import java.io.InputStream

data class StoreExportPackCommand(
  val objectKey: String,
  val mediaType: String,
  val inputStream: InputStream
)

data class StoredExportPackObject(
  val storageBackend: String,
  val storageObjectKey: String,
  val mediaType: String,
  val byteSize: Long,
  val checksumSha256: String
)

data class ExportPackContent(
  val inputStream: InputStream
)

interface ExportPackStorage {
  fun storageBackendCode(): String

  fun store(command: StoreExportPackCommand): StoredExportPackObject

  fun open(objectKey: String): ExportPackContent

  fun deleteIfExists(objectKey: String)
}
