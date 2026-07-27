package ch.qamwaq.ritomer.devtools

import ch.qamwaq.ritomer.testsupport.DisposablePostgresTestDatabase
import java.io.File
import java.lang.reflect.InvocationHandler
import java.lang.reflect.Method
import java.lang.reflect.Proxy
import java.nio.file.Files
import java.nio.file.Path
import java.sql.Connection
import java.sql.DatabaseMetaData
import java.sql.ResultSet
import java.sql.SQLException
import java.sql.Statement
import javax.sql.DataSource
import kotlin.io.path.readText
import kotlin.streams.asSequence
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.assertj.core.api.Assertions.catchThrowable
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import org.springframework.asm.AnnotationVisitor
import org.springframework.asm.ClassReader
import org.springframework.asm.ClassVisitor
import org.springframework.asm.ClassWriter
import org.springframework.asm.FieldVisitor
import org.springframework.asm.Handle
import org.springframework.asm.Label
import org.springframework.asm.MethodVisitor
import org.springframework.asm.Opcodes
import org.springframework.asm.Type
import org.springframework.core.env.MapPropertySource
import org.springframework.core.env.StandardEnvironment
import org.springframework.mock.env.MockEnvironment

class DemoSeedLocalSourceGuardTest {
  @Test
  fun `demo seed main source exposes no http endpoint auth bypass or sensitive local value`() {
    val source = mainDevtoolsSource()

    assertThat(source).doesNotContain(
      "@RestController",
      "@Controller",
      "@RequestMapping",
      "@GetMapping",
      "@PostMapping",
      "@PutMapping",
      "@DeleteMapping",
      "SecurityFilterChain",
      "permitAll",
      "JwtDecoder",
      "BearerToken",
      "password",
      "secret",
      "token",
      "credential",
      "GraphQL",
      "OpenAPI"
    )
    assertThat(source).contains(
      DEMO_SEED_VARIANT_043B_TWO_ACTOR_PILOT,
      DEMO_SEED_DATASET_CLASSIFICATION_043B,
      DemoSeedLocalDataset.reviewerExternalSubject
    )
    assertThat(source).doesNotContain(
      "insert into workpaper",
      "insert into workpaper_evidence",
      "insert into document",
      "insert into document_verification",
      "insert into export_pack"
    )
    assertThat(Regex("""(^|[\\/])\.env($|[^A-Za-z])""").containsMatchIn(source)).isFalse()
  }

  @Test
  fun `demo seed Gradle task uses exact documented Gradle property names`() {
    val runbook = Path.of("../runbooks/local-dev.md").readText()
    val buildScript = Path.of("build.gradle.kts").readText()
    val enabledProperty = "ritomerDemoSeedEnabled"
    val profileProperty = "ritomerDemoSeedProfile"
    val variantProperty = "ritomerDemoSeedVariant"

    assertThat(runbook).contains(
      "-P$enabledProperty=true",
      "-P$profileProperty=dbtest",
      "-P$variantProperty=$DEMO_SEED_VARIANT_042A2A5D_MIXED_V2",
      "-P$variantProperty=$DEMO_SEED_VARIANT_043B_TWO_ACTOR_PILOT"
    )
    assertThat(buildScript).contains(
      """providers.gradleProperty("$enabledProperty")""",
      """providers.gradleProperty("$profileProperty")""",
      """providers.gradleProperty("$variantProperty")"""
    )
  }

  @Test
  fun `structural scanner covers the exact destructive integration test inventory`() {
    val compiledClasses = compiledProjectTestClasses()
    val dbTests = compiledClasses.filter { it.tags.contains(DB_INTEGRATION_TAG) }
    val actualClasses = dbTests.map(CompiledClassFacts::simpleName).sorted()
    val classesWithInitializer = dbTests.count { facts ->
      facts.contextInitializers == listOf(GUARD_INITIALIZER_INTERNAL_NAME)
    }
    val classesWithEnableCondition = dbTests.count { facts ->
      facts.enabledEnvironmentConditions == listOf(
        EnabledEnvironmentCondition(DB_TESTS_ENABLED, CASE_INSENSITIVE_TRUE_PATTERN)
      )
    }
    val classesUsingTruncate = dbTests.count { it.calls(TRUNCATE_METHOD_NAME) }
    val authoritativeClasses = compiledClasses.filter { facts ->
      facts.tags.contains(DB_INTEGRATION_TAG) ||
        facts.internalName in setOf(SUPPORT_INTERNAL_NAME, SUPPORT_FILE_INTERNAL_NAME)
    }
    val scannableClasses = authoritativeClasses.filterNot { facts ->
      facts.internalName in setOf(SUPPORT_INTERNAL_NAME, SUPPORT_FILE_INTERNAL_NAME) ||
        facts.isScannerImplementationClass()
    }
    val schemaRecreateClasses = scannableClasses
      .filter { it.calls(RECREATE_SCHEMA_METHOD_NAME) }
      .map(CompiledClassFacts::simpleName)
      .sorted()
    val truncateClasses = scannableClasses
      .filter { it.calls(TRUNCATE_METHOD_NAME) }
      .map(CompiledClassFacts::simpleName)
      .sorted()
    val destructiveSql = compiledDestructiveSqlCounts(scannableClasses)
    val deletePolicy = compiledDeleteProbePolicy(
      authoritativeClasses,
      ALLOWED_APPEND_ONLY_DELETE_PROBES
    )
    val flywayClean = scannableClasses.count { facts ->
      facts.methodCalls.any { call -> call.owner == FLYWAY_INTERNAL_NAME && call.name == "clean" }
    }
    val authMeFacts = compiledClasses.single {
      it.internalName == AUTH_ME_DB_TEST_INTERNAL_NAME
    }

    assertThat(actualClasses).containsExactlyElementsOf(EXPECTED_DB_INTEGRATION_CLASSES.sorted())
    assertThat(dbTests).hasSize(12)
    assertThat(classesWithInitializer).isEqualTo(12)
    assertThat(classesWithEnableCondition).isEqualTo(12)
    assertThat(classesUsingTruncate).isEqualTo(12)
    assertThat(truncateClasses).containsExactlyElementsOf(EXPECTED_DB_INTEGRATION_CLASSES.sorted())
    assertThat(schemaRecreateClasses).containsExactly(
      "DocumentsDbIntegrationTest",
      "ExportsDbIntegrationTest"
    )
    assertThat(destructiveSql.total).isZero()
    assertThat(deletePolicy.violations).isEmpty()
    assertThat(deletePolicy.targetedProbeCount).isEqualTo(2)
    assertThat(deletePolicy.exportPackProbePassed).isTrue()
    assertThat(deletePolicy.auditEventProbePassed).isTrue()
    assertThat(deletePolicy.unexpectedDeleteCount).isZero()
    assertThat(deletePolicy.deleteSqlInsideSupport).isZero()
    assertThat(deletePolicy.unresolvedSqlSinkCount).isZero()
    assertThat(deletePolicy.unsafeSqlMethodCount).isZero()
    assertThat(deletePolicy.sqlCommentSurfaceCount).isZero()
    assertThat(flywayClean).isZero()
    assertThat(authMeFacts.autoConfigureMockMvcPresent).isTrue()
    assertThat(authMeFacts.mockMvcPrint).isEqualTo("NONE")
    assertThat(authMeFacts.mockMvcPrintOnlyOnFailure).isFalse()

    println("db_integration_classes=${dbTests.size}")
    println("classes_with_initializer=$classesWithInitializer")
    println("classes_with_case_insensitive_enable_condition=$classesWithEnableCondition")
    println("classes_using_truncate_primitive=$classesUsingTruncate")
    println("classes_using_schema_recreate_primitive=${schemaRecreateClasses.size}")
    println("raw_truncate_outside_support=${destructiveSql.truncate}")
    println("raw_drop_schema_outside_support=${destructiveSql.dropSchema}")
    println("raw_create_schema_outside_support=${destructiveSql.createSchema}")
    println("raw_drop_database_outside_support=${destructiveSql.dropDatabase}")
    println("raw_drop_table_outside_support=${destructiveSql.dropTable}")
    println("raw_drop_owned_outside_support=${destructiveSql.dropOwned}")
    println("targeted_append_only_delete_probes=${deletePolicy.targetedProbeCount}")
    println("delete_probe_export_pack=${if (deletePolicy.exportPackProbePassed) "PASS" else "FAIL"}")
    println("delete_probe_audit_event=${if (deletePolicy.auditEventProbePassed) "PASS" else "FAIL"}")
    println("unexpected_delete_outside_support=${deletePolicy.unexpectedDeleteCount}")
    println("delete_sql_inside_support=${deletePolicy.deleteSqlInsideSupport}")
    println("unresolved_sql_sinks=${deletePolicy.unresolvedSqlSinkCount}")
    println("unsafe_sql_methods=${deletePolicy.unsafeSqlMethodCount}")
    println("sql_comment_surfaces=${deletePolicy.sqlCommentSurfaceCount}")
    println("flyway_clean=$flywayClean")
    println("runner_explicit_memberships=ZERO_REQUIRED")
    println("mockmvc_print=${authMeFacts.mockMvcPrint}")
    println("mockmvc_print_only_on_failure=${authMeFacts.mockMvcPrintOnlyOnFailure}")
  }

  @Test
  fun `compiled scanner rejects adversarial classes and ignores comments and marker strings`() {
    val nominal = scanCompiledClass(syntheticDbClass("fixture/Nominal"))
    assertThat(
      validateSyntheticCompiledSafety(listOf(nominal), setOf("Nominal"))
    ).isEmpty()
    assertThat(nominal.tags).containsExactly(DB_INTEGRATION_TAG)

    val secondTaggedClass = scanCompiledClass(syntheticDbClass("fixture/SecondTagged"))
    assertThat(
      validateSyntheticCompiledSafety(
        listOf(nominal, secondTaggedClass),
        setOf("Nominal")
      )
    ).contains("DB_INTEGRATION_INVENTORY")

    val initializerCommentOnly = scanCompiledClass(
      syntheticDbClass(
        "fixture/InitializerCommentOnly",
        initializer = false,
        strings = listOf("DisposablePostgresTestDatabaseGuardInitializer")
      )
    )
    assertThat(
      validateSyntheticCompiledSafety(
        listOf(initializerCommentOnly),
        setOf("InitializerCommentOnly")
      )
    ).contains("MISSING_EXACT_INITIALIZER")

    val primitiveStringOnly = scanCompiledClass(
      syntheticDbClass(
        "fixture/PrimitiveStringOnly",
        truncateCall = false,
        strings = listOf("DisposablePostgresTestDatabase.truncateAllCurrentTables")
      )
    )
    assertThat(
      validateSyntheticCompiledSafety(listOf(primitiveStringOnly), setOf("PrimitiveStringOnly"))
    ).contains("MISSING_TRUNCATE_CALL")

    val destructiveSqlCases = listOf(
      "ConcatenatedTruncate" to listOf("TRUNCATE ", "TABLE synthetic_table"),
      "MixedCaseTruncate" to listOf("tRuNcAtE TaBlE synthetic_table"),
      "MultilineDrop" to listOf("DROP\nSCHEMA public"),
      "SpacedCreate" to listOf("CREATE     SCHEMA public"),
      "DirectJdbcDropTable" to listOf("DROP TABLE synthetic_table")
    )
    destructiveSqlCases.forEach { (name, fragments) ->
      val facts = scanCompiledClass(
        syntheticDbClass("fixture/$name", strings = fragments, jdbcCall = true)
      )
      assertThat(validateSyntheticCompiledSafety(listOf(facts), setOf(name)))
        .anyMatch { it.startsWith("RAW_DESTRUCTIVE_SQL") }
    }

    val noInitializer = scanCompiledClass(
      syntheticDbClass("fixture/NoInitializer", initializer = false)
    )
    assertThat(validateSyntheticCompiledSafety(listOf(noInitializer), setOf("NoInitializer")))
      .contains("MISSING_EXACT_INITIALIZER")

    val noGuardedPrimitive = scanCompiledClass(
      syntheticDbClass("fixture/NoGuardedPrimitive", truncateCall = false)
    )
    assertThat(validateSyntheticCompiledSafety(listOf(noGuardedPrimitive), setOf("NoGuardedPrimitive")))
      .contains("MISSING_TRUNCATE_CALL")

    val unexpectedThirteenth = (1..13).map { index ->
      scanCompiledClass(syntheticDbClass("fixture/Inventory$index"))
    }
    assertThat(
      validateSyntheticCompiledSafety(
        unexpectedThirteenth,
        (1..12).mapTo(mutableSetOf()) { "Inventory$it" }
      )
    ).contains("DB_INTEGRATION_INVENTORY")

    val unauthorizedRecreate = scanCompiledClass(
      syntheticDbClass("fixture/UnauthorizedRecreate", recreateCall = true)
    )
    assertThat(
      validateSyntheticCompiledSafety(
        listOf(unauthorizedRecreate),
        setOf("UnauthorizedRecreate")
      )
    ).contains("UNAUTHORIZED_SCHEMA_RECREATE_CALL")
  }

  @Test
  fun `compiled delete scanner accepts only the two exact append only probes`() {
    fun compiledProbe(
      internalName: String,
      sqlCalls: List<SyntheticSqlCall> = emptyList(),
      strings: List<String> = emptyList(),
      storedStrings: List<String> = emptyList(),
      fieldStrings: List<String> = emptyList(),
      tagged: Boolean = true
    ): CompiledClassFacts = scanCompiledClass(
      syntheticDbClass(
        internalName = internalName,
        tagged = tagged,
        initializer = tagged,
        enableCondition = tagged,
        truncateCall = tagged,
        strings = strings,
        storedStrings = storedStrings,
        fieldStrings = fieldStrings,
        sqlCalls = sqlCalls
      )
    )

    fun exportProbe(
      strings: List<String> = listOf("delete from export_pack where id = ?"),
      owner: String = JDBC_TEMPLATE_INTERNAL_NAME,
      name: String = "update",
      descriptor: String = JDBC_TEMPLATE_UPDATE_DESCRIPTOR
    ) = compiledProbe(
      EXPORTS_DB_TEST_INTERNAL_NAME,
      sqlCalls = listOf(SyntheticSqlCall(strings, owner, name, descriptor))
    )

    fun auditProbe(
      strings: List<String> = listOf("delete from audit_event where id = ?"),
      owner: String = JDBC_TEMPLATE_INTERNAL_NAME,
      name: String = "update",
      descriptor: String = JDBC_TEMPLATE_UPDATE_DESCRIPTOR
    ) = compiledProbe(
      PERSISTENCE_DB_TEST_INTERNAL_NAME,
      sqlCalls = listOf(SyntheticSqlCall(strings, owner, name, descriptor))
    )

    fun policy(vararg classes: CompiledClassFacts): DeleteProbePolicyResult =
      compiledDeleteProbePolicy(classes.toList(), ALLOWED_APPEND_ONLY_DELETE_PROBES)

    val nominal = policy(exportProbe(), auditProbe())
    assertThat(nominal.violations).isEmpty()
    assertThat(nominal.targetedProbeCount).isEqualTo(2)
    assertThat(nominal.unexpectedDeleteCount).isZero()
    assertThat(nominal.deleteSqlInsideSupport).isZero()

    val thirdDelete = compiledProbe(
      "fixture/ThirdDelete",
      sqlCalls = listOf(SyntheticSqlCall(listOf("delete from export_pack where id = ?")))
    )
    assertThat(policy(exportProbe(), auditProbe(), thirdDelete).violations)
      .contains("UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val exportInAnotherClass = compiledProbe(
      "fixture/ExportDeleteInAnotherClass",
      sqlCalls = listOf(SyntheticSqlCall(listOf("delete from export_pack where id = ?")))
    )
    assertThat(policy(exportInAnotherClass, auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val auditInAnotherClass = compiledProbe(
      "fixture/AuditDeleteInAnotherClass",
      sqlCalls = listOf(SyntheticSqlCall(listOf("delete from audit_event where id = ?")))
    )
    assertThat(policy(exportProbe(), auditInAnotherClass).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    assertThat(policy(exportProbe(listOf("delete from export_pack")), auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(policy(exportProbe(), auditProbe(listOf("delete from audit_event"))).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(
      policy(exportProbe(listOf("delete from export_pack where tenant_id = ?")), auditProbe()).violations
    ).contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(policy(exportProbe(listOf("delete from export_pack where id")), auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(policy(exportProbe(listOf("delete from tenant where id = ?")), auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(
      policy(exportProbe(listOf("delete from export_pack where id = ?; select 1")), auditProbe()).violations
    ).contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(
      policy(exportProbe(listOf("delete from ", "export_pack where id = ?")), auditProbe()).violations
    ).contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(
      policy(
        exportProbe(descriptor = "(Ljava/lang/String;)I"),
        auditProbe()
      ).violations
    ).contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(
      policy(
        exportProbe(
          owner = "java/sql/Statement",
          name = "executeUpdate",
          descriptor = "(Ljava/lang/String;)I"
        ),
        auditProbe()
      ).violations
    ).contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(
      policy(
        exportProbe(
          owner = "java/sql/Connection",
          name = "prepareStatement",
          descriptor = "(Ljava/lang/String;)Ljava/sql/PreparedStatement;"
        ),
        auditProbe()
      ).violations
    ).contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val supportDelete = compiledProbe(
      SUPPORT_INTERNAL_NAME,
      fieldStrings = listOf("delete from export_pack where id = ?"),
      tagged = false
    )
    assertThat(policy(exportProbe(), auditProbe(), supportDelete).violations)
      .contains("DELETE_SQL_INSIDE_SUPPORT")

    assertThat(
      policy(exportProbe(listOf("delete from export_pack", "WHERE id = ?")), auditProbe()).violations
    ).contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val exportConstantOnly = compiledProbe(
      EXPORTS_DB_TEST_INTERNAL_NAME,
      strings = listOf("delete from export_pack where id = ?")
    )
    assertThat(policy(exportConstantOnly, auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val discardedDeleteBeforeUnrelatedSink = compiledProbe(
      EXPORTS_DB_TEST_INTERNAL_NAME,
      strings = listOf("delete from export_pack where id = ?"),
      sqlCalls = listOf(
        SyntheticSqlCall(listOf("update another_table set value = ?"))
      )
    )
    assertThat(policy(discardedDeleteBeforeUnrelatedSink, auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val storedDeleteBeforeUnrelatedSink = compiledProbe(
      EXPORTS_DB_TEST_INTERNAL_NAME,
      storedStrings = listOf("delete from export_pack where id = ?"),
      sqlCalls = listOf(
        SyntheticSqlCall(listOf("update another_table set value = ?"))
      )
    )
    assertThat(policy(storedDeleteBeforeUnrelatedSink, auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val fieldDeleteBeforeUnrelatedSink = compiledProbe(
      EXPORTS_DB_TEST_INTERNAL_NAME,
      fieldStrings = listOf("delete from export_pack where id = ?"),
      sqlCalls = listOf(
        SyntheticSqlCall(listOf("update another_table set value = ?"))
      )
    )
    assertThat(policy(fieldDeleteBeforeUnrelatedSink, auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val dynamicArgumentAfterUnusedDelete = compiledProbe(
      EXPORTS_DB_TEST_INTERNAL_NAME,
      strings = listOf("delete from export_pack where id = ?"),
      sqlCalls = listOf(
        SyntheticSqlCall(listOf("update another_table ", "set value = ?"))
      )
    )
    assertThat(policy(dynamicArgumentAfterUnusedDelete, auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val unknownArgumentAfterUnusedDelete = compiledProbe(
      EXPORTS_DB_TEST_INTERNAL_NAME,
      strings = listOf("delete from export_pack where id = ?"),
      sqlCalls = listOf(SyntheticSqlCall(emptyList()))
    )
    assertThat(policy(unknownArgumentAfterUnusedDelete, auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val structuralVariations = listOf(
      "delete from export_pack where id = ? or tenant_id = ?",
      "delete from export_pack where id = ? and tenant_id = ?",
      "delete from export_pack where id in (select id from export_pack)",
      "delete from export_pack where id = ? -- append-only bypass"
    )
    structuralVariations.forEach { sql ->
      assertThat(policy(exportProbe(listOf(sql)), auditProbe()).violations)
        .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    }

    val normalizedEquivalent = policy(
      exportProbe(listOf("  dElEtE\tFrOm   export_pack\r\n WhErE id = ? ;  ")),
      auditProbe(listOf("DELETE\nFROM\taudit_event   WHERE   ID = ?"))
    )
    assertThat(normalizedEquivalent.violations).isEmpty()
    assertThat(normalizedEquivalent.targetedProbeCount).isEqualTo(2)
  }

  @Test
  fun `compiled sql scanner fails closed for the six reviewed bypass families`() {
    val allowedExportProbe = mapOf(EXPORTS_DB_TEST_INTERNAL_NAME to EXPORT_PACK_DELETE_SQL)

    val pop2Facts = scanCompiledClass(pop2CategoryAdversarialClass())
    val pop2Policy = compiledDeleteProbePolicy(listOf(pop2Facts), allowedExportProbe)
    assertThat(pop2Policy.violations).contains("UNRESOLVED_SQL_SINK")
    assertThat(pop2Policy.unresolvedSqlSinkCount).isEqualTo(1)
    assertThat(pop2Policy.unsafeSqlMethodCount).isZero()

    val commentCases = linkedMapOf(
      "EmptyBlockDeleteComment" to "delete/**/from tenant where id = ?",
      "BlockDeleteComment" to "delete/*x*/from tenant where id = ?",
      "LineDeleteComment" to "delete--x\nfrom tenant where id = ?",
      "BlockTruncateComment" to "truncate/**/table tenant",
      "BlockDropSchemaComment" to "drop/**/schema public",
      "BlockCreateSchemaComment" to "create/**/schema public",
      "NestedBlockComment" to "delete/*outer/*inner*/from tenant where id = ?",
      "UnterminatedBlockComment" to "delete/*unterminated from tenant where id = ?"
    )
    commentCases.forEach { (name, sql) ->
      val facts = scanCompiledClass(
        syntheticDbClass(
          internalName = "fixture/$name",
          sqlCalls = listOf(SyntheticSqlCall(listOf(sql)))
        )
      )
      val policy = compiledDeleteProbePolicy(listOf(facts), emptyMap())
      assertThat(policy.violations).contains("SQL_COMMENT_SURFACE")
      assertThat(policy.sqlCommentSurfaceCount).isEqualTo(1)
      assertThat(policy.unresolvedSqlSinkCount).isZero()
    }

    val similarPrefixFacts = scanCompiledClass(
      syntheticDbClass(
        internalName = SCANNER_INTERNAL_NAME + "Bypass",
        sqlCalls = listOf(SyntheticSqlCall(listOf("delete from tenant where id = ?")))
      )
    )
    val similarPrefixPolicy = compiledDeleteProbePolicy(listOf(similarPrefixFacts), emptyMap())
    assertThat(similarPrefixPolicy.violations).contains("UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(similarPrefixPolicy.unexpectedDeleteCount).isEqualTo(1)

    val invokeDynamicFacts = scanCompiledClass(invokeDynamicDeleteRecipeClass())
    val invokeDynamicPolicy = compiledDeleteProbePolicy(listOf(invokeDynamicFacts), emptyMap())
    assertThat(invokeDynamicPolicy.violations)
      .contains("UNEXPECTED_DELETE_OUTSIDE_SUPPORT", "UNRESOLVED_SQL_SINK")
    assertThat(invokeDynamicFacts.methods.flatMap(CompiledMethodFacts::potentialSqlSurfaces))
      .containsExactly("delete from tenant where id = \u0001")

    val branchFacts = scanCompiledClass(branchWithoutFramesAdversarialClass())
    val branchPolicy = compiledDeleteProbePolicy(listOf(branchFacts), allowedExportProbe)
    assertThat(branchPolicy.violations).contains("UNSAFE_SQL_METHOD", "UNRESOLVED_SQL_SINK")
    assertThat(branchPolicy.unsafeSqlMethodCount).isEqualTo(1)

    val runtimeBuiltFacts = scanCompiledClass(runtimeBuiltSqlSinkClass())
    val runtimeBuiltPolicy = compiledDeleteProbePolicy(listOf(runtimeBuiltFacts), emptyMap())
    assertThat(runtimeBuiltPolicy.violations).contains("UNRESOLVED_SQL_SINK")
    assertThat(runtimeBuiltPolicy.unresolvedSqlSinkCount).isEqualTo(1)
    assertThat(deleteSqlSurfaceCount(runtimeBuiltFacts)).isZero()

    println("jvm_category_tracking_fail_closed=YES")
    println("pop2_adversarial_fixture_rejected=YES")
    println("sql_comment_fixtures_rejected=YES")
    println("scanner_prefix_fixture_rejected=YES")
    println("invokedynamic_recipe_fixture_rejected=YES")
    println("branch_without_frames_fixture_rejected=YES")
    println("runtime_built_sql_fixture_rejected=YES")
  }

  @Test
  fun `case insensitive JUnit gate hands uppercase activation to the exact runtime guard`() {
    val authMeFacts = compiledProjectTestClasses().single {
      it.internalName == AUTH_ME_DB_TEST_INTERNAL_NAME
    }
    val condition = authMeFacts.enabledEnvironmentConditions.single()
    val compiledPattern = Regex(condition.matches ?: error("Compiled enable pattern is required."))

    assertThat(condition.named).isEqualTo(DB_TESTS_ENABLED)
    assertThat(condition.matches).isEqualTo(CASE_INSENSITIVE_TRUE_PATTERN)
    assertThat(compiledPattern.matches("true")).isTrue()
    assertThat(compiledPattern.matches("TRUE")).isTrue()

    val fixture = jdbcFixture()
    assertThatThrownBy {
      DisposablePostgresTestDatabase.truncateAllCurrentTables(
        fixture.dataSource,
        canonicalEnvironment(processOverrides = mapOf(DB_TESTS_ENABLED to "TRUE"))
      )
    }.isInstanceOf(IllegalStateException::class.java)
    assertThat(fixture.state.acquisitionCount).isZero()
    assertThat(fixture.state.executeCount).isZero()
  }

  @Test
  fun `guard rejects absent or incorrect activation and consent before connection`() {
    val cases = listOf(
      canonicalEnvironment(processOverrides = mapOf(DB_TESTS_ENABLED to null)),
      canonicalEnvironment(processOverrides = mapOf(DB_TESTS_ENABLED to "false")),
      canonicalEnvironment(processOverrides = mapOf(DESTRUCTIVE_CONSENT to null)),
      canonicalEnvironment(processOverrides = mapOf(DESTRUCTIVE_CONSENT to "WRONG"))
    )

    cases.forEach(::assertRejectedBeforeConnection)
  }

  @Test
  fun `guard rejects divergent process and effective Spring datasource configuration`() {
    val cases = listOf(
      canonicalEnvironment(processOverrides = mapOf(DB_TEST_JDBC_URL to "jdbc:postgresql://localhost:5432/ritomer_043b_test")),
      canonicalEnvironment(springOverrides = mapOf(DATASOURCE_URL to "jdbc:postgresql://127.0.0.1:5432/other")),
      canonicalEnvironment(springOverrides = mapOf(DATASOURCE_USERNAME to "other_runner")),
      canonicalEnvironment(springOverrides = mapOf(DATASOURCE_PASSWORD to "divergent-synthetic-value"))
    )

    cases.forEach(::assertRejectedBeforeConnection)
  }

  @Test
  fun `guard rejects absent blank and divergent password configuration`() {
    val cases = listOf(
      canonicalEnvironment(processOverrides = mapOf(DB_TEST_PASSWORD to null)),
      canonicalEnvironment(processOverrides = mapOf(DB_TEST_PASSWORD to " ")),
      canonicalEnvironment(springOverrides = mapOf(DATASOURCE_PASSWORD to "divergent-synthetic-value"))
    )

    cases.forEach(::assertRejectedBeforeConnection)
  }

  @Test
  fun `guard rejects divergent alternate Spring configuration channels`() {
    val cases = listOf(
      canonicalEnvironment(processOverrides = mapOf(SPRING_DATASOURCE_URL to "jdbc:postgresql://127.0.0.1:5432/other")),
      canonicalEnvironment(processOverrides = mapOf(SPRING_DATASOURCE_USERNAME to "other_runner")),
      canonicalEnvironment(processOverrides = mapOf(SPRING_DATASOURCE_PASSWORD to "divergent-synthetic-value")),
      canonicalEnvironment(systemOverrides = mapOf(DATASOURCE_URL to "jdbc:postgresql://127.0.0.1:5432/other")),
      canonicalEnvironment(
        processOverrides = mapOf(
          SPRING_APPLICATION_JSON to """{"spring":{"datasource":{"url":"jdbc:postgresql://127.0.0.1:5432/other"}}}"""
        )
      )
    )

    cases.forEach(::assertRejectedBeforeConnection)
  }

  @Test
  fun `guard rejects divergent JDBC metadata without executing destructive SQL`() {
    val fixtures = listOf(
      jdbcFixture(JdbcOptions(metadataUrl = "jdbc:postgresql://127.0.0.1:5432/other")),
      jdbcFixture(JdbcOptions(metadataUsername = "other_runner"))
    )

    fixtures.forEach { fixture ->
      assertRejectedAfterConnection(fixture)
      assertThat(fixture.state.executeCount).isZero()
    }
  }

  @Test
  fun `guard rejects every divergent PostgreSQL identity value`() {
    val invalidOptions = listOf(
      JdbcOptions(database = "ritomer"),
      JdbcOptions(database = "postgres"),
      JdbcOptions(database = "template0"),
      JdbcOptions(database = "template1"),
      JdbcOptions(currentUser = "other_runner"),
      JdbcOptions(sessionUser = "other_runner"),
      JdbcOptions(serverAddress = "::1"),
      JdbcOptions(serverPort = "5433")
    )

    invalidOptions.forEach { options ->
      val fixture = jdbcFixture(options)
      assertRejectedAfterConnection(fixture)
      assertThat(fixture.state.executeCount).isZero()
    }
  }

  @Test
  fun `server identity query requests the exact host and accepts only the exact host address`() {
    val nominal = jdbcFixture(JdbcOptions(serverAddress = "127.0.0.1"))

    DisposablePostgresTestDatabase.truncateAllCurrentTables(
      nominal.dataSource,
      canonicalEnvironment()
    )

    val identitySql = nominal.state.queriedSql.single {
      it.contains("current_database()", ignoreCase = true)
    }
    assertThat(identitySql).contains("host(inet_server_addr())")
    assertThat(identitySql).doesNotContain("inet_server_addr()::text")
    assertThat(Regex("""host\(inet_server_addr\(\)\)""").findAll(identitySql).count()).isEqualTo(1)
    assertThat(nominal.state.queryCount).isEqualTo(4)
    assertThat(nominal.state.executeCount).isEqualTo(1)
    assertThat(nominal.state.commitCount).isEqualTo(1)
    assertThat(nominal.state.rollbackCount).isZero()
  }

  @Test
  fun `server address rejects a network prefix another address null and blank before destruction`() {
    val invalidServerAddresses = listOf("127.0.0.1/32", "::1", null, "")

    invalidServerAddresses.forEach { serverAddress ->
      val fixture = jdbcFixture(JdbcOptions(serverAddress = serverAddress))

      assertRejectedAfterConnection(fixture)
      assertThat(fixture.state.executeCount).isZero()
      assertThat(fixture.state.commitCount).isZero()
      assertThat(fixture.state.rollbackCount).isEqualTo(1)
    }
  }

  @Test
  fun `guard rejects null and blank values returned by PostgreSQL`() {
    val invalidOptions = listOf(
      JdbcOptions(database = null),
      JdbcOptions(currentUser = " "),
      JdbcOptions(sessionUser = null),
      JdbcOptions(serverAddress = ""),
      JdbcOptions(serverPort = null),
      JdbcOptions(explicitMembershipCount = null),
      JdbcOptions(databaseOwner = " "),
      JdbcOptions(publicSchemaOwner = null)
    )

    invalidOptions.forEach { options ->
      val fixture = jdbcFixture(options)
      assertRejectedAfterConnection(fixture)
      assertThat(fixture.state.executeCount).isZero()
    }
  }

  @ParameterizedTest
  @ValueSource(ints = [0, 1, 2, 3, 4])
  fun `guard rejects each dangerous PostgreSQL role privilege`(dangerousPrivilegeIndex: Int) {
    val fixture = jdbcFixture(JdbcOptions(dangerousPrivilegeIndex = dangerousPrivilegeIndex))

    assertRejectedAfterConnection(fixture)
    assertThat(fixture.state.executeCount).isZero()
  }

  @Test
  fun `guard rejects every explicit membership shape and incorrect owners`() {
    val membershipCases = listOf(
      "predefined-powerful" to "1",
      "ordinary" to "1",
      "intermediate" to "1",
      "multiple" to "2"
    )
    val fixtures = listOf(
      *membershipCases.map { (_, count) ->
        jdbcFixture(JdbcOptions(explicitMembershipCount = count))
      }.toTypedArray(),
      jdbcFixture(JdbcOptions(databaseOwner = "other_owner")),
      jdbcFixture(JdbcOptions(publicSchemaOwner = "other_owner"))
    )

    fixtures.forEach { fixture ->
      assertRejectedAfterConnection(fixture)
      assertThat(fixture.state.executeCount).isZero()
    }

    val nominal = jdbcFixture()
    DisposablePostgresTestDatabase.truncateAllCurrentTables(nominal.dataSource, canonicalEnvironment())
    val membershipSql = nominal.state.queriedSql.single { it.contains("pg_auth_members", ignoreCase = true) }
    assertThat(membershipSql).contains("member_role.rolname = 'ritomer_043b_test_runner'")
    assertThat(membershipSql).doesNotContain("granted_role")
    assertThat(membershipCases.map(Pair<String, String>::first)).containsExactly(
      "predefined-powerful",
      "ordinary",
      "intermediate",
      "multiple"
    )
  }

  @Test
  fun `membership catalogue failure is fail closed and preserves rollback evidence`() {
    val catalogueFailure = SQLException("synthetic catalogue failure")
    val rollbackFailure = SQLException("synthetic rollback failure")
    val fixture = jdbcFixture(
      JdbcOptions(
        selectFailureIndex = 3,
        selectFailure = catalogueFailure,
        rollbackFailure = rollbackFailure
      )
    )

    val caught = catchThrowable {
      DisposablePostgresTestDatabase.truncateAllCurrentTables(
        fixture.dataSource,
        canonicalEnvironment()
      )
    }

    assertThat(caught).isSameAs(catalogueFailure)
    assertThat(caught.suppressed).containsExactly(rollbackFailure)
    assertThat(fixture.state.acquisitionCount).isEqualTo(1)
    assertThat(fixture.state.executeCount).isZero()
    assertThat(fixture.state.commitCount).isZero()
    assertThat(fixture.state.rollbackCount).isEqualTo(1)
  }

  @Test
  fun `connection and SELECT failures stop before destruction`() {
    val connectionFailure = jdbcFixture(JdbcOptions(connectionFailure = SQLException("synthetic connection failure")))
    assertThatThrownBy {
      DisposablePostgresTestDatabase.truncateAllCurrentTables(
        connectionFailure.dataSource,
        canonicalEnvironment()
      )
    }.isSameAs(connectionFailure.options.connectionFailure)
    assertThat(connectionFailure.state.acquisitionCount).isEqualTo(1)
    assertThat(connectionFailure.state.executeCount).isZero()

    val selectFailure = jdbcFixture(JdbcOptions(selectFailureIndex = 2))
    assertRejectedAfterConnection(selectFailure)
    assertThat(selectFailure.state.executeCount).isZero()
    assertThat(selectFailure.state.rollbackCount).isEqualTo(1)
  }

  @Test
  fun `nominal guard validates before SQL and commits exactly once on one connection`() {
    val fixture = jdbcFixture()

    DisposablePostgresTestDatabase.truncateAllCurrentTables(fixture.dataSource, canonicalEnvironment())

    assertThat(fixture.state.acquisitionCount).isEqualTo(1)
    assertThat(fixture.state.queryCount).isEqualTo(4)
    assertThat(fixture.state.executeCount).isEqualTo(1)
    assertThat(fixture.state.events.indexOf("execute")).isGreaterThan(
      fixture.state.events.indexOfLast { it == "query" }
    )
    assertThat(fixture.state.commitCount).isEqualTo(1)
    assertThat(fixture.state.rollbackCount).isZero()
    assertThat(fixture.state.closeCount).isEqualTo(1)
    assertThat(fixture.state.autoCommit).isTrue()
  }

  @Test
  fun `failure rolls back once preserves the original exception and suppresses rollback failure`() {
    val destructiveFailure = SQLException("synthetic destructive failure")
    val rollbackFailure = SQLException("synthetic rollback failure")
    val fixture = jdbcFixture(
      JdbcOptions(
        destructiveFailure = destructiveFailure,
        rollbackFailure = rollbackFailure
      )
    )

    val caught = catchThrowable {
      DisposablePostgresTestDatabase.truncateAllCurrentTables(
        fixture.dataSource,
        canonicalEnvironment()
      )
    }

    assertThat(caught).isSameAs(destructiveFailure)
    assertThat(caught.suppressed).containsExactly(rollbackFailure)
    assertThat(fixture.state.commitCount).isZero()
    assertThat(fixture.state.rollbackCount).isEqualTo(1)
    assertThat(fixture.state.executeCount).isEqualTo(1)
  }

  @Test
  fun `schema recreation uses one connection one transaction and ordered fixed operations`() {
    val fixture = jdbcFixture()

    DisposablePostgresTestDatabase.recreatePublicSchemaForFlyway(
      fixture.dataSource,
      canonicalEnvironment()
    )

    assertThat(fixture.state.acquisitionCount).isEqualTo(1)
    assertThat(fixture.state.executeCount).isEqualTo(2)
    assertThat(fixture.state.destructiveSql.map { it.uppercase() }).allSatisfy { sql ->
      assertThat(sql).contains("SCHEMA PUBLIC")
    }
    assertThat(fixture.state.destructiveSql[0].uppercase()).startsWith("DROP")
    assertThat(fixture.state.destructiveSql[1].uppercase()).startsWith("CREATE")
    assertThat(fixture.state.commitCount).isEqualTo(1)
    assertThat(fixture.state.rollbackCount).isZero()
  }

  @Test
  fun `direct IDE style invocation remains guarded without the Gradle task gate`() {
    val invalidEnvironment = canonicalEnvironment(processOverrides = mapOf(DESTRUCTIVE_CONSENT to null))
    val fixture = jdbcFixture()

    assertThatThrownBy {
      DisposablePostgresTestDatabase.truncateAllCurrentTables(fixture.dataSource, invalidEnvironment)
    }.isInstanceOf(IllegalStateException::class.java)
    assertThat(fixture.state.acquisitionCount).isZero()
    assertThat(fixture.state.executeCount).isZero()
  }

  private fun assertRejectedBeforeConnection(environment: MockEnvironment) {
    val fixture = jdbcFixture()
    assertThatThrownBy {
      DisposablePostgresTestDatabase.truncateAllCurrentTables(fixture.dataSource, environment)
    }.isInstanceOf(IllegalStateException::class.java)
    assertThat(fixture.state.acquisitionCount).isZero()
    assertThat(fixture.state.executeCount).isZero()
  }

  private fun assertRejectedAfterConnection(fixture: JdbcFixture) {
    assertThatThrownBy {
      DisposablePostgresTestDatabase.truncateAllCurrentTables(
        fixture.dataSource,
        canonicalEnvironment()
      )
    }.isInstanceOf(Exception::class.java)
    assertThat(fixture.state.acquisitionCount).isEqualTo(1)
    assertThat(fixture.state.commitCount).isZero()
    assertThat(fixture.state.rollbackCount).isEqualTo(1)
  }

  private fun mainDevtoolsSource(): String {
    val root = Path.of("src/main/kotlin/ch/qamwaq/ritomer/devtools")
    return Files.walk(root).use { paths ->
      paths.asSequence()
        .filter { Files.isRegularFile(it) }
        .sorted()
        .joinToString(separator = "\n") { it.readText() }
    }
  }

  internal companion object {
    const val EXPECTED_JDBC_URL = "jdbc:postgresql://127.0.0.1:5432/ritomer_043b_test"
    const val EXPECTED_ROLE = "ritomer_043b_test_runner"
    const val SYNTHETIC_PASSWORD = "synthetic-password-for-unit-tests-only"
    const val DB_TESTS_ENABLED = "RITOMER_DB_TESTS_ENABLED"
    const val DB_TEST_JDBC_URL = "RITOMER_DB_TEST_JDBC_URL"
    const val DB_TEST_USERNAME = "RITOMER_DB_TEST_USERNAME"
    const val DB_TEST_PASSWORD = "RITOMER_DB_TEST_PASSWORD"
    const val DESTRUCTIVE_CONSENT = "RITOMER_DB_TEST_DESTRUCTIVE_CONSENT"
    const val SPRING_APPLICATION_JSON = "SPRING_APPLICATION_JSON"
    const val SPRING_DATASOURCE_URL = "SPRING_DATASOURCE_URL"
    const val SPRING_DATASOURCE_USERNAME = "SPRING_DATASOURCE_USERNAME"
    const val SPRING_DATASOURCE_PASSWORD = "SPRING_DATASOURCE_PASSWORD"
    const val DATASOURCE_URL = "spring.datasource.url"
    const val DATASOURCE_USERNAME = "spring.datasource.username"
    const val DATASOURCE_PASSWORD = "spring.datasource.password"
    const val DB_INTEGRATION_TAG = "db-integration"
    const val CASE_INSENSITIVE_TRUE_PATTERN = "(?i:true)"
    const val SUPPORT_INTERNAL_NAME =
      "ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabase"
    const val SUPPORT_FILE_INTERNAL_NAME =
      "ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseSupportKt"
    const val GUARD_INITIALIZER_INTERNAL_NAME =
      "ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseGuardInitializer"
    const val SCANNER_INTERNAL_NAME =
      "ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest"
    const val AUTH_ME_DB_TEST_INTERNAL_NAME =
      "ch/qamwaq/ritomer/devtools/DemoSeedLocalAuthMeDbIntegrationTest"
    const val FLYWAY_INTERNAL_NAME = "org/flywaydb/core/Flyway"
    const val JDBC_TEMPLATE_INTERNAL_NAME = "org/springframework/jdbc/core/JdbcTemplate"
    const val EXPORTS_DB_TEST_INTERNAL_NAME = "ch/qamwaq/ritomer/ExportsDbIntegrationTest"
    const val PERSISTENCE_DB_TEST_INTERNAL_NAME =
      "ch/qamwaq/ritomer/PersistenceFoundationIntegrationTest"
    const val EXPORT_PACK_DELETE_SQL = "DELETE FROM EXPORT_PACK WHERE ID = ?"
    const val AUDIT_EVENT_DELETE_SQL = "DELETE FROM AUDIT_EVENT WHERE ID = ?"
    const val TRUNCATE_METHOD_NAME = "truncateAllCurrentTables"
    const val RECREATE_SCHEMA_METHOD_NAME = "recreatePublicSchemaForFlyway"

    val ALLOWED_APPEND_ONLY_DELETE_PROBES = mapOf(
      EXPORTS_DB_TEST_INTERNAL_NAME to EXPORT_PACK_DELETE_SQL,
      PERSISTENCE_DB_TEST_INTERNAL_NAME to AUDIT_EVENT_DELETE_SQL
    )

    val EXPECTED_DB_INTEGRATION_CLASSES = listOf(
      "BalanceImportPersistenceIntegrationTest",
      "ControlsDbIntegrationTest",
      "DocumentsDbIntegrationTest",
      "ExportsDbIntegrationTest",
      "FinancialStatementsStructuredDbIntegrationTest",
      "FinancialSummaryDbIntegrationTest",
      "ManualMappingPersistenceIntegrationTest",
      "MappingSuggestionDecisionDbIntegrationTest",
      "PersistenceFoundationIntegrationTest",
      "WorkpapersDbIntegrationTest",
      "DemoSeedLocalAuthMeDbIntegrationTest",
      "DemoSeedLocalDbIntegrationTest"
    )
  }
}

private const val TAG_DESCRIPTOR = "Lorg/junit/jupiter/api/Tag;"
private const val TAGS_DESCRIPTOR = "Lorg/junit/jupiter/api/Tags;"
private const val CONTEXT_CONFIGURATION_DESCRIPTOR =
  "Lorg/springframework/test/context/ContextConfiguration;"
private const val ENABLED_ENVIRONMENT_DESCRIPTOR =
  "Lorg/junit/jupiter/api/condition/EnabledIfEnvironmentVariable;"
private const val AUTO_CONFIGURE_MOCK_MVC_DESCRIPTOR =
  "Lorg/springframework/boot/test/autoconfigure/web/servlet/AutoConfigureMockMvc;"

private data class EnabledEnvironmentCondition(
  val named: String?,
  val matches: String?
)

private data class CompiledMethodCall(
  val owner: String,
  val name: String,
  val descriptor: String
)

private data class CompiledSqlCall(
  val owner: String,
  val name: String,
  val descriptor: String,
  val sqlArgument: String?
)

private data class CompiledMethodFacts(
  val name: String,
  val descriptor: String,
  val methodCalls: MutableList<CompiledMethodCall> = mutableListOf(),
  val sqlCalls: MutableList<CompiledSqlCall> = mutableListOf(),
  val stringConstants: MutableList<String> = mutableListOf(),
  val potentialSqlSurfaces: MutableList<String> = mutableListOf(),
  var unsafeForSqlProof: Boolean = false
)

private data class CompiledClassFacts(
  var internalName: String = "",
  val tags: MutableSet<String> = linkedSetOf(),
  val contextInitializers: MutableList<String> = mutableListOf(),
  val enabledEnvironmentConditions: MutableList<EnabledEnvironmentCondition> = mutableListOf(),
  var autoConfigureMockMvcPresent: Boolean = false,
  var mockMvcPrint: String? = null,
  var mockMvcPrintOnlyOnFailure: Boolean? = null,
  val fieldStringConstants: MutableList<String> = mutableListOf(),
  val methods: MutableList<CompiledMethodFacts> = mutableListOf()
) {
  val simpleName: String
    get() = internalName.substringAfterLast('/')

  val methodCalls: List<CompiledMethodCall>
    get() = methods.flatMap(CompiledMethodFacts::methodCalls)

  fun calls(methodName: String): Boolean = methodCalls.any { call ->
    call.owner == DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME && call.name == methodName
  }
}

private fun CompiledClassFacts.isScannerImplementationClass(): Boolean =
  internalName == DemoSeedLocalSourceGuardTest.SCANNER_INTERNAL_NAME ||
    internalName.startsWith(DemoSeedLocalSourceGuardTest.SCANNER_INTERNAL_NAME + '$')

private data class DestructiveSqlCounts(
  val truncate: Int,
  val dropSchema: Int,
  val createSchema: Int,
  val dropDatabase: Int,
  val dropTable: Int,
  val dropOwned: Int
) {
  val total: Int
    get() = truncate + dropSchema + createSchema + dropDatabase + dropTable + dropOwned
}

private fun compiledProjectTestClasses(): List<CompiledClassFacts> {
  val classesRoot = Path.of(
    DemoSeedLocalSourceGuardTest::class.java.protectionDomain.codeSource.location.toURI()
  )
  check(Files.isDirectory(classesRoot)) {
    "Compiled test classes must be available from a filesystem directory."
  }
  return Files.walk(classesRoot).use { paths ->
    paths.asSequence()
      .filter { Files.isRegularFile(it) && it.toString().endsWith(".class") }
      .sorted()
      .map { scanCompiledClass(Files.readAllBytes(it)) }
      .filter { it.internalName.startsWith("ch/qamwaq/ritomer/") }
      .toList()
  }
}

private fun scanCompiledClass(bytes: ByteArray): CompiledClassFacts {
  val facts = CompiledClassFacts()
  ClassReader(bytes).accept(
    object : ClassVisitor(Opcodes.ASM9) {
      override fun visit(
        version: Int,
        access: Int,
        name: String,
        signature: String?,
        superName: String?,
        interfaces: Array<out String>?
      ) {
        facts.internalName = name
      }

      override fun visitAnnotation(descriptor: String, visible: Boolean): AnnotationVisitor? =
        when (descriptor) {
          TAG_DESCRIPTOR -> tagVisitor(facts)
          TAGS_DESCRIPTOR -> tagsContainerVisitor(facts)
          CONTEXT_CONFIGURATION_DESCRIPTOR -> contextConfigurationVisitor(facts)
          ENABLED_ENVIRONMENT_DESCRIPTOR -> enabledEnvironmentVisitor(facts)
          AUTO_CONFIGURE_MOCK_MVC_DESCRIPTOR -> autoConfigureMockMvcVisitor(facts)
          else -> null
        }

      override fun visitField(
        access: Int,
        name: String,
        descriptor: String,
        signature: String?,
        value: Any?
      ): FieldVisitor? {
        if (value is String) facts.fieldStringConstants += value
        return null
      }

      override fun visitMethod(
        access: Int,
        name: String,
        descriptor: String,
        signature: String?,
        exceptions: Array<out String>?
      ): MethodVisitor {
        val methodFacts = CompiledMethodFacts(name, descriptor)
        facts.methods += methodFacts
        return SqlOperandTrackingMethodVisitor(methodFacts)
      }
    },
    ClassReader.SKIP_DEBUG or ClassReader.EXPAND_FRAMES
  )
  return facts
}

private sealed interface TrackedOperand {
  val slots: Int
}

private data class KnownStringOperand(
  val value: String
) : TrackedOperand {
  override val slots: Int = 1
}

private data class UnknownOperand(
  override val slots: Int = 1
) : TrackedOperand

private class SqlOperandTrackingMethodVisitor(
  private val methodFacts: CompiledMethodFacts
) : MethodVisitor(Opcodes.ASM9) {
  private val operandStack = mutableListOf<TrackedOperand>()
  private val localOperands = mutableMapOf<Int, TrackedOperand>()
  private val controlFlowTargets = linkedSetOf<Label>()
  private val targetsWithUsableFrames = linkedSetOf<Label>()
  private var lastVisitedLabel: Label? = null

  override fun visitFrame(
    type: Int,
    numLocal: Int,
    local: Array<out Any>?,
    numStack: Int,
    stack: Array<out Any>?
  ) {
    localOperands.clear()
    operandStack.clear()
    var frameIsUsable = type == Opcodes.F_NEW
    var localIndex = 0
    local.orEmpty().take(numLocal).forEach { frameOperand ->
      val slots = frameOperandSlots(frameOperand, allowTop = true)
      if (slots == null) {
        frameIsUsable = false
      } else {
        if (frameOperand != Opcodes.TOP) {
          localOperands[localIndex] = UnknownOperand(slots)
        }
        localIndex += slots
      }
    }
    stack.orEmpty().take(numStack).forEach { frameOperand ->
      val slots = frameOperandSlots(frameOperand, allowTop = false)
      if (slots == null) {
        frameIsUsable = false
      } else {
        push(UnknownOperand(slots))
      }
    }
    if (frameIsUsable) {
      lastVisitedLabel?.let(targetsWithUsableFrames::add)
    } else {
      markUnsafe()
    }
  }

  override fun visitInsn(opcode: Int) {
    when (opcode) {
      Opcodes.NOP -> Unit
      Opcodes.ACONST_NULL,
      Opcodes.ICONST_M1,
      Opcodes.ICONST_0,
      Opcodes.ICONST_1,
      Opcodes.ICONST_2,
      Opcodes.ICONST_3,
      Opcodes.ICONST_4,
      Opcodes.ICONST_5,
      Opcodes.FCONST_0,
      Opcodes.FCONST_1,
      Opcodes.FCONST_2 -> push(UnknownOperand())
      Opcodes.LCONST_0,
      Opcodes.LCONST_1,
      Opcodes.DCONST_0,
      Opcodes.DCONST_1 -> push(UnknownOperand(2))
      Opcodes.IALOAD,
      Opcodes.FALOAD,
      Opcodes.AALOAD,
      Opcodes.BALOAD,
      Opcodes.CALOAD,
      Opcodes.SALOAD -> {
        popExpected(1)
        popExpected(1)
        push(UnknownOperand())
      }
      Opcodes.LALOAD,
      Opcodes.DALOAD -> {
        popExpected(1)
        popExpected(1)
        push(UnknownOperand(2))
      }
      Opcodes.IASTORE,
      Opcodes.FASTORE,
      Opcodes.AASTORE,
      Opcodes.BASTORE,
      Opcodes.CASTORE,
      Opcodes.SASTORE -> {
        popExpected(1)
        popExpected(1)
        popExpected(1)
      }
      Opcodes.LASTORE,
      Opcodes.DASTORE -> {
        popExpected(2)
        popExpected(1)
        popExpected(1)
      }
      Opcodes.POP -> popExpected(1)
      Opcodes.POP2 -> {
        val first = popRaw()
        when (first?.slots) {
          2 -> Unit
          1 -> {
            val second = popRaw()
            if (second?.slots != 1) markUnsafe()
          }
          else -> markUnsafe()
        }
      }
      Opcodes.DUP -> {
        val operand = operandStack.lastOrNull()
        if (operand?.slots == 1) push(operand) else markUnsafe()
      }
      Opcodes.SWAP -> {
        val first = popRaw()
        val second = popRaw()
        if (first?.slots == 1 && second?.slots == 1) {
          push(first)
          push(second)
        } else {
          markUnsafe()
        }
      }
      Opcodes.DUP_X1,
      Opcodes.DUP_X2,
      Opcodes.DUP2,
      Opcodes.DUP2_X1,
      Opcodes.DUP2_X2 -> markUnsafe()
      Opcodes.IADD,
      Opcodes.FADD,
      Opcodes.ISUB,
      Opcodes.FSUB,
      Opcodes.IMUL,
      Opcodes.FMUL,
      Opcodes.IDIV,
      Opcodes.FDIV,
      Opcodes.IREM,
      Opcodes.FREM,
      Opcodes.ISHL,
      Opcodes.ISHR,
      Opcodes.IUSHR,
      Opcodes.IAND,
      Opcodes.IOR,
      Opcodes.IXOR -> {
        popExpected(1)
        popExpected(1)
        push(UnknownOperand())
      }
      Opcodes.LADD,
      Opcodes.DADD,
      Opcodes.LSUB,
      Opcodes.DSUB,
      Opcodes.LMUL,
      Opcodes.DMUL,
      Opcodes.LDIV,
      Opcodes.DDIV,
      Opcodes.LREM,
      Opcodes.DREM,
      Opcodes.LAND,
      Opcodes.LOR,
      Opcodes.LXOR -> {
        popExpected(2)
        popExpected(2)
        push(UnknownOperand(2))
      }
      Opcodes.LSHL,
      Opcodes.LSHR,
      Opcodes.LUSHR -> {
        popExpected(1)
        popExpected(2)
        push(UnknownOperand(2))
      }
      Opcodes.INEG,
      Opcodes.FNEG -> {
        popExpected(1)
        push(UnknownOperand())
      }
      Opcodes.LNEG,
      Opcodes.DNEG -> {
        popExpected(2)
        push(UnknownOperand(2))
      }
      Opcodes.I2L,
      Opcodes.I2D,
      Opcodes.F2L,
      Opcodes.F2D -> convertOperand(fromSlots = 1, toSlots = 2)
      Opcodes.I2F,
      Opcodes.F2I,
      Opcodes.I2B,
      Opcodes.I2C,
      Opcodes.I2S -> convertOperand(fromSlots = 1, toSlots = 1)
      Opcodes.L2I,
      Opcodes.L2F,
      Opcodes.D2I,
      Opcodes.D2F -> convertOperand(fromSlots = 2, toSlots = 1)
      Opcodes.L2D,
      Opcodes.D2L -> convertOperand(fromSlots = 2, toSlots = 2)
      Opcodes.LCMP,
      Opcodes.DCMPL,
      Opcodes.DCMPG -> {
        popExpected(2)
        popExpected(2)
        push(UnknownOperand())
      }
      Opcodes.FCMPL,
      Opcodes.FCMPG -> {
        popExpected(1)
        popExpected(1)
        push(UnknownOperand())
      }
      Opcodes.IRETURN,
      Opcodes.FRETURN,
      Opcodes.ARETURN -> {
        popExpected(1)
        clearAnalysisState()
      }
      Opcodes.LRETURN,
      Opcodes.DRETURN -> {
        popExpected(2)
        clearAnalysisState()
      }
      Opcodes.RETURN -> clearAnalysisState()
      Opcodes.ARRAYLENGTH -> {
        popExpected(1)
        push(UnknownOperand())
      }
      Opcodes.ATHROW -> {
        popExpected(1)
        clearAnalysisState()
      }
      Opcodes.MONITORENTER,
      Opcodes.MONITOREXIT -> popExpected(1)
      else -> markUnsafe()
    }
  }

  override fun visitIntInsn(opcode: Int, operand: Int) {
    when (opcode) {
      Opcodes.BIPUSH,
      Opcodes.SIPUSH -> push(UnknownOperand())
      Opcodes.NEWARRAY -> {
        popExpected(1)
        push(UnknownOperand())
      }
      else -> markUnsafe()
    }
  }

  override fun visitVarInsn(opcode: Int, variable: Int) {
    when (opcode) {
      Opcodes.ILOAD,
      Opcodes.FLOAD,
      Opcodes.ALOAD -> loadLocal(variable, 1)
      Opcodes.LLOAD,
      Opcodes.DLOAD -> loadLocal(variable, 2)
      Opcodes.ISTORE,
      Opcodes.FSTORE,
      Opcodes.ASTORE -> localOperands[variable] = popExpected(1)
      Opcodes.LSTORE,
      Opcodes.DSTORE -> localOperands[variable] = popExpected(2)
      else -> markUnsafe()
    }
  }

  override fun visitTypeInsn(opcode: Int, type: String) {
    when (opcode) {
      Opcodes.NEW -> push(UnknownOperand())
      Opcodes.ANEWARRAY -> {
        popExpected(1)
        push(UnknownOperand())
      }
      Opcodes.CHECKCAST -> {
        if (operandStack.lastOrNull()?.slots != 1) markUnsafe()
      }
      Opcodes.INSTANCEOF -> {
        popExpected(1)
        push(UnknownOperand())
      }
      else -> markUnsafe()
    }
  }

  override fun visitFieldInsn(opcode: Int, owner: String, name: String, descriptor: String) {
    val fieldSlots = Type.getType(descriptor).size
    when (opcode) {
      Opcodes.GETSTATIC -> push(UnknownOperand(fieldSlots))
      Opcodes.PUTSTATIC -> popExpected(fieldSlots)
      Opcodes.GETFIELD -> {
        popExpected(1)
        push(UnknownOperand(fieldSlots))
      }
      Opcodes.PUTFIELD -> {
        popExpected(fieldSlots)
        popExpected(1)
      }
      else -> markUnsafe()
    }
  }

  override fun visitMethodInsn(
    opcode: Int,
    owner: String,
    name: String,
    descriptor: String,
    isInterface: Boolean
  ) {
    val argumentTypes = Type.getArgumentTypes(descriptor)
    val arguments = argumentTypes.indices.reversed()
      .map { argumentIndex -> popExpected(argumentTypes[argumentIndex].size) }
      .reversed()
    if (opcode !in setOf(
        Opcodes.INVOKEVIRTUAL,
        Opcodes.INVOKESPECIAL,
        Opcodes.INVOKESTATIC,
        Opcodes.INVOKEINTERFACE
      )
    ) {
      markUnsafe()
    }
    if (opcode != Opcodes.INVOKESTATIC) popExpected(1)

    val call = CompiledMethodCall(owner, name, descriptor)
    methodFacts.methodCalls += call
    if (call.isJdbcSqlSink()) {
      val sqlArgument = if (methodFacts.unsafeForSqlProof) {
        null
      } else {
        arguments.firstOrNull()
          ?.takeIf { argumentTypes.firstOrNull()?.descriptor == "Ljava/lang/String;" }
          ?.let { it as? KnownStringOperand }
          ?.value
      }
      methodFacts.sqlCalls += CompiledSqlCall(owner, name, descriptor, sqlArgument)
    }

    pushReturnValue(descriptor)
  }

  override fun visitInvokeDynamicInsn(
    name: String,
    descriptor: String,
    bootstrapMethodHandle: Handle,
    vararg bootstrapMethodArguments: Any
  ) {
    val argumentTypes = Type.getArgumentTypes(descriptor)
    argumentTypes.indices.reversed().forEach { argumentIndex ->
      popExpected(argumentTypes[argumentIndex].size)
    }
    bootstrapMethodArguments
      .filterIsInstance<String>()
      .filter(::containsDestructiveSqlSurface)
      .forEach(methodFacts.potentialSqlSurfaces::add)
    pushReturnValue(descriptor)
  }

  override fun visitJumpInsn(opcode: Int, label: Label) {
    controlFlowTargets += label
    when (opcode) {
      Opcodes.IFEQ,
      Opcodes.IFNE,
      Opcodes.IFLT,
      Opcodes.IFGE,
      Opcodes.IFGT,
      Opcodes.IFLE,
      Opcodes.IFNULL,
      Opcodes.IFNONNULL -> popExpected(1)
      Opcodes.IF_ICMPEQ,
      Opcodes.IF_ICMPNE,
      Opcodes.IF_ICMPLT,
      Opcodes.IF_ICMPGE,
      Opcodes.IF_ICMPGT,
      Opcodes.IF_ICMPLE,
      Opcodes.IF_ACMPEQ,
      Opcodes.IF_ACMPNE -> {
        popExpected(1)
        popExpected(1)
      }
      Opcodes.GOTO -> clearAnalysisState()
      else -> markUnsafe()
    }
  }

  override fun visitLabel(label: Label) {
    lastVisitedLabel = label
  }

  override fun visitTryCatchBlock(start: Label, end: Label, handler: Label, type: String?) {
    controlFlowTargets += handler
  }

  override fun visitLdcInsn(value: Any?) {
    when (value) {
      is String -> {
        methodFacts.stringConstants += value
        push(KnownStringOperand(value))
      }
      is Long,
      is Double -> push(UnknownOperand(2))
      is Int,
      is Float,
      is Type,
      is Handle -> push(UnknownOperand())
      else -> markUnsafe()
    }
  }

  override fun visitIincInsn(variable: Int, increment: Int) {
    if (localOperands[variable]?.slots == 2) markUnsafe()
    localOperands[variable] = UnknownOperand()
  }

  override fun visitTableSwitchInsn(min: Int, max: Int, defaultLabel: Label, vararg labels: Label) {
    popExpected(1)
    controlFlowTargets += defaultLabel
    controlFlowTargets += labels
    clearAnalysisState()
  }

  override fun visitLookupSwitchInsn(defaultLabel: Label, keys: IntArray, labels: Array<out Label>) {
    popExpected(1)
    controlFlowTargets += defaultLabel
    controlFlowTargets += labels
    clearAnalysisState()
  }

  override fun visitMultiANewArrayInsn(descriptor: String, numDimensions: Int) {
    repeat(numDimensions) { popExpected(1) }
    push(UnknownOperand())
  }

  override fun visitEnd() {
    if (methodFacts.sqlCalls.isNotEmpty() &&
      controlFlowTargets.any { target -> target !in targetsWithUsableFrames }
    ) {
      markUnsafe()
    }
  }

  private fun pushReturnValue(descriptor: String) {
    val returnType = Type.getReturnType(descriptor)
    if (returnType.sort != Type.VOID) push(UnknownOperand(returnType.size))
  }

  private fun convertOperand(fromSlots: Int, toSlots: Int) {
    popExpected(fromSlots)
    push(UnknownOperand(toSlots))
  }

  private fun loadLocal(variable: Int, expectedSlots: Int) {
    val operand = localOperands[variable] ?: UnknownOperand(expectedSlots)
    if (operand.slots == expectedSlots) {
      push(operand)
    } else {
      markUnsafe()
      push(UnknownOperand(expectedSlots))
    }
  }

  private fun push(operand: TrackedOperand) {
    if (operand.slots in 1..2) {
      operandStack += operand
    } else {
      markUnsafe()
    }
  }

  private fun popExpected(expectedSlots: Int): TrackedOperand {
    val operand = popRaw()
    if (operand?.slots == expectedSlots) return operand
    markUnsafe()
    return UnknownOperand(expectedSlots)
  }

  private fun popRaw(): TrackedOperand? {
    if (operandStack.isEmpty()) {
      markUnsafe()
      return null
    }
    return operandStack.removeAt(operandStack.lastIndex)
  }

  private fun markUnsafe() {
    methodFacts.unsafeForSqlProof = true
    methodFacts.sqlCalls.replaceAll { sqlCall -> sqlCall.copy(sqlArgument = null) }
    clearAnalysisState()
  }

  private fun clearAnalysisState() {
    operandStack.clear()
    localOperands.clear()
  }
}

private fun frameOperandSlots(frameOperand: Any, allowTop: Boolean): Int? = when (frameOperand) {
  Opcodes.TOP -> if (allowTop) 1 else null
  Opcodes.INTEGER,
  Opcodes.FLOAT,
  Opcodes.NULL,
  Opcodes.UNINITIALIZED_THIS -> 1
  Opcodes.LONG,
  Opcodes.DOUBLE -> 2
  is String,
  is Label -> 1
  else -> null
}

private fun tagVisitor(facts: CompiledClassFacts): AnnotationVisitor =
  object : AnnotationVisitor(Opcodes.ASM9) {
    override fun visit(name: String?, value: Any?) {
      if (name == "value" && value is String) facts.tags += value
    }
  }

private fun tagsContainerVisitor(facts: CompiledClassFacts): AnnotationVisitor =
  object : AnnotationVisitor(Opcodes.ASM9) {
    override fun visitArray(name: String?): AnnotationVisitor? =
      if (name == "value") {
        object : AnnotationVisitor(Opcodes.ASM9) {
          override fun visitAnnotation(name: String?, descriptor: String?): AnnotationVisitor? =
            if (descriptor == TAG_DESCRIPTOR) tagVisitor(facts) else null
        }
      } else {
        null
      }
  }

private fun contextConfigurationVisitor(facts: CompiledClassFacts): AnnotationVisitor =
  object : AnnotationVisitor(Opcodes.ASM9) {
    override fun visitArray(name: String?): AnnotationVisitor? =
      if (name == "initializers") {
        object : AnnotationVisitor(Opcodes.ASM9) {
          override fun visit(name: String?, value: Any?) {
            if (value is Type) facts.contextInitializers += value.internalName
          }
        }
      } else {
        null
      }
  }

private fun enabledEnvironmentVisitor(facts: CompiledClassFacts): AnnotationVisitor =
  object : AnnotationVisitor(Opcodes.ASM9) {
    private var named: String? = null
    private var matches: String? = null

    override fun visit(name: String?, value: Any?) {
      if (name == "named") named = value as? String
      if (name == "matches") matches = value as? String
    }

    override fun visitEnd() {
      facts.enabledEnvironmentConditions += EnabledEnvironmentCondition(named, matches)
    }
  }

private fun autoConfigureMockMvcVisitor(facts: CompiledClassFacts): AnnotationVisitor {
  facts.autoConfigureMockMvcPresent = true
  return object : AnnotationVisitor(Opcodes.ASM9) {
    override fun visit(name: String?, value: Any?) {
      if (name == "printOnlyOnFailure") facts.mockMvcPrintOnlyOnFailure = value as? Boolean
    }

    override fun visitEnum(name: String?, descriptor: String?, value: String?) {
      if (name == "print") facts.mockMvcPrint = value
    }
  }
}

private fun compiledDestructiveSqlCounts(classes: List<CompiledClassFacts>): DestructiveSqlCounts {
  val candidatesByClass = classes.associateWith(::compiledStringCandidates)
  fun count(pattern: Regex): Int = candidatesByClass.count { (facts, candidates) ->
    facts.hasJdbcExecutionCall() && candidates.any(pattern::containsMatchIn)
  }

  return DestructiveSqlCounts(
    truncate = count(Regex("\\bTRUNCATE\\s+TABLE\\b", RegexOption.IGNORE_CASE)),
    dropSchema = count(Regex("\\bDROP\\s+SCHEMA\\b", RegexOption.IGNORE_CASE)),
    createSchema = count(Regex("\\bCREATE\\s+SCHEMA\\b", RegexOption.IGNORE_CASE)),
    dropDatabase = count(Regex("\\bDROP\\s+DATABASE\\b", RegexOption.IGNORE_CASE)),
    dropTable = count(Regex("\\bDROP\\s+TABLE\\b", RegexOption.IGNORE_CASE)),
    dropOwned = count(Regex("\\bDROP\\s+OWNED\\b", RegexOption.IGNORE_CASE))
  )
}

private fun compiledStringCandidates(facts: CompiledClassFacts): List<String> {
  return buildList {
    addAll(facts.fieldStringConstants)
    facts.methods.forEach { method ->
      addAll(method.stringConstants)
      addAll(method.potentialSqlSurfaces)
      add(method.stringConstants.joinToString(separator = ""))
      add(method.stringConstants.joinToString(separator = " "))
    }
  }.map { candidate -> candidate.replace(Regex("\\s+"), " ").trim() }
}

private fun CompiledMethodCall.isJdbcExecutionCall(): Boolean = when {
  owner in setOf(
    "java/sql/Statement",
    "java/sql/PreparedStatement",
    "java/sql/CallableStatement"
  ) -> name.startsWith("execute") || name == "addBatch"
  owner == DemoSeedLocalSourceGuardTest.JDBC_TEMPLATE_INTERNAL_NAME ->
    name in setOf("execute", "update", "batchUpdate")
  else -> false
}

private fun CompiledMethodCall.isJdbcSqlSink(): Boolean =
  Type.getArgumentTypes(descriptor).firstOrNull()?.descriptor == "Ljava/lang/String;" &&
    (
      isJdbcExecutionCall() ||
        (owner == "java/sql/Connection" && name in setOf("prepareStatement", "prepareCall"))
      )

private fun CompiledClassFacts.hasJdbcExecutionCall(): Boolean = methodCalls.any { call ->
  call.isJdbcExecutionCall()
}

private val DELETE_FROM_PATTERN = Regex("\\bDELETE\\s+FROM\\b", RegexOption.IGNORE_CASE)
private val DESTRUCTIVE_SQL_SURFACE_PATTERNS = listOf(
  DELETE_FROM_PATTERN,
  Regex("\\bTRUNCATE\\s+TABLE\\b", RegexOption.IGNORE_CASE),
  Regex("\\bDROP\\s+SCHEMA\\b", RegexOption.IGNORE_CASE),
  Regex("\\bCREATE\\s+SCHEMA\\b", RegexOption.IGNORE_CASE),
  Regex("\\bDROP\\s+DATABASE\\b", RegexOption.IGNORE_CASE),
  Regex("\\bDROP\\s+TABLE\\b", RegexOption.IGNORE_CASE),
  Regex("\\bDROP\\s+OWNED\\b", RegexOption.IGNORE_CASE)
)
private const val JDBC_TEMPLATE_UPDATE_DESCRIPTOR = "(Ljava/lang/String;[Ljava/lang/Object;)I"

private fun containsDestructiveSqlSurface(raw: String): Boolean =
  DESTRUCTIVE_SQL_SURFACE_PATTERNS.any { pattern -> pattern.containsMatchIn(raw) }

private fun containsSqlCommentMarker(raw: String): Boolean =
  "/*" in raw || "*/" in raw || "--" in raw

private data class DeleteSqlCallFinding(
  val classInternalName: String,
  val methodName: String,
  val call: CompiledSqlCall,
  val normalizedSql: String?
)

private data class DeleteProbePolicyResult(
  val targetedProbeCount: Int,
  val exportPackProbePassed: Boolean,
  val auditEventProbePassed: Boolean,
  val unexpectedDeleteCount: Int,
  val deleteSqlInsideSupport: Int,
  val unresolvedSqlSinkCount: Int,
  val unsafeSqlMethodCount: Int,
  val sqlCommentSurfaceCount: Int,
  val violations: Set<String>
)

private fun normalizeClosedDeleteSql(raw: String): String? {
  if (containsSqlCommentMarker(raw)) return null
  var normalized = raw.trim().replace(Regex("\\s+"), " ").uppercase()
  val semicolonCount = normalized.count { it == ';' }
  if (semicolonCount > 1 || (semicolonCount == 1 && !normalized.endsWith(';'))) return null
  if (semicolonCount == 1) normalized = normalized.dropLast(1).trimEnd()
  return normalized.takeIf { ';' !in it }
}

private fun deleteSqlSurfaceCount(facts: CompiledClassFacts): Int {
  val fieldCount = facts.fieldStringConstants.count(DELETE_FROM_PATTERN::containsMatchIn)
  val methodCount = facts.methods.sumOf { method ->
    val candidates = method.stringConstants + method.potentialSqlSurfaces
    val directCount = candidates.count(DELETE_FROM_PATTERN::containsMatchIn)
    if (directCount > 0) {
      directCount
    } else {
      val joinedCandidates = listOf(
        method.stringConstants.joinToString(separator = ""),
        method.stringConstants.joinToString(separator = " ")
      )
      if (joinedCandidates.any(DELETE_FROM_PATTERN::containsMatchIn)) 1 else 0
    }
  }
  return fieldCount + methodCount
}

private fun compiledDeleteProbePolicy(
  classes: List<CompiledClassFacts>,
  allowedProbes: Map<String, String>
): DeleteProbePolicyResult {
  val supportNames = setOf(
    DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME,
    DemoSeedLocalSourceGuardTest.SUPPORT_FILE_INTERNAL_NAME
  )
  val supportClasses = classes.filter { it.internalName in supportNames }
  val deleteSqlInsideSupport = supportClasses.sumOf(::deleteSqlSurfaceCount)
  val scopedClasses = classes.filter { facts ->
    facts.tags.contains(DemoSeedLocalSourceGuardTest.DB_INTEGRATION_TAG) ||
      facts.internalName in supportNames ||
      facts.internalName in allowedProbes
  }
  val productionClasses = scopedClasses.filterNot { facts ->
    facts.internalName in supportNames ||
      facts.isScannerImplementationClass()
  }
  val surfaceCountByClass = productionClasses.associate { facts ->
    facts.internalName to deleteSqlSurfaceCount(facts)
  }
  val unresolvedSinkCountByClass = productionClasses.associate { facts ->
    facts.internalName to facts.methods.sumOf { method ->
      method.sqlCalls.count { it.sqlArgument == null }
    }
  }
  val unsafeSqlMethodCountByClass = productionClasses.associate { facts ->
    facts.internalName to facts.methods.count { method ->
      method.sqlCalls.isNotEmpty() && method.unsafeForSqlProof
    }
  }
  val sqlCommentSurfaceCountByClass = productionClasses.associate { facts ->
    facts.internalName to facts.methods.sumOf { method ->
      method.sqlCalls.count { sqlCall ->
        sqlCall.sqlArgument?.let(::containsSqlCommentMarker) == true
      }
    }
  }
  val findings = productionClasses.flatMap { facts ->
    facts.methods.flatMap { method ->
      method.sqlCalls.mapNotNull { sqlCall ->
        sqlCall.sqlArgument
          ?.takeIf(DELETE_FROM_PATTERN::containsMatchIn)
          ?.let { sqlArgument ->
          DeleteSqlCallFinding(
            classInternalName = facts.internalName,
            methodName = method.name,
            call = sqlCall,
            normalizedSql = normalizeClosedDeleteSql(sqlArgument)
          )
        }
      }
    }
  }
  fun findingMatchesExpected(finding: DeleteSqlCallFinding): Boolean =
    finding.call.owner == DemoSeedLocalSourceGuardTest.JDBC_TEMPLATE_INTERNAL_NAME &&
      finding.call.name == "update" &&
      finding.call.descriptor == JDBC_TEMPLATE_UPDATE_DESCRIPTOR &&
      finding.normalizedSql == allowedProbes[finding.classInternalName]

  val classPasses = allowedProbes.mapValues { (classInternalName, expectedSql) ->
    val classFindings = findings.filter { it.classInternalName == classInternalName }
    classFindings.size == 1 &&
      findingMatchesExpected(classFindings.single()) &&
      surfaceCountByClass[classInternalName] == 1 &&
      unresolvedSinkCountByClass[classInternalName] == 0 &&
      unsafeSqlMethodCountByClass[classInternalName] == 0 &&
      sqlCommentSurfaceCountByClass[classInternalName] == 0 &&
      classFindings.single().normalizedSql == expectedSql
  }
  val matchedFindings = findings.filter(::findingMatchesExpected)
  val extraMatchingCalls = matchedFindings.groupingBy(DeleteSqlCallFinding::classInternalName)
    .eachCount()
    .values
    .sumOf { count -> (count - 1).coerceAtLeast(0) }
  val unmatchedCalls = findings.count { !findingMatchesExpected(it) }
  val unboundDeleteSurfaces = (
    surfaceCountByClass.values.sum() - findings.size
    ).coerceAtLeast(0)
  val unexpectedDeleteCount =
    unmatchedCalls + extraMatchingCalls + unboundDeleteSurfaces
  val unresolvedSqlSinkCount = unresolvedSinkCountByClass.values.sum()
  val unsafeSqlMethodCount = unsafeSqlMethodCountByClass.values.sum()
  val sqlCommentSurfaceCount = sqlCommentSurfaceCountByClass.values.sum()
  val targetedProbeCount = classPasses.values.count { it }
  val violations = linkedSetOf<String>()
  if (targetedProbeCount != allowedProbes.size) violations += "DELETE_PROBE_INVENTORY"
  if (unexpectedDeleteCount > 0) violations += "UNEXPECTED_DELETE_OUTSIDE_SUPPORT"
  if (deleteSqlInsideSupport > 0) violations += "DELETE_SQL_INSIDE_SUPPORT"
  if (unresolvedSqlSinkCount > 0) violations += "UNRESOLVED_SQL_SINK"
  if (unsafeSqlMethodCount > 0) violations += "UNSAFE_SQL_METHOD"
  if (sqlCommentSurfaceCount > 0) violations += "SQL_COMMENT_SURFACE"

  return DeleteProbePolicyResult(
    targetedProbeCount = targetedProbeCount,
    exportPackProbePassed = classPasses[DemoSeedLocalSourceGuardTest.EXPORTS_DB_TEST_INTERNAL_NAME]
      ?: false,
    auditEventProbePassed = classPasses[DemoSeedLocalSourceGuardTest.PERSISTENCE_DB_TEST_INTERNAL_NAME]
      ?: false,
    unexpectedDeleteCount = unexpectedDeleteCount,
    deleteSqlInsideSupport = deleteSqlInsideSupport,
    unresolvedSqlSinkCount = unresolvedSqlSinkCount,
    unsafeSqlMethodCount = unsafeSqlMethodCount,
    sqlCommentSurfaceCount = sqlCommentSurfaceCount,
    violations = violations
  )
}

private fun validateSyntheticCompiledSafety(
  classes: List<CompiledClassFacts>,
  expectedDbClasses: Set<String>,
  allowedSchemaRecreateClasses: Set<String> = emptySet(),
  allowedDeleteProbes: Map<String, String> = emptyMap()
): Set<String> {
  val violations = linkedSetOf<String>()
  val dbClasses = classes.filter { it.tags.contains(DemoSeedLocalSourceGuardTest.DB_INTEGRATION_TAG) }
  if (dbClasses.map(CompiledClassFacts::simpleName).toSet() != expectedDbClasses ||
    dbClasses.size != expectedDbClasses.size
  ) {
    violations += "DB_INTEGRATION_INVENTORY"
  }
  dbClasses.forEach { facts ->
    if (facts.contextInitializers != listOf(DemoSeedLocalSourceGuardTest.GUARD_INITIALIZER_INTERNAL_NAME)) {
      violations += "MISSING_EXACT_INITIALIZER"
    }
    if (facts.enabledEnvironmentConditions != listOf(
        EnabledEnvironmentCondition(
          DemoSeedLocalSourceGuardTest.DB_TESTS_ENABLED,
          DemoSeedLocalSourceGuardTest.CASE_INSENSITIVE_TRUE_PATTERN
        )
      )
    ) {
      violations += "MISSING_EXACT_ENABLE_CONDITION"
    }
    if (!facts.calls(DemoSeedLocalSourceGuardTest.TRUNCATE_METHOD_NAME)) {
      violations += "MISSING_TRUNCATE_CALL"
    }
    if (facts.calls(DemoSeedLocalSourceGuardTest.RECREATE_SCHEMA_METHOD_NAME) &&
      facts.simpleName !in allowedSchemaRecreateClasses
    ) {
      violations += "UNAUTHORIZED_SCHEMA_RECREATE_CALL"
    }
  }
  val sql = compiledDestructiveSqlCounts(classes)
  if (sql.truncate > 0) violations += "RAW_DESTRUCTIVE_SQL_TRUNCATE"
  if (sql.dropSchema > 0) violations += "RAW_DESTRUCTIVE_SQL_DROP_SCHEMA"
  if (sql.createSchema > 0) violations += "RAW_DESTRUCTIVE_SQL_CREATE_SCHEMA"
  if (sql.dropDatabase > 0) violations += "RAW_DESTRUCTIVE_SQL_DROP_DATABASE"
  if (sql.dropTable > 0) violations += "RAW_DESTRUCTIVE_SQL_DROP_TABLE"
  if (sql.dropOwned > 0) violations += "RAW_DESTRUCTIVE_SQL_DROP_OWNED"
  violations += compiledDeleteProbePolicy(classes, allowedDeleteProbes).violations
  if (classes.any { facts ->
      facts.methodCalls.any { call ->
        call.owner == DemoSeedLocalSourceGuardTest.FLYWAY_INTERNAL_NAME && call.name == "clean"
      }
    }
  ) {
    violations += "FLYWAY_CLEAN_CALL"
  }
  return violations
}

private data class SyntheticSqlCall(
  val strings: List<String>,
  val owner: String = DemoSeedLocalSourceGuardTest.JDBC_TEMPLATE_INTERNAL_NAME,
  val name: String = "update",
  val descriptor: String = JDBC_TEMPLATE_UPDATE_DESCRIPTOR
)

private fun syntheticDbClass(
  internalName: String,
  tagged: Boolean = true,
  initializer: Boolean = true,
  enableCondition: Boolean = true,
  truncateCall: Boolean = true,
  recreateCall: Boolean = false,
  strings: List<String> = emptyList(),
  storedStrings: List<String> = emptyList(),
  fieldStrings: List<String> = emptyList(),
  jdbcCall: Boolean = false,
  sqlCalls: List<SyntheticSqlCall> = emptyList()
): ByteArray {
  val writer = ClassWriter(ClassWriter.COMPUTE_FRAMES or ClassWriter.COMPUTE_MAXS)
  writer.visit(Opcodes.V17, Opcodes.ACC_PUBLIC, internalName, null, "java/lang/Object", null)
  if (tagged) {
    writer.visitAnnotation(TAG_DESCRIPTOR, true).apply {
      visit("value", DemoSeedLocalSourceGuardTest.DB_INTEGRATION_TAG)
      visitEnd()
    }
  }
  fieldStrings.forEachIndexed { index, value ->
    writer.visitField(
      Opcodes.ACC_PRIVATE or Opcodes.ACC_STATIC or Opcodes.ACC_FINAL,
      "SQL_$index",
      "Ljava/lang/String;",
      null,
      value
    ).visitEnd()
  }
  if (initializer) {
    writer.visitAnnotation(CONTEXT_CONFIGURATION_DESCRIPTOR, true).apply {
      visitArray("initializers").apply {
        visit(null, Type.getObjectType(DemoSeedLocalSourceGuardTest.GUARD_INITIALIZER_INTERNAL_NAME))
        visitEnd()
      }
      visitEnd()
    }
  }
  if (enableCondition) {
    writer.visitAnnotation(ENABLED_ENVIRONMENT_DESCRIPTOR, true).apply {
      visit("named", DemoSeedLocalSourceGuardTest.DB_TESTS_ENABLED)
      visit("matches", DemoSeedLocalSourceGuardTest.CASE_INSENSITIVE_TRUE_PATTERN)
      visitEnd()
    }
  }
  writer.visitMethod(Opcodes.ACC_PUBLIC or Opcodes.ACC_STATIC, "exercise", "()V", null, null).apply {
    visitCode()
    strings.forEach { value ->
      visitLdcInsn(value)
      visitInsn(Opcodes.POP)
    }
    storedStrings.forEachIndexed { index, value ->
      visitLdcInsn(value)
      visitVarInsn(Opcodes.ASTORE, index)
    }
    if (truncateCall) {
      visitFieldInsn(
        Opcodes.GETSTATIC,
        DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME,
        "INSTANCE",
        "L${DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME};"
      )
      visitInsn(Opcodes.ACONST_NULL)
      visitInsn(Opcodes.ACONST_NULL)
      visitMethodInsn(
        Opcodes.INVOKEVIRTUAL,
        DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME,
        DemoSeedLocalSourceGuardTest.TRUNCATE_METHOD_NAME,
        "(Ljavax/sql/DataSource;Lorg/springframework/core/env/Environment;)V",
        false
      )
    }
    if (recreateCall) {
      visitFieldInsn(
        Opcodes.GETSTATIC,
        DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME,
        "INSTANCE",
        "L${DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME};"
      )
      visitInsn(Opcodes.ACONST_NULL)
      visitInsn(Opcodes.ACONST_NULL)
      visitMethodInsn(
        Opcodes.INVOKEVIRTUAL,
        DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME,
        DemoSeedLocalSourceGuardTest.RECREATE_SCHEMA_METHOD_NAME,
        "(Ljavax/sql/DataSource;Lorg/springframework/core/env/Environment;)V",
        false
      )
    }
    if (jdbcCall) {
      emitSyntheticSqlCall(
        SyntheticSqlCall(
          strings = listOf(strings.joinToString(separator = "")),
          owner = "java/sql/Statement",
          name = "execute",
          descriptor = "(Ljava/lang/String;)Z"
        )
      )
    }
    sqlCalls.forEach { sqlCall -> emitSyntheticSqlCall(sqlCall) }
    visitInsn(Opcodes.RETURN)
    visitMaxs(0, 0)
    visitEnd()
  }
  writer.visitEnd()
  return writer.toByteArray().also(::verifySyntheticClass)
}

private fun pop2CategoryAdversarialClass(): ByteArray =
  syntheticCustomDbClass(
    internalName = DemoSeedLocalSourceGuardTest.EXPORTS_DB_TEST_INTERNAL_NAME,
    includeRuntimeSqlMethod = true
  ) {
    visitMethodInsn(
      Opcodes.INVOKESTATIC,
      DemoSeedLocalSourceGuardTest.EXPORTS_DB_TEST_INTERNAL_NAME,
      "runtimeSql",
      "()Ljava/lang/String;",
      false
    )
    visitVarInsn(Opcodes.ASTORE, 0)
    visitLdcInsn("delete from export_pack where id = ?")
    visitVarInsn(Opcodes.ASTORE, 1)
    visitVarInsn(Opcodes.ALOAD, 0)
    visitVarInsn(Opcodes.ALOAD, 1)
    visitInsn(Opcodes.ICONST_2)
    visitInsn(Opcodes.ICONST_1)
    visitInsn(Opcodes.ISUB)
    visitInsn(Opcodes.POP2)
    visitVarInsn(Opcodes.ASTORE, 2)
    emitJdbcTemplateUpdateFromLocal(2)
  }

private fun invokeDynamicDeleteRecipeClass(): ByteArray =
  syntheticCustomDbClass("fixture/InvokeDynamicDeleteRecipe") {
    visitInsn(Opcodes.ACONST_NULL)
    visitLdcInsn("?")
    visitInvokeDynamicInsn(
      "makeConcatWithConstants",
      "(Ljava/lang/String;)Ljava/lang/String;",
      Handle(
        Opcodes.H_INVOKESTATIC,
        "java/lang/invoke/StringConcatFactory",
        "makeConcatWithConstants",
        "(Ljava/lang/invoke/MethodHandles\$Lookup;Ljava/lang/String;" +
          "Ljava/lang/invoke/MethodType;Ljava/lang/String;[Ljava/lang/Object;)" +
          "Ljava/lang/invoke/CallSite;",
        false
      ),
      "delete from tenant where id = \u0001"
    )
    visitInsn(Opcodes.ICONST_0)
    visitTypeInsn(Opcodes.ANEWARRAY, "java/lang/Object")
    visitMethodInsn(
      Opcodes.INVOKEVIRTUAL,
      DemoSeedLocalSourceGuardTest.JDBC_TEMPLATE_INTERNAL_NAME,
      "update",
      JDBC_TEMPLATE_UPDATE_DESCRIPTOR,
      false
    )
    visitInsn(Opcodes.POP)
  }

private fun branchWithoutFramesAdversarialClass(): ByteArray =
  syntheticCustomDbClass(
    internalName = DemoSeedLocalSourceGuardTest.EXPORTS_DB_TEST_INTERNAL_NAME,
    version = Opcodes.V1_5,
    computeFrames = false,
    includeRuntimeSqlMethod = true
  ) {
    visitMethodInsn(
      Opcodes.INVOKESTATIC,
      DemoSeedLocalSourceGuardTest.EXPORTS_DB_TEST_INTERNAL_NAME,
      "runtimeSql",
      "()Ljava/lang/String;",
      false
    )
    visitVarInsn(Opcodes.ASTORE, 0)
    val join = Label()
    visitInsn(Opcodes.ICONST_0)
    visitJumpInsn(Opcodes.IFEQ, join)
    visitLdcInsn("delete from export_pack where id = ?")
    visitVarInsn(Opcodes.ASTORE, 0)
    visitLabel(join)
    emitJdbcTemplateUpdateFromLocal(0)
  }

private fun runtimeBuiltSqlSinkClass(): ByteArray =
  syntheticCustomDbClass(
    internalName = "fixture/RuntimeBuiltSqlSink",
    includeRuntimeSqlMethod = true
  ) {
    visitMethodInsn(
      Opcodes.INVOKESTATIC,
      "fixture/RuntimeBuiltSqlSink",
      "runtimeSql",
      "()Ljava/lang/String;",
      false
    )
    visitVarInsn(Opcodes.ASTORE, 0)
    emitJdbcTemplateUpdateFromLocal(0)
  }

private fun syntheticCustomDbClass(
  internalName: String,
  version: Int = Opcodes.V17,
  computeFrames: Boolean = true,
  includeRuntimeSqlMethod: Boolean = false,
  exercise: MethodVisitor.() -> Unit
): ByteArray {
  val writerFlags = ClassWriter.COMPUTE_MAXS or
    if (computeFrames) ClassWriter.COMPUTE_FRAMES else 0
  val writer = ClassWriter(writerFlags)
  writer.visit(version, Opcodes.ACC_PUBLIC, internalName, null, "java/lang/Object", null)
  writer.visitAnnotation(TAG_DESCRIPTOR, true).apply {
    visit("value", DemoSeedLocalSourceGuardTest.DB_INTEGRATION_TAG)
    visitEnd()
  }
  writer.visitAnnotation(CONTEXT_CONFIGURATION_DESCRIPTOR, true).apply {
    visitArray("initializers").apply {
      visit(null, Type.getObjectType(DemoSeedLocalSourceGuardTest.GUARD_INITIALIZER_INTERNAL_NAME))
      visitEnd()
    }
    visitEnd()
  }
  writer.visitAnnotation(ENABLED_ENVIRONMENT_DESCRIPTOR, true).apply {
    visit("named", DemoSeedLocalSourceGuardTest.DB_TESTS_ENABLED)
    visit("matches", DemoSeedLocalSourceGuardTest.CASE_INSENSITIVE_TRUE_PATTERN)
    visitEnd()
  }
  if (includeRuntimeSqlMethod) {
    writer.visitMethod(
      Opcodes.ACC_PRIVATE or Opcodes.ACC_STATIC,
      "runtimeSql",
      "()Ljava/lang/String;",
      null,
      null
    ).apply {
      visitCode()
      emitRuntimeSqlFromCharArray()
      visitMaxs(0, 0)
      visitEnd()
    }
  }
  writer.visitMethod(Opcodes.ACC_PUBLIC or Opcodes.ACC_STATIC, "exercise", "()V", null, null).apply {
    visitCode()
    emitGuardedTruncateCall()
    exercise()
    visitInsn(Opcodes.RETURN)
    visitMaxs(0, 0)
    visitEnd()
  }
  writer.visitEnd()
  return writer.toByteArray().also(::verifySyntheticClass)
}

private fun MethodVisitor.emitGuardedTruncateCall() {
  visitFieldInsn(
    Opcodes.GETSTATIC,
    DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME,
    "INSTANCE",
    "L${DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME};"
  )
  visitInsn(Opcodes.ACONST_NULL)
  visitInsn(Opcodes.ACONST_NULL)
  visitMethodInsn(
    Opcodes.INVOKEVIRTUAL,
    DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME,
    DemoSeedLocalSourceGuardTest.TRUNCATE_METHOD_NAME,
    "(Ljavax/sql/DataSource;Lorg/springframework/core/env/Environment;)V",
    false
  )
}

private fun MethodVisitor.emitRuntimeSqlFromCharArray() {
  val sqlCharacters = "update tenant set active = true".toCharArray()
  emitIntegerConstant(sqlCharacters.size)
  visitIntInsn(Opcodes.NEWARRAY, Opcodes.T_CHAR)
  visitVarInsn(Opcodes.ASTORE, 0)
  sqlCharacters.forEachIndexed { index, character ->
    visitVarInsn(Opcodes.ALOAD, 0)
    emitIntegerConstant(index)
    emitIntegerConstant(character.code)
    visitInsn(Opcodes.CASTORE)
  }
  visitTypeInsn(Opcodes.NEW, "java/lang/String")
  visitInsn(Opcodes.DUP)
  visitVarInsn(Opcodes.ALOAD, 0)
  visitMethodInsn(Opcodes.INVOKESPECIAL, "java/lang/String", "<init>", "([C)V", false)
  visitInsn(Opcodes.ARETURN)
}

private fun MethodVisitor.emitIntegerConstant(value: Int) {
  when (value) {
    -1 -> visitInsn(Opcodes.ICONST_M1)
    0 -> visitInsn(Opcodes.ICONST_0)
    1 -> visitInsn(Opcodes.ICONST_1)
    2 -> visitInsn(Opcodes.ICONST_2)
    3 -> visitInsn(Opcodes.ICONST_3)
    4 -> visitInsn(Opcodes.ICONST_4)
    5 -> visitInsn(Opcodes.ICONST_5)
    in Byte.MIN_VALUE..Byte.MAX_VALUE -> visitIntInsn(Opcodes.BIPUSH, value)
    else -> visitIntInsn(Opcodes.SIPUSH, value)
  }
}

private fun MethodVisitor.emitJdbcTemplateUpdateFromLocal(localIndex: Int) {
  visitInsn(Opcodes.ACONST_NULL)
  visitVarInsn(Opcodes.ALOAD, localIndex)
  visitInsn(Opcodes.ICONST_0)
  visitTypeInsn(Opcodes.ANEWARRAY, "java/lang/Object")
  visitMethodInsn(
    Opcodes.INVOKEVIRTUAL,
    DemoSeedLocalSourceGuardTest.JDBC_TEMPLATE_INTERNAL_NAME,
    "update",
    JDBC_TEMPLATE_UPDATE_DESCRIPTOR,
    false
  )
  visitInsn(Opcodes.POP)
}

private fun MethodVisitor.emitSyntheticSqlCall(sqlCall: SyntheticSqlCall) {
  visitInsn(Opcodes.ACONST_NULL)
  Type.getArgumentTypes(sqlCall.descriptor).forEachIndexed { argumentIndex, argumentType ->
    if (argumentIndex == 0 && argumentType.descriptor == "Ljava/lang/String;") {
      emitSyntheticSqlOperand(sqlCall.strings)
    } else {
      emitDefaultOperand(argumentType)
    }
  }
  val isInterface = sqlCall.owner.startsWith("java/sql/")
  visitMethodInsn(
    if (isInterface) Opcodes.INVOKEINTERFACE else Opcodes.INVOKEVIRTUAL,
    sqlCall.owner,
    sqlCall.name,
    sqlCall.descriptor,
    isInterface
  )
  Type.getReturnType(sqlCall.descriptor).let { returnType ->
    if (returnType.sort != Type.VOID) {
      visitInsn(if (returnType.size == 2) Opcodes.POP2 else Opcodes.POP)
    }
  }
}

private fun MethodVisitor.emitSyntheticSqlOperand(strings: List<String>) {
  when (strings.size) {
    0 -> visitInsn(Opcodes.ACONST_NULL)
    1 -> visitLdcInsn(strings.single())
    else -> {
      visitTypeInsn(Opcodes.NEW, "java/lang/StringBuilder")
      visitInsn(Opcodes.DUP)
      visitMethodInsn(Opcodes.INVOKESPECIAL, "java/lang/StringBuilder", "<init>", "()V", false)
      strings.forEach { fragment ->
        visitLdcInsn(fragment)
        visitMethodInsn(
          Opcodes.INVOKEVIRTUAL,
          "java/lang/StringBuilder",
          "append",
          "(Ljava/lang/String;)Ljava/lang/StringBuilder;",
          false
        )
      }
      visitMethodInsn(
        Opcodes.INVOKEVIRTUAL,
        "java/lang/StringBuilder",
        "toString",
        "()Ljava/lang/String;",
        false
      )
    }
  }
}

private fun MethodVisitor.emitDefaultOperand(type: Type) {
  when (type.sort) {
    Type.BOOLEAN,
    Type.BYTE,
    Type.CHAR,
    Type.SHORT,
    Type.INT -> visitInsn(Opcodes.ICONST_0)
    Type.FLOAT -> visitInsn(Opcodes.FCONST_0)
    Type.LONG -> visitInsn(Opcodes.LCONST_0)
    Type.DOUBLE -> visitInsn(Opcodes.DCONST_0)
    else -> visitInsn(Opcodes.ACONST_NULL)
  }
}

private fun verifySyntheticClass(bytes: ByteArray) {
  val verifier = object : ClassLoader(DemoSeedLocalSourceGuardTest::class.java.classLoader) {
    fun defineAndResolve(): Class<*> =
      defineClass(null, bytes, 0, bytes.size).also(::resolveClass)
  }
  verifier.defineAndResolve().declaredMethods
}

private data class JdbcOptions(
  val metadataUrl: String = DemoSeedLocalSourceGuardTest.EXPECTED_JDBC_URL,
  val metadataUsername: String = DemoSeedLocalSourceGuardTest.EXPECTED_ROLE,
  val database: String? = "ritomer_043b_test",
  val currentUser: String? = DemoSeedLocalSourceGuardTest.EXPECTED_ROLE,
  val sessionUser: String? = DemoSeedLocalSourceGuardTest.EXPECTED_ROLE,
  val serverAddress: String? = "127.0.0.1",
  val serverPort: String? = "5432",
  val dangerousPrivilegeIndex: Int? = null,
  val explicitMembershipCount: String? = "0",
  val databaseOwner: String? = DemoSeedLocalSourceGuardTest.EXPECTED_ROLE,
  val publicSchemaOwner: String? = DemoSeedLocalSourceGuardTest.EXPECTED_ROLE,
  val connectionFailure: SQLException? = null,
  val selectFailureIndex: Int? = null,
  val selectFailure: SQLException? = null,
  val destructiveFailure: SQLException? = null,
  val rollbackFailure: SQLException? = null
)

private data class JdbcState(
  var acquisitionCount: Int = 0,
  var queryCount: Int = 0,
  var executeCount: Int = 0,
  var commitCount: Int = 0,
  var rollbackCount: Int = 0,
  var closeCount: Int = 0,
  var autoCommit: Boolean = true,
  val events: MutableList<String> = mutableListOf(),
  val queriedSql: MutableList<String> = mutableListOf(),
  val destructiveSql: MutableList<String> = mutableListOf()
)

private data class JdbcFixture(
  val dataSource: DataSource,
  val state: JdbcState,
  val options: JdbcOptions
)

private fun canonicalEnvironment(
  processOverrides: Map<String, String?> = emptyMap(),
  springOverrides: Map<String, String> = emptyMap(),
  systemOverrides: Map<String, String> = emptyMap()
): MockEnvironment {
  val processValues = mutableMapOf<String, Any>(
    DemoSeedLocalSourceGuardTest.DB_TESTS_ENABLED to "true",
    DemoSeedLocalSourceGuardTest.DB_TEST_JDBC_URL to DemoSeedLocalSourceGuardTest.EXPECTED_JDBC_URL,
    DemoSeedLocalSourceGuardTest.DB_TEST_USERNAME to DemoSeedLocalSourceGuardTest.EXPECTED_ROLE,
    DemoSeedLocalSourceGuardTest.DB_TEST_PASSWORD to DemoSeedLocalSourceGuardTest.SYNTHETIC_PASSWORD,
    DemoSeedLocalSourceGuardTest.DESTRUCTIVE_CONSENT to "TRUNCATE_RITOMER_043B_TEST"
  )
  processOverrides.forEach { (name, value) ->
    if (value == null) processValues.remove(name) else processValues[name] = value
  }

  val systemValues: Map<String, Any> = systemOverrides
  return MockEnvironment().apply {
    propertySources.replaceOrAdd(
      StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME,
      MapPropertySource(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME, processValues)
    )
    propertySources.replaceOrAdd(
      StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME,
      MapPropertySource(
        StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME,
        systemValues
      )
    )
    setProperty(
      DemoSeedLocalSourceGuardTest.DATASOURCE_URL,
      springOverrides[DemoSeedLocalSourceGuardTest.DATASOURCE_URL]
        ?: DemoSeedLocalSourceGuardTest.EXPECTED_JDBC_URL
    )
    setProperty(
      DemoSeedLocalSourceGuardTest.DATASOURCE_USERNAME,
      springOverrides[DemoSeedLocalSourceGuardTest.DATASOURCE_USERNAME]
        ?: DemoSeedLocalSourceGuardTest.EXPECTED_ROLE
    )
    setProperty(
      DemoSeedLocalSourceGuardTest.DATASOURCE_PASSWORD,
      springOverrides[DemoSeedLocalSourceGuardTest.DATASOURCE_PASSWORD]
        ?: DemoSeedLocalSourceGuardTest.SYNTHETIC_PASSWORD
    )
  }
}

private fun org.springframework.core.env.MutablePropertySources.replaceOrAdd(
  name: String,
  source: MapPropertySource
) {
  if (contains(name)) replace(name, source) else addLast(source)
}

private fun jdbcFixture(options: JdbcOptions = JdbcOptions()): JdbcFixture {
  val state = JdbcState()
  lateinit var connection: Connection

  val metadata = proxy<DatabaseMetaData> { method, _ ->
    when (method.name) {
      "getURL" -> options.metadataUrl
      "getUserName" -> options.metadataUsername
      else -> defaultProxyValue(method)
    }
  }

  val statement = proxy<Statement> { method, arguments ->
    when (method.name) {
      "executeQuery" -> {
        state.queryCount += 1
        state.events += "query"
        val rawSql = arguments?.get(0).toString()
        state.queriedSql += rawSql
        if (options.selectFailureIndex == state.queryCount) {
          throw options.selectFailure ?: SQLException("synthetic SELECT failure")
        }
        val sql = rawSql.lowercase()
        when {
          sql.contains("current_database()") -> resultSet(
            listOf(
              options.database,
              options.currentUser,
              options.sessionUser,
              options.serverAddress,
              options.serverPort
            )
          )
          sql.contains("pg_auth_members") -> resultSet(listOf(options.explicitMembershipCount))
          sql.contains("from pg_roles") -> resultSet(
            (0..4).map { index -> index == options.dangerousPrivilegeIndex }
          )
          sql.contains("from pg_database") -> resultSet(
            listOf(options.databaseOwner, options.publicSchemaOwner)
          )
          else -> throw SQLException("unexpected synthetic query")
        }
      }
      "execute" -> {
        state.executeCount += 1
        state.events += "execute"
        state.destructiveSql += arguments?.get(0).toString()
        options.destructiveFailure?.let { throw it }
        false
      }
      else -> defaultProxyValue(method)
    }
  }

  connection = proxy { method, arguments ->
    when (method.name) {
      "getAutoCommit" -> state.autoCommit
      "setAutoCommit" -> {
        state.autoCommit = arguments?.get(0) as Boolean
        null
      }
      "getMetaData" -> metadata
      "createStatement" -> statement
      "commit" -> {
        state.commitCount += 1
        state.events += "commit"
        null
      }
      "rollback" -> {
        state.rollbackCount += 1
        state.events += "rollback"
        options.rollbackFailure?.let { throw it }
        null
      }
      "close" -> {
        state.closeCount += 1
        null
      }
      "isClosed" -> state.closeCount > 0
      else -> defaultProxyValue(method)
    }
  }

  val dataSource = proxy<DataSource> { method, _ ->
    when (method.name) {
      "getConnection" -> {
        state.acquisitionCount += 1
        options.connectionFailure?.let { throw it }
        connection
      }
      else -> defaultProxyValue(method)
    }
  }
  return JdbcFixture(dataSource, state, options)
}

private fun resultSet(row: List<Any?>): ResultSet {
  var cursor = -1
  var lastWasNull = false
  return proxy { method, arguments ->
    when (method.name) {
      "next" -> {
        cursor += 1
        cursor == 0
      }
      "getString" -> {
        val value = row[(arguments?.get(0) as Int) - 1]
        lastWasNull = value == null
        value?.toString()
      }
      "getBoolean" -> {
        val value = row[(arguments?.get(0) as Int) - 1]
        lastWasNull = value == null
        value as? Boolean ?: false
      }
      "wasNull" -> lastWasNull
      else -> defaultProxyValue(method)
    }
  }
}

private inline fun <reified T> proxy(
  crossinline invocation: (Method, Array<out Any?>?) -> Any?
): T = Proxy.newProxyInstance(
  T::class.java.classLoader,
  arrayOf(T::class.java),
  InvocationHandler { proxy, method, arguments ->
    when (method.name) {
      "toString" -> "Synthetic${T::class.java.simpleName}Double"
      "hashCode" -> System.identityHashCode(proxy)
      "equals" -> proxy === arguments?.get(0)
      else -> invocation(method, arguments)
    }
  }
) as T

private fun defaultProxyValue(method: Method): Any? = when (method.returnType) {
  java.lang.Boolean.TYPE -> false
  java.lang.Byte.TYPE -> 0.toByte()
  java.lang.Short.TYPE -> 0.toShort()
  java.lang.Integer.TYPE -> 0
  java.lang.Long.TYPE -> 0L
  java.lang.Float.TYPE -> 0F
  java.lang.Double.TYPE -> 0.0
  java.lang.Character.TYPE -> '\u0000'
  else -> null
}
