# 042 - Controlled AI mapping runtime pilot V1

## Status

Active.

## Mode

SPEC_CREATION avec increment runtime local controle `042a2a5a`, amelioration frontend de simulation locale `042a2a5c`, variante seed locale opt-in `042a2a5d` et polish UX des libelles utilisateur `042a2a5e`.

Cette spec active cadre le premier pilote IA runtime reel de Ritomer, limite aux suggestions de mapping sur le dossier demo synthetique.

Jusqu'aux livrables `042a2` precedents, elle ne livrait aucun runtime, aucun provider, aucun backend, aucun frontend, aucune DB ou migration, aucun OpenAPI, aucune CI, aucune dependance, aucun secret, aucune valeur `.env`, aucun appel reseau IA et aucune spec `043`. `042a2a3` fait exception uniquement pour un moteur offline backend interne d'evaluation candidate, sans surface produit ni provider reel.

`042a1` ajoute uniquement un gate pack draft de gouvernance/readiness avant tout code provider `042b`. Les records restent `DRAFT` ou `PENDING_EVIDENCE`, sans signature humaine, sans approbation et sans date de gate inventee.

`042a2a1` ajoute uniquement un semantic readiness pack draft avant tout contrat `mapping-suggestion-v2`. Les records restent `DRAFT` ou `PENDING_EVIDENCE`, sans signature humaine, sans approbation, sans contrat, sans provider, sans prompt runtime, sans golden set et sans validator.

Le pack de cas candidats `042a2` ajoute uniquement des fixtures synthetiques et un validator local. Les artefacts restent `CANDIDATE / PENDING_DOUBLE_REVIEW / NOT_GOLDEN / NOT_AUTHORITATIVE`, sans signature humaine, sans contrat, sans provider, sans prompt runtime, sans backend/frontend runtime, sans DB/migration, sans OpenAPI, sans secret, sans `.env`, sans appel reseau IA et sans spec `043`.

Le pack de double revue aveugle `042a2` transforme les 17 cas candidats en deux paquets de revue humaine independants. Les artefacts restent `BLIND_REVIEW_INPUT / PENDING_INDEPENDENT_REVIEW / NOT_GOLDEN / NOT_AUTHORITATIVE`, sans reponses humaines, sans adjudication, sans promotion golden set, sans contrat, sans provider, sans prompt runtime, sans backend/frontend runtime, sans DB/migration, sans OpenAPI, sans secret, sans `.env`, sans appel reseau IA et sans spec `043`.

`042a2a3` ajoute un premier moteur offline backend interne et une task Gradle d'evaluation des 17 cas candidats. Ce livrable reste `CANDIDATE_EVAL / NOT_GOLDEN / NOT_AUTHORITATIVE / NOT_MODEL_QUALITY`, sans provider reel, modele reel, prompt runtime, endpoint, DB/migration, OpenAPI, contrat public, secret, `.env`, appel reseau IA, production ou spec `043`.

`042a2a4` ajoute uniquement le contrat normalise `mapping-suggestion-v2` comme read-model applicatif Ritomer, un transformer offline backend depuis le moteur `042a2a3` et un parser frontend strict. Ce livrable ne cree aucun provider reel, modele reel, prompt runtime actif, endpoint actif, controller, wiring Spring, DB/migration, ecran frontend, auto-apply, bulk apply, secret, `.env`, appel reseau IA, production ou spec `043`.

`042a2a5a` expose ce moteur offline derriere un endpoint backend local v2 strictement read-only et default-off : `GET /api/closing-folders/{closingFolderId}/mappings/suggestions-v2`. Le controller, le service et l'adapter local n'existent qu'en profil `local` avec `ritomer.ai.mapping-suggestions-v2.offline.enabled=true`, restent limites a l'allowlist demo synthetique backend immutable, n'utilisent aucun provider reel, aucun SDK provider, aucun appel reseau IA, aucun secret, aucune valeur `.env`, aucune ecriture DB, aucune decision humaine, aucun audit de decision, aucune UI de decision, aucune bascule v1 et aucune production.

`042a2a5c` ameliore uniquement l'UX/frontend de la simulation locale offline `mapping-suggestions-v2` pour le POC interne. L'interface conserve le bandeau exact `Simulation locale — aucune IA externe active.`, expose une posture visible non autoritative, rappelle que le read-model local n'est pas un jeu de reference valide, affiche les counts par outcome `SUGGESTION`, `ABSTENTION`, `PRECONDITION_BLOCK`, `POLICY_BLOCK` et `TECHNICAL_DEGRADATION`, et garde l'affectation manuelle comme autorite metier. Ce livrable ne cree aucun provider reel, modele reel, prompt runtime actif, endpoint, controller, service, adapter, contrat/OpenAPI, DB/migration, auth, audit, decision v2, auto-apply, bulk apply, bascule v1 automatique, secret, appel reseau IA, production ou spec `043`.

`042a2a5d` ajoute uniquement une variante locale opt-in du seed demo pour rendre le scenario `mapping-suggestions-v2` observable sans modifier le seed principal 036a. La commande documentee avec seulement `-PritomerDemoSeedEnabled=true` continue de seeder uniquement le dossier principal `036a0000-0000-4000-8000-000000000004` avec 6 lignes de balance et 6 mappings manuels. La variante n'est creee que si `-PritomerDemoSeedVariant=042a2a5d-mixed-v2` est fourni ; elle utilise le dossier `042a2a5d-0000-4000-8000-000000000004`, la meme source `demo-synthetic-balance.csv`, 6 lignes de balance et seulement 4 mappings manuels (`1000`, `1100`, `2000`, `2800`). Les comptes `3000` et `4000` restent non mappes afin que le moteur offline produise naturellement `SUGGESTION=1`, `ABSTENTION=1`, `PRECONDITION_BLOCK=4`, `POLICY_BLOCK=0` et `TECHNICAL_DEGRADATION=0`, sans provider externe, decision v2, migration, endpoint nouveau, contrat public, auto-apply, bulk apply ou spec `043`.

`042a2a5e` polit uniquement les libelles utilisateur de la simulation locale offline `mapping-suggestions-v2`. Les cartes et compteurs affichent des libelles metier comprehensibles, tandis que les enums `SUGGESTION`, `ABSTENTION`, `PRECONDITION_BLOCK`, `POLICY_BLOCK` et `TECHNICAL_DEGRADATION` restent internes aux types, contrats, tests et fixtures. Le bandeau exact `Simulation locale — aucune IA externe active.`, la posture non autoritative, le rappel d'absence de jeu de reference valide, l'affectation manuelle comme autorite metier et le lien `Affecter manuellement` restent visibles. Ce polish ne cree aucun backend, seed, endpoint, contrat/OpenAPI/JSON Schema, DB/migration, auth, audit, provider, valeur sensible, fichier d'environnement local, appel reseau IA, decision v2, auto-apply, bulk apply, fallback v1 automatique, production ou spec `043`.

`042b0b` ajoute uniquement des preuves manuelles OpenAI Platform/API au provider-readiness record : projet dedie `ritomer-dev`, billing API, credits et limites de depense, modeles autorises et visibilite du snapshot candidat.

`042b0c` ajoute uniquement des preuves manuelles OpenAI Platform/API de preflight security/privacy : API keys actives visibles `0`, usage API `$0.00`, total requests `0`, total tokens `0`, data controls visibles, API call logging `ENABLED_PER_CALL_UI_OBSERVED`, audit logging `NOT_ENABLED_UI_OBSERVED`, et rappels de sources officielles OpenAI pour data controls, data residency, prepaid billing et audit logging.

`042b0b` et `042b0c` ne creent aucun runtime, provider adapter, SDK, secret, fichier `.env`, appel reseau IA, prompt runtime actif, golden set promu, production ou spec `043`.

`042b1a` documente uniquement une tentative locale de canary OpenAI non concluante. La tentative prevoyait `POST /v1/chat/completions` sur `api.openai.com`, modele `gpt-5.4-mini-2026-03-17`, payload public non metier, non Ritomer et non client, `store=false` et aucun outil. Resultat : premiere tentative `FAIL NON_HTTP / ArgumentException`, deuxieme tentative `FAIL NON_HTTP / RuntimeException`, aucun HTTP 200, aucun modele retourne, aucun usage provider valide et aucun network PASS. La cle temporaire creee manuellement a ete revoquee ; cles actives apres revocation `0`, usage dashboard `$0.00`, total requests `0`, total tokens `0`. Aucun secret n'a ete partage avec ChatGPT/Codex/GitHub, aucun fichier `.env` n'a ete cree ou modifie, aucun commit ou fichier repo n'a ete modifie par le canary, aucun payload sensible, aucune donnee Ritomer et aucune donnee client n'ont ete envoyes.

`042b1a` ne cree aucun runtime, provider adapter, SDK, secret, fichier `.env`, appel IA reussi, prompt runtime actif, golden set promu, production ou spec `043`. Canary status : `FAILED_NON_CONCLUSIVE`. Provider network activation : `STILL_BLOCKED`. `042b` provider runtime : `STILL_BLOCKED`. Aucun essai supplementaire n'etait autorise par ce record lui-meme ; le retry `042b1b` ci-dessous dependait d'une autorisation Security/Privacy separee.

`042b1b` documente uniquement le retry controle OpenAI autorise apres `042b1a`. Execution locale utilisateur uniquement, aucun Codex, client `curl.exe`, endpoint unique `POST /v1/chat/completions`, host unique `api.openai.com`, modele unique `gpt-5.4-mini-2026-03-17`, `store=false` demande, aucune donnee Ritomer/client/tenant/mapping/compte/document/CSV/workpaper, aucune valeur de cle ni header enregistres dans le repo/Codex/GitHub, ChatGPT exposure `YES_ONE_TEMPORARY_KEY_PASTED_AND_TREATED_AS_COMPROMISED`, retry execution secret value `NOT_RECORDED`, aucun fallback. Resultat sanitise : `http_status=400`, `error_type=invalid_request_error`, `result=FAIL_HTTP_400`, `model_returned=null`, `usage_total_tokens=null`, `final_canary_status=STOP_NO_FALLBACK`.

`042b1b` ferme le chemin canary OpenAI : `042b1b=FAIL_HTTP_400_INVALID_REQUEST_ERROR`, `network_canary=FAILED`, `network_activation=STILL_BLOCKED`, `provider_runtime=STILL_BLOCKED`, `adapter_provider=NOT_AUTHORIZED`, `spec_042b=STILL_BLOCKED`, `retry_remaining=0`, `fallback=FORBIDDEN`, aucun HTTP 200, aucun modele retourne, aucun token d'usage retourne, aucun provider runtime approuve et aucun provider OpenAI approuve. Aucun quatrieme retry canary, fallback Responses API, fallback `eu.api.openai.com`, autre endpoint, autre modele ou spec `043` n'est autorise par cette cloture.

Etat courant du repo pour l'alignement `042b0` / `042b1a` / `042b1b` OpenAI readiness :

- `mapping-suggestion-v2` existe comme read-model applicatif Ritomer normalise.
- `mapping-suggestion-v1` reste inchange et v2 ne provoque aucune bascule implicite.
- Le moteur offline deterministe existe.
- L'endpoint local synthetic-demo-only `GET /api/closing-folders/{closingFolderId}/mappings/suggestions-v2` existe.
- Une UI locale de simulation consomme le read-model v2 sans decision, auto-apply, bulk apply ou endpoint provider reel ; `042a2a5c` la rend plus lisible pour le POC interne avec posture non autoritative, counts par outcome et lien d'affectation manuelle, puis `042a2a5e` remplace les enums visibles par des libelles metier dans les cartes et compteurs.
- Aucun provider reel, appel reseau IA reussi, secret, runtime provider ou SDK provider n'existe.
- Les preuves manuelles `042b0b` etablissent la visibilite projet de `gpt-5.4-mini-2026-03-17`; les preuves `042b0c` etablissent uniquement des observations security/privacy de preflight OpenAI Platform/API ; `042b1a` etablit uniquement une tentative canary `FAILED_NON_CONCLUSIVE` ; `042b1b` etablit uniquement un retry controle `FAIL_HTTP_400_INVALID_REQUEST_ERROR / STOP_NO_FALLBACK`. Le snapshot candidat reste non executable, le network canary est `FAILED`, le retry restant est `0` et le gate reseau provider separe reste bloque.

## Surface

DOCS_GIT / AI_RUNTIME_SPEC.

Surface `042a1` : DOCS_GIT / AI_GOVERNANCE.

Surface `042a2a1` : DOCS_GIT / AI_GOVERNANCE / FIDUCIARY_GOVERNANCE.

Surface pack de cas candidats `042a2` : EVALS / CONTRACTS_DATA / DOCS_GIT.

Surface pack de double revue aveugle `042a2` : EVALS / DOCS_GIT.

Surface moteur offline `042a2a3` : BACKEND_RUNTIME_INTERNE / EVALS.

Surface contrat normalise `042a2a4` : CONTRACTS / BACKEND_RUNTIME_INTERNE / FRONTEND_CONSUMER.

Surface endpoint local offline `042a2a5a` : BACKEND_RUNTIME_LOCAL / CONTRACTS / DOCS_GIT.

Surface simulation frontend locale `042a2a5c` : FRONTEND / DOCS_GIT.

Surface variante seed locale `042a2a5d` : BACKEND_RUNTIME_LOCAL / DOCS_GIT.

Surface polish libelles utilisateur `042a2a5e` : FRONTEND / DOCS_GIT.

Surface readiness provider candidat `042b0` : DOCS_GIT / AI_GOVERNANCE / SECURITY_PRIVACY.

Surface readiness provider candidat `042b0b` : DOCS_GIT / AI_GOVERNANCE / SECURITY_PRIVACY.

Surface readiness provider candidat `042b0c` : DOCS_GIT / AI_GOVERNANCE / SECURITY_PRIVACY.

Surface canary provider non conclusif `042b1a` : DOCS_GIT / AI_GOVERNANCE / SECURITY_PRIVACY.

Surface retry canary provider ferme `042b1b` : DOCS_GIT / AI_GOVERNANCE / SECURITY_PRIVACY.

## Risk

C.

Risque lie a l'ouverture d'une future capacite provider reelle, meme strictement bornee aux donnees synthetiques. Pour `042a2a5a`, le risque C est borne par l'activation locale default-off, l'allowlist synthetique immutable, l'absence de provider reel/reseau/secret et l'absence de mutation.

## Sources relues

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
- `specs/done/041-internal-poc-blockers-ux-readiness-v1.md`
- `specs/done/030-ia-mapping-assiste-suggestion-review-v1.md`
- `contracts/ai/mapping-suggestion.schema.json`
- `contracts/ai/mapping-suggestion-v2.schema.json`
- `contracts/openapi/mapping-suggestions-api.yaml`
- `contracts/openapi/mapping-suggestions-v2-api.yaml`
- `contracts/db/mapping-suggestion-decision-v1.md`
- `contracts/reference/manual-mapping-targets-v2.yaml`
- `evals/mapping/README.md`
- `runbooks/ai-incident-response.md`
- `policies/ai-provider-readiness.md`
- `policies/ai-provider-readiness-record-030d1.md`
- `policies/dependency-security-review-030d1.md`
- `policies/ai-runtime-gates-record-042a.md`
- `policies/ai-provider-readiness-record-042a.md`
- `policies/dependency-security-review-042a.md`
- `policies/ai-payload-whitelist-mapping-runtime-042a.md`
- `policies/ai-mapping-semantic-readiness-record-042a2.md`
- `policies/ai-mapping-annotation-guide-042a2.md`
- `policies/ai-mapping-taxonomy-pilot-record-042a2.md`
- `policies/ai-mapping-business-evaluation-protocol-042a2.md`
- `policies/ai-mapping-pilot-scope-manifest-042a2.md`
- `prompts/guardrails/system-fr.md`
- `knowledge/retrieval-policy.md`
- `docs/ui/ui-foundations-v1.md`
- `README.md`
- `docs/vision/ai-native.md`
- `docs/vision/architecture.md`
- `docs/vision/ux.md`
- `docs/playbooks/ai.md`
- `docs/playbooks/architecture.md`
- `docs/playbooks/ux.md`
- code/tests existants lies aux suggestions de mapping et au no-provider :
  - `backend/src/main/kotlin/ch/qamwaq/ritomer/mapping/application/MappingSuggestionsService.kt`
  - `backend/src/main/kotlin/ch/qamwaq/ritomer/ai/access/MappingSuggestionGenerationAccess.kt`
  - `backend/src/main/kotlin/ch/qamwaq/ritomer/ai/application/DeterministicMappingSuggestionAdapterStub.kt`
  - `backend/src/main/kotlin/ch/qamwaq/ritomer/mapping/application/MappingSuggestionPayloadMinimizer.kt`
  - `backend/src/main/kotlin/ch/qamwaq/ritomer/mapping/application/MappingSuggestionCanonicalization.kt`
  - `backend/src/main/kotlin/ch/qamwaq/ritomer/mapping/application/MappingSuggestionDecisionService.kt`
  - `backend/src/main/kotlin/ch/qamwaq/ritomer/mapping/api/MappingSuggestionsController.kt`
  - `backend/src/test/kotlin/ch/qamwaq/ritomer/mapping/application/MappingSuggestionsServiceTest.kt`
  - `backend/src/test/kotlin/ch/qamwaq/ritomer/mapping/application/MappingSuggestionPayloadMinimizerTest.kt`
  - `backend/src/test/kotlin/ch/qamwaq/ritomer/MappingSuggestionDecisionApiTest.kt`
  - `frontend/src/lib/api/mapping-suggestions.ts`
  - `frontend/src/lib/api/mapping-suggestions-v2.ts`
  - `frontend/src/lib/api/mapping-suggestions.test.ts`
  - `frontend/src/lib/api/mapping-suggestions-v2.test.ts`
  - `frontend/src/app/ai-mapping-suggestions-panel.tsx`
  - `frontend/src/app/ai-mapping-suggestions-panel.test.tsx`

Contrats impactes par `042a2a5a` :

- `contracts/openapi/mapping-suggestions-v2-api.yaml`.

Contract readiness `042a1` :

- `contracts/ai/mapping-suggestion.schema.json` et `contracts/openapi/mapping-suggestions-api.yaml` ont ete verifies en lecture seule.
- `mapping-suggestion-v1` ne represente pas explicitement `abstention`.
- `mapping-suggestion-v1` ne represente pas explicitement les reason codes ni les etats de degradation semantiques requis par `042a2a1b`.
- `mapping-suggestion-v2` existe maintenant comme read-model Ritomer normalise et encode ces outcomes, reason codes et etats de degradation.
- `mapping-suggestion-v2` preserve `mapping-suggestion-v1`; aucun contrat v1 n'est modifie et aucune bascule implicite v1 -> v2 n'existe.
- `mapping-suggestion-v2` reste sans endpoint provider reel, sans appel reseau IA, sans secret et sans runtime provider.
- `042b` reste BLOQUE par provider-readiness, signatures humaines, revue/pinning gate de l'exact model id, privacy/legal, quotas, budget cap, kill switch, log hygiene, golden set autoritatif et gate reseau.
- Aucun contrat n'est modifie par `042a1`.

Semantic readiness `042a2a1` :

- `policies/ai-mapping-semantic-readiness-record-042a2.md` definit les etats `SUGGESTION`, `ABSTENTION` et degradation technique avant contrat.
- `policies/ai-mapping-annotation-guide-042a2.md` definit l'annotation, la double annotation et l'adjudication.
- `policies/ai-mapping-taxonomy-pilot-record-042a2.md` definit les exigences de taxonomie pilote sans creer de taxonomie.
- `policies/ai-mapping-business-evaluation-protocol-042a2.md` definit les objectifs d'evaluation metier sans creer de golden set ni validator.
- `policies/ai-mapping-pilot-scope-manifest-042a2.md` definit le perimetre metier pilote draft sans approuver de taxonomy snapshot.
- `042a2a1` et `042a2a1b` n'ont pas modifie de contrat a ce stade; `mapping-suggestion-v2` est ensuite livre par `042a2a4`.
- `042b` reste BLOQUE tant que provider-readiness, signatures humaines, revue/pinning gate de l'exact model id, privacy/legal, quotas, budget cap, kill switch, log hygiene, golden set autoritatif, validator, gates provider et gate reseau ne sont pas termines.

Contract implementation `042a2a4` :

- `contracts/ai/mapping-suggestion-v2.schema.json` encode maintenant une union stricte `SUGGESTION | ABSTENTION | POLICY_BLOCK | PRECONDITION_BLOCK | TECHNICAL_DEGRADATION` avec `scope` ferme `ACCOUNT | REQUEST | BATCH` selon le code.
- `contracts/openapi/mapping-suggestions-v2-api.yaml` portait en `042a2a4` les composants OpenAPI v2 contract-only avec `paths: {}` ; `042a2a5a` y ajoute le chemin GET local default-off `suggestions-v2`, avec `taxonomyHash` dans le read-model et sans endpoint de decision.
- `contracts/ai/mapping-suggestion-v2.corpus.json` porte le corpus contractuel partage valide/invalide utilise par les tests backend, frontend et les validations de schema/OpenAPI.
- Le backend ajoute seulement un transformer offline depuis les resultats `042a2a3`, avec fingerprint reserve aux `SUGGESTION` et calcule localement sur schema, dossier, import, version/hash taxonomie, outcome, compte, cible et preuves canonisees, sans controller, wiring Spring, provider runtime, reseau, DB ou migration.
- Le frontend ajoute seulement un parser Zod v2 strict aligne sur le corpus partage, sans ecran ni basculement du consumer v1 existant.
- Les contrats v1 `contracts/ai/mapping-suggestion.schema.json` et `contracts/openapi/mapping-suggestions-api.yaml` restent inchanges ; il n'y a aucun basculement implicite v1 -> v2.

Endpoint local offline `042a2a5a` :

- `GET /api/closing-folders/{closingFolderId}/mappings/suggestions-v2` est ajoute uniquement comme endpoint local read-only, sans `POST`, sans decision, sans accept/correct/reject, sans bulk et sans auto-apply.
- L'activation exige le profil Spring `local` et `ritomer.ai.mapping-suggestions-v2.offline.enabled=true`; le defaut reste `false` et le controller/service/adapter sont absents hors profil/flag.
- Les gates d'execution sont : auth existante, resolver tenant existant, existence tenant-scopee du closing folder, allowlist tenant/folder, import/provenance synthetique, preconditions comptes, puis moteur offline.
- L'allowlist backend immutable est limitee au tenant `036a0000-0000-4000-8000-000000000001`, aux dossiers `036a0000-0000-4000-8000-000000000004` et `042a2a5d-0000-4000-8000-000000000004`, a l'import version `1` et a la source `demo-synthetic-balance.csv`.
- Le moteur appele est `OfflineMappingEvalEngine042a2` via un port provider-agnostic interne et un adapter local deterministe ; aucun provider reel, SDK provider, appel reseau IA, secret, `.env`, prompt runtime actif ou cout provider n'est introduit.
- Les reponses restent des items `mapping-suggestion-v2` normalises via `MappingSuggestionV2Transformer`, sans `state`, sans `providerCallCount`, sans payload provider et sans label/payload brut en logs.
- Les comptes deja mappes exposent `PRECONDITION_BLOCK / ACCOUNT`; les comptes eligibles exposent `SUGGESTION`, `ABSTENTION` ou degradation technique explicite ; aucun compte n'est ignore silencieusement.
- Les policy/preconditions request-scope ne portent pas `accountCode`, `accountLabel` ou evidence.
- Les lectures `GET` n'ecrivent aucun mapping manuel, aucune decision de suggestion et aucun audit de decision.

Runbooks impactes par `042a1`, sans modification supplementaire par `042a2a1b` :

- `runbooks/ai-incident-response.md`

Runbooks impactes par `042a2a5a` :

- `runbooks/local-dev.md`

## 1. Probleme et resultat utilisateur

### Probleme

`030` a livre une capacite de mapping assiste no-provider : suggestions structurees, preuves visibles et decision humaine unitaire. Cette capacite prouve le workflow de revue, mais ne mesure pas encore un comportement IA runtime reel.

Pour poursuivre vers un gain IA mesurable sans exposer de donnees clientes, Ritomer doit cadrer un pilote runtime provider tres controle, limite au dossier demo synthetique, capable de proposer des mappings utiles sans jamais remplacer le mapping manuel.

### Resultat utilisateur attendu

Sur le dossier demo synthetique, pour chaque compte eligible de la derniere balance importee, le systeme peut proposer :

- une rubrique cible admissible ;
- des preuves structurees, tenant-scopees et non sensibles ;
- un outcome semantique explicite avec reason code ou etat de degradation quand aucune proposition ne peut etre exposee.

Chaque compte eligible doit aboutir soit a une suggestion valide, soit a une abstention explicite, soit a un etat de degradation explicite. Aucun compte ne doit etre ignore silencieusement par le runtime.

L'utilisateur metier garde le controle et peut, compte par compte :

- accepter la suggestion ;
- corriger vers une autre rubrique selectable ;
- rejeter la suggestion.

Le mapping manuel reste toujours disponible et reste l'autorite metier durable.

## 2. Perimetre exact

### Inclus

- Cadrage d'une future implementation `042` du premier runtime IA reel pour mapping assiste.
- Donnees synthetiques uniquement, issues du dossier demo local controle.
- Suggestions sur les comptes de la derniere balance importee et eligibles au mapping.
- Appel provider uniquement cote backend, via l'AI Gateway et le port applicatif existant.
- Conservation du mode no-provider et du fallback manuel.
- Validation stricte du schema de sortie avant exposition.
- Prompt, modele, schema et provider logique versionnes et pinnes.
- Feature flag default off et kill switch operationnel.
- Mesure de qualite, abstention, preuves, corrections humaines, latence et cout sans journaliser les donnees.
- Audit durable des decisions humaines.

### Exclu hors moteur offline interne `042a2a3` et endpoint local `042a2a5a`

- Tout runtime produit expose, provider reel ou appel reseau IA.
- Tout appel provider.
- Toute lecture de secret, `.env`, token, cookie, DSN ou credential.
- Toute modification frontend, DB, migration, CI ou dependance.
- Toute activation non locale, production, provider, decision, mutation ou endpoint v2 non read-only.
- Toute creation de spec `043`.

## 3. Decoupage 042a / 042b / 042c / 042d

### 042a - Gates, contrats runtime et golden set synthetique

Objectif : preparer le terrain avant code.

`042a` reste strictement docs/gates/evals uniquement. Aucun code provider reel, aucun secret, aucune cle provider, aucun fichier `.env` et aucun appel reseau IA ne sont autorises pendant `042a`.

Les gates `042a` sont ceux de la section 15. Ils sont cumulatifs avec les exigences `030d` existantes, qu'ils preservent et ne diminuent pas.

Aucune spec `043` ne doit etre creee par `042a`.

`042a1` est le gate pack draft courant. Il livre uniquement :

- `policies/ai-runtime-gates-record-042a.md` ;
- `policies/ai-provider-readiness-record-042a.md` ;
- `policies/dependency-security-review-042a.md` ;
- `policies/ai-payload-whitelist-mapping-runtime-042a.md` ;
- mise a jour ciblee de `runbooks/ai-incident-response.md` ;
- clarification de cette spec et de `docs/product/v1-plan.md`.

`042a1` ne choisit pas de provider approuve, ne choisit pas de modele exact, ne cree pas de prompt runtime, ne modifie pas le golden set, ne cree pas de validator et ne definit pas de metriques runtime. Provider, modele exact, region, retention, training/non-training, cout, latence et quotas restent `NON_DÉTERMINÉ` tant qu'une preuve externe et une signature humaine ne les remplacent pas.

`042b0` est un increment documentaire de readiness provider candidat. Il documente uniquement :

- provider candidat : `OpenAI API` ;
- endpoint candidat : `/v1/chat/completions` ;
- domaine candidat : `eu.api.openai.com` ;
- modele candidat public : `gpt-5.4-mini` ;
- modeles autorises visibles dans le projet : `gpt-5.4-mini`, `gpt-5.4-mini-2026-03-17` ;
- exact model id / snapshot exact candidat visible dans le projet : `gpt-5.4-mini-2026-03-17` ;
- statut de preuve exactModelId : `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` ;
- aucun fallback automatique vers alias, autre modele, autre region ou autre provider.

`042b0b` documente aussi uniquement les preuves manuelles de compte/projet OpenAI Platform/API : acces Platform/API prouve, projet dedie `ritomer-dev`, billing API active, credits `$10`, auto recharge `OFF`, project spend limit `$10`, spend alert `100 % / $10`. API key status before canary: `NOT_CREATED_USER_CONFIRMED`. No pre-canary key existed.

`042b0c` documente uniquement les preuves manuelles security/privacy OpenAI Platform/API suivantes : API keys actives visibles `0`, API key status before canary `NOT_CREATED_USER_CONFIRMED`, no pre-canary key existed, usage API `$0.00`, total requests `0`, total tokens `0`, data controls visibles `PROUVÉ`, API call logging `ENABLED_PER_CALL_UI_OBSERVED`, audit logging `NOT_ENABLED_UI_OBSERVED`. Hosted tools et sharing restent documentes seulement la ou ils sont visibles ; tout detail non observe reste `NON_DÉTERMINÉ` ou `PENDING_EVIDENCE`.

`042b1a` documente uniquement une tentative locale canary OpenAI non concluante, sans relance reseau par cette cloture documentaire :

- endpoint prevu : `POST /v1/chat/completions` ;
- host prevu : `api.openai.com` ;
- modele prevu : `gpt-5.4-mini-2026-03-17` ;
- payload prevu : public, non metier, non Ritomer, non client ;
- `store=false` prevu ;
- aucun outil prevu ;
- premiere tentative : `FAIL NON_HTTP / ArgumentException` ;
- deuxieme tentative : `FAIL NON_HTTP / RuntimeException` ;
- aucun HTTP 200 obtenu ;
- aucun modele retourne ;
- aucun usage provider valide ;
- aucun network PASS etabli.

Preuves security/post-revocation `042b1a` :

- cle temporaire creee manuellement puis revoquee ;
- cles API actives apres revocation : `0` ;
- usage dashboard : `$0.00` ;
- total requests : `0` ;
- total tokens : `0` ;
- secret shared with ChatGPT/Codex/GitHub : `NO` ;
- fichier `.env` cree/modifie : `NO` ;
- commit ou fichier repo modifie par le canary : `NO` ;
- payload sensible envoye : `NO` ;
- donnee Ritomer envoyee : `NO` ;
- donnee client envoyee : `NO`.

Decision `042b1a` :

- canary status : `FAILED_NON_CONCLUSIVE` ;
- provider network activation : `STILL_BLOCKED` ;
- `042b` provider runtime : `STILL_BLOCKED` ;
- no additional attempt authorized by this record itself ;
- retry `042b1b` required a separate Security/Privacy authorization.

`042b1b` documente uniquement le retry controle OpenAI autorise apres `042b1a`, sans relance reseau par cette cloture documentaire :

- attempt : `042b1b` ;
- execution : locale par l'utilisateur uniquement ;
- Codex involved in network execution : `NO` ;
- client : `curl.exe` ;
- endpoint unique : `POST /v1/chat/completions` ;
- host unique : `api.openai.com` ;
- modele unique : `gpt-5.4-mini-2026-03-17` ;
- `store=false` demande ;
- payload : public, non metier, non Ritomer, non client ;
- donnees Ritomer, tenant, client, mapping, compte, document, CSV ou workpaper envoyees : `NO` ;
- API key value recorded in repo/Codex/GitHub : `NO` ;
- ChatGPT exposure : `YES_ONE_TEMPORARY_KEY_PASTED_AND_TREATED_AS_COMPROMISED` ;
- exposed key value recorded in repo : `NO` ;
- retry execution secret value : `NOT_RECORDED` ;
- fallback Responses API, `eu.api.openai.com`, autre endpoint, autre modele ou autre provider : `FORBIDDEN` ;
- cle temporaire revoquee immediatement apres tentative.

Resultat sanitise `042b1b` :

- http status : `400` ;
- error type : `invalid_request_error` ;
- result : `FAIL_HTTP_400` ;
- final canary status : `STOP_NO_FALLBACK` ;
- model returned : `null` ;
- usage total tokens : `null` ;
- HTTP 200 obtenu : `NO` ;
- usage provider valide : `NO` ;
- network PASS etabli : `NO`.

Preuves post-tentative `042b1b` fournies par captures utilisateur sanitisees :

- API Keys / filtre Active : `0 results / No API keys found` ;
- active keys after revocation : `0` ;
- Usage project `ritomer-dev` : `Total Spend $0.00` ;
- Total tokens : `0` ;
- Total requests : `0` ;
- Responses and Chat Completions : `0 requests / 0 input tokens` ;
- July spend panel : `$0.00 / $10.00` ;
- `auto_recharge=NOT_REVALIDATED_IN_LATEST_SCREENSHOTS` pour les captures post-`042b1b` ;
- auto_recharge proof prior record : `OFF` documente par `042b0b`, non revalide par les captures post-`042b1b`.

Decision finale `042b1b` :

- `042b1b` : `FAIL_HTTP_400_INVALID_REQUEST_ERROR` ;
- network canary : `FAILED` ;
- network activation : `STILL_BLOCKED` ;
- provider runtime : `STILL_BLOCKED` ;
- adapter provider : `NOT_AUTHORIZED` ;
- spec `042b` : `STILL_BLOCKED` ;
- retry remaining : `0` ;
- fallback : `FORBIDDEN` ;
- no HTTP 200 ;
- no model returned ;
- no usage tokens returned ;
- no provider runtime approved ;
- no OpenAI provider approved.

Rappels de sources officielles OpenAI pour le futur gate :

- `https://developers.openai.com/api/docs/guides/your-data` documente que les donnees envoyees a l'OpenAI API ne sont pas utilisees pour entrainer ou ameliorer les modeles OpenAI sauf opt-in explicite.
- La meme source documente `/v1/chat/completions` avec `Data used for training = No`, retention abuse monitoring `30 days`, application state retention `None, see exceptions`, et eligibilite Zero Data Retention avec limites.
- La meme source documente `eu.api.openai.com` pour `Europe (EEA + Switzerland)`, avec `/v1/chat/completions` supporte en storage et processing, et la region marquee comme necessitant MAM ou ZDR.
- `https://help.openai.com/en/articles/8264644-how-can-i-set-up-prepaid-billing` documente les credits API prepayes comme usage API prepaye et le parametrage Auto recharge ; dans Ritomer, ces credits restent separes du runtime, auto recharge reste `OFF` selon `042b0b`, et n'est pas revalide par les captures post-`042b1b`.
- `https://help.openai.com/en/articles/9687866-admin-and-audit-logs-api-for-the-api-platform` documente les capacites d'audit logging API Platform et leur activation via Data controls ; dans Ritomer, audit logging est seulement observe `NOT_ENABLED_UI_OBSERVED`.

`042b0b`, `042b0c`, `042b1a` et `042b1b` prouvent seulement la visibilite UI, des rappels documentaires officiels, une tentative canary non concluante puis un retry canary final `FAIL_HTTP_400_INVALID_REQUEST_ERROR / STOP_NO_FALLBACK`. Ils n'approuvent pas le provider, ne rendent pas le snapshot executable, ne creent aucun runtime, aucun adapter provider, aucun SDK, aucun secret, aucun fichier `.env`, aucun appel IA reussi, aucun prompt runtime actif, aucun golden set promu et aucune spec `043`.

`042a2a1` est le semantic readiness pack draft courant. Il livre uniquement :

- `policies/ai-mapping-semantic-readiness-record-042a2.md` ;
- `policies/ai-mapping-annotation-guide-042a2.md` ;
- `policies/ai-mapping-taxonomy-pilot-record-042a2.md` ;
- `policies/ai-mapping-business-evaluation-protocol-042a2.md` ;
- clarification de cette spec et de `docs/product/v1-plan.md`.

`042a2a1b` durcit ce pack sans changer de statut et ajoute uniquement :

- `policies/ai-mapping-pilot-scope-manifest-042a2.md` ;
- alignement des semantics draft sur cible admissible, outcomes, reason codes, etats de degradation et policy/precondition boundaries.

`042a2a1` et `042a2a1b` ne redigent pas le contrat `mapping-suggestion-v2`, ne creent pas le prompt runtime, ne creent pas le golden set, ne creent pas le validator, ne choisissent pas de provider, ne choisissent pas de modele et n'activent aucun runtime.

`042a2a2a` ajoute uniquement des artefacts executables candidats pour preparer le futur moteur offline :

- `evals/mapping/fixtures/042a2/taxonomy-snapshot-candidate-v1.json` ;
- `evals/mapping/fixtures/042a2/demo-input-unmapped-v1.json` ;
- `evals/mapping/validate-042a2-candidate.ps1`.

Ces artefacts restent `CANDIDATE / PENDING_EVIDENCE / NOT_AUTHORITATIVE`. Ils ne creent pas de golden set approuve, ne gelent pas une taxonomie, ne signent pas le perimetre pilote, ne redigent pas `mapping-suggestion-v2`, ne creent pas de prompt runtime, ne choisissent pas de provider ou de modele et n'activent aucun backend/frontend runtime, DB, migration, OpenAPI, CI, secret, `.env`, appel reseau IA, production ou spec `043`.

Le pack de cas candidats `042a2` ajoute ensuite :

- `evals/mapping/fixtures/042a2/candidate-semantic-cases-v1.json` ;
- `evals/mapping/fixtures/042a2/candidate-policy-fault-cases-v1.json` ;
- `evals/mapping/validate-042a2-candidate-cases.ps1`.

Ces artefacts restent `CANDIDATE / PENDING_DOUBLE_REVIEW / NOT_GOLDEN / NOT_AUTHORITATIVE`. Ils separent les cas metier `BUSINESS_SEMANTIC`, les policy/preconditions et les sorties techniques invalides. Les policy/preconditions ne comptent pas comme abstentions metier. Les sorties avec cible inconnue, depreciee, non selectionnable, section ou racine proposee sont attendues en `INVALID_MODEL_OUTPUT`, jamais en `TAXONOMY_GAP`. Les gaps `TAXONOMY_GAP`, `AMBIGUOUS_TARGET`, `OUT_OF_SCOPE` et `CONFLICTING_SIGNALS` restent documentes sans cas artificiel.

Le pack de double revue aveugle `042a2` ajoute uniquement :

- `evals/mapping/reviews/042a2/reviewer-a-blind-v1.json` ;
- `evals/mapping/reviews/042a2/reviewer-b-blind-v1.json` ;
- `evals/mapping/reviews/042a2/reviewer-response-schema-v1.json` ;
- `evals/mapping/build-042a2-blind-review-pack.ps1` ;
- `evals/mapping/validate-042a2-blind-review-pack.ps1` ;
- `evals/mapping/validate-042a2-human-review-responses.ps1`.

Ces artefacts restent `BLIND_REVIEW_INPUT / PENDING_INDEPENDENT_REVIEW / NOT_GOLDEN / NOT_AUTHORITATIVE`. Ils couvrent exactement les 17 cas candidats avec des ids neutres `BR-001` a `BR-017`, deux ordres deterministes differents, les inputs synthetiques necessaires et le catalogue candidat des cibles selectionnables. Ils n'exposent pas les chemins ou hashes des fixtures candidates contenant les reponses, `sourceKind`, `sourceCaseId`, `caseInputHash`, les champs de solution source, categories, tags, commentaire de correction, montant brut, identifiant tenant/client/acteur ou mapping historique.

`042a2a3` ajoute un moteur offline Kotlin interne dans `mapping.application` et un runner de test Gradle `offlineMappingEval042a2`. Le moteur execute les 17 cas candidats sans reseau et sans provider reel selon le pipeline policy/precondition -> minimisation -> provider local deterministe ou fault provider -> JSON brut non fiable -> validation stricte -> controle cible/taxonomie candidate -> normalisation -> resultat -> metriques. Le fake provider, le fault provider et le runner restent dans `src/test` et ne constituent pas un provider production. Le rapport JSON est produit sous `backend/build/reports/042a2/` et doit rester marque `CANDIDATE_EVAL / NOT_GOLDEN / NOT_AUTHORITATIVE / NOT_MODEL_QUALITY`.

`042a2a4` ajoute le contrat normalise `mapping-suggestion-v2` et ses consommateurs offline stricts :

- schema JSON v2 normalise, avec `scope` ferme par code, sans confidence, sans texte libre provider, sans valeur null et avec `additionalProperties=false` partout ;
- OpenAPI v2 contract-only avec composants, `taxonomyHash` dans le read-model et `paths: {}`, sans endpoint actif avant `042a2a5a` ;
- corpus contractuel partage valide/invalide pour validation JSON Schema, tests Kotlin, tests Zod et controle d'alignement OpenAPI ;
- transformer backend offline de `OfflineMappingEvalResult` vers le read-model v2, avec fingerprint de suggestion genere localement sur schema, dossier, import, version/hash taxonomie, outcome, compte, cible et preuves canonisees, sans exposition de `providerCallCount` ;
- parser frontend Zod v2 strict et messages utilisateur derives localement des codes, sans `messageCode` redondant ;
- aucune modification du controller v1, du service runtime v1, des contrats v1, de la DB, des migrations ou du wiring Spring.

`042a2a5a` ajoute uniquement le wiring backend local du read-model v2 :

- controller `GET` v2 distinct du controller v1, sans `POST` ni route decision ;
- service v2 distinct, read-only, tenant-scoped, sans appel au service/API v1 ;
- adapter local deterministe dans la couche infrastructure locale, via le port provider-agnostic interne, sans provider reel ni reseau ;
- activation profile `local` + flag `ritomer.ai.mapping-suggestions-v2.offline.enabled=true`, default `false` ;
- allowlist backend immutable demo synthetique ;
- OpenAPI v2 avec le chemin GET local et runbook local-dev ;
- tests d'activation, gates, provenance, comportements v2, non-ecriture, non-reseau et non-regression v1.

`042a2a5c` ajoute uniquement l'amelioration UX/frontend de la simulation locale offline v2 :

- bandeau exact `Simulation locale — aucune IA externe active.` conserve ;
- mention visible de simulation locale non autoritative, sans jeu de reference valide et avec affectation manuelle comme autorite metier ;
- resume par outcome v2 avec counts `SUGGESTION`, `ABSTENTION`, `PRECONDITION_BLOCK`, `POLICY_BLOCK` et `TECHNICAL_DEGRADATION` ;
- wording metier court derive des codes/read-model existants, sans texte provider libre ;
- preuves existantes rendues sous forme sobre et scannable ;
- comptes bloques ou deja affectes expliques comme non decisionnes par la simulation, avec action manuelle explicite ;
- aucun bouton `ACCEPT`, `CORRECT`, `REJECT`, aucun `POST`, aucun fallback automatique v1, aucun auto-apply, aucun bulk apply ;
- aucun backend, contrat, OpenAPI, DB/migration, auth, tenant isolation, audit, provider, secret, appel reseau IA, production ou spec `043`.

`042a2a5d` ajoute uniquement la variante seed locale opt-in :

- le seed principal 036a reste complet et inchange : tenant `036a0000-0000-4000-8000-000000000001`, dossier `036a0000-0000-4000-8000-000000000004`, import version `1`, source `demo-synthetic-balance.csv`, 6 lignes de balance et 6 mappings manuels ;
- la variante `042a2a5d-mixed-v2` est creee uniquement avec `-PritomerDemoSeedVariant=042a2a5d-mixed-v2` ;
- le dossier variante est `042a2a5d-0000-4000-8000-000000000004`, import version `1`, source `demo-synthetic-balance.csv`, 6 lignes de balance et 4 mappings manuels ;
- mappings conserves dans la variante : `1000 -> BS.ASSET.CASH_AND_EQUIVALENTS`, `1100 -> BS.ASSET.TRADE_RECEIVABLES`, `2000 -> BS.LIABILITY.TRADE_PAYABLES`, `2800 -> BS.EQUITY.RETAINED_EARNINGS` ;
- comptes volontairement non mappes dans la variante : `3000 Synthetic operating revenue` et `4000 Synthetic operating expenses` ;
- outcome attendu via le moteur offline existant : `items=6`, `SUGGESTION=1`, `ABSTENTION=1`, `PRECONDITION_BLOCK=4`, `POLICY_BLOCK=0`, `TECHNICAL_DEGRADATION=0` ;
- aucun provider externe, contrat public, DB/migration, endpoint nouveau, decision v2, auto-apply, bulk apply, bascule v1 automatique, production ou spec `043`.

`042a2a5e` ajoute uniquement le polish UX des libelles utilisateur de la simulation locale offline v2 :

- les compteurs affichent des libelles metier : `Propositions a verifier`, `Sans proposition`, `Affectations manuelles`, `Hors perimetre`, `Indisponibles` ;
- les cartes affichent des libelles metier : `Proposition a verifier`, `Aucune proposition`, `Affectation manuelle a utiliser`, `Hors perimetre local`, `Simulation indisponible` ;
- les libelles techniques visibles `outcome v2` et `Resume par outcome v2` ne sont plus exposes dans le panneau v2 ;
- les enums v2 restent autorisees dans les types, contrats, fixtures et tests, mais ne doivent plus etre visibles dans la surface utilisateur v2 ;
- le bandeau exact `Simulation locale — aucune IA externe active.`, la posture non autoritative, l'absence de jeu de reference valide, le mapping manuel comme autorite metier, le lien `Affecter manuellement`, l'absence de boutons `ACCEPT`, `CORRECT`, `REJECT` et l'absence de fallback automatique v1 restent verifies ;
- aucun backend, contrat, OpenAPI, JSON Schema, seed, endpoint, DB/migration, auth, tenant isolation, audit, provider, valeur sensible, fichier d'environnement local, appel reseau IA, production ou spec `043`.

`042a2` devra encore traiter, dans une ou plusieurs missions separees, les livrables qui ne sont pas clos par `042a1`, `042a2a1`, `042a2a1b`, les artefacts candidats `042a2a2a`, le pack de cas candidats `042a2` ou le pack de double revue aveugle `042a2` :

- reponses humaines independantes ;
- adjudication ;
- promotion golden set eventuelle ;
- definition exacte du provider logique candidat, du modele exact, du prompt versionne et du schema hash ;
- schema de sortie runtime strict, compatible ou explicitement aligne avec `mapping-suggestion-v1` ;
- prompt file versionne pour le mapping runtime, sans prompt libre non trace ;
- golden set synthetique approuve pour le dossier demo ;
- validator local de la future sortie contractuelle, distinct des validators candidats `042a2a2a` et `042a2` ;
- criteres d'activation/arret et seuils de cout/latence figes avant runtime.

### 042b - Adapter provider backend derriere gateway

Objectif : brancher le provider de facon controlee, sans changer l'autorite metier.

Livrables attendus pour une implementation future :

- adapter provider cote backend uniquement, derriere `MappingSuggestionGenerationAccess` ou un port equivalent approuve ;
- si OpenAI reste candidat, appel uniquement vers le domaine prouve `eu.api.openai.com` et l'endpoint prouve `/v1/chat/completions` apres gate reseau ;
- exact model id / snapshot exact prouve dans le compte Ritomer, sans alias ni auto-upgrade ;
- tools desactives, `store=false` ou comportement equivalent confirme, sans web search, file search, code interpreter, MCP, batch, fine-tuning ou RAG ;
- aucun appel IA depuis le navigateur ;
- flag provider default off ;
- no-provider conserve ;
- timeout borne, erreur fail-closed et etats de degradation existants conserves ;
- validation JSON stricte avant conversion en read-model public ;
- aucun auto-apply, aucun bulk apply, aucune decision silencieuse.

### 042c - Evaluation, observabilite et smoke synthetique

Objectif : prouver que le pilote est mesurable et stoppable.

Livrables attendus pour une implementation future :

- execution du golden set synthetique ;
- mesure d'exactitude cible, abstention, preuves, corrections humaines, latence et cout ;
- logs et metrics uniquement agreges/minimises ;
- preuve que le flag off produit zero prompt, zero request provider, zero reseau provider, zero cout et zero log provider ;
- smoke synthetique local/controle, sans donnees clientes reelles.

### 042d - Decision humaine, audit et cloture d'activation pilote

Objectif : fermer le pilote sans affaiblir les garde-fous.

Livrables attendus pour une implementation future :

- decisions humaines `ACCEPT`, `CORRECT`, `REJECT` conservees comme seules actions engageantes ;
- audit/persistance des decisions humaines conservee et enrichie seulement si necessaire ;
- rapport d'evaluation du pilote avec seuils atteints ou raisons d'arret ;
- documentation minimale mise a jour si la verite IA du present change reellement ;
- aucune spec `043` creee par defaut.

## 4. Architecture gateway/provider

### Principe

Le runtime provider ne peut entrer que par le backend.

Flux cible :

1. Le frontend appelle uniquement les endpoints REST existants de suggestions et de decision.
2. Le backend resout tenant, RBAC et dossier avant toute generation.
3. `mapping.application` construit une demande minimisee via la frontiere IA.
4. L'AI Gateway selectionne soit le no-provider, soit l'adapter provider runtime si les flags et gates sont actifs.
5. Le provider retourne un JSON strict.
6. Le backend valide schema, versions, preuves, cible admissible, compte eligible et coherence d'import.
7. Seules les suggestions valides sont exposees au read-model.
8. Toute decision engageante repasse par la decision humaine existante.

### Contraintes d'architecture

- Monolithe modulaire conserve.
- Pas de microservice IA pour `042`.
- REST first conserve.
- GraphQL interdit dans `042`.
- RAG et vector store interdits dans `042`.
- Provider SDK interdit sans dependency/security review signee.
- Client HTTP backend direct controle par l'application a privilegier si aucun SDK n'est approuve.
- Secrets runtime uniquement via configuration/secret management approuve, jamais dans le repo.
- Aucun fallback permissif : une sortie douteuse devient non decisionable.

### Payload provider autorisable

Seulement apres gates, seulement pour le dossier demo synthetique, et seulement selon la whitelist draft `policies/ai-payload-whitelist-mapping-runtime-042a.md` :

- `latestImportVersion` ;
- `taxonomyVersion` ;
- `accountCode` synthetique, borne et non identifiant ;
- `sanitizedAccountLabel` uniquement, jamais le libelle brut ;
- `balanceSignal` borne, non reversible et limite aux valeurs documentees ;
- cibles avec `code`, `label`, `selectable`, `deprecated`, filtrees pour n'envoyer que les cibles selectionnables et non depreciees ;
- `schemaVersion` ;
- `schemaHash` ;
- `promptVersion`.

Metadonnees locales non envoyees au provider :

- `providerLogicalName` ;
- `modelExactId` ;
- cout ;
- latence ;
- request id ou trace id.

Interdit dans le payload provider :

- donnees clientes reelles ;
- tenant/client/actor identifiers en clair ;
- montants bruts ;
- emails, noms, IBAN, telephones, URLs privees et references longues ;
- CSV brut ;
- documents, workpapers complets ou audit brut ;
- secrets, tokens, credentials, cookies, DSN, valeurs `.env` ;
- storage keys, signed URLs, chemins prives ;
- donnees cross-tenant.

## 5. Contrat de sortie structure

Le provider runtime doit produire un JSON strict, jamais du texte libre, du markdown ou une reponse a reparer.

L'ancien exemple logique `042a1` de sortie par compte est obsolete pour `042a2a1b`. Il ne doit plus servir de forme cible pour un futur contrat `mapping-suggestion-v2`, car il melangeait suggestion, abstention, score visible et texte explicatif libre.

Forme logique future attendue avant contrat, sans modifier les contrats actuels :

```json
{
  "outcome": "SUGGESTION",
  "accountCode": "1000",
  "suggestedTargetCode": "BS.ASSET.CASH_AND_EQUIVALENTS",
  "evidence": [
    {
      "type": "ACCOUNT_LABEL",
      "ref": "balance_import_line:1000",
      "snippet": "Bank CHF"
    },
    {
      "type": "TARGET_TAXONOMY",
      "ref": "manual-mapping-targets-v2:BS.ASSET.CASH_AND_EQUIVALENTS",
      "snippet": "Cash and cash equivalents"
    }
  ],
  "explanationCode": "TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE",
  "schemaVersion": "mapping-suggestion-v2",
  "promptVersion": "mapping-suggestion-runtime-v1",
  "modelVersion": "provider-model-exact-id"
}
```

```json
{
  "outcome": "ABSTENTION",
  "accountCode": "4700",
  "reasonCode": "INSUFFICIENT_EVIDENCE",
  "evidence": [
    {
      "type": "ACCOUNT_LABEL",
      "ref": "balance_import_line:4700",
      "snippet": "Sanitized synthetic label"
    }
  ],
  "explanationCode": "EVIDENCE_NOT_SUFFICIENT_FOR_AFFECTATION",
  "schemaVersion": "mapping-suggestion-v2",
  "promptVersion": "mapping-suggestion-runtime-v1",
  "modelVersion": "provider-model-exact-id"
}
```

Regles obligatoires :

- `additionalProperties=false`.
- la forme future est une union stricte `SUGGESTION | ABSTENTION`.
- les champs propres a une branche sont omis quand ils ne s'appliquent pas ; aucun placeholder vide ne doit etre encode pour simuler leur absence.
- `suggestedTargetCode` existe uniquement sur `SUGGESTION`.
- `reasonCode` existe uniquement sur `ABSTENTION`.
- `requiresHumanReview=true` est impose par le backend pour toute suggestion exposee ; il ne doit pas etre traite comme une decision fournisseur.
- `SUGGESTION` exige exactement une cible admissible, pas seulement connue, selectable et non depreciee.
- `admissible` signifie : cible connue dans la version/hash de taxonomie exacts, selectable comme propriete statique, non depreciee, et autorisee par les regles de contexte du pilote.
- aucun score de confiance numerique n'est visible dans l'interface.
- aucun texte libre provider n'est visible dans l'interface.
- les explications visibles viennent de messages backend deterministes issus de codes approuves.
- `evidence[]` est non vide pour toute suggestion exposee.
- toute evidence est typee, courte, tenant-scopee, non sensible et verifiable.
- le compte doit exister dans la derniere balance importee du dossier demo synthetique.
- le backend calcule ou conserve un fingerprint sans labels, snippets, montants, prompts, outputs bruts ni identifiants sensibles.
- une cible fournisseur inconnue, depreciee, non selectionnable ou contextuellement inadmissible est `INVALID_MODEL_OUTPUT` ou degradation technique, jamais `TAXONOMY_GAP`.
- les comptes deja affectes ou non eligibles sont traites comme precondition ou policy outcome, pas comme abstention metier.

`mapping-suggestion-v2` expose maintenant ces outcomes, reason codes et etats de degradation comme read-model normalise Ritomer. Une future implementation provider devra lier explicitement la sortie provider au contrat et au schema hash selectionnes avant tout consumer provider-output. Cette mission documentaire ne modifie aucun contrat.

Readiness `042a1` puis `042a2a4` : v1 reste inchange, v2 existe et preserve v1, v2 reste sans endpoint provider reel, sans provider runtime, sans secret et sans appel reseau IA. `042b` reste BLOQUE par provider-readiness, signatures humaines, revue/pinning gate de l'exact model id, privacy/legal, quotas, budget cap, kill switch, log hygiene, golden set autoritatif, validator et gate reseau.

Semantic readiness `042a2a1` puis read-model `mapping-suggestion-v2` : les semantics retenues imposent :

- `SUGGESTION` visible comme `Proposition à vérifier` ;
- degradation technique visible comme `Proposition momentanément indisponible` ;
- `POLICY_BLOCK` visible comme `Cette demande n'est pas eligible a l'affectation assistee` ;
- `ABSTENTION` visible avec le titre `Aucune proposition` et un message deterministe par `reasonCode` ;
- le mot `affectation` dans l'interface, `mapping` restant interne ;
- aucune cible et aucune confiance sur `ABSTENTION` ;
- aucun texte libre provider visible ;
- aucune confiance numerique visible ;
- actions `SUGGESTION` : `Valider la proposition`, `Choisir une autre rubrique`, `Rejeter` ;
- aucun `Rejeter` sur `ABSTENTION` ;
- reason codes autorises uniquement : `OUT_OF_SCOPE`, `CONFLICTING_SIGNALS`, `INSUFFICIENT_EVIDENCE`, `TAXONOMY_GAP`, `AMBIGUOUS_TARGET` ;
- `POLICY_BLOCK` n'est pas une abstention metier : requete non synthetique, cross-tenant, hors allowlist, hors provenance ou gate invalide implique zero appel provider ;
- `OUT_OF_SCOPE` est reserve a un compte d'une requete autorisee mais hors perimetre metier de l'assistance IA ;
- `TAXONOMY_GAP` est reserve a un concept metier valide absent de la taxonomie pilote gelee ;
- une cible provider inconnue, depreciee, non selectionnable ou contextuellement inadmissible est `INVALID_MODEL_OUTPUT` ou degradation technique, jamais `TAXONOMY_GAP`.

Arbre normatif obligatoire :

1. Autorisation et eligibilite : sinon `POLICY_BLOCK` ou futur etat de precondition, sans appel provider quand la policy bloque.
2. Incident runtime ou sortie invalide : sinon degradation technique, dont `INVALID_MODEL_OUTPUT`.
3. Concept metier etabli mais explicitement hors scope : `ABSTENTION / OUT_OF_SCOPE`.
4. Elements materiels contradictoires : `ABSTENTION / CONFLICTING_SIGNALS`.
5. Concept ou candidats insuffisamment etablis : `ABSTENTION / INSUFFICIENT_EVIDENCE`.
6. Calcul des cibles admissibles :
   - `0` = `ABSTENTION / TAXONOMY_GAP` ;
   - `2+` = `ABSTENTION / AMBIGUOUS_TARGET` ;
   - `1` = `SUGGESTION`.

Ces semantics sont encodees dans `mapping-suggestion-v2` comme read-model normalise Ritomer. Elles ne constituent ni un output provider brut, ni une autorisation runtime provider, ni une autorisation d'appel reseau IA.

## 6. Feature flags et mode no-provider

Flags cibles :

- `ritomer.ai.mapping-suggestions.enabled=false` reste default off.
- Un flag runtime provider dedie doit rester default off, par exemple `ritomer.ai.mapping-suggestions.provider-runtime.enabled=false`.
- Un garde-fou demo synthetique doit rester actif pour le pilote, par exemple `ritomer.ai.mapping-suggestions.synthetic-demo-only=true`.

Etat actuel verifie en lecture seule : seul `ritomer.ai.mapping-suggestions.enabled` existe dans le backend. Les flags provider-runtime et synthetic-demo-only sont des cibles `042b`; ils ne sont pas declares verifies par `042a1`.

Comportements obligatoires :

- flag suggestions off : etat `DISABLED`, aucune generation, aucun prompt, aucun appel provider, aucun cout ;
- provider runtime off : no-provider conserve des que la capacite de suggestions est activee, sans appel provider ;
- provider runtime on : uniquement apres gates, uniquement cote backend, uniquement sur dossier demo synthetique eligible ;
- erreur, timeout, schema invalide ou preuves insuffisantes : fail-closed et fallback mapping manuel ;
- aucune decision humaine acceptee si la suggestion courante est absente, stale, invalide, non decisionable ou issue d'un import different.

## 7. Golden set synthetique

Le golden set de `042` doit rester synthetique et sans donnee client reelle.

Il doit couvrir au minimum :

- banque/caisse simple ;
- debiteurs/receivables ;
- fournisseurs/payables ;
- ventes/revenue ;
- charges/expenses ;
- immobilisation ou actif non courant si present dans la taxonomie selectable ;
- compte de clearing ambigu ;
- compte avec evidence insuffisante ;
- compte autorise mais hors perimetre metier de l'assistance IA, attendu en `ABSTENTION / OUT_OF_SCOPE` ;
- concept metier valide absent de la taxonomie pilote gelee, attendu en `ABSTENTION / TAXONOMY_GAP` ;
- sortie provider avec cible inconnue, non selectable, deprecated ou contextuellement inadmissible, attendue en `INVALID_MODEL_OUTPUT` ou degradation technique ;
- cas `POLICY_BLOCK` distincts : requete non synthetique, cross-tenant, hors allowlist, hors provenance ou gate invalide, avec zero appel provider ;
- libelle contenant email, telephone, IBAN, URL ou reference longue a sanitiser ;
- cas deja mappe ou non eligible, attendu en precondition ou policy outcome, pas en abstention metier ;
- cas ou l'abstention est attendue.

Le golden set doit verifier :

- JSON strict et schema valide ;
- exact match cible sur cas clairs ;
- abstention sur cas ambigus/insuffisants ;
- distinction explicite entre `OUT_OF_SCOPE`, `POLICY_BLOCK`, `TAXONOMY_GAP` et `INVALID_MODEL_OUTPUT` ;
- zero appel provider sur `POLICY_BLOCK` ;
- invalid output, et non abstention metier, quand une cible provider est inconnue, non selectable, deprecated ou contextuellement inadmissible ;
- evidence non vide et non sensible ;
- absence de secret, token, credential, cookie, DSN, `.env`, storage key, signed URL ;
- absence de donnees client reelles ;
- exactement une cible admissible pour toute suggestion exposee ;
- `requiresHumanReview=true` partout ;
- prompt/model/schema versions non vides et pinnes.

## 8. Metriques d'evaluation

Les metriques suivantes sont obligatoires pour l'activation pilote.

### Exactitude cible

- 100 % schema validity.
- 100 % cibles admissibles pour les suggestions exposees.
- 100 % `requiresHumanReview=true`.
- Objectif initial : au moins 85 % d'exact match sur les cas synthetiques clairs et positifs.
- Aucun faux positif expose sur les cas attendus en abstention, rejet ou non eligible.

### Taux d'abstention

- 100 % d'abstention sur les cas du golden set marques ambigus ou insuffisamment prouves.
- 100 % de routage `OUT_OF_SCOPE` sur les comptes de requetes autorisees mais hors perimetre metier de l'assistance IA.
- 100 % de routage `TAXONOMY_GAP` sur les concepts metier valides absents de la taxonomie pilote gelee.
- Les `POLICY_BLOCK` et `INVALID_MODEL_OUTPUT` sont exclus du taux d'abstention metier et mesures separement.
- Taux d'abstention sur cas clairs mesure et reporte ; seuil pilote indicatif : maximum 20 %.
- Toute absence d'abstention sur un cas de donnees insuffisantes bloque l'activation.

### Qualite des preuves

- 100 % suggestions exposees avec au moins une evidence exploitable.
- Evidence `ACCOUNT_LABEL` et `TARGET_TAXONOMY` attendues sur les cas simples.
- 0 evidence sensible, brute, cross-tenant, storage key, signed URL ou chemin prive.
- Score de revue humaine cible : preuves jugees suffisantes sur au moins 90 % des suggestions exposees.

### Corrections humaines

- Mesurer les taux `ACCEPT`, `CORRECT`, `REJECT` par compte et par run synthetique.
- Objectif pilote : `CORRECT + REJECT` inferieur ou egal a 30 % sur cas clairs.
- Toute correction recurrente sur une meme famille de comptes doit produire une analyse avant activation elargie.

### Latence

- Timeout provider borne avant code.
- Objectif pilote indicatif : p50 inferieur ou egal a 2,5 s et p95 inferieur ou egal a 8 s pour le dossier demo synthetique.
- Tout timeout expose `TIMEOUT` sans suggestion partielle fiable.

### Cout

- Cout estime agrege mesure par run synthetique, sans payload, prompt ou output en logs.
- Objectif pilote indicatif : cout inferieur ou egal a CHF 1.00 par run complet du dossier demo synthetique.
- Cost spike ou cout non mesure bloque l'activation.

## 9. Criteres d'activation et d'arret

### Activation pilote autorisee seulement si

Ces criteres sont cumulatifs. Ils s'ajoutent aux exigences `030d` existantes et ne les remplacent pas.

- Gates pre-code de la section 15 signes et merges.
- Provider logique, modele exact, promptVersion, schemaVersion et schema hash pinnes.
- Feature flags default off verifies.
- Mode no-provider conserve.
- Aucun secret dans le repo.
- Aucun `.env` lu, commite ou requis par les tests standards.
- Tests flag off prouvent zero prompt, zero request provider, zero reseau provider, zero cout et zero log provider.
- Logs et metrics ne contiennent pas de donnees sensibles.
- Fallback manuel verifie.
- Human-in-the-loop verifie.

### Arret immediat obligatoire si

- tentative d'utilisation de donnees clientes reelles ;
- fuite de prompt, payload, output, account label sensible, montant, tenant/client/actor identifier ou evidence sensible en logs ;
- sortie hors schema exposee ;
- evidence absente ou insuffisante exposee comme fiable ;
- cible inconnue, non selectable ou deprecated exposee ;
- suspicion cross-tenant ;
- provider indisponible ou timeout au-dessus du seuil ;
- cout au-dessus du seuil pilote ;
- auto-apply, bulk apply ou decision silencieuse detectee ;
- appel IA depuis le navigateur ;
- secret ou `.env` implique dans le repo ou les logs.

L'arret se fait par kill switch feature flag et retour immediat au mapping manuel/no-provider.

## 10. Tests unitaires, integration et smoke

### Tests unitaires attendus

- flag off : zero appel adapter/provider ;
- provider runtime off : no-provider conserve ;
- synthetic-demo-only : `POLICY_BLOCK` hors requete synthetique autorisee et zero appel provider ;
- minimisation : aucun tenant/client/actor id, aucun montant brut, aucun prompt/provider/secret dans la request ;
- sanitizer : emails, URLs, IBAN, telephones, UUIDs, references longues retires ;
- prompt builder : versions et schema hash pinnes, aucun champ hors whitelist ;
- validator : JSON strict, `additionalProperties=false`, enums stricts, `requiresHumanReview=true` ;
- validator : rejet markdown/prose/code fence/texte libre ;
- validator : rejet evidence vide, cible inconnue, cible non selectable, cible deprecated, cible contextuellement inadmissible, score visible interdit, versions vides, avec `INVALID_MODEL_OUTPUT` ou degradation technique ;
- timeout/unavailable : etats `TIMEOUT` et `UNAVAILABLE` fail-closed ;
- metrics/logs : agregats seulement, aucun payload/prompt/output.

### Tests integration attendus

- backend avec fake provider local controle, sans provider reel par defaut ;
- flag off prouve zero request provider ;
- flag on + dossier demo synthetique appelle uniquement l'adapter backend ;
- tenant/RBAC/closing scope verifies avant provider ;
- mauvais tenant rejete avant generation ;
- latest import stale bloque la decision ;
- `ACCEPT`, `CORRECT`, `REJECT` restent unitaires, idempotents et humains ;
- `ACCEPT` et `CORRECT` passent par la logique de mapping manuel ;
- `REJECT` ne cree ni ne modifie aucun mapping manuel ;
- aucun audit sur `GET` suggestions ;
- decisions humaines durablement tracables ;
- aucune nouvelle dependance reseau ou SDK non approuvee.

### Smoke attendu

- smoke synthetique controle uniquement apres gates ;
- dossier demo ouvrable ;
- suggestions visibles uniquement si flags actifs ;
- fallback manuel visible et utilisable quand IA off, timeout ou invalide ;
- aucune requete provider depuis le navigateur ;
- aucun secret, bearer, cookie, DSN, credential ou valeur `.env` expose ;
- cout et latence agreges disponibles sans payload.

## 11. Audit des decisions humaines

Les decisions humaines restent la seule surface engageante.

Exigences :

- chaque decision `ACCEPT`, `CORRECT` ou `REJECT` doit etre rattachee a tenant, dossier, compte, actor, timestamp, latestImportVersion, suggestionFingerprint et payload canonique ;
- idempotence conservee pour eviter les doublons ;
- `ACCEPT` et `CORRECT` doivent continuer a passer par la logique metier de mapping manuel et ses audits existants quand un mapping est cree ou modifie ;
- `REJECT` ne cree ni mapping manuel ni changement comptable ;
- la trace de decision ne doit pas stocker prompt brut, output brut, payload provider complet, snippets sensibles ou secret ;
- les preuves referencees doivent rester verifiables sans exposer de donnees non autorisees ;
- aucune lecture `GET` de suggestions ne doit emettre un `audit_event`.

Si l'implementation future introduit un nouvel evenement audit dedie aux decisions de suggestion, son contrat devra etre explicite et minimal avant code.

## 12. Privacy et log hygiene

Interdit dans logs, traces, metrics detaillees, support bundles et eval fixtures :

- prompts bruts ;
- outputs bruts ;
- payloads complets ;
- account labels sensibles en clair ;
- montants en clair ;
- snippets evidence sensibles ;
- tenant/client/actor identifiers non minimises ;
- secrets, tokens, credentials, cookies, DSN, valeurs `.env` ;
- storage keys, signed URLs, chemins prives ;
- CSV brut, documents, workpapers complets, audit brut ;
- donnees cross-tenant.

Autorise en logs/metrics uniquement sous forme minimisee :

- request id technique sans identifiant metier ;
- state final ;
- provider logique ;
- schemaVersion, promptVersion, schema hash, model exact ID ;
- latence agregee ;
- nombre de comptes envoyes ;
- nombre de suggestions valides ;
- nombre d'outputs rejetes ;
- raison de rejet normalisee ;
- cout estime agrege.

## 13. Hors-scope

- donnees clientes reelles ;
- RAG ;
- vector store ;
- GraphQL ;
- auto-apply ;
- bulk apply ;
- nouvelle taxonomie ;
- etats financiers finaux ;
- export officiel ;
- annexe legale finale ;
- auth ;
- DB/migration ;
- spec `043` ;
- appels IA depuis le navigateur ;
- remplacement du mapping manuel ;
- promesse CO ou statutaire ;
- SDK/dependance provider sans review signee ;
- microservice IA.

## 14. Fresh Evidence Pack attendu

Le Fresh Evidence Pack de cloture de cette mission documentaire doit contenir :

1. Resume metier ou documentaire.
2. Demande initiale ou plan valide.
3. Surface de mission.
4. Liste exacte des fichiers modifies.
5. Resume precis du diff par fichier.
6. Commandes reellement executees.
7. Sorties fraiches des tests/checks.
8. Statut Git final.
9. Tests ajoutes ou modifies.
10. Tests non executes avec justification.
11. Ecarts eventuels par rapport au plan valide.
12. Risques residuels.
13. Revue humaine recommandee ou non.

Il ne doit contenir aucun secret, token, cle, cookie, DSN, credential ou valeur `.env`.

Pour une future implementation runtime `042`, le Fresh Evidence Pack devra aussi inclure :

- statut des gates CTO et Expert Review Board ;
- preuve feature flag default off ;
- preuve no-provider conserve ;
- resultat golden set synthetique ;
- resultat flag off zero prompt/request/reseau/cout/log provider ;
- mesures latence et cout agregees ;
- preuve d'absence d'appel IA navigateur ;
- preuve de fallback manuel.

## 15. Gates pre-code

Ces gates pre-code sont cumulatifs avec les exigences `030d` existantes ; ils les preservent et ne les diminuent pas.

Avant tout code provider reel, les gates suivants doivent etre signes et merges :

- approbation CPO ;
- CTO Gate signe ;
- Security / Privacy Review signee ;
- IA Governance Review signee ;
- Expert Review Board signe ;
- provider-readiness record signe pour le provider et le modele exacts ;
- dependency/security review signee, ou `N/A` explicitement justifie si aucune nouvelle dependance n'est introduite ;
- payload whitelist synthetique signee ;
- runbook incident pret ;
- semantic readiness signee ;
- golden set synthetique vert ;
- preservation de `mapping-suggestion-v1`, binding explicite de `mapping-suggestion-v2` et absence de bascule implicite verifies.

Aucun code `042b` ne peut commencer avant le merge des records de gates `042a` pre-code signes. Aucune spec `043` ne doit etre creee.

Records drafts `042a1` :

- `policies/ai-runtime-gates-record-042a.md` ;
- `policies/ai-provider-readiness-record-042a.md` ;
- `policies/dependency-security-review-042a.md` ;
- `policies/ai-payload-whitelist-mapping-runtime-042a.md`.

Ces records ne portent aucune signature et ne valent pas autorisation de code provider.

Records drafts `042a2a1` :

- `policies/ai-mapping-semantic-readiness-record-042a2.md` ;
- `policies/ai-mapping-annotation-guide-042a2.md` ;
- `policies/ai-mapping-taxonomy-pilot-record-042a2.md` ;
- `policies/ai-mapping-business-evaluation-protocol-042a2.md` ;
- `policies/ai-mapping-pilot-scope-manifest-042a2.md`.

Ces records ne portent aucune signature et ne valent pas autorisation de code provider.

### Gate avant activation reseau provider

Le gate d'activation reseau est distinct du gate pre-code. Meme si `042b` est implemente plus tard, aucun appel provider n'est autorise sans gate d'activation formel. La tentative `042b1a` reste `FAILED_NON_CONCLUSIVE` et le retry final `042b1b` est `FAIL_HTTP_400_INVALID_REQUEST_ERROR / STOP_NO_FALLBACK` ; aucun des deux ne satisfait ce gate.

Avant tout nouvel appel reseau provider :

- tous les gates pre-code doivent rester satisfaits ;
- gates CPO/CTO/Security/IA Governance/Expert Board avec signatures humaines ;
- compte/projet OpenAI Ritomer identifie ;
- projet cree en region `Europe EEA + Switzerland` ou perimetre equivalent prouve ;
- domaine `eu.api.openai.com` confirme ;
- DPA/SCC/subprocessors revus et archives ;
- ZDR ou MAM tranche, avec amendement ZDR si requis ;
- disponibilite du modele prouvee dans le compte Ritomer ;
- exact model id / snapshot exact candidat `gpt-5.4-mini-2026-03-17` prouve par UI manuelle, puis pinne dans le gate reseau avant execution ;
- endpoint `/v1/chat/completions` non reteste dans le cadre canary `042b1`, avec `retry_remaining=0` ; toute future activation reseau exige un nouveau gate reseau formel distinct ;
- tools desactives ;
- `store=false` ou comportement equivalent confirme ;
- aucun web search, file search, code interpreter, MCP, batch, fine-tuning ou RAG ;
- quotas RPM/TPM et rate limits reels du projet documentes ;
- budget cap hard stop en place ;
- kill switch teste ;
- logs internes sans prompt, payload, output, header, secret, tenant interne ou account label ;
- golden set autoritatif et evals verts avant exposition utilisateur ;
- provider, modele exact, region, retention, training/non-training, logging, cout, latence et quotas doivent etre documentes avec preuve ;
- le secret management runtime doit etre valide sans secret repo ni dependance `.env` ;
- le flag provider-runtime doit etre prouve default off ;
- flag off doit prouver zero prompt, zero request provider, zero reseau provider, zero cout provider et zero log provider ;
- no-provider puis mapping manuel doivent etre prouves comme fallback ;
- logs et metrics doivent etre agreges/minimises, sans payload, prompt, output, label sensible, montant brut, identifiant tenant/client/acteur, secret, storage key ou signed URL ;
- golden set autoritatif synthetique et validation de schema doivent etre verts ;
- chemin canary `042b1` ferme, sans retry restant ;
- aucun appel provider depuis le navigateur ne doit exister.

Blockers maintenus avant tout nouvel appel reseau provider :

- gate reseau provider formellement valide pour toute future activation, sans retry canary `042b1` restant ;
- creation d'une cle API seulement au moment du test controle futur ;
- cle jamais commise, jamais transmise a Codex, jamais collee dans un chat ;
- secret management runtime valide sans secret repo ni dependance `.env` ;
- DPA/SCC/subprocessors revus ;
- ZDR ou MAM tranche ;
- `store=false` ou comportement equivalent confirme ;
- region effective processing/storage documentee ;
- retention prompts/payloads/outputs/logs/traces documentee ;
- support/debug access documente ;
- deletion process documente ;
- incident notification documentee ;
- quotas runtime reels documentes ;
- budget, kill switch et log hygiene runtime prouves ;
- golden set autoritatif vert ;
- signatures CPO/CTO/Security/IA Governance/Expert Board ;
- payload whitelist et runbook valides ;
- chemin canary `042b1` ferme et absence de fallback/retry maintenue.

### CTO Gate

Le CTO Gate doit valider :

- architecture backend-only via gateway ;
- absence de microservice, GraphQL, RAG et vector store ;
- flags default off et kill switch ;
- timeout, fail-closed et fallback ;
- strategie provider/dependance ;
- observabilite cout/latence sans payload ;
- compatibilite monolithe modulaire, REST first, tenant scope et no-Docker local.

### Expert Review Board

L'Expert Review Board doit valider :

- pertinence metier du pilote sur donnees synthetiques ;
- schema de sortie, outcomes et reason codes explicites ;
- golden set et seuils ;
- payload whitelist ;
- prompt/model/schema pinning ;
- privacy/log hygiene ;
- absence de donnees clientes reelles ;
- human-in-the-loop et audit des decisions humaines ;
- criteres d'activation et d'arret.

### CO Review

CO Review non requise pour `042` tant que le pilote reste limite au mapping synthetique et ne produit ni wording statutaire, ni decision CO, ni etat financier final, ni annexe legale finale.

CO Review devient obligatoire si le perimetre derive vers :

- wording CO/statutaire ;
- decision de classement presentee comme definitive ;
- etats financiers finaux ;
- export officiel ;
- annexe legale finale ;
- donnees clientes reelles ou production.

## Definition of done de la future implementation 042

Une future implementation `042` ne pourra etre declaree terminee que si :

- les gates pre-code sont traces ;
- le runtime reste default off ;
- no-provider et mapping manuel restent disponibles ;
- seules les donnees synthetiques sont utilisees ;
- aucun appel IA navigateur n'existe ;
- le provider est appele uniquement via backend/gateway ;
- les sorties sont strictement validees ;
- les erreurs fail-closed sont testees ;
- les couts et latences sont mesures sans journaliser les donnees ;
- les decisions humaines sont unitaires, idempotentes et tracables ;
- aucun contrat, runbook ou document durable impacte n'est laisse non mis a jour ;
- aucun secret n'est present dans le repo ;
- aucune spec `043` n'est creee automatiquement.
