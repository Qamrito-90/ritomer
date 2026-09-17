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

## Rail PostgreSQL lean M1.1B

Le rail canonique est `backend/scripts/m1-1b-postgresql-rail.ps1`. Il est
strictement réservé à PostgreSQL 17 natif sous Windows, sur
`127.0.0.1:15432`, avec les cibles jetables
`ritomer_043b_test` et `ritomer_043b_test_runner`. Il ne modifie aucune
configuration PostgreSQL et ne possède aucun fallback vers Docker, proxy,
tunnel, PATH ou port alternatif.

Marqueurs durables du redesign :

```text
M1_1B_POSTGRESQL_RAIL_DELTA=A2_M4_R0_D0_TOTAL6
M1_1B_POSTGRESQL_RAIL_COMPOSITE=A8_M17_R0_D0_TOTAL25
M1_1B_POSTGRESQL_RAIL_OVERLAPS_WITH_B=1
M1_1B_POSTGRESQL_RAIL_MODES=PREFLIGHT_LIFECYCLE_ONLY
M1_1B_POSTGRESQL_ADMIN_CLIENT=PSQL_17_DIRECT
ADMIN_SECRET_VISIBLE_TO_GRADLE=NO
ADMIN_SECRET_VISIBLE_TO_JAVA=NO
GRADLE_RAIL_TASKS=READINESS_TARGETED_FULL_ONLY
PSQL_PHASE_PROCESS_COUNTS=PREFLIGHT_1_PROVISION_1_CLEANUP_1
POSTGRESQL_CONNECTION=NOT_EXECUTED_NOT_AUTHORIZED
PREFLIGHT_EXECUTED=NO
LIFECYCLE_EXECUTED=NO
DB_INTEGRATION_TEST_EXECUTED=NO
POSTGRESQL_RAIL_TECHNICAL_STATUS=INCONCLUSIVE_PENDING_DB_EXECUTION
```

L'unique client administratif futur est le fichier ordinaire exact :

```text
C:\Program Files\PostgreSQL\17\bin\psql.exe
```

Chaque autorisation sensible lie aussi le SHA-256 lowercase exact de ce
binaire. Le rail le recalcule avant chaque démarrage ; le manifeste Preflight
le persiste et Lifecycle exige le même hash pour Provision et Cleanup. Un
changement d'octets impose une nouvelle autorisation liée au nouvel artefact.

Il est lancé directement par `System.Diagnostics.Process` avec
`UseShellExecute=false`. Les neuf tokens d'arguments, dans cet ordre, sont :

```text
-X
-W
-q
-A
-t
--set=ON_ERROR_STOP=1
--set=VERBOSITY=terse
--dbname
hostaddr=127.0.0.1 port=15432 dbname=postgres user=postgres connect_timeout=5 sslmode=disable gssencmode=disable require_auth=scram-sha-256 application_name=ritomer_m1b_admin_rail
```

Aucun secret admin ne traverse Gradle, Java, Kotlin, Spring ou Flyway. Il
n'existe ni variable admin, ni URL credentialée, ni fichier password, ni
`PG*`, ni argument secret. La seule saisie admise est le prompt masqué natif
de `psql -W` sur une console Windows attachée. L'environnement du child est
reconstruit par allowlist ; `HOME`, `USERPROFILE` et `APPDATA` pointent vers
un dossier neutre neuf sous le root du run. Tout `GIT_*` hérité est également
refusé ; les lectures Git utilisent le binaire ordinaire exact
`C:\Program Files\Git\cmd\git.exe` et un environnement fermé.

Le rail expose exactement `Preflight` et `Lifecycle`. Dans les deux modes, la
readiness Gradle doit avoir entièrement terminé avec `PASS` avant le contrôle
de console, tout prompt ou tout lancement psql. Gradle conserve seulement :

- `m1BPostgresRailReadiness`, sans secret et sans exécution DB ;
- `m1BPostgresRailTargeted`, deux classes et treize tests ;
- `m1BPostgresRailFull`, douze classes et cinquante-cinq tests.

`dbIntegrationTest` reste autonome, hors orchestration, et n'a pas été lancé
pendant ce redesign.

Le futur `Preflight` utilise exactement un process psql et une transaction
`READ ONLY` avec `statement_timeout=5s`, `lock_timeout=2s` et
`search_path=pg_catalog`. Le SQL fixe est envoyé en mémoire sur stdin. La
sortie brute, strictement bornée, reste en mémoire et n'est jamais publiée.
Le manifeste sanitisé ne peut passer que si la version client/serveur est 17,
l'endpoint et l'identité admin sont exacts, les capacités sont suffisantes,
les deux cibles sont absentes et la première règle HBA applicable au runner
est exactement la règle globale `rule_number` suivante, sans option :

```text
hostnossl ritomer_043b_test ritomer_043b_test_runner 127.0.0.1/32 scram-sha-256
```

Le futur `Lifecycle` exige le manifeste preflight exact et son hash. Il
génère le password runner par CSPRNG, dérive uniquement en mémoire un
vérificateur SCRAM-SHA-256, provisionne avec un unique nouveau psql, puis
exécute targeted et full avec le seul secret runner. Un unique nouveau psql
de cleanup est tenté dans `finally`. Il vérifie cluster, OID, provenance et
sessions run-bound avant de supprimer la base puis le rôle. Il n'existe aucun
retry, recovery heuristique ou process psql caché.

L'inventaire des réglages reste exhaustif : 23 noms, dont 21 lus et comparés
effectivement dans la session runner. `local_preload_libraries` appartient à
ces 21 lectures. `shared_preload_libraries` et `session_preload_libraries`
relèvent de la preuve administrative ci-dessous ; aucune lecture inaccessible
n'est remplacée par une constante ou un `NULL`, aucun refus `42501` n'est
accepté et aucun privilège supplémentaire n'est accordé au runner.

Le provisionnement conserve `set_config(..., '', false)` et `FROM CURRENT`.
Après création et protection de la base, avant l'unique `LOGIN`, une garde
administrative utilisant les OID courants exige : shared preload effectivement
vide ; exactement une entrée de default du rôle, canonique
`session_preload_libraries=` et réellement vide, les variantes de casse étant
comptées pour détecter les doublons ; aucune surcharge session preload pour
la base et le rôle `(D,R)` ou pour la base `(D,0)`, même vide ; aucun droit
effectif `SET` ou `ALTER SYSTEM` sur session preload, ni `ALTER SYSTEM` sur
shared preload, y compris via `PUBLIC` ou transitivité ; aucun membership où
le runner est membre ou rôle accordé. Tout prédicat différent de `true`,
`NULL` compris, est refusé. Le payload final recalcule ces cinq prédicats
administratifs et exige leurs cinq booléens stricts à `true`.

Le payload lie aussi le démarrage du serveur avec `postmasterStartUnixMicros` :
une chaîne décimale canonique positive de microsecondes Unix, calculée depuis
`pg_postmaster_start_time()` par arithmétique numérique exacte, puis `int8` et
texte. Son type chaîne est vérifié avant conversion, puis le motif
`\A[1-9][0-9]{0,18}\z` et la borne positive d'un entier signé 64 bits sont
imposés. La chaîne reste exacte entre les frontières, sans flottant, arrondi
à la milliseconde, trim ni conversion ISO. Les champs absents, inconnus,
dupliqués, nuls ou mal typés et les booléens faux sont refusés.

Cette preuve provient du payload administratif validé : le vrai résultat de
provisionnement transmet `PostmasterStartUnixMicros` avec les OID au Lifecycle,
puis aux deux phases targeted/full par
`RITOMER_DB_RAIL_POSTMASTER_START_UNIX_MICROS`. Gradle l'exige pour ces phases
et conserve son passage vers le worker par l'union d'environnement existante.
Kotlin valide la configuration avant connexion, observe et compare exactement
le démarrage, puis contrôle les defaults, surcharges et droits. Les quatre
familles de requêtes, les gardes startup, DataSource/Flyway et les validations
avant les deux destructions restent requises. Le manifeste Lifecycle conserve
ce binding. Le champ n'est ni fourni ni exigé par Preflight ou les readiness
préalables ; sa présence indue y est rejetée. Il n'ajoute aucun paramètre à la
commande initiale du Lifecycle.

La provenance commune à PowerShell et Kotlin est exactement
`ritomer-m1-1b:<RunId>:<ReviewedObjectSha256>:<ClusterSystemIdentifier>` :
préfixe sensible à la casse, run de 32 hex minuscules, hash de 64 hex
minuscules et cluster décimal `[1-9][0-9]{0,19}`, sans suffixe ni caractère
final supplémentaire. `Get-M1BProvenance` reçoit les valeurs validées du
Lifecycle, dont le cluster du manifeste Preflight validé. Les builders SQL
et le validateur du payload refusent l'ancien format et exigent le même
cluster ; le cleanup exige aussi le même run. Cette valeur unique lie les
deux `COMMENT ON`, les deux commentaires observés et les deux prédicats de
provenance du cleanup.

La garde JDBC accepte `public` uniquement si son véritable propriétaire est
`ritomer_043b_test_runner` ou `pg_database_owner`. Dans les deux cas, la base
doit appartenir au runner exact connecté, avec les OID, provenances et ACL
attendus. Les ACL restent vérifiées relativement au véritable `nspowner`.
Tout propriétaire étranger, y compris `postgres`, est refusé ; aucun simple
droit `CREATE` ou membership ne remplace la propriété. `NOINHERIT`, les
restrictions du runner, le rejet des memberships explicites et la validation
avant destruction sur la même connexion et transaction restent requis. La
recréation conserve ses opérations fixes et rend `public` au runner.

Les tests de contrat non-DB font circuler la sortie exacte du vrai producteur
PowerShell vers les builders, le validateur de payload puis les commentaires
JDBC de la vraie garde Kotlin. Ils couvrent les deux propriétaires admis et
les rejets de provenance, OID, propriétaires, ACL et memberships avant toute
destruction simulée. Ils ne prouvent aucune exécution PostgreSQL ni clôture
M1.1B. L'inspection offline du SQL généré ne constitue pas son exécution
PostgreSQL ; le passage réel de la preuve jusqu'au worker reste à confirmer
lors d'une future validation DB autorisée. Les gardes et le binding du
démarrage ne préviennent pas des modifications administratives concurrentes
effectuées après une observation ; cette limite demeure.

Avant readiness et après chaque phase, le rail reconstruit dans un index Git
alternatif hors repository le diff binaire du composite exact `A8/M17/25` et
recalcule son SHA-256. `ReviewedObjectSha256` désigne ce `DIFF.patch` canonique ;
toute divergence de contenu, de top-level, d'index, de branche, de HEAD, de
file-set ou d'état stoppe le run. L'index réel du repository reste vide.

Après cet alignement des contrats, le nouveau composite canonique et le
nouveau digest runtime doivent être revus et liés à de nouveaux records
avant toute exécution sensible. Les manifestes, sidecars et reviews
antérieurs restent inchangés et prouvent uniquement leurs anciens octets ;
ils ne couvrent pas le correctif.

Les processus Gradle sont créés suspendus sous Windows 10+ puis rattachés
atomiquement à un Job Object non nommé avec `KILL_ON_JOB_CLOSE`, avant reprise.
Seuls stdin/stdout/stderr sont héritables. L'arbre complet est terminé et
attendu sur succès, erreur ou timeout, afin qu'aucun worker ne conserve le
secret runner. Les captures `system-out`/`system-err` JUnit sont désactivées,
les crash dumps restent sous le root volatil et un scan binaire borné de tout
le root recherche le secret runner après chaque phase. Tout artefact contaminé
est supprimé puis impose un arrêt contrôlé.

La readiness calcule aussi un SHA-256 déterministe des classes, ressources,
jars du runtime, des racines JDK complètes du JVM Gradle et du `JavaLauncher`
21 explicitement assigné aux workers `Test`, du wrapper et de la distribution
Gradle. Le digest est persisté dans les deux manifestes ; Lifecycle exige celui
du manifeste Preflight, puis targeted et full exigent le même digest avant et
après leur exécution. Cette continuité détecte une dérive accidentelle
inter-phase ; elle ne remplace pas les ACL de l'hôte contre un adversaire
disposant du même compte Windows.

Le root exact est :

```text
C:\dev\ritomer-local-evidence\m1-1b-postgresql\<RUN_ID_32_HEX>
```

Chaque mode prend le même lock global create-new sous la racine M1.1B ; deux
run IDs ne peuvent donc jamais agir simultanément sur la base et le rôle fixes. Les
seuls manifestes persistés sont `preflight-manifest.json` et, après succès
complet, `lifecycle-manifest.json`, chacun accompagné de son
`.sha256`, lu sur une ouverture unique avec 65 octets UTF-8 stricts et un LF
canonique. Ils contiennent uniquement des observations sanitisées et des
hashes : runtime, capacités admin, transaction read-only, timeouts, OID
admin/base de maintenance, cluster, `rule_number`/ligne HBA et état des
fichiers HBA. Jamais le SQL, stdout/stderr bruts, un password ou un
vérificateur.
Un cleanup incomplet impose `CLEANUP_FAILED_QUARANTINE_REQUIRED`.

Forme documentaire des futures commandes, non exécutées ici :

```powershell
$runId = '<32-hex autorisé>'
$reviewedObjectSha256 = '<sha256 de l artefact exactement revu>'
$expectedPsqlSha256 = '<sha256 lowercase du psql.exe exactement autorisé>'
$runRoot = "C:\dev\ritomer-local-evidence\m1-1b-postgresql\$runId"
$preflightAuthorizationRecordId = '<record Preflight lié à cette commande exacte>'
$lifecycleAuthorizationRecordId = '<record Lifecycle distinct lié à cette commande exacte>'

.\backend\scripts\m1-1b-postgresql-rail.ps1 `
  -Mode Preflight `
  -RunId $runId `
  -ReviewedObjectSha256 $reviewedObjectSha256 `
  -ExpectedPsqlSha256 $expectedPsqlSha256 `
  -RunRoot $runRoot `
  -SensitiveAuthorizationRecordId $preflightAuthorizationRecordId

.\backend\scripts\m1-1b-postgresql-rail.ps1 `
  -Mode Lifecycle `
  -RunId $runId `
  -ReviewedObjectSha256 $reviewedObjectSha256 `
  -ExpectedPsqlSha256 $expectedPsqlSha256 `
  -RunRoot $runRoot `
  -SensitiveAuthorizationRecordId $lifecycleAuthorizationRecordId `
  -PreflightAuthorizationRecordId $preflightAuthorizationRecordId
```

Toute connexion PostgreSQL, y compris `Preflight`, exige une mission
d'exécution sensible distincte, un artefact/hash, un environnement et une
commande exacts. Le code reste volontairement
`INCONCLUSIVE_PENDING_DB_EXECUTION` tant que ces preuves n'existent pas.

## Simulation locale mono-opérateur de deux rôles 043b

`runbooks/controlled-fiduciary-pilot-local-043.md` reste une référence
historique de la simulation 043. Il n'est pas canonique pour le rail M1.1B,
dont la cible directe et les contrôles sont décrits dans la section précédente.

043b is a local single-operator two-role simulation. It validates backend RBAC behavior under two synthetic identities. It does not establish independent human sessions or segregation of duties.

043b est une simulation locale mono-opérateur de deux rôles. Elle valide le comportement RBAC du backend sous deux identités synthétiques. Elle n'établit ni deux sessions humaines indépendantes ni une séparation des fonctions.

Commandes canoniques, depuis la racine du repo :

- seed opt-in : `cd backend && ./gradlew -PritomerDemoSeedEnabled=true -PritomerDemoSeedVariant=043b-two-actor-pilot demoSeedLocal` ;
- backend loopback : `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local --server.address=127.0.0.1 --server.port=8080'` ;
- harness : `cd frontend && pnpm dev:two-actor-local`.

Les valeurs de `RITOMER_SECURITY_JWT_HMAC_SECRET`, `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME` et `SPRING_DATASOURCE_PASSWORD` restent uniquement dans le shell local. Ne les placer ni dans ce runbook, ni dans Git, ni dans un fichier `.env`.

Le secret JWT n'a aucun fallback. L'ancien placeholder et la sentinel non fonctionnelle sont refusés. Ne jamais demander à Codex de lire la valeur. Génération CSPRNG locale sans affichage ni stockage :

```powershell
$jwtKeyBytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($jwtKeyBytes)
$env:RITOMER_SECURITY_JWT_HMAC_SECRET = [Convert]::ToBase64String($jwtKeyBytes)
[Array]::Clear($jwtKeyBytes, 0, $jwtKeyBytes.Length)
```

Les ports `5173` et `5174` restent deux contextes visuels. Ils ne constituent pas une frontière d'identité.

## Tests PostgreSQL destructifs 043b — workflow autonome hors preuve rail

La task `dbIntegrationTest` reste exécutable uniquement dans son workflow
sensible distinct. Elle n'est pas recevable comme preuve du rail M1.1B : elle
demande des variables `RITOMER_DB_TEST_*` dans le shell parent, ce que le rail
lean refuse. Ne pas la combiner avec `Preflight` ou `Lifecycle`.

`dbIntegrationTest` ne doit jamais reutiliser la base seed locale `/ritomer`. Les recettes `036a`, `042a2a5d-mixed-v2` et `043b-two-actor-pilot` n'autorisent pas la task de test DB.

Les valeurs shell de cette section ne constituent ni une cible ni une
autorisation du rail. Toute preuve M1.1B passe exclusivement par le rail
ci-dessus sur `127.0.0.1:15432`, avec base/rôle jetables créés de novo et données
synthetic-only. `dbIntegrationTest` reste autonome, hors preuve rail et soumis à
son propre workflow. Ne jamais transposer les exemples historiques `:5432` au
rail.

La simple apparence loopback n'est pas une preuve de surete. Les 12 classes DB refusent toute URL autre que la valeur exacte, tout metadata/role/adresse/port/owner divergent, tout rôle privilégié ou membership privilégiée. Leur initializer valide avant Flyway ; chaque primitive revalide puis détruit sur la même connexion et transaction. Stopper si la task est `SKIPPED` ou si une garde refuse.

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

Pour `dbtest`, la datasource doit aussi rester locale et directe. Cette recette seed historique ne constitue jamais une autorisation pour les tests destructifs 043b, dont la cible et les gardes sont strictement plus étroites.

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
$env:RITOMER_DB_TEST_JDBC_URL='jdbc:postgresql://127.0.0.1:15432/ritomer_043b_test'
$env:RITOMER_DB_TEST_USERNAME='ritomer_043b_test_runner'
$env:RITOMER_DB_TEST_DESTRUCTIVE_CONSENT='TRUNCATE_RITOMER_043B_TEST'
if (-not (Test-Path Env:RITOMER_DB_TEST_PASSWORD)) { throw 'DB test password missing from local shell.' }
.\gradlew.bat dbIntegrationTest
```

## Stabilisation des pools dbtest M1.1B

Le profil `application-dbtest.yml` fixe uniquement pour dbtest
`spring.datasource.hikari.maximum-pool-size=2` et `minimum-idle=0`.
Les autres profils, les références aux variables, Flyway et les protections
de journalisation restent inchangés. Deux connexions par pool préservent le
scénario de verrouillage de `MappingSuggestionDecisionDbIntegrationTest`.

La régression non-DB de `DemoSeedLocalSourceGuardTest` charge le vrai YAML
et le lie à `HikariConfig`, sans DataSource démarré, connexion JDBC ni
résolution des variables locales. Elle découvre les douze classes FULL,
les confronte à l'inventaire Gradle et construit leurs véritables
`MergedContextConfiguration`, avec un delegate interdisant le chargement
d'un contexte. L'égalité Spring complète inclut propriétés, imports et
customizers ; le nombre de groupes n'est pas une constante de l'oracle.

L'inventaire courant produit les six groupes suivants, chacun avec un seul
DataSource Hikari autoconfiguré et un maximum effectif de deux connexions :

| Classes partageant la même clé de cache | Maximum cumulé du groupe |
|---|---:|
| BalanceImportPersistence, ManualMappingPersistence, MappingSuggestionDecision | 2 |
| Controls, FinancialStatementsStructured, FinancialSummary | 2 |
| Documents, Exports, Workpapers | 2 |
| PersistenceFoundation | 2 |
| DemoSeedLocalAuthMe | 2 |
| DemoSeedLocal | 2 |

Les noms du tableau abrègent les noms des classes d'intégration. Les
propriétés inline et celles issues des annotations sont prises en compte
avant le binding. Les sources de surcharge non prises en charge, les
routages DataSource/Flyway alternatifs, les imports supplémentaires et les
customizers inconnus font échouer la preuve. Le spy d'AppUserRepository est
représenté dans sa clé ; il ne crée pas de pool supplémentaire. L'unique
configuration de test importée fournit un wrapper d'audit.

La borne conserve tous les pools : **6 × 2 + 1 = 13 ≤ 16**, soit une marge
de **3 connexions**. Le `+1` réserve la connexion directe temporaire de
l'initializer de garde, fermée par `use` avant son retour. Les gardes métier
empruntent le pool ; Flyway doit réutiliser exactement le DataSource
applicatif, y compris dans les migrations manuelles des tests. Les deux
connexions simultanées du test de verrouillage sont déjà comprises dans son
pool et ne sont pas ajoutées une seconde fois.

Cette borne s'applique au worker FULL du rail existant :
`maxParallelForks=1`, lancement Gradle avec `--max-workers=1`, aucun
parallélisme JUnit activé dans la configuration examinée et phases targeted
puis full exécutées dans des processus successifs attendus jusqu'à leur
fin. Aucun crédit n'est pris pour l'éviction du cache, l'ordre des tests ou
un délai de libération. `minimum-idle=0` ne promet pas une fermeture
immédiate des connexions inactives. Toute nouvelle source de connexion ou
de configuration impose de réétablir ce budget.

Cette validation de binding, de métadonnées et de régressions est non-DB.
Elle ne prouve ni la cause historique exacte de la saturation, ni la
disparition réelle du SQLSTATE 53300, ni la réussite PostgreSQL du Lifecycle
ou la clôture de M1.1B. Ces preuves restent séparément autorisées.

## Interdiction des intermédiaires DB pour la preuve 043b

Les recettes historiques via `cloud-sql-proxy`, tunnel SSH ou port forward ne sont plus autorisées pour `dbIntegrationTest`. La garde courante M1.1B exige un serveur PostgreSQL 17 local direct observé à `127.0.0.1:15432`, la base et le rôle dédiés créés de novo, ainsi que des données exclusivement synthétiques. Aucun dump client, staging ou production ne peut être chargé.

Limite résiduelle acceptée pour le local synthétique : un tunnel sophistiqué capable d'imiter toutes les observations de la garde demeure un risque opérateur. Il ne vaut aucune readiness production ou externe.

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
