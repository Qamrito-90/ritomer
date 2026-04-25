# Risk Register

## Rôle

Ce registre sert à classer le risque d’une spec avant exécution.

Il complète `AGENTS.md`, `TESTING_STRATEGY.md` et `CODE_REVIEW.md`. Il ne les remplace pas.

Il doit rester court, vivant et opérationnel. Il ne prouve pas que le code est correct : il aide à choisir la bonne boucle de plan, tests, review et Fresh Evidence Pack.

## Niveaux de risque

- `A` - faible risque : wording, typo, docs-only simple ou ajustement sans effet sur le comportement produit, la sécurité, les données, les contrats, la CI, le workflow ou les règles métier.
- `B` - risque standard : changement produit ou technique borné, non sensible, avec contrat et tests ciblés.
- `C` - risque critique : changement touchant tenant, auth, autorisation, audit, données sensibles, DB/migration, règle métier critique, finalisation, archivage, suppression, IA active, dépendance, architecture, production ou action irréversible.

Si une spec touche plusieurs risques, retenir le niveau le plus élevé.

Si le niveau est `NON DÉTERMINÉ` et potentiellement sensible, clarifier avant de coder ou classer en `C`.

Ne pas surclasser automatiquement en `C` une spec purement wording, documentation ou UI non sensible.

## Registre minimal

| Risque | Criticité | Statut | Signal déclencheur | Garde-fou attendu | Revue humaine |
|---|---:|---|---|---|---|
| Séparation tenant | C | à surveiller | `tenant_id`, repository, query, header tenant, RLS, accès cross-tenant | tests d’isolation, repositories tenant-scoped, aucun accès cross-tenant implicite | oui |
| Auth / autorisation / rôles | C | à surveiller | login, token, RBAC, maker/checker/reviewer, 401/403 | contrôles backend, tests 401/403, pas de sécurité seulement côté UI | oui |
| Audit trail | C | à surveiller | mutation métier, upload, décision reviewer, archive, export | événement append-only attendu, pas d’audit sur `GET` quand la spec l’exclut | oui |
| Données sensibles | C | à surveiller | document, preuve, export, payload IA, stockage objet, donnée financière | pas de secret, pas de clé storage exposée, masquage si nécessaire, download backend-only | oui |
| DB / migration / persistance | C | à surveiller | Flyway, table, index, contrainte, repository, persistance | nouvelle migration, `tenant_id`, index tenant, `dbIntegrationTest` si requis | oui |
| Règles métier de closing | C | à surveiller | readiness, `PREVIEW_READY`, mapping, revue, gate evidence | tests métier, workflow déterministe, pas de validation implicite | oui |
| Finalisation / archivage / suppression | C | à surveiller | `ARCHIVED`, hard delete, pack immutable, action irréversible | writes bloqués si requis, audit, confirmation si irréversible | oui |
| Contrats API | B | à surveiller | OpenAPI, path, payload, erreur, compatibilité frontend/backend | contrat mis à jour, producteurs/consommateurs alignés ; monter en C si breaking ou sensible | non par défaut |
| Documents / workpapers / exports sensibles | C | à surveiller | upload, download, stockage, vérification, stale/current, ZIP export, accès à une preuve, visibilité client, donnée financière | backend-only si requis, pas de signed URL publique, idempotence, distinction current/stale/archive, tests adaptés | oui |
| IA evidence-first / human-in-the-loop | C | à surveiller | modèle, prompt, schema, retrieval, suggestion IA | JSON Schema, preuves obligatoires, validation humaine, feature flag, evals, logs | oui |
| CI / qualité | B | mitigé | workflow, test, lint, build, permissions | pas de secret, commandes cohérentes, checks adaptés au risque | non par défaut |
| Documentation désynchronisée | B | à surveiller | spec close, décision durable, contrat ou présent modifié | mise à jour minimale des docs vivantes impactées | non par défaut |
| Nouvelle dépendance | C | à surveiller | librairie, plugin build, SDK, runtime externe | justification, périmètre limité, lockfile cohérent, tests adaptés | oui |
| Production / déploiement | C | non déterminé | Cloud Run, Cloud SQL, secrets, région, rollback, CI de déploiement | runbook/CI explicite, aucun secret en clair, revue avant merge | oui |

## Utilisation dans la boucle

- Risque `A` : boucle légère, diff limité, checks docs-only si applicable.
- Risque `B` : boucle normale, tests de la surface touchée selon `TESTING_STRATEGY.md`.
- Risque `C` : boucle renforcée, plan explicite, tests ciblés, checks renforcés pertinents, contrats/docs mis à jour si besoin, revue humaine recommandée.

Demander une revue humaine technique avant merge si la spec touche un risque `C`, ou si un risque `B` devient breaking, sensible ou transverse.

Lancer les checks renforcés quand `TESTING_STRATEGY.md` les demande : build backend/frontend, vérification Modulith, `dbIntegrationTest`, checks contrats ou CI selon la surface.

## Fresh Evidence Pack

Tout risque touché par la tâche doit apparaître dans le Fresh Evidence Pack final avec :

- niveau retenu ;
- garde-fous appliqués ;
- tests/checks exécutés ;
- tests/checks non exécutés et justification ;
- revue humaine recommandée ou non.
