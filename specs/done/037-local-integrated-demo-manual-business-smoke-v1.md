# 037 - Local integrated demo manual business smoke V1

## Status

Done.

## Surface

DOCS_GIT / QA_MANUAL.

Cette spec ne livre aucun code backend, aucun code frontend, aucun endpoint, aucun contrat OpenAPI, aucune migration DB, aucun token, aucun secret, aucune valeur `.env`, aucune donnee demo supplementaire, aucune IA runtime et aucun GraphQL.

## Risk

B.

Le risque vient du fait que le smoke manuel observe une chaine locale impliquant backend reel, JWT local, tenant membership, proxy Vite dev-only et verification d'absence d'exposition du bearer. La spec ne cree, ne lit, ne modifie et n'affiche aucun secret. Les secrets, tokens, valeurs locales et fichiers `.env` restent sous la responsabilite exclusive de l'utilisateur local et ne doivent jamais etre commites, colles dans le navigateur, stockes dans le bundle ou exposes dans les logs.

## Objectif

Formaliser le smoke manuel fullstack local apres la cloture de `036-local-integrated-demo-real-backend-seed-v1`.

037 documente les preuves utilisateur de la demo locale integree livree par 036 :

- seed PostgreSQL local dev-only 036a ;
- smoke backend `/api/me` avec vrai JWT en `dbIntegrationTest` 036b ;
- proxy Vite dev-only `/api` avec bearer injecte cote serveur Vite 036c ;
- verification manuelle locale sans secret dans le repo.

## Sources relues pour cette cloture

- `docs/product/v1-plan.md`
- `specs/active/037-local-integrated-demo-manual-business-smoke-v1.md`

## Resultat observe fourni par l'utilisateur

Smoke local utilisateur observe :

- backend health direct : `200` ;
- backend `/api/me` direct sans JWT : `401` ;
- frontend proxy `/api/me` avec JWT local : `200` ;
- `activeTenant` observe : `ritomer-demo-036a` / `Ritomer Demo Fiduciaire SA` (synthetic) ;
- `effectiveRoles` deja observe via `/api/me` : `ACCOUNTANT` ;
- dossier demo visible : oui ;
- nom du dossier demo affiche : `Demo Closing FY2025` (synthetic) ;
- ouverture du dossier demo : oui ;
- surfaces visibles : dossier courant, progression dossier, import balance, historique import, mapping manuel, controls/readiness, financial previews, workpapers/evidence/review status partiels ;
- mauvais tenant teste : oui ;
- resultat mauvais tenant : `403` ;
- `Authorization` visible dans les Request Headers navigateur : non ;
- token visible dans le navigateur, l'URL, le storage ou le repo : non observe ;
- mock frontend comme source principale : non observe ;
- UX observee : fonctionnelle mais tres lineaire, trop longue, trop technique, hierarchie produit faible, pas encore POC/premium ;
- verdict 037 : PASS technique, avec dette UX forte a traiter dans une spec ulterieure dediee.

Aucun token, secret, credential, valeur `.env`, bearer local ou valeur sensible n'est capture dans cette spec.

## Protocole smoke sans secret

Le protocole de cloture 037 est manuel, local et sans valeur sensible dans le repo.

Checks observes :

- backend health : `GET /actuator/health` retourne `200` ;
- auth directe sans bearer : `GET /api/me` vers le backend retourne `401` ;
- auth via proxy Vite : `GET /api/me` via Vite proxy avec JWT local retourne `200` ;
- tenant actif : `activeTenant` correspond au tenant demo attendu `ritomer-demo-036a` ;
- roles effectifs : `effectiveRoles` contient `ACCOUNTANT` ;
- dossier demo : visible dans l'interface ;
- ouverture du dossier demo : reussie ;
- surfaces principales : visibles sur read-models backend reels observes ;
- mauvais tenant : rejete avec `403` ;
- hygiene bearer : aucun token observe dans le navigateur, l'URL, le storage ou le repo ; header `Authorization` non visible dans les Request Headers navigateur.

Les checks qui dependent d'un JWT local ou d'une configuration locale sensible sont documentes par leur statut uniquement. Leur valeur ne doit pas etre copiee dans Git, dans la spec, dans le Fresh Evidence Pack, dans un screenshot public ou dans un log partage.

## Limites UX observees

L'interface est fonctionnelle pour prouver le flux local integre, mais elle n'est pas encore au niveau POC UX ou premium attendu pour une demo pilote convaincante.

Les limites observees sont :

- parcours tres lineaire ;
- parcours trop long ;
- langage et exposition encore trop techniques ;
- hierarchie produit faible ;
- lisibilite demo insuffisante pour une experience premium.

037 ne transforme pas l'interface. Elle documente seulement l'etat manuel observe apres 036. Une amelioration UX devra etre traitee dans une spec ulterieure dediee, non creee par cette cloture.

## Hors-scope strict

- code backend ;
- code frontend ;
- endpoint de mint token ;
- auth durable navigateur ou OIDC ;
- migration DB ;
- contrat OpenAPI ;
- IA runtime ;
- GraphQL ;
- RAG/vector store ;
- provider IA ;
- stockage navigateur de token ;
- lecture ou modification de `.env` ;
- secret, token, credential ou valeur locale commite, affiche ou documente ;
- nouvelle donnee demo ;
- nouvelle spec ;
- lancement de backend, frontend, DB ou tests runtime par Codex pendant la cloture documentaire.

## Critere d'acceptation documentaire

- La spec 037 est deplacee dans `specs/done/`.
- Le statut de 037 est `Done`.
- `docs/product/v1-plan.md` reference 037 comme spec livree.
- `docs/product/v1-plan.md` indique qu'aucune spec n'est active.
- Le resultat observe fourni par l'utilisateur est documente sans secret.
- Les limites UX observees sont documentees.
- Aucune spec 038 n'est creee ou ouverte.
- Aucun fichier runtime, backend, frontend, contrat, migration, CI, IA, GraphQL, RAG, provider, secret, token, `.env` ou runbook n'est modifie par cette cloture documentaire.

## Checks attendus pour cette mission DOCS_ONLY

Commandes autorisees et attendues :

- `git status --short --branch --untracked-files=all`
- `git diff --name-status`
- `git diff --stat`
- `git diff --check`
- `git diff --cached --name-status`

Aucun test backend, frontend, DB, navigateur ou runtime ne doit etre lance pour cette mission documentaire.

## Conclusion

037 est clos en PASS technique sur la base du smoke manuel local observe par l'utilisateur.

La demo locale integree prouve que le backend reel, le proxy Vite dev-only, l'auth JWT locale, le tenant demo synthetique, les roles effectifs, le dossier demo et les surfaces principales chargees depuis le backend peuvent etre observes sans exposition de token cote navigateur ou repo.

La dette principale restante est UX : l'experience est fonctionnelle mais trop lineaire, trop longue, trop technique et pas encore au niveau POC/premium attendu.

## Revue humaine recommandee

Revue humaine recommandee : oui, legere.

Motif : la cloture 037 porte sur une validation manuelle locale touchant auth JWT, proxy Vite dev-only, tenant actif, roles effectifs, separation tenant testee par mauvais tenant, et absence d'exposition de bearer. La revue doit verifier les statuts observes sans demander ni exposer de secret.
