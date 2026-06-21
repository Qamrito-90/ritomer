[CmdletBinding()]
param(
  [string]$SemanticCasesPath = (Join-Path $PSScriptRoot "fixtures\042a2\candidate-semantic-cases-v1.json"),
  [string]$PolicyFaultCasesPath = (Join-Path $PSScriptRoot "fixtures\042a2\candidate-policy-fault-cases-v1.json"),
  [string]$SnapshotPath = (Join-Path $PSScriptRoot "fixtures\042a2\taxonomy-snapshot-candidate-v1.json"),
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "reviews\042a2")
)

$ErrorActionPreference = "Stop"

$ReviewStatus = @("BLIND_REVIEW_INPUT", "PENDING_INDEPENDENT_REVIEW", "NOT_GOLDEN", "NOT_AUTHORITATIVE")
$ResponseSchemaPathForPack = "evals/mapping/reviews/042a2/reviewer-response-schema-v1.json"
$DistributionRules = @(
  "Give this reviewer only this blind pack, reviewer-response-schema-v1.json, and answer-free annotation instructions.",
  "Do not give candidate fixtures, source cases, builder internals, validators, or the other reviewer pack during independent review.",
  "Return exactly one response per blindCaseId using reviewer-response-schema-v1.json.",
  "This pack is not a golden set and is not authoritative."
)

function Read-JsonFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "file not found: $Path"
  }

  return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
}

function ConvertTo-StableJson {
  param([object]$Value, [switch]$Compress)

  if ($Compress) {
    return ($Value | ConvertTo-Json -Depth 80 -Compress)
  }

  return ($Value | ConvertTo-Json -Depth 80)
}

function Write-JsonFile {
  param([string]$Path, [object]$Value)

  $json = ConvertTo-StableJson $Value
  $json = $json -replace "`r`n", "`n"
  $json = $json.TrimEnd() + "`n"
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath (Split-Path -Parent $Path)).Path + [System.IO.Path]::DirectorySeparatorChar + (Split-Path -Leaf $Path), $json, $encoding)
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
    throw "file not found for hash: $Path"
  }

  return Get-Sha256HexFromBytes ([System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Path)))
}

function Add-IfPresent {
  param(
    [System.Collections.Specialized.OrderedDictionary]$Target,
    [object]$Source,
    [string]$Name
  )

  if ($null -ne $Source -and $Source.PSObject.Properties.Name -contains $Name) {
    [void]$Target.Add($Name, $Source.$Name)
  }
}

function New-AccountContext {
  param([object]$AccountInput)

  $accountContext = [ordered]@{
    accountCode = $AccountInput.accountCode
    accountLabel = $AccountInput.accountLabel
    balanceSignal = $AccountInput.balanceSignal
  }

  Add-IfPresent $accountContext $AccountInput "currentAffectationStatus"
  return $accountContext
}

function New-ReviewInputHash {
  param([object]$ReviewInput)

  $canonical = [ordered]@{
    schemaVersion = "042a2-blind-review-internal-review-input-hash-v1"
    reviewInput = $ReviewInput
  }
  return Get-Sha256HexFromString (ConvertTo-StableJson $canonical -Compress)
}

function New-InternalCase {
  param(
    [string]$SourceKind,
    [string]$SourceCaseId,
    [object]$ReviewInput
  )

  return [pscustomobject]@{
    SourceKind = $SourceKind
    SourceCaseId = $SourceCaseId
    ReviewInput = $ReviewInput
    ReviewInputHash = New-ReviewInputHash $ReviewInput
    BlindCaseId = ""
  }
}

function New-PackCase {
  param([object]$InternalCase)

  return [ordered]@{
    blindCaseId = $InternalCase.BlindCaseId
    reviewInput = $InternalCase.ReviewInput
  }
}

function Get-SeededHash {
  param([string]$Seed, [object]$InternalCase)

  return Get-Sha256HexFromString "$Seed|$($InternalCase.BlindCaseId)|$($InternalCase.ReviewInputHash)"
}

function New-ResponseBranch {
  param(
    [string]$Outcome,
    [string]$CodeRefName,
    [string]$CodePropertyName,
    [string]$ExpectedHumanAction
  )

  $properties = [ordered]@{
    blindCaseId = [ordered]@{ '$ref' = "#/`$defs/blindCaseId" }
    outcome = [ordered]@{ type = "string"; const = $Outcome }
    evidenceState = [ordered]@{ '$ref' = "#/`$defs/evidenceState" }
    criticalFlags = [ordered]@{ '$ref' = "#/`$defs/criticalFlags" }
    expectedHumanAction = [ordered]@{ type = "string"; const = $ExpectedHumanAction }
  }
  [void]$properties.Add($CodePropertyName, [ordered]@{ '$ref' = "#/`$defs/$CodeRefName" })

  return [ordered]@{
    type = "object"
    additionalProperties = $false
    required = @("blindCaseId", "outcome", $CodePropertyName, "evidenceState", "criticalFlags", "expectedHumanAction")
    properties = $properties
  }
}

function New-ResponseSchema {
  param([string[]]$TargetCodes)

  $suggestionBranch = New-ResponseBranch "SUGGESTION" "targetCode" "targetCode" "REVIEW_TARGET"
  $abstentionBranch = New-ResponseBranch "ABSTENTION" "abstentionReasonCode" "reasonCode" "REVIEW_ABSTENTION_REASON"
  $policyBranch = New-ResponseBranch "POLICY_BLOCK" "policyReasonCode" "reasonCode" "ROUTE_TO_GOVERNANCE"
  $preconditionBranch = New-ResponseBranch "PRECONDITION_BLOCK" "preconditionReasonCode" "reasonCode" "CHECK_PRECONDITION"
  $invalidBranch = New-ResponseBranch "INVALID_MODEL_OUTPUT" "invalidOutputReasonCode" "reasonCode" "ROUTE_TO_TECHNICAL_REVIEW"

  $nonNoneCriticalFlags = @(
    "ACTIVE_PASSIVE_BOUNDARY",
    "BALANCE_SHEET_INCOME_STATEMENT_BOUNDARY",
    "REVENUE_EXPENSE_BOUNDARY",
    "CONTRA_ACCOUNT",
    "TARGET_VALIDITY",
    "TAXONOMY_GAP",
    "POLICY_INCIDENT",
    "TECHNICAL_INCIDENT"
  )

  return [ordered]@{
    '$schema' = "https://json-schema.org/draft/2020-12/schema"
    '$id' = "https://ritomer.local/evals/mapping/reviews/042a2/reviewer-response-schema-v1.json"
    title = "042a2 blind review response schema v1"
    type = "object"
    additionalProperties = $false
    required = @("schemaVersion", "status", "reviewerId", "responses")
    properties = [ordered]@{
      schemaVersion = [ordered]@{ type = "string"; const = "042a2-blind-review-response-v1" }
      status = [ordered]@{
        type = "array"
        minItems = 1
        maxItems = 1
        items = [ordered]@{ type = "string"; const = "DRAFT_HUMAN_REVIEW" }
      }
      reviewerId = [ordered]@{ type = "string"; pattern = "^reviewer-[a-z0-9-]{1,40}$" }
      responses = [ordered]@{
        type = "array"
        minItems = 17
        maxItems = 17
        items = [ordered]@{ '$ref' = "#/`$defs/reviewResponse" }
      }
    }
    '$defs' = [ordered]@{
      blindCaseId = [ordered]@{ type = "string"; pattern = "^BR-(00[1-9]|01[0-7])$" }
      targetCode = [ordered]@{
        type = "string"
        enum = $TargetCodes
      }
      abstentionReasonCode = [ordered]@{
        type = "string"
        enum = @("OUT_OF_SCOPE", "CONFLICTING_SIGNALS", "INSUFFICIENT_EVIDENCE", "TAXONOMY_GAP", "AMBIGUOUS_TARGET")
      }
      policyReasonCode = [ordered]@{
        type = "string"
        enum = @("NON_SYNTHETIC_REQUEST", "CROSS_TENANT_REQUEST", "OUTSIDE_ALLOWLIST_OR_PROVENANCE", "LANGUAGE_OUT_OF_COHORT", "GATE_INVALID", "PRIVACY_OR_TENANT_BOUNDARY")
      }
      preconditionReasonCode = [ordered]@{
        type = "string"
        enum = @("ACCOUNT_ALREADY_AFFECTED", "ACCOUNT_NOT_IN_LATEST_IMPORT", "STALE_IMPORT", "NOT_ELIGIBLE")
      }
      invalidOutputReasonCode = [ordered]@{
        type = "string"
        enum = @("TARGET_UNKNOWN", "TARGET_DEPRECATED", "TARGET_NOT_SELECTABLE", "SECTION_OR_ROOT_PROPOSED", "MALFORMED_OUTPUT", "SCHEMA_INVALID", "CONTEXTUALLY_INADMISSIBLE_TARGET")
      }
      evidenceState = [ordered]@{
        type = "string"
        enum = @("SUFFICIENT", "INSUFFICIENT", "MISSING", "CONFLICTING", "STALE_PRECONDITION", "POLICY_BLOCKED", "TECHNICAL_INVALID")
      }
      criticalFlags = [ordered]@{
        oneOf = @(
          [ordered]@{
            type = "array"
            minItems = 1
            maxItems = 1
            uniqueItems = $true
            items = [ordered]@{ type = "string"; const = "NONE" }
          },
          [ordered]@{
            type = "array"
            minItems = 1
            uniqueItems = $true
            items = [ordered]@{
              type = "string"
              enum = $nonNoneCriticalFlags
            }
          }
        )
      }
      expectedHumanAction = [ordered]@{
        type = "string"
        enum = @("REVIEW_TARGET", "REVIEW_ABSTENTION_REASON", "ROUTE_TO_GOVERNANCE", "CHECK_PRECONDITION", "ROUTE_TO_TECHNICAL_REVIEW")
      }
      reviewResponse = [ordered]@{
        oneOf = @($suggestionBranch, $abstentionBranch, $policyBranch, $preconditionBranch, $invalidBranch)
      }
    }
  }
}

function New-TargetCatalog {
  param([object]$Snapshot)

  $targets = @(
    $Snapshot.entries |
      Where-Object { $_.pilotRole -eq "CANDIDATE_LEAF" -and $_.selectable -eq $true -and $_.deprecated -eq $false } |
      Sort-Object displayOrder |
      ForEach-Object {
        [ordered]@{
          code = $_.code
          label = $_.label
          statement = $_.statement
          normalSide = $_.normalSide
        }
      }
  )

  return [ordered]@{
    schemaVersion = "042a2-blind-review-target-catalog-v1"
    targets = $targets
  }
}

function New-Pack {
  param(
    [string]$ReviewerId,
    [object[]]$Cases,
    [object]$TargetCatalog
  )

  return [ordered]@{
    schemaVersion = "042a2-blind-review-pack-v1"
    reviewerId = $ReviewerId
    status = $ReviewStatus
    responseSchemaPath = $ResponseSchemaPathForPack
    distributionRules = $DistributionRules
    blindReviewRules = @(
      "Independent human review only.",
      "Use only blindCaseId and reviewInput for case review.",
      "Return responses using reviewer-response-schema-v1.json.",
      "This pack is not a golden set and is not authoritative."
    )
    targetCatalog = $TargetCatalog
    cases = $Cases
  }
}

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
  [void](New-Item -ItemType Directory -Force -Path $OutputDirectory)
}

$semanticCases = Read-JsonFile $SemanticCasesPath
$policyFaultCases = Read-JsonFile $PolicyFaultCasesPath
$snapshot = Read-JsonFile $SnapshotPath

$accountLookup = @{}
foreach ($case in $semanticCases.cases) {
  $accountLookup[$case.input.accountCode] = $case.input
}
foreach ($case in $policyFaultCases.policyCases) {
  if (-not $accountLookup.ContainsKey($case.input.accountCode)) {
    $accountLookup[$case.input.accountCode] = $case.input
  }
}

$internalCases = New-Object System.Collections.Generic.List[object]

foreach ($case in $semanticCases.cases) {
  $reviewInput = [ordered]@{
    accountContext = New-AccountContext $case.input
  }
  $internalCases.Add((New-InternalCase "semantic" $case.id $reviewInput))
}

foreach ($case in $policyFaultCases.policyCases) {
  $requestContext = [ordered]@{}
  foreach ($name in @("datasetPolicy", "requestSynthetic", "crossTenantSignal", "provenanceStatus", "language")) {
    Add-IfPresent $requestContext $case.input $name
  }

  $reviewInput = [ordered]@{
    accountContext = New-AccountContext $case.input
    requestContext = $requestContext
  }
  $internalCases.Add((New-InternalCase "policy_or_precondition" $case.id $reviewInput))
}

foreach ($case in $policyFaultCases.invalidOutputCases) {
  $accountCode = $case.simulatedStructuredOutput.accountCode
  $reviewInput = [ordered]@{}
  if ($accountLookup.ContainsKey($accountCode)) {
    [void]$reviewInput.Add("accountContext", (New-AccountContext $accountLookup[$accountCode]))
  }
  [void]$reviewInput.Add("structuredOutputUnderReview", [ordered]@{
    declaredResultType = "PROPOSED_AFFECTATION"
    accountCode = $case.simulatedStructuredOutput.accountCode
    proposedCode = $case.simulatedStructuredOutput.suggestedTargetCode
  })
  $internalCases.Add((New-InternalCase "invalid_output" $case.id $reviewInput))
}

if ($internalCases.Count -ne 17) {
  throw "expected 17 blind review cases, got $($internalCases.Count)"
}

$blindIdOrdered = @($internalCases | Sort-Object { Get-Sha256HexFromString "blind-id-042a2-v2|$($_.ReviewInputHash)" })
for ($i = 0; $i -lt $blindIdOrdered.Count; $i++) {
  $blindIdOrdered[$i].BlindCaseId = "BR-{0:D3}" -f ($i + 1)
}

$reviewerAInternalCases = @($internalCases | Sort-Object { Get-SeededHash "reviewer-a-order-042a2-v1" $_ })
$reviewerBInternalCases = @($internalCases | Sort-Object { Get-SeededHash "reviewer-b-order-042a2-v1" $_ })

$targetCatalog = New-TargetCatalog $snapshot
$targetCodes = @($targetCatalog.targets | ForEach-Object { $_.code })
$reviewerAPack = New-Pack "reviewer-a" @($reviewerAInternalCases | ForEach-Object { New-PackCase $_ }) $targetCatalog
$reviewerBPack = New-Pack "reviewer-b" @($reviewerBInternalCases | ForEach-Object { New-PackCase $_ }) $targetCatalog
$responseSchema = New-ResponseSchema $targetCodes

$reviewerAPath = Join-Path $OutputDirectory "reviewer-a-blind-v1.json"
$reviewerBPath = Join-Path $OutputDirectory "reviewer-b-blind-v1.json"
$responseSchemaPath = Join-Path $OutputDirectory "reviewer-response-schema-v1.json"

Write-JsonFile $reviewerAPath $reviewerAPack
Write-JsonFile $reviewerBPath $reviewerBPack
Write-JsonFile $responseSchemaPath $responseSchema

Write-Host "042a2 blind review pack generated"
Write-Host "Reviewer A: $reviewerAPath"
Write-Host "Reviewer B: $reviewerBPath"
Write-Host "Response schema: $responseSchemaPath"
Write-Host "reviewer-a-blind-v1.json SHA-256: $(Get-Sha256Hex $reviewerAPath)"
Write-Host "reviewer-b-blind-v1.json SHA-256: $(Get-Sha256Hex $reviewerBPath)"
Write-Host "reviewer-response-schema-v1.json SHA-256: $(Get-Sha256Hex $responseSchemaPath)"
