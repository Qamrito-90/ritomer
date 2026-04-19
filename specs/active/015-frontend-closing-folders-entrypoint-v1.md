# 015 - Frontend closing folders entrypoint v1

## Status
Active

## Role de cette spec

Cette spec devient la verite normative de `015`.

Elle borne le plus petit enrichissement frontend metier legitime apres `014` pour rendre l'entree produit reelle utilisable sans connaitre manuellement un `closingFolderId` :

- remplacer le role actuel de `/` comme surface de demonstration interne
- faire de `/` l'entree produit V1 des dossiers de closing
- reutiliser strictement le backend closing folders deja livre
- reutiliser strictement la route existante `/closing-folders/:closingFolderId`

`015` ne reouvre ni le backend closing folders, ni `014`, ni aucun scope imports, mapping, controls nouveau, financials, workpapers, documents, exports ou IA.

## Sources de verite

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/product/v1-plan.md`
- `specs/done/004-frontend-foundation-design-system.md`
- `specs/done/014-frontend-controls-readiness-cockpit-v1.md`
- `contracts/openapi/closing-folders-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/closing/api/ClosingFolderController.kt`
- `frontend/src/app/router.tsx`
- `frontend/src/lib/api/me.ts`
- `frontend/src/lib/api/closing-folders.ts`
- `docs/ui/ui-foundations-v1.md`

## Decisions fermees

- `/` devient l'entree produit V1 des dossiers de closing.
- La demonstration interne de `004` ne reste pas une route produit dans `015`.
- `015` modifie uniquement le role et le contenu de `/`.
- `015` ne cree aucune nouvelle route metier en plus de `/`.
- `015` reutilise `/closing-folders/:closingFolderId` tel qu'il existe deja apres `014`.
- `015` n'enrichit pas `/closing-folders/:closingFolderId` au-dela de ce qui existe deja apres `014`.
- `015` reste strictement read-only.
- `/` appelle d'abord `GET /api/me` sans `X-Tenant-Id`.
- `/` appelle `GET /api/closing-folders` seulement si `GET /api/me` retourne un contexte exploitable avec `activeTenant != null`.
- `GET /api/closing-folders` est appele avec `X-Tenant-Id = activeTenant.tenantId`.
- `015` consomme sur `/` uniquement :
  - `GET /api/me`
  - `GET /api/closing-folders`
- `015` ne consomme jamais sur `/` :
  - `GET /api/closing-folders/{closingFolderId}/controls`
  - tout endpoint imports
  - tout endpoint mapping
  - tout endpoint financials
  - tout endpoint workpapers
  - tout endpoint documents
  - tout endpoint exports
  - tout endpoint IA
- La liste reste dans l'ordre backend recu ; aucun tri client custom n'est autorise.
- Tout dossier dont `tenantId != activeTenant.tenantId` est ignore cote rendu.
- Chaque dossier visible expose une action d'ouverture explicite vers `/closing-folders/:closingFolderId`.
- `015` ne cree, ne modifie et n'archive aucun dossier.
- `015` ne reintroduit aucun formulaire manuel d'UUID comme mecanisme principal d'entree produit.
- `015` n'introduit aucun tenant switch.

## In scope exact

- remplacement de la surface de demonstration de `/` par une entree produit read-only
- reutilisation du shell, du breadcrumb, de la sidebar et de la zone d'action read-only deja poses par `004`
- chargement `GET /api/me` puis `GET /api/closing-folders`
- validation stricte du sous-ensemble JSON dossier consomme par le frontend sur la liste
- rendu visible et distinct des etats `loading initial`, `401`, absence de tenant actif, profil indisponible, acces dossiers refuse, dossiers indisponibles, liste vide et liste nominale
- rendu read-only d'une liste de dossiers ouvrables
- tests frontend couvrant la sequence de chargement, les branches visibles exactes, l'absence de derive d'endpoint, l'absence de tri client et le filtrage de non-affichage des dossiers hors tenant

## Out of scope exact

- toute nouvelle route metier en dehors du remplacement de role de `/`
- toute mutation backend
- toute creation UI de dossier
- toute edition UI de dossier
- tout archive UI de dossier
- tout enrichissement de `/closing-folders/:closingFolderId`
- toute consommation de `/api/closing-folders/{closingFolderId}/controls` depuis `/`
- tout ecran imports, mapping, controls nouveau, financials, workpapers, documents, exports ou IA
- tout tenant switch
- toute preservation de la table de demonstration, du toast de demonstration ou du formulaire manuel d'UUID comme contenu principal de `/`

## Surface exacte de 015

### `/`

- statut : entree produit V1 des dossiers de closing
- la route conserve le shell frontend de `004`
- la route reste une page simple en flux vertical unique
- aucun onglet, aucune sous-navigation et aucun nouveau point d'entree produit secondaire ne sont autorises
- aucun formulaire manuel d'UUID, aucune table de demonstration interne et aucun contenu local-only `004` ne restent le mecanisme principal de la page

### `/closing-folders/:closingFolderId`

- statut : route detail existante, deja livree avant `015`
- la route est uniquement une cible de navigation depuis la liste
- la route conserve le shell et le cockpit controls deja livres
- `015` n'y ajoute rien

## Sequence de chargement exacte sur `/`

1. appeler `GET /api/me` sans `X-Tenant-Id`
2. si `GET /api/me` retourne `401`, afficher `authentification requise` et ne jamais appeler `GET /api/closing-folders`
3. si `GET /api/me` retourne `200` avec `activeTenant = null`, afficher `contexte tenant requis` et ne jamais appeler `GET /api/closing-folders`
4. si `GET /api/me` retourne `403`, `5xx`, echoue par reseau, echoue par timeout, ou retourne `200` avec un payload inexploitable pour `activeTenant`, afficher `profil indisponible` et ne jamais appeler `GET /api/closing-folders`
5. si `GET /api/me` retourne un contexte exploitable avec `activeTenant != null`, appeler `GET /api/closing-folders` avec `X-Tenant-Id = activeTenant.tenantId`
6. si `GET /api/closing-folders` retourne `401`, afficher `authentification requise`
7. si `GET /api/closing-folders` retourne `403`, afficher `acces dossiers refuse`
8. si `GET /api/closing-folders` retourne `200` avec un payload valide, filtrer les dossiers dont `tenantId != activeTenant.tenantId` sans reordonner le reste
9. si la liste filtree est vide, afficher `aucun dossier de closing`
10. si la liste filtree contient au moins un dossier valide, afficher la liste nominale
11. si `GET /api/closing-folders` retourne `400`, `5xx`, un statut inattendu, echoue par reseau, echoue par timeout, ou retourne `200` avec un payload invalide ou incomplet pour le sous-ensemble exact consomme, afficher `dossiers indisponibles`

## Structure visible exacte sur `/`

### Regle generale

- tant que `GET /api/me` n'a pas abouti, la page montre un etat de chargement initial unique
- tant que le tenant actif n'est pas exploitable, aucun contenu liste n'est rendu
- des que le tenant actif est exploitable, le contexte tenant reste visible sur tous les etats de liste
- en cas d'erreur liste, aucun rendu partiel de lignes dossier n'est autorise

### Ordre visible exact une fois le tenant actif exploitable

1. bloc `Dossiers de closing`
   - toujours visible quand `activeTenant != null`
   - contient le slot de liste
2. slot `Liste dossiers`
   - rend soit un etat unique, soit la liste nominale

### Contenu exact d'une ligne nominale

Chaque ligne visible rend, dans l'ordre backend preserve :

- `name` comme libelle principal
- `status` en lecture seule
- la periode issue de `periodStartOn` et `periodEndOn`
- `externalRef` en lecture seule
- une meta archive derivee de `archivedAt` seulement si `archivedAt != null`
- une action explicite `Ouvrir`

### Regle de navigation

- l'action `Ouvrir` navigue vers `/closing-folders/:closingFolderId`
- `:closingFolderId` vaut exactement le `id` du dossier visible
- aucun autre comportement de navigation n'est autorise depuis `/`

## Contrat API reel consomme par 015

### Verite unique retenue

`015` consomme sur `/` uniquement :

- `GET /api/me`
- `GET /api/closing-folders`

`015` ne consomme jamais sur `/` :

- `GET /api/closing-folders/{id}`
- `GET /api/closing-folders/{closingFolderId}/controls`
- `GET /api/closings/{closingId}`
- tout autre endpoint

### `GET /api/me`

Preuve repo :

- `frontend/src/lib/api/me.ts`
- `frontend/src/app/router.tsx`

Constats retenus pour `015` :

- `GET /api/me` reste appele sans `X-Tenant-Id`
- seul `activeTenant` est requis pour determiner l'entree produit
- `015` conserve strictement les etats deja figes par `004` pour `GET /api/me`

Sous-ensemble exact consomme sur `/` :

- `activeTenant.tenantId`
- `activeTenant.tenantSlug`
- `activeTenant.tenantName`

### `GET /api/closing-folders`

Preuve repo :

- `contracts/openapi/closing-folders-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/closing/api/ClosingFolderController.kt`

Constats observes :

- l'endpoint reel est `GET /api/closing-folders`
- l'endpoint exige `X-Tenant-Id`
- le backend retourne une liste de `ClosingFolderResponse`
- `015` n'introduit aucun tri, filtre, regroupement ou pagination cote client

### Sous-ensemble exact de champs JSON consommes sur la liste

- `id`
  - requis : oui
  - rendu UI : cible de navigation exacte vers `/closing-folders/:closingFolderId`
  - fallback si absent ou invalide : `dossiers indisponibles`
- `tenantId`
  - requis : oui
  - rendu UI : non rendu en clair ; utilise seulement pour verifier la coherence avec `activeTenant.tenantId`
  - regle exacte :
    - si `tenantId == activeTenant.tenantId`, la ligne reste eligible au rendu
    - si `tenantId != activeTenant.tenantId`, la ligne est ignoree cote rendu
  - fallback si absent ou invalide : `dossiers indisponibles`
- `name`
  - requis : oui
  - rendu UI : libelle principal de la ligne
  - fallback si absent ou invalide : `dossiers indisponibles`
- `periodStartOn`
  - requis : oui
  - rendu UI : debut de periode en lecture seule
  - fallback si absent ou invalide : `dossiers indisponibles`
- `periodEndOn`
  - requis : oui
  - rendu UI : fin de periode en lecture seule
  - fallback si absent ou invalide : `dossiers indisponibles`
- `externalRef`
  - requis : non ; nullable ou omissible
  - rendu UI : reference externe en lecture seule
  - mapping visible exact :
    - string non vide -> sa valeur
    - `null` ou propriete absente -> `aucune`
  - fallback si type invalide : `dossiers indisponibles`
- `status`
  - requis : oui
  - rendu UI : statut en lecture seule
  - fallback si absent ou invalide : `dossiers indisponibles`
- `archivedAt`
  - requis : non ; nullable ou omissible
  - rendu UI :
    - string ISO date-time -> meta archive visible
    - `null` ou propriete absente -> aucune meta archive visible
  - fallback si type invalide : `dossiers indisponibles`

### Champs explicitement non consommes par 015 sur la liste

- `archivedByUserId`
  - non consomme
- `createdAt`
  - non consomme
- `updatedAt`
  - non consomme

## Matrice d'etats exacte pour `/`

### Regle generale

- cette matrice s'applique uniquement a `/`
- tout resultat non nominal non explicitement borne ci-dessous doit etre rattache a un etat visible exact
- aucun fallback implicite n'est autorise

### `ENTRY_LOADING`

Condition :

- `GET /api/me` est en cours

Rendu exact :

- panneau d'etat unique
- texte exact visible : `chargement dossiers`

### `AUTH_REQUIRED`

Condition :

- `GET /api/me` retourne `401`
- ou `GET /api/closing-folders` retourne `401`

Rendu exact :

- panneau d'etat unique
- texte exact visible : `authentification requise`
- aucun rendu de ligne dossier

### `TENANT_CONTEXT_REQUIRED`

Condition :

- `GET /api/me` retourne `200`
- `activeTenant = null`

Rendu exact :

- panneau d'etat unique
- texte exact visible : `contexte tenant requis`
- aucun appel a `GET /api/closing-folders`
- aucun rendu de ligne dossier

### `PROFILE_UNAVAILABLE`

Condition :

- `GET /api/me` retourne `403`
- ou `GET /api/me` retourne `5xx`
- ou `GET /api/me` echoue pour erreur reseau
- ou `GET /api/me` echoue par timeout
- ou `GET /api/me` retourne `200` avec un payload invalide ou incomplet pour lire `activeTenant`

Rendu exact :

- panneau d'etat unique
- texte exact visible : `profil indisponible`
- aucun appel a `GET /api/closing-folders`
- aucun rendu de ligne dossier

### `LIST_FORBIDDEN`

Condition :

- `GET /api/closing-folders` retourne `403`

Rendu exact :

- panneau d'etat unique dans le bloc `Dossiers de closing`
- texte exact visible : `acces dossiers refuse`
- contexte tenant visible : oui
- aucun rendu de ligne dossier

### `LIST_UNAVAILABLE`

Condition :

- `GET /api/closing-folders` retourne `400`
- ou `GET /api/closing-folders` retourne `5xx`
- ou `GET /api/closing-folders` retourne un statut inattendu
- ou `GET /api/closing-folders` echoue pour erreur reseau
- ou `GET /api/closing-folders` echoue par timeout
- ou `GET /api/closing-folders` retourne `200` avec un payload invalide ou incomplet pour le sous-ensemble exact consomme

Rendu exact :

- panneau d'etat unique dans le bloc `Dossiers de closing`
- texte exact visible : `dossiers indisponibles`
- contexte tenant visible : oui
- aucun rendu de ligne dossier

### `LIST_EMPTY`

Condition :

- `GET /api/closing-folders` retourne `200`
- le payload est valide pour le sous-ensemble exact consomme
- apres filtrage des lignes hors tenant, aucune ligne eligible ne reste

Rendu exact :

- panneau d'etat unique dans le bloc `Dossiers de closing`
- texte exact visible : `aucun dossier de closing`
- contexte tenant visible : oui
- aucun rendu de ligne dossier

### `LIST_READY`

Condition :

- `GET /api/closing-folders` retourne `200`
- le payload est valide pour le sous-ensemble exact consomme
- apres filtrage des lignes hors tenant, au moins une ligne eligible reste

Rendu exact :

- bloc `Dossiers de closing` visible
- contexte tenant visible : oui
- chaque ligne rend le sous-ensemble exact fige dans cette spec
- l'ordre des lignes suit exactement l'ordre backend recu apres filtrage des lignes hors tenant
- chaque ligne expose une action explicite `Ouvrir`

## Regles de non-ambigute

- `/` ne charge jamais `/api/closing-folders/{closingFolderId}/controls`
- `/` ne charge jamais `GET /api/closing-folders/{id}`
- aucun tri client custom n'est autorise
- aucun regroupement client n'est autorise
- aucun filtrage fonctionnel client n'est autorise hors non-affichage des lignes hors tenant
- ignorer une ligne hors tenant ne doit pas reordonner les autres lignes
- `status = ARCHIVED` ou `archivedAt != null` ne bloque jamais l'action `Ouvrir`
- `015` n'introduit aucun comportement d'ecriture, meme indirect

## Criteres d'acceptation

- `specs/active/015-frontend-closing-folders-entrypoint-v1.md` existe
- `specs/active/014-frontend-controls-readiness-cockpit-v1.md` n'existe plus
- `specs/done/014-frontend-controls-readiness-cockpit-v1.md` existe avec statut `Done`
- `/` charge uniquement `GET /api/me` puis eventuellement `GET /api/closing-folders`
- `/` appelle `GET /api/me` sans `X-Tenant-Id`
- si `GET /api/me` retourne `401`, `/` affiche exactement `authentification requise` et n'appelle jamais `GET /api/closing-folders`
- si `GET /api/me` retourne `200` avec `activeTenant == null`, `/` affiche exactement `contexte tenant requis` et n'appelle jamais `GET /api/closing-folders`
- si `GET /api/me` retourne `403`, `5xx`, une erreur reseau, un timeout ou un payload inexploitable, `/` affiche exactement `profil indisponible` et n'appelle jamais `GET /api/closing-folders`
- si `activeTenant != null`, `/` appelle `GET /api/closing-folders` avec `X-Tenant-Id = activeTenant.tenantId`
- si `GET /api/closing-folders` retourne `403`, `/` affiche exactement `acces dossiers refuse`
- si `GET /api/closing-folders` retourne `400`, `5xx`, un statut inattendu, echoue par reseau, echoue par timeout, ou retourne `200` avec un payload invalide ou incomplet, `/` affiche exactement `dossiers indisponibles`
- si la liste filtree est vide, `/` affiche exactement `aucun dossier de closing`
- `/` ne charge jamais `/controls`
- `/` ne contient plus de formulaire manuel d'UUID comme mecanisme principal d'entree produit
- tout dossier visible sur `/` expose une action `Ouvrir` vers `/closing-folders/:closingFolderId`
- la navigation vers `/closing-folders/:closingFolderId` reutilise le shell et le cockpit existants
- aucun dossier dont `tenantId != activeTenant.tenantId` n'est affiche
- un test explicite de non-affichage des lignes hors tenant est requis
- l'ordre des lignes visibles suit l'ordre backend recu ; aucun tri client custom n'est introduit
- aucun scope de creation, edition, archive, import, mapping, controls nouveau, financials, workpapers, documents, exports ou IA n'est ouvert
