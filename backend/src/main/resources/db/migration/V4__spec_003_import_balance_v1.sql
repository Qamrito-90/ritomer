alter table closing_folder
  add constraint uk_closing_folder_id_tenant unique (id, tenant_id);

create table balance_import (
  id uuid primary key,
  tenant_id uuid not null references tenant (id),
  closing_folder_id uuid not null,
  version integer not null,
  source_file_name text not null,
  imported_at timestamptz not null,
  imported_by_user_id uuid not null references app_user (id),
  row_count integer not null,
  total_debit numeric not null,
  total_credit numeric not null,
  constraint fk_balance_import_closing_folder foreign key (closing_folder_id, tenant_id)
    references closing_folder (id, tenant_id),
  constraint chk_balance_import_version_positive check (version > 0),
  constraint chk_balance_import_row_count_positive check (row_count > 0),
  constraint chk_balance_import_total_debit_non_negative check (total_debit >= 0),
  constraint chk_balance_import_total_credit_non_negative check (total_credit >= 0),
  constraint chk_balance_import_balanced_totals check (total_debit = total_credit),
  constraint uk_balance_import_tenant_closing_version unique (tenant_id, closing_folder_id, version),
  constraint uk_balance_import_id_tenant unique (id, tenant_id)
);

create index idx_balance_import_tenant_closing_version
  on balance_import (tenant_id, closing_folder_id, version desc);

create table balance_import_line (
  id uuid primary key,
  tenant_id uuid not null references tenant (id),
  balance_import_id uuid not null,
  line_no integer not null,
  account_code text not null,
  account_label text not null,
  debit numeric not null,
  credit numeric not null,
  constraint fk_balance_import_line_balance_import foreign key (balance_import_id, tenant_id)
    references balance_import (id, tenant_id)
    on delete cascade,
  constraint chk_balance_import_line_line_no_positive check (line_no > 0),
  constraint chk_balance_import_line_debit_non_negative check (debit >= 0),
  constraint chk_balance_import_line_credit_non_negative check (credit >= 0),
  constraint uk_balance_import_line_tenant_import_account unique (tenant_id, balance_import_id, account_code)
);

create index idx_balance_import_line_tenant_import_line
  on balance_import_line (tenant_id, balance_import_id, line_no);
