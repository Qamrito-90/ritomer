[CmdletBinding()]
param(
  [string]$SemanticCasesPath = (Join-Path $PSScriptRoot "fixtures\042a2\candidate-semantic-cases-v1.json"),
  [string]$PolicyFaultCasesPath = (Join-Path $PSScriptRoot "fixtures\042a2\candidate-policy-fault-cases-v1.json"),
  [string]$SnapshotPath = (Join-Path $PSScriptRoot "fixtures\042a2\taxonomy-snapshot-candidate-v1.json"),
  [string]$DemoInputPath = (Join-Path $PSScriptRoot "fixtures\042a2\demo-input-unmapped-v1.json")
)

$ErrorActionPreference = "Stop"
$script:Errors = New-Object System.Collections.Generic.List[string]

$ExpectedSnapshotHash = "9E5E303EC10B6713C7A0A0AD33D031069407C6A862030BEF98D69F4786681BA7"
$ExpectedDemoInputHash = "B3C616B729014E6A87BB2124C10970EDF954D9F98FBD1F5C08E42B7ACAAA6D3F"
$ExpectedSemanticCasesHash = "63AADB379DA47C3909D9391646923EA173978E16BA256EFF8BD903D1901D9F91"
$ExpectedPolicyFaultCasesHash = "65B334A26F3054156421127BC20C1E8948C4E95BFC5A298A26D8B84D5B729D3C"

$RequiredCandidateStatus = @("CANDIDATE", "PENDING_DOUBLE_REVIEW", "NOT_GOLDEN", "NOT_AUTHORITATIVE")
$ForbiddenStatusLiterals = @("APPROVED", "AUTHORITATIVE", "FROZEN", "GOLDEN")
$AllowedEvidenceTypes = @("ACCOUNT_LABEL", "TARGET_TAXONOMY")
$AllowedBalanceSignals = @("DEBIT_DOMINANT", "CREDIT_DOMINANT")
$AllowedAbstentionReasonCodes = @("OUT_OF_SCOPE", "CONFLICTING_SIGNALS", "INSUFFICIENT_EVIDENCE", "TAXONOMY_GAP", "AMBIGUOUS_TARGET")
$ForbiddenArtificialReasonCodes = @("TAXONOMY_GAP", "AMBIGUOUS_TARGET")

$ExpectedSemanticResults = @(
  @{ accountCode = "1000"; accountLabel = "Synthetic cash account"; outcome = "SUGGESTION"; suggestedTargetCode = "BS.ASSET.CASH_AND_EQUIVALENTS" },
  @{ accountCode = "1100"; accountLabel = "Synthetic trade receivables"; outcome = "SUGGESTION"; suggestedTargetCode = "BS.ASSET.TRADE_RECEIVABLES" },
  @{ accountCode = "2000"; accountLabel = "Synthetic trade payables"; outcome = "SUGGESTION"; suggestedTargetCode = "BS.LIABILITY.TRADE_PAYABLES" },
  @{ accountCode = "2800"; accountLabel = "Synthetic retained earnings"; outcome = "SUGGESTION"; suggestedTargetCode = "BS.EQUITY.RETAINED_EARNINGS" },
  @{ accountCode = "3000"; accountLabel = "Synthetic operating revenue"; outcome = "SUGGESTION"; suggestedTargetCode = "PL.REVENUE.OPERATING_REVENUE" },
  @{ accountCode = "4000"; accountLabel = "Synthetic operating expenses"; outcome = "ABSTENTION"; reasonCode = "INSUFFICIENT_EVIDENCE" },
  @{ accountCode = "4010"; accountLabel = "Synthetic other operating expenses"; outcome = "SUGGESTION"; suggestedTargetCode = "PL.EXPENSE.OTHER_OPERATING_EXPENSES" }
)

$ExpectedPolicyTriggers = @(
  "NON_SYNTHETIC_REQUEST",
  "CROSS_TENANT_REQUEST",
  "OUTSIDE_ALLOWLIST_OR_PROVENANCE",
  "LANGUAGE_OUT_OF_COHORT",
  "ACCOUNT_ALREADY_AFFECTED"
)

$ExpectedInvalidReasons = @(
  "TARGET_UNKNOWN",
  "TARGET_DEPRECATED",
  "TARGET_NOT_SELECTABLE",
  "SECTION_OR_ROOT_PROPOSED"
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
  "file:",
  "raw\s+csv",
  "[A-Z]{2}\d{2}[A-Z0-9]{11,30}",
  "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
  "\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
  "\b(CHF|EUR|USD)\s*\d"
)

$ForbiddenPropertyNames = @(
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
  "historicalMapping",
  "mappingHistory",
  "previousTargetCode",
  "currentTargetCode",
  "providerFreeText",
  "providerText",
  "rawProviderOutput",
  "rationale",
  "confidence"
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

function Test-Hash {
  param([string]$Path, [string]$ExpectedHash, [string]$Name)

  if (-not (Test-Path -LiteralPath $Path)) {
    Add-ValidationError "file not found for hash: $Path"
    return
  }

  $actual = Get-Sha256Hex $Path
  Write-Host "$Name SHA-256: $actual"
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
    if ($Path -match "\.sha256$") {
      return
    }
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

function Test-CandidateStatus {
  param([object]$Status, [string]$Path)

  if (-not (Test-JsonArray $Status)) {
    Add-ValidationError "$Path must be an array"
    return
  }

  $values = @($Status | ForEach-Object { [string]$_ })
  Test-ContainsExactly $values $RequiredCandidateStatus $Path
  foreach ($statusValue in $values) {
    if ($ForbiddenStatusLiterals -contains $statusValue) {
      Add-ValidationError "$Path contains forbidden status literal '$statusValue'"
    }
  }
}

function Test-StringArrayContains {
  param(
    [object]$ArrayValue,
    [string[]]$RequiredValues,
    [string]$Path
  )

  if (-not (Test-JsonArray $ArrayValue)) {
    Add-ValidationError "$Path must be an array"
    return
  }

  $values = @($ArrayValue | ForEach-Object { [string]$_ })
  foreach ($requiredValue in $RequiredValues) {
    if ($values -notcontains $requiredValue) {
      Add-ValidationError "$Path must contain '$requiredValue'"
    }
  }
}

function Test-SourceArtifacts {
  param([object]$Root, [string]$Path)

  Test-RequiredProperties $Root.sourceArtifacts @("taxonomySnapshot", "demoInputProjection") @("taxonomySnapshot", "demoInputProjection") "$Path.sourceArtifacts"
  Test-RequiredProperties $Root.sourceArtifacts.taxonomySnapshot @("path", "sha256") @("path", "sha256") "$Path.sourceArtifacts.taxonomySnapshot"
  Test-RequiredProperties $Root.sourceArtifacts.demoInputProjection @("path", "sha256") @("path", "sha256") "$Path.sourceArtifacts.demoInputProjection"

  if ($Root.sourceArtifacts.taxonomySnapshot.path -ne "evals/mapping/fixtures/042a2/taxonomy-snapshot-candidate-v1.json") {
    Add-ValidationError "$Path.sourceArtifacts.taxonomySnapshot.path is invalid"
  }
  if ($Root.sourceArtifacts.demoInputProjection.path -ne "evals/mapping/fixtures/042a2/demo-input-unmapped-v1.json") {
    Add-ValidationError "$Path.sourceArtifacts.demoInputProjection.path is invalid"
  }
  if ($Root.sourceArtifacts.taxonomySnapshot.sha256 -ne $ExpectedSnapshotHash) {
    Add-ValidationError "$Path.sourceArtifacts.taxonomySnapshot.sha256 is invalid"
  }
  if ($Root.sourceArtifacts.demoInputProjection.sha256 -ne $ExpectedDemoInputHash) {
    Add-ValidationError "$Path.sourceArtifacts.demoInputProjection.sha256 is invalid"
  }
}

function Get-TargetMapFromSnapshot {
  param([object]$Snapshot)

  $targets = @{}
  if ($null -eq $Snapshot -or -not (Test-JsonArray $Snapshot.entries)) {
    Add-ValidationError "snapshot.entries must be an array"
    return $targets
  }

  foreach ($entry in $Snapshot.entries) {
    if ($null -ne $entry.code) {
      $targets[$entry.code] = $entry
    }
  }
  return $targets
}

function Test-TargetIsCandidateLeaf {
  param([string]$TargetCode, [hashtable]$Targets, [string]$Path)

  if (-not $Targets.ContainsKey($TargetCode)) {
    Add-ValidationError "$Path points to unknown target '$TargetCode'"
    return
  }

  $target = $Targets[$TargetCode]
  if ($target.pilotRole -ne "CANDIDATE_LEAF") {
    Add-ValidationError "$Path must point to a CANDIDATE_LEAF target"
  }
  if ($target.selectable -ne $true) {
    Add-ValidationError "$Path must point to selectable=true"
  }
  if ($target.deprecated -ne $false) {
    Add-ValidationError "$Path must point to deprecated=false"
  }
}

function Test-Evidence {
  param([object]$Evidence, [object]$Expected, [string]$Path)

  if (-not (Test-JsonArray $Evidence)) {
    Add-ValidationError "$Path.evidence must be an array"
    return
  }

  if ($Evidence.Count -lt $Expected.evidenceConstraints.minItems) {
    Add-ValidationError "$Path.evidence has fewer items than expected.evidenceConstraints.minItems"
  }

  $seenTypes = New-Object "System.Collections.Generic.HashSet[string]"
  for ($i = 0; $i -lt $Evidence.Count; $i++) {
    $item = $Evidence[$i]
    Test-RequiredProperties $item @("type", "ref", "snippet") @("type", "ref", "snippet") "$Path.evidence[$i]"
    Test-NonEmptyString $item.type "$Path.evidence[$i].type"
    Test-NonEmptyString $item.ref "$Path.evidence[$i].ref"
    Test-NonEmptyString $item.snippet "$Path.evidence[$i].snippet"
    if ($AllowedEvidenceTypes -notcontains $item.type) {
      Add-ValidationError "$Path.evidence[$i].type '$($item.type)' is not allowed"
    } else {
      [void]$seenTypes.Add($item.type)
    }
  }

  Test-StringArrayContains $Expected.evidenceConstraints.requiredTypes @($Expected.evidenceConstraints.requiredTypes) "$Path.expected.evidenceConstraints.requiredTypes"
  foreach ($requiredType in @($Expected.evidenceConstraints.requiredTypes)) {
    if (-not $seenTypes.Contains($requiredType)) {
      Add-ValidationError "$Path.evidence is missing required type '$requiredType'"
    }
  }
}

function Test-CoverageGaps {
  param([object]$CoverageGaps, [string]$Path)

  if (-not (Test-JsonArray $CoverageGaps)) {
    Add-ValidationError "$Path.coverageGaps must be an array"
    return
  }

  $gapCodes = @()
  for ($i = 0; $i -lt $CoverageGaps.Count; $i++) {
    $gap = $CoverageGaps[$i]
    Test-RequiredProperties $gap @("gapCode", "documentationCode") @("gapCode", "documentationCode") "$Path.coverageGaps[$i]"
    Test-NonEmptyString $gap.gapCode "$Path.coverageGaps[$i].gapCode"
    Test-NonEmptyString $gap.documentationCode "$Path.coverageGaps[$i].documentationCode"
    $gapCodes += $gap.gapCode
  }

  Test-ContainsExactly $gapCodes @("TAXONOMY_GAP", "AMBIGUOUS_TARGET", "OUT_OF_SCOPE", "CONFLICTING_SIGNALS") "$Path.coverageGaps.gapCode"
}

function Test-SemanticCases {
  param([object]$SemanticCases, [hashtable]$Targets)

  if ($null -eq $SemanticCases) {
    return
  }

  Test-RequiredProperties $SemanticCases @("schemaVersion", "status", "sourceArtifacts", "scope", "guardrails", "cases", "coverageGaps") @("schemaVersion", "status", "sourceArtifacts", "scope", "guardrails", "cases", "coverageGaps") "semantic"
  if ($SemanticCases.schemaVersion -ne "042a2-candidate-semantic-cases-v1") {
    Add-ValidationError "semantic.schemaVersion is invalid"
  }
  Test-CandidateStatus $SemanticCases.status "semantic.status"
  Test-SourceArtifacts $SemanticCases "semantic"
  Test-RequiredProperties $SemanticCases.scope @("dataset", "taxonomySnapshotId", "taxonomyVersion", "language", "caseType") @("dataset", "taxonomySnapshotId", "taxonomyVersion", "language", "caseType") "semantic.scope"
  if ($SemanticCases.scope.dataset -ne "036a-local-demo-synthetic") {
    Add-ValidationError "semantic.scope.dataset is invalid"
  }
  if ($SemanticCases.scope.taxonomyVersion -ne 2) {
    Add-ValidationError "semantic.scope.taxonomyVersion must be 2"
  }
  if ($SemanticCases.scope.language -ne "en") {
    Add-ValidationError "semantic.scope.language must be en"
  }
  if ($SemanticCases.scope.caseType -ne "BUSINESS_SEMANTIC") {
    Add-ValidationError "semantic.scope.caseType is invalid"
  }
  Test-StringArrayContains $SemanticCases.guardrails @("SYNTHETIC_ONLY", "NO_RAW_AMOUNTS", "NO_TENANT_OR_CLIENT_IDS", "NO_PRIOR_AFFECTATION_TARGET_IN_INPUT", "NO_PROVIDER_FREE_TEXT", "ABSTENTION_HAS_NO_TARGET", "ABSTENTION_HAS_NO_CONFIDENCE") "semantic.guardrails"
  Test-CoverageGaps $SemanticCases.coverageGaps "semantic"

  if (-not (Test-JsonArray $SemanticCases.cases)) {
    Add-ValidationError "semantic.cases must be an array"
    return
  }
  if ($SemanticCases.cases.Count -ne $ExpectedSemanticResults.Count) {
    Add-ValidationError "semantic.cases expected $($ExpectedSemanticResults.Count) cases, got $($SemanticCases.cases.Count)"
  }

  $seenIds = New-Object "System.Collections.Generic.HashSet[string]"
  $seenCodes = New-Object "System.Collections.Generic.HashSet[string]"
  foreach ($case in $SemanticCases.cases) {
    Test-RequiredProperties $case @("id", "category", "input", "expected", "evidence", "tags") @("id", "category", "input", "expected", "evidence", "tags") "semantic.cases[$($case.id)]"
    Test-NonEmptyString $case.id "semantic.cases.id"
    if (-not $seenIds.Add($case.id)) {
      Add-ValidationError "duplicate semantic case id '$($case.id)'"
    }
    if ($case.category -ne "BUSINESS_SEMANTIC") {
      Add-ValidationError "semantic case '$($case.id)' category must be BUSINESS_SEMANTIC"
    }

    Test-RequiredProperties $case.input @("accountCode", "accountLabel", "balanceSignal", "currentAffectationStatus") @("accountCode", "accountLabel", "balanceSignal", "currentAffectationStatus") "semantic.cases[$($case.id)].input"
    Test-NonEmptyString $case.input.accountCode "semantic.cases[$($case.id)].input.accountCode"
    Test-NonEmptyString $case.input.accountLabel "semantic.cases[$($case.id)].input.accountLabel"
    if (-not $case.input.accountLabel.StartsWith("Synthetic ")) {
      Add-ValidationError "semantic case '$($case.id)' accountLabel must remain synthetic"
    }
    if ($AllowedBalanceSignals -notcontains $case.input.balanceSignal) {
      Add-ValidationError "semantic case '$($case.id)' balanceSignal is invalid"
    }
    if ($case.input.currentAffectationStatus -ne "NONE") {
      Add-ValidationError "semantic case '$($case.id)' currentAffectationStatus must be NONE"
    }
    if (-not $seenCodes.Add($case.input.accountCode)) {
      Add-ValidationError "duplicate semantic accountCode '$($case.input.accountCode)'"
    }

    Test-RequiredProperties $case.expected @("outcome", "suggestedTargetCode", "reasonCode", "explanationCode", "evidenceConstraints") @("outcome", "explanationCode", "evidenceConstraints") "semantic.cases[$($case.id)].expected"
    Test-RequiredProperties $case.expected.evidenceConstraints @("minItems", "requiredTypes") @("minItems", "requiredTypes") "semantic.cases[$($case.id)].expected.evidenceConstraints"
    if ($case.expected.outcome -notin @("SUGGESTION", "ABSTENTION")) {
      Add-ValidationError "semantic case '$($case.id)' expected.outcome is invalid"
    }

    if ($case.expected.outcome -eq "SUGGESTION") {
      Test-NonEmptyString $case.expected.suggestedTargetCode "semantic.cases[$($case.id)].expected.suggestedTargetCode"
      if ($case.expected.PSObject.Properties.Name -contains "reasonCode") {
        Add-ValidationError "semantic suggestion '$($case.id)' must not contain reasonCode"
      }
      Test-TargetIsCandidateLeaf $case.expected.suggestedTargetCode $Targets "semantic.cases[$($case.id)].expected.suggestedTargetCode"
    }

    if ($case.expected.outcome -eq "ABSTENTION") {
      if ($case.expected.PSObject.Properties.Name -contains "suggestedTargetCode") {
        Add-ValidationError "semantic abstention '$($case.id)' must not contain suggestedTargetCode"
      }
      if ($case.expected.PSObject.Properties.Name -contains "confidence") {
        Add-ValidationError "semantic abstention '$($case.id)' must not contain confidence"
      }
      if ($AllowedAbstentionReasonCodes -notcontains $case.expected.reasonCode) {
        Add-ValidationError "semantic abstention '$($case.id)' reasonCode is invalid"
      }
      if ($ForbiddenArtificialReasonCodes -contains $case.expected.reasonCode) {
        Add-ValidationError "semantic abstention '$($case.id)' must not use artificial reasonCode '$($case.expected.reasonCode)'"
      }
    }

    Test-Evidence $case.evidence $case.expected "semantic.cases[$($case.id)]"
    Test-StringArrayContains $case.tags @("semantic") "semantic.cases[$($case.id)].tags"
  }

  foreach ($expected in $ExpectedSemanticResults) {
    $matches = @($SemanticCases.cases | Where-Object { $_.input.accountCode -eq $expected.accountCode -and $_.input.accountLabel -eq $expected.accountLabel })
    if ($matches.Count -ne 1) {
      Add-ValidationError "semantic expected case '$($expected.accountCode) / $($expected.accountLabel)' must appear exactly once"
      continue
    }

    $actual = $matches[0]
    if ($actual.expected.outcome -ne $expected.outcome) {
      Add-ValidationError "semantic case '$($actual.id)' expected outcome '$($expected.outcome)', got '$($actual.expected.outcome)'"
    }
    if ($expected.outcome -eq "SUGGESTION" -and $actual.expected.suggestedTargetCode -ne $expected.suggestedTargetCode) {
      Add-ValidationError "semantic case '$($actual.id)' expected target '$($expected.suggestedTargetCode)', got '$($actual.expected.suggestedTargetCode)'"
    }
    if ($expected.outcome -eq "ABSTENTION" -and $actual.expected.reasonCode -ne $expected.reasonCode) {
      Add-ValidationError "semantic case '$($actual.id)' expected reasonCode '$($expected.reasonCode)', got '$($actual.expected.reasonCode)'"
    }
  }
}

function Test-PolicyCases {
  param([object]$PolicyFaultCases, [hashtable]$Targets)

  if ($null -eq $PolicyFaultCases) {
    return
  }

  Test-RequiredProperties $PolicyFaultCases @("schemaVersion", "status", "sourceArtifacts", "scope", "classificationRules", "guardrails", "policyCases", "invalidOutputCases", "coverageGaps") @("schemaVersion", "status", "sourceArtifacts", "scope", "classificationRules", "guardrails", "policyCases", "invalidOutputCases", "coverageGaps") "policyFault"
  if ($PolicyFaultCases.schemaVersion -ne "042a2-candidate-policy-fault-cases-v1") {
    Add-ValidationError "policyFault.schemaVersion is invalid"
  }
  Test-CandidateStatus $PolicyFaultCases.status "policyFault.status"
  Test-SourceArtifacts $PolicyFaultCases "policyFault"
  Test-RequiredProperties $PolicyFaultCases.classificationRules @("policyMetricBucket", "preconditionMetricBucket", "invalidOutputMetricBucket", "invalidOutputExpectedOutcome", "invalidOutputForbiddenReasonCode") @("policyMetricBucket", "preconditionMetricBucket", "invalidOutputMetricBucket", "invalidOutputExpectedOutcome", "invalidOutputForbiddenReasonCode") "policyFault.classificationRules"
  if ($PolicyFaultCases.classificationRules.policyMetricBucket -ne "EXCLUDED_FROM_BUSINESS_ABSTENTION") {
    Add-ValidationError "policyFault.classificationRules.policyMetricBucket is invalid"
  }
  if ($PolicyFaultCases.classificationRules.preconditionMetricBucket -ne "EXCLUDED_FROM_BUSINESS_ABSTENTION") {
    Add-ValidationError "policyFault.classificationRules.preconditionMetricBucket is invalid"
  }
  if ($PolicyFaultCases.classificationRules.invalidOutputMetricBucket -ne "TECHNICAL_INVALID_OUTPUT") {
    Add-ValidationError "policyFault.classificationRules.invalidOutputMetricBucket is invalid"
  }
  if ($PolicyFaultCases.classificationRules.invalidOutputExpectedOutcome -ne "INVALID_MODEL_OUTPUT") {
    Add-ValidationError "policyFault.classificationRules.invalidOutputExpectedOutcome is invalid"
  }
  if ($PolicyFaultCases.classificationRules.invalidOutputForbiddenReasonCode -ne "TAXONOMY_GAP") {
    Add-ValidationError "policyFault.classificationRules.invalidOutputForbiddenReasonCode must be TAXONOMY_GAP"
  }
  Test-StringArrayContains $PolicyFaultCases.guardrails @("SYNTHETIC_ONLY", "NO_RAW_AMOUNTS", "NO_TENANT_OR_CLIENT_IDS", "NO_PRIOR_AFFECTATION_TARGET_IN_INPUT", "NO_PROVIDER_FREE_TEXT", "POLICY_AND_PRECONDITION_ARE_NOT_BUSINESS_ABSTENTIONS", "INVALID_TARGET_OUTPUTS_ARE_NOT_TAXONOMY_GAPS") "policyFault.guardrails"
  Test-CoverageGaps $PolicyFaultCases.coverageGaps "policyFault"

  if (-not (Test-JsonArray $PolicyFaultCases.policyCases)) {
    Add-ValidationError "policyFault.policyCases must be an array"
  } else {
    $triggers = @($PolicyFaultCases.policyCases | ForEach-Object { $_.trigger })
    Test-ContainsExactly $triggers $ExpectedPolicyTriggers "policyFault.policyCases.trigger"

    foreach ($case in $PolicyFaultCases.policyCases) {
      Test-RequiredProperties $case @("id", "category", "trigger", "input", "expected", "tags") @("id", "category", "trigger", "input", "expected", "tags") "policyFault.policyCases[$($case.id)]"
      if ($case.category -ne "POLICY_OR_PRECONDITION") {
        Add-ValidationError "policy case '$($case.id)' category must be POLICY_OR_PRECONDITION"
      }
      Test-RequiredProperties $case.input @("datasetPolicy", "requestSynthetic", "crossTenantSignal", "provenanceStatus", "language", "accountCode", "accountLabel", "balanceSignal", "currentAffectationStatus") @("datasetPolicy", "accountCode", "accountLabel", "balanceSignal") "policyFault.policyCases[$($case.id)].input"
      if (-not $case.input.accountLabel.StartsWith("Synthetic ")) {
        Add-ValidationError "policy case '$($case.id)' accountLabel must remain synthetic"
      }
      if ($AllowedBalanceSignals -notcontains $case.input.balanceSignal) {
        Add-ValidationError "policy case '$($case.id)' balanceSignal is invalid"
      }

      Test-RequiredProperties $case.expected @("outcome", "blockCode", "providerCallExpected", "businessAbstentionCounted") @("outcome", "blockCode", "providerCallExpected", "businessAbstentionCounted") "policyFault.policyCases[$($case.id)].expected"
      if ($case.trigger -eq "ACCOUNT_ALREADY_AFFECTED") {
        if ($case.expected.outcome -ne "PRECONDITION_BLOCK") {
          Add-ValidationError "already affected case must use PRECONDITION_BLOCK"
        }
        if ($case.input.currentAffectationStatus -ne "PRESENT_WITHOUT_TARGET") {
          Add-ValidationError "already affected case must not expose a prior target"
        }
      } elseif ($case.expected.outcome -ne "POLICY_BLOCK") {
        Add-ValidationError "policy case '$($case.id)' must use POLICY_BLOCK"
      }
      if ($case.expected.blockCode -ne $case.trigger) {
        Add-ValidationError "policy case '$($case.id)' blockCode must equal trigger"
      }
      if ($case.expected.providerCallExpected -ne $false) {
        Add-ValidationError "policy case '$($case.id)' must expect zero provider call"
      }
      if ($case.expected.businessAbstentionCounted -ne $false) {
        Add-ValidationError "policy case '$($case.id)' must not count as business abstention"
      }
      if ($case.expected.outcome -eq "ABSTENTION") {
        Add-ValidationError "policy case '$($case.id)' must not be ABSTENTION"
      }
    }
  }

  if (-not (Test-JsonArray $PolicyFaultCases.invalidOutputCases)) {
    Add-ValidationError "policyFault.invalidOutputCases must be an array"
    return
  }

  $invalidReasons = @($PolicyFaultCases.invalidOutputCases | ForEach-Object { $_.expected.invalidReason } | Sort-Object -Unique)
  Test-ContainsExactly $invalidReasons $ExpectedInvalidReasons "policyFault.invalidOutputCases.expected.invalidReason"

  $hasSection = $false
  $hasRoot = $false
  foreach ($case in $PolicyFaultCases.invalidOutputCases) {
    Test-RequiredProperties $case @("id", "category", "simulatedStructuredOutput", "expected", "tags") @("id", "category", "simulatedStructuredOutput", "expected", "tags") "policyFault.invalidOutputCases[$($case.id)]"
    if ($case.category -ne "TECHNICAL_INVALID_OUTPUT") {
      Add-ValidationError "invalid output case '$($case.id)' category must be TECHNICAL_INVALID_OUTPUT"
    }

    Test-RequiredProperties $case.simulatedStructuredOutput @("outcome", "accountCode", "suggestedTargetCode") @("outcome", "accountCode", "suggestedTargetCode") "policyFault.invalidOutputCases[$($case.id)].simulatedStructuredOutput"
    if ($case.simulatedStructuredOutput.outcome -ne "SUGGESTION") {
      Add-ValidationError "invalid output case '$($case.id)' simulated output must be a structured SUGGESTION"
    }
    Test-NonEmptyString $case.simulatedStructuredOutput.suggestedTargetCode "policyFault.invalidOutputCases[$($case.id)].simulatedStructuredOutput.suggestedTargetCode"

    Test-RequiredProperties $case.expected @("outcome", "invalidReason", "mustNotBeReasonCode", "businessAbstentionCounted") @("outcome", "invalidReason", "mustNotBeReasonCode", "businessAbstentionCounted") "policyFault.invalidOutputCases[$($case.id)].expected"
    if ($case.expected.outcome -ne "INVALID_MODEL_OUTPUT") {
      Add-ValidationError "invalid output case '$($case.id)' must resolve to INVALID_MODEL_OUTPUT"
    }
    if ($case.expected.mustNotBeReasonCode -ne "TAXONOMY_GAP") {
      Add-ValidationError "invalid output case '$($case.id)' must explicitly forbid TAXONOMY_GAP"
    }
    if ($case.expected.businessAbstentionCounted -ne $false) {
      Add-ValidationError "invalid output case '$($case.id)' must not count as business abstention"
    }
    if ($case.expected.PSObject.Properties.Name -contains "reasonCode") {
      Add-ValidationError "invalid output case '$($case.id)' must not contain reasonCode"
    }

    $targetCode = $case.simulatedStructuredOutput.suggestedTargetCode
    if ($case.expected.invalidReason -eq "TARGET_UNKNOWN") {
      if ($Targets.ContainsKey($targetCode)) {
        Add-ValidationError "TARGET_UNKNOWN case '$($case.id)' unexpectedly points to a known target"
      }
      continue
    }

    if (-not $Targets.ContainsKey($targetCode)) {
      Add-ValidationError "invalid output case '$($case.id)' target '$targetCode' must exist for reason '$($case.expected.invalidReason)'"
      continue
    }

    $target = $Targets[$targetCode]
    if ($case.expected.invalidReason -eq "TARGET_DEPRECATED" -and $target.deprecated -ne $true) {
      Add-ValidationError "TARGET_DEPRECATED case '$($case.id)' must point to deprecated=true"
    }
    if ($case.expected.invalidReason -eq "TARGET_NOT_SELECTABLE" -and $target.selectable -ne $false) {
      Add-ValidationError "TARGET_NOT_SELECTABLE case '$($case.id)' must point to selectable=false"
    }
    if ($case.expected.invalidReason -eq "SECTION_OR_ROOT_PROPOSED") {
      if ($target.pilotRole -notin @("SECTION", "ROOT")) {
        Add-ValidationError "SECTION_OR_ROOT_PROPOSED case '$($case.id)' must point to SECTION or ROOT"
      }
      if ($target.pilotRole -eq "SECTION") {
        $hasSection = $true
      }
      if ($target.pilotRole -eq "ROOT") {
        $hasRoot = $true
      }
    }
  }

  if (-not $hasSection) {
    Add-ValidationError "invalid output cases must include a section proposal"
  }
  if (-not $hasRoot) {
    Add-ValidationError "invalid output cases must include a root proposal"
  }
}

foreach ($path in @($SemanticCasesPath, $PolicyFaultCasesPath, $SnapshotPath, $DemoInputPath)) {
  Test-NoBomAndLfOnly $path
}

Write-Host "042a2 candidate case validation"
Write-Host "Semantic cases artifact: $SemanticCasesPath"
Write-Host "Policy/fault cases artifact: $PolicyFaultCasesPath"
Write-Host "Taxonomy snapshot artifact: $SnapshotPath"
Write-Host "Demo input artifact: $DemoInputPath"

Test-Hash $SnapshotPath $ExpectedSnapshotHash "taxonomy-snapshot-candidate-v1.json"
Test-Hash $DemoInputPath $ExpectedDemoInputHash "demo-input-unmapped-v1.json"
Test-Hash $SemanticCasesPath $ExpectedSemanticCasesHash "candidate-semantic-cases-v1.json"
Test-Hash $PolicyFaultCasesPath $ExpectedPolicyFaultCasesHash "candidate-policy-fault-cases-v1.json"

$snapshot = Read-JsonFile $SnapshotPath
$semanticCases = Read-JsonFile $SemanticCasesPath
$policyFaultCases = Read-JsonFile $PolicyFaultCasesPath
$targets = Get-TargetMapFromSnapshot $snapshot

if ($null -ne $semanticCases) {
  Test-NoNullProperties $semanticCases "semantic"
  Test-ForbiddenPropertiesAndValues $semanticCases "semantic"
}
if ($null -ne $policyFaultCases) {
  Test-NoNullProperties $policyFaultCases "policyFault"
  Test-ForbiddenPropertiesAndValues $policyFaultCases "policyFault"
}

Test-SemanticCases $semanticCases $targets
Test-PolicyCases $policyFaultCases $targets

if ($script:Errors.Count -gt 0) {
  Write-Host ""
  foreach ($validationError in $script:Errors) {
    Write-Host "[FAIL] $validationError"
  }
  exit 1
}

Write-Host "Semantic cases: $($semanticCases.cases.Count)"
Write-Host "Policy/precondition cases: $($policyFaultCases.policyCases.Count)"
Write-Host "Invalid output cases: $($policyFaultCases.invalidOutputCases.Count)"
Write-Host "All checks passed."
exit 0
