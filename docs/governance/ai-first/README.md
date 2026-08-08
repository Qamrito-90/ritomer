# Ritomer — Gouvernance technique AI-first Lean

GOVERNANCE_ID=RITOMER_AI_FIRST_LEAN_V1
GOVERNANCE_STATUS=ACTIVE
EFFECTIVE_ACTIVATION_SCOPE=DEFAULT_BRANCH_HEAD_ONLY
ACTIVATION_AUTHORITY=THIS_FILE

## 1. Autorité d’activation

Ce fichier est l’unique autorité d’activation de la gouvernance AI-first.

- Une copie locale, téléchargée ou plus récente n’est jamais active par elle-même.
- Les documents contrôlés ne portent aucun statut actif ou inactif autonome.
- `GOVERNANCE_STATUS=ACTIVE` est effectif uniquement lorsque ce fichier exact est lu depuis le head courant de la branche par défaut observable du repository.
- Dans une pull request, une feature branch, un tag, un detached HEAD, un commit historique, une copie locale ou un téléchargement, `ACTIVE` décrit seulement une proposition ou un snapshot et ne remplace jamais la gouvernance du head courant de la branche par défaut.
- Si la branche par défaut ou son head courant ne peut pas être établi par des faits observables, l’activation est `INCONCLUSIVE` et aucune copie alternative ne devient active.
- Le merge revu de cet index avec `GOVERNANCE_STATUS=ACTIVE` sur la branche par défaut rend les octets mergés effectifs dès qu’ils deviennent son head courant ; aucune modification post-merge du fichier n’est requise.
- Les octets actifs sont ceux des chemins ci-dessous au head courant de la branche par défaut. Git fournit l’historique et l’identité des versions ; aucun manifeste de hashes permanent n’est requis dans le repository.
- Un artefact hors Git reste identifié par son SHA-256 lorsqu’un hash est nécessaire.

## 2. Doctrine commune

La doctrine commune est la section :

- [`AGENTS.md` — `Gouvernance technique AI-first`](../../../AGENTS.md#gouvernance-technique-ai-first)

Elle définit une seule fois les responsabilités, les conséquences de la classe retenue, les statuts, les décisions owner, les preuves, les autorisations, l’invalidation, l’expertise humaine externe, la règle anti-usine à gaz et l’usage de `/plan` / `/goal`.

`RISK_REGISTER.md` porte exclusivement les critères et déclencheurs de classification `A`, `B`, `C` et `NON DÉTERMINÉ`. `TESTING_STRATEGY.md` projette la classe retenue vers les checks. Les prompts opérationnels appliquent ces sources et peuvent challenger leur application aux faits, sans créer de critère concurrent.

## 3. Documents contrôlés

- [Prompt pré-code](pre-code.md)
- [Prompt post-code, delivery et exécution](post-code.md)
- [Rôle CPO Command Center](role-cpo.md)
- [Rôle CTO Gate](role-cto.md)
- [Rôle CO / Fiduciaire Domain Review](role-co-fiduciaire.md)
- [Rôle Expert Review Board](role-expert-board.md)

Tous portent :

```text
ACTIVATION_AUTHORITY=docs/governance/ai-first/README.md
DOCUMENT_STATUS=CONTROLLED_BY_ACTIVATION_INDEX
```

## 4. Précédence

Pour les faits, le repository, GitHub, les artefacts exacts et les sorties fraîches priment.

Pour la doctrine de workflow :

```text
AGENTS.md — doctrine commune active
→ prompts opérationnels actifs
→ rôles spécialisés actifs
→ checklists et documents dérivés du repository
```

Classification A/B/C : `RISK_REGISTER.md` uniquement.

Aucun prompt ou rôle ne peut remplacer un fait observable.

## 5. Séparation avec les prompts produit

`docs/governance/ai-first/` contient la gouvernance du développement assisté par IA.

`prompts/` reste réservé aux prompts, guardrails et contrats utilisés par le produit ou son runtime IA.

## 6. Cycle de vie

Statuts autorisés pour cet index :

- `CANDIDATE_NOT_ACTIVE`
- `ACTIVE`
- `SUPERSEDED`
- `ARCHIVED`

Une version remplacée reste disponible dans l’historique Git ; elle n’est jamais réactivée implicitement.
