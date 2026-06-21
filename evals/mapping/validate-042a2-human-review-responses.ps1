[CmdletBinding()]
param(
  [string]$ResponsePath,
  [string]$ReviewerPackPath,
  [string]$ResponseSchemaPath = (Join-Path $PSScriptRoot "reviews\042a2\reviewer-response-schema-v1.json")
)

$ErrorActionPreference = "Stop"
$script:Errors = New-Object System.Collections.Generic.List[string]

$ExpectedBlindCaseIds = @(1..17 | ForEach-Object { "BR-{0:D3}" -f $_ })
$AllowedOutcomes = @("SUGGESTION", "ABSTENTION", "POLICY_BLOCK", "PRECONDITION_BLOCK", "INVALID_MODEL_OUTPUT")
$AllowedCriticalFlags = @(
  "NONE",
  "ACTIVE_PASSIVE_BOUNDARY",
  "BALANCE_SHEET_INCOME_STATEMENT_BOUNDARY",
  "REVENUE_EXPENSE_BOUNDARY",
  "CONTRA_ACCOUNT",
  "TARGET_VALIDITY",
  "TAXONOMY_GAP",
  "POLICY_INCIDENT",
  "TECHNICAL_INCIDENT"
)
$ReasonCodesByOutcome = @{
  ABSTENTION = @("OUT_OF_SCOPE", "CONFLICTING_SIGNALS", "INSUFFICIENT_EVIDENCE", "TAXONOMY_GAP", "AMBIGUOUS_TARGET")
  POLICY_BLOCK = @("NON_SYNTHETIC_REQUEST", "CROSS_TENANT_REQUEST", "OUTSIDE_ALLOWLIST_OR_PROVENANCE", "LANGUAGE_OUT_OF_COHORT", "GATE_INVALID", "PRIVACY_OR_TENANT_BOUNDARY")
  PRECONDITION_BLOCK = @("ACCOUNT_ALREADY_AFFECTED", "ACCOUNT_NOT_IN_LATEST_IMPORT", "STALE_IMPORT", "NOT_ELIGIBLE")
  INVALID_MODEL_OUTPUT = @("TARGET_UNKNOWN", "TARGET_DEPRECATED", "TARGET_NOT_SELECTABLE", "SECTION_OR_ROOT_PROPOSED", "MALFORMED_OUTPUT", "SCHEMA_INVALID", "CONTEXTUALLY_INADMISSIBLE_TARGET")
}
$ExpectedActionByOutcome = @{
  SUGGESTION = "REVIEW_TARGET"
  ABSTENTION = "REVIEW_ABSTENTION_REASON"
  POLICY_BLOCK = "ROUTE_TO_GOVERNANCE"
  PRECONDITION_BLOCK = "CHECK_PRECONDITION"
  INVALID_MODEL_OUTPUT = "ROUTE_TO_TECHNICAL_REVIEW"
}
$AllowedEvidenceStateByOutcome = @{
  SUGGESTION = @("SUFFICIENT")
  ABSTENTION = @("SUFFICIENT", "INSUFFICIENT", "MISSING", "CONFLICTING")
  POLICY_BLOCK = @("POLICY_BLOCKED")
  PRECONDITION_BLOCK = @("STALE_PRECONDITION")
  INVALID_MODEL_OUTPUT = @("TECHNICAL_INVALID")
}
$AllowedEvidenceStateByAbstentionReason = @{
  OUT_OF_SCOPE = @("SUFFICIENT")
  CONFLICTING_SIGNALS = @("CONFLICTING")
  INSUFFICIENT_EVIDENCE = @("INSUFFICIENT", "MISSING")
  TAXONOMY_GAP = @("SUFFICIENT")
  AMBIGUOUS_TARGET = @("SUFFICIENT", "CONFLICTING")
}
$ForbiddenPropertyNames = @(
  "expected",
  "expectedOutcome",
  "expectedTargetCode",
  "expectedReasonCode",
  "solution",
  "answer",
  "sourceArtifacts",
  "sourceKind",
  "sourceCaseId",
  "caseInputHash",
  "sourceId",
  "originalId",
  "tenantId",
  "clientId",
  "actorId",
  "closingFolderId",
  "customerId",
  "amount",
  "rawAmount",
  "debit",
  "credit",
  "rawCsv",
  "csv",
  "secret",
  "token",
  "credential",
  "cookie",
  "dsn"
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
  "file:",
  "raw\s+csv",
  "[A-Z]{2}\d{2}[A-Z0-9]{11,30}",
  "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
  "\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
  "\b(CHF|EUR|USD)\s*\d",
  "\d+\.\d{2}",
  "\bexpected\b",
  "semantic-[0-9a-z-]+",
  "policy-[0-9a-z-]+",
  "invalid-output-[0-9a-z-]+"
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

function Read-JsonFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    Add-ValidationError "file not found: $Path"
    return $null
  }

  try {
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  } catch {
    Add-ValidationError "$Path is not valid JSON: $($_.Exception.Message)"
    return $null
  }
}

function Test-NoNullProperties {
  param([object]$Node, [string]$Path)

  if ($null -eq $Node) {
    Add-ValidationError "$Path must not be null"
    return
  }

  if ($Node -is [pscustomobject]) {
    foreach ($property in $Node.PSObject.Properties) {
      Test-NoNullProperties $property.Value "$Path.$($property.Name)"
    }
    return
  }

  if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [string])) {
    $index = 0
    foreach ($item in $Node) {
      Test-NoNullProperties $item "$Path[$index]"
      $index++
    }
  }
}

function Test-ForbiddenPropertiesAndValues {
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
    return
  }

  if ($Node -is [pscustomobject]) {
    foreach ($property in $Node.PSObject.Properties) {
      if ($ForbiddenPropertyNames -contains $property.Name) {
        Add-ValidationError "$Path contains forbidden property '$($property.Name)'"
      }
      Test-ForbiddenPropertiesAndValues $property.Value "$Path.$($property.Name)"
    }
    return
  }

  if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [string])) {
    $index = 0
    foreach ($item in $Node) {
      Test-ForbiddenPropertiesAndValues $item "$Path[$index]"
      $index++
    }
  }
}

function Get-PackTargetCodes {
  param([object]$Pack)

  if ($null -eq $Pack -or $null -eq $Pack.targetCatalog -or -not (Test-JsonArray $Pack.targetCatalog.targets)) {
    Add-ValidationError "pack.targetCatalog.targets must be present"
    return @()
  }
  return @($Pack.targetCatalog.targets | ForEach-Object { $_.code })
}

function Test-ResponseRoot {
  param([object]$Response, [object]$Pack)

  if ($null -eq $Response -or $null -eq $Pack) {
    return
  }

  Test-RequiredProperties $Response @("schemaVersion", "status", "reviewerId", "responses") @("schemaVersion", "status", "reviewerId", "responses") "response"
  if ($Response.schemaVersion -ne "042a2-blind-review-response-v1") {
    Add-ValidationError "response.schemaVersion is invalid"
  }
  if ($Response.reviewerId -ne $Pack.reviewerId) {
    Add-ValidationError "response.reviewerId '$($Response.reviewerId)' does not match pack reviewerId '$($Pack.reviewerId)'"
  }
  Test-ContainsExactly @($Response.status) @("DRAFT_HUMAN_REVIEW") "response.status"
  if (-not (Test-JsonArray $Response.responses)) {
    Add-ValidationError "response.responses must be an array"
    return
  }
  if ($Response.responses.Count -ne 17) {
    Add-ValidationError "response.responses must contain exactly 17 responses, got $($Response.responses.Count)"
  }
}

function Test-CriticalFlags {
  param([object]$CriticalFlags, [string]$Path, [string]$Outcome)

  if (-not (Test-JsonArray $CriticalFlags) -or $CriticalFlags.Count -lt 1) {
    Add-ValidationError "$Path.criticalFlags must be a non-empty array"
    return
  }

  $flags = @($CriticalFlags | ForEach-Object { [string]$_ })
  if (($flags | Sort-Object -Unique).Count -ne $flags.Count) {
    Add-ValidationError "$Path.criticalFlags must contain unique values"
  }
  foreach ($flag in $flags) {
    if ($AllowedCriticalFlags -notcontains $flag) {
      Add-ValidationError "$Path.criticalFlags contains unsupported flag '$flag'"
    }
  }
  if ($flags -contains "NONE" -and $flags.Count -ne 1) {
    Add-ValidationError "$Path.criticalFlags must not combine NONE with another flag"
  }
  if ($Outcome -eq "POLICY_BLOCK" -and $flags -notcontains "POLICY_INCIDENT") {
    Add-ValidationError "$Path.criticalFlags must include POLICY_INCIDENT for POLICY_BLOCK"
  }
  if ($Outcome -eq "INVALID_MODEL_OUTPUT" -and $flags -notcontains "TECHNICAL_INCIDENT") {
    Add-ValidationError "$Path.criticalFlags must include TECHNICAL_INCIDENT for INVALID_MODEL_OUTPUT"
  }
}

function Test-ResponseItem {
  param(
    [object]$Item,
    [string[]]$TargetCodes,
    [string[]]$PackBlindCaseIds,
    [int]$Index
  )

  $path = "response.responses[$Index]"
  if ($null -eq $Item -or -not ($Item -is [pscustomobject])) {
    Add-ValidationError "$path must be an object"
    return
  }

  $baseAllowed = @("blindCaseId", "outcome", "evidenceState", "criticalFlags", "expectedHumanAction")
  $outcome = $Item.outcome
  if ($AllowedOutcomes -notcontains $outcome) {
    Add-ValidationError "$path.outcome '$outcome' is not allowed"
    return
  }

  if ($outcome -eq "SUGGESTION") {
    Test-RequiredProperties $Item ($baseAllowed + @("targetCode")) ($baseAllowed + @("targetCode")) $path
    if ($TargetCodes -notcontains $Item.targetCode) {
      Add-ValidationError "$path.targetCode '$($Item.targetCode)' is not in the exact candidate target catalog"
    }
  } else {
    Test-RequiredProperties $Item ($baseAllowed + @("reasonCode")) ($baseAllowed + @("reasonCode")) $path
    if ($ReasonCodesByOutcome[$outcome] -notcontains $Item.reasonCode) {
      Add-ValidationError "$path.reasonCode '$($Item.reasonCode)' is not valid for outcome '$outcome'"
    }
  }

  if ($Item.blindCaseId -notmatch "^BR-(00[1-9]|01[0-7])$") {
    Add-ValidationError "$path.blindCaseId '$($Item.blindCaseId)' is invalid"
  }
  if ($PackBlindCaseIds -notcontains $Item.blindCaseId) {
    Add-ValidationError "$path.blindCaseId '$($Item.blindCaseId)' is not present in the reviewer pack"
  }

  if ($Item.expectedHumanAction -ne $ExpectedActionByOutcome[$outcome]) {
    Add-ValidationError "$path.expectedHumanAction must be '$($ExpectedActionByOutcome[$outcome])' for outcome '$outcome'"
  }

  if ($AllowedEvidenceStateByOutcome[$outcome] -notcontains $Item.evidenceState) {
    Add-ValidationError "$path.evidenceState '$($Item.evidenceState)' is not coherent with outcome '$outcome'"
  }
  if ($outcome -eq "ABSTENTION" -and $AllowedEvidenceStateByAbstentionReason[$Item.reasonCode] -notcontains $Item.evidenceState) {
    Add-ValidationError "$path.evidenceState '$($Item.evidenceState)' is not coherent with abstention reason '$($Item.reasonCode)'"
  }

  Test-CriticalFlags $Item.criticalFlags $path $outcome
}

if ([string]::IsNullOrWhiteSpace($ResponsePath)) {
  Add-ValidationError "ResponsePath is required"
}
if ([string]::IsNullOrWhiteSpace($ReviewerPackPath)) {
  Add-ValidationError "ReviewerPackPath is required"
}

foreach ($path in @($ResponsePath, $ReviewerPackPath, $ResponseSchemaPath)) {
  if (-not [string]::IsNullOrWhiteSpace($path)) {
    Test-NoBomAndLfOnly $path
  }
}

Write-Host "042a2 human review response validation"
Write-Host "Response: $ResponsePath"
Write-Host "Reviewer pack: $ReviewerPackPath"
Write-Host "Response schema: $ResponseSchemaPath"

$response = $null
$pack = $null
$schema = $null
if (-not [string]::IsNullOrWhiteSpace($ResponsePath)) {
  $response = Read-JsonFile $ResponsePath
}
if (-not [string]::IsNullOrWhiteSpace($ReviewerPackPath)) {
  $pack = Read-JsonFile $ReviewerPackPath
}
if (-not [string]::IsNullOrWhiteSpace($ResponseSchemaPath)) {
  $schema = Read-JsonFile $ResponseSchemaPath
}

if ($null -ne $schema -and $schema.properties.responses.minItems -ne 17) {
  Add-ValidationError "response schema must require exactly 17 responses"
}

if ($null -ne $response) {
  Test-NoNullProperties $response "response"
  Test-ForbiddenPropertiesAndValues $response "response"
}

Test-ResponseRoot $response $pack

if ($null -ne $response -and $null -ne $pack -and (Test-JsonArray $response.responses)) {
  $targetCodes = Get-PackTargetCodes $pack
  Test-ContainsExactly $targetCodes @(
    "BS.ASSET.CASH_AND_EQUIVALENTS",
    "BS.ASSET.TRADE_RECEIVABLES",
    "BS.LIABILITY.TRADE_PAYABLES",
    "BS.EQUITY.RETAINED_EARNINGS",
    "PL.REVENUE.OPERATING_REVENUE",
    "PL.EXPENSE.OTHER_OPERATING_EXPENSES"
  ) "pack.targetCatalog.targets.code"

  $packBlindCaseIds = @()
  if (Test-JsonArray $pack.cases) {
    $packBlindCaseIds = @($pack.cases | ForEach-Object { $_.blindCaseId })
  }
  Test-ContainsExactly $packBlindCaseIds $ExpectedBlindCaseIds "pack.cases.blindCaseId"

  $responseBlindCaseIds = @($response.responses | ForEach-Object { $_.blindCaseId })
  Test-ContainsExactly $responseBlindCaseIds $ExpectedBlindCaseIds "response.responses.blindCaseId"

  for ($i = 0; $i -lt $response.responses.Count; $i++) {
    Test-ResponseItem $response.responses[$i] $targetCodes $packBlindCaseIds $i
  }
}

if ($script:Errors.Count -gt 0) {
  Write-Host ""
  foreach ($validationError in $script:Errors) {
    Write-Host "[FAIL] $validationError"
  }
  exit 1
}

Write-Host "Responses: $($response.responses.Count)"
Write-Host "All checks passed."
exit 0
