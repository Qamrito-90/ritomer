# 018 - Frontend financial summary preview v1

## Status
Done

## Role de cette spec

Cette spec devient la verite normative de `018`.

Elle borne le plus petit enrichissement frontend metier legitime apres `017` pour permettre a l'utilisateur de consulter, depuis `/closing-folders/:closingFolderId`, une preview financiere synthetique read-only issue du backend existant `financial-summary`, sans ouvrir une nouvelle surface produit ni reouvrir les scopes fermes.

`018` ne reouvre ni le backend `financial-summary`, ni `017`, ni `financial-statements-structured`, ni les workpapers, ni les documents, ni les exports, ni l'IA, ni GraphQL.

## Sources de verite

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ai-cadrage-v1.md`
- `docs/product/v1-plan.md`
- `specs/done/007-financial-summary-v1.md`
- `specs/done/014-frontend-controls-readiness-cockpit-v1.md`
- `specs/done/015-frontend-closing-folders-entrypoint-v1.md`
- `specs/done/016-frontend-import-balance-v1.md`
- `specs/done/017-frontend-manual-mapping-v1.md`
- `contracts/openapi/financial-summary-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/financials/api/FinancialSummaryController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/FinancialSummaryApiTest.kt`
- `frontend/src/app/router.tsx`
- `frontend/src/lib/api/http.ts`
- `frontend/src/lib/api/me.ts`
- `frontend/src/lib/api/closing-folders.ts`
- `frontend/src/lib/api/controls.ts`
- `frontend/src/lib/api/import-balance.ts`
- `frontend/src/lib/api/manual-mapping.ts`
- `docs/ui/ui-foundations-v1.md`

## Decisions fermees

- `018` enrichit uniquement la route existante `/closing-folders/:closingFolderId`.
- `018` ne cree aucune nouvelle route produit.
- `018` ne cree aucun onglet, aucun drawer metier et aucune sous-navigation produit.
- `018` conserve les blocs deja presents sur la route detail :
  - `Dossier courant`
  - `Import balance`
  - `Mapping manuel`
  - `Controles`
- `018` ajoute un seul nouveau bloc visible : `Financial summary`.
- `Financial summary` est place strictement apres `Controles`.
- `018` reste strictement read-only.
- `018` ajoute uniquement un nouvel appel frontend autorise :
  - `GET /api/closing-folders/{closingFolderId}/financial-summary`
- `018` ne consomme aucun autre nouvel endpoint.
- `018` ne consomme jamais :
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`
  - `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous`
  - `GET /api/closing-folders/{closingFolderId}/financial-statements-structured`
  - `GET /api/closing-folders/{closingFolderId}/workpapers`
  - tout endpoint `documents`
  - tout endpoint `exports`
  - tout endpoint IA
- `018` n'introduit aucun nouveau backend si l'endpoint existant suffit.
- `018` n'introduit aucun nouveau contrat OpenAPI.
- `018` n'introduit aucune mutation.
- `018` n'introduit aucun etat global de page additionnel.
- `018` n'introduit aucun refresh global de route ou de page.
- `018` n'introduit aucune navigation produit a partir de `nextAction.path`.
- `018` ne consomme pas `nextAction` pour rendre des liens, des boutons, des tabs, des shortcuts ni un workflow produit.
- `018` ne corrige pas le refresh du bloc `Mapping manuel` apres import balance reussi ; ce point reste explicitement hors scope.
- `018` ne requalifie jamais cette preview comme export final, annexe officielle ou document CO.

## In scope exact

- ajout d'un bloc `Financial summary` sur `/closing-folders/:closingFolderId`
- chargement read-only de `GET /api/closing-folders/{closingFolderId}/financial-summary`
- validation stricte du sous-ensemble JSON `financial-summary` effectivement consomme par le frontend
- rendu visible et distinct des etats :
  - chargement financial summary
  - `NO_DATA`
  - `PREVIEW_PARTIAL`
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
- rappel visible exact que la preview est non statutaire
- maintien visible des blocs existants quand `Financial summary` echoue
- tests frontend couvrant la sequence reseau, les branches visibles exactes, le payload invalide et l'absence de derive d'endpoint

## Out of scope exact

- toute nouvelle route produit
- toute nouvelle tabulation, drawer metier ou stepper metier
- tout nouveau backend
- tout nouveau contrat OpenAPI
- toute mutation
- GraphQL
- toute IA active
- toute ouverture de `financial-statements-structured`
- tout workpaper
- tout document
- tout export
- toute version d'import
- tout diff previous
- tout workflow `nextAction`
- toute transformation de `nextAction.path` en navigation produit
- toute correction du refresh `Mapping manuel` apres import balance

## Surface exacte de 018

### `/closing-folders/:closingFolderId`

- statut : unique route produit enrichie par `018`
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
   - nouveau dans `018`

### Regle de stabilite si `Financial summary` est en erreur

- le bloc `Dossier courant` reste visible
- le bloc `Import balance` reste visible
- le bloc `Mapping manuel` reste visible
- le bloc `Controles` reste visible et conserve son propre etat
- le bloc `Financial summary` reste visible avec un seul panneau d'etat explicite
- aucun rendu partiel de `Bilan synthetique` ou `Compte de resultat synthetique` n'est autorise en cas d'erreur de lecture

### Bloc `Financial summary`

- titre visible exact : `Financial summary`
- sous-titre visible exact : `Preview read-only`
- rappel visible exact dans les seuls etats nominaux `NO_DATA`, `PREVIEW_PARTIAL` et `PREVIEW_READY` :
  - `Preview non statutaire. Ne pas utiliser comme export final, annexe officielle ou document CO.`
- le rappel non statutaire n'est pas affiche dans les etats `loading`, `401`, `403`, `404`, `400`, `5xx`, erreur reseau, timeout, payload invalide ou `unexpected`
- sous-blocs autorises en etat nominal :
  - `Etat preview`
  - `Bilan synthetique`
  - `Compte de resultat synthetique`
- composants autorises :
  - un rappel non statutaire
  - un slot d'etat unique pour les etats d'erreur
  - des listes de metriques read-only
- composants interdits :
  - bouton d'export
  - bouton `Ouvrir la preview structuree`
  - bouton workpapers
  - bouton documents
  - bouton exports
  - lien issu de `nextAction.path`

## Sequence reseau exacte

### Sequence initiale

1. appeler `GET /api/me` sans `X-Tenant-Id`
2. si `GET /api/me` retourne un contexte exploitable avec `activeTenant != null`, appeler `GET /api/closing-folders/{id}` avec `X-Tenant-Id = activeTenant.tenantId`
3. si le dossier est dans l'etat nominal de `004`, initialiser les slots `Mapping manuel`, `Controles` et `Financial summary` en chargement
4. emettre en parallele :
   - `GET /api/closing-folders/{closingFolderId}/mappings/manual`
   - `GET /api/closing-folders/{closingFolderId}/controls`
   - `GET /api/closing-folders/{closingFolderId}/financial-summary`
5. si `GET /api/me` ou `GET /api/closing-folders/{id}` n'est pas dans l'etat nominal de `004`, aucun appel `/financial-summary` n'est autorise
6. `GET /api/closing-folders/{closingFolderId}/financial-summary` utilise toujours le meme `X-Tenant-Id = activeTenant.tenantId`
7. `018` n'ajoute aucun autre appel reseau au chargement initial

### Interaction avec les blocs deja presents

- `Financial summary` ne gate ni le rendu de `Import balance`, ni celui de `Mapping manuel`, ni celui de `Controles`
- `Financial summary` conserve son propre slot d'etat et ne remplace jamais le slot `Controles`
- un echec `Financial summary` ne masque jamais les blocs deja presents
- `018` n'introduit aucun etat global de page ; le chargement, l'erreur et l'etat nominal restent portes uniquement par le bloc `Financial summary`
- `018` ne declenche aucun refresh global de `GET /api/me`, `GET /api/closing-folders/{id}`, `GET /api/closing-folders/{closingFolderId}/controls` ou `GET /api/closing-folders/{closingFolderId}/mappings/manual`
- `018` n'ajoute aucun refresh local de `GET /api/closing-folders/{closingFolderId}/financial-summary` apres `POST /api/closing-folders/{closingFolderId}/imports/balance`, `PUT /api/closing-folders/{closingFolderId}/mappings/manual` ou `DELETE /api/closing-folders/{closingFolderId}/mappings/manual`
- hors rechargement complet de la route detail, le bloc `Financial summary` conserve donc son dernier rendu charge par la sequence initiale de `018`
- `018` ne modifie pas les sequences de refresh post-mutation deja bornees par `016` et `017`
- `018` n'ajoute aucun refresh auto vers `financial-statements-structured`, `workpapers`, `documents`, `exports` ou IA

## Contrat API reel consomme par 018

### Verite unique retenue

`018` ajoute uniquement :

- `GET /api/closing-folders/{closingFolderId}/financial-summary`

`018` conserve les endpoints deja livres par `016` et `017`, sans en ajouter d'autres.

`018` ne consomme jamais :

- `GET /api/closing-folders/{closingFolderId}/imports/balance/versions`
- `GET /api/closing-folders/{closingFolderId}/imports/balance/versions/{version}/diff-previous`
- `GET /api/closing-folders/{closingFolderId}/financial-statements-structured`
- `GET /api/closing-folders/{closingFolderId}/workpapers`
- tout endpoint `documents`
- tout endpoint `exports`
- tout endpoint IA

### `GET /api/closing-folders/{closingFolderId}/financial-summary`

Preuve repo :

- `contracts/openapi/financial-summary-api.yaml`
- `backend/src/main/kotlin/ch/qamwaq/ritomer/financials/api/FinancialSummaryController.kt`
- `backend/src/test/kotlin/ch/qamwaq/ritomer/FinancialSummaryApiTest.kt`

Constats observes :

- l'endpoint reel est `GET /api/closing-folders/{closingFolderId}/financial-summary`
- l'endpoint exige `X-Tenant-Id`
- `200` reste lisible sur dossier `ARCHIVED`
- `401` signifie authentification requise
- `403` signifie acces tenant / RBAC refuse
- `404` signifie dossier absent ou hors tenant
- `400` reste reserve aux cas internes de header ou path invalides ; dans `018`, tout `400` est traite comme le meme rendu local que `unexpected`, soit `financial summary indisponible`
- les valeurs financieres et de couverture utiles a `018` sont exposees en strings ou entiers, deja derives par le backend ; `018` ne recalcule rien

### Sous-ensemble exact du payload `200` consomme cote frontend

Regle de validation frontend a figer :

- `018` valide uniquement le sous-ensemble ci-dessous ; il ne parse pas le payload `/financial-summary` comme un schema plein incluant des champs ignores
- un body `200` non JSON, illisible ou non objet rend exactement `payload financial summary invalide`
- toutes les valeurs string consommees sont rendues brutes telles que livrees par le backend, sans recalcul, sans arrondi local et sans formatage supplementaire

- `closingFolderId`
  - requis : oui
  - type attendu : `string` au format UUID
  - rendu UI exact : non rendu en clair ; utilise seulement pour verifier la coherence avec le param route et `closingFolder.id`
  - fallback si absent, non string, non UUID ou incoherent : `payload financial summary invalide`
- `statementState`
  - requis : oui
  - type attendu : `string` enum `NO_DATA | PREVIEW_PARTIAL | PREVIEW_READY`
  - rendu UI exact :
    - `NO_DATA -> etat preview : aucune donnee`
    - `PREVIEW_PARTIAL -> etat preview : preview partielle`
    - `PREVIEW_READY -> etat preview : preview prete`
  - fallback si absent, non string ou hors enum : `payload financial summary invalide`
- `latestImportVersion`
  - requis : oui
  - type attendu : `integer >= 1 | null`
  - rendu UI exact :
    - entier -> `version d import : <valeur>`
    - `null -> version d import : aucune`
  - fallback si propriete absente, non entier, `<= 0` ou nullabilite incoherente avec `statementState` : `payload financial summary invalide`
- `coverage`
  - requis : oui
  - type attendu : `object`
  - rendu UI exact : non rendu comme ligne autonome ; son absence ou son invalidite invalide toutes les lignes `lignes total`, `lignes mappees`, `lignes non mappees`, `part mappee`
  - fallback si absent, `null` ou non objet : `payload financial summary invalide`
- `coverage.totalLines`
  - requis : oui
  - type attendu : `integer >= 0`
  - rendu UI exact : `lignes total : <valeur>`
  - fallback si absent, non entier ou negatif : `payload financial summary invalide`
- `coverage.mappedLines`
  - requis : oui
  - type attendu : `integer >= 0`
  - rendu UI exact : `lignes mappees : <valeur>`
  - fallback si absent, non entier ou negatif : `payload financial summary invalide`
- `coverage.unmappedLines`
  - requis : oui
  - type attendu : `integer >= 0`
  - rendu UI exact : `lignes non mappees : <valeur>`
  - fallback si absent, non entier ou negatif : `payload financial summary invalide`
- `coverage.mappedShare`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `part mappee : <valeur>`
  - fallback si absent ou non string : `payload financial summary invalide`
- `unmappedBalanceImpact`
  - requis : oui
  - type attendu : `object`
  - rendu UI exact : non rendu comme ligne autonome ; son absence ou son invalidite invalide toutes les lignes `impact non mappe debit`, `impact non mappe credit`, `impact non mappe net`
  - fallback si absent, `null` ou non objet : `payload financial summary invalide`
- `unmappedBalanceImpact.debitTotal`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `impact non mappe debit : <valeur>`
  - fallback si absent ou non string : `payload financial summary invalide`
- `unmappedBalanceImpact.creditTotal`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `impact non mappe credit : <valeur>`
  - fallback si absent ou non string : `payload financial summary invalide`
- `unmappedBalanceImpact.netDebitMinusCredit`
  - requis : oui
  - type attendu : `string`
  - rendu UI exact : `impact non mappe net : <valeur>`
  - fallback si absent ou non string : `payload financial summary invalide`
- `balanceSheetSummary`
  - requis : oui
  - type attendu : `object | null`
  - rendu UI exact :
    - `NO_DATA -> aucun sous-bloc Bilan synthetique`
    - `PREVIEW_PARTIAL | PREVIEW_READY -> sous-bloc Bilan synthetique visible`
  - fallback si propriete absente, type invalide ou nullabilite incoherente avec `statementState` : `payload financial summary invalide`
- `balanceSheetSummary.assets`
  - requis : oui quand `balanceSheetSummary` est un objet
  - type attendu : `string`
  - rendu UI exact : `actifs : <valeur>`
  - fallback si absent ou non string : `payload financial summary invalide`
- `balanceSheetSummary.liabilities`
  - requis : oui quand `balanceSheetSummary` est un objet
  - type attendu : `string`
  - rendu UI exact : `passifs : <valeur>`
  - fallback si absent ou non string : `payload financial summary invalide`
- `balanceSheetSummary.equity`
  - requis : oui quand `balanceSheetSummary` est un objet
  - type attendu : `string`
  - rendu UI exact : `capitaux propres : <valeur>`
  - fallback si absent ou non string : `payload financial summary invalide`
- `balanceSheetSummary.currentPeriodResult`
  - requis : oui quand `balanceSheetSummary` est un objet
  - type attendu : `string`
  - rendu UI exact : `resultat de la periode : <valeur>`
  - fallback si absent ou non string : `payload financial summary invalide`
- `balanceSheetSummary.totalAssets`
  - requis : oui quand `balanceSheetSummary` est un objet
  - type attendu : `string`
  - rendu UI exact : `total actifs : <valeur>`
  - fallback si absent ou non string : `payload financial summary invalide`
- `balanceSheetSummary.totalLiabilitiesAndEquity`
  - requis : oui quand `balanceSheetSummary` est un objet
  - type attendu : `string`
  - rendu UI exact : `total passifs et capitaux propres : <valeur>`
  - fallback si absent ou non string : `payload financial summary invalide`
- `incomeStatementSummary`
  - requis : oui
  - type attendu : `object | null`
  - rendu UI exact :
    - `NO_DATA -> aucun sous-bloc Compte de resultat synthetique`
    - `PREVIEW_PARTIAL | PREVIEW_READY -> sous-bloc Compte de resultat synthetique visible`
  - fallback si propriete absente, type invalide ou nullabilite incoherente avec `statementState` : `payload financial summary invalide`
- `incomeStatementSummary.revenue`
  - requis : oui quand `incomeStatementSummary` est un objet
  - type attendu : `string`
  - rendu UI exact : `produits : <valeur>`
  - fallback si absent ou non string : `payload financial summary invalide`
- `incomeStatementSummary.expenses`
  - requis : oui quand `incomeStatementSummary` est un objet
  - type attendu : `string`
  - rendu UI exact : `charges : <valeur>`
  - fallback si absent ou non string : `payload financial summary invalide`
- `incomeStatementSummary.netResult`
  - requis : oui quand `incomeStatementSummary` est un objet
  - type attendu : `string`
  - rendu UI exact : `resultat net : <valeur>`
  - fallback si absent ou non string : `payload financial summary invalide`

### Regles de coherence exactes du payload `200`

- `closingFolderId == closingFolder.id == closingFolderId`
- `statementState = NO_DATA` impose :
  - `latestImportVersion == null`
  - `balanceSheetSummary == null`
  - `incomeStatementSummary == null`
  - `coverage.totalLines == 0`
  - `coverage.mappedLines == 0`
  - `coverage.unmappedLines == 0`
  - `coverage.mappedShare == "0"`
  - `unmappedBalanceImpact.debitTotal == "0"`
  - `unmappedBalanceImpact.creditTotal == "0"`
  - `unmappedBalanceImpact.netDebitMinusCredit == "0"`
- `statementState = PREVIEW_PARTIAL` impose :
  - `latestImportVersion != null`
  - `balanceSheetSummary != null`
  - `incomeStatementSummary != null`
- `statementState = PREVIEW_READY` impose :
  - `latestImportVersion != null`
  - `balanceSheetSummary != null`
  - `incomeStatementSummary != null`
  - `coverage.unmappedLines == 0`
  - `coverage.mappedShare == "1"`
  - `unmappedBalanceImpact.debitTotal == "0"`
  - `unmappedBalanceImpact.creditTotal == "0"`
  - `unmappedBalanceImpact.netDebitMinusCredit == "0"`
- toute violation de coherence rend exactement `payload financial summary invalide`

### Champs optionnels consommes par 018

- aucun champ optionnel n'est consomme comme source de rendu
- `latestImportVersion` est un champ requis nullable, pas un champ optionnel
- `balanceSheetSummary` et `incomeStatementSummary` sont des champs requis a nullabilite conditionnelle selon `statementState`, pas des champs optionnels

### Champs explicitement non consommes par 018 sur `/financial-summary`

- `closingFolderStatus`
  - non consomme
  - raison : le statut dossier visible reste celui de `GET /api/closing-folders/{id}`
  - regle : sa valeur n'introduit aucun texte, aucun badge, aucun cas d'erreur et aucun fallback specifique dans `018`
- `readiness`
  - non consomme
  - raison : `018` borne la preview sur `statementState` et la synthese visible
  - regle : la readiness continue d'etre portee uniquement par le bloc `Controles`
- `blockers`
  - non consomme
  - raison : les blockers et la prochaine action restent deja portes par le bloc `Controles`
  - regle : ni `blockers[]`, ni `blockers[].code`, ni `blockers[].message` ne sont rendus dans `Financial summary`
- `nextAction`
  - non consomme
  - raison : `018` ne porte aucun workflow additionnel
  - regle : ni `nextAction.code`, ni `nextAction.path`, ni `nextAction.actionable` ne pilotent de rendu, de validation metier additionnelle, de CTA ou de navigation dans `018`
- `nextAction.path`
  - jamais rendu
  - jamais lie
  - jamais transforme en navigation produit
- les champs explicitement non consommes n'entrent pas dans la classification `payload financial summary invalide` tant que le sous-ensemble consomme ci-dessus reste exploitable

## Matrice d'etats exacte du bloc `Financial summary`

### Regle generale

- cette matrice s'applique seulement quand la route detail est dans l'etat nominal de `004`
- les blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` restent visibles selon leurs propres specs
- en `loading` ou en erreur, le bloc `Financial summary` affiche un seul panneau d'etat local et aucun sous-bloc nominal
- en `NO_DATA`, `PREVIEW_PARTIAL` et `PREVIEW_READY`, le bloc `Financial summary` n'affiche aucun panneau d'etat local ; il affiche uniquement ses sous-blocs nominaux
- le rappel exact `Preview non statutaire. Ne pas utiliser comme export final, annexe officielle ou document CO.` est visible en `NO_DATA`, `PREVIEW_PARTIAL` et `PREVIEW_READY`, et absent des etats `loading` et erreur
- tout resultat non nominal non explicitement borne ci-dessous rend un texte stable et testable ; aucun fallback implicite n'est autorise

### `FINANCIAL_SUMMARY_LOADING`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-summary` est en cours

Rendu exact :

- panneau d'etat unique dans le bloc `Financial summary`
- texte exact visible : `chargement financial summary`
- panneau local `Financial summary` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_SUMMARY_AUTH_REQUIRED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-summary` retourne `401`

Rendu exact :

- panneau d'etat unique dans le bloc `Financial summary`
- texte exact visible : `authentification requise`
- panneau local `Financial summary` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_SUMMARY_FORBIDDEN`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-summary` retourne `403`

Rendu exact :

- panneau d'etat unique dans le bloc `Financial summary`
- texte exact visible : `acces financial summary refuse`
- panneau local `Financial summary` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_SUMMARY_NOT_FOUND`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-summary` retourne `404`

Rendu exact :

- panneau d'etat unique dans le bloc `Financial summary`
- texte exact visible : `financial summary introuvable`
- panneau local `Financial summary` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_SUMMARY_SERVER_ERROR`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-summary` retourne `5xx`

Rendu exact :

- panneau d'etat unique dans le bloc `Financial summary`
- texte exact visible : `erreur serveur financial summary`
- panneau local `Financial summary` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_SUMMARY_NETWORK_ERROR`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-summary` echoue pour erreur reseau

Rendu exact :

- panneau d'etat unique dans le bloc `Financial summary`
- texte exact visible : `erreur reseau financial summary`
- panneau local `Financial summary` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_SUMMARY_TIMEOUT`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-summary` echoue par timeout selon la convention de `frontend/src/lib/api/http.ts`

Rendu exact :

- panneau d'etat unique dans le bloc `Financial summary`
- texte exact visible : `timeout financial summary`
- panneau local `Financial summary` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_SUMMARY_INVALID_PAYLOAD`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-summary` retourne `200`
- le payload est invalide, incomplet ou incoherent pour le sous-ensemble exact consomme

Rendu exact :

- panneau d'etat unique dans le bloc `Financial summary`
- texte exact visible : `payload financial summary invalide`
- panneau local `Financial summary` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_SUMMARY_BAD_REQUEST_AS_UNEXPECTED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-summary` retourne `400`

Rendu exact :

- panneau d'etat unique dans le bloc `Financial summary`
- texte exact visible : `financial summary indisponible`
- panneau local `Financial summary` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` visibles : oui
- rappel non statutaire visible : non
- regle : `400` reutilise exactement la meme branche visible que `unexpected` et ne cree aucun workflow, aucun texte et aucun traitement distincts

### `FINANCIAL_SUMMARY_UNEXPECTED`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-summary` retourne un statut non nominal non explicitement borne, hors `400`, `401`, `403`, `404` et `5xx`

Rendu exact :

- panneau d'etat unique dans le bloc `Financial summary`
- texte exact visible : `financial summary indisponible`
- panneau local `Financial summary` : oui
- blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` visibles : oui
- rappel non statutaire visible : non

### `FINANCIAL_SUMMARY_NO_DATA`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-summary` retourne `200`
- le payload est valide pour le sous-ensemble exact consomme
- `statementState = NO_DATA`

Rendu exact :

- sous-bloc `Etat preview`
  - `etat preview : aucune donnee`
  - `version d import : aucune`
  - `lignes total : 0`
  - `lignes mappees : 0`
  - `lignes non mappees : 0`
  - `part mappee : 0`
  - `impact non mappe debit : 0`
  - `impact non mappe credit : 0`
  - `impact non mappe net : 0`
- ligne visible exacte : `aucune preview financiere disponible`
- aucun sous-bloc `Bilan synthetique`
- aucun sous-bloc `Compte de resultat synthetique`
- panneau local `Financial summary` : non
- blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` visibles : oui
- rappel non statutaire visible : oui

### `FINANCIAL_SUMMARY_PREVIEW_PARTIAL`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-summary` retourne `200`
- le payload est valide pour le sous-ensemble exact consomme
- `statementState = PREVIEW_PARTIAL`

Rendu exact :

- sous-bloc `Etat preview`
  - `etat preview : preview partielle`
  - `version d import : <valeur>`
  - `lignes total : <valeur>`
  - `lignes mappees : <valeur>`
  - `lignes non mappees : <valeur>`
  - `part mappee : <valeur>`
  - `impact non mappe debit : <valeur>`
  - `impact non mappe credit : <valeur>`
  - `impact non mappe net : <valeur>`
- sous-bloc `Bilan synthetique`
  - `actifs`
  - `passifs`
  - `capitaux propres`
  - `resultat de la periode`
  - `total actifs`
  - `total passifs et capitaux propres`
- sous-bloc `Compte de resultat synthetique`
  - `produits`
  - `charges`
  - `resultat net`
- panneau local `Financial summary` : non
- blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` visibles : oui
- rappel non statutaire visible : oui

### `FINANCIAL_SUMMARY_PREVIEW_READY`

Condition :

- `GET /api/closing-folders/{closingFolderId}/financial-summary` retourne `200`
- le payload est valide pour le sous-ensemble exact consomme
- `statementState = PREVIEW_READY`

Rendu exact :

- sous-bloc `Etat preview`
  - `etat preview : preview prete`
  - `version d import : <valeur>`
  - `lignes total : <valeur>`
  - `lignes mappees : <valeur>`
  - `lignes non mappees : 0`
  - `part mappee : 1`
  - `impact non mappe debit : 0`
  - `impact non mappe credit : 0`
  - `impact non mappe net : 0`
- sous-bloc `Bilan synthetique`
  - `actifs`
  - `passifs`
  - `capitaux propres`
  - `resultat de la periode`
  - `total actifs`
  - `total passifs et capitaux propres`
- sous-bloc `Compte de resultat synthetique`
  - `produits`
  - `charges`
  - `resultat net`
- panneau local `Financial summary` : non
- blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` visibles : oui
- rappel non statutaire visible : oui

## Regle metier visible

- texte exact obligatoire dans les etats nominaux `NO_DATA`, `PREVIEW_PARTIAL` et `PREVIEW_READY` :
  - `Preview non statutaire. Ne pas utiliser comme export final, annexe officielle ou document CO.`
- ce texte exact n'est pas requis dans les etats `loading` et erreur, qui restent des panneaux locaux mono-message
- interdiction produit explicite :
  - ne jamais presenter cette preview comme un export final
  - ne jamais presenter cette preview comme une annexe officielle
  - ne jamais presenter cette preview comme un document CO

## Regles de non-derive

- `018` n'ouvre aucune nouvelle route produit
- `018` n'ajoute aucune tabulation produit
- `018` n'appelle jamais `imports/balance/versions`
- `018` n'appelle jamais `diff-previous`
- `018` n'appelle jamais `financial-statements-structured`
- `018` n'appelle jamais `workpapers`
- `018` n'appelle jamais `documents`
- `018` n'appelle jamais `exports`
- `018` n'appelle jamais d'endpoint IA
- `018` n'ajoute aucun nouveau backend
- `018` n'ajoute aucun nouveau contrat OpenAPI
- `018` n'introduit aucune mutation
- `018` n'introduit aucun etat global de page
- `018` ne declenche aucun refresh global de la route detail
- `018` n'introduit aucun workflow `nextAction`
- `018` n'introduit aucune navigation automatique ou manuelle basee sur `nextAction.path`
- `018` ne corrige pas le refresh `Mapping manuel` apres import balance

## Criteres d'acceptation frontend

- `specs/active/018-frontend-financial-summary-preview-v1.md` existe
- `/closing-folders/:closingFolderId` reste l'unique route produit enrichie par `018`
- aucune nouvelle route produit n'est introduite
- aucun nouveau backend n'est introduit
- aucun nouveau contrat OpenAPI n'est introduit
- le bloc `Financial summary` est place strictement apres `Controles`
- les blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` restent visibles quand `Financial summary` echoue
- le seul nouvel endpoint consomme par `018` est `GET /api/closing-folders/{closingFolderId}/financial-summary`
- l'ensemble total des endpoints routes detail autorises apres `018` reste borne a :
  - `GET /api/me`
  - `GET /api/closing-folders/{id}`
  - `GET /api/closing-folders/{closingFolderId}/controls`
  - `GET /api/closing-folders/{closingFolderId}/mappings/manual`
  - `PUT /api/closing-folders/{closingFolderId}/mappings/manual`
  - `DELETE /api/closing-folders/{closingFolderId}/mappings/manual`
  - `POST /api/closing-folders/{closingFolderId}/imports/balance`
  - `GET /api/closing-folders/{closingFolderId}/financial-summary`
- aucun endpoint `imports/balance/versions`, `diff-previous`, `financial-statements-structured`, `workpapers`, `documents`, `exports` ou IA n'est appele
- `GET /api/closing-folders/{closingFolderId}/financial-summary` est emis seulement apres succes exploitable de `GET /api/me` puis `GET /api/closing-folders/{id}`
- `GET /api/closing-folders/{closingFolderId}/financial-summary` est emis une seule fois au chargement initial de la route ; `018` n'ajoute aucun retry automatique ni refresh global
- `018` n'ajoute aucun rechargement local de `/financial-summary` apres succes ou echec d'import balance, de `PUT mapping` ou de `DELETE mapping`
- le frontend ne consomme du payload `/financial-summary` que le sous-ensemble exact fige dans cette spec
- toute propriete requise absente, invalide ou incoherente du sous-ensemble consomme rend exactement `payload financial summary invalide`
- les champs explicitement non consommes de `/financial-summary` ne pilotent ni rendu, ni navigation, ni classification d'erreur dans `018`
- `nextAction` et `nextAction.path` ne sont ni rendus, ni lies, ni transformes en navigation produit
- `400` est traite comme le meme rendu visible que `unexpected`, sans nouveau workflow
- le rappel exact `Preview non statutaire. Ne pas utiliser comme export final, annexe officielle ou document CO.` est visible en `NO_DATA`, `PREVIEW_PARTIAL` et `PREVIEW_READY`
- aucun etat global de page n'est introduit par `018` ; le bloc `Financial summary` porte seul ses etats loading / erreur / nominal
- les etats visibles exacts sont testables pour :
  - chargement financial summary
  - `NO_DATA`
  - `PREVIEW_PARTIAL`
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
- tests prouvant que le bloc `Financial summary` est place strictement apres `Controles`
- tests prouvant que `GET /api/closing-folders/{closingFolderId}/financial-summary` n'est emis qu'apres succes exploitable de `GET /api/me` puis `GET /api/closing-folders/{id}`
- tests prouvant que `GET /api/closing-folders/{closingFolderId}/financial-summary` est appele une seule fois au chargement initial et qu'aucun retry automatique ni refresh global supplementaire n'est declenche par `018`
- tests prouvant que les seuls nouveaux appels reseau de `018` passent par `GET /api/closing-folders/{closingFolderId}/financial-summary`
- tests prouvant qu'aucun endpoint `imports/balance/versions`, `diff-previous`, `financial-statements-structured`, `workpapers`, `documents`, `exports`, IA, versions ou diff n'est appele
- tests prouvant qu'aucun `GET /api/closing-folders/{closingFolderId}/financial-summary` additionnel n'est emis apres un `POST imports/balance`, un `PUT mappings/manual` ou un `DELETE mappings/manual`
- tests prouvant que les etats visibles exacts sont rendus pour :
  - `chargement financial summary`
  - `financial summary indisponible` sur `400`
  - `authentification requise`
  - `acces financial summary refuse`
  - `financial summary introuvable`
  - `erreur serveur financial summary`
  - `erreur reseau financial summary`
  - `timeout financial summary`
  - `payload financial summary invalide`
  - `financial summary indisponible`
  - `aucune preview financiere disponible`
  - `etat preview : preview partielle`
  - `etat preview : preview prete`
- tests prouvant que le payload invalide couvre au minimum :
  - `closingFolderId` incoherent
  - `statementState = NO_DATA` avec summaries non null
  - `statementState = PREVIEW_READY` avec `coverage.unmappedLines != 0`
  - champ requis absent dans `coverage`
  - champ requis absent dans `balanceSheetSummary`
  - body `200` non JSON ou illisible
- tests prouvant que les blocs `Dossier courant`, `Import balance`, `Mapping manuel` et `Controles` restent visibles quand `Financial summary` retourne `401`, `403`, `404`, `5xx`, erreur reseau, timeout ou payload invalide
- tests prouvant que les memes blocs restent visibles quand `Financial summary` retourne `400`
- tests prouvant qu'aucun etat global de page n'est introduit et que le bloc `Financial summary` porte seul le loading, l'erreur ou le nominal
- tests prouvant que le rappel `Preview non statutaire. Ne pas utiliser comme export final, annexe officielle ou document CO.` est visible en `NO_DATA`, `PREVIEW_PARTIAL` et `PREVIEW_READY`
- tests prouvant que `nextAction.path` n'est jamais rendu comme lien, bouton ou navigation produit
