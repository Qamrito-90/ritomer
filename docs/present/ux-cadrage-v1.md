# UX Cadrage V1

## Role du document

Ce document est la synthese canonique de la verite UX du present pour la V1 executable.

Il ne remplace ni la vision UX, ni le playbook UX, ni la source de verite UI. Il fixe ce qui est vrai maintenant pour le produit reellement livre ou deja fige dans le repo vivant.

## Ce qui est vrai maintenant

- La V1 reste orientee workbench de closing, pas SaaS generique.
- Le flux reel deja fige dans le repo est : `closing -> import -> mapping -> controls -> financial-summary -> financial-statements-structured -> workpapers -> document-storage-and-evidence-files -> exports-audit-ready`.
- Le present UX inclut maintenant un frontend borne sur `/` et `/closing-folders/:closingFolderId`, avec entree dossiers, detail dossier, import balance CSV borne, mapping manuel unitaire borne, cockpit controls/readiness read-only, preview `Financial summary` read-only, preview `Financial statements structured` read-only et bloc `Workpapers` avec maker update unitaire borne sur les items courants puis upload document unitaire borne sur les current items avec workpaper persistant.
- Au-dela de ces surfaces bornees, la V1 reste backend-first dans son execution ; la verite UX du present couvre les capacites closes jusqu'a `022`.
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

## Ce qui est explicitement hors scope maintenant

- un frontend riche complet livre comme verite principale du produit
- une interface conversationnelle comme point d'entree primaire
- GraphQL
- une experience mobile profonde ou mobile-first
- une surface frontend riche de pilotage d'export audit-ready
- l'annexe minimale
- une IA active au centre de l'experience courante
- les commentaires threades, la generation automatique et les signed URLs publiques pour les documents

## Decisions non negociables du present

- La clarte prime sur la sophistication.
- Les surfaces du present doivent refleter un workflow deterministe et explicite.
- Le contexte tenant et dossier doit rester visible sur les ecrans sensibles.
- Les statuts et niveaux de preparation doivent etre lisibles sans inferer un comportement cache.
- Les previews financieres ne doivent jamais etre presentees comme des etats statutaires ou des exports finaux.
- Les pieces justificatives sont evidence-first, audit-ready et rattachees a des anchors ou workpapers explicites.
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

## Note de precedence

En cas d'ecart, le markdown canonique du repo prime sur le Word de reference.
