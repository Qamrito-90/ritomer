# 019 - Frontend financial statements structured preview v1

## Status
Active

## Role de cette spec

Cette spec devient la verite normative de `019`.

Elle borne le plus petit enrichissement frontend metier legitime apres `018` pour permettre a l'utilisateur de consulter, depuis `/closing-folders/:closingFolderId`, une preview structuree read-only des etats financiers issue du backend existant `financial-statements/structured`, sans ouvrir une nouvelle surface produit ni reouvrir les scopes fermes.

`019` ne reouvre ni le backend `financial-statements-structured-v1`, ni `018`, ni les workpapers, ni les documents, ni les exports, ni les versions d'import, ni le diff previous, ni l'IA, ni GraphQL, ni un workflow additionnel.

## Sources de verite

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ai-cadrage-v1.md`
- `docs/product/v1-plan.md`
- `specs/done/009-financial-statements-structured-v1.md`
- `specs/done/018-frontend-financial-summary-preview-v1.md`
- `specs/done/017-frontend-manual-mapping-v1.md`
- `specs/done/016-frontend-import-balance-v1.md`
- `specs/done/014-frontend-controls-readiness-cockpit-v1.md`
- `contracts/openapi/financial-statements-structured-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/financials/api/FinancialStatementsStructuredController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/FinancialStatementsStructuredApiTest.kt`
- `frontend/src/app/router.tsx`
- `frontend/src/lib/api/http.ts`
- `frontend/src/lib/api/me.ts`
- `frontend/src/lib/api/closing-folders.ts`
- `frontend/src/lib/api/controls.ts`
- `frontend/src/lib/api/import-balance.ts`
- `frontend/src/lib/api/manual-mapping.ts`
- `frontend/src/lib/api/financial-summary.ts`
- `docs/ui/ui-foundations-v1.md`

## Decisions fermees

- `019` enrichit uniquement la route existante `/closing-folders/:closingFolderId`.
- `019` ne cree aucune nouvelle route produit.
- `019` ne cree aucun onglet, aucun drawer metier et aucune sous-navigation produit.
- `019` conserve les blocs deja presents sur la route detail :
  - `Dossier courant`
  - `Import balance`
  - `Mapping manuel`
  - `Controles`
  - `Financial summary`
- `019` ajoute un seul nouveau bloc visible : `Financial statements structured`.
- `Financial statements structured` est place strictement apres `Financial summary`.
- `019` reste strictement read-only.
- `019` ajoute uniquement un nouvel appel frontend autorise :
  - `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
- `019` utilise toujours le vrai path backend `/financial-statements/structured`.
- `019` ne consomme aucun autre nouvel endpoint.
- `019` ne consomme jamais :
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous`
  - `GET /api/closing-folders/{closingFolderId}/workpapers`
  - tout endpoint `documents`
  - tout endpoint `exports`
  - tout endpoint IA
- `019` n'introduit aucun nouveau backend si l'endpoint existant suffit.
- `019` n'introduit aucun nouveau contrat OpenAPI.
- `019` n'introduit aucune mutation.
- `019` n'introduit aucun etat global de page additionnel.
- `019` n'introduit aucun refresh global de route ou de page.
- `019` n'introduit aucun workflow `nextAction`.
- `019` n'introduit aucune navigation produit a partir de `nextAction.path`.
- `019` ne consomme pas `nextAction` pour rendre des liens, des boutons, des tabs, des shortcuts ni un workflow produit.
- `019` ne corrige pas les refreshs post-import ou post-mapping deja bornes par `016`, `017` et `018`.
- `019` ne requalifie jamais cette preview structuree comme export final, annexe officielle ou document CO.
- `019` n'introduit aucun CTA vers workpapers, documents, exports, annexe officielle ou livrable statutaire.

## In scope exact

- ajout d'un bloc `Financial statements structured` sur `/closing-folders/:closingFolderId`
- chargement read-only de `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
- validation stricte du sous-ensemble JSON `financial-statements/structured` effectivement consomme par le frontend
- rendu visible et distinct des etats :
  - chargement structured preview
  - `NO_DATA`
  - `BLOCKED`
  - `PREVIEW_READY`
  - `400`
  - `401`
  - `403`
  - `404`
  - `5xx`
  - erreur reseau
  - timeout
  - payload invalide
  - unexpected
- rappel visible exact que la preview structuree est non statutaire
- maintien visible des blocs existants quand `Financial statements structured` echoue
- tests frontend couvrant la sequence reseau, les branches visibles exactes, le payload invalide et l'absence de derive d'endpoint

## Out of scope exact

- toute nouvelle route produit
- toute nouvelle tabulation, drawer metier ou stepper metier
- tout nouveau backend
- tout nouveau contrat OpenAPI
- toute mutation
- GraphQL
- toute IA active
- tout workpaper
- tout document
- tout export
- toute version d'import
- tout diff previous
- tout workflow `nextAction`
- toute transformation de `nextAction.path` en navigation produit
- toute correction des refreshs post-import ou post-mapping existants
- tout CTA vers workpapers, documents, exports, annexe officielle ou livrable statutaire

## Surface exacte de 019

### `/closing-folders/:closingFolderId`

- statut : unique route produit enrichie par `019`
- la route conserve le shell, le breadcrumb, la sidebar, le contexte tenant et le detail dossier deja livres
- la route reste une page simple en flux vertical unique
- aucun onglet, aucune sous-navigation et aucune navigation additionnelle ne sont autorises

### Ordre visible exact une fois le dossier nominal

1. bloc `Dossier courant`
   - inchange par rapport a `004`
2. bloc `Import balance`
   - inchange par rapport a `016`
3. bloc `Mapping manuel`
   - inchange par rapport a `017`
4. bloc `Controles`
   - inchange par rapport a `014`
5. bloc `Financial summary`
   - inchange par rapport a `018`
6. bloc `Financial statements structured`
   - nouveau dans `019`

### Regle de stabilite si `Financial statements structured` est en erreur

- le bloc `Dossier courant` reste visible
- le bloc `Import balance` reste visible
- le bloc `Mapping manuel` reste visible
- le bloc `Controles` reste visible et conserve son propre etat
- le bloc `Financial summary` reste visible et conserve son propre etat
- le bloc `Financial statements structured` reste visible avec un seul panneau d'etat explicite
- aucun rendu partiel de `Bilan structure` ou `Compte de resultat structure` n'est autorise en cas d'erreur de lecture

### Bloc `Financial statements structured`

- titre visible exact : `Financial statements structured`
- sous-titre visible exact : `Preview read-only`
- rappel visible exact dans les seuls etats nominaux `NO_DATA`, `BLOCKED` et `PREVIEW_READY` :
  - `Preview structuree non statutaire. Ne pas utiliser comme export final, annexe officielle ou document CO.`
- le rappel non statutaire n'est pas affiche dans les etats `loading`, `401`, `403`, `404`, `400`, `5xx`, erreur reseau, timeout, payload invalide ou `unexpected`
- sous-blocs autorises en etat nominal :
  - `Etat structured preview`
  - `Bilan structure`
  - `Compte de resultat structure`
- composants autorises :
  - un rappel non statutaire
  - un slot d'etat unique pour les etats d'erreur
  - des listes de metriques read-only
  - des groupes read-only en ordre backend
  - des breakdowns read-only en ordre backend
- composants interdits :
  - bouton d'export
  - bouton workpapers
  - bouton documents
  - bouton exports
  - bouton `Ouvrir les workpapers`
  - bouton `Ouvrir les documents`
  - bouton `Ouvrir les exports`
  - lien issu de `nextAction.path`

## Sequence reseau exacte

### Sequence initiale

1. appeler `GET /api/me` sans `X-Tenant-Id`
2. si `GET /api/me` retourne un contexte exploitable avec `activeTenant != null`, appeler `GET /api/closing-folders/{id}` avec `X-Tenant-Id = activeTenant.tenantId`
3. si le dossier est dans l'etat nominal de `004`, initialiser les slots `Mapping manuel`, `Controles`, `Financial summary` et `Financial statements structured` en chargement
4. emettre en parallele :
   - `GET /api/closing-folders/{closingFolderId}/mappings/manual`
   - `GET /api/closing-folders/{closingFolderId}/controls`
   - `GET /api/closing-folders/{closingFolderId}/financial-summary`
   - `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
5. si `GET /api/me` ou `GET /api/closing-folders/{id}` n'est pas dans l'etat nominal de `004`, aucun appel `/financial-statements/structured` n'est autorise
6. `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` utilise toujours le meme `X-Tenant-Id = activeTenant.tenantId`
7. `019` n'ajoute aucun autre appel reseau au chargement initial

### Interaction avec les blocs deja presents

- `Financial statements structured` ne gate ni le rendu de `Import balance`, ni celui de `Mapping manuel`, ni celui de `Controles`, ni celui de `Financial summary`
- `Financial statements structured` conserve son propre slot d'etat et ne remplace jamais les slots `Controles` ou `Financial summary`
- un echec `Financial statements structured` ne masque jamais les blocs deja presents
- `019` n'introduit aucun etat global de page ; le chargement, l'erreur et l'etat nominal restent portes uniquement par le bloc `Financial statements structured`
- `019` ne declenche aucun refresh global de `GET /api/me`, `GET /api/closing-folders/{id}`, `GET /api/closing-folders/{closingFolderId}/controls`, `GET /api/closing-folders/{closingFolderId}/mappings/manual` ou `GET /api/closing-folders/{closingFolderId}/financial-summary`
- `019` n'ajoute aucun refresh local de `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` apres `POST /api/closing-folders/{closingFolderId}/imports/balance`, `PUT /api/closing-folders/{closingFolderId}/mappings/manual` ou `DELETE /api/closing-folders/{closingFolderId}/mappings/manual`
- hors rechargement complet de la route detail, le bloc `Financial statements structured` conserve donc son dernier rendu charge par la sequence initiale de `019`
- `019` ne modifie pas les sequences de refresh post-mutation deja bornees par `016`, `017` et `018`
- le repo ne prouve aucun refresh post-import ni post-mapping vers `/financial-statements/structured`; `019` n'en introduit donc aucun
- `019` n'ajoute aucun refresh auto vers `workpapers`, `documents`, `exports` ou IA

## Contrat API reel consomme par 019

### Verite unique retenue

`019` ajoute uniquement :

- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`

`019` conserve les endpoints deja livres par `016`, `017` et `018`, sans en ajouter d'autres.

`019` ne consomme jamais :

- `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`
- `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous`
- `GET /api/closing-folders/{closingFolderId}/workpapers`
- tout endpoint `documents`
- tout endpoint `exports`
- tout endpoint IA

### `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`

Preuve repo :

- `contracts/openapi/financial-statements-structured-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/financials/api/FinancialStatementsStructuredController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/FinancialStatementsStructuredApiTest.kt`

Constats observes :

- l'endpoint reel est `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
- l'endpoint exige `X-Tenant-Id`
- `200` reste lisible sur dossier `ARCHIVED`
- `401` signifie authentification requise
- `403` signifie acces tenant / RBAC refuse
- `404` signifie dossier absent ou hors tenant
- `400` reste reserve aux cas internes de header ou path invalides ; dans `019`, tout `400` est traite comme le meme rendu local que `unexpected`, soit `financial statements structured indisponible`
- le backend n'expose jamais de structure partielle ; hors `PREVIEW_READY`, `balanceSheet = null` et `incomeStatement = null`
- les valeurs financieres utiles a `019` sont exposees en strings ou entiers deja derives par le backend ; `019` ne recalcule rien

### Sous-ensemble exact du payload `200` consomme cote frontend

Regle de validation frontend a figer :

- `019` valide uniquement le sous-ensemble ci-dessous ; il ne parse pas le payload `/financial-statements/structured` comme un schema plein incluant des champs ignores
- un body `200` non JSON, illisible ou non objet rend exactement `payload financial statements structured invalide`
- toutes les valeurs string consommees sont rendues brutes telles que livrees par le backend, sans recalcul, sans arrondi local et sans formatage supplementaire
- `019` ne trie pas, ne relabelle pas et ne filtre pas localement les groupes, breakdowns ou totaux du sous-ensemble consomme ; si l'element valide existe dans le payload, il est rendu dans l'ordre backend

- `closingFolderId`
  - requis : oui
  - type attendu : `string` au format UUID
  - rendu UI exact : non rendu en clair ; utilise seulement pour verifier la coherence avec le param route et `closingFolder.id`
  - fallback si absent, non string, non UUID ou incoherent : `payload financial statements structured invalide`
- `statementState`
  - requis : oui
  - type attendu : `string` enum `NO_DATA | BLOCKED | PREVIEW_READY`
  - rendu UI exact :
    - `NO_DATA -> etat structured preview : aucune donnee`
    - `BLOCKED -> etat structured preview : bloquee`
    - `PREVIEW_READY -> etat structured preview : preview prete`
  - fallback si absent, non string ou hors enum : `payload financial statements structured invalide`
- `presentationType`
  - requis : oui
  - type attendu : `string` enum `STRUCTURED_PREVIEW`
  - rendu UI exact : non rendu comme ligne autonome ; valide seulement la nature non statutaire du payload
  - fallback si absent, non string ou valeur differente de `STRUCTURED_PREVIEW` : `payload financial statements structured invalide`
- `isStatutory`
  - requis : oui
  - type attendu : `boolean`
  - rendu UI exact : non rendu comme ligne autonome ; valide seulement la nature non statutaire du payload
  - fallback si absent, non booleen ou valeur differente de `false` : `payload financial statements structured invalide`
- `latestImportVersion`
  - requis : oui
  - type attendu : `integer >= 1 | null`
  - rendu UI exact :
    - entier -> `version d import : <valeur>`
    - `null -> version d import : aucune`
  - fallback si propriete absente, non entier, `<= 0` ou nullabilite incoherente avec `statementState` : `payload financial statements structured invalide`
- `coverage`
  - requis : oui
  - type attendu : `object`
  - rendu UI exact : non rendu comme ligne autonome ; son absence ou son invalidite invalide toutes les lignes `lignes total`, `lignes mappees`, `lignes non mappees`, `part mappee`
  - fallback si absent, `null` ou non objet : `payload financial statements structured invalide`
- `coverage.totalLines`
  - requis : oui
  - type attendu : `integer >= 0`
  - rendu UI exact : `lignes total : <valeur>`
  - fallback si absent, non entier ou negatif : `payload financial statements structured invalide`
- `coverage.mappedLines`
  - requis : oui
  - type attendu : `integer >= 0`
  - rendu UI exact : `lignes mappees : <valeur>`
  - fallback si absent, non entier ou negatif : `payload financial statements structured invalide`
- `coverage.unmappedLines`
  - requis : oui
  - type attendu : `integer >= 0`
  - rendu UI exact : `lignes non mappees : <valeur>`
  - fallback si absent, non entier ou negatif : `payload financial statements structured invalide`
- `coverage.mappedShare`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `part mappee : <valeur>`
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `balanceSheet`
  - requis : oui
  - type attendu : `object | null`
  - rendu UI exact :
    - `NO_DATA | BLOCKED -> aucun sous-bloc Bilan structure`
    - `PREVIEW_READY -> sous-bloc Bilan structure visible`
  - fallback si propriete absente, type invalide ou nullabilite incoherente avec `statementState` : `payload financial statements structured invalide`
- `balanceSheet.groups`
  - requis : oui quand `balanceSheet` est un objet
  - type attendu : `array`
  - rendu UI exact : trois groupes read-only visibles dans l'ordre backend conserve
  - contrainte d'ordre exacte : `BS.ASSET`, `BS.LIABILITY`, `BS.EQUITY`
  - fallback si absent, non tableau, taille differente de `3` ou ordre incoherent : `payload financial statements structured invalide`
- `balanceSheet.groups[].code`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : non rendu comme texte autonome ; utilise pour verifier l'ordre et la coherence de groupe
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `balanceSheet.groups[].label`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : titre du groupe visible tel que livre par le backend
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `balanceSheet.groups[].total`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `total groupe : <valeur>`
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `balanceSheet.groups[].breakdowns`
  - requis : oui
  - type attendu : `array`
  - rendu UI exact : liste read-only des breakdowns en ordre backend conserve ; `[]` rend zero ligne de breakdown sans masquer le groupe ni son total
  - fallback si absent ou non tableau : `payload financial statements structured invalide`
- `balanceSheet.groups[].breakdowns[].code`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : non rendu comme texte autonome ; utilise seulement pour verifier la stabilite du payload
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `balanceSheet.groups[].breakdowns[].label`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : ligne `<label> : <total>`
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `balanceSheet.groups[].breakdowns[].breakdownType`
  - requis : oui
  - type attendu : `string` enum `SECTION | LEGACY_BUCKET_FALLBACK`
  - rendu UI exact : non rendu comme texte autonome ; utilise seulement pour verifier la coherence du breakdown
  - fallback si absent, non string ou hors enum : `payload financial statements structured invalide`
- `balanceSheet.groups[].breakdowns[].total`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : ligne `<label> : <valeur>`
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `balanceSheet.totals`
  - requis : oui quand `balanceSheet` est un objet
  - type attendu : `object`
  - rendu UI exact : liste read-only des totaux du bilan
  - fallback si absent, `null` ou non objet : `payload financial statements structured invalide`
- `balanceSheet.totals.totalAssets`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `total actifs : <valeur>`
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `balanceSheet.totals.totalLiabilities`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `total passifs : <valeur>`
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `balanceSheet.totals.totalEquity`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `total capitaux propres : <valeur>`
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `balanceSheet.totals.currentPeriodResult`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `resultat de la periode : <valeur>`
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `balanceSheet.totals.totalLiabilitiesAndEquity`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `total passifs et capitaux propres : <valeur>`
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `incomeStatement`
  - requis : oui
  - type attendu : `object | null`
  - rendu UI exact :
    - `NO_DATA | BLOCKED -> aucun sous-bloc Compte de resultat structure`
    - `PREVIEW_READY -> sous-bloc Compte de resultat structure visible`
  - fallback si propriete absente, type invalide ou nullabilite incoherente avec `statementState` : `payload financial statements structured invalide`
- `incomeStatement.groups`
  - requis : oui quand `incomeStatement` est un objet
  - type attendu : `array`
  - rendu UI exact : deux groupes read-only visibles dans l'ordre backend conserve
  - contrainte d'ordre exacte : `PL.REVENUE`, `PL.EXPENSE`
  - fallback si absent, non tableau, taille differente de `2` ou ordre incoherent : `payload financial statements structured invalide`
- `incomeStatement.groups[].code`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : non rendu comme texte autonome ; utilise pour verifier l'ordre et la coherence de groupe
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `incomeStatement.groups[].label`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : titre du groupe visible tel que livre par le backend
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `incomeStatement.groups[].total`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `total groupe : <valeur>`
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `incomeStatement.groups[].breakdowns`
  - requis : oui
  - type attendu : `array`
  - rendu UI exact : liste read-only des breakdowns en ordre backend conserve ; `[]` rend zero ligne de breakdown sans masquer le groupe ni son total
  - fallback si absent ou non tableau : `payload financial statements structured invalide`
- `incomeStatement.groups[].breakdowns[].code`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : non rendu comme texte autonome ; utilise seulement pour verifier la stabilite du payload
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `incomeStatement.groups[].breakdowns[].label`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : ligne `<label> : <valeur>`
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `incomeStatement.groups[].breakdowns[].breakdownType`
  - requis : oui
  - type attendu : `string` enum `SECTION | LEGACY_BUCKET_FALLBACK`
  - rendu UI exact : non rendu comme texte autonome ; utilise seulement pour verifier la coherence du breakdown
  - fallback si absent, non string ou hors enum : `payload financial statements structured invalide`
- `incomeStatement.groups[].breakdowns[].total`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : ligne `<label> : <valeur>`
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `incomeStatement.totals`
  - requis : oui quand `incomeStatement` est un objet
  - type attendu : `object`
  - rendu UI exact : liste read-only des totaux du compte de resultat
  - fallback si absent, `null` ou non objet : `payload financial statements structured invalide`
- `incomeStatement.totals.totalRevenue`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `total produits : <valeur>`
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `incomeStatement.totals.totalExpenses`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `total charges : <valeur>`
  - fallback si absent ou non string : `payload financial statements structured invalide`
- `incomeStatement.totals.netResult`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `resultat net : <valeur>`
  - fallback si absent ou non string : `payload financial statements structured invalide`

### Regles de coherence exactes du payload `200`

- `payload.closingFolderId == param route closingFolderId == closingFolder.id`
- `presentationType == STRUCTURED_PREVIEW`
- `isStatutory == false`
- `statementState = NO_DATA` impose :
  - `latestImportVersion == null`
  - `balanceSheet == null`
  - `incomeStatement == null`
  - `coverage.totalLines == 0`
  - `coverage.mappedLines == 0`
  - `coverage.unmappedLines == 0`
  - `coverage.mappedShare == "0"`
- `statementState = BLOCKED` impose :
  - `latestImportVersion != null`
  - `balanceSheet == null`
  - `incomeStatement == null`
- `statementState = PREVIEW_READY` impose :
  - `latestImportVersion != null`
  - `balanceSheet != null`
  - `incomeStatement != null`
  - `coverage.unmappedLines == 0`
  - `coverage.mappedShare == "1"`
  - `balanceSheet.groups[0].code == "BS.ASSET"`
  - `balanceSheet.groups[1].code == "BS.LIABILITY"`
  - `balanceSheet.groups[2].code == "BS.EQUITY"`
  - `incomeStatement.groups[0].code == "PL.REVENUE"`
  - `incomeStatement.groups[1].code == "PL.EXPENSE"`
- toute violation de coherence rend exactement `payload financial statements structured invalide`

### Champs optionnels consommes par 019

- aucun champ optionnel n'est consomme comme source de rendu
- `latestImportVersion` est un champ requis nullable, pas un champ optionnel
- `balanceSheet` et `incomeStatement` sont des champs requis a nullabilite conditionnelle selon `statementState`, pas des champs optionnels

### Champs explicitement non consommes par 019 sur `/financial-statements/structured`

- `closingFolderStatus`
  - non consomme
  - raison : le statut dossier visible reste celui de `GET /api/closing-folders/{id}`
  - regle : sa valeur n'introduit aucun texte, aucun badge, aucun cas d'erreur et aucun fallback specifique dans `019`
- `readiness`
  - non consomme
  - raison : la readiness continue d'etre portee uniquement par le bloc `Controles`
  - regle : sa valeur n'introduit aucun badge, aucune branche d'erreur et aucun gate de rendu supplementaire dans `019`
- `taxonomyVersion`
  - non consomme
  - raison : `019` ne porte ni taxonomie browseable ni diagnostic technique
  - regle : sa valeur n'introduit aucun texte, aucun cas d'erreur et aucun fallback specifique dans `019`
- `blockers`
  - non consomme
  - raison : les blockers et la prochaine action restent deja portes par le bloc `Controles`
  - regle : ni `blockers[]`, ni `blockers[].code`, ni `blockers[].message` ne sont rendus dans `Financial statements structured`
- `nextAction`
  - non consomme
  - raison : `019` ne porte aucun workflow additionnel
  - regle : ni `nextAction.code`, ni `nextAction.path`, ni `nextAction.actionable` ne pilotent de rendu, de validation metier additionnelle, de CTA ou de navigation dans `019`
- `nextAction.path`
  - jamais rendu comme lien
  - jamais rendu comme bouton
  - jamais transforme en navigation produit
- les champs explicitement non consommes n'entrent pas dans la classification `payload financial statements structured invalide` tant que le sous-ensemble consomme ci-dessus reste exploitable
- consequence de validation frontend :
  - une valeur incoherente ou absente sur `closingFolderStatus`, `readiness`, `taxonomyVersion`, `blockers`, `nextAction` ou `nextAction.path` ne change ni le texte visible, ni la navigation, ni la classification locale du bloc `Financial statements structured`

## Matrice d'etats exacte du bloc `Financial statements structured`

### Regle generale

- cette matrice s'applique seulement quand la route detail est dans l'etat nominal de `004`
- les blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` restent visibles selon leurs propres specs
- en `loading` ou en erreur, le bloc `Financial statements structured` affiche un seul panneau d'etat local et aucun sous-bloc nominal
- en `NO_DATA`, `BLOCKED` et `PREVIEW_READY`, le bloc `Financial statements structured` n'affiche aucun panneau d'etat local ; il affiche uniquement ses sous-blocs nominaux
- le rappel exact `Preview structuree non statutaire. Ne pas utiliser comme export final, annexe officielle ou document CO.` est visible en `NO_DATA`, `BLOCKED` et `PREVIEW_READY`, et absent des etats `loading` et erreur
- tout resultat non nominal non explicitement borne ci-dessous rend un texte stable et testable ; aucun fallback implicite n'est autorise

### `FINANCIAL_STATEMENTS_STRUCTURED_LOADING`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` est en cours

Rendu exact :

- panneau d'etat unique dans le bloc `Financial statements structured`
- texte exact visible : `chargement structured preview`
- panneau local `Financial statements structured` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_STATEMENTS_STRUCTURED_AUTH_REQUIRED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` retourne `401`

Rendu exact :

- panneau d'etat unique dans le bloc `Financial statements structured`
- texte exact visible : `authentification requise`
- panneau local `Financial statements structured` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_STATEMENTS_STRUCTURED_FORBIDDEN`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` retourne `403`

Rendu exact :

- panneau d'etat unique dans le bloc `Financial statements structured`
- texte exact visible : `acces financial statements structured refuse`
- panneau local `Financial statements structured` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_STATEMENTS_STRUCTURED_NOT_FOUND`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` retourne `404`

Rendu exact :

- panneau d'etat unique dans le bloc `Financial statements structured`
- texte exact visible : `financial statements structured introuvable`
- panneau local `Financial statements structured` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_STATEMENTS_STRUCTURED_SERVER_ERROR`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` retourne `5xx`

Rendu exact :

- panneau d'etat unique dans le bloc `Financial statements structured`
- texte exact visible : `erreur serveur financial statements structured`
- panneau local `Financial statements structured` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_STATEMENTS_STRUCTURED_NETWORK_ERROR`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` echoue pour erreur reseau

Rendu exact :

- panneau d'etat unique dans le bloc `Financial statements structured`
- texte exact visible : `erreur reseau financial statements structured`
- panneau local `Financial statements structured` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_STATEMENTS_STRUCTURED_TIMEOUT`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` echoue par timeout selon la convention de `frontend/src/lib/api/http.ts`

Rendu exact :

- panneau d'etat unique dans le bloc `Financial statements structured`
- texte exact visible : `timeout financial statements structured`
- panneau local `Financial statements structured` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_STATEMENTS_STRUCTURED_INVALID_PAYLOAD`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` retourne `200`
- le payload est invalide, incomplet ou incoherent pour le sous-ensemble exact consomme

Rendu exact :

- panneau d'etat unique dans le bloc `Financial statements structured`
- texte exact visible : `payload financial statements structured invalide`
- panneau local `Financial statements structured` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_STATEMENTS_STRUCTURED_BAD_REQUEST_AS_UNEXPECTED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` retourne `400`

Rendu exact :

- panneau d'etat unique dans le bloc `Financial statements structured`
- texte exact visible : `financial statements structured indisponible`
- panneau local `Financial statements structured` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` visibles : oui
- rappel non statutaire visible : non
- regle : `400` reutilise exactement la meme branche visible que `unexpected` et ne cree aucun workflow, aucun texte et aucun traitement distincts

### `FINANCIAL_STATEMENTS_STRUCTURED_UNEXPECTED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` retourne un statut non nominal non explicitement borne, hors `400`, `401`, `403`, `404` et `5xx`

Rendu exact :

- panneau d'etat unique dans le bloc `Financial statements structured`
- texte exact visible : `financial statements structured indisponible`
- panneau local `Financial statements structured` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_STATEMENTS_STRUCTURED_NO_DATA`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` retourne `200`
- le payload est valide pour le sous-ensemble exact consomme
- `statementState = NO_DATA`

Rendu exact :

- sous-bloc `Etat structured preview`
  - `etat structured preview : aucune donnee`
  - `version d import : aucune`
  - `lignes total : 0`
  - `lignes mappees : 0`
  - `lignes non mappees : 0`
  - `part mappee : 0`
- ligne visible exacte : `aucune preview structuree disponible`
- aucun sous-bloc `Bilan structure`
- aucun sous-bloc `Compte de resultat structure`
- panneau local `Financial statements structured` : non
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` visibles : oui
- rappel non statutaire visible : oui

### `FINANCIAL_STATEMENTS_STRUCTURED_BLOCKED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` retourne `200`
- le payload est valide pour le sous-ensemble exact consomme
- `statementState = BLOCKED`

Rendu exact :

- sous-bloc `Etat structured preview`
  - `etat structured preview : bloquee`
  - `version d import : <valeur>`
  - `lignes total : <valeur>`
  - `lignes mappees : <valeur>`
  - `lignes non mappees : <valeur>`
  - `part mappee : <valeur>`
- ligne visible exacte : `preview structuree bloquee`
- aucun sous-bloc `Bilan structure`
- aucun sous-bloc `Compte de resultat structure`
- panneau local `Financial statements structured` : non
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` visibles : oui
- rappel non statutaire visible : oui

### `FINANCIAL_STATEMENTS_STRUCTURED_PREVIEW_READY`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` retourne `200`
- le payload est valide pour le sous-ensemble exact consomme
- `statementState = PREVIEW_READY`

Rendu exact :

- sous-bloc `Etat structured preview`
  - `etat structured preview : preview prete`
  - `version d import : <valeur>`
  - `lignes total : <valeur>`
  - `lignes mappees : <valeur>`
  - `lignes non mappees : 0`
  - `part mappee : 1`
- sous-bloc `Bilan structure`
  - trois groupes visibles exactement dans l'ordre backend `BS.ASSET`, `BS.LIABILITY`, `BS.EQUITY`
  - aucun tri local additionnel n'est autorise
  - pour chaque groupe :
    - titre visible exact : `<label>`
    - ligne visible exacte : `total groupe : <valeur>`
    - chaque breakdown visible exact : `<label> : <valeur>`
    - si `breakdowns = []`, le groupe reste visible avec son titre et `total groupe : <valeur>`, sans placeholder additionnel
  - totaux visibles exacts :
    - `total actifs : <valeur>`
    - `total passifs : <valeur>`
    - `total capitaux propres : <valeur>`
    - `resultat de la periode : <valeur>`
    - `total passifs et capitaux propres : <valeur>`
  - aucune ligne de groupe, de breakdown ou de total n'est masquee parce que sa valeur est `0`
- sous-bloc `Compte de resultat structure`
  - deux groupes visibles exactement dans l'ordre backend `PL.REVENUE`, `PL.EXPENSE`
  - aucun tri local additionnel n'est autorise
  - pour chaque groupe :
    - titre visible exact : `<label>`
    - ligne visible exacte : `total groupe : <valeur>`
    - chaque breakdown visible exact : `<label> : <valeur>`
    - si `breakdowns = []`, le groupe reste visible avec son titre et `total groupe : <valeur>`, sans placeholder additionnel
  - totaux visibles exacts :
    - `total produits : <valeur>`
    - `total charges : <valeur>`
    - `resultat net : <valeur>`
  - aucune ligne de groupe, de breakdown ou de total n'est masquee parce que sa valeur est `0`
- panneau local `Financial statements structured` : non
- blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` visibles : oui
- rappel non statutaire visible : oui

## Regle metier visible

- texte exact obligatoire dans les etats nominaux `NO_DATA`, `BLOCKED` et `PREVIEW_READY` :
  - `Preview structuree non statutaire. Ne pas utiliser comme export final, annexe officielle ou document CO.`
- ce texte exact n'est pas requis dans les etats `loading` et erreur, qui restent des panneaux locaux mono-message
- interdiction produit explicite :
  - ne jamais presenter cette preview structuree comme un export final
  - ne jamais presenter cette preview structuree comme une annexe officielle
  - ne jamais presenter cette preview structuree comme un document CO
  - ne jamais introduire un CTA vers workpapers, documents ou exports depuis `019`

## Regles de non-derive

- `019` n'ouvre aucune nouvelle route produit
- `019` n'ajoute aucune tabulation produit
- `019` n'appelle jamais `imports/balance/versions`
- `019` n'appelle jamais `diff-previous`
- `019` n'appelle jamais `workpapers`
- `019` n'appelle jamais `documents`
- `019` n'appelle jamais `exports`
- `019` n'appelle jamais d'endpoint IA
- `019` n'ajoute aucun nouveau backend
- `019` n'ajoute aucun nouveau contrat OpenAPI
- `019` n'introduit aucune mutation
- `019` n'introduit aucun etat global de page
- `019` ne declenche aucun refresh global de la route detail
- `019` n'introduit aucun workflow `nextAction`
- `019` n'introduit aucune navigation automatique ou manuelle basee sur `nextAction.path`
- `019` ne corrige pas les refreshs `Financial summary`, `Mapping manuel` ou `Controles` apres import balance ou mutation de mapping

## Criteres d'acceptation frontend

- `specs/active/019-frontend-financial-statements-structured-preview-v1.md` existe
- `/closing-folders/:closingFolderId` reste l'unique route produit enrichie par `019`
- aucune nouvelle route produit n'est introduite
- aucun nouveau backend n'est introduit
- aucun nouveau contrat OpenAPI n'est introduit
- le bloc `Financial statements structured` est place strictement apres `Financial summary`
- les blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` restent visibles quand `Financial statements structured` echoue
- le seul nouvel endpoint consomme par `019` est `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
- l'ensemble total des endpoints route detail autorises apres `019` reste borne a :
  - `GET /api/me`
  - `GET /api/closing-folders/{id}`
  - `GET /api/closing-folders/{closingFolderId}/controls`
  - `GET /api/closing-folders/{closingFolderId}/mappings/manual`
  - `PUT /api/closing-folders/{closingFolderId}/mappings/manual`
  - `DELETE /api/closing-folders/{closingFolderId}/mappings/manual`
  - `POST /api/closing-folders/{closingFolderId}/imports/balance`
  - `GET /api/closing-folders/{closingFolderId}/financial-summary`
  - `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
- aucun endpoint `imports/balance/versions`, `diff-previous`, `workpapers`, `documents`, `exports` ou IA n'est appele
- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` est emis seulement apres succes exploitable de `GET /api/me` puis `GET /api/closing-folders/{id}`
- `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` est emis une seule fois au chargement initial de la route ; `019` n'ajoute aucun retry automatique ni refresh global
- `019` n'ajoute aucun rechargement local de `/financial-statements/structured` apres succes ou echec d'import balance, de `PUT mapping` ou de `DELETE mapping`
- le frontend utilise bien le path `/financial-statements/structured` et n'utilise jamais `/financial-statements-structured`
- aucun appel n'est emis vers `/api/closing-folders/{closingFolderId}/financial-statements-structured`
- le frontend ne consomme du payload `/financial-statements/structured` que le sous-ensemble exact fige dans cette spec
- toute propriete requise absente, invalide ou incoherente du sous-ensemble consomme rend exactement `payload financial statements structured invalide`
- les champs explicitement non consommes de `/financial-statements/structured` ne pilotent ni rendu, ni navigation, ni classification d'erreur dans `019`
- les champs explicitement non consommes de `/financial-statements/structured` peuvent etre ignores meme s'ils sont absents ou mal formes, tant que le sous-ensemble consomme reste exploitable
- `nextAction` et `nextAction.path` ne sont ni rendus comme lien ou bouton, ni lies, ni transformes en navigation produit
- `400` est traite comme le meme rendu visible que `unexpected`, sans nouveau workflow
- le rappel exact `Preview structuree non statutaire. Ne pas utiliser comme export final, annexe officielle ou document CO.` est visible en `NO_DATA`, `BLOCKED` et `PREVIEW_READY`
- aucun CTA workpapers, documents, exports, annexe officielle ou livrable statutaire n'est introduit
- aucun etat global de page n'est introduit par `019` ; le bloc `Financial statements structured` porte seul ses etats loading / erreur / nominal
- en `PREVIEW_READY`, le frontend conserve l'ordre backend des groupes et breakdowns, n'applique aucun tri local et ne masque ni groupe `0` ni groupe a `breakdowns = []`
- les etats visibles exacts sont testables pour :
  - chargement structured preview
  - `NO_DATA`
  - `BLOCKED`
  - `PREVIEW_READY`
  - `400`
  - `401`
  - `403`
  - `404`
  - `5xx`
  - erreur reseau
  - timeout
  - payload invalide
  - unexpected

## Tests frontend requis

- `pnpm test:ci`
- `pnpm lint`
- `pnpm build`
- tests prouvant que le bloc `Financial statements structured` est place strictement apres `Financial summary`
- tests prouvant que `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` n'est emis qu'apres succes exploitable de `GET /api/me` puis `GET /api/closing-folders/{id}`
- tests prouvant que `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` est appele une seule fois au chargement initial et qu'aucun retry automatique ni refresh global supplementaire n'est declenche par `019`
- tests prouvant que les seuls nouveaux appels reseau de `019` passent par `GET /api/closing-folders/{closingFolderId}/financial-statements/structured`
- tests prouvant que le path utilise est exactement `/financial-statements/structured`
- tests prouvant qu'aucun appel n'est emis vers `/api/closing-folders/{closingFolderId}/financial-statements-structured`
- tests prouvant qu'aucun endpoint `imports/balance/versions`, `diff-previous`, `workpapers`, `documents`, `exports`, IA, versions ou diff n'est appele
- tests prouvant qu'aucun `GET /api/closing-folders/{closingFolderId}/financial-statements/structured` additionnel n'est emis apres un `POST imports/balance`, un `PUT mappings/manual` ou un `DELETE mappings/manual`
- tests prouvant que les etats visibles exacts sont rendus pour :
  - `chargement structured preview`
  - `financial statements structured indisponible` sur `400`
  - `authentification requise`
  - `acces financial statements structured refuse`
  - `financial statements structured introuvable`
  - `erreur serveur financial statements structured`
  - `erreur reseau financial statements structured`
  - `timeout financial statements structured`
  - `payload financial statements structured invalide`
  - `financial statements structured indisponible`
  - `aucune preview structuree disponible`
  - `preview structuree bloquee`
  - `etat structured preview : preview prete`
- tests prouvant que le payload invalide couvre au minimum :
  - `closingFolderId` incoherent
  - `presentationType != STRUCTURED_PREVIEW`
  - `isStatutory != false`
  - `statementState = NO_DATA` avec `balanceSheet` ou `incomeStatement` non null
  - `statementState = BLOCKED` avec `latestImportVersion == null`
  - `statementState = PREVIEW_READY` avec `balanceSheet == null`
  - `statementState = PREVIEW_READY` avec `incomeStatement == null`
  - `statementState = PREVIEW_READY` avec `coverage.unmappedLines != 0`
  - `statementState = PREVIEW_READY` avec ordre de groupes bilan incoherent
  - `statementState = PREVIEW_READY` avec ordre de groupes compte de resultat incoherent
  - champ requis absent dans `coverage`
  - champ requis absent dans `balanceSheet.totals`
  - champ requis absent dans `incomeStatement.totals`
  - body `200` non JSON ou illisible
- tests prouvant que les blocs `Dossier courant`, `Import balance`, `Mapping manuel`, `Controles` et `Financial summary` restent visibles quand `Financial statements structured` retourne `401`, `403`, `404`, `5xx`, erreur reseau, timeout ou payload invalide
- tests prouvant que les memes blocs restent visibles quand `Financial statements structured` retourne `400`
- tests prouvant qu'aucun etat global de page n'est introduit et que le bloc `Financial statements structured` porte seul le loading, l'erreur ou le nominal
- tests prouvant que le rappel `Preview structuree non statutaire. Ne pas utiliser comme export final, annexe officielle ou document CO.` est visible en `NO_DATA`, `BLOCKED` et `PREVIEW_READY`
- tests prouvant qu'un payload `PREVIEW_READY` conserve l'ordre backend des groupes et breakdowns, sans tri local
- tests prouvant qu'un groupe avec `breakdowns = []` reste visible avec `total groupe : <valeur>` et sans placeholder additionnel
- tests prouvant qu'un groupe, breakdown ou total a valeur `0` n'est pas masque
- tests prouvant qu'un `nextAction.path` ou un `taxonomyVersion` mal forme n'invalide pas le bloc si le sous-ensemble consomme reste valide
- tests prouvant que `nextAction.path` n'est jamais rendu comme lien, bouton ou navigation produit
- tests prouvant qu'aucun CTA workpapers, documents ou exports n'est introduit
