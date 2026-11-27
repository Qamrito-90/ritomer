package ch.qamwaq.ritomer.identity.api

import ch.qamwaq.ritomer.IdentityTestStore
import ch.qamwaq.ritomer.identity.application.OidcIdentityBinding
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.shared.infrastructure.security.ManualOidcObservationFilter
import ch.qamwaq.ritomer.shared.infrastructure.security.SharedQualificationFilter
import ch.qamwaq.ritomer.shared.infrastructure.security.SharedSessionSecurityConfiguration
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.Filter
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.DispatcherType
import jakarta.servlet.SessionTrackingMode
import java.net.URI
import java.nio.file.Files
import java.nio.file.Path
import java.time.Instant
import java.util.EnumSet
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.TimeUnit
import org.apache.catalina.startup.Tomcat
import org.apache.tomcat.util.net.SSLHostConfig
import org.apache.tomcat.util.net.SSLHostConfigCertificate
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.junit.jupiter.api.io.TempDir
import org.springframework.boot.convert.ApplicationConversionService
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.core.env.MapPropertySource
import org.springframework.session.web.http.CookieHttpSessionIdResolver
import org.springframework.session.web.http.SessionRepositoryFilter
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext
import org.springframework.web.filter.DelegatingFilterProxy
import org.springframework.web.servlet.DispatcherServlet
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@TestConfiguration(proxyBeanMethods = false)
class BrowserTestAssets : WebMvcConfigurer {
  override fun addResourceHandlers(registry: ResourceHandlerRegistry) {
    registry.addResourceHandler("/assets/**").addResourceLocations(Path.of("../frontend/dist/assets").toRealPath().toUri().toString())
  }
}

@EnabledIfEnvironmentVariable(named = "RITOMER_M12_BROWSER_TEST", matches = "true")
class SharedOidcBrowserTest {
  @TempDir lateinit var temporary: Path

  @Test fun `browser-owned sessions traverse shared OIDC and emit observable requests`() = runScenario(false)
  @Test fun `interruption after revocation closes the client and bindings without publishing success`() = runScenario(true)

  @Test fun normalBrowserCampaign() = runScenario(false, ordinary = true)
  @Test fun normalBrowserCampaignInterrupted() = runScenario(true, ordinary = true)

  private fun runScenario(interruptAfterRevoke: Boolean, ordinary: Boolean = false) {
    val frontend = Path.of("../frontend").toRealPath()
    val json = ObjectMapper()
    val playwright = json.readTree(frontend.resolve("node_modules/@playwright/test/package.json").toFile()).path("version").asText()
    check(playwright == json.readTree(frontend.resolve("package.json").toFile()).at("/devDependencies/@playwright~1test").asText())
    val core = frontend.resolve("node_modules/.pnpm/playwright-core@$playwright/node_modules/playwright-core")
    val spec = json.readTree(core.resolve("browsers.json").toFile()).path("browsers").single { it.path("name").asText() == "chromium-headless-shell" }
    val runtime = if (ordinary) json.readTree(Path.of(System.getenv("RITOMER_M12_BROWSER_UI_CONFIG")).toFile()).let { it["browser_transport"] ?: it } else null
    val browserExe = Path.of(runtime?.at("/chromium/path")?.asText() ?: System.getenv("RITOMER_M12_CHROMIUM")).toRealPath()
    val revision = if (ordinary) browserExe.parent.parent.fileName.toString().removePrefix("chromium-") else spec.path("revision").asText()
    val version = runtime?.get("chromium_version")?.asText() ?: spec.path("browserVersion").asText()
    if (runtime != null) {
      val digest = java.security.MessageDigest.getInstance("SHA-256")
      java.security.DigestInputStream(Files.newInputStream(browserExe), digest).use { it.transferTo(java.io.OutputStream.nullOutputStream()) }
      check(runtime.path("schema").asText() == "M12_BROWSER_UI_STANDARD_V1" &&
          java.util.HexFormat.of().formatHex(digest.digest()) == runtime.at("/chromium/sha256").asText() &&
          browserExe == Path.of(System.getenv("ProgramFiles"), "Google/Chrome/Application/chrome.exe").toRealPath()) { "VISIBLE_FIXTURE_BROWSER_PIN_MISMATCH" }
    } else check(version.isNotBlank() && browserExe.parent.parent.fileName.toString() == "chromium_headless_shell-$revision" &&
        browserExe.fileName.toString() == "chrome-headless-shell.exe") { "FIXTURE_BROWSER_PIN_MISMATCH" }
    val resultRoot = Path.of(System.getenv("RITOMER_M12_BROWSER_RESULT")).toRealPath()
    val evidence = resultRoot.resolve(if (ordinary) (if (interruptAfterRevoke) "browser-ui-interrupted.json" else "browser-ui.json") else if (interruptAfterRevoke) "unexpected-interrupted-observations.json" else "local-browser-observations.json")
    check(!Files.exists(evidence))
    val storeFile = temporary.resolve("local.p12")
    val pass = UUID.randomUUID().toString()
    val cert = ProcessBuilder(Path.of(System.getProperty("java.home"), "bin", "keytool.exe").toString(),
      "-genkeypair", "-alias", "localhost", "-keyalg", "RSA", "-keysize", "2048", "-validity", "1",
      "-dname", "CN=localhost", "-ext", "SAN=dns:localhost", "-storetype", "PKCS12", "-keystore", storeFile.toString(),
      "-storepass:env", "LOCAL_STORE_PASS").apply { environment()["LOCAL_STORE_PASS"] = pass }
      .redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(ProcessBuilder.Redirect.DISCARD).start()
    try { check(cert.waitFor(20, TimeUnit.SECONDS) && cert.exitValue() == 0) { "TEST_CERTIFICATE_UNAVAILABLE" } }
    finally { if (cert.isAlive) cert.destroyForcibly().waitFor() }

    val server = Tomcat()
    server.setBaseDir(temporary.resolve("tomcat").toString())
    val connector = server.connector
    connector.setProperty("address", "127.0.0.1")
    connector.port = 0
    connector.scheme = "https"
    connector.secure = true
    connector.setProperty("SSLEnabled", "true")
    val ssl = SSLHostConfig()
    ssl.addCertificate(SSLHostConfigCertificate(ssl, SSLHostConfigCertificate.Type.RSA).apply {
      certificateKeystoreFile = storeFile.toString(); certificateKeystoreType = "PKCS12"; certificateKeystorePassword = pass
    })
    connector.addSslHostConfig(ssl)
    val root = server.addContext("", Files.createDirectory(temporary.resolve("web")).toString())
    val web = AnnotationConfigWebApplicationContext()
    val events = ConcurrentLinkedQueue<Map<String, Any>>()
    val loginEvents = ConcurrentLinkedQueue<Map<String, Any>>()
    val browserWindows = java.util.concurrent.atomic.AtomicReference<Pair<String, Instant>?>()
    val presented = java.util.concurrent.ConcurrentHashMap<String, Int>()
    try {
      server.init()
      val origin = "https://localhost:${connector.localPort}"
      val dispatcher = DispatcherServlet(web)
      root.addServletContainerInitializer({ _, sc ->
        sc.setSessionTrackingModes(setOf(SessionTrackingMode.COOKIE))
        web.servletContext = sc
        web.environment.setActiveProfiles("shared-internal")
        web.environment.conversionService = ApplicationConversionService()
        web.environment.propertySources.addFirst(MapPropertySource("owned-browser-test", mapOf(
          "m12.test.files" to temporary.resolve("files").toString(), "m12.test.origin" to origin, "m12.test.browser" to "true", "ritomer.security.session.enabled" to "true",
          "ritomer.security.session.absolute-timeout" to "8h", "ritomer.security.jwt.hmac-secret" to "",
          "server.servlet.session.tracking-modes" to "cookie", "server.servlet.session.timeout" to "30m",
          "server.servlet.session.cookie.name" to "__Host-ritomer-session", "server.servlet.session.cookie.path" to "/",
          "server.servlet.session.cookie.secure" to "true", "server.servlet.session.cookie.http-only" to "true",
          "server.servlet.session.cookie.same-site" to "lax")))
        web.register(SharedOidcHttpHarness::class.java, BrowserTestAssets::class.java, BrowserQualificationFiles::class.java)
        web.refresh()
        val types = EnumSet.of(DispatcherType.REQUEST)
        sc.addFilter("requestContext", org.springframework.web.filter.RequestContextFilter())
          .addMappingForUrlPatterns(types, true, "/*")
        sc.addFilter("challenge", SharedQualificationFilter("ritomer-m12-loopback", { line ->
          events.add(mapOf("timestamp" to Instant.now().toString(), "payload" to json.readTree(line)))
        }, windowAuthority = browserWindows::get)).addMappingForUrlPatterns(types, true, "/*")
        if (ordinary) {
          val issuer = web.getBean(SyntheticOidcProvider::class.java).issuer
          sc.addFilter("loginEvents", ManualOidcObservationFilter(Instant.now().plusSeconds(120), origin,
            "ritomer-m12-loopback", emit = { line ->
              loginEvents.add(mapOf("timestamp" to Instant.now().toString(), "payload" to json.readTree(line)))
            }, authorizationEndpoint = "$issuer/authorize")).addMappingForUrlPatterns(types, true, "/*")
        }
        // Observe the synthetic session ordinal on ingress. Pass both servlet objects unchanged.
        if (!ordinary) sc.addFilter("presentedSession", Filter { req, res, chain ->
          val request = req as HttpServletRequest
          request.getHeader("X-Ritomer-Qualification-Challenge")?.let { challenge ->
            val saves = web.getBean(RecordingContextRepository::class.java).saves
            val sid = request.cookies.orEmpty().singleOrNull { it.name == "__Host-ritomer-session" }?.value
            val ordinal = saves.indexOfFirst { it.sid == sid }
            check(ordinal >= 0 && presented.putIfAbsent(challenge, ordinal) == null) { "EXACT_SESSION_NOT_PRESENTED" }
          }
          chain.doFilter(req, res)
        }).addMappingForUrlPatterns(types,true,"/*")
        val sessions = SessionRepositoryFilter(web.getBean(RecordingSessionRepository::class.java))
        sessions.setHttpSessionIdResolver(CookieHttpSessionIdResolver().apply {
          setCookieSerializer(SharedSessionSecurityConfiguration().cookieSerializer())
        })
        sc.addFilter("sessions", sessions).addMappingForUrlPatterns(types, true, "/*")
        sc.addFilter("security", DelegatingFilterProxy("springSecurityFilterChain", web)).addMappingForUrlPatterns(types, true, "/*")
      }, emptySet())
      Tomcat.addServlet(root, "app", dispatcher).loadOnStartup = 1
      root.addServletMappingDecoded("/", "app")
      server.start()
      val ids = web.getBean(IdentityTestStore::class.java)
      val bindings = web.getBean(HarnessBindings::class.java)
      val tenants = listOf(UUID.randomUUID(), UUID.randomUUID())
      val actors = listOf("A", "B").mapIndexed { i, label ->
        val user = ids.seedUser("client-$label", displayName = "Client $label")
        val role = if (ordinary && label == "B") TenantRole.ADMIN else TenantRole.ACCOUNTANT
        ids.seedActiveMembership("client-$label", tenants[i], label, "Test $label", role)
        user.id
      }
      check(bindings.binding == null && bindings.secondBinding == null)
      val subjects = ArrayDeque(listOf("provider-subject-never-persisted", "provider-subject-b", "provider-subject-never-persisted"))
      val idp = web.getBean(SyntheticOidcProvider::class.java)
      idp.enableBrowserAuthorization(URI("$origin/login/oauth2/code/google")) { subjects.removeFirst() }
      val pilotTest = frontend.parent.resolve("backend/scripts/m12_qualification").resolve(if (ordinary) "browser_fixture.py" else "loopback_driver.py")
      val python = Path.of(System.getenv("RITOMER_M12_FIXTURE_PYTHON")).toRealPath()
      val runId = if (interruptAfterRevoke) UUID.randomUUID().toString()
        else UUID.fromString(System.getenv("RITOMER_M12_RUN_ID")).toString()
      val objects = web.getBean(BrowserQualificationFiles::class.java)
      val fixtureFiles = mapOf("A" to objects.seed("A",tenants[0],actors[0]), "B" to objects.seed("B",tenants[1],actors[1]))
      val client = ProcessBuilder(python.toString(), "-B", pilotTest.toString(), origin, idp.issuer,
        browserExe.toString(), actors[0].toString(), tenants[0].toString(), actors[1].toString(), tenants[1].toString(), version)
        .apply { if (!ordinary) command().add(3, "--loopback-client") }
        .apply { environment()["RITOMER_M12_RUN_ID"] = runId; environment()["RITOMER_M12_SYNTHETIC_FILES"] = json.writeValueAsString(fixtureFiles) }
        .apply { if (ordinary) {
          val keys = java.security.KeyStore.getInstance("PKCS12")
          Files.newInputStream(storeFile).use { keys.load(it, pass.toCharArray()) }
          val pin = java.security.MessageDigest.getInstance("SHA-256").digest(keys.getCertificate("localhost").publicKey.encoded)
          environment()["RITOMER_M12_TEST_SPKI"] = java.util.Base64.getEncoder().encodeToString(pin)
        } }
        .apply { if (interruptAfterRevoke) command().add("--fixture-interrupt-after-revoke") }
        .directory(frontend.parent.toFile()).redirectError(ProcessBuilder.Redirect.INHERIT).start()
      val rows = mutableListOf<JsonNode>()
      val expected = ArrayDeque(listOf("BIND_A","BIND_B","READY_A","READY_B","REVOKE_A","RESTORE_A","READY_A2","REST"))
      var publication: JsonNode? = null
      fun clearBindings() {
        bindings.binding = null
        bindings.secondBinding = null
        check(bindings.binding == null && bindings.secondBinding == null)
      }
      var bindingB: OidcIdentityBinding? = null
      val steps = mutableListOf<String>()
      var liveVersion: String? = null
      val timer = java.util.concurrent.Executors.newSingleThreadScheduledExecutor()
      try {
        timer.schedule({ client.destroyForcibly() }, 95, TimeUnit.SECONDS)
        client.outputStream.bufferedWriter().use { commands ->
          client.inputStream.bufferedReader().useLines { lines -> lines.forEach { line ->
            check(line.length <= 2048 && rows.size <= 30)
            val item = json.readTree(line)
            if (ordinary && item.has("windowCommitments")) {
              val pins = item["windowCommitments"].asText()
              check(pins.matches(Regex("[0-9a-f]{64}(,[0-9a-f]{64}){2}")) &&
                browserWindows.compareAndSet(null, pins to Instant.now().plusSeconds(120)))
              commands.write("WINDOWS_BOUND"); commands.newLine(); commands.flush()
            } else if (ordinary && item.path("read").asText() == "loginEvents") {
              commands.write(json.writeValueAsString(loginEvents.toList())); commands.newLine(); commands.flush()
            } else if (ordinary && item.has("lookup")) {
              val event = events.single { (it["payload"] as JsonNode)["challenge"].asText() == item["lookup"].asText() }
              commands.write(json.writeValueAsString(event)); commands.newLine(); commands.flush()
            } else if (ordinary && item.has("closure")) {
              val closure = item["closure"]
              check(publication == null && closure["tree_terminated"].asBoolean() && closure["terminated"].asBoolean())
              if (!interruptAfterRevoke) check(closure["exit"].asInt() == 0 && !closure["forced_tree_termination"].asBoolean())
              publication = item
            } else if (item.has("browserVersion")) {
              check(liveVersion == null && rows.isEmpty() && item.size() == 1 && item.path("browserVersion").asText() == version)
              liveVersion = version
            } else if (item.has("published")) {
              check(publication == null && rows.size == 30 && expected.isEmpty() &&
                item.fieldNames().asSequence().toSet() == setOf("run","published","candidate") &&
                item["run"].asText() == runId && listOf("candidate","published").all { item[it].asText().matches(Regex("[0-9a-f]{64}")) })
              publication = item
            } else if (item.has("next")) {
              val step = item.get("next").asText()
              check(item.size() == 1 && step in setOf("BIND_A","BIND_B","READY_A","READY_B","REVOKE_A","RESTORE_A","READY_A2","REST") && "REST" !in steps)
              if (step != "REST" || expected.firstOrNull() == "REST" && (ordinary || rows.size == 30)) {
                check(step == expected.removeFirst())
                if (!ordinary) check(rows.size == mapOf("BIND_A" to 0,"BIND_B" to 0,"READY_A" to 0,"READY_B" to 0,"REVOKE_A" to 6,"RESTORE_A" to 10,"READY_A2" to 14,"REST" to 30)[step])
              }
              if (step == "BIND_A") {
                check(bindings.binding == null && bindings.secondBinding == null)
                bindings.binding = OidcIdentityBinding(UUID.randomUUID(), actors[0], true)
              } else if (step == "BIND_B") {
                check(bindings.binding?.actorId == actors[0] && bindings.secondBinding == null)
                bindingB = OidcIdentityBinding(UUID.randomUUID(), actors[1], true)
                bindings.secondBinding = bindingB
              } else if (step.startsWith("READY_")) {
                check(bindings.binding?.active == true && bindings.secondBinding?.active == true)
                check(subjects.size == mapOf("READY_A" to 3,"READY_B" to 2,"READY_A2" to 1)[step])
              } else if (step != "REST") {
                val previous = checkNotNull(bindings.binding)
                check(previous.active == (step == "REVOKE_A") && previous.actorId == actors[0])
                bindings.binding = previous.copy(id = UUID.randomUUID(), active = step == "RESTORE_A")
              } else clearBindings()
              check(if (step == "REST") bindings.binding == null && bindings.secondBinding == null else bindings.secondBinding == bindingB)
              steps.add(step)
              commands.write(step); commands.newLine(); commands.flush()
            } else rows.add(item)
          } }
        }
        check(client.waitFor(5, TimeUnit.SECONDS)) { "FIXTURE_OWNER_DID_NOT_CLOSE" }
        if (ordinary && interruptAfterRevoke) {
          check(client.exitValue() == 41 && publication?.has("published") == false &&
            publication?.at("/closure/tree_terminated")?.asBoolean() == true && subjects.size == 1 &&
            steps == listOf("BIND_A","BIND_B","READY_A","READY_B","REVOKE_A","REST") &&
            bindings.binding == null && bindings.secondBinding == null && !Files.exists(resultRoot.resolve("$runId.client-receipts.json")))
          Files.writeString(evidence, json.writeValueAsString(mapOf("simulatedCloud" to steps, "result" to publication)))
          return
        }
        if (interruptAfterRevoke) {
          check(client.exitValue() == 41 && rows.size == 6 && steps == listOf("BIND_A","BIND_B","READY_A","READY_B","REVOKE_A","REST") &&
            bindings.binding == null && bindings.secondBinding == null && !Files.exists(evidence) &&
            publication == null && !Files.exists(resultRoot.resolve("$runId.receipts.json")) && expected.isNotEmpty() && subjects.size == 1) { "INTERRUPTION_NOT_PROVEN" }
          return
        }
        check(client.exitValue() == 0 && expected.isEmpty() && subjects.isEmpty()) { "BROWSER_SEQUENCE_FAILED_AFTER_${rows.size}_RECEIPTS" }
      } finally {
        try { if (client.isAlive) client.destroyForcibly().waitFor() }
        finally { clearBindings(); timer.shutdownNow() }
      }
      if (ordinary) {
        val report = checkNotNull(publication)
        val bytes = Files.readAllBytes(resultRoot.resolve("$runId.client-receipts.json"))
        check(java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes)) == report["published"].asText())
        val receipt = json.readTree(bytes)
        check(receipt["mode"].asText() == "BROWSER_UI" && report["run"].asText() == runId &&
          report.at("/sharing/missing").size() == 6 && idp.tokenCalls.get() == 3)
        val requests = receipt["rows"]
        check(requests.size() == events.size && requests.size() >= 29)
        for (row in requests) {
          val event = events.single { (it["payload"] as JsonNode)["challenge"] == row["challenge"] }
          check((event["payload"] as JsonNode)["status"] == row["status"])
        }
        check(events.map { (it["payload"] as JsonNode)["bootId"].asText() }.distinct().size == 1)
        Files.writeString(evidence, json.writeValueAsString(mapOf("simulatedCloud" to steps, "result" to report,
            "runtime" to mapOf("playwright" to playwright, "chromiumVersion" to version), "events" to events.toList())))
        return
      }
      check(rows.size == 30 && events.size == 30 && idp.tokenCalls.get() == 3 && liveVersion == version)
      val saves = web.getBean(RecordingContextRepository::class.java).saves
      check(saves.map { it.actor.actorId } == listOf(actors[0],actors[1],actors[0]) && saves.map { it.sid }.distinct().size == 3)
      val expectedRequests = buildList {
        fun ok(session: Int) = listOf("ME","DOCUMENT_CONTENT","EXPORT_CONTENT").forEach { add(Triple(session,200,it)) }
        ok(0); ok(1)
        add(Triple(0,403,"ME")); ok(1)
        add(Triple(0,401,"ME")); ok(1)
        ok(2); add(Triple(0,401,"ME")); add(Triple(2,403,"LOGOUT")); ok(2); ok(1)
        add(Triple(2,204,"LOGOUT")); add(Triple(2,401,"ME")); ok(1)
      }
      val fields = setOf("event","operation","phase","actor","session","sequence","challenge","traced","startedAt","utc","status")
      check(rows.all { it.fieldNames().asSequence().toSet() == fields })
      rows.forEachIndexed { i, row ->
        val (ordinal,status,operation) = expectedRequests[i]
        check(presented[row["challenge"].asText()] == ordinal && row["status"].asInt() == status)
        check(row["session"].asText() == (if (ordinal == 2) "REPLACEMENT" else "ORIGINAL") &&
          row["actor"].asText() == (if (ordinal == 1) "B" else "A") &&
          row["operation"].asText() == operation)
        val event = events.single { (it["payload"] as JsonNode)["challenge"] == row["challenge"] }
        check(row["sequence"].asInt() == i+1 && (event["payload"] as JsonNode)["status"] == row["status"])
      }
      Files.newOutputStream(evidence, java.nio.file.StandardOpenOption.CREATE_NEW).use {
        json.writeValue(it,mapOf("environment" to "SINGLE_LOCAL_SERVLET_SYNTHETIC_IDP_MEMORY",
          "publication" to checkNotNull(publication), "runtime" to mapOf("playwright" to playwright,"chromiumRevision" to revision,"chromiumVersion" to liveVersion),
          "simulatedCloud" to steps, "fixture" to "UNMODIFIED_SERVER_EXPIRATION_LOCAL_CLIENT",
          "rows" to rows,"events" to events.toList()))
      }
    } finally {
      try { server.stop() } finally { try { server.destroy() } finally { web.close() } }
    }
  }
}
