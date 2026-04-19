# 014 - Frontend controls readiness cockpit v1

## Status
Active

## Role de cette spec

Cette spec devient la verite normative de `014`.

Elle borne le plus petit enrichissement frontend metier legitime apres `004` :

- enrichir uniquement la route existante `/closing-folders/:closingFolderId`
- consommer le read-model backend deja livre de `006-controls-v1`
- exposer en lecture seule `pret / bloque / prochaine action`

`014` ne reouvre pas `006` cote backend et ne cree aucune nouvelle vague produit au-dela de `controls/readiness`.

## Sources de verite

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/adr/0005-front-ui-stack-and-design-system.md`
- `docs/product/v1-plan.md`
- `specs/done/004-frontend-foundation-design-system.md`
- `specs/done/006-controls-v1.md`
- `contracts/openapi/controls-api.yaml`
- `docs/ui/ui-foundations-v1.md`
- `frontend/src/app/router.tsx`
- `frontend/src/lib/api/me.ts`
- `frontend/src/lib/api/closing-folders.ts`
- `frontend/src/components/workbench/app-shell.tsx`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/controls/api/ControlsController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/ControlsApiTest.kt`

## Decisions fermees

- `014` enrichit uniquement la route existante `/closing-folders/:closingFolderId`.
- `014` ne cree aucune nouvelle route produit.
- `014` ne cree aucune nouvelle tabulation produit.
- `/` reste une surface de demonstration interne sans appel API.
- `014` reste strictement read-only.
- `014` consomme uniquement :
  - `GET /api/me`
  - `GET /api/closing-folders/{id}`
  - `GET /api/closing-folders/{closingFolderId}/controls`
- `014` ne consomme aucun autre endpoint.
- `014` ne consomme jamais `/controls` hors de `/closing-folders/:closingFolderId`.
- `014` conserve a l'identique tous les etats `GET /api/me` et `GET /api/closing-folders/{id}` deja figes par `004`.
- `014` charge `GET /api/closing-folders/{closingFolderId}/controls` seulement apres `GET /api/me` et `GET /api/closing-folders/{id}` reussis avec un contexte exploitable.
- `014` n'introduit aucun tenant switch, aucune mutation, aucun scope `financials`, `workpapers`, `documents`, `exports` ou IA active.

## In scope exact

- enrichissement read-only du contenu de `/closing-folders/:closingFolderId`
- reutilisation du shell, du breadcrumb, de la sidebar et de la zone d'action lecture seule deja poses par `004`
- ajout d'un chargement `GET /api/closing-folders/{closingFolderId}/controls` apres le chargement dossier reussi
- validation stricte du sous-ensemble JSON `/controls` consomme par le frontend
- rendu visible et distinct des etats `loading`, `401`, `403`, `404`, `5xx`, erreur reseau, timeout, payload invalide ou incomplet, `READY` et `BLOCKED`
- rendu read-only de la readiness, des controles, de la prochaine action et des comptes non mappes
- tests frontend couvrant la sequence de chargement, les branches visibles exactes et l'absence de derive d'endpoint

## Out of scope exact

- toute nouvelle route produit ou navigation produit secondaire
- toute nouvelle tabulation, drawer metier ou stepper metier
- toute mutation backend
- tout endpoint hors des trois endpoints autorises
- tout ecran imports, mapping, financials, workpapers, documents, exports ou IA active
- tout tenant switch

## Surface exacte de 014

### `/`

- statut : surface de demonstration interne uniquement
- aucun appel API autorise
- aucun changement de structure ou de role par rapport a `004`

### `/closing-folders/:closingFolderId`

- statut : seule route produit de `014`
- la route conserve le shell de `004`
- la route reste une page simple en flux vertical unique
- aucun onglet, aucune sous-navigation et aucun nouveau point d'entree produit ne sont autorises

### Sequence de chargement exacte

1. appeler `GET /api/me`
2. si `GET /api/me` retourne un etat exploitable avec `activeTenant != null`, appeler `GET /api/closing-folders/{id}` avec `X-Tenant-Id = activeTenant.tenantId`
3. si le dossier est exploitable, appeler `GET /api/closing-folders/{closingFolderId}/controls` avec le meme `X-Tenant-Id`
4. si `GET /api/me` ou `GET /api/closing-folders/{id}` n'est pas dans l'etat nominal deja fige par `004`, aucun appel `/controls` n'est autorise

## Structure visible exacte sur `/closing-folders/:closingFolderId`

### Regle generale

- tant que le dossier n'est pas dans l'etat nominal de `004`, `014` n'ajoute rien et conserve le rendu exact de `004`
- des que le dossier est nominal, la page garde un ordre stable
- aucun rendu partiel de `/controls` n'est autorise

### Ordre visible exact une fois le dossier nominal

1. bloc `Dossier courant`
   - toujours visible
   - reprend strictement le sous-ensemble dossier deja affiche par `004` :
     - `name`
     - `status`
     - `periodStartOn`
     - `periodEndOn`
     - `externalRef`
2. slot `Controles`
   - toujours visible a la suite du bloc `Dossier courant`
   - rend soit un etat unique de chargement / erreur controls, soit les quatre sous-blocs nominaux ci-dessous
3. sous-bloc `Readiness`
   - visible seulement si le payload `/controls` est valide
4. sous-bloc `Controles`
   - visible seulement si le payload `/controls` est valide
5. sous-bloc `Prochaine action`
   - visible seulement si le payload `/controls` est valide
6. sous-bloc `Comptes non mappes`
   - visible seulement si le payload `/controls` est valide

### Regle de stabilite visuelle

- en cas d'erreur `/controls`, le bloc `Dossier courant` reste visible
- en cas d'erreur `/controls`, le slot `Controles` montre un seul panneau d'etat explicite
- en cas d'erreur `/controls`, aucun sous-bloc partiel `Readiness`, `Controles`, `Prochaine action` ou `Comptes non mappes` n'est rendu

## Contrat API reel consomme par 014

### Verite unique retenue

`014` consomme uniquement :

- `GET /api/me`
- `GET /api/closing-folders/{id}`
- `GET /api/closing-folders/{closingFolderId}/controls`

`014` ne consomme jamais :

- `GET /api/closings/{closingId}`
- `GET /api/closing-folders/{closingFolderId}/financial-summary`
- `GET /api/closing-folders/{closingFolderId}/financial-statements-structured`
- `GET /api/closing-folders/{closingFolderId}/workpapers`
- tout autre endpoint

### `GET /api/closing-folders/{closingFolderId}/controls`

Preuve repo :

- `contracts/openapi/controls-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/controls/api/ControlsController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/ControlsApiTest.kt`

Constats observes :

- l'endpoint reel est `GET /api/closing-folders/{closingFolderId}/controls`
- l'endpoint exige `X-Tenant-Id`
- `400` est reserve aux cas internes de header ou path invalides ; dans `014`, tout `400` est traite comme un etat non nominal inattendu
- `401` signifie authentification requise
- `403` signifie acces tenant / RBAC refuse
- `404` signifie dossier absent ou hors tenant
- `200` reste lisible sur closing `ARCHIVED`
- `controls[]` est contractuellement ordonne comme :
  - `LATEST_VALID_BALANCE_IMPORT_PRESENT`
  - `MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT`
- `unmappedAccounts[]` est contractuellement deja ordonne en `line_no asc`

### Sous-ensemble exact de champs JSON consommes sur `/controls`

- `closingFolderId`
  - requis : oui
  - rendu UI : non rendu en clair ; utilise seulement pour verifier la coherence avec `closingFolder.id` et le param route
  - fallback si absent, invalide ou incoherent : `payload controls invalide`
- `readiness`
  - requis : oui
  - rendu UI : valeur principale du sous-bloc `Readiness`
  - mapping visible exact :
    - `READY -> pret`
    - `BLOCKED -> bloque`
  - fallback si absent ou hors enum : `payload controls invalide`
- `latestImportPresent`
  - requis : oui
  - rendu UI : ligne `dernier import valide`
  - mapping visible exact :
    - `true -> present`
    - `false -> absent`
  - fallback si absent ou invalide : `payload controls invalide`
- `latestImportVersion`
  - requis : oui, nullable
  - rendu UI : ligne `version d import`
  - mapping visible exact :
    - entier -> sa valeur
    - `null -> aucune`
  - fallback si propriete absente ou type invalide : `payload controls invalide`
- `mappingSummary.total`
  - requis : oui
  - rendu UI : ligne `comptes total`
  - fallback si absent ou invalide : `payload controls invalide`
- `mappingSummary.mapped`
  - requis : oui
  - rendu UI : ligne `comptes mappes`
  - fallback si absent ou invalide : `payload controls invalide`
- `mappingSummary.unmapped`
  - requis : oui
  - rendu UI : ligne `comptes non mappes`
  - fallback si absent ou invalide : `payload controls invalide`
- `controls[]`
  - requis : oui
  - rendu UI : sous-bloc `Controles`
  - regle de consommation exacte :
    - tableau de longueur exacte `2`
    - ordre exact conserve tel que livre par le backend
    - codes exacts attendus :
      - `LATEST_VALID_BALANCE_IMPORT_PRESENT`
      - `MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT`
  - mapping visible exact des lignes :
    - `LATEST_VALID_BALANCE_IMPORT_PRESENT -> dernier import valide`
    - `MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT -> mapping manuel complet`
  - mapping visible exact des statuts :
    - `PASS -> ok`
    - `FAIL -> bloquant`
    - `NOT_APPLICABLE -> non applicable`
  - `message` est visible comme texte d'explication de la ligne
  - fallback si tableau absent, ordre different, longueur differente, code absent, statut absent ou `message` absent : `payload controls invalide`
- `nextAction`
  - requis : oui, nullable
  - rendu UI : sous-bloc `Prochaine action`
  - si `null`, texte exact visible : `aucune action requise`
  - si objet, champs consommes :
    - `code`
      - requis : oui
      - mapping visible exact :
        - `IMPORT_BALANCE -> importer la balance`
        - `COMPLETE_MANUAL_MAPPING -> completer le mapping manuel`
      - fallback si absent ou hors enum : `payload controls invalide`
    - `path`
      - requis : oui
      - rendu UI : cible technique en lecture seule
      - regle : jamais rendu comme lien actif, bouton ou navigation
      - fallback si absent ou invalide : `payload controls invalide`
    - `actionable`
      - requis : oui
      - rendu UI : ligne `action possible`
      - mapping visible exact :
        - `true -> oui`
        - `false -> non`
      - fallback si absent ou invalide : `payload controls invalide`
- `unmappedAccounts[]`
  - requis : oui
  - rendu UI : sous-bloc `Comptes non mappes`
  - regle : le frontend preserve l'ordre backend ; aucun tri local n'est autorise
  - si tableau vide, texte exact visible : `aucun compte non mappe`
  - champs exacts consommes par ligne :
    - `accountCode`
      - requis : oui
      - rendu UI : colonne `Compte`
      - fallback si absent : `payload controls invalide`
    - `accountLabel`
      - requis : oui
      - rendu UI : colonne `Libelle`
      - fallback si absent : `payload controls invalide`
    - `debit`
      - requis : oui
      - rendu UI : colonne `Debit`
      - fallback si absent : `payload controls invalide`
    - `credit`
      - requis : oui
      - rendu UI : colonne `Credit`
      - fallback si absent : `payload controls invalide`

### Champs explicitement non consommes par 014 sur `/controls`

- `closingFolderStatus`
  - non consomme
  - raison : le statut dossier visible reste celui de `GET /api/closing-folders/{id}` deja borne par `004`
- `controls[].severity`
  - non consomme
  - raison : la severite actuelle est figee a `BLOCKER` dans le contrat backend et n'ajoute aucune decision UI en `014`

## Matrice d'etats exacte pour le slot `Controles`

### Regle generale

- cette matrice s'applique seulement apres succes de `GET /api/me` et `GET /api/closing-folders/{id}` selon `004`
- dans tous les etats ci-dessous, le contexte tenant et le bloc `Dossier courant` restent visibles
- tout resultat non nominal non explicitement liste ci-dessous, y compris `400`, rend l'etat `CONTROLS_UNEXPECTED`

### `CONTROLS_LOADING`

Condition :

- `GET /api/closing-folders/{closingFolderId}/controls` est en cours

Rendu exact :

- panneau d'etat unique dans le slot `Controles`
- texte exact visible : `chargement controls`
- contexte tenant visible : oui
- bloc `Dossier courant` visible : oui

### `CONTROLS_AUTH_REQUIRED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/controls` retourne `401`

Rendu exact :

- panneau d'etat unique dans le slot `Controles`
- texte exact visible : `authentification requise`
- contexte tenant visible : oui
- bloc `Dossier courant` visible : oui

### `CONTROLS_FORBIDDEN`

Condition :

- `GET /api/closing-folders/{closingFolderId}/controls` retourne `403`

Rendu exact :

- panneau d'etat unique dans le slot `Controles`
- texte exact visible : `acces controls refuse`
- contexte tenant visible : oui
- bloc `Dossier courant` visible : oui

### `CONTROLS_NOT_FOUND`

Condition :

- `GET /api/closing-folders/{closingFolderId}/controls` retourne `404`

Rendu exact :

- panneau d'etat unique dans le slot `Controles`
- texte exact visible : `controls introuvables`
- contexte tenant visible : oui
- bloc `Dossier courant` visible : oui

### `CONTROLS_SERVER_ERROR`

Condition :

- `GET /api/closing-folders/{closingFolderId}/controls` retourne `5xx`

Rendu exact :

- panneau d'etat unique dans le slot `Controles`
- texte exact visible : `erreur serveur controls`
- contexte tenant visible : oui
- bloc `Dossier courant` visible : oui
- aucun sous-bloc `Readiness`, `Controles`, `Prochaine action` ou `Comptes non mappes` n'est rendu

### `CONTROLS_NETWORK_ERROR`

Condition :

- `GET /api/closing-folders/{closingFolderId}/controls` echoue pour erreur reseau

Rendu exact :

- panneau d'etat unique dans le slot `Controles`
- texte exact visible : `erreur reseau controls`
- contexte tenant visible : oui
- bloc `Dossier courant` visible : oui
- aucun sous-bloc `Readiness`, `Controles`, `Prochaine action` ou `Comptes non mappes` n'est rendu

### `CONTROLS_TIMEOUT`

Condition :

- `GET /api/closing-folders/{closingFolderId}/controls` echoue par timeout

Rendu exact :

- panneau d'etat unique dans le slot `Controles`
- texte exact visible : `timeout controls`
- contexte tenant visible : oui
- bloc `Dossier courant` visible : oui
- aucun sous-bloc `Readiness`, `Controles`, `Prochaine action` ou `Comptes non mappes` n'est rendu

### `CONTROLS_INVALID_PAYLOAD`

Condition :

- `GET /api/closing-folders/{closingFolderId}/controls` retourne `200`
- le payload est invalide, incomplet ou incoherent pour le sous-ensemble exact consomme

Rendu exact :

- panneau d'etat unique dans le slot `Controles`
- texte exact visible : `payload controls invalide`
- contexte tenant visible : oui
- bloc `Dossier courant` visible : oui
- aucun sous-bloc `Readiness`, `Controles`, `Prochaine action` ou `Comptes non mappes` n'est rendu

### `CONTROLS_UNEXPECTED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/controls` retourne un statut non nominal non explicitement borne par cette spec, y compris `400`

Rendu exact :

- panneau d'etat unique dans le slot `Controles`
- texte exact visible : `controles indisponibles`
- contexte tenant visible : oui
- bloc `Dossier courant` visible : oui
- aucun sous-bloc `Readiness`, `Controles`, `Prochaine action` ou `Comptes non mappes` n'est rendu

### `CONTROLS_READY`

Condition :

- `GET /api/closing-folders/{closingFolderId}/controls` retourne `200`
- le payload est valide pour le sous-ensemble exact consomme
- `controls.readiness = READY`
- `controls.closingFolderId == closingFolder.id == closingFolderId`

Rendu exact :

- sous-bloc `Readiness`
  - `readiness : pret`
  - `dernier import valide : present`
  - `version d import : <valeur>`
  - `comptes total : <valeur>`
  - `comptes mappes : <valeur>`
  - `comptes non mappes : 0`
- sous-bloc `Controles`
  - deux lignes en ordre backend
  - chaque ligne montre le libelle, le statut mappe et le `message`
- sous-bloc `Prochaine action`
  - texte exact visible : `aucune action requise`
- sous-bloc `Comptes non mappes`
  - texte exact visible : `aucun compte non mappe`
- contexte tenant visible : oui
- bloc `Dossier courant` visible : oui

### `CONTROLS_BLOCKED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/controls` retourne `200`
- le payload est valide pour le sous-ensemble exact consomme
- `controls.readiness = BLOCKED`
- `controls.closingFolderId == closingFolder.id == closingFolderId`

Rendu exact :

- sous-bloc `Readiness`
  - `readiness : bloque`
  - `dernier import valide : present|absent`
  - `version d import : <valeur ou aucune>`
  - `comptes total : <valeur>`
  - `comptes mappes : <valeur>`
  - `comptes non mappes : <valeur>`
- sous-bloc `Controles`
  - deux lignes en ordre backend
  - chaque ligne montre le libelle, le statut mappe et le `message`
- sous-bloc `Prochaine action`
  - si `nextAction != null`, rendre :
    - le libelle mappe du `code`
    - le `path` en lecture seule
    - `action possible : oui|non`
  - si `nextAction == null`, texte exact visible : `aucune action requise`
- sous-bloc `Comptes non mappes`
  - si tableau non vide, rendre les colonnes exactes `Compte`, `Libelle`, `Debit`, `Credit`
  - si tableau vide, texte exact visible : `aucun compte non mappe`
- contexte tenant visible : oui
- bloc `Dossier courant` visible : oui

## Regles de non-ambigute

- aucun fallback implicite n'est autorise
- aucun rendu partiel de `/controls` n'est autorise
- toute branche visible doit etre testable par un texte exact stable
- toute incoherence entre `closingFolderId` du payload controls, le param route et le dossier deja charge rend `payload controls invalide`
- `nextAction.path` n'est jamais un raccourci de navigation en `014`
- `014` n'introduit aucun comportement d'ecriture, meme indirect

## Criteres d'acceptation

- `specs/active/014-frontend-controls-readiness-cockpit-v1.md` est l'unique spec normative active de `014`
- `/` reste une surface de demonstration interne sans appel API
- `/closing-folders/:closingFolderId` reste l'unique route produit de `014`
- aucune nouvelle route produit n'est introduite
- aucune nouvelle tabulation produit n'est introduite
- le shell continue de consommer `GET /api/me` puis `GET /api/closing-folders/{id}` selon `004`
- `GET /api/closing-folders/{closingFolderId}/controls` est appele seulement apres succes exploitable des deux appels precedents
- aucun autre endpoint n'est consomme
- aucun appel a `/controls` n'est emis hors de `/closing-folders/:closingFolderId`
- aucune mutation backend n'est introduite
- le bloc `Dossier courant` reste visible sur tous les etats `/controls` non nominaux
- le slot `Controles` expose des etats visibles exacts et distincts pour `loading`, `401`, `403`, `404`, `5xx`, erreur reseau, timeout et payload invalide ou incomplet
- `401` affiche `authentification requise`
- `403` affiche `acces controls refuse`
- `404` affiche `controls introuvables`
- `5xx` affiche `erreur serveur controls`
- erreur reseau affiche `erreur reseau controls`
- timeout affiche `timeout controls`
- payload invalide ou incomplet affiche `payload controls invalide`
- `400` et tout autre statut non borne affichent `controles indisponibles`
- `READY` rend les quatre sous-blocs nominaux dans l'ordre exact `Readiness -> Controles -> Prochaine action -> Comptes non mappes`
- `BLOCKED` rend les quatre sous-blocs nominaux dans le meme ordre exact
- le frontend ne consomme du payload `/controls` que le sous-ensemble exact fige dans cette spec
- toute propriete requise absente ou invalide du sous-ensemble consomme rend `payload controls invalide`
- `controls[]` doit etre rendu en ordre backend sans tri ni regroupement local
- `unmappedAccounts[]` doit etre rendu en ordre backend sans tri local
- `nextAction.path` reste strictement en lecture seule
- aucun scope `financials`, `workpapers`, `documents`, `exports`, IA active ou tenant switch n'est introduit
