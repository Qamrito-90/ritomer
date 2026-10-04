# Runbook local-dev

Le raccordement Playwright M1.1D du 21 septembre 2026 et ses correctifs sont
décrits en fin de runbook. Leurs preuves hors DB restent distinctes du résultat
intégré ultérieur de candidate-05, résumé ci-dessous.

## Parcours courant M1.1D — fondation locale livrée

A/B/C et D accomplissent la fondation M1.1 locale/synthétique. D est livré par
la [PR #127](https://github.com/Qamrito-90/ritomer/pull/127), squash
`3d1fad45cf930f446aba50d2e328958cfb1d812a` du 04.10.2026. La
[spec 046 Done](../specs/done/046-authenticated-session-foundation-v1.md) est classée close
dans ce candidat documentaire, sans spec active ; sa publication reste à
autoriser. M1 complet et M1.2 restent non livrés.

C1 puis C2 ont validé candidate-05 le 03.10.2026, RunId
`966fa4bc77034e158d4602431b77f606`, avec PostgreSQL et navigateur réels sur
données synthétiques : targeted 13/13 et full 55/55. Cleanup confirmé et
cessation corroborée sont des observations datées, sans constat actuel de la
machine ni réexécution sur le squash. La correction CI et le push post-merge
du 04.10.2026 ont renouvelé 593 résultats backend et 1 267 réussites frontend
avec dix skips Windows-only ; les 1 277 réussites Windows locales du
03.10.2026 restent distinctes. Le bilan, les sources et les réserves
`F-FINAL-HISTORY-01`/logout02 figurent au §15 de la spec.

Les records C1-04/C2-04 et ceux de #127 restent consommés ; ce runbook
n'autorise aucune relance, setup, connexion PostgreSQL, exécution navigateur
ou cleanup. Les inventaires et marqueurs négatifs des checkpoints historiques
ci-dessous conservent leur portée d'origine, même lorsqu'ils citent active/046.

Le parcours local canonique utilise le profil `local`, la session serveur et
le cookie `__Host-ritomer-session`, sans HMAC ni bearer. Un seul Vite écoute
`http://127.0.0.1:5173` avec `strictPort`; `/api` cible exactement
`http://127.0.0.1:8080`, avec `changeOrigin=true`, `xfwd=false`, sans injection
Authorization, réécriture de cookie ou d'Origin. Build et preview n'ont pas
de proxy. Les deux démarrages successifs de Vite utilisent `--force` pour
reconstruire les dépendances optimisées sans réutiliser un cache antérieur.
`application-dev.yml` reste une compatibilité backend legacy
explicitement séparée, jamais activée par ce parcours.

Le rail existant `backend/scripts/m1-1b-postgresql-rail.ps1` conserve ses
modes `Preflight` et `Lifecycle`. `Campaign=B` reste le défaut historique ;
`Campaign=D` sélectionne le cycle intégré fermé. `LifecycleAction=Run` est
le défaut ; `LifecycleAction=CleanupOnly` est réservé à la reprise D du
run initial. Ces paramètres ne valent pas autorisation. Aucun `bootRun`,
seed, harness ou `dbIntegrationTest` autonome ne remplace le cycle D.

Après review des artefacts exacts et autorisations sensibles distinctes,
l'ordre requis est :

1. Preflight distinct, puis lock, contrôle de quarantaine et readiness sans
   credential runner pour Lifecycle ;
2. provision de novo, bootstrap `seed` terminé, bootstrap `backend` prêt ;
3. Vite provisoire et preuve cookie navigateur, puis arrêt attesté du Vite ;
4. harness et son unique Vite, deux jars mémoire isolées, ACCOUNTANT,
   REVIEWER puis ADMIN, preuves jars et navigateur liées au run ;
5. fin explicite, logout et purge des jars, arrêt attesté du harness, de
   Vite et du backend, puis ports 5173/8080 libres ;
6. targeted, full, cleanup et résultat terminal.

`PostgresTestRailDBootstrap` réutilise l'application, le seed et la garde
commune. Il neutralise pgJDBC, impose sa projection prioritaire fermée et
exécute l'initializer avant refresh/Flyway. Après refresh, il vérifie
l'unique DataSource et son identité avec Flyway avant le seed ou READY.
Les phases `d-seed` et `d-backend` partagent
`volatile/integrated/local-fs`; les resets SQL et storage y sont refusés
avant connexion. Targeted/full conservent les contrats destructifs de B.
Le runtime intégré contient le runtime main et les seules classes support
compilées sélectionnées, jamais le testRuntimeClasspath complet. La
readiness existante en lie le digest ; aucun nouveau nom de tâche rail et
aucune compilation sous credential runner ne sont introduits.
Le classpath validé passe par un fichier d'arguments Java fermé, créé et
synchronisé avant lancement, dont le hash est lié aux receipts ; cette
forme respecte la limite Windows de longueur de ligne de commande.
Preflight lie également le digest de Node et des dépendances frontend,
comparé à nouveau avant le provisionnement Lifecycle.

Chaque processus D est confiné avant sa reprise dans un Job Object nommé
pour son run et son rôle fermé, avec kill-on-close, sans breakaway et sans
héritage du handle de job. Toute collision est refusée. Les sorties sont
drainées simultanément et bornées. La branche administrative fermée
`ADMIN_PSQL` utilise pour D `psql -w` sans invite ni fenêtre, avec le SQL fixe
en mémoire et les trois flux redirigés. Les gardes d'identité, de namespace,
de lancement suspendu et de confinement restent obligatoires ; seule la
dépendance à une console interactive est remplacée par la lecture fermée du
fichier local ci-dessous. La connexion non interactive réelle est prouvée
dans la campagne candidate-05 du 03.10.2026, sans autorisation de nouvelle
connexion. B conserve son prompt `psql -W`.

### Mot de passe administratif local de D

La source unique est `C:\dev\ritomer-local-secrets\postgres-test.env`, hors
repository. Elle contient exactement `RITOMER_TEST_PG_PASSWORD=` puis la valeur
choisie par Luis, en UTF-8 strict, au plus 4096 octets. Un BOM UTF-8 et une seule
fin de ligne LF ou CRLF sont admis. Valeur vide/blanche, caractères de contrôle,
lignes supplémentaires, autre clé, encodage invalide et reparse points sont
refusés. Tout caractère restant, y compris espace, dollar, guillemet ou `=`,
est littéral ; aucune expansion, exécution, suppression de guillemets ou trim.

Les refus sont `D_ADMIN_PASSWORD_FILE_MISSING` ou
`D_ADMIN_PASSWORD_FILE_INVALID`, avant démarrage de psql. Après la readiness,
le rail lit ce fichier à chaque phase administrative et fournit la valeur
uniquement dans `PGPASSWORD` du `ProcessStartInfo` psql. Il retire cette entrée
après le lancement et en finalisation. Aucune variable du processus parent,
variable persistante, argument, stdin SQL ou autre enfant ne reçoit la valeur.
Tout `PG*` ou `RITOMER_TEST_PG_PASSWORD` hérité reste interdit. Un échec natif
reste un échec, sans prompt de secours ; délais et finalisations sont inchangés.

La configuration initiale est une action locale distincte à autoriser : saisir
une seule fois le mot de passe de test existant dans un prompt local masqué,
créer le fichier exclusivement avec `CreateNew` et une ACL protégée pour
l'utilisateur courant et SYSTEM, puis libérer les buffers. Refuser un fichier
existant sans le lire ni l'écraser. Le script exact de mise en service préparé
dans le FEP est revu et lié à son SHA-256 avant exécution. Ne jamais communiquer
la valeur dans le chat, une commande, un log, un reçu, un hash ou le FEP.
Ne pas changer le mot de passe du rôle PostgreSQL, ne pas en générer un autre,
et ne jamais réutiliser cette valeur en production. Le secret runner jetable
et son cycle de vie restent inchangés. Les tests utilisent exclusivement des
fichiers et valeurs fictifs ; ils ne prouvent pas une authentification réelle.

Les messages de contrôle sont rattachés au processus propriétaire et au
run. `M1D_FINISH <RunId>` demande la fin ; seule l'attestation
`M1D_HARNESS_STOPPED <RunId> JARS=PASS VITE_STOP=PASS`, corroborée par le rail,
permet de poursuivre. Le rail vérifie lui-même les jobs et ports avant
toute destruction. Une sortie zéro seule, EOF, Ctrl+C, timeout, enfant mort,
message manquant, dupliqué ou imité ne vaut jamais PASS.
`M1D_LIFECYCLE_RESULT <RunId> PASS` exige aussi targeted, full et cleanup.
Aucun receipt navigateur ne peut être prérempli par les tests offline.

Le lecteur du runtime D utilise les API fichier .NET avec namespace de
chemin long uniquement après validation de l'orthographe canonique DOS/UNC.
Il conserve le refus des reparse points, l'inventaire exhaustif, les types,
les bindings et les empreintes ; il ne normalise pas un chemin ambigu pour
l'accepter. Cela couvre les classes compilées dépassant 260 caractères sous
Windows PowerShell Desktop 5.1, sans modification Windows ou JDK.

Le payload de `d-terminal.json` version 1 porte `diagnostics` version 2 :
`{schemaVersion:2, primary:null|{stage,operation,category,childRole,control}, secondary:[]}`.
`primary` est le premier échec chronologique, `secondary` les suivants dans
l'ordre. `stage` appartient aux phases D ; `operation` est une valeur fermée
de `Set-M1DDiagnosticOperation`, vérifiée à nouveau avant publication et
lecture. Les catégories sont `UNEXPECTED_FAILURE`, `ACCESS_DENIED`,
`PATH_NOT_FOUND`, `PATH_TOO_LONG`, `IO_FAILURE`, `PARAMETER_BINDING`,
`INVALID_VALUE`, `TIMEOUT`, `CONTROLLED_STOP`. Aucun message, cible d'erreur,
pile, argument, environnement ou hash de secret n'entre dans ce diagnostic.
`childRole` est `NONE` ou un rôle intégré fermé ; `control` est un code de
supervision explicitement admis par `Get-M1DControlCode`, sinon `UNCLASSIFIED`.
Un suffixe d'exception inconnu ne devient jamais un code publié.
Les champs historiques `primaryStop`/`cleanupStop` restent présents ; les
exceptions contrôlées capturées par Lifecycle D y sont désormais réduites à
`D_CONTROLLED_FAILURE`, les autres à `UNEXPECTED_FAILURE`, pour empêcher un
suffixe d'exception arbitraire de devenir une sortie. L'opération et la
catégorie, le rôle et le contrôle portent le détail exploitable. La campagne B reste inchangée.

La finalisation d'un enfant draine uniquement ses propres flux. Un contrôle
de sortie déjà signalé n'est pas réémis pour bloquer un autre enfant ; un
nouvel échec reste enregistré à sa place chronologique. La terminaison native
et le drainage final partagent un plafond de 30 secondes, limité par le budget
global restant. Une erreur de lecture ou un flux tardif n'est jamais transformé
en EOF ni en succès du scénario. Le reçu d'arrêt atteste exclusivement le root
terminé et le job vide, vérifiés nativement. Le nettoyage demeure soumis aux
bindings de lancement, à la cessation globale attestée, aux ports libres et à
la provenance PostgreSQL exacte. Une erreur de scénario reste FAIL même si la
cessation et le nettoyage peuvent être prouvés indépendamment.

La voie D mémorise l'échéance de finalisation une seule fois par enfant : au
plus 30 secondes, bornées par le budget global restant. Terminaison native,
attente de racine signalée **et** job vide, drainage et libération utilisent le
même reliquat. Une erreur de lecture d'un prédicat reste un échec. Le reçu
n'est tenté qu'après vérification des deux conditions, avant libération.
La libération D est dédiée : elle n'ajoute pas l'attente fixe de 30 secondes
du `Dispose` historique et ne change pas ses autres appelants. Les fermetures
indépendantes et l'effacement sensible restent tentés après un refus de reçu ;
leurs échecs conservent rôle et phase fermés sans message natif brut.
La première erreur et les suivantes restent enregistrées ; les autres enfants
sont toujours tentés. Une seconde entrée réémet l'échec conservé sans nouvelle
échéance ni lecture de handles fermés. Aucun échec de reçu ou de finalisation
n'est effacé par un retrait du registre : `cleanupStop` et la barrière restent
bloquants. La libération ne constitue jamais une preuve de cessation.
Une cessation ou une finalisation observée hors échéance reste un échec,
même si les prédicats deviennent vrais ; les fermetures restent tentées avec
le reliquat nul. Un reçu écrit avant un échec ultérieur demeure historique
et ne suffit pas à autoriser la destruction.

Une erreur de finalisation ne remplace jamais la première. Si la publication
terminale échoue, la ligne `M1D_LIFECYCLE_DIAGNOSTIC <JSON>` fournit la même
structure filtrée, enrichie de cette erreur, puis le rail échoue avec
`D_TERMINAL_PUBLICATION_FAILED`. Une erreur de libération du lock est traitée
de même avec `D_LOCK_RELEASE_FAILED`. Aucun signal PASS n'est émis avant la
publication, ses contrôles et la libération du lock. Un receipt déjà créé
reste immuable ; un échec ultérieur peut donc être attesté uniquement dans
la sortie finale, qui interdit de conclure à partir du seul receipt.
Le lecteur accepte les anciens terminaux sans `diagnostics` ou avec son schéma
version 1 à trois champs, et valide strictement la version déclarée lorsqu'elle
existe ; cela ne renouvelle aucune preuve
ancienne ni autorisation consommée.

Les plafonds sont des limites, pas des durées mesurées :

| Phase | Plafond |
|---|---:|
| Preflight D | 40 min |
| Readiness Lifecycle | 30 min |
| Provision | 5 min |
| Seed | 5 min |
| Démarrage backend | 2 min |
| Intégration jars/navigateur, dont attente idle de 32 min | 60 min |
| Arrêt intégré | 1 min |
| Targeted | 20 min |
| Full | 20 min |
| Cleanup | 5 min |
| Autres contrôles, terminaisons, scans et manifestes Lifecycle | 7 min |
| Lifecycle total | 155 min |
| Campagne Preflight + Lifecycle | 195 min |

Les échéances monotones ne sont renouvelées ni par une sortie, ni par une
sonde ; le temps d'arrêt et de cleanup est réservé. Les plafonds B restent
inchangés : readiness 30 min, targeted/full 20 min, psql 5 min, arrêt d'arbre
30 s, 8 388 608 caractères par flux Java et 65 536 par flux psql. L'attente
du prompt admin est incluse dans les 5 minutes ; aucun retry implicite.

Le marqueur global persistant de quarantaine et les receipts fermés
(`CreateNew`, synchronisation disque) survivent à la disparition du parent.
Une nouvelle campagne reste bloquée tant que le run n'est pas libéré,
même sans lock vivant ou si un receipt est illisible. L'intention précède
le provisionnement ; les identités DB et intentions/lancements/arrêts de
processus sont liés aux artefacts exacts. Les receipts sont conservés après
le cleanup vérifié.

`CleanupOnly` exige une nouvelle autorisation sensible liée au run initial,
à l'exécuteur courant exact, au binaire, à l'environnement et à la commande.
Les pièces historiques gardent leur identité d'origine selon la liaison
fermée décrite ci-dessous ; les autres reprises conservent l'identité unique.
Il ne
compile, ne provisionne, ne seed et ne lance aucun test. Il consulte les
jobs D existants sans les recréer ni adopter ou tuer un processus inconnu.
La disparition du PID parent ne prouve pas l'arrêt des descendants. Un job
absent n'est recevable qu'avec le résultat natif exact d'absence, des
receipts complets de confinement et les preuves d'identité/cessation dans
le même contexte Windows. Reboot, identité, namespace ou provenance
incertains maintiennent la quarantaine. Cluster, postmaster, OID et
provenance restent stricts ; aucun OID zéro n'est un wildcard. Une cible
déjà supprimée n'exonère pas de vérifier exactement celle qui subsiste.
La reprise a un plafond propre de 12 min (cleanup 5, contrôles 7), sans
retry ; son succès ne transforme jamais une campagne échouée en PASS.
Les noms de receipts de reprise sont uniques au run : une reprise échouée
après son intention de lancement ne peut pas être répétée à l'identique.
Si l'échec précède son retrait, la quarantaine reste en place. Après un échec
tardif, elle peut déjà être absente : cette absence ne prouve ni la clôture
complète ni l'autorisation d'une campagne suivante. Un terminal candidat
favorable isolé ne prouve pas la réussite des contrôles et finalisations
qui le suivent. Toute autre action sensible doit être exactement revue et
autorisée.

### Liaison fixe historique H / exécuteur E pour la reprise bornée

Une seule compatibilité est définie : `Campaign=D`, `Mode=Lifecycle`,
`LifecycleAction=CleanupOnly`, RunId `5b6936c097c9472d85f697348cfd756a` et
RunRoot exact
`C:\dev\ritomer-local-evidence\m1-1b-postgresql\5b6936c097c9472d85f697348cfd756a`.
Le dispatcher sélectionne un tuple fixe dans le code. Aucun paramètre CLI,
champ de reçu, liste de hashes libre ou flag ne sélectionne une origine.
Cette définition ne constitue pas une autorisation de récupération.

`ReviewedObjectSha256` identifie toujours le composite E effectivement
exécutant ; les contrôles des sources et de l'état Git restent sous E et
le hash du script est calculé sur ce script. H désigne exclusivement :

| Objet historique | SHA-256 |
|---|---|
| Composite H | `a26d18378f40572974a9c22b137063bd4afab0fa323f584902c79af5c04e97d2` |
| Rail H | `66ee9ca05593ecf91cc0a6f075e76144314ff32afe60c869013320d10befe139` |
| `d-campaign.json` | `ff16d868c52930c9870df47ab1340dae2dee500ac247f18906e22690c0befe74` |
| `d-provision.json` | `4c36f8a8669494c8746889fffdeb2c235083576af8b03466890d561014c96eb6` |

Campagne et provision sont comparés à leurs ancres fixes, en plus de leurs
sidecars. Les lancements historiques Preflight attendent H et l'autorisation
C1 liée à la campagne ; les historiques Lifecycle attendent H et son
autorisation de campagne. La provenance PostgreSQL reste celle de H,
identique entre campagne et provision. Aucun ancien reçu ou sidecar n'est
migré ; les anciens `stopped` absents ne sont pas créés.

Les cinq nouvelles pièces `d-launch-recovery-ADMIN_PSQL_CLEANUP-intent.json`,
`d-launch-recovery-ADMIN_PSQL_CLEANUP-confined.json`,
`d-launch-recovery-ADMIN_PSQL_CLEANUP-stopped.json`, `d-recovery-cleanup.json`
et `d-recovery-terminal.json` ont une enveloppe fermée `schemaVersion=2`.
E et la nouvelle autorisation restent dans les champs courants.
`recoveryOrigin` contient exactement `reviewedObjectSha256`, `scriptSha256`,
`campaignReceiptSha256` et `provisionReceiptSha256`, avec les valeurs H du
tableau. Le writer les tire du contexte validé, jamais de son payload.
Toute récupération préexistante, sidecar seul compris, est refusée avant SQL.
Les écritures exclusives et sidecars sont conservés. Avant retrait du marqueur,
le rail revalide campagne historique et quarantaine, puis `recovery-cleanup`
sous E, sa nouvelle autorisation, son origine H exacte et `targetsAbsent=true`.

Le contexte est un paramètre explicite de l'orchestration, des lecteurs,
du writer et des validateurs. Une variable locale à `CleanupOnly` le transporte
à travers `CleanupPsql` inchangé ; `DirectPsql` valide cette portée avant de
le transmettre explicitement aux reçus de lancement et d'arrêt. B, Preflight,
Lifecycle Run et les autres runs CleanupOnly ne gagnent aucune compatibilité H/E.
SQL, cibles, namespace, contrôleur, PID/ticks, jobs, ports, budgets et ordre
de retrait de quarantaine restent inchangés.

Dans D, le code psql non nul est reconnu après capture complète des flux et
avant construction/hash du résultat et finalisations. Les trois contrôles
fermés sont `PSQL_PREFLIGHT_EXIT_NONZERO`, `PSQL_PROVISION_EXIT_NONZERO` et
`PSQL_CLEANUP_EXIT_NONZERO`. Le parser strict reste obligatoire sur zéro ;
la branche B ne change pas. `CleanupOnly` conserve la première erreur du
corps, tente la vraie libération du verrou et collecte séparément son échec.
Le diagnostic fermé existant est restitué sans remplacer l'erreur initiale
par une erreur de validation, sérialisation ou sortie. Aucun résultat nominal
n'est rendu avant réussite de toutes les finalisations. Ces règles n'ajoutent
pas de terminal diagnostique C1 et ne déclarent aucune récupération accomplie.

La QA navigateur future doit enregistrer navigateur/version/origine exacts,
cookie Secure/HttpOnly et round-trip, CSRF, expiration, refus métier,
reconnexion explicite, déconnexion, focus/multi-tab, safe return,
accessibilité et privacy. Elle ne revendique pas de séparation humaine des
fonctions à partir de deux jars synthétiques.

## Pré-requis historiques des recettes backend
- JDK 21
- une instance PostgreSQL accessible directement, locale ou distante
- aucun Docker Desktop requis
- accès GCP non requis pour le développement local initial
- la cible de production reste Cloud SQL for PostgreSQL

## Commandes non-DB
Depuis la racine du repo, pour les validations sans démarrage intégré :

- `cd backend && ./gradlew test`
- `cd backend && ./gradlew windowsTest`
- `cd backend && ./gradlew build`

## Rail PostgreSQL lean M1.1B

Cette section conserve le contrat historique B et ses marqueurs contrôlés.
Les compléments D ci-dessus ne réécrivent ni ses preuves ni ses autorisations.

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
`UseShellExecute=false`. Les neuf tokens d'arguments de B, dans cet ordre,
sont (D remplace seulement `-W` par `-w`) :

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

Aucun secret admin ne traverse Gradle, Java, Kotlin, Spring ou Flyway.
Pour B, il n'existe ni variable admin, ni fichier password, ni `PG*` : la seule
saisie admise reste le prompt masqué natif de `psql -W` sur une console Windows
attachée. Pour D, le fichier local et le seul `PGPASSWORD` enfant suivent le
contrat ci-dessus. Aucune URL credentialée ni argument secret n'est admis.
L'environnement du child est
reconstruit par allowlist ; `HOME`, `USERPROFILE` et `APPDATA` pointent vers
un dossier neutre neuf sous le root du run. Tout `GIT_*` hérité est également
refusé ; les lectures Git utilisent le binaire ordinaire exact
`C:\Program Files\Git\cmd\git.exe` et un environnement fermé.

Le rail expose exactement `Preflight` et `Lifecycle`. Dans les deux modes, la
readiness Gradle doit avoir entièrement terminé avec `PASS` avant le contrôle
de console B, la lecture du fichier D ou tout lancement psql. Gradle conserve seulement :

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

Pour Campaign D, C1 résout les dépendances online dans son cache neuf
`<RunRoot>\volatile\preflight-readiness\gradle-home`. Après les reçus de
cessation READINESS, le manifeste scelle son chemin relatif, l'algorithme
`SHA256-TREE-V1` et son digest (chemins triés, types, tailles et contenus,
sans timestamps). C2 vérifie manifeste/sidecar, bindings, cessation C1,
confinement, distribution wrapper installée et intégrité du cache avant son
premier enfant. Une absence, altération, reparse ou origine différente arrête
avant Gradle ; aucun cache personnel ni téléchargement de secours.
Les trois enfants Gradle de Lifecycle D — readiness, targeted et full —
réutilisent directement ce même cache avec `--offline`. Leurs build/child/
project-cache/temp restent distincts de C1. Aucun paramètre ou geste opérateur
supplémentaire, aucun transfert entre runs. Le cache n'est pas re-fingerprinté
après utilisation : Gradle peut modifier ses métadonnées. Le runtime SHA reste
réellement recomposé et comparé avant provisionnement, et tous les autres
contrôles restent actifs. `--offline` n'est pas un pare-feu général ; le wrapper
doit déjà être installé et intact. Campaign B, budgets et horloges sont inchangés.

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

Recettes historiques 043b, conservées pour lecture et non exécutables comme parcours D :

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

Correction documentaire R2 de la PR #122 : l'ancienne recette autonome
était incomplète. R2 désigne ce finding, sans rapport avec la répétition
043c R2 jamais exécutée. Les variables DB usuelles et le consentement seuls
ne satisfont pas la garde actuelle : les bindings run/root, phase, storage,
cluster/postmaster, OID, provenance et artefacts sont aussi requis. Aucune
valeur ne doit être inventée ou copiée d'un ancien run pour la satisfaire.
Cette correction ne rouvre pas B et n'autorise aucune exécution autonome.

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

Recette historique, distincte du bootstrap gardé D ; elle n'est pas le
démarrage canonique de l'intégration session et n'en prouve aucun gate.

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

Les exemples de démarrage/bearer de cette section sont historiques. Ils ne
définissent ni l'authentification canonique D ni une activation IA actuelle.

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

Snapshot de la recette 036c, remplacée pour le parcours courant par la
session M1.1D décrite en tête. Les variables bearer et le second port ne
sont plus acceptés par Vite/harness ; ne pas exécuter ces exemples pour D.

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
- `./gradlew dbIntegrationTest` reste opt-in, sensible et hors preuve rail.
  L'ancienne recette courte est retirée car elle omettait les bindings de
  provenance requis (R2 de PR #122). Utiliser uniquement une mission
  distincte, revue et explicitement autorisée ; le cycle D utilise les
  tâches targeted/full existantes après arrêt intégré attesté.

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

Exemples historiques de sondes manuelles ; la campagne D exécute ses
contrôles fermés uniquement sous son autorisation sensible exacte.
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


## Qualification autonome de l'outillage Playwright

Ce smoke test utilise exclusivement une page HTTP factice sur 127.0.0.1,
un port attribué automatiquement et des données synthétiques. Il ne démarre
ni Ritomer, ni Vite applicatif, ni PostgreSQL, ni le rail ou les anciens témoins.
Il ne valide pas M1.1D, l'authentification Ritomer, le cookie Secure __Host-,
le CSRF, l'expiration ou les contrôles métier.

La devDependency @playwright/test est verrouillée à 1.63.0 dans le manifeste
et le lockfile. Utiliser le Node et le pnpm du projet ; aucune extension,
connexion CDP, configuration de navigateur personnel ou profil persistant
n'est nécessaire. Le navigateur est Chromium Headless Shell géré par Playwright.

Après installation des dépendances frontend, exécuter depuis frontend dans
un mandat local autorisé. La protection du cache empêche la collecte des
navigateurs préexistants ; restaurer la présence et la valeur initiales du flag.

```powershell
$toolingHadGc = Test-Path -LiteralPath 'Env:\PLAYWRIGHT_SKIP_BROWSER_GC'
$toolingPreviousGc = $env:PLAYWRIGHT_SKIP_BROWSER_GC
try {
  $env:PLAYWRIGHT_SKIP_BROWSER_GC = '1'
  pnpm exec playwright install chromium --only-shell
  if ($LASTEXITCODE -ne 0) { throw 'Échec de l’installation du navigateur de test.' }
} finally {
  if ($toolingHadGc) {
    $env:PLAYWRIGHT_SKIP_BROWSER_GC = $toolingPreviousGc
  } else {
    Remove-Item -LiteralPath 'Env:\PLAYWRIGHT_SKIP_BROWSER_GC' -ErrorAction SilentlyContinue
  }
}
pnpm test:browser
if ($LASTEXITCODE -ne 0) { throw 'Échec du smoke Playwright.' }
pnpm test:ci
if ($LASTEXITCODE -ne 0) { throw 'Échec de Vitest.' }
pnpm lint
if ($LASTEXITCODE -ne 0) { throw 'Échec du lint frontend.' }
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'Échec du build frontend.' }
```

Un seul test vérifie le cookie HttpOnly factice reçu par HTTP et réellement
renvoyé au serveur, localStorage après rechargement, le partage entre deux
onglets A, l'isolation du contexte B et sa survie après fermeture de A.
Les fixtures ferment serveur et contexte B en finally ; le runner possède
le contexte A et le navigateur et les ferme aussi après un échec. Les erreurs
de teardown restent rapportées par Playwright sans remplacer l'erreur du test.

La configuration impose un worker, zéro retry, un délai de test de 20 s,
5 s pour assertions/actions/navigations et fixtures locales, 10 s au lancement
du navigateur et 60 s pour le run. Le reporter list est textuel, avec étapes
et version effective du navigateur. Trace, vidéo et screenshot sont désactivés ;
aucun HAR ou état d'authentification n'est enregistré.

Le répertoire frontend/out/playwright-tooling-smoke est réservé aux sorties
ordinaires du runner, qui peut le réutiliser et en supprimer les sorties
précédentes. Ne jamais y placer de pièce historique. Aucun nettoyage de cache,
profil ou autre processus n'accompagne ce test.

Vitest conserve sa commande test:ci et ses exclusions par défaut ; seul e2e/**
est exclu. Les tests existants à la racine frontend restent exécutés.
La configuration par défaut découvre uniquement e2e/tooling-smoke.spec.ts. Le contrôle TypeScript et le
lint incluent la configuration et le smoke ; aucune règle n'est désactivée.

## Raccordement Playwright M1.1D — composition hors DB du 21 septembre 2026

La base est `c7857e3180f4ba02c49f6713ecedba3f7d3eb7c5`, dans le worktree
`C:\dev\ritomer-m1-1d-playwright`, branche `codex/m1-1d-playwright-integration`.
La source `C:\dev\ritomer` reste conservée. Les 28 chemins D sont reportés sur
main sans réintroduire les lots livrés. Le delta autorisé est M5/A4 ; le
composite est M29/A4, 33 chemins exacts, créations comprises dans le diff revu.
Les bindings historiques D ne sont pas des autorisations pour ce composite.

Le correctif Cache-Control du 1er octobre 2026 portait le composite à
**M31/A4, 35 chemins exacts**. Les deux ajouts au file-set sont les fichiers déjà suivis
`backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/SessionController.kt` et
`backend/src/test/kotlin/ch/qamwaq/ritomer/identity/api/LocalTestSessionControllerSecurityTest.kt`.
Le raccordement historique de neuf fichiers et ses quatre créations ci-dessus restent
inchangés ; le contrôle exact des chemins, statuts et de l’index reste obligatoire.

Le correctif d'expiration préparé le 3 octobre porte le candidat courant à
**M33/A4, 37 chemins exacts**, avec `frontend/src/lib/api/session.ts` et
`frontend/src/lib/api/session.test.ts`, déjà suivis. Le delta D comporte désormais
onze chemins ; les baselines et preuves historiques de 35 chemins sont conservées.
Après un bootstrap 401 d'une session prête, le coordinateur publie immédiatement
`EXPIRED`, puis draine le flux original sans retenir son contenu ni attendre sa
fin avant une reconnexion explicite. Ce drainage est limité à 64 KiB et cinq
secondes ; dépassement, abandon de génération ou dispose annulent le lecteur.
Il ne publie aucun état et ne remplace pas la preuve navigateur du JSON
`SESSION_EXPIRED`, des 32 minutes réelles ou de la C2 complète.

Le rail lance deux enfants finis, `BROWSER_COOKIE` avant le harness, puis
`BROWSER_JOURNEY` après `M1D_JARS_RESULT`. Ils utilisent Playwright Test 1.63.0,
la configuration `frontend/e2e/m1d/playwright.config.ts` et le Chromium complet
déjà installé, révision 1200, en mode headless. Seule sa distribution d'exécution fermée est
inventoriée, avec Node et node_modules, dans le digest frontend existant.
Aucun téléchargement, profil personnel, endpoint CDP TCP, navigateur externe
ou paramètre de lancement libre n'est utilisé. Le projet cookie garde le lancement
Playwright ; Journey utilise son propre processus Chromium et le transport public
CDP sur ses seuls pipes privés, avec `noDefaults` pour le contexte A par défaut.
Les deux onglets A produisent ainsi des changements natifs de focus/visibilité ;
B et B recréé restent des contextes incognito indépendants. Les téléchargements
sont explicitement refusés dans tous ces contextes. Les enfants héritent du confinement natif D,
d'un environnement neutre sans secret DB et de l'échéance intégrée commune.

Le profil Journey est créé sous le TEMP neutre de cet enfant et n'est jamais un
profil personnel. Sa finalisation ferme les pages et les contextes incognito,
puis demande `Browser.close` avant de couper le pipe. Un reçu positif exige la
sortie native 0 du processus détenu, la disparition des contextes et la suppression
confirmée de ce seul profil neuf, après vérification de sa cible et de ses liens.
Une simple déconnexion CDP ne prouve pas cette cessation. Les bornes existantes
de finalisation et le contrôle indépendant du Job Object vide restent obligatoires.

La résolution locale autorisée du 3 octobre 2026 conserve les anciens runs
one-shot consommés. Chaque nouvelle campagne exige un nouveau RunId, les deux
préparations exactes revues avant C1 et de nouveaux records techniques liés au
mandat owner `ODR-20261003-M1D-AUTONOMOUS-RESOLUTION-01`. La transition C1→C2
reste conditionnée au C1 de ce run et à sa review native fraîche ; limites
40/155/195 minutes et départ C2 au plus tard T0+35 inchangés. Cette préparation
ne constitue ni un PASS intégré ni une autorisation de delivery Git.

Les projets `cookie` et `browser` ne démarrent aucun serveur. Le rail demeure
propriétaire du Vite provisoire, puis le harness du Vite unique de la seconde
phase. La configuration par défaut de `pnpm test:browser` reste le smoke livré.
Ne jamais lancer directement le parcours D en lui fabriquant un environnement.

Le premier test observe Set-Cookie (dont l'absence de Domain), l'acceptation du
cookie, la continuité anonyme, le login 204, la rotation, le bootstrap
authentifié et me 200. Le second passe par les écrans, une note de justification
sur le dossier synthétique, le refus réel CSRF d'une seule requête applicative
(puis retrait de l'altération), la renégociation sans rejeu, les rôles distincts,
les événements natifs focus/visibilité, le clavier et la largeur étroite.
L'attente d'inactivité dure 32 minutes réelles ; tous les onglets A sont
observés passivement. Une requête invalide l'intervalle sans remettre son
compteur à zéro. Expiration, effacement, reconnexion explicite et safe return
sont observés ensuite. B est réauthentifié séparément avant la déconnexion A :
sa propre expiration n'est pas imputée à A. La déconnexion vérifie le 204,
l'invalidation de l'ancien credential, l'anonymat et les onglets ; une nouvelle
session anonyme issue du bootstrap peut posséder un cookie.

Les seules pièces exportées sont des mesures, attributs, comparaisons et
comptages fermés. Les fenêtres privacy sont anonymous, authenticated, folder,
write, csrf, roles, before-idle, expired, reconnected et logout ; le premier
test couvre les deux premières. Les mutations DOM, URL, console et messages
inter-onglets sont observés en mémoire ; les stockages et IndexedDB sont lus
aux transitions. Il n'est pas revendiqué d'observation de toutes les écritures
transitoires de stockage entre deux transitions. Perte, dépassement de capacité
ou transition non observée empêche PASS. Aucun dump brut, HAR, trace, vidéo ou
screenshot n'est produit.

`PLAYWRIGHT_NO_COPY_PROMPT=1`, exclusivement dans l'environnement D, empêche
l'instantané automatique de page de Playwright 1.63.0. Il ne supprime pas
error-context.md : les erreurs sont donc filtrées à la frontière du test avant
leur persistance. Le reporter public refuse stdout/stderr, erreurs globales,
retries, skips, interruptions et transport incomplet. Il déclare maîtriser la
sortie pour empêcher le reporter standard implicite. Worker et reporter
échangent un attachment filtré ; aucune mémoire partagée n'est supposée.

Le contrôle cookie conserve le premier échec avec sa sous-étape, le dernier
contrôle terminé lorsqu'il est établi et les observations disponibles à cet
instant. Les attentes bootstrap/me sélectionnent origine, chemin, méthode et
requête postérieure à l'action ; elles observent le statut avant JSON ou UI.
Une opération asynchrone conserve son propre repère, y compris après un rejet
tardif. `null` signifie non observé ou indisponible, jamais un succès ou un zéro
implicite. Un fait hors contrat est écarté sans effacer les autres faits valides.
Le diagnostic historique version 1 ferme `source`, `step`, `lastCompleted`, `reason`,
`metric` et `facts` : source `BROWSER`, `REDUCER` ou `REPORTER` ; seule la
réduction renseigne le nom fermé de la métrique refusée. Les faits se limitent
aux statuts HTTP 100–599, états/codes API autorisés (`OTHER` pour code inconnu),
comptages entiers 0–1000000, masques 0–31 et comparaisons booléennes. Aucune
valeur, empreinte ou longueur de secret n'y entre. Les comparaisons de cookie
restent en mémoire et les critères PASS restent ceux du réducteur existant.

Le parcours sélectionne d'abord le premier article contenant une note, puis
la note et son bouton dans cet article. Une reproduction Chromium isolée avec
deux articles établit que l'ancien `has: note.first()` associait le bouton à
plusieurs articles et provoquait un refus strict de Playwright. Ce défaut est
corrigé ; la sous-étape précise du run historique `fe42fefd1d01416ca93f780051930bae`
n'a pas été conservée et sa cause exacte reste non déterminée.

Un échec du projet browser transporte maintenant `browserDiagnostic` version 1
dans l'attachment filtré, puis une unique ligne stdout du reporter
`M1D_BROWSER_DIAGNOSTIC ` suivie de JSON et LF, au plus 8192 octets. L'enveloppe
exacte est `{schemaVersion,runId,objectSha,runtimeSha,frontendSha,diagnostic}`.
Le détail exact est `{schemaVersion,source,step,lastCompleted,reason}`.
`source` vaut `SCENARIO`, `REPORTER` ou `PUBLICATION`. Les étapes scénario
sont `BINDING`, `LAUNCH`, `CONTEXT`, `COOKIE`, `OPEN_FOLDER`, `FIND_NOTE`,
`SAVE_NOTE`, `RELOAD_NOTE`, `CSRF_REFUSAL`, `REVIEWER_ROLE`, `FOCUS_VISIBILITY`,
`IDLE`, `EXPIRY`, `RECONNECT`, `ISOLATED_REVIEWER`, `LOGOUT`, `SHARED_LOGOUT`,
`PRIVACY` et `FINALIZATION`. Les deux autres sources portent leur propre
étape et `lastCompleted=null`. Le dernier contrôle terminé reste `null` s'il
n'est pas établi. Les raisons fermées sont `OPERATION_FAILED`, `TIMEOUT`,
`ASSERTION`, `LOCATOR_AMBIGUOUS`, `NO_RESPONSE`, `UNAVAILABLE` ; le reporter
indisponible utilise `UNAVAILABLE`, la publication `OPERATION_FAILED`.

La première erreur conserve son étape même si les attentes de réponse échouent
ensuite pendant la finalisation. Aucune exception brute, URL, note, corps,
identité, valeur ou hash de secret n'entre dans ce détail. Le rail exige le
propriétaire `BROWSER_JOURNEY`, stdout, unicité, LF, taille et bindings exacts ;
il conserve le détail dans `d-terminal.json` avec `campaignResult=FAIL`.
Les propriétés supplémentaires, combinaisons invalides, frames dupliquées,
tronquées ou provenant d'un autre enfant sont refusées. Ce détail ne peut
jamais servir de preuve PASS ; les fermetures et preuves de cessation restent
obligatoires. Les anciens terminaux sans ce champ restent lisibles.

Le diagnostic browser accepte aussi la version 2 : les cinq champs précédents,
avec `lastCompleted=null`, puis `operation`, `operationState` et
`lastCompletedOperation`. Les opérations sont les constantes fermées de
`BROWSER_OPERATIONS`, également validées par le rail ; aucun titre d'API ou
paramètre libre n'est conservé. Les étapes publiques `test.step` transportent
ces repères avant l'attente, y compris si le timeout global empêche l'attachment.
Le worker garde son premier échec local ; le reporter sert de secours sans
prétendre ordonner globalement les deux canaux. Une opération échouée ou encore
pendante interdit toute publication positive. `PENDING` décrit l'attente,
pas la cessation de l'opération sous-jacente.

Les primitives du parcours browser auparavant non bornées ont une borne de
10 secondes, sans augmenter ses délais globaux. Une expiration arrête la suite
du parcours et rejoint les fermetures existantes. Le propriétaire natif précède
la connexion ; les ressources créées tard restent détenues par ce navigateur
et par le Job du rail. Le finaliseur conserve ses fenêtres de 1,5 seconde.
L'étape `IDLE_WAIT` conserve les 32 minutes réelles et la mesure monotone ; elle
ne reçoit pas la borne courte. Ni le reducer PASS ni les assertions métier ne
changent. La régression HTTP synthétique vérifie aussi en-têtes, fin de réponse,
JSON, observations et scans des pages vivantes A/default et B/incognito. Elle
consomme le corps côté page comme l'application et ne produit aucune preuve C2.

Les nouvelles émissions utilisent `cookieDiagnostic` version 2, qui conserve
ces champs et ajoute la propriété obligatoire `firstPrivacyViolation` : `null`
si aucun premier incrément n'a été observé, sinon l'objet exact immuable
`{rule, surface, valueCategory}`. La version 1 reste lisible sans ajout de
catégorie. L'enveloppe du terminal et son diagnostic à cinq champs restent
distincts de ce schéma. Les validateurs TypeScript et PowerShell refusent les
propriétés supplémentaires, les valeurs libres et les combinaisons incohérentes.

- `rule` : `PROTECTED_VALUE_MATCH`, `AUTHORIZATION_HEADER`,
  `TENANT_SESSION_HEADER`, `AUTHORIZATION_AND_TENANT_SESSION_HEADERS`,
  `CHANNEL_SHAPE`.
- `surface` : `REQUEST_HEADERS`, `DOM`, `FORM_FIELD`, `URL`, `DOCUMENT_COOKIE`,
  `LOCAL_STORAGE`, `SESSION_STORAGE`, `INDEXED_DB`, `CONSOLE`, `CHANNEL`,
  `AMBIGUOUS`.
- `valueCategory` : `SESSION_COOKIE`, `CSRF_TOKEN`, `ACTOR_KEY`, `USER_ID`,
  `SUBJECT`, `TENANT_ID`, `MEMBERSHIP_ID`, `ACTOR_ID`, `AMBIGUOUS`, `NONE`.

Les règles de header sont limitées à `REQUEST_HEADERS`, avec respectivement
`NONE`, `TENANT_ID` et `AMBIGUOUS` pour Authorization, tenant session et les deux
simultanément ; deux headers interdits sur une même requête restent un seul
incrément. `CHANNEL_SHAPE` porte `CHANNEL/NONE`. Une correspondance protégée
porte une surface autre que `REQUEST_HEADERS` et une catégorie autre que `NONE`.
Une provenance multiple est `AMBIGUOUS`, jamais choisie arbitrairement.

Le contrôle utilise le chemin de l'URL : Authorization est interdit sur toutes
les requêtes API observées ; le header tenant est interdit sur `/api/session`
exact et `/api/session/*`. Ses usages métier contractuels restent permis, sans
exempter la valeur transportée des autres surfaces surveillées. Les samples et
valeurs restent en mémoire ; matching par inclusion, comptage cumulatif et
rétroactif, transitoires, quotas et refus sur perte sont conservés. Les métadonnées
catégorielles ne multiplient pas les samples, notamment le snapshot composite.
Le triplet ne transporte aucun contenu, hash ou longueur de valeur protégée.
Un premier incrément observé pendant la finalisation enrichit le seul triplet
du diagnostic v2 même après une erreur antérieure. La cause et les faits de
cette première erreur restent leur snapshot initial ; ils ne sont pas remplacés
par les compteurs ultérieurs. Le premier triplet reste immuable.

Après un échec cookie, le reporter lit l'attachment filtré et peut émettre une
unique ligne stdout `M1D_COOKIE_DIAGNOSTIC ` suivie du JSON, 8192 octets UTF-8
maximum avec sa fin de ligne. Le runner reste failed/non-zéro. Le rail ne
l'accepte que de `BROWSER_COOKIE`, avec RunId, composite et runtimes backend/
frontend exacts. Propriétés, types, littéraux ordinaux et bornes sont vérifiés ;
doublon, troncature, mauvais canal/propriétaire ou binding divergent sont refusés.
Le détail est conservé séparément dans `terminal.payload.cookieDiagnostic`,
sans élargir les cinq champs du diagnostic du rail ni devenir un signal PASS.
Le lecteur revalide ce détail contre le reçu campaign ; les anciens terminaux
sans ce champ restent lisibles. Aucun diagnostic ne remplace les barrières de
cessation, de provenance ou de nettoyage. Si le worker/reporter ne peut fournir
un détail valide (notamment arrêt avant émission), il reste indisponible : pas
de reconstitution ni de journal libre. La publication des preuves PASS demeure
inchangée ; les tests synthétiques de ce transport ne qualifient pas un parcours
navigateur réel et ne résolvent pas rétrospectivement l'incident historique.

Avant le premier navigateur, le rail attend un HTTP 200 HTML de Vite sur
`http://127.0.0.1:5173/`, sous l'échéance intégrée déjà ouverte. Chaque sonde
est bornée à 200 ms ; la sortie de Vite ou du backend interdit la suite,
y compris si elle survient pendant une sonde positive. Aucun retry du scénario.

La finalisation du worker tente indépendamment toutes les pages et tous les
contextes créés, puis le navigateur, les observations finales et l'attachment.
Ces cinq étapes attendent au plus 1,5 s chacune (7,5 s au total), sous les
budgets existants ; le rail garde la responsabilité de cessation de l'arbre.
Le premier diagnostic filtré par étape/code reste premier ; les échecs suivants
sont secondaires, sans erreur brute ni secret. Toute fermeture incomplète ou
erreur de publication empêche le succès, même si les autres fermetures réussissent.

Les pièces sont écrites complètement, avec fsync et création exclusive, avant
`d-cookie-evidence.json` ou `d-browser-evidence.json`. Aucun écrasement ni
troisième bundle opérationnel. Le reçu positif requiert assertions,
finalisations et résultat réussi du runner. Le rail vérifie également sortie
zéro, drainage achevé, Job Object vide, provenance, mesures et hashes. Il
surveille toujours backend/harness. Une exception du reporter ne vaut pas
succès. Après les deux phases, le rail conserve M1D_FINISH, les arrêts attestés,
les tests DB ciblés/complets et son nettoyage existant.

Budgets : test cookie 3 minutes (runner 3 min 10 s), parcours 45 minutes
(runner 45 min 10 s), soumis au budget intégré unique de 60 minutes. Les
limites Preflight/Lifecycle/campagne de 40/155/195 minutes et la réserve d'arrêt
restent inchangées. Aucun retry du parcours long ni horloge simulée.

Les vérifications hors DB autorisées sont Vitest ciblé puis test:ci, lint,
build, découverte Playwright sans lancement ; côté backend, tests ciblés,
windowsTest, puis test windowsTest build --no-daemon --rerun-tasks. La découverte
D emploie exclusivement `RITOMER_M1D_DISCOVERY=SYNTHETIC_LIST_ONLY`, RunId/hash
nuls et root/executable `SYNTHETIC_LIST_ONLY`, avec `--list` obligatoire. Ces
valeurs sont refusées pour exécuter un test ou publier un reçu opérationnel.

Une campagne future exige d'abord review indépendante des octets exacts et
records sensibles distincts Preflight/Lifecycle : même nouveau RunId, même
RunRoot dédié sous le répertoire D existant, hash du diff composite, psql exact,
runtime et namespace revalidés par le rail. Les options restent celles du rail
(`-Mode`, `-Campaign D`, `-LifecycleAction Run` pour Lifecycle et bindings
existants). Pas de readiness opérationnelle, DB, serveur, harness ou navigateur
autorisé par la présente réalisation. Aucun ancien run ou nettoyage réactivé.

Diagnostic HARNESS : le CLI émet sur stderr une unique ligne
`HARNESS_FAILED ` suivie d'un JSON, terminée par LF, au plus 2048 octets UTF-8
fin de ligne comprise. L'enveloppe exacte version 1 porte
`schemaVersion, runId, objectSha, runtimeSha, diagnostic`. Le détail exact porte
`code, step, expectedStatus, receivedStatus`. Les codes et étapes sont les
listes fermées `HARNESS_FAILURE_CODES` et `HARNESS_FAILURE_STEPS`, validées
également par `Assert-M1DHarnessDiagnostic` dans le rail. Une exception libre
est filtrée, jamais reconnue par ressemblance avec un code. Les étapes LOGIN
couvrent bootstrap, login et lecture de contexte ; elles ne désignent pas
une sous-route précise. Aucune URL, identité métier, valeur d'exception,
cookie, token, header ou corps ne rejoint cette frame.

`HTTP_STATUS_MISMATCH` requiert deux entiers distincts entre 100 et 599 ;
`HTTP_RESPONSE_UNAVAILABLE` requiert l'attendu dans ces bornes et le reçu
`null`. Les autres codes ont deux statuts `null`. Le traitement cookie et
no-store conserve sa priorité existante avant la comparaison de statut.
Un défaut de lecture de corps après réception n'est pas présenté comme une
absence de réponse. Sans binding valide, le CLI ne fabrique aucune identité :
`HARNESS_FAILED UNAVAILABLE` est refusé par le consommateur.

Le rail accepte cette frame uniquement sur stderr HARNESS ; taille, propriétés,
unicité, types, enums et bindings sont strictement vérifiés. Le premier détail
valide reste immuable pendant les finalisations et est écrit dans
`terminal.payload.harnessDiagnostic`, revalidé à la lecture avec le reçu
campaign. Ce champ optionnel ne modifie pas les cinq champs du diagnostic
principal et n'enrichit pas les reçus historiques. Il ne satisfait jamais
`M1D_JARS_RESULT` ; diagnostic et PASS contradictoires sont refusés avant
progression. Son absence ne remplace pas les preuves positives requises.

Le PUT métier reviewer utilise seulement le `X-Tenant-Id` observé sur le PUT
ACCOUNTANT réussi du même scénario. Aucun tenant global ni header session
n'est ajouté. La vraie fonction `reviewerWriteRequest`, utilisée par
`page.evaluate`, est vérifiée hors DB pour méthode, corps, CSRF, tenant,
absence d'Authorization et refus `403 ACCESS_DENIED`. Ces fixtures n'ouvrent
aucun droit de campagne ; les records C1/C2 restent séparés et consommés.
