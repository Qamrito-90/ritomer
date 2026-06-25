# 042 - Controlled AI mapping runtime pilot V1

## Status

Active.

## Mode

SPEC_CREATION DOCS_ONLY, avec surface `BACKEND_RUNTIME_INTERNE / EVALS` limitee a `042a2a3`.

Cette spec active cadre le premier pilote IA runtime reel de Ritomer, limite aux suggestions de mapping sur le dossier demo synthetique.

Jusqu'aux livrables `042a2` precedents, elle ne livrait aucun runtime, aucun provider, aucun backend, aucun frontend, aucune DB ou migration, aucun OpenAPI, aucune CI, aucune dependance, aucun secret, aucune valeur `.env`, aucun appel reseau IA et aucune spec `043`. `042a2a3` fait exception uniquement pour un moteur offline backend interne d'evaluation candidate, sans surface produit ni provider reel.

`042a1` ajoute uniquement un gate pack draft de gouvernance/readiness avant tout code provider `042b`. Les records restent `DRAFT` ou `PENDING_EVIDENCE`, sans signature humaine, sans approbation et sans date de gate inventee.

`042a2a1` ajoute uniquement un semantic readiness pack draft avant tout contrat `mapping-suggestion-v2`. Les records restent `DRAFT` ou `PENDING_EVIDENCE`, sans signature humaine, sans approbation, sans contrat, sans provider, sans prompt runtime, sans golden set et sans validator.

Le pack de cas candidats `042a2` ajoute uniquement des fixtures synthetiques et un validator local. Les artefacts restent `CANDIDATE / PENDING_DOUBLE_REVIEW / NOT_GOLDEN / NOT_AUTHORITATIVE`, sans signature humaine, sans contrat, sans provider, sans prompt runtime, sans backend/frontend runtime, sans DB/migration, sans OpenAPI, sans secret, sans `.env`, sans appel reseau IA et sans spec `043`.

Le pack de double revue aveugle `042a2` transforme les 17 cas candidats en deux paquets de revue humaine independants. Les artefacts restent `BLIND_REVIEW_INPUT / PENDING_INDEPENDENT_REVIEW / NOT_GOLDEN / NOT_AUTHORITATIVE`, sans reponses humaines, sans adjudication, sans promotion golden set, sans contrat, sans provider, sans prompt runtime, sans backend/frontend runtime, sans DB/migration, sans OpenAPI, sans secret, sans `.env`, sans appel reseau IA et sans spec `043`.

`042a2a3` ajoute un premier moteur offline backend interne et une task Gradle d'evaluation des 17 cas candidats. Ce livrable reste `CANDIDATE_EVAL / NOT_GOLDEN / NOT_AUTHORITATIVE / NOT_MODEL_QUALITY`, sans provider reel, modele reel, prompt runtime, endpoint, DB/migration, OpenAPI, contrat public, secret, `.env`, appel reseau IA, production ou spec `043`.

`042a2a4` ajoute uniquement le contrat normalise `mapping-suggestion-v2` comme read-model applicatif Ritomer, un transformer offline backend depuis le moteur `042a2a3` et un parser frontend strict. Ce livrable ne cree aucun provider reel, modele reel, prompt runtime actif, endpoint actif, controller, wiring Spring, DB/migration, ecran frontend, auto-apply, bulk apply, secret, `.env`, appel reseau IA, production ou spec `043`.

## Surface

DOCS_GIT / AI_RUNTIME_SPEC.

Surface `042a1` : DOCS_GIT / AI_GOVERNANCE.

Surface `042a2a1` : DOCS_GIT / AI_GOVERNANCE / FIDUCIARY_GOVERNANCE.

Surface pack de cas candidats `042a2` : EVALS / CONTRACTS_DATA / DOCS_GIT.

Surface pack de double revue aveugle `042a2` : EVALS / DOCS_GIT.

Surface moteur offline `042a2a3` : BACKEND_RUNTIME_INTERNE / EVALS.

Surface contrat normalise `042a2a4` : CONTRACTS / BACKEND_RUNTIME_INTERNE / FRONTEND_CONSUMER.

## Risk

C.

Risque lie a l'ouverture d'une future capacite provider reelle, meme strictement bornee aux donnees synthetiques. Le risque est documentaire dans cette mission, car aucun code runtime n'est modifie.

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
- `contracts/openapi/mapping-suggestions-api.yaml`
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
  - `frontend/src/lib/api/mapping-suggestions.test.ts`
  - `frontend/src/app/ai-mapping-suggestions-panel.test.tsx`

Contrats impactes par cette mission documentaire : AUCUN.

Contract readiness `042a1` :

- `contracts/ai/mapping-suggestion.schema.json` et `contracts/openapi/mapping-suggestions-api.yaml` ont ete verifies en lecture seule.
- `mapping-suggestion-v1` ne represente pas explicitement `abstention`.
- `mapping-suggestion-v1` ne represente pas explicitement les reason codes ni les etats de degradation semantiques requis par `042a2a1b`.
- `042b` est BLOQUE jusqu'a decision contractuelle explicite : ajouter ces semantics a `mapping-suggestion-v1`, creer une nouvelle version de schema, ou les garder hors output/read-model provider.
- Aucun contrat n'est modifie par `042a1`.

Semantic readiness `042a2a1` :

- `policies/ai-mapping-semantic-readiness-record-042a2.md` definit les etats `SUGGESTION`, `ABSTENTION` et degradation technique avant contrat.
- `policies/ai-mapping-annotation-guide-042a2.md` definit l'annotation, la double annotation et l'adjudication.
- `policies/ai-mapping-taxonomy-pilot-record-042a2.md` definit les exigences de taxonomie pilote sans creer de taxonomie.
- `policies/ai-mapping-business-evaluation-protocol-042a2.md` definit les objectifs d'evaluation metier sans creer de golden set ni validator.
- `policies/ai-mapping-pilot-scope-manifest-042a2.md` definit le perimetre metier pilote draft sans approuver de taxonomy snapshot.
- `042a2a1` et `042a2a1b` ne modifient aucun contrat et ne redigent pas le contrat `mapping-suggestion-v2`.
- `042b` reste BLOQUE tant que la semantic readiness, le manifeste de perimetre pilote, la decision contractuelle, le golden set, le validator, les gates provider et les signatures humaines requises ne sont pas termines.

Contract implementation `042a2a4` :

- `contracts/ai/mapping-suggestion-v2.schema.json` encode maintenant une union stricte `SUGGESTION | ABSTENTION | POLICY_BLOCK | PRECONDITION_BLOCK | TECHNICAL_DEGRADATION` avec `scope` ferme `ACCOUNT | REQUEST | BATCH` selon le code.
- `contracts/openapi/mapping-suggestions-v2-api.yaml` porte uniquement des composants OpenAPI v2 contract-only avec `paths: {}`, `taxonomyHash` dans le read-model et aucun endpoint actif declare.
- `contracts/ai/mapping-suggestion-v2.corpus.json` porte le corpus contractuel partage valide/invalide utilise par les tests backend, frontend et les validations de schema/OpenAPI.
- Le backend ajoute seulement un transformer offline depuis les resultats `042a2a3`, avec fingerprint reserve aux `SUGGESTION` et calcule localement sur schema, dossier, import, version/hash taxonomie, outcome, compte, cible et preuves canonisees, sans controller, wiring Spring, provider runtime, reseau, DB ou migration.
- Le frontend ajoute seulement un parser Zod v2 strict aligne sur le corpus partage, sans ecran ni basculement du consumer v1 existant.
- Les contrats v1 `contracts/ai/mapping-suggestion.schema.json` et `contracts/openapi/mapping-suggestions-api.yaml` restent inchanges ; il n'y a aucun basculement implicite v1 -> v2.

Runbooks impactes par `042a1`, sans modification supplementaire par `042a2a1b` :

- `runbooks/ai-incident-response.md`

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

### Exclu hors moteur offline interne `042a2a3`

- Tout runtime produit expose, provider reel ou appel reseau IA.
- Tout appel provider.
- Toute lecture de secret, `.env`, token, cookie, DSN ou credential.
- Toute modification frontend, DB, migration, OpenAPI, contrat public, CI ou dependance.
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

`042a1` ne choisit pas de provider, ne choisit pas de modele, ne cree pas de prompt runtime, ne modifie pas le golden set, ne cree pas de validator et ne definit pas de metriques runtime. Provider, modele, region, retention, training/non-training, cout, latence et quotas restent `NON_DÉTERMINÉ` tant qu'une preuve externe et une signature humaine ne les remplacent pas.

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
- OpenAPI v2 contract-only avec composants, `taxonomyHash` dans le read-model et `paths: {}`, sans endpoint actif ;
- corpus contractuel partage valide/invalide pour validation JSON Schema, tests Kotlin, tests Zod et controle d'alignement OpenAPI ;
- transformer backend offline de `OfflineMappingEvalResult` vers le read-model v2, avec fingerprint de suggestion genere localement sur schema, dossier, import, version/hash taxonomie, outcome, compte, cible et preuves canonisees, sans exposition de `providerCallCount` ;
- parser frontend Zod v2 strict et messages utilisateur derives localement des codes, sans `messageCode` redondant ;
- aucune modification du controller v1, du service runtime v1, des contrats v1, de la DB, des migrations ou du wiring Spring.

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
- Client HTTP controle par l'application a privilegier si aucun SDK n'est approuve.
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
  "explanationCode": "TARGET_SUPPORTED_BY_APPROVED_EVIDENCE",
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

Si le contrat public doit evoluer pour exposer ces outcomes, reason codes et etats de degradation, l'implementation future devra mettre a jour les contrats impactes avant code consommateur. Cette mission documentaire ne modifie aucun contrat.

Readiness `042a1` : le check lecture seule conclut que le contrat actuel ne porte pas explicitement ces outcomes, reason codes et etats de degradation. `042b` reste donc BLOQUE tant qu'une decision contractuelle explicite n'est pas prise et documentee avant code consommateur.

Semantic readiness `042a2a1` : avant contrat `mapping-suggestion-v2`, les semantics draft imposent :

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

Ces semantics ne sont pas encore un contrat. Elles bloquent le contrat et le runtime tant qu'elles ne sont pas approuvees et encodees dans une version contractuelle explicite.

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
- decision contractuelle explicite sur outcomes, reason codes et etats de degradation.

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

Ces records ne portent aucune signature, ne valent pas autorisation de contrat `mapping-suggestion-v2` et ne valent pas autorisation de code provider.

### Gate avant activation reseau provider

Le gate d'activation reseau est distinct du gate pre-code. Meme si `042b` est implemente plus tard, aucun appel provider n'est autorise avant un gate d'activation signe.

Avant tout appel reseau provider :

- tous les gates pre-code doivent rester satisfaits ;
- provider, modele exact, region, retention, training/non-training, logging, cout, latence et quotas doivent etre documentes avec preuve ;
- le secret management runtime doit etre approuve sans secret repo ni dependance `.env` ;
- le flag provider-runtime doit etre prouve default off ;
- flag off doit prouver zero prompt, zero request provider, zero reseau provider, zero cout provider et zero log provider ;
- no-provider puis mapping manuel doivent etre prouves comme fallback ;
- logs et metrics doivent etre agreges/minimises, sans payload, prompt, output, label sensible, montant brut, identifiant tenant/client/acteur, secret, storage key ou signed URL ;
- golden set synthetique et validation de schema doivent etre verts ;
- aucun appel provider depuis le navigateur ne doit exister.

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
