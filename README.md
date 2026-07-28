# SaaS Closing Comptable IA-Native — Pack de démarrage Codex

Ce dépôt sert à construire une plateforme SaaS suisse de closing comptable, multi-tenant, audit-ready, avec une UX premium et une IA evidence-first.

## Lecture recommandée pour Codex
1. `AGENTS.md`
2. `docs/vision/ux.md`
3. `docs/vision/architecture.md`
4. `docs/vision/ai-native.md`
5. `docs/product/v1-plan.md`
6. `docs/product/product-roadmap.md`
7. `docs/adr/*.md`
8. `specs/active/<feature>.md` de la mission courante
9. `contracts/*` impactés par la mission

Référence UI documentaire : `docs/ui/ui-foundations-v1.md`

## Règle d’or
Le produit repose sur 3 couches complémentaires :
- un moteur métier déterministe
- une couche de preuves et de traçabilité
- une IA copilote structurée, jamais autonome sur les décisions engageantes

## Arborescence clé
- `AGENTS.md` : règles permanentes pour Codex
- `backend/` : backend Kotlin/Spring Boot (source de vérité technique)
- `frontend/` : frontend local
- `docs/vision/` : North Star UX, architecture et IA
- `docs/ui/` : source de vérité documentaire UI
- `docs/playbooks/` : patterns d’exécution et garde-fous
- `docs/product/` : plan V1 exécutable et roadmap produit canonique orientée outcomes, preuves et gates
- `docs/adr/` : décisions structurantes
- `docs/archive/` : documents historisés ou supersédés
- `specs/active/` : mission atomique active à implémenter
- `specs/backlog/` : missions atomiques cadrées mais non actives
- `specs/done/` : missions atomiques terminées
- `contracts/` : contrats techniques source de vérité
- `evals/` : qualité IA
- `fixtures/` : fixtures synthétiques gelées, versionnées et validées pour les répétitions contrôlées
- `prompts/` : prompts et garde-fous versionnés
- `knowledge/` : politique de retrieval / RAG
- `runbooks/` : exploitation et incidents
- `policies/` : sécurité, privacy, règles IA

## Priorités V1
- monolithe modulaire Kotlin/Spring Boot
- PostgreSQL comme base principale
- Cloud SQL for PostgreSQL comme cible de production
- multi-tenant strict, audit trail append-only
- REST first en V1
- GraphQL read-model plus tard, avec garde-fous
- AI Gateway contractuelle dès le départ
- structured outputs, evals, observabilité, feature flags

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
- `RITOMER_DB_TEST_JDBC_URL`, `RITOMER_DB_TEST_USERNAME`, `RITOMER_DB_TEST_PASSWORD` pour la cible locale dédiée décrite dans le runbook 043b
- voir aussi `backend/.env.example`

Ne créer aucun fichier `.env` et ne demander ni à Codex ni à un autre outil de lire la valeur HMAC. Exemple PowerShell pour produire 32 octets CSPRNG directement dans le processus, sans afficher ni stocker la valeur :

```powershell
$jwtKeyBytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($jwtKeyBytes)
$env:RITOMER_SECURITY_JWT_HMAC_SECRET = [Convert]::ToBase64String($jwtKeyBytes)
[Array]::Clear($jwtKeyBytes, 0, $jwtKeyBytes.Length)
```

## Posture locale 043b

043b is a local single-operator two-role simulation.
It validates backend RBAC behavior under two synthetic identities.
It does not establish independent human sessions or segregation of duties.

043b est une simulation locale mono-opérateur de deux rôles.
Elle valide le comportement RBAC du backend sous deux identités synthétiques.
Elle n'établit ni deux sessions humaines indépendantes ni une séparation des fonctions.

Statut courant : `LOCAL_SYNTHETIC_SIMULATION_VALIDATED / MERGED / AI_REVIEWED / OWNER_RISK_ACCEPTED_FOR_LOCAL_SYNTHETIC_ONLY / NOT_HUMAN_SIGNED / NOT_PRODUCTION_READY / NOT_EXTERNAL_READY / NOT_SEPARATION_OF_DUTIES_PROOF`. La simulation reste `LOCAL_TWO_ROLE_SIMULATION / SINGLE_OPERATOR_CAPABLE / SYNTHETIC_ONLY / LOOPBACK_ONLY / NOT_PRODUCTION_AUTH / NOT_INDEPENDENT_ACTOR_BOUNDARY / NOT_PROOF_OF_SEGREGATION_OF_DUTIES / NOT_FOR_EXTERNAL_USE / NOT_FOR_REAL_DATA`. Les ports `5173` et `5174` restent deux contextes visuels, jamais une frontière d'identité.

Clôture factuelle du `2026-07-27` : preuves PostgreSQL dédiées, smoke local deux acteurs, contrôle navigateur sans exposition d'un header d'authentification ni JWT détecté dans les surfaces navigateur, Backend CI, Frontend CI, cleanup, merge de la PR `#103` et vérification post-merge : `PASS`.

`043c` reste `NOT_STARTED / NOT_AUTHORIZED`.

Les tests PostgreSQL destructifs utilisent exclusivement `jdbc:postgresql://127.0.0.1:5432/ritomer_043b_test` avec le rôle `ritomer_043b_test_runner`, sur un PostgreSQL local direct et des données synthétiques. Cloud SQL Proxy, tunnel SSH et port forward sont interdits pour cette preuve.
