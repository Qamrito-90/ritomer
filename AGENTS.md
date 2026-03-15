# AGENTS.md

## Mission
Construire un SaaS suisse de closing comptable, multi-tenant, sécurisé, audit-ready, avec UX premium et IA evidence-first.

## Sources à lire avant toute implémentation
Toujours lire dans cet ordre :
1. `README.md`
2. `docs/vision/ux.md`
3. `docs/vision/architecture.md`
4. `docs/vision/ai-native.md`
5. `docs/product/v1-plan.md`
6. `docs/adr/*.md`
7. `specs/active/<feature>.md`
8. `contracts/*` impactés

Référence UI documentaire : `docs/ui/ui-foundations-v1.md`

## Invariants produit
- L’utilisateur métier doit garder le contrôle sur toute décision engageante.
- L’IA suggère, explique, rédige ou prépare ; elle ne valide jamais seule un acte comptable, réglementaire ou financier.
- Toute action importante doit être traçable : qui, quoi, quand, pourquoi, sur quelles preuves.
- Le workflow de closing prime sur la sophistication de reporting.
- La V1 doit être utilisable en conditions réelles par des fiduciaires pilotes.

## Invariants UX
- Clarté avant sophistication.
- Feedback immédiat, autosave, statuts explicites.
- Recherche globale, bulk actions, navigation poste → note → preuve.
- Responsive adaptatif : cohérent entre desktop et mobile, sans clonage aveugle.
- Accessibilité et privacy by design non négociables.
- Le produit doit inspirer confiance : messages clairs, annulation quand possible, confirmation seulement sur l’irréversible.

## Invariants architecture
- Monolithe modulaire Kotlin/Spring Boot.
- Frontières de modules strictes.
- Interactions inter-modules via API explicites ou événements applicatifs.
- Clean Architecture : domaine pur, application, infrastructure.
- REST first en V1. GraphQL seulement si la composition front devient un coût réel.
- PostgreSQL est la base principale ; Cloud SQL for PostgreSQL est la cible de prod.
- Le développement local et les tests par défaut ne doivent pas dépendre de Docker, Docker Compose ou Testcontainers.
- Contrats techniques versionnés dans `contracts/`.

## Invariants IA
- Evidence-first : pas de réponse IA sans base factuelle exploitable.
- Sorties structurées strictes pour toute capacité IA qui influence une décision.
- Human-in-the-loop obligatoire pour les actions critiques.
- Model pinning, prompt pinning, evals et logs obligatoires.
- Mode dégradé obligatoire : si l’IA tombe, le closing continue.
- Pas d’écriture directe en base par l’IA sans validation humaine et couche métier.

## Sécurité et multi-tenancy
- Toutes les données métier sont scindées par `tenant_id`.
- Aucun accès cross-tenant sans mécanisme explicite, tracé et autorisé.
- Les repositories sont toujours tenant-scoped.
- Ne jamais contourner l’audit.
- Ne jamais exposer de secrets en dur.
- Les données sensibles ne partent pas en clair vers des services IA externes.

## Qualité attendue
- Ajouter ou ajuster les tests impactés.
- Vérifier les frontières modulaires.
- Mettre à jour les contrats si le comportement change.
- Mettre à jour la documentation impactée si une décision devient durable.
- Toute PR doit rester reviewable et limitée en périmètre.

## Definition of done
Une mission est terminée seulement si :
- le périmètre demandé est respecté
- les tests nécessaires existent et passent
- les règles de sécurité et d’isolation tenant sont respectées
- les audits requis sont émis
- les fichiers modifiés sont listés
- les points de vigilance restants sont signalés

## Commandes de base
- Build : `cd backend && ./gradlew build`
- Tests : `cd backend && ./gradlew test`
- Tests DB optionnels : `cd backend && ./gradlew dbIntegrationTest` avec une configuration PostgreSQL explicite
- Vérification modulith : `cd backend && ./gradlew test --tests *ApplicationModule*`
- Lancer en local : `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'`

## Interdits
- Ne pas introduire de microservice sans ADR ni trigger clair.
- Ne pas introduire GraphQL par confort théorique.
- Ne pas bypasser les couches métier pour “aller plus vite”.
- Ne pas coder l’IA en texte libre si un JSON Schema existe.
- Ne pas casser un contrat existant sans mise à jour explicite.
- Ne pas utiliser des données d’un tenant dans le contexte IA d’un autre tenant.
