# Import Balance V1 Persistence

## Scope

Convention de persistance introduite par la spec 003 pour l'import minimal de balance comptable V1.

## Source of truth

- Migration exécutable : `backend/src/main/resources/db/migration/V4__spec_003_import_balance_v1.sql`
- Contrat HTTP : `contracts/openapi/import-balance-api.yaml`
- SGBD cible : PostgreSQL
- Outil de migration : Flyway

## Tables créées

- `balance_import`
- `balance_import_line`

## Règles de modélisation

- `tenant_id` est obligatoire sur les 2 tables.
- Le CSV brut n'est jamais stocké.
- `balance_import.version` est unique par `(tenant_id, closing_folder_id)`.
- `balance_import_line.account_code` est unique par `(tenant_id, balance_import_id)`.
- Les montants sont persistés en `numeric`.
- `balance_import.total_debit` et `balance_import.total_credit` doivent rester équilibrés.

## Concurrence

- Le calcul de version se fait dans une transaction unique.
- Les imports concurrents d'un même `closing_folder` sont sérialisés via verrou transactionnel sur `closing_folder`.
- La contrainte unique `(tenant_id, closing_folder_id, version)` reste la dernière barrière de sécurité.

## Lecture et diff

- Les lignes normalisées sont persistées pour relecture et calcul du diff.
- La version `1` expose un diff utile avec `previousVersion = null`, toutes les lignes en `added`, et aucun `removed`/`changed`.
