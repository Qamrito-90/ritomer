# 029 - Pilot closing workflow E2E confidence hardening V1

## Status
Done

## Phase
CLOSURE

## Surface
FRONTEND delivered by merged slices; this closure is DOCS_ONLY.

## Risk
C for the delivered product wave; no new runtime risk in this closure.

## Role de cette spec

Cette spec devient la verite normative de cloture de `029`.

Elle consolide les quatre sous-livrables frontend merges sur `main` :

- `029a` dossier progress summary ;
- `029b` audit-ready export pack UI ;
- `029c` minimal annex preview UI ;
- `029d` reviewer workpaper decision UI.

`029` ferme le hardening de confiance E2E du workflow pilote V1. La vague rend les capacites deja livrees plus pilotables depuis l'interface, sans transformer les previews financieres, l'export pack ou l'annexe minimale en livrables statutaires finaux.

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
- `specs/active/029-pilot-closing-workflow-e2e-confidence-hardening-v1.md`
- `docs/ui/ui-foundations-v1.md`
- `README.md`
- `docs/vision/ux.md`
- `docs/vision/architecture.md`
- `docs/vision/ai-native.md`
- `docs/playbooks/ux.md`
- `docs/playbooks/architecture.md`
- `docs/playbooks/ai.md`

Contrats impactes : AUCUN pour cette cloture documentaire.

Runbooks impactes : AUCUN pour cette cloture documentaire.

## Capacites livrees

### 029a - Dossier progress summary

Le frontend expose une synthese de progression du dossier dans le parcours closing V1.

La surface aide l'utilisateur a comprendre l'etat des etapes principales : import, mapping, controls/readiness, previews financieres, workpapers, preuves, review, audit pack et minimal annex preview.

Cette synthese reste une aide de pilotage operationnelle. Elle ne valide pas le closing, ne remplace pas une revue humaine et ne cree aucune decision automatique.

### 029b - Audit-ready export pack UI

Le frontend expose l'audit-ready export pack existant : liste, creation, statut visible cote UI et telechargement via backend.

La surface conserve les garde-fous V1 :

- REST-first ;
- telechargement backend-only ;
- aucune exposition de storage key ;
- aucun signed URL public ;
- aucun nouvel endpoint ;
- aucune promesse de depot ou de livrable statutaire final.

L'audit-ready export pack est un pack de handoff et de revue. Il n'est pas un livrable CO final.

### 029c - Minimal annex preview UI

Le frontend expose la minimal annex preview existante en lecture seule.

La surface affiche les blockers, warnings et limites non statutaires attendues. Elle conserve la posture `isStatutory = false` et `requiresHumanReview = true`.

La minimal annex preview n'est pas une annexe legale finale, n'est pas exportee comme PDF final et ne declenche aucune redaction IA runtime.

### 029d - Reviewer workpaper decision UI

Le frontend expose la decision reviewer workpaper via le contrat REST existant.

La surface reste human-review-first :

- decision humaine explicite ;
- respect des gates existants ;
- aucun contournement de readiness, archive, current anchor ou RBAC ;
- aucune validation automatique ;
- aucune approbation statutaire.

## Decisions figees par la cloture 029

- Le workflow V1 visible depuis l'interface couvre maintenant les surfaces pilote attendues : progression dossier, workpapers, preuves, decisions reviewer, audit-ready export pack et minimal annex preview.
- Les sous-livrables `029a` a `029d` sont des surfaces frontend V1 livrees, construites sur les contrats REST existants.
- REST-first reste la posture V1 ; GraphQL reste hors runtime courant.
- Aucun backend nouveau n'est requis pour cloturer `029`.
- Aucun microservice IA n'est introduit.
- Aucune migration DB n'est introduite.
- Aucun contrat OpenAPI n'est modifie par cette cloture documentaire.
- Aucune IA runtime n'est activee par `029`.
- Aucune redaction IA d'annexe n'est livree.
- Aucune decision automatique n'est livree.
- Les surfaces 029 restent non statutaires lorsqu'elles touchent previews, audit pack ou annexe minimale.

## Hors-scope confirme apres livraison

- moteur CO ;
- annexe legale finale ;
- PDF final statutaire ;
- depot reglementaire ;
- validation statutaire ;
- signature dans un sens de finalisation officielle ;
- IA mapping assiste ;
- assistant conversationnel ;
- agent autonome ;
- GraphQL ;
- microservice IA ;
- backend nouveau ;
- migration DB ;
- changement OpenAPI ;
- refonte UX large ;
- dashboard BI complet.

## Garde-fous wording durables

Termes canoniques autorises pour les surfaces 029 :

- Audit-ready export pack ;
- Minimal annex preview ;
- Preview non statutaire ;
- Non statutory ;
- Prepared for human review ;
- Human review required ;
- Not a final CO deliverable ;
- Do not use as statutory filing.

Ces termes doivent rester des garde-fous produit. Ils ne doivent pas etre utilises pour promettre une capacite CO ou IA non livree.

Termes interdits dans l'UX produit pour les surfaces 029 :

- CO-ready ;
- statutory-ready ;
- official financial statements ;
- annexe officielle ;
- annexe CO finale ;
- final CO annex ;
- final accounts approved ;
- automatically approved ;
- AI-approved ;
- ready to file ;
- certified ;
- signature quand le terme implique une finalisation officielle.

## Acceptance de cloture

- La spec `029` n'est plus active.
- La spec `029` est presente dans `specs/done/`.
- `docs/product/v1-plan.md` declare la vague `029` comme livree.
- Les cadrages du present ne disent plus que l'export audit-ready frontend, la minimal annex preview UI ou la decision reviewer workpaper UI sont hors scope strict du present.
- Les cadrages du present distinguent explicitement repo actuel, capacites 029 livrees, cible long terme, IA future et CO futur.
- La fondation UI canonise le wording durable des surfaces 029.
- Aucun fichier runtime, backend, frontend, contrat, migration, dependance, secret ou configuration Git n'est modifie par cette cloture documentaire.

## Tests runtime

Aucun test runtime n'est requis pour cette cloture, car la mission est strictement `DOCS_ONLY`.

Les tests frontend des sous-livrables `029a`, `029b`, `029c` et `029d` restent portes par leurs PRs d'implementation respectives.

## Revue humaine recommandee

Recommandee pour le wording proche CO, annexe et livrables financiers, car les surfaces 029 exposent des termes sensibles a la comprehension fiduciaire.

Non requise pour backend, DB, contrats, IA runtime ou production, car cette cloture ne modifie aucun de ces artefacts.
