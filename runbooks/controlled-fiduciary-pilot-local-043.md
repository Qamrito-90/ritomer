# Simulation locale mono-opérateur de deux rôles 043b

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

`043c` reste `NOT_STARTED / NOT_AUTHORIZED`. Il repartira des fixtures gelees `043a` dans une base et un stockage jetables, apres les revues et autorisations distinctes requises.

Le smoke runtime reel n'est pas execute par Codex, car le secret JWT et les credentials PostgreSQL restent sous la responsabilite de l'utilisateur local :

`smoke_local_real=NOT_RUN_USER_LOCAL_REQUIRED`

Avant le hotfix, le merge était `MERGED_WITH_KNOWN_HIGH_FINDINGS` et l'usage local `LOCAL_USE_PAUSED`. État courant : `MINIMUM_VIABLE_SAFETY_IMPLEMENTED / PENDING_LOCAL_EVIDENCE / NOT_MERGE_READY`. Il ne vaut ni review IA finale post-code, ni preuve de sessions humaines indépendantes, ni autorisation `043c`.

Classifications : `LOCAL_TWO_ROLE_SIMULATION / SINGLE_OPERATOR_CAPABLE / SYNTHETIC_ONLY / LOOPBACK_ONLY / AI_REVIEWED / OWNER_RISK_ACCEPTED / NOT_PRODUCTION_AUTH / NOT_INDEPENDENT_ACTOR_BOUNDARY / NOT_PROOF_OF_SEGREGATION_OF_DUTIES / NOT_FOR_EXTERNAL_USE / NOT_FOR_REAL_DATA`.

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
