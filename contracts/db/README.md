# Contrats DB

Ce dossier porte les artefacts contract-first liés à la base :
- DDL
- conventions multi-tenant
- policies RLS
- indexes critiques
- migrations de référence

Source exécutable du schéma :
- migrations Flyway dans `backend/src/main/resources/db/migration`

Conventions actives :
- voir `contracts/db/core-persistence-foundation.md`
- voir `contracts/db/import-balance-v1.md`
- voir `contracts/db/manual-mapping-v1.md`

Rappel :
- PostgreSQL est la source de vérité backend
- scoping applicatif d'abord, RLS plus tard
- aucune policy RLS n'est active dans la spec 002 / Jalon 1
