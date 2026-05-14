# 034 - Pilot balance import history diff UI V1

## Status

Active.

## Surface

FRONTEND_SPEC.

## Risk

B pour la future implementation frontend.

## Role de cette spec

Cadrer la prochaine implementation frontend read-only de l'historique des imports balance et du diff N/N-1 sur `/closing-folders/:closingFolderId`, en reutilisant uniquement les endpoints REST existants du module import balance.

Cette spec transforme la recommandation produit post-`033` en handoff actif exploitable. Elle ne code rien par elle-meme et n'ouvre aucun backend, DB, contrat, runbook, GraphQL, IA runtime, rollback, suppression ou comparaison libre multi-versions.

## Sources de verite relues

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ai-cadrage-v1.md`
- `docs/adr/0001-monolithe-modulaire.md`
- `docs/adr/0002-rest-first-graphql-later.md`
- `docs/adr/0003-ai-gateway-evidence-first.md`
- `docs/adr/0004-multi-tenancy-audit-rls-progressive.md`
- `docs/adr/0005-front-ui-stack-and-design-system.md`
- `docs/adr/0006-postgresql-cloud-sql-no-docker-v1.md`
- `docs/product/v1-plan.md`
- `specs/active/034-pilot-balance-import-history-diff-ui-v1.md` absent avant creation
- `specs/done/003-import-balance-v1.md`
- `specs/done/016-frontend-import-balance-v1.md`
- `specs/done/033-pilot-core-flow-ui-refresh-consistency-v1.md`
- `contracts/openapi/import-balance-api.yaml` comme contrat existant reference, non modifie
- `docs/ui/ui-foundations-v1.md`
- `README.md`
- `docs/vision/ux.md`
- `docs/vision/architecture.md`
- `docs/vision/ai-native.md`
- `docs/playbooks/ux.md`
- `docs/playbooks/architecture.md`
- `docs/playbooks/ai.md`

Contrats impactes : AUCUN.

Runbooks impactes : AUCUN.

## Probleme exact

Le backend import balance expose deja l'historique des versions et le diff avec la version precedente. Les specs frontend precedentes ont volontairement exclu ces lectures pour garder les tranches initiales bornees.

Apres `033`, le parcours pilote coeur rafraichit les read-models aval apres import, mapping manuel et decisions de suggestions no-provider. Il manque encore un feedback compact permettant a l'utilisateur de comprendre rapidement :

- quelle version d'import balance est courante ;
- quand les imports precedents ont eu lieu ;
- combien de lignes ont ete ajoutees, retirees ou modifiees entre la version courante et la precedente ;
- si l'historique ou le diff n'a pas pu etre charge, sans remettre en cause un import qui vient de reussir.

Le probleme n'est pas un manque de backend ou de contrat. C'est une capacite frontend read-only a brancher sur des `GET` REST existants.

## Comportement attendu

### Endpoints autorises

`034` consomme uniquement ces nouveaux `GET` existants pour l'historique imports :

- `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`
- `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous`

Ces appels utilisent le meme `X-Tenant-Id` que les autres lectures de `/closing-folders/:closingFolderId`.

`034` ne modifie pas les endpoints deja consommes par `016`, `017`, `029`, `030`, `032` ou `033`.

### Surface UI

Ajouter un panneau compact read-only pres du bloc `Import balance` sur `/closing-folders/:closingFolderId`.

Placement attendu :

- dans la zone de contexte de l'import balance ;
- visible sur la route detail dossier quand le dossier est dans l'etat nominal de chargement deja borne par les specs frontend existantes ;
- assez compact pour ne pas repousser les surfaces coeur `Mapping manuel`, `Controls`, `Financial summary`, `Financial statements structured` et `Workpapers` hors du parcours naturel.

Contenu attendu :

- etat courant de l'historique import balance ;
- derniere version connue ;
- liste compacte des versions d'import retournee par le backend, sans edition ;
- diff N/N-1 de la version courante ou de la version qui vient d'etre importee ;
- compteurs lisibles `added`, `removed`, `changed` ;
- details de diff lisibles mais bornes, sans tableau massif non necessaire a la V1 pilote.

Le panneau doit rester read-only :

- aucun rollback import ;
- aucune suppression import ;
- aucune selection libre de deux versions arbitraires ;
- aucune mutation mapping, workpaper ou document ;
- aucune exportation ;
- aucun parsing local du CSV.

### Chargement initial

Au chargement nominal de `/closing-folders/:closingFolderId`, le frontend charge :

1. `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`.
2. Si la liste est valide et non vide, le frontend choisit la version courante d'apres l'ordre backend attendu, c'est-a-dire la premiere version retournee par le contrat existant en ordre descendant.
3. Le frontend charge ensuite `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous` pour cette version courante.
4. Si la liste est vide, aucun appel `diff-previous` n'est emis.

### Apres import balance reussi

Apres un `POST /api/closing-folders/{closingFolderId}/imports/balance` reussi selon `016` et `033` :

- le succes import reste acquis immediatement selon les regles existantes ;
- le refresh core de `033` reste borne a ses surfaces existantes ;
- `034` ajoute le refresh read-only de l'historique versions ;
- `034` ajoute le refresh read-only du diff N/N-1 pour la version creee par le payload de succes import ;
- si le refresh versions echoue, le succes import reste visible et acquis ;
- si le refresh diff echoue, le succes import reste visible et acquis ;
- chaque echec de refresh historique/diff produit une ligne de warning explicite, visible et testable, bornee au dernier succes import concerne.

Warnings post-import attendus :

- `rafraichissement historique imports impossible`
- `rafraichissement diff import impossible`

Ces warnings ne remplacent pas les warnings `033` existants et ne doivent pas transformer un succes d'import en erreur d'import.

### Etats UI obligatoires

Le panneau doit rendre des etats stables et testables :

- `loading` : chargement historique ou diff en cours ;
- `empty` : aucune version d'import balance historisee ;
- `ready` : versions valides chargees, avec diff valide pour la version courante quand un diff est attendu ;
- `error` : echec HTTP, reseau ou timeout sur versions ou diff ;
- `invalid payload` : payload versions ou diff inexploitable ;
- `no previous version` : premiere version valide sans version precedente a comparer.

Textes minimum attendus :

- `chargement historique imports`
- `aucun import balance historise`
- `historique import indisponible`
- `payload historique import invalide`
- `diff import indisponible`
- `payload diff import invalide`
- `aucune version precedente a comparer`

### Validation payload frontend

Le frontend doit valider strictement le sous-ensemble qu'il consomme.

Pour `versions`, le sous-ensemble minimal exploitable est :

- payload racine tableau ;
- `closingFolderId` present et coherent avec la route ;
- `version` entier positif ;
- `importedAt` present et exploitable pour affichage ;
- `rowCount` entier positif ;
- `totalDebit` string ;
- `totalCredit` string.

Pour `diff-previous`, le sous-ensemble minimal exploitable est :

- `version` entier positif et coherent avec la version demandee ;
- `previousVersion` entier positif ou `null` ;
- `added[]`, `removed[]`, `changed[]` tableaux presents ;
- lignes `added[]` et `removed[]` avec `accountCode`, `accountLabel`, `debit`, `credit` strings ;
- lignes `changed[]` avec `accountCode`, `before`, `after`, chaque cote portant `accountCode`, `accountLabel`, `debit`, `credit` strings.

Tout payload incomplet, incoherent ou non borne tombe dans un etat `invalid payload` stable.

### Regles de non-derive

- Aucun nouvel endpoint.
- Aucun OpenAPI ou contrat modifie.
- Aucun backend.
- Aucune DB.
- Aucune migration.
- Aucun GraphQL.
- Aucun provider IA, prompt IA, eval IA, RAG, vector store ou microservice IA.
- Aucun appel `/ai`.
- Aucun rollback import.
- Aucune suppression import.
- Aucune comparaison libre multi-versions.
- Aucune mutation mapping, workpaper ou document.
- Aucun refresh post-import `export-packs`.
- Aucun refresh post-import `minimal-annex`.
- Aucun wording `CO-ready`, `statutory-ready`, `PDF final` ou `annexe legale finale`.
- Aucun secret, `.env`, token, credential ou variable sensible.

## Scope strict

- Spec frontend read-only future sur `/closing-folders/:closingFolderId`.
- Panneau compact pres d'`Import balance`.
- Consommation des deux `GET` import balance versions/diff existants.
- Etats loading, empty, error, invalid payload et no previous version.
- Refresh versions/diff apres import reussi, sans annuler le succes import si refresh partiel.
- Tests frontend cibles lors de l'implementation.

## Hors-scope strict

- Code runtime dans cette mission de cadrage.
- Frontend modifie dans cette mission de cadrage.
- Backend.
- DB.
- Migration.
- OpenAPI.
- Contrat.
- Runbook.
- GraphQL.
- Provider IA.
- Prompt IA.
- Eval IA.
- RAG ou vector store.
- Microservice IA.
- Rollback import.
- Suppression import.
- Comparaison libre multi-versions.
- Mutation mapping.
- Mutation workpaper.
- Mutation document.
- Refresh `export-packs` post-import.
- Refresh `minimal-annex` post-import.
- Wording CO/statutory/final interdit.
- Secret ou fichier `.env`.

## Fichiers probablement concernes par la future implementation

- `frontend/src/lib/api/import-balance.ts`
- `frontend/src/app/router.tsx`
- `frontend/src/app/router.import-balance.test.tsx`
- `frontend/src/app/balance-import-history-panel.tsx` si extraction utile
- `frontend/src/app/balance-import-history-panel.test.tsx` si extraction utile

## Criteres d'acceptation verifiables

- Le panneau historique/diff est visible pres d'`Import balance` sur `/closing-folders/:closingFolderId`.
- Le chargement initial appelle `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`.
- Si `versions` retourne une liste valide non vide, le frontend appelle `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous` pour la version courante.
- Si `versions` retourne `[]`, le panneau affiche `aucun import balance historise` et aucun `diff-previous` n'est appele.
- Si `versions` echoue, le panneau affiche `historique import indisponible`.
- Si `versions` retourne un payload invalide, le panneau affiche `payload historique import invalide`.
- Si `diff-previous` echoue, le panneau affiche `diff import indisponible`.
- Si `diff-previous` retourne un payload invalide, le panneau affiche `payload diff import invalide`.
- Si `previousVersion = null`, le panneau affiche `aucune version precedente a comparer`.
- Un import reussi garde le succes `balance importee avec succes` visible avant et pendant les refreshs historique/diff.
- Apres import reussi, `versions` est rafraichi.
- Apres import reussi, `diff-previous` est rafraichi pour la version creee par le payload import.
- Un echec du refresh `versions` apres import ajoute `rafraichissement historique imports impossible` sans annuler le succes import.
- Un echec du refresh `diff-previous` apres import ajoute `rafraichissement diff import impossible` sans annuler le succes import.
- Les warnings historique/diff post-import sont bornes au dernier succes import concerne.
- Aucun endpoint `/ai` n'est appele.
- Aucun endpoint GraphQL n'est appele.
- Aucun endpoint hors scope n'est appele.
- Aucun refresh post-import `export-packs` ou `minimal-annex` n'est ajoute.
- Aucune mutation workpaper, document ou mapping n'est ajoutee par `034`.
- Aucun wording `CO-ready`, `statutory-ready`, `PDF final` ou `annexe legale finale` n'est introduit.

## Tests cibles attendus pour la future implementation

- Test route initiale : `versions` charge et panneau loading puis ready.
- Test route initiale : liste vide affiche l'etat empty et ne charge pas `diff-previous`.
- Test route initiale : echec `versions` affiche l'etat error.
- Test route initiale : payload `versions` invalide affiche l'etat invalid payload.
- Test route initiale : diff valide affiche compteurs added/removed/changed.
- Test route initiale : `previousVersion = null` affiche l'etat no previous version.
- Test route initiale : echec `diff-previous` affiche l'etat error diff.
- Test route initiale : payload `diff-previous` invalide affiche l'etat invalid payload diff.
- Test import reussi : succes import conserve et refresh `versions` + `diff-previous` emis.
- Test import reussi : echec refresh `versions` conserve le succes et affiche le warning attendu.
- Test import reussi : echec refresh `diff-previous` conserve le succes et affiche le warning attendu.
- Tests d'absence :
  - pas `/ai` ;
  - pas GraphQL ;
  - pas refresh `export-packs` post-import ;
  - pas refresh `minimal-annex` post-import ;
  - pas mutation mapping ;
  - pas mutation workpaper ;
  - pas mutation document ;
  - pas endpoint hors scope.

## Gates de validation de la future implementation

- `pnpm build`
- `pnpm test:ci`
- `pnpm lint`
- `git diff --check`

## Impact docs, contrats et runbooks

- Contrats : AUCUN.
- Runbooks : AUCUN.
- `docs/product/v1-plan.md` : doit pointer vers `034` tant que cette spec est active.
- `docs/present/*` : AUCUN sauf changement durable prouve apres livraison.
- `docs/ui/ui-foundations-v1.md` : AUCUN sauf changement durable de verite UI.

## Gates specialises

- CTO Gate : non requis si le scope frontend-only est respecte.
- CO Review : non requise.
- Expert Review Board : non requis a ce stade.

## Fresh Evidence Pack attendu pour la future implementation

- Resume.
- Fichiers modifies.
- Diff precis par fichier.
- Commandes executees.
- `git status --short --branch --untracked-files=all`.
- `git diff --name-status`.
- `git diff --stat`.
- `git diff --check`.
- Resultats `pnpm build`, `pnpm test:ci` et `pnpm lint`.
- Tests ajoutes ou modifies.
- Tests non executes avec justification.
- Confirmation qu'aucun backend, DB, migration, OpenAPI, contrat, runbook, GraphQL, IA runtime, secret, git add, commit, push ou PR n'a ete touche.

## Revue humaine recommandee

Revue frontend normale recommandee pendant la future PR d'implementation.

Revue specialisee non requise pour backend, DB, migration, authentification, autorisation, separation tenant, audit, donnees sensibles, suppression de donnees, regle metier critique, dependance, architecture, production ou irreversibilite metier si le scope frontend read-only est strictement respecte.
