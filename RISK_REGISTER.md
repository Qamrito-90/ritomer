# Risk Register

## Rôle

Ce registre sert à classer le risque d’une spec avant exécution.

`RISK_REGISTER.md` est l’unique autorité normative pour les critères et les déclencheurs qui déterminent les classes `A`, `B`, `C` et `NON DÉTERMINÉ`.

- `AGENTS.md` définit les conséquences de la classe retenue : boucle, profondeur de preuve, gates et autorisations.
- `TESTING_STRATEGY.md` projette la classe déjà établie vers les checks.
- Les prompts et rôles appliquent ces critères aux faits et peuvent challenger cette application, sans créer de critère concurrent ni de taxonomie parallèle.

Il doit rester court, vivant et opérationnel. Il ne prouve pas que le code est correct : il aide à choisir la bonne boucle de plan, tests, review et Fresh Evidence Pack.

## Niveaux de risque

- `A` - faible risque : wording, typo, documentation simple ou ajustement sans effet sur le comportement produit, la sécurité, les données, les contrats, la CI, le workflow ou les règles métier.
- `B` - risque standard : changement produit ou technique borné, non sensible, avec contrat et tests ciblés.
- `C` - risque critique : changement touchant tenant, auth, autorisation, audit, données sensibles, DB/migration, règle métier critique, finalisation, archivage, suppression, IA active, dépendance, architecture, production, action irréversible ou gouvernance permanente de review, autorisation, merge ou exécution.

Si une spec touche plusieurs risques, retenir le niveau le plus élevé.

Si le niveau est `NON DÉTERMINÉ` et potentiellement sensible, clarifier avant de coder ou classer en `C`.

Ne pas surclasser automatiquement en `C` une spec purement wording, documentation ou UI non sensible. Une modification documentaire qui change durablement les règles de review, d’autorisation, de merge ou d’exécution est toutefois classée `C`.

## Registre minimal

| Risque | Criticité | Statut | Signal déclencheur | Garde-fou attendu |
|---|---:|---|---|---|
| Séparation tenant | C | à surveiller | `tenant_id`, repository, query, header tenant, RLS, accès cross-tenant | tests d’isolation, repositories tenant-scoped, aucun accès cross-tenant implicite |
| Auth / autorisation / rôles | C | à surveiller | login, token, RBAC, maker/checker/reviewer, 401/403 | contrôles backend, tests 401/403, pas de sécurité seulement côté UI |
| Audit trail | C | à surveiller | mutation métier, upload, décision reviewer, archive, export | événement append-only attendu, pas d’audit sur `GET` quand la spec l’exclut |
| Données sensibles | C | à surveiller | document, preuve, export, payload IA, stockage objet, donnée financière | pas de secret, pas de clé storage exposée, masquage si nécessaire, download backend-only |
| DB / migration / persistance | C | à surveiller | Flyway, table, index, contrainte, repository, persistance | nouvelle migration, `tenant_id`, index tenant, `dbIntegrationTest` si requis |
| Règles métier de closing | C | à surveiller | readiness, `PREVIEW_READY`, mapping, revue, gate evidence | tests métier, workflow déterministe, pas de validation implicite |
| Finalisation / archivage / suppression | C | à surveiller | `ARCHIVED`, hard delete, pack immutable, action irréversible | writes bloqués si requis, audit, confirmation si irréversible |
| Contrats API | B | à surveiller | OpenAPI, path, payload, erreur, compatibilité frontend/backend | contrat mis à jour, producteurs/consommateurs alignés ; monter en C si breaking ou sensible |
| Documents / workpapers / exports sensibles | C | à surveiller | upload, download, stockage, vérification, stale/current, ZIP export, accès à une preuve, visibilité client, donnée financière | backend-only si requis, pas de signed URL publique, idempotence, distinction current/stale/archive, tests adaptés |
| IA evidence-first / human-in-the-loop | C | à surveiller | modèle, prompt, schema, retrieval, suggestion IA | JSON Schema, preuves obligatoires, validation humaine, feature flag, evals, logs |
| CI / qualité / Git / GitHub delivery | B par défaut ; C selon signal | mitigé | modification bornée de CI/Git ou de documentation de delivery ; monter en C pour ruleset, bypass actor, permissions administrateur, méthode de merge, required checks, force-push, suppression de `main`, déploiement ou production | PR obligatoire, squash uniquement, historique linéaire, required checks verts, head SHA exact, aucun bypass, aucun push direct sur `main`, aucun force-push, vérification post-merge |
| Documentation désynchronisée | B | à surveiller | spec close, décision durable, contrat ou présent modifié | mise à jour minimale des docs vivantes impactées |
| Nouvelle dépendance | C | à surveiller | librairie, plugin build, SDK, runtime externe | justification, périmètre limité, lockfile cohérent, tests adaptés |
| Production / déploiement | C | non déterminé | Cloud Run, Cloud SQL, secrets, région, rollback, CI de déploiement | runbook/CI explicite, aucun secret en clair, revue avant merge |

Les avis, gates ou reviews CPO/CTO et les marqueurs d’autorisation ne constituent ni des reviews humaines GitHub ni une preuve de séparation des fonctions. Luis reste le seul owner décisionnaire.

## Utilisation dans la boucle

- Risque `A` : boucle légère et preuves `LITE`, diff limité, checks documentaires si applicable.
- Risque `B` : boucle normale et preuves `STANDARD`, tests de la surface touchée selon `TESTING_STRATEGY.md`.
- Risque `C` : boucle renforcée et preuves `FULL`, plan explicite, tests ciblés, checks renforcés pertinents, contrats/docs mis à jour si besoin et Codex Reviewer séparé aux étapes prévues par la doctrine active.

Évaluer séparément `EXTERNAL_HUMAN_EXPERTISE=YES|RECOMMENDED|NO`. Le risque `C` seul ne rend jamais `YES` obligatoire ; la validation professionnelle métier reste une question distincte.

Lancer les checks renforcés quand `TESTING_STRATEGY.md` les demande : build backend/frontend, vérification Modulith, `dbIntegrationTest`, checks contrats ou CI selon la surface.

## Fresh Evidence Pack

Tout risque touché par la tâche doit apparaître dans le Fresh Evidence Pack final avec :

- niveau retenu ;
- niveau de preuve `LITE`, `STANDARD` ou `FULL` ;
- garde-fous appliqués ;
- tests/checks exécutés ;
- tests/checks non exécutés et justification ;
- Reviewer Codex séparé requis ou non pour l’étape ;
- statut d’expertise humaine externe et validation professionnelle métier, chacune avec son déclencheur exact ou `NON_APPLICABLE`.
