# 020 - Frontend workpapers read model v1

## Status
Active

## Role de cette spec

Cette spec devient la verite normative de `020`.

Elle borne le plus petit enrichissement frontend metier legitime apres `019` pour permettre a l utilisateur de consulter, depuis `/closing-folders/:closingFolderId`, le read-model `workpapers` du dossier en lecture seule via le backend existant, sans ouvrir une nouvelle route produit ni reouvrir les scopes fermes.

`020` ne reouvre ni le backend `workpapers-v1`, ni `document-storage-and-evidence-files-v1`, ni `evidence-review-and-verification-v1`, ni `019`, ni `018`, ni `017`, ni `016`, ni `014`, ni les versions d import, ni le diff previous, ni les exports, ni l IA, ni GraphQL.

## Sources de verite

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ai-cadrage-v1.md`
- `docs/product/v1-plan.md`
- `specs/done/010-workpapers-v1.md`
- `specs/done/011-document-storage-and-evidence-files-v1.md`
- `specs/done/012-evidence-review-and-verification-v1.md`
- `specs/done/019-frontend-financial-statements-structured-preview-v1.md`
- `specs/done/018-frontend-financial-summary-preview-v1.md`
- `specs/done/017-frontend-manual-mapping-v1.md`
- `specs/done/016-frontend-import-balance-v1.md`
- `specs/done/014-frontend-controls-readiness-cockpit-v1.md`
- `contracts/openapi/workpapers-api.yaml`
- `contracts/openapi/documents-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/workpapers/api/WorkpapersController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/WorkpapersApiTest.kt`
- `frontend/src/app/router.tsx`
- `frontend/src/lib/api/http.ts`
- `frontend/src/lib/api/me.ts`
- `frontend/src/lib/api/closing-folders.ts`
- `frontend/src/lib/api/controls.ts`
- `frontend/src/lib/api/import-balance.ts`
- `frontend/src/lib/api/manual-mapping.ts`
- `frontend/src/lib/api/financial-summary.ts`
- `frontend/src/lib/api/financial-statements-structured.ts`
- `docs/ui/ui-foundations-v1.md`

## Decisions fermees

- `020` enrichit uniquement la route existante `/closing-folders/:closingFolderId`.
- `020` ne cree aucune nouvelle route produit.
- `020` ne cree aucun onglet, aucun drawer metier et aucune sous-navigation produit.
- `020` conserve les blocs deja presents sur la route detail :
  - `Dossier courant`
  - `Import balance`
  - `Mapping manuel`
  - `Controles`
  - `Financial summary`
  - `Financial statements structured`
- `020` ajoute un seul nouveau bloc visible : `Workpapers`.
- `Workpapers` est place strictement apres `Financial statements structured`.
- `020` reste strictement read-only.
- `020` ajoute uniquement un nouvel appel frontend autorise :
  - `GET /api/closing-folders/{closingFolderId}/workpapers`
- `020` utilise toujours le vrai path backend `/workpapers`.
- `020` ne consomme aucun autre nouvel endpoint.
- `020` ne consomme jamais :
  - `PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}`
  - `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
  - tout endpoint `documents`
  - tout endpoint `exports`
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous`
  - tout endpoint IA
- `020` n introduit aucun nouveau backend si l endpoint existant suffit.
- `020` n introduit aucun nouveau contrat OpenAPI.
- `020` n introduit aucune mutation.
- `020` n introduit aucun etat global de page additionnel.
- `020` n introduit aucun refresh global de route ou de page.
- `020` n introduit aucun workflow `nextAction`.
- `020` n introduit aucune navigation produit a partir de `nextAction.path`.
- `020` ne consomme pas `nextAction` pour rendre des liens, des boutons, des tabs, des shortcuts ni un workflow produit.
- `020` ne corrige pas les refreshs post-import, post-mapping, `Financial summary` ou `Financial statements structured`.
- `020` ne presente jamais cette surface comme une zone d edition workpaper, de review evidence, de documents, d exports ou d IA.
- `020` n introduit aucun CTA vers documents, exports, review evidence ou edition workpaper.

## In scope exact

- ajout d un bloc `Workpapers` sur `/closing-folders/:closingFolderId`
- chargement read-only de `GET /api/closing-folders/{closingFolderId}/workpapers`
- validation stricte du sous-ensemble JSON `/workpapers` effectivement consomme par le frontend
- rendu visible et distinct des etats :
  - chargement workpapers
  - ready avec donnees
  - ready vide
  - `400`
  - `401`
  - `403`
  - `404`
  - `5xx`
  - erreur reseau
  - timeout
  - payload invalide
  - unexpected
- affichage d un resume minimal via `summaryCounts`
- affichage read-only des `items[]`
- affichage read-only des `staleWorkpapers[]`
- affichage read-only de `documents[]` consomme uniquement depuis le payload `GET /workpapers`
- affichage read-only de `documentVerificationSummary` consomme uniquement depuis le payload `GET /workpapers`
- maintien visible des blocs existants quand `Workpapers` echoue
- tests frontend couvrant la sequence reseau, les branches visibles exactes, le payload invalide et l absence de derive d endpoint

## Out of scope exact

- toute nouvelle route produit
- toute nouvelle tabulation, drawer metier ou stepper metier
- tout nouveau backend
- tout nouveau contrat OpenAPI
- toute mutation
- `PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}`
- `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
- tout endpoint `documents`
- upload document
- download document
- verification decision
- export packs
- lecture des versions d import
- diff previous
- GraphQL
- toute IA active
- tout workflow `nextAction`
- toute transformation de `nextAction.path` en navigation produit
- toute correction des refreshs post-import, post-mapping, `Financial summary` ou `Financial statements structured`
- tout CTA vers documents, exports, review evidence ou edition workpaper

## Surface exacte de 020

### `/closing-folders/:closingFolderId`

- statut : unique route produit enrichie par `020`
- la route conserve le shell, le breadcrumb, la sidebar, le contexte tenant et le detail dossier deja livres
- la route reste une page simple en flux vertical unique
- aucun onglet, aucune sous-navigation et aucune navigation additionnelle ne sont autorises

### Ordre visible exact une fois le dossier nominal

1. bloc `Dossier courant`
   - inchange par rapport a `004`
2. bloc `Import balance`
   - inchange par rapport a `016`
3. bloc `Mapping manuel`
   - inchange par rapport a `017`
4. bloc `Controles`
   - inchange par rapport a `014`
5. bloc `Financial summary`
   - inchange par rapport a `018`
6. bloc `Financial statements structured`
   - inchange par rapport a `019`
7. bloc `Workpapers`
   - nouveau dans `020`

### Regle de stabilite si `Workpapers` est en erreur

- le bloc `Dossier courant` reste visible
- le bloc `Import balance` reste visible
- le bloc `Mapping manuel` reste visible
- le bloc `Controles` reste visible et conserve son propre etat
- le bloc `Financial summary` reste visible et conserve son propre etat
- le bloc `Financial statements structured` reste visible et conserve son propre etat
- le bloc `Workpapers` reste visible avec un seul panneau d etat explicite
- aucun rendu partiel de `Resume workpapers`, `Workpapers courants`, `Workpapers stale`, `Documents inclus` ou `Verification documents` n est autorise en cas d erreur de lecture

### Bloc `Workpapers`

- titre visible exact : `Workpapers`
- sous-titre visible exact : `Read-only`
- rappel visible exact dans les seuls etats nominaux `WORKPAPERS_READY_EMPTY` et `WORKPAPERS_READY_WITH_DATA` :
  - `Workpapers en lecture seule dans cette version.`
- le rappel read-only n est pas affiche dans les etats `loading`, `401`, `403`, `404`, `400`, `5xx`, erreur reseau, timeout, payload invalide ou `unexpected`
- sous-blocs autorises en etat nominal :
  - `Resume workpapers`
  - `Workpapers courants`
  - `Workpapers stale`
- sous-sections autorisees dans chaque carte workpaper :
  - `Documents inclus`
  - `Verification documents`
- composants autorises :
  - un rappel read-only
  - un slot d etat unique pour les etats d erreur
  - des listes de metriques read-only
  - des listes read-only en ordre backend
  - des cartes read-only par workpaper
  - des sous-sections `Documents inclus` et `Verification documents` dans chaque carte workpaper
  - des lignes read-only de metadata document quand elles existent deja dans le payload `GET /workpapers`
- composants interdits :
  - bouton `Modifier le workpaper`
  - bouton `Envoyer en review`
  - bouton `Prendre une decision reviewer`
  - bouton `Uploader un document`
  - bouton `Telecharger un document`
  - bouton `Ouvrir les documents`
  - bouton `Ouvrir les exports`
  - bouton `Ouvrir le workpaper`
  - lien issu de `nextAction.path`

## Sequence reseau exacte

### Sequence initiale

1. appeler `GET /api/me` sans `X-Tenant-Id`
2. si `GET /api/me` retourne un contexte exploitable avec `activeTenant != null`, appeler `GET /api/closing-folders/{id}` avec `X-Tenant-Id = activeTenant.tenantId`
3. si le dossier est dans l etat nominal de `004`, initialiser les slots `Mapping manuel`, `Controles`, `Financial summary`, `Financial statements structured` et `Workpapers` en chargement
4. emettre en parallele :
   - `GET /api/closing-folders/{closingFolderId}/mappings/manual`
   - `GET /api/closing-folders/{closingFolderId}/controls`
   - `GET /api/closing-folders/{closingFolderId}/financial-summary`
   - `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
   - `GET /api/closing-folders/{closingFolderId}/workpapers`
5. si `GET /api/me` ou `GET /api/closing-folders/{id}` n est pas dans l etat nominal de `004`, aucun appel `/workpapers` n est autorise
6. `GET /api/closing-folders/{closingFolderId}/workpapers` utilise toujours le meme `X-Tenant-Id = activeTenant.tenantId`
7. `020` n ajoute aucun autre appel reseau au chargement initial

### Interaction avec les blocs deja presents

- `Workpapers` ne gate ni le rendu de `Import balance`, ni celui de `Mapping manuel`, ni celui de `Controles`, ni celui de `Financial summary`, ni celui de `Financial statements structured`
- `Workpapers` conserve son propre slot d etat et ne remplace jamais les slots `Controles`, `Financial summary` ou `Financial statements structured`
- un echec `Workpapers` ne masque jamais les blocs deja presents
- `020` n introduit aucun etat global de page ; le chargement, l erreur et l etat nominal restent portes uniquement par le bloc `Workpapers`
- `020` ne declenche aucun refresh global de `GET /api/me`, `GET /api/closing-folders/{id}`, `GET /api/closing-folders/{closingFolderId}/controls`, `GET /api/closing-folders/{closingFolderId}/mappings/manual`, `GET /api/closing-folders/{closingFolderId}/financial-summary` ou `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
- `020` n ajoute aucun refresh local de `GET /api/closing-folders/{closingFolderId}/workpapers` apres `POST /api/closing-folders/{closingFolderId}/imports/balance`, `PUT /api/closing-folders/{closingFolderId}/mappings/manual` ou `DELETE /api/closing-folders/{closingFolderId}/mappings/manual`
- `020` n ajoute aucun refresh local de `GET /api/closing-folders/{closingFolderId}/workpapers` apres succes ou echec de `GET /api/closing-folders/{closingFolderId}/financial-summary` ou de `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
- hors rechargement complet de la route detail, le bloc `Workpapers` conserve donc son dernier rendu charge par la sequence initiale de `020`
- `020` ne modifie pas les sequences de refresh post-mutation deja bornees par `016`, `017`, `018` et `019`
- `020` n ajoute aucun retry automatique ni refresh auto vers `documents`, `exports`, versions d import, diff previous ou IA

## Contrat API reel consomme par 020

### Verite unique retenue

`020` ajoute uniquement :

- `GET /api/closing-folders/{closingFolderId}/workpapers`

`020` conserve les endpoints deja livres par `016`, `017`, `018` et `019`, sans en ajouter d autres.

`020` ne consomme jamais :

- `PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}`
- `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
- tout endpoint `documents`
- tout endpoint `exports`
- `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`
- `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous`
- tout endpoint IA

### `GET /api/closing-folders/{closingFolderId}/workpapers`

Preuve repo :

- `contracts/openapi/workpapers-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/workpapers/api/WorkpapersController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/WorkpapersApiTest.kt`

Constats observes :

- l endpoint reel est `GET /api/closing-folders/{closingFolderId}/workpapers`
- l endpoint exige `X-Tenant-Id`
- `200` reste lisible sur dossier `ARCHIVED`
- `200` reste lisible quand le read-model `workpapers` est `BLOCKED`
- `401` signifie authentification requise
- `403` signifie acces tenant / RBAC refuse
- `404` signifie dossier absent ou hors tenant
- `400` reste reserve aux cas internes de header ou path invalides ; dans `020`, tout `400` est traite comme le meme rendu local que `unexpected`, soit `workpapers indisponibles`
- le backend expose `items[]` pour les anchors courants, meme sans `workpaper` persiste
- le backend expose `staleWorkpapers[]` separement pour les workpapers persistants non courants
- le backend expose `documents[]` sur chaque `WorkpaperItem`, courant ou stale, meme quand le tableau est vide
- le backend expose `documentVerificationSummary` sur chaque `WorkpaperItem` ; la valeur est `null` seulement quand un item courant n a pas de `workpaper` persiste
- le repo prouve un ordre backend determine pour `items[]`, `staleWorkpapers[]` et `documents[]` ; `020` conserve cet ordre exact et n applique aucun tri local

### Sous-ensemble exact du payload `200` consomme cote frontend

Regle de validation frontend a figer :

- `020` valide uniquement le sous-ensemble ci-dessous ; il ne parse pas le payload `/workpapers` comme un schema plein incluant des champs ignores
- un body `200` non JSON, illisible ou non objet rend exactement `payload workpapers invalide`
- toutes les valeurs string consommees sont rendues brutes telles que livrees par le backend, sans recalcul, sans relabellisation locale et sans formatage supplementaire
- `020` ne trie pas, ne filtre pas, ne regroupe pas et ne pagine pas localement `items[]`, `staleWorkpapers[]` ou `documents[]`
- `documents[]` et `documentVerificationSummary` sont effectivement consommes par `020` depuis `GET /workpapers` ; comme ces champs sont requis par le contrat `WorkpaperItem`, leur absence rend exactement `payload workpapers invalide`
- `nextAction`, `nextAction.code`, `nextAction.path` et `nextAction.actionable` sont explicitement non consommes par `020`

- `closingFolderId`
  - requis : oui
  - type attendu : `string` au format UUID
  - rendu UI exact : non rendu en clair ; utilise seulement pour verifier la coherence avec le param route et `closingFolder.id`
  - fallback si absent, non string, non UUID ou incoherent : `payload workpapers invalide`
- `summaryCounts`
  - requis : oui
  - type attendu : `object`
  - rendu UI exact : sous-bloc `Resume workpapers`
  - fallback si absent, `null` ou non objet : `payload workpapers invalide`
- `summaryCounts.totalCurrentAnchors`
  - requis : oui
  - type attendu : `integer >= 0`
  - rendu UI exact : `anchors courants total : <valeur>`
  - fallback si absent, non entier ou negatif : `payload workpapers invalide`
- `summaryCounts.withWorkpaperCount`
  - requis : oui
  - type attendu : `integer >= 0`
  - rendu UI exact : `anchors avec workpaper : <valeur>`
  - fallback si absent, non entier ou negatif : `payload workpapers invalide`
- `summaryCounts.readyForReviewCount`
  - requis : oui
  - type attendu : `integer >= 0`
  - rendu UI exact : `workpapers prets pour revue : <valeur>`
  - fallback si absent, non entier ou negatif : `payload workpapers invalide`
- `summaryCounts.reviewedCount`
  - requis : oui
  - type attendu : `integer >= 0`
  - rendu UI exact : `workpapers revus : <valeur>`
  - fallback si absent, non entier ou negatif : `payload workpapers invalide`
- `summaryCounts.staleCount`
  - requis : oui
  - type attendu : `integer >= 0`
  - rendu UI exact : `workpapers stale : <valeur>`
  - fallback si absent, non entier ou negatif : `payload workpapers invalide`
- `summaryCounts.missingCount`
  - requis : oui
  - type attendu : `integer >= 0`
  - rendu UI exact : `anchors sans workpaper : <valeur>`
  - fallback si absent, non entier ou negatif : `payload workpapers invalide`
- `items`
  - requis : oui
  - type attendu : `array`
  - rendu UI exact : sous-bloc `Workpapers courants`
  - fallback si absent ou non tableau : `payload workpapers invalide`
- `staleWorkpapers`
  - requis : oui
  - type attendu : `array`
  - rendu UI exact : sous-bloc `Workpapers stale`
  - fallback si absent ou non tableau : `payload workpapers invalide`

### Sous-ensemble exact consomme pour chaque element de `items[]` et `staleWorkpapers[]`

- `anchorCode`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `anchor code : <valeur>`
  - fallback si absent ou non string : `payload workpapers invalide`
- `anchorLabel`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : titre visible de la carte workpaper
  - fallback si absent ou non string : `payload workpapers invalide`
- `statementKind`
  - requis : oui
  - type attendu : `string` enum `BALANCE_SHEET | INCOME_STATEMENT`
  - rendu UI exact : `statement kind : <valeur>`
  - fallback si absent, non string ou hors enum : `payload workpapers invalide`
- `breakdownType`
  - requis : oui
  - type attendu : `string` enum `SECTION | LEGACY_BUCKET_FALLBACK`
  - rendu UI exact : `breakdown type : <valeur>`
  - fallback si absent, non string ou hors enum : `payload workpapers invalide`
- `isCurrentStructure`
  - requis : oui
  - type attendu : `boolean`
  - rendu UI exact : non rendu comme ligne autonome ; sert seulement a verifier la coherence du contexte `current` ou `stale`
  - fallback si absent ou non booleen : `payload workpapers invalide`
- `workpaper`
  - requis : oui
  - type attendu : `object | null`
  - rendu UI exact :
    - `null -> etat workpaper : aucun`
    - `object -> lignes read-only workpaper`
  - fallback si propriete absente ou type invalide : `payload workpapers invalide`
- `workpaper.status`
  - requis : oui quand `workpaper` est un objet
  - type attendu : `string` enum `DRAFT | READY_FOR_REVIEW | CHANGES_REQUESTED | REVIEWED`
  - rendu UI exact : `etat workpaper : <valeur>`
  - fallback si absent, non string ou hors enum : `payload workpapers invalide`
- `workpaper.noteText`
  - requis : oui quand `workpaper` est un objet
  - type attendu : `string`
  - rendu UI exact : `note workpaper : <valeur>`
  - fallback si absent ou non string : `payload workpapers invalide`
- `documents`
  - requis : oui
  - type attendu : `array`
  - rendu UI exact : sous-section `Documents inclus` dans la carte workpaper
  - fallback si absent ou non tableau : `payload workpapers invalide`
- `documents[].fileName`
  - requis : oui quand un element `documents[]` existe
  - type attendu : `string`
  - rendu UI exact : ligne document
  - fallback si absent ou non string : `payload workpapers invalide`
- `documents[].mediaType`
  - requis : oui quand un element `documents[]` existe
  - type attendu : `string`
  - rendu UI exact : ligne document
  - fallback si absent ou non string : `payload workpapers invalide`
- `documents[].sourceLabel`
  - requis : oui quand un element `documents[]` existe
  - type attendu : `string`
  - rendu UI exact : ligne document
  - fallback si absent ou non string : `payload workpapers invalide`
- `documents[].verificationStatus`
  - requis : oui quand un element `documents[]` existe
  - type attendu : `string` enum `UNVERIFIED | VERIFIED | REJECTED`
  - rendu UI exact : `<fileName> | <mediaType> | <sourceLabel> | verification : <verificationStatus>`
  - fallback si absent, non string ou hors enum : `payload workpapers invalide`
- `documentVerificationSummary`
  - requis : oui
  - type attendu : `object | null`
  - rendu UI exact : sous-section `Verification documents` dans la carte workpaper seulement quand la valeur est un objet valide
  - fallback si absent ou type invalide : `payload workpapers invalide`
- `documentVerificationSummary.documentsCount`
  - requis : oui quand `documentVerificationSummary` est un objet
  - type attendu : `integer >= 0`
  - rendu UI exact : `documents total : <valeur>`
  - fallback si absent, non entier ou negatif : `payload workpapers invalide`
- `documentVerificationSummary.unverifiedCount`
  - requis : oui quand `documentVerificationSummary` est un objet
  - type attendu : `integer >= 0`
  - rendu UI exact : `documents non verifies : <valeur>`
  - fallback si absent, non entier ou negatif : `payload workpapers invalide`
- `documentVerificationSummary.verifiedCount`
  - requis : oui quand `documentVerificationSummary` est un objet
  - type attendu : `integer >= 0`
  - rendu UI exact : `documents verifies : <valeur>`
  - fallback si absent, non entier ou negatif : `payload workpapers invalide`
- `documentVerificationSummary.rejectedCount`
  - requis : oui quand `documentVerificationSummary` est un objet
  - type attendu : `integer >= 0`
  - rendu UI exact : `documents rejetes : <valeur>`
  - fallback si absent, non entier ou negatif : `payload workpapers invalide`

### Regles de coherence exactes du payload `200`

- `payload.closingFolderId == route.params.closingFolderId == closingFolder.id`
- `summaryCounts.totalCurrentAnchors == items.length`
- `summaryCounts.withWorkpaperCount == count(items where workpaper != null)`
- `summaryCounts.missingCount == count(items where workpaper == null)`
- `summaryCounts.staleCount == staleWorkpapers.length`
- `summaryCounts.readyForReviewCount == count(items where workpaper.status == READY_FOR_REVIEW)`
- `summaryCounts.reviewedCount == count(items where workpaper.status == REVIEWED)`
- chaque element de `items[]` impose `isCurrentStructure == true`
- chaque element de `staleWorkpapers[]` impose `isCurrentStructure == false`
- chaque element de `staleWorkpapers[]` impose `workpaper != null`
- chaque element de `staleWorkpapers[]` impose `documentVerificationSummary != null`
- si un element de `items[]` a `workpaper == null`, alors `documents.length == 0`
- si un element de `items[]` a `workpaper == null`, alors la seule valeur autorisee pour `documentVerificationSummary` est `null`
- si un element de `items[]` a `workpaper != null`, alors `documentVerificationSummary != null`
- si `documentVerificationSummary` est un objet valide, alors :
  - `documentsCount == unverifiedCount + verifiedCount + rejectedCount`
  - `documentsCount == documents.length`
  - les statuts `UNVERIFIED | VERIFIED | REJECTED` du tableau correspondent exactement aux quatre compteurs
- toute violation de coherence rend exactement `payload workpapers invalide`

### Champs explicitement non consommes par `020` sur `/workpapers`

- `closingFolderStatus`
  - non consomme
  - raison : le statut dossier visible reste celui de `GET /api/closing-folders/{id}`
- `readiness`
  - non consomme
  - raison : la readiness visible reste portee uniquement par le bloc `Controles`
- `latestImportVersion`
  - non consomme
  - raison : `020` borne le bloc `Workpapers` a un resume minimal et ne recadre pas les autres blocs
- `blockers`
  - non consomme
  - raison : les blockers restent deja portes par `Controles`
- `nextAction`
  - non consomme
  - raison : `020` n ouvre aucun nouveau workflow produit
- `nextAction.code`
  - non consomme
  - raison : `020` n ouvre aucun nouveau workflow produit
- `nextAction.path`
  - non consomme
  - jamais rendu
  - jamais lie
  - jamais transforme en navigation produit
- `nextAction.actionable`
  - non consomme
  - raison : `020` n ouvre aucun nouveau workflow produit
- `summaryBucketCode`
  - non consomme
  - raison : `020` preserve l ordre backend sans regroupement local
- `workpaper.reviewComment`
  - non consomme
  - raison : `020` ne presente pas cette surface comme zone de review evidence
- `workpaper.id`
- `workpaper.basisImportVersion`
- `workpaper.basisTaxonomyVersion`
- `workpaper.createdAt`
- `workpaper.createdByUserId`
- `workpaper.updatedAt`
- `workpaper.updatedByUserId`
- `workpaper.reviewedAt`
- `workpaper.reviewedByUserId`
- `workpaper.evidences`
  - non consommes
  - raison : `020` reste un read-model minimal sans reouvrir l edition du contenu workpaper ni la legacy evidence metadata
- `documents[].id`
- `documents[].byteSize`
- `documents[].checksumSha256`
- `documents[].documentDate`
- `documents[].createdAt`
- `documents[].createdByUserId`
- `documents[].reviewComment`
- `documents[].reviewedAt`
- `documents[].reviewedByUserId`
  - non consommes
  - raison : `020` n introduit qu une lecture minimale des documents deja inclus dans le payload `GET /workpapers`

Les champs explicitement non consommes n entrent pas dans la classification `payload workpapers invalide` tant que le sous-ensemble consomme ci-dessus reste exploitable.

Consequence normative additionnelle :

- une valeur absente, invalide ou incoherente sur `closingFolderStatus`, `readiness`, `latestImportVersion`, `blockers`, `nextAction`, `nextAction.code`, `nextAction.path` ou `nextAction.actionable` ne change ni le texte visible, ni la navigation, ni la classification locale du bloc `Workpapers`

## Matrice d etats exacte du bloc `Workpapers`

### Regle generale

- cette matrice s applique seulement quand la route detail est dans l etat nominal de `004`
- les blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` restent visibles selon leurs propres specs
- en `loading` ou en erreur, le bloc `Workpapers` affiche un seul panneau d etat local et aucun sous-bloc nominal
- en `WORKPAPERS_READY_EMPTY` et `WORKPAPERS_READY_WITH_DATA`, le bloc `Workpapers` n affiche aucun panneau d etat local ; il affiche uniquement ses sous-blocs nominaux
- le rappel exact `Workpapers en lecture seule dans cette version.` est visible en `WORKPAPERS_READY_EMPTY` et `WORKPAPERS_READY_WITH_DATA`, et absent des etats `loading` et erreur
- tout resultat non nominal non explicitement borne ci-dessous rend un texte stable et testable ; aucun fallback implicite n est autorise

### `WORKPAPERS_LOADING`

Condition :

- `GET /api/closing-folders/{closingFolderId}/workpapers` est en cours

Rendu exact :

- panneau d etat unique dans le bloc `Workpapers`
- texte exact visible : `chargement workpapers`
- panneau local `Workpapers` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` visibles : oui
- rappel read-only visible : non

### `WORKPAPERS_AUTH_REQUIRED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/workpapers` retourne `401`

Rendu exact :

- panneau d etat unique dans le bloc `Workpapers`
- texte exact visible : `authentification requise`
- panneau local `Workpapers` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` visibles : oui
- rappel read-only visible : non

### `WORKPAPERS_FORBIDDEN`

Condition :

- `GET /api/closing-folders/{closingFolderId}/workpapers` retourne `403`

Rendu exact :

- panneau d etat unique dans le bloc `Workpapers`
- texte exact visible : `acces workpapers refuse`
- panneau local `Workpapers` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` visibles : oui
- rappel read-only visible : non

### `WORKPAPERS_NOT_FOUND`

Condition :

- `GET /api/closing-folders/{closingFolderId}/workpapers` retourne `404`

Rendu exact :

- panneau d etat unique dans le bloc `Workpapers`
- texte exact visible : `workpapers introuvables`
- panneau local `Workpapers` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` visibles : oui
- rappel read-only visible : non

### `WORKPAPERS_SERVER_ERROR`

Condition :

- `GET /api/closing-folders/{closingFolderId}/workpapers` retourne `5xx`

Rendu exact :

- panneau d etat unique dans le bloc `Workpapers`
- texte exact visible : `erreur serveur workpapers`
- panneau local `Workpapers` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` visibles : oui
- rappel read-only visible : non

### `WORKPAPERS_NETWORK_ERROR`

Condition :

- `GET /api/closing-folders/{closingFolderId}/workpapers` echoue pour erreur reseau

Rendu exact :

- panneau d etat unique dans le bloc `Workpapers`
- texte exact visible : `erreur reseau workpapers`
- panneau local `Workpapers` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` visibles : oui
- rappel read-only visible : non

### `WORKPAPERS_TIMEOUT`

Condition :

- `GET /api/closing-folders/{closingFolderId}/workpapers` echoue par timeout selon la convention de `frontend/src/lib/api/http.ts`

Rendu exact :

- panneau d etat unique dans le bloc `Workpapers`
- texte exact visible : `timeout workpapers`
- panneau local `Workpapers` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` visibles : oui
- rappel read-only visible : non

### `WORKPAPERS_INVALID_PAYLOAD`

Condition :

- `GET /api/closing-folders/{closingFolderId}/workpapers` retourne `200`
- le payload est invalide, incomplet ou incoherent pour le sous-ensemble exact consomme

Rendu exact :

- panneau d etat unique dans le bloc `Workpapers`
- texte exact visible : `payload workpapers invalide`
- panneau local `Workpapers` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` visibles : oui
- rappel read-only visible : non

### `WORKPAPERS_BAD_REQUEST_AS_UNEXPECTED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/workpapers` retourne `400`

Rendu exact :

- panneau d etat unique dans le bloc `Workpapers`
- texte exact visible : `workpapers indisponibles`
- panneau local `Workpapers` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` visibles : oui
- rappel read-only visible : non
- regle : `400` reutilise exactement la meme branche visible que `unexpected` et ne cree aucun workflow, aucun texte et aucun traitement distincts

### `WORKPAPERS_UNEXPECTED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/workpapers` retourne un statut non nominal non explicitement borne, hors `400`, `401`, `403`, `404` et `5xx`

Rendu exact :

- panneau d etat unique dans le bloc `Workpapers`
- texte exact visible : `workpapers indisponibles`
- panneau local `Workpapers` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` visibles : oui
- rappel read-only visible : non

### `WORKPAPERS_READY_EMPTY`

Condition :

- `GET /api/closing-folders/{closingFolderId}/workpapers` retourne `200`
- le payload est valide pour le sous-ensemble exact consomme
- `items.length == 0`
- `staleWorkpapers.length == 0`

Rendu exact :

- rappel read-only exact visible
- sous-bloc `Resume workpapers`
  - `anchors courants total : 0`
  - `anchors avec workpaper : 0`
  - `workpapers prets pour revue : 0`
  - `workpapers revus : 0`
  - `workpapers stale : 0`
  - `anchors sans workpaper : 0`
- ligne visible exacte : `aucun workpaper disponible`
- sous-bloc `Workpapers courants`
  - texte exact visible : `aucun workpaper courant`
- sous-bloc `Workpapers stale`
  - texte exact visible : `aucun workpaper stale`
- panneau local `Workpapers` : non
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` visibles : oui

### `WORKPAPERS_READY_WITH_DATA`

Condition :

- `GET /api/closing-folders/{closingFolderId}/workpapers` retourne `200`
- le payload est valide pour le sous-ensemble exact consomme
- `items.length > 0` ou `staleWorkpapers.length > 0`

Rendu exact :

- rappel read-only exact visible
- sous-bloc `Resume workpapers`
  - les six lignes `summaryCounts` sont toujours visibles
- sous-bloc `Workpapers courants`
  - si `items.length == 0`, texte exact visible : `aucun workpaper courant`
  - sinon, cartes workpaper courantes visibles exactement dans l ordre backend de `items[]`
- sous-bloc `Workpapers stale`
  - si `staleWorkpapers.length == 0`, texte exact visible : `aucun workpaper stale`
  - sinon, cartes workpaper stale visibles exactement dans l ordre backend de `staleWorkpapers[]`
- panneau local `Workpapers` : non
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` visibles : oui

## Regles de rendu nominal

### Rendu exact de `summaryCounts`

Le sous-bloc `Resume workpapers` rend exactement dans cet ordre :

1. `anchors courants total : <totalCurrentAnchors>`
2. `anchors avec workpaper : <withWorkpaperCount>`
3. `workpapers prets pour revue : <readyForReviewCount>`
4. `workpapers revus : <reviewedCount>`
5. `workpapers stale : <staleCount>`
6. `anchors sans workpaper : <missingCount>`

### Rendu exact de `items[]`

Chaque element de `items[]` est rendu dans une carte read-only en ordre backend conserve, sans tri local, sans filtre local et sans regroupement local.

Chaque carte `items[]` rend exactement dans cet ordre :

- titre visible exact : `<anchorLabel>`
- ligne visible exacte : `anchor code : <anchorCode>`
- ligne visible exacte : `statement kind : <statementKind>`
- ligne visible exacte : `breakdown type : <breakdownType>`
- si `workpaper == null`
  - ligne visible exacte : `etat workpaper : aucun`
  - sous-section `Documents inclus`
    - texte exact visible : `aucun document inclus`
  - sous-section `Verification documents`
    - omise
- si `workpaper != null`
  - ligne visible exacte : `etat workpaper : <status>`
  - ligne visible exacte : `note workpaper : <noteText>`
  - sous-section `Documents inclus`
    - si `documents.length == 0`, texte exact visible : `aucun document inclus`
    - sinon, lignes documents visibles exactement dans l ordre backend de `documents[]`
  - sous-section `Verification documents`
    - les quatre lignes du resume sont toujours visibles

### Rendu exact de `staleWorkpapers[]`

Chaque element de `staleWorkpapers[]` est rendu dans une carte read-only du sous-bloc `Workpapers stale`, en ordre backend conserve, sans tri local, sans filtre local et sans regroupement local.

Chaque carte `staleWorkpapers[]` rend exactement dans cet ordre :

- titre visible exact : `<anchorLabel>`
- ligne visible exacte : `anchor code : <anchorCode>`
- ligne visible exacte : `statement kind : <statementKind>`
- ligne visible exacte : `breakdown type : <breakdownType>`
- ligne visible exacte : `etat workpaper : <status>`
- ligne visible exacte : `note workpaper : <noteText>`
- sous-section `Documents inclus`
  - si `documents.length == 0`, texte exact visible : `aucun document inclus`
  - sinon, lignes documents visibles exactement dans l ordre backend de `documents[]`
- sous-section `Verification documents`
  - les quatre lignes du resume sont toujours visibles
- `etat workpaper : aucun` n est jamais autorise dans `Workpapers stale`

### Rendu exact des documents inclus

La sous-section `Documents inclus` vit dans chaque carte workpaper.

`documents[]` est un champ consomme et requis par `020`.

- si `documents[]` est absent :
  - le payload est invalide
  - texte exact visible du bloc : `payload workpapers invalide`
- si `documents.length == 0`
  - texte exact visible : `aucun document inclus`
- si `documents.length > 0`
  - une ligne visible exacte par document, dans l ordre backend conserve :
    - `<fileName> | <mediaType> | <sourceLabel> | verification : <verificationStatus>`
- aucun appel endpoint `documents`
- aucun bouton `Uploader un document`
- aucun bouton `Telecharger un document`
- aucun bouton `Prendre une decision reviewer`

### Rendu exact de `documentVerificationSummary`

La sous-section `Verification documents` vit dans chaque carte workpaper.

`documentVerificationSummary` est un champ consomme et requis par `020`.

- si `documentVerificationSummary` est absent :
  - le payload est invalide
  - texte exact visible du bloc : `payload workpapers invalide`
- si `documentVerificationSummary == null`
  - la sous-section `Verification documents` est omise
  - cette omission n est autorisee que pour un item courant avec `workpaper == null`
- si `documentVerificationSummary` est un objet valide, la sous-section rend exactement dans cet ordre :
  1. `documents total : <documentsCount>`
  2. `documents non verifies : <unverifiedCount>`
  3. `documents verifies : <verifiedCount>`
  4. `documents rejetes : <rejectedCount>`
- aucun workflow reviewer document n est ouvert dans `020`
- aucun bouton reviewer document n est autorise

### Regles d ordre et de non-mutation

- l ordre de `items[]` est conserve exactement comme livre par le backend
- l ordre de `staleWorkpapers[]` est conserve exactement comme livre par le backend
- l ordre de `documents[]` est conserve exactement comme livre par le backend
- aucun tri local additionnel n est autorise
- aucun filtre local additionnel n est autorise
- aucune recherche locale additionnelle n est autorisee
- aucune pagination locale additionnelle n est autorisee
- aucun CTA de mutation n est autorise

## Regle metier visible

- texte exact obligatoire dans les etats nominaux `WORKPAPERS_READY_EMPTY` et `WORKPAPERS_READY_WITH_DATA` :
  - `Workpapers en lecture seule dans cette version.`
- ce texte exact n est pas requis dans les etats `loading` et erreur, qui restent des panneaux locaux mono-message
- interdiction produit explicite :
  - ne jamais presenter cette surface comme une zone d edition workpaper
  - ne jamais presenter cette surface comme une zone de review evidence
  - ne jamais introduire un CTA vers documents, exports, review evidence ou edition workpaper depuis `020`

## Regles de non-derive

- `020` n ouvre aucune nouvelle route produit
- `020` n ajoute aucune tabulation produit
- `020` n appelle jamais `PUT /workpapers`
- `020` n appelle jamais `POST /workpapers/{anchorCode}/review-decision`
- `020` n appelle jamais `documents`
- `020` n appelle jamais `exports`
- `020` n appelle jamais `imports/balance/versions`
- `020` n appelle jamais `diff-previous`
- `020` n appelle jamais d endpoint IA
- `020` n ajoute aucun nouveau backend
- `020` n ajoute aucun nouveau contrat OpenAPI
- `020` n introduit aucune mutation
- `020` n introduit aucun etat global de page
- `020` ne declenche aucun refresh global de la route detail
- `020` n introduit aucun workflow `nextAction`
- `020` n introduit aucune navigation automatique ou manuelle basee sur `nextAction.path`
- `020` ne corrige pas les refreshs `Import balance`, `Mapping manuel`, `Financial summary` ou `Financial statements structured`

## Criteres d acceptation frontend

- `specs/active/020-frontend-workpapers-read-model-v1.md` existe
- `/closing-folders/:closingFolderId` reste l unique route produit enrichie par `020`
- aucune nouvelle route produit n est introduite
- aucun nouveau backend n est introduit
- aucun nouveau contrat OpenAPI n est introduit
- le bloc `Workpapers` est place strictement apres `Financial statements structured`
- les blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` restent visibles quand `Workpapers` echoue
- le seul nouvel endpoint consomme par `020` est `GET /api/closing-folders/{closingFolderId}/workpapers`
- l ensemble total des endpoints route detail autorises apres `020` reste borne a :
  - `GET /api/me`
  - `GET /api/closing-folders/{id}`
  - `GET /api/closing-folders/{closingFolderId}/controls`
  - `GET /api/closing-folders/{closingFolderId}/mappings/manual`
  - `PUT /api/closing-folders/{closingFolderId}/mappings/manual`
  - `DELETE /api/closing-folders/{closingFolderId}/mappings/manual`
  - `POST /api/closing-folders/{closingFolderId}/imports/balance`
  - `GET /api/closing-folders/{closingFolderId}/financial-summary`
  - `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
  - `GET /api/closing-folders/{closingFolderId}/workpapers`
- aucun endpoint `documents`, `exports`, `imports/balance/versions`, `diff-previous` ou IA n est appele
- `GET /api/closing-folders/{closingFolderId}/workpapers` est emis seulement apres succes exploitable de `GET /api/me` puis `GET /api/closing-folders/{id}`
- `GET /api/closing-folders/{closingFolderId}/workpapers` est emis une seule fois au chargement initial de la route ; `020` n ajoute aucun retry automatique ni refresh global
- `020` n ajoute aucun rechargement local de `/workpapers` apres succes ou echec d import balance, de `PUT mapping` ou de `DELETE mapping`
- `020` n ajoute aucun rechargement local de `/workpapers` apres succes ou echec de `Financial summary` ou de `Financial statements structured`
- le frontend ne consomme du payload `/workpapers` que le sous-ensemble exact fige dans cette spec
- toute propriete requise absente, invalide ou incoherente du sous-ensemble consomme rend exactement `payload workpapers invalide`
- les champs explicitement non consommes de `/workpapers` ne pilotent ni rendu, ni navigation, ni classification d erreur dans `020`
- `documents[]` est consomme depuis `GET /workpapers`, est requis sur chaque item courant et stale, et son absence rend exactement `payload workpapers invalide`
- `documentVerificationSummary` est consomme depuis `GET /workpapers`, est requis sur chaque item courant et stale, et son absence rend exactement `payload workpapers invalide`
- `documentVerificationSummary == null` n est autorise que pour un item courant avec `workpaper == null`
- `nextAction` et `nextAction.path` ne sont ni rendus comme lien ou bouton, ni lies, ni transformes en navigation produit
- une valeur absente, invalide ou incoherente sur `nextAction`, `nextAction.code`, `nextAction.path` ou `nextAction.actionable` ne change ni le texte visible, ni la navigation, ni la classification locale du bloc `Workpapers`
- `400` est traite comme le meme rendu visible que `unexpected`, sans nouveau workflow
- le rappel exact `Workpapers en lecture seule dans cette version.` est visible en `WORKPAPERS_READY_EMPTY` et `WORKPAPERS_READY_WITH_DATA`
- la sous-section `Documents inclus` est rendue dans chaque carte workpaper ; si `documents.length == 0`, le texte exact visible est `aucun document inclus`
- la sous-section `Verification documents` est omise seulement quand `documentVerificationSummary == null`
- aucun CTA documents, exports, review evidence ou edition workpaper n est introduit
- aucun etat global de page n est introduit par `020` ; le bloc `Workpapers` porte seul ses etats loading / erreur / nominal
- en etat nominal, le frontend conserve l ordre backend de `items[]`, `staleWorkpapers[]` et `documents[]`, n applique aucun tri local et ne masque aucun element parce que son statut ou ses compteurs valent `0`
- `020` reste strictement read-only

## Tests frontend requis

- `pnpm test:ci`
- `pnpm lint`
- `pnpm build`
- tests prouvant que le bloc `Workpapers` est place strictement apres `Financial statements structured`
- tests prouvant que `GET /api/closing-folders/{closingFolderId}/workpapers` n est emis qu apres succes exploitable de `GET /api/me` puis `GET /api/closing-folders/{id}`
- tests prouvant que `GET /api/closing-folders/{closingFolderId}/workpapers` est appele une seule fois au chargement initial et qu aucun retry automatique ni refresh global supplementaire n est declenche par `020`
- tests prouvant que le seul nouvel appel reseau de `020` passe par `GET /api/closing-folders/{closingFolderId}/workpapers`
- tests prouvant qu aucun appel n est emis vers :
  - `PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}`
  - `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
  - tout endpoint `documents`
  - tout endpoint `exports`
  - `imports/balance/versions`
  - `diff-previous`
  - tout endpoint IA
- tests prouvant qu aucun `GET /api/closing-folders/{closingFolderId}/workpapers` additionnel n est emis apres un `POST imports/balance`, un `PUT mappings/manual`, un `DELETE mappings/manual`, ou apres un succes / echec de `Financial summary` ou de `Financial statements structured`
- tests prouvant que les etats visibles exacts sont rendus pour :
  - `chargement workpapers`
  - `workpapers indisponibles` sur `400`
  - `authentification requise`
  - `acces workpapers refuse`
  - `workpapers introuvables`
  - `erreur serveur workpapers`
  - `erreur reseau workpapers`
  - `timeout workpapers`
  - `payload workpapers invalide`
  - `workpapers indisponibles`
  - `aucun workpaper disponible`
- tests prouvant que le payload invalide couvre au minimum :
  - `closingFolderId` incoherent
  - `summaryCounts.totalCurrentAnchors != items.length`
  - `summaryCounts.withWorkpaperCount != count(items where workpaper != null)`
  - `summaryCounts.missingCount != count(items where workpaper == null)`
  - `summaryCounts.staleCount != staleWorkpapers.length`
  - un element `items[]` avec `isCurrentStructure = false`
  - un element `staleWorkpapers[]` avec `isCurrentStructure = true`
  - un `workpaper` objet sans `status`
  - un `workpaper` objet sans `noteText`
  - un item courant sans `documents[]`
  - un item stale sans `documents[]`
  - un item courant sans `documentVerificationSummary`
  - un item stale sans `documentVerificationSummary`
  - un item `workpaper = null` avec `documents[]` non vide
  - un item courant avec `workpaper != null` et `documentVerificationSummary = null`
  - un item stale avec `workpaper = null`
  - un item stale avec `documentVerificationSummary = null`
  - un `documentVerificationSummary` avec somme incoherente des compteurs
  - body `200` non JSON ou illisible
- tests prouvant que `Documents inclus` est rendu dans chaque carte workpaper et que `documents.length == 0` rend exactement `aucun document inclus`
- tests prouvant que `Verification documents` est omis seulement quand un item courant a `workpaper = null` et `documentVerificationSummary = null`
- tests prouvant que les blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` restent visibles quand `Workpapers` retourne `401`, `403`, `404`, `5xx`, erreur reseau, timeout ou payload invalide
- tests prouvant que les memes blocs restent visibles quand `Workpapers` retourne `400`
- tests prouvant qu aucun etat global de page n est introduit et que le bloc `Workpapers` porte seul le loading, l erreur ou le nominal
- tests prouvant que le rappel `Workpapers en lecture seule dans cette version.` est visible en `WORKPAPERS_READY_EMPTY` et `WORKPAPERS_READY_WITH_DATA`
- tests prouvant que `nextAction.path` n est jamais rendu comme lien, bouton ou navigation produit
- tests prouvant qu une valeur absente, invalide ou incoherente sur `nextAction`, `nextAction.code`, `nextAction.path` ou `nextAction.actionable` ne cree ni navigation, ni CTA, ni classification locale d erreur tant que le sous-ensemble consomme reste valide
- tests prouvant qu aucun CTA documents, exports, review evidence ou edition workpaper n est introduit
- tests prouvant que l ordre backend de `items[]`, `staleWorkpapers[]` et `documents[]` est conserve sans tri local
- tests prouvant qu un item courant sans `workpaper` rend exactement `etat workpaper : aucun`
- tests prouvant qu un item stale rend `etat workpaper : <status>` et `note workpaper : <noteText>`, jamais `etat workpaper : aucun`
