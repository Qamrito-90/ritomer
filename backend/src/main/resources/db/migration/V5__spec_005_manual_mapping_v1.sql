create table manual_mapping (
  id uuid primary key,
  tenant_id uuid not null references tenant (id),
  closing_folder_id uuid not null,
  account_code text not null,
  target_code text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  created_by_user_id uuid not null references app_user (id),
  updated_by_user_id uuid not null references app_user (id),
  constraint fk_manual_mapping_closing_folder foreign key (closing_folder_id, tenant_id)
    references closing_folder (id, tenant_id),
  constraint chk_manual_mapping_account_code_non_blank check (btrim(account_code) <> ''),
  constraint chk_manual_mapping_target_code_non_blank check (btrim(target_code) <> ''),
  constraint uk_manual_mapping_tenant_closing_account unique (tenant_id, closing_folder_id, account_code)
);
