# Testing Strategy

## Principe général

Ne pas lancer tous les tests tout le temps. Choisir les checks selon la surface touchée et le niveau de risque.

Toute modification comportementale doit être couverte par un test pertinent ou par une justification explicite dans le Fresh Evidence Pack.

Les commandes locales doivent rester compatibles PowerShell. Ne pas utiliser `&&`.

## Niveaux de risque

La classification `A`, `B`, `C` ou `NON DÉTERMINÉ` est déterminée exclusivement par `RISK_REGISTER.md`.
Cette stratégie ne définit ni ne réinterprète les critères de classification ; elle projette uniquement la classe déjà établie vers les checks.

## Backend

La suite backend non-DB est l'union obligatoire de deux groupes disjoints :

- `test` exécute les tests portables et exclut les méthodes marquées `@Tag("windows-only")` ;
- `windowsTest` exécute ces méthodes natives sous Windows avec JDK 21 et Windows PowerShell Desktop 5.1. Son invocation hors Windows échoue ; elle ne produit pas un succès par skip.

Le tag porte uniquement sur les méthodes concernées, sans désactiver leurs assertions. Les deux tâches excluent les tests PostgreSQL réels. Un inventaire vérifie que leur union conserve toute la suite non-DB, sans omission ni doublon. `build` seul conserve le groupe portable et ne constitue donc pas une preuve backend complète.

Pour un correctif de `DemoSeedLocalSourceGuardTest`, exécuter d'abord les tests ciblés des deux groupes sous Windows :

```powershell
Push-Location backend
try {
  .\gradlew.bat test --tests "*DemoSeedLocalSourceGuardTest" --no-daemon
  if ($LASTEXITCODE -ne 0) { throw "Échec des tests portables ciblés." }
  .\gradlew.bat windowsTest --no-daemon
  if ($LASTEXITCODE -ne 0) { throw "Échec des tests Windows natifs." }
} finally {
  Pop-Location
}
```

Puis vérifier la suite non-DB complète et le build sous Windows :

```powershell
Push-Location backend
try {
  .\gradlew.bat test windowsTest build --no-daemon --rerun-tasks
  if ($LASTEXITCODE -ne 0) { throw "Échec de la validation backend complète et du build." }
} finally {
  Pop-Location
}
```

Les résultats XML de chaque groupe doivent être présents, contenir au moins un test et ne signaler aucun échec, erreur ou test skipped. Une réussite locale Windows ne prouve ni une exécution Linux ni une réussite des runners GitHub hébergés ; ces résultats restent à obtenir lors d'une delivery séparément autorisée.

Vérification Modulith si frontières de modules, architecture ou dépendances inter-modules :

```powershell
Push-Location backend
try {
  .\gradlew.bat test --tests "*ApplicationModule*"
} finally {
  Pop-Location
}
```

## Frontend

Tests frontend CI :

```powershell
Push-Location frontend
try {
  pnpm test:ci
} finally {
  Pop-Location
}
```

Lint frontend :

```powershell
Push-Location frontend
try {
  pnpm lint
} finally {
  Pop-Location
}
```

Build frontend :

```powershell
Push-Location frontend
try {
  pnpm build
} finally {
  Pop-Location
}
```

## DB et migrations

`dbIntegrationTest` est opt-in. Il sert aux changements DB, migrations Flyway, repositories, persistance, tenant isolation réelle ou audit persistant.

Il nécessite une configuration PostgreSQL explicite via variables locales. Ne pas documenter de secret réel.

```powershell
Push-Location backend
try {
  .\gradlew.bat dbIntegrationTest
} finally {
  Pop-Location
}
```

Ne pas imposer `dbIntegrationTest` aux changements `DOCS`, `FRONTEND` ou `BACKEND` sans persistance.

Le Lifecycle PostgreSQL déjà exécuté reste une preuve historique liée à son composite exact. La partition CI renouvelle le composite et le runtime de tests ; elle ne transfère pas cette preuve, ne reconfigure pas les bindings fermés du rail sensible et ne déclenche aucune campagne DB. Toute future exécution du composite corrigé relève d'un mandat sensible distinct, conformément à `runbooks/local-dev.md`.

## Documentation (`DOCS`)

Checks minimaux depuis la racine du repo :

```powershell
git --no-pager diff --stat
git --no-pager diff
git diff --check
git status --short
```

Pas de tests runtime locaux par défaut. Ajouter des checks runtime seulement si un artefact exécutable, une commande, une CI ou un contrat est concrètement impacté, puis justifier le choix dans le Fresh Evidence Pack. Pour une gouvernance documentaire, ajouter des validations déterministes du file-set, des liens, de l’unicité d’activation, de l’encodage et du vocabulaire actif.

## `CI_GIT` et `GITHUB_GOVERNANCE`

Pour `.github/workflows/*` :

- vérifier YAML, indentation et noms de jobs ;
- vérifier triggers `pull_request` et `push` ;
- vérifier `permissions` ;
- vérifier absence de secrets en clair ;
- vérifier cohérence entre commandes CI et commandes locales ;
- après push, vérifier le run GitHub Actions si applicable.

## GitHub required checks and autonomous merge

Sur `main`, les workflows courants et leurs jobs/required status contexts sont :

- workflow `Backend CI` → job/context `backend` ;
- workflow `Frontend CI` → job/context `frontend`.

`Backend CI` conserve le contexte obligatoire `backend` comme agrégateur de deux jobs : tests portables puis build sur `ubuntu-latest` avec JDK 21 ; `windowsTest` sur `windows-2022` avec JDK 21 et Windows PowerShell Desktop 5.1. Chaque job vérifie les résultats XML de son groupe : présents, nombre de tests strictement positif, zéro échec, erreur et skipped.

L'agrégateur dépend des deux jobs et s'exécute avec `always()`. Il réussit seulement si les deux résultats sont exactement `success` ; tout autre résultat, dont `failure`, `cancelled`, `skipped` ou une valeur absente, le fait échouer. Aucun `continue-on-error` ne transforme un échec en succès. Le workflow frontend et les contextes du ruleset restent inchangés.

Une pull request n'est pas verte si un required check est absent, skipped de manière non autorisée, stale, cancelled, failed, timed out, action required ou indeterminate. Codex doit attendre leur état final via GitHub CLI.

Le merge autonome utilise exclusivement squash et `--match-head-commit` avec le head SHA exact revu. Aucun required check ne doit être contourné avec `--admin`.

Tout renommage d’un workflow, d’un job ou d’un required status context exige une tâche `CI_GIT` / `GITHUB_GOVERNANCE` autorisée. Revalider ce qui change réellement et mettre à jour simultanément, lorsque applicable :

- le workflow concerné ;
- le ruleset GitHub ;
- `TESTING_STRATEGY.md` ;
- toute documentation directement impactée.

Un changement `DOCS` peut ne nécessiter aucun test runtime local. Les required checks GitHub restent obligatoires tant que le ruleset les exige.

## Matrice de décision

| Surface | Checks minimaux | Checks renforcés | Contrôles de review |
|---|---|---|---|
| `DOCS` | Checks documentaires. | Checks runtime seulement si une commande, CI, contrat ou règle exécutable change. | Reviewer Codex séparé si la doctrine C l’exige ; expertise humaine externe évaluée séparément. |
| `BACKEND` | Tests backend. | Build backend ; vérification Modulith si frontières touchées ; tests ciblés selon module. | Selon risque et doctrine active. |
| `FRONTEND` | Tests frontend CI ; lint frontend. | Build frontend ; tests ciblés UX/API si workflow ou contrat consommé change. | Selon risque et doctrine active. |
| `DB` | Tests backend pertinents. | `dbIntegrationTest` avec PostgreSQL explicite ; build backend si comportement applicatif impacté. | Reviewer séparé selon l’étape ; expertise externe non automatique. |
| `CONTRACTS` | Diff contrat ; tests des producteurs ou consommateurs concernés. | Backend et/ou frontend selon contrat impacté ; build de la surface concernée. | Selon caractère breaking ou sensible. |
| `CI_GIT` / `GITHUB_GOVERNANCE` | Revue du workflow, triggers, permissions, absence de secrets et cohérence des commandes. | Checks locaux correspondant au workflow modifié ; vérifier GitHub Actions après push si applicable. | Reviewer séparé aux étapes C prévues par la doctrine ; expertise externe évaluée selon ses déclencheurs fermés. |
| `FULLSTACK` | Checks backend et frontend pertinents. | Builds backend et frontend ; DB opt-in si persistance impactée. | Selon risque et doctrine active. |

## Fresh Evidence Pack

Reporter les checks réellement exécutés et leurs résultats dans le Fresh Evidence Pack final unique, conformément à `AGENTS.md` : `LITE` pour A, `STANDARD` pour B et `FULL` pour C.

Si un check pertinent n’est pas exécuté, indiquer pourquoi.
