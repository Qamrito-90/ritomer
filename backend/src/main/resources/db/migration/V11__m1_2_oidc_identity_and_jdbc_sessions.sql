-- Additive M1.2 schema. No provisioning and no changes to V1-V10.
create table oidc_identity_binding (
  id uuid primary key default gen_random_uuid(),
  issuer text not null check (length(issuer) between 1 and 255),
  subject text not null check (length(subject) between 1 and 255),
  app_user_id uuid not null references app_user(id),
  active boolean not null default true,
  constraint uk_oidc_identity unique (issuer, subject)
);

-- The opaque binding reference is also its revocation generation.
-- Administrative identity/revocation changes can never revive an old session.
create function rotate_oidc_binding_reference() returns trigger language plpgsql as $$
begin
  if row(new.issuer, new.subject, new.app_user_id, new.active)
     is distinct from row(old.issuer, old.subject, old.app_user_id, old.active) then
    new.id := gen_random_uuid();
  end if;
  return new;
end;
$$;
create trigger oidc_binding_reference_changed before update on oidc_identity_binding
for each row execute function rotate_oidc_binding_reference();

-- Spring Session 3.5.5 PostgreSQL schema; Flyway owns creation.
create table spring_session (
  primary_id char(36) not null,
  session_id char(36) not null,
  creation_time bigint not null,
  last_access_time bigint not null,
  max_inactive_interval int not null,
  expiry_time bigint not null,
  principal_name varchar(100),
  constraint spring_session_pk primary key (primary_id)
);
create unique index spring_session_ix1 on spring_session (session_id);
create index spring_session_ix2 on spring_session (expiry_time);
create index spring_session_ix3 on spring_session (principal_name);
create table spring_session_attributes (
  session_primary_id char(36) not null,
  attribute_name varchar(200) not null,
  attribute_bytes bytea not null,
  constraint spring_session_attributes_pk primary key (session_primary_id, attribute_name),
  constraint spring_session_attributes_fk foreign key (session_primary_id)
    references spring_session(primary_id) on delete cascade
);

-- Transient authorization requests are consumed atomically, outside session attributes.
-- Only digests of state and anonymous SID are lookup keys; no provider tokens are stored.
create table oidc_authorization_transaction (
  state_hash char(64) primary key,
  session_hash char(64) not null unique,
  nonce varchar(256) not null check (length(nonce) > 0),
  code_verifier varchar(128) not null check (length(code_verifier) between 43 and 128),
  return_path varchar(100) not null,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  constraint oidc_transaction_ttl check (
    expires_at > created_at and expires_at <= created_at + interval '5 minutes'
  )
);
create index oidc_transaction_expiry on oidc_authorization_transaction(expires_at);

