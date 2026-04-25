# Code Review

## Rôle

Ce document complète `AGENTS.md` et `TESTING_STRATEGY.md`. Il ne les remplace pas.

Il ne remplace pas non plus les prompts ChatGPT Pro existants. Il sert de checklist permanente du repo pour reviewer un plan, un diff, une PR ou un livrable Codex.

Principe central : reviewer les preuves, pas seulement les affirmations.

Pendant une review :

- chercher la plus petite correction robuste ;
- ne pas ouvrir de nouveau scope ;
- distinguer bloquant, non bloquant et risque résiduel ;
- vérifier que le diff prouve ce que le livrable affirme ;
- vérifier que les checks exécutés correspondent à la surface et au risque.

## Revue pré-code

Avant de coder, vérifier :

- le comportement attendu est clair ;
- le périmètre est borné ;
- les ambiguïtés restantes sont nommées ;
- les tests/checks attendus sont identifiés selon `TESTING_STRATEGY.md` ;
- les risques critiques sont visibles ;
- les décisions durables à figer sont explicites ;
- les contrats, specs, docs vivantes ou runbooks impactés sont listés.

Verdicts pré-code autorisés :

- `BLOQUÉ`
- `À DURCIR`
- `PRÊT À CODER`

## Revue post-code

Après le code, vérifier :

- le Fresh Evidence Pack est présent et cohérent ;
- la liste des fichiers modifiés correspond au scope ;
- le diff ne contient pas de dérive fonctionnelle ou documentaire ;
- les tests/checks lancés correspondent à la surface et au risque ;
- les échecs sont expliqués sans masquer un bug ;
- les règles tenant, audit, sécurité et données sensibles restent respectées ;
- les contrats et docs vivantes sont à jour si le comportement durable change.

Verdicts post-code autorisés :

- `BUG CODE` : le diff casse le comportement attendu ou un invariant.
- `BUG TEST` : le test est faux, fragile ou ne prouve pas le bon comportement.
- `ENV BLOQUÉ` : l’environnement bloque la vérification, avec justification précise.
- `PREUVE INSUFFISANTE` : l’affirmation n’est pas prouvée par le diff, les tests ou la documentation.
- `FEU VERT` : scope respecté, preuves suffisantes, risques acceptables.

Les risques résiduels non bloquants doivent être listés séparément. Ils ne créent pas de verdict supplémentaire.

## Checklists par surface

| Surface | Points à vérifier |
|---|---|
| `DOCS_ONLY` / `DOCS_GIT` | Diff limité aux docs, cohérence avec `AGENTS.md`, `TESTING_STRATEGY.md`, `docs/present/*` et `docs/product/v1-plan.md`, pas de règle durable implicite. |
| `BACKEND` | Tenant scope, audit, RBAC, frontières de modules, exceptions, tests backend, build si risque standard ou critique. |
| `FRONTEND` | Scope UX, états loading/error/success, accessibilité raisonnable, contrat API consommé, tests frontend, lint, build si risque renforcé. |
| `DB/MIGRATION` | Migration reviewable, `tenant_id`, contraintes, index, compatibilité données existantes, rollback ou justification, PostgreSQL réel si requis. |
| `CONTRACTS/API` | OpenAPI, schemas, producteurs et consommateurs alignés, compatibilité breaking/non-breaking, payloads sensibles, tests côté surface impactée. |
| `CI/GIT` | Triggers, permissions, absence de secrets, commandes cohérentes avec les commandes locales PowerShell-safe, impact sur branches protégées. |
| `FULLSTACK` | Cohérence bout en bout entre backend, contrats, frontend, docs, checks backend et frontend adaptés au risque. |

## Risques critiques à toujours surveiller

Revue renforcée si le changement touche :

- auth ;
- autorisation ;
- tenant ;
- audit ;
- données sensibles ;
- DB/migration ;
- règle métier critique ;
- finalisation / archivage ;
- suppression ;
- nouvelle dépendance ;
- architecture ;
- IA evidence-first ;
- human-in-the-loop ;
- production ou action irréversible.

## Documentation vivante

Vérifier les artefacts impactés uniquement si la vérité durable change :

- `specs/active/*` pendant le cadrage ou l’exécution ;
- `specs/done/*` après validation ;
- `docs/product/v1-plan.md` si sequencing, périmètre V1 ou décision figée change ;
- `docs/present/*` si la vérité actuelle UX, architecture ou IA change ;
- `contracts/*` si le comportement contractuel change ;
- `runbooks/*` si l’exploitation ou le démarrage changent.

Les documents Word ne remplacent pas la documentation vivante du repo.

## Revue humaine recommandée

Demander une revue humaine technique avant merge si le changement touche :

- migration DB ;
- authentification ou autorisation ;
- séparation tenant ;
- audit ;
- données sensibles ;
- suppression de données ;
- règle métier critique ;
- nouvelle dépendance ;
- changement d’architecture ;
- CI de production ou déploiement ;
- action métier irréversible.

## Sortie attendue d’une review

Une review doit se terminer par :

- `Verdict` : un verdict pré-code ou post-code autorisé.
- `Preuves utilisées` : fichiers, diff, tests, logs ou docs consultés.
- `Ce qui est prouvé` : points vérifiés factuellement.
- `Ce qui est plausible mais non prouvé` : hypothèses restantes.
- `Dérives éventuelles` : scope, comportement, tests, docs ou contrats.
- `Risques résiduels non bloquants` : liste courte ou `AUCUN`.
- `Prochaine action unique` : clarifier, durcir, corriger, tester, demander une revue humaine ou merger.
