# 035 - Pilot export pack minimal annex refresh UI V1

## Status

Active.

## Surface

FRONTEND_SPEC.

## Risk

B.

Risque standard pour une future orchestration frontend post-action bornee, sans backend, DB, contrat, runbook, IA runtime, GraphQL ni mutation metier additionnelle.

## Role de cette spec

Cadrer une future implementation frontend minimale sur `/closing-folders/:closingFolderId` pour rafraichir la `Minimal annex preview` apres creation reussie d'un `Audit-ready export pack`.

Cette spec ne code pas le runtime. Elle ouvre uniquement le cadrage actif de la prochaine mission frontend recommandee apres le succes de creation audit-ready export pack.

## Sources de verite relues

- `AGENTS.md`
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
- `specs/active/035-pilot-export-pack-minimal-annex-refresh-ui-v1.md` absent avant creation
- `contracts/openapi/exports-api.yaml`
- `contracts/openapi/minimal-annex-api.yaml`
- `docs/ui/ui-foundations-v1.md`
- `README.md`
- `docs/vision/ux.md`
- `docs/vision/architecture.md`
- `docs/vision/ai-native.md`
- `docs/playbooks/ux.md`
- `docs/playbooks/architecture.md`
- `docs/playbooks/ai.md`
- `RISK_REGISTER.md`
- `TESTING_STRATEGY.md`
- `CODE_REVIEW.md`
- `specs/done/013-exports-audit-ready-v1.md`
- `specs/done/027-annexe-minimale-v1.md`
- `specs/done/029-pilot-closing-workflow-e2e-confidence-hardening-v1.md`
- `specs/done/033-pilot-core-flow-ui-refresh-consistency-v1.md`
- `specs/done/034-pilot-balance-import-history-diff-ui-v1.md`
- `frontend/src/app/router.tsx`
- `frontend/src/app/export-audit-pack-panel.tsx`
- `frontend/src/app/minimal-annex-panel.tsx`
- `frontend/src/app/export-audit-pack-panel.test.tsx`
- `frontend/src/app/minimal-annex-panel.test.tsx`
- `frontend/src/lib/api/exports.ts`
- `frontend/src/lib/api/minimal-annex.ts`

Contrats impactes par cette mission documentaire : AUCUN.

Runbooks impactes par cette mission documentaire : AUCUN.

## Probleme exact

Apres un succes de creation d'audit-ready export pack via :

- `POST /api/closing-folders/{closingFolderId}/export-packs`

la `Minimal annex preview` peut rester stale jusqu'au reload de la page.

Le backend `minimal-annex` derive pourtant son read-model depuis les sources courantes, incluant le rattachement a un export pack existant. Une creation d'export pack reussie peut donc rendre la preview plus complete ou faire evoluer ses blockers, warnings et basis.

Le probleme n'est pas un manque de backend, de contrat ou d'IA. C'est un probleme d'orchestration frontend post-action entre deux surfaces deja presentes :

- `Audit-ready export pack`
- `Minimal annex preview`

## Comportement attendu

### Regles communes

- Le succes export reste acquis des que `POST /api/closing-folders/{closingFolderId}/export-packs` retourne un succes exploitable selon les contrats existants.
- L'echec du refresh minimal annex ne transforme jamais ce succes export en erreur de creation export.
- Le refresh minimal annex utilise uniquement le `GET` REST existant :
  - `GET /api/closing-folders/{closingFolderId}/minimal-annex`
- Si ce `GET` reussit avec un payload exploitable selon la validation frontend existante, la `Minimal annex preview` visible est mise a jour.
- Si ce `GET` echoue, timeout, retourne une erreur HTTP ou un payload inexploitable, la preview existante est conservee et un warning explicite est affiche.
- Le warning post-action attendu est stabilise comme :
  - `rafraichissement minimal annex impossible`
- Le warning est borne au dernier succes de creation export pack concerne.
- Le chargement initial existant de la minimal annex preview n'est pas redefini par cette spec.
- Le wording non statutaire et de revue humaine reste obligatoire.

### Apres creation export pack reussie

Apres un `POST /api/closing-folders/{closingFolderId}/export-packs` reussi avec `201 Created` ou replay `200 OK` exploitable :

1. Le succes `Audit-ready export pack` reste visible et acquis.
2. Le comportement existant de refresh de la liste export packs reste autorise.
3. Le frontend declenche ensuite `GET /api/closing-folders/{closingFolderId}/minimal-annex`.
4. Si le payload minimal annex est exploitable, la preview est remplacee par le nouvel etat.
5. Si le refresh minimal annex n'est pas exploitable, la preview precedente est conservee et le warning `rafraichissement minimal annex impossible` est visible.

Le refresh minimal annex ne doit pas supposer que l'annexe devient `READY`. Un payload exploitable peut etre `READY` ou `BLOCKED`; la preview doit afficher l'etat retourne.

### Apres download ZIP

Apres `GET /api/closing-folders/{closingFolderId}/export-packs/{exportPackId}/content` :

- aucun refresh minimal annex ne doit etre declenche ;
- aucun changement de preview minimal annex ne doit etre derive du download ;
- aucun warning minimal annex ne doit etre affiche a cause du download.

Le download ZIP reste une lecture backend-only et ne modifie pas la base de preparation de l'annexe.

## Scope strict de la future implementation

- Orchestration frontend post-action apres creation export pack uniquement.
- Refresh de la minimal annex preview via `GET /api/closing-folders/{closingFolderId}/minimal-annex`.
- Conservation du succes export si le refresh minimal annex echoue.
- Warning UI explicite `rafraichissement minimal annex impossible`.
- Tests frontend cibles.
- Aucun changement backend.
- Aucun changement DB.
- Aucun changement OpenAPI.
- Aucun changement de contrat.
- Aucun changement IA runtime.

## Hors-scope strict

- Backend.
- DB.
- Migration.
- OpenAPI.
- Contrats.
- Runbooks.
- Policies.
- GitHub workflows.
- PDF final.
- Annexe legale finale.
- CO-ready.
- Statutory-ready.
- IA runtime/provider/prompt/eval.
- RAG ou vector store.
- GraphQL.
- Refactor large.
- Refresh global post-action.
- Refresh minimal-annex apres download ZIP.
- Mutation workpaper.
- Mutation document.
- Modification export storage/download.
- Secret, `.env`, token, credential.
- Nouvelle promesse CO, statutaire, officielle, certifiee ou prete au depot.

## Non-derive produit et wording

La future implementation doit conserver les garde-fous UI existants :

- `Audit-ready export pack` designe un pack de handoff et de revue, pas un livrable CO final.
- `Minimal annex preview` designe une preview read-only, non statutaire et preparee pour revue humaine.
- `Prepared for human review` et `Human review required` restent visibles sur la surface minimal annex.
- `Not a final CO deliverable` et `Do not use as statutory filing` restent disponibles quand l'ambiguite de finalisation peut exister.

Termes interdits dans la future implementation :

- `CO-ready`
- `statutory-ready`
- `official financial statements`
- `annexe officielle`
- `annexe CO finale`
- `final CO annex`
- `final accounts approved`
- `automatically approved`
- `AI-approved`
- `ready to file`
- `certified`
- `signature` quand le terme implique une finalisation officielle

## Endpoints autorises dans la future implementation

Endpoint de mutation existant declencheur :

- `POST /api/closing-folders/{closingFolderId}/export-packs`

Endpoints de lecture existants autorises dans le flux post-succes :

- `GET /api/closing-folders/{closingFolderId}/export-packs`
- `GET /api/closing-folders/{closingFolderId}/minimal-annex`

Endpoint de lecture existant explicitement sans refresh minimal annex :

- `GET /api/closing-folders/{closingFolderId}/export-packs/{exportPackId}/content`

Aucun autre endpoint ne doit etre ajoute pour cette spec.

## Fichiers probablement concernes par la future implementation

- `frontend/src/app/router.tsx`
- `frontend/src/app/export-audit-pack-panel.tsx`
- `frontend/src/app/minimal-annex-panel.tsx`
- `frontend/src/app/export-audit-pack-panel.test.tsx`
- eventuellement `frontend/src/app/minimal-annex-panel.test.tsx`
- eventuellement un test route cible si l'orchestration est portee par la route

Cette liste n'autorise pas de changement runtime dans la mission courante `DOCS_ONLY`.

## Tests attendus pour la future implementation

- Creation export pack succes `201` + refresh minimal annex via `GET /api/closing-folders/{closingFolderId}/minimal-annex`.
- Creation export pack replay `200` + refresh minimal annex via `GET /api/closing-folders/{closingFolderId}/minimal-annex`.
- Echec HTTP, timeout, network error ou payload invalide du refresh minimal annex conserve le succes export et affiche `rafraichissement minimal annex impossible`.
- Payload minimal annex exploitable met a jour la preview visible, sans supposer `READY` si le backend retourne `BLOCKED`.
- Download ZIP ne declenche aucun refresh minimal annex.
- Absence d'endpoint hors scope.
- Absence d'appel `/ai`.
- Absence GraphQL.
- Absence backend, DB, contrat, document/workpaper mutation dans le diff.
- Wording non statutaire conserve.
- Wording de revue humaine requis conserve.
- Aucun secret, token, credential ou valeur `.env` expose.

## Gates de validation de la future implementation

- `pnpm test:ci`
- `pnpm lint`
- `pnpm build`
- `git diff --check`

## Checks de cette mission DOCS_ONLY

Checks attendus pour la creation de spec et l'alignement du plan :

- `git status --short --branch --untracked-files=all`
- `git diff --name-status`
- `git diff --stat`
- `git diff --check`
- `git diff -- docs/product/v1-plan.md`
- `git diff --no-index -- /dev/null specs/active/035-pilot-export-pack-minimal-annex-refresh-ui-v1.md`
- `git diff --no-index --check -- /dev/null specs/active/035-pilot-export-pack-minimal-annex-refresh-ui-v1.md`
- `git diff --no-index --stat -- /dev/null specs/active/035-pilot-export-pack-minimal-annex-refresh-ui-v1.md`
- `git diff --no-index --name-status -- /dev/null specs/active/035-pilot-export-pack-minimal-annex-refresh-ui-v1.md`

Aucun test runtime frontend, backend ou DB ne doit etre lance pour cette mission documentaire.

## Impact docs, contrats et runbooks

- `docs/product/v1-plan.md` doit pointer vers cette spec dans la section `Active`.
- `docs/product/v1-plan.md` ne doit pas ajouter `035` dans `Livre`.
- Le rappel `030d runtime` provider reel reporte doit rester intact.
- `docs/present/*` : AUCUN changement attendu tant que la future implementation n'est pas livree.
- `docs/ui/ui-foundations-v1.md` : AUCUN changement attendu, le wording durable existe deja.
- Contrats : AUCUN.
- Runbooks : AUCUN.

## Criteres d'acceptation de cette mission de cadrage

- `specs/active/035-pilot-export-pack-minimal-annex-refresh-ui-v1.md` existe.
- La spec est `Active`.
- La surface est `FRONTEND_SPEC`.
- Le risque est `B`.
- La spec cadre le refresh minimal annex apres succes `POST /api/closing-folders/{closingFolderId}/export-packs`.
- La spec stabilise le warning `rafraichissement minimal annex impossible`.
- La spec interdit le refresh minimal annex apres download ZIP.
- La spec interdit backend, DB, OpenAPI, contrats, runbooks, IA runtime, GraphQL, mutation workpaper/document, secrets et refactor large.
- `docs/product/v1-plan.md` pointe vers cette spec en active.
- `035` n'est pas ajoutee en done.
- Aucun runtime n'est modifie par cette mission.

## Revue humaine recommandee

Revue frontend normale recommandee pendant la future PR d'implementation.

Revue specialisee non requise pour cette mission `DOCS_ONLY`, car elle ne modifie ni migration DB, ni authentification, ni autorisation, ni separation tenant, ni audit, ni donnees sensibles, ni suppression, ni regle metier critique executable, ni dependance, ni architecture, ni production, ni action irreversible.
