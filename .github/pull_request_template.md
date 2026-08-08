# Pull Request

Si un champ n’est pas applicable, écrire `AUCUN`.
Si une information n’est pas déterminée, écrire `NON DÉTERMINÉ`.
`PENDING` est autorisé uniquement pour une étape future explicitement attendue après la création de la PR.
Pour un risque C, les champs requis relatifs aux checks, au Reviewer exact-head, à l’Owner Decision et à l’autorisation de merge doivent être finalisés avant le merge. Un champ owner réellement non applicable reste `AUCUN` ou `NON_APPLICABLE`, jamais artificiellement obligatoire.

## Résumé

- Objectif métier ou documentaire :
- Spec ou ticket :
- Surface : `BACKEND` / `FRONTEND` / `DB` / `CONTRACTS` / `CI_GIT` / `GITHUB_GOVERNANCE` / `DOCS` / `FULLSTACK` / `QA_MANUAL` / `OFF_REPOSITORY_ARTIFACT` / `SENSITIVE_EXECUTION` / `PRODUCTION` / `NON_DÉTERMINÉ`
- Risque : `A` / `B` / `C`
- `EVIDENCE_LEVEL` : `LITE` / `STANDARD` / `FULL`
- Justification du niveau de risque :
- `TECHNICAL_STATUS` : `PASS` / `PASS_WITH_RESIDUAL_RISK` / `FAIL` / `INCONCLUSIVE`
- `WORKFLOW_VERDICT` : valeur autorisée par le prompt actif applicable

## Scope

- File-set exact :
- Hors scope explicite :
- Résumé matériel du diff :

## Risques

- Risques touchés selon `RISK_REGISTER.md` :
- Garde-fous appliqués :
- Risques et limites résiduels :
- `EXTERNAL_HUMAN_EXPERTISE` : `YES` / `RECOMMENDED` / `NO` ; déclencheur exact :
- `VALIDATION_PROFESSIONNELLE_METIER` : requise / fournie / `NON_APPLICABLE` ; justification :

## Tests et checks

- Commandes et checks locaux réellement exécutés, avec résultats :
- Checks non exécutés avec justification :
- Workflow `Backend CI` — job/required context `backend` :
- Workflow `Frontend CI` — job/required context `frontend` :

## Autorisations et livraison GitHub

- Cible exacte et reviewed head SHA :
- `IMPLEMENTATION_AUTHORIZED` :
- `DELIVERY_AUTHORIZED` :
- `MERGE_AUTHORIZED` : `YES` / `NO` / `NOT_REQUIRED` / `NON_DÉTERMINÉ`
- `SENSITIVE_EXECUTION_AUTHORIZED` :
- `PRODUCTION_AUTHORIZED` :
- `DELIVERY_COMPLETE` : constat, jamais autorisation
- `AUTHORIZATION_RECORDS` applicables — `TYPE`, `STATUS`, `RECORD_ID`, `BOUND_OBJECT`, `BOUND_SCOPE`, `CONDITIONS` :
- `OWNER_DECISION_REQUIRED` : `YES` / `NO`
- `OWNER_DECISION_RECORD` applicable — record complet avec tous les champs obligatoires définis dans `AGENTS.md`, ou `AUCUN` :
- Independent AI Technical Review pour C — cible exacte, résultat et classifications `AI_GENERATED_REVIEW` / `NOT_HUMAN_SIGNED` / `FUNCTIONAL_INDEPENDENCE_ONLY`, ou `NON REQUISE À CE STADE` :
- Méthode de merge requise : `SQUASH_ONLY`
- Protection du head revu : `--match-head-commit <reviewed head SHA>`
- Non-autorisations explicites : push direct sur `main`, force-push, `--admin`, merge commit, rebase merge, bypass des protections et changement hors scope.
- Attentes de vérification post-merge : PR mergée ; commit final mono-parent ; tree source/final cohérent ; diff exact ; branche source supprimée ; `main` synchronisée ; worktree et index propres ; aucun fichier non suivi.

## Documentation et contrats

- Docs vivantes impactées :
- Specs active/done impactées :
- Contrats impactés :
- Runbooks impactés :

## Fresh Evidence Pack final

Les sections précédentes font partie du Fresh Evidence Pack final et ne sont pas dupliquées ici.

- Preuves complémentaires utilisées :
- Statut Git final :
- Tests ajoutés ou modifiés :
- Écarts éventuels au plan validé :

## Checklist finale

- [ ] Scope et file-set exact respectés
- [ ] Reviewed head SHA présent et exact
- [ ] Aucun secret, token, cookie, DSN ou credential ajouté ou exposé
- [ ] Pas de dérive hors mission
- [ ] Checks locaux adaptés à la surface et au risque ; checks non exécutés justifiés
- [ ] Required contexts `backend` et `frontend` présents et verts quand le ruleset les exige
- [ ] Corps final de PR synchronisé après checks, review exact-head, décision owner et autorisation de merge applicables
- [ ] Aucun `PENDING` requis ne subsiste avant le merge
- [ ] Head SHA inchangé pendant la synchronisation finale du corps de PR
- [ ] Documentation vivante, specs, contrats ou runbooks mis à jour si nécessaire
- [ ] Review IA jamais présentée comme signature humaine ou preuve de séparation des fonctions
- [ ] Pour C, Reviewer séparé, Owner Decision Record et autorisation de merge portent sur le même head SHA exact
- [ ] Aucun `APPROVE` ou `APPROVE_WITH_CONDITIONS` après `FAIL` ou `INCONCLUSIVE` décisif
- [ ] Aucune autorisation n’est déduite d’un statut, d’une décision owner ou d’un autre marqueur
- [ ] Merge exclusivement `SQUASH_ONLY`
- [ ] `--match-head-commit` utilisé avec le reviewed head SHA exact
- [ ] Vérification post-merge exécutée et reportée
- [ ] Pour un risque C, `MERGE_AUTHORIZED=YES` obtenu séparément avant le merge
