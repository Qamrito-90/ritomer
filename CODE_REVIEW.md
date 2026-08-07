# Code Review

## Rôle

Ce document complète `AGENTS.md` et `TESTING_STRATEGY.md`. Il ne les remplace pas.
Il est une projection courte de la gouvernance active désignée par `docs/governance/ai-first/README.md`.

Il ne remplace pas les prompts pré-code et post-code actifs. Il sert de checklist permanente du repo pour reviewer un plan, un diff, une PR ou un livrable Codex.

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

La synthèse pré-code utilise exclusivement :

- un `TECHNICAL_STATUS` parmi `PASS`, `PASS_WITH_RESIDUAL_RISK`, `FAIL` et `INCONCLUSIVE` ;
- un `WORKFLOW_VERDICT` autorisé par le prompt pré-code actif.

Une preuve décisive inaccessible ou insuffisante impose `INCONCLUSIVE`. Une contradiction décisive établie impose `FAIL`. Dans les deux cas, l’autorisation dépendante est interdite.

## Revue post-code

Après le code, vérifier :

- le Fresh Evidence Pack est présent et cohérent ;
- la liste des fichiers modifiés correspond au scope ;
- le diff ne contient pas de dérive fonctionnelle ou documentaire ;
- les tests/checks lancés correspondent à la surface et au risque ;
- les échecs sont expliqués sans masquer un bug ;
- les règles tenant, audit, sécurité et données sensibles restent respectées ;
- les contrats et docs vivantes sont à jour si le comportement durable change.

La synthèse post-code utilise les mêmes quatre `TECHNICAL_STATUS` et un `WORKFLOW_VERDICT` autorisé par le prompt post-code actif.

`BUG CODE`, `BUG TEST`, `PREUVE INSUFFISANTE`, `ENVIRONNEMENT BLOQUÉ`, `DÉRIVE DE SCOPE`, `DÉRIVE DE DELIVERY` et `DÉRIVE D’EXÉCUTION` sont des findings de cause, jamais des statuts techniques supplémentaires. Les risques résiduels non bloquants sont listés séparément.

## Review verdict versus delivery authorization

Un `PASS` ou `PASS_WITH_RESIDUAL_RISK` juge l’objet exact et ses preuves. Il ne constitue aucune autorisation implicite.

- Vérifier séparément `IMPLEMENTATION_AUTHORIZED`, `DELIVERY_AUTHORIZED`, `MERGE_AUTHORIZED`, `SENSITIVE_EXECUTION_AUTHORIZED`, `PRODUCTION_AUTHORIZED` et le constat `DELIVERY_COMPLETE`.
- Toute autorisation applicable doit posséder un `AUTHORIZATION_RECORD` encore valide, lié à l’objet et au scope exacts.
- Pour un risque A ou B, `DELIVERY_AUTHORIZED=YES` peut autoriser la boucle complète conformément à la doctrine active.
- Pour un risque C, `DELIVERY_AUTHORIZED=YES` s’arrête au commit, au push, à la pull request, aux checks et aux preuves exact-head.
- Avant un merge C, exiger un Codex Reviewer séparé read-only, le même head SHA, un `OWNER_DECISION_RECORD` applicable et `MERGE_AUTHORIZED=YES` lié à cette PR et à ce SHA.
- Une review IA reste générée par l'IA et ne doit jamais être présentée comme une signature humaine.
- L'absence d'approbation humaine obligatoire dans GitHub ne constitue ni une review humaine ni une séparation des fonctions.

Avant le merge, vérifier :

- le head SHA exact revu ;
- le file-set et le diff exacts ;
- tous les required checks présents et verts ;
- le squash uniquement avec `--match-head-commit` sur le head SHA revu ;
- l'absence de dérive incompatible de `main`.

Après le merge, vérifier :

- le commit final mono-parent ;
- la cohérence du tree source avec le tree final ;
- le diff final exact ;
- `main` synchronisée ;
- le worktree et l'index propres, sans fichier non suivi ;
- la branche source supprimée.

## Checklists par surface

| Surface | Points à vérifier |
|---|---|
| `DOCS` | Diff limité aux docs, cohérence avec `AGENTS.md`, `TESTING_STRATEGY.md`, `docs/present/*` et `docs/product/v1-plan.md`, pas de règle durable implicite. |
| `BACKEND` | Tenant scope, audit, RBAC, frontières de modules, exceptions, tests backend, build si risque standard ou critique. |
| `FRONTEND` | Scope UX, états loading/error/success, accessibilité raisonnable, contrat API consommé, tests frontend, lint, build si risque renforcé. |
| `DB` | Migration reviewable, `tenant_id`, contraintes, index, compatibilité données existantes, rollback ou justification, PostgreSQL réel si requis. |
| `CONTRACTS` | OpenAPI, schemas, producteurs et consommateurs alignés, compatibilité breaking/non-breaking, payloads sensibles, tests côté surface impactée. |
| `CI_GIT` / `GITHUB_GOVERNANCE` | Triggers, permissions, absence de secrets, commandes cohérentes avec les commandes locales PowerShell-safe, impact sur branches protégées. |
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

## Expertise humaine externe et validation professionnelle

Classifier `EXTERNAL_HUMAN_EXPERTISE` en `YES`, `RECOMMENDED` ou `NO` selon les déclencheurs fermés d’`AGENTS.md`. Le risque C seul peut motiver `RECOMMENDED`, mais ne rend jamais `YES` obligatoire.

La validation professionnelle métier réelle reste distincte de l’expertise technique externe et doit être rapportée séparément lorsqu’elle est applicable.

## Sortie attendue d’une review

Une review doit se terminer par :

- `Technical Status` : un des quatre statuts canoniques.
- `Workflow Verdict` : une valeur autorisée par le prompt actif applicable.
- `Preuves utilisées` : fichiers, diff, tests, logs ou docs consultés.
- `Ce qui est prouvé` : points vérifiés factuellement.
- `Ce qui est plausible mais non prouvé` : hypothèses restantes.
- `Dérives éventuelles` : scope, comportement, tests, docs ou contrats.
- `Risques résiduels non bloquants` : liste courte ou `AUCUN`.
- `Autorisations` : marqueurs applicables et records liés, sans déduction implicite.
- `Prochaine action unique` : clarifier, durcir, corriger, tester, demander une preuve ou exécuter l’étape exactement autorisée.
