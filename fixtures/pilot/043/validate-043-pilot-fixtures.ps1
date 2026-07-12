[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$InvariantCulture = [System.Globalization.CultureInfo]::InvariantCulture
$NumberStyle = [System.Globalization.NumberStyles]::AllowDecimalPoint
$StrictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)

function Fail-Validation {
    param([Parameter(Mandatory = $true)][string]$Message)
    throw "043 fixture validation failed: $Message"
}

function Get-LowerSha256 {
    param([Parameter(Mandatory = $true)][byte[]]$Bytes)

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([System.BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

function Read-CanonicalUtf8LfFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][int]$ExpectedBytes,
        [Parameter(Mandatory = $true)][string]$ExpectedSha256
    )

    if (-not [System.IO.File]::Exists($Path)) {
        Fail-Validation "missing file $([System.IO.Path]::GetFileName($Path))"
    }

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -ne $ExpectedBytes) {
        Fail-Validation "$([System.IO.Path]::GetFileName($Path)) byte length $($bytes.Length), expected $ExpectedBytes"
    }
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        Fail-Validation "$([System.IO.Path]::GetFileName($Path)) contains a UTF-8 BOM"
    }
    if ($bytes -contains [byte]0x0D) {
        Fail-Validation "$([System.IO.Path]::GetFileName($Path)) contains CR/CRLF; LF-only required"
    }
    if ($bytes.Length -eq 0 -or $bytes[$bytes.Length - 1] -ne 0x0A) {
        Fail-Validation "$([System.IO.Path]::GetFileName($Path)) has no terminal LF"
    }

    try {
        $text = $StrictUtf8.GetString($bytes)
    } catch {
        Fail-Validation "$([System.IO.Path]::GetFileName($Path)) is not strict UTF-8"
    }

    $actualSha256 = Get-LowerSha256 -Bytes $bytes
    if ($actualSha256 -ne $ExpectedSha256) {
        Fail-Validation "$([System.IO.Path]::GetFileName($Path)) SHA-256 $actualSha256, expected $ExpectedSha256"
    }

    return [pscustomobject]@{
        Bytes = $bytes
        Text = $text
        Sha256 = $actualSha256
    }
}

$balancePath = Join-Path $PSScriptRoot 'balance-fy2025-v1.csv'
$evidencePath = Join-Path $PSScriptRoot 'evidence-bank-reconciliation-fy2025-v1.csv'
$templatePath = Join-Path $PSScriptRoot 'observation-template-v1.md'
$readmePath = Join-Path $PSScriptRoot 'README.md'
$ExpectedObservationTemplateBytes = 1221
$ExpectedObservationTemplateSha256 = 'c67c99fde0816cb1b25b56f34babfa5907c2189746f579fdec87c67fd8cb862e'

$balance = Read-CanonicalUtf8LfFile `
    -Path $balancePath `
    -ExpectedBytes 359 `
    -ExpectedSha256 '2295b620704c2cfcdf1e37660388bd84a1d261c0b7697edf5bce21d0c04f9855'

$balanceLines = $balance.Text.Split("`n", [System.StringSplitOptions]::None)
if ($balanceLines[0] -ne 'accountCode,accountLabel,debit,credit') {
    Fail-Validation 'balance header differs'
}
$balanceRows = @($balance.Text | ConvertFrom-Csv)
if ($balanceRows.Count -ne 7) {
    Fail-Validation "balance data row count $($balanceRows.Count), expected 7"
}

[decimal]$debitTotal = 0
[decimal]$creditTotal = 0
foreach ($row in $balanceRows) {
    if ([string]::IsNullOrWhiteSpace([string]$row.accountCode) -or -not ([string]$row.accountLabel).StartsWith('Synthetic ', [System.StringComparison]::Ordinal)) {
        Fail-Validation 'balance contains a non-synthetic or incomplete row'
    }
    try {
        $debitTotal += [decimal]::Parse([string]$row.debit, $NumberStyle, $InvariantCulture)
        $creditTotal += [decimal]::Parse([string]$row.credit, $NumberStyle, $InvariantCulture)
    } catch {
        Fail-Validation "balance amount parsing failed for account $($row.accountCode)"
    }
}
if ($debitTotal -ne [decimal]149000.00 -or $creditTotal -ne [decimal]149000.00) {
    Fail-Validation "balance totals are debit=$debitTotal credit=$creditTotal"
}
if (@($balanceRows | Where-Object { $_.accountCode -eq '1200' }).Count -ne 1) {
    Fail-Validation 'account 1200 must appear exactly once'
}

$evidence = Read-CanonicalUtf8LfFile `
    -Path $evidencePath `
    -ExpectedBytes 184 `
    -ExpectedSha256 'f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27'

$evidenceLines = $evidence.Text.Split("`n", [System.StringSplitOptions]::None)
if ($evidenceLines[0] -ne 'evidenceType,periodEnd,accountCode,bookBalance,statementBalance,difference,provenance') {
    Fail-Validation 'evidence header differs'
}
$evidenceRows = @($evidence.Text | ConvertFrom-Csv)
if ($evidenceRows.Count -ne 1) {
    Fail-Validation "evidence data row count $($evidenceRows.Count), expected 1"
}
$evidenceRow = $evidenceRows[0]
if ($evidenceRow.evidenceType -ne 'SYNTHETIC_BANK_RECONCILIATION' -or $evidenceRow.provenance -ne 'RITOMER_INTERNAL_SYNTHETIC') {
    Fail-Validation 'evidence type or provenance differs'
}
if ($evidenceRow.difference -ne '0.00') {
    Fail-Validation "evidence difference $($evidenceRow.difference), expected 0.00"
}

$template = Read-CanonicalUtf8LfFile `
    -Path $templatePath `
    -ExpectedBytes $ExpectedObservationTemplateBytes `
    -ExpectedSha256 $ExpectedObservationTemplateSha256
$templateText = $template.Text
$blankFields = @(
    'runId', 'taskId', 'actorRole', 'startedAtUtc', 'endedAtUtc', 'result',
    'productiveSeconds', 'incidentSeconds', 'excludedSeconds', 'interventions',
    'blockers', 'workarounds', 'corrections', 'comprehension', 'handoff', 'utility', 'irritants'
)
foreach ($field in $blankFields) {
    $expectedBlankLine = '- `' + $field + '`:'
    if (-not (($templateText -split "`n") -contains $expectedBlankLine)) {
        Fail-Validation "observation field $field is missing or prefilled"
    }
}
$templateForbiddenPattern = '(?i)http' + 's?' + ':' + '//' + '|file' + ':' + '//' + '|[A-Za-z]' + ':' + '\\' + '|@[A-Za-z0-9.-]+'
if ($templateText -match $templateForbiddenPattern) {
    Fail-Validation 'observation template contains a URL, local path or e-mail-shaped value'
}

if (-not [System.IO.File]::Exists($readmePath)) {
    Fail-Validation 'fixture README missing'
}
$readmeText = [System.IO.File]::ReadAllText($readmePath, $StrictUtf8)
foreach ($requiredText in @('INTERNAL_ONLY', 'created de novo by Ritomer', 'MIME: `text/csv`', 'must never be overwritten')) {
    if (-not $readmeText.Contains($requiredText)) {
        Fail-Validation "fixture README missing governance marker $requiredText"
    }
}

Write-Output 'fixture_validation_result=PASS'
Write-Output 'fixture_classification=INTERNAL_ONLY'
Write-Output "balance_bytes=$($balance.Bytes.Length)"
Write-Output "balance_sha256=$($balance.Sha256)"
Write-Output "balance_rows=$($balanceRows.Count)"
Write-Output ('balance_debit_total=' + $debitTotal.ToString('0.00', $InvariantCulture))
Write-Output ('balance_credit_total=' + $creditTotal.ToString('0.00', $InvariantCulture))
Write-Output 'balance_account_1200_present=YES'
Write-Output "evidence_bytes=$($evidence.Bytes.Length)"
Write-Output "evidence_sha256=$($evidence.Sha256)"
Write-Output 'evidence_mime=text/csv'
Write-Output 'evidence_difference=0.00'
Write-Output 'evidence_provenance=RITOMER_INTERNAL_SYNTHETIC'
Write-Output "observation_template_bytes=$($template.Bytes.Length)"
Write-Output "observation_template_sha256=$($template.Sha256)"
Write-Output 'observation_template_blank=YES'
Write-Output 'real_or_personal_data_present=NO'
