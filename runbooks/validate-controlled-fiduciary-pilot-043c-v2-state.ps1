Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$script:RawCliTokens = @($args)

# P0 validator contract. This file is deliberately read-only. At P0, every
# external mode fails at the durable gate before LocalApplicationData, JSON,
# storage, Git subprocesses, PostgreSQL, credentials, or secrets are touched.
$script:ProtocolId = '043c-internal-rehearsal-v2'
$script:LedgerId = '043c-recovery-ledger-v2'
$script:P0DurableState = '043C_V2_IMPLEMENTED_PENDING_P0_DELIVERY'
$script:Hex64Pattern = '^[0-9a-f]{64}$'
$script:UtcPattern = '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
$script:MaximumArtifactBytes = 65536
$script:R1ResourceTargetSha256 = '318de7101897fd534aa91fed72243fbfb29e78ac5951c57dccf09251b4d7b3b8'
$script:R2ResourceTargetSha256 = 'dfc660e524eb9d91f7ee8f6e4d9273cac36c1c92d3595e285ba0afda8f78e2ef'
$script:AllowedModes = @(
  'SelfTest', 'Qualification', 'PreparationPreflight', 'PreR1',
  'ValidateR1Evidence', 'PostR1Cleanup', 'PreR2',
  'ValidateR2Evidence', 'PostR2Cleanup'
)
$script:QualificationIds = @('Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7')
$script:ExternalModeOrder = @(
  'Qualification', 'PreparationPreflight', 'PreR1', 'ValidateR1Evidence',
  'PostR1Cleanup', 'PreR2', 'ValidateR2Evidence', 'PostR2Cleanup'
)

$script:AuthorizationKeys = @(
  'schemaVersion',
  'run',
  'decision',
  'authorizedAtUtc',
  'authorityRef',
  'protocolId',
  'protocolSha256',
  'frozenCommit',
  'qualificationSha256',
  'resourceTargetSha256'
)

$script:ActiveStateKeys = @(
  'schemaVersion',
  'state',
  'run',
  'recordedAtUtc',
  'authorityRef',
  'protocolId',
  'protocolSha256',
  'frozenCommit',
  'qualificationSha256',
  'resourceTargetSha256'
)

$script:AuthorizationFlagKeys = @(
  'v1ExecutionAuthorized',
  'v2ExecutionAuthorized',
  'r1Authorized',
  'r2Authorized',
  'externalUseAuthorized',
  'realDataAuthorized',
  'productionAuthorized'
)

$script:LedgerRecordKeys = @(
  'schemaVersion', 'ledgerId', 'sequence', 'decisionId', 'state',
  'previousState', 'previousRecordSha256', 'recordedAtUtc',
  'authorityOccurredAtUtc', 'recordedByRole', 'authorityType', 'authorityRef',
  'incidentId', 'incidentSha256', 'protocolId', 'protocolSha256',
  'qualificationSha256', 'frozenCommit', 'completedRun', 'evidenceSha256',
  'cpoOutcome', 'reviewRefs', 'authorizations'
)

$script:LedgerDecisionIds = @('D0','D1','D2','D3','D4','D5','D6','D7')
$script:LedgerStates = @(
  '043C_V2_PLAN_HARDENED_IMPLEMENTATION_NOT_AUTHORIZED',
  '043C_V2_IMPLEMENTATION_AUTHORIZED_NOT_STARTED',
  '043C_V2_IMPLEMENTED_PENDING_P0_DELIVERY',
  '043C_V2_P0_DELIVERED_PENDING_RECOVERY_SELECTION',
  '043C_V2_RECOVERY_SELECTED_PENDING_CTO_FREEZE',
  '043C_V2_PROTOCOL_FROZEN_READY_FOR_R1_DECISION',
  '043C_V2_R1_CLEANUP_VALIDATED_READY_FOR_R2_DECISION',
  '043C_V2_R2_CLEANUP_VALIDATED_READY_FOR_FINAL_CPO_DECISION'
)
$script:LedgerRoles = @(
  'CPO', 'CPO', 'PREPARATION_OWNER', 'RECOVERY_COORDINATOR_043C', 'CPO',
  'CTO', 'COORDINATOR_043C', 'COORDINATOR_043C'
)
$script:LedgerAuthorityTypes = @(
  'CPO_PLAN_HARDENING_DECISION', 'CPO_IMPLEMENTATION_AUTHORIZATION',
  'P0_IMPLEMENTATION_EVIDENCE', 'P0_POST_MERGE_EVIDENCE',
  'CPO_RECOVERY_SELECTION_DECISION', 'CTO_FREEZE_GATE_D5',
  'R1_CLEANUP_EVIDENCE', 'R2_CLEANUP_EVIDENCE'
)
$script:LedgerAuthorityRefs = @(
  '043c-v2-d0-plan-hardening-decision',
  '043c-v2-d1-implementation-authorization',
  '043c-v2-d2-implementation-evidence',
  '043c-v2-d3-p0-post-merge-evidence',
  '043c-v2-d4-recovery-selection-decision',
  '043c-v2-d5-cto-freeze-gate',
  '043c-v2-d6-r1-cleanup-evidence',
  '043c-v2-d7-r2-cleanup-evidence'
)

$script:RuntimeArtifactRelativePaths = [ordered]@{
  Authorization = 'authorization.json'
  ActiveState = 'state\active-state.json'
  EvidenceR1 = 'runs\R1\evidence-summary.json'
  EvidenceR2 = 'runs\R2\evidence-summary.json'
}

$script:EvidenceKeys = @(
  'schemaVersion',
  'run',
  'outcome',
  'lastCompletedTask',
  'abortReasonCode',
  'runStartedAtUtc',
  'runEndedAtUtc',
  'protocolId',
  'protocolSha256',
  'frozenCommit',
  'resourceTargetSha256',
  'expectedBusinessEventCount',
  'missingExpectedBusinessEventCount',
  'unexpectedBusinessEventCount',
  'auditProjectionSha256',
  'businessStateSha256',
  'evidenceContentSha256',
  'qualificationSha256'
)

$script:EvidenceDescriptorKeys = @(
  'schemaVersion', 'run', 'outcome', 'lastCompletedTask', 'abortReasonCode',
  'runStartedAtUtc', 'runEndedAtUtc', 'protocolId', 'protocolSha256',
  'frozenCommit', 'resourceTargetSha256', 'expectedBusinessEventCount',
  'missingExpectedBusinessEventCount', 'unexpectedBusinessEventCount',
  'auditProjectionSha256', 'businessStateSha256', 'qualificationSha256'
)

$script:AuditProjectionKeys = @(
  'schemaVersion', 'run', 'outcome', 'lastCompletedTask', 'runStartedAtUtc',
  'runEndedAtUtc', 'tenantId', 'accountantUserId', 'reviewerUserId', 'slots',
  'expectedBusinessEventCount', 'missingExpectedBusinessEventCount',
  'unexpectedBusinessEventCount'
)

$script:AuditSlotKeys = @(
  'slot', 'action', 'resourceType', 'accountCode', 'targetCode', 'matchStatus',
  'resourceId', 'occurredAtUtc', 'actorUserId', 'actorSubjectSha256',
  'actorRole', 'requestIdSha256', 'metadataSha256'
)

$script:BusinessProjectionKeys = @(
  'schemaVersion', 'run', 'outcome', 'lastCompletedTask', 'tenantId',
  'accountantUserId', 'reviewerUserId', 'closingFolder', 'balanceImport',
  'mappings', 'workpaper', 'document', 'exportPack', 'minimalAnnexVerified',
  'usefulnessAssessmentCompleted'
)

$script:ClosingFolderProjectionKeys = @(
  'id', 'name', 'periodStartOn', 'periodEndOn', 'externalRef', 'status'
)
$script:BalanceImportProjectionKeys = @(
  'id', 'closingFolderId', 'version', 'fileName', 'rowCount', 'totalDebit',
  'totalCredit'
)
$script:MappingProjectionKeys = @(
  'id', 'closingFolderId', 'accountCode', 'targetCode', 'createdByUserId',
  'updatedByUserId'
)
$script:WorkpaperProjectionKeys = @(
  'id', 'closingFolderId', 'anchorCode', 'noteText', 'status', 'reviewComment',
  'basisImportVersion', 'basisTaxonomyVersion', 'evidenceCount',
  'reviewedAtUtc', 'reviewedByUserId'
)
$script:DocumentProjectionKeys = @(
  'id', 'workpaperId', 'anchorCode', 'fileName', 'mediaType', 'byteSize',
  'checksumSha256', 'sourceLabel', 'documentDate', 'storageBackend',
  'verificationStatus', 'reviewComment', 'reviewedAtUtc', 'reviewedByUserId'
)
$script:ExportPackProjectionKeys = @(
  'id', 'closingFolderId', 'idempotencyKeySha256', 'storageObjectKeySha256',
  'sourceFingerprint', 'storageBackend', 'fileName', 'mediaType', 'byteSize',
  'checksumSha256', 'basisImportVersion', 'basisTaxonomyVersion',
  'createdAtUtc', 'createdByUserId'
)
$script:CleanupResourceKeys = @(
  'run', 'databaseName', 'databaseState', 'roleName', 'roleState',
  'storageRelativePath', 'storageState'
)
$script:DbUtcPattern = '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$'
$script:UuidPattern = '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'

$script:QualificationKeys = @(
  'schemaVersion', 'qualificationId', 'ledgerId', 'incidentId',
  'incidentSha256', 'protocolId', 'protocolSha256', 'frozenCommit',
  'reviewRefs', 'qClosed', 'qualifications', 'qualifiedAtUtc',
  'qualifiedByRole'
)

$script:QualificationEntryKeys = @(
  'qId', 'qClosed', 'nominal', 'nominalSha256', 'mutant',
  'mutantSha256', 'errorCode', 'reviewRef'
)

$script:QualificationErrorCodes = @(
  '043C_V2_Q1_FINAL_PATH_MISMATCH',
  '043C_V2_Q2_ARTIFACT_SIZE_EXCEEDED',
  '043C_V2_Q3_PATH_CONFINEMENT_VIOLATION',
  '043C_V2_Q4_CONCURRENT_MUTATION_DETECTED',
  '043C_V2_Q5_CATALOG_READER_PROFILE_INVALID',
  '043C_V2_Q6_APPLICATION_READINESS_NOT_EXACT',
  '043C_V2_Q7_EVIDENCE_HASH_BINDING_INVALID'
)

$script:ErrorCodes = @(
  'E_CLI_MODE', 'E_CLI_QUALIFICATION', 'E_CLI_ARGUMENT',
  'E_GATE_STATE', 'E_GATE_QUALIFICATION', 'E_PROTOCOL_BINDING',
  'E_LEDGER_BINDING', 'E_FROZEN_HISTORY', 'E_GIT_STATE',
  'E_LOCAL_ROOT', 'E_PATH_CONFINEMENT', 'E_PATH_REPARSE', 'E_PATH_TYPE',
  'E_PATH_ABSENCE', 'E_PATH_RACE', 'E_JSON_SIZE', 'E_JSON_ENCODING',
  'E_JSON_CANONICAL', 'E_JSON_SCHEMA', 'E_JSON_BINDING', 'E_STORAGE_STATE',
  'E_PSQL17_UNAVAILABLE', 'E_PSQL17_VERSION', 'E_PSQL_TIMEOUT',
  'E_PSQL_OUTPUT_LIMIT', 'E_PSQL_EXIT', 'E_PG_AUTH_CHANNEL',
  'E_PG_SERVER_IDENTITY', 'E_PG_READER_ROLE', 'E_PG_READER_PRIVILEGES',
  'E_PG_RESOURCE_STATE', 'E_APPLICATION_READINESS', 'E_EVIDENCE_AUDIT',
  'E_EVIDENCE_CONTENT_HASH', 'E_EVIDENCE_FILE_HASH', 'E_R1_PRECONDITION',
  'E_CLEANUP_STATE', 'E_READ_ONLY_POLICY', 'E_INTERNAL'
)

function Get-Sha256Hex {
  param([byte[]] $Bytes)

  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    return (($algorithm.ComputeHash($Bytes) | ForEach-Object {
      $_.ToString('x2')
    }) -join '')
  } finally {
    $algorithm.Dispose()
  }
}

function Test-OrdinalSequence {
  param(
    [string[]] $Actual,
    [string[]] $Expected
  )

  if ($Actual.Count -ne $Expected.Count) { return $false }
  for ($index = 0; $index -lt $Expected.Count; $index += 1) {
    if (-not [string]::Equals(
      $Actual[$index],
      $Expected[$index],
      [System.StringComparison]::Ordinal
    )) { return $false }
  }
  return $true
}

function Test-ContainsOrdinal {
  param([object[]] $Values, [AllowNull()] [object] $Candidate)

  foreach ($value in $Values) {
    if ([object]::Equals($value, $Candidate)) { return $true }
  }
  return $false
}

function Read-ExactCli {
  param([object[]] $Tokens)

  $modeValue = $null
  $qualificationValue = $null
  $modeSeen = $false
  $qualificationSeen = $false
  for ($index = 0; $index -lt $Tokens.Count; $index += 1) {
    $token = $Tokens[$index]
    if ($token -isnot [string]) {
      return [pscustomobject]@{
        Valid = $false; Mode = 'NONE'; QualificationId = $null
        ErrorCode = 'E_CLI_ARGUMENT'
      }
    }
    if ([string] $token -ceq '-Mode') {
      if ($modeSeen -or ($index + 1) -ge $Tokens.Count -or
          $Tokens[$index + 1] -isnot [string]) {
        return [pscustomobject]@{
          Valid = $false; Mode = 'NONE'; QualificationId = $null
          ErrorCode = 'E_CLI_ARGUMENT'
        }
      }
      $modeSeen = $true
      $index += 1
      $modeValue = [string] $Tokens[$index]
      continue
    }
    if ([string] $token -ceq '-QualificationId') {
      if ($qualificationSeen -or ($index + 1) -ge $Tokens.Count -or
          $Tokens[$index + 1] -isnot [string]) {
        return [pscustomobject]@{
          Valid = $false; Mode = 'NONE'; QualificationId = $null
          ErrorCode = 'E_CLI_ARGUMENT'
        }
      }
      $qualificationSeen = $true
      $index += 1
      $qualificationValue = [string] $Tokens[$index]
      continue
    }
    return [pscustomobject]@{
      Valid = $false; Mode = 'NONE'; QualificationId = $null
      ErrorCode = 'E_CLI_ARGUMENT'
    }
  }

  if (-not $modeSeen -or
      -not (Test-ContainsOrdinal $script:AllowedModes $modeValue)) {
    return [pscustomobject]@{
      Valid = $false; Mode = 'NONE'; QualificationId = $null
      ErrorCode = 'E_CLI_MODE'
    }
  }
  if ($modeValue -ceq 'Qualification') {
    if (-not $qualificationSeen -or
        -not (Test-ContainsOrdinal $script:QualificationIds $qualificationValue)) {
      return [pscustomobject]@{
        Valid = $false; Mode = $modeValue; QualificationId = $null
        ErrorCode = 'E_CLI_QUALIFICATION'
      }
    }
  } elseif ($qualificationSeen) {
    return [pscustomobject]@{
      Valid = $false; Mode = $modeValue; QualificationId = $null
      ErrorCode = 'E_CLI_QUALIFICATION'
    }
  }

  return [pscustomobject]@{
    Valid = $true; Mode = $modeValue; QualificationId = $qualificationValue
    ErrorCode = $null
  }
}

function Get-ClosedErrorExitCode {
  param([string] $Code)

  if (Test-ContainsOrdinal @(
    'E_CLI_MODE', 'E_CLI_QUALIFICATION', 'E_CLI_ARGUMENT'
  ) $Code) { return 2 }
  if (Test-ContainsOrdinal @(
    'E_GATE_STATE', 'E_GATE_QUALIFICATION', 'E_PROTOCOL_BINDING',
    'E_LEDGER_BINDING', 'E_FROZEN_HISTORY', 'E_GIT_STATE'
  ) $Code) { return 3 }
  if (Test-ContainsOrdinal @(
    'E_LOCAL_ROOT', 'E_PATH_CONFINEMENT', 'E_PATH_REPARSE', 'E_PATH_TYPE',
    'E_PATH_ABSENCE', 'E_PATH_RACE', 'E_JSON_SIZE', 'E_JSON_ENCODING',
    'E_JSON_CANONICAL', 'E_JSON_SCHEMA', 'E_JSON_BINDING', 'E_STORAGE_STATE',
    'E_READ_ONLY_POLICY'
  ) $Code) { return 4 }
  if (Test-ContainsOrdinal @(
    'E_PSQL17_UNAVAILABLE', 'E_PSQL17_VERSION', 'E_PSQL_TIMEOUT',
    'E_PSQL_OUTPUT_LIMIT', 'E_PSQL_EXIT', 'E_PG_AUTH_CHANNEL',
    'E_PG_SERVER_IDENTITY', 'E_PG_READER_ROLE', 'E_PG_READER_PRIVILEGES',
    'E_PG_RESOURCE_STATE', 'E_APPLICATION_READINESS'
  ) $Code) { return 5 }
  if (Test-ContainsOrdinal @(
    'E_EVIDENCE_AUDIT', 'E_EVIDENCE_CONTENT_HASH', 'E_EVIDENCE_FILE_HASH',
    'E_R1_PRECONDITION', 'E_CLEANUP_STATE'
  ) $Code) { return 6 }
  return 7
}

function New-CoreValidationResult {
  param(
    [string] $SelectedMode,
    [AllowNull()] [string] $ErrorCode
  )

  if ([string]::IsNullOrEmpty($ErrorCode)) {
    return [pscustomobject]@{
      Valid = $true; ErrorCode = 'NONE'; ExitCode = 0; Output = @()
      ExternalIoPerformed = $false; StateWritePerformed = $false
    }
  }
  $closedCode = if (Test-ContainsOrdinal $script:ErrorCodes $ErrorCode) {
    $ErrorCode
  } else {
    'E_INTERNAL'
  }
  return [pscustomobject]@{
    Valid = $false
    ErrorCode = $closedCode
    ExitCode = (Get-ClosedErrorExitCode $closedCode)
    Output = @(Format-FailureOutput -SelectedMode $SelectedMode -Codes @($closedCode))
    ExternalIoPerformed = $false
    StateWritePerformed = $false
  }
}

function Test-CoreSuccessContract {
  param([pscustomobject] $Result)

  return $Result.Valid -eq $true -and $Result.ErrorCode -ceq 'NONE' -and
    $Result.ExitCode -eq 0 -and @($Result.Output).Count -eq 0 -and
    $Result.ExternalIoPerformed -eq $false -and
    $Result.StateWritePerformed -eq $false
}

function Test-CoreFailureContract {
  param(
    [pscustomobject] $Result,
    [string] $ExpectedCode,
    [int] $ExpectedExitCode
  )

  if ($Result.Valid -ne $false -or $Result.ErrorCode -cne $ExpectedCode -or
      $Result.ExitCode -ne $ExpectedExitCode -or
      $Result.ExternalIoPerformed -ne $false -or
      $Result.StateWritePerformed -ne $false -or
      -not (Test-ContainsOrdinal $script:ErrorCodes $Result.ErrorCode)) {
    return $false
  }
  $outputLines = @($Result.Output)
  if ($outputLines.Count -ne 11 -or
      $outputLines[$outputLines.Count - 1] -cne 'verdict=FAIL' -or
      -not (Test-ContainsOrdinal $outputLines ('errorCodes=' + $ExpectedCode))) {
    return $false
  }
  foreach ($line in $outputLines) {
    if ([string] $line -cmatch 'PASS') { return $false }
  }
  return $true
}

function Test-JsonInteger {
  param([AllowNull()] [object] $Value)

  return $Value -is [byte] -or $Value -is [sbyte] -or
    $Value -is [int16] -or $Value -is [uint16] -or
    $Value -is [int32] -or $Value -is [uint32] -or
    $Value -is [int64] -or $Value -is [uint64]
}

function Test-StrictUtc {
  param([AllowNull()] [object] $Value)

  if ($Value -isnot [string] -or $Value -cnotmatch $script:UtcPattern) {
    return $false
  }
  $parsed = [datetimeoffset]::MinValue
  return [datetimeoffset]::TryParseExact(
    [string] $Value,
    "yyyy-MM-dd'T'HH:mm:ss.fff'Z'",
    [System.Globalization.CultureInfo]::InvariantCulture,
    [System.Globalization.DateTimeStyles]::AssumeUniversal,
    [ref] $parsed
  )
}

function Test-StrictDbUtc {
  param([AllowNull()] [object] $Value)

  if ($Value -isnot [string] -or $Value -cnotmatch $script:DbUtcPattern) {
    return $false
  }
  $parsed = [datetimeoffset]::MinValue
  return [datetimeoffset]::TryParseExact(
    [string] $Value,
    "yyyy-MM-dd'T'HH:mm:ss.ffffff'Z'",
    [System.Globalization.CultureInfo]::InvariantCulture,
    [System.Globalization.DateTimeStyles]::AssumeUniversal,
    [ref] $parsed
  )
}

function Test-UuidString {
  param([AllowNull()] [object] $Value)
  return $Value -is [string] -and [string] $Value -cmatch $script:UuidPattern
}

function Test-C043CLexicalForm {
  param([string] $Line)

  if ([string]::IsNullOrEmpty($Line) -or $Line[0] -ne '{' -or
      $Line[$Line.Length - 1] -ne '}') { return $false }
  $inString = $false
  $escaped = $false
  for ($index = 0; $index -lt $Line.Length; $index += 1) {
    $character = $Line[$index]
    if ($inString) {
      if ($escaped) {
        if ($character -ne '"' -and $character -ne '\') { return $false }
        $escaped = $false
      } elseif ($character -eq '\') {
        $escaped = $true
      } elseif ($character -eq '"') {
        $inString = $false
      } elseif ([int] $character -lt 32) {
        return $false
      }
    } else {
      if ($character -eq '"') {
        $inString = $true
      } elseif ([char]::IsWhiteSpace($character)) {
        return $false
      }
    }
  }
  return (-not $inString) -and (-not $escaped)
}

function Test-AllStringsNfc {
  param([AllowNull()] [object] $Value)

  if ($null -eq $Value) { return $true }
  if ($Value -is [string]) {
    return ([string] $Value).IsNormalized([System.Text.NormalizationForm]::FormC)
  }
  if ($Value -is [System.Array]) {
    foreach ($item in $Value) {
      if (-not (Test-AllStringsNfc $item)) { return $false }
    }
    return $true
  }
  if ($Value -is [pscustomobject]) {
    foreach ($property in $Value.PSObject.Properties) {
      if (-not ([string] $property.Name).IsNormalized(
        [System.Text.NormalizationForm]::FormC
      )) { return $false }
      if (-not (Test-AllStringsNfc $property.Value)) { return $false }
    }
  }
  return $true
}

function Test-PathModel {
  param([pscustomobject] $Facts)

  return $Facts.DriveType -ceq 'Fixed' -and
    $Facts.IsAbsoluteWindowsPath -eq $true -and
    $Facts.IsUnc -eq $false -and
    $Facts.IsDevicePath -eq $false -and
    $Facts.IsMappedDrive -eq $false -and
    $Facts.HasReparsePoint -eq $false -and
    $Facts.FinalPathMatches -eq $true -and
    $Facts.ParentChainConfined -eq $true -and
    $Facts.ParentIdentityStable -eq $true -and
    $Facts.FileIdentityStable -eq $true -and
    $Facts.ReadHandleOnly -eq $true
}

function Test-ArtifactSizeAllowed {
  param([long] $Length)
  return $Length -ge 1 -and $Length -le $script:MaximumArtifactBytes
}

function Test-ArtifactEnvelope {
  param(
    [byte[]] $Bytes,
    [string[]] $ExpectedKeys,
    [bool] $IdentityStable,
    [bool] $SizeStable,
    [bool] $FinalPathStable
  )

  if (-not (Test-ArtifactSizeAllowed $Bytes.Length)) { return $false }
  if ($Bytes.Length -lt 3 -or $Bytes[$Bytes.Length - 1] -ne 10) { return $false }
  if ($Bytes[0] -eq 239 -and $Bytes[1] -eq 187 -and $Bytes[2] -eq 191) {
    return $false
  }
  if ($Bytes -contains 13) { return $false }
  if ((-not $IdentityStable) -or (-not $SizeStable) -or (-not $FinalPathStable)) {
    return $false
  }

  $strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
  try {
    $text = $strictUtf8.GetString($Bytes)
  } catch {
    return $false
  }
  if ($text.IndexOf("`n") -ne ($text.Length - 1)) { return $false }
  $line = $text.Substring(0, $text.Length - 1)
  if (-not (Test-C043CLexicalForm $line)) { return $false }
  try {
    $record = $line | ConvertFrom-Json
  } catch {
    return $false
  }
  if ($null -eq $record -or -not (Test-AllStringsNfc $record)) { return $false }
  $actualKeys = @($record.PSObject.Properties.Name)
  if (-not (Test-OrdinalSequence -Actual $actualKeys -Expected $ExpectedKeys)) {
    return $false
  }
  try {
    $canonical = $record | ConvertTo-Json -Compress -Depth 32
  } catch {
    return $false
  }
  return $canonical -ceq $line
}

function Convert-ArtifactRecord {
  param([byte[]] $Bytes)

  $strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
  $text = $strictUtf8.GetString($Bytes)
  return ($text.Substring(0, $text.Length - 1) | ConvertFrom-Json)
}

function Test-HashString {
  param([AllowNull()] [object] $Value)
  return $Value -is [string] -and [string] $Value -cmatch $script:Hex64Pattern
}

function Test-CommonBindings {
  param(
    [pscustomobject] $Record,
    [string] $Run,
    [pscustomobject] $Expected
  )

  if (-not (Test-ContainsOrdinal @('R1', 'R2') $Run) -or
      $Record.run -cne $Run -or $Expected.run -cne $Run) {
    return $false
  }
  $resourceHash = if ($Run -ceq 'R1') {
    $script:R1ResourceTargetSha256
  } else {
    $script:R2ResourceTargetSha256
  }
  return $Record.protocolId -ceq $script:ProtocolId -and
    (Test-HashString $Record.protocolSha256) -and
    ($Record.frozenCommit -is [string]) -and
    ([string] $Record.frozenCommit -cmatch '^[0-9a-f]{40}$') -and
    (Test-HashString $Record.qualificationSha256) -and
    $Record.resourceTargetSha256 -ceq $resourceHash -and
    $Record.protocolId -ceq $Expected.protocolId -and
    $Record.protocolSha256 -ceq $Expected.protocolSha256 -and
    $Record.frozenCommit -ceq $Expected.frozenCommit -and
    $Record.qualificationSha256 -ceq $Expected.qualificationSha256 -and
    $Record.resourceTargetSha256 -ceq $Expected.resourceTargetSha256
}

function Test-AuthorizationSchema {
  param([pscustomobject] $Record, [pscustomobject] $Expected)

  if (-not (Test-JsonInteger $Record.schemaVersion) -or
      $Record.schemaVersion -ne 2 -or
      -not (Test-ContainsOrdinal @('R1', 'R2') $Record.run) -or
      -not (Test-StrictUtc $Record.authorizedAtUtc) -or
      $Record.authorityRef -isnot [string] -or
      [string] $Record.authorityRef -cnotmatch '^043c-v2-[a-z0-9][a-z0-9-]{6,95}$') {
    return $false
  }
  $expectedDecision = if ($Record.run -ceq 'R1') { 'R1_ONLY' } else { 'R2_ONLY' }
  return $Record.decision -ceq $expectedDecision -and
    (Test-CommonBindings $Record ([string] $Record.run) $Expected)
}

function Test-ActiveStateSchema {
  param([pscustomobject] $Record, [pscustomobject] $Authorization)

  $states = @(
    'R1_ONLY_AUTHORIZED_NOT_STARTED', 'R1_STARTED_CLEANUP_NOT_VALIDATED',
    'R2_ONLY_AUTHORIZED_NOT_STARTED', 'R2_STARTED_CLEANUP_NOT_VALIDATED'
  )
  if (-not (Test-JsonInteger $Record.schemaVersion) -or
      $Record.schemaVersion -ne 2 -or
      -not (Test-ContainsOrdinal $states $Record.state) -or
      -not (Test-ContainsOrdinal @('R1', 'R2') $Record.run) -or
      -not (Test-StrictUtc $Record.recordedAtUtc) -or
      $Record.authorityRef -isnot [string]) { return $false }
  if (-not ([string] $Record.state).StartsWith(
    [string] $Record.run,
    [System.StringComparison]::Ordinal
  )) { return $false }
  return $Record.run -ceq $Authorization.run -and
    $Record.authorityRef -ceq $Authorization.authorityRef -and
    [datetimeoffset]::Parse($Record.recordedAtUtc) -ge
      [datetimeoffset]::Parse($Authorization.authorizedAtUtc) -and
    (Test-CommonBindings $Record ([string] $Record.run) $Authorization)
}

function Test-EvidenceSchema {
  param([pscustomobject] $Record, [pscustomobject] $Authorization)

  if (-not (Test-JsonInteger $Record.schemaVersion) -or
      $Record.schemaVersion -ne 2 -or
      $Record.run -cne $Authorization.run -or
      -not (Test-ContainsOrdinal @('COMPLETED', 'ABORTED') $Record.outcome) -or
      -not (Test-StrictUtc $Record.runEndedAtUtc) -or
      -not (Test-JsonInteger $Record.expectedBusinessEventCount) -or
      -not (Test-JsonInteger $Record.missingExpectedBusinessEventCount) -or
      -not (Test-JsonInteger $Record.unexpectedBusinessEventCount) -or
      $Record.expectedBusinessEventCount -ne 15 -or
      $Record.missingExpectedBusinessEventCount -lt 0 -or
      $Record.missingExpectedBusinessEventCount -gt 15 -or
      $Record.unexpectedBusinessEventCount -lt 0 -or
      -not (Test-HashString $Record.auditProjectionSha256) -or
      -not (Test-HashString $Record.businessStateSha256) -or
      -not (Test-HashString $Record.evidenceContentSha256) -or
      -not (Test-CommonBindings $Record ([string] $Record.run) $Authorization)) {
    return $false
  }
  if ($Record.outcome -ceq 'COMPLETED') {
    return $Record.lastCompletedTask -ceq 'T14' -and
      $null -eq $Record.abortReasonCode -and
      (Test-StrictUtc $Record.runStartedAtUtc) -and
      $Record.missingExpectedBusinessEventCount -eq 0 -and
      $Record.unexpectedBusinessEventCount -eq 0 -and
      [datetimeoffset]::Parse($Record.runStartedAtUtc) -le
        [datetimeoffset]::Parse($Record.runEndedAtUtc)
  }
  $abortReasons = @(
    'HARD_STOP', 'OPERATOR_INTERRUPTION', 'ENVIRONMENT_FAILURE',
    'PROTOCOL_DEVIATION', 'EVIDENCE_INCOMPLETE'
  )
  $tasks = @($null, 'T00', 'T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07',
    'T08', 'T09', 'T10', 'T11', 'T12', 'T13')
  if (-not (Test-ContainsOrdinal $abortReasons $Record.abortReasonCode) -or
      -not (Test-ContainsOrdinal $tasks $Record.lastCompletedTask)) { return $false }
  if ($null -eq $Record.runStartedAtUtc) {
    return $null -eq $Record.lastCompletedTask -or $Record.lastCompletedTask -ceq 'T00'
  }
  return Test-StrictUtc $Record.runStartedAtUtc
}

function Test-RuntimeArtifact {
  param(
    [byte[]] $Bytes,
    [ValidateSet('Authorization', 'ActiveState', 'Evidence')]
    [string] $Schema,
    [pscustomobject] $Binding,
    [bool] $IdentityStable,
    [bool] $SizeStable,
    [bool] $FinalPathStable
  )

  $keys = if ($Schema -ceq 'Authorization') {
    $script:AuthorizationKeys
  } elseif ($Schema -ceq 'ActiveState') {
    $script:ActiveStateKeys
  } else {
    $script:EvidenceKeys
  }
  if (-not (Test-ArtifactEnvelope $Bytes $keys $IdentityStable $SizeStable $FinalPathStable)) {
    return $false
  }
  try { $record = Convert-ArtifactRecord $Bytes } catch { return $false }
  if ($Schema -ceq 'Authorization') { return Test-AuthorizationSchema $record $Binding }
  if ($Schema -ceq 'ActiveState') { return Test-ActiveStateSchema $record $Binding }
  return Test-EvidenceSchema $record $Binding
}

function Test-P0AuthorityScope {
  param([pscustomobject] $Context)

  if ($Context.DurableState -cne $script:P0DurableState -or
      $Context.FallbackV1 -ne $false -or
      $Context.LocalApplicationDataAccessed -ne $false -or
      $Context.ExternalIoPerformed -ne $false -or
      $Context.StateWritePerformed -ne $false -or
      $null -eq $Context.Authorizations -or
      -not (Test-OrdinalSequence `
        @($Context.Authorizations.PSObject.Properties.Name) `
        $script:AuthorizationFlagKeys)) {
    return $false
  }
  foreach ($key in $script:AuthorizationFlagKeys) {
    if ($Context.Authorizations.PSObject.Properties[$key].Value -ne $false) {
      return $false
    }
  }
  return $true
}

function Test-ArtifactReadSnapshot {
  param(
    [pscustomobject] $Snapshot,
    [string] $ExpectedRelativePath
  )

  return $Snapshot.RelativePath -ceq $ExpectedRelativePath -and
    $Snapshot.Bytes -is [byte[]] -and
    $Snapshot.BeforeLength -eq $Snapshot.Bytes.Length -and
    $Snapshot.AfterLength -eq $Snapshot.Bytes.Length -and
    $Snapshot.BeforeIdentity -is [string] -and
    -not [string]::IsNullOrWhiteSpace([string] $Snapshot.BeforeIdentity) -and
    $Snapshot.BeforeIdentity -ceq $Snapshot.AfterIdentity -and
    $Snapshot.BeforeFinalPath -is [string] -and
    -not [string]::IsNullOrWhiteSpace([string] $Snapshot.BeforeFinalPath) -and
    $Snapshot.BeforeFinalPath -ceq $Snapshot.AfterFinalPath
}

function Invoke-RuntimeAuthorityBundleValidation {
  param(
    [pscustomobject] $AuthorizationSnapshot,
    [pscustomobject] $ActiveStateSnapshot,
    [pscustomobject] $ExpectedBinding,
    [string] $ExpectedState
  )

  if ($AuthorizationSnapshot.RelativePath -cne
      $script:RuntimeArtifactRelativePaths.Authorization -or
      $ActiveStateSnapshot.RelativePath -cne
      $script:RuntimeArtifactRelativePaths.ActiveState) {
    return New-CoreValidationResult 'PreparationPreflight' 'E_PATH_CONFINEMENT'
  }
  if (-not (Test-ArtifactReadSnapshot $AuthorizationSnapshot `
        $script:RuntimeArtifactRelativePaths.Authorization) -or
      -not (Test-ArtifactReadSnapshot $ActiveStateSnapshot `
        $script:RuntimeArtifactRelativePaths.ActiveState)) {
    return New-CoreValidationResult 'PreparationPreflight' 'E_PATH_RACE'
  }
  if (-not (Test-ArtifactEnvelope $AuthorizationSnapshot.Bytes `
        $script:AuthorizationKeys $true $true $true) -or
      -not (Test-ArtifactEnvelope $ActiveStateSnapshot.Bytes `
        $script:ActiveStateKeys $true $true $true)) {
    return New-CoreValidationResult 'PreparationPreflight' 'E_JSON_CANONICAL'
  }
  try {
    $authorization = Convert-ArtifactRecord $AuthorizationSnapshot.Bytes
    $activeState = Convert-ArtifactRecord $ActiveStateSnapshot.Bytes
  } catch {
    return New-CoreValidationResult 'PreparationPreflight' 'E_JSON_ENCODING'
  }
  if (-not (Test-AuthorizationSchema $authorization $ExpectedBinding) -or
      -not (Test-ActiveStateSchema $activeState $authorization) -or
      $activeState.state -cne $ExpectedState) {
    return New-CoreValidationResult 'PreparationPreflight' 'E_JSON_BINDING'
  }
  return New-CoreValidationResult 'PreparationPreflight' $null
}

function Test-EvidenceHashBinding {
  param(
    [string] $DescriptorLine,
    [string] $ExpectedContentSha256,
    [string] $FullEvidenceLine,
    [string] $ExpectedFileSha256
  )

  $utf8 = New-Object System.Text.UTF8Encoding($false, $true)
  $contentHash = Get-Sha256Hex -Bytes $utf8.GetBytes($DescriptorLine + "`n")
  $fileHash = Get-Sha256Hex -Bytes $utf8.GetBytes($FullEvidenceLine + "`n")
  return $contentHash -ceq $ExpectedContentSha256 -and
    $fileHash -ceq $ExpectedFileSha256
}

function ConvertTo-C043CBytes {
  param([object] $Record)
  $utf8 = New-Object System.Text.UTF8Encoding($false, $true)
  return ,$utf8.GetBytes(($Record | ConvertTo-Json -Compress -Depth 32) + "`n")
}

function Test-ReviewRefsBinding {
  param(
    [pscustomobject] $Actual,
    [pscustomobject] $Expected
  )

  $keys = @(
    'p0ReviewedHead', 'p0ReviewedTree', 'cpoPostCodeReviewRef',
    'aiTechnicalReviewRef', 'aiSecurityPrivacyReviewRef', 'ctoTechnicalGateRef',
    'cpoPreMergeReviewRef', 'p0MergeCommit', 'p0MergeTree'
  )
  if ($null -eq $Actual -or $null -eq $Expected -or
      -not (Test-OrdinalSequence @($Actual.PSObject.Properties.Name) $keys) -or
      -not (Test-OrdinalSequence @($Expected.PSObject.Properties.Name) $keys)) {
    return $false
  }
  foreach ($key in $keys) {
    if ($Actual.PSObject.Properties[$key].Value -cne
        $Expected.PSObject.Properties[$key].Value) { return $false }
  }
  $head = [string] $Actual.p0ReviewedHead
  if ($head -cnotmatch '^[0-9a-f]{40}$' -or
      [string] $Actual.p0ReviewedTree -cnotmatch '^[0-9a-f]{40}$' -or
      [string] $Actual.p0MergeCommit -cnotmatch '^[0-9a-f]{40}$' -or
      [string] $Actual.p0MergeTree -cnotmatch '^[0-9a-f]{40}$' -or
      $Actual.p0MergeCommit -ceq $head -or
      $Actual.p0ReviewedTree -cne $Actual.p0MergeTree) { return $false }
  $expectedRefs = @(
    ('043c-v2-p0-cpo-post-code-review-pass-' + $head),
    ('043c-v2-p0-ai-technical-review-pass-' + $head),
    ('043c-v2-p0-ai-security-privacy-review-pass-' + $head),
    ('043c-v2-p0-cto-technical-gate-pass-' + $head),
    ('043c-v2-p0-cpo-pre-merge-review-pass-' + $head)
  )
  $actualRefs = @(
    $Actual.cpoPostCodeReviewRef, $Actual.aiTechnicalReviewRef,
    $Actual.aiSecurityPrivacyReviewRef, $Actual.ctoTechnicalGateRef,
    $Actual.cpoPreMergeReviewRef
  )
  return Test-OrdinalSequence $actualRefs $expectedRefs
}

function Read-V2LedgerCheckpoints {
  param(
    [byte[]] $LedgerBytes,
    [ValidateSet('D6', 'D7')]
    [string] $ExpectedLastDecisionId
  )

  $invalid = [pscustomobject]@{
    Valid = $false; D5 = $null; D6 = $null; D7 = $null
  }
  if ($null -eq $LedgerBytes -or
      -not (Test-ArtifactSizeAllowed $LedgerBytes.Length) -or
      $LedgerBytes.Length -lt 3 -or
      $LedgerBytes[$LedgerBytes.Length - 1] -ne 10 -or
      ($LedgerBytes[0] -eq 239 -and $LedgerBytes[1] -eq 187 -and
       $LedgerBytes[2] -eq 191) -or
      $LedgerBytes -contains 13) { return $invalid }
  $strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
  try { $text = $strictUtf8.GetString($LedgerBytes) } catch { return $invalid }
  if ($text[0] -ne '{' -or $text[$text.Length - 1] -ne "`n") {
    return $invalid
  }
  $body = $text.Substring(0, $text.Length - 1)
  if ([string]::IsNullOrEmpty($body)) { return $invalid }
  $lines = @($body.Split("`n"))
  $expectedCount = if ($ExpectedLastDecisionId -ceq 'D6') { 7 } else { 8 }
  if ($lines.Count -ne $expectedCount) { return $invalid }
  $records = New-Object 'System.Collections.Generic.List[object]'
  $lineBytes = New-Object 'System.Collections.Generic.List[byte[]]'
  foreach ($line in $lines) {
    if ([string]::IsNullOrEmpty($line)) { return $invalid }
    $bytes = $strictUtf8.GetBytes($line + "`n")
    if (-not (Test-ArtifactEnvelope $bytes $script:LedgerRecordKeys `
          $true $true $true)) { return $invalid }
    try { $record = Convert-ArtifactRecord $bytes } catch { return $invalid }
    $records.Add($record)
    $lineBytes.Add($bytes)
  }

  $incidentId = '043c-v1-pr107-freeze-linearity-incident'
  $incidentHash = '1419edb3f46c1472f7333b0a8970fb3897f5f534693229ce123dc9b53eb9ea8b'
  $protocolHash = $null
  $qualificationHash = $null
  $frozenCommit = $null
  $reviewRefs = $null
  $previousRecordedAt = $null
  for ($index = 0; $index -lt $records.Count; $index += 1) {
    $record = $records[$index]
    if (-not (Test-JsonInteger $record.schemaVersion) -or
        $record.schemaVersion -ne 2 -or
        $record.ledgerId -cne $script:LedgerId -or
        -not (Test-JsonInteger $record.sequence) -or
        $record.sequence -ne $index -or
        $record.decisionId -cne $script:LedgerDecisionIds[$index] -or
        $record.state -cne $script:LedgerStates[$index] -or
        $record.recordedByRole -cne $script:LedgerRoles[$index] -or
        $record.authorityType -cne $script:LedgerAuthorityTypes[$index] -or
        $record.authorityRef -cne $script:LedgerAuthorityRefs[$index] -or
        $record.incidentId -cne $incidentId -or
        $record.incidentSha256 -cne $incidentHash -or
        -not (Test-StrictUtc $record.recordedAtUtc) -or
        -not (Test-StrictUtc $record.authorityOccurredAtUtc) -or
        [datetimeoffset]::Parse($record.authorityOccurredAtUtc) -gt
          [datetimeoffset]::Parse($record.recordedAtUtc) -or
        $null -ne $record.cpoOutcome -or
        $null -eq $record.authorizations -or
        -not (Test-OrdinalSequence `
          @($record.authorizations.PSObject.Properties.Name) `
          $script:AuthorizationFlagKeys)) { return $invalid }
    foreach ($key in $script:AuthorizationFlagKeys) {
      $authorization = $record.authorizations.PSObject.Properties[$key].Value
      if ($authorization -isnot [bool] -or $authorization -ne $false) {
        return $invalid
      }
    }
    $recordedAt = [datetimeoffset]::Parse($record.recordedAtUtc)
    if ($null -ne $previousRecordedAt -and $recordedAt -le $previousRecordedAt) {
      return $invalid
    }
    $previousRecordedAt = $recordedAt
    if ($index -eq 0) {
      if ($null -ne $record.previousState -or
          $null -ne $record.previousRecordSha256) { return $invalid }
    } else {
      if ($record.previousState -cne $records[$index - 1].state -or
          $record.previousRecordSha256 -cne
            (Get-Sha256Hex $lineBytes[$index - 1])) { return $invalid }
    }

    if ($index -lt 2) {
      if ($null -ne $record.protocolId -or $null -ne $record.protocolSha256) {
        return $invalid
      }
    } else {
      if ($record.protocolId -cne $script:ProtocolId -or
          -not (Test-HashString $record.protocolSha256)) { return $invalid }
      if ($index -eq 2) { $protocolHash = $record.protocolSha256 }
      if ($record.protocolSha256 -cne $protocolHash) { return $invalid }
    }
    if ($index -lt 3) {
      if ($null -ne $record.reviewRefs) { return $invalid }
    } else {
      if ($index -eq 3) {
        $reviewRefs = $record.reviewRefs
        if (-not (Test-ReviewRefsBinding $reviewRefs $reviewRefs)) {
          return $invalid
        }
      } elseif (-not (Test-ReviewRefsBinding $record.reviewRefs $reviewRefs)) {
        return $invalid
      }
    }
    if ($index -lt 5) {
      if ($null -ne $record.qualificationSha256 -or
          $null -ne $record.frozenCommit) { return $invalid }
    } else {
      if (-not (Test-HashString $record.qualificationSha256) -or
          $record.frozenCommit -isnot [string] -or
          [string] $record.frozenCommit -cnotmatch '^[0-9a-f]{40}$') {
        return $invalid
      }
      if ($index -eq 5) {
        $qualificationHash = $record.qualificationSha256
        $frozenCommit = $record.frozenCommit
      }
      if ($record.qualificationSha256 -cne $qualificationHash -or
          $record.frozenCommit -cne $frozenCommit) { return $invalid }
    }
    if ($index -lt 6) {
      if ($null -ne $record.completedRun -or
          $null -ne $record.evidenceSha256) { return $invalid }
    } elseif ($index -eq 6) {
      if (-not ($null -eq $record.completedRun -or
            $record.completedRun -ceq 'R1') -or
          -not (Test-HashString $record.evidenceSha256)) { return $invalid }
    } else {
      if ($records[6].completedRun -cne 'R1' -or
          -not (Test-ContainsOrdinal @('R1', 'R2') $record.completedRun) -or
          -not (Test-HashString $record.evidenceSha256)) { return $invalid }
    }
  }
  return [pscustomobject]@{
    Valid = $true
    D5 = $records[5]
    D6 = $records[6]
    D7 = if ($records.Count -eq 8) { $records[7] } else { $null }
  }
}

function Test-QualificationManifest {
  param(
    [byte[]] $Bytes,
    [pscustomobject] $BindingR1,
    [pscustomobject] $BindingR2
  )

  if (-not (Test-ArtifactEnvelope $Bytes $script:QualificationKeys $true $true $true)) {
    return $false
  }
  try { $manifest = Convert-ArtifactRecord $Bytes } catch { return $false }
  if (-not (Test-JsonInteger $manifest.schemaVersion) -or
      $manifest.schemaVersion -ne 2 -or
      $manifest.qualificationId -cne '043c-v2-q1-q7-qualification' -or
      $manifest.ledgerId -cne $script:LedgerId -or
      $manifest.incidentId -cne '043c-v1-pr107-freeze-linearity-incident' -or
      -not (Test-HashString $manifest.incidentSha256) -or
      $manifest.protocolId -cne $script:ProtocolId -or
      $manifest.protocolSha256 -cne $BindingR1.protocolSha256 -or
      $manifest.protocolSha256 -cne $BindingR2.protocolSha256 -or
      $manifest.frozenCommit -isnot [string] -or
      $manifest.frozenCommit -cne $BindingR1.frozenCommit -or
      $manifest.frozenCommit -cne $BindingR2.frozenCommit -or
      $manifest.qClosed -ne $true -or
      -not (Test-StrictUtc $manifest.qualifiedAtUtc) -or
      $manifest.qualifiedByRole -cne 'RECOVERY_COORDINATOR_043C') {
    return $false
  }
  if (-not (Test-ReviewRefsBinding $BindingR1.reviewRefs $BindingR2.reviewRefs) -or
      -not (Test-ReviewRefsBinding $manifest.reviewRefs $BindingR1.reviewRefs)) {
    return $false
  }
  $qualifications = @($manifest.qualifications)
  if ($qualifications.Count -ne 7) { return $false }
  for ($index = 0; $index -lt 7; $index += 1) {
    $entry = $qualifications[$index]
    if (-not (Test-OrdinalSequence @($entry.PSObject.Properties.Name) `
      $script:QualificationEntryKeys) -or
        $entry.qId -cne $script:QualificationIds[$index] -or
        $entry.qClosed -ne $true -or $entry.nominal -cne 'PASS' -or
        $entry.mutant -cne 'REJECTED' -or
        -not (Test-HashString $entry.nominalSha256) -or
        -not (Test-HashString $entry.mutantSha256) -or
        $entry.errorCode -cne $script:QualificationErrorCodes[$index] -or
        $entry.reviewRef -isnot [string] -or
        [string]::IsNullOrWhiteSpace([string] $entry.reviewRef)) { return $false }
  }
  return $true
}

function Test-AuditProjection {
  param(
    [byte[]] $Bytes,
    [pscustomobject] $Evidence
  )

  if (-not (Test-ArtifactEnvelope $Bytes $script:AuditProjectionKeys `
        $true $true $true)) { return $false }
  try { $record = Convert-ArtifactRecord $Bytes } catch { return $false }
  $runStartedValid = if ($null -eq $record.runStartedAtUtc) {
    $null -eq $Evidence.runStartedAtUtc -and
      ($null -eq $record.lastCompletedTask -or
       $record.lastCompletedTask -ceq 'T00')
  } else {
    (Test-StrictDbUtc $record.runStartedAtUtc) -and
      $null -ne $Evidence.runStartedAtUtc -and
      [datetimeoffset]::Parse($record.runStartedAtUtc) -eq
        [datetimeoffset]::Parse($Evidence.runStartedAtUtc)
  }
  if (-not (Test-JsonInteger $record.schemaVersion) -or
      $record.schemaVersion -ne 2 -or $record.run -cne $Evidence.run -or
      $record.outcome -cne $Evidence.outcome -or
      $record.lastCompletedTask -cne $Evidence.lastCompletedTask -or
      -not $runStartedValid -or
      -not (Test-StrictDbUtc $record.runEndedAtUtc) -or
      [datetimeoffset]::Parse($record.runEndedAtUtc) -ne
        [datetimeoffset]::Parse($Evidence.runEndedAtUtc) -or
      -not (Test-UuidString $record.tenantId) -or
      -not (Test-UuidString $record.accountantUserId) -or
      -not (Test-UuidString $record.reviewerUserId) -or
      -not (Test-JsonInteger $record.expectedBusinessEventCount) -or
      -not (Test-JsonInteger $record.missingExpectedBusinessEventCount) -or
      -not (Test-JsonInteger $record.unexpectedBusinessEventCount) -or
      $record.expectedBusinessEventCount -ne
        $Evidence.expectedBusinessEventCount -or
      $record.missingExpectedBusinessEventCount -ne
        $Evidence.missingExpectedBusinessEventCount -or
      $record.unexpectedBusinessEventCount -ne
        $Evidence.unexpectedBusinessEventCount) { return $false }
  $slots = @($record.slots)
  if ($slots.Count -ne 15) { return $false }
  $actions = @(
    'CLOSING_FOLDER.CREATED', 'BALANCE_IMPORT.CREATED',
    'MANUAL_MAPPING.CREATED', 'MANUAL_MAPPING.CREATED',
    'MANUAL_MAPPING.CREATED', 'MANUAL_MAPPING.CREATED',
    'MANUAL_MAPPING.CREATED', 'MANUAL_MAPPING.CREATED',
    'MANUAL_MAPPING.CREATED', 'WORKPAPER.CREATED', 'DOCUMENT.CREATED',
    'WORKPAPER.UPDATED', 'DOCUMENT.VERIFICATION_UPDATED',
    'WORKPAPER.REVIEW_STATUS_CHANGED', 'EXPORT_PACK.CREATED'
  )
  $resources = @(
    'CLOSING_FOLDER', 'BALANCE_IMPORT', 'MANUAL_MAPPING', 'MANUAL_MAPPING',
    'MANUAL_MAPPING', 'MANUAL_MAPPING', 'MANUAL_MAPPING', 'MANUAL_MAPPING',
    'MANUAL_MAPPING', 'WORKPAPER', 'DOCUMENT', 'WORKPAPER', 'DOCUMENT',
    'WORKPAPER', 'EXPORT_PACK'
  )
  $accounts = @('1000','1100','1200','2000','2800','3000','4000')
  $targets = @(
    'BS.ASSET.CASH_AND_EQUIVALENTS', 'BS.ASSET.TRADE_RECEIVABLES',
    'BS.ASSET.PREPAIDS_AND_OTHER_CURRENT', 'BS.LIABILITY.TRADE_PAYABLES',
    'BS.EQUITY.RETAINED_EARNINGS', 'PL.REVENUE.OPERATING_REVENUE',
    'PL.EXPENSE.OTHER_OPERATING_EXPENSES'
  )
  $accountantSubjectHash = $null
  $reviewerSubjectHash = $null
  $missingSlotCount = 0
  for ($index = 0; $index -lt 15; $index += 1) {
    $slot = $slots[$index]
    $mappingIndex = $index - 2
    $expectedAccount = if ($mappingIndex -ge 0 -and $mappingIndex -lt 7) {
      $accounts[$mappingIndex]
    } else { $null }
    $expectedTarget = if ($mappingIndex -ge 0 -and $mappingIndex -lt 7) {
      $targets[$mappingIndex]
    } else { $null }
    $expectedRole = if ($index -eq 12 -or $index -eq 13) {
      'REVIEWER'
    } else { 'ACCOUNTANT' }
    $expectedActor = if ($expectedRole -ceq 'REVIEWER') {
      $record.reviewerUserId
    } else { $record.accountantUserId }
    if (-not (Test-OrdinalSequence @($slot.PSObject.Properties.Name) `
          $script:AuditSlotKeys) -or
        -not (Test-JsonInteger $slot.slot) -or $slot.slot -ne ($index + 1) -or
        $slot.action -cne $actions[$index] -or
        $slot.resourceType -cne $resources[$index] -or
        -not [object]::Equals($slot.accountCode, $expectedAccount) -or
        -not [object]::Equals($slot.targetCode, $expectedTarget)) { return $false }
    if ($slot.matchStatus -ceq 'MISSING') {
      $missingSlotCount += 1
      foreach ($dynamicKey in @(
        'resourceId', 'occurredAtUtc', 'actorUserId', 'actorSubjectSha256',
        'actorRole', 'requestIdSha256', 'metadataSha256'
      )) {
        if ($null -ne $slot.PSObject.Properties[$dynamicKey].Value) {
          return $false
        }
      }
      continue
    }
    if ($slot.matchStatus -cne 'MATCHED' -or
        $null -eq $record.runStartedAtUtc -or
        -not (Test-UuidString $slot.resourceId) -or
        -not (Test-StrictDbUtc $slot.occurredAtUtc) -or
        [datetimeoffset]::Parse($slot.occurredAtUtc) -lt
          [datetimeoffset]::Parse($record.runStartedAtUtc) -or
        [datetimeoffset]::Parse($slot.occurredAtUtc) -ge
          [datetimeoffset]::Parse($record.runEndedAtUtc) -or
        $slot.actorUserId -cne $expectedActor -or
        -not (Test-HashString $slot.actorSubjectSha256) -or
        $slot.actorRole -cne $expectedRole -or
        -not (Test-HashString $slot.requestIdSha256) -or
        -not (Test-HashString $slot.metadataSha256)) { return $false }
    if ($expectedRole -ceq 'REVIEWER') {
      if ($null -eq $reviewerSubjectHash) {
        $reviewerSubjectHash = $slot.actorSubjectSha256
      } elseif ($slot.actorSubjectSha256 -cne $reviewerSubjectHash) {
        return $false
      }
    } else {
      if ($null -eq $accountantSubjectHash) {
        $accountantSubjectHash = $slot.actorSubjectSha256
      } elseif ($slot.actorSubjectSha256 -cne $accountantSubjectHash) {
        return $false
      }
    }
  }
  if ($missingSlotCount -ne $record.missingExpectedBusinessEventCount) {
    return $false
  }
  if ($record.outcome -ceq 'COMPLETED' -and
      ($missingSlotCount -ne 0 -or
       $record.unexpectedBusinessEventCount -ne 0)) { return $false }
  return $true
}

function Test-BusinessProjection {
  param(
    [byte[]] $Bytes,
    [pscustomobject] $Evidence,
    [pscustomobject] $Audit
  )

  if (-not (Test-ArtifactEnvelope $Bytes $script:BusinessProjectionKeys `
        $true $true $true)) { return $false }
  try { $record = Convert-ArtifactRecord $Bytes } catch { return $false }
  if (-not (Test-JsonInteger $record.schemaVersion) -or
      $record.schemaVersion -ne 2 -or $record.run -cne $Evidence.run -or
      $record.outcome -cne $Evidence.outcome -or
      $record.lastCompletedTask -cne $Evidence.lastCompletedTask -or
      $record.tenantId -cne $Audit.tenantId -or
      $record.accountantUserId -cne $Audit.accountantUserId -or
      $record.reviewerUserId -cne $Audit.reviewerUserId -or
      $record.minimalAnnexVerified -isnot [bool] -or
      $record.usefulnessAssessmentCompleted -isnot [bool]) { return $false }
  $mappings = @($record.mappings)
  if ($record.outcome -cne 'COMPLETED') {
    if ($mappings.Count -gt 7) { return $false }
    $closing = $record.closingFolder
    $balance = $record.balanceImport
    $workpaper = $record.workpaper
    $document = $record.document
    $export = $record.exportPack
    if (($null -ne $record.closingFolder -and -not (Test-OrdinalSequence `
          @($record.closingFolder.PSObject.Properties.Name) `
          $script:ClosingFolderProjectionKeys)) -or
        ($null -ne $record.balanceImport -and -not (Test-OrdinalSequence `
          @($record.balanceImport.PSObject.Properties.Name) `
          $script:BalanceImportProjectionKeys)) -or
        ($null -ne $record.workpaper -and -not (Test-OrdinalSequence `
          @($record.workpaper.PSObject.Properties.Name) `
          $script:WorkpaperProjectionKeys)) -or
        ($null -ne $record.document -and -not (Test-OrdinalSequence `
          @($record.document.PSObject.Properties.Name) `
          $script:DocumentProjectionKeys)) -or
        ($null -ne $record.exportPack -and -not (Test-OrdinalSequence `
          @($record.exportPack.PSObject.Properties.Name) `
          $script:ExportPackProjectionKeys))) { return $false }
    $expectedName = if ($record.run -ceq 'R1') {
      'Demo Closing FY2025 043c R1 internal rehearsal (synthetic)'
    } else { 'Demo Closing FY2025 043c R2 internal rehearsal (synthetic)' }
    $expectedRef = if ($record.run -ceq 'R1') {
      'DEMO-043C-R1-INTERNAL-REHEARSAL'
    } else { 'DEMO-043C-R2-INTERNAL-REHEARSAL' }
    $accounts = @('1000','1100','1200','2000','2800','3000','4000')
    $targets = @(
      'BS.ASSET.CASH_AND_EQUIVALENTS', 'BS.ASSET.TRADE_RECEIVABLES',
      'BS.ASSET.PREPAIDS_AND_OTHER_CURRENT', 'BS.LIABILITY.TRADE_PAYABLES',
      'BS.EQUITY.RETAINED_EARNINGS', 'PL.REVENUE.OPERATING_REVENUE',
      'PL.EXPENSE.OTHER_OPERATING_EXPENSES'
    )
    if ($null -eq $closing) {
      if ($null -ne $balance -or $mappings.Count -ne 0 -or
          $null -ne $workpaper -or $null -ne $document -or
          $null -ne $export -or $record.minimalAnnexVerified -ne $false -or
          $record.usefulnessAssessmentCompleted -ne $false) { return $false }
    } elseif (-not (Test-UuidString $closing.id) -or
        $closing.name -cne $expectedName -or
        $closing.periodStartOn -cne '2025-01-01' -or
        $closing.periodEndOn -cne '2025-12-31' -or
        $closing.externalRef -cne $expectedRef -or
        $closing.status -cne 'DRAFT') { return $false }
    if ($null -eq $balance) {
      if ($mappings.Count -ne 0 -or $null -ne $workpaper -or
          $null -ne $document -or $null -ne $export) { return $false }
    } elseif ($null -eq $closing -or -not (Test-UuidString $balance.id) -or
        $balance.closingFolderId -cne $closing.id -or
        -not (Test-JsonInteger $balance.version) -or $balance.version -ne 1 -or
        $balance.fileName -cne 'balance-fy2025-v1.csv' -or
        -not (Test-JsonInteger $balance.rowCount) -or $balance.rowCount -ne 7 -or
        $balance.totalDebit -cne '149000.00' -or
        $balance.totalCredit -cne '149000.00') { return $false }
    $mappingIds = New-Object 'System.Collections.Generic.List[string]'
    for ($index = 0; $index -lt $mappings.Count; $index += 1) {
      $mapping = $mappings[$index]
      if ($null -eq $closing -or $null -eq $balance -or $null -eq $mapping -or
          -not (Test-OrdinalSequence @($mapping.PSObject.Properties.Name) `
            $script:MappingProjectionKeys) -or
          -not (Test-UuidString $mapping.id) -or
          (Test-ContainsOrdinal $mappingIds $mapping.id) -or
          $mapping.closingFolderId -cne $closing.id -or
          $mapping.accountCode -cne $accounts[$index] -or
          $mapping.targetCode -cne $targets[$index] -or
          $mapping.createdByUserId -cne $record.accountantUserId -or
          $mapping.updatedByUserId -cne $record.accountantUserId) { return $false }
      $mappingIds.Add($mapping.id)
    }
    if ($null -eq $workpaper) {
      if ($null -ne $document -or $null -ne $export) { return $false }
    } else {
      if ($null -eq $closing -or $mappings.Count -ne 7 -or
          -not (Test-UuidString $workpaper.id) -or
          $workpaper.closingFolderId -cne $closing.id -or
          $workpaper.anchorCode -cne 'BS.ASSET.CURRENT_SECTION' -or
          $workpaper.noteText -cne 'Synthetic bank reconciliation FY2025.' -or
          -not (Test-ContainsOrdinal @('DRAFT','READY_FOR_REVIEW','REVIEWED') `
            $workpaper.status) -or $null -ne $workpaper.reviewComment -or
          -not (Test-JsonInteger $workpaper.basisImportVersion) -or
          $workpaper.basisImportVersion -ne 1 -or
          -not (Test-JsonInteger $workpaper.basisTaxonomyVersion) -or
          $workpaper.basisTaxonomyVersion -ne 2 -or
          -not (Test-JsonInteger $workpaper.evidenceCount) -or
          $workpaper.evidenceCount -ne 0) { return $false }
      if ($workpaper.status -ceq 'REVIEWED') {
        if ($null -eq $Audit.runStartedAtUtc -or
            -not (Test-StrictDbUtc $workpaper.reviewedAtUtc) -or
            [datetimeoffset]::Parse($workpaper.reviewedAtUtc) -lt
              [datetimeoffset]::Parse($Audit.runStartedAtUtc) -or
            [datetimeoffset]::Parse($workpaper.reviewedAtUtc) -ge
              [datetimeoffset]::Parse($Audit.runEndedAtUtc) -or
            $workpaper.reviewedByUserId -cne $record.reviewerUserId) {
          return $false
        }
      } elseif ($null -ne $workpaper.reviewedAtUtc -or
          $null -ne $workpaper.reviewedByUserId) { return $false }
    }
    if ($null -eq $document) {
      if ($null -ne $export) { return $false }
    } else {
      if ($null -eq $workpaper -or -not (Test-UuidString $document.id) -or
          $document.workpaperId -cne $workpaper.id -or
          $document.anchorCode -cne 'BS.ASSET.CURRENT_SECTION' -or
          $document.fileName -cne 'evidence-bank-reconciliation-fy2025-v1.csv' -or
          $document.mediaType -cne 'text/csv' -or
          -not (Test-JsonInteger $document.byteSize) -or
          $document.byteSize -ne 184 -or
          $document.checksumSha256 -cne 'f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27' -or
          $document.sourceLabel -cne 'Ritomer internal synthetic fixture 043' -or
          $document.documentDate -cne '2025-12-31' -or
          $document.storageBackend -cne 'LOCAL_FS' -or
          -not (Test-ContainsOrdinal @('UNVERIFIED','VERIFIED') `
            $document.verificationStatus) -or
          $null -ne $document.reviewComment) { return $false }
      if ($document.verificationStatus -ceq 'VERIFIED') {
        if ($null -eq $Audit.runStartedAtUtc -or
            -not (Test-StrictDbUtc $document.reviewedAtUtc) -or
            [datetimeoffset]::Parse($document.reviewedAtUtc) -lt
              [datetimeoffset]::Parse($Audit.runStartedAtUtc) -or
            [datetimeoffset]::Parse($document.reviewedAtUtc) -ge
              [datetimeoffset]::Parse($Audit.runEndedAtUtc) -or
            $document.reviewedByUserId -cne $record.reviewerUserId) {
          return $false
        }
      } elseif ($null -ne $document.reviewedAtUtc -or
          $null -ne $document.reviewedByUserId) { return $false }
    }
    if ($null -ne $export) {
      if ($null -eq $closing -or $null -eq $document -or
          -not (Test-UuidString $export.id) -or
          $export.closingFolderId -cne $closing.id -or
          -not (Test-HashString $export.idempotencyKeySha256) -or
          -not (Test-HashString $export.storageObjectKeySha256) -or
          -not (Test-HashString $export.sourceFingerprint) -or
          $export.storageBackend -cne 'LOCAL_FS' -or
          $export.fileName -cne
            ("closing-folder-$($closing.id)-export-pack-$($export.id).zip") -or
          $export.mediaType -cne 'application/zip' -or
          -not (Test-JsonInteger $export.byteSize) -or $export.byteSize -le 0 -or
          -not (Test-HashString $export.checksumSha256) -or
          -not (Test-JsonInteger $export.basisImportVersion) -or
          $export.basisImportVersion -ne 1 -or
          -not (Test-JsonInteger $export.basisTaxonomyVersion) -or
          $export.basisTaxonomyVersion -ne 2 -or
          $null -eq $Audit.runStartedAtUtc -or
          -not (Test-StrictDbUtc $export.createdAtUtc) -or
          [datetimeoffset]::Parse($export.createdAtUtc) -lt
            [datetimeoffset]::Parse($Audit.runStartedAtUtc) -or
          [datetimeoffset]::Parse($export.createdAtUtc) -ge
            [datetimeoffset]::Parse($Audit.runEndedAtUtc) -or
          $export.createdByUserId -cne $record.accountantUserId) { return $false }
    } elseif ($record.minimalAnnexVerified -ne $false -or
        $record.usefulnessAssessmentCompleted -ne $false) { return $false }
    $expectedResourceIds = @($null) * 15
    if ($null -ne $closing) { $expectedResourceIds[0] = $closing.id }
    if ($null -ne $balance) { $expectedResourceIds[1] = $balance.id }
    for ($index = 0; $index -lt $mappings.Count; $index += 1) {
      $expectedResourceIds[$index + 2] = $mappings[$index].id
    }
    if ($null -ne $workpaper) {
      $expectedResourceIds[9] = $workpaper.id
      $expectedResourceIds[11] = $workpaper.id
      $expectedResourceIds[13] = $workpaper.id
    }
    if ($null -ne $document) {
      $expectedResourceIds[10] = $document.id
      $expectedResourceIds[12] = $document.id
    }
    if ($null -ne $export) { $expectedResourceIds[14] = $export.id }
    for ($index = 0; $index -lt 15; $index += 1) {
      if ($Audit.slots[$index].matchStatus -ceq 'MATCHED' -and
          ($null -eq $expectedResourceIds[$index] -or
           $Audit.slots[$index].resourceId -cne
             $expectedResourceIds[$index])) { return $false }
    }
    if (($Audit.slots[11].matchStatus -ceq 'MATCHED' -and
         $workpaper.status -ceq 'DRAFT') -or
        ($Audit.slots[12].matchStatus -ceq 'MATCHED' -and
         $document.verificationStatus -cne 'VERIFIED') -or
        ($Audit.slots[13].matchStatus -ceq 'MATCHED' -and
         $workpaper.status -cne 'REVIEWED')) { return $false }
    return $true
  }
  if ($record.lastCompletedTask -cne 'T14' -or $mappings.Count -ne 7 -or
      $record.minimalAnnexVerified -ne $true -or
      $record.usefulnessAssessmentCompleted -ne $true -or
      $null -eq $record.closingFolder -or $null -eq $record.balanceImport -or
      $null -eq $record.workpaper -or $null -eq $record.document -or
      $null -eq $record.exportPack) { return $false }
  $closing = $record.closingFolder
  $balance = $record.balanceImport
  $workpaper = $record.workpaper
  $document = $record.document
  $export = $record.exportPack
  if (-not (Test-OrdinalSequence @($closing.PSObject.Properties.Name) `
        $script:ClosingFolderProjectionKeys) -or
      -not (Test-OrdinalSequence @($balance.PSObject.Properties.Name) `
        $script:BalanceImportProjectionKeys) -or
      -not (Test-OrdinalSequence @($workpaper.PSObject.Properties.Name) `
        $script:WorkpaperProjectionKeys) -or
      -not (Test-OrdinalSequence @($document.PSObject.Properties.Name) `
        $script:DocumentProjectionKeys) -or
      -not (Test-OrdinalSequence @($export.PSObject.Properties.Name) `
        $script:ExportPackProjectionKeys)) { return $false }
  $expectedName = if ($record.run -ceq 'R1') {
    'Demo Closing FY2025 043c R1 internal rehearsal (synthetic)'
  } else { 'Demo Closing FY2025 043c R2 internal rehearsal (synthetic)' }
  $expectedRef = if ($record.run -ceq 'R1') {
    'DEMO-043C-R1-INTERNAL-REHEARSAL'
  } else { 'DEMO-043C-R2-INTERNAL-REHEARSAL' }
  if (-not (Test-UuidString $closing.id) -or $closing.name -cne $expectedName -or
      $closing.periodStartOn -cne '2025-01-01' -or
      $closing.periodEndOn -cne '2025-12-31' -or
      $closing.externalRef -cne $expectedRef -or $closing.status -cne 'DRAFT' -or
      -not (Test-UuidString $balance.id) -or
      $balance.closingFolderId -cne $closing.id -or
      -not (Test-JsonInteger $balance.version) -or $balance.version -ne 1 -or
      $balance.fileName -cne 'balance-fy2025-v1.csv' -or
      -not (Test-JsonInteger $balance.rowCount) -or $balance.rowCount -ne 7 -or
      $balance.totalDebit -cne '149000.00' -or
      $balance.totalCredit -cne '149000.00') { return $false }
  $accounts = @('1000','1100','1200','2000','2800','3000','4000')
  $targets = @(
    'BS.ASSET.CASH_AND_EQUIVALENTS', 'BS.ASSET.TRADE_RECEIVABLES',
    'BS.ASSET.PREPAIDS_AND_OTHER_CURRENT', 'BS.LIABILITY.TRADE_PAYABLES',
    'BS.EQUITY.RETAINED_EARNINGS', 'PL.REVENUE.OPERATING_REVENUE',
    'PL.EXPENSE.OTHER_OPERATING_EXPENSES'
  )
  for ($index = 0; $index -lt 7; $index += 1) {
    $mapping = $mappings[$index]
    if (-not (Test-OrdinalSequence @($mapping.PSObject.Properties.Name) `
          $script:MappingProjectionKeys) -or
        -not (Test-UuidString $mapping.id) -or
        $mapping.closingFolderId -cne $closing.id -or
        $mapping.accountCode -cne $accounts[$index] -or
        $mapping.targetCode -cne $targets[$index] -or
        $mapping.createdByUserId -cne $record.accountantUserId -or
        $mapping.updatedByUserId -cne $record.accountantUserId) { return $false }
  }
  $expectedAuditResourceIds = @(
    $closing.id, $balance.id, $mappings[0].id, $mappings[1].id,
    $mappings[2].id, $mappings[3].id, $mappings[4].id, $mappings[5].id,
    $mappings[6].id, $workpaper.id, $document.id, $workpaper.id,
    $document.id, $workpaper.id, $export.id
  )
  for ($index = 0; $index -lt 15; $index += 1) {
    if ($Audit.slots[$index].resourceId -cne $expectedAuditResourceIds[$index]) {
      return $false
    }
  }
  $runStartedAt = [datetimeoffset]::Parse($Audit.runStartedAtUtc)
  $runEndedAt = [datetimeoffset]::Parse($Audit.runEndedAtUtc)
  return (Test-UuidString $workpaper.id) -and
    $workpaper.closingFolderId -ceq $closing.id -and
    $workpaper.anchorCode -ceq 'BS.ASSET.CURRENT_SECTION' -and
    $workpaper.noteText -ceq 'Synthetic bank reconciliation FY2025.' -and
    $workpaper.status -ceq 'REVIEWED' -and
    $null -eq $workpaper.reviewComment -and
    (Test-JsonInteger $workpaper.basisImportVersion) -and
    $workpaper.basisImportVersion -eq 1 -and
    (Test-JsonInteger $workpaper.basisTaxonomyVersion) -and
    $workpaper.basisTaxonomyVersion -eq 2 -and
    (Test-JsonInteger $workpaper.evidenceCount) -and
    $workpaper.evidenceCount -eq 0 -and
    (Test-StrictDbUtc $workpaper.reviewedAtUtc) -and
    [datetimeoffset]::Parse($workpaper.reviewedAtUtc) -ge $runStartedAt -and
    [datetimeoffset]::Parse($workpaper.reviewedAtUtc) -lt $runEndedAt -and
    $workpaper.reviewedByUserId -ceq $record.reviewerUserId -and
    (Test-UuidString $document.id) -and
    $document.workpaperId -ceq $workpaper.id -and
    $document.anchorCode -ceq 'BS.ASSET.CURRENT_SECTION' -and
    $document.fileName -ceq 'evidence-bank-reconciliation-fy2025-v1.csv' -and
    $document.mediaType -ceq 'text/csv' -and
    (Test-JsonInteger $document.byteSize) -and $document.byteSize -eq 184 -and
    $document.checksumSha256 -ceq 'f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27' -and
    $document.sourceLabel -ceq 'Ritomer internal synthetic fixture 043' -and
    $document.documentDate -ceq '2025-12-31' -and
    $document.storageBackend -ceq 'LOCAL_FS' -and
    $document.verificationStatus -ceq 'VERIFIED' -and
    $null -eq $document.reviewComment -and
    (Test-StrictDbUtc $document.reviewedAtUtc) -and
    [datetimeoffset]::Parse($document.reviewedAtUtc) -ge $runStartedAt -and
    [datetimeoffset]::Parse($document.reviewedAtUtc) -lt $runEndedAt -and
    $document.reviewedByUserId -ceq $record.reviewerUserId -and
    (Test-UuidString $export.id) -and $export.closingFolderId -ceq $closing.id -and
    (Test-HashString $export.idempotencyKeySha256) -and
    (Test-HashString $export.storageObjectKeySha256) -and
    (Test-HashString $export.sourceFingerprint) -and
    $export.storageBackend -ceq 'LOCAL_FS' -and
    $export.fileName -ceq ("closing-folder-$($closing.id)-export-pack-$($export.id).zip") -and
    $export.mediaType -ceq 'application/zip' -and
    (Test-JsonInteger $export.byteSize) -and $export.byteSize -gt 0 -and
    (Test-HashString $export.checksumSha256) -and
    (Test-JsonInteger $export.basisImportVersion) -and
    $export.basisImportVersion -eq 1 -and
    (Test-JsonInteger $export.basisTaxonomyVersion) -and
    $export.basisTaxonomyVersion -eq 2 -and
    (Test-StrictDbUtc $export.createdAtUtc) -and
    [datetimeoffset]::Parse($export.createdAtUtc) -ge $runStartedAt -and
    [datetimeoffset]::Parse($export.createdAtUtc) -lt $runEndedAt -and
    $export.createdByUserId -ceq $record.accountantUserId
}

function Invoke-CompleteEvidenceValidation {
  param(
    [byte[]] $QualificationBytes,
    [byte[]] $R1AuditBytes,
    [byte[]] $R1BusinessBytes,
    [byte[]] $R2AuditBytes,
    [byte[]] $R2BusinessBytes,
    [byte[]] $R1EvidenceBytes,
    [byte[]] $R2EvidenceBytes,
    [pscustomobject] $BindingR1,
    [pscustomobject] $BindingR2,
    [byte[]] $LedgerBytes
  )

  if (-not (Test-QualificationManifest $QualificationBytes $BindingR1 $BindingR2)) {
    return New-CoreValidationResult 'ValidateR2Evidence' 'E_GATE_QUALIFICATION'
  }
  if (-not (Test-ArtifactEnvelope $R1EvidenceBytes $script:EvidenceKeys `
        $true $true $true) -or
      -not (Test-ArtifactEnvelope $R2EvidenceBytes $script:EvidenceKeys `
        $true $true $true)) {
    return New-CoreValidationResult 'ValidateR2Evidence' 'E_JSON_CANONICAL'
  }
  $qualificationHash = Get-Sha256Hex $QualificationBytes
  if ($BindingR1.qualificationSha256 -cne $qualificationHash -or
      $BindingR2.qualificationSha256 -cne $qualificationHash) {
    return New-CoreValidationResult 'ValidateR2Evidence' 'E_GATE_QUALIFICATION'
  }
  try {
    $r1 = Convert-ArtifactRecord $R1EvidenceBytes
    $r2 = Convert-ArtifactRecord $R2EvidenceBytes
  } catch {
    return New-CoreValidationResult 'ValidateR2Evidence' 'E_JSON_ENCODING'
  }
  if (-not (Test-EvidenceSchema $r1 $BindingR1) -or
      -not (Test-EvidenceSchema $r2 $BindingR2)) {
    return New-CoreValidationResult 'ValidateR2Evidence' 'E_PROTOCOL_BINDING'
  }
  if (-not (Test-AuditProjection $R1AuditBytes $r1) -or
      -not (Test-AuditProjection $R2AuditBytes $r2)) {
    return New-CoreValidationResult 'ValidateR2Evidence' 'E_EVIDENCE_AUDIT'
  }
  try {
    $r1Audit = Convert-ArtifactRecord $R1AuditBytes
    $r2Audit = Convert-ArtifactRecord $R2AuditBytes
  } catch {
    return New-CoreValidationResult 'ValidateR2Evidence' 'E_EVIDENCE_AUDIT'
  }
  if (-not (Test-BusinessProjection $R1BusinessBytes $r1 $r1Audit) -or
      -not (Test-BusinessProjection $R2BusinessBytes $r2 $r2Audit)) {
    return New-CoreValidationResult 'ValidateR2Evidence' 'E_EVIDENCE_AUDIT'
  }
  $records = @($r1, $r2)
  $auditHashes = @(
    (Get-Sha256Hex $R1AuditBytes),
    (Get-Sha256Hex $R2AuditBytes)
  )
  $businessHashes = @(
    (Get-Sha256Hex $R1BusinessBytes),
    (Get-Sha256Hex $R2BusinessBytes)
  )
  for ($index = 0; $index -lt 2; $index += 1) {
    $record = $records[$index]
    if ($record.qualificationSha256 -cne $qualificationHash) {
      return New-CoreValidationResult 'ValidateR2Evidence' 'E_GATE_QUALIFICATION'
    }
    if ($record.auditProjectionSha256 -cne $auditHashes[$index] -or
        $record.businessStateSha256 -cne $businessHashes[$index]) {
      return New-CoreValidationResult 'ValidateR2Evidence' 'E_EVIDENCE_AUDIT'
    }
    $descriptor = [ordered]@{}
    foreach ($key in $script:EvidenceDescriptorKeys) {
      $descriptor[$key] = $record.PSObject.Properties[$key].Value
    }
    $descriptorHash = Get-Sha256Hex (ConvertTo-C043CBytes $descriptor)
    if ($record.evidenceContentSha256 -cne $descriptorHash) {
      return New-CoreValidationResult 'ValidateR2Evidence' `
        'E_EVIDENCE_CONTENT_HASH'
    }
  }
  $r1FileHash = Get-Sha256Hex $R1EvidenceBytes
  $r2FileHash = Get-Sha256Hex $R2EvidenceBytes
  $indexText = "R1=$r1FileHash`nR2=$r2FileHash`n"
  $indexBytes = [System.Text.Encoding]::ASCII.GetBytes($indexText)
  if ($indexBytes.Length -ne 136) {
    return New-CoreValidationResult 'ValidateR2Evidence' 'E_EVIDENCE_FILE_HASH'
  }
  $d7Hash = Get-Sha256Hex $indexBytes
  $ledger = Read-V2LedgerCheckpoints $LedgerBytes D7
  $expectedD6CompletedRun = if ($r1.outcome -ceq 'COMPLETED') { 'R1' } else {
    $null
  }
  $expectedD7CompletedRun = if ($r2.outcome -ceq 'COMPLETED') { 'R2' } else {
    'R1'
  }
  $ledgerBound = $ledger.Valid -and $r1.outcome -ceq 'COMPLETED' -and
    [object]::Equals($ledger.D6.completedRun, $expectedD6CompletedRun) -and
    $ledger.D6.evidenceSha256 -ceq $r1FileHash -and
    $ledger.D7.completedRun -ceq $expectedD7CompletedRun -and
    $ledger.D7.evidenceSha256 -ceq $d7Hash -and
    $ledger.D5.protocolId -ceq $BindingR1.protocolId -and
    $ledger.D5.protocolSha256 -ceq $BindingR1.protocolSha256 -and
    $ledger.D5.protocolSha256 -ceq $BindingR2.protocolSha256 -and
    $ledger.D5.qualificationSha256 -ceq $qualificationHash -and
    $ledger.D5.frozenCommit -ceq $BindingR1.frozenCommit -and
    $ledger.D5.frozenCommit -ceq $BindingR2.frozenCommit -and
    (Test-ReviewRefsBinding $ledger.D6.reviewRefs $BindingR1.reviewRefs) -and
    (Test-ReviewRefsBinding $ledger.D7.reviewRefs $BindingR2.reviewRefs)
  if (-not $ledgerBound) {
    return New-CoreValidationResult 'ValidateR2Evidence' 'E_LEDGER_BINDING'
  }
  return New-CoreValidationResult 'ValidateR2Evidence' $null
}

function Test-V1ValidatorSourcePolicy {
  param([byte[]] $SourceBytes)

  if ($SourceBytes.Length -lt 1 -or
      ($SourceBytes.Length -ge 3 -and $SourceBytes[0] -eq 239 -and
       $SourceBytes[1] -eq 187 -and $SourceBytes[2] -eq 191)) { return $false }
  $strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
  try { $source = $strictUtf8.GetString($SourceBytes) } catch { return $false }
  $tokens = $null
  $parseErrors = $null
  $ast = [System.Management.Automation.Language.Parser]::ParseInput(
    $source, [ref] $tokens, [ref] $parseErrors
  )
  if ($parseErrors.Count -ne 0 -or
      $source.IndexOf('validate-controlled-fiduciary-pilot-043c-v2',
        [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or
      $source.IndexOf('Import-Module',
        [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -or
      $source.IndexOf('using module',
        [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { return $false }
  $expectedModes = @(
    'SelfTest', 'PreparationPreflight', 'PreR1', 'PostR1Cleanup',
    'PreR2', 'PostR2Cleanup'
  )
  $validateSets = @($ast.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.AttributeAst] -and
      $node.TypeName.Name -ceq 'ValidateSet'
  }, $true))
  if ($validateSets.Count -ne 1) { return $false }
  $declaredModes = @()
  foreach ($argument in $validateSets[0].PositionalArguments) {
    try { $declaredModes += [string] $argument.SafeGetValue() } catch { return $false }
  }
  if (-not (Test-OrdinalSequence $declaredModes $expectedModes)) { return $false }
  $guardIndex = $source.IndexOf('if (-not [string]::Equals(',
    [System.StringComparison]::Ordinal)
  $ioTokens = @(
    '[System.Environment]::', '[System.IO.File]::', 'Invoke-ReadProcess',
    'Get-RepositoryArtifacts', 'Get-ResourceStates', 'Read-SafeLocalJsonArtifact'
  )
  if ($guardIndex -lt 0) { return $false }
  $guardEndIndex = $source.IndexOf("`n}", $guardIndex,
    [System.StringComparison]::Ordinal)
  if ($guardEndIndex -lt 0) { return $false }
  $guardText = $source.Substring($guardIndex, $guardEndIndex - $guardIndex)
  foreach ($ioToken in $ioTokens) {
    $ioIndex = $source.IndexOf($ioToken, [System.StringComparison]::Ordinal)
    if ($ioIndex -ge 0 -and $ioIndex -lt $guardEndIndex) { return $false }
  }
  foreach ($required in @(
    'E_V1_EXTERNAL_MODE_PERMANENTLY_DISABLED',
    'V1_EXECUTION=PERMANENTLY_NOT_AUTHORIZED',
    'V2_VALIDATOR_REQUIRED=YES', 'externalAccessPerformed=false',
    'stateWritePerformed=false', 'exit 40'
  )) {
    if ($guardText.IndexOf($required, [System.StringComparison]::Ordinal) -lt 0) {
      return $false
    }
  }
  $externalCalls = @($ast.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.CommandAst] -and
      $node.GetCommandName() -ceq 'Invoke-ExternalMode'
  }, $true))
  $dotSources = @($ast.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.CommandAst] -and
      $node.InvocationOperator -eq [System.Management.Automation.Language.TokenKind]::Dot
  }, $true))
  return $externalCalls.Count -eq 0 -and $dotSources.Count -eq 0
}

function Test-GatePolicyModel {
  param([object[]] $Contracts)

  if ($Contracts.Count -ne 8) { return $false }
  $modes = @($Contracts | ForEach-Object { $_.Mode })
  if (-not (Test-OrdinalSequence $modes $script:ExternalModeOrder)) { return $false }
  $expectedRuns = @('NONE', 'NONE', 'R1', 'R1', 'R1', 'R2', 'R2', 'R2')
  $expectedGates = @('D4', 'D5', 'D5', 'D5', 'D5', 'D6', 'D6', 'D6')
  for ($index = 0; $index -lt $Contracts.Count; $index += 1) {
    $contract = $Contracts[$index]
    if ($contract.Run -cne $expectedRuns[$index] -or
        $contract.RequiredGate -cne $expectedGates[$index] -or
        $contract.ReadOnly -ne $true -or $contract.WriteCount -ne 0 -or
        $contract.GateIndex -lt 0 -or
        $contract.ExternalReadIndex -le $contract.GateIndex -or
        $contract.P0AllowsAccess -ne $false) { return $false }
  }
  return $true
}

function Convert-ExactKeyValueBytes {
  param(
    [byte[]] $Bytes,
    [string[]] $ExpectedKeys
  )

  if ($Bytes.Length -lt 1 -or $Bytes.Length -gt $script:MaximumArtifactBytes -or
      ($Bytes.Length -ge 3 -and $Bytes[0] -eq 239 -and
       $Bytes[1] -eq 187 -and $Bytes[2] -eq 191) -or
      $Bytes -contains 13 -or $Bytes[$Bytes.Length - 1] -ne 10) {
    return [pscustomobject]@{ Valid = $false; Values = $null }
  }
  $strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
  try { $text = $strictUtf8.GetString($Bytes) } catch {
    return [pscustomobject]@{ Valid = $false; Values = $null }
  }
  $lines = @($text.Substring(0, $text.Length - 1).Split("`n"))
  if ($lines.Count -ne $ExpectedKeys.Count) {
    return [pscustomobject]@{ Valid = $false; Values = $null }
  }
  $values = [ordered]@{}
  for ($index = 0; $index -lt $ExpectedKeys.Count; $index += 1) {
    $prefix = $ExpectedKeys[$index] + '='
    if (-not $lines[$index].StartsWith(
      $prefix,
      [System.StringComparison]::Ordinal
    )) {
      return [pscustomobject]@{ Valid = $false; Values = $null }
    }
    $value = $lines[$index].Substring($prefix.Length)
    if ([string]::IsNullOrEmpty($value)) {
      return [pscustomobject]@{ Valid = $false; Values = $null }
    }
    $values[$ExpectedKeys[$index]] = $value
  }
  return [pscustomobject]@{ Valid = $true; Values = $values }
}

function Invoke-CatalogReaderValidation {
  param(
    [byte[]] $AdapterOutputBytes,
    [ValidateSet('R1', 'R2')]
    [string] $ExpectedRun
  )

  if ($AdapterOutputBytes.Length -gt $script:MaximumArtifactBytes) {
    return New-CoreValidationResult 'Qualification' 'E_PSQL_OUTPUT_LIMIT'
  }
  $keys = @(
    'available', 'psqlX', 'noPassword', 'childEnvironment', 'timeoutSeconds',
    'stdoutLimitBytes', 'stderrLimitBytes', 'timedOut', 'exitCode',
    'clientMajor', 'host', 'port', 'auth', 'role', 'login', 'superuser',
    'createDb', 'createRole', 'replication', 'bypassRls', 'membershipCount',
    'writePrivilegeCount', 'r1DatabaseName', 'r1DatabaseState',
    'r1DatabaseOwner', 'r1RoleName', 'r1RoleState', 'r1StorageRelativePath',
    'r1StorageState', 'r2DatabaseName', 'r2DatabaseState', 'r2DatabaseOwner',
    'r2RoleName', 'r2RoleState', 'r2StorageRelativePath', 'r2StorageState'
  )
  $parsed = Convert-ExactKeyValueBytes $AdapterOutputBytes $keys
  if (-not $parsed.Valid) {
    return New-CoreValidationResult 'Qualification' 'E_PSQL_EXIT'
  }
  $values = $parsed.Values
  if ($values.available -cne 'true') {
    return New-CoreValidationResult 'Qualification' 'E_PSQL17_UNAVAILABLE'
  }
  if ($values.psqlX -cne 'true' -or $values.noPassword -cne 'true' -or
      $values.childEnvironment -cne 'ALLOWLISTED_ONLY') {
    return New-CoreValidationResult 'Qualification' 'E_PG_AUTH_CHANNEL'
  }
  if ($values.timeoutSeconds -cne '10' -or $values.timedOut -cne 'false') {
    return New-CoreValidationResult 'Qualification' 'E_PSQL_TIMEOUT'
  }
  if ($values.stdoutLimitBytes -cne '65536' -or
      $values.stderrLimitBytes -cne '65536') {
    return New-CoreValidationResult 'Qualification' 'E_PSQL_OUTPUT_LIMIT'
  }
  if ($values.exitCode -cne '0') {
    return New-CoreValidationResult 'Qualification' 'E_PSQL_EXIT'
  }
  if ($values.clientMajor -cne '17') {
    return New-CoreValidationResult 'Qualification' 'E_PSQL17_VERSION'
  }
  if ($values.host -cne '127.0.0.1' -or $values.port -cne '5432') {
    return New-CoreValidationResult 'Qualification' 'E_PG_SERVER_IDENTITY'
  }
  if ($values.auth -cne 'sspi') {
    return New-CoreValidationResult 'Qualification' 'E_PG_AUTH_CHANNEL'
  }
  if ($values.role -cne 'ritomer_043c_catalog_reader' -or
      $values.login -cne 'true') {
    return New-CoreValidationResult 'Qualification' 'E_PG_READER_ROLE'
  }
  if ($values.superuser -cne 'false' -or $values.createDb -cne 'false' -or
      $values.createRole -cne 'false' -or $values.replication -cne 'false' -or
      $values.bypassRls -cne 'false' -or $values.membershipCount -cne '0' -or
      $values.writePrivilegeCount -cne '0') {
    return New-CoreValidationResult 'Qualification' 'E_PG_READER_PRIVILEGES'
  }
  $r1ExpectedState = if ($ExpectedRun -ceq 'R1') {
    'CATALOG_TARGET_PRESENT_POLICY_SAFE'
  } else { 'ABSENT' }
  $r2ExpectedState = if ($ExpectedRun -ceq 'R2') {
    'CATALOG_TARGET_PRESENT_POLICY_SAFE'
  } else { 'ABSENT' }
  $r1RoleState = if ($ExpectedRun -ceq 'R1') { 'PRESENT_POLICY_SAFE' } else {
    'ABSENT'
  }
  $r2RoleState = if ($ExpectedRun -ceq 'R2') { 'PRESENT_POLICY_SAFE' } else {
    'ABSENT'
  }
  $r1StorageState = if ($ExpectedRun -ceq 'R1') { 'PRESENT_EMPTY_SAFE' } else {
    'ABSENT'
  }
  $r2StorageState = if ($ExpectedRun -ceq 'R2') { 'PRESENT_EMPTY_SAFE' } else {
    'ABSENT'
  }
  $r1Owner = if ($ExpectedRun -ceq 'R1') { 'ritomer_043c_r1_runner' } else {
    'NONE'
  }
  $r2Owner = if ($ExpectedRun -ceq 'R2') { 'ritomer_043c_r2_runner' } else {
    'NONE'
  }
  if ($values.r1DatabaseName -cne 'ritomer_043c_r1' -or
      $values.r1DatabaseState -cne $r1ExpectedState -or
      $values.r1DatabaseOwner -cne $r1Owner -or
      $values.r1RoleName -cne 'ritomer_043c_r1_runner' -or
      $values.r1RoleState -cne $r1RoleState -or
      $values.r1StorageRelativePath -cne 'runtime/R1/storage' -or
      $values.r1StorageState -cne $r1StorageState -or
      $values.r2DatabaseName -cne 'ritomer_043c_r2' -or
      $values.r2DatabaseState -cne $r2ExpectedState -or
      $values.r2DatabaseOwner -cne $r2Owner -or
      $values.r2RoleName -cne 'ritomer_043c_r2_runner' -or
      $values.r2RoleState -cne $r2RoleState -or
      $values.r2StorageRelativePath -cne 'runtime/R2/storage' -or
      $values.r2StorageState -cne $r2StorageState) {
    return New-CoreValidationResult 'Qualification' 'E_PG_RESOURCE_STATE'
  }
  return New-CoreValidationResult 'Qualification' $null
}

function Invoke-ApplicationReadinessValidation {
  param(
    [byte[]] $AdapterOutputBytes,
    [pscustomobject] $ExpectedBinding
  )

  $keys = @(
    'run', 'protocolSha256', 'frozenCommit', 'resourceTargetSha256',
    'flywayVersions', 'expectedTablesExact', 'syntheticTenantCount', 'userCount',
    'accountantMembershipCount', 'reviewerMembershipCount', 'businessRowCount',
    'auditRowCount', 'storageState', 'otherRunState'
  )
  $parsed = Convert-ExactKeyValueBytes $AdapterOutputBytes $keys
  if (-not $parsed.Valid) {
    return New-CoreValidationResult 'PreparationPreflight' `
      'E_APPLICATION_READINESS'
  }
  $values = $parsed.Values
  if ($values.run -cne $ExpectedBinding.run -or
      $values.protocolSha256 -cne $ExpectedBinding.protocolSha256 -or
      $values.frozenCommit -cne $ExpectedBinding.frozenCommit -or
      $values.resourceTargetSha256 -cne $ExpectedBinding.resourceTargetSha256 -or
      $values.flywayVersions -cne 'V1-V10' -or
      $values.expectedTablesExact -cne 'true' -or
      $values.syntheticTenantCount -cne '1' -or $values.userCount -cne '2' -or
      $values.accountantMembershipCount -cne '1' -or
      $values.reviewerMembershipCount -cne '1' -or
      $values.businessRowCount -cne '0' -or $values.auditRowCount -cne '0' -or
      $values.storageState -cne 'PRESENT_EMPTY_SAFE' -or
      $values.otherRunState -cne 'ABSENT') {
    return New-CoreValidationResult 'PreparationPreflight' `
      'E_APPLICATION_READINESS'
  }
  return New-CoreValidationResult 'PreparationPreflight' $null
}

function Invoke-R2PreconditionValidation {
  param(
    [byte[]] $R1EvidenceBytes,
    [pscustomobject] $R1Authorization,
    [byte[]] $LedgerBytes,
    [pscustomobject] $CleanupSnapshot
  )

  $snapshotKeys = @(
    'ActiveStateSnapshot', 'ResourceAdapterBytes', 'ExternalIoPerformed',
    'StateWritePerformed'
  )
  if (-not (Test-OrdinalSequence `
        @($CleanupSnapshot.PSObject.Properties.Name) $snapshotKeys) -or
      $CleanupSnapshot.ExternalIoPerformed -ne $false -or
      $CleanupSnapshot.StateWritePerformed -ne $false -or
      -not (Test-ArtifactReadSnapshot $CleanupSnapshot.ActiveStateSnapshot `
        $script:RuntimeArtifactRelativePaths.ActiveState) -or
      -not (Test-ArtifactEnvelope $CleanupSnapshot.ActiveStateSnapshot.Bytes `
        $script:ActiveStateKeys $true $true $true)) {
    return New-CoreValidationResult 'PreR2' 'E_CLEANUP_STATE'
  }
  try {
    $cleanupActiveState = Convert-ArtifactRecord `
      $CleanupSnapshot.ActiveStateSnapshot.Bytes
  } catch {
    return New-CoreValidationResult 'PreR2' 'E_CLEANUP_STATE'
  }
  if (-not (Test-ActiveStateSchema $cleanupActiveState $R1Authorization) -or
      $cleanupActiveState.run -cne 'R1' -or
      $cleanupActiveState.state -cne 'R1_STARTED_CLEANUP_NOT_VALIDATED') {
    return New-CoreValidationResult 'PreR2' 'E_CLEANUP_STATE'
  }
  $cleanupResources = Convert-ExactKeyValueBytes `
    $CleanupSnapshot.ResourceAdapterBytes $script:CleanupResourceKeys
  if (-not $cleanupResources.Valid -or
      $cleanupResources.Values.run -cne 'R1' -or
      $cleanupResources.Values.databaseName -cne 'ritomer_043c_r1' -or
      $cleanupResources.Values.databaseState -cne 'ABSENT' -or
      $cleanupResources.Values.roleName -cne 'ritomer_043c_r1_runner' -or
      $cleanupResources.Values.roleState -cne 'ABSENT' -or
      $cleanupResources.Values.storageRelativePath -cne 'runtime/R1/storage' -or
      $cleanupResources.Values.storageState -cne 'ABSENT') {
    return New-CoreValidationResult 'PreR2' 'E_CLEANUP_STATE'
  }
  if (-not (Test-ArtifactEnvelope $R1EvidenceBytes $script:EvidenceKeys `
        $true $true $true)) {
    return New-CoreValidationResult 'PreR2' 'E_R1_PRECONDITION'
  }
  try { $r1 = Convert-ArtifactRecord $R1EvidenceBytes } catch {
    return New-CoreValidationResult 'PreR2' 'E_R1_PRECONDITION'
  }
  if (-not (Test-EvidenceSchema $r1 $R1Authorization) -or
      $r1.run -cne 'R1') {
    return New-CoreValidationResult 'PreR2' 'E_R1_PRECONDITION'
  }
  $descriptor = [ordered]@{}
  foreach ($key in $script:EvidenceDescriptorKeys) {
    $descriptor[$key] = $r1.PSObject.Properties[$key].Value
  }
  if ($r1.evidenceContentSha256 -cne
      (Get-Sha256Hex (ConvertTo-C043CBytes $descriptor))) {
    return New-CoreValidationResult 'PreR2' 'E_R1_PRECONDITION'
  }
  $fileHash = Get-Sha256Hex $R1EvidenceBytes
  $ledger = Read-V2LedgerCheckpoints $LedgerBytes D6
  $expectedCompletedRun = if ($r1.outcome -ceq 'COMPLETED') { 'R1' } else {
    $null
  }
  $d6Bound = $ledger.Valid -and
    [object]::Equals($ledger.D6.completedRun, $expectedCompletedRun) -and
    $ledger.D6.evidenceSha256 -ceq $fileHash -and
    $ledger.D5.protocolId -ceq $R1Authorization.protocolId -and
    $ledger.D5.protocolSha256 -ceq $R1Authorization.protocolSha256 -and
    $ledger.D5.qualificationSha256 -ceq
      $R1Authorization.qualificationSha256 -and
    $ledger.D5.frozenCommit -ceq $R1Authorization.frozenCommit
  if (-not $d6Bound) {
    return New-CoreValidationResult 'PreR2' 'E_LEDGER_BINDING'
  }
  if ($r1.outcome -cne 'COMPLETED' -or
      $r1.lastCompletedTask -cne 'T14' -or
      $r1.expectedBusinessEventCount -ne 15 -or
      $r1.missingExpectedBusinessEventCount -ne 0 -or
      $r1.unexpectedBusinessEventCount -ne 0) {
    return New-CoreValidationResult 'PreR2' 'E_R1_PRECONDITION'
  }
  return New-CoreValidationResult 'PreR2' $null
}

function Add-Probe {
  param(
    [System.Collections.Generic.List[string]] $Succeeded,
    [System.Collections.Generic.List[string]] $Failed,
    [string] $Id,
    [bool] $Condition
  )

  if ($Condition) { $Succeeded.Add($Id) } else { $Failed.Add($Id) }
}

function New-SyntheticEvidenceBytes {
  param(
    [ValidateSet('R1', 'R2')]
    [string] $Run,
    [pscustomobject] $Binding,
    [string] $AuditHash,
    [string] $BusinessHash,
    [string] $QualificationHash,
    [ValidateSet('COMPLETED', 'ABORTED')]
    [string] $Outcome = 'COMPLETED',
    [AllowNull()] [object] $LastCompletedTask = 'T14',
    [AllowNull()] [object] $AbortReasonCode = $null,
    [int] $MissingExpectedBusinessEventCount = 0,
    [int] $UnexpectedBusinessEventCount = 0
  )

  $day = if ($Run -ceq 'R1') { '01' } else { '02' }
  $runStartedAtUtc = if ($Outcome -ceq 'ABORTED' -and
      ($null -eq $LastCompletedTask -or $LastCompletedTask -ceq 'T00')) {
    $null
  } else { "2026-01-${day}T00:00:00.000Z" }
  $descriptor = [ordered]@{
    schemaVersion = 2
    run = $Run
    outcome = $Outcome
    lastCompletedTask = $LastCompletedTask
    abortReasonCode = $AbortReasonCode
    runStartedAtUtc = $runStartedAtUtc
    runEndedAtUtc = "2026-01-${day}T00:01:00.000Z"
    protocolId = $Binding.protocolId
    protocolSha256 = $Binding.protocolSha256
    frozenCommit = $Binding.frozenCommit
    resourceTargetSha256 = $Binding.resourceTargetSha256
    expectedBusinessEventCount = 15
    missingExpectedBusinessEventCount = $MissingExpectedBusinessEventCount
    unexpectedBusinessEventCount = $UnexpectedBusinessEventCount
    auditProjectionSha256 = $AuditHash
    businessStateSha256 = $BusinessHash
    qualificationSha256 = $QualificationHash
  }
  $contentHash = Get-Sha256Hex (ConvertTo-C043CBytes $descriptor)
  $full = [ordered]@{
    schemaVersion = $descriptor.schemaVersion
    run = $descriptor.run
    outcome = $descriptor.outcome
    lastCompletedTask = $descriptor.lastCompletedTask
    abortReasonCode = $descriptor.abortReasonCode
    runStartedAtUtc = $descriptor.runStartedAtUtc
    runEndedAtUtc = $descriptor.runEndedAtUtc
    protocolId = $descriptor.protocolId
    protocolSha256 = $descriptor.protocolSha256
    frozenCommit = $descriptor.frozenCommit
    resourceTargetSha256 = $descriptor.resourceTargetSha256
    expectedBusinessEventCount = $descriptor.expectedBusinessEventCount
    missingExpectedBusinessEventCount = $descriptor.missingExpectedBusinessEventCount
    unexpectedBusinessEventCount = $descriptor.unexpectedBusinessEventCount
    auditProjectionSha256 = $descriptor.auditProjectionSha256
    businessStateSha256 = $descriptor.businessStateSha256
    evidenceContentSha256 = $contentHash
    qualificationSha256 = $descriptor.qualificationSha256
  }
  return ConvertTo-C043CBytes $full
}

function New-SyntheticProjectionSet {
  param(
    [ValidateSet('R1', 'R2')]
    [string] $Run,
    [ValidateSet('COMPLETED', 'ABORTED')]
    [string] $Outcome = 'COMPLETED',
    [AllowNull()] [object] $LastCompletedTask = 'T14',
    [int[]] $MissingSlots = @(),
    [int] $UnexpectedBusinessEventCount = 0
  )

  $digit = if ($Run -ceq 'R1') { '1' } else { '2' }
  $day = if ($Run -ceq 'R1') { '01' } else { '02' }
  $tenantId = "${digit}0000000-0000-4000-8000-000000000001"
  $accountantId = "${digit}0000000-0000-4000-8000-000000000002"
  $reviewerId = "${digit}0000000-0000-4000-8000-000000000003"
  $closingId = "${digit}0000000-0000-4000-8000-000000000004"
  $balanceId = "${digit}0000000-0000-4000-8000-000000000005"
  $workpaperId = "${digit}0000000-0000-4000-8000-000000000006"
  $documentId = "${digit}0000000-0000-4000-8000-000000000007"
  $exportId = "${digit}0000000-0000-4000-8000-000000000008"
  $mappingIds = @()
  for ($index = 0; $index -lt 7; $index += 1) {
    $mappingIds += ("${digit}0000000-0000-4000-8002-{0:D12}" -f `
      ($index + 1))
  }
  $actions = @(
    'CLOSING_FOLDER.CREATED', 'BALANCE_IMPORT.CREATED',
    'MANUAL_MAPPING.CREATED', 'MANUAL_MAPPING.CREATED',
    'MANUAL_MAPPING.CREATED', 'MANUAL_MAPPING.CREATED',
    'MANUAL_MAPPING.CREATED', 'MANUAL_MAPPING.CREATED',
    'MANUAL_MAPPING.CREATED', 'WORKPAPER.CREATED', 'DOCUMENT.CREATED',
    'WORKPAPER.UPDATED', 'DOCUMENT.VERIFICATION_UPDATED',
    'WORKPAPER.REVIEW_STATUS_CHANGED', 'EXPORT_PACK.CREATED'
  )
  $resources = @(
    'CLOSING_FOLDER', 'BALANCE_IMPORT', 'MANUAL_MAPPING', 'MANUAL_MAPPING',
    'MANUAL_MAPPING', 'MANUAL_MAPPING', 'MANUAL_MAPPING', 'MANUAL_MAPPING',
    'MANUAL_MAPPING', 'WORKPAPER', 'DOCUMENT', 'WORKPAPER', 'DOCUMENT',
    'WORKPAPER', 'EXPORT_PACK'
  )
  $accounts = @('1000','1100','1200','2000','2800','3000','4000')
  $targets = @(
    'BS.ASSET.CASH_AND_EQUIVALENTS', 'BS.ASSET.TRADE_RECEIVABLES',
    'BS.ASSET.PREPAIDS_AND_OTHER_CURRENT', 'BS.LIABILITY.TRADE_PAYABLES',
    'BS.EQUITY.RETAINED_EARNINGS', 'PL.REVENUE.OPERATING_REVENUE',
    'PL.EXPENSE.OTHER_OPERATING_EXPENSES'
  )
  $resourceIds = @(
    $closingId, $balanceId, $mappingIds[0], $mappingIds[1], $mappingIds[2],
    $mappingIds[3], $mappingIds[4], $mappingIds[5], $mappingIds[6],
    $workpaperId, $documentId, $workpaperId, $documentId, $workpaperId,
    $exportId
  )
  $slots = @()
  $utf8 = New-Object System.Text.UTF8Encoding($false, $true)
  for ($index = 0; $index -lt 15; $index += 1) {
    $mappingIndex = $index - 2
    $missing = Test-ContainsOrdinal $MissingSlots ($index + 1)
    $role = if ($index -eq 12 -or $index -eq 13) { 'REVIEWER' } else {
      'ACCOUNTANT'
    }
    $actorId = if ($role -ceq 'REVIEWER') { $reviewerId } else { $accountantId }
    $slots += [pscustomobject][ordered]@{
      slot = $index + 1
      action = $actions[$index]
      resourceType = $resources[$index]
      accountCode = if ($mappingIndex -ge 0 -and $mappingIndex -lt 7) {
        $accounts[$mappingIndex]
      } else { $null }
      targetCode = if ($mappingIndex -ge 0 -and $mappingIndex -lt 7) {
        $targets[$mappingIndex]
      } else { $null }
      matchStatus = if ($missing) { 'MISSING' } else { 'MATCHED' }
      resourceId = if ($missing) { $null } else { $resourceIds[$index] }
      occurredAtUtc = if ($missing) { $null } else {
        ("2026-01-${day}T00:00:{0:D2}.{1:D6}Z" -f `
          ($index + 1), ($index + 1))
      }
      actorUserId = if ($missing) { $null } else { $actorId }
      actorSubjectSha256 = if ($missing) { $null } else {
        Get-Sha256Hex $utf8.GetBytes("$Run-$role-subject")
      }
      actorRole = if ($missing) { $null } else { $role }
      requestIdSha256 = if ($missing) { $null } else {
        Get-Sha256Hex $utf8.GetBytes("$Run-request-$($index + 1)")
      }
      metadataSha256 = if ($missing) { $null } else {
        Get-Sha256Hex $utf8.GetBytes("$Run-metadata-$($index + 1)")
      }
    }
  }
  $audit = [ordered]@{
    schemaVersion = 2
    run = $Run
    outcome = $Outcome
    lastCompletedTask = $LastCompletedTask
    runStartedAtUtc = if ($Outcome -ceq 'ABORTED' -and
        ($null -eq $LastCompletedTask -or $LastCompletedTask -ceq 'T00')) {
      $null
    } else { "2026-01-${day}T00:00:00.000000Z" }
    runEndedAtUtc = "2026-01-${day}T00:01:00.000000Z"
    tenantId = $tenantId
    accountantUserId = $accountantId
    reviewerUserId = $reviewerId
    slots = $slots
    expectedBusinessEventCount = 15
    missingExpectedBusinessEventCount = $MissingSlots.Count
    unexpectedBusinessEventCount = $UnexpectedBusinessEventCount
  }
  $mappings = @()
  for ($index = 0; $index -lt 7; $index += 1) {
    $mappings += [pscustomobject][ordered]@{
      id = $mappingIds[$index]
      closingFolderId = $closingId
      accountCode = $accounts[$index]
      targetCode = $targets[$index]
      createdByUserId = $accountantId
      updatedByUserId = $accountantId
    }
  }
  $business = [ordered]@{
    schemaVersion = 2
    run = $Run
    outcome = $Outcome
    lastCompletedTask = $LastCompletedTask
    tenantId = $tenantId
    accountantUserId = $accountantId
    reviewerUserId = $reviewerId
    closingFolder = [ordered]@{
      id = $closingId
      name = "Demo Closing FY2025 043c $Run internal rehearsal (synthetic)"
      periodStartOn = '2025-01-01'
      periodEndOn = '2025-12-31'
      externalRef = "DEMO-043C-$Run-INTERNAL-REHEARSAL"
      status = 'DRAFT'
    }
    balanceImport = [ordered]@{
      id = $balanceId; closingFolderId = $closingId; version = 1
      fileName = 'balance-fy2025-v1.csv'; rowCount = 7
      totalDebit = '149000.00'; totalCredit = '149000.00'
    }
    mappings = $mappings
    workpaper = [ordered]@{
      id = $workpaperId; closingFolderId = $closingId
      anchorCode = 'BS.ASSET.CURRENT_SECTION'
      noteText = 'Synthetic bank reconciliation FY2025.'
      status = 'REVIEWED'; reviewComment = $null
      basisImportVersion = 1; basisTaxonomyVersion = 2; evidenceCount = 0
      reviewedAtUtc = "2026-01-${day}T00:00:14.000014Z"
      reviewedByUserId = $reviewerId
    }
    document = [ordered]@{
      id = $documentId; workpaperId = $workpaperId
      anchorCode = 'BS.ASSET.CURRENT_SECTION'
      fileName = 'evidence-bank-reconciliation-fy2025-v1.csv'
      mediaType = 'text/csv'; byteSize = 184
      checksumSha256 = 'f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27'
      sourceLabel = 'Ritomer internal synthetic fixture 043'
      documentDate = '2025-12-31'; storageBackend = 'LOCAL_FS'
      verificationStatus = 'VERIFIED'
      reviewComment = $null
      reviewedAtUtc = "2026-01-${day}T00:00:13.000013Z"
      reviewedByUserId = $reviewerId
    }
    exportPack = [ordered]@{
      id = $exportId; closingFolderId = $closingId
      idempotencyKeySha256 = Get-Sha256Hex $utf8.GetBytes("$Run-export-idempotency")
      storageObjectKeySha256 = Get-Sha256Hex $utf8.GetBytes("$Run-export-storage")
      sourceFingerprint = Get-Sha256Hex $utf8.GetBytes("$Run-export-source")
      storageBackend = 'LOCAL_FS'
      fileName = "closing-folder-$closingId-export-pack-$exportId.zip"
      mediaType = 'application/zip'; byteSize = 4096
      checksumSha256 = Get-Sha256Hex $utf8.GetBytes("$Run-export-content")
      basisImportVersion = 1; basisTaxonomyVersion = 2
      createdAtUtc = "2026-01-${day}T00:00:15.000015Z"
      createdByUserId = $accountantId
    }
    minimalAnnexVerified = $true
    usefulnessAssessmentCompleted = $true
  }
  if ($Outcome -ceq 'ABORTED') {
    $business.minimalAnnexVerified = $false
    $business.usefulnessAssessmentCompleted = $false
    if ($null -eq $LastCompletedTask -or $LastCompletedTask -ceq 'T00') {
      $business.closingFolder = $null
      $business.balanceImport = $null
      $business.mappings = @()
      $business.workpaper = $null
      $business.document = $null
      $business.exportPack = $null
    } elseif ($LastCompletedTask -cne 'T14') {
      $business.exportPack = $null
    }
  }
  return [pscustomobject]@{
    AuditBytes = ConvertTo-C043CBytes $audit
    BusinessBytes = ConvertTo-C043CBytes $business
  }
}

function ConvertTo-SyntheticLedgerBytes {
  param(
    [object[]] $Records,
    [bool] $Rechain = $true
  )

  $allBytes = New-Object 'System.Collections.Generic.List[byte]'
  $previousBytes = $null
  for ($index = 0; $index -lt $Records.Count; $index += 1) {
    if ($Rechain) {
      if ($index -eq 0) {
        $Records[$index].previousState = $null
        $Records[$index].previousRecordSha256 = $null
      } else {
        $Records[$index].previousState = $Records[$index - 1].state
        $Records[$index].previousRecordSha256 = Get-Sha256Hex $previousBytes
      }
    }
    $lineBytes = ConvertTo-C043CBytes $Records[$index]
    foreach ($value in $lineBytes) { $allBytes.Add($value) }
    $previousBytes = $lineBytes
  }
  return ,$allBytes.ToArray()
}

function ConvertFrom-SyntheticLedgerBytes {
  param([byte[]] $LedgerBytes)

  $utf8 = New-Object System.Text.UTF8Encoding($false, $true)
  $text = $utf8.GetString($LedgerBytes)
  $lines = @($text.Substring(0, $text.Length - 1).Split("`n"))
  $records = @()
  foreach ($line in $lines) { $records += ($line | ConvertFrom-Json) }
  return ,$records
}

function New-SyntheticLedgerPreimage {
  param(
    [pscustomobject] $BindingR1,
    [byte[]] $R1EvidenceBytes,
    [byte[]] $R2EvidenceBytes,
    [ValidateSet('COMPLETED', 'ABORTED')]
    [string] $R1Outcome,
    [ValidateSet('COMPLETED', 'ABORTED')]
    [string] $R2Outcome
  )

  $r1FileHash = Get-Sha256Hex $R1EvidenceBytes
  $r2FileHash = Get-Sha256Hex $R2EvidenceBytes
  $indexBytes = [System.Text.Encoding]::ASCII.GetBytes(
    "R1=$r1FileHash`nR2=$r2FileHash`n"
  )
  $records = @()
  for ($index = 0; $index -lt 8; $index += 1) {
    $authorizations = [ordered]@{}
    foreach ($key in $script:AuthorizationFlagKeys) {
      $authorizations[$key] = $false
    }
    $records += [pscustomobject][ordered]@{
      schemaVersion = 2
      ledgerId = $script:LedgerId
      sequence = $index
      decisionId = $script:LedgerDecisionIds[$index]
      state = $script:LedgerStates[$index]
      previousState = $null
      previousRecordSha256 = $null
      recordedAtUtc = ("2026-01-03T00:00:{0:D2}.000Z" -f $index)
      authorityOccurredAtUtc = ("2026-01-03T00:00:{0:D2}.000Z" -f $index)
      recordedByRole = $script:LedgerRoles[$index]
      authorityType = $script:LedgerAuthorityTypes[$index]
      authorityRef = $script:LedgerAuthorityRefs[$index]
      incidentId = '043c-v1-pr107-freeze-linearity-incident'
      incidentSha256 = '1419edb3f46c1472f7333b0a8970fb3897f5f534693229ce123dc9b53eb9ea8b'
      protocolId = if ($index -ge 2) { $BindingR1.protocolId } else { $null }
      protocolSha256 = if ($index -ge 2) {
        $BindingR1.protocolSha256
      } else { $null }
      qualificationSha256 = if ($index -ge 5) {
        $BindingR1.qualificationSha256
      } else { $null }
      frozenCommit = if ($index -ge 5) { $BindingR1.frozenCommit } else { $null }
      completedRun = if ($index -eq 6) {
        if ($R1Outcome -ceq 'COMPLETED') { 'R1' } else { $null }
      } elseif ($index -eq 7) {
        if ($R2Outcome -ceq 'COMPLETED') { 'R2' } else { 'R1' }
      } else { $null }
      evidenceSha256 = if ($index -eq 6) {
        $r1FileHash
      } elseif ($index -eq 7) {
        Get-Sha256Hex $indexBytes
      } else { $null }
      cpoOutcome = $null
      reviewRefs = if ($index -ge 3) { $BindingR1.reviewRefs } else { $null }
      authorizations = [pscustomobject] $authorizations
    }
  }
  $ledgerD6Bytes = ConvertTo-SyntheticLedgerBytes @($records[0..6]) $true
  $ledgerD7Bytes = if ($R1Outcome -ceq 'COMPLETED') {
    ConvertTo-SyntheticLedgerBytes $records $true
  } else { $null }
  return [pscustomobject]@{
    LedgerD6Bytes = $ledgerD6Bytes
    LedgerD7Bytes = $ledgerD7Bytes
    R1FileHash = $r1FileHash
    R2FileHash = $r2FileHash
  }
}

function New-SyntheticEvidenceChain {
  param(
    [pscustomobject] $QualificationRecord,
    [pscustomobject] $BindingR1,
    [pscustomobject] $BindingR2,
    [pscustomobject] $ProjectionR1,
    [pscustomobject] $ProjectionR2
  )

  $qualificationBytes = ConvertTo-C043CBytes $QualificationRecord
  $qualificationHash = Get-Sha256Hex $qualificationBytes
  $qualifiedBindingR1 = $BindingR1.PSObject.Copy()
  $qualifiedBindingR1.qualificationSha256 = $qualificationHash
  $qualifiedBindingR2 = $BindingR2.PSObject.Copy()
  $qualifiedBindingR2.qualificationSha256 = $qualificationHash
  $r1Audit = Convert-ArtifactRecord $ProjectionR1.AuditBytes
  $r2Audit = Convert-ArtifactRecord $ProjectionR2.AuditBytes
  $r1AbortReason = if ($r1Audit.outcome -ceq 'ABORTED') { 'HARD_STOP' } else {
    $null
  }
  $r2AbortReason = if ($r2Audit.outcome -ceq 'ABORTED') { 'HARD_STOP' } else {
    $null
  }
  $r1EvidenceBytes = New-SyntheticEvidenceBytes -Run R1 `
    -Binding $qualifiedBindingR1 `
    -AuditHash (Get-Sha256Hex $ProjectionR1.AuditBytes) `
    -BusinessHash (Get-Sha256Hex $ProjectionR1.BusinessBytes) `
    -QualificationHash $qualificationHash -Outcome $r1Audit.outcome `
    -LastCompletedTask $r1Audit.lastCompletedTask `
    -AbortReasonCode $r1AbortReason `
    -MissingExpectedBusinessEventCount $r1Audit.missingExpectedBusinessEventCount `
    -UnexpectedBusinessEventCount $r1Audit.unexpectedBusinessEventCount
  $r2EvidenceBytes = New-SyntheticEvidenceBytes -Run R2 `
    -Binding $qualifiedBindingR2 `
    -AuditHash (Get-Sha256Hex $ProjectionR2.AuditBytes) `
    -BusinessHash (Get-Sha256Hex $ProjectionR2.BusinessBytes) `
    -QualificationHash $qualificationHash -Outcome $r2Audit.outcome `
    -LastCompletedTask $r2Audit.lastCompletedTask `
    -AbortReasonCode $r2AbortReason `
    -MissingExpectedBusinessEventCount $r2Audit.missingExpectedBusinessEventCount `
    -UnexpectedBusinessEventCount $r2Audit.unexpectedBusinessEventCount
  $r1FileHash = Get-Sha256Hex $r1EvidenceBytes
  $r2FileHash = Get-Sha256Hex $r2EvidenceBytes
  $ledger = New-SyntheticLedgerPreimage $qualifiedBindingR1 $r1EvidenceBytes `
    $r2EvidenceBytes $r1Audit.outcome $r2Audit.outcome
  return [pscustomobject]@{
    QualificationBytes = $qualificationBytes
    QualificationHash = $qualificationHash
    BindingR1 = $qualifiedBindingR1
    BindingR2 = $qualifiedBindingR2
    R1EvidenceBytes = $r1EvidenceBytes
    R2EvidenceBytes = $r2EvidenceBytes
    R1FileHash = $r1FileHash
    R2FileHash = $r2FileHash
    LedgerD6Bytes = $ledger.LedgerD6Bytes
    LedgerD7Bytes = $ledger.LedgerD7Bytes
  }
}

function Invoke-SelfTest {
  $succeeded = New-Object 'System.Collections.Generic.List[string]'
  $failed = New-Object 'System.Collections.Generic.List[string]'
  $utf8 = New-Object System.Text.UTF8Encoding($false, $true)

  $safePath = [pscustomobject]@{
    DriveType = 'Fixed'; IsAbsoluteWindowsPath = $true; IsUnc = $false
    IsDevicePath = $false; IsMappedDrive = $false; HasReparsePoint = $false
    FinalPathMatches = $true; ParentChainConfined = $true
    ParentIdentityStable = $true; FileIdentityStable = $true
    ReadHandleOnly = $true
  }
  $unsafePath = $safePath.PSObject.Copy()
  $unsafePath.IsUnc = $true
  Add-Probe $succeeded $failed '043C2-I13' `
    ((Test-PathModel $safePath) -and (-not (Test-PathModel $unsafePath)))

  $bindingR1 = [pscustomobject]@{
    run = 'R1'; protocolId = $script:ProtocolId
    protocolSha256 = ('a' * 64); frozenCommit = ('a' * 40)
    qualificationSha256 = ('b' * 64)
    resourceTargetSha256 = $script:R1ResourceTargetSha256
  }
  $bindingR2 = [pscustomobject]@{
    run = 'R2'; protocolId = $script:ProtocolId
    protocolSha256 = ('a' * 64); frozenCommit = ('a' * 40)
    qualificationSha256 = ('b' * 64)
    resourceTargetSha256 = $script:R2ResourceTargetSha256
  }
  $authorizationRecord = [ordered]@{
    schemaVersion = 2; run = 'R1'; decision = 'R1_ONLY'
    authorizedAtUtc = '2026-01-01T00:00:00.000Z'
    authorityRef = '043c-v2-r1-only-authority'
    protocolId = $bindingR1.protocolId
    protocolSha256 = $bindingR1.protocolSha256
    frozenCommit = $bindingR1.frozenCommit
    qualificationSha256 = $bindingR1.qualificationSha256
    resourceTargetSha256 = $bindingR1.resourceTargetSha256
  }
  $authorizationR2Record = [ordered]@{
    schemaVersion = 2; run = 'R2'; decision = 'R2_ONLY'
    authorizedAtUtc = '2026-01-01T00:00:00.000Z'
    authorityRef = '043c-v2-r2-only-authority'
    protocolId = $bindingR2.protocolId
    protocolSha256 = $bindingR2.protocolSha256
    frozenCommit = $bindingR2.frozenCommit
    qualificationSha256 = $bindingR2.qualificationSha256
    resourceTargetSha256 = $bindingR2.resourceTargetSha256
  }
  $authorizationBytes = ConvertTo-C043CBytes $authorizationRecord
  $authorizationR2Bytes = ConvertTo-C043CBytes $authorizationR2Record
  $authorizationObject = Convert-ArtifactRecord $authorizationBytes
  $authorizationR2Object = Convert-ArtifactRecord $authorizationR2Bytes
  $activeStateRecord = [ordered]@{
    schemaVersion = 2; state = 'R1_ONLY_AUTHORIZED_NOT_STARTED'; run = 'R1'
    recordedAtUtc = '2026-01-01T00:00:01.000Z'
    authorityRef = $authorizationRecord.authorityRef
    protocolId = $bindingR1.protocolId
    protocolSha256 = $bindingR1.protocolSha256
    frozenCommit = $bindingR1.frozenCommit
    qualificationSha256 = $bindingR1.qualificationSha256
    resourceTargetSha256 = $bindingR1.resourceTargetSha256
  }
  $activeStateBytes = ConvertTo-C043CBytes $activeStateRecord
  $evidenceR1ForSchema = New-SyntheticEvidenceBytes R1 $bindingR1 ('c' * 64) `
    ('d' * 64) $bindingR1.qualificationSha256
  $evidenceR2ForSchema = New-SyntheticEvidenceBytes R2 $bindingR2 ('c' * 64) `
    ('d' * 64) $bindingR2.qualificationSha256
  $authorizationText = $utf8.GetString($authorizationBytes)
  $reorderedBytes = $utf8.GetBytes($authorizationText.Replace(
    '{"schemaVersion":2,"run":"R1",',
    '{"run":"R1","schemaVersion":2,'
  ))
  $duplicateBytes = $utf8.GetBytes($authorizationText.Replace(
    '{"schemaVersion":2,',
    '{"schemaVersion":2,"schemaVersion":2,'
  ))
  $whitespaceBytes = $utf8.GetBytes($authorizationText.Replace(',"run"', ', "run"'))
  $oversize = [byte[]]::new(65537)
  $authorizationSnapshot = [pscustomobject]@{
    RelativePath = $script:RuntimeArtifactRelativePaths.Authorization
    Bytes = $authorizationBytes
    BeforeLength = $authorizationBytes.Length
    AfterLength = $authorizationBytes.Length
    BeforeIdentity = 'synthetic-authorization-identity'
    AfterIdentity = 'synthetic-authorization-identity'
    BeforeFinalPath = 'C:\Synthetic\authorization.json'
    AfterFinalPath = 'C:\Synthetic\authorization.json'
  }
  $activeStateSnapshot = [pscustomobject]@{
    RelativePath = $script:RuntimeArtifactRelativePaths.ActiveState
    Bytes = $activeStateBytes
    BeforeLength = $activeStateBytes.Length
    AfterLength = $activeStateBytes.Length
    BeforeIdentity = 'synthetic-active-state-identity'
    AfterIdentity = 'synthetic-active-state-identity'
    BeforeFinalPath = 'C:\Synthetic\state\active-state.json'
    AfterFinalPath = 'C:\Synthetic\state\active-state.json'
  }
  $authorityBundleResult = Invoke-RuntimeAuthorityBundleValidation `
    $authorizationSnapshot $activeStateSnapshot $bindingR1 `
    'R1_ONLY_AUTHORIZED_NOT_STARTED'
  $racedStateSnapshot = $activeStateSnapshot.PSObject.Copy()
  $racedStateSnapshot.AfterLength += 1
  $raceResult = Invoke-RuntimeAuthorityBundleValidation `
    $authorizationSnapshot $racedStateSnapshot $bindingR1 `
    'R1_ONLY_AUTHORIZED_NOT_STARTED'
  $bindingMismatchResult = Invoke-RuntimeAuthorityBundleValidation `
    $authorizationSnapshot $activeStateSnapshot $bindingR2 `
    'R1_ONLY_AUTHORIZED_NOT_STARTED'
  $stateMismatchResult = Invoke-RuntimeAuthorityBundleValidation `
    $authorizationSnapshot $activeStateSnapshot $bindingR1 `
    'R1_STARTED_CLEANUP_NOT_VALIDATED'
  $p0Authorizations = [ordered]@{}
  foreach ($key in $script:AuthorizationFlagKeys) {
    $p0Authorizations[$key] = $false
  }
  $p0Scope = [pscustomobject]@{
    DurableState = $script:P0DurableState
    Authorizations = [pscustomobject] $p0Authorizations
    FallbackV1 = $false
    LocalApplicationDataAccessed = $false
    ExternalIoPerformed = $false
    StateWritePerformed = $false
  }
  $badP0Authorizations = [ordered]@{}
  foreach ($key in $script:AuthorizationFlagKeys) {
    $badP0Authorizations[$key] = $p0Scope.Authorizations.PSObject.Properties[$key].Value
  }
  $badP0Authorizations.v2ExecutionAuthorized = $true
  $badP0Scope = $p0Scope.PSObject.Copy()
  $badP0Scope.Authorizations = [pscustomobject] $badP0Authorizations
  Add-Probe $succeeded $failed '043C2-I14' `
    ((Test-CoreSuccessContract $authorityBundleResult) -and
      (Test-CoreFailureContract $raceResult 'E_PATH_RACE' 4) -and
      (Test-CoreFailureContract $bindingMismatchResult 'E_JSON_BINDING' 4) -and
      (Test-CoreFailureContract $stateMismatchResult 'E_JSON_BINDING' 4) -and
      (Test-P0AuthorityScope $p0Scope) -and
      (-not (Test-P0AuthorityScope $badP0Scope)) -and
      (Test-RuntimeArtifact $evidenceR1ForSchema Evidence $authorizationObject $true $true $true) -and
      (Test-RuntimeArtifact $evidenceR2ForSchema Evidence $authorizationR2Object $true $true $true) -and
      (Test-ArtifactSizeAllowed 65536) -and (-not (Test-ArtifactSizeAllowed 65537)) -and
      (-not (Test-RuntimeArtifact $oversize Authorization $bindingR1 $true $true $true)) -and
      (-not (Test-RuntimeArtifact $authorizationBytes Authorization $bindingR1 $false $true $true)) -and
      (-not (Test-RuntimeArtifact $reorderedBytes Authorization $bindingR1 $true $true $true)) -and
      (-not (Test-RuntimeArtifact $duplicateBytes Authorization $bindingR1 $true $true $true)) -and
      (-not (Test-RuntimeArtifact $whitespaceBytes Authorization $bindingR1 $true $true $true)) -and
      (-not (Test-RuntimeArtifact $authorizationBytes Authorization $bindingR2 $true $true $true)))

  $reviewRefs = [ordered]@{
    p0ReviewedHead = ('1' * 40); p0ReviewedTree = ('2' * 40)
    cpoPostCodeReviewRef = ('043c-v2-p0-cpo-post-code-review-pass-' + ('1' * 40))
    aiTechnicalReviewRef = ('043c-v2-p0-ai-technical-review-pass-' + ('1' * 40))
    aiSecurityPrivacyReviewRef = ('043c-v2-p0-ai-security-privacy-review-pass-' + ('1' * 40))
    ctoTechnicalGateRef = ('043c-v2-p0-cto-technical-gate-pass-' + ('1' * 40))
    cpoPreMergeReviewRef = ('043c-v2-p0-cpo-pre-merge-review-pass-' + ('1' * 40))
    p0MergeCommit = ('3' * 40); p0MergeTree = ('2' * 40)
  }
  $bindingR1 | Add-Member -MemberType NoteProperty -Name reviewRefs `
    -Value ([pscustomobject] $reviewRefs)
  $bindingR2 | Add-Member -MemberType NoteProperty -Name reviewRefs `
    -Value ([pscustomobject] $reviewRefs)
  $qualificationEntries = @()
  for ($index = 0; $index -lt 7; $index += 1) {
    $qualificationEntries += [pscustomobject][ordered]@{
      qId = $script:QualificationIds[$index]; qClosed = $true; nominal = 'PASS'
      nominalSha256 = ('a' * 64); mutant = 'REJECTED'; mutantSha256 = ('b' * 64)
      errorCode = $script:QualificationErrorCodes[$index]
      reviewRef = ('043c-v2-' + $script:QualificationIds[$index].ToLowerInvariant() + '-review-pass')
    }
  }
  $qualificationManifest = [ordered]@{
    schemaVersion = 2; qualificationId = '043c-v2-q1-q7-qualification'
    ledgerId = $script:LedgerId
    incidentId = '043c-v1-pr107-freeze-linearity-incident'
    incidentSha256 = '1419edb3f46c1472f7333b0a8970fb3897f5f534693229ce123dc9b53eb9ea8b'
    protocolId = $script:ProtocolId; protocolSha256 = ('a' * 64)
    frozenCommit = ('a' * 40); reviewRefs = [pscustomobject] $reviewRefs
    qClosed = $true; qualifications = $qualificationEntries
    qualifiedAtUtc = '2026-01-01T00:00:00.000Z'
    qualifiedByRole = 'RECOVERY_COORDINATOR_043C'
  }
  $projectionR1 = New-SyntheticProjectionSet R1
  $projectionR2 = New-SyntheticProjectionSet R2
  $nominalChain = New-SyntheticEvidenceChain `
    ([pscustomobject] $qualificationManifest) $bindingR1 $bindingR2 `
    $projectionR1 $projectionR2
  $qualificationBytes = $nominalChain.QualificationBytes
  $qualificationHash = $nominalChain.QualificationHash
  $qualifiedBindingR1 = $nominalChain.BindingR1
  $qualifiedBindingR2 = $nominalChain.BindingR2
  $r1EvidenceBytes = $nominalChain.R1EvidenceBytes
  $r2EvidenceBytes = $nominalChain.R2EvidenceBytes
  $r1FileHash = $nominalChain.R1FileHash
  $r2FileHash = $nominalChain.R2FileHash
  $ledgerD6Bytes = $nominalChain.LedgerD6Bytes
  $ledgerD7Bytes = $nominalChain.LedgerD7Bytes
  $auditHash = Get-Sha256Hex $projectionR1.AuditBytes
  $businessHash = Get-Sha256Hex $projectionR1.BusinessBytes
  $completeEvidenceResult = Invoke-CompleteEvidenceValidation `
    $qualificationBytes $projectionR1.AuditBytes $projectionR1.BusinessBytes `
    $projectionR2.AuditBytes $projectionR2.BusinessBytes $r1EvidenceBytes `
    $r2EvidenceBytes $qualifiedBindingR1 $qualifiedBindingR2 $ledgerD7Bytes
  $unboundValueBinding = $qualifiedBindingR1.PSObject.Copy()
  $unboundValueBinding.protocolId = '043c-internal-rehearsal-v2-unbound'
  $unboundValueResult = Invoke-CompleteEvidenceValidation `
    $qualificationBytes $projectionR1.AuditBytes $projectionR1.BusinessBytes `
    $projectionR2.AuditBytes $projectionR2.BusinessBytes $r1EvidenceBytes `
    $r2EvidenceBytes $unboundValueBinding $qualifiedBindingR2 $ledgerD7Bytes
  $unboundHashBinding = $qualifiedBindingR1.PSObject.Copy()
  $unboundHashBinding.protocolSha256 = ('0' * 64)
  $unboundHashResult = Invoke-CompleteEvidenceValidation `
    $qualificationBytes $projectionR1.AuditBytes $projectionR1.BusinessBytes `
    $projectionR2.AuditBytes $projectionR2.BusinessBytes $r1EvidenceBytes `
    $r2EvidenceBytes $unboundHashBinding $qualifiedBindingR2 $ledgerD7Bytes
  $invalidAuditRecord = Convert-ArtifactRecord $projectionR1.AuditBytes
  $invalidAuditRecord.slots[0].action = 'CLOSING_FOLDER.UPDATED'
  $invalidAuditProjection = [pscustomobject]@{
    AuditBytes = ConvertTo-C043CBytes $invalidAuditRecord
    BusinessBytes = $projectionR1.BusinessBytes
  }
  $invalidAuditChain = New-SyntheticEvidenceChain `
    ([pscustomobject] $qualificationManifest) $bindingR1 $bindingR2 `
    $invalidAuditProjection $projectionR2
  $invalidAuditResult = Invoke-CompleteEvidenceValidation `
    $invalidAuditChain.QualificationBytes $invalidAuditProjection.AuditBytes `
    $invalidAuditProjection.BusinessBytes $projectionR2.AuditBytes `
    $projectionR2.BusinessBytes $invalidAuditChain.R1EvidenceBytes `
    $invalidAuditChain.R2EvidenceBytes $invalidAuditChain.BindingR1 `
    $invalidAuditChain.BindingR2 $invalidAuditChain.LedgerD7Bytes
  $invalidBusinessRecord = Convert-ArtifactRecord $projectionR1.BusinessBytes
  $invalidBusinessRecord.closingFolder.name = 'Unbound synthetic closing'
  $invalidBusinessProjection = [pscustomobject]@{
    AuditBytes = $projectionR1.AuditBytes
    BusinessBytes = ConvertTo-C043CBytes $invalidBusinessRecord
  }
  $invalidBusinessChain = New-SyntheticEvidenceChain `
    ([pscustomobject] $qualificationManifest) $bindingR1 $bindingR2 `
    $invalidBusinessProjection $projectionR2
  $invalidBusinessResult = Invoke-CompleteEvidenceValidation `
    $invalidBusinessChain.QualificationBytes $invalidBusinessProjection.AuditBytes `
    $invalidBusinessProjection.BusinessBytes $projectionR2.AuditBytes `
    $projectionR2.BusinessBytes $invalidBusinessChain.R1EvidenceBytes `
    $invalidBusinessChain.R2EvidenceBytes $invalidBusinessChain.BindingR1 `
    $invalidBusinessChain.BindingR2 $invalidBusinessChain.LedgerD7Bytes
  $r1EvidenceText = $utf8.GetString($r1EvidenceBytes)
  $reorderedEvidenceBytes = $utf8.GetBytes($r1EvidenceText.Replace(
    '{"schemaVersion":2,"run":"R1",',
    '{"run":"R1","schemaVersion":2,'
  ))
  $reorderedArtifactResult = Invoke-CompleteEvidenceValidation `
    $qualificationBytes $projectionR1.AuditBytes $projectionR1.BusinessBytes `
    $projectionR2.AuditBytes $projectionR2.BusinessBytes $reorderedEvidenceBytes `
    $r2EvidenceBytes $qualifiedBindingR1 $qualifiedBindingR2 $ledgerD7Bytes
  $contentMutantRecord = Convert-ArtifactRecord $r1EvidenceBytes
  $contentMutantRecord.evidenceContentSha256 = ('0' * 64)
  $contentMutantBytes = ConvertTo-C043CBytes $contentMutantRecord
  $contentHashResult = Invoke-CompleteEvidenceValidation `
    $qualificationBytes $projectionR1.AuditBytes $projectionR1.BusinessBytes `
    $projectionR2.AuditBytes $projectionR2.BusinessBytes $contentMutantBytes `
    $r2EvidenceBytes $qualifiedBindingR1 $qualifiedBindingR2 $ledgerD7Bytes
  $reconstructedRecords = ConvertFrom-SyntheticLedgerBytes $ledgerD7Bytes
  $reconstructedRecords[7].evidenceSha256 = Get-Sha256Hex `
    ([System.Text.Encoding]::ASCII.GetBytes("R2=$r2FileHash`n"))
  $freelyReconstructedLedger = ConvertTo-SyntheticLedgerBytes `
    $reconstructedRecords $true
  $freelyReconstructedResult = Invoke-CompleteEvidenceValidation `
    $qualificationBytes $projectionR1.AuditBytes $projectionR1.BusinessBytes `
    $projectionR2.AuditBytes $projectionR2.BusinessBytes $r1EvidenceBytes `
    $r2EvidenceBytes $qualifiedBindingR1 $qualifiedBindingR2 `
    $freelyReconstructedLedger
  $ledgerIdRecords = ConvertFrom-SyntheticLedgerBytes $ledgerD7Bytes
  foreach ($record in $ledgerIdRecords) { $record.ledgerId = 'attacker-ledger' }
  $ledgerIdMutantBytes = ConvertTo-SyntheticLedgerBytes $ledgerIdRecords $true
  $ledgerIdResult = Invoke-CompleteEvidenceValidation `
    $qualificationBytes $projectionR1.AuditBytes $projectionR1.BusinessBytes `
    $projectionR2.AuditBytes $projectionR2.BusinessBytes $r1EvidenceBytes `
    $r2EvidenceBytes $qualifiedBindingR1 $qualifiedBindingR2 $ledgerIdMutantBytes
  $decisionRecords = ConvertFrom-SyntheticLedgerBytes $ledgerD7Bytes
  $decisionRecords[7].decisionId = 'F1'
  $decisionMutantBytes = ConvertTo-SyntheticLedgerBytes $decisionRecords $true
  $decisionResult = Invoke-CompleteEvidenceValidation `
    $qualificationBytes $projectionR1.AuditBytes $projectionR1.BusinessBytes `
    $projectionR2.AuditBytes $projectionR2.BusinessBytes $r1EvidenceBytes `
    $r2EvidenceBytes $qualifiedBindingR1 $qualifiedBindingR2 $decisionMutantBytes
  $previousHashRecords = ConvertFrom-SyntheticLedgerBytes $ledgerD7Bytes
  $previousHashRecords[4].previousRecordSha256 = ('0' * 64)
  $previousHashMutantBytes = ConvertTo-SyntheticLedgerBytes `
    $previousHashRecords $false
  $previousHashResult = Invoke-CompleteEvidenceValidation `
    $qualificationBytes $projectionR1.AuditBytes $projectionR1.BusinessBytes `
    $projectionR2.AuditBytes $projectionR2.BusinessBytes $r1EvidenceBytes `
    $r2EvidenceBytes $qualifiedBindingR1 $qualifiedBindingR2 `
    $previousHashMutantBytes
  $orderRecords = ConvertFrom-SyntheticLedgerBytes $ledgerD7Bytes
  $reorderedD6 = [ordered]@{
    ledgerId = $orderRecords[6].ledgerId
    schemaVersion = $orderRecords[6].schemaVersion
  }
  foreach ($key in $script:LedgerRecordKeys) {
    if ($key -cne 'ledgerId' -and $key -cne 'schemaVersion') {
      $reorderedD6[$key] = $orderRecords[6].PSObject.Properties[$key].Value
    }
  }
  $orderRecords[6] = [pscustomobject] $reorderedD6
  $orderMutantBytes = ConvertTo-SyntheticLedgerBytes $orderRecords $true
  $orderResult = Invoke-CompleteEvidenceValidation `
    $qualificationBytes $projectionR1.AuditBytes $projectionR1.BusinessBytes `
    $projectionR2.AuditBytes $projectionR2.BusinessBytes $r1EvidenceBytes `
    $r2EvidenceBytes $qualifiedBindingR1 $qualifiedBindingR2 $orderMutantBytes
  $extraRecords = ConvertFrom-SyntheticLedgerBytes $ledgerD7Bytes
  $extraRecords[6] | Add-Member -MemberType NoteProperty `
    -Name attackerLedger -Value 'accepted'
  $extraMutantBytes = ConvertTo-SyntheticLedgerBytes $extraRecords $true
  $extraResult = Invoke-CompleteEvidenceValidation `
    $qualificationBytes $projectionR1.AuditBytes $projectionR1.BusinessBytes `
    $projectionR2.AuditBytes $projectionR2.BusinessBytes $r1EvidenceBytes `
    $r2EvidenceBytes $qualifiedBindingR1 $qualifiedBindingR2 $extraMutantBytes
  $d6OutcomeRecords = ConvertFrom-SyntheticLedgerBytes $ledgerD7Bytes
  $d6OutcomeRecords[6].completedRun = $null
  $d6OutcomeMutantBytes = ConvertTo-SyntheticLedgerBytes $d6OutcomeRecords $true
  $d6OutcomeResult = Invoke-CompleteEvidenceValidation `
    $qualificationBytes $projectionR1.AuditBytes $projectionR1.BusinessBytes `
    $projectionR2.AuditBytes $projectionR2.BusinessBytes $r1EvidenceBytes `
    $r2EvidenceBytes $qualifiedBindingR1 $qualifiedBindingR2 `
    $d6OutcomeMutantBytes
  $abortedProjectionR2 = New-SyntheticProjectionSet -Run R2 -Outcome ABORTED `
    -LastCompletedTask T13 -MissingSlots @(15)
  $abortedR2Chain = New-SyntheticEvidenceChain `
    ([pscustomobject] $qualificationManifest) $bindingR1 $bindingR2 `
    $projectionR1 $abortedProjectionR2
  $abortedR2Result = Invoke-CompleteEvidenceValidation `
    $abortedR2Chain.QualificationBytes $projectionR1.AuditBytes `
    $projectionR1.BusinessBytes $abortedProjectionR2.AuditBytes `
    $abortedProjectionR2.BusinessBytes $abortedR2Chain.R1EvidenceBytes `
    $abortedR2Chain.R2EvidenceBytes $abortedR2Chain.BindingR1 `
    $abortedR2Chain.BindingR2 $abortedR2Chain.LedgerD7Bytes
  $arbitraryAbortedBusiness = Convert-ArtifactRecord `
    $abortedProjectionR2.BusinessBytes
  $arbitraryAbortedBusiness.closingFolder.name = 'Attacker closing'
  $arbitraryAbortedBusiness.mappings[0].targetCode = `
    'BS.ASSET.ATTACKER_CONTROLLED'
  $arbitraryAbortedProjectionR2 = [pscustomobject]@{
    AuditBytes = $abortedProjectionR2.AuditBytes
    BusinessBytes = ConvertTo-C043CBytes $arbitraryAbortedBusiness
  }
  $arbitraryAbortedChain = New-SyntheticEvidenceChain `
    ([pscustomobject] $qualificationManifest) $bindingR1 $bindingR2 `
    $projectionR1 $arbitraryAbortedProjectionR2
  $arbitraryAbortedResult = Invoke-CompleteEvidenceValidation `
    $arbitraryAbortedChain.QualificationBytes $projectionR1.AuditBytes `
    $projectionR1.BusinessBytes $arbitraryAbortedProjectionR2.AuditBytes `
    $arbitraryAbortedProjectionR2.BusinessBytes `
    $arbitraryAbortedChain.R1EvidenceBytes `
    $arbitraryAbortedChain.R2EvidenceBytes $arbitraryAbortedChain.BindingR1 `
    $arbitraryAbortedChain.BindingR2 $arbitraryAbortedChain.LedgerD7Bytes
  $abortedD7MismatchRecords = ConvertFrom-SyntheticLedgerBytes `
    $abortedR2Chain.LedgerD7Bytes
  $abortedD7MismatchRecords[7].completedRun = 'R2'
  $abortedD7MismatchBytes = ConvertTo-SyntheticLedgerBytes `
    $abortedD7MismatchRecords $true
  $abortedD7MismatchResult = Invoke-CompleteEvidenceValidation `
    $abortedR2Chain.QualificationBytes $projectionR1.AuditBytes `
    $projectionR1.BusinessBytes $abortedProjectionR2.AuditBytes `
    $abortedProjectionR2.BusinessBytes $abortedR2Chain.R1EvidenceBytes `
    $abortedR2Chain.R2EvidenceBytes $abortedR2Chain.BindingR1 `
    $abortedR2Chain.BindingR2 $abortedD7MismatchBytes
  $badCountAudit = Convert-ArtifactRecord $abortedProjectionR2.AuditBytes
  $badCountAudit.missingExpectedBusinessEventCount = 0
  $badCountProjectionR2 = [pscustomobject]@{
    AuditBytes = ConvertTo-C043CBytes $badCountAudit
    BusinessBytes = $abortedProjectionR2.BusinessBytes
  }
  $badCountChain = New-SyntheticEvidenceChain `
    ([pscustomobject] $qualificationManifest) $bindingR1 $bindingR2 `
    $projectionR1 $badCountProjectionR2
  $badCountResult = Invoke-CompleteEvidenceValidation `
    $badCountChain.QualificationBytes $projectionR1.AuditBytes `
    $projectionR1.BusinessBytes $badCountProjectionR2.AuditBytes `
    $badCountProjectionR2.BusinessBytes $badCountChain.R1EvidenceBytes `
    $badCountChain.R2EvidenceBytes $badCountChain.BindingR1 `
    $badCountChain.BindingR2 $badCountChain.LedgerD7Bytes
  $badOutcomeBusiness = Convert-ArtifactRecord `
    $abortedProjectionR2.BusinessBytes
  $badOutcomeBusiness.outcome = 'COMPLETED'
  $badOutcomeProjectionR2 = [pscustomobject]@{
    AuditBytes = $abortedProjectionR2.AuditBytes
    BusinessBytes = ConvertTo-C043CBytes $badOutcomeBusiness
  }
  $badOutcomeChain = New-SyntheticEvidenceChain `
    ([pscustomobject] $qualificationManifest) $bindingR1 $bindingR2 `
    $projectionR1 $badOutcomeProjectionR2
  $badOutcomeResult = Invoke-CompleteEvidenceValidation `
    $badOutcomeChain.QualificationBytes $projectionR1.AuditBytes `
    $projectionR1.BusinessBytes $badOutcomeProjectionR2.AuditBytes `
    $badOutcomeProjectionR2.BusinessBytes $badOutcomeChain.R1EvidenceBytes `
    $badOutcomeChain.R2EvidenceBytes $badOutcomeChain.BindingR1 `
    $badOutcomeChain.BindingR2 $badOutcomeChain.LedgerD7Bytes
  $nullStartProjectionR2 = New-SyntheticProjectionSet -Run R2 -Outcome ABORTED `
    -LastCompletedTask T00 -MissingSlots @(1..15)
  $nullStartChain = New-SyntheticEvidenceChain `
    ([pscustomobject] $qualificationManifest) $bindingR1 $bindingR2 `
    $projectionR1 $nullStartProjectionR2
  $nullStartResult = Invoke-CompleteEvidenceValidation `
    $nullStartChain.QualificationBytes $projectionR1.AuditBytes `
    $projectionR1.BusinessBytes $nullStartProjectionR2.AuditBytes `
    $nullStartProjectionR2.BusinessBytes $nullStartChain.R1EvidenceBytes `
    $nullStartChain.R2EvidenceBytes $nullStartChain.BindingR1 `
    $nullStartChain.BindingR2 $nullStartChain.LedgerD7Bytes
  $protocolQualification = Convert-ArtifactRecord $qualificationBytes
  $protocolQualification.protocolSha256 = ('0' * 64)
  $protocolChain = New-SyntheticEvidenceChain $protocolQualification `
    $bindingR1 $bindingR2 $projectionR1 $projectionR2
  $protocolQualificationResult = Invoke-CompleteEvidenceValidation `
    $protocolChain.QualificationBytes $projectionR1.AuditBytes `
    $projectionR1.BusinessBytes $projectionR2.AuditBytes `
    $projectionR2.BusinessBytes $protocolChain.R1EvidenceBytes `
    $protocolChain.R2EvidenceBytes $protocolChain.BindingR1 `
    $protocolChain.BindingR2 $protocolChain.LedgerD7Bytes
  $frozenQualification = Convert-ArtifactRecord $qualificationBytes
  $frozenQualification.frozenCommit = ('b' * 40)
  $frozenChain = New-SyntheticEvidenceChain $frozenQualification `
    $bindingR1 $bindingR2 $projectionR1 $projectionR2
  $frozenQualificationResult = Invoke-CompleteEvidenceValidation `
    $frozenChain.QualificationBytes $projectionR1.AuditBytes `
    $projectionR1.BusinessBytes $projectionR2.AuditBytes `
    $projectionR2.BusinessBytes $frozenChain.R1EvidenceBytes `
    $frozenChain.R2EvidenceBytes $frozenChain.BindingR1 `
    $frozenChain.BindingR2 $frozenChain.LedgerD7Bytes
  $reviewQualification = Convert-ArtifactRecord $qualificationBytes
  $reviewQualification.reviewRefs.aiTechnicalReviewRef = `
    ('043c-v2-p0-ai-technical-review-pass-' + ('0' * 40))
  $reviewChain = New-SyntheticEvidenceChain $reviewQualification `
    $bindingR1 $bindingR2 $projectionR1 $projectionR2
  $reviewQualificationResult = Invoke-CompleteEvidenceValidation `
    $reviewChain.QualificationBytes $projectionR1.AuditBytes `
    $projectionR1.BusinessBytes $projectionR2.AuditBytes `
    $projectionR2.BusinessBytes $reviewChain.R1EvidenceBytes `
    $reviewChain.R2EvidenceBytes $reviewChain.BindingR1 `
    $reviewChain.BindingR2 $reviewChain.LedgerD7Bytes
  Add-Probe $succeeded $failed '043C2-I15' `
    ((Test-CoreSuccessContract $completeEvidenceResult) -and
      (Test-CoreFailureContract $unboundValueResult 'E_PROTOCOL_BINDING' 3) -and
      (Test-CoreFailureContract $unboundHashResult 'E_GATE_QUALIFICATION' 3) -and
      (Test-CoreFailureContract $invalidAuditResult 'E_EVIDENCE_AUDIT' 6) -and
      (Test-CoreFailureContract $invalidBusinessResult `
        'E_EVIDENCE_AUDIT' 6) -and
      (Test-CoreFailureContract $reorderedArtifactResult 'E_JSON_CANONICAL' 4) -and
      (Test-CoreFailureContract $contentHashResult 'E_EVIDENCE_CONTENT_HASH' 6) -and
      (Test-CoreFailureContract $freelyReconstructedResult 'E_LEDGER_BINDING' 3) -and
      (Test-CoreFailureContract $ledgerIdResult 'E_LEDGER_BINDING' 3) -and
      (Test-CoreFailureContract $decisionResult 'E_LEDGER_BINDING' 3) -and
      (Test-CoreFailureContract $previousHashResult 'E_LEDGER_BINDING' 3) -and
      (Test-CoreFailureContract $orderResult 'E_LEDGER_BINDING' 3) -and
      (Test-CoreFailureContract $extraResult 'E_LEDGER_BINDING' 3) -and
      (Test-CoreFailureContract $d6OutcomeResult 'E_LEDGER_BINDING' 3) -and
      (Test-CoreSuccessContract $abortedR2Result) -and
      (Test-CoreFailureContract $arbitraryAbortedResult `
        'E_EVIDENCE_AUDIT' 6) -and
      (Test-CoreFailureContract $abortedD7MismatchResult `
        'E_LEDGER_BINDING' 3) -and
      (Test-CoreFailureContract $badCountResult 'E_EVIDENCE_AUDIT' 6) -and
      (Test-CoreFailureContract $badOutcomeResult 'E_EVIDENCE_AUDIT' 6) -and
      (Test-CoreSuccessContract $nullStartResult) -and
      (Test-CoreFailureContract $protocolQualificationResult `
        'E_GATE_QUALIFICATION' 3) -and
      (Test-CoreFailureContract $frozenQualificationResult `
        'E_GATE_QUALIFICATION' 3) -and
      (Test-CoreFailureContract $reviewQualificationResult `
        'E_GATE_QUALIFICATION' 3))

  $v1Source = @'
param([ValidateSet('SelfTest','PreparationPreflight','PreR1','PostR1Cleanup','PreR2','PostR2Cleanup')][string] $Mode)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
if (-not [string]::Equals($Mode,'SelfTest',[System.StringComparison]::Ordinal)) {
  Write-Output 'errorCode=E_V1_EXTERNAL_MODE_PERMANENTLY_DISABLED'
  Write-Output 'V1_EXECUTION=PERMANENTLY_NOT_AUTHORIZED'
  Write-Output 'V2_VALIDATOR_REQUIRED=YES'
  Write-Output 'externalAccessPerformed=false'
  Write-Output 'stateWritePerformed=false'
  exit 40
}
function Invoke-ExternalMode { [void] [System.Environment]::GetFolderPath('LocalApplicationData') }
'@
  $v1SourceBytes = $utf8.GetBytes($v1Source)
  $badV1Exit = $utf8.GetBytes($v1Source.Replace('exit 40', 'exit 1'))
  $badV1Import = $utf8.GetBytes($v1Source + "`nImport-Module validate-controlled-fiduciary-pilot-043c-v2`n")
  Add-Probe $succeeded $failed '043C2-I16' `
    ((Test-V1ValidatorSourcePolicy $v1SourceBytes) -and
      (-not (Test-V1ValidatorSourcePolicy $badV1Exit)) -and
      (-not (Test-V1ValidatorSourcePolicy $badV1Import)))

  $contracts = @(
    [pscustomobject]@{ Mode='Qualification'; Run='NONE'; RequiredGate='D4'; ReadOnly=$true; WriteCount=0; GateIndex=0; ExternalReadIndex=1; P0AllowsAccess=$false },
    [pscustomobject]@{ Mode='PreparationPreflight'; Run='NONE'; RequiredGate='D5'; ReadOnly=$true; WriteCount=0; GateIndex=0; ExternalReadIndex=1; P0AllowsAccess=$false },
    [pscustomobject]@{ Mode='PreR1'; Run='R1'; RequiredGate='D5'; ReadOnly=$true; WriteCount=0; GateIndex=0; ExternalReadIndex=1; P0AllowsAccess=$false },
    [pscustomobject]@{ Mode='ValidateR1Evidence'; Run='R1'; RequiredGate='D5'; ReadOnly=$true; WriteCount=0; GateIndex=0; ExternalReadIndex=1; P0AllowsAccess=$false },
    [pscustomobject]@{ Mode='PostR1Cleanup'; Run='R1'; RequiredGate='D5'; ReadOnly=$true; WriteCount=0; GateIndex=0; ExternalReadIndex=1; P0AllowsAccess=$false },
    [pscustomobject]@{ Mode='PreR2'; Run='R2'; RequiredGate='D6'; ReadOnly=$true; WriteCount=0; GateIndex=0; ExternalReadIndex=1; P0AllowsAccess=$false },
    [pscustomobject]@{ Mode='ValidateR2Evidence'; Run='R2'; RequiredGate='D6'; ReadOnly=$true; WriteCount=0; GateIndex=0; ExternalReadIndex=1; P0AllowsAccess=$false },
    [pscustomobject]@{ Mode='PostR2Cleanup'; Run='R2'; RequiredGate='D6'; ReadOnly=$true; WriteCount=0; GateIndex=0; ExternalReadIndex=1; P0AllowsAccess=$false }
  )
  $badContracts = @($contracts | ForEach-Object { $_.PSObject.Copy() })
  $badContracts[5].ExternalReadIndex = 0
  $seenErrorCodes = New-Object 'System.Collections.Generic.List[string]'
  $errorCodeCollision = $false
  foreach ($code in $script:ErrorCodes) {
    if (Test-ContainsOrdinal $seenErrorCodes $code) {
      $errorCodeCollision = $true
    } else {
      $seenErrorCodes.Add($code)
    }
  }
  $unknownTaxonomyResult = New-CoreValidationResult 'SelfTest' `
    'E_UNCLOSED_FREE_TEXT'
  Add-Probe $succeeded $failed '043C2-I17' `
    (($script:P0DurableState -ceq '043C_V2_IMPLEMENTED_PENDING_P0_DELIVERY') -and
      (Test-GatePolicyModel $contracts) -and
      (-not (Test-GatePolicyModel $badContracts)) -and
      $script:ErrorCodes.Count -eq 39 -and (-not $errorCodeCollision) -and
      (-not (Test-ContainsOrdinal $script:ErrorCodes `
        'E_EVIDENCE_BUSINESS_STATE')) -and
      (-not (Test-ContainsOrdinal $script:ErrorCodes 'E_D7_EVIDENCE_INDEX')) -and
      (Test-CoreFailureContract $unknownTaxonomyResult 'E_INTERNAL' 7))

  $readerText = (@(
    'available=true',
    'psqlX=true',
    'noPassword=true',
    'childEnvironment=ALLOWLISTED_ONLY',
    'timeoutSeconds=10',
    'stdoutLimitBytes=65536',
    'stderrLimitBytes=65536',
    'timedOut=false',
    'exitCode=0',
    'clientMajor=17',
    'host=127.0.0.1',
    'port=5432',
    'auth=sspi',
    'role=ritomer_043c_catalog_reader',
    'login=true',
    'superuser=false',
    'createDb=false',
    'createRole=false',
    'replication=false',
    'bypassRls=false',
    'membershipCount=0',
    'writePrivilegeCount=0',
    'r1DatabaseName=ritomer_043c_r1',
    'r1DatabaseState=CATALOG_TARGET_PRESENT_POLICY_SAFE',
    'r1DatabaseOwner=ritomer_043c_r1_runner',
    'r1RoleName=ritomer_043c_r1_runner',
    'r1RoleState=PRESENT_POLICY_SAFE',
    'r1StorageRelativePath=runtime/R1/storage',
    'r1StorageState=PRESENT_EMPTY_SAFE',
    'r2DatabaseName=ritomer_043c_r2',
    'r2DatabaseState=ABSENT',
    'r2DatabaseOwner=NONE',
    'r2RoleName=ritomer_043c_r2_runner',
    'r2RoleState=ABSENT',
    'r2StorageRelativePath=runtime/R2/storage',
    'r2StorageState=ABSENT'
  ) -join "`n") + "`n"
  $readerR2Text = $readerText.Replace(
    'r1DatabaseState=CATALOG_TARGET_PRESENT_POLICY_SAFE',
    'r1DatabaseState=ABSENT'
  ).Replace(
    'r1DatabaseOwner=ritomer_043c_r1_runner',
    'r1DatabaseOwner=NONE'
  ).Replace(
    'r1RoleState=PRESENT_POLICY_SAFE',
    'r1RoleState=ABSENT'
  ).Replace(
    'r1StorageState=PRESENT_EMPTY_SAFE',
    'r1StorageState=ABSENT'
  ).Replace(
    'r2DatabaseState=ABSENT',
    'r2DatabaseState=CATALOG_TARGET_PRESENT_POLICY_SAFE'
  ).Replace(
    'r2DatabaseOwner=NONE',
    'r2DatabaseOwner=ritomer_043c_r2_runner'
  ).Replace(
    'r2RoleState=ABSENT',
    'r2RoleState=PRESENT_POLICY_SAFE'
  ).Replace(
    'r2StorageState=ABSENT',
    'r2StorageState=PRESENT_EMPTY_SAFE'
  )
  $readerResult = Invoke-CatalogReaderValidation `
    ($utf8.GetBytes($readerText)) R1
  $readerR2Result = Invoke-CatalogReaderValidation `
    ($utf8.GetBytes($readerR2Text)) R2
  $readerUnavailableResult = Invoke-CatalogReaderValidation `
    ($utf8.GetBytes($readerText.Replace('available=true', 'available=false'))) R1
  $readerVersionResult = Invoke-CatalogReaderValidation `
    ($utf8.GetBytes($readerText.Replace('clientMajor=17', 'clientMajor=16'))) R1
  $readerTimeoutResult = Invoke-CatalogReaderValidation `
    ($utf8.GetBytes($readerText.Replace('timeoutSeconds=10', 'timeoutSeconds=9'))) R1
  $readerExitResult = Invoke-CatalogReaderValidation `
    ($utf8.GetBytes($readerText.Replace('exitCode=0', 'exitCode=1'))) R1
  $readerServerResult = Invoke-CatalogReaderValidation `
    ($utf8.GetBytes($readerText.Replace('host=127.0.0.1', 'host=localhost'))) R1
  $readerAuthResult = Invoke-CatalogReaderValidation `
    ($utf8.GetBytes($readerText.Replace('noPassword=true', 'noPassword=false'))) R1
  $readerRoleResult = Invoke-CatalogReaderValidation `
    ($utf8.GetBytes($readerText.Replace(
      'role=ritomer_043c_catalog_reader',
      'role=ritomer_043c_r1_runner'
    ))) R1
  $readerPrivilegeResult = Invoke-CatalogReaderValidation `
    ($utf8.GetBytes($readerText.Replace('membershipCount=0', 'membershipCount=1'))) R1
  $readerResourceResult = Invoke-CatalogReaderValidation `
    ($utf8.GetBytes($readerText.Replace(
      'r1DatabaseOwner=ritomer_043c_r1_runner',
      'r1DatabaseOwner=postgres'
    ))) R1
  $readerOutputLimitResult = Invoke-CatalogReaderValidation `
    ($utf8.GetBytes($readerText.Replace(
      'stdoutLimitBytes=65536',
      'stdoutLimitBytes=65535'
    ))) R1
  Add-Probe $succeeded $failed '043C2-I18' `
    ((Test-CoreSuccessContract $readerResult) -and
      (Test-CoreSuccessContract $readerR2Result) -and
      (Test-CoreFailureContract $readerUnavailableResult `
        'E_PSQL17_UNAVAILABLE' 5) -and
      (Test-CoreFailureContract $readerVersionResult 'E_PSQL17_VERSION' 5) -and
      (Test-CoreFailureContract $readerTimeoutResult 'E_PSQL_TIMEOUT' 5) -and
      (Test-CoreFailureContract $readerExitResult 'E_PSQL_EXIT' 5) -and
      (Test-CoreFailureContract $readerServerResult `
        'E_PG_SERVER_IDENTITY' 5) -and
      (Test-CoreFailureContract $readerAuthResult 'E_PG_AUTH_CHANNEL' 5) -and
      (Test-CoreFailureContract $readerRoleResult 'E_PG_READER_ROLE' 5) -and
      (Test-CoreFailureContract $readerPrivilegeResult `
        'E_PG_READER_PRIVILEGES' 5) -and
      (Test-CoreFailureContract $readerResourceResult `
        'E_PG_RESOURCE_STATE' 5) -and
      (Test-CoreFailureContract $readerOutputLimitResult `
        'E_PSQL_OUTPUT_LIMIT' 5))

  $readinessText = (@(
    ('run=' + $qualifiedBindingR1.run),
    ('protocolSha256=' + $qualifiedBindingR1.protocolSha256),
    ('frozenCommit=' + $qualifiedBindingR1.frozenCommit),
    ('resourceTargetSha256=' + $qualifiedBindingR1.resourceTargetSha256),
    'flywayVersions=V1-V10',
    'expectedTablesExact=true',
    'syntheticTenantCount=1',
    'userCount=2',
    'accountantMembershipCount=1',
    'reviewerMembershipCount=1',
    'businessRowCount=0',
    'auditRowCount=0',
    'storageState=PRESENT_EMPTY_SAFE',
    'otherRunState=ABSENT'
  ) -join "`n") + "`n"
  $readinessR2Text = (@(
    ('run=' + $qualifiedBindingR2.run),
    ('protocolSha256=' + $qualifiedBindingR2.protocolSha256),
    ('frozenCommit=' + $qualifiedBindingR2.frozenCommit),
    ('resourceTargetSha256=' + $qualifiedBindingR2.resourceTargetSha256),
    'flywayVersions=V1-V10',
    'expectedTablesExact=true',
    'syntheticTenantCount=1',
    'userCount=2',
    'accountantMembershipCount=1',
    'reviewerMembershipCount=1',
    'businessRowCount=0',
    'auditRowCount=0',
    'storageState=PRESENT_EMPTY_SAFE',
    'otherRunState=ABSENT'
  ) -join "`n") + "`n"
  $readinessBytes = $utf8.GetBytes($readinessText)
  $readinessResult = Invoke-ApplicationReadinessValidation `
    $readinessBytes $qualifiedBindingR1
  $readinessR2Result = Invoke-ApplicationReadinessValidation `
    ($utf8.GetBytes($readinessR2Text)) $qualifiedBindingR2
  $partialReadinessResult = Invoke-ApplicationReadinessValidation `
    ($utf8.GetBytes($readinessText.Replace(
      'flywayVersions=V1-V10',
      'flywayVersions=V1-V9'
    ))) $qualifiedBindingR1
  $unsafeStorageResult = Invoke-ApplicationReadinessValidation `
    ($utf8.GetBytes($readinessText.Replace(
      'storageState=PRESENT_EMPTY_SAFE',
      'storageState=PRESENT_NOT_EMPTY'
    ))) $qualifiedBindingR1
  $readinessReplayResult = Invoke-ApplicationReadinessValidation `
    $readinessBytes $qualifiedBindingR2
  $readinessProtocolResult = Invoke-ApplicationReadinessValidation `
    ($utf8.GetBytes($readinessText.Replace(
      ('protocolSha256=' + $qualifiedBindingR1.protocolSha256),
      ('protocolSha256=' + ('0' * 64))
    ))) $qualifiedBindingR1
  $readinessResourceResult = Invoke-ApplicationReadinessValidation `
    ($utf8.GetBytes($readinessText.Replace(
      ('resourceTargetSha256=' + $qualifiedBindingR1.resourceTargetSha256),
      ('resourceTargetSha256=' + $qualifiedBindingR2.resourceTargetSha256)
    ))) $qualifiedBindingR1
  Add-Probe $succeeded $failed '043C2-I19' `
    ((Test-CoreSuccessContract $readinessResult) -and
      (Test-CoreSuccessContract $readinessR2Result) -and
      (Test-CoreFailureContract $partialReadinessResult `
        'E_APPLICATION_READINESS' 5) -and
      (Test-CoreFailureContract $unsafeStorageResult `
        'E_APPLICATION_READINESS' 5) -and
      (Test-CoreFailureContract $readinessReplayResult `
        'E_APPLICATION_READINESS' 5) -and
      (Test-CoreFailureContract $readinessProtocolResult `
        'E_APPLICATION_READINESS' 5) -and
      (Test-CoreFailureContract $readinessResourceResult `
        'E_APPLICATION_READINESS' 5))

  $qualifiedAuthorizationRecord = [ordered]@{
    schemaVersion = 2; run = 'R1'; decision = 'R1_ONLY'
    authorizedAtUtc = '2026-01-01T00:00:00.000Z'
    authorityRef = '043c-v2-r1-only-authority'
    protocolId = $qualifiedBindingR1.protocolId
    protocolSha256 = $qualifiedBindingR1.protocolSha256
    frozenCommit = $qualifiedBindingR1.frozenCommit
    qualificationSha256 = $qualifiedBindingR1.qualificationSha256
    resourceTargetSha256 = $qualifiedBindingR1.resourceTargetSha256
  }
  $qualifiedAuthorization = Convert-ArtifactRecord `
    (ConvertTo-C043CBytes $qualifiedAuthorizationRecord)
  $cleanupActiveStateRecord = [ordered]@{
    schemaVersion = 2; state = 'R1_STARTED_CLEANUP_NOT_VALIDATED'; run = 'R1'
    recordedAtUtc = '2026-01-01T00:01:01.000Z'
    authorityRef = $qualifiedAuthorization.authorityRef
    protocolId = $qualifiedAuthorization.protocolId
    protocolSha256 = $qualifiedAuthorization.protocolSha256
    frozenCommit = $qualifiedAuthorization.frozenCommit
    qualificationSha256 = $qualifiedAuthorization.qualificationSha256
    resourceTargetSha256 = $qualifiedAuthorization.resourceTargetSha256
  }
  $cleanupActiveStateBytes = ConvertTo-C043CBytes $cleanupActiveStateRecord
  $cleanupActiveStateSnapshot = [pscustomobject]@{
    RelativePath = $script:RuntimeArtifactRelativePaths.ActiveState
    Bytes = $cleanupActiveStateBytes
    BeforeLength = $cleanupActiveStateBytes.Length
    AfterLength = $cleanupActiveStateBytes.Length
    BeforeIdentity = 'synthetic-cleanup-active-state-identity'
    AfterIdentity = 'synthetic-cleanup-active-state-identity'
    BeforeFinalPath = 'C:\Synthetic\state\active-state.json'
    AfterFinalPath = 'C:\Synthetic\state\active-state.json'
  }
  $cleanupResourceText = (@(
    'run=R1',
    'databaseName=ritomer_043c_r1',
    'databaseState=ABSENT',
    'roleName=ritomer_043c_r1_runner',
    'roleState=ABSENT',
    'storageRelativePath=runtime/R1/storage',
    'storageState=ABSENT'
  ) -join "`n") + "`n"
  $cleanupSnapshot = [pscustomobject][ordered]@{
    ActiveStateSnapshot = $cleanupActiveStateSnapshot
    ResourceAdapterBytes = $utf8.GetBytes($cleanupResourceText)
    ExternalIoPerformed = $false
    StateWritePerformed = $false
  }
  $r2PreconditionResult = Invoke-R2PreconditionValidation `
    $r1EvidenceBytes $qualifiedAuthorization $ledgerD6Bytes $cleanupSnapshot
  $abortedR1EvidenceBytes = New-SyntheticEvidenceBytes `
    -Run R1 -Binding $qualifiedAuthorization -AuditHash $auditHash `
    -BusinessHash $businessHash -QualificationHash $qualificationHash `
    -Outcome ABORTED -LastCompletedTask T13 -AbortReasonCode HARD_STOP `
    -MissingExpectedBusinessEventCount 1
  $abortedR1Ledger = New-SyntheticLedgerPreimage $qualifiedBindingR1 `
    $abortedR1EvidenceBytes $r2EvidenceBytes ABORTED COMPLETED
  $abortedR1Result = Invoke-R2PreconditionValidation `
    $abortedR1EvidenceBytes $qualifiedAuthorization `
    $abortedR1Ledger.LedgerD6Bytes $cleanupSnapshot
  $uncleanResourceSnapshot = [pscustomobject][ordered]@{
    ActiveStateSnapshot = $cleanupActiveStateSnapshot
    ResourceAdapterBytes = $utf8.GetBytes($cleanupResourceText.Replace(
      'databaseState=ABSENT',
      'databaseState=PRESENT'
    ))
    ExternalIoPerformed = $false
    StateWritePerformed = $false
  }
  $cleanupResourceResult = Invoke-R2PreconditionValidation `
    $r1EvidenceBytes $qualifiedAuthorization $ledgerD6Bytes `
    $uncleanResourceSnapshot
  $preCleanupActiveStateRecord = [ordered]@{
    schemaVersion = 2; state = 'R1_ONLY_AUTHORIZED_NOT_STARTED'; run = 'R1'
    recordedAtUtc = '2026-01-01T00:01:01.000Z'
    authorityRef = $qualifiedAuthorization.authorityRef
    protocolId = $qualifiedAuthorization.protocolId
    protocolSha256 = $qualifiedAuthorization.protocolSha256
    frozenCommit = $qualifiedAuthorization.frozenCommit
    qualificationSha256 = $qualifiedAuthorization.qualificationSha256
    resourceTargetSha256 = $qualifiedAuthorization.resourceTargetSha256
  }
  $preCleanupActiveStateBytes = ConvertTo-C043CBytes $preCleanupActiveStateRecord
  $preCleanupActiveStateSnapshot = [pscustomobject]@{
    RelativePath = $script:RuntimeArtifactRelativePaths.ActiveState
    Bytes = $preCleanupActiveStateBytes
    BeforeLength = $preCleanupActiveStateBytes.Length
    AfterLength = $preCleanupActiveStateBytes.Length
    BeforeIdentity = 'synthetic-pre-cleanup-active-state-identity'
    AfterIdentity = 'synthetic-pre-cleanup-active-state-identity'
    BeforeFinalPath = 'C:\Synthetic\state\active-state.json'
    AfterFinalPath = 'C:\Synthetic\state\active-state.json'
  }
  $preCleanupSnapshot = [pscustomobject][ordered]@{
    ActiveStateSnapshot = $preCleanupActiveStateSnapshot
    ResourceAdapterBytes = $utf8.GetBytes($cleanupResourceText)
    ExternalIoPerformed = $false
    StateWritePerformed = $false
  }
  $cleanupStateResult = Invoke-R2PreconditionValidation `
    $r1EvidenceBytes $qualifiedAuthorization $ledgerD6Bytes $preCleanupSnapshot
  $unboundD6Records = ConvertFrom-SyntheticLedgerBytes $ledgerD6Bytes
  $unboundD6Records[6].evidenceSha256 = ('0' * 64)
  $unboundD6Bytes = ConvertTo-SyntheticLedgerBytes $unboundD6Records $true
  $unboundD6Result = Invoke-R2PreconditionValidation `
    $r1EvidenceBytes $qualifiedAuthorization $unboundD6Bytes $cleanupSnapshot
  Add-Probe $succeeded $failed '043C2-I20' `
    ((Test-CoreSuccessContract $r2PreconditionResult) -and
      (Test-CoreFailureContract $abortedR1Result 'E_R1_PRECONDITION' 6) -and
      (Test-CoreFailureContract $cleanupResourceResult 'E_CLEANUP_STATE' 6) -and
      (Test-CoreFailureContract $cleanupStateResult 'E_CLEANUP_STATE' 6) -and
      (Test-CoreFailureContract $unboundD6Result 'E_LEDGER_BINDING' 3))

  return [pscustomobject]@{
    Succeeded = @($succeeded)
    Failed = @($failed)
  }
}

function Format-SuccessOutput {
  param([string[]] $InvariantIds)

  return @(
    'validator=043c-v2-state',
    'mode=SelfTest',
    'inputScope=MEMORY',
    'readOnly=true',
    'fallbackV1=false',
    'qualificationExecuted=false',
    'postgresqlAccessed=false',
    'localArtifactsAccessed=false',
    ('invariantIds=' + ($InvariantIds -join ',')),
    'summary=8/8/0',
    'errorCount=0',
    'errorCodes=NONE',
    'verdict=PASS'
  )
}

function Format-FailureOutput {
  param(
    [string] $SelectedMode,
    [string[]] $Codes
  )

  $closedCodes = New-Object 'System.Collections.Generic.List[string]'
  foreach ($code in $Codes) {
    if (-not (Test-ContainsOrdinal $script:ErrorCodes $code)) {
      $closedCodes.Clear()
      $closedCodes.Add('E_INTERNAL')
      break
    }
    if (-not (Test-ContainsOrdinal $closedCodes $code)) {
      $closedCodes.Add($code)
    }
  }
  if ($closedCodes.Count -eq 0) { $closedCodes.Add('E_INTERNAL') }
  return @(
    'validator=043c-v2-state',
    ('mode=' + $SelectedMode),
    'inputScope=MEMORY_GATE_ONLY',
    'readOnly=true',
    'fallbackV1=false',
    'qualificationExecuted=false',
    'postgresqlAccessed=false',
    'localArtifactsAccessed=false',
    ('errorCount=' + $closedCodes.Count),
    ('errorCodes=' + (@($closedCodes) -join ',')),
    'verdict=FAIL'
  )
}

$output = @()
$exitCode = 7
$cli = Read-ExactCli $script:RawCliTokens
$selectedMode = [string] $cli.Mode

if (-not $cli.Valid) {
  $output = @(Format-FailureOutput -SelectedMode $selectedMode `
    -Codes @([string] $cli.ErrorCode))
  $exitCode = Get-ClosedErrorExitCode ([string] $cli.ErrorCode)
} elseif ($selectedMode -ceq 'SelfTest') {
  try {
    $result = Invoke-SelfTest
    if ($result.Failed.Count -eq 0 -and $result.Succeeded.Count -eq 8) {
      $output = @(Format-SuccessOutput -InvariantIds $result.Succeeded)
      $exitCode = 0
    } else {
      $output = @(Format-FailureOutput -SelectedMode $selectedMode `
        -Codes @('E_INTERNAL'))
      $exitCode = 7
    }
  } catch {
    $output = @(Format-FailureOutput -SelectedMode $selectedMode `
      -Codes @('E_INTERNAL'))
    $exitCode = 7
  }
} else {
  # P0 gate: this branch precedes every environment, filesystem, Git, storage,
  # process, PostgreSQL, credential, secret, or local-artifact adapter.
  $gateCode = if ($selectedMode -ceq 'Qualification') {
    'E_GATE_QUALIFICATION'
  } else {
    'E_GATE_STATE'
  }
  $output = @(Format-FailureOutput -SelectedMode $selectedMode `
    -Codes @($gateCode))
  $exitCode = Get-ClosedErrorExitCode $gateCode
}

foreach ($line in $output) { Write-Output $line }
exit $exitCode
