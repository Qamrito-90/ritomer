# 017 - Frontend manual mapping v1

## Status
Active

## Role de cette spec

Cette spec devient la verite normative de `017`.

Elle borne le plus petit enrichissement frontend metier legitime apres `016` pour traiter le blocker `COMPLETE_MANUAL_MAPPING` directement depuis `/closing-folders/:closingFolderId`, sans ouvrir de workbench riche :

- enrichir uniquement la route existante `/closing-folders/:closingFolderId`
- reutiliser strictement le backend mapping manuel deja livre
- conserver `Dossier courant`, `Import balance` et `Controles`
- afficher la projection de mapping manuel courante
- permettre un mapping unitaire `accountCode -> targetCode`
- permettre la suppression unitaire d'un mapping existant

`017` ne reouvre ni le backend mapping manuel, ni `016`, ni les versions d'import, ni le diff previous, ni les financials, ni les workpapers, ni les documents, ni les exports, ni l'IA, ni GraphQL.

## Sources de verite

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/product/v1-plan.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ai-cadrage-v1.md`
- `specs/done/004-frontend-foundation-design-system.md`
- `specs/done/014-frontend-controls-readiness-cockpit-v1.md`
- `specs/done/015-frontend-closing-folders-entrypoint-v1.md`
- `specs/done/016-frontend-import-balance-v1.md`
- `contracts/openapi/manual-mapping-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/mapping/api/ManualMappingController.kt`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/mapping/application/ManualMappingService.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/ManualMappingApiTest.kt`
- `frontend/src/app/router.tsx`
- `frontend/src/lib/api/http.ts`
- `frontend/src/lib/api/me.ts`
- `frontend/src/lib/api/closing-folders.ts`
- `frontend/src/lib/api/controls.ts`
- `frontend/src/lib/api/import-balance.ts`
- `docs/ui/ui-foundations-v1.md`

## Decisions fermees

- `017` enrichit uniquement la route existante `/closing-folders/:closingFolderId`.
- `017` ne cree aucune nouvelle route produit.
- `017` ne cree aucun onglet, aucun drawer metier et aucune sous-navigation produit.
- `017` conserve les chargements initiaux deja livres sur la route detail :
  - `GET /api/me`
  - `GET /api/closing-folders/{id}`
  - `GET /api/closing-folders/{closingFolderId}/controls`
- `017` ajoute uniquement :
  - `GET /api/closing-folders/{closingFolderId}/mappings/manual`
  - `PUT /api/closing-folders/{closingFolderId}/mappings/manual`
  - `DELETE /api/closing-folders/{closingFolderId}/mappings/manual`
- `017` ne consomme aucun autre endpoint.
- `017` ne consomme jamais :
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous`
  - tout endpoint financials
  - tout endpoint workpapers
  - tout endpoint documents
  - tout endpoint exports
  - tout endpoint IA
- `017` n'introduit aucun nouveau backend si les endpoints existants suffisent.
- `017` garde `Import balance` borne a la spec `016` et `Controles` borne a la spec `014`.
- `017` charge `GET /api/closing-folders/{closingFolderId}/mappings/manual` et `GET /api/closing-folders/{closingFolderId}/controls` en parallele seulement apres succes exploitable de `GET /api/me` puis `GET /api/closing-folders/{id}`.
- Le bloc `Mapping manuel` est visible des que le dossier est dans l'etat nominal de `004`; il ne depend ni d'un succes nominal du slot `Controles`, ni d'un succes nominal du bloc `Import balance`.
- `017` reste strictement unitaire :
  - aucune mutation groupee
  - aucun bulk edit
  - aucun autosave
  - aucun retry automatique
- Changer la cible d'une ligne ne declenche aucun appel reseau.
- Une seule mutation `PUT` ou `DELETE` peut etre en vol a la fois dans le bloc `Mapping manuel`.
- `GET /api/me` reste la seule source frontend autorisee pour borner les affordances d'ecriture.
- `REVIEWER` est lecture seule si `effectiveRoles` le prouve.
- `ACCOUNTANT`, `MANAGER` et `ADMIN` peuvent ecrire si `effectiveRoles` le prouve.
- Si le frontend ne peut pas lire un role exploitable, il tombe en lecture seule pour le bloc `Mapping manuel`.
- `GET /api/closing-folders/{closingFolderId}/mappings/manual` reste autorise sur dossier `ARCHIVED` et sans import ; `PUT` et `DELETE` restent bloques par le backend en `409` dans ces cas.

## In scope exact

- ajout d'un bloc `Mapping manuel` sur `/closing-folders/:closingFolderId`
- lecture optionnelle de `effectiveRoles` depuis `GET /api/me` pour activer ou non les affordances d'ecriture
- chargement de la projection de mapping manuel courante
- affichage du summary minimal :
  - `version d import`
  - `comptes total`
  - `comptes mappes`
  - `comptes non mappes`
- affichage des lignes du dernier import courant
- affichage des targets selectionnables seulement
- selection locale d'une cible par ligne sans appel reseau
- emission d'un seul `PUT` unitaire pour une ligne
- emission d'un seul `DELETE` unitaire pour une ligne
- rafraichissement du bloc `Mapping manuel` et du bloc `Controles` apres mutation reussie
- rendu visible et distinct des etats :
  - chargement mapping
  - mapping pret
  - projection vide sans import
  - auth requise
  - acces mapping refuse
  - dossier archive
  - import requis
  - target invalide
  - account absent
  - `400`
  - `401`
  - `403`
  - `404`
  - `409`
  - `5xx`
  - erreur reseau
  - timeout
  - payload invalide
- tests frontend couvrant la sequence reseau, les etats visibles exacts, le `PUT`, le `DELETE`, le read-only `REVIEWER` et l'absence de derive d'endpoint

## Out of scope exact

- toute nouvelle route produit
- toute nouvelle tabulation, drawer metier ou stepper metier
- toute mutation groupee
- tout bulk edit
- tout autosave
- toute recherche avancee
- tout filtre avance
- tout taxonomy explorer riche
- toute lecture des versions d'import
- tout diff previous
- tout import balance hors bloc deja borne par `016`
- toute creation, edition ou archive de dossier
- tout financial summary
- tout financial statements structured
- tout workpaper
- tout document
- tout export
- toute IA active
- GraphQL
- tout nouveau backend

## Surface exacte de 017

### `/closing-folders/:closingFolderId`

- statut : unique route produit enrichie par `017`
- la route conserve le shell, le breadcrumb, la sidebar, le contexte tenant et le bloc `Dossier courant` deja livres
- la route reste une page simple en flux vertical unique
- aucun onglet, aucune sous-navigation et aucune navigation additionnelle ne sont autorises

### Ordre visible exact une fois le dossier nominal

1. bloc `Dossier courant`
   - inchange par rapport a `004`
2. bloc `Import balance`
   - inchange par rapport a `016`
3. bloc `Mapping manuel`
   - nouveau dans `017`
4. bloc `Controles`
   - conserve le cockpit `014`

### Regle de stabilite si le mapping est en erreur

- le bloc `Dossier courant` reste visible
- le bloc `Import balance` reste visible
- le bloc `Mapping manuel` reste visible avec un seul panneau d'etat explicite
- le bloc `Controles` reste visible et conserve son propre etat
- aucun rendu partiel du bloc `Mapping manuel` n'est autorise en cas d'erreur de lecture

### Bloc `Mapping manuel`

- titre visible exact : `Mapping manuel`
- sous-titre visible exact : `Projection du dernier import`
- sous-blocs autorises :
  - `Resume mapping`
  - `Lignes a mapper`
  - un slot d'etat mutation unique
- composants autorises :
  - un resume minimal
  - une liste de lignes en ordre backend
  - par ligne :
    - `Compte`
    - `Libelle`
    - `Debit`
    - `Credit`
    - `Mapping courant`
    - un select `Cible`
    - un bouton explicite `Enregistrer le mapping`
    - un bouton explicite `Supprimer le mapping`
- contraintes exactes :
  - aucun tri client n'est autorise
  - aucun filtre client n'est autorise
  - aucune recherche client n'est autorisee
  - aucun autosave n'est autorise
  - le select n'expose que les targets avec `selectable = true`
  - l'ordre des targets visibles suit exactement l'ordre backend recu
  - l'ordre des lignes visibles suit exactement l'ordre backend recu
  - changer le select localement n'emmet aucun appel reseau
  - le `PUT` est emis seulement sur clic explicite `Enregistrer le mapping`
  - le `DELETE` est emis seulement sur clic explicite `Supprimer le mapping`
  - si une ligne n'a pas de mapping courant, `Mapping courant` affiche exactement `aucun`
  - si une ligne a un mapping courant, `Mapping courant` affiche exactement `<label> (<targetCode>)`
  - chaque option de cible affiche exactement `<label> (<code>)`
  - si aucune ligne courante n'est disponible, le sous-bloc `Lignes a mapper` affiche exactement `aucune ligne a mapper`

## Sequence de chargement exacte

### Sequence initiale

1. appeler `GET /api/me` sans `X-Tenant-Id`
2. si `GET /api/me` retourne un contexte exploitable avec `activeTenant != null`, appeler `GET /api/closing-folders/{id}` avec `X-Tenant-Id = activeTenant.tenantId`
3. si le dossier est dans l'etat nominal de `004`, initialiser les slots `Mapping manuel` et `Controles` en chargement
4. emettre en parallele :
   - `GET /api/closing-folders/{closingFolderId}/mappings/manual`
   - `GET /api/closing-folders/{closingFolderId}/controls`
5. si `GET /api/me` ou `GET /api/closing-folders/{id}` n'est pas dans l'etat nominal de `004`, aucun appel `/mappings/manual` ni `/controls` n'est autorise
6. aucun autre appel n'est autorise pendant le chargement initial

### Sequence exacte pendant un `PUT`

1. l'utilisateur change localement la cible d'une seule ligne
2. aucun appel reseau n'est emis tant qu'aucun clic explicite `Enregistrer le mapping` n'a lieu
3. sur clic `Enregistrer le mapping`, si l'etat local est writable et coherent, le frontend emet exactement un `PUT /api/closing-folders/{closingFolderId}/mappings/manual`
4. la requete `PUT` porte exactement :
   - `Accept: application/json`
   - `Content-Type: application/json`
   - `X-Tenant-Id = activeTenant.tenantId`
   - un body JSON exact `{ "accountCode": "<accountCode>", "targetCode": "<targetCode>" }`
5. pendant le `PUT`, aucun second `PUT` ni `DELETE` n'est autorise
6. pendant le `PUT`, aucun endpoint hors scope n'est autorise

### Sequence exacte pendant un `DELETE`

1. l'utilisateur clique `Supprimer le mapping` sur une seule ligne ayant un mapping courant
2. le frontend emet exactement un `DELETE /api/closing-folders/{closingFolderId}/mappings/manual?accountCode=<accountCode>`
3. la requete `DELETE` porte exactement :
   - `Accept: application/json`
   - `X-Tenant-Id = activeTenant.tenantId`
4. aucun body n'est envoye sur le `DELETE`
5. pendant le `DELETE`, aucun second `PUT` ni `DELETE` n'est autorise
6. pendant le `DELETE`, aucun endpoint hors scope n'est autorise

### Sequence exacte apres mutation reussie

1. afficher immediatement le succes mutation exact
2. lancer en parallele :
   - `GET /api/closing-folders/{closingFolderId}/mappings/manual`
   - `GET /api/closing-folders/{closingFolderId}/controls`
3. si le refresh mapping retourne un etat nominal de lecture, remplacer le bloc `Mapping manuel`
4. si le refresh controls retourne un etat `ready`, remplacer le bloc `Controles`
5. si le refresh mapping echoue, conserver le dernier bloc `Mapping manuel` valide deja affiche et ajouter exactement `rafraichissement mapping impossible`
6. si le refresh controls echoue, conserver le dernier bloc `Controles` valide deja affiche et ajouter exactement `rafraichissement controls impossible`
7. si les deux refreshs echouent, conserver les deux blocs deja affiches et afficher les deux lignes exactes de warning
8. aucun redirect et aucune nouvelle navigation ne sont autorises apres mutation reussie

## Contrat API reel consomme par 017

### Verite unique retenue

`017` consomme uniquement :

- `GET /api/me`
- `GET /api/closing-folders/{id}`
- `GET /api/closing-folders/{closingFolderId}/controls`
- `GET /api/closing-folders/{closingFolderId}/mappings/manual`
- `PUT /api/closing-folders/{closingFolderId}/mappings/manual`
- `DELETE /api/closing-folders/{closingFolderId}/mappings/manual`

### `GET /api/me`

Preuve repo :

- `backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/MeController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/BackendApplicationSmokeTest.kt`
- `frontend/src/lib/api/me.ts`

Sous-ensemble exact consomme par `017` :

- `activeTenant.tenantId`
- `activeTenant.tenantSlug`
- `activeTenant.tenantName`
- `effectiveRoles[]` comme hint d'affordance seulement

Regle exacte :

- `017` conserve tous les etats shell deja figes par `016` pour `activeTenant`
- si `effectiveRoles[]` est lisible et contient au moins un de `ACCOUNTANT`, `MANAGER`, `ADMIN`, le bloc `Mapping manuel` peut devenir writable
- si `effectiveRoles[]` est lisible et contient seulement `REVIEWER` parmi les roles prouvants, le bloc `Mapping manuel` est lecture seule
- si `effectiveRoles[]` est absent, invalide ou inexploitable, le shell reste chargeable mais le bloc `Mapping manuel` tombe en lecture seule
- le frontend n'invente jamais un RBAC client plus fin que cette regle minimale

### `GET /api/closing-folders/{closingFolderId}/mappings/manual`

Preuve repo :

- `contracts/openapi/manual-mapping-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/mapping/api/ManualMappingController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/ManualMappingApiTest.kt`

Constats observes :

- l'endpoint reel est `GET /api/closing-folders/{closingFolderId}/mappings/manual`
- l'endpoint exige `X-Tenant-Id`
- `200` est retourne meme sans import courant
- `200` est retourne sur dossier `ARCHIVED`
- `404` couvre dossier absent ou hors tenant
- `targets[]`, `lines[]` et `mappings[]` sont ordonnes de facon deterministe par le backend
- `lines[].debit` et `lines[].credit` sont exposes en chaines decimales

#### Sous-ensemble exact du payload `200` consomme cote frontend

- `closingFolderId`
  - requis : oui
  - rendu UI : non rendu en clair ; utilise seulement pour verifier la coherence avec le param route et `closingFolder.id`
  - fallback si absent, invalide ou incoherent : `payload mapping invalide`
- `latestImportVersion`
  - requis : oui, nullable
  - rendu UI : ligne `version d import`
  - mapping visible exact :
    - entier -> sa valeur
    - `null -> aucune`
  - fallback si propriete absente ou type invalide : `payload mapping invalide`
- `summary.total`
  - requis : oui
  - rendu UI : ligne `comptes total`
  - fallback si absent ou invalide : `payload mapping invalide`
- `summary.mapped`
  - requis : oui
  - rendu UI : ligne `comptes mappes`
  - fallback si absent ou invalide : `payload mapping invalide`
- `summary.unmapped`
  - requis : oui
  - rendu UI : ligne `comptes non mappes`
  - fallback si absent ou invalide : `payload mapping invalide`
- `lines[]`
  - requis : oui
  - rendu UI : sous-bloc `Lignes a mapper`
  - ordre exact : ordre backend preserve, sans tri local
  - champs consommes par ligne :
    - `accountCode`
      - requis : oui
      - rendu UI : colonne `Compte`
      - fallback si absent : `payload mapping invalide`
    - `accountLabel`
      - requis : oui
      - rendu UI : colonne `Libelle`
      - fallback si absent : `payload mapping invalide`
    - `debit`
      - requis : oui
      - rendu UI : colonne `Debit`
      - fallback si absent : `payload mapping invalide`
    - `credit`
      - requis : oui
      - rendu UI : colonne `Credit`
      - fallback si absent : `payload mapping invalide`
- `mappings[]`
  - requis : oui
  - rendu UI : `Mapping courant` par jointure exacte sur `accountCode`
  - ordre exact : ordre backend preserve, sans tri local
  - champs consommes :
    - `accountCode`
      - requis : oui
      - fallback si absent : `payload mapping invalide`
    - `targetCode`
      - requis : oui
      - fallback si absent : `payload mapping invalide`
- `targets[]`
  - requis : oui
  - rendu UI : select `Cible`
  - ordre exact : ordre backend preserve, sans tri local
  - champs consommes :
    - `code`
      - requis : oui
      - rendu UI : identifiant de la cible et suffixe visible de l'option
      - fallback si absent : `payload mapping invalide`
    - `label`
      - requis : oui
      - rendu UI : libelle visible de l'option
      - fallback si absent : `payload mapping invalide`
    - `selectable`
      - requis : oui
      - rendu UI : filtre exact des options visibles
      - regle :
        - `true` -> option visible et selectionnable
        - `false` -> jamais exposee dans le select
      - fallback si absent ou invalide : `payload mapping invalide`

#### Regles de coherence exactes du payload `200`

- `closingFolderId == closingFolder.id == closingFolderId`
- `summary.total == lines.length`
- `summary.mapped == mappings.length`
- `summary.unmapped == summary.total - summary.mapped`
- chaque `mappings[].accountCode` doit correspondre a un `lines[].accountCode`
- chaque `mappings[].targetCode` doit correspondre a un `targets[].code` du meme payload
- si `latestImportVersion == null`, alors :
  - `lines.length == 0`
  - `mappings.length == 0`
  - `summary.total == 0`
  - `summary.mapped == 0`
  - `summary.unmapped == 0`
- si `summary.total > 0`, au moins une target `selectable = true` doit exister
- toute violation de coherence rend exactement `payload mapping invalide`

#### Champs explicitement non consommes par `017` sur `/mappings/manual`

- `taxonomyVersion`
- `targets[].statement`
- `targets[].summaryBucketCode`
- `targets[].sectionCode`
- `targets[].normalSide`
- `targets[].granularity`
- `targets[].deprecated`
- `targets[].displayOrder`

### `PUT /api/closing-folders/{closingFolderId}/mappings/manual`

Preuve repo :

- `contracts/openapi/manual-mapping-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/mapping/api/ManualMappingController.kt`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/mapping/application/ManualMappingService.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/ManualMappingApiTest.kt`

#### Body exact consomme et emis cote frontend

- body JSON exact :
  - `accountCode`
  - `targetCode`
- contraintes exactes avant emission :
  - la ligne doit exister dans `lines[]`
  - la cible choisie doit exister dans les `targets[]` exposes avec `selectable = true`
  - le dossier ne doit pas etre `ARCHIVED`
  - `latestImportVersion` ne doit pas etre `null`
  - le frontend doit etre dans un etat writable
  - la cible choisie doit etre differente du mapping courant de la ligne
- aucun autre champ JSON n'est emis
- aucun `PUT` n'est emis sur simple changement du select

#### Sous-ensemble exact du payload succes `200|201` consomme cote frontend

- `accountCode`
  - requis : oui
  - utilise seulement pour verifier la coherence avec la ligne mutatee
  - fallback si absent, invalide ou different de la requete : `payload mapping invalide`
- `targetCode`
  - requis : oui
  - utilise seulement pour verifier la coherence avec la cible mutatee
  - fallback si absent, invalide ou different de la requete : `payload mapping invalide`

#### Semantique frontend exacte du succes `PUT`

- un succes `PUT` est acquis exactement si :
  - le statut HTTP est `200` ou `201`
  - `accountCode` est present et coherent avec la ligne mutatee
  - `targetCode` est present et coherent avec la cible mutatee
- si ce sous-ensemble est valide :
  - le texte exact visible est `mapping enregistre avec succes`
  - les refreshs mapping + controls sont lances
- si ce sous-ensemble est invalide, incomplet ou incoherent :
  - aucun succes mutation n'est acquis
  - aucun refresh mapping + controls n'est lance
  - le texte exact visible est `payload mapping invalide`

### `DELETE /api/closing-folders/{closingFolderId}/mappings/manual`

Preuve repo :

- `contracts/openapi/manual-mapping-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/mapping/api/ManualMappingController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/ManualMappingApiTest.kt`

#### Parametre exact consomme et emis cote frontend

- query param exact : `accountCode`
- valeur exacte : `accountCode` de la ligne courante
- aucun body n'est emis
- le frontend n'emet jamais de `DELETE` sur une ligne sans mapping courant

#### Sous-ensemble exact du succes `DELETE` consomme cote frontend

- `204 No Content`
  - body : non consomme
  - regle : toute reponse `204`, y compris delete idempotent deja absent, est un succes frontend

#### Semantique frontend exacte du succes `DELETE`

- un succes `DELETE` est acquis exactement sur `204`
- si le `204` est acquis :
  - le texte exact visible est `mapping supprime avec succes`
  - les refreshs mapping + controls sont lances

### Lecture exacte des erreurs mutation

Le contrat OpenAPI ne publie aucun schema d'erreur structure obligatoire pour le mapping manuel. `017` ne depend donc jamais d'un payload d'erreur structure pour fonctionner.

Si un body JSON expose un top-level string `message`, `017` peut l'exploiter seulement pour raffiner ces cas exacts :

- `accountCode is not present in the latest import.` -> `compte absent du dernier import`
- `targetCode is unknown.` -> `target invalide`
- `targetCode is not selectable.` -> `target invalide`
- `No balance import is available for manual mapping.` -> `import requis`
- `Closing folder is archived and manual mappings cannot be modified.` -> `dossier archive, mapping impossible`

Si ce `message` est absent, invalide ou different, `017` retombe strictement sur l'etat borne par le seul statut HTTP.

## Droits et roles exacts

### Preuve backend retenue

- `ManualMappingService` autorise la lecture pour `ACCOUNTANT`, `REVIEWER`, `MANAGER`, `ADMIN`
- `ManualMappingService` autorise l'ecriture pour `ACCOUNTANT`, `MANAGER`, `ADMIN`
- `ManualMappingApiTest` prouve explicitement que `REVIEWER` peut lire mais ne peut ni `PUT` ni `DELETE`
- `GET /api/me` expose `effectiveRoles[]`

### Regle frontend exacte

- si `effectiveRoles[]` contient `ACCOUNTANT`, `MANAGER` ou `ADMIN`, l'ecriture peut etre activee cote UI sous reserve des autres preconditions metier
- si `effectiveRoles[]` contient `REVIEWER` et aucun role ecrivant prouve, le bloc est lecture seule
- si `effectiveRoles[]` contient a la fois `REVIEWER` et un role ecrivant prouve, l'ecriture reste autorisee
- si `effectiveRoles[]` est absent, invalide ou inexploitable, le bloc est lecture seule
- le frontend ne devine jamais un droit d'ecriture a partir d'un autre signal que `effectiveRoles[]`

## Matrice d'etats exacte du bloc `Mapping manuel`

### Regle generale

- cette matrice s'applique seulement quand la route detail est dans l'etat nominal de `004`
- les blocs `Dossier courant`, `Import balance` et `Controles` restent visibles selon leurs propres specs
- tout resultat non nominal non explicitement borne ci-dessous rend un texte exact stable ; aucun fallback implicite n'est autorise

### Etats de lecture

#### `MAPPING_LOADING`

Condition :

- `GET /api/closing-folders/{closingFolderId}/mappings/manual` est en cours

Rendu exact :

- panneau d'etat unique dans le bloc `Mapping manuel`
- texte exact visible : `chargement mapping manuel`

#### `MAPPING_AUTH_REQUIRED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/mappings/manual` retourne `401`

Rendu exact :

- panneau d'etat unique dans le bloc `Mapping manuel`
- texte exact visible : `authentification requise`

#### `MAPPING_FORBIDDEN`

Condition :

- `GET /api/closing-folders/{closingFolderId}/mappings/manual` retourne `403`

Rendu exact :

- panneau d'etat unique dans le bloc `Mapping manuel`
- texte exact visible : `acces mapping refuse`

#### `MAPPING_NOT_FOUND`

Condition :

- `GET /api/closing-folders/{closingFolderId}/mappings/manual` retourne `404`

Rendu exact :

- panneau d'etat unique dans le bloc `Mapping manuel`
- texte exact visible : `mapping introuvable`

#### `MAPPING_SERVER_ERROR`

Condition :

- `GET /api/closing-folders/{closingFolderId}/mappings/manual` retourne `5xx`

Rendu exact :

- panneau d'etat unique dans le bloc `Mapping manuel`
- texte exact visible : `erreur serveur mapping`

#### `MAPPING_NETWORK_ERROR`

Condition :

- `GET /api/closing-folders/{closingFolderId}/mappings/manual` echoue pour erreur reseau

Rendu exact :

- panneau d'etat unique dans le bloc `Mapping manuel`
- texte exact visible : `erreur reseau mapping`

#### `MAPPING_TIMEOUT`

Condition :

- `GET /api/closing-folders/{closingFolderId}/mappings/manual` echoue par timeout selon la convention de `frontend/src/lib/api/http.ts`

Rendu exact :

- panneau d'etat unique dans le bloc `Mapping manuel`
- texte exact visible : `timeout mapping`

#### `MAPPING_INVALID_PAYLOAD`

Condition :

- `GET /api/closing-folders/{closingFolderId}/mappings/manual` retourne `200`
- le payload est invalide, incomplet ou incoherent pour le sous-ensemble exact consomme

Rendu exact :

- panneau d'etat unique dans le bloc `Mapping manuel`
- texte exact visible : `payload mapping invalide`

#### `MAPPING_UNEXPECTED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/mappings/manual` retourne un statut non nominal non explicitement borne, y compris `400`

Rendu exact :

- panneau d'etat unique dans le bloc `Mapping manuel`
- texte exact visible : `mapping indisponible`

#### `MAPPING_IMPORT_REQUIRED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/mappings/manual` retourne `200`
- le payload est valide
- `latestImportVersion == null`

Rendu exact :

- sous-bloc `Resume mapping`
  - `version d import : aucune`
  - `comptes total : 0`
  - `comptes mappes : 0`
  - `comptes non mappes : 0`
- ligne visible exacte : `import requis`
- sous-bloc `Lignes a mapper`
  - texte exact visible : `aucune ligne a mapper`
- aucun select writable
- aucun `PUT`
- aucun `DELETE`

#### `MAPPING_ARCHIVED_READ_ONLY`

Condition :

- `GET /api/closing-folders/{closingFolderId}/mappings/manual` retourne `200`
- le payload est valide
- `closingFolder.status == ARCHIVED`

Rendu exact :

- sous-bloc `Resume mapping` visible
- sous-bloc `Lignes a mapper` visible
- ligne visible exacte : `dossier archive, mapping en lecture seule`
- tous les selects et boutons d'action sont desactives
- aucun `PUT`
- aucun `DELETE`

#### `MAPPING_READY_READ_ONLY`

Condition :

- `GET /api/closing-folders/{closingFolderId}/mappings/manual` retourne `200`
- le payload est valide
- `latestImportVersion != null`
- `closingFolder.status != ARCHIVED`
- aucun role ecrivant prouve n'est lisible cote frontend

Rendu exact :

- sous-bloc `Resume mapping` visible
- sous-bloc `Lignes a mapper` visible
- ligne visible exacte : `lecture seule`
- tous les selects et boutons d'action sont desactives
- aucun `PUT`
- aucun `DELETE`

#### `MAPPING_READY_WRITABLE`

Condition :

- `GET /api/closing-folders/{closingFolderId}/mappings/manual` retourne `200`
- le payload est valide
- `latestImportVersion != null`
- `closingFolder.status != ARCHIVED`
- au moins un role ecrivant prouve est lisible cote frontend

Rendu exact :

- sous-bloc `Resume mapping` visible
- sous-bloc `Lignes a mapper` visible
- les lignes montrent le mapping courant, le select `Cible` et les boutons d'action unitaires
- `Enregistrer le mapping` est activable seulement si une cible selectionnee differente du mapping courant est presente
- `Supprimer le mapping` est activable seulement si la ligne porte un mapping courant

### Etats de mutation

#### `MAPPING_PUT_SUBMITTING`

Condition :

- un `PUT /api/closing-folders/{closingFolderId}/mappings/manual` est en cours

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `enregistrement mapping en cours`
- tous les selects et boutons d'action du bloc `Mapping manuel` sont desactives

#### `MAPPING_DELETE_SUBMITTING`

Condition :

- un `DELETE /api/closing-folders/{closingFolderId}/mappings/manual` est en cours

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `suppression mapping en cours`
- tous les selects et boutons d'action du bloc `Mapping manuel` sont desactives

#### `MAPPING_PUT_SUCCESS`

Condition :

- le `PUT` retourne `200` ou `201`
- le payload succes est valide pour `accountCode` et `targetCode`

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `mapping enregistre avec succes`

#### `MAPPING_DELETE_SUCCESS`

Condition :

- le `DELETE` retourne `204`

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `mapping supprime avec succes`

#### `MAPPING_BAD_REQUEST_ACCOUNT_ABSENT`

Condition :

- le `PUT` retourne `400`
- un body JSON exploitable expose exactement `message = "accountCode is not present in the latest import."`

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `compte absent du dernier import`
- la selection locale de la ligne est conservee

#### `MAPPING_BAD_REQUEST_TARGET_INVALID`

Condition :

- le `PUT` retourne `400`
- un body JSON exploitable expose exactement :
  - `message = "targetCode is unknown."`
  - ou `message = "targetCode is not selectable."`

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `target invalide`
- la selection locale de la ligne est conservee

#### `MAPPING_BAD_REQUEST`

Condition :

- le `PUT` ou le `DELETE` retourne `400`
- aucun raffinement exact `account absent` ou `target invalide` n'est applicable

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `mapping invalide`
- la selection locale de la ligne est conservee

#### `MAPPING_MUTATION_AUTH_REQUIRED`

Condition :

- le `PUT` ou le `DELETE` retourne `401`

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `authentification requise`
- la selection locale de la ligne est conservee

#### `MAPPING_MUTATION_FORBIDDEN`

Condition :

- le `PUT` ou le `DELETE` retourne `403`

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `acces mapping refuse`
- la selection locale de la ligne est conservee

#### `MAPPING_MUTATION_NOT_FOUND`

Condition :

- le `PUT` ou le `DELETE` retourne `404`

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `dossier introuvable`
- la selection locale de la ligne est conservee

#### `MAPPING_MUTATION_CONFLICT_ARCHIVED`

Condition :

- l'etat local est deja `ARCHIVED`
- ou le `PUT` ou le `DELETE` retourne `409` et un raffinement exact `archive` est applicable

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `dossier archive, mapping impossible`
- la selection locale de la ligne est conservee

#### `MAPPING_MUTATION_CONFLICT_IMPORT_REQUIRED`

Condition :

- `latestImportVersion == null`
- ou le `PUT` ou le `DELETE` retourne `409` et un raffinement exact `No balance import is available for manual mapping.` est applicable

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `import requis`
- la selection locale de la ligne est conservee

#### `MAPPING_MUTATION_CONFLICT_OTHER`

Condition :

- le `PUT` ou le `DELETE` retourne `409`
- aucun raffinement exact `archive` ou `import requis` n'est applicable

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `mapping impossible`
- la selection locale de la ligne est conservee

#### `MAPPING_MUTATION_SERVER_ERROR`

Condition :

- le `PUT` ou le `DELETE` retourne `5xx`

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `erreur serveur mapping`
- la selection locale de la ligne est conservee

#### `MAPPING_MUTATION_NETWORK_ERROR`

Condition :

- le `PUT` ou le `DELETE` echoue pour erreur reseau

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `erreur reseau mapping`
- la selection locale de la ligne est conservee

#### `MAPPING_MUTATION_TIMEOUT`

Condition :

- le `PUT` ou le `DELETE` echoue par timeout

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `timeout mapping`
- la selection locale de la ligne est conservee

#### `MAPPING_MUTATION_INVALID_SUCCESS_PAYLOAD`

Condition :

- le `PUT` retourne `200` ou `201`
- le payload succes est invalide, incomplet ou incoherent pour `accountCode` et `targetCode`

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `payload mapping invalide`
- aucun refresh mapping + controls n'est emis
- la selection locale de la ligne est conservee

#### `MAPPING_MUTATION_UNEXPECTED`

Condition :

- le `PUT` ou le `DELETE` retourne un statut non borne explicitement par cette spec

Rendu exact :

- slot d'etat mutation unique
- texte exact visible : `mapping indisponible`
- la selection locale de la ligne est conservee

## Comportement exact apres mutation

- le succes mutation devient visible avant tout refresh
- le refresh mapping et le refresh controls sont emis apres succes mutation, jamais avant
- le refresh mapping et le refresh controls utilisent toujours le meme `X-Tenant-Id = activeTenant.tenantId`
- si le refresh mapping reussit, le bloc `Mapping manuel` remplace exactement :
  - le summary
  - la liste des lignes
  - le mapping courant
  - l'etat local du select par ligne
- si le refresh controls reussit, le bloc `Controles` remplace exactement son dernier rendu par le rendu rafraichi
- si le refresh mapping echoue, le dernier bloc `Mapping manuel` valide deja affiche reste visible et le slot succes ajoute exactement `rafraichissement mapping impossible`
- si le refresh controls echoue, le dernier bloc `Controles` valide deja affiche reste visible et le slot succes ajoute exactement `rafraichissement controls impossible`
- si les deux refreshs echouent, les deux blocs valides deja affiches restent visibles et le slot succes ajoute exactement :
  - `rafraichissement mapping impossible`
  - `rafraichissement controls impossible`
- aucun refresh mapping ou controls en echec ne retrograde un succes mutation deja acquis en erreur mutation

## Regles de non-derive

- `017` n'ouvre aucune nouvelle route produit
- `017` n'ajoute aucune tabulation produit
- `017` n'appelle jamais `versions` ni `diff-previous`
- `017` n'ajoute aucun endpoint hors de la liste fermee des endpoints autorises
- `017` n'introduit aucune mutation groupee
- `017` n'introduit aucun autosave
- `017` n'introduit aucune recherche avancee
- `017` n'introduit aucun taxonomy explorer riche
- `017` n'introduit aucun tenant switch
- `017` n'introduit aucune navigation automatique apres mutation
- `017` n'introduit aucun nouveau backend
- tout statut ou payload non borne explicitement doit tomber sur un texte stable et testable ; aucun fallback implicite n'est autorise

## Criteres d'acceptation frontend

- `specs/active/017-frontend-manual-mapping-v1.md` existe
- `/closing-folders/:closingFolderId` reste l'unique route produit enrichie par `017`
- aucune nouvelle route produit n'est introduite
- aucun nouveau backend n'est introduit
- le bloc `Mapping manuel` est place entre `Import balance` et `Controles`
- en cas d'erreur mapping, `Dossier courant`, `Import balance` et `Controles` restent visibles
- seuls les endpoints autorises sont consommes :
  - `GET /api/me`
  - `GET /api/closing-folders/{id}`
  - `GET /api/closing-folders/{closingFolderId}/controls`
  - `GET /api/closing-folders/{closingFolderId}/mappings/manual`
  - `PUT /api/closing-folders/{closingFolderId}/mappings/manual`
  - `DELETE /api/closing-folders/{closingFolderId}/mappings/manual`
- aucun endpoint `versions`, `diff-previous`, financials, workpapers, documents, exports, IA ou nouveau backend n'est appele
- `GET /api/closing-folders/{closingFolderId}/mappings/manual` et `GET /api/closing-folders/{closingFolderId}/controls` sont emis seulement apres succes exploitable de `GET /api/me` puis `GET /api/closing-folders/{id}`
- le frontend ne consomme du payload `GET /mappings/manual` que le sous-ensemble exact fige dans cette spec
- toute propriete requise absente, invalide ou incoherente du sous-ensemble consomme rend exactement `payload mapping invalide`
- le frontend preserve l'ordre backend des `targets[]`, `lines[]` et `mappings[]`
- les targets visibles sont bornees a `selectable = true`
- aucun appel reseau n'est emis sur simple changement du select
- le `PUT` envoie exactement `accountCode` et `targetCode`
- le `DELETE` envoie exactement le query param `accountCode`
- il n'existe aucun bulk edit ni autosave
- `REVIEWER` est lecture seule si `effectiveRoles[]` le prouve
- `ACCOUNTANT`, `MANAGER` et `ADMIN` peuvent ecrire si `effectiveRoles[]` le prouve
- si `effectiveRoles[]` est absent ou invalide, le bloc `Mapping manuel` est lecture seule
- les etats visibles exacts sont testables pour :
  - chargement mapping
  - mapping pret writable
  - mapping pret read-only
  - projection vide sans import
  - auth requise
  - acces mapping refuse
  - dossier archive
  - import requis
  - target invalide
  - account absent
  - `400`
  - `401`
  - `403`
  - `404`
  - `409`
  - `5xx`
  - erreur reseau
  - timeout
  - payload invalide
- un succes `PUT` ou `DELETE` valide devient visible avant les refreshs mapping + controls
- apres succes valide, le frontend rafraichit toujours mapping + controls
- si le refresh mapping echoue, le dernier bloc mapping valide reste visible
- si le refresh controls echoue, le dernier bloc controls valide reste visible

## Tests frontend requis

- `pnpm test:ci`
- `pnpm lint`
- `pnpm build`
- tests prouvant que les seuls endpoints consommes sont les endpoints autorises de cette spec
- tests prouvant que `GET /api/closing-folders/{closingFolderId}/mappings/manual` et `GET /api/closing-folders/{closingFolderId}/controls` ne sont emis qu'apres succes exploitable de `GET /api/me` puis `GET /api/closing-folders/{id}`
- tests prouvant que le bloc `Mapping manuel` est place entre `Import balance` et `Controles`
- tests prouvant qu'aucun appel reseau n'est emis sur simple changement du select
- tests prouvant que le `PUT` envoie exactement `accountCode` et `targetCode`
- tests prouvant que le `DELETE` envoie exactement le query param `accountCode`
- tests prouvant que les etats visibles exacts sont rendus pour tous les cas listes dans les criteres d'acceptation
- tests prouvant que `REVIEWER` est lecture seule si `effectiveRoles[]` le prouve
- tests prouvant que le fallback lecture seule s'applique si `effectiveRoles[]` est absent ou invalide
- tests prouvant l'absence de bulk edit
- tests prouvant l'absence d'autosave
- tests prouvant qu'aucun endpoint hors scope n'est appele
