alter table audit_event
  add column ip text,
  add column user_agent text;

create or replace function audit_event_prevent_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_event is append-only; % is not allowed', tg_op
    using errcode = '55000';
end;
$$;

create trigger trg_audit_event_prevent_update
before update on audit_event
for each row
execute function audit_event_prevent_mutation();

create trigger trg_audit_event_prevent_delete
before delete on audit_event
for each row
execute function audit_event_prevent_mutation();
