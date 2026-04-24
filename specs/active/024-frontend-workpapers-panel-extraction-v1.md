# 024 - Frontend workpapers panel extraction v1

## Status
Active

## Role de cette spec

Cette spec devient la verite normative de `024`.

Elle borne le plus petit chantier de scalabilite frontend legitime apres `023` pour decomprimer `frontend/src/app/router.tsx` en extrayant strictement la surface `Workpapers` dans une frontiere dediee `WorkpapersPanel`, sans changer :

- les routes
- les endpoints
- les textes visibles
- les comportements metier
- l ordre des blocs
- les contrats backend
- la verite produit deja figee par `020`, `021`, `022` et `023`

`024` n ouvre aucune nouvelle capacite produit. `024` ne reouvre ni `Import balance`, ni `Mapping manuel`, ni `Controles`, ni `Financial summary`, ni `Financial statements structured`, ni le backend, ni OpenAPI, ni l IA, ni GraphQL, ni un chantier global de state management frontend.

## Sources de verite

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ai-cadrage-v1.md`
- `docs/product/v1-plan.md`
- `specs/done/023-frontend-document-download-only-v1.md`
- `specs/done/022-frontend-document-upload-only-v1.md`
- `specs/done/021-frontend-workpapers-maker-update-v1.md`
- `specs/done/020-frontend-workpapers-read-model-v1.md`
- `contracts/openapi/workpapers-api.yaml`
- `contracts/openapi/documents-api.yaml`
- `frontend/src/app/router.tsx`
- `frontend/src/app/router.workpapers.test.tsx`
- `frontend/src/app/router.test.tsx`
- `frontend/src/lib/api/workpapers.ts`
- `frontend/src/lib/api/workpapers.test.ts`
- `frontend/src/lib/api/http.ts`
- `docs/ui/ui-foundations-v1.md`

## Constats repo

### Prouve par le repo

- `frontend/src/app/router.tsx` fait actuellement `3820` lignes et concentre a la fois le shell de route, le chargement initial detail, les drafts Workpapers, les etats de mutation / upload / download, les handlers locaux Workpapers, les refreshs locaux Workpapers, le rendu du bloc `Workpapers` et la plupart des helpers Workpapers.
- La surface Workpapers actuellement logee dans `router.tsx` couvre au minimum :
  - les handlers `handleWorkpaperNoteChange`, `handleWorkpaperStatusChange`, `handleDocumentUploadFileChange`, `handleDocumentUploadSourceLabelChange`, `handleDocumentUploadDateChange`, `handleSaveWorkpaper`, `handleDocumentUpload`, `handleDocumentDownload`
  - les refreshs `refreshWorkpapersAfterWorkpaperMutation` et `refreshWorkpapersAfterDocumentUpload`
  - les composants `WorkpapersSlot`, `WorkpapersNominalBlocks`, `WorkpaperCard`, `WorkpaperMutationStatus`
  - les helpers Workpapers de drafts, read-only, validations upload, statut download, resolution nom de fichier / MIME et recherche `documentId`
- `frontend/src/app/router.workpapers.test.tsx` fait actuellement `2396` lignes et melange un smoke route-level avec les comportements locaux maker, upload document, download document et refresh local Workpapers.
- `frontend/src/lib/api/workpapers.ts` fait actuellement `372` lignes et porte deja une couture API relativement saine pour `GET /workpapers`, `PUT /workpapers/{anchorCode}`, `POST /workpapers/{anchorCode}/documents` et `GET /documents/{documentId}/content`.
- `frontend/src/lib/api/workpapers.test.ts` existe deja et couvre la couture API / contrat de ces quatre appels, y compris la convention timeout `5000 ms` et le comportement binaire du download.
- Le detail `/closing-folders/:closingFolderId` charge deja en parallele `GET /controls`, `GET /mappings/manual`, `GET /financial-summary`, `GET /financial-statements/structured` et `GET /workpapers` apres `GET /api/me` puis `GET /api/closing-folders/{id}`.
- Les refreshs Workpapers deja prouves par `021`, `022` et `023` sont strictement locaux au bloc `Workpapers` :
  - `PUT /workpapers/{anchorCode}` -> refresh strict `GET /workpapers`
  - `POST /workpapers/{anchorCode}/documents` -> refresh strict `GET /workpapers`
  - `GET /documents/{documentId}/content` -> aucun refresh
- Les autres blocs existent deja et ne doivent pas etre reouverts par `024` :
  - `Import balance`
  - `Mapping manuel`
  - `Controles`
  - `Financial summary`
  - `Financial statements structured`

### Plausible mais non prouve

- Une decomposition plus large en hooks, stores, presenters, contextes, caches, adaptateurs ou utilitaires partages pourrait sembler plus propre, mais le repo ne prouve pas qu elle soit necessaire pour fermer `024`.
- Une extraction des autres blocs hors de `router.tsx` pourrait devenir utile plus tard, mais le repo ne prouve pas que ce soit necessaire dans `024`.
- Un renommage large des tests pourrait etre esthetique, mais le repo ne prouve pas qu il faille reclasser tous les fichiers de test pour fermer `024`.

### Bloquants

- Aucun bloquant repo n a ete prouve pour fermer `024` documentalement.
- Une ambiguite d implementation concrete existe : `WorkpapersPanel` ne pourra pas reimporter des helpers prives de `router.tsx` sans recreer un couplage circulaire. `024` la resout en gardant tout helper necessaire a `WorkpapersPanel` prive a `frontend/src/app/workpapers-panel.tsx`, sans nouveau mecanisme transversal.

### Hors scope

- toute evolution produit
- toute nouvelle regle metier
- toute nouvelle route produit
- tout nouvel endpoint
- tout changement backend
- tout changement OpenAPI
- tout changement visible sur les autres blocs
- toute refonte globale du frontend
- tout nouveau systeme global d etat ou de cache

## Decisions fermees

- `024` cree exactement une frontiere dediee `WorkpapersPanel`, par defaut dans `frontend/src/app/workpapers-panel.tsx`.
- `024` cree exactement une suite locale dediee `frontend/src/app/workpapers-panel.test.tsx`.
- `frontend/src/app/router.workpapers.test.tsx` est reduit a un smoke route-level minimal borne a l ordre des blocs, au chargement initial et au scope reseau initial.
- `frontend/src/lib/api/workpapers.ts` et `frontend/src/lib/api/workpapers.test.ts` restent la couture API / contrat principale de `Workpapers`.
- `router.tsx` garde le routing, le shell global, `GET /api/me`, `GET /api/closing-folders/{id}`, le chargement initial parallele deja existant des blocs et la composition finale de la page.
- `WorkpapersPanel` porte uniquement la surface locale `Workpapers` :
  - le rendu du bloc `Workpapers`
  - les drafts locaux maker
  - les drafts locaux upload document
  - les etats locaux de mutation / upload / download
  - les handlers locaux `PUT /workpapers/{anchorCode}`
  - les handlers locaux `POST /workpapers/{anchorCode}/documents`
  - les handlers locaux `GET /documents/{documentId}/content`
  - le refresh local strict de `GET /workpapers`
- `router.tsx` continue de charger `workpapersState` dans le `Promise.all` initial, puis passe ce resultat comme input initial au `WorkpapersPanel`.
- Par defaut, `router.tsx` remonte `WorkpapersPanel` via une `key` composee de `activeTenant.tenantId` et `closingFolder.id` afin de reinitialiser proprement l etat local du panel sur changement de dossier ou de tenant, sans effet de sync additionnel ni requete supplementaire.

## In scope exact

- extraction de la surface `Workpapers` hors de `router.tsx`
- conservation stricte du comportement `020` / `021` / `022` / `023`
- deplacement des responsabilites locales Workpapers vers une frontiere dediee
- reduction du role de `router.tsx` a une orchestration de page
- strategie de tests plus locale pour `Workpapers`
- maintien de `frontend/src/lib/api/workpapers.ts` comme couture API principale
- maintien d un smoke route-level strict pour `Workpapers`

## Out of scope exact

- toute evolution produit
- toute nouvelle regle metier
- tout nouvel endpoint
- tout changement d UX visible
- tout changement de textes
- tout changement des regles upload / download / maker update
- toute extraction des autres blocs
- tout changement backend
- tout changement OpenAPI
- toute refonte globale du frontend
- tout Redux, Zustand, React Query, Context global metier ou cache global
- toute refonte de `frontend/src/lib/api/*` hors necessite strictement prouvee
- toute abstraction "plus propre" non imposee par un besoin repo concret

## Surface exacte

- ordre des blocs identique
- placement de `Workpapers` identique
- aucun changement des CTA existants
- aucun changement des messages d erreur ou de succes
- aucun changement des conditions de visibilite ou de blocage locales
- aucun changement du rappel visible exact `Mise a jour maker unitaire sur les workpapers courants uniquement.`
- aucun changement des libelles visibles deja figes par `020`, `021`, `022` et `023`, y compris :
  - `Workpapers`
  - `Resume workpapers`
  - `Workpapers courants`
  - `Workpapers stale`
  - `Upload document`
  - `Telecharger le document`
  - les messages d etat maker, upload et download deja figes

## Sequence reseau exacte

### Chargement initial

- sequence initiale identique a `023`
- `router.tsx` continue de charger exactement :
  - `GET /api/me`
  - `GET /api/closing-folders/{id}`
  - puis en parallele :
    - `GET /api/closing-folders/{closingFolderId}/controls`
    - `GET /api/closing-folders/{closingFolderId}/mappings/manual`
    - `GET /api/closing-folders/{closingFolderId}/financial-summary`
    - `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
    - `GET /api/closing-folders/{closingFolderId}/workpapers`
- `WorkpapersPanel` ne relance jamais `GET /workpapers` au mount si `router.tsx` lui fournit deja l etat initial
- aucune requete supplementaire n est autorisee au chargement initial

### Interactions locales Workpapers

- `PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}` garde le meme handler local, le meme scope et le meme refresh strict `GET /workpapers`
- `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents` garde le meme handler local, le meme scope et le meme refresh strict `GET /workpapers`
- `GET /api/closing-folders/{closingFolderId}/documents/{documentId}/content` garde le meme handler local, le meme scope et n ajoute aucun refresh
- aucune requete Workpapers n est deplacee vers un autre bloc
- aucun refresh global n est ajoute
- aucune requete des autres blocs n est ajoutee, supprimee ou deplacee

## Repartition exacte des responsabilites

### Ce qui reste dans `router.tsx`

- les definitions de routes
- `ClosingFoldersEntrypointRoute`
- `ClosingFolderRoute`
- le shell global `AppShell`
- `GET /api/me`
- `GET /api/closing-folders/{id}`
- l orchestration initiale parallele des blocs deja existants
- les etats et handlers des blocs non `Workpapers`
- l ordre final de composition de la page
- la transmission au `WorkpapersPanel` de :
  - `closingFolderId`
  - `activeTenant`
  - `effectiveRoles`
  - `closingFolder`
  - `initialState = workpapersState`

### Ce qui sort de `router.tsx`

- `WorkpaperDraft`
- `DocumentUploadDraft`
- `WorkpaperMutationState`
- `DocumentUploadState`
- `DocumentDownloadState`
- les refs locales d in-flight Workpapers
- `handleWorkpaperNoteChange`
- `handleWorkpaperStatusChange`
- `handleDocumentUploadFileChange`
- `handleDocumentUploadSourceLabelChange`
- `handleDocumentUploadDateChange`
- `handleSaveWorkpaper`
- `handleDocumentUpload`
- `handleDocumentDownload`
- `refreshWorkpapersAfterWorkpaperMutation`
- `refreshWorkpapersAfterDocumentUpload`
- `WorkpapersSlot`
- `WorkpapersNominalBlocks`
- `WorkpaperCard`
- `WorkpaperMutationStatus`
- les helpers Workpapers de drafts, read-only, validation upload, statut upload, statut download, recherche `documentId`, resolution de nom de fichier, resolution MIME et trigger download

### Ce qui reste dans `workpapers.ts`

- les schemas `zod`
- les types de read-model et de mutation lies a l API
- `loadWorkpapersShellState`
- `upsertWorkpaper`
- `uploadWorkpaperDocument`
- `downloadWorkpaperDocument`
- la classification transport / timeout / payload / HTTP
- la convention timeout `DEFAULT_REQUEST_TIMEOUT_MS = 5000`

### Ce qui ne doit surtout pas etre extrait ailleurs

- aucun nouvel adaptateur API parallele a `workpapers.ts`
- aucun hook global partage de type `useWorkpapersPanel`
- aucun contexte `Workpapers`
- aucun store global
- aucun cache global
- aucun utilitaire transversal non justifie
- aucune duplication des regles metier deja gelees par `020` a `023`
- aucune extraction des autres blocs

## Regles de non-derive

- `workpapers.ts` reste la couture API principale sauf necessite strictement prouvee
- `workpapers.test.ts` reste la suite API / contrat principale
- `http.ts` reste inchange
- `WorkpapersPanel` ne cree aucun mecanisme global
- `WorkpapersPanel` ne consomme aucun endpoint hors scope `020` / `021` / `022` / `023`
- `WorkpapersPanel` ne corrige pas les refreshs des autres blocs
- `WorkpapersPanel` ne transforme jamais `nextAction.path` en navigation produit
- `WorkpapersPanel` ne trie pas, ne filtre pas et ne reordonne pas `items[]`, `staleWorkpapers[]` ou `documents[]`
- `WorkpapersPanel` ne modifie jamais les conditions de read-only, d upload, de save ou de download deja fermees
- toute petite aide visuelle necessaire au panel reste privee au fichier `workpapers-panel.tsx`; aucun nouveau module transversal de presentation n est autorise

## Tests frontend requis

- `pnpm test:ci`
- `pnpm lint`
- `pnpm build`
- `frontend/src/app/router.workpapers.test.tsx` garde un smoke route-level unique pour :
  - l ordre des blocs
  - le chargement initial
  - le scope reseau initial
- `frontend/src/app/workpapers-panel.test.tsx` porte les comportements locaux `Workpapers`, sans bootstrap complet de tout l ecran
- `frontend/src/lib/api/workpapers.test.ts` reste la suite API / contrat de `workpapers.ts`
- les tests locaux `WorkpapersPanel` mockent prioritairement la couture `frontend/src/lib/api/workpapers.ts` plutot que `fetch` brut pour les cas purement locaux
- les comportements suivants doivent sortir du smoke route-level et vivre dans `workpapers-panel.test.tsx` :
  - drafts maker
  - drafts upload document
  - absence d autosave maker
  - priorites read-only et blocages locaux
  - succes et erreurs `PUT /workpapers/{anchorCode}`
  - succes et erreurs `POST /workpapers/{anchorCode}/documents`
  - succes et erreurs `GET /documents/{documentId}/content`
  - refresh local strict `GET /workpapers`
  - absence de refresh apres download
  - concurrence locale unitaire maker / upload / download
- le smoke route-level ne revalide pas les details transport deja portes par `workpapers.test.ts` au-dela du scope reseau initial de la route detail

## Criteres d acceptation exacts

- `specs/active/024-frontend-workpapers-panel-extraction-v1.md` existe
- `frontend/src/app/router.tsx` n embarque plus la majorite de la logique locale `Workpapers`
- `frontend/src/app/router.tsx` rend `Workpapers` via une frontiere dediee `WorkpapersPanel`
- `router.tsx` conserve le routing, le shell global, `GET /api/me`, `GET /api/closing-folders/{id}`, le chargement initial parallele deja existant des blocs et la composition finale de la page
- `router.tsx` ne contient plus :
  - les drafts Workpapers
  - les etats locaux Workpapers de mutation / upload / download
  - les handlers locaux Workpapers
  - les refreshs locaux Workpapers
  - les composants de rendu Workpapers detailles
- les comportements `020` / `021` / `022` / `023` restent identiques
- le scope reseau initial est inchange
- les textes visibles sont inchanges
- les tests `Workpapers` deviennent plus locaux et ne dependent plus majoritairement d un bootstrap full screen
- `frontend/src/lib/api/workpapers.test.ts` reste le test API / contrat principal
- `frontend/src/app/router.workpapers.test.tsx` est reduit a un smoke route-level minimal
- aucun autre bloc n est reouvert
- aucun endpoint n est ajoute
- aucun etat global n est introduit
- aucun nouvel adaptateur API parallele n est introduit
- aucun nouvel utilitaire transversal non justifie n est introduit
- aucun changement de sequence reseau globale de la route detail n est introduit

## Fichiers cibles attendus

- `frontend/src/app/router.tsx`
- `frontend/src/app/workpapers-panel.tsx`
- `frontend/src/app/router.workpapers.test.tsx`
- `frontend/src/app/workpapers-panel.test.tsx`
- `frontend/src/lib/api/workpapers.ts`
- `frontend/src/lib/api/workpapers.test.ts`

## Resultat attendu de 024

- `router.tsx` redevient un orchestrateur de page
- `WorkpapersPanel` devient la frontiere unique et explicite de la surface `Workpapers`
- `workpapers.ts` reste la couture API stable
- la verite produit figee par `020` a `023` reste intacte
- le delivery `Workpapers` devient plus testable et plus scalable sans ouvrir un nouveau scope produit
