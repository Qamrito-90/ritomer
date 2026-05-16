# 036 - Local integrated demo real backend seed V1

## Status

Active.

Implementation blocked by CTO Gate, sauf sous-livrables 036a et 036b explicitement autorises apres validation CPO/CTO.

## Surface

Future implementation: FULLSTACK_SPEC / DB_SPEC / FRONTEND_SPEC.

Sous-livrable 036a implemente : BACKEND / DB optional test.

Sous-livrable 036b implemente : BACKEND_TEST / DB_INTEGRATION / AUTH/JWT / TENANT_MEMBERSHIP.

Initial spec creation mission: DOCS_ONLY.

Current 036a mission: BACKEND implementation only.

036a livre uniquement une commande backend dev-only de seed demo synthetique, sans frontend, sans JWT local, sans proxy Vite, sans endpoint HTTP, sans OpenAPI et sans migration DB.

Current 036b mission: smoke backend/auth/dbIntegrationTest only.

036b livre uniquement un test `dbIntegrationTest` backend prouvant que le seed 036a, PostgreSQL reel et la vraie validation JWT permettent a `GET /api/me` de resoudre `activeTenant` depuis la base, sans frontend, sans JWT command, sans proxy Vite, sans endpoint HTTP, sans OpenAPI et sans migration DB.

## Risk

C.

The remaining future implementation touches local authentication documentation, frontend/backend local wiring and broader local demo execution. The 036a mission implements only the backend PostgreSQL demo seed command. The 036b mission implements only a narrow backend DB integration smoke around real JWT validation, `/api/me`, tenant membership and bad-tenant rejection through an existing endpoint.

## Role de cette spec

Cadrer une demo locale integree realiste de Ritomer avec backend reel, PostgreSQL reel, auth JWT reelle, tenant reel, membership reelle et donnees demo synthetiques persistees.

Le but produit est de permettre de visualiser et tester le produit localement sans mock frontend principal, avec les vrais endpoints REST, les vraies validations backend, la vraie base PostgreSQL et un dataset demo persistant.

Le cadrage initial ne creait aucun seed, ne modifiait aucun runtime, ne modifiait aucun contrat et ne definissait aucune valeur de configuration sensible. Depuis la decision CPO/CTO, 036a et 036b sont autorises en implementation backend bornee.

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
- n'ajoute aucun endpoint HTTP, bypass Spring Security, JWT command, frontend, proxy Vite, OpenAPI, migration DB, GraphQL ou IA runtime.

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
- `specs/active/036-local-integrated-demo-real-backend-seed-v1.md` absent avant creation
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
5. Un JWT local signe est obtenu de maniere documentee, sans valeur commitee et sans endpoint public de contournement.
6. Le frontend est lance avec un proxy local `/api/*` vers le backend.
7. Le navigateur appelle `GET /api/me` avec le JWT local.
8. Le backend resout l'utilisateur demo et son membership actif.
9. Le frontend recoit un `activeTenant` exploitable.
10. Le frontend appelle les endpoints dossier avec le `X-Tenant-Id` du tenant actif.
11. Le dossier seed est visible avec des donnees reelles servies par le backend.
12. Une tentative avec un mauvais tenant est rejetee et ne retourne aucune donnee metier d'un autre tenant.

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

Si ces conditions ne sont pas remplies, la future implementation doit limiter le seed au noyau obligatoire et documenter les surfaces non seedables comme non applicables dans le smoke local.

## Garde-fous anti-prod

La future implementation doit respecter tous les garde-fous suivants :

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

La future implementation doit documenter comment obtenir un JWT local signe sans commiter de secret, de token ou de valeur sensible. Le JWT local doit porter un sujet compatible avec l'utilisateur demo seed ou avec le mecanisme de synchronisation utilisateur existant.

Interdits :

- desactiver Spring Security ;
- accepter un header utilisateur arbitraire comme auth ;
- forcer `activeTenant` cote frontend ;
- injecter un utilisateur mock dans le frontend principal ;
- commiter un token, une cle ou une valeur de signature ;
- ajouter un endpoint public de generation de token.

## Flux local attendu

Le runbook futur devra decrire un flux sans valeur sensible commitee :

1. Demarrer une instance PostgreSQL explicite, locale ou distante.
2. Fournir localement la configuration necessaire au backend.
3. Lancer le backend en profil local.
4. Activer explicitement le seed demo dev-only.
5. Generer ou obtenir un JWT local signe selon la procedure documentee.
6. Lancer le frontend.
7. Ouvrir `/` puis le dossier demo visible.
8. Verifier que le frontend charge `GET /api/me` puis les endpoints dossier via backend reel.
9. Verifier visuellement les donnees demo persistantes.
10. Verifier qu'un mauvais tenant est rejete.

Le flux ne doit pas imposer Docker, Docker Compose ou Testcontainers.

## Fichiers probablement concernes par la future implementation

- configuration backend locale ;
- code backend de seed dev-only ;
- tests backend du seed, de l'auth locale et du rejet mauvais tenant ;
- `frontend/vite.config.ts` pour le proxy local si necessaire ;
- `runbooks/local-dev.md` ;
- eventuellement `README.md`.

Cette liste ne cree aucune autorisation de modification runtime dans la presente mission `DOCS_ONLY`.

## Contrats et API

La future implementation ne doit pas modifier le contrat OpenAPI pour livrer cette demo.

Elle doit utiliser les endpoints REST existants. Toute nouvelle surface publique exigerait une nouvelle spec ou un amendement explicite, et n'est pas autorisee par 036.

Les contrats DB ne doivent etre modifies que si la future implementation prouve un besoin durable de schema. Un seed dev-only doit prioritairement s'appuyer sur le schema existant et les couches metier existantes.

## Checks attendus pour la future implementation

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

## Checks de cette mission DOCS_ONLY

Checks attendus pour cette creation documentaire :

- `git status --short --branch --untracked-files=all`
- `git diff --name-status`
- `git diff --stat`
- `git diff --check`
- verification que seuls `specs/active/036-local-integrated-demo-real-backend-seed-v1.md` et `docs/product/v1-plan.md` sont modifies

Aucun test runtime backend, frontend ou DB ne doit etre lance pour cette mission documentaire.

## Gates

- CTO Gate obligatoire avant toute implementation restante hors 036a et 036b.
- CO Review non requise sauf ajout futur de wording CO/statutory nouveau.
- Expert Board non requis a ce stade.
- Security/privacy review recommandee avant implementation effective restante, car la future surface touche auth locale, tenant membership, donnees demo persistantes et garde-fous anti-prod.

## Hors-scope strict de 036

- Coder les sous-livrables hors 036a ou 036b dans cette mission.
- Modifier backend runtime dans cette mission.
- Modifier frontend runtime dans cette mission.
- Modifier contrat OpenAPI dans cette mission.
- Modifier DB ou migrations dans cette mission.
- Activer IA.
- Ajouter GraphQL.
- Imposer Docker.
- Creer ou lire un fichier secret.
- Commiter un token ou une valeur sensible.
- Utiliser des donnees client reelles.
- Faire d'un mock frontend la solution principale.
- Bypasser auth, tenant, membership, audit ou validations metier.
- Creer un livrable CO, statutory, officiel, certifie ou pret au depot.

## Criteres d'acceptation de la future implementation

- Le mode demo local est desactive par defaut.
- Le mode demo local fail-fast hors `local` ou `test`.
- Le seed est idempotent.
- Le seed ne contient que des donnees synthetiques.
- Le backend reel sert `GET /api/me`.
- Le frontend principal consomme le backend reel via proxy local explicite ou origine equivalente documentee.
- Le JWT local utilise la vraie chaine d'auth du backend.
- L'utilisateur demo dispose d'une membership active tenant-scopee.
- Le dossier demo est visible via les vrais endpoints REST.
- Les donnees balance et mapping visibles viennent de PostgreSQL.
- Les surfaces conditionnelles ne sont seedees que si elles respectent les invariants storage, audit et read-model du repo.
- Un mauvais tenant est rejete.
- Aucun contrat OpenAPI n'est modifie.
- Aucun provider IA, modele, prompt runtime, RAG ou GraphQL n'est active.
- Le runbook local documente le flux sans valeur sensible commitee.

## Revue humaine recommandee

Revue CTO obligatoire avant toute implementation restante hors 036a et 036b.

Revue humaine specialisee recommandee lors de l'implementation future restante car le changement touchera probablement authentification locale, autorisation, separation tenant, audit, donnees sensibles potentielles, configuration locale et comportement DB seed.

CO Review non requise a ce stade documentaire, sauf si une implementation future introduit un wording CO/statutory nouveau.

Expert Board non requis a ce stade.
