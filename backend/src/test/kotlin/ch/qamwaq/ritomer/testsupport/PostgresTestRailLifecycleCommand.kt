package ch.qamwaq.ritomer.testsupport

import java.util.logging.Level
import java.util.logging.LogManager
import java.util.logging.Logger

internal object PostgresTestRailJdbcLogging {
  fun disableAndVerifyForTest(): Boolean {
    val manager = LogManager.getLogManager()
    val names = linkedSetOf("org.postgresql", "org.postgresql.Driver", "org.postgresql.core")
    val registeredNames = manager.loggerNames
    while (registeredNames.hasMoreElements()) {
      val name = registeredNames.nextElement()
      if (name == "org.postgresql" || name.startsWith("org.postgresql.")) {
        names += name
      }
    }

    names.forEach { name ->
      Logger.getLogger(name).apply {
        level = Level.OFF
        useParentHandlers = false
        handlers.forEach(::removeHandler)
      }
    }

    return names.all { name ->
      Logger.getLogger(name).let { logger ->
        logger.level == Level.OFF &&
          !logger.useParentHandlers &&
          logger.handlers.isEmpty() &&
          !logger.isLoggable(Level.FINEST)
      }
    }
  }
}
