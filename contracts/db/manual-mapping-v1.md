# Manual Mapping V1 Persistence

## Scope

Convention de persistance introduite par la spec 005 pour le mapping manuel V1 à partir du dernier import de balance.

## Source of truth

- Migration exécutable : `backend/src/main/resources/db/migration/V5__spec_005_manual_mapping_v1.sql`
- Contrat HTTP : `contracts/openapi/manual-mapping-api.yaml`
- Référentiel des cibles autorisées : `contracts/reference/manual-mapping-targets-v1.yaml`
- SGBD cible : PostgreSQL
- Outil de migration : Flyway

## Table créée

- `manual_mapping`

## Règles de modélisation

- `tenant_id` est obligatoire.
- `manual_mapping` est unique par `(tenant_id, closing_folder_id, account_code)`.
- `created_by_user_id` et `updated_by_user_id` référencent `app_user`.
- Le mapping est stocké par `(closing_folder_id, account_code)` et survit aux réimports.
- Un mapping dont `account_code` n'existe plus dans le dernier import peut rester en base.
- La projection GET ne montre que les mappings dont `account_code` existe encore dans le dernier import.
