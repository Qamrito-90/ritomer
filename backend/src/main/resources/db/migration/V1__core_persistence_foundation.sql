create table tenant (
  id uuid primary key,
  slug text not null unique,
  legal_name text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create table app_user (
  id uuid primary key,
  external_subject text not null unique,
  email text,
  display_name text,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create table tenant_membership (
  id uuid primary key,
  tenant_id uuid not null references tenant (id),
  user_id uuid not null references app_user (id),
  role_code text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  constraint uk_tenant_membership_tenant_user_role unique (tenant_id, user_id, role_code)
);

create index idx_tenant_membership_tenant_user on tenant_membership (tenant_id, user_id);
create index idx_tenant_membership_user on tenant_membership (user_id);

create table closing_folder (
  id uuid primary key,
  tenant_id uuid not null references tenant (id),
  name text not null,
  period_start_on date not null,
  period_end_on date not null,
  external_ref text,
  status text not null default 'DRAFT',
  archived_at timestamptz,
  archived_by_user_id uuid references app_user (id),
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  constraint chk_closing_folder_period_range check (period_end_on >= period_start_on)
);

create index idx_closing_folder_tenant_status on closing_folder (tenant_id, status);
create index idx_closing_folder_tenant_archive on closing_folder (tenant_id, archived_at);

create table audit_event (
  id uuid primary key,
  tenant_id uuid not null references tenant (id),
  occurred_at timestamptz not null default current_timestamp,
  actor_user_id uuid references app_user (id),
  actor_subject text,
  actor_roles jsonb not null default '[]'::jsonb,
  request_id text,
  trace_id text,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint chk_audit_event_actor_roles_array check (jsonb_typeof(actor_roles) = 'array'),
  constraint chk_audit_event_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index idx_audit_event_tenant_occurred_at on audit_event (tenant_id, occurred_at desc);
create index idx_audit_event_tenant_resource on audit_event (tenant_id, resource_type, resource_id);
