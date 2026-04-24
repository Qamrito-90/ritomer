# 023 - Frontend document download only v1

## Status
Active

## Role de cette spec

Cette spec devient la verite normative de `023`.

Elle borne le plus petit enrichissement frontend metier legitime apres `022` pour permettre a l utilisateur de telecharger explicitement un document deja visible dans le bloc `Workpapers` existant sur `/closing-folders/:closingFolderId`, en reutilisant strictement le backend deja livre :

- reutiliser strictement la route existante `/closing-folders/:closingFolderId`
- enrichir strictement le bloc `Workpapers`
- conserver `GET /api/closing-folders/{closingFolderId}/workpapers` comme read-model canonique avant le clic download
- ajouter uniquement la lecture binaire backend deja livree `GET /api/closing-folders/{closingFolderId}/documents/{documentId}/content`
- declencher le download uniquement a partir du document deja visible dans `GET /workpapers`

`023` ne reouvre ni le backend `document-storage-and-evidence-files-v1`, ni `evidence-review-and-verification-v1`, ni `022`, ni `021`, ni `020`, ni `019`, ni `018`, ni `017`, ni `016`, ni `014`, ni les versions d import, ni le diff previous, ni les exports, ni l IA, ni GraphQL.

## Sources de verite

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ai-cadrage-v1.md`
- `docs/product/v1-plan.md`
- `specs/done/022-frontend-document-upload-only-v1.md`
- `specs/done/021-frontend-workpapers-maker-update-v1.md`
- `specs/done/020-frontend-workpapers-read-model-v1.md`
- `specs/done/011-document-storage-and-evidence-files-v1.md`
- `contracts/openapi/documents-api.yaml`
- `contracts/openapi/workpapers-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/workpapers/api/DocumentsController.kt`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/MeController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/DocumentsApiTest.kt`
- `frontend/src/app/router.tsx`
- `frontend/src/lib/api/http.ts`
- `frontend/src/lib/api/me.ts`
- `frontend/src/lib/api/workpapers.ts`
- `docs/ui/ui-foundations-v1.md`

## Decisions fermees

- `023` enrichit uniquement la route existante `/closing-folders/:closingFolderId`.
- `023` ne cree aucune nouvelle route produit.
- `023` ne cree aucun onglet, aucun drawer metier, aucune sous-navigation produit, aucun file manager riche et aucun bulk download.
- `023` conserve l ordre visible exact ferme par `022` :
  - `Dossier courant`
  - `Import balance`
  - `Mapping manuel`
  - `Controles`
  - `Financial summary`
  - `Financial statements structured`
  - `Workpapers`
- `023` n ajoute qu un seul nouvel appel frontend autorise :
  - `GET /api/closing-folders/{closingFolderId}/documents/{documentId}/content`
- `023` conserve `GET /api/closing-folders/{closingFolderId}/workpapers` comme read-model canonique local avant tout clic download.
- `023` n appelle jamais :
  - `GET /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
  - `POST /api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`
  - `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
  - tout endpoint `exports`
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous`
  - tout endpoint IA
- `023` ne transforme jamais `nextAction.path` en navigation produit.
- `023` interdit la navigation directe vers `/api/closing-folders/{closingFolderId}/documents/{documentId}/content`, car le backend exige `X-Tenant-Id`.
- `023` interdit `window.open`, `location.href`, `location.assign`, `location.replace`, `target="_blank"` et tout lien direct vers l endpoint de download.
- `023` choisit un seul mecanisme frontend exact :
  - `fetch` binaire avec header `X-Tenant-Id`
  - lecture du body via `response.blob()`
  - creation d un `blob:` object URL
  - clic programme sur un element `<a download>`
  - nettoyage local de l object URL
- `023` ne passe jamais par `requestJson()` pour le download binaire ; il reutilise seulement la convention timeout de `frontend/src/lib/api/http.ts`, soit `DEFAULT_REQUEST_TIMEOUT_MS = 5000`.
- `023` n ajoute aucun appel reseau supplementaire au chargement initial de la route detail.
- `023` ne declenche aucun refresh de `GET /workpapers` apres succes ou echec de download.
- `023` ne rafraichit ni `GET /api/me`, ni `GET /api/closing-folders/{id}`, ni `GET /controls`, ni `GET /financial-summary`, ni `GET /financial-statements/structured`, ni `GET /mappings/manual`.
- Une seule lecture download document peut etre en vol a la fois sur tout le bloc `Workpapers`.
- Le succes nominal de `023` ne rend aucun message de succes persistant ; le feedback de succes est strictement le telechargement navigateur declenche.
- Le nom de fichier declenche cote navigateur suit exactement cette priorite :
  1. `Content-Disposition` du `GET /documents/{documentId}/content`
  2. `documents[].fileName` du dernier `GET /workpapers` valide
  3. fallback exact `document-<documentId>`
- `023` ne derive jamais un `documentId` a partir de `fileName`, `sourceLabel`, `mediaType` ou d un index de ligne ; le `documentId` vient uniquement du dernier `GET /workpapers` valide.
- `023` preserve strictement le formulaire maker de `021` et la sous-section `Upload document` de `022` ; il n en change ni les preconditions, ni les messages, ni les refreshs.
- `023` preserve `documents[]` et `documentVerificationSummary` strictement read-only ; seul le CTA `Telecharger le document` est ajoute.
- `023` rend le CTA download sur documents `current` et `stale`.
- `023` rend le CTA download possible sur `ARCHIVED`, car le repo prouve que la lecture backend reste autorisee.
- `023` ne gate pas le download sur `readiness`, sur le statut `workpaper`, ni sur `documentVerificationSummary`.

## In scope exact

- enrichissement strict du bloc `Workpapers` sur `/closing-folders/:closingFolderId`
- download unitaire explicite d un document deja visible dans `GET /workpapers`
- consommation du hint `effectiveRoles[]` de `GET /api/me` pour borner les affordances read-only du CTA
- consommation additive de `documents[].id` depuis `GET /workpapers`
- consommation read-only de `documents[].fileName` et `documents[].mediaType` pour fallback local de nom de fichier et de MIME
- lecture binaire de `GET /api/closing-folders/{closingFolderId}/documents/{documentId}/content`
- mecanisme exact `fetch` binaire + `blob` + object URL + clic programme `<a download>`
- affichage exact des etats :
  - idle
  - local invalid
  - downloading
  - `401`
  - `403`
  - `404`
  - `5xx`
  - erreur reseau
  - timeout
  - unexpected
- preservation visible des blocs existants si le download echoue
- tests frontend couvrant l endpoint exact, les headers exacts, le mecanisme exact choisi, la visibilite current/stale/archived, l absence d endpoints hors scope, l absence de refresh inutile et l absence de navigation `nextAction.path`

## Out of scope exact

- toute nouvelle route produit
- toute nouvelle tabulation, drawer metier, stepper metier ou sous-navigation produit
- tout nouveau backend
- tout nouveau contrat OpenAPI
- toute migration
- tout endpoint `GET /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
- tout endpoint `POST /api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`
- tout endpoint `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
- tout upload additionnel hors `022`
- toute mutation reviewer document
- toute mutation reviewer workpaper
- toute review evidence
- tout export pack
- toute lecture des versions d import
- tout diff previous
- GraphQL
- toute IA active
- tout file manager riche
- tout drag and drop metier
- tout bulk download
- tout download dans une nouvelle fenetre ou un nouvel onglet
- toute navigation produit basee sur `nextAction.path`
- tout refresh des blocs `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` ou `Financial statements structured`
- toute transformation de `documents[]` ou `documentVerificationSummary` en surface editable

## Regle d heritage depuis 022

Sauf remplacement explicite dans cette spec, `023` conserve les regles fermees de `022` pour :

- la route `/closing-folders/:closingFolderId`
- l ordre visible des blocs
- le titre `Workpapers`
- le sous-titre visible exact `Maker update unitaire`
- le rappel nominal exact `Mise a jour maker unitaire sur les workpapers courants uniquement.`
- le rendu du formulaire maker de `021`
- le rendu de la sous-section `Upload document` de `022`
- le rendu read-only de `summaryCounts`
- le rendu read-only de `documents[]`
- le rendu read-only de `documentVerificationSummary`
- la preservation de l ordre backend de `items[]`, `staleWorkpapers[]` et `documents[]`
- l absence de CTA `review evidence`, `exports` ou `nextAction.path`
- le traitement local de `400` sur `GET /workpapers` comme la meme branche visible que `unexpected`

## Surface exacte de 023

### `/closing-folders/:closingFolderId`

- statut : unique route produit enrichie par `023`
- la route conserve le shell, le breadcrumb, la sidebar, le contexte tenant et les blocs deja livres
- la route reste une page simple en flux vertical unique
- aucun onglet, aucune sous-navigation et aucune navigation additionnelle ne sont autorises

### Bloc `Workpapers`

- titre visible exact : `Workpapers`
- sous-titre visible exact : `Maker update unitaire`
- le rappel nominal de `022` reste visible :
  - `Mise a jour maker unitaire sur les workpapers courants uniquement.`
- sous-blocs autorises :
  - `Resume workpapers`
  - le slot existant `Etat mutation workpaper`
  - `Workpapers courants`
  - `Workpapers stale`
- sous-sections autorisees dans chaque current item et stale item :
  - toutes les lignes read-only de `020`
  - le formulaire maker de `021` quand il existe
  - la sous-section `Upload document` de `022` quand elle existe
  - `Documents inclus` strictement read-only, enrichie par un CTA download document
  - `Verification documents` strictement read-only
- composants interdits :
  - bouton `Ouvrir le document`
  - bouton `Ouvrir dans un nouvel onglet`
  - bouton `Prendre une decision reviewer`
  - bouton `Ouvrir les exports`
  - lien issu de `nextAction.path`
  - toute liste dediee `documents` hors `GET /workpapers`

### Placement exact de l action download

- l action download apparait uniquement dans chaque ligne document de la sous-section `Documents inclus`
- l action download apparait pour les documents de `items[]`
- l action download apparait pour les documents de `staleWorkpapers[]`
- l action download apparait apres la ligne metadata document read-only
- l action download apparait avant la zone d etat locale de cette ligne document
- aucun bouton download global au niveau du bloc `Workpapers` n est autorise
- aucun bouton download n apparait hors d une ligne document deja visible

### Ligne document telechargeable

Chaque ligne document nominale rend exactement dans cet ordre :

1. la ligne read-only heritee de `020` et `022`
   - `<fileName> | <mediaType> | <sourceLabel> | verification : <verificationStatus>`
2. le bouton exact `Telecharger le document` si la ligne est telechargeable
3. une zone d etat locale mono-message, omise en idle nominal

Contraintes de rendu :

- aucun preview inline du binaire
- aucune miniature
- aucun file viewer
- aucun drag and drop
- aucun historique local de downloads
- aucune indication de progression en pourcentage
- aucun compteur global de downloads

## Visibilite exacte du CTA download

### Documents pouvant afficher le CTA

Le CTA `Telecharger le document` peut apparaitre seulement si toutes les conditions suivantes sont vraies :

- le document appartient au dernier `GET /workpapers` valide actuellement rendu
- le document provient soit de `items[].documents[]`, soit de `staleWorkpapers[].documents[]`
- `documents[].id` est present et valide pour `023`
- `effectiveRoles[]` contient au moins un role prouve de lecture document :
  - `ACCOUNTANT`
  - `REVIEWER`
  - `MANAGER`
  - `ADMIN`

### Documents pouvant rester visibles sans CTA

Le document reste visible mais sans bouton download si :

- `effectiveRoles[]` est absent, invalide ou inexploitable
- `effectiveRoles[]` n expose aucun role de lecture document prouve
- le click handler ne peut pas retrouver le document dans le dernier read-model `GET /workpapers` valide
- `documents[].id` est absent, invalide ou non exploitable

Dans les deux derniers cas ci-dessus, le texte exact visible dans la zone d etat locale est :

- `telechargement indisponible`

### Current, stale, archived et summary

- documents de `items[]` : CTA visible si la ligne est telechargeable
- documents de `staleWorkpapers[]` : CTA visible si la ligne est telechargeable
- `closingFolderStatus = ARCHIVED` : le CTA peut rester visible ; `023` ne bloque pas une lecture autorisee
- `readiness != READY` : n a aucun effet sur le CTA download
- `workpaper.status = DRAFT | CHANGES_REQUESTED | READY_FOR_REVIEW | REVIEWED` : n a aucun effet sur le CTA download
- `documentVerificationSummary = null` ne gate jamais le CTA download
- si `documents.length == 0`, aucun CTA n apparait

## Preconditions de download exactes

### Roles

Preuve repo retenue :

- `GET /api/me` expose `effectiveRoles[]`
- `WorkpaperService` autorise la lecture `workpapers` pour `ACCOUNTANT | REVIEWER | MANAGER | ADMIN`
- `DocumentService` autorise `downloadDocument` pour `ACCOUNTANT | REVIEWER | MANAGER | ADMIN`

Regle frontend exacte :

- si `effectiveRoles[]` contient `ACCOUNTANT`, `REVIEWER`, `MANAGER` ou `ADMIN`, la ligne document peut devenir telechargeable sous reserve des autres preconditions
- si `effectiveRoles[]` est absent, invalide ou inexploitable, la ligne document reste read-only sans CTA
- si `effectiveRoles[]` n expose aucun role de lecture document prouve, la ligne document reste read-only sans CTA
- le frontend ne devine jamais un droit de lecture document a partir d un autre signal que `effectiveRoles[]`
- `effectiveRoles[]` reste un hint d affordance uniquement ; il ne contourne jamais le backend

### Document cible

- le `documentId` doit provenir du dernier `GET /workpapers` valide actuellement rendu
- `documentId` doit correspondre exactement a un element de `items[].documents[]` ou `staleWorkpapers[].documents[]`
- `023` n utilise jamais `anchorCode`, `fileName`, `sourceLabel`, `mediaType` ou l index visuel de ligne comme substitut de `documentId`
- si le click handler ne retrouve pas `documentId` dans le dernier read-model valide
  - aucun `GET /documents/{documentId}/content` n est emis
  - le texte exact visible est `telechargement indisponible`

### Concurrence exacte

- si un download document est deja en vol
  - tout second clic `Telecharger le document`, sur la meme ligne ou une autre, est ignore localement
  - aucun second `GET /documents/{documentId}/content` n est emis
  - le seul texte visible requis sur la ligne active reste `telechargement document en cours`
- cette contrainte de concurrence ne modifie pas les regles de `021` et `022` pour `PUT /workpapers` et `POST /documents`
- `023` n ajoute aucun couplage reseau entre download document et upload document

## Contrat API reel consomme par 023

### Verite unique retenue

`023` consomme exactement le meme ensemble ferme que `022`, plus un seul endpoint additionnel :

- `GET /api/me`
- `GET /api/closing-folders/{id}`
- `GET /api/closing-folders/{closingFolderId}/controls`
- `GET /api/closing-folders/{closingFolderId}/mappings/manual`
- `GET /api/closing-folders/{closingFolderId}/financial-summary`
- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
- `GET /api/closing-folders/{closingFolderId}/workpapers`
- `PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}`
- `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
- `GET /api/closing-folders/{closingFolderId}/documents/{documentId}/content`
- `POST /api/closing-folders/{closingFolderId}/imports/balance`
- `PUT /api/closing-folders/{closingFolderId}/mappings/manual`
- `DELETE /api/closing-folders/{closingFolderId}/mappings/manual`

`023` n ajoute aucun autre endpoint.

### `GET /api/me`

Sous-ensemble exact consomme par `023` :

- `activeTenant.tenantId`
- `activeTenant.tenantSlug`
- `activeTenant.tenantName`
- `effectiveRoles[]` comme hint d affordance seulement

Regle exacte :

- `023` conserve tous les etats shell deja figes par `022`
- `effectiveRoles[]` n est jamais utilise pour contourner le backend
- `effectiveRoles[]` n est jamais transforme en navigation ou workflow

### `GET /api/closing-folders/{closingFolderId}/workpapers`

`023` conserve `GET /workpapers` comme unique source canonique locale des documents visibles et ajoute seulement la consommation de `documents[].id`.

Sous-ensemble exact additionnel consomme par `023`, en plus des regles deja fermees par `020`, `021` et `022` :

- `documents[].id`
  - requis : oui pour qu une ligne document puisse devenir telechargeable
  - type attendu : `string` UUID
  - usage exact :
    - path param de `GET /documents/{documentId}/content`
    - identite locale de la ligne active en etat download
  - fallback si absent, non string, non UUID ou non retrouvable dans le dernier read-model valide :
    - la ligne document reste visible si le rendu `020` reste nominal
    - aucun CTA download
    - texte exact visible : `telechargement indisponible`

- `documents[].fileName`
  - requis : deja requis par `020` pour le rendu read-only de la ligne
  - type attendu : `string`
  - usage exact additionnel dans `023` :
    - fallback de nom de fichier si `Content-Disposition` n est pas recuperable
  - fallback si vide ou whitespace seulement :
    - le fallback `fileName` est ignore
    - `023` continue la resolution du nom via `document-<documentId>`

- `documents[].mediaType`
  - requis : deja requis par `020` pour le rendu read-only de la ligne
  - type attendu : `string`
  - usage exact additionnel dans `023` :
    - fallback MIME local si la reponse binaire `200` n expose pas un `Content-Type` exploitable
  - fallback si vide ou whitespace seulement :
    - le fallback `mediaType` est ignore
    - `023` conserve le `Blob` brut lu depuis la reponse

Champs explicitement non consommes par `023` pour la decision de download :

- `documents[].byteSize`
- `documents[].checksumSha256`
- `documents[].sourceLabel`
- `documents[].documentDate`
- `documents[].createdAt`
- `documents[].createdByUserId`
- `documents[].verificationStatus`
- `documents[].reviewComment`
- `documents[].reviewedAt`
- `documents[].reviewedByUserId`
- `documentVerificationSummary`
- `nextAction`
- `nextAction.code`
- `nextAction.path`
- `nextAction.actionable`

Regle exacte :

- `documents[]` visibles avant le clic proviennent uniquement du dernier `GET /workpapers` valide
- `023` ne relit jamais une liste de documents dediee
- `023` ne reconstruit jamais localement `documents[]`
- le payload `200` du `GET /documents/{documentId}/content` ne remplace jamais `documents[]`

### `GET /api/closing-folders/{closingFolderId}/documents/{documentId}/content`

Preuve repo :

- `contracts/openapi/documents-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/workpapers/api/DocumentsController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/DocumentsApiTest.kt`

Path exact :

- `/api/closing-folders/{closingFolderId}/documents/{documentId}/content`

Methode exacte :

- `GET`

Headers exacts :

- `X-Tenant-Id = activeTenant.tenantId` sur chaque `GET`
- aucun header applicatif additionnel n est introduit par `023`
- `023` ne renseigne jamais `Content-Type`
- `023` ne renseigne jamais `Accept` manuellement

Regle exacte sur le helper HTTP :

- `023` ne passe pas par `requestJson()`, car `requestJson()` force `Accept: application/json`
- `023` reutilise strictement la convention timeout de `http.ts`, soit `DEFAULT_REQUEST_TIMEOUT_MS = 5000`
- `023` suit cette convention avec `AbortController` et une erreur locale exacte `timeout`

Succes frontend exact :

- le seul succes nominal accepte est `200`
- un succes frontend est acquis seulement si :
  - le statut HTTP est `200`
  - la lecture `response.blob()` reussit
  - le navigateur peut declencher le telechargement local via `blob:` URL
- `023` ne parse jamais `response.json()` sur cet endpoint
- `023` ne depend jamais du header `Location`
- `023` ne depend jamais d un payload JSON de succes

Sous-ensemble exact de la reponse `200` consomme cote frontend :

- body binaire
  - requis : oui
  - type attendu : `Blob` issu de `response.blob()`
  - usage exact : source du `blob:` object URL

- `Content-Disposition`
  - requis : non pour classer le `200` en succes
  - type attendu : `string` quand present
  - usage exact :
    - source primaire du nom de fichier si recuperable
  - fallback si absent, vide ou non recuperable :
    - `documents[].fileName`
    - sinon `document-<documentId>`

- `Content-Type`
  - requis : non pour classer le `200` en succes
  - type attendu : `string` quand present
  - usage exact :
    - type MIME primaire du `Blob` telechargeable
  - fallback si absent, vide ou non exploitable :
    - `documents[].mediaType` du dernier `GET /workpapers` valide
    - sinon le `Blob` brut reste utilise tel quel

Champs explicitement non consommes sur le succes `GET /documents/{documentId}/content` :

- `Cache-Control`
- toute autre entete additive

Lecture exacte des erreurs download :

- `401` -> `authentification requise`
- `403` -> `acces documents refuse`
- `404` -> `document introuvable pour telechargement`
- `5xx` -> `erreur serveur documents`
- `400` reste classe dans la meme branche visible que `unexpected`, car `023` n emet pas de `GET` si `documentId` n est pas exploitable
- tout autre statut HTTP non borne -> `telechargement document indisponible`

## Mecanisme frontend exact de download

### Navigation directe interdite

Le backend exige `X-Tenant-Id`. En consequence :

- un lien direct `href="/api/closing-folders/.../documents/.../content"` est interdit
- `window.open("/api/...")` est interdit
- `location.href = "/api/..."` est interdit
- `target="_blank"` est interdit

### Mecanisme exact retenu

Au clic explicite sur `Telecharger le document`, `023` execute exactement :

1. retrouver la ligne document dans le dernier `GET /workpapers` valide actuellement rendu
2. verifier que la ligne est telechargeable selon cette spec
3. emettre `fetch(url, { method: "GET", headers: { "X-Tenant-Id": activeTenant.tenantId }, signal })`
4. lire `await response.blob()`
5. resoudre le MIME final :
   - `Content-Type` reponse si exploitable
   - sinon `documents[].mediaType` si non vide
   - sinon le `Blob` brut
6. resoudre le nom de fichier final :
   - `Content-Disposition` si recuperable
   - sinon `documents[].fileName` si non vide
   - sinon `document-<documentId>`
7. creer un object URL `blob:`
8. creer un element `<a>`
9. affecter `a.href = objectUrl`
10. affecter `a.download = resolvedFileName`
11. inserer temporairement `a` dans le DOM
12. declencher `a.click()`
13. retirer `a`
14. revoquer `objectUrl`
15. revenir a l etat idle sans message de succes persistant

Assemblage exact attendu :

```ts
const response = await fetch(url, {
  method: "GET",
  headers: {
    "X-Tenant-Id": activeTenant.tenantId
  },
  signal: controller.signal
});

const rawBlob = await response.blob();
const typedBlob =
  resolvedMediaType !== null && rawBlob.type === ""
    ? new Blob([rawBlob], { type: resolvedMediaType })
    : rawBlob;

const objectUrl = URL.createObjectURL(typedBlob);
const link = document.createElement("a");
link.href = objectUrl;
link.download = resolvedFileName;
document.body.append(link);
link.click();
link.remove();
URL.revokeObjectURL(objectUrl);
```

### Resolution exacte du nom de fichier

`023` suit exactement cette priorite :

1. `filename*` de `Content-Disposition` si present et decodable
2. sinon `filename` de `Content-Disposition` si present et non vide
3. sinon `documents[].fileName` du dernier read-model `GET /workpapers` valide si non vide apres trim
4. sinon fallback exact `document-<documentId>`

Regles exactes :

- `023` ne tente jamais de deviner une extension a partir de `mediaType`
- `023` n ouvre jamais une fenetre systeme de preview
- `023` ne base jamais le nom de fichier sur `sourceLabel`, `anchorCode` ou `closingFolderId`

### Resolution exacte du MIME local

`023` suit exactement cette priorite :

1. `Content-Type` de la reponse `200` si present et non vide
2. sinon `documents[].mediaType` du dernier read-model `GET /workpapers` valide si non vide apres trim
3. sinon le `Blob` brut issu de `response.blob()`

### Failure locale post-200

Si le `200` est recu mais que l une des operations locales suivantes echoue :

- `response.blob()`
- `URL.createObjectURL`
- creation ou clic du lien temporaire

alors :

- aucun refresh n est emis
- aucun autre endpoint n est appele
- le texte exact visible devient `telechargement document indisponible`

## Sequence reseau exacte

### Chargement initial

- la sequence initiale de `022` reste strictement inchangee
- `023` n ajoute aucun appel reseau supplementaire au chargement initial
- `GET /api/closing-folders/{closingFolderId}/workpapers` reste emis une seule fois au chargement initial de la route detail

### Clic download

1. l utilisateur clique explicitement `Telecharger le document`
2. si la ligne document reste telechargeable et si aucun autre download n est en vol, le frontend emet exactement un `GET /api/closing-folders/{closingFolderId}/documents/{documentId}/content`
3. le `GET` envoie exactement :
   - `X-Tenant-Id = activeTenant.tenantId`
4. le frontend applique exactement la convention timeout de `frontend/src/lib/api/http.ts`, soit `DEFAULT_REQUEST_TIMEOUT_MS = 5000`
5. si les preconditions locales ne sont plus satisfaites au moment du clic
   - aucun appel reseau n est emis
   - le texte exact visible est `telechargement indisponible`
6. pendant ce `GET`, aucun second `GET /documents/{documentId}/content` n est autorise
7. pendant ce `GET`, aucun endpoint hors scope n est autorise

### Sequence exacte apres succes `200`

1. lire le body via `response.blob()`
2. resoudre localement le nom de fichier et le MIME selon cette spec
3. declencher le telechargement navigateur via un object URL `blob:`
4. revenir immediatement a l etat idle nominal de la ligne
5. n afficher aucun message de succes persistant
6. ne lancer aucun refresh `GET /workpapers`
7. ne lancer aucun autre refresh local ou global
8. n autoriser aucun redirect ni aucune nouvelle navigation produit

### Sequence exacte si le download echoue

- le dernier bloc `Workpapers` valide deja affiche reste visible
- les blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` restent visibles
- aucun refresh `GET /workpapers` n est emis
- aucun autre bloc n est rafraichi

## Matrice d etats exacte du bloc `Workpapers`

### Etats de lecture et de precondition locale

#### `DOWNLOAD_IDLE`

Condition :

- ligne document visible
- `documentId` valide
- aucun download en vol
- aucun etat d erreur local actif sur cette ligne
- au moins un role de lecture document prouve est exploitable

Rendu exact :

- bouton exact visible : `Telecharger le document`
- aucun message local de download n est rendu

#### `DOWNLOAD_HIDDEN_ROLE`

Condition :

- ligne document visible
- `effectiveRoles[]` absent, invalide ou sans role de lecture document prouve

Rendu exact :

- aucun bouton download
- aucun message local additionnel obligatoire

#### `DOWNLOAD_LOCAL_INVALID`

Condition :

- ligne document visible
- `documents[].id` absent, invalide ou non retrouvable dans le dernier read-model `GET /workpapers` valide

Rendu exact :

- aucun bouton download
- texte exact visible : `telechargement indisponible`

### Etats de mutation download

#### `DOWNLOAD_SUBMITTING`

Condition :

- un `GET /documents/{documentId}/content` est en cours

Rendu exact :

- tous les boutons download du bloc `Workpapers` sont desactives
- sur la ligne active seulement, texte exact visible : `telechargement document en cours`

#### `DOWNLOAD_SUCCESS_TRIGGERED`

Condition :

- le `GET` retourne `200`
- la lecture `response.blob()` reussit
- le telechargement navigateur est declenche localement

Rendu exact :

- aucun message de succes persistant
- la ligne revient a `DOWNLOAD_IDLE`

#### `DOWNLOAD_AUTH_REQUIRED`

Condition :

- le `GET` retourne `401`

Rendu exact :

- texte exact visible : `authentification requise`

#### `DOWNLOAD_FORBIDDEN`

Condition :

- le `GET` retourne `403`

Rendu exact :

- texte exact visible : `acces documents refuse`

#### `DOWNLOAD_NOT_FOUND`

Condition :

- le `GET` retourne `404`

Rendu exact :

- texte exact visible : `document introuvable pour telechargement`

#### `DOWNLOAD_SERVER_ERROR`

Condition :

- le `GET` retourne `5xx`

Rendu exact :

- texte exact visible : `erreur serveur documents`

#### `DOWNLOAD_NETWORK_ERROR`

Condition :

- le `GET` echoue pour erreur reseau

Rendu exact :

- texte exact visible : `erreur reseau documents`

#### `DOWNLOAD_TIMEOUT`

Condition :

- le `GET` echoue par timeout selon la convention de `frontend/src/lib/api/http.ts`

Rendu exact :

- texte exact visible : `timeout documents`

#### `DOWNLOAD_UNEXPECTED`

Condition :

- le `GET` retourne `400`
- ou le `GET` retourne un statut non explicitement borne par cette spec
- ou la lecture locale du `200` echoue
- ou le telechargement navigateur local ne peut pas etre declenche

Rendu exact :

- texte exact visible : `telechargement document indisponible`

## Regles de rendu et textes exacts

- texte exact du bouton download : `Telecharger le document`
- texte exact de l idle : aucun message local de download
- texte exact du local invalid : `telechargement indisponible`
- texte exact du downloading : `telechargement document en cours`
- texte exact du succes : aucun message de succes persistant
- texte exact du `401` : `authentification requise`
- texte exact du `403` : `acces documents refuse`
- texte exact du `404` : `document introuvable pour telechargement`
- texte exact du `5xx` : `erreur serveur documents`
- texte exact du reseau : `erreur reseau documents`
- texte exact du timeout : `timeout documents`
- texte exact du unexpected : `telechargement document indisponible`

## Garde-fous anti-scope

- `023` n appelle jamais `GET /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
- `023` n appelle jamais `POST /api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`
- `023` n appelle jamais `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
- `023` n appelle aucun endpoint upload supplementaire
- `023` n appelle aucun endpoint review document
- `023` n appelle aucun endpoint review workpaper
- `023` n appelle aucun endpoint exports
- `023` n appelle aucun endpoint import versions
- `023` n appelle aucun endpoint diff previous
- `023` n appelle aucun endpoint IA
- `023` ne transforme jamais `nextAction.path` en navigation produit
- `023` ne cree aucun file manager riche
- `023` ne propose aucun bulk download
- `023` n introduit aucune navigation directe vers `/api/closing-folders/{closingFolderId}/documents/{documentId}/content`
- `023` ne modifie pas les refreshs `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` ou `Financial statements structured`
- `023` ne convertit jamais `documents[]` ou `documentVerificationSummary` en surface editable
- `023` ne modifie pas les regles upload de `022` au-dela de la simple coexistence UI

## Criteres d acceptation frontend

- `specs/active/023-frontend-document-download-only-v1.md` existe
- `/closing-folders/:closingFolderId` reste l unique route produit enrichie par `023`
- aucun nouveau backend n est introduit
- aucun nouveau contrat OpenAPI n est introduit
- le bloc `Workpapers` reste place strictement apres `Financial statements structured`
- `023` n ajoute qu un seul nouvel endpoint consomme :
  - `GET /api/closing-folders/{closingFolderId}/documents/{documentId}/content`
- `GET /api/closing-folders/{closingFolderId}/workpapers` reste le read-model canonique avant tout clic download
- aucun nouvel appel reseau n est emis au chargement initial de la route detail
- le CTA download peut apparaitre sur documents `current`
- le CTA download peut apparaitre sur documents `stale`
- le CTA download peut apparaitre sur `ARCHIVED`
- `023` ne gate pas le CTA sur `readiness != READY`
- `023` ne gate pas le CTA sur le statut `workpaper`
- `documentVerificationSummary` ne devient jamais un gate de download
- aucun CTA download n apparait si `effectiveRoles[]` est absent, invalide ou sans role de lecture document prouve
- aucun CTA download n apparait si `documents[].id` est absent, invalide ou non exploitable
- une ligne document visible avec `documents[].id` absent ou invalide reste visible mais rend exactement `telechargement indisponible`
- un seul download document peut etre en vol a la fois
- le `GET` utilise exactement le path `/api/closing-folders/{closingFolderId}/documents/{documentId}/content`
- `documentId` provient toujours du dernier `GET /workpapers` valide
- le `GET` utilise toujours `X-Tenant-Id = activeTenant.tenantId`
- le `GET` n envoie jamais `Content-Type`
- le `GET` n envoie jamais `Accept` manuellement
- le download utilise exactement `fetch` binaire + `response.blob()` + object URL `blob:` + clic programme `<a download>`
- aucune navigation directe vers l endpoint API n est autorisee
- aucune nouvelle fenetre ou aucun nouvel onglet n est autorise
- le nom de fichier est resolu selon la priorite exacte :
  - `Content-Disposition`
  - `documents[].fileName`
  - `document-<documentId>`
- le MIME local est resolu selon la priorite exacte :
  - `Content-Type`
  - `documents[].mediaType`
  - `Blob` brut
- les etats visibles exacts sont testables pour :
  - idle sans message
  - local invalid
  - downloading
  - `401`
  - `403`
  - `404`
  - `5xx`
  - erreur reseau
  - timeout
  - unexpected
- en cas d echec de download, les blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary`, `Financial statements structured` et `Workpapers` restent visibles
- apres succes `200`, aucun refresh `GET /workpapers` n est emis
- apres succes `200`, aucun autre bloc n est rafraichi
- aucun endpoint `GET /workpapers/{anchorCode}/documents`, `POST /documents/{documentId}/verification-decision`, `POST /workpapers/{anchorCode}/review-decision`, `exports`, `imports/balance/versions`, `diff-previous` ou IA n est appele
- `nextAction.path` ne devient jamais un lien, un bouton ou une navigation produit

## Tests frontend requis

- `pnpm test:ci`
- `pnpm lint`
- `pnpm build`
- tests prouvant que le bloc `Workpapers` reste place strictement apres `Financial statements structured`
- tests prouvant que `023` n ajoute aucun nouvel appel reseau au chargement initial de la route detail
- tests prouvant que le seul nouvel endpoint consomme par `023` est `GET /api/closing-folders/{closingFolderId}/documents/{documentId}/content`
- tests prouvant que le `GET` utilise exactement le path `/api/closing-folders/{closingFolderId}/documents/{documentId}/content`
- tests prouvant que `documentId` provient du document visible du dernier `GET /workpapers` valide
- tests prouvant que le `GET` envoie exactement le header `X-Tenant-Id`
- tests prouvant l absence de `Content-Type` manuel
- tests prouvant l absence de `Accept` manuel
- tests prouvant que `023` suit la convention timeout `DEFAULT_REQUEST_TIMEOUT_MS = 5000`
- tests prouvant que le succes `200` lit le body via `response.blob()` et jamais via `response.json()`
- tests prouvant que le download nominal cree un object URL `blob:`, cree un lien temporaire, renseigne `download`, declenche `click()`, puis nettoie le lien et revoque l object URL
- tests prouvant que le nom de fichier suit exactement la priorite :
  - `filename*` de `Content-Disposition`
  - `filename` de `Content-Disposition`
  - `documents[].fileName`
  - `document-<documentId>`
- tests prouvant que le MIME local suit exactement la priorite :
  - `Content-Type`
  - `documents[].mediaType`
  - `Blob` brut
- tests prouvant qu aucune navigation directe vers l endpoint API n est utilisee
- tests prouvant qu aucun `window.open`, `location.assign`, `location.replace`, `location.href` ou `target="_blank"` n est utilise
- tests prouvant que le CTA download apparait sur documents `current`
- tests prouvant que le CTA download apparait sur documents `stale`
- tests prouvant que le CTA download apparait sur `ARCHIVED`
- tests prouvant que `readiness != READY` ne masque pas le CTA download
- tests prouvant que `documentVerificationSummary` ne gate pas le CTA download
- tests prouvant qu aucun CTA n apparait si `effectiveRoles[]` est absent, invalide ou sans role de lecture document prouve
- tests prouvant qu une ligne document visible avec `documents[].id` absent ou invalide rend exactement `telechargement indisponible` sans appel reseau
- tests prouvant qu un seul download document peut etre en vol a la fois
- tests prouvant qu aucun refresh `GET /workpapers`, `GET /api/me`, `GET /api/closing-folders/{id}`, `GET /controls`, `GET /financial-summary`, `GET /financial-statements/structured` ou `GET /mappings/manual` n est ajoute apres succes ou echec de download
- tests prouvant les textes visibles exacts pour :
  - idle sans message
  - `telechargement indisponible`
  - `telechargement document en cours`
  - `authentification requise`
  - `acces documents refuse`
  - `document introuvable pour telechargement`
  - `erreur serveur documents`
  - `erreur reseau documents`
  - `timeout documents`
  - `telechargement document indisponible`
- tests prouvant qu aucun endpoint `GET /workpapers/{anchorCode}/documents`, `POST /documents/{documentId}/verification-decision`, `POST /workpapers/{anchorCode}/review-decision`, `exports`, `imports/balance/versions`, `diff-previous` ou IA n est appele
- tests prouvant que les blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary`, `Financial statements structured` et `Workpapers` restent visibles si le download echoue
- tests prouvant que `nextAction.path` n est jamais rendu comme lien, bouton ou navigation produit
