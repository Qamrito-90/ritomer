# 026 - Frontend workpapers panel decomposition v1

## Status
Active

## Role de cette spec

Cette spec devient la verite normative de `026`.

Elle borne le plus petit chantier de decompression frontend apres `025` pour reduire le cout de changement de `frontend/src/app/workpapers-panel.tsx`, sans changer :

- les routes
- les endpoints
- les textes visibles
- les comportements metier
- les contrats
- la sequence reseau globale
- la verite produit deja figee par `020`, `021`, `022`, `023`, `024` et `025`

`026` n'ouvre aucune capacite produit. `026` ne cree aucune nouvelle route, ne modifie aucun backend, ne modifie aucun contrat OpenAPI, ne propose pas GraphQL et n'active aucune IA.

## Sources de verite relues

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ai-cadrage-v1.md`
- `docs/adr/0001-monolithe-modulaire.md`
- `docs/adr/0002-rest-first-graphql-later.md`
- `docs/adr/0003-ai-gateway-evidence-first.md`
- `docs/adr/0004-multi-tenancy-audit-rls-progressive.md`
- `docs/adr/0005-front-ui-stack-and-design-system.md`
- `docs/adr/0006-postgresql-cloud-sql-no-docker-v1.md`
- `docs/product/v1-plan.md`
- `specs/done/025-frontend-document-verification-decision-only-v1.md`
- `specs/done/024-frontend-workpapers-panel-extraction-v1.md`
- `specs/done/023-frontend-document-download-only-v1.md`
- `specs/done/022-frontend-document-upload-only-v1.md`
- `specs/done/021-frontend-workpapers-maker-update-v1.md`
- `frontend/src/app/router.tsx`
- `frontend/src/app/workpapers-panel.tsx`
- `frontend/src/app/workpapers-panel.test.tsx`
- `frontend/src/app/router.workpapers.test.tsx`
- `frontend/src/lib/api/workpapers.ts`
- `frontend/src/lib/api/workpapers.test.ts`
- `frontend/src/lib/api/http.ts`
- `docs/ui/ui-foundations-v1.md`
- `README.md`
- `docs/vision/ux.md`
- `docs/vision/architecture.md`
- `docs/vision/ai-native.md`
- `docs/playbooks/ux.md`
- `docs/playbooks/architecture.md`
- `docs/playbooks/ai.md`

## Constats repo

### Prouve par le repo

- `025` est ferme dans `specs/done/025-frontend-document-verification-decision-only-v1.md`.
- `frontend/src/app/router.tsx` importe `WorkpapersPanel` et reste deja au niveau orchestration de page.
- `router.tsx` charge toujours `GET /workpapers` dans le `Promise.all` initial avec `controls`, `mappings/manual`, `financial-summary` et `financial-statements/structured`.
- `router.tsx` rend `WorkpapersPanel` avec `activeTenant`, `closingFolder`, `closingFolderId`, `effectiveRoles`, `initialState` et une `key` tenant/dossier.
- `frontend/src/lib/api/workpapers.ts` reste la couture API principale pour :
  - `GET /workpapers`
  - `PUT /workpapers/{anchorCode}`
  - `POST /workpapers/{anchorCode}/documents`
  - `GET /documents/{documentId}/content`
  - `POST /documents/{documentId}/verification-decision`
- `frontend/src/lib/api/http.ts` garde la convention `DEFAULT_REQUEST_TIMEOUT_MS = 5000`.
- `frontend/src/app/workpapers-panel.tsx` fait actuellement `2533` lignes et concentre :
  - les types d'etat UI locaux
  - les roles et guards locaux
  - les drafts maker, upload et decision reviewer document
  - les handlers maker, upload, download et decision reviewer document
  - les refreshs locaux `GET /workpapers`
  - le rendu `WorkpapersSlot`, `WorkpapersNominalBlocks`, `WorkpaperCard`, `WorkpaperMutationStatus`
  - les helpers de status lines, validation upload, evidence payload, recherche document, UUID, nom de fichier, MIME et `Content-Disposition`
  - le mecanisme navigateur de download par object URL
- `frontend/src/app/workpapers-panel.test.tsx` fait actuellement `1813` lignes et couvre des comportements locaux maker, upload, download et decision reviewer document.
- `frontend/src/app/router.workpapers.test.tsx` fait actuellement `290` lignes et porte deja un smoke minimal sur l'ordre des blocs et le scope reseau initial.
- `frontend/src/lib/api/workpapers.test.ts` fait actuellement `1277` lignes et reste la suite contrat/API de `workpapers.ts`.

### Plausible mais non prouve

- Extraire un hook local prive pourrait etre utile plus tard, mais le repo ne prouve pas qu'il soit necessaire pour fermer `026`.
- Introduire un reducer local pourrait reduire certains handlers, mais le repo ne prouve pas qu'il soit necessaire pour cette decompression minimale.
- Decomposer les autres blocs de `router.tsx` pourrait etre utile plus tard, mais `026` concerne strictement `WorkpapersPanel`.

### Bloquant

- Aucun bloquant repo n'est prouve pour cadrer `026`.
- Le risque principal est une derive de refactor qui changerait les textes, le rendu, les endpoints ou la sequence reseau. `026` resout ce risque en imposant des coutures privees pures et des tests locaux.

## Decisions fermees

- `026` conserve `router.tsx` comme orchestrateur de page.
- `026` conserve `frontend/src/lib/api/workpapers.ts` comme couture API principale et unique de `Workpapers`.
- `026` conserve `frontend/src/app/workpapers-panel.tsx` comme point d'entree public de la surface `Workpapers`.
- `026` autorise seulement des coutures privees sous `frontend/src/app/workpapers-panel/`.
- `026` interdit tout import direct de ces coutures privees depuis `router.tsx`.
- `026` interdit tout import de ces coutures privees depuis un autre domaine frontend hors tests.
- `026` ne cree aucun `index.ts` sous `frontend/src/app/workpapers-panel/` afin que `router.tsx` continue d'importer le fichier public `./workpapers-panel`.
- `026` ne change aucun libelle visible, message d'etat, CTA, ordre de bloc, ordre de ligne document ou condition de visibilite.
- `026` ne change aucune regle maker, upload, download ou reviewer document.
- `026` ne change pas le refresh local strict `GET /workpapers` apres succes maker, upload ou decision document.
- `026` ne change pas l'absence de refresh apres download document.
- `026` ne change pas la sequence reseau initiale de `/closing-folders/:closingFolderId`.
- `026` ne deplace aucune logique Workpapers dans `router.tsx`.

## In scope exact

- decomposer `frontend/src/app/workpapers-panel.tsx` en coutures privees locales au scope Workpapers
- sortir les composants de rendu locaux volumineux hors du fichier public
- sortir les helpers purs de roles, drafts, validations, status lines, recherche document, UUID, evidence payload, upload et decision document
- sortir le mecanisme navigateur de download dans une couture privee locale sans fetch
- relocaliser les tests purs au plus pres des helpers extraits
- garder un smoke route-level minimal dans `frontend/src/app/router.workpapers.test.tsx`
- garder les tests API dans `frontend/src/lib/api/workpapers.test.ts`
- garder les tests d'interactions du panel au niveau `WorkpapersPanel`

## Out of scope exact

- toute nouvelle route produit
- tout nouvel endpoint
- tout changement backend
- tout changement OpenAPI
- toute modification de `contracts/**`
- toute modification de `backend/**`
- tout changement visible de wording
- tout changement de comportement maker / upload / download / reviewer document
- toute decision reviewer workpaper
- tout endpoint `POST /workpapers/{anchorCode}/review-decision`
- tout endpoint `exports`
- tout endpoint import versions ou diff previous
- GraphQL
- toute IA active
- tout store global
- tout cache global
- Redux, Zustand, React Query ou equivalent
- tout hook global transversal
- tout contexte React metier global `Workpapers`
- toute reintroduction de drafts, handlers, helpers ou refreshs Workpapers dans `router.tsx`

## Repartition exacte des responsabilites

### Ce qui reste dans `router.tsx`

- les definitions de routes
- `ClosingFoldersEntrypointRoute`
- `ClosingFolderRoute`
- le shell global `AppShell`
- `GET /api/me`
- `GET /api/closing-folders/{id}`
- l'orchestration initiale parallele des blocs deja existants
- les etats et handlers des blocs non `Workpapers`
- l'ordre final de composition de la page
- l'import public unique `WorkpapersPanel` depuis `./workpapers-panel`
- la transmission au `WorkpapersPanel` de :
  - `closingFolderId`
  - `activeTenant`
  - `effectiveRoles`
  - `closingFolder`
  - `initialState = workpapersState`
  - `key = tenantId + closingFolder.id`

### Ce qui reste dans `workpapers.ts`

- les schemas `zod` des read-models et payloads Workpapers
- les types API exportes utiles au panel
- `loadWorkpapersShellState`
- `upsertWorkpaper`
- `uploadWorkpaperDocument`
- `downloadWorkpaperDocument`
- `reviewDocumentVerificationDecision`
- les classifications transport / timeout / payload / HTTP
- les raffinements d'erreurs backend deja prouves
- la convention `DEFAULT_REQUEST_TIMEOUT_MS = 5000`

`026` ne doit ajouter aucune fonction API et ne doit dupliquer aucune logique d'appel HTTP hors de `workpapers.ts`.

### Ce qui reste dans `workpapers-panel.tsx`

- l'export public `WorkpapersPanel`
- le type public local `WorkpapersPanelProps`, sauf si un fichier `types.ts` prive le porte et que l'export public reste inchangable depuis `router.tsx`
- la possession des `useState` et `useRef` locaux :
  - `workpapersStateOverride`
  - `workpaperDrafts`
  - `documentUploadDrafts`
  - `documentDecisionDrafts`
  - `workpaperMutationState`
  - `documentUploadState`
  - `documentDownloadState`
  - `documentDecisionState`
  - refs in-flight maker / upload / download / decision
- les handlers d'orchestration locale :
  - maker draft changes
  - upload draft changes
  - decision draft changes
  - `handleSaveWorkpaper`
  - `handleDocumentUpload`
  - `handleDocumentDownload`
  - `handleSaveDocumentDecision`
- les refreshs locaux stricts de `GET /workpapers`
- l'appel aux fonctions API de `workpapers.ts`
- la composition vers la vue privee Workpapers

### Ce qui sort de `workpapers-panel.tsx`

Doivent sortir du fichier public vers des coutures privees locales :

- `WorkpapersSlot`
- `WorkpapersNominalBlocks`
- `WorkpaperCard`
- `WorkpaperMutationStatus`
- `ReadonlyLineList`
- `ControlsBlock`
- `StateMessage`
- les types UI locaux de drafts et d'etats internes
- les sets de roles locaux et helpers :
  - `hasWorkpaperWritableRole`
  - `hasDocumentReadableRole`
  - `hasDocumentReviewerRole`
- les guards :
  - `isMakerWorkpaperStatus`
  - `isDocumentVerificationDecision`
  - `isWorkpaperMakerEditable`
  - `isWorkpaperDocumentUploadEditable`
  - `isUuid`
- les helpers de drafts :
  - `createWorkpaperDrafts`
  - `createDocumentUploadDrafts`
  - `createDocumentDecisionDrafts`
  - `createWorkpaperDraft`
  - `createDocumentUploadDraft`
  - `createDocumentDecisionDraft`
  - `getWorkpaperDraft`
  - `getDocumentUploadDraft`
  - `getDocumentDecisionDraft`
- les helpers de disponibilite et read-only :
  - `getDocumentDecisionAvailabilityMessage`
  - `getWorkpapersGlobalReadOnlyMessage`
  - `getCurrentWorkpaperUploadAvailabilityMessage`
  - `getCurrentWorkpaperReadOnlyMessage`
- les validations et payloads :
  - `validateDocumentUploadDraft`
  - `createWorkpaperEvidencePayload`
  - `isWorkpaperEvidencePayload`
  - `hasWorkpaperDraftChanges`
  - `canUploadDocumentItem`
  - `canSaveWorkpaperItem`
  - `canSubmitDocumentDecision`
- les status lines et mappers UI :
  - `getDocumentDownloadStatusLine`
  - `getDocumentDecisionStatusLines`
  - `getDocumentUploadStatusLines`
  - `mapWorkpaperMutationResult`
  - `mapDocumentUploadResult`
  - `mapDocumentDownloadResult`
  - `mapDocumentDecisionResult`
  - `formatWorkpaperMutationState`
- les helpers de nettoyage d'etat local :
  - `clearDocumentUploadStateForAnchor`
  - `clearDocumentDecisionStateForDocument`
- les helpers document :
  - `getReadableDocumentId`
  - `findDocumentInWorkpapers`
  - `findCurrentDocumentInWorkpapers`
- les helpers download navigateur :
  - `triggerDocumentDownload`
  - `resolveDocumentDownloadFileName`
  - `resolveDocumentDownloadMediaType`
  - `getFallbackDocumentFileName`
  - `getFallbackDocumentMediaType`
  - `parseContentDispositionFilenameStar`
  - `parseContentDispositionFilename`
  - `stripWrappedQuotes`
  - `unescapeQuotedString`
  - `normalizeNonEmptyString`
- les helpers upload :
  - `isDocumentUploadFileAllowed`
  - `normalizeDocumentUploadMediaType`
  - `getLowercaseDocumentUploadExtension`
  - `isIsoDateOnly`

## Coutures privees autorisees

`026` autorise exactement ces nouveaux fichiers de production sous `frontend/src/app/workpapers-panel/` :

- `types.ts`
  - types UI internes du panel uniquement
  - aucune API call
  - aucun React state
- `model.ts`
  - roles, guards, drafts, availability, validations, evidence payload, document lookup
  - fonctions pures uniquement
  - aucun `fetch`, aucun `window`, aucun DOM
- `status-lines.ts`
  - mapping des etats UI locaux vers les textes visibles exacts deja figes
  - fonctions pures uniquement
  - aucun nouveau texte visible
- `download.ts`
  - helpers navigateur de download et parsing `Content-Disposition`
  - aucun `fetch`
  - aucun endpoint
  - aucune navigation directe
- `view.tsx`
  - composants de rendu locaux `WorkpapersSlot`, `WorkpapersNominalBlocks`, `WorkpaperCard`, `WorkpaperMutationStatus`, `ReadonlyLineList`, `ControlsBlock`, `StateMessage`
  - props et callbacks seulement
  - aucun `useState`, aucun `useRef`, aucun appel API, aucun refresh

Tout autre nouveau fichier de production dans ce scope est interdit sauf s'il remplace un des fichiers ci-dessus par une scission strictement plus petite et documentee dans la PR, sans ouvrir de nouveau type de responsabilite.

## Frontieres explicitement interdites

- `router.tsx` ne doit importer aucun fichier sous `frontend/src/app/workpapers-panel/`.
- Aucun fichier sous `frontend/src/app/workpapers-panel/` ne doit importer `router.tsx`.
- Aucun fichier sous `frontend/src/app/workpapers-panel/` ne doit appeler directement `fetch` ou `requestJson`.
- Aucun fichier sous `frontend/src/app/workpapers-panel/` ne doit construire une URL `/api/...`, sauf aucune exception.
- Aucun fichier sous `frontend/src/app/workpapers-panel/` ne doit importer un contrat OpenAPI.
- Aucun fichier sous `frontend/src/app/workpapers-panel/` ne doit creer un store, un cache, un context provider metier ou un hook global.
- Aucun helper extrait ne doit changer, traduire, normaliser ou dedupliquer les textes visibles existants.
- Aucune logique Workpapers ne doit migrer vers `frontend/src/app/router.tsx`.
- Aucune logique API Workpapers ne doit migrer hors de `frontend/src/lib/api/workpapers.ts`.

## Absence de changement produit

`026` impose l'identite stricte des elements suivants avant/apres implementation :

- route produit unique : `/closing-folders/:closingFolderId`
- ordre des blocs :
  - `Dossier courant`
  - `Import balance`
  - `Mapping manuel`
  - `Controles`
  - `Financial summary`
  - `Financial statements structured`
  - `Workpapers`
- textes visibles deja figes par `020` a `025`
- ordre des sous-blocs `Workpapers`
- ordre de rendu des documents
- conditions maker
- conditions upload
- conditions download
- conditions reviewer document
- body JSON `PUT /workpapers/{anchorCode}`
- body `FormData` `POST /workpapers/{anchorCode}/documents`
- mecanisme binaire `GET /documents/{documentId}/content`
- body JSON `POST /documents/{documentId}/verification-decision`
- refresh local `GET /workpapers` apres succes maker, upload et reviewer document
- absence de refresh apres download
- absence de navigation issue de `nextAction.path`

## Strategie de test locale

### Tests a conserver au niveau route

`frontend/src/app/router.workpapers.test.tsx` reste un smoke minimal et ne doit couvrir que :

- l'ordre `Financial statements structured` avant `Workpapers`
- le scope reseau initial exact
- l'absence d'endpoints hors scope au chargement initial
- l'absence de logique locale Workpapers dans `router.tsx`

Il ne doit pas redevenir le test principal des interactions maker, upload, download ou reviewer document.

### Tests a conserver au niveau API

`frontend/src/lib/api/workpapers.test.ts` reste la suite API / contrat de `workpapers.ts` et continue de couvrir :

- chemins exacts
- headers exacts
- bodies exacts
- timeouts
- payload success valide/invalide
- classifications HTTP / reseau / timeout

`026` ne demande aucun nouveau test API si `workpapers.ts` reste inchange.

### Tests a relocaliser au plus pres

Les helpers extraits doivent etre testes sous `frontend/src/app/workpapers-panel/` :

- `model.test.ts` pour roles, guards, drafts, validations upload, evidence payload, lookup document, enablement maker/upload/decision
- `status-lines.test.ts` pour les textes visibles exacts des etats maker, upload, download et decision document
- `download.test.ts` pour parsing `Content-Disposition`, resolution nom de fichier, resolution MIME et mecanisme object URL

`frontend/src/app/workpapers-panel.test.tsx` reste la suite d'integration locale du composant public et doit couvrir seulement les comportements qui exigent React :

- absence de requete supplementaire au mount
- interactions maker explicites
- interactions upload explicites
- interactions download explicites
- interactions reviewer document explicites
- refresh local `GET /workpapers`
- maintien du dernier bloc visible si refresh post-succes echoue
- absence d'appel endpoint hors scope

## Criteres d'acceptation structurels exacts

- `specs/active/026-frontend-workpapers-panel-decomposition-v1.md` existe et est la seule spec active.
- `specs/done/025-frontend-document-verification-decision-only-v1.md` existe avec `Status: Done`.
- `docs/product/v1-plan.md` liste `025` en livre et `026` en active.
- `docs/present/ux-cadrage-v1.md` et `docs/present/architecture-cadrage-v1.md` couvrent les capacites closes jusqu'a `025`.
- Aucun fichier `backend/**` n'est modifie.
- Aucun fichier `contracts/**` n'est modifie.
- Aucun nouveau fichier `contracts/**` n'est cree.
- Aucun nouvel endpoint n'est ajoute ou appele.
- Aucune nouvelle route produit frontend n'est creee.
- `router.tsx` continue d'importer seulement `WorkpapersPanel` depuis `./workpapers-panel` pour la surface Workpapers.
- `router.tsx` ne contient aucun draft, handler, helper, status mapper, refresh local ou composant detaille Workpapers.
- La sequence reseau initiale de `/closing-folders/:closingFolderId` reste identique a `025`.
- `workpapers.ts` reste la seule couture API Workpapers.
- Les fichiers sous `frontend/src/app/workpapers-panel/` ne construisent aucune URL `/api/...`.
- `workpapers-panel.tsx` ne contient plus les composants de rendu detailles ni les helpers purs listes dans cette spec.
- `workpapers-panel.tsx` reste le point d'entree public du panel et conserve l'orchestration locale.
- Aucun fichier de production Workpapers local ne depasse `900` lignes.
- `frontend/src/app/workpapers-panel.tsx` ne depasse pas `800` lignes.
- Les textes visibles exacts couverts par les tests restent inchanges.
- Les tests du panel restent locaux et ne repassent pas par un bootstrap complet de route pour les comportements internes Workpapers.
- `frontend/src/app/router.workpapers.test.tsx` reste un smoke minimal.
- `frontend/src/lib/api/workpapers.test.ts` reste la suite API / contrat principale.
- `pnpm test:ci`, `pnpm lint` et `pnpm build` passent cote frontend.

## Fichiers cibles attendus pour l'implementation

- `frontend/src/app/workpapers-panel.tsx`
- `frontend/src/app/workpapers-panel.test.tsx`
- `frontend/src/app/router.workpapers.test.tsx` seulement si le smoke minimal doit etre ajuste
- `frontend/src/app/workpapers-panel/types.ts`
- `frontend/src/app/workpapers-panel/model.ts`
- `frontend/src/app/workpapers-panel/status-lines.ts`
- `frontend/src/app/workpapers-panel/download.ts`
- `frontend/src/app/workpapers-panel/view.tsx`
- `frontend/src/app/workpapers-panel/model.test.ts`
- `frontend/src/app/workpapers-panel/status-lines.test.ts`
- `frontend/src/app/workpapers-panel/download.test.ts`

## Fichiers explicitement interdits

- `backend/**`
- `contracts/**`
- `frontend/src/lib/api/http.ts`
- toute nouvelle route produit frontend
- tout nouveau store global
- tout nouveau module IA

## Resultat attendu de `026`

- `WorkpapersPanel` reste la frontiere publique de la surface Workpapers.
- `router.tsx` reste un orchestrateur de page.
- `workpapers.ts` reste la couture API stable.
- Les responsabilites locales lourdes de rendu, helpers purs et download navigateur sortent dans des coutures privees Workpapers.
- Les tests se rapprochent des comportements locaux sans changer la verite produit.
- Le delivery Workpapers devient moins couteux a modifier sans ouvrir de nouveau scope produit.
