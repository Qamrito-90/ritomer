# Spec 007 — Financial Summary V1

## Objectif

Livrer une capacité backend-only, read-only, déterministe et tenant-scoped qui expose une preview financière ultra-synthétique pour un closing.

La restitution est explicitement :

- ultra-synthétique ;
- non statutaire ;
- non export final ;
- non conforme à une présentation CO détaillée.

## Source de vérité

Le read-model est strictement dérivé de :

- le dernier import de balance disponible pour le closing ;
- la projection du mapping manuel courant sur ce dernier import ;
- la readiness existante réutilisée via `controls::access`.

## In scope

- `GET /api/closing-folders/{closingFolderId}/financial-summary`
- read-model pur dérivé, synchrone, sans persistance de résultat
- lecture autorisée sur closing `ARCHIVED`
- réutilisation de `controls::access` pour `readiness`, `blockers` et `nextAction`
- calcul des montants sur les seules lignes mappées
- métriques de couverture obligatoires
- impact non mappé obligatoire
- contrat `contracts/openapi/financial-summary-api.yaml`
- tests unitaires, MockMvc, PostgreSQL optionnels et vérification Modulith

## Out of scope

- tout `POST /run`
- toute persistance d'un résultat ou snapshot
- toute nouvelle table ou migration Flyway
- GraphQL
- états financiers détaillés
- exports, PDF, annexe, workpapers
- IA, RAG, taxonomie enrichie

## États métier

### `NO_DATA`

- aucun import disponible
- `balanceSheetSummary = null`
- `incomeStatementSummary = null`
- `coverage = { totalLines: 0, mappedLines: 0, unmappedLines: 0, mappedShare: 0 }`
- `unmappedBalanceImpact = { debitTotal: 0, creditTotal: 0, netDebitMinusCredit: 0 }`
- blockers visibles
- `nextAction.code = IMPORT_BALANCE`

### `PREVIEW_PARTIAL`

- import présent mais mapping incomplet
- calcul des montants sur les seules lignes mappées
- blockers visibles
- `nextAction.code = COMPLETE_MANUAL_MAPPING`
- `coverage` obligatoire
- `unmappedBalanceImpact` obligatoire
- un éventuel écart entre `totalAssets` et `totalLiabilitiesAndEquity` n'est pas une erreur système

### `PREVIEW_READY`

- import présent et mapping complet
- calcul sur 100 % des lignes
- `mappedShare = 1`
- `unmappedBalanceImpact = 0`
- `blockers = []`
- `nextAction = null`

## Restitution à exposer

### `balanceSheetSummary`

- `assets`
- `liabilities`
- `equity`
- `currentPeriodResult`
- `totalAssets`
- `totalLiabilitiesAndEquity`

### `incomeStatementSummary`

- `revenue`
- `expenses`
- `netResult`

## Conventions de calcul

- `ASSET` et `EXPENSE` = `debit - credit`
- `LIABILITY`, `EQUITY`, `REVENUE` = `credit - debit`

## Métriques obligatoires

### `coverage`

- `totalLines`
- `mappedLines`
- `unmappedLines`
- `mappedShare`

### `unmappedBalanceImpact`

- `debitTotal`
- `creditTotal`
- `netDebitMinusCredit`

## Contrat API attendu

La réponse expose :

- `closingFolderId`
- `closingFolderStatus`
- `readiness`
- `statementState`
- `latestImportVersion`
- `coverage`
- `blockers[]`
- `nextAction`
- `unmappedBalanceImpact`
- `balanceSheetSummary`
- `incomeStatementSummary`

## Lisibilité obligatoire

Le payload doit toujours rendre explicite :

- le niveau de préparation ;
- ce qui manque encore ;
- ce qui bloque ;
- où agir ensuite.

## Comportement `ARCHIVED`

- lecture autorisée
- calcul inchangé
- `nextAction.actionable = false` si l'action corrective serait bloquée par l'archivage

## Sécurité et tenancy

- `X-Tenant-Id` absent => `400`
- `X-Tenant-Id` vide => `400`
- `X-Tenant-Id` mal formé => `400`
- `closingFolderId` invalide => `400`
- non authentifié => `401`
- tenant inaccessible => `403`
- membership inactive => `403`
- tenant inactive => `403`
- rôle insuffisant => `403`
- closing absent => `404`
- closing hors tenant => `404`
- aucune fuite cross-tenant

## RBAC GET financial-summary

Lecture autorisée uniquement pour :

- `ACCOUNTANT`
- `REVIEWER`
- `MANAGER`
- `ADMIN`

## Audit

- zéro `audit_event` en `200 / 400 / 401 / 403 / 404`
- ajouter une non-régression explicite prouvant que `GET financial-summary` n'écrit jamais dans `audit_event`, y compris via les services partagés de résolution tenant/acteur

## Architecture

- module cible : `financials`
- dépendances autorisées :
  - `identity::access`
  - `closing::access`
  - `mapping::access`
  - `controls::access`
  - `shared::application`
- interdits :
  - appel HTTP interne
  - accès repository direct cross-module
  - duplication sauvage de la logique controls

## Livrables

- implémentation code backend
- `contracts/openapi/financial-summary-api.yaml`
- tests unitaires
- tests MockMvc
- tests `dbIntegrationTest` pertinents
- mises à jour Modulith et `package-info` nécessaires
- aucune migration Flyway
- aucun nouveau contrat DB
