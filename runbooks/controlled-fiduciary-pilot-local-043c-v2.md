# 043c v2 - Versioned append-only internal recovery protocol

Status: P0_LOCAL_IMPLEMENTATION / IMPLEMENTED_PENDING_P0_DELIVERY / NOT_EXECUTABLE.

This runbook is the autonomous source for protocolId=043c-internal-rehearsal-v2.
It never imports, dot-sources, calls, selects, or falls back to protocol v1.

Permanent boundaries:

- LOCAL_SYNTHETIC_ONLY=true
- V1_EXECUTION_AUTHORIZED=false
- V2_EXECUTION_AUTHORIZED=false
- R1_AUTHORIZED=false
- R2_AUTHORIZED=false
- EXTERNAL_USE_AUTHORIZED=false
- REAL_DATA_AUTHORIZED=false
- PRODUCTION_AUTHORIZED=false
- DELIVERY_AUTHORIZED and MERGE_AUTHORIZED are external decisions, never ledger fields.
- No secret, credential, DSN, real principal, real participant, or real business data belongs in Git or an evidence pack.

protocolSha256 is the lowercase SHA-256 of the exact UTF-8/LF bytes after the LF
of the unique BEGIN marker and before the first byte of the unique END marker.
The covered block ends with one LF. Markers are excluded. No BOM, CR,
normalization, reserialization, or self-referential digest is allowed.

<!-- 043C_PROTOCOL_V2_BEGIN -->
protocolId=043c-internal-rehearsal-v2
protocolVersion=2
classification=INTERNAL_SYNTHETIC_ONLY
currentDurableState=043C_V2_IMPLEMENTED_PENDING_P0_DELIVERY
executionAuthorized=false
fallbackV1=false

## 1. Normative hierarchy and v1 quarantine

The immutable incident/selection block is historical PLAN_ONLY provenance.
The last valid recovery-ledger-v2 record is the current durable state.
DELIVERY_AUTHORIZED and MERGE_AUTHORIZED remain external decisions bound to an
exact base/head. Historical implementationAuthorized=false in the incident is
not current authority after D1.

Protocol v1 and its five-record ledger remain byte-identical evidence only.
V1 execution, external modes, runtime selection, import, dot-sourcing, and
fallback are permanently forbidden. No v2 component calls a v1 component.

## 2. Durable state machine

| ID | Exact durable state | Role | Authority type |
| --- | --- | --- | --- |
| D0 | 043C_V2_PLAN_HARDENED_IMPLEMENTATION_NOT_AUTHORIZED | CPO | CPO_PLAN_HARDENING_DECISION |
| D1 | 043C_V2_IMPLEMENTATION_AUTHORIZED_NOT_STARTED | CPO | CPO_IMPLEMENTATION_AUTHORIZATION |
| D2 | 043C_V2_IMPLEMENTED_PENDING_P0_DELIVERY | PREPARATION_OWNER | P0_IMPLEMENTATION_EVIDENCE |
| D3 | 043C_V2_P0_DELIVERED_PENDING_RECOVERY_SELECTION | RECOVERY_COORDINATOR_043C | P0_POST_MERGE_EVIDENCE |
| D4 | 043C_V2_RECOVERY_SELECTED_PENDING_CTO_FREEZE | CPO | CPO_RECOVERY_SELECTION_DECISION |
| D5 | 043C_V2_PROTOCOL_FROZEN_READY_FOR_R1_DECISION | CTO | CTO_FREEZE_GATE_D5 |
| D6 | 043C_V2_R1_CLEANUP_VALIDATED_READY_FOR_R2_DECISION | COORDINATOR_043C | R1_CLEANUP_EVIDENCE |
| D7 | 043C_V2_R2_CLEANUP_VALIDATED_READY_FOR_FINAL_CPO_DECISION | COORDINATOR_043C | R2_CLEANUP_EVIDENCE |
| F1 | GO_TO_EXTERNAL_GATE_REVIEW | CPO | CPO_FINAL_DECISION |
| F2 | NO_GO | CPO | CPO_FINAL_DECISION |
| F3 | INCONCLUSIVE | CPO | CPO_FINAL_DECISION |

D0-D7 are unique and ordered. F1 is allowed only after complete D7. F2/F3
may follow D6 or D7. A terminal is unique, physically last, and has no outgoing
transition. The ledger is versioned, append-only, and hash chained. Local run
states never appear as durable records.

Exact authorityRef values:

| ID | authorityRef |
| --- | --- |
| D0 | 043c-v2-d0-plan-hardening-decision |
| D1 | 043c-v2-d1-implementation-authorization |
| D2 | 043c-v2-d2-implementation-evidence |
| D3 | 043c-v2-d3-p0-post-merge-evidence |
| D4 | 043c-v2-d4-recovery-selection-decision |
| D5 | 043c-v2-d5-cto-freeze-gate |
| D6 | 043c-v2-d6-r1-cleanup-evidence |
| D7 | 043c-v2-d7-r2-cleanup-evidence |
| F1 | 043c-v2-f1-cpo-final-go-external-gate-review |
| F2 | 043c-v2-f2-cpo-final-no-go |
| F3 | 043c-v2-f3-cpo-final-inconclusive |

D0-D1 have null protocol bindings. D2 binds this v2 protocol. D3-D4 add stable
reviewRefs. D5 binds the D4 commit and qualificationSha256. D6 binds the exact
R1 evidence file. D7 binds the ASCII R1/R2 hash index. Terminals copy the last
completedRun and evidenceSha256 exactly.

All seven authorizations in every record are false, in this order:
v1ExecutionAuthorized, v2ExecutionAuthorized, r1Authorized, r2Authorized,
externalUseAuthorized, realDataAuthorized, productionAuthorized.

### 2.1 Exact ledger record envelope

`evals/pilot/043c/recovery-ledger-v2.jsonl` is strict UTF-8 without BOM,
LF-only, has no blank line, starts with `{`, ends with one LF, and is at most
65536 bytes in total. Every minified record has exactly these 23 properties in
this order:

1. schemaVersion
2. ledgerId
3. sequence
4. decisionId
5. state
6. previousState
7. previousRecordSha256
8. recordedAtUtc
9. authorityOccurredAtUtc
10. recordedByRole
11. authorityType
12. authorityRef
13. incidentId
14. incidentSha256
15. protocolId
16. protocolSha256
17. qualificationSha256
18. frozenCommit
19. completedRun
20. evidenceSha256
21. cpoOutcome
22. reviewRefs
23. authorizations

schemaVersion is the integer 2 and ledgerId is `043c-recovery-ledger-v2`.
decisionId is unique per ledger, immutable, and matches
`^(?:D[0-7]|F[1-3])$`; state, role, authority type, and the exact authorityRef
table above are a closed one-to-one tuple. sequence starts at zero and equals
the physical record index. Timestamps are exactly
`yyyy-MM-ddTHH:mm:ss.fffZ`; authorityOccurredAtUtc is not later than
recordedAtUtc, and recordedAtUtc increases strictly.

previousState and previousRecordSha256 are null only in D0. Each later record
copies the exact previous durable state and hashes the complete preceding JSON
line including its LF. incidentId and incidentSha256 are non-null and stable
from D0. protocolId and protocolSha256 are null D0-D1, exact and stable D2+.
qualificationSha256 and frozenCommit are null D0-D4, exact and stable D5+;
frozenCommit is the D4 commit, never the P0 merge.

completedRun and evidenceSha256 follow these closed rules:

- D0-D5: both are null.
- D6: the R1 file hash is required; completedRun is R1 only for COMPLETED R1,
  otherwise null for an ABORTED R1 whose cleanup was verified.
- D7: complete R1 is mandatory; the R1/R2 index hash is required;
  completedRun is R2 for COMPLETED R2 and R1 for ABORTED R2.
- F1/F2/F3 copy completedRun and evidenceSha256 byte-for-byte from D6 or D7.

cpoOutcome is null D0-D7 and is exactly the terminal state in F1/F2/F3.
reviewRefs is null D0-D2 and follows the next section from D3 onward.
authorizations is always non-null, has only the seven ordered properties above,
and every value is false. Implementation, Git, delivery, and merge authority
properties are forbidden in that object.

The durable D6 label contains `READY_FOR_R2_DECISION` because it is a cleanup
checkpoint, not because it grants R2. When R1 is ABORTED, D6 has
completedRun=null and permits only F2/F3; every R2 mode remains forbidden.

### 2.2 Exact P0 reviewRefs

reviewRefs has exactly these nine properties in order and remains byte-identical
from D3 through the terminal:

1. p0ReviewedHead
2. p0ReviewedTree
3. cpoPostCodeReviewRef
4. aiTechnicalReviewRef
5. aiSecurityPrivacyReviewRef
6. ctoTechnicalGateRef
7. cpoPreMergeReviewRef
8. p0MergeCommit
9. p0MergeTree

Let H be p0ReviewedHead, T be p0ReviewedTree, and M be p0MergeCommit. All four
Git values are 40-character lowercase SHA-1 values. T equals tree(H), M is not
H, M is a one-parent squash whose parent is the exact P0 base, and
p0MergeTree equals tree(M) equals T. The merge uses the exact H through
`--match-head-commit=H`.

The five authority references are exactly:

- `043c-v2-p0-cpo-post-code-review-pass-<H>`
- `043c-v2-p0-ai-technical-review-pass-<H>`
- `043c-v2-p0-ai-security-privacy-review-pass-<H>`
- `043c-v2-p0-cto-technical-gate-pass-<H>`
- `043c-v2-p0-cpo-pre-merge-review-pass-<H>`

Each source authority artifact has outcome=PASS, reviewedHead=H, and
reviewedTree=T. AI reviews remain `AI_GENERATED / NOT_HUMAN_SIGNED`. A stale
head, different tree, empty field, malformed reference, non-PASS outcome, or
non-single-parent merge fails closed.

## 3. Delivery and freeze sequence

P0 is risk C and implements exactly D0-D2 on these eight paths only:

1. `M specs/active/043-controlled-fiduciary-pilot-readiness-v1.md`
2. `M runbooks/controlled-fiduciary-pilot-local-043.md`
3. `M docs/product/v1-plan.md`
4. `M runbooks/validate-controlled-fiduciary-pilot-043c-state.ps1`
5. `A runbooks/controlled-fiduciary-pilot-local-043c-v2.md`
6. `A evals/pilot/043c/recovery-ledger-v2.jsonl`
7. `A evals/pilot/043c/validate-recovery-v2.mjs`
8. `A runbooks/validate-controlled-fiduciary-pilot-043c-v2-state.ps1`

The local matrix is 4M/4UNTRACKED with an empty index; the committed P0 range
is 4M/4A/0D/0R/0C. P0 does not authorize delivery. After post-code reviews and
distinct delivery/merge authority, P0 is squash merged with source/final tree
identity and one parent.

P1 appends D3 only. P2 appends D4 only after the real CPO selection. D4 allows
Qualification Q1-Q7 only; it does not authorize R1. P3 appends D5 only after
all Q records are closed, reviewed, and bound by qualificationSha256. The CTO
freeze binds the exact D4 main commit. CTO TECHNICAL GATE P0 is not CTO FREEZE
GATE D5.

After D5, only unit ledger appends may touch protected 043c artifacts. Foreign
repository commits do not invalidate the freeze when they obey the ruleset and
leave every protected byte unchanged.

## 4. C043C canonical JSON

Every canonical JSON artifact uses strict UTF-8 without BOM, NFC strings,
one minified object line plus one LF, no CR, no duplicate/additional key,
declared property order, and at most 65536 bytes including LF. Control
characters are forbidden; only quote and backslash may be escaped, as `\"` and
`\\`. Integers have no leading zero.
Money is a two-decimal string. Hashes cover exact bytes including LF.

The four runtime JSON files are:

1. authorization.json - exactly 10 keys:
   schemaVersion, run, decision, authorizedAtUtc, authorityRef, protocolId,
   protocolSha256, frozenCommit, qualificationSha256, resourceTargetSha256.
2. state\active-state.json - exactly 10 keys:
   schemaVersion, state, run, recordedAtUtc, authorityRef, protocolId,
   protocolSha256, frozenCommit, qualificationSha256, resourceTargetSha256.
3. runs\R1\evidence-summary.json - exactly the 18 evidence keys below.
4. runs\R2\evidence-summary.json - exactly the same 18 evidence keys.

Evidence key order:

1. schemaVersion
2. run
3. outcome
4. lastCompletedTask
5. abortReasonCode
6. runStartedAtUtc
7. runEndedAtUtc
8. protocolId
9. protocolSha256
10. frozenCommit
11. resourceTargetSha256
12. expectedBusinessEventCount
13. missingExpectedBusinessEventCount
14. unexpectedBusinessEventCount
15. auditProjectionSha256
16. businessStateSha256
17. evidenceContentSha256
18. qualificationSha256

schemaVersion is 2. A completed run has T14, null abort reason, non-null ordered
timestamps, and 15/0/0. An aborted run has a closed reason and factual counts.
runStartedAtUtc may be null only at null/T00. T00 never makes a completed run.

authorization R1 requires D5. R2 requires complete D6, R1 15/0/0, and verified
cleanup. active-state has only R1_ONLY_AUTHORIZED_NOT_STARTED,
R1_STARTED_CLEANUP_NOT_VALIDATED, R2_ONLY_AUTHORIZED_NOT_STARTED, or
R2_STARTED_CLEANUP_NOT_VALIDATED. The transition to STARTED is atomic
immediately before T00.

## 5. Qualification manifest and Q1-Q7

qualification\qualification.json has exactly:
schemaVersion, qualificationId, ledgerId, incidentId, incidentSha256,
protocolId, protocolSha256, frozenCommit, reviewRefs, qClosed,
qualifications, qualifiedAtUtc, qualifiedByRole.

Values include schemaVersion=2, qualificationId=043c-v2-q1-q7-qualification,
ledgerId=043c-recovery-ledger-v2, qClosed=true, seven ordered Q objects, and
qualifiedByRole=RECOVERY_COORDINATOR_043C.

Each Q object has exactly qId, qClosed, nominal, nominalSha256, mutant,
mutantSha256, errorCode, reviewRef. All Q1-Q7 must be PASS/REJECTED and reviewed:

| Q | Nominal proof | Required mutant error |
| --- | --- | --- |
| Q1 | Real fixed LocalApplicationData and handle final path | 043C_V2_Q1_FINAL_PATH_MISMATCH |
| Q2 | 65536 accepted; 65537 rejected before full read | 043C_V2_Q2_ARTIFACT_SIZE_EXCEEDED |
| Q3 | UNC, mapped/device, reparse, junction, escape rejected | 043C_V2_Q3_PATH_CONFINEMENT_VIOLATION |
| Q4 | File/parent identity and size stable around read | 043C_V2_Q4_CONCURRENT_MUTATION_DETECTED |
| Q5 | PostgreSQL 17 SSPI reader exact and unprivileged | 043C_V2_Q5_CATALOG_READER_PROFILE_INVALID |
| Q6 | Synthetic Flyway/seed exact application readiness | 043C_V2_Q6_APPLICATION_READINESS_NOT_EXACT |
| Q7 | Audit/business/content/file/ledger hashes coherent | 043C_V2_Q7_EVIDENCE_HASH_BINDING_INVALID |

A SelfTest never closes a Q. qualificationSha256 hashes the entire canonical
manifest, including LF, and remains null through D4 then stable from D5.

## 6. Local root, handles, and resources

The only local root is:

%LOCALAPPDATA%\Ritomer\043c\043c-internal-rehearsal-v2

It must be a canonical absolute Windows X:\ path on a Fixed volume. UNC,
mapped drive, device path, URI, relative path, reparse point, junction, symlink,
or parent escape fails closed. Read-only handles stay open during inspection.
CreateFileW OPEN_EXISTING, GetFinalPathNameByHandleW,
GetFileInformationByHandle, GetFileSizeEx, ReadFile, GetDriveTypeW, and
CloseHandle are the only native path primitives. Final path, identity, size,
and attributes are checked before and after read. Oversize is rejected before
allocation or complete read.

Exact resources:

| Resource | R1 | R2 |
| --- | --- | --- |
| Database | ritomer_043c_r1 | ritomer_043c_r2 |
| Login role | ritomer_043c_r1_runner | ritomer_043c_r2_runner |
| Storage | runtime/R1/storage | runtime/R2/storage |

Each resource descriptor is exactly 180 UTF-8/LF bytes:

~~~text
schemaVersion=1
run=R1
jdbcUrl=jdbc:postgresql://127.0.0.1:5432/ritomer_043c_r1
databaseName=ritomer_043c_r1
roleName=ritomer_043c_r1_runner
storageRelativePath=runtime/R1/storage
~~~

R1 SHA-256: 318de7101897fd534aa91fed72243fbfb29e78ac5951c57dccf09251b4d7b3b8.

~~~text
schemaVersion=1
run=R2
jdbcUrl=jdbc:postgresql://127.0.0.1:5432/ritomer_043c_r2
databaseName=ritomer_043c_r2
roleName=ritomer_043c_r2_runner
storageRelativePath=runtime/R2/storage
~~~

R2 SHA-256: dfc660e524eb9d91f7ee8f6e4d9273cac36c1c92d3595e285ba0afda8f78e2ef.

PostgreSQL use is forbidden until the relevant Q/gate. The future read-only
channel is PostgreSQL client major 17, 127.0.0.1:5432, psql -X --no-password,
require_auth=sspi, reader ritomer_043c_catalog_reader, allowlisted child
environment, 10 second timeout, and 65536-byte stdout/stderr caps. The reader
must LOGIN, have no SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS,
membership, or write privilege.

ApplicationReadiness=EXACT_STATE_PROVEN requires Flyway V1-V10, exact tables,
one synthetic tenant, two synthetic users, exactly ACCOUNTANT and REVIEWER
memberships, zero business/audit rows before T00, empty safe storage, and the
other run absent.

## 7. Exact T00-T15 path

T00-T14 are the business run. T15 is cleanup only.

| Task | Exact content |
| --- | --- |
| T00 | Verify D5, run-specific authority, protocolId/hash, frozenCommit, qualificationSha256, and resourceTargetSha256. |
| T01 | Open the local run, generate runId, capture run_start_utc; provisioning and preflight already ended. |
| T02 | Verify only frozen 043a fixtures: balance 359 bytes/SHA-256 2295b620704c2cfcdf1e37660388bd84a1d261c0b7697edf5bce21d0c04f9855; evidence 184 bytes/SHA-256 f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27. |
| T03 | Verify ACCOUNTANT/REVIEWER and common tenant with a non-auditing read including /api/me and no explicit X-Tenant-Id. |
| T04 | Create exactly one synthetic closing folder using the constants below. |
| T05 | Import balance-fy2025-v1.csv; require version 1, seven rows, debit/credit 149000.00. |
| T06 | Create exactly the seven mappings below. |
| T07 | Read canonical readiness, controls, summaries, and previews; GET emits no audit. |
| T08 | Create BS.ASSET.CURRENT_SECTION workpaper, DRAFT, note Synthetic bank reconciliation FY2025. |
| T09 | Upload evidence-bank-reconciliation-fy2025-v1.csv with frozen metadata. |
| T10 | Move workpaper to READY_FOR_REVIEW. |
| T11 | Handoff to already validated REVIEWER without mutation or audit. |
| T12 | Move document UNVERIFIED to VERIFIED. |
| T13 | Move workpaper READY_FOR_REVIEW to REVIEWED. |
| T14 | Create export pack, verify annex/usefulness, capture run_end_utc, reconstruct audit/business projections, bind hashes, and seal evidence. State becomes CLEANUP_PENDING only. |
| T15 | Stop runtime, operator removes exact run resources, then v2 read-only cleanup validation. |

T04 constants:

| Run | name | periodStartOn | periodEndOn | externalRef |
| --- | --- | --- | --- | --- |
| R1 | Demo Closing FY2025 043c R1 internal rehearsal (synthetic) | 2025-01-01 | 2025-12-31 | DEMO-043C-R1-INTERNAL-REHEARSAL |
| R2 | Demo Closing FY2025 043c R2 internal rehearsal (synthetic) | 2025-01-01 | 2025-12-31 | DEMO-043C-R2-INTERNAL-REHEARSAL |

T06 mappings:

| Account | Exact target |
| --- | --- |
| 1000 | BS.ASSET.CASH_AND_EQUIVALENTS |
| 1100 | BS.ASSET.TRADE_RECEIVABLES |
| 1200 | BS.ASSET.PREPAIDS_AND_OTHER_CURRENT |
| 2000 | BS.LIABILITY.TRADE_PAYABLES |
| 2800 | BS.EQUITY.RETAINED_EARNINGS |
| 3000 | PL.REVENUE.OPERATING_REVENUE |
| 4000 | PL.EXPENSE.OTHER_OPERATING_EXPENSES |

## 8. Exact audit multiset

| Slot | Action | Resource | Role |
| ---: | --- | --- | --- |
| 1 | CLOSING_FOLDER.CREATED | CLOSING_FOLDER | ACCOUNTANT |
| 2 | BALANCE_IMPORT.CREATED | BALANCE_IMPORT | ACCOUNTANT |
| 3-9 | MANUAL_MAPPING.CREATED | MANUAL_MAPPING | ACCOUNTANT |
| 10 | WORKPAPER.CREATED | WORKPAPER | ACCOUNTANT |
| 11 | DOCUMENT.CREATED | DOCUMENT | ACCOUNTANT |
| 12 | WORKPAPER.UPDATED | WORKPAPER | ACCOUNTANT |
| 13 | DOCUMENT.VERIFICATION_UPDATED | DOCUMENT | REVIEWER |
| 14 | WORKPAPER.REVIEW_STATUS_CHANGED | WORKPAPER | REVIEWER |
| 15 | EXPORT_PACK.CREATED | EXPORT_PACK | ACCOUNTANT |

The seven mapping slots are ordered 1000,1100,1200,2000,2800,3000,4000 with
the exact T06 targets. Actor, role JSON, request, resource, and metadata
predicates are fixed by this canonical query. The query is copied, never
executed or imported from v1:

~~~sql
WITH p AS (
  SELECT
    :'run_start_utc'::timestamptz AS run_start_utc,
    :'run_end_utc'::timestamptz AS run_end_utc,
    :'tenant_id'::uuid AS tenant_id,
    :'closing_folder_id'::text AS closing_folder_id,
    :'closing_folder_name'::text AS closing_folder_name,
    :'closing_folder_period_start_on'::date AS closing_folder_period_start_on,
    :'closing_folder_period_end_on'::date AS closing_folder_period_end_on,
    :'closing_folder_external_ref'::text AS closing_folder_external_ref,
    :'accountant_user_id'::uuid AS accountant_user_id,
    :'accountant_subject'::text AS accountant_subject,
    :'reviewer_user_id'::uuid AS reviewer_user_id,
    :'reviewer_subject'::text AS reviewer_subject,
    :'balance_import_id'::text AS balance_import_id,
    :'mapping_1000_id'::text AS mapping_1000_id,
    :'mapping_1100_id'::text AS mapping_1100_id,
    :'mapping_1200_id'::text AS mapping_1200_id,
    :'mapping_2000_id'::text AS mapping_2000_id,
    :'mapping_2800_id'::text AS mapping_2800_id,
    :'mapping_3000_id'::text AS mapping_3000_id,
    :'mapping_4000_id'::text AS mapping_4000_id,
    :'workpaper_id'::text AS workpaper_id,
    :'document_id'::text AS document_id,
    :'export_pack_id'::text AS export_pack_id
),
expected (
  slot,
  action,
  resource_type,
  resource_id,
  actor_user_id,
  actor_subject,
  actor_roles,
  metadata_kind,
  account_code,
  target_code
) AS (
  SELECT v.*
  FROM p
  CROSS JOIN LATERAL (
    VALUES
      (1,  'CLOSING_FOLDER.CREATED',         'CLOSING_FOLDER', p.closing_folder_id, p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'CLOSING_FOLDER',     NULL,   NULL),
      (2,  'BALANCE_IMPORT.CREATED',          'BALANCE_IMPORT', p.balance_import_id, p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'BALANCE_IMPORT',      NULL,   NULL),
      (3,  'MANUAL_MAPPING.CREATED',          'MANUAL_MAPPING', p.mapping_1000_id,   p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'MANUAL_MAPPING',      '1000', 'BS.ASSET.CASH_AND_EQUIVALENTS'),
      (4,  'MANUAL_MAPPING.CREATED',          'MANUAL_MAPPING', p.mapping_1100_id,   p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'MANUAL_MAPPING',      '1100', 'BS.ASSET.TRADE_RECEIVABLES'),
      (5,  'MANUAL_MAPPING.CREATED',          'MANUAL_MAPPING', p.mapping_1200_id,   p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'MANUAL_MAPPING',      '1200', 'BS.ASSET.PREPAIDS_AND_OTHER_CURRENT'),
      (6,  'MANUAL_MAPPING.CREATED',          'MANUAL_MAPPING', p.mapping_2000_id,   p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'MANUAL_MAPPING',      '2000', 'BS.LIABILITY.TRADE_PAYABLES'),
      (7,  'MANUAL_MAPPING.CREATED',          'MANUAL_MAPPING', p.mapping_2800_id,   p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'MANUAL_MAPPING',      '2800', 'BS.EQUITY.RETAINED_EARNINGS'),
      (8,  'MANUAL_MAPPING.CREATED',          'MANUAL_MAPPING', p.mapping_3000_id,   p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'MANUAL_MAPPING',      '3000', 'PL.REVENUE.OPERATING_REVENUE'),
      (9,  'MANUAL_MAPPING.CREATED',          'MANUAL_MAPPING', p.mapping_4000_id,   p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'MANUAL_MAPPING',      '4000', 'PL.EXPENSE.OTHER_OPERATING_EXPENSES'),
      (10, 'WORKPAPER.CREATED',               'WORKPAPER',      p.workpaper_id,      p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'WORKPAPER_CREATED',   NULL,   NULL),
      (11, 'DOCUMENT.CREATED',                'DOCUMENT',       p.document_id,       p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'DOCUMENT_CREATED',    NULL,   NULL),
      (12, 'WORKPAPER.UPDATED',               'WORKPAPER',      p.workpaper_id,      p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'WORKPAPER_UPDATED',   NULL,   NULL),
      (13, 'DOCUMENT.VERIFICATION_UPDATED',   'DOCUMENT',       p.document_id,       p.reviewer_user_id,   p.reviewer_subject,   jsonb_build_array('REVIEWER'),   'DOCUMENT_VERIFIED',   NULL,   NULL),
      (14, 'WORKPAPER.REVIEW_STATUS_CHANGED', 'WORKPAPER',      p.workpaper_id,      p.reviewer_user_id,   p.reviewer_subject,   jsonb_build_array('REVIEWER'),   'WORKPAPER_REVIEWED',  NULL,   NULL),
      (15, 'EXPORT_PACK.CREATED',             'EXPORT_PACK',    p.export_pack_id,    p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'EXPORT_PACK_CREATED', NULL,   NULL)
  ) AS v(
    slot,
    action,
    resource_type,
    resource_id,
    actor_user_id,
    actor_subject,
    actor_roles,
    metadata_kind,
    account_code,
    target_code
  )
),
candidates AS MATERIALIZED (
  SELECT ae.*
  FROM audit_event ae
  CROSS JOIN p
  WHERE ae.occurred_at >= p.run_start_utc
    AND ae.occurred_at < p.run_end_utc
),
match_counts AS (
  SELECT
    c.id,
    count(e.slot)::integer AS match_count,
    min(e.slot)::integer AS expected_slot
  FROM candidates c
  CROSS JOIN p
  LEFT JOIN expected e
    ON c.tenant_id = p.tenant_id
   AND c.actor_user_id = e.actor_user_id
   AND c.actor_subject = e.actor_subject
   AND c.actor_roles = e.actor_roles
   AND c.action = e.action
   AND c.resource_type = e.resource_type
   AND c.resource_id = e.resource_id
   AND c.request_id IS NOT NULL
   AND btrim(c.request_id) <> ''
   AND CASE e.metadata_kind
     WHEN 'CLOSING_FOLDER' THEN
       c.metadata = jsonb_build_object(
         'snapshot', jsonb_build_object(
           'name', p.closing_folder_name,
           'periodStartOn', p.closing_folder_period_start_on::text,
           'periodEndOn', p.closing_folder_period_end_on::text,
           'externalRef', p.closing_folder_external_ref,
           'status', 'DRAFT'
         )
       )
     WHEN 'BALANCE_IMPORT' THEN
       c.metadata = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'importId', p.balance_import_id,
         'version', 1,
         'fileName', 'balance-fy2025-v1.csv',
         'rowCount', 7,
         'totalDebit', '149000.00',
         'totalCredit', '149000.00',
         'diffSummary', jsonb_build_object(
           'previousVersion', NULL,
           'addedCount', 7,
           'removedCount', 0,
           'changedCount', 0
         )
       )
     WHEN 'MANUAL_MAPPING' THEN
       c.metadata = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'accountCode', e.account_code,
         'targetCode', jsonb_build_object(
           'before', NULL,
           'after', e.target_code
         ),
         'latestImportVersion', 1
       )
     WHEN 'WORKPAPER_CREATED' THEN
       c.metadata = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'anchorCode', 'BS.ASSET.CURRENT_SECTION',
         'status', 'DRAFT',
         'basisImportVersion', 1,
         'basisTaxonomyVersion', 2,
         'evidenceCount', 0
       )
     WHEN 'DOCUMENT_CREATED' THEN
       c.metadata = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'workpaperId', p.workpaper_id,
         'anchorCode', 'BS.ASSET.CURRENT_SECTION',
         'fileName', 'evidence-bank-reconciliation-fy2025-v1.csv',
         'mediaType', 'text/csv',
         'byteSize', 184,
         'checksumSha256', 'f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27',
         'sourceLabel', 'Ritomer internal synthetic fixture 043',
         'documentDate', '2025-12-31',
         'storageBackend', 'LOCAL_FS'
       )
     WHEN 'WORKPAPER_UPDATED' THEN
       c.metadata = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'anchorCode', 'BS.ASSET.CURRENT_SECTION',
         'status', jsonb_build_object(
           'before', 'DRAFT',
           'after', 'READY_FOR_REVIEW'
         ),
         'noteText', jsonb_build_object(
           'before', 'Synthetic bank reconciliation FY2025.',
           'after', 'Synthetic bank reconciliation FY2025.'
         ),
         'basisImportVersion', jsonb_build_object(
           'before', 1,
           'after', 1
         ),
         'basisTaxonomyVersion', jsonb_build_object(
           'before', 2,
           'after', 2
         ),
         'evidenceCount', jsonb_build_object(
           'before', 0,
           'after', 0
         )
       )
     WHEN 'DOCUMENT_VERIFIED' THEN
       (c.metadata - 'reviewedAt') = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'workpaperId', p.workpaper_id,
         'anchorCode', 'BS.ASSET.CURRENT_SECTION',
         'verificationStatus', jsonb_build_object(
           'before', 'UNVERIFIED',
           'after', 'VERIFIED'
         ),
         'reviewComment', jsonb_build_object(
           'before', NULL,
           'after', NULL
         ),
         'reviewedByUserId', p.reviewer_user_id::text
       )
       AND CASE
         WHEN pg_input_is_valid(
           c.metadata ->> 'reviewedAt',
           'timestamp with time zone'
         ) THEN
           (c.metadata ->> 'reviewedAt')::timestamptz >= p.run_start_utc
           AND (c.metadata ->> 'reviewedAt')::timestamptz < p.run_end_utc
         ELSE FALSE
       END
     WHEN 'WORKPAPER_REVIEWED' THEN
       (c.metadata - 'reviewedAt') = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'anchorCode', 'BS.ASSET.CURRENT_SECTION',
         'status', jsonb_build_object(
           'before', 'READY_FOR_REVIEW',
           'after', 'REVIEWED'
         ),
         'reviewComment', jsonb_build_object(
           'before', NULL,
           'after', NULL
         ),
         'reviewedByUserId', p.reviewer_user_id::text
       )
       AND CASE
         WHEN pg_input_is_valid(
           c.metadata ->> 'reviewedAt',
           'timestamp with time zone'
         ) THEN
           (c.metadata ->> 'reviewedAt')::timestamptz >= p.run_start_utc
           AND (c.metadata ->> 'reviewedAt')::timestamptz < p.run_end_utc
         ELSE FALSE
       END
     WHEN 'EXPORT_PACK_CREATED' THEN
       c.metadata = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'basisImportVersion', 1,
         'basisTaxonomyVersion', 2
       )
     ELSE FALSE
   END
  GROUP BY c.id
),
single_match_occurrences AS (
  SELECT
    m.id,
    row_number() OVER (
      PARTITION BY m.expected_slot
      ORDER BY c.occurred_at, c.id
    ) AS expected_occurrence
  FROM match_counts m
  JOIN candidates c USING (id)
  WHERE m.match_count = 1
),
ranked AS (
  SELECT
    m.id,
    m.match_count,
    m.expected_slot,
    s.expected_occurrence
  FROM match_counts m
  LEFT JOIN single_match_occurrences s USING (id)
),
matched_slots AS (
  SELECT DISTINCT expected_slot AS slot
  FROM ranked
  WHERE match_count = 1
    AND expected_occurrence = 1
)
SELECT
  (SELECT count(*)::bigint FROM expected)
    AS "expectedBusinessEventCount",
  (
    SELECT count(*)::bigint
    FROM expected e
    LEFT JOIN matched_slots m ON m.slot = e.slot
    WHERE m.slot IS NULL
  ) AS "missingExpectedBusinessEventCount",
  (
    SELECT count(*)::bigint
    FROM ranked
    WHERE match_count <> 1
       OR expected_occurrence > 1
  ) AS "unexpectedBusinessEventCount";
~~~

Nominal result is 15/0/0. A missing slot is 15/1/0; duplicate 15/0/1; wrong
actor, role, resource, or metadata is 15/1/1; every foreign event increases
unexpected.

## 9. Evidence commitments

auditProjectionSha256 hashes a canonical object from the final PostgreSQL
REPEATABLE READ READ ONLY T14 snapshot. Exact top-level order:
schemaVersion, run, outcome, lastCompletedTask, runStartedAtUtc, runEndedAtUtc,
tenantId, accountantUserId, reviewerUserId, slots,
expectedBusinessEventCount, missingExpectedBusinessEventCount,
unexpectedBusinessEventCount.

slots has exactly 15 ordered objects with:
slot, action, resourceType, accountCode, targetCode, matchStatus, resourceId,
occurredAtUtc, actorUserId, actorSubjectSha256, actorRole, requestIdSha256,
metadataSha256. Missing dynamic facts are null; matched facts are non-null.
DB timestamps use six UTC decimals. Subjects/request IDs hash the exact NFC
UTF-8 scalar without quotes or LF. Metadata hashes canonical metadata objects.
The first conforming occurrence by occurredAtUtc,id fills a slot; remaining
candidates count unexpected without persisting their raw contents.

businessStateSha256 hashes a canonical object ordered:
schemaVersion, run, outcome, lastCompletedTask, tenantId, accountantUserId,
reviewerUserId, closingFolder, balanceImport, mappings, workpaper, document,
exportPack, minimalAnnexVerified, usefulnessAssessmentCompleted.

Subobject order:

- closingFolder: id,name,periodStartOn,periodEndOn,externalRef,status
- balanceImport: id,closingFolderId,version,fileName,rowCount,totalDebit,totalCredit
- mapping: id,closingFolderId,accountCode,targetCode,createdByUserId,updatedByUserId
- workpaper: id,closingFolderId,anchorCode,noteText,status,reviewComment,basisImportVersion,basisTaxonomyVersion,evidenceCount,reviewedAtUtc,reviewedByUserId
- document: id,workpaperId,anchorCode,fileName,mediaType,byteSize,checksumSha256,sourceLabel,documentDate,storageBackend,verificationStatus,reviewComment,reviewedAtUtc,reviewedByUserId
- exportPack: id,closingFolderId,idempotencyKeySha256,storageObjectKeySha256,sourceFingerprint,storageBackend,fileName,mediaType,byteSize,checksumSha256,basisImportVersion,basisTaxonomyVersion,createdAtUtc,createdByUserId

Objects not created are null. mappings has zero to seven entries in T06 order.
A completed run requires every object, all mappings, exact constants, and both
booleans true.

evidenceContentSha256 covers the evidence summary without its own field.
The exact 17-property descriptor order is:
schemaVersion, run, outcome, lastCompletedTask, abortReasonCode,
runStartedAtUtc, runEndedAtUtc, protocolId, protocolSha256, frozenCommit,
resourceTargetSha256, expectedBusinessEventCount,
missingExpectedBusinessEventCount, unexpectedBusinessEventCount,
auditProjectionSha256, businessStateSha256, qualificationSha256.

The external evidence file hash covers all 18 properties plus LF. D6
evidenceSha256 is the R1 file hash. D7 evidenceSha256 hashes exactly 136 ASCII
bytes, R1 then R2, each with LF:

~~~text
R1=<64 lowercase hex>
R2=<64 lowercase hex>
~~~

D7 exists even for aborted R2, but then completedRun=R1 and F1 is forbidden.

Hash ownership is closed and deliberately split:

- PowerShell ValidateR1Evidence/ValidateR2Evidence, before T15, reads one
  PostgreSQL REPEATABLE READ READ ONLY snapshot and reconstructs the audit and
  business projections, evidenceContentSha256, and the complete evidence file
  hash.
- The Node checker recalculates qualificationSha256 from the complete manifest
  and, when the referenced local artifacts are available, recalculates
  evidenceContentSha256, each R1/R2 file hash, the D6 R1 binding, and the exact
  136-byte D7 index binding.
- PowerShell never claims to reconstruct a deleted database after T15. Node
  never claims to reconstruct PostgreSQL; it verifies the cryptographic chain
  from the available canonical artifacts and committed bindings.
- A terminal only copies the last durable evidenceSha256; it never creates a
  new evidence preimage.

## 10. Validator modes and gates

### 10.1 Node checker

`evals/pilot/043c/validate-recovery-v2.mjs` uses Node built-ins only. It has no
network, fetch, shell, write, or v1 import path. Its closed CLI is:

~~~text
--mode SelfTest
--mode Worktree --phase P0 --base <sha>
--mode Worktree --phase <non-P0-phase> --base <sha> --artifact-root <absolute-path>
--mode Source --phase P0 --base <sha> --head <sha>
--mode Source --phase <non-P0-phase> --base <sha> --head <sha> --artifact-root <absolute-path>
--mode FrozenDescendants --frozen <sha> --head <sha> --artifact-root <absolute-path>
--mode PostMerge --phase P0 --base <sha> --source <sha> --final <sha>
--mode PostMerge --phase <non-P0-phase> --base <sha> --source <sha> --final <sha> --artifact-root <absolute-path>
--mode V1ForensicReplay
~~~

For `--phase P0`, `Worktree` accepts only a ledger whose latest record is D1
before D2 sealing or D2 after sealing. `Source` and `PostMerge` require D2
strictly at P0. D0 and D3 are rejected in all three cases. D2 is appended only
after every required pre-D2 check, including `Worktree` against D1, has passed.

The only phases are P0, P1, P2, P3, D6, D7, F1, F2, and F3. No missing,
duplicate, positional, or additional argument is accepted. Git objects and
blobs are read locally; no fetch exists. The ledger cap is 65536 bytes. Every
other file, Git blob, and individual Git command output is capped at 2097152
bytes.

`<non-P0-phase>` is exactly P1, P2, P3, D6, D7, F1, F2, or F3.
`--artifact-root` is forbidden at P0, SelfTest, and V1ForensicReplay; it is
mandatory for every non-P0 Worktree, Source, or PostMerge invocation and for
FrozenDescendants. The root is an explicit absolute, real, non-reparse
directory outside the repository. Reads are confined to regular non-reparse
files below that root, each from 1 through 65536 bytes, with final path,
identity, size, and modification time stable before and after the read. The
checker never writes there. `inputScope` names the primary repository source;
the required non-P0 artifact root remains a separate read-only input.

The external validation-input layout is fixed:

~~~text
authorities/cpo-post-code-review.json
authorities/ai-technical-review.json
authorities/ai-security-privacy-review.json
authorities/cto-technical-gate.json
authorities/cpo-pre-merge-review.json
qualification/qualification.json
runs/R1/evidence-summary.json
runs/R1/audit-projection.json
runs/R1/business-state.json
runs/R2/evidence-summary.json
runs/R2/audit-projection.json
runs/R2/business-state.json
~~~

The five authority files are required from D3, qualification from D5, the R1
bundle from D6, and the R2 bundle from D7. Each authority file is canonical
C043C JSON with exactly `schemaVersion`, `authorityRef`, `outcome`,
`reviewedHead`, `reviewedTree`, and `classifications`; schemaVersion is 2,
outcome is PASS, and the reference, head, and tree bind the ledger reviewRefs
and Git facts. AI authority classifications are exactly
`["AI_GENERATED","NOT_HUMAN_SIGNED"]`; the other three arrays are empty.
Audit and business files in this root are ephemeral validation preimages, not
additional durable product artifacts. Q nominal/mutant preimages exist only
as ephemeral SelfTest inputs through the same loader and are never part of the
external layout or durable local state.

Successful output is buffered and has exactly this order:

~~~text
checker=043c-recovery-v2
mode=<mode>
phase=<phase|NONE>
inputScope=<MEMORY|WORKTREE|GIT_BLOBS>
readOnly=true
fallbackV1=false
errorCount=0
errorCodes=NONE
verdict=PASS
~~~

On failure no stdout line contains `PASS`, stdout contains only the closed
diagnostic, and stderr is empty. Exit codes are 0 success, 2 CLI, 3
Git/blob/baseline, 4 invariant, and 5 internal. The only public Node error
codes are:

~~~text
E_CLI_MODE E_CLI_PHASE E_CLI_ARGUMENT E_CLI_SHA
E_GIT_UNAVAILABLE E_GIT_OBJECT_MISSING E_GIT_BLOB_MISSING
E_BASELINE_DRIFT E_WORKTREE_STATE E_INDEX_FLAGS E_FILE_SET
E_PARENT_COUNT E_PARENT_BINDING E_ANCESTRY E_TREE_IDENTITY
E_V1_IMMUTABILITY E_INCIDENT_CONTRACT E_PROTOCOL_V2
E_LEDGER_V2 E_LEDGER_APPEND E_FREEZE_BINDING
E_FROZEN_DESCENDANT E_FORENSIC_PR106 E_FORENSIC_PR107
E_READ_ONLY_POLICY E_V1_FALLBACK E_OUTPUT_BUFFER
E_SELF_TEST E_INTERNAL
~~~

The Node checker owns I01-I12, the exact worktree/file-set, ledger chain,
qualification manifest recalculation at P3+, historical blobs/parents/trees,
source/final tree identity, frozen descendants, D6/D7 bindings, and v1
forensic replay.

### 10.2 PowerShell validators

The only v2 modes are SelfTest, Qualification, PreparationPreflight, PreR1,
ValidateR1Evidence, PostR1Cleanup, PreR2, ValidateR2Evidence, and
PostR2Cleanup. `-Mode` is mandatory. `-QualificationId Q1|Q2|Q3|Q4|Q5|Q6|Q7`
is mandatory only with Qualification and forbidden otherwise. No positional,
unknown, duplicate, or additional argument exists; binding errors use the
buffered failure envelope and exit 2.

SelfTest is memory-only and proves I13-I20 as 8/8/0; it closes no Q.
Qualification requires D4 and dedicated synthetic resources.
PreparationPreflight and all R1 modes require D5 and qualificationSha256.
R2 modes require D6 with R1 COMPLETED, 15/0/0, and verified cleanup. Every
gate refusal precedes LocalApplicationData, JSON, storage, PostgreSQL, or
process access.

The production-validation cores and SelfTest share the same byte inputs.
I15 consumes the complete qualification, distinct R1/R2 audit and business
projections, both evidence summaries, and canonical ledger bytes through D6
or D7; it derives completedRun from the evidence outcomes and verifies the
ledger chain and evidence/index hashes. I18 consumes an ordered read-only
adapter snapshot covering `psql -X`, no-password, allowlisted child
environment, timeout and output caps, exit, PostgreSQL 17/SSPI reader
privileges, and exact R1/R2 resources. I19 binds its ordered readiness snapshot
to run, protocol hash, frozen commit, resource target, Flyway V1-V10, seed,
storage, and the absent other run. I20 consumes canonical R1 active-state and
evidence bytes, ledger bytes through D6, and exact absent database, role, and
storage cleanup facts. These adapter snapshots are transient validator inputs,
not new durable artifacts; no injected success boolean is authoritative.

The exact P0 SelfTest success envelope is:

~~~text
validator=043c-v2-state
mode=SelfTest
inputScope=MEMORY
readOnly=true
fallbackV1=false
qualificationExecuted=false
postgresqlAccessed=false
localArtifactsAccessed=false
invariantIds=043C2-I13,043C2-I14,043C2-I15,043C2-I16,043C2-I17,043C2-I18,043C2-I19,043C2-I20
summary=8/8/0
errorCount=0
errorCodes=NONE
verdict=PASS
~~~

At P0 every non-SelfTest mode is gate-refused before I/O. Its failure envelope
is buffered in this exact order: validator, mode, inputScope=MEMORY_GATE_ONLY,
readOnly=true, fallbackV1=false, qualificationExecuted=false,
postgresqlAccessed=false, localArtifactsAccessed=false, errorCount,
errorCodes, verdict=FAIL. Missing or invalid CLI uses mode=NONE. No failure
line contains `PASS`; stdout contains only the envelope and stderr is empty.
No external success envelope is enabled by P0.

PowerShell v2 exit codes are 0 success, 2 CLI, 3 gate/Git/protocol, 4
path/JSON/storage, 5 PostgreSQL/process, 6 evidence/cleanup, and 7 internal.
Its only public error codes are:

~~~text
E_CLI_MODE E_CLI_QUALIFICATION E_CLI_ARGUMENT
E_GATE_STATE E_GATE_QUALIFICATION E_PROTOCOL_BINDING
E_LEDGER_BINDING E_FROZEN_HISTORY E_GIT_STATE
E_LOCAL_ROOT E_PATH_CONFINEMENT E_PATH_REPARSE E_PATH_TYPE
E_PATH_ABSENCE E_PATH_RACE E_JSON_SIZE E_JSON_ENCODING
E_JSON_CANONICAL E_JSON_SCHEMA E_JSON_BINDING E_STORAGE_STATE
E_PSQL17_UNAVAILABLE E_PSQL17_VERSION E_PSQL_TIMEOUT
E_PSQL_OUTPUT_LIMIT E_PSQL_EXIT E_PG_AUTH_CHANNEL
E_PG_SERVER_IDENTITY E_PG_READER_ROLE E_PG_READER_PRIVILEGES
E_PG_RESOURCE_STATE E_APPLICATION_READINESS E_EVIDENCE_AUDIT
E_EVIDENCE_CONTENT_HASH E_EVIDENCE_FILE_HASH E_R1_PRECONDITION
E_CLEANUP_STATE E_READ_ONLY_POLICY E_INTERNAL
~~~

The v1 PowerShell validator remains a separate quarantined interface: SelfTest
alone is memory-only and returns 91/91/0. Every external v1 mode is rejected
immediately after CLI binding, before any environment or I/O access, with
`E_V1_EXTERNAL_MODE_PERMANENTLY_DISABLED`, exit 40,
externalAccessPerformed=false, stateWritePerformed=false, and verdict=FAIL.
No option can re-enable it.

### 10.3 Canonical mapping of detailed cryptographic causes

The two lists above are the only public validator diagnostic taxonomies.
Detailed cryptographic cause names are review vocabulary only and are never
emitted as a third `errorCodes` vocabulary. They map as follows:

- Node ledger field causes (`E_LEDGER_SCHEMA`, `E_LEDGER_ID`,
  `E_LEDGER_SEQUENCE`, `E_LEDGER_DECISION_ID`, `E_LEDGER_STATE`,
  `E_LEDGER_PREVIOUS_STATE`, `E_LEDGER_PREVIOUS_HASH`,
  `E_LEDGER_TIMESTAMP`, `E_LEDGER_AUTHORITY`, `E_COMPLETED_RUN`,
  `E_EVIDENCE_BINDING`, `E_CPO_OUTCOME`, `E_AUTHORIZATION_SCOPE`) map to
  `E_LEDGER_V2`.
- Node protocol and qualification causes map respectively to `E_PROTOCOL_V2`
  and `E_FREEZE_BINDING`. The review label `E_REVIEW_REFS` maps to
  `E_LEDGER_V2` for shape, pattern, outcome, or stability; a missing
  parent/head binding maps to `E_PARENT_BINDING`; a different
  review/source/final tree maps to `E_TREE_IDENTITY`.
- A Node D6 or D7 evidence/index binding cause maps to `E_LEDGER_V2`.
- PowerShell qualification and D6/D7 ledger-link causes map respectively to
  `E_GATE_QUALIFICATION` and `E_LEDGER_BINDING`.
- PowerShell auditProjection or businessState reconstruction causes, including
  the review label `E_EVIDENCE_BUSINESS_STATE`, map to
  `E_EVIDENCE_AUDIT`; content and complete-file causes map to
  `E_EVIDENCE_CONTENT_HASH` and `E_EVIDENCE_FILE_HASH`.
- The review label `E_D7_EVIDENCE_INDEX` maps to Node `E_LEDGER_V2` or
  PowerShell `E_LEDGER_BINDING`, according to the component that detects it.
- The seven `043C_V2_Q*_...` values are committed mutant result values inside
  qualification.json; they do not extend either validator error-code list.

ValidateR1Evidence/ValidateR2Evidence run before T15 and reconstruct the
audit/business/content/file hashes. PostCleanup never claims to reconstruct a
deleted database. The permanent union is exactly 20/20/0. No SelfTest closes
Q1-Q7.

## 11. Abort, cleanup, and terminal rules

Allowed abort reasons: HARD_STOP, OPERATOR_INTERRUPTION, ENVIRONMENT_FAILURE,
PROTOCOL_DEVIATION, EVIDENCE_INCOMPLETE. An abort remains a business failure
even if counters happen to be 15/0/0.

T15 interruption leaves the local STARTED state and creates no D6/D7/terminal.
R1 aborted may reach D6 only after verified cleanup, completedRun=null, and
then permits F2/F3 only. R2 cannot start. R2 aborted may reach D7 after
complete R1 and verified cleanup, completedRun=R1, and permits F2/F3 only.
F1 requires both completed runs, both audits 15/0/0, both cleanups, and an
explicit CPO decision.

Only the local operator writes local authorization/state/evidence and
provisions/removes resources. Validators and checkers are read-only.

## 12. Stop conditions

Stop without transition on any protocol/hash/ledger/binding divergence,
non-canonical or oversize JSON, path race or escape, privileged reader,
partial application readiness, fixture mutation, identity/tenant mismatch,
unexpected audit, evidence hash mismatch, incomplete cleanup, premature R2,
v1 selection/fallback, write attempt, secret/real data/external participant,
or missing explicit CPO/CTO/delivery/merge authority.

P0 performs no Qualification, PostgreSQL, PreparationPreflight, runtime, R1,
R2, local artifact read, secret read, or production action.
<!-- 043C_PROTOCOL_V2_END -->
