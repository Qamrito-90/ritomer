# Documentation Governance

## Objectif

Faire du repo la documentation vivante du projet, tout en reservant les documents Word a un role de reference stable, de snapshot de communication et de realignement documentaire explicite.

## Principes directeurs

- Le repo Git est la source de verite vivante.
- Une spec validee n'est pas fermee tant que la mise a jour documentaire minimale du repo n'est pas faite.
- Les Word ne bloquent jamais la fermeture normale d'une spec.
- Les Word ne sont modifies que sur tache documentaire explicite.
- En cas d'ecart entre le repo vivant et un Word non realigne, le repo fait foi jusqu'au prochain realignement documentaire explicite.

## Hierarchie documentaire vivante du repo

### Gouvernance et regles permanentes

- `AGENTS.md`
- `README.md`
- `docs/product/documentation-governance.md`

### Verite operationnelle de phase

- `docs/product/v1-plan.md`
- `docs/adr/*`
- `specs/active/*`
- `specs/backlog/*`
- `specs/done/*`
- `contracts/*`
- `runbooks/*`

### Verite UX du present

- `docs/ui/ui-foundations-v1.md`
- les specs et contrats qui modifient concretement les comportements UX et API exposes au frontend

### Verite IA du present

- `contracts/ai/*`
- `prompts/*`
- `evals/*`
- `knowledge/*`
- les ADR, specs, contrats et runbooks qui cadrent le comportement IA reel

### North Star et bibliotheques de patterns

- `docs/vision/*`
- `docs/playbooks/*`

Ces documents orientent la direction cible et les patterns. Ils ne doivent pas etre modifies a chaque spec si la verite de phase n'a pas change.

### Archive et handoff

- `docs/archive/*`

Ces documents sont des snapshots, des handoffs ou des traces d'alignement. Ils ne sont pas la source de verite vivante par defaut.

## Role des documents Word

Le dossier de reference est :

- `docs/reference-word/`

Les Word y sont des references documentaires stables et des snapshots de communication, pas la documentation vivante de production du repo.

Quand ils existent, leur role attendu est :

- `2.3 Architecture Cadrage V1` : reference operationnelle stable de la phase
- `1.4 UX Cadrage V1` : reference UX stable du present
- `3.3 IA-Cadrage-V1` : reference IA stable du present
- les visions et playbooks Word : North Star et bibliotheques de patterns, pas carnet de bord de chaque spec

Usages autorises des Word :

- realignement documentaire explicite
- snapshot externe
- communication ou partage hors repo

Usages non autorises des Word :

- prerequis systematique pour fermer une spec
- remplacement de la mise a jour documentaire vivante du repo
- source unique du present si le repo a deja ete mis a jour

## Mise a jour minimale obligatoire apres chaque spec validee

Apres validation d'une spec, Codex doit mettre a jour dans le repo, au minimum, ce qui a effectivement change :

- la spec concernee dans `specs/*`, y compris son statut ou son classement si necessaire
- `docs/product/v1-plan.md` si le sequencing, le perimetre V1 ou les decisions gelees ont change
- les ADR impactees si une decision structurante est introduite, retiree ou explicitement arbitree
- les contrats impactes si le comportement contractuel a change
- les runbooks impactes si le demarrage local, l'exploitation ou les incidents changent
- `docs/ui/ui-foundations-v1.md` si la source de verite UI change durablement
- toute documentation de gouvernance impactee si une regle permanente du repo change

La mise a jour minimale attendue est additive et proportionnee : on met a jour ce qui a change, pas tout le corpus.

## Ce qui ne doit etre mis a jour que si la verite de phase change

Ne mettre a jour ces documents que si leur verite propre change reellement :

- `docs/vision/*` si la North Star change
- `docs/playbooks/*` si les patterns de reference changent
- les Word dans `docs/reference-word/*` si une tache explicite de realignement documentaire ou de snapshot externe est demandee
- `docs/archive/*` si un handoff, une archive ou un document supersede doit etre fige
- `AGENTS.md` si une regle permanente de gouvernance, de delivery ou de qualite change

## Workflow documentaire recommande

1. Valider la spec et lister les artefacts documentaires impactes.
2. Mettre a jour la documentation vivante minimale du repo avant de considerer la spec fermee.
3. Verifier si la verite de phase a change.
4. Si la verite de phase a change, mettre a jour les documents vivants structurants concernes.
5. Mettre a jour un Word uniquement si une tache documentaire explicite le demande.
6. Si un Word est produit ou realigne, le deposer dans `docs/reference-word/` comme reference stable, sans remplacer la doc vivante du repo.

## Regle de resolution en cas d'ecart

Si un Word, un handoff ou un snapshot externe diverge du repo vivant :

- la verite vivante du repo prime pour le travail courant
- l'ecart doit etre traite par une tache documentaire explicite
- le realignement Word est optionnel pour la fermeture d'une spec, sauf demande contraire explicite
