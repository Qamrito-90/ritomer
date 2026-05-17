# 037 - Local integrated demo manual business smoke V1

## Status

Active.

## Surface

DOCS_GIT / QA_MANUAL.

Cette spec ne livre aucun code backend, aucun code frontend, aucun endpoint, aucun contrat OpenAPI, aucune migration DB, aucun token, aucun secret, aucune valeur `.env`, aucune donnee demo supplementaire, aucune IA runtime et aucun GraphQL.

## Risk

B.

Le risque vient du fait que le smoke manuel observe une chaine locale impliquant backend reel, JWT local, tenant membership, proxy Vite dev-only et verification d'absence d'exposition du bearer. La spec ne cree, ne lit, ne modifie et n'affiche aucun secret. Les secrets, tokens, valeurs locales et fichiers `.env` restent sous la responsabilite exclusive de l'utilisateur local et ne doivent jamais etre commites, colles dans le navigateur, stockes dans le bundle ou exposes dans les logs.

## Objectif

Formaliser le smoke manuel fullstack local apres la cloture de `036-local-integrated-demo-real-backend-seed-v1`.

037 sert a documenter les preuves utilisateur de la demo locale integree livree par 036 :

- seed PostgreSQL local dev-only 036a ;
- smoke backend `/api/me` avec vrai JWT en `dbIntegrationTest` 036b ;
- proxy Vite dev-only `/api` avec bearer injecte cote serveur Vite 036c ;
- verification manuelle locale sans secret dans le repo.

## Sources relues pour cette mission

- `docs/product/v1-plan.md`
- `specs/done/036-local-integrated-demo-real-backend-seed-v1.md`
- `runbooks/local-dev.md`

## Resultat observe fourni par l'utilisateur

Smoke local utilisateur deja observe :

- `GET http://localhost:8080/actuator/health` retourne `200` ;
- `GET http://localhost:8080/api/me` sans JWT retourne `401` ;
- `GET http://localhost:5173/api/me` via proxy Vite avec JWT local retourne `200` ;
- `activeTenant` vaut `ritomer-demo-036a` ;
- `effectiveRoles` contient `ACCOUNTANT` ;
- l'interface est visuellement un debut fonctionnel ;
- l'interface n'est pas encore au niveau POC UX ou premium attendu.

Aucun token, secret, credential, valeur `.env`, bearer local ou valeur sensible n'est capture dans cette spec.

## Protocole smoke sans secret

Le protocole de cloture 037 doit rester manuel, local et sans valeur sensible dans le repo.

Checks obligatoires si l'environnement local est disponible :

- backend health : `GET /actuator/health` retourne `200` ;
- auth directe sans bearer : `GET /api/me` vers le backend retourne `401` ;
- auth via proxy Vite : `GET /api/me` via Vite proxy avec JWT local retourne `200` ;
- tenant actif : `activeTenant` correspond au tenant demo attendu, par exemple `ritomer-demo-036a` ;
- roles effectifs : `effectiveRoles` contient `ACCOUNTANT` ;
- dossier demo : visible dans l'interface si le seed et les appels dossier sont observes ;
- surfaces principales : visibles si le parcours UI charge les read-models backend reels ;
- mauvais tenant : rejete si le test manuel est execute ;
- hygiene bearer : aucun token dans le navigateur, le bundle, `localStorage`, `sessionStorage` ou les logs si la verification est executee.

Les checks qui dependent d'un JWT local ou d'une configuration locale sensible doivent etre decrits par leur statut seulement. Leur valeur ne doit pas etre copiee dans Git, dans la spec, dans le Fresh Evidence Pack, dans un screenshot public ou dans un log partage.

## Limites UX observees

L'interface est fonctionnelle pour commencer a prouver le flux local integre, mais elle n'est pas encore au niveau POC UX ou premium attendu pour une demo pilote convaincante.

037 ne transforme pas l'interface. Elle documente seulement l'etat manuel observe apres 036 et prepare la specification UX suivante.

## Hors-scope strict

- code backend ;
- code frontend ;
- endpoint de mint token ;
- auth durable navigateur ou OIDC ;
- migration DB ;
- contrat OpenAPI ;
- IA runtime ;
- GraphQL ;
- stockage navigateur de token ;
- lecture ou modification de `.env` ;
- secret, token, credential ou valeur locale commite, affiche ou documente ;
- nouvelle donnee demo ;
- lancement de backend, frontend, DB ou tests runtime par Codex pendant la creation de cette spec.

## Critere d'acceptation documentaire

- La spec 037 existe dans `specs/active/`.
- `docs/product/v1-plan.md` reference 037 comme spec active.
- Le resultat observe fourni par l'utilisateur est documente sans secret.
- Les limites UX observees sont documentees.
- La conclusion prepare explicitement 038 sans livrer d'amelioration UX dans 037.
- Aucun fichier runtime, backend, frontend, contrat, migration ou runbook n'est modifie par cette creation documentaire.

## Checks attendus pour cette mission DOCS_ONLY

Commandes autorisees et attendues :

- `git status --short --branch --untracked-files=all`
- `git diff --name-status`
- `git diff --stat`
- `git diff --check`

Aucun test backend, frontend, DB, navigateur ou runtime ne doit etre lance pour cette mission documentaire.

## Conclusion

037 ne livre aucune amelioration UX et ne modifie aucune capacite runtime.

Elle formalise le smoke manuel fullstack local apres 036, conserve la responsabilite des secrets cote utilisateur local, et prepare la prochaine spec recommandee : `038-pilot-demo-workbench-shell-ux-v1`.

## Revue humaine recommandee

Revue humaine recommandee : oui, legere.

Motif : la cloture 037 portera sur une validation manuelle locale touchant auth JWT, proxy Vite dev-only, tenant actif, roles effectifs, separation tenant si testee, et absence d'exposition de bearer. La revue doit verifier les statuts observes sans demander ni exposer de secret.
