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
- `specs/done/004-frontend-foundation-design-system.md`
- `specs/done/005-manual-mapping-v1.md`
- `specs/done/006-controls-v1.md`
- `specs/done/007-financial-summary-v1.md`
- `specs/done/008-financial-rubric-taxonomy-v2.md`
- `specs/done/009-financial-statements-structured-v1.md`
- `specs/done/010-workpapers-v1.md`
- `specs/done/011-document-storage-and-evidence-files-v1.md`
- `specs/done/012-evidence-review-and-verification-v1.md`
- `specs/done/013-exports-audit-ready-v1.md`
- `specs/done/014-frontend-controls-readiness-cockpit-v1.md`
- `specs/done/015-frontend-closing-folders-entrypoint-v1.md`
- `specs/done/016-frontend-import-balance-v1.md`
- `specs/done/017-frontend-manual-mapping-v1.md`
- `specs/done/018-frontend-financial-summary-preview-v1.md`
- `specs/done/019-frontend-financial-statements-structured-preview-v1.md`
- `specs/done/020-frontend-workpapers-read-model-v1.md`
- `specs/done/021-frontend-workpapers-maker-update-v1.md`
- `specs/done/022-frontend-document-upload-only-v1.md`
- `specs/done/023-frontend-document-download-only-v1.md`
- `specs/done/024-frontend-workpapers-panel-extraction-v1.md`
- `specs/done/025-frontend-document-verification-decision-only-v1.md`
- `specs/done/026-frontend-workpapers-panel-decomposition-v1.md`

### Active
- `specs/active/027-annexe-minimale-v1.md`

### Decisions figees
- Le flux V1 livre est maintenant `closing -> import -> mapping -> controls -> financial-summary -> financial-statements-structured -> workpapers -> document-storage-and-evidence-files -> exports-audit-ready`.
- Les endpoints canoniques restent sous `/api/closing-folders/...`.
- `controls-v1`, `financial-summary-v1` et `financial-statements-structured-v1` sont des read-models derives, `GET only`, sans persistance de resultat.
- `financial-summary-v1` reste une preview ultra-synthetique, non statutaire, non export final, non conforme a une presentation CO detaillee, et peut rester partielle tant que le closing n'est pas `PREVIEW_READY`.
- `financial-statements-structured-v1` reste une `STRUCTURED_PREVIEW`, avec `isStatutory = false`, sans export final ni presentation CO detaillee complete, et n'expose aucun etat structure hors `PREVIEW_READY`.
- La taxonomie de mapping publiee coexiste desormais en V1 / V2 ; les codes V1 restent legacy et compatibles, `financial-summary-v1` agrege via `summaryBucketCode`, et `financial-statements-structured-v1` structure via `summaryBucketCode` puis `sectionCode` avec fallback legacy explicite quand aucune section detaillee n'existe.
- `workpapers-v1` est la premiere couche de justification persistante du flux V1. Elle s'appuie sur les anchors courants de `financial-statements-structured-v1`, sans recalculer la finance ni persister de resultat financier.
- `workpapers-v1` reste backend-only, REST-only, anchor-driven, tenant-scoped et audit-ready, avec un noyau borne a `workpaper + evidence metadata + maker/checker minimal`.
- `GET /workpapers` expose tous les anchors courants meme sans workpaper persiste, et separe les persistences stale dans `staleWorkpapers[]`.
- `workpapers-v1` ne couvre ni upload binaire, ni signed URLs, ni stockage objet, ni PDF, ni export pack final, ni commentaires threades, ni generation automatique ; `013-exports-audit-ready-v1` ferme ensuite le pack `ZIP` immutable, prive et telecharge backend-only.
- Les lectures `GET` sur `workpapers` n'ecrivent aucun `audit_event`; les lectures sur `ARCHIVED` restent autorisees, et les writes restent bloques si `controls.readiness != READY` ou sur closing `ARCHIVED`.
- `workpapers-v1` depend de `financials::access` pour ses anchors courants et n'introduit aucun couplage direct vers `imports` ou `mapping`.
- `document-storage-and-evidence-files-v1` et `evidence-review-and-verification-v1` etendent `workpapers-v1` sans creer de module transverse et apportent la premiere vraie couche binaire de pieces justificatives puis la premiere verification reviewer first-class sur ces documents.
- `document-storage-and-evidence-files-v1` garde `document` comme objet immutable first-class, sans duplication de `closing_folder_id`, derive via `workpaper`; `workpaper_evidence` reste la surface legacy metadata-only de `010-workpapers-v1`.
- `evidence-review-and-verification-v1` ajoute `document_verification` comme persistant unique `1:1` avec `document`, enrichit les read-models de `documents[]` avec l'etat reviewer et derive un `documentVerificationSummary` par workpaper.
- `document-storage-and-evidence-files-v1` enrichit `GET /workpapers` de facon additive avec `documents[]`, toujours present sur les anchors courants meme vide, et aussi present dans `staleWorkpapers[]`.
- `evidence-review-and-verification-v1` garde toutes les lectures `GET` lisibles sur current, stale et `ARCHIVED` sans `audit_event`, mais borne les writes reviewer document et reviewer workpaper a `controls.readiness = READY`, non `ARCHIVED`, current uniquement.
- `evidence-review-and-verification-v1` garde la decision finale reviewer sur `workpaper`, mais bloque `READY_FOR_REVIEW -> REVIEWED` tant que les documents attaches restent `UNVERIFIED`, sauf quand `documentsCount = 0`.
- `document-storage-and-evidence-files-v1` autorise les lectures sur current, stale et `ARCHIVED`, sans `audit_event` sur les `GET`; seul l'upload reussi ecrit `DOCUMENT.CREATED`.
- `022-frontend-document-upload-only-v1` ferme le premier upload frontend unitaire de document sur `/closing-folders/:closingFolderId`, strictement dans le bloc `Workpapers`, en gardant `GET /workpapers` comme read-model canonique avant et apres succes et en n'ajoutant que `POST /workpapers/{anchorCode}/documents`.
- `023-frontend-document-download-only-v1` ferme le premier download frontend unitaire de document sur `/closing-folders/:closingFolderId`, strictement dans le bloc `Workpapers`, en gardant `GET /workpapers` comme read-model canonique avant le clic, en n'ajoutant que `GET /documents/{documentId}/content`, et sans refresh apres succes ou echec.
- `024-frontend-workpapers-panel-extraction-v1` ferme l'extraction frontend stricte de la surface `Workpapers` dans `WorkpapersPanel`, sans nouvelle route produit, sans nouvel endpoint, sans changement backend ou OpenAPI, et sans reintroduire la logique locale Workpapers dans `router.tsx`.
- `025-frontend-document-verification-decision-only-v1` ferme la decision reviewer document unitaire dans `WorkpapersPanel`, sur les documents current eligibles deja visibles, en ajoutant seulement `POST /documents/{documentId}/verification-decision`, avec refresh local strict de `GET /workpapers` apres succes payload valide, sans decision reviewer workpaper, sans nouveau backend ni contrat OpenAPI.
- `evidence-review-and-verification-v1` ajoute `DOCUMENT.VERIFICATION_UPDATED` pour toute mutation reviewer reussie sur `document`, sans audit sur no-op, lecture, backfill ni creation automatique de la ligne initiale.
- `document-storage-and-evidence-files-v1` persiste les metadata en PostgreSQL, stocke le binaire en object storage prive, et impose un download backend-only sans signed URL publique.
- Le role de `document-storage-and-evidence-files-v1` dans la sequence V1 est de fermer le noyau evidence-first utile avant les couches futures d'export, d'annexe ou d'IA active.
- `exports-audit-ready-v1` ajoute le module proprietaire `exports`, une persistance immutable `export_pack`, un `ZIP` strictement deterministe et un replay idempotent durable borne par `export_pack` seul en V1.
- `exports-audit-ready-v1` assemble `controls`, `financial-summary`, `financial-statements-structured`, les current workpapers persistants et leurs documents visibles, sans exposition de `storage_object_key`, sans signed URL publique et sans audit sur les lectures.
- Les lectures sur `ARCHIVED` restent autorisees si le tenant et le RBAC sont valides.
- Les lectures `GET` sur `controls`, `financial-summary`, `financial-statements-structured` et `workpapers` n'ecrivent aucun `audit_event`.
- Les tests PostgreSQL reels restent opt-in via `dbIntegrationTest`, sans Docker local requis.

### Validation PostgreSQL reelle locale
- La recette validee passe par `cloud-sql-proxy` et `dbIntegrationTest`.
- Reference d'execution : `runbooks/local-dev.md`.
