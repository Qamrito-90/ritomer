# Pull Request

Si un champ n’est pas applicable, écrire `AUCUN`.
Si une information n’est pas déterminée, écrire `NON DÉTERMINÉ`.

## Résumé

- Objectif métier ou documentaire :
- Spec ou ticket :
- Surface : `DOCS_ONLY` / `DOCS_GIT` / `FRONTEND` / `BACKEND` / `DB/MIGRATION` / `CONTRACTS` / `CI/GIT` / `FULLSTACK`
- Risque : `A` / `B` / `C`
- Justification du niveau de risque :

## Scope

- File-set exact :
- Hors scope explicite :
- Résumé matériel du diff :

## Risques

- Risques touchés selon `RISK_REGISTER.md` :
- Garde-fous appliqués :
- Risques et limites résiduels :
- Revue humaine technique recommandée : oui / non
- Justification :

## Tests et checks

- Commandes et checks locaux réellement exécutés, avec résultats :
- Checks non exécutés avec justification :
- Required checks GitHub attendus :
  - `Backend CI` :
  - `Frontend CI` :

## Livraison GitHub

- Reviewed head SHA :
- Marqueur de delivery : `DELIVERY_AUTHORIZED=YES` / `NO`
- Marqueur de merge pour risque C : `MERGE_AUTHORIZED=YES` / `NO` / `AUCUN` pour les risques A et B
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
- [ ] `Backend CI` et `Frontend CI` présents et verts quand le ruleset les exige
- [ ] Documentation vivante, specs, contrats ou runbooks mis à jour si nécessaire
- [ ] Review IA jamais présentée comme signature humaine ou preuve de séparation des fonctions
- [ ] Merge exclusivement `SQUASH_ONLY`
- [ ] `--match-head-commit` utilisé avec le reviewed head SHA exact
- [ ] Vérification post-merge exécutée et reportée
- [ ] Pour un risque C, `MERGE_AUTHORIZED=YES` obtenu séparément avant le merge
