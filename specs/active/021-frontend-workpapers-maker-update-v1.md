# 021 - Frontend workpapers maker update v1

## Status
Active

## Role de cette spec

Cette spec devient la verite normative de `021`.

Elle borne le plus petit enrichissement frontend metier legitime apres `020` pour permettre au maker de creer ou mettre a jour un workpaper courant depuis le bloc `Workpapers` existant sur `/closing-folders/:closingFolderId`, en reutilisant uniquement le backend deja livre :

- reutiliser strictement la route existante `/closing-folders/:closingFolderId`
- enrichir strictement le bloc `Workpapers`
- conserver `GET /api/closing-folders/{closingFolderId}/workpapers` comme read-model canonique
- ajouter uniquement la mutation maker existante `PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}`
- garder `staleWorkpapers[]`, `documents[]` et `documentVerificationSummary` strictement read-only

`021` ne reouvre ni le backend `workpapers-v1`, ni `document-storage-and-evidence-files-v1`, ni `evidence-review-and-verification-v1`, ni `020`, ni `019`, ni `018`, ni `017`, ni `016`, ni `014`, ni les versions d import, ni le diff previous, ni les exports, ni l IA, ni GraphQL.

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
- `specs/done/020-frontend-workpapers-read-model-v1.md`
- `specs/done/019-frontend-financial-statements-structured-preview-v1.md`
- `specs/done/017-frontend-manual-mapping-v1.md`
- `contracts/openapi/workpapers-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/workpapers/api/WorkpapersController.kt`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/workpapers/application/WorkpaperService.kt`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/MeController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/WorkpapersApiTest.kt`
- `frontend/src/app/router.tsx`
- `frontend/src/lib/api/http.ts`
- `frontend/src/lib/api/me.ts`
- `frontend/src/lib/api/workpapers.ts`
- `docs/ui/ui-foundations-v1.md`

## Decisions fermees

- `021` enrichit uniquement la route existante `/closing-folders/:closingFolderId`.
- `021` ne cree aucune nouvelle route produit.
- `021` ne cree aucun onglet, aucun drawer metier, aucune sous-navigation produit et aucun workbench riche.
- `021` conserve l ordre visible exact de `020` :
  - `Dossier courant`
  - `Import balance`
  - `Mapping manuel`
  - `Controles`
  - `Financial summary`
  - `Financial statements structured`
  - `Workpapers`
- `021` n ajoute qu un seul nouvel appel frontend autorise :
  - `PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}`
- `021` conserve `GET /api/closing-folders/{closingFolderId}/workpapers` comme read-model canonique avant et apres mutation.
- `021` n appelle jamais :
  - `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
  - tout endpoint `documents`
  - tout endpoint `exports`
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous`
  - tout endpoint IA
- `021` ne transforme jamais `nextAction.path` en navigation produit.
- `021` reste strictement unitaire :
  - aucune mutation groupee
  - aucun bulk update
  - aucun autosave
  - aucun retry automatique
- Une seule mutation `PUT /workpapers/{anchorCode}` peut etre en vol a la fois sur tout le bloc `Workpapers`.
- `staleWorkpapers[]` reste strictement read-only.
- `documents[]` et `documentVerificationSummary` restent strictement read-only.
- `021` doit preserver `evidences[]` sans edition locale et sans effacement implicite :
  - current sans workpaper persiste -> le frontend envoie `evidences: []`
  - current avec workpaper persiste -> le frontend renvoie exactement la projection contractuelle du dernier `evidences[]` valide lu depuis `GET /workpapers`
- Si `evidences[]` ne peut pas etre preserve de facon certaine pour un current workpaper persiste, le frontend ne doit pas emettre de `PUT` pour cet item.
- Apres succes valide du `PUT`, `021` rafraichit uniquement le bloc `Workpapers` via `GET /api/closing-folders/{closingFolderId}/workpapers`.
- `021` ne rafraichit ni `GET /api/me`, ni `GET /api/closing-folders/{id}`, ni `GET /controls`, ni `GET /financial-summary`, ni `GET /financial-statements/structured`, ni `GET /mappings/manual`, car le repo ne prouve pas qu un `PUT workpaper` maker change ces blocs.
- En cas d echec de mutation ou de refresh post-succes, les blocs existants restent visibles.

## In scope exact

- enrichissement du bloc `Workpapers` sur `/closing-folders/:closingFolderId`
- consommation du hint `effectiveRoles[]` de `GET /api/me` pour borner les affordances maker
- consommation additive de `closingFolderStatus`, `readiness` et `workpaper.evidences[]` depuis `GET /workpapers`
- creation d un workpaper current sans persistance preexistante
- mise a jour d un workpaper current deja persiste
- preservation exacte de `evidences[]` sur tout `PUT` current avec workpaper persiste
- affichage exact des etats :
  - idle editable
  - read-only stale
  - dossier archive
  - role non writable
  - `readiness != READY`
  - submitting
  - success
  - `400`
  - `401`
  - `403`
  - `404`
  - `409 archived`
  - `409 readiness`
  - `409 other`
  - `5xx`
  - erreur reseau
  - timeout
  - payload succes invalide
  - refresh workpapers impossible
  - unexpected
- refresh local du seul bloc `Workpapers` apres succes valide
- preservation visible des blocs existants si mutation ou refresh echoue
- tests frontend couvrant le `PUT`, le body exact, la preservation de `evidences[]`, le refresh post-succes, l absence d endpoints hors scope et l absence de navigation `nextAction.path`

## Out of scope exact

- toute nouvelle route produit
- toute nouvelle tabulation, drawer metier ou stepper metier
- tout nouveau backend
- tout nouveau contrat OpenAPI
- toute migration
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
- toute mutation groupee
- tout bulk update
- tout autosave
- toute edition de `staleWorkpapers[]`
- toute navigation produit basee sur `nextAction.path`
- tout CTA vers documents, review evidence, exports ou annexe officielle
- tout refresh des blocs `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` ou `Financial statements structured` hors besoin strict du `PUT workpaper`

## Regle d heritage depuis 020

Sauf remplacement explicite dans cette spec, `021` conserve les regles fermees de `020` pour :

- la route `/closing-folders/:closingFolderId`
- l ordre visible des blocs
- le rendu read-only de `summaryCounts`
- le rendu read-only de `documents[]`
- le rendu read-only de `documentVerificationSummary`
- la preservation de l ordre backend de `items[]`, `staleWorkpapers[]` et `documents[]`
- l absence de CTA `documents`, `review evidence`, `exports` ou `nextAction.path`
- le traitement local de `400` sur `GET /workpapers` comme la meme branche visible que `unexpected`

## Surface exacte de 021

### `/closing-folders/:closingFolderId`

- statut : unique route produit enrichie par `021`
- la route conserve le shell, le breadcrumb, la sidebar, le contexte tenant et les blocs deja livres
- la route reste une page simple en flux vertical unique
- aucun onglet, aucune sous-navigation et aucune navigation additionnelle ne sont autorises

### Bloc `Workpapers`

- titre visible exact : `Workpapers`
- sous-titre visible exact : `Maker update unitaire`
- rappel visible exact dans les seuls etats nominaux du bloc :
  - `Mise a jour maker unitaire sur les workpapers courants uniquement.`
- sous-blocs autorises :
  - `Resume workpapers`
  - un slot unique `Etat mutation workpaper`
  - `Workpapers courants`
  - `Workpapers stale`
- composants autorises dans `Workpapers courants` :
  - toutes les lignes read-only de `020`
  - `Documents inclus` et `Verification documents` strictement read-only
  - par current item editable seulement :
    - un textarea `Note workpaper`
    - un select `Statut maker`
    - un bouton explicite `Enregistrer le workpaper`
- composants interdits :
  - bouton `Prendre une decision reviewer`
  - bouton `Uploader un document`
  - bouton `Telecharger un document`
  - bouton `Ouvrir les documents`
  - bouton `Ouvrir les exports`
  - lien issu de `nextAction.path`

### Placement exact des actions maker

- les actions maker apparaissent uniquement dans chaque carte de `items[]`
- les actions maker apparaissent apres les lignes metadata workpaper du current item et avant la sous-section `Documents inclus`
- aucun bouton d action maker n apparait dans `staleWorkpapers[]`
- aucun bouton d action maker global au niveau du bloc `Workpapers` n est autorise

### Champs editables et statuts autorises exacts

- `021` rend editable seulement :
  - `noteText` via le textarea `Note workpaper`
  - `status` via le select `Statut maker`
- `021` ne rend jamais editable :
  - `evidences[]`
  - `documents[]`
  - `documentVerificationSummary`
  - `anchorCode`
  - `anchorLabel`
  - `summaryBucketCode`
  - `statementKind`
  - `breakdownType`
  - `workpaper.reviewComment`
  - `workpaper.basisImportVersion`
  - `workpaper.basisTaxonomyVersion`
  - `workpaper.createdAt`
  - `workpaper.createdByUserId`
  - `workpaper.updatedAt`
  - `workpaper.updatedByUserId`
  - `workpaper.reviewedAt`
  - `workpaper.reviewedByUserId`
- `Statut maker` expose exactement deux valeurs locales autorisees :
  - `DRAFT`
  - `READY_FOR_REVIEW`
- `DRAFT` est autorise cote maker.
- `READY_FOR_REVIEW` est autorise cote maker.
- `CHANGES_REQUESTED` n est jamais selectable ni emis par le frontend dans `021` :
  - il reste seulement un statut persiste entrant qui re-ouvre l item maker avec une valeur locale initiale `DRAFT`
- `REVIEWED` n est jamais selectable ni emis par le frontend dans `021`.
- si le current item persiste est `READY_FOR_REVIEW`
  - l item reste strictement read-only
  - aucune action maker n apparait
  - texte exact visible : `workpaper en lecture seule`
  - `021` reste volontairement plus strict que le backend et n expose pas le no-op exact possible cote service
- si le current item persiste est `REVIEWED`
  - l item reste strictement read-only
  - aucune action maker n apparait
  - texte exact visible : `workpaper en lecture seule`

### Items editables exacts

- `items[]` avec `workpaper = null`
  - editables seulement si toutes les preconditions d ecriture sont vraies
  - valeurs initiales exactes :
    - `Note workpaper` vide
    - `Statut maker = DRAFT`
    - `evidences[]` a envoyer = `[]`
- `items[]` avec `workpaper.status = DRAFT`
  - editables seulement si toutes les preconditions d ecriture sont vraies
  - valeurs initiales exactes :
    - `Note workpaper = workpaper.noteText`
    - `Statut maker = DRAFT`
    - `evidences[]` a envoyer = projection contractuelle du dernier `workpaper.evidences[]` valide lu
- `items[]` avec `workpaper.status = CHANGES_REQUESTED`
  - editables seulement si toutes les preconditions d ecriture sont vraies
  - valeurs initiales exactes :
    - `Note workpaper = workpaper.noteText`
    - `Statut maker = DRAFT`
    - `evidences[]` a envoyer = projection contractuelle du dernier `workpaper.evidences[]` valide lu
- `items[]` avec `workpaper.status = READY_FOR_REVIEW | REVIEWED`
  - strictement read-only
  - aucune action maker
  - texte exact visible : `workpaper en lecture seule`
- `staleWorkpapers[]`
  - strictement read-only
  - aucun textarea
  - aucun select
  - aucun bouton maker
  - texte exact visible quand la section contient au moins un stale : `workpapers stale en lecture seule`

## Preconditions d ecriture exactes

### Priorite locale de blocage

- pour tout current item, la priorite locale de blocage est figee ainsi :
  1. `closingFolderStatus = ARCHIVED`
  2. `readiness != READY`
  3. aucun role writer prouve exploitable
  4. item absent du dernier `items[]` valide ou `isCurrentStructure != true`
  5. statut persiste non editable cote maker
  6. source locale invalide pour `noteText`, `status` ou `evidences[]`
- quand une cause de priorite plus haute s applique, `021` n affiche pas un message concurrent de priorite plus basse pour le meme item.
- `staleWorkpapers[]` reste toujours read-only en plus de cette priorite globale et garde son texte exact propre : `workpapers stale en lecture seule`

### Roles

Preuve repo retenue :

- `GET /api/me` expose `effectiveRoles[]`
- `WorkpaperService` autorise l ecriture maker pour `ACCOUNTANT`, `MANAGER`, `ADMIN`
- `WorkpaperService` refuse l ecriture maker pour `REVIEWER`

Regle frontend exacte :

- si `effectiveRoles[]` contient `ACCOUNTANT`, `MANAGER` ou `ADMIN`, l item courant peut devenir editable sous reserve des autres preconditions
- si `effectiveRoles[]` contient seulement `REVIEWER` parmi les roles prouvants, le bloc est lecture seule
- si `effectiveRoles[]` est absent, invalide ou inexploitable, le bloc est lecture seule
- le frontend ne devine jamais un droit d ecriture a partir d un autre signal que `effectiveRoles[]`
- texte exact visible quand aucun role writer prouve n est exploitable : `lecture seule`

### Fermeture et readiness

`021` consomme `closingFolderStatus` et `readiness` depuis `GET /workpapers` pour borner l ecriture locale.

Decision de verite executable :

- `010` historique mentionne encore `PREVIEW_READY` comme gate de write
- le repo executable reel prouve maintenant `controls.readiness = READY` via :
  - `WorkpaperService.ensureWritable`
  - `contracts/openapi/workpapers-api.yaml`
  - `WorkpapersApiTest`
- `021` suit strictement cette verite executable :
  - `PREVIEW_READY` n est jamais consomme par `021`
  - seul `readiness = READY` autorise l affordance maker locale

- si `closingFolderStatus = ARCHIVED`
  - aucun `PUT` n est emis
  - tous les textarea, select et boutons maker sont desactives ou omis
  - texte exact visible : `dossier archive, workpaper en lecture seule`
- si `readiness != READY`
  - aucun `PUT` n est emis
  - tous les textarea, select et boutons maker sont desactives ou omis
  - texte exact visible : `workpaper non modifiable tant que les controles ne sont pas READY`

### Current uniquement

- l item doit provenir du dernier `items[]` valide charge depuis `GET /workpapers`
- `anchorCode` doit correspondre exactement a un current item charge
- `isCurrentStructure` doit etre `true`
- `staleWorkpapers[]` reste toujours hors write scope
- si le click handler ne retrouve pas `anchorCode` dans le dernier `items[]` valide
  - aucun `PUT` n est emis
  - le slot d etat mutation affiche exactement `workpaper indisponible`
- current item sans workpaper persiste
  - candidat a l ecriture seulement si toutes les preconditions globales sont vraies
  - `evidences[]` a envoyer reste le litteral `[]`
- current item avec workpaper persiste
  - candidat a l ecriture seulement si le statut persiste est `DRAFT` ou `CHANGES_REQUESTED`
  - `evidences[]` doit etre preservable depuis le dernier `GET /workpapers` valide du meme item
  - si cette preservation n est pas prouvable, aucun `PUT` n est emis

### Contenu local minimum

- `Note workpaper` est trimmee avant emission
- si `noteText` trimme est vide ou si sa source locale est invalide
  - aucun `PUT` n est emis
  - le slot d etat mutation affiche exactement `workpaper invalide`
- `Statut maker` ne peut valoir localement que :
  - `DRAFT`
  - `READY_FOR_REVIEW`
- si la source locale de `status` est absente, invalide ou hors enum autorisee
  - aucun `PUT` n est emis
  - le slot d etat mutation affiche exactement `workpaper invalide`
- si `evidences[]` est requis pour un current item persiste mais que sa source read-model est absente, non tableau ou invalide pour le contrat `PUT`
  - aucun `PUT` n est emis
  - le slot d etat mutation affiche exactement `payload workpapers invalide`
- le bouton `Enregistrer le workpaper` est active seulement si :
  - aucune autre mutation workpaper n est en vol
  - toutes les preconditions ci-dessus sont vraies
  - `noteText` trimme est non vide
  - et :
    - current sans workpaper persiste
    - ou current avec workpaper persiste et contenu maker modifie par rapport au dernier read-model valide
- si un `PUT workpaper` est deja en vol
  - tout second clic sur `Enregistrer le workpaper`, sur le meme item ou sur un autre current item, est ignore localement
  - aucun second `PUT` n est emis
  - le slot d etat mutation conserve exactement `enregistrement workpaper en cours`

## Contrat API reel consomme par 021

### Verite unique retenue

`021` consomme uniquement cet ensemble ferme :

- `GET /api/me`
- `GET /api/closing-folders/{id}`
- `GET /api/closing-folders/{closingFolderId}/controls`
- `GET /api/closing-folders/{closingFolderId}/mappings/manual`
- `GET /api/closing-folders/{closingFolderId}/financial-summary`
- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
- `GET /api/closing-folders/{closingFolderId}/workpapers`
- `PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}`
- `POST /api/closing-folders/{closingFolderId}/imports/balance`
- `PUT /api/closing-folders/{closingFolderId}/mappings/manual`
- `DELETE /api/closing-folders/{closingFolderId}/mappings/manual`

`021` n ajoute aucun autre endpoint.

### `GET /api/me`

Sous-ensemble exact consomme par `021` :

- `activeTenant.tenantId`
- `activeTenant.tenantSlug`
- `activeTenant.tenantName`
- `effectiveRoles[]` comme hint d affordance seulement

Regle exacte :

- `021` conserve tous les etats shell deja figes par `020`
- `effectiveRoles[]` n est jamais utilise pour contourner le backend
- `effectiveRoles[]` n est jamais transforme en navigation ou workflow

### `GET /api/closing-folders/{closingFolderId}/workpapers`

Preuve repo :

- `contracts/openapi/workpapers-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/workpapers/api/WorkpapersController.kt`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/workpapers/application/WorkpaperService.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/WorkpapersApiTest.kt`

Sous-ensemble additionnel exact consomme par `021`, en plus des regles deja fermees par `020` :

- `closingFolderStatus`
  - requis : oui
  - type attendu : `string` enum `DRAFT | ARCHIVED`
  - usage exact : gate local d ecriture seulement
  - fallback si absent, non string ou hors enum : `payload workpapers invalide`
- `readiness`
  - requis : oui
  - type attendu : `string` enum `READY | BLOCKED`
  - usage exact : gate local d ecriture seulement
  - fallback si absent, non string ou hors enum : `payload workpapers invalide`
- `items[].workpaper.evidences`
  - requis : oui quand `items[].workpaper != null`
  - type attendu : `array`
  - usage exact : preservation stricte dans le body du `PUT`
  - fallback si absent ou non tableau sur un current item avec workpaper persiste : `payload workpapers invalide`
- `items[].workpaper.evidences[].position`
  - requis : oui
  - type attendu : `integer >= 1`
  - usage exact : ordre et identite fonctionnelle de l evidence preservee
  - fallback si absent, non entier ou `<= 0` : `payload workpapers invalide`
- `items[].workpaper.evidences[].fileName`
  - requis : oui
  - type attendu : `string`
  - fallback si absent ou non string : `payload workpapers invalide`
- `items[].workpaper.evidences[].mediaType`
  - requis : oui
  - type attendu : `string`
  - fallback si absent ou non string : `payload workpapers invalide`
- `items[].workpaper.evidences[].documentDate`
  - requis : oui, nullable
  - type attendu : `string | null`
  - fallback si propriete absente ou type invalide : `payload workpapers invalide`
- `items[].workpaper.evidences[].sourceLabel`
  - requis : oui
  - type attendu : `string`
  - fallback si absent ou non string : `payload workpapers invalide`
- `items[].workpaper.evidences[].verificationStatus`
  - requis : oui
  - type attendu : `string` enum `UNVERIFIED | VERIFIED | REJECTED`
  - fallback si absent, non string ou hors enum : `payload workpapers invalide`
- `items[].workpaper.evidences[].externalReference`
  - requis : oui, nullable
  - type attendu : `string | null`
  - fallback si propriete absente ou type invalide : `payload workpapers invalide`
- `items[].workpaper.evidences[].checksumSha256`
  - requis : oui, nullable
  - type attendu : `string | null`
  - fallback si propriete absente ou type invalide : `payload workpapers invalide`

Regles de coherence additionnelles de `GET /workpapers` pour `021` :

- `closingFolderId == routeClosingFolderId == closingFolder.id`
- tout current item avec `workpaper != null` doit exposer un `evidences[]` preservable
- `021` conserve les validations de coherence deja fermees par `020` sur `summaryCounts`, `items[]`, `staleWorkpapers[]`, `documents[]`, `documentVerificationSummary` et `nextAction`
- `nextAction`, `nextAction.code`, `nextAction.path` et `nextAction.actionable` restent explicitement non consommes pour l interaction produit

### Regle de preservation obligatoire de `evidences[]`

- la source de verite unique pour `evidences[]` en `021` est :
  - le dernier `GET /api/closing-folders/{closingFolderId}/workpapers` valide
  - plus precisement `items[]` du read-model courant
  - plus precisement encore le current item tel que :
    - `item.anchorCode == anchorCode cible`
    - `item.isCurrentStructure == true`
    - `item.workpaper != null` pour le cas persiste
- `021` n utilise jamais comme source de reconstruction de `evidences[]` :
  - `staleWorkpapers[]`
  - `documents[]`
  - un endpoint `documents`
  - le payload succes du `PUT`
  - un cache ou state derive d une autre route
- current item sans workpaper persiste :
  - body exact a envoyer : `evidences: []`
- current item avec workpaper persiste :
  - le frontend ne propose aucune edition locale de `evidences[]`
  - le frontend renvoie exactement la projection contractuelle du dernier `workpaper.evidences[]` valide du meme current item
  - l ordre envoye est exactement l ordre backend conserve
  - la seule projection autorisee est :
    - omettre `id`, present dans le read-model `GET`, car `WorkpaperEvidenceInput` du `PUT` ne l accepte pas
    - recopier sans autre transformation les seuls champs contractuels :
      - `position`
      - `fileName`
      - `mediaType`
      - `documentDate`
      - `sourceLabel`
      - `verificationStatus`
      - `externalReference`
      - `checksumSha256`
  - aucun tri local, aucune normalisation locale, aucune completion locale, aucun filtre local et aucune deduplication locale ne sont autorises
- il est interdit d envoyer `evidences: []` pour un current item qui avait deja un `workpaper.evidences[]` non vide dans le dernier read-model valide
- si le frontend ne peut pas prouver le dernier `evidences[]` valide du current item persiste, il ne doit pas emettre de `PUT`
- si un current item persiste expose deja un `workpaper.evidences[] = []` valide dans le dernier read-model, `021` peut renvoyer exactement `evidences: []`
- tout effacement implicite est interdit :
  - suppression silencieuse d une evidence lue
  - omission silencieuse d un champ contractuel requis
  - remplacement silencieux par `[]`
  - reconstruction partielle a partir de `documents[]`
- tant qu un refresh `GET /workpapers` post-succes n a pas reussi, la source canonique de `evidences[]` reste le dernier `GET /workpapers` valide deja affiche
- un payload succes `PUT` valide n autorise jamais a recalculer ou remplacer seul la source canonique de `evidences[]`

### `PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}`

Headers exacts :

- `Accept: application/json`
- `Content-Type: application/json`
- `X-Tenant-Id = activeTenant.tenantId`

Path exact :

- `/api/closing-folders/{closingFolderId}/workpapers/{anchorCode}`
- `closingFolderId`
  - source frontend : param route `/closing-folders/:closingFolderId`
  - coherence requise : identique au `closingFolder.id` du shell nominal et au `closingFolderId` du dernier read-model `GET /workpapers` valide
  - fallback si incoherent : aucun `PUT` n est emis, texte exact `workpaper indisponible`
- `anchorCode`
  - source frontend : `item.anchorCode` du current item cible dans le dernier `items[]` valide
  - editable : non
  - fallback si absent du current read-model : aucun `PUT` n est emis, texte exact `workpaper indisponible`

Body exact attendu et emis par `021` :

- le body JSON emis contient exactement trois proprietes top-level :
  - `noteText`
  - `status`
  - `evidences`
- `021` n utilise jamais la valeur par defaut backend de `evidences = []` :
  - `evidences` est toujours envoye explicitement

- `noteText`
  - nom exact : `noteText`
  - type attendu : `string`
  - source frontend : textarea `Note workpaper`
  - editable : oui
  - emission exacte : valeur locale trimmee
  - fallback si absent, non string ou vide apres trim : aucun `PUT`, texte exact `workpaper invalide`

- `status`
  - nom exact : `status`
  - type attendu : `string` enum `DRAFT | READY_FOR_REVIEW`
  - source frontend : select `Statut maker`
  - editable : oui
  - emission exacte : valeur locale brute du select, sans autre transformation
  - fallback si absent, invalide ou hors enum : aucun `PUT`, texte exact `workpaper invalide`

- `evidences`
  - nom exact : `evidences`
  - type attendu : `array`
  - source frontend :
    - current sans workpaper persiste -> litteral `[]`
    - current avec workpaper persiste -> projection contractuelle du dernier `workpaper.evidences[]` valide lu depuis `GET /workpapers`
  - editable : non, preserve uniquement
  - fallback si la source requise est absente ou invalide : aucun `PUT`, texte exact `payload workpapers invalide`

- `evidences[].position`
  - nom exact : `position`
  - type attendu : `integer >= 1`
  - source frontend : `items[].workpaper.evidences[].position`
  - editable : non
  - fallback si absent, non entier ou `<= 0` : aucun `PUT`, texte exact `payload workpapers invalide`

- `evidences[].fileName`
  - nom exact : `fileName`
  - type attendu : `string`
  - source frontend : `items[].workpaper.evidences[].fileName`
  - editable : non
  - fallback si absent ou non string : aucun `PUT`, texte exact `payload workpapers invalide`

- `evidences[].mediaType`
  - nom exact : `mediaType`
  - type attendu : `string`
  - source frontend : `items[].workpaper.evidences[].mediaType`
  - editable : non
  - fallback si absent ou non string : aucun `PUT`, texte exact `payload workpapers invalide`

- `evidences[].documentDate`
  - nom exact : `documentDate`
  - type attendu : `string | null`
  - source frontend : `items[].workpaper.evidences[].documentDate`
  - editable : non
  - fallback si propriete absente ou type invalide : aucun `PUT`, texte exact `payload workpapers invalide`

- `evidences[].sourceLabel`
  - nom exact : `sourceLabel`
  - type attendu : `string`
  - source frontend : `items[].workpaper.evidences[].sourceLabel`
  - editable : non
  - fallback si absent ou non string : aucun `PUT`, texte exact `payload workpapers invalide`

- `evidences[].verificationStatus`
  - nom exact : `verificationStatus`
  - type attendu : `string` enum `UNVERIFIED | VERIFIED | REJECTED`
  - source frontend : `items[].workpaper.evidences[].verificationStatus`
  - editable : non
  - fallback si absent, invalide ou hors enum : aucun `PUT`, texte exact `payload workpapers invalide`

- `evidences[].externalReference`
  - nom exact : `externalReference`
  - type attendu : `string | null`
  - source frontend : `items[].workpaper.evidences[].externalReference`
  - editable : non
  - fallback si propriete absente ou type invalide : aucun `PUT`, texte exact `payload workpapers invalide`

- `evidences[].checksumSha256`
  - nom exact : `checksumSha256`
  - type attendu : `string | null`
  - source frontend : `items[].workpaper.evidences[].checksumSha256`
  - editable : non
  - fallback si propriete absente ou type invalide : aucun `PUT`, texte exact `payload workpapers invalide`

- aucun autre champ JSON n est emis, notamment :
  - `workpaper.id`
  - `workpaper.reviewComment`
  - `workpaper.basisImportVersion`
  - `workpaper.basisTaxonomyVersion`
  - `workpaper.createdAt`
  - `workpaper.createdByUserId`
  - `workpaper.updatedAt`
  - `workpaper.updatedByUserId`
  - `workpaper.reviewedAt`
  - `workpaper.reviewedByUserId`
  - `documents`
  - `documentVerificationSummary`
  - `evidences[].id`

Semantique frontend exacte du succes `PUT` :

- `201` => create
- `200` => update ou no-op backend
- un succes frontend est acquis seulement si le statut HTTP est `200` ou `201` et si le sous-ensemble succes ci-dessous est valide

Sous-ensemble exact du payload succes consomme cote frontend :

- `anchorCode`
  - requis : oui
  - type attendu : `string`
  - coherence exacte : `anchorCode == path anchorCode == current item anchorCode`
  - fallback si absent, invalide ou incoherent : `payload workpaper invalide`
- `isCurrentStructure`
  - requis : oui
  - type attendu : `boolean`
  - coherence exacte : `true`
  - fallback sinon : `payload workpaper invalide`
- `workpaper`
  - requis : oui
  - type attendu : `object`
  - coherence exacte : non `null`
  - fallback sinon : `payload workpaper invalide`
- `workpaper.status`
  - requis : oui
  - type attendu : `string`
  - coherence exacte : egal au `status` envoye
  - fallback sinon : `payload workpaper invalide`
- `workpaper.noteText`
  - requis : oui
  - type attendu : `string`
  - coherence exacte : egal au `noteText` trimme envoye
  - fallback sinon : `payload workpaper invalide`
- `workpaper.evidences[]`
  - requis : oui
  - type attendu : `array`
  - coherence exacte :
    - meme longueur
    - meme ordre
    - meme valeurs pour :
      - `position`
      - `fileName`
      - `mediaType`
      - `documentDate`
      - `sourceLabel`
      - `verificationStatus`
      - `externalReference`
      - `checksumSha256`
    - `id` reste ignore pour cette verification de succes car il n est pas emis par le `PUT`
  - fallback sinon : `payload workpaper invalide`

Champs explicitement non consommes sur le payload succes `PUT` :

- `documents[]`
- `documentVerificationSummary`
- `workpaper.reviewComment`
- `workpaper.basisImportVersion`
- `workpaper.basisTaxonomyVersion`
- `workpaper.createdAt`
- `workpaper.updatedAt`
- `workpaper.reviewedAt`

Regle :

- ces champs restent ignores pour la decision de succes
- l etat canonique visible du bloc apres succes vient du refresh `GET /workpapers`, pas du payload succes du `PUT`

### Lecture exacte des erreurs mutation

Le contrat OpenAPI `workpapers` ne publie aucun schema d erreur structure obligatoire pour le `PUT`. `021` ne depend donc jamais d un payload d erreur structure pour fonctionner.

Si un body JSON expose un top-level string `message`, `021` peut l exploiter seulement pour raffiner ce cas exact :

- `Closing folder is archived and workpapers cannot be modified.` -> `dossier archive, workpaper non modifiable`
- `Workpapers can only be modified when controls.readiness is READY.` -> `workpaper non modifiable tant que les controles ne sont pas READY`
- les messages backend prouvables suivants restent tous classes dans `mise a jour workpaper impossible` :
  - `anchorCode is not part of the current structure.`
  - `workpaper status does not allow maker-side edits.`
  - `workpaper status transition is not allowed.`
  - `latestImportVersion is required to modify workpapers.`

Tout autre body d erreur est ignore et le frontend retombe strictement sur le seul statut HTTP.

## Sequence reseau exacte

### Chargement initial

- la sequence initiale de `020` reste inchangee
- `021` n ajoute aucun appel reseau supplementaire au chargement initial
- `GET /api/closing-folders/{closingFolderId}/workpapers` reste emis une seule fois au chargement initial de la route detail

### Mutation `PUT`

1. l utilisateur modifie localement au maximum un current item editable
2. aucun appel reseau n est emis tant qu aucun clic explicite `Enregistrer le workpaper` n a lieu
3. sur clic `Enregistrer le workpaper`, si l item reste editable et coherent, le frontend emet exactement un `PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}` avec :
   - `Accept: application/json`
   - `Content-Type: application/json`
   - `X-Tenant-Id = activeTenant.tenantId`
   - body strictement borne a `noteText`, `status` et `evidences`
4. si les preconditions locales ou la projection `evidences[]` ne sont plus satisfaites au moment du clic
   - aucun appel reseau n est emis
   - le slot d etat mutation affiche le texte exact de blocage local prevu par cette spec
5. pendant ce `PUT`, aucun second `PUT workpaper` n est autorise sur un autre current item
6. pendant ce `PUT`, aucun endpoint hors scope n est autorise

### Sequence exacte apres succes valide

1. afficher immediatement le succes mutation exact
2. lancer exactement un `GET /api/closing-folders/{closingFolderId}/workpapers`
3. si le refresh retourne un read-model nominal valide, remplacer integralement le bloc `Workpapers`
4. si le refresh echoue, conserver le dernier bloc `Workpapers` valide deja affiche et ajouter exactement `rafraichissement workpapers impossible`
5. aucun autre bloc n est rafraichi
6. aucun redirect et aucune nouvelle navigation ne sont autorises
7. seul un refresh `GET /workpapers` reussi remplace la source canonique locale utilisee pour un prochain `PUT`

### Sequence exacte si le refresh `Workpapers` echoue

- le succes mutation deja acquis n est pas degrade en erreur mutation
- le dernier bloc `Workpapers` valide deja affiche reste visible
- les blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` restent visibles
- le texte exact additionnel visible est `rafraichissement workpapers impossible`

## Matrice d etats exacte du bloc `Workpapers`

### Etats de lecture et de precondition locale

#### `WORKPAPERS_READY_EDITABLE`

Condition :

- `GET /workpapers` retourne `200`
- le payload est valide pour `020` et pour les champs additionnels de `021`
- `closingFolderStatus != ARCHIVED`
- `readiness = READY`
- au moins un role writer prouve est lisible cote frontend

Rendu exact :

- rappel exact visible : `Mise a jour maker unitaire sur les workpapers courants uniquement.`
- slot d etat mutation unique : omis tant qu aucune tentative locale ou reseau n a eu lieu
- `items[]` current editables rendent `Note workpaper`, `Statut maker` et `Enregistrer le workpaper`
- `staleWorkpapers[]` restent read-only
- si `staleWorkpapers.length > 0`, texte exact visible : `workpapers stale en lecture seule`
- aucun etat global de page additionnel n est introduit

#### `WORKPAPERS_READY_READ_ONLY_ROLE`

Condition :

- read-model `Workpapers` nominal valide
- `closingFolderStatus != ARCHIVED`
- `readiness = READY`
- aucun role writer prouve n est exploitable cote frontend

Rendu exact :

- rappel exact visible
- texte exact visible : `lecture seule`
- aucun textarea, select ou bouton maker

#### `WORKPAPERS_READY_READ_ONLY_ARCHIVED`

Condition :

- read-model `Workpapers` nominal valide
- `closingFolderStatus = ARCHIVED`

Rendu exact :

- rappel exact visible
- texte exact visible : `dossier archive, workpaper en lecture seule`
- aucun textarea, select ou bouton maker

#### `WORKPAPERS_READY_READ_ONLY_NOT_READY`

Condition :

- read-model `Workpapers` nominal valide
- `closingFolderStatus != ARCHIVED`
- `readiness != READY`

Rendu exact :

- rappel exact visible
- texte exact visible : `workpaper non modifiable tant que les controles ne sont pas READY`
- aucun textarea, select ou bouton maker

### Etats de mutation

#### `WORKPAPER_MUTATION_SUBMITTING`

Condition :

- un `PUT /workpapers/{anchorCode}` est en cours

Rendu exact :

- slot d etat mutation unique
- texte exact visible : `enregistrement workpaper en cours`
- tous les textarea, select et boutons maker du bloc `Workpapers` sont desactives

#### `WORKPAPER_MUTATION_SUCCESS`

Condition :

- le `PUT` retourne `200` ou `201`
- le payload succes est valide pour le sous-ensemble exact consomme

Rendu exact :

- slot d etat mutation unique
- texte exact visible : `workpaper enregistre avec succes`

#### `WORKPAPER_MUTATION_BAD_REQUEST`

Condition :

- le `PUT` retourne `400`

Rendu exact :

- slot d etat mutation unique
- texte exact visible : `workpaper invalide`

#### `WORKPAPER_MUTATION_AUTH_REQUIRED`

Condition :

- le `PUT` retourne `401`

Rendu exact :

- slot d etat mutation unique
- texte exact visible : `authentification requise`

#### `WORKPAPER_MUTATION_FORBIDDEN`

Condition :

- le `PUT` retourne `403`

Rendu exact :

- slot d etat mutation unique
- texte exact visible : `acces workpapers refuse`

#### `WORKPAPER_MUTATION_NOT_FOUND`

Condition :

- le `PUT` retourne `404`

Rendu exact :

- slot d etat mutation unique
- texte exact visible : `dossier introuvable`

#### `WORKPAPER_MUTATION_CONFLICT_ARCHIVED`

Condition :

- le bloc est deja en lecture seule archive
- ou le `PUT` retourne `409` et un raffinement exact archive est applicable

Rendu exact :

- slot d etat mutation unique
- texte exact visible : `dossier archive, workpaper non modifiable`

#### `WORKPAPER_MUTATION_CONFLICT_NOT_READY`

Condition :

- le bloc est deja en lecture seule `readiness != READY`
- ou le `PUT` retourne `409` et le raffinement exact `controls.readiness = READY` est applicable

Rendu exact :

- slot d etat mutation unique
- texte exact visible : `workpaper non modifiable tant que les controles ne sont pas READY`

#### `WORKPAPER_MUTATION_CONFLICT_OTHER`

Condition :

- le `PUT` retourne `409`
- aucun raffinement exact `archive` ni `readiness` n est applicable

Rendu exact :

- slot d etat mutation unique
- texte exact visible : `mise a jour workpaper impossible`

#### `WORKPAPER_MUTATION_SERVER_ERROR`

Condition :

- le `PUT` retourne `5xx`

Rendu exact :

- slot d etat mutation unique
- texte exact visible : `erreur serveur workpapers`

#### `WORKPAPER_MUTATION_NETWORK_ERROR`

Condition :

- le `PUT` echoue pour erreur reseau

Rendu exact :

- slot d etat mutation unique
- texte exact visible : `erreur reseau workpapers`

#### `WORKPAPER_MUTATION_TIMEOUT`

Condition :

- le `PUT` echoue par timeout selon la convention de `frontend/src/lib/api/http.ts`

Rendu exact :

- slot d etat mutation unique
- texte exact visible : `timeout workpapers`

#### `WORKPAPER_MUTATION_INVALID_SUCCESS_PAYLOAD`

Condition :

- le `PUT` retourne `200` ou `201`
- le payload succes est invalide, incomplet ou incoherent pour le sous-ensemble exact consomme

Rendu exact :

- slot d etat mutation unique
- texte exact visible : `payload workpaper invalide`
- aucun refresh `GET /workpapers` n est emis

#### `WORKPAPER_MUTATION_REFRESH_FAILED`

Condition :

- le `PUT` a deja produit un succes valide
- le refresh `GET /workpapers` echoue ou retourne un payload invalide

Rendu exact :

- slot d etat mutation unique
- texte exact visible :
  - `workpaper enregistre avec succes`
  - `rafraichissement workpapers impossible`

#### `WORKPAPER_MUTATION_UNEXPECTED`

Condition :

- le `PUT` retourne un statut non explicitement borne par cette spec

Rendu exact :

- slot d etat mutation unique
- texte exact visible : `workpaper indisponible`

## Regles de rendu et textes exacts

- texte exact du bouton maker : `Enregistrer le workpaper`
- texte exact du rappel idle editable : `Mise a jour maker unitaire sur les workpapers courants uniquement.`
- texte exact du succes mutation : `workpaper enregistre avec succes`
- texte exact du stale read-only : `workpapers stale en lecture seule`
- texte exact du dossier archive : `dossier archive, workpaper en lecture seule`
- texte exact du role non writable : `lecture seule`
- texte exact du read-only readiness : `workpaper non modifiable tant que les controles ne sont pas READY`
- texte exact du conflit archive : `dossier archive, workpaper non modifiable`
- texte exact du conflit readiness : `workpaper non modifiable tant que les controles ne sont pas READY`
- texte exact du conflit autre : `mise a jour workpaper impossible`
- texte exact du payload succes invalide : `payload workpaper invalide`
- texte exact du blocage local source evidences invalide : `payload workpapers invalide`
- texte exact du refresh post-succes impossible : `rafraichissement workpapers impossible`

## Garde-fous anti-scope

- `021` n appelle aucun endpoint `documents`
- `021` n appelle jamais `POST /workpapers/{anchorCode}/review-decision`
- `021` n appelle aucun endpoint `exports`
- `021` n ajoute aucun CTA `documents`, `review evidence`, `exports` ou annexe officielle
- `021` ne transforme jamais `nextAction.path` en navigation produit
- `021` ne modifie pas les refreshs `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` ou `Financial statements structured` hors refresh local strictement necessaire de `GET /workpapers`
- `021` ne convertit pas `documents[]` ou `documentVerificationSummary` en surface editable
- `021` ne propose aucun diff previous, aucune version d import et aucun export

## Criteres d acceptation frontend

- `specs/active/021-frontend-workpapers-maker-update-v1.md` existe
- `/closing-folders/:closingFolderId` reste l unique route produit enrichie par `021`
- aucun nouveau backend n est introduit
- aucun nouveau contrat OpenAPI n est introduit
- le bloc `Workpapers` reste place strictement apres `Financial statements structured`
- `021` n ajoute qu un seul nouvel endpoint consomme :
  - `PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}`
- `GET /api/closing-folders/{closingFolderId}/workpapers` reste le read-model canonique avant et apres mutation
- aucune mutation n est possible sur `staleWorkpapers[]`
- `021` preserve `evidences[]` sans effacement implicite :
  - current sans workpaper persiste -> `evidences: []`
  - current avec workpaper persiste -> `evidences[]` renvoye exactement comme lu dans le dernier `GET /workpapers` valide, en omettant seulement `id` non accepte par `WorkpaperEvidenceInput`
- si `effectiveRoles[]` est absent, invalide ou n expose aucun role maker, le bloc `Workpapers` reste lecture seule
- si `closingFolderStatus = ARCHIVED`, le bloc `Workpapers` reste lecture seule
- si `readiness != READY`, le bloc `Workpapers` reste lecture seule
- `021` suit explicitement la verite executable `controls.readiness = READY`, pas la mention historique `PREVIEW_READY` de `010`
- aucun autosave n est introduit
- aucun bulk update n est introduit
- une seule mutation workpaper peut etre en vol a la fois
- le `PUT` envoie exactement `noteText`, `status` et `evidences[]`
- le `PUT` n envoie jamais `evidences[].id`
- le `PUT` utilise toujours `X-Tenant-Id = activeTenant.tenantId`
- les etats visibles exacts sont testables pour :
  - editable idle
  - lecture seule stale
  - lecture seule role
  - lecture seule archive
  - lecture seule `readiness != READY`
  - `400`
  - `401`
  - `403`
  - `404`
  - `409 archived`
  - `409 readiness`
  - `409 other`
  - `5xx`
  - erreur reseau
  - timeout
  - payload succes invalide
  - refresh workpapers impossible
  - unexpected
- en cas d echec de mutation, les blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary`, `Financial statements structured` et `Workpapers` restent visibles
- apres succes valide, seul `GET /workpapers` est rafraichi
- si le refresh `GET /workpapers` echoue, le dernier bloc `Workpapers` valide deja affiche reste visible
- `nextAction.path` ne devient jamais un lien, un bouton ou une navigation produit
- aucun endpoint `documents`, `review-decision`, `exports`, `imports/balance/versions`, `diff-previous` ou IA n est appele par `021`

## Tests frontend requis

- `pnpm test:ci`
- `pnpm lint`
- `pnpm build`
- tests prouvant que le bloc `Workpapers` reste place strictement apres `Financial statements structured`
- tests prouvant que le seul nouvel endpoint consomme par `021` est `PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}`
- tests prouvant que le `PUT` utilise exactement le path `/api/closing-folders/{closingFolderId}/workpapers/{anchorCode}` avec `anchorCode` issu du current item
- tests prouvant que le `PUT` envoie exactement les headers `Accept`, `Content-Type` et `X-Tenant-Id`
- tests prouvant que le body du `PUT` contient exactement `noteText`, `status` et `evidences[]`
- tests prouvant que `evidences[]` contient exactement les champs `position`, `fileName`, `mediaType`, `documentDate`, `sourceLabel`, `verificationStatus`, `externalReference`, `checksumSha256`, et jamais `id`
- tests prouvant que `evidences[]` est preserve exactement sur un current workpaper persiste
- tests prouvant qu un current item sans workpaper persiste envoie `evidences: []`
- tests prouvant qu un current item persiste reprend exactement le dernier `evidences[]` valide du `GET /workpapers` comme source canonique
- tests prouvant qu aucun `PUT` n est emis si `effectiveRoles[]` est absent, invalide ou sans role maker
- tests prouvant qu aucun `PUT` n est emis si `effectiveRoles[]` prouve seulement `REVIEWER`
- tests prouvant qu aucun `PUT` n est emis sur `ARCHIVED`
- tests prouvant qu aucun `PUT` n est emis si `readiness != READY`
- tests prouvant qu aucun `PUT` n est emis sur `staleWorkpapers[]`
- tests prouvant qu aucun `PUT` n est emis si `anchorCode` n existe plus dans le dernier `items[]` valide
- tests prouvant qu aucun `PUT` n est emis si `evidences[]` requis est absent ou invalide dans le dernier read-model valide et que le texte exact `payload workpapers invalide` est affiche
- tests prouvant qu aucun appel reseau n est emis sur simple saisie du textarea ou simple changement du select
- tests prouvant l absence de bulk update
- tests prouvant qu une seule mutation workpaper peut etre en vol a la fois
- tests prouvant les textes visibles exacts de succes et d erreur pour tous les cas bornes par cette spec
- tests prouvant qu un succes valide declenche exactement un refresh `GET /workpapers`
- tests prouvant qu un refresh `GET /workpapers` reussi est la seule source qui remplace le read-model canonique utilise pour un `PUT` suivant
- tests prouvant qu aucun refresh `GET /controls`, `GET /financial-summary`, `GET /financial-statements/structured`, `GET /mappings/manual`, `GET /api/me` ou `GET /api/closing-folders/{id}` n est ajoute apres succes `PUT workpaper`
- tests prouvant que si le refresh `GET /workpapers` echoue, le dernier bloc `Workpapers` valide reste visible avec `rafraichissement workpapers impossible`
- tests prouvant qu aucun endpoint `documents`, `review-decision`, `exports`, `imports/balance/versions`, `diff-previous` ou IA n est appele
- tests prouvant que `nextAction.path` n est jamais rendu comme lien, bouton ou navigation produit
