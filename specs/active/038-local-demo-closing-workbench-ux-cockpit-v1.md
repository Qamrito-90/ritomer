# 038 - Local demo closing workbench UX cockpit V1

## Status

Active.

## Surface

DOCS_GIT / FRONTEND_SPEC.

Cette spec cadre le prochain increment UX frontend. La creation de cette spec ne livre aucun code runtime, aucun backend, aucun frontend runtime, aucun endpoint, aucun contrat OpenAPI, aucune migration DB, aucune CI, aucun token, aucun secret, aucune valeur `.env`, aucune donnee demo supplementaire, aucune IA runtime et aucun GraphQL.

## Risk

B.

Le risque vient du fait que la future implementation modifiera l'experience frontend d'un dossier de closing deja branche sur un backend reel, un tenant actif, des endpoints REST existants et des surfaces audit-ready. La spec reste classee B tant qu'elle ne propose aucun changement auth, backend, DB, API, securite, tenant, audit, contrat ou promesse CO/statutaire.

Reclasser et recadrer avant implementation si un changement propose touche :

- authentification, JWT, proxy Vite ou session navigateur ;
- selection ou resolution de tenant ;
- backend, DB, migration ou contrat OpenAPI ;
- audit, autorisation ou separation tenant ;
- nouvelle mutation metier ;
- nouveau endpoint ;
- promesse CO, statutaire, officielle, certifiee ou prete au depot.

## Role de cette spec

Cadrer un increment frontend strict pour transformer le dossier demo local issu de `036` et observe en `037` en cockpit de closing clair, demo-able et plus premium.

`036` a livre la chaine technique locale : seed PostgreSQL local dev-only, auth JWT locale prouvee, `/api/me` avec `activeTenant`, proxy Vite dev-only et dossier demo visible depuis le frontend.

`037` a clos le smoke manuel en PASS technique : backend health `200`, `/api/me` sans JWT `401`, `/api/me` via proxy Vite avec JWT local `200`, tenant demo synthetique visible, role `ACCOUNTANT`, dossier `Demo Closing FY2025` visible et ouvrable, mauvais tenant rejete `403`, bearer non observe cote navigateur ou repo.

Le probleme residuel n'est pas technique. Il est UX produit : l'ecran actuel prouve le flux, mais ne donne pas encore une experience cockpit au niveau POC/premium.

## Sources relues

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/product/v1-plan.md`
- `specs/done/036-local-integrated-demo-real-backend-seed-v1.md`
- `specs/done/037-local-integrated-demo-manual-business-smoke-v1.md`
- `runbooks/local-dev.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/ui/ui-foundations-v1.md`
- `specs/done/033-pilot-core-flow-ui-refresh-consistency-v1.md`
- `specs/done/034-pilot-balance-import-history-diff-ui-v1.md`
- `specs/done/035-pilot-export-pack-minimal-annex-refresh-ui-v1.md`
- `docs/adr/0001-monolithe-modulaire.md`
- `docs/adr/0002-rest-first-graphql-later.md`
- `docs/adr/0003-ai-gateway-evidence-first.md`
- `docs/adr/0004-multi-tenancy-audit-rls-progressive.md`
- `docs/adr/0005-front-ui-stack-and-design-system.md`
- `docs/adr/0006-postgresql-cloud-sql-no-docker-v1.md`
- `README.md`
- `docs/vision/ux.md`
- `docs/vision/architecture.md`
- `docs/vision/ai-native.md`
- `docs/playbooks/ux.md`
- `docs/playbooks/architecture.md`
- `docs/playbooks/ai.md`

Contrats impactes par cette creation documentaire : AUCUN.

Runbooks impactes par cette creation documentaire : AUCUN.

## Probleme exact UX observe en 037

Le dossier demo local est fonctionnel et charge les surfaces principales depuis le backend reel, mais l'experience observee reste :

- trop lineaire ;
- trop longue a parcourir ;
- trop technique dans son exposition ;
- faible en hierarchie produit ;
- insuffisamment lisible comme demo cockpit ;
- pas encore au niveau POC/premium attendu pour une presentation pilote.

L'utilisateur peut ouvrir le dossier et verifier les surfaces, mais il doit reconstruire lui-meme le sens du closing : ou en est le dossier, quelle etape bloque, quelle action vient ensuite, quelles preuves existent et quelles previews restent non statutaires.

Le probleme n'est pas un manque d'API, de seed, de JWT, de proxy, de backend ou de donnee demo. C'est une composition frontend et une hierarchie UX insuffisantes autour des read-models existants.

## Objectif produit

Transformer `/closing-folders/:closingFolderId` en cockpit de closing demo clair pour un evaluateur local :

- reduire la longueur percue du dossier ;
- supprimer, renommer ou deplacer le bruit technique visible ;
- donner une synthese haut de page utile ;
- rendre visible le chemin `closing -> import -> mapping -> controls -> previews -> workpapers/evidence -> export` ;
- rendre les statuts, blockers et prochaines actions comprehensibles ;
- garder le tenant et le dossier visibles ;
- conserver les endpoints REST existants ;
- ne creer aucune capacite metier nouvelle ;
- ne changer aucune mutation existante ;
- ne pas promettre un livrable CO/statutaire final.

## Comportement cible

### Structure generale

La route `/closing-folders/:closingFolderId` doit devenir un cockpit oriente decision humaine, pas une succession longue de blocs techniques.

Le haut de page doit donner en un coup d'oeil :

- tenant actif ;
- dossier courant ;
- periode ou contexte du dossier quand disponible ;
- statut global comprehensible ;
- prochaine action recommandee par les donnees existantes, sans IA runtime ;
- blockers principaux ;
- etat des preuves et de la revue quand disponible ;
- rappel non statutaire pour les previews ou exports proches d'un livrable.

Le reste de la page doit etre organise par parcours de closing, avec navigation visuelle ou sections ancrees, sans creer de route produit nouvelle si l'implementation peut rester dans la route detail existante.

### Chemin closing visible

Le cockpit doit rendre le chemin suivant visible et scannable :

1. Closing folder
2. Import balance
3. Mapping manuel et suggestions no-provider si presentes
4. Controls / readiness
5. Financial summary et financial statements structured previews
6. Workpapers, evidence et review status
7. Audit-ready export pack et minimal annex preview

Chaque etape doit afficher un etat comprehensible, derive des read-models existants. Aucun etat ne doit etre invente si les donnees ne permettent pas de le justifier.

### Hierarchie et reduction de longueur percue

L'implementation future doit privilegier :

- une synthese cockpit au-dessus des details ;
- des blocs compacts pour les surfaces deja livrees ;
- la mise en avant des blockers et de la prochaine action ;
- des details techniques deplaces vers des zones secondaires, repliees ou moins dominantes ;
- une lecture desktop plus dense mais lisible ;
- une adaptation mobile coherente, sans clone aveugle du desktop.

Les informations critiques ne doivent pas etre cachees derriere un hover-only pattern.

### Bruit technique

Le frontend ne doit plus faire porter la demonstration par des libelles, details ou agencements trop techniques quand une formulation metier claire est possible.

Sont a reduire ou deplacer quand ils existent dans l'UI :

- IDs bruts non necessaires a la decision utilisateur ;
- details d'endpoint, payload ou refresh visibles comme information principale ;
- messages de diagnostic non actionnables ;
- texte qui force l'utilisateur a comprendre l'architecture pour suivre le closing.

Les erreurs et warnings techniques necessaires restent autorises, mais doivent etre formules en consequences utilisateur et action possible.

### Statuts et blockers

Les statuts doivent etre lisibles sans deduction cachee :

- `ready`, `blocked`, `loading`, `empty`, `error`, `invalid payload`, `stale` ou equivalents doivent etre presentes avec un libelle metier clair ;
- les blockers doivent expliquer ce qui manque et quelle surface est concernee ;
- les warnings post-action existants de `033`, `034` et `035` restent visibles et testables ;
- aucune information critique ne doit dependre de la couleur seule ;
- les previews financieres restent explicitement non statutaires quand une ambiguite de finalisation pourrait exister.

### Donnees et endpoints

La future implementation doit reutiliser les endpoints REST existants deja consommes par le frontend.

Elle ne doit pas :

- creer un endpoint ;
- modifier un endpoint ;
- modifier un contrat OpenAPI ;
- ajouter GraphQL ;
- changer le seed demo ;
- forcer un mock frontend comme source principale ;
- changer la sequence d'auth locale ;
- stocker ou exposer un bearer cote navigateur.

## Binding UI Foundations obligatoire pour 038

`docs/ui/ui-foundations-v1.md` est la source de verite UI codable pour l'implementation future de `038`. Le cockpit doit appliquer cette grammaire sans creer de design system parallele, sans inventer de variants ecran ad hoc et sans transformer cette spec en refonte globale.

Ce binding est normatif pour la future implementation frontend de `038`. En cas d'ecart entre une interpretation locale de l'ecran et les fondations UI, les fondations UI priment, tant que le hors-scope de `038` reste respecte.

### Grammaire visuelle obligatoire

La future implementation doit utiliser :

- Tailwind CSS comme couche de styling ;
- shadcn/ui pour les composants themables si deja disponible dans le repo ;
- Radix Primitives pour les comportements accessibles complexes si deja disponible dans le repo ;
- CSS variables et tokens semantiques comme source de theming ;
- TanStack Table uniquement si une table metier est touchee et si TanStack Table est deja disponible dans le repo.

Elle ne doit pas ajouter une nouvelle dependance UI structurante dans `038` sans recadrage explicite. Si un composant necessaire existe deja dans `frontend/src/components/ui/*` ou `frontend/src/components/workbench/*`, il doit etre reutilise ou compose avant d'inventer une variante locale.

### Typographie et lisibilite

La future implementation doit appliquer la hierarchie typographique des UI Foundations :

- font UI : Inter si disponible, sinon `ui-sans-serif` ;
- H1 : 24 px ;
- H2 : 20 px ;
- H3 : 18 px ;
- body : 14 px minimum ;
- meta : 12 px maximum, jamais pour un contenu critique.

La hierarchie doit rester stricte : titre dossier, statut global, prochaine action, blockers, sections et details secondaires ne doivent pas avoir le meme poids visuel. Aucun blocker, erreur, statut, warning, montant important, posture non statutaire ou action humaine requise ne doit etre rendu en texte faible, trop petit ou visuellement secondaire au point de devenir manquable.

### Formats financiers et data-heavy

Les donnees financieres et operationnelles doivent etre formatees pour une lecture fiduciaire :

- utiliser `tabular-nums` pour montants, pourcentages, dates, periodes et colonnes numeriques ;
- aligner les montants et colonnes numeriques a droite ;
- aligner les labels, libelles metier et descriptions a gauche ;
- utiliser des formats lisibles et coherents avec les UI Foundations, par exemple `CHF 12 345.67`, `12.4 %`, `31.12.2025`, `FY25` ou `Q4 2025` quand les donnees existent ;
- distinguer visuellement et textuellement les donnees courantes, historiques, stale et archivees ;
- ne jamais presenter une valeur derivee, stale ou historique comme une valeur courante si le read-model ne le justifie pas.

Si une table metier est touchee, elle doit rester lisible a `1366px`, avec headers, etats loading/empty/error, alignements numeriques et actions compatibles clavier. TanStack Table ne doit etre mobilise que si la table touchee le justifie et que la dependance est deja disponible.

### Tokens, surfaces et statuts

La future implementation doit utiliser des tokens ou variables semantiques pour :

- surfaces : canvas, default, sunken, elevated ;
- texte : default, muted, soft, inverse, link ou equivalents existants ;
- bordures : default, strong, focus, critical ou equivalents existants ;
- focus visible ;
- familles de statuts : success, warning, error, info ;
- workflow : draft, review, validated, finalized, exported ou equivalents deja poses.

Interdits dans le code applicatif de `038` :

- raw hex ;
- variants visuels improvises au niveau ecran ;
- couleur seule comme porteur de statut ;
- contraste faible pour contenu critique ;
- focus invisible ou uniquement implicite.

Les statuts doivent toujours combiner couleur avec texte, icone, microcopy ou structure. Les badges sont autorises seulement s'ils clarifient le scan ; ils ne doivent pas devenir une surabondance decorative.

### Qualite visuelle attendue

Le rendu cible est premium mais sobre, clair sous pression et credible pour une fiduciaire suisse. Il doit evoquer un workbench financier banque-grade / fiduciaire-grade, pas un dashboard startup generique.

Attendus visuels :

- densite maitrisee, utile a la decision ;
- spacing base sur l'echelle 4 / 8 / 12 / 16 / 24 / 32 / 48 ;
- radius sobres compatibles UI Foundations ;
- ombres discretes, reservees aux surfaces qui ont besoin de profondeur ;
- motion sobre, compatible `prefers-reduced-motion` ;
- pas de scroll horizontal sauvage a `1366px` ;
- pas de texte technique comme premier niveau de lecture ;
- pas de multiplication de badges, cards ou alertes quand une structure plus calme suffit.

Le cockpit doit etre lisible par un evaluateur metier sans comprendre l'architecture, les endpoints, les consumers frontend ou la sequence auth locale.

### Do / Don't d'implementation 038

Do :

- cockpit summary compact ;
- next action unique au premier niveau ;
- blockers courts, relies aux sections concernees ;
- sections scanables ;
- navigation d'ancrage ou sections repliables ;
- wording metier ;
- etat non statutaire clair pour previews, export pack et minimal annex ;
- contexte tenant et dossier visible sur les zones sensibles ;
- feedback loading/empty/error sans layout shift majeur.

Don't :

- raw IDs longs en premier niveau ;
- endpoint, payload, consumer, proxy, bearer ou debug comme contenu principal ;
- couleur seule pour statut ;
- texte critique en meta ;
- grosse page lineaire sans hierarchie ;
- dashboard startup generique ;
- nouveau backend ;
- nouveau endpoint ;
- OpenAPI ;
- auth, JWT, proxy ou stockage navigateur de token ;
- IA runtime ;
- GraphQL ;
- nouvelle mutation.

## UX blueprint desktop 1366px

Ce blueprint est une maquette fonctionnelle documentaire. Il contraint la composition produit de la future implementation pour eviter un simple polish CSS.

### Intention 1366px

Sur un viewport desktop de reference `1366px`, l'ecran doit se lire comme un cockpit de closing en deux temps :

1. comprendre l'etat du dossier en moins de 10 secondes ;
2. descendre ensuite dans les surfaces de travail deja existantes.

Le premier ecran visible doit contenir le contexte sensible, le statut, les blockers, la prochaine action et la progression du closing. Les details longs doivent rester accessibles plus bas, dans des blocs compacts, ancres ou sections repliables, sans devenir le premier niveau de lecture.

### Structure haute de page

Le haut de page attendu :

- header applicatif existant ou equivalent avec tenant actif visible ;
- fil d'Ariane court : `Dossiers / Demo Closing FY2025` ou equivalent derive des donnees ;
- titre dossier et periode si disponible ;
- statut global lisible avec icone ou texte, jamais couleur seule ;
- mention de posture quand la surface est proche d'un livrable : `Prepared for human review` ou `Preview non statutaire` selon contexte ;
- action primaire unique, derivee des read-models existants ;
- actions secondaires groupees et moins dominantes.

L'action primaire ne doit pas inventer de capacite. Elle doit pointer vers une surface existante, declencher une action deja existante ou ouvrir une section pertinente. Exemples autorises selon les donnees :

- `Voir les blockers` si le dossier est bloque ;
- `Reprendre le mapping` si des comptes restent non mappes ;
- `Ouvrir les controls` si le statut depend de la readiness ;
- `Continuer les workpapers` si les preuves ou reviews bloquent ;
- `Preparer le pack de revue` seulement si l'action d'export pack existe deja et reste non statutaire.

Les actions secondaires attendues :

- `Importer une balance` si la surface existe deja et que le wording ne promet pas de finalisation ;
- `Voir l'historique import` ;
- `Revoir les suggestions` si les suggestions no-provider sont deja presentes ;
- `Ouvrir les previews` ;
- `Voir les preuves` ;
- `Voir export pack` ou `Telecharger` seulement pour les packs deja exposes par les endpoints existants.

### Cockpit summary

Le cockpit summary doit etre positionne immediatement sous le contexte dossier. Il doit tenir dans la zone visible avec la progression, sans exiger un long scroll pour comprendre l'etat.

Contenu attendu :

- statut dossier : libelle metier court ;
- prochaine action : une phrase orientee tache ;
- blockers principaux : 1 a 3 elements maximum au premier niveau ;
- preuves/revue : resume court si disponible ;
- previews/export : rappel non statutaire si visible ;
- derniere activite ou fraicheur des read-models si l'information existe deja.

Le cockpit summary ne doit pas afficher comme information principale :

- URL d'endpoint ;
- payload brut ;
- identifiant technique long ;
- statut HTTP comme message principal ;
- diagnostic reserve au debug ;
- token, bearer, valeur `.env`, credential ou secret.

### Progression closing

La progression doit rendre visible le chemin canonique :

`Closing -> Import -> Mapping -> Controls -> Previews -> Workpapers/Evidence -> Export`

Chaque etape doit afficher :

- un libelle metier ;
- un etat derive des donnees existantes ;
- un micro-resume actionnable ;
- une ancre vers la section concernee ;
- un indicateur textuel ou iconographique en plus de la couleur.

Les etapes ne doivent pas pretendre qu'une phase est terminee si les read-models ne permettent pas de le justifier. Si l'etat est indetermine, l'UI doit le dire explicitement plutot que l'inventer.

### Sections principales

Sous le premier ecran, l'ordre attendu des sections est :

1. `Vue de closing` : progress summary, prochaine action, blockers, statut global.
2. `Import balance` : import courant, historique import, diff N/N-1.
3. `Mapping` : mapping manuel et suggestions no-provider si presentes.
4. `Controls / readiness` : readiness, blockers, warnings post-action.
5. `Previews financieres` : financial summary et financial statements structured previews, avec posture non statutaire.
6. `Workpapers et evidence` : workpapers, documents, verification, reviewer workpaper decision si deja visible.
7. `Export de revue` : audit-ready export pack et minimal annex preview, avec wording non statutaire et human review required.

Chaque section doit pouvoir etre atteinte depuis la navigation d'ancrage ou depuis la progression. Les sections longues doivent favoriser une version compacte par defaut avec details deployables, tant que les alertes, blockers et erreurs restent visibles sans hover-only pattern.

### Navigation d'ancrage ou sections repliables

La future implementation doit choisir au moins un mecanisme clair :

- barre d'ancres horizontale ou verticale sur desktop ;
- tabs/segmented navigation si elle ne masque pas les blockers critiques ;
- accordions par section avec resume toujours visible ;
- combinaison ancre + sections deployables.

La navigation doit rester clavier-accessible, garder un focus visible et ne doit pas provoquer de scroll horizontal sauvage. Sur mobile, elle peut devenir une liste compacte, un menu de sections ou des accordions, mais les concepts et les libelles doivent rester coherents avec le desktop.

### Tenant, dossier et contexte visible

Le tenant actif et le dossier courant doivent rester visibles dans le haut de page et dans tout etat sensible. Sur desktop, le contexte peut etre sticky si le layout existant le permet, mais il ne doit pas masquer les contenus. Sur mobile, le contexte peut etre resume sur deux lignes, sans supprimer tenant ou dossier.

Si la periode ou le contexte du dossier n'existe pas dans les donnees chargees, l'UI ne doit pas inventer de periode. Elle peut afficher un libelle neutre comme `Periode non renseignee` si ce cas est utile et derive du read-model.

## Wireframe textuel

Wireframe desktop cible, ordre exact des blocs :

```text
+--------------------------------------------------------------------------+
| App shell / contexte                                                       |
| Tenant actif: Ritomer Demo Fiduciaire SA     Dossiers / Demo Closing FY25 |
+--------------------------------------------------------------------------+
| Demo Closing FY2025                          [Action primaire] [Actions]  |
| Statut dossier + periode si disponible       Prepared for human review    |
+--------------------------------------------------------------------------+
| Cockpit summary                                                           |
| + Statut global      + Prochaine action      + Blockers principaux        |
| + Evidence/review    + Previews/export non statutaires                    |
+--------------------------------------------------------------------------+
| Progression closing                                                        |
| [Closing]--[Import]--[Mapping]--[Controls]--[Previews]--[Evidence]--[Export]|
| Chaque etape: etat texte + icone + micro-resume + ancre                   |
+--------------------------------------------------------------------------+
| Navigation sections                                                        |
| Vue closing | Import | Mapping | Controls | Previews | Evidence | Export  |
+--------------------------------------------------------------------------+
| Vue de closing                                                            |
| Resume compact, blockers detailles, warnings post-action si presents      |
+--------------------------------------------------------------------------+
| Import balance                                                            |
| Import courant | Historique imports | Diff N/N-1 | etats loading/error    |
+--------------------------------------------------------------------------+
| Mapping                                                                   |
| Mapping manuel | Suggestions no-provider | decisions humaines unitaires   |
+--------------------------------------------------------------------------+
| Controls / readiness                                                       |
| Readiness | blockers | next action | invalid/stale payload fail-closed    |
+--------------------------------------------------------------------------+
| Previews financieres                                                       |
| Financial summary | Structured preview | Preview non statutaire           |
+--------------------------------------------------------------------------+
| Workpapers et evidence                                                     |
| Workpapers | documents | verification | reviewer workpaper decision       |
+--------------------------------------------------------------------------+
| Export de revue                                                            |
| Audit-ready export pack | Minimal annex preview | Human review required    |
+--------------------------------------------------------------------------+
```

Contenu qui doit disparaitre du premier niveau de lecture :

- blocs techniques presentes avant le statut metier ;
- IDs bruts sans utilite de decision ;
- details d'endpoint et noms de consumers comme titres visibles ;
- messages centres sur HTTP, JSON ou payload quand une consequence utilisateur est possible ;
- exposition de sequence auth, proxy Vite ou bearer ;
- repetition longue de la meme posture non statutaire dans chaque ligne si un rappel sectionnel suffit.

Contenu qui doit rester visible :

- tenant actif ;
- dossier courant ;
- statut global ;
- blockers ;
- prochaine action ;
- chemin de closing ;
- surfaces existantes import, mapping, controls, previews, workpapers/evidence, export ;
- warnings de refresh partiel issus de `033`, `034` et `035` quand ils se produisent ;
- validation fail-closed des payloads sensibles ;
- mentions non statutaires sur previews, export pack et minimal annex quand une ambiguite de finalisation existe ;
- actions humaines explicites pour mapping, review, documents, workpapers et export deja existants.

## Hierarchie produit attendue

### Ce que l'utilisateur doit comprendre en 10 secondes

L'utilisateur doit pouvoir repondre sans parcourir toute la page :

- quel tenant et quel dossier il regarde ;
- si le dossier est pret, bloque, partiel, en erreur ou en cours de chargement ;
- quelle est la prochaine action utile ;
- quels sont les 1 a 3 principaux blockers ;
- quelles preuves ou reviews sont deja disponibles ;
- quelles previews ou exports restent non statutaires et soumis a revue humaine.

### Statut du dossier

Le statut du dossier doit etre exprime en langage de closing, pas en langage technique. Exemples de libelles acceptables selon donnees :

- `Dossier en preparation` ;
- `Import a verifier` ;
- `Mapping incomplet` ;
- `Controls bloques` ;
- `Previews disponibles pour revue` ;
- `Preuves a completer` ;
- `Pack de revue disponible` ;
- `Dossier archive` si l'etat existe deja dans le repo et le read-model.

Ces libelles sont indicatifs. L'implementation doit les aligner sur les donnees reelles et les conventions existantes, sans inventer un workflow durable non supporte.

### Blockers

Les blockers doivent etre visibles dans le cockpit summary et relies a une section. Chaque blocker doit expliquer :

- ce qui manque ou bloque ;
- quelle surface est concernee ;
- quelle action humaine peut suivre ;
- si l'etat est partiel, stale, invalide ou indisponible.

Un blocker ne doit pas etre seulement une couleur, un code ou une erreur brute.

### Prochaine action

La prochaine action doit etre deterministe, derivee des donnees deja chargees et non IA runtime. Si plusieurs actions sont possibles, l'UI doit choisir une action primaire prudente et mettre les autres en secondaires.

Ordre de priorite recommande, a adapter aux read-models reels :

1. corriger un etat `error` ou `invalid payload` bloquant ;
2. traiter un import manquant ou partiel ;
3. terminer le mapping manuel ou revoir les suggestions no-provider ;
4. resoudre les controls/readiness blockers ;
5. completer workpapers, documents ou reviews ;
6. consulter les previews non statutaires ;
7. preparer ou consulter l'export de revue existant.

### Surfaces de closing

Les surfaces doivent etre presentees comme un parcours coherent :

- `Import` : ce qui a ete importe, quand, et si un diff est disponible.
- `Mapping` : ce qui reste a mapper, ce qui est suggere, ce qui requiert une decision humaine.
- `Controls` : readiness, blockers et prochaine action.
- `Previews` : resultats de revue, non statutaires, sans promesse de depot.
- `Workpapers` : justifications par anchor, maker/checker minimal.
- `Evidence` : documents, verification reviewer, preuves visibles.
- `Export` : audit-ready export pack comme handoff de revue et minimal annex preview non statutaire.

## Wording metier attendu

L'implementation future doit remplacer le bruit API ou technique par des formulations metier, tout en conservant les informations necessaires en detail secondaire.

Exemples de transformations attendues :

- `GET /controls failed` -> `Controls indisponibles pour le moment. Reessayez avant de conclure la revue.`
- `invalid payload` -> `Donnees de readiness incoherentes. L'ecran reste bloque par securite.`
- `stale workpapers` -> `Justifications rattachees a une ancienne version du dossier.`
- `mapping suggestions` -> `Suggestions de mapping a revoir`
- `financial statements structured` -> `Preview structuree des etats financiers`
- `export pack` -> `Audit-ready export pack`
- `minimal annex` -> `Minimal annex preview`

Wording non statutaire a conserver quand pertinent :

- `Preview non statutaire` ;
- `Non statutory` ;
- `Prepared for human review` ;
- `Human review required` ;
- `Not a final CO deliverable` ;
- `Do not use as statutory filing`.

Wording interdit dans la future implementation :

- `CO-ready` ;
- `statutory-ready` ;
- `official financial statements` ;
- `annexe officielle` ;
- `annexe CO finale` ;
- `final CO annex` ;
- `final accounts approved` ;
- `automatically approved` ;
- `AI-approved` ;
- `ready to file` ;
- `certified` ;
- tout equivalent qui promet une finalisation CO, statutaire, officielle ou prete au depot.

## Etats UX obligatoires

Chaque bloc cockpit et chaque section principale doivent definir un rendu comprehensible pour les etats suivants quand la surface les rencontre :

- `loading` : squelette ou message court, sans layout shift majeur, avec contexte tenant/dossier conserve.
- `error` : consequence utilisateur, action possible, detail technique secondaire si utile.
- `empty` : explication de l'absence de donnees et prochaine action possible sans inventer de mock.
- `partial data` : ce qui est disponible, ce qui manque, impact sur la decision.
- `blocked` : raison, surface concernee, action humaine recommandee.
- `ready` : ce qui est pret et quelle revue humaine reste attendue si la surface est proche d'un livrable.
- `archived` : lecture autorisee si deja supportee par le repo, actions de write bloquees si le workflow existant le prevoit, libelle visible `Dossier archive` ou equivalent.
- `invalid payload` : fail-closed visible, pas de rendu optimiste.
- `stale` : distinguer courant, historique et rattachement ancien.

Ces etats doivent etre accessibles, testables et non portes par la couleur seule.

## Criteres d'acceptation visuels renforces

La future implementation est acceptee visuellement seulement si :

- le premier viewport desktop `1366px` permet de comprendre tenant, dossier, statut, prochaine action, blockers et progression closing ;
- la typographie est lisible, professionnelle et conforme a la hierarchie des UI Foundations ;
- la hierarchie visuelle est evidente entre contexte, statut, action, blockers, progression, sections et details ;
- le cockpit est utilisable sans comprendre l'architecture backend, les endpoints, les consumers frontend, le proxy local ou les payloads ;
- la page semble credible pour une fiduciaire, meme si un POC complet reste hors scope ;
- la longueur percue est reduite par hierarchie, regroupement, ancrage ou disclosure progressive ;
- la page ne presente pas de scroll horizontal sauvage a `1366px` ;
- la navigation entre sections est claire, clavier-accessible et ne masque pas les alertes critiques ;
- tenant actif et dossier courant restent visibles sur les zones sensibles ;
- les statuts combinent texte, icone ou microcopy, pas couleur seule ;
- les actions primaires et secondaires sont comprehensibles sans connaitre l'architecture ;
- les erreurs techniques sont reformulees en consequence utilisateur et action possible ;
- aucune donnee mock ne devient source principale du parcours demo ;
- les surfaces existantes restent atteignables ;
- les previews financieres, l'audit-ready export pack et la minimal annex preview restent non statutaires et soumis a revue humaine ;
- aucune promesse CO, statutaire, officielle, certifiee ou prete au depot n'apparait ;
- aucun token, bearer, valeur `.env`, endpoint de mint token ou detail de proxy n'est expose dans l'UI ;
- un smoke visuel local est attendu apres implementation pour verifier le premier viewport desktop `1366px`, l'absence de scroll horizontal sauvage, la lisibilite typographique, les statuts non portes par couleur seule et la posture non statutaire.

## Hors-scope reafirme pour le blueprint

Ce blueprint ne cree aucune capacite runtime et ne change aucune source de verite technique.

Restent strictement hors scope :

- backend ;
- DB ;
- migration ;
- OpenAPI ;
- auth, JWT, proxy Vite ou session navigateur ;
- IA runtime ;
- provider IA, modele, SDK, prompt runtime, eval IA ou RAG ;
- GraphQL ;
- nouveau seed ;
- nouvelle donnee demo ;
- nouveau endpoint ;
- nouvelle mutation metier ;
- stockage navigateur de token ;
- nouvelle route produit obligatoire ;
- POC complet ;
- livrable CO, statutaire, officiel, certifie ou pret au depot ;
- refonte globale du design system ;
- spec `039`.

## Perimetre frontend strict

La future implementation de `038` est limitee au frontend applicatif.

Autorise, si necessaire :

- restructuration de la route `/closing-folders/:closingFolderId` ;
- extraction ou recomposition de composants frontend existants ;
- ajout de composants cockpit/workbench frontend ;
- adaptation du layout responsive ;
- amelioration des libelles UX non statutaires ;
- orchestration visuelle de read-models deja charges ;
- tests frontend cibles ;
- ajustement de fixtures de tests frontend sans changer la verite metier.

Non autorise dans cette spec :

- backend ;
- DB ou migration ;
- contrat OpenAPI ;
- endpoint ;
- mutation metier nouvelle ;
- auth, JWT, proxy Vite ou stockage navigateur ;
- IA runtime ;
- GraphQL ;
- nouvelle donnee demo ;
- refonte globale du design system.

## Ecrans et surfaces concernes

Surface principale :

- `/closing-folders/:closingFolderId`

Surfaces frontend concernees dans cette route :

- contexte tenant et dossier ;
- dossier progress summary ;
- import balance ;
- historique import et diff N/N-1 ;
- mapping manuel ;
- suggestions de mapping no-provider si deja visibles ;
- controls / readiness ;
- financial summary preview ;
- financial statements structured preview ;
- workpapers ;
- documents/evidence ;
- document review status ;
- reviewer workpaper decision si deja visible ;
- audit-ready export pack ;
- minimal annex preview.

Surface secondaire possible :

- `/` seulement si un libelle ou lien d'entree minimal est necessaire pour rendre le dossier demo plus comprehensible. Aucun changement profond de l'entree dossiers n'est attendu par defaut.

## Principes UX applicables

- Clarte avant sophistication.
- Workbench financier, pas SaaS generique.
- Tenant et dossier toujours visibles sur les ecrans sensibles.
- Less is more : l'essentiel pour la tache en cours prime.
- Feedback immediat, etats loading/empty/error explicites.
- Statuts, blockers, next action et preuves visibles.
- Accessibilite clavier, focus visible, labels accessibles et contraste.
- Responsive adaptatif, sans clonage aveugle desktop/mobile.
- Aucune information critique transmise par la couleur seule.
- Pas de raw hex ni variants visuels ad hoc dans le code applicatif.
- Previews financieres, export pack et minimal annex restent des surfaces de revue humaine, non statutaires.
- L'IA ne devient pas centrale, autonome ou runtime dans cet increment.

## Contraintes de non-regression

La future implementation ne doit pas regresser les garanties observees en `037` :

- `/api/me` via proxy Vite local peut retourner `200` avec JWT local conserve cote serveur Vite ;
- `/api/me` sans JWT reste rejete par le backend ;
- le mauvais tenant reste rejete ;
- le bearer ne devient pas visible dans le navigateur, l'URL, le storage, le bundle, les logs ou le repo ;
- le frontend principal continue de consommer le backend reel via les endpoints REST existants ;
- aucun mock frontend ne devient la source principale du parcours demo.

Elle ne doit pas regresser les comportements frontend recents :

- refreshs post-action de `033` conserves ;
- historique/diff import de `034` conserve ;
- refresh minimal annex apres creation export pack de `035` conserve ;
- validation fail-closed des payloads sensibles conservee ;
- warnings de refresh partiel conserves et testables ;
- wording non statutaire conserve.

Elle ne doit pas introduire :

- endpoint `/ai` ;
- GraphQL ;
- provider IA, modele, SDK ou prompt runtime ;
- bulk auto-apply ;
- decision IA autonome ;
- wording `CO-ready`, `statutory-ready`, `official financial statements`, `annexe officielle`, `annexe CO finale`, `final CO annex`, `final accounts approved`, `automatically approved`, `AI-approved`, `ready to file`, `certified` ou equivalent.

## Criteres d'acceptation de la future implementation

- La route `/closing-folders/:closingFolderId` presente une synthese haut de page utile avant les details.
- Tenant actif et dossier courant restent visibles.
- Le chemin `closing -> import -> mapping -> controls -> previews -> workpapers/evidence -> export` est visible et comprehensible.
- Les statuts principaux sont lisibles avec libelles metier.
- Les blockers principaux sont visibles et actionnables.
- La longueur percue est reduite par regroupement, hierarchie ou progressive disclosure.
- Le bruit technique est reduit, renomme ou deplace hors du premier niveau de lecture.
- Les surfaces existantes restent accessibles.
- Les previews financieres, l'audit-ready export pack et la minimal annex preview restent non statutaires et soumises a revue humaine.
- Les endpoints REST existants sont conserves.
- Aucune mutation existante n'est changee.
- Aucun endpoint nouveau n'est appele.
- Aucun backend, DB, migration, OpenAPI, CI, IA runtime, GraphQL, secret, token ou `.env` n'est modifie.
- Les tests frontend couvrent la nouvelle hierarchie cockpit et les non-regressions critiques.
- Le build, le lint et les tests frontend passent.

## Criteres d'acceptation de cette creation documentaire

- `specs/active/038-local-demo-closing-workbench-ux-cockpit-v1.md` existe.
- La spec est `Active`.
- La surface est `DOCS_GIT / FRONTEND_SPEC`.
- Le risque est `B`.
- `docs/product/v1-plan.md` reference `038` comme spec active.
- `docs/product/v1-plan.md` ne declare plus `AUCUNE spec active.`
- Aucune spec `039` n'est creee ou ouverte.
- Aucun fichier hors `docs/product/v1-plan.md` et cette spec active n'est modifie.
- Aucun runtime backend, frontend, DB, contrat, migration, CI, IA, GraphQL, RAG, provider, secret, token, `.env` ou runbook n'est modifie.

## Checks attendus apres future implementation

- `pnpm test:ci`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- smoke visuel local attendu, sans secret, sans capture de token et sans valeur `.env`.

## Checks attendus pour cette mission DOCS_ONLY

Commandes attendues :

- `git status --short --branch --untracked-files=all`
- `git diff --name-status`
- `git diff --stat`
- `git diff --check`

Aucun test backend, frontend, DB, navigateur ou runtime ne doit etre lance pour cette creation documentaire.

## Fresh Evidence Pack attendu

Le Fresh Evidence Pack de cette mission DOCS_ONLY doit contenir :

1. Resume documentaire.
2. Demande initiale ou plan valide.
3. Surface reelle.
4. Liste exacte des fichiers modifies.
5. Diff precis par fichier.
6. Commandes reellement executees.
7. Sorties fraiches des checks Git.
8. Statut Git final.
9. Tests ajoutes ou modifies.
10. Tests non executes avec justification DOCS_ONLY.
11. Ecarts eventuels.
12. Risques residuels.
13. Revue humaine recommandee ou non.

Le Fresh Evidence Pack ne doit contenir aucun secret, token, cle, cookie, DSN, credential ou valeur `.env`.

## Gates specialises

- Design/UX review : recommandee pour la future implementation, car l'objectif est de hausser la qualite cockpit et premium.
- Frontend review : recommandee pour verifier layout, accessibilite, responsive et non-regression des surfaces existantes.
- Security/Auth review : non requise si le scope reste frontend UI sans auth, JWT, proxy, storage navigateur, tenant resolution ou backend.
- Tenant/Audit review : non requise si le scope reste affichage frontend des read-models existants et ne change aucune autorisation, aucun audit et aucune mutation.
- CO Review : non requise si le wording non statutaire est conserve et qu'aucune promesse CO/finale n'est introduite.
- CTO Gate : non requis si aucun backend, API, architecture, GraphQL, CI ou dependance structurante n'est ajoute.

Toute derive vers auth, backend, DB, API, securite, tenant, audit, contrats, production ou livrable CO/statutaire doit stopper `038` et exiger un recadrage explicite avant implementation.

## Hors-scope strict

- Backend.
- DB.
- Migration.
- OpenAPI.
- Contrats.
- CI.
- IA runtime.
- Provider IA.
- Modele IA.
- SDK IA.
- Prompt runtime.
- Eval IA.
- RAG ou vector store.
- GraphQL.
- Auth, JWT ou proxy Vite.
- Endpoint de mint token.
- Stockage navigateur de token.
- Nouveau seed.
- Nouvelle donnee demo.
- Nouveau endpoint.
- Nouvelle mutation metier.
- Documents, workpapers ou exports nouveaux.
- Refonte design system globale.
- Nouveau wording CO/statutaire.
- Generation d'etats financiers finaux.
- Annexe legale finale.
- POC complet.
- Secret, `.env`, token, credential ou valeur sensible.
- Spec `039`.

## Revue humaine recommandee

Revue humaine recommandee : oui, legere pour cette creation documentaire.

Motif : la spec ouvre un increment frontend UX sur une demo locale integree touchant visuellement tenant, dossier, statuts, blockers, surfaces evidence/review et wording non statutaire. La revue doit verifier le bornage frontend-only, l'absence de promesse CO/statutaire et l'absence de derive auth/backend/API.
