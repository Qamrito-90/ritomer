# 040 - Internal POC global smoke V1

## Status

Active.

## Surface

QA_MANUAL / DOCS_GIT.

Cette spec cadre uniquement un smoke manuel POC interne global de Ritomer.

Elle ne livre aucun code runtime, aucun backend, aucun frontend runtime, aucune DB ou migration, aucun OpenAPI, aucune CI, aucun test runtime, aucun secret, aucun fichier `.env`, aucun token, aucun credential, aucune nouvelle donnee demo, aucune IA runtime, aucun GraphQL et aucune spec `041`.

## Risk

B.

Le risque est documentaire et manuel, mais le smoke observe une chaine sensible deja livree : backend local, frontend local, proxy JWT dev-only, `/api/me`, tenant demo, dossier demo, surfaces evidence/review/export et wording non statutaire. Le protocole doit donc verifier explicitement l'absence d'exposition de bearer, token, valeur `.env` ou credential, ainsi que l'absence de promesse statutaire. Aucun changement runtime n'est autorise dans 040.

## Role de cette spec

Cadrer un smoke manuel POC interne global, sans code, pour juger si le parcours local Ritomer issu de `036` a `039` est comprehensible, robuste, credible et assez clair pour une demonstration interne.

Le smoke ne cherche pas a prouver une nouvelle capacite technique. Il doit verifier que les capacites deja livrees tiennent ensemble dans un parcours complet :

- lancement backend et frontend local ;
- proxy JWT local dev-only ;
- `/api/me` ;
- dossier demo ;
- cockpit ;
- import ;
- mapping ;
- suggestions no-provider ;
- justifications et preuves ;
- previsualisations ;
- export et pack de revue ;
- annexe minimale ;
- absence de promesse statutaire ;
- absence de secret ou token visible ;
- ressenti UX global.

## Contexte 036-039

`036-local-integrated-demo-real-backend-seed-v1` a livre la demo locale integree technique : seed PostgreSQL local dev-only, auth JWT reelle, tenant demo synthetique, membership reelle, dossier demo persiste, `/api/me` prouve en `dbIntegrationTest` et proxy Vite dev-only avec bearer conserve cote serveur Vite.

`037-local-integrated-demo-manual-business-smoke-v1` a clos un smoke manuel local en PASS technique : backend health `200`, `/api/me` backend sans JWT `401`, `/api/me` via proxy Vite avec JWT local `200`, tenant demo `ritomer-demo-036a` visible, role `ACCOUNTANT`, dossier `Demo Closing FY2025` visible et ouvrable, mauvais tenant rejete `403`, bearer non observe dans navigateur, URL, storage ou repo. Dette observee : UX fonctionnelle mais trop lineaire, trop longue, trop technique et pas encore POC/premium.

`038-local-demo-closing-workbench-ux-cockpit-v1` a transforme le dossier demo local en cockpit intermediaire : workbench/panneaux, synthese haut de page, chemin de closing, tenant, dossier, statut, prochaine action, blockers et progression visibles. Le verdict CPO a ete `PASS 038` comme cockpit intermediaire, pas encore POC premium final.

`039-local-demo-data-heavy-ux-polish-v1` a ameliore les surfaces data-heavy : import, mapping, suggestions no-provider, justifications/preuves, previsualisations, export et annexe minimale. La dette residuelle apres 039 est de juger l'experience complete en smoke POC interne, de qualifier les surfaces encore trop techniques, et d'identifier ce qui bloque encore le POC premium.

## Sources relues

- `docs/product/v1-plan.md`
- `specs/done/036-local-integrated-demo-real-backend-seed-v1.md`
- `specs/done/037-local-integrated-demo-manual-business-smoke-v1.md`
- `specs/done/038-local-demo-closing-workbench-ux-cockpit-v1.md`
- `specs/done/039-local-demo-data-heavy-ux-polish-v1.md`
- `runbooks/local-dev.md`
- `docs/ui/ui-foundations-v1.md`
- `docs/present/ux-cadrage-v1.md`

Contrats impactes par cette creation documentaire : AUCUN.

Runbooks impactes par cette creation documentaire : AUCUN.

## Questions produit a trancher dans 040

Le smoke manuel doit produire un verdict argumente sur les questions suivantes :

- Est-ce que le parcours est comprehensible en 10 minutes ?
- Est-ce que le produit parait robuste ?
- Est-ce que l'UX est assez claire pour une demo interne ?
- Est-ce que les garde-fous non statutaires sont visibles ?
- Est-ce que certaines surfaces restent trop techniques ?
- Qu'est-ce qui bloque encore le POC premium ?
- Quelle dette devrait etre candidate pour une decision suivante, sans ouvrir automatiquement `041` ?

## Prerequis locaux

Le smoke 040 suppose uniquement les capacites deja documentees dans `runbooks/local-dev.md`.

Prerequis :

- JDK 21 disponible ;
- PostgreSQL local explicite disponible ;
- backend lance en profil `local` ;
- dataset demo 036a deja seede ou re-seede localement selon le runbook ;
- JWT local signe compatible avec l'utilisateur demo 036a, obtenu hors repo et non capture dans les preuves ;
- frontend lance en dev server Vite ;
- proxy Vite `/api` cible vers le backend local ;
- si necessaire, injection bearer activee uniquement via variables shell locales du serveur Vite ;
- navigateur ouvert sur l'application locale ;
- aucun secret, token, bearer, credential, DSN ou valeur `.env` copie dans la spec, un screenshot, un log partage ou le Fresh Evidence Pack.

Les commandes exactes de lancement peuvent etre executees par l'operateur local selon le runbook, mais Codex ne doit lancer aucun backend, frontend, DB, navigateur ou test runtime dans cette mission documentaire.

## Protocole de smoke complet

Le smoke doit etre chronometre et observe comme un parcours produit, pas seulement comme une verification technique.

### Phase 1 - Demarrage local et hygiene auth

Verifier :

- backend local demarre en profil `local` ;
- frontend local demarre via Vite ;
- proxy `/api` route vers le backend local attendu ;
- `/api/me` sans auth proxy retourne `401` ou reste refuse selon le scenario controle ;
- `/api/me` via proxy Vite avec JWT local retourne `200` ;
- le payload `/api/me` expose un `activeTenant` exploitable ;
- le role effectif attendu est visible ou inferable sans afficher de token ;
- aucun header `Authorization` n'est visible dans les Request Headers navigateur ;
- aucun bearer, token, secret, valeur `.env` ou credential n'est visible dans URL, storage navigateur, bundle, UI, logs partages ou repo.

### Phase 2 - Entree dossier demo

Verifier :

- la liste ou l'entree des dossiers charge depuis le backend reel ;
- le dossier `Demo Closing FY2025` ou equivalent demo est visible ;
- le tenant demo synthetique reste identifiable comme contexte courant ;
- l'ouverture du dossier demo fonctionne ;
- aucun mock frontend ne devient source principale du parcours ;
- un mauvais tenant ou un contexte tenant invalide reste rejete sans fuite de donnees, si ce controle est refait pendant le smoke.

### Phase 3 - Cockpit global

Verifier :

- tenant actif et dossier courant visibles ;
- statut global comprehensible ;
- prochaine action visible ;
- 1 a 3 blockers principaux visibles quand applicables ;
- progression du closing visible ;
- chemin `closing -> import -> mapping -> controls -> previews -> workpapers/evidence -> export` comprehensible ;
- l'utilisateur comprend l'etat du dossier en moins de 10 minutes, idealement en moins d'une minute pour le premier niveau ;
- les libelles sont metier, pas principalement techniques.

### Phase 4 - Import

Verifier :

- import courant visible ;
- historique import visible si disponible ;
- diff ou comparaison N/N-1 visible si disponible ;
- montants, dates et periodes lisibles ;
- etats loading, empty, error ou partial comprehensibles si rencontres ;
- aucune nouvelle donnee demo ou mutation non prevue n'est necessaire pour suivre le parcours.

### Phase 5 - Mapping manuel et suggestions no-provider

Verifier :

- comptes source lisibles ;
- cibles de mapping lisibles ;
- mapping manuel reste l'autorite metier ;
- suggestions no-provider visibles comme aides a revoir, pas comme decisions autonomes ;
- `requiresHumanReview` ou posture equivalente visible quand applicable ;
- decisions humaines unitaires `ACCEPT`, `CORRECT`, `REJECT` restent comprehensibles si elles sont observees ;
- aucune auto-application, bulk auto-apply, preselection silencieuse ou decision IA autonome n'est suggeree par l'UX ;
- aucun provider IA, modele reel, SDK, prompt runtime, RAG ou appel reseau IA n'est implique.

### Phase 6 - Controls, justifications et preuves

Verifier :

- readiness ou controls lisibles ;
- blockers controls formules en consequence utilisateur ;
- workpapers visibles par rubrique ou anchor metier ;
- pieces/preuves visibles quand disponibles ;
- verification reviewer document visible quand disponible ;
- decision reviewer workpaper visible comme decision humaine de workflow, pas approbation statutaire ;
- etats stale, historique, courant ou archive distingues si visibles ;
- audit/evidence-first perceptible sans afficher de details techniques inutiles.

### Phase 7 - Previsualisations, export et annexe minimale

Verifier :

- financial summary preview lisible ;
- financial statements structured preview lisible ;
- audit-ready export pack presente comme pack de handoff/revue ;
- telechargement ou creation du pack uniquement si l'action existe deja ;
- minimal annex preview presentee comme preview read-only ;
- wording non statutaire visible sur les surfaces proches d'un livrable ;
- aucune promesse `CO-ready`, `statutory-ready`, `official financial statements`, `annexe officielle`, `annexe CO finale`, `final CO annex`, `final accounts approved`, `automatically approved`, `AI-approved`, `ready to file`, `certified` ou equivalent n'apparait ;
- aucune annexe legale finale ou export officiel n'est promis.

### Phase 8 - Ressenti UX global

Observer et noter :

- temps pour comprendre le parcours ;
- zones ou l'utilisateur hesite ;
- zones encore trop techniques ;
- zones ou la robustesse percue est bonne ou faible ;
- clarte des statuts, erreurs, blockers et prochaines actions ;
- coherence visuelle avec `docs/ui/ui-foundations-v1.md` ;
- lisibilite desktop et, si observe, comportement responsive ;
- presence ou absence d'un sentiment premium sobre et fiduciaire-grade ;
- ce qui manque pour un POC premium interne.

## Checklist parcours

Le rapport de smoke doit cocher chaque point avec `PASS`, `PARTIEL`, `FAIL` ou `N/A`.

- Backend local lance.
- Frontend local lance.
- Proxy `/api` local actif.
- `/api/me` sans auth refuse.
- `/api/me` via proxy avec JWT local accepte.
- `activeTenant` exploitable.
- Aucun bearer ou token visible dans navigateur, URL, storage, bundle, UI, logs partages ou repo.
- Dossier demo visible.
- Dossier demo ouvrable.
- Mauvais tenant rejete si reteste.
- Cockpit comprehensible.
- Import comprehensible.
- Historique/diff import comprehensible si disponible.
- Mapping manuel comprehensible.
- Suggestions no-provider comprehensibles et human-in-the-loop.
- Controls/readiness comprehensibles.
- Justifications/workpapers comprehensibles.
- Preuves/documents/verifications comprehensibles.
- Previsualisations lisibles et non statutaires.
- Export pack lisible comme handoff de revue.
- Minimal annex preview lisible et non statutaire.
- Aucune promesse statutaire ou CO finale observee.
- Surfaces trop techniques identifiees.
- Temps de comprehension global mesure.
- Dette candidate suivante formulee sans creer `041`.

## Criteres PASS / PARTIEL / FAIL

### PASS 040

Un PASS peut etre prononce si :

- le parcours complet est parcouru sans changer de code ni de donnees ;
- backend, frontend, proxy local, `/api/me`, tenant demo et dossier demo fonctionnent dans le scenario observe ;
- aucune fuite de bearer, token, valeur `.env`, credential ou secret n'est observee ;
- le dossier demo est comprehensible en 10 minutes par un evaluateur interne ;
- cockpit, import, mapping, suggestions no-provider, justifications/preuves, previews, export pack et minimal annex sont atteignables et globalement comprehensibles ;
- les surfaces proches d'un livrable restent clairement non statutaires et soumises a revue humaine ;
- les principaux irritants POC premium sont listes et priorises ;
- aucune spec `041` n'est ouverte automatiquement.

### PARTIEL 040

Un PARTIEL doit etre prononce si :

- le parcours technique fonctionne, mais l'UX reste trop obscure, trop longue ou trop technique pour une demo interne fluide ;
- une ou plusieurs surfaces importantes sont atteignables mais demandent une explication orale lourde ;
- la posture non statutaire est presente mais pas assez visible ;
- la robustesse percue est inegale sans fuite de secret ni regression tenant observee ;
- la dette candidate suivante est claire mais necessite un cadrage produit avant ouverture.

### FAIL 040

Un FAIL doit etre prononce si :

- backend, frontend, proxy, `/api/me`, tenant demo ou dossier demo ne permettent pas de parcourir le flux ;
- un bearer, token, secret, credential ou valeur `.env` devient visible dans une preuve partagee, l'UI, l'URL, le storage navigateur, le bundle, les logs partages ou le repo ;
- une promesse statutaire, CO finale, officielle, certifiee ou prete au depot apparait ;
- les suggestions no-provider semblent autonomes ou applicables sans decision humaine ;
- l'utilisateur ne peut pas comprendre le parcours en 10 minutes ;
- une surface majeure bloque le parcours sans explication actionnable ;
- une derive runtime, backend, frontend, DB, OpenAPI, CI, auth, IA runtime, GraphQL ou spec `041` est introduite.

## Observations UX attendues

Le smoke doit produire des observations courtes, factuelles et actionnables sur :

- comprehension en 10 minutes ;
- robustesse percue ;
- clarte de la demo interne ;
- clarte des garde-fous non statutaires ;
- surfaces encore trop techniques ;
- friction import, mapping, suggestions, preuves, previews, export et annexe ;
- coherence visuelle avec le workbench financier vise ;
- points qui renforcent ou affaiblissent la confiance ;
- dette candidate pour un futur cadrage, sans creation automatique de `041`.

Les observations doivent distinguer :

- bloquant POC ;
- irritant demo ;
- dette premium ;
- simple preference de wording ;
- non applicable.

## Preuves a collecter sans secret

Preuves autorisees :

- statut textuel des checks manuels ;
- captures d'ecran expurgees de tout secret ;
- timestamps approximatifs du parcours ;
- noms de surfaces observees ;
- codes HTTP sans headers sensibles ;
- extrait non sensible de payload `/api/me` limite a la presence d'un `activeTenant` et de roles, sans token ni valeur locale sensible ;
- liste des zones UX PASS/PARTIEL/FAIL ;
- mention que le bearer n'a pas ete observe, sans jamais copier sa valeur ;
- mention que les checks dependants d'un secret local ont ete faits par l'operateur local, sans valeur.

Preuves interdites :

- token, bearer, JWT, cookie ou credential ;
- secret HMAC, DSN, password, valeur `.env` ou contenu de fichier `.env` ;
- header `Authorization` ;
- logs complets contenant headers ou variables d'environnement ;
- screenshot montrant token, cookie, secret, path sensible ou valeur locale ;
- donnees client reelles ;
- export officiel ou annexe legale finale.

## Format du Fresh Evidence Pack manuel 040

Le Fresh Evidence Pack manuel attendu apres execution du smoke doit rester court, factuel et sans secret :

1. Resume du smoke POC interne.
2. Date, operateur et environnement local non sensible.
3. Surface : `QA_MANUAL / DOCS_GIT`.
4. Verdict global : `PASS`, `PARTIEL` ou `FAIL`.
5. Temps observe pour comprendre le parcours.
6. Checklist parcours avec `PASS`, `PARTIEL`, `FAIL` ou `N/A`.
7. Preuves collectees sans secret.
8. Surfaces trop techniques.
9. Garde-fous non statutaires observes.
10. Absence de secret/token visible : statut observe, sans valeur.
11. Tests runtime executes par l'operateur local, si applicable, sans logs sensibles.
12. Tests non executes et justification.
13. Dette candidate suivante, sans ouvrir automatiquement `041`.
14. Risques residuels.
15. Revue humaine recommandee.

Si un element n'est pas applicable, ecrire `AUCUN`. Si une information n'est pas determinee, ecrire `NON DETERMINE`.

## Gates

- Product/CPO Gate : requis pour prononcer le verdict `PASS`, `PARTIEL` ou `FAIL` du smoke 040.
- UX review : recommandee pour juger comprehension en 10 minutes, surfaces trop techniques et niveau premium interne.
- Security/Auth review : recommandee seulement si le smoke detecte une exposition de bearer, token, header sensible, stockage navigateur ou confusion proxy/auth.
- Tenant/Audit review : recommandee seulement si le smoke detecte une fuite cross-tenant, un doute de scoping tenant ou une confusion sur les preuves/audit.
- CO/Statutory wording review : recommandee si un wording ambigu proche d'un livrable officiel, CO, statutaire, certifie ou pret au depot est observe.
- CTO Gate : non requis tant que 040 reste un smoke manuel sans changement runtime, architecture, API, DB, CI, dependance ou production.

Toute derive vers backend, frontend runtime, DB, migration, OpenAPI, auth, IA runtime, GraphQL, CI, nouvelle donnee demo, endpoint, mutation, export officiel, annexe legale finale, production ou spec `041` doit stopper 040 et exiger un recadrage explicite.

## Hors-scope strict

- Backend.
- Frontend runtime.
- DB.
- Migration.
- OpenAPI.
- Auth.
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
- Creation de spec `041`.

## Criteres d'acceptation de cette creation documentaire

- `specs/active/040-internal-poc-global-smoke-v1.md` existe.
- La spec est `Active`.
- La surface est `QA_MANUAL / DOCS_GIT`.
- Le risque est `B` et justifie.
- Le contexte 036-039 est resume.
- Le protocole de smoke couvre le parcours complet demande.
- Les prerequis locaux sont documentes sans valeur sensible.
- La checklist parcours est presente.
- Les criteres `PASS`, `PARTIEL` et `FAIL` sont explicites.
- Les observations UX attendues sont definies.
- Les preuves a collecter excluent secrets, tokens, credentials et valeurs `.env`.
- Le format de Fresh Evidence Pack manuel est defini.
- Les hors-scope et gates sont explicites.
- La prochaine decision apres 040 est cadree sans ouvrir `041`.
- `docs/product/v1-plan.md` reference `040` comme spec active.
- Aucun fichier hors `docs/product/v1-plan.md` et cette spec active n'est modifie.

## Checks attendus pour cette mission DOCS_ONLY

Commandes autorisees et attendues :

- `git status --short --branch --untracked-files=all`
- `git diff --name-status`
- `git diff --stat`
- `git diff --check`
- `git diff --cached --name-status`

Aucun test backend, frontend, DB, navigateur ou runtime ne doit etre lance pour cette creation documentaire.

## Prochaine decision apres 040

Apres execution manuelle du smoke 040, la decision attendue est l'une des suivantes :

- `PASS 040` : le POC interne global est suffisamment clair pour continuer vers une decision produit suivante.
- `PARTIEL 040` : le socle tient, mais une dette UX, wording, robustesse percue ou parcours doit etre recadree avant une prochaine spec.
- `FAIL 040` : le parcours global ne tient pas ou une garantie critique est rompue ; corriger le blocage avant toute suite.

La dette candidate pour une eventuelle suite doit etre formulee dans le Fresh Evidence Pack manuel, mais `040` n'ouvre pas `041` et ne cree pas de spec suivante.

## Revue humaine recommandee

Revue humaine recommandee : oui.

Motif : meme sans code, le smoke 040 juge une experience POC interne globale qui traverse auth locale, tenant demo, evidence/review, export pack, minimal annex preview, posture non statutaire et absence de secret visible. La revue doit verifier le verdict produit, l'hygiene des preuves, les garde-fous non statutaires et la dette candidate sans demander ni exposer de secret.
