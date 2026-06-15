# 040 - Internal POC global smoke V1

## Status

Done.

## Surface

QA_MANUAL / DOCS_GIT.

Cette cloture documente le smoke manuel POC interne global de Ritomer apres `036` a `039`.

Elle ne livre aucun code runtime, aucun backend, aucun frontend runtime, aucune DB ou migration, aucun OpenAPI, aucune CI, aucun test runtime lance par Codex, aucun secret, aucun fichier `.env`, aucun token, aucun credential, aucune nouvelle donnee demo, aucune IA runtime, aucun GraphQL et aucune spec `042`.

## Verdict

PARTIEL.

Le socle technique observe tient suffisamment pour ouvrir le dossier demo et parcourir les surfaces principales, mais l'experience n'est pas encore assez comprehensible, premium et robuste pour un POC interne fluide sans accompagnement.

## Risk

B.

Le risque reste documentaire et manuel. Le smoke observe une chaine sensible deja livree : backend local, frontend local, proxy JWT dev-only, `/api/me`, tenant demo, dossier demo, surfaces evidence/review/export et wording non statutaire. Aucun changement runtime n'est introduit par cette cloture.

## Sources relues

- `docs/product/v1-plan.md`
- `specs/active/040-internal-poc-global-smoke-v1.md`
- `specs/done/039-local-demo-data-heavy-ux-polish-v1.md`
- `docs/ui/ui-foundations-v1.md`
- `docs/present/ux-cadrage-v1.md`

Contrats impactes par cette cloture documentaire : AUCUN.

Runbooks impactes par cette cloture documentaire : AUCUN.

## Resume du smoke execute

Le smoke 040 a ete execute comme parcours produit manuel POC interne global.

Resultats observes :

- dossier demo ouvert : OUI ;
- frontend `/api/me` via proxy : `200` ;
- backend `/api/me` direct sans JWT : `401` ;
- backend health direct : autre / non prouve dans ce bloc ;
- token visible : non observe ;
- secret visible : non observe ;
- header `Authorization` : non verifie explicitement ;
- IA runtime : non verifiee explicitement.

Le verdict utilisateur est `PARTIEL`.

## Points forts observes

- Le dossier demo s'ouvre et donne acces au parcours principal.
- Le proxy frontend vers `/api/me` retourne `200` dans le scenario observe.
- Le backend direct refuse `/api/me` sans JWT avec `401`.
- Le cockpit expose tenant, dossier, prochaine action, blockers et progression.
- L'import est lisible, l'historique est comprehensible et aucun scroll horizontal n'a ete observe.
- Le mapping contient les actions et les codes sans chevauchement observe.
- Les suggestions no-provider restent sans jargon provider/no-provider, gardent le mapping manuel comme reference et montrent la revue humaine.
- Les surfaces Preuves / Justifications exposent prochaine action, statuts et raisons d'actions desactivees.
- Les previsualisations rendent la synthese et les montants CHF lisibles, avec posture non statutaire et revue humaine visibles.
- L'export est compris comme pack de revue, sans impression d'export officiel.
- L'annexe minimale est comprise comme lecture seule, avec indisponibilite expliquee et sans impression d'annexe legale finale.
- Aucun token ni secret n'a ete observe dans les preuves partagees.

## Blockers et frictions observes

Blockers POC :

- le parcours global n'est pas comprehensible en 10 minutes sans explication ;
- le produit ne parait pas encore assez robuste pour un POC interne fluide ;
- l'experience est claire pour une demo interne accompagnee, mais pas assez premium pour un POC ;
- plusieurs surfaces restent trop techniques ;
- une friction majeure a ete observee sur la comprehension globale.

Blockers UX a traiter :

- le statut du cockpit n'est pas assez comprehensible ;
- le mapping reste globalement trop dense et sa lisibilite globale est insuffisante ;
- les rubriques Preuves / Justifications a documenter ne sont pas assez lisibles et restent trop anglo-techniques ;
- les montants Import restent trop bruts malgre une surface lisible ;
- des libelles techniques residuels doivent etre nettoyes.

Blockers de verification :

- l'absence de header `Authorization` dans les Request Headers navigateur n'a pas ete verifiee explicitement dans ce bloc ;
- l'absence d'IA runtime n'a pas ete verifiee explicitement dans ce bloc ;
- le health backend direct n'a pas ete prouve dans ce bloc.

## Preuves sans secret

Preuves documentees :

- verdict utilisateur : `PARTIEL` ;
- dossier demo ouvert : OUI ;
- frontend `/api/me` via proxy : `200` ;
- backend `/api/me` direct sans JWT : `401` ;
- backend health direct : autre / non prouve dans ce bloc ;
- token observe : NON ;
- secret observe : NON ;
- header `Authorization` verifie : NON ;
- IA runtime verifiee : NON.

Valeurs sensibles documentees : AUCUNE.

Le smoke ne copie aucun bearer, JWT, cookie, credential, DSN, secret, valeur `.env` ou header `Authorization`.

## Checklist 040

- Backend local lance : NON DETERMINE.
- Frontend local lance : PASS.
- Proxy `/api` local actif : PASS.
- `/api/me` sans auth refuse : PASS.
- `/api/me` via proxy avec JWT local accepte : PASS.
- `activeTenant` exploitable : PARTIEL, tenant visible dans le cockpit.
- Aucun bearer ou token visible dans navigateur, URL, storage, bundle, UI, logs partages ou repo : PARTIEL, token non observe mais headers non verifies explicitement.
- Dossier demo visible : PASS.
- Dossier demo ouvrable : PASS.
- Mauvais tenant rejete si reteste : N/A.
- Cockpit comprehensible : PARTIEL.
- Import comprehensible : PASS.
- Historique/diff import comprehensible si disponible : PASS.
- Mapping manuel comprehensible : PARTIEL.
- Suggestions no-provider comprehensibles et human-in-the-loop : PASS.
- Controls/readiness comprehensibles : PARTIEL.
- Justifications/workpapers comprehensibles : PARTIEL.
- Preuves/documents/verifications comprehensibles : PARTIEL.
- Previsualisations lisibles et non statutaires : PASS.
- Export pack lisible comme handoff de revue : PASS.
- Minimal annex preview lisible et non statutaire : PASS.
- Aucune promesse statutaire ou CO finale observee : PASS.
- Surfaces trop techniques identifiees : PASS.
- Temps de comprehension global mesure : PARTIEL, non conforme a l'objectif 10 minutes.
- Dette candidate suivante formulee : PASS, `041` ouverte pour blockers POC.

## Decisions post-040

- `040` est cloturee en `PARTIEL`.
- `041-internal-poc-blockers-ux-readiness-v1` est ouverte pour traiter les blockers observes.
- La suite doit rester bornee aux corrections frontend/UX et aux verifications manuelles explicites documentees dans `041`.
- Aucun backend, DB/migration, OpenAPI, auth/JWT/proxy, nouvelle mutation, nouveau endpoint, IA runtime, GraphQL, export officiel, annexe legale finale, promesse CO/statutaire, secret, `.env`, token, credential ou spec `042` n'est autorise par cette cloture.

## Hors-scope strict de cette cloture

- Backend.
- Frontend runtime.
- DB.
- Migration.
- OpenAPI.
- Auth, JWT ou proxy.
- IA runtime.
- Provider IA.
- Modele IA.
- SDK IA.
- Prompt runtime.
- RAG ou vector store.
- GraphQL.
- CI.
- Nouveau seed.
- Nouvelle donnee demo.
- Nouvel endpoint.
- Nouvelle mutation.
- Export officiel.
- Annexe legale finale.
- Promesse CO ou statutaire.
- POC public.
- Pilote client.
- Test runtime lance par Codex dans cette mission documentaire.
- Lecture, creation ou modification de secret, `.env`, token, credential ou valeur sensible.
- Creation de spec `042`.

## Checks attendus pour cette cloture DOCS_ONLY

Commandes autorisees et attendues :

- `git status --short --branch --untracked-files=all`
- `git diff --name-status`
- `git diff --stat`
- `git diff --check`
- `git diff --cached --name-status`

Aucun test backend, frontend, DB, navigateur ou runtime ne doit etre lance pour cette cloture documentaire.

## Revue humaine recommandee

Revue humaine recommandee : oui.

Motif : le verdict `PARTIEL` touche la comprehension produit, la qualite UX POC, les preuves sans secret, les garde-fous non statutaires et des verifications de securite/hygiene non completement prouvees dans ce bloc.
