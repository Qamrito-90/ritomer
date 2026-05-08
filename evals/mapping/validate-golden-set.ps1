[CmdletBinding()]
param(
  [string]$GoldenSetPath = (Join-Path $PSScriptRoot "golden-set-v1.json"),
  [string]$TaxonomyPath = (Join-Path $PSScriptRoot "..\..\contracts\reference\manual-mapping-targets-v2.yaml")
)

$ErrorActionPreference = "Stop"
$script:Errors = New-Object System.Collections.Generic.List[string]
$script:FailedCaseIds = New-Object "System.Collections.Generic.HashSet[string]"
$script:ForbiddenValuePatterns = @(
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
  "storage\.googleapis\.com",
  "raw\s+csv",
  "client\s+real",
  "forvis",
  "mazars"
)

function Add-ValidationError {
  param(
    [string]$Message,
    [string]$CaseId = $null
  )

  if ([string]::IsNullOrWhiteSpace($CaseId)) {
    $script:Errors.Add($Message)
  } else {
    $script:Errors.Add("case '$CaseId': $Message")
    [void]$script:FailedCaseIds.Add($CaseId)
  }
}

function Test-JsonArray {
  param([object]$Value)
  return ($null -ne $Value -and $Value -is [System.Array])
}

function Test-RequiredProperties {
  param(
    [object]$Object,
    [string[]]$Allowed,
    [string[]]$Required,
    [string]$Path,
    [string]$CaseId = $null
  )

  if ($null -eq $Object -or -not ($Object -is [pscustomobject])) {
    Add-ValidationError "$Path must be an object" $CaseId
    return
  }

  $names = @($Object.PSObject.Properties | ForEach-Object { $_.Name })
  foreach ($requiredName in $Required) {
    if ($names -notcontains $requiredName) {
      Add-ValidationError "$Path is missing required field '$requiredName'" $CaseId
    }
  }

  foreach ($name in $names) {
    if ($Allowed -notcontains $name) {
      Add-ValidationError "$Path contains unsupported field '$name'" $CaseId
    }
  }
}

function Test-NonEmptyString {
  param(
    [object]$Value,
    [string]$Path,
    [string]$CaseId = $null
  )

  if ($null -eq $Value -or -not ($Value -is [string]) -or [string]::IsNullOrWhiteSpace($Value)) {
    Add-ValidationError "$Path must be a non-empty string" $CaseId
  }
}

function Test-Boolean {
  param(
    [object]$Value,
    [string]$Path,
    [string]$CaseId = $null
  )

  if ($null -eq $Value -or -not ($Value -is [bool])) {
    Add-ValidationError "$Path must be a boolean" $CaseId
  }
}

function Test-PositiveInteger {
  param(
    [object]$Value,
    [string]$Path,
    [string]$CaseId = $null
  )

  if ($null -eq $Value -or -not ($Value -is [int] -or $Value -is [long]) -or $Value -lt 1) {
    Add-ValidationError "$Path must be an integer >= 1" $CaseId
  }
}

function Test-SyntheticUuid {
  param([object]$Value)
  return ($Value -is [string] -and $Value -match "^00000000-0000-4000-800[0-9]-000000000[0-9]{3}$")
}

function Get-YamlScalarValue {
  param([string]$Value)

  $trimmed = $Value.Trim()
  $trimmed = $trimmed.Trim('"')
  $trimmed = $trimmed.Trim("'")

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

function Test-ForbiddenValues {
  param(
    [object]$Node,
    [string]$Path,
    [string]$CaseId = $null
  )

  if ($null -eq $Node) {
    return
  }

  if ($Node -is [string]) {
    foreach ($pattern in $script:ForbiddenValuePatterns) {
      if ($Node -match $pattern) {
        Add-ValidationError "$Path contains forbidden value pattern '$pattern'" $CaseId
      }
    }
    return
  }

  if ($Node -is [pscustomobject]) {
    foreach ($property in $Node.PSObject.Properties) {
      Test-ForbiddenValues $property.Value "$Path.$($property.Name)" $CaseId
    }
    return
  }

  if ($Node -is [System.Collections.IEnumerable]) {
    $index = 0
    foreach ($item in $Node) {
      Test-ForbiddenValues $item "$Path[$index]" $CaseId
      $index++
    }
  }
}

function Test-StringArray {
  param(
    [object]$Value,
    [string]$Path,
    [string]$CaseId = $null,
    [bool]$AllowEmpty = $false
  )

  if (-not (Test-JsonArray $Value)) {
    Add-ValidationError "$Path must be an array" $CaseId
    return
  }

  if (-not $AllowEmpty -and $Value.Count -eq 0) {
    Add-ValidationError "$Path must not be empty" $CaseId
  }

  for ($i = 0; $i -lt $Value.Count; $i++) {
    Test-NonEmptyString $Value[$i] "$Path[$i]" $CaseId
  }
}

function Test-TargetKnown {
  param(
    [string]$TargetCode,
    [hashtable]$Targets,
    [string]$Path,
    [string]$CaseId
  )

  if (-not $Targets.ContainsKey($TargetCode)) {
    Add-ValidationError "$Path points to unknown target '$TargetCode'" $CaseId
    return $false
  }

  return $true
}

function Test-Evidence {
  param(
    [object]$Evidence,
    [object]$Case,
    [object]$Constraints
  )

  $caseId = $Case.id
  if (-not (Test-JsonArray $Evidence)) {
    Add-ValidationError "expected.suggestion.evidence must be an array" $caseId
    return
  }

  if ($Evidence.Count -lt 1 -or $Evidence.Count -gt 8) {
    Add-ValidationError "expected.suggestion.evidence must contain between 1 and 8 items" $caseId
  }

  if ($null -ne $Constraints -and $Constraints.PSObject.Properties.Name -contains "minItems" -and $Evidence.Count -lt $Constraints.minItems) {
    Add-ValidationError "expected.suggestion.evidence has fewer items than evidenceConstraints.minItems" $caseId
  }

  if ($null -ne $Constraints -and $Constraints.PSObject.Properties.Name -contains "maxItems" -and $Evidence.Count -gt $Constraints.maxItems) {
    Add-ValidationError "expected.suggestion.evidence has more items than evidenceConstraints.maxItems" $caseId
  }

  $allowedEvidenceTypes = @("ACCOUNT_LABEL", "BALANCE_IMPORT_LINE", "TARGET_TAXONOMY", "HISTORICAL_MAPPING", "RULE_DOC", "NOTE_TEMPLATE")
  $seenTypes = New-Object "System.Collections.Generic.HashSet[string]"

  for ($i = 0; $i -lt $Evidence.Count; $i++) {
    $item = $Evidence[$i]
    Test-RequiredProperties $item @("type", "ref", "snippet") @("type", "ref", "snippet") "expected.suggestion.evidence[$i]" $caseId
    Test-NonEmptyString $item.type "expected.suggestion.evidence[$i].type" $caseId
    Test-NonEmptyString $item.ref "expected.suggestion.evidence[$i].ref" $caseId
    Test-NonEmptyString $item.snippet "expected.suggestion.evidence[$i].snippet" $caseId

    if ($allowedEvidenceTypes -notcontains $item.type) {
      Add-ValidationError "expected.suggestion.evidence[$i].type '$($item.type)' is not allowed" $caseId
    } else {
      [void]$seenTypes.Add($item.type)
    }

    $combinedEvidence = "$($item.ref) $($item.snippet)"
    if ($combinedEvidence -match "other-tenant|cross-tenant") {
      Add-ValidationError "expected.suggestion.evidence[$i] contains cross-tenant wording" $caseId
    }

    foreach ($match in [regex]::Matches($combinedEvidence, "00000000-0000-4000-800[0-9]-000000000[0-9]{3}")) {
      $matchedId = $match.Value
      if ($matchedId -ne $Case.tenantId -and $matchedId -ne $Case.closingFolderId) {
        Add-ValidationError "expected.suggestion.evidence[$i] references a synthetic id outside the current case scope" $caseId
      }
    }

    if ($item.type -eq "HISTORICAL_MAPPING" -and $null -ne $Case.context -and $null -ne $Case.context.history -and $Case.context.history.tenantScope -eq "other-tenant") {
      Add-ValidationError "historical mapping evidence must not be used when history is outside tenant scope" $caseId
    }
  }

  if ($null -ne $Constraints -and $Constraints.PSObject.Properties.Name -contains "requiredTypes") {
    if (-not (Test-JsonArray $Constraints.requiredTypes)) {
      Add-ValidationError "expected.evidenceConstraints.requiredTypes must be an array" $caseId
    } else {
      foreach ($requiredType in $Constraints.requiredTypes) {
        if (-not $seenTypes.Contains($requiredType)) {
          Add-ValidationError "expected.suggestion.evidence is missing required evidence type '$requiredType'" $caseId
        }
      }
    }
  }
}

function Test-Context {
  param(
    [object]$Context,
    [hashtable]$Targets,
    [string]$CaseId
  )

  if ($null -eq $Context) {
    return
  }

  Test-RequiredProperties $Context @("eligibility", "sanitizedSignals", "candidateTargetCode", "history", "note") @() "context" $CaseId

  if ($Context.PSObject.Properties.Name -contains "eligibility") {
    Test-RequiredProperties $Context.eligibility @("presentInLatestImport", "alreadyMapped", "currentTargetCode") @("presentInLatestImport", "alreadyMapped") "context.eligibility" $CaseId
    Test-Boolean $Context.eligibility.presentInLatestImport "context.eligibility.presentInLatestImport" $CaseId
    Test-Boolean $Context.eligibility.alreadyMapped "context.eligibility.alreadyMapped" $CaseId
    if ($Context.eligibility.PSObject.Properties.Name -contains "currentTargetCode" -and $null -ne $Context.eligibility.currentTargetCode) {
      Test-NonEmptyString $Context.eligibility.currentTargetCode "context.eligibility.currentTargetCode" $CaseId
      [void](Test-TargetKnown $Context.eligibility.currentTargetCode $Targets "context.eligibility.currentTargetCode" $CaseId)
    }
  }

  if ($Context.PSObject.Properties.Name -contains "sanitizedSignals") {
    Test-StringArray $Context.sanitizedSignals "context.sanitizedSignals" $CaseId $true
  }

  if ($Context.PSObject.Properties.Name -contains "candidateTargetCode") {
    Test-NonEmptyString $Context.candidateTargetCode "context.candidateTargetCode" $CaseId
    [void](Test-TargetKnown $Context.candidateTargetCode $Targets "context.candidateTargetCode" $CaseId)
  }

  if ($Context.PSObject.Properties.Name -contains "history") {
    Test-RequiredProperties $Context.history @("status", "tenantScope", "usable", "reason") @("status", "tenantScope", "usable", "reason") "context.history" $CaseId
    Test-NonEmptyString $Context.history.status "context.history.status" $CaseId
    Test-NonEmptyString $Context.history.tenantScope "context.history.tenantScope" $CaseId
    Test-Boolean $Context.history.usable "context.history.usable" $CaseId
    Test-NonEmptyString $Context.history.reason "context.history.reason" $CaseId
    if ($Context.history.tenantScope -notin @("current-tenant", "other-tenant")) {
      Add-ValidationError "context.history.tenantScope must be current-tenant or other-tenant" $CaseId
    }
  }

  if ($Context.PSObject.Properties.Name -contains "note") {
    Test-NonEmptyString $Context.note "context.note" $CaseId
  }
}

function Test-Expected {
  param(
    [object]$Case,
    [hashtable]$Targets
  )

  $caseId = $Case.id
  $expected = $Case.expected
  Test-RequiredProperties $expected @(
    "outcome",
    "suggestion",
    "rejectionReason",
    "rejectedTargetCode",
    "deferredReason",
    "acceptableRiskLevels",
    "maxConfidence",
    "evidenceConstraints"
  ) @("outcome", "suggestion", "rejectionReason", "evidenceConstraints") "expected" $caseId

  $allowedOutcomes = @("SUGGESTION", "NO_SUGGESTION", "REJECTED", "DEFERRED")
  if ($allowedOutcomes -notcontains $expected.outcome) {
    Add-ValidationError "expected.outcome '$($expected.outcome)' is not allowed" $caseId
  }

  if ($null -ne $expected.evidenceConstraints) {
    Test-RequiredProperties $expected.evidenceConstraints @("minItems", "maxItems", "requiredTypes", "forbidCrossTenant", "mustBeEmpty") @("forbidCrossTenant") "expected.evidenceConstraints" $caseId
    Test-Boolean $expected.evidenceConstraints.forbidCrossTenant "expected.evidenceConstraints.forbidCrossTenant" $caseId
  }

  if ($expected.outcome -eq "SUGGESTION") {
    if ($null -eq $expected.suggestion) {
      Add-ValidationError "positive expected outcome must contain expected.suggestion" $caseId
      return
    }

    $suggestion = $expected.suggestion
    Test-RequiredProperties $suggestion @(
      "accountCode",
      "accountLabel",
      "suggestedTargetCode",
      "confidence",
      "riskLevel",
      "rationale",
      "evidence",
      "requiresHumanReview",
      "schemaVersion",
      "promptVersion",
      "modelVersion"
    ) @(
      "accountCode",
      "accountLabel",
      "suggestedTargetCode",
      "confidence",
      "riskLevel",
      "rationale",
      "evidence",
      "requiresHumanReview",
      "schemaVersion",
      "promptVersion",
      "modelVersion"
    ) "expected.suggestion" $caseId

    Test-NonEmptyString $suggestion.accountCode "expected.suggestion.accountCode" $caseId
    Test-NonEmptyString $suggestion.accountLabel "expected.suggestion.accountLabel" $caseId
    Test-NonEmptyString $suggestion.suggestedTargetCode "expected.suggestion.suggestedTargetCode" $caseId
    Test-NonEmptyString $suggestion.rationale "expected.suggestion.rationale" $caseId
    Test-NonEmptyString $suggestion.schemaVersion "expected.suggestion.schemaVersion" $caseId
    Test-NonEmptyString $suggestion.promptVersion "expected.suggestion.promptVersion" $caseId
    Test-NonEmptyString $suggestion.modelVersion "expected.suggestion.modelVersion" $caseId

    if ($suggestion.accountCode -ne $Case.input.accountCode) {
      Add-ValidationError "expected.suggestion.accountCode must equal input.accountCode" $caseId
    }
    if ($suggestion.accountLabel -ne $Case.input.accountLabel) {
      Add-ValidationError "expected.suggestion.accountLabel must equal input.accountLabel" $caseId
    }
    if ($suggestion.schemaVersion -ne "mapping-suggestion-v1") {
      Add-ValidationError "expected.suggestion.schemaVersion must be mapping-suggestion-v1" $caseId
    }
    if ($suggestion.requiresHumanReview -ne $true) {
      Add-ValidationError "expected.suggestion.requiresHumanReview must be true" $caseId
    }
    if (-not ($suggestion.confidence -is [int] -or $suggestion.confidence -is [long] -or $suggestion.confidence -is [double] -or $suggestion.confidence -is [decimal]) -or $suggestion.confidence -lt 0 -or $suggestion.confidence -gt 1) {
      Add-ValidationError "expected.suggestion.confidence must be between 0 and 1" $caseId
    }
    if (@("LOW", "MEDIUM", "HIGH") -notcontains $suggestion.riskLevel) {
      Add-ValidationError "expected.suggestion.riskLevel must be LOW, MEDIUM or HIGH" $caseId
    }
    if ($expected.PSObject.Properties.Name -contains "acceptableRiskLevels") {
      Test-StringArray $expected.acceptableRiskLevels "expected.acceptableRiskLevels" $caseId
      if ($expected.acceptableRiskLevels -notcontains $suggestion.riskLevel) {
        Add-ValidationError "expected.suggestion.riskLevel is outside expected.acceptableRiskLevels" $caseId
      }
    }
    if ($expected.PSObject.Properties.Name -contains "maxConfidence" -and $null -ne $expected.maxConfidence -and $suggestion.confidence -gt $expected.maxConfidence) {
      Add-ValidationError "expected.suggestion.confidence exceeds expected.maxConfidence" $caseId
    }

    if (Test-TargetKnown $suggestion.suggestedTargetCode $Targets "expected.suggestion.suggestedTargetCode" $caseId) {
      $target = $Targets[$suggestion.suggestedTargetCode]
      if ($target["selectable"] -ne $true) {
        Add-ValidationError "positive expected suggestion points to non-selectable target '$($suggestion.suggestedTargetCode)'" $caseId
      }
      if ($target["deprecated"] -eq $true) {
        Add-ValidationError "positive expected suggestion points to deprecated target '$($suggestion.suggestedTargetCode)'" $caseId
      }
    }

    Test-Evidence $suggestion.evidence $Case $expected.evidenceConstraints
    return
  }

  if ($null -ne $expected.suggestion) {
    Add-ValidationError "non-positive expected outcome must not contain expected.suggestion" $caseId
  }

  Test-NonEmptyString $expected.rejectionReason "expected.rejectionReason" $caseId

  if ($expected.PSObject.Properties.Name -contains "rejectedTargetCode" -and $null -ne $expected.rejectedTargetCode) {
    Test-NonEmptyString $expected.rejectedTargetCode "expected.rejectedTargetCode" $caseId
    [void](Test-TargetKnown $expected.rejectedTargetCode $Targets "expected.rejectedTargetCode" $caseId)
  }

  if ($expected.outcome -eq "DEFERRED") {
    Test-NonEmptyString $expected.deferredReason "expected.deferredReason" $caseId
  }

  if ($null -ne $expected.evidenceConstraints -and $expected.evidenceConstraints.PSObject.Properties.Name -contains "mustBeEmpty" -and $expected.evidenceConstraints.mustBeEmpty -ne $true) {
    Add-ValidationError "non-positive expected outcome should set evidenceConstraints.mustBeEmpty to true" $caseId
  }
}

function Test-Case {
  param(
    [object]$Case,
    [hashtable]$Targets,
    [int]$TaxonomyVersion
  )

  $caseId = $Case.id
  Test-RequiredProperties $Case @(
    "id",
    "tenantId",
    "closingFolderId",
    "latestImportVersion",
    "taxonomyVersion",
    "input",
    "context",
    "expected",
    "tags"
  ) @(
    "id",
    "tenantId",
    "closingFolderId",
    "latestImportVersion",
    "taxonomyVersion",
    "input",
    "expected",
    "tags"
  ) "case" $caseId

  Test-NonEmptyString $Case.id "id" $caseId
  if (-not (Test-SyntheticUuid $Case.tenantId)) {
    Add-ValidationError "tenantId must use the reserved synthetic UUID pattern" $caseId
  }
  if (-not (Test-SyntheticUuid $Case.closingFolderId)) {
    Add-ValidationError "closingFolderId must use the reserved synthetic UUID pattern" $caseId
  }
  Test-PositiveInteger $Case.latestImportVersion "latestImportVersion" $caseId
  Test-PositiveInteger $Case.taxonomyVersion "taxonomyVersion" $caseId
  if ($null -ne $TaxonomyVersion -and $Case.taxonomyVersion -ne $TaxonomyVersion) {
    Add-ValidationError "taxonomyVersion must match taxonomy file version $TaxonomyVersion" $caseId
  }

  Test-RequiredProperties $Case.input @("accountCode", "accountLabel", "debit", "credit") @("accountCode", "accountLabel", "debit", "credit") "input" $caseId
  Test-NonEmptyString $Case.input.accountCode "input.accountCode" $caseId
  Test-NonEmptyString $Case.input.accountLabel "input.accountLabel" $caseId
  Test-NonEmptyString $Case.input.debit "input.debit" $caseId
  Test-NonEmptyString $Case.input.credit "input.credit" $caseId

  Test-Context $Case.context $Targets $caseId
  Test-Expected $Case $Targets
  Test-StringArray $Case.tags "tags" $caseId
  Test-ForbiddenValues $Case "case" $caseId
}

$goldenSet = $null
if (-not (Test-Path -LiteralPath $GoldenSetPath)) {
  Add-ValidationError "golden set file not found: $GoldenSetPath"
} else {
  try {
    $goldenSet = Get-Content -Raw -LiteralPath $GoldenSetPath | ConvertFrom-Json
  } catch {
    Add-ValidationError "golden set is not valid JSON: $($_.Exception.Message)"
  }
}

$taxonomy = Read-Taxonomy $TaxonomyPath

$totalCases = 0
if ($null -ne $goldenSet) {
  Test-RequiredProperties $goldenSet @("schemaVersion", "createdFor", "description", "cases") @("schemaVersion", "createdFor", "description", "cases") "root"
  Test-NonEmptyString $goldenSet.schemaVersion "root.schemaVersion"
  Test-NonEmptyString $goldenSet.createdFor "root.createdFor"
  Test-NonEmptyString $goldenSet.description "root.description"

  if ($goldenSet.schemaVersion -ne "mapping-golden-set-v1") {
    Add-ValidationError "root.schemaVersion must be mapping-golden-set-v1"
  }

  if (-not (Test-JsonArray $goldenSet.cases)) {
    Add-ValidationError "root.cases must be an array"
  } else {
    $totalCases = $goldenSet.cases.Count
    $seenIds = New-Object "System.Collections.Generic.HashSet[string]"
    for ($i = 0; $i -lt $goldenSet.cases.Count; $i++) {
      $case = $goldenSet.cases[$i]
      if ($null -ne $case.id) {
        if (-not $seenIds.Add($case.id)) {
          Add-ValidationError "duplicate case id '$($case.id)'" $case.id
        }
      }
      Test-Case $case $taxonomy.Targets $taxonomy.Version
    }
  }
}

$failedCases = $script:FailedCaseIds.Count
if ($failedCases -eq 0 -and $script:Errors.Count -gt 0) {
  $failedCases = $script:Errors.Count
}
$passedCases = [Math]::Max(0, $totalCases - $script:FailedCaseIds.Count)

Write-Host "Mapping golden set validation"
Write-Host "Total cases: $totalCases"
Write-Host "Passed: $passedCases"
Write-Host "Failed: $failedCases"

if ($script:Errors.Count -gt 0) {
  Write-Host ""
  foreach ($validationError in $script:Errors) {
    Write-Host "[FAIL] $validationError"
  }
  exit 1
}

Write-Host "All checks passed."
exit 0
