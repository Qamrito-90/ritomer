param(
  [Parameter(Mandatory = $true)]
  [ValidateSet(
    'SelfTest',
    'PreparationPreflight',
    'PreR1',
    'PostR1Cleanup',
    'PreR2',
    'PostR2Cleanup'
  )]
  [string] $Mode
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$script:ProtocolId = '043c-internal-rehearsal-v1'
$script:ProtocolBegin = '<!-- 043C_PROTOCOL_V1_BEGIN -->'
$script:ProtocolEnd = '<!-- 043C_PROTOCOL_V1_END -->'
$script:LedgerBegin = '<!-- 043C_DURABLE_STATE_LEDGER_BEGIN -->'
$script:LedgerEnd = '<!-- 043C_DURABLE_STATE_LEDGER_END -->'
$script:UtcFormat = "yyyy-MM-dd'T'HH:mm:ss.fff'Z'"
$script:Hex64Pattern = '^[0-9a-f]{64}$'
$script:Git40Pattern = '^[0-9a-f]{40}$'
$script:AuthorityRefPattern = '^043c-[a-z0-9][a-z0-9-]{6,95}$'
$script:GitSpecPath = 'specs/active/043-controlled-fiduciary-pilot-readiness-v1.md'
$script:GitRunbookPath = 'runbooks/controlled-fiduciary-pilot-local-043.md'

$script:States = [ordered]@{
  S0 = '043C_PLAN_HARDENED_IMPLEMENTATION_NOT_AUTHORIZED'
  S1 = '043C_PREPARATORY_IMPLEMENTATION_AUTHORIZED'
  S2 = '043C_PREPARATORY_IMPLEMENTED_PENDING_POST_CODE_CPO'
  S3 = '043C_POST_CODE_CPO_PASS_PENDING_CTO'
  S4 = '043C_PROTOCOL_FROZEN_READY_FOR_R1_DECISION'
  S5 = 'R1_ONLY_AUTHORIZED_NOT_STARTED'
  S6 = 'R1_STARTED_CLEANUP_NOT_VALIDATED'
  S7 = 'R1_CLEANUP_VALIDATED_READY_FOR_R2_DECISION'
  S8 = 'R2_ONLY_AUTHORIZED_NOT_STARTED'
  S9 = 'R2_STARTED_CLEANUP_NOT_VALIDATED'
  S10 = 'R2_CLEANUP_VALIDATED_READY_FOR_FINAL_CPO_DECISION'
  F1 = 'GO_TO_EXTERNAL_GATE_REVIEW'
  F2 = 'NO_GO'
  F3 = 'INCONCLUSIVE'
}

$script:LedgerKeys = @(
  'schemaVersion',
  'sequence',
  'state',
  'previousState',
  'recordedAtUtc',
  'recordedByRole',
  'authorityType',
  'authorityRef',
  'protocolId',
  'protocolSha256',
  'frozenCommit',
  'r1Authorized',
  'r2Authorized',
  'completedRun',
  'evidenceSha256',
  'cpoOutcome'
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
  'resourceTargetSha256'
)

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
  'unexpectedBusinessEventCount'
)

$script:LocalArtifactIds = @(
  'AUTHORIZATION',
  'ACTIVE_STATE',
  'R1_EVIDENCE',
  'R2_EVIDENCE'
)

$script:LocalArtifactRelativePaths = [ordered]@{
  AUTHORIZATION = 'authorization.json'
  ACTIVE_STATE = 'state\active-state.json'
  R1_EVIDENCE = 'runs\R1\evidence-summary.json'
  R2_EVIDENCE = 'runs\R2\evidence-summary.json'
}

$script:SelfTestTopics = @(
  'DURABLE_SOURCE_MISSING',
  'DURABLE_SOURCE_DUPLICATED',
  'SEQUENCE_GAP',
  'SEQUENCE_DUPLICATE',
  'PREVIOUS_STATE_MISMATCH',
  'UNKNOWN_STATE',
  'DURABLE_STATE_MULTIPLE',
  'EXTRA_PROPERTY',
  'UNKNOWN_RECORDED_BY_ROLE',
  'UNKNOWN_AUTHORITY_TYPE',
  'STATE_ROLE_AUTHORITY_MISMATCH',
  'PROTOCOL_ID_MISMATCH',
  'PROTOCOL_SHA256_MISMATCH',
  'PROTOCOL_SHA256_NON_NULL_BEFORE_S2',
  'PROTOCOL_SHA256_NULL_FROM_S2',
  'FROZEN_COMMIT_MISMATCH',
  'FROZEN_COMMIT_NON_NULL_BEFORE_S4',
  'FROZEN_COMMIT_NULL_FROM_S4',
  'FROZEN_DESCENDANT_SINGLE_LEDGER_APPEND_ACCEPTED',
  'FROZEN_BACKEND_CHANGE_REJECTED',
  'FROZEN_FRONTEND_CHANGE_REJECTED',
  'FROZEN_RUNBOOK_CHANGE_REJECTED',
  'FROZEN_PROTOCOL_CHANGE_REJECTED',
  'FROZEN_PRIOR_LEDGER_MUTATION_REJECTED',
  'FROZEN_SPEC_OUTSIDE_LEDGER_REJECTED',
  'FROZEN_NON_ANCESTOR_REJECTED',
  'FROZEN_INDEX_FLAGS_REJECTED',
  'COMPLETED_RUN_INVALID',
  'F1_REQUIRES_R2',
  'F1_REQUIRES_TWO_EXACT_AUDITS',
  'R1_ABORTED_CLEANUP_REQUIRED',
  'R1_ABORTED_CLEANUP_ALLOWS_S7',
  'R1_ABORTED_BLOCKS_R2',
  'R1_ABORTED_ALLOWS_NO_GO_OR_INCONCLUSIVE',
  'R1_COMPLETE_REQUIRES_R2_ONLY',
  'R2_ABORTED_CLEANUP_ALLOWS_S10',
  'R2_ABORTED_BLOCKS_GO',
  'R2_ABORTED_ALLOWS_NO_GO_OR_INCONCLUSIVE',
  'T15_INTERRUPTED_NO_CHECKPOINT',
  'MODE_STATE_MISMATCH',
  'LOCAL_STATE_FORBIDDEN_IN_GIT',
  'RESOURCE_TARGET_FORBIDDEN_IN_LEDGER',
  'WRITE_ATTEMPT_FORBIDDEN',
  'PASS_OUTPUT_FORBIDDEN_ON_ERROR',
  'S2_TO_S3_VALID',
  'S3_TO_S4_VALID',
  'S4_TO_S7_REQUIRES_RECEIVABLE_FIELDS',
  'S7_TO_S10_REQUIRES_R2_PATH',
  'S7_TO_F2_OR_F3_VALID',
  'S7_TO_F1_REJECTED',
  'S10_TO_F1_F2_F3_RULES',
  'CATALOG_BYPASSRLS_REJECTED',
  'CATALOG_DIRECT_MEMBERSHIP_REJECTED',
  'CATALOG_PREDEFINED_MEMBERSHIP_REJECTED',
  'CATALOG_OWNER_MISMATCH_REJECTED',
  'CATALOG_PRIVILEGED_FLAG_REJECTED',
  'CATALOG_RESULT_SHAPE_INCOMPLETE_REJECTED',
  'CATALOG_NOMINAL_EXACT_ACCEPTED',
  'CLUSTER_ONLY_PROOF_BLOCKS_PRE_RUN',
  'STORAGE_CHAIN_NORMAL_ACCEPTED',
  'STORAGE_ROOT_REPARSE_REJECTED',
  'STORAGE_RITOMER_REPARSE_REJECTED',
  'STORAGE_RUNTIME_REPARSE_REJECTED',
  'STORAGE_RUN_PARENT_REPARSE_REJECTED',
  'STORAGE_TARGET_REPARSE_REJECTED',
  'STORAGE_CANONICAL_ESCAPE_REJECTED',
  'STORAGE_TARGET_ABSENT_SAFE_PARENTS_ACCEPTED',
  'STORAGE_TARGET_ABSENT_UNSAFE_PARENT_REJECTED',
  'LOCAL_ARTIFACT_NOMINAL_READ_ACCEPTED',
  'LOCAL_ARTIFACT_AUTHORIZATION_FILE_REPARSE_REJECTED',
  'LOCAL_ARTIFACT_STATE_PARENT_REPARSE_REJECTED',
  'LOCAL_ARTIFACT_ACTIVE_STATE_FILE_REPARSE_REJECTED',
  'LOCAL_ARTIFACT_RUNS_PARENT_REPARSE_REJECTED',
  'LOCAL_ARTIFACT_R1_PARENT_REPARSE_REJECTED',
  'LOCAL_ARTIFACT_R2_PARENT_REPARSE_REJECTED',
  'LOCAL_ARTIFACT_EVIDENCE_FILE_REPARSE_REJECTED',
  'LOCAL_ARTIFACT_CANONICAL_ESCAPE_REJECTED',
  'LOCAL_ARTIFACT_ABSENT_SAFE_PREPARATION_ACCEPTED',
  'LOCAL_ARTIFACT_ABSENT_UNSAFE_PARENT_REJECTED',
  'POST_R2_COMPLETE_R1_NOMINAL_ACCEPTED',
  'POST_R2_R1_ABORTED_REJECTED',
  'POST_R2_COMPLETED_RUN_NULL_REJECTED',
  'POST_R2_R1_MISSING_NONZERO_REJECTED',
  'POST_R2_R1_UNEXPECTED_NONZERO_REJECTED',
  'LOCALAPPDATA_FIXED_LOCAL_ACCEPTED',
  'LOCALAPPDATA_UNC_REJECTED',
  'LOCALAPPDATA_DEVICE_PATH_REJECTED',
  'LOCALAPPDATA_NETWORK_DRIVE_REJECTED',
  'LOCALAPPDATA_RELATIVE_PATH_REJECTED',
  'ABORT_T00_NULL_START_ACCEPTED',
  'ABORT_T01_NULL_START_REJECTED'
)

function New-CheckResult {
  param(
    [bool] $Valid,
    [string[]] $Codes = @(),
    [object] $Value = $null
  )

  return [pscustomobject]@{
    Valid = $Valid
    Codes = @($Codes)
    Value = $Value
  }
}

function Test-OrdinalSequence {
  param(
    [string[]] $Actual,
    [string[]] $Expected
  )

  if ($Actual.Count -ne $Expected.Count) {
    return $false
  }
  for ($index = 0; $index -lt $Expected.Count; $index += 1) {
    if (-not [string]::Equals(
      [string] $Actual[$index],
      [string] $Expected[$index],
      [System.StringComparison]::Ordinal
    )) {
      return $false
    }
  }
  return $true
}

function Test-StrictUtc {
  param(
    [AllowNull()]
    [object] $Value
  )

  if (-not ($Value -is [string])) {
    return $false
  }
  $parsed = [datetimeoffset]::MinValue
  return [datetimeoffset]::TryParseExact(
    [string] $Value,
    $script:UtcFormat,
    [System.Globalization.CultureInfo]::InvariantCulture,
    [System.Globalization.DateTimeStyles]::AssumeUniversal,
    [ref] $parsed
  )
}

function Get-Sha256Hex {
  param(
    [byte[]] $Bytes
  )

  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    $digest = $algorithm.ComputeHash($Bytes)
    return (($digest | ForEach-Object { $_.ToString('x2') }) -join '')
  } finally {
    $algorithm.Dispose()
  }
}

function Get-Utf8Bytes {
  param(
    [string] $Text
  )

  $encoding = [System.Text.UTF8Encoding]::new($false, $true)
  return $encoding.GetBytes($Text)
}

function Get-ResourceDescriptor {
  param(
    [ValidateSet('R1', 'R2')]
    [string] $Run
  )

  $suffix = $Run.ToLowerInvariant()
  return (
    "schemaVersion=1`n" +
    "run=$Run`n" +
    "jdbcUrl=jdbc:postgresql://127.0.0.1:5432/ritomer_043c_$suffix`n" +
    "databaseName=ritomer_043c_$suffix`n" +
    "roleName=ritomer_043c_${suffix}_runner`n" +
    "storageRelativePath=runtime/$Run/storage`n"
  )
}

function Get-ExpectedResourceTargetHash {
  param(
    [ValidateSet('R1', 'R2')]
    [string] $Run
  )

  return Get-Sha256Hex -Bytes (Get-Utf8Bytes -Text (Get-ResourceDescriptor -Run $Run))
}

function Format-BufferedOutput {
  param(
    [string] $SelectedMode,
    [bool] $Success,
    [string[]] $Topics = @(),
    [string] $CleanupDisposition = 'NONE',
    [int] $ExpectedBusinessEventCount = 0,
    [int] $MissingExpectedBusinessEventCount = 0,
    [int] $UnexpectedBusinessEventCount = 0
  )

  $lines = New-Object System.Collections.Generic.List[string]
  [void] $lines.Add("mode=$SelectedMode")
  if (-not $Success) {
    [void] $lines.Add('verdict=FAIL')
    [void] $lines.Add('cleanupDisposition=NONE')
    [void] $lines.Add('checksSucceeded=false')
    [void] $lines.Add('errorCount=1')
    [void] $lines.Add('errorCodes=VALIDATION_ERROR')
    return @($lines.ToArray())
  }

  [void] $lines.Add('verdict=PASS')
  if ([string]::Equals($SelectedMode, 'SelfTest', [System.StringComparison]::Ordinal)) {
    foreach ($topic in $Topics) {
      [void] $lines.Add("probe_${topic}=PASS")
    }
    [void] $lines.Add("selfTestProbeCount=$($Topics.Count)")
    [void] $lines.Add("selfTestSucceededCount=$($Topics.Count)")
    [void] $lines.Add('selfTestFailedCount=0')
    [void] $lines.Add("expectedBusinessEventCount=$ExpectedBusinessEventCount")
    [void] $lines.Add("missingExpectedBusinessEventCount=$MissingExpectedBusinessEventCount")
    [void] $lines.Add("unexpectedBusinessEventCount=$UnexpectedBusinessEventCount")
    [void] $lines.Add('externalAccessPerformed=false')
    [void] $lines.Add('stateWritePerformed=false')
    [void] $lines.Add('errorCodes=NONE')
  } else {
    [void] $lines.Add("cleanupDisposition=$CleanupDisposition")
    [void] $lines.Add('checksSucceeded=true')
    [void] $lines.Add('errorCount=0')
    [void] $lines.Add('errorCodes=NONE')
  }
  return @($lines.ToArray())
}

function Test-ContainsOrdinal {
  param(
    [object[]] $Values,
    [AllowNull()]
    [object] $Candidate
  )

  foreach ($value in $Values) {
    if ([object]::Equals($value, $Candidate)) {
      return $true
    }
  }
  return $false
}

function Get-MarkedTextBlock {
  param(
    [string] $Text,
    [string] $BeginMarker,
    [string] $EndMarker,
    [string] $MissingCode,
    [string] $DuplicatedCode
  )

  $beginCount = [regex]::Matches(
    $Text,
    [regex]::Escape($BeginMarker),
    [System.Text.RegularExpressions.RegexOptions]::CultureInvariant
  ).Count
  $endCount = [regex]::Matches(
    $Text,
    [regex]::Escape($EndMarker),
    [System.Text.RegularExpressions.RegexOptions]::CultureInvariant
  ).Count

  if (($beginCount -eq 0) -or ($endCount -eq 0)) {
    return New-CheckResult -Valid $false -Codes @($MissingCode)
  }
  if (($beginCount -ne 1) -or ($endCount -ne 1)) {
    return New-CheckResult -Valid $false -Codes @($DuplicatedCode)
  }

  $beginIndex = $Text.IndexOf($BeginMarker, [System.StringComparison]::Ordinal)
  $contentIndex = $beginIndex + $BeginMarker.Length
  $endIndex = $Text.IndexOf(
    $EndMarker,
    $contentIndex,
    [System.StringComparison]::Ordinal
  )
  if (($endIndex -lt $contentIndex) -or
      ($contentIndex -ge $Text.Length) -or
      ($Text[$contentIndex] -ne "`n")) {
    return New-CheckResult -Valid $false -Codes @('MARKER_LAYOUT_INVALID')
  }

  $contentIndex += 1
  $content = $Text.Substring($contentIndex, $endIndex - $contentIndex)
  if ((-not $content.EndsWith("`n", [System.StringComparison]::Ordinal)) -or
      $content.EndsWith("`n`n", [System.StringComparison]::Ordinal)) {
    return New-CheckResult -Valid $false -Codes @('BLOCK_TERMINAL_LF_INVALID')
  }
  return New-CheckResult -Valid $true -Value $content
}

function Convert-LedgerBlock {
  param(
    [string] $Block
  )

  $records = New-Object System.Collections.Generic.List[object]
  $codes = New-Object System.Collections.Generic.List[string]
  if (($null -eq $Block) -or ($Block.Length -lt 2) -or
      (-not $Block.EndsWith("`n", [System.StringComparison]::Ordinal)) -or
      $Block.Contains("`r")) {
    return New-CheckResult -Valid $false -Codes @('LEDGER_JSON_INVALID')
  }
  $lines = @($Block.Substring(0, $Block.Length - 1).Split([char] 10))
  if (($lines.Count -eq 0) -or
      (@($lines | Where-Object { $_.Length -eq 0 }).Count -gt 0)) {
    return New-CheckResult -Valid $false -Codes @('LEDGER_JSON_INVALID')
  }
  foreach ($line in $lines) {
    try {
      $record = $line | ConvertFrom-Json
      if ($null -eq $record) {
        [void] $codes.Add('LEDGER_JSON_INVALID')
      } else {
        $canonical = $record | ConvertTo-Json -Compress -Depth 8
        if ($canonical -cne $line) {
          [void] $codes.Add('LEDGER_JSON_INVALID')
        }
        [void] $records.Add($record)
      }
    } catch {
      [void] $codes.Add('LEDGER_JSON_INVALID')
    }
  }
  if ($codes.Count -gt 0) {
    return New-CheckResult -Valid $false -Codes @($codes.ToArray())
  }
  return New-CheckResult -Valid $true -Value @($records.ToArray())
}

function Get-ExpectedRoleAuthority {
  param(
    [string] $State
  )

  $mapping = @{
    $($script:States.S0) = @('CPO', 'CPO_PLAN_HARDENING_DECISION')
    $($script:States.S1) = @('CPO', 'CPO_PREPARATORY_IMPLEMENTATION_DECISION')
    $($script:States.S2) = @('PREPARATION_OWNER', 'PREPARATORY_IMPLEMENTATION_EVIDENCE')
    $($script:States.S3) = @('CPO', 'CPO_POST_CODE_REVIEW')
    $($script:States.S4) = @('CTO', 'CTO_GATE')
    $($script:States.S7) = @('COORDINATOR_043C', 'R1_CLEANUP_EVIDENCE')
    $($script:States.S10) = @('COORDINATOR_043C', 'R2_CLEANUP_EVIDENCE')
    $($script:States.F1) = @('CPO', 'CPO_FINAL_DECISION')
    $($script:States.F2) = @('CPO', 'CPO_FINAL_DECISION')
    $($script:States.F3) = @('CPO', 'CPO_FINAL_DECISION')
  }
  if ($mapping.ContainsKey($State)) {
    return @($mapping[$State])
  }
  return @()
}

function Get-ExpectedPreviousStates {
  param(
    [string] $State
  )

  $mapping = @{
    $($script:States.S0) = @($null)
    $($script:States.S1) = @($script:States.S0)
    $($script:States.S2) = @($script:States.S1)
    $($script:States.S3) = @($script:States.S2)
    $($script:States.S4) = @($script:States.S3)
    $($script:States.S7) = @($script:States.S6)
    $($script:States.S10) = @($script:States.S9)
    $($script:States.F1) = @($script:States.S10)
    $($script:States.F2) = @($script:States.S7, $script:States.S10)
    $($script:States.F3) = @($script:States.S7, $script:States.S10)
  }
  if ($mapping.ContainsKey($State)) {
    return @($mapping[$State])
  }
  return @()
}

function Get-ExpectedDurablePreviousStates {
  param(
    [string] $State
  )

  $mapping = @{
    $($script:States.S1) = @($script:States.S0)
    $($script:States.S2) = @($script:States.S1)
    $($script:States.S3) = @($script:States.S2)
    $($script:States.S4) = @($script:States.S3)
    $($script:States.S7) = @($script:States.S4)
    $($script:States.S10) = @($script:States.S7)
    $($script:States.F1) = @($script:States.S10)
    $($script:States.F2) = @($script:States.S7, $script:States.S10)
    $($script:States.F3) = @($script:States.S7, $script:States.S10)
  }
  if ($mapping.ContainsKey($State)) {
    return @($mapping[$State])
  }
  return @()
}

function Test-DurableLedger {
  param(
    [object[]] $Records,
    [string] $ExpectedProtocolSha256,
    [AllowNull()]
    [string] $ExpectedFrozenCommit = $null
  )

  $codes = New-Object System.Collections.Generic.List[string]
  if ($Records.Count -eq 0) {
    [void] $codes.Add('DURABLE_SOURCE_MISSING')
    return New-CheckResult -Valid $false -Codes @($codes.ToArray())
  }

  $knownDurableStates = @(
    $script:States.S0,
    $script:States.S1,
    $script:States.S2,
    $script:States.S3,
    $script:States.S4,
    $script:States.S7,
    $script:States.S10,
    $script:States.F1,
    $script:States.F2,
    $script:States.F3
  )
  $localStates = @(
    $script:States.S5,
    $script:States.S6,
    $script:States.S8,
    $script:States.S9
  )
  $knownRoles = @('CPO', 'PREPARATION_OWNER', 'CTO', 'COORDINATOR_043C')
  $knownAuthorityTypes = @(
    'CPO_PLAN_HARDENING_DECISION',
    'CPO_PREPARATORY_IMPLEMENTATION_DECISION',
    'PREPARATORY_IMPLEMENTATION_EVIDENCE',
    'CPO_POST_CODE_REVIEW',
    'CTO_GATE',
    'R1_CLEANUP_EVIDENCE',
    'R2_CLEANUP_EVIDENCE',
    'CPO_FINAL_DECISION'
  )
  $seenSequences = @{}
  $seenStates = @{}
  $previousRecordedAt = [datetimeoffset]::MinValue
  $stableProtocolSha256 = $null
  $stableFrozenCommit = $null
  $previousDurableState = $null
  $terminalSeen = $false

  for ($index = 0; $index -lt $Records.Count; $index += 1) {
    $record = $Records[$index]
    $previousRecord = if ($index -eq 0) { $null } else { $Records[$index - 1] }
    $actualKeys = @($record.PSObject.Properties | ForEach-Object { $_.Name })
    if (-not (Test-OrdinalSequence -Actual $actualKeys -Expected $script:LedgerKeys)) {
      [void] $codes.Add('EXTRA_PROPERTY')
      if (Test-ContainsOrdinal -Values $actualKeys -Candidate 'resourceTargetSha256') {
        [void] $codes.Add('RESOURCE_TARGET_FORBIDDEN_IN_LEDGER')
      }
      continue
    }

    if (($record.schemaVersion -isnot [int]) -or ($record.schemaVersion -ne 1)) {
      [void] $codes.Add('SCHEMA_VERSION_INVALID')
    }
    if ($record.sequence -isnot [int]) {
      [void] $codes.Add('SEQUENCE_GAP')
    } else {
      if ($seenSequences.ContainsKey([string] $record.sequence)) {
        [void] $codes.Add('SEQUENCE_DUPLICATE')
      }
      $seenSequences[[string] $record.sequence] = $true
      if ($record.sequence -ne $index) {
        [void] $codes.Add('SEQUENCE_GAP')
      }
    }

    $state = [string] $record.state
    if (Test-ContainsOrdinal -Values $localStates -Candidate $state) {
      [void] $codes.Add('LOCAL_STATE_FORBIDDEN_IN_GIT')
    } elseif (-not (Test-ContainsOrdinal -Values $knownDurableStates -Candidate $state)) {
      [void] $codes.Add('UNKNOWN_STATE')
    }
    if ($seenStates.ContainsKey($state)) {
      [void] $codes.Add('DURABLE_STATE_MULTIPLE')
    }
    $seenStates[$state] = $true

    if ($index -eq 0) {
      if ($state -cne $script:States.S0) {
        [void] $codes.Add('PREVIOUS_STATE_MISMATCH')
      }
    } else {
      $allowedDurablePrevious = @(Get-ExpectedDurablePreviousStates -State $state)
      if ($terminalSeen -or ($allowedDurablePrevious.Count -eq 0) -or
          (-not (Test-ContainsOrdinal -Values $allowedDurablePrevious `
            -Candidate $previousDurableState))) {
        [void] $codes.Add('PREVIOUS_STATE_MISMATCH')
      }
    }

    $allowedPrevious = @(Get-ExpectedPreviousStates -State $state)
    if (($allowedPrevious.Count -eq 0) -or
        (-not (Test-ContainsOrdinal -Values $allowedPrevious -Candidate $record.previousState))) {
      [void] $codes.Add('PREVIOUS_STATE_MISMATCH')
    }
    if ((Test-ContainsOrdinal -Values @(
          $script:States.F1,
          $script:States.F2,
          $script:States.F3
        ) -Candidate $state) -and
        (($null -eq $previousRecord) -or
         (-not [string]::Equals(
           [string] $record.previousState,
           [string] $previousRecord.state,
           [System.StringComparison]::Ordinal
         )))) {
      [void] $codes.Add('PREVIOUS_STATE_MISMATCH')
    }

    if (-not (Test-StrictUtc -Value $record.recordedAtUtc)) {
      [void] $codes.Add('RECORDED_AT_INVALID')
    } else {
      $recordedAt = [datetimeoffset]::ParseExact(
        [string] $record.recordedAtUtc,
        $script:UtcFormat,
        [System.Globalization.CultureInfo]::InvariantCulture,
        [System.Globalization.DateTimeStyles]::AssumeUniversal
      )
      if ($recordedAt -le $previousRecordedAt) {
        [void] $codes.Add('RECORDED_AT_NOT_INCREASING')
      }
      $previousRecordedAt = $recordedAt
    }

    if (-not (Test-ContainsOrdinal -Values $knownRoles -Candidate $record.recordedByRole)) {
      [void] $codes.Add('UNKNOWN_RECORDED_BY_ROLE')
    }
    if (-not (Test-ContainsOrdinal -Values $knownAuthorityTypes -Candidate $record.authorityType)) {
      [void] $codes.Add('UNKNOWN_AUTHORITY_TYPE')
    }
    $expectedRoleAuthority = @(Get-ExpectedRoleAuthority -State $state)
    if (($expectedRoleAuthority.Count -ne 2) -or
        (-not [string]::Equals(
          [string] $record.recordedByRole,
          [string] $expectedRoleAuthority[0],
          [System.StringComparison]::Ordinal
        )) -or
        (-not [string]::Equals(
          [string] $record.authorityType,
          [string] $expectedRoleAuthority[1],
          [System.StringComparison]::Ordinal
        ))) {
      [void] $codes.Add('STATE_ROLE_AUTHORITY_MISMATCH')
    }
    if (($record.authorityRef -isnot [string]) -or
        (-not ([string] $record.authorityRef -cmatch $script:AuthorityRefPattern))) {
      [void] $codes.Add('AUTHORITY_REF_INVALID')
    }

    $beforeS2 = Test-ContainsOrdinal -Values @($script:States.S0, $script:States.S1) -Candidate $state
    if ($beforeS2) {
      if ($null -ne $record.protocolSha256) {
        [void] $codes.Add('PROTOCOL_SHA256_NON_NULL_BEFORE_S2')
      }
      if ($null -ne $record.protocolId) {
        [void] $codes.Add('PROTOCOL_ID_MISMATCH')
      }
    } else {
      if ($null -eq $record.protocolSha256) {
        [void] $codes.Add('PROTOCOL_SHA256_NULL_FROM_S2')
      } elseif (([string] $record.protocolSha256 -cnotmatch $script:Hex64Pattern) -or
                (-not [string]::Equals(
                  [string] $record.protocolSha256,
                  $ExpectedProtocolSha256,
                  [System.StringComparison]::Ordinal
                ))) {
        [void] $codes.Add('PROTOCOL_SHA256_MISMATCH')
      }
      if (-not [string]::Equals(
        [string] $record.protocolId,
        $script:ProtocolId,
        [System.StringComparison]::Ordinal
      )) {
        [void] $codes.Add('PROTOCOL_ID_MISMATCH')
      }
      if ($null -eq $stableProtocolSha256) {
        $stableProtocolSha256 = [string] $record.protocolSha256
      } elseif (-not [string]::Equals(
        $stableProtocolSha256,
        [string] $record.protocolSha256,
        [System.StringComparison]::Ordinal
      )) {
        [void] $codes.Add('PROTOCOL_SHA256_MISMATCH')
      }
    }

    $beforeS4 = Test-ContainsOrdinal -Values @(
      $script:States.S0,
      $script:States.S1,
      $script:States.S2,
      $script:States.S3
    ) -Candidate $state
    if ($beforeS4) {
      if ($null -ne $record.frozenCommit) {
        [void] $codes.Add('FROZEN_COMMIT_NON_NULL_BEFORE_S4')
      }
    } else {
      if ($null -eq $record.frozenCommit) {
        [void] $codes.Add('FROZEN_COMMIT_NULL_FROM_S4')
      } elseif ([string] $record.frozenCommit -cnotmatch $script:Git40Pattern) {
        [void] $codes.Add('FROZEN_COMMIT_MISMATCH')
      } else {
        if ($null -eq $stableFrozenCommit) {
          $stableFrozenCommit = [string] $record.frozenCommit
        } elseif (-not [string]::Equals(
          $stableFrozenCommit,
          [string] $record.frozenCommit,
          [System.StringComparison]::Ordinal
        )) {
          [void] $codes.Add('FROZEN_COMMIT_MISMATCH')
        }
        if (($null -ne $ExpectedFrozenCommit) -and
            (-not [string]::Equals(
              [string] $record.frozenCommit,
              $ExpectedFrozenCommit,
              [System.StringComparison]::Ordinal
            ))) {
          [void] $codes.Add('FROZEN_COMMIT_MISMATCH')
        }
      }
    }

    if (($record.r1Authorized -isnot [bool]) -or $record.r1Authorized -or
        ($record.r2Authorized -isnot [bool]) -or $record.r2Authorized) {
      [void] $codes.Add('DURABLE_AUTHORIZATION_INVALID')
    }
    if (-not (Test-ContainsOrdinal -Values @($null, 'R1', 'R2') -Candidate $record.completedRun)) {
      [void] $codes.Add('COMPLETED_RUN_INVALID')
    }
    if ((Test-ContainsOrdinal -Values @(
      $script:States.S0,
      $script:States.S1,
      $script:States.S2,
      $script:States.S3,
      $script:States.S4
    ) -Candidate $state) -and ($null -ne $record.completedRun)) {
      [void] $codes.Add('COMPLETED_RUN_INVALID')
    }
    if (($state -ceq $script:States.S7) -and
        (-not (Test-ContainsOrdinal -Values @($null, 'R1') -Candidate $record.completedRun))) {
      [void] $codes.Add('COMPLETED_RUN_INVALID')
    }
    if (($state -ceq $script:States.S10) -and
        (-not (Test-ContainsOrdinal -Values @('R1', 'R2') -Candidate $record.completedRun))) {
      [void] $codes.Add('COMPLETED_RUN_INVALID')
    }
    if (($state -ceq $script:States.S10) -and
        (($null -eq $previousRecord) -or
         ([string] $previousRecord.state -cne $script:States.S7) -or
         ([string] $previousRecord.completedRun -cne 'R1'))) {
      [void] $codes.Add('COMPLETED_RUN_INVALID')
    }
    if (($state -ceq $script:States.F1) -and ($record.completedRun -cne 'R2')) {
      [void] $codes.Add('F1_REQUIRES_R2')
    }

    $beforeEvidence = Test-ContainsOrdinal -Values @(
      $script:States.S0,
      $script:States.S1,
      $script:States.S2,
      $script:States.S3,
      $script:States.S4
    ) -Candidate $state
    if ($beforeEvidence) {
      if ($null -ne $record.evidenceSha256) {
        [void] $codes.Add('EVIDENCE_HASH_INVALID')
      }
    } elseif (($record.evidenceSha256 -isnot [string]) -or
              ([string] $record.evidenceSha256 -cnotmatch $script:Hex64Pattern)) {
      [void] $codes.Add('EVIDENCE_HASH_INVALID')
    }

    if (Test-ContainsOrdinal -Values @(
      $script:States.F1,
      $script:States.F2,
      $script:States.F3
    ) -Candidate $state) {
      if (($null -eq $previousRecord) -or
          (-not [object]::Equals(
            $record.completedRun,
            $previousRecord.completedRun
          ))) {
        [void] $codes.Add('COMPLETED_RUN_INVALID')
      }
      if (($null -eq $previousRecord) -or
          (-not [object]::Equals(
            $record.evidenceSha256,
            $previousRecord.evidenceSha256
          ))) {
        [void] $codes.Add('EVIDENCE_HASH_INVALID')
      }
      if (-not [string]::Equals(
        [string] $record.cpoOutcome,
        $state,
        [System.StringComparison]::Ordinal
      )) {
        [void] $codes.Add('CPO_OUTCOME_INVALID')
      }
    } elseif ($null -ne $record.cpoOutcome) {
      [void] $codes.Add('CPO_OUTCOME_INVALID')
    }

    if (Test-ContainsOrdinal -Values @(
      $script:States.F1,
      $script:States.F2,
      $script:States.F3
    ) -Candidate $state) {
      $terminalSeen = $true
    }
    $previousDurableState = $state
  }

  $uniqueCodes = @($codes.ToArray() | Sort-Object -Unique)
  return New-CheckResult -Valid ($uniqueCodes.Count -eq 0) -Codes $uniqueCodes -Value $Records[-1]
}

function Test-StrictJsonBytes {
  param(
    [byte[]] $Bytes,
    [string[]] $ExpectedKeys
  )

  $codes = New-Object System.Collections.Generic.List[string]
  if (($Bytes.Count -ge 3) -and
      ($Bytes[0] -eq 0xEF) -and
      ($Bytes[1] -eq 0xBB) -and
      ($Bytes[2] -eq 0xBF)) {
    [void] $codes.Add('LOCAL_JSON_ENCODING_INVALID')
  }
  if (($Bytes.Count -eq 0) -or ($Bytes[$Bytes.Count - 1] -ne 10)) {
    [void] $codes.Add('LOCAL_JSON_TERMINAL_LF_INVALID')
  }
  for ($index = 0; $index -lt $Bytes.Count; $index += 1) {
    if ($Bytes[$index] -eq 13) {
      [void] $codes.Add('LOCAL_JSON_ENCODING_INVALID')
      break
    }
  }

  $encoding = [System.Text.UTF8Encoding]::new($false, $true)
  $text = $null
  try {
    $text = $encoding.GetString($Bytes)
  } catch {
    [void] $codes.Add('LOCAL_JSON_ENCODING_INVALID')
  }
  if ($null -eq $text) {
    return New-CheckResult -Valid $false -Codes @($codes.ToArray())
  }
  if (($text.Split([char] 10).Count -ne 2) -or
      (-not $text.EndsWith("`n", [System.StringComparison]::Ordinal))) {
    [void] $codes.Add('LOCAL_JSON_NOT_SINGLE_LINE')
  }

  $jsonLine = $text.Substring(0, [Math]::Max(0, $text.Length - 1))
  $keyMatches = [regex]::Matches(
    $jsonLine,
    '(?:"((?:[^"\\]|\\.)*)")\s*:',
    [System.Text.RegularExpressions.RegexOptions]::CultureInvariant
  )
  $lexicalKeys = New-Object System.Collections.Generic.List[string]
  foreach ($match in $keyMatches) {
    [void] $lexicalKeys.Add($match.Groups[1].Value)
  }
  if (-not (Test-OrdinalSequence -Actual @($lexicalKeys.ToArray()) -Expected $ExpectedKeys)) {
    [void] $codes.Add('LOCAL_JSON_KEYS_INVALID')
  }

  $value = $null
  try {
    $value = $jsonLine | ConvertFrom-Json
  } catch {
    [void] $codes.Add('LOCAL_JSON_PARSE_INVALID')
  }
  if ($null -ne $value) {
    $actualKeys = @($value.PSObject.Properties | ForEach-Object { $_.Name })
    if (-not (Test-OrdinalSequence -Actual $actualKeys -Expected $ExpectedKeys)) {
      [void] $codes.Add('LOCAL_JSON_KEYS_INVALID')
    }
    $canonicalLine = $value | ConvertTo-Json -Compress -Depth 10
    if (-not [string]::Equals(
      $jsonLine,
      $canonicalLine,
      [System.StringComparison]::Ordinal
    )) {
      [void] $codes.Add('LOCAL_JSON_NOT_MINIFIED_CANONICAL')
    }
  }
  $uniqueCodes = @($codes.ToArray() | Sort-Object -Unique)
  return New-CheckResult -Valid ($uniqueCodes.Count -eq 0) -Codes $uniqueCodes -Value $value
}

function Test-AuthorizationRecord {
  param(
    [object] $Record
  )

  $codes = New-Object System.Collections.Generic.List[string]
  if (($Record.schemaVersion -isnot [int]) -or ($Record.schemaVersion -ne 1)) {
    [void] $codes.Add('AUTHORIZATION_SCHEMA_INVALID')
  }
  if (-not (Test-ContainsOrdinal -Values @('R1', 'R2') -Candidate $Record.run)) {
    [void] $codes.Add('AUTHORIZATION_RUN_INVALID')
  } elseif ((($Record.run -ceq 'R1') -and ($Record.decision -cne 'R1_ONLY')) -or
            (($Record.run -ceq 'R2') -and ($Record.decision -cne 'R2_ONLY'))) {
    [void] $codes.Add('AUTHORIZATION_DECISION_INVALID')
  }
  if (-not (Test-StrictUtc -Value $Record.authorizedAtUtc)) {
    [void] $codes.Add('AUTHORIZATION_TIMESTAMP_INVALID')
  }
  if (($Record.authorityRef -isnot [string]) -or
      ([string] $Record.authorityRef -cnotmatch $script:AuthorityRefPattern)) {
    [void] $codes.Add('AUTHORIZATION_REFERENCE_INVALID')
  }
  if ($Record.protocolId -cne $script:ProtocolId) {
    [void] $codes.Add('AUTHORIZATION_PROTOCOL_INVALID')
  }
  if (($Record.protocolSha256 -isnot [string]) -or
      ([string] $Record.protocolSha256 -cnotmatch $script:Hex64Pattern)) {
    [void] $codes.Add('AUTHORIZATION_PROTOCOL_INVALID')
  }
  if (($Record.frozenCommit -isnot [string]) -or
      ([string] $Record.frozenCommit -cnotmatch $script:Git40Pattern)) {
    [void] $codes.Add('AUTHORIZATION_COMMIT_INVALID')
  }
  if ($Record.run -is [string]) {
    $expectedTargetHash = Get-ExpectedResourceTargetHash -Run ([string] $Record.run)
    if (-not [string]::Equals(
      [string] $Record.resourceTargetSha256,
      $expectedTargetHash,
      [System.StringComparison]::Ordinal
    )) {
      [void] $codes.Add('RESOURCE_TARGET_HASH_MISMATCH')
    }
  }
  $uniqueCodes = @($codes.ToArray() | Sort-Object -Unique)
  return New-CheckResult -Valid ($uniqueCodes.Count -eq 0) -Codes $uniqueCodes
}

function Test-ActiveStateRecord {
  param(
    [object] $Record,
    [object] $Authorization
  )

  $codes = New-Object System.Collections.Generic.List[string]
  if (($Record.schemaVersion -isnot [int]) -or ($Record.schemaVersion -ne 1)) {
    [void] $codes.Add('ACTIVE_STATE_SCHEMA_INVALID')
  }
  $validBinding = (($Record.run -ceq 'R1') -and
      (Test-ContainsOrdinal -Values @($script:States.S5, $script:States.S6) -Candidate $Record.state)) -or
    (($Record.run -ceq 'R2') -and
      (Test-ContainsOrdinal -Values @($script:States.S8, $script:States.S9) -Candidate $Record.state))
  if (-not $validBinding) {
    [void] $codes.Add('ACTIVE_STATE_BINDING_INVALID')
  }
  if (-not (Test-StrictUtc -Value $Record.recordedAtUtc)) {
    [void] $codes.Add('ACTIVE_STATE_TIMESTAMP_INVALID')
  }
  foreach ($property in @(
    'run',
    'authorityRef',
    'protocolId',
    'protocolSha256',
    'frozenCommit',
    'resourceTargetSha256'
  )) {
    if (-not [object]::Equals($Record.$property, $Authorization.$property)) {
      [void] $codes.Add('ACTIVE_STATE_BINDING_INVALID')
    }
  }
  if ((Test-StrictUtc -Value $Record.recordedAtUtc) -and
      (Test-StrictUtc -Value $Authorization.authorizedAtUtc)) {
    $activeAt = [datetimeoffset]::ParseExact(
      [string] $Record.recordedAtUtc,
      $script:UtcFormat,
      [System.Globalization.CultureInfo]::InvariantCulture
    )
    $authorizedAt = [datetimeoffset]::ParseExact(
      [string] $Authorization.authorizedAtUtc,
      $script:UtcFormat,
      [System.Globalization.CultureInfo]::InvariantCulture
    )
    if ($activeAt -lt $authorizedAt) {
      [void] $codes.Add('ACTIVE_STATE_TIMESTAMP_INVALID')
    }
  }
  $uniqueCodes = @($codes.ToArray() | Sort-Object -Unique)
  return New-CheckResult -Valid ($uniqueCodes.Count -eq 0) -Codes $uniqueCodes
}

function Test-EvidenceRecord {
  param(
    [object] $Record,
    [object] $Authorization
  )

  $codes = New-Object System.Collections.Generic.List[string]
  if (($Record.schemaVersion -isnot [int]) -or ($Record.schemaVersion -ne 1)) {
    [void] $codes.Add('EVIDENCE_SCHEMA_INVALID')
  }
  foreach ($property in @(
    'run',
    'protocolId',
    'protocolSha256',
    'frozenCommit',
    'resourceTargetSha256'
  )) {
    if (-not [object]::Equals($Record.$property, $Authorization.$property)) {
      [void] $codes.Add('EVIDENCE_BINDING_INVALID')
    }
  }
  if (-not (Test-ContainsOrdinal -Values @('COMPLETED', 'ABORTED') -Candidate $Record.outcome)) {
    [void] $codes.Add('EVIDENCE_OUTCOME_INVALID')
  }
  if (-not (Test-StrictUtc -Value $Record.runEndedAtUtc)) {
    [void] $codes.Add('EVIDENCE_TIME_INVALID')
  }
  if ($null -ne $Record.runStartedAtUtc) {
    if (-not (Test-StrictUtc -Value $Record.runStartedAtUtc)) {
      [void] $codes.Add('EVIDENCE_TIME_INVALID')
    } elseif (Test-StrictUtc -Value $Record.runEndedAtUtc) {
      $started = [datetimeoffset]::ParseExact(
        [string] $Record.runStartedAtUtc,
        $script:UtcFormat,
        [System.Globalization.CultureInfo]::InvariantCulture
      )
      $ended = [datetimeoffset]::ParseExact(
        [string] $Record.runEndedAtUtc,
        $script:UtcFormat,
        [System.Globalization.CultureInfo]::InvariantCulture
      )
      if ($started -gt $ended) {
        [void] $codes.Add('EVIDENCE_TIME_INVALID')
      }
    }
  }
  if (($Record.expectedBusinessEventCount -isnot [int]) -or
      ($Record.expectedBusinessEventCount -ne 15) -or
      ($Record.missingExpectedBusinessEventCount -isnot [int]) -or
      ($Record.missingExpectedBusinessEventCount -lt 0) -or
      ($Record.missingExpectedBusinessEventCount -gt 15) -or
      ($Record.unexpectedBusinessEventCount -isnot [int]) -or
      ($Record.unexpectedBusinessEventCount -lt 0)) {
    [void] $codes.Add('EVIDENCE_AUDIT_COUNTS_INVALID')
  }

  if ($Record.outcome -ceq 'COMPLETED') {
    if (($Record.lastCompletedTask -cne 'T14') -or
        ($null -ne $Record.abortReasonCode) -or
        ($null -eq $Record.runStartedAtUtc) -or
        ($Record.expectedBusinessEventCount -ne 15) -or
        ($Record.missingExpectedBusinessEventCount -ne 0) -or
        ($Record.unexpectedBusinessEventCount -ne 0)) {
      [void] $codes.Add('EVIDENCE_COMPLETED_INVALID')
    }
  }
  if ($Record.outcome -ceq 'ABORTED') {
    $allowedTasks = @($null, 'T00', 'T01', 'T02', 'T03', 'T04', 'T05', 'T06',
      'T07', 'T08', 'T09', 'T10', 'T11', 'T12', 'T13')
    $allowedReasons = @('HARD_STOP', 'OPERATOR_INTERRUPTION', 'ENVIRONMENT_FAILURE',
      'PROTOCOL_DEVIATION', 'EVIDENCE_INCOMPLETE')
    if ((-not (Test-ContainsOrdinal -Values $allowedTasks -Candidate $Record.lastCompletedTask)) -or
        (-not (Test-ContainsOrdinal -Values $allowedReasons -Candidate $Record.abortReasonCode))) {
      [void] $codes.Add('EVIDENCE_ABORTED_INVALID')
    }
    if (($null -eq $Record.runStartedAtUtc) -and
        ($null -ne $Record.lastCompletedTask) -and
        ($Record.lastCompletedTask -cne 'T00')) {
      [void] $codes.Add('EVIDENCE_ABORTED_INVALID')
    }
  }
  $uniqueCodes = @($codes.ToArray() | Sort-Object -Unique)
  return New-CheckResult -Valid ($uniqueCodes.Count -eq 0) -Codes $uniqueCodes
}

function Test-MachineTransition {
  param(
    [string] $SourceState,
    [string] $TargetState,
    [string] $R1Outcome = 'NONE',
    [string] $R1Cleanup = 'NONE',
    [int] $R1Missing = 15,
    [int] $R1Unexpected = 0,
    [string] $R2Outcome = 'NONE',
    [string] $R2Cleanup = 'NONE',
    [int] $R2Missing = 15,
    [int] $R2Unexpected = 0,
    [string] $RunDecision = 'NONE',
    [string] $CompletedRun = 'NONE',
    [string] $T15Status = 'COMPLETE'
  )

  $codes = New-Object System.Collections.Generic.List[string]
  if ($T15Status -ceq 'INTERRUPTED') {
    if (-not [string]::Equals($SourceState, $TargetState, [System.StringComparison]::Ordinal)) {
      [void] $codes.Add('T15_INTERRUPTED_NO_CHECKPOINT')
    }
    return New-CheckResult -Valid ($codes.Count -eq 0) -Codes @($codes.ToArray())
  }

  if (($SourceState -ceq $script:States.S6) -and
      ($TargetState -ceq $script:States.S7)) {
    if ($R1Outcome -ceq 'ABORTED') {
      if ($R1Cleanup -cne 'CLEANUP_VERIFIED_RUN_ABORTED') {
        [void] $codes.Add('R1_ABORTED_CLEANUP_REQUIRED')
      }
    } elseif ($R1Outcome -ceq 'COMPLETED') {
      if (($R1Cleanup -cne 'CLEANUP_VERIFIED_RUN_COMPLETE') -or
          ($R1Missing -ne 0) -or ($R1Unexpected -ne 0)) {
        [void] $codes.Add('F1_REQUIRES_TWO_EXACT_AUDITS')
      }
    } else {
      [void] $codes.Add('MODE_STATE_MISMATCH')
    }
  } elseif (($SourceState -ceq $script:States.S7) -and
            ($TargetState -ceq $script:States.S8)) {
    if (($R1Outcome -ne 'COMPLETED') -or
        ($R1Cleanup -ne 'CLEANUP_VERIFIED_RUN_COMPLETE') -or
        ($R1Missing -ne 0) -or ($R1Unexpected -ne 0) -or
        ($CompletedRun -ne 'R1')) {
      [void] $codes.Add('R1_ABORTED_BLOCKS_R2')
    } elseif ($RunDecision -cne 'R2_ONLY') {
      [void] $codes.Add('R1_COMPLETE_REQUIRES_R2_ONLY')
    }
  } elseif (($SourceState -ceq $script:States.S7) -and
            (Test-ContainsOrdinal -Values @($script:States.F2, $script:States.F3) -Candidate $TargetState)) {
    if (-not (Test-ContainsOrdinal -Values @(
      'CLEANUP_VERIFIED_RUN_COMPLETE',
      'CLEANUP_VERIFIED_RUN_ABORTED'
    ) -Candidate $R1Cleanup)) {
      [void] $codes.Add('R1_ABORTED_CLEANUP_REQUIRED')
    }
  } elseif (($SourceState -ceq $script:States.S7) -and
            ($TargetState -ceq $script:States.F1)) {
    [void] $codes.Add('F1_REQUIRES_R2')
  } elseif (($SourceState -ceq $script:States.S9) -and
            ($TargetState -ceq $script:States.S10)) {
    if ($R2Outcome -ceq 'ABORTED') {
      if ($R2Cleanup -cne 'CLEANUP_VERIFIED_RUN_ABORTED') {
        [void] $codes.Add('R2_ABORTED_CLEANUP_REQUIRED')
      }
    } elseif ($R2Outcome -ceq 'COMPLETED') {
      if (($R2Cleanup -cne 'CLEANUP_VERIFIED_RUN_COMPLETE') -or
          ($R2Missing -ne 0) -or ($R2Unexpected -ne 0)) {
        [void] $codes.Add('F1_REQUIRES_TWO_EXACT_AUDITS')
      }
    } else {
      [void] $codes.Add('MODE_STATE_MISMATCH')
    }
  } elseif (($SourceState -ceq $script:States.S10) -and
            ($TargetState -ceq $script:States.F1)) {
    if (($CompletedRun -cne 'R2') -or ($R1Outcome -cne 'COMPLETED') -or
        ($R2Outcome -cne 'COMPLETED')) {
      [void] $codes.Add('F1_REQUIRES_R2')
    }
    if (($R1Cleanup -cne 'CLEANUP_VERIFIED_RUN_COMPLETE') -or
        ($R2Cleanup -cne 'CLEANUP_VERIFIED_RUN_COMPLETE') -or
        ($R1Missing -ne 0) -or ($R1Unexpected -ne 0) -or
        ($R2Missing -ne 0) -or ($R2Unexpected -ne 0)) {
      [void] $codes.Add('F1_REQUIRES_TWO_EXACT_AUDITS')
    }
  } elseif (($SourceState -ceq $script:States.S10) -and
            (Test-ContainsOrdinal -Values @($script:States.F2, $script:States.F3) -Candidate $TargetState)) {
    if (-not (Test-ContainsOrdinal -Values @(
      'CLEANUP_VERIFIED_RUN_COMPLETE',
      'CLEANUP_VERIFIED_RUN_ABORTED'
    ) -Candidate $R2Cleanup)) {
      [void] $codes.Add('R2_ABORTED_CLEANUP_REQUIRED')
    }
  } else {
    [void] $codes.Add('MODE_STATE_MISMATCH')
  }
  $uniqueCodes = @($codes.ToArray() | Sort-Object -Unique)
  return New-CheckResult -Valid ($uniqueCodes.Count -eq 0) -Codes $uniqueCodes
}

function Test-ModeSnapshot {
  param(
    [string] $SelectedMode,
    [object] $Snapshot
  )

  $valid = $false
  switch ($SelectedMode) {
    'PreparationPreflight' {
      $valid = ($Snapshot.DurableState -ceq $script:States.S4) -and
        ($Snapshot.LocalState -ceq 'NONE') -and
        ($Snapshot.AuthorizationDecision -ceq 'NONE') -and
        $Snapshot.ProtocolFrozen -and $Snapshot.GitClean -and
        ($Snapshot.R1Resources -ceq 'ABSENT') -and
        ($Snapshot.R2Resources -ceq 'ABSENT')
    }
    'PreR1' {
      $valid = ($Snapshot.DurableState -ceq $script:States.S4) -and
        ($Snapshot.LocalState -ceq $script:States.S5) -and
        ($Snapshot.AuthorizationDecision -ceq 'R1_ONLY') -and
        $Snapshot.BindingsValid -and
        ($Snapshot.R1Resources -ceq 'CLUSTER_LEVEL_PRESENT') -and
        ($Snapshot.ApplicationReadiness -ceq 'EXACT_STATE_PROVEN') -and
        ($Snapshot.R2Resources -ceq 'ABSENT')
    }
    'PostR1Cleanup' {
      $valid = ($Snapshot.DurableState -ceq $script:States.S4) -and
        ($Snapshot.LocalState -ceq $script:States.S6) -and
        $Snapshot.BindingsValid -and $Snapshot.R1EvidenceValid -and
        ($Snapshot.R1Resources -ceq 'ABSENT') -and
        ($Snapshot.R2Resources -ceq 'ABSENT')
    }
    'PreR2' {
      $valid = ($Snapshot.DurableState -ceq $script:States.S7) -and
        ($Snapshot.LocalState -ceq $script:States.S8) -and
        ($Snapshot.AuthorizationDecision -ceq 'R2_ONLY') -and
        ($Snapshot.CompletedRun -ceq 'R1') -and
        $Snapshot.BindingsValid -and $Snapshot.R1EvidenceValid -and
        ($Snapshot.R1Outcome -ceq 'COMPLETED') -and
        ($Snapshot.R1Missing -eq 0) -and ($Snapshot.R1Unexpected -eq 0) -and
        ($Snapshot.R1Resources -ceq 'ABSENT') -and
        ($Snapshot.R2Resources -ceq 'CLUSTER_LEVEL_PRESENT') -and
        ($Snapshot.ApplicationReadiness -ceq 'EXACT_STATE_PROVEN')
    }
    'PostR2Cleanup' {
      $valid = ($Snapshot.DurableState -ceq $script:States.S7) -and
        ($Snapshot.LocalState -ceq $script:States.S9) -and
        $Snapshot.BindingsValid -and $Snapshot.R1EvidenceValid -and
        $Snapshot.R2EvidenceValid -and
        ($Snapshot.CompletedRun -ceq 'R1') -and
        ($Snapshot.R1Outcome -ceq 'COMPLETED') -and
        ($Snapshot.R1Missing -eq 0) -and
        ($Snapshot.R1Unexpected -eq 0) -and
        ($Snapshot.R1Resources -ceq 'ABSENT') -and
        ($Snapshot.R2Resources -ceq 'ABSENT')
    }
  }
  if (-not $valid) {
    return New-CheckResult -Valid $false -Codes @('MODE_STATE_MISMATCH')
  }
  return New-CheckResult -Valid $true
}

function Test-OperationPolicy {
  param(
    [string] $OperationKind
  )

  $allowed = @(
    'MEMORY_VALIDATE',
    'FILE_READ',
    'GIT_READ',
    'CATALOG_SELECT',
    'STORAGE_INSPECT'
  )
  if (Test-ContainsOrdinal -Values $allowed -Candidate $OperationKind) {
    return New-CheckResult -Valid $true
  }
  return New-CheckResult -Valid $false -Codes @('WRITE_ATTEMPT_FORBIDDEN')
}

function New-AuditExpectedSet {
  $events = New-Object System.Collections.Generic.List[object]
  $actions = @(
    'CLOSING_FOLDER.CREATED',
    'BALANCE_IMPORT.CREATED',
    'MANUAL_MAPPING.CREATED',
    'MANUAL_MAPPING.CREATED',
    'MANUAL_MAPPING.CREATED',
    'MANUAL_MAPPING.CREATED',
    'MANUAL_MAPPING.CREATED',
    'MANUAL_MAPPING.CREATED',
    'MANUAL_MAPPING.CREATED',
    'WORKPAPER.CREATED',
    'DOCUMENT.CREATED',
    'WORKPAPER.UPDATED',
    'DOCUMENT.VERIFICATION_UPDATED',
    'WORKPAPER.REVIEW_STATUS_CHANGED',
    'EXPORT_PACK.CREATED'
  )
  for ($index = 0; $index -lt $actions.Count; $index += 1) {
    $reviewer = ($index -eq 12) -or ($index -eq 13)
    $resourceType = if ($index -eq 0) {
      'CLOSING_FOLDER'
    } elseif ($index -eq 1) {
      'BALANCE_IMPORT'
    } elseif (($index -ge 2) -and ($index -le 8)) {
      'MANUAL_MAPPING'
    } elseif (($index -eq 9) -or ($index -eq 11) -or ($index -eq 13)) {
      'WORKPAPER'
    } elseif (($index -eq 10) -or ($index -eq 12)) {
      'DOCUMENT'
    } else {
      'EXPORT_PACK'
    }
    [void] $events.Add([pscustomobject][ordered]@{
      Slot = $index + 1
      Tenant = 'tenant'
      Actor = if ($reviewer) { 'reviewer-id' } else { 'accountant-id' }
      Subject = if ($reviewer) { 'reviewer-subject' } else { 'accountant-subject' }
      Roles = if ($reviewer) { '["REVIEWER"]' } else { '["ACCOUNTANT"]' }
      Action = $actions[$index]
      ResourceType = $resourceType
      ResourceId = "resource-$($index + 1)"
      RequestId = "request-$($index + 1)"
      Metadata = "metadata-$($index + 1)"
    })
  }
  return @($events.ToArray())
}

function Copy-AuditEvent {
  param(
    [object] $Source,
    [hashtable] $Overrides = @{}
  )

  $values = [ordered]@{}
  foreach ($property in @(
    'Slot',
    'Tenant',
    'Actor',
    'Subject',
    'Roles',
    'Action',
    'ResourceType',
    'ResourceId',
    'RequestId',
    'Metadata'
  )) {
    if ($Overrides.ContainsKey($property)) {
      $values[$property] = $Overrides[$property]
    } else {
      $values[$property] = $Source.$property
    }
  }
  return [pscustomobject] $values
}

function Test-AuditEventMatch {
  param(
    [object] $Candidate,
    [object] $Expected
  )

  foreach ($property in @(
    'Tenant',
    'Actor',
    'Subject',
    'Roles',
    'Action',
    'ResourceType',
    'ResourceId',
    'Metadata'
  )) {
    if (-not [object]::Equals($Candidate.$property, $Expected.$property)) {
      return $false
    }
  }
  return ($Candidate.RequestId -is [string]) -and
    (-not [string]::IsNullOrWhiteSpace([string] $Candidate.RequestId))
}

function Get-AuditMultisetCounts {
  param(
    [object[]] $Expected,
    [object[]] $Candidates
  )

  $matchedSlots = @{}
  $unexpected = 0
  foreach ($candidate in $Candidates) {
    $matches = New-Object System.Collections.Generic.List[int]
    foreach ($expectedEvent in $Expected) {
      if (Test-AuditEventMatch -Candidate $candidate -Expected $expectedEvent) {
        [void] $matches.Add([int] $expectedEvent.Slot)
      }
    }
    if ($matches.Count -ne 1) {
      $unexpected += 1
      continue
    }
    $slotKey = [string] $matches[0]
    if ($matchedSlots.ContainsKey($slotKey)) {
      $unexpected += 1
    } else {
      $matchedSlots[$slotKey] = $true
    }
  }
  return [pscustomobject]@{
    Expected = $Expected.Count
    Missing = $Expected.Count - $matchedSlots.Count
    Unexpected = $unexpected
  }
}

function Test-AuditSelfProbes {
  $expected = @(New-AuditExpectedSet)
  $nominal = @($expected | ForEach-Object { Copy-AuditEvent -Source $_ })
  $nominalCounts = Get-AuditMultisetCounts -Expected $expected -Candidates $nominal
  if (($nominalCounts.Expected -ne 15) -or ($nominalCounts.Missing -ne 0) -or
      ($nominalCounts.Unexpected -ne 0)) {
    return New-CheckResult -Valid $false
  }

  $missingCreated = @($nominal | Select-Object -Skip 1)
  $missingCounts = Get-AuditMultisetCounts -Expected $expected -Candidates $missingCreated
  if (($missingCounts.Missing -ne 1) -or ($missingCounts.Unexpected -ne 0)) {
    return New-CheckResult -Valid $false
  }

  $duplicated = @($nominal)
  $duplicated += Copy-AuditEvent -Source $nominal[0]
  $duplicateCounts = Get-AuditMultisetCounts -Expected $expected -Candidates $duplicated
  if (($duplicateCounts.Missing -ne 0) -or ($duplicateCounts.Unexpected -ne 1)) {
    return New-CheckResult -Valid $false
  }

  foreach ($property in @('Actor', 'Roles', 'ResourceId', 'Metadata')) {
    $replacement = @($nominal | ForEach-Object { Copy-AuditEvent -Source $_ })
    $replacement[0] = Copy-AuditEvent -Source $replacement[0] -Overrides @{
      $property = 'wrong'
    }
    $replacementCounts = Get-AuditMultisetCounts -Expected $expected -Candidates $replacement
    if (($replacementCounts.Missing -ne 1) -or ($replacementCounts.Unexpected -ne 1)) {
      return New-CheckResult -Valid $false
    }
  }

  $foreign = @($nominal)
  $foreign += Copy-AuditEvent -Source $nominal[0] -Overrides @{
    Actor = 'third-actor'
    Subject = 'third-subject'
    ResourceId = 'foreign'
  }
  $foreignCounts = Get-AuditMultisetCounts -Expected $expected -Candidates $foreign
  if (($foreignCounts.Missing -ne 0) -or ($foreignCounts.Unexpected -ne 1)) {
    return New-CheckResult -Valid $false
  }

  $identityEvent = Copy-AuditEvent -Source $nominal[0] -Overrides @{
    Action = 'IDENTITY.SELECTED'
    ResourceType = 'IDENTITY'
    ResourceId = 'identity'
    Metadata = 'identity-metadata'
  }
  $withIdentity = @($nominal)
  $withIdentity += $identityEvent
  $identityCounts = Get-AuditMultisetCounts -Expected $expected -Candidates $withIdentity
  if (($identityCounts.Missing -ne 0) -or ($identityCounts.Unexpected -ne 1)) {
    return New-CheckResult -Valid $false
  }

  $ambiguousExpected = @($expected | ForEach-Object { Copy-AuditEvent -Source $_ })
  $ambiguousExpected[1] = Copy-AuditEvent -Source $ambiguousExpected[0] -Overrides @{ Slot = 2 }
  $ambiguousCounts = Get-AuditMultisetCounts -Expected $ambiguousExpected -Candidates @($nominal[0])
  if ($ambiguousCounts.Unexpected -le 0) {
    return New-CheckResult -Valid $false
  }
  return New-CheckResult -Valid $true -Value $nominalCounts
}

function New-TestLedgerRecord {
  param(
    [int] $Sequence,
    [string] $State,
    [AllowNull()]
    [object] $PreviousState,
    [string] $RecordedAtUtc,
    [string] $Role,
    [string] $AuthorityType,
    [AllowNull()]
    [object] $ProtocolId,
    [AllowNull()]
    [object] $ProtocolSha256,
    [AllowNull()]
    [object] $FrozenCommit,
    [AllowNull()]
    [object] $CompletedRun = $null,
    [AllowNull()]
    [object] $EvidenceSha256 = $null,
    [AllowNull()]
    [object] $CpoOutcome = $null
  )

  return [pscustomobject][ordered]@{
    schemaVersion = 1
    sequence = $Sequence
    state = $State
    previousState = $PreviousState
    recordedAtUtc = $RecordedAtUtc
    recordedByRole = $Role
    authorityType = $AuthorityType
    authorityRef = "043c-test-authority-$Sequence"
    protocolId = $ProtocolId
    protocolSha256 = $ProtocolSha256
    frozenCommit = $FrozenCommit
    r1Authorized = $false
    r2Authorized = $false
    completedRun = $CompletedRun
    evidenceSha256 = $EvidenceSha256
    cpoOutcome = $CpoOutcome
  }
}

function Copy-TestObject {
  param(
    [object] $Source,
    [hashtable] $Overrides = @{},
    [hashtable] $Additional = @{}
  )

  $values = [ordered]@{}
  foreach ($property in $Source.PSObject.Properties) {
    if ($Overrides.ContainsKey($property.Name)) {
      $values[$property.Name] = $Overrides[$property.Name]
    } else {
      $values[$property.Name] = $property.Value
    }
  }
  foreach ($key in $Additional.Keys) {
    $values[$key] = $Additional[$key]
  }
  return [pscustomobject] $values
}

function Test-HasCode {
  param(
    [object] $Result,
    [string] $Code
  )

  return Test-ContainsOrdinal -Values @($Result.Codes) -Candidate $Code
}

function Copy-TestLedger {
  param(
    [object[]] $Records
  )

  return @($Records | ForEach-Object { Copy-TestObject -Source $_ })
}

function Convert-TestLedgerBlock {
  param(
    [object[]] $Records
  )

  $lines = @($Records | ForEach-Object {
    $_ | ConvertTo-Json -Compress -Depth 8
  })
  return ($lines -join "`n") + "`n"
}

function New-TestSpecDocument {
  param(
    [string] $LedgerBlock,
    [string] $Prefix = 'spec-prefix',
    [string] $Suffix = 'spec-suffix'
  )

  return (
    "$Prefix`n$($script:LedgerBegin)`n" +
    $LedgerBlock +
    "$($script:LedgerEnd)`n$Suffix`n"
  )
}

function New-TestRunbookDocument {
  param(
    [string] $ProtocolText
  )

  return (
    "runbook-prefix`n$($script:ProtocolBegin)`n" +
    $ProtocolText +
    "$($script:ProtocolEnd)`nrunbook-suffix`n"
  )
}

function New-TestRawDiff {
  param(
    [string] $Path,
    [string] $OldObjectId,
    [string] $NewObjectId
  )

  return (
    ':100644 100644 ' +
    $OldObjectId +
    ' ' +
    $NewObjectId +
    ' M' +
    [string] [char] 0 +
    $Path +
    [string] [char] 0
  )
}

function Get-MarkedDocumentSections {
  param(
    [string] $Text,
    [string] $BeginMarker,
    [string] $EndMarker,
    [string] $MissingCode,
    [string] $DuplicatedCode
  )

  $block = Get-MarkedTextBlock -Text $Text -BeginMarker $BeginMarker `
    -EndMarker $EndMarker -MissingCode $MissingCode -DuplicatedCode $DuplicatedCode
  if (-not $block.Valid) {
    return $block
  }

  $beginIndex = $Text.IndexOf($BeginMarker, [System.StringComparison]::Ordinal)
  $contentIndex = $beginIndex + $BeginMarker.Length + 1
  $endIndex = $Text.IndexOf(
    $EndMarker,
    $contentIndex,
    [System.StringComparison]::Ordinal
  )
  if (($beginIndex -lt 0) -or ($endIndex -lt $contentIndex)) {
    return New-CheckResult -Valid $false -Codes @('MARKER_LAYOUT_INVALID')
  }

  return New-CheckResult -Valid $true -Value ([pscustomobject]@{
    Prefix = $Text.Substring(0, $contentIndex)
    Block = [string] $block.Value
    Suffix = $Text.Substring($endIndex)
  })
}

function Convert-GitHeadCommitOutput {
  param(
    [string] $Text
  )

  if (($null -eq $Text) -or ($Text.Length -ne 41) -or
      ($Text[40] -ne [char] 10)) {
    return New-CheckResult -Valid $false -Codes @('GIT_HEAD_INVALID')
  }
  $commit = $Text.Substring(0, 40)
  if ($commit -cnotmatch $script:Git40Pattern) {
    return New-CheckResult -Valid $false -Codes @('GIT_HEAD_INVALID')
  }
  return New-CheckResult -Valid $true -Value $commit
}

function Test-GitIndexFlagsOutput {
  param(
    [string] $Text
  )

  $nul = [char] 0
  if ([string]::IsNullOrEmpty($Text) -or
      ($Text[$Text.Length - 1] -ne $nul)) {
    return New-CheckResult -Valid $false -Codes @('GIT_INDEX_FLAGS_INVALID')
  }

  $body = $Text.Substring(0, $Text.Length - 1)
  $entries = @($body.Split($nul))
  if ($entries.Count -eq 0) {
    return New-CheckResult -Valid $false -Codes @('GIT_INDEX_FLAGS_INVALID')
  }
  foreach ($entry in $entries) {
    if (($entry.Length -lt 3) -or
        ($entry[0] -cne [char] 'H') -or
        ($entry[1] -cne [char] ' ') -or
        ($entry.Substring(2).Length -eq 0)) {
      return New-CheckResult -Valid $false -Codes @('GIT_INDEX_FLAGS_INVALID')
    }
  }
  return New-CheckResult -Valid $true
}

function Test-LinearFrozenHistory {
  param(
    [string] $HistoryText,
    [string] $FrozenCommit,
    [string] $HeadCommit
  )

  if (($FrozenCommit -cnotmatch $script:Git40Pattern) -or
      ($HeadCommit -cnotmatch $script:Git40Pattern) -or
      ($null -eq $HistoryText) -or
      ($HistoryText.Length -eq 0) -or
      (-not $HistoryText.EndsWith("`n", [System.StringComparison]::Ordinal)) -or
      $HistoryText.Contains("`r")) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_HISTORY_INVALID')
  }

  $body = $HistoryText.Substring(0, $HistoryText.Length - 1)
  $lines = @($body.Split([char] 10))
  if (($lines.Count -eq 0) -or ($lines | Where-Object { $_.Length -eq 0 })) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_HISTORY_INVALID')
  }

  $entries = New-Object System.Collections.Generic.List[object]
  $seenCommits = @{}
  $expectedParent = $FrozenCommit
  foreach ($line in $lines) {
    $match = [regex]::Match(
      $line,
      '^([0-9a-f]{40}) ([0-9a-f]{40})$',
      [System.Text.RegularExpressions.RegexOptions]::CultureInvariant
    )
    if (-not $match.Success) {
      return New-CheckResult -Valid $false -Codes @('FROZEN_HISTORY_INVALID')
    }
    $commit = $match.Groups[1].Value
    $parent = $match.Groups[2].Value
    if ((-not [string]::Equals(
          $parent,
          $expectedParent,
          [System.StringComparison]::Ordinal
        )) -or
        [string]::Equals($commit, $parent, [System.StringComparison]::Ordinal) -or
        $seenCommits.ContainsKey($commit)) {
      return New-CheckResult -Valid $false -Codes @('FROZEN_HISTORY_INVALID')
    }
    $seenCommits[$commit] = $true
    [void] $entries.Add([pscustomobject]@{
      Commit = $commit
      Parent = $parent
    })
    $expectedParent = $commit
  }

  if (($entries.Count -eq 0) -or
      (-not [string]::Equals(
        [string] $entries[$entries.Count - 1].Commit,
        $HeadCommit,
        [System.StringComparison]::Ordinal
      ))) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_HISTORY_INVALID')
  }
  return New-CheckResult -Valid $true -Value @($entries.ToArray())
}

function Test-ExactLedgerOnlyRawDiff {
  param(
    [string] $RawDiff
  )

  $nul = [string] [char] 0
  $pattern = (
    '\A:100644 100644 ([0-9a-f]{40}) ([0-9a-f]{40}) M' +
    $nul +
    [regex]::Escape($script:GitSpecPath) +
    $nul +
    '\z'
  )
  $match = [regex]::Match(
    $RawDiff,
    $pattern,
    [System.Text.RegularExpressions.RegexOptions]::CultureInvariant
  )
  if (-not $match.Success) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_RANGE_DIFF_INVALID')
  }

  $zeroObjectId = ('0' * 40) -join ''
  $oldObjectId = $match.Groups[1].Value
  $newObjectId = $match.Groups[2].Value
  if ([string]::Equals($oldObjectId, $zeroObjectId, [System.StringComparison]::Ordinal) -or
      [string]::Equals($newObjectId, $zeroObjectId, [System.StringComparison]::Ordinal) -or
      [string]::Equals($oldObjectId, $newObjectId, [System.StringComparison]::Ordinal)) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_RANGE_DIFF_INVALID')
  }
  return New-CheckResult -Valid $true
}

function Test-SingleLedgerSpecAppend {
  param(
    [string] $PreviousSpecText,
    [string] $NextSpecText,
    [string] $ExpectedProtocolSha256,
    [string] $ExpectedFrozenCommit
  )

  $previous = Get-MarkedDocumentSections -Text $PreviousSpecText `
    -BeginMarker $script:LedgerBegin -EndMarker $script:LedgerEnd `
    -MissingCode 'DURABLE_SOURCE_MISSING' -DuplicatedCode 'DURABLE_SOURCE_DUPLICATED'
  $next = Get-MarkedDocumentSections -Text $NextSpecText `
    -BeginMarker $script:LedgerBegin -EndMarker $script:LedgerEnd `
    -MissingCode 'DURABLE_SOURCE_MISSING' -DuplicatedCode 'DURABLE_SOURCE_DUPLICATED'
  if ((-not $previous.Valid) -or (-not $next.Valid)) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_LEDGER_APPEND_INVALID')
  }

  if ((-not [string]::Equals(
        [string] $previous.Value.Prefix,
        [string] $next.Value.Prefix,
        [System.StringComparison]::Ordinal
      )) -or
      (-not [string]::Equals(
        [string] $previous.Value.Suffix,
        [string] $next.Value.Suffix,
        [System.StringComparison]::Ordinal
      ))) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_SPEC_OUTSIDE_LEDGER_CHANGED')
  }

  $previousBlock = [string] $previous.Value.Block
  $nextBlock = [string] $next.Value.Block
  if (($nextBlock.Length -le $previousBlock.Length) -or
      (-not $nextBlock.StartsWith(
        $previousBlock,
        [System.StringComparison]::Ordinal
      ))) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_PRIOR_LEDGER_MUTATION')
  }

  $addedRecord = $nextBlock.Substring($previousBlock.Length)
  if (($addedRecord.Length -lt 2) -or
      (-not $addedRecord.EndsWith("`n", [System.StringComparison]::Ordinal))) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_LEDGER_APPEND_INVALID')
  }
  $addedRecordBody = $addedRecord.Substring(0, $addedRecord.Length - 1)
  if (($addedRecordBody.Length -eq 0) -or
      $addedRecordBody.Contains("`n") -or
      $addedRecordBody.Contains("`r")) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_LEDGER_APPEND_INVALID')
  }

  $previousRecords = Convert-LedgerBlock -Block $previousBlock
  $nextRecords = Convert-LedgerBlock -Block $nextBlock
  if ((-not $previousRecords.Valid) -or (-not $nextRecords.Valid) -or
      (@($nextRecords.Value).Count -ne (@($previousRecords.Value).Count + 1))) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_LEDGER_APPEND_INVALID')
  }

  $previousValidation = Test-DurableLedger -Records @($previousRecords.Value) `
    -ExpectedProtocolSha256 $ExpectedProtocolSha256 `
    -ExpectedFrozenCommit $ExpectedFrozenCommit
  $nextValidation = Test-DurableLedger -Records @($nextRecords.Value) `
    -ExpectedProtocolSha256 $ExpectedProtocolSha256 `
    -ExpectedFrozenCommit $ExpectedFrozenCommit
  if ((-not $previousValidation.Valid) -or (-not $nextValidation.Valid)) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_LEDGER_APPEND_INVALID')
  }
  return New-CheckResult -Valid $true -Value $nextValidation.Value
}

function Test-FrozenGitEvidence {
  param(
    [object] $Evidence
  )

  if (($null -eq $Evidence) -or
      ($Evidence.FrozenCommit -isnot [string]) -or
      ([string] $Evidence.FrozenCommit -cnotmatch $script:Git40Pattern) -or
      ($Evidence.ProtocolSha256 -isnot [string]) -or
      ([string] $Evidence.ProtocolSha256 -cnotmatch $script:Hex64Pattern)) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_GIT_EVIDENCE_INVALID')
  }
  if (($Evidence.WorktreeStatus -isnot [string]) -or
      ([string] $Evidence.WorktreeStatus).Length -ne 0) {
    return New-CheckResult -Valid $false -Codes @('GIT_STATE_INVALID')
  }
  $indexFlags = Test-GitIndexFlagsOutput -Text ([string] $Evidence.IndexFlagsOutput)
  if (-not $indexFlags.Valid) {
    return $indexFlags
  }
  if (($Evidence.AncestorValid -isnot [bool]) -or (-not $Evidence.AncestorValid)) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_COMMIT_NOT_ANCESTOR')
  }

  $head = Convert-GitHeadCommitOutput -Text ([string] $Evidence.HeadCommitOutput)
  if (-not $head.Valid) {
    return $head
  }
  $history = Test-LinearFrozenHistory -HistoryText ([string] $Evidence.HistoryOutput) `
    -FrozenCommit ([string] $Evidence.FrozenCommit) -HeadCommit ([string] $head.Value)
  if (-not $history.Valid) {
    return $history
  }

  $frozenProtocol = Get-MarkedTextBlock -Text ([string] $Evidence.FrozenRunbookText) `
    -BeginMarker $script:ProtocolBegin -EndMarker $script:ProtocolEnd `
    -MissingCode 'PROTOCOL_SOURCE_MISSING' -DuplicatedCode 'PROTOCOL_SOURCE_DUPLICATED'
  $headProtocol = Get-MarkedTextBlock -Text ([string] $Evidence.HeadRunbookText) `
    -BeginMarker $script:ProtocolBegin -EndMarker $script:ProtocolEnd `
    -MissingCode 'PROTOCOL_SOURCE_MISSING' -DuplicatedCode 'PROTOCOL_SOURCE_DUPLICATED'
  if ((-not $frozenProtocol.Valid) -or (-not $headProtocol.Valid) -or
      (-not [string]::Equals(
        [string] $frozenProtocol.Value,
        [string] $headProtocol.Value,
        [System.StringComparison]::Ordinal
      )) -or
      (-not [string]::Equals(
        [string] $headProtocol.Value,
        [string] $Evidence.CurrentProtocolText,
        [System.StringComparison]::Ordinal
      ))) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_PROTOCOL_MISMATCH')
  }

  $entries = @($history.Value)
  $steps = @($Evidence.CommitSteps)
  if ($steps.Count -ne $entries.Count) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_HISTORY_INVALID')
  }

  $previousSpecText = [string] $Evidence.FrozenSpecText
  for ($index = 0; $index -lt $entries.Count; $index += 1) {
    $entry = $entries[$index]
    $step = $steps[$index]
    if (($null -eq $step) -or
        (-not [string]::Equals(
          [string] $step.Commit,
          [string] $entry.Commit,
          [System.StringComparison]::Ordinal
        ))) {
      return New-CheckResult -Valid $false -Codes @('FROZEN_HISTORY_INVALID')
    }
    $rawDiff = Test-ExactLedgerOnlyRawDiff -RawDiff ([string] $step.RawDiff)
    if (-not $rawDiff.Valid) {
      return $rawDiff
    }
    $append = Test-SingleLedgerSpecAppend -PreviousSpecText $previousSpecText `
      -NextSpecText ([string] $step.SpecText) `
      -ExpectedProtocolSha256 ([string] $Evidence.ProtocolSha256) `
      -ExpectedFrozenCommit ([string] $Evidence.FrozenCommit)
    if (-not $append.Valid) {
      return $append
    }
    $previousSpecText = [string] $step.SpecText
  }

  if (-not [string]::Equals(
    $previousSpecText,
    [string] $Evidence.CurrentSpecText,
    [System.StringComparison]::Ordinal
  )) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_HEAD_SPEC_MISMATCH')
  }
  return New-CheckResult -Valid $true
}

function Convert-CatalogProof {
  param(
    [AllowNull()]
    [object] $Output
  )

  if ($Output -isnot [string]) {
    return New-CheckResult -Valid $false -Codes @('CATALOG_PROOF_INVALID')
  }
  $normalized = ([string] $Output).Replace("`r`n", "`n")
  if ($normalized.Contains("`r")) {
    return New-CheckResult -Valid $false -Codes @('CATALOG_PROOF_INVALID')
  }
  $lines = @($normalized.Split([char] 10))
  if (($lines.Count -ne 4) -or ($lines[3] -cne '')) {
    return New-CheckResult -Valid $false -Codes @('CATALOG_PROOF_INVALID')
  }

  $authParts = @($lines[0].Split([char] 124))
  $expectedAuthParts = @(
    'AUTH',
    'postgres',
    'ritomer_043c_catalog_reader',
    'ritomer_043c_catalog_reader',
    '127.0.0.1',
    '5432'
  )
  if (-not (Test-OrdinalSequence -Actual $authParts -Expected $expectedAuthParts)) {
    return New-CheckResult -Valid $false -Codes @('CATALOG_PROOF_INVALID')
  }

  $expectedRuns = @(
    [pscustomobject]@{
      Run = 'R1'
      DatabaseName = 'ritomer_043c_r1'
      RoleName = 'ritomer_043c_r1_runner'
      LineIndex = 1
    },
    [pscustomobject]@{
      Run = 'R2'
      DatabaseName = 'ritomer_043c_r2'
      RoleName = 'ritomer_043c_r2_runner'
      LineIndex = 2
    }
  )
  $states = [ordered]@{
    R1 = 'OTHER'
    R2 = 'OTHER'
  }
  foreach ($expected in $expectedRuns) {
    $parts = @($lines[$expected.LineIndex].Split([char] 124))
    if (($parts.Count -ne 13) -or
        ($parts[0] -cne $expected.Run) -or
        ($parts[1] -cne $expected.DatabaseName) -or
        ($parts[4] -cne $expected.RoleName)) {
      return New-CheckResult -Valid $false -Codes @('CATALOG_PROOF_INVALID')
    }
    foreach ($binaryIndex in @(2, 5, 6, 7, 8, 9, 10, 11)) {
      if (($parts[$binaryIndex] -cne '0') -and ($parts[$binaryIndex] -cne '1')) {
        return New-CheckResult -Valid $false -Codes @('CATALOG_PROOF_INVALID')
      }
    }
    if ($parts[12] -cnotmatch '^(?:0|[1-9][0-9]*)$') {
      return New-CheckResult -Valid $false -Codes @('CATALOG_PROOF_INVALID')
    }

    $safePresent = ($parts[2] -ceq '1') -and
      ($parts[3] -ceq $expected.RoleName) -and
      ($parts[5] -ceq '1') -and
      ($parts[6] -ceq '1') -and
      ($parts[7] -ceq '0') -and
      ($parts[8] -ceq '0') -and
      ($parts[9] -ceq '0') -and
      ($parts[10] -ceq '0') -and
      ($parts[11] -ceq '0') -and
      ($parts[12] -ceq '0')
    $exactlyAbsent = ($parts[2] -ceq '0') -and
      ($parts[3] -ceq '') -and
      ($parts[5] -ceq '0') -and
      ($parts[6] -ceq '0') -and
      ($parts[7] -ceq '0') -and
      ($parts[8] -ceq '0') -and
      ($parts[9] -ceq '0') -and
      ($parts[10] -ceq '0') -and
      ($parts[11] -ceq '0') -and
      ($parts[12] -ceq '0')
    if ($safePresent) {
      $states[$expected.Run] = 'CATALOG_TARGET_PRESENT_POLICY_SAFE'
    } elseif ($exactlyAbsent) {
      $states[$expected.Run] = 'ABSENT'
    } else {
      return New-CheckResult -Valid $false -Codes @('CATALOG_PROOF_INVALID')
    }
  }

  return New-CheckResult -Valid $true -Value ([pscustomobject]@{
    R1 = $states.R1
    R2 = $states.R2
  })
}

function Test-ApprovedLocalApplicationDataRoot {
  param(
    [AllowNull()]
    [object] $CandidateRoot,
    [System.IO.DriveType] $DriveType
  )

  if (($CandidateRoot -isnot [string]) -or
      [string]::IsNullOrWhiteSpace([string] $CandidateRoot)) {
    return New-CheckResult -Valid $false -Codes @('LOCALAPPDATA_ROOT_INVALID')
  }

  $candidate = [string] $CandidateRoot
  $devicePrefixes = @('\\?\', '\\.\', '\??\')
  foreach ($devicePrefix in $devicePrefixes) {
    if ($candidate.StartsWith(
      $devicePrefix,
      [System.StringComparison]::OrdinalIgnoreCase
    )) {
      return New-CheckResult -Valid $false -Codes @('LOCALAPPDATA_ROOT_INVALID')
    }
  }
  if ($candidate.StartsWith(
      '\\',
      [System.StringComparison]::Ordinal
    ) -or
      $candidate.Contains('/') -or
      ($candidate -cmatch '^[A-Za-z][A-Za-z0-9+.-]+:') -or
      ($candidate -cnotmatch '^[A-Za-z]:\\')) {
    return New-CheckResult -Valid $false -Codes @('LOCALAPPDATA_ROOT_INVALID')
  }

  try {
    $canonicalFull = [System.IO.Path]::GetFullPath($candidate)
    $canonicalRoot = $canonicalFull.TrimEnd(
      [System.IO.Path]::DirectorySeparatorChar,
      [System.IO.Path]::AltDirectorySeparatorChar
    )
    $candidateCanonicalForm = $candidate.TrimEnd(
      [System.IO.Path]::DirectorySeparatorChar,
      [System.IO.Path]::AltDirectorySeparatorChar
    )
    $volumeRoot = [System.IO.Path]::GetPathRoot($canonicalFull)
    if ([string]::IsNullOrWhiteSpace($canonicalRoot) -or
        [string]::IsNullOrWhiteSpace($volumeRoot) -or
        ($volumeRoot -cnotmatch '^[A-Za-z]:\\$') -or
        (-not [string]::Equals(
          $candidateCanonicalForm,
          $canonicalRoot,
          [System.StringComparison]::OrdinalIgnoreCase
        )) -or
        (-not $canonicalRoot.StartsWith(
          $volumeRoot,
          [System.StringComparison]::OrdinalIgnoreCase
        )) -or
        [string]::Equals(
          $canonicalRoot,
          $volumeRoot.TrimEnd(
            [System.IO.Path]::DirectorySeparatorChar,
            [System.IO.Path]::AltDirectorySeparatorChar
          ),
          [System.StringComparison]::OrdinalIgnoreCase
        )) {
      return New-CheckResult -Valid $false -Codes @('LOCALAPPDATA_ROOT_INVALID')
    }
    if ($DriveType -eq [System.IO.DriveType]::Network) {
      return New-CheckResult -Valid $false -Codes @('LOCALAPPDATA_ROOT_INVALID')
    }
    if ($DriveType -ne [System.IO.DriveType]::Fixed) {
      return New-CheckResult -Valid $false -Codes @('LOCALAPPDATA_ROOT_INVALID')
    }
    return New-CheckResult -Valid $true -Value ([pscustomobject]@{
      CanonicalRoot = $canonicalRoot
      VolumeRoot = $volumeRoot
    })
  } catch {
    return New-CheckResult -Valid $false -Codes @('LOCALAPPDATA_ROOT_INVALID')
  }
}

function Test-StorageComponentChain {
  param(
    [string] $ApprovedRootCanonical,
    [ValidateSet('R1', 'R2')]
    [string] $Run,
    [object[]] $Components
  )

  $expectedNames = @(
    'LocalApplicationData',
    'Ritomer',
    '043c',
    $script:ProtocolId,
    'runtime',
    $Run,
    'storage'
  )
  if ($Components.Count -ne $expectedNames.Count) {
    return 'OTHER'
  }

  try {
    $approvedRoot = [System.IO.Path]::GetFullPath($ApprovedRootCanonical).TrimEnd(
      [System.IO.Path]::DirectorySeparatorChar,
      [System.IO.Path]::AltDirectorySeparatorChar
    )
    $volumeRoot = [System.IO.Path]::GetPathRoot($approvedRoot).TrimEnd(
      [System.IO.Path]::DirectorySeparatorChar,
      [System.IO.Path]::AltDirectorySeparatorChar
    )
    if ([string]::IsNullOrWhiteSpace($approvedRoot) -or
        [string]::Equals(
          $approvedRoot,
          $volumeRoot,
          [System.StringComparison]::OrdinalIgnoreCase
        )) {
      return 'OTHER'
    }

    $parentCanonical = $null
    $missingSeen = $false
    for ($index = 0; $index -lt $expectedNames.Count; $index += 1) {
      $component = $Components[$index]
      if (($component.Name -isnot [string]) -or
          ($component.CanonicalPath -isnot [string]) -or
          ($component.Exists -isnot [bool]) -or
          ($component.IsDirectory -isnot [bool]) -or
          ($component.IsReparsePoint -isnot [bool]) -or
          ([string] $component.Name -cne $expectedNames[$index])) {
        return 'OTHER'
      }
      $candidateCanonical = [System.IO.Path]::GetFullPath(
        [string] $component.CanonicalPath
      ).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
      )
      if ($index -eq 0) {
        if (-not [string]::Equals(
          $candidateCanonical,
          $approvedRoot,
          [System.StringComparison]::OrdinalIgnoreCase
        )) {
          return 'OTHER'
        }
      } else {
        $expectedCanonical = [System.IO.Path]::GetFullPath(
          [System.IO.Path]::Combine($parentCanonical, $expectedNames[$index])
        ).TrimEnd(
          [System.IO.Path]::DirectorySeparatorChar,
          [System.IO.Path]::AltDirectorySeparatorChar
        )
        $parentPrefix = $parentCanonical + [System.IO.Path]::DirectorySeparatorChar
        if ((-not [string]::Equals(
          $candidateCanonical,
          $expectedCanonical,
          [System.StringComparison]::OrdinalIgnoreCase
        )) -or
            (-not $candidateCanonical.StartsWith(
              $parentPrefix,
              [System.StringComparison]::OrdinalIgnoreCase
            ))) {
          return 'OTHER'
        }
      }

      if ($missingSeen) {
        if ($component.Exists) {
          return 'OTHER'
        }
      } elseif (-not $component.Exists) {
        if (($index -eq 0) -or $component.IsDirectory -or
            $component.IsReparsePoint) {
          return 'OTHER'
        }
        $missingSeen = $true
      } elseif ((-not $component.IsDirectory) -or $component.IsReparsePoint) {
        return 'OTHER'
      }
      $parentCanonical = $candidateCanonical
    }
    if ($missingSeen) {
      return 'ABSENT'
    }
    return 'PRESENT_SAFE'
  } catch {
    return 'OTHER'
  }
}

function New-TestStorageChain {
  param(
    [ValidateSet('R1', 'R2')]
    [string] $Run
  )

  $names = @(
    'LocalApplicationData',
    'Ritomer',
    '043c',
    $script:ProtocolId,
    'runtime',
    $Run,
    'storage'
  )
  $root = 'C:\Synthetic\LocalApplicationData'
  $currentPath = $root
  $components = New-Object System.Collections.Generic.List[object]
  for ($index = 0; $index -lt $names.Count; $index += 1) {
    if ($index -gt 0) {
      $currentPath = [System.IO.Path]::Combine($currentPath, $names[$index])
    }
    [void] $components.Add([pscustomobject]@{
      Name = $names[$index]
      CanonicalPath = [System.IO.Path]::GetFullPath($currentPath)
      Exists = $true
      IsDirectory = $true
      IsReparsePoint = $false
    })
  }
  return @($components.ToArray())
}

function Get-LocalArtifactDefinition {
  param(
    [ValidateSet(
      'AUTHORIZATION',
      'ACTIVE_STATE',
      'R1_EVIDENCE',
      'R2_EVIDENCE'
    )]
    [string] $ArtifactId
  )

  $relativePath = [string] $script:LocalArtifactRelativePaths[$ArtifactId]
  $relativeComponents = @($relativePath -split '\\')
  return [pscustomobject]@{
    ArtifactId = $ArtifactId
    RelativePath = $relativePath
    RelativeComponents = $relativeComponents
  }
}

function Get-LocalArtifactObservationToken {
  param(
    [object[]] $Components
  )

  $lines = New-Object System.Collections.Generic.List[string]
  foreach ($component in $Components) {
    [void] $lines.Add((
      ([string] $component.Name) + '|' +
      ([string] $component.CanonicalPath) + '|' +
      ([string] $component.Exists) + '|' +
      ([string] $component.Attributes) + '|' +
      ([string] $component.IsDirectory) + '|' +
      ([string] $component.IsReparsePoint) + '|' +
      ([string] $component.Length) + '|' +
      ([string] $component.LastWriteUtcTicks)
    ))
  }
  return $lines -join "`n"
}

function Test-LocalArtifactComponentChain {
  param(
    [string] $ApprovedRootCanonical,
    [string] $ProtocolId,
    [ValidateSet(
      'AUTHORIZATION',
      'ACTIVE_STATE',
      'R1_EVIDENCE',
      'R2_EVIDENCE'
    )]
    [string] $ArtifactId,
    [ValidateSet('PRESENT', 'ABSENT')]
    [string] $ExpectedState,
    [object[]] $Components
  )

  try {
    if ($ProtocolId -cne $script:ProtocolId) {
      return New-CheckResult -Valid $false -Codes @('LOCAL_ARTIFACT_PROTOCOL_INVALID')
    }
    $definition = Get-LocalArtifactDefinition -ArtifactId $ArtifactId
    $expectedNames = @(
      'LocalApplicationData',
      'Ritomer',
      '043c',
      $ProtocolId
    ) + @($definition.RelativeComponents)
    if ($Components.Count -ne $expectedNames.Count) {
      return New-CheckResult -Valid $false -Codes @('LOCAL_ARTIFACT_CHAIN_INVALID')
    }

    $approvedRoot = [System.IO.Path]::GetFullPath($ApprovedRootCanonical).TrimEnd(
      [System.IO.Path]::DirectorySeparatorChar,
      [System.IO.Path]::AltDirectorySeparatorChar
    )
    $volumeRoot = [System.IO.Path]::GetPathRoot($approvedRoot).TrimEnd(
      [System.IO.Path]::DirectorySeparatorChar,
      [System.IO.Path]::AltDirectorySeparatorChar
    )
    if ([string]::IsNullOrWhiteSpace($approvedRoot) -or
        [string]::Equals(
          $approvedRoot,
          $volumeRoot,
          [System.StringComparison]::OrdinalIgnoreCase
        )) {
      return New-CheckResult -Valid $false -Codes @('LOCAL_ARTIFACT_ROOT_INVALID')
    }

    $parentCanonical = $null
    $missingSeen = $false
    $finalIndex = $expectedNames.Count - 1
    for ($index = 0; $index -lt $expectedNames.Count; $index += 1) {
      $component = $Components[$index]
      if (($component.Name -isnot [string]) -or
          ($component.CanonicalPath -isnot [string]) -or
          ($component.Exists -isnot [bool]) -or
          ($component.Attributes -isnot [int]) -or
          ($component.IsDirectory -isnot [bool]) -or
          ($component.IsReparsePoint -isnot [bool]) -or
          ($component.Length -isnot [int64]) -or
          ($component.LastWriteUtcTicks -isnot [int64]) -or
          ([string] $component.Name -cne $expectedNames[$index])) {
        return New-CheckResult -Valid $false -Codes @('LOCAL_ARTIFACT_CHAIN_INVALID')
      }

      $candidateCanonical = [System.IO.Path]::GetFullPath(
        [string] $component.CanonicalPath
      ).TrimEnd(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
      )
      if ($index -eq 0) {
        if (-not [string]::Equals(
          $candidateCanonical,
          $approvedRoot,
          [System.StringComparison]::OrdinalIgnoreCase
        )) {
          return New-CheckResult -Valid $false -Codes @(
            'LOCAL_ARTIFACT_CANONICAL_INVALID'
          )
        }
      } else {
        $expectedCanonical = [System.IO.Path]::GetFullPath(
          [System.IO.Path]::Combine($parentCanonical, $expectedNames[$index])
        ).TrimEnd(
          [System.IO.Path]::DirectorySeparatorChar,
          [System.IO.Path]::AltDirectorySeparatorChar
        )
        $parentPrefix = $parentCanonical + [System.IO.Path]::DirectorySeparatorChar
        if ((-not [string]::Equals(
          $candidateCanonical,
          $expectedCanonical,
          [System.StringComparison]::OrdinalIgnoreCase
        )) -or
            (-not $candidateCanonical.StartsWith(
              $parentPrefix,
              [System.StringComparison]::OrdinalIgnoreCase
            ))) {
          return New-CheckResult -Valid $false -Codes @(
            'LOCAL_ARTIFACT_CANONICAL_INVALID'
          )
        }
      }

      if ($missingSeen -and $component.Exists) {
        return New-CheckResult -Valid $false -Codes @('LOCAL_ARTIFACT_CHAIN_INVALID')
      }
      if (-not $component.Exists) {
        if (($index -eq 0) -or
            ($component.Attributes -ne 0) -or
            $component.IsDirectory -or
            $component.IsReparsePoint -or
            ($component.Length -ne -1) -or
            ($component.LastWriteUtcTicks -ne 0)) {
          return New-CheckResult -Valid $false -Codes @('LOCAL_ARTIFACT_CHAIN_INVALID')
        }
        $missingSeen = $true
      } else {
        $attributeDirectory = (
          ($component.Attributes -band [int] [System.IO.FileAttributes]::Directory) -ne 0
        )
        $attributeReparse = (
          ($component.Attributes -band [int] [System.IO.FileAttributes]::ReparsePoint) -ne 0
        )
        if (($component.IsDirectory -ne $attributeDirectory) -or
            ($component.IsReparsePoint -ne $attributeReparse) -or
            ($component.LastWriteUtcTicks -lt 0)) {
          return New-CheckResult -Valid $false -Codes @('LOCAL_ARTIFACT_CHAIN_INVALID')
        }
        if ($index -lt $finalIndex) {
          if ((-not $component.IsDirectory) -or
              $component.IsReparsePoint -or
              ($component.Length -ne -1)) {
            return New-CheckResult -Valid $false -Codes @(
              'LOCAL_ARTIFACT_PARENT_UNSAFE'
            )
          }
        } elseif ($component.IsDirectory -or
            $component.IsReparsePoint -or
            ($component.Length -lt 0)) {
          return New-CheckResult -Valid $false -Codes @(
            'LOCAL_ARTIFACT_FINAL_UNSAFE'
          )
        }
      }
      $parentCanonical = $candidateCanonical
    }

    $finalExists = [bool] $Components[$finalIndex].Exists
    if (($ExpectedState -ceq 'PRESENT' -and -not $finalExists) -or
        ($ExpectedState -ceq 'ABSENT' -and $finalExists)) {
      return New-CheckResult -Valid $false -Codes @('LOCAL_ARTIFACT_STATE_INVALID')
    }
    $state = if ($finalExists) { 'PRESENT_SAFE' } else { 'ABSENT_SAFE' }
    return New-CheckResult -Valid $true -Value ([pscustomobject]@{
      ArtifactId = $ArtifactId
      State = $state
      ArtifactPath = [string] $Components[$finalIndex].CanonicalPath
      ObservationToken = Get-LocalArtifactObservationToken -Components $Components
      FileLength = [int64] $Components[$finalIndex].Length
    })
  } catch {
    return New-CheckResult -Valid $false -Codes @('LOCAL_ARTIFACT_CHAIN_INVALID')
  }
}

function Test-SafeLocalJsonReadObservations {
  param(
    [object] $Before,
    [object] $After,
    [byte[]] $Bytes,
    [string[]] $ExpectedKeys
  )

  if (($null -eq $Before) -or ($null -eq $After) -or
      (-not $Before.Valid) -or (-not $After.Valid) -or
      ([string] $Before.Value.State -cne 'PRESENT_SAFE') -or
      ([string] $After.Value.State -cne 'PRESENT_SAFE') -or
      ([string] $Before.Value.ArtifactId -cne [string] $After.Value.ArtifactId) -or
      ([string] $Before.Value.ArtifactPath -cne [string] $After.Value.ArtifactPath) -or
      ([string] $Before.Value.ObservationToken -cne
        [string] $After.Value.ObservationToken) -or
      ([int64] $Before.Value.FileLength -ne $Bytes.Count) -or
      ([int64] $After.Value.FileLength -ne $Bytes.Count)) {
    return New-CheckResult -Valid $false -Codes @('LOCAL_ARTIFACT_CHANGED')
  }
  $validated = Test-StrictJsonBytes -Bytes $Bytes -ExpectedKeys $ExpectedKeys
  if (-not $validated.Valid) {
    return New-CheckResult -Valid $false -Codes @('LOCAL_ARTIFACT_INVALID')
  }
  return New-CheckResult -Valid $true -Value ([pscustomobject]@{
    Bytes = $Bytes
    Record = $validated.Value
    Sha256 = Get-Sha256Hex -Bytes $Bytes
  })
}

function New-TestLocalArtifactChain {
  param(
    [ValidateSet(
      'AUTHORIZATION',
      'ACTIVE_STATE',
      'R1_EVIDENCE',
      'R2_EVIDENCE'
    )]
    [string] $ArtifactId,
    [int64] $FileLength = 32
  )

  $definition = Get-LocalArtifactDefinition -ArtifactId $ArtifactId
  $names = @(
    'LocalApplicationData',
    'Ritomer',
    '043c',
    $script:ProtocolId
  ) + @($definition.RelativeComponents)
  $root = 'C:\Synthetic\LocalApplicationData'
  $currentPath = $root
  $components = New-Object System.Collections.Generic.List[object]
  for ($index = 0; $index -lt $names.Count; $index += 1) {
    if ($index -gt 0) {
      $currentPath = [System.IO.Path]::Combine($currentPath, $names[$index])
    }
    $isFinal = $index -eq ($names.Count - 1)
    [void] $components.Add([pscustomobject]@{
      Name = $names[$index]
      CanonicalPath = [System.IO.Path]::GetFullPath($currentPath)
      Exists = $true
      Attributes = [int] $(if ($isFinal) {
        [System.IO.FileAttributes]::Normal
      } else {
        [System.IO.FileAttributes]::Directory
      })
      IsDirectory = -not $isFinal
      IsReparsePoint = $false
      Length = [int64] $(if ($isFinal) { $FileLength } else { -1 })
      LastWriteUtcTicks = [int64] 638712864000000000
    })
  }
  return @($components.ToArray())
}

function Add-ProbeOutcome {
  param(
    [System.Collections.Generic.List[string]] $Succeeded,
    [System.Collections.Generic.List[string]] $Failed,
    [string] $Topic,
    [bool] $Condition
  )

  if ($Condition) {
    [void] $Succeeded.Add($Topic)
  } else {
    [void] $Failed.Add($Topic)
  }
}

function Invoke-SelfTest {
  $testProtocolText = "protocolId = $($script:ProtocolId)`n"
  $protocolHash = Get-Sha256Hex -Bytes (Get-Utf8Bytes -Text $testProtocolText)
  $frozenCommit = ('b' * 40) -join ''
  $evidenceHash = ('c' * 64) -join ''
  $ledger = @(
    (New-TestLedgerRecord -Sequence 0 -State $script:States.S0 -PreviousState $null `
      -RecordedAtUtc '2026-01-01T00:00:00.000Z' -Role 'CPO' `
      -AuthorityType 'CPO_PLAN_HARDENING_DECISION' -ProtocolId $null `
      -ProtocolSha256 $null -FrozenCommit $null),
    (New-TestLedgerRecord -Sequence 1 -State $script:States.S1 `
      -PreviousState $script:States.S0 -RecordedAtUtc '2026-01-01T00:00:00.001Z' `
      -Role 'CPO' -AuthorityType 'CPO_PREPARATORY_IMPLEMENTATION_DECISION' `
      -ProtocolId $null -ProtocolSha256 $null -FrozenCommit $null),
    (New-TestLedgerRecord -Sequence 2 -State $script:States.S2 `
      -PreviousState $script:States.S1 -RecordedAtUtc '2026-01-01T00:00:00.002Z' `
      -Role 'PREPARATION_OWNER' -AuthorityType 'PREPARATORY_IMPLEMENTATION_EVIDENCE' `
      -ProtocolId $script:ProtocolId -ProtocolSha256 $protocolHash -FrozenCommit $null),
    (New-TestLedgerRecord -Sequence 3 -State $script:States.S3 `
      -PreviousState $script:States.S2 -RecordedAtUtc '2026-01-01T00:00:00.003Z' `
      -Role 'CPO' -AuthorityType 'CPO_POST_CODE_REVIEW' `
      -ProtocolId $script:ProtocolId -ProtocolSha256 $protocolHash -FrozenCommit $null),
    (New-TestLedgerRecord -Sequence 4 -State $script:States.S4 `
      -PreviousState $script:States.S3 -RecordedAtUtc '2026-01-01T00:00:00.004Z' `
      -Role 'CTO' -AuthorityType 'CTO_GATE' `
      -ProtocolId $script:ProtocolId -ProtocolSha256 $protocolHash `
      -FrozenCommit $frozenCommit)
  )

  $succeeded = New-Object System.Collections.Generic.List[string]
  $failed = New-Object System.Collections.Generic.List[string]
  $baseResult = Test-DurableLedger -Records $ledger `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
  $auditResult = Test-AuditSelfProbes
  $r1DescriptorBytes = Get-Utf8Bytes -Text (Get-ResourceDescriptor -Run 'R1')
  $r2DescriptorBytes = Get-Utf8Bytes -Text (Get-ResourceDescriptor -Run 'R2')
  $resourcePrecondition = ($r1DescriptorBytes.Count -eq 180) -and
    ($r2DescriptorBytes.Count -eq 180) -and
    ((Get-Sha256Hex -Bytes $r1DescriptorBytes) -ceq
      '318de7101897fd534aa91fed72243fbfb29e78ac5951c57dccf09251b4d7b3b8') -and
    ((Get-Sha256Hex -Bytes $r2DescriptorBytes) -ceq
      'dfc660e524eb9d91f7ee8f6e4d9273cac36c1c92d3595e285ba0afda8f78e2ef')
  if ((-not $baseResult.Valid) -or (-not $auditResult.Valid) -or
      (-not $resourcePrecondition)) {
    return [pscustomobject]@{
      Valid = $false
      Topics = @()
      Audit = [pscustomobject]@{ Expected = 0; Missing = 0; Unexpected = 0 }
    }
  }

  $sourceMissing = Get-MarkedTextBlock -Text 'no durable block' `
    -BeginMarker $script:LedgerBegin -EndMarker $script:LedgerEnd `
    -MissingCode 'DURABLE_SOURCE_MISSING' -DuplicatedCode 'DURABLE_SOURCE_DUPLICATED'
  Add-ProbeOutcome -Succeeded $succeeded -Failed $failed `
    -Topic 'DURABLE_SOURCE_MISSING' `
    -Condition (Test-HasCode -Result $sourceMissing -Code 'DURABLE_SOURCE_MISSING')

  $duplicatedText = (
    "$($script:LedgerBegin)`n{}`n$($script:LedgerEnd)`n" +
    "$($script:LedgerBegin)`n{}`n$($script:LedgerEnd)`n"
  )
  $sourceDuplicated = Get-MarkedTextBlock -Text $duplicatedText `
    -BeginMarker $script:LedgerBegin -EndMarker $script:LedgerEnd `
    -MissingCode 'DURABLE_SOURCE_MISSING' -DuplicatedCode 'DURABLE_SOURCE_DUPLICATED'
  Add-ProbeOutcome -Succeeded $succeeded -Failed $failed `
    -Topic 'DURABLE_SOURCE_DUPLICATED' `
    -Condition (Test-HasCode -Result $sourceDuplicated -Code 'DURABLE_SOURCE_DUPLICATED')

  $variant = Copy-TestLedger -Records $ledger
  $variant[2] = Copy-TestObject -Source $variant[2] -Overrides @{ sequence = 3 }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'SEQUENCE_GAP' `
    (Test-HasCode $result 'SEQUENCE_GAP')

  $variant = Copy-TestLedger -Records $ledger
  $variant[2] = Copy-TestObject -Source $variant[2] -Overrides @{ sequence = 1 }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'SEQUENCE_DUPLICATE' `
    (Test-HasCode $result 'SEQUENCE_DUPLICATE')

  $variant = Copy-TestLedger -Records $ledger
  $variant[2] = Copy-TestObject -Source $variant[2] -Overrides @{
    previousState = $script:States.S0
  }
  $declaredPreviousResult = Test-DurableLedger -Records $variant `
    -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit

  $originVariant = @(
    (Copy-TestObject -Source $ledger[4] -Overrides @{ sequence = 0 })
  )
  $originResult = Test-DurableLedger -Records $originVariant `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit

  $skippedTransitionVariant = Copy-TestLedger -Records $ledger
  $skippedTransitionVariant += New-TestLedgerRecord -Sequence 5 `
    -State $script:States.F1 -PreviousState $script:States.S10 `
    -RecordedAtUtc '2026-01-01T00:00:00.005Z' -Role 'CPO' `
    -AuthorityType 'CPO_FINAL_DECISION' -ProtocolId $script:ProtocolId `
    -ProtocolSha256 $protocolHash -FrozenCommit $frozenCommit -CompletedRun 'R2' `
    -EvidenceSha256 $evidenceHash -CpoOutcome $script:States.F1
  $skippedTransitionResult = Test-DurableLedger -Records $skippedTransitionVariant `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit

  $afterTerminalVariant = Copy-TestLedger -Records $ledger
  $afterTerminalVariant += New-TestLedgerRecord -Sequence 5 `
    -State $script:States.S7 -PreviousState $script:States.S6 `
    -RecordedAtUtc '2026-01-01T00:00:00.005Z' -Role 'COORDINATOR_043C' `
    -AuthorityType 'R1_CLEANUP_EVIDENCE' -ProtocolId $script:ProtocolId `
    -ProtocolSha256 $protocolHash -FrozenCommit $frozenCommit -CompletedRun 'R1' `
    -EvidenceSha256 $evidenceHash
  $afterTerminalVariant += New-TestLedgerRecord -Sequence 6 `
    -State $script:States.F2 -PreviousState $script:States.S7 `
    -RecordedAtUtc '2026-01-01T00:00:00.006Z' -Role 'CPO' `
    -AuthorityType 'CPO_FINAL_DECISION' -ProtocolId $script:ProtocolId `
    -ProtocolSha256 $protocolHash -FrozenCommit $frozenCommit -CompletedRun 'R1' `
    -EvidenceSha256 $evidenceHash -CpoOutcome $script:States.F2
  $afterTerminalVariant += New-TestLedgerRecord -Sequence 7 `
    -State $script:States.F3 -PreviousState $script:States.S7 `
    -RecordedAtUtc '2026-01-01T00:00:00.007Z' -Role 'CPO' `
    -AuthorityType 'CPO_FINAL_DECISION' -ProtocolId $script:ProtocolId `
    -ProtocolSha256 $protocolHash -FrozenCommit $frozenCommit -CompletedRun 'R1' `
    -EvidenceSha256 $evidenceHash -CpoOutcome $script:States.F3
  $afterTerminalResult = Test-DurableLedger -Records $afterTerminalVariant `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit

  Add-ProbeOutcome $succeeded $failed 'PREVIOUS_STATE_MISMATCH' `
    ((Test-HasCode $declaredPreviousResult 'PREVIOUS_STATE_MISMATCH') -and
      (Test-HasCode $originResult 'PREVIOUS_STATE_MISMATCH') -and
      (Test-HasCode $skippedTransitionResult 'PREVIOUS_STATE_MISMATCH') -and
      (Test-HasCode $afterTerminalResult 'PREVIOUS_STATE_MISMATCH'))

  $variant = Copy-TestLedger -Records $ledger
  $variant[2] = Copy-TestObject -Source $variant[2] -Overrides @{ state = 'UNKNOWN' }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'UNKNOWN_STATE' `
    (Test-HasCode $result 'UNKNOWN_STATE')

  $variant = Copy-TestLedger -Records $ledger
  $variant[3] = Copy-TestObject -Source $variant[3] -Overrides @{
    state = $script:States.S2
    previousState = $script:States.S1
    recordedByRole = 'PREPARATION_OWNER'
    authorityType = 'PREPARATORY_IMPLEMENTATION_EVIDENCE'
  }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'DURABLE_STATE_MULTIPLE' `
    (Test-HasCode $result 'DURABLE_STATE_MULTIPLE')

  $variant = Copy-TestLedger -Records $ledger
  $variant[2] = Copy-TestObject -Source $variant[2] -Additional @{ extra = 'forbidden' }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'EXTRA_PROPERTY' `
    (Test-HasCode $result 'EXTRA_PROPERTY')

  $variant = Copy-TestLedger -Records $ledger
  $variant[2] = Copy-TestObject -Source $variant[2] -Overrides @{
    recordedByRole = 'UNKNOWN_ROLE'
  }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'UNKNOWN_RECORDED_BY_ROLE' `
    (Test-HasCode $result 'UNKNOWN_RECORDED_BY_ROLE')

  $variant = Copy-TestLedger -Records $ledger
  $variant[2] = Copy-TestObject -Source $variant[2] -Overrides @{
    authorityType = 'UNKNOWN_AUTHORITY'
  }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'UNKNOWN_AUTHORITY_TYPE' `
    (Test-HasCode $result 'UNKNOWN_AUTHORITY_TYPE')

  $variant = Copy-TestLedger -Records $ledger
  $variant[2] = Copy-TestObject -Source $variant[2] -Overrides @{
    recordedByRole = 'CPO'
    authorityType = 'CPO_PLAN_HARDENING_DECISION'
  }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'STATE_ROLE_AUTHORITY_MISMATCH' `
    (Test-HasCode $result 'STATE_ROLE_AUTHORITY_MISMATCH')

  $variant = Copy-TestLedger -Records $ledger
  $variant[2] = Copy-TestObject -Source $variant[2] -Overrides @{
    protocolId = 'wrong-protocol'
  }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'PROTOCOL_ID_MISMATCH' `
    (Test-HasCode $result 'PROTOCOL_ID_MISMATCH')

  $variant = Copy-TestLedger -Records $ledger
  $variant[2] = Copy-TestObject -Source $variant[2] -Overrides @{
    protocolSha256 = (('d' * 64) -join '')
  }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'PROTOCOL_SHA256_MISMATCH' `
    (Test-HasCode $result 'PROTOCOL_SHA256_MISMATCH')

  $variant = Copy-TestLedger -Records $ledger
  $variant[0] = Copy-TestObject -Source $variant[0] -Overrides @{
    protocolSha256 = $protocolHash
  }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'PROTOCOL_SHA256_NON_NULL_BEFORE_S2' `
    (Test-HasCode $result 'PROTOCOL_SHA256_NON_NULL_BEFORE_S2')

  $variant = Copy-TestLedger -Records $ledger
  $variant[2] = Copy-TestObject -Source $variant[2] -Overrides @{ protocolSha256 = $null }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'PROTOCOL_SHA256_NULL_FROM_S2' `
    (Test-HasCode $result 'PROTOCOL_SHA256_NULL_FROM_S2')

  $variant = Copy-TestLedger -Records $ledger
  $variant[4] = Copy-TestObject -Source $variant[4] -Overrides @{
    frozenCommit = (('d' * 40) -join '')
  }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'FROZEN_COMMIT_MISMATCH' `
    (Test-HasCode $result 'FROZEN_COMMIT_MISMATCH')

  $variant = Copy-TestLedger -Records $ledger
  $variant[2] = Copy-TestObject -Source $variant[2] -Overrides @{
    frozenCommit = $frozenCommit
  }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'FROZEN_COMMIT_NON_NULL_BEFORE_S4' `
    (Test-HasCode $result 'FROZEN_COMMIT_NON_NULL_BEFORE_S4')

  $variant = Copy-TestLedger -Records $ledger
  $variant[4] = Copy-TestObject -Source $variant[4] -Overrides @{ frozenCommit = $null }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'FROZEN_COMMIT_NULL_FROM_S4' `
    (Test-HasCode $result 'FROZEN_COMMIT_NULL_FROM_S4')

  $frozenLedgerBlock = Convert-TestLedgerBlock -Records @($ledger[0..3])
  $headLedgerBlock = Convert-TestLedgerBlock -Records @($ledger)
  $frozenSpecText = New-TestSpecDocument -LedgerBlock $frozenLedgerBlock
  $headSpecText = New-TestSpecDocument -LedgerBlock $headLedgerBlock
  $runbookText = New-TestRunbookDocument -ProtocolText $testProtocolText
  $descendantCommit = ('d' * 40) -join ''
  $oldObjectId = ('e' * 40) -join ''
  $newObjectId = ('f' * 40) -join ''
  $nominalRawDiff = New-TestRawDiff -Path $script:GitSpecPath `
    -OldObjectId $oldObjectId -NewObjectId $newObjectId
  $nominalStep = [pscustomobject]@{
    Commit = $descendantCommit
    RawDiff = $nominalRawDiff
    SpecText = $headSpecText
  }
  $nominalFrozenEvidence = [pscustomobject][ordered]@{
    WorktreeStatus = ''
    IndexFlagsOutput = (
      'H specs/active/043-controlled-fiduciary-pilot-readiness-v1.md' +
      ([string] [char] 0) +
      'H runbooks/controlled-fiduciary-pilot-local-043.md' +
      ([string] [char] 0)
    )
    AncestorValid = $true
    HeadCommitOutput = "$descendantCommit`n"
    HistoryOutput = "$descendantCommit $frozenCommit`n"
    FrozenRunbookText = $runbookText
    HeadRunbookText = $runbookText
    CurrentProtocolText = $testProtocolText
    FrozenSpecText = $frozenSpecText
    CurrentSpecText = $headSpecText
    CommitSteps = @($nominalStep)
    FrozenCommit = $frozenCommit
    ProtocolSha256 = $protocolHash
  }
  $frozenResult = Test-FrozenGitEvidence -Evidence $nominalFrozenEvidence
  Add-ProbeOutcome $succeeded $failed `
    'FROZEN_DESCENDANT_SINGLE_LEDGER_APPEND_ACCEPTED' $frozenResult.Valid

  $backendRawDiff = (
    $nominalRawDiff +
    (New-TestRawDiff `
      -Path 'backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityConfig.kt' `
      -OldObjectId $oldObjectId -NewObjectId $newObjectId)
  )
  $backendStep = Copy-TestObject -Source $nominalStep -Overrides @{
    RawDiff = $backendRawDiff
  }
  $backendEvidence = Copy-TestObject -Source $nominalFrozenEvidence -Overrides @{
    CommitSteps = @($backendStep)
  }
  $frozenResult = Test-FrozenGitEvidence -Evidence $backendEvidence
  Add-ProbeOutcome $succeeded $failed 'FROZEN_BACKEND_CHANGE_REJECTED' `
    (Test-HasCode $frozenResult 'FROZEN_RANGE_DIFF_INVALID')

  $frontendRawDiff = (
    $nominalRawDiff +
    (New-TestRawDiff -Path 'frontend/src/router.tsx' `
      -OldObjectId $oldObjectId -NewObjectId $newObjectId)
  )
  $frontendStep = Copy-TestObject -Source $nominalStep -Overrides @{
    RawDiff = $frontendRawDiff
  }
  $frontendEvidence = Copy-TestObject -Source $nominalFrozenEvidence -Overrides @{
    CommitSteps = @($frontendStep)
  }
  $frozenResult = Test-FrozenGitEvidence -Evidence $frontendEvidence
  Add-ProbeOutcome $succeeded $failed 'FROZEN_FRONTEND_CHANGE_REJECTED' `
    (Test-HasCode $frozenResult 'FROZEN_RANGE_DIFF_INVALID')

  $runbookRawDiff = (
    $nominalRawDiff +
    (New-TestRawDiff -Path $script:GitRunbookPath `
      -OldObjectId $oldObjectId -NewObjectId $newObjectId)
  )
  $runbookStep = Copy-TestObject -Source $nominalStep -Overrides @{
    RawDiff = $runbookRawDiff
  }
  $runbookEvidence = Copy-TestObject -Source $nominalFrozenEvidence -Overrides @{
    CommitSteps = @($runbookStep)
  }
  $frozenResult = Test-FrozenGitEvidence -Evidence $runbookEvidence
  Add-ProbeOutcome $succeeded $failed 'FROZEN_RUNBOOK_CHANGE_REJECTED' `
    (Test-HasCode $frozenResult 'FROZEN_RANGE_DIFF_INVALID')

  $changedProtocolText = "protocolId = changed-protocol`n"
  $protocolEvidence = Copy-TestObject -Source $nominalFrozenEvidence -Overrides @{
    HeadRunbookText = New-TestRunbookDocument -ProtocolText $changedProtocolText
  }
  $frozenResult = Test-FrozenGitEvidence -Evidence $protocolEvidence
  Add-ProbeOutcome $succeeded $failed 'FROZEN_PROTOCOL_CHANGE_REJECTED' `
    (Test-HasCode $frozenResult 'FROZEN_PROTOCOL_MISMATCH')

  $mutatedPriorSpecText = $headSpecText.Replace(
    '043c-test-authority-0',
    '043c-test-authority-x'
  )
  $mutatedPriorStep = Copy-TestObject -Source $nominalStep -Overrides @{
    SpecText = $mutatedPriorSpecText
  }
  $mutatedPriorEvidence = Copy-TestObject -Source $nominalFrozenEvidence -Overrides @{
    CurrentSpecText = $mutatedPriorSpecText
    CommitSteps = @($mutatedPriorStep)
  }
  $frozenResult = Test-FrozenGitEvidence -Evidence $mutatedPriorEvidence
  Add-ProbeOutcome $succeeded $failed 'FROZEN_PRIOR_LEDGER_MUTATION_REJECTED' `
    (Test-HasCode $frozenResult 'FROZEN_PRIOR_LEDGER_MUTATION')

  $outsideLedgerSpecText = New-TestSpecDocument -LedgerBlock $headLedgerBlock `
    -Prefix 'spec-prefix-changed'
  $outsideLedgerStep = Copy-TestObject -Source $nominalStep -Overrides @{
    SpecText = $outsideLedgerSpecText
  }
  $outsideLedgerEvidence = Copy-TestObject -Source $nominalFrozenEvidence -Overrides @{
    CurrentSpecText = $outsideLedgerSpecText
    CommitSteps = @($outsideLedgerStep)
  }
  $frozenResult = Test-FrozenGitEvidence -Evidence $outsideLedgerEvidence
  Add-ProbeOutcome $succeeded $failed 'FROZEN_SPEC_OUTSIDE_LEDGER_REJECTED' `
    (Test-HasCode $frozenResult 'FROZEN_SPEC_OUTSIDE_LEDGER_CHANGED')

  $nonAncestorEvidence = Copy-TestObject -Source $nominalFrozenEvidence -Overrides @{
    AncestorValid = $false
  }
  $frozenResult = Test-FrozenGitEvidence -Evidence $nonAncestorEvidence
  Add-ProbeOutcome $succeeded $failed 'FROZEN_NON_ANCESTOR_REJECTED' `
    (Test-HasCode $frozenResult 'FROZEN_COMMIT_NOT_ANCESTOR')

  $assumeUnchangedEvidence = Copy-TestObject -Source $nominalFrozenEvidence -Overrides @{
    IndexFlagsOutput = (
      'h backend/src/main/kotlin/ch/qamwaq/ritomer/Application.kt' +
      ([string] [char] 0)
    )
  }
  $skipWorktreeEvidence = Copy-TestObject -Source $nominalFrozenEvidence -Overrides @{
    IndexFlagsOutput = (
      'S frontend/src/router.tsx' +
      ([string] [char] 0)
    )
  }
  $emptyEntryEvidence = Copy-TestObject -Source $nominalFrozenEvidence -Overrides @{
    IndexFlagsOutput = [string] [char] 0
  }
  $doubleNulEvidence = Copy-TestObject -Source $nominalFrozenEvidence -Overrides @{
    IndexFlagsOutput = 'H tracked.txt' + ([string] [char] 0) + ([string] [char] 0)
  }
  $assumeUnchangedResult = Test-FrozenGitEvidence -Evidence $assumeUnchangedEvidence
  $skipWorktreeResult = Test-FrozenGitEvidence -Evidence $skipWorktreeEvidence
  $emptyEntryResult = Test-FrozenGitEvidence -Evidence $emptyEntryEvidence
  $doubleNulResult = Test-FrozenGitEvidence -Evidence $doubleNulEvidence
  Add-ProbeOutcome $succeeded $failed 'FROZEN_INDEX_FLAGS_REJECTED' `
    ((Test-HasCode $assumeUnchangedResult 'GIT_INDEX_FLAGS_INVALID') -and
     (Test-HasCode $skipWorktreeResult 'GIT_INDEX_FLAGS_INVALID') -and
     (Test-HasCode $emptyEntryResult 'GIT_INDEX_FLAGS_INVALID') -and
     (Test-HasCode $doubleNulResult 'GIT_INDEX_FLAGS_INVALID'))

  $variant = Copy-TestLedger -Records $ledger
  $variant[2] = Copy-TestObject -Source $variant[2] -Overrides @{ completedRun = 'R9' }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'COMPLETED_RUN_INVALID' `
    (Test-HasCode $result 'COMPLETED_RUN_INVALID')

  $variant = Copy-TestLedger -Records $ledger
  $variant += New-TestLedgerRecord -Sequence 5 -State $script:States.F1 `
    -PreviousState $script:States.S10 -RecordedAtUtc '2026-01-01T00:00:00.005Z' `
    -Role 'CPO' -AuthorityType 'CPO_FINAL_DECISION' `
    -ProtocolId $script:ProtocolId -ProtocolSha256 $protocolHash `
    -FrozenCommit $frozenCommit -CompletedRun 'R1' -EvidenceSha256 $evidenceHash `
    -CpoOutcome $script:States.F1
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'F1_REQUIRES_R2' `
    (Test-HasCode $result 'F1_REQUIRES_R2')

  $transition = Test-MachineTransition -SourceState $script:States.S10 `
    -TargetState $script:States.F1 -R1Outcome 'COMPLETED' `
    -R1Cleanup 'CLEANUP_VERIFIED_RUN_COMPLETE' -R1Missing 0 -R1Unexpected 0 `
    -R2Outcome 'COMPLETED' -R2Cleanup 'CLEANUP_VERIFIED_RUN_COMPLETE' `
    -R2Missing 1 -R2Unexpected 0 -CompletedRun 'R2'
  Add-ProbeOutcome $succeeded $failed 'F1_REQUIRES_TWO_EXACT_AUDITS' `
    (Test-HasCode $transition 'F1_REQUIRES_TWO_EXACT_AUDITS')

  $transition = Test-MachineTransition -SourceState $script:States.S6 `
    -TargetState $script:States.S7 -R1Outcome 'ABORTED' -R1Cleanup 'NONE'
  Add-ProbeOutcome $succeeded $failed 'R1_ABORTED_CLEANUP_REQUIRED' `
    (Test-HasCode $transition 'R1_ABORTED_CLEANUP_REQUIRED')

  $transition = Test-MachineTransition -SourceState $script:States.S6 `
    -TargetState $script:States.S7 -R1Outcome 'ABORTED' `
    -R1Cleanup 'CLEANUP_VERIFIED_RUN_ABORTED'
  Add-ProbeOutcome $succeeded $failed 'R1_ABORTED_CLEANUP_ALLOWS_S7' $transition.Valid

  $transition = Test-MachineTransition -SourceState $script:States.S7 `
    -TargetState $script:States.S8 -R1Outcome 'ABORTED' `
    -R1Cleanup 'CLEANUP_VERIFIED_RUN_ABORTED' -CompletedRun 'NONE' `
    -RunDecision 'R2_ONLY'
  Add-ProbeOutcome $succeeded $failed 'R1_ABORTED_BLOCKS_R2' `
    (Test-HasCode $transition 'R1_ABORTED_BLOCKS_R2')

  $transitionF2 = Test-MachineTransition -SourceState $script:States.S7 `
    -TargetState $script:States.F2 -R1Outcome 'ABORTED' `
    -R1Cleanup 'CLEANUP_VERIFIED_RUN_ABORTED'
  $transitionF3 = Test-MachineTransition -SourceState $script:States.S7 `
    -TargetState $script:States.F3 -R1Outcome 'ABORTED' `
    -R1Cleanup 'CLEANUP_VERIFIED_RUN_ABORTED'
  Add-ProbeOutcome $succeeded $failed 'R1_ABORTED_ALLOWS_NO_GO_OR_INCONCLUSIVE' `
    ($transitionF2.Valid -and $transitionF3.Valid)

  $transition = Test-MachineTransition -SourceState $script:States.S7 `
    -TargetState $script:States.S8 -R1Outcome 'COMPLETED' `
    -R1Cleanup 'CLEANUP_VERIFIED_RUN_COMPLETE' -R1Missing 0 -R1Unexpected 0 `
    -CompletedRun 'R1' -RunDecision 'NONE'
  Add-ProbeOutcome $succeeded $failed 'R1_COMPLETE_REQUIRES_R2_ONLY' `
    (Test-HasCode $transition 'R1_COMPLETE_REQUIRES_R2_ONLY')

  $transition = Test-MachineTransition -SourceState $script:States.S9 `
    -TargetState $script:States.S10 -R2Outcome 'ABORTED' `
    -R2Cleanup 'CLEANUP_VERIFIED_RUN_ABORTED'
  Add-ProbeOutcome $succeeded $failed 'R2_ABORTED_CLEANUP_ALLOWS_S10' $transition.Valid

  $transition = Test-MachineTransition -SourceState $script:States.S10 `
    -TargetState $script:States.F1 -R1Outcome 'COMPLETED' `
    -R1Cleanup 'CLEANUP_VERIFIED_RUN_COMPLETE' -R1Missing 0 -R1Unexpected 0 `
    -R2Outcome 'ABORTED' -R2Cleanup 'CLEANUP_VERIFIED_RUN_ABORTED' `
    -CompletedRun 'R1'
  Add-ProbeOutcome $succeeded $failed 'R2_ABORTED_BLOCKS_GO' `
    (Test-HasCode $transition 'F1_REQUIRES_R2')

  $transitionF2 = Test-MachineTransition -SourceState $script:States.S10 `
    -TargetState $script:States.F2 -R2Outcome 'ABORTED' `
    -R2Cleanup 'CLEANUP_VERIFIED_RUN_ABORTED'
  $transitionF3 = Test-MachineTransition -SourceState $script:States.S10 `
    -TargetState $script:States.F3 -R2Outcome 'ABORTED' `
    -R2Cleanup 'CLEANUP_VERIFIED_RUN_ABORTED'
  Add-ProbeOutcome $succeeded $failed 'R2_ABORTED_ALLOWS_NO_GO_OR_INCONCLUSIVE' `
    ($transitionF2.Valid -and $transitionF3.Valid)

  $transition = Test-MachineTransition -SourceState $script:States.S6 `
    -TargetState $script:States.S7 -T15Status 'INTERRUPTED'
  Add-ProbeOutcome $succeeded $failed 'T15_INTERRUPTED_NO_CHECKPOINT' `
    (Test-HasCode $transition 'T15_INTERRUPTED_NO_CHECKPOINT')

  $badSnapshot = [pscustomobject]@{
    DurableState = $script:States.S2
    LocalState = 'NONE'
    AuthorizationDecision = 'NONE'
    ProtocolFrozen = $false
    GitClean = $true
    BindingsValid = $false
    R1Resources = 'ABSENT'
    R2Resources = 'ABSENT'
    R1EvidenceValid = $false
    R2EvidenceValid = $false
    CompletedRun = 'NONE'
    R1Outcome = 'NONE'
    R1Missing = 15
    R1Unexpected = 0
    ApplicationReadiness = 'NOT_PROVEN'
  }
  $modeResult = Test-ModeSnapshot -SelectedMode 'PreparationPreflight' `
    -Snapshot $badSnapshot
  Add-ProbeOutcome $succeeded $failed 'MODE_STATE_MISMATCH' `
    (Test-HasCode $modeResult 'MODE_STATE_MISMATCH')

  $variant = Copy-TestLedger -Records $ledger
  $variant[2] = Copy-TestObject -Source $variant[2] -Overrides @{
    state = $script:States.S5
  }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'LOCAL_STATE_FORBIDDEN_IN_GIT' `
    (Test-HasCode $result 'LOCAL_STATE_FORBIDDEN_IN_GIT')

  $variant = Copy-TestLedger -Records $ledger
  $variant[2] = Copy-TestObject -Source $variant[2] -Additional @{
    resourceTargetSha256 = Get-ExpectedResourceTargetHash -Run 'R1'
  }
  $result = Test-DurableLedger -Records $variant -ExpectedProtocolSha256 $protocolHash `
    -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'RESOURCE_TARGET_FORBIDDEN_IN_LEDGER' `
    (Test-HasCode $result 'RESOURCE_TARGET_FORBIDDEN_IN_LEDGER')

  $operation = Test-OperationPolicy -OperationKind 'STATE_MUTATION'
  Add-ProbeOutcome $succeeded $failed 'WRITE_ATTEMPT_FORBIDDEN' `
    (Test-HasCode $operation 'WRITE_ATTEMPT_FORBIDDEN')

  $failureOutput = @(Format-BufferedOutput -SelectedMode 'SelfTest' -Success $false)
  $containsSuccessToken = ($failureOutput -join "`n") -cmatch 'PASS'
  Add-ProbeOutcome $succeeded $failed 'PASS_OUTPUT_FORBIDDEN_ON_ERROR' `
    (-not $containsSuccessToken)

  $s2Prefix = @($ledger[0..2])
  $s3Prefix = @($ledger[0..3])
  $s2Result = Test-DurableLedger -Records $s2Prefix `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
  $s3Result = Test-DurableLedger -Records $s3Prefix `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'S2_TO_S3_VALID' `
    ($s2Result.Valid -and $s3Result.Valid)
  Add-ProbeOutcome $succeeded $failed 'S3_TO_S4_VALID' `
    ($s3Result.Valid -and $baseResult.Valid)

  $s7Record = New-TestLedgerRecord -Sequence 5 -State $script:States.S7 `
    -PreviousState $script:States.S6 -RecordedAtUtc '2026-01-01T00:00:00.005Z' `
    -Role 'COORDINATOR_043C' -AuthorityType 'R1_CLEANUP_EVIDENCE' `
    -ProtocolId $script:ProtocolId -ProtocolSha256 $protocolHash `
    -FrozenCommit $frozenCommit -CompletedRun 'R1' -EvidenceSha256 $evidenceHash
  $s7Ledger = @($ledger) + @($s7Record)
  $s7Valid = Test-DurableLedger -Records $s7Ledger `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
  $s7BadCompleted = Copy-TestObject -Source $s7Record -Overrides @{ completedRun = 'R2' }
  $s7BadCompletedResult = Test-DurableLedger -Records (@($ledger) + @($s7BadCompleted)) `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
  $s7BadEvidence = Copy-TestObject -Source $s7Record -Overrides @{ evidenceSha256 = $null }
  $s7BadEvidenceResult = Test-DurableLedger -Records (@($ledger) + @($s7BadEvidence)) `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
  $s7BadSource = Copy-TestObject -Source $s7Record -Overrides @{
    previousState = $script:States.S4
  }
  $s7BadSourceResult = Test-DurableLedger -Records (@($ledger) + @($s7BadSource)) `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'S4_TO_S7_REQUIRES_RECEIVABLE_FIELDS' `
    ($s7Valid.Valid -and
     (Test-HasCode $s7BadCompletedResult 'COMPLETED_RUN_INVALID') -and
     (Test-HasCode $s7BadEvidenceResult 'EVIDENCE_HASH_INVALID') -and
     (Test-HasCode $s7BadSourceResult 'PREVIOUS_STATE_MISMATCH'))

  $s10EvidenceHash = ('d' * 64) -join ''
  $s10Record = New-TestLedgerRecord -Sequence 6 -State $script:States.S10 `
    -PreviousState $script:States.S9 -RecordedAtUtc '2026-01-01T00:00:00.006Z' `
    -Role 'COORDINATOR_043C' -AuthorityType 'R2_CLEANUP_EVIDENCE' `
    -ProtocolId $script:ProtocolId -ProtocolSha256 $protocolHash `
    -FrozenCommit $frozenCommit -CompletedRun 'R2' -EvidenceSha256 $s10EvidenceHash
  $s10Ledger = @($s7Ledger) + @($s10Record)
  $s10Valid = Test-DurableLedger -Records $s10Ledger `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
  $s10AbortedRecord = Copy-TestObject -Source $s10Record -Overrides @{
    completedRun = 'R1'
  }
  $s10AbortedLedger = @($s7Ledger) + @($s10AbortedRecord)
  $s10AbortedValid = Test-DurableLedger -Records $s10AbortedLedger `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
  $s7AbortedRecord = Copy-TestObject -Source $s7Record -Overrides @{
    completedRun = $null
  }
  $s10AfterAbortedR1 = Test-DurableLedger `
    -Records (@($ledger) + @($s7AbortedRecord, $s10AbortedRecord)) `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
  $s10BadSource = Copy-TestObject -Source $s10Record -Overrides @{
    previousState = $script:States.S7
  }
  $s10BadSourceResult = Test-DurableLedger -Records (@($s7Ledger) + @($s10BadSource)) `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'S7_TO_S10_REQUIRES_R2_PATH' `
    ($s10Valid.Valid -and $s10AbortedValid.Valid -and
     (Test-HasCode $s10AfterAbortedR1 'COMPLETED_RUN_INVALID') -and
     (Test-HasCode $s10BadSourceResult 'PREVIOUS_STATE_MISMATCH'))

  $s7TerminalsValid = $true
  $s7FalseTerminalSourcesRejected = $true
  foreach ($terminalState in @($script:States.F2, $script:States.F3)) {
    $terminalRecord = New-TestLedgerRecord -Sequence 6 -State $terminalState `
      -PreviousState $script:States.S7 -RecordedAtUtc '2026-01-01T00:00:00.006Z' `
      -Role 'CPO' -AuthorityType 'CPO_FINAL_DECISION' `
      -ProtocolId $script:ProtocolId -ProtocolSha256 $protocolHash `
      -FrozenCommit $frozenCommit -CompletedRun 'R1' -EvidenceSha256 $evidenceHash `
      -CpoOutcome $terminalState
    $terminalResult = Test-DurableLedger -Records (@($s7Ledger) + @($terminalRecord)) `
      -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
    $s7TerminalsValid = $s7TerminalsValid -and $terminalResult.Valid
    $falseSourceRecord = Copy-TestObject -Source $terminalRecord -Overrides @{
      previousState = $script:States.S10
    }
    $falseSourceResult = Test-DurableLedger `
      -Records (@($s7Ledger) + @($falseSourceRecord)) `
      -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
    $s7FalseTerminalSourcesRejected = $s7FalseTerminalSourcesRejected -and
      (Test-HasCode $falseSourceResult 'PREVIOUS_STATE_MISMATCH')
  }
  Add-ProbeOutcome $succeeded $failed 'S7_TO_F2_OR_F3_VALID' `
    ($s7TerminalsValid -and $s7FalseTerminalSourcesRejected)

  $s7F1Record = New-TestLedgerRecord -Sequence 6 -State $script:States.F1 `
    -PreviousState $script:States.S7 -RecordedAtUtc '2026-01-01T00:00:00.006Z' `
    -Role 'CPO' -AuthorityType 'CPO_FINAL_DECISION' `
    -ProtocolId $script:ProtocolId -ProtocolSha256 $protocolHash `
    -FrozenCommit $frozenCommit -CompletedRun 'R1' -EvidenceSha256 $evidenceHash `
    -CpoOutcome $script:States.F1
  $s7F1Result = Test-DurableLedger -Records (@($s7Ledger) + @($s7F1Record)) `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'S7_TO_F1_REJECTED' `
    ((-not $s7F1Result.Valid) -and (Test-HasCode $s7F1Result 'F1_REQUIRES_R2'))

  $s10CompleteTerminalsValid = $true
  foreach ($terminalState in @(
    $script:States.F1,
    $script:States.F2,
    $script:States.F3
  )) {
    $terminalRecord = New-TestLedgerRecord -Sequence 7 -State $terminalState `
      -PreviousState $script:States.S10 -RecordedAtUtc '2026-01-01T00:00:00.007Z' `
      -Role 'CPO' -AuthorityType 'CPO_FINAL_DECISION' `
      -ProtocolId $script:ProtocolId -ProtocolSha256 $protocolHash `
      -FrozenCommit $frozenCommit -CompletedRun 'R2' -EvidenceSha256 $s10EvidenceHash `
      -CpoOutcome $terminalState
    $terminalResult = Test-DurableLedger -Records (@($s10Ledger) + @($terminalRecord)) `
      -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
    $s10CompleteTerminalsValid = $s10CompleteTerminalsValid -and $terminalResult.Valid
  }
  $s10AbortedTerminalsValid = $true
  foreach ($terminalState in @($script:States.F2, $script:States.F3)) {
    $terminalRecord = New-TestLedgerRecord -Sequence 7 -State $terminalState `
      -PreviousState $script:States.S10 -RecordedAtUtc '2026-01-01T00:00:00.007Z' `
      -Role 'CPO' -AuthorityType 'CPO_FINAL_DECISION' `
      -ProtocolId $script:ProtocolId -ProtocolSha256 $protocolHash `
      -FrozenCommit $frozenCommit -CompletedRun 'R1' -EvidenceSha256 $s10EvidenceHash `
      -CpoOutcome $terminalState
    $terminalResult = Test-DurableLedger `
      -Records (@($s10AbortedLedger) + @($terminalRecord)) `
      -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
    $s10AbortedTerminalsValid = $s10AbortedTerminalsValid -and $terminalResult.Valid
  }
  $s10AbortedF1Record = New-TestLedgerRecord -Sequence 7 -State $script:States.F1 `
    -PreviousState $script:States.S10 -RecordedAtUtc '2026-01-01T00:00:00.007Z' `
    -Role 'CPO' -AuthorityType 'CPO_FINAL_DECISION' `
    -ProtocolId $script:ProtocolId -ProtocolSha256 $protocolHash `
    -FrozenCommit $frozenCommit -CompletedRun 'R1' -EvidenceSha256 $s10EvidenceHash `
    -CpoOutcome $script:States.F1
  $s10AbortedF1Result = Test-DurableLedger `
    -Records (@($s10AbortedLedger) + @($s10AbortedF1Record)) `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
  $s10ChangedFactsRecord = New-TestLedgerRecord -Sequence 7 -State $script:States.F2 `
    -PreviousState $script:States.S10 -RecordedAtUtc '2026-01-01T00:00:00.007Z' `
    -Role 'CPO' -AuthorityType 'CPO_FINAL_DECISION' `
    -ProtocolId $script:ProtocolId -ProtocolSha256 $protocolHash `
    -FrozenCommit $frozenCommit -CompletedRun 'R2' -EvidenceSha256 $evidenceHash `
    -CpoOutcome $script:States.F2
  $s10ChangedFactsResult = Test-DurableLedger `
    -Records (@($s10Ledger) + @($s10ChangedFactsRecord)) `
    -ExpectedProtocolSha256 $protocolHash -ExpectedFrozenCommit $frozenCommit
  Add-ProbeOutcome $succeeded $failed 'S10_TO_F1_F2_F3_RULES' `
    ($s10CompleteTerminalsValid -and $s10AbortedTerminalsValid -and
     (Test-HasCode $s10AbortedF1Result 'F1_REQUIRES_R2') -and
     (Test-HasCode $s10ChangedFactsResult 'EVIDENCE_HASH_INVALID'))

  $catalogAuthLine = (
    'AUTH|postgres|ritomer_043c_catalog_reader|' +
    'ritomer_043c_catalog_reader|127.0.0.1|5432'
  )
  $r1CatalogFields = @(
    'R1',
    'ritomer_043c_r1',
    '1',
    'ritomer_043c_r1_runner',
    'ritomer_043c_r1_runner',
    '1',
    '1',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0'
  )
  $r2CatalogFields = @(
    'R2',
    'ritomer_043c_r2',
    '1',
    'ritomer_043c_r2_runner',
    'ritomer_043c_r2_runner',
    '1',
    '1',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0'
  )
  $catalogNominal = (@(
    $catalogAuthLine,
    ($r1CatalogFields -join '|'),
    ($r2CatalogFields -join '|')
  ) -join "`n") + "`n"

  $catalogVariantFields = @($r1CatalogFields)
  $catalogVariantFields[11] = '1'
  $catalogVariant = (@(
    $catalogAuthLine,
    ($catalogVariantFields -join '|'),
    ($r2CatalogFields -join '|')
  ) -join "`n") + "`n"
  Add-ProbeOutcome $succeeded $failed 'CATALOG_BYPASSRLS_REJECTED' `
    (-not (Convert-CatalogProof -Output $catalogVariant).Valid)

  $catalogVariantFields = @($r1CatalogFields)
  $catalogVariantFields[12] = '1'
  $catalogVariant = (@(
    $catalogAuthLine,
    ($catalogVariantFields -join '|'),
    ($r2CatalogFields -join '|')
  ) -join "`n") + "`n"
  Add-ProbeOutcome $succeeded $failed 'CATALOG_DIRECT_MEMBERSHIP_REJECTED' `
    (-not (Convert-CatalogProof -Output $catalogVariant).Valid)

  $catalogVariantFields = @($r1CatalogFields)
  $catalogVariantFields[12] = '1'
  $catalogVariant = (@(
    $catalogAuthLine,
    ($catalogVariantFields -join '|'),
    ($r2CatalogFields -join '|')
  ) -join "`n") + "`n"
  Add-ProbeOutcome $succeeded $failed 'CATALOG_PREDEFINED_MEMBERSHIP_REJECTED' `
    (-not (Convert-CatalogProof -Output $catalogVariant).Valid)

  $catalogVariantFields = @($r1CatalogFields)
  $catalogVariantFields[3] = 'ritomer_043c_r2_runner'
  $catalogVariant = (@(
    $catalogAuthLine,
    ($catalogVariantFields -join '|'),
    ($r2CatalogFields -join '|')
  ) -join "`n") + "`n"
  Add-ProbeOutcome $succeeded $failed 'CATALOG_OWNER_MISMATCH_REJECTED' `
    (-not (Convert-CatalogProof -Output $catalogVariant).Valid)

  $allPrivilegedFlagsRejected = $true
  foreach ($fieldIndex in @(7, 8, 9, 10)) {
    $catalogVariantFields = @($r1CatalogFields)
    $catalogVariantFields[$fieldIndex] = '1'
    $catalogVariant = (@(
      $catalogAuthLine,
      ($catalogVariantFields -join '|'),
      ($r2CatalogFields -join '|')
    ) -join "`n") + "`n"
    if ((Convert-CatalogProof -Output $catalogVariant).Valid) {
      $allPrivilegedFlagsRejected = $false
    }
  }
  $catalogVariantFields = @($r1CatalogFields)
  $catalogVariantFields[6] = '0'
  $catalogVariant = (@(
    $catalogAuthLine,
    ($catalogVariantFields -join '|'),
    ($r2CatalogFields -join '|')
  ) -join "`n") + "`n"
  if ((Convert-CatalogProof -Output $catalogVariant).Valid) {
    $allPrivilegedFlagsRejected = $false
  }
  Add-ProbeOutcome $succeeded $failed 'CATALOG_PRIVILEGED_FLAG_REJECTED' `
    $allPrivilegedFlagsRejected

  $incompleteR2Fields = @($r2CatalogFields[0..11])
  $catalogVariant = (@(
    $catalogAuthLine,
    ($r1CatalogFields -join '|'),
    ($incompleteR2Fields -join '|')
  ) -join "`n") + "`n"
  Add-ProbeOutcome $succeeded $failed 'CATALOG_RESULT_SHAPE_INCOMPLETE_REJECTED' `
    (-not (Convert-CatalogProof -Output $catalogVariant).Valid)

  $catalogNominalResult = Convert-CatalogProof -Output $catalogNominal
  Add-ProbeOutcome $succeeded $failed 'CATALOG_NOMINAL_EXACT_ACCEPTED' `
    ($catalogNominalResult.Valid -and
      ($catalogNominalResult.Value.R1 -ceq 'CATALOG_TARGET_PRESENT_POLICY_SAFE') -and
      ($catalogNominalResult.Value.R2 -ceq 'CATALOG_TARGET_PRESENT_POLICY_SAFE'))

  $clusterOnlyR1Snapshot = [pscustomobject]@{
    DurableState = $script:States.S4
    LocalState = $script:States.S5
    AuthorizationDecision = 'R1_ONLY'
    ProtocolFrozen = $true
    GitClean = $true
    BindingsValid = $true
    R1Resources = 'CLUSTER_LEVEL_PRESENT'
    R2Resources = 'ABSENT'
    R1EvidenceValid = $false
    R2EvidenceValid = $false
    CompletedRun = 'NONE'
    R1Outcome = 'NONE'
    R1Missing = 15
    R1Unexpected = 0
    ApplicationReadiness = 'NOT_PROVEN'
  }
  $clusterOnlyR2Snapshot = [pscustomobject]@{
    DurableState = $script:States.S7
    LocalState = $script:States.S8
    AuthorizationDecision = 'R2_ONLY'
    ProtocolFrozen = $true
    GitClean = $true
    BindingsValid = $true
    R1Resources = 'ABSENT'
    R2Resources = 'CLUSTER_LEVEL_PRESENT'
    R1EvidenceValid = $true
    R2EvidenceValid = $false
    CompletedRun = 'R1'
    R1Outcome = 'COMPLETED'
    R1Missing = 0
    R1Unexpected = 0
    ApplicationReadiness = 'NOT_PROVEN'
  }
  $clusterR1Result = Test-ModeSnapshot -SelectedMode 'PreR1' `
    -Snapshot $clusterOnlyR1Snapshot
  $clusterR2Result = Test-ModeSnapshot -SelectedMode 'PreR2' `
    -Snapshot $clusterOnlyR2Snapshot
  Add-ProbeOutcome $succeeded $failed 'CLUSTER_ONLY_PROOF_BLOCKS_PRE_RUN' `
    ((Test-HasCode $clusterR1Result 'MODE_STATE_MISMATCH') -and
      (Test-HasCode $clusterR2Result 'MODE_STATE_MISMATCH'))

  $storageRoot = 'C:\Synthetic\LocalApplicationData'
  $storageChain = New-TestStorageChain -Run 'R1'
  Add-ProbeOutcome $succeeded $failed 'STORAGE_CHAIN_NORMAL_ACCEPTED' `
    ((Test-StorageComponentChain -ApprovedRootCanonical $storageRoot `
      -Run 'R1' -Components $storageChain) -ceq 'PRESENT_SAFE')

  $storageVariant = Copy-TestLedger -Records $storageChain
  $storageVariant[0] = Copy-TestObject -Source $storageVariant[0] -Overrides @{
    IsReparsePoint = $true
  }
  Add-ProbeOutcome $succeeded $failed 'STORAGE_ROOT_REPARSE_REJECTED' `
    ((Test-StorageComponentChain -ApprovedRootCanonical $storageRoot `
      -Run 'R1' -Components $storageVariant) -ceq 'OTHER')

  $storageVariant = Copy-TestLedger -Records $storageChain
  $storageVariant[1] = Copy-TestObject -Source $storageVariant[1] -Overrides @{
    IsReparsePoint = $true
  }
  Add-ProbeOutcome $succeeded $failed 'STORAGE_RITOMER_REPARSE_REJECTED' `
    ((Test-StorageComponentChain -ApprovedRootCanonical $storageRoot `
      -Run 'R1' -Components $storageVariant) -ceq 'OTHER')

  $storageVariant = Copy-TestLedger -Records $storageChain
  $storageVariant[4] = Copy-TestObject -Source $storageVariant[4] -Overrides @{
    IsReparsePoint = $true
  }
  Add-ProbeOutcome $succeeded $failed 'STORAGE_RUNTIME_REPARSE_REJECTED' `
    ((Test-StorageComponentChain -ApprovedRootCanonical $storageRoot `
      -Run 'R1' -Components $storageVariant) -ceq 'OTHER')

  $storageVariant = Copy-TestLedger -Records $storageChain
  $storageVariant[5] = Copy-TestObject -Source $storageVariant[5] -Overrides @{
    IsReparsePoint = $true
  }
  Add-ProbeOutcome $succeeded $failed 'STORAGE_RUN_PARENT_REPARSE_REJECTED' `
    ((Test-StorageComponentChain -ApprovedRootCanonical $storageRoot `
      -Run 'R1' -Components $storageVariant) -ceq 'OTHER')

  $storageVariant = Copy-TestLedger -Records $storageChain
  $storageVariant[6] = Copy-TestObject -Source $storageVariant[6] -Overrides @{
    IsReparsePoint = $true
  }
  Add-ProbeOutcome $succeeded $failed 'STORAGE_TARGET_REPARSE_REJECTED' `
    ((Test-StorageComponentChain -ApprovedRootCanonical $storageRoot `
      -Run 'R1' -Components $storageVariant) -ceq 'OTHER')

  $storageVariant = Copy-TestLedger -Records $storageChain
  $storageVariant[4] = Copy-TestObject -Source $storageVariant[4] -Overrides @{
    CanonicalPath = 'C:\Outside\runtime'
  }
  Add-ProbeOutcome $succeeded $failed 'STORAGE_CANONICAL_ESCAPE_REJECTED' `
    ((Test-StorageComponentChain -ApprovedRootCanonical $storageRoot `
      -Run 'R1' -Components $storageVariant) -ceq 'OTHER')

  $storageVariant = Copy-TestLedger -Records $storageChain
  $storageVariant[6] = Copy-TestObject -Source $storageVariant[6] -Overrides @{
    Exists = $false
    IsDirectory = $false
  }
  Add-ProbeOutcome $succeeded $failed 'STORAGE_TARGET_ABSENT_SAFE_PARENTS_ACCEPTED' `
    ((Test-StorageComponentChain -ApprovedRootCanonical $storageRoot `
      -Run 'R1' -Components $storageVariant) -ceq 'ABSENT')

  $storageVariant = Copy-TestLedger -Records $storageChain
  $storageVariant[4] = Copy-TestObject -Source $storageVariant[4] -Overrides @{
    IsReparsePoint = $true
  }
  $storageVariant[6] = Copy-TestObject -Source $storageVariant[6] -Overrides @{
    Exists = $false
    IsDirectory = $false
  }
  Add-ProbeOutcome $succeeded $failed 'STORAGE_TARGET_ABSENT_UNSAFE_PARENT_REJECTED' `
    ((Test-StorageComponentChain -ApprovedRootCanonical $storageRoot `
      -Run 'R1' -Components $storageVariant) -ceq 'OTHER')

  $localArtifactRoot = 'C:\Synthetic\LocalApplicationData'
  $nominalBytes = Get-Utf8Bytes -Text "{`"schemaVersion`":1}`n"
  $localArtifactChain = New-TestLocalArtifactChain `
    -ArtifactId 'AUTHORIZATION' -FileLength $nominalBytes.Count
  $localArtifactBefore = Test-LocalArtifactComponentChain `
    -ApprovedRootCanonical $localArtifactRoot -ProtocolId $script:ProtocolId `
    -ArtifactId 'AUTHORIZATION' -ExpectedState 'PRESENT' `
    -Components $localArtifactChain
  $localArtifactAfter = Test-LocalArtifactComponentChain `
    -ApprovedRootCanonical $localArtifactRoot -ProtocolId $script:ProtocolId `
    -ArtifactId 'AUTHORIZATION' -ExpectedState 'PRESENT' `
    -Components $localArtifactChain
  $nominalRead = Test-SafeLocalJsonReadObservations `
    -Before $localArtifactBefore -After $localArtifactAfter `
    -Bytes $nominalBytes -ExpectedKeys @('schemaVersion')
  Add-ProbeOutcome $succeeded $failed 'LOCAL_ARTIFACT_NOMINAL_READ_ACCEPTED' `
    $nominalRead.Valid

  $localArtifactVariant = Copy-TestLedger -Records $localArtifactChain
  $authorizationFinalIndex = $localArtifactVariant.Count - 1
  $localArtifactVariant[$authorizationFinalIndex] = Copy-TestObject `
    -Source $localArtifactVariant[$authorizationFinalIndex] -Overrides @{
      Attributes = [int] (
        [System.IO.FileAttributes]::Normal -bor
        [System.IO.FileAttributes]::ReparsePoint
      )
      IsReparsePoint = $true
    }
  $localArtifactResult = Test-LocalArtifactComponentChain `
    -ApprovedRootCanonical $localArtifactRoot -ProtocolId $script:ProtocolId `
    -ArtifactId 'AUTHORIZATION' -ExpectedState 'PRESENT' `
    -Components $localArtifactVariant
  Add-ProbeOutcome $succeeded $failed `
    'LOCAL_ARTIFACT_AUTHORIZATION_FILE_REPARSE_REJECTED' `
    (-not $localArtifactResult.Valid)

  $activeStateChain = New-TestLocalArtifactChain -ArtifactId 'ACTIVE_STATE'
  $localArtifactVariant = Copy-TestLedger -Records $activeStateChain
  $localArtifactVariant[4] = Copy-TestObject `
    -Source $localArtifactVariant[4] -Overrides @{
      Attributes = [int] (
        [System.IO.FileAttributes]::Directory -bor
        [System.IO.FileAttributes]::ReparsePoint
      )
      IsReparsePoint = $true
    }
  $localArtifactResult = Test-LocalArtifactComponentChain `
    -ApprovedRootCanonical $localArtifactRoot -ProtocolId $script:ProtocolId `
    -ArtifactId 'ACTIVE_STATE' -ExpectedState 'PRESENT' `
    -Components $localArtifactVariant
  Add-ProbeOutcome $succeeded $failed `
    'LOCAL_ARTIFACT_STATE_PARENT_REPARSE_REJECTED' `
    (-not $localArtifactResult.Valid)

  $localArtifactVariant = Copy-TestLedger -Records $activeStateChain
  $activeStateFinalIndex = $localArtifactVariant.Count - 1
  $localArtifactVariant[$activeStateFinalIndex] = Copy-TestObject `
    -Source $localArtifactVariant[$activeStateFinalIndex] -Overrides @{
      Attributes = [int] (
        [System.IO.FileAttributes]::Normal -bor
        [System.IO.FileAttributes]::ReparsePoint
      )
      IsReparsePoint = $true
    }
  $localArtifactResult = Test-LocalArtifactComponentChain `
    -ApprovedRootCanonical $localArtifactRoot -ProtocolId $script:ProtocolId `
    -ArtifactId 'ACTIVE_STATE' -ExpectedState 'PRESENT' `
    -Components $localArtifactVariant
  Add-ProbeOutcome $succeeded $failed `
    'LOCAL_ARTIFACT_ACTIVE_STATE_FILE_REPARSE_REJECTED' `
    (-not $localArtifactResult.Valid)

  $r1EvidenceChain = New-TestLocalArtifactChain -ArtifactId 'R1_EVIDENCE'
  $localArtifactVariant = Copy-TestLedger -Records $r1EvidenceChain
  $localArtifactVariant[4] = Copy-TestObject `
    -Source $localArtifactVariant[4] -Overrides @{
      Attributes = [int] (
        [System.IO.FileAttributes]::Directory -bor
        [System.IO.FileAttributes]::ReparsePoint
      )
      IsReparsePoint = $true
    }
  $localArtifactResult = Test-LocalArtifactComponentChain `
    -ApprovedRootCanonical $localArtifactRoot -ProtocolId $script:ProtocolId `
    -ArtifactId 'R1_EVIDENCE' -ExpectedState 'PRESENT' `
    -Components $localArtifactVariant
  Add-ProbeOutcome $succeeded $failed `
    'LOCAL_ARTIFACT_RUNS_PARENT_REPARSE_REJECTED' `
    (-not $localArtifactResult.Valid)

  $localArtifactVariant = Copy-TestLedger -Records $r1EvidenceChain
  $localArtifactVariant[5] = Copy-TestObject `
    -Source $localArtifactVariant[5] -Overrides @{
      Attributes = [int] (
        [System.IO.FileAttributes]::Directory -bor
        [System.IO.FileAttributes]::ReparsePoint
      )
      IsReparsePoint = $true
    }
  $localArtifactResult = Test-LocalArtifactComponentChain `
    -ApprovedRootCanonical $localArtifactRoot -ProtocolId $script:ProtocolId `
    -ArtifactId 'R1_EVIDENCE' -ExpectedState 'PRESENT' `
    -Components $localArtifactVariant
  Add-ProbeOutcome $succeeded $failed `
    'LOCAL_ARTIFACT_R1_PARENT_REPARSE_REJECTED' `
    (-not $localArtifactResult.Valid)

  $r2EvidenceChain = New-TestLocalArtifactChain -ArtifactId 'R2_EVIDENCE'
  $localArtifactVariant = Copy-TestLedger -Records $r2EvidenceChain
  $localArtifactVariant[5] = Copy-TestObject `
    -Source $localArtifactVariant[5] -Overrides @{
      Attributes = [int] (
        [System.IO.FileAttributes]::Directory -bor
        [System.IO.FileAttributes]::ReparsePoint
      )
      IsReparsePoint = $true
    }
  $localArtifactResult = Test-LocalArtifactComponentChain `
    -ApprovedRootCanonical $localArtifactRoot -ProtocolId $script:ProtocolId `
    -ArtifactId 'R2_EVIDENCE' -ExpectedState 'PRESENT' `
    -Components $localArtifactVariant
  Add-ProbeOutcome $succeeded $failed `
    'LOCAL_ARTIFACT_R2_PARENT_REPARSE_REJECTED' `
    (-not $localArtifactResult.Valid)

  $localArtifactVariant = Copy-TestLedger -Records $r1EvidenceChain
  $evidenceFinalIndex = $localArtifactVariant.Count - 1
  $localArtifactVariant[$evidenceFinalIndex] = Copy-TestObject `
    -Source $localArtifactVariant[$evidenceFinalIndex] -Overrides @{
      Attributes = [int] (
        [System.IO.FileAttributes]::Normal -bor
        [System.IO.FileAttributes]::ReparsePoint
      )
      IsReparsePoint = $true
    }
  $localArtifactResult = Test-LocalArtifactComponentChain `
    -ApprovedRootCanonical $localArtifactRoot -ProtocolId $script:ProtocolId `
    -ArtifactId 'R1_EVIDENCE' -ExpectedState 'PRESENT' `
    -Components $localArtifactVariant
  Add-ProbeOutcome $succeeded $failed `
    'LOCAL_ARTIFACT_EVIDENCE_FILE_REPARSE_REJECTED' `
    (-not $localArtifactResult.Valid)

  $localArtifactVariant = Copy-TestLedger -Records $r1EvidenceChain
  $localArtifactVariant[4] = Copy-TestObject `
    -Source $localArtifactVariant[4] -Overrides @{
      CanonicalPath = 'C:\Outside\runs'
    }
  $localArtifactResult = Test-LocalArtifactComponentChain `
    -ApprovedRootCanonical $localArtifactRoot -ProtocolId $script:ProtocolId `
    -ArtifactId 'R1_EVIDENCE' -ExpectedState 'PRESENT' `
    -Components $localArtifactVariant
  Add-ProbeOutcome $succeeded $failed `
    'LOCAL_ARTIFACT_CANONICAL_ESCAPE_REJECTED' `
    (-not $localArtifactResult.Valid)

  $allLocalArtifactsSafelyAbsent = $true
  foreach ($artifactId in $script:LocalArtifactIds) {
    $localArtifactVariant = Copy-TestLedger -Records (
      New-TestLocalArtifactChain -ArtifactId $artifactId
    )
    $finalIndex = $localArtifactVariant.Count - 1
    $localArtifactVariant[$finalIndex] = Copy-TestObject `
      -Source $localArtifactVariant[$finalIndex] -Overrides @{
        Exists = $false
        Attributes = [int] 0
        IsDirectory = $false
        IsReparsePoint = $false
        Length = [int64] -1
        LastWriteUtcTicks = [int64] 0
      }
    $localArtifactResult = Test-LocalArtifactComponentChain `
      -ApprovedRootCanonical $localArtifactRoot -ProtocolId $script:ProtocolId `
      -ArtifactId $artifactId -ExpectedState 'ABSENT' `
      -Components $localArtifactVariant
    if (-not $localArtifactResult.Valid) {
      $allLocalArtifactsSafelyAbsent = $false
    }
  }
  Add-ProbeOutcome $succeeded $failed `
    'LOCAL_ARTIFACT_ABSENT_SAFE_PREPARATION_ACCEPTED' `
    $allLocalArtifactsSafelyAbsent

  $localArtifactVariant = Copy-TestLedger -Records $activeStateChain
  $localArtifactVariant[4] = Copy-TestObject `
    -Source $localArtifactVariant[4] -Overrides @{
      Attributes = [int] (
        [System.IO.FileAttributes]::Directory -bor
        [System.IO.FileAttributes]::ReparsePoint
      )
      IsReparsePoint = $true
    }
  $finalIndex = $localArtifactVariant.Count - 1
  $localArtifactVariant[$finalIndex] = Copy-TestObject `
    -Source $localArtifactVariant[$finalIndex] -Overrides @{
      Exists = $false
      Attributes = [int] 0
      IsDirectory = $false
      IsReparsePoint = $false
      Length = [int64] -1
      LastWriteUtcTicks = [int64] 0
    }
  $localArtifactResult = Test-LocalArtifactComponentChain `
    -ApprovedRootCanonical $localArtifactRoot -ProtocolId $script:ProtocolId `
    -ArtifactId 'ACTIVE_STATE' -ExpectedState 'ABSENT' `
    -Components $localArtifactVariant
  Add-ProbeOutcome $succeeded $failed `
    'LOCAL_ARTIFACT_ABSENT_UNSAFE_PARENT_REJECTED' `
    (-not $localArtifactResult.Valid)

  $postR2Snapshot = [pscustomobject]@{
    DurableState = $script:States.S7
    LocalState = $script:States.S9
    AuthorizationDecision = 'R2_ONLY'
    ProtocolFrozen = $true
    GitClean = $true
    BindingsValid = $true
    R1Resources = 'ABSENT'
    R2Resources = 'ABSENT'
    R1EvidenceValid = $true
    R2EvidenceValid = $true
    CompletedRun = 'R1'
    R1Outcome = 'COMPLETED'
    R1Missing = 0
    R1Unexpected = 0
    ApplicationReadiness = 'NOT_PROVEN'
  }
  $postR2Result = Test-ModeSnapshot -SelectedMode 'PostR2Cleanup' `
    -Snapshot $postR2Snapshot
  Add-ProbeOutcome $succeeded $failed 'POST_R2_COMPLETE_R1_NOMINAL_ACCEPTED' `
    $postR2Result.Valid

  $postR2Variant = Copy-TestObject -Source $postR2Snapshot -Overrides @{
    R1Outcome = 'ABORTED'
  }
  $postR2Result = Test-ModeSnapshot -SelectedMode 'PostR2Cleanup' `
    -Snapshot $postR2Variant
  Add-ProbeOutcome $succeeded $failed 'POST_R2_R1_ABORTED_REJECTED' `
    (Test-HasCode $postR2Result 'MODE_STATE_MISMATCH')

  $postR2Variant = Copy-TestObject -Source $postR2Snapshot -Overrides @{
    CompletedRun = $null
  }
  $postR2Result = Test-ModeSnapshot -SelectedMode 'PostR2Cleanup' `
    -Snapshot $postR2Variant
  Add-ProbeOutcome $succeeded $failed 'POST_R2_COMPLETED_RUN_NULL_REJECTED' `
    (Test-HasCode $postR2Result 'MODE_STATE_MISMATCH')

  $postR2Variant = Copy-TestObject -Source $postR2Snapshot -Overrides @{
    R1Missing = 1
  }
  $postR2Result = Test-ModeSnapshot -SelectedMode 'PostR2Cleanup' `
    -Snapshot $postR2Variant
  Add-ProbeOutcome $succeeded $failed 'POST_R2_R1_MISSING_NONZERO_REJECTED' `
    (Test-HasCode $postR2Result 'MODE_STATE_MISMATCH')

  $postR2Variant = Copy-TestObject -Source $postR2Snapshot -Overrides @{
    R1Unexpected = 1
  }
  $postR2Result = Test-ModeSnapshot -SelectedMode 'PostR2Cleanup' `
    -Snapshot $postR2Variant
  Add-ProbeOutcome $succeeded $failed 'POST_R2_R1_UNEXPECTED_NONZERO_REJECTED' `
    (Test-HasCode $postR2Result 'MODE_STATE_MISMATCH')

  $fixedLocalRoot = Test-ApprovedLocalApplicationDataRoot `
    -CandidateRoot 'C:\Synthetic\LocalApplicationData' `
    -DriveType ([System.IO.DriveType]::Fixed)
  Add-ProbeOutcome $succeeded $failed 'LOCALAPPDATA_FIXED_LOCAL_ACCEPTED' `
    ($fixedLocalRoot.Valid -and
      ($fixedLocalRoot.Value.CanonicalRoot -ceq
        'C:\Synthetic\LocalApplicationData') -and
      ($fixedLocalRoot.Value.VolumeRoot -ceq 'C:\'))

  $testPathSeparator = [string] [char] 92
  $uncLocalRoot = Test-ApprovedLocalApplicationDataRoot `
    -CandidateRoot ([string]::Concat(
      $testPathSeparator, $testPathSeparator, 'server', $testPathSeparator,
      'share', $testPathSeparator, 'LocalApplicationData')) `
    -DriveType ([System.IO.DriveType]::Fixed)
  Add-ProbeOutcome $succeeded $failed 'LOCALAPPDATA_UNC_REJECTED' `
    (Test-HasCode $uncLocalRoot 'LOCALAPPDATA_ROOT_INVALID')

  $allDeviceRootsRejected = $true
  foreach ($deviceRoot in @(
    '\\?\C:\Synthetic\LocalApplicationData',
    '\\.\C:\Synthetic\LocalApplicationData',
    '\??\C:\Synthetic\LocalApplicationData'
  )) {
    $deviceRootResult = Test-ApprovedLocalApplicationDataRoot `
      -CandidateRoot $deviceRoot -DriveType ([System.IO.DriveType]::Fixed)
    if (-not (Test-HasCode $deviceRootResult 'LOCALAPPDATA_ROOT_INVALID')) {
      $allDeviceRootsRejected = $false
    }
  }
  Add-ProbeOutcome $succeeded $failed 'LOCALAPPDATA_DEVICE_PATH_REJECTED' `
    $allDeviceRootsRejected

  $allNonFixedDriveTypesRejected = $true
  foreach ($nonFixedDriveType in @(
    [System.IO.DriveType]::Network,
    [System.IO.DriveType]::Unknown,
    [System.IO.DriveType]::NoRootDirectory,
    [System.IO.DriveType]::Removable,
    [System.IO.DriveType]::CDRom,
    [System.IO.DriveType]::Ram
  )) {
    $nonFixedRootResult = Test-ApprovedLocalApplicationDataRoot `
      -CandidateRoot 'Z:\Synthetic\LocalApplicationData' `
      -DriveType $nonFixedDriveType
    if (-not (Test-HasCode $nonFixedRootResult 'LOCALAPPDATA_ROOT_INVALID')) {
      $allNonFixedDriveTypesRejected = $false
    }
  }
  Add-ProbeOutcome $succeeded $failed 'LOCALAPPDATA_NETWORK_DRIVE_REJECTED' `
    $allNonFixedDriveTypesRejected

  $allRelativeAndUriRootsRejected = $true
  foreach ($relativeOrUriRoot in @(
    'Synthetic\LocalApplicationData',
    '\Synthetic\LocalApplicationData',
    'C:Synthetic\LocalApplicationData',
    ([string]::Concat('fi', 'le', ':', '/', '/', '/', 'C:/Synthetic/LocalApplicationData'))
  )) {
    $relativeRootResult = Test-ApprovedLocalApplicationDataRoot `
      -CandidateRoot $relativeOrUriRoot -DriveType ([System.IO.DriveType]::Fixed)
    if (-not (Test-HasCode $relativeRootResult 'LOCALAPPDATA_ROOT_INVALID')) {
      $allRelativeAndUriRootsRejected = $false
    }
  }
  Add-ProbeOutcome $succeeded $failed 'LOCALAPPDATA_RELATIVE_PATH_REJECTED' `
    $allRelativeAndUriRootsRejected

  $testEvidenceBinding = New-ExpectedEvidenceBinding -Run 'R1' `
    -ProtocolSha256 $protocolHash -FrozenCommit $frozenCommit
  $abortT00Evidence = [pscustomobject][ordered]@{
    schemaVersion = 1
    run = 'R1'
    outcome = 'ABORTED'
    lastCompletedTask = 'T00'
    abortReasonCode = 'OPERATOR_INTERRUPTION'
    runStartedAtUtc = $null
    runEndedAtUtc = '2026-01-01T00:01:00.000Z'
    protocolId = $script:ProtocolId
    protocolSha256 = $protocolHash
    frozenCommit = $frozenCommit
    resourceTargetSha256 = Get-ExpectedResourceTargetHash -Run 'R1'
    expectedBusinessEventCount = 15
    missingExpectedBusinessEventCount = 15
    unexpectedBusinessEventCount = 0
  }
  $abortT00Result = Test-EvidenceRecord -Record $abortT00Evidence `
    -Authorization $testEvidenceBinding
  Add-ProbeOutcome $succeeded $failed 'ABORT_T00_NULL_START_ACCEPTED' `
    $abortT00Result.Valid

  $abortT01Evidence = Copy-TestObject -Source $abortT00Evidence -Overrides @{
    lastCompletedTask = 'T01'
  }
  $abortT01Result = Test-EvidenceRecord -Record $abortT01Evidence `
    -Authorization $testEvidenceBinding
  Add-ProbeOutcome $succeeded $failed 'ABORT_T01_NULL_START_REJECTED' `
    (Test-HasCode $abortT01Result 'EVIDENCE_ABORTED_INVALID')

  $exactTopics = Test-OrdinalSequence -Actual @($succeeded.ToArray()) `
    -Expected $script:SelfTestTopics
  return [pscustomobject]@{
    Valid = ($failed.Count -eq 0) -and $exactTopics
    Topics = @($succeeded.ToArray())
    Audit = $auditResult.Value
  }
}

function Read-StrictUtf8File {
  param(
    [string] $Path
  )

  if (-not [System.IO.File]::Exists($Path)) {
    return New-CheckResult -Valid $false -Codes @('REQUIRED_SOURCE_ABSENT')
  }
  try {
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if (($bytes.Count -ge 3) -and
        ($bytes[0] -eq 0xEF) -and
        ($bytes[1] -eq 0xBB) -and
        ($bytes[2] -eq 0xBF)) {
      return New-CheckResult -Valid $false -Codes @('SOURCE_ENCODING_INVALID')
    }
    foreach ($value in $bytes) {
      if ($value -eq 13) {
        return New-CheckResult -Valid $false -Codes @('SOURCE_ENCODING_INVALID')
      }
    }
    if (($bytes.Count -eq 0) -or ($bytes[$bytes.Count - 1] -ne 10)) {
      return New-CheckResult -Valid $false -Codes @('SOURCE_TERMINAL_LF_INVALID')
    }
    $encoding = [System.Text.UTF8Encoding]::new($false, $true)
    $text = $encoding.GetString($bytes)
    return New-CheckResult -Valid $true -Value ([pscustomobject]@{
      Bytes = $bytes
      Text = $text
    })
  } catch {
    return New-CheckResult -Valid $false -Codes @('SOURCE_READ_FAILED')
  }
}

function Get-RepositoryArtifacts {
  param(
    [string] $RepositoryRoot
  )

  $specPath = [System.IO.Path]::Combine(
    $RepositoryRoot,
    'specs',
    'active',
    '043-controlled-fiduciary-pilot-readiness-v1.md'
  )
  $runbookPath = [System.IO.Path]::Combine(
    $RepositoryRoot,
    'runbooks',
    'controlled-fiduciary-pilot-local-043.md'
  )
  $specFile = Read-StrictUtf8File -Path $specPath
  $runbookFile = Read-StrictUtf8File -Path $runbookPath
  if ((-not $specFile.Valid) -or (-not $runbookFile.Valid)) {
    return New-CheckResult -Valid $false -Codes @('REPOSITORY_ARTIFACT_INVALID')
  }

  $protocolBlock = Get-MarkedTextBlock -Text $runbookFile.Value.Text `
    -BeginMarker $script:ProtocolBegin -EndMarker $script:ProtocolEnd `
    -MissingCode 'PROTOCOL_SOURCE_MISSING' -DuplicatedCode 'PROTOCOL_SOURCE_DUPLICATED'
  $ledgerBlock = Get-MarkedTextBlock -Text $specFile.Value.Text `
    -BeginMarker $script:LedgerBegin -EndMarker $script:LedgerEnd `
    -MissingCode 'DURABLE_SOURCE_MISSING' -DuplicatedCode 'DURABLE_SOURCE_DUPLICATED'
  if ((-not $protocolBlock.Valid) -or (-not $ledgerBlock.Valid)) {
    return New-CheckResult -Valid $false -Codes @('REPOSITORY_MARKERS_INVALID')
  }

  $protocolBytes = Get-Utf8Bytes -Text ([string] $protocolBlock.Value)
  $protocolHash = Get-Sha256Hex -Bytes $protocolBytes
  $ledgerRecords = Convert-LedgerBlock -Block ([string] $ledgerBlock.Value)
  if (-not $ledgerRecords.Valid) {
    return New-CheckResult -Valid $false -Codes @('DURABLE_SOURCE_INVALID')
  }
  $ledgerValidation = Test-DurableLedger -Records @($ledgerRecords.Value) `
    -ExpectedProtocolSha256 $protocolHash
  if (-not $ledgerValidation.Valid) {
    return New-CheckResult -Valid $false -Codes @('DURABLE_LEDGER_INVALID')
  }

  return New-CheckResult -Valid $true -Value ([pscustomobject]@{
    SpecText = [string] $specFile.Value.Text
    ProtocolText = [string] $protocolBlock.Value
    ProtocolSha256 = $protocolHash
    LedgerRecords = @($ledgerRecords.Value)
    CurrentRecord = $ledgerValidation.Value
  })
}

function Quote-ProcessArgument {
  param(
    [string] $Value
  )

  return '"' + $Value.Replace('"', '\"') + '"'
}

function Get-ReadToolPath {
  param(
    [ValidateSet('Git', 'Psql')]
    [string] $Tool
  )

  $name = if ($Tool -ceq 'Git') { 'git.exe' } else { 'psql.exe' }
  try {
    $command = Get-Command $name -CommandType Application -ErrorAction Stop |
      Select-Object -First 1
    if (($null -eq $command) -or
        (-not [System.IO.File]::Exists([string] $command.Source))) {
      return $null
    }
    return [string] $command.Source
  } catch {
    return $null
  }
}

function Invoke-ReadProcess {
  param(
    [ValidateSet(
      'GitStatus',
      'GitIndexFlags',
      'GitHeadCommit',
      'GitFrozenIsAncestorOfHead',
      'GitFrozenToHeadLinearHistory',
      'GitFrozenRunbookBlob',
      'GitHeadRunbookBlob',
      'GitFrozenSpecBlob',
      'GitCommitSpecBlob',
      'GitCommitRawDiff',
      'PsqlCatalog'
    )]
    [string] $QueryId,
    [string] $RepositoryRoot = '',
    [string] $FrozenCommit = '',
    [string] $Commit = '',
    [string] $ParentCommit = ''
  )

  $gitQueryIds = @(
    'GitStatus',
    'GitIndexFlags',
    'GitHeadCommit',
    'GitFrozenIsAncestorOfHead',
    'GitFrozenToHeadLinearHistory',
    'GitFrozenRunbookBlob',
    'GitHeadRunbookBlob',
    'GitFrozenSpecBlob',
    'GitCommitSpecBlob',
    'GitCommitRawDiff'
  )
  $toolKind = if (Test-ContainsOrdinal -Values $gitQueryIds -Candidate $QueryId) {
    'Git'
  } elseif ($QueryId -ceq 'PsqlCatalog') {
    'Psql'
  } else {
    return New-CheckResult -Valid $false -Codes @('READ_ADAPTER_QUERY_INVALID')
  }
  $toolPath = Get-ReadToolPath -Tool $toolKind
  if ($null -eq $toolPath) {
    return New-CheckResult -Valid $false -Codes @('READ_ADAPTER_UNAVAILABLE')
  }

  $arguments = ''
  $standardInput = $null
  if ($QueryId -ceq 'GitStatus') {
    $arguments = (
      '-C ' + (Quote-ProcessArgument -Value $RepositoryRoot) +
      ' status --porcelain=v1 -z --untracked-files=all'
    )
  } elseif ($QueryId -ceq 'GitIndexFlags') {
    $arguments = (
      '-C ' + (Quote-ProcessArgument -Value $RepositoryRoot) +
      ' ls-files -v -z --'
    )
  } elseif ($QueryId -ceq 'GitHeadCommit') {
    $arguments = (
      '-C ' + (Quote-ProcessArgument -Value $RepositoryRoot) +
      ' rev-parse --verify HEAD^{commit}'
    )
  } elseif ($QueryId -ceq 'GitFrozenIsAncestorOfHead') {
    if ($FrozenCommit -cnotmatch $script:Git40Pattern) {
      return New-CheckResult -Valid $false -Codes @('FROZEN_COMMIT_MISMATCH')
    }
    $arguments = (
      '-C ' + (Quote-ProcessArgument -Value $RepositoryRoot) +
      ' merge-base --is-ancestor ' +
      (Quote-ProcessArgument -Value $FrozenCommit) +
      ' HEAD'
    )
  } elseif ($QueryId -ceq 'GitFrozenToHeadLinearHistory') {
    if ($FrozenCommit -cnotmatch $script:Git40Pattern) {
      return New-CheckResult -Valid $false -Codes @('FROZEN_COMMIT_MISMATCH')
    }
    $historyRange = $FrozenCommit + '..HEAD'
    $arguments = (
      '-C ' + (Quote-ProcessArgument -Value $RepositoryRoot) +
      ' rev-list --reverse --topo-order --parents --ancestry-path ' +
      (Quote-ProcessArgument -Value $historyRange)
    )
  } elseif ($QueryId -ceq 'GitFrozenRunbookBlob') {
    if ($FrozenCommit -cnotmatch $script:Git40Pattern) {
      return New-CheckResult -Valid $false -Codes @('FROZEN_COMMIT_MISMATCH')
    }
    $blobReference = (
      $FrozenCommit +
      ':' +
      $script:GitRunbookPath
    )
    $arguments = (
      '-C ' + (Quote-ProcessArgument -Value $RepositoryRoot) +
      ' cat-file blob ' + (Quote-ProcessArgument -Value $blobReference)
    )
  } elseif ($QueryId -ceq 'GitHeadRunbookBlob') {
    $blobReference = 'HEAD:' + $script:GitRunbookPath
    $arguments = (
      '-C ' + (Quote-ProcessArgument -Value $RepositoryRoot) +
      ' cat-file blob ' + (Quote-ProcessArgument -Value $blobReference)
    )
  } elseif ($QueryId -ceq 'GitFrozenSpecBlob') {
    if ($FrozenCommit -cnotmatch $script:Git40Pattern) {
      return New-CheckResult -Valid $false -Codes @('FROZEN_COMMIT_MISMATCH')
    }
    $blobReference = $FrozenCommit + ':' + $script:GitSpecPath
    $arguments = (
      '-C ' + (Quote-ProcessArgument -Value $RepositoryRoot) +
      ' cat-file blob ' + (Quote-ProcessArgument -Value $blobReference)
    )
  } elseif ($QueryId -ceq 'GitCommitSpecBlob') {
    if ($Commit -cnotmatch $script:Git40Pattern) {
      return New-CheckResult -Valid $false -Codes @('FROZEN_HISTORY_INVALID')
    }
    $blobReference = $Commit + ':' + $script:GitSpecPath
    $arguments = (
      '-C ' + (Quote-ProcessArgument -Value $RepositoryRoot) +
      ' cat-file blob ' + (Quote-ProcessArgument -Value $blobReference)
    )
  } elseif ($QueryId -ceq 'GitCommitRawDiff') {
    if (($ParentCommit -cnotmatch $script:Git40Pattern) -or
        ($Commit -cnotmatch $script:Git40Pattern) -or
        [string]::Equals($ParentCommit, $Commit, [System.StringComparison]::Ordinal)) {
      return New-CheckResult -Valid $false -Codes @('FROZEN_HISTORY_INVALID')
    }
    $arguments = (
      '-C ' + (Quote-ProcessArgument -Value $RepositoryRoot) +
      ' diff --no-ext-diff --no-renames --raw --abbrev=40 -z ' +
      (Quote-ProcessArgument -Value $ParentCommit) +
      ' ' +
      (Quote-ProcessArgument -Value $Commit) +
      ' --'
    )
  } elseif ($QueryId -ceq 'PsqlCatalog') {
    $catalogConnection = (
      'host=localhost hostaddr=127.0.0.1 port=5432 dbname=postgres ' +
      'user=ritomer_043c_catalog_reader require_auth=sspi connect_timeout=5'
    )
    $arguments = (
      '-X --no-password --dbname=' +
      (Quote-ProcessArgument -Value $catalogConnection) +
      ' ' +
      '--tuples-only --no-align --quiet --set=ON_ERROR_STOP=1 --file=-'
    )
    $standardInput = @'
WITH expected(run_order, run_name, database_name, role_name) AS (
  VALUES
    (1, 'R1', 'ritomer_043c_r1', 'ritomer_043c_r1_runner'),
    (2, 'R2', 'ritomer_043c_r2', 'ritomer_043c_r2_runner')
),
facts AS (
  SELECT
    expected.run_order,
    expected.run_name,
    expected.database_name,
    expected.role_name,
    target_database.oid IS NOT NULL AS database_exists,
    COALESCE(pg_get_userbyid(target_database.datdba), '') AS database_owner,
    runner_role.oid IS NOT NULL AS role_exists,
    COALESCE(runner_role.rolcanlogin, false) AS rolcanlogin,
    COALESCE(runner_role.rolsuper, false) AS rolsuper,
    COALESCE(runner_role.rolcreatedb, false) AS rolcreatedb,
    COALESCE(runner_role.rolcreaterole, false) AS rolcreaterole,
    COALESCE(runner_role.rolreplication, false) AS rolreplication,
    COALESCE(runner_role.rolbypassrls, false) AS rolbypassrls,
    (
      SELECT count(*)
      FROM pg_auth_members AS membership
      WHERE membership.member = runner_role.oid
    ) AS explicit_membership_count
  FROM expected
  LEFT JOIN pg_database AS target_database
    ON target_database.datname = expected.database_name
  LEFT JOIN pg_roles AS runner_role
    ON runner_role.rolname = expected.role_name
),
output_lines(line_order, line) AS (
  SELECT
    0,
    'AUTH'
      || '|' || current_database()
      || '|' || current_user
      || '|' || session_user
      || '|' || host(inet_server_addr())
      || '|' || inet_server_port()::text
  UNION ALL
  SELECT
    facts.run_order,
    facts.run_name
      || '|' || facts.database_name
      || '|' || CASE WHEN facts.database_exists THEN '1' ELSE '0' END
      || '|' || facts.database_owner
      || '|' || facts.role_name
      || '|' || CASE WHEN facts.role_exists THEN '1' ELSE '0' END
      || '|' || CASE WHEN facts.rolcanlogin THEN '1' ELSE '0' END
      || '|' || CASE WHEN facts.rolsuper THEN '1' ELSE '0' END
      || '|' || CASE WHEN facts.rolcreatedb THEN '1' ELSE '0' END
      || '|' || CASE WHEN facts.rolcreaterole THEN '1' ELSE '0' END
      || '|' || CASE WHEN facts.rolreplication THEN '1' ELSE '0' END
      || '|' || CASE WHEN facts.rolbypassrls THEN '1' ELSE '0' END
      || '|' || facts.explicit_membership_count::text
  FROM facts
)
SELECT line
FROM output_lines
ORDER BY line_order;
'@
  } else {
    return New-CheckResult -Valid $false -Codes @('READ_ADAPTER_QUERY_INVALID')
  }

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $toolPath
  $startInfo.Arguments = $arguments
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.RedirectStandardInput = ($null -ne $standardInput)
  $strictUtf8 = [System.Text.UTF8Encoding]::new($false, $true)
  $startInfo.StandardOutputEncoding = $strictUtf8
  $startInfo.StandardErrorEncoding = $strictUtf8
  $startInfo.EnvironmentVariables.Clear()
  foreach ($environmentName in @('SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'PATHEXT')) {
    $environmentValue = [System.Environment]::GetEnvironmentVariable($environmentName)
    if (-not [string]::IsNullOrEmpty($environmentValue)) {
      $startInfo.EnvironmentVariables[$environmentName] = $environmentValue
    }
  }
  if ($toolKind -ceq 'Git') {
    $startInfo.EnvironmentVariables['GIT_OPTIONAL_LOCKS'] = '0'
    $startInfo.EnvironmentVariables['GIT_NO_REPLACE_OBJECTS'] = '1'
  }

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  try {
    if (-not $process.Start()) {
      return New-CheckResult -Valid $false -Codes @('READ_ADAPTER_FAILED')
    }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if ($null -ne $standardInput) {
      $process.StandardInput.Write($standardInput)
      $process.StandardInput.Close()
    }
    if (-not $process.WaitForExit(10000)) {
      $process.Kill()
      [void] $process.WaitForExit(1000)
      return New-CheckResult -Valid $false -Codes @('READ_ADAPTER_TIMEOUT')
    }
    $stdout = $stdoutTask.Result
    $stderr = $stderrTask.Result
    if (($stdout.Length -gt 1048576) -or ($stderr.Length -gt 1048576) -or
        (-not [string]::IsNullOrWhiteSpace($stderr))) {
      return New-CheckResult -Valid $false -Codes @('READ_ADAPTER_FAILED')
    }
    if ($QueryId -ceq 'GitFrozenIsAncestorOfHead') {
      if (($process.ExitCode -eq 0) -and ($stdout.Length -eq 0)) {
        return New-CheckResult -Valid $true -Value $stdout
      }
      if (($process.ExitCode -eq 1) -and ($stdout.Length -eq 0)) {
        return New-CheckResult -Valid $false -Codes @('FROZEN_COMMIT_NOT_ANCESTOR')
      }
      return New-CheckResult -Valid $false -Codes @('READ_ADAPTER_FAILED')
    }
    if ($process.ExitCode -ne 0) {
      return New-CheckResult -Valid $false -Codes @('READ_ADAPTER_FAILED')
    }
    return New-CheckResult -Valid $true -Value $stdout
  } catch {
    return New-CheckResult -Valid $false -Codes @('READ_ADAPTER_FAILED')
  } finally {
    $process.Dispose()
  }
}

function Test-FrozenProtocolAndGit {
  param(
    [string] $RepositoryRoot,
    [string] $FrozenCommit,
    [string] $CurrentProtocolText,
    [string] $CurrentSpecText
  )

  if ($FrozenCommit -cnotmatch $script:Git40Pattern) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_COMMIT_MISMATCH')
  }
  $status = Invoke-ReadProcess -QueryId 'GitStatus' -RepositoryRoot $RepositoryRoot
  if ((-not $status.Valid) -or
      (([string] $status.Value).Length -ne 0)) {
    return New-CheckResult -Valid $false -Codes @('GIT_STATE_INVALID')
  }
  $indexFlags = Invoke-ReadProcess -QueryId 'GitIndexFlags' `
    -RepositoryRoot $RepositoryRoot
  if (-not $indexFlags.Valid) {
    return New-CheckResult -Valid $false -Codes @('GIT_INDEX_FLAGS_INVALID')
  }
  $indexFlagsValidation = Test-GitIndexFlagsOutput -Text ([string] $indexFlags.Value)
  if (-not $indexFlagsValidation.Valid) {
    return $indexFlagsValidation
  }

  $head = Invoke-ReadProcess -QueryId 'GitHeadCommit' -RepositoryRoot $RepositoryRoot
  if (-not $head.Valid) {
    return New-CheckResult -Valid $false -Codes @('GIT_HEAD_INVALID')
  }
  $headCommit = Convert-GitHeadCommitOutput -Text ([string] $head.Value)
  if (-not $headCommit.Valid) {
    return $headCommit
  }

  $ancestor = Invoke-ReadProcess -QueryId 'GitFrozenIsAncestorOfHead' `
    -RepositoryRoot $RepositoryRoot -FrozenCommit $FrozenCommit
  if (-not $ancestor.Valid) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_COMMIT_NOT_ANCESTOR')
  }

  $history = Invoke-ReadProcess -QueryId 'GitFrozenToHeadLinearHistory' `
    -RepositoryRoot $RepositoryRoot -FrozenCommit $FrozenCommit
  if (-not $history.Valid) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_HISTORY_UNAVAILABLE')
  }
  $historyValidation = Test-LinearFrozenHistory -HistoryText ([string] $history.Value) `
    -FrozenCommit $FrozenCommit -HeadCommit ([string] $headCommit.Value)
  if (-not $historyValidation.Valid) {
    return $historyValidation
  }

  $frozenRunbook = Invoke-ReadProcess -QueryId 'GitFrozenRunbookBlob' `
    -RepositoryRoot $RepositoryRoot -FrozenCommit $FrozenCommit
  $headRunbook = Invoke-ReadProcess -QueryId 'GitHeadRunbookBlob' `
    -RepositoryRoot $RepositoryRoot
  $frozenSpec = Invoke-ReadProcess -QueryId 'GitFrozenSpecBlob' `
    -RepositoryRoot $RepositoryRoot -FrozenCommit $FrozenCommit
  if ((-not $frozenRunbook.Valid) -or (-not $headRunbook.Valid) -or
      (-not $frozenSpec.Valid)) {
    return New-CheckResult -Valid $false -Codes @('FROZEN_BLOB_UNAVAILABLE')
  }

  $steps = New-Object System.Collections.Generic.List[object]
  foreach ($entry in @($historyValidation.Value)) {
    $rawDiff = Invoke-ReadProcess -QueryId 'GitCommitRawDiff' `
      -RepositoryRoot $RepositoryRoot -ParentCommit ([string] $entry.Parent) `
      -Commit ([string] $entry.Commit)
    $specBlob = Invoke-ReadProcess -QueryId 'GitCommitSpecBlob' `
      -RepositoryRoot $RepositoryRoot -Commit ([string] $entry.Commit)
    if ((-not $rawDiff.Valid) -or (-not $specBlob.Valid)) {
      return New-CheckResult -Valid $false -Codes @('FROZEN_GIT_RANGE_UNAVAILABLE')
    }
    [void] $steps.Add([pscustomobject]@{
      Commit = [string] $entry.Commit
      RawDiff = [string] $rawDiff.Value
      SpecText = [string] $specBlob.Value
    })
  }

  $protocolSha256 = Get-Sha256Hex -Bytes (
    Get-Utf8Bytes -Text $CurrentProtocolText
  )
  $evidence = [pscustomobject][ordered]@{
    WorktreeStatus = [string] $status.Value
    IndexFlagsOutput = [string] $indexFlags.Value
    AncestorValid = $ancestor.Valid
    HeadCommitOutput = [string] $head.Value
    HistoryOutput = [string] $history.Value
    FrozenRunbookText = [string] $frozenRunbook.Value
    HeadRunbookText = [string] $headRunbook.Value
    CurrentProtocolText = $CurrentProtocolText
    FrozenSpecText = [string] $frozenSpec.Value
    CurrentSpecText = $CurrentSpecText
    CommitSteps = @($steps.ToArray())
    FrozenCommit = $FrozenCommit
    ProtocolSha256 = $protocolSha256
  }
  return Test-FrozenGitEvidence -Evidence $evidence
}

function Get-StorageResourceState {
  param(
    [string] $LocalApplicationDataRoot,
    [ValidateSet('R1', 'R2')]
    [string] $Run
  )

  try {
    $componentNames = @(
      'LocalApplicationData',
      'Ritomer',
      '043c',
      $script:ProtocolId,
      'runtime',
      $Run,
      'storage'
    )
    $rootFull = [System.IO.Path]::GetFullPath($LocalApplicationDataRoot)
    $componentPaths = New-Object System.Collections.Generic.List[string]
    [void] $componentPaths.Add($rootFull)
    $currentPath = $rootFull
    for ($index = 1; $index -lt $componentNames.Count; $index += 1) {
      $currentPath = [System.IO.Path]::GetFullPath(
        [System.IO.Path]::Combine($currentPath, $componentNames[$index])
      )
      [void] $componentPaths.Add($currentPath)
    }

    $components = New-Object System.Collections.Generic.List[object]
    $observationStopped = $false
    for ($index = 0; $index -lt $componentNames.Count; $index += 1) {
      $exists = $false
      $isDirectory = $false
      $isReparsePoint = $false
      if (-not $observationStopped) {
        try {
          $attributes = [System.IO.File]::GetAttributes($componentPaths[$index])
          $exists = $true
          $isDirectory = (
            ($attributes -band [System.IO.FileAttributes]::Directory) -ne 0
          )
          $isReparsePoint = (
            ($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
          )
          if ((-not $isDirectory) -or $isReparsePoint) {
            $observationStopped = $true
          }
        } catch [System.IO.FileNotFoundException] {
          $observationStopped = $true
        } catch [System.IO.DirectoryNotFoundException] {
          $observationStopped = $true
        } catch {
          return 'OTHER'
        }
      }
      [void] $components.Add([pscustomobject]@{
        Name = $componentNames[$index]
        CanonicalPath = $componentPaths[$index]
        Exists = $exists
        IsDirectory = $isDirectory
        IsReparsePoint = $isReparsePoint
      })
    }

    $chainState = Test-StorageComponentChain -ApprovedRootCanonical $rootFull `
      -Run $Run -Components @($components.ToArray())
    if ($chainState -cne 'PRESENT_SAFE') {
      return $chainState
    }
    $targetFull = $componentPaths[$componentPaths.Count - 1]
    $entries = @([System.IO.Directory]::EnumerateFileSystemEntries($targetFull))
    if ($entries.Count -ne 0) {
      return 'OTHER'
    }
    return 'PRESENT_EMPTY_SAFE'
  } catch {
    return 'OTHER'
  }
}

function Get-ResourceStates {
  param(
    [string] $LocalApplicationDataRoot
  )

  $catalog = Invoke-ReadProcess -QueryId 'PsqlCatalog'
  if (-not $catalog.Valid) {
    return New-CheckResult -Valid $false -Codes @('CATALOG_PROOF_UNAVAILABLE')
  }
  $catalogProof = Convert-CatalogProof -Output $catalog.Value
  if (-not $catalogProof.Valid) {
    return New-CheckResult -Valid $false -Codes @('CATALOG_PROOF_INVALID')
  }

  $r1Storage = Get-StorageResourceState `
    -LocalApplicationDataRoot $LocalApplicationDataRoot -Run 'R1'
  $r2Storage = Get-StorageResourceState `
    -LocalApplicationDataRoot $LocalApplicationDataRoot -Run 'R2'
  $r1State = if (($catalogProof.Value.R1 -ceq 'ABSENT') -and
    ($r1Storage -ceq 'ABSENT')) {
    'ABSENT'
  } elseif (($catalogProof.Value.R1 -ceq 'CATALOG_TARGET_PRESENT_POLICY_SAFE') -and
      ($r1Storage -ceq 'PRESENT_EMPTY_SAFE')) {
    'CLUSTER_LEVEL_PRESENT'
  } else {
    'OTHER'
  }
  $r2State = if (($catalogProof.Value.R2 -ceq 'ABSENT') -and
    ($r2Storage -ceq 'ABSENT')) {
    'ABSENT'
  } elseif (($catalogProof.Value.R2 -ceq 'CATALOG_TARGET_PRESENT_POLICY_SAFE') -and
      ($r2Storage -ceq 'PRESENT_EMPTY_SAFE')) {
    'CLUSTER_LEVEL_PRESENT'
  } else {
    'OTHER'
  }
  return New-CheckResult -Valid $true -Value ([pscustomobject]@{
    R1 = $r1State
    R2 = $r2State
  })
}

function Get-LocalArtifactPathState {
  param(
    [string] $ApprovedRoot,
    [string] $ProtocolId,
    [ValidateSet(
      'AUTHORIZATION',
      'ACTIVE_STATE',
      'R1_EVIDENCE',
      'R2_EVIDENCE'
    )]
    [string] $ArtifactId,
    [ValidateSet('PRESENT', 'ABSENT')]
    [string] $ExpectedState
  )

  try {
    if ($ProtocolId -cne $script:ProtocolId) {
      return New-CheckResult -Valid $false -Codes @('LOCAL_ARTIFACT_PROTOCOL_INVALID')
    }
    $definition = Get-LocalArtifactDefinition -ArtifactId $ArtifactId
    $componentNames = @(
      'LocalApplicationData',
      'Ritomer',
      '043c',
      $ProtocolId
    ) + @($definition.RelativeComponents)
    $rootFull = [System.IO.Path]::GetFullPath($ApprovedRoot)
    $componentPaths = New-Object System.Collections.Generic.List[string]
    [void] $componentPaths.Add($rootFull)
    $currentPath = $rootFull
    for ($index = 1; $index -lt $componentNames.Count; $index += 1) {
      $currentPath = [System.IO.Path]::GetFullPath(
        [System.IO.Path]::Combine($currentPath, $componentNames[$index])
      )
      [void] $componentPaths.Add($currentPath)
    }

    $components = New-Object System.Collections.Generic.List[object]
    $observationStopped = $false
    $finalIndex = $componentNames.Count - 1
    for ($index = 0; $index -lt $componentNames.Count; $index += 1) {
      $exists = $false
      $attributesValue = [int] 0
      $isDirectory = $false
      $isReparsePoint = $false
      $length = [int64] -1
      $lastWriteUtcTicks = [int64] 0
      if (-not $observationStopped) {
        try {
          $attributes = [System.IO.File]::GetAttributes($componentPaths[$index])
          $exists = $true
          $attributesValue = [int] $attributes
          $isDirectory = (
            ($attributes -band [System.IO.FileAttributes]::Directory) -ne 0
          )
          $isReparsePoint = (
            ($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
          )
          if ($isDirectory) {
            $lastWriteUtcTicks = [int64] (
              [System.IO.Directory]::GetLastWriteTimeUtc(
                $componentPaths[$index]
              ).Ticks
            )
          } else {
            $lastWriteUtcTicks = [int64] (
              [System.IO.File]::GetLastWriteTimeUtc($componentPaths[$index]).Ticks
            )
          }
          if (($index -eq $finalIndex) -and
              (-not $isDirectory) -and
              (-not $isReparsePoint)) {
            $fileInfo = [System.IO.FileInfo]::new($componentPaths[$index])
            $length = [int64] $fileInfo.Length
          }
          if (($index -lt $finalIndex -and
              ((-not $isDirectory) -or $isReparsePoint)) -or
              ($index -eq $finalIndex -and
              ($isDirectory -or $isReparsePoint))) {
            $observationStopped = $true
          }
        } catch [System.IO.FileNotFoundException] {
          $observationStopped = $true
        } catch [System.IO.DirectoryNotFoundException] {
          $observationStopped = $true
        } catch {
          return New-CheckResult -Valid $false -Codes @(
            'LOCAL_ARTIFACT_OBSERVATION_FAILED'
          )
        }
      }
      [void] $components.Add([pscustomobject]@{
        Name = $componentNames[$index]
        CanonicalPath = $componentPaths[$index]
        Exists = $exists
        Attributes = $attributesValue
        IsDirectory = $isDirectory
        IsReparsePoint = $isReparsePoint
        Length = $length
        LastWriteUtcTicks = $lastWriteUtcTicks
      })
    }

    return Test-LocalArtifactComponentChain `
      -ApprovedRootCanonical $rootFull -ProtocolId $ProtocolId `
      -ArtifactId $ArtifactId -ExpectedState $ExpectedState `
      -Components @($components.ToArray())
  } catch {
    return New-CheckResult -Valid $false -Codes @(
      'LOCAL_ARTIFACT_OBSERVATION_FAILED'
    )
  }
}

function Read-SafeLocalJsonArtifact {
  param(
    [string] $ApprovedRoot,
    [ValidateSet(
      'AUTHORIZATION',
      'ACTIVE_STATE',
      'R1_EVIDENCE',
      'R2_EVIDENCE'
    )]
    [string] $ArtifactId,
    [string[]] $ExpectedKeys
  )

  $before = Get-LocalArtifactPathState -ApprovedRoot $ApprovedRoot `
    -ProtocolId $script:ProtocolId -ArtifactId $ArtifactId `
    -ExpectedState 'PRESENT'
  if (-not $before.Valid) {
    return New-CheckResult -Valid $false -Codes @('LOCAL_ARTIFACT_UNSAFE')
  }
  try {
    $bytes = [System.IO.File]::ReadAllBytes(
      [string] $before.Value.ArtifactPath
    )
  } catch {
    return New-CheckResult -Valid $false -Codes @('LOCAL_ARTIFACT_READ_FAILED')
  }
  $after = Get-LocalArtifactPathState -ApprovedRoot $ApprovedRoot `
    -ProtocolId $script:ProtocolId -ArtifactId $ArtifactId `
    -ExpectedState 'PRESENT'
  if (-not $after.Valid) {
    return New-CheckResult -Valid $false -Codes @('LOCAL_ARTIFACT_UNSAFE')
  }
  return Test-SafeLocalJsonReadObservations -Before $before -After $after `
    -Bytes $bytes -ExpectedKeys $ExpectedKeys
}

function New-ExpectedEvidenceBinding {
  param(
    [ValidateSet('R1', 'R2')]
    [string] $Run,
    [string] $ProtocolSha256,
    [string] $FrozenCommit
  )

  return [pscustomobject]@{
    run = $Run
    protocolId = $script:ProtocolId
    protocolSha256 = $ProtocolSha256
    frozenCommit = $FrozenCommit
    resourceTargetSha256 = Get-ExpectedResourceTargetHash -Run $Run
  }
}

function Invoke-ExternalMode {
  param(
    [string] $SelectedMode
  )

  $localBaseCandidate = [System.Environment]::GetFolderPath(
    [System.Environment+SpecialFolder]::LocalApplicationData
  )
  $deviceRootPrefixes = @('\\?\', '\\.\', '\??\')
  $localRootSyntaxInvalid = [string]::IsNullOrWhiteSpace($localBaseCandidate) -or
    $localBaseCandidate.StartsWith(
      '\\',
      [System.StringComparison]::Ordinal
    ) -or
    $localBaseCandidate.Contains('/') -or
    ($localBaseCandidate -cmatch '^[A-Za-z][A-Za-z0-9+.-]+:') -or
    ($localBaseCandidate -cnotmatch '^[A-Za-z]:\\')
  foreach ($deviceRootPrefix in $deviceRootPrefixes) {
    if ((-not $localRootSyntaxInvalid) -and
        $localBaseCandidate.StartsWith(
      $deviceRootPrefix,
      [System.StringComparison]::OrdinalIgnoreCase
    )) {
      $localRootSyntaxInvalid = $true
    }
  }
  if ($localRootSyntaxInvalid) {
    return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
  }
  try {
    $localCandidateCanonical = [System.IO.Path]::GetFullPath($localBaseCandidate)
    $localCandidateVolumeRoot = [System.IO.Path]::GetPathRoot(
      $localCandidateCanonical
    )
    if ([string]::IsNullOrWhiteSpace($localCandidateVolumeRoot) -or
        ($localCandidateVolumeRoot -cnotmatch '^[A-Za-z]:\\$')) {
      return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
    }
    $localDriveInfo = [System.IO.DriveInfo]::new($localCandidateVolumeRoot)
  } catch {
    return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
  }
  $approvedLocalRoot = Test-ApprovedLocalApplicationDataRoot `
    -CandidateRoot $localBaseCandidate -DriveType $localDriveInfo.DriveType
  if (-not $approvedLocalRoot.Valid) {
    return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
  }
  $localBase = [string] $approvedLocalRoot.Value.CanonicalRoot

  $repositoryRoot = [System.IO.Path]::GetFullPath(
    [System.IO.Path]::Combine($PSScriptRoot, '..')
  )
  $artifacts = Get-RepositoryArtifacts -RepositoryRoot $repositoryRoot
  if (-not $artifacts.Valid) {
    return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
  }
  $current = $artifacts.Value.CurrentRecord
  if (($current.frozenCommit -isnot [string]) -or
      ([string] $current.frozenCommit -cnotmatch $script:Git40Pattern)) {
    return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
  }
  $gitProof = Test-FrozenProtocolAndGit -RepositoryRoot $repositoryRoot `
    -FrozenCommit ([string] $current.frozenCommit) `
    -CurrentProtocolText $artifacts.Value.ProtocolText `
    -CurrentSpecText $artifacts.Value.SpecText
  if (-not $gitProof.Valid) {
    return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
  }

  $resourceStates = Get-ResourceStates -LocalApplicationDataRoot $localBase
  if (-not $resourceStates.Valid) {
    return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
  }

  $snapshot = [pscustomobject]@{
    DurableState = [string] $current.state
    LocalState = 'NONE'
    AuthorizationDecision = 'NONE'
    ProtocolFrozen = $true
    GitClean = $true
    BindingsValid = $false
    R1Resources = $resourceStates.Value.R1
    R2Resources = $resourceStates.Value.R2
    R1EvidenceValid = $false
    R2EvidenceValid = $false
    CompletedRun = if ($null -eq $current.completedRun) { 'NONE' } else {
      [string] $current.completedRun
    }
    R1Outcome = 'NONE'
    R1Missing = 15
    R1Unexpected = 0
    ApplicationReadiness = 'NOT_PROVEN'
  }
  $cleanupDisposition = 'NONE'

  if ($SelectedMode -ceq 'PreparationPreflight') {
    foreach ($artifactId in $script:LocalArtifactIds) {
      $absence = Get-LocalArtifactPathState -ApprovedRoot $localBase `
        -ProtocolId $script:ProtocolId -ArtifactId $artifactId `
        -ExpectedState 'ABSENT'
      if (-not $absence.Valid) {
        return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
      }
    }
  } else {
    $authorizationFile = Read-SafeLocalJsonArtifact -ApprovedRoot $localBase `
      -ArtifactId 'AUTHORIZATION' `
      -ExpectedKeys $script:AuthorizationKeys
    $activeStateFile = Read-SafeLocalJsonArtifact -ApprovedRoot $localBase `
      -ArtifactId 'ACTIVE_STATE' `
      -ExpectedKeys $script:ActiveStateKeys
    if ((-not $authorizationFile.Valid) -or (-not $activeStateFile.Valid)) {
      return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
    }
    $authorization = $authorizationFile.Value.Record
    $activeState = $activeStateFile.Value.Record
    $authorizationCheck = Test-AuthorizationRecord -Record $authorization
    $activeCheck = Test-ActiveStateRecord -Record $activeState `
      -Authorization $authorization
    $bindingsMatchCurrent = $authorization.protocolId -ceq $script:ProtocolId -and
      $authorization.protocolSha256 -ceq $artifacts.Value.ProtocolSha256 -and
      $authorization.frozenCommit -ceq $current.frozenCommit
    if ((-not $authorizationCheck.Valid) -or (-not $activeCheck.Valid) -or
        (-not $bindingsMatchCurrent)) {
      return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
    }
    $snapshot.LocalState = [string] $activeState.state
    $snapshot.AuthorizationDecision = [string] $authorization.decision
    $snapshot.BindingsValid = $true

    if (Test-ContainsOrdinal -Values @('PostR1Cleanup', 'PreR2', 'PostR2Cleanup') `
      -Candidate $SelectedMode) {
      $r1EvidenceFile = Read-SafeLocalJsonArtifact -ApprovedRoot $localBase `
        -ArtifactId 'R1_EVIDENCE' `
        -ExpectedKeys $script:EvidenceKeys
      if (-not $r1EvidenceFile.Valid) {
        return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
      }
      $r1Binding = New-ExpectedEvidenceBinding -Run 'R1' `
        -ProtocolSha256 $artifacts.Value.ProtocolSha256 `
        -FrozenCommit ([string] $current.frozenCommit)
      $r1EvidenceCheck = Test-EvidenceRecord -Record $r1EvidenceFile.Value.Record `
        -Authorization $r1Binding
      if (-not $r1EvidenceCheck.Valid) {
        return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
      }
      if (($SelectedMode -ne 'PostR1Cleanup') -and
          ($current.evidenceSha256 -cne $r1EvidenceFile.Value.Sha256)) {
        return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
      }
      $snapshot.R1EvidenceValid = $true
      $snapshot.R1Outcome = [string] $r1EvidenceFile.Value.Record.outcome
      $snapshot.R1Missing = [int] $r1EvidenceFile.Value.Record.missingExpectedBusinessEventCount
      $snapshot.R1Unexpected = [int] $r1EvidenceFile.Value.Record.unexpectedBusinessEventCount
      if ($SelectedMode -ceq 'PostR1Cleanup') {
        $cleanupDisposition = if ($snapshot.R1Outcome -ceq 'COMPLETED') {
          'CLEANUP_VERIFIED_RUN_COMPLETE'
        } else {
          'CLEANUP_VERIFIED_RUN_ABORTED'
        }
      }
    }

    if ($SelectedMode -ceq 'PostR2Cleanup') {
      $r2EvidenceFile = Read-SafeLocalJsonArtifact -ApprovedRoot $localBase `
        -ArtifactId 'R2_EVIDENCE' `
        -ExpectedKeys $script:EvidenceKeys
      if (-not $r2EvidenceFile.Valid) {
        return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
      }
      $r2Binding = New-ExpectedEvidenceBinding -Run 'R2' `
        -ProtocolSha256 $artifacts.Value.ProtocolSha256 `
        -FrozenCommit ([string] $current.frozenCommit)
      $r2EvidenceCheck = Test-EvidenceRecord -Record $r2EvidenceFile.Value.Record `
        -Authorization $r2Binding
      if (-not $r2EvidenceCheck.Valid) {
        return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }
      }
      $snapshot.R2EvidenceValid = $true
      $cleanupDisposition = if ($r2EvidenceFile.Value.Record.outcome -ceq 'COMPLETED') {
        'CLEANUP_VERIFIED_RUN_COMPLETE'
      } else {
        'CLEANUP_VERIFIED_RUN_ABORTED'
      }
    }
  }

  $modeCheck = Test-ModeSnapshot -SelectedMode $SelectedMode -Snapshot $snapshot
  return [pscustomobject]@{
    Valid = $modeCheck.Valid
    CleanupDisposition = if ($modeCheck.Valid) { $cleanupDisposition } else { 'NONE' }
  }
}

$topLevelSuccess = $false
$topLevelLines = @()
if (@($MyInvocation.UnboundArguments).Count -ne 0) {
  $topLevelLines = @(Format-BufferedOutput -SelectedMode $Mode -Success $false)
} elseif ([string]::Equals($Mode, 'SelfTest', [System.StringComparison]::Ordinal)) {
  try {
    $selfTest = Invoke-SelfTest
    if ($selfTest.Valid) {
      $topLevelSuccess = $true
      $topLevelLines = @(Format-BufferedOutput -SelectedMode $Mode -Success $true `
        -Topics $selfTest.Topics `
        -ExpectedBusinessEventCount $selfTest.Audit.Expected `
        -MissingExpectedBusinessEventCount $selfTest.Audit.Missing `
        -UnexpectedBusinessEventCount $selfTest.Audit.Unexpected)
    } else {
      $topLevelLines = @(Format-BufferedOutput -SelectedMode $Mode -Success $false)
    }
  } catch {
    $topLevelLines = @(Format-BufferedOutput -SelectedMode $Mode -Success $false)
  }
} else {
  try {
    $externalResult = Invoke-ExternalMode -SelectedMode $Mode
    $topLevelSuccess = $externalResult.Valid
    $topLevelLines = @(Format-BufferedOutput -SelectedMode $Mode `
      -Success $externalResult.Valid `
      -CleanupDisposition $externalResult.CleanupDisposition)
  } catch {
    $topLevelLines = @(Format-BufferedOutput -SelectedMode $Mode -Success $false)
  }
}

foreach ($line in $topLevelLines) {
  Write-Output $line
}
if ($topLevelSuccess) {
  exit 0
}
exit 1
