# Runbook local-dev

## Pré-requis
- JDK 21
- une instance PostgreSQL accessible directement, locale ou distante
- aucun Docker Desktop requis
- accès GCP non requis pour le développement local initial
- la cible de production reste Cloud SQL for PostgreSQL

## Commandes
Depuis la racine du repo :

- `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'`
- `cd backend && ./gradlew test`
- `cd backend && ./gradlew dbIntegrationTest`
- `cd backend && ./gradlew build`
- `cd backend && ./gradlew -PritomerDemoSeedEnabled=true demoSeedLocal`
- `cd backend && ./gradlew -PritomerDemoSeedEnabled=true -PritomerDemoSeedVariant=042a2a5d-mixed-v2 demoSeedLocal`

## Harness local deux acteurs 043b

Le runbook canonique est `runbooks/controlled-fiduciary-pilot-local-043.md`.

Commandes canoniques, depuis la racine du repo :

- seed opt-in : `cd backend && ./gradlew -PritomerDemoSeedEnabled=true -PritomerDemoSeedVariant=043b-two-actor-pilot demoSeedLocal` ;
- backend loopback : `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local --server.address=127.0.0.1 --server.port=8080'` ;
- harness : `cd frontend && pnpm dev:two-actor-local`.

Les valeurs de `RITOMER_SECURITY_JWT_HMAC_SECRET`, `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME` et `SPRING_DATASOURCE_PASSWORD` restent uniquement dans le shell local. Ne les placer ni dans ce runbook, ni dans Git, ni dans un fichier `.env`.

## Tests PostgreSQL destructifs 043b

`dbIntegrationTest` ne doit jamais reutiliser la base seed locale `/ritomer`. Les recettes `036a`, `042a2a5d-mixed-v2` et `043b-two-actor-pilot` n'autorisent pas la task de test DB.

La seule cible autorisee pour la preuve 043b est une base nouvellement creee, jetable, synthetic-only, sans dump ni clone client/staging/production :

- base exacte : `ritomer_043b_test` ;
- role de login exact : `ritomer_043b_test_runner` ;
- consentement exact : `RITOMER_DB_TEST_DESTRUCTIVE_CONSENT=TRUNCATE_RITOMER_043B_TEST` ;
- `RITOMER_DB_TEST_PASSWORD` doit deja exister dans le shell, sans valeur documentee ou affichee.

Le host loopback n'est pas une preuve de surete. La task Gradle refuse les URLs ambigues, encodees ou visant un autre nom de base. Les deux tests destructifs 043b revalident `current_database()`, `current_user` et `session_user` avant Flyway et juste avant chaque `TRUNCATE`. Stopper si la task est `SKIPPED` ou si une garde refuse.

## Seed demo local 036a

Le seed demo 036a est backend-only, synthetique, tenant-scope, idempotent et desactive par defaut.

Garde-fous :

- execution via task Gradle dediee uniquement ;
- aucun seed automatique au demarrage normal du backend ;
- activation explicite obligatoire avec `-PritomerDemoSeedEnabled=true` ;
- profil local par defaut, avec override test PostgreSQL possible via `-PritomerDemoSeedProfile=dbtest` ;
- fail-fast hors profils `local`, `test` ou `dbtest` ;
- fail-fast si des marqueurs Cloud Run ou production-like sont presents dans l'environnement d'execution ;
- datasource cible bornee a une URL PostgreSQL locale explicite (`localhost`, `127.0.0.1` ou `[::1]`) ;
- refus des URLs datasource distantes, Cloud SQL directes, prod-like ou non verifiables ;
- aucun endpoint HTTP de seed ;
- aucun JWT local, proxy Vite, frontend, OpenAPI, migration DB, GraphQL ou IA runtime.

La variante locale `042a2a5d-mixed-v2` est separee et opt-in. Sans `-PritomerDemoSeedVariant=042a2a5d-mixed-v2`, la commande seed uniquement le scenario principal 036a.

Dans les exemples Windows PowerShell, les proprietes Gradle `-P...` doivent preceder la task `demoSeedLocal`; `--no-daemon`, s'il est utilise, reste avant les `-P`.

PowerShell :

```powershell
Push-Location backend
try {
  $env:SPRING_DATASOURCE_URL='jdbc:postgresql://localhost:5432/ritomer'
  .\gradlew.bat -PritomerDemoSeedEnabled=true demoSeedLocal
} finally {
  Pop-Location
}
```

La commande exige qu'une datasource PostgreSQL locale explicite soit visible par le guard avant le chargement du contexte Spring, via `spring.datasource.url`, `SPRING_DATASOURCE_URL` ou `RITOMER_DB_TEST_JDBC_URL`. Elle ne deduit jamais `localhost` du seul profil `local`, ne definit aucune valeur sensible et ne doit pas etre utilisee pour stocker des donnees client reelles.

Pour `dbtest`, la datasource doit aussi rester locale. Une execution via `cloud-sql-proxy` liee a `127.0.0.1` est acceptee par la garde ; une URL Cloud SQL directe ou distante est refusee.

```powershell
Push-Location backend
try {
  $env:RITOMER_DB_TEST_JDBC_URL='jdbc:postgresql://127.0.0.1:5432/ritomer'
  .\gradlew.bat -PritomerDemoSeedEnabled=true -PritomerDemoSeedProfile=dbtest demoSeedLocal
} finally {
  Pop-Location
}
```

PowerShell pour creer aussi la variante locale mixed v2 :

```powershell
Push-Location backend
try {
  $env:SPRING_DATASOURCE_URL='jdbc:postgresql://localhost:5432/ritomer'
  .\gradlew.bat -PritomerDemoSeedEnabled=true -PritomerDemoSeedVariant=042a2a5d-mixed-v2 demoSeedLocal
} finally {
  Pop-Location
}
```

Effet attendu :

- le dossier principal `036a0000-0000-4000-8000-000000000004` reste complet avec 6 lignes de balance et 6 mappings manuels ;
- le dossier variante `042a2a5d-0000-4000-8000-000000000004` est cree avec 6 lignes de balance et 4 mappings manuels ;
- les comptes `3000` et `4000` restent volontairement non mappes dans la variante.

## Endpoint local suggestions v2 offline 042a2a3

Le endpoint local `GET /api/closing-folders/{closingFolderId}/mappings/suggestions-v2` expose le moteur offline 042a2a3 uniquement pour la demo synthetique locale.

Garde-fous :

- endpoint absent par defaut ;
- profil Spring `local` obligatoire ;
- activation explicite obligatoire avec `ritomer.ai.mapping-suggestions-v2.offline.enabled=true` ;
- simulation locale, aucune IA externe active ;
- aucune lecture de secret, `.env`, token, DSN ou credential par le moteur offline ;
- aucun provider reel, SDK provider, appel reseau IA, prompt runtime actif ou cout provider ;
- aucun `POST`, aucune decision `ACCEPT`, `CORRECT`, `REJECT`, aucun bulk et aucun auto-apply ;
- aucune ecriture metier, aucun mapping manuel cree ou modifie et aucun audit de decision emis par ce `GET` ;
- allowlist backend immutable limitee au tenant `036a0000-0000-4000-8000-000000000001`, au dossier `036a0000-0000-4000-8000-000000000004`, a l'import version `1` et a la source `demo-synthetic-balance.csv`.
- allowlist locale et immutable etendue uniquement au dossier variante `042a2a5d-0000-4000-8000-000000000004`, sous le meme tenant, la meme version d'import `1` et la meme source `demo-synthetic-balance.csv`.

PowerShell pour demarrer le backend local avec le endpoint v2 offline :

```powershell
Push-Location backend
try {
  $env:SPRING_DATASOURCE_URL='jdbc:postgresql://localhost:5432/ritomer'
  .\gradlew.bat bootRun --args="--spring.profiles.active=local --ritomer.ai.mapping-suggestions-v2.offline.enabled=true"
} finally {
  Pop-Location
}
```

PowerShell de lecture. Remplacer le placeholder par un JWT local signe obtenu hors repo ; ne pas le committer, ne pas le placer dans `.env`, ne pas le coller dans le navigateur :

```powershell
$headers = @{
  Authorization = 'Bearer <JWT_LOCAL_SIGNE_NON_COMMITTE>'
  'X-Tenant-Id' = '036a0000-0000-4000-8000-000000000001'
}

Invoke-RestMethod `
  -Method Get `
  -Uri 'http://localhost:8080/api/closing-folders/036a0000-0000-4000-8000-000000000004/mappings/suggestions-v2' `
  -Headers $headers
```

Resultats attendus :

- sans profil `local` ou sans flag explicite, le endpoint n'est pas expose ;
- sans authentification, le endpoint retourne le comportement de securite existant ;
- sans `X-Tenant-Id` valide, le resolver tenant existant rejette la requete ;
- hors allowlist demo synthetique, la reponse est un `POLICY_BLOCK` request-scope avant tout appel moteur ;
- demo allowlistee sans import eligible, la reponse est un `PRECONDITION_BLOCK` request-scope ;
- compte deja affecte, la reponse est un `PRECONDITION_BLOCK` account-scope ;
- compte eligible, la reponse contient une `SUGGESTION`, une `ABSTENTION` ou une degradation technique v2 explicite ;
- sur la variante `042a2a5d-mixed-v2`, les counts attendus sont `SUGGESTION=1`, `ABSTENTION=1`, `PRECONDITION_BLOCK=4`, `POLICY_BLOCK=0` et `TECHNICAL_DEGRADATION=0` ;
- aucun compte n'est ignore silencieusement.

PowerShell pour un démarrage local complet :

```powershell
cd backend
$env:SPRING_DATASOURCE_URL='jdbc:postgresql://localhost:5432/ritomer'
$env:SPRING_DATASOURCE_USERNAME='ritomer'
if (-not (Test-Path Env:RITOMER_SECURITY_JWT_HMAC_SECRET)) { throw 'JWT HMAC secret missing from local shell.' }
if (-not (Test-Path Env:SPRING_DATASOURCE_PASSWORD)) { throw 'Datasource password missing from local shell.' }
.\gradlew.bat bootRun --args="--spring.profiles.active=local"
```

## Proxy frontend demo local 036c

Le proxy frontend 036c est Vite dev-only. Il route `/api/*` vers le backend reel local et peut injecter un bearer uniquement cote serveur de developpement Vite.

Garde-fous :

- target par defaut : `http://localhost:8080` ;
- target configurable par `RITOMER_LOCAL_DEMO_BACKEND_TARGET`, variable shell non sensible ;
- injection bearer desactivee par defaut ;
- activation explicite par `RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED=true` ;
- bearer lu uniquement par Node/Vite depuis `RITOMER_LOCAL_DEMO_BEARER_TOKEN` ;
- aucune variable `VITE_*` pour le bearer ;
- aucune lecture `import.meta.env` cote client pour le bearer ;
- aucun bearer dans le bundle, le navigateur, `localStorage`, `sessionStorage`, un fichier `.env`, le repo ou les logs ;
- injection autorisee uniquement vers `localhost` ou `127.0.0.1` ;
- fail-fast si l'auth proxy est activee sans bearer shell ;
- fail-fast si l'auth proxy est activee vers une target non locale ;
- aucun backend runtime, endpoint, OpenAPI, migration DB, GraphQL, IA runtime ou mock frontend ajoute.

PowerShell pour lancer le frontend sans injection bearer, utile pour verifier que `GET /api/me` retourne `401` :

```powershell
Push-Location frontend
try {
  $env:RITOMER_LOCAL_DEMO_BACKEND_TARGET='http://localhost:8080'
  Remove-Item Env:RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED -ErrorAction SilentlyContinue
  Remove-Item Env:RITOMER_LOCAL_DEMO_BEARER_TOKEN -ErrorAction SilentlyContinue
  pnpm dev
} finally {
  Pop-Location
}
```

PowerShell pour une demo locale integree avec bearer shell. Remplacer le placeholder par un JWT local signe obtenu hors repo ; ne pas le committer, ne pas le placer dans `.env`, ne pas le coller dans le navigateur :

```powershell
Push-Location frontend
try {
  $env:RITOMER_LOCAL_DEMO_BACKEND_TARGET='http://localhost:8080'
  $env:RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED='true'
  $env:RITOMER_LOCAL_DEMO_BEARER_TOKEN='<JWT_LOCAL_SIGNE_NON_COMMITTE>'
  pnpm dev
} finally {
  Remove-Item Env:RITOMER_LOCAL_DEMO_BEARER_TOKEN -ErrorAction SilentlyContinue
  Pop-Location
}
```

Smoke manuel attendu :

- backend local lance en profil `local` ;
- dataset demo 036a seede en PostgreSQL local ;
- JWT local signe compatible avec l'utilisateur demo 036a ;
- navigateur ouvert sur le serveur Vite ;
- `GET /api/me` passe par `/api` et retourne `200` avec `activeTenant` quand l'auth proxy est activee ;
- `GET /api/me` retourne `401` quand l'auth proxy n'est pas activee ;
- la liste des dossiers et le dossier demo viennent des endpoints backend reels ;
- aucun token n'est visible dans le bundle, le navigateur, le stockage navigateur ou les logs ;
- une tentative avec un mauvais tenant est rejetee sans fuite de donnees.

## Tests

- `./gradlew test` exécute les tests unitaires, smoke et structure sans Docker et sans base PostgreSQL.
- `./gradlew dbIntegrationTest` exécute les tests PostgreSQL réels uniquement si une configuration explicite est fournie.

PowerShell pour les tests PostgreSQL optionnels :

```powershell
cd backend
$env:RITOMER_DB_TESTS_ENABLED='true'
$env:RITOMER_DB_TEST_JDBC_URL='jdbc:postgresql://localhost:5432/ritomer_043b_test'
$env:RITOMER_DB_TEST_USERNAME='ritomer_043b_test_runner'
$env:RITOMER_DB_TEST_DESTRUCTIVE_CONSENT='TRUNCATE_RITOMER_043B_TEST'
if (-not (Test-Path Env:RITOMER_DB_TEST_PASSWORD)) { throw 'DB test password missing from local shell.' }
.\gradlew.bat dbIntegrationTest
```

## Validation PostgreSQL réelle via cloud-sql-proxy

Pré-requis minimaux :

- binaire `cloud-sql-proxy` disponible localement
- authentification GCP déjà établie pour atteindre l'instance Cloud SQL cible
- nom d'instance au format `project:region:instance`

PowerShell Windows validé pour ouvrir le proxy :

```powershell
$env:CLOUD_SQL_INSTANCE='project:region:instance'
.\cloud-sql-proxy.exe --address 127.0.0.1 --port 5432 $env:CLOUD_SQL_INSTANCE
```

PowerShell Windows validé pour lancer `dbIntegrationTest` contre le proxy :

```powershell
cd backend
$env:RITOMER_DB_TESTS_ENABLED='true'
$env:RITOMER_DB_TEST_JDBC_URL='jdbc:postgresql://127.0.0.1:5432/ritomer_043b_test'
$env:RITOMER_DB_TEST_USERNAME='ritomer_043b_test_runner'
$env:RITOMER_DB_TEST_DESTRUCTIVE_CONSENT='TRUNCATE_RITOMER_043B_TEST'
if (-not (Test-Path Env:RITOMER_DB_TEST_PASSWORD)) { throw 'DB test password missing from local shell.' }
.\gradlew.bat dbIntegrationTest
```

Notes :

- gardez `cloud-sql-proxy` actif pendant toute l'exécution du task Gradle
- le nom de base et le role 043b sont fixes ; ne les adaptez pas a une base ordinaire
- la valeur du password reste exclusivement dans le shell local et n'est jamais affichee
- la recette reste compatible avec le principe V1 : aucun Docker local requis

## Vérification locale rapide
- `GET /actuator/health` doit répondre `200 OK`
- `GET /api/me` sans token doit répondre `401 Unauthorized`

Exemple PowerShell :

```powershell
Invoke-WebRequest http://localhost:8080/actuator/health | Select-Object -ExpandProperty StatusCode
try {
  Invoke-WebRequest http://localhost:8080/api/me -UseBasicParsing | Select-Object -ExpandProperty StatusCode
} catch {
  [int]$_.Exception.Response.StatusCode
}
```

## Contrôles avant PR
- tests verts
- pas de violation des frontières modulaires
- pas de régression cross-tenant
- contrats mis à jour si nécessaire
