# Frozen synthetic pilot fixtures - 043

## Classification and purpose

These artifacts are `INTERNAL_ONLY` synthetic fixtures created de novo by Ritomer for the controlled internal rehearsal described by spec `043`.

They contain no customer data, no participant data, no personal identity, no secret and no content copied from a real fiduciary. They are not licensed for public distribution and do not authorize an external pilot.

## Frozen inventory

| File | Bytes | SHA-256 | Invariants |
| --- | ---: | --- | --- |
| `balance-fy2025-v1.csv` | 359 | `2295b620704c2cfcdf1e37660388bd84a1d261c0b7697edf5bce21d0c04f9855` | 7 data rows; debit and credit totals `149000.00`; account `1200` present. |
| `evidence-bank-reconciliation-fy2025-v1.csv` | 184 | `f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27` | One synthetic bank reconciliation; difference `0.00`; provenance `RITOMER_INTERNAL_SYNTHETIC`. |

Canonical bytes for both CSV files are UTF-8 without BOM, LF-only, with one terminal LF.

## Evidence upload metadata

The evidence fixture uses existing upload semantics only:

- MIME: `text/csv`;
- source label: `Ritomer internal synthetic fixture 043`;
- document date: `2025-12-31`;
- provenance: `RITOMER_INTERNAL_SYNTHETIC`.

No MIME, contract, endpoint or runtime change is introduced.

## Freeze and evolution rule

Version `v1` is immutable and must never be overwritten. Any content change requires a new `v2` file, newly documented byte size and SHA-256, a justification and a new CPO review. Replacing a frozen file in place is forbidden.

The hash proves exact-byte identity only. It does not prove authorship, business approval, participant consent or fitness for external use.

## Observation template

`observation-template-v1.md` is deliberately blank. It defines fields for a future authorized internal rehearsal but contains no observation result. Never commit a completed copy, participant identity, quote, screenshot, HAR, token, local path or real data.

## Validation

From the repository root:

```powershell
.\fixtures\pilot\043\validate-043-pilot-fixtures.ps1
```

The validator uses PowerShell and platform libraries only. It verifies exact bytes/hashes, encoding, line endings, balance totals, account `1200`, evidence difference/provenance and the blank template structure.
