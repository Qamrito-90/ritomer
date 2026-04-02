# Spec 010 - Workpapers V1

## Objectif

Livrer une capacite backend-only, REST-only, deterministe, tenant-scoped et audit-ready qui permet de persister des workpapers ancres sur la structure financiere courante, avec metadata de pieces justificatives et workflow maker/checker minimal.

## Source de verite

- `AGENTS.md`
- `docs/adr/0001-monolithe-modulaire.md`
- `docs/adr/0002-rest-first-graphql-later.md`
- `docs/adr/0004-multi-tenancy-audit-rls-progressive.md`
- `docs/adr/0006-postgresql-cloud-sql-no-docker-v1.md`
- `docs/vision/architecture.md`
- `docs/vision/ux.md`
- `docs/vision/ai-native.md`
- `docs/product/v1-plan.md`
- `specs/done/006-controls-v1.md`
- `specs/done/007-financial-summary-v1.md`
- `specs/done/009-financial-statements-structured-v1.md`

## In scope

- module proprietaire `workpapers`
- `GET /api/closing-folders/{closingFolderId}/workpapers`
- `PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}`
- `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
- persistance de `workpaper`
- persistance de `workpaper_evidence` en metadata only
- workflow maker/checker minimal
- stale workpapers separes du read-model anchor-driven
- contrat `contracts/openapi/workpapers-api.yaml`
- contrat `contracts/db/workpapers-v1.md`
- migration Flyway unique `V6__spec_010_workpapers_v1.sql`
- tests unitaires, API, PostgreSQL optionnels et verification Modulith

## Out of scope

- frontend riche
- GraphQL
- IA active
- PDF
- exports pack final
- annexe generative
- upload binaire reel
- signed URLs
- stockage objet
- commentaires threades
- generation automatique
- suppression de workpaper
- modification des anciennes migrations
- dependance Docker locale

## Noyau fonctionnel fige

Le plus petit noyau credible est :

- un workpaper persiste
- des metadata de pieces justificatives
- un workflow maker/checker minimal

`reviewer_comment` n'est pas first-class :

- le dernier commentaire reviewer vit sur `workpaper`
- l'historique detaille vit dans `audit_event`

## Ancrage metier

- un seul workpaper maximum par breakdown courant
- ancrage autorise uniquement sur `SECTION` ou `LEGACY_BUCKET_FALLBACK`
- jamais sur un groupe libre
- aucune persistance des calculs financiers eux-memes

Le read-model est anchor-driven et non persistence-driven :

- `items[]` expose tous les anchors courants connus a la lecture, meme sans workpaper persiste
- `staleWorkpapers[]` expose separement les workpapers persistes dont l'anchor n'est plus courant

Les anchors courants reutilisent les memes regles de breakdown que `financial-statements-structured-v1` via `financials::access`.

## Read-model GET

`GET /api/closing-folders/{closingFolderId}/workpapers` retourne :

- `closingFolderId`
- `closingFolderStatus`
- `readiness`
- `latestImportVersion`
- `blockers[]`
- `nextAction`
- `summaryCounts`
- `items[]`
- `staleWorkpapers[]`

### `summaryCounts`

- `totalCurrentAnchors`
- `withWorkpaperCount`
- `readyForReviewCount`
- `reviewedCount`
- `staleCount`
- `missingCount`

### `items[]`

Chaque item expose :

- anchor metadata
- `isCurrentStructure = true`
- `workpaper = null` si aucun workpaper n'est persiste pour cet anchor
- sinon le workpaper persiste avec ses evidences ordonnees

### `staleWorkpapers[]`

Chaque stale workpaper expose :

- anchor metadata persistee
- `isCurrentStructure = false`
- lecture seule
- workpaper et evidences ordonnees

## Ecriture maker-side

`PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}`

- create => `201`
- update => `200`
- no-op exact => `200`
- aucun audit sur no-op

### Preconditions

- closing `ARCHIVED` => `409`
- closing non `PREVIEW_READY` => `409`
- anchor absent du jeu courant => `409`
- anchor stale ou non courant => `409`

### Payload minimal

- `noteText`
- `status` cote maker uniquement : `DRAFT | READY_FOR_REVIEW`
- `evidences[]`

### Regles de write

- creation autorisee sur anchor courant uniquement
- mutation de contenu maker autorisee seulement si le statut persiste est `DRAFT` ou `CHANGES_REQUESTED`
- un `PUT` identique au contenu persiste est un no-op exact
- un `PUT` non identique avec statut persiste `READY_FOR_REVIEW` ou `REVIEWED` est rejete

## Ecriture reviewer-side

`POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`

- `decision = CHANGES_REQUESTED | REVIEWED`
- commentaire obligatoire si `CHANGES_REQUESTED`
- `200` en succes
- `200` no-op si statut et commentaire inchanges
- aucun audit sur no-op

### Preconditions

- closing `ARCHIVED` => `409`
- closing non `PREVIEW_READY` => `409`
- anchor absent du jeu courant => `409`
- anchor stale ou non courant => `409`
- aucun workpaper persiste sur cet anchor => `404`

### Regles de write

- changement de statut reviewer autorise seulement depuis `READY_FOR_REVIEW`
- mise a jour commentaire seule autorisee sur le endpoint reviewer si la `decision` reste `CHANGES_REQUESTED` ou `REVIEWED`
- une requete reviewer identique au statut et commentaire persistants est un no-op exact

## State machine obligatoire

Transitions de statut autorisees :

- `DRAFT -> READY_FOR_REVIEW`
- `READY_FOR_REVIEW -> CHANGES_REQUESTED`
- `READY_FOR_REVIEW -> REVIEWED`
- `CHANGES_REQUESTED -> DRAFT`
- `CHANGES_REQUESTED -> READY_FOR_REVIEW`

Regles complementaires :

- tout changement de statut hors de ces transitions est rejete
- les no-op ne sont pas des transitions et n'ecrivent aucun audit
- `PUT` n'accepte jamais `CHANGES_REQUESTED` ni `REVIEWED`
- `POST review-decision` n'accepte jamais `DRAFT` ni `READY_FOR_REVIEW`

## Modele metier persiste

### `workpaper`

- `id`
- `tenant_id`
- `closing_folder_id`
- `anchor_code`
- `anchor_label`
- `summary_bucket_code`
- `statement_kind`
- `breakdown_type`
- `note_text`
- `status`
- `review_comment`
- `basis_import_version`
- `basis_taxonomy_version`
- `created_at`
- `created_by_user_id`
- `updated_at`
- `updated_by_user_id`
- `reviewed_at`
- `reviewed_by_user_id`

### `workpaper_evidence`

- `id`
- `tenant_id`
- `workpaper_id`
- `position`
- `file_name`
- `media_type`
- `document_date`
- `source_label`
- `verification_status`
- `external_reference`
- `checksum_sha256`

## Architecture

- module proprietaire : `workpapers`
- dependances autorisees :
  - `shared::application`
  - `identity::access`
  - `closing::access`
  - `controls::access`
  - `financials::access`
- `financials::access` est cree comme couture explicite si necessaire
- `workpapers` ne depend ni de `imports` ni de `mapping` directement
- aucun appel HTTP interne
- aucun acces repository direct cross-module
- `ApplicationModules.verify()` reste vert

## DB et migrations

- une seule migration : `V6__spec_010_workpapers_v1.sql`
- deux tables seulement :
  - `workpaper`
  - `workpaper_evidence`
- unicite par `(tenant_id, closing_folder_id, anchor_code)`
- FK tenant-scoped
- indexes commencant par `tenant_id`
- checks sur enums et non-blank
- aucune modification des migrations precedentes

## Securite et tenancy

- `X-Tenant-Id` absent => `400`
- `X-Tenant-Id` vide => `400`
- `X-Tenant-Id` mal forme => `400`
- `closingFolderId` invalide => `400`
- non authentifie => `401`
- tenant inaccessible => `403`
- membership inactive => `403`
- tenant inactive => `403`
- role insuffisant => `403`
- closing absent => `404`
- closing hors tenant => `404`
- aucune fuite cross-tenant

## RBAC

### GET workpapers

- `ACCOUNTANT`
- `REVIEWER`
- `MANAGER`
- `ADMIN`

### PUT workpaper

- `ACCOUNTANT`
- `MANAGER`
- `ADMIN`

### POST review-decision

- `REVIEWER`
- `MANAGER`
- `ADMIN`

## Audit

Mutations reussies seulement :

- `WORKPAPER.CREATED`
- `WORKPAPER.UPDATED`
- `WORKPAPER.REVIEW_STATUS_CHANGED`

Contraintes :

- zero `audit_event` sur tous les `GET`
- zero `audit_event` sur tous les no-op
- audit exact sur mutations reussies uniquement

## Tests obligatoires

### Unit tests

- validation d'anchor courant uniquement
- state machine complete
- no-op exact
- stale write rejected
- calcul `isCurrentStructure`
- ordre et normalisation des evidences
- commentaire reviewer obligatoire si `CHANGES_REQUESTED`
- maker update autorise seulement en `DRAFT` ou `CHANGES_REQUESTED`

### API tests

- auth/header/tenant/role
- `GET` zero audit
- `GET` retourne les anchors courants meme sans workpaper persiste
- `staleWorkpapers[]` visibles separement
- stale workpaper visible mais non modifiable
- `PUT` create / update / no-op
- `POST review-decision` reviewer only
- `ARCHIVED` lisible, writes `409`
- `BLOCKED` lisible avec `nextAction`, writes `409`

### DB integration tests

- Flyway from scratch jusqu'a `V6`
- contraintes uniques / FK composites / index tenant
- rollback transactionnel
- audit exact
- workpaper devient stale apres reimport ou remapping
- `workpaper_evidence` persiste correctement
- zero audit sur `GET`

### Modulith

- verification des dependances
- `NamedInterface("access")` cote `financials`

## Livrables

- spec active executable
- implementation backend dans `financials` et `workpapers`
- `contracts/openapi/workpapers-api.yaml`
- `contracts/db/workpapers-v1.md`
- migration `V6__spec_010_workpapers_v1.sql`
- tests unitaires
- tests API
- tests `dbIntegrationTest` pertinents
- verification Modulith
