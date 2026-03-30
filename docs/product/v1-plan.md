# Plan V1 exécutable

## Objectif
Permettre à 5 fiduciaires pilotes d’exécuter un closing complet avec traçabilité, sécurité, revue et premier gain IA mesurable.

## Ordre des tranches
1. Foundation
2. Core identité / tenants / audit / closing
3. Import balance
4. Mapping manuel
5. Controls + financial summary ultra-synthétique
6. Workpapers + documents + revue
7. Exports audit-ready
8. Annexe minimale
9. IA mapping assisté
10. Hardening

## Principes V1
- workflow closing réel avant sophistication
- REST first
- IA contractuelle et bornée
- tests d’isolation cross-tenant bloquants
- RLS progressive
- observabilité dès le départ

## Handoff vivant

### Livré
- `001-foundation-bootstrap`
- `002-core-identity-tenancy-closing-audit-v1`
- `003-import-balance-v1`
- `005-manual-mapping-v1`
- `006-controls-v1`
- `007-financial-summary-v1`

### Décisions figées
- Le flux V1 livré reste `closing -> import -> mapping -> controls -> financial-summary`.
- Les endpoints canoniques restent sous `/api/closing-folders/...`.
- `controls-v1` et `financial-summary-v1` sont des read-models dérivés, `GET only`, sans persistance de résultat.
- `financial-summary-v1` est ultra-synthétique, non statutaire, non export final, et non conforme à une présentation CO détaillée.
- Les lectures sur `ARCHIVED` restent autorisées si le tenant et le RBAC sont valides.
- Les lectures `GET` sur `controls` et `financial-summary` n'écrivent aucun `audit_event`.
- Les tests PostgreSQL réels restent opt-in via `dbIntegrationTest`, sans Docker local requis.

### Validation PostgreSQL réelle locale
- La recette validée passe par `cloud-sql-proxy` et `dbIntegrationTest`.
- Référence d'exécution: `runbooks/local-dev.md`.
