# 004 - Frontend foundation design system

## Status
Done

## Override de sequencage

Override de sequencage 004 : cette spec est close comme tranche d'enablement frontend differee livree apres les specs backend 006 a 013 deja livrees. Elle n'a reouvert aucune vague controls/readiness, n'a ajoute aucun frontend metier riche, et n'a pas modifie le present backend-first de docs/present/*.

## Role de cette spec

Cette spec devient la verite normative de `004`.

Elle borne un socle frontend minimal, testable et non ambigu pour preparer l'implementation sans activer un frontend metier riche.

## Sources de verite

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/adr/0005-front-ui-stack-and-design-system.md`
- `docs/ui/ui-foundations-v1.md`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/MeController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/BackendApplicationSmokeTest.kt`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/closing/api/ClosingFolderController.kt`
- `contracts/openapi/closing-folders-api.yaml`
- `contracts/openapi/closing-api.yaml`

## Runtime et outillage figes

- runtime frontend exact : `React + TypeScript + Vite`
- router exact : `react-router-dom`
- package manager exact : `pnpm`
- stack UI exacte : `Tailwind CSS + shadcn/ui + Radix Primitives + TanStack Table + React Hook Form + Zod`
- tests exacts : `Vitest + React Testing Library + axe-core` en `jsdom`
- lint exact : `ESLint`
- Storybook : `OUT`

## Decisions fermees

- `004` est une tranche d'enablement frontend differee, pas une nouvelle vague produit.
- `004` ne livre aucun ecran metier complet `controls`, `imports`, `mapping`, `financial-summary`, `financial-statements-structured`, `workpapers`, `documents` ou `exports`.
- `004` implemente un sous-ensemble strict de la source de verite UI, pas le catalogue UI complet.
- `004` ne consomme qu'une seule verite API pour le shell : `GET /api/me` puis `GET /api/closing-folders/{id}`.
- `contracts/openapi/closing-api.yaml` est legacy / superseded et ne doit pas etre consomme par `004`.
- Le shell 004 n'implemente pas de selecteur de tenant. Si `activeTenant = null`, il bloque proprement.
- `AppShell` affiche le tenant actif en lecture seule et n'introduit aucun tenant switch interactif dans `004`.

## In scope exact

- bootstrap frontend sur le runtime et l'outillage figes ci-dessus
- `frontend/src/styles/tokens.css`
- `frontend/src/lib/format/*`
- `frontend/src/components/ui/*`
- `frontend/src/components/workbench/*`
- `AppShell`
- les composants exacts listes dans `Composants exacts de 004`
- la route `/` comme surface de demonstration interne
- la route `/closing-folders/:closingFolderId` comme seule route shell produit de `004`
- un client API minimal limite a `GET /api/me` et `GET /api/closing-folders/{id}`
- regles de tests d'accessibilite de base

## Out of scope exact

- tout composant hors liste fermee de cette spec
- tout ecran metier complet
- toute consommation de `GET /api/closing-folders/{closingFolderId}/controls`
- tout endpoint legacy `/api/closings/{closingId}`
- toute mutation backend depuis le frontend
- tout selecteur de tenant
- Storybook
- Playwright ou autre suite E2E navigateur

## Composants exacts de 004

`004` livre un sous-ensemble exact et ferme :

- `AppShell`
- `Button`
- `Input`
- `Select`
- `DataTable`
- `WorkflowBadge`
- `ToastUndo`

Tout autre composant est explicitement hors scope de `004`.

## Routes exactes de 004

### `/`

- statut : surface de demonstration interne uniquement
- aucun appel API autorise
- usage : prouver les tokens, etats et composants exacts de `004`
- ce n'est pas une page shell produit

### `/closing-folders/:closingFolderId`

- statut : seule route shell produit de `004`
- elle charge uniquement le contexte tenant actif et les metadonnees du dossier
- elle ne charge ni `controls`, ni `imports`, ni `mapping`, ni `workpapers`, ni `exports`

## Contrat API reel consomme par 004

### Verite unique retenue

`004` consomme uniquement :

- `GET /api/me`
- `GET /api/closing-folders/{id}`

`004` ne consomme jamais :

- `GET /api/closings/{closingId}`
- `GET /api/closing-folders/{closingFolderId}/controls`

### `GET /api/me`

Preuve repo :

- `backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/MeController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/BackendApplicationSmokeTest.kt`

Constats observes :

- l'endpoint existe reellement sur `GET /api/me`
- il est protege et retourne `401` sans authentification
- il n'exige pas `X-Tenant-Id` pour exister
- sans `X-Tenant-Id`, `activeTenant` peut etre auto-resolu s'il n'existe qu'un seul membership actif
- sans `X-Tenant-Id`, `activeTenant` peut rester `null` si plusieurs memberships actifs existent

Reponse backend reelle exposee par `MeResponse` :

- `actor`
- `memberships`
- `activeTenant`
- `effectiveRoles`

Sous-ensemble exact consomme par le shell 004 :

- `activeTenant.tenantId`
- `activeTenant.tenantSlug`
- `activeTenant.tenantName`

Regle shell :

- le shell appelle `GET /api/me` sans `X-Tenant-Id`
- un `200` sur `GET /api/me` n'est exploitable pour le shell que si `activeTenant` vaut `null` ou expose un objet complet lisible avec `tenantId`, `tenantSlug` et `tenantName`
- si `activeTenant == null`, le shell affiche un etat bloquant et n'appelle pas l'endpoint dossier
- si `GET /api/me` retourne `200` avec un payload invalide ou incomplet pour lire `activeTenant`, le shell affiche `profil indisponible` et n'appelle jamais `GET /api/closing-folders/{id}`

### `GET /api/closing-folders/{id}`

Preuve repo :

- `backend/src/main/kotlin/ch/qamwaq/ritomer/closing/api/ClosingFolderController.kt`
- `contracts/openapi/closing-folders-api.yaml`

Constats observes :

- l'endpoint reel est `GET /api/closing-folders/{id}`
- le contrat backend nomme explicitement le path param `id`
- le frontend peut garder un param local `closingFolderId`, mais il mappe vers l'endpoint backend `{id}`
- l'endpoint exige `X-Tenant-Id`

Reponse backend reelle exposee par `ClosingFolderResponse` :

- `id`
- `tenantId`
- `name`
- `periodStartOn`
- `periodEndOn`
- `externalRef`
- `status`
- `archivedAt`
- `archivedByUserId`
- `createdAt`
- `updatedAt`

Sous-ensemble exact consomme par le shell 004 :

- `id`
- `tenantId`
- `name`
- `periodStartOn`
- `periodEndOn`
- `externalRef`
- `status`

Regle shell :

- le shell envoie `X-Tenant-Id = activeTenant.tenantId`
- le shell n'appelle jamais cet endpoint tant que `activeTenant == null`
- un `200` sur `GET /api/closing-folders/{id}` n'est exploitable pour le shell que si le payload expose `id`, `tenantId`, `name`, `periodStartOn`, `periodEndOn`, `status` et `externalRef` avec `externalRef` autorise a `null`
- si `GET /api/closing-folders/{id}` retourne `200` avec un payload invalide ou incomplet pour ce sous-ensemble, le shell affiche `dossier indisponible` et ne rend aucun detail dossier

## Contrat AppShell exact de 004

### Regle generale

- `AppShell` affiche le tenant actif seulement quand `GET /api/me` retourne `200` avec `activeTenant != null`
- dans `004`, l'affichage du tenant actif est read-only
- Derogation 004 AppShell : dans `004`, `AppShell` conserve `header`, `sidebar`, `breadcrumb`, `sticky action zone` et contexte tenant visible en lecture seule ; aucun tenant switch interactif n'est autorise.
- dans `004`, aucun tenant switch interactif n'est autorise :
  - aucun bouton de switch
  - aucun menu de switch
  - aucun select de switch
  - aucun dropdown de switch
  - aucune liste deroulante de switch
  - aucune action click pour changer le tenant
  - aucun handler de changement de tenant

### Sequence de chargement sur `/closing-folders/:closingFolderId`

1. appeler `GET /api/me`
2. si `GET /api/me` retourne `200` avec un payload exploitable et `activeTenant != null`, appeler `GET /api/closing-folders/{id}` avec `X-Tenant-Id = activeTenant.tenantId`
3. sinon, ne pas appeler `GET /api/closing-folders/{id}`

### Regle d'exhaustivite des etats non nominaux

- tout resultat non nominal non explicitement liste dans cette spec doit etre rattache a un etat visible exact
- aucun fallback implicite n'est autorise
- pour `GET /api/me`, tout resultat non nominal non explicitement rattache a `AUTH_REQUIRED` ou `TENANT_CONTEXT_REQUIRED` doit rendre `PROFILE_UNAVAILABLE` avec le texte exact visible `profil indisponible`, sans appel a `GET /api/closing-folders/{id}`
- pour `GET /api/closing-folders/{id}`, tout resultat non nominal non explicitement rattache a `CLOSING_AUTH_REQUIRED`, `CLOSING_FORBIDDEN`, `CLOSING_NOT_FOUND` ou `CLOSING_TENANT_MISMATCH` doit rendre `CLOSING_UNAVAILABLE` avec le texte exact visible `dossier indisponible`, sans rendu du detail dossier

### Etat `AUTH_REQUIRED`

Condition :

- `GET /api/me` retourne `401`

Rendu exact :

- etat bloquant d'authentification requise
- texte exact visible : `authentification requise`
- aucun appel a `GET /api/closing-folders/{id}`
- aucun rendu du detail dossier

### Etat `TENANT_CONTEXT_REQUIRED`

Condition :

- `GET /api/me` retourne `200`
- `activeTenant = null`

Rendu exact :

- etat bloquant de contexte tenant requis
- texte exact visible : `contexte tenant requis`
- aucun appel a `GET /api/closing-folders/{id}`
- aucune inference de tenant a partir de `memberships`
- aucun rendu du detail dossier

### Etat `PROFILE_UNAVAILABLE`

Condition :

- `GET /api/me` retourne `403`
- ou `GET /api/me` retourne une erreur `5xx`
- ou `GET /api/me` echoue pour erreur reseau
- ou `GET /api/me` echoue par timeout
- ou `GET /api/me` retourne `200` avec un payload invalide ou incomplet pour lire `activeTenant.tenantId`, `activeTenant.tenantSlug` et `activeTenant.tenantName`

Rendu exact :

- etat explicite et distinct de profil indisponible
- texte exact visible : `profil indisponible`
- aucun appel a `GET /api/closing-folders/{id}`
- aucun rendu du detail dossier

### Etat `CLOSING_AUTH_REQUIRED`

Condition :

- `GET /api/closing-folders/{id}` retourne `401`

Rendu exact :

- etat explicite et distinct d'authentification requise sur le chargement dossier
- texte exact visible : `authentification requise`
- tenant actif visible en lecture seule
- aucun rendu du detail dossier

### Etat `CLOSING_FORBIDDEN`

Condition :

- `GET /api/closing-folders/{id}` retourne `403`

Rendu exact :

- etat explicite et distinct d'acces dossier refuse
- texte exact visible : `acces dossier refuse`
- tenant actif visible en lecture seule
- aucun rendu du detail dossier

### Etat `CLOSING_NOT_FOUND`

Condition :

- `GET /api/closing-folders/{id}` retourne `404`

Rendu exact :

- etat explicite et distinct de dossier introuvable
- texte exact visible : `dossier introuvable`
- tenant actif visible en lecture seule
- aucun rendu du detail dossier

### Etat `CLOSING_UNAVAILABLE`

Condition :

- `GET /api/closing-folders/{id}` retourne une erreur `5xx`
- `GET /api/closing-folders/{id}` echoue pour erreur reseau
- ou `GET /api/closing-folders/{id}` echoue par timeout
- ou `GET /api/closing-folders/{id}` retourne `200` avec un payload invalide ou incomplet pour lire `id`, `tenantId`, `name`, `periodStartOn`, `periodEndOn`, `externalRef` et `status`

Rendu exact :

- etat explicite et distinct de dossier indisponible
- texte exact visible : `dossier indisponible`
- tenant actif visible en lecture seule
- aucun rendu du detail dossier

### Etat `CLOSING_TENANT_MISMATCH`

Condition :

- `GET /api/closing-folders/{id}` retourne `200`
- `closingFolder.tenantId != activeTenant.tenantId`

Rendu exact :

- etat explicite et distinct d'erreur de coherence tenant dossier
- texte exact visible : `incoherence tenant dossier`
- tenant actif visible en lecture seule
- aucun rendu du detail dossier

### Etat `CLOSING_READY`

Condition :

- `GET /api/me` retourne `200` avec un payload exploitable et `activeTenant != null`
- `GET /api/closing-folders/{id}` retourne `200` avec un payload exploitable pour le shell
- `closingFolder.tenantId == activeTenant.tenantId`

Rendu exact :

- tenant actif visible en lecture seule
- detail dossier visible
- sous-ensemble dossier rendu limite a :
  - `name`
  - `status`
  - `periodStartOn`
  - `periodEndOn`
  - `externalRef`

## Storybook pour 004

- Storybook est explicitement `OUT` pour `004`
- la preuve remplaquante obligatoire est :
  - la route `/` de demonstration interne
  - les tests `Vitest + React Testing Library + axe-core`
  - un mapping token explicite
- `004` n'introduit aucun package `@storybook/*` ni aucun dossier `.storybook/`

## Criteres d'acceptation

- `specs/done/004-frontend-foundation-design-system.md` est la seule spec normative de `004`
- la liste des composants de `004` est exactement celle de cette spec, sans extension implicite
- `/` existe comme surface de demonstration interne sans appel API
- `/closing-folders/:closingFolderId` est la seule route shell produit de `004`
- le shell consomme uniquement `GET /api/me` et `GET /api/closing-folders/{id}`
- le shell ne consomme jamais `contracts/openapi/closing-api.yaml` ni d'endpoint `/api/closings/{closingId}`
- si `GET /api/me` n'est pas `200` avec un payload exploitable et `activeTenant != null`, aucun appel dossier n'est autorise
- si `GET /api/me` retourne `401`, le shell affiche `authentification requise` et n'appelle pas l'endpoint dossier
- si `activeTenant == null`, le shell bloque sans fallback sur `memberships`
- si `GET /api/me` retourne `200` avec un payload invalide ou incomplet pour lire `activeTenant`, le shell affiche `profil indisponible` et n'appelle jamais l'endpoint dossier
- si `GET /api/me` retourne `403`, `5xx`, une erreur reseau ou un timeout, le shell affiche `profil indisponible`
- si `GET /api/closing-folders/{id}` retourne `401`, le shell affiche `authentification requise`
- si `GET /api/closing-folders/{id}` retourne `403`, le shell affiche `acces dossier refuse`
- si `GET /api/closing-folders/{id}` retourne `404`, le shell affiche `dossier introuvable`
- si `GET /api/closing-folders/{id}` retourne `5xx`, echoue par reseau, echoue par timeout, ou retourne `200` avec un payload invalide ou incomplet, le shell affiche `dossier indisponible`
- aucun detail dossier n'est rendu sur `401`, `403`, `404`, `5xx`, erreur reseau, timeout, payload invalide ou incomplet, ou mismatch tenant
- tout resultat non nominal non explicitement liste dans la spec est rattache a un etat visible exact ; aucun fallback implicite n'est autorise
- chaque branche non nominale listee dans cette spec a un texte exact visible et stable
- si `closingFolder.tenantId != activeTenant.tenantId`, le shell affiche `incoherence tenant dossier` et ne rend pas le detail dossier
- `AppShell` n'introduit aucun tenant switch interactif dans `004`
- aucun bouton, menu, select, dropdown ou handler de changement de tenant n'existe dans `004`
- Storybook reste hors scope de `004`
