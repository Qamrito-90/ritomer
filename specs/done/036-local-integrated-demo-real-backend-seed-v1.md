# 036 - Local integrated demo real backend seed V1

## Status

Done.

Cloturee apres merge de 036a, 036b et 036c.

036 ne porte plus de sous-livrable actif et n'ouvre pas de prochaine spec.

## Surface

Spec cloturee : DOCS_GIT.

Sous-livrable 036a livre : BACKEND / DB optional test.

036a a livre une commande backend dev-only de seed demo PostgreSQL local, default off, fail-fast hors `local` / `test` / `dbtest`, sans secret commite, sans donnees client reelles, sans bypass auth, sans endpoint HTTP, sans OpenAPI, sans migration DB, sans GraphQL et sans IA runtime.

Sous-livrable 036b livre : BACKEND_TEST / DB_INTEGRATION / AUTH/JWT / TENANT_MEMBERSHIP.

036b a livre un smoke backend `dbIntegrationTest` prouvant que le seed 036a, PostgreSQL reel et la vraie validation JWT permettent a `GET /api/me` de resoudre `activeTenant` depuis la base avec un vrai Bearer JWT, et de rejeter un mauvais tenant via les controles existants.

Sous-livrable 036c livre : FRONTEND_SPEC / DOCS_GIT.

036c a livre un proxy Vite dev-only `/api` vers backend local, avec injection bearer optionnelle strictement cote serveur Vite et shell local, sans token navigateur, sans variable `VITE_*`, sans stockage navigateur, sans backend runtime durable, sans endpoint HTTP nouveau, sans OpenAPI et sans migration DB.

Closure mission: DOCS_ONLY.

Contrats impactes par cette cloture documentaire : AUCUN.

Runbooks impactes par cette cloture documentaire : AUCUN.

## Risk

C.

La cloture documentaire ne modifie aucun runtime. Les surfaces livrees par 036a, 036b et 036c restent bornees au seed demo PostgreSQL local dev-only, au smoke auth/backend `dbIntegrationTest` et au proxy Vite dev-only avec bearer conserve cote serveur Vite.

## Role de cette spec

Cadrer une demo locale integree realiste de Ritomer avec backend reel, PostgreSQL reel, auth JWT reelle, tenant reel, membership reelle et donnees demo synthetiques persistees.

Le but produit est de permettre de visualiser et tester le produit localement sans mock frontend principal, avec les vrais endpoints REST, les vraies validations backend, la vraie base PostgreSQL et un dataset demo persistant.

Le cadrage initial ne creait aucun seed, ne modifiait aucun runtime, ne modifiait aucun contrat et ne definissait aucune valeur de configuration sensible. Apres decisions CPO/CTO, 036a et 036b ont ete livres en implementation backend bornee. 036c a ete livre comme implementation frontend/doc bornee au proxy Vite local dev-only et a sa documentation, sans backend runtime durable.

La cloture 036 ne livre aucun endpoint de mint token, aucune commande JWT locale, aucun backend runtime durable supplementaire, aucun contrat OpenAPI, aucune migration DB, aucune IA runtime et aucun GraphQL.

## Sous-livrable 036a - backend demo seed command dev-only

036a est autorise et borne a une commande Gradle backend `demoSeedLocal`.

Le seed 036a :

- est desactive par defaut ;
- exige `ritomer.demo.seed.enabled=true`, passe localement via `-PritomerDemoSeedEnabled=true` ;
- fail-fast hors profils `local`, `test` ou `dbtest` ;
- fail-fast si des marqueurs Cloud Run ou production-like sont presents dans l'environnement d'execution ;
- refuse toute datasource autre qu'une cible PostgreSQL locale explicite (`localhost`, `127.0.0.1` ou `[::1]`) ;
- exige que cette datasource locale explicite soit visible par le guard via `spring.datasource.url`, `SPRING_DATASOURCE_URL` ou `RITOMER_DB_TEST_JDBC_URL`, sans fallback implicite deduit du profil `local` ;
- refuse les URLs datasource distantes, Cloud SQL directes, prod-like ou non verifiables ;
- s'execute en Spring non-web ;
- ne se lance pas au demarrage normal du backend ;
- cree ou realigne de maniere idempotente un tenant demo actif, un app_user demo actif, une membership active, un closing_folder demo non archive, un balance_import version 1, des lignes de balance synthetiques equilibrees et des manual_mapping coherents avec la taxonomie active ;
- reste tenant-scope et prouve le non-acces mauvais tenant au niveau repository dans les tests DB optionnels ;
- n'ajoute aucun endpoint HTTP, bypass Spring Security, commande JWT, frontend, proxy Vite, OpenAPI, migration DB, GraphQL ou IA runtime.

Les suites `test` couvrent les garde-fous d'activation et l'absence de surface HTTP/auth sensible. La suite `dbIntegrationTest` couvre la preuve PostgreSQL reelle et l'idempotence quand une configuration PostgreSQL explicite est disponible.

## Sous-livrable 036b - smoke backend auth me dbIntegrationTest

036b est autorise et borne a un test backend `dbIntegrationTest`.

Le smoke 036b :

- reutilise le seed 036a dans le contexte Spring `dbtest` ;
- genere un JWT HS256 uniquement en memoire dans le test ;
- configure le test pour passer par le vrai `JwtDecoder` du backend ;
- envoie un vrai header HTTP `Authorization: Bearer <jwt>` via `MockMvc` ;
- verifie que `GET /api/me` sans `Authorization` retourne `401` ;
- verifie que `GET /api/me` avec JWT signe et `sub` demo retourne `200` ;
- verifie que le `sub` du JWT correspond a `DemoSeedLocalDataset.userExternalSubject` ;
- verifie que `activeTenant.tenantId`, `activeTenant.tenantSlug` et `activeTenant.tenantName` correspondent au tenant demo seede ;
- verifie que `effectiveRoles` contient `ACCOUNTANT` depuis `tenant_membership` en base ;
- ajoute de faux claims tenant/role dans le JWT et verifie qu'ils ne pilotent ni `activeTenant`, ni `effectiveRoles` ;
- teste un mauvais tenant sur un endpoint tenant-scoped existant, par exemple `GET /api/closing-folders/{closingFolderId}` avec `X-Tenant-Id` non autorise ou inexistant, et attend le comportement standard du repo (`403` si tenant inaccessible ou `404` si dossier hors tenant) ;
- n'utilise pas `with(jwt())` pour le test principal ;
- n'injecte aucune authentication mockee ;
- ne court-circuite pas `BearerTokenAuthenticationFilter` ;
- n'ajoute aucun endpoint HTTP de mint token, bypass Spring Security, header utilisateur arbitraire, frontend, proxy Vite, OpenAPI, migration DB, GraphQL ou IA runtime.

## Sous-livrable 036c - local Vite dev-proxy frontend/backend smoke

036c est autorise et borne a la configuration frontend Vite dev-only et a sa documentation.

Le smoke 036c :

- ajoute un proxy Vite `/api` present uniquement en dev server `serve` ;
- cible par defaut le backend local `http://localhost:8080` ;
- permet de configurer la target backend via une variable shell non sensible `RITOMER_LOCAL_DEMO_BACKEND_TARGET` ;
- active l'injection bearer seulement si `RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED=true` est defini dans le shell local ;
- lit le bearer seulement cote Node/Vite via `RITOMER_LOCAL_DEMO_BEARER_TOKEN`, jamais via `VITE_*`, jamais via `import.meta.env`, jamais depuis le navigateur ;
- injecte `Authorization: Bearer <jwt>` uniquement vers les targets locales `localhost` ou `127.0.0.1` ;
- fail-fast si l'auth proxy locale est activee sans token shell ;
- fail-fast si l'auth proxy locale est activee vers une target non locale ;
- n'injecte jamais `Authorization` vers une target non locale ;
- garde le build production sans proxy, sans token et sans comportement demo ;
- ne logge ni le token, ni les headers complets ;
- ne modifie aucun backend runtime, aucune chaine Spring Security, aucun endpoint, aucun contrat OpenAPI, aucune migration DB et aucune auth frontend durable.

036c ne fait pas du navigateur le porteur durable du bearer : le navigateur appelle `/api`, et le serveur de developpement Vite peut ajouter le header seulement cote serveur local pendant la demo.

## Sources de verite relues

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/ai-cadrage-v1.md`
- `docs/adr/0001-monolithe-modulaire.md`
- `docs/adr/0002-rest-first-graphql-later.md`
- `docs/adr/0003-ai-gateway-evidence-first.md`
- `docs/adr/0004-multi-tenancy-audit-rls-progressive.md`
- `docs/adr/0005-front-ui-stack-and-design-system.md`
- `docs/adr/0006-postgresql-cloud-sql-no-docker-v1.md`
- `docs/product/v1-plan.md`
- `specs/done/036-local-integrated-demo-real-backend-seed-v1.md`
- `specs/done/004-frontend-foundation-design-system.md`
- `specs/done/015-frontend-closing-folders-entrypoint-v1.md`
- `specs/done/035-pilot-export-pack-minimal-annex-refresh-ui-v1.md`
- `contracts/db/core-persistence-foundation.md`
- `contracts/db/import-balance-v1.md`
- `contracts/db/manual-mapping-v1.md`
- `contracts/db/workpapers-v1.md`
- `contracts/db/documents-v1.md`
- `contracts/db/exports-v1.md`
- `contracts/db/mapping-suggestion-decision-v1.md`
- `runbooks/local-dev.md`
- `docs/ui/ui-foundations-v1.md`
- `README.md`
- `docs/vision/architecture.md`
- `docs/vision/ux.md`
- `docs/vision/ai-native.md`
- `docs/playbooks/architecture.md`
- `docs/playbooks/ux.md`
- `docs/playbooks/ai.md`

Contrats impactes par cette mission documentaire : AUCUN.

Runbooks modifies par cette mission documentaire : AUCUN.

## Probleme exact

Le frontend seul peut afficher `profil indisponible` ou bloquer avant le rendu du dossier, car le flux produit attend d'abord :

1. `GET /api/me` sans `X-Tenant-Id` ;
2. un `activeTenant` exploitable ;
3. les appels REST dossier avec `X-Tenant-Id = activeTenant.tenantId`.

Dans le parcours local actuel, ce comportement ne prouve pas le produit reel si :

- le backend n'est pas lance derriere le frontend ;
- `/api/me` n'est pas servi par le backend depuis l'origine frontend ;
- aucun proxy local Vite ne route `/api/*` vers le backend ;
- aucun JWT local valide n'est fourni au frontend ;
- aucun tenant, app_user ou tenant_membership actif ne permet de resoudre `activeTenant` ;
- aucun dossier seed n'existe en PostgreSQL pour afficher des donnees metier.

Une vitrine UI mockee ou un frontend autonome ne suffit donc pas. Elle peut etre utile pour des tests de composants, mais elle ne prouve ni l'auth reelle, ni le scoping tenant, ni les validations backend, ni la persistance PostgreSQL.

## Objectif produit

Permettre a un evaluateur local de lancer PostgreSQL, le backend et le frontend, puis de parcourir un dossier demo synthetique persiste en base via les endpoints REST existants.

Le parcours cible doit prouver :

- `frontend -> backend` via proxy local explicite ;
- `backend -> PostgreSQL` via configuration locale explicite ;
- `auth JWT -> app_user -> tenant_membership active -> activeTenant` ;
- `activeTenant -> X-Tenant-Id -> dossier demo -> donnees visibles` ;
- rejet d'un mauvais tenant ou d'un dossier hors tenant ;
- absence de mock frontend comme source principale de verite.

## Comportement cible futur

### Sequence nominale

1. PostgreSQL reel est disponible localement ou via une cible explicite non Docker.
2. Le backend est lance en profil local.
3. Le seed demo dev-only est active explicitement.
4. Le seed cree ou met a jour de maniere idempotente un dataset demo synthetique tenant-scope.
5. Un JWT local signe est obtenu de maniere documentee, sans valeur commitee, sans fichier `.env` lu ou modifie et sans endpoint public de contournement.
6. Le frontend est lance avec un proxy Vite local `/api/*` vers le backend.
7. Si l'auth proxy demo est activee, le token reste dans l'environnement shell du serveur Vite et le navigateur appelle seulement `GET /api/me` via `/api`.
8. Le proxy Vite injecte le bearer server-side uniquement vers `localhost` ou `127.0.0.1`.
9. Le backend resout l'utilisateur demo et son membership actif.
10. Le frontend recoit un `activeTenant` exploitable.
11. Le frontend appelle les endpoints dossier avec le `X-Tenant-Id` du tenant actif.
12. Le dossier seed est visible avec des donnees reelles servies par le backend.
13. Une tentative avec un mauvais tenant est rejetee et ne retourne aucune donnee metier d'un autre tenant.

### Regles de preuve

- Les endpoints REST consommes doivent etre les endpoints existants.
- Les validations backend existantes doivent rester actives.
- Le frontend principal ne doit pas basculer sur des fixtures pour le parcours demo.
- Les donnees doivent venir de PostgreSQL.
- Les donnees demo doivent etre synthetiques, reconnaissables comme fictives et sans source client reelle.
- Le seed ne doit pas activer de provider IA, de prompt runtime, de modele reel, de RAG ou de vector store.

## Donnees minimales seedees

### Obligatoire

Le seed futur doit couvrir au minimum :

- un `tenant` demo actif ;
- un `app_user` demo actif ou equivalent au modele existant ;
- une `tenant_membership` active rattachant l'utilisateur demo au tenant demo ;
- un `closing_folder` demo non archive ;
- une `balance_import` versionnee pour ce dossier ;
- des `balance_import_line` synthetiques equilibrees ;
- des `manual_mapping` coherents avec le dernier import et le referentiel actif ;
- assez de donnees pour rendre les read-models existants lisibles dans le frontend principal.

Le dataset doit permettre a `GET /api/me` de retourner un `activeTenant` exploitable dans le scenario demo. Si le backend resout `activeTenant` automatiquement uniquement quand un seul membership actif existe, le seed demo doit respecter cette contrainte ou documenter le flux local exact qui selectionne le tenant sans bypass.

### Conditionnel

Les donnees suivantes ne doivent etre seedees que si le repo permet une creation realiste via les couches metier existantes, sans faux stockage dangereux et sans contournement d'audit :

- controls/readiness : expose via read-model derive si les donnees obligatoires suffisent ; ne pas persister un faux resultat de readiness si le present le definit comme derive ;
- workpapers : autorises si crees avec les invariants tenant, anchors, status et audit attendus ;
- documents : autorises uniquement avec un objet local reel gere par le backend, metadata coherentes, checksum valide et aucune cle de stockage exposee ;
- export pack : autorise uniquement si genere par le service existant et stocke comme pack reel backend-only ;
- minimal annex : read-model uniquement, sans persistance fake.

Si ces conditions ne sont pas remplies, l'implementation 036 doit limiter le seed au noyau obligatoire et documenter les surfaces non seedables comme non applicables dans le smoke local.

## Garde-fous anti-prod

L'implementation 036 doit respecter tous les garde-fous suivants :

- activation explicitement limitee a `local` ou `test` ;
- default off ;
- fail-fast hors profils `local` ou `test` ;
- impossible a activer en production, y compris par configuration accidentelle ;
- impossible a activer si des marqueurs Cloud Run ou production-like sont detectes dans l'environnement d'execution ;
- impossible a activer contre une datasource distante, Cloud SQL directe, prod-like ou non verifiable ;
- aucune valeur sensible commitee ;
- aucune donnee client reelle ;
- aucun token commite ;
- aucun bypass auth ;
- aucun endpoint public de mint token ;
- aucun mock frontend comme parcours principal ;
- aucun Docker impose ;
- aucun GraphQL ;
- aucune activation IA ;
- seed idempotent ;
- seed tenant-scope ;
- mauvais tenant rejete ;
- repositories tenant-scoped conserves ;
- audit conserve pour les mutations metier significatives ou justification explicite si une operation de bootstrap dev-only ne correspond pas a une action metier utilisateur.

## Auth JWT locale attendue

La demo doit utiliser la vraie chaine d'auth JWT du backend.

L'implementation 036 doit documenter comment obtenir un JWT local signe sans commiter de secret, de token ou de valeur sensible. Le JWT local doit porter un sujet compatible avec l'utilisateur demo seed ou avec le mecanisme de synchronisation utilisateur existant.

Pour 036c, le bearer local n'est pas une auth frontend durable. Il reste dans l'environnement shell qui lance Vite, sous `RITOMER_LOCAL_DEMO_BEARER_TOKEN`, et n'est jamais expose via `VITE_*`, `import.meta.env`, bundle frontend, navigateur, `localStorage`, `sessionStorage`, `.env` commite ou logs. Le proxy Vite refuse l'injection si la target n'est pas locale.

Interdits :

- desactiver Spring Security ;
- accepter un header utilisateur arbitraire comme auth ;
- forcer `activeTenant` cote frontend ;
- injecter un utilisateur mock dans le frontend principal ;
- commiter un token, une cle ou une valeur de signature ;
- lire ou modifier un fichier `.env` pour le bearer 036c ;
- exposer le bearer au bundle, au navigateur, au stockage navigateur ou aux logs ;
- ajouter un endpoint public de generation de token.

## Flux local attendu

Le runbook futur devra decrire un flux sans valeur sensible commitee :

1. Demarrer une instance PostgreSQL explicite, locale ou distante.
2. Fournir localement la configuration necessaire au backend.
3. Lancer le backend en profil local.
4. Activer explicitement le seed demo dev-only.
5. Generer ou obtenir un JWT local signe selon la procedure documentee, sans le commiter ni le stocker dans le repo.
6. Lancer le frontend avec le proxy Vite `/api` et, si necessaire pour la demo, `RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED=true` plus `RITOMER_LOCAL_DEMO_BEARER_TOKEN` dans le shell local.
7. Ouvrir `/` puis le dossier demo visible.
8. Verifier que le frontend charge `GET /api/me` puis les endpoints dossier via backend reel.
9. Verifier que le bearer n'apparait ni dans le bundle, ni dans le navigateur, ni dans les logs.
10. Verifier visuellement les donnees demo persistantes.
11. Verifier qu'un mauvais tenant est rejete.

Le flux ne doit pas imposer Docker, Docker Compose ou Testcontainers.

## Fichiers cibles du cadrage initial

- configuration backend locale hors 036c ;
- code backend de seed dev-only hors 036c ;
- tests backend du seed, de l'auth locale et du rejet mauvais tenant hors 036c ;
- `frontend/vite.config.ts` pour le proxy local si necessaire ;
- test frontend de config/proxy ;
- `runbooks/local-dev.md` ;
- eventuellement `README.md`.

Cette liste ne cree aucune autorisation de backend runtime dans la mission 036c.

## Contrats et API

L'implementation 036 ne doit pas modifier le contrat OpenAPI pour livrer cette demo.

Elle doit utiliser les endpoints REST existants. Toute nouvelle surface publique exigerait une nouvelle spec ou un amendement explicite, et n'est pas autorisee par 036.

Les contrats DB ne doivent etre modifies que si l'implementation 036 prouve un besoin durable de schema. Un seed dev-only doit prioritairement s'appuyer sur le schema existant et les couches metier existantes.

## Checks attendus pour les implementations 036a, 036b et 036c

Checks automatises attendus selon surface touchee :

- backend test : `.\gradlew.bat test`
- verification modulith si applicable : `.\gradlew.bat test --tests "*ApplicationModule*"`
- `dbIntegrationTest` si le seed PostgreSQL reel est implemente ou modifie
- frontend `pnpm test:ci` si le frontend ou le proxy Vite est modifie
- frontend `pnpm lint` si le frontend ou le proxy Vite est modifie
- frontend `pnpm build` si le frontend ou le proxy Vite est modifie
- `git diff --check`

Smoke manuel documente attendu :

- `GET /actuator/health` retourne `200`
- `GET /api/me` sans JWT retourne `401`
- `GET /api/me` avec JWT local valide retourne `200`
- le payload `GET /api/me` expose un `activeTenant` exploitable
- `/` affiche les dossiers backend reels
- le dossier demo seed est visible
- les donnees balance, mapping et read-models disponibles sont visibles via le frontend principal
- un mauvais tenant est rejete sans fuite de donnees
- aucun appel IA runtime n'est declenche
- aucun mock frontend ne sert le parcours principal

## Checks historiques de la mission DOCS_ONLY

Checks attendus pour cette creation documentaire :

- `git status --short --branch --untracked-files=all`
- `git diff --name-status`
- `git diff --stat`
- `git diff --check`
- verification que seuls `specs/active/036-local-integrated-demo-real-backend-seed-v1.md` et `docs/product/v1-plan.md` sont modifies

Aucun test runtime backend, frontend ou DB ne doit etre lance pour cette mission documentaire.

## Checks de la mission 036c

Checks attendus pour le proxy Vite local :

- `pnpm test:ci`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- `git status --short --branch --untracked-files=all`

Les tests 036c doivent couvrir :

- proxy `/api` present en dev ;
- target par defaut locale ;
- header `Authorization` absent si auth demo desactivee ;
- header `Authorization` ajoute uniquement si auth demo activee, token shell present et target locale ;
- refus de l'auth demo si target non locale ;
- absence de variable token dans le code client ;
- absence de `import.meta.env` lie au token ;
- absence de variable `VITE_*` pour le token ;
- absence de `localStorage` ou `sessionStorage` pour le token ;
- absence de log token ou headers complets.

## Gates

- Les gates applicables aux sous-livrables 036a, 036b et 036c sont traites dans les livrables merges.
- Aucun gate restant n'est ouvert par cette cloture documentaire.
- Toute capacite future non couverte par 036a, 036b ou 036c exigerait une nouvelle spec explicite et ses gates propres.
- CO Review non requise pour cette cloture documentaire.
- Expert Board non requis pour cette cloture documentaire.

## Hors-scope strict de 036

- Coder les sous-livrables hors 036a, 036b ou 036c dans cette mission.
- Modifier backend runtime dans cette mission.
- Introduire une auth frontend durable dans cette mission.
- Modifier contrat OpenAPI dans cette mission.
- Modifier DB ou migrations dans cette mission.
- Activer IA.
- Ajouter GraphQL.
- Imposer Docker.
- Creer, lire ou modifier un fichier secret ou `.env`.
- Commiter un token ou une valeur sensible.
- Utiliser une variable `VITE_*`, `import.meta.env`, le bundle frontend ou le stockage navigateur pour porter le bearer demo.
- Utiliser des donnees client reelles.
- Faire d'un mock frontend la solution principale.
- Bypasser auth, tenant, membership, audit ou validations metier.
- Creer un livrable CO, statutory, officiel, certifie ou pret au depot.

## Criteres d'acceptation de 036

- Le mode demo local est desactive par defaut.
- Le mode demo local fail-fast hors `local` ou `test`.
- Le seed est idempotent.
- Le seed ne contient que des donnees synthetiques.
- Le backend reel sert `GET /api/me`.
- Le frontend principal consomme le backend reel via proxy local explicite ou origine equivalente documentee.
- Le JWT local utilise la vraie chaine d'auth du backend.
- Pour 036c, le bearer demo reste seulement dans l'environnement shell Node/Vite et l'injection proxy est refusee hors target locale.
- L'utilisateur demo dispose d'une membership active tenant-scopee.
- Le dossier demo est visible via les vrais endpoints REST.
- Les donnees balance et mapping visibles viennent de PostgreSQL.
- Les surfaces conditionnelles ne sont seedees que si elles respectent les invariants storage, audit et read-model du repo.
- Un mauvais tenant est rejete.
- Aucun contrat OpenAPI n'est modifie.
- Aucun provider IA, modele, prompt runtime, RAG ou GraphQL n'est active.
- Le runbook local documente le flux sans valeur sensible commitee.

## Revue humaine recommandee

Revue humaine non obligatoire pour cette cloture DOCS_ONLY.

Revue humaine recommandee seulement si le reviewer veut revalider les preuves historiques des sous-livrables merges 036a, 036b ou 036c, car ces livrables touchaient authentification locale, separation tenant, configuration locale et comportement DB seed.

CO Review non requise pour cette cloture documentaire.

Expert Board non requis pour cette cloture documentaire.
