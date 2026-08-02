# Pilote fiduciaire contrôlé 043 — simulation locale 043b et préparation 043c

## Statut et limite de preuve

043b is a local single-operator two-role simulation.
It validates backend RBAC behavior under two synthetic identities.
It does not establish independent human sessions or segregation of duties.

043b est une simulation locale mono-opérateur de deux rôles.
Elle valide le comportement RBAC du backend sous deux identités synthétiques.
Elle n'établit ni deux sessions humaines indépendantes ni une séparation des fonctions.

Le harness `043b` est un outil local, synthetique et strictement interne, utilisable par un seul opérateur qui contrôle volontairement les deux rôles. Son dataset est classe :

`HARNESS_ONLY_AUTH_RBAC_DATASET`

Il sert uniquement a prouver localement l'authentification JWT, la resolution PostgreSQL des memberships, le RBAC maker/reviewer et l'isolation tenant. Il ne prouve pas :

- l'import des fixtures gelees `043a` ;
- un parcours de closing complet ;
- `043c`, `R1` ou `R2` ;
- la readiness d'un participant externe.

La préparation `043c` est désormais matérialisée à S2. L'exécution `043c`, R1 et R2 restent `NOT_STARTED / NOT_AUTHORIZED`; tout run repartira des fixtures gelées `043a` dans une base et un stockage jetables, après les revues et autorisations distinctes requises.

Le smoke runtime reel a ete execute par l'utilisateur local contre une base jetable fraiche. Codex ne l'a jamais execute et n'a lu aucun secret ; les credentials PostgreSQL, le secret HMAC et les JWT sont restes hors de Git, du chat et des preuves partagees.

`smoke_local_real=PASS_FRESH_DISPOSABLE_DB`

Etat courant au `2026-07-27` : `LOCAL_SYNTHETIC_SIMULATION_VALIDATED / MERGED / AI_REVIEWED / OWNER_RISK_ACCEPTED_FOR_LOCAL_SYNTHETIC_ONLY / NOT_HUMAN_SIGNED / NOT_PRODUCTION_READY / NOT_EXTERNAL_READY / NOT_SEPARATION_OF_DUTIES_PROOF`.

Preuves de fermeture : PR `#103` mergee ; Backend CI et Frontend CI `PASS` ; PostgreSQL dedie, smoke deux roles, matrice RBAC et controle navigateur `PASS` ; `browserAuthorizationHeaderVisible=NO` ; `browserJwtSurfaceDetected=NO` ; cleanup runtime, base et role `PASS` ; verification post-merge `PASS`.

Les revues finales AI Technical et AI Security/Privacy sont `PASS`. L'artefact reste `AI_GENERATED_REVIEW / NOT_HUMAN_SIGNED` ; les revues techniques et Security humaines restent differees au gate externe.

La presente section est l'unique source du statut courant apres le `2026-07-27`. Les mentions `PENDING_LOCAL_EVIDENCE`, `NOT_MERGE_READY`, `smoke_local_real=NOT_RUN_USER_LOCAL_REQUIRED` et le libelle historique `Statuts courants` conserves plus bas decrivent exclusivement les etats pre-fermeture des `2026-07-13` et `2026-07-22` ; ils ne qualifient plus l'etat courant.

Historique pre-hotfix conserve : le merge etait `MERGED_WITH_KNOWN_HIGH_FINDINGS` et l'usage local `LOCAL_USE_PAUSED`.

Classifications detaillees : `LOCAL_TWO_ROLE_SIMULATION / SINGLE_OPERATOR_CAPABLE / SYNTHETIC_ONLY / LOOPBACK_ONLY / NOT_PRODUCTION_AUTH / NOT_INDEPENDENT_ACTOR_BOUNDARY / NOT_PROOF_OF_SEGREGATION_OF_DUTIES / NOT_FOR_EXTERNAL_USE / NOT_FOR_REAL_DATA`.

## Architecture locale fermee

La topologie autorisee est fixe :

| Composant | Adresse | Identite |
| --- | --- | --- |
| Backend Spring Boot | `http://127.0.0.1:8080` | backend commun |
| Vite ACCOUNTANT | `http://127.0.0.1:5173` | `ritomer-demo-user-036a` |
| Vite REVIEWER | `http://127.0.0.1:5174` | `ritomer-demo-reviewer-043b` |

Le launcher refuse toute autre target backend, tout host autre que `127.0.0.1`, tout port alternatif, tout fallback de port et tout argument CLI, dont `--open`. Il refuse aussi la presence d'un fichier nomme `.env` ou commencant par `.env.` dans `frontend/`, sans en lire le contenu, afin d'empecher Vite de charger une configuration hors allowlist.

Les deux JWT ont une duree exacte de 3 600 secondes. Ils restent uniquement dans le processus parent et dans l'environnement minimal du Vite correspondant. Le navigateur ne recoit aucun bearer. Aucune regeneration ni aucun refresh n'existe ; l'expiration arrete les deux Vite et impose un redemarrage complet du harness.

Les ports `5173` et `5174` sont uniquement deux contextes visuels. Ils ne constituent pas une frontière d'identité ni deux sessions humaines indépendantes.

## Variables locales requises

Ne stocker aucune valeur dans Git, un fichier `.env`, le navigateur, une URL, un runbook ou une sortie partagee.

Noms utilises par le backend et le seed :

- `RITOMER_SECURITY_JWT_HMAC_SECRET` ;
- `SPRING_DATASOURCE_URL` ;
- `SPRING_DATASOURCE_USERNAME` ;
- `SPRING_DATASOURCE_PASSWORD`.

Le harness lit uniquement `RITOMER_SECURITY_JWT_HMAC_SECRET`. La valeur doit etre non vide et representer au moins 32 octets UTF-8. Il n'existe aucun fallback, aucune constante de secret et aucune lecture de fichier.

L'ancien fallback et la sentinel `__INVALID_RUNTIME_SECRET_REQUIRED__` sont toujours refusés. Ne créer aucun `.env`, ne jamais documenter de valeur statique et ne jamais demander à Codex de lire la valeur. Pour créer 32 octets CSPRNG directement dans le shell sans les afficher ni les stocker :

```powershell
$jwtKeyBytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($jwtKeyBytes)
$env:RITOMER_SECURITY_JWT_HMAC_SECRET = [Convert]::ToBase64String($jwtKeyBytes)
[Array]::Clear($jwtKeyBytes, 0, $jwtKeyBytes.Length)
```

Le harness construit lui-meme les trois variables de chaque enfant Vite :

- `RITOMER_LOCAL_DEMO_BACKEND_TARGET` avec la target fixe `http://127.0.0.1:8080` ;
- `RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED` active ;
- `RITOMER_LOCAL_DEMO_BEARER_TOKEN` propre a l'acteur.

Le secret HMAC et le token de l'autre acteur sont absents de chaque enfant.

## Base PostgreSQL jetable obligatoire pour les tests destructifs

`dbIntegrationTest` est autorise uniquement contre PostgreSQL local direct, via l'URL exacte `jdbc:postgresql://127.0.0.1:5432/ritomer_043b_test`, sur une base nouvellement creee pour cette preuve, nommee exactement `ritomer_043b_test`, avec le role de login dedie `ritomer_043b_test_runner`.

La base doit etre :

- jetable et synthetic-only ;
- creee de novo pour les tests 043b ;
- vide avant Flyway, hors schema cree par la suite de test ;
- sans dump, clone, snapshot ou restauration d'une base client, pilote, staging ou production ;
- sans donnee client ou participant reel.
- sans Cloud SQL Proxy, tunnel SSH, port forward ni autre intermédiaire réseau.

Variables obligatoires :

- `RITOMER_DB_TESTS_ENABLED=true` ;
- `RITOMER_DB_TEST_JDBC_URL=jdbc:postgresql://127.0.0.1:5432/ritomer_043b_test` exactement ;
- `RITOMER_DB_TEST_USERNAME=ritomer_043b_test_runner` ;
- `RITOMER_DB_TEST_PASSWORD`, definie uniquement dans le shell local, sans valeur reproduite dans ce runbook ;
- `RITOMER_DB_TEST_DESTRUCTIVE_CONSENT=TRUNCATE_RITOMER_043B_TEST`.

`localhost`, `::1`, `0.0.0.0`, une query, un fragment, un userinfo, un encodage, un paramètre JDBC supplémentaire, un autre port ou une adresse distante sont refusés. Les 12 classes DB valident avant Flyway puis, sur la même connexion que la destruction, `DatabaseMetaData.url`, `DatabaseMetaData.userName`, `current_database()`, `current_user`, `session_user`, `inet_server_addr()`, `inet_server_port()`, les cinq privilèges dangereux, les memberships privilégiées et les propriétaires de la base et du schéma `public`.

Le login/current/session role, le propriétaire de la base et le propriétaire du schéma `public` doivent tous être exactement `ritomer_043b_test_runner`. La validation complète précède tout SQL destructif ; validation et destruction partagent une seule connexion et une seule transaction, avec un commit sur succès ou un rollback sur échec, sans retry.

Limite opérateur acceptée : un tunnel local sophistiqué capable d'imiter toutes les observations pourrait contourner l'intention du contrôle. Ce risque résiduel est accepté uniquement pour ce périmètre local synthétique et ne rend pas l'usage externe acceptable.

Les recettes seed locales visant `/ritomer`, y compris `036a`, `042a2a5d-mixed-v2` et `043b-two-actor-pilot`, n'autorisent jamais `dbIntegrationTest`. Ne reutiliser ni leur base, ni leur role. Stopper immediatement si la task est `SKIPPED`, si la garde refuse la connexion ou l'identite, ou si la base/role dedies ne peuvent pas etre prouves. Ne jamais contourner la garde depuis l'IDE.

## Preparation du dataset 043b

Depuis la racine du repo, avec les variables PostgreSQL deja definies dans le shell local :

```powershell
Push-Location backend
try {
  .\gradlew.bat `
    -PritomerDemoSeedEnabled=true `
    -PritomerDemoSeedVariant=043b-two-actor-pilot `
    demoSeedLocal
} finally {
  Pop-Location
}
```

Le seed est opt-in, idempotent et conserve le seed par defaut `036a` inchange. La variante ajoute :

- le REVIEWER `043b0000-0000-4000-8000-000000000002`, avec une seule membership active `REVIEWER` dans le tenant `036a` ;
- le dossier `043b0000-0000-4000-8000-000000000004` ;
- l'import `043b0000-0000-4000-8000-000000000005` ;
- six lignes et six mappings synthetiques deterministes.

Elle ne preseed aucun workpaper, document, export pack, reviewer decision, objet client reel ou donnee d'un autre tenant. Une deuxieme execution identique est un no-op et n'ajoute aucun audit.

## Demarrage strict du backend

Le backend doit etre demarre dans un shell ou les variables requises sont deja presentes :

```powershell
Push-Location backend
try {
  .\gradlew.bat bootRun --args='--spring.profiles.active=local --server.address=127.0.0.1 --server.port=8080'
} finally {
  Pop-Location
}
```

Ne remplacer ni l'adresse, ni le port, ni le profil. Le harness exige ensuite un preflight reussi sur `http://127.0.0.1:8080/actuator/health`.

## Demarrage du harness

Dans un autre shell local, avec `RITOMER_SECURITY_JWT_HMAC_SECRET` deja present :

```powershell
Push-Location frontend
try {
  pnpm dev:two-actor-local
} finally {
  Pop-Location
}
```

Le launcher execute, dans cet ordre : health backend, reservation des ports, readiness ACCOUNTANT, readiness REVIEWER, verification exacte de `/api/me` pour les deux acteurs, puis seulement `HARNESS_READY`.

La readiness initiale retente uniquement `CONNECTION`, `TIMEOUT` et les HTTP `500..599`. Les HTTP `100..499` hors succes exact attendu, dont les redirections `3xx`, ainsi que `INVALID_JSON`, tous les mismatches d'identite/tenant/role/membership, `CHILD_EXITED` et `UNKNOWN` echouent au premier resultat. Les redirections ne sont pas suivies. Aucun delai n'est applique apres le dernier essai et les diagnostics restent limites aux enums, compteurs, statuts et champs fermes documentes.

Aucun navigateur ne s'ouvre automatiquement. Ouvrir manuellement `http://127.0.0.1:5173` pour ACCOUNTANT et `http://127.0.0.1:5174` pour REVIEWER.

## Verification des identites et sockets

Les appels passent par les proxies Vite, sans header `Authorization` fourni par l'utilisateur :

```powershell
$accountant = Invoke-RestMethod -Uri 'http://127.0.0.1:5173/api/me'
$reviewer = Invoke-RestMethod -Uri 'http://127.0.0.1:5174/api/me'

$accountant | Select-Object actor, activeTenant, effectiveRoles
$reviewer | Select-Object actor, activeTenant, effectiveRoles
```

Attendus exacts :

- ACCOUNTANT : sujet `ritomer-demo-user-036a`, tenant `036a0000-0000-4000-8000-000000000001`, role unique `ACCOUNTANT` ;
- REVIEWER : sujet `ritomer-demo-reviewer-043b`, meme tenant, role unique `REVIEWER`.

Verifier les sockets :

```powershell
Get-NetTCPConnection -State Listen -LocalPort 8080,5173,5174 |
  Sort-Object LocalPort |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

Les trois lignes doivent porter `LocalAddress = 127.0.0.1`. Toute ecoute `0.0.0.0`, `::` ou un autre port est un echec.

## Smoke RBAC maker/reviewer

Utiliser uniquement le dossier synthetique 043b. Les requetes suivantes ne contiennent aucun bearer ; chaque proxy injecte le sien cote serveur Vite :

```powershell
$tenantId = '036a0000-0000-4000-8000-000000000001'
$folderId = '043b0000-0000-4000-8000-000000000004'
$anchorCode = 'BS.ASSET.CURRENT_SECTION'
$headers = @{ 'X-Tenant-Id' = $tenantId }
$makerBody = @{ noteText = 'Synthetic 043b maker note'; status = 'READY_FOR_REVIEW'; evidences = @() } |
  ConvertTo-Json -Depth 4
$reviewBody = @{ decision = 'REVIEWED' } | ConvertTo-Json

Invoke-RestMethod -Method Put `
  -Uri "http://127.0.0.1:5173/api/closing-folders/$folderId/workpapers/$anchorCode" `
  -Headers $headers -ContentType 'application/json' -Body $makerBody

try {
  Invoke-WebRequest -Method Put `
    -Uri "http://127.0.0.1:5174/api/closing-folders/$folderId/workpapers/$anchorCode" `
    -Headers $headers -ContentType 'application/json' -Body $makerBody -UseBasicParsing
} catch {
  [int]$_.Exception.Response.StatusCode
}

try {
  Invoke-WebRequest -Method Post `
    -Uri "http://127.0.0.1:5173/api/closing-folders/$folderId/workpapers/$anchorCode/review-decision" `
    -Headers $headers -ContentType 'application/json' -Body $reviewBody -UseBasicParsing
} catch {
  [int]$_.Exception.Response.StatusCode
}

Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:5174/api/closing-folders/$folderId/workpapers/$anchorCode/review-decision" `
  -Headers $headers -ContentType 'application/json' -Body $reviewBody
```

Attendus, dans cet ordre :

1. le PUT via `5173` reussit ;
2. le meme PUT via `5174` retourne `403` ;
3. le POST `review-decision` via `5173` retourne `403` ;
4. le meme POST via `5174` reussit.

Les tests `dbIntegrationTest` creent en plus un tenant leurre persistant, sans membership des deux acteurs, puis prouvent qu'il ne peut etre ni selectionne, ni lu, ni mute et que les claims JWT falsifies ne changent rien. Le dataset runtime 043b ne cree volontairement aucun second tenant.

La preuve automatisee ciblee de ce leurre doit etre executee contre la base PostgreSQL jetable dediee, dans un shell ou les variables DB de test explicites sont deja presentes sans afficher le password :

```powershell
Push-Location backend
try {
  $env:RITOMER_DB_TESTS_ENABLED='true'
  $env:RITOMER_DB_TEST_JDBC_URL='jdbc:postgresql://127.0.0.1:5432/ritomer_043b_test'
  $env:RITOMER_DB_TEST_USERNAME='ritomer_043b_test_runner'
  $env:RITOMER_DB_TEST_DESTRUCTIVE_CONSENT='TRUNCATE_RITOMER_043B_TEST'
  if (-not (Test-Path Env:RITOMER_DB_TEST_PASSWORD)) {
    throw 'RITOMER_DB_TEST_PASSWORD must already exist in the local shell.'
  }
  .\gradlew.bat dbIntegrationTest --tests "*DemoSeedLocalAuthMeDbIntegrationTest*"
} finally {
  Pop-Location
}
```

La sortie doit montrer une task executee, non `SKIPPED`, et le test vert. Ce check couvre le workpaper leurre persistant et l'equivalence opaque avec un identifiant absent. Sinon, le resultat est `ENV_BLOCKED_DB_INTEGRATION`.

Dans chacun des deux onglets, ouvrir les DevTools et verifier aussi :

1. dans Network, la requete navigateur `/api/me` ne contient aucun header `Authorization` dans `Request Headers` ;
2. dans Console, le controle suivant retourne `false` :

```javascript
const browserSurfaces = [
  document.documentElement.outerHTML,
  location.href,
  JSON.stringify(Object.fromEntries(Object.entries(localStorage))),
  JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))
];
browserSurfaces.some((value) => /[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}/.test(value));
```

Ce controle prouve que le bearer n'apparait ni dans le DOM, ni dans l'URL, ni dans `localStorage`, ni dans `sessionStorage`. Il doit etre repete sur `5173` et `5174` sans jamais afficher ou copier un token.

## Arret et expiration

- `Ctrl+C` dans le shell du harness declenche un shutdown coordonne des deux Vite ;
- `SIGTERM`, une erreur non geree, une sortie enfant, un `/api/me` invalide ou l'expiration JWT declenchent le meme arret global ;
- le launcher attend la terminaison des enfants et la reutilisabilite de `5173` et `5174` ;
- aucun renouvellement n'est tente et un `401` ne permet jamais de continuer.

Apres l'arret :

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5173,5174 -ErrorAction SilentlyContinue
```

Aucune ligne ne doit rester. Arreter ensuite le backend dans son propre shell.

## Checks automatises avant revue

Backend :

```powershell
Push-Location backend
try {
  .\gradlew.bat test
  .\gradlew.bat test --tests "*ApplicationModule*"
  .\gradlew.bat dbIntegrationTest
  .\gradlew.bat build
} finally {
  Pop-Location
}
```

Frontend :

```powershell
Push-Location frontend
try {
  node --check local-two-actor-harness.mjs
  pnpm vitest run local-two-actor-harness.test.ts local-demo-proxy.test.ts
  pnpm test:ci
  pnpm lint
  pnpm build
} finally {
  Pop-Location
}
```

`dbIntegrationTest` doit annoncer une execution PostgreSQL reelle. Une task skippee ou une configuration absente vaut `ENV_BLOCKED_DB_INTEGRATION`, jamais un PASS ni une readiness de merge.

Historique conserve du `2026-07-13` : `ENV_BLOCKED_DB_INTEGRATION`, car la task avait ete `SKIPPED` en l'absence de configuration PostgreSQL de test explicite. Le validateur 043a avait aussi produit `CHECK_BLOCKED_APPROVED_FILE_SET` parce que son ancienne whitelist ne couvrait pas la surface runtime alors autorisee. Le smoke etait `NOT_RUN`, tandis que les checks sans DB constituaient le `PASS_COMBINED_EVIDENCE` anterieur. Ces preuves datees ne sont pas reecrites.

État après le hotfix et les checks sans DB : `MINIMUM_VIABLE_SAFETY_IMPLEMENTED / PENDING_LOCAL_EVIDENCE / NOT_MERGE_READY`. Le checker accepte le worktree exact de 26 chemins et son mode historique `043b-hotfix` valide une matrice `24M/2A` en lisant exclusivement le head. `dbIntegrationTest`, le seed reel, `bootRun`, Vite reel et le smoke navigateur restent non executes pendant cette boucle.

## Responsabilite locale et revue

L'utilisateur local est seul responsable de la creation, de la robustesse, de la garde et de la rotation des passwords/credentials PostgreSQL et du secret HMAC. Ces valeurs ne doivent jamais etre collees dans ChatGPT/Codex, Git, un ticket, un screenshot, une capture reseau ou un resultat de smoke partage.

Statuts courants : `AI_TECHNICAL_REVIEW=COMPLETED_WITH_FINDINGS`, `AI_SECURITY_PRIVACY_REVIEW=COMPLETED_WITH_FINDINGS`, `AI_CTO_REVIEW=COMPLETED_WITH_CONDITIONS`, `OWNER_RISK_ACCEPTANCE=ACCEPTED_FOR_LOCAL_SYNTHETIC_ONLY`, `HUMAN_TECHNICAL_REVIEW=DEFERRED_TO_EXTERNAL_GATE`, `HUMAN_SECURITY_REVIEW=DEFERRED_TO_EXTERNAL_GATE`, `REVIEW_ARTIFACT_CLASSIFICATION=AI_GENERATED_REVIEW`, `REVIEW_SIGNATURE_STATUS=NOT_HUMAN_SIGNED`.

Les gates humains redeviennent obligatoires dès qu'une donnée réelle/client, un utilisateur ou participant externe, un pilote externe, un déploiement partagé, un accès non-loopback, une authentification ou un secret de production, une première utilisation commerciale, un provider IA externe, un MCP exposé, une affirmation de vraie séparation des fonctions ou un usage externe de `043c` entre dans le périmètre. Ils n'autorisent jamais implicitement `043c`, un participant externe, une auth de production, un provider ou un MCP.

# 043c — Protocole préparatoire de répétition interne contrôlée

## Statut de la préparation

La préparation documentaire et les contrôles read-only de `043c` sont matérialisés jusqu'à :

`S2 = 043C_PREPARATORY_IMPLEMENTED_PENDING_POST_CODE_CPO`

Cette matérialisation n'autorise aucune exécution. Les statuts d'exécution restent :

- `043C_EXECUTION_AUTHORIZATION=NOT_GRANTED` ;
- `R1=NOT_STARTED_NOT_AUTHORIZED` ;
- `R2=NOT_STARTED_NOT_AUTHORIZED` ;
- `EXTERNAL_USE=NOT_AUTHORIZED` ;
- `REAL_DATA=NOT_AUTHORIZED` ;
- `PRODUCTION=NOT_AUTHORIZED`.

## Quarantaine permanente du protocole v1

`V1_EXECUTION=PERMANENTLY_NOT_AUTHORIZED`

Le protocole et le ledger `043c` v1 sont conservés uniquement comme provenance
historique byte-identique. Ils ne sont plus sélectionnables pour une exécution,
ne reçoivent plus aucune transition et ne constituent jamais un fallback.

Le seul protocole courant sélectionné pour la récupération est documenté dans
`runbooks/controlled-fiduciary-pilot-local-043c-v2.md`. Cette sélection ne le rend
pas exécutable : son exécution, `Qualification`, `PreparationPreflight`, `R1`,
`R2`, tout accès externe, toute donnée réelle et toute production restent
non autorisés jusqu'aux décisions et gates v2 explicites.

Tous les modes externes du validateur v1 doivent échouer avant toute I/O avec :

```text
V1_EXECUTION=PERMANENTLY_NOT_AUTHORIZED
V2_VALIDATOR_REQUIRED=YES
```

`SelfTest` v1 reste le seul mode autorisé, strictement synthétique et en mémoire.
Aucun import, dot-sourcing, appel ou réemploi runtime du validateur v1 par v2
n'est permis.

Le bloc ci-dessous est l'unique protocole `043c` version 1. Son digest n'est pas écrit dans le bloc afin d'éviter toute auto-référence. Il est calculé sur les octets exacts situés après le LF du marqueur de début et avant le marqueur de fin ; le dernier octet du blob ainsi extrait est donc l'unique LF terminal du protocole.

<!-- 043C_PROTOCOL_V1_BEGIN -->
protocolId = 043c-internal-rehearsal-v1
classification = INTERNAL_SYNTHETIC_ONLY
currentPreparatoryState = 043C_PREPARATORY_IMPLEMENTED_PENDING_POST_CODE_CPO
executionAuthorized = false
r1Authorized = false
r2Authorized = false
externalUseAuthorized = false
realDataAuthorized = false
productionAuthorized = false

## 1. Canonicalisation et gel

- Le fichier porteur est encodé en UTF-8 strict sans BOM, avec LF uniquement et exactement un LF terminal.
- `protocolSha256` est le SHA-256 lowercase des octets exacts de ce bloc, sans aucune normalisation de texte.
- `S4_FROZEN_COMMIT_BINDING=TRANSITION_BASE_EXACT`.
- Pour un replay historique S3→S4 sous le profil `043c-transition`, `frozenCommit` doit être exactement `range.base`, c'est-à-dire le parent direct mono-parent du commit de transition.
- Pour un worktree S3→S4, `frozenCommit` doit être exactement le `HEAD` courant avant la modification non commitée qui ajoute le record S4.
- Toute autre valeur est rejetée. La valeur attendue vient du contexte Git fermé du profil, jamais du record S4 lui-même.
- À partir du record S4, `frozenCommit` reste strictement identique dans chaque record ultérieur et aucune future transition ne peut le changer.
- À partir de S4, le bloc courant doit être identique octet pour octet au bloc lu depuis le blob Git de `frozenCommit`.
- `frozenCommit` est le commit parent S3 de la transition vers S4, sélectionné et gelé par le CTO Gate après l'implémentation préparatoire. Il n'est jamais la baseline pré-code `1ecddd81e255bc049558e5f90bf65db394558d67`.
- Dans le candidat worktree S3→S4 non commité, `frozenCommit=HEAD`; une fois le commit de transition créé, ce parent gelé devient un ancêtre strict de `HEAD`. Les validations post-commit exigent cet ancêtre strict et un worktree propre. La propreté exige à la fois une sortie vide de `git status --porcelain=v1 -z --untracked-files=all` et une sortie `git ls-files -v -z --` composée uniquement de records `H <path>` : tout flag `assume-unchanged`, `skip-worktree` ou tag d'index inattendu est rejeté.
- Chaque commit strictement postérieur à `frozenCommit` et jusqu'à `HEAD` doit être linéaire, mono-parent, modifier exactement `1 M` sur `specs/active/043-controlled-fiduciary-pilot-readiness-v1.md`, ajouter exactement un record JSONL recevable et ne modifier aucun octet de la spec hors bloc ledger.
- Les records antérieurs restent byte-identiques à chaque commit. Un backend, frontend, test, fixture, runbook, checker, validateur, contrat ou autre document modifié puis restauré après le gel reste interdit : le rail examine chaque commit, pas seulement le diff agrégé.
- Les blocs protocole du blob gelé, de `HEAD` et du worktree propre doivent être identiques octet pour octet.
- Toute dérive du protocole après S4 impose un retour à S2, une nouvelle revue CPO post-code, un nouveau CTO Gate, un nouveau commit gelé et de nouvelles autorisations locales de run.
- Aucun mode du validateur ne crée un état, une autorisation, une preuve, une ressource ou une transition.

## 2. Machine d'états fermée

| ID | Valeur exacte | Source |
| --- | --- | --- |
| S0 | `043C_PLAN_HARDENED_IMPLEMENTATION_NOT_AUTHORIZED` | Git durable |
| S1 | `043C_PREPARATORY_IMPLEMENTATION_AUTHORIZED` | Git durable |
| S2 | `043C_PREPARATORY_IMPLEMENTED_PENDING_POST_CODE_CPO` | Git durable |
| S3 | `043C_POST_CODE_CPO_PASS_PENDING_CTO` | Git durable |
| S4 | `043C_PROTOCOL_FROZEN_READY_FOR_R1_DECISION` | Git durable |
| S5 | `R1_ONLY_AUTHORIZED_NOT_STARTED` | local uniquement |
| S6 | `R1_STARTED_CLEANUP_NOT_VALIDATED` | local uniquement |
| S7 | `R1_CLEANUP_VALIDATED_READY_FOR_R2_DECISION` | Git durable |
| S8 | `R2_ONLY_AUTHORIZED_NOT_STARTED` | local uniquement |
| S9 | `R2_STARTED_CLEANUP_NOT_VALIDATED` | local uniquement |
| S10 | `R2_CLEANUP_VALIDATED_READY_FOR_FINAL_CPO_DECISION` | Git durable |
| F1 | `GO_TO_EXTERNAL_GATE_REVIEW` | Git durable, terminal |
| F2 | `NO_GO` | Git durable, terminal |
| F3 | `INCONCLUSIVE` | Git durable, terminal |

Il n'existe aucun S11. F1, F2 et F3 sont terminaux sans transition sortante. S5, S6, S8 et S9 ne sont jamais des records du ledger Git durable.

Transitions et gates :

1. S0 vers S1 : décision CPO autorisant uniquement l'implémentation préparatoire exacte `3M/1A`.
2. S1 vers S2 : diff exact et checks préparatoires recevables, sans exécution R1/R2.
3. S2 vers S3 : revue CPO humaine post-code du diff exact.
4. S3 vers S4 : CTO Gate sur le diff, le protocole, son hash et le futur commit gelé.
5. S4 vers S5 : `PreparationPreflight` recevable, puis décision CPO locale `R1_ONLY`.
6. S5 vers S6 : provisionnement opérateur R1, `PreR1` recevable, puis écriture locale atomique S6 immédiatement avant T00.
7. S6 vers S7 : T00–T14 ou interruption enregistrée, puis T15 et `PostR1Cleanup` avec l'une des deux dispositions fermées.
8. S7 vers S8 : uniquement si R1 est `COMPLETED`, audit R1 `15/0/0`, `completedRun=R1` et nouvelle décision CPO `R2_ONLY`.
9. S7 vers F2 ou F3 : décision humaine `CHECK_FINAL_CPO` possible après cleanup R1 vérifié, que R1 soit complet ou interrompu.
10. S7 vers F1 : interdit.
11. S8 vers S9 : provisionnement opérateur R2, `PreR2` recevable, puis écriture locale atomique S9 immédiatement avant T00.
12. S9 vers S10 : T00–T14 ou interruption enregistrée, puis T15 et `PostR2Cleanup` avec l'une des deux dispositions fermées.
13. S10 vers F1 : uniquement avec R1 et R2 `COMPLETED`, deux audits `15/0/0`, deux cleanups vérifiés, `completedRun=R2` et décision CPO explicite.
14. S10 vers F2 ou F3 : décision CPO explicite après cleanup vérifié, y compris si R2 est interrompu.

Un run interrompu peut donc atteindre S7 ou S10 après cleanup vérifié, sans jamais être qualifié de réussite métier. R2 n'est pas requis pour terminer en F2 ou F3.

## 3. Ledger durable

Chaque record durable contient exactement, dans cet ordre :

1. `schemaVersion`
2. `sequence`
3. `state`
4. `previousState`
5. `recordedAtUtc`
6. `recordedByRole`
7. `authorityType`
8. `authorityRef`
9. `protocolId`
10. `protocolSha256`
11. `frozenCommit`
12. `r1Authorized`
13. `r2Authorized`
14. `completedRun`
15. `evidenceSha256`
16. `cpoOutcome`

`resourceTargetSha256` appartient exclusivement aux fichiers locaux d'autorisation et d'état ; il est interdit dans le ledger durable.

Contraintes :

- `schemaVersion` vaut l'entier `1`.
- `sequence` commence à `0` et augmente exactement de `1`, sans trou ni doublon.
- `recordedAtUtc` suit exactement `yyyy-MM-ddTHH:mm:ss.fffZ` et croît strictement.
- `protocolId` et `protocolSha256` sont `null` en S0/S1, puis obligatoires et stables dès S2.
- `frozenCommit` est `null` de S0 à S3, puis un SHA Git lowercase de 40 caractères stable dès S4.
- `r1Authorized` et `r2Authorized` restent toujours `false` dans le ledger durable.
- `completedRun` vaut seulement `null`, `R1` ou `R2`.
- S7 après R1 complet porte `completedRun=R1`; S7 après R1 interrompu porte `completedRun=null`.
- S10 après R2 complet porte `completedRun=R2`; S10 après R2 interrompu porte `completedRun=R1`.
- F1 porte `completedRun=R2`; F2/F3 portent la dernière valeur factuellement atteinte.
- `evidenceSha256` est `null` de S0 à S4, puis un SHA-256 lowercase en S7, S10 et F1/F2/F3.
- `cpoOutcome` est `null` de S0 à S10, puis vaut exactement l'état terminal.
- S10 exige que le record S7 antérieur porte `completedRun=R1`; son `previousState` déclaré reste S9 afin de prouver le passage par le chemin local R2.
- Un terminal F2/F3 nomme exactement son checkpoint source S7 ou S10 dans `previousState` et en recopie exactement `completedRun` et `evidenceSha256`; une source déclarée différente du record durable immédiatement précédent est rejetée.
- F1 exige un checkpoint S10 portant `completedRun=R2`.
- Un terminal est unique, dernier et sans transition sortante.

Vocabulaire fermé `recordedByRole` :

- `CPO`
- `PREPARATION_OWNER`
- `CTO`
- `COORDINATOR_043C`

Vocabulaire fermé `authorityType` :

- `CPO_PLAN_HARDENING_DECISION`
- `CPO_PREPARATORY_IMPLEMENTATION_DECISION`
- `PREPARATORY_IMPLEMENTATION_EVIDENCE`
- `CPO_POST_CODE_REVIEW`
- `CTO_GATE`
- `R1_CLEANUP_EVIDENCE`
- `R2_CLEANUP_EVIDENCE`
- `CPO_FINAL_DECISION`

Matrice fermée :

| État | recordedByRole | authorityType |
| --- | --- | --- |
| S0 | `CPO` | `CPO_PLAN_HARDENING_DECISION` |
| S1 | `CPO` | `CPO_PREPARATORY_IMPLEMENTATION_DECISION` |
| S2 | `PREPARATION_OWNER` | `PREPARATORY_IMPLEMENTATION_EVIDENCE` |
| S3 | `CPO` | `CPO_POST_CODE_REVIEW` |
| S4 | `CTO` | `CTO_GATE` |
| S7 | `COORDINATOR_043C` | `R1_CLEANUP_EVIDENCE` |
| S10 | `COORDINATOR_043C` | `R2_CLEANUP_EVIDENCE` |
| F1/F2/F3 | `CPO` | `CPO_FINAL_DECISION` |

`authorityRef` est une chaîne opaque lowercase conforme exactement à `^043c-[a-z0-9][a-z0-9-]{6,95}$`, sans identité, chemin, URL, secret ou donnée métier.

Validation et profils fermés :

- le validateur générique accepte tout préfixe recevable finissant en S0, S1, S2, S3, S4, S7, S10 ou un unique terminal F1/F2/F3 ;
- `WORKTREE_043C_PREPARATORY` reste le profil courant exact : les quatre chemins préparatoires, `3M/1UNTRACKED`, index vide, exactement trois records et dernier état S2 ;
- `WORKTREE_043C_DURABLE_TRANSITION` est le profil futur exact : uniquement `M specs/active/043-controlled-fiduciary-pilot-readiness-v1.md`, index vide, aucun untracked, aucune spec `044+`, exactement un record ajouté, aucun ancien record modifié/supprimé et aucun octet hors ledger modifié ;
- le replay historique `043c-transition` exige un commit direct mono-parent `base→head`, exactement `1 M` sur cette spec et la même preuve append-only d'un seul record.

## 4. Racine locale et schémas fermés

La racine locale future est :

`[Environment]::GetFolderPath('LocalApplicationData')\Ritomer\043c\043c-internal-rehearsal-v1\`

Elle est hors Git. Pendant la présente mission, aucun fichier local d'autorisation, d'état ou de preuve n'est créé.

`LOCAL_APPLICATION_DATA_ROOT_POLICY=WINDOWS_FIXED_LOCAL_ONLY`

`%LOCALAPPDATA%` doit résoudre vers un chemin Windows local pleinement qualifié et canonique de forme `X:\...`, sur un volume dont `DriveType=Fixed`. Tout chemin UNC, partage réseau, mapped network drive ou device path (`\\?\`, `\\.\`, `\??\`) est interdit. Toute URI ou racine relative est interdite. Any network redirection fails closed; no automatic override exists.

Tous les JSON locaux sont UTF-8 strict sans BOM, LF-only, avec un objet minifié sur une seule ligne suivi d'un unique LF terminal. Les clés apparaissent exactement dans l'ordre documenté.

### `authorization.json`

Exactement neuf champs :

1. `schemaVersion`
2. `run`
3. `decision`
4. `authorizedAtUtc`
5. `authorityRef`
6. `protocolId`
7. `protocolSha256`
8. `frozenCommit`
9. `resourceTargetSha256`

Règles : `schemaVersion=1`; `run=R1|R2`; `decision=R1_ONLY` pour R1 ou `R2_ONLY` pour R2; timestamp UTC strict; authorityRef fermé; protocolId exact; hashes lowercase 64; frozenCommit lowercase 40; aucune propriété supplémentaire.

### `state\active-state.json`

Exactement neuf champs :

1. `schemaVersion`
2. `state`
3. `run`
4. `recordedAtUtc`
5. `authorityRef`
6. `protocolId`
7. `protocolSha256`
8. `frozenCommit`
9. `resourceTargetSha256`

S5/S6 sont admis uniquement avec R1 et S8/S9 uniquement avec R2. Tous les bindings doivent être identiques à `authorization.json`; `recordedAtUtc` ne précède pas `authorizedAtUtc`.

### `runs\R1\evidence-summary.json` et `runs\R2\evidence-summary.json`

Exactement quatorze champs :

1. `schemaVersion`
2. `run`
3. `outcome`
4. `lastCompletedTask`
5. `abortReasonCode`
6. `runStartedAtUtc`
7. `runEndedAtUtc`
8. `protocolId`
9. `protocolSha256`
10. `frozenCommit`
11. `resourceTargetSha256`
12. `expectedBusinessEventCount`
13. `missingExpectedBusinessEventCount`
14. `unexpectedBusinessEventCount`

Règles communes :

- `schemaVersion=1`, run exact et bindings identiques à l'autorisation.
- `outcome=COMPLETED|ABORTED`.
- `runEndedAtUtc` est toujours un timestamp UTC strict réel au scellement.
- `ABORT_START_CONVENTION=NULL_ONLY_BEFORE_OR_AT_T00`.
- Pour `outcome=ABORTED`, `runStartedAtUtc=null` est recevable uniquement si `lastCompletedTask=null` ou `lastCompletedTask=T00`. Il devient obligatoire lorsque `lastCompletedTask=T01` ou toute étape ultérieure, reste UTC strict et ne dépasse pas `runEndedAtUtc`.
- `expectedBusinessEventCount` est toujours l'entier `15`.
- `missingExpectedBusinessEventCount` est un entier de `0` à `15`.
- `unexpectedBusinessEventCount` est un entier supérieur ou égal à `0`.
- Les compteurs proviennent d'un dernier snapshot audit read-only effectué avant la suppression de la DB, y compris en cas d'abort précoce.
- Aucun ID métier, identité, chemin, URL, SQL brut, message externe ou secret n'est admis.

`COMPLETED` exige `lastCompletedTask=T14`, `abortReasonCode=null` et les compteurs `15/0/0`.

`ABORTED` exige `lastCompletedTask=null|T00|...|T13` et un `abortReasonCode` parmi `HARD_STOP`, `OPERATOR_INTERRUPTION`, `ENVIRONMENT_FAILURE`, `PROTOCOL_DEVIATION`, `EVIDENCE_INCOMPLETE`. Même si ses compteurs factuels sont `15/0/0`, un résumé `ABORTED` ne devient jamais un succès métier.

T00 ne constitue jamais un run métier complet.

`evidenceSha256` en S7 est le SHA-256 des octets exacts du résumé R1. Pour S10 et les terminaux issus de S10, il est le SHA-256 des octets UTF-8/LF exacts de l'index suivant, avec LF terminal :

```text
R1=<sha256-r1-lowercase>
R2=<sha256-r2-lowercase>
```

## 5. Cibles de ressources exactes

| Ressource | R1 | R2 |
| --- | --- | --- |
| Base | `ritomer_043c_r1` | `ritomer_043c_r2` |
| Rôle login | `ritomer_043c_r1_runner` | `ritomer_043c_r2_runner` |
| Storage relatif | `runtime/R1/storage` | `runtime/R2/storage` |

Chaque storage se résout exclusivement sous la racine locale contrôlée. Il ne peut être la racine du repo, une racine disque, un parent, un lien/reparse point ou une cible voisine.

La chaîne inspectée contient exactement, dans cet ordre, `LocalApplicationData`, `Ritomer`, `043c`, `043c-internal-rehearsal-v1`, `runtime`, `R1|R2`, `storage`. Chaque composant existant doit être le répertoire canonique exact sous son parent autorisé, ne porter aucun attribut `ReparsePoint` et ne sortir d'aucun parent ni de la racine approuvée. Un storage absent vaut `ABSENT` seulement si la racine `LocalApplicationData` existe et si tous ses parents existants sont des répertoires canoniques sûrs ; un parent fichier, junction, symlink, reparse point, inaccessible ou résolu hors parent produit `OTHER`.

`resourceTargetSha256` est calculé sur exactement 180 octets UTF-8 sans BOM, LF-only, avec les lignes dans cet ordre et un LF terminal.

R1 :

```text
schemaVersion=1
run=R1
jdbcUrl=jdbc:postgresql://127.0.0.1:5432/ritomer_043c_r1
databaseName=ritomer_043c_r1
roleName=ritomer_043c_r1_runner
storageRelativePath=runtime/R1/storage
```

SHA-256 R1 : `318de7101897fd534aa91fed72243fbfb29e78ac5951c57dccf09251b4d7b3b8`.

R2 :

```text
schemaVersion=1
run=R2
jdbcUrl=jdbc:postgresql://127.0.0.1:5432/ritomer_043c_r2
databaseName=ritomer_043c_r2
roleName=ritomer_043c_r2_runner
storageRelativePath=runtime/R2/storage
```

SHA-256 R2 : `dfc660e524eb9d91f7ee8f6e4d9273cac36c1c92d3595e285ba0afda8f78e2ef`.

La preuve catalogue cluster-level recevable exige, pour chaque runner exact : base et rôle présents, owner de base égal au runner, `rolcanlogin=true`, `rolsuper=false`, `rolcreatedb=false`, `rolcreaterole=false`, `rolreplication=false`, `rolbypassrls=false` et `explicit_membership_count=0`. Le compte de membership couvre sans exception tout rôle directement accordé au runner, y compris les rôles prédéfinis. L'adresse serveur est exactement IPv4 loopback `127.0.0.1`, port `5432`. Le storage `PRESENT_EMPTY_SAFE` existe, est vide et toute sa chaîne est sûre. Une ressource absente signifie que son nom exact n'existe pas sous une chaîne parente sûre ; une cible voisine ne satisfait jamais la preuve.

Cette preuve retourne seulement `ABSENT`, `CLUSTER_LEVEL_PRESENT` ou `OTHER`. Elle ne prouve ni Flyway, ni seed, ni identité applicative, ni état métier. `PreR1` et `PreR2` exigent séparément `ApplicationReadiness=EXACT_STATE_PROVEN`. Le repo ne norme actuellement aucun état applicatif post-provisionnement exact et l'adapter fixe donc `ApplicationReadiness=NOT_PROVEN` : les deux modes restent fail-closed. Les débloquer exigera une preuve read-only séparée, une modification gouvernée du protocole, un nouveau hash, un nouveau gel et les nouvelles revues prévues.

### Canal unique d'authentification catalogue

Le seul canal autorisé est PostgreSQL 17 local sur Windows via SSPI explicitement configuré et contrôlé par l'opérateur hors repo :

- rôle catalogue fixe `ritomer_043c_catalog_reader`, LOGIN, non superuser, sans CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS ni membership explicite ;
- mapping `pg_ident.conf` explicite et règle `pg_hba.conf` loopback SSPI avec realm conservé ; le principal Windows réel n'entre jamais dans Git, un argument, un log ou un artefact ;
- conninfo fermé `host=localhost hostaddr=127.0.0.1 port=5432 dbname=postgres user=ritomer_043c_catalog_reader require_auth=sspi connect_timeout=5` ;
- `psql -X --no-password` et environnement enfant nettoyé ; aucun password, passfile, service, trust, SCRAM ou fallback d'authentification n'est admis ;
- la ligne `AUTH` du résultat vérifie `current_database=postgres`, `current_user=session_user=ritomer_043c_catalog_reader`, `inet_server_addr=127.0.0.1` et `inet_server_port=5432`.

`require_auth=sspi` fait échouer la connexion si le serveur n'effectue pas SSPI. Un client libpq qui ne comprend pas ce paramètre échoue sans downgrade. Le rôle catalogue est une identité de contrôle survivante, pas une ressource R1/R2 et pas un ajout aux descripteurs de 180 octets. Le validateur n'invente, ne lit et ne transporte aucun credential.

## 6. Validateur read-only

Commande unique :

```powershell
.\runbooks\validate-controlled-fiduciary-pilot-043c-state.ps1 -Mode <mode-exact>
```

Les six modes exacts sont :

1. `SelfTest`
2. `PreparationPreflight`
3. `PreR1`
4. `PostR1Cleanup`
5. `PreR2`
6. `PostR2Cleanup`

Aucun autre mode, paramètre ou argument n'existe.

Le validateur :

- n'écrit aucun fichier, état, autorisation, preuve ou ressource ;
- ne modifie jamais Git ;
- ne lit aucun `.env` ni aucune valeur de secret ;
- n'imprime aucun credential, chemin local, ID métier, metadata brute, SQL, stdout/stderr externe ou message d'exception ;
- limite les accès PostgreSQL à des requêtes `SELECT` catalogues fermées choisies par identifiant interne ;
- utilise une connexion de contrôle survivante pour prouver l'absence après cleanup ; une connexion impossible vaut FAIL fermé, jamais preuve d'absence ;
- tamponne toutes ses sorties et n'imprime aucune ligne contenant `PASS` si une erreur existe ;
- sort non-zéro sur toute erreur.

Sémantique :

- `SelfTest` : noyau intégralement en mémoire ; aucun fichier, Git, DB, réseau, storage, processus externe ou écriture.
- `PreparationPreflight` : durable S4, aucun état/autorisation local actif, protocole et commit gelés, historique post-gel exclusivement append-only, Git propre sans flag d'index masquant le worktree, six ressources absentes.
- `PreR1` : durable S4 + local S5 + décision R1_ONLY cohérente ; R1 `CLUSTER_LEVEL_PRESENT`, R2 absente et `ApplicationReadiness=EXACT_STATE_PROVEN` obligatoire. Dans la version courante, `ApplicationReadiness=NOT_PROVEN` bloque volontairement ce mode.
- `PostR1Cleanup` : durable S4 + local S6 + preuve R1 sanitizée recevable ; les six ressources sont absentes.
- `PreR2` : durable S7 avec `completedRun=R1`, R1 `COMPLETED` et `15/0/0`, local S8 + décision R2_ONLY cohérente ; R1 absente ; R2 `CLUSTER_LEVEL_PRESENT` et `ApplicationReadiness=EXACT_STATE_PROVEN` obligatoire ; protocol/hash/commit identiques à R1. Dans la version courante, `ApplicationReadiness=NOT_PROVEN` bloque volontairement ce mode.
- `POST_R2_COMPLETE_R1_PRECONDITION=REQUIRED`.
- `PostR2Cleanup` : exige cumulativement durable S7, local S9, bindings valides, preuves R1/R2 recevables, `completedRun=R1`, R1 `COMPLETED`, compteurs R1 `missing=0` et `unexpected=0`, puis les six ressources absentes. Un R1 `ABORTED` ou incomplet est rejeté même si un état local falsifié annonce S9.
- R2 lui-même peut être `COMPLETED` ou `ABORTED`, et son cleanup peut donc produire `CLEANUP_VERIFIED_RUN_COMPLETE` ou `CLEANUP_VERIFIED_RUN_ABORTED`; R2 n'existe légitimement qu'après un R1 complet.

Un mode sélectionne des assertions. Il ne prouve jamais seul un état et ne produit aucune transition.

## 7. CHECK_POST_R1 et CHECK_POST_R2 — dispositions de cleanup

`CHECK_POST_R1` appelle le mode read-only `PostR1Cleanup`; `CHECK_POST_R2` appelle le mode read-only `PostR2Cleanup`. Ces checks réussis retournent exactement l'une des dispositions :

- `CLEANUP_VERIFIED_RUN_COMPLETE`
- `CLEANUP_VERIFIED_RUN_ABORTED`

Tout autre résultat est FAIL.

`CLEANUP_VERIFIED_RUN_COMPLETE` exige T00–T14 terminés, audit `15/0/0`, preuves métier complètes/scellées et ressources exactes absentes.

`CLEANUP_VERIFIED_RUN_ABORTED` exige une stop condition ou interruption enregistrée, la dernière étape atteinte connue, une preuve sanitizée/hashée, aucune prétention de réussite métier et les ressources exactes absentes.

Après R1 :

- disposition COMPLETE : S7 porte `completedRun=R1` ;
- disposition ABORTED : S7 porte `completedRun=null` ;
- un R1 incomplet interdit S8 mais permet à la CPO de décider F2/F3.

Après R2 :

- disposition COMPLETE : S10 porte `completedRun=R2` ;
- disposition ABORTED : S10 porte `completedRun=R1` ;
- un R2 interrompu interdit F1 mais permet F2/F3.

Si T15 est interrompu, l'état reste S6 ou S9. Aucun checkpoint durable et aucun terminal n'est écrit. L'opérateur reprend le même T15, sous le même run et la même autorisation ; ce n'est ni un nouveau run ni un second T15 métier. Tant que le cleanup n'est pas vérifié, le protocole reste `CLEANUP_PENDING`.

## 8. CHECK_FINAL_CPO

`CHECK_FINAL_CPO` est une décision humaine distincte. Il n'a aucun numéro Txx, n'est pas T15, n'est aucun mode du validateur et n'est exécuté ni par le checker, ni par la CI, ni automatiquement.

Depuis S7, il peut produire seulement F2 ou F3. Depuis S10, il peut produire F1, F2 ou F3 selon les prédicats fermés. L'absence de décision laisse l'état en S7 ou S10 ; elle ne produit jamais automatiquement F3.

F1 est seulement une autorisation de soumettre le dossier à une future revue des gates externes. Il n'autorise ni invitation, ni collecte, ni donnée réelle, ni production, ni livrable statutaire, ni spec suivante.

## 9. Parcours T00–T15

T00–T14 constituent seuls le parcours métier. T15 appartient exclusivement au CHECK_POST du run. Un run dont T00–T14 sont terminés reste `CLEANUP_PENDING` tant que T15 n'est pas vérifié.

| Tâche | Contenu exact |
| --- | --- |
| T00 | Vérifier l'état, l'autorisation propre au run, protocolId, protocolSha256, frozenCommit et resourceTargetSha256. |
| T01 | Ouvrir le run local, générer runId et capturer `run_start_utc`; seed, provisionnement et preflight sont déjà terminés. |
| T02 | Vérifier les fixtures gelées : balance 359 octets/SHA-256 `2295b620704c2cfcdf1e37660388bd84a1d261c0b7697edf5bce21d0c04f9855`; preuve 184 octets/SHA-256 `f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27`. |
| T03 | Vérifier les contextes ACCOUNTANT et REVIEWER et leur tenant commun via une lecture non auditante, notamment `/api/me`, sans sélection explicite `X-Tenant-Id`; toute émission audit identité dans la fenêtre fait échouer T14. |
| T04 | Créer un nouveau dossier synthétique avec les constantes fermées ci-dessous et capturer `closing_folder_id`. |
| T05 | Importer `balance-fy2025-v1.csv`, capturer l'import v1 et confirmer 7 lignes, débits/crédits `149000.00`. |
| T06 | Créer exactement les sept mappings fermés et capturer leurs IDs. |
| T07 | Lire readiness, contrôles, synthèses et previews canoniques ; les GET ne doivent produire aucun audit. |
| T08 | Créer le workpaper `BS.ASSET.CURRENT_SECTION`, statut DRAFT, note `Synthetic bank reconciliation FY2025.`. |
| T09 | Uploader la preuve CSV avec ses metadata gelées et capturer `document_id`. |
| T10 | Passer le workpaper à `READY_FOR_REVIEW`. |
| T11 | Effectuer le handoff vers le contexte REVIEWER déjà validé, sans mutation ni audit supplémentaire. |
| T12 | Passer le document de `UNVERIFIED` à `VERIFIED`. |
| T13 | Passer le workpaper de `READY_FOR_REVIEW` à `REVIEWED`. |
| T14 | Créer l'export pack, vérifier annexe/utilité, capturer `run_end_utc`, exécuter le contrôle audit et sceller la preuve sanitizée. Le run devient uniquement `CLEANUP_PENDING`. |
| T15 | Arrêter le runtime, faire supprimer par l'opérateur les ressources exactes du run, puis lancer la validation read-only du cleanup. |

Constantes T04 :

| Run | name | periodStartOn | periodEndOn | externalRef |
| --- | --- | --- | --- | --- |
| R1 | `Demo Closing FY2025 043c R1 internal rehearsal (synthetic)` | `2025-01-01` | `2025-12-31` | `DEMO-043C-R1-INTERNAL-REHEARSAL` |
| R2 | `Demo Closing FY2025 043c R2 internal rehearsal (synthetic)` | `2025-01-01` | `2025-12-31` | `DEMO-043C-R2-INTERNAL-REHEARSAL` |

Mappings T06 :

| Compte | Cible exacte |
| --- | --- |
| `1000` | `BS.ASSET.CASH_AND_EQUIVALENTS` |
| `1100` | `BS.ASSET.TRADE_RECEIVABLES` |
| `1200` | `BS.ASSET.PREPAIDS_AND_OTHER_CURRENT` |
| `2000` | `BS.LIABILITY.TRADE_PAYABLES` |
| `2800` | `BS.EQUITY.RETAINED_EARNINGS` |
| `3000` | `PL.REVENUE.OPERATING_REVENUE` |
| `4000` | `PL.EXPENSE.OTHER_OPERATING_EXPENSES` |

## 10. Matrice audit exacte

La matrice s'applique séparément à R1 et R2 :

| Slot(s) | Action exacte | Nombre | Acteur/rôle exact |
| --- | --- | ---: | --- |
| 1 | `CLOSING_FOLDER.CREATED` | 1 | ACCOUNTANT / `["ACCOUNTANT"]` |
| 2 | `BALANCE_IMPORT.CREATED` | 1 | ACCOUNTANT / `["ACCOUNTANT"]` |
| 3–9 | `MANUAL_MAPPING.CREATED` | 7 | ACCOUNTANT / `["ACCOUNTANT"]` |
| 10 | `WORKPAPER.CREATED` | 1 | ACCOUNTANT / `["ACCOUNTANT"]` |
| 11 | `DOCUMENT.CREATED` | 1 | ACCOUNTANT / `["ACCOUNTANT"]` |
| 12 | `WORKPAPER.UPDATED` | 1 | ACCOUNTANT / `["ACCOUNTANT"]` |
| 13 | `DOCUMENT.VERIFICATION_UPDATED` | 1 | REVIEWER / `["REVIEWER"]` |
| 14 | `WORKPAPER.REVIEW_STATUS_CHANGED` | 1 | REVIEWER / `["REVIEWER"]` |
| 15 | `EXPORT_PACK.CREATED` | 1 | ACCOUNTANT / `["ACCOUNTANT"]` |

Résultat nominal obligatoire : `expectedBusinessEventCount=15`, `missingExpectedBusinessEventCount=0`, `unexpectedBusinessEventCount=0`.

Le prédicat exact de `CLOSING_FOLDER.CREATED` est :

```sql
ae.tenant_id = p.tenant_id
AND ae.actor_user_id = p.accountant_user_id
AND ae.actor_subject = p.accountant_subject
AND ae.actor_roles = '["ACCOUNTANT"]'::jsonb
AND ae.action = 'CLOSING_FOLDER.CREATED'
AND ae.resource_type = 'CLOSING_FOLDER'
AND ae.resource_id = p.closing_folder_id
AND ae.request_id IS NOT NULL
AND btrim(ae.request_id) <> ''
AND ae.metadata = jsonb_build_object(
  'snapshot', jsonb_build_object(
    'name', p.closing_folder_name,
    'periodStartOn', p.closing_folder_period_start_on::text,
    'periodEndOn', p.closing_folder_period_end_on::text,
    'externalRef', p.closing_folder_external_ref,
    'status', 'DRAFT'
  )
)
```

La requête multiensemble T14 ci-dessous est canonique. `candidates` matérialise toutes les lignes de la fenêtre UTC, sans préfiltre tenant, dossier, acteur, action ou type. Le seed, le provisionnement et le preflight précèdent obligatoirement `run_start_utc`.

```sql
WITH p AS (
  SELECT
    :'run_start_utc'::timestamptz AS run_start_utc,
    :'run_end_utc'::timestamptz AS run_end_utc,
    :'tenant_id'::uuid AS tenant_id,
    :'closing_folder_id'::text AS closing_folder_id,
    :'closing_folder_name'::text AS closing_folder_name,
    :'closing_folder_period_start_on'::date AS closing_folder_period_start_on,
    :'closing_folder_period_end_on'::date AS closing_folder_period_end_on,
    :'closing_folder_external_ref'::text AS closing_folder_external_ref,
    :'accountant_user_id'::uuid AS accountant_user_id,
    :'accountant_subject'::text AS accountant_subject,
    :'reviewer_user_id'::uuid AS reviewer_user_id,
    :'reviewer_subject'::text AS reviewer_subject,
    :'balance_import_id'::text AS balance_import_id,
    :'mapping_1000_id'::text AS mapping_1000_id,
    :'mapping_1100_id'::text AS mapping_1100_id,
    :'mapping_1200_id'::text AS mapping_1200_id,
    :'mapping_2000_id'::text AS mapping_2000_id,
    :'mapping_2800_id'::text AS mapping_2800_id,
    :'mapping_3000_id'::text AS mapping_3000_id,
    :'mapping_4000_id'::text AS mapping_4000_id,
    :'workpaper_id'::text AS workpaper_id,
    :'document_id'::text AS document_id,
    :'export_pack_id'::text AS export_pack_id
),
expected (
  slot,
  action,
  resource_type,
  resource_id,
  actor_user_id,
  actor_subject,
  actor_roles,
  metadata_kind,
  account_code,
  target_code
) AS (
  SELECT v.*
  FROM p
  CROSS JOIN LATERAL (
    VALUES
      (1,  'CLOSING_FOLDER.CREATED',         'CLOSING_FOLDER', p.closing_folder_id, p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'CLOSING_FOLDER',     NULL,   NULL),
      (2,  'BALANCE_IMPORT.CREATED',          'BALANCE_IMPORT', p.balance_import_id, p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'BALANCE_IMPORT',      NULL,   NULL),
      (3,  'MANUAL_MAPPING.CREATED',          'MANUAL_MAPPING', p.mapping_1000_id,   p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'MANUAL_MAPPING',      '1000', 'BS.ASSET.CASH_AND_EQUIVALENTS'),
      (4,  'MANUAL_MAPPING.CREATED',          'MANUAL_MAPPING', p.mapping_1100_id,   p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'MANUAL_MAPPING',      '1100', 'BS.ASSET.TRADE_RECEIVABLES'),
      (5,  'MANUAL_MAPPING.CREATED',          'MANUAL_MAPPING', p.mapping_1200_id,   p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'MANUAL_MAPPING',      '1200', 'BS.ASSET.PREPAIDS_AND_OTHER_CURRENT'),
      (6,  'MANUAL_MAPPING.CREATED',          'MANUAL_MAPPING', p.mapping_2000_id,   p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'MANUAL_MAPPING',      '2000', 'BS.LIABILITY.TRADE_PAYABLES'),
      (7,  'MANUAL_MAPPING.CREATED',          'MANUAL_MAPPING', p.mapping_2800_id,   p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'MANUAL_MAPPING',      '2800', 'BS.EQUITY.RETAINED_EARNINGS'),
      (8,  'MANUAL_MAPPING.CREATED',          'MANUAL_MAPPING', p.mapping_3000_id,   p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'MANUAL_MAPPING',      '3000', 'PL.REVENUE.OPERATING_REVENUE'),
      (9,  'MANUAL_MAPPING.CREATED',          'MANUAL_MAPPING', p.mapping_4000_id,   p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'MANUAL_MAPPING',      '4000', 'PL.EXPENSE.OTHER_OPERATING_EXPENSES'),
      (10, 'WORKPAPER.CREATED',               'WORKPAPER',      p.workpaper_id,      p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'WORKPAPER_CREATED',   NULL,   NULL),
      (11, 'DOCUMENT.CREATED',                'DOCUMENT',       p.document_id,       p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'DOCUMENT_CREATED',    NULL,   NULL),
      (12, 'WORKPAPER.UPDATED',               'WORKPAPER',      p.workpaper_id,      p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'WORKPAPER_UPDATED',   NULL,   NULL),
      (13, 'DOCUMENT.VERIFICATION_UPDATED',   'DOCUMENT',       p.document_id,       p.reviewer_user_id,   p.reviewer_subject,   jsonb_build_array('REVIEWER'),   'DOCUMENT_VERIFIED',   NULL,   NULL),
      (14, 'WORKPAPER.REVIEW_STATUS_CHANGED', 'WORKPAPER',      p.workpaper_id,      p.reviewer_user_id,   p.reviewer_subject,   jsonb_build_array('REVIEWER'),   'WORKPAPER_REVIEWED',  NULL,   NULL),
      (15, 'EXPORT_PACK.CREATED',             'EXPORT_PACK',    p.export_pack_id,    p.accountant_user_id, p.accountant_subject, jsonb_build_array('ACCOUNTANT'), 'EXPORT_PACK_CREATED', NULL,   NULL)
  ) AS v(
    slot,
    action,
    resource_type,
    resource_id,
    actor_user_id,
    actor_subject,
    actor_roles,
    metadata_kind,
    account_code,
    target_code
  )
),
candidates AS MATERIALIZED (
  SELECT ae.*
  FROM audit_event ae
  CROSS JOIN p
  WHERE ae.occurred_at >= p.run_start_utc
    AND ae.occurred_at < p.run_end_utc
),
match_counts AS (
  SELECT
    c.id,
    count(e.slot)::integer AS match_count,
    min(e.slot)::integer AS expected_slot
  FROM candidates c
  CROSS JOIN p
  LEFT JOIN expected e
    ON c.tenant_id = p.tenant_id
   AND c.actor_user_id = e.actor_user_id
   AND c.actor_subject = e.actor_subject
   AND c.actor_roles = e.actor_roles
   AND c.action = e.action
   AND c.resource_type = e.resource_type
   AND c.resource_id = e.resource_id
   AND c.request_id IS NOT NULL
   AND btrim(c.request_id) <> ''
   AND CASE e.metadata_kind
     WHEN 'CLOSING_FOLDER' THEN
       c.metadata = jsonb_build_object(
         'snapshot', jsonb_build_object(
           'name', p.closing_folder_name,
           'periodStartOn', p.closing_folder_period_start_on::text,
           'periodEndOn', p.closing_folder_period_end_on::text,
           'externalRef', p.closing_folder_external_ref,
           'status', 'DRAFT'
         )
       )
     WHEN 'BALANCE_IMPORT' THEN
       c.metadata = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'importId', p.balance_import_id,
         'version', 1,
         'fileName', 'balance-fy2025-v1.csv',
         'rowCount', 7,
         'totalDebit', '149000.00',
         'totalCredit', '149000.00',
         'diffSummary', jsonb_build_object(
           'previousVersion', NULL,
           'addedCount', 7,
           'removedCount', 0,
           'changedCount', 0
         )
       )
     WHEN 'MANUAL_MAPPING' THEN
       c.metadata = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'accountCode', e.account_code,
         'targetCode', jsonb_build_object(
           'before', NULL,
           'after', e.target_code
         ),
         'latestImportVersion', 1
       )
     WHEN 'WORKPAPER_CREATED' THEN
       c.metadata = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'anchorCode', 'BS.ASSET.CURRENT_SECTION',
         'status', 'DRAFT',
         'basisImportVersion', 1,
         'basisTaxonomyVersion', 2,
         'evidenceCount', 0
       )
     WHEN 'DOCUMENT_CREATED' THEN
       c.metadata = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'workpaperId', p.workpaper_id,
         'anchorCode', 'BS.ASSET.CURRENT_SECTION',
         'fileName', 'evidence-bank-reconciliation-fy2025-v1.csv',
         'mediaType', 'text/csv',
         'byteSize', 184,
         'checksumSha256', 'f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27',
         'sourceLabel', 'Ritomer internal synthetic fixture 043',
         'documentDate', '2025-12-31',
         'storageBackend', 'LOCAL_FS'
       )
     WHEN 'WORKPAPER_UPDATED' THEN
       c.metadata = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'anchorCode', 'BS.ASSET.CURRENT_SECTION',
         'status', jsonb_build_object(
           'before', 'DRAFT',
           'after', 'READY_FOR_REVIEW'
         ),
         'noteText', jsonb_build_object(
           'before', 'Synthetic bank reconciliation FY2025.',
           'after', 'Synthetic bank reconciliation FY2025.'
         ),
         'basisImportVersion', jsonb_build_object(
           'before', 1,
           'after', 1
         ),
         'basisTaxonomyVersion', jsonb_build_object(
           'before', 2,
           'after', 2
         ),
         'evidenceCount', jsonb_build_object(
           'before', 0,
           'after', 0
         )
       )
     WHEN 'DOCUMENT_VERIFIED' THEN
       (c.metadata - 'reviewedAt') = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'workpaperId', p.workpaper_id,
         'anchorCode', 'BS.ASSET.CURRENT_SECTION',
         'verificationStatus', jsonb_build_object(
           'before', 'UNVERIFIED',
           'after', 'VERIFIED'
         ),
         'reviewComment', jsonb_build_object(
           'before', NULL,
           'after', NULL
         ),
         'reviewedByUserId', p.reviewer_user_id::text
       )
       AND CASE
         WHEN pg_input_is_valid(
           c.metadata ->> 'reviewedAt',
           'timestamp with time zone'
         ) THEN
           (c.metadata ->> 'reviewedAt')::timestamptz >= p.run_start_utc
           AND (c.metadata ->> 'reviewedAt')::timestamptz < p.run_end_utc
         ELSE FALSE
       END
     WHEN 'WORKPAPER_REVIEWED' THEN
       (c.metadata - 'reviewedAt') = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'anchorCode', 'BS.ASSET.CURRENT_SECTION',
         'status', jsonb_build_object(
           'before', 'READY_FOR_REVIEW',
           'after', 'REVIEWED'
         ),
         'reviewComment', jsonb_build_object(
           'before', NULL,
           'after', NULL
         ),
         'reviewedByUserId', p.reviewer_user_id::text
       )
       AND CASE
         WHEN pg_input_is_valid(
           c.metadata ->> 'reviewedAt',
           'timestamp with time zone'
         ) THEN
           (c.metadata ->> 'reviewedAt')::timestamptz >= p.run_start_utc
           AND (c.metadata ->> 'reviewedAt')::timestamptz < p.run_end_utc
         ELSE FALSE
       END
     WHEN 'EXPORT_PACK_CREATED' THEN
       c.metadata = jsonb_build_object(
         'closingFolderId', p.closing_folder_id,
         'basisImportVersion', 1,
         'basisTaxonomyVersion', 2
       )
     ELSE FALSE
   END
  GROUP BY c.id
),
single_match_occurrences AS (
  SELECT
    m.id,
    row_number() OVER (
      PARTITION BY m.expected_slot
      ORDER BY c.occurred_at, c.id
    ) AS expected_occurrence
  FROM match_counts m
  JOIN candidates c USING (id)
  WHERE m.match_count = 1
),
ranked AS (
  SELECT
    m.id,
    m.match_count,
    m.expected_slot,
    s.expected_occurrence
  FROM match_counts m
  LEFT JOIN single_match_occurrences s USING (id)
),
matched_slots AS (
  SELECT DISTINCT expected_slot AS slot
  FROM ranked
  WHERE match_count = 1
    AND expected_occurrence = 1
)
SELECT
  (SELECT count(*)::bigint FROM expected)
    AS "expectedBusinessEventCount",
  (
    SELECT count(*)::bigint
    FROM expected e
    LEFT JOIN matched_slots m ON m.slot = e.slot
    WHERE m.slot IS NULL
  ) AS "missingExpectedBusinessEventCount",
  (
    SELECT count(*)::bigint
    FROM ranked
    WHERE match_count <> 1
       OR expected_occurrence > 1
  ) AS "unexpectedBusinessEventCount";
```

Propriétés obligatoires :

- `SELECT v.*` n'inclut aucune colonne de `p` dans `expected`.
- Le rang est calculé uniquement pour `match_count=1`.
- Un doublon exact produit `unexpected=1`.
- Une absence compensée par le doublon d'un autre slot produit simultanément `missing>0` et `unexpected>0`.
- Aucun détail brut d'`audit_event`, ID, metadata ou timestamp n'est versé dans Git.

Probes en mémoire obligatoires :

| Probe | Résultat |
| --- | --- |
| 15 événements nominaux | `15/0/0` |
| `CLOSING_FOLDER.CREATED` absent | `15/1/0` |
| duplication exacte de `CLOSING_FOLDER.CREATED` | `15/0/1` |
| mauvais acteur | `15/1/1` |
| mauvais rôle | `15/1/1` |
| mauvais `resource_id` | `15/1/1` |
| mauvaise metadata snapshot | `15/1/1` |
| événement supplémentaire d'un troisième acteur | `15/0/1` |
| candidat ambigu/multi-match | `unexpected > 0` |
| événement seed, identité ou autre dans la fenêtre | `unexpected > 0` |

## 11. Early-stop fermé

Stop immédiat et aucune nouvelle transition si :

- protocole, hash, frozenCommit, autorisation, état local ou resourceTargetSha256 divergent ;
- fixture absente, modifiée ou non synthétique ;
- identité, membership, rôle ou tenant divergent ;
- une ressource exacte est absente avant le run, voisine, trop large, non-loopback, privilégiée ou déjà contaminée ;
- une ressource de l'autre run est présente ;
- une action non prévue, un audit d'identité, un candidat étranger ou une donnée réelle apparaît dans la fenêtre ;
- la matrice n'est pas exactement 15 ou `CLOSING_FOLDER.CREATED` manque ;
- le SQL est réduit, préfiltré ou ses metadata sont relâchées ;
- T00–T14 dévient, une preuve n'est pas scellée ou un secret risque d'être exposé ;
- cleanup et réussite métier sont confondus ;
- R1 incomplet tente S8, ou F1 est envisagé sans deux runs complets et deux audits `15/0/0` ;
- T15 interrompu tente de créer un checkpoint ou un terminal ;
- le checker ou le validateur tente une écriture ;
- une invitation, donnée réelle, production, spec suivante ou usage externe est demandé.

Seuls l'opérateur local écrit les autorisations/états locaux, provisionne et supprime les ressources. Seul le coordinateur autorisé peut proposer un checkpoint durable sur preuve recevable. Les décisions CPO et le CTO Gate restent humaines et explicites.
<!-- 043C_PROTOCOL_V1_END -->

## Confinement des artefacts locaux — SEC-043C-005

`LOCAL_ARTIFACT_PATH_CONFINEMENT=STORAGE_AND_FOUR_JSON_ARTIFACTS`

La règle de confinement fail-closed couvre le storage et les quatre artefacts locaux fermés suivants :

- `authorization.json` ;
- `state\active-state.json` ;
- `runs\R1\evidence-summary.json` ;
- `runs\R2\evidence-summary.json`.

Pour chacun, tous leurs parents existants depuis la racine `LocalApplicationData` approuvée et les fichiers finaux eux-mêmes doivent correspondre au chemin canonique exact attendu et rester confinés sous cette racine. Aucun parent ni fichier final ne peut être une junction, un symlink, un reparse point ou une résolution extérieure à la racine approuvée.

Une lecture est recevable seulement après une validation complète de la chaîne et du fichier final, puis une seconde validation identique après la lecture des octets. Tout changement d'état ou d'attribut entre ces deux observations fait échouer la lecture. Pour `PreparationPreflight`, l'absence des quatre artefacts est recevable seulement si toute chaîne parente existante est canonique, accessible et sûre ; un parent fichier, reparse, junction, symlink, inaccessible ou extérieur fait échouer le preflight, même si le fichier final est absent.

Cette clarification de sécurité ne modifie aucun mode, état, champ du ledger, transition, descripteur R1/R2, canal SSPI, règle `ApplicationReadiness`, tâche T00–T15 ou autorisation. Elle ne lance aucun mode externe.

## Conditions maintenues avant R1

`OPEN_BLOCKING_BEFORE_R1`

Les quatre sujets suivants restent ouverts et ne sont pas implémentés ni testés dans cette correction :

- validation des flags et memberships propres à `ritomer_043c_catalog_reader` ;
- limite maximale des quatre artefacts JSON avant tout `ReadAllBytes` ;
- smoke Windows réel UNC/junction/TOCTOU ;
- preuve cryptographique du contenu métier derrière `evidenceSha256`.

Ils ne bloquent ni cette correction ni un futur commit préparatoire, mais bloquent toute décision CPO `R1_ONLY`. Aucun smoke Windows réel n’est lancé ici.

## Checks préparatoires autorisés

La mission préparatoire peut exécuter uniquement :

```powershell
node --check evals/mapping/validate-042a2-human-review-governance-kit.mjs

$source = [System.IO.File]::ReadAllText(
  (Resolve-Path '.\runbooks\validate-controlled-fiduciary-pilot-043c-state.ps1'),
  [System.Text.Encoding]::UTF8
)
[void][scriptblock]::Create($source)

.\runbooks\validate-controlled-fiduciary-pilot-043c-state.ps1 -Mode SelfTest
.\fixtures\pilot\043\validate-043-pilot-fixtures.ps1
node evals/mapping/validate-042a2-human-review-governance-kit.mjs
git diff --check
git status --short --branch --untracked-files=all
```

Le profil historique `043c-preparation` reste `NOT_RUN_NO_COMMIT_BY_SCOPE` tant qu'aucun commit gelé n'existe. Gradle, pnpm, PostgreSQL/psql réel, Flyway, backend, Vite, navigateur, seed, smoke, R1 et R2 restent interdits pendant la préparation.
