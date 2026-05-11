# 032 - Controls readiness deterministic consumer hardening V1

## Status

Active.

## Surface

FRONTEND.

## Risk

B.

## Role de cette spec

Durcir le consumer frontend existant de `GET /api/closing-folders/{closingFolderId}/controls` pour garantir un comportement fail-closed sur les payloads `/controls` incoherents, invalides ou contenant des cles sensibles inattendues.

Cette spec n'introduit pas une nouvelle UI metier et n'active aucune capacite IA.

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
- `specs/done/006-controls-v1.md`
- `specs/done/014-frontend-controls-readiness-cockpit-v1.md`
- `contracts/openapi/controls-api.yaml`
- `docs/ui/ui-foundations-v1.md`
- `README.md`
- `docs/vision/ux.md`
- `docs/vision/architecture.md`
- `docs/vision/ai-native.md`
- `docs/playbooks/ux.md`
- `docs/playbooks/architecture.md`
- `docs/playbooks/ai.md`

## Scope strict

- `specs/active/032-controls-readiness-deterministic-consumer-hardening-v1.md`
- `frontend/src/lib/api/controls.ts`
- `frontend/src/lib/api/controls.test.ts`
- `frontend/src/app/router.test.tsx` uniquement si un ajustement de test existant est necessaire a cause du consumer controls.
- `frontend/src/app/router.workpapers.test.tsx` uniquement pour stabiliser le test UI timing-sensitive et realigner sa fixture `/controls` hors contrat.
- `frontend/src/app/router.import-balance.test.tsx` et `frontend/src/app/router.manual-mapping.test.tsx` uniquement pour realigner les fixtures `/controls` hors contrat.
- `frontend/src/app/dossier-progress-summary.test.tsx` uniquement pour realigner les fixtures `/controls` hors contrat.

## In scope

- Inspecter le contrat `contracts/openapi/controls-api.yaml` et le consumer `frontend/src/lib/api/controls.ts` avant modification.
- Ajouter des tests unitaires dedies a `frontend/src/lib/api/controls.ts`.
- Rejeter en `invalid_payload` les payloads `/controls` qui violent les invariants contractuels consommes par le frontend.
- Rejeter en `invalid_payload` les payloads qui exposent des cles sensibles connues comme `storageObjectKey`, `storage_object_key`, `signedUrl`, `storagePath`, `rawProviderMessage`, `providerResponse`, `secret`, `token`, `credential` ou `privatePath`.
- Maintenir la sequence et les endpoints frontend existants.
- Garantir qu'un payload readiness invalide ne produit aucun rendu partiel via le state `invalid_payload`.

## Hors-scope

- Backend.
- DB.
- Migration.
- Provider IA.
- Prompt IA.
- Contrat IA.
- GraphQL.
- RAG ou vector store.
- Microservice.
- Refactor large.
- Changement UI metier.
- Changement OpenAPI, sauf ecart contractuel prouve bloquant. Dans ce cas la mission doit s'arreter avec diagnostic.

## Criteres d'acceptation verifiables

- `frontend/src/lib/api/controls.test.ts` existe et couvre le consumer controls directement.
- `GET /controls` conserve le path existant et le header `X-Tenant-Id`.
- `401`, `403`, `404`, `5xx`, statut inattendu, timeout et erreur reseau restent mappes sur les states existants.
- Un payload nominal `READY` valide retourne `kind: "ready"`.
- Un payload nominal `BLOCKED` valide retourne `kind: "ready"`.
- Une incoherence entre `closingFolderId` route, dossier charge et payload retourne `invalid_payload`.
- `READY` avec `nextAction` presente retourne `invalid_payload`.
- `BLOCKED` sans controle en `FAIL` retourne `invalid_payload`.
- Les types invalides, enums invalides et valeurs `null` non autorisees sur le sous-ensemble consomme retournent `invalid_payload`.
- `closingFolderStatus` et `controls[].severity`, requis par `contracts/openapi/controls-api.yaml` meme s'ils ne sont pas rendus, sont obligatoires ; absence, enum invalide ou `null` retournent `invalid_payload`.
- Les cles sensibles connues, meme imbriquees, retournent `invalid_payload`.
- L'ordre contractuel de `controls[]` reste respecte.
- L'ordre de `unmappedAccounts[]` n'est ni trie ni rejete par principe.
- Aucun endpoint nouveau n'est consomme.
- Aucun rendu UI metier nouveau n'est introduit.
- Aucune activation IA n'est introduite.

## Tests attendus

- Tests unitaires `frontend/src/lib/api/controls.test.ts`.
- Gates frontend :
  - `pnpm build`
  - `pnpm test:ci`
  - `pnpm lint`

## Gates

- `pnpm build`
- `pnpm test:ci`
- `pnpm lint`

## Fresh Evidence Pack attendu

- Resume.
- Fichiers modifies.
- Diff par fichier.
- Commandes executees.
- Sorties de tests pertinentes.
- Statut Git final.
- Ecarts au plan.
- Risques residuels.
- Tests non executes et justification.

## Revue humaine recommandee

Non requise pour backend, DB, auth, autorisation, separation tenant, audit, donnees sensibles, suppression de donnees, regle metier critique, dependance, architecture, production ou irreversibilite metier, car cette mission est frontend-only et ne modifie aucun contrat ni runtime backend.

Recommandee seulement en revue frontend normale, car le changement durcit un consumer existant visible dans le parcours controls/readiness.
