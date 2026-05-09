# 030 - IA mapping assiste suggestion review V1

## Status

Done.

## Phase

CLOSURE.

## Surface

DOCS_ONLY for this `030z` final closing pack.

Delivered 030 surface before this closure:

- CONTRACTS;
- BACKEND;
- DB/MIGRATION for idempotent human decision requests;
- IA GOVERNANCE;
- FRONTEND.

## Risk

C documentaire / gouvernance IA.

## Role de cette spec

Cette spec est la verite normative de cloture de `030`.

Elle consolide les sous-livrables merges sur `main` pour livrer une capacite de mapping assiste no-provider, evidence-first et human-in-the-loop.

La capacite livree aide l'expert fiduciaire a revoir des suggestions de mapping preparees par le backend, avec preuves visibles, et a prendre une decision humaine unitaire `ACCEPT`, `CORRECT` ou `REJECT`.

Le mapping manuel et le backend restent l'autorite metier. Une suggestion n'applique jamais seule un mapping.

## Sources de verite relues

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/ai-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/adr/0001-monolithe-modulaire.md`
- `docs/adr/0002-rest-first-graphql-later.md`
- `docs/adr/0003-ai-gateway-evidence-first.md`
- `docs/adr/0004-multi-tenancy-audit-rls-progressive.md`
- `docs/adr/0005-front-ui-stack-and-design-system.md`
- `docs/adr/0006-postgresql-cloud-sql-no-docker-v1.md`
- `docs/product/v1-plan.md`
- ancienne spec active `030` relue avant classement dans `specs/done/`
- `specs/done/003-import-balance-v1.md`
- `specs/done/005-manual-mapping-v1.md`
- `specs/done/008-financial-rubric-taxonomy-v2.md`
- `specs/done/029-pilot-closing-workflow-e2e-confidence-hardening-v1.md`
- `contracts/ai/mapping-suggestion.schema.json`
- `contracts/openapi/mapping-suggestions-api.yaml`
- `contracts/openapi/import-balance-api.yaml`
- `contracts/openapi/manual-mapping-api.yaml`
- `contracts/openapi/closing-api.yaml`
- `contracts/db/import-balance-v1.md`
- `contracts/db/manual-mapping-v1.md`
- `contracts/db/mapping-suggestion-decision-v1.md`
- `contracts/reference/manual-mapping-targets-v2.yaml`
- `prompts/guardrails/system-fr.md`
- `evals/mapping/README.md`
- `knowledge/retrieval-policy.md`
- `runbooks/ai-incident-response.md`
- `runbooks/local-dev.md`
- `policies/ai-provider-readiness.md`
- `policies/ai-provider-readiness-record-030d1.md`
- `policies/dependency-security-review-030d1.md`
- `docs/ui/ui-foundations-v1.md`
- `README.md`
- `docs/vision/ai-native.md`
- `docs/vision/architecture.md`
- `docs/vision/ux.md`
- `docs/playbooks/ai.md`
- `docs/playbooks/architecture.md`
- `docs/playbooks/ux.md`

## Capacite livree

`030` livre une assistance de mapping bornee :

- suggestions sur la derniere balance importee;
- output structure selon `contracts/ai/mapping-suggestion.schema.json`;
- contrat REST dedie `contracts/openapi/mapping-suggestions-api.yaml`;
- read-model backend tenant-scoped `GET /api/closing-folders/{closingFolderId}/mappings/suggestions`;
- minimisation du payload entre `mapping.application` et `ai::access`;
- adapter/stub no-provider, sans modele reel;
- golden set synthetique et check local;
- provider-readiness policy, record et dependency/security review;
- frontend read-only puis UI de decision humaine;
- decision humaine durable et idempotente `POST /api/closing-folders/{closingFolderId}/mappings/suggestions/{accountCode}/decision`.

La capacite ne livre pas de provider IA reel.

## Sous-livrables consolides

| Sous-livrable | Statut | Verite de cloture |
| --- | --- | --- |
| `030a` | Livre | Contrats et schema durcis, noms canoniques `accountCode`, `accountLabel`, `suggestedTargetCode`, decisions humaines documentees. |
| `030b` | Livre | Read-model backend et adapter stub no-provider derriere feature flag. |
| `030c` | Livre | Golden set synthetique, evals et seuils minimaux avant provider reel. |
| `030d0` | Livre | Policy provider-readiness et runbook IA sans activation runtime provider. |
| `030d1` | Livre | Provider-readiness record et dependency/security review, statut non approuvant et non-runtime. |
| `030d2` | Livre | Minimisation backend no-provider, sans SDK, reseau, modele ni prompt runtime actif. |
| `030e0` | Livre | Frontend read-only de suggestions preparees pour revue humaine. |
| `030f` | Livre | Decision humaine durable, idempotente et tenant-scopee `ACCEPT`, `CORRECT` ou `REJECT`. |
| `030e` | Livre | UI de revue humaine des suggestions, sans appel modele direct ni auto-apply. |
| `030d runtime` | Differe | Provider reel non livre, non approuve et bloque par gates. |

## Runtime provider deferred / blocked

`030d runtime` reste explicitement non livre.

Aucun des elements suivants n'est actif ou approuve par `030` :

- provider IA reel;
- modele reel;
- SDK provider;
- prompt runtime actif;
- appel reseau IA;
- cout provider;
- alias modele auto-upgrade;
- ecriture directe en base par l'IA;
- auto-apply de mapping;
- bulk auto-apply;
- RAG ou vector store;
- microservice IA obligatoire.

Toute activation provider future reste bloquee tant que tous les gates suivants ne sont pas satisfaits et traces :

- approval CPO;
- CTO Gate;
- security/privacy review;
- IA governance review;
- provider-readiness record signe;
- dependency/security review signee;
- payload whitelist signee;
- region, retention, non-training, logging provider, sous-traitants, DPA/SCC, deletion et incident process documentes;
- golden set `030c` vert;
- runbook pret;
- tests prouvant feature flag off avec zero prompt, zero request provider, zero reseau, zero cout et zero log provider.

Sans ces gates, le provider reste `NON_DETERMINE` ou candidat non approuve.

## Autorite metier

- Le backend reste l'autorite metier.
- Le mapping manuel reste la source durable appliquee.
- `ACCEPT` et `CORRECT` passent par la logique metier de mapping manuel.
- `REJECT` ne cree ni ne modifie aucun mapping manuel.
- `requiresHumanReview` reste obligatoire.
- Aucune suggestion ne peut etre appliquee sans decision humaine explicite.
- Les writes restent bloques sur closing `ARCHIVED`.
- Les erreurs tenant, RBAC et backend authority priment sur tout payload syntaxiquement valide.

## Clarification `accountLabel` et `sanitizedAccountLabel`

Le contrat public expose `accountLabel` comme libelle canonique de la ligne tenant-scoped du dernier import.

La frontiere interne `ai::access` utilise un `sanitizedAccountLabel` minimise apres `030d2`. Ce champ interne ne remplace pas `accountLabel` dans le read-model public.

Le read-model public reconstruit toujours `accountLabel` depuis la ligne originale autorisee du tenant courant. Le futur provider eventuel ne pourra recevoir qu'un payload minimise et signe par la whitelist.

## Securite, tenant isolation et audit

- Toutes les lectures et decisions sont tenant-scoped.
- Aucun acces cross-tenant n'est autorise.
- Les repositories restent tenant-scoped.
- Le read-model `GET` ne cree ni mapping manuel, ni audit metier automatique.
- Les decisions humaines durables utilisent une idempotence tenant-scopee.
- `ACCEPT` et `CORRECT` emettent l'audit metier du mapping manuel quand ils creent ou modifient effectivement un mapping.
- `REJECT` n'applique pas de mapping manuel.
- Les logs et metrics ne doivent pas contenir secrets, prompts bruts, outputs bruts, payloads complets, fichiers d'environnement local, storage keys, signed URLs, donnees cross-tenant ou donnees sensibles non minimises.

## UX livree

La route `/closing-folders/:closingFolderId` expose les suggestions dans le flux de mapping, avec posture prudente :

- `AI mapping suggestion`;
- `Prepared for human review`;
- `Human review required`;
- `Read-only suggestion`;
- `Manual mapping remains the authority`.

L'UI rend les preuves visibles directement, sans hover-only, et ne fait aucun appel modele direct. Les actions accept/correct/reject passent par le backend.

## Hors-scope confirme apres livraison

- provider IA reel;
- modele reel;
- appel modele;
- SDK;
- prompt runtime actif;
- nouvelle dependance provider;
- GraphQL;
- RAG ou vector store;
- microservice IA obligatoire;
- auto-apply;
- bulk decision;
- mapping applique sans revue humaine;
- promesse de finalisation CO, statutaire, certification ou depot;
- modification de fichier d'environnement local ou lecture de secret.

## Acceptance de cloture

- La spec `030` n'est plus active.
- La spec `030` est presente dans `specs/done/`.
- `docs/product/v1-plan.md` declare `030` comme livre.
- `docs/present/ai-cadrage-v1.md` distingue la capacite no-provider livree du provider runtime differe.
- `docs/present/architecture-cadrage-v1.md` ne s'arrete plus a `029`.
- `docs/present/ux-cadrage-v1.md` ne s'arrete plus a `029`.
- `contracts/openapi/mapping-suggestions-api.yaml` ne presente plus la surface livree comme un simple contrat futur.
- Aucun backend, frontend, DB/migration, secret, fichier d'environnement local, provider, modele, SDK, prompt runtime actif, commit, push ou PR n'est livre par `030z`.

## Tests runtime

Aucun test runtime n'est requis pour cette cloture `DOCS_ONLY`.

Les tests backend, frontend, DB et evals des sous-livrables `030a` a `030f` restent portes par leurs PRs d'implementation respectives.

Le check local `.\evals\mapping\validate-golden-set.ps1` reste le check documentaire/evals attendu pour `030z`.

## Revue humaine recommandee

Recommandee pour la gouvernance IA et la communication produit, car `030` ferme une capacite sensible qui doit rester no-provider et human-in-the-loop.

Obligatoire avant tout futur `030d runtime` provider reel : CPO, CTO, security/privacy, IA governance, provider readiness signe, dependency/security review signee et payload whitelist signee.

Non requise pour backend, frontend, DB/migration ou production dans `030z`, car cette cloture ne modifie aucun artefact runtime.
