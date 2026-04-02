# Workpapers V1 Persistence

## Scope

Convention de persistance introduite par la spec 010 pour les workpapers backend-only ancres sur la structure financiere courante, avec metadata de pieces justificatives et workflow maker/checker minimal.

## Source of truth

- Migration executable : `backend/src/main/resources/db/migration/V6__spec_010_workpapers_v1.sql`
- Contrat HTTP : `contracts/openapi/workpapers-api.yaml`
- SGBD cible : PostgreSQL
- Outil de migration : Flyway

## Tables creees

- `workpaper`
- `workpaper_evidence`

## Regles de modelisation

- `tenant_id` est obligatoire sur les 2 tables.
- `workpaper` est unique par `(tenant_id, closing_folder_id, anchor_code)`.
- `workpaper` est rattache a `closing_folder` via une FK composite tenant-scopee.
- `workpaper_evidence` est rattache a `workpaper` via une FK composite tenant-scopee avec `on delete cascade`.
- `workpaper_evidence.position` est unique par `(tenant_id, workpaper_id)`.
- Les indexes de lecture commencent par `tenant_id` pour respecter l'isolation et les filtres applicatifs V1.
- Les calculs financiers ne sont jamais persistes dans ces tables.
- `basis_import_version` et `basis_taxonomy_version` capturent la base structurelle a la date de la mutation reussie.
- `review_comment` reste le dernier commentaire reviewer ; l'historique detaille reste dans `audit_event`.

## Etats et enums persistes

### `workpaper.status`

- `DRAFT`
- `READY_FOR_REVIEW`
- `CHANGES_REQUESTED`
- `REVIEWED`

### `workpaper.statement_kind`

- `BALANCE_SHEET`
- `INCOME_STATEMENT`

### `workpaper.breakdown_type`

- `SECTION`
- `LEGACY_BUCKET_FALLBACK`

### `workpaper_evidence.verification_status`

- `UNVERIFIED`
- `VERIFIED`
- `REJECTED`

## Notes de persistance

- les pieces justificatives restent des metadata only en V1
- aucun binaire, URL signee ou stockage objet n'est introduit
- le checksum SHA-256, s'il est present, reste normalise en hex lowercase sur 64 caracteres
