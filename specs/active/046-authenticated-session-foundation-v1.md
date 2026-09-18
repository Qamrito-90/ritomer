# 046 — Authenticated session foundation V1

## 1. Statut, surface et risque

```text
SPEC_STATUS=ACTIVE
ACTIVE_SPEC=046
MILESTONE=M1_1_AUTHENTICATED_SESSION_FOUNDATION
RISK_CLASS=C
EVIDENCE_LEVEL=FULL

M1_1A_SCOPE=BACKEND_AUTH_TENANT_FOUNDATION_WITH_CORRECTIVE_M8
M1_1A_IMPLEMENTED=YES
M1_1_FINAL_OUTCOME_DELIVERED=NO

M1_1B_SCOPE=BACKEND_SESSION_KERNEL_PROCESS_LOCAL_DEFAULT_OFF
M1_1B_IMPLEMENTED=YES
M1_1C_IMPLEMENTED=YES
M1_1C_LOCAL_FRONTEND_VALIDATION=PASS
M1_1C_DELIVERED=NO
M1_1D_IMPLEMENTED=NO

PROMETHEUS_WEB_EXPOSURE=CLOSED_FAIL_CLOSED
PUBLIC_MANAGEMENT_ENDPOINTS=HEALTH_INFO_ONLY

SESSION_CREATED=YES
COOKIE_CREATED=YES
CSRF_CREATED=YES
FRONTEND_MODIFIED=YES
BROWSER_SESSION_INTEGRATION=NO
SHARED_OIDC_INTEGRATION=NO
DISTRIBUTED_SESSION=NO

AI_RUNTIME=NO
AGENT_RUNTIME=NO
MCP_RUNTIME=NO
```

Cette spec reste active pendant les quatre slices cumulatives. Le checkpoint A borne le principal applicatif, la lecture d'autorité fraîche aux frontières métier protégées et la sûreté tenant. Le correctif M8 ferme fail-closed l'exposition HTTP de Prometheus ; seuls health et info restent exposés. Le checkpoint B implémente le kernel de session backend process-local, désactivé par défaut, sans intégration frontend ou navigateur. Le checkpoint C est implémenté et validé localement sur le frontend simulé ; sa delivery n'est pas réalisée. D n'est pas implémenté : activation intégrée, preuve navigateur et clôture restent à réaliser. La fermeture et le déplacement vers `specs/done/` appartiennent exclusivement à M1.1D.

## 2. Outcome M1.1 et outcomes bornés M1.1A/M1.1B

L'outcome final M1.1 est une authentification same-origin portée par une session serveur et un cookie opaque sécurisé. PostgreSQL reste l'autorité pour l'utilisateur, les memberships, le tenant et les rôles. Le mode local/test traverse la même frontière de session que le futur IdP ; il ne devient pas une seconde architecture d'authentification.

M1.1A couvre uniquement :

- un principal applicatif unique, minimal, sérialisable et indépendant du transport ;
- les ports de lecture et de fraîcheur d'autorité ;
- l'adaptation read-only du JWT backend historique vers ce principal ;
- la relecture de l'utilisateur et des grants actifs à chaque requête métier protégée ;
- la fermeture fail-closed de l'exposition web Prometheus, tandis que health et info restent exposés ;
- la validation stricte de `X-Tenant-Id`, le binding MDC post-autorisation et son nettoyage ;
- la neutralisation de l'auto-registration Servlet de l'instance existante de `TenantMdcFilter` ;
- les preuves ciblées, PostgreSQL réelles, Modulith et backend complètes.

M1.1A ne crée aucun endpoint de session, cookie, CSRF, login, logout, frontend, IdP réel, provisioning, cache d'autorité, dépendance ou migration.

M1.1B implémente uniquement le kernel backend de session process-local :

- une session HTTP opaque et un cookie sécurisé, tous deux désactivés par défaut ;
- le bootstrap anonyme, l'adaptateur de login local/test, le rebootstrap et le logout ;
- la rotation du SID et du CSRF, l'expiration absolue et idle et l'invalidation sur révocation ;
- la relecture PostgreSQL de l'autorité pour `/api/me` et les requêtes protégées ;
- le confinement local/test fail-closed, le firewall strict et la coexistence bornée du bearer backend historique ;
- le contrat OpenAPI auth-session et l'ADR de frontière process-local.

M1.1B n'ajoute aucun frontend, coordinator navigateur, OIDC réel ou partagé, session distribuée, dépendance, migration, provisioning, runtime IA, agent ou MCP. Au checkpoint B historique, M1.1C, M1.1D et l'outcome final M1.1 restaient non implémentés ; le statut local C actuel figure en §1 et ci-dessous.

## 3. Architecture gelée

```text
AUTH_ARCHITECTURE=BFF_SERVER_SIDE_SESSION_WITH_SECURE_OPAQUE_COOKIE
LOCAL_TEST_AUTH=LOCAL_TEST_IDP_ADAPTER_THROUGH_THE_SAME_SESSION_BOUNDARY
ONE_APPLICATION_PRINCIPAL_MODEL=YES
MEMBERSHIP_DB_IS_AUTHORITATIVE=YES
AUTHORITY_RELOAD=EVERY_PROTECTED_BUSINESS_REQUEST
PUBLIC_MANAGEMENT_ENDPOINTS=HEALTH_INFO_ONLY
PROMETHEUS_WEB_EXPOSURE=CLOSED_FAIL_CLOSED
BROWSER_BEARER_AUTH=NO
NEW_DEPENDENCY=NO
DB_MIGRATION=NO
FIFTH_SLICE=NO
M1_1_SESSION_TOPOLOGY=PROCESS_LOCAL_ONLY
SESSION_DEFAULT_ENABLED=NO
SHARED_OIDC_INTEGRATION=NO
DISTRIBUTED_SESSION=NO
```

Les claims provider ne déterminent jamais un tenant, un membership ou un rôle. Le backend legacy peut encore reconnaître explicitement un bearer JWT pendant la transition, mais cette compatibilité n'autorise aucun bearer navigateur.

L'enveloppe future IA/agent/MCP pourra recevoir uniquement un `actor_id` interne, le tenant déjà autorisé, les rôles relus et des corrélations opaques. Elle ne reçoit jamais token, cookie, subject provider, claim brut ou secret. Aucun runtime IA, agent ou MCP n'est ajouté par M1.1.

## 4. Principal et coutures d'autorité

`AuthenticatedActor` est le principal applicatif persistant unique. Il est sérialisable et possède exactement quatre champs d'instance :

| Champ | Contrat |
|---|---|
| `actorId` | UUID applicatif interne |
| `authenticationMechanism` | `LOCAL_SESSION`, `LEGACY_JWT` ou `OIDC` |
| `authenticatedAt` | `Instant` UTC fourni par un `Clock` |
| `opaqueAuthCorrelation` | valeur serveur opaque, non secrète et non issue des claims |

Le principal ne contient jamais subject ou claims provider, email, profil faisant autorité, tenant, membership, rôle, authority Spring, token, cookie, secret, requête, objet Servlet ou objet Spring Security.

Le même path shared application définit les coutures transport-neutres :

```kotlin
fun interface AuthenticatedActorContextInstaller {
  fun installAuthenticatedActor(actor: AuthenticatedActor)
}

enum class ActorAuthorityFreshness {
  ACTIVE,
  REVOKED
}

fun interface ActorAuthorityFreshnessVerifier {
  fun verifyFreshAuthority(actorId: UUID): ActorAuthorityFreshness
}
```

`IdentityRepositories.kt` expose également :

- `AppUserRepository.findById(actorId)` pour une lecture présente, absente ou inactive ;
- `CurrentAuthenticatedActorProvider.current()` comme port intra-module sans Spring.

Les ports existants de création et de mise à jour de profil restent disponibles pour leurs usages explicites, mais l'authentification et la résolution d'autorité ne les appellent jamais.

`ActorResolutionSupport` :

- consomme `CurrentAuthenticatedActorProvider`, jamais SecurityContext ou JWT ;
- conserve `resolveActorContext()` sans argument pour les deux appelants existants ;
- implémente `ActorAuthorityFreshnessVerifier` ;
- relit `findById(actorId)` et `findActiveMembershipGrants(actorId)` sans cache ;
- groupe les rôles uniquement depuis les grants frais ;
- effectue zéro write d'authentification ;
- lie le MDC uniquement après sélection d'un membership actif.

`SecurityAuthenticatedActorProvider` est l'unique adaptateur transport de ce port en A. Il exige une `Authentication` présente et authentifiée. Si le principal est déjà un `AuthenticatedActor`, il retourne exactement la même instance. Sinon, il accepte uniquement un `JwtAuthenticationToken`, exige un subject non blank, résout un utilisateur applicatif préexistant et actif en lecture seule, puis crée un acteur `LEGACY_JWT` avec le `Clock` et une corrélation serveur. Tout autre principal, subject inconnu ou utilisateur inactif est refusé. Les claims de profil, tenant, rôle ou scope sont ignorés comme autorité.

## 5. Autorité fraîche et sémantique de refus

`ActorAuthorityFreshness.ACTIVE` est rendu seulement si les deux conditions sont vraies sur la lecture courante :

1. `findById(actorId)` retourne un utilisateur actif ;
2. `findActiveMembershipGrants(actorId)` retourne au moins un grant dont le membership et le tenant sont actifs.

Utilisateur absent ou inactif, membership révoqué, tenant inactif ou absence de grant actif rend `REVOKED`. Une exception, un timeout ou un résultat DB indéterminé se propage en erreur serveur fail-closed ; il n'est jamais transformé en `REVOKED`.

Les décisions HTTP restent :

| Condition | Résultat |
|---|---|
| autorité globale révoquée | `403 ACCESS_REVOKED` ; invalidation session seulement à partir de B |
| tenant ou rôle ciblé non autorisé | `403 ACCESS_DENIED` |
| ressource d'un autre tenant après tenant autorisé | `404` opaque |
| panne DB | `5xx`, jamais une décision d'autorité inventée |

La résolution de l'authentification n'effectue ni create, ni update profil, ni provisioning, ni seed, ni cache, ni write implicite. L'audit existant d'une sélection tenant explicite valide reste autorisé uniquement après validation du membership ; aucun audit pré-tenant n'est émis.

## 6. `X-Tenant-Id`, MDC et registration du filtre

Toutes les occurrences de `X-Tenant-Id` sont énumérées. Le contrat est :

- zéro occurrence : header absent, selon le besoin de l'endpoint ;
- exactement une ligne strictement égale à `UUID.toString()` en lowercase canonique : syntaxe valide ;
- blank, espaces, malformed, uppercase, forme non canonique, plusieurs lignes, doublon identique ou valeur comma-coalesced : `400 INVALID_TENANT_HEADER` ;
- toute occurrence sur `/api/session` ou `/api/session/*` : refusée.

Un UUID syntaxiquement valide est seulement un tenant demandé. Il ne devient autorisé qu'après match avec un membership actif relu en base. Avant ce match, le header brut ou le tenant demandé n'apparaît ni dans MDC, ni dans un audit, ni dans un futur contexte IA/agent/MCP. La télémétrie pré-tenant éventuelle est non durable, redacted, corrélée et limitée à un reason code stable.

Le tenant autorisé est lié au MDC après le match. Il est supprimé dans un `finally` après succès, 400, 403, 404 ou exception.

Dès M1.1A, `TenantMdcFilter` satisfait simultanément :

```text
FILTER_BEAN_COUNT=1
FILTER_REGISTRATION_COUNT=1
FILTER_REGISTRATION_ENABLED=FALSE
CONTAINER_INVOCATION_COUNT_PER_REQUEST=0
SECURITY_CHAIN_INSTANCE_COUNT=1
```

La registration disabled référence exactement le bean injecté dans la chaîne : `registration.filter === tenantBean === instance in FilterChainProxy`. Aucune instance ad hoc ou seconde configuration du filtre n'existe. L'ordre HTTP effectif en A place cette instance après `BearerTokenAuthenticationFilter` et avant `AuthorizationFilter`. Les preuves utilisent l'identité des objets, les deux canaux réels et une requête instrumentée ; l'existence du bean ou `OncePerRequestFilter` seul ne suffit pas.

M1.1B ajoute les registrations disabled des quatre nouveaux filtres de session et revalide la bijection des cinq.

## 7. Contrat M1.1B implémenté — kernel session backend

M1.1B introduit le kernel session default-off, bootstrap/login/logout, rotation, CSRF, expiry et invalidation. Cette capacité reste absente tant qu'elle n'est pas explicitement activée dans une topologie locale autorisée. Le cookie contractuel est :

```text
NAME=__Host-ritomer-session
SECURE=YES
HTTP_ONLY=YES
PATH=/
DOMAIN=ABSENT
SAME_SITE=Lax
IDLE_TIMEOUT=30m
ABSOLUTE_TIMEOUT=8h
TRACKING_MODE=COOKIE_ONLY
```

Le firewall interdit le semicolon et les formes URL-session avec `400 REQUEST_REJECTED`. `AuthenticatedActorAuthentication` implémente directement `Authentication`, avec credentials/details nuls, authorities vides immuables, downgrade vers `false` idempotent et irréversible, élévation vers `true` interdite et `toString` redacted.

Les codes incluent `INVALID_REQUEST`, `AUTHENTICATION_FAILED`, `SESSION_ALREADY_AUTHENTICATED`, `AMBIGUOUS_CREDENTIALS`, `BEARER_NOT_ALLOWED_FOR_SESSION_ENDPOINT`, `SESSION_EXPIRED`, `CSRF_REJECTED`, `ACCESS_REVOKED`, `INVALID_TENANT_HEADER`, `ACCESS_DENIED` et `NOT_FOUND`.

Le confinement local/test est explicite et fail-closed face aux marqueurs Cloud Run. `PORT` seul n'est jamais une preuve de Cloud Run. La compatibilité bearer backend reste explicite et ne s'étend jamais au navigateur.

### 7.1 Flux, statuts et précédence

| Étape ou condition | Traitement contractuel | Résultat |
|---|---|---|
| `GET /api/session/bootstrap` anonyme | crée ou réutilise la session anonyme et renvoie un body minimal `no-store` | `200` ; session et CSRF stables sur deux appels |
| `POST /api/session/local` avec actorKey exact et CSRF courant | lookup DB read-only, rotation session et CSRF, installation et sauvegarde explicites | `204`, aucun token dans le body |
| rebootstrap authentifié | session stable, nouveau CSRF courant | `200`, token seulement en mémoire client |
| `GET /api/me` | relit user et grants DB puis décide tenant et rôles | `200`, `400`, `403` ou `404` |
| `POST /api/session/logout` avec CSRF courant | `CsrfFilter`, puis `LogoutFilter`, clear du contexte/repository/session/cookie | `204`, ancienne session et ancien CSRF inutilisables |
| bootstrap après logout | seul chemin de reprise | nouvelle session anonyme et nouveau CSRF |

Le bootstrap expose uniquement `sessionState`, `localLoginAvailable`, `csrf {headerName, token}` et, seulement à l'état anonyme, des acteurs minimaux `{actorKey, displayLabel}`. Il n'expose jamais UUID acteur, subject, email, tenant, membership, rôle, cookie ou SID. Les attributs session sont limités au contexte Spring Security et à l'attribut CSRF officiel après rebootstrap.

Les statuts figés sont : JSON invalide `400 INVALID_REQUEST` ; actorKey inconnu ou inactif `401 AUTHENTICATION_FAILED` sans write ; login déjà authentifié `409 SESSION_ALREADY_AUTHENTICATED` ; bearer avec cookie `400 AMBIGUOUS_CREDENTIALS` ; bearer sur `/api/session/*` `400 BEARER_NOT_ALLOWED_FOR_SESSION_ENDPOINT` ; expiry `401 SESSION_EXPIRED` avec invalidation ; CSRF absent, faux ou ancien `403 CSRF_REJECTED` ; révocation globale `403 ACCESS_REVOKED` avec invalidation ; header tenant invalide `400 INVALID_TENANT_HEADER` ; tenant ou rôle ciblé refusé `403 ACCESS_DENIED` ; ressource cross-tenant `404 NOT_FOUND` opaque.

La précédence HTTP réelle à prouver est : firewall `400` → credentials ambigus `400` → expiry `401` → frontière locale `403` → syntaxe tenant `400` → fraîcheur DB `403` et invalidation → CSRF `403` → authorization `401/403/404` → métier.

### 7.2 Confinement local/test

La capability locale existe seulement avec `session.enabled=true`, un ensemble de profils exactement égal à `{local}`, `{test}` ou `{dbtest}`, le backend résolu sur `127.0.0.1:8080`, Vite sur `127.0.0.1:5173`, `remoteAddr=127.0.0.1`, Host et Origin exacts, et aucun `Forwarded` ou `X-Forwarded-*`. Sont refusés : `localhost`, wildcard, `0.0.0.0`, `::`, `::1`, LAN, proxy distant, Origin absent sur unsafe et overrides CLI.

La simple présence, valeur vide incluse, de l'un des dix marqueurs suivants interdit la capability locale : `K_SERVICE`, `K_REVISION`, `K_CONFIGURATION`, `CLOUD_RUN_JOB`, `CLOUD_RUN_EXECUTION`, `CLOUD_RUN_TASK_INDEX`, `CLOUD_RUN_TASK_ATTEMPT`, `CLOUD_RUN_TASK_COUNT`, `CLOUD_RUN_WORKER_POOL`, `CLOUD_RUN_REVISION`. `PORT` seul n'est pas probant.

### 7.3 Firewall, Authentication et filtres

Le tracking effectif est le singleton `{COOKIE}`. `StrictHttpFirewall` refuse le semicolon et les deux formes matricielles `;jsessionid=` et paramètre URI dérivé du cookie, sur GET et unsafe, avant toute chaîne, avec `400 REQUEST_REJECTED`, body minimal et `Cache-Control: no-store`. Des preuves distinctes établissent l'absence d'authentification URL, de rewrite par `encodeURL`/`encodeRedirectURL`, de redirection et de SID dans body, URL, Location, headers ou logs.

`AuthenticatedActorAuthentication` est final, construit seulement après résolution interne validée et implémente directement `Authentication`. Son principal est l'instance exacte de `AuthenticatedActor`, credentials et details sont nuls, authorities est vide et immuable, `getName()` retourne la corrélation opaque, `toString()` est constant et redacted. L'état initial trusted vaut `true`; `setAuthenticated(false)` est idempotent et irréversible ; toute tentative de `setAuthenticated(true)` est refusée avant et après downgrade. Le graphe est inspecté avant et après sérialisation, en états trusted et downgraded, y compris sous concurrence contrôlée.

Les cinq filtres custom sont des beans uniques, chacun avec une registration Servlet disabled et une politique REQUEST-only : `SessionCredentialConflictFilter`, `SessionExpiryFilter`, `LocalAuthBoundaryFilter`, `TenantMdcFilter`, `SessionAuthorityFreshnessFilter`. Le conteneur les invoque zéro fois et la chaîne Security exactement une fois ; ASYNC et ERROR ne créent aucune invocation secondaire. L'ordre complet par instances est : `SecurityContextHolderFilter` → conflict → expiry → local boundary → tenant MDC → authority freshness → `CsrfFilter` → `LogoutFilter` → `BearerTokenAuthenticationFilter` seulement avec decoder legacy explicite → `AuthorizationFilter`.

## 8. Contrat M1.1C — coordinator frontend

Le contrat ci-dessous est implémenté localement dans le file-set C de §10. Le 17 septembre 2026, la validation finale a obtenu 253 tests sur les sept suites ciblées et 955 tests sur les 34 fichiers de la campagne frontend complète, tous PASS, sans échec, pending ou todo ; lint et build ont terminé avec un code de sortie 0. Les deux régressions de corps `403` reçu après timeout ont été reproduites puis corrigées : une continuation annulée ne peut plus purger la session ni lancer une reprise CSRF. Les sorties exactes et le diff sont remis dans le Fresh Evidence Pack local. Ces preuves simulées ne démontrent aucune intégration navigateur réelle et n'autorisent aucune delivery.

M1.1C introduira un coordinator unique dans `session.ts` pour bootstrap, login, rebootstrap, `/api/me` et logout, installé synchroniquement par le router avant les enfants protégés. L'import du module et les clients isolés ne déclencheront aucun bootstrap. `http.ts` portera la politique commune sans importer le coordinator. Une promesse partagée dédupliquera l'initialisation et la revalidation, y compris sous StrictMode ; une génération monotone interdira toute publication de contexte ou de CSRF provenant d'une opération périmée.

Les requêtes utiliseront `credentials: "same-origin"`. Le CSRF restera uniquement en mémoire et son header contractuel sera `X-CSRF-TOKEN`. Les mutations métier en `SESSION_READY` recevront le token courant ; son absence les bloquera avant le réseau. Login et logout emploieront le transport interne avec le CSRF exigé par leur contrat, sans attendre récursivement leur propre initialisation. Aucun endpoint session ne recevra `X-Tenant-Id`. Les corps, `FormData` sans Content-Type forcé, headers métier, idempotence, fetchers injectables et signatures publiques resteront compatibles.

Le parcours sera bootstrap → login local explicite → `204` → effacement de l'ancien CSRF → rebootstrap → `/api/me` → contexte prêt. Seul le `404` du bootstrap initial autorisera `LEGACY_PROXY_TRANSITION`, suivi de `/api/me` et du parcours existant, sans ajout Authorization ou CSRF. Aucune panne réseau, réponse `5xx`, erreur de payload ou perte ultérieure de capability ne permettra ce fallback. Ce mode ne promettra aucun login ou logout serveur disponible.

Les états initial, connexion requise, expiration, refus, contexte indisponible, réseau, timeout, serveur et payload invalide resteront distincts. Un `401` initial orientera vers la connexion, avec au plus une reprise anonyme bornée si nécessaire. Un `401` après disponibilité ou une révocation globale effacera immédiatement le contexte utilisateur/tenant/dossier et le CSRF, invalidera les opérations anciennes et démontera le contenu protégé. Un `403 ACCESS_DENIED` restera contextualisé ; un `404` métier restera opaque. Un `403 CSRF_REJECTED` suspendra les mutations pendant le renouvellement contrôlé du contexte CSRF. Aucune mutation ne sera rejouée automatiquement.

Login et logout seront sérialisés et protégés du double clic. Logout effacera immédiatement le contexte local, puis un seul POST avec le CSRF courant attendra la confirmation `204` avant le bootstrap anonyme. Une panne laissant le résultat serveur incertain affichera « Déconnexion non confirmée », sans succès inventé ni réouverture silencieuse sur focus ou message inter-onglets.

### Téléchargements et générations

Les lectures binaires de documents et de packs utiliseront un transport Blob dédié dans `http.ts`, partageant la politique session de `requestJson`, sans header JSON imposé, remplacement global de fetch ou modification des DTO et signatures publiques. Chaque parcours contrôlera les frontières suivantes :

1. capture de la garde de génération dans le panneau avant l'appel asynchrone ;
2. capture et vérification de génération au départ HTTP, avec annulation enregistrée ;
3. contrôle à réception des en-têtes avant toute notification, notamment `401` ; une ancienne réponse ne pourra pas expirer une nouvelle session ;
4. lecture `response.blob()` uniquement sur `200`, puis nouveau contrôle de génération ;
5. vérification avant publication du résultat API ;
6. dans chacun des deux panneaux, garde après `await` avant toute publication, puis immédiatement avant le helper créant l'URL objet, sans `await` intermédiaire.

Le délai unique de 5 000 ms couvrira départ, en-têtes et fin du Blob, sans redémarrage à réception des en-têtes. La course de promesses couvrira l'opération entière. Timeout et invalidation termineront aussi l'attente d'un fetcher ou d'un corps simulé ignorant `AbortSignal`. Timer et abonnements seront nettoyés en `finally`. Une continuation tardive vérifiera sa génération avant tout effet.

Les classifications resteront : timeout → `timeout`, panne réseau → `network_error`, échec ordinaire de lecture Blob → `unexpected`. Une invalidation de session produira un résultat sans succès et ne notifiera pas une nouvelle expiration. Une garde finale périmée abandonnera le résultat sans succès, URL objet, lien ou clic et libérera seulement le verrou de sa propre tentative.

### Privacy, retour et accessibilité

Aucun bearer, cookie, SID, UUID acteur, subject ou secret ne sera rendu dans le DOM, URL, storage, IndexedDB ou channel. Le choix local n'affichera que les `displayLabel` reçus ; `actorKey` restera en mémoire, jamais en valeur DOM. Aucun identifiant technique ne servira de libellé utilisateur de secours. Le panneau export retirera uniquement la ligne `createdByUserId` ; DTO, données métier et audit resteront inchangés.

Le safe return restera en mémoire, limité à `/` et `/closing-folders/{UUID canonique lowercase}`, sans query ni fragment. Schémas, doubles slashs, backslashes, contrôles et encodages non autorisés seront refusés avec retour à `/`. Ce retour ne conférera aucun droit d'accès au dossier.

Focus et visibility seront coalescés, sans polling. `BroadcastChannel("ritomer:session:v1")` portera uniquement `{type: "SESSION_CHANGED"}`, sans identité, secret ou écho. Si ce canal est indisponible, focus/visibility subsisteront sans fallback storage. Les abonnements seront nettoyables. Les composants et zones d'action existants porteront les états et le logout : libellés explicites, clavier, focus visible et disposition adaptée au viewport étroit.

Les validations C établiront uniquement le comportement frontend simulé. Cookies réels, attributs `Secure`/`HttpOnly`, proxy, deux jars, concurrence navigateur et rendu réel sur viewport étroit resteront à prouver en D. Aucun résultat C n'activera Vite, le harness ou le backend, ni ne vaudra delivery ou clôture de 046.

## 9. Activation M1.1D

M1.1D activera la boucle locale intégrée après autorisation distincte : Vite loopback strict sans header `Authorization`, deux jars session isolés dans le harness, profil local session canonique sans HMAC/decoder, huit OpenAPI alignés et E2E complet. La documentation vivante sera relue et alignée avant le déplacement final de cette spec vers `specs/done/`.

Les huit contrats parsés sont `mapping-suggestions-api.yaml`, `mapping-suggestions-v2-api.yaml`, `closing-folders-api.yaml`, `import-balance-api.yaml`, `manual-mapping-api.yaml`, `workpapers-api.yaml`, `documents-api.yaml` et `exports-api.yaml`. Les six derniers ajoutent exactement onze opérations unsafe déjà existantes : trois closing folders, une import balance, deux manual mapping, deux workpapers, deux documents et une export. `contracts/openapi/closing-api.yaml` reste legacy/superseded et n'est jamais réactivé.

Chaque contrat métier publie deux Security Requirement Objects pour exprimer `cookieSession OR bearerAuth`, avec bearer décrit comme backend legacy seulement, jamais navigateur. Chaque unsafe exprime `(cookieSession AND csrfToken) OR bearerAuth`; le CSRF est conditionnel au cookie et n'est jamais imposé au bearer backend. Le parseur structurel vérifie les huit YAML, les onze unsafe nouvelles, l'unsafe mapping v1 existante, les alternatives OR, les refus `400/401/403/404` applicables et la correspondance méthode/path avec les suites HTTP/frontend.

`application-dev.yml` reste protégé, optionnel et explicitement backend bearer/HMAC. Le parcours local/browser canonique utilise `application-local.yml` sans HMAC ni decoder bearer ; Vite, le harness, les docs vivantes et `.env.example` ne l'activent ni ne le présentent comme prérequis.

## 10. File-sets exacts et comptages

### M1.1A — scope de base — 12 paths, `A=3, M=9`

| Action | Path |
|---|---|
| A | `backend/src/main/kotlin/ch/qamwaq/ritomer/shared/application/AuthenticatedActor.kt` |
| M | `backend/src/main/kotlin/ch/qamwaq/ritomer/identity/application/IdentityRepositories.kt` |
| M | `backend/src/main/kotlin/ch/qamwaq/ritomer/identity/infrastructure/persistence/JdbcAppUserRepository.kt` |
| M | `backend/src/main/kotlin/ch/qamwaq/ritomer/identity/application/ActorResolutionSupport.kt` |
| A | `backend/src/main/kotlin/ch/qamwaq/ritomer/identity/infrastructure/security/SecurityAuthenticatedActorProvider.kt` |
| M | `backend/src/main/kotlin/ch/qamwaq/ritomer/shared/application/TenantContext.kt` |
| M | `backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityTenantContextProvider.kt` |
| M | `backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/TenantMdcFilter.kt` |
| M | `backend/src/test/kotlin/ch/qamwaq/ritomer/IdentityTestConfiguration.kt` |
| M | `backend/src/test/kotlin/ch/qamwaq/ritomer/BackendApplicationSmokeTest.kt` |
| M | `backend/src/test/kotlin/ch/qamwaq/ritomer/PersistenceFoundationIntegrationTest.kt` |
| A | `specs/active/046-authenticated-session-foundation-v1.md` |

### M1.1A corrective M8 — 8 paths, `M=8`

| Action | Path |
|---|---|
| M | `backend/src/main/resources/application.yml` |
| M | `backend/src/test/kotlin/ch/qamwaq/ritomer/BackendApplicationSmokeTest.kt` |
| M | `backend/src/test/kotlin/ch/qamwaq/ritomer/PersistenceFoundationIntegrationTest.kt` |
| M | `specs/active/046-authenticated-session-foundation-v1.md` |
| M | `docs/product/v1-plan.md` |
| M | `docs/present/architecture-cadrage-v1.md` |
| M | `docs/present/ux-cadrage-v1.md` |
| M | `docs/present/ai-cadrage-v1.md` |

La modification d'`application.yml` ferme uniquement l'exposition Prometheus et n'implémente aucune capacité M1.1B. Le réalignement des quatre documents canoniques corrige la vérité courante sans implémenter M1.1D.

### M1.1B — 17 paths, `A=6, M=11`

| Action | Path |
|---|---|
| M | `backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityConfig.kt` |
| A | `backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SessionSecurityKernel.kt` |
| A | `backend/src/main/kotlin/ch/qamwaq/ritomer/identity/application/SessionAuthenticationService.kt` |
| A | `backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/SessionController.kt` |
| M | `backend/src/main/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalService.kt` |
| M | `backend/src/main/resources/application.yml` |
| M | `backend/src/test/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityConfigJwtValidationTest.kt` |
| A | `backend/src/test/kotlin/ch/qamwaq/ritomer/identity/api/LocalTestSessionControllerSecurityTest.kt` |
| M | `backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalAuthMeDbIntegrationTest.kt` |
| M | `backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalDbIntegrationTest.kt` |
| A | `contracts/openapi/auth-session-api.yaml` |
| A | `docs/adr/0007-authenticated-session-boundary.md` |
| M | `specs/active/046-authenticated-session-foundation-v1.md` |
| M | `docs/product/v1-plan.md` |
| M | `docs/present/architecture-cadrage-v1.md` |
| M | `docs/present/ux-cadrage-v1.md` |
| M | `docs/present/ai-cadrage-v1.md` |

### Correctif M1.1B — rail PostgreSQL direct lean — 6 paths, `A=2, M=4`

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

| Action | Path |
|---|---|
| A | `backend/scripts/m1-1b-postgresql-rail.ps1` |
| A | `backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/PostgresTestRailLifecycleCommand.kt` |
| M | `backend/build.gradle.kts` |
| M | `backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt` |
| M | `runbooks/local-dev.md` |
| M | `specs/active/046-authenticated-session-foundation-v1.md` |

L'unique overlap avec le scope B historique est cette spec. Les dix-neuf
chemins du composite situés hors de ce correctif restent octet pour octet
inchangés. `A8/M17/25` est le statut composite observé et contrôlé ; il n'est
pas présenté comme une addition arithmétique du seul scope B et du delta
correctif. Un septième path impose `STOP_SCOPE_CHANGE`.

Le redesign retire tout canal, constante, task ou bootstrap administratif de
Gradle et tout CLI/JDBC/SQL administratif de Java/Kotlin. Le fichier lifecycle
Kotlin conserve uniquement `PostgresTestRailJdbcLogging`, toujours consommé
par le support runner. `dbIntegrationTest` reste autonome et hors
orchestration.

Gradle expose exactement les trois tâches rail suivantes :

- `m1BPostgresRailReadiness` : compilation et résolution strictes, sans
  credential, test, seed, Flyway ou connexion DB ;
- `m1BPostgresRailTargeted` : deux classes et treize tests avec le seul secret
  runner jetable ;
- `m1BPostgresRailFull` : douze classes et cinquante-cinq tests avec le seul
  secret runner jetable.

La preuve qu'aucun secret admin n'atteint Gradle ou le compilateur vient de
l'orchestrateur : il refuse les canaux parent interdits, reconstruit
l'environnement enfant par allowlist exacte puis lance la readiness. Le
`PASS` complet de cette readiness précède obligatoirement tout contrôle de
console, prompt ou process psql.

L'unique invocateur administratif est `Invoke-M1BDirectPsql`. Il lance
directement, sans shell ni recherche PATH :

```text
C:\Program Files\PostgreSQL\17\bin\psql.exe
```

avec exactement neuf tokens :

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

`UseShellExecute=false`, l'environnement allowlisté et les homes neutres sont
obligatoires. Tout `PG*` est refusé. Aucun secret admin ne peut apparaître
dans un argument, une variable, un fichier, Gradle, Java, Kotlin, Spring ou
Flyway : le seul canal autorisé est le prompt masqué natif de `psql -W` sur
une console Windows attachée.

Le futur `Preflight` lance exactement un psql. Son SQL fixe en mémoire utilise
`BEGIN TRANSACTION READ ONLY`, `statement_timeout=5s`,
`lock_timeout=2s` et `search_path=pg_catalog`. Le parseur exige deux lignes
structurées, UTF-8/base64/JSON stricts, sortie et temps bornés, exit zéro et
stderr vide. Il prouve client/serveur 17, endpoint
`127.0.0.1:15432`, base/user/session user `postgres`, capacités admin, cluster,
absence des deux cibles et première règle HBA runner applicable selon le
`rule_number` global exactement `hostnossl ... 127.0.0.1/32 scram-sha-256`,
sans option. Le payload exige un tableau JSON, des types primitifs exacts, des
clés uniques et l'état HBA attendu. Le manifeste sanitisé conserve capacités,
transaction read-only, timeouts, OID admin/base de maintenance, cluster et
binding HBA ; il ne mute rien et ne persiste jamais les sorties brutes.

Le futur `Lifecycle` exige le manifeste preflight exact et son hash, puis
dérive en mémoire un vérificateur SCRAM-SHA-256 depuis un password runner
CSPRNG. Le provisioning utilise un seul nouveau psql ; le rôle reste
`NOLOGIN` jusqu'à la fin de son durcissement. Targeted puis full ne reçoivent
que le secret runner. Le cleanup, dans `finally`, utilise un seul nouveau
psql, refuse toute session étrangère, vérifie cluster/OID/provenance, puis
prouve base, rôle et sessions à zéro. Aucun retry, recovery heuristique ou
process psql caché n'existe.

Le contrat de provenance Lifecycle est commun à PowerShell et Kotlin :
`ritomer-m1-1b:<RunId>:<ReviewedObjectSha256>:<ClusterSystemIdentifier>`.
`Get-M1BProvenance` est un producteur pur alimenté par les valeurs validées,
dont le cluster du manifeste Preflight validé. La validation stricte commune
aux builders provision/cleanup et au validateur de payload exige le préfixe
exact, 32 hex minuscules pour le run, 64 pour le hash et un cluster décimal
`[1-9][0-9]{0,19}`, sans caractère final supplémentaire. Le cluster incorporé
doit égaler le cluster attendu ; le cleanup exige aussi l'égalité du run.
La même valeur traverse les deux `COMMENT ON`, les commentaires observés et
les deux prédicats du cleanup. Aucun ancien format n'est accepté, même si
l'attendu et le payload utilisent tous deux cet ancien format.

Dans la garde JDBC, le véritable propriétaire de `public` est uniquement
`ritomer_043b_test_runner` ou `pg_database_owner`, sous réserve de tous les
autres invariants : connexion runner exacte, OID et provenances conformes,
base appartenant au runner et ACL conformes au véritable `nspowner`.
`postgres` et tout autre propriétaire sont refusés. Un droit `CREATE` ou une
membership ne remplace pas la propriété ; `NOINHERIT`, les restrictions du
runner et le rejet des memberships explicites restent requis. La validation
précède toujours la destruction sur la même connexion et transaction ; la
recréation conserve ses opérations fixes et son propriétaire runner.

Chaque commande sensible reçoit le SHA-256 lowercase du `psql.exe` exactement
autorisé. Le hash est recalculé avant chaque démarrage, persisté par Preflight,
relié par Lifecycle puis prouvé identique pour Provision et Cleanup. Une dérive
d'octets impose un arrêt et une nouvelle autorisation d'artefact.

Preflight et Lifecycle exigent deux records d'autorisation sensible distincts.
Le Lifecycle lie explicitement le record Preflight persisté, son manifeste et
son hash, puis son propre record à la commande Lifecycle exacte.

Avant readiness et après chaque phase, le rail recalcule le diff binaire exact
du composite `A8/M17/25` avec un index Git alternatif hors repository. Le hash
fourni par `ReviewedObjectSha256` doit être celui de ce `DIFF.patch` ; branche,
HEAD, top-level, index réel vide, file-set, états et octets sont ainsi rebornés.
Le binaire Git est épinglé et son environnement est reconstruit sans état
`GIT_*` parent.

L'alignement de ces deux contrats renouvelle le composite canonique et le
digest runtime. Toute future exécution sensible exige leur review et de
nouveaux bindings exacts ; les anciens manifestes, sidecars, records et
reviews restent intacts et ne prouvent que le code antérieur. Cet alignement
ne déclare aucune réussite PostgreSQL ni fermeture de M1.1B.

Gradle est créé suspendu sous Windows 10+ et attaché atomiquement à un Job
Object non nommé avec kill-on-close et liste fermée des trois handles standard,
avant toute reprise. L'arbre complet est terminé et attendu dans tous les cas,
afin qu'aucun worker ne survive avec le secret runner. Les logs système JUnit
sont désactivés, les fichiers de crash restent sous le root volatil et un scan
binaire borné de tout le root recherche le secret exact après chaque phase ;
toute contamination est supprimée puis arrête le rail. Un lock global commun à
tous les run IDs sérialise l'usage de la base et du rôle fixes.

La readiness lie en outre un SHA-256 déterministe du runtime exact : classes,
ressources, jars, racines JDK complètes du JVM Gradle et du `JavaLauncher` 21
explicitement assigné aux workers `Test`, wrapper et distribution Gradle. Ce
digest est persisté dans les deux manifestes ; Lifecycle exige celui du
manifeste Preflight, puis targeted et full le recalculent avant et après leur
exécution. Ce contrôle détecte une dérive accidentelle inter-phase ; les ACL de
l'hôte restent la frontière contre un adversaire utilisant le même compte
Windows.

Les sorties psql sont lues de façon incrémentale avec limite et timeout ; sur
erreur le child encore actif est tué et attendu. Les sidecars de hash sont lus
sur une ouverture unique, avec exactement 65 octets UTF-8 stricts et un LF
canonique ; les JSON refusent aussi les propriétés dupliquées. Les manifestes
create-new ne portent que les observations sanitisées et leurs hashes. Jamais
le SQL, stdout/stderr bruts, un password ou un vérificateur.

Ce correctif n'a exécuté ni `psql`, ni `Preflight`, ni `Lifecycle`, ni
`dbIntegrationTest` et n'a établi aucune connexion PostgreSQL. La correction
ne prouve donc pas le comportement DB réel ; le statut reste
`INCONCLUSIVE_PENDING_DB_EXECUTION` jusqu'à une mission sensible distincte.

### M1.1C — 17 paths, `A=2, M=15`

| Action | Path |
|---|---|
| M | `frontend/src/lib/api/http.ts` |
| A | `frontend/src/lib/api/session.ts` |
| A | `frontend/src/lib/api/session.test.ts` |
| M | `frontend/src/lib/api/me.ts` |
| M | `frontend/src/app/router.tsx` |
| M | `frontend/src/app/router.test.tsx` |
| M | `frontend/src/app/router.financial-statements-structured.test.tsx` |
| M | `frontend/src/app/router.financial-summary.test.tsx` |
| M | `frontend/src/app/router.import-balance.test.tsx` |
| M | `frontend/src/app/router.manual-mapping.test.tsx` |
| M | `frontend/src/app/router.workpapers.test.tsx` |
| M | `docs/ui/ui-foundations-v1.md` |
| M | `frontend/src/app/export-audit-pack-panel.tsx` |
| M | `frontend/src/lib/api/exports.ts` |
| M | `frontend/src/lib/api/workpapers.ts` |
| M | `frontend/src/app/workpapers-panel.tsx` |
| M | `specs/active/046-authenticated-session-foundation-v1.md` |

### M1.1D — 22 logical artifacts, 23 physical endpoints, `M=21, R=1`

| Action | Path |
|---|---|
| M | `frontend/vite.config.ts` |
| M | `frontend/local-demo-proxy.test.ts` |
| M | `frontend/local-two-actor-harness.mjs` |
| M | `frontend/local-two-actor-harness.test.ts` |
| M | `backend/src/main/resources/application-local.yml` |
| M | `README.md` |
| M | `runbooks/local-dev.md` |
| M | `docs/product/v1-plan.md` |
| M | `docs/present/architecture-cadrage-v1.md` |
| M | `docs/present/ux-cadrage-v1.md` |
| M | `contracts/openapi/mapping-suggestions-api.yaml` |
| M | `contracts/openapi/mapping-suggestions-v2-api.yaml` |
| M | `contracts/openapi/closing-folders-api.yaml` |
| M | `contracts/openapi/import-balance-api.yaml` |
| M | `contracts/openapi/manual-mapping-api.yaml` |
| M | `contracts/openapi/workpapers-api.yaml` |
| M | `contracts/openapi/documents-api.yaml` |
| M | `contracts/openapi/exports-api.yaml` |
| M | `docs/product/product-roadmap.md` |
| M | `backend/.env.example` |
| M | `docs/present/ai-cadrage-v1.md` |
| R | `specs/active/046-authenticated-session-foundation-v1.md` vers `specs/done/046-authenticated-session-foundation-v1.md` |

```text
M1_1A_BASE_SCOPE=12_PATHS_A3_M9
M1_1A_M8_SCOPE=8_PATHS_M8
M1_1A_WITH_M8_SCOPE=17_PATHS_A3_M14
M1_1B=17_PATHS_A6_M11_IMPLEMENTED
M1_1C=17_PATHS_A2_M15_IMPLEMENTED_LOCAL_NOT_DELIVERED
M1_1D=22_LOGICAL_23_PHYSICAL_M21_R1_NOT_IMPLEMENTED
M1_1_FINAL_OUTCOME_DELIVERED=NO
```

Le tableau A décrit le scope de base. Le delta correctif M8 modifie exactement huit paths et porte l'union A+M8 à `A=3, M=14, total=17`. Le file-set B implémenté contient exactement 17 paths, `A=6, M=11`. Le changement local C couvre les 17 chemins exacts ci-dessus, `A=2, M=15`, sans rename ni delete. D reste un contrat futur non implémenté ; son comptage devra être revalidé dans sa slice.

## 11. Tests, gates et stops

M1.1A doit prouver avec des sorties fraîches :

- `BackendApplicationSmokeTest` ciblé ;
- `PersistenceFoundationIntegrationTest` ciblé via `dbIntegrationTest` et PostgreSQL réel ;
- suite backend complète, sans altérer les dix-huit classes MockMvc `jwt()` hors file-set ;
- test inchangé qui exécute `ApplicationModules.verify()` ;
- build backend ;
- `git diff --check` ;
- delta correctif exact de 8 paths, `M=8`, et union A+M8 exacte de 17 paths, `A=3, M=14` ;
- vrai chemin MockMvc/Spring Security avec JWT HS256 compact signé, sans `with(jwt())`, prouvant Prometheus non mappé pour les acteurs actif, inconnu, inactif et révoqué ;
- health, liveness, readiness et info publics sans régression ;
- absence de payload Prometheus ;
- absence de path caché, dépendance, migration ou changement protégé ;
- scan de secret borné au diff et aux artefacts de review ;
- UTF-8 sans BOM, LF et newline terminal.

Les tests A couvrent au minimum : subject JWT absent, blank, inconnu et user inactif ; claims ignorés ; zéro write d'authentification ; quatre champs et sérialisation stable ; Clock UTC et corrélation serveur ; passthrough du principal ; relecture user/grants ; révocation immédiate ; erreurs DB propagées ; toutes les formes du header ; 400/403/404 ; binding post-membership ; aucun MDC pré-autorisation ; clear sur toutes les sorties ; identité, registration disabled, canaux `0/1` et ordre effectif du filtre.

Le rail PostgreSQL prouve les états actif, inconnu, user inactif et membership révoqué via le vrai chemin HTTP/JWT. Des snapshots triés avant/après de toutes les colonnes utiles et de `xmin` pour `app_user`, `tenant`, `tenant_membership` et `audit_event` restent strictement identiques ; le sujet inconnu reste absent et aucun create, updateProfile ou réactivation n'est observé.

Tout check requis failed, skipped, stale, missing ou indeterminate arrête la slice. Les stops A comprennent :

- rail PostgreSQL non préparé ou test skipped ;
- write d'authentification possible ;
- champ interdit dans le principal ;
- import Servlet, Spring Security, JDBC, identity interne ou infrastructure dans la couture shared application ;
- import Spring Security ou adaptateur infrastructure dans `ActorResolutionSupport` ;
- cycle Modulith ;
- tenant MDC avant autorisation ;
- identité, compteurs, canaux ou ordre du filtre non prouvés ;
- neuvième path du delta correctif ou dix-huitième path de l'union A+M8, dépendance ou migration ;
- modification d'un path protégé ;
- spec divergente du présent contrat.

### Gates et stops M1.1B

M1.1B doit prouver :

- bootstrap, login, rebootstrap et logout ; actorKey strict ; rotations SID/CSRF ; sauvegarde explicite ; attributs session allowlistés et réponses `no-store` ;
- les deux matrices firewall GET et unsafe en `400 REQUEST_REJECTED` avant la chaîne, puis séparément tracking `{COOKIE}`, URL non authentifiante, aucun rewrite et aucune fuite SID ;
- classe/getters Authentication exacts, trusted initial, downgrade `false` idempotent et irréversible, élévation `true` refusée, details impossible, authorities immuables, `getName`, `toString` constant et inspection récursive avant/après passivation ;
- installer actor-only résolvant request/response uniquement en infrastructure et sauvegardant le contexte ; controller sans import interne ; freshness filter sans import identity ;
- registration disabled des cinq beans, conteneur `0`, chaîne `1`, ordre complet, REQUEST/ASYNC/ERROR et MDC clear sur erreur ;
- compatibilité legacy bornée à la propriété HMAC déjà existante pour dev/test/dbtest, sans flag implicite ni activation navigateur ;
- bearer+cookie et bearer sur session endpoints refusés, CSRF courant seulement, cookie émis/supprimé exactement, logout Spring et expiry aux limites du `Clock` ;
- les dix marqueurs Cloud Run testés séparément par simple présence, profils et topologie exacts ;
- PostgreSQL réel pour seed, `/api/me`, révocations et zéro write d'authentification ;
- OpenAPI auth-session parsé, tests SecurityConfig et session ciblés, deux tests DemoSeed DB, backend complet, Modulith, build et scan secret ;
- read-back exact du contrat auth-session, de l'ADR 0007, de cette spec, du v1-plan et des trois cadrages du présent.

Stops B : HMAC requis au démarrage session ; tracking différent de `{COOKIE}` ; semicolon autorisé ; firewall différent de `400` ; SID réécrit ou divulgué ; graphe Authentication différent ou ré-élevable ; import/cycle ; filtre sans registration disabled ou ordre/invocation ambigu ; marqueur Cloud Run accepté ; DB skipped ; cookie affaibli ; dix-huitième path.

### Checks et stops du correctif rail PostgreSQL M1.1B

Les checks d'implémentation sont exclusivement non-DB : hash du plan et
baseline ; AST PowerShell 5.1 ; `DemoSeedLocalSourceGuardTest` ciblé ; audits
d'absence des canaux admin ; audits des neuf arguments, du transport, de
l'authentification, des timeouts, de HBA et des trois démarrages psql ;
suite backend complète ; build ; encodage/liens/scan secrets ; budget de
lignes ; `git diff --check` ; patch exact avec application et inversion dans
deux racines isolées issues de la baseline ; revalidation Git ; pack FULL et
review Codex séparée read-only du hash exact.

Les fixtures offline couvrent le parseur structuré nominal et ses rejets, la
matrice ordonnée de première règle HBA et le vecteur SCRAM-SHA-256
déterministe. Elles dot-sourcent le script sans dispatch. Elles ne peuvent
appeler ni console, ni psql, ni Gradle, ni DB.

Les tests de contrat de cet alignement comparent la sortie unique exacte du
vrai producteur PowerShell à `postgresTestRailProvenance` sur les mêmes
entrées. Ils réutilisent cette sortie dans les vrais builders et validateurs,
puis dans les commentaires de la fixture JDBC exerçant la vraie garde. Ils
vérifient les deux commentaires provisionnés, les deux comparaisons cleanup,
les formats et bindings divergents, ainsi que l'ancien attendu associé à
l'ancien payload. Les deux propriétaires admis sont exercés sous invariants
conformes ; propriétaire étranger, base étrangère avec `pg_database_owner`,
OID, ACL et memberships invalides sont refusés avant destruction simulée.
Les assertions de transaction et de recréation restent obligatoires. Ces
preuves non-DB ne remplacent pas les futurs targeted `2/13` et full `12/55`.

Le budget initial est de 8 628 lignes pour les quatre fichiers code candidats
et de 9 659 lignes pour les six fichiers. La réduction du correctif est prouvée
par comparaison de ces totaux liés au plan avec les totaux finaux ; le
`DIFF.patch` composite contre HEAD inclut toute M1.1B et ne mesure pas seul ce
delta de redesign. Les deux totaux finaux doivent être strictement inférieurs,
sans compression illisible.

Stops : divergence du plan, de la branche, du HEAD, de l'index, des six paths
ou du composite 25 ; septième path ; canal admin hors prompt psql ; tâche
Gradle rail supplémentaire ; argument, endpoint ou nombre de process
divergent ; parser/HBA/SCRAM fail-open ; secret ou sortie brute persistée ;
code non réduit ; check requis manquant, skipped ou en échec. Après
`FORMAL_CHECK_SEQUENCE_STARTED`, le premier échec arrête le goal sans
correction supplémentaire.

Les preuves PostgreSQL restent futures et séparément autorisées : un
Preflight réel, targeted `2/13`, full `12/55` et cleanup à zéro. Aucun guard,
test unitaire ou build non-DB ne permet de les déclarer exécutées ou
opérationnellement prouvées. La procédure liée est `runbooks/local-dev.md`.

### Boucle corrective non-DB bornée — stabilisation des pools dbtest M1.1B

Pour cette seule stabilisation, lorsqu'un mandat l'autorise explicitement,
un échec ordinaire et explicable de régression non-DB peut conduire à une
correction dans le même goal et le même file-set :
`application-dbtest.yml`, `DemoSeedLocalSourceGuardTest.kt`, ce document et
`runbooks/local-dev.md`. Il ne nécessite pas une nouvelle décision de Luis
à chaque tentative. Les tests et protections existants restent requis.

La boucle conserve le rouge attendu de configuration, applique le correctif
minimal, reteste les régressions ciblées, puis exécute SourceGuard complet,
la suite backend non-DB et le build avant la review indépendante finale.
Un finding correctible dans ce contrat suit la même boucle, avec des
preuves renouvelées et une nouvelle review des éléments affectés.

Le plafond reste de quatre itérations correctives et six heures de travail
actif cumulées entre le mandat initial et sa reprise ; les compteurs ne sont
pas réinitialisés. Le rouge initial attendu ne consomme pas une itération.
Chaque tentative conserve immédiatement son hypothèse, son delta, ses
identités, sa commande, ses horaires UTC, son résultat et un diagnostic
expurgé. Aucun retry identique sans information nouvelle ; deux corrections
consécutives sans progrès ou l'épuisement du budget imposent l'arrêt.

Cette règle ne modifie pas la clause historique
`FORMAL_CHECK_SEQUENCE_STARTED` du correctif rail précédent et n'a aucun
effet rétroactif. Elle ne couvre ni les refus de sécurité ou de permission,
ni les contrôles DB, le scanner réel, le cleanup, la delivery ou la
production. Les demandes d'accès passent uniquement par le mécanisme
officiel de la plateforme ; un refus explicite reste un arrêt. Aucun
résultat non-DB ne vaut validation PostgreSQL ou clôture de M1.1B.

### Gates et stops M1.1C

M1.1C doit prouver :

- bootstrap `200` et capability `404`, promesse unique sous StrictMode, login puis rebootstrap, CSRF mémoire remplacé/effacé, credentials same-origin et aucun storage ou bearer client ;
- transition explicite `LEGACY_PROXY_TRANSITION` sans ajout Authorization/CSRF et initialisation production du coordinator avant tout appel protégé ;
- `SESSION_READY` seul injecte le CSRF et bloque une mutation avant réseau si le token courant manque ;
- router bootstrap→me, chooser initial `401`, expiry `401` en état ready, `403` sans boucle, `404` opaque distinct de network/`5xx`, et logout accessible ;
- safe return mémoire limité à `/` et `/closing-folders/{UUID canonique}`, sans query/hash et refus des schémas, slashes, backslashes, contrôles ou encodages invalides ;
- focus/visibility dédupliqué et channel `ritomer:session:v1` avec payload exact `{type: SESSION_CHANGED}` ;
- aucun UUID acteur, subject, token, cookie ou SID dans DOM, URL, storage, IndexedDB ou channel ;
- deux vrais clients binaires : succès, Blob, headers et classifications préservés ; `401` courant observé ; ancien `401` après nouvelle session sans invalidation de celle-ci ;
- invalidation pendant les en-têtes puis pendant le Blob, timeout couvrant la lecture du corps même si l'abort est ignoré, et résolution tardive sans succès exploitable ni restauration de contexte ;
- deux vrais panneaux : téléchargement nominal et révocation de l'URL conservés ; invalidation contrôlée entre succès du vrai client et reprise du handler ; zéro URL objet, lien ou clic après invalidation ;
- absence du `createdByUserId` du pack dans tout le DOM, détails fermés puis ouverts, sans modification du DTO ou de l'audit ;
- sept fichiers ciblés, `pnpm test:ci`, `pnpm lint`, `pnpm build`, validateur file-set et scan secret.

Les assertions métier existantes restent requises. Les attentes modifiées pour une expiration de session doivent conserver séparément les preuves legacy. Les suites directes des clients et panneaux restent inchangées et sont exécutées par `pnpm test:ci`. Le contrôle du file-set couvre aussi les deux ajouts non suivis, sans validateur permanent supplémentaire.

Stops C : ordre indéterministe ; StrictMode dupliqué ; redirect dangereux ; boucle `403` ; credential stocké ; mutation non fail-closed ; bearer client ajouté ; test skipped ; tout chemin extérieur à la liste exacte des 17, même si le total reste inférieur ou égal à 17.

### Gates et stops M1.1D

M1.1D doit prouver :

- Vite loopback exact avec `strictPort`, target/changeOrigin/xfwd, aucune Authorization, aucun proxy build/preview et aucune activation legacy ;
- un Vite et deux jars isolés couvrant ACCOUNTANT, REVIEWER et ADMIN, tenant/rôle/membership, expiry, logout, relogin, cleanup et logs redacted ;
- parsing des huit OpenAPI, onze unsafe nouvelles, alternatives cookie/bearer, CSRF conditionnel, refus cohérents et `closing-api` non réactivé ;
- `application-local` canonique sans HMAC/decoder et `application-dev` inchangé, explicite, jamais activé ou injecté par Vite ;
- read-back README, runbook local, v1-plan, roadmap, cadrages architecture/UX/IA, UI foundations, ADR, `.env.example` et contrats ;
- conservation des marqueurs runbook contrôlés par `DemoSeedLocalSourceGuardTest` inchangé ;
- PostgreSQL réel non skipped, backend ciblé/complet/Modulith/build, frontend ciblé/test:ci/lint/build, validateurs et `git diff --check` ;
- après D seulement, E2E complet pour deux jars puis navigateur/version/origine exacts, cookie/CSRF/expiry/re-auth/focus/multi-tab/safe-return/accessibilité/privacy ;
- lifecycle final : source active absente, done présent, active count zéro, rename exact et matrice finale issue de l'union dédupliquée par chemin des file-sets effectivement livrés. L'artefact 046 modifié en C puis renommé en D reste un unique artefact logique ; ses chemins source et destination sont distingués dans le comptage physique. La mention historique « overlap unique et matrice finale 57 » ne constitue pas un total final revalidé : les tables historiques et le composite B n'ont pas le même domaine de comptage. Aucun nouveau total n'est présumé ici ; le file-set D reste 22 artefacts logiques / 23 chemins physiques, `M=21, R=1`.

Stops D : cookie `Secure __Host-` ne round-trip pas sur HTTP loopback ; navigateur/version/origine absent ; bearer/HMAC dans le parcours canonique, Vite, harness, docs ou `.env.example` ; séparation `application-dev` non prouvée ; contrat/scheme/refus manquant ; `closing-api` réactivé ; proxy non loopback ; DB/E2E/check skipped ; spec non fermée ; compte divergent ; vingt-quatrième endpoint ou path caché.

## 12. Autorisations et frontières

Cette spec ne constitue aucune autorisation. M1.1A avec son correctif M8 et M1.1B sont implémentés dans leurs file-sets bornés. M1.1C est implémenté et validé localement, sans delivery ; M1.1D n'est pas implémenté et l'outcome final M1.1 n'est pas livré.

Les états de review, delivery, merge, décision owner et autorisation vivent uniquement dans les Evidence Packs, la pull request et les records spécialisés.

Une autorisation d'implémentation n'implique jamais delivery, merge, exécution sensible ou production. Aucune action GitHub, aucun commit, push, PR, merge, déploiement ou usage de donnée réelle ne découle de cette spec.

Le correctif rail ne change pas cette règle. Toute connexion PostgreSQL, dont
`Preflight`, exige une mission distincte. `Lifecycle` exige en plus une review
sur les artefacts exacts et une autorisation sensible liée au run, au root, au
manifeste preflight, à l'environnement et à la commande exacts.

## 13. Frontière M1.2 et hors-scope

M1.2 conserve :

- l'IdP OIDC réel et la clé stable `issuer + subject` ;
- l'environnement partagé ;
- Spring Session JDBC ou une autre session partagée multi-instance ;
- la durabilité et la révocation distribuées.

Restent hors M1.1 : Redis, nouvelle dépendance, migration DB, JIT provisioning, SDK IdP, MFA, ABAC, RLS généralisée, microservice auth, cache d'autorité, production, donnée réelle, utilisateur externe et runtime IA/agent/MCP.

## 14. Impacts documentaires et contractuels

Le scope de base M1.1A ajoute seulement cette spec. Le correctif M8 modifie cette spec, `docs/product/v1-plan.md` et les trois cadrages du présent afin d'aligner la vérité durable de périmètre, en plus de la fermeture Prometheus et de ses preuves. Il ne modifie aucun contrat, ADR, runbook, README, roadmap ou fondation UI et n'anticipe aucune capacité B, C ou D.

M1.1B ajoute `contracts/openapi/auth-session-api.yaml` et `docs/adr/0007-authenticated-session-boundary.md`, puis modifie cette spec, `docs/product/v1-plan.md` et les trois cadrages du présent. Ces cinq read-backs documentaires portent le file-set B historique à 17 paths, `A=6, M=11`. Aucun README, runbook, roadmap, document UI, frontend ou contrat métier existant n'est inclus dans ce scope B historique.

Le correctif rail PostgreSQL est un sous-scope distinct de six paths,
`A=2/M=4`, qui modifie uniquement le runbook et cette spec côté documentation,
sans changer le sequencing V1, un contrat, une ADR, un cadrage du présent,
README, frontend, dépendance ou migration. Son unique overlap avec B est cette
spec ; le composite observé reste `A=8/M=17/25`.

Les impacts C et D sont bornés ainsi :

- C : `docs/ui/ui-foundations-v1.md` et cette spec, réalignées dans le même changement que l'implémentation C, sans delivery documentaire séparée. Le statut d'implémentation reflète uniquement les preuves locales obtenues après les checks ; delivery et intégration navigateur D restent distinctes ;
- D : README, local-dev, v1-plan, product-roadmap, trois cadrages, huit OpenAPI, `.env.example`, puis rename de la spec.

`contracts/db/core-persistence-foundation.md` ne change pas : aucun schéma, table, contrainte ou migration n'est ajouté. `contracts/openapi/closing-api.yaml` reste protégé. Les autres OpenAPI ne sont alignés à la session qu'en D. Toute contradiction réellement bloquante impose un stop de file-set ; elle n'autorise pas un path supplémentaire en A.
