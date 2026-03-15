# Spec 002 — Core identité, tenancy, closing

## Objectif
Poser le socle de sécurité et d’isolation sans lequel le reste n’a pas de valeur.

## In scope
- tenants
- users
- rôles RBAC initiaux
- contexte tenant
- dossier de closing
- audit_event append-only
- tests cross-tenant

## Critères d’acceptation
- A ne voit pas B
- chaque action critique émet un audit_event
- RBAC minimum opérationnel
- dossier de closing CRUDable

## Tests requis
- intégration auth
- intégration cross-tenant
- tests audit_event

## Note Jalon 1
- PostgreSQL reste la base principale de la V1 ; Cloud SQL for PostgreSQL est la cible de prod.
- `./gradlew test` ne doit pas dépendre de Docker, Docker Compose ou Testcontainers.
- Les tests d’intégration base de données réels du Jalon 1 sont optionnels et s’exécutent uniquement avec une configuration PostgreSQL explicite.

## Note Jalon 2
- `X-Tenant-Id` est le header canonique de tenant actif ; il porte `tenant.id`.
- `app_user.external_subject` est lié au claim JWT `sub`, obligatoire.
- Les rôles RBAC V1 sont `ACCOUNTANT`, `REVIEWER`, `MANAGER`, `ADMIN`.
- Le backend valide toujours memberships et rôles contre `tenant_membership`, jamais contre le seul token.
- Sans `X-Tenant-Id`, `activeTenant` est auto-résolu seulement s’il existe exactement un membership actif ; sinon il reste `null`.
