# Documents V1 Persistence

## Scope

Convention de persistance introduite par la spec 011 pour stocker de vraies pieces justificatives binaires, backend-only, tenant-scopees, rattachees a un `workpaper` persistant.

## Source of truth

- Migration executable : `backend/src/main/resources/db/migration/V7__spec_011_document_storage_and_evidence_files_v1.sql`
- Contrat HTTP : `contracts/openapi/documents-api.yaml`
- Contrat de lecture cockpit additif : `contracts/openapi/workpapers-api.yaml`
- SGBD cible : PostgreSQL
- Outil de migration : Flyway

## Table creee

- `document`

## Regles de modelisation

- `document` est immutable en V1 : creation et lecture uniquement.
- `tenant_id` est obligatoire.
- `closing_folder_id` n'est pas duplique dans `document`.
- Le rattachement au closing se derive toujours via `workpaper`.
- `document` est rattache a `workpaper` via une FK composite tenant-scopee `(workpaper_id, tenant_id)`.
- `storage_backend` est borne a `LOCAL_FS | GCS`.
- Le binaire n'est jamais stocke en base : seul `storage_object_key` est persiste.
- Les indexes de lecture commencent par `tenant_id`.
- `storage_object_key` est unique par tenant.
- `checksum_sha256` est obligatoire et normalise en hex lowercase sur 64 caracteres.
- `byte_size` est strictement positif.

## Colonnes metier

- `id`
- `tenant_id`
- `workpaper_id`
- `storage_backend`
- `storage_object_key`
- `file_name`
- `media_type`
- `byte_size`
- `checksum_sha256`
- `source_label`
- `document_date`
- `created_at`
- `created_by_user_id`

## Notes de persistance

- `document` est l'unique source de verite du vrai binaire.
- `workpaper_evidence` reste la surface legacy metadata-only de la spec 010.
- Il n'y a ni dual-write ni bridge de persistance entre `document` et `workpaper_evidence`.
- La lecture cockpit `GET /workpapers` expose `documents[]` de facon additive, mais cette vue n'introduit aucune duplication de persistance.
