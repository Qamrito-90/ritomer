# Spec 005 — Manual mapping V1

## Objectif
Permettre le mapping manuel tenant-scoped d'une balance importée, avec projection lisible, audit exact et réutilisation par `accountCode` après réimport.

## In scope
- catalogue V1 des `targetCode`
- projection GET du dernier import
- création / mise à jour / suppression d'un mapping manuel
- réimport avec conservation en base et projection filtrée
- audit exact sur create / update / delete

## Critères d'acceptation
- GET retourne `200` même sans import, avec projection vide contractuelle
- PUT retourne `201` create, `200` update, `200` no-op
- DELETE retourne `204` supprimé, `204` déjà absent
- GET autorisé sur closing `ARCHIVED`, PUT et DELETE bloqués en `409`
- aucun accès cross-tenant
- seuls les mappings encore présents dans le dernier import sont projetés au GET
- chaque vrai changement émet exactement un `audit_event`

## Tests requis
- rail rapide : auth, tenant, RBAC, erreurs métier, create/update/no-op/delete, réimport, audit exact
- rail PostgreSQL réel : migration V5, table/contrainte unique, tenant-scoping, FK, persistance audit, rollback complet
