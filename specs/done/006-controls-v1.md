# Spec 006 — Controls V1

## Objectif

Livrer une capacité backend-only, read-only, déterministe et tenant-scoped qui répond à trois questions pour un closing :

- est-il prêt ;
- qu'est-ce qui bloque ;
- où agir ensuite.

## Source de vérité

Le read-model est strictement dérivé de :

- le dernier import de balance valide disponible pour le closing ;
- la projection du mapping manuel courant sur ce dernier import.

## In scope

- `GET /api/closing-folders/{closingFolderId}/controls`
- read-model pur dérivé, synchrone, sans persistance de résultat
- lecture autorisée sur closing `ARCHIVED`
- contrôle de présence du dernier import valide
- contrôle de complétude du mapping manuel sur le dernier import
- agrégat `READY | BLOCKED`
- `nextAction` canonique avec `path` fixe et `actionable`
- couture `mapping::access` réutilisable par `controls` et `mapping`
- tests unitaires, MockMvc, PostgreSQL optionnels et vérification Modulith
- contrat `contracts/openapi/controls-api.yaml`

## Out of scope

- tout `POST /run`
- toute persistance d'un résultat de contrôle
- toute nouvelle table ou migration Flyway
- GraphQL
- financial statements
- workpapers
- exports
- compliance riche
- IA, RAG, scoring
- taxonomie warning/blocker artificielle

## Contrôles V1

### 1. `LATEST_VALID_BALANCE_IMPORT_PRESENT`

- `PASS` si `latestImportVersion != null`
- `FAIL` sinon

### 2. `MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT`

- `NOT_APPLICABLE` si `latestImportVersion == null`
- `PASS` si `summary.unmapped == 0`
- `FAIL` sinon

### Agrégat

- `readiness = READY` si tous les blockers évalués sont `PASS`
- `readiness = BLOCKED` sinon

## Redondances explicitement exclues

- ne pas créer un contrôle autonome `import valide`
- ne pas créer un contrôle autonome `import équilibré`

Justification : la spec 003 ne persiste que des imports valides, et le schéma de persistance impose déjà l'équilibre des totaux.

## Règles métier

### Closing `ARCHIVED`

- lecture autorisée
- calcul inchangé
- `nextAction.actionable = false` si l'action corrective serait bloquée par l'archivage

### Aucun import

- HTTP `200`
- `readiness = BLOCKED`
- `latestImportPresent = false`
- `latestImportVersion = null`
- `mappingSummary = { total: 0, mapped: 0, unmapped: 0 }`
- `unmappedAccounts = []`
- `nextAction.code = IMPORT_BALANCE`

### Import présent + mapping incomplet

- HTTP `200`
- `readiness = BLOCKED`
- `unmappedAccounts` non vide
- `nextAction.code = COMPLETE_MANUAL_MAPPING`

### Import présent + mapping complet

- HTTP `200`
- `readiness = READY`
- `unmappedAccounts = []`
- `nextAction = null`

## Contrat API attendu

La réponse expose :

- `closingFolderId`
- `closingFolderStatus`
- `readiness`
- `latestImportPresent`
- `latestImportVersion`
- `mappingSummary { total, mapped, unmapped }`
- `unmappedAccounts[] { accountCode, accountLabel, debit, credit }`
- `controls[] { code, status, severity, message }`
- `nextAction { code, path, actionable }`

## Next actions figés

- `IMPORT_BALANCE -> /api/closing-folders/{closingFolderId}/imports/balance`
- `COMPLETE_MANUAL_MAPPING -> /api/closing-folders/{closingFolderId}/mappings/manual`

## Ordre de `unmappedAccounts`

L'ordre contractuel est `line_no asc`, via le chemin réel de relecture du snapshot d'import.

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

## RBAC GET controls

Lecture autorisée uniquement pour :

- `ACCOUNTANT`
- `REVIEWER`
- `MANAGER`
- `ADMIN`

## Audit

- zéro `audit_event` en `200 / 400 / 401 / 403 / 404`
- ajouter une non-régression explicite prouvant que `GET controls` n'écrit jamais dans `audit_event`, y compris via les services partagés de résolution tenant/acteur

## Architecture

- module cible : `controls`
- dépendances autorisées :
  - `identity::access`
  - `closing::access`
  - `mapping::access`
  - `shared::application`
- interdits :
  - appel HTTP interne vers le controller mapping
  - accès repository direct cross-module
  - couplage sauvage vers l'infrastructure d'un autre module

## Livrables

- implémentation code backend
- `contracts/openapi/controls-api.yaml`
- tests unitaires
- tests MockMvc
- tests `dbIntegrationTest` pertinents
- mises à jour Modulith et `package-info` nécessaires
- aucune migration Flyway
- aucun nouveau contrat DB
