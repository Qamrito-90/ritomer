package ch.qamwaq.ritomer

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.modulith.Modulith

@Modulith
@SpringBootApplication
class RitomerBackendApplication

fun main(args: Array<String>) {
  runApplication<RitomerBackendApplication>(*args)
}
