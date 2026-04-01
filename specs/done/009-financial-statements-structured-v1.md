# Spec 009 - Financial Statements Structured V1

## Objectif

Livrer une capacite backend-only, read-only, deterministe et tenant-scoped qui expose une restitution financiere structuree pour un closing, sans confusion possible avec un etat statutaire ou un export final.

La restitution est explicitement :

- une `STRUCTURED_PREVIEW`
- non statutaire
- non export final
- non conforme a une presentation CO detaillee complete

## Source de verite

Le read-model est strictement derive de :

- le dernier import de balance valide disponible pour le closing
- la projection du mapping manuel courant sur ce dernier import
- la readiness existante reutilisee via `controls::access`

## In scope

- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
- read-model pur derive, synchrone, sans persistance de resultat
- lecture autorisee sur closing `ARCHIVED`
- payload explicite sur la non-statutarite via `presentationType = STRUCTURED_PREVIEW` et `isStatutory = false`
- structured statements disponibles seulement quand le closing est `PREVIEW_READY`
- groupes via `summaryBucketCode`
- breakdown via `sectionCode` quand il existe reellement
- fallback legacy explicite et type pour les mappings V1 sans section detaillee
- support V1, V2 et mix V1/V2
- contrat `contracts/openapi/financial-statements-structured-api.yaml`
- tests unitaires, MockMvc, PostgreSQL optionnels et verification Modulith

## Out of scope

- tout `POST /run`
- toute persistance d'un resultat ou snapshot
- toute nouvelle table ou migration Flyway
- GraphQL
- modification du contrat `financial-summary-v1`
- exports, PDF, annexe, workpapers
- IA active
- frontend riche

## Etats metier

### `NO_DATA`

- aucun import disponible
- `balanceSheet = null`
- `incomeStatement = null`
- blockers visibles
- `nextAction.code = IMPORT_BALANCE`

### `BLOCKED`

- import present mais closing non `PREVIEW_READY`
- `balanceSheet = null`
- `incomeStatement = null`
- blockers visibles
- `nextAction` visible

### `PREVIEW_READY`

- import present et mapping complet
- `balanceSheet` calcule
- `incomeStatement` calcule
- `blockers = []`
- `nextAction = null`

## Contrat top-level attendu

La reponse expose :

- `closingFolderId`
- `closingFolderStatus`
- `readiness`
- `statementState`
- `presentationType`
- `isStatutory`
- `taxonomyVersion`
- `latestImportVersion`
- `coverage`
- `blockers[]`
- `nextAction`
- `balanceSheet`
- `incomeStatement`

## Restitution structuree

### `balanceSheet`

- `groups[]` ordonnes : `BS.ASSET`, `BS.LIABILITY`, `BS.EQUITY`
- `totals`

### `incomeStatement`

- `groups[]` ordonnes : `PL.REVENUE`, `PL.EXPENSE`
- `totals`

## Regles d'agregation

- les groupes sont construits via `summaryBucketCode`
- les breakdowns sont construits via `sectionCode` quand ce code expose une vraie section publiee
- un mapping legacy V1 sans section detaillee ne doit jamais etre force dans une section V2
- un mapping legacy V1 sans section detaillee produit une ligne fallback stable, explicite et typee
- `breakdownType = SECTION | LEGACY_BUCKET_FALLBACK`
- les codes, labels et ordres des lignes fallback sont stables et testes

## Conventions de calcul

- `ASSET` et `EXPENSE` = `debit - credit`
- `LIABILITY`, `EQUITY`, `REVENUE` = `credit - debit`
- `currentPeriodResult = revenue - expenses`
- `netResult = revenue - expenses`

## Difference explicite avec financial-summary-v1

- `financial-summary-v1` reste ultra-synthetique et peut exposer une preview partielle calculee sur les seules lignes mappees
- `financial-statements-structured-v1` n'expose jamais d'etats structures partiels
- hors `PREVIEW_READY`, les etats structures restent `null`

## Comportement `ARCHIVED`

- lecture autorisee
- calcul inchange
- `nextAction.actionable = false` si l'action corrective serait bloquee par l'archivage

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

## RBAC GET financial-statements-structured

Lecture autorisee uniquement pour :

- `ACCOUNTANT`
- `REVIEWER`
- `MANAGER`
- `ADMIN`

## Audit

- zero `audit_event` en `200 / 400 / 401 / 403 / 404`
- ajouter une non-regression explicite prouvant que `GET financial-statements/structured` n'ecrit jamais dans `audit_event`, y compris via les services partages de resolution tenant/acteur

## Architecture

- module cible : `financials`
- dependances autorisees :
  - `identity::access`
  - `closing::access`
  - `mapping::access`
  - `controls::access`
  - `shared::application`
- `financials` ne parse jamais le YAML directement
- `financials` consomme une couture structuree exposee par `mapping::access`
- aucun appel HTTP interne
- aucun acces repository direct cross-module
- `ApplicationModules.verify()` reste vert

## DB et migrations

- aucune migration Flyway
- aucun changement de schema
- aucune nouvelle persistance

## Tests obligatoires

- `NO_DATA` => etats `null`
- `BLOCKED` => etats `null` + blockers/nextAction
- `PREVIEW_READY` V2 => sections justes
- `PREVIEW_READY` V1 legacy => fallback explicite, pas de fausse section
- mix V1/V2 => totaux justes et ordre stable
- calcul `currentPeriodResult` / `netResult` / totaux bilan et compte de resultat
- `ARCHIVED` lisible
- test canonique : mapping 100 % V2 et mapping mixte V1/V2 semantiquement equivalent => memes totaux de groupes et memes totaux d'etats
- PostgreSQL optionnel : mix V1/V2 sur vraie base, latest import only, ordre stable, zero audit

## Livrables

- spec active executable
- `contracts/openapi/financial-statements-structured-api.yaml`
- implementation backend dans `mapping` et `financials`
- tests unitaires
- tests API
- tests `dbIntegrationTest` pertinents
- verification Modulith
- aucune migration Flyway
- aucun nouveau contrat DB
