# UX Cadrage V1

## Role du document

Ce document est la synthese canonique de la verite UX du present pour la V1 executable.

Il ne remplace ni la vision UX, ni le playbook UX, ni la source de verite UI. Il fixe ce qui est vrai maintenant pour le produit reellement livre ou deja fige dans le repo vivant.

## Ce qui est vrai maintenant

- La V1 reste orientee workbench de closing, pas SaaS generique.
- Le flux reel deja fige dans le repo est : `closing -> import -> mapping -> controls -> financial-summary -> financial-statements-structured -> workpapers -> document-storage-and-evidence-files -> exports-audit-ready -> minimal-annex`.
- Le present UX inclut maintenant un frontend borne sur `/` et `/closing-folders/:closingFolderId`, avec entree dossiers, detail dossier, import balance CSV borne, mapping manuel unitaire borne, cockpit controls/readiness read-only, dossier progress summary, preview `Financial summary` read-only, preview `Financial statements structured` read-only et bloc `Workpapers` avec maker update unitaire borne sur les items courants, upload document unitaire borne sur les current items avec workpaper persistant, download document unitaire explicite sur les documents deja visibles, frontiere dediee `WorkpapersPanel`, decision reviewer document unitaire sur les documents current eligibles deja visibles, decision reviewer workpaper humaine sur les anchors eligibles, audit-ready export pack UI et minimal annex preview read-only.
- Les surfaces UX visibles/frontend du present sont closes jusqu'a `029`, avec `026` comme decompression frontend sans changement visible et `029` comme vague de confiance E2E pilote.
- La V1 reste bornee : les surfaces frontend 029 exposent des capacites existantes, mais ne transforment ni les previews financieres, ni l'audit-ready export pack, ni la minimal annex preview en livrables statutaires finaux.
- La V1 reste progressive, desktop-first, AI-ready et non AI-led ; les surfaces 029 ameliorent le pilotage humain sans rendre l'IA centrale dans l'experience courante.
- La source de verite UI codable reste `docs/ui/ui-foundations-v1.md`.
- Le produit doit rester clair sous pression : contexte tenant, dossier, statut, blockers, next action et preuves doivent etre explicites.
- Les lectures sur `ARCHIVED` restent autorisees sur les surfaces closes qui le prevoient ; les writes restent bloques quand le workflow le demande.
- `controls-v1` est la premiere lecture de readiness du closing : pret, bloque, prochaine action.
- `financial-summary-v1` est une preview ultra-synthetique, non statutaire, non export final.
- `financial-statements-structured-v1` est une `STRUCTURED_PREVIEW`, non statutaire, disponible seulement en `PREVIEW_READY`.
- `workpapers-v1` apporte une couche de justification persistante anchor-driven avec maker/checker minimal.
- `document-storage-and-evidence-files-v1` ajoute de vraies pieces justificatives immutables, stockees en prive, visibles dans le cockpit et telechargees backend-only.
- `evidence-review-and-verification-v1` ajoute une verification reviewer par document, un resume derive par workpaper, et un gate evidence-aware avant `REVIEWED`.
- `exports-audit-ready-v1` ajoute un pack `ZIP` immutable, prive, idempotent et telecharge backend-only pour handoff audit-ready du closing.
- `029-pilot-closing-workflow-e2e-confidence-hardening-v1` livre les surfaces frontend durables de pilotage E2E : dossier progress summary, audit-ready export pack UI, minimal annex preview UI et reviewer workpaper decision UI.
- `minimal-annex-v1` est maintenant visible en frontend comme minimal annex preview non statutaire, read-only et preparee pour revue humaine ; elle ne devient pas une annexe legale finale.

## Ce qui est explicitement hors scope maintenant

Deja livre en frontend read-only ou controle :

- dossier progress summary
- workpaper reviewer decision UI
- audit-ready export pack UI
- minimal annex preview UI

Toujours hors scope maintenant :

- un frontend riche complet livre comme verite principale du produit
- une interface conversationnelle comme point d'entree primaire
- GraphQL
- une experience mobile profonde ou mobile-first
- un workflow compliance complet
- un acces auditeur externe complet
- un statutory filing ou un livrable CO final depuis les surfaces 029
- une annexe legale finale ou une presentation CO complete
- des comptes annuels statutaires finaux
- des exports finalises ou statutaires
- un PDF/ZIP final CO deliverable
- une approbation statutaire derivee d'une decision reviewer workpaper
- une IA active au centre de l'experience courante
- une IA runtime
- les commentaires threades, la generation automatique et les signed URLs publiques pour les documents

## Decisions non negociables du present

- La clarte prime sur la sophistication.
- Les surfaces du present doivent refleter un workflow deterministe et explicite.
- Le contexte tenant et dossier doit rester visible sur les ecrans sensibles.
- Les statuts et niveaux de preparation doivent etre lisibles sans inferer un comportement cache.
- Les previews financieres ne doivent jamais etre presentees comme des etats statutaires ou des exports finaux.
- Les pieces justificatives sont evidence-first, audit-ready et rattachees a des anchors ou workpapers explicites.
- L'audit-ready export pack UI doit rester un handoff audit-ready soumis a revue humaine, pas un pack final pret au depot.
- La minimal annex preview doit rester non statutaire, read-only et explicitement preparee pour revue humaine.
- Les surfaces 029 proches d'une decision engageante doivent porter la posture `Prepared for human review` / `Human review required`.
- Quand une ambiguite de finalisation existe, le wording doit rester compatible avec `Not a final CO deliverable` et `Do not use as statutory filing`.
- La decision reviewer workpaper UI reste une decision humaine de workflow, pas une approbation statutaire.
- L'UX du present doit distinguer clairement courant, stale, historique et archive.
- Toute future UI doit rester coherente avec `docs/ui/ui-foundations-v1.md` et avec les contrats reels exposes par le backend.

## Artefacts vivants detailles du repo

- `docs/ui/ui-foundations-v1.md`
- `docs/product/v1-plan.md`
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
- `specs/done/006-controls-v1.md`
- `specs/done/007-financial-summary-v1.md`
- `specs/done/009-financial-statements-structured-v1.md`
- `specs/done/010-workpapers-v1.md`
- `specs/done/011-document-storage-and-evidence-files-v1.md`
- `specs/done/012-evidence-review-and-verification-v1.md`
- `specs/done/013-exports-audit-ready-v1.md`
- `contracts/openapi/controls-api.yaml`
- `contracts/openapi/financial-summary-api.yaml`
- `contracts/openapi/financial-statements-structured-api.yaml`
- `contracts/openapi/workpapers-api.yaml`
- `contracts/openapi/documents-api.yaml`
- `contracts/openapi/exports-api.yaml`

## Regle de maintenance

Mettre a jour ce document seulement si la verite UX du present change reellement, par exemple :

- nouveau jalon de workflow visible par l'utilisateur
- changement durable de statut, de readiness ou de semantique de revue
- nouvelle surface evidence-first qui devient partie du present
- sortie d'un hors-scope devenu reellement actif

Ne pas y recopier les specs ni la prose des Word.

## References Word sources utilisees

- `docs/reference-word/1.4-UX-Cadrage-V1.docx`

Le Word `1.4` est un snapshot de cadrage. Ses hors-scope historiques sur `controls`, `financial-summary`, `financial-statements-structured`, `workpapers`, `document-storage-and-evidence-files`, `evidence-review-and-verification` et `exports-audit-ready` ne sont plus valides dans le present du repo vivant.

Apres `029`, les formulations qui placent strictement hors scope les surfaces frontend d'audit-ready export pack, de minimal annex preview ou de decision reviewer workpaper ne sont plus valides pour le present du repo vivant.

## Note de precedence

En cas d'ecart, le markdown canonique du repo prime sur le Word de reference.
