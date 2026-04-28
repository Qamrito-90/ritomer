# 028 - Docs present realignment after 027 v1

## Status
Active

## Phase
IMPLEMENTATION

## Risk
B

## Surface
DOCS_ONLY

## Role de cette spec

Cette spec devient la verite normative de `028`.

Elle borne un realignement documentaire cible apres la fermeture de `027-annexe-minimale-v1`, sans creer de nouvelle capacite produit, sans changer le runtime et sans rouvrir `027`.

L'objectif est de corriger les formulations datees dans les documents canoniques du present UX et IA pour qu'ils restent compatibles avec l'etat du repo : specs `001` a `027` livrees, `027` portant une annexe minimale backend deterministe, tenant-scoped, non statutaire, non persistee, non exportee, sans IA et sans `audit_event` sur `GET`.

## Sources de verite relues

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ai-cadrage-v1.md`
- `docs/adr/0001-monolithe-modulaire.md`
- `docs/adr/0002-rest-first-graphql-later.md`
- `docs/adr/0003-ai-gateway-evidence-first.md`
- `docs/adr/0004-multi-tenancy-audit-rls-progressive.md`
- `docs/adr/0005-front-ui-stack-and-design-system.md`
- `docs/adr/0006-postgresql-cloud-sql-no-docker-v1.md`
- `docs/product/v1-plan.md`
- `specs/done/027-annexe-minimale-v1.md`
- `docs/ui/ui-foundations-v1.md`
- `README.md`
- `docs/vision/ux.md`
- `docs/vision/architecture.md`
- `docs/vision/ai-native.md`
- `docs/playbooks/ux.md`
- `docs/playbooks/architecture.md`
- `docs/playbooks/ai.md`

## Contexte repo prouve

- `specs/active/` etait vide avant ouverture de `028`.
- `docs/product/v1-plan.md` liste `001` a `027` comme livres.
- `027-annexe-minimale-v1` est fermee documentalement dans `specs/done/027-annexe-minimale-v1.md`.
- `027` livre `GET /api/closing-folders/{closingFolderId}/minimal-annex`.
- `027` est backend-only pour son premier slice et ne cree aucune UI annexe minimale.
- `docs/present/architecture-cadrage-v1.md` est deja aligne avec `027` et reste hors modification pour `028`.
- `docs/present/ux-cadrage-v1.md` contient une formulation datee bornant la verite UX aux capacites closes jusqu'a `025`.
- `docs/present/ai-cadrage-v1.md` contient une formulation datee bornant le present IA aux specs closes jusqu'a `013`.

## Decisions fermees

- `028` est une PR docs-only unique : elle cree cette spec active et applique le realignement documentaire cible.
- `028` ne rouvre pas `027`.
- `028` ne deplace aucun fichier vers `specs/done/`.
- `028` ne declare aucune spec produit suivante comme active.
- `028` conserve que `001` a `027` sont livres.
- `028` distingue les surfaces UX visibles/frontend closes jusqu'a `025` du repo vivant, qui porte des capacites backend-documentaires closes jusqu'a `027`.
- `028` conserve explicitement que `minimal-annex-v1` n'est pas une UX visible/frontend dans le present.
- `028` aligne le cadrage IA sur l'etat clos jusqu'a `027` tout en conservant `AI-ready / not AI-led`.
- `028` n'annonce aucune IA structurante dans le runtime courant.
- `028` garde le mapping assiste comme candidat futur, pas comme implementation runtime active.

## In scope exact

- creer `specs/active/028-docs-present-realignment-after-027-v1.md`
- declarer `028` comme active dans `docs/product/v1-plan.md`
- corriger la formulation datee de `docs/present/ux-cadrage-v1.md`
- corriger la formulation datee de `docs/present/ai-cadrage-v1.md`

## Out of scope exact

- toute modification backend
- toute modification frontend
- toute modification de contrat OpenAPI
- toute migration DB
- toute modification de workflow CI
- toute modification de runbook
- toute modification de `docs/present/architecture-cadrage-v1.md`
- toute modification de `specs/done/*`
- toute capacite produit nouvelle
- toute UI annexe minimale
- toute presentation de `minimal-annex-v1` comme UX visible
- GraphQL
- IA runtime active
- microservice IA obligatoire
- flux metier pilote par modele
- commit ou push

## Fichiers autorises

- `specs/active/028-docs-present-realignment-after-027-v1.md`
- `docs/product/v1-plan.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/ai-cadrage-v1.md`

## Fichiers explicitement interdits

- `specs/done/*`
- `docs/present/architecture-cadrage-v1.md`
- `contracts/*`
- `backend/*`
- `frontend/*`
- `runbooks/*`
- `.github/*`

## Checks docs/git attendus

- `git status --short --branch`
- `git diff --name-status`
- `git diff --stat`
- `git diff --check`
- `git diff --name-only -- backend frontend contracts .github runbooks`
- `git diff --name-only -- specs/done docs/present/architecture-cadrage-v1.md`

## Tests runtime

Aucun test runtime backend ou frontend ne doit etre lance pour `028`, car la surface est `DOCS_ONLY` et les fichiers runtime sont hors scope.

## Criteres d'acceptation

- `specs/active/028-docs-present-realignment-after-027-v1.md` existe avec `Status: Active`.
- `docs/product/v1-plan.md` declare `028` comme active.
- `docs/product/v1-plan.md` conserve `001` a `027` comme livres.
- `docs/product/v1-plan.md` ne rouvre pas `027` et ne declare aucune spec produit suivante.
- `docs/present/ux-cadrage-v1.md` distingue UX visible/frontend closes jusqu'a `025` et repo/capacites backend-documentaires closes jusqu'a `027`.
- `docs/present/ux-cadrage-v1.md` conserve que `minimal-annex-v1` n'est pas une UX visible/frontend.
- `docs/present/ai-cadrage-v1.md` est compatible avec l'etat clos jusqu'a `027`.
- `docs/present/ai-cadrage-v1.md` conserve `AI-ready / not AI-led`.
- `docs/present/ai-cadrage-v1.md` n'annonce aucune IA runtime active, aucun microservice IA obligatoire, aucun flux metier pilote par modele.
- `docs/present/architecture-cadrage-v1.md` reste inchange.
- Aucun fichier `backend/**`, `frontend/**`, `contracts/**`, `.github/**`, `runbooks/**` ou `specs/done/**` n'est modifie.
- Aucune nouvelle capacite produit n'est creee.
