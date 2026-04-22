# 022 - Frontend document upload only v1

## Status
Active

## Role de cette spec

Cette spec devient la verite normative de `022`.

Elle borne le plus petit enrichissement frontend metier legitime apres `021` pour permettre au maker d uploader un document unique sur un workpaper courant deja persistant, depuis le bloc `Workpapers` existant sur `/closing-folders/:closingFolderId`, en reutilisant strictement le backend deja livre :

- reutiliser strictement la route existante `/closing-folders/:closingFolderId`
- enrichir strictement le bloc `Workpapers`
- conserver `GET /api/closing-folders/{closingFolderId}/workpapers` comme read-model canonique avant et apres upload
- ajouter uniquement la mutation backend deja livree `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
- afficher les documents uniquement via le payload rafraichi de `GET /workpapers`

`022` ne reouvre ni le backend `document-storage-and-evidence-files-v1`, ni `evidence-review-and-verification-v1`, ni `021`, ni `020`, ni `019`, ni `018`, ni `017`, ni `016`, ni `014`, ni les versions d import, ni le diff previous, ni les exports, ni l IA, ni GraphQL.

## Sources de verite

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ai-cadrage-v1.md`
- `docs/product/v1-plan.md`
- `specs/done/021-frontend-workpapers-maker-update-v1.md`
- `specs/done/020-frontend-workpapers-read-model-v1.md`
- `specs/done/011-document-storage-and-evidence-files-v1.md`
- `specs/done/012-evidence-review-and-verification-v1.md`
- `contracts/openapi/documents-api.yaml`
- `contracts/openapi/workpapers-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/workpapers/api/DocumentsController.kt`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/workpapers/api/WorkpapersController.kt`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/workpapers/application/DocumentService.kt`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/MeController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/DocumentsApiTest.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/WorkpapersApiTest.kt`
- `frontend/src/app/router.tsx`
- `frontend/src/lib/api/http.ts`
- `frontend/src/lib/api/me.ts`
- `frontend/src/lib/api/workpapers.ts`
- `docs/ui/ui-foundations-v1.md`

## Decisions fermees

- `022` enrichit uniquement la route existante `/closing-folders/:closingFolderId`.
- `022` ne cree aucune nouvelle route produit.
- `022` ne cree aucun onglet, aucun drawer metier, aucune sous-navigation produit, aucun file manager riche et aucun bulk upload.
- `022` conserve l ordre visible exact ferme par `021` :
  - `Dossier courant`
  - `Import balance`
  - `Mapping manuel`
  - `Controles`
  - `Financial summary`
  - `Financial statements structured`
  - `Workpapers`
- `022` n ajoute qu un seul nouvel appel frontend autorise :
  - `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
- `022` conserve `GET /api/closing-folders/{closingFolderId}/workpapers` comme read-model canonique avant et apres upload.
- `022` n appelle jamais :
  - `GET /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
  - `GET /api/closing-folders/{closingFolderId}/documents/{documentId}/content`
  - `POST /api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`
  - `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
  - tout endpoint `exports`
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous`
  - tout endpoint IA
- `022` ne transforme jamais `nextAction.path` en navigation produit.
- `022` reste strictement unitaire :
  - aucun multi-upload
  - aucun upload automatique a la selection
  - aucun autosave
  - aucun retry automatique
- Une seule mutation upload document peut etre en vol a la fois sur tout le bloc `Workpapers`.
- `022` ne cree jamais implicitement un workpaper par l upload :
  - le `POST /documents` n est autorise que pour un current item avec `workpaper != null`
  - un current item sans workpaper persiste reste hors upload scope
- `022` suit strictement la verite executable prouvee par `DocumentService` :
  - `closingFolderStatus != ARCHIVED`
  - `readiness = READY`
  - current anchor uniquement
  - workpaper persistant requis
  - roles maker uniquement `ACCOUNTANT | MANAGER | ADMIN`
  - statut workpaper uploadable uniquement `DRAFT | CHANGES_REQUESTED`
- `022` preserve `documents[]` et `documentVerificationSummary` strictement read-only :
  - aucun ajout optimiste local dans `documents[]`
  - aucun recalcul local de `documentVerificationSummary`
  - aucun affichage du document issu du `POST` hors refresh `GET /workpapers`
- Apres succes valide du `POST`, `022` rafraichit uniquement le bloc `Workpapers` via `GET /api/closing-folders/{closingFolderId}/workpapers`.
- `022` ne rafraichit ni `GET /api/me`, ni `GET /api/closing-folders/{id}`, ni `GET /controls`, ni `GET /financial-summary`, ni `GET /financial-statements/structured`, ni `GET /mappings/manual`, ni aucun autre endpoint `documents`, car le repo ne prouve pas qu un upload document reussit doive rafraichir autre chose que `GET /workpapers`.
- En cas d echec de mutation ou de refresh post-succes, les blocs existants restent visibles.

## In scope exact

- enrichissement strict du bloc `Workpapers` sur `/closing-folders/:closingFolderId`
- upload unitaire explicite sur current item deja persistant
- collecte locale minimale de `file`, `sourceLabel` et `documentDate`
- validation locale minimale du draft upload sans parsing du contenu binaire
- consommation du hint `effectiveRoles[]` de `GET /api/me` pour borner les affordances maker
- conservation de `GET /api/closing-folders/{closingFolderId}/workpapers` comme read-model canonique
- affichage exact des etats :
  - idle sans fichier
  - fichier pret
  - fichier rejete
  - uploading
  - succes
  - `400`
  - `401`
  - `403`
  - `404`
  - `409 archived`
  - `409 readiness`
  - `409 other`
  - `413`
  - `5xx`
  - erreur reseau
  - timeout
  - payload succes invalide
  - refresh workpapers impossible
  - unexpected
- refresh local du seul bloc `Workpapers` apres succes valide
- preservation visible des blocs existants si upload ou refresh echoue
- tests frontend couvrant le `POST`, les headers, le `FormData`, les preconditions, l absence d endpoints hors scope et l absence de navigation `nextAction.path`

## Out of scope exact

- toute nouvelle route produit
- toute nouvelle tabulation, drawer metier, stepper metier ou sous-navigation produit
- tout nouveau backend
- tout nouveau contrat OpenAPI
- toute migration
- tout endpoint `GET /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
- tout endpoint `GET /api/closing-folders/{closingFolderId}/documents/{documentId}/content`
- tout endpoint `POST /api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`
- tout endpoint `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
- upload sur un item sans workpaper persistant
- creation implicite d un workpaper via upload
- export packs
- lecture des versions d import
- diff previous
- GraphQL
- toute IA active
- tout file manager riche
- tout drag and drop metier
- tout multi-upload
- tout autosave
- tout download document
- toute review document
- tout CTA vers review evidence
- tout CTA vers exports
- toute navigation produit basee sur `nextAction.path`
- tout refresh des blocs `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` ou `Financial statements structured` hors refresh local strict de `GET /workpapers`

## Regle d heritage depuis 021

Sauf remplacement explicite dans cette spec, `022` conserve les regles fermees de `021` pour :

- la route `/closing-folders/:closingFolderId`
- l ordre visible des blocs
- le rendu du bloc `Workpapers`
- le rendu read-only de `summaryCounts`
- le rendu read-only de `documents[]`
- le rendu read-only de `documentVerificationSummary`
- la preservation de l ordre backend de `items[]`, `staleWorkpapers[]` et `documents[]`
- l absence de CTA `download`, `review evidence`, `exports` ou `nextAction.path`
- la mutation maker `PUT /workpapers/{anchorCode}` et ses etats existants
- le traitement local de `400` sur `GET /workpapers` comme la meme branche visible que `unexpected`

## Surface exacte de 022

### `/closing-folders/:closingFolderId`

- statut : unique route produit enrichie par `022`
- la route conserve le shell, le breadcrumb, la sidebar, le contexte tenant et les blocs deja livres
- la route reste une page simple en flux vertical unique
- aucun onglet, aucune sous-navigation et aucune navigation additionnelle ne sont autorises

### Bloc `Workpapers`

- titre visible exact : `Workpapers`
- sous-titre visible exact : `Maker update unitaire`
- le rappel nominal de `021` reste visible :
  - `Mise a jour maker unitaire sur les workpapers courants uniquement.`
- sous-blocs autorises :
  - `Resume workpapers`
  - le slot existant `Etat mutation workpaper`
  - `Workpapers courants`
  - `Workpapers stale`
- sous-sections autorisees dans chaque current item eligible :
  - toutes les lignes read-only de `021`
  - le formulaire maker de `021` quand il existe
  - une sous-section inline `Upload document`
  - `Documents inclus` strictement read-only
  - `Verification documents` strictement read-only
- composants interdits :
  - bouton `Telecharger le document`
  - bouton `Ouvrir les documents`
  - bouton `Prendre une decision reviewer`
  - bouton `Ouvrir les exports`
  - lien issu de `nextAction.path`
  - toute liste dediee `documents` hors `GET /workpapers`

### Placement exact de l action upload

- l action upload apparait uniquement dans chaque carte current de `items[]`
- l action upload apparait apres le formulaire maker de `021` quand ce formulaire existe
- l action upload apparait avant la sous-section `Documents inclus`
- aucun bouton upload global au niveau du bloc `Workpapers` n est autorise
- aucun bouton upload n apparait dans `staleWorkpapers[]`

### Items pouvant afficher l action upload

- `items[]` avec `workpaper != null`
- `items[]` avec `isCurrentStructure = true`
- `items[]` avec `workpaper.status = DRAFT | CHANGES_REQUESTED`
- et seulement si toutes les preconditions globales d ecriture sont vraies

### Items restant read-only pour l upload

- `items[]` avec `workpaper = null`
  - le formulaire maker de `021` reste disponible
  - pas de bouton upload
  - texte exact visible : `upload disponible apres creation du workpaper`
- `items[]` avec `workpaper.status = READY_FOR_REVIEW | REVIEWED`
  - pas de bouton upload
  - texte exact visible : `workpaper en lecture seule`
- `staleWorkpapers[]`
  - pas de bouton upload
  - texte exact visible quand la section contient au moins un stale : `workpapers stale en lecture seule`
- tous les current items quand le bloc est globalement read-only
  - pas de bouton upload
  - texte global exact deja ferme par `021`

### Sous-section `Upload document`

La sous-section `Upload document` rend exactement dans cet ordre pour chaque current item uploadable :

1. libelle exact `Upload document`
2. champ fichier natif libelle exact `Fichier document`
3. champ texte libelle exact `Source document`
4. champ date libelle exact `Date document`
5. zone d etat upload locale mono-message
6. bouton exact `Uploader le document`

Contraintes de rendu :

- `Fichier document` n autorise localement qu un seul fichier
- `Source document` est obligatoire
- `Date document` est optionnelle
- la sous-section ne rend aucune liste de fichiers locale
- la sous-section ne rend aucun drag and drop riche
- la sous-section ne rend aucun historique d upload

Etat local initial exact pour chaque current item uploadable :

- `file = null`
- `sourceLabel = ""`
- `documentDate = ""`
- zone d etat locale initiale : `selectionner un fichier`

## Preconditions d upload exactes

### Priorite locale de blocage

Pour tout current item, la priorite locale de blocage upload est figee ainsi :

1. `closingFolderStatus = ARCHIVED`
2. `readiness != READY`
3. aucun role writer prouve exploitable
4. item absent du dernier `items[]` valide ou `isCurrentStructure != true`
5. `workpaper = null`
6. `workpaper.status` hors `DRAFT | CHANGES_REQUESTED`
7. une mutation workpaper est deja en vol
8. un upload document est deja en vol
9. draft upload local invalide

Quand une cause de priorite plus haute s applique, `022` n affiche pas un message concurrent de priorite plus basse pour le meme item.

### Roles

Preuve repo retenue :

- `GET /api/me` expose `effectiveRoles[]`
- `DocumentService` autorise l upload maker pour `ACCOUNTANT`, `MANAGER`, `ADMIN`
- `DocumentService` refuse l upload pour `REVIEWER`

Regle frontend exacte :

- si `effectiveRoles[]` contient `ACCOUNTANT`, `MANAGER` ou `ADMIN`, l item courant peut devenir uploadable sous reserve des autres preconditions
- si `effectiveRoles[]` contient seulement `REVIEWER` parmi les roles prouvants, le bloc reste lecture seule pour l upload
- si `effectiveRoles[]` est absent, invalide ou inexploitable, le bloc reste lecture seule pour l upload
- le frontend ne devine jamais un droit d ecriture a partir d un autre signal que `effectiveRoles[]`
- texte exact visible quand aucun role writer prouve n est exploitable : `lecture seule`

### Fermeture et readiness

`022` consomme `closingFolderStatus` et `readiness` depuis `GET /workpapers` pour borner l upload local.

Decision de verite executable :

- `DocumentService.ensureWritable` suit `controls.readiness = READY`
- `contracts/openapi/documents-api.yaml` suit `controls.readiness = READY`
- `DocumentsApiTest` prouve `409` sur `ARCHIVED` et sur `readiness != READY`

Regle frontend exacte :

- si `closingFolderStatus = ARCHIVED`
  - aucun `POST` n est emis
  - tous les inputs upload et boutons upload sont desactives ou omis
  - texte exact visible : `dossier archive, workpaper en lecture seule`
- si `readiness != READY`
  - aucun `POST` n est emis
  - tous les inputs upload et boutons upload sont desactives ou omis
  - texte exact visible : `workpaper non modifiable tant que les controles ne sont pas READY`

### Current uniquement

- l item doit provenir du dernier `items[]` valide charge depuis `GET /workpapers`
- `anchorCode` doit correspondre exactement a un current item charge
- `isCurrentStructure` doit etre `true`
- `staleWorkpapers[]` reste toujours hors upload scope
- si le click handler ne retrouve pas `anchorCode` dans le dernier `items[]` valide
  - aucun `POST` n est emis
  - le message exact visible est `upload document indisponible`

### Workpaper persistant uniquement

- `item.workpaper != null` est obligatoire
- si `item.workpaper == null`
  - aucun `POST` n est emis
  - aucun bouton upload n apparait
  - texte exact visible : `upload disponible apres creation du workpaper`
- `022` ne tente jamais de creer d abord un workpaper puis d uploader

### Statut workpaper uploadable exact

- upload autorise seulement si `item.workpaper.status = DRAFT | CHANGES_REQUESTED`
- si `item.workpaper.status = READY_FOR_REVIEW | REVIEWED`
  - aucun `POST` n est emis
  - aucun bouton upload n apparait
  - texte exact visible : `workpaper en lecture seule`

### Concurrence exacte

- si une mutation workpaper `PUT /workpapers/{anchorCode}` est deja en vol
  - aucun `POST /documents` n est emis
  - tous les inputs upload et boutons upload du bloc `Workpapers` sont desactives
  - le seul texte visible requis reste celui de `021` : `enregistrement workpaper en cours`
- si un upload document est deja en vol
  - tout second clic `Uploader le document`, sur le meme item ou un autre current item, est ignore localement
  - aucun second `POST /documents` n est emis
  - le message exact visible reste `upload document en cours`

## Contrat API reel consomme par 022

### Verite unique retenue

`022` consomme uniquement cet ensemble ferme :

- `GET /api/me`
- `GET /api/closing-folders/{id}`
- `GET /api/closing-folders/{closingFolderId}/controls`
- `GET /api/closing-folders/{closingFolderId}/mappings/manual`
- `GET /api/closing-folders/{closingFolderId}/financial-summary`
- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
- `GET /api/closing-folders/{closingFolderId}/workpapers`
- `PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}`
- `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
- `POST /api/closing-folders/{closingFolderId}/imports/balance`
- `PUT /api/closing-folders/{closingFolderId}/mappings/manual`
- `DELETE /api/closing-folders/{closingFolderId}/mappings/manual`

`022` n ajoute aucun autre endpoint.

### `GET /api/me`

Sous-ensemble exact consomme par `022` :

- `activeTenant.tenantId`
- `activeTenant.tenantSlug`
- `activeTenant.tenantName`
- `effectiveRoles[]` comme hint d affordance seulement

Regle exacte :

- `022` conserve tous les etats shell deja figes par `021`
- `effectiveRoles[]` n est jamais utilise pour contourner le backend
- `effectiveRoles[]` n est jamais transforme en navigation ou workflow

### `GET /api/closing-folders/{closingFolderId}/workpapers`

`022` n ajoute aucun nouveau champ consomme a `GET /workpapers` au-dela de `021`.

Regle exacte :

- `GET /workpapers` reste la seule source canonique locale pour :
  - `closingFolderStatus`
  - `readiness`
  - `items[]`
  - `staleWorkpapers[]`
  - `items[].workpaper`
  - `items[].documents[]`
  - `items[].documentVerificationSummary`
- les documents visibles apres upload proviennent uniquement du payload rafraichi de `GET /workpapers`
- le payload succes du `POST /documents` ne remplace jamais localement `items[].documents[]`

### `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`

Preuve repo :

- `contracts/openapi/documents-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/workpapers/api/DocumentsController.kt`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/workpapers/application/DocumentService.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/DocumentsApiTest.kt`

Path exact :

- `/api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`

Methode exacte :

- `POST`

Headers exacts :

- `Accept: application/json` sur chaque `POST`
- `X-Tenant-Id = activeTenant.tenantId` sur chaque `POST`
- aucun header applicatif additionnel n est introduit par `022`

Regle exacte sur `Content-Type` :

- le frontend ne renseigne jamais `Content-Type` manuellement
- le navigateur porte seul `multipart/form-data` avec sa `boundary`
- tout header manuel `Content-Type: multipart/form-data` sans `boundary` est interdit

Body exact :

- le body est obligatoirement un `FormData`
- le body ne contient aucun JSON wrapper
- le body contient exactement `2` parts si `documentDate` est omise, sinon exactement `3` parts
- le frontend ajoute exactement :
  - `file`
  - `sourceLabel`
  - `documentDate` seulement si une valeur valide non vide existe
- ordre d append exact emis par le frontend :
  1. `file`
  2. `sourceLabel`
  3. `documentDate` seulement si present
- le backend ne depend pas de cet ordre multipart, mais `022` l emet toujours dans cet ordre pour garder des tests deterministes
- `sourceLabel` et `documentDate` sont ajoutes comme chaines simples via `FormData.append(name, value)`
- `documentDate` n est jamais envoye comme JSON, `Blob`, timestamp numerique ou valeur `Date.toString()`

Assemblage exact attendu :

```ts
const formData = new FormData();
formData.append("file", selectedFile);
formData.append("sourceLabel", trimmedSourceLabel);
if (documentDate !== "") {
  formData.append("documentDate", documentDate);
}
```

Champ fichier exact :

- nom exact : `file`
- cardinalite exacte : un seul fichier
- type exact : `File`
- requis : oui
- source UI exacte : champ `Fichier document`
- fallback exact si absent :
  - aucun `POST`
  - texte exact visible : `selectionner un fichier`

Champs metadata exacts :

- `sourceLabel`
  - requis : oui
  - type attendu : `string`
  - source UI exacte : champ `Source document`
  - regle frontend : valeur trimmee non vide
  - fallback exact si absent, vide ou seulement whitespace :
    - aucun `POST`
    - texte exact visible : `source du document requise`
- `documentDate`
  - requis : non
  - type attendu : `string` ISO `YYYY-MM-DD`
  - source UI exacte : champ `Date document`
  - regle frontend : omis si vide
  - fallback exact si vide :
    - aucun message d erreur
    - part `documentDate` omise du `FormData`
  - fallback exact si valeur non vide invalide :
    - aucun `POST`
    - texte exact visible : `date document invalide`

Champs interdits :

- `closingFolderId`
- `anchorCode`
- `tenantId`
- `workpaperId`
- `documentId`
- `noteText`
- `status`
- `evidences`
- `reviewComment`
- `decision`
- tout champ `documents[]`
- toute structure JSON `payload`

Succes frontend exact :

- le seul succes nominal accepte est `201`
- un succes frontend est acquis seulement si le statut HTTP est `201` et si le sous-ensemble succes ci-dessous est valide
- tout `200` recu sur ce `POST` est classe dans `unexpected`
- le payload `201` n expose ni `closingFolderId` ni `anchorCode`
- le frontend ne peut donc pas prouver la coherence route / item avec le seul payload succes
- `022` n injecte jamais localement le payload succes dans `items[].documents[]`
- la coherence canonique avec `closingFolderId` et `anchorCode` revient uniquement du refresh `GET /workpapers`

Sous-ensemble exact du payload succes consomme cote frontend :

- `id`
  - requis : oui
  - type attendu : `string` UUID
- `fileName`
  - requis : oui
  - type attendu : `string`
  - coherence minimale : non vide
  - le frontend ne compare jamais `fileName` a `selectedFile.name` car le backend normalise le nom de fichier cote serveur
- `mediaType`
  - requis : oui
  - type attendu : `string`
  - coherence exacte :
    - valeur de l allow-list backend
    - et, si `selectedFile.type` etait non vide localement, egal au MIME local normalise
- `byteSize`
  - requis : oui
  - type attendu : `integer`
  - coherence exacte : `byteSize == selectedFile.size`
- `checksumSha256`
  - requis : oui
  - type attendu : `string`
  - coherence exacte : regex lowercase `^[0-9a-f]{64}$`
- `sourceLabel`
  - requis : oui
  - type attendu : `string`
  - coherence exacte : egal au `sourceLabel` trimme envoye
- `documentDate`
  - requis : oui
  - type attendu : `string | null`
  - coherence exacte : egal a la valeur envoyee, ou `null` si omise
- `createdAt`
  - requis : oui
  - type attendu : `string` date-time
- `createdByUserId`
  - requis : oui
  - type attendu : `string` UUID
- `verificationStatus`
  - requis : oui
  - type attendu : `string`
  - coherence exacte : `UNVERIFIED`
- `reviewComment`
  - requis : oui
  - type attendu : `string | null`
  - coherence exacte : `null`
- `reviewedAt`
  - requis : oui
  - type attendu : `string | null`
  - coherence exacte : `null`
- `reviewedByUserId`
  - requis : oui
  - type attendu : `string | null`
  - coherence exacte : `null`

Champs explicitement non consommes sur le succes `POST /documents` :

- le header `Location`
- tout futur champ additif

Fallback exact si payload succes invalide :

- texte exact visible : `payload upload document invalide`
- aucun refresh `GET /workpapers` n est emis
- le dernier bloc `Workpapers` valide deja affiche reste visible
- le payload succes invalide n est jamais utilise pour rendre un document localement

### Lecture exacte des erreurs mutation

Le contrat OpenAPI `documents` ne publie aucun schema d erreur structure obligatoire pour le `POST`. `022` ne depend donc jamais d un payload d erreur structure pour fonctionner.

Si un body JSON expose un top-level string `message`, `022` peut l exploiter seulement pour raffiner ces cas exacts :

- `Closing folder is archived and documents cannot be modified.` -> `dossier archive, document non modifiable`
- `Documents can only be modified when controls.readiness is READY.` -> `document non modifiable tant que les controles ne sont pas READY`
- `anchorCode is not part of the current structure.` -> `document indisponible sur un workpaper stale`
- `workpaper status does not allow document uploads.` -> `document non modifiable pour ce workpaper`
- `file.mediaType is not allowed.` -> `format de fichier non autorise`
- `file must not be empty.` -> `fichier vide`
- `sourceLabel must not be blank.` -> `source du document requise`
- `file exceeds the 25 MiB limit.` -> `fichier trop volumineux (25 MiB max)`

Tout autre body d erreur est ignore et le frontend retombe strictement sur le seul statut HTTP.

## Validation locale minimale

### Presence et cardinalite

- un fichier est obligatoire pour rendre le draft uploadable
- un seul fichier est autorise
- aucune selection multiple n est acceptee

Textes exacts :

- absence de fichier : `selectionner un fichier`
- plus d un fichier : `un seul fichier est autorise`

### Type / extension / MIME

Verite prouvee par le backend :

- `application/pdf`
- `image/jpeg`
- `image/png`
- `image/tiff`
- `text/csv`
- `application/vnd.ms-excel`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

Derive frontend autorisee pour la validation locale minimale :

- `.pdf`
- `.jpg`
- `.jpeg`
- `.png`
- `.tif`
- `.tiff`
- `.csv`
- `.xls`
- `.xlsx`

Regle exacte :

- l extension est calculee en lowercase a partir du suffixe du nom de fichier apres le dernier `.`
- la comparaison d extension est insensible a la casse
- `File.type` est normalise en lowercase trimme
- si `File.type` est non vide et hors allow-list MIME, le fichier est rejete meme si l extension appartient a l allow-list
- si `File.type` est non vide et appartient a l allow-list MIME, le fichier reste localement acceptable meme si l extension est absente ou hors allow-list
- si `File.type` est vide, l extension visible du nom de fichier doit appartenir a l allow-list derivee ci-dessus
- si `File.type` est vide et que l extension est absente ou hors allow-list, le fichier est rejete
- si ni le MIME ni l extension ne sont compatibles, aucun `POST` n est emis
- texte exact visible : `format de fichier non autorise`

### Taille

Verite prouvee par le backend :

- taille minimale utile : `> 0`
- taille maximale : `25 MiB`

Regle exacte :

- si `file.size <= 0`, aucun `POST` n est emis
- texte exact visible : `fichier vide`
- si `file.size > 26214400`, aucun `POST` n est emis
- texte exact visible : `fichier trop volumineux (25 MiB max)`

### Metadata requis

- `sourceLabel`
  - requis : oui
  - validation locale exacte : `trim().length > 0`
  - texte exact visible si invalide : `source du document requise`
- `documentDate`
  - requis : non
  - validation locale exacte : si renseigne, format `YYYY-MM-DD`
  - texte exact visible si invalide : `date document invalide`

### Regles complementaires

- aucun parsing local du contenu binaire n est autorise
- aucune lecture locale du PDF, CSV, image ou tableur n est autorisee
- aucun checksum local n est calcule
- le bouton `Uploader le document` est actif seulement si :
  - aucune mutation workpaper n est en vol
  - aucun upload document n est en vol
  - toutes les preconditions globales sont vraies
  - le draft upload local est valide

## Sequence reseau exacte

### Chargement initial

- la sequence initiale de `021` reste strictement inchangee
- `022` n ajoute aucun appel reseau supplementaire au chargement initial
- `GET /api/closing-folders/{closingFolderId}/workpapers` reste emis une seule fois au chargement initial de la route detail

### Selection locale

1. l utilisateur choisit un fichier
2. l utilisateur renseigne `Source document`
3. l utilisateur peut renseigner `Date document`
4. aucun appel reseau n est emis a cette etape
5. `022` n emet jamais de `POST` sur `change`, `input` ou `blur` du champ fichier, du champ `Source document` ou du champ `Date document`

### Mutation `POST`

1. l utilisateur clique explicitement `Uploader le document`
2. si l item reste uploadable et si le draft upload local est valide, le frontend emet exactement un `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
3. le `POST` envoie exactement :
   - `Accept: application/json`
   - `X-Tenant-Id = activeTenant.tenantId`
   - `FormData` avec `file`, `sourceLabel` et `documentDate` optionnel
4. le frontend applique exactement la convention timeout de `frontend/src/lib/api/http.ts`, soit `DEFAULT_REQUEST_TIMEOUT_MS = 5000`
5. si les preconditions locales ne sont plus satisfaites au moment du clic
   - aucun appel reseau n est emis
   - la zone d etat locale affiche le texte exact de blocage local prevu par cette spec
6. pendant ce `POST`, aucun second `POST /documents` n est autorise
7. pendant ce `POST`, aucun endpoint hors scope n est autorise

### Sequence exacte apres succes valide

1. afficher immediatement le succes mutation exact
2. lancer exactement un `GET /api/closing-folders/{closingFolderId}/workpapers`
3. si le refresh retourne un read-model nominal valide, remplacer integralement le bloc `Workpapers`
4. les documents visibles ensuite proviennent uniquement de `items[].documents[]` du `GET /workpapers` rafraichi
5. si le refresh echoue, conserver le dernier bloc `Workpapers` valide deja affiche et ajouter exactement `rafraichissement workpapers impossible`
6. aucun autre bloc n est rafraichi
7. aucun redirect et aucune nouvelle navigation ne sont autorises

### Sequence exacte si le refresh `Workpapers` echoue

- le succes mutation deja acquis n est pas degrade en erreur mutation
- le dernier bloc `Workpapers` valide deja affiche reste visible
- les blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` restent visibles
- le texte exact additionnel visible est `rafraichissement workpapers impossible`

## Matrice d etats exacte du bloc `Workpapers`

### Etats de lecture et de precondition locale

#### `UPLOAD_READ_ONLY_ROLE`

Condition :

- read-model `Workpapers` nominal valide
- `closingFolderStatus != ARCHIVED`
- `readiness = READY`
- aucun role writer prouve n est exploitable cote frontend

Rendu exact :

- rappel exact visible
- texte exact visible : `lecture seule`
- aucun input upload
- aucun bouton upload

#### `UPLOAD_READ_ONLY_ARCHIVED`

Condition :

- read-model `Workpapers` nominal valide
- `closingFolderStatus = ARCHIVED`

Rendu exact :

- rappel exact visible
- texte exact visible : `dossier archive, workpaper en lecture seule`
- aucun input upload
- aucun bouton upload

#### `UPLOAD_READ_ONLY_NOT_READY`

Condition :

- read-model `Workpapers` nominal valide
- `closingFolderStatus != ARCHIVED`
- `readiness != READY`

Rendu exact :

- rappel exact visible
- texte exact visible : `workpaper non modifiable tant que les controles ne sont pas READY`
- aucun input upload
- aucun bouton upload

#### `UPLOAD_NO_PERSISTED_WORKPAPER`

Condition :

- current item valide
- `workpaper = null`
- aucune cause de blocage globale de priorite plus haute

Rendu exact :

- texte exact visible dans la carte item : `upload disponible apres creation du workpaper`
- aucun input upload
- aucun bouton upload

#### `UPLOAD_ITEM_READ_ONLY_STATUS`

Condition :

- current item valide
- `workpaper.status = READY_FOR_REVIEW | REVIEWED`
- aucune cause de blocage globale de priorite plus haute

Rendu exact :

- texte exact visible dans la carte item : `workpaper en lecture seule`
- aucun input upload
- aucun bouton upload

#### `UPLOAD_IDLE_NO_FILE`

Condition :

- current item uploadable
- aucun fichier local valide n est selectionne

Rendu exact :

- zone d etat upload locale
- texte exact visible : `selectionner un fichier`
- bouton `Uploader le document` desactive

#### `UPLOAD_FILE_READY`

Condition :

- current item uploadable
- draft upload local valide

Rendu exact :

- zone d etat upload locale
- texte exact visible : `fichier pret pour upload`
- bouton `Uploader le document` actif

#### `UPLOAD_FILE_REJECTED`

Condition :

- current item uploadable
- draft upload local invalide

Rendu exact :

- zone d etat upload locale
- texte exact visible : l un des messages suivants, un seul a la fois :
  - `selectionner un fichier`
  - `un seul fichier est autorise`
  - `format de fichier non autorise`
  - `fichier vide`
  - `fichier trop volumineux (25 MiB max)`
  - `source du document requise`
  - `date document invalide`
- bouton `Uploader le document` desactive

### Etats de mutation upload

#### `UPLOAD_SUBMITTING`

Condition :

- un `POST /workpapers/{anchorCode}/documents` est en cours

Rendu exact :

- zone d etat upload locale
- texte exact visible : `upload document en cours`
- tous les inputs upload et boutons upload du bloc `Workpapers` sont desactives

#### `UPLOAD_SUCCESS`

Condition :

- le `POST` retourne `201`
- le payload succes est valide pour le sous-ensemble exact consomme

Rendu exact :

- zone d etat upload locale
- texte exact visible : `document uploade avec succes`

#### `UPLOAD_BAD_REQUEST`

Condition :

- le `POST` retourne `400`
- aucun raffinement plus specifique n est applicable

Rendu exact :

- zone d etat upload locale
- texte exact visible : `document invalide`

#### `UPLOAD_AUTH_REQUIRED`

Condition :

- le `POST` retourne `401`

Rendu exact :

- zone d etat upload locale
- texte exact visible : `authentification requise`

#### `UPLOAD_FORBIDDEN`

Condition :

- le `POST` retourne `403`

Rendu exact :

- zone d etat upload locale
- texte exact visible : `acces documents refuse`

#### `UPLOAD_NOT_FOUND`

Condition :

- le `POST` retourne `404`

Rendu exact :

- zone d etat upload locale
- texte exact visible : `workpaper introuvable pour upload document`

#### `UPLOAD_CONFLICT_ARCHIVED`

Condition :

- le bloc est deja en lecture seule archive
- ou le `POST` retourne `409` et un raffinement exact archive est applicable

Rendu exact :

- zone d etat upload locale
- texte exact visible : `dossier archive, document non modifiable`

#### `UPLOAD_CONFLICT_NOT_READY`

Condition :

- le bloc est deja en lecture seule `readiness != READY`
- ou le `POST` retourne `409` et le raffinement exact `controls.readiness = READY` est applicable

Rendu exact :

- zone d etat upload locale
- texte exact visible : `document non modifiable tant que les controles ne sont pas READY`

#### `UPLOAD_CONFLICT_OTHER`

Condition :

- le `POST` retourne `409`
- aucun raffinement exact `archive` ni `readiness` n est applicable

Rendu exact :

- zone d etat upload locale
- texte exact visible selon le raffinement prouve si disponible :
  - `document indisponible sur un workpaper stale`
  - `document non modifiable pour ce workpaper`
- sinon texte exact visible : `upload document impossible`

#### `UPLOAD_PAYLOAD_TOO_LARGE`

Condition :

- le `POST` retourne `413`

Rendu exact :

- zone d etat upload locale
- texte exact visible : `fichier trop volumineux (25 MiB max)`

#### `UPLOAD_SERVER_ERROR`

Condition :

- le `POST` retourne `5xx`

Rendu exact :

- zone d etat upload locale
- texte exact visible : `erreur serveur documents`

#### `UPLOAD_NETWORK_ERROR`

Condition :

- le `POST` echoue pour erreur reseau

Rendu exact :

- zone d etat upload locale
- texte exact visible : `erreur reseau documents`

#### `UPLOAD_TIMEOUT`

Condition :

- le `POST` echoue par timeout selon la convention de `frontend/src/lib/api/http.ts`

Rendu exact :

- zone d etat upload locale
- texte exact visible : `timeout documents`

#### `UPLOAD_INVALID_SUCCESS_PAYLOAD`

Condition :

- le `POST` retourne `201`
- le payload succes est invalide, incomplet ou incoherent pour le sous-ensemble exact consomme

Rendu exact :

- zone d etat upload locale
- texte exact visible : `payload upload document invalide`
- aucun refresh `GET /workpapers` n est emis

#### `UPLOAD_REFRESH_FAILED`

Condition :

- le `POST` a deja produit un succes valide
- le refresh `GET /workpapers` echoue ou retourne un payload invalide

Rendu exact :

- zone d etat upload locale
- textes exacts visibles :
  - `document uploade avec succes`
  - `rafraichissement workpapers impossible`

#### `UPLOAD_UNEXPECTED`

Condition :

- le `POST` retourne un statut non explicitement borne par cette spec

Rendu exact :

- zone d etat upload locale
- texte exact visible : `upload document indisponible`

## Regles de rendu et textes exacts

- titre sous-section upload exact : `Upload document`
- libelle champ fichier exact : `Fichier document`
- libelle champ source exact : `Source document`
- libelle champ date exact : `Date document`
- texte exact du bouton upload : `Uploader le document`
- texte exact du succes upload : `document uploade avec succes`
- texte exact du idle sans fichier : `selectionner un fichier`
- texte exact du fichier pret : `fichier pret pour upload`
- texte exact du no workpaper persistant : `upload disponible apres creation du workpaper`
- texte exact du item non uploadable : `workpaper en lecture seule`
- texte exact du stale read-only : `workpapers stale en lecture seule`
- texte exact du dossier archive nominal : `dossier archive, workpaper en lecture seule`
- texte exact du role non writable : `lecture seule`
- texte exact du read-only readiness : `workpaper non modifiable tant que les controles ne sont pas READY`
- texte exact du conflit archive : `dossier archive, document non modifiable`
- texte exact du conflit readiness : `document non modifiable tant que les controles ne sont pas READY`
- texte exact du conflit stale prouve : `document indisponible sur un workpaper stale`
- texte exact du conflit statut workpaper prouve : `document non modifiable pour ce workpaper`
- texte exact du conflit autre fallback : `upload document impossible`
- texte exact du `400` fallback : `document invalide`
- texte exact du `403` : `acces documents refuse`
- texte exact du `404` : `workpaper introuvable pour upload document`
- texte exact du `413` : `fichier trop volumineux (25 MiB max)`
- texte exact du `5xx` : `erreur serveur documents`
- texte exact du reseau : `erreur reseau documents`
- texte exact du timeout : `timeout documents`
- texte exact du payload succes invalide : `payload upload document invalide`
- texte exact du refresh post-succes impossible : `rafraichissement workpapers impossible`
- texte exact du unexpected : `upload document indisponible`

## Garde-fous anti-scope

- `022` n appelle jamais `GET /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
- `022` n appelle jamais `GET /api/closing-folders/{closingFolderId}/documents/{documentId}/content`
- `022` n appelle jamais `POST /api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`
- `022` n appelle jamais `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
- `022` n appelle aucun endpoint download
- `022` n appelle aucun endpoint review document
- `022` n appelle aucun endpoint review workpaper
- `022` n appelle aucun endpoint exports
- `022` n appelle aucun endpoint import versions
- `022` n appelle aucun endpoint diff previous
- `022` n appelle aucun endpoint IA
- `022` ne transforme jamais `nextAction.path` en navigation produit
- `022` ne cree aucun file manager riche
- `022` ne propose aucun upload multiple
- `022` ne modifie pas les refreshs `Import balance`, `Mapping manuel`, `Controles`, `Financial summary` ou `Financial statements structured` hors refresh local strictement necessaire de `GET /workpapers`
- `022` ne convertit jamais `documents[]` ou `documentVerificationSummary` en surface editable

## Criteres d acceptation frontend

- `specs/active/022-frontend-document-upload-only-v1.md` existe
- `/closing-folders/:closingFolderId` reste l unique route produit enrichie par `022`
- aucun nouveau backend n est introduit
- aucun nouveau contrat OpenAPI n est introduit
- le bloc `Workpapers` reste place strictement apres `Financial statements structured`
- `022` n ajoute qu un seul nouvel endpoint consomme :
  - `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
- `GET /api/closing-folders/{closingFolderId}/workpapers` reste le read-model canonique avant et apres upload
- l upload n est possible que sur un current item avec `workpaper != null`
- aucun upload n est possible sur `staleWorkpapers[]`
- aucun upload n est possible sur un current item sans workpaper persistant
- aucun upload n est possible sur `ARCHIVED`
- aucun upload n est possible si `readiness != READY`
- aucun upload n est possible si `effectiveRoles[]` est absent, invalide ou sans role maker
- aucun upload n est possible si `effectiveRoles[]` prouve seulement `REVIEWER`
- aucun upload n est possible si `workpaper.status` n appartient pas a `DRAFT | CHANGES_REQUESTED`
- aucun upload n est possible si `anchorCode` n existe plus dans le dernier `items[]` valide
- aucun upload n est possible si une mutation workpaper est deja en vol
- aucun second upload n est possible si un upload document est deja en vol
- aucun autosave n est introduit
- aucun upload multiple n est introduit
- une seule mutation upload document peut etre en vol a la fois
- le `POST` utilise `FormData`
- le `POST` envoie exactement `file`, `sourceLabel` et `documentDate` optionnel
- le `POST` utilise toujours `X-Tenant-Id = activeTenant.tenantId`
- le `POST` n envoie jamais `Content-Type` manuellement
- les etats visibles exacts sont testables pour :
  - idle sans fichier
  - fichier pret
  - fichier rejete
  - uploading
  - succes
  - `400`
  - `401`
  - `403`
  - `404`
  - `409 archived`
  - `409 readiness`
  - `409 other`
  - `413`
  - `5xx`
  - erreur reseau
  - timeout
  - payload succes invalide
  - refresh workpapers impossible
  - unexpected
- en cas d echec de mutation, les blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary`, `Financial statements structured` et `Workpapers` restent visibles
- apres succes valide, seul `GET /workpapers` est rafraichi
- si le refresh `GET /workpapers` echoue, le dernier bloc `Workpapers` valide deja affiche reste visible
- aucun endpoint `GET /workpapers/{anchorCode}/documents`, `GET /documents/{documentId}/content`, `POST /documents/{documentId}/verification-decision`, `POST /workpapers/{anchorCode}/review-decision`, `exports`, `imports/balance/versions`, `diff-previous` ou IA n est appele
- `nextAction.path` ne devient jamais un lien, un bouton ou une navigation produit

## Tests frontend requis

- `pnpm test:ci`
- `pnpm lint`
- `pnpm build`
- tests prouvant que le bloc `Workpapers` reste place strictement apres `Financial statements structured`
- tests prouvant que le seul nouvel endpoint consomme par `022` est `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
- tests prouvant que le `POST` utilise exactement le path `/api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents` avec `anchorCode` issu du current item
- tests prouvant que le `POST` envoie exactement les headers `Accept` et `X-Tenant-Id`
- tests prouvant l absence de `Content-Type` manuel quand le body est un `FormData`
- tests prouvant que le body du `POST` contient exactement `file`, `sourceLabel` et `documentDate` optionnel, et aucun autre champ
- tests prouvant que le `FormData` contient exactement `2` parts si `documentDate` est vide, sinon exactement `3`
- tests prouvant que l ordre d append est `file` puis `sourceLabel` puis `documentDate` quand il est present
- tests prouvant qu aucun appel reseau n est emis sur simple selection du fichier, simple saisie `Source document` ou simple saisie `Date document`
- tests prouvant les validations locales exactes :
  - absence fichier
  - pluralite de fichiers
  - `File.type` renseigne et hors allow-list MIME, meme si l extension est autorisee
  - `File.type` autorise et extension hors allow-list
  - `File.type` vide et extension autorisee
  - `File.type` vide et extension hors allow-list
  - fichier vide
  - fichier > `25 MiB`
  - `sourceLabel` vide
  - `documentDate` invalide
- tests prouvant qu aucun upload n est emis sur `staleWorkpapers[]`
- tests prouvant qu aucun upload n est emis sur un current item sans workpaper persistant
- tests prouvant qu aucun upload n est emis sur `ARCHIVED`
- tests prouvant qu aucun upload n est emis si `readiness != READY`
- tests prouvant qu aucun upload n est emis si `effectiveRoles[]` est absent, invalide ou sans role maker
- tests prouvant qu aucun upload n est emis si `effectiveRoles[]` prouve seulement `REVIEWER`
- tests prouvant qu aucun upload n est emis si `workpaper.status = READY_FOR_REVIEW | REVIEWED`
- tests prouvant qu aucun upload n est emis si `anchorCode` n existe plus dans le dernier `items[]` valide
- tests prouvant qu aucun upload n est emis si une mutation workpaper est deja en vol
- tests prouvant qu aucun upload document supplementaire n est emis si un upload document est deja en vol
- tests prouvant qu un seul upload document peut etre en vol a la fois
- tests prouvant qu un `201` avec payload succes invalide n emet aucun refresh `GET /workpapers`
- tests prouvant qu un `200` sur `POST /documents` est classe dans `unexpected`
- tests prouvant les textes visibles exacts de succes et d erreur pour tous les cas bornes par cette spec
- tests prouvant qu un succes valide declenche exactement un refresh `GET /workpapers`
- tests prouvant que si le refresh `GET /workpapers` echoue, le dernier bloc `Workpapers` valide reste visible avec `rafraichissement workpapers impossible`
- tests prouvant que les documents visibles apres succes proviennent uniquement du payload rafraichi de `GET /workpapers`
- tests prouvant qu aucun endpoint `GET /workpapers/{anchorCode}/documents`, `GET /documents/{documentId}/content`, `POST /documents/{documentId}/verification-decision`, `POST /workpapers/{anchorCode}/review-decision`, `exports`, `imports/balance/versions`, `diff-previous` ou IA n est appele
- tests prouvant que les blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles`, `Financial summary`, `Financial statements structured` et `Workpapers` restent visibles si l upload echoue
- tests prouvant que `nextAction.path` n est jamais rendu comme lien, bouton ou navigation produit
