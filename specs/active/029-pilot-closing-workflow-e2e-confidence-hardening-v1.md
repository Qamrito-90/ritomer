# Spec 029 - Pilot Closing Workflow E2E Confidence Hardening V1

## 1. Statut

Status: Active

Surface: FRONTEND_FIRST / POSSIBLE_FULLSTACK_IF_API_GAP

Risk: C for future implementation

Mission type: Product workflow hardening

## 2. Contexte

`027-annexe-minimale-v1` a livre un read-model backend et un contrat OpenAPI pour une annexe minimale operationnelle, non statutory / non statutaire, non persistee, non exportee et sans IA. Cette annexe expose explicitement `isStatutory = false` et `requiresHumanReview = true`.

`028-docs-present-realignment-after-027-v1` a realigne les documents canoniques du present UX et IA apres `027`, sans creer de nouvelle capacite produit et sans activer d'IA runtime.

Le repo dispose maintenant d'un socle V1 solide : closing folder, import balance, mapping manuel, controls/readiness, financial summary preview, financial statements structured preview, workpapers, evidence documents, evidence verification, exports audit-ready et minimal annex backend.

Le gap principal n'est plus l'absence de capacites backend ou contractuelles. Le gap principal est que le parcours fiduciaire E2E n'est pas encore assez visible, guidant et utilisable depuis l'interface pour une fiduciaire pilote.

Le Decision Gate 029 a tranche en faveur de l'option B : `029-pilot-closing-workflow-e2e-confidence-hardening-v1`. La V1 doit d'abord devenir pilotable en conditions reelles avant d'activer le mapping assiste par IA. L'IA mapping assiste reste importante, mais elle doit attendre un workflow humain complet, comprehensible et mesurable.

## 3. Probleme

Le produit contient des capacites backend et contrats importantes, mais l'utilisateur fiduciaire ne peut pas encore traverser proprement tout le workflow V1 depuis l'UI sans aide externe, logs ou appels API manuels.

Problemes a couvrir :

- la review finale workpaper est insuffisamment exposee dans l'interface ;
- les exports audit-ready existent cote backend/contrat mais restent peu ou pas pilotables en UI ;
- l'annexe minimale existe cote backend/contrat mais n'est pas visible en UI ;
- le statut global du dossier reste insuffisamment explicite pour savoir ce qui est fait, bloque ou pret ;
- le produit risque de fonctionner en demo guidee plutot qu'en usage pilote reel ;
- la valeur metier ne peut pas etre mesuree correctement tant que le workflow V1 n'est pas complet de bout en bout.

## 4. Objectif

Permettre a un utilisateur fiduciaire de conduire un dossier V1 jusqu'a un etat review-ready et audit-pack-ready depuis l'interface, sans appel API manuel.

Workflow cible :

1. closing folder ;
2. import balance ;
3. mapping ;
4. controls/readiness ;
5. financial previews non statutaires ;
6. workpapers ;
7. evidence documents ;
8. evidence verification ;
9. reviewer decision ;
10. audit pack export ;
11. minimal annex preview.

Termes autorises pour l'implementation future :

- preview ;
- non statutory / non statutaire ;
- human review required ;
- review-ready ;
- audit-pack-ready ;
- evidence verified ;
- evidence rejected ;
- blocked ;
- ready for review.

Termes interdits dans l'UX produit :

- CO-ready ;
- statutory-ready ;
- official financial statements ;
- automatically approved ;
- AI-approved ;
- autonomous closing ;
- final CO annex.

## 5. Utilisateurs concernes

### Collaborateur fiduciaire

Job-to-be-done : preparer un dossier de closing fiable en important la balance, en completant le mapping, en redigeant les workpapers et en rattachant les preuves.

Besoin dans cette spec : voir les etapes manquantes, comprendre les blockers, acceder rapidement aux previews, workpapers et preuves, puis savoir quand le dossier peut passer en review.

Risque de confusion : croire qu'une preview ou une annexe minimale remplace un livrable officiel.

Moment de valeur attendu : le collaborateur voit immediatement ce qui manque et peut rendre le dossier ready for review sans appeler une API manuelle.

### Responsable de dossier

Job-to-be-done : piloter l'avancement du closing, arbitrer les priorites et eviter qu'un dossier bloque reste invisible.

Besoin dans cette spec : disposer d'une synthese de progression claire, fondee sur les read models existants, avec les statuts done / missing / ready / blocked / generated.

Risque de confusion : assimiler audit-pack-ready a une finalisation reglementaire.

Moment de valeur attendu : le responsable sait en moins d'une minute si le dossier est review-ready, audit-pack-ready ou bloque.

### Reviewer

Job-to-be-done : verifier les workpapers, consulter les preuves, distinguer preuves verifiees et rejetees, puis prendre les decisions disponibles selon les gates existants.

Besoin dans cette spec : voir les documents attaches, leur verification status, les blockers et les actions reviewer contractees si elles sont disponibles.

Risque de confusion : penser qu'une preuve rejetee disparait du dossier alors qu'elle reste une trace explicite.

Moment de valeur attendu : le reviewer peut finaliser ou retourner une decision sans perdre le contexte workpaper / evidence.

### Manager / associe

Job-to-be-done : evaluer si un dossier pilote est exploitable, audit-ready et suffisamment clair pour une fiduciaire en conditions reelles.

Besoin dans cette spec : visualiser les limites non statutaires, l'etat du pack audit-ready et l'annexe minimale preview sans entrer dans chaque detail operationnel.

Risque de confusion : presenter trop tot le dossier comme un livrable CO ou comme des comptes annuels officiels.

Moment de valeur attendu : le manager peut juger le niveau de confiance operationnelle du dossier avant revue humaine ou handoff audit.

## 6. Perimetre inclus

### 6.1 Dossier progress summary

Creer ou ameliorer une synthese de progression du dossier fondee sur les read models existants.

Elle doit afficher :

- import balance : done / missing ;
- mapping : ready / incomplete ;
- controls : ready / blocked ;
- financial previews : available / blocked ;
- workpapers : current / stale / missing ;
- evidence documents : uploaded / verified / rejected / missing ;
- review : ready / blocked ;
- audit pack : ready / blocked / generated ;
- minimal annex preview : ready / blocked.

Le but n'est pas un dashboard sophistique. Le but est que le responsable de dossier voie immediatement ce qui manque.

Sources probables :

- closing folders API ;
- import balance API ;
- manual mapping API ;
- controls API ;
- financial summary API ;
- financial statements structured API ;
- workpapers API ;
- documents/evidence metadata exposes via workpapers API ;
- exports API ;
- minimal annex API.

### 6.2 Reviewer workpaper decision UI

Exposer ou finaliser l'experience reviewer sur les workpapers si les APIs existantes le permettent.

Inclure :

- affichage du statut workpaper ;
- affichage des preuves liees ;
- distinction preuves verifiees / rejetees / non verifiees ;
- action reviewer si disponible ;
- message clair si l'action est bloquee ;
- aucune validation automatique ;
- aucun contournement des gates existants.

Le contrat `workpapers-api.yaml` expose deja `POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/review-decision`. L'implementation future doit verifier si le frontend peut consommer ce contrat sans changement.

### 6.3 Export audit pack UI

Exposer les export packs audit-ready existants.

Inclure :

- liste des export packs ;
- creation d'un export pack ;
- statut de generation ;
- telechargement via backend ;
- messages d'erreur ;
- indication claire si le pack est bloque ;
- aucune exposition de `storage_object_key` ;
- wording clair : audit-ready pack, pas livrable CO officiel.

Le contrat `exports-api.yaml` expose deja la liste, la creation idempotente, la lecture de metadata et le download backend-only. L'UI doit utiliser ces chemins, y compris `Idempotency-Key` pour la creation.

Comme l'export pack V1 est synchrone dans le contrat actuel, le statut de generation peut etre represente par l'etat UI de la requete puis par la presence d'un pack genere dans la liste. `029` ne doit pas inventer de polling, de worker status ou de nouvel endpoint d'export.

### 6.4 Minimal annex preview UI

Exposer l'annexe minimale existante.

Inclure :

- consultation read-only ;
- blockers ;
- warnings ;
- statut ready / blocked ;
- mention claire "non statutory / non statutaire" ;
- mention human review required ;
- aucune exportation obligatoire ;
- aucune persistance nouvelle sauf rupture contractuelle justifiee ;
- aucune pretention CO complete.

Le contrat `minimal-annex-api.yaml` expose deja `GET /api/closing-folders/{closingFolderId}/minimal-annex`, `annexState`, `blockers[]`, `warnings[]`, `isStatutory = false` et `requiresHumanReview = true`.

### 6.5 Wording produit

Harmoniser les termes :

- preview ;
- review-ready ;
- audit-pack-ready ;
- non statutory ;
- human review required ;
- blocked ;
- ready for review.

Ne pas introduire :

- CO-ready ;
- statutory-ready ;
- official financial statements ;
- final CO annex.

## 7. Hors-scope

Sont explicitement hors-scope de `029` :

- IA ;
- IA mapping assiste ;
- chatbot ;
- agents autonomes ;
- moteur CO ;
- etats financiers CO officiels ;
- annexe CO complete ;
- PDF final statutaire ;
- Word/PDF de comptes annuels ;
- signature electronique ;
- nouvelle integration comptable ;
- GraphQL ;
- microservices ;
- dashboard analytics complet ;
- BI avancee ;
- audit viewer complet ;
- GED avancee ;
- mobile avance ;
- refonte UX large ;
- pricing ;
- go-to-market.

## 8. UX attendue

Parcours utilisateur attendu :

1. ouvrir un closing folder ;
2. voir l'etat global du dossier ;
3. voir ce qui est pret et ce qui bloque ;
4. acceder aux previews financieres non statutaires ;
5. consulter / modifier les workpapers selon role ;
6. voir les preuves ;
7. permettre au reviewer de verifier ou consulter les decisions disponibles ;
8. creer ou consulter un audit pack ;
9. telecharger un audit pack ;
10. consulter l'annexe minimale preview ;
11. voir les limites non statutaires sur les ecrans critiques.

L'UX doit rester sobre, professionnelle et fiduciary-grade. Elle doit privilegier la comprehension de l'etat dossier sur la decoration visuelle.

Etats attendus :

- etats vides : absence d'import, mapping incomplet, aucun workpaper, aucune preuve, aucun export pack, annexe blocked ;
- etats loading : chargement non ambigu des read models, sans masquer le contexte dossier ;
- etats bloques : statut blocked, raison lisible, next action si le contrat l'expose ;
- erreurs 403 : role ou tenant inaccessible, sans fuite de donnees ;
- erreurs 404 : dossier, document ou export pack absent ou hors tenant, wording neutre ;
- erreurs 409 : action bloquee par closing archived, readiness non READY, stale anchor, workpaper non eligible, idempotency conflict ou gate metier ;
- feedback apres action : upload, verification decision, workpaper decision, creation export pack et download error doivent produire un retour explicite ;
- messages de securite : download backend-only, aucun storage key visible, human review required sur les surfaces critiques.

Les ecrans critiques doivent toujours conserver le contexte tenant / dossier visible. Les statuts ne doivent pas dependre uniquement de la couleur.

## 9. Backend / API

APIs existantes probablement consommees :

- closing folders API ;
- controls API ;
- financial summary API ;
- financial statements structured API ;
- workpapers API ;
- documents / evidence API ;
- exports API ;
- minimal annex API ;
- import balance API ;
- manual mapping API.

Regle de `029` :

Aucun nouvel endpoint ne doit etre ajoute dans `029` sauf rupture contractuelle demontree.

Si une rupture contractuelle existe pendant l'implementation future :

- la documenter precisement dans la PR ou la spec d'implementation ;
- citer le contrat concerne ;
- expliquer pourquoi l'API actuelle ne suffit pas ;
- proposer le changement minimal ;
- verifier la compatibilite tenant, audit, RBAC et donnees sensibles ;
- ne pas l'implementer sans CTO Gate prealable.

Ruptures contractuelles candidates a verifier, sans presumer leur existence :

- absence d'un champ frontend indispensable pour calculer un statut de progression ;
- impossibilite de distinguer ready / blocked / generated pour export pack sans extrapolation fragile ;
- absence d'erreur exploitable par l'UI pour afficher un blocker lisible ;
- impossibilite de consommer une action reviewer deja contractee depuis le contexte visible actuel.

## 10. DB / contrats

Par defaut pour `029` :

- aucune migration DB ;
- aucune nouvelle table ;
- aucune modification de contrat lourde ;
- aucune persistance nouvelle de progress summary ;
- aucune persistance nouvelle de minimal annex preview ;
- aucune modification retroactive d'export pack.

Si une modification OpenAPI est necessaire plus tard :

- elle doit etre minimale ;
- elle doit etre justifiee par un besoin UI E2E reel ;
- elle doit etre compatible avec tenant/audit/security ;
- elle doit etre documentee clairement ;
- elle doit etre traitee comme surface sensible.

Toute modification OpenAPI touchant exports, downloads, documents, evidence, RBAC, backend, tenant scoping, audit ou donnees sensibles bascule en CTO Gate obligatoire avant code.

## 11. Securite / tenancy / audit

Exigences non negociables :

- tous les appels restent tenant-scoped via les contrats existants ;
- aucun cross-tenant leakage ;
- aucun `storage_object_key` expose ;
- telechargements toujours via backend ;
- RBAC respecte ;
- aucune donnee sensible inutile dans les logs ;
- aucun secret cote frontend ;
- mutations existantes conservent leurs audit events ;
- GET read models ne creent pas d'audit event sauf convention existante contraire ;
- aucune decision engageante automatisee.

Les surfaces exports, downloads, documents et evidence sont sensibles. Le frontend ne doit jamais reconstruire ou afficher une cle de stockage, une URL objet privee, un signed URL public ou un chemin interne.

Si l'implementation touche exports, downloads, documents, RBAC, backend, contrats ou tenant scoping, CTO Gate obligatoire avant code.

## 12. IA

Cette spec ne contient aucune IA.

Justification : le workflow humain doit etre complet, comprehensible et mesurable avant d'introduire l'IA.

Rappel hors `029` : le premier cas IA envisage ulterieurement reste le mapping assiste controle, avec schema strict, preuves, accept / modify / reject, logs, feature flag et human-in-the-loop.

`029` ne doit pas ajouter de prompt, eval, modele, agent, chatbot, RAG, orchestration IA ou appel modele direct depuis le frontend.

## 13. Preparation future CO sans construire CO

`029` prepare la trajectoire CO en clarifiant le workflow et les mots visibles, sans construire CO.

A preparer :

- distinction claire preview / review-ready / audit-pack-ready ;
- aucune confusion avec CO-ready ;
- possibilite future de rattacher preuves et workpapers aux rubriques financieres ;
- coherence du wording autour des etats structures non statutaires ;
- annexe minimale clairement positionnee comme preview operationnelle.

A repousser :

- moteur CO ;
- annexe CO complete ;
- PDF final ;
- validation statutaire ;
- generation officielle des comptes annuels.

CO / Fiduciaire Review recommandee avant implementation si la spec ou l'UI modifie le wording de l'annexe, des etats financiers, ou des statuts proches de CO.

## 14. Tests attendus pour l'implementation future

Frontend :

- tests composants pour progress summary ;
- tests export block ;
- tests minimal annex preview ;
- tests reviewer decision si exposee ;
- tests hooks / API clients ;
- tests route dossier avec mocks ;
- tests etats loading / error / empty / blocked ;
- test blob download export ;
- test absence d'exposition de storage key ;
- test wording non statutaire.

Backend :

- uniquement si comportement backend ou contrat modifie ;
- sinon pas de tests backend requis.

Securite :

- 403 / 404 / 409 ;
- tenant-scoped errors ;
- aucun secret ;
- aucun storage key expose.

Accessibilite :

- boutons d'action ;
- labels principaux ;
- messages d'erreur ;
- etats bloquants.

Checks attendus :

- frontend tests ;
- frontend lint ;
- frontend build ;
- backend tests seulement si backend modifie ;
- `git diff --check`.

## 15. Criteres d'acceptation

- un utilisateur peut parcourir un closing folder V1 complet depuis l'UI ;
- l'etat global du dossier est comprehensible sans logs ou appels API manuels ;
- les previews financieres sont clairement non statutaires ;
- le reviewer peut consulter ou finaliser les decisions disponibles selon les regles existantes ;
- les preuves verifiees, rejetees ou manquantes sont visibles ;
- l'utilisateur peut creer un audit pack depuis l'UI ;
- l'utilisateur peut telecharger un audit pack sans exposition de storage key ;
- l'utilisateur peut consulter l'annexe minimale read-only ;
- l'annexe minimale affiche blockers, warnings et limites non statutaires ;
- l'UI distingue review-ready et audit-pack-ready ;
- l'UI n'utilise jamais CO-ready ou statutory-ready ;
- aucun appel API manuel n'est necessaire pour finir le parcours V1 ;
- aucun nouvel endpoint n'est ajoute sauf rupture contractuelle documentee ;
- les tests frontend passent ;
- les docs durables sont mises a jour uniquement si la verite produit change.

## 16. Risques et mitigations

| Risque | Gravite | Mitigation | Gate eventuel |
|---|---:|---|---|
| Confusion review-ready vs CO-ready | C | Wording strict, badges non statutaires, interdiction des termes CO-ready et statutory-ready dans l'UX produit. | CO / Fiduciaire Review si wording proche CO. |
| Confusion annexe minimale vs annexe CO | C | Mention visible non statutory / non statutaire et human review required ; aucune promesse d'annexe officielle. | CO / Fiduciaire Review recommandee. |
| Export percu comme livrable final | C | Employer audit-ready pack, pas livrable officiel ; afficher que le pack sert au handoff et reste soumis a revue humaine. | CTO Gate si export/download touche backend ou contrat. |
| Scope creep vers PDF / CO / IA | C | Hors-scope explicite ; refuser PDF final, moteur CO, annexe complete, IA mapping assiste et agents autonomes dans `029`. | CTO Gate ou CO Review selon derive. |
| UX trop dense | B | Progress summary concise, priorite aux blockers et next actions ; pas de dashboard analytics complet. | Product review recommande. |
| Idempotency export mal comprise | C | UI doit gerer `Idempotency-Key`, replays 200/201 et conflits 409 avec message clair. | CTO Gate si logique export change. |
| Securite telechargement | C | Download uniquement via backend, aucun storage key, aucun signed URL public, test d'absence de fuite. | CTO Gate obligatoire. |
| Absence d'analytics jusqu'a la spec suivante | B | Ne pas bloquer `029` ; conserver feedback qualitatif pilote et logs produit existants si disponibles. | Aucun par defaut. |
| Parcours reviewer incomplet si API actuelle insuffisante | C | Verifier `workpapers-api.yaml` et documenter toute rupture contractuelle avant code. | CTO Gate si endpoint, RBAC ou gate change. |
| Lancement pilote trop tot avec donnees reelles | C | Exiger donnees pilote maitrisees, revue humaine, messages non statutaires et verification tenant/RBAC. | CTO Gate + CO / Fiduciaire Review avant pilote reel. |

## 17. Gates avant implementation

CTO Gate obligatoire avant implementation si la mission touche :

- exports ;
- downloads ;
- documents ;
- evidence ;
- RBAC ;
- backend ;
- contrats ;
- tenant scoping ;
- audit ;
- donnees sensibles ;
- risque C technique.

CO / Fiduciaire Review recommandee si la mission touche :

- wording annexe ;
- etats financiers ;
- CO ;
- review-ready / audit-pack-ready ;
- livrable final ;
- promesse reglementaire.

Expert Review Board non requis pour cette spec sauf si la spec devient un changement de phase ou prepare un pilote reel.

## 18. Fresh Evidence Pack attendu apres implementation future

Codex devra fournir :

- resume metier ;
- demande initiale ou plan valide ;
- surface de mission ;
- fichiers modifies ;
- resume du diff par fichier ;
- commandes executees ;
- sorties tests/checks ;
- statut Git ;
- tests ajoutes/modifies ;
- tests non executes avec justification ;
- ecarts au plan ;
- risques residuels ;
- revue humaine recommandee ou non.

Le Fresh Evidence Pack ne devra contenir aucun secret, token, cle, cookie, DSN, credential ou valeur `.env`.

## 19. Conclusion

Cette spec doit transformer le socle existant en workflow pilote credible.

Elle ne doit pas construire CO.

Elle ne doit pas construire IA.

Elle ne doit pas etre un refactor decoratif.

Elle doit rendre Ritomer utilisable de bout en bout pour une fiduciaire pilote.
