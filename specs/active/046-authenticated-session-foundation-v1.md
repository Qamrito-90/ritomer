# 046 — Authenticated session foundation V1

## 1. Statut, surface et risque

```text
SPEC_STATUS=ACTIVE
MILESTONE=M1_1_AUTHENTICATED_SESSION_FOUNDATION
RISK_CLASS=C
EVIDENCE_LEVEL=FULL

M1_1A_SCOPE=BACKEND_AUTH_TENANT_FOUNDATION_WITH_CORRECTIVE_M8
M1_1_FINAL_OUTCOME_DELIVERED=NO

M1_1B_IMPLEMENTED=NO
M1_1C_IMPLEMENTED=NO
M1_1D_IMPLEMENTED=NO

PROMETHEUS_WEB_EXPOSURE=CLOSED_FAIL_CLOSED
PUBLIC_MANAGEMENT_ENDPOINTS=HEALTH_INFO_ONLY

SESSION_CREATED=NO
COOKIE_CREATED=NO
CSRF_CREATED=NO
FRONTEND_MODIFIED=NO

AI_RUNTIME=NO
AGENT_RUNTIME=NO
MCP_RUNTIME=NO
```

Cette spec reste active pendant les quatre slices cumulatives. Le checkpoint A ne livre pas une session : il borne le principal applicatif, la lecture d'autorité fraîche aux frontières métier protégées et la sûreté tenant requises par la future frontière de session. Le correctif M8 ferme fail-closed l'exposition HTTP de Prometheus ; seuls health et info restent exposés. La fermeture et le déplacement vers `specs/done/` appartiennent exclusivement à M1.1D.

## 2. Outcome M1.1 et outcome borné M1.1A

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

M1.1B ajoutera uniquement les registrations disabled des quatre nouveaux filtres de session et revalidera la bijection des cinq.

## 7. Contrat cible M1.1B — kernel session backend

M1.1B introduira, après autorisation distincte, le kernel session default-off, bootstrap/login/logout, rotation, CSRF, expiry et invalidation. Le cookie cible est :

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

Le firewall interdira le semicolon et les formes URL-session avec `400 REQUEST_REJECTED`. `AuthenticatedActorAuthentication` implémentera directement `Authentication`, avec credentials/details nuls, authorities vides immuables, downgrade vers `false` idempotent et irréversible, élévation vers `true` interdite et `toString` redacted.

Les codes cibles incluent `INVALID_REQUEST`, `AUTHENTICATION_FAILED`, `SESSION_ALREADY_AUTHENTICATED`, `AMBIGUOUS_CREDENTIALS`, `BEARER_NOT_ALLOWED_FOR_SESSION_ENDPOINT`, `SESSION_EXPIRED`, `CSRF_REJECTED`, `ACCESS_REVOKED`, `INVALID_TENANT_HEADER`, `ACCESS_DENIED` et `NOT_FOUND`.

Le confinement local/test est explicite et fail-closed face aux marqueurs Cloud Run. `PORT` seul n'est jamais une preuve de Cloud Run. La compatibilité bearer backend reste explicite et ne s'étend jamais au navigateur.

### 7.1 Flux, statuts et précédence cibles

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

### 7.2 Confinement local/test cible

La capability locale existe seulement avec `session.enabled=true`, un ensemble de profils exactement égal à `{local}`, `{test}` ou `{dbtest}`, le backend résolu sur `127.0.0.1:8080`, Vite sur `127.0.0.1:5173`, `remoteAddr=127.0.0.1`, Host et Origin exacts, et aucun `Forwarded` ou `X-Forwarded-*`. Sont refusés : `localhost`, wildcard, `0.0.0.0`, `::`, `::1`, LAN, proxy distant, Origin absent sur unsafe et overrides CLI.

La simple présence, valeur vide incluse, de l'un des dix marqueurs suivants interdit la capability locale : `K_SERVICE`, `K_REVISION`, `K_CONFIGURATION`, `CLOUD_RUN_JOB`, `CLOUD_RUN_EXECUTION`, `CLOUD_RUN_TASK_INDEX`, `CLOUD_RUN_TASK_ATTEMPT`, `CLOUD_RUN_TASK_COUNT`, `CLOUD_RUN_WORKER_POOL`, `CLOUD_RUN_REVISION`. `PORT` seul n'est pas probant.

### 7.3 Firewall, Authentication et filtres cibles

Le tracking effectif est le singleton `{COOKIE}`. `StrictHttpFirewall` refuse le semicolon et les deux formes matricielles `;jsessionid=` et paramètre URI dérivé du cookie, sur GET et unsafe, avant toute chaîne, avec `400 REQUEST_REJECTED`, body minimal et `Cache-Control: no-store`. Des preuves distinctes établissent l'absence d'authentification URL, de rewrite par `encodeURL`/`encodeRedirectURL`, de redirection et de SID dans body, URL, Location, headers ou logs.

`AuthenticatedActorAuthentication` est final, construit seulement après résolution interne validée et implémente directement `Authentication`. Son principal est l'instance exacte de `AuthenticatedActor`, credentials et details sont nuls, authorities est vide et immuable, `getName()` retourne la corrélation opaque, `toString()` est constant et redacted. L'état initial trusted vaut `true`; `setAuthenticated(false)` est idempotent et irréversible ; toute tentative de `setAuthenticated(true)` est refusée avant et après downgrade. Le graphe est inspecté avant et après sérialisation, en états trusted et downgraded, y compris sous concurrence contrôlée.

Les cinq filtres custom sont des beans uniques, chacun avec une registration Servlet disabled et une politique REQUEST-only : `SessionCredentialConflictFilter`, `SessionExpiryFilter`, `LocalAuthBoundaryFilter`, `TenantMdcFilter`, `SessionAuthorityFreshnessFilter`. Le conteneur les invoque zéro fois et la chaîne Security exactement une fois ; ASYNC et ERROR ne créent aucune invocation secondaire. L'ordre complet par instances est : `SecurityContextHolderFilter` → conflict → expiry → local boundary → tenant MDC → authority freshness → `CsrfFilter` → `LogoutFilter` → `BearerTokenAuthenticationFilter` seulement avec decoder legacy explicite → `AuthorizationFilter`.

## 8. Contrat cible M1.1C — coordinator frontend

M1.1C introduira, après autorisation distincte, un coordinator unique pour bootstrap, login, rebootstrap, `/api/me` et logout. Les requêtes seront same-origin avec credentials. Le CSRF restera uniquement en mémoire.

Aucun bearer, cookie, SID, identifiant acteur ou secret ne sera stocké ou rendu dans le DOM, URL, storage, IndexedDB ou channel. Une mutation en état `SESSION_READY` sans CSRF courant sera bloquée avant le réseau. Les états initial, expired, forbidden, network et capability 404 resteront distincts.

Le safe return sera limité à `/` et `/closing-folders/{UUID canonique}`, sans query ni fragment. StrictMode, focus et `BroadcastChannel` seront dédupliqués. Les contrôles accessibles, dont logout, resteront utilisables au clavier et sur viewport étroit.

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

### M1.1B — 12 paths, `A=6, M=6`

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

### M1.1C — 12 paths, `A=2, M=10`

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
M1_1B=12_PATHS_A6_M6_NOT_IMPLEMENTED
M1_1C=12_PATHS_A2_M10_NOT_IMPLEMENTED
M1_1D=22_LOGICAL_23_PHYSICAL_M21_R1_NOT_IMPLEMENTED
M1_1_FINAL_OUTCOME_DELIVERED=NO
```

Le tableau A décrit le scope de base. Le delta correctif M8 modifie exactement huit paths et porte l'union A+M8 à `A=3, M=14, total=17`. Les file-sets B, C et D restent des contrats futurs non implémentés ; chaque slice future exige une autorisation distincte et ses comptages devront alors être revalidés.

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
- OpenAPI auth-session parsé, tests SecurityConfig et session ciblés, deux tests DemoSeed DB, backend complet, Modulith, build et scan secret.

Stops B : HMAC requis au démarrage session ; tracking différent de `{COOKIE}` ; semicolon autorisé ; firewall différent de `400` ; SID réécrit ou divulgué ; graphe Authentication différent ou ré-élevable ; import/cycle ; filtre sans registration disabled ou ordre/invocation ambigu ; marqueur Cloud Run accepté ; DB skipped ; cookie affaibli ; treizième path.

### Gates et stops M1.1C

M1.1C doit prouver :

- bootstrap `200` et capability `404`, promesse unique sous StrictMode, login puis rebootstrap, CSRF mémoire remplacé/effacé, credentials same-origin et aucun storage ou bearer client ;
- transition explicite `LEGACY_PROXY_TRANSITION` sans ajout Authorization/CSRF et initialisation production du coordinator avant tout appel protégé ;
- `SESSION_READY` seul injecte le CSRF et bloque une mutation avant réseau si le token courant manque ;
- router bootstrap→me, chooser initial `401`, expiry `401` en état ready, `403` sans boucle, `404` opaque distinct de network/`5xx`, et logout accessible ;
- safe return mémoire limité à `/` et `/closing-folders/{UUID canonique}`, sans query/hash et refus des schémas, slashes, backslashes, contrôles ou encodages invalides ;
- focus/visibility dédupliqué et channel `ritomer:session:v1` avec payload exact `{type: SESSION_CHANGED}` ;
- aucun UUID acteur, subject, token, cookie ou SID dans DOM, URL, storage, IndexedDB ou channel ;
- sept fichiers ciblés, `pnpm test:ci`, `pnpm lint`, `pnpm build`, validateur file-set et scan secret.

Stops C : ordre indéterministe ; StrictMode dupliqué ; redirect dangereux ; boucle `403` ; credential stocké ; mutation non fail-closed ; bearer client ajouté ; test skipped ; treizième path.

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
- lifecycle final : source active absente, done présent, active count zéro, rename exact, overlap unique et matrice finale 57.

Stops D : cookie `Secure __Host-` ne round-trip pas sur HTTP loopback ; navigateur/version/origine absent ; bearer/HMAC dans le parcours canonique, Vite, harness, docs ou `.env.example` ; séparation `application-dev` non prouvée ; contrat/scheme/refus manquant ; `closing-api` réactivé ; proxy non loopback ; DB/E2E/check skipped ; spec non fermée ; compte divergent ; vingt-quatrième endpoint ou path caché.

## 12. Autorisations et frontières

Cette spec ne constitue aucune autorisation. M1.1A avec son correctif M8 borne uniquement la fondation backend auth/tenant ; M1.1B, M1.1C et M1.1D ne sont pas implémentées et chaque slice future exige une autorisation distincte.

Les états de review, delivery, merge et décision owner vivent uniquement dans les Evidence Packs, la pull request et les records spécialisés.

Une autorisation d'implémentation n'implique jamais delivery, merge, exécution sensible ou production. Aucune action GitHub, aucun commit, push, PR, merge, déploiement ou usage de donnée réelle ne découle de cette spec.

## 13. Frontière M1.2 et hors-scope

M1.2 conserve :

- l'IdP OIDC réel et la clé stable `issuer + subject` ;
- l'environnement partagé ;
- Spring Session JDBC ou une autre session partagée multi-instance ;
- la durabilité et la révocation distribuées.

Restent hors M1.1 : Redis, nouvelle dépendance, migration DB, JIT provisioning, SDK IdP, MFA, ABAC, RLS généralisée, microservice auth, cache d'autorité, production, donnée réelle, utilisateur externe et runtime IA/agent/MCP.

## 14. Impacts documentaires et contractuels

Le scope de base M1.1A ajoute seulement cette spec. Le correctif M8 modifie cette spec, `docs/product/v1-plan.md` et les trois cadrages du présent afin d'aligner la vérité durable de périmètre, en plus de la fermeture Prometheus et de ses preuves. Il ne modifie aucun contrat, ADR, runbook, README, roadmap ou fondation UI et n'anticipe aucune capacité B, C ou D.

Les impacts ultérieurs sont bornés ainsi :

- B : `contracts/openapi/auth-session-api.yaml` et ADR 0007 ;
- C : `docs/ui/ui-foundations-v1.md` ;
- D : README, local-dev, v1-plan, product-roadmap, trois cadrages, huit OpenAPI, `.env.example`, puis rename de la spec.

`contracts/db/core-persistence-foundation.md` ne change pas : aucun schéma, table, contrainte ou migration n'est ajouté. `contracts/openapi/closing-api.yaml` reste protégé. Les autres OpenAPI ne sont alignés à la session qu'en D. Toute contradiction réellement bloquante impose un stop de file-set ; elle n'autorise pas un path supplémentaire en A.
