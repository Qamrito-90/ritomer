# Exports V1 Persistence

## Scope

Convention de persistance introduite par la spec 013 pour stocker un `export_pack` immutable, tenant-scope, backend-only, derive des read-models de closing et des documents visibles depuis les current workpapers persistants.

## Source of truth

- Migration executable : `backend/src/main/resources/db/migration/V9__spec_013_exports_audit_ready_v1.sql`
- Contrat HTTP : `contracts/openapi/exports-api.yaml`
- SGBD cible : PostgreSQL
- Outil de migration : Flyway

## Tables creees

- `export_pack`

## Regles de modelisation

- `export_pack` est immutable en V1 : creation et lecture uniquement.
- `tenant_id` est obligatoire.
- `export_pack` est rattache a `closing_folder` via une FK composite tenant-scopee.
- `(tenant_id, closing_folder_id, idempotency_key)` est unique.
- `storage_backend` est borne a `LOCAL_FS | GCS`.
- `storage_object_key` reste persiste mais n'est jamais expose aux clients.
- `media_type` est toujours `application/zip`.
- `byte_size` est strictement positif.
- `checksum_sha256` est obligatoire et normalise en hex lowercase sur 64 caracteres.
- `source_fingerprint` est obligatoire et represente l'intention logique gelee arbitree durablement par `export_pack`.
- les indexes de lecture commencent par `tenant_id`.

## Colonnes metier

- `id`
- `tenant_id`
- `closing_folder_id`
- `idempotency_key`
- `source_fingerprint`
- `storage_backend`
- `storage_object_key`
- `file_name`
- `media_type`
- `byte_size`
- `checksum_sha256`
- `basis_import_version`
- `basis_taxonomy_version`
- `created_at`
- `created_by_user_id`

## Notes de persistance

- `export_pack` est l'unique memoire durable d'idempotence en V1.
- si une tentative echoue avant toute ligne `export_pack` persistee, la cle n'est pas reservee durablement.
- un replay reussi ne cree ni nouvelle ligne `export_pack`, ni nouvel objet storage, ni nouvel audit.
- si l'ecriture storage reussit mais que la persistance DB echoue, l'objet orphelin reste non reference en DB et inatteignable via l'API.
