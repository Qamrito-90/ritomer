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
- Le coeur produit livre reste closing, import, mapping manuel, mapping assiste no-provider, controls, financial previews, workpapers, document storage, verification reviewer de la preuve, export pack audit-ready, read-model backend REST d'annexe minimale et surfaces frontend de confiance E2E.
- `029` est une vague frontend livree sur les contrats REST existants. Elle ne cree aucun backend nouveau, aucun endpoint nouveau, aucun GraphQL, aucun microservice IA, aucune table, aucune migration DB et aucune nouvelle persistance.
- `030` livre une capacite REST-first de mapping assiste no-provider : read-model backend de suggestions, port `ai::access` minimise, adapter stub sans modele reel, contrat OpenAPI dedie, decision humaine idempotente et UI de revue humaine.
- `030f` ajoute une persistance tenant-scopee dediee a l'idempotence des decisions humaines de suggestion via `mapping_suggestion_decision_request`; cette table ne donne aucune autorite metier a l'IA.
- Apres `030`, les increments `032` a `035` durcissent les consumers et refreshs frontend sans modifier le backend, les contrats ou l'architecture ; `036` a `041` restent une demo et des preuves locales sur donnees synthetiques, pas une authentification SaaS durable ni un environnement partage.
- Le runtime local prouve une validation JWT, des utilisateurs synthetiques, memberships, roles, tenants et refus cross-tenant reels cote serveur. Il ne livre ni login OIDC durable, ni session, logout, revocation ou environnement interne partage.
- `042` reste en backlog sous `PAUSED_BY_SEPARATE_CPO_DECISION`; `043` reste terminalement close avec `STOPPED_INCONCLUSIVE`; `044` et `045` restent Done docs-only. Aucune spec n'est active et aucune spec `046` n'existe.
- Aucun provider IA reel, modele reel, SDK, prompt runtime actif, cout provider ou appel reseau IA n'est actif dans le present.
- Les artefacts `030d` et `042` restent des preuves historiques ou de backlog ; ils ne constituent pas le rail executable de la future implementation M2 et n'activent aucun provider.
- `workpapers` reste le module proprietaire pour la justification, les documents et leur verification reviewer ; `011` et `012` n'introduisent pas de module transverse `documents`.
- Le binaire documentaire est stocke en object storage prive ; le download V1 reste backend-only sans signed URL publique.
- `exports` est maintenant un module proprietaire distinct qui persiste un `export_pack` immutable, assemble un `ZIP` synchrone et deterministe, et telecharge ce pack via le backend uniquement.
- L'annexe minimale `027` est un read-model deterministe, tenant-scoped, operationnel non statutaire, non persiste, non exporte, sans IA, sans migration DB et sans `audit_event` sur `GET`.

## Trajectoire architecture approuvee, non livree

- M1 cible l'authentification, la session et le shell produit. Le mode local futur reste `LOCAL_TEST_ONLY`, remplace uniquement l'IdP externe et ne contourne ni memberships, ni roles, ni tenant-scoping, ni autorisations serveur ; tout environnement interne partage exige un vrai OIDC.
- M2 cible une provider gateway OpenAI-first derriere un port interne etroit, avec abstraction provider des le premier runtime. Un spike borne comparera Spring AI et le SDK Java officiel derriere ce meme port ; M0 ne choisit aucune dependance, aucun modele et aucun endpoint.
- M3 cible dans le monolithe un kernel agentique borne et un registre d'outils interne type, versionne, tenant-scoped, audite et MCP-adaptable. Les outils restent read-only par defaut et toute mutation passe par confirmation humaine puis commande metier deterministe.
- M4 cible le Mapping Assistant comme premier slice IA-native sur le kernel M3 ; il ne reprend pas le rail 042.
- La preparation MCP commence par les ports, schemas et le registre interne en M2/M3. Le runtime `Model Context Protocol` est cible en M6, client-first ; un serveur Ritomer n'est envisage que pour un besoin de client externe reel et prouve.
- Cette trajectoire n'introduit dans M0 ni nouveau module runtime, ni microservice, ni GraphQL, ni RLS generalisee, ni nouveau deploiement.

## Ce qui est explicitement hors scope maintenant

- GraphQL actif dans le runtime courant
- microservices introduits par confort theorique
- service IA dedie obligatoire dans la V1 courante
- provider IA runtime, modele reel, SDK provider, prompt runtime actif ou appel reseau IA pour le mapping assiste courant
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
- `docs/product/product-roadmap.md`
- `docs/product/v1-plan.md`
- `runbooks/local-dev.md`
- `specs/done/002-core-identity-tenancy-closing.md`
- `specs/done/003-import-balance-v1.md`
- `specs/done/005-manual-mapping-v1.md`
- `specs/done/006-controls-v1.md`
- `specs/done/007-financial-summary-v1.md`
- `specs/done/018-frontend-financial-summary-preview-v1.md`
- `specs/done/019-frontend-financial-statements-structured-preview-v1.md`
- `specs/done/020-frontend-workpapers-read-model-v1.md`
- `specs/done/021-frontend-workpapers-maker-update-v1.md`
- `specs/done/022-frontend-document-upload-only-v1.md`
- `specs/done/023-frontend-document-download-only-v1.md`
- `specs/done/024-frontend-workpapers-panel-extraction-v1.md`
- `specs/done/025-frontend-document-verification-decision-only-v1.md`
- `specs/done/026-frontend-workpapers-panel-decomposition-v1.md`
- `specs/done/027-annexe-minimale-v1.md`
- `specs/done/028-docs-present-realignment-after-027-v1.md`
- `specs/done/029-pilot-closing-workflow-e2e-confidence-hardening-v1.md`
- `specs/done/030-ia-mapping-assiste-suggestion-review-v1.md`
- `specs/done/032-controls-readiness-deterministic-consumer-hardening-v1.md`
- `specs/done/033-pilot-core-flow-ui-refresh-consistency-v1.md`
- `specs/done/034-pilot-balance-import-history-diff-ui-v1.md`
- `specs/done/035-pilot-export-pack-minimal-annex-refresh-ui-v1.md`
- `specs/done/036-local-integrated-demo-real-backend-seed-v1.md`
- `specs/done/037-local-integrated-demo-manual-business-smoke-v1.md`
- `specs/done/038-local-demo-closing-workbench-ux-cockpit-v1.md`
- `specs/done/039-local-demo-data-heavy-ux-polish-v1.md`
- `specs/done/040-internal-poc-global-smoke-v1.md`
- `specs/done/041-internal-poc-blockers-ux-readiness-v1.md`
- `specs/backlog/042-controlled-ai-mapping-runtime-pilot-v1.md`
- `specs/done/043-controlled-fiduciary-pilot-readiness-v1.md`
- `specs/done/044-design-partner-readiness-v1.md`
- `specs/done/045-design-partner-research-protocol-v1.md`
- `specs/done/008-financial-rubric-taxonomy-v2.md`
- `specs/done/009-financial-statements-structured-v1.md`
- `specs/done/010-workpapers-v1.md`
- `specs/done/011-document-storage-and-evidence-files-v1.md`
- `specs/done/012-evidence-review-and-verification-v1.md`
- `specs/done/013-exports-audit-ready-v1.md`
- `contracts/db/*`
- `contracts/openapi/minimal-annex-api.yaml`
- `contracts/openapi/mapping-suggestions-api.yaml`
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

Le Word `2.3` est un snapshot de cadrage. Il s'arrete avant les specs closes `006` a `013` et ne reflete plus la verite actuelle sur `controls`, `financial-summary`, `financial-statements-structured`, `workpapers`, `document-storage-and-evidence-files`, `evidence-review-and-verification`, `exports-audit-ready`, `minimal-annex`, les surfaces frontend E2E livrees par `029` et le mapping assiste no-provider livre par `030`.

## Note de precedence

En cas d'ecart, le markdown canonique du repo prime sur le Word de reference.
