# Spec 011 - Document Storage And Evidence Files V1

## Objectif

Livrer une capacite backend-only, REST-only, deterministe, tenant-scoped et audit-ready qui permet de stocker et consulter de vraies pieces justificatives rattachees a des workpapers persistants, sans casser `workpapers-v1` ni deriver vers les couches hors scope.

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
- `specs/done/002-core-identity-tenancy-closing.md`
- `specs/done/010-workpapers-v1.md`

## In scope

- extension du module proprietaire `workpapers`
- `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
- `GET /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`
- `GET /api/closing-folders/{closingFolderId}/documents/{documentId}/content`
- enrichissement additif de `GET /api/closing-folders/{closingFolderId}/workpapers` avec `documents[]`
- persistance de `document`
- stockage binaire prive via port interne `BinaryObjectStore`
- adaptateur `LOCAL_FS` pour `local` / `test`
- adaptateur `GCS` pour `dev` / `prod`
- migration Flyway unique `V7__spec_011_document_storage_and_evidence_files_v1.sql`
- contrats `contracts/openapi/documents-api.yaml`, `contracts/openapi/workpapers-api.yaml`, `contracts/db/documents-v1.md`
- tests unitaires, API, PostgreSQL optionnels et verification Modulith

## Out of scope

- frontend riche
- GraphQL
- IA active
- PDF feature
- exports pack final
- annexe generative
- signed URLs publiques
- refactor transverse en module `documents`
- dual-write vers `workpaper_evidence`
- bridge de persistance entre `document` et `workpaper_evidence`
- suppression, patch, rename, versioning, bulk upload
- modification des migrations precedentes
- dependance Docker locale

## Noyau fonctionnel fige

Le plus petit noyau credible est :

- un `document` immutable first-class
- metadata binaires fiables calculees cote serveur
- object storage prive
- download backend-only
- visibilite additive des vrais documents dans le cockpit `workpapers`

## Modele metier persiste

### `document`

- `id`
- `tenant_id`
- `workpaper_id`
- `storage_backend`
- `storage_object_key`
- `file_name`
- `media_type`
- `byte_size`
- `checksum_sha256`
- `source_label`
- `document_date`
- `created_at`
- `created_by_user_id`

Contraintes :

- `document` ne duplique pas `closing_folder_id`
- `closingFolderId` est toujours valide cote backend via jointure `document -> workpaper -> closing_folder`
- `document` est l'unique source de verite du vrai binaire
- `workpaper_evidence` reste la surface legacy de `010-workpapers-v1`
- aucun dual-write
- aucun bridge de persistance

### `document.storage_backend`

- `LOCAL_FS`
- `GCS`

## Contrat cockpit `GET /workpapers`

Evolution additive obligatoire :

- chaque item expose `documents[]`
- `documents[]` est toujours present dans `items[]`, meme si `workpaper = null`
- `documents[]` est toujours present dans `staleWorkpapers[]`
- `evidences[]` legacy reste inchange
- `documents[]` expose uniquement des metadata

### Semantique de lecture cockpit

- anchor current sans workpaper persistant :
  - `workpaper = null`
  - `documents = []`
- anchor current avec workpaper persistant :
  - `workpaper != null`
  - `documents = [...]`
- stale workpaper :
  - `documents = [...]` ou `[]`
  - champ toujours present

## Lecture dediee documents

### `GET /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`

- `200` si un workpaper persistant existe sur cet anchor, qu'il soit current ou stale
- `404` si aucun workpaper persistant n'existe sur cet anchor
- lecture autorisee sur closing `ARCHIVED`
- aucun audit

### `GET /api/closing-folders/{closingFolderId}/documents/{documentId}/content`

- `200` si le document appartient au tenant et au `closingFolderId` via son workpaper, qu'il soit current ou stale
- `404` sinon
- lecture autorisee sur closing `ARCHIVED`
- backend download uniquement
- headers obligatoires :
  - `Content-Disposition: attachment`
  - `Cache-Control: private, no-store`
- aucun audit

## Upload

### `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents`

- upload d'un fichier unique vers un workpaper persistant
- `201` si succes
- `404` si aucun workpaper persistant sur l'anchor
- `409` si closing `ARCHIVED`
- `409` si closing hors `PREVIEW_READY`
- `409` si anchor stale ou non current
- `409` si workpaper non editable
- `400` si metadata de requete invalides
- `413` si taille > 25 MiB

### Preconditions de write

- role maker uniquement : `ACCOUNTANT`, `MANAGER`, `ADMIN`
- workpaper persistant requis
- anchor current requis
- closing `ARCHIVED` interdit
- closing `PREVIEW_READY` requis
- workpaper editable uniquement si statut `DRAFT` ou `CHANGES_REQUESTED`

### Allow-list

- `application/pdf`
- `image/jpeg`
- `image/png`
- `image/tiff`
- `text/csv`
- `application/vnd.ms-excel`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### Taille max

- `25 MiB` par fichier
- depassement => `413`

### Regles upload

- `fileName` normalise cote serveur
- `byteSize` calcule cote serveur
- `checksumSha256` calcule cote serveur
- `storageObjectKey` genere cote serveur
- doublons explicitement acceptes
- aucun `Idempotency-Key` en V1
- aucun overwrite

## Sequence d'upload obligatoire

1. valider auth / tenant / RBAC / media type / taille / parent workpaper
2. generer `documentId` et `storageObjectKey` cote serveur
3. ecrire le flux dans le storage prive en calculant `byteSize` et `checksumSha256`
4. ouvrir la transaction DB, revalider le parent workpaper et ses invariants, puis inserer `document`
5. si l'insert DB echoue apres ecriture storage, tenter un delete compensatoire best-effort
6. si la compensation echoue, emettre un log structure d'erreur
7. ne jamais ecrire d'audit additionnel sur cette compensation

## Garanties

- si `201` est renvoye, ligne DB + objet storage existent
- si le storage echoue avant l'insert DB, aucune ligne DB n'existe
- pas d'atomicite magique DB + storage
- un orphan storage sans ligne DB reste possible si la compensation echoue

## Architecture

- module proprietaire : `workpapers`
- dependances autorisees :
  - `shared::application`
  - `identity::access`
  - `closing::access`
  - `controls::access`
  - `financials::access`
- ajout d'un port interne `BinaryObjectStore`
- aucun nouveau module transverse
- aucun appel HTTP interne
- aucun acces repository direct cross-module
- `ApplicationModules.verify()` reste vert

## DB et migrations

- une seule migration : `V7__spec_011_document_storage_and_evidence_files_v1.sql`
- une seule nouvelle table :
  - `document`
- FK composite tenant-scopee vers `workpaper`
- indexes commencant par `tenant_id`
- checks sur non-blank
- check sur `byte_size > 0`
- check sur `checksum_sha256` lowercase sur 64 caracteres
- check sur enum `storage_backend`
- aucune modification des migrations precedentes

## Securite et tenancy

- `X-Tenant-Id` absent => `400`
- `X-Tenant-Id` vide => `400`
- `X-Tenant-Id` mal forme => `400`
- `closingFolderId` invalide => `400`
- `documentId` invalide => `400`
- non authentifie => `401`
- tenant inaccessible => `403`
- membership inactive => `403`
- tenant inactive => `403`
- role insuffisant => `403`
- closing absent => `404`
- closing hors tenant => `404`
- aucune fuite cross-tenant
- aucune `storage_object_key` exposee au client

## RBAC

### GET workpapers

- `ACCOUNTANT`
- `REVIEWER`
- `MANAGER`
- `ADMIN`

### GET documents list

- `ACCOUNTANT`
- `REVIEWER`
- `MANAGER`
- `ADMIN`

### GET document content

- `ACCOUNTANT`
- `REVIEWER`
- `MANAGER`
- `ADMIN`

### POST upload document

- `ACCOUNTANT`
- `MANAGER`
- `ADMIN`

## Audit

Mutations reussies seulement :

- `DOCUMENT.CREATED`

Contraintes :

- zero `audit_event` sur tous les `GET`
- zero `audit_event` sur les echecs
- aucun `DOCUMENT.DOWNLOADED`

## Tests obligatoires

### Unit tests

- allow-list avec `application/pdf` accepte
- taille max
- normalisation `fileName`
- calcul serveur `byteSize` / `checksumSha256`
- doublons acceptes
- rejet `ARCHIVED`
- rejet stale / non current
- rejet non editable

### API tests

- auth / header / tenant / RBAC
- `GET /workpapers` current avec `documents[]` present meme vide
- `GET /workpapers` stale avec `documents[]`
- `GET /documents list` current / stale
- `GET /documents content` current / stale
- lecture sur `ARCHIVED`
- zero audit sur tous les `GET`
- `DOCUMENT.CREATED` seul sur upload reussi

### DB integration tests

- Flyway from scratch jusqu'a `V7`
- FK composites
- index tenant
- checks DB
- aucune regression sur `010-workpapers-v1`

### Storage consistency tests

- storage fail => zero ligne DB
- DB fail apres storage => compensation tentee
- upload identique repete => deux documents distincts

### Non-regressions explicites

- `GET /workpapers` continue de lire `workpaper_evidence` legacy inchange
- `GET /workpapers` expose desormais `documents[]` additif
- `GET /documents*` lit uniquement `document`

## Livrables

- spec active executable
- implementation backend dans `workpapers`
- `contracts/openapi/documents-api.yaml`
- mise a jour additive de `contracts/openapi/workpapers-api.yaml`
- `contracts/db/documents-v1.md`
- migration `V7__spec_011_document_storage_and_evidence_files_v1.sql`
- tests unitaires
- tests API
- tests `dbIntegrationTest` pertinents
- verification Modulith
