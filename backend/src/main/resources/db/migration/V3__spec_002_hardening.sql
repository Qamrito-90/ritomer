alter table app_user
  add constraint chk_app_user_status_allowed
  check (status in ('ACTIVE', 'INACTIVE'));

alter table tenant
  add constraint chk_tenant_status_allowed
  check (status in ('ACTIVE', 'INACTIVE'));

alter table tenant_membership
  add constraint chk_tenant_membership_status_allowed
  check (status in ('ACTIVE', 'INACTIVE'));

alter table tenant_membership
  add constraint chk_tenant_membership_role_code_allowed
  check (role_code in ('ACCOUNTANT', 'REVIEWER', 'MANAGER', 'ADMIN'));

alter table closing_folder
  add constraint chk_closing_folder_archive_consistency
  check (
    (status = 'DRAFT' and archived_at is null and archived_by_user_id is null)
    or (status = 'ARCHIVED' and archived_at is not null and archived_by_user_id is not null)
  );

alter table audit_event
  alter column request_id set not null;
