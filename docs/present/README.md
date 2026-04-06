# Documentation du present V1

## Role

Le dossier `docs/present/` porte la synthese canonique du present pour l'execution produit.

Il sert de point d'entree maintenable pour trois verites de phase :

- UX
- architecture
- IA

Cette couche ne remplace pas les artefacts vivants detailles du repo. Elle les synthetise pour eviter une dependance quotidienne aux documents Word.

## Contenu

- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ai-cadrage-v1.md`

## Ce qui est vrai maintenant

- `docs/present/*` est la couche canonique markdown du present pour UX, architecture et IA.
- Le repo vivant reste la source de verite ; `docs/present/*` en est la synthese d'execution.
- Les Word de `docs/reference-word/*` restent des snapshots stables et ne servent pas de base quotidienne de delivery.
- Chaque document de `docs/present/*` doit rester court, normatif et oriente execution.

## Ce qui est explicitement hors scope maintenant

- convertir les Word mot a mot en markdown
- utiliser `docs/present/*` comme doublon des specs, ADRs, contrats ou runbooks
- transformer `docs/vision/*` ou `docs/playbooks/*` en documentation de delivery quotidienne
- utiliser un Word comme source prioritaire du present

## Decisions non negociables du present

- `docs/present/*` doit toujours s'aligner sur les artefacts vivants de priorite superieure du repo.
- En cas d'ecart, le markdown canonique du repo prime toujours sur les Word.
- `docs/present/*` n'est mis a jour que si la verite du present change reellement.
- `docs/present/*` reste une couche d'entree et de synthese, pas une couche de detail exhaustif.

## Difference avec les autres couches documentaires

- `docs/vision/*` : North Star long terme
- `docs/playbooks/*` : bibliotheques de patterns et garde-fous
- `docs/present/*` : verite du present synthetisee et orientee execution
- `docs/product/v1-plan.md` : sequencing V1 et decisions gelees
- `docs/adr/*` : decisions structurantes acceptees
- `specs/*` : bornage et details des vagues / capacites
- `contracts/*` : verite contractuelle des API, schemas, references et persistence
- `runbooks/*` : verite d'exploitation et de fonctionnement
- `docs/ui/ui-foundations-v1.md` : source de verite UI codable
- `docs/archive/*` : handoffs et snapshots historises
- `docs/reference-word/*` : references stables et snapshots externes

## Artefacts vivants detailles du repo

- `AGENTS.md`
- `docs/product/documentation-governance.md`
- `docs/adr/*`
- `docs/product/v1-plan.md`
- `specs/*`
- `contracts/*`
- `runbooks/*`
- `docs/ui/ui-foundations-v1.md`

## Precedence documentaire

`docs/present/*` est la couche canonique de synthese du present, mais elle doit rester alignee sur les sources vivantes de priorite superieure.

En cas d'ecart, l'ordre de precedence a appliquer est :

1. `AGENTS.md`
2. `docs/product/documentation-governance.md`
3. `docs/adr/*`
4. `docs/product/v1-plan.md`
5. `specs/done/*` et `specs/active/*`
6. `contracts/*`
7. `runbooks/*`
8. `docs/ui/ui-foundations-v1.md`
9. `docs/reference-word/*`

Consequences :

- `docs/present/*` doit etre corrige pour rester conforme aux artefacts ci-dessus
- les Word ne priment jamais sur le markdown canonique du repo
- `docs/present/*` ne doit pas inventer de regle qui n'existe pas deja dans le repo vivant

## Quand maintenir `docs/present/*`

Maintenir uniquement le ou les documents concernes quand la verite du present change reellement sur l'un de ces axes :

- changement durable du workflow UX reel
- changement durable de l'architecture executable
- activation, retrait ou recadrage d'une capacite IA du present

Ne pas mettre a jour `docs/present/*` pour chaque spec par reflexe.

Ne pas utiliser `docs/present/*` pour dupliquer :

- les specs
- les ADRs
- les contrats
- les runbooks
- les visions ou playbooks

## Regle de maintenance

Chaque document de `docs/present/*` doit :

- dire ce qui est vrai maintenant
- dire ce qui est explicitement hors scope maintenant
- renvoyer vers les artefacts vivants detailles
- nommer les Word sources utilises comme snapshots
- rappeler qu'en cas d'ecart, le markdown canonique du repo prime

## References Word sources utilisees

- `docs/reference-word/1.4-UX-Cadrage-V1.docx`
- `docs/reference-word/2.3-Architecture-Cadrage-V1.docx`
- `docs/reference-word/3.3-IA-Cadrage-V1.docx`
- `docs/reference-word/README.md`

## Note de resolution

En cas d'ecart entre cette couche et un Word de reference, le markdown canonique du repo prime.
