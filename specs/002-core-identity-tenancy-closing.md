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
