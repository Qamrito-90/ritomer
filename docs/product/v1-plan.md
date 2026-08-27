# Plan V1 exécutable

## Objectif V1

Conduire Ritomer du noyau déterministe local déjà livré vers une alpha interne authentifiée, agentique, evidence-first et répétable, sans perdre l'autorité métier, l'isolation tenant, le mode manuel ou l'audit.

La roadmap canonique M0–M8 vit dans `docs/product/product-roadmap.md`. Ce plan porte seulement les repères de trajectoire exécutables, les décisions gelées et le handoff historique ; il ne crée ni spec ni autorisation.

## Repères de trajectoire

```text
M0_STATUS=DONE_CANONICAL_ROADMAP_REBASELINE
CRITICAL_PATH=M0_TO_M5
FIRST_AI_NATIVE_VERTICAL_SLICE=MAPPING_ASSISTANT_AGENT

ACTIVE_SPEC=046_AUTHENTICATED_SESSION_FOUNDATION_V1
ACTIVE_SPEC_COUNT=1
SPEC_046=ACTIVE
M1_1A_SCOPE=BACKEND_AUTH_TENANT_FOUNDATION_WITH_CORRECTIVE_M8
M1_1_FINAL_OUTCOME_DELIVERED=NO
M1_1B_IMPLEMENTED=NO
M1_1C_IMPLEMENTED=NO
M1_1D_IMPLEMENTED=NO
```

M0 a synchronisé les documents vivants et borné le checker 042 à ses responsabilités historiques. La spec 046 est l'unique spec active ; M1.1A avec son correctif M8 borne la fondation backend auth/tenant. Ce plan ne constitue aucune autorisation.

Les états de review, delivery, merge et décision owner vivent uniquement dans les Evidence Packs, la pull request et les records spécialisés.

## Plus petit incrément actif M1.1 — checkpoint A borné

```text
M1_1_SPEC=046_AUTHENTICATED_SESSION_FOUNDATION_V1
M1_1A_SCOPE=BACKEND_AUTH_TENANT_FOUNDATION_WITH_CORRECTIVE_M8
M1_1_FINAL_OUTCOME_DELIVERED=NO
M1_1B_IMPLEMENTED=NO
M1_1C_IMPLEMENTED=NO
M1_1D_IMPLEMENTED=NO
```

L'outcome final M1.1 reste une authentification same-origin par session serveur et cookie opaque sécurisé ; il n'est pas livré. M1.1A établit uniquement la fondation backend locale de principal applicatif, autorité PostgreSQL et sûreté tenant.

Le correctif M8 ferme l'exposition web Prometheus ; health et info restent exposés. Il ne livre aucune session, cookie, CSRF, login, logout, UI, IdP réel, IA, agent ou runtime MCP. M1.1B, C et D ne sont pas implémentées ; chaque slice future exige une autorisation distincte.

## Décisions de trajectoire gelées

### Authentification

```text
AUTHENTICATION_SEQUENCE=M1_EARLY
LOCAL_DEV_AUTH_MODE=LOCAL_TEST_ONLY
LOCAL_DEV_AUTH_REPLACES_EXTERNAL_IDP_ONLY=YES
LOCAL_DEV_AUTHORIZATION_BYPASS=NO
LOCAL_DEV_MUST_USE_REAL_SYNTHETIC_USERS_MEMBERSHIPS_ROLES_AND_TENANTS=YES
SHARED_INTERNAL_ENVIRONMENT_REQUIRES_REAL_OIDC=YES
```

### IA et agent

```text
OPENAI_FIRST=YES
PROVIDER_ABSTRACTION_FROM_DAY_ONE=YES
ONE_BOUNDED_AGENT_FIRST=YES
MULTI_AGENT_SWARM_NOW=NO
READ_ONLY_TOOLS_BY_DEFAULT=YES
HUMAN_CONFIRMATION_BEFORE_MUTATION=YES
DIRECT_MODEL_DATABASE_ACCESS=NO
```

M2 comparera Spring AI et le SDK Java officiel derrière le même port interne ; aucun framework, SDK, modèle ou provider n'est choisi par M0. M3 introduira un registre d'outils typé et MCP-adaptable, sans runtime MCP.

### Model Context Protocol

```text
MCP_STRATEGIC_PRIORITY=CONFIRMED
MCP_READINESS_FROM_M2_M3=YES
INTERNAL_TOOL_REGISTRY_MCP_ADAPTABLE=YES
MCP_RUNTIME_TARGET=M6
MCP_CLIENT_FIRST=YES
MCP_SERVER_ONLY_ON_PROVED_EXTERNAL_CLIENT_NEED=YES
```

MCP signifie `Model Context Protocol`. Le runtime cible M6 commence côté client read-only ; un serveur Ritomer exige un besoin client externe réel et une autorisation distincte.

### Site public

```text
PRODUCT_FIRST=YES
PUBLIC_WEBSITE_AFTER_STABLE_INTERNAL_ALPHA=YES
PUBLIC_WEBSITE_BEFORE_EXTERNAL_BETA=YES
```

M7 attend une alpha M5 stable, des captures réelles, un slice IA-native fonctionnel, un positionnement stable, des formulations sécurité honnêtes et une démo répétable.

## Principes V1

- workflow closing réel avant sophistication ;
- REST first ;
- monolithe modulaire Kotlin/Spring Boot ;
- IA structurée, evidence-first et bornée ;
- tests d'isolation cross-tenant bloquants ;
- tenant-scoping applicatif autoritaire, RLS seulement sur trigger explicite ;
- observabilité, audit, budgets, arrêt et mode dégradé dès l'étape qui les exige.

## Handoff vivant

### Livre
- `specs/done/001-foundation-bootstrap.md`
- `specs/done/002-core-identity-tenancy-closing.md`
- `specs/done/003-import-balance-v1.md`
- `specs/done/004-frontend-foundation-design-system.md`
- `specs/done/005-manual-mapping-v1.md`
- `specs/done/006-controls-v1.md`
- `specs/done/007-financial-summary-v1.md`
- `specs/done/008-financial-rubric-taxonomy-v2.md`
- `specs/done/009-financial-statements-structured-v1.md`
- `specs/done/010-workpapers-v1.md`
- `specs/done/011-document-storage-and-evidence-files-v1.md`
- `specs/done/012-evidence-review-and-verification-v1.md`
- `specs/done/013-exports-audit-ready-v1.md`
- `specs/done/014-frontend-controls-readiness-cockpit-v1.md`
- `specs/done/015-frontend-closing-folders-entrypoint-v1.md`
- `specs/done/016-frontend-import-balance-v1.md`
- `specs/done/017-frontend-manual-mapping-v1.md`
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
- Incréments historiques `031a`, `031b` et `031c` livrés par les PR #40, #41 et #42 : hygiène des logs sensibles, regression pack des invariants pilote et validation frontend fail-closed. Aucun fichier de spec 031 n'a existé et aucune spec rétroactive n'est inventée.
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
- `specs/done/044-design-partner-readiness-v1.md` — paquet documentaire docs-only de Design Partner Readiness livré et clôturé, sans recherche terrain ni autorisation externe.
- `specs/done/045-design-partner-research-protocol-v1.md` — `DONE / DOCS_ONLY_RESEARCH_PROTOCOL_DELIVERED` ; protocole documentaire versionné et fail-closed livré et clôturé, sans recherche, collecte, donnée réelle, activité externe ni runtime.

### Active

```text
ACTIVE_SPEC=046_AUTHENTICATED_SESSION_FOUNDATION_V1
ACTIVE_SPEC_COUNT=1
SPEC_046=ACTIVE
M1_1A_SCOPE=BACKEND_AUTH_TENANT_FOUNDATION_WITH_CORRECTIVE_M8
M1_1_FINAL_OUTCOME_DELIVERED=NO
M1_1B_IMPLEMENTED=NO
M1_1C_IMPLEMENTED=NO
M1_1D_IMPLEMENTED=NO
```

- `specs/active/046-authenticated-session-foundation-v1.md` — M1.1A avec son correctif M8 borne la fondation backend auth/tenant ; l'outcome final M1.1 n'est pas livré.

### Clôturé terminalement / résultat inconclusif

- `specs/done/043-controlled-fiduciary-pilot-readiness-v1.md` — `DONE_TERMINALLY_CLOSED / STOPPED_INCONCLUSIVE / SUCCESSFULLY_DELIVERED=NO`.
- `043a` demeure livré.
- `043b` demeure `LOCAL_SYNTHETIC_SIMULATION_VALIDATED`, uniquement sur données synthétiques locales et sans preuve de séparation réelle des fonctions.
- `043c` s’est terminé par `STOP_AND_RECORD_INCONCLUSIVE`. R1 et R2 n’ont jamais été exécutés et la préparation externe n’a pas été prouvée.
- La PR #114 a été fermée sans merge. Son head et sa branche sont forensiques uniquement ; l’implémentation rejetée est `NOT_EXECUTABLE` et ne doit pas être reprise.
- Le classement sous `specs/done/` signifie, pour 043 uniquement, `TERMINALLY_CLOSED_NOT_SUCCESSFULLY_DELIVERED`. Il ne place pas 043 parmi les livraisons réussies et ne redéfinit pas la sémantique des autres specs Done.

```text
043_FINAL_STATUS=STOPPED_INCONCLUSIVE
043C_R1_EXECUTED=NO
043C_R2_EXECUTED=NO
043C_EXTERNAL_READINESS_PROVED=NO
043C_MUST_NOT_RESUME=YES

CLOSURE_EMITS_NEW_AUTHORIZATION=NO
ROADMAP_DIRECTION_SELECTED=YES
M0_STATUS=DONE_CANONICAL_ROADMAP_REBASELINE
M0_SNAPSHOT_NEXT_MILESTONE=M1_AUTHENTICATED_PRODUCT_SHELL
M0_SNAPSHOT_LIFECYCLE=NO_SPEC_IN_EXECUTION
M0_SNAPSHOT_SPEC_NUMBER=NONE
M0_SNAPSHOT_046_STATE=NOT_CREATED_AT_REBASELINE
M0_SNAPSHOT_M1_IMPLEMENTATION_AUTHORIZED=NO
045_SURFACE=DOCS
045_RISK_CLASS=C
045_EVIDENCE_LEVEL=FULL

PHASE_1_PUBLICATION_AUTHORIZED=NO
PHASE_1_OUTREACH_AUTHORIZED=NO
PHASE_1_INTERVIEW_AUTHORIZED=NO
PHASE_1_COLLECTION_AUTHORIZED=NO
PHASE_1_EXTERNAL_ACCESS_AUTHORIZED=NO
PHASE_1_REAL_DATA_AUTHORIZED=NO
PHASE_1_RUNTIME_AUTHORIZED=NO
```

Le paquet documentaire docs-only de 044 reste livré et clôturé sous `specs/done`. La spec 045 a livré et clôturé son outcome documentaire docs-only ; aucune recherche, collecte, donnée réelle, activité externe ou exécution runtime n'en découle. Ces outcomes docs-only ne créent aucune autorisation externe et ne définissent plus la direction de roadmap. La spec 046 est l'unique spec active. M1.1A avec son correctif M8 borne la fondation backend auth/tenant ; l'outcome final M1.1 n'est pas livré et B, C et D ne sont pas implémentées.

Les sections 2 à 22 de la spec Done conservent le protocole substantiel livré et ne constituent aucune autorisation. La direction M0–M8 provient d'une décision owner distincte de la clôture 043 et des outcomes 044/045. Toute modification matérielle reprend la boucle de preuve applicable. Les marqueurs lifecycle conservés dans les blocs M0 de `README.md` et `docs/product/product-roadmap.md` sont des snapshots historiques de la rebaseline M0 ; ils ne décrivent pas l'état présent. Pour M1.1, cette section et la spec active 046 portent uniquement les vérités durables de périmètre ; les états de review, delivery, merge et décision owner restent dans les Evidence Packs, la pull request et les records spécialisés.

### Backlog

- `specs/backlog/042-controlled-ai-mapping-runtime-pilot-v1.md` - pause `PAUSED_BY_SEPARATE_CPO_DECISION`, jamais Done, preuves et blocages integralement conserves.

### Snapshot historique du sequencing 043 avant clôture

Le bloc suivant conserve la chronologie pré-clôture. Ses états « courants », prochaines actions, commandes et gates 043c sont historiques, sans autorité actuelle, et ne doivent pas être exécutés ou repris.

<!-- 043_V1_PLAN_HISTORICAL_BEGIN -->
- `043a` livre uniquement la foundation documentaire, les fixtures synthetiques gelees, leur validation, l'adaptation du checker et la roadmap canonique. Surface `DOCS_GIT / FIXTURES_SYNTHETIQUES / GOVERNANCE_CHECKS`, risque B.
- La revue CPO distincte de `043a` et le CTO Gate pre-code de `043b` sont satisfaits. Le CTO Gate approuve l'architecture locale avec les conditions obligatoires `C1` a `C9`.
- Etat courant de `043b`, ferme documentairement le `2026-07-27` : `LOCAL_SYNTHETIC_SIMULATION_VALIDATED / MERGED / AI_REVIEWED / OWNER_RISK_ACCEPTED_FOR_LOCAL_SYNTHETIC_ONLY / NOT_HUMAN_SIGNED / NOT_PRODUCTION_READY / NOT_EXTERNAL_READY / NOT_SEPARATION_OF_DUTIES_PROOF`.
- Historique pre-cloture de `043b`, arrete au `2026-07-22` : avant le hotfix Minimum Viable Safety, le merge etait classe `MERGED_WITH_KNOWN_HIGH_FINDINGS` et son usage local `LOCAL_USE_PAUSED`. Apres implementation et checks sans DB, son etat maximal etait `MINIMUM_VIABLE_SAFETY_IMPLEMENTED / PENDING_LOCAL_EVIDENCE / NOT_MERGE_READY` sur les surfaces `BACKEND_LOCAL_AUTH / BACKEND_TEST_SAFETY / FRONTEND_LOCAL_HARNESS / CI_GIT / DOCS_GIT / SECURITY_DEBT_GOVERNANCE`. Le risque etait C pour la securite destructive PostgreSQL et B pour le reste.
- 043b is a local single-operator two-role simulation. It validates backend RBAC behavior under two synthetic identities. It does not establish independent human sessions or segregation of duties.
- 043b est une simulation locale mono-opérateur de deux rôles. Elle valide le comportement RBAC du backend sous deux identités synthétiques. Elle n'établit ni deux sessions humaines indépendantes ni une séparation des fonctions.
- Sa classification est `LOCAL_TWO_ROLE_SIMULATION / SINGLE_OPERATOR_CAPABLE / SYNTHETIC_ONLY / LOOPBACK_ONLY / NOT_PRODUCTION_AUTH / NOT_INDEPENDENT_ACTOR_BOUNDARY / NOT_PROOF_OF_SEGREGATION_OF_DUTIES / NOT_FOR_EXTERNAL_USE / NOT_FOR_REAL_DATA`. Les ports `5173` et `5174` restent des contextes visuels distincts, sans constituer une frontiere d'identite.
- Le seed opt-in `043b-two-actor-pilot` est classe `HARNESS_ONLY_AUTH_RBAC_DATASET`. Il ne prouve ni l'import de la fixture gelee `043a`, ni le closing complet, ni `043c`, ni `R1/R2`, ni la readiness externe.
- Historique pre-cloture arrete au `2026-07-22` : les artefacts de review etaient `AI_TECHNICAL_REVIEW=COMPLETED_WITH_FINDINGS`, `AI_SECURITY_PRIVACY_REVIEW=COMPLETED_WITH_FINDINGS`, `AI_CTO_REVIEW=COMPLETED_WITH_CONDITIONS`, `OWNER_RISK_ACCEPTANCE=ACCEPTED_FOR_LOCAL_SYNTHETIC_ONLY`, `HUMAN_TECHNICAL_REVIEW=DEFERRED_TO_EXTERNAL_GATE`, `HUMAN_SECURITY_REVIEW=DEFERRED_TO_EXTERNAL_GATE`, `REVIEW_ARTIFACT_CLASSIFICATION=AI_GENERATED_REVIEW` et `REVIEW_SIGNATURE_STATUS=NOT_HUMAN_SIGNED`; les reviews IA finales post-code et le smoke local restaient alors pendants, avec `smoke_local_real=NOT_RUN_USER_LOCAL_REQUIRED`.
- Revues et acceptation courantes de cloture `043b` : `FINAL_AI_TECHNICAL_REVIEW=PASS`, `FINAL_AI_SECURITY_PRIVACY_REVIEW=PASS`, `OWNER_RISK_ACCEPTANCE=ACCEPTED_FOR_LOCAL_SYNTHETIC_ONLY`, `HUMAN_TECHNICAL_REVIEW=DEFERRED_TO_EXTERNAL_GATE`, `HUMAN_SECURITY_REVIEW=DEFERRED_TO_EXTERNAL_GATE`, `REVIEW_ARTIFACT_CLASSIFICATION=AI_GENERATED_REVIEW` et `REVIEW_SIGNATURE_STATUS=NOT_HUMAN_SIGNED`. Aucune revue humaine n'est declaree realisee. `smoke_local_real=PASS_FRESH_DISPOSABLE_DB`.
- Historique Codex conserve du `2026-07-13` : checks backend unit/modulith/build, frontend syntax/targetes/complets/lint/build, fixtures gelees et gouvernance historique verts ; `dbIntegrationTest=ENV_BLOCKED_DB_INTEGRATION` car la task PostgreSQL avait ete `SKIPPED`; checker courant `CHECK_BLOCKED_APPROVED_FILE_SET`; smoke anterieur `NOT_RUN`; checks sans DB anterieurs `PASS_COMBINED_EVIDENCE`. Ces preuves datees ne sont pas reecrites.
- Hotfix `043b` du `2026-07-22` : file-set ferme a 26 chemins, decoder HS256 strict reserve aux profils `local | test | dbtest`, secret runtime sans fallback, TTL maximal 3 600 secondes, garde destructive globale pre-Flyway sur les 12 classes DB, validation et destruction sur la meme connexion/transaction, et checker historique additif `043b-hotfix` lisant exclusivement les blobs du head. Les tests DB, seed, backend/Vite reels et smoke navigateur restent non executes dans cette boucle.
- Fermeture factuelle `043b` du `2026-07-27` : PR `#103`, `base=b46fb0d6dcfb2eca7d317ddfeaf34371686e7030`, `source=13b297a6d4c6bb0ccd0d9ffb2052314275c7e273`, `merge=a484cd321066e65839aaa9d2b899db4620461f93`, `26` chemins (`24M / 2A`), identite des arbres source/merge `PASS`, Backend CI `PASS` et Frontend CI `PASS`.
- Preuve PostgreSQL finale `043b` : base dediee `ritomer_043b_test`, role dedie `ritomer_043b_test_runner`, tests cibles `8 PASS_EXECUTED`, suite complete `48 PASS_EXECUTED` dans `12` classes, cleanup de la base et du role `PASS`.
- Preuve runtime finale `043b` : backend `127.0.0.1:8080`, proxy ACCOUNTANT `127.0.0.1:5173` et proxy REVIEWER `127.0.0.1:5174` `PASS`; meme tenant, roles distincts et matrice RBAC `PASS`; header d'authentification visible dans le navigateur `NO`; JWT detecte dans HTML, URL, `localStorage`, `sessionStorage` ou cookies `NO`; arret coordonne et cleanup runtime `PASS`; `realSmoke=PASS_FRESH_DISPOSABLE_DB`.
- Verification post-merge finale `043b` : `main` alignee avec `origin/main`, worktree propre, identite des arbres source/merge et verification post-merge `PASS`.
- `043c simplified rehearsal defined; execution not authorized; R1/R2 not started`. L'outcome Phase 0 est maintenant borne a deux repetitions internes T00-T15 sur fixtures synthetiques gelees et ressources locales fraiches, avec audit `15/0/0`, resume de preuve hashe par run et cleanup prouve avant R2 puis apres R2. Une review pre-execution et une autorisation sensible distincte restent obligatoires pour chaque run. Les revues humaines techniques et Security restent differees au gate externe; toute donnee reelle/client, tout utilisateur ou participant externe, pilote externe, deploiement partage, acces non-loopback, auth/secret de production, premiere utilisation commerciale, provider IA externe, MCP expose ou affirmation de vraie separation des fonctions retablit les gates humains.
- `043b` n'introduit aucun participant externe, aucune auth production, aucun provider ou appel IA, aucun MCP, aucun contrat/OpenAPI, aucune migration, aucune dependance et aucune spec `044+`.
- `043b` a valide uniquement une simulation locale technique pour la readiness de niveau A. La trajectoire `043c` simplifiee est definie sans rail d'autorite actif suivi dans Git; R1 et R2 restent non demarres et non autorises. L'ancien rail v1 et le head rejete de la PR #110 sont `HISTORICAL / SUPERSEDED / NOT_EXECUTABLE`. La PR et son head sont conserves comme preuves forensiques ; ils ne sont ni reutilisables, ni rebasables, ni mergeables. Le package V3 reste `FORENSIC_ONLY / NOT_EXECUTED`. Aucun fiduciaire externe n'est invite et aucune observation participante reelle n'est collectee.
- La premiere invitation exige une nouvelle decision CPO ainsi que les gates fiduciaire et Security/Privacy. `GO_TO_EXTERNAL_GATE_REVIEW` ne vaut ni invitation ni collecte.
- Aucune spec suivante n'est creee automatiquement.

<!-- 043_V1_PLAN_HISTORICAL_END -->

### Rappels historiques et preuves 042 conservees

- `042-controlled-ai-mapping-runtime-pilot-v1` etait active pendant les increments ci-dessous en SPEC_CREATION DOCS_ONLY, avec une surface `BACKEND_RUNTIME_INTERNE / EVALS` strictement limitee a `042a2a3`, puis `CONTRACTS / BACKEND_RUNTIME_INTERNE / FRONTEND_CONSUMER` pour `042a2a4`, puis `BACKEND_RUNTIME_LOCAL / CONTRACTS / DOCS_GIT` pour `042a2a5a`, `FRONTEND / DOCS_GIT` pour `042a2a5b`, `042a2a5c` et `042a2a5e`, `BACKEND_RUNTIME_LOCAL / DOCS_GIT` pour `042a2a5d`, `DOCS_ONLY / AI_GOVERNANCE / FIDUCIARY_GOVERNANCE` pour `042a2a6`, et `DOCS_GIT / EVALS / AI_GOVERNANCE / FIDUCIARY_GOVERNANCE / SECURITY_PRIVACY` strictement non operationnelle pour `042a2a6a`, afin de cadrer le premier pilote IA runtime reel strictement limite aux suggestions de mapping sur dossier demo synthetique. `042a1` ajoute uniquement un gate pack draft de gouvernance/readiness (`PENDING_EVIDENCE` ou `DRAFT`) avant tout code provider `042b`. `042a2a1` ajoute uniquement un semantic readiness pack draft avant tout contrat `mapping-suggestion-v2`; `042a2a1b` durcit ce pack et ajoute le manifeste draft de perimetre pilote, avec records `DRAFT` ou `PENDING_EVIDENCE`, sans runtime, provider, backend, frontend, DB/migration, OpenAPI, CI, contrat, prompt runtime, golden set, validator, secret, `.env`, appel reseau IA, production, donnee cliente reelle ou spec `043`. `042a2a2a` ajoute uniquement un snapshot taxonomie candidat minimal, une projection demo synthetique de-mappee et leur validator deterministe, tous `CANDIDATE / PENDING_EVIDENCE / NOT_AUTHORITATIVE`, sans golden set approuve, contrat, provider, runtime, prompt, secret, `.env`, appel IA ou spec `043`. Le pack de cas candidats `042a2` ajoute `candidate-semantic-cases-v1.json`, `candidate-policy-fault-cases-v1.json` et `validate-042a2-candidate-cases.ps1`, tous `CANDIDATE / PENDING_DOUBLE_REVIEW / NOT_GOLDEN / NOT_AUTHORITATIVE`, sans contrat, provider, runtime, prompt, backend/frontend, DB/migration, OpenAPI, secret, `.env`, appel IA ou spec `043`. Le pack de double revue aveugle `042a2` ajoute deux paquets independants, un schema de reponse strict, un builder et un validator, tous `BLIND_REVIEW_INPUT / PENDING_INDEPENDENT_REVIEW / NOT_GOLDEN / NOT_AUTHORITATIVE`, sans reponses humaines, adjudication, promotion golden set, contrat, provider, runtime, prompt, backend/frontend, DB/migration, OpenAPI, secret, `.env`, appel IA ou spec `043`. `042a2a3` ajoute un moteur offline Kotlin interne dans `mapping.application`, des providers de test fake/fault et une task Gradle `offlineMappingEval042a2` pour executer les 17 cas sans reseau, avec rapport `CANDIDATE_EVAL / NOT_GOLDEN / NOT_AUTHORITATIVE / NOT_MODEL_QUALITY`, sans provider reel, endpoint, OpenAPI, DB/migration, contrat public, secret, `.env`, production ou spec `043`. `042a2a4` ajoute uniquement le contrat normalise `mapping-suggestion-v2` a scope strict, l'OpenAPI v2 contract-only avec `paths: {}` et `taxonomyHash`, un corpus contractuel partage, un transformer offline backend avec fingerprint reserve aux suggestions et un parser Zod frontend strict, sans provider reel, endpoint actif, controller, wiring Spring, DB/migration, ecran, auto-apply, bulk apply, secret, `.env`, appel reseau IA, production ou spec `043`. `042a2a5a` expose uniquement `GET /api/closing-folders/{closingFolderId}/mappings/suggestions-v2` en backend local read-only, profile `local` + flag default-off, allowlist demo synthetique immutable, sans provider reel, reseau IA, secret, DB/migration, decision, audit de decision, bascule v1, auto-apply, bulk apply, production ou spec `043`.
- `042a2a5b` livre la premiere simulation UI locale offline v2, sans decision v2, provider, appel reseau IA, fallback v1 automatique, auto-apply, bulk apply, production ou spec `043`.
- `042a2a5c` ameliore uniquement l'UX/frontend de simulation locale offline v2 avec posture non autoritative, counts par outcome et affectation manuelle comme autorite, sans backend, contrat, provider, secret, appel reseau IA, decision v2, fallback v1 automatique, auto-apply, bulk apply, production ou spec `043`.
- `042a2a5d` ajoute uniquement une variante seed locale opt-in `042a2a5d-mixed-v2` pour prouver un scenario local `mapping-suggestion-v2` mixte sur dossier synthetique separe : le seed principal 036a reste complet avec 6 lignes et 6 mappings, la variante porte 6 lignes et 4 mappings, puis le moteur offline produit naturellement `SUGGESTION=1`, `ABSTENTION=1`, `PRECONDITION_BLOCK=4`, `POLICY_BLOCK=0` et `TECHNICAL_DEGRADATION=0`.
- Implementation `042a2a5` achevee avec PR #96, puis cloture documentaire partielle local offline POC integree par PR #97 : `042a2a5a` endpoint local offline read-only livre, `042a2a5b` premiere simulation UI locale livree, `042a2a5c` amelioration UX locale livree, `042a2a5d` variante seed locale opt-in livree, `042a2a5e` polish libelles utilisateur livre. Smokes utilisateur locaux `042a2a5c=PASS`, `042a2a5d=PASS`, `042a2a5e=PASS`. Scenario mixte local prouve avec `SUGGESTION=1`, `ABSTENTION=1`, `PRECONDITION_BLOCK=4`, `POLICY_BLOCK=0`, `TECHNICAL_DEGRADATION=0`; seed principal `036a` inchange; raw enums visibles dans l'UI utilisateur = `NO`; libelles metier visibles = `YES`; boutons `ACCEPT` / `CORRECT` / `REJECT` visibles = `NO`; fallback v1 automatique observe = `NO`; appel reseau provider observe = `NO`; appel post decision v2 observe = `NO`. Cette cloture partielle n'introduit aucun provider, aucun appel reseau IA, aucun secret, aucun `.env`, aucune DB/migration, aucun endpoint nouveau hors endpoint local deja livre, aucun changement de contrat public, aucune decision v2, aucun auto-apply, aucun fallback v1 automatique, aucune production et aucune spec `043`; `042` reste active et `042b` / provider restent bloques avec `provider_runtime=STILL_BLOCKED`, `adapter_provider=NOT_AUTHORIZED`, `retry_remaining=0`, `fallback=FORBIDDEN`. OpenAI reste un provider candidat bloque et non approuve.
- `042a2a6` formalise uniquement le protocole DOCS_ONLY de collecte, validation, gel, comparaison et adjudication des futures reponses humaines 042a2. Etat courant : `PENDING_HUMAN_RESPONSES`. Aucun fichier de reponse, aucune adjudication et aucun golden set 042a2 ne sont crees ; `PENDING_ADJUDICATION`, `ADJUDICATED_NOT_GOLDEN`, `GOLDEN_CANDIDATE_PENDING_GOVERNANCE` et `GOLDEN_APPROVED` restent des transitions futures gouvernees, sans provider, retry, appel IA, secret, `.env`, runtime, contrat, production ou spec `043`.
- `042a2a6a` durcit distinctement ce protocole sans le reecrire : schemas documentaires `DRAFT / NOT_EXECUTABLE / NOT_DISTRIBUTABLE / NOT_VALIDATED_BY_DRAFT_2020_12_ENGINE`, baseline ledger `HARDENING_ONLY` sans transition ni preuve humaine, instructions answer-free, runbook coordinateur non executable et checker structurel Node built-in. L'etat reste `PENDING_HUMAN_RESPONSES`; human responses=`0`, adjudication=`0`, golden set `042a2`=`0`; collection/distribution/provider/golden promotion/adjudication/retry restent tous `false`. La revue Security/Privacy du diff correctif reste `REQUIRED_BEFORE_MERGE`, puis une nouvelle confirmation operationnelle reste `REQUIRED_BEFORE_DISTRIBUTION`; sous-livrable 2=`STOP_DEPENDENCY_REQUIRED`, sans bibliotheque selectionnee ni dependance ajoutee. `provider_runtime=STILL_BLOCKED`, `adapter_provider=NOT_AUTHORIZED`, `retry_remaining=0`, `fallback=FORBIDDEN`; `042` reste active et aucune spec `043` n'est creee. JSON syntax and repository invariants checked; Draft 2020-12 semantic validation not performed.
- Ratifications/gates correctifs 042a2a6a : `PR #99 technical exact-diff ratification = RATIFIED_WITH_NON_BLOCKING_CORRECTIONS`; `PR #99 Security/Privacy exact-diff ratification = RATIFIED_WITH_CONDITIONS_BEFORE_USE`; `corrective diff Security/Privacy review = REQUIRED_BEFORE_MERGE`; `IA Governance / fiduciary review of D/E/F = REQUIRED_BEFORE_MERGE`; `operational Security/Privacy confirmation = REQUIRED_BEFORE_DISTRIBUTION`. Ces mentions ne sont ni signatures ni autorisations. Aucune reponse humaine n'est destinee a Git; les futures instances restent pseudonymisees, non anonymes, avec custody, stockage et validateur de contenu encore requis avant distribution. Toutes les autorisations restent `false`.
- Etat courant `042b0` : le repo possede `mapping-suggestion-v2` comme read-model Ritomer normalise, un moteur offline deterministe, un endpoint local synthetic-demo-only, une UI locale de simulation renforcee pour le POC interne avec counts par outcome et posture non autoritative, une variante seed locale opt-in `042a2a5d-mixed-v2`, aucun provider reel, aucun appel reseau IA, aucun secret et aucun runtime provider. `mapping-suggestion-v1` reste inchange et v2 ne provoque aucune bascule implicite.
- `030d runtime` provider reel general reste reporte hors pilote `042` : aucun provider IA reel, modele reel, SDK, prompt runtime actif, cout provider, appel reseau IA reussi, microservice IA, GraphQL, RAG/vector store ou auto-apply ne sont actifs tant que les gates pre-code de `042` ne sont pas signes et qu'une implementation explicite n'est pas lancee. Le gate d'activation reseau provider reste distinct : aucun nouvel appel provider n'est autorise avant gate d'activation formel, meme apres une future implementation `042b`; le chemin canary `042b1` est ferme avec `retry_remaining=0`.
- `042b` reste bloque tant que les gates pre-code `042a` ne sont pas signes et merges, tant que provider-readiness, signatures humaines, privacy/legal, region, retention, training/non-training, logging, cout runtime, latence, quotas RPM/TPM, budget cap runtime, kill switch, log hygiene, golden set autoritatif, validator et gate reseau restent incomplets ou `PENDING_ACCOUNT_PROOF`. La visibilite projet de l'exact model id / snapshot `gpt-5.4-mini-2026-03-17` est maintenant `PROUVÉ_PAR_UI_PLATFORM_MANUELLE`, mais elle ne debloque ni runtime provider ni appel reseau. Les artefacts candidats `042a2a2a`, le pack de cas candidats `042a2`, le pack de double revue aveugle `042a2`, la tentative `042b1a` et le retry final `042b1b` ne debloquent ni runtime provider ni appel reseau.
- `042b0` documente OpenAI API comme provider candidat uniquement pour un futur pilote IA runtime : endpoint candidat `/v1/chat/completions`, domaine candidat `eu.api.openai.com`, modele candidat public `gpt-5.4-mini`, exact model id / snapshot exact candidat visible `gpt-5.4-mini-2026-03-17`. `042b0b` ajoute les preuves manuelles OpenAI Platform/API : projet dedie `ritomer-dev`, billing API active, credits `$10`, auto recharge `OFF`, project spend limit `$10`, spend alert `100 % / $10`, modeles autorises `gpt-5.4-mini` et `gpt-5.4-mini-2026-03-17`, API key status before canary `NOT_CREATED_USER_CONFIRMED`, API key not created/shared before canary, et aucun appel reseau IA effectue par ce record. `042b0c` ajoute uniquement les preuves security/privacy preflight observees manuellement : API keys actives visibles `0`, usage API `$0.00`, total requests `0`, total tokens `0`, data controls visibles, API call logging `ENABLED_PER_CALL_UI_OBSERVED`, audit logging `NOT_ENABLED_UI_OBSERVED`, et rappels officiels OpenAI sur data controls, data residency `Europe (EEA + Switzerland)`, prepaid billing et audit logging. `042b1a` documente une tentative locale canary non concluante vers `POST /v1/chat/completions` sur `api.openai.com`, modele `gpt-5.4-mini-2026-03-17`, payload public non metier/non Ritomer/non client, `store=false` et aucun outil : premiere tentative `FAIL NON_HTTP / ArgumentException`, deuxieme tentative `FAIL NON_HTTP / RuntimeException`, aucun HTTP 200, aucun modele retourne, aucun usage provider valide et aucun network PASS, secret shared with ChatGPT/Codex/GitHub `NO`. `042b1b` documente le seul retry controle autorise : execution locale utilisateur via `curl.exe`, meme endpoint/host/modele unique, `store=false` demande, aucune donnee Ritomer/client/tenant/mapping/compte/document/CSV/workpaper, ChatGPT exposure `YES_ONE_TEMPORARY_KEY_PASTED_AND_TREATED_AS_COMPROMISED`, API key value recorded in repo/Codex/GitHub `NO`, exposed key value recorded in repo `NO`, retry execution secret value `NOT_RECORDED`, resultat sanitise `FAIL_HTTP_400_INVALID_REQUEST_ERROR`, final `STOP_NO_FALLBACK`, aucun HTTP 200, aucun modele retourne, aucun token d'usage retourne, active keys after revocation `0`, usage projet `$0.00`, total requests `0`, total tokens `0`, Responses and Chat Completions `0 requests / 0 input tokens`, July spend `$0.00 / $10.00`, auto recharge non revalide par les captures post-`042b1b`. Aucun fallback automatique vers alias, autre modele, autre region, Responses API ou autre provider n'est autorise. `042b0` / `042b0b` / `042b0c` / `042b1a` / `042b1b` ne livrent aucun runtime, adapter, SDK, secret, `.env`, appel IA reussi, prompt runtime actif, golden set promu, production ou spec `043`, et ne debloquent pas `042b`; `retry_remaining=0`.
- `036-local-integrated-demo-real-backend-seed-v1` est livre : 036a a livre une commande backend de seed demo dev-only PostgreSQL local, default off, fail-fast hors `local`/`test`/`dbtest`, sans secret commite, sans donnees client reelles, sans bypass auth, sans IA runtime, sans GraphQL et sans Docker impose ; 036b a livre un smoke backend `dbIntegrationTest` de vraie validation JWT sur `/api/me` et tenant membership ; 036c a livre un proxy Vite dev-only `/api` vers backend local avec injection bearer optionnelle strictement cote serveur Vite et shell local, sans token navigateur, sans backend runtime durable et sans auth frontend durable. Aucun endpoint de mint token, aucune commande JWT, aucun backend runtime durable supplementaire, aucun OpenAPI, aucune migration DB, aucune IA runtime et aucun GraphQL ne sont ajoutes par la cloture 036.
- `040-internal-poc-global-smoke-v1` est cloturee en verdict `PARTIEL` : dossier demo ouvert, frontend `/api/me` via proxy `200`, backend `/api/me` direct sans JWT `401`, cockpit/import/suggestions/previews/export/annexe globalement atteignables, aucun token ni secret observe, mais parcours non comprehensible en 10 minutes, statut cockpit insuffisamment clair, mapping trop dense, rubriques Preuves trop anglo-techniques, montants Import trop bruts, libelles techniques residuels, header `Authorization` non verifie explicitement, absence IA runtime non verifiee explicitement et health backend direct non prouve dans ce bloc.
- `041-internal-poc-blockers-ux-readiness-v1` est cloturee en `PASS global` pour readiness POC interne : `041a` a rendu le statut cockpit plus explicite et les montants Import lisibles en CHF ; `041b` a rendu le mapping plus premium, calme, scannable et responsive ; `041c` a rendu les rubriques Justifications / Preuves plus francaises, metier et actionnables ; `041d` a documente l'hygiene reseau, l'absence de fuite bearer observee et l'absence d'appel IA externe observe. Le smoke global final documente backend health `200`, `/api/me` direct sans JWT `401`, `/api/me` via Vite `200`, parcours compris en moins de 10 minutes, aucune friction majeure restante et produit suffisamment robuste/professionnel pour poursuivre vers le POC. Dettes non bloquantes : accents/typographie encore perfectibles, certaines cibles Mapping encore partiellement anglophones, design premium final encore ameliorable et warning Vite chunk `> 500 kB` non bloquant. Aucun runtime, backend, DB/migration, OpenAPI, auth/JWT/proxy, nouvelle mutation, nouveau endpoint, IA runtime, GraphQL, export officiel, annexe legale finale, promesse CO/statutaire, secret, `.env`, token, credential ou spec `042` n'est introduit par cette cloture documentaire.
- `041` reste Done / `PASS global`.
- Snapshot historique antérieur à la rebaseline M0 : `042` figurait dans le backlog sous `PAUSED_BY_SEPARATE_CPO_DECISION`; `043` était terminalement close avec `STOPPED_INCONCLUSIVE / SUCCESSFULLY_DELIVERED=NO`, `043a` livré, `043b` validé en simulation locale synthétique, `043c` arrêté, R1/R2 non exécutés et reprise interdite. La direction alors documentée était `PHASE_1_DESIGN_PARTNER_READINESS` sous `DOCS_ONLY_PREPARATION`; ce snapshot ne porte aucun routage présent.
- Rappel de cloture `039` : aucun backend, aucune DB/migration, aucun OpenAPI, aucune auth/JWT/proxy, aucune IA runtime, aucun GraphQL, aucune nouvelle mutation, aucun nouveau seed, aucune nouvelle donnee demo, aucune CI et aucun secret/token/credential/valeur `.env` ne sont ajoutes par cette cloture documentaire. La dette residuelle de jugement global a ete traitee par le smoke `040`, cloture en `PARTIEL`, et les blockers POC sont maintenant cadres par `041`.

### Decisions figees
- Le flux V1 livre est maintenant `closing -> import -> mapping manuel + mapping assiste no-provider -> controls -> financial-summary -> financial-statements-structured -> workpapers -> document-storage-and-evidence-files -> exports-audit-ready -> minimal-annex`.
- Les endpoints canoniques restent sous `/api/closing-folders/...`.
- `controls-v1`, `financial-summary-v1`, `financial-statements-structured-v1` et `minimal-annex-v1` sont des read-models derives, `GET only`, sans persistance de resultat.
- `financial-summary-v1` reste une preview ultra-synthetique, non statutaire, non export final, non conforme a une presentation CO detaillee, et peut rester partielle tant que le closing n'est pas `PREVIEW_READY`.
- `financial-statements-structured-v1` reste une `STRUCTURED_PREVIEW`, avec `isStatutory = false`, sans export final ni presentation CO detaillee complete, et n'expose aucun etat structure hors `PREVIEW_READY`.
- La taxonomie de mapping publiee coexiste desormais en V1 / V2 ; les codes V1 restent legacy et compatibles, `financial-summary-v1` agrege via `summaryBucketCode`, et `financial-statements-structured-v1` structure via `summaryBucketCode` puis `sectionCode` avec fallback legacy explicite quand aucune section detaillee n'existe.
- `workpapers-v1` est la premiere couche de justification persistante du flux V1. Elle s'appuie sur les anchors courants de `financial-statements-structured-v1`, sans recalculer la finance ni persister de resultat financier.
- `workpapers-v1` reste backend-only, REST-only, anchor-driven, tenant-scoped et audit-ready, avec un noyau borne a `workpaper + evidence metadata + maker/checker minimal`.
- `GET /workpapers` expose tous les anchors courants meme sans workpaper persiste, et separe les persistences stale dans `staleWorkpapers[]`.
- `workpapers-v1` ne couvre ni upload binaire, ni signed URLs, ni stockage objet, ni PDF, ni export pack final, ni commentaires threades, ni generation automatique ; `013-exports-audit-ready-v1` ferme ensuite le pack `ZIP` immutable, prive et telecharge backend-only.
- Les lectures `GET` sur `workpapers` n'ecrivent aucun `audit_event`; les lectures sur `ARCHIVED` restent autorisees, et les writes restent bloques si `controls.readiness != READY` ou sur closing `ARCHIVED`.
- `workpapers-v1` depend de `financials::access` pour ses anchors courants et n'introduit aucun couplage direct vers `imports` ou `mapping`.
- `document-storage-and-evidence-files-v1` et `evidence-review-and-verification-v1` etendent `workpapers-v1` sans creer de module transverse et apportent la premiere vraie couche binaire de pieces justificatives puis la premiere verification reviewer first-class sur ces documents.
- `document-storage-and-evidence-files-v1` garde `document` comme objet immutable first-class, sans duplication de `closing_folder_id`, derive via `workpaper`; `workpaper_evidence` reste la surface legacy metadata-only de `010-workpapers-v1`.
- `evidence-review-and-verification-v1` ajoute `document_verification` comme persistant unique `1:1` avec `document`, enrichit les read-models de `documents[]` avec l'etat reviewer et derive un `documentVerificationSummary` par workpaper.
- `document-storage-and-evidence-files-v1` enrichit `GET /workpapers` de facon additive avec `documents[]`, toujours present sur les anchors courants meme vide, et aussi present dans `staleWorkpapers[]`.
- `evidence-review-and-verification-v1` garde toutes les lectures `GET` lisibles sur current, stale et `ARCHIVED` sans `audit_event`, mais borne les writes reviewer document et reviewer workpaper a `controls.readiness = READY`, non `ARCHIVED`, current uniquement.
- `evidence-review-and-verification-v1` garde la decision finale reviewer sur `workpaper`, mais bloque `READY_FOR_REVIEW -> REVIEWED` tant que les documents attaches restent `UNVERIFIED`, sauf quand `documentsCount = 0`.
- `document-storage-and-evidence-files-v1` autorise les lectures sur current, stale et `ARCHIVED`, sans `audit_event` sur les `GET`; seul l'upload reussi ecrit `DOCUMENT.CREATED`.
- `022-frontend-document-upload-only-v1` ferme le premier upload frontend unitaire de document sur `/closing-folders/:closingFolderId`, strictement dans le bloc `Workpapers`, en gardant `GET /workpapers` comme read-model canonique avant et apres succes et en n'ajoutant que `POST /workpapers/{anchorCode}/documents`.
- `023-frontend-document-download-only-v1` ferme le premier download frontend unitaire de document sur `/closing-folders/:closingFolderId`, strictement dans le bloc `Workpapers`, en gardant `GET /workpapers` comme read-model canonique avant le clic, en n'ajoutant que `GET /documents/{documentId}/content`, et sans refresh apres succes ou echec.
- `024-frontend-workpapers-panel-extraction-v1` ferme l'extraction frontend stricte de la surface `Workpapers` dans `WorkpapersPanel`, sans nouvelle route produit, sans nouvel endpoint, sans changement backend ou OpenAPI, et sans reintroduire la logique locale Workpapers dans `router.tsx`.
- `025-frontend-document-verification-decision-only-v1` ferme la decision reviewer document unitaire dans `WorkpapersPanel`, sur les documents current eligibles deja visibles, en ajoutant seulement `POST /documents/{documentId}/verification-decision`, avec refresh local strict de `GET /workpapers` apres succes payload valide, sans decision reviewer workpaper, sans nouveau backend ni contrat OpenAPI.
- `evidence-review-and-verification-v1` ajoute `DOCUMENT.VERIFICATION_UPDATED` pour toute mutation reviewer reussie sur `document`, sans audit sur no-op, lecture, backfill ni creation automatique de la ligne initiale.
- `document-storage-and-evidence-files-v1` persiste les metadata en PostgreSQL, stocke le binaire en object storage prive, et impose un download backend-only sans signed URL publique.
- Le role de `document-storage-and-evidence-files-v1` dans la sequence V1 est de fermer le noyau evidence-first utile avant les couches d'export, d'annexe backend minimale et de mapping assiste no-provider.
- `exports-audit-ready-v1` ajoute le module proprietaire `exports`, une persistance immutable `export_pack`, un `ZIP` strictement deterministe et un replay idempotent durable borne par `export_pack` seul en V1.
- `exports-audit-ready-v1` assemble `controls`, `financial-summary`, `financial-statements-structured`, les current workpapers persistants et leurs documents visibles, sans exposition de `storage_object_key`, sans signed URL publique et sans audit sur les lectures.
- `027-annexe-minimale-v1` livre `GET /api/closing-folders/{closingFolderId}/minimal-annex` comme read-model backend deterministe, tenant-scoped, non statutaire, non persiste, non exporte, sans PDF, sans IA et sans `audit_event` sur `GET`.
- `028-docs-present-realignment-after-027-v1` a ferme une spec `DOCS_ONLY` de realignement documentaire cible du present UX/IA apres `027`, sans creation de capacite produit, sans changement runtime, sans rouverture de `027` et sans ouverture d'une spec produit suivante.
- `029-pilot-closing-workflow-e2e-confidence-hardening-v1` livre la vague frontend E2E pilote : dossier progress summary, audit-ready export pack UI, minimal annex preview UI et reviewer workpaper decision UI.
- `029a` rend l'etat global du dossier plus lisible depuis l'interface, sans validation automatique du closing.
- `029b` expose l'audit-ready export pack depuis l'interface avec creation/liste/telechargement backend-only, sans `storage_object_key`, sans signed URL publique et sans promesse de depot statutaire.
- `029c` expose la minimal annex preview en lecture seule avec posture non statutaire et revue humaine requise ; elle ne devient pas une annexe legale finale.
- `029d` expose la decision reviewer workpaper humaine via les gates existants ; elle ne constitue pas une approbation statutaire.
- `029` ne change pas la posture d'architecture : REST-first maintenu, aucun GraphQL, aucun backend nouveau a creer, aucune migration DB, aucun microservice IA et aucun contrat OpenAPI modifie par cette cloture.
- `029` ne change pas la posture IA : AI-ready, pas AI-led ; aucune IA runtime, aucune redaction IA d'annexe et aucune decision automatique.
- `030-ia-mapping-assiste-suggestion-review-v1` livre la premiere capacite de mapping assiste no-provider, evidence-first et human-in-the-loop : suggestions structurees, preuves visibles, decision humaine explicite et mapping manuel comme autorite metier.
- `030a` a stabilise `contracts/ai/mapping-suggestion.schema.json` et `contracts/openapi/mapping-suggestions-api.yaml` avec les noms canoniques `accountCode`, `accountLabel`, `suggestedTargetCode` et les decisions `ACCEPT`, `CORRECT`, `REJECT`.
- `030b` a livre le read-model backend `GET /api/closing-folders/{closingFolderId}/mappings/suggestions` avec adapter stub no-provider et feature flag.
- `030c`, `030d0` et `030d1` ont livre golden set, policy, runbook, provider-readiness record et dependency/security review sans approbation provider.
- `030d2` a durci la minimisation backend : la frontiere `ai::access` recoit un payload minimise avec `sanitizedAccountLabel` interne, tandis que le read-model public expose `accountLabel` depuis la ligne originale tenant-scoped.
- `030e0` et `030e` ont livre l'experience frontend de revue humaine des suggestions, sans appel modele direct ni stockage navigateur de suggestion.
- `030f` a livre `POST /api/closing-folders/{closingFolderId}/mappings/suggestions/{accountCode}/decision` avec `Idempotency-Key`, decisions unitaires et persistance tenant-scopee `mapping_suggestion_decision_request`.
- `ACCEPT` et `CORRECT` passent par la logique metier de mapping manuel existante ; `REJECT` ne cree ni ne modifie aucun mapping manuel.
- Le mapping manuel et le backend restent l'autorite metier. Aucune suggestion ne s'applique seule, aucune decision bulk n'est livree et `requiresHumanReview = true` reste obligatoire.
- Aucune capacite provider IA reelle n'est activee par `030`. `030d runtime` reste bloque par CPO approval, CTO Gate, security/privacy review, IA governance review, provider-readiness record signe, dependency/security review signee, payload whitelist signee, runbook pret et golden set vert.
- `032-controls-readiness-deterministic-consumer-hardening-v1` ferme le hardening frontend du consumer existant `GET /api/closing-folders/{closingFolderId}/controls` : validation fail-closed des payloads `/controls` incoherents, invalides ou contenant des cles sensibles connues, tests unitaires dedies du consumer et realignement des fixtures/tests frontend associes, sans nouvel endpoint, sans nouvelle UI metier visible, sans backend, sans contrat OpenAPI et sans activation IA.
- `033-pilot-core-flow-ui-refresh-consistency-v1` ferme la coherence frontend post-action du parcours pilote coeur : import, mapping manuel et decisions de suggestions no-provider rafraichissent les read-models coeur attendus via `GET` REST existants, avec warnings de refresh partiel, sans backend, DB, OpenAPI, IA runtime, GraphQL, RAG, refresh export/minimal-annex, mutation workpaper/document ou nouvelle promesse CO/statutory.
- `034-pilot-balance-import-history-diff-ui-v1` ferme l'exposition frontend read-only de l'historique des imports balance et du diff N/N-1 via les `GET` REST existants, avec validation fail-closed, etats UI et refresh post-import non bloquant, sans backend, DB, OpenAPI, IA runtime, GraphQL, mutation, refresh export/minimal-annex ni promesse CO/statutory.
- `035-pilot-export-pack-minimal-annex-refresh-ui-v1` ferme le refresh frontend non bloquant de `Minimal annex preview` apres creation reussie d'un `Audit-ready export pack`, sans backend, DB, contrat/OpenAPI, IA runtime, GraphQL, mutation workpaper/document ni promesse CO/statutory.
- `036-local-integrated-demo-real-backend-seed-v1` a livre une demo locale integree avec backend reel, PostgreSQL reel, auth JWT reelle, tenant et membership reels, et donnees demo synthetiques persistees. 036a livre uniquement la commande backend de seed PostgreSQL demo, sans frontend, sans commande JWT, sans endpoint HTTP, sans OpenAPI et sans migration DB. 036b prouve `/api/me` avec vrai bearer signe en `dbIntegrationTest`. 036c ajoute uniquement le proxy frontend Vite dev-only pour consommer `/api` via backend local, avec bearer conserve dans le shell local Node/Vite et jamais dans le navigateur.
- `037-local-integrated-demo-manual-business-smoke-v1` cloture le smoke manuel local observe par l'utilisateur en PASS technique : health backend direct `200`, `/api/me` backend sans JWT `401`, `/api/me` via proxy Vite avec JWT local `200`, tenant demo synthetique `ritomer-demo-036a` / `Ritomer Demo Fiduciaire SA`, role `ACCOUNTANT`, dossier `Demo Closing FY2025` visible et ouvrable, surfaces principales visibles, mauvais tenant rejete `403`, sans `Authorization` visible dans les Request Headers navigateur et sans token observe dans navigateur, URL, storage ou repo. La cloture ne livre aucun code runtime, aucun test, aucun contrat, aucune migration, aucune IA runtime, aucun GraphQL, aucun RAG, aucun provider, aucun secret et aucune spec suivante. Dette residuelle : UX fonctionnelle mais trop lineaire, trop longue, trop technique et pas encore POC/premium.
- `038-local-demo-closing-workbench-ux-cockpit-v1` est livre : PR #61 et PR #62 sont mergees et l'increment frontend transforme le dossier demo local en cockpit de closing intermediaire avec structure workbench/panneaux, synthese haut de page, chemin closing visible, tenant, dossier, statut, prochaine action, blockers et progression visibles, wording metier ameliore, mapping observe sans chevauchement bouton/contenu et sans scroll horizontal sauvage observe lors du smoke visuel utilisateur. Les checks frontend sont passes. Verdict CPO : `PASS 038` comme cockpit intermediaire, pas encore POC premium final. Dette residuelle a traiter dans une future spec : polish data-heavy, lisibilite detaillee et design premium approfondi.
- `039-local-demo-data-heavy-ux-polish-v1` est cloturee apres livraison des sous-livrables `039a`, `039b`, `039c`, `039d` et `039e` : `039a` / `039b` rendent Import + Mapping plus scannables, tabulaires et lisibles ; `039c` nettoie les suggestions IA no-provider sans IA reelle ; `039d` rend Justifications / Preuves plus metier et actionnables ; `039e` rend Previsualisations / Export / Annexe minimale plus prudents, non statutaires et orientes revue humaine. Les checks frontend sont passes dans les PR d'implementation et un smoke visuel utilisateur a ete effectue sur les surfaces UX cles.
- Les lectures sur `ARCHIVED` restent autorisees si le tenant et le RBAC sont valides.
- Les lectures `GET` sur `controls`, `financial-summary`, `financial-statements-structured`, `workpapers` et `minimal-annex` n'ecrivent aucun `audit_event`.
- Les tests PostgreSQL reels restent opt-in via `dbIntegrationTest`, sans Docker local requis.

### Validation PostgreSQL reelle locale — preuve historique 043b
- Pour les 12 classes `dbIntegrationTest`, la recette historique 043b a visé un PostgreSQL local direct à `jdbc:postgresql://127.0.0.1:5432/ritomer_043b_test`, sans cloud-sql-proxy, tunnel SSH ni port forward, avec base et rôle créés de novo et données synthétiques uniquement. Cette preuve n’autorise aucune nouvelle exécution 043.
- Reference d'execution : `runbooks/local-dev.md`.
