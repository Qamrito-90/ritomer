# Mapping evals 030c

## Objectif

030c rend mesurable une future activation IA de mapping avant tout provider reel.

Cette surface reste docs/evals only :

- golden set synthetique en JSON ;
- format verifiable localement ;
- check PowerShell sans nouvelle dependance ;
- aucune capacite IA runtime, aucun modele, aucun prompt runtime et aucun appel reseau.

## Artefacts candidats 042a2a2a

`042a2a2a` ajoute des artefacts executables candidats pour preparer le futur moteur offline. Ils restent `CANDIDATE`, `PENDING_EVIDENCE` et `NOT_AUTHORITATIVE`.

Fichiers :

- `evals/mapping/fixtures/042a2/taxonomy-snapshot-candidate-v1.json`
- `evals/mapping/fixtures/042a2/demo-input-unmapped-v1.json`
- `evals/mapping/validate-042a2-candidate.ps1`

Ces artefacts ne creent pas de golden set approuve, de contrat `mapping-suggestion-v2`, de prompt runtime, de provider, de backend/frontend runtime, de DB/migration, d'appel IA ou de capacite de production.

Canonicalisation candidate :

- UTF-8 sans BOM ;
- fins de ligne LF ;
- ordre des proprietes et des entrees stable dans les fichiers commites ;
- SHA-256 calcule depuis les octets canoniques des deux JSON ;
- commande de validation et de hash : `.\evals\mapping\validate-042a2-candidate.ps1`.

Hashes candidats actuels :

| Artefact | SHA-256 |
| --- | --- |
| `taxonomy-snapshot-candidate-v1.json` | `9E5E303EC10B6713C7A0A0AD33D031069407C6A862030BEF98D69F4786681BA7` |
| `demo-input-unmapped-v1.json` | `B3C616B729014E6A87BB2124C10970EDF954D9F98FBD1F5C08E42B7ACAAA6D3F` |

Le hash prouve seulement la reproductibilite technique de l'artefact candidat. Il ne vaut ni approbation metier, ni gel de taxonomie, ni signature de perimetre pilote.

Le snapshot candidat est derive de `contracts/reference/manual-mapping-targets-v2.yaml`, version 2. La projection demo est derivee du seed synthetique `036a-local-demo-synthetic`, version d'import balance `1`, sans montant brut, identifiant tenant/client/acteur, affectation courante, cible attendue ou mapping historique.

## Pack de cas candidats 042a2

`042a2` ajoute un pack executable de cas candidats separe du jeu `030c`.

Fichiers :

- `evals/mapping/fixtures/042a2/candidate-semantic-cases-v1.json`
- `evals/mapping/fixtures/042a2/candidate-policy-fault-cases-v1.json`
- `evals/mapping/validate-042a2-candidate-cases.ps1`

Ces artefacts restent `CANDIDATE`, `PENDING_DOUBLE_REVIEW`, `NOT_GOLDEN` et `NOT_AUTHORITATIVE`.

Ils ne creent pas de contrat `mapping-suggestion-v2`, de prompt runtime, de provider, de backend/frontend runtime, de DB/migration, d'OpenAPI, de secret, d'appel IA ou de capacite de production.

Separation des cas :

- `candidate-semantic-cases-v1.json` contient uniquement des cas metier `BUSINESS_SEMANTIC` attendus en `SUGGESTION` ou `ABSTENTION`.
- `candidate-policy-fault-cases-v1.json` contient les policy/preconditions attendues en `POLICY_BLOCK` ou `PRECONDITION_BLOCK`, et les sorties techniques invalides attendues en `INVALID_MODEL_OUTPUT`.
- Les policy/preconditions et les sorties invalides sont exclues du comptage d'abstention metier.
- Les sorties avec cible inconnue, depreciee, non selectionnable, section ou racine proposee sont `INVALID_MODEL_OUTPUT`, jamais `TAXONOMY_GAP`.

Hashes candidats actuels :

| Artefact | SHA-256 |
| --- | --- |
| `candidate-semantic-cases-v1.json` | `63AADB379DA47C3909D9391646923EA173978E16BA256EFF8BD903D1901D9F91` |
| `candidate-policy-fault-cases-v1.json` | `65B334A26F3054156421127BC20C1E8948C4E95BFC5A298A26D8B84D5B729D3C` |

Le validator `validate-042a2-candidate-cases.ps1` verifie aussi les hashes du snapshot candidat et de la projection demo candidate, afin de lier les cas au perimetre candidat deja materialise.

Gaps documentes sans cas artificiel :

- `TAXONOMY_GAP`
- `AMBIGUOUS_TARGET`
- `OUT_OF_SCOPE`
- `CONFLICTING_SIGNALS`

Ces gaps restent documentes tant qu'une revue humaine double et une adjudication explicite ne permettent pas de les annoter honnetement dans ce perimetre candidat.

## Pack de double revue aveugle 042a2

Le pack de double revue aveugle transforme les 17 cas candidats `042a2` en deux paquets independants pour revue humaine. Il reste `BLIND_REVIEW_INPUT`, `PENDING_INDEPENDENT_REVIEW`, `NOT_GOLDEN` et `NOT_AUTHORITATIVE`.

Fichiers :

- `evals/mapping/reviews/042a2/reviewer-a-blind-v1.json`
- `evals/mapping/reviews/042a2/reviewer-b-blind-v1.json`
- `evals/mapping/reviews/042a2/reviewer-response-schema-v1.json`
- `evals/mapping/build-042a2-blind-review-pack.ps1`
- `evals/mapping/validate-042a2-blind-review-pack.ps1`
- `evals/mapping/validate-042a2-human-review-responses.ps1`

Les deux paquets :

- couvrent exactement les 17 cas candidats ;
- utilisent les ids neutres `BR-001` a `BR-017` ;
- ont le meme ensemble de cas dans deux ordres deterministes differents ;
- exposent uniquement des inputs synthetiques minimises et le catalogue candidat des cibles selectionnables ;
- n'exposent pas les chemins ou hashes des fixtures candidates contenant les reponses ;
- n'exposent pas `sourceKind`, `sourceCaseId`, `caseInputHash` ou autre indice vers les cas sources ;
- n'exposent pas les champs de solution source, tags, categories, commentaires de correction, montant brut, identifiant tenant/client/acteur ou mapping historique.

Distribution aveugle :

- le reviewer A recoit uniquement `reviewer-a-blind-v1.json`, le schema de reponse et les instructions / guide d'annotation sans reponses ;
- le reviewer B recoit uniquement `reviewer-b-blind-v1.json`, le schema de reponse et les instructions / guide d'annotation sans reponses ;
- aucun reviewer ne recoit les fixtures candidates, les cas sources, le builder, les validators internes ou le paquet de l'autre reviewer pendant la revue independante ;
- les reponses humaines futures doivent etre validees avec `validate-042a2-human-review-responses.ps1` contre le paquet effectivement distribue.

Le schema de reponse est une union stricte `SUGGESTION`, `ABSTENTION`, `POLICY_BLOCK`, `PRECONDITION_BLOCK`, `INVALID_MODEL_OUTPUT`, avec `additionalProperties=false`, sans valeur `null`.
Il limite `targetCode` exactement aux 6 cibles candidates, rend `NONE` exclusif dans `criticalFlags` et contraint `expectedHumanAction` par `outcome`.

Hashes du pack aveugle actuel :

| Artefact | SHA-256 |
| --- | --- |
| `reviewer-a-blind-v1.json` | `19D654092FA6324D2E5EB80200FF1430E94A47CBBF671BE62EA3EA668513FA59` |
| `reviewer-b-blind-v1.json` | `BAD54B421CBDEE7357F6C618B3FA87F2F3E3A8A6E12D167DEDE09D84F5F8897F` |
| `reviewer-response-schema-v1.json` | `2076AD96BCE752E3689981A9B699ADBB410EB7A635B35A0A02FFCFB1BE23861C` |

Commande :

```powershell
.\evals\mapping\validate-042a2-blind-review-pack.ps1
```

Exemple de validation d'une reponse humaine future :

```powershell
.\evals\mapping\validate-042a2-human-review-responses.ps1 -ResponsePath <response-json> -ReviewerPackPath .\evals\mapping\reviews\042a2\reviewer-a-blind-v1.json
```

Ce pack ne remplit aucune reponse humaine, ne realise aucune adjudication et ne promeut aucun golden set.

## Kit de hardening de revue humaine 042a2a6a

`042a2a6a` est distinct du protocole documentaire `042a2a6` merge auparavant. Il prepare des structures futures sans modifier ni brancher les artefacts v1.

Tous les nouveaux JSON Schemas portent explicitement :

- `DRAFT`;
- `NOT_EXECUTABLE`;
- `NOT_DISTRIBUTABLE`;
- `NOT_VALIDATED_BY_DRAFT_2020_12_ENGINE`.

JSON syntax and repository invariants checked; Draft 2020-12 semantic validation not performed.

Artefacts documentaires du kit :

- `evals/mapping/reviews/042a2/reviewer-instructions-v1.md`;
- `evals/mapping/reviews/042a2/reviewer-response-schema-v2.json`;
- `evals/mapping/reviews/042a2/restricted-participant-registry-schema-v1.json`;
- `evals/mapping/reviews/042a2/review-round-manifest-schema-v1.json`;
- `evals/mapping/reviews/042a2/reviewer-attestation-schema-v1.json`;
- `evals/mapping/reviews/042a2/review-freeze-record-schema-v1.json`;
- `evals/mapping/reviews/042a2/workflow-ledger-record-schema-v1.json`;
- `evals/mapping/reviews/042a2/workflow-transition-ledger-v1.jsonl`;
- `evals/mapping/reviews/042a2/review-clarification-record-schema-v1.json`;
- `evals/mapping/reviews/042a2/adjudication-dossier-manifest-schema-v1.json`;
- `evals/mapping/validate-042a2-human-review-governance-kit.mjs`.

Le ledger JSONL contient uniquement un baseline de configuration `HARDENING_ONLY`, `sequence=0`, `previousRecordHash=GENESIS`, sans transition et sans preuve humaine. Le state declare reste `PENDING_HUMAN_RESPONSES`; collection, distribution, provider, golden promotion, adjudication et retry restent tous non autorises.

Le ledger est un tamper-evident workflow ledger, versionne, append-only par politique et no-in-place-edit. Une autorisation future exige cumulativement un state valide, une transition autorisee, des preuves humaines referencees, des hashes verifies, les validations requises passees et les approbations humaines requises presentes. Le state seul ne suffit jamais.

La chaine SHA-256 fournit seulement une detection locale lorsqu'un head ou un ancrage anterieur de confiance est deja connu; elle ne prouve ni exhaustivite, ni auteur, ni non-repudiation, et ne detecte pas seule troncation, replay, reordonnancement recalcule ou remplacement complet. Aucun ancrage externe actuel n'est prouve; sans ancrage, le ledger n'est pas une preuve autonome.

Convention ledger : UTF-8 sans BOM, LF, une ligne JSON par record, aucun commentaire ou ligne vide, ordre de proprietes deterministe, sequence monotone, hash precedent SHA-256 exact-byte lowercase calcule hors LF terminal, et hash de fichier pouvant inclure toutes les fins de ligne. Le baseline utilise `GENESIS`.

Le checker Node utilise uniquement les modules integres. Il verifie la syntaxe JSON/JSONL et les invariants du repository; il n'execute pas la semantique Draft 2020-12 et ne collecte aucune reponse. Le moteur Draft 2020-12 reste `STOP_DEPENDENCY_REQUIRED`, sans bibliotheque selectionnee ou ajoutee.

Review dispositions:

- `PR #99 technical exact-diff ratification = RATIFIED_WITH_NON_BLOCKING_CORRECTIONS`;
- `PR #99 Security/Privacy exact-diff ratification = RATIFIED_WITH_CONDITIONS_BEFORE_USE`;
- `corrective diff Security/Privacy review = REQUIRED_BEFORE_MERGE`;
- `IA Governance / fiduciary review of D/E/F = REQUIRED_BEFORE_MERGE`;
- `operational Security/Privacy confirmation = REQUIRED_BEFORE_DISTRIBUTION`.

Ces mentions ne sont ni des signatures, ni une autorisation de collecte ou de distribution. Aucune distribution actuelle n'est autorisee.

Semantique corrective D/E/F : l'ordre metier est `OUT_OF_SCOPE` -> `CONFLICTING_SIGNALS` -> `INSUFFICIENT_EVIDENCE` -> calcul des cibles admissibles -> `AMBIGUOUS_TARGET` si plusieurs cibles restent possibles -> `SUGGESTION` si une seule cible est etablie. `AMBIGUOUS_TARGET` impose `SUFFICIENT` uniquement. `STALE_IMPORT` impose `STALE_PRECONDITION`; `ACCOUNT_ALREADY_AFFECTED`, `ACCOUNT_NOT_IN_LATEST_IMPORT` et `NOT_ELIGIBLE` imposent `PRECONDITION_NOT_MET`.

Aucune reponse humaine n'est destinee a Git. Les futures instances sont des donnees personnelles pseudonymisees, non anonymes, referencees par `custodyReference` opaque et SHA-256 exact-byte. Stockage, juridiction, ACL, retention et suppression restent `NON DETERMINÉ / REQUIRED_BEFORE_DISTRIBUTION`. Aucun validateur operationnel du contenu personnel, prive, URL ou chemin n'est livre; cette condition future reste fail-closed.

Aucune instance reelle de reponse, registre participant, manifeste de round, attestation, freeze, clarification ou dossier adjudicateur n'est creee. Aucun golden set `042a2`, provider, retry, appel reseau IA, secret, `.env`, backend, frontend, DB/migration, OpenAPI, endpoint ou spec `043` n'est ajoute par le kit historique `042a2a6a`.

Etat courant apres la cloture terminale separee de `043` : la spec `042` est en backlog avec le motif `PAUSED_BY_SEPARATE_CPO_DECISION`, jamais Done; la spec `043` est terminalement close et inconclusive dans `specs/done/043-controlled-fiduciary-pilot-readiness-v1.md`, avec `STOPPED_INCONCLUSIVE / SUCCESSFULLY_DELIVERED=NO`. Cette cloture ne provient d'aucune transition `042` et ne modifie aucun artefact de preuve. Posture inchangee : `PENDING_HUMAN_RESPONSES`, human responses=`0`, adjudications=`0`, golden set `042a2`=`0`, `collectionAuthorized=false`, `distributionAuthorized=false`, `providerAuthorized=false`, `goldenPromotionAuthorized=false`, `adjudicationAuthorized=false`, `retryAuthorized=false`, `provider_runtime=STILL_BLOCKED`, `adapter_provider=NOT_AUTHORIZED`, `retry_remaining=0`, `fallback=FORBIDDEN`. JSON syntax and repository invariants checked; Draft 2020-12 semantic validation not performed.

## Moteur offline interne 042a2a3

`042a2a3` ajoute un moteur backend interne et une task Gradle pour executer les 17 cas candidats sans reseau et sans provider reel.

Artefacts runtime internes :

- moteur Kotlin non expose dans `backend/src/main/kotlin/ch/qamwaq/ritomer/mapping/application/OfflineMappingEvalEngine042a2.kt` ;
- fake provider, fault provider et runner dans `backend/src/test/kotlin/ch/qamwaq/ritomer/mapping/application/*OfflineMapping*` ;
- task Gradle `offlineMappingEval042a2`.

Commande depuis `backend/` :

```powershell
.\gradlew.bat offlineMappingEval042a2
```

Le runner :

- execute 7 cas metier, 5 policy/precondition et 5 invalid output ;
- verifie `providerCallCount = 0` sur les blockers policy/precondition ;
- compare les resultats au harness seulement, jamais dans le fake provider ;
- produit `backend/build/reports/042a2/offline-mapping-eval-report.json` ;
- marque le rapport `CANDIDATE_EVAL / NOT_GOLDEN / NOT_AUTHORITATIVE / NOT_MODEL_QUALITY` ;
- echoue avec exit non-zero via JUnit/Gradle si un cas echoue.

Ce moteur ne cree pas de contrat `mapping-suggestion-v2`, ne promeut pas de golden set, n'active aucun provider reel, n'ajoute aucun endpoint, aucune DB/migration, aucun OpenAPI, aucun secret, aucun `.env`, aucun appel IA et aucune capacite de production.

## Format du golden set

Le fichier canonique est `evals/mapping/golden-set-v1.json`.

Chaque cas contient :

- `id` unique ;
- `tenantId` et `closingFolderId` synthetiques ;
- `latestImportVersion` et `taxonomyVersion` ;
- `input.accountCode`, `input.accountLabel`, `input.debit`, `input.credit` ;
- `context` optionnel, synthetique et sans donnee brute ;
- `expected.outcome` parmi `SUGGESTION`, `NO_SUGGESTION`, `REJECTED`, `DEFERRED` ;
- `expected.suggestion` uniquement pour les cas positifs ;
- `expected.rejectionReason` ou `expected.deferredReason` pour les rejets et reports ;
- `expected.evidenceConstraints` ;
- `tags`.

Les suggestions positives doivent respecter `contracts/ai/mapping-suggestion.schema.json` sur les champs critiques :

- `accountCode` ;
- `accountLabel` ;
- `suggestedTargetCode` ;
- `confidence` entre `0` et `1` ;
- `riskLevel` parmi `LOW`, `MEDIUM`, `HIGH` ;
- `rationale` non vide ;
- `evidence[]` non vide et bornee ;
- `requiresHumanReview = true` ;
- `schemaVersion = mapping-suggestion-v1` ;
- `promptVersion` non vide ;
- `modelVersion` non vide.

## Cas couverts

`golden-set-v1.json` couvre au minimum :

- `cash-bank-simple` : banque/caisse vers `BS.ASSET.CASH_AND_EQUIVALENTS` ;
- `revenue-simple` : ventes/revenue vers `PL.REVENUE.OPERATING_REVENUE` ;
- `receivable-simple` : debiteur/receivable vers `BS.ASSET.TRADE_RECEIVABLES` ;
- `payable-simple` : fournisseur/payable vers `BS.LIABILITY.TRADE_PAYABLES` ;
- `ambiguous-clearing` : cas ambigu avec `riskLevel` prudent et confidence plafonnee ;
- `no-suggestion-expected` : compte deja mappe ou hors dernier import ;
- `non-selectable-target-rejected` : cible section non selectable rejetee ;
- `legacy-target-deferred` : cible legacy documentee comme differee, non activee par 030c/030b strict ;
- `cross-tenant-history-forbidden` : historique hors tenant non utilisable et non cite en evidence ;
- `insufficient-evidence` : absence de preuve exploitable.

Le cas legacy reste volontairement non actif : les suggestions positives 030c doivent pointer uniquement vers une cible V2 connue, selectable et non deprecated dans `contracts/reference/manual-mapping-targets-v2.yaml`.

## Metriques

Les metriques 030c documentees par le golden set sont :

- schema validity des suggestions positives ;
- exact match sur `suggestedTargetCode` pour les cas positifs ;
- presence et bornage des preuves ;
- `requiresHumanReview = true` strict ;
- calibration `confidence` / `riskLevel`, notamment sur les cas ambigus ;
- rejet des cibles non selectable ou deprecated ;
- rejet/no suggestion pour insuffisance de preuve, compte non eligible et historique hors tenant.

Les metriques runtime futures comme latence, cout, taux accept/reject/correct et fallback restent des gates 030d+.

## Seuils minimaux avant provider reel

Avant toute activation de provider reel :

- 100 % schema validity sur les suggestions positives ;
- 100 % `requiresHumanReview = true` ;
- 100 % evidence non vide sur les suggestions positives ;
- 0 secret, donnee brute ou fuite cross-tenant dans les fixtures et evidences ;
- 0 cible non selectable exposee comme suggestion positive ;
- 0 cible deprecated exposee comme suggestion positive ;
- tous les cas de rejet attendus correctement marques `NO_SUGGESTION`, `REJECTED` ou `DEFERRED` ;
- aucune activation provider reel tant que le check local n'est pas vert.

`030c` vert est obligatoire avant `030d runtime`. Un provider reel reste aussi bloque tant que `030d1 provider-readiness record and dependency/security review` n'est pas valide et signe.

## Regles donnees

Les fixtures doivent rester synthetiques. Elles ne doivent contenir :

- aucun secret, token, credential, cookie, DSN ou valeur `.env` ;
- aucune cle de stockage, storage object key, signed URL ou URI de stockage ;
- aucune donnee client brute ;
- aucun CSV brut ;
- aucune evidence hors tenant ;
- aucune donnee issue d'une fiduciaire reelle.

Les preuves doivent rester courtes, tenant-scoped et suffisantes pour une revue humaine.

## Check local

Depuis la racine du repo :

```powershell
.\evals\mapping\validate-golden-set.ps1
.\evals\mapping\validate-042a2-candidate.ps1
.\evals\mapping\validate-042a2-candidate-cases.ps1
.\evals\mapping\validate-042a2-blind-review-pack.ps1
node --check evals/mapping/validate-042a2-human-review-governance-kit.mjs
node evals/mapping/validate-042a2-human-review-governance-kit.mjs
Push-Location backend
try {
  .\gradlew.bat offlineMappingEval042a2
} finally {
  Pop-Location
}
```

Le script verifie :

- JSON valide ;
- schema interne simple et champs critiques non libres ;
- unicite des ids ;
- ids synthetiques ;
- absence de valeurs sensibles dans le golden set ;
- absence d'evidence cross-tenant ;
- structure stricte des suggestions positives ;
- cible connue, selectable et non deprecated pour toute suggestion positive ;
- absence de suggestion positive dans les cas `NO_SUGGESTION`, `REJECTED` ou `DEFERRED`.

Le script affiche `Total cases`, `Passed` et `Failed`, puis sort avec un code non zero si une regle echoue.

## Gates avant 030d

030d ne doit pas brancher de modele reel tant que :

- le check local 030c est vert ;
- le provider-readiness record `030d1` est valide et signe ;
- la dependency/security review `030d1` est valide et signee ;
- le golden set reste synthetique et sans donnee sensible ;
- les cas legacy restent differes tant que le backend 030b reste strict sur V2 selectable et non deprecated ;
- la revue IA/gouvernance valide model pinning, prompt pinning, schema pinning, logs et fallback ;
- la privacy/security review est faite avant tout envoi de donnees a un provider externe.
