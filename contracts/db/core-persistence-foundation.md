# Core Persistence Foundation

## Scope

Convention de base de donnees introduite par la spec 002 / Jalon 1, puis etendue au Jalon 3 pour l'audit append-only et au Jalon 5 pour le hardening final.

## Source of truth

- Schema executable : `backend/src/main/resources/db/migration/V1__core_persistence_foundation.sql`
- Extension audit Jalon 3 : `backend/src/main/resources/db/migration/V2__audit_event_append_only.sql`
- Hardening final spec 002 / Jalon 5 : `backend/src/main/resources/db/migration/V3__spec_002_hardening.sql`
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
- `app_user.status`, `tenant.status` et `tenant_membership.status` sont bornes aux valeurs autorisees de la V1.
- `tenant_membership.role_code` est borne a `ACCOUNTANT`, `REVIEWER`, `MANAGER`, `ADMIN`.

## Scoping tenant

- La spec 002 demarre en `application scoping first`.
- Aucun repository metier ne devra lire/ecrire sans filtre tenant explicite.
- Aucune policy RLS n'est activee a ce stade.
- Le schema est prepare pour une activation RLS progressive ulterieure, sans refonte des tables coeur.

## Closing folder

- `closing_folder` est concu pour l'archivage logique.
- Le modele prevoit `archived_at` et `archived_by_user_id`.
- Le hard delete n'est pas le chemin nominal.
- `closing_folder.status` doit rester coherent avec `archived_at` et `archived_by_user_id`.

## Audit

- `audit_event` existe des le schema initial.
- La table est append-only par convention applicative et par protection DB contre `UPDATE` et `DELETE`.
- Les champs structurants presents des maintenant sont : tenant, acteur, action, ressource, tracage et `metadata` en `jsonb`.
- Les champs de correlation pour `audit_event` incluent `request_id`, `trace_id`, `ip` et `user_agent`.
- `audit_event.request_id` est obligatoire en base a partir du Jalon 5.
