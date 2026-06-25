# Plan V1 executable

## Objectif
Permettre a 5 fiduciaires pilotes d'executer un closing complet avec tracabilite, securite, revue et premier gain IA mesurable.

## Ordre des tranches
1. Foundation
2. Core identite / tenants / audit / closing
3. Import balance
4. Mapping manuel
5. Controls + previews financieres derivees
6. Workpapers V1
7. Document storage and evidence files V1
8. Exports audit-ready
9. Annexe minimale
10. Pilot closing workflow E2E confidence hardening
11. IA mapping assiste
12. Hardening

## Principes V1
- workflow closing reel avant sophistication
- REST first
- IA contractuelle et bornee
- tests d'isolation cross-tenant bloquants
- RLS progressive
- observabilite des le depart

## Handoff vivant

### Livre
- `specs/done/001-foundation-bootstrap.md`
- `specs/done/002-core-identity-tenancy-closing.md`
- `specs/done/003-import-balance-v1.md`
- `specs/done/004-frontend-foundation-design-system.md`
- `specs/done/005-manual-mapping-v1.md`
- `specs/done/006-controls-v1.md`
- `specs/done/007-financial-summary-v1.md`
- `specs/done/008-financial-rubric-taxonomy-v2.md`
- `specs/done/009-financial-statements-structured-v1.md`
- `specs/done/010-workpapers-v1.md`
- `specs/done/011-document-storage-and-evidence-files-v1.md`
- `specs/done/012-evidence-review-and-verification-v1.md`
- `specs/done/013-exports-audit-ready-v1.md`
- `specs/done/014-frontend-controls-readiness-cockpit-v1.md`
- `specs/done/015-frontend-closing-folders-entrypoint-v1.md`
- `specs/done/016-frontend-import-balance-v1.md`
- `specs/done/017-frontend-manual-mapping-v1.md`
- `specs/done/018-frontend-financial-summary-preview-v1.md`
- `specs/done/019-frontend-financial-statements-structured-preview-v1.md`
- `specs/done/020-frontend-workpapers-read-model-v1.md`
- `specs/done/021-frontend-workpapers-maker-update-v1.md`
- `specs/done/022-frontend-document-upload-only-v1.md`
- `specs/done/023-frontend-document-download-only-v1.md`
- `specs/done/024-frontend-workpapers-panel-extraction-v1.md`
- `specs/done/025-frontend-document-verification-decision-only-v1.md`
- `specs/done/026-frontend-workpapers-panel-decomposition-v1.md`
- `specs/done/027-annexe-minimale-v1.md`
- `specs/done/028-docs-present-realignment-after-027-v1.md`
- `specs/done/029-pilot-closing-workflow-e2e-confidence-hardening-v1.md`
- `specs/done/030-ia-mapping-assiste-suggestion-review-v1.md`
- `specs/done/032-controls-readiness-deterministic-consumer-hardening-v1.md`
- `specs/done/033-pilot-core-flow-ui-refresh-consistency-v1.md`
- `specs/done/034-pilot-balance-import-history-diff-ui-v1.md`
- `specs/done/035-pilot-export-pack-minimal-annex-refresh-ui-v1.md`
- `specs/done/036-local-integrated-demo-real-backend-seed-v1.md`
- `specs/done/037-local-integrated-demo-manual-business-smoke-v1.md`
- `specs/done/038-local-demo-closing-workbench-ux-cockpit-v1.md`
- `specs/done/039-local-demo-data-heavy-ux-polish-v1.md`
- `specs/done/040-internal-poc-global-smoke-v1.md`
- `specs/done/041-internal-poc-blockers-ux-readiness-v1.md`

### Active
- `specs/active/042-controlled-ai-mapping-runtime-pilot-v1.md`

### Rappels
- `042-controlled-ai-mapping-runtime-pilot-v1` est active en SPEC_CREATION DOCS_ONLY, avec une surface `BACKEND_RUNTIME_INTERNE / EVALS` strictement limitee a `042a2a3`, pour cadrer le premier pilote IA runtime reel strictement limite aux suggestions de mapping sur dossier demo synthetique. `042a1` ajoute uniquement un gate pack draft de gouvernance/readiness (`PENDING_EVIDENCE` ou `DRAFT`) avant tout code provider `042b`. `042a2a1` ajoute uniquement un semantic readiness pack draft avant tout contrat `mapping-suggestion-v2`; `042a2a1b` durcit ce pack et ajoute le manifeste draft de perimetre pilote, avec records `DRAFT` ou `PENDING_EVIDENCE`, sans runtime, provider, backend, frontend, DB/migration, OpenAPI, CI, contrat, prompt runtime, golden set, validator, secret, `.env`, appel reseau IA, production, donnee cliente reelle ou spec `043`. `042a2a2a` ajoute uniquement un snapshot taxonomie candidat minimal, une projection demo synthetique de-mappee et leur validator deterministe, tous `CANDIDATE / PENDING_EVIDENCE / NOT_AUTHORITATIVE`, sans golden set approuve, contrat, provider, runtime, prompt, secret, `.env`, appel IA ou spec `043`. Le pack de cas candidats `042a2` ajoute `candidate-semantic-cases-v1.json`, `candidate-policy-fault-cases-v1.json` et `validate-042a2-candidate-cases.ps1`, tous `CANDIDATE / PENDING_DOUBLE_REVIEW / NOT_GOLDEN / NOT_AUTHORITATIVE`, sans contrat, provider, runtime, prompt, backend/frontend, DB/migration, OpenAPI, secret, `.env`, appel IA ou spec `043`. Le pack de double revue aveugle `042a2` ajoute deux paquets independants, un schema de reponse strict, un builder et un validator, tous `BLIND_REVIEW_INPUT / PENDING_INDEPENDENT_REVIEW / NOT_GOLDEN / NOT_AUTHORITATIVE`, sans reponses humaines, adjudication, promotion golden set, contrat, provider, runtime, prompt, backend/frontend, DB/migration, OpenAPI, secret, `.env`, appel IA ou spec `043`. `042a2a3` ajoute un moteur offline Kotlin interne dans `mapping.application`, des providers de test fake/fault et une task Gradle `offlineMappingEval042a2` pour executer les 17 cas sans reseau, avec rapport `CANDIDATE_EVAL / NOT_GOLDEN / NOT_AUTHORITATIVE / NOT_MODEL_QUALITY`, sans provider reel, endpoint, OpenAPI, DB/migration, contrat public, secret, `.env`, production ou spec `043`.
- `030d runtime` provider reel general reste reporte hors pilote `042` : aucun provider IA reel, modele reel, SDK, prompt runtime actif, cout provider, appel reseau IA, microservice IA, GraphQL, RAG/vector store ou auto-apply ne sont actifs tant que les gates pre-code de `042` ne sont pas signes et qu'une implementation explicite n'est pas lancee. Le gate d'activation reseau provider reste distinct : aucun appel provider n'est autorise avant gate d'activation signe, meme apres une future implementation `042b`.
- `042b` reste bloque tant que les gates pre-code `042a` ne sont pas signes et merges, tant que provider/modele/region/retention/training/cout/latence/quotas restent `NON_DÉTERMINÉ`, tant que la semantic readiness `042a2a1` et le manifeste de perimetre pilote ne sont pas approuves, tant que le golden set approuve et le validator de sortie contractuelle ne sont pas crees et verts dans une mission separee, et tant que le contrat `mapping-suggestion-v1` ou une future version contractuelle n'a pas de decision explicite pour representer ou exclure les outcomes, reason codes et etats de degradation. Les artefacts candidats `042a2a2a`, le pack de cas candidats `042a2` et le pack de double revue aveugle `042a2` ne debloquent ni contrat ni runtime.
- `036-local-integrated-demo-real-backend-seed-v1` est livre : 036a a livre une commande backend de seed demo dev-only PostgreSQL local, default off, fail-fast hors `local`/`test`/`dbtest`, sans secret commite, sans donnees client reelles, sans bypass auth, sans IA runtime, sans GraphQL et sans Docker impose ; 036b a livre un smoke backend `dbIntegrationTest` de vraie validation JWT sur `/api/me` et tenant membership ; 036c a livre un proxy Vite dev-only `/api` vers backend local avec injection bearer optionnelle strictement cote serveur Vite et shell local, sans token navigateur, sans backend runtime durable et sans auth frontend durable. Aucun endpoint de mint token, aucune commande JWT, aucun backend runtime durable supplementaire, aucun OpenAPI, aucune migration DB, aucune IA runtime et aucun GraphQL ne sont ajoutes par la cloture 036.
- `040-internal-poc-global-smoke-v1` est cloturee en verdict `PARTIEL` : dossier demo ouvert, frontend `/api/me` via proxy `200`, backend `/api/me` direct sans JWT `401`, cockpit/import/suggestions/previews/export/annexe globalement atteignables, aucun token ni secret observe, mais parcours non comprehensible en 10 minutes, statut cockpit insuffisamment clair, mapping trop dense, rubriques Preuves trop anglo-techniques, montants Import trop bruts, libelles techniques residuels, header `Authorization` non verifie explicitement, absence IA runtime non verifiee explicitement et health backend direct non prouve dans ce bloc.
- `041-internal-poc-blockers-ux-readiness-v1` est cloturee en `PASS global` pour readiness POC interne : `041a` a rendu le statut cockpit plus explicite et les montants Import lisibles en CHF ; `041b` a rendu le mapping plus premium, calme, scannable et responsive ; `041c` a rendu les rubriques Justifications / Preuves plus francaises, metier et actionnables ; `041d` a documente l'hygiene reseau, l'absence de fuite bearer observee et l'absence d'appel IA externe observe. Le smoke global final documente backend health `200`, `/api/me` direct sans JWT `401`, `/api/me` via Vite `200`, parcours compris en moins de 10 minutes, aucune friction majeure restante et produit suffisamment robuste/professionnel pour poursuivre vers le POC. Dettes non bloquantes : accents/typographie encore perfectibles, certaines cibles Mapping encore partiellement anglophones, design premium final encore ameliorable et warning Vite chunk `> 500 kB` non bloquant. Aucun runtime, backend, DB/migration, OpenAPI, auth/JWT/proxy, nouvelle mutation, nouveau endpoint, IA runtime, GraphQL, export officiel, annexe legale finale, promesse CO/statutaire, secret, `.env`, token, credential ou spec `042` n'est introduit par cette cloture documentaire.
- Rappel de sequencing : `041` reste Done / `PASS global`; `042` est la seule spec active; aucune spec `043` n'est ouverte ou creee.
- Rappel de cloture `039` : aucun backend, aucune DB/migration, aucun OpenAPI, aucune auth/JWT/proxy, aucune IA runtime, aucun GraphQL, aucune nouvelle mutation, aucun nouveau seed, aucune nouvelle donnee demo, aucune CI et aucun secret/token/credential/valeur `.env` ne sont ajoutes par cette cloture documentaire. La dette residuelle de jugement global a ete traitee par le smoke `040`, cloture en `PARTIEL`, et les blockers POC sont maintenant cadres par `041`.

### Decisions figees
- Le flux V1 livre est maintenant `closing -> import -> mapping manuel + mapping assiste no-provider -> controls -> financial-summary -> financial-statements-structured -> workpapers -> document-storage-and-evidence-files -> exports-audit-ready -> minimal-annex`.
- Les endpoints canoniques restent sous `/api/closing-folders/...`.
- `controls-v1`, `financial-summary-v1`, `financial-statements-structured-v1` et `minimal-annex-v1` sont des read-models derives, `GET only`, sans persistance de resultat.
- `financial-summary-v1` reste une preview ultra-synthetique, non statutaire, non export final, non conforme a une presentation CO detaillee, et peut rester partielle tant que le closing n'est pas `PREVIEW_READY`.
- `financial-statements-structured-v1` reste une `STRUCTURED_PREVIEW`, avec `isStatutory = false`, sans export final ni presentation CO detaillee complete, et n'expose aucun etat structure hors `PREVIEW_READY`.
- La taxonomie de mapping publiee coexiste desormais en V1 / V2 ; les codes V1 restent legacy et compatibles, `financial-summary-v1` agrege via `summaryBucketCode`, et `financial-statements-structured-v1` structure via `summaryBucketCode` puis `sectionCode` avec fallback legacy explicite quand aucune section detaillee n'existe.
- `workpapers-v1` est la premiere couche de justification persistante du flux V1. Elle s'appuie sur les anchors courants de `financial-statements-structured-v1`, sans recalculer la finance ni persister de resultat financier.
- `workpapers-v1` reste backend-only, REST-only, anchor-driven, tenant-scoped et audit-ready, avec un noyau borne a `workpaper + evidence metadata + maker/checker minimal`.
- `GET /workpapers` expose tous les anchors courants meme sans workpaper persiste, et separe les persistences stale dans `staleWorkpapers[]`.
- `workpapers-v1` ne couvre ni upload binaire, ni signed URLs, ni stockage objet, ni PDF, ni export pack final, ni commentaires threades, ni generation automatique ; `013-exports-audit-ready-v1` ferme ensuite le pack `ZIP` immutable, prive et telecharge backend-only.
- Les lectures `GET` sur `workpapers` n'ecrivent aucun `audit_event`; les lectures sur `ARCHIVED` restent autorisees, et les writes restent bloques si `controls.readiness != READY` ou sur closing `ARCHIVED`.
- `workpapers-v1` depend de `financials::access` pour ses anchors courants et n'introduit aucun couplage direct vers `imports` ou `mapping`.
- `document-storage-and-evidence-files-v1` et `evidence-review-and-verification-v1` etendent `workpapers-v1` sans creer de module transverse et apportent la premiere vraie couche binaire de pieces justificatives puis la premiere verification reviewer first-class sur ces documents.
- `document-storage-and-evidence-files-v1` garde `document` comme objet immutable first-class, sans duplication de `closing_folder_id`, derive via `workpaper`; `workpaper_evidence` reste la surface legacy metadata-only de `010-workpapers-v1`.
- `evidence-review-and-verification-v1` ajoute `document_verification` comme persistant unique `1:1` avec `document`, enrichit les read-models de `documents[]` avec l'etat reviewer et derive un `documentVerificationSummary` par workpaper.
- `document-storage-and-evidence-files-v1` enrichit `GET /workpapers` de facon additive avec `documents[]`, toujours present sur les anchors courants meme vide, et aussi present dans `staleWorkpapers[]`.
- `evidence-review-and-verification-v1` garde toutes les lectures `GET` lisibles sur current, stale et `ARCHIVED` sans `audit_event`, mais borne les writes reviewer document et reviewer workpaper a `controls.readiness = READY`, non `ARCHIVED`, current uniquement.
- `evidence-review-and-verification-v1` garde la decision finale reviewer sur `workpaper`, mais bloque `READY_FOR_REVIEW -> REVIEWED` tant que les documents attaches restent `UNVERIFIED`, sauf quand `documentsCount = 0`.
- `document-storage-and-evidence-files-v1` autorise les lectures sur current, stale et `ARCHIVED`, sans `audit_event` sur les `GET`; seul l'upload reussi ecrit `DOCUMENT.CREATED`.
- `022-frontend-document-upload-only-v1` ferme le premier upload frontend unitaire de document sur `/closing-folders/:closingFolderId`, strictement dans le bloc `Workpapers`, en gardant `GET /workpapers` comme read-model canonique avant et apres succes et en n'ajoutant que `POST /workpapers/{anchorCode}/documents`.
- `023-frontend-document-download-only-v1` ferme le premier download frontend unitaire de document sur `/closing-folders/:closingFolderId`, strictement dans le bloc `Workpapers`, en gardant `GET /workpapers` comme read-model canonique avant le clic, en n'ajoutant que `GET /documents/{documentId}/content`, et sans refresh apres succes ou echec.
- `024-frontend-workpapers-panel-extraction-v1` ferme l'extraction frontend stricte de la surface `Workpapers` dans `WorkpapersPanel`, sans nouvelle route produit, sans nouvel endpoint, sans changement backend ou OpenAPI, et sans reintroduire la logique locale Workpapers dans `router.tsx`.
- `025-frontend-document-verification-decision-only-v1` ferme la decision reviewer document unitaire dans `WorkpapersPanel`, sur les documents current eligibles deja visibles, en ajoutant seulement `POST /documents/{documentId}/verification-decision`, avec refresh local strict de `GET /workpapers` apres succes payload valide, sans decision reviewer workpaper, sans nouveau backend ni contrat OpenAPI.
- `evidence-review-and-verification-v1` ajoute `DOCUMENT.VERIFICATION_UPDATED` pour toute mutation reviewer reussie sur `document`, sans audit sur no-op, lecture, backfill ni creation automatique de la ligne initiale.
- `document-storage-and-evidence-files-v1` persiste les metadata en PostgreSQL, stocke le binaire en object storage prive, et impose un download backend-only sans signed URL publique.
- Le role de `document-storage-and-evidence-files-v1` dans la sequence V1 est de fermer le noyau evidence-first utile avant les couches d'export, d'annexe backend minimale et de mapping assiste no-provider.
- `exports-audit-ready-v1` ajoute le module proprietaire `exports`, une persistance immutable `export_pack`, un `ZIP` strictement deterministe et un replay idempotent durable borne par `export_pack` seul en V1.
- `exports-audit-ready-v1` assemble `controls`, `financial-summary`, `financial-statements-structured`, les current workpapers persistants et leurs documents visibles, sans exposition de `storage_object_key`, sans signed URL publique et sans audit sur les lectures.
- `027-annexe-minimale-v1` livre `GET /api/closing-folders/{closingFolderId}/minimal-annex` comme read-model backend deterministe, tenant-scoped, non statutaire, non persiste, non exporte, sans PDF, sans IA et sans `audit_event` sur `GET`.
- `028-docs-present-realignment-after-027-v1` a ferme une spec `DOCS_ONLY` de realignement documentaire cible du present UX/IA apres `027`, sans creation de capacite produit, sans changement runtime, sans rouverture de `027` et sans ouverture d'une spec produit suivante.
- `029-pilot-closing-workflow-e2e-confidence-hardening-v1` livre la vague frontend E2E pilote : dossier progress summary, audit-ready export pack UI, minimal annex preview UI et reviewer workpaper decision UI.
- `029a` rend l'etat global du dossier plus lisible depuis l'interface, sans validation automatique du closing.
- `029b` expose l'audit-ready export pack depuis l'interface avec creation/liste/telechargement backend-only, sans `storage_object_key`, sans signed URL publique et sans promesse de depot statutaire.
- `029c` expose la minimal annex preview en lecture seule avec posture non statutaire et revue humaine requise ; elle ne devient pas une annexe legale finale.
- `029d` expose la decision reviewer workpaper humaine via les gates existants ; elle ne constitue pas une approbation statutaire.
- `029` ne change pas la posture d'architecture : REST-first maintenu, aucun GraphQL, aucun backend nouveau a creer, aucune migration DB, aucun microservice IA et aucun contrat OpenAPI modifie par cette cloture.
- `029` ne change pas la posture IA : AI-ready, pas AI-led ; aucune IA runtime, aucune redaction IA d'annexe et aucune decision automatique.
- `030-ia-mapping-assiste-suggestion-review-v1` livre la premiere capacite de mapping assiste no-provider, evidence-first et human-in-the-loop : suggestions structurees, preuves visibles, decision humaine explicite et mapping manuel comme autorite metier.
- `030a` a stabilise `contracts/ai/mapping-suggestion.schema.json` et `contracts/openapi/mapping-suggestions-api.yaml` avec les noms canoniques `accountCode`, `accountLabel`, `suggestedTargetCode` et les decisions `ACCEPT`, `CORRECT`, `REJECT`.
- `030b` a livre le read-model backend `GET /api/closing-folders/{closingFolderId}/mappings/suggestions` avec adapter stub no-provider et feature flag.
- `030c`, `030d0` et `030d1` ont livre golden set, policy, runbook, provider-readiness record et dependency/security review sans approbation provider.
- `030d2` a durci la minimisation backend : la frontiere `ai::access` recoit un payload minimise avec `sanitizedAccountLabel` interne, tandis que le read-model public expose `accountLabel` depuis la ligne originale tenant-scoped.
- `030e0` et `030e` ont livre l'experience frontend de revue humaine des suggestions, sans appel modele direct ni stockage navigateur de suggestion.
- `030f` a livre `POST /api/closing-folders/{closingFolderId}/mappings/suggestions/{accountCode}/decision` avec `Idempotency-Key`, decisions unitaires et persistance tenant-scopee `mapping_suggestion_decision_request`.
- `ACCEPT` et `CORRECT` passent par la logique metier de mapping manuel existante ; `REJECT` ne cree ni ne modifie aucun mapping manuel.
- Le mapping manuel et le backend restent l'autorite metier. Aucune suggestion ne s'applique seule, aucune decision bulk n'est livree et `requiresHumanReview = true` reste obligatoire.
- Aucune capacite provider IA reelle n'est activee par `030`. `030d runtime` reste bloque par CPO approval, CTO Gate, security/privacy review, IA governance review, provider-readiness record signe, dependency/security review signee, payload whitelist signee, runbook pret et golden set vert.
- `032-controls-readiness-deterministic-consumer-hardening-v1` ferme le hardening frontend du consumer existant `GET /api/closing-folders/{closingFolderId}/controls` : validation fail-closed des payloads `/controls` incoherents, invalides ou contenant des cles sensibles connues, tests unitaires dedies du consumer et realignement des fixtures/tests frontend associes, sans nouvel endpoint, sans nouvelle UI metier visible, sans backend, sans contrat OpenAPI et sans activation IA.
- `033-pilot-core-flow-ui-refresh-consistency-v1` ferme la coherence frontend post-action du parcours pilote coeur : import, mapping manuel et decisions de suggestions no-provider rafraichissent les read-models coeur attendus via `GET` REST existants, avec warnings de refresh partiel, sans backend, DB, OpenAPI, IA runtime, GraphQL, RAG, refresh export/minimal-annex, mutation workpaper/document ou nouvelle promesse CO/statutory.
- `034-pilot-balance-import-history-diff-ui-v1` ferme l'exposition frontend read-only de l'historique des imports balance et du diff N/N-1 via les `GET` REST existants, avec validation fail-closed, etats UI et refresh post-import non bloquant, sans backend, DB, OpenAPI, IA runtime, GraphQL, mutation, refresh export/minimal-annex ni promesse CO/statutory.
- `035-pilot-export-pack-minimal-annex-refresh-ui-v1` ferme le refresh frontend non bloquant de `Minimal annex preview` apres creation reussie d'un `Audit-ready export pack`, sans backend, DB, contrat/OpenAPI, IA runtime, GraphQL, mutation workpaper/document ni promesse CO/statutory.
- `036-local-integrated-demo-real-backend-seed-v1` a livre une demo locale integree avec backend reel, PostgreSQL reel, auth JWT reelle, tenant et membership reels, et donnees demo synthetiques persistees. 036a livre uniquement la commande backend de seed PostgreSQL demo, sans frontend, sans commande JWT, sans endpoint HTTP, sans OpenAPI et sans migration DB. 036b prouve `/api/me` avec vrai bearer signe en `dbIntegrationTest`. 036c ajoute uniquement le proxy frontend Vite dev-only pour consommer `/api` via backend local, avec bearer conserve dans le shell local Node/Vite et jamais dans le navigateur.
- `037-local-integrated-demo-manual-business-smoke-v1` cloture le smoke manuel local observe par l'utilisateur en PASS technique : health backend direct `200`, `/api/me` backend sans JWT `401`, `/api/me` via proxy Vite avec JWT local `200`, tenant demo synthetique `ritomer-demo-036a` / `Ritomer Demo Fiduciaire SA`, role `ACCOUNTANT`, dossier `Demo Closing FY2025` visible et ouvrable, surfaces principales visibles, mauvais tenant rejete `403`, sans `Authorization` visible dans les Request Headers navigateur et sans token observe dans navigateur, URL, storage ou repo. La cloture ne livre aucun code runtime, aucun test, aucun contrat, aucune migration, aucune IA runtime, aucun GraphQL, aucun RAG, aucun provider, aucun secret et aucune spec suivante. Dette residuelle : UX fonctionnelle mais trop lineaire, trop longue, trop technique et pas encore POC/premium.
- `038-local-demo-closing-workbench-ux-cockpit-v1` est livre : PR #61 et PR #62 sont mergees et l'increment frontend transforme le dossier demo local en cockpit de closing intermediaire avec structure workbench/panneaux, synthese haut de page, chemin closing visible, tenant, dossier, statut, prochaine action, blockers et progression visibles, wording metier ameliore, mapping observe sans chevauchement bouton/contenu et sans scroll horizontal sauvage observe lors du smoke visuel utilisateur. Les checks frontend sont passes. Verdict CPO : `PASS 038` comme cockpit intermediaire, pas encore POC premium final. Dette residuelle a traiter dans une future spec : polish data-heavy, lisibilite detaillee et design premium approfondi.
- `039-local-demo-data-heavy-ux-polish-v1` est cloturee apres livraison des sous-livrables `039a`, `039b`, `039c`, `039d` et `039e` : `039a` / `039b` rendent Import + Mapping plus scannables, tabulaires et lisibles ; `039c` nettoie les suggestions IA no-provider sans IA reelle ; `039d` rend Justifications / Preuves plus metier et actionnables ; `039e` rend Previsualisations / Export / Annexe minimale plus prudents, non statutaires et orientes revue humaine. Les checks frontend sont passes dans les PR d'implementation et un smoke visuel utilisateur a ete effectue sur les surfaces UX cles.
- Les lectures sur `ARCHIVED` restent autorisees si le tenant et le RBAC sont valides.
- Les lectures `GET` sur `controls`, `financial-summary`, `financial-statements-structured`, `workpapers` et `minimal-annex` n'ecrivent aucun `audit_event`.
- Les tests PostgreSQL reels restent opt-in via `dbIntegrationTest`, sans Docker local requis.

### Validation PostgreSQL reelle locale
- La recette validee passe par `cloud-sql-proxy` et `dbIntegrationTest`.
- Reference d'execution : `runbooks/local-dev.md`.
