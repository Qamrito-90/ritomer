create table mapping_suggestion_decision_request (
  id uuid primary key,
  tenant_id uuid not null references tenant (id),
  closing_folder_id uuid not null,
  account_code varchar(64) not null,
  idempotency_key varchar(200) not null,
  canonical_payload_hash char(64) not null,
  decision varchar(16) not null,
  latest_import_version integer not null,
  suggestion_fingerprint char(64) not null,
  target_code text null,
  review_comment text null,
  actor_user_id uuid not null references app_user (id),
  result_kind varchar(48) not null,
  applied_account_code varchar(64) null,
  applied_target_code text null,
  created_at timestamptz not null,
  completed_at timestamptz null,
  constraint fk_mapping_suggestion_decision_request_closing_folder foreign key (closing_folder_id, tenant_id)
    references closing_folder (id, tenant_id),
  constraint uk_mapping_suggestion_decision_request_idempotency unique (tenant_id, closing_folder_id, account_code, idempotency_key),
  constraint chk_mapping_suggestion_decision_request_account_code_non_blank check (btrim(account_code) <> ''),
  constraint chk_mapping_suggestion_decision_request_idempotency_key_non_blank check (btrim(idempotency_key) <> ''),
  constraint chk_mapping_suggestion_decision_request_payload_hash_format check (canonical_payload_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_mapping_suggestion_decision_request_decision_allowed check (decision in ('ACCEPT', 'CORRECT', 'REJECT')),
  constraint chk_mapping_suggestion_decision_request_latest_import_version_positive check (latest_import_version > 0),
  constraint chk_mapping_suggestion_decision_request_fingerprint_format check (suggestion_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint chk_mapping_suggestion_decision_request_target_by_decision check (
    (
      decision in ('ACCEPT', 'CORRECT')
      and target_code is not null
      and btrim(target_code) <> ''
    )
    or (
      decision = 'REJECT'
      and target_code is null
    )
  ),
  constraint chk_mapping_suggestion_decision_request_review_comment_length check (
    review_comment is null or char_length(review_comment) <= 600
  ),
  constraint chk_mapping_suggestion_decision_request_result_kind_allowed check (
    result_kind in (
      'PENDING',
      'MANUAL_MAPPING_CREATED',
      'MANUAL_MAPPING_UPDATED',
      'MANUAL_MAPPING_NOOP',
      'REJECT_RECORDED',
      'CONFLICT_ARCHIVED',
      'CONFLICT_NO_IMPORT',
      'CONFLICT_FLAG_OFF',
      'CONFLICT_NON_DECISIONABLE',
      'CONFLICT_SUGGESTION_ABSENT',
      'CONFLICT_FINGERPRINT_MISMATCH',
      'CONFLICT_STALE_IMPORT',
      'CONFLICT_ACCOUNT_ABSENT',
      'CONFLICT_TARGET_MISMATCH',
      'CONFLICT_TARGET_NOT_SELECTABLE'
    )
  ),
  constraint chk_mapping_suggestion_decision_request_completion_by_result check (
    (result_kind = 'PENDING' and completed_at is null)
    or (result_kind <> 'PENDING' and completed_at is not null)
  ),
  constraint chk_mapping_suggestion_decision_request_applied_pair check (
    (applied_account_code is null and applied_target_code is null)
    or (applied_account_code is not null and applied_target_code is not null)
  )
);

create index idx_mapping_suggestion_decision_request_history
  on mapping_suggestion_decision_request (tenant_id, closing_folder_id, account_code, created_at desc);
