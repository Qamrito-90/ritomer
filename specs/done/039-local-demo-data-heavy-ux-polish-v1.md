# 039 - Local demo data-heavy UX polish V1

## Status

Done.

## Surface

DOCS_GIT.

Cette cloture documentaire acte la livraison des sous-livrables `039a`, `039b`, `039c`, `039d` et `039e`. Elle ne livre aucun code runtime, aucun frontend runtime, aucun backend, aucun endpoint, aucun contrat OpenAPI, aucune migration DB, aucune CI, aucun token, aucun secret, aucune valeur `.env`, aucune donnee demo supplementaire, aucune IA runtime et aucun GraphQL.

## Risk

B.

Le risque vient du fait que la future implementation touchera visuellement des panneaux frontend data-heavy deja branches sur un backend reel, un tenant actif, des endpoints REST existants et des surfaces proches de la revue audit-ready. Le risque reste `B` tant que `039` reste un polish frontend strict, sans backend, DB, OpenAPI, auth, tenant, audit, IA runtime, GraphQL, documents/storage nouveaux ni promesse CO/statutaire.

Reclasser en `C` et recadrer avant implementation si une proposition touche :

- backend, DB, migration ou contrat OpenAPI ;
- authentification, JWT, proxy Vite, session navigateur ou stockage de token ;
- resolution de tenant, autorisation, audit ou separation tenant ;
- nouveau endpoint, nouvelle mutation ou nouvelle donnee demo ;
- IA runtime, provider IA, modele, SDK, prompt runtime, RAG ou GraphQL ;
- documents/storage nouveaux ;
- promesse CO, statutaire, officielle, certifiee ou prete au depot.

## Role de cette spec

Cloturer documentairement un increment frontend strict de polish data-heavy apres `038`.

`036` a livre la demo locale integree technique avec backend reel, PostgreSQL reel, auth JWT reelle, tenant demo synthetique et dossier demo visible.

`037` a valide le smoke manuel local en `PASS` technique : `/api/me` backend sans JWT rejete, `/api/me` via proxy Vite avec JWT local accepte, tenant et dossier demo visibles, mauvais tenant rejete, bearer non observe dans le navigateur, l'URL, le storage ou le repo.

`038` a transforme le dossier demo local en cockpit intermediaire : structure workbench/panneaux, tenant, dossier, statut, prochaine action, blockers et progression visibles, wording metier ameliore, mapping observe sans chevauchement bouton/contenu et sans scroll horizontal sauvage observe apres correction.

Le verdict `038` est `PASS` comme cockpit intermediaire, mais pas encore POC premium final. La dette residuelle explicite est :

- polish data-heavy ;
- lisibilite detaillee ;
- design premium approfondi.

`039` traite cette dette sans ouvrir de capacite metier nouvelle.

## Sources relues

- `docs/product/v1-plan.md`
- `specs/done/038-local-demo-closing-workbench-ux-cockpit-v1.md`
- `docs/ui/ui-foundations-v1.md`
- `docs/present/ux-cadrage-v1.md`

Sources runtime a relire avant implementation future, sans les modifier dans cette mission documentaire :

- `frontend/src/app/router.tsx`
- `frontend/src/app/balance-import-history-panel.tsx`
- `frontend/src/app/workpapers-panel.tsx`
- `frontend/src/app/workpapers-panel/view.tsx`
- `frontend/src/app/dossier-progress-summary.tsx`
- `frontend/src/app/minimal-annex-panel.tsx`
- `frontend/src/app/export-audit-pack-panel.tsx`
- `frontend/src/app/ai-mapping-suggestions-panel.tsx`

Contrats impactes par cette creation documentaire : AUCUN.

Runbooks impactes par cette creation documentaire : AUCUN.

## Probleme exact observe apres 038

Apres `038`, l'ecran dossier demo local est structure comme un cockpit et les grands problemes de composition sont corriges. Le premier niveau de lecture expose mieux le tenant, le dossier, le statut, les blockers, la prochaine action et la progression.

Le probleme restant se situe dans les surfaces detaillees data-heavy :

- les panneaux restent parfois trop denses pour une revue fiduciaire rapide ;
- les tableaux, listes et cartes demandent encore trop d'effort de scan ;
- les montants, versions, historiques, decisions et preuves ne sont pas toujours hierarchises comme des donnees de closing ;
- des libelles techniques ou legacy peuvent encore dominer des zones metier ;
- les etats empty/loading/error/partial ne sont pas encore assez coherents et professionnels sur toutes les surfaces ;
- les previews et exports restent corrects fonctionnellement, mais leur posture non statutaire, leur structure et leurs formats doivent etre plus lisibles ;
- l'experience reste credible comme cockpit intermediaire, pas encore comme polish data-heavy premium.

Le probleme n'est pas un manque d'API, de seed, de backend, de mutation, de JWT, de contrat ou de donnees demo. C'est une dette de presentation, de densite cognitive, de micro-hierarchie et de lisibilite detaillee dans les panneaux existants.

## Objectif produit

Rendre les panneaux detailles du dossier demo local reellement lisibles, professionnels et scannables pour une fiduciaire pilote.

Objectifs concrets :

- reduire la densite cognitive des surfaces detaillees ;
- ameliorer les tableaux, listes, cartes, preuves, decisions et previews data-heavy ;
- rendre mapping, import, justifications et previsualisations scannables sans relire de grands blocs ;
- conserver le cockpit/panneaux livre par `038` ;
- conserver les endpoints REST existants ;
- conserver les mutations existantes sans changement ;
- conserver la posture evidence-first, audit-ready et human-in-the-loop ;
- ne creer aucune capacite metier nouvelle ;
- ne pas promettre un livrable CO/statutaire final.

## Sous-livrables livres

`039a` et `039b` ont rendu les surfaces `Import` et `Mapping` plus scannables, tabulaires et lisibles. Les donnees de version, comptes, montants, cibles et actions sont mieux hierarchisees pour une revue fiduciaire rapide, sans nouvelle API, sans nouvelle mutation et sans nouveau seed.

`039c` a nettoye les suggestions IA no-provider deja visibles : les suggestions restent des aides a revoir, sans IA reelle, sans provider, sans modele, sans SDK, sans prompt runtime, sans appel reseau IA, sans auto-apply et sans changement de l'autorite du mapping manuel.

`039d` a rendu les surfaces `Justifications / Preuves` plus metier et actionnables. Les statuts, pieces, verifications et decisions sont presentes comme des elements de revue humaine rattaches aux rubriques, sans nouveau document/storage, sans nouvelle mutation backend et sans contournement audit.

`039e` a rendu les previsualisations, l'export et l'annexe minimale plus prudents et orientes revue humaine. Les surfaces restent non statutaires, non CO-ready, non officielles, non certifiees et non pretes au depot ; elles servent au handoff et a la revue humaine, pas a une finalisation automatique.

## Checks et preuves documentees

- Les checks frontend sont passes dans les PR d'implementation des sous-livrables `039a` a `039e`.
- Un smoke visuel utilisateur a ete effectue sur les surfaces UX cles : import, mapping, suggestions no-provider, justifications/preuves, previsualisations, export et annexe minimale.
- La cloture `039` n'ajoute aucun backend, DB, migration, OpenAPI, auth, IA runtime, GraphQL, nouvelle mutation, nouveau seed, nouvelle donnee demo, CI, secret, token, credential ou valeur `.env`.

## Dette residuelle apres 039

- L'experience complete reste a juger globalement en smoke POC interne.
- La taxonomie et les libelles metier restent perfectibles.
- Le design premium final n'est pas clos par `039`.
- `040`, si elle est ouverte plus tard, devra juger le parcours complet ; cette cloture n'ouvre pas `040`.

## Surfaces data-heavy concernees

Surface principale :

- `/closing-folders/:closingFolderId`

Panneaux et composants frontend prioritairement concernes pour la future implementation :

1. `Import / historique balance`
   - import courant ;
   - versions ;
   - historique ;
   - diff N/N-1 si deja expose ;
   - montants et periodes ;
   - etats loading, empty, error, partial.

2. `Mapping manuel`
   - comptes source ;
   - cibles de mapping ;
   - actions unitaires existantes ;
   - codes longs ;
   - alignement actions/contenu ;
   - prevention de debordement et surcharge.

3. `Justifications / preuves`
   - workpapers ;
   - documents et evidence ;
   - statuts maker/checker ;
   - verification reviewer document ;
   - decision reviewer workpaper deja existante ;
   - pieces et decisions rattachees.

4. `Previsualisations financieres`
   - financial summary preview ;
   - financial statements structured preview ;
   - formats financiers ;
   - structure de lecture ;
   - posture non statutaire claire.

5. `Export / annexe minimale`
   - audit-ready export pack ;
   - minimal annex preview ;
   - statut de disponibilite ;
   - handoff de revue ;
   - rappel non statutaire sans surpromesse.

Surface associee :

- suggestions de mapping no-provider deja visibles dans `ai-mapping-suggestions-panel`, uniquement pour ameliorer la scannabilite et la revue humaine des suggestions existantes, sans IA runtime ni nouvelle decision automatique.

## Comportement cible

### Lisibilite data-heavy

Les panneaux detailles doivent etre lisibles en scan rapide :

- titres courts, metier et stables ;
- sous-titres utiles seulement quand ils expliquent la decision ;
- montants, pourcentages, dates et periodes en `tabular-nums` ;
- colonnes numeriques alignees a droite ;
- libelles, comptes, rubriques, decisions et preuves alignes a gauche ;
- actions alignees et previsibles ;
- codes longs contenus par wrapping, troncature accessible ou disclosure secondaire ;
- contenu critique jamais cache derriere hover-only ;
- pas de grands blocs textuels quand une liste, un tableau, une grille ou une hierarchie courte suffit.

### Import / historique balance

La future implementation doit rendre l'import lisible comme une surface de controle de version :

- import courant clairement distingue de l'historique ;
- versions ou imports successifs scannables ;
- montants et totaux formates proprement ;
- dates/periodes lisibles ;
- diff eventuel presente comme comparaison de revue, pas comme diagnostic technique ;
- etats loading/empty/error/partial comprehensibles et stables ;
- refresh post-import existant conserve, avec warnings de refresh partiel si deja prevus.

La surface ne doit pas creer de nouveau seed, de nouvelle donnee demo, de nouveau calcul backend ni de nouvelle mutation.

### Mapping manuel et suggestions

Le mapping doit etre exploitable sans surcharge :

- comptes source lisibles avec code et libelle contenus ;
- cibles lisibles avec hierarchie claire ;
- actions unitaires existantes alignees et accessibles clavier ;
- suggestions no-provider presentees comme aides a revoir, jamais comme autorite ;
- preuves ou raisons de suggestion scannables si deja exposees ;
- decisions humaines `ACCEPT`, `CORRECT`, `REJECT` conservees sans bulk auto-apply ;
- mapping manuel maintenu comme autorite metier ;
- aucune preselection silencieuse qui pourrait engager une decision.

Les codes longs ne doivent pas provoquer de chevauchement, de scroll horizontal sauvage ou de compression illisible des actions.

### Justifications / preuves

Les surfaces workpapers/evidence doivent abandonner les restes de logique technique comme premier niveau de lecture.

La future implementation doit favoriser des rubriques metier :

- `Justification` ;
- `Pieces` ;
- `Verification` ;
- `Revue maker/checker` ;
- `Decision` ;
- `Ancienne version` ou equivalent pour stale ;
- `A completer`, `A revoir`, `Verifie`, `Retourne` ou equivalents coherents avec les donnees existantes.

Le statut maker/checker doit etre comprehensible sans connaitre le modele interne. Les pieces jointes, verifications et decisions doivent etre lisibles comme preuves rattachees a un poste ou une rubrique, pas comme objets techniques.

### Previsualisations financieres

Les previews financieres doivent etre plus structurees et plus lisibles :

- synthese financiere en montants propres ;
- sections et sous-sections clairement separees ;
- formats financiers coherents ;
- distinction courant, historique, partiel, stale ou indisponible quand le read-model l'expose ;
- rappel `Preview non statutaire`, `Prepared for human review`, `Not a final CO deliverable` ou equivalent quand une ambiguite de finalisation existe ;
- aucune promesse d'etats financiers officiels, certifies, CO-ready ou prets au depot.

Les previews restent read-only, derivees et non statutaires.

### Export / annexe minimale

L'audit-ready export pack et la minimal annex preview doivent rester comprensibles comme surfaces de handoff et de revue :

- statut visible et formule en consequence utilisateur ;
- pack existant ou absent clairement distingue ;
- telechargement ou creation seulement si l'action existe deja ;
- minimal annex preview lue comme preview non statutaire ;
- wording audit-ready conserve sans transformer le pack en livrable CO final ;
- human review required visible quand pertinent.

## Principes UX applicables

`docs/ui/ui-foundations-v1.md` est normatif pour la future implementation de `039`.

Principes a appliquer :

- clarity first, sophistication second ;
- financial workbench, pas dashboard SaaS generique ;
- data-heavy lisible et scannable ;
- tenant et dossier visibles sur les zones sensibles ;
- statuts explicites avec texte, icone ou microcopy, jamais couleur seule ;
- accessibilite clavier, focus visible, labels accessibles et contraste ;
- etats loading/empty/error/partial coherents ;
- responsive adaptatif, sans clonage aveugle desktop/mobile ;
- formats financiers propres ;
- differenciation claire entre courant, historique, stale et archive ;
- previews, export pack et minimal annex soumis a revue humaine et non statutaires.

Contraintes UI :

- utiliser les composants, tokens et conventions existants ;
- ne pas creer de design system parallele ;
- ne pas introduire de raw hex dans le code applicatif futur ;
- ne pas inventer des variants visuels ad hoc par ecran ;
- ne pas rendre un contenu critique en texte trop petit, trop faible ou hover-only ;
- ne pas multiplier badges et alertes si une structure plus calme suffit ;
- ne pas utiliser de grands blocs textuels quand une structure data-heavy est preferable.

## Hors-scope strict

- Backend.
- DB.
- Migration.
- OpenAPI.
- Auth, JWT ou proxy Vite.
- Session navigateur ou stockage de token.
- IA runtime.
- Provider IA, modele, SDK, prompt runtime, eval IA, RAG ou vector store.
- GraphQL.
- Nouveau seed.
- Nouvelle donnee demo.
- Nouveau endpoint.
- Nouvelle mutation.
- Nouvelle capacite metier.
- Refonte design system globale.
- Nouveau wording CO/statutaire.
- Generation d'etats financiers finaux.
- Annexe legale finale.
- POC complet.
- Documents/storage nouveaux.
- CI.
- Secret, `.env`, token, credential ou valeur sensible.
- Spec `040`.

## Contraintes de non-regression

La future implementation ne doit pas regresser :

- cockpit/panneaux et hierarchie generale livres par `038` ;
- tenant, dossier, statut, prochaine action, blockers et progression visibles ;
- absence de chevauchement bouton/contenu observee sur mapping apres correction ;
- absence de scroll horizontal sauvage observee apres correction ;
- endpoints REST existants ;
- mutations existantes ;
- warnings de refresh partiel issus des increments recents ;
- validation fail-closed des payloads sensibles ;
- posture no-provider et human-in-the-loop du mapping assiste ;
- posture non statutaire des previews, export pack et minimal annex ;
- interdiction d'exposer bearer, token, `.env`, proxy ou sequence auth comme contenu UI ;
- rejet du mauvais tenant et absence de bearer cote navigateur observees en `037`.

## Criteres d'acceptation visuels

La future implementation est acceptee visuellement seulement si :

- les panneaux detailles sont plus lisibles sans casser le cockpit `038` ;
- les surfaces import, mapping, preuves, previews, export et minimal annex sont scannables ;
- les montants, dates, periodes et pourcentages ont des formats coherents et `tabular-nums` ;
- les colonnes numeriques sont alignees a droite quand une structure tabulaire est employee ;
- les comptes, cibles, rubriques, pieces et decisions restent lisibles avec codes longs ;
- les actions ne chevauchent pas le contenu et restent accessibles clavier ;
- aucun scroll horizontal sauvage n'apparait a `1366px` ;
- les etats loading/empty/error/partial sont presents et comprehensibles sur les surfaces touchees ;
- les erreurs sont formulees en consequence utilisateur et action possible, avec detail technique secondaire seulement si utile ;
- les statuts ne reposent jamais sur la couleur seule ;
- les grandes zones textuelles sont remplacees par une hierarchie courte, des listes ou tableaux quand c'est plus lisible ;
- les termes techniques ou legacy visibles sont reduits, renommes ou deplaces en niveau secondaire ;
- les previews financieres restent clairement non statutaires ;
- l'audit-ready export pack reste un handoff de revue, pas un livrable final ;
- la minimal annex reste une preview non statutaire, pas une annexe legale finale ;
- aucune promesse `CO-ready`, `statutory-ready`, officielle, certifiee ou prete au depot n'apparait ;
- aucune information sensible, token, bearer, valeur `.env`, credential ou detail de proxy n'est exposee.

## Criteres d'acceptation de cette creation documentaire

- `specs/active/039-local-demo-data-heavy-ux-polish-v1.md` existe.
- La spec est `Active`.
- La surface est `DOCS_GIT / FRONTEND_SPEC`.
- Le risque est `B`.
- `docs/product/v1-plan.md` reference `039` comme spec active.
- `docs/product/v1-plan.md` ne declare plus `AUCUNE spec active.`
- Aucune spec `040` n'est creee ou ouverte.
- Aucun fichier hors `docs/product/v1-plan.md` et cette spec active n'est modifie.
- Aucun runtime backend, frontend, DB, contrat, migration, CI, IA, GraphQL, RAG, provider, secret, token, `.env` ou runbook n'est modifie.

## Tests/checks documentes apres implementation

- `pnpm test:ci`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- smoke visuel utilisateur sur les surfaces UX cles, sans secret, sans capture de token et sans valeur `.env`.

Tests frontend documentes dans les PR d'implementation :

- tests de rendu des panneaux data-heavy touches ;
- tests des etats loading/empty/error/partial quand la surface le permet ;
- tests de non-regression du wording non statutaire ;
- tests de non-regression des actions existantes et warnings de refresh partiel si touches ;
- tests de prevention des libelles interdits si une convention de test existe deja.

## Checks attendus pour cette cloture DOCS_ONLY

Commandes attendues :

- `git status --short --branch --untracked-files=all`
- `git diff --name-status`
- `git diff --stat`
- `git diff --check`

Aucun test backend, frontend, DB, navigateur ou runtime ne doit etre lance pour cette cloture documentaire.

## Fresh Evidence Pack attendu

Le Fresh Evidence Pack de cette mission DOCS_ONLY doit contenir :

1. Resume documentaire.
2. Demande initiale ou plan valide.
3. Surface reelle.
4. Liste exacte des fichiers modifies.
5. Diff precis par fichier.
6. Commandes reellement executees.
7. Sorties fraiches des checks Git.
8. Statut Git final.
9. Tests ajoutes ou modifies.
10. Tests non executes avec justification DOCS_ONLY.
11. Ecarts eventuels.
12. Risques residuels.
13. Revue humaine recommandee ou non.

Le Fresh Evidence Pack ne doit contenir aucun secret, token, cle, cookie, DSN, credential ou valeur `.env`.

## Gates eventuels

- Design/UX review : recommandee pour la future implementation, car `039` vise explicitement le polish data-heavy et la qualite premium.
- Frontend review : recommandee pour verifier layout, accessibilite, responsive, tests et non-regression des surfaces existantes.
- Security/Auth review : non requise si le scope reste frontend UI sans auth, JWT, proxy, stockage navigateur, tenant resolution ou backend.
- Tenant/Audit review : non requise si le scope reste affichage frontend des read-models existants et ne change aucune autorisation, aucun audit et aucune mutation.
- CO Review : non requise si le wording non statutaire est conserve et qu'aucune promesse CO/finale n'est introduite.
- CTO Gate : non requis si aucun backend, API, architecture, GraphQL, CI ou dependance structurante n'est ajoute.

Toute derive vers backend, DB, API, auth, securite, tenant, audit, contrats, production, nouvelle capacite metier ou livrable CO/statutaire doit stopper `039` et exiger un recadrage explicite avant implementation.

## Revue humaine recommandee

Revue humaine recommandee : oui, legere pour cette cloture documentaire.

Motif : la spec ouvre un increment frontend UX sur des surfaces data-heavy sensibles visuellement pour une demo locale integree, notamment import, mapping, preuves, previews, export pack et minimal annex. La revue doit verifier le bornage frontend-only, l'absence de promesse CO/statutaire, l'absence de derive auth/backend/API et la coherence avec `docs/ui/ui-foundations-v1.md`.
