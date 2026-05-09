# 030 - IA mapping assiste suggestion review V1

## Status

Active.

## Phase

SPEC_CREATION.

## Surface

DOCS_ONLY / SPEC_CREATION.

La surface future cadree par cette spec est sensible : CONTRACTS + BACKEND + IA GOVERNANCE, puis FRONTEND seulement dans un sous-livrable separe quand les contrats backend sont prets.

## Risk

C.

## Role de cette spec

Cette spec cadre la premiere capacite IA de Ritomer : un mapping assiste evidence-first sur la derniere balance importee.

Elle ne livre aucun runtime. Elle fixe les garde-fous, le contrat attendu, le decoupage et les gates avant toute implementation.

Posture non negociable : AI-ready, pas AI-led. L'IA propose une cible de mapping, mais ne l'applique jamais automatiquement. Le backend reste l'autorite metier, et l'utilisateur garde le controle sur accepter, rejeter ou corriger.

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
- `specs/done/003-import-balance-v1.md`
- `specs/done/005-manual-mapping-v1.md`
- `specs/done/008-financial-rubric-taxonomy-v2.md`
- `specs/done/029-pilot-closing-workflow-e2e-confidence-hardening-v1.md`
- `contracts/ai/mapping-suggestion.schema.json`
- `contracts/openapi/import-balance-api.yaml`
- `contracts/openapi/manual-mapping-api.yaml`
- `contracts/openapi/closing-api.yaml`
- `contracts/db/import-balance-v1.md`
- `contracts/db/manual-mapping-v1.md`
- `contracts/reference/manual-mapping-targets-v2.yaml`
- `prompts/guardrails/system-fr.md`
- `evals/mapping/README.md`
- `knowledge/retrieval-policy.md`
- `runbooks/ai-incident-response.md`
- `runbooks/local-dev.md`
- `docs/ui/ui-foundations-v1.md`
- `README.md`
- `docs/vision/ai-native.md`
- `docs/vision/architecture.md`
- `docs/vision/ux.md`
- `docs/playbooks/ai.md`
- `docs/playbooks/architecture.md`
- `docs/playbooks/ux.md`

## Resume metier

La capacite visee aide l'expert fiduciaire a accelerer le mapping des comptes d'une balance importee vers les cibles de mapping publiees par Ritomer.

Pour chaque ligne eligible de la derniere balance importee, le backend pourra preparer une suggestion de cible. La suggestion doit etre structuree, justifiee par des preuves exploitables et marquee comme necessitant une revue humaine.

L'utilisateur pourra ensuite accepter, corriger ou rejeter la suggestion. Seule l'action humaine explicite peut creer ou modifier un mapping.

## Probleme utilisateur

Le mapping manuel reste indispensable mais repetitif. Une fiduciaire pilote peut perdre du temps sur des comptes evidents, tout en devant rester prudente sur les comptes ambigus ou sensibles.

Le risque produit est double :

- aller trop lentement si toute ligne reste strictement manuelle ;
- aller trop vite si une IA applique ou influence un mapping sans preuve, sans controle humain ou sans tracabilite.

Cette spec borne une assistance prudente : proposer, expliquer, citer, puis attendre une decision humaine.

## Valeur fiduciaire attendue

- reduire le temps de premier passage sur les lignes de balance simples ;
- attirer l'attention sur les lignes ambigues via `riskLevel` et preuves ;
- garder le flux de closing utilisable sans IA ;
- enrichir progressivement une boucle de feedback supervisee pour mesurer accept, reject et modify ;
- preparer un premier gain IA mesurable sans deplacer l'autorite metier hors du backend et de l'utilisateur.

## Scope

Cette spec couvre le cadrage de :

- suggestion de mapping pour les lignes de la derniere balance importee ;
- alignement contractuel avec les noms canoniques du repo : `accountCode`, `accountLabel`, `targetCode` ;
- output strictement structure selon un schema versionne ;
- evidence list obligatoire pour chaque suggestion ;
- `requiresHumanReview = true` obligatoire ;
- feature flag backend obligatoire, desactive par defaut avant gate ;
- graceful degradation si IA desactivee, indisponible, trop lente ou invalide ;
- tenant-scoping strict sur toutes les entrees, sorties, logs, traces, metrics et evals ;
- acceptation, correction ou rejet par decision humaine explicite ;
- strategie d'audit, logs, metrics et evals proportionnee ;
- sous-livrables reviewables pour eviter un big-bang IA.

## Hors-scope explicite

- implementation runtime dans cette demande ;
- appel a un modele IA dans cette demande ;
- appel modele direct depuis le frontend ;
- microservice IA obligatoire ;
- GraphQL ;
- RAG ou vector store, sauf justification explicite future, ADR et gate dedie ;
- agent autonome ;
- application automatique d'un mapping ;
- bulk auto-apply ;
- suggestion sans preuve ;
- texte libre interprete comme contrat ;
- ecriture directe en base par l'IA ;
- usage de donnees cross-tenant ;
- envoi de secrets, tokens, credentials, DSN, cookies, storage keys ou valeurs `.env` vers un prompt ou un log ;
- changement de contrats OpenAPI, backend, frontend, DB, migration, dependances, CI, secrets ou Git dans cette spec de creation.

## Surfaces probables par sous-livrable

| Sous-livrable | Surface | Intention |
| --- | --- | --- |
| `030a` | DOCS_GIT + CONTRACTS | Durcir la spec, le schema IA et le contrat REST cible sans runtime. |
| `030b` | BACKEND + CONTRACTS | Ajouter le read-model backend et un adapter stub sans modele reel, derriere feature flag. |
| `030c` | IA GOVERNANCE + DOCS_GIT | Ajouter golden set, evals, prompt/schema/model governance et runbook minimal. |
| `030d1` | DOCS_ONLY + IA_GOVERNANCE + SECURITY_PRIVACY + PROVIDER_READINESS + DEPENDENCY_REVIEW | Formaliser le provider-readiness record et la dependency/security review sans runtime, provider reel, modele, SDK, secret ni dependance. |
| `030d2` | BACKEND | Durcir la minimisation du payload entre `mapping.application` et `ai::access`, sans provider reel, modele, SDK, dependance, reseau, DB, migration, frontend ni changement de contrat public. |
| `030d` | BACKEND + IA GOVERNANCE | Activer un provider modele reel seulement apres validation de `030d1` et gates, avec schema validation stricte et fallback. |
| `030e0` | FRONTEND | Afficher en lecture seule les suggestions preparees pour revue humaine, sans mutation de suggestion ni preselection du mapping manuel. |
| `030f` | BACKEND + DB/MIGRATION + CONTRACTS_API + FRONTEND_COMPAT_MINIMAL | Enregistrer une decision humaine durable et idempotente `ACCEPT`, `CORRECT` ou `REJECT` sur une suggestion courante, sans provider IA reel ni auto-apply. |
| `030e` | FRONTEND | Afficher la suggestion et collecter accept/correct/reject seulement si le backend contractuel est pret. |

`030d runtime` reste bloque tant que `030d1` n'est pas valide et signe, que `030d2` n'a pas prouve la minimisation backend et que les autres gates ne sont pas verts. `030d1` ne peut pas etre interprete comme une approbation provider : il prepare seulement les conditions de passage.

Les sous-livrables `030d` et `030e` ne doivent pas etre fusionnes dans une meme PR : activation modele et experience utilisateur sont deux risques distincts.

`030e0` est un sous-livrable intermediaire read-only : il peut etre livre quand le read-model backend `GET /api/closing-folders/{closingFolderId}/mappings/suggestions` est disponible, sans attendre la future experience de decision humaine.

## Decoupage recommande

### 030a - docs/contracts/spec hardening only

Objectif : fermer les divergences contractuelles avant runtime.

Livrables attendus :

- durcir `contracts/ai/mapping-suggestion.schema.json` ;
- aligner le schema IA sur les noms canoniques `accountCode`, `accountLabel`, `suggestedTargetCode` ;
- documenter que le futur endpoint vit dans le contrat REST dedie `contracts/openapi/mapping-suggestions-api.yaml` ;
- garder `contracts/openapi/manual-mapping-api.yaml` comme autorite des mutations manuelles de mapping ;
- conserver le contrat legacy `contracts/openapi/closing-api.yaml` comme trace uniquement, sans le prendre comme source canonique ;
- definir les decisions humaines unitaires `ACCEPT`, `CORRECT` et `REJECT` au niveau contractuel, sans bulk et sans auto-apply ;
- ne pas creer de backend runtime.

### 030b - backend read model et adapter stub sans modele reel

Objectif : prouver le chemin backend, la feature flag, les erreurs et le fallback sans modele.

Livrables attendus :

- endpoint REST backend tenant-scoped, sous `/api/closing-folders/{closingFolderId}/...` ;
- lecture de la derniere balance importee et de la taxonomie via les modules/projections autorises ;
- adapter IA applicatif stable dans ou via le module `ai`, mais implementation stub ;
- feature flag desactive par defaut ;
- etats `DISABLED`, `NO_IMPORT`, `UNAVAILABLE` ou `READY` explicites ;
- zero ecriture automatique de `manual_mapping` ;
- zero appel modele reel ;
- tests auth, RBAC, tenant, feature flag, no-import, archived, schema response et frontieres Modulith.

### 030c - evals, golden set et gouvernance

Objectif : rendre l'activation IA mesurable avant tout provider reel.

Livrables attendus :

- golden set synthetique ou anonymise ;
- cas simples, ambigus, historiques connus et rejets attendus ;
- controles de schema validity, evidence presence, confidence calibration, risk level et no-cross-tenant ;
- conventions de `modelVersion`, `promptVersion`, `schemaVersion` ;
- documentation du seuil minimum pour passer a un modele reel ;
- aucun secret ni donnee client brute dans les fixtures.

### 030d1 - provider-readiness record et dependency/security review sans runtime

Objectif : formaliser les conditions minimales avant toute future activation provider IA.

Livrables attendus :

- policy `policies/ai-provider-readiness.md` decrivant le statut non-runtime, la decision provider non approuvee et les gates de passage ;
- record `policies/ai-provider-readiness-record-030d1.md` avec champs vendor `NON_DETERMINE` tant que les preuves sont absentes ;
- review `policies/dependency-security-review-030d1.md` comparant RestClient/client HTTP controle, SDK provider et librairie JSON Schema runtime ;
- provider candidat et modele candidat traites comme `NON_DETERMINE` ou `CANDIDAT`, jamais comme approuves ;
- exigences obligatoires sur region de traitement, retention provider, training/non-training, logging provider, sous-traitants, DPA/SCC, deletion et incident process ;
- payload whitelist explicite avec donnees autorisables seulement si minimisees ;
- liste de donnees interdites couvrant secrets, tokens, credentials, cookies, DSN, `.env`, storage keys, signed URLs, raw CSV, documents, workpapers, audit brut, cross-tenant, identifiants non necessaires, prompts, outputs et payloads complets en logs ;
- strategie de dependance privilegiant `RestClient` ou client HTTP controle, avec SDK provider et librairie JSON Schema runtime interdits avant review ;
- exigences de prompt pinning, schema pinning, schema hash, model exact ID et interdiction d'alias auto-upgrade ;
- regle feature flag off : aucune construction prompt/request, zero reseau, zero cout et zero log provider ;
- validation de sortie modele fail-closed : JSON strict, schema complet, `additionalProperties=false`, evidence non vide, `requiresHumanReview=true`, confidence bornee, risk enum, target selectable/non deprecated et compte present dans le dernier import ;
- fallback documente pour `TIMEOUT`, `UNAVAILABLE`, `INVALID_MODEL_OUTPUT` et `INSUFFICIENT_EVIDENCE`, avec mapping manuel intact ;
- logs/metrics autorises et interdits, cout/latence, kill switch et rollback documentes dans le runbook ;
- rappel dans `evals/mapping/README.md` que `030c` vert et `030d1` valide sont obligatoires avant provider reel ;
- aucun backend runtime, provider reel, modele, appel modele, SDK, dependance, secret, contrat OpenAPI/IA, DB, migration, frontend, commit, push ou PR.

### 030d2 - backend payload minimization no-provider

Objectif : durcir la frontiere backend entre `mapping.application` et `ai::access` pour que le futur provider IA ne puisse pas recevoir de donnees financieres brutes.

Livrables attendus :

- minimizer pur dans `mapping.application`, execute avant `MappingSuggestionGenerationAccess.generate()`;
- DTO d'entree `ai::access` minimise, sans `closingFolderId`, `debit`, `credit`, libelle brut, tenant, client, actor, roles, provider metadata, prompt, secret ou payload reseau;
- `AiMappingSuggestionAccount` borne a `accountCode`, `sanitizedAccountLabel` et `balanceSignal`;
- `balanceSignal` derive non reversible parmi `DEBIT_ONLY`, `CREDIT_ONLY`, `DEBIT_DOMINANT`, `CREDIT_DOMINANT`, `BALANCED_NON_ZERO` et `ZERO`, sans montant brut, magnitude ou ratio reversible;
- sanitizer minimal : trim, collapse whitespace, suppression caracteres de controle, emails, URLs, IBAN-like, UUID, telephones, longues references numeriques et identifiants client evidents, longueur maximale bornee et fallback explicite si le libelle devient vide ou quasi vide;
- conservation des signaux comptables utiles comme `bank`, `cash`, `receivable`, `payable`, `supplier`, `revenue`, `expense`;
- targets envoyees au port IA filtrees `selectable=true && deprecated=false` et limitees a des metadonnees publiques utiles;
- stub deterministe local utilisant `sanitizedAccountLabel` pour ses signaux et snippets d'evidence;
- `AiMappingSuggestion` interne non autoritaire sur `accountLabel`; le read-model API reconstruit toujours `accountLabel` depuis la ligne tenant-scoped originale;
- GET `/api/closing-folders/{closingFolderId}/mappings/suggestions` inchange cote contrat public, sans audit_event et sans ecriture `manual_mapping`;
- tests unitaires minimizer, balance signal, service/port, API no-scope et Modulith;
- aucun provider reel, modele, SDK, nouvelle dependance, appel reseau, prompt runtime actif, secret, `.env`, frontend, POST `/decision`, DB, migration, GraphQL, RAG/vector store, microservice, contrat OpenAPI public ou `contracts/ai` sans decision CPO explicite.

### 030d - activation provider modele reel, gated apres 030d1

Objectif : brancher un modele uniquement quand les gates sont passes.

Livrables attendus :

- `030d1` valide avant implementation ;
- CTO Gate valide avant implementation ;
- revue IA/gouvernance avant tout appel modele ;
- provider configure derriere feature flag ;
- prompt pinning, model pinning, schema pinning ;
- validation JSON Schema stricte ;
- rejet automatique des sorties sans preuve, hors schema ou `requiresHumanReview != true` ;
- fallback sans bloquer le mapping manuel ;
- logs/traces/metrics sans donnees sensibles ;
- tests d'indisponibilite, timeout, sortie invalide, evidence absente et cout/latence.

### 030e0 - frontend read-only mapping suggestions

Objectif : exposer les suggestions de mapping IA preparees pour revue humaine sans deplacer l'autorite metier hors du mapping manuel.

Livrables attendus :

- client frontend dedie pour `GET /api/closing-folders/{closingFolderId}/mappings/suggestions` ;
- header `X-Tenant-Id`, `Accept: application/json` et encodage du `closingFolderId` ;
- validation stricte du read-model, des suggestions et des preuves ;
- panneau read-only autonome dans ou pres du bloc de mapping manuel sur `/closing-folders/:closingFolderId` ;
- affichage des etats `DISABLED`, `NO_IMPORT`, `READY`, `PARTIAL`, `ARCHIVED_READ_ONLY`, `UNAVAILABLE`, `TIMEOUT`, `INVALID_MODEL_OUTPUT` et `INSUFFICIENT_EVIDENCE` ;
- affichage visible de `accountCode`, `accountLabel`, `suggestedTargetCode`, `confidence`, `riskLevel`, rationale courte, `evidence[]` et `requiresHumanReview` ;
- evidence visible directement, jamais hover-only ;
- wording obligatoire : `AI mapping suggestion`, `Prepared for human review`, `Human review required`, `Read-only suggestion`, `Manual mapping remains the authority` ;
- aucune mutation de suggestion, aucun controle decisionnel, aucun autofill, aucune preselection du mapping manuel et aucun stockage navigateur.

### 030e - frontend suggestion review UI

Objectif : exposer la suggestion sans deplacer l'autorite metier dans le frontend.

Livrables attendus :

- AI Suggestion Card conforme `docs/ui/ui-foundations-v1.md` ;
- affichage de `suggestedTargetCode`, confidence, risk level, rationale courte et preuves ;
- actions unitaires accepter, corriger, rejeter ;
- accept/correct passent par le backend et n'ecrivent jamais directement un mapping local non confirme ;
- aucun appel modele direct ;
- UI masquee ou etat degrade clair si feature flag off ou IA indisponible ;
- tests frontend de chargement, erreurs, accessibilite, no bulk apply et decisions humaines.

## Contrat de suggestion attendu

### Noms canoniques

Les contrats canoniques de mapping utilisent :

- `accountCode` pour identifier une ligne de balance ;
- `accountLabel` pour le libelle de compte ;
- `targetCode` pour le code de mapping applique par l'utilisateur.

Avant `030a`, le schema IA `contracts/ai/mapping-suggestion.schema.json` utilisait `accountId` et `targetRubricId`. `030a` remplace ces noms par les noms canoniques pour eviter une divergence avec `manual-mapping-api.yaml`.

### Forme cible minimale

La suggestion doit etre un objet strict, sans proprietes libres non documentees.

Exemple indicatif de forme cible :

```json
{
  "closingFolderId": "00000000-0000-0000-0000-000000000000",
  "latestImportVersion": 3,
  "taxonomyVersion": 2,
  "state": "READY",
  "suggestions": [
    {
      "accountCode": "1000",
      "accountLabel": "Bank CHF",
      "suggestedTargetCode": "BS.ASSET.CASH_AND_EQUIVALENTS",
      "confidence": 0.82,
      "riskLevel": "MEDIUM",
      "rationale": "Libelle bancaire coherent avec une cible de tresorerie.",
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
      "requiresHumanReview": true,
      "modelVersion": "not_applicable_for_stub",
      "promptVersion": "not_applicable_for_stub",
      "schemaVersion": "mapping-suggestion-v1"
    }
  ],
  "errors": []
}
```

### Regles contractuelles

- `suggestions[]` ne contient que des comptes presents dans la derniere balance importee.
- `suggestedTargetCode` doit pointer vers un code selectable du referentiel actif `manual-mapping-targets-v2.yaml`, ou vers un code legacy encore explicitement accepte par `manual-mapping-api.yaml`.
- `confidence` est un nombre entre `0` et `1`.
- `riskLevel` vaut `LOW`, `MEDIUM` ou `HIGH`.
- `rationale` reste courte et ne remplace pas les preuves.
- `evidence[]` est obligatoire, non vide, bornee et cite des references tenant-scoped.
- `requiresHumanReview` doit toujours etre `true`.
- `modelVersion`, `promptVersion` et `schemaVersion` sont obligatoires des qu'un runtime modele reel existe.
- Une sortie hors schema est rejetee et ne doit pas etre transformee en suggestion partielle silencieuse.
- Une suggestion sans preuve est invalide, meme avec confidence elevee.

## Decisions humaines attendues

### Accept

L'utilisateur accepte une suggestion unitaire. `ACCEPT` est valide uniquement si le `targetCode` envoye correspond au `suggestedTargetCode` serveur courant pour le meme tenant, `closingFolderId`, `accountCode` et `latestImportVersion`.

Si `targetCode` differe du `suggestedTargetCode` courant, la decision doit etre `CORRECT` ou etre rejetee.

Quand `ACCEPT` est valide, le backend applique alors une mutation humaine de mapping vers le `targetCode` confirme. Cette mutation doit reutiliser ou etendre la discipline existante de `MANUAL_MAPPING.CREATED` / `MANUAL_MAPPING.UPDATED`.

### Correct

L'utilisateur choisit explicitement une cible humaine differente du `suggestedTargetCode` courant. `CORRECT` represente donc une correction humaine de la suggestion, pas une acceptation avec une cible modifiee silencieusement.

Le backend applique la cible corrigee comme mapping humain explicite. L'audit ou la metadata doivent permettre de distinguer une correction issue d'une suggestion IA si le contrat l'introduit.

### Reject

L'utilisateur rejette une suggestion sans creer de mapping. `REJECT` ne cree ni ne modifie jamais un mapping manuel. Le rejet doit au minimum alimenter metrics/evals tenant-scoped et, si une persistance de feedback est introduite, passer par une table tenant-scopee et un audit ou journal de decision dedie.

### Regles communes

- aucune decision ne peut etre prise en bulk dans la premiere version ;
- `POST /api/closing-folders/{closingFolderId}/mappings/suggestions/{accountCode}/decision` exige un header `Idempotency-Key` ;
- l'`Idempotency-Key` est evaluee au minimum dans le scope tenant + `closingFolderId` + endpoint + `accountCode` + payload canonique ;
- la meme cle avec le meme payload canonique doit rejouer le meme resultat ou etre traitee comme no-op sans dupliquer mapping, audit ou feedback ;
- la meme cle avec un payload canonique different doit etre rejetee en `409` ;
- cette cle d'idempotence concerne uniquement `POST /api/closing-folders/{closingFolderId}/mappings/suggestions/{accountCode}/decision` et jamais `GET /api/closing-folders/{closingFolderId}/mappings/suggestions` ;
- aucune decision n'est acceptee si la suggestion est absente ;
- aucune decision n'est acceptee si la suggestion est stale, si la suggestion courante a change depuis la revue, ou si `latestImportVersion` ne correspond plus ;
- aucune decision n'est acceptee si le feature flag est desactive ;
- aucune decision n'est acceptee si le read-model courant est `DISABLED`, `NO_IMPORT`, `UNAVAILABLE`, `TIMEOUT`, `INVALID_MODEL_OUTPUT` ou `INSUFFICIENT_EVIDENCE` ;
- aucune decision n'est acceptee si `evidence[]` est absente ou invalide ;
- aucune decision n'est acceptee si le compte n'est plus present dans la derniere balance importee ;
- les writes restent bloques sur closing `ARCHIVED`, comme le mapping manuel ;
- aucune decision `ACCEPT` ou `CORRECT` n'est acceptee si `targetCode` n'est pas selectable ;
- aucune decision n'est acceptee si le tenant, le RBAC ou l'autorite backend refuse l'action ;
- le mapping manuel reste entierement utilisable sans suggestion IA.

## Donnees d'entree autorisees

Le backend peut utiliser uniquement des donnees tenant-scoped et necessaires :

- tenant courant resolu par l'application ;
- actor id et roles pour auth/RBAC, sans les exposer au modele si non necessaire ;
- `closingFolderId` valide dans le tenant courant ;
- derniere balance importee : `latestImportVersion`, `accountCode`, `accountLabel`, debit, credit ;
- sign/normal side derive si utile au mapping ;
- cible de mapping publiee : `code`, `label`, `statement`, `summaryBucketCode`, `sectionCode`, `normalSide`, `granularity`, `deprecated`, `selectable` ;
- mapping manuel courant du meme closing folder, si necessaire pour eviter overwrite ou doublons ;
- historique de mapping seulement s'il existe comme source tenant-scoped explicite, autorisee et non obsolete ;
- garde-fous prompt versionnes, schema versionne et configuration de feature flag.

## Donnees interdites

Sont interdites dans les prompts, logs IA, traces detaillees et fixtures d'evals :

- secrets, tokens, credentials, cookies, DSN, valeurs `.env` ;
- `storage_object_key`, signed URL, cles object storage ;
- donnees d'un autre tenant ;
- donnees d'un dossier hors tenant ou hors droits de l'acteur ;
- CSV brut complet si les lignes normalisees suffisent ;
- documents binaires ou pieces justificatives completes ;
- donnees personnelles utilisateur non necessaires ;
- audit trail brut contenant des informations sensibles ;
- donnees non validees, obsoletes ou stale utilisees comme preuve sans marquage explicite ;
- texte libre non schema comme source contractuelle de decision.

## Strategie de feature flag

- Un flag backend dedie doit exister avant tout runtime, par exemple `ritomer.ai.mapping-suggestions.enabled`.
- Le flag est desactive par defaut dans tous les environnements jusqu'au CTO Gate.
- Le flag doit pouvoir etre coupe sans migration, redeploiement lourd ou perte du mapping manuel.
- Une strategie de rollout tenant-scoped ou environnement-scoped doit etre documentee avant activation pilote.
- Le frontend futur ne doit afficher la suggestion que si le backend expose un etat actif ou disponible.
- En cas de flag off, aucune requete modele ne doit etre emise.

## Strategie de graceful degradation

Le closing et le mapping manuel continuent a fonctionner si l'IA tombe.

Comportements attendus :

- feature flag off : etat explicite `DISABLED`, aucune suggestion, aucun appel modele ;
- pas d'import : etat `NO_IMPORT`, inviter a importer une balance via le flux existant ;
- modele indisponible : etat `UNAVAILABLE`, suggestions vides, mapping manuel intact ;
- timeout modele : etat `TIMEOUT`, aucune suggestion partielle non validee ;
- sortie hors schema : etat `INVALID_MODEL_OUTPUT`, aucune suggestion affichee comme fiable ;
- evidence absente : etat `INSUFFICIENT_EVIDENCE`, suggestion rejetee ;
- closing archive : lecture manuelle existante possible, mais aucune nouvelle generation IA et aucun write de mapping ;
- erreur reseau frontend : UI degradee, sans masquer le mapping manuel.

Les erreurs d'authentification, RBAC, tenant ou closing absent restent des erreurs HTTP standard (`401`, `403`, `404`), coherentes avec les contrats existants.

## Strategie logs, traces, metrics et audit

### Logs et traces

- Logs structures, sans secret ni payload prompt complet contenant donnees sensibles.
- Correlation par request id / trace id.
- Identifiants metier minimises ou hashes si une trace technique suffit.
- Statut de generation, `schemaVersion`, `promptVersion`, `modelVersion`, provider logique, latence et resultat de validation schema.
- Pas de snippet sensible en clair dans les logs applicatifs par defaut.

### Metrics

Metrics minimales :

- demandes de suggestion par tenant/environnement, agregees ;
- etats `READY`, `DISABLED`, `UNAVAILABLE`, `TIMEOUT`, `INVALID_MODEL_OUTPUT`, `INSUFFICIENT_EVIDENCE` ;
- nombre de suggestions retournees ;
- taux accept / reject / correct ;
- latence p50/p95 ;
- cout estime si provider reel ;
- taux de sorties hors schema ;
- taux de suggestions sans evidence rejetees.

### Audit

- Une simple lecture ou generation de suggestions n'ecrit pas automatiquement un `audit_event` metier si aucune decision n'est prise.
- Accept/correct qui creent ou modifient un mapping doivent emettre l'audit metier existant ou enrichi.
- Reject n'ecrit un audit metier que si la spec contractuelle future introduit une decision persistante ; sinon il alimente metrics/evals sans modifier `manual_mapping`.
- Aucun audit ne doit contenir secret, prompt brut sensible ou donnees cross-tenant.

## Strategie evals / golden set

Les evals doivent exister avant tout provider reel.

Jeux de donnees attendus :

- cas simples avec libelle evident ;
- cas ambigus ou plusieurs cibles semblent plausibles ;
- cas ou aucune suggestion ne doit etre produite faute de preuve ;
- cas avec historique tenant-scoped valide ;
- cas avec historique non utilisable ou hors tenant ;
- cas avec cible non selectable ;
- cas legacy V1 encore accepte ;
- cas multi-tenant prouvant l'absence de fuite.

Metrics attendues :

- schema validity ;
- exact match sur `suggestedTargetCode` ;
- presence et qualite des preuves ;
- `requiresHumanReview = true` strict ;
- calibration confidence / risk ;
- taux accept / reject / correct apres pilote ;
- latence et cout ;
- taux de fallback.

Les fixtures doivent etre synthetiques ou anonymisees. Aucune fixture ne doit contenir secret, donnees client brutes ou donnees hors tenant.

## Erreurs et etats attendus

Etats read-model attendus :

- `DISABLED`
- `NO_IMPORT`
- `READY`
- `PARTIAL`
- `UNAVAILABLE`
- `TIMEOUT`
- `INVALID_MODEL_OUTPUT`
- `INSUFFICIENT_EVIDENCE`
- `ARCHIVED_READ_ONLY`

Erreurs HTTP attendues :

- `400` pour payload invalide ou parametre malforme ;
- `401` pour authentification requise ;
- `403` pour tenant inaccessible ou role insuffisant ;
- `403` aussi si l'autorite backend refuse l'action malgre un payload syntaxiquement valide ;
- `404` pour closing folder absent ou hors tenant ;
- `409` pour tentative de write sur closing archive, import absent, suggestion absente, suggestion stale, suggestion courante changee, feature flag desactive, read-model non decisionable, evidence absente ou invalide, `latestImportVersion` obsolete, compte absent du dernier import ou reutilisation d'`Idempotency-Key` avec payload canonique different ;
- `503` seulement si le contrat choisit une erreur transport pour indisponibilite IA, mais le read-model degrade en `200 + state` est prefere pour preserver le flux manuel.

## Securite, tenant isolation et RBAC

- Toutes les lectures et decisions sont tenant-scoped.
- Aucun repository non scoped par tenant.
- Aucun contexte IA ne contient de donnees hors tenant courant.
- Les roles de lecture doivent rester au moins aussi stricts que le mapping manuel : `ACCOUNTANT`, `REVIEWER`, `MANAGER`, `ADMIN`.
- Les roles de write accept/correct doivent rester au moins aussi stricts que le mapping manuel : `ACCOUNTANT`, `MANAGER`, `ADMIN`.
- Le frontend ne decide jamais seul de l'eligibilite ; il affiche les etats backend.
- Les suggestions doivent etre recalculees ou invalidees si la derniere balance importee change.
- Un `suggestedTargetCode` non selectable doit etre rejete avant exposition.
- Toute activation provider externe doit cadrer privacy, retention, region, logging provider et masquage des donnees sensibles.

## Impacts contracts

Impacts `030a` :

- durcissement de `contracts/ai/mapping-suggestion.schema.json` ;
- ajout du contrat REST cible dedie `contracts/openapi/mapping-suggestions-api.yaml` sous les endpoints canoniques `/api/closing-folders/{closingFolderId}/...` ;
- maintien de `contracts/openapi/manual-mapping-api.yaml` comme autorite des mappings manuels appliques en `targetCode` ;
- alignement des decisions humaines `ACCEPT`, `CORRECT` et `REJECT` avec les mutations `targetCode` existantes, sans bulk et sans auto-apply ;
- clarification que `ACCEPT` confirme seulement le `suggestedTargetCode` serveur courant, que `CORRECT` porte une cible humaine differente et que `REJECT` ne cree aucun mapping ;
- preconditions contractuelles du futur `POST /decision` : suggestion presente, non stale, inchangee, evidence valide, feature flag actif, read-model decisionable, import courant, compte present, closing non `ARCHIVED`, cible selectable et autorite tenant/RBAC/backend valide ;
- exigence d'un header `Idempotency-Key` sur le futur `POST /decision`, evalue au minimum dans le scope tenant + `closingFolderId` + endpoint + `accountCode` + payload canonique, afin d'eviter les doublons de mapping, audit ou feedback en cas de retry ou double-submit ;
- documentation des etats de degradation ;
- maintien de `contracts/openapi/closing-api.yaml` comme legacy seulement, sans en faire la source du nouveau naming.

`030a` reste contracts/docs only : aucun backend runtime, frontend, provider IA, modele, DB, migration, dependance ou secret n'est livre.

## Impacts backend

Impacts futurs probables :

- module `ai` comme port applicatif ou orchestration IA ;
- module `mapping` comme proprietaire du mapping manuel et de la taxonomie ;
- module `imports` comme source autorisee de la derniere balance importee ;
- adapter stub puis provider modele derriere feature flag ;
- validation JSON Schema stricte ;
- tests de frontieres Modulith ;
- audit enrichi uniquement sur decisions humaines qui mutent ou persistent un feedback.

Aucun backend n'est modifie par cette spec docs-only.

## Impacts frontend eventuels

Impacts futurs uniquement apres backend pret :

- AI Suggestion Card dans le bloc mapping ;
- evidence list accessible et non hover-only ;
- actions unitaires accepter, corriger, rejeter ;
- no bulk auto-apply ;
- etats empty/loading/error/degraded ;
- accessibilite clavier et labels ;
- wording prudent : suggestion, prepared for human review, human review required.

Aucun frontend n'est modifie par cette spec docs-only.

## Impacts DB/migrations eventuels

Pas de migration requise pour la spec docs-only.

Migrations futures possibles uniquement si le sous-livrable choisi persiste :

- decisions de rejet ;
- feedback eval supervise ;
- historique de suggestion ;
- trace durable d'une suggestion affichee.

Toute table future doit porter `tenant_id`, respecter le scoping applicatif et evaluer une candidature RLS si elle devient critique.

## Impacts docs/runbooks

Impacts `030d1` :

- mise a jour de `policies/ai-provider-readiness.md` comme policy de passage provider sans runtime ;
- ajout de `policies/ai-provider-readiness-record-030d1.md` comme record non signe et non approuvant ;
- ajout de `policies/dependency-security-review-030d1.md` comme review docs-only des strategies de dependance ;
- mise a jour de `runbooks/ai-incident-response.md` pour kill switch, outage, timeout, invalid output, no evidence, data exposure, sensitive logs, cost spike, rollback et escalation owner ;
- mise a jour de `evals/mapping/README.md` pour rappeler que `030c` vert et `030d1` valide sont obligatoires avant provider reel ;
- aucun prompt runtime actif, aucun fichier prompt dedie et aucun appel modele ;
- `docs/present/ai-cadrage-v1.md` seulement quand la verite du present change reellement, c'est-a-dire a l'activation d'une capacite IA runtime ;
- `docs/product/v1-plan.md` lors du classement done ou changement durable de sequencing.

`030d1` ne modifie pas `docs/present/ai-cadrage-v1.md` ni `docs/product/v1-plan.md` car aucune capacite IA runtime n'est activee et le sequencing V1 durable ne change pas.

## Checks attendus par sous-livrable

### 030a

- `git status --short --branch`
- `git diff --name-status`
- `git diff --stat`
- `git diff --check`
- check structurel OpenAPI/YAML du contrat `contracts/openapi/mapping-suggestions-api.yaml`
- `rg "ACCEPT|CORRECT|REJECT|Idempotency-Key|stale|latestImportVersion|suggestedTargetCode"`
- `rg "accountId|targetRubricId"` pour classifier les occurrences restantes comme legacy explicite uniquement
- controle anti-scope backend/frontend/DB/migration/dependency/secret
- validation JSON Schema du contrat IA si `contracts/ai/mapping-suggestion.schema.json` est modifie
- validation d'exemples valides et invalides contre le JSON Schema durci si `contracts/ai/mapping-suggestion.schema.json` est modifie et que l'outillage est disponible

### 030b

- backend `.\gradlew.bat test`
- verification Modulith `.\gradlew.bat test --tests "*ApplicationModule*"`
- tests API auth/RBAC/tenant/feature flag/fallback
- tests sortie schema et no auto-write
- `dbIntegrationTest` uniquement si migration ou persistance ajoutee

### 030c

- validation fixtures sans secret ;
- eval runner ou checks documentes ;
- schema validity ;
- controles no cross-tenant ;
- documentation des seuils et versions.

### 030d1

- `git status --short --branch`
- `git diff --name-status`
- `git diff --stat`
- `git diff --check`
- `.\evals\mapping\validate-golden-set.ps1`
- recherche anti-scope sur les fichiers modifies : backend, frontend, contracts/openapi, contracts/ai, DB/migration, build/dependency, `.env`, secret, token, credential, DSN, provider key, Spring AI, SDK, GraphQL, RAG, vector store
- recherche confirmant qu'aucune valeur secrete n'est ajoutee

### 030d2

- backend `.\gradlew.bat test --tests "ch.qamwaq.ritomer.mapping.application.MappingSuggestionsServiceTest" --tests "ch.qamwaq.ritomer.MappingSuggestionsApiTest" --tests "ch.qamwaq.ritomer.ApplicationModuleStructureTest"`
- backend `.\gradlew.bat test`
- `.\evals\mapping\validate-golden-set.ps1`
- `git diff --check`
- `git status --short --branch`
- recherche anti-scope par `rg` sur les fichiers modifies et la surface backend : aucun `RestClient`, `WebClient`, `HttpClient`, Spring AI, provider runtime, SDK, GraphQL, RAG, vector store, prompt runtime, frontend, `PostMapping`, nouveau `/decision`, migration, `.sql`, changement `build.gradle` ou dependance, secret, token, credential, DSN ou `.env`.

### 030d

- tous les gates de `030d1` ;
- tous les checks de `030b` et `030c` ;
- tests timeout/provider unavailable ;
- tests sortie hors schema ;
- tests evidence absente ;
- tests feature flag off ;
- verification logs/metrics sans donnees sensibles ;
- revue IA/gouvernance avant merge.

### 030e0

- frontend `pnpm test:ci`
- frontend `pnpm lint`
- frontend `pnpm build`
- `git diff --check`
- `git status --short --branch`
- tests client : endpoint exact, `X-Tenant-Id`, `Accept`, encodage du `closingFolderId`, validation stricte, rejet `requiresHumanReview=false`, rejet `evidence[]` vide, rejet confidence hors borne, rejet state inconnu et rejet `closingFolderId` incoherent ;
- tests UI : loading, erreur HTTP/reseau, tous les etats du read-model, suggestions presentes, `READY` sans suggestion, evidence visible et absence de controle decisionnel ;
- tests route : appel GET attendu, headers attendus et absence d'appel mutationnel lie aux suggestions ;
- recherches anti-scope proportionnees sur les fichiers impactes.

### 030e

- frontend `pnpm test:ci`
- frontend `pnpm lint`
- frontend `pnpm build`
- tests no direct model call ;
- tests no bulk apply ;
- tests accept/correct/reject via backend ;
- tests degraded states et accessibilite.

## Gates necessaires avant implementation

- CTO Gate obligatoire avant toute implementation runtime.
- `030d1` provider-readiness record et dependency/security review valides obligatoires avant `030d runtime`.
- Revue IA/gouvernance recommandee avant tout appel modele reel.
- Revue humaine technique recommandee avant merge de tout sous-livrable risque C.
- Contract Gate obligatoire avant frontend : schema IA et contrat REST doivent etre stables.
- Security/privacy review obligatoire avant provider externe ou envoi de donnees sensibles a un service IA.
- CO/Fiduciaire Review non obligatoire au stade spec si aucun wording CO/statutaire n'est modifie ; a declencher si une UI ou un wording futur peut etre compris comme promesse de mapping certifie, CO-ready ou validation statutaire.

## Fresh Evidence Pack attendu apres chaque sous-livrable

Chaque sous-livrable doit fournir un Fresh Evidence Pack court, factuel et verifiable :

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
13. Revue humaine recommandee ou non, notamment si migration DB, auth, autorisation, separation tenant, audit, donnees sensibles, suppression, regle metier critique, dependance, architecture, production ou irreversibilite metier sont touches.

Le pack ne doit jamais inclure secret, token, cle, cookie, DSN, credential ou valeur `.env`.

## Acceptance 030e0 frontend read-only mapping suggestions

- Un client frontend dedie consomme uniquement `GET /api/closing-folders/{closingFolderId}/mappings/suggestions`.
- Le client envoie `X-Tenant-Id`, demande `application/json`, encode le `closingFolderId` et ne transmet aucun body.
- Le payload est valide strictement : state connu, `closingFolderId` coherent, `requiresHumanReview=true`, confidence entre `0` et `1`, `evidence[]` non vide et aucune propriete libre.
- La route `/closing-folders/:closingFolderId` affiche un panneau read-only dans ou pres du bloc de mapping manuel.
- Les etats `DISABLED`, `NO_IMPORT`, `READY`, `PARTIAL`, `ARCHIVED_READ_ONLY`, `UNAVAILABLE`, `TIMEOUT`, `INVALID_MODEL_OUTPUT` et `INSUFFICIENT_EVIDENCE` sont visibles et explicites.
- En succes, l'UI affiche `accountCode`, `accountLabel`, `suggestedTargetCode`, `confidence`, `riskLevel`, rationale courte, `evidence[]` et `requiresHumanReview`.
- Les preuves sont visibles directement dans le panneau, sans hover-only.
- Le wording `AI mapping suggestion`, `Prepared for human review`, `Human review required`, `Read-only suggestion` et `Manual mapping remains the authority` est present.
- Le mapping manuel reste l'autorite : aucune mutation de suggestion, aucun controle decisionnel, aucun autofill, aucune preselection et aucun stockage navigateur ne sont ajoutes.
- Aucun backend, contrat OpenAPI, contrat IA, DB, migration, dependance, secret, commit, push ou PR n'est livre par `030e0`.

### 030f - backend mapping suggestion human decision

Objectif : permettre a un utilisateur autorise de prendre une decision humaine durable et idempotente sur une suggestion de mapping IA courante.

Livrables attendus :

- `POST /api/closing-folders/{closingFolderId}/mappings/suggestions/{accountCode}/decision` avec `Idempotency-Key` obligatoire ;
- decisions unitaires `ACCEPT`, `CORRECT` et `REJECT`, sans bulk et sans auto-apply ;
- `suggestionFingerprint` calcule cote backend apres safety filtering et expose sur le GET si necessaire au replay decisionnel ;
- table dediee `mapping_suggestion_decision_request` tenant-scopee pour l'idempotence durable ;
- hash de payload canonique stable, sans hash du JSON brut recu ;
- recalcul backend de la suggestion courante avant toute mutation ;
- `ACCEPT` et `CORRECT` via la logique metier de mapping manuel existante ;
- `REJECT` sans creation ni modification de mapping manuel et sans `audit_event` obligatoire ;
- conflits metier terminaux stockes en `CONFLICT_*` une fois la ligne d'idempotence reservee ;
- aucun provider IA reel, modele, prompt runtime, SDK, nouvelle dependance, GraphQL, RAG/vector store, microservice, frontend decisionnel, bulk ou auto-apply.

## Acceptance 030d1 provider-readiness record and dependency review

- `policies/ai-provider-readiness.md` existe et indique explicitement que `030d1` est non-runtime.
- `policies/ai-provider-readiness-record-030d1.md` existe et garde le statut actuel `DRAFT` ou `PENDING_EVIDENCE`, jamais `SIGNED` sans signatures reelles.
- `policies/dependency-security-review-030d1.md` existe et ne recommande par defaut que RestClient/client HTTP controle sans ajout de dependance.
- La policy indique que le provider reel n'est pas approuve a ce stade.
- Tout provider ou modele futur est traite comme `NON_DETERMINE` ou `CANDIDAT`, jamais comme approuve sans gates.
- Le modele futur doit etre renseigne par identifiant exact, sans alias auto-upgrade.
- La region de traitement, la retention provider, le training/non-training des donnees, le logging provider, les sous-traitants, DPA/SCC, deletion et incident process sont marques comme obligatoires avant activation.
- La payload whitelist couvre les champs autorisables minimises et indique source, transformation/minimisation, envoi provider, loggabilite et justification.
- Les donnees interdites couvrent secrets, tokens, credentials, cookies, DSN, `.env`, storage keys, signed URLs, raw CSV, documents, workpapers, audit brut, cross-tenant, identifiants non necessaires, prompt brut, output brut et payload complet en logs.
- La strategie de dependance privilegie `RestClient` ou client HTTP controle ; SDK provider et librairie runtime JSON Schema restent interdits avant dependency/security review signee.
- Le prompt/schema/model pinning documente prompt file path futur, prompt version, `schemaVersion`, schema hash, model exact ID et interdiction d'alias auto-upgrade.
- Le comportement feature flag off exige zero construction prompt/request provider, zero reseau, zero cout et zero log provider.
- La validation de sortie modele est fail-closed, JSON strict uniquement, schema complet, `additionalProperties=false`, `requiresHumanReview=true`, evidence non vide, confidence bornee, `riskLevel` enum, target connu/selectable/non deprecated et compte present dans le dernier import.
- Le fallback documente `TIMEOUT`, `UNAVAILABLE`, `INVALID_MODEL_OUTPUT` et `INSUFFICIENT_EVIDENCE`, avec mapping manuel intact.
- Les logs/metrics autorises et interdits sont documentes sans payload, prompt, output, account labels, montants, evidence snippets, tenant/client identifiers non minimises ni secrets.
- Les gates `CPO approval`, `CTO Gate`, security/privacy review, dependency review signee, provider readiness record signe, IA governance review, golden set `030c` vert, payload whitelist signee, runbook pret et feature flag policy validee sont obligatoires avant `030d runtime`.
- `runbooks/ai-incident-response.md` couvre kill switch, provider outage, timeout, invalid schema/output, no evidence, data exposure, sensitive logs, cost spike, rollback model/prompt/schema et escalation owner.
- `evals/mapping/README.md` rappelle que `030c` vert et `030d1` valide sont obligatoires avant provider reel.
- Aucun backend runtime, frontend, contrat OpenAPI, contrat IA, DB, migration, dependance, provider IA, modele, appel modele, prompt runtime actif, secret, commit, push ou PR n'est livre par `030d1`.

## Acceptance 030d2 backend payload minimization no-provider

- Le minimizer vit dans `mapping.application` et s'execute avant `MappingSuggestionGenerationAccess.generate()`.
- Le DTO d'entree `ai::access` ne contient plus `closingFolderId`, `debit`, `credit`, libelle brut, tenant id, client id, actor id, roles, provider metadata, prompt, secret ou payload reseau.
- `AiMappingSuggestionAccount` expose uniquement `accountCode`, `sanitizedAccountLabel` et `balanceSignal`.
- `balanceSignal` est non reversible et ne contient ni montant brut, ni bucket de magnitude, ni ratio reversible.
- Le sanitizer couvre trim/collapse whitespace, caracteres de controle, email, URL, IBAN-like, UUID, telephone, longues references numeriques, longueur maximale, fallback empty/quasi-empty et preservation des termes comptables utiles.
- `AiMappingSuggestion` interne n'est plus autorite sur `accountLabel`; le read-model API retourne l'`accountLabel` original depuis la ligne tenant-scoped.
- Le stub deterministe utilise `sanitizedAccountLabel` pour ses signaux et evidence snippets.
- Les targets envoyees au port IA sont filtrees `selectable=true && deprecated=false`.
- Le GET public `/api/closing-folders/{closingFolderId}/mappings/suggestions` reste inchange, n'ecrit aucun `audit_event` et ne cree/modifie aucun `manual_mapping`.
- `POST /api/closing-folders/{closingFolderId}/mappings/suggestions/{accountCode}/decision` reste absent tant qu'un sous-livrable futur ne l'implemente pas explicitement.
- Aucun provider reel, reseau, SDK, nouvelle dependance, DB, migration, frontend, GraphQL, RAG/vector store, prompt runtime actif, secret, `.env`, contrat OpenAPI public ou `contracts/ai` n'est ajoute par `030d2`.

## Acceptance 030a contracts/docs

- `contracts/ai/mapping-suggestion.schema.json` utilise les noms canoniques `accountCode`, `accountLabel` et `suggestedTargetCode`.
- `requiresHumanReview` est strictement `true`.
- `evidence[]` est obligatoire, non vide et bornee.
- `contracts/openapi/mapping-suggestions-api.yaml` existe comme contrat REST cible dedie.
- `GET /api/closing-folders/{closingFolderId}/mappings/suggestions` expose `state`, `closingFolderId`, `latestImportVersion`, `taxonomyVersion`, `suggestions[]` et `errors[]`.
- Les decisions humaines futures `ACCEPT`, `CORRECT` et `REJECT` sont documentees comme unitaires, sans bulk et sans auto-apply.
- `ACCEPT` est valide uniquement quand `targetCode` correspond au `suggestedTargetCode` serveur courant pour le meme tenant, `closingFolderId`, `accountCode` et `latestImportVersion`; sinon la decision doit etre `CORRECT` ou rejetee.
- `CORRECT` represente explicitement une cible humaine differente de la suggestion courante.
- `REJECT` ne cree ni ne modifie aucun mapping manuel.
- `POST /api/closing-folders/{closingFolderId}/mappings/suggestions/{accountCode}/decision` rejette les decisions sans suggestion courante valide, stale, modifiee depuis la revue, sans evidence valide, avec feature flag desactive, read-model non decisionable, `latestImportVersion` obsolete, compte absent du dernier import, closing `ARCHIVED`, cible non selectable ou refus tenant/RBAC/backend authority.
- `POST /api/closing-folders/{closingFolderId}/mappings/suggestions/{accountCode}/decision` exige `Idempotency-Key`, l'evalue au minimum dans le scope tenant + `closingFolderId` + endpoint + `accountCode` + payload canonique, rejoue/no-op la meme cle avec le meme payload canonique sans dupliquer mapping/audit/feedback, rejette la meme cle avec payload canonique different, et cette idempotence ne concerne jamais le GET de suggestions.
- Aucun backend runtime, frontend, appel modele, provider IA, DB, migration, dependance, secret, commit, push ou PR n'est livre par `030a`.
- Les anciennes occurrences `accountId` / `targetRubricId` ne restent que dans le contrat legacy explicite `contracts/openapi/closing-api.yaml` ou dans l'historique documentaire classe comme legacy.

## Acceptance initiale de cette spec de creation

- La spec active `specs/active/030-ia-mapping-assiste-suggestion-review-v1.md` existe.
- Aucun code backend ou frontend n'est modifie.
- Aucun contrat OpenAPI n'etait modifie par la spec de creation initiale ; `030a` est le sous-livrable contracts/docs qui autorise le contrat REST cible dedie.
- Aucune DB, migration, dependance, CI, secret, runbook operationnel ou configuration Git n'est modifie.
- Aucun appel modele IA n'est effectue.
- Aucun `git add`, commit, push ou PR n'est effectue.
- Les checks docs-only demandes passent ou sont justifies.
