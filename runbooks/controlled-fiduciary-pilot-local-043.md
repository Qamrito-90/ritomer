# Harness local deux acteurs 043b

## Statut et limite de preuve

Le harness `043b` est un outil local, synthetique et strictement interne. Son dataset est classe :

`HARNESS_ONLY_AUTH_RBAC_DATASET`

Il sert uniquement a prouver localement l'authentification JWT, la resolution PostgreSQL des memberships, le RBAC maker/reviewer et l'isolation tenant. Il ne prouve pas :

- l'import des fixtures gelees `043a` ;
- un parcours de closing complet ;
- `043c`, `R1` ou `R2` ;
- la readiness d'un participant externe.

`043c` reste `NOT_STARTED / NOT_AUTHORIZED`. Il repartira des fixtures gelees `043a` dans une base et un stockage jetables, apres les revues et autorisations distinctes requises.

Le smoke runtime reel n'est pas execute par Codex, car le secret JWT et les credentials PostgreSQL restent sous la responsabilite de l'utilisateur local :

`smoke_local_real=NOT_RUN_USER_LOCAL_REQUIRED`

Etat corrige courant : `CORRECTED_PENDING_LOCAL_DEDICATED_DB_EVIDENCE`. Cet etat reste `NOT_MERGE_READY` et ne vaut ni revue post-code complete, ni autorisation `043c`.

## Architecture locale fermee

La topologie autorisee est fixe :

| Composant | Adresse | Identite |
| --- | --- | --- |
| Backend Spring Boot | `http://127.0.0.1:8080` | backend commun |
| Vite ACCOUNTANT | `http://127.0.0.1:5173` | `ritomer-demo-user-036a` |
| Vite REVIEWER | `http://127.0.0.1:5174` | `ritomer-demo-reviewer-043b` |

Le launcher refuse toute autre target backend, tout host autre que `127.0.0.1`, tout port alternatif, tout fallback de port et tout argument CLI, dont `--open`. Il refuse aussi la presence d'un fichier nomme `.env` ou commencant par `.env.` dans `frontend/`, sans en lire le contenu, afin d'empecher Vite de charger une configuration hors allowlist.

Les deux JWT ont une duree exacte de 3 600 secondes. Ils restent uniquement dans le processus parent et dans l'environnement minimal du Vite correspondant. Le navigateur ne recoit aucun bearer. Aucune regeneration ni aucun refresh n'existe ; l'expiration arrete les deux Vite et impose un redemarrage complet du harness.

## Variables locales requises

Ne stocker aucune valeur dans Git, un fichier `.env`, le navigateur, une URL, un runbook ou une sortie partagee.

Noms utilises par le backend et le seed :

- `RITOMER_SECURITY_JWT_HMAC_SECRET` ;
- `SPRING_DATASOURCE_URL` ;
- `SPRING_DATASOURCE_USERNAME` ;
- `SPRING_DATASOURCE_PASSWORD`.

Le harness lit uniquement `RITOMER_SECURITY_JWT_HMAC_SECRET`. La valeur doit etre non vide et representer au moins 32 octets UTF-8. Il n'existe aucun fallback, aucune constante de secret et aucune lecture de fichier.

Le harness construit lui-meme les trois variables de chaque enfant Vite :

- `RITOMER_LOCAL_DEMO_BACKEND_TARGET` avec la target fixe `http://127.0.0.1:8080` ;
- `RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED` active ;
- `RITOMER_LOCAL_DEMO_BEARER_TOKEN` propre a l'acteur.

Le secret HMAC et le token de l'autre acteur sont absents de chaque enfant.

## Base PostgreSQL jetable obligatoire pour les tests destructifs

`dbIntegrationTest` est autorise uniquement contre une base nouvellement creee pour cette preuve, nommee exactement `ritomer_043b_test`, avec le role de login dedie `ritomer_043b_test_runner`.

La base doit etre :

- jetable et synthetic-only ;
- creee de novo pour les tests 043b ;
- vide avant Flyway, hors schema cree par la suite de test ;
- sans dump, clone, snapshot ou restauration d'une base client, pilote, staging ou production ;
- sans donnee client ou participant reel.

Variables obligatoires :

- `RITOMER_DB_TESTS_ENABLED=true` ;
- `RITOMER_DB_TEST_JDBC_URL` avec un chemin de base exact `/ritomer_043b_test` ;
- `RITOMER_DB_TEST_USERNAME=ritomer_043b_test_runner` ;
- `RITOMER_DB_TEST_PASSWORD`, definie uniquement dans le shell local, sans valeur reproduite dans ce runbook ;
- `RITOMER_DB_TEST_DESTRUCTIVE_CONSENT=TRUNCATE_RITOMER_043B_TEST`.

`localhost` ou `127.0.0.1` ne constitue jamais a lui seul une preuve de surete. La task Gradle valide le nom de base, le role et le consentement, puis chaque classe 043b revalide `current_database()`, `current_user` et `session_user` avant Flyway et juste avant chaque `TRUNCATE`.

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

Etat apres les corrections et checks sans DB du `2026-07-16` : `CORRECTED_PENDING_LOCAL_DEDICATED_DB_EVIDENCE`. Le checker accepte le worktree exact de 17 chemins et son mode historique 043b valide un base-to-commit simule. `dbIntegrationTest`, le seed reel, `bootRun`, Vite reel et le smoke navigateur restent non executes pendant cette boucle. Ne declarer `CORRECTED_PENDING_POST_CODE_CPO_TECHNICAL_SECURITY_REVIEWS` qu'apres les tests DB gardes et un nouveau smoke reel.

## Responsabilite locale et revue

L'utilisateur local est seul responsable de la creation, de la robustesse, de la garde et de la rotation des passwords/credentials PostgreSQL et du secret HMAC. Ces valeurs ne doivent jamais etre collees dans ChatGPT/Codex, Git, un ticket, un screenshot, une capture reseau ou un resultat de smoke partage.

Avant merge, une revue technique humaine et une revue Security/Privacy doivent verifier l'auth locale, la redaction, le lifecycle des processus, le RBAC, l'audit et l'isolation tenant. Elles n'autorisent ni `043c`, ni participant externe, ni auth de production, ni provider, ni MCP.
