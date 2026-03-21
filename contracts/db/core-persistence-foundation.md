# Core Persistence Foundation

## Scope

Convention de base de donnees introduite par la spec 002 / Jalon 1, puis etendue au Jalon 3 pour l'audit append-only.

## Source of truth

- Schema executable : `backend/src/main/resources/db/migration/V1__core_persistence_foundation.sql`
- Extension audit Jalon 3 : `backend/src/main/resources/db/migration/V2__audit_event_append_only.sql`
- SGBD cible : PostgreSQL
- Outil de migration : Flyway

## Tables creees

- `tenant`
- `app_user`
- `tenant_membership`
- `closing_folder`
- `audit_event`

## Regles de modelisation

- Tous les noms SQL sont en `snake_case`.
- Les cles primaires sont en `uuid`.
- Les timestamps metier utilisent `timestamptz`.
- Les tables metier tenant-scopees portent un `tenant_id` non nul.
- Les indexes des tables tenant-scopees commencent par `tenant_id` pour preparer le scoping applicatif et la future RLS.
- `tenant` et `app_user` restent globaux ; ils ne portent pas de `tenant_id`.

## Scoping tenant

- La spec 002 demarre en `application scoping first`.
- Aucun repository metier ne devra lire/ecrire sans filtre tenant explicite.
- Aucune policy RLS n'est activee a ce stade.
- Le schema est prepare pour une activation RLS progressive ulterieure, sans refonte des tables coeur.

## Closing folder

- `closing_folder` est concu pour l'archivage logique.
- Le modele prevoit `archived_at` et `archived_by_user_id`.
- Le hard delete n'est pas le chemin nominal.

## Audit

- `audit_event` existe des le schema initial.
- La table est append-only par convention applicative et par protection DB contre `UPDATE` et `DELETE`.
- Les champs structurants presents des maintenant sont : tenant, acteur, action, ressource, tracage et `metadata` en `jsonb`.
- Les champs de correlation pour `audit_event` incluent `request_id`, `trace_id`, `ip` et `user_agent`.
