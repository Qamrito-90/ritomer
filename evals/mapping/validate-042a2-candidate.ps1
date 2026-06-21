[CmdletBinding()]
param(
  [string]$SnapshotPath = (Join-Path $PSScriptRoot "fixtures\042a2\taxonomy-snapshot-candidate-v1.json"),
  [string]$DemoInputPath = (Join-Path $PSScriptRoot "fixtures\042a2\demo-input-unmapped-v1.json"),
  [string]$TaxonomyPath = (Join-Path $PSScriptRoot "..\..\contracts\reference\manual-mapping-targets-v2.yaml")
)

$ErrorActionPreference = "Stop"
$script:Errors = New-Object System.Collections.Generic.List[string]

# Canonical artifact hash command:
#   Get-FileHash -Algorithm SHA256 -LiteralPath '<artifact>'
# The validator hashes the committed UTF-8-no-BOM LF bytes and does not treat the hash as business approval.
$ExpectedSnapshotHash = "9E5E303EC10B6713C7A0A0AD33D031069407C6A862030BEF98D69F4786681BA7"
$ExpectedDemoInputHash = "B3C616B729014E6A87BB2124C10970EDF954D9F98FBD1F5C08E42B7ACAAA6D3F"

$CandidateCodes = @(
  "BS.ASSET.CASH_AND_EQUIVALENTS",
  "BS.ASSET.TRADE_RECEIVABLES",
  "BS.LIABILITY.TRADE_PAYABLES",
  "BS.EQUITY.RETAINED_EARNINGS",
  "PL.REVENUE.OPERATING_REVENUE",
  "PL.EXPENSE.OTHER_OPERATING_EXPENSES"
)

$RootCodes = @(
  "BS.ASSET",
  "BS.EQUITY",
  "BS.LIABILITY",
  "PL.EXPENSE",
  "PL.REVENUE"
)

$SectionCodes = @(
  "BS.ASSET.CURRENT_SECTION",
  "BS.LIABILITY.CURRENT_SECTION",
  "BS.EQUITY.CORE_SECTION",
  "PL.REVENUE.OPERATING_SECTION",
  "PL.EXPENSE.OPERATING_SECTION"
)

$ProjectionAccounts = @(
  @{ accountCode = "1000"; accountLabel = "Synthetic cash account"; balanceSignal = "DEBIT_DOMINANT" },
  @{ accountCode = "1100"; accountLabel = "Synthetic trade receivables"; balanceSignal = "DEBIT_DOMINANT" },
  @{ accountCode = "2000"; accountLabel = "Synthetic trade payables"; balanceSignal = "CREDIT_DOMINANT" },
  @{ accountCode = "2800"; accountLabel = "Synthetic retained earnings"; balanceSignal = "CREDIT_DOMINANT" },
  @{ accountCode = "3000"; accountLabel = "Synthetic operating revenue"; balanceSignal = "CREDIT_DOMINANT" },
  @{ accountCode = "4000"; accountLabel = "Synthetic operating expenses"; balanceSignal = "DEBIT_DOMINANT" }
)

$ForbiddenValuePatterns = @(
  "secret",
  "token",
  "credential",
  "cookie",
  "\bdsn\b",
  "\.env",
  "storage\s+key",
  "storage_object_key",
  "signed\s+url",
  "gs://",
  "s3://",
  "https?://",
  "raw\s+csv",
  "[A-Z]{2}\d{2}[A-Z0-9]{11,30}",
  "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
  "\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b"
)

function Add-ValidationError {
  param([string]$Message)
  $script:Errors.Add($Message)
}

function Test-JsonArray {
  param([object]$Value)
  return ($null -ne $Value -and $Value -is [System.Array])
}

function Test-ContainsExactly {
  param(
    [string[]]$Actual,
    [string[]]$Expected,
    [string]$Path
  )

  $actualSorted = @($Actual | Sort-Object)
  $expectedSorted = @($Expected | Sort-Object)
  if ($actualSorted.Count -ne $expectedSorted.Count) {
    Add-ValidationError "$Path expected $($expectedSorted.Count) item(s), got $($actualSorted.Count)"
    return
  }

  for ($i = 0; $i -lt $expectedSorted.Count; $i++) {
    if ($actualSorted[$i] -ne $expectedSorted[$i]) {
      Add-ValidationError "$Path mismatch at sorted index $i`: expected '$($expectedSorted[$i])', got '$($actualSorted[$i])'"
    }
  }
}

function Test-RequiredProperties {
  param(
    [object]$Object,
    [string[]]$Allowed,
    [string[]]$Required,
    [string]$Path
  )

  if ($null -eq $Object -or -not ($Object -is [pscustomobject])) {
    Add-ValidationError "$Path must be an object"
    return
  }

  $names = @($Object.PSObject.Properties | ForEach-Object { $_.Name })
  foreach ($requiredName in $Required) {
    if ($names -notcontains $requiredName) {
      Add-ValidationError "$Path is missing required field '$requiredName'"
    }
  }

  foreach ($name in $names) {
    if ($Allowed -notcontains $name) {
      Add-ValidationError "$Path contains unsupported field '$name'"
    }
  }
}

function Test-NonEmptyString {
  param([object]$Value, [string]$Path)
  if ($null -eq $Value -or -not ($Value -is [string]) -or [string]::IsNullOrWhiteSpace($Value)) {
    Add-ValidationError "$Path must be a non-empty string"
  }
}

function Test-Boolean {
  param([object]$Value, [string]$Path)
  if ($null -eq $Value -or -not ($Value -is [bool])) {
    Add-ValidationError "$Path must be a boolean"
  }
}

function Test-NoBomAndLfOnly {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    Add-ValidationError "file not found: $Path"
    return
  }

  $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Path))
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Add-ValidationError "$Path must be UTF-8 without BOM"
  }

  if ([Array]::IndexOf($bytes, [byte]13) -ge 0) {
    Add-ValidationError "$Path must use LF line endings only"
  }
}

function Get-Sha256Hex {
  param([string]$Path)

  $sha = [System.Security.Cryptography.SHA256]::Create()
  $stream = [System.IO.File]::OpenRead((Resolve-Path -LiteralPath $Path))
  try {
    $hashBytes = $sha.ComputeHash($stream)
  } finally {
    $stream.Dispose()
    $sha.Dispose()
  }

  return (($hashBytes | ForEach-Object { $_.ToString("x2") }) -join "").ToUpperInvariant()
}

function Read-JsonFile {
  param([string]$Path)

  try {
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  } catch {
    Add-ValidationError "$Path is not valid JSON: $($_.Exception.Message)"
    return $null
  }
}

function Get-YamlScalarValue {
  param([string]$Value)

  $trimmed = $Value.Trim().Trim('"').Trim("'")
  if ($trimmed -eq "true") {
    return $true
  }
  if ($trimmed -eq "false") {
    return $false
  }
  if ($trimmed -match "^\d+$") {
    return [int]$trimmed
  }
  return $trimmed
}

function Read-Taxonomy {
  param([string]$Path)

  $result = @{
    Version = $null
    Targets = @{}
  }

  if (-not (Test-Path -LiteralPath $Path)) {
    Add-ValidationError "taxonomy file not found: $Path"
    return $result
  }

  $current = $null
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match "^\s*version:\s*(\d+)\s*$") {
      $result.Version = [int]$Matches[1]
      continue
    }

    if ($line -match "^\s*-\s+code:\s*(.+?)\s*$") {
      if ($null -ne $current -and $current.ContainsKey("code")) {
        $result.Targets[$current["code"]] = $current.Clone()
      }
      $current = @{}
      $current["code"] = Get-YamlScalarValue $Matches[1]
      continue
    }

    if ($null -ne $current -and $line -match "^\s+([A-Za-z][A-Za-z0-9]*):\s*(.+?)\s*$") {
      $current[$Matches[1]] = Get-YamlScalarValue $Matches[2]
    }
  }

  if ($null -ne $current -and $current.ContainsKey("code")) {
    $result.Targets[$current["code"]] = $current.Clone()
  }

  return $result
}

function Get-PropertyNamesRecursive {
  param([object]$Node)

  $names = New-Object System.Collections.Generic.List[string]
  if ($null -eq $Node) {
    return $names
  }

  if ($Node -is [pscustomobject]) {
    foreach ($property in $Node.PSObject.Properties) {
      $names.Add($property.Name)
      $childNames = Get-PropertyNamesRecursive $property.Value
      foreach ($childName in $childNames) {
        $names.Add($childName)
      }
    }
    return $names
  }

  if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [string])) {
    foreach ($item in $Node) {
      $childNames = Get-PropertyNamesRecursive $item
      foreach ($childName in $childNames) {
        $names.Add($childName)
      }
    }
  }

  return $names
}

function Test-ForbiddenValues {
  param([object]$Node, [string]$Path)

  if ($null -eq $Node) {
    return
  }

  if ($Node -is [string]) {
    foreach ($pattern in $ForbiddenValuePatterns) {
      if ($Node -match $pattern) {
        Add-ValidationError "$Path contains forbidden value pattern '$pattern'"
      }
    }
    if ($Node -match "\d+\.\d{2}") {
      Add-ValidationError "$Path appears to contain a raw amount"
    }
    return
  }

  if ($Node -is [pscustomobject]) {
    foreach ($property in $Node.PSObject.Properties) {
      Test-ForbiddenValues $property.Value "$Path.$($property.Name)"
    }
    return
  }

  if ($Node -is [System.Collections.IEnumerable]) {
    $index = 0
    foreach ($item in $Node) {
      Test-ForbiddenValues $item "$Path[$index]"
      $index++
    }
  }
}

function Test-Hash {
  param([string]$Path, [string]$ExpectedHash, [string]$Name)

  $actual = Get-Sha256Hex $Path
  Write-Host "$Name SHA-256: $actual"
  if ($ExpectedHash -eq "PENDING_RECALCULATION") {
    Add-ValidationError "$Name expected hash is still PENDING_RECALCULATION"
    return
  }
  if ($actual -ne $ExpectedHash) {
    Add-ValidationError "$Name hash mismatch: expected $ExpectedHash, got $actual"
  }
}

function Test-SourceEntry {
  param([object]$Entry, [hashtable]$Targets)

  if (-not $Targets.ContainsKey($Entry.code)) {
    Add-ValidationError "snapshot entry '$($Entry.code)' is not present in taxonomy source"
    return
  }

  $source = $Targets[$Entry.code]
  foreach ($field in @("label", "statement", "summaryBucketCode", "sectionCode", "normalSide", "granularity", "selectable", "deprecated", "displayOrder")) {
    if ($Entry.$field -ne $source[$field]) {
      Add-ValidationError "snapshot entry '$($Entry.code)' field '$field' differs from source: expected '$($source[$field])', got '$($Entry.$field)'"
    }
  }
}

function Test-TaxonomySnapshot {
  param([object]$Snapshot, [hashtable]$Targets, [int]$TaxonomyVersion)

  if ($null -eq $Snapshot) {
    return
  }

  Test-RequiredProperties $Snapshot @("schemaVersion", "id", "status", "source", "canonicalization", "candidatePolicy", "entries") @("schemaVersion", "id", "status", "source", "canonicalization", "candidatePolicy", "entries") "snapshot"
  if ($Snapshot.schemaVersion -ne "042a2-taxonomy-snapshot-candidate-v1") {
    Add-ValidationError "snapshot.schemaVersion is invalid"
  }
  if ($Snapshot.id -ne "RITOMER-MAPPING-PILOT-MINIMAL-2026.06-v1") {
    Add-ValidationError "snapshot.id is invalid"
  }

  Test-ContainsExactly @($Snapshot.status) @("CANDIDATE", "PENDING_EVIDENCE", "NOT_AUTHORITATIVE") "snapshot.status"
  Test-RequiredProperties $Snapshot.source @("artifact", "version", "businessProvenance", "rightsOfUse", "owner", "evidenceStatus") @("artifact", "version", "businessProvenance", "rightsOfUse", "owner", "evidenceStatus") "snapshot.source"
  if ($Snapshot.source.artifact -ne "contracts/reference/manual-mapping-targets-v2.yaml") {
    Add-ValidationError "snapshot.source.artifact must point to manual-mapping-targets-v2.yaml"
  }
  if ($Snapshot.source.version -ne 2 -or $TaxonomyVersion -ne 2) {
    Add-ValidationError "snapshot source version and taxonomy source version must both be 2"
  }
  foreach ($field in @("businessProvenance", "rightsOfUse", "owner")) {
    if ($Snapshot.source.$field -ne "NON_DETERMINE") {
      Add-ValidationError "snapshot.source.$field must remain NON_DETERMINE"
    }
  }
  if ($Snapshot.source.evidenceStatus -ne "PENDING_EVIDENCE") {
    Add-ValidationError "snapshot.source.evidenceStatus must remain PENDING_EVIDENCE"
  }

  $propertyNames = Get-PropertyNamesRecursive $Snapshot
  foreach ($name in $propertyNames) {
    if ($name -match "^(known|admissible|definition|businessDefinition)$") {
      Add-ValidationError "snapshot must not store forbidden property '$name'"
    }
  }

  if (-not (Test-JsonArray $Snapshot.entries)) {
    Add-ValidationError "snapshot.entries must be an array"
    return
  }
  if ($Snapshot.entries.Count -ne 16) {
    Add-ValidationError "snapshot.entries must contain exactly 16 entries"
  }

  $codes = @($Snapshot.entries | ForEach-Object { $_.code })
  Test-ContainsExactly $codes @($RootCodes + $SectionCodes + $CandidateCodes) "snapshot.entries.code"

  $candidateEntries = @($Snapshot.entries | Where-Object { $_.pilotRole -eq "CANDIDATE_LEAF" })
  $rootEntries = @($Snapshot.entries | Where-Object { $_.pilotRole -eq "ROOT" })
  $sectionEntries = @($Snapshot.entries | Where-Object { $_.pilotRole -eq "SECTION" })

  Test-ContainsExactly @($candidateEntries | ForEach-Object { $_.code }) $CandidateCodes "snapshot candidate leaves"
  Test-ContainsExactly @($rootEntries | ForEach-Object { $_.code }) $RootCodes "snapshot roots"
  Test-ContainsExactly @($sectionEntries | ForEach-Object { $_.code }) $SectionCodes "snapshot sections"

  foreach ($entry in $Snapshot.entries) {
    Test-RequiredProperties $entry @("code", "label", "statement", "summaryBucketCode", "sectionCode", "normalSide", "granularity", "selectable", "deprecated", "displayOrder", "parentCode", "pilotRole") @("code", "label", "statement", "summaryBucketCode", "sectionCode", "normalSide", "granularity", "selectable", "deprecated", "displayOrder", "pilotRole") "snapshot.entries[$($entry.code)]"
    Test-SourceEntry $entry $Targets

    if ($entry.pilotRole -eq "CANDIDATE_LEAF") {
      if ($entry.granularity -ne "LEAF" -or $entry.selectable -ne $true -or $entry.deprecated -ne $false) {
        Add-ValidationError "candidate '$($entry.code)' must be LEAF, selectable=true, deprecated=false"
      }
    } elseif ($entry.pilotRole -eq "SECTION") {
      if ($entry.granularity -ne "SECTION" -or $entry.selectable -ne $false) {
        Add-ValidationError "section '$($entry.code)' must remain non-candidate and non-selectable"
      }
    } elseif ($entry.pilotRole -eq "ROOT") {
      if ($CandidateCodes -contains $entry.code) {
        Add-ValidationError "root '$($entry.code)' must not be a candidate"
      }
    } else {
      Add-ValidationError "entry '$($entry.code)' has unsupported pilotRole '$($entry.pilotRole)'"
    }
  }
}

function Test-DemoInputProjection {
  param([object]$DemoInput)

  if ($null -eq $DemoInput) {
    return
  }

  Test-RequiredProperties $DemoInput @("schemaVersion", "status", "dataset", "balanceImportVersion", "language", "source", "canonicalization", "accounts") @("schemaVersion", "status", "dataset", "balanceImportVersion", "language", "source", "canonicalization", "accounts") "demoInput"
  if ($DemoInput.schemaVersion -ne "042a2-demo-input-unmapped-v1") {
    Add-ValidationError "demoInput.schemaVersion is invalid"
  }
  Test-ContainsExactly @($DemoInput.status) @("CANDIDATE", "PENDING_EVIDENCE", "NOT_AUTHORITATIVE") "demoInput.status"
  if ($DemoInput.dataset -ne "036a-local-demo-synthetic") {
    Add-ValidationError "demoInput.dataset must be 036a-local-demo-synthetic"
  }
  if ($DemoInput.balanceImportVersion -ne 1) {
    Add-ValidationError "demoInput.balanceImportVersion must be 1"
  }
  if ($DemoInput.language -ne "en") {
    Add-ValidationError "demoInput.language must be en"
  }

  $propertyNames = Get-PropertyNamesRecursive $DemoInput
  foreach ($name in $propertyNames) {
    if ($name -match "(?i)(target|mapping|expected|tenant|client|actor|amount|debit|credit|rawCsv|csv|id)$" -and $name -ne "schemaVersion") {
      Add-ValidationError "demoInput must not contain forbidden property '$name'"
    }
  }

  Test-ForbiddenValues $DemoInput "demoInput"

  if (-not (Test-JsonArray $DemoInput.accounts)) {
    Add-ValidationError "demoInput.accounts must be an array"
    return
  }
  if ($DemoInput.accounts.Count -ne 6) {
    Add-ValidationError "demoInput.accounts must contain exactly 6 accounts"
  }

  $actualCodes = @($DemoInput.accounts | ForEach-Object { $_.accountCode })
  Test-ContainsExactly $actualCodes @($ProjectionAccounts | ForEach-Object { $_.accountCode }) "demoInput account codes"

  for ($i = 0; $i -lt $ProjectionAccounts.Count; $i++) {
    $expected = $ProjectionAccounts[$i]
    $account = $DemoInput.accounts[$i]
    Test-RequiredProperties $account @("accountCode", "accountLabel", "balanceSignal", "currentAffectationStatus") @("accountCode", "accountLabel", "balanceSignal", "currentAffectationStatus") "demoInput.accounts[$i]"
    if ($account.accountCode -ne $expected.accountCode) {
      Add-ValidationError "demoInput.accounts[$i].accountCode expected '$($expected.accountCode)', got '$($account.accountCode)'"
    }
    if ($account.accountLabel -ne $expected.accountLabel) {
      Add-ValidationError "demoInput.accounts[$i].accountLabel expected '$($expected.accountLabel)', got '$($account.accountLabel)'"
    }
    if ($account.balanceSignal -ne $expected.balanceSignal) {
      Add-ValidationError "demoInput.accounts[$i].balanceSignal expected '$($expected.balanceSignal)', got '$($account.balanceSignal)'"
    }
    if ($account.currentAffectationStatus -ne "NONE") {
      Add-ValidationError "demoInput.accounts[$i].currentAffectationStatus must be NONE"
    }
  }
}

Test-NoBomAndLfOnly $SnapshotPath
Test-NoBomAndLfOnly $DemoInputPath

$snapshot = Read-JsonFile $SnapshotPath
$demoInput = Read-JsonFile $DemoInputPath
$taxonomy = Read-Taxonomy $TaxonomyPath

Write-Host "042a2 candidate validation"
Write-Host "Taxonomy source: $TaxonomyPath"
Write-Host "Snapshot artifact: $SnapshotPath"
Write-Host "Demo input artifact: $DemoInputPath"

if (Test-Path -LiteralPath $SnapshotPath) {
  Test-Hash $SnapshotPath $ExpectedSnapshotHash "taxonomy-snapshot-candidate-v1.json"
}
if (Test-Path -LiteralPath $DemoInputPath) {
  Test-Hash $DemoInputPath $ExpectedDemoInputHash "demo-input-unmapped-v1.json"
}

Test-TaxonomySnapshot $snapshot $taxonomy.Targets $taxonomy.Version
Test-DemoInputProjection $demoInput

if ($script:Errors.Count -gt 0) {
  Write-Host ""
  foreach ($validationError in $script:Errors) {
    Write-Host "[FAIL] $validationError"
  }
  exit 1
}

Write-Host "All checks passed."
exit 0
