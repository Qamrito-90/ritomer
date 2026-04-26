# 027 - Annexe minimale V1

## Status
Active

## Phase
HARDENING

## Risk
C

`027` cadre une future implementation a risque `C`, meme si cette mission de cadrage est `DOCS_ONLY`, car l'implementation touchera des donnees financieres, du tenant scope, du RBAC, des preuves, des workpapers, des exports et des regles metier de closing.

## Role de cette spec

Transformer le plan `Annexe minimale` en une spec executable, petite, testable et bornee.

L'annexe minimale V1 est un livrable operationnel non statutaire. Elle aide une fiduciaire a relire le dossier de closing, les previews financieres, les workpapers et les preuves disponibles. Elle ne remplace pas une annexe officielle CO, ne constitue pas une validation comptable automatique et exige une revue humaine avant tout usage engageant.

## Sources de verite relues

- `AGENTS.md`
- `docs/product/documentation-governance.md`
- `docs/product/v1-plan.md`
- `RISK_REGISTER.md`
- `TESTING_STRATEGY.md`
- `CODE_REVIEW.md`
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
- `specs/done/009-financial-statements-structured-v1.md`
- `specs/done/010-workpapers-v1.md`
- `specs/done/011-document-storage-and-evidence-files-v1.md`
- `specs/done/012-evidence-review-and-verification-v1.md`
- `specs/done/013-exports-audit-ready-v1.md`
- `specs/done/026-frontend-workpapers-panel-decomposition-v1.md`
- `contracts/openapi/exports-api.yaml`
- `contracts/openapi/financial-statements-structured-api.yaml`
- `contracts/openapi/financial-summary-api.yaml`
- `contracts/openapi/workpapers-api.yaml`
- `contracts/openapi/documents-api.yaml`

## Decision de premier slice

Le premier slice futur de `027` est choisi et n'est pas une option ouverte :

- read-model backend deterministe
- REST-first
- `GET` only
- tenant-scoped
- non persiste
- non exporte
- non statutaire
- sans generation IA
- sans PDF
- sans UI riche dans ce slice
- exposable plus tard a une UI ou a un export dedie par une autre spec

Le chemin canonique cible pour l'implementation future est :

- `GET /api/closing-folders/{closingFolderId}/minimal-annex`

Cette mission documentaire ne cree pas le contrat OpenAPI. Le contrat devra etre ajoute seulement pendant la future implementation du read-model, dans une PR qui touche explicitement `contracts/openapi/*`.

## Decisions produit figees

- L'annexe minimale V1 est un livrable operationnel non statutaire.
- Elle ne remplace pas une annexe officielle CO.
- Elle ne produit aucun PDF CO definitif.
- Elle ne valide pas automatiquement un acte comptable, reglementaire ou financier.
- Elle doit toujours exposer `isStatutory = false`.
- Elle doit toujours exposer `requiresHumanReview = true`.
- Elle doit porter un wording visible de prudence avant toute utilisation engageante.
- Elle ne redige pas de texte generatif.
- Elle n'ecrit aucune sortie IA en base.
- Elle ne modifie aucun export pack existant.
- Elle ne cree pas de nouveau snapshot durable en V1.

## Forme du read-model cible

Le read-model cible reste conceptuel dans cette spec tant que le contrat OpenAPI n'est pas cree.

Top-level minimal attendu :

- `closingFolderId`
- `closingFolderStatus`
- `readiness`
- `annexState = BLOCKED | READY`
- `presentationType = MINIMAL_OPERATIONAL_ANNEX`
- `isStatutory = false`
- `requiresHumanReview = true`
- `legalNotice`
- `basis`
- `blockers[]`
- `warnings[]`
- `annex`

Regles :

- `annex = null` quand `annexState = BLOCKED`.
- `annex != null` uniquement quand tous les gates bloquants sont satisfaits.
- Le read-model est derive au moment de la requete.
- Aucun resultat d'annexe n'est persiste.
- Aucune lecture `GET` n'ecrit d'`audit_event`.
- Les lectures sur closing `ARCHIVED` restent autorisees si tenant, RBAC et donnees sources sont valides.

## Wording obligatoire de prudence

Le wording exact pourra etre ajuste par la future PR UI/contrat, mais les idees suivantes sont obligatoires et testables :

- "Annexe minimale operationnelle, non statutaire."
- "Ne remplace pas une annexe officielle CO."
- "Aucune validation comptable automatique n'est effectuee."
- "Revue humaine requise avant tout usage engageant."

Le read-model ne doit jamais contenir de libelle qui presente cette annexe comme officielle, statutaire, definitive, signee ou conforme CO.

## Sources de donnees autorisees

Le read-model cible derive uniquement de sources deja presentes :

- closing folder resolu tenant-safe
- `controls::access` pour `readiness`, blockers et next action
- `financials::access` pour `financial-statements-structured` en `PREVIEW_READY`
- `workpapers::access` pour les current workpapers, `staleWorkpapers[]`, `documents[]` et `documentVerificationSummary`
- `exports` pour les metadata d'un export pack existant, sans lire ni modifier son contenu binaire

Sources interdites :

- appel HTTP interne entre modules
- repository direct cross-module
- lecture directe d'un `storage_object_key`
- contenu binaire de document ou d'export pack dans ce premier slice
- modele IA ou prompt IA
- saisie texte libre generee automatiquement

## Blocs minimaux attendus

| Bloc | Source de donnees | Obligatoire | Etat vide | Condition de blocage | Wording de prudence si incomplet |
|---|---|---:|---|---|---|
| Notice non statutaire | Constante produit + closing folder | Oui | Interdit | Tenant/RBAC invalide ou closing absent | Toujours afficher que l'annexe est operationnelle, non statutaire et revue humaine requise. |
| Base de preparation | Closing folder + controls + financial statements structured + export pack metadata | Oui | Interdit | Export pack absent, basis import/taxonomy incoherents, financial statements structured absent | Indiquer que la base de preparation est incomplete et que l'annexe ne doit pas etre utilisee. |
| Synthese financiere structuree | `financial-statements-structured` en `PREVIEW_READY` | Oui | Interdit | `statementState != PREVIEW_READY`, `isStatutory != false`, bilan ou compte de resultat absent | Indiquer que les montants viennent d'une preview structuree non statutaire. |
| Couverture workpapers | `workpapers.items[]` courants | Oui | Interdit si des anchors courants existent | Current anchor sans workpaper persiste, workpaper non `REVIEWED`, aucun anchor courant exploitable | Indiquer que des notes de travail manquent ou ne sont pas revues. |
| Preuves documentaires | `documents[]` et `documentVerificationSummary` des current workpapers | Oui | Autorise si `documentsCount = 0` | Document `UNVERIFIED` dans un current workpaper inclus | Si aucun document n'est rattache, indiquer qu'aucune piece jointe verifiee n'appuie ce bloc. |
| Workpapers stale | `staleWorkpapers[]` | Oui | Autorise si vide | Non bloquant par lui-meme ; bloquant seulement si un anchor courant n'a pas de workpaper courant | Indiquer que les workpapers stale sont historiques, lus separement et exclus de l'annexe. |
| Export pack de reference | dernier export pack accessible du closing folder | Oui | Interdit | Aucun export pack existant ou basis mismatch avec la preview courante | Indiquer que l'annexe operationnelle n'est pas rattachee a un pack audit-ready coherent. |
| Limites et revue humaine | Constante produit + blockers/warnings derives | Oui | Interdit | Aucune condition propre | Toujours rappeler qu'une revue humaine reste obligatoire. |

## Gates et erreurs

### Semantique generale

- Les erreurs d'entree, d'authentification, d'autorisation et de tenant retournent des erreurs HTTP classiques.
- Les gates metier previsibles d'un `GET` retournent `200` avec `annexState = BLOCKED`, `annex = null` et un `blockers[]` testable.
- Les lectures valides et completes retournent `200` avec `annexState = READY`.
- Aucun gate metier ne doit produire une annexe partielle presentee comme utilisable.
- Aucun refus, echec ou `GET` ne doit ecrire d'`audit_event`.

### Matrice des gates

| Situation | Semantique cible | Code testable | Effet |
|---|---|---|---|
| `X-Tenant-Id` absent, vide ou mal forme | `400` | `INVALID_TENANT_HEADER` | Pas de read-model. |
| Utilisateur non authentifie | `401` | `AUTHENTICATION_REQUIRED` | Pas de read-model. |
| Tenant inaccessible, membership inactive, tenant inactive ou role insuffisant | `403` | `TENANT_OR_ROLE_FORBIDDEN` | Pas de read-model. |
| Closing absent ou hors tenant | `404` | `CLOSING_FOLDER_NOT_FOUND` | Pas de read-model, aucune fuite cross-tenant. |
| Closing non pret (`controls.readiness != READY`) | `200 BLOCKED` | `CLOSING_NOT_READY` | `annex = null`, blockers/next action derives de controls. |
| Financial statements structured absent | `200 BLOCKED` | `STRUCTURED_FINANCIAL_STATEMENTS_MISSING` | `annex = null`. |
| Financial statements structured non `PREVIEW_READY` | `200 BLOCKED` | `STRUCTURED_FINANCIAL_STATEMENTS_NOT_PREVIEW_READY` | `annex = null`. |
| Financial statements structured avec `isStatutory != false` | `200 BLOCKED` | `STATUTORY_SOURCE_REJECTED` | `annex = null`, regression bloquante. |
| Current anchor sans workpaper persiste | `200 BLOCKED` | `CURRENT_WORKPAPER_MISSING` | `annex = null`, l'annexe ne masque pas une note manquante. |
| Current workpaper non `REVIEWED` | `200 BLOCKED` | `CURRENT_WORKPAPER_NOT_REVIEWED` | `annex = null`, revue humaine inachevee. |
| `staleWorkpapers[]` non vide avec current replacements complets | `200 READY` avec warning | `STALE_WORKPAPERS_EXCLUDED` | Les stale sont exclus et signales. |
| `staleWorkpapers[]` non vide et current anchor sans remplacement | `200 BLOCKED` | `CURRENT_WORKPAPER_MISSING` | Le probleme est le manque de current workpaper, pas la trace stale seule. |
| Document `UNVERIFIED` sur current workpaper inclus | `200 BLOCKED` | `DOCUMENT_UNVERIFIED` | `annex = null`. |
| Document `REJECTED` sur current workpaper inclus | `200 READY` avec warning si aucun autre gate bloque | `DOCUMENT_REJECTED_INCLUDED_AS_TRACE` | Le document rejete reste une trace explicite, jamais une preuve validee. |
| Aucun document rattache a un current workpaper revu | `200 READY` avec warning | `NO_DOCUMENT_ATTACHED` | L'annexe reste possible mais affiche une prudence explicite. |
| Export pack absent | `200 BLOCKED` | `EXPORT_PACK_MISSING` | `annex = null`. |
| Export pack basis mismatch avec la preview courante | `200 BLOCKED` | `EXPORT_PACK_BASIS_MISMATCH` | `annex = null`, pas de rattachement incoherent. |
| Tentative de demander une annexe officielle/statutaire/CO definitive | `400` | `ANNEX_STATUTORY_CONFUSION_REJECTED` | Rejet explicite, pas de fallback silencieux. |
| Demande de PDF, signed URL ou export storage dans ce slice | `400` | `ANNEX_OUTPUT_FORMAT_OUT_OF_SCOPE` | Rejet explicite. |

## RBAC cible

Lecture autorisee pour :

- `ACCOUNTANT`
- `REVIEWER`
- `MANAGER`
- `ADMIN`

Le premier slice ne cree aucune mutation. Toute future mutation de validation, signature, export ou approbation devra faire l'objet d'une spec separee.

## Architecture cible

- module proprietaire cible pour ce premier slice : `exports`
- le read-model est implante dans `exports`, sans persistance additionnelle et sans modifier les packs existants
- dependances autorisees :
  - `shared::application`
  - `identity::access`
  - `closing::access`
  - `controls::access`
  - coutures explicites cote `financials`
  - `workpapers::access`
  - acces metadata export pack via le module proprietaire `exports`
- aucun acces repository direct cross-module
- aucun appel HTTP interne
- aucun GraphQL
- aucune migration DB dans le premier slice
- aucune modification retroactive des packs existants

## Audit cible

Le premier slice est `GET` only :

- zero `audit_event` sur succes
- zero `audit_event` sur refus metier
- zero `audit_event` sur erreurs d'entree, auth, tenant ou RBAC

Si une future spec introduit une validation, une signature, une generation persistante ou un export d'annexe, elle devra definir un audit append-only dedie.

## In scope futur exact

- contrat OpenAPI dedie pour `GET /api/closing-folders/{closingFolderId}/minimal-annex`
- implementation backend du read-model deterministe
- gates metier ci-dessus
- RBAC lecture ci-dessus
- tests unitaires et API du read-model
- verification Modulith si une couture inter-module est ajoutee ou modifiee
- documentation minimale si le comportement durable change

## Out of scope exact

- annexe officielle ou statutaire
- PDF CO definitif
- PDF tout court dans ce premier slice
- IA generative
- redaction generative d'annexe
- GraphQL
- signed URLs publiques
- exposition de `storage_object_key`
- modification retroactive des export packs existants
- ajout de l'annexe dans un ZIP d'export existant
- validation comptable automatique
- signature ou approbation engageante
- ecriture directe d'une sortie IA en base
- persistance d'un snapshot d'annexe
- migration DB tant que la persistance n'est pas decidee par une spec future
- UI riche ou route frontend dans ce premier slice
- suppression, edition ou versioning de documents, workpapers ou export packs

## Tests et checks attendus

### Checks docs-only de cette PR

- `git status --short --branch`
- `git diff --stat`
- `git diff --check`

Aucun test runtime backend ou frontend ne doit etre lance pour cette mission documentaire.

### Checks backend futurs

- unit tests du calcul `annexState`, `blockers[]`, `warnings[]` et blocs
- API tests auth/header/tenant/RBAC
- API tests `GET` zero audit
- API tests cross-tenant
- API tests `ARCHIVED` lisible quand les sources sont coherentes
- verification Modulith si dependances ou named interfaces sont ajoutees

### Checks contrats futurs

- ajout ou mise a jour de `contracts/openapi/*` pour le read-model
- exemples nominaux, bloques et erreurs
- verification que `isStatutory` est toujours `false`
- verification qu'aucun champ ne suggere officiel, statutaire, PDF CO definitif, signature ou validation automatique

### Checks DB futurs

Pour le premier slice choisi :

- aucun check DB obligatoire
- aucune migration
- aucun `dbIntegrationTest` requis

Si une spec future decide une persistance :

- nouvelle migration Flyway immutable
- `tenant_id` obligatoire
- indexes commencant par `tenant_id`
- contraintes DB pertinentes
- `dbIntegrationTest` avec PostgreSQL explicite

### Checks frontend futurs

Seulement si une spec UI ulterieure expose l'annexe :

- tests d'affichage des blockers
- tests de wording non statutaire
- tests d'absence de CTA officiel/statutaire/PDF definitif
- tests de navigation depuis dossier vers annex read-model sans nouvelle source de verite locale
- lint, tests CI et build frontend selon `TESTING_STRATEGY.md`

## Tests d'acceptation futurs minimaux

### Cas nominal

- tenant valide, role `ACCOUNTANT`, `REVIEWER`, `MANAGER` ou `ADMIN`
- closing lisible
- `controls.readiness = READY`
- financial statements structured en `PREVIEW_READY`
- `isStatutory = false`
- export pack existant avec basis coherent
- tous les current anchors ont un workpaper courant `REVIEWED`
- aucun document `UNVERIFIED`
- reponse `200`, `annexState = READY`, `isStatutory = false`, `requiresHumanReview = true`, blockers vides et annexe presente

### Cas interdits ou erreurs

- tenant header invalide => `400`
- non authentifie => `401`
- role insuffisant => `403`
- closing hors tenant => `404`
- demande statutaire/officielle/PDF definitif => `400 ANNEX_STATUTORY_CONFUSION_REJECTED` ou `ANNEX_OUTPUT_FORMAT_OUT_OF_SCOPE`
- closing non pret => `200 BLOCKED`, `annex = null`
- financial statements structured absent ou non `PREVIEW_READY` => `200 BLOCKED`, `annex = null`
- current workpaper manquant ou non `REVIEWED` => `200 BLOCKED`, `annex = null`
- document `UNVERIFIED` => `200 BLOCKED`, `annex = null`
- export pack absent ou basis mismatch => `200 BLOCKED`, `annex = null`

### Cas limites

- closing `ARCHIVED` avec sources coherentes et RBAC valide reste lisible
- `staleWorkpapers[]` non vide mais current replacements complets => annexe ready avec warning et stale exclus
- current workpaper sans document => annexe ready avec warning de prudence
- document `REJECTED` present avec au moins un document `VERIFIED` et aucun `UNVERIFIED` sur le meme current workpaper => annexe ready avec warning explicite
- mapping legacy fallback dans financial statements structured => annexe ready avec warning de prudence sur la granularite

### Regressions a eviter

- annexe partielle exposee alors qu'un gate bloquant existe
- `isStatutory = true`
- wording qui laisse croire a une annexe officielle CO
- generation IA ou texte libre automatique
- audit event sur un `GET`
- acces cross-tenant
- lecture de `storage_object_key`
- signed URL publique
- mutation de `workpaper`, `document`, `document_verification` ou `export_pack`
- creation de migration pour le premier slice
- ajout de GraphQL

## Criteres d'acceptation de la spec

- `specs/active/027-annexe-minimale-v1.md` existe avec `Status: Active`.
- `docs/product/v1-plan.md` declare `027` comme spec active.
- La spec choisit un seul premier slice : read-model backend deterministe, non persiste, non exporte, non statutaire.
- La spec interdit explicitement annexe officielle/statutaire, PDF CO definitif, IA generative, GraphQL, signed URLs publiques, mutation retroactive d'export packs, validation comptable automatique, ecriture IA directe en base et migration DB tant que la persistance n'est pas decidee.
- La spec definit les blocs minimaux avec sources, obligation, etat vide, conditions de blocage et wording de prudence.
- La spec definit les gates demandes de facon testable.
- La spec distingue les checks docs-only de cette PR et les checks backend, contrats, DB et frontend futurs.
- Le risque futur reste `C`.
