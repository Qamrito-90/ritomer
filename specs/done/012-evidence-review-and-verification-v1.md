# Spec 012 - Evidence Review And Verification V1

## Objectif

Livrer une capacite backend-only, deterministe, tenant-scoped et audit-ready qui ajoute une verification reviewer first-class sur les vrais `document`, sans casser `workpapers-v1`, sans ouvrir de versioning documentaire et sans deriver hors du module `workpapers`.

## Source de verite

- `AGENTS.md`
- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/adr/0001-monolithe-modulaire.md`
- `docs/adr/0002-rest-first-graphql-later.md`
- `docs/adr/0004-multi-tenancy-audit-rls-progressive.md`
- `docs/adr/0006-postgresql-cloud-sql-no-docker-v1.md`
- `docs/product/v1-plan.md`
- `specs/done/010-workpapers-v1.md`
- `specs/done/011-document-storage-and-evidence-files-v1.md`
- `contracts/openapi/documents-api.yaml`
- `contracts/openapi/workpapers-api.yaml`
- `contracts/db/documents-v1.md`

## In scope

- extension additive du module proprietaire `workpapers`
- persistance de `document_verification` comme unique nouveau persistant
- relation stricte `1:1` entre `document` et `document_verification`
- backfill des documents existants
- creation transactionnelle de `document_verification` a chaque upload de `document`
- `POST /api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`
- enrichissement additif de chaque `DocumentSummary`
- enrichissement additif de `WorkpaperItem` avec `documentVerificationSummary`
- gate evidence-aware sur `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`
- audit `DOCUMENT.VERIFICATION_UPDATED`
- migration Flyway unique `V8__spec_012_evidence_review_and_verification_v1.sql`
- tests unitaires, API, PostgreSQL optionnels et verification Modulith

## Out of scope

- frontend riche
- GraphQL
- IA active
- PDF export
- export pack final
- annexe generative
- refactor transverse
- versioning, supersession, delete, replacement ou rename de documents
- nouveau module transverse `documents`
- modification des anciennes migrations
- dependance Docker locale

## Noyau fonctionnel fige

Le plus petit noyau credible est :

- une decision reviewer first-class sur chaque `document`
- un resume derive par `workpaper`
- une decision finale `workpaper` qui reste explicite et humaine

`document verification` est first-class.

`workpaper review summary` est derive.

`reviewer decision` finale au niveau `workpaper` reste celle de `010-workpapers-v1`.

## Source de verite du gating

- la seule source de verite de gating est `controls.readiness = READY`
- la spec 012 n'utilise pas `PREVIEW_READY`

## Modele metier persiste

### `document_verification`

- `document_id`
- `tenant_id`
- `verification_status`
- `review_comment`
- `reviewed_at`
- `reviewed_by_user_id`

Contraintes :

- chaque `document` a exactement une ligne `document_verification`
- jamais zero, jamais plusieurs
- ligne creee au backfill des documents existants
- ligne creee a l'upload de chaque nouveau document
- creation dans la meme transaction DB que l'insert du `document`
- etat initial obligatoire :
  - `verification_status = UNVERIFIED`
  - `review_comment = null`
  - `reviewed_at = null`
  - `reviewed_by_user_id = null`

## Regles reviewer

- endpoint reviewer document :
  - `POST /api/closing-folders/{closingFolderId}/documents/{documentId}/verification-decision`
- RBAC :
  - `REVIEWER`
  - `MANAGER`
  - `ADMIN`
- decisions acceptees :
  - `VERIFIED`
  - `REJECTED`

### Commentaire

- `REJECTED` => commentaire obligatoire
- `VERIFIED` => commentaire interdit et force a `null`
- toute mutation reelle vers `VERIFIED` force `review_comment = null`

### No-op exact

- meme decision + meme commentaire normalise => `200`, aucune mutation, aucun audit
- `REJECTED -> REJECTED` avec commentaire different => `200`, mutation reelle, audit
- `VERIFIED` avec commentaire non nul => `400`, aucune mutation, aucun audit

## Read-models additifs

### `DocumentSummary`

Chaque `DocumentSummary` expose :

- `verificationStatus`
- `reviewComment`
- `reviewedAt`
- `reviewedByUserId`

### `WorkpaperItem.documentVerificationSummary`

- si `workpaper != null` => toujours present
- si `workpaper = null` => `null`

Forme :

- `documentsCount`
- `unverifiedCount`
- `verifiedCount`
- `rejectedCount`

Semantique :

- current anchor sans workpaper persiste :
  - `workpaper = null`
  - `documents = []`
  - `documentVerificationSummary = null`
- current anchor avec workpaper persiste :
  - `documentVerificationSummary` toujours present
- `staleWorkpapers[]` :
  - `documents[]` toujours present
  - `documentVerificationSummary` toujours present

## Matrice current / stale / ARCHIVED

### Lectures

- `GET /workpapers` :
  - current => `200`
  - stale => `200` via `staleWorkpapers[]`
  - `ARCHIVED` => `200`
- `GET /workpapers/{anchorCode}/documents` :
  - current => `200` si workpaper persiste
  - stale => `200` si workpaper persiste stale
  - `ARCHIVED` => `200`
- `GET /documents/{documentId}/content` :
  - current => `200`
  - stale => `200`
  - `ARCHIVED` => `200`

Contraintes :

- zero `audit_event` sur tous les `GET`

### Writes

- `POST /documents/{documentId}/verification-decision` :
  - current + `controls.readiness = READY` + non `ARCHIVED` + parent `READY_FOR_REVIEW` uniquement
  - stale => `409`
  - `ARCHIVED` => `409`
- `POST /workpapers/{anchorCode}/review-decision` :
  - current + `controls.readiness = READY` + non `ARCHIVED` + workpaper persistant courant uniquement
  - stale => `409`
  - `ARCHIVED` => `409`

## Gate `READY_FOR_REVIEW -> REVIEWED`

Le gate s'applique seulement a la transition reelle `READY_FOR_REVIEW -> REVIEWED`.

Condition d'entree exacte :

- closing non `ARCHIVED`
- `controls.readiness = READY`
- anchor courant
- workpaper persistant courant
- workpaper en `READY_FOR_REVIEW`
- et :
  - soit `documentsCount = 0`
  - soit `documentsCount > 0` avec `unverifiedCount = 0` et `verifiedCount >= 1`

`rejectedCount` n'est pas bloquant :

- un document rejete peut rester attache comme trace utile d'une preuve ecartee
- 012 n'introduit ni supersession ni versioning documentaire

Si la condition echoue :

- `409`
- aucune mutation
- aucun audit
- aucun fallback implicite vers `CHANGES_REQUESTED`

## Audit

- nom definitif :
  - `DOCUMENT.VERIFICATION_UPDATED`

Emission :

- toute mutation reviewer reussie sur `document`
- y compris `REJECTED -> REJECTED` avec commentaire different

Non emission :

- no-op exact
- lecture
- echec
- backfill
- creation automatique de la ligne initiale `document_verification`

`DOCUMENT.CREATED` reste le seul audit de l'upload reussi.

## Architecture

- module proprietaire : `workpapers`
- aucun nouveau module
- aucun acces repository direct cross-module
- aucune modification des frontieres Modulith

## DB et migrations

- une seule migration :
  - `V8__spec_012_evidence_review_and_verification_v1.sql`
- aucune modification des migrations precedentes
- FK composites tenant-scopees
- indexes commencant par `tenant_id`
- unicite stricte `1:1` entre `document` et `document_verification`

## Tests obligatoires

### Unit tests

- state machine document
- commentaire obligatoire sur `REJECTED`
- commentaire interdit sur `VERIFIED`
- no-op exact
- `REJECTED -> REJECTED` avec commentaire different
- gate `READY_FOR_REVIEW -> REVIEWED`

### API tests

- auth / header / tenant / RBAC
- reviewer-only sur `verification-decision`
- current / stale / `ARCHIVED`
- zero audit sur tous les `GET`
- audit exact sur mutation reviewer document
- non-regression de `010` et `011`

### DB integration tests

- Flyway from scratch jusqu'a `V8`
- backfill `document_verification`
- unicite `1:1`
- FK composites
- index tenant
- audit exact
- aucune regression sur `010-workpapers-v1` et `011-document-storage-and-evidence-files-v1`

### Modulith

- verification des dependances module `workpapers`

## Livrables

- implementation backend dans `workpapers`
- migration `V8__spec_012_evidence_review_and_verification_v1.sql`
- `contracts/openapi/documents-api.yaml`
- `contracts/openapi/workpapers-api.yaml`
- `contracts/db/documents-v1.md`
- tests unitaires
- tests API
- tests `dbIntegrationTest` pertinents
- verification Modulith
