# Core Persistence Foundation

## Scope

Convention de base de données introduite par la spec 002 / Jalon 1.

## Source of truth

- Schéma exécutable : `backend/src/main/resources/db/migration/V1__core_persistence_foundation.sql`
- SGBD cible : PostgreSQL
- Outil de migration : Flyway

## Tables créées

- `tenant`
- `app_user`
- `tenant_membership`
- `closing_folder`
- `audit_event`

## Règles de modélisation

- Tous les noms SQL sont en `snake_case`.
- Les clés primaires sont en `uuid`.
- Les timestamps métier utilisent `timestamptz`.
- Les tables métier tenant-scopées portent un `tenant_id` non nul.
- Les indexes des tables tenant-scopées commencent par `tenant_id` pour préparer le scoping applicatif et la future RLS.
- `tenant` et `app_user` restent globaux ; ils ne portent pas de `tenant_id`.

## Scoping tenant

- La spec 002 démarre en `application scoping first`.
- Aucun repository métier ne devra lire/écrire sans filtre tenant explicite.
- Aucune policy RLS n'est activée à ce stade.
- Le schéma est préparé pour une activation RLS progressive ultérieure, sans refonte des tables cœur.

## Closing folder

- `closing_folder` est conçu pour l'archivage logique.
- Le modèle prévoit `archived_at` et `archived_by_user_id`.
- Le hard delete n'est pas le chemin nominal.

## Audit

- `audit_event` existe dès le schéma initial.
- La table est append-only par convention applicative.
- Les champs structurants présents dès maintenant sont : tenant, acteur, action, ressource, traçage et `metadata` en `jsonb`.
