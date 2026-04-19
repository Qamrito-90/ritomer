# 016 - Frontend import balance v1

## Status
Done

## Role de cette spec

Cette spec devient la verite normative de `016`.

Elle borne le plus petit enrichissement frontend metier legitime apres `015` pour rendre le flux `dossier -> import -> mapping -> controls` operable sans ouvrir de nouveau scope produit :

- enrichir uniquement la route existante `/closing-folders/:closingFolderId`
- reutiliser strictement le backend import balance deja livre
- conserver le cockpit controls/readiness deja livre
- rester read-only partout sauf sur l'action unique d'upload import

`016` ne reouvre ni le backend imports, ni `015`, ni le mapping manuel, ni les versions d'import, ni le diff N / N-1, ni les financials, ni les workpapers, ni les documents, ni les exports, ni l'IA.

## Sources de verite

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/product/v1-plan.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ai-cadrage-v1.md`
- `docs/adr/0001-monolithe-modulaire.md`
- `docs/adr/0002-rest-first-graphql-later.md`
- `docs/adr/0003-ai-gateway-evidence-first.md`
- `docs/adr/0004-multi-tenancy-audit-rls-progressive.md`
- `docs/adr/0005-front-ui-stack-and-design-system.md`
- `docs/adr/0006-postgresql-cloud-sql-no-docker-v1.md`
- `specs/done/003-import-balance-v1.md`
- `specs/done/004-frontend-foundation-design-system.md`
- `specs/done/006-controls-v1.md`
- `specs/done/014-frontend-controls-readiness-cockpit-v1.md`
- `specs/done/015-frontend-closing-folders-entrypoint-v1.md`
- `contracts/openapi/import-balance-api.yaml`
- `contracts/openapi/closing-folders-api.yaml`
- `contracts/openapi/controls-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/imports/api/BalanceImportController.kt`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/controls/api/ControlsController.kt`
- `frontend/src/app/router.tsx`
- `frontend/src/lib/api/http.ts`
- `frontend/src/lib/api/me.ts`
- `frontend/src/lib/api/closing-folders.ts`
- `frontend/src/lib/api/controls.ts`
- `docs/ui/ui-foundations-v1.md`

## Decisions fermees

- `016` enrichit uniquement la route existante `/closing-folders/:closingFolderId`.
- `016` ne cree aucune nouvelle route produit.
- `016` ne cree aucun onglet, aucun drawer metier et aucune sous-navigation produit.
- `016` conserve les chargements initiaux deja livres sur la route detail :
  - `GET /api/me`
  - `GET /api/closing-folders/{id}`
  - `GET /api/closing-folders/{closingFolderId}/controls`
- `016` ajoute une seule mutation frontend autorisee :
  - `POST /api/closing-folders/{closingFolderId}/imports/balance`
- `016` ne consomme aucun autre endpoint.
- `016` ne consomme jamais :
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous`
  - `GET /api/closing-folders/{closingFolderId}/mappings/manual`
  - tout endpoint financials
  - tout endpoint workpapers
  - tout endpoint documents
  - tout endpoint exports
  - tout endpoint IA
- L'upload se fait uniquement via `FormData` en `multipart/form-data` avec une seule part nommee `file`.
- Les seuls headers applicatifs ajoutes par le frontend sur l'upload sont :
  - `Accept: application/json`
  - `X-Tenant-Id = activeTenant.tenantId`
- Le frontend ne fixe jamais manuellement le header `Content-Type`; le navigateur genere le `multipart/form-data` effectif avec son `boundary`.
- Aucun autre champ multipart n'est envoye.
- Un seul fichier est autorise ; aucun `multiple` n'est permis.
- Le fichier cible cote frontend est borne a `CSV` uniquement car le backend importe une balance canonique `CSV`.
- La validation locale minimale avant `POST` est strictement bornee a :
  - presence d'un seul fichier selectionne
  - nom de fichier se terminant par `.csv`, comparaison insensible a la casse
- Le frontend ne valide pas localement :
  - le MIME navigateur du fichier
  - la taille du fichier
  - le contenu CSV
- Justification de non-derive : les tests backend prouvent qu'un import valide peut etre envoye avec une part `file` dont le MIME est `text/plain`; un blocage frontend sur le MIME serait incorrect.
- Un succes d'import est acquis exactement sur `201` avec payload valide, avant les refreshs dossier / controls.
- Un refresh post-succes echoue n'annule jamais le succes d'import deja acquis.
- Toute reponse non-success ou tout `201` invalide conserve le fichier selectionne.
- Seul un succes `201` valide purge le fichier selectionne.
- Le bloc `Controles` de `014` reste visible et gouverne toujours la lecture read-only du readiness cockpit.
- Le bloc `Import balance` devient visible des que le dossier est dans l'etat nominal de `004`; il ne depend pas d'un succes nominal du slot `Controles`.
- Hors action d'upload, `/closing-folders/:closingFolderId` reste strictement read-only.

## In scope exact

- ajout d'un bloc `Import balance` sur `/closing-folders/:closingFolderId`
- ajout d'un selecteur de fichier unique borne a `CSV`
- ajout d'une action explicite `Importer la balance`
- emission d'un seul `POST` d'upload vers le backend existant
- validation stricte d'un sous-ensemble minimal du payload `201`
- validation stricte du payload `400` pour rendre des erreurs lisibles
- rafraichissement du dossier puis du cockpit controls apres succes
- rendu visible et distinct des etats :
  - `aucun fichier selectionne`
  - `fichier selectionne`
  - `fichier non accepte`
  - `uploading`
  - `success complet`
  - `success + refresh dossier echoue`
  - `success + refresh controls echoue`
  - `400 avec erreurs lisibles`
  - `401`
  - `403`
  - `404`
  - `409 dossier archive`
  - `5xx`
  - `erreur reseau`
  - `timeout`
  - `payload succes invalide`
- tests frontend couvrant la sequence reseau, les etats visibles et l'absence de derive d'endpoint

## Out of scope exact

- toute nouvelle route produit
- toute mutation autre que `POST /api/closing-folders/{closingFolderId}/imports/balance`
- toute creation, edition ou archive de dossier
- toute lecture des versions d'import
- tout diff N / N-1
- tout mapping manuel
- tout financial summary
- tout financial statements structured
- tout workpaper
- tout document
- tout export
- toute IA active
- GraphQL
- tout upload hors `CSV`
- tout parsing CSV cote frontend
- tout retry automatique cote frontend

## Surface exacte de 016

### `/closing-folders/:closingFolderId`

- statut : unique route produit enrichie par `016`
- la route conserve le shell, le breadcrumb, la sidebar, le contexte tenant et le bloc `Dossier courant` deja livres
- la route reste une page simple en flux vertical unique
- aucun onglet, aucune sous-navigation et aucune navigation additionnelle ne sont autorises

### Ordre visible exact une fois le dossier nominal

1. bloc `Dossier courant`
   - inchange par rapport a `004`
2. bloc `Import balance`
   - nouveau dans `016`
   - toujours visible des que le dossier est nominal
3. bloc `Controles`
   - conserve le cockpit `014`

### Bloc `Import balance`

- titre visible exact : `Import balance`
- sous-titre visible exact : `Upload CSV`
- aide visible exacte : `CSV uniquement`
- composants autorises :
  - un champ de fichier unique
  - un bouton primaire `Importer la balance`
  - un slot d'etat unique
- contraintes exactes :
  - le champ de fichier accepte uniquement `.csv,text/csv`
  - un seul fichier peut etre selectionne
  - le slot d'etat rend toujours un seul texte exact stable a la fois
  - aucune previsualisation de contenu, aucun parsing local, aucun diff local, aucun mapping local
  - si `closingFolder.status = ARCHIVED`, le champ et le bouton sont desactives et le slot d'etat affiche exactement `dossier archive, import impossible`

## Contrat exact de la requete upload

### Requete exacte

- endpoint exact : `POST /api/closing-folders/{closingFolderId}/imports/balance`
- methode exacte : `POST`
- body exact : `FormData`
- `Content-Type` effectif exact : `multipart/form-data`
- le frontend ne renseigne jamais manuellement le header `Content-Type`
- champ multipart exact : `file`
- nombre de parts fichier exact : `1`
- headers exacts ajoutes par le frontend :
  - `Accept: application/json`
  - `X-Tenant-Id: <activeTenant.tenantId>`
- aucun autre header applicatif custom n'est ajoute par `016`
- aucun autre champ multipart n'est envoye
- le frontend ne renomme pas le fichier et ne transforme pas son contenu avant `POST`

### Validation locale minimale avant `POST`

- le frontend autorise le `POST` seulement si :
  - un fichier unique est selectionne
  - `closingFolder.status != ARCHIVED`
  - le nom du fichier se termine par `.csv`, comparaison insensible a la casse
- le frontend ne bloque jamais un fichier `*.csv` sur la base de son MIME navigateur
- le frontend ne valide jamais localement la taille du fichier
- le frontend ne parse jamais localement le contenu CSV

## Etats fichier frontend exacts

### Regle de priorite du slot d'etat

- l'aide `CSV uniquement` reste toujours visible dans le bloc `Import balance`
- le slot d'etat unique rend exactement un etat a la fois
- tout changement de fichier efface le dernier resultat d'upload affiche et re-evalue immediatement l'etat fichier
- `IMPORT_CONFLICT_ARCHIVED` prime toujours sur les etats fichier tant que le dossier est `ARCHIVED`

### `IMPORT_NO_FILE_SELECTED`

Condition :

- aucun fichier n'est selectionne
- aucun upload n'est en cours
- aucun resultat d'upload actif n'est affiche

Rendu exact :

- slot d'etat unique
- texte exact visible : `aucun fichier selectionne`
- bouton `Importer la balance` desactive : oui

### `IMPORT_FILE_SELECTED`

Condition :

- un seul fichier est selectionne
- `file.name` se termine par `.csv`, comparaison insensible a la casse
- aucun upload n'est en cours
- aucun resultat d'upload actif n'est affiche
- `closingFolder.status != ARCHIVED`

Rendu exact :

- slot d'etat unique
- texte exact visible : `fichier pret : <file.name>`
- bouton `Importer la balance` activable : oui

### `IMPORT_FILE_REJECTED`

Condition :

- un seul fichier est selectionne
- `file.name` ne se termine pas par `.csv`, comparaison insensible a la casse
- aucun upload n'est en cours
- aucun resultat d'upload actif n'est affiche

Rendu exact :

- slot d'etat unique
- texte exact visible : `fichier CSV requis`
- bouton `Importer la balance` desactive : oui
- aucun `POST` n'est emis

## Sequence reseau exacte avant upload

1. appeler `GET /api/me` sans `X-Tenant-Id`
2. si `GET /api/me` retourne un contexte exploitable avec `activeTenant != null`, appeler `GET /api/closing-folders/{id}` avec `X-Tenant-Id = activeTenant.tenantId`
3. si le dossier est dans l'etat nominal de `004`, appeler `GET /api/closing-folders/{closingFolderId}/controls` avec le meme `X-Tenant-Id`
4. si `GET /api/me` ou `GET /api/closing-folders/{id}` n'est pas dans l'etat nominal de `004`, aucun `POST /imports/balance` n'est autorise
5. la selection ou le remplacement du fichier n'emettent aucun appel reseau
6. aucun appel additionnel n'est autorise avant le clic utilisateur explicite sur `Importer la balance`

## Sequence reseau exacte pendant upload

1. l'utilisateur clique `Importer la balance` depuis `/closing-folders/:closingFolderId`
2. si aucun fichier n'est selectionne, si le fichier est dans l'etat `IMPORT_FILE_REJECTED`, ou si `closingFolder.status = ARCHIVED`, aucun `POST` n'est emis
3. sinon, le frontend emet exactement un `POST /api/closing-folders/{closingFolderId}/imports/balance`
4. la requete d'upload porte exactement :
   - `Accept: application/json`
   - `X-Tenant-Id = activeTenant.tenantId`
   - un body `FormData`
   - une part unique `file`
5. la requete d'upload n'envoie jamais :
   - de header `Content-Type` fixe manuellement par le frontend
   - de champ multipart additionnel
   - de body JSON
6. pendant le `POST`, aucun appel a :
   - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`
   - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous`
   - `GET /api/closing-folders/{closingFolderId}/mappings/manual`
   - tout autre endpoint non autorise
7. pendant le `POST`, le champ fichier et le bouton sont desactives
8. pendant le `POST`, le bloc `Dossier courant` reste visible
9. pendant le `POST`, le bloc `Controles` conserve son dernier rendu connu ; il n'est ni efface ni remplace par un spinner global

## Comportement exact apres succes

### Acquisition du succes d'import

- le succes d'import est acquis exactement quand le `POST` retourne `201` et que le payload est valide pour le sous-ensemble exact consomme
- ce succes affiche exactement :
  - `balance importee avec succes`
  - `version import : <version>`
  - `lignes importees : <rowCount>`
- un `201` invalide ou incomplet n'acquiert jamais le succes d'import
- le succes d'import n'est jamais conditionne aux refreshs dossier / controls

### Sequence de refresh post-succes

1. valider le payload `201`
2. afficher immediatement le succes d'import exact
3. purger le fichier selectionne
4. emettre `GET /api/closing-folders/{id}` avec le meme `X-Tenant-Id`
5. si et seulement si le refresh dossier retourne un etat nominal `ready`, emettre `GET /api/closing-folders/{closingFolderId}/controls`
6. si le refresh dossier n'est pas nominal, aucun refresh controls n'est emis
7. aucun redirect et aucune nouvelle navigation ne sont autorises apres succes
8. aucun autre effet metier n'est introduit cote frontend

## Contrat API reel consomme par 016

### Verite unique retenue

`016` consomme uniquement :

- `GET /api/me`
- `GET /api/closing-folders/{id}`
- `GET /api/closing-folders/{closingFolderId}/controls`
- `POST /api/closing-folders/{closingFolderId}/imports/balance`

### Sous-ensemble exact du payload `201` consomme cote frontend

- `closingFolderId`
  - requis : oui
  - rendu UI : non rendu en clair ; utilise seulement pour verifier la coherence avec le param route et le dossier charge
  - fallback si absent, invalide ou incoherent : `payload import invalide`
- `version`
  - requis : oui
  - rendu UI : ligne `version import : <valeur>`
  - fallback si absent ou invalide : `payload import invalide`
- `rowCount`
  - requis : oui
  - rendu UI : ligne `lignes importees : <valeur>`
  - fallback si absent ou invalide : `payload import invalide`

### Semantique frontend exacte du `201`

- un `201` n'est considere comme succes d'import que si :
  - `closingFolderId` est present et coherent avec `closingFolder.id` et `closingFolderId`
  - `version` est present et valide
  - `rowCount` est present et valide
- si ce sous-ensemble est valide, le texte visible exact de succes est :
  - `balance importee avec succes`
  - `version import : <version>`
  - `lignes importees : <rowCount>`
- si ce sous-ensemble est invalide, incomplet ou incoherent :
  - aucun succes d'import n'est acquis
  - aucun refresh dossier / controls n'est emis
  - le texte exact visible est `payload import invalide`
  - le fichier selectionne reste en place

### Champs explicitement non consommes sur le payload `201`

- `importId`
- `importedAt`
- `importedByUserId`
- `totalDebit`
- `totalCredit`
- `diffSummary`

### Sous-ensemble exact du payload `400` consomme cote frontend

- `message`
  - requis : oui
  - rendu UI : ligne d'introduction du bloc erreur
  - fallback si absent ou invalide : `import indisponible`
- `errors`
  - requis : oui
  - rendu UI : liste d'erreurs preservee dans l'ordre backend
  - fallback si absent, non tableau ou invalide : `import indisponible`
- `errors[].message`
  - requis : oui
  - rendu UI : message principal de la ligne
  - fallback si absent : `import indisponible`
- `errors[].line`
  - requis : non ; nullable
  - rendu UI : prefixe `ligne <n>` seulement si present
- `errors[].field`
  - requis : non ; nullable
  - rendu UI : prefixe `<field>` seulement si present

### Affichage exact d'un `400` structure valide

- le bloc affiche exactement dans cet ordre :
  - titre d'etat : `import invalide`
  - ligne `message`
  - puis `errors[]` rendu dans l'ordre backend, sans tri ni regroupement
- si `errors[]` est un tableau vide mais valide :
  - le bloc affiche `import invalide`
  - le bloc affiche `message`
  - aucune ligne d'erreur supplementaire n'est rendue
- si le payload `400` est invalide ou inexploitable pour ce sous-ensemble :
  - aucune erreur structuree n'est rendue
  - le fallback exact visible est `import indisponible`
  - le fichier selectionne reste en place

### Format visible exact d'une erreur `400`

- si `line != null` et `field != null` :
  - `ligne <line> - <field> : <message>`
- si `line != null` et `field == null` :
  - `ligne <line> : <message>`
- si `line == null` et `field != null` :
  - `<field> : <message>`
- si `line == null` et `field == null` :
  - `<message>`

## Matrice d'etats exacte du bloc `Import balance`

### Regle generale

- cette matrice s'applique seulement quand la route detail est dans l'etat nominal de `004`
- le bloc `Dossier courant` reste visible dans tous les etats du bloc `Import balance`
- le bloc `Controles` reste visible et continue a suivre sa propre spec `014`
- l'aide visible exacte `CSV uniquement` reste toujours visible
- tout changement de fichier efface le dernier resultat d'upload affiche
- toute reponse non-success conserve le fichier selectionne
- tout resultat non nominal non explicitement borne ci-dessous rend `import indisponible`

### `IMPORT_NO_FILE_SELECTED`

Condition :

- aucun fichier n'est selectionne
- aucun `POST` en cours
- aucun succes ou echec d'upload actif n'est affiche

Rendu exact :

- slot d'etat unique
- texte exact visible : `aucun fichier selectionne`
- bouton `Importer la balance` desactive

### `IMPORT_FILE_SELECTED`

Condition :

- un fichier unique est selectionne
- le nom de fichier se termine par `.csv`, comparaison insensible a la casse
- aucun `POST` en cours
- aucun succes ou echec d'upload actif n'est affiche
- `closingFolder.status != ARCHIVED`

Rendu exact :

- slot d'etat unique
- texte exact visible : `fichier pret : <file.name>`
- bouton `Importer la balance` activable

### `IMPORT_FILE_REJECTED`

Condition :

- un fichier unique est selectionne
- le nom de fichier ne se termine pas par `.csv`, comparaison insensible a la casse
- aucun `POST` en cours
- aucun succes ou echec d'upload actif n'est affiche

Rendu exact :

- slot d'etat unique
- texte exact visible : `fichier CSV requis`
- bouton `Importer la balance` desactive
- aucun `POST` n'est emis

### `IMPORT_UPLOADING`

Condition :

- le `POST /api/closing-folders/{closingFolderId}/imports/balance` est en cours

Rendu exact :

- slot d'etat unique
- texte exact visible : `import balance en cours`
- champ fichier desactive : oui
- bouton desactive : oui

### `IMPORT_SUCCESS_REFRESHED`

Condition :

- le `POST` retourne `201`
- le payload est valide pour le sous-ensemble exact consomme
- `payload.closingFolderId == closingFolder.id == closingFolderId`
- le refresh dossier retourne un etat nominal `ready`
- le refresh controls retourne un etat `ready`

Rendu exact :

- slot d'etat unique
- texte exact visible : `balance importee avec succes`
- ligne visible exacte : `version import : <version>`
- ligne visible exacte : `lignes importees : <rowCount>`
- message de succes conserve : oui
- bloc `Dossier courant` : remplace par le dossier rafraichi
- bloc `Controles` : remplace par le rendu rafraichi

### `IMPORT_SUCCESS_DOSSIER_REFRESH_FAILED`

Condition :

- le `POST` retourne `201`
- le payload est valide pour le sous-ensemble exact consomme
- `payload.closingFolderId == closingFolder.id == closingFolderId`
- le refresh dossier ne retourne pas un etat nominal `ready`

Rendu exact :

- slot d'etat unique
- texte exact visible : `balance importee avec succes`
- ligne visible exacte : `version import : <version>`
- ligne visible exacte : `lignes importees : <rowCount>`
- ligne visible exacte : `rafraichissement dossier impossible`
- message de succes conserve : oui
- bloc `Dossier courant` : conserve exactement le dernier rendu affiche avant le refresh
- bloc `Controles` : conserve exactement le dernier rendu affiche avant le refresh
- refresh controls emis : non

### `IMPORT_SUCCESS_CONTROLS_REFRESH_FAILED`

Condition :

- le `POST` retourne `201`
- le payload est valide pour le sous-ensemble exact consomme
- `payload.closingFolderId == closingFolder.id == closingFolderId`
- le refresh dossier retourne un etat nominal `ready`
- le refresh controls ne retourne pas un nouvel etat affiche

Rendu exact :

- slot d'etat unique
- texte exact visible : `balance importee avec succes`
- ligne visible exacte : `version import : <version>`
- ligne visible exacte : `lignes importees : <rowCount>`
- ligne visible exacte : `rafraichissement controls impossible`
- message de succes conserve : oui
- bloc `Dossier courant` : remplace par le dossier rafraichi
- bloc `Controles` : conserve exactement le dernier rendu affiche avant le refresh

### `IMPORT_BAD_REQUEST`

Condition :

- le `POST` retourne `400`
- le payload erreur est valide pour le sous-ensemble exact consomme

Rendu exact :

- slot d'etat unique
- texte exact visible : `import invalide`
- ligne visible issue de `message`
- liste d'erreurs visible, preservee dans l'ordre backend, avec le format exact defini ci-dessus
- fichier selectionne conserve : oui

### `IMPORT_AUTH_REQUIRED`

Condition :

- le `POST` retourne `401`

Rendu exact :

- slot d'etat unique
- texte exact visible : `authentification requise`
- fichier selectionne conserve : oui

### `IMPORT_FORBIDDEN`

Condition :

- le `POST` retourne `403`

Rendu exact :

- slot d'etat unique
- texte exact visible : `acces import refuse`
- fichier selectionne conserve : oui

### `IMPORT_NOT_FOUND`

Condition :

- le `POST` retourne `404`

Rendu exact :

- slot d'etat unique
- texte exact visible : `dossier introuvable`
- fichier selectionne conserve : oui

### `IMPORT_CONFLICT_ARCHIVED`

Condition :

- `closingFolder.status = ARCHIVED`
- ou le `POST` retourne `409`

Rendu exact :

- slot d'etat unique
- texte exact visible : `dossier archive, import impossible`
- aucun refresh post-succes n'est emis
- fichier selectionne conserve : oui

### `IMPORT_SERVER_ERROR`

Condition :

- le `POST` retourne `5xx`

Rendu exact :

- slot d'etat unique
- texte exact visible : `erreur serveur import`
- fichier selectionne conserve : oui

### `IMPORT_NETWORK_ERROR`

Condition :

- le `POST` echoue pour erreur reseau

Rendu exact :

- slot d'etat unique
- texte exact visible : `erreur reseau import`
- fichier selectionne conserve : oui

### `IMPORT_TIMEOUT`

Condition :

- le `POST` echoue par timeout selon la convention de `frontend/src/lib/api/http.ts`

Rendu exact :

- slot d'etat unique
- texte exact visible : `timeout import`
- fichier selectionne conserve : oui

### `IMPORT_INVALID_SUCCESS_PAYLOAD`

Condition :

- le `POST` retourne `201`
- le payload est invalide, incomplet ou incoherent pour le sous-ensemble exact consomme

Rendu exact :

- slot d'etat unique
- texte exact visible : `payload import invalide`
- aucun refresh post-succes n'est emis
- fichier selectionne conserve : oui

### `IMPORT_UNEXPECTED`

Condition :

- le `POST` retourne un statut non nominal non explicitement borne ci-dessus
- ou le `POST` retourne `400` avec un payload erreur invalide pour le sous-ensemble exact consomme

Rendu exact :

- slot d'etat unique
- texte exact visible : `import indisponible`
- fichier selectionne conserve : oui

## Regles de non-derive

- `016` n'ouvre aucune nouvelle route produit.
- `016` n'ajoute aucune tabulation produit.
- `016` n'appelle jamais `versions`, `diff-previous` ou `mappings/manual`.
- `016` n'introduit aucun parsing CSV cote frontend.
- `016` n'introduit aucun controle local de MIME, de taille ou de contenu du fichier.
- `016` n'introduit aucune mutation autre que `POST /imports/balance`.
- `016` n'introduit aucun tenant switch.
- `016` n'introduit aucune navigation automatique vers une autre surface apres succes.
- le refresh post-succes est borne a :
  - `GET /api/closing-folders/{id}`
  - `GET /api/closing-folders/{closingFolderId}/controls`
- un refresh post-succes echoue ne transforme jamais un succes d'import acquis en erreur d'import
- le bloc `Controles` reste gouverne par `014`; `016` n'en change ni les textes exacts ni les etats visibles
- tout statut ou payload non borne explicitement par cette spec doit tomber sur un texte stable et testable ; aucun fallback implicite n'est autorise

## Criteres d'acceptation frontend

- `specs/done/016-frontend-import-balance-v1.md` existe
- `/closing-folders/:closingFolderId` reste l'unique route produit enrichie par `016`
- aucun autre endpoint que les quatre endpoints autorises n'est consomme
- le bloc `Import balance` est visible sur `/closing-folders/:closingFolderId` seulement quand le dossier est dans l'etat nominal de `004`
- le bloc `Import balance` est place entre `Dossier courant` et `Controles`
- le champ fichier est borne a `CSV` uniquement
- le frontend n'ajoute sur l'upload que `Accept: application/json` et `X-Tenant-Id = activeTenant.tenantId`
- le frontend n'ajoute jamais manuellement de header `Content-Type` sur l'upload
- le clic `Importer la balance` emet uniquement `POST /api/closing-folders/{closingFolderId}/imports/balance`
- le `POST` envoie `X-Tenant-Id = activeTenant.tenantId`
- le `POST` envoie `Accept: application/json`
- le `POST` envoie un body `FormData`
- le `POST` envoie une part `file` unique
- le `POST` n'envoie aucun autre champ multipart
- le frontend n'effectue avant `POST` qu'une validation locale minimale :
  - fichier present
  - suffixe `.csv` insensible a la casse
- le frontend ne bloque jamais localement un fichier `*.csv` sur la base de son MIME navigateur
- pendant l'upload, aucun appel `versions`, `diff-previous` ou `mappings/manual` n'est emis
- l'aide visible exacte `CSV uniquement` est toujours presente
- sans fichier selectionne, le slot d'etat affiche exactement `aucun fichier selectionne`
- avec un fichier `*.csv` selectionne, le slot d'etat affiche exactement `fichier pret : <file.name>`
- avec un fichier non `*.csv` selectionne, le slot d'etat affiche exactement `fichier CSV requis`
- `uploading` affiche exactement `import balance en cours`
- le succes d'import est acquis uniquement sur `201` avec payload valide pour `closingFolderId`, `version` et `rowCount`
- `success complet` affiche exactement `balance importee avec succes`
- `success + refresh dossier echoue` conserve exactement `balance importee avec succes` et ajoute `rafraichissement dossier impossible`
- `success + refresh controls echoue` conserve exactement `balance importee avec succes` et ajoute `rafraichissement controls impossible`
- `400` valide affiche exactement `import invalide` et une liste lisible d'erreurs preservee dans l'ordre backend
- `400` invalide ou inexploitable affiche exactement `import indisponible`
- `401` affiche exactement `authentification requise`
- `403` affiche exactement `acces import refuse`
- `404` affiche exactement `dossier introuvable`
- `409` ou dossier deja archive affiche exactement `dossier archive, import impossible`
- `5xx` affiche exactement `erreur serveur import`
- erreur reseau affiche exactement `erreur reseau import`
- timeout affiche exactement `timeout import`
- `201` avec payload invalide ou incoherent affiche exactement `payload import invalide`
- tout resultat non borne affiche exactement `import indisponible`
- un succes valide declenche un refresh dossier puis eventuellement un refresh controls
- si le refresh dossier echoue, le detail dossier et le bloc controls deja affiches restent visibles en l'etat
- si le refresh controls echoue, le detail dossier est remplace par le dossier rafraichi et le bloc controls deja affiche reste visible en l'etat
- le refresh controls apres succes ne passe jamais par `versions`, `diff-previous` ou `mappings/manual`
- hors action upload import, la route detail reste strictement read-only
- aucun scope versions, diff, mapping manuel, financials, workpapers, documents, exports, IA ou nouvelle route n'est ouvert

## Tests frontend requis

- `pnpm test:ci`
- `pnpm lint`
- `pnpm build`
- tests prouvant que l'upload appelle uniquement `POST /api/closing-folders/{closingFolderId}/imports/balance`
- tests prouvant que le bon `X-Tenant-Id` est envoye sur le `POST`
- tests prouvant que `Accept: application/json` est envoye sur le `POST`
- tests prouvant qu'aucun header `Content-Type` manuel n'est fixe par le frontend sur le `POST`
- tests prouvant que le body du `POST` envoie exactement une part `file` et aucun autre champ multipart
- tests prouvant que `GET /api/me`, `GET /api/closing-folders/{id}` et `GET /api/closing-folders/{closingFolderId}/controls` restent les seuls autres appels autorises
- tests prouvant que la validation locale minimale est strictement bornee a presence fichier + suffixe `.csv`
- tests prouvant qu'aucun blocage local n'est fait sur le MIME navigateur d'un fichier `*.csv`
- tests prouvant que les etats visibles exacts sont rendus pour :
  - `aucun fichier selectionne`
  - `fichier selectionne`
  - `fichier non accepte`
  - `uploading`
  - `success complet`
  - `success + refresh dossier echoue`
  - `success + refresh controls echoue`
  - `400 avec erreurs lisibles`
  - `401`
  - `403`
  - `404`
  - `409 dossier archive`
  - `5xx`
  - `erreur reseau`
  - `timeout`
  - `payload succes invalide`
- tests prouvant que le succes valide est acquis avant les refreshs post-succes
- tests prouvant que le succes complet remplace dossier et controls par les donnees rafraichies
- tests prouvant que si le refresh dossier echoue, le message de succes reste visible et les blocs dossier / controls deja affiches restent visibles
- tests prouvant que si le refresh controls echoue, le message de succes reste visible, le dossier est rafraichi et le bloc controls deja affiche reste visible
- tests prouvant qu'aucun endpoint `versions`, `diff-previous` ou `mapping` n'est appele
- tests prouvant qu'aucun nouveau scope produit n'est ouvert
