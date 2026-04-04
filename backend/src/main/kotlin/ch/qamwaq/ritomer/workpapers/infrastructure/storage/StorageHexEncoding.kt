package ch.qamwaq.ritomer.workpapers.infrastructure.storage

internal fun ByteArray.toHexLowercase(): String =
  joinToString(separator = "") { eachByte -> "%02x".format(eachByte) }
