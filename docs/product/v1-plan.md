# Plan V1 executable

## Objectif
Permettre a 5 fiduciaires pilotes d'executer un closing complet avec tracabilite, securite, revue et premier gain IA mesurable.

## Ordre des tranches
1. Foundation
2. Core identite / tenants / audit / closing
3. Import balance
4. Mapping manuel
5. Controls + previews financieres derivees
6. Workpapers + documents + revue
7. Exports audit-ready
8. Annexe minimale
9. IA mapping assiste
10. Hardening

## Principes V1
- workflow closing reel avant sophistication
- REST first
- IA contractuelle et bornee
- tests d'isolation cross-tenant bloquants
- RLS progressive
- observabilite des le depart

## Handoff vivant

### Livre
- `001-foundation-bootstrap`
- `002-core-identity-tenancy-closing-audit-v1`
- `003-import-balance-v1`
- `005-manual-mapping-v1`
- `006-controls-v1`
- `007-financial-summary-v1`
- `008-financial-rubric-taxonomy-v2`
- `009-financial-statements-structured-v1`

### Decisions figees
- Le flux V1 livre reste `closing -> import -> mapping -> controls -> financial-summary -> financial-statements-structured`.
- Les endpoints canoniques restent sous `/api/closing-folders/...`.
- `controls-v1`, `financial-summary-v1` et `financial-statements-structured-v1` sont des read-models derives, `GET only`, sans persistance de resultat.
- `financial-summary-v1` reste une preview ultra-synthetique, non statutaire, non export final, non conforme a une presentation CO detaillee, et peut rester partielle tant que le closing n'est pas `PREVIEW_READY`.
- `financial-statements-structured-v1` reste une `STRUCTURED_PREVIEW`, avec `isStatutory = false`, sans export final ni presentation CO detaillee complete, et n'expose aucun etat structure hors `PREVIEW_READY`.
- La taxonomie de mapping publiee coexiste desormais en V1 / V2 ; les codes V1 restent legacy et compatibles, `financial-summary-v1` agrege via `summaryBucketCode`, et `financial-statements-structured-v1` structure via `summaryBucketCode` puis `sectionCode` avec fallback legacy explicite quand aucune section detaillee n'existe.
- Les lectures sur `ARCHIVED` restent autorisees si le tenant et le RBAC sont valides.
- Les lectures `GET` sur `controls`, `financial-summary` et `financial-statements-structured` n'ecrivent aucun `audit_event`.
- Les tests PostgreSQL reels restent opt-in via `dbIntegrationTest`, sans Docker local requis.

### Validation PostgreSQL reelle locale
- La recette validee passe par `cloud-sql-proxy` et `dbIntegrationTest`.
- Reference d'execution : `runbooks/local-dev.md`.
