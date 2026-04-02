create table workpaper (
  id uuid primary key,
  tenant_id uuid not null references tenant (id),
  closing_folder_id uuid not null,
  anchor_code text not null,
  anchor_label text not null,
  summary_bucket_code text not null,
  statement_kind text not null,
  breakdown_type text not null,
  note_text text not null,
  status text not null,
  review_comment text,
  basis_import_version integer not null,
  basis_taxonomy_version integer not null,
  created_at timestamptz not null,
  created_by_user_id uuid not null references app_user (id),
  updated_at timestamptz not null,
  updated_by_user_id uuid not null references app_user (id),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references app_user (id),
  constraint fk_workpaper_closing_folder foreign key (closing_folder_id, tenant_id)
    references closing_folder (id, tenant_id),
  constraint uk_workpaper_tenant_closing_anchor unique (tenant_id, closing_folder_id, anchor_code),
  constraint uk_workpaper_id_tenant unique (id, tenant_id),
  constraint chk_workpaper_anchor_code_non_blank check (btrim(anchor_code) <> ''),
  constraint chk_workpaper_anchor_label_non_blank check (btrim(anchor_label) <> ''),
  constraint chk_workpaper_summary_bucket_code_non_blank check (btrim(summary_bucket_code) <> ''),
  constraint chk_workpaper_note_text_non_blank check (btrim(note_text) <> ''),
  constraint chk_workpaper_review_comment_non_blank check (review_comment is null or btrim(review_comment) <> ''),
  constraint chk_workpaper_statement_kind_allowed check (statement_kind in ('BALANCE_SHEET', 'INCOME_STATEMENT')),
  constraint chk_workpaper_breakdown_type_allowed check (breakdown_type in ('SECTION', 'LEGACY_BUCKET_FALLBACK')),
  constraint chk_workpaper_status_allowed check (status in ('DRAFT', 'READY_FOR_REVIEW', 'CHANGES_REQUESTED', 'REVIEWED')),
  constraint chk_workpaper_basis_import_version_positive check (basis_import_version > 0),
  constraint chk_workpaper_basis_taxonomy_version_positive check (basis_taxonomy_version > 0),
  constraint chk_workpaper_reviewed_consistency check (
    (reviewed_at is null and reviewed_by_user_id is null)
    or (reviewed_at is not null and reviewed_by_user_id is not null)
  )
);

create index idx_workpaper_tenant_closing_anchor
  on workpaper (tenant_id, closing_folder_id, anchor_code);

create index idx_workpaper_tenant_status
  on workpaper (tenant_id, status);

create table workpaper_evidence (
  id uuid primary key,
  tenant_id uuid not null references tenant (id),
  workpaper_id uuid not null,
  position integer not null,
  file_name text not null,
  media_type text not null,
  document_date date,
  source_label text not null,
  verification_status text not null,
  external_reference text,
  checksum_sha256 text,
  constraint fk_workpaper_evidence_workpaper foreign key (workpaper_id, tenant_id)
    references workpaper (id, tenant_id)
    on delete cascade,
  constraint uk_workpaper_evidence_tenant_position unique (tenant_id, workpaper_id, position),
  constraint chk_workpaper_evidence_position_positive check (position > 0),
  constraint chk_workpaper_evidence_file_name_non_blank check (btrim(file_name) <> ''),
  constraint chk_workpaper_evidence_media_type_non_blank check (btrim(media_type) <> ''),
  constraint chk_workpaper_evidence_source_label_non_blank check (btrim(source_label) <> ''),
  constraint chk_workpaper_evidence_external_reference_non_blank check (external_reference is null or btrim(external_reference) <> ''),
  constraint chk_workpaper_evidence_checksum_sha256_format check (
    checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint chk_workpaper_evidence_verification_status_allowed check (
    verification_status in ('UNVERIFIED', 'VERIFIED', 'REJECTED')
  )
);

create index idx_workpaper_evidence_tenant_workpaper_position
  on workpaper_evidence (tenant_id, workpaper_id, position);
