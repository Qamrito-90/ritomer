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
