# Architecture Cadrage V1

## Role du document

Ce document est la synthese canonique de la verite architecture du present pour la V1 executable.

Il ne remplace ni les ADRs, ni les specs, ni les contrats, ni les runbooks. Il fixe le cadre executable courant et renvoie vers les artefacts de detail du repo vivant.

## Ce qui est vrai maintenant

- Le produit s'execute dans un monolithe modulaire Kotlin / Spring Boot.
- Les frontieres de modules sont strictes et verifiees.
- L'API publique V1 reste REST-first.
- Les endpoints canoniques restent sous `/api/closing-folders/...`.
- PostgreSQL est la base principale ; Flyway est la source de verite du schema.
- La cible de production V1 est Google Cloud, Cloud Run depuis le code source, en `europe-west6`, avec Cloud SQL for PostgreSQL 17 Enterprise en HA regional / Private IP.
- Le developpement local et la suite nominale de tests ne requierent ni Docker, ni Docker Compose, ni Testcontainers.
- `./gradlew test` reste le rail nominal sans PostgreSQL reel ; `dbIntegrationTest` reste opt-in avec configuration explicite.
- Le multi-tenant est applique par `tenant_id` partout, avec scoping applicatif d'abord et RLS progressive ensuite.
- L'audit est append-only sur les mutations metier significatives ; les lectures closes en `GET` sur les read-models actuels n'ecrivent pas d'audit.
- Les capacites closes du present vont jusqu'a `013` : closing, import, mapping, controls, financial previews, workpapers, document storage, verification reviewer de la preuve et export pack audit-ready.
- `workpapers` reste le module proprietaire pour la justification, les documents et leur verification reviewer ; `011` et `012` n'introduisent pas de module transverse `documents`.
- Le binaire documentaire est stocke en object storage prive ; le download V1 reste backend-only sans signed URL publique.
- `exports` est maintenant un module proprietaire distinct qui persiste un `export_pack` immutable, assemble un `ZIP` synchrone et deterministe, et telecharge ce pack via le backend uniquement.

## Ce qui est explicitement hors scope maintenant

- GraphQL actif dans le runtime courant
- microservices introduits par confort theorique
- service IA dedie obligatoire dans la V1 courante
- Docker local obligatoire pour le developpement nominal
- Testcontainers comme prerequis du flux par defaut
- RLS generalisee sur toutes les tables tout de suite
- acces cross-module par repository direct
- modification des anciennes migrations Flyway
- signed URLs publiques et module transverse `documents`

## Decisions non negotiables du present

- Le monolithe modulaire reste la forme cible de la V1.
- Les interactions inter-modules passent par des interfaces explicites ou des evenements applicatifs.
- Le domaine reste pur ; l'infrastructure depend du domaine, jamais l'inverse.
- Toute table metier tenant-scopee porte `tenant_id`.
- Aucun repository ne contourne le scoping tenant.
- Toute migration Flyway posee est immutable ; tout changement de schema passe par une nouvelle migration.
- Les choix d'architecture doivent rester compatibles avec Cloud Run, Cloud SQL et le no-Docker local.
- Les read-models du present restent synchrones, derives et sans persistance de resultat quand les specs le disent.

## Artefacts vivants detailles du repo

- `docs/adr/0001-monolithe-modulaire.md`
- `docs/adr/0002-rest-first-graphql-later.md`
- `docs/adr/0003-ai-gateway-evidence-first.md`
- `docs/adr/0004-multi-tenancy-audit-rls-progressive.md`
- `docs/adr/0005-front-ui-stack-and-design-system.md`
- `docs/adr/0006-postgresql-cloud-sql-no-docker-v1.md`
- `docs/product/v1-plan.md`
- `runbooks/local-dev.md`
- `specs/done/002-core-identity-tenancy-closing.md`
- `specs/done/003-import-balance-v1.md`
- `specs/done/005-manual-mapping-v1.md`
- `specs/done/006-controls-v1.md`
- `specs/done/007-financial-summary-v1.md`
- `specs/done/008-financial-rubric-taxonomy-v2.md`
- `specs/done/009-financial-statements-structured-v1.md`
- `specs/done/010-workpapers-v1.md`
- `specs/done/011-document-storage-and-evidence-files-v1.md`
- `specs/done/012-evidence-review-and-verification-v1.md`
- `specs/done/013-exports-audit-ready-v1.md`
- `contracts/db/*`
- `contracts/openapi/*`

## Regle de maintenance

Mettre a jour ce document seulement si la verite architecture du present change reellement, par exemple :

- changement de runtime ou de cible plateforme
- changement de forme d'API active
- changement durable des frontieres de modules
- changement durable des regles tenancy / audit / storage / migrations
- sortie d'un hors-scope devenu reellement actif

Ne pas y recopier le detail des specs ni des ADRs.

## References Word sources utilisees

- `docs/reference-word/2.3-Architecture-Cadrage-V1.docx`

Le Word `2.3` est un snapshot de cadrage. Il s'arrete avant les specs closes `006` a `013` et ne reflete plus la verite actuelle sur `controls`, `financial-summary`, `financial-statements-structured`, `workpapers`, `document-storage-and-evidence-files`, `evidence-review-and-verification` et `exports-audit-ready`.

## Note de precedence

En cas d'ecart, le markdown canonique du repo prime sur le Word de reference.
