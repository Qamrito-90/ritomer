create table document (
  id uuid primary key,
  tenant_id uuid not null references tenant (id),
  workpaper_id uuid not null,
  storage_backend text not null,
  storage_object_key text not null,
  file_name text not null,
  media_type text not null,
  byte_size bigint not null,
  checksum_sha256 text not null,
  source_label text not null,
  document_date date,
  created_at timestamptz not null,
  created_by_user_id uuid not null references app_user (id),
  constraint fk_document_workpaper foreign key (workpaper_id, tenant_id)
    references workpaper (id, tenant_id)
    on delete cascade,
  constraint uk_document_tenant_storage_object_key unique (tenant_id, storage_object_key),
  constraint chk_document_storage_backend_allowed check (storage_backend in ('LOCAL_FS', 'GCS')),
  constraint chk_document_storage_object_key_non_blank check (btrim(storage_object_key) <> ''),
  constraint chk_document_file_name_non_blank check (btrim(file_name) <> ''),
  constraint chk_document_media_type_non_blank check (btrim(media_type) <> ''),
  constraint chk_document_byte_size_positive check (byte_size > 0),
  constraint chk_document_checksum_sha256_format check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  constraint chk_document_source_label_non_blank check (btrim(source_label) <> '')
);

create index idx_document_tenant_workpaper_created
  on document (tenant_id, workpaper_id, created_at desc, id desc);

create index idx_document_tenant_id
  on document (tenant_id, id);
