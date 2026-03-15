# SaaS Closing Comptable IA-Native — Pack de démarrage Codex

Ce dépôt sert à construire une plateforme SaaS suisse de closing comptable, multi-tenant, audit-ready, avec une UX premium et une IA evidence-first.

## Lecture recommandée pour Codex
1. `AGENTS.md`
2. `docs/vision/ux.md`
3. `docs/vision/architecture.md`
4. `docs/vision/ai-native.md`
5. `docs/product/v1-plan.md`
6. `docs/adr/*.md`
7. `specs/active/<feature>.md` de la mission courante
8. `contracts/*` impactés par la mission

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
- `docs/product/` : plan V1 exécutable
- `docs/adr/` : décisions structurantes
- `docs/archive/` : documents historisés ou supersédés
- `specs/active/` : mission atomique active à implémenter
- `specs/backlog/` : missions atomiques cadrées mais non actives
- `specs/done/` : missions atomiques terminées
- `contracts/` : contrats techniques source de vérité
- `evals/` : qualité IA
- `prompts/` : prompts et garde-fous versionnés
- `knowledge/` : politique de retrieval / RAG
- `runbooks/` : exploitation et incidents
- `policies/` : sécurité, privacy, règles IA

## Priorités V1
- monolithe modulaire Kotlin/Spring Boot
- multi-tenant strict, audit trail append-only
- REST first en V1
- GraphQL read-model plus tard, avec garde-fous
- AI Gateway contractuelle dès le départ
- structured outputs, evals, observabilité, feature flags

## Démarrage backend (Spec 001)

Depuis la racine du repo :

- `cd backend && ./gradlew test`
- `cd backend && ./gradlew build`
- `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'`
- détails de démarrage local : `runbooks/local-dev.md`

Variables d’environnement locales minimales :

- `RITOMER_SECURITY_JWT_HMAC_SECRET=local-dev-only-jwt-hmac-secret-change-me`
- `SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/ritomer`
- `SPRING_DATASOURCE_USERNAME=ritomer`
- `SPRING_DATASOURCE_PASSWORD=ritomer`
- voir aussi `backend/.env.example`
