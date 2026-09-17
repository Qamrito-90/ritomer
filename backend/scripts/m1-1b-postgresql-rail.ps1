[CmdletBinding()]
param(
  [ValidateSet('Preflight', 'Lifecycle')]
  [string]$Mode,

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

  # Scanner-only: validate the canonical spelling before adding an IO namespace.
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

function Assert-M1BNoReparseAncestors {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [switch]$RunnerArtifactScan
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
      $attributes = [System.IO.File]::GetAttributes((ConvertTo-M1BRunnerArtifactIoPath $current))
      if (($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        Stop-M1BRail 'REPARSE_POINT_ANCESTOR_REJECTED'
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

function Get-M1BProvenance {
  param(
    [Parameter(Mandatory = $true)][string]$RunId,
    [Parameter(Mandatory = $true)][string]$ReviewedObjectSha256,
    [Parameter(Mandatory = $true)][string]$ClusterSystemIdentifier
  )

  return 'ritomer-m1-1b:' + $RunId + ':' + $ReviewedObjectSha256 + ':' + $ClusterSystemIdentifier
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
  $parts = [regex]::Match($Provenance, '\Aritomer-m1-1b:([0-9a-f]{32}):([0-9a-f]{64}):([1-9][0-9]{0,19})\z')
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
      Validate(startInfo);

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
        job = CreateJobObjectW(IntPtr.Zero, null);
        if (job == IntPtr.Zero) throw Win32("CREATE_JOB_FAILED");

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
              CREATE_NO_WINDOW,
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

        stdin.Dispose();
        stdin = null;

        bool isInJob;
        if (!IsProcessInJob(processInfo.Process, job, out isInJob) || !isInJob) {
          throw Win32("JOB_BINDING_FAILED");
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
        if (currentProcess != IntPtr.Zero) CloseHandle(currentProcess);
      }
    }

    static void Validate(ProcessStartInfo startInfo) {
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
        !startInfo.CreateNoWindow ||
        !startInfo.RedirectStandardOutput ||
        !startInfo.RedirectStandardError ||
        startInfo.RedirectStandardInput
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
      if ($clock.ElapsedMilliseconds -gt $TimeoutMilliseconds) {
        Stop-M1BRail 'CHILD_PROCESS_TIMEOUT'
      }
      if (
        $TerminateTreeWhenRootExits -and
        -not $treeTerminated -and
        $Process.HasExited
      ) {
        if (-not $Process.TerminateTreeAndWait(30000)) {
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
  $startInfo.Arguments = ($script:PsqlArgumentsExact | ForEach-Object { ConvertTo-M1BProcessArgument ([string]$_) }) -join ' '
  $startInfo.WorkingDirectory = $neutral.Root
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $false
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.StandardOutputEncoding = Get-M1BUtf8
  $startInfo.StandardErrorEncoding = Get-M1BUtf8
  $startInfo.EnvironmentVariables.Clear()
  foreach ($entry in $neutral.Values.GetEnumerator()) {
    $startInfo.EnvironmentVariables[[string]$entry.Key] = [string]$entry.Value
  }

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  $started = $false
  $terminationPassed = $true
  try {
    if (-not $process.Start()) {
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
    $captured = Read-M1BBoundedProcessStreams `
      -Process $process `
      -LimitChars 65536 `
      -TimeoutMilliseconds 300000 `
      -StandardInputText $stdinText
    $stdout = $captured.Stdout
    $stderr = $captured.Stderr
    return [pscustomobject][ordered]@{
      Phase = $Phase
      ProcessId = $processId
      ProcessCount = 1
      ExitCode = [int]$process.ExitCode
      PsqlPath = $binary.Path
      PsqlSha256 = $binary.Sha256
      PsqlFileVersion = $binary.FileVersion
      PsqlProductVersion = $binary.ProductVersion
      Stdout = $stdout
      Stderr = $stderr
      StdoutSha256 = Get-M1BSha256Bytes ((Get-M1BUtf8).GetBytes($stdout))
      StderrSha256 = Get-M1BSha256Bytes ((Get-M1BUtf8).GetBytes($stderr))
    }
  } finally {
    $stdinText = $null
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
    if (-not $terminationPassed) { Stop-M1BRail 'PSQL_PROCESS_TERMINATION_FAILED' }
  }
}

function Invoke-M1BGradleTask {
  param(
    [Parameter(Mandatory = $true)][ValidateSet(
      'm1BPostgresRailReadiness', 'm1BPostgresRailTargeted', 'm1BPostgresRailFull'
    )][string]$Task,
    [Parameter(Mandatory = $true)][string]$NeutralRoot,
    [Parameter(Mandatory = $true)][string]$BuildRoot,
    [Parameter(Mandatory = $true)][string]$GradleUserHome,
    [Parameter(Mandatory = $true)][hashtable]$ExtraEnvironment,
    [AllowNull()][string]$ForbiddenLiteral
  )

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
  try {
    try {
      $process = [Ritomer.M1B.ContainedProcess]::Start($startInfo)
    } catch {
      Stop-M1BRail 'GRADLE_CONTAINED_CHILD_START_FAILED'
    }
    $started = $true
    $taskTimeoutMilliseconds = if (
      $Task -ceq 'm1BPostgresRailReadiness'
    ) {
      1800000
    } else {
      1200000
    }
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
    return [pscustomobject][ordered]@{
      Task = $Task
      ExitCode = [int]$process.ExitCode
      OutputSha256 = Get-M1BSha256Bytes ((Get-M1BUtf8).GetBytes($combined))
      RuntimeSha256 = $runtimeSha256
    }
  } finally {
    if ($started) {
      try {
        if (-not $process.TerminateTreeAndWait(30000)) {
          $treeTerminationPassed = $false
        }
      } catch {
        $treeTerminationPassed = $false
      }
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

function Invoke-M1BReadiness {
  param(
    [Parameter(Mandatory = $true)][string]$RunRoot,
    [Parameter(Mandatory = $true)][string]$PhaseName,
    [Parameter(Mandatory = $true)][string]$RunId,
    [Parameter(Mandatory = $true)][string]$ReviewedObjectSha256
  )

  $phaseRoot = New-M1BDirectory (Join-Path $RunRoot ('volatile\' + $PhaseName))
  $buildRoot = New-M1BDirectory (Join-Path $phaseRoot 'build')
  $gradleHome = New-M1BDirectory (Join-Path $phaseRoot 'gradle-home')
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
  if (-not [string]::Equals($script:RepoRoot, 'C:\dev\ritomer', [System.StringComparison]::OrdinalIgnoreCase)) {
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
    $stream = [System.IO.File]::Open(
      $lockPath,
      [System.IO.FileMode]::CreateNew,
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
  [System.IO.File]::Delete([string]$Lock.Path)
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
  Assert-M1BExactProperties $manifest @(
    'schemaVersion', 'kind', 'verdict', 'createdAtUtc', 'runId', 'reviewedObjectSha256',
    'reviewedDiffSizeBytes', 'sensitiveAuthorizationRecordId', 'branch', 'head',
    'correctiveFileSet', 'compositeFileSet', 'readinessOutputSha256', 'runtimeSha256', 'psql', 'process',
    'observation', 'structuredOutputSha256', 'payloadSha256'
  )
  if (
    -not (Test-M1BJsonInteger $manifest.schemaVersion) -or [int]$manifest.schemaVersion -ne 1 -or
    $manifest.kind -isnot [string] -or
    [string]$manifest.kind -cne 'M1B_POSTGRES_PREFLIGHT' -or
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
    [Parameter(Mandatory = $true)][ValidateSet('targeted', 'full')][string]$Phase,
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

  if (-not (Test-M1BPostmasterStartUnixMicros $PostmasterStartUnixMicros)) {
    Stop-M1BRail 'POSTMASTER_START_UNIX_MICROS_INVALID'
  }
  $phaseRoot = New-M1BDirectory (Join-Path $Root ('volatile\' + $Phase))
  $storageRoot = New-M1BDirectory (Join-Path $phaseRoot 'local-fs')
  $task = if ($Phase -ceq 'targeted') { 'm1BPostgresRailTargeted' } else { 'm1BPostgresRailFull' }
  try {
    return Invoke-M1BGradleTask `
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
        'RITOMER_DB_TEST_APPLICATION_NAME' = ('ritomer-m1-1b-' + $RunId + '-' + $Phase)
      }
  } finally {
    Assert-M1BRunnerSecretAbsentFromTree $Root $RunnerPassword
  }
}

function Invoke-M1BPreflight {
  $root = Assert-M1BInvocation
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
    [void](Assert-M1BExecutionState $root 'preflight-post-readiness')
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
      kind = 'M1B_POSTGRES_PREFLIGHT'
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

function Invoke-M1BMain {
  if ($Mode -ceq 'Preflight') { return Invoke-M1BPreflight }
  if ($Mode -ceq 'Lifecycle') { return Invoke-M1BLifecycle }
  Stop-M1BRail 'MODE_REQUIRED'
}

if ($MyInvocation.InvocationName -cne '.') {
  try {
    $result = Invoke-M1BMain
    Write-Output 'M1B_POSTGRES_RAIL_STATUS=PASS'
    Write-Output ('M1B_POSTGRES_RAIL_MANIFEST=' + $result.Path)
    Write-Output ('M1B_POSTGRES_RAIL_MANIFEST_SIZE_BYTES=' + $result.SizeBytes)
    Write-Output ('M1B_POSTGRES_RAIL_MANIFEST_SHA256=' + $result.Sha256)
  } catch {
    Write-Error ('M1B_POSTGRES_RAIL_STATUS=FAIL;STOP=' + (Get-M1BStopCode $_))
    exit 1
  }
}
