# 025 - Frontend document verification decision only v1

## Status
Done

## Role de cette spec

Cette spec devient la verite normative de `025`.

Elle borne le plus petit enrichissement frontend utile apres `024` pour permettre a un reviewer de prendre une decision de verification sur un document deja visible dans le bloc `Workpapers`, depuis la route existante `/closing-folders/:closingFolderId`, en reutilisant strictement le backend deja livre.

`025` n'ouvre aucune autre capacite produit. `025` ne cree aucune nouvelle route, ne modifie aucun backend, ne modifie aucun contrat OpenAPI, ne propose pas GraphQL et n'active aucune IA.

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
- `specs/done/024-frontend-workpapers-panel-extraction-v1.md`
- `specs/done/023-frontend-document-download-only-v1.md`
- `specs/done/022-frontend-document-upload-only-v1.md`
- `specs/done/021-frontend-workpapers-maker-update-v1.md`
- `contracts/openapi/documents-api.yaml`
- `contracts/openapi/workpapers-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/workpapers/api/DocumentsController.kt`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/workpapers/application/DocumentService.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/DocumentsApiTest.kt`
- `frontend/src/app/workpapers-panel.tsx`
- `frontend/src/lib/api/workpapers.ts`
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

- `024` a ferme documentalement l'extraction de la surface `Workpapers` dans `frontend/src/app/workpapers-panel.tsx`.
- `frontend/src/app/router.tsx` compose deja `WorkpapersPanel` sur `/closing-folders/:closingFolderId` et lui transmet `activeTenant`, `closingFolder`, `closingFolderId`, `effectiveRoles` et `initialState`.
- `router.tsx` garde le chargement initial de `GET /workpapers`; `WorkpapersPanel` porte les handlers locaux maker, upload document et download document.
- `GET /api/closing-folders/{closingFolderId}/workpapers` est le read-model canonique du bloc `Workpapers`.
- `frontend/src/lib/api/workpapers.ts` porte deja la couture API `GET /workpapers`, `PUT /workpapers/{anchorCode}`, `POST /workpapers/{anchorCode}/documents` et `GET /documents/{documentId}/content`.
- `frontend/src/lib/api/http.ts` fixe la convention timeout frontend a `DEFAULT_REQUEST_TIMEOUT_MS = 5000` et `requestJson()` ajoute `Accept: application/json`.
- `contracts/openapi/documents-api.yaml` expose `POST /api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`.
- `DocumentsController.reviewDecision()` mappe exactement `POST /documents/{documentId}/verification-decision` vers `DocumentService.reviewVerificationDecision(...)`.
- Le body backend est `DocumentVerificationDecisionRequest` avec :
  - `decision`
  - `comment`
- Les decisions document acceptees sont prouvees par OpenAPI et `DocumentService` :
  - `VERIFIED`
  - `REJECTED`
- `comment` est prouve requis pour `decision = REJECTED` par `contracts/openapi/documents-api.yaml` et `DocumentService.normalizeRequired(...)`.
- `comment` est prouve interdit pour `decision = VERIFIED` par `contracts/openapi/documents-api.yaml`, `DocumentService` et `DocumentsApiTest`.
- Le gate `current only` est prouve par `DocumentService.resolveVerificationTarget(...)` et par `DocumentsApiTest` qui attend `409` sur document stale.
- Le gate `controls.readiness = READY` est prouve par `contracts/openapi/documents-api.yaml`, `DocumentService.ensureWritable(...)` et `DocumentsApiTest` qui attend `409` quand les controles ne sont pas `READY`.
- Le gate parent workpaper `READY_FOR_REVIEW` est prouve par `contracts/openapi/documents-api.yaml` et `DocumentService.resolveVerificationTarget(...)`.
- Le gate `closingFolderStatus != ARCHIVED` est prouve par `contracts/openapi/documents-api.yaml`, `DocumentService.ensureWritable(...)` et `DocumentsApiTest` qui attend `409` sur closing archive.
- Les roles reviewer prouvables pour la mutation document sont `REVIEWER`, `MANAGER`, `ADMIN` via `DocumentService.REVIEWER_ROLES`.
- `DocumentsApiTest` prouve qu'un `ACCOUNTANT` est refuse sur `verification-decision`.
- Un succes `POST /verification-decision` retourne `200` avec un `DocumentSummary`.
- Une requete no-op exacte retourne `200` sans nouvel audit event.
- Une mutation reelle emet `DOCUMENT.VERIFICATION_UPDATED`.
- Apres decision, `GET /workpapers` expose le nouveau `documents[].verificationStatus`, `documents[].reviewComment` et le `documentVerificationSummary` derive.

### Plausible mais non prouve

- Une modale, un drawer, une sous-navigation ou un ecran dedie pourraient rendre la decision plus confortable, mais le repo ne prouve pas qu'ils soient necessaires pour `025`.
- Un workflow reviewer workpaper complet pourrait sembler proche, mais il releve de `POST /workpapers/{anchorCode}/review-decision`, explicitement hors scope ici.
- La consommation frontend de `documents[].reviewedAt` et `documents[].reviewedByUserId` pourrait etre utile plus tard pour un audit visible plus riche, mais `025` n'en a pas besoin pour permettre la decision.
- Un refresh de `controls`, `financial-summary`, `financial-statements/structured`, `mappings/manual`, `GET /api/me` ou `GET /closing-folders/{id}` apres decision pourrait sembler defensif, mais le repo ne prouve pas qu'il soit requis.
- Un endpoint dedie de liste documents pourrait sembler utile, mais le repo a deja fige `GET /workpapers` comme read-model canonique local.

### Bloquant

- Aucun bloquant repo n'est prouve pour figer `025`.
- `current only`, `controls.readiness = READY`, parent workpaper `READY_FOR_REVIEW` et `comment` requis pour `REJECTED` sont prouves par le repo et peuvent etre figes.

### Hors scope

- toute nouvelle route produit
- toute nouvelle surface hors `WorkpapersPanel`
- tout changement backend
- tout changement OpenAPI
- tout endpoint `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
- tout endpoint `exports`
- `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`
- `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous`
- tout endpoint IA
- GraphQL
- toute IA active
- toute decision reviewer workpaper
- toute decision bulk document
- toute navigation produit basee sur `nextAction.path`
- toute reintroduction de logique locale Workpapers dans `router.tsx`

## Decisions fermees

- `025` reutilise strictement la route produit existante `/closing-folders/:closingFolderId`.
- `025` enrichit strictement `frontend/src/app/workpapers-panel.tsx`.
- `025` n'ajoute qu'un seul nouvel endpoint frontend autorise :
  - `POST /api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`
- `025` conserve `GET /api/closing-folders/{closingFolderId}/workpapers` comme read-model canonique avant et apres decision.
- Apres tout `POST /verification-decision` avec succes payload valide, `025` lance exactement un refresh local `GET /workpapers`.
- Le payload succes du `POST /verification-decision` ne remplace jamais directement `items[].documents[]`.
- Le bloc `Workpapers` affiche la decision reviewer document uniquement sur les documents de `items[]` eligibles.
- Les documents de `staleWorkpapers[]` restent strictement read-only pour la decision reviewer document.
- `025` ne modifie pas les regles maker, upload ou download deja fermees par `021`, `022` et `023`.
- `025` ne modifie pas le chargement initial de la route detail.
- `025` ne transforme jamais `nextAction.path` en lien, bouton ou navigation produit.
- `025` ne deplace aucune responsabilite Workpapers dans `router.tsx`.

## In scope exact

- ajout d'une decision reviewer document unitaire dans `WorkpapersPanel`
- ajout de la couture API frontend pour `POST /documents/{documentId}/verification-decision` dans `frontend/src/lib/api/workpapers.ts`
- consommation du hint `effectiveRoles[]` pour borner l'affordance reviewer
- consommation stricte de `closingFolderStatus`, `readiness`, `items[]`, `items[].workpaper.status`, `items[].documents[].id`, `items[].documents[].verificationStatus` et `items[].documents[].reviewComment` depuis `GET /workpapers`
- decision locale explicite :
  - `VERIFIED`
  - `REJECTED`
- commentaire reviewer local obligatoire pour `REJECTED`
- absence de commentaire emis pour `VERIFIED`
- etats visibles exacts de decision document
- refresh local strict de `GET /workpapers` apres succes payload valide
- tests frontend et API frontend de cette seule capacite

## Out of scope exact

- creer une page documents
- creer une route de review
- creer un drawer ou une modale de review
- appeler une liste dediee de documents
- appeler `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
- reviewer le workpaper parent
- changer le statut du workpaper parent depuis `025`
- declencher un export
- relire les versions d'import ou le diff previous
- appeler un endpoint IA
- ajouter un workflow bulk
- ajouter une confirmation globale
- modifier les contrats OpenAPI
- modifier le backend
- modifier les audits backend
- ajouter de la logique locale Workpapers dans `router.tsx`

## Surface exacte dans `WorkpapersPanel`

### Route

- route unique : `/closing-folders/:closingFolderId`
- aucun nouvel onglet
- aucune sous-navigation
- aucun lien produit issu de `nextAction.path`

### Bloc `Workpapers`

Le bloc garde les sous-blocs deja livres :

- `Resume workpapers`
- `Etat mutation workpaper`
- `Workpapers courants`
- `Workpapers stale`

`025` ajoute seulement une zone locale de decision dans chaque ligne document eligible de `Workpapers courants`.

### Placement exact de la decision document

Dans chaque ligne document de `items[].documents[]`, l'ordre devient :

1. ligne metadata read-only deja livree :
   - `<fileName> | <mediaType> | <sourceLabel> | verification : <verificationStatus>`
2. CTA download existant `Telecharger le document` quand il est visible selon `023`
3. zone d'etat download existante quand elle est visible selon `023`
4. zone `Decision reviewer document` quand le document est eligible selon `025`
5. zone d'etat locale de decision document, omise en idle nominal

La zone `Decision reviewer document` contient exactement :

1. libelle exact `Decision reviewer document`
2. select `Decision reviewer document`
   - options exactes :
     - `VERIFIED`
     - `REJECTED`
3. textarea `Commentaire reviewer`, visible seulement quand la decision locale vaut `REJECTED`
4. bouton exact `Enregistrer la decision document`

### Documents eligibles pour afficher la decision

La zone decision peut apparaitre seulement si toutes les conditions suivantes sont vraies :

- le document vient du dernier `GET /workpapers` valide actuellement rendu
- le document vient de `items[].documents[]`
- l'item parent a `isCurrentStructure = true`
- l'item parent a `workpaper != null`
- l'item parent a `workpaper.status = READY_FOR_REVIEW`
- `closingFolderStatus != ARCHIVED`
- `readiness = READY`
- `documents[].id` est un UUID exploitable
- `effectiveRoles[]` contient au moins un role reviewer prouve :
  - `REVIEWER`
  - `MANAGER`
  - `ADMIN`

### Documents non eligibles

- `staleWorkpapers[].documents[]` : aucune zone decision, aucun `POST`
- current document sans `documents[].id` UUID exploitable : aucune zone decision, texte exact `decision document indisponible`
- current item sans `workpaper` : aucune zone decision, texte exact `decision document disponible quand le workpaper est READY_FOR_REVIEW`
- current item avec `workpaper.status != READY_FOR_REVIEW` : aucune zone decision, texte exact `decision document disponible quand le workpaper est READY_FOR_REVIEW`
- `closingFolderStatus = ARCHIVED` : aucune zone decision, texte exact `dossier archive, verification document en lecture seule`
- `readiness != READY` : aucune zone decision, texte exact `verification document non modifiable tant que les controles ne sont pas READY`
- aucun role reviewer prouve dans `effectiveRoles[]` : aucune zone decision, texte exact `verification reviewer en lecture seule`

## Preconditions exactes

### Priorite locale de blocage

Pour toute tentative de decision document, la priorite locale est :

1. `closingFolderStatus = ARCHIVED`
2. `readiness != READY`
3. aucun role reviewer prouve exploitable
4. document absent du dernier `items[].documents[]` valide
5. `item.isCurrentStructure != true`
6. `item.workpaper = null`
7. `item.workpaper.status != READY_FOR_REVIEW`
8. `documents[].id` absent, invalide ou non UUID
9. une decision document est deja en vol
10. decision locale hors `VERIFIED | REJECTED`
11. `decision = REJECTED` avec commentaire trimme vide

Quand une cause de priorite plus haute s'applique, `025` n'affiche pas un message concurrent de priorite plus basse pour la meme ligne document.

### Roles

- `effectiveRoles[]` est un hint d'affordance uniquement.
- Le frontend autorise l'affordance decision si `effectiveRoles[]` contient `REVIEWER`, `MANAGER` ou `ADMIN`.
- Le frontend n'autorise pas l'affordance decision si `effectiveRoles[]` contient seulement `ACCOUNTANT` parmi les roles prouvables.
- Le frontend ne devine jamais un droit reviewer document depuis un autre signal.
- Le backend reste l'autorite finale.

### Draft local

- Chaque document eligible a un draft local independant.
- Decision initiale :
  - si `documents[].verificationStatus = VERIFIED`, decision locale initiale `VERIFIED`
  - si `documents[].verificationStatus = REJECTED`, decision locale initiale `REJECTED`
  - si `documents[].verificationStatus = UNVERIFIED`, decision locale initiale `VERIFIED`
- Commentaire initial :
  - si `documents[].reviewComment` est une string non vide, valeur locale initiale = cette valeur
  - sinon valeur locale initiale = `""`
- Si la decision locale vaut `VERIFIED`, le commentaire n'est jamais emis.
- Si la decision locale vaut `REJECTED`, le commentaire est trimme avant emission et doit etre non vide.

## Body exact de la decision reviewer

### `VERIFIED`

Le body emis est exactement :

```json
{
  "decision": "VERIFIED"
}
```

Regles exactes :

- aucun champ `comment`
- aucun champ `documentId`
- aucun champ `anchorCode`
- aucun champ `workpaperId`
- aucun champ `reviewComment`
- aucun champ additionnel

### `REJECTED`

Le body emis est exactement :

```json
{
  "decision": "REJECTED",
  "comment": "<commentaire reviewer trimme non vide>"
}
```

Regles exactes :

- `comment` est obligatoire
- `comment` est trimme avant emission
- `comment` n'est jamais `null`
- `comment` n'est jamais une string vide
- aucun champ `documentId`
- aucun champ `anchorCode`
- aucun champ `workpaperId`
- aucun champ `reviewComment`
- aucun champ additionnel

## Contrat API frontend consomme par `025`

### Ensemble ferme d'endpoints

`025` conserve les endpoints deja consommes par la route detail et ajoute uniquement :

- `POST /api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`

`025` ne modifie pas la sequence initiale qui consomme deja :

- `GET /api/me`
- `GET /api/closing-folders/{id}`
- `GET /api/closing-folders/{closingFolderId}/controls`
- `GET /api/closing-folders/{closingFolderId}/mappings/manual`
- `GET /api/closing-folders/{closingFolderId}/financial-summary`
- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
- `GET /api/closing-folders/{closingFolderId}/workpapers`

### `GET /api/me`

Sous-ensemble exact consomme par `025` :

- `activeTenant.tenantId`
- `effectiveRoles[]`

Regles :

- `activeTenant.tenantId` alimente le header `X-Tenant-Id`
- `effectiveRoles[]` reste un hint d'affordance
- aucun droit backend n'est infere seulement cote frontend

### `GET /api/closing-folders/{closingFolderId}/workpapers`

Sous-ensemble exact consomme par `025` :

- `closingFolderId`
- `closingFolderStatus`
- `readiness`
- `items[]`
- `items[].anchorCode`
- `items[].isCurrentStructure`
- `items[].workpaper.status`
- `items[].documents[]`
- `items[].documents[].id`
- `items[].documents[].fileName`
- `items[].documents[].mediaType`
- `items[].documents[].sourceLabel`
- `items[].documents[].verificationStatus`
- `items[].documents[].reviewComment`
- `items[].documentVerificationSummary`
- `staleWorkpapers[]` en lecture seule uniquement

Champs explicitement non consommes par `025` pour decider ou emettre le `POST` :

- `documents[].byteSize`
- `documents[].checksumSha256`
- `documents[].documentDate`
- `documents[].createdAt`
- `documents[].createdByUserId`
- `documents[].reviewedAt`
- `documents[].reviewedByUserId`
- `workpaper.reviewComment`
- `workpaper.reviewedAt`
- `workpaper.reviewedByUserId`
- `nextAction`
- `nextAction.code`
- `nextAction.path`
- `nextAction.actionable`

### `POST /api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`

Path exact :

- `/api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`

Methode exacte :

- `POST`

Headers exacts :

- `Accept: application/json`
- `Content-Type: application/json`
- `X-Tenant-Id = activeTenant.tenantId`

Convention timeout :

- `DEFAULT_REQUEST_TIMEOUT_MS = 5000`

Sous-ensemble exact du succes `200` consomme cote frontend :

- `id`
  - requis : oui
  - coherence : doit etre egal au `documentId` path
- `verificationStatus`
  - requis : oui
  - coherence : doit etre egal a la decision envoyee
- `reviewComment`
  - requis : oui
  - coherence si `VERIFIED` : `null`
  - coherence si `REJECTED` : egal au commentaire trimme envoye

Champs explicitement non consommes sur le succes `POST` :

- `fileName`
- `mediaType`
- `byteSize`
- `checksumSha256`
- `sourceLabel`
- `documentDate`
- `createdAt`
- `createdByUserId`
- `reviewedAt`
- `reviewedByUserId`

Regle :

- ces champs peuvent rester valides contractuellement, mais le read-model visible apres succes vient uniquement du refresh `GET /workpapers`

## Sequence reseau exacte

### Chargement initial

- identique a `024`
- aucun nouvel appel reseau au mount de `WorkpapersPanel`
- aucun `POST /verification-decision` au chargement
- aucun endpoint hors scope au chargement

### Saisie locale

1. l'utilisateur choisit `VERIFIED` ou `REJECTED`
2. l'utilisateur renseigne `Commentaire reviewer` seulement pour `REJECTED`
3. aucun appel reseau n'est emis sur `change`, `input` ou `blur`

### Clic `Enregistrer la decision document`

1. le frontend retrouve le document dans le dernier `GET /workpapers` valide actuellement rendu
2. le frontend applique les preconditions locales dans l'ordre de cette spec
3. si une precondition echoue, aucun appel reseau n'est emis
4. si les preconditions sont satisfaites, le frontend emet exactement un `POST /api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`
5. pendant ce `POST`, aucun second `POST /verification-decision` n'est autorise
6. pendant ce `POST`, aucun endpoint hors scope n'est autorise

### Apres succes `200` avec payload valide

1. afficher `decision document enregistree avec succes`
2. lancer exactement un `GET /api/closing-folders/{closingFolderId}/workpapers`
3. si le refresh retourne un read-model valide, remplacer integralement le read-model local `Workpapers`
4. les documents visibles apres succes proviennent uniquement du payload rafraichi de `GET /workpapers`
5. aucun autre bloc n'est rafraichi
6. aucune navigation produit n'est declenchee

### Si le refresh `GET /workpapers` echoue apres succes

- le succes decision reste acquis
- le dernier bloc `Workpapers` valide deja affiche reste visible
- le texte exact additionnel visible est `rafraichissement workpapers impossible`
- aucun autre endpoint n'est appele pour compenser

## Matrice d'etats visible exacte

### Etats locaux de precondition

#### `DOCUMENT_DECISION_IDLE`

Condition :

- document eligible
- aucun `POST /verification-decision` en cours
- draft local valide

Rendu :

- zone `Decision reviewer document`
- bouton `Enregistrer la decision document` actif
- aucun message local

#### `DOCUMENT_DECISION_COMMENT_REQUIRED`

Condition :

- document eligible
- decision locale `REJECTED`
- commentaire trimme vide

Rendu :

- zone `Decision reviewer document`
- bouton `Enregistrer la decision document` desactive
- texte exact : `commentaire reviewer requis`

#### `DOCUMENT_DECISION_READ_ONLY_ROLE`

Condition :

- aucun role reviewer prouve exploitable

Rendu :

- aucune zone decision
- texte exact : `verification reviewer en lecture seule`

#### `DOCUMENT_DECISION_READ_ONLY_ARCHIVED`

Condition :

- `closingFolderStatus = ARCHIVED`

Rendu :

- aucune zone decision
- texte exact : `dossier archive, verification document en lecture seule`

#### `DOCUMENT_DECISION_READ_ONLY_NOT_READY`

Condition :

- `closingFolderStatus != ARCHIVED`
- `readiness != READY`

Rendu :

- aucune zone decision
- texte exact : `verification document non modifiable tant que les controles ne sont pas READY`

#### `DOCUMENT_DECISION_WORKPAPER_NOT_READY_FOR_REVIEW`

Condition :

- current item document visible
- workpaper parent absent ou `workpaper.status != READY_FOR_REVIEW`
- aucune cause plus prioritaire

Rendu :

- aucune zone decision
- texte exact : `decision document disponible quand le workpaper est READY_FOR_REVIEW`

#### `DOCUMENT_DECISION_LOCAL_INVALID`

Condition :

- document visible
- `documents[].id` absent, invalide, non UUID ou non retrouvable dans le dernier read-model valide

Rendu :

- aucune zone decision
- texte exact : `decision document indisponible`

### Etats de mutation

#### `DOCUMENT_DECISION_SUBMITTING`

Condition :

- un `POST /verification-decision` est en cours

Rendu :

- tous les boutons `Enregistrer la decision document` sont desactives
- sur la ligne active seulement, texte exact : `decision document en cours`

#### `DOCUMENT_DECISION_SUCCESS`

Condition :

- le `POST` retourne `200`
- le payload succes est valide

Rendu :

- texte exact : `decision document enregistree avec succes`

#### `DOCUMENT_DECISION_BAD_REQUEST`

Condition :

- le `POST` retourne `400`

Rendu :

- texte exact : `decision document invalide`

#### `DOCUMENT_DECISION_AUTH_REQUIRED`

Condition :

- le `POST` retourne `401`

Rendu :

- texte exact : `authentification requise`

#### `DOCUMENT_DECISION_FORBIDDEN`

Condition :

- le `POST` retourne `403`

Rendu :

- texte exact : `acces verification document refuse`

#### `DOCUMENT_DECISION_NOT_FOUND`

Condition :

- le `POST` retourne `404`

Rendu :

- texte exact : `document introuvable pour decision`

#### `DOCUMENT_DECISION_CONFLICT_ARCHIVED`

Condition :

- le `POST` retourne `409` avec raffinement archive prouve

Rendu :

- texte exact : `dossier archive, verification document non modifiable`

#### `DOCUMENT_DECISION_CONFLICT_NOT_READY`

Condition :

- le `POST` retourne `409` avec raffinement readiness prouve

Rendu :

- texte exact : `verification document non modifiable tant que les controles ne sont pas READY`

#### `DOCUMENT_DECISION_CONFLICT_STALE`

Condition :

- le `POST` retourne `409` avec raffinement stale prouve

Rendu :

- texte exact : `document indisponible sur un workpaper stale`

#### `DOCUMENT_DECISION_CONFLICT_WORKPAPER_STATUS`

Condition :

- le `POST` retourne `409` avec raffinement `READY_FOR_REVIEW` prouve

Rendu :

- texte exact : `decision document disponible quand le workpaper est READY_FOR_REVIEW`

#### `DOCUMENT_DECISION_CONFLICT_OTHER`

Condition :

- le `POST` retourne `409` sans raffinement exact

Rendu :

- texte exact : `decision document impossible`

#### `DOCUMENT_DECISION_SERVER_ERROR`

Condition :

- le `POST` retourne `5xx`

Rendu :

- texte exact : `erreur serveur documents`

#### `DOCUMENT_DECISION_NETWORK_ERROR`

Condition :

- le `POST` echoue pour erreur reseau

Rendu :

- texte exact : `erreur reseau documents`

#### `DOCUMENT_DECISION_TIMEOUT`

Condition :

- le `POST` echoue par timeout selon `DEFAULT_REQUEST_TIMEOUT_MS`

Rendu :

- texte exact : `timeout documents`

#### `DOCUMENT_DECISION_INVALID_SUCCESS_PAYLOAD`

Condition :

- le `POST` retourne `200`
- le payload succes est invalide ou incoherent pour le sous-ensemble consomme

Rendu :

- texte exact : `payload decision document invalide`
- aucun refresh `GET /workpapers` n'est emis

#### `DOCUMENT_DECISION_REFRESH_FAILED`

Condition :

- le `POST` a deja retourne un succes payload valide
- le refresh `GET /workpapers` echoue ou retourne un payload invalide

Rendu :

- textes exacts :
  - `decision document enregistree avec succes`
  - `rafraichissement workpapers impossible`

#### `DOCUMENT_DECISION_UNEXPECTED`

Condition :

- le `POST` retourne un statut non explicitement borne

Rendu :

- texte exact : `decision document indisponible`

## Garde-fous anti-scope

- aucun nouveau fichier backend
- aucune modification backend
- aucune modification OpenAPI
- aucun appel `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
- aucun appel `GET /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
- aucun appel endpoint `exports`
- aucun appel `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`
- aucun appel `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous`
- aucun endpoint IA
- aucun GraphQL
- aucune IA active
- aucun bulk decision
- aucune navigation produit basee sur `nextAction.path`
- aucune nouvelle route produit
- aucune reintroduction de drafts, handlers ou refreshs Workpapers dans `router.tsx`
- aucun refresh de `GET /api/me`, `GET /closing-folders/{id}`, `GET /controls`, `GET /financial-summary`, `GET /financial-statements/structured` ou `GET /mappings/manual` apres decision document

## Tests frontend requis

- `pnpm test:ci`
- `pnpm lint`
- `pnpm build`
- tests API `frontend/src/lib/api/workpapers.test.ts` prouvant :
  - le seul nouvel endpoint consomme est `POST /api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`
  - le path encode `closingFolderId` et `documentId`
  - les headers exacts `Accept`, `Content-Type`, `X-Tenant-Id`
  - le body exact `VERIFIED` sans `comment`
  - le body exact `REJECTED` avec `comment` trimme
  - aucun champ additionnel dans le body
  - la convention timeout `DEFAULT_REQUEST_TIMEOUT_MS = 5000`
  - les mappings `400`, `401`, `403`, `404`, `409`, `5xx`, reseau, timeout, unexpected
  - les raffinements `409` seulement depuis les messages backend prouves
  - le `200` payload valide
  - le `200` payload invalide ou incoherent
- tests `WorkpapersPanel` prouvant :
  - aucune requete supplementaire au mount
  - la decision apparait seulement dans `items[].documents[]` eligibles
  - aucune decision n'apparait dans `staleWorkpapers[].documents[]`
  - aucun `POST` n'est emis si `closingFolderStatus = ARCHIVED`
  - aucun `POST` n'est emis si `readiness != READY`
  - aucun `POST` n'est emis sans role `REVIEWER | MANAGER | ADMIN`
  - aucun `POST` n'est emis pour `ACCOUNTANT` seul
  - aucun `POST` n'est emis si `workpaper.status != READY_FOR_REVIEW`
  - aucun `POST` n'est emis si `documentId` est absent, invalide ou non retrouve
  - `REJECTED` sans commentaire trimme non vide affiche `commentaire reviewer requis`
  - un clic `VERIFIED` emet le body exact sans `comment`
  - un clic `REJECTED` emet le body exact avec `comment` trimme
  - une seule decision document peut etre en vol a la fois
  - succes payload valide declenche exactement un refresh `GET /workpapers`
  - refresh `GET /workpapers` reussi remplace le read-model local
  - refresh `GET /workpapers` echoue garde le dernier bloc visible avec `rafraichissement workpapers impossible`
  - aucun autre bloc n'est rafraichi apres succes ou echec
  - les textes visibles exacts de tous les etats de cette spec sont couverts
  - `nextAction.path` n'est jamais rendu comme lien, bouton ou navigation produit
  - aucun endpoint hors scope n'est appele
- tests route-level strictement limites si necessaires, prouvant :
  - `/closing-folders/:closingFolderId` reste l'unique route produit
  - `router.tsx` ne porte pas la logique locale de decision document
  - le scope reseau initial reste identique a `024`

## Criteres d'acceptation frontend

- `specs/done/025-frontend-document-verification-decision-only-v1.md` existe.
- `/closing-folders/:closingFolderId` reste l'unique route produit enrichie.
- `WorkpapersPanel` reste la frontiere unique de la surface `Workpapers`.
- Un seul nouvel endpoint frontend est ajoute :
  - `POST /api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`
- `GET /api/closing-folders/{closingFolderId}/workpapers` reste le read-model canonique avant et apres decision.
- Aucune requete supplementaire n'est emise au chargement initial.
- La decision reviewer document est unitaire et explicite.
- La decision reviewer document n'est disponible que sur documents current eligibles.
- Les documents stale restent read-only pour la decision.
- Les roles reviewer frontend sont exactement `REVIEWER | MANAGER | ADMIN`.
- `ACCOUNTANT` seul ne voit pas l'affordance decision.
- `closingFolderStatus = ARCHIVED` bloque localement la decision.
- `readiness != READY` bloque localement la decision.
- `workpaper.status != READY_FOR_REVIEW` bloque localement la decision.
- `VERIFIED` emet un body JSON sans `comment`.
- `REJECTED` emet un body JSON avec `comment` trimme non vide.
- Aucun payload succes `POST` ne remplace directement le read-model rendu.
- Un succes payload valide declenche exactement un refresh `GET /workpapers`.
- Si le refresh echoue, le dernier bloc `Workpapers` valide reste visible.
- Aucun endpoint `review-decision` workpaper, `exports`, import versions, diff previous ou IA n'est appele.
- `nextAction.path` ne devient jamais une navigation produit.
- Aucune logique locale Workpapers n'est reintroduite dans `router.tsx`.
- Aucun backend ni contrat OpenAPI n'est modifie.

## Fichiers cibles attendus pour l'implementation

- `frontend/src/app/workpapers-panel.tsx`
- `frontend/src/app/workpapers-panel.test.tsx`
- `frontend/src/lib/api/workpapers.ts`
- `frontend/src/lib/api/workpapers.test.ts`
- `frontend/src/app/router.workpapers.test.tsx` seulement si un smoke route-level doit etre ajuste

## Fichiers explicitement interdits

- `backend/**`
- `contracts/openapi/**`
- toute nouvelle route produit frontend
- tout nouveau module IA

## Resultat attendu de `025`

- Le reviewer peut verifier ou rejeter un document deja visible dans `Workpapers`.
- Le frontend reste borne a `WorkpapersPanel`.
- La decision reste human-in-the-loop, explicite, unitaire et audit-ready via le backend existant.
- `GET /workpapers` reste la source canonique de l'etat visible apres mutation.
- Le scope `review workpaper`, exports, import versions, diff previous, GraphQL et IA active reste ferme.
