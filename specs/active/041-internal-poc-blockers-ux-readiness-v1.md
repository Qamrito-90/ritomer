# 041 - Internal POC blockers UX readiness V1

## Status

Active.

## Surface

DOCS_GIT / QA_MANUAL / FRONTEND_SPEC.

Cette spec cadre le traitement des blockers observes pendant le smoke `040` pour rendre le POC interne plus clair, plus scannable et plus credible.

Cette creation documentaire ne livre aucun code runtime, aucun backend, aucun frontend runtime, aucune DB ou migration, aucun OpenAPI, aucune CI, aucun test runtime lance par Codex, aucun secret, aucun fichier `.env`, aucun token, aucun credential, aucune IA runtime, aucun GraphQL et aucune spec `042`.

La future implementation cadree par `041` doit rester frontend-only sur les surfaces existantes et ne doit changer aucun contrat backend.

## Risk

B.

Le risque vient de surfaces frontend proches de decisions de closing : cockpit, import, mapping, preuves, previews, export et annexe minimale. Le perimetre reste `B` tant que `041` ne touche ni backend, ni DB, ni OpenAPI, ni auth/JWT/proxy, ni tenant resolution, ni audit, ni IA runtime, ni GraphQL, ni dependance structurante, ni promesse CO/statutaire.

Reclasser et recadrer avant implementation si une proposition touche :

- backend, DB, migration ou contrat OpenAPI ;
- authentification, JWT, proxy Vite, session navigateur ou stockage de token ;
- resolution de tenant, autorisation, audit ou separation tenant ;
- nouveau endpoint, nouvelle mutation ou nouvelle donnee demo ;
- IA runtime, provider IA, modele, SDK, prompt runtime, RAG ou GraphQL ;
- export officiel, annexe legale finale ou promesse CO/statutaire ;
- secret, `.env`, token, credential ou valeur sensible ;
- spec `042`.

## Sources relues

- `docs/product/v1-plan.md`
- `specs/done/040-internal-poc-global-smoke-v1.md`
- `specs/done/039-local-demo-data-heavy-ux-polish-v1.md`
- `docs/ui/ui-foundations-v1.md`
- `docs/present/ux-cadrage-v1.md`

Contrats impactes par cette creation documentaire : AUCUN.

Runbooks impactes par cette creation documentaire : AUCUN.

## Probleme observe en 040

Le smoke `040` a produit un verdict `PARTIEL`.

Le socle fonctionne pour une demo interne accompagnee, mais l'experience n'est pas encore assez robuste, lisible et premium pour un POC interne fluide.

Blockers principaux :

- le statut cockpit n'est pas assez comprehensible ;
- le mapping reste trop dense et pas assez scannable ;
- les rubriques Preuves / Justifications restent trop anglo-techniques et pas assez metier ;
- les montants Import restent trop bruts ;
- des libelles techniques residuels affaiblissent la confiance ;
- l'absence de header `Authorization` navigateur et l'absence d'IA runtime doivent etre verifiees explicitement apres correction ;
- un smoke visuel post-correction est necessaire.

## Objectif produit

Rendre le POC interne lisible en parcours court, sans explication orale lourde, tout en conservant les garde-fous evidence-first, human-in-the-loop et non statutaires.

Objectifs concrets :

- rendre le statut cockpit immediatement comprehensible ;
- rendre le mapping plus premium, plus calme et plus scannable ;
- franciser et rendre plus metier les rubriques Preuves / Justifications ;
- formater les montants Import en CHF de facon coherente ;
- nettoyer les libelles techniques residuels visibles par l'utilisateur metier ;
- verifier explicitement l'hygiene reseau sur les headers sensibles sans exposer de secret ;
- verifier explicitement qu'aucune IA runtime n'est appelee ;
- executer un smoke visuel post-correction proportionne.

## Surfaces concernees

Surface principale :

- `/closing-folders/:closingFolderId`

Surfaces UX ciblees :

- cockpit global ;
- import et historique balance ;
- mapping manuel ;
- suggestions no-provider si un libelle adjacent reste technique ;
- Preuves / Justifications ;
- previsualisations, export pack et annexe minimale uniquement si un libelle technique residuel cree une ambiguite.

## Exigences frontend attendues

### Cockpit - statut comprehensible

Le statut global doit etre lisible comme une consequence metier, pas comme un etat technique.

La future implementation doit :

- presenter un libelle court et metier ;
- expliquer la prochaine action associee ;
- distinguer pret, bloque, a completer et a revoir sans s'appuyer sur la couleur seule ;
- eviter les codes internes comme premier niveau de lecture ;
- conserver tenant, dossier, prochaine action, blockers et progression visibles.

### Mapping - premium et scannable

Le mapping doit devenir une surface de revue fiduciaire calme.

La future implementation doit :

- reduire la densite visuelle ;
- rendre comptes source, libelles, codes et cibles lisibles en scan rapide ;
- contenir les codes longs sans chevauchement ni scroll horizontal sauvage ;
- aligner les actions unitaires de facon previsible ;
- garder le mapping manuel comme autorite metier ;
- ne pas introduire d'auto-apply, bulk auto-apply, preselection silencieuse ou decision IA autonome ;
- garder les suggestions no-provider comme aides a revue humaine uniquement.

### Preuves / Justifications - rubriques metier et francaises

Les rubriques doivent etre comprehensibles par un utilisateur fiduciaire francophone.

La future implementation doit privilegier des libelles comme :

- `Justification` ;
- `Pieces` ;
- `Verification` ;
- `Revue maker/checker` ou equivalent metier plus clair si disponible ;
- `Decision` ;
- `A documenter` ;
- `A revoir` ;
- `Verifie` ;
- `Retourne` ;
- `Ancienne version` pour stale si expose.

Les termes internes ou anglo-techniques ne doivent pas dominer le premier niveau de lecture.

### Import - montants CHF

Les montants Import doivent etre lisibles et coherents avec la source UI.

La future implementation doit :

- formater les montants en CHF ;
- utiliser des chiffres tabulaires ;
- aligner les colonnes numeriques a droite quand une structure tabulaire est employee ;
- conserver dates, periodes, versions et historique lisibles ;
- eviter les montants bruts non localises au premier niveau de lecture.

Format cible documentaire : `CHF 12 345.67`.

### Nettoyage des libelles techniques residuels

Les libelles visibles par l'utilisateur metier doivent etre audites sur les surfaces touchees.

La future implementation doit :

- remplacer les codes internes comme premier niveau de lecture par des libelles metier ;
- deplacer les details techniques utiles en niveau secondaire quand ils aident au diagnostic ;
- conserver les preuves, statuts et decisions auditables ;
- ne pas masquer une information critique derriere hover-only ;
- ne pas creer de nouveau dictionnaire produit contradictoire avec `docs/ui/ui-foundations-v1.md`.

## Verification manuelle obligatoire apres correction

Le smoke post-correction doit verifier explicitement, sans capturer de secret :

- dossier demo ouvrable ;
- cockpit plus comprehensible ;
- mapping plus scannable ;
- rubriques Preuves / Justifications plus metier et francaises ;
- montants Import formates en CHF ;
- absence de libelles techniques residuels bloquants ;
- absence de header `Authorization` visible dans les Request Headers navigateur, sans copier de header ni valeur ;
- absence de token, bearer, secret, credential, DSN ou valeur `.env` visible dans URL, storage navigateur, UI, logs partages ou repo ;
- absence d'appel IA runtime observe dans le parcours, sans exposer de configuration locale ;
- posture non statutaire toujours visible sur previews, export pack et annexe minimale ;
- aucune impression d'export officiel ou d'annexe legale finale ;
- aucune regression de scroll horizontal sauvage ou chevauchement action/contenu a largeur desktop representative.

## Criteres d'acceptation

- `040` reste cloturee en `PARTIEL`.
- `041` reste la seule spec active ouverte par cette decision.
- Le statut cockpit est comprehensible sans explication technique.
- Le mapping est plus premium, plus calme et plus scannable.
- Les rubriques Preuves / Justifications sont plus metier et francaises.
- Les montants Import sont formates en CHF.
- Les libelles techniques residuels bloquants sont nettoyes ou relegues en secondaire.
- Les headers reseau sensibles sont verifies explicitement sans documenter de valeur sensible.
- L'absence d'IA runtime est verifiee explicitement sans exposer de secret ou configuration locale.
- Le smoke visuel post-correction est documente.
- Aucune promesse CO-ready, statutory-ready, officielle, certifiee, prete au depot, export officiel ou annexe legale finale n'apparait.
- Aucun backend, DB/migration, OpenAPI, auth/JWT/proxy, nouveau endpoint, nouvelle mutation, IA runtime, GraphQL, export officiel, annexe legale finale, secret, `.env`, token, credential ou spec `042` n'est introduit.

## Hors-scope strict

- Backend.
- DB.
- Migration.
- OpenAPI.
- Auth, JWT ou proxy.
- Session navigateur ou stockage de token.
- Nouvelle mutation.
- Nouveau endpoint.
- Nouveau seed.
- Nouvelle donnee demo.
- IA runtime.
- Provider IA.
- Modele IA.
- SDK IA.
- Prompt runtime.
- RAG ou vector store.
- GraphQL.
- CI.
- Export officiel.
- Annexe legale finale.
- Promesse CO ou statutaire.
- POC public.
- Pilote client.
- Refonte design system globale.
- Secret, `.env`, token, credential ou valeur sensible.
- Spec `042`.

## Checks attendus pour cette creation DOCS_ONLY

Commandes autorisees et attendues :

- `git status --short --branch --untracked-files=all`
- `git diff --name-status`
- `git diff --stat`
- `git diff --check`
- `git diff --cached --name-status`

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

## Revue humaine recommandee

Revue humaine recommandee : oui.

Motif : `041` touche la lisibilite POC de surfaces frontend sensibles, la verification de headers reseau, l'absence d'IA runtime observee et la preservation des garde-fous non statutaires.
