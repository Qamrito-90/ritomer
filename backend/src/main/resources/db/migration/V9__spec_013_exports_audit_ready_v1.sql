create table export_pack (
  id uuid primary key,
  tenant_id uuid not null references tenant (id),
  closing_folder_id uuid not null,
  idempotency_key text not null,
  source_fingerprint text not null,
  storage_backend text not null,
  storage_object_key text not null,
  file_name text not null,
  media_type text not null,
  byte_size bigint not null,
  checksum_sha256 text not null,
  basis_import_version integer not null,
  basis_taxonomy_version integer not null,
  created_at timestamptz not null,
  created_by_user_id uuid not null references app_user (id),
  constraint fk_export_pack_closing_folder foreign key (closing_folder_id, tenant_id)
    references closing_folder (id, tenant_id),
  constraint uk_export_pack_tenant_closing_idempotency unique (tenant_id, closing_folder_id, idempotency_key),
  constraint uk_export_pack_id_tenant unique (id, tenant_id),
  constraint uk_export_pack_tenant_storage_object_key unique (tenant_id, storage_object_key),
  constraint chk_export_pack_idempotency_key_non_blank check (btrim(idempotency_key) <> ''),
  constraint chk_export_pack_source_fingerprint_non_blank check (btrim(source_fingerprint) <> ''),
  constraint chk_export_pack_storage_backend_allowed check (storage_backend in ('LOCAL_FS', 'GCS')),
  constraint chk_export_pack_storage_object_key_non_blank check (btrim(storage_object_key) <> ''),
  constraint chk_export_pack_file_name_non_blank check (btrim(file_name) <> ''),
  constraint chk_export_pack_media_type_zip check (media_type = 'application/zip'),
  constraint chk_export_pack_byte_size_positive check (byte_size > 0),
  constraint chk_export_pack_checksum_sha256_format check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  constraint chk_export_pack_basis_import_version_positive check (basis_import_version > 0),
  constraint chk_export_pack_basis_taxonomy_version_positive check (basis_taxonomy_version > 0)
);

create index idx_export_pack_tenant_closing_created
  on export_pack (tenant_id, closing_folder_id, created_at desc, id desc);

create index idx_export_pack_tenant_id
  on export_pack (tenant_id, id);

create or replace function export_pack_prevent_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'export_pack is immutable; % is not allowed', tg_op
    using errcode = '55000';
end;
$$;

create trigger trg_export_pack_prevent_update
before update on export_pack
for each row
execute function export_pack_prevent_mutation();

create trigger trg_export_pack_prevent_delete
before delete on export_pack
for each row
execute function export_pack_prevent_mutation();
