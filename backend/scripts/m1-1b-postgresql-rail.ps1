[CmdletBinding()]
param(
  [ValidateSet('Preflight', 'Lifecycle')]
  [string]$Mode,

  [ValidateSet('B', 'D', 'M12')]
  [string]$Campaign = 'B',

  [ValidateSet('Run', 'CleanupOnly')]
  [string]$LifecycleAction = 'Run',

  [ValidatePattern('^[0-9a-f]{32}$')]
  [string]$RunId,

  [ValidatePattern('^[0-9a-f]{64}$')]
  [string]$ReviewedObjectSha256,

  [ValidatePattern('^[0-9a-f]{64}$')]
  [string]$ExpectedPsqlSha256,

  [string]$RunRoot,

  [ValidatePattern('^[A-Z0-9][A-Z0-9._:-]{0,127}$')]
  [string]$SensitiveAuthorizationRecordId,

  [ValidatePattern('^[A-Z0-9][A-Z0-9._:-]{0,127}$')]
  [string]$PreflightAuthorizationRecordId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[void][System.Reflection.Assembly]::Load(
  'System.Runtime.Serialization, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089'
)

$script:PsqlExeExact = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
$script:GitExeExact = 'C:\Program Files\Git\cmd\git.exe'
$script:PsqlConnectionExact = 'hostaddr=127.0.0.1 port=15432 dbname=postgres user=postgres connect_timeout=5 sslmode=disable gssencmode=disable require_auth=scram-sha-256 application_name=ritomer_m1b_admin_rail'
$script:PsqlArgumentsExact = @(
  '-X',
  '-W',
  '-q',
  '-A',
  '-t',
  '--set=ON_ERROR_STOP=1',
  '--set=VERBOSITY=terse',
  '--dbname',
  $script:PsqlConnectionExact
)
$script:TargetDatabase = 'ritomer_043b_test'
$script:TargetRunnerRole = 'ritomer_043b_test_runner'
$script:TargetJdbcUrl = 'jdbc:postgresql://127.0.0.1:15432/ritomer_043b_test'
$script:DestructiveConsent = 'TRUNCATE_RITOMER_043B_TEST'
$script:EvidenceBaseRoot = 'C:\dev\ritomer-local-evidence\m1-1b-postgresql'
$script:ExpectedBranch = 'feat/m1-1b-backend-session-kernel'
$script:ExpectedHead = '5ad31ed828487bed88de524231b0c7f43984cac1'
$script:CorrectiveFileSetSummary = 'A2_M4_R0_D0_TOTAL6'
$script:CompositeFileSetSummary = 'A8_M17_R0_D0_TOTAL25'
$script:CorrectiveFileSet = @(
  'backend/scripts/m1-1b-postgresql-rail.ps1',
  'backend/build.gradle.kts',
  'backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/PostgresTestRailLifecycleCommand.kt',
  'backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt',
  'runbooks/local-dev.md',
  'specs/active/046-authenticated-session-foundation-v1.md'
)
$script:ExpectedAddedFileSet = @(
  'backend/scripts/m1-1b-postgresql-rail.ps1',
  'backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/SessionController.kt',
  'backend/src/main/kotlin/ch/qamwaq/ritomer/identity/application/SessionAuthenticationService.kt',
  'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SessionSecurityKernel.kt',
  'backend/src/test/kotlin/ch/qamwaq/ritomer/identity/api/LocalTestSessionControllerSecurityTest.kt',
  'backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/PostgresTestRailLifecycleCommand.kt',
  'contracts/openapi/auth-session-api.yaml',
  'docs/adr/0007-authenticated-session-boundary.md'
)
$script:CompositeFileSet = @(
  'backend/build.gradle.kts',
  'backend/scripts/m1-1b-postgresql-rail.ps1',
  'backend/src/main/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalService.kt',
  'backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/SessionController.kt',
  'backend/src/main/kotlin/ch/qamwaq/ritomer/identity/application/SessionAuthenticationService.kt',
  'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityConfig.kt',
  'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SessionSecurityKernel.kt',
  'backend/src/main/resources/application-dbtest.yml',
  'backend/src/main/resources/application.yml',
  'backend/src/test/kotlin/ch/qamwaq/ritomer/DocumentsDbIntegrationTest.kt',
  'backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalAuthMeDbIntegrationTest.kt',
  'backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalDbIntegrationTest.kt',
  'backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt',
  'backend/src/test/kotlin/ch/qamwaq/ritomer/identity/api/LocalTestSessionControllerSecurityTest.kt',
  'backend/src/test/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityConfigJwtValidationTest.kt',
  'backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseSupport.kt',
  'backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/PostgresTestRailLifecycleCommand.kt',
  'contracts/openapi/auth-session-api.yaml',
  'docs/adr/0007-authenticated-session-boundary.md',
  'docs/present/ai-cadrage-v1.md',
  'docs/present/architecture-cadrage-v1.md',
  'docs/present/ux-cadrage-v1.md',
  'docs/product/v1-plan.md',
  'runbooks/local-dev.md',
  'specs/active/046-authenticated-session-foundation-v1.md'
)
$script:BackendRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$script:RepoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $script:BackendRoot))
$script:DCampaignClock = $null
$script:DPhaseDeadline = 0L
$script:DPhase = ''
$script:DRunRoot = $null
$script:DExpectedPostmasterStart = $null
$script:DChildren = @{}
$script:DCookieDiagnostic = $null
$script:DBrowserDiagnostic = $null
$script:DHarnessDiagnostic = $null
$script:DReadinessCacheVerifiedState = $null
$script:DQuarantinePath = $script:EvidenceBaseRoot + '\.m1d-unreleased.json'
$script:DPhaseMinutes = [ordered]@{
  readiness = 30; provision = 5; seed = 5; backend = 2; integration = 60
  stop = 1; targeted = 20; full = 20; cleanup = 5; controls = 7
}
if ($Campaign -ceq 'D') {
  $script:ExpectedBranch = 'codex/m1-1d-playwright-integration'
  $script:ExpectedHead = 'c7857e3180f4ba02c49f6713ecedba3f7d3eb7c5'
  $script:CorrectiveFileSetSummary = 'A4_M7_R0_D0_TOTAL11'
  $script:CompositeFileSetSummary = 'A4_M33_R0_D0_TOTAL37'
  $script:ExpectedAddedFileSet = @(
    'frontend/e2e/m1d/playwright.config.ts',
    'frontend/e2e/m1d/session.spec.ts',
    'frontend/e2e/m1d/evidence.ts',
    'frontend/m1d-browser-evidence.test.ts'
  )
  $script:CompositeFileSet = @(
    'frontend/e2e/m1d/playwright.config.ts',
    'frontend/e2e/m1d/session.spec.ts',
    'frontend/e2e/m1d/evidence.ts',
    'frontend/m1d-browser-evidence.test.ts',
    'frontend/src/lib/api/session.ts',
    'frontend/src/lib/api/session.test.ts',
    'frontend/playwright.config.ts',
    'frontend/vite.config.ts',
    'frontend/local-demo-proxy.test.ts',
    'frontend/local-two-actor-harness.mjs',
    'frontend/local-two-actor-harness.test.ts',
    'backend/src/main/resources/application-local.yml',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/SessionController.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/identity/api/LocalTestSessionControllerSecurityTest.kt',
    'README.md',
    'runbooks/local-dev.md',
    'docs/product/v1-plan.md',
    'docs/present/architecture-cadrage-v1.md',
    'docs/present/ux-cadrage-v1.md',
    'contracts/openapi/mapping-suggestions-api.yaml',
    'contracts/openapi/mapping-suggestions-v2-api.yaml',
    'contracts/openapi/closing-folders-api.yaml',
    'contracts/openapi/import-balance-api.yaml',
    'contracts/openapi/manual-mapping-api.yaml',
    'contracts/openapi/workpapers-api.yaml',
    'contracts/openapi/documents-api.yaml',
    'contracts/openapi/exports-api.yaml',
    'docs/product/product-roadmap.md',
    'backend/.env.example',
    'docs/present/ai-cadrage-v1.md',
    'backend/scripts/m1-1b-postgresql-rail.ps1',
    'backend/build.gradle.kts',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt',
    'docs/ui/ui-foundations-v1.md',
    'specs/active/046-authenticated-session-foundation-v1.md',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/PostgresTestRailLifecycleCommand.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseSupport.kt'
  )
  $script:CorrectiveFileSet = @(
    'frontend/e2e/m1d/playwright.config.ts',
    'frontend/e2e/m1d/session.spec.ts',
    'frontend/e2e/m1d/evidence.ts',
    'frontend/m1d-browser-evidence.test.ts',
    'frontend/src/lib/api/session.ts',
    'frontend/src/lib/api/session.test.ts',
    'frontend/playwright.config.ts',
    'backend/scripts/m1-1b-postgresql-rail.ps1',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt',
    'runbooks/local-dev.md',
    'specs/active/046-authenticated-session-foundation-v1.md'
  )
}

if ($Campaign -ceq 'M12') {
  $script:ExpectedBranch = 'codex/m1-2-local-oidc-session'
  $script:ExpectedHead = '21564039f27be647e59023007682882701a40bf5'
  $script:CorrectiveFileSetSummary = 'A1_M16_R0_D0_TOTAL17'
  $script:CompositeFileSetSummary = 'A22_M27_R0_D0_TOTAL49'
  $script:ExpectedAddedFileSet = @(
    'backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/SharedSessionController.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/identity/application/OidcIdentityRepository.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/identity/application/OidcSessionAuthenticationService.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/identity/infrastructure/persistence/JdbcOidcIdentityRepository.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/application/OidcActorAdmission.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/GoogleOidcAuthenticationConfiguration.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SharedSessionBoundaryFilter.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SharedSessionSecurityConfiguration.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/web/SharedFrontendController.kt',
    'backend/src/main/resources/application-shared-internal.yml',
    'backend/src/main/resources/db/migration/V11__m1_2_oidc_identity_and_jdbc_sessions.sql',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/SharedOidcSessionDbIntegrationTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/identity/api/SharedOidcSessionSecurityTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/identity/application/OidcSessionAuthenticationServiceTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/JdbcSessionConfigurationTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SharedSessionBoundaryTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/shared/infrastructure/web/SharedFrontendControllerTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/PostgresTestRailM12Process.kt',
    'contracts/db/shared-oidc-session-v1.md',
    'docs/adr/0008-shared-google-oidc-jdbc-session.md',
    'runbooks/m1-2-shared-nonproduction.md',
    'specs/active/047-shared-oidc-session-v1.md'
  )
  $script:CompositeFileSet = @(
    'README.md',
    'backend/.env.example',
    'backend/build.gradle.kts',
    'backend/scripts/m1-1b-postgresql-rail.ps1',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/SharedSessionController.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/identity/application/ActorResolutionSupport.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/identity/application/OidcIdentityRepository.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/identity/application/OidcSessionAuthenticationService.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/identity/infrastructure/persistence/JdbcOidcIdentityRepository.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/application/AuthenticatedActor.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/application/OidcActorAdmission.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/GoogleOidcAuthenticationConfiguration.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityConfig.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SessionSecurityKernel.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SharedSessionBoundaryFilter.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SharedSessionSecurityConfiguration.kt',
    'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/web/SharedFrontendController.kt',
    'backend/src/main/resources/application-shared-internal.yml',
    'backend/src/main/resources/application-test.yml',
    'backend/src/main/resources/application.yml',
    'backend/src/main/resources/db/migration/V11__m1_2_oidc_identity_and_jdbc_sessions.sql',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/BackendApplicationSmokeTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/DocumentsDbIntegrationTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/ExportsDbIntegrationTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/SharedOidcSessionDbIntegrationTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/WorkpapersDbIntegrationTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/identity/api/LocalTestSessionControllerSecurityTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/identity/api/SharedOidcSessionSecurityTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/identity/application/OidcSessionAuthenticationServiceTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/JdbcSessionConfigurationTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SharedSessionBoundaryTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/shared/infrastructure/web/SharedFrontendControllerTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseSupport.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/PostgresTestRailM12Process.kt',
    'contracts/db/shared-oidc-session-v1.md',
    'contracts/openapi/auth-session-api.yaml',
    'docs/adr/0008-shared-google-oidc-jdbc-session.md',
    'docs/present/architecture-cadrage-v1.md',
    'docs/present/ux-cadrage-v1.md',
    'docs/product/v1-plan.md',
    'docs/ui/ui-foundations-v1.md',
    'frontend/src/app/router.test.tsx',
    'frontend/src/app/router.tsx',
    'frontend/src/lib/api/session.test.ts',
    'frontend/src/lib/api/session.ts',
    'runbooks/local-dev.md',
    'runbooks/m1-2-shared-nonproduction.md',
    'specs/active/047-shared-oidc-session-v1.md'
  )
  $script:CorrectiveFileSet = @(
    'backend/build.gradle.kts',
    'backend/scripts/m1-1b-postgresql-rail.ps1',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseSupport.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/SharedOidcSessionDbIntegrationTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/DocumentsDbIntegrationTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/ExportsDbIntegrationTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/WorkpapersDbIntegrationTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/identity/api/SharedOidcSessionSecurityTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/JdbcSessionConfigurationTest.kt',
    'backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/PostgresTestRailM12Process.kt',
    'specs/active/047-shared-oidc-session-v1.md',
    'contracts/db/shared-oidc-session-v1.md',
    'runbooks/m1-2-shared-nonproduction.md',
    'runbooks/local-dev.md',
    'docs/present/architecture-cadrage-v1.md',
    'docs/product/v1-plan.md'
  )
  $script:DQuarantinePath = $script:EvidenceBaseRoot + '\.m12-unreleased.json'
  $script:DPhaseMinutes = [ordered]@{ readiness = 30; provision = 5; targeted = 20; full = 20; qualification = 28; stop = 1; cleanup = 5; controls = 1 }
}

function Stop-M1BRail {
  param([Parameter(Mandatory = $true)][string]$Code)

  throw [System.InvalidOperationException]::new(('RITOMER_M1B_CONTROLLED_STOP::' + $Code))
}

function Get-M1BStopCode {
  param([Parameter(Mandatory = $true)][System.Management.Automation.ErrorRecord]$ErrorRecord)

  $prefix = 'RITOMER_M1B_CONTROLLED_STOP::'
  $exception = $ErrorRecord.Exception
  while ($null -ne $exception) {
    $message = [string]$exception.Message
    if ($message.StartsWith($prefix, [System.StringComparison]::Ordinal)) {
      $code = $message.Substring($prefix.Length)
      if ($code -cmatch '^[A-Z][A-Z0-9_]{2,127}$') {
        return $code
      }
    }
    $exception = $exception.InnerException
  }
  return 'UNEXPECTED_FAILURE'
}

function Get-M1BUtf8 {
  return [System.Text.UTF8Encoding]::new($false, $true)
}

function Get-M1BSha256Bytes {
  param(
    [Parameter(Mandatory = $true)]
    [AllowEmptyCollection()]
    [byte[]]$Bytes
  )

  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($algorithm.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant()
  } finally {
    $algorithm.Dispose()
  }
}

function Get-M1BSha256File {
  param([Parameter(Mandatory = $true)][string]$Path)

  $stream = [System.IO.File]::OpenRead($Path)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
  } finally {
    $algorithm.Dispose()
    $stream.Dispose()
  }
}

function ConvertTo-M1BRunnerArtifactIoPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  # Scanner and D runtime reader: validate canonical spelling before adding an IO namespace.
  # Do not use GetFullPath to silently resolve dot segments, device names or ADS.
  if ($Path -match '[\x00-\x1f/]' -or $Path -match '^\\\\[?.]\\|^\\\?\?\\') {
    Stop-M1BRail 'RUNNER_ARTIFACT_PATH_INVALID'
  }
  if ($Path -match '^[A-Za-z]:\\') {
    $components = $Path.Substring(3).Split([char]'\')
    if ($Path.Length -eq 3) { $components = @() }
    $ioPath = '\\?\' + $Path
  } elseif ($Path -match '^\\\\[^\\]+\\[^\\]+') {
    $components = $Path.Substring(2).Split([char]'\')
    $ioPath = '\\?\UNC\' + $Path.Substring(2)
  } else {
    Stop-M1BRail 'RUNNER_ARTIFACT_PATH_INVALID'
  }
  foreach ($component in $components) {
    if (
      [string]::IsNullOrEmpty($component) -or $component -in @('.', '..') -or
      $component -match '[<>:"|?*]' -or $component -match '[. ]$' -or
      $component -match '^(CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[0-9\u00b9\u00b2\u00b3]|LPT[0-9\u00b9\u00b2\u00b3])(\.|$)'
    ) {
      Stop-M1BRail 'RUNNER_ARTIFACT_PATH_INVALID'
    }
  }
  return $ioPath
}

function Assert-M1BRunnerSecretAbsentFromTree {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [ValidateLength(16, 256)][Parameter(Mandatory = $true)][string]$Literal
  )

  $needle = $null
  try {
    [void](ConvertTo-M1BRunnerArtifactIoPath $Root)
    [void](ConvertTo-M1BRunnerArtifactIoPath $script:EvidenceBaseRoot)
    # Both inputs are already canonical; confinement never receives an IO prefix.
    $rootFull = $Root
    $basePrefix = $script:EvidenceBaseRoot.TrimEnd('\') + '\'
    $rootPrefix = $rootFull.TrimEnd('\') + '\'
    if (-not $rootFull.StartsWith($basePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      Stop-M1BRail 'PATH_ESCAPES_RUN_ROOT'
    }
    Assert-M1BNoReparseAncestors $rootFull -RunnerArtifactScan
    Initialize-M1BContainedProcessType
    $needle = (Get-M1BUtf8).GetBytes($Literal)
    $directories = [System.Collections.Generic.Stack[string]]::new()
    $contaminatedFiles = [System.Collections.Generic.List[string]]::new()
    $directories.Push($rootFull)
    $fileCount = 0
    $totalBytes = 0L
    while ($directories.Count -gt 0) {
      $directory = $directories.Pop()
      Assert-M1BNoReparseAncestors $directory -RunnerArtifactScan
      $directoryIoPath = ConvertTo-M1BRunnerArtifactIoPath $directory
      foreach ($enumeratedIoPath in [System.IO.Directory]::EnumerateFileSystemEntries($directoryIoPath)) {
        # Only the namespace returned by our own enumeration is removed here.
        if ($enumeratedIoPath.StartsWith('\\?\UNC\', [System.StringComparison]::OrdinalIgnoreCase)) {
          $entry = '\\' + $enumeratedIoPath.Substring(8)
        } elseif ($enumeratedIoPath.StartsWith('\\?\', [System.StringComparison]::Ordinal)) {
          $entry = $enumeratedIoPath.Substring(4)
        } else {
          Stop-M1BRail 'RUNNER_ARTIFACT_PATH_INVALID'
        }
        $entryIoPath = ConvertTo-M1BRunnerArtifactIoPath $entry
        if (-not $entry.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
          Stop-M1BRail 'PATH_ESCAPES_RUN_ROOT'
        }
        Assert-M1BNoReparseAncestors $directory -RunnerArtifactScan
        $attributes = [System.IO.File]::GetAttributes($entryIoPath)
        if (($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
          Stop-M1BRail 'RUNNER_ARTIFACT_REPARSE_POINT_REJECTED'
        }
        Assert-M1BNoReparseAncestors $entry -RunnerArtifactScan
        if (($attributes -band [System.IO.FileAttributes]::Directory) -ne 0) {
          $directories.Push($entry)
          continue
        }
        $fileCount++
        if ($fileCount -gt 100000) { Stop-M1BRail 'RUNNER_ARTIFACT_FILE_COUNT_EXCEEDED' }
        $length = [long]([System.IO.FileInfo]::new($entryIoPath)).Length
        if ($length -gt 536870912) { Stop-M1BRail 'RUNNER_ARTIFACT_FILE_SIZE_EXCEEDED' }
        $totalBytes += $length
        if ($totalBytes -gt 4294967296) { Stop-M1BRail 'RUNNER_ARTIFACT_TOTAL_SIZE_EXCEEDED' }
        $contaminated = [Ritomer.M1B.ContainedProcess]::FileContainsSequence(
          $entryIoPath,
          $needle,
          536870912
        )
        if ($contaminated) { $contaminatedFiles.Add($entry) }
      }
      Assert-M1BNoReparseAncestors $directory -RunnerArtifactScan
    }
    if ($contaminatedFiles.Count -gt 0) {
      $deleteFailed = $false
      foreach ($path in $contaminatedFiles) {
        $deleteIoPath = ConvertTo-M1BRunnerArtifactIoPath $path
        if (-not $path.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
          Stop-M1BRail 'PATH_ESCAPES_RUN_ROOT'
        }
        Assert-M1BNoReparseAncestors $path -RunnerArtifactScan
        try {
          [System.IO.File]::Delete($deleteIoPath)
        } catch {
          if ((Get-M1BStopCode $_) -cne 'UNEXPECTED_FAILURE') { throw }
          $deleteFailed = $true
        }
      }
      if ($deleteFailed) { Stop-M1BRail 'RUNNER_SECRET_ARTIFACT_DELETE_FAILED' }
      Stop-M1BRail 'RUNNER_SECRET_ARTIFACT_CONTAMINATION'
    }
  } catch {
    if ((Get-M1BStopCode $_) -cne 'UNEXPECTED_FAILURE') { throw }
    Stop-M1BRail 'RUNNER_ARTIFACT_SCAN_FAILED'
  } finally {
    if ($null -ne $needle) { [System.Array]::Clear($needle, 0, $needle.Length) }
  }
}

function ConvertTo-M1BProcessArgument {
  param([AllowEmptyString()][Parameter(Mandatory = $true)][string]$Value)

  if ($Value.Length -gt 0 -and $Value -notmatch '[\s"]') {
    return $Value
  }
  $builder = [System.Text.StringBuilder]::new()
  [void]$builder.Append('"')
  $backslashes = 0
  foreach ($character in $Value.ToCharArray()) {
    if ($character -eq '\') {
      $backslashes++
    } elseif ($character -eq '"') {
      [void]$builder.Append(('\' * (($backslashes * 2) + 1)))
      [void]$builder.Append('"')
      $backslashes = 0
    } else {
      if ($backslashes -gt 0) {
        [void]$builder.Append(('\' * $backslashes))
        $backslashes = 0
      }
      [void]$builder.Append($character)
    }
  }
  if ($backslashes -gt 0) {
    [void]$builder.Append(('\' * ($backslashes * 2)))
  }
  [void]$builder.Append('"')
  return $builder.ToString()
}

function Assert-M1BNoCredentialChannels {
  $explicitLibpqChannels = @(
    'PGPASSWORD',
    'PGPASSFILE',
    'PGSERVICE',
    'PGSERVICEFILE',
    'PGOPTIONS',
    'PGHOST',
    'PGHOSTADDR',
    'PGPORT',
    'PGDATABASE',
    'PGUSER'
  )
  $presentNames = [System.Environment]::GetEnvironmentVariables().Keys | ForEach-Object { [string]$_ }
  $forbiddenNames = @($presentNames | Where-Object { $name = $_
      $explicitLibpqChannels -ccontains $name.ToUpperInvariant() -or
      $name.StartsWith('PG', [System.StringComparison]::OrdinalIgnoreCase) -or
      $name.StartsWith('GIT_', [System.StringComparison]::OrdinalIgnoreCase) -or
      $name.Equals('RITOMER_TEST_PG_PASSWORD', [System.StringComparison]::OrdinalIgnoreCase) -or
      $name.StartsWith('RITOMER_DB_RAIL_', [System.StringComparison]::OrdinalIgnoreCase) -or
      $name.StartsWith('RITOMER_DB_TEST_', [System.StringComparison]::OrdinalIgnoreCase) -or
      $name.StartsWith('SPRING_DATASOURCE_', [System.StringComparison]::OrdinalIgnoreCase) -or
      $name.StartsWith('SPRING_FLYWAY_', [System.StringComparison]::OrdinalIgnoreCase) -or
      $name.StartsWith('FLYWAY_', [System.StringComparison]::OrdinalIgnoreCase)
    })
  if ($forbiddenNames.Count -ne 0) {
    Stop-M1BRail 'PARENT_CREDENTIAL_CHANNEL_PRESENT'
  }
}

function Assert-M1BInteractiveConsole {
  # D authenticates from its fixed local data file, on the same native launch
  # path. No console handle or prompt is needed; B retains its original gate.
  if ($Campaign -cin @('D', 'M12')) { return }
  if (
    -not [System.Environment]::UserInteractive -or
    [System.Console]::IsInputRedirected -or
    [System.Console]::IsOutputRedirected -or
    [System.Console]::IsErrorRedirected -or
    [string]$Host.Name -cne 'ConsoleHost'
  ) {
    Stop-M1BRail 'INTERACTIVE_CONSOLE_REQUIRED'
  }
}

function Read-M1DAdminPasswordFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  $stream = $null
  $bytes = $null
  $text = $null
  try {
    Assert-M1BNoReparseAncestors $Path
    if (-not [IO.File]::Exists($Path)) { Stop-M1BRail 'D_ADMIN_PASSWORD_FILE_MISSING' }
    # FileShare.Read excludes a writer for the duration of this bounded read.
    $stream = [IO.FileStream]::new($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    if ($stream.Length -lt 1 -or $stream.Length -gt 4096) { Stop-M1BRail 'D_ADMIN_PASSWORD_FILE_INVALID' }
    $bytes = New-Object byte[] ([int]$stream.Length)
    $offset = 0
    while ($offset -lt $bytes.Length) {
      $read = $stream.Read($bytes, $offset, $bytes.Length - $offset)
      if ($read -eq 0) { Stop-M1BRail 'D_ADMIN_PASSWORD_FILE_INVALID' }
      $offset += $read
    }
    $text = [Text.UTF8Encoding]::new($false, $true).GetString($bytes)
    # One literal assignment, optionally followed by one LF/CRLF. This is data:
    # no dot-sourcing, interpolation, unquoting, trimming or comment expansion.
    if ($text.StartsWith([string][char]0xFEFF, [StringComparison]::Ordinal)) { $text = $text.Substring(1) }
    if ($text.EndsWith("`r`n", [StringComparison]::Ordinal)) { $text = $text.Substring(0, $text.Length - 2) }
    elseif ($text.EndsWith("`n", [StringComparison]::Ordinal)) { $text = $text.Substring(0, $text.Length - 1) }
    $prefix = 'RITOMER_TEST_PG_PASSWORD='
    if (-not $text.StartsWith($prefix, [StringComparison]::Ordinal) -or $text -cmatch '[\x00-\x1f\x7f]') {
      Stop-M1BRail 'D_ADMIN_PASSWORD_FILE_INVALID'
    }
    $value = $text.Substring($prefix.Length)
    if ([string]::IsNullOrWhiteSpace($value)) { Stop-M1BRail 'D_ADMIN_PASSWORD_FILE_INVALID' }
    return $value
  } catch {
    # Native I/O/decoder errors must never carry a path, line or file content.
    if ((Get-M1BStopCode $_) -ceq 'D_ADMIN_PASSWORD_FILE_MISSING') { throw }
    Stop-M1BRail 'D_ADMIN_PASSWORD_FILE_INVALID'
  } finally {
    if ($null -ne $stream) { $stream.Dispose() }
    if ($null -ne $bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
    $text = $null
    $value = $null
  }
}

function Read-M1DLocalAdminPassword {
  # The operational entry point has no configurable path or credential channel.
  return Read-M1DAdminPasswordFile 'C:\dev\ritomer-local-secrets\postgres-test.env'
}

function Assert-M1BNoReparseAncestors {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [switch]$RunnerArtifactScan,
    [switch]$AllowMissing
  )

  if ($RunnerArtifactScan) {
    [void](ConvertTo-M1BRunnerArtifactIoPath $Path)
    $current = $Path
    $rootLength = 3
    if ($Path.StartsWith('\\', [System.StringComparison]::Ordinal)) {
      $shareSeparator = $Path.IndexOf('\', $Path.IndexOf('\', 2) + 1)
      $rootLength = if ($shareSeparator -lt 0) { $Path.Length } else { $shareSeparator }
    }
    while ($true) {
      $ioPath = ConvertTo-M1BRunnerArtifactIoPath $current
      if (-not $AllowMissing -or [IO.File]::Exists($ioPath) -or [IO.Directory]::Exists($ioPath)) {
        $attributes = [System.IO.File]::GetAttributes($ioPath)
        if (($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
          Stop-M1BRail 'REPARSE_POINT_ANCESTOR_REJECTED'
        }
      }
      if ($current.Length -le $rootLength) { break }
      $current = $current.Substring(0, [Math]::Max($rootLength, $current.LastIndexOf('\')))
    }
    return
  }

  $current = [System.IO.Path]::GetFullPath($Path)
  while (-not [string]::IsNullOrEmpty($current)) {
    if ([System.IO.File]::Exists($current) -or [System.IO.Directory]::Exists($current)) {
      $item = Get-Item -LiteralPath $current -Force
      if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        Stop-M1BRail 'REPARSE_POINT_ANCESTOR_REJECTED'
      }
    }
    $parent = [System.IO.Path]::GetDirectoryName($current)
    if ([string]::Equals($parent, $current, [System.StringComparison]::OrdinalIgnoreCase)) { break }
    $current = $parent
  }
}

function Assert-M1BContainedPath {
  param(
    [Parameter(Mandatory = $true)][string]$Parent,
    [Parameter(Mandatory = $true)][string]$Candidate
  )

  $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
  $candidateFull = [System.IO.Path]::GetFullPath($Candidate)
  if (-not $candidateFull.StartsWith($parentFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    Stop-M1BRail 'PATH_ESCAPES_RUN_ROOT'
  }
  return $candidateFull
}

function New-M1BDirectory {
  param([Parameter(Mandatory = $true)][string]$Path)

  if ([System.IO.Directory]::Exists($Path) -or [System.IO.File]::Exists($Path)) {
    Stop-M1BRail 'CREATE_NEW_DIRECTORY_ALREADY_EXISTS'
  }
  $created = [System.IO.Directory]::CreateDirectory($Path).FullName
  Assert-M1BNoReparseAncestors $created
  return $created
}

function New-M1BNeutralEnvironment {
  param([Parameter(Mandatory = $true)][string]$NeutralRoot)

  $root = New-M1BDirectory $NeutralRoot
  $neutralHomePath = New-M1BDirectory (Join-Path $root 'home')
  $appData = New-M1BDirectory (Join-Path $root 'appdata')
  $localAppData = New-M1BDirectory (Join-Path $root 'localappdata')
  $temp = New-M1BDirectory (Join-Path $root 'tmp')
  $systemRoot = [System.Environment]::GetEnvironmentVariable('SystemRoot')
  if ([string]::IsNullOrWhiteSpace($systemRoot)) {
    Stop-M1BRail 'SYSTEM_ROOT_REQUIRED'
  }
  $values = [ordered]@{
    'SystemRoot' = $systemRoot
    'WINDIR' = $systemRoot
    'OS' = 'Windows_NT'
    'Path' = ((Join-Path $systemRoot 'System32') + ';' + $systemRoot)
    'HOME' = $neutralHomePath
    'USERPROFILE' = $neutralHomePath
    'APPDATA' = $appData
    'LOCALAPPDATA' = $localAppData
    'TEMP' = $temp
    'TMP' = $temp
    'USERNAME' = 'ritomer-m1b-rail'
    'USERDOMAIN' = 'LOCAL'
  }
  return [pscustomobject][ordered]@{
    Root = $root
    Home = $neutralHomePath
    Temp = $temp
    Values = $values
  }
}

function Assert-M1BExactProperties {
  param(
    [Parameter(Mandatory = $true)][psobject]$Value,
    [Parameter(Mandatory = $true)][string[]]$Expected
  )

  $actual = @($Value.PSObject.Properties.Name)
  if ($actual.Count -ne $Expected.Count) {
    Stop-M1BRail 'STRUCTURED_OUTPUT_PROPERTY_COUNT_INVALID'
  }
  foreach ($name in $Expected) {
    if (-not ($actual -ccontains $name)) {
      Stop-M1BRail 'STRUCTURED_OUTPUT_PROPERTY_SET_INVALID'
    }
  }
}

function Assert-M1BNoDuplicateJsonProperties {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)

  $reader = $null
  try {
    $reader = [System.Runtime.Serialization.Json.JsonReaderWriterFactory]::CreateJsonReader(
      $Bytes,
      [System.Xml.XmlDictionaryReaderQuotas]::Max
    )
    $document = [System.Xml.XmlDocument]::new()
    $document.PreserveWhitespace = $false
    $document.Load($reader)
  } catch {
    Stop-M1BRail 'PSQL_JSON_TOKEN_STREAM_INVALID'
  } finally {
    if ($null -ne $reader) { $reader.Dispose() }
  }
  $pending = [System.Collections.Generic.Stack[System.Xml.XmlElement]]::new()
  $pending.Push($document.DocumentElement)
  while ($pending.Count -gt 0) {
    $element = $pending.Pop()
    if ([string]$element.GetAttribute('type') -ceq 'object') {
      $names = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
      foreach ($child in $element.ChildNodes) {
        if ($child -is [System.Xml.XmlElement] -and -not $names.Add($child.LocalName)) {
          Stop-M1BRail 'PSQL_JSON_DUPLICATE_PROPERTY'
        }
      }
    }
    foreach ($child in $element.ChildNodes) {
      if ($child -is [System.Xml.XmlElement]) { $pending.Push($child) }
    }
  }
}

function ConvertFrom-M1BPsqlStructuredOutput {
  param(
    [AllowEmptyString()][Parameter(Mandatory = $true)][string]$Stdout,
    [AllowEmptyString()][Parameter(Mandatory = $true)][string]$Stderr,
    [Parameter(Mandatory = $true)][int]$ExitCode,
    [Parameter(Mandatory = $true)][ValidateSet('PREFLIGHT', 'PROVISION', 'CLEANUP')][string]$Phase
  )

  if ($ExitCode -ne 0) {
    Stop-M1BRail ('PSQL_' + $Phase + '_EXIT_NONZERO')
  }
  if ($Stdout.Length -gt 65536 -or $Stderr.Length -gt 65536) {
    Stop-M1BRail ('PSQL_' + $Phase + '_OUTPUT_TOO_LARGE')
  }
  if ($Stderr.Length -ne 0) {
    Stop-M1BRail ('PSQL_' + $Phase + '_STDERR_NOT_EMPTY')
  }
  $normalized = $Stdout.Replace("`r`n", "`n")
  if (-not $normalized.EndsWith("`n", [System.StringComparison]::Ordinal)) {
    Stop-M1BRail ('PSQL_' + $Phase + '_TERMINAL_NEWLINE_MISSING')
  }
  $body = $normalized.Substring(0, $normalized.Length - 1)
  if ($body.EndsWith("`n", [System.StringComparison]::Ordinal)) {
    Stop-M1BRail ('PSQL_' + $Phase + '_EXTRA_LINE')
  }
  $lines = @($body.Split([char]10))
  if ($lines.Count -ne 2) {
    Stop-M1BRail ('PSQL_' + $Phase + '_LINE_COUNT_INVALID')
  }
  if ($lines[0] -cnotmatch '^M1B_CLIENT\|([0-9]{6})$') {
    Stop-M1BRail 'PSQL_CLIENT_LINE_INVALID'
  }
  $clientVersion = [int]$Matches[1]
  if ($clientVersion -lt 170000 -or $clientVersion -ge 180000) {
    Stop-M1BRail 'PSQL_CLIENT_MAJOR_INVALID'
  }
  $payloadPattern = '^M1B_' + $Phase + '\|([A-Za-z0-9+/]+={0,2})$'
  if ($lines[1] -cnotmatch $payloadPattern) {
    Stop-M1BRail ('PSQL_' + $Phase + '_PAYLOAD_LINE_INVALID')
  }
  $encoded = $Matches[1]
  try {
    $payloadBytes = [System.Convert]::FromBase64String($encoded)
  } catch {
    Stop-M1BRail ('PSQL_' + $Phase + '_BASE64_INVALID')
  }
  if ([System.Convert]::ToBase64String($payloadBytes) -cne $encoded) {
    Stop-M1BRail ('PSQL_' + $Phase + '_BASE64_NON_CANONICAL')
  }
  try {
    $json = (Get-M1BUtf8).GetString($payloadBytes)
  } catch {
    Stop-M1BRail ('PSQL_' + $Phase + '_UTF8_INVALID')
  }
  Assert-M1BNoDuplicateJsonProperties $payloadBytes
  try {
    $payload = ConvertFrom-Json -InputObject $json
  } catch {
    Stop-M1BRail ('PSQL_' + $Phase + '_JSON_INVALID')
  }
  if ($null -eq $payload -or $payload -isnot [System.Management.Automation.PSCustomObject]) {
    Stop-M1BRail ('PSQL_' + $Phase + '_JSON_ROOT_INVALID')
  }
  return [pscustomobject][ordered]@{
    ClientVersionNum = $clientVersion
    Payload = $payload
    PayloadSha256 = Get-M1BSha256Bytes $payloadBytes
  }
}

function Test-M1BJsonInteger {
  param([AllowNull()][object]$Value)

  return $Value -is [byte] -or $Value -is [sbyte] -or
    $Value -is [int16] -or $Value -is [uint16] -or
    $Value -is [int32] -or $Value -is [uint32] -or
    $Value -is [int64] -or $Value -is [uint64]
}

function Test-M1BPostmasterStartUnixMicros {
  param([AllowNull()][object]$Value)

  if ($Value -isnot [string] -or $Value -cnotmatch '\A[1-9][0-9]{0,18}\z') {
    return $false
  }
  $parsed = 0L
  return [long]::TryParse(
    $Value, [System.Globalization.NumberStyles]::None,
    [System.Globalization.CultureInfo]::InvariantCulture, [ref]$parsed
  ) -and $parsed -gt 0
}

function Get-M1BSelectorState {
  param(
    [AllowNull()][object]$Selectors,
    [Parameter(Mandatory = $true)][string]$Target
  )

  $tokens = @($Selectors)
  if ($tokens.Count -eq 0) {
    return 'AMBIGUOUS'
  }
  foreach ($tokenValue in $tokens) {
    $token = [string]$tokenValue
    if ($token -ceq 'all' -or $token -ceq $Target) {
      return 'APPLIES'
    }
    if (
      $token.StartsWith('+', [System.StringComparison]::Ordinal) -or
      $token.StartsWith('@', [System.StringComparison]::Ordinal) -or
      $token.StartsWith('/', [System.StringComparison]::Ordinal) -or
      @('sameuser', 'samerole', 'samegroup') -ccontains $token
    ) {
      return 'AMBIGUOUS'
    }
  }
  return 'EXCLUDES'
}

function ConvertTo-M1BIpv4Bytes {
  param([Parameter(Mandatory = $true)][string]$Address)

  $parsed = $null
  if (-not [System.Net.IPAddress]::TryParse($Address, [ref]$parsed)) {
    return $null
  }
  $bytes = $parsed.GetAddressBytes()
  if ($bytes.Length -ne 4) {
    return $null
  }
  return [byte[]]$bytes
}

function Get-M1BAddressState {
  param(
    [AllowNull()][string]$Address,
    [AllowNull()][string]$Netmask
  )

  if ($Address -ceq 'all') {
    return 'APPLIES'
  }
  if ([string]::IsNullOrWhiteSpace($Address) -or [string]::IsNullOrWhiteSpace($Netmask)) {
    return 'AMBIGUOUS'
  }
  if (
    $Address -cnotmatch '^(?:0|[1-9][0-9]{0,2})(?:\.(?:0|[1-9][0-9]{0,2})){3}$' -or
    $Netmask -cnotmatch '^(?:0|[1-9][0-9]{0,2})(?:\.(?:0|[1-9][0-9]{0,2})){3}$'
  ) {
    return 'AMBIGUOUS'
  }
  $addressBytes = ConvertTo-M1BIpv4Bytes $Address
  $maskBytes = ConvertTo-M1BIpv4Bytes $Netmask
  $targetBytes = ConvertTo-M1BIpv4Bytes '127.0.0.1'
  if ($null -eq $addressBytes -or $null -eq $maskBytes) {
    return 'AMBIGUOUS'
  }
  $zeroObserved = $false
  foreach ($maskByte in $maskBytes) {
    for ($bit = 7; $bit -ge 0; $bit--) {
      $set = ($maskByte -band (1 -shl $bit)) -ne 0
      if ($zeroObserved -and $set) { return 'AMBIGUOUS' }
      if (-not $set) { $zeroObserved = $true }
    }
  }
  for ($index = 0; $index -lt 4; $index++) {
    if (($addressBytes[$index] -band $maskBytes[$index]) -ne ($targetBytes[$index] -band $maskBytes[$index])) {
      return 'EXCLUDES'
    }
  }
  return 'APPLIES'
}

function Test-M1BHbaRuleMatrix {
  param([AllowEmptyCollection()][Parameter(Mandatory = $true)][object[]]$Rules)

  $previousRule = 0
  $seenRules = @{}
  foreach ($rule in $Rules) {
    if ($null -eq $rule -or $rule -isnot [System.Management.Automation.PSCustomObject]) {
      return [pscustomobject]@{
        Pass = $false; Reason = 'HBA_RULE_SHAPE_INVALID'; RuleNumber = $null; LineNumber = $null
      }
    }
    Assert-M1BExactProperties $rule @(
      'ruleNumber', 'lineNumber', 'type', 'database', 'userName', 'address', 'netmask',
      'authMethod', 'options', 'error'
    )
    if (-not (Test-M1BJsonInteger $rule.ruleNumber) -or -not (Test-M1BJsonInteger $rule.lineNumber)) {
      return [pscustomobject]@{
        Pass = $false; Reason = 'HBA_RULE_NUMBER_INVALID'; RuleNumber = $null; LineNumber = $null
      }
    }
    $ruleNumber = [int]$rule.ruleNumber
    $lineNumber = [int]$rule.lineNumber
    if ($ruleNumber -le $previousRule -or $seenRules.ContainsKey($ruleNumber) -or $lineNumber -le 0) {
      return [pscustomobject]@{
        Pass = $false; Reason = 'HBA_ORDER_INVALID'; RuleNumber = $ruleNumber; LineNumber = $lineNumber
      }
    }
    $seenRules[$ruleNumber] = $true
    $previousRule = $ruleNumber
    if ($null -ne $rule.error) {
      return [pscustomobject]@{
        Pass = $false; Reason = 'HBA_PARSE_ERROR'; RuleNumber = $ruleNumber; LineNumber = $lineNumber
      }
    }
    if (
      $rule.type -isnot [string] -or
      $rule.database -isnot [System.Array] -or
      $rule.userName -isnot [System.Array] -or
      $rule.options -isnot [System.Array] -or
      @($rule.database).Count -eq 0 -or
      @($rule.userName).Count -eq 0 -or
      @(@($rule.database) + @($rule.userName) | Where-Object {
          $_ -isnot [string] -or [string]::IsNullOrEmpty([string]$_)
        }).Count -ne 0
    ) {
      return [pscustomobject]@{
        Pass = $false; Reason = 'HBA_FIELD_TYPE_INVALID'; RuleNumber = $ruleNumber; LineNumber = $lineNumber
      }
    }
    $type = [string]$rule.type
    if (-not (@('local', 'host', 'hostssl', 'hostnossl', 'hostgssenc', 'hostnogssenc') -ccontains $type)) {
      return [pscustomobject]@{
        Pass = $false; Reason = 'HBA_TYPE_AMBIGUOUS'; RuleNumber = $ruleNumber; LineNumber = $lineNumber
      }
    }
    if (
      $type -cne 'local' -and
      ($rule.address -isnot [string] -or $rule.netmask -isnot [string] -or $rule.authMethod -isnot [string])
    ) {
      return [pscustomobject]@{
        Pass = $false; Reason = 'HBA_FIELD_TYPE_INVALID'; RuleNumber = $ruleNumber; LineNumber = $lineNumber
      }
    }
  }

  foreach ($rule in $Rules) {
    $ruleNumber = [int]$rule.ruleNumber
    $lineNumber = [int]$rule.lineNumber
    $type = [string]$rule.type
    if (@('local', 'hostssl', 'hostgssenc') -ccontains $type) {
      continue
    }
    $databaseState = Get-M1BSelectorState $rule.database $script:TargetDatabase
    $userState = Get-M1BSelectorState $rule.userName $script:TargetRunnerRole
    $addressState = Get-M1BAddressState ([string]$rule.address) ([string]$rule.netmask)
    if (@($databaseState, $userState, $addressState) -ccontains 'AMBIGUOUS') {
      return [pscustomobject]@{
        Pass = $false; Reason = 'HBA_SELECTOR_AMBIGUOUS'; RuleNumber = $ruleNumber; LineNumber = $lineNumber
      }
    }
    if (@($databaseState, $userState, $addressState) -ccontains 'EXCLUDES') {
      continue
    }
    $dedicated =
      $type -ceq 'hostnossl' -and
      @($rule.database).Count -eq 1 -and [string](@($rule.database)[0]) -ceq $script:TargetDatabase -and
      @($rule.userName).Count -eq 1 -and [string](@($rule.userName)[0]) -ceq $script:TargetRunnerRole -and
      [string]$rule.address -ceq '127.0.0.1' -and
      [string]$rule.netmask -ceq '255.255.255.255' -and
      [string]$rule.authMethod -ceq 'scram-sha-256' -and
      @($rule.options).Count -eq 0
    return [pscustomobject]@{
      Pass = [bool]$dedicated
      Reason = if ($dedicated) { 'PASS' } else { 'HBA_FIRST_APPLICABLE_NOT_DEDICATED_SCRAM' }
      RuleNumber = $ruleNumber
      LineNumber = $lineNumber
    }
  }
  return [pscustomobject]@{
    Pass = $false; Reason = 'HBA_NO_APPLICABLE_RULE'; RuleNumber = $null; LineNumber = $null
  }
}
function Invoke-M1BHmacSha256 {
  param(
    [Parameter(Mandatory = $true)][byte[]]$Key,
    [Parameter(Mandatory = $true)][byte[]]$Data
  )

  $hmac = [System.Security.Cryptography.HMACSHA256]::new($Key)
  try {
    return [byte[]]$hmac.ComputeHash($Data)
  } finally {
    $hmac.Dispose()
  }
}

function Get-M1BPbkdf2Sha256 {
  param(
    [Parameter(Mandatory = $true)][byte[]]$PasswordBytes,
    [Parameter(Mandatory = $true)][byte[]]$Salt,
    [Parameter(Mandatory = $true)][ValidateRange(4096, 4096)][int]$Iterations
  )

  $block = [byte[]]::new($Salt.Length + 4)
  [System.Array]::Copy($Salt, $block, $Salt.Length)
  $block[$Salt.Length + 3] = 1
  $u = Invoke-M1BHmacSha256 $PasswordBytes $block
  $result = [byte[]]$u.Clone()
  try {
    for ($iteration = 2; $iteration -le $Iterations; $iteration++) {
      $next = Invoke-M1BHmacSha256 $PasswordBytes $u
      [System.Array]::Clear($u, 0, $u.Length)
      $u = $next
      for ($index = 0; $index -lt $result.Length; $index++) {
        $result[$index] = $result[$index] -bxor $u[$index]
      }
    }
    return [byte[]]$result.Clone()
  } finally {
    [System.Array]::Clear($block, 0, $block.Length)
    [System.Array]::Clear($u, 0, $u.Length)
    [System.Array]::Clear($result, 0, $result.Length)
  }
}

function New-M1BScramSha256Verifier {
  param(
    [Parameter(Mandatory = $true)][byte[]]$PasswordBytes,
    [Parameter(Mandatory = $true)][byte[]]$Salt,
    [ValidateRange(4096, 4096)][int]$Iterations = 4096
  )

  if ($PasswordBytes.Length -eq 0 -or $Salt.Length -ne 16) {
    Stop-M1BRail 'SCRAM_INPUT_INVALID'
  }
  $saltedPassword = Get-M1BPbkdf2Sha256 $PasswordBytes $Salt $Iterations
  $clientKey = $null
  $storedKey = $null
  $serverKey = $null
  try {
    $clientKey = Invoke-M1BHmacSha256 $saltedPassword ((Get-M1BUtf8).GetBytes('Client Key'))
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
      $storedKey = [byte[]]$sha.ComputeHash($clientKey)
    } finally {
      $sha.Dispose()
    }
    $serverKey = Invoke-M1BHmacSha256 $saltedPassword ((Get-M1BUtf8).GetBytes('Server Key'))
    return 'SCRAM-SHA-256$' + $Iterations + ':' + [System.Convert]::ToBase64String($Salt) + '$' +
      [System.Convert]::ToBase64String($storedKey) + ':' + [System.Convert]::ToBase64String($serverKey)
  } finally {
    foreach ($buffer in @($saltedPassword, $clientKey, $storedKey, $serverKey)) {
      if ($null -ne $buffer) {
        [System.Array]::Clear($buffer, 0, $buffer.Length)
      }
    }
  }
}

function New-M1BRunnerSecret {
  $randomBytes = [byte[]]::new(32)
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($randomBytes)
    $password = [System.Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    $passwordBytes = (Get-M1BUtf8).GetBytes($password)
    return [pscustomobject][ordered]@{
      Password = $password
      PasswordBytes = $passwordBytes
    }
  } finally {
    $generator.Dispose()
    [System.Array]::Clear($randomBytes, 0, $randomBytes.Length)
  }
}

function New-M1BRandomSalt {
  $salt = [byte[]]::new(16)
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($salt)
    return [byte[]]$salt.Clone()
  } finally {
    $generator.Dispose()
    [System.Array]::Clear($salt, 0, $salt.Length)
  }
}

function Get-M1BPreflightSql {
  return @'
SELECT 'M1B_CLIENT|' || :'VERSION_NUM';
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path = pg_catalog;
WITH hba AS (
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'ruleNumber', rule_number,
        'lineNumber', line_number,
        'type', type,
        'database', database,
        'userName', user_name,
        'address', address,
        'netmask', netmask,
        'authMethod', auth_method,
        'options', coalesce(options, ARRAY[]::text[]),
        'error', error
      ) ORDER BY rule_number
    ),
    '[]'::jsonb
  ) AS rules
  FROM pg_hba_file_rules
), identity AS (
  SELECT role_entry.oid::bigint AS role_oid,
         role_entry.rolcanlogin,
         role_entry.rolsuper,
         role_entry.rolcreatedb,
         role_entry.rolcreaterole
  FROM pg_roles role_entry
  WHERE role_entry.rolname = current_user
)
SELECT 'M1B_PREFLIGHT|' || replace(replace(encode(convert_to(
  jsonb_build_object(
    'serverVersionNum', current_setting('server_version_num')::integer,
    'serverAddress', host(inet_server_addr()),
    'serverPort', inet_server_port(),
    'database', current_database(),
    'currentUser', current_user,
    'sessionUser', session_user,
    'applicationName', current_setting('application_name'),
    'currentRoleOid', identity.role_oid,
    'maintenanceDatabaseOid', (SELECT oid::bigint FROM pg_database WHERE datname = current_database()),
    'canLogin', identity.rolcanlogin,
    'isSuperuser', identity.rolsuper,
    'canCreateDb', identity.rolcreatedb,
    'canCreateRole', identity.rolcreaterole,
    'transactionReadOnly', current_setting('transaction_read_only') = 'on',
    'statementTimeout', current_setting('statement_timeout'),
    'lockTimeout', current_setting('lock_timeout'),
    'searchPath', current_setting('search_path'),
    'clusterSystemIdentifier', (SELECT system_identifier::text FROM pg_control_system()),
    'targetDatabaseExists', EXISTS (SELECT 1 FROM pg_database WHERE datname = 'ritomer_043b_test'),
    'targetRoleExists', EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ritomer_043b_test_runner'),
    'hbaFilesLoaded', pg_conf_load_time() IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM (SELECT DISTINCT file_name FROM pg_hba_file_rules) hba_file
      WHERE (pg_stat_file(hba_file.file_name)).modification > pg_conf_load_time()
    ),
    'hbaRules', hba.rules
  )::text,
  'UTF8'), 'base64'), E'\n', ''), E'\r', '')
FROM identity CROSS JOIN hba;
COMMIT;
'@
}

function Get-M1BCampaignPrefix {
  if ($Campaign -ceq 'M12') { return 'ritomer-m1-2' }
  return 'ritomer-m1-1' + $Campaign.ToLowerInvariant()
}

function Get-M1BReceiptPrefix {
  if ($Campaign -ceq 'M12') { return 'm12-' }
  return 'd-'
}

function Get-M1BJobPrefix {
  if ($Campaign -ceq 'M12') { return 'Local\Ritomer.M12.' }
  return 'Local\Ritomer.M1D.'
}

function Get-M1BReceiptNamePattern {
  if ($Campaign -ceq 'M12') { return '^(campaign|provision|cleanup|terminal|recovery-cleanup|recovery-terminal|launch-(preflight|lifecycle|recovery)-(READINESS|TARGETED|FULL|QUALIFICATION|ADMIN_PSQL_(PREFLIGHT|PROVISION|CLEANUP))-(intent|confined|stopped))$' }
  return '^(campaign|provision|integrated|stopped|cleanup|terminal|recovery-cleanup|recovery-terminal|launch-(preflight|lifecycle|recovery)-(READINESS|SEED|BACKEND|VITE|HARNESS|BROWSER_COOKIE|BROWSER_JOURNEY|TARGETED|FULL|ADMIN_PSQL_(PREFLIGHT|PROVISION|CLEANUP))-(intent|confined|stopped))$'
}

function Get-M1BProvenance {
  param(
    [Parameter(Mandatory = $true)][string]$RunId,
    [Parameter(Mandatory = $true)][string]$ReviewedObjectSha256,
    [Parameter(Mandatory = $true)][string]$ClusterSystemIdentifier
  )

  return (Get-M1BCampaignPrefix) + ':' + $RunId + ':' + $ReviewedObjectSha256 + ':' + $ClusterSystemIdentifier
}

function Assert-M1BProvenance {
  param(
    [Parameter(Mandatory = $true)][string]$Provenance,
    [Parameter(Mandatory = $true)][string]$ExpectedClusterSystemIdentifier,
    [string]$ExpectedRunId
  )

  if ($ExpectedClusterSystemIdentifier -cnotmatch '\A[1-9][0-9]{0,19}\z') {
    Stop-M1BRail 'CLUSTER_IDENTIFIER_INVALID'
  }
  $provenancePattern = '\A' + (Get-M1BCampaignPrefix) + ':([0-9a-f]{32}):([0-9a-f]{64}):([1-9][0-9]{0,19})\z'
  $parts = [regex]::Match($Provenance, $provenancePattern)
  if (-not $parts.Success) { Stop-M1BRail 'PROVENANCE_INVALID' }
  if ($parts.Groups[3].Value -cne $ExpectedClusterSystemIdentifier) {
    Stop-M1BRail 'PROVENANCE_CLUSTER_MISMATCH'
  }
  if ($PSBoundParameters.ContainsKey('ExpectedRunId')) {
    if ($ExpectedRunId -cnotmatch '\A[0-9a-f]{32}\z') { Stop-M1BRail 'RUN_ID_INVALID' }
    if ($parts.Groups[1].Value -cne $ExpectedRunId) { Stop-M1BRail 'PROVENANCE_RUN_ID_MISMATCH' }
  }
}

function Get-M1BProvisionSql {
  param(
    [Parameter(Mandatory = $true)][string]$Verifier,
    [Parameter(Mandatory = $true)][string]$Provenance,
    [Parameter(Mandatory = $true)][string]$ExpectedClusterSystemIdentifier,
    [Parameter(Mandatory = $true)][int]$ExpectedHbaRuleNumber,
    [Parameter(Mandatory = $true)][long]$ExpectedAdminRoleOid,
    [Parameter(Mandatory = $true)][long]$ExpectedMaintenanceDatabaseOid
  )

  if ($Verifier -cnotmatch '^SCRAM-SHA-256\$4096:[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=:[A-Za-z0-9+/]{43}=$') {
    Stop-M1BRail 'SCRAM_VERIFIER_INVALID'
  }
  Assert-M1BProvenance $Provenance $ExpectedClusterSystemIdentifier
  if ($ExpectedHbaRuleNumber -le 0) {
    Stop-M1BRail 'HBA_RULE_NUMBER_INVALID'
  }
  if ($ExpectedAdminRoleOid -le 0 -or $ExpectedMaintenanceDatabaseOid -le 0) {
    Stop-M1BRail 'ADMIN_OID_BINDING_INVALID'
  }
  $preloadPredicates = @'
SELECT
  pg_catalog.current_setting('shared_preload_libraries') = '' AS shared_preload_empty,
  (
    SELECT pg_catalog.count(*) = 1 AND
      pg_catalog.count(*) FILTER (WHERE setting_entry = 'session_preload_libraries=') = 1
    FROM pg_catalog.pg_db_role_setting role_settings
    CROSS JOIN LATERAL pg_catalog.unnest(role_settings.setconfig) settings(setting_entry)
    WHERE role_settings.setdatabase = 0 AND role_settings.setrole = role_entry.oid
      AND pg_catalog.lower(pg_catalog.split_part(setting_entry, '=', 1)) = 'session_preload_libraries'
  ) AS session_preload_role_default_empty,
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_db_role_setting database_settings
    CROSS JOIN LATERAL pg_catalog.unnest(database_settings.setconfig) settings(setting_entry)
    WHERE database_settings.setdatabase = database_entry.oid
      AND database_settings.setrole IN (0, role_entry.oid)
      AND pg_catalog.lower(pg_catalog.split_part(setting_entry, '=', 1)) = 'session_preload_libraries'
  ) AS session_preload_overrides_absent,
  (
    NOT pg_catalog.has_parameter_privilege(role_entry.oid, 'session_preload_libraries', 'SET') AND
    NOT pg_catalog.has_parameter_privilege(role_entry.oid, 'session_preload_libraries', 'ALTER SYSTEM') AND
    NOT pg_catalog.has_parameter_privilege(role_entry.oid, 'shared_preload_libraries', 'ALTER SYSTEM')
  ) AS preload_mutation_privileges_absent,
  NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members membership
    WHERE membership.member = role_entry.oid OR membership.roleid = role_entry.oid
  ) AS runner_memberships_absent
'@
  $template = @'
SELECT 'M1B_CLIENT|' || :'VERSION_NUM';
SET statement_timeout = '5s';
SET lock_timeout = '2s';
SET search_path = pg_catalog;
SET log_statement = 'none';
SET log_min_error_statement = 'panic';
SET log_min_duration_statement = '-1';
SET log_min_duration_sample = '-1';
SET log_statement_sample_rate = '0';
SET log_transaction_sample_rate = '0';
SET log_parameter_max_length = '0';
SET log_parameter_max_length_on_error = '0';
SET log_duration = 'off';
SET log_min_messages = 'panic';
SET log_error_verbosity = 'terse';
SET debug_print_parse = 'off';
SET debug_print_rewritten = 'off';
SET debug_print_plan = 'off';
SET log_statement_stats = 'off';
SET log_parser_stats = 'off';
SET log_planner_stats = 'off';
SET log_executor_stats = 'off';
SET track_activities = 'off';
SET compute_query_id = 'off';
DO $m1b$
DECLARE
  identity record;
BEGIN
  SELECT oid::bigint AS role_oid, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole
  INTO STRICT identity
  FROM pg_roles
  WHERE rolname = current_user;
  IF current_setting('server_version_num')::integer < 170000 OR
     current_setting('server_version_num')::integer >= 180000 OR
     host(inet_server_addr()) <> '127.0.0.1' OR
     inet_server_port() <> 15432 OR
     current_database() <> 'postgres' OR
     current_user <> 'postgres' OR
     session_user <> 'postgres' OR
     identity.role_oid <> __ADMIN_ROLE_OID__::bigint OR
     (SELECT oid::bigint FROM pg_database WHERE datname = current_database()) <> __MAINTENANCE_DATABASE_OID__::bigint OR
     current_setting('application_name') <> 'ritomer_m1b_admin_rail' OR
     NOT identity.rolcanlogin OR NOT identity.rolsuper OR
     NOT identity.rolcreatedb OR NOT identity.rolcreaterole THEN
    RAISE EXCEPTION 'administrative connection binding mismatch';
  END IF;
  IF (SELECT system_identifier::text FROM pg_control_system()) <> '__CLUSTER__' THEN
    RAISE EXCEPTION 'cluster binding mismatch';
  END IF;
  IF pg_conf_load_time() IS NULL OR EXISTS (
    SELECT 1
    FROM (SELECT DISTINCT file_name FROM pg_hba_file_rules) hba_file
    WHERE (pg_stat_file(hba_file.file_name)).modification > pg_conf_load_time()
  ) THEN
    RAISE EXCEPTION 'hba files are newer than the loaded configuration';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_hba_file_rules WHERE error IS NOT NULL) THEN
    RAISE EXCEPTION 'hba parse error';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_hba_file_rules
    WHERE rule_number = __HBA_RULE__
      AND type = 'hostnossl'
      AND database = ARRAY['ritomer_043b_test']::text[]
      AND user_name = ARRAY['ritomer_043b_test_runner']::text[]
      AND address = '127.0.0.1'
      AND netmask = '255.255.255.255'
      AND auth_method = 'scram-sha-256'
      AND coalesce(options, ARRAY[]::text[]) = ARRAY[]::text[]
      AND error IS NULL
  ) THEN
    RAISE EXCEPTION 'dedicated hba binding mismatch';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_hba_file_rules earlier
    WHERE earlier.rule_number < __HBA_RULE__
      AND (
        earlier.error IS NOT NULL OR
        (
          earlier.type NOT IN ('local', 'hostssl', 'hostgssenc') AND
          (
            earlier.type NOT IN ('host', 'hostnossl', 'hostnogssenc') OR
            (
              (
                earlier.database IS NULL OR
                EXISTS (
                  SELECT 1 FROM unnest(earlier.database) token
                  WHERE token IN ('all', 'ritomer_043b_test') OR
                    token IN ('sameuser', 'samerole', 'samegroup') OR
                    token ~ '^[+@/]'
                )
              ) AND
              (
                earlier.user_name IS NULL OR
                EXISTS (
                  SELECT 1 FROM unnest(earlier.user_name) token
                  WHERE token IN ('all', 'ritomer_043b_test_runner') OR
                    token IN ('sameuser', 'samerole', 'samegroup') OR
                    token ~ '^[+@/]'
                )
              ) AND
              CASE
                WHEN earlier.address = 'all' THEN true
                WHEN earlier.address IS NULL OR earlier.netmask IS NULL THEN true
                WHEN NOT pg_input_is_valid(earlier.address, 'inet') OR
                     NOT pg_input_is_valid(earlier.netmask, 'inet') THEN true
                WHEN family(earlier.address::inet) <> 4 OR family(earlier.netmask::inet) <> 4 THEN true
                ELSE (inet '127.0.0.1' & earlier.netmask::inet) =
                     (earlier.address::inet & earlier.netmask::inet)
              END
            )
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'earlier hba rule is applicable or ambiguous';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_database WHERE datname = 'ritomer_043b_test') OR
     EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ritomer_043b_test_runner') THEN
    RAISE EXCEPTION 'target already exists';
  END IF;
  PERFORM pg_catalog.set_config('session_preload_libraries', '', false);
  PERFORM pg_catalog.set_config('local_preload_libraries', '', false);
END
$m1b$;
CREATE ROLE ritomer_043b_test_runner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 16 PASSWORD '__VERIFIER__';
COMMENT ON ROLE ritomer_043b_test_runner IS '__PROVENANCE__';
ALTER ROLE ritomer_043b_test_runner SET log_statement TO 'none';
ALTER ROLE ritomer_043b_test_runner SET log_min_error_statement TO 'panic';
ALTER ROLE ritomer_043b_test_runner SET log_min_duration_statement TO '-1';
ALTER ROLE ritomer_043b_test_runner SET log_min_duration_sample TO '-1';
ALTER ROLE ritomer_043b_test_runner SET log_statement_sample_rate TO '0';
ALTER ROLE ritomer_043b_test_runner SET log_transaction_sample_rate TO '0';
ALTER ROLE ritomer_043b_test_runner SET log_parameter_max_length TO '0';
ALTER ROLE ritomer_043b_test_runner SET log_parameter_max_length_on_error TO '0';
ALTER ROLE ritomer_043b_test_runner SET log_duration TO 'off';
ALTER ROLE ritomer_043b_test_runner SET log_min_messages TO 'panic';
ALTER ROLE ritomer_043b_test_runner SET log_error_verbosity TO 'terse';
ALTER ROLE ritomer_043b_test_runner SET debug_print_parse TO 'off';
ALTER ROLE ritomer_043b_test_runner SET debug_print_rewritten TO 'off';
ALTER ROLE ritomer_043b_test_runner SET debug_print_plan TO 'off';
ALTER ROLE ritomer_043b_test_runner SET log_statement_stats TO 'off';
ALTER ROLE ritomer_043b_test_runner SET log_parser_stats TO 'off';
ALTER ROLE ritomer_043b_test_runner SET log_planner_stats TO 'off';
ALTER ROLE ritomer_043b_test_runner SET log_executor_stats TO 'off';
ALTER ROLE ritomer_043b_test_runner SET track_activities TO 'off';
ALTER ROLE ritomer_043b_test_runner SET compute_query_id TO 'off';
ALTER ROLE ritomer_043b_test_runner SET session_preload_libraries FROM CURRENT;
ALTER ROLE ritomer_043b_test_runner SET local_preload_libraries FROM CURRENT;
CREATE DATABASE ritomer_043b_test WITH OWNER ritomer_043b_test_runner TEMPLATE template0 ENCODING 'UTF8';
COMMENT ON DATABASE ritomer_043b_test IS '__PROVENANCE__';
REVOKE ALL ON DATABASE ritomer_043b_test FROM PUBLIC;
DO $m1b_preload$
DECLARE
  preload_proof record;
BEGIN
  SELECT preload_observation.* INTO STRICT preload_proof
  FROM pg_catalog.pg_database database_entry
  CROSS JOIN pg_catalog.pg_roles role_entry
  CROSS JOIN LATERAL (__PRELOAD_PREDICATES__) preload_observation
  WHERE database_entry.datname = 'ritomer_043b_test'
    AND role_entry.rolname = 'ritomer_043b_test_runner';
  IF preload_proof.shared_preload_empty IS NOT TRUE OR
     preload_proof.session_preload_role_default_empty IS NOT TRUE OR
     preload_proof.session_preload_overrides_absent IS NOT TRUE OR
     preload_proof.preload_mutation_privileges_absent IS NOT TRUE OR
     preload_proof.runner_memberships_absent IS NOT TRUE THEN
    RAISE EXCEPTION 'preload administrative contract mismatch';
  END IF;
END
$m1b_preload$;
ALTER ROLE ritomer_043b_test_runner LOGIN;
SELECT 'M1B_PROVISION|' || replace(replace(encode(convert_to(
  jsonb_build_object(
    'clusterSystemIdentifier', (SELECT system_identifier::text FROM pg_control_system()),
    'databaseOid', database_entry.oid::bigint,
    'roleOid', role_entry.oid::bigint,
    'databaseOwnerOid', database_entry.datdba::bigint,
    'provenance', shobj_description(role_entry.oid, 'pg_authid'),
    'databaseProvenance', shobj_description(database_entry.oid, 'pg_database'),
    'roleCanLogin', role_entry.rolcanlogin,
    'roleSuperuser', role_entry.rolsuper,
    'roleCreateDb', role_entry.rolcreatedb,
    'roleCreateRole', role_entry.rolcreaterole,
    'roleInherit', role_entry.rolinherit,
    'roleReplication', role_entry.rolreplication,
    'roleBypassRls', role_entry.rolbypassrls,
    'roleConnectionLimit', role_entry.rolconnlimit,
    'postmasterStartUnixMicros',
      (EXTRACT(EPOCH FROM pg_catalog.pg_postmaster_start_time()) * 1000000)::pg_catalog.int8::pg_catalog.text,
    'sharedPreloadEmpty', preload_observation.shared_preload_empty,
    'sessionPreloadRoleDefaultEmpty', preload_observation.session_preload_role_default_empty,
    'sessionPreloadOverridesAbsent', preload_observation.session_preload_overrides_absent,
    'preloadMutationPrivilegesAbsent', preload_observation.preload_mutation_privileges_absent,
    'runnerMembershipsAbsent', preload_observation.runner_memberships_absent
  )::text,
  'UTF8'), 'base64'), E'\n', ''), E'\r', '')
FROM pg_catalog.pg_database database_entry
CROSS JOIN pg_catalog.pg_roles role_entry
CROSS JOIN LATERAL (__PRELOAD_PREDICATES__) preload_observation
WHERE database_entry.datname = 'ritomer_043b_test'
  AND role_entry.rolname = 'ritomer_043b_test_runner';
'@
  $sql = $template.Replace('__PRELOAD_PREDICATES__', $preloadPredicates)
  $sql = $sql.Replace('__VERIFIER__', $Verifier)
  $sql = $sql.Replace('__PROVENANCE__', $Provenance)
  $sql = $sql.Replace('__CLUSTER__', $ExpectedClusterSystemIdentifier)
  $sql = $sql.Replace('__HBA_RULE__', [string]$ExpectedHbaRuleNumber)
  $sql = $sql.Replace('__ADMIN_ROLE_OID__', [string]$ExpectedAdminRoleOid)
  $sql = $sql.Replace('__MAINTENANCE_DATABASE_OID__', [string]$ExpectedMaintenanceDatabaseOid)
  if ($sql -cmatch '__[A-Z_]+__') { Stop-M1BRail 'PROVISION_SQL_PLACEHOLDER_REMAINED' }
  return $sql
}

function Get-M1BCleanupSql {
  param(
    [Parameter(Mandatory = $true)][string]$Provenance,
    [Parameter(Mandatory = $true)][string]$RunId,
    [Parameter(Mandatory = $true)][string]$ExpectedClusterSystemIdentifier,
    [Parameter(Mandatory = $true)][long]$ExpectedDatabaseOid,
    [Parameter(Mandatory = $true)][long]$ExpectedRoleOid,
    [Parameter(Mandatory = $true)][long]$ExpectedAdminRoleOid,
    [Parameter(Mandatory = $true)][long]$ExpectedMaintenanceDatabaseOid
  )

  Assert-M1BProvenance $Provenance $ExpectedClusterSystemIdentifier $RunId
  if ($Campaign -cin @('D', 'M12') -and ($ExpectedDatabaseOid -le 0 -or $ExpectedRoleOid -le 0 -or
      -not (Test-M1BPostmasterStartUnixMicros $script:DExpectedPostmasterStart))) {
    Stop-M1BRail 'D_CLEANUP_EXACT_PROVISION_RECEIPT_REQUIRED'
  }
  if ($ExpectedDatabaseOid -lt 0 -or $ExpectedRoleOid -lt 0) {
    Stop-M1BRail 'EXPECTED_OID_INVALID'
  }
  if ($ExpectedAdminRoleOid -le 0 -or $ExpectedMaintenanceDatabaseOid -le 0) {
    Stop-M1BRail 'ADMIN_OID_BINDING_INVALID'
  }
  $template = @'
SELECT 'M1B_CLIENT|' || :'VERSION_NUM';
SET statement_timeout = '5s';
SET lock_timeout = '2s';
SET search_path = pg_catalog;
SET client_min_messages = warning;
DO $m1b$
DECLARE
  current_cluster text;
  database_oid oid;
  database_owner oid;
  role_oid oid;
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'postgres' OR session_user <> 'postgres' OR
     (SELECT oid::bigint FROM pg_roles WHERE rolname = current_user) <> __ADMIN_ROLE_OID__::bigint OR
     (SELECT oid::bigint FROM pg_database WHERE datname = current_database()) <> __MAINTENANCE_DATABASE_OID__::bigint THEN
    RAISE EXCEPTION 'cleanup administrative identity mismatch';
  END IF;
  SELECT system_identifier::text INTO STRICT current_cluster FROM pg_control_system();
  IF current_cluster <> '__CLUSTER__' THEN
    RAISE EXCEPTION 'cluster binding mismatch';
  END IF;
  SELECT oid, datdba INTO database_oid, database_owner FROM pg_database WHERE datname = 'ritomer_043b_test';
  SELECT oid INTO role_oid FROM pg_roles WHERE rolname = 'ritomer_043b_test_runner';
  IF database_oid IS NOT NULL THEN
    IF role_oid IS NULL OR
       database_owner IS DISTINCT FROM role_oid OR
       shobj_description(database_oid, 'pg_database') IS DISTINCT FROM '__PROVENANCE__' THEN
      RAISE EXCEPTION 'database provenance mismatch';
    END IF;
    IF __DATABASE_OID__ <> 0 AND database_oid <> __DATABASE_OID__::oid THEN
      RAISE EXCEPTION 'database oid mismatch';
    END IF;
  END IF;
  IF role_oid IS NOT NULL THEN
    IF shobj_description(role_oid, 'pg_authid') IS DISTINCT FROM '__PROVENANCE__' THEN
      RAISE EXCEPTION 'role provenance mismatch';
    END IF;
    IF __ROLE_OID__ <> 0 AND role_oid <> __ROLE_OID__::oid THEN
      RAISE EXCEPTION 'role oid mismatch';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_stat_activity
    WHERE (datname = 'ritomer_043b_test' OR usename = 'ritomer_043b_test_runner')
      AND (
        usename IS DISTINCT FROM 'ritomer_043b_test_runner' OR
        datname IS DISTINCT FROM 'ritomer_043b_test' OR
        backend_type IS DISTINCT FROM 'client backend' OR
        client_addr IS DISTINCT FROM inet '127.0.0.1' OR
        application_name IS NULL OR
        application_name NOT IN (
          'ritomer-m1-1b-__RUN_ID__-targeted',
          'ritomer-m1-1b-__RUN_ID__-full'
        )
      )
  ) THEN
    RAISE EXCEPTION 'foreign target database session detected';
  END IF;
END
$m1b$;
DO $m1b$
DECLARE
  target_pid integer;
BEGIN
  FOR target_pid IN
    SELECT pid
    FROM pg_stat_activity
    WHERE datname = 'ritomer_043b_test'
      AND usename = 'ritomer_043b_test_runner'
      AND application_name IN (
        'ritomer-m1-1b-__RUN_ID__-targeted',
        'ritomer-m1-1b-__RUN_ID__-full'
      )
  LOOP
    IF NOT pg_terminate_backend(target_pid, 5000) THEN
      RAISE EXCEPTION 'target session termination failed';
    END IF;
  END LOOP;
END
$m1b$;
DROP DATABASE IF EXISTS ritomer_043b_test;
DO $m1b$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ritomer_043b_test_runner') THEN
    EXECUTE 'DROP ROLE ritomer_043b_test_runner';
  END IF;
END
$m1b$;
SELECT 'M1B_CLEANUP|' || replace(replace(encode(convert_to(
  jsonb_build_object(
    'clusterSystemIdentifier', (SELECT system_identifier::text FROM pg_control_system()),
    'databaseCount', (SELECT count(*) FROM pg_database WHERE datname = 'ritomer_043b_test'),
    'roleCount', (SELECT count(*) FROM pg_roles WHERE rolname = 'ritomer_043b_test_runner'),
    'sessionCount', (SELECT count(*) FROM pg_stat_activity WHERE datname = 'ritomer_043b_test')
  )::text,
  'UTF8'), 'base64'), E'\n', ''), E'\r', '');
'@
  $sql = $template.Replace('__PROVENANCE__', $Provenance)
  $sql = $sql.Replace('__RUN_ID__', $RunId)
  $sql = $sql.Replace('__CLUSTER__', $ExpectedClusterSystemIdentifier)
  $sql = $sql.Replace('__DATABASE_OID__', [string]$ExpectedDatabaseOid)
  $sql = $sql.Replace('__ROLE_OID__', [string]$ExpectedRoleOid)
  $sql = $sql.Replace('__ADMIN_ROLE_OID__', [string]$ExpectedAdminRoleOid)
  $sql = $sql.Replace('__MAINTENANCE_DATABASE_OID__', [string]$ExpectedMaintenanceDatabaseOid)
  if ($Campaign -cin @('D', 'M12')) {
    $restartGuard = "IF (EXTRACT(EPOCH FROM pg_catalog.pg_postmaster_start_time()) * 1000000)::pg_catalog.int8::pg_catalog.text <> '" + $script:DExpectedPostmasterStart + "' THEN RAISE EXCEPTION 'postmaster binding mismatch'; END IF;`n  IF EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = 'ritomer_043b_test' OR usename = 'ritomer_043b_test_runner') THEN RAISE EXCEPTION 'session remains after stop barrier'; END IF;`n  "
    $sql = $sql.Replace('SELECT oid, datdba INTO database_oid, database_owner', $restartGuard + 'SELECT oid, datdba INTO database_oid, database_owner')
    $sql = $sql.Replace(('ritomer-m1-1b-' + $RunId), ((Get-M1BCampaignPrefix) + '-' + $RunId))
    # D has already attested every owned tree stopped. Any surviving DB session is
    # evidence contradicting that barrier; never terminate it by SQL.
    $sql = $sql.Replace('IF NOT pg_terminate_backend(target_pid, 5000) THEN', 'IF true THEN')
  }
  if ($sql -cmatch '__[A-Z_]+__') { Stop-M1BRail 'CLEANUP_SQL_PLACEHOLDER_REMAINED' }
  return $sql
}

function Assert-M1BPreflightPayload {
  param([Parameter(Mandatory = $true)][psobject]$Payload)

  Assert-M1BExactProperties $Payload @(
    'serverVersionNum', 'serverAddress', 'serverPort', 'database', 'currentUser', 'sessionUser',
    'applicationName', 'currentRoleOid', 'maintenanceDatabaseOid', 'canLogin', 'isSuperuser',
    'canCreateDb', 'canCreateRole', 'transactionReadOnly', 'statementTimeout', 'lockTimeout',
    'searchPath', 'clusterSystemIdentifier', 'targetDatabaseExists', 'targetRoleExists',
    'hbaFilesLoaded', 'hbaRules'
  )
  if (
    -not (Test-M1BJsonInteger $Payload.serverVersionNum) -or
    [int]$Payload.serverVersionNum -lt 170000 -or [int]$Payload.serverVersionNum -ge 180000 -or
    $Payload.serverAddress -isnot [string] -or
    [string]$Payload.serverAddress -cne '127.0.0.1' -or
    -not (Test-M1BJsonInteger $Payload.serverPort) -or
    [int]$Payload.serverPort -ne 15432 -or
    $Payload.database -isnot [string] -or
    [string]$Payload.database -cne 'postgres' -or
    $Payload.currentUser -isnot [string] -or
    [string]$Payload.currentUser -cne 'postgres' -or
    $Payload.sessionUser -isnot [string] -or
    [string]$Payload.sessionUser -cne 'postgres' -or
    $Payload.applicationName -isnot [string] -or
    [string]$Payload.applicationName -cne 'ritomer_m1b_admin_rail' -or
    -not (Test-M1BJsonInteger $Payload.currentRoleOid) -or
    [long]$Payload.currentRoleOid -le 0 -or [long]$Payload.currentRoleOid -gt 4294967295 -or
    -not (Test-M1BJsonInteger $Payload.maintenanceDatabaseOid) -or
    [long]$Payload.maintenanceDatabaseOid -le 0 -or [long]$Payload.maintenanceDatabaseOid -gt 4294967295 -or
    $Payload.canLogin -isnot [bool] -or -not [bool]$Payload.canLogin -or
    $Payload.isSuperuser -isnot [bool] -or -not [bool]$Payload.isSuperuser -or
    $Payload.canCreateDb -isnot [bool] -or -not [bool]$Payload.canCreateDb -or
    $Payload.canCreateRole -isnot [bool] -or -not [bool]$Payload.canCreateRole -or
    $Payload.transactionReadOnly -isnot [bool] -or -not [bool]$Payload.transactionReadOnly -or
    $Payload.statementTimeout -isnot [string] -or
    [string]$Payload.statementTimeout -cne '5s' -or
    $Payload.lockTimeout -isnot [string] -or
    [string]$Payload.lockTimeout -cne '2s' -or
    $Payload.searchPath -isnot [string] -or
    [string]$Payload.searchPath -cne 'pg_catalog' -or
    $Payload.clusterSystemIdentifier -isnot [string] -or
    [string]$Payload.clusterSystemIdentifier -cnotmatch '^[1-9][0-9]{0,19}$' -or
    $Payload.targetDatabaseExists -isnot [bool] -or [bool]$Payload.targetDatabaseExists -or
    $Payload.targetRoleExists -isnot [bool] -or [bool]$Payload.targetRoleExists -or
    $Payload.hbaFilesLoaded -isnot [bool] -or -not [bool]$Payload.hbaFilesLoaded -or
    $Payload.hbaRules -isnot [System.Array]
  ) {
    Stop-M1BRail 'PREFLIGHT_IDENTITY_OR_CAPABILITY_INVALID'
  }
  $hba = Test-M1BHbaRuleMatrix $Payload.hbaRules
  if (-not $hba.Pass) {
    Stop-M1BRail ([string]$hba.Reason)
  }
  return [pscustomobject][ordered]@{
    ServerVersionNum = [int]$Payload.serverVersionNum
    ClusterSystemIdentifier = [string]$Payload.clusterSystemIdentifier
    AdminRoleOid = [long]$Payload.currentRoleOid
    MaintenanceDatabaseOid = [long]$Payload.maintenanceDatabaseOid
    HbaFilesLoaded = [bool]$Payload.hbaFilesLoaded
    HbaRuleNumber = [int]$hba.RuleNumber
    HbaLineNumber = [int]$hba.LineNumber
  }
}

function Assert-M1BProvisionPayload {
  param(
    [Parameter(Mandatory = $true)][psobject]$Payload,
    [Parameter(Mandatory = $true)][string]$ExpectedClusterSystemIdentifier,
    [Parameter(Mandatory = $true)][string]$ExpectedProvenance
  )

  Assert-M1BProvenance $ExpectedProvenance $ExpectedClusterSystemIdentifier
  Assert-M1BExactProperties $Payload @(
    'clusterSystemIdentifier', 'databaseOid', 'roleOid', 'databaseOwnerOid', 'provenance',
    'databaseProvenance', 'roleCanLogin', 'roleSuperuser', 'roleCreateDb', 'roleCreateRole',
    'roleInherit', 'roleReplication', 'roleBypassRls', 'roleConnectionLimit',
    'postmasterStartUnixMicros', 'sharedPreloadEmpty', 'sessionPreloadRoleDefaultEmpty',
    'sessionPreloadOverridesAbsent', 'preloadMutationPrivilegesAbsent', 'runnerMembershipsAbsent'
  )
  if (
    $Payload.clusterSystemIdentifier -isnot [string] -or
    [string]$Payload.clusterSystemIdentifier -cne $ExpectedClusterSystemIdentifier -or
    -not (Test-M1BJsonInteger $Payload.databaseOid) -or
    [long]$Payload.databaseOid -le 0 -or [long]$Payload.databaseOid -gt 4294967295 -or
    -not (Test-M1BJsonInteger $Payload.roleOid) -or
    [long]$Payload.roleOid -le 0 -or [long]$Payload.roleOid -gt 4294967295 -or
    -not (Test-M1BJsonInteger $Payload.databaseOwnerOid) -or
    [long]$Payload.databaseOwnerOid -ne [long]$Payload.roleOid -or
    $Payload.provenance -isnot [string] -or [string]$Payload.provenance -cne $ExpectedProvenance -or
    $Payload.databaseProvenance -isnot [string] -or
    [string]$Payload.databaseProvenance -cne $ExpectedProvenance -or
    $Payload.roleCanLogin -isnot [bool] -or -not [bool]$Payload.roleCanLogin -or
    $Payload.roleSuperuser -isnot [bool] -or [bool]$Payload.roleSuperuser -or
    $Payload.roleCreateDb -isnot [bool] -or [bool]$Payload.roleCreateDb -or
    $Payload.roleCreateRole -isnot [bool] -or [bool]$Payload.roleCreateRole -or
    $Payload.roleInherit -isnot [bool] -or [bool]$Payload.roleInherit -or
    $Payload.roleReplication -isnot [bool] -or [bool]$Payload.roleReplication -or
    $Payload.roleBypassRls -isnot [bool] -or [bool]$Payload.roleBypassRls -or
    -not (Test-M1BJsonInteger $Payload.roleConnectionLimit) -or
    [int]$Payload.roleConnectionLimit -ne 16 -or
    -not (Test-M1BPostmasterStartUnixMicros $Payload.postmasterStartUnixMicros) -or
    $Payload.sharedPreloadEmpty -isnot [bool] -or -not [bool]$Payload.sharedPreloadEmpty -or
    $Payload.sessionPreloadRoleDefaultEmpty -isnot [bool] -or -not [bool]$Payload.sessionPreloadRoleDefaultEmpty -or
    $Payload.sessionPreloadOverridesAbsent -isnot [bool] -or -not [bool]$Payload.sessionPreloadOverridesAbsent -or
    $Payload.preloadMutationPrivilegesAbsent -isnot [bool] -or -not [bool]$Payload.preloadMutationPrivilegesAbsent -or
    $Payload.runnerMembershipsAbsent -isnot [bool] -or -not [bool]$Payload.runnerMembershipsAbsent
  ) {
    Stop-M1BRail 'PROVISION_RESULT_INVALID'
  }
  return [pscustomobject][ordered]@{
    DatabaseOid = [long]$Payload.databaseOid
    RoleOid = [long]$Payload.roleOid
    PostmasterStartUnixMicros = $Payload.postmasterStartUnixMicros
  }
}

function Assert-M1BCleanupPayload {
  param(
    [Parameter(Mandatory = $true)][psobject]$Payload,
    [Parameter(Mandatory = $true)][string]$ExpectedClusterSystemIdentifier
  )

  Assert-M1BExactProperties $Payload @('clusterSystemIdentifier', 'databaseCount', 'roleCount', 'sessionCount')
  if (
    $Payload.clusterSystemIdentifier -isnot [string] -or
    [string]$Payload.clusterSystemIdentifier -cne $ExpectedClusterSystemIdentifier -or
    -not (Test-M1BJsonInteger $Payload.databaseCount) -or
    [int]$Payload.databaseCount -ne 0 -or
    -not (Test-M1BJsonInteger $Payload.roleCount) -or
    [int]$Payload.roleCount -ne 0 -or
    -not (Test-M1BJsonInteger $Payload.sessionCount) -or
    [int]$Payload.sessionCount -ne 0
  ) {
    Stop-M1BRail 'CLEANUP_RESULT_INVALID'
  }
}

$script:M1BContainedProcessTypeInitialized = $false

function Initialize-M1BContainedProcessType {
  if ($script:M1BContainedProcessTypeInitialized) {
    if ($null -eq ('Ritomer.M1B.ContainedProcess' -as [type])) {
      Stop-M1BRail 'GRADLE_CONTAINMENT_TYPE_LOST'
    }
    return
  }
  if ($null -ne ('Ritomer.M1B.ContainedProcess' -as [type])) {
    Stop-M1BRail 'GRADLE_CONTAINMENT_TYPE_COLLISION'
  }

  try {
    Add-Type -Language CSharp -ErrorAction Stop -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace Ritomer.M1B {
  public sealed class ContainedProcess : IDisposable {
    const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
    const uint CREATE_SUSPENDED = 0x00000004;
    const uint CREATE_UNICODE_ENVIRONMENT = 0x00000400;
    const uint EXTENDED_STARTUPINFO_PRESENT = 0x00080000;
    const uint CREATE_NO_WINDOW = 0x08000000;
    const uint STARTF_USESTDHANDLES = 0x00000100;
    const uint WAIT_OBJECT_0 = 0;
    const uint WAIT_TIMEOUT = 0x00000102;
    const uint INFINITE = 0xFFFFFFFF;
    const uint TERMINATION_EXIT_CODE = 0xC000013A;
    const int JobObjectBasicAccountingInformation = 1;
    const int JobObjectExtendedLimitInformation = 9;
    const int ERROR_INSUFFICIENT_BUFFER = 122;
    const long PROC_THREAD_ATTRIBUTE_HANDLE_LIST = 0x00020002;
    const long PROC_THREAD_ATTRIBUTE_JOB_LIST = 0x0002000D;

    IntPtr job;
    IntPtr process;
    bool disposed;

    ContainedProcess(
      IntPtr job,
      IntPtr process,
      uint id,
      StreamReader stdout,
      StreamReader stderr
    ) {
      this.job = job;
      this.process = process;
      Id = unchecked((int)id);
      StandardOutput = stdout;
      StandardError = stderr;
    }

    public int Id { get; private set; }
    public StreamReader StandardOutput { get; private set; }
    public StreamReader StandardError { get; private set; }
    public StreamWriter StandardInput { get; private set; }
    public ProcessStartInfo StartInfo { get; private set; }
    public long CreationTimeUtcTicks { get; private set; }
    public string JobName { get; private set; }

    public bool HasExited {
      get {
        CheckNotDisposed();
        uint result = WaitForSingleObject(process, 0);
        if (result == WAIT_OBJECT_0) return true;
        if (result == WAIT_TIMEOUT) return false;
        throw Win32("WAIT_FOR_PROCESS_FAILED");
      }
    }

    public int ExitCode {
      get {
        CheckNotDisposed();
        uint code;
        if (!GetExitCodeProcess(process, out code)) {
          throw Win32("GET_EXIT_CODE_FAILED");
        }
        return unchecked((int)code);
      }
    }

    public static ContainedProcess Start(ProcessStartInfo startInfo) {
      return StartCore(startInfo, null, null);
    }

    public static ContainedProcess StartD(
      ProcessStartInfo startInfo, string runId, string role, Action<int, long, string> beforeResume
    ) {
      if (!System.Text.RegularExpressions.Regex.IsMatch(runId ?? "", "^[0-9a-f]{32}$") ||
          !System.Text.RegularExpressions.Regex.IsMatch(role ?? "", "^(READINESS|SEED|BACKEND|VITE|HARNESS|BROWSER_COOKIE|BROWSER_JOURNEY|TARGETED|FULL|ADMIN_PSQL_(PREFLIGHT|PROVISION|CLEANUP))$") ||
          beforeResume == null) throw new InvalidOperationException("D_BINDING_INVALID");
      if (startInfo == null || !startInfo.CreateNoWindow ||
          !startInfo.RedirectStandardInput) throw new InvalidOperationException("D_STARTINFO_INVALID");
      return StartCore(startInfo, "Local\\Ritomer.M1D." + runId + "." + role, beforeResume);
    }

    public static ContainedProcess StartM12(
      ProcessStartInfo startInfo, string runId, string role, Action<int, long, string> beforeResume
    ) {
      if (!System.Text.RegularExpressions.Regex.IsMatch(runId ?? "", "^[0-9a-f]{32}$") ||
          !System.Text.RegularExpressions.Regex.IsMatch(role ?? "", "^(READINESS|TARGETED|FULL|QUALIFICATION|ADMIN_PSQL_(PREFLIGHT|PROVISION|CLEANUP))$") ||
          beforeResume == null) throw new InvalidOperationException("M12_BINDING_INVALID");
      if (startInfo == null || !startInfo.CreateNoWindow ||
          !startInfo.RedirectStandardInput) throw new InvalidOperationException("M12_STARTINFO_INVALID");
      return StartCore(startInfo, "Local\\Ritomer.M12." + runId + "." + role, beforeResume);
    }

    static ContainedProcess StartCore(
      ProcessStartInfo startInfo, string jobName, Action<int, long, string> beforeResume
    ) {
      Validate(startInfo, jobName != null);

      IntPtr job = IntPtr.Zero;
      IntPtr attributes = IntPtr.Zero;
      IntPtr inheritedHandles = IntPtr.Zero;
      IntPtr jobList = IntPtr.Zero;
      PROCESS_INFORMATION processInfo = new PROCESS_INFORMATION();
      AnonymousPipeServerStream stdout = null;
      AnonymousPipeServerStream stderr = null;
      AnonymousPipeServerStream stdin = null;
      bool created = false;
      bool localCopiesClosed = false;

      try {
        job = CreateJobObjectW(IntPtr.Zero, jobName);
        int jobError = Marshal.GetLastWin32Error();
        if (job == IntPtr.Zero) throw Win32("CREATE_JOB_FAILED");
        if (jobName != null && jobError == 183) throw new InvalidOperationException("D_JOB_COLLISION");

        JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits =
          new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if (!SetInformationJobObject(
          job,
          JobObjectExtendedLimitInformation,
          ref limits,
          (uint)Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION))
        )) {
          throw Win32("SET_JOB_LIMIT_FAILED");
        }

        stdout = new AnonymousPipeServerStream(
          PipeDirection.In,
          HandleInheritability.Inheritable,
          4096
        );
        stderr = new AnonymousPipeServerStream(
          PipeDirection.In,
          HandleInheritability.Inheritable,
          4096
        );
        stdin = new AnonymousPipeServerStream(
          PipeDirection.Out,
          HandleInheritability.Inheritable,
          4096
        );

        IntPtr attributeSize = IntPtr.Zero;
        bool sized = InitializeProcThreadAttributeList(
          IntPtr.Zero,
          2,
          0,
          ref attributeSize
        );
        int sizeError = Marshal.GetLastWin32Error();
        if (sized || sizeError != ERROR_INSUFFICIENT_BUFFER || attributeSize == IntPtr.Zero) {
          throw new InvalidOperationException("ATTRIBUTE_SIZE_FAILED");
        }

        attributes = Marshal.AllocHGlobal(attributeSize);
        if (!InitializeProcThreadAttributeList(attributes, 2, 0, ref attributeSize)) {
          throw Win32("ATTRIBUTE_INIT_FAILED");
        }

        inheritedHandles = Marshal.AllocHGlobal(checked(3 * IntPtr.Size));
        Marshal.WriteIntPtr(
          inheritedHandles,
          0,
          stdin.ClientSafePipeHandle.DangerousGetHandle()
        );
        Marshal.WriteIntPtr(
          inheritedHandles,
          IntPtr.Size,
          stdout.ClientSafePipeHandle.DangerousGetHandle()
        );
        Marshal.WriteIntPtr(
          inheritedHandles,
          2 * IntPtr.Size,
          stderr.ClientSafePipeHandle.DangerousGetHandle()
        );
        if (!UpdateProcThreadAttribute(
          attributes,
          0,
          new IntPtr(PROC_THREAD_ATTRIBUTE_HANDLE_LIST),
          inheritedHandles,
          new IntPtr(3 * IntPtr.Size),
          IntPtr.Zero,
          IntPtr.Zero
        )) {
          throw Win32("HANDLE_LIST_FAILED");
        }

        jobList = Marshal.AllocHGlobal(IntPtr.Size);
        Marshal.WriteIntPtr(jobList, job);
        if (!UpdateProcThreadAttribute(
          attributes,
          0,
          new IntPtr(PROC_THREAD_ATTRIBUTE_JOB_LIST),
          jobList,
          new IntPtr(IntPtr.Size),
          IntPtr.Zero,
          IntPtr.Zero
        )) {
          throw Win32("JOB_LIST_FAILED");
        }

        STARTUPINFOEX startup = new STARTUPINFOEX();
        startup.StartupInfo.cb = Marshal.SizeOf(typeof(STARTUPINFOEX));
        startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
        startup.StartupInfo.hStdInput = stdin.ClientSafePipeHandle.DangerousGetHandle();
        startup.StartupInfo.hStdOutput = stdout.ClientSafePipeHandle.DangerousGetHandle();
        startup.StartupInfo.hStdError = stderr.ClientSafePipeHandle.DangerousGetHandle();
        startup.AttributeList = attributes;

        byte[] environment = BuildEnvironmentBlock(startInfo.EnvironmentVariables);
        GCHandle environmentPin = new GCHandle();
        bool pinned = false;
        bool started;

        try {
          environmentPin = GCHandle.Alloc(environment, GCHandleType.Pinned);
          pinned = true;
          started = CreateProcessW(
            startInfo.FileName,
            BuildCommandLine(startInfo.FileName, startInfo.Arguments),
            IntPtr.Zero,
            IntPtr.Zero,
            true,
            CREATE_SUSPENDED |
              CREATE_UNICODE_ENVIRONMENT |
              EXTENDED_STARTUPINFO_PRESENT |
              (startInfo.CreateNoWindow ? CREATE_NO_WINDOW : 0),
            environmentPin.AddrOfPinnedObject(),
            startInfo.WorkingDirectory,
            ref startup,
            out processInfo
          );
        } finally {
          Array.Clear(environment, 0, environment.Length);
          if (pinned) environmentPin.Free();
          CloseLocalClient(stdin);
          CloseLocalClient(stdout);
          CloseLocalClient(stderr);
          localCopiesClosed = true;
        }

        if (!started) throw Win32("CREATE_PROCESS_FAILED");
        created = true;

        if (jobName == null) { stdin.Dispose(); stdin = null; }

        bool isInJob;
        if (!IsProcessInJob(processInfo.Process, job, out isInJob) || !isInJob) {
          throw Win32("JOB_BINDING_FAILED");
        }

        long creationTicks = 0;
        if (jobName != null) {
          using (Process identity = Process.GetProcessById(unchecked((int)processInfo.ProcessId))) {
            creationTicks = identity.StartTime.ToUniversalTime().Ticks;
          }
          // Synchronous, durable confinement receipt precedes the first child instruction.
          beforeResume(unchecked((int)processInfo.ProcessId), creationTicks, jobName);
        }

        if (ResumeThread(processInfo.Thread) == UInt32.MaxValue) {
          throw Win32("RESUME_PROCESS_FAILED");
        }
        Close(ref processInfo.Thread);

        Encoding stdoutEncoding =
          startInfo.StandardOutputEncoding ?? new UTF8Encoding(false, true);
        Encoding stderrEncoding =
          startInfo.StandardErrorEncoding ?? new UTF8Encoding(false, true);

        StreamReader stdoutReader = new StreamReader(stdout, stdoutEncoding, true, 4096);
        StreamReader stderrReader = new StreamReader(stderr, stderrEncoding, true, 4096);
        stdout = null;
        stderr = null;

        ContainedProcess result = new ContainedProcess(
          job,
          processInfo.Process,
          processInfo.ProcessId,
          stdoutReader,
          stderrReader
        );
        result.StartInfo = startInfo;
        result.CreationTimeUtcTicks = creationTicks;
        result.JobName = jobName;
        if (stdin != null) {
          result.StandardInput = new StreamWriter(stdin, new UTF8Encoding(false, true));
          result.StandardInput.AutoFlush = true;
          stdin = null;
        }
        job = IntPtr.Zero;
        processInfo.Process = IntPtr.Zero;
        return result;
      } catch {
        if (created) {
          if (job != IntPtr.Zero) {
            TerminateJobObject(job, TERMINATION_EXIT_CODE);
          }
          if (processInfo.Process != IntPtr.Zero) {
            TerminateProcess(processInfo.Process, TERMINATION_EXIT_CODE);
            WaitForSingleObject(processInfo.Process, 30000);
          }
        }
        throw;
      } finally {
        if (!localCopiesClosed) {
          CloseLocalClient(stdin);
          CloseLocalClient(stdout);
          CloseLocalClient(stderr);
        }

        Close(ref processInfo.Thread);
        Close(ref processInfo.Process);

        if (attributes != IntPtr.Zero) {
          DeleteProcThreadAttributeList(attributes);
          Marshal.FreeHGlobal(attributes);
        }
        if (inheritedHandles != IntPtr.Zero) Marshal.FreeHGlobal(inheritedHandles);
        if (jobList != IntPtr.Zero) Marshal.FreeHGlobal(jobList);

        if (stdin != null) stdin.Dispose();
        if (stdout != null) stdout.Dispose();
        if (stderr != null) stderr.Dispose();
        Close(ref job);
      }
    }

    public static bool FileContainsSequence(string path, byte[] needle, long maxLength) {
      if (String.IsNullOrEmpty(path)) throw new ArgumentException("path");
      if (needle == null || needle.Length == 0) throw new ArgumentException("needle");
      if (maxLength < 1) throw new ArgumentOutOfRangeException("maxLength");

      int[] failure = new int[needle.Length];
      for (int index = 1, prefix = 0; index < needle.Length; index++) {
        while (prefix > 0 && needle[index] != needle[prefix]) prefix = failure[prefix - 1];
        if (needle[index] == needle[prefix]) prefix++;
        failure[index] = prefix;
      }

      byte[] buffer = new byte[65536];
      try {
        using (FileStream stream = new FileStream(
          path,
          FileMode.Open,
          FileAccess.Read,
          FileShare.Read,
          buffer.Length,
          FileOptions.SequentialScan
        )) {
          long length = stream.Length;
          if (length > maxLength) throw new InvalidDataException("FILE_SIZE_EXCEEDED");
          int matched = 0;
          int read;
          while ((read = stream.Read(buffer, 0, buffer.Length)) > 0) {
            for (int index = 0; index < read; index++) {
              while (matched > 0 && buffer[index] != needle[matched]) matched = failure[matched - 1];
              if (buffer[index] == needle[matched]) matched++;
              if (matched == needle.Length) return true;
            }
          }
          if (stream.Position != length || stream.Length != length) {
            throw new InvalidDataException("FILE_CHANGED_OR_READ_INCOMPLETE");
          }
          return false;
        }
      } finally {
        Array.Clear(buffer, 0, buffer.Length);
        Array.Clear(failure, 0, failure.Length);
      }
    }

    public void WaitForExit() {
      CheckNotDisposed();
      if (WaitForSingleObject(process, INFINITE) != WAIT_OBJECT_0) {
        throw Win32("WAIT_FOR_PROCESS_FAILED");
      }
    }

    public int ActiveProcessCount {
      get { CheckNotDisposed(); uint active; if (!TryGetActiveCount(job, out active))
        throw Win32("JOB_QUERY_FAILED"); return checked((int)active); }
    }

    // Read-only recovery. Absence is distinct from access denied and never proves
    // cessation by itself: the caller must also validate the durable receipt/root.
    public static int QueryDJob(string name) {
      if (!System.Text.RegularExpressions.Regex.IsMatch(name ?? "", "^Local\\\\Ritomer\\.M1D\\.[0-9a-f]{32}\\.(READINESS|SEED|BACKEND|VITE|HARNESS|BROWSER_COOKIE|BROWSER_JOURNEY|TARGETED|FULL|ADMIN_PSQL_(PREFLIGHT|PROVISION|CLEANUP))$"))
        throw new InvalidOperationException("D_JOB_NAME_INVALID");
      IntPtr handle = OpenJobObjectW(0x0004, false, name);
      if (handle == IntPtr.Zero) {
        if (Marshal.GetLastWin32Error() == 2) return -1;
        throw Win32("D_JOB_OPEN_FAILED");
      }
      try { uint count; if (!TryGetActiveCount(handle, out count)) throw Win32("D_JOB_QUERY_FAILED");
        return checked((int)count); } finally { CloseHandle(handle); }
    }

    public static int QueryM12Job(string name) {
      if (!System.Text.RegularExpressions.Regex.IsMatch(name ?? "", "^Local\\\\Ritomer\\.M12\\.[0-9a-f]{32}\\.(READINESS|TARGETED|FULL|QUALIFICATION|ADMIN_PSQL_(PREFLIGHT|PROVISION|CLEANUP))$"))
        throw new InvalidOperationException("M12_JOB_NAME_INVALID");
      IntPtr handle = OpenJobObjectW(0x0004, false, name);
      if (handle == IntPtr.Zero) {
        if (Marshal.GetLastWin32Error() == 2) return -1;
        throw Win32("M12_JOB_OPEN_FAILED");
      }
      try { uint count; if (!TryGetActiveCount(handle, out count)) throw Win32("M12_JOB_QUERY_FAILED");
        return checked((int)count); } finally { CloseHandle(handle); }
    }

    public static string DNamespaceIdentity() {
      // Boot GUID and logon-session LUID prevent a same-machine/session-number
      // match after reboot or logoff from being treated as the original namespace.
      IntPtr boot = Marshal.AllocHGlobal(32);
      IntPtr statistics = IntPtr.Zero;
      try {
        int returned;
        if (NtQuerySystemInformation(90, boot, 32, out returned) != 0 || returned < 16)
          throw new InvalidOperationException("D_BOOT_IDENTITY_UNAVAILABLE");
        byte[] guid = new byte[16]; Marshal.Copy(boot, guid, 0, 16);
        using (System.Security.Principal.WindowsIdentity identity = System.Security.Principal.WindowsIdentity.GetCurrent()) {
          int needed;
          GetTokenInformation(identity.Token, 10, IntPtr.Zero, 0, out needed);
          if (Marshal.GetLastWin32Error() != 122 || needed < 16 || needed > 4096)
            throw new InvalidOperationException("D_LOGON_IDENTITY_UNAVAILABLE");
          statistics = Marshal.AllocHGlobal(needed);
          if (!GetTokenInformation(identity.Token, 10, statistics, needed, out returned) || returned < 16)
            throw Win32("D_LOGON_IDENTITY_UNAVAILABLE");
          ulong authenticationId = unchecked((ulong)Marshal.ReadInt64(statistics, 8));
          using (Process current = Process.GetCurrentProcess()) {
            return new Guid(guid).ToString("N") + ":" + authenticationId.ToString("x16") + ":" + current.SessionId;
          }
        }
      } finally { Marshal.FreeHGlobal(boot); if (statistics != IntPtr.Zero) Marshal.FreeHGlobal(statistics); }
    }

    [DllImport("ntdll.dll")]
    static extern int NtQuerySystemInformation(int kind, IntPtr buffer, int size, out int returned);
    [DllImport("advapi32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool GetTokenInformation(IntPtr token, int kind, IntPtr buffer, int size, out int returned);

    public bool TerminateTreeAndWait(int timeoutMilliseconds) {
      CheckNotDisposed();
      if (timeoutMilliseconds < 1) {
        throw new ArgumentOutOfRangeException("timeoutMilliseconds");
      }

      uint active;
      if (!TryGetActiveCount(job, out active)) return false;
      if (active == 0) return true;

      if (!TerminateJobObject(job, TERMINATION_EXIT_CODE)) {
        return TryGetActiveCount(job, out active) && active == 0;
      }

      Stopwatch timer = Stopwatch.StartNew();
      try {
        do {
          if (!TryGetActiveCount(job, out active)) return false;
          if (active == 0) return true;
          Thread.Sleep(10);
        } while (timer.ElapsedMilliseconds <= timeoutMilliseconds);

        return TryGetActiveCount(job, out active) && active == 0;
      } finally {
        timer.Stop();
      }
    }

    // D owns one deadline across termination, proof, drains and release. This
    // overload is deliberately separate from IDisposable.Dispose for B/callers.
    public string[] DisposeD(int timeoutMilliseconds) {
      if (timeoutMilliseconds < 0 || timeoutMilliseconds > 30000)
        throw new ArgumentOutOfRangeException("timeoutMilliseconds");
      if (disposed) return new string[] { "stop-release" };
      disposed = true;
      Stopwatch timer = Stopwatch.StartNew();
      List<string> failures = new List<string>();
      IntPtr currentJob = job, currentProcess = process;
      job = IntPtr.Zero; process = IntPtr.Zero;
      try {
        if (currentJob != IntPtr.Zero) {
          try { if (!TerminateJobObject(currentJob, TERMINATION_EXIT_CODE)) failures.Add("stop-job-terminate"); }
          catch { failures.Add("stop-job-terminate"); }
          try { if (!CloseHandle(currentJob)) failures.Add("stop-job-close"); }
          catch { failures.Add("stop-job-close"); }
        }
        if (currentProcess != IntPtr.Zero) {
          int remaining = (int)Math.Max(0L, timeoutMilliseconds - timer.ElapsedMilliseconds);
          try { if (WaitForSingleObject(currentProcess, (uint)remaining) != WAIT_OBJECT_0) failures.Add("stop-root-release-wait"); }
          catch { failures.Add("stop-root-release-wait"); }
        }
      } finally {
        // No failure may skip an unrelated close. Only closed operations leave
        // this method; release results are never cessation evidence.
        try { if (StandardOutput != null) StandardOutput.Dispose(); }
        catch { failures.Add("stop-stdout-close"); }
        try { if (StandardError != null) StandardError.Dispose(); }
        catch { failures.Add("stop-stderr-close"); }
        try { if (StandardInput != null) StandardInput.Dispose(); }
        catch { failures.Add("stop-stdin-close"); }
        try { if (currentProcess != IntPtr.Zero && !CloseHandle(currentProcess)) failures.Add("stop-process-close"); }
        catch { failures.Add("stop-process-close"); }
        timer.Stop();
      }
      return failures.ToArray();
    }
    public void Dispose() {
      if (disposed) return;
      disposed = true;

      IntPtr currentJob = job;
      IntPtr currentProcess = process;
      job = IntPtr.Zero;
      process = IntPtr.Zero;

      try {
        if (currentJob != IntPtr.Zero) {
          TerminateJobObject(currentJob, TERMINATION_EXIT_CODE);
          CloseHandle(currentJob);
        }
        if (currentProcess != IntPtr.Zero) {
          WaitForSingleObject(currentProcess, 30000);
        }
      } finally {
        if (StandardOutput != null) StandardOutput.Dispose();
        if (StandardError != null) StandardError.Dispose();
        if (StandardInput != null) StandardInput.Dispose();
        if (currentProcess != IntPtr.Zero) CloseHandle(currentProcess);
      }
    }

    static void Validate(ProcessStartInfo startInfo, bool campaignD) {
      if (startInfo == null) throw new ArgumentNullException("startInfo");
      if (
        Environment.OSVersion.Platform != PlatformID.Win32NT ||
        Environment.OSVersion.Version.Major < 10
      ) {
        throw new PlatformNotSupportedException("PROC_THREAD_ATTRIBUTE_JOB_LIST_UNSUPPORTED");
      }
      if (
        !Path.IsPathRooted(startInfo.FileName) ||
        !File.Exists(startInfo.FileName) ||
        startInfo.FileName.IndexOf('\0') >= 0 ||
        startInfo.FileName.IndexOf('"') >= 0
      ) {
        throw new InvalidOperationException("EXECUTABLE_INVALID");
      }
      if (
        String.IsNullOrWhiteSpace(startInfo.WorkingDirectory) ||
        !Path.IsPathRooted(startInfo.WorkingDirectory) ||
        !Directory.Exists(startInfo.WorkingDirectory)
      ) {
        throw new InvalidOperationException("WORKDIR_INVALID");
      }
      if (startInfo.Arguments != null && startInfo.Arguments.IndexOf('\0') >= 0) {
        throw new InvalidOperationException("ARGUMENTS_INVALID");
      }
      if (
        startInfo.UseShellExecute ||
        (!campaignD && !startInfo.CreateNoWindow) ||
        !startInfo.RedirectStandardOutput ||
        !startInfo.RedirectStandardError ||
        (!campaignD && startInfo.RedirectStandardInput)
      ) {
        throw new InvalidOperationException("STARTINFO_INVALID");
      }
    }

    static StringBuilder BuildCommandLine(string executable, string arguments) {
      StringBuilder result = new StringBuilder();
      result.Append('"').Append(executable).Append('"');
      if (!String.IsNullOrEmpty(arguments)) result.Append(' ').Append(arguments);
      if (result.Length > 32767) {
        throw new InvalidOperationException("COMMAND_LINE_TOO_LARGE");
      }
      return result;
    }

    static byte[] BuildEnvironmentBlock(StringDictionary source) {
      SortedDictionary<string, string> sorted =
        new SortedDictionary<string, string>(StringComparer.OrdinalIgnoreCase);

      foreach (string key in source.Keys) {
        string value = source[key];
        if (
          String.IsNullOrEmpty(key) ||
          key.IndexOf('=') >= 0 ||
          key.IndexOf('\0') >= 0 ||
          value == null ||
          value.IndexOf('\0') >= 0
        ) {
          throw new InvalidOperationException("ENVIRONMENT_INVALID");
        }
        sorted.Add(key, value);
      }

      int characterCount = sorted.Count == 0 ? 2 : 1;
      foreach (KeyValuePair<string, string> entry in sorted) {
        characterCount = checked(
          characterCount + entry.Key.Length + entry.Value.Length + 2
        );
      }
      if (characterCount > 32767) {
        throw new InvalidOperationException("ENVIRONMENT_TOO_LARGE");
      }

      char[] characters = new char[characterCount];
      int offset = 0;
      try {
        foreach (KeyValuePair<string, string> entry in sorted) {
          entry.Key.CopyTo(0, characters, offset, entry.Key.Length);
          offset += entry.Key.Length;
          characters[offset++] = '=';
          entry.Value.CopyTo(0, characters, offset, entry.Value.Length);
          offset += entry.Value.Length;
          characters[offset++] = '\0';
        }
        while (offset < characters.Length) characters[offset++] = '\0';
        return Encoding.Unicode.GetBytes(characters);
      } finally {
        Array.Clear(characters, 0, characters.Length);
      }
    }

    static bool TryGetActiveCount(IntPtr job, out uint count) {
      JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting =
        new JOBOBJECT_BASIC_ACCOUNTING_INFORMATION();
      bool success = QueryInformationJobObject(
        job,
        JobObjectBasicAccountingInformation,
        out accounting,
        (uint)Marshal.SizeOf(typeof(JOBOBJECT_BASIC_ACCOUNTING_INFORMATION)),
        IntPtr.Zero
      );
      count = success ? accounting.ActiveProcesses : UInt32.MaxValue;
      return success;
    }

    static void CloseLocalClient(AnonymousPipeServerStream pipe) {
      if (pipe == null) return;
      try {
        pipe.DisposeLocalCopyOfClientHandle();
      } catch (ObjectDisposedException) {
      } catch (InvalidOperationException) {
      }
    }

    static void Close(ref IntPtr handle) {
      if (handle == IntPtr.Zero) return;
      CloseHandle(handle);
      handle = IntPtr.Zero;
    }

    static Win32Exception Win32(string operation) {
      return new Win32Exception(Marshal.GetLastWin32Error(), operation);
    }

    void CheckNotDisposed() {
      if (disposed) throw new ObjectDisposedException("ContainedProcess");
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct STARTUPINFO {
      public int cb;
      public string Reserved;
      public string Desktop;
      public string Title;
      public int X;
      public int Y;
      public int XSize;
      public int YSize;
      public int XCountChars;
      public int YCountChars;
      public int FillAttribute;
      public uint dwFlags;
      public short ShowWindow;
      public short Reserved2Size;
      public IntPtr Reserved2;
      public IntPtr hStdInput;
      public IntPtr hStdOutput;
      public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct STARTUPINFOEX {
      public STARTUPINFO StartupInfo;
      public IntPtr AttributeList;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PROCESS_INFORMATION {
      public IntPtr Process;
      public IntPtr Thread;
      public uint ProcessId;
      public uint ThreadId;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct IO_COUNTERS {
      public ulong ReadOperations;
      public ulong WriteOperations;
      public ulong OtherOperations;
      public ulong ReadBytes;
      public ulong WriteBytes;
      public ulong OtherBytes;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
      public long ProcessTimeLimit;
      public long JobTimeLimit;
      public uint LimitFlags;
      public UIntPtr MinimumWorkingSet;
      public UIntPtr MaximumWorkingSet;
      public uint ActiveProcessLimit;
      public UIntPtr Affinity;
      public uint PriorityClass;
      public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
      public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
      public IO_COUNTERS IoInfo;
      public UIntPtr ProcessMemoryLimit;
      public UIntPtr JobMemoryLimit;
      public UIntPtr PeakProcessMemory;
      public UIntPtr PeakJobMemory;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_BASIC_ACCOUNTING_INFORMATION {
      public long TotalUserTime;
      public long TotalKernelTime;
      public long PeriodUserTime;
      public long PeriodKernelTime;
      public uint PageFaults;
      public uint TotalProcesses;
      public uint ActiveProcesses;
      public uint TerminatedProcesses;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr CreateJobObjectW(IntPtr attributes, string name);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr OpenJobObjectW(uint access, bool inherit, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool SetInformationJobObject(
      IntPtr job,
      int informationClass,
      ref JOBOBJECT_EXTENDED_LIMIT_INFORMATION information,
      uint informationLength
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool QueryInformationJobObject(
      IntPtr job,
      int informationClass,
      out JOBOBJECT_BASIC_ACCOUNTING_INFORMATION information,
      uint informationLength,
      IntPtr returnLength
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool InitializeProcThreadAttributeList(
      IntPtr attributeList,
      int attributeCount,
      int flags,
      ref IntPtr size
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool UpdateProcThreadAttribute(
      IntPtr attributeList,
      uint flags,
      IntPtr attribute,
      IntPtr value,
      IntPtr size,
      IntPtr previousValue,
      IntPtr returnSize
    );

    [DllImport("kernel32.dll")]
    static extern void DeleteProcThreadAttributeList(IntPtr attributeList);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool CreateProcessW(
      string applicationName,
      StringBuilder commandLine,
      IntPtr processAttributes,
      IntPtr threadAttributes,
      [MarshalAs(UnmanagedType.Bool)] bool inheritHandles,
      uint creationFlags,
      IntPtr environment,
      string currentDirectory,
      ref STARTUPINFOEX startupInfo,
      out PROCESS_INFORMATION processInformation
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool IsProcessInJob(
      IntPtr process,
      IntPtr job,
      [MarshalAs(UnmanagedType.Bool)] out bool result
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern uint ResumeThread(IntPtr thread);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool TerminateJobObject(IntPtr job, uint exitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool TerminateProcess(IntPtr process, uint exitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool CloseHandle(IntPtr handle);
  }
}
'@
  } catch {
    Stop-M1BRail 'GRADLE_CONTAINMENT_TYPE_COMPILE_FAILED'
  }

  if ($null -eq ('Ritomer.M1B.ContainedProcess' -as [type])) {
    Stop-M1BRail 'GRADLE_CONTAINMENT_TYPE_MISSING'
  }
  $script:M1BContainedProcessTypeInitialized = $true
}

function Assert-M1BPsqlBinary {
  Assert-M1BNoReparseAncestors $script:PsqlExeExact
  if (-not [System.IO.File]::Exists($script:PsqlExeExact)) {
    Stop-M1BRail 'PSQL_17_EXECUTABLE_MISSING'
  }
  $item = Get-Item -LiteralPath $script:PsqlExeExact -Force
  if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    Stop-M1BRail 'PSQL_EXECUTABLE_REPARSE_POINT_REJECTED'
  }
  $resolved = [System.IO.Path]::GetFullPath($item.FullName)
  if (-not [string]::Equals($resolved, $script:PsqlExeExact, [System.StringComparison]::OrdinalIgnoreCase)) {
    Stop-M1BRail 'PSQL_EXECUTABLE_PATH_INVALID'
  }
  $version = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($resolved)
  if ($version.ProductMajorPart -ne 17 -and $version.FileMajorPart -ne 17) {
    Stop-M1BRail 'PSQL_FILE_VERSION_INVALID'
  }
  $sha256 = Get-M1BSha256File $resolved
  if ($sha256 -cne $ExpectedPsqlSha256) {
    Stop-M1BRail 'PSQL_EXECUTABLE_SHA256_DIVERGED'
  }
  return [pscustomobject][ordered]@{
    Path = $resolved
    Sha256 = $sha256
    FileVersion = [string]$version.FileVersion
    ProductVersion = [string]$version.ProductVersion
  }
}

function Read-M1BBoundedProcessStreams {
  param(
    [Parameter(Mandatory = $true)][object]$Process,
    [ValidateRange(1, 8388608)][int]$LimitChars = 65536,
    [ValidateRange(1, 1800000)][int]$TimeoutMilliseconds = 300000,
    [AllowNull()][string]$StandardInputText,
    [switch]$TerminateTreeWhenRootExits
  )

  $stdout = [System.Text.StringBuilder]::new()
  $stderr = [System.Text.StringBuilder]::new()
  $stdoutBuffer = [char[]]::new(4096)
  $stderrBuffer = [char[]]::new(4096)
  $stdoutTask = $Process.StandardOutput.ReadAsync($stdoutBuffer, 0, $stdoutBuffer.Length)
  $stderrTask = $Process.StandardError.ReadAsync($stderrBuffer, 0, $stderrBuffer.Length)
  $standardInputWasProvided = $PSBoundParameters.ContainsKey('StandardInputText')
  $inputTask = $null
  $inputClosed = -not $standardInputWasProvided
  if ($standardInputWasProvided) {
    if (-not $Process.StartInfo.RedirectStandardInput) {
      Stop-M1BRail 'CHILD_STDIN_NOT_REDIRECTED'
    }
    if ([string]::IsNullOrEmpty($StandardInputText)) { Stop-M1BRail 'CHILD_STDIN_EMPTY' }
    if ($StandardInputText.Length -gt 131072) { Stop-M1BRail 'CHILD_STDIN_TOO_LARGE' }
    $inputTask = $Process.StandardInput.WriteAsync($StandardInputText)
  }
  $stdoutEnded = $false
  $stderrEnded = $false
  $treeTerminated = $false
  $clock = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    while (-not ($stdoutEnded -and $stderrEnded -and $Process.HasExited)) {
      if ($Campaign -cin @('D', 'M12')) { Assert-M1DDeadline }
      if ($clock.ElapsedMilliseconds -gt $TimeoutMilliseconds) {
        Stop-M1BRail 'CHILD_PROCESS_TIMEOUT'
      }
      if (
        $TerminateTreeWhenRootExits -and
        -not $treeTerminated -and
        $Process.HasExited
      ) {
        $terminationBudget = if ($Campaign -ceq 'M12') { Get-M1DStopBudget } else { 30000 }
        if (-not $Process.TerminateTreeAndWait($terminationBudget)) {
          Stop-M1BRail 'GRADLE_PROCESS_TREE_TERMINATION_FAILED'
        }
        $treeTerminated = $true
      }
      if (-not $inputClosed -and $inputTask.IsCompleted) {
        [void]$inputTask.GetAwaiter().GetResult()
        $Process.StandardInput.Close()
        $inputClosed = $true
      }
      if (-not $stdoutEnded -and $stdoutTask.IsCompleted) {
        $read = $stdoutTask.GetAwaiter().GetResult()
        if ($read -eq 0) {
          $stdoutEnded = $true
        } else {
          if ($stdout.Length + $read -gt $LimitChars) { Stop-M1BRail 'CHILD_STDOUT_TOO_LARGE' }
          [void]$stdout.Append($stdoutBuffer, 0, $read)
          $stdoutTask = $Process.StandardOutput.ReadAsync($stdoutBuffer, 0, $stdoutBuffer.Length)
        }
      }
      if (-not $stderrEnded -and $stderrTask.IsCompleted) {
        $read = $stderrTask.GetAwaiter().GetResult()
        if ($read -eq 0) {
          $stderrEnded = $true
        } else {
          if ($stderr.Length + $read -gt $LimitChars) { Stop-M1BRail 'CHILD_STDERR_TOO_LARGE' }
          [void]$stderr.Append($stderrBuffer, 0, $read)
          $stderrTask = $Process.StandardError.ReadAsync($stderrBuffer, 0, $stderrBuffer.Length)
        }
      }
      if (-not $inputClosed -or -not $stdoutEnded -or -not $stderrEnded -or -not $Process.HasExited) {
        [System.Threading.Thread]::Sleep(10)
      }
    }
    $Process.WaitForExit()
    return [pscustomobject][ordered]@{
      Stdout = $stdout.ToString()
      Stderr = $stderr.ToString()
    }
  } finally {
    $clock.Stop()
  }
}

$script:PsqlProcessStarts = @{
  Preflight = 0
  Provision = 0
  Cleanup = 0
}

function Invoke-M1BDirectPsql {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('Preflight', 'Provision', 'Cleanup')][string]$Phase,
    [Parameter(Mandatory = $true)][string]$SqlText,
    [Parameter(Mandatory = $true)][string]$NeutralRoot
  )

  if ([int]$script:PsqlProcessStarts[$Phase] -ne 0) {
    Stop-M1BRail ('PSQL_' + $Phase.ToUpperInvariant() + '_SECOND_START_REJECTED')
  }
  Assert-M1BNoCredentialChannels
  $binary = Assert-M1BPsqlBinary
  $neutral = New-M1BNeutralEnvironment $NeutralRoot
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $script:PsqlExeExact
  $arguments = @($script:PsqlArgumentsExact)
  if ($Campaign -cin @('D', 'M12')) { $arguments[1] = '-w' }
  $startInfo.Arguments = ($arguments | ForEach-Object { ConvertTo-M1BProcessArgument ([string]$_) }) -join ' '
  $startInfo.WorkingDirectory = $neutral.Root
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = ($Campaign -cin @('D', 'M12'))
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.StandardOutputEncoding = Get-M1BUtf8
  $startInfo.StandardErrorEncoding = Get-M1BUtf8
  $startInfo.EnvironmentVariables.Clear()
  foreach ($entry in $neutral.Values.GetEnumerator()) {
    $startInfo.EnvironmentVariables[[string]$entry.Key] = [string]$entry.Value
  }

  $process = $null
  if ($Campaign -cnotin @('D', 'M12')) {
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
  }
  $started = $false
  $terminationPassed = $true
  $firstFailure = $null
  try {
    if ($Campaign -cin @('D', 'M12')) {
      $startInfo.EnvironmentVariables['PGPASSWORD'] = Read-M1DLocalAdminPassword
      # CleanupPsql keeps its existing signature. Only CleanupOnly owns this
      # local context; validate its scope before forwarding it explicitly.
      $receiptContext = Get-Variable -Name M1DRecoveryReceiptContext -ValueOnly -ErrorAction SilentlyContinue
      if ($null -ne $receiptContext) { Assert-M1DRecoveryReceiptContext $receiptContext }
      $process = Start-M1DContainedChild $startInfo ('ADMIN_PSQL_' + $Phase.ToUpperInvariant()) -ReceiptContext $receiptContext
      $startInfo.EnvironmentVariables.Remove('PGPASSWORD')
    } elseif (-not $process.Start()) {
      Stop-M1BRail ('PSQL_' + $Phase.ToUpperInvariant() + '_START_FAILED')
    }
    $started = $true
    $script:PsqlProcessStarts[$Phase] = 1
    $processId = [int]$process.Id
    $stdinText = if ($SqlText.EndsWith("`n", [System.StringComparison]::Ordinal)) {
      $SqlText
    } else {
      $SqlText + "`n"
    }
    if ($Campaign -cin @('D', 'M12')) { Set-M1DDiagnosticOperation 'child-drain' }
    $captured = Read-M1BBoundedProcessStreams `
      -Process $process `
      -LimitChars 65536 `
      -TimeoutMilliseconds 300000 `
      -StandardInputText $stdinText
    $stdout = $captured.Stdout
    $stderr = $captured.Stderr
    if ($Campaign -cin @('D', 'M12')) {
      $exitCode = [int]$process.ExitCode
      if ($exitCode -ne 0) { Stop-M1BRail ('PSQL_' + $Phase.ToUpperInvariant() + '_EXIT_NONZERO') }
    }
    $result = [pscustomobject][ordered]@{
      Phase = $Phase
      ProcessId = $processId
      ProcessCount = 1
      ExitCode = $(if ($Campaign -cin @('D', 'M12')) { $exitCode } else { [int]$process.ExitCode })
      PsqlPath = $binary.Path
      PsqlSha256 = $binary.Sha256
      PsqlFileVersion = $binary.FileVersion
      PsqlProductVersion = $binary.ProductVersion
      Stdout = $stdout
      Stderr = $stderr
      StdoutSha256 = Get-M1BSha256Bytes ((Get-M1BUtf8).GetBytes($stdout))
      StderrSha256 = Get-M1BSha256Bytes ((Get-M1BUtf8).GetBytes($stderr))
    }
    if ($Campaign -cnotin @('D', 'M12')) { return $result }
  } catch {
    if ($Campaign -cnotin @('D', 'M12')) { throw }
    $firstFailure = $_
    [void](Add-M1DFailure $_)
  } finally {
    if ($Campaign -cin @('D', 'M12')) {
      $startInfo.EnvironmentVariables.Remove('PGPASSWORD')
      $stdinText = $null
      if ($started) {
        $terminationPassed = $false
        try {
          Set-M1DDiagnosticOperation 'forced-stop'
          $terminationPassed = $process.TerminateTreeAndWait((Get-M1DStopBudget))
          if (-not $terminationPassed) { Stop-M1BRail 'PSQL_PROCESS_TERMINATION_FAILED' }
        } catch { if ($null -eq $firstFailure) { $firstFailure = $_ }; [void](Add-M1DFailure $_) }
        if ($terminationPassed) {
          try { Write-M1DStopReceipt ('ADMIN_PSQL_' + $Phase.ToUpperInvariant()) $process -ReceiptContext $receiptContext }
          catch { if ($null -eq $firstFailure) { $firstFailure = $_ }; [void](Add-M1DFailure $_) }
        }
      }
      if ($null -ne $process) {
        try { $process.Dispose() }
        catch { if ($null -eq $firstFailure) { $firstFailure = $_ }; [void](Add-M1DFailure $_) }
      }
      try { $startInfo.EnvironmentVariables.Clear() }
      catch { if ($null -eq $firstFailure) { $firstFailure = $_ }; [void](Add-M1DFailure $_) }
    } else {
    $stdinText = $null
    if ($started -and $Campaign -cin @('D', 'M12')) {
      try { $terminationPassed = $process.TerminateTreeAndWait((Get-M1DStopBudget)) } catch { $terminationPassed = $false }
      if ($terminationPassed) { Write-M1DStopReceipt ('ADMIN_PSQL_' + $Phase.ToUpperInvariant()) $process }
    } elseif ($started -and -not $process.HasExited) {
      try {
        $process.Kill()
        if (-not $process.WaitForExit(30000)) { $terminationPassed = $false }
      } catch {
        try { if (-not $process.HasExited) { $terminationPassed = $false } } catch { $terminationPassed = $false }
      }
    }
    if ($null -ne $process) { $process.Dispose() }
    $startInfo.EnvironmentVariables.Clear()
    if (-not $terminationPassed) { Stop-M1BRail 'PSQL_PROCESS_TERMINATION_FAILED' }
    }
  }
  if ($null -ne $firstFailure) { throw $firstFailure }
  return $result
}

function Get-M1DGradleCachePath {
  param([string]$Root)
  if ([IO.Path]::GetFullPath($Root) -cne [IO.Path]::GetFullPath($script:DRunRoot) -or
      [IO.Path]::GetFileName($Root.TrimEnd('\')) -cne $RunId) { Stop-M1BRail 'D_GRADLE_CACHE_ROOT_INVALID' }
  $path = [IO.Path]::GetFullPath((Join-Path $Root 'volatile\preflight-readiness\gradle-home'))
  [void](Assert-M1BContainedPath $Root $path)
  Assert-M1BNoReparseAncestors $path
  return $path
}

function Assert-M1DGradleCacheBinding {
  param([object]$Binding)
  if ($null -eq $Binding) { Stop-M1BRail 'D_GRADLE_CACHE_BINDING_INVALID' }
  Assert-M1BExactProperties $Binding @('relativePath','algorithm','sha256')
  if ($Binding.relativePath -isnot [string] -or $Binding.relativePath -cne 'volatile/preflight-readiness/gradle-home' -or
      $Binding.algorithm -isnot [string] -or $Binding.algorithm -cne 'SHA256-TREE-V1' -or
      $Binding.sha256 -isnot [string] -or $Binding.sha256 -cnotmatch '^[0-9a-f]{64}$') { Stop-M1BRail 'D_GRADLE_CACHE_BINDING_INVALID' }
}

function Get-M1DGradleCacheSha256 {
  param([string]$Root)
  $cache = Get-M1DGradleCachePath $Root
  if (-not [IO.Directory]::Exists($cache)) { Stop-M1BRail 'D_GRADLE_CACHE_MISSING' }
  $records = [Collections.Generic.List[string]]::new()
  $paths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  $queue = [Collections.Generic.Queue[string]]::new(); $queue.Enqueue($cache)
  [long]$total = 0
  while ($queue.Count -gt 0) {
    Assert-M1DDeadline
    $directory = $queue.Dequeue()
    foreach ($path in [IO.Directory]::EnumerateFileSystemEntries((ConvertTo-M1BRunnerArtifactIoPath $directory))) {
      $normal = $path
      if ($normal.StartsWith('\\?\', [StringComparison]::Ordinal)) { $normal = $normal.Substring(4) }
      $relative = $normal.Substring($cache.Length + 1).Replace('\','/')
      if ($relative -cmatch '[\x00-\x1f|:]' -or -not $paths.Add($relative)) { Stop-M1BRail 'D_GRADLE_CACHE_ENTRY_INVALID' }
      $attributes = [IO.File]::GetAttributes($path)
      if (($attributes -band ([IO.FileAttributes]::ReparsePoint -bor [IO.FileAttributes]::Device)) -ne 0) { Stop-M1BRail 'D_GRADLE_CACHE_ENTRY_INVALID' }
      if (($attributes -band [IO.FileAttributes]::Directory) -ne 0) {
        $records.Add('D|' + $relative + '|0'); $queue.Enqueue($normal)
      } else {
        $file = [IO.FileInfo]::new($path)
        if (-not $file.Exists -or $file.Length -gt 1073741824) { Stop-M1BRail 'D_GRADLE_CACHE_ENTRY_INVALID' }
        $total += $file.Length
        if ($total -gt 4294967296) { Stop-M1BRail 'D_GRADLE_CACHE_SIZE_LIMIT' }
        $records.Add('F|' + $relative + '|' + $file.Length.ToString([Globalization.CultureInfo]::InvariantCulture) + '|' + (Get-M1BSha256File $path))
      }
      if ($records.Count -gt 200000) { Stop-M1BRail 'D_GRADLE_CACHE_ENTRY_LIMIT' }
    }
  }
  $sorted = $records.ToArray(); [Array]::Sort($sorted, [StringComparer]::Ordinal)
  return Get-M1BSha256Bytes ((Get-M1BUtf8).GetBytes("SHA256-TREE-V1`n" + ($sorted -join "`n") + "`n"))
}

function Assert-M1DGradleWrapperCached {
  param([string]$Root)
  $cache = Get-M1DGradleCachePath $Root
  # Match the wrapper's PathAssembler: MD5 of the distribution URI, unsigned base 36.
  # Properties are closed here so a changed bootstrap location cannot fall back online.
  $properties = [IO.File]::ReadAllText((Join-Path $script:BackendRoot 'gradle\wrapper\gradle-wrapper.properties'))
  foreach ($line in @('distributionBase=GRADLE_USER_HOME','distributionPath=wrapper/dists','zipStoreBase=GRADLE_USER_HOME','zipStorePath=wrapper/dists')) {
    if (@($properties -split '\r?\n' | Where-Object { $_ -ceq $line }).Count -ne 1) { Stop-M1BRail 'D_GRADLE_WRAPPER_LAYOUT_INVALID' }
  }
  $urls = @([regex]::Matches($properties, '(?m)^distributionUrl=https\\://services\.gradle\.org/distributions/gradle-([0-9]+\.[0-9]+\.[0-9]+)-bin\.zip\r?$'))
  if ($urls.Count -ne 1 -or @([regex]::Matches($properties, '(?m)^distributionUrl=')).Count -ne 1) { Stop-M1BRail 'D_GRADLE_WRAPPER_LAYOUT_INVALID' }
  $version = $urls[0].Groups[1].Value
  $url = 'https://services.gradle.org/distributions/gradle-' + $version + '-bin.zip'
  $md5 = [Security.Cryptography.MD5]::Create()
  try { $number = $md5.ComputeHash((Get-M1BUtf8).GetBytes($url)) } finally { $md5.Dispose() }
  $digits = '0123456789abcdefghijklmnopqrstuvwxyz'; $key = ''
  do {
    $remainder = 0; $nonzero = $false
    for ($i = 0; $i -lt $number.Length; $i++) {
      $value = $remainder * 256 + [int]$number[$i]
      $number[$i] = [byte][Math]::Floor($value / 36); $remainder = $value % 36
      if ($number[$i] -ne 0) { $nonzero = $true }
    }
    $key = $digits[$remainder] + $key
  } while ($nonzero)
  $name = 'gradle-' + $version + '-bin'
  $distribution = Join-Path $cache ('wrapper\dists\' + $name + '\' + $key)
  foreach ($relative in @(($name + '.zip.ok'), ('gradle-' + $version + '\bin\gradle.bat'), ('gradle-' + $version + '\lib\gradle-launcher-' + $version + '.jar'))) {
    $path = Join-Path $distribution $relative
    Assert-M1BNoReparseAncestors $path
    if (-not [IO.File]::Exists($path)) { Stop-M1BRail 'D_GRADLE_WRAPPER_CACHE_INCOMPLETE' }
  }
  $roots = @([IO.Directory]::GetDirectories($distribution))
  if ($roots.Count -ne 1 -or [IO.Path]::GetFileName($roots[0]) -cne ('gradle-' + $version)) { Stop-M1BRail 'D_GRADLE_WRAPPER_CACHE_INCOMPLETE' }
}

function Assert-M1DPreflightReadinessStopped {
  param([string]$Authorization)
  $intent = Read-M1DReceipt 'launch-preflight-READINESS-intent'
  $confined = Read-M1DReceipt 'launch-preflight-READINESS-confined'
  $stopped = Read-M1DReceipt 'launch-preflight-READINESS-stopped'
  foreach ($receipt in @($intent,$confined,$stopped)) {
    if ($receipt.authorizationRecordId -cne $Authorization) { Stop-M1BRail 'D_GRADLE_CACHE_CESSATION_INVALID' }
  }
  $i = $intent.payload; $c = $confined.payload; $s = $stopped.payload
  Assert-M1BExactProperties $i @('role','binaryPath','binarySha256','commandSha256','argumentFileSha256')
  Assert-M1BExactProperties $c @('role','processId','creationTimeUtcTicks','jobName','binaryPath','binarySha256','commandSha256','argumentFileSha256','confinedBeforeResume')
  Assert-M1BExactProperties $s @('processId','creationTimeUtcTicks','jobName','activeProcesses')
  foreach ($field in @('role','binaryPath','binarySha256','commandSha256','argumentFileSha256')) {
    if ($i.$field -isnot [string] -or $c.$field -isnot [string]) { Stop-M1BRail 'D_GRADLE_CACHE_CESSATION_INVALID' }
  }
  if ($c.jobName -isnot [string] -or $s.jobName -isnot [string] -or $s.creationTimeUtcTicks -isnot [string]) { Stop-M1BRail 'D_GRADLE_CACHE_CESSATION_INVALID' }
  if ($i.role -cne 'READINESS' -or $c.role -cne 'READINESS' -or $i.argumentFileSha256 -cne 'NONE' -or
      $i.binaryPath -isnot [string] -or -not [IO.Path]::IsPathRooted($i.binaryPath) -or
      $i.binarySha256 -cnotmatch '^[0-9a-f]{64}$' -or $i.commandSha256 -cnotmatch '^[0-9a-f]{64}$' -or
      -not (Test-M1BJsonInteger $c.processId) -or $c.processId -le 0 -or
      $c.creationTimeUtcTicks -isnot [string] -or $c.creationTimeUtcTicks -cnotmatch '^[1-9][0-9]{16,18}$' -or
      $c.jobName -cne ((Get-M1BJobPrefix) + $RunId + '.READINESS') -or
      $c.confinedBeforeResume -isnot [bool] -or -not $c.confinedBeforeResume -or
      -not (Test-M1BJsonInteger $s.activeProcesses) -or $s.activeProcesses -ne 0 -or
      -not (Test-M1BJsonInteger $s.processId) -or $s.processId -ne $c.processId -or
      $s.creationTimeUtcTicks -cne $c.creationTimeUtcTicks -or $s.jobName -cne $c.jobName) { Stop-M1BRail 'D_GRADLE_CACHE_CESSATION_INVALID' }
  foreach ($field in @('binaryPath','binarySha256','commandSha256','argumentFileSha256')) {
    if ($c.$field -cne $i.$field) { Stop-M1BRail 'D_GRADLE_CACHE_CESSATION_INVALID' }
  }
}

function New-M1DGradleCacheBinding {
  param([string]$Root)
  Assert-M1DPreflightReadinessStopped $SensitiveAuthorizationRecordId
  Assert-M1DGradleWrapperCached $Root
  return [pscustomobject][ordered]@{ relativePath = 'volatile/preflight-readiness/gradle-home'; algorithm = 'SHA256-TREE-V1'; sha256 = (Get-M1DGradleCacheSha256 $Root) }
}

function Initialize-M1DGradleCacheReuse {
  param([string]$Root, [object]$Preflight)
  $script:DReadinessCacheVerifiedState = $null
  Assert-M1DGradleCacheBinding $Preflight.Value.readinessCache
  Assert-M1DPreflightReadinessStopped $PreflightAuthorizationRecordId
  Assert-M1DGradleWrapperCached $Root
  if ((Get-M1DGradleCacheSha256 $Root) -cne $Preflight.Value.readinessCache.sha256) { Stop-M1BRail 'D_GRADLE_CACHE_DIGEST_DIVERGED' }
  $script:DReadinessCacheVerifiedState = [pscustomobject]@{
    RunRoot = [IO.Path]::GetFullPath($Root); RunId = $RunId; ReviewedObjectSha256 = $ReviewedObjectSha256
    LifecycleAuthorizationRecordId = $SensitiveAuthorizationRecordId; PreflightAuthorizationRecordId = $PreflightAuthorizationRecordId
    PreflightManifestSha256 = $Preflight.Sha256; GradleUserHome = (Get-M1DGradleCachePath $Root)
  }
}

function Assert-M1DGradleCacheReuse {
  param([string]$Path)
  $state = $script:DReadinessCacheVerifiedState
  if ($null -eq $state -or $state.RunRoot -cne [IO.Path]::GetFullPath($script:DRunRoot) -or
      $state.RunId -cne $RunId -or $state.ReviewedObjectSha256 -cne $ReviewedObjectSha256 -or
      $state.LifecycleAuthorizationRecordId -cne $SensitiveAuthorizationRecordId -or
      $state.PreflightAuthorizationRecordId -cne $PreflightAuthorizationRecordId -or
      $Path -cne $state.GradleUserHome -or $Path -cne (Get-M1DGradleCachePath $script:DRunRoot)) { Stop-M1BRail 'D_GRADLE_CACHE_NOT_VERIFIED' }
  # Metadata/logs may change normally after the first child. Do not re-fingerprint.
}

function Invoke-M1BGradleTask {
  param(
    [Parameter(Mandatory = $true)][ValidateSet(
      'm1BPostgresRailReadiness', 'm1BPostgresRailTargeted', 'm1BPostgresRailFull', 'm1_2PostgresRailQualification'
    )][string]$Task,
    [Parameter(Mandatory = $true)][string]$NeutralRoot,
    [Parameter(Mandatory = $true)][string]$BuildRoot,
    [Parameter(Mandatory = $true)][string]$GradleUserHome,
    [Parameter(Mandatory = $true)][hashtable]$ExtraEnvironment,
    [AllowNull()][string]$ForbiddenLiteral
  )

  if ($Campaign -cin @('D', 'M12') -and $Mode -ceq 'Lifecycle') { Assert-M1DGradleCacheReuse $GradleUserHome }
  if ($Task -ceq 'm1_2PostgresRailQualification' -and $Campaign -cne 'M12') { Stop-M1BRail 'M12_CAMPAIGN_REQUIRED' }
  Assert-M1BNoCredentialChannels
  $neutral = New-M1BNeutralEnvironment $NeutralRoot
  $javaHome = [System.Environment]::GetEnvironmentVariable('JAVA_HOME')
  if ([string]::IsNullOrWhiteSpace($javaHome)) {
    Stop-M1BRail 'JAVA_HOME_REQUIRED'
  }
  $javaExe = [System.IO.Path]::GetFullPath((Join-Path $javaHome 'bin\java.exe'))
  if (-not [System.IO.File]::Exists($javaExe)) {
    Stop-M1BRail 'JAVA_EXECUTABLE_MISSING'
  }
  $wrapperJar = Join-Path $script:BackendRoot 'gradle\wrapper\gradle-wrapper.jar'
  if (-not [System.IO.File]::Exists($wrapperJar)) {
    Stop-M1BRail 'GRADLE_WRAPPER_JAR_MISSING'
  }
  $projectCache = New-M1BDirectory (Join-Path $neutral.Root 'project-cache')
  $neutral.Values['JAVA_HOME'] = $javaHome
  $neutral.Values['Path'] = ((Join-Path $javaHome 'bin') + ';' + $neutral.Values['Path'])
  $neutral.Values['GRADLE_USER_HOME'] = $GradleUserHome
  $neutral.Values['RITOMER_DB_RAIL_BUILD_ROOT'] = $BuildRoot
  $expectedExtraNames = if ($Task -ceq 'm1BPostgresRailReadiness') {
    @(
      'RITOMER_DB_RAIL_RUN_ID',
      'RITOMER_DB_RAIL_RUN_ROOT',
      'RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256'
    )
  } else {
    @(
      'RITOMER_DB_RAIL_RUN_ID',
      'RITOMER_DB_RAIL_RUN_ROOT',
      'RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256',
      'RITOMER_DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER',
      'RITOMER_DB_RAIL_DATABASE_OID',
      'RITOMER_DB_RAIL_RUNNER_ROLE_OID',
      'RITOMER_DB_RAIL_POSTMASTER_START_UNIX_MICROS',
      'RITOMER_DB_RAIL_RUNTIME_SHA256',
      'RITOMER_DB_TESTS_ENABLED',
      'RITOMER_DB_TEST_JDBC_URL',
      'RITOMER_DB_TEST_USERNAME',
      'RITOMER_DB_TEST_PASSWORD',
      'RITOMER_DB_TEST_DESTRUCTIVE_CONSENT',
      'RITOMER_DB_TEST_RUN_ROOT',
      'RITOMER_DB_TEST_PHASE',
      'RITOMER_DB_TEST_STORAGE_LOCAL_ROOT',
      'RITOMER_DB_TEST_APPLICATION_NAME'
    )
  }
  $actualExtraNames = @($ExtraEnvironment.Keys | ForEach-Object { [string]$_ })
  if ($Campaign -cin @('D', 'M12')) {
    $neutral.Values['RITOMER_DB_RAIL_CAMPAIGN'] = $Campaign
  }
  if ($Task -ceq 'm1_2PostgresRailQualification') {
    if ($script:M12RuntimeManifestSha256 -cnotmatch '^[0-9a-f]{64}$' -or
        (Get-M1BSha256File (Join-Path $BuildRoot 'm12-runtime.json')) -cne $script:M12RuntimeManifestSha256) { Stop-M1BRail 'M12_RUNTIME_MANIFEST_CHANGED' }
    $neutral.Values['RITOMER_DB_RAIL_M12_MANIFEST_SHA256'] = $script:M12RuntimeManifestSha256
  }
  if (
    $actualExtraNames.Count -ne $expectedExtraNames.Count -or
    @($actualExtraNames | Where-Object { -not ($expectedExtraNames -ccontains $_) }).Count -ne 0
  ) {
    Stop-M1BRail 'GRADLE_CHILD_ENVIRONMENT_ALLOWLIST_MISMATCH'
  }
  foreach ($entry in $ExtraEnvironment.GetEnumerator()) {
    $name = [string]$entry.Key
    if ($name.StartsWith('PG', [System.StringComparison]::OrdinalIgnoreCase) -or $null -eq $entry.Value) {
      Stop-M1BRail 'GRADLE_CHILD_ENVIRONMENT_INVALID'
    }
    $neutral.Values[$name] = [string]$entry.Value
  }
  $arguments = @(
    ('-Duser.home=' + $neutral.Home),
    ('-Djava.io.tmpdir=' + $neutral.Temp),
    '-Duser.name=ritomer-m1b-rail',
    '-Djava.net.useSystemProxies=false',
    ('-XX:ErrorFile=' + (Join-Path $neutral.Root 'hs_err_pid%p.log')),
    ('-XX:HeapDumpPath=' + (Join-Path $neutral.Root 'heapdump_pid%p.hprof')),
    '-XX:-HeapDumpOnOutOfMemoryError',
    '-classpath',
    $wrapperJar,
    'org.gradle.wrapper.GradleWrapperMain',
    '--no-daemon',
    '--no-build-cache',
    '--rerun-tasks',
    '--console=plain',
    '--max-workers=1',
    '--project-cache-dir',
    $projectCache,
    '--project-dir',
    $script:BackendRoot,
    '-Pkotlin.compiler.execution.strategy=in-process',
    $Task
  )
  if ($Campaign -cin @('D', 'M12') -and $Mode -ceq 'Lifecycle') { $arguments += '--offline' }
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $javaExe
  $startInfo.Arguments = ($arguments | ForEach-Object { ConvertTo-M1BProcessArgument ([string]$_) }) -join ' '
  $startInfo.WorkingDirectory = $neutral.Root
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.StandardOutputEncoding = Get-M1BUtf8
  $startInfo.StandardErrorEncoding = Get-M1BUtf8
  $startInfo.EnvironmentVariables.Clear()
  foreach ($entry in $neutral.Values.GetEnumerator()) {
    $startInfo.EnvironmentVariables[[string]$entry.Key] = [string]$entry.Value
  }
  Initialize-M1BContainedProcessType
  $process = $null
  $started = $false
  $treeTerminationPassed = $true
  $stdout = $null
  $stderr = $null
  $combined = $null
  $runtimeSha256 = $null
  $firstFailure = $null
  try {
    try {
      if ($Campaign -cin @('D', 'M12')) {
        $startInfo.RedirectStandardInput = $true
        $dRole = switch ($Task) {
          'm1BPostgresRailReadiness' { 'READINESS' }
          'm1BPostgresRailTargeted' { 'TARGETED' }
          'm1BPostgresRailFull' { 'FULL' }
          'm1_2PostgresRailQualification' { 'QUALIFICATION' }
        }
        $process = Start-M1DContainedChild $startInfo $dRole
        $process.StandardInput.Close()
      } else {
        $process = [Ritomer.M1B.ContainedProcess]::Start($startInfo)
      }
    } catch {
      Stop-M1BRail 'GRADLE_CONTAINED_CHILD_START_FAILED'
    }
    $started = $true
    $taskTimeoutMilliseconds = if (
      $Task -ceq 'm1BPostgresRailReadiness'
    ) {
      1800000
    } elseif ($Task -ceq 'm1_2PostgresRailQualification' -and $Campaign -ceq 'M12') {
      1680000
    } else {
      1200000
    }
    if ($Campaign -cin @('D', 'M12')) { Set-M1DDiagnosticOperation 'child-drain' }
    $captured = Read-M1BBoundedProcessStreams `
      -Process $process `
      -LimitChars 8388608 `
      -TimeoutMilliseconds $taskTimeoutMilliseconds `
      -TerminateTreeWhenRootExits
    $stdout = $captured.Stdout
    $stderr = $captured.Stderr
    if (-not [string]::IsNullOrEmpty($ForbiddenLiteral)) {
      if ($stdout.Contains($ForbiddenLiteral) -or $stderr.Contains($ForbiddenLiteral)) {
        Stop-M1BRail 'RUNNER_SECRET_OUTPUT_CONTAMINATION'
      }
    }
    if ($process.ExitCode -ne 0) {
      Stop-M1BRail ('GRADLE_' + $Task.ToUpperInvariant() + '_FAILED')
    }
    $combined = $stdout + "`n" + $stderr
    if ($Task -ceq 'm1BPostgresRailReadiness') {
      if (
        -not $combined.Contains('M1B_POSTGRES_RAIL_READINESS=PASS') -or
        -not $combined.Contains('M1B_POSTGRES_RAIL_DATABASE_EXECUTION=NONE')
      ) {
        Stop-M1BRail 'READINESS_PASS_MARKERS_MISSING'
      }
      $runtimeMatches = [regex]::Matches(
        $combined,
        '(?m)^M1B_POSTGRES_RAIL_RUNTIME_SHA256=([0-9a-f]{64})\r?$'
      )
      if ($runtimeMatches.Count -ne 1) { Stop-M1BRail 'READINESS_RUNTIME_SHA256_INVALID' }
      $runtimeSha256 = [string]$runtimeMatches[0].Groups[1].Value
      if ($Campaign -ceq 'D') {
        $manifestMatches = [regex]::Matches($combined, '(?m)^M1D_INTEGRATED_MANIFEST_SHA256=([0-9a-f]{64})\r?$')
        if ($manifestMatches.Count -ne 1) { Stop-M1BRail 'D_INTEGRATED_MANIFEST_HASH_MISSING' }
        $script:DIntegratedManifestSha256 = [string]$manifestMatches[0].Groups[1].Value
      }
      if ($Campaign -ceq 'M12') {
        $manifestMatches = [regex]::Matches($combined, '(?m)^M12_RUNTIME_MANIFEST_SHA256=([0-9a-f]{64})\r?$')
        if ($manifestMatches.Count -ne 1) { Stop-M1BRail 'M12_RUNTIME_MANIFEST_HASH_MISSING' }
        $script:M12RuntimeManifestSha256 = [string]$manifestMatches[0].Groups[1].Value
      }
    } else {
      $runtimeSha256 = [string]$ExtraEnvironment['RITOMER_DB_RAIL_RUNTIME_SHA256']
      if (
        $runtimeSha256 -cnotmatch '^[0-9a-f]{64}$' -or
        -not $combined.Contains('M1B_POSTGRES_RAIL_RUNTIME_SHA256_VERIFIED=' + $runtimeSha256) -or
        -not $combined.Contains('M1B_POSTGRES_RAIL_RUNTIME_SHA256_REVALIDATED=' + $runtimeSha256)
      ) {
        Stop-M1BRail 'TEST_RUNTIME_SHA256_MARKERS_MISSING'
      }
    }
    if ($Task -ceq 'm1BPostgresRailTargeted') {
      if (-not $combined.Contains('M1B_POSTGRES_RAIL_TARGETED=PASS')) {
        Stop-M1BRail 'TARGETED_PASS_MARKER_MISSING'
      }
    } elseif ($Task -ceq 'm1BPostgresRailFull' -and -not $combined.Contains('M1B_POSTGRES_RAIL_FULL=PASS')) {
      Stop-M1BRail 'FULL_PASS_MARKER_MISSING'
    }
    if ($Task -ceq 'm1_2PostgresRailQualification' -and (
        -not $combined.Contains('M1B_POSTGRES_RAIL_M12-QUALIFICATION=PASS') -or
        -not $combined.Contains('M1B_POSTGRES_RAIL_M12-QUALIFICATION_CLASSES=1') -or
        -not $combined.Contains('M1B_POSTGRES_RAIL_M12-QUALIFICATION_TESTS=5'))) { Stop-M1BRail 'M12_QUALIFICATION_PASS_MARKERS_MISSING' }
    $result = [pscustomobject][ordered]@{
      Task = $Task
      ExitCode = [int]$process.ExitCode
      OutputSha256 = Get-M1BSha256Bytes ((Get-M1BUtf8).GetBytes($combined))
      RuntimeSha256 = $runtimeSha256
    }
    if ($Campaign -cnotin @('D', 'M12')) { return $result }
  } catch {
    if ($Campaign -cnotin @('D', 'M12')) { throw }
    $firstFailure = $_
    [void](Add-M1DFailure $_)
  } finally {
    if ($Campaign -cin @('D', 'M12')) {
      if ($started) {
        $treeTerminationPassed = $false
        try {
          Set-M1DDiagnosticOperation 'forced-stop'
          $terminationBudget = if ($Campaign -ceq 'M12') { Get-M1DStopBudget } else { 30000 }
          $treeTerminationPassed = $process.TerminateTreeAndWait($terminationBudget)
          if (-not $treeTerminationPassed) { Stop-M1BRail 'GRADLE_PROCESS_TREE_TERMINATION_FAILED' }
        } catch { if ($null -eq $firstFailure) { $firstFailure = $_ }; [void](Add-M1DFailure $_) }
        if ($treeTerminationPassed) {
          try { Write-M1DStopReceipt $dRole $process }
          catch { if ($null -eq $firstFailure) { $firstFailure = $_ }; [void](Add-M1DFailure $_) }
        }
      }
      if ($null -ne $process) {
        try { $process.Dispose() }
        catch { if ($null -eq $firstFailure) { $firstFailure = $_ }; [void](Add-M1DFailure $_) }
      }
      if ($null -ne $startInfo) {
        try { $startInfo.EnvironmentVariables.Clear() }
        catch { if ($null -eq $firstFailure) { $firstFailure = $_ }; [void](Add-M1DFailure $_) }
      }
      try { if ($null -ne $neutral -and $neutral.Values.Contains('RITOMER_DB_TEST_PASSWORD')) { $neutral.Values.Remove('RITOMER_DB_TEST_PASSWORD') } }
      catch { if ($null -eq $firstFailure) { $firstFailure = $_ }; [void](Add-M1DFailure $_) }
      try { if ($ExtraEnvironment.ContainsKey('RITOMER_DB_TEST_PASSWORD')) { $ExtraEnvironment['RITOMER_DB_TEST_PASSWORD'] = $null; $ExtraEnvironment.Remove('RITOMER_DB_TEST_PASSWORD') } }
      catch { if ($null -eq $firstFailure) { $firstFailure = $_ }; [void](Add-M1DFailure $_) }
      $ForbiddenLiteral = $null; $stdout = $null; $stderr = $null; $combined = $null; $runtimeSha256 = $null
    } else {
    if ($started) {
      try {
        if (-not $process.TerminateTreeAndWait(30000)) {
          $treeTerminationPassed = $false
        }
      } catch {
        $treeTerminationPassed = $false
      }
      if ($treeTerminationPassed -and $Campaign -cin @('D', 'M12')) { Write-M1DStopReceipt $dRole $process }
    }
    if ($null -ne $process) {
      try {
        $process.Dispose()
      } catch {
        $treeTerminationPassed = $false
      }
    }
    if ($null -ne $startInfo) {
      $startInfo.EnvironmentVariables.Clear()
    }
    if ($null -ne $neutral -and $neutral.Values.Contains('RITOMER_DB_TEST_PASSWORD')) {
      $neutral.Values.Remove('RITOMER_DB_TEST_PASSWORD')
    }
    if ($ExtraEnvironment.ContainsKey('RITOMER_DB_TEST_PASSWORD')) {
      $ExtraEnvironment['RITOMER_DB_TEST_PASSWORD'] = $null
      $ExtraEnvironment.Remove('RITOMER_DB_TEST_PASSWORD')
    }
    $ForbiddenLiteral = $null
    $stdout = $null
    $stderr = $null
    $combined = $null
    $runtimeSha256 = $null
    if (-not $treeTerminationPassed) {
      Stop-M1BRail 'GRADLE_PROCESS_TREE_TERMINATION_FAILED'
    }
    }
  }
  if ($null -ne $firstFailure) { throw $firstFailure }
  return $result
}

function Invoke-M1BReadiness {
  param(
    [Parameter(Mandatory = $true)][string]$RunRoot,
    [Parameter(Mandatory = $true)][string]$PhaseName,
    [Parameter(Mandatory = $true)][string]$RunId,
    [Parameter(Mandatory = $true)][string]$ReviewedObjectSha256
  )

  $phaseRoot = New-M1BDirectory (Join-Path $RunRoot ('volatile\' + $PhaseName))
  $buildRoot = New-M1BDirectory (Join-Path $phaseRoot 'build')
  $gradleHome = if ($Campaign -cin @('D', 'M12') -and $Mode -ceq 'Lifecycle') {
    $cache = Get-M1DGradleCachePath $RunRoot
    Assert-M1DGradleCacheReuse $cache
    $cache
  } else { New-M1BDirectory (Join-Path $phaseRoot 'gradle-home') }
  $result = Invoke-M1BGradleTask `
    -Task 'm1BPostgresRailReadiness' `
    -NeutralRoot (Join-Path $phaseRoot 'child') `
    -BuildRoot $buildRoot `
    -GradleUserHome $gradleHome `
    -ExtraEnvironment @{
      'RITOMER_DB_RAIL_RUN_ID' = $RunId
      'RITOMER_DB_RAIL_RUN_ROOT' = $RunRoot
      'RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256' = $ReviewedObjectSha256
    }
  return [pscustomobject][ordered]@{
    Result = $result
    BuildRoot = $buildRoot
    GradleUserHome = $gradleHome
  }
}

function Assert-M1BGitExecutable {
  Assert-M1BNoReparseAncestors $script:GitExeExact
  if (-not [System.IO.File]::Exists($script:GitExeExact)) {
    Stop-M1BRail 'GIT_EXECUTABLE_MISSING'
  }
  $item = Get-Item -LiteralPath $script:GitExeExact -Force
  if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    Stop-M1BRail 'GIT_EXECUTABLE_REPARSE_POINT_REJECTED'
  }
  $resolved = [System.IO.Path]::GetFullPath($item.FullName)
  if (-not [string]::Equals($resolved, $script:GitExeExact, [System.StringComparison]::OrdinalIgnoreCase)) {
    Stop-M1BRail 'GIT_EXECUTABLE_PATH_INVALID'
  }
  return $resolved
}

function Invoke-M1BGit {
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [hashtable]$ExtraEnvironment = @{},
    [ValidateRange(1, 8388608)][int]$LimitChars = 1048576
  )

  Assert-M1BNoCredentialChannels
  if (
    $ExtraEnvironment.Count -gt 1 -or
    @($ExtraEnvironment.Keys | Where-Object { [string]$_ -cne 'GIT_INDEX_FILE' }).Count -ne 0
  ) {
    Stop-M1BRail 'GIT_CHILD_ENVIRONMENT_INVALID'
  }
  $gitExe = Assert-M1BGitExecutable
  $systemRoot = [System.Environment]::GetEnvironmentVariable('SystemRoot')
  if ([string]::IsNullOrWhiteSpace($systemRoot)) { Stop-M1BRail 'SYSTEM_ROOT_REQUIRED' }
  $gitRoot = [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $gitExe) '..'))
  $gitPath = @(
    (Join-Path $gitRoot 'cmd'),
    (Join-Path $gitRoot 'mingw64\bin'),
    (Join-Path $gitRoot 'usr\bin'),
    (Join-Path $systemRoot 'System32')
  ) -join ';'
  $environment = [ordered]@{
    'SystemRoot' = $systemRoot
    'WINDIR' = $systemRoot
    'OS' = 'Windows_NT'
    'Path' = $gitPath
    'HOME' = $script:RepoRoot
    'USERPROFILE' = $script:RepoRoot
    'TEMP' = (Join-Path $systemRoot 'Temp')
    'TMP' = (Join-Path $systemRoot 'Temp')
    'GIT_CONFIG_NOSYSTEM' = '1'
    'GIT_CONFIG_GLOBAL' = 'NUL'
    'GIT_CONFIG_COUNT' = '0'
    'GIT_OPTIONAL_LOCKS' = '0'
    'GIT_TERMINAL_PROMPT' = '0'
    'GIT_PAGER' = 'cat'
    'LC_ALL' = 'C'
  }
  if ($ExtraEnvironment.ContainsKey('GIT_INDEX_FILE')) {
    $indexPath = [System.IO.Path]::GetFullPath([string]$ExtraEnvironment['GIT_INDEX_FILE'])
    [void](Assert-M1BContainedPath $script:EvidenceBaseRoot $indexPath)
    Assert-M1BNoReparseAncestors ([System.IO.Path]::GetDirectoryName($indexPath))
    $environment['GIT_INDEX_FILE'] = $indexPath
  }
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $gitExe
  $allArguments = @('--no-pager') + $Arguments
  $startInfo.Arguments = ($allArguments | ForEach-Object { ConvertTo-M1BProcessArgument ([string]$_) }) -join ' '
  $startInfo.WorkingDirectory = $script:RepoRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.StandardOutputEncoding = Get-M1BUtf8
  $startInfo.StandardErrorEncoding = Get-M1BUtf8
  $startInfo.EnvironmentVariables.Clear()
  foreach ($entry in $environment.GetEnumerator()) {
    $startInfo.EnvironmentVariables[[string]$entry.Key] = [string]$entry.Value
  }
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  $started = $false
  $terminationPassed = $true
  try {
    if (-not $process.Start()) { Stop-M1BRail 'GIT_START_FAILED' }
    $started = $true
    $captured = Read-M1BBoundedProcessStreams `
      -Process $process -LimitChars $LimitChars -TimeoutMilliseconds 30000
    if ($process.ExitCode -ne 0 -or $captured.Stderr.Length -ne 0) {
      Stop-M1BRail 'GIT_COMMAND_FAILED'
    }
    return $captured.Stdout
  } finally {
    if ($started -and -not $process.HasExited) {
      try {
        $process.Kill()
        if (-not $process.WaitForExit(30000)) { $terminationPassed = $false }
      } catch {
        try { if (-not $process.HasExited) { $terminationPassed = $false } } catch { $terminationPassed = $false }
      }
    }
    $process.Dispose()
    $startInfo.EnvironmentVariables.Clear()
    if (-not $terminationPassed) { Stop-M1BRail 'GIT_PROCESS_TERMINATION_FAILED' }
  }
}

function Assert-M1BReviewedObject {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9-]{3,64}$')][string]$Phase
  )

  $phaseRoot = New-M1BDirectory (Join-Path $Root ('volatile\reviewed-object-' + $Phase))
  $indexPath = Join-Path $phaseRoot 'index'
  $indexEnvironment = @{ 'GIT_INDEX_FILE' = $indexPath }
  try {
    [void](Invoke-M1BGit -Arguments @('read-tree', $script:ExpectedHead) -ExtraEnvironment $indexEnvironment)
    foreach ($path in $script:ExpectedAddedFileSet) {
      $cacheInfo = '100644,e69de29bb2d1d6434b8b29ae775ad8c2e48c5391,' + $path
      [void](Invoke-M1BGit `
        -Arguments @('update-index', '--add', '--cacheinfo', $cacheInfo) `
        -ExtraEnvironment $indexEnvironment)
    }
    $diffArguments = @(
      'diff', '--binary', '--full-index', '--no-color', '--no-ext-diff', '--no-textconv',
      '--no-renames', '--src-prefix=a/', '--dst-prefix=b/', $script:ExpectedHead, '--'
    ) + $script:CompositeFileSet
    $diff = Invoke-M1BGit `
      -Arguments $diffArguments -ExtraEnvironment $indexEnvironment -LimitChars 8388608
    if ([string]::IsNullOrEmpty($diff)) { Stop-M1BRail 'REVIEWED_OBJECT_DIFF_EMPTY' }
    $bytes = (Get-M1BUtf8).GetBytes($diff)
    $actualHash = Get-M1BSha256Bytes $bytes
    if ($actualHash -cne $ReviewedObjectSha256) {
      Stop-M1BRail 'REVIEWED_OBJECT_SHA256_DIVERGED'
    }
    return [pscustomobject][ordered]@{
      Sha256 = $actualHash
      SizeBytes = [long]$bytes.Length
    }
  } finally {
    $diff = $null
    $bytes = $null
    if ([System.IO.File]::Exists($indexPath)) {
      Assert-M1BNoReparseAncestors $indexPath
      [System.IO.File]::Delete($indexPath)
    }
  }
}

function Assert-M1BExecutionState {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Phase
  )

  $baseline = Get-M1BGitBaseline
  $reviewed = Assert-M1BReviewedObject $Root $Phase
  return [pscustomobject][ordered]@{
    Baseline = $baseline
    Reviewed = $reviewed
  }
}

function Get-M1BGitBaseline {
  $topLevel = (Invoke-M1BGit @('rev-parse', '--show-toplevel')).Trim()
  if (-not [string]::Equals(
    [System.IO.Path]::GetFullPath($topLevel),
    $script:RepoRoot,
    [System.StringComparison]::OrdinalIgnoreCase
  )) {
    Stop-M1BRail 'GIT_TOP_LEVEL_DIVERGED'
  }
  $branch = (Invoke-M1BGit @('branch', '--show-current')).Trim()
  $head = (Invoke-M1BGit @('rev-parse', 'HEAD')).Trim()
  if ($branch -cne $script:ExpectedBranch -or $head -cne $script:ExpectedHead) {
    Stop-M1BRail 'GIT_BASELINE_DIVERGED'
  }
  $trackedFlagsRaw = Invoke-M1BGit @('ls-files', '-v', '-z')
  $trackedFlags = @($trackedFlagsRaw.Split([char[]]@([char]0), [System.StringSplitOptions]::RemoveEmptyEntries))
  if (
    $trackedFlags.Count -le 0 -or
    @($trackedFlags | Where-Object { $_.Length -lt 3 -or $_[0] -cne 'H' -or $_[1] -cne ' ' }).Count -ne 0
  ) {
    Stop-M1BRail 'GIT_TRACKED_PATH_FLAGS_INVALID'
  }
  $statusRaw = Invoke-M1BGit @('status', '--porcelain=v1', '-z', '--untracked-files=all')
  $entries = @($statusRaw.Split([char[]]@([char]0), [System.StringSplitOptions]::RemoveEmptyEntries))
  if ($entries.Count -ne $script:CompositeFileSet.Count) {
    Stop-M1BRail 'GIT_COMPOSITE_COUNT_DIVERGED'
  }
  $statusByPath = @{}
  foreach ($entry in $entries) {
    if ($entry.Length -lt 4 -or $entry[2] -cne ' ') { Stop-M1BRail 'GIT_STATUS_SHAPE_INVALID' }
    $state = $entry.Substring(0, 2)
    $path = $entry.Substring(3).Replace('\', '/')
    if ($statusByPath.ContainsKey($path)) { Stop-M1BRail 'GIT_STATUS_DUPLICATE_PATH' }
    if ($state -cne '??' -and $state -cne ' M') { Stop-M1BRail 'GIT_INDEX_OR_STATUS_DIVERGED' }
    $statusByPath[$path] = $state
  }
  foreach ($path in $script:CompositeFileSet) {
    if (-not $statusByPath.ContainsKey($path)) { Stop-M1BRail 'GIT_COMPOSITE_PATH_DIVERGED' }
  }
  foreach ($path in $script:CompositeFileSet) {
    $expectedState = if ($script:ExpectedAddedFileSet -ccontains $path) { '??' } else { ' M' }
    if ([string]$statusByPath[$path] -cne $expectedState) { Stop-M1BRail 'GIT_COMPOSITE_STATE_DIVERGED' }
  }
  if ((Invoke-M1BGit @('diff', '--cached', '--name-only')).Length -ne 0) {
    Stop-M1BRail 'GIT_INDEX_NOT_EMPTY'
  }
  if ((Invoke-M1BGit @('diff', '--check')).Length -ne 0) { Stop-M1BRail 'GIT_DIFF_CHECK_FAILED' }
  return [pscustomobject][ordered]@{
    Branch = $branch
    Head = $head
    CorrectiveFileSet = $script:CorrectiveFileSetSummary
    CompositeFileSet = $script:CompositeFileSetSummary
  }
}

function Assert-M1BInvocation {
  if ($LifecycleAction -ceq 'CleanupOnly' -and ($Campaign -cnotin @('D', 'M12') -or $Mode -cne 'Lifecycle')) {
    Stop-M1BRail 'D_CLEANUP_ONLY_MODE_REQUIRED'
  }
  if (
    [string]::IsNullOrEmpty($Mode) -or
    $RunId -cnotmatch '^[0-9a-f]{32}$' -or
    $ReviewedObjectSha256 -cnotmatch '^[0-9a-f]{64}$' -or
    $ExpectedPsqlSha256 -cnotmatch '^[0-9a-f]{64}$' -or
    [string]::IsNullOrWhiteSpace($RunRoot) -or
    $SensitiveAuthorizationRecordId -cnotmatch '^AUTH-[A-Z0-9][A-Z0-9._:-]{0,122}$'
  ) {
    Stop-M1BRail 'INVOCATION_BINDING_INVALID'
  }
  if (
    ($Mode -ceq 'Preflight' -and -not [string]::IsNullOrEmpty($PreflightAuthorizationRecordId)) -or
    ($Mode -ceq 'Lifecycle' -and (
      $PreflightAuthorizationRecordId -cnotmatch '^AUTH-[A-Z0-9][A-Z0-9._:-]{0,122}$' -or
      $PreflightAuthorizationRecordId -ceq $SensitiveAuthorizationRecordId
    ))
  ) {
    Stop-M1BRail 'AUTHORIZATION_RECORD_BINDING_INVALID'
  }
  $expectedRoot = if ($Campaign -ceq 'D') { 'C:\dev\ritomer-m1-1d-playwright' } else { 'C:\dev\ritomer' }
  if (-not [string]::Equals($script:RepoRoot, $expectedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    Stop-M1BRail 'REPOSITORY_ROOT_INVALID'
  }
  Assert-M1BNoCredentialChannels
  $expectedRunRoot = [System.IO.Path]::GetFullPath((Join-Path $script:EvidenceBaseRoot $RunId))
  $requestedRunRoot = [System.IO.Path]::GetFullPath($RunRoot)
  if (-not [string]::Equals($requestedRunRoot, $expectedRunRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    Stop-M1BRail 'RUN_ROOT_BINDING_INVALID'
  }
  [void](Assert-M1BContainedPath $script:EvidenceBaseRoot $requestedRunRoot)
  return $requestedRunRoot
}

function Enter-M1BRunLock {
  param([Parameter(Mandatory = $true)][string]$Root)

  [void](Assert-M1BContainedPath $script:EvidenceBaseRoot $Root)
  Assert-M1BNoReparseAncestors $script:EvidenceBaseRoot
  $lockPath = Join-Path $script:EvidenceBaseRoot '.m1b-exclusive.lock'
  try {
    $lockMode = if ($Campaign -cin @('D', 'M12')) { [System.IO.FileMode]::OpenOrCreate } else { [System.IO.FileMode]::CreateNew }
    $stream = [System.IO.File]::Open(
      $lockPath,
      $lockMode,
      [System.IO.FileAccess]::ReadWrite,
      [System.IO.FileShare]::None
    )
  } catch {
    Stop-M1BRail 'RUN_LOCK_UNAVAILABLE'
  }
  return [pscustomobject][ordered]@{ Path = $lockPath; Stream = $stream }
}

function Exit-M1BRunLock {
  param([Parameter(Mandatory = $true)][psobject]$Lock)

  $Lock.Stream.Dispose()
  if ($Campaign -cnotin @('D', 'M12')) { [System.IO.File]::Delete([string]$Lock.Path) }
}

function Write-M1BCreateNewUtf8 {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Text
  )

  $bytes = (Get-M1BUtf8).GetBytes($Text)
  $stream = [System.IO.File]::Open(
    $Path,
    [System.IO.FileMode]::CreateNew,
    [System.IO.FileAccess]::Write,
    [System.IO.FileShare]::None
  )
  try {
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush($true)
  } finally {
    $stream.Dispose()
  }
}

function Write-M1BManifest {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][ValidateSet('preflight', 'lifecycle')][string]$Name,
    [Parameter(Mandatory = $true)][psobject]$Value
  )

  $json = (ConvertTo-Json -InputObject $Value -Depth 8 -Compress) + "`n"
  if ($json.Contains('SCRAM-SHA-256$') -or $json.Contains('M1B_CLIENT|')) {
    Stop-M1BRail 'MANIFEST_SECRET_OR_RAW_OUTPUT_REJECTED'
  }
  $path = Join-Path $Root ($Name + '-manifest.json')
  Write-M1BCreateNewUtf8 $path $json
  $hash = Get-M1BSha256File $path
  $hashPath = $path + '.sha256'
  Write-M1BCreateNewUtf8 $hashPath ($hash + "`n")
  return [pscustomobject][ordered]@{
    Path = $path
    SizeBytes = [long](Get-Item -LiteralPath $path).Length
    Sha256 = $hash
    HashPath = $hashPath
  }
}

function Read-M1BPreflightManifest {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$ExpectedRunId,
    [Parameter(Mandatory = $true)][string]$ExpectedReviewedObjectSha256,
    [Parameter(Mandatory = $true)][string]$ExpectedPreflightAuthorizationRecordId,
    [Parameter(Mandatory = $true)][psobject]$Baseline
  )

  $path = Join-Path $Root 'preflight-manifest.json'
  $hashPath = $path + '.sha256'
  if (-not [System.IO.File]::Exists($path) -or -not [System.IO.File]::Exists($hashPath)) {
    Stop-M1BRail 'PREFLIGHT_MANIFEST_MISSING'
  }
  Assert-M1BNoReparseAncestors $path
  Assert-M1BNoReparseAncestors $hashPath
  $hashStream = [System.IO.File]::Open(
    $hashPath,
    [System.IO.FileMode]::Open,
    [System.IO.FileAccess]::Read,
    [System.IO.FileShare]::Read
  )
  try {
    if ($hashStream.Length -ne 65) { Stop-M1BRail 'PREFLIGHT_MANIFEST_HASH_SIZE_INVALID' }
    $hashBytes = [byte[]]::new(65)
    $hashOffset = 0
    while ($hashOffset -lt $hashBytes.Length) {
      $read = $hashStream.Read($hashBytes, $hashOffset, $hashBytes.Length - $hashOffset)
      if ($read -le 0) { Stop-M1BRail 'PREFLIGHT_MANIFEST_HASH_READ_INCOMPLETE' }
      $hashOffset += $read
    }
    if ($hashStream.Length -ne 65 -or $hashStream.Position -ne 65) {
      Stop-M1BRail 'PREFLIGHT_MANIFEST_HASH_CHANGED_DURING_READ'
    }
  } finally {
    $hashStream.Dispose()
  }
  try {
    $hashText = (Get-M1BUtf8).GetString($hashBytes)
  } catch {
    Stop-M1BRail 'PREFLIGHT_MANIFEST_HASH_ENCODING_INVALID'
  } finally {
    $hashBytes = $null
  }
  if ($hashText -cnotmatch '^[0-9a-f]{64}\n\z') {
    Stop-M1BRail 'PREFLIGHT_MANIFEST_HASH_FORMAT_INVALID'
  }
  $expectedHash = $hashText.Substring(0, 64)
  $hashText = $null
  $manifestStream = [System.IO.File]::Open(
    $path,
    [System.IO.FileMode]::Open,
    [System.IO.FileAccess]::Read,
    [System.IO.FileShare]::Read
  )
  try {
    $manifestLength = [long]$manifestStream.Length
    if ($manifestLength -le 0 -or $manifestLength -gt 65536) {
      Stop-M1BRail 'PREFLIGHT_MANIFEST_SIZE_INVALID'
    }
    $manifestBytes = [byte[]]::new([int]$manifestLength)
    $manifestOffset = 0
    while ($manifestOffset -lt $manifestBytes.Length) {
      $read = $manifestStream.Read($manifestBytes, $manifestOffset, $manifestBytes.Length - $manifestOffset)
      if ($read -le 0) { Stop-M1BRail 'PREFLIGHT_MANIFEST_READ_INCOMPLETE' }
      $manifestOffset += $read
    }
    if ($manifestStream.Length -ne $manifestLength) { Stop-M1BRail 'PREFLIGHT_MANIFEST_CHANGED_DURING_READ' }
  } finally {
    $manifestStream.Dispose()
  }
  $actualHash = Get-M1BSha256Bytes $manifestBytes
  if ($expectedHash -cnotmatch '^[0-9a-f]{64}$' -or $actualHash -cne $expectedHash) {
    Stop-M1BRail 'PREFLIGHT_MANIFEST_HASH_INVALID'
  }
  Assert-M1BNoDuplicateJsonProperties $manifestBytes
  try {
    $manifestJson = (Get-M1BUtf8).GetString($manifestBytes)
    $manifest = ConvertFrom-Json -InputObject $manifestJson
  } catch {
    Stop-M1BRail 'PREFLIGHT_MANIFEST_JSON_INVALID'
  } finally {
    $manifestJson = $null
    $manifestBytes = $null
  }
  $preflightProperties = @(
    'schemaVersion', 'kind', 'verdict', 'createdAtUtc', 'runId', 'reviewedObjectSha256',
    'reviewedDiffSizeBytes', 'sensitiveAuthorizationRecordId', 'branch', 'head',
    'correctiveFileSet', 'compositeFileSet', 'readinessOutputSha256', 'runtimeSha256', 'psql', 'process',
    'observation', 'structuredOutputSha256', 'payloadSha256'
  )
  if ($Campaign -ceq 'D') { $preflightProperties += @('campaignStartTimestamp','stopwatchFrequency','machine','namespaceIdentity','frontendRuntimeSha256','readinessCache') }
  if ($Campaign -ceq 'M12') { $preflightProperties += @('campaignStartTimestamp','stopwatchFrequency','machine','namespaceIdentity','m12RuntimeManifestSha256','readinessCache') }
  Assert-M1BExactProperties $manifest $preflightProperties
  if ($Campaign -cin @('D', 'M12')) { Assert-M1DGradleCacheBinding $manifest.readinessCache }
  if (
    -not (Test-M1BJsonInteger $manifest.schemaVersion) -or [int]$manifest.schemaVersion -ne 1 -or
    $manifest.kind -isnot [string] -or
    [string]$manifest.kind -cne ($(if ($Campaign -ceq 'M12') { 'M12' } else { 'M1' + $Campaign }) + '_POSTGRES_PREFLIGHT') -or
    $manifest.verdict -isnot [string] -or
    [string]$manifest.verdict -cne 'PASS' -or
    $manifest.runId -isnot [string] -or
    [string]$manifest.runId -cne $ExpectedRunId -or
    $manifest.reviewedObjectSha256 -isnot [string] -or
    [string]$manifest.reviewedObjectSha256 -cne $ExpectedReviewedObjectSha256 -or
    -not (Test-M1BJsonInteger $manifest.reviewedDiffSizeBytes) -or
    [long]$manifest.reviewedDiffSizeBytes -le 0 -or
    [long]$manifest.reviewedDiffSizeBytes -gt 8388608 -or
    $manifest.sensitiveAuthorizationRecordId -isnot [string] -or
    [string]$manifest.sensitiveAuthorizationRecordId -cne $ExpectedPreflightAuthorizationRecordId -or
    $manifest.branch -isnot [string] -or
    [string]$manifest.branch -cne [string]$Baseline.Branch -or
    $manifest.head -isnot [string] -or
    [string]$manifest.head -cne [string]$Baseline.Head -or
    $manifest.correctiveFileSet -isnot [string] -or
    [string]$manifest.correctiveFileSet -cne $script:CorrectiveFileSetSummary -or
    $manifest.compositeFileSet -isnot [string] -or
    [string]$manifest.compositeFileSet -cne $script:CompositeFileSetSummary
  ) {
    Stop-M1BRail 'PREFLIGHT_MANIFEST_BINDING_INVALID'
  }
  Assert-M1BExactProperties $manifest.process @('processId', 'processCount')
  Assert-M1BExactProperties $manifest.psql @(
    'path', 'sha256', 'fileVersion', 'productVersion', 'clientVersionNum'
  )
  Assert-M1BExactProperties $manifest.observation @(
    'serverVersionNum', 'serverAddress', 'serverPort', 'database', 'currentUser', 'sessionUser',
    'applicationName', 'currentRoleOid', 'maintenanceDatabaseOid', 'canLogin', 'isSuperuser',
    'canCreateDb', 'canCreateRole', 'transactionReadOnly', 'statementTimeout', 'lockTimeout',
    'searchPath', 'clusterSystemIdentifier', 'hbaFilesLoaded', 'hbaRuleNumber', 'hbaLineNumber',
    'hbaAuthMethod', 'targetDatabaseExists', 'targetRoleExists'
  )
  if (
    $manifest.createdAtUtc -isnot [string] -or
    [string]$manifest.createdAtUtc -cnotmatch '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' -or
    $manifest.readinessOutputSha256 -isnot [string] -or
    [string]$manifest.sensitiveAuthorizationRecordId -cnotmatch '^AUTH-[A-Z0-9][A-Z0-9._:-]{0,122}$' -or
    [string]$manifest.readinessOutputSha256 -cnotmatch '^[0-9a-f]{64}$' -or
    $manifest.runtimeSha256 -isnot [string] -or
    [string]$manifest.runtimeSha256 -cnotmatch '^[0-9a-f]{64}$' -or
    $manifest.structuredOutputSha256 -isnot [string] -or
    [string]$manifest.structuredOutputSha256 -cnotmatch '^[0-9a-f]{64}$' -or
    $manifest.payloadSha256 -isnot [string] -or
    [string]$manifest.payloadSha256 -cnotmatch '^[0-9a-f]{64}$' -or
    $manifest.psql.path -isnot [string] -or
    [string]$manifest.psql.path -cne $script:PsqlExeExact -or
    $manifest.psql.sha256 -isnot [string] -or
    [string]$manifest.psql.sha256 -cnotmatch '^[0-9a-f]{64}$' -or
    $manifest.psql.fileVersion -isnot [string] -or
    [string]::IsNullOrWhiteSpace([string]$manifest.psql.fileVersion) -or
    $manifest.psql.productVersion -isnot [string] -or
    [string]::IsNullOrWhiteSpace([string]$manifest.psql.productVersion) -or
    -not (Test-M1BJsonInteger $manifest.psql.clientVersionNum) -or
    [int]$manifest.psql.clientVersionNum -lt 170000 -or [int]$manifest.psql.clientVersionNum -ge 180000 -or
    -not (Test-M1BJsonInteger $manifest.process.processId) -or [int]$manifest.process.processId -le 0 -or
    -not (Test-M1BJsonInteger $manifest.process.processCount) -or [int]$manifest.process.processCount -ne 1 -or
    -not (Test-M1BJsonInteger $manifest.observation.serverVersionNum) -or
    [int]$manifest.observation.serverVersionNum -lt 170000 -or
    [int]$manifest.observation.serverVersionNum -ge 180000 -or
    $manifest.observation.serverAddress -isnot [string] -or
    [string]$manifest.observation.serverAddress -cne '127.0.0.1' -or
    -not (Test-M1BJsonInteger $manifest.observation.serverPort) -or
    [int]$manifest.observation.serverPort -ne 15432 -or
    $manifest.observation.database -isnot [string] -or [string]$manifest.observation.database -cne 'postgres' -or
    $manifest.observation.currentUser -isnot [string] -or [string]$manifest.observation.currentUser -cne 'postgres' -or
    $manifest.observation.sessionUser -isnot [string] -or [string]$manifest.observation.sessionUser -cne 'postgres' -or
    $manifest.observation.applicationName -isnot [string] -or
    [string]$manifest.observation.applicationName -cne 'ritomer_m1b_admin_rail' -or
    -not (Test-M1BJsonInteger $manifest.observation.currentRoleOid) -or
    [long]$manifest.observation.currentRoleOid -le 0 -or
    [long]$manifest.observation.currentRoleOid -gt 4294967295 -or
    -not (Test-M1BJsonInteger $manifest.observation.maintenanceDatabaseOid) -or
    [long]$manifest.observation.maintenanceDatabaseOid -le 0 -or
    [long]$manifest.observation.maintenanceDatabaseOid -gt 4294967295 -or
    $manifest.observation.canLogin -isnot [bool] -or -not [bool]$manifest.observation.canLogin -or
    $manifest.observation.isSuperuser -isnot [bool] -or -not [bool]$manifest.observation.isSuperuser -or
    $manifest.observation.canCreateDb -isnot [bool] -or -not [bool]$manifest.observation.canCreateDb -or
    $manifest.observation.canCreateRole -isnot [bool] -or -not [bool]$manifest.observation.canCreateRole -or
    $manifest.observation.transactionReadOnly -isnot [bool] -or
    -not [bool]$manifest.observation.transactionReadOnly -or
    $manifest.observation.statementTimeout -isnot [string] -or
    [string]$manifest.observation.statementTimeout -cne '5s' -or
    $manifest.observation.lockTimeout -isnot [string] -or
    [string]$manifest.observation.lockTimeout -cne '2s' -or
    $manifest.observation.searchPath -isnot [string] -or
    [string]$manifest.observation.searchPath -cne 'pg_catalog' -or
    $manifest.observation.clusterSystemIdentifier -isnot [string] -or
    [string]$manifest.observation.clusterSystemIdentifier -cnotmatch '^[1-9][0-9]{0,19}$' -or
    $manifest.observation.hbaFilesLoaded -isnot [bool] -or -not [bool]$manifest.observation.hbaFilesLoaded -or
    -not (Test-M1BJsonInteger $manifest.observation.hbaRuleNumber) -or
    [int]$manifest.observation.hbaRuleNumber -le 0 -or
    -not (Test-M1BJsonInteger $manifest.observation.hbaLineNumber) -or
    [int]$manifest.observation.hbaLineNumber -le 0 -or
    $manifest.observation.hbaAuthMethod -isnot [string] -or
    [string]$manifest.observation.hbaAuthMethod -cne 'scram-sha-256' -or
    $manifest.observation.targetDatabaseExists -isnot [bool] -or [bool]$manifest.observation.targetDatabaseExists -or
    $manifest.observation.targetRoleExists -isnot [bool] -or [bool]$manifest.observation.targetRoleExists
  ) {
    Stop-M1BRail 'PREFLIGHT_MANIFEST_OBSERVATION_INVALID'
  }
  return [pscustomobject][ordered]@{
    Value = $manifest
    Sha256 = $actualHash
  }
}

function Invoke-M1BPreflightPsql {
  param([Parameter(Mandatory = $true)][string]$NeutralRoot)

  $raw = Invoke-M1BDirectPsql -Phase 'Preflight' -SqlText (Get-M1BPreflightSql) -NeutralRoot $NeutralRoot
  try {
    $parsed = ConvertFrom-M1BPsqlStructuredOutput `
      -Stdout $raw.Stdout -Stderr $raw.Stderr -ExitCode $raw.ExitCode -Phase 'PREFLIGHT'
    $proof = Assert-M1BPreflightPayload $parsed.Payload
    return [pscustomobject][ordered]@{
      ProcessId = $raw.ProcessId
      ProcessCount = $raw.ProcessCount
      PsqlPath = $raw.PsqlPath
      PsqlSha256 = $raw.PsqlSha256
      PsqlFileVersion = $raw.PsqlFileVersion
      PsqlProductVersion = $raw.PsqlProductVersion
      ClientVersionNum = $parsed.ClientVersionNum
      StructuredOutputSha256 = $raw.StdoutSha256
      PayloadSha256 = $parsed.PayloadSha256
      Payload = $parsed.Payload
      Proof = $proof
    }
  } finally {
    $raw.Stdout = $null
    $raw.Stderr = $null
  }
}

function Invoke-M1BProvisionPsql {
  param(
    [Parameter(Mandatory = $true)][string]$NeutralRoot,
    [Parameter(Mandatory = $true)][string]$Verifier,
    [Parameter(Mandatory = $true)][string]$Provenance,
    [Parameter(Mandatory = $true)][string]$ExpectedClusterSystemIdentifier,
    [Parameter(Mandatory = $true)][int]$ExpectedHbaRuleNumber,
    [Parameter(Mandatory = $true)][long]$ExpectedAdminRoleOid,
    [Parameter(Mandatory = $true)][long]$ExpectedMaintenanceDatabaseOid
  )

  $sql = Get-M1BProvisionSql `
    -Verifier $Verifier `
    -Provenance $Provenance `
    -ExpectedClusterSystemIdentifier $ExpectedClusterSystemIdentifier `
    -ExpectedHbaRuleNumber $ExpectedHbaRuleNumber `
    -ExpectedAdminRoleOid $ExpectedAdminRoleOid `
    -ExpectedMaintenanceDatabaseOid $ExpectedMaintenanceDatabaseOid
  $raw = $null
  try {
    $raw = Invoke-M1BDirectPsql -Phase 'Provision' -SqlText $sql -NeutralRoot $NeutralRoot
    $parsed = ConvertFrom-M1BPsqlStructuredOutput `
      -Stdout $raw.Stdout -Stderr $raw.Stderr -ExitCode $raw.ExitCode -Phase 'PROVISION'
    $proof = Assert-M1BProvisionPayload $parsed.Payload $ExpectedClusterSystemIdentifier $Provenance
    return [pscustomobject][ordered]@{
      ProcessId = $raw.ProcessId
      ProcessCount = $raw.ProcessCount
      PsqlSha256 = $raw.PsqlSha256
      StructuredOutputSha256 = $raw.StdoutSha256
      PayloadSha256 = $parsed.PayloadSha256
      DatabaseOid = $proof.DatabaseOid
      RoleOid = $proof.RoleOid
      PostmasterStartUnixMicros = $proof.PostmasterStartUnixMicros
    }
  } finally {
    $sql = $null
    if ($null -ne $raw) {
      $raw.Stdout = $null
      $raw.Stderr = $null
    }
  }
}

function Invoke-M1BCleanupPsql {
  param(
    [Parameter(Mandatory = $true)][string]$NeutralRoot,
    [Parameter(Mandatory = $true)][string]$Provenance,
    [Parameter(Mandatory = $true)][string]$ExpectedRunId,
    [Parameter(Mandatory = $true)][string]$ExpectedClusterSystemIdentifier,
    [Parameter(Mandatory = $true)][long]$ExpectedDatabaseOid,
    [Parameter(Mandatory = $true)][long]$ExpectedRoleOid,
    [Parameter(Mandatory = $true)][long]$ExpectedAdminRoleOid,
    [Parameter(Mandatory = $true)][long]$ExpectedMaintenanceDatabaseOid
  )

  $sql = Get-M1BCleanupSql `
    -Provenance $Provenance `
    -RunId $ExpectedRunId `
    -ExpectedClusterSystemIdentifier $ExpectedClusterSystemIdentifier `
    -ExpectedDatabaseOid $ExpectedDatabaseOid `
    -ExpectedRoleOid $ExpectedRoleOid `
    -ExpectedAdminRoleOid $ExpectedAdminRoleOid `
    -ExpectedMaintenanceDatabaseOid $ExpectedMaintenanceDatabaseOid
  $raw = $null
  try {
    $raw = Invoke-M1BDirectPsql -Phase 'Cleanup' -SqlText $sql -NeutralRoot $NeutralRoot
    $parsed = ConvertFrom-M1BPsqlStructuredOutput `
      -Stdout $raw.Stdout -Stderr $raw.Stderr -ExitCode $raw.ExitCode -Phase 'CLEANUP'
    Assert-M1BCleanupPayload $parsed.Payload $ExpectedClusterSystemIdentifier
    return [pscustomobject][ordered]@{
      ProcessId = $raw.ProcessId
      ProcessCount = $raw.ProcessCount
      PsqlSha256 = $raw.PsqlSha256
      StructuredOutputSha256 = $raw.StdoutSha256
      PayloadSha256 = $parsed.PayloadSha256
    }
  } finally {
    $sql = $null
    if ($null -ne $raw) {
      $raw.Stdout = $null
      $raw.Stderr = $null
    }
  }
}

function Invoke-M1BTestPhase {
  param(
    [Parameter(Mandatory = $true)][ValidateSet('targeted', 'full', 'm12-qualification')][string]$Phase,
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$BuildRoot,
    [Parameter(Mandatory = $true)][string]$GradleUserHome,
    [Parameter(Mandatory = $true)][string]$RunnerPassword,
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f]{64}$')][string]$RuntimeSha256,
    [Parameter(Mandatory = $true)][string]$ClusterSystemIdentifier,
    [Parameter(Mandatory = $true)][long]$DatabaseOid,
    [Parameter(Mandatory = $true)][long]$RoleOid,
    [Parameter(Mandatory = $true)][object]$PostmasterStartUnixMicros
  )

  if ($Phase -ceq 'm12-qualification' -and $Campaign -cne 'M12') { Stop-M1BRail 'M12_CAMPAIGN_REQUIRED' }
  if (-not (Test-M1BPostmasterStartUnixMicros $PostmasterStartUnixMicros)) {
    Stop-M1BRail 'POSTMASTER_START_UNIX_MICROS_INVALID'
  }
  $phaseRoot = New-M1BDirectory (Join-Path $Root ('volatile\' + $Phase))
  $storageRoot = New-M1BDirectory (Join-Path $phaseRoot 'local-fs')
  $task = switch -CaseSensitive ($Phase) { 'targeted' { 'm1BPostgresRailTargeted' }; 'full' { 'm1BPostgresRailFull' }; 'm12-qualification' { 'm1_2PostgresRailQualification' } }
  $firstFailure = $null
  try {
    $result = Invoke-M1BGradleTask `
      -Task $task `
      -NeutralRoot (Join-Path $phaseRoot 'child') `
      -BuildRoot $BuildRoot `
      -GradleUserHome $GradleUserHome `
      -ForbiddenLiteral $RunnerPassword `
      -ExtraEnvironment @{
        'RITOMER_DB_RAIL_RUN_ID' = $RunId
        'RITOMER_DB_RAIL_RUN_ROOT' = $Root
        'RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256' = $ReviewedObjectSha256
        'RITOMER_DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER' = $ClusterSystemIdentifier
        'RITOMER_DB_RAIL_DATABASE_OID' = [string]$DatabaseOid
        'RITOMER_DB_RAIL_RUNNER_ROLE_OID' = [string]$RoleOid
        'RITOMER_DB_RAIL_POSTMASTER_START_UNIX_MICROS' = $PostmasterStartUnixMicros
        'RITOMER_DB_RAIL_RUNTIME_SHA256' = $RuntimeSha256
        'RITOMER_DB_TESTS_ENABLED' = 'true'
        'RITOMER_DB_TEST_JDBC_URL' = $script:TargetJdbcUrl
        'RITOMER_DB_TEST_USERNAME' = $script:TargetRunnerRole
        'RITOMER_DB_TEST_PASSWORD' = $RunnerPassword
        'RITOMER_DB_TEST_DESTRUCTIVE_CONSENT' = $script:DestructiveConsent
        'RITOMER_DB_TEST_RUN_ROOT' = $Root
        'RITOMER_DB_TEST_PHASE' = $Phase
        'RITOMER_DB_TEST_STORAGE_LOCAL_ROOT' = $storageRoot
        'RITOMER_DB_TEST_APPLICATION_NAME' = ((Get-M1BCampaignPrefix) + '-' + $RunId + '-' + $Phase)
      }
    if ($Campaign -cnotin @('D', 'M12')) { return $result }
  } catch {
    if ($Campaign -cnotin @('D', 'M12')) { throw }
    $firstFailure = $_
    [void](Add-M1DFailure $_)
  } finally {
    if ($Campaign -cin @('D', 'M12')) {
      try { Set-M1DDiagnosticOperation 'secret-scan'; Assert-M1BRunnerSecretAbsentFromTree $Root $RunnerPassword }
      catch { if ($null -eq $firstFailure) { $firstFailure = $_ }; [void](Add-M1DFailure $_) }
    } else { Assert-M1BRunnerSecretAbsentFromTree $Root $RunnerPassword }
  }
  if ($null -ne $firstFailure) { throw $firstFailure }
  return $result
}

function Invoke-M1BPreflight {
  $root = Assert-M1BInvocation
  if ($Campaign -cin @('D', 'M12')) {
    Assert-M1DNoQuarantine
    Start-M1DClock 'Preflight'
    $script:DRunRoot = $root
    $script:DPreflightStartTimestamp = [Diagnostics.Stopwatch]::GetTimestamp()
    Enter-M1DPhase 'readiness'
  }
  [void](Get-M1BGitBaseline)
  if ([System.IO.Directory]::Exists($root) -or [System.IO.File]::Exists($root)) {
    Stop-M1BRail 'PREFLIGHT_RUN_ROOT_ALREADY_EXISTS'
  }
  $root = New-M1BDirectory $root
  $lock = Enter-M1BRunLock $root
  try {
    $initialState = Assert-M1BExecutionState $root 'preflight-initial'
    $baseline = $initialState.Baseline
    $readiness = Invoke-M1BReadiness $root 'preflight-readiness' $RunId $ReviewedObjectSha256
    $readinessCache = if ($Campaign -cin @('D', 'M12')) { New-M1DGradleCacheBinding $root } else { $null }
    [void](Assert-M1BExecutionState $root 'preflight-post-readiness')
    if ($Campaign -cin @('D', 'M12')) {
      if ($Campaign -ceq 'D') { $script:DFrontendRuntimeSha256 = Get-M1DFrontendRuntimeSha256 }
      Enter-M1DPhase 'provision'
    }
    Assert-M1BInteractiveConsole
    $preflight = Invoke-M1BPreflightPsql (Join-Path $root 'volatile\preflight-psql')
    [void](Assert-M1BExecutionState $root 'preflight-post-psql')
    if (
      [int]$script:PsqlProcessStarts.Preflight -ne 1 -or
      [int]$script:PsqlProcessStarts.Provision -ne 0 -or
      [int]$script:PsqlProcessStarts.Cleanup -ne 0
    ) {
      Stop-M1BRail 'PREFLIGHT_PROCESS_COUNT_INVALID'
    }
    $manifest = [pscustomobject][ordered]@{
      schemaVersion = 1
      kind = ($(if ($Campaign -ceq 'M12') { 'M12' } else { 'M1' + $Campaign }) + '_POSTGRES_PREFLIGHT')
      verdict = 'PASS'
      createdAtUtc = [System.DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
      runId = $RunId
      reviewedObjectSha256 = $ReviewedObjectSha256
      reviewedDiffSizeBytes = $initialState.Reviewed.SizeBytes
      sensitiveAuthorizationRecordId = $SensitiveAuthorizationRecordId
      branch = $baseline.Branch
      head = $baseline.Head
      correctiveFileSet = $baseline.CorrectiveFileSet
      compositeFileSet = $baseline.CompositeFileSet
      readinessOutputSha256 = $readiness.Result.OutputSha256
      runtimeSha256 = $readiness.Result.RuntimeSha256
      psql = [pscustomobject][ordered]@{
        path = $preflight.PsqlPath
        sha256 = $preflight.PsqlSha256
        fileVersion = $preflight.PsqlFileVersion
        productVersion = $preflight.PsqlProductVersion
        clientVersionNum = $preflight.ClientVersionNum
      }
      process = [pscustomobject][ordered]@{
        processId = $preflight.ProcessId
        processCount = $preflight.ProcessCount
      }
      observation = [pscustomobject][ordered]@{
        serverVersionNum = $preflight.Payload.serverVersionNum
        serverAddress = $preflight.Payload.serverAddress
        serverPort = $preflight.Payload.serverPort
        database = $preflight.Payload.database
        currentUser = $preflight.Payload.currentUser
        sessionUser = $preflight.Payload.sessionUser
        applicationName = $preflight.Payload.applicationName
        currentRoleOid = $preflight.Proof.AdminRoleOid
        maintenanceDatabaseOid = $preflight.Proof.MaintenanceDatabaseOid
        canLogin = $preflight.Payload.canLogin
        isSuperuser = $preflight.Payload.isSuperuser
        canCreateDb = $preflight.Payload.canCreateDb
        canCreateRole = $preflight.Payload.canCreateRole
        transactionReadOnly = $preflight.Payload.transactionReadOnly
        statementTimeout = $preflight.Payload.statementTimeout
        lockTimeout = $preflight.Payload.lockTimeout
        searchPath = $preflight.Payload.searchPath
        clusterSystemIdentifier = $preflight.Proof.ClusterSystemIdentifier
        hbaFilesLoaded = $preflight.Proof.HbaFilesLoaded
        hbaRuleNumber = $preflight.Proof.HbaRuleNumber
        hbaLineNumber = $preflight.Proof.HbaLineNumber
        hbaAuthMethod = 'scram-sha-256'
        targetDatabaseExists = $false
        targetRoleExists = $false
      }
      structuredOutputSha256 = $preflight.StructuredOutputSha256
      payloadSha256 = $preflight.PayloadSha256
    }
    if ($Campaign -cin @('D', 'M12')) {
      $manifest | Add-Member -NotePropertyName campaignStartTimestamp -NotePropertyValue ([string]$script:DPreflightStartTimestamp)
      $manifest | Add-Member -NotePropertyName stopwatchFrequency -NotePropertyValue ([string][Diagnostics.Stopwatch]::Frequency)
      $manifest | Add-Member -NotePropertyName machine -NotePropertyValue ([Environment]::MachineName)
      $manifest | Add-Member -NotePropertyName namespaceIdentity -NotePropertyValue (Get-M1DNamespaceIdentity)
      if ($Campaign -ceq 'D') { $manifest | Add-Member -NotePropertyName frontendRuntimeSha256 -NotePropertyValue $script:DFrontendRuntimeSha256 }
      if ($Campaign -ceq 'M12') { $manifest | Add-Member -NotePropertyName m12RuntimeManifestSha256 -NotePropertyValue $script:M12RuntimeManifestSha256 }
      $manifest | Add-Member -NotePropertyName readinessCache -NotePropertyValue $readinessCache
      Assert-M1DDeadline
    }
    return Write-M1BManifest $root 'preflight' $manifest
  } finally {
    Exit-M1BRunLock $lock
  }
}

function Invoke-M1BLifecycle {
  $root = Assert-M1BInvocation
  [void](Get-M1BGitBaseline)
  if (-not [System.IO.Directory]::Exists($root)) { Stop-M1BRail 'LIFECYCLE_RUN_ROOT_MISSING' }
  Assert-M1BNoReparseAncestors $root
  $lock = Enter-M1BRunLock $root
  try {
    $initialState = Assert-M1BExecutionState $root 'lifecycle-initial'
    $baseline = $initialState.Baseline
    $readiness = Invoke-M1BReadiness $root 'lifecycle-readiness' $RunId $ReviewedObjectSha256
    $postReadinessState = Assert-M1BExecutionState $root 'lifecycle-post-readiness'
    $baseline = $postReadinessState.Baseline
    $preflight = Read-M1BPreflightManifest `
      $root $RunId $ReviewedObjectSha256 $PreflightAuthorizationRecordId $baseline
    if ([string]$preflight.Value.runtimeSha256 -cne [string]$readiness.Result.RuntimeSha256) {
      Stop-M1BRail 'PREFLIGHT_RUNTIME_SHA256_DIVERGED'
    }
    if ([string]$preflight.Value.psql.sha256 -cne $ExpectedPsqlSha256) {
      Stop-M1BRail 'PREFLIGHT_PSQL_SHA256_DIVERGED'
    }
    $cluster = [string]$preflight.Value.observation.clusterSystemIdentifier
    $adminRoleOid = [long]$preflight.Value.observation.currentRoleOid
    $maintenanceDatabaseOid = [long]$preflight.Value.observation.maintenanceDatabaseOid
    $hbaRule = [int]$preflight.Value.observation.hbaRuleNumber
    $provenance = Get-M1BProvenance $RunId $ReviewedObjectSha256 $cluster
    Assert-M1BInteractiveConsole
    $runner = $null
    $salt = $null
    $verifier = $null
    $provisionAttempted = $false
    $databaseOid = 0L
    $roleOid = 0L
    $primaryStop = $null
    $cleanupStop = $null
    $provision = $null
    $targeted = $null
    $full = $null
    $cleanup = $null
    try {
      $runner = New-M1BRunnerSecret
      $salt = New-M1BRandomSalt
      try {
        $verifier = New-M1BScramSha256Verifier $runner.PasswordBytes $salt
      } finally {
        if ($null -ne $runner.PasswordBytes) {
          [System.Array]::Clear($runner.PasswordBytes, 0, $runner.PasswordBytes.Length)
          $runner.PasswordBytes = $null
        }
        if ($null -ne $salt) {
          [System.Array]::Clear($salt, 0, $salt.Length)
          $salt = $null
        }
      }
      $provisionAttempted = $true
      try {
        $provision = Invoke-M1BProvisionPsql `
          (Join-Path $root 'volatile\provision-psql') $verifier $provenance $cluster $hbaRule `
          $adminRoleOid $maintenanceDatabaseOid
      } finally {
        $verifier = $null
      }
      $databaseOid = [long]$provision.DatabaseOid
      $roleOid = [long]$provision.RoleOid
      [void](Assert-M1BExecutionState $root 'lifecycle-post-provision')
      $targeted = Invoke-M1BTestPhase `
        'targeted' $root $readiness.BuildRoot $readiness.GradleUserHome $runner.Password `
        $readiness.Result.RuntimeSha256 $cluster $databaseOid $roleOid $provision.PostmasterStartUnixMicros
      [void](Assert-M1BExecutionState $root 'lifecycle-post-targeted')
      $full = Invoke-M1BTestPhase `
        'full' $root $readiness.BuildRoot $readiness.GradleUserHome $runner.Password `
        $readiness.Result.RuntimeSha256 $cluster $databaseOid $roleOid $provision.PostmasterStartUnixMicros
      [void](Assert-M1BExecutionState $root 'lifecycle-post-full')
    } catch {
      $primaryStop = Get-M1BStopCode $_
    } finally {
      if ($provisionAttempted) {
        try {
          Assert-M1BInteractiveConsole
          $cleanup = Invoke-M1BCleanupPsql `
            (Join-Path $root 'volatile\cleanup-psql') $provenance $RunId $cluster $databaseOid $roleOid `
            $adminRoleOid $maintenanceDatabaseOid
        } catch {
          $cleanupStop = Get-M1BStopCode $_
        }
      }
      if ($null -ne $runner -and $null -ne $runner.PasswordBytes) {
        [System.Array]::Clear($runner.PasswordBytes, 0, $runner.PasswordBytes.Length)
        $runner.PasswordBytes = $null
      }
      if ($null -ne $salt) {
        [System.Array]::Clear($salt, 0, $salt.Length)
        $salt = $null
      }
      if ($null -ne $runner) { $runner.Password = $null }
      $verifier = $null
    }
    if ($null -ne $cleanupStop) { Stop-M1BRail 'CLEANUP_FAILED_QUARANTINE_REQUIRED' }
    [void](Assert-M1BExecutionState $root 'lifecycle-post-cleanup')
    if ($null -ne $primaryStop) { Stop-M1BRail ('LIFECYCLE_PHASE_FAILED_' + $primaryStop) }
    if (
      [string]$provision.PsqlSha256 -cne $ExpectedPsqlSha256 -or
      [string]$cleanup.PsqlSha256 -cne $ExpectedPsqlSha256
    ) {
      Stop-M1BRail 'LIFECYCLE_PSQL_SHA256_DIVERGED'
    }
    if (
      [int]$script:PsqlProcessStarts.Preflight -ne 0 -or
      [int]$script:PsqlProcessStarts.Provision -ne 1 -or
      [int]$script:PsqlProcessStarts.Cleanup -ne 1
    ) {
      Stop-M1BRail 'LIFECYCLE_PROCESS_COUNT_INVALID'
    }
    $manifest = [pscustomobject][ordered]@{
      schemaVersion = 1
      kind = 'M1B_POSTGRES_LIFECYCLE'
      verdict = 'PASS'
      createdAtUtc = [System.DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
      runId = $RunId
      reviewedObjectSha256 = $ReviewedObjectSha256
      reviewedDiffSizeBytes = $initialState.Reviewed.SizeBytes
      sensitiveAuthorizationRecordId = $SensitiveAuthorizationRecordId
      preflightAuthorizationRecordId = $PreflightAuthorizationRecordId
      preflightManifestSha256 = $preflight.Sha256
      branch = $baseline.Branch
      head = $baseline.Head
      correctiveFileSet = $baseline.CorrectiveFileSet
      compositeFileSet = $baseline.CompositeFileSet
      readinessOutputSha256 = $readiness.Result.OutputSha256
      runtimeSha256 = $readiness.Result.RuntimeSha256
      clusterSystemIdentifier = $cluster
      currentRoleOid = $adminRoleOid
      maintenanceDatabaseOid = $maintenanceDatabaseOid
      databaseOid = $databaseOid
      roleOid = $roleOid
      postmasterStartUnixMicros = $provision.PostmasterStartUnixMicros
      provisionProcessCount = $provision.ProcessCount
      provisionPsqlSha256 = $provision.PsqlSha256
      targetedOutputSha256 = $targeted.OutputSha256
      fullOutputSha256 = $full.OutputSha256
      cleanupProcessCount = $cleanup.ProcessCount
      cleanupPsqlSha256 = $cleanup.PsqlSha256
      provisionStructuredOutputSha256 = $provision.StructuredOutputSha256
      cleanupStructuredOutputSha256 = $cleanup.StructuredOutputSha256
      targetsAbsentAfterCleanup = $true
    }
    return Write-M1BManifest $root 'lifecycle' $manifest
  } finally {
    Exit-M1BRunLock $lock
  }
}

function Start-M1DClock {
  param([ValidateSet('Preflight', 'Lifecycle', 'CleanupOnly')][string]$Kind)
  if ($null -ne $script:DCampaignClock) { Stop-M1BRail 'D_CLOCK_ALREADY_STARTED' }
  $script:DCampaignClock = [System.Diagnostics.Stopwatch]::StartNew()
  $script:DTotalMilliseconds = switch ($Kind) { 'Preflight' { 2400000L }; 'Lifecycle' { 9300000L }; 'CleanupOnly' { 720000L } }
  if ($Campaign -ceq 'M12') {
    $globalRemaining = ([DateTime]::Parse('2026-10-08T05:42:00Z').ToUniversalTime() - [DateTime]::UtcNow).TotalMilliseconds
    $localLimit = switch ($Kind) { 'Preflight' { 2400000L }; 'Lifecycle' { 6600000L }; 'CleanupOnly' { 420000L } }
    $script:DTotalMilliseconds = [long][Math]::Min($localLimit, $globalRemaining)
    if ($script:DTotalMilliseconds -le 0) { Stop-M1BRail 'M12_GLOBAL_BUDGET_EXHAUSTED' }
  }
  $script:DPhaseDeadline = $script:DTotalMilliseconds
  $script:DEnteredPhases = @{}
  $script:DPhase = 'controls'
  $script:DOperation = 'initialization'
  $script:DFailures = [Collections.Generic.List[object]]::new()
  $script:DCookieDiagnostic = $null
  $script:DBrowserDiagnostic = $null
  $script:DHarnessDiagnostic = $null
  $script:DReadinessCacheVerifiedState = $null
}

function Set-M1DDiagnosticOperation {
  param([object]$Operation)
  if ($Campaign -ceq 'M12' -and $Operation -is [string] -and $Operation -ceq 'qualification-tests') { $script:DOperation = $Operation; return }
  if (-not (Test-M1DDiagnosticLiteral $Operation @('initialization','provision','post-provision-state','integrated-entry','ports','phase',
    'runtime-manifest','runtime-structure','runtime-files','child-environment','java-arguments','child-start-info',
    'launch-identity','launch-intent','native-launch','child-drain','integrated-observations','stop-barrier',
    'targeted-tests','full-tests','execution-state','forced-stop','stop-terminate','stop-attestation','stop-root-read','stop-root-wait','stop-job-read','stop-job-wait','stop-drain','stop-receipt','stop-release','stop-job-terminate','stop-job-close','stop-root-release-wait','stop-stdout-close','stop-stderr-close','stop-stdin-close','stop-process-close','cleanup','cleanup-publication','secret-scan',
    'terminal-controls','terminal-publication','lock-release'))) { Stop-M1BRail 'D_DIAGNOSTIC_INVALID' }
  $script:DOperation = $Operation
}

function Test-M1DDiagnosticLiteral {
  param([object]$Value, [string[]]$AllowedValues)
  if ($Value -isnot [string]) { return $false }
  foreach ($allowedValue in $AllowedValues) {
    if ([string]::Equals($Value, $allowedValue, [System.StringComparison]::Ordinal)) { return $true }
  }
  return $false
}

function Assert-M1DHarnessDiagnostic {
  param([object]$Value, [string]$RuntimeSha256)
  Assert-M1BExactProperties $Value @('schemaVersion','runId','objectSha','runtimeSha','diagnostic')
  if (-not (Test-M1BJsonInteger $Value.schemaVersion) -or $Value.schemaVersion -ne 1 -or
      -not (Test-M1DDiagnosticLiteral $Value.runId @($RunId)) -or
      -not (Test-M1DDiagnosticLiteral $Value.objectSha @($ReviewedObjectSha256)) -or
      -not (Test-M1DDiagnosticLiteral $Value.runtimeSha @($RuntimeSha256)) -or $Value.runtimeSha -cnotmatch '^[0-9a-f]{64}\z') { Stop-M1BRail 'D_CONTROL_MESSAGE_REJECTED' }
  $d = $Value.diagnostic
  Assert-M1BExactProperties $d @('code','step','expectedStatus','receivedStatus')
  # Exact wire enums mirrored by the real producer, exercised together offline.
  $codes = @('HARNESS_FAILED','HARNESS_ARGUMENTS_FORBIDDEN','BACKEND_TARGET_MUST_BE_EXACT_LOOPBACK',
    'HARNESS_INHERITED_CONFIGURATION_REFUSED','HARNESS_D_BINDING_REQUIRED','ENVIRONMENT_FILE_GUARD_FAILED',
    'ENVIRONMENT_FILE_PRESENT','AMBIGUOUS_SYSTEM_ENVIRONMENT','UNKNOWN_ACTOR','ME_CONTEXT_MISMATCH',
    'NON_LOOPBACK_REQUEST_FORBIDDEN','PORT_UNAVAILABLE','GET_SET_COOKIE_REQUIRED','SESSION_COOKIE_CONTRACT_REJECTED',
    'OPERATION_CANCELLED','REQUEST_TIMEOUT','RESPONSE_TOO_LARGE','INVALID_JSON','REQUEST_PATH_REFUSED','NO_STORE_REQUIRED',
    'HTTP_STATUS_MISMATCH','HTTP_RESPONSE_UNAVAILABLE','BOOTSTRAP_CONTRACT_MISMATCH','EXPLICIT_LOGOUT_REQUIRED',
    'ACTOR_OPTION_MISMATCH','SESSION_ROTATION_REQUIRED','CSRF_ROTATION_REQUIRED','LOGOUT_FAILED','LOGOUT_COOKIE_NOT_EXPIRED',
    'CSRF_REJECTION_REQUIRED','FOLDER_CONTEXT_MISMATCH','ARCHIVE_RESULT_MISMATCH','CHILD_STDIO_MUST_BE_PIPED',
    'CHILD_CONTROL_OUTPUT_REFUSED','CHILD_OUTPUT_LIMIT','CHILD_OUTPUT_FAILED','HARNESS_ALREADY_STARTED',
    'PRIVATE_PARENT_STDIN_REQUIRED','CONTROL_INPUT_LIMIT','CONTROL_INPUT_REFUSED','PARENT_EOF','PARENT_INPUT_FAILED',
    'HARNESS_INTERRUPTED','INTEGRATION_TIMEOUT','BACKEND_PREFLIGHT_FAILED','VITE_EXITED','VITE_PROCESS_FAILED',
    'VITE_READINESS_FAILED','EXPLICIT_FINISH_REQUIRED','VITE_STOP_TIMEOUT','VITE_STOP_FAILED','INCOMPLETE_HARNESS_RESULT')
  $steps = @('BINDING','ENVIRONMENT','BACKEND_HEALTH','PORT_CHECK','VITE_START','VITE_READY','LOGIN_ACCOUNTANT','LOGIN_REVIEWER',
    'CSRF_REFUSALS','ME_ACCOUNTANT','FOLDER_CREATE','FOLDER_UPDATE','ACCOUNTANT_ARCHIVE_REFUSAL','REVIEWER_READ',
    'REVIEWER_WRITE_REFUSAL','LOGOUT_ACCOUNTANT','ANONYMOUS_ME','ME_REVIEWER','LOGIN_ADMIN','ARCHIVE','WAIT_FINISH',
    'LOGOUT','STOP','COMPLETE','UNAVAILABLE')
  if (-not (Test-M1DDiagnosticLiteral $d.code $codes) -or -not (Test-M1DDiagnosticLiteral $d.step $steps)) { Stop-M1BRail 'D_CONTROL_MESSAGE_REJECTED' }
  if ($d.code -cin @('HTTP_STATUS_MISMATCH','HTTP_RESPONSE_UNAVAILABLE')) {
    if (-not (Test-M1BJsonInteger $d.expectedStatus) -or $d.expectedStatus -lt 100 -or $d.expectedStatus -gt 599) { Stop-M1BRail 'D_CONTROL_MESSAGE_REJECTED' }
    if ($d.code -ceq 'HTTP_STATUS_MISMATCH') {
      if (-not (Test-M1BJsonInteger $d.receivedStatus) -or $d.receivedStatus -lt 100 -or $d.receivedStatus -gt 599 -or $d.expectedStatus -eq $d.receivedStatus) { Stop-M1BRail 'D_CONTROL_MESSAGE_REJECTED' }
    } elseif ($null -ne $d.receivedStatus) { Stop-M1BRail 'D_CONTROL_MESSAGE_REJECTED' }
  } elseif ($null -ne $d.expectedStatus -or $null -ne $d.receivedStatus) { Stop-M1BRail 'D_CONTROL_MESSAGE_REJECTED' }
}

function Read-M1DHarnessDiagnosticLine {
  param([string]$Line)
  $prefix = 'HARNESS_FAILED '
  if (-not $Line.StartsWith($prefix, [StringComparison]::Ordinal) -or (Get-M1BUtf8).GetByteCount($Line + "`n") -gt 2048 -or $Line.Contains("`r")) { Stop-M1BRail 'D_CONTROL_MESSAGE_REJECTED' }
  $bytes = (Get-M1BUtf8).GetBytes($Line.Substring($prefix.Length))
  Assert-M1BNoDuplicateJsonProperties $bytes
  $value = ConvertFrom-Json ((Get-M1BUtf8).GetString($bytes))
  Assert-M1DHarnessDiagnostic $value $script:DRuntimeSha256
  return $value
}

function Get-M1DTerminalPayload {
  param([bool]$Success, [AllowNull()][object]$PrimaryStop, [AllowNull()][object]$CleanupStop,
    [AllowNull()][object]$Targeted, [AllowNull()][object]$Full, [AllowNull()][object]$Cleanup)
  if ($null -ne $script:DBrowserDiagnostic) { Assert-M1DBrowserDiagnostic $script:DBrowserDiagnostic $script:DRuntimeSha256 $script:DFrontendRuntimeSha256 }
  return [ordered]@{
    campaignResult = $(if ($Success -and $null -eq $script:DHarnessDiagnostic -and $null -eq $script:DBrowserDiagnostic) { 'PASS' } else { 'FAIL' })
    primaryStop = $PrimaryStop; cleanupStop = $CleanupStop
    targeted = $Targeted; full = $Full; cleanupVerified = ($null -ne $Cleanup); elapsedMilliseconds = $script:DCampaignClock.ElapsedMilliseconds
    diagnostics = Get-M1DDiagnostics
    cookieDiagnostic = $script:DCookieDiagnostic
    browserDiagnostic = $script:DBrowserDiagnostic
    harnessDiagnostic = $script:DHarnessDiagnostic
  }
}

function Assert-M1DBrowserDiagnostic {
  param([object]$Value, [string]$RuntimeSha256, [string]$FrontendSha256)
  Assert-M1BExactProperties $Value @('schemaVersion','runId','objectSha','runtimeSha','frontendSha','diagnostic')
  if (-not (Test-M1BJsonInteger $Value.schemaVersion) -or $Value.schemaVersion -ne 1 -or
      -not (Test-M1DDiagnosticLiteral $Value.runId @($RunId)) -or
      -not (Test-M1DDiagnosticLiteral $Value.objectSha @($ReviewedObjectSha256)) -or
      -not (Test-M1DDiagnosticLiteral $Value.runtimeSha @($RuntimeSha256)) -or $Value.runtimeSha -cnotmatch '^[0-9a-f]{64}\z' -or
      -not (Test-M1DDiagnosticLiteral $Value.frontendSha @($FrontendSha256)) -or $Value.frontendSha -cnotmatch '^[0-9a-f]{64}\z') { Stop-M1BRail 'D_BROWSER_DIAGNOSTIC_INVALID' }
  $d = $Value.diagnostic
  $steps = @('BINDING','LAUNCH','CONTEXT','COOKIE','OPEN_FOLDER','FIND_NOTE','SAVE_NOTE','RELOAD_NOTE','CSRF_REFUSAL',
    'REVIEWER_ROLE','FOCUS_VISIBILITY','IDLE','EXPIRY','RECONNECT','ISOLATED_REVIEWER','LOGOUT','SHARED_LOGOUT','PRIVACY','FINALIZATION','REPORTER','PUBLICATION')
  if ((Test-M1BJsonInteger $d.schemaVersion) -and $d.schemaVersion -eq 2) {
    Assert-M1BExactProperties $d @('schemaVersion','source','step','lastCompleted','reason','operation','operationState','lastCompletedOperation')
    $operations = @('NATIVE_CONNECT','CREATE_CONTEXT','CREATE_PAGE','INSTALL_OBSERVER','CLOSE_PAGE','READ_RESPONSE_HEADERS','READ_RESPONSE_JSON',
      'OBSERVER_FLUSH','PAGE_FLUSH','PAGE_SNAPSHOT','REVIEWER_FETCH','ACTIVATE_PAGE','READ_PAGE_STATE','CLOSE_CONTEXT','READ_COOKIES','IDLE_WAIT')
    if (-not (Test-M1DDiagnosticLiteral $d.source @('SCENARIO','REPORTER')) -or
        -not (Test-M1DDiagnosticLiteral $d.step $steps) -or $d.step -cin @('REPORTER','PUBLICATION') -or $null -ne $d.lastCompleted -or
        -not (Test-M1DDiagnosticLiteral $d.reason @('OPERATION_FAILED','TIMEOUT')) -or
        -not (Test-M1DDiagnosticLiteral $d.operation $operations) -or
        -not (Test-M1DDiagnosticLiteral $d.operationState @('PENDING','FAILED')) -or
        ($d.source -ceq 'SCENARIO' -and $d.operationState -cne 'FAILED') -or
        ($null -ne $d.lastCompletedOperation -and -not (Test-M1DDiagnosticLiteral $d.lastCompletedOperation $operations))) { Stop-M1BRail 'D_BROWSER_DIAGNOSTIC_INVALID' }
    return
  }
  Assert-M1BExactProperties $d @('schemaVersion','source','step','lastCompleted','reason')
  if (-not (Test-M1BJsonInteger $d.schemaVersion) -or $d.schemaVersion -ne 1 -or
      -not (Test-M1DDiagnosticLiteral $d.source @('SCENARIO','REPORTER','PUBLICATION')) -or
      -not (Test-M1DDiagnosticLiteral $d.step $steps) -or
      ($null -ne $d.lastCompleted -and -not (Test-M1DDiagnosticLiteral $d.lastCompleted $steps)) -or
      -not (Test-M1DDiagnosticLiteral $d.reason @('OPERATION_FAILED','TIMEOUT','ASSERTION','LOCATOR_AMBIGUOUS','NO_RESPONSE','UNAVAILABLE')) -or
      ($d.source -ceq 'SCENARIO' -and $d.step -cin @('REPORTER','PUBLICATION')) -or
      ($null -ne $d.lastCompleted -and $d.lastCompleted -cin @('REPORTER','PUBLICATION')) -or
      ($d.source -ceq 'REPORTER' -and ($d.step -cne 'REPORTER' -or $d.reason -cne 'UNAVAILABLE' -or $null -ne $d.lastCompleted)) -or
      ($d.source -ceq 'PUBLICATION' -and ($d.step -cne 'PUBLICATION' -or $d.reason -cne 'OPERATION_FAILED' -or $null -ne $d.lastCompleted))) { Stop-M1BRail 'D_BROWSER_DIAGNOSTIC_INVALID' }
}

function Read-M1DBrowserDiagnosticLine {
  param([string]$Line)
  $prefix = 'M1D_BROWSER_DIAGNOSTIC '
  if (-not $Line.StartsWith($prefix, [StringComparison]::Ordinal) -or (Get-M1BUtf8).GetByteCount($Line + "`n") -gt 8192) { Stop-M1BRail 'D_BROWSER_DIAGNOSTIC_INVALID' }
  $bytes = (Get-M1BUtf8).GetBytes($Line.Substring($prefix.Length))
  Assert-M1BNoDuplicateJsonProperties $bytes
  $value = ConvertFrom-Json ((Get-M1BUtf8).GetString($bytes))
  Assert-M1DBrowserDiagnostic $value $script:DRuntimeSha256 $script:DFrontendRuntimeSha256
  return $value
}

function Assert-M1DCookieDiagnostic {
  param([object]$Value, [string]$RuntimeSha256, [string]$FrontendSha256)
  Assert-M1BExactProperties $Value @('schemaVersion','runId','objectSha','runtimeSha','frontendSha','diagnostic')
  if (-not (Test-M1BJsonInteger $Value.schemaVersion) -or $Value.schemaVersion -ne 1 -or
      -not (Test-M1DDiagnosticLiteral $Value.runId @($RunId)) -or
      -not (Test-M1DDiagnosticLiteral $Value.objectSha @($ReviewedObjectSha256)) -or
      -not (Test-M1DDiagnosticLiteral $Value.runtimeSha @($RuntimeSha256)) -or $Value.runtimeSha -cnotmatch '^[0-9a-f]{64}\z' -or
      -not (Test-M1DDiagnosticLiteral $Value.frontendSha @($FrontendSha256)) -or $Value.frontendSha -cnotmatch '^[0-9a-f]{64}\z') { Stop-M1BRail 'D_COOKIE_DIAGNOSTIC_INVALID' }
  $d = $Value.diagnostic
  if (-not (Test-M1BJsonInteger $d.schemaVersion) -or $d.schemaVersion -notin @(1,2)) { Stop-M1BRail 'D_COOKIE_DIAGNOSTIC_INVALID' }
  $diagnosticProperties = @('schemaVersion','source','step','lastCompleted','reason','metric','facts')
  if ($d.schemaVersion -eq 2) { $diagnosticProperties += 'firstPrivacyViolation' }
  Assert-M1BExactProperties $d $diagnosticProperties
  if ($d.schemaVersion -eq 2 -and $null -ne $d.firstPrivacyViolation) {
    $privacy = $d.firstPrivacyViolation
    Assert-M1BExactProperties $privacy @('rule','surface','valueCategory')
    if (-not (Test-M1DDiagnosticLiteral $privacy.rule @('PROTECTED_VALUE_MATCH','AUTHORIZATION_HEADER','TENANT_SESSION_HEADER','AUTHORIZATION_AND_TENANT_SESSION_HEADERS','CHANNEL_SHAPE')) -or
        -not (Test-M1DDiagnosticLiteral $privacy.surface @('REQUEST_HEADERS','DOM','FORM_FIELD','URL','DOCUMENT_COOKIE','LOCAL_STORAGE','SESSION_STORAGE','INDEXED_DB','CONSOLE','CHANNEL','AMBIGUOUS')) -or
        -not (Test-M1DDiagnosticLiteral $privacy.valueCategory @('SESSION_COOKIE','CSRF_TOKEN','ACTOR_KEY','USER_ID','SUBJECT','TENANT_ID','MEMBERSHIP_ID','ACTOR_ID','AMBIGUOUS','NONE'))) { Stop-M1BRail 'D_COOKIE_DIAGNOSTIC_INVALID' }
    $validPrivacy = switch -CaseSensitive ($privacy.rule) {
      'AUTHORIZATION_HEADER' { $privacy.surface -ceq 'REQUEST_HEADERS' -and $privacy.valueCategory -ceq 'NONE' }
      'TENANT_SESSION_HEADER' { $privacy.surface -ceq 'REQUEST_HEADERS' -and $privacy.valueCategory -ceq 'TENANT_ID' }
      'AUTHORIZATION_AND_TENANT_SESSION_HEADERS' { $privacy.surface -ceq 'REQUEST_HEADERS' -and $privacy.valueCategory -ceq 'AMBIGUOUS' }
      'CHANNEL_SHAPE' { $privacy.surface -ceq 'CHANNEL' -and $privacy.valueCategory -ceq 'NONE' }
      'PROTECTED_VALUE_MATCH' { $privacy.surface -cne 'REQUEST_HEADERS' -and $privacy.valueCategory -cne 'NONE' }
    }
    if (-not $validPrivacy) { Stop-M1BRail 'D_COOKIE_DIAGNOSTIC_INVALID' }
  }
  $steps = @('NAVIGATION','BOOTSTRAP_RESPONSE','BOOTSTRAP_BODY','ANONYMOUS_UI','COOKIE_EMISSION','COOKIE_ACCEPTANCE','ANONYMOUS_PRIVACY',
    'CONTINUITY_RESPONSE','CONTINUITY_BODY','CONTINUITY_UI','CONTINUITY','LOGIN_ACTION','LOGIN_RESPONSE','ROTATION','AUTHENTICATED_RESPONSE',
    'AUTHENTICATED_BODY','ME_RESPONSE','ME_BODY','ROLE','AUTHENTICATED_UI','AUTHENTICATED_PRIVACY','OBSERVER','FINAL_PRIVACY','FINALIZATION','REDUCER','REPORTER')
  $metrics = @('emittedCookie','acceptedCookie','continuity','login','rotation','authenticated','me','noteWrite','noteRead','roleRefusal','roleReadOnly',
    'csrfRefusal','csrfRenewal','csrfReplay','idleStart','idleEnd','idleRequests','expiredResponse','expiredUI','automaticLogin','explicitLogin','safeReturn',
    'logout','logoutInvalidated','anonymousAfterLogout','otherContextReady','sharedLogout','nativeFocus','nativeVisibility','keyboard','narrow',
    'privacyScans','privacyViolations','lostObservations','pagesClosed','contextsClosed','browserDisconnected','windows')
  if (-not (Test-M1DDiagnosticLiteral $d.source @('BROWSER','REDUCER','REPORTER')) -or
      -not (Test-M1DDiagnosticLiteral $d.step $steps) -or
      ($null -ne $d.lastCompleted -and -not (Test-M1DDiagnosticLiteral $d.lastCompleted $steps)) -or
      -not (Test-M1DDiagnosticLiteral $d.reason @('OPERATION_FAILED','NO_RESPONSE','HTTP_STATUS','INVALID_BODY','STATE','UI_NOT_REACHED','COOKIE_ABSENT','COOKIE_COUNT','COMPARISON','ROLE','PRIVACY','METRIC','PROTOCOL','UNAVAILABLE','FINALIZATION')) -or
      ($null -ne $d.metric -and -not (Test-M1DDiagnosticLiteral $d.metric $metrics))) { Stop-M1BRail 'D_COOKIE_DIAGNOSTIC_INVALID' }
  if (($d.source -ceq 'REDUCER' -and ($d.step -cne 'REDUCER' -or $d.reason -cne 'METRIC' -or $null -eq $d.metric)) -or
      ($d.source -cne 'REDUCER' -and $null -ne $d.metric)) { Stop-M1BRail 'D_COOKIE_DIAGNOSTIC_INVALID' }
  if (($d.source -ceq 'REPORTER' -and ($d.step -cne 'REPORTER' -or $d.reason -cne 'UNAVAILABLE')) -or
      ($d.source -ceq 'BROWSER' -and $d.step -cin @('REDUCER','REPORTER')) -or
      ($null -ne $d.lastCompleted -and $d.lastCompleted -cin @('REDUCER','REPORTER'))) { Stop-M1BRail 'D_COOKIE_DIAGNOSTIC_INVALID' }
  $keys = @('bootstrapStatus','bootstrapState','continuityStatus','continuityState','loginStatus','loginCode','authenticatedStatus','authenticatedState',
    'meStatus','meCode','emittedCount','emittedMask','acceptedCount','acceptedMask','continuity','rotation','roleMatches','privacyScans','privacyViolations','lostObservations')
  Assert-M1BExactProperties $d.facts $keys
  foreach ($key in $keys) {
    $v = $d.facts.$key
    if ($null -eq $v) { continue }
    if ($key.EndsWith('Status', [StringComparison]::Ordinal)) { $valid = (Test-M1BJsonInteger $v) -and $v -ge 100 -and $v -le 599 }
    elseif ($key.EndsWith('State', [StringComparison]::Ordinal)) { $valid = Test-M1DDiagnosticLiteral $v @('ANONYMOUS','AUTHENTICATED','OTHER') }
    elseif ($key.EndsWith('Code', [StringComparison]::Ordinal)) { $valid = Test-M1DDiagnosticLiteral $v @('AUTHENTICATION_FAILED','AUTHENTICATION_REQUIRED','CSRF_REJECTED','ACCESS_DENIED','ACCESS_REVOKED','SESSION_EXPIRED','SESSION_ALREADY_AUTHENTICATED','INVALID_REQUEST','REQUEST_REJECTED','OTHER') }
    elseif ($key -cin @('continuity','rotation','roleMatches')) { $valid = $v -is [bool] }
    else { $limit = if ($key.EndsWith('Mask', [StringComparison]::Ordinal)) { 31 } else { 1000000 }; $valid = (Test-M1BJsonInteger $v) -and $v -ge 0 -and $v -le $limit }
    if (-not $valid) { Stop-M1BRail 'D_COOKIE_DIAGNOSTIC_INVALID' }
  }
}

function Read-M1DCookieDiagnosticLine {
  param([string]$Line)
  $prefix = 'M1D_COOKIE_DIAGNOSTIC '
  if (-not $Line.StartsWith($prefix, [StringComparison]::Ordinal) -or (Get-M1BUtf8).GetByteCount($Line + "`n") -gt 8192) { Stop-M1BRail 'D_COOKIE_DIAGNOSTIC_INVALID' }
  $bytes = (Get-M1BUtf8).GetBytes($Line.Substring($prefix.Length))
  Assert-M1BNoDuplicateJsonProperties $bytes
  $value = ConvertFrom-Json ((Get-M1BUtf8).GetString($bytes))
  Assert-M1DCookieDiagnostic $value $script:DRuntimeSha256 $script:DFrontendRuntimeSha256
  return $value
}

function Get-M1DControlCode {
  param([object]$Code)
  # Only literal controls can cross the diagnostics boundary, never an arbitrary suffix.
  if ($Code -isnot [string]) { return 'UNCLASSIFIED' }
  foreach ($allowedCode in @('D_CHILD_OUTPUT_LIMIT_EXCEEDED','RUNNER_SECRET_OUTPUT_CONTAMINATION',
      'D_CONTROL_MESSAGE_REJECTED','D_PREMATURE_HARNESS_STOP','D_PREMATURE_BACKEND_STOP',
      'D_UNTERMINATED_CONTROL_MESSAGE','D_CONTROL_MESSAGE_WRONG_CHANNEL',
      'D_CHILD_STDOUT_READ_FAILED','D_CHILD_STDERR_READ_FAILED','D_UNEXPECTED_LIVE_CHILD',
      'D_TREE_STOP_UNPROVEN','D_TERMINATION_BUDGET_EXHAUSTED','D_STREAM_STOP_UNPROVEN','D_CHILD_STOP_NOT_ATTESTED',
      'D_INTEGRATED_CHILD_DISAPPEARED','D_REQUIRED_RESULT_ABSENT','D_CHILD_NONZERO_EXIT',
      'D_BROWSER_RUNNER_FAILED','D_STOP_BARRIER_FAILED','D_CHILD_FINALIZATION_FAILED',
      'D_ADMIN_PASSWORD_FILE_MISSING','D_ADMIN_PASSWORD_FILE_INVALID',
      'PSQL_PREFLIGHT_EXIT_NONZERO','PSQL_PROVISION_EXIT_NONZERO','PSQL_CLEANUP_EXIT_NONZERO')) {
    if ([string]::Equals($Code, $allowedCode, [System.StringComparison]::Ordinal)) { return $allowedCode }
  }
  return 'UNCLASSIFIED'
}

function Test-M1DChildRole {
  param([object]$Value, [switch]$AllowNone)
  $allowedRoles = @('SEED','BACKEND','VITE','HARNESS','BROWSER_COOKIE','BROWSER_JOURNEY')
  if ($AllowNone) { $allowedRoles += 'NONE' }
  return Test-M1DDiagnosticLiteral $Value $allowedRoles
}

function Stop-M1DChildControl {
  param([object]$Role, [object]$Code)
  $control = Get-M1DControlCode $Code
  if (-not (Test-M1DChildRole $Role) -or
      [string]::Equals($control, 'UNCLASSIFIED', [System.StringComparison]::Ordinal)) { Stop-M1BRail 'D_DIAGNOSTIC_INVALID' }
  $exception = [InvalidOperationException]::new('RITOMER_M1B_CONTROLLED_STOP::' + $control)
  $exception.Data['M1DChildRole'] = $Role
  throw $exception
}

function Add-M1DFailure {
  param([System.Management.Automation.ErrorRecord]$Failure)
  # Never retain the ErrorRecord, Message, TargetObject, stack, arguments or
  # environment. Even a forged controlled-stop suffix cannot enter a receipt.
  $category = 'UNEXPECTED_FAILURE'
  $childRole = 'NONE'
  $code = 'UNEXPECTED_FAILURE'
  $control = 'UNCLASSIFIED'
  $projectionFailure = $null
  $markerData = $null
  try {
    $exception = $Failure.Exception
    while ($null -ne $exception) {
      if ($exception -is [UnauthorizedAccessException]) { $category = 'ACCESS_DENIED' }
      elseif ($exception -is [IO.FileNotFoundException] -or $exception -is [IO.DirectoryNotFoundException] -or
          $exception -is [Management.Automation.ItemNotFoundException]) { $category = 'PATH_NOT_FOUND' }
      elseif ($exception -is [IO.PathTooLongException]) { $category = 'PATH_TOO_LONG' }
      elseif ($exception -is [IO.IOException]) { $category = 'IO_FAILURE' }
      elseif ($exception -is [Management.Automation.ParameterBindingException]) { $category = 'PARAMETER_BINDING' }
      elseif ($exception -is [FormatException] -or $exception -is [ArgumentException]) { $category = 'INVALID_VALUE' }
      elseif ($exception -is [TimeoutException]) { $category = 'TIMEOUT' }
      $data = $exception.Data
      if ($null -eq $markerData) { $markerData = $data }
      # Identity, never equality of messages or diagnostic fields. The list is
      # also the collection token: a previous run's marker cannot suppress this one.
      if ([object]::ReferenceEquals($data['M1DFailureCollector'], $script:DFailures) -and
          (Test-M1DDiagnosticLiteral $data['M1DFailureCode'] @('D_CONTROLLED_FAILURE','UNEXPECTED_FAILURE'))) {
        return [string]$data['M1DFailureCode']
      }
      $role = $data['M1DChildRole']
      if (Test-M1DChildRole $role) { $childRole = $role }
      $exception = $exception.InnerException
    }
    $code = Get-M1BStopCode $Failure
    $control = Get-M1DControlCode $code
    if (-not [string]::Equals($code, 'UNEXPECTED_FAILURE', [System.StringComparison]::Ordinal)) {
      $category = if (Test-M1DDiagnosticLiteral $code @('D_DEADLINE_EXPIRED','D_CAMPAIGN_DEADLINE_EXPIRED','D_TERMINATION_BUDGET_EXHAUSTED')) { 'TIMEOUT' } else { 'CONTROLLED_STOP' }
      $code = 'D_CONTROLLED_FAILURE'
    }
  } catch { $projectionFailure = $_ }
  $script:DFailures.Add([pscustomobject][ordered]@{ stage = $script:DPhase; operation = $script:DOperation; category = $category; childRole = $childRole; control = $control })
  # Projection faults are secondary, reduced without re-entering this collector
  # or inspecting their Message/Data. The caller still owns the original error.
  if ($null -ne $projectionFailure) {
    $projectionCategory = 'UNEXPECTED_FAILURE'
    $exception = $projectionFailure.Exception
    while ($null -ne $exception) {
      if ($exception -is [UnauthorizedAccessException]) { $projectionCategory = 'ACCESS_DENIED' }
      elseif ($exception -is [IO.IOException]) { $projectionCategory = 'IO_FAILURE' }
      elseif ($exception -is [FormatException] -or $exception -is [ArgumentException]) { $projectionCategory = 'INVALID_VALUE' }
      $exception = $exception.InnerException
    }
    $script:DFailures.Add([pscustomobject][ordered]@{ stage = $script:DPhase; operation = $script:DOperation; category = $projectionCategory; childRole = 'NONE'; control = 'UNCLASSIFIED' })
  }
  if ($null -ne $markerData) {
    try { $markerData['M1DFailureCode'] = $code; $markerData['M1DFailureCollector'] = $script:DFailures }
    catch {
      $script:DFailures.Add([pscustomobject][ordered]@{ stage = $script:DPhase; operation = $script:DOperation; category = 'UNEXPECTED_FAILURE'; childRole = 'NONE'; control = 'UNCLASSIFIED' })
    }
  }
  return $code
}

function Get-M1DDiagnostics {
  # Validate the entire closed structure BEFORE any publication. Reused by the
  # receipt reader, so unknown fields/values cannot masquerade as diagnostics.
  param([object[]]$Failures = $script:DFailures.ToArray(), [ValidateSet(1,2)][int]$SchemaVersion = 2)
  foreach ($failure in $Failures) {
    $properties = @('stage','operation','category')
    if ($SchemaVersion -eq 2) { $properties += @('childRole','control') }
    Assert-M1BExactProperties $failure $properties
    if ($SchemaVersion -eq 2 -and (-not (Test-M1DChildRole $failure.childRole -AllowNone) -or
        $failure.control -isnot [string] -or
        -not [string]::Equals((Get-M1DControlCode $failure.control), $failure.control, [System.StringComparison]::Ordinal))) { Stop-M1BRail 'D_DIAGNOSTIC_INVALID' }
    if (-not (Test-M1DDiagnosticLiteral $failure.stage (@('readiness','provision','seed','backend','integration','stop','targeted','full','cleanup','controls') + $(if ($Campaign -ceq 'M12') { @('qualification') } else { @() }))) -or
        -not (Test-M1DDiagnosticLiteral $failure.operation (@('initialization','provision','post-provision-state','integrated-entry','ports','phase','runtime-manifest','runtime-structure','runtime-files','child-environment','java-arguments','child-start-info','launch-identity','launch-intent','native-launch','child-drain','integrated-observations','stop-barrier','targeted-tests','full-tests','execution-state','forced-stop','stop-terminate','stop-attestation','stop-root-read','stop-root-wait','stop-job-read','stop-job-wait','stop-drain','stop-receipt','stop-release','stop-job-terminate','stop-job-close','stop-root-release-wait','stop-stdout-close','stop-stderr-close','stop-stdin-close','stop-process-close','cleanup','cleanup-publication','secret-scan','terminal-controls','terminal-publication','lock-release') + $(if ($Campaign -ceq 'M12') { @('qualification-tests') } else { @() }))) -or
        -not (Test-M1DDiagnosticLiteral $failure.category @('UNEXPECTED_FAILURE','ACCESS_DENIED','PATH_NOT_FOUND','PATH_TOO_LONG','IO_FAILURE','PARAMETER_BINDING','INVALID_VALUE','TIMEOUT','CONTROLLED_STOP'))) { Stop-M1BRail 'D_DIAGNOSTIC_INVALID' }
  }
  return [pscustomobject][ordered]@{
    schemaVersion = $SchemaVersion
    primary = $(if ($Failures.Count -gt 0) { $Failures[0] } else { $null })
    secondary = @($Failures | Select-Object -Skip 1)
  }
}

function Enter-M1DPhase {
  param([object]$Phase)
  $allowed = if ($Campaign -ceq 'M12') { @('readiness','provision','targeted','full','qualification','stop','cleanup','controls') } else { @('readiness','provision','seed','backend','integration','stop','targeted','full','cleanup','controls') }
  if (-not (Test-M1DDiagnosticLiteral $Phase $allowed)) { Stop-M1BRail 'D_DIAGNOSTIC_INVALID' }
  if ($script:DEnteredPhases.ContainsKey($Phase)) { Stop-M1BRail 'D_PHASE_REENTRY_REJECTED' }
  $script:DEnteredPhases[$Phase] = $true
  $reserveMinutes = switch ($Phase) {
    'readiness' { 125 }; 'provision' { 120 }; 'seed' { 115 }; 'backend' { 113 }
    'integration' { 53 }; 'stop' { 52 }; 'targeted' { 32 }; 'full' { 12 }; 'cleanup' { 7 }; 'controls' { 0 }
  }
  if ($Campaign -ceq 'M12') {
    $reserveMinutes = switch ($Phase) { 'readiness' { 80 }; 'provision' { 75 }; 'targeted' { 55 }; 'full' { 35 }; 'qualification' { 7 }; 'stop' { 6 }; 'cleanup' { 1 }; 'controls' { 0 } }
  }
  # Preflight/recovery have no integration or DB-test phases to reserve.
  if ($Mode -ceq 'Preflight') { $reserveMinutes = if ($Phase -eq 'readiness') { 10 } else { 0 } }
  elseif ($Mode -ceq 'Lifecycle' -and $LifecycleAction -ceq 'CleanupOnly') { $reserveMinutes = if ($Phase -eq 'cleanup') { $(if ($Campaign -ceq 'M12') { 1 } else { 7 }) } else { 0 } }
  $script:DPhaseDeadline = [Math]::Min(
    $script:DCampaignClock.ElapsedMilliseconds + [long]$script:DPhaseMinutes[$Phase] * 60000L,
    $script:DTotalMilliseconds - [long]$reserveMinutes * 60000L
  )
  $script:DPhase = $Phase
  Assert-M1DDeadline
}

function Assert-M1DDeadline {
  if ($null -eq $script:DCampaignClock -or $script:DCampaignClock.ElapsedMilliseconds -ge $script:DPhaseDeadline -or
      $script:DCampaignClock.ElapsedMilliseconds -ge $script:DTotalMilliseconds) {
    Stop-M1BRail 'D_DEADLINE_EXPIRED'
  }
}

function Get-M1DStopBudget {
  # Termination remains possible after a phase timeout, within the global reserve.
  $remaining = $script:DTotalMilliseconds - $script:DCampaignClock.ElapsedMilliseconds
  if ($remaining -le 0) { Stop-M1BRail 'D_TERMINATION_BUDGET_EXHAUSTED' }
  return [int][Math]::Min(30000L, $remaining)
}

function Get-M1DFixedRecoveryOrigin {
  # Selection is exclusively code-owned. This function performs no I/O.
  if (-not [string]::Equals($Campaign, 'D', [StringComparison]::Ordinal) -or
      -not [string]::Equals($Mode, 'Lifecycle', [StringComparison]::Ordinal) -or
      -not [string]::Equals($LifecycleAction, 'CleanupOnly', [StringComparison]::Ordinal) -or
      -not [string]::Equals($RunId, '5b6936c097c9472d85f697348cfd756a', [StringComparison]::Ordinal) -or
      -not [string]::Equals($RunRoot, 'C:\dev\ritomer-local-evidence\m1-1b-postgresql\5b6936c097c9472d85f697348cfd756a', [StringComparison]::Ordinal)) { return $null }
  return [pscustomobject][ordered]@{
    runId = '5b6936c097c9472d85f697348cfd756a'
    runRoot = 'C:\dev\ritomer-local-evidence\m1-1b-postgresql\5b6936c097c9472d85f697348cfd756a'
    reviewedObjectSha256 = 'a26d18378f40572974a9c22b137063bd4afab0fa323f584902c79af5c04e97d2'
    scriptSha256 = '66ee9ca05593ecf91cc0a6f075e76144314ff32afe60c869013320d10befe139'
    campaignReceiptSha256 = 'ff16d868c52930c9870df47ab1340dae2dee500ac247f18906e22690c0befe74'
    provisionReceiptSha256 = '4c36f8a8669494c8746889fffdeb2c235083576af8b03466890d561014c96eb6'
  }
}

function Assert-M1DRecoveryReceiptContext {
  param([object]$Context)
  Assert-M1BExactProperties $Context @('origin','campaignAuthorization','preflightAuthorization')
  $origin = $Context.origin
  Assert-M1BExactProperties $origin @('runId','runRoot','reviewedObjectSha256','scriptSha256','campaignReceiptSha256','provisionReceiptSha256')
  if (-not [string]::Equals($Campaign, 'D', [StringComparison]::Ordinal) -or
      -not [string]::Equals($Mode, 'Lifecycle', [StringComparison]::Ordinal) -or
      -not [string]::Equals($LifecycleAction, 'CleanupOnly', [StringComparison]::Ordinal) -or
      $origin.runId -isnot [string] -or -not [string]::Equals($origin.runId, $RunId, [StringComparison]::Ordinal) -or
      $origin.runRoot -isnot [string] -or -not [string]::Equals($origin.runRoot, $RunRoot, [StringComparison]::Ordinal) -or
      -not [string]::Equals($origin.runRoot, $script:DRunRoot, [StringComparison]::Ordinal)) { Stop-M1BRail 'D_RECOVERY_CONTEXT_INVALID' }
  foreach ($name in @('reviewedObjectSha256','scriptSha256','campaignReceiptSha256','provisionReceiptSha256')) {
    if ($origin.$name -isnot [string] -or $origin.$name -cnotmatch '^[0-9a-f]{64}\z') { Stop-M1BRail 'D_RECOVERY_CONTEXT_INVALID' }
  }
  foreach ($name in @('campaignAuthorization','preflightAuthorization')) {
    if ($null -ne $Context.$name -and ($Context.$name -isnot [string] -or $Context.$name -cnotmatch '^AUTH-[A-Z0-9][A-Z0-9._:-]{0,122}$')) { Stop-M1BRail 'D_RECOVERY_CONTEXT_INVALID' }
  }
}

function Get-M1DRecoveryOriginFields {
  param([object]$Context)
  Assert-M1DRecoveryReceiptContext $Context
  return [pscustomobject][ordered]@{
    reviewedObjectSha256 = $Context.origin.reviewedObjectSha256
    scriptSha256 = $Context.origin.scriptSha256
    campaignReceiptSha256 = $Context.origin.campaignReceiptSha256
    provisionReceiptSha256 = $Context.origin.provisionReceiptSha256
  }
}

function Test-M1DRecoveryReceiptName {
  param([string]$Name)
  foreach ($allowed in @('launch-recovery-ADMIN_PSQL_CLEANUP-intent','launch-recovery-ADMIN_PSQL_CLEANUP-confined',
      'launch-recovery-ADMIN_PSQL_CLEANUP-stopped','recovery-cleanup','recovery-terminal')) {
    if ([string]::Equals($Name, $allowed, [StringComparison]::Ordinal)) { return $true }
  }
  return $false
}

function Get-M1DReceiptExpectation {
  param([string]$Name, [AllowNull()][object]$ReceiptContext)
  $expected = [pscustomobject]@{ schemaVersion = 1; reviewedObjectSha256 = $ReviewedObjectSha256;
    scriptSha256 = (Get-M1BSha256File $PSCommandPath); authorizationRecordId = $null; fileSha256 = $null; recoveryOrigin = $null }
  if ($null -eq $ReceiptContext) { return $expected }
  Assert-M1DRecoveryReceiptContext $ReceiptContext
  if (Test-M1DRecoveryReceiptName $Name) {
    if ($null -eq $ReceiptContext.campaignAuthorization -or $null -eq $ReceiptContext.preflightAuthorization -or
        $SensitiveAuthorizationRecordId -ceq $ReceiptContext.campaignAuthorization -or
        $SensitiveAuthorizationRecordId -ceq $ReceiptContext.preflightAuthorization) { Stop-M1BRail 'D_NEW_CLEANUP_AUTHORIZATION_REQUIRED' }
    $expected.schemaVersion = 2
    $expected.authorizationRecordId = $SensitiveAuthorizationRecordId
    $expected.recoveryOrigin = Get-M1DRecoveryOriginFields $ReceiptContext
  } else {
    $expected.reviewedObjectSha256 = $ReceiptContext.origin.reviewedObjectSha256
    $expected.scriptSha256 = $ReceiptContext.origin.scriptSha256
    if ($Name -ceq 'campaign') { $expected.fileSha256 = $ReceiptContext.origin.campaignReceiptSha256 }
    elseif ($Name -ceq 'provision') {
      $expected.fileSha256 = $ReceiptContext.origin.provisionReceiptSha256
      $expected.authorizationRecordId = $ReceiptContext.campaignAuthorization
    } elseif ($Name -cmatch '^launch-preflight-') { $expected.authorizationRecordId = $ReceiptContext.preflightAuthorization }
    elseif ($Name -cmatch '^launch-lifecycle-') { $expected.authorizationRecordId = $ReceiptContext.campaignAuthorization }
    else { Stop-M1BRail 'D_RECOVERY_RECEIPT_CONTEXT_REJECTED' }
    if ($Name -cne 'campaign' -and $null -eq $expected.authorizationRecordId) { Stop-M1BRail 'D_RECOVERY_CONTEXT_INVALID' }
  }
  return $expected
}

function Assert-M1DNoRecoveryReceipts {
  foreach ($entry in @(Get-ChildItem -LiteralPath $script:DRunRoot -Force)) {
    if ($entry.Name.StartsWith(((Get-M1BReceiptPrefix) + 'recovery-'), [StringComparison]::Ordinal) -or
        $entry.Name.StartsWith(((Get-M1BReceiptPrefix) + 'launch-recovery-'), [StringComparison]::Ordinal)) { Stop-M1BRail 'D_RECOVERY_ALREADY_STARTED' }
  }
  foreach ($name in @('launch-recovery-ADMIN_PSQL_CLEANUP-intent','launch-recovery-ADMIN_PSQL_CLEANUP-confined',
      'launch-recovery-ADMIN_PSQL_CLEANUP-stopped','recovery-cleanup','recovery-terminal')) {
    $path = Join-Path $script:DRunRoot ((Get-M1BReceiptPrefix) + $name + '.json')
    foreach ($candidate in @($path, ($path + '.sha256'))) {
      if ([IO.File]::Exists($candidate) -or [IO.Directory]::Exists($candidate)) { Stop-M1BRail 'D_RECOVERY_ALREADY_STARTED' }
    }
  }
}

function Write-M1DReceipt {
  param([string]$Name, [object]$Payload, [AllowNull()][object]$ReceiptContext)
  if ($Name -cnotmatch (Get-M1BReceiptNamePattern)) {
    Stop-M1BRail 'D_RECEIPT_NAME_INVALID'
  }
  $receipt = [ordered]@{
    schemaVersion = 1; campaign = $Campaign; kind = $Name; runId = $RunId
    reviewedObjectSha256 = $ReviewedObjectSha256; scriptSha256 = Get-M1BSha256File $PSCommandPath
    machine = [Environment]::MachineName; windowsSessionId = [Diagnostics.Process]::GetCurrentProcess().SessionId
    namespaceIdentity = Get-M1DNamespaceIdentity
    authorizationRecordId = $SensitiveAuthorizationRecordId; payload = $Payload
  }
  if ($Campaign -ceq 'M12' -and $null -ne $ReceiptContext) { Stop-M1BRail 'M12_FOREIGN_RECOVERY_CONTEXT' }
  if ($null -ne $ReceiptContext) {
    if (-not (Test-M1DRecoveryReceiptName $Name)) { Stop-M1BRail 'D_RECOVERY_RECEIPT_CONTEXT_REJECTED' }
    $expected = Get-M1DReceiptExpectation $Name $ReceiptContext
    $receipt.schemaVersion = $expected.schemaVersion
    $receipt.recoveryOrigin = $expected.recoveryOrigin
  }
  $path = Join-Path $script:DRunRoot ((Get-M1BReceiptPrefix) + $Name + '.json')
  $json = (ConvertTo-Json $receipt -Depth 12 -Compress) + "`n"
  if ($json.Length -gt 1048576 -or $json.Contains('SCRAM-SHA-256$') -or $json.Contains('M1B_CLIENT|')) { Stop-M1BRail 'D_RECEIPT_CONTENT_REJECTED' }
  Write-M1BCreateNewUtf8 $path $json
  Write-M1BCreateNewUtf8 ($path + '.sha256') ((Get-M1BSha256File $path) + "`n")
  return $path
}

function Read-M1DReceipt {
  param([string]$Name, [AllowNull()][object]$ReceiptContext)
  if ($Name -cnotmatch (Get-M1BReceiptNamePattern)) { Stop-M1BRail 'D_RECEIPT_NAME_INVALID' }
  $path = Join-Path $script:DRunRoot ((Get-M1BReceiptPrefix) + $Name + '.json')
  # The trusted caller and expected filename select identity, never JSON fields.
  $identity = Get-M1DReceiptExpectation $Name $ReceiptContext
  Assert-M1BNoReparseAncestors $path
  if (-not [IO.File]::Exists($path) -or -not [IO.File]::Exists($path + '.sha256')) { Stop-M1BRail 'D_RECEIPT_MISSING' }
  if ((Get-Item -LiteralPath $path).Length -gt 1048576 -or (Get-Item -LiteralPath ($path + '.sha256')).Length -ne 65) { Stop-M1BRail 'D_RECEIPT_SIZE_INVALID' }
  $bytes = [IO.File]::ReadAllBytes($path)
  $expected = [IO.File]::ReadAllText($path + '.sha256', (Get-M1BUtf8))
  if ($expected -cnotmatch '^[0-9a-f]{64}\n\z' -or (Get-M1BSha256Bytes $bytes) -cne $expected.Substring(0, 64)) { Stop-M1BRail 'D_RECEIPT_HASH_INVALID' }
  if ($null -ne $identity.fileSha256 -and (Get-M1BSha256Bytes $bytes) -cne $identity.fileSha256) { Stop-M1BRail 'D_RECOVERY_ORIGIN_HASH_INVALID' }
  Assert-M1BNoDuplicateJsonProperties $bytes
  $value = ConvertFrom-Json ((Get-M1BUtf8).GetString($bytes))
  $properties = @('schemaVersion','campaign','kind','runId','reviewedObjectSha256','scriptSha256','machine','windowsSessionId','namespaceIdentity','authorizationRecordId','payload')
  if ($identity.schemaVersion -eq 2) { $properties += 'recoveryOrigin' }
  Assert-M1BExactProperties $value $properties
  if ($identity.schemaVersion -eq 2) {
    Assert-M1BExactProperties $value.recoveryOrigin @('reviewedObjectSha256','scriptSha256','campaignReceiptSha256','provisionReceiptSha256')
    foreach ($field in @('reviewedObjectSha256','scriptSha256','campaignReceiptSha256','provisionReceiptSha256')) {
      if ($value.recoveryOrigin.$field -isnot [string] -or -not [string]::Equals($value.recoveryOrigin.$field, $identity.recoveryOrigin.$field, [StringComparison]::Ordinal)) { Stop-M1BRail 'D_RECOVERY_ORIGIN_INVALID' }
    }
  }
  if (-not (Test-M1BJsonInteger $value.schemaVersion) -or $value.schemaVersion -ne $identity.schemaVersion -or
      $value.campaign -isnot [string] -or $value.campaign -cne $Campaign -or $value.kind -isnot [string] -or -not [string]::Equals($value.kind, $Name, [StringComparison]::Ordinal) -or
      $value.runId -isnot [string] -or -not [string]::Equals($value.runId, $RunId, [StringComparison]::Ordinal) -or
      $value.reviewedObjectSha256 -isnot [string] -or -not [string]::Equals($value.reviewedObjectSha256, $identity.reviewedObjectSha256, [StringComparison]::Ordinal) -or
      $value.scriptSha256 -isnot [string] -or -not [string]::Equals($value.scriptSha256, $identity.scriptSha256, [StringComparison]::Ordinal) -or
      $value.machine -isnot [string] -or $value.machine -cne [Environment]::MachineName -or
      -not (Test-M1BJsonInteger $value.windowsSessionId) -or $value.windowsSessionId -ne [Diagnostics.Process]::GetCurrentProcess().SessionId -or
      $value.namespaceIdentity -isnot [string] -or $value.namespaceIdentity -cne (Get-M1DNamespaceIdentity) -or
      $value.authorizationRecordId -isnot [string] -or $value.authorizationRecordId -cnotmatch '^AUTH-[A-Z0-9][A-Z0-9._:-]{0,122}$' -or
      ($null -ne $identity.authorizationRecordId -and -not [string]::Equals($value.authorizationRecordId, $identity.authorizationRecordId, [StringComparison]::Ordinal))) { Stop-M1BRail 'D_RECEIPT_BINDING_INVALID' }
  if ($Name -ceq 'terminal' -and $value.payload.PSObject.Properties.Name -ccontains 'diagnostics') {
    $diagnostics = $value.payload.diagnostics
    Assert-M1BExactProperties $diagnostics @('schemaVersion','primary','secondary')
    if (-not (Test-M1BJsonInteger $diagnostics.schemaVersion) -or $diagnostics.schemaVersion -notin @(1,2) -or
        $diagnostics.secondary -isnot [array] -or ($null -eq $diagnostics.primary -and $diagnostics.secondary.Count -ne 0)) { Stop-M1BRail 'D_DIAGNOSTIC_INVALID' }
    $failures = @($diagnostics.secondary)
    if ($null -ne $diagnostics.primary) { $failures = @($diagnostics.primary) + $failures }
    [void](Get-M1DDiagnostics -Failures $failures -SchemaVersion $diagnostics.schemaVersion)
  }
  if ($Name -ceq 'terminal' -and $value.payload.PSObject.Properties.Name -ccontains 'cookieDiagnostic' -and $null -ne $value.payload.cookieDiagnostic) {
    if ($value.payload.campaignResult -cne 'FAIL') { Stop-M1BRail 'D_COOKIE_DIAGNOSTIC_INVALID' }
    $campaign = Read-M1DReceipt 'campaign'
    Assert-M1DCookieDiagnostic $value.payload.cookieDiagnostic $campaign.payload.runtimeSha256 $campaign.payload.frontendRuntimeSha256
  }
  if ($Name -ceq 'terminal' -and $value.payload.PSObject.Properties.Name -ccontains 'browserDiagnostic' -and $null -ne $value.payload.browserDiagnostic) {
    $campaign = Read-M1DReceipt 'campaign'
    Assert-M1DBrowserDiagnostic $value.payload.browserDiagnostic $campaign.payload.runtimeSha256 $campaign.payload.frontendRuntimeSha256
    if ($value.payload.campaignResult -ceq 'PASS') { Stop-M1BRail 'D_BROWSER_DIAGNOSTIC_INVALID' }
  }
  if ($Name -ceq 'terminal' -and $value.payload.PSObject.Properties.Name -ccontains 'harnessDiagnostic' -and $null -ne $value.payload.harnessDiagnostic) {
    if ($value.payload.campaignResult -cne 'FAIL') { Stop-M1BRail 'D_CONTROL_MESSAGE_REJECTED' }
    $campaign = Read-M1DReceipt 'campaign'
    Assert-M1DHarnessDiagnostic $value.payload.harnessDiagnostic $campaign.payload.runtimeSha256
  }
  return $value
}

function Get-M1DNamespaceIdentity {
  Initialize-M1BContainedProcessType
  return [Ritomer.M1B.ContainedProcess]::DNamespaceIdentity()
}

function Assert-M1DNoQuarantine {
  if ($Campaign -ceq 'M12') {
    $foreign = $script:EvidenceBaseRoot + '\.m1d-unreleased.json'
    if ([IO.File]::Exists($foreign) -or [IO.Directory]::Exists($foreign)) { Stop-M1BRail 'M12_FOREIGN_CAMPAIGN_UNRELEASED' }
  } elseif ($Campaign -ceq 'D') {
    $foreign = $script:EvidenceBaseRoot + '\.m12-unreleased.json'
    if ([IO.File]::Exists($foreign) -or [IO.Directory]::Exists($foreign)) { Stop-M1BRail 'D_FOREIGN_CAMPAIGN_UNRELEASED' }
  }
  if ([IO.File]::Exists($script:DQuarantinePath) -or [IO.Directory]::Exists($script:DQuarantinePath)) { Stop-M1BRail 'D_PREVIOUS_CAMPAIGN_UNRELEASED' }
}

function Enter-M1DQuarantine {
  param([object]$Payload)
  Assert-M1DNoQuarantine
  $receiptPath = Write-M1DReceipt 'campaign' $Payload
  $marker = [ordered]@{ runId = $RunId; root = $script:DRunRoot; receiptSha256 = Get-M1BSha256File $receiptPath }
  Write-M1BCreateNewUtf8 $script:DQuarantinePath ((ConvertTo-Json $marker -Compress) + "`n")
}

function Assert-M1DQuarantineBinding {
  param([AllowNull()][object]$ReceiptContext)
  $campaignReceipt = Read-M1DReceipt 'campaign' -ReceiptContext $ReceiptContext
  $provenanceObject = if ($null -ne $ReceiptContext) { $ReceiptContext.origin.reviewedObjectSha256 } else { $ReviewedObjectSha256 }
  $payload = $campaignReceipt.payload
  $runtimeFields = if ($Campaign -ceq 'M12') { @('m12RuntimeManifestSha256') } else { @('integratedManifestSha256','frontendRuntimeSha256') }
  Assert-M1BExactProperties $payload (@('preflightAuthorizationRecordId','preflightSha256','psqlSha256','cluster','adminRoleOid','maintenanceDatabaseOid','provenance','runtimeSha256','controllerProcessId','controllerCreationTicks') + $runtimeFields)
  foreach ($hashName in (@('preflightSha256','psqlSha256','runtimeSha256') + $runtimeFields)) {
    if ($payload.$hashName -isnot [string] -or $payload.$hashName -cnotmatch '^[0-9a-f]{64}$') { Stop-M1BRail 'D_CAMPAIGN_PAYLOAD_INVALID' }
  }
  if ($payload.preflightAuthorizationRecordId -isnot [string] -or $payload.preflightAuthorizationRecordId -cnotmatch '^AUTH-[A-Z0-9][A-Z0-9._:-]{0,122}$' -or
      $payload.cluster -isnot [string] -or $payload.cluster -cnotmatch '^[1-9][0-9]{0,19}$' -or
      $payload.provenance -isnot [string] -or $payload.provenance -cne (Get-M1BProvenance $RunId $provenanceObject $payload.cluster) -or
      -not (Test-M1BJsonInteger $payload.adminRoleOid) -or $payload.adminRoleOid -le 0 -or
      -not (Test-M1BJsonInteger $payload.maintenanceDatabaseOid) -or $payload.maintenanceDatabaseOid -le 0 -or
      -not (Test-M1BJsonInteger $payload.controllerProcessId) -or $payload.controllerProcessId -le 0 -or
      $payload.controllerCreationTicks -isnot [string] -or $payload.controllerCreationTicks -cnotmatch '^[1-9][0-9]{16,18}$') { Stop-M1BRail 'D_CAMPAIGN_PAYLOAD_INVALID' }
  if (-not [IO.File]::Exists($script:DQuarantinePath) -or (Get-Item -LiteralPath $script:DQuarantinePath -Force).Length -gt 4096) { Stop-M1BRail 'D_QUARANTINE_MARKER_MISSING' }
  Assert-M1BNoReparseAncestors $script:DQuarantinePath
  $markerBytes = [IO.File]::ReadAllBytes($script:DQuarantinePath)
  Assert-M1BNoDuplicateJsonProperties $markerBytes
  $marker = ConvertFrom-Json ((Get-M1BUtf8).GetString($markerBytes))
  Assert-M1BExactProperties $marker @('runId','root','receiptSha256')
  if ($marker.runId -isnot [string] -or $marker.runId -cne $RunId -or $marker.root -isnot [string] -or
      $marker.root -cne $script:DRunRoot -or $marker.receiptSha256 -isnot [string] -or
      $marker.receiptSha256 -cne (Get-M1BSha256File (Join-Path $script:DRunRoot ((Get-M1BReceiptPrefix) + 'campaign.json')))) { Stop-M1BRail 'D_QUARANTINE_BINDING_INVALID' }
  return $campaignReceipt
}

function Exit-M1DQuarantine {
  param([ValidateSet('cleanup','recovery-cleanup')][string]$CleanupReceipt, [AllowNull()][object]$ReceiptContext)
  [void](Assert-M1DQuarantineBinding -ReceiptContext $ReceiptContext)
  $receipt = Read-M1DReceipt $CleanupReceipt -ReceiptContext $ReceiptContext
  if ($receipt.payload.targetsAbsent -isnot [bool] -or -not $receipt.payload.targetsAbsent) { Stop-M1BRail 'D_CLEANUP_NOT_PROVEN' }
  [IO.File]::Delete($script:DQuarantinePath)
}

function Start-M1DContainedChild {
  param([Diagnostics.ProcessStartInfo]$StartInfo, [string]$Role, [AllowNull()][object]$ArgumentFile, [AllowNull()][object]$ReceiptContext)
  Set-M1DDiagnosticOperation 'launch-identity'
  Assert-M1DDeadline
  Initialize-M1BContainedProcessType
  $stage = if ($LifecycleAction -ceq 'CleanupOnly') { 'recovery' } elseif ($Mode -ceq 'Preflight') { 'preflight' } else { 'lifecycle' }
  $name = 'launch-' + $stage + '-' + $Role
  $binaryHash = Get-M1BSha256File $StartInfo.FileName
  $argumentFileHash = 'NONE'
  if ($null -ne $ArgumentFile) {
    if ($Role -cnotin @('SEED','BACKEND') -or $ArgumentFile.Sha256 -cnotmatch '^[0-9a-f]{64}$') { Stop-M1BRail 'D_ARGUMENT_FILE_ROLE_INVALID' }
    [void](Assert-M1BContainedPath $script:DRunRoot $ArgumentFile.Path)
    Assert-M1BNoReparseAncestors $ArgumentFile.Path
    if ((Get-M1BSha256File $ArgumentFile.Path) -cne $ArgumentFile.Sha256) { Stop-M1BRail 'D_ARGUMENT_FILE_CHANGED' }
    $argumentFileHash = [string]$ArgumentFile.Sha256
  }
  $commandHash = Get-M1BSha256Bytes ((Get-M1BUtf8).GetBytes($StartInfo.FileName + "`n" + $StartInfo.Arguments + "`n" + $argumentFileHash))
  Set-M1DDiagnosticOperation 'launch-intent'
  [void](Write-M1DReceipt ($name + '-intent') ([ordered]@{ role = $Role; binaryPath = $StartInfo.FileName; binarySha256 = $binaryHash; commandSha256 = $commandHash; argumentFileSha256 = $argumentFileHash }) -ReceiptContext $ReceiptContext)
  $onConfined = {
    param([int]$ChildId, [long]$CreationTicks, [string]$JobName)
    [void](Write-M1DReceipt ($name + '-confined') ([ordered]@{
      role = $Role; processId = $ChildId; creationTimeUtcTicks = [string]$CreationTicks
      jobName = $JobName; binaryPath = $StartInfo.FileName; binarySha256 = $binaryHash; commandSha256 = $commandHash
      argumentFileSha256 = $argumentFileHash
      confinedBeforeResume = $true
    }) -ReceiptContext $ReceiptContext)
  }
  Set-M1DDiagnosticOperation 'native-launch'
  if ($Campaign -ceq 'M12') { return [Ritomer.M1B.ContainedProcess]::StartM12($StartInfo, $RunId, $Role, [Action[int,long,string]]$onConfined) }
  return [Ritomer.M1B.ContainedProcess]::StartD($StartInfo, $RunId, $Role, [Action[int,long,string]]$onConfined)
}

function Write-M1DStopReceipt {
  param([string]$Role, [object]$Process, [AllowNull()][object]$ReceiptContext, [AllowNull()][object]$StopChild)
  if ($null -ne $StopChild) {
    if ($Role -cne $StopChild.Role) { Stop-M1BRail 'D_DIAGNOSTIC_INVALID' }
    Assert-M1DChildStopBudget $StopChild 'stop-receipt'
  }
  if (Test-M1DChildRole $Role) {
    Assert-M1DChildStopState $Role (Get-M1DChildStopState $Role $Process)
    Set-M1DDiagnosticOperation 'stop-receipt'
  } elseif (-not $Process.HasExited -or $Process.ActiveProcessCount -ne 0) { Stop-M1BRail 'D_CHILD_STOP_NOT_ATTESTED' }
  if ($null -ne $StopChild) { Assert-M1DChildStopBudget $StopChild 'stop-receipt' }
  $stage = if ($LifecycleAction -ceq 'CleanupOnly') { 'recovery' } elseif ($Mode -ceq 'Preflight') { 'preflight' } else { 'lifecycle' }
  [void](Write-M1DReceipt ('launch-' + $stage + '-' + $Role + '-stopped') ([ordered]@{
    processId = $Process.Id; creationTimeUtcTicks = [string]$Process.CreationTimeUtcTicks; jobName = $Process.JobName; activeProcesses = 0
  }) -ReceiptContext $ReceiptContext)
}

function Assert-M1DRecordedCessation {
  param([AllowNull()][object]$ReceiptContext, [string]$LifecycleAuthorizationRecordId)
  $prefix = Get-M1BReceiptPrefix
  Initialize-M1BContainedProcessType
  $launchFiles = @(Get-ChildItem -LiteralPath $script:DRunRoot -Filter ($prefix + 'launch-*.json') -File)
  foreach ($file in $launchFiles) {
    if ($file.BaseName.Substring($prefix.Length) -cnotmatch (Get-M1BReceiptNamePattern)) { Stop-M1BRail 'D_LAUNCH_INVENTORY_INVALID' }
    $base = $file.BaseName -creplace '-(intent|confined|stopped)$', ''
    foreach ($required in @('-intent.json','-confined.json')) {
      if (-not [IO.File]::Exists((Join-Path $script:DRunRoot ($base + $required)))) { Stop-M1BRail 'D_LAUNCH_RECEIPT_ORPHAN' }
    }
  }
  if ([IO.File]::Exists((Join-Path $script:DRunRoot ($prefix + 'provision.json')))) {
    foreach ($requiredRole in @('READINESS','ADMIN_PSQL_PROVISION')) {
      if (-not [IO.File]::Exists((Join-Path $script:DRunRoot ($prefix + 'launch-lifecycle-' + $requiredRole + '-confined.json')))) { Stop-M1BRail 'D_PROVISION_LAUNCH_EVIDENCE_MISSING' }
    }
  }
  $intents = @(Get-ChildItem -LiteralPath $script:DRunRoot -Filter ($prefix + 'launch-*-intent.json') -File)
  foreach ($intentFile in $intents) {
    $name = $intentFile.BaseName.Substring($prefix.Length)
    $intent = Read-M1DReceipt $name -ReceiptContext $ReceiptContext
    Assert-M1BExactProperties $intent.payload @('role','binaryPath','binarySha256','commandSha256','argumentFileSha256')
    if ($intent.payload.role -isnot [string] -or $intent.payload.binaryPath -isnot [string] -or
        -not [IO.Path]::IsPathRooted($intent.payload.binaryPath) -or
        $intent.payload.binarySha256 -isnot [string] -or $intent.payload.binarySha256 -cnotmatch '^[0-9a-f]{64}$' -or
        $intent.payload.commandSha256 -isnot [string] -or $intent.payload.commandSha256 -cnotmatch '^[0-9a-f]{64}$' -or
        $intent.payload.argumentFileSha256 -isnot [string] -or $intent.payload.argumentFileSha256 -cnotmatch '^(NONE|[0-9a-f]{64})$') { Stop-M1BRail 'D_LAUNCH_INTENT_INVALID' }
    $confined = Read-M1DReceipt ($name.Replace('-intent', '-confined')) -ReceiptContext $ReceiptContext
    Assert-M1BExactProperties $confined.payload @('role','processId','creationTimeUtcTicks','jobName','binaryPath','binarySha256','commandSha256','argumentFileSha256','confinedBeforeResume')
    if (-not (Test-M1BJsonInteger $confined.payload.processId) -or $confined.payload.processId -le 0 -or
        $confined.payload.creationTimeUtcTicks -isnot [string] -or $confined.payload.creationTimeUtcTicks -cnotmatch '^[1-9][0-9]{16,18}$' -or
        $confined.payload.confinedBeforeResume -isnot [bool] -or -not $confined.payload.confinedBeforeResume -or
        $confined.payload.role -cne $intent.payload.role -or $confined.payload.binaryPath -cne $intent.payload.binaryPath -or
        $confined.payload.binarySha256 -cne $intent.payload.binarySha256 -or $confined.payload.commandSha256 -cne $intent.payload.commandSha256 -or
        $confined.payload.argumentFileSha256 -cne $intent.payload.argumentFileSha256 -or
        $confined.payload.jobName -cne ((Get-M1BJobPrefix) + $RunId + '.' + $confined.payload.role)) { Stop-M1BRail 'D_CONFINEMENT_RECEIPT_INVALID' }
    if ($Campaign -ceq 'M12') {
      $expectedAuthorization = if ($name.StartsWith('launch-preflight-')) { $PreflightAuthorizationRecordId } elseif ($name.StartsWith('launch-lifecycle-')) { $LifecycleAuthorizationRecordId } else { $SensitiveAuthorizationRecordId }
      if ([string]::IsNullOrWhiteSpace($expectedAuthorization) -or $intent.authorizationRecordId -cne $expectedAuthorization -or $confined.authorizationRecordId -cne $expectedAuthorization) { Stop-M1BRail 'M12_LAUNCH_AUTHORIZATION_MISMATCH' }
    }
    $stoppedName = $name.Replace('-intent', '-stopped')
    if (($null -ne $ReceiptContext -or $Campaign -ceq 'M12') -and [IO.File]::Exists((Join-Path $script:DRunRoot ($prefix + $stoppedName + '.json')))) {
      $stopped = Read-M1DReceipt $stoppedName -ReceiptContext $ReceiptContext
      if ($Campaign -ceq 'M12' -and $stopped.authorizationRecordId -cne $expectedAuthorization) { Stop-M1BRail 'M12_LAUNCH_AUTHORIZATION_MISMATCH' }
      Assert-M1BExactProperties $stopped.payload @('processId','creationTimeUtcTicks','jobName','activeProcesses')
      if (-not (Test-M1BJsonInteger $stopped.payload.processId) -or $stopped.payload.processId -ne $confined.payload.processId -or
          $stopped.payload.creationTimeUtcTicks -isnot [string] -or $stopped.payload.creationTimeUtcTicks -cne $confined.payload.creationTimeUtcTicks -or
          $stopped.payload.jobName -isnot [string] -or $stopped.payload.jobName -cne $confined.payload.jobName -or
          -not (Test-M1BJsonInteger $stopped.payload.activeProcesses) -or $stopped.payload.activeProcesses -ne 0) { Stop-M1BRail 'D_CHILD_STOP_NOT_ATTESTED' }
    }
    $rootProcess = Get-Process -Id ([int]$confined.payload.processId) -ErrorAction SilentlyContinue
    if ($null -ne $rootProcess) {
      try {
        if ($rootProcess.StartTime.ToUniversalTime().Ticks -eq [long]$confined.payload.creationTimeUtcTicks) { Stop-M1BRail 'D_RECORDED_ROOT_STILL_ALIVE' }
      } finally { $rootProcess.Dispose() }
    }
    # -1 means the named job has vanished. Only the validated pre-resume receipt,
    # exact Windows namespace and missing original root make that acceptable.
    $active = Get-M1DRecordedJobCount ([string]$confined.payload.jobName)
    if ($active -gt 0) { Stop-M1BRail 'D_RECORDED_DESCENDANT_STILL_ALIVE' }
  }
}

function Get-M1DRecordedJobCount {
  param([string]$JobName)
  if ($Campaign -ceq 'M12') { return [Ritomer.M1B.ContainedProcess]::QueryM12Job($JobName) }
  return [Ritomer.M1B.ContainedProcess]::QueryDJob($JobName)
}

function Assert-M1DPortsFree {
  $ports = @(Get-M1DListenerPorts)
  if ($ports -contains 5173 -or $ports -contains 8080) { Stop-M1BRail 'D_INTEGRATED_PORT_NOT_FREE' }
}

function Get-M1DListenerPorts {
  return @([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | ForEach-Object { $_.Port })
}

function New-M1DDrain {
  param([object]$Process, [string]$Role, [AllowNull()][string]$ForbiddenLiteral)
  $drain = [pscustomobject]@{
    Process = $Process; Role = $Role; ForbiddenLiteral = $ForbiddenLiteral
    Stdout = [Text.StringBuilder]::new(); Stderr = [Text.StringBuilder]::new()
    OutBuffer = [char[]]::new(4096); ErrBuffer = [char[]]::new(4096)
    OutTask = $null; ErrTask = $null; OutEnded = $false; ErrEnded = $false
    OutFailed = $false; ErrFailed = $false; Failures = @{}
    ParsedOffset = 0; ErrParsedOffset = 0; Signals = @{}; StopReceiptWritten = $false
    StopAttempted = $false; StopDeadline = $null; StopFailure = $null; StopBudgetFailure = $null
  }
  $drain.OutTask = $Process.StandardOutput.ReadAsync($drain.OutBuffer, 0, 4096)
  $drain.ErrTask = $Process.StandardError.ReadAsync($drain.ErrBuffer, 0, 4096)
  return $drain
}

function Report-M1DDrainFailure {
  param([object]$Drain, [string]$Code, [switch]$Finalizing)
  $first = -not $Drain.Failures.ContainsKey($Code)
  $Drain.Failures[$Code] = $true
  if (-not $Finalizing) { Stop-M1DChildControl $Drain.Role $Code }
  if ($first) {
    try { Stop-M1DChildControl $Drain.Role $Code }
    catch { [void](Add-M1DFailure $_) }
  }
}

function Update-M1DDrain {
  param([object]$Drain, [switch]$Finalizing)
  foreach ($stream in @('Out','Err')) {
    $taskName = $stream + 'Task'; $endedName = $stream + 'Ended'; $bufferName = $stream + 'Buffer'; $failedName = $stream + 'Failed'
    $capture = if ($stream -ceq 'Out') { $Drain.Stdout } else { $Drain.Stderr }
    if (-not $Drain.$endedName -and -not $Drain.$failedName -and $Drain.$taskName.IsCompleted) {
      try { $read = $Drain.$taskName.GetAwaiter().GetResult() }
      catch {
        $Drain.$failedName = $true
        $code = if ($stream -ceq 'Out') { 'D_CHILD_STDOUT_READ_FAILED' } else { 'D_CHILD_STDERR_READ_FAILED' }
        Report-M1DDrainFailure $Drain $code -Finalizing:$Finalizing
        continue
      }
      if ($read -eq 0) { $Drain.$endedName = $true } else {
        $overflow = $capture.Length + $read -gt 8388608
        if (-not $overflow) { [void]$capture.Append($Drain.$bufferName, 0, $read) }
        # Advance the real read before reporting a semantic failure. Finalization
        # must not append the same completed buffer again or stop draining stderr.
        $reader = if ($stream -ceq 'Out') { $Drain.Process.StandardOutput } else { $Drain.Process.StandardError }
        try { $Drain.$taskName = $reader.ReadAsync($Drain.$bufferName, 0, 4096) }
        catch {
          $Drain.$failedName = $true
          $code = if ($stream -ceq 'Out') { 'D_CHILD_STDOUT_READ_FAILED' } else { 'D_CHILD_STDERR_READ_FAILED' }
          Report-M1DDrainFailure $Drain $code -Finalizing:$Finalizing
        }
        if ($overflow) { Report-M1DDrainFailure $Drain 'D_CHILD_OUTPUT_LIMIT_EXCEEDED' -Finalizing:$Finalizing }
        if (-not [string]::IsNullOrEmpty($Drain.ForbiddenLiteral) -and $capture.ToString().Contains($Drain.ForbiddenLiteral)) { Report-M1DDrainFailure $Drain 'RUNNER_SECRET_OUTPUT_CONTAMINATION' -Finalizing:$Finalizing }
      }
    }
  }
  # Only complete, exact stdout lines from the owning child can carry control.
  $text = $Drain.Stdout.ToString()
  while (($end = $text.IndexOf("`n", $Drain.ParsedOffset)) -ge 0) {
    $rawLine = $text.Substring($Drain.ParsedOffset, $end - $Drain.ParsedOffset)
    $line = $rawLine.TrimEnd([char]13)
    $Drain.ParsedOffset = $end + 1
    if ($line.Contains('HARNESS_FAILED')) { Report-M1DDrainFailure $Drain 'D_CONTROL_MESSAGE_WRONG_CHANNEL' -Finalizing:$Finalizing; continue }
    if ($line.Contains('M1D_')) {
      if ($line.StartsWith('M1D_BROWSER_DIAGNOSTIC ', [StringComparison]::Ordinal)) {
        if ((Get-M1BUtf8).GetByteCount($rawLine + "`n") -gt 8192 -or
            -not (Test-M1DDiagnosticLiteral $Drain.Role @('BROWSER_JOURNEY')) -or $null -ne $script:DBrowserDiagnostic) { Report-M1DDrainFailure $Drain 'D_CONTROL_MESSAGE_REJECTED' -Finalizing:$Finalizing; continue }
        try { $script:DBrowserDiagnostic = Read-M1DBrowserDiagnosticLine $line }
        catch { Report-M1DDrainFailure $Drain 'D_CONTROL_MESSAGE_REJECTED' -Finalizing:$Finalizing }
        continue
      }
      if ($line.StartsWith('M1D_COOKIE_DIAGNOSTIC ', [StringComparison]::Ordinal)) {
        if ((Get-M1BUtf8).GetByteCount($rawLine + "`n") -gt 8192) { Report-M1DDrainFailure $Drain 'D_CONTROL_MESSAGE_REJECTED' -Finalizing:$Finalizing; continue }
        if (-not (Test-M1DDiagnosticLiteral $Drain.Role @('BROWSER_COOKIE')) -or $null -ne $script:DCookieDiagnostic) { Report-M1DDrainFailure $Drain 'D_CONTROL_MESSAGE_REJECTED' -Finalizing:$Finalizing; continue }
        try { $script:DCookieDiagnostic = Read-M1DCookieDiagnosticLine $line }
        catch { Report-M1DDrainFailure $Drain 'D_CONTROL_MESSAGE_REJECTED' -Finalizing:$Finalizing }
        # Detail is retained through finalization; it is never a success signal.
        continue
      }
      $expected = switch ($Drain.Role) {
        'SEED' { @('M1D_SEED_COMPLETED ' + $RunId) }
        'BACKEND' { @(('M1D_BACKEND_READY ' + $RunId), ('M1D_BACKEND_STOPPED ' + $RunId)) }
        'HARNESS' { @(('M1D_JARS_RESULT ' + $RunId + ' ' + $ReviewedObjectSha256 + ' ' + $script:DRuntimeSha256 + ' PASS'), ('M1D_HARNESS_STOPPED ' + $RunId + ' JARS=PASS VITE_STOP=PASS')) }
        default { @() }
      }
      if ($expected -cnotcontains $line -or $Drain.Signals.ContainsKey($line)) { Report-M1DDrainFailure $Drain 'D_CONTROL_MESSAGE_REJECTED' -Finalizing:$Finalizing; continue }
      if ($line.StartsWith('M1D_HARNESS_STOPPED ', [StringComparison]::Ordinal) -and -not $script:DFinishSent) { Report-M1DDrainFailure $Drain 'D_PREMATURE_HARNESS_STOP' -Finalizing:$Finalizing; continue }
      if ($line.StartsWith('M1D_BACKEND_STOPPED ', [StringComparison]::Ordinal) -and -not $script:DBackendStopSent) { Report-M1DDrainFailure $Drain 'D_PREMATURE_BACKEND_STOP' -Finalizing:$Finalizing; continue }
      $Drain.Signals[$line] = $true
    }
  }
  if ($Drain.OutEnded -and $text.Substring($Drain.ParsedOffset).Contains('M1D_')) { Report-M1DDrainFailure $Drain 'D_UNTERMINATED_CONTROL_MESSAGE' -Finalizing:$Finalizing }
  if ($text.Substring($Drain.ParsedOffset).StartsWith('M1D_COOKIE_DIAGNOSTIC ', [StringComparison]::Ordinal) -and $text.Length - $Drain.ParsedOffset -gt 8192) { Report-M1DDrainFailure $Drain 'D_CONTROL_MESSAGE_REJECTED' -Finalizing:$Finalizing }
  if ($text.Substring($Drain.ParsedOffset).StartsWith('M1D_BROWSER_DIAGNOSTIC ', [StringComparison]::Ordinal) -and $text.Length - $Drain.ParsedOffset -gt 8192) { Report-M1DDrainFailure $Drain 'D_CONTROL_MESSAGE_REJECTED' -Finalizing:$Finalizing }
  if ($Drain.Stderr.ToString().Contains('M1D_')) { Report-M1DDrainFailure $Drain 'D_CONTROL_MESSAGE_WRONG_CHANNEL' -Finalizing:$Finalizing }
  if ($Drain.OutEnded -and $text.Substring($Drain.ParsedOffset).Contains('HARNESS_FAILED')) { Report-M1DDrainFailure $Drain 'D_CONTROL_MESSAGE_WRONG_CHANNEL' -Finalizing:$Finalizing }
  # The harness owns this one stderr frame. Never serialize the stream itself.
  $errorText = $Drain.Stderr.ToString()
  while (($end = $errorText.IndexOf("`n", $Drain.ErrParsedOffset)) -ge 0) {
    $line = $errorText.Substring($Drain.ErrParsedOffset, $end - $Drain.ErrParsedOffset)
    $Drain.ErrParsedOffset = $end + 1
    if (-not $line.Contains('HARNESS_FAILED')) { continue }
    if (-not (Test-M1DDiagnosticLiteral $Drain.Role @('HARNESS')) -or $null -ne $script:DHarnessDiagnostic) { Report-M1DDrainFailure $Drain 'D_CONTROL_MESSAGE_REJECTED' -Finalizing:$Finalizing; continue }
    try { $detail = Read-M1DHarnessDiagnosticLine $line }
    catch { Report-M1DDrainFailure $Drain 'D_CONTROL_MESSAGE_REJECTED' -Finalizing:$Finalizing; continue }
    $script:DHarnessDiagnostic = $detail
  }
  $tail = $errorText.Substring($Drain.ErrParsedOffset)
  if ($tail.Contains('HARNESS_FAILED') -and ($Drain.ErrEnded -or (Get-M1BUtf8).GetByteCount($tail) -gt 2048)) { Report-M1DDrainFailure $Drain 'D_CONTROL_MESSAGE_REJECTED' -Finalizing:$Finalizing }
  if ($Drain.Role -ceq 'HARNESS' -and $null -ne $script:DHarnessDiagnostic -and $Drain.Signals.Count -gt 0) { Report-M1DDrainFailure $Drain 'D_CONTROL_MESSAGE_REJECTED' -Finalizing:$Finalizing }
}

function Update-M1DChildren {
  foreach ($child in $script:DChildren.Values) { Update-M1DDrain $child }
}

function Wait-M1DSignal {
  param([string]$Role, [string]$Signal, [switch]$RequireExit)
  $child = $script:DChildren[$Role]
  while ($true) {
    Assert-M1DDeadline
    Update-M1DChildren
    foreach ($otherRole in @('BACKEND','HARNESS')) {
      if ($script:DChildren.ContainsKey($otherRole) -and $otherRole -cne $Role -and $script:DChildren[$otherRole].Process.HasExited) { Stop-M1DChildControl $otherRole 'D_INTEGRATED_CHILD_DISAPPEARED' }
    }
    if ($Role -ceq 'HARNESS' -and $null -ne $script:DHarnessDiagnostic) { Stop-M1DChildControl $Role 'D_REQUIRED_RESULT_ABSENT' }
    $hasSignal = $child.Signals.ContainsKey($Signal)
    if ($hasSignal -and (-not $RequireExit -or ($child.Process.HasExited -and $child.OutEnded -and $child.ErrEnded))) {
      if ($child.Process.HasExited -and $child.Process.ExitCode -ne 0) { Stop-M1DChildControl $Role 'D_CHILD_NONZERO_EXIT' }
      return
    }
    if ($child.Process.HasExited -and $child.OutEnded -and $child.ErrEnded) { Stop-M1DChildControl $Role 'D_REQUIRED_RESULT_ABSENT' }
    [Threading.Thread]::Sleep(10)
  }
}

function Test-M1DViteReady {
  param([int]$TimeoutMilliseconds)
  # Public unauthenticated document only; no session/API request or new owner.
  $request = [Net.HttpWebRequest]::CreateHttp('http://127.0.0.1:5173/')
  $request.Proxy = $null; $request.AllowAutoRedirect = $false; $request.KeepAlive = $false
  $request.Timeout = $TimeoutMilliseconds; $request.ReadWriteTimeout = $TimeoutMilliseconds
  $response = $null
  try {
    $response = $request.GetResponse()
    return [int]$response.StatusCode -eq 200 -and $response.ContentType.StartsWith('text/html', [StringComparison]::OrdinalIgnoreCase)
  } catch [Net.WebException] {
    if ($null -ne $_.Exception.Response) { $_.Exception.Response.Dispose() }
    return $false
  } finally { if ($null -ne $response) { $response.Dispose() }; $request.Abort() }
}

function Wait-M1DViteReady {
  if (-not $script:DChildren.ContainsKey('VITE')) { Stop-M1BRail 'D_VITE_CHILD_MISSING' }
  while ($true) {
    Assert-M1DDeadline
    Update-M1DChildren
    foreach ($role in @('VITE','BACKEND')) {
      if ($script:DChildren.ContainsKey($role) -and $script:DChildren[$role].Process.HasExited) { Stop-M1DChildControl $role 'D_INTEGRATED_CHILD_DISAPPEARED' }
    }
    $remaining = [Math]::Min($script:DPhaseDeadline, $script:DTotalMilliseconds) - $script:DCampaignClock.ElapsedMilliseconds
    $ready = Test-M1DViteReady ([int][Math]::Max(1L, [Math]::Min(200L, $remaining)))
    Assert-M1DDeadline
    Update-M1DChildren
    foreach ($role in @('VITE','BACKEND')) {
      if ($script:DChildren.ContainsKey($role) -and $script:DChildren[$role].Process.HasExited) { Stop-M1DChildControl $role 'D_INTEGRATED_CHILD_DISAPPEARED' }
    }
    if ($ready) { return }
    # Probe cadence, not a startup delay: navigation requires observed HTTP 200.
    # The existing integrated deadline is never reset by a failed probe.
    $remaining = [Math]::Min($script:DPhaseDeadline, $script:DTotalMilliseconds) - $script:DCampaignClock.ElapsedMilliseconds
    if ($remaining -gt 0) { [Threading.Thread]::Sleep([int][Math]::Min(50L, $remaining)) }
  }
}

function Get-M1DChildStopState {
  param([string]$Role, [object]$Process)
  Set-M1DDiagnosticOperation 'stop-root-read'
  try {
    $exited = $Process.HasExited
    if ($exited -isnot [bool]) { Stop-M1DChildControl $Role 'D_CHILD_STOP_NOT_ATTESTED' }
  } catch { Stop-M1DChildControl $Role 'D_CHILD_STOP_NOT_ATTESTED' }
  Set-M1DDiagnosticOperation 'stop-job-read'
  try {
    $active = $Process.ActiveProcessCount
    if (-not (Test-M1BJsonInteger $active) -or $active -lt 0) { Stop-M1DChildControl $Role 'D_CHILD_STOP_NOT_ATTESTED' }
  } catch { Stop-M1DChildControl $Role 'D_CHILD_STOP_NOT_ATTESTED' }
  return [pscustomobject]@{ RootExited = $exited; ActiveProcesses = $active }
}

function Assert-M1DChildStopState {
  param([string]$Role, [object]$State)
  Set-M1DDiagnosticOperation 'stop-root-wait'
  if (-not $State.RootExited) { Stop-M1DChildControl $Role 'D_CHILD_STOP_NOT_ATTESTED' }
  Set-M1DDiagnosticOperation 'stop-job-wait'
  if ($State.ActiveProcesses -ne 0) { Stop-M1DChildControl $Role 'D_CHILD_STOP_NOT_ATTESTED' }
}

function Save-M1DChildStopFailure {
  param([object]$Child, [System.Management.Automation.ErrorRecord]$Failure)
  # Ownership is the caller's closed role, never native exception text. The
  # ErrorRecord remains in memory only; the existing collector projects it.
  $Failure.Exception.Data['M1DChildRole'] = $Child.Role
  if ($null -eq $Child.StopFailure) { $Child.StopFailure = $Failure }
  $code = Get-M1BStopCode $Failure
  if ($null -eq $Child.StopBudgetFailure -and
      ($code -cin @('D_TERMINATION_BUDGET_EXHAUSTED','D_STREAM_STOP_UNPROVEN') -or
       ($code -ceq 'D_CHILD_STOP_NOT_ATTESTED' -and $script:DOperation -cin @('stop-root-wait','stop-job-wait') -and
        (Get-M1DChildStopRemaining $Child) -le 0))) { $Child.StopBudgetFailure = $Failure }
  [void](Add-M1DFailure $Failure)
}

function Get-M1DChildStopRemaining {
  param([object]$Child)
  if ($null -eq $Child.StopDeadline) { return 0 }
  return [int][Math]::Max(0L, $Child.StopDeadline - $script:DCampaignClock.ElapsedMilliseconds)
}

function Assert-M1DChildStopBudget {
  param([object]$Child, [string]$Operation)
  if ((Get-M1DChildStopRemaining $Child) -gt 0) { return }
  # Reuse the first expiry occurrence, including a precise root/job/stream
  # refusal at the deadline. Later boundaries must not manufacture duplicates.
  if ($null -ne $Child.StopBudgetFailure) { throw $Child.StopBudgetFailure }
  Set-M1DDiagnosticOperation $Operation
  try { Stop-M1DChildControl $Child.Role 'D_TERMINATION_BUDGET_EXHAUSTED' }
  catch { $Child.StopBudgetFailure = $_; throw }
}
function Stop-M1DChild {
  param([string]$Role, [switch]$Forced, [switch]$Finalizing)
  if (-not $script:DChildren.ContainsKey($Role)) { return }
  $child = $script:DChildren[$Role]
  if ($child.StopAttempted) {
    # A failed finalization remains a barrier. Never renew its deadline or read
    # handles already released; collector identity prevents duplicate incidents.
    if ($null -ne $child.StopFailure) { throw $child.StopFailure }
    Stop-M1DChildControl $Role 'D_CHILD_FINALIZATION_FAILED'
  }
  if (-not $Forced) {
    Set-M1DDiagnosticOperation 'stop-root-read'
    try { $exited = $child.Process.HasExited }
    catch { Stop-M1DChildControl $Role 'D_CHILD_STOP_NOT_ATTESTED' }
    if ($exited -isnot [bool]) { Stop-M1DChildControl $Role 'D_CHILD_STOP_NOT_ATTESTED' }
    if (-not $exited) { Stop-M1DChildControl $Role 'D_UNEXPECTED_LIVE_CHILD' }
  }
  $child.StopAttempted = $true
  $treeStopped = $false
  try {
    Set-M1DDiagnosticOperation 'stop-terminate'
    try {
      $child.StopDeadline = $script:DCampaignClock.ElapsedMilliseconds + (Get-M1DStopBudget)
      $remaining = Get-M1DChildStopRemaining $child
      if ($remaining -le 0) { Stop-M1BRail 'D_TERMINATION_BUDGET_EXHAUSTED' }
      $treeStopped = $child.Process.TerminateTreeAndWait($remaining)
      if (-not $treeStopped) { Stop-M1DChildControl $Role 'D_TREE_STOP_UNPROVEN' }
      Assert-M1DChildStopBudget $child 'stop-terminate'
    } catch { Save-M1DChildStopFailure $child $_ }
    if ($treeStopped -and $null -eq $child.StopFailure) {
      try {
        while ($true) {
          $state = Get-M1DChildStopState $Role $child.Process
          if ((Get-M1DChildStopRemaining $child) -le 0) {
            Assert-M1DChildStopState $Role $state
            Assert-M1DChildStopBudget $child 'stop-attestation'
          }
          if ($state.RootExited -and $state.ActiveProcesses -eq 0) { break }
          Set-M1DDiagnosticOperation 'stop-drain'
          Update-M1DDrain $child -Finalizing
          [Threading.Thread]::Sleep([Math]::Min(10, (Get-M1DChildStopRemaining $child)))
        }
      } catch { Save-M1DChildStopFailure $child $_ }
    }
    try {
      Set-M1DDiagnosticOperation 'stop-drain'
      while (-not (($child.OutEnded -or $child.OutFailed) -and ($child.ErrEnded -or $child.ErrFailed))) {
        Update-M1DDrain $child -Finalizing
        if (-not (($child.OutEnded -or $child.OutFailed) -and ($child.ErrEnded -or $child.ErrFailed)) -and
            (Get-M1DChildStopRemaining $child) -le 0) {
          $child.Failures['D_STREAM_STOP_UNPROVEN'] = $true
          Stop-M1DChildControl $Role 'D_STREAM_STOP_UNPROVEN'
        }
        if (-not (($child.OutEnded -or $child.OutFailed) -and ($child.ErrEnded -or $child.ErrFailed))) {
          [Threading.Thread]::Sleep([Math]::Min(10, (Get-M1DChildStopRemaining $child)))
        }
      }
      Assert-M1DChildStopBudget $child 'stop-drain'
    } catch { Save-M1DChildStopFailure $child $_ }
    # Stream/scenario faults never manufacture EOF or success, but do not erase
    # independently established cessation. No failed stop/publication is retried.
    if ($null -eq $child.StopFailure) {
      try {
        Assert-M1DChildStopBudget $child 'stop-receipt'
        Write-M1DStopReceipt $Role $child.Process -StopChild $child
        $child.StopReceiptWritten = $true
        Assert-M1DChildStopBudget $child 'stop-receipt'
      } catch { Save-M1DChildStopFailure $child $_ }
    }
  } finally {
    Set-M1DDiagnosticOperation 'stop-release'
    try {
      $releaseFailures = @($child.Process.DisposeD((Get-M1DChildStopRemaining $child)))
      foreach ($operation in $releaseFailures) {
        if (-not (Test-M1DDiagnosticLiteral $operation @('stop-release','stop-job-terminate','stop-job-close','stop-root-release-wait','stop-stdout-close','stop-stderr-close','stop-stdin-close','stop-process-close'))) {
          $operation = 'stop-release'
        }
        Set-M1DDiagnosticOperation $operation
        try { Stop-M1DChildControl $Role 'D_CHILD_FINALIZATION_FAILED' }
        catch { Save-M1DChildStopFailure $child $_ }
      }
      Assert-M1DChildStopBudget $child 'stop-release'
    } catch { Save-M1DChildStopFailure $child $_ }
    finally { $child.ForbiddenLiteral = $null }
  }
  if ($null -ne $child.StopFailure) { throw $child.StopFailure }
  $script:DChildren.Remove($Role)
  if (-not $Finalizing -and $child.Failures.Count -gt 0) { Stop-M1DChildControl $Role 'D_CHILD_FINALIZATION_FAILED' }
}
function Read-M1DBrowserReceipt {
  param([ValidateSet('cookie','browser')][string]$Kind, [switch]$Optional)
  $path = Join-Path $script:DRunRoot ('d-' + $Kind + '-evidence.json')
  if (-not [IO.File]::Exists($path)) { if ($Optional) { return $null }; Stop-M1BRail 'D_BROWSER_RECEIPT_MISSING' }
  Assert-M1BNoReparseAncestors $path
  if ((Get-Item -LiteralPath $path).Length -gt 65536) { Stop-M1BRail 'D_BROWSER_RECEIPT_TOO_LARGE' }
  $bytes = [IO.File]::ReadAllBytes($path)
  Assert-M1BNoDuplicateJsonProperties $bytes
  $value = ConvertFrom-Json ((Get-M1BUtf8).GetString($bytes))
  Assert-M1BExactProperties $value @('schemaVersion','kind','runId','reviewedObjectSha256','runtimeSha256','origin','browserName','browserVersion','scenarios','evidence','finishRequested','tabsClosed')
  if (-not (Test-M1BJsonInteger $value.schemaVersion) -or $value.schemaVersion -ne 1 -or $value.kind -isnot [string] -or $value.kind -cne $Kind -or $value.runId -isnot [string] -or $value.runId -cne $RunId -or
      $value.reviewedObjectSha256 -isnot [string] -or $value.reviewedObjectSha256 -cne $ReviewedObjectSha256 -or
      $value.runtimeSha256 -isnot [string] -or $value.runtimeSha256 -cne $script:DRuntimeSha256 -or
      $value.origin -isnot [string] -or $value.origin -cne 'http://127.0.0.1:5173' -or
      $value.browserName -isnot [string] -or $value.browserName -cnotin @('Chromium') -or
      $value.browserVersion -isnot [string] -or $value.browserVersion -cnotmatch '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' -or
      $value.finishRequested -isnot [bool] -or -not $value.finishRequested -or $value.tabsClosed -isnot [bool] -or -not $value.tabsClosed) { Stop-M1BRail 'D_BROWSER_BINDING_INVALID' }
  $names = if ($Kind -ceq 'cookie') { @('secureCookieAttributes','bootstrapContinuity','login204','authenticatedBootstrap','me200') } else {
    @('cookie','csrf','roles','logout','explicitReconnection','idleExpiry32Minutes','focus','multipleTabs','safeReturn','keyboard','narrowViewport','privacy')
  }
  Assert-M1BExactProperties $value.scenarios $names
  foreach ($name in $names) {
    $scenario = $value.scenarios.$name
    Assert-M1BExactProperties $scenario @('result','observation','evidenceId')
    if ($scenario.result -isnot [string] -or $scenario.result -cne 'PASS' -or $scenario.observation -isnot [string] -or
        $scenario.observation.Length -lt 8 -or $scenario.observation.Length -gt 1024 -or $scenario.evidenceId -isnot [string] -or
        $scenario.evidenceId -cnotmatch '^[a-z][a-z0-9-]{1,63}$') { Stop-M1BRail 'D_BROWSER_SCENARIO_INVALID' }
  }
  if ($value.evidence -isnot [array] -or $value.evidence.Count -lt 1 -or $value.evidence.Count -gt 32) { Stop-M1BRail 'D_BROWSER_EVIDENCE_INVALID' }
  $seen = @{}
  foreach ($item in $value.evidence) {
    Assert-M1BExactProperties $item @('id','file','sha256')
    if ($item.id -isnot [string] -or $item.id -cnotmatch '^[a-z][a-z0-9-]{1,63}$' -or $seen.ContainsKey($item.id) -or
        $item.file -isnot [string] -or $item.file -cnotmatch '^[a-z0-9-]+\.(png|json|txt|md)$' -or
        $item.sha256 -isnot [string] -or $item.sha256 -cnotmatch '^[0-9a-f]{64}$') { Stop-M1BRail 'D_BROWSER_EVIDENCE_INVALID' }
    $evidencePath = Join-Path (Join-Path $script:DRunRoot 'browser-evidence') $item.file
    Assert-M1BNoReparseAncestors $evidencePath
    if (-not [IO.File]::Exists($evidencePath) -or (Get-Item -LiteralPath $evidencePath).Length -gt 16777216 -or
        (Get-M1BSha256File $evidencePath) -cne $item.sha256) { Stop-M1BRail 'D_BROWSER_EVIDENCE_HASH_INVALID' }
    $seen[$item.id] = $true
  }
  foreach ($name in $names) { if (-not $seen.ContainsKey($value.scenarios.$name.evidenceId)) { Stop-M1BRail 'D_BROWSER_EVIDENCE_REFERENCE_MISSING' } }
  if ($value.evidence.Count -ne 1 -or $value.evidence[0].file -cne ($Kind + '-observations.json') -or $value.evidence[0].id -cne ($Kind + '-observations')) { Stop-M1BRail 'D_BROWSER_OBSERVATIONS_REQUIRED' }
  $observationBytes = [IO.File]::ReadAllBytes((Join-Path (Join-Path $script:DRunRoot 'browser-evidence') $value.evidence[0].file))
  Assert-M1BNoDuplicateJsonProperties $observationBytes
  $observation = ConvertFrom-Json ((Get-M1BUtf8).GetString($observationBytes))
  Assert-M1DBrowserObservations $observation $Kind $value.browserVersion
  return [pscustomobject]@{ Value = $value; Sha256 = Get-M1BSha256Bytes $bytes }
}

function Assert-M1DBrowserObservations {
  param([object]$Value, [ValidateSet('cookie','browser')][string]$Kind, [string]$BrowserVersion)
  Assert-M1BExactProperties $Value @('schemaVersion','kind','runId','objectSha','runtimeSha','frontendSha','browserVersion','observations','windows')
  foreach ($key in @('kind','runId','objectSha','runtimeSha','frontendSha','browserVersion')) {
    if ($Value.$key -isnot [string]) { Stop-M1BRail 'D_BROWSER_OBSERVATION_BINDING_INVALID' }
  }
  if (-not (Test-M1BJsonInteger $Value.schemaVersion) -or $Value.schemaVersion -ne 1 -or $Value.kind -cne $Kind -or $Value.runId -cne $RunId -or
      $Value.objectSha -cne $ReviewedObjectSha256 -or $Value.runtimeSha -cne $script:DRuntimeSha256 -or
      $Value.frontendSha -cne $script:DFrontendRuntimeSha256 -or $Value.browserVersion -cne $BrowserVersion -or
      $Value.observations -isnot [array] -or $Value.observations.Count -gt 128 -or $Value.windows -isnot [array] -or $Value.windows.Count -gt 10 -or
      @($Value.windows | Where-Object { $_ -isnot [string] }).Count -ne 0) { Stop-M1BRail 'D_BROWSER_OBSERVATION_BINDING_INVALID' }
  $allowed = @('emittedCookie','acceptedCookie','continuity','login','rotation','authenticated','me','noteWrite','noteRead','roleRefusal','roleReadOnly',
    'csrfRefusal','csrfRenewal','csrfReplay','idleStart','idleEnd','idleRequests','expiredResponse','expiredUI','automaticLogin','explicitLogin','safeReturn',
    'logout','logoutInvalidated','anonymousAfterLogout','otherContextReady','sharedLogout','nativeFocus','nativeVisibility','keyboard','narrow',
    'privacyScans','privacyViolations','lostObservations','pagesClosed','contextsClosed','browserDisconnected')
  $observed = @{}; $last = -1.0
  foreach ($item in $Value.observations) {
    Assert-M1BExactProperties $item @('event','atMs','value')
    if ($item.event -isnot [string] -or $item.event -cnotin $allowed -or $observed.ContainsKey($item.event) -or
        -not (Test-M1BJsonInteger $item.value) -or $item.value -lt 0 -or
        ($item.atMs -isnot [double] -and $item.atMs -isnot [decimal] -and -not (Test-M1BJsonInteger $item.atMs)) -or
        [double]::IsNaN([double]$item.atMs) -or [double]::IsInfinity([double]$item.atMs) -or $item.atMs -lt 0 -or $item.atMs -lt $last) { Stop-M1BRail 'D_BROWSER_OBSERVATION_INVALID' }
    $last = [double]$item.atMs; $observed[$item.event] = $item
  }
  $required = @{ emittedCookie=31; acceptedCookie=31; continuity=1; login=204; rotation=1; authenticated=1; me=200
    privacyViolations=0; lostObservations=0; pagesClosed=1; contextsClosed=1; browserDisconnected=1 }
  $windows = @('anonymous','authenticated')
  if ($Kind -ceq 'browser') {
    $windows += @('folder','write','csrf','roles','before-idle','expired','reconnected','logout')
    $browserRequired = @{ noteRead=1; roleRefusal=403; roleReadOnly=1; csrfRefusal=403; csrfRenewal=1; csrfReplay=0; idleRequests=0
      expiredResponse=401; expiredUI=1; automaticLogin=0; explicitLogin=204; safeReturn=1; logout=204; logoutInvalidated=1
      anonymousAfterLogout=1; otherContextReady=1; sharedLogout=1; nativeFocus=1; nativeVisibility=1; keyboard=1; narrow=1 }
    foreach ($key in $browserRequired.Keys) { $required[$key] = $browserRequired[$key] }
    foreach ($key in @('idleStart','idleEnd','expiredResponse','explicitLogin','noteWrite')) { if (-not $observed.ContainsKey($key)) { Stop-M1BRail 'D_BROWSER_OBSERVATION_MISSING' } }
    if ($observed.noteWrite.value -notin @(200,201) -or $observed.idleEnd.atMs - $observed.idleStart.atMs -lt 1920000 -or
        $observed.idleEnd.value - $observed.idleStart.value -lt 1920000 -or $observed.expiredResponse.atMs -lt $observed.idleEnd.atMs -or
        $observed.explicitLogin.atMs -lt $observed.expiredResponse.atMs) { Stop-M1BRail 'D_BROWSER_CHRONOLOGY_INVALID' }
  }
  foreach ($key in $required.Keys) {
    if (-not $observed.ContainsKey($key) -or $observed[$key].value -ne $required[$key]) { Stop-M1BRail 'D_BROWSER_OBSERVATION_MISSING' }
  }
  if (($Value.windows -join '|') -cne ($windows -join '|') -or -not $observed.ContainsKey('privacyScans') -or $observed.privacyScans.value -lt $windows.Count) { Stop-M1BRail 'D_BROWSER_PRIVACY_WINDOW_MISSING' }
}

function Wait-M1DBrowserReceipt {
  param([ValidateSet('cookie','browser')][string]$Kind)
  $role = if ($Kind -ceq 'cookie') { 'BROWSER_COOKIE' } else { 'BROWSER_JOURNEY' }
  if (-not $script:DChildren.ContainsKey($role)) { Stop-M1BRail 'D_BROWSER_CHILD_MISSING' }
  while ($true) {
    Assert-M1DDeadline
    Update-M1DChildren
    foreach ($other in $script:DChildren.Keys) {
      if ($other -cne $role -and $script:DChildren[$other].Process.HasExited) { Stop-M1DChildControl $other 'D_INTEGRATED_CHILD_DISAPPEARED' }
    }
    $child = $script:DChildren[$role]
    if ($child.Process.HasExited) {
      if ($child.Process.ExitCode -ne 0) { Stop-M1DChildControl $role 'D_BROWSER_RUNNER_FAILED' }
      if ($child.OutEnded -and $child.ErrEnded) {
        if ($role -ceq 'BROWSER_COOKIE' -and $null -ne $script:DCookieDiagnostic) { Stop-M1DChildControl $role 'D_BROWSER_RUNNER_FAILED' }
        if ($role -ceq 'BROWSER_JOURNEY' -and $null -ne $script:DBrowserDiagnostic) { Stop-M1DChildControl $role 'D_BROWSER_RUNNER_FAILED' }
        if ($child.Process.ActiveProcessCount -ne 0) { Stop-M1BRail 'D_BROWSER_DESCENDANT_ALIVE' }
        return Read-M1DBrowserReceipt $Kind
      }
    }
    [Threading.Thread]::Sleep(25)
  }
}

function Read-M1DIntegratedRuntime {
  param([string]$BuildRoot)
  Set-M1DDiagnosticOperation 'runtime-manifest'
  $path = Join-Path $BuildRoot 'm1d-integrated-runtime.json'
  Assert-M1BNoReparseAncestors $path
  if (-not [IO.File]::Exists($path) -or (Get-Item -LiteralPath $path).Length -gt 8388608 -or
      (Get-M1BSha256File $path) -cne $script:DIntegratedManifestSha256) { Stop-M1BRail 'D_RUNTIME_MANIFEST_DIVERGED' }
  $bytes = [IO.File]::ReadAllBytes($path)
  Assert-M1BNoDuplicateJsonProperties $bytes
  $runtime = ConvertFrom-Json ((Get-M1BUtf8).GetString($bytes))
  Assert-M1BExactProperties $runtime @('schemaVersion','mainClass','javaExecutablePath','classpathEntries','supportClasses','runtimeInputs','structure','files','seedArguments','backendArguments')
  if ($runtime.schemaVersion -ne 1 -or $runtime.mainClass -cne 'ch.qamwaq.ritomer.testsupport.PostgresTestRailDBootstrap' -or
      $runtime.javaExecutablePath -isnot [string] -or $runtime.classpathEntries -isnot [array] -or
      $runtime.runtimeInputs -isnot [array] -or $runtime.files -isnot [array] -or $runtime.structure -isnot [array] -or
      $runtime.seedArguments.Count -ne 1 -or $runtime.seedArguments[0] -cne 'seed' -or
      $runtime.backendArguments.Count -ne 1 -or $runtime.backendArguments[0] -cne 'backend') { Stop-M1BRail 'D_RUNTIME_MANIFEST_INVALID' }
  Set-M1DDiagnosticOperation 'runtime-structure'
  $observedStructure = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $observedFiles = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($input in $runtime.runtimeInputs) {
    Assert-M1BExactProperties $input @('label','path')
    if ($input.label -isnot [string] -or $input.label -cnotmatch '^[a-z0-9][a-z0-9/-]{0,127}$' -or $input.path -isnot [string] -or -not [IO.Path]::IsPathRooted($input.path)) { Stop-M1BRail 'D_RUNTIME_INPUT_INVALID' }
    $inputIoPath = ConvertTo-M1BRunnerArtifactIoPath $input.path
    Assert-M1BNoReparseAncestors $input.path -RunnerArtifactScan -AllowMissing
    if (-not [IO.File]::Exists($inputIoPath) -and -not [IO.Directory]::Exists($inputIoPath)) {
      [void]$observedStructure.Add($input.label + "`0.`0M")
      continue
    }
    $queue = [Collections.Generic.Queue[string]]::new()
    $queue.Enqueue([string]$input.path)
    while ($queue.Count -gt 0) {
      Assert-M1DDeadline
      $entryPath = $queue.Dequeue()
      $entryIoPath = ConvertTo-M1BRunnerArtifactIoPath $entryPath
      $attributes = [IO.File]::GetAttributes($entryIoPath)
      if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-M1BRail 'D_RUNTIME_LINK_REJECTED' }
      $relative = if ($entryPath -ceq $input.path) { '.' } else { $entryPath.Substring($input.path.TrimEnd('\').Length + 1).Replace('\','/') }
      $isDirectory = ($attributes -band [IO.FileAttributes]::Directory) -ne 0
      $kind = if ($isDirectory) { 'D' } else { 'F' }
      [void]$observedStructure.Add($input.label + "`0" + $relative + "`0" + $kind)
      if ($observedStructure.Count -gt 40000) { Stop-M1BRail 'D_RUNTIME_STRUCTURE_LIMIT' }
      if ($isDirectory) {
        foreach ($childIoPath in [IO.Directory]::EnumerateFileSystemEntries($entryIoPath)) {
          # Remove only the namespace produced by our own validated enumeration.
          $childPath = if ($childIoPath.StartsWith('\\?\UNC\', [StringComparison]::OrdinalIgnoreCase)) {
            '\\' + $childIoPath.Substring(8)
          } elseif ($childIoPath.StartsWith('\\?\', [StringComparison]::Ordinal)) {
            $childIoPath.Substring(4)
          } else { Stop-M1BRail 'D_RUNTIME_INPUT_INVALID' }
          $queue.Enqueue($childPath)
        }
      }
      else { [void]$observedFiles.Add($entryPath) }
    }
  }
  if ($observedStructure.Count -ne $runtime.structure.Count) { Stop-M1BRail 'D_RUNTIME_STRUCTURE_DIVERGED' }
  foreach ($entry in $runtime.structure) {
    Assert-M1BExactProperties $entry @('label','relativePath','kind')
    if (-not $observedStructure.Remove($entry.label + "`0" + $entry.relativePath + "`0" + $entry.kind)) { Stop-M1BRail 'D_RUNTIME_STRUCTURE_DIVERGED' }
  }
  # A file may belong to two logical input roots. Verify every declared mapping,
  # while requiring the unique physical-file inventory to be exhaustive.
  Set-M1DDiagnosticOperation 'runtime-files'
  foreach ($entry in $runtime.files) {
    Assert-M1BExactProperties $entry @('path','sha256')
    if ($entry.path -isnot [string] -or $entry.sha256 -isnot [string] -or $entry.sha256 -cnotmatch '^[0-9a-f]{64}$') { Stop-M1BRail 'D_RUNTIME_FILE_DIVERGED' }
    $entryIoPath = ConvertTo-M1BRunnerArtifactIoPath $entry.path
    Assert-M1BNoReparseAncestors $entry.path -RunnerArtifactScan
    if (-not [IO.File]::Exists($entryIoPath) -or (Get-M1BSha256File $entryIoPath) -cne $entry.sha256) { Stop-M1BRail 'D_RUNTIME_FILE_DIVERGED' }
    [void]$observedFiles.Remove([string]$entry.path)
    Assert-M1DDeadline
  }
  if ($observedFiles.Count -ne 0) { Stop-M1BRail 'D_RUNTIME_FILE_INVENTORY_INCOMPLETE' }
  return $runtime
}

function Get-M1DBrowserDistribution {
  # One installed distribution, never a personal profile or entire cache.
  $root = 'C:\Users\LuisAllauca\AppData\Local\ms-playwright\chromium-1200\chrome-win64'
  $executable = Join-Path $root 'chrome.exe'
  Assert-M1BNoReparseAncestors $executable
  if (-not [IO.File]::Exists($executable)) { Stop-M1BRail 'D_BROWSER_EXECUTABLE_MISSING' }
  return [pscustomobject]@{ Root = $root; Executable = $executable }
}

function Get-M1DFrontendRuntimeSha256 {
  $node = 'C:\Program Files\nodejs\node.exe'
  Assert-M1BNoReparseAncestors $node
  if (-not [IO.File]::Exists($node)) { Stop-M1BRail 'D_NODE_EXECUTABLE_MISSING' }
  $root = Join-Path $script:RepoRoot 'frontend\node_modules'
  Assert-M1BNoReparseAncestors $root
  if (-not [IO.Directory]::Exists($root)) { Stop-M1BRail 'D_FRONTEND_DEPENDENCIES_MISSING' }
  $records = [Collections.Generic.List[string]]::new()
  $records.Add('NODE|' + (Get-M1BSha256File $node))
  $queue = [Collections.Generic.Queue[string]]::new(); $queue.Enqueue($root)
  while ($queue.Count -gt 0) {
    Assert-M1DDeadline
    $directory = $queue.Dequeue()
    foreach ($path in [IO.Directory]::EnumerateFileSystemEntries($directory)) {
      $relative = $path.Substring($root.Length + 1).Replace('\','/')
      $entry = Get-Item -LiteralPath $path -Force
      # --force rebuilds this generated cache. A link would redirect that write
      # outside the reviewed dependency root, so reject it before exclusion.
      if ($relative -ceq '.vite') {
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or -not $entry.PSIsContainer) { Stop-M1BRail 'D_VITE_CACHE_LINK_REJECTED' }
        continue
      }
      if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        $targets = @($entry.Target)
        if ($targets.Count -ne 1 -or [string]::IsNullOrEmpty([string]$targets[0])) { Stop-M1BRail 'D_NODE_LINK_INVALID' }
        $target = [string]$targets[0]
        if (-not [IO.Path]::IsPathRooted($target)) { $target = Join-Path $entry.Parent.FullName $target }
        $resolved = [IO.Path]::GetFullPath($target)
        if (-not $resolved.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { Stop-M1BRail 'D_NODE_LINK_ESCAPES_ROOT' }
        $records.Add('L|' + $relative + '|' + $resolved.Substring($root.Length + 1).Replace('\','/'))
      } elseif ($entry.PSIsContainer) {
        $records.Add('D|' + $relative); $queue.Enqueue($path)
      } else {
        if ($entry.Length -gt 536870912) { Stop-M1BRail 'D_NODE_FILE_LIMIT' }
        $records.Add('F|' + $relative + '|' + (Get-M1BSha256File $path))
      }
      if ($records.Count -gt 100000) { Stop-M1BRail 'D_NODE_INVENTORY_LIMIT' }
    }
  }
  $browser = Get-M1DBrowserDistribution
  $records.Add('BROWSER_PATH|' + $browser.Executable)
  $queue.Enqueue($browser.Root)
  while ($queue.Count -gt 0) {
    Assert-M1DDeadline
    $directory = $queue.Dequeue()
    foreach ($path in [IO.Directory]::EnumerateFileSystemEntries($directory)) {
      $entry = Get-Item -LiteralPath $path -Force
      $relative = $path.Substring($browser.Root.Length + 1).Replace('\','/')
      if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-M1BRail 'D_BROWSER_LINK_REJECTED' }
      if ($entry.PSIsContainer) { $records.Add('BD|' + $relative); $queue.Enqueue($path) }
      else { $records.Add('BF|' + $relative + '|' + (Get-M1BSha256File $path)) }
      if ($records.Count -gt 110000) { Stop-M1BRail 'D_BROWSER_INVENTORY_LIMIT' }
    }
  }
  $sorted = $records.ToArray(); [Array]::Sort($sorted, [StringComparer]::Ordinal)
  return Get-M1BSha256Bytes ((Get-M1BUtf8).GetBytes(($sorted -join "`n")))
}

function Write-M1DJavaArgumentFile {
  param([string]$NeutralRoot, [object]$Runtime)
  if ($Runtime.classpathEntries -isnot [array] -or $Runtime.classpathEntries.Count -lt 1 -or $Runtime.classpathEntries.Count -gt 2048) { Stop-M1BRail 'D_CLASSPATH_INVALID' }
  foreach ($entry in $Runtime.classpathEntries) {
    if ($entry -isnot [string] -or [string]::IsNullOrWhiteSpace($entry) -or $entry -cmatch '[\x00\r\n";]' -or -not [IO.Path]::IsPathRooted($entry)) { Stop-M1BRail 'D_CLASSPATH_ENTRY_INVALID' }
  }
  Assert-M1BNoReparseAncestors $NeutralRoot
  $classpath = $Runtime.classpathEntries -join ';'
  if ($classpath.Length -gt 1048576) { Stop-M1BRail 'D_CLASSPATH_SIZE_LIMIT' }
  $path = Join-Path $NeutralRoot 'java-arguments.txt'
  # Java argument-file quoting is different from Windows command-line quoting.
  # Only the validated classpath is written; JVM flags/main/mode remain fixed.
  $text = '-classpath' + "`n" + '"' + $classpath.Replace('\','\\') + '"' + "`n"
  Write-M1BCreateNewUtf8 $path $text
  return [pscustomobject]@{ Path = $path; Sha256 = Get-M1BSha256File $path }
}

function Start-M1DIntegratedChild {
  param([ValidateSet('SEED','BACKEND','VITE','HARNESS','BROWSER_COOKIE','BROWSER_JOURNEY')][string]$Role, [object]$Runtime,
    [object]$Provision, [string]$RunnerPassword, [string]$Cluster)
  Set-M1DDiagnosticOperation 'child-environment'
  $neutral = New-M1BNeutralEnvironment (Join-Path $script:DRunRoot ('volatile\integrated\' + $Role.ToLowerInvariant() + '-child'))
  $arguments = @()
  $startInfo = [Diagnostics.ProcessStartInfo]::new()
  $argumentFile = $null
  $java = $Role -cin @('SEED','BACKEND')
  if ($java) {
    $startInfo.FileName = [string]$Runtime.javaExecutablePath
    $phase = 'd-' + $Role.ToLowerInvariant()
    $storage = Join-Path $script:DRunRoot 'volatile\integrated\local-fs'
    if (-not [IO.Directory]::Exists($storage)) { [void](New-M1BDirectory $storage) }
    $javaEnvironment = @{
      RITOMER_DB_RAIL_CAMPAIGN = 'D'; RITOMER_DB_RAIL_RUN_ID = $RunId; RITOMER_DB_RAIL_RUN_ROOT = $script:DRunRoot
      RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256 = $ReviewedObjectSha256; RITOMER_DB_RAIL_RUNTIME_SHA256 = $script:DRuntimeSha256
      RITOMER_DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER = $Cluster; RITOMER_DB_RAIL_DATABASE_OID = [string]$Provision.DatabaseOid
      RITOMER_DB_RAIL_RUNNER_ROLE_OID = [string]$Provision.RoleOid; RITOMER_DB_RAIL_POSTMASTER_START_UNIX_MICROS = $Provision.PostmasterStartUnixMicros
      RITOMER_DB_TESTS_ENABLED = 'true'; RITOMER_DB_TEST_JDBC_URL = $script:TargetJdbcUrl
      RITOMER_DB_TEST_USERNAME = $script:TargetRunnerRole; RITOMER_DB_TEST_PASSWORD = $RunnerPassword
      RITOMER_DB_TEST_DESTRUCTIVE_CONSENT = $script:DestructiveConsent; RITOMER_DB_TEST_RUN_ROOT = $script:DRunRoot
      RITOMER_DB_TEST_PHASE = $phase; RITOMER_DB_TEST_STORAGE_LOCAL_ROOT = $storage
      RITOMER_DB_TEST_APPLICATION_NAME = ('ritomer-m1-1d-' + $RunId + '-' + $phase)
    }
    foreach ($entry in $javaEnvironment.GetEnumerator()) { $neutral.Values[$entry.Key] = $entry.Value }
    Set-M1DDiagnosticOperation 'java-arguments'
    $argumentFile = Write-M1DJavaArgumentFile $neutral.Root $Runtime
    $arguments = @(('-Duser.home=' + $neutral.Home), ('-Djava.io.tmpdir=' + $neutral.Temp), '-Duser.name=ritomer-m1b-rail',
      '-Djava.net.useSystemProxies=false', ('-XX:ErrorFile=' + (Join-Path $neutral.Root 'hs_err_pid%p.log')),
      ('-XX:HeapDumpPath=' + (Join-Path $neutral.Root 'heapdump_pid%p.hprof')), '-XX:-HeapDumpOnOutOfMemoryError',
      ('@' + $argumentFile.Path), 'ch.qamwaq.ritomer.testsupport.PostgresTestRailDBootstrap', $Role.ToLowerInvariant())
  } else {
    $startInfo.FileName = 'C:\Program Files\nodejs\node.exe'
    if ($Role -ceq 'VITE') {
      $arguments = @((Join-Path $script:RepoRoot 'frontend\node_modules\vite\bin\vite.js'), '--host', '127.0.0.1', '--port', '5173', '--strictPort', '--force')
    } elseif ($Role -ceq 'HARNESS') {
      $arguments = @((Join-Path $script:RepoRoot 'frontend\local-two-actor-harness.mjs'))
      $neutral.Values['RITOMER_DB_RAIL_CAMPAIGN'] = 'D'; $neutral.Values['RITOMER_DB_RAIL_RUN_ID'] = $RunId
      $neutral.Values['RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256'] = $ReviewedObjectSha256
      $neutral.Values['RITOMER_DB_RAIL_RUNTIME_SHA256'] = $script:DRuntimeSha256
    } else {
      if ((Get-M1DFrontendRuntimeSha256) -cne $script:DFrontendRuntimeSha256) { Stop-M1BRail 'D_BROWSER_RUNTIME_CHANGED' }
      $browser = Get-M1DBrowserDistribution
      $kind = if ($Role -ceq 'BROWSER_COOKIE') { 'cookie' } else { 'browser' }
      $arguments = @((Join-Path $script:RepoRoot 'frontend\node_modules\@playwright\test\cli.js'), 'test', '--config',
        (Join-Path $script:RepoRoot 'frontend\e2e\m1d\playwright.config.ts'), ('--project=' + $kind))
      $neutral.Values['RITOMER_DB_RAIL_CAMPAIGN'] = 'D'; $neutral.Values['RITOMER_DB_RAIL_RUN_ID'] = $RunId
      $neutral.Values['RITOMER_DB_RAIL_RUN_ROOT'] = $script:DRunRoot
      $neutral.Values['RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256'] = $ReviewedObjectSha256
      $neutral.Values['RITOMER_DB_RAIL_RUNTIME_SHA256'] = $script:DRuntimeSha256
      $neutral.Values['RITOMER_M1D_FRONTEND_SHA256'] = $script:DFrontendRuntimeSha256
      $neutral.Values['RITOMER_M1D_BROWSER_EXECUTABLE'] = $browser.Executable
      $neutral.Values['RITOMER_M1D_BROWSER_PHASE'] = $kind
      # Version 1.63.0 suppresses snapshots only; test errors are sanitized first.
      $neutral.Values['PLAYWRIGHT_NO_COPY_PROMPT'] = '1'
    }
  }
  Set-M1DDiagnosticOperation 'child-start-info'
  $startInfo.Arguments = ($arguments | ForEach-Object { ConvertTo-M1BProcessArgument ([string]$_) }) -join ' '
  $startInfo.WorkingDirectory = if ($java) { $neutral.Root } else { Join-Path $script:RepoRoot 'frontend' }
  $startInfo.UseShellExecute = $false; $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardInput = $true; $startInfo.RedirectStandardOutput = $true; $startInfo.RedirectStandardError = $true
  $startInfo.StandardOutputEncoding = Get-M1BUtf8; $startInfo.StandardErrorEncoding = Get-M1BUtf8
  $startInfo.EnvironmentVariables.Clear()
  foreach ($entry in $neutral.Values.GetEnumerator()) { $startInfo.EnvironmentVariables[$entry.Key] = $entry.Value }
  try {
    $process = Start-M1DContainedChild $startInfo $Role $argumentFile
    Set-M1DDiagnosticOperation 'child-drain'
    $script:DChildren[$Role] = New-M1DDrain $process $Role $RunnerPassword
    if ($Role -cin @('SEED','VITE','BROWSER_COOKIE','BROWSER_JOURNEY')) { $process.StandardInput.Close() }
  } finally {
    $startInfo.EnvironmentVariables.Clear(); $neutral.Values.Clear()
    if ($java) { $javaEnvironment.Clear() }
    $RunnerPassword = $null
  }
}

function Invoke-M1DIntegrated {
  param([object]$Readiness, [object]$Provision, [string]$RunnerPassword, [string]$Cluster)
  Set-M1DDiagnosticOperation 'integrated-entry'
  $script:DRuntimeSha256 = [string]$Readiness.Result.RuntimeSha256
  $script:DFinishSent = $false; $script:DBackendStopSent = $false
  Set-M1DDiagnosticOperation 'ports'
  Assert-M1DPortsFree
  Set-M1DDiagnosticOperation 'phase'
  Enter-M1DPhase 'seed'
  $runtime = Read-M1DIntegratedRuntime $Readiness.BuildRoot
  Start-M1DIntegratedChild 'SEED' $runtime $Provision $RunnerPassword $Cluster
  Set-M1DDiagnosticOperation 'integrated-observations'
  Wait-M1DSignal 'SEED' ('M1D_SEED_COMPLETED ' + $RunId) -RequireExit
  Stop-M1DChild 'SEED'
  [void](Read-M1DIntegratedRuntime $Readiness.BuildRoot)
  Enter-M1DPhase 'backend'
  Start-M1DIntegratedChild 'BACKEND' $runtime $Provision $RunnerPassword $Cluster
  Wait-M1DSignal 'BACKEND' ('M1D_BACKEND_READY ' + $RunId)
  Enter-M1DPhase 'integration'
  Start-M1DIntegratedChild 'VITE' $runtime $Provision $RunnerPassword $Cluster
  Wait-M1DViteReady
  Start-M1DIntegratedChild 'BROWSER_COOKIE' $runtime $Provision $RunnerPassword $Cluster
  $cookie = Wait-M1DBrowserReceipt 'cookie'
  Stop-M1DChild 'BROWSER_COOKIE'
  Stop-M1DChild 'VITE' -Forced
  $listeners = @(Get-M1DListenerPorts)
  if ($listeners -contains 5173) { Stop-M1BRail 'D_PROVISIONAL_VITE_PORT_NOT_FREE' }
  Start-M1DIntegratedChild 'HARNESS' $runtime $Provision $RunnerPassword $Cluster
  $jarsSignal = 'M1D_JARS_RESULT ' + $RunId + ' ' + $ReviewedObjectSha256 + ' ' + $script:DRuntimeSha256 + ' PASS'
  Wait-M1DSignal 'HARNESS' $jarsSignal
  Start-M1DIntegratedChild 'BROWSER_JOURNEY' $runtime $Provision $RunnerPassword $Cluster
  $browser = Wait-M1DBrowserReceipt 'browser'
  Stop-M1DChild 'BROWSER_JOURNEY'
  if ((Read-M1DBrowserReceipt 'cookie').Sha256 -cne $cookie.Sha256) { Stop-M1BRail 'D_COOKIE_RECEIPT_CHANGED' }
  [void](Write-M1DReceipt 'integrated' ([ordered]@{ cookieReceiptSha256 = $cookie.Sha256; browserReceiptSha256 = $browser.Sha256; jars = $jarsSignal; runtimeSha256 = $script:DRuntimeSha256 }))
  Enter-M1DPhase 'stop'
  $script:DFinishSent = $true
  $script:DChildren['HARNESS'].Process.StandardInput.Write('M1D_FINISH ' + $RunId + "`n")
  $script:DChildren['HARNESS'].Process.StandardInput.Close()
  Wait-M1DSignal 'HARNESS' ('M1D_HARNESS_STOPPED ' + $RunId + ' JARS=PASS VITE_STOP=PASS') -RequireExit
  Stop-M1DChild 'HARNESS'
  $script:DBackendStopSent = $true
  $script:DChildren['BACKEND'].Process.StandardInput.WriteLine('M1D_BACKEND_STOP ' + $RunId)
  $script:DChildren['BACKEND'].Process.StandardInput.Close()
  Wait-M1DSignal 'BACKEND' ('M1D_BACKEND_STOPPED ' + $RunId) -RequireExit
  Stop-M1DChild 'BACKEND'
  Assert-M1DRecordedCessation
  Assert-M1DPortsFree
  if ((Read-M1DBrowserReceipt 'cookie').Sha256 -cne $cookie.Sha256 -or (Read-M1DBrowserReceipt 'browser').Sha256 -cne $browser.Sha256) { Stop-M1BRail 'D_BROWSER_RECEIPT_CHANGED' }
  [void](Read-M1DIntegratedRuntime $Readiness.BuildRoot)
  if ((Get-M1DFrontendRuntimeSha256) -cne $script:DFrontendRuntimeSha256) { Stop-M1BRail 'D_FRONTEND_RUNTIME_DIVERGED' }
  [void](Write-M1DReceipt 'stopped' ([ordered]@{ activeProcesses = 0; portsFree = $true; integratedReceiptSha256 = Get-M1BSha256File (Join-Path $script:DRunRoot 'd-integrated.json') }))
}

function Invoke-M1DLifecycle {
  $root = Assert-M1BInvocation
  if (-not [IO.Directory]::Exists($root)) { Stop-M1BRail 'LIFECYCLE_RUN_ROOT_MISSING' }
  $script:DRunRoot = $root
  Start-M1DClock 'Lifecycle'
  $lock = Enter-M1BRunLock $root
  try {
    Assert-M1DNoQuarantine
    $initial = Assert-M1BExecutionState $root 'd-lifecycle-initial'
    $preflight = Read-M1BPreflightManifest $root $RunId $ReviewedObjectSha256 $PreflightAuthorizationRecordId $initial.Baseline
    if ($preflight.Value.campaignStartTimestamp -isnot [string] -or $preflight.Value.campaignStartTimestamp -cnotmatch '^[1-9][0-9]{1,18}$' -or
        $preflight.Value.stopwatchFrequency -isnot [string] -or $preflight.Value.stopwatchFrequency -cne [string][Diagnostics.Stopwatch]::Frequency -or
        $preflight.Value.machine -isnot [string] -or $preflight.Value.machine -cne [Environment]::MachineName -or
        $preflight.Value.namespaceIdentity -isnot [string] -or $preflight.Value.namespaceIdentity -cne (Get-M1DNamespaceIdentity)) { Stop-M1BRail 'D_CAMPAIGN_CLOCK_BINDING_INVALID' }
    $campaignElapsed = ([Diagnostics.Stopwatch]::GetTimestamp() - [long]$preflight.Value.campaignStartTimestamp) * 1000.0 / [Diagnostics.Stopwatch]::Frequency
    if ($campaignElapsed -lt 0 -or $campaignElapsed -ge 11700000) { Stop-M1BRail 'D_CAMPAIGN_DEADLINE_EXPIRED' }
    $script:DTotalMilliseconds = [long][Math]::Min(9300000, 11700000 - $campaignElapsed + $script:DCampaignClock.ElapsedMilliseconds)
    Enter-M1DPhase 'readiness'
    Initialize-M1DGradleCacheReuse $root $preflight
    $readiness = Invoke-M1BReadiness $root 'lifecycle-readiness' $RunId $ReviewedObjectSha256
    [void](Assert-M1BExecutionState $root 'd-lifecycle-post-readiness')
    $revalidatedPreflight = Read-M1BPreflightManifest $root $RunId $ReviewedObjectSha256 $PreflightAuthorizationRecordId $initial.Baseline
    if ($preflight.Sha256 -cne $revalidatedPreflight.Sha256 -or $preflight.Value.runtimeSha256 -cne $readiness.Result.RuntimeSha256 -or
        $preflight.Value.psql.sha256 -cne $ExpectedPsqlSha256) { Stop-M1BRail 'D_PREFLIGHT_RUNTIME_DIVERGED' }
    $script:DFrontendRuntimeSha256 = Get-M1DFrontendRuntimeSha256
    if ($preflight.Value.frontendRuntimeSha256 -isnot [string] -or $preflight.Value.frontendRuntimeSha256 -cnotmatch '^[0-9a-f]{64}$' -or
        $preflight.Value.frontendRuntimeSha256 -cne $script:DFrontendRuntimeSha256) { Stop-M1BRail 'D_FRONTEND_PREFLIGHT_RUNTIME_DIVERGED' }
    $cluster = [string]$preflight.Value.observation.clusterSystemIdentifier
    $admin = [long]$preflight.Value.observation.currentRoleOid
    $maintenance = [long]$preflight.Value.observation.maintenanceDatabaseOid
    $provenance = Get-M1BProvenance $RunId $ReviewedObjectSha256 $cluster
    Enter-M1DQuarantine ([ordered]@{
      preflightAuthorizationRecordId = $PreflightAuthorizationRecordId; preflightSha256 = $preflight.Sha256
      psqlSha256 = $ExpectedPsqlSha256; cluster = $cluster; adminRoleOid = $admin; maintenanceDatabaseOid = $maintenance
      provenance = $provenance; runtimeSha256 = $readiness.Result.RuntimeSha256
      integratedManifestSha256 = $script:DIntegratedManifestSha256; frontendRuntimeSha256 = $script:DFrontendRuntimeSha256
      controllerProcessId = $PID; controllerCreationTicks = [string][Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().Ticks
    })
    $runner = $null; $salt = $null; $verifier = $null; $provision = $null; $targeted = $null; $full = $null
    $primaryStop = $null; $cleanupStop = $null; $cleanup = $null
    try {
      Set-M1DDiagnosticOperation 'provision'
      $runner = New-M1BRunnerSecret; $salt = New-M1BRandomSalt
      try { $verifier = New-M1BScramSha256Verifier $runner.PasswordBytes $salt }
      finally { [Array]::Clear($runner.PasswordBytes, 0, $runner.PasswordBytes.Length); $runner.PasswordBytes = $null; [Array]::Clear($salt, 0, $salt.Length); $salt = $null }
      Enter-M1DPhase 'provision'
      Assert-M1BInteractiveConsole
      $provision = Invoke-M1BProvisionPsql (Join-Path $root 'volatile\provision-psql') $verifier $provenance $cluster ([int]$preflight.Value.observation.hbaRuleNumber) $admin $maintenance
      $verifier = $null
      $script:DExpectedPostmasterStart = $provision.PostmasterStartUnixMicros
      [void](Write-M1DReceipt 'provision' ([ordered]@{
        databaseOid = $provision.DatabaseOid; roleOid = $provision.RoleOid; postmasterStartUnixMicros = $provision.PostmasterStartUnixMicros
        cluster = $cluster; provenance = $provenance; adminRoleOid = $admin; maintenanceDatabaseOid = $maintenance
        psqlSha256 = $provision.PsqlSha256; structuredOutputSha256 = $provision.StructuredOutputSha256
      }))
      Set-M1DDiagnosticOperation 'post-provision-state'
      [void](Assert-M1BExecutionState $root 'd-post-provision')
      Invoke-M1DIntegrated $readiness $provision $runner.Password $cluster
      # The destructive Gradle tasks are unreachable until both durable receipts
      # and independent process/port observations establish the stop barrier.
      Set-M1DDiagnosticOperation 'stop-barrier'
      [void](Read-M1DReceipt 'integrated'); [void](Read-M1DReceipt 'stopped')
      Assert-M1DRecordedCessation; Assert-M1DPortsFree
      Enter-M1DPhase 'targeted'
      Set-M1DDiagnosticOperation 'targeted-tests'
      $targeted = Invoke-M1BTestPhase 'targeted' $root $readiness.BuildRoot $readiness.GradleUserHome $runner.Password $readiness.Result.RuntimeSha256 $cluster $provision.DatabaseOid $provision.RoleOid $provision.PostmasterStartUnixMicros
      [void](Assert-M1BExecutionState $root 'd-post-targeted')
      Assert-M1DRecordedCessation; Assert-M1DPortsFree
      Enter-M1DPhase 'full'
      Set-M1DDiagnosticOperation 'full-tests'
      $full = Invoke-M1BTestPhase 'full' $root $readiness.BuildRoot $readiness.GradleUserHome $runner.Password $readiness.Result.RuntimeSha256 $cluster $provision.DatabaseOid $provision.RoleOid $provision.PostmasterStartUnixMicros
      [void](Assert-M1BExecutionState $root 'd-post-full')
    } catch { $primaryStop = Add-M1DFailure $_ }
    finally {
      # Attempt cessation for every owned child even when another fails. Failure
      # is retained and never permits administrative destruction.
      foreach ($role in @($script:DChildren.Keys)) {
        try { Set-M1DDiagnosticOperation 'forced-stop'; Stop-M1DChild $role -Forced -Finalizing }
        catch { $stop = Add-M1DFailure $_; if ($null -eq $cleanupStop) { $cleanupStop = $stop } }
      }
      try {
        Set-M1DDiagnosticOperation 'stop-barrier'
        if ($null -ne $cleanupStop) { Stop-M1BRail 'D_STOP_BARRIER_FAILED' }
        Assert-M1DRecordedCessation; Assert-M1DPortsFree
        if ($null -eq $provision) { Stop-M1BRail 'D_PROVISION_IDENTITY_NOT_PROVEN' }
        Enter-M1DPhase 'cleanup'
        Set-M1DDiagnosticOperation 'cleanup'
        Assert-M1BInteractiveConsole
        $cleanup = Invoke-M1BCleanupPsql (Join-Path $root 'volatile\cleanup-psql') $provenance $RunId $cluster $provision.DatabaseOid $provision.RoleOid $admin $maintenance
        Set-M1DDiagnosticOperation 'cleanup-publication'
        [void](Write-M1DReceipt 'cleanup' ([ordered]@{ targetsAbsent = $true; psqlSha256 = $cleanup.PsqlSha256; structuredOutputSha256 = $cleanup.StructuredOutputSha256 }))
        Exit-M1DQuarantine 'cleanup'
      } catch { $stop = Add-M1DFailure $_; if ($null -eq $cleanupStop) { $cleanupStop = $stop } }
      if ($null -ne $runner) {
        try { Set-M1DDiagnosticOperation 'secret-scan'; Assert-M1BRunnerSecretAbsentFromTree $root $runner.Password }
        catch { $stop = Add-M1DFailure $_; if ($null -eq $primaryStop) { $primaryStop = $stop } }
        if ($null -ne $runner.PasswordBytes) { [Array]::Clear($runner.PasswordBytes, 0, $runner.PasswordBytes.Length) }
        $runner.Password = $null; $runner.PasswordBytes = $null
      }
      if ($null -ne $salt) { [Array]::Clear($salt, 0, $salt.Length) }
      $verifier = $null
    }
    try {
      Set-M1DDiagnosticOperation 'terminal-controls'
      Enter-M1DPhase 'controls'
      [void](Assert-M1BExecutionState $root 'd-terminal-state')
      if ($script:DFailures.Count -eq 0 -and ($script:PsqlProcessStarts.Preflight -ne 0 -or $script:PsqlProcessStarts.Provision -ne 1 -or $script:PsqlProcessStarts.Cleanup -ne 1)) { Stop-M1BRail 'D_PSQL_CARDINALITY_INVALID' }
    } catch { $stop = Add-M1DFailure $_; if ($null -eq $primaryStop) { $primaryStop = $stop } }
    $success = $script:DFailures.Count -eq 0 -and $null -eq $script:DCookieDiagnostic -and $null -eq $script:DBrowserDiagnostic -and $null -eq $script:DHarnessDiagnostic -and $null -eq $primaryStop -and $null -eq $cleanupStop -and $null -ne $targeted -and $null -ne $full -and $null -ne $cleanup
    try {
      Set-M1DDiagnosticOperation 'terminal-publication'
      $terminalPath = Write-M1DReceipt 'terminal' (Get-M1DTerminalPayload -Success $success -PrimaryStop $primaryStop -CleanupStop $cleanupStop -Targeted $targeted -Full $full -Cleanup $cleanup)
      Assert-M1DDeadline
      $terminalResult = [pscustomobject]@{ Path = $terminalPath; SizeBytes = (Get-Item -LiteralPath $terminalPath).Length; Sha256 = Get-M1BSha256File $terminalPath }
    } catch {
      [void](Add-M1DFailure $_)
      [Console]::Out.WriteLine('M1D_LIFECYCLE_DIAGNOSTIC ' + (ConvertTo-Json (Get-M1DDiagnostics) -Depth 5 -Compress))
      Stop-M1BRail 'D_TERMINAL_PUBLICATION_FAILED'
    }
    if (-not $success) { [Console]::Out.WriteLine('M1D_LIFECYCLE_DIAGNOSTIC ' + (ConvertTo-Json (Get-M1DDiagnostics) -Depth 5 -Compress)) }
    if (-not $success) { Stop-M1BRail 'D_LIFECYCLE_FAILED_SEE_RECEIPTS' }
  } finally {
    $script:DReadinessCacheVerifiedState = $null
    try { Set-M1DDiagnosticOperation 'lock-release'; Exit-M1BRunLock $lock }
    catch {
      [void](Add-M1DFailure $_)
      [Console]::Out.WriteLine('M1D_LIFECYCLE_DIAGNOSTIC ' + (ConvertTo-Json (Get-M1DDiagnostics) -Depth 5 -Compress))
      Stop-M1BRail 'D_LOCK_RELEASE_FAILED'
    }
  }
  [Console]::Out.WriteLine('M1D_LIFECYCLE_RESULT ' + $RunId + ' PASS')
  return $terminalResult
}

function Invoke-M1DCleanupOnly {
  param([AllowNull()][object]$RecoveryOrigin)
  $root = Assert-M1BInvocation
  $script:DRunRoot = $root
  Start-M1DClock 'CleanupOnly'
  $lock = Enter-M1BRunLock $root
  $firstFailure = $null
  $result = $null
  # Local to this orchestration; transported through the unchanged CleanupPsql.
  $M1DRecoveryReceiptContext = $null
  try {
    [void](Assert-M1BExecutionState $root 'd-cleanup-only-initial')
    if ($null -ne $RecoveryOrigin) {
      $M1DRecoveryReceiptContext = [pscustomobject]@{ origin = $RecoveryOrigin; campaignAuthorization = $null; preflightAuthorization = $null }
      Assert-M1DRecoveryReceiptContext $M1DRecoveryReceiptContext
      Assert-M1DNoRecoveryReceipts
    }
    $campaignReceipt = Assert-M1DQuarantineBinding -ReceiptContext $M1DRecoveryReceiptContext
    if ($null -ne $M1DRecoveryReceiptContext) {
      $M1DRecoveryReceiptContext.campaignAuthorization = $campaignReceipt.authorizationRecordId
      $M1DRecoveryReceiptContext.preflightAuthorization = $campaignReceipt.payload.preflightAuthorizationRecordId
      if ($SensitiveAuthorizationRecordId -ceq $M1DRecoveryReceiptContext.preflightAuthorization) { Stop-M1BRail 'D_NEW_CLEANUP_AUTHORIZATION_REQUIRED' }
    }
    $oldController = Get-Process -Id ([int]$campaignReceipt.payload.controllerProcessId) -ErrorAction SilentlyContinue
    if ($null -ne $oldController) {
      try {
        if ($oldController.StartTime.ToUniversalTime().Ticks -eq [long]$campaignReceipt.payload.controllerCreationTicks) { Stop-M1BRail 'D_ORIGINAL_CONTROLLER_STILL_ALIVE' }
      } finally { $oldController.Dispose() }
    }
    if ($campaignReceipt.authorizationRecordId -ceq $SensitiveAuthorizationRecordId -or $PreflightAuthorizationRecordId -cne $campaignReceipt.payload.preflightAuthorizationRecordId) { Stop-M1BRail 'D_NEW_CLEANUP_AUTHORIZATION_REQUIRED' }
    if ($campaignReceipt.payload.psqlSha256 -cne $ExpectedPsqlSha256) { Stop-M1BRail 'D_RECOVERY_PSQL_DIVERGED' }
    $provision = (Read-M1DReceipt 'provision' -ReceiptContext $M1DRecoveryReceiptContext).payload
    Assert-M1BExactProperties $provision @('databaseOid','roleOid','postmasterStartUnixMicros','cluster','provenance','adminRoleOid','maintenanceDatabaseOid','psqlSha256','structuredOutputSha256')
    if (-not (Test-M1BJsonInteger $provision.databaseOid) -or $provision.databaseOid -le 0 -or
        -not (Test-M1BJsonInteger $provision.roleOid) -or $provision.roleOid -le 0 -or
        -not (Test-M1BPostmasterStartUnixMicros $provision.postmasterStartUnixMicros) -or
        $provision.cluster -cne $campaignReceipt.payload.cluster -or $provision.provenance -cne $campaignReceipt.payload.provenance -or
        $provision.psqlSha256 -cne $ExpectedPsqlSha256 -or $provision.adminRoleOid -ne $campaignReceipt.payload.adminRoleOid -or
        $provision.maintenanceDatabaseOid -ne $campaignReceipt.payload.maintenanceDatabaseOid) { Stop-M1BRail 'D_RECOVERY_PROVISION_BINDING_INVALID' }
    Assert-M1DRecordedCessation -ReceiptContext $M1DRecoveryReceiptContext; Assert-M1DPortsFree
    $script:DExpectedPostmasterStart = $provision.postmasterStartUnixMicros
    Enter-M1DPhase 'cleanup'
    Assert-M1BInteractiveConsole
    $cleanup = Invoke-M1BCleanupPsql (Join-Path $root 'volatile\recovery-cleanup-psql') $provision.provenance $RunId $provision.cluster $provision.databaseOid $provision.roleOid $provision.adminRoleOid $provision.maintenanceDatabaseOid
    [void](Write-M1DReceipt 'recovery-cleanup' ([ordered]@{ targetsAbsent = $true; psqlSha256 = $cleanup.PsqlSha256; structuredOutputSha256 = $cleanup.StructuredOutputSha256 }) -ReceiptContext $M1DRecoveryReceiptContext)
    Exit-M1DQuarantine 'recovery-cleanup' -ReceiptContext $M1DRecoveryReceiptContext
    Enter-M1DPhase 'controls'
    [void](Assert-M1BExecutionState $root 'd-cleanup-only-final')
    $path = Write-M1DReceipt 'recovery-terminal' ([ordered]@{ campaignResult = 'FAIL'; cleanupResult = 'PASS'; originalAuthorization = $campaignReceipt.authorizationRecordId }) -ReceiptContext $M1DRecoveryReceiptContext
    Assert-M1DDeadline
    $result = [pscustomobject]@{ Path = $path; SizeBytes = (Get-Item -LiteralPath $path).Length; Sha256 = Get-M1BSha256File $path }
  } catch {
    $firstFailure = $_
    try { [void](Add-M1DFailure $_) } catch { }
  } finally {
    try { Set-M1DDiagnosticOperation 'lock-release'; Exit-M1BRunLock $lock }
    catch { if ($null -eq $firstFailure) { $firstFailure = $_ }; try { [void](Add-M1DFailure $_) } catch { } }
  }
  if ($null -ne $firstFailure) {
    try { [Console]::WriteLine('M1D_LIFECYCLE_DIAGNOSTIC ' + (ConvertTo-Json (Get-M1DDiagnostics) -Depth 8 -Compress)) }
    catch { try { [void](Add-M1DFailure $_) } catch { } }
    throw $firstFailure
  }
  return $result
}

function Invoke-M12Lifecycle {
  if ($Campaign -cne 'M12') { Stop-M1BRail 'M12_CAMPAIGN_REQUIRED' }
  $root = Assert-M1BInvocation
  if (-not [IO.Directory]::Exists($root)) { Stop-M1BRail 'LIFECYCLE_RUN_ROOT_MISSING' }
  $script:DRunRoot = $root
  Start-M1DClock 'Lifecycle'
  $lock = Enter-M1BRunLock $root
  try {
    Assert-M1DNoQuarantine
    $initial = Assert-M1BExecutionState $root 'm12-lifecycle-initial'
    $preflight = Read-M1BPreflightManifest $root $RunId $ReviewedObjectSha256 $PreflightAuthorizationRecordId $initial.Baseline
    if ($preflight.Value.campaignStartTimestamp -isnot [string] -or $preflight.Value.campaignStartTimestamp -cnotmatch '^[1-9][0-9]{1,18}$' -or
        $preflight.Value.stopwatchFrequency -isnot [string] -or $preflight.Value.stopwatchFrequency -cne [string][Diagnostics.Stopwatch]::Frequency -or
        $preflight.Value.machine -isnot [string] -or $preflight.Value.machine -cne [Environment]::MachineName -or
        $preflight.Value.namespaceIdentity -isnot [string] -or $preflight.Value.namespaceIdentity -cne (Get-M1DNamespaceIdentity)) { Stop-M1BRail 'M12_CAMPAIGN_CLOCK_BINDING_INVALID' }
    $elapsed = ([Diagnostics.Stopwatch]::GetTimestamp() - [long]$preflight.Value.campaignStartTimestamp) * 1000.0 / [Diagnostics.Stopwatch]::Frequency
    if ($elapsed -lt 0 -or $elapsed -ge 9000000) { Stop-M1BRail 'M12_CAMPAIGN_DEADLINE_EXPIRED' }
    $script:DTotalMilliseconds = [long][Math]::Min($script:DTotalMilliseconds, 9000000 - $elapsed + $script:DCampaignClock.ElapsedMilliseconds)
    Enter-M1DPhase 'readiness'
    Initialize-M1DGradleCacheReuse $root $preflight
    $readiness = Invoke-M1BReadiness $root 'lifecycle-readiness' $RunId $ReviewedObjectSha256
    [void](Assert-M1BExecutionState $root 'm12-lifecycle-post-readiness')
    $revalidated = Read-M1BPreflightManifest $root $RunId $ReviewedObjectSha256 $PreflightAuthorizationRecordId $initial.Baseline
    if ($preflight.Sha256 -cne $revalidated.Sha256 -or $preflight.Value.runtimeSha256 -cne $readiness.Result.RuntimeSha256 -or
        $preflight.Value.psql.sha256 -cne $ExpectedPsqlSha256) { Stop-M1BRail 'M12_PREFLIGHT_RUNTIME_DIVERGED' }
    # The normalized runtime digest binds both manifests; their absolute build roots differ.
    $preflightRuntime = Join-Path $root 'volatile\preflight-readiness\build\m12-runtime.json'
    Assert-M1BNoReparseAncestors $preflightRuntime
    if ($preflight.Value.m12RuntimeManifestSha256 -isnot [string] -or
        $preflight.Value.m12RuntimeManifestSha256 -cnotmatch '^[0-9a-f]{64}$' -or
        (Get-M1BSha256File $preflightRuntime) -cne $preflight.Value.m12RuntimeManifestSha256) { Stop-M1BRail 'M12_PREFLIGHT_MANIFEST_DIVERGED' }
    $cluster = [string]$preflight.Value.observation.clusterSystemIdentifier
    $admin = [long]$preflight.Value.observation.currentRoleOid
    $maintenance = [long]$preflight.Value.observation.maintenanceDatabaseOid
    $provenance = Get-M1BProvenance $RunId $ReviewedObjectSha256 $cluster
    Enter-M1DQuarantine ([ordered]@{
      preflightAuthorizationRecordId = $PreflightAuthorizationRecordId; preflightSha256 = $preflight.Sha256
      psqlSha256 = $ExpectedPsqlSha256; cluster = $cluster; adminRoleOid = $admin; maintenanceDatabaseOid = $maintenance
      provenance = $provenance; runtimeSha256 = $readiness.Result.RuntimeSha256; m12RuntimeManifestSha256 = $script:M12RuntimeManifestSha256
      controllerProcessId = $PID; controllerCreationTicks = [string][Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().Ticks
    })
    $runner = $null; $salt = $null; $verifier = $null; $provision = $null; $cleanup = $null
    $targeted = $null; $full = $null; $qualification = $null; $primaryStop = $null; $cleanupStop = $null
    try {
      Enter-M1DPhase 'provision'
      Set-M1DDiagnosticOperation 'provision'
      $runner = New-M1BRunnerSecret; $salt = New-M1BRandomSalt
      try { $verifier = New-M1BScramSha256Verifier $runner.PasswordBytes $salt }
      finally { [Array]::Clear($runner.PasswordBytes, 0, $runner.PasswordBytes.Length); $runner.PasswordBytes = $null; [Array]::Clear($salt, 0, $salt.Length); $salt = $null }
      $provision = Invoke-M1BProvisionPsql (Join-Path $root 'volatile\provision-psql') $verifier $provenance $cluster ([int]$preflight.Value.observation.hbaRuleNumber) $admin $maintenance
      $verifier = $null
      $script:DExpectedPostmasterStart = $provision.PostmasterStartUnixMicros
      [void](Write-M1DReceipt 'provision' ([ordered]@{
        databaseOid = $provision.DatabaseOid; roleOid = $provision.RoleOid; postmasterStartUnixMicros = $provision.PostmasterStartUnixMicros
        cluster = $cluster; provenance = $provenance; adminRoleOid = $admin; maintenanceDatabaseOid = $maintenance
        psqlSha256 = $provision.PsqlSha256; structuredOutputSha256 = $provision.StructuredOutputSha256
      }))
      Set-M1DDiagnosticOperation 'post-provision-state'
      [void](Assert-M1BExecutionState $root 'm12-post-provision')
      # Separate Gradle Jobs, no historical context may overlap the M12 pilot/A/B pools.
      foreach ($phase in @('targeted','full','m12-qualification')) {
        Set-M1DDiagnosticOperation 'stop-barrier'
        Assert-M1DRecordedCessation -LifecycleAuthorizationRecordId $SensitiveAuthorizationRecordId
        $clockPhase = if ($phase -ceq 'm12-qualification') { 'qualification' } else { $phase }
        Enter-M1DPhase $clockPhase
        Set-M1DDiagnosticOperation ($clockPhase + '-tests')
        $phaseResult = Invoke-M1BTestPhase $phase $root $readiness.BuildRoot $readiness.GradleUserHome $runner.Password $readiness.Result.RuntimeSha256 $cluster $provision.DatabaseOid $provision.RoleOid $provision.PostmasterStartUnixMicros
        if ($phase -ceq 'targeted') { $targeted = $phaseResult }
        elseif ($phase -ceq 'full') { $full = $phaseResult }
        else { $qualification = $phaseResult }
        [void](Assert-M1BExecutionState $root ('m12-post-' + $phase))
        Assert-M1DRecordedCessation -LifecycleAuthorizationRecordId $SensitiveAuthorizationRecordId
      }
    } catch { $primaryStop = Add-M1DFailure $_ }
    finally {
      try {
        Enter-M1DPhase 'stop'
        Set-M1DDiagnosticOperation 'stop-barrier'
        Assert-M1DRecordedCessation -LifecycleAuthorizationRecordId $SensitiveAuthorizationRecordId
        if ($null -eq $provision) { Stop-M1BRail 'M12_PROVISION_IDENTITY_NOT_PROVEN' }
        $publishedProvision = Read-M1DReceipt 'provision'
        if ($publishedProvision.authorizationRecordId -cne $SensitiveAuthorizationRecordId -or
            $publishedProvision.payload.databaseOid -ne $provision.DatabaseOid -or $publishedProvision.payload.roleOid -ne $provision.RoleOid -or
            $publishedProvision.payload.postmasterStartUnixMicros -cne $provision.PostmasterStartUnixMicros -or
            $publishedProvision.payload.cluster -cne $cluster -or $publishedProvision.payload.provenance -cne $provenance) { Stop-M1BRail 'M12_PROVISION_RECEIPT_DIVERGED' }
        Enter-M1DPhase 'cleanup'
        Set-M1DDiagnosticOperation 'cleanup'
        $cleanup = Invoke-M1BCleanupPsql (Join-Path $root 'volatile\cleanup-psql') $provenance $RunId $cluster $provision.DatabaseOid $provision.RoleOid $admin $maintenance
        Set-M1DDiagnosticOperation 'cleanup-publication'
        [void](Write-M1DReceipt 'cleanup' ([ordered]@{ targetsAbsent = $true; psqlSha256 = $cleanup.PsqlSha256; structuredOutputSha256 = $cleanup.StructuredOutputSha256 }))
        Exit-M1DQuarantine 'cleanup'
      } catch { $cleanupStop = Add-M1DFailure $_ }
      if ($null -ne $runner) {
        try { Set-M1DDiagnosticOperation 'secret-scan'; Assert-M1BRunnerSecretAbsentFromTree $root $runner.Password }
        catch { $stop = Add-M1DFailure $_; if ($null -eq $primaryStop) { $primaryStop = $stop } }
        if ($null -ne $runner.PasswordBytes) { [Array]::Clear($runner.PasswordBytes, 0, $runner.PasswordBytes.Length) }
        $runner.Password = $null; $runner.PasswordBytes = $null
      }
      if ($null -ne $salt) { [Array]::Clear($salt, 0, $salt.Length) }
      $verifier = $null
    }
    try {
      Enter-M1DPhase 'controls'
      Set-M1DDiagnosticOperation 'terminal-controls'
      [void](Assert-M1BExecutionState $root 'm12-terminal-state')
      if ($script:DFailures.Count -eq 0 -and ($script:PsqlProcessStarts.Preflight -ne 0 -or $script:PsqlProcessStarts.Provision -ne 1 -or $script:PsqlProcessStarts.Cleanup -ne 1)) { Stop-M1BRail 'M12_PSQL_CARDINALITY_INVALID' }
    } catch { $stop = Add-M1DFailure $_; if ($null -eq $primaryStop) { $primaryStop = $stop } }
    $success = $script:DFailures.Count -eq 0 -and $null -eq $primaryStop -and $null -eq $cleanupStop -and $null -ne $targeted -and $null -ne $full -and $null -ne $qualification -and $null -ne $cleanup
    Set-M1DDiagnosticOperation 'terminal-publication'
    $path = Write-M1DReceipt 'terminal' ([ordered]@{
      campaignResult = $(if ($success) { 'PASS' } else { 'FAIL' }); cleanupVerified = ($null -ne $cleanup)
      targeted = $targeted; full = $full; qualification = $qualification; cleanup = $cleanup
      primaryStop = $primaryStop; cleanupStop = $cleanupStop; diagnostics = Get-M1DDiagnostics
    })
    Assert-M1DDeadline
    if (-not $success) { Stop-M1BRail 'M12_LIFECYCLE_FAILED_SEE_RECEIPTS' }
    return [pscustomobject]@{ Path = $path; SizeBytes = (Get-Item -LiteralPath $path).Length; Sha256 = Get-M1BSha256File $path }
  } finally {
    $script:DReadinessCacheVerifiedState = $null
    Exit-M1BRunLock $lock
  }
}

function Invoke-M12CleanupOnly {
  if ($Campaign -cne 'M12') { Stop-M1BRail 'M12_CAMPAIGN_REQUIRED' }
  $root = Assert-M1BInvocation
  $script:DRunRoot = $root
  Start-M1DClock 'CleanupOnly'
  $lock = Enter-M1BRunLock $root
  try {
    [void](Assert-M1BExecutionState $root 'm12-cleanup-only-initial')
    Assert-M1DNoRecoveryReceipts
    $campaignReceipt = Assert-M1DQuarantineBinding
    if ($SensitiveAuthorizationRecordId -ceq $campaignReceipt.authorizationRecordId -or
        $SensitiveAuthorizationRecordId -ceq $campaignReceipt.payload.preflightAuthorizationRecordId -or
        $PreflightAuthorizationRecordId -cne $campaignReceipt.payload.preflightAuthorizationRecordId) { Stop-M1BRail 'M12_DISTINCT_CLEANUP_AUTHORIZATION_REQUIRED' }
    if ($campaignReceipt.payload.psqlSha256 -cne $ExpectedPsqlSha256) { Stop-M1BRail 'M12_RECOVERY_PSQL_DIVERGED' }
    $oldController = Get-Process -Id ([int]$campaignReceipt.payload.controllerProcessId) -ErrorAction SilentlyContinue
    if ($null -ne $oldController) {
      try { if ($oldController.StartTime.ToUniversalTime().Ticks -eq [long]$campaignReceipt.payload.controllerCreationTicks) { Stop-M1BRail 'M12_ORIGINAL_CONTROLLER_STILL_ALIVE' } }
      finally { $oldController.Dispose() }
    }
    $provisionReceipt = Read-M1DReceipt 'provision'
    if ($provisionReceipt.authorizationRecordId -cne $campaignReceipt.authorizationRecordId) { Stop-M1BRail 'M12_RECOVERY_PROVISION_AUTHORIZATION_INVALID' }
    $provision = $provisionReceipt.payload
    Assert-M1BExactProperties $provision @('databaseOid','roleOid','postmasterStartUnixMicros','cluster','provenance','adminRoleOid','maintenanceDatabaseOid','psqlSha256','structuredOutputSha256')
    if (-not (Test-M1BJsonInteger $provision.databaseOid) -or $provision.databaseOid -le 0 -or
        -not (Test-M1BJsonInteger $provision.roleOid) -or $provision.roleOid -le 0 -or
        -not (Test-M1BPostmasterStartUnixMicros $provision.postmasterStartUnixMicros) -or
        $provision.cluster -cne $campaignReceipt.payload.cluster -or $provision.provenance -cne $campaignReceipt.payload.provenance -or
        $provision.psqlSha256 -cne $ExpectedPsqlSha256 -or $provision.adminRoleOid -ne $campaignReceipt.payload.adminRoleOid -or
        $provision.maintenanceDatabaseOid -ne $campaignReceipt.payload.maintenanceDatabaseOid -or
        $provision.structuredOutputSha256 -isnot [string] -or $provision.structuredOutputSha256 -cnotmatch '^[0-9a-f]{64}$') { Stop-M1BRail 'M12_RECOVERY_PROVISION_BINDING_INVALID' }
    Enter-M1DPhase 'stop'
    Set-M1DDiagnosticOperation 'stop-barrier'
    Assert-M1DRecordedCessation -LifecycleAuthorizationRecordId $campaignReceipt.authorizationRecordId
    $script:DExpectedPostmasterStart = $provision.postmasterStartUnixMicros
    Enter-M1DPhase 'cleanup'
    Set-M1DDiagnosticOperation 'cleanup'
    $cleanup = Invoke-M1BCleanupPsql (Join-Path $root 'volatile\recovery-cleanup-psql') $provision.provenance $RunId $provision.cluster $provision.databaseOid $provision.roleOid $provision.adminRoleOid $provision.maintenanceDatabaseOid
    [void](Write-M1DReceipt 'recovery-cleanup' ([ordered]@{ targetsAbsent = $true; psqlSha256 = $cleanup.PsqlSha256; structuredOutputSha256 = $cleanup.StructuredOutputSha256 }))
    Exit-M1DQuarantine 'recovery-cleanup'
    Enter-M1DPhase 'controls'
    [void](Assert-M1BExecutionState $root 'm12-cleanup-only-final')
    if ($script:PsqlProcessStarts.Preflight -ne 0 -or $script:PsqlProcessStarts.Provision -ne 0 -or $script:PsqlProcessStarts.Cleanup -ne 1) { Stop-M1BRail 'M12_PSQL_CARDINALITY_INVALID' }
    $path = Write-M1DReceipt 'recovery-terminal' ([ordered]@{ campaignResult = 'FAIL'; cleanupResult = 'PASS'; originalAuthorization = $campaignReceipt.authorizationRecordId })
    Assert-M1DDeadline
    return [pscustomobject]@{ Path = $path; SizeBytes = (Get-Item -LiteralPath $path).Length; Sha256 = Get-M1BSha256File $path }
  } finally { Exit-M1BRunLock $lock }
}

function Invoke-M1BMain {
  if ($Campaign -ceq 'M12' -and $Mode -ceq 'Lifecycle') {
    if ($LifecycleAction -ceq 'CleanupOnly') { return Invoke-M12CleanupOnly }
    return Invoke-M12Lifecycle
  }
  if ($Campaign -ceq 'D' -and $Mode -ceq 'Lifecycle') {
    if ($LifecycleAction -ceq 'CleanupOnly') { return Invoke-M1DCleanupOnly -RecoveryOrigin (Get-M1DFixedRecoveryOrigin) }
    return Invoke-M1DLifecycle
  }
  if ($Mode -ceq 'Preflight') { return Invoke-M1BPreflight }
  if ($Mode -ceq 'Lifecycle') { return Invoke-M1BLifecycle }
  Stop-M1BRail 'MODE_REQUIRED'
}

if ($MyInvocation.InvocationName -cne '.') {
  $outputPrefix = if ($Campaign -ceq 'M12') { 'M12' } else { 'M1' + $Campaign }
  try {
    $result = Invoke-M1BMain
    if ($Campaign -ceq 'M12' -and $LifecycleAction -ceq 'CleanupOnly') {
      Write-Output 'M12_CLEANUP_ONLY_STATUS=PASS;ORIGINAL_CAMPAIGN=FAIL'
    } elseif ($Campaign -ceq 'M12') { Write-Output 'M12_POSTGRES_RAIL_STATUS=PASS' }
    elseif ($Campaign -ceq 'D' -and $LifecycleAction -ceq 'CleanupOnly') {
      Write-Output 'M1D_CLEANUP_ONLY_STATUS=PASS;ORIGINAL_CAMPAIGN=FAIL'
    } elseif ($Campaign -ceq 'D') { Write-Output 'M1D_POSTGRES_RAIL_STATUS=PASS' }
    else { Write-Output 'M1B_POSTGRES_RAIL_STATUS=PASS' }
    Write-Output ($outputPrefix + '_POSTGRES_RAIL_MANIFEST=' + $result.Path)
    Write-Output ($outputPrefix + '_POSTGRES_RAIL_MANIFEST_SIZE_BYTES=' + $result.SizeBytes)
    Write-Output ($outputPrefix + '_POSTGRES_RAIL_MANIFEST_SHA256=' + $result.Sha256)
  } catch {
    Write-Error ($outputPrefix + '_POSTGRES_RAIL_STATUS=FAIL;STOP=' + (Get-M1BStopCode $_))
    exit 1
  }
}
