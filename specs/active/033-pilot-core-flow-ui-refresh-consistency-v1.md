# 033 - Pilot core flow UI refresh consistency V1

## Status

Active.

## Surface

FRONTEND.

## Risk

B.

## Role de cette spec

Creer le cadrage actif de `033` pour corriger la coherence frontend post-action du parcours pilote coeur sur `/closing-folders/:closingFolderId`.

Cette spec est uniquement une spec active. Elle n'autorise aucune implementation runtime a ce stade.

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
- `specs/active/033-pilot-core-flow-ui-refresh-consistency-v1.md` absent avant creation
- `specs/done/016-frontend-import-balance-v1.md`
- `specs/done/017-frontend-manual-mapping-v1.md`
- `specs/done/029-pilot-closing-workflow-e2e-confidence-hardening-v1.md`
- `specs/done/030-ia-mapping-assiste-suggestion-review-v1.md`
- `specs/done/032-controls-readiness-deterministic-consumer-hardening-v1.md`
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

Le parcours pilote coeur expose deja plusieurs read-models sur `/closing-folders/:closingFolderId`, mais certaines actions metier peuvent laisser l'interface partiellement stale apres succes.

Les gaps concrets a borner sont :

- apres import balance reussi, certaines surfaces aval peuvent conserver leur ancien etat alors que le dernier import a change ;
- apres mapping manuel reussi, certaines previews/read-models aval peuvent rester bases sur l'ancien mapping ;
- apres decision de suggestion no-provider, le refresh doit dependre de la decision humaine et du mapping reellement applique, pas seulement du succes HTTP de la decision.

Le probleme n'est pas un manque de backend, de contrat ou de provider IA. C'est un probleme d'orchestration frontend post-action et de feedback utilisateur quand un refresh partiel echoue.

## Comportement attendu

### Regles communes

- Le succes de l'action utilisateur reste acquis des que la mutation existante a reussi et que son payload de succes est exploitable selon les specs existantes.
- Les refreshs post-succes utilisent uniquement des `GET` REST existants sous `/api/closing-folders/...`.
- L'echec d'un refresh aval ne transforme jamais un succes acquis en erreur de mutation.
- Chaque echec de refresh aval doit produire une ligne de warning explicite, visible et testable, indiquant la surface non rafraichie.
- Les warnings post-action sont strictement bornes au dernier succes concerne.
- L'orchestration ne doit pas ajouter d'endpoint nouveau, de GraphQL, de provider IA, de modele, de SDK, de prompt runtime, de config IA ou d'appel modele.
- Le chargement initial existant de la route n'est pas redefini par cette spec ; `033` borne uniquement les refreshs declenches apres succes d'action.

### Apres import balance reussi

Apres un `POST /api/closing-folders/{closingFolderId}/imports/balance` reussi :

- le succes import est visible immediatement ;
- le dossier est rafraichi via `GET /api/closing-folders/{id}` ;
- les surfaces coeur aval sont rafraichies via leurs `GET` existants :
  - `GET /api/closing-folders/{closingFolderId}/controls` ;
  - `GET /api/closing-folders/{closingFolderId}/mappings/manual` ;
  - `GET /api/closing-folders/{closingFolderId}/financial-summary` ;
  - `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` ;
  - `GET /api/closing-folders/{closingFolderId}/workpapers` ;
- les suggestions IA no-provider sont rafraichies uniquement comme read-model existant via `GET /api/closing-folders/{closingFolderId}/mappings/suggestions` ;
- si un refresh aval echoue, le succes import reste acquis et une ligne de warning explicite indique la surface non rafraichie.

Warnings attendus, libelles exacts a stabiliser pendant l'implementation :

- `rafraichissement dossier impossible`
- `rafraichissement controls impossible`
- `rafraichissement mapping impossible`
- `rafraichissement financial summary impossible`
- `rafraichissement financial statements impossible`
- `rafraichissement workpapers impossible`
- `rafraichissement suggestions impossible`

### Apres mapping manuel PUT/DELETE reussi

Apres un `PUT /api/closing-folders/{closingFolderId}/mappings/manual` ou un `DELETE /api/closing-folders/{closingFolderId}/mappings/manual` reussi :

- le succes mapping est visible immediatement ;
- les surfaces coeur sont rafraichies via leurs `GET` existants :
  - `GET /api/closing-folders/{closingFolderId}/mappings/manual` ;
  - `GET /api/closing-folders/{closingFolderId}/controls` ;
  - `GET /api/closing-folders/{closingFolderId}/financial-summary` ;
  - `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` ;
  - `GET /api/closing-folders/{closingFolderId}/workpapers` ;
- les suggestions no-provider sont rafraichies via `GET /api/closing-folders/{closingFolderId}/mappings/suggestions` pour eviter une suggestion obsolete sur un compte deja mappe ;
- si un refresh aval echoue, le succes mapping reste acquis et une ligne de warning explicite indique la surface non rafraichie.

Warnings attendus, libelles exacts a stabiliser pendant l'implementation :

- `rafraichissement mapping impossible`
- `rafraichissement controls impossible`
- `rafraichissement financial summary impossible`
- `rafraichissement financial statements impossible`
- `rafraichissement workpapers impossible`
- `rafraichissement suggestions impossible`

### Apres decision suggestion no-provider

Apres un `POST /api/closing-folders/{closingFolderId}/mappings/suggestions/{accountCode}/decision` reussi :

- `REJECT` declenche uniquement le refresh de `GET /api/closing-folders/{closingFolderId}/mappings/suggestions` ;
- `ACCEPT` ou `CORRECT` avec effet applique `MANUAL_MAPPING_CREATED` ou `MANUAL_MAPPING_UPDATED` declenche :
  - `GET /api/closing-folders/{closingFolderId}/mappings/suggestions` ;
  - le meme bundle aval que le mapping manuel reussi :
    - `GET /api/closing-folders/{closingFolderId}/mappings/manual` ;
    - `GET /api/closing-folders/{closingFolderId}/controls` ;
    - `GET /api/closing-folders/{closingFolderId}/financial-summary` ;
    - `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` ;
    - `GET /api/closing-folders/{closingFolderId}/workpapers` ;
- `ACCEPT` ou `CORRECT` sans effet exploitable `MANUAL_MAPPING_CREATED` ou `MANUAL_MAPPING_UPDATED` ne doit pas supposer un mapping applique ; l'orchestration reste bornee au refresh suggestions, sauf si le contrat existant prouve un autre effet mapping exploitable ;
- aucun provider IA, modele, SDK, prompt runtime, configuration IA ou appel modele ne doit etre introduit.

## Surfaces non rafraichies en 033

`033` ne rafraichit pas apres ces actions :

- `export-packs` ;
- `minimal-annex` ;
- upload document ;
- download document ;
- review document ;
- mutations workpaper ;
- mutations document.

Les chargements initiaux existants de ces surfaces ne sont pas redefinis par cette spec. L'interdit porte sur les refreshs post-action ajoutes par `033`.

## Scope strict

- Orchestration frontend post-action sur `/closing-folders/:closingFolderId`.
- `GET` existants seulement.
- Tests frontend cibles.
- Warnings UI post-action strictement bornes.
- Aucun changement backend.
- Aucun changement DB.
- Aucun changement OpenAPI.
- Aucun changement de contrat.
- Aucun changement runtime IA.

## Hors-scope strict

- Backend.
- DB.
- Migration.
- OpenAPI.
- GraphQL.
- Provider IA reel.
- Prompt IA.
- Eval IA.
- RAG ou vector store.
- Microservice IA.
- Refactor large.
- Nouvelle capacite comptable.
- Nouvelle promesse CO/statutory.
- Refresh `export-packs`.
- Refresh `minimal-annex`.
- Mutations document.
- Mutations workpaper.
- Activation ou changement de configuration IA.
- Ajout de provider, modele, SDK, cout provider ou appel reseau IA.
- Auto-apply, bulk decision ou decision IA autonome.

## Fichiers probablement concernes pour l'implementation future

- `frontend/src/app/router.tsx`
- `frontend/src/app/ai-mapping-suggestions-panel.tsx`
- `frontend/src/app/router.import-balance.test.tsx`
- `frontend/src/app/router.manual-mapping.test.tsx`
- eventuellement `frontend/src/app/ai-mapping-suggestions-panel.test.tsx`
- eventuellement `frontend/src/app/dossier-progress-summary.test.tsx`

Cette liste ne donne pas autorisation d'implementation dans cette mission de creation de spec.

## Criteres d'acceptation verifiables

- Un import reussi ne laisse plus `Mapping manuel`, `Financial summary`, `Financial statements structured` ou `Workpapers` dans un etat initial stale.
- Un import reussi rafraichit aussi `Controls`, le dossier et les suggestions no-provider comme read-model existant.
- Un mapping manuel reussi ne laisse plus les previews financieres ou `Workpapers` stale.
- Un mapping manuel reussi rafraichit aussi `Mapping manuel`, `Controls` et les suggestions no-provider.
- Une suggestion `ACCEPT` no-provider avec mapping applique rafraichit les memes surfaces coeur que le mapping manuel.
- Une suggestion `CORRECT` no-provider avec mapping applique rafraichit les memes surfaces coeur que le mapping manuel.
- Une suggestion `REJECT` ne declenche pas de refresh mapping, controls, financial summary, financial statements structured ou workpapers.
- Les warnings de refresh partiel sont visibles et testables.
- Aucun endpoint hors scope n'est appele.
- Aucun refresh post-action `export-packs` ou `minimal-annex` n'est ajoute.
- Aucune mutation workpaper ou document n'est ajoutee au flux `033`.
- Aucun wording `CO-ready`, `statutory-ready`, `AI-approved` ou `pilot-ready` n'est introduit.
- Aucune activation IA runtime n'est introduite.
- Aucun endpoint `/ai` n'est appele.
- Aucun endpoint GraphQL n'est appele.

## Tests cibles attendus

- Test route import : nouveaux `GET` post-succes et etat UI rafraichi.
- Test route import : succes import conserve avec warning explicite si un refresh aval echoue.
- Test route mapping `PUT` : refresh mapping, controls, previews, workpapers et suggestions.
- Test route mapping `DELETE` : refresh mapping, controls, previews, workpapers et suggestions.
- Tests suggestion `ACCEPT` no-provider avec `MANUAL_MAPPING_CREATED` ou `MANUAL_MAPPING_UPDATED`.
- Tests suggestion `CORRECT` no-provider avec `MANUAL_MAPPING_CREATED` ou `MANUAL_MAPPING_UPDATED`.
- Test suggestion `REJECT` borne au refresh suggestions seulement.
- Tests d'absence :
  - pas `/ai` ;
  - pas GraphQL ;
  - pas refresh `export-packs` post-action ;
  - pas refresh `minimal-annex` post-action ;
  - pas mutation workpaper ;
  - pas mutation document ;
  - pas endpoint hors scope.

## Gates obligatoires pour l'implementation future

- `pnpm build`
- `pnpm test:ci`
- `pnpm lint`
- `git diff --check`

## Impact docs, contrats et runbooks

- Contrats : AUCUN.
- Runbooks : AUCUN.
- `docs/product/v1-plan.md` : AUCUN maintenant, mise a jour seulement a la cloture si `033` est livree.
- `docs/present/*` : AUCUN sauf changement durable prouve apres livraison.
- `docs/ui/ui-foundations-v1.md` : AUCUN sauf changement durable de verite UI.

## Gates specialises

- CTO Gate : non requis si le scope frontend-only est respecte.
- CO Review : non requise.
- Expert Review Board : non requis a ce stade.

## Fresh Evidence Pack attendu apres creation de spec

- Resume.
- Fichier cree.
- Diff complet de la spec.
- Commandes executees.
- `git status --short --branch --untracked-files=all`.
- `git diff --name-status`.
- `git diff --stat`.
- `git diff --check`.
- Tests non executes et justification docs-only.
- Confirmation qu'aucun runtime n'a ete touche.
- Confirmation qu'aucun `git add`, commit, push ou PR n'a ete fait.

## Revue humaine recommandee

Non requise a ce stade pour backend, DB, migration, authentification, autorisation, separation tenant, audit, donnees sensibles, suppression de donnees, regle metier critique, dependance, architecture, production ou irreversibilite metier, car cette mission cree uniquement une spec active frontend.

Revue frontend normale recommandee lors de l'implementation future, car le changement touchera l'orchestration visible du parcours pilote coeur.
