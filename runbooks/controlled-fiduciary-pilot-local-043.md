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

`043c simplified rehearsal defined; execution not authorized; R1/R2 not started`. Tout futur run repartira des fixtures gelées `043a` avec des ressources locales fraîches et jetables, après une review pré-exécution et une autorisation sensible distincte propres au run.

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

# 043c - Répétition interne simplifiée T00-T15

## Statut et résultat exclusif

`043c simplified rehearsal defined; execution not authorized; R1/R2 not started`.

```text
043C_SIMPLIFIED_REHEARSAL_DEFINED
EXECUTION_NOT_AUTHORIZED
R1_NOT_STARTED
R2_NOT_STARTED
V1_AUTHORITY_RAIL_SUPERSEDED_NOT_EXECUTABLE
```

Le seul résultat recherché est :

```text
Prouver, sur données synthétiques gelées et ressources locales fraîches,
que le parcours T00–T15 peut être exécuté deux fois de manière contrôlée,
tenant-scoped, observable, mesurable et nettoyable, avant toute décision
d’accès à un gate externe.
```

Ce runbook documente le contrat opérationnel de l'orchestrateur minimal sélectionné. L'existence de ce code n'autorise aucune exécution, invitation, donnée réelle, cible non-loopback, production ou spec suivante.

## Limites fermées

```text
MAX_MAJOR_CYCLES_TOTAL=3
MAJOR_CYCLE_1=SIMPLIFICATION_IMPLEMENTATION_AND_DELIVERY
MAJOR_CYCLE_2=R1_SINGLE_ATTEMPT
MAJOR_CYCLE_3=R2_SINGLE_ATTEMPT
MAX_IMPLEMENTATION_HEADS=2
MAX_R1_ATTEMPTS=1
MAX_R2_ATTEMPTS=1
NO_FOURTH_CYCLE=YES
```

- R1 et R2 sont deux runs distincts avec une seule tentative chacun.
- Les rôles logiques sont `ACCOUNTANT` et `REVIEWER`, dans le même tenant exact.
- La simulation reste mono-opérateur-capable et ne prouve ni sessions humaines indépendantes ni séparation réelle des fonctions.
- Chaque run utilise des identités de ressources fraîches et jetables.
- L'ancien rail v1 est `HISTORICAL / SUPERSEDED / NOT_EXECUTABLE` et n'est ni sélectionnable ni requis ici.
- Le mécanisme sélectionné est plafonné aux quatre chemins exacts de la spec : les deux fichiers MJS, ce runbook et la spec active. Aucun cinquième chemin, backend, frontend, contrat, migration, dépendance, service, ledger, manifeste ou rail d'autorité n'en fait partie.
- Le package V3 reste `FORENSIC_ONLY / NOT_EXECUTED / SUPERSEDED_BY_SIMPLIFY_DECISION` ; son exécution, sa réutilisation, son rebase et tout usage comme autorité sont interdits.

## Interface future de l'orchestrateur minimal

L'interface possède exactement deux verbes : `propose`, strictement read-only, et `run`, chemin sensible futur. Le point d'entrée local câble uniquement le provider read-only de `propose`. Aucun provider sensible réel n'est câblé dans cette implémentation : un appel direct de `run` refuse avant lecture de secret ou I/O sensible avec le code stable `REAL_RUN_ADAPTERS_UNAVAILABLE`. La logique `run` est testée uniquement par injection d'adapters in-memory ; une review, une validation réelle et un provider sensible exact constitueraient un changement matériel avant toute autorisation.

```text
PROPOSE_COMMAND=PROPOSE_VERB
FRESH_RESOURCE_PROVISIONING_COMMAND=RUN_COMMAND / PHASE_PROVISION
RUNTIME_START_COMMAND=RUN_COMMAND / PHASE_RUNTIME
T00_T15_EXECUTION_COMMAND=RUN_COMMAND / PHASE_T00_T15
CLEANUP_COMMAND=RUN_COMMAND / PHASE_CLEANUP_OR_IDENTICAL_REENTRY
```

Une invocation `run` possède seule la chaîne indivisible `PHASE_PREFLIGHT → PHASE_PROVISION → PHASE_RUNTIME → PHASE_T00_T15 → PHASE_AUDIT → PHASE_EVIDENCE → PHASE_CLEANUP`. Aucune phase n'est sélectionnable séparément. Une réentrée portant un state exactement lié route uniquement vers `RECOVERY_CLEANUP_ONLY`, sans reprise métier. Il n'existe aucun flag `--phase`, `--force`, `--yes` ou `--ignore-*`.

Le working directory exact est la racine du repository. Les arguments PowerShell restent séparés, sans commande assemblée en chaîne, backtick ou `Invoke-Expression`. Le handoff R1 est distinct du handoff R2.

Le seul appel local actuellement câblé est la proposition read-only R1 ; sa sortie fournit directement le `runId`, le `proposalSha256` et le head à lier aux records futurs :

```powershell
$gitExe = (Get-Command git -CommandType Application -ErrorAction Stop).Source
$nodeExe = (Get-Command node -CommandType Application -ErrorAction Stop).Source
$repositoryRoot = (& $gitExe rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0) { throw 'REPOSITORY_ROOT_RESOLUTION_FAILED' }
$orchestrator = Join-Path $repositoryRoot 'runbooks\invoke-controlled-fiduciary-pilot-043c.mjs'
Push-Location -LiteralPath $repositoryRoot
try {
  $r1ProposalJson = (& $nodeExe $orchestrator propose --run R1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) { throw '043C_PROPOSE_R1_FAILED' }
  $r1Proposal = $r1ProposalJson | ConvertFrom-Json
  $r1RunId = [string]$r1Proposal.proposal.runId
  $r1ProposalSha256 = [string]$r1Proposal.proposalSha256
  $r1HeadSha = [string]$r1Proposal.proposal.head
} finally {
  Pop-Location
}
```

Après création et review séparées des records R1 exacts, chacun de leurs chemins locaux absolus et chacun de leurs hashes seraient transmis explicitement avec la proposition exacte. Le binding et le recovery-state n'en conservent que les SHA-256 de chemin non réversibles, jamais les chemins privés bruts. Le template contractuel futur ci-dessous n'est pas exécutable avec le provider read-only actuel et ne constitue aucune autorisation :

```powershell
$r1ReviewRecordPath = [Environment]::GetEnvironmentVariable('RITOMER_043C_PRE_EXECUTION_REVIEW_RECORD_PATH')
$r1AuthorizationRecordPath = [Environment]::GetEnvironmentVariable('RITOMER_043C_SENSITIVE_AUTHORIZATION_RECORD_PATH')
if ([string]::IsNullOrWhiteSpace($r1ReviewRecordPath) -or [string]::IsNullOrWhiteSpace($r1AuthorizationRecordPath)) { throw '043C_R1_RECORD_PATH_MISSING' }
$r1ReviewSha256 = (Get-FileHash -LiteralPath $r1ReviewRecordPath -Algorithm SHA256).Hash.ToLowerInvariant()
$r1AuthorizationSha256 = (Get-FileHash -LiteralPath $r1AuthorizationRecordPath -Algorithm SHA256).Hash.ToLowerInvariant()
& $nodeExe $orchestrator run --run R1 --run-id $r1RunId --tenant-id '036a0000-0000-4000-8000-000000000001' --environment 'LOCAL_SYNTHETIC_LOOPBACK' --proposal-sha256 $r1ProposalSha256 --pre-execution-review-record-path $r1ReviewRecordPath --pre-execution-review-sha256 $r1ReviewSha256 --sensitive-authorization-record-path $r1AuthorizationRecordPath --sensitive-authorization-sha256 $r1AuthorizationSha256 --repository 'Qamrito-90/ritomer' --head $r1HeadSha --protocol-version '1' --schema-version '043c-run-summary-v1'
if ($LASTEXITCODE -ne 0) { throw '043C_RUN_R1_FAILED_OR_NOT_AUTHORIZED' }
```

R2 ne peut être proposé qu'après preuve durable de R1 complet, audit `15/0/0`, cleanup complet et ressources R1 absentes. Il utilise un nouveau runId, une nouvelle proposition et des records distincts :

```powershell
$r2ProposalJson = (& $nodeExe $orchestrator propose --run R2 --prior-run-id $r1RunId | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw '043C_PROPOSE_R2_FAILED' }
$r2Proposal = $r2ProposalJson | ConvertFrom-Json
$r2RunId = [string]$r2Proposal.proposal.runId
$r2ProposalSha256 = [string]$r2Proposal.proposalSha256
$r2HeadSha = [string]$r2Proposal.proposal.head
$r2ReviewRecordPath = [Environment]::GetEnvironmentVariable('RITOMER_043C_PRE_EXECUTION_REVIEW_RECORD_PATH')
$r2AuthorizationRecordPath = [Environment]::GetEnvironmentVariable('RITOMER_043C_SENSITIVE_AUTHORIZATION_RECORD_PATH')
if ([string]::IsNullOrWhiteSpace($r2ReviewRecordPath) -or [string]::IsNullOrWhiteSpace($r2AuthorizationRecordPath)) { throw '043C_R2_RECORD_PATH_MISSING' }
$r2ReviewSha256 = (Get-FileHash -LiteralPath $r2ReviewRecordPath -Algorithm SHA256).Hash.ToLowerInvariant()
$r2AuthorizationSha256 = (Get-FileHash -LiteralPath $r2AuthorizationRecordPath -Algorithm SHA256).Hash.ToLowerInvariant()
& $nodeExe $orchestrator run --run R2 --run-id $r2RunId --prior-run-id $r1RunId --tenant-id '036a0000-0000-4000-8000-000000000001' --environment 'LOCAL_SYNTHETIC_LOOPBACK' --proposal-sha256 $r2ProposalSha256 --pre-execution-review-record-path $r2ReviewRecordPath --pre-execution-review-sha256 $r2ReviewSha256 --sensitive-authorization-record-path $r2AuthorizationRecordPath --sensitive-authorization-sha256 $r2AuthorizationSha256 --repository 'Qamrito-90/ritomer' --head $r2HeadSha --protocol-version '1' --schema-version '043c-run-summary-v1'
if ($LASTEXITCODE -ne 0) { throw '043C_RUN_R2_FAILED_OR_NOT_AUTHORIZED' }
```

Les seules variables locales futures sont nommées ci-dessous ; leurs valeurs ne sont jamais documentées, loguées ou copiées dans une preuve partageable :

```text
RITOMER_043C_PG_ADMIN_USER
RITOMER_043C_PG_ADMIN_PASSFILE
RITOMER_SECURITY_JWT_HMAC_SECRET
RITOMER_043C_PRE_EXECUTION_REVIEW_RECORD_PATH
RITOMER_043C_SENSITIVE_AUTHORIZATION_RECORD_PATH
```

Les branches de preflight sont exclusives :

- `INITIAL_RUN_PREFLIGHT` : aucun recovery-state valide ; DB, rôle, `runtimeRoot` et `evidenceRoot` dérivés absents ; ports `8080/5173/5174` libres ; toute présence est une collision qui n'est ni adoptée, ni mutée, ni supprimée.
- `RECOVERY_PREFLIGHT` : recovery-state canonique exactement lié au même orchestrateur, head, protocole, run, runId, priorRunId, tenant, binding et dérivations ; seul `RECOVERY_CLEANUP_ONLY` peut continuer. State absent, malformé, incomplet, étranger, divergent ou déjà nettoyé : refus sans mutation ni suppression.

## Checklist pré-exécution

Avant le premier geste T00 du run concerné, vérifier cumulativement :

1. une review IA technique indépendante, read-only, porte sur le head exact et le file-set exact ;
2. une validation séparée en environnement réel porte sur l'artefact, le head, l'environnement, les outils, les records et la commande exacts ;
3. une review courante `PRE_EXECUTION_REVIEW=PASS` est liée à ses octets canoniques, à son ID, au SHA-256 non réversible de son chemin exact, à son SHA-256 exact, au proposal/command binding canonique exact et à `environmentBindingSha256` ;
4. un `AUTHORIZATION_RECORD` sensible distinct, encore `YES`, run-scoped et non consommé est lié de la même manière au même proposal, à la même commande, aux mêmes run/`runId`/`priorRunId`, `tenantId`, environnement, repository, head et `environmentBindingSha256`, ainsi qu'aux `preExecutionReviewRecordId`, `preExecutionReviewPathSha256` et `preExecutionReviewSha256` exacts ;
5. le parsing canonique, les hashes des records, leur binding commun et la liaison autorisation→review concordent fail-closed ;
6. toutes les cibles réseau sont loopback-only et toutes les données sont synthetic-only ;
7. `ACCOUNTANT` et `REVIEWER` résolvent le même tenant exact ;
8. les identités et marqueurs des ressources fraîches et jetables sont fixés ;
9. `INITIAL_RUN_PREFLIGHT` ou `RECOVERY_PREFLIGHT`, jamais les deux, réussit ;
10. les deux fixtures gelées passent leur validation exacte ;
11. aucun secret, donnée réelle, participant externe ou doute cross-tenant n'apparaît.

Commande existante autorisée pour le point 10 :

```powershell
.\fixtures\pilot\043\validate-043-pilot-fixtures.ps1
```

Attendus exacts :

- `balance-fy2025-v1.csv` : 359 octets, SHA-256 `2295b620704c2cfcdf1e37660388bd84a1d261c0b7697edf5bce21d0c04f9855` ;
- `evidence-bank-reconciliation-fy2025-v1.csv` : 184 octets, SHA-256 `f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27`.

Tout échec avant la frontière ci-dessous est `PRE_EXECUTION_PREFLIGHT_FAILURE`. Il ne consomme aucune tentative, interdit T00 et impose une nouvelle review si une condition matérielle change. Le franchissement de T00 exige d'un futur provider sensible une seule opération critique all-or-none sur deux entrées séparées : la review courante et l'autorisation sensible encore `YES`, chacune liée à ses octets canoniques, à son ID, au SHA-256 non réversible de son chemin exact et à son SHA-256 exact. Les deux records portent les mêmes proposal, commande, run, `runId`, `priorRunId`, `tenantId`, environnement, repository, head et `environmentBindingSha256` ; l'autorisation porte en plus les `preExecutionReviewRecordId`, `preExecutionReviewPathSha256` et `preExecutionReviewSha256` exacts. Dans cette même opération, le provider relit la review à son chemin exact, compare ses octets byte-for-byte aux octets revus, recalcule son SHA-256, parse son schéma canonique, exige son `status=PASS` courant et revalide son tuple et son binding d'environnement ; il relit et consomme l'autorisation exacte encore `YES`, vérifie sa liaison à la review, persiste le recovery-state engagé et réclame le slot global dont l'identité canonique porte `repository`, `head`, `evidenceBaseSha256` et `runSlot` (`R1` ou `R2`). La preuve retournée doit être vérifiée par l'orchestrateur et répéter l'ID, le path hash, le SHA et le PASS courants de la review, les identités et hashes de l'autorisation consommée, le binding d'environnement, l'identité du slot global, le `runSlot` et `evidenceBaseSha256`. Toute divergence avant commit laisse T00 non engagé, l'autorisation non consommée et le slot non réclamé, avec zéro HTTP métier ; toute divergence de preuve après commit conserve la tentative et l'autorisation consommées et le slot réclamé, interdit tout HTTP métier et route seulement vers cleanup/recovery.

## Frontière exacte d'une tentative

```text
RUN_ATTEMPT_START
=
PRE_EXECUTION_REVIEW=PASS
AND
SENSITIVE_EXECUTION_AUTHORIZED=YES
  bound to the exact run, runId, tenantId, environment and command
AND
all run preflight checks are PASS
AND
fresh disposable resource identities are fixed and recorded
AND
the first T00 action is engaged.
```

À cette frontière, la review courante est encore `PASS` et sa preuve exacte est vérifiée, l'autorisation sensible exacte est consommée, le recovery-state est engagé et le slot global scopé est réclamé. Après cette frontière, tout échec, arrêt ou résultat incomplet consomme l'unique tentative du run. Aucun retry silencieux, reset opportuniste ou seconde tentative du même run n'est permis.

## Parcours T00-T15

Convention HTTP fermée : `ACCOUNTANT=http://127.0.0.1:5173`, `REVIEWER=http://127.0.0.1:5174`, tenant `036a0000-0000-4000-8000-000000000001`, `X-Request-Id=<runId>-<suffixe exact>`. L'orchestrateur n'ajoute jamais `Authorization`. Les requêtes JSON utilisent `Accept: application/json` et `Content-Type: application/json`. Les multiparts laissent `FormData` produire seul le `Content-Type`. T03 omet `X-Tenant-Id`. Le téléchargement T14 est l'unique exception `Accept: application/zip`.

| Tâche | Contrat et preuve minimale |
| --- | --- |
| T00 | Engagement atomique all-or-none : relecture et revalidation de la review courante exacte encore `PASS`, consommation de l'autorisation exacte liée, persistance du recovery-state engagé, réclamation du slot global scopé par `repository`/`head`/`evidenceBaseSha256`/`runSlot`, puis vérification de la preuve exacte ; aucun HTTP. |
| T01 | Confirmer DB, rôle, storage et processus frais, exacts, marqués et enregistrés. |
| T02 | Revalider la balance `359` octets / `2295b620…f9855` et la preuve `184` octets / `f5bb9a7e…39b27`. |
| T03 | GET ACCOUNTANT puis REVIEWER `/api/me`, suffixes `T03-ACCOUNTANT-ME` et `T03-REVIEWER-ME`, sans tenant header ; sujets, users, rôles singleton et tenant commun exacts. |
| T04 | ACCOUNTANT POST `/api/closing-folders`, suffixe `T04-CREATE-FOLDER`, dossier `043c <runId> synthetic FY2025`, période 2025, `externalRef=043c-<runId>` ; exiger `201`, UUID, tenant et `DRAFT`. |
| T05 | Multipart balance, suffixe `T05-IMPORT-BALANCE`, fichier gelé seul ; exiger `201`, version `1`, `rowCount=7`, débits/crédits API `"149000"`, diff `null/7/0/0`. |
| T06 | Sept PUT `/mappings/manual`, suffixes `T06-MAP-1000` à `T06-MAP-4000`, chacun strictement `201`, puis GET suffixe `T06-READ-MAPPINGS` ; taxonomy `2`, import `1`, lignes/mappings `7`, résumé `7/7/0`. |
| T07 | Quatre GET ACCOUNTANT avec suffixes exacts `T07-CONTROLS`, `T07-FINANCIAL-SUMMARY`, `T07-FINANCIAL-STATEMENTS`, `T07-WORKPAPERS` ; readiness `READY`, deux contrôles `PASS`, actifs `137000`, passifs `29000`, equity `30000`, résultat `78000`, revenus `90000`, charges `12000`, cinq anchors à workpaper nul. |
| T08 | PUT workpaper `BS.ASSET.CURRENT_SECTION`, suffixe `T08-CREATE-WORKPAPER`, note `Synthetic 043c bank reconciliation <runId>`, `DRAFT`, `evidences=[]` ; exiger `201`, basis `1/2`. |
| T09 | Multipart suffixe `T09-UPLOAD-DOCUMENT`, parties dans l'ordre fichier preuve, `sourceLabel=Ritomer internal synthetic fixture 043`, `documentDate=2025-12-31` ; exiger `201`, taille/hash exacts et `UNVERIFIED`. |
| T10 | Même PUT/note/evidences, suffixe `T10-READY-WORKPAPER`, `READY_FOR_REVIEW` ; exiger `200`, même ID et transition réelle depuis `DRAFT`. |
| T11 | REVIEWER GET workpapers, suffixe `T11-REVIEWER-WORKPAPERS` ; workpaper prêt, document `UNVERIFIED`, compteurs `5/1/1/0/0/4`, aucune mutation. |
| T12 | REVIEWER POST document verification, suffixe `T12-VERIFY-DOCUMENT`, body `VERIFIED/comment:null` ; même document, reviewer exact et transition réelle. |
| T13 | REVIEWER POST workpaper review, suffixe `T13-REVIEW-WORKPAPER`, body `REVIEWED/comment:null` ; même workpaper, document `VERIFIED`, reviewer exact et transition réelle. |
| T14 | ACCOUNTANT POST export, suffixe `T14-CREATE-EXPORT`, `Idempotency-Key=<runId>-T14-EXPORT`, strictement `201`, basis `1/2`; GET content suffixe `T14-DOWNLOAD-EXPORT`, ZIP/longueur/checksum, `Cache-Control: private, no-store`. Mesure fermée : `usefulnessScore` entier `1..5` et `observationCode` parmi `NO_FRICTION`, `MINOR_FRICTION`, `MAJOR_FRICTION`, `BLOCKING_FRICTION`, sans texte libre. |
| T15 | Snapshot audit, arrêt, conservation de l'export sanitizé, cleanup exact, absences, résumé final et SHA-256. |

Mappings exacts :

```text
1000 -> BS.ASSET.CASH_AND_EQUIVALENTS
1100 -> BS.ASSET.TRADE_RECEIVABLES
1200 -> BS.ASSET.PREPAIDS_AND_OTHER_CURRENT
2000 -> BS.LIABILITY.TRADE_PAYABLES
2800 -> BS.EQUITY.RETAINED_EARNINGS
3000 -> PL.REVENUE.OPERATING_REVENUE
4000 -> PL.EXPENSE.OTHER_OPERATING_EXPENSES
```

R1 doit atteindre T15, produire son résumé hashé et terminer son cleanup avant que R2 puisse devenir éligible.

## Audit exact

| Slot(s) | Action | Nombre | Rôle logique |
| --- | --- | ---: | --- |
| 1 | `CLOSING_FOLDER.CREATED` | 1 | `ACCOUNTANT` |
| 2 | `BALANCE_IMPORT.CREATED` | 1 | `ACCOUNTANT` |
| 3-9 | `MANUAL_MAPPING.CREATED` | 7 | `ACCOUNTANT` |
| 10 | `WORKPAPER.CREATED` | 1 | `ACCOUNTANT` |
| 11 | `DOCUMENT.CREATED` | 1 | `ACCOUNTANT` |
| 12 | `WORKPAPER.UPDATED` | 1 | `ACCOUNTANT` |
| 13 | `DOCUMENT.VERIFICATION_UPDATED` | 1 | `REVIEWER` |
| 14 | `WORKPAPER.REVIEW_STATUS_CHANGED` | 1 | `REVIEWER` |
| 15 | `EXPORT_PACK.CREATED` | 1 | `ACCOUNTANT` |

Résultat nominal obligatoire : `15 expected / 0 missing / 0 unexpected`.

La comparaison est un multiset équivalent à `EXCEPT ALL`, jamais un count ou un set. Elle couvre tenant, user, subject, rôle singleton, request ID, action, type et identité de ressource. Les sept UUID de mapping sont normalisés uniquement après jointure read-only exacte avec `manual_mapping`, le folder, le tenant, l'account et la target. Le filtre couvre tout le namespace `<runId>-` sans préfiltrage tenant : doublon, parasite, mauvais tenant, mauvais acteur, mauvais couple request/action ou ressource étrangère devient `unexpected`.

Sortie nominale fermée : `15 expected / 0 missing / 0 unexpected / 15 actual / PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED`. Toute autre sortie rend le run incomplet.

## Résumé de preuve et mesure d'utilité

Chaque run produit hors Git uniquement :

```text
evidenceRoot/
  recovery-state.json
  export-pack.zip
  run-summary.json
  run-summary.json.sha256
```

L'ordre top-level du résumé est fermé :

```text
schemaVersion
protocolId
run
runId
tenantId
environment
commandEvidence
reviewEvidence
authorizationEvidence
resources
actors
fixtures
runAttempt
tasks
audit
export
usefulness
cleanup
status
failureCode
startedAtUtc
endedAtUtc
```

Le JSON compact UTF-8 sans BOM porte un seul LF final, des timestamps UTC à la milliseconde, les tâches T00–T15 dans l'ordre, les décimaux métier sous forme de chaînes et uniquement les statuts `PASS|FAIL|NOT_REACHED` et résultats `COMPLETED|INCOMPLETE|PRE_EXECUTION_PREFLIGHT_FAILURE`. Il est reparsé et deep-comparé avant persistance. `run-summary.json.sha256` vaut exactement `<64hex>  run-summary.json\n`.

Le hash ne remplace ni la preuve source ni la review. Aucun chemin utilisateur privé, secret, token, password, JWT, contenu de passfile, credential ou donnée réelle n'entre dans le résumé partageable. Ce dossier éphémère n'est ni un ledger, ni un manifeste permanent, ni une autorité.

## Cleanup et recovery exacts

Ordre fermé :

1. `harness.shutdown()` et libération de `5173/5174` ;
2. arrêt leaf-first du tree backend/Gradle exact et libération de `8080` ;
3. conservation de l'export et des preuves sanitizées ;
4. revalidation canonique/reparse puis suppression de la seule feuille `runtimeRoot` exacte ;
5. exigence de zéro session DB, sans terminaison forcée ;
6. suppression de la DB exacte sous le rôle owner exact ;
7. révocation de la membership puis suppression du rôle exact ;
8. preuve catalogue DB/rôle absents ;
9. preuve storage absent et ports libres ;
10. résumé/checksum durables, puis suppression du recovery-state uniquement si le cleanup est complet.

Le state write-ahead est durable avant la première mutation et avant chaque mutation via `pendingOperation`. Une ressource exacte déjà absente est idempotente ; owner, commentaire, membership, marqueur, PID/start time/exécutable/commande ou chemin divergent est préservé et provoque `CLEANUP_STATUS=PARTIAL`, exit non nul et `R2_AUTHORIZED=NO`. Une session résiduelle n'est jamais tuée. Une réentrée identique poursuit seulement ce cleanup borné ; elle ne reprend aucune tâche métier.

## Passage R1 vers R2

R2 n'est éligible que si R1 satisfait cumulativement : T00-T15 terminés, résumé présent et hashé, audit exact `15/0/0`, cleanup prouvé, ressources R1 absentes, puis nouvelle review et autorisation sensible distincte propres à R2.

R1 incomplet, cleanup incomplet ou audit différent de `15/0/0` impose `R2_AUTHORIZED=NO`, interdit `GO_TO_EXTERNAL_GATE_REVIEW` et termine le cycle par `NO_GO` ou `INCONCLUSIVE`.

## Fin de R2 et décision terminale

Après R2, le cleanup doit être prouvé même si le run est incomplet.

- R2 complet avec cleanup et audit `15/0/0` rend le dossier éligible à une décision humaine parmi `GO_TO_EXTERNAL_GATE_REVIEW`, `NO_GO` ou `INCONCLUSIVE`.
- R2 incomplet, cleanup incomplet ou audit différent de `15/0/0` interdit tout troisième run et permet seulement `NO_GO` ou `INCONCLUSIVE`.
- `GO_TO_EXTERNAL_GATE_REVIEW` n'autorise ni invitation, collecte, donnée réelle, production, livrable statutaire ou spec suivante.

## Stops immédiats

Arrêter sans engager T00 si une autorisation, identité de run/tenant, commande, ressource, fixture, cible loopback ou preuve preflight diverge.

Après engagement de T00, arrêter le travail métier, consommer la tentative, conserver la cause et aller au cleanup contrôlé si une donnée réelle, une cible non-loopback, une fuite cross-tenant ou un secret apparaît, si une tâche dévie, si l'audit n'est plus prouvable, si le résultat final n'est pas scellable ou si le cleanup exact ne peut pas être prouvé.

L'existence de l'orchestrateur et ses tests statiques/in-memory n'exécutent ni n'autorisent R1 ou R2 et n'émettent aucune autorisation sensible.
