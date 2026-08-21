# Ritomer — plateforme suisse de closing comptable IA-native

Ritomer construit un SaaS suisse de production du closing fiduciaire, multi-tenant, evidence-first et auditable, avec une UX premium claire sous pression. Le produit authentifié prime sur le site public et le métier garde le contrôle de toute décision engageante.

## Lecture canonique

`AGENTS.md` définit l'ordre de lecture et les règles permanentes. La gouvernance active du développement assisté par IA est indexée dans `docs/governance/ai-first/README.md`.

- roadmap produit canonique : `docs/product/product-roadmap.md` ;
- séquence exécutable : `docs/product/v1-plan.md` ;
- synthèse du présent : `docs/present/README.md` ;
- vérité UI durable : `docs/ui/ui-foundations-v1.md`.

## North Star et état réel

Le parcours cible est : utilisateur authentifié → tenant et rôle → dossier → objectif borné → outils et preuves → proposition → décision humaine → commande métier déterministe → vérification et audit.

| Statut | État actuel |
| --- | --- |
| `DELIVERED_AND_PROVED` | Noyau déterministe du closing, tenancy et RBAC applicatifs, import, mapping manuel, contrôles, previews, workpapers, documents, export, annexe minimale, audit append-only et mapping assisté no-provider. |
| `LOCAL_OR_SYNTHETIC_ONLY` | Démo PostgreSQL/JWT/Vite, shell courant et simulation offline `mapping-suggestion-v2`, avec identités et données synthétiques. |
| `DOCUMENTED_NOT_IMPLEMENTED` | Auth/session SaaS durables, cible Cloud Run/Cloud SQL, provider IA réel, gateway provider générale, tracing IA et MCP. |
| `NOT_STARTED` | Runtime agentique goal/run/tools, site public, bêta externe et production opérable. |

`DELIVERED_AND_PROVED` décrit des preuves du repo ; il ne signifie ni SaaS partagé, ni production, ni validation professionnelle. Ritomer est actuellement AI-ready, sans provider réel ni runtime agentique.

## Roadmap canonique résumée

La définition détaillée, les gates et estimations relatives vivent dans `docs/product/product-roadmap.md`.

```text
M0=CANONICAL_ROADMAP_REBASELINE
M1=AUTHENTICATED_PRODUCT_SHELL
M2=AI_RUNTIME_CORE
M3=AGENTIC_KERNEL_V1
M4=MAPPING_ASSISTANT_AGENT
M5=INTERNAL_ALPHA_HARDENING
M6=MCP_AND_MULTI_PROVIDER
M7=PUBLIC_WEBSITE_AND_GTM_READINESS
M8=EXTERNAL_BETA_AND_PRODUCTION_READINESS

CRITICAL_PATH=M0_TO_M5
FIRST_AI_NATIVE_VERTICAL_SLICE=MAPPING_ASSISTANT_AGENT
```

M6 reste hors chemin critique. Le site M7 vient après une alpha interne M5 stable et avant la bêta externe M8.

## Décisions structurantes

### Authentification M1

```text
AUTHENTICATION_SEQUENCE=M1_EARLY
LOCAL_DEV_AUTH_MODE=LOCAL_TEST_ONLY
LOCAL_DEV_AUTH_REPLACES_EXTERNAL_IDP_ONLY=YES
LOCAL_DEV_AUTHORIZATION_BYPASS=NO
LOCAL_DEV_MUST_USE_REAL_SYNTHETIC_USERS_MEMBERSHIPS_ROLES_AND_TENANTS=YES
SHARED_INTERNAL_ENVIRONMENT_REQUIRES_REAL_OIDC=YES
```

Le mode local futur simplifie l'entrée seulement. Il ne contourne jamais les memberships, rôles, contrôles serveur ou l'isolation tenant et n'est pas encore livré.

### IA, agent et MCP

```text
OPENAI_FIRST=YES
PROVIDER_ABSTRACTION_FROM_DAY_ONE=YES
ONE_BOUNDED_AGENT_FIRST=YES
MULTI_AGENT_SWARM_NOW=NO
READ_ONLY_TOOLS_BY_DEFAULT=YES
HUMAN_CONFIRMATION_BEFORE_MUTATION=YES
DIRECT_MODEL_DATABASE_ACCESS=NO

MCP_STRATEGIC_PRIORITY=CONFIRMED
MCP_READINESS_FROM_M2_M3=YES
MCP_RUNTIME_TARGET=M6
MCP_CLIENT_FIRST=YES
MCP_SERVER_ONLY_ON_PROVED_EXTERNAL_CLIENT_NEED=YES
```

MCP signifie `Model Context Protocol`. M0 ne choisit aucune dépendance, n'active aucun provider et n'exécute aucun runtime IA ou MCP.

### Site public

```text
PRODUCT_FIRST=YES
PUBLIC_WEBSITE_AFTER_STABLE_INTERNAL_ALPHA=YES
PUBLIC_WEBSITE_BEFORE_EXTERNAL_BETA=YES
```

Le site M7 attend une alpha stable, des captures produit réelles, un slice IA-native fonctionnel, un positionnement stable, des formulations sécurité honnêtes et un chemin de démo répétable.

## Invariants techniques V1

- monolithe modulaire Kotlin/Spring Boot ;
- PostgreSQL et cible Cloud SQL for PostgreSQL ;
- cible plateforme Google Cloud / Cloud Run en `europe-west6` ;
- multi-tenancy stricte et audit append-only ;
- REST first ; GraphQL seulement si un coût réel de composition frontend le justifie ;
- sorties IA structurées, preuves, evals, observabilité, feature flags et mode dégradé.

## Principes d'exécution backend
- le backend reste PostgreSQL-first avec Flyway
- la cible de production est Cloud SQL for PostgreSQL
- la cible plateforme V1 est Google Cloud, Cloud Run depuis le code source, prod en `europe-west6`
- le développement local ne requiert ni Docker, ni Docker Compose, ni Testcontainers
- `cd backend && ./gradlew test` doit rester exécutable sans Docker ni base PostgreSQL
- les tests PostgreSQL réels sont opt-in via `cd backend && ./gradlew dbIntegrationTest`
- référence décisionnelle : `docs/adr/0006-postgresql-cloud-sql-no-docker-v1.md`

## Démarrage backend (Spec 001)

Depuis la racine du repo :

- `cd backend && ./gradlew test`
- `cd backend && ./gradlew dbIntegrationTest` avec configuration PostgreSQL explicite
- `cd backend && ./gradlew build`
- `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'`
- détails de démarrage local : `runbooks/local-dev.md`

Variables d’environnement locales minimales :

- `RITOMER_SECURITY_JWT_HMAC_SECRET` doit être fournie au runtime, sans fallback, avec une valeur CSPRNG locale d'au moins 32 octets UTF-8 ;
- `SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/ritomer`
- `SPRING_DATASOURCE_USERNAME=ritomer`
- `SPRING_DATASOURCE_PASSWORD` doit déjà exister dans le shell local ;
- `RITOMER_DB_TESTS_ENABLED=true` pour lancer les tests PostgreSQL optionnels
- `RITOMER_DB_TEST_JDBC_URL`, `RITOMER_DB_TEST_USERNAME`, `RITOMER_DB_TEST_PASSWORD` pour une cible locale dédiée ; voir `runbooks/local-dev.md`
- voir aussi `backend/.env.example`

Ne créer aucun fichier `.env` et ne demander ni à Codex ni à un autre outil de lire la valeur HMAC. Exemple PowerShell pour produire 32 octets CSPRNG directement dans le processus, sans afficher ni stocker la valeur :

```powershell
$jwtKeyBytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($jwtKeyBytes)
$env:RITOMER_SECURITY_JWT_HMAC_SECRET = [Convert]::ToBase64String($jwtKeyBytes)
[Array]::Clear($jwtKeyBytes, 0, $jwtKeyBytes.Length)
```

## État de séquencement et historique

```text
M0_STATUS=DONE_CANONICAL_ROADMAP_REBASELINE
NEXT_MILESTONE=M1_AUTHENTICATED_PRODUCT_SHELL
ACTIVE_SPEC=AUCUNE
ACTIVE_SPEC_COUNT=0
SPEC_046=ABSENT
M1_IMPLEMENTATION_AUTHORIZED=NO

042=BACKLOG_OR_HISTORICAL_NOT_EXECUTABLE_AS_CURRENT_RAIL
043=TERMINALLY_CLOSED_STOPPED_INCONCLUSIVE
043C_R1_R2=NOT_EXECUTED
043C_MUST_NOT_RESUME=YES
PR114=FORENSIC_ONLY
044=DONE_DOCS_ONLY
045=DONE_DOCS_ONLY
EXTERNAL_ACTIVITY_READINESS=NO
X_01_STATUS=BLOCKING_EXTERNAL_ACTIVITY
```

La [spec 042](specs/backlog/042-controlled-ai-mapping-runtime-pilot-v1.md) reste en backlog et n'est pas le rail exécutable de la roadmap actuelle. Ses artefacts historiques utiles restent disponibles, mais aucun ancien candidat provider, retry ou gate ne vaut activation M2.

La [spec 043 terminale](specs/done/043-controlled-fiduciary-pilot-readiness-v1.md) conserve les preuves : 043a demeure livré, 043b demeure une simulation locale synthétique validée et 043c s'est arrêté avec un résultat inconclusif. R1/R2 n'ont pas été exécutés, PR #114 reste forensique et la clôture 043 n'a émis aucune autorisation suivante.

La [spec 044](specs/done/044-design-partner-readiness-v1.md) et la [spec 045](specs/done/045-design-partner-research-protocol-v1.md) sont `DONE_DOCS_ONLY`. Elles ne prouvent ni recrutement, ni valeur terrain, ni readiness externe et n'autorisent aucune publication, prospection, interview, collecte, donnée réelle ou activité externe.

M0 ne crée, ne réserve et n'autorise aucune spec 046 ni aucune spec future. M1 reste une prochaine cible documentaire qui exigera son propre scope, ses gates et une autorisation d'implémentation distincte.

### Snapshot historique 043b pré-clôture

Le bloc suivant est conservé comme preuve historique uniquement. Ses statuts, commandes et recettes ne constituent aucune instruction courante et ne doivent pas être repris ou exécutés au titre de 043.

<!-- README_043_HISTORICAL_BEGIN -->
## Posture locale 043b

043b is a local single-operator two-role simulation.
It validates backend RBAC behavior under two synthetic identities.
It does not establish independent human sessions or segregation of duties.

043b est une simulation locale mono-opérateur de deux rôles.
Elle valide le comportement RBAC du backend sous deux identités synthétiques.
Elle n'établit ni deux sessions humaines indépendantes ni une séparation des fonctions.

Statut courant : `LOCAL_SYNTHETIC_SIMULATION_VALIDATED / MERGED / AI_REVIEWED / OWNER_RISK_ACCEPTED_FOR_LOCAL_SYNTHETIC_ONLY / NOT_HUMAN_SIGNED / NOT_PRODUCTION_READY / NOT_EXTERNAL_READY / NOT_SEPARATION_OF_DUTIES_PROOF`. La simulation reste `LOCAL_TWO_ROLE_SIMULATION / SINGLE_OPERATOR_CAPABLE / SYNTHETIC_ONLY / LOOPBACK_ONLY / NOT_PRODUCTION_AUTH / NOT_INDEPENDENT_ACTOR_BOUNDARY / NOT_PROOF_OF_SEGREGATION_OF_DUTIES / NOT_FOR_EXTERNAL_USE / NOT_FOR_REAL_DATA`. Les ports `5173` et `5174` restent deux contextes visuels, jamais une frontière d'identité.

Clôture factuelle du `2026-07-27` : preuves PostgreSQL dédiées, smoke local deux acteurs, contrôle navigateur sans exposition d'un header d'authentification ni JWT détecté dans les surfaces navigateur, Backend CI, Frontend CI, cleanup, merge de la PR `#103` et vérification post-merge : `PASS`.

`043c simplified rehearsal defined; execution not authorized; R1/R2 not started`.

Les tests PostgreSQL destructifs utilisent exclusivement `jdbc:postgresql://127.0.0.1:5432/ritomer_043b_test` avec le rôle `ritomer_043b_test_runner`, sur un PostgreSQL local direct et des données synthétiques. Cloud SQL Proxy, tunnel SSH et port forward sont interdits pour cette preuve.
<!-- README_043_HISTORICAL_END -->
