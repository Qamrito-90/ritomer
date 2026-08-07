# AGENTS.md

## Mission
Construire un SaaS suisse de closing comptable, multi-tenant, sécurisé, audit-ready, avec UX premium et IA evidence-first.

## Sources à lire avant toute implémentation
Toujours lire dans cet ordre :
1. `docs/product/documentation-governance.md`
2. `docs/present/README.md`
3. `docs/present/<cadrage>.md` concerne par la mission
4. `docs/adr/*.md`
5. `docs/product/v1-plan.md`
6. `specs/active/<feature>.md`
7. `contracts/*` impactes
8. `runbooks/*` impactes
9. `docs/ui/ui-foundations-v1.md` si la mission touche une verite UI durable
10. `README.md`
11. `docs/vision/*`
12. `docs/playbooks/*`

Référence UI documentaire : `docs/ui/ui-foundations-v1.md`

Couche canonique du present : `docs/present/README.md` puis les cadrages concernes dans `docs/present/*`

## Gouvernance documentaire
- Le repo Git est la source de verite vivante du projet.
- `docs/present/*` porte la synthese canonique du present UX / architecture / IA pour l'execution.
- Apres chaque spec validee, une mise a jour documentaire minimale obligatoire du repo doit etre faite sur les artefacts impactes.
- Les documents Word dans `docs/reference-word/` ne sont pas requis pour la fermeture normale d'une spec.
- Les documents Word ne remplacent jamais la documentation vivante du repo.
- Les documents Word ne sont modifies que lors d'une tache explicite de realignement documentaire ou de snapshot externe.
- En cas d'ecart, `docs/present/*` doit etre realigne sur les artefacts vivants de plus haute priorite du repo ; les Word ne priment jamais.
- `docs/present/*` n'est mis a jour qu'en cas de changement reel de la verite du present concernee.
- Reference de gouvernance documentaire : `docs/product/documentation-governance.md`

## Invariants produit
- L’utilisateur métier doit garder le contrôle sur toute décision engageante.
- L’IA suggère, explique, rédige ou prépare ; elle ne valide jamais seule un acte comptable, réglementaire ou financier.
- Toute action importante doit être traçable : qui, quoi, quand, pourquoi, sur quelles preuves.
- Le workflow de closing prime sur la sophistication de reporting.
- La V1 doit être utilisable en conditions réelles par des fiduciaires pilotes.

## Invariants UX
- Clarté avant sophistication.
- Feedback immédiat, autosave, statuts explicites.
- Recherche globale, bulk actions, navigation poste → note → preuve.
- Responsive adaptatif : cohérent entre desktop et mobile, sans clonage aveugle.
- Accessibilité et privacy by design non négociables.
- Le produit doit inspirer confiance : messages clairs, annulation quand possible, confirmation seulement sur l’irréversible.

## Invariants architecture
- Monolithe modulaire Kotlin/Spring Boot.
- Frontières de modules strictes.
- Interactions inter-modules via API explicites ou événements applicatifs.
- Clean Architecture : domaine pur, application, infrastructure.
- REST first en V1. GraphQL seulement si la composition front devient un coût réel.
- PostgreSQL est la base principale ; Cloud SQL for PostgreSQL est la cible de prod.
- Cible plateforme V1 : Google Cloud, Cloud Run depuis le code source, prod en `europe-west6`, Cloud SQL for PostgreSQL 17 Enterprise en HA régional / Private IP.
- Le développement local et les tests par défaut ne doivent pas dépendre de Docker, Docker Compose ou Testcontainers.
- Contrats techniques versionnés dans `contracts/`.

## Invariants IA
- Evidence-first : pas de réponse IA sans base factuelle exploitable.
- Sorties structurées strictes pour toute capacité IA qui influence une décision.
- Human-in-the-loop obligatoire pour les actions critiques.
- Model pinning, prompt pinning, evals et logs obligatoires.
- Mode dégradé obligatoire : si l’IA tombe, le closing continue.
- Pas d’écriture directe en base par l’IA sans validation humaine et couche métier.

## Sécurité et multi-tenancy
- Toutes les données métier sont scindées par `tenant_id`.
- Aucun accès cross-tenant sans mécanisme explicite, tracé et autorisé.
- Les repositories sont toujours tenant-scoped.
- Ne jamais contourner l’audit.
- Ne jamais exposer de secrets en dur.
- Les données sensibles ne partent pas en clair vers des services IA externes.

## Qualité attendue
- Ajouter ou ajuster les tests impactés.
- Vérifier les frontières modulaires.
- Mettre à jour les contrats si le comportement change.
- Mettre à jour la documentation impactée si une décision devient durable.
- Toute PR doit rester reviewable et limitée en périmètre.

## Definition of done
Une mission est terminée seulement si :
- le périmètre demandé est respecté
- les tests nécessaires existent et passent
- les règles de sécurité et d’isolation tenant sont respectées
- les audits requis sont émis
- les fichiers modifiés sont listés
- les points de vigilance restants sont signalés

## Gouvernance technique AI-first

### 1. Principe

- Codex Builder construit et extrait les preuves.
- Un Codex Reviewer séparé challenge le travail quand il est requis.
- ChatGPT CPO contrôle la cohérence et traduit les résultats techniques en options de décision.
- GitHub et la CI prouvent les états mécaniques.
- Luis décide l’action exacte et en porte la responsabilité d’owner ; il ne certifie pas techniquement le code.

Les prompts et rôles actifs sont exclusivement ceux désignés par `docs/governance/ai-first/README.md`.
Une version plus récente, locale, téléchargée ou simplement accessible n’est jamais active sans mise à jour revue et mergée de cet index.

Les surfaces canoniques sont : `BACKEND`, `FRONTEND`, `DB`, `CONTRACTS`, `CI_GIT`, `GITHUB_GOVERNANCE`, `DOCS`, `FULLSTACK`, `QA_MANUAL`, `OFF_REPOSITORY_ARTIFACT`, `SENSITIVE_EXECUTION`, `PRODUCTION` et `NON_DÉTERMINÉ`.

### 2. Responsabilités

- **Codex Builder** — réalise le scope autorisé, effectue le self-check et produit des preuves proportionnées et accessibles.
- **Codex Reviewer séparé** — utilise un contexte distinct, reste read-only, inspecte le SHA ou l’artefact exact et ne corrige rien pendant la review.
- **ChatGPT CPO** — contrôle scope, risque, preuves et cohérence ; challenge les contradictions ; traduit le résultat pour la décision owner.
- **GitHub / CI** — établissent les faits mécaniques sur SHA, diff, PR et checks, sans certifier le sens métier ni le risque résiduel.
- **Luis** — choisit l’action, le timing et le risque accepté sur la base des preuves.

Toute review du Codex Reviewer porte les classifications `AI_GENERATED_REVIEW`, `NOT_HUMAN_SIGNED` et `FUNCTIONAL_INDEPENDENCE_ONLY` ; elle ne vaut ni signature humaine, ni expertise professionnelle, ni séparation réelle des fonctions.

Le mandat minimal du reviewer séparé est :

```text
INDEPENDENT_AI_TECHNICAL_REVIEW_MANDATE
REVIEW_TARGET=
REVIEWED_SHA_OR_ARTIFACT_HASH=
REVIEW_QUESTION=
EXPECTED_INVARIANTS=
AVAILABLE_EVIDENCE=
REVIEW_MODE=READ_ONLY
CONTEXT_SEPARATE=YES
FILES_MODIFICATION_AUTHORIZED=NO
```

Sa sortie minimale contient : `REVIEW_STATUS`, `OBJECT_EXACTLY_REVIEWED`, `EVIDENCE_USED`, `COUNTEREXAMPLES_TESTED`, `BLOCKING_FINDINGS`, `RESIDUAL_RISKS`, `UNPROVEN_CLAIMS` et `CONFIDENCE`.

Quand une décision de Luis est requise, ChatGPT CPO présente d’abord une synthèse non technique indiquant uniquement :

- ce qui change et pourquoi ;
- la valeur attendue ;
- ce qui peut mal se passer et la pire conséquence crédible ;
- les protections présentes ;
- les verdicts techniques des IA ;
- ce qui reste non prouvé ;
- la recommandation CPO ;
- l’action exacte à approuver, corriger, simplifier, reporter ou arrêter.

Les preuves techniques sous-jacentes restent complètes et accessibles aux reviewers IA. Luis peut y accéder, mais il n’a pas à les certifier lui-même.

### 3. Boucles par risque

- **Risque A** — Builder → self-check → CPO → delivery proportionnée.
- **Risque B** — Builder → preuves `STANDARD` → CPO. Un Reviewer séparé intervient seulement sur un déclencheur concret.
- **Risque C** — Builder → preuves `FULL` et artefacts exacts → CPO
  implementation review → delivery limitée au commit, push, PR et checks →
  Reviewer Codex séparé read-only sur le head SHA exact → ChatGPT CPO →
  décision explicite de Luis avant merge. Pour une exécution sensible, la
  production ou l’acceptation d’un artefact critique hors repository, la
  review séparée intervient avant l’action concernée.

La review aveugle en deux passes n’est pas automatique ; elle est un renforcement déclenché explicitement par le CPO pour répondre à une question précise.

### 4. Statuts techniques et décisions owner

Pour la boucle AI-first, les seuls statuts techniques de synthèse sont :

- `PASS` — exigences décisives et preuves requises satisfaites.
- `PASS_WITH_RESIDUAL_RISK` — exigences décisives satisfaites, avec risques résiduels non bloquants explicités.
- `FAIL` — exigence décisive non satisfaite ou contredite.
- `INCONCLUSIVE` — preuves insuffisantes, inaccessibles ou contradictoires pour conclure.

Les verdicts spécialisés de review sont normalisés dans l’un de ces quatre statuts avant toute décision owner.
Les seules décisions owner sont `APPROVE`, `APPROVE_WITH_CONDITIONS`, `FIX`, `SIMPLIFY`, `DEFER` et `STOP`.

`FAIL` ou `INCONCLUSIVE` sur un élément décisif interdit `APPROVE` et `APPROVE_WITH_CONDITIONS`.
Luis décide de l’action ; il ne tranche pas la question technique.

Toute décision owner requise est persistée dans un record minimal :

```text
OWNER_DECISION_RECORD
DECISION_ID=
DECISION=
DECIDED_BY=Luis Allauca
DECISION_DATE_UTC=
AUTHORIZED_ACTION=
AUTHORIZED_SCOPE=
BOUND_OBJECT=
CONDITIONS=
ACCEPTED_RESIDUAL_RISKS=
EXPLICITLY_NOT_AUTHORIZED=
```

`BOUND_OBJECT` identifie uniquement ce qui s’applique : plan, PR et head SHA, artefact et SHA-256, environnement et commande. Les éléments non applicables sont marqués `NON_APPLICABLE`. Ce record prouve une décision owner exacte ; il ne constitue ni certification technique, ni assurance juridique ou professionnelle.

### 5. Preuves proportionnées

- `LITE` pour A — objectif, scope, file-set ou diff, checks adaptés et risques résiduels.
- `STANDARD` pour B — `LITE`, plus tests ciblés avec sorties et impacts documentaires ou contractuels.
- `FULL` pour C — `STANDARD`, plus les catégories essentielles ci-dessous sous forme exacte et vérifiable.

Ces niveaux dimensionnent le Fresh Evidence Pack existant sans remplacer ses rubriques obligatoires ni créer un second système de bundle.
Toute preuve décisive doit être réellement accessible aux reviewers techniques. Luis reçoit une synthèse fidèle et non technique, sans avoir à valider lui-même le code ou les preuves détaillées.
Un résumé, un chemin local ou un hash déclaré seul ne suffit pas.

Pour `FULL`, ce pack couvre uniquement : baseline ; file-set et diff ; fichiers ou artefacts exacts ; tests et sorties ; Git / GitHub ; écarts et risques ; affirmations importantes liées à leurs preuves.

Si le hash d’un diff est requis, il porte sur les octets exacts du fichier `DIFF.patch` livré.
`FULL` n’impose aucune arborescence de bundle complexe.
Aucun secret ne doit être extrait ni reproduit dans les preuves.

### 6. Autorisations distinctes

Les seuls marqueurs de contrôle sont `IMPLEMENTATION_AUTHORIZED`, `DELIVERY_AUTHORIZED`, `MERGE_AUTHORIZED`, `SENSITIVE_EXECUTION_AUTHORIZED`, `PRODUCTION_AUTHORIZED` et `DELIVERY_COMPLETE`.

- `IMPLEMENTATION_AUTHORIZED` borne le droit de modifier le scope défini ; `DELIVERY_AUTHORIZED` borne la delivery selon le niveau de risque.
- `MERGE_AUTHORIZED` borne le merge quand une autorisation séparée est requise ; `SENSITIVE_EXECUTION_AUTHORIZED` borne une exécution sensible précise.
- `PRODUCTION_AUTHORIZED` borne une action précise en production ; `DELIVERY_COMPLETE` constate la fin vérifiée de la delivery et n’est pas une autorisation.

Aucune autorisation ne découle automatiquement d’une autre.
Pour le risque C, `DELIVERY_AUTHORIZED` permet d’aller jusqu’à la PR et aux checks.
Pour le risque C, `MERGE_AUTHORIZED` exige le SHA exact revu et la décision de Luis.
Une exécution sensible exige l’artefact exact, le hash exact, l’environnement exact et la commande exacte.

Toute autorisation est représentée par un record minimal :

```text
AUTHORIZATION_RECORD
TYPE=
STATUS=YES|NO|NOT_REQUIRED|CONSUMED|INVALIDATED|NON_DÉTERMINÉ
RECORD_ID=
BOUND_OBJECT=
BOUND_SCOPE=
CONDITIONS=
```

Bindings minimaux : implémentation → plan, scope et file-set ; delivery →
branche, base SHA, file-set et hash du bundle de review ou de `DIFF.patch`
exactement revu ; merge → PR et head SHA ; exécution sensible → artefact
SHA-256, environnement et commande ; production → action et environnement
de production exacts. Un `YES` sans binding exact est invalide.

### 7. Invalidation

Toute review, autorisation ou décision devient invalide si l’un des éléments suivants change matériellement :

- le scope ou le file-set ;
- le comportement ou le contrat sémantique ;
- la base de preuve, définie par les preuves décisives et les findings de review disponibles ;
- le SHA ou les octets de l’artefact ;
- l’environnement ou la commande ;
- le niveau de risque ;
- une condition owner.

La boucle concernée doit alors être reprise sur l’état exact mis à jour.

### 8. Expertise humaine externe

Le statut `EXTERNAL_HUMAN_EXPERTISE` prend uniquement `YES`, `RECOMMENDED` ou `NO`.
`YES` signifie `REQUIRED` et n’est autorisé que dans les cas fermés suivants :

- obligation légale ou réglementaire ;
- exigence contractuelle ou explicite d’un tiers ;
- attestation humaine nominative promise ;
- compétence professionnelle réglementée nécessaire ;
- décision explicite de Luis ;
- preuves IA durablement inconclusives sur une action grave qui ne peut pas être réduite.

Aucune autre condition ne rend l’expertise humaine externe obligatoire.
`RECOMMENDED` indique une assurance proportionnée non obligatoire ; `NO` indique qu’aucun besoin n’est établi.
Le risque C seul n’est jamais un déclencheur suffisant pour `YES` / `REQUIRED` ; il peut motiver `RECOMMENDED`.
La validation professionnelle métier réelle reste distincte de la review technique externe.

### 9. Proportionnalité et anti-usine à gaz

- Choisir la plus petite boucle qui maîtrise le risque.
- Ne pas créer un gate sans question précise.
- Ne pas demander `FULL` pour un changement A ou B sans déclencheur.
- Ne pas répéter une règle commune dans chaque prompt ou rôle.
- Utiliser Git, la CI et les services standards avant de créer une preuve custom.
- Simplifier ou arrêter lorsque le coût du contrôle dépasse la valeur attendue.

### 10. Utilisation de `/plan` et `/goal`

- Utiliser `/plan` pour tout nouveau scope B ou C, toute tâche multi-étapes, ou lorsque des décisions de conception, de file-set, de tests ou de delivery restent ouvertes.
- Dans le workflow Ritomer, `/plan` est plan-only : il prépare ou corrige le plan et n’autorise aucune modification par lui-même.
- Utiliser `/goal` seulement lorsque le résultat attendu, le scope, le hors-scope, le file-set, les checks, les conditions de stop et les autorisations sont suffisamment fermés.
- Un correctif déjà strictement borné et décision-complete peut passer directement en `/goal` ; sinon, utiliser `/plan` d’abord.
- Si un objectif Codex non lié peut encore être actif, demander `/goal clear` avant le nouveau `/goal`.
- Un `/goal` n’élargit jamais une autorisation existante. Il doit lier l’objectif métier, le scope, le file-set, les checks, les conditions de stop, les actions interdites, les autorisations courantes et le Fresh Evidence Pack attendu.
- Si la surface Codex utilisée n’expose pas ces commandes, utiliser le mode Plan ou Goal équivalent de l’interface ; ne jamais traiter une commande non reconnue comme une instruction ordinaire implicitement autorisée.

## Fresh Evidence Pack obligatoire
À la fin de toute tâche Codex, fournir un Fresh Evidence Pack final, court, factuel, vérifiable et proportionné à la surface de mission.
Le niveau de preuve est `LITE` pour A, `STANDARD` pour B et `FULL` pour C, conformément à la doctrine AI-first active ; ces niveaux dimensionnent ce pack unique sans remplacer les rubriques ci-dessous.

Ne jamais inclure de secret, token, clé, cookie, DSN, credential ou valeur `.env` dans le Fresh Evidence Pack. Si une vérification dépend d’un secret local, indiquer seulement que le check n’a pas été exécuté et pourquoi.

Si un élément du Fresh Evidence Pack n’est pas applicable, écrire `AUCUN`. Si une information n’est pas déterminée, écrire `NON DÉTERMINÉ` sans l’inventer.

Surfaces possibles :
- `BACKEND`
- `FRONTEND`
- `DB`
- `CONTRACTS`
- `CI_GIT`
- `GITHUB_GOVERNANCE`
- `DOCS`
- `FULLSTACK`
- `QA_MANUAL`
- `OFF_REPOSITORY_ARTIFACT`
- `SENSITIVE_EXECUTION`
- `PRODUCTION`
- `NON_DÉTERMINÉ`

Le Fresh Evidence Pack final doit contenir :
1. Résumé métier ou documentaire.
2. Demande initiale ou plan validé.
3. Surface de mission.
4. Liste exacte des fichiers modifiés.
5. Résumé précis du diff par fichier.
6. Commandes réellement exécutées.
7. Sorties fraîches des tests/checks.
8. Statut Git final.
9. Tests ajoutés ou modifiés.
10. Tests non exécutés avec justification.
11. Écarts éventuels par rapport au plan validé.
12. Risques résiduels.
13. Statut du Reviewer Codex séparé pour l’étape, `EXTERNAL_HUMAN_EXPERTISE=YES|RECOMMENDED|NO` avec son déclencheur exact, et validation professionnelle métier rapportée séparément lorsqu’elle est applicable. Le risque C seul ne rend jamais l’expertise humaine externe obligatoire.

## Commandes de base
- Build backend :
```powershell
Push-Location backend
try {
  .\gradlew.bat build
} finally {
  Pop-Location
}
```
- Tests backend :
```powershell
Push-Location backend
try {
  .\gradlew.bat test
} finally {
  Pop-Location
}
```
- Tests DB optionnels avec une configuration PostgreSQL explicite :
```powershell
Push-Location backend
try {
  .\gradlew.bat dbIntegrationTest
} finally {
  Pop-Location
}
```
- Vérification modulith :
```powershell
Push-Location backend
try {
  .\gradlew.bat test --tests "*ApplicationModule*"
} finally {
  Pop-Location
}
```
- Lancer le backend en local :
```powershell
Push-Location backend
try {
  .\gradlew.bat bootRun --args='--spring.profiles.active=local'
} finally {
  Pop-Location
}
```
- Tests frontend CI :
```powershell
Push-Location frontend
try {
  pnpm test:ci
} finally {
  Pop-Location
}
```
- Lint frontend :
```powershell
Push-Location frontend
try {
  pnpm lint
} finally {
  Pop-Location
}
```
- Build frontend :
```powershell
Push-Location frontend
try {
  pnpm build
} finally {
  Pop-Location
}
```

## Interdits
- Ne pas introduire de microservice sans ADR ni trigger clair.
- Ne pas introduire GraphQL par confort théorique.
- Ne pas bypasser les couches métier pour “aller plus vite”.
- Ne pas coder l’IA en texte libre si un JSON Schema existe.
- Ne pas casser un contrat existant sans mise à jour explicite.
- Ne pas utiliser des données d’un tenant dans le contexte IA d’un autre tenant.

## Autonomous GitHub delivery

When a mission contains an explicit delivery authorization, Codex owns the
mechanical Git and GitHub delivery loop.

Authorization markers:

The six control markers and their exact bindings are defined by the active
AI-first doctrine above. This operational section never extends them.

- `IMPLEMENTATION_AUTHORIZED=YES` and its applicable `AUTHORIZATION_RECORD`
  are required before modifying the authorized scope.
- For risk A or B, `DELIVERY_AUTHORIZED=YES` authorizes the delivery loop
  described below when its record covers the exact branch and object.
- For risk C, `DELIVERY_AUTHORIZED=YES` stops at commit, push, pull-request
  creation, required checks and exact-head evidence.
- Risk C additionally requires the separate Codex Reviewer, an applicable
  `OWNER_DECISION_RECORD` and `MERGE_AUTHORIZED=YES` bound to the reviewed
  pull request and head SHA before merge.
- Sensitive execution and production require their own separate markers and
  records; no delivery marker authorizes them.
- `DELIVERY_COMPLETE` is reported only after successful post-merge
  verification and is never an authorization.

Mandatory delivery sequence:

1. Verify a clean local worktree and an exact synchronized main baseline.
2. Verify the implementation authorization and its exact bound scope.
3. Create one dedicated branch.
4. Modify only the authorized file-set.
5. Run all checks required by the declared surface and risk.
6. Stop on any failed, skipped, stale, missing or indeterminate required check.
7. Produce the proportionate Fresh Evidence Pack and complete the applicable
   post-code review before delivery.
8. Verify `DELIVERY_AUTHORIZED` and its applicable record against the exact
   branch, base SHA, reviewed file-set and review-bundle or `DIFF.patch` hash
   before creating a commit.
9. Create only the reviewed commit or commits allowed by the mission.
10. Before any push, verify that the new commit has the authorized parent and
    that its tree, file-set and diff reproduce exactly the reviewed object.
    Record the new head SHA as delivery evidence. A mismatch invalidates the
    authorization and requires a new review; an exact match may continue to
    push without a second owner decision or delivery-authorization record.
11. Push without force.
12. Generate the pull-request title and complete body from the Fresh Evidence
   Pack.
13. Create the pull request using GitHub CLI.
14. Verify base branch, head branch, reviewed head SHA, file-set and diff.
15. Wait for all required GitHub checks.
16. For risk C, obtain the separate read-only review, applicable owner decision
    and merge authorization on the same exact head SHA.
17. Merge exclusively with squash.
18. Always use `--match-head-commit` with the exact reviewed head SHA.
19. Never use `--admin`, merge commits, rebase merge, direct push to main,
    force-push or protection bypass.
20. Delete the source branch after merge.
21. Synchronize main with `--ff-only`.
22. Verify the final commit, parent count, tree, file-set, tests and clean
    repository.
23. Report `DELIVERY_COMPLETE=YES` only when the complete delivery is freshly
    verified.

Pull-request bodies must include:

- objective;
- exact scope and file-set;
- material diff summary;
- checks executed and results;
- risks and residual limitations;
- explicit non-authorizations;
- reviewed head SHA;
- applicable authorization-record identifiers and bound objects;
- separate Reviewer result and Owner Decision Record when required;
- required merge method;
- post-merge verification expectations.

The AI reviews remain classified as AI-generated and must never be described
as human signatures or real segregation of duties.

If GitHub CLI, authentication, permissions, required checks or repository
rules are unavailable, stop explicitly rather than falling back to manual
merge or an unsafe method.
