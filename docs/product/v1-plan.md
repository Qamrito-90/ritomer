# Plan V1 executable

## Objectif
Permettre a 5 fiduciaires pilotes d'executer un closing complet avec tracabilite, securite, revue et premier gain IA mesurable.

## Ordre des tranches
1. Foundation
2. Core identite / tenants / audit / closing
3. Import balance
4. Mapping manuel
5. Controls + previews financieres derivees
6. Workpapers V1
7. Document storage and evidence files V1
8. Exports audit-ready
9. Annexe minimale
10. IA mapping assiste
11. Hardening

## Principes V1
- workflow closing reel avant sophistication
- REST first
- IA contractuelle et bornee
- tests d'isolation cross-tenant bloquants
- RLS progressive
- observabilite des le depart

## Handoff vivant

### Livre
- `specs/done/001-foundation-bootstrap.md`
- `specs/done/002-core-identity-tenancy-closing.md`
- `specs/done/003-import-balance-v1.md`
- `specs/done/005-manual-mapping-v1.md`
- `specs/done/006-controls-v1.md`
- `specs/done/007-financial-summary-v1.md`
- `specs/done/008-financial-rubric-taxonomy-v2.md`
- `specs/done/009-financial-statements-structured-v1.md`
- `specs/done/010-workpapers-v1.md`
- `specs/done/011-document-storage-and-evidence-files-v1.md`

### Decisions figees
- Le flux V1 livre est maintenant `closing -> import -> mapping -> controls -> financial-summary -> financial-statements-structured -> workpapers -> document-storage-and-evidence-files`.
- Les endpoints canoniques restent sous `/api/closing-folders/...`.
- `controls-v1`, `financial-summary-v1` et `financial-statements-structured-v1` sont des read-models derives, `GET only`, sans persistance de resultat.
- `financial-summary-v1` reste une preview ultra-synthetique, non statutaire, non export final, non conforme a une presentation CO detaillee, et peut rester partielle tant que le closing n'est pas `PREVIEW_READY`.
- `financial-statements-structured-v1` reste une `STRUCTURED_PREVIEW`, avec `isStatutory = false`, sans export final ni presentation CO detaillee complete, et n'expose aucun etat structure hors `PREVIEW_READY`.
- La taxonomie de mapping publiee coexiste desormais en V1 / V2 ; les codes V1 restent legacy et compatibles, `financial-summary-v1` agrege via `summaryBucketCode`, et `financial-statements-structured-v1` structure via `summaryBucketCode` puis `sectionCode` avec fallback legacy explicite quand aucune section detaillee n'existe.
- `workpapers-v1` est la premiere couche de justification persistante du flux V1. Elle s'appuie sur les anchors courants de `financial-statements-structured-v1`, sans recalculer la finance ni persister de resultat financier.
- `workpapers-v1` reste backend-only, REST-only, anchor-driven, tenant-scoped et audit-ready, avec un noyau borne a `workpaper + evidence metadata + maker/checker minimal`.
- `GET /workpapers` expose tous les anchors courants meme sans workpaper persiste, et separe les persistences stale dans `staleWorkpapers[]`.
- `workpapers-v1` ne couvre ni upload binaire, ni signed URLs, ni stockage objet, ni PDF, ni export pack final, ni commentaires threades, ni generation automatique.
- Les lectures `GET` sur `workpapers` n'ecrivent aucun `audit_event`; les lectures sur `ARCHIVED` restent autorisees, et les writes restent bloques hors `PREVIEW_READY` ou sur closing `ARCHIVED`.
- `workpapers-v1` depend de `financials::access` pour ses anchors courants et n'introduit aucun couplage direct vers `imports` ou `mapping`.
- `document-storage-and-evidence-files-v1` etend `workpapers-v1` sans creer de module transverse et apporte la premiere vraie couche binaire de pieces justificatives du flux V1.
- `document-storage-and-evidence-files-v1` garde `document` comme objet immutable first-class, sans duplication de `closing_folder_id`, derive via `workpaper`; `workpaper_evidence` reste la surface legacy metadata-only de `010-workpapers-v1`.
- `document-storage-and-evidence-files-v1` enrichit `GET /workpapers` de facon additive avec `documents[]`, toujours present sur les anchors courants meme vide, et aussi present dans `staleWorkpapers[]`.
- `document-storage-and-evidence-files-v1` autorise les lectures sur current, stale et `ARCHIVED`, sans `audit_event` sur les `GET`; seul l'upload reussi ecrit `DOCUMENT.CREATED`.
- `document-storage-and-evidence-files-v1` persiste les metadata en PostgreSQL, stocke le binaire en object storage prive, et impose un download backend-only sans signed URL publique.
- Le role de `document-storage-and-evidence-files-v1` dans la sequence V1 est de fermer le noyau evidence-first utile avant les couches futures d'export, d'annexe ou d'IA active.
- Les lectures sur `ARCHIVED` restent autorisees si le tenant et le RBAC sont valides.
- Les lectures `GET` sur `controls`, `financial-summary`, `financial-statements-structured` et `workpapers` n'ecrivent aucun `audit_event`.
- Les tests PostgreSQL reels restent opt-in via `dbIntegrationTest`, sans Docker local requis.

### Validation PostgreSQL reelle locale
- La recette validee passe par `cloud-sql-proxy` et `dbIntegrationTest`.
- Reference d'execution : `runbooks/local-dev.md`.
