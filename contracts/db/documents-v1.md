# Documents V1 Persistence

## Scope

Convention de persistance introduite par les specs 011 et 012 pour stocker de vraies pieces justificatives binaires, backend-only, tenant-scopees, rattachees a un `workpaper` persistant, puis pour persister une verification reviewer first-class par document.

## Source of truth

- Migrations executables :
  - `backend/src/main/resources/db/migration/V7__spec_011_document_storage_and_evidence_files_v1.sql`
  - `backend/src/main/resources/db/migration/V8__spec_012_evidence_review_and_verification_v1.sql`
- Contrat HTTP : `contracts/openapi/documents-api.yaml`
- Contrat de lecture cockpit additif : `contracts/openapi/workpapers-api.yaml`
- SGBD cible : PostgreSQL
- Outil de migration : Flyway

## Tables creees

- `document`
- `document_verification`

## Regles de modelisation

- `document` est immutable en V1 : creation et lecture uniquement.
- `document_verification` est le seul persistant reviewer-side ajoute par la spec 012.
- `tenant_id` est obligatoire.
- `closing_folder_id` n'est pas duplique dans `document`.
- Le rattachement au closing se derive toujours via `workpaper`.
- `document` est rattache a `workpaper` via une FK composite tenant-scopee `(workpaper_id, tenant_id)`.
- `document_verification` est rattache a `document` via une FK composite tenant-scopee `(document_id, tenant_id)`.
- `storage_backend` est borne a `LOCAL_FS | GCS`.
- Le binaire n'est jamais stocke en base : seul `storage_object_key` est persiste.
- Les indexes de lecture commencent par `tenant_id`.
- `storage_object_key` est unique par tenant.
- `checksum_sha256` est obligatoire et normalise en hex lowercase sur 64 caracteres.
- `byte_size` est strictement positif.
- Chaque `document` a exactement une ligne `document_verification`.
- La ligne `document_verification` est backfillee pour les documents existants et creee dans la meme transaction DB que l'insert de chaque nouveau `document`.
- L'etat initial de `document_verification` est toujours `UNVERIFIED`, avec `review_comment = null`, `reviewed_at = null`, `reviewed_by_user_id = null`.

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

### `document_verification`

- `document_id`
- `tenant_id`
- `verification_status`
- `review_comment`
- `reviewed_at`
- `reviewed_by_user_id`

Contraintes :

- relation stricte `1:1` avec `document`
- `verification_status` borne a `UNVERIFIED | VERIFIED | REJECTED`
- `REJECTED` exige un `review_comment` non blank et des metadonnees reviewer non nulles
- `VERIFIED` interdit `review_comment` et exige `reviewed_at` / `reviewed_by_user_id`
- `UNVERIFIED` interdit `review_comment`, `reviewed_at`, `reviewed_by_user_id`
- les indexes commencent par `tenant_id`

## Notes de persistance

- `document` est l'unique source de verite du vrai binaire.
- `document_verification` est l'unique source de verite de la decision reviewer sur un document.
- `workpaper_evidence` reste la surface legacy metadata-only de la spec 010.
- Il n'y a ni dual-write ni bridge de persistance entre `document` et `workpaper_evidence`.
- La lecture cockpit `GET /workpapers` expose `documents[]` de facon additive, mais cette vue n'introduit aucune duplication de persistance.
- `GET /workpapers` expose aussi un `documentVerificationSummary` derive par workpaper, sans table additionnelle ni persistance de resume.
