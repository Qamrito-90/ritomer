# Spec 008 — Financial Rubric Taxonomy V2

## Objectif

Enrichir la taxonomie de mapping pour préparer des restitutions financières plus structurées, sans casser :

- les imports existants ;
- le mapping manuel existant ;
- `controls-v1` ;
- `financial-summary-v1` ;
- la discipline multi-tenant, audit et Modulith.

## Source de vérité

- `AGENTS.md`
- `docs/adr/0001-monolithe-modulaire.md`
- `docs/adr/0002-rest-first-graphql-later.md`
- `docs/adr/0004-multi-tenancy-audit-rls-progressive.md`
- `docs/adr/0006-postgresql-cloud-sql-no-docker-v1.md`
- `docs/vision/architecture.md`
- `specs/done/005-manual-mapping-v1.md`
- `specs/active/006-controls-v1.md`
- `specs/done/007-financial-summary-v1.md`
- `contracts/reference/manual-mapping-targets-v1.yaml`
- `contracts/reference/manual-mapping-targets-v2.yaml`
- `contracts/openapi/manual-mapping-api.yaml`

## In scope

- création d’un référentiel versionné `manual-mapping-targets-v2.yaml`
- conservation du référentiel V1 intact à des fins historiques et de compatibilité
- validation fail-fast de l’intégrité du référentiel V2 au démarrage
- exposition additive de `taxonomyVersion` et des métadonnées de taxonomie au `GET` manual mapping
- acceptation au write des codes legacy V1 et des nouvelles cibles V2 sélectionnables
- rejet au write des codes inconnus ou non sélectionnables
- exposition de la sémantique utile via `mapping::access`
- refactor de `financial-summary-v1` pour agréger via `summaryBucketCode`
- non-régressions unitaires, API, PostgreSQL optionnelles et Modulith

## Out of scope

- nouveaux états financiers détaillés
- exports, PDF, annexe, workpapers
- GraphQL
- IA active
- nouvelle persistance métier
- nouvelle table ou migration Flyway
- remapping automatique historique
- frontend riche

## Décisions de design figées

- la taxonomie est versionnée au niveau du référentiel, pas au niveau des lignes en base
- `manual_mapping.target_code` reste inchangé
- aucune colonne `taxonomy_version`
- aucune migration Flyway
- coexistence V1 / V2 obligatoire
- les codes V1 restent lisibles, projetables et acceptés
- les codes V1 sont `deprecated = true`
- aucun code publié ne change de sens

## Modèle taxonomique attendu

Chaque target V2 porte au minimum :

- `code`
- `label`
- `statement`
- `summaryBucketCode`
- `sectionCode`
- `normalSide`
- `granularity`
- `deprecated`
- `selectable`
- `displayOrder`

## Règles d’intégrité

- unicité des `code`
- `summaryBucketCode` obligatoire pour chaque code
- `summaryBucketCode` doit référencer un code publié existant
- `sectionCode` doit référencer un code publié existant
- ordre déterministe par `displayOrder`, puis `code`
- seuls les codes feuilles sélectionnables sont acceptés au write
- un code non sélectionnable est rejeté au write
- le catalogue V2 doit rester compatible avec les codes legacy V1 publiés
- démarrage en échec si le référentiel est incohérent

## Compatibilité attendue

- `controls-v1` reste fonctionnellement inchangé
- `financial-summary-v1` garde exactement le même contrat HTTP
- un mapping legacy V1 et un mapping V2 détaillé équivalent doivent produire la même sortie `financial-summary`
- aucun module aval ne recharge ni ne parse directement le YAML

## Architecture

- propriétaire de la taxonomie : module `mapping`
- sémantique aval exposée uniquement via `mapping::access`
- aucun appel HTTP interne
- aucun accès repository direct cross-module
- `ApplicationModules.verify()` reste vert

## Sécurité, tenancy, audit

- tenant-scoping inchangé
- zéro fuite cross-tenant
- `GET manual-mapping`, `GET controls` et `GET financial-summary` n’écrivent jamais dans `audit_event`
- audit inchangé sur `PUT` / `DELETE` manual mapping

## Livrables

- `contracts/reference/manual-mapping-targets-v2.yaml`
- mise à jour additive de `contracts/openapi/manual-mapping-api.yaml`
- implémentation backend dans `mapping` et `financials`
- tests unitaires
- tests API / intégration
- tests PostgreSQL optionnels pertinents
- vérification Modulith
