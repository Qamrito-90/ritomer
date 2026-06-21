[CmdletBinding()]
param(
  [string]$ReviewerAPath = (Join-Path $PSScriptRoot "reviews\042a2\reviewer-a-blind-v1.json"),
  [string]$ReviewerBPath = (Join-Path $PSScriptRoot "reviews\042a2\reviewer-b-blind-v1.json"),
  [string]$ResponseSchemaPath = (Join-Path $PSScriptRoot "reviews\042a2\reviewer-response-schema-v1.json"),
  [string]$SemanticCasesPath = (Join-Path $PSScriptRoot "fixtures\042a2\candidate-semantic-cases-v1.json"),
  [string]$PolicyFaultCasesPath = (Join-Path $PSScriptRoot "fixtures\042a2\candidate-policy-fault-cases-v1.json"),
  [string]$SnapshotPath = (Join-Path $PSScriptRoot "fixtures\042a2\taxonomy-snapshot-candidate-v1.json")
)

$ErrorActionPreference = "Stop"
$script:Errors = New-Object System.Collections.Generic.List[string]

$ExpectedReviewerAHash = "19D654092FA6324D2E5EB80200FF1430E94A47CBBF671BE62EA3EA668513FA59"
$ExpectedReviewerBHash = "BAD54B421CBDEE7357F6C618B3FA87F2F3E3A8A6E12D167DEDE09D84F5F8897F"
$ExpectedResponseSchemaHash = "2076AD96BCE752E3689981A9B699ADBB410EB7A635B35A0A02FFCFB1BE23861C"
$ExpectedSemanticCasesHash = "63AADB379DA47C3909D9391646923EA173978E16BA256EFF8BD903D1901D9F91"
$ExpectedPolicyFaultCasesHash = "65B334A26F3054156421127BC20C1E8948C4E95BFC5A298A26D8B84D5B729D3C"
$ExpectedSnapshotHash = "9E5E303EC10B6713C7A0A0AD33D031069407C6A862030BEF98D69F4786681BA7"

$RequiredReviewStatus = @("BLIND_REVIEW_INPUT", "PENDING_INDEPENDENT_REVIEW", "NOT_GOLDEN", "NOT_AUTHORITATIVE")
$AllowedOutcomes = @("SUGGESTION", "ABSTENTION", "POLICY_BLOCK", "PRECONDITION_BLOCK", "INVALID_MODEL_OUTPUT")
$AllowedAbstentionReasonCodes = @("OUT_OF_SCOPE", "CONFLICTING_SIGNALS", "INSUFFICIENT_EVIDENCE", "TAXONOMY_GAP", "AMBIGUOUS_TARGET")
$ExpectedCandidateTargetCodes = @(
  "BS.ASSET.CASH_AND_EQUIVALENTS",
  "BS.ASSET.TRADE_RECEIVABLES",
  "BS.LIABILITY.TRADE_PAYABLES",
  "BS.EQUITY.RETAINED_EARNINGS",
  "PL.REVENUE.OPERATING_REVENUE",
  "PL.EXPENSE.OTHER_OPERATING_EXPENSES"
)
$ExpectedActionByOutcome = @{
  SUGGESTION = "REVIEW_TARGET"
  ABSTENTION = "REVIEW_ABSTENTION_REASON"
  POLICY_BLOCK = "ROUTE_TO_GOVERNANCE"
  PRECONDITION_BLOCK = "CHECK_PRECONDITION"
  INVALID_MODEL_OUTPUT = "ROUTE_TO_TECHNICAL_REVIEW"
}
$NonNoneCriticalFlags = @(
  "ACTIVE_PASSIVE_BOUNDARY",
  "BALANCE_SHEET_INCOME_STATEMENT_BOUNDARY",
  "REVENUE_EXPENSE_BOUNDARY",
  "CONTRA_ACCOUNT",
  "TARGET_VALIDITY",
  "TAXONOMY_GAP",
  "POLICY_INCIDENT",
  "TECHNICAL_INCIDENT"
)

$ForbiddenPackPropertyNames = @(
  "expected",
  "category",
  "tags",
  "trigger",
  "reasonCode",
  "blockCode",
  "invalidReason",
  "mustNotBeReasonCode",
  "businessAbstentionCounted",
  "providerCallExpected",
  "explanationCode",
  "evidence",
  "evidenceConstraints",
  "sourceArtifacts",
  "sourceKind",
  "sourceCaseId",
  "sourceId",
  "originalId",
  "caseInputHash",
  "sha256",
  "taxonomySnapshotSha256",
  "taxonomySnapshotId",
  "comment",
  "correction",
  "answer",
  "rationale",
  "confidence",
  "historicalMapping",
  "mappingHistory",
  "previousTargetCode",
  "currentTargetCode",
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
  "csv"
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
  "invalid-output-[0-9a-z-]+",
  "candidate-semantic-cases-v1\.json",
  "candidate-policy-fault-cases-v1\.json",
  "taxonomy-snapshot-candidate-v1\.json",
  "demo-input-unmapped-v1\.json"
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

function Get-Sha256HexFromBytes {
  param([byte[]]$Bytes)

  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $sha.ComputeHash($Bytes)
  } finally {
    $sha.Dispose()
  }

  return (($hashBytes | ForEach-Object { $_.ToString("x2") }) -join "").ToUpperInvariant()
}

function Get-Sha256HexFromString {
  param([string]$Value)

  $encoding = New-Object System.Text.UTF8Encoding($false)
  return Get-Sha256HexFromBytes $encoding.GetBytes($Value)
}

function Get-Sha256Hex {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    Add-ValidationError "file not found for hash: $Path"
    return ""
  }

  return Get-Sha256HexFromBytes ([System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Path)))
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

function ConvertTo-StableJson {
  param([object]$Value)
  return ($Value | ConvertTo-Json -Depth 80 -Compress)
}

function Get-ReviewInputFingerprint {
  param([object]$ReviewInput)

  $canonical = [ordered]@{
    schemaVersion = "042a2-blind-review-validator-review-input-fingerprint-v1"
    reviewInput = $ReviewInput
  }
  return Get-Sha256HexFromString (ConvertTo-StableJson $canonical)
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
      if ($ForbiddenPackPropertyNames -contains $property.Name) {
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

function Test-PackRoot {
  param([object]$Pack, [string]$ReviewerId, [string]$Path)

  if ($null -eq $Pack) {
    return
  }

  Test-RequiredProperties $Pack @("schemaVersion", "reviewerId", "status", "responseSchemaPath", "distributionRules", "blindReviewRules", "targetCatalog", "cases") @("schemaVersion", "reviewerId", "status", "responseSchemaPath", "distributionRules", "blindReviewRules", "targetCatalog", "cases") $Path
  if ($Pack.schemaVersion -ne "042a2-blind-review-pack-v1") {
    Add-ValidationError "$Path.schemaVersion is invalid"
  }
  if ($Pack.reviewerId -ne $ReviewerId) {
    Add-ValidationError "$Path.reviewerId expected '$ReviewerId', got '$($Pack.reviewerId)'"
  }
  Test-ContainsExactly @($Pack.status) $RequiredReviewStatus "$Path.status"
  if ($Pack.responseSchemaPath -ne "evals/mapping/reviews/042a2/reviewer-response-schema-v1.json") {
    Add-ValidationError "$Path.responseSchemaPath is invalid"
  }
  if (-not (Test-JsonArray $Pack.distributionRules) -or $Pack.distributionRules.Count -lt 3) {
    Add-ValidationError "$Path.distributionRules must contain explicit distribution rules"
  }
  if (-not (Test-JsonArray $Pack.blindReviewRules) -or $Pack.blindReviewRules.Count -lt 3) {
    Add-ValidationError "$Path.blindReviewRules must contain explicit blind review rules"
  }
}

function Test-TargetCatalog {
  param([object]$Catalog, [object]$Snapshot, [string]$Path)

  if ($null -eq $Catalog) {
    Add-ValidationError "$Path.targetCatalog is missing"
    return
  }

  Test-RequiredProperties $Catalog @("schemaVersion", "targets") @("schemaVersion", "targets") "$Path.targetCatalog"
  if ($Catalog.schemaVersion -ne "042a2-blind-review-target-catalog-v1") {
    Add-ValidationError "$Path.targetCatalog.schemaVersion is invalid"
  }

  $expectedTargets = @($Snapshot.entries | Where-Object { $_.pilotRole -eq "CANDIDATE_LEAF" -and $_.selectable -eq $true -and $_.deprecated -eq $false } | Sort-Object displayOrder)
  if (-not (Test-JsonArray $Catalog.targets)) {
    Add-ValidationError "$Path.targetCatalog.targets must be an array"
    return
  }
  if ($Catalog.targets.Count -ne 6) {
    Add-ValidationError "$Path.targetCatalog.targets must contain exactly 6 candidate targets"
  }
  if ($Catalog.targets.Count -ne $expectedTargets.Count) {
    Add-ValidationError "$Path.targetCatalog.targets expected $($expectedTargets.Count), got $($Catalog.targets.Count)"
  }

  $codes = @($Catalog.targets | ForEach-Object { $_.code })
  Test-ContainsExactly $codes $ExpectedCandidateTargetCodes "$Path.targetCatalog.targets.code"

  for ($i = 0; $i -lt $expectedTargets.Count -and $i -lt $Catalog.targets.Count; $i++) {
    $target = $Catalog.targets[$i]
    $expected = $expectedTargets[$i]
    Test-RequiredProperties $target @("code", "label", "statement", "normalSide") @("code", "label", "statement", "normalSide") "$Path.targetCatalog.targets[$i]"
    foreach ($field in @("code", "label", "statement", "normalSide")) {
      if ($target.$field -ne $expected.$field) {
        Add-ValidationError "$Path.targetCatalog.targets[$i].$field expected '$($expected.$field)', got '$($target.$field)'"
      }
    }
  }
}

function Test-PackCases {
  param([object]$Pack, [string]$Path)

  if ($null -eq $Pack -or -not (Test-JsonArray $Pack.cases)) {
    Add-ValidationError "$Path.cases must be an array"
    return
  }
  if ($Pack.cases.Count -ne 17) {
    Add-ValidationError "$Path.cases expected 17 cases, got $($Pack.cases.Count)"
  }

  $ids = @()
  $fingerprints = @()
  foreach ($case in $Pack.cases) {
    Test-RequiredProperties $case @("blindCaseId", "reviewInput") @("blindCaseId", "reviewInput") "$Path.cases[$($case.blindCaseId)]"
    if ($case.blindCaseId -notmatch "^BR-(00[1-9]|01[0-7])$") {
      Add-ValidationError "$Path.cases contains non-neutral id '$($case.blindCaseId)'"
    }
    if ($null -eq $case.reviewInput -or -not ($case.reviewInput -is [pscustomobject])) {
      Add-ValidationError "$Path.cases[$($case.blindCaseId)].reviewInput must be an object"
    } else {
      $fingerprints += Get-ReviewInputFingerprint $case.reviewInput
    }
    $ids += $case.blindCaseId
  }

  Test-ContainsExactly $ids (@(1..17 | ForEach-Object { "BR-{0:D3}" -f $_ })) "$Path.cases.blindCaseId"
  if (($fingerprints | Sort-Object -Unique).Count -ne 17) {
    Add-ValidationError "$Path.cases.reviewInput must contain 17 unique review inputs"
  }
}

function Test-SameSetDifferentOrder {
  param([object]$PackA, [object]$PackB)

  if ($null -eq $PackA -or $null -eq $PackB -or -not (Test-JsonArray $PackA.cases) -or -not (Test-JsonArray $PackB.cases)) {
    return
  }

  Test-ContainsExactly @($PackA.cases | ForEach-Object { $_.blindCaseId }) @($PackB.cases | ForEach-Object { $_.blindCaseId }) "reviewer packs blindCaseId set"

  $orderA = (@($PackA.cases | ForEach-Object { $_.blindCaseId }) -join "|")
  $orderB = (@($PackB.cases | ForEach-Object { $_.blindCaseId }) -join "|")
  if ($orderA -eq $orderB) {
    Add-ValidationError "reviewer A and B case orders must be different"
  }

  $mapA = @{}
  foreach ($case in $PackA.cases) {
    $mapA[$case.blindCaseId] = Get-ReviewInputFingerprint $case.reviewInput
  }
  foreach ($case in $PackB.cases) {
    if (-not $mapA.ContainsKey($case.blindCaseId)) {
      continue
    }
    $fingerprint = Get-ReviewInputFingerprint $case.reviewInput
    if ($mapA[$case.blindCaseId] -ne $fingerprint) {
      Add-ValidationError "blindCaseId '$($case.blindCaseId)' points to different reviewInput across packs"
    }
  }
}

function Test-SourceHashes {
  Test-Hash $SemanticCasesPath $ExpectedSemanticCasesHash "candidate-semantic-cases-v1.json"
  Test-Hash $PolicyFaultCasesPath $ExpectedPolicyFaultCasesHash "candidate-policy-fault-cases-v1.json"
  Test-Hash $SnapshotPath $ExpectedSnapshotHash "taxonomy-snapshot-candidate-v1.json"
}

function Test-CriticalFlagsSchema {
  param([object]$CriticalFlagsDef)

  if ($null -eq $CriticalFlagsDef -or -not (Test-JsonArray $CriticalFlagsDef.oneOf) -or $CriticalFlagsDef.oneOf.Count -ne 2) {
    Add-ValidationError "responseSchema.criticalFlags must use oneOf with NONE-exclusive and non-NONE branches"
    return
  }

  $noneBranch = $CriticalFlagsDef.oneOf[0]
  $nonNoneBranch = $CriticalFlagsDef.oneOf[1]
  if ($noneBranch.maxItems -ne 1 -or $noneBranch.items.const -ne "NONE") {
    Add-ValidationError "responseSchema.criticalFlags NONE branch must allow only a single NONE"
  }
  Test-ContainsExactly @($nonNoneBranch.items.enum) $NonNoneCriticalFlags "responseSchema.criticalFlags non-NONE enum"
  if (@($nonNoneBranch.items.enum) -contains "NONE") {
    Add-ValidationError "responseSchema.criticalFlags non-NONE branch must not contain NONE"
  }
}

function Test-ResponseSchema {
  param([object]$Schema)

  if ($null -eq $Schema) {
    return
  }

  Test-NoNullProperties $Schema "responseSchema"
  Test-RequiredProperties $Schema @('$schema', '$id', 'title', 'type', 'additionalProperties', 'required', 'properties', '$defs') @('$schema', '$id', 'title', 'type', 'additionalProperties', 'required', 'properties', '$defs') "responseSchema"
  if ($Schema.type -ne "object") {
    Add-ValidationError "responseSchema.type must be object"
  }
  if ($Schema.additionalProperties -ne $false) {
    Add-ValidationError "responseSchema.additionalProperties must be false"
  }
  Test-ContainsExactly @($Schema.required) @("schemaVersion", "status", "reviewerId", "responses") "responseSchema.required"

  $properties = $Schema.properties
  Test-RequiredProperties $properties @("schemaVersion", "status", "reviewerId", "responses") @("schemaVersion", "status", "reviewerId", "responses") "responseSchema.properties"
  if ($properties.responses.minItems -ne 17 -or $properties.responses.maxItems -ne 17) {
    Add-ValidationError "responseSchema.properties.responses must require exactly 17 responses"
  }

  $defs = $Schema.'$defs'
  Test-RequiredProperties $defs @("blindCaseId", "targetCode", "abstentionReasonCode", "policyReasonCode", "preconditionReasonCode", "invalidOutputReasonCode", "evidenceState", "criticalFlags", "expectedHumanAction", "reviewResponse") @("blindCaseId", "targetCode", "abstentionReasonCode", "policyReasonCode", "preconditionReasonCode", "invalidOutputReasonCode", "evidenceState", "criticalFlags", "expectedHumanAction", "reviewResponse") "responseSchema.`$defs"
  Test-ContainsExactly @($defs.targetCode.enum) $ExpectedCandidateTargetCodes "responseSchema.targetCode.enum"
  Test-ContainsExactly @($defs.abstentionReasonCode.enum) $AllowedAbstentionReasonCodes "responseSchema.abstentionReasonCode.enum"
  Test-CriticalFlagsSchema $defs.criticalFlags

  $branches = @($defs.reviewResponse.oneOf)
  if ($branches.Count -ne 5) {
    Add-ValidationError "responseSchema.reviewResponse.oneOf must contain exactly 5 branches"
    return
  }

  $outcomes = @()
  foreach ($branch in $branches) {
    if ($branch.type -ne "object") {
      Add-ValidationError "responseSchema branch type must be object"
    }
    if ($branch.additionalProperties -ne $false) {
      Add-ValidationError "responseSchema branch additionalProperties must be false"
    }
    $required = @($branch.required)
    foreach ($field in @("blindCaseId", "outcome", "evidenceState", "criticalFlags", "expectedHumanAction")) {
      if ($required -notcontains $field) {
        Add-ValidationError "responseSchema branch for '$($branch.properties.outcome.const)' misses required '$field'"
      }
    }
    $outcome = $branch.properties.outcome.const
    $outcomes += $outcome
    if ($AllowedOutcomes -notcontains $outcome) {
      Add-ValidationError "responseSchema branch has unsupported outcome '$outcome'"
    }
    if ($branch.properties.expectedHumanAction.const -ne $ExpectedActionByOutcome[$outcome]) {
      Add-ValidationError "$outcome branch must constrain expectedHumanAction to '$($ExpectedActionByOutcome[$outcome])'"
    }
    $propertyNames = @($branch.properties.PSObject.Properties | ForEach-Object { $_.Name })
    if ($outcome -eq "SUGGESTION") {
      if ($required -notcontains "targetCode" -or $propertyNames -notcontains "targetCode") {
        Add-ValidationError "SUGGESTION branch must require targetCode"
      }
      if ($required -contains "reasonCode" -or $propertyNames -contains "reasonCode") {
        Add-ValidationError "SUGGESTION branch must not allow reasonCode"
      }
    } else {
      if ($required -notcontains "reasonCode" -or $propertyNames -notcontains "reasonCode") {
        Add-ValidationError "$outcome branch must require reasonCode"
      }
      if ($required -contains "targetCode" -or $propertyNames -contains "targetCode") {
        Add-ValidationError "$outcome branch must not allow targetCode"
      }
    }
  }

  Test-ContainsExactly $outcomes $AllowedOutcomes "responseSchema.reviewResponse outcomes"
}

foreach ($path in @($ReviewerAPath, $ReviewerBPath, $ResponseSchemaPath, $SemanticCasesPath, $PolicyFaultCasesPath, $SnapshotPath)) {
  Test-NoBomAndLfOnly $path
}

Write-Host "042a2 blind review pack validation"
Write-Host "Reviewer A pack: $ReviewerAPath"
Write-Host "Reviewer B pack: $ReviewerBPath"
Write-Host "Response schema: $ResponseSchemaPath"

Test-SourceHashes
Test-Hash $ReviewerAPath $ExpectedReviewerAHash "reviewer-a-blind-v1.json"
Test-Hash $ReviewerBPath $ExpectedReviewerBHash "reviewer-b-blind-v1.json"
Test-Hash $ResponseSchemaPath $ExpectedResponseSchemaHash "reviewer-response-schema-v1.json"

$reviewerA = Read-JsonFile $ReviewerAPath
$reviewerB = Read-JsonFile $ReviewerBPath
$responseSchema = Read-JsonFile $ResponseSchemaPath
$snapshot = Read-JsonFile $SnapshotPath

Test-PackRoot $reviewerA "reviewer-a" "reviewerA"
Test-PackRoot $reviewerB "reviewer-b" "reviewerB"
Test-TargetCatalog $reviewerA.targetCatalog $snapshot "reviewerA"
Test-TargetCatalog $reviewerB.targetCatalog $snapshot "reviewerB"
Test-PackCases $reviewerA "reviewerA"
Test-PackCases $reviewerB "reviewerB"
Test-SameSetDifferentOrder $reviewerA $reviewerB
Test-ResponseSchema $responseSchema

if ($null -ne $reviewerA) {
  Test-NoNullProperties $reviewerA "reviewerA"
  Test-ForbiddenPropertiesAndValues $reviewerA "reviewerA"
}
if ($null -ne $reviewerB) {
  Test-NoNullProperties $reviewerB "reviewerB"
  Test-ForbiddenPropertiesAndValues $reviewerB "reviewerB"
}

if ($script:Errors.Count -gt 0) {
  Write-Host ""
  foreach ($validationError in $script:Errors) {
    Write-Host "[FAIL] $validationError"
  }
  exit 1
}

Write-Host "Reviewer A cases: $($reviewerA.cases.Count)"
Write-Host "Reviewer B cases: $($reviewerB.cases.Count)"
Write-Host "All checks passed."
exit 0
