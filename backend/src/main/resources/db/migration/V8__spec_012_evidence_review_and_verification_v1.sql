alter table document
  add constraint uk_document_id_tenant unique (id, tenant_id);

create table document_verification (
  document_id uuid primary key,
  tenant_id uuid not null references tenant (id),
  verification_status text not null,
  review_comment text,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references app_user (id),
  constraint fk_document_verification_document foreign key (document_id, tenant_id)
    references document (id, tenant_id)
    on delete cascade,
  constraint chk_document_verification_status_allowed check (
    verification_status in ('UNVERIFIED', 'VERIFIED', 'REJECTED')
  ),
  constraint chk_document_verification_review_comment_non_blank check (
    review_comment is null or btrim(review_comment) <> ''
  ),
  constraint chk_document_verification_state_consistency check (
    (
      verification_status = 'UNVERIFIED'
      and review_comment is null
      and reviewed_at is null
      and reviewed_by_user_id is null
    )
    or (
      verification_status = 'VERIFIED'
      and review_comment is null
      and reviewed_at is not null
      and reviewed_by_user_id is not null
    )
    or (
      verification_status = 'REJECTED'
      and review_comment is not null
      and reviewed_at is not null
      and reviewed_by_user_id is not null
    )
  )
);

create index idx_document_verification_tenant_document
  on document_verification (tenant_id, document_id);

create index idx_document_verification_tenant_status
  on document_verification (tenant_id, verification_status);

insert into document_verification (
  document_id,
  tenant_id,
  verification_status,
  review_comment,
  reviewed_at,
  reviewed_by_user_id
)
select id,
       tenant_id,
       'UNVERIFIED',
       null,
       null,
       null
from document;
