# Testing Strategy

## Principe général

Ne pas lancer tous les tests tout le temps. Choisir les checks selon la surface touchée et le niveau de risque.

Toute modification comportementale doit être couverte par un test pertinent ou par une justification explicite dans le Fresh Evidence Pack.

Les commandes locales doivent rester compatibles PowerShell. Ne pas utiliser `&&`.

## Niveaux de risque

- A - Faible risque : docs-only, typo, wording, petite correction non fonctionnelle.
- B - Standard : frontend standard, endpoint simple, workflow limité, CI simple.
- C - Critique : authentification, autorisation, séparation tenant, DB/migration, audit, données sensibles, règle métier critique, finalisation, suppression, architecture.

## Backend

Tests backend :

```powershell
Push-Location backend
try {
  .\gradlew.bat test
} finally {
  Pop-Location
}
```

Build backend :

```powershell
Push-Location backend
try {
  .\gradlew.bat build
} finally {
  Pop-Location
}
```

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

Ne pas imposer `dbIntegrationTest` aux changements docs-only, frontend-only ou backend sans persistance.

## Docs-only

Checks minimaux depuis la racine du repo :

```powershell
git --no-pager diff --stat
git --no-pager diff
git status --short
```

Pas de tests runtime sauf si la documentation modifie une commande, une règle de delivery, une CI, un contrat ou une décision durable.

## CI/Git

Pour `.github/workflows/*` :

- vérifier YAML, indentation et noms de jobs ;
- vérifier triggers `pull_request` et `push` ;
- vérifier `permissions` ;
- vérifier absence de secrets en clair ;
- vérifier cohérence entre commandes CI et commandes locales ;
- après push, vérifier le run GitHub Actions si applicable.

## Matrice de décision

| Surface | Checks minimaux | Checks renforcés | Revue humaine technique |
|---|---|---|---|
| DOCS_ONLY | Checks Docs-only. | Checks runtime seulement si une commande, CI, contrat ou règle exécutable change. | Oui si gouvernance, architecture, sécurité, production ou règle critique change. |
| BACKEND | Tests backend. | Build backend ; vérification Modulith si frontières touchées ; tests ciblés selon module. | Oui si auth, autorisation, tenant, audit, données sensibles ou règle métier critique. |
| FRONTEND | Tests frontend CI ; lint frontend. | Build frontend ; tests ciblés UX/API si workflow ou contrat consommé change. | Oui si workflow critique, données sensibles ou action irréversible. |
| DB/MIGRATION | Tests backend pertinents. | `dbIntegrationTest` avec PostgreSQL explicite ; build backend si comportement applicatif impacté. | Oui, toujours recommandée. |
| CONTRACTS/API | Diff contrat ; tests des producteurs ou consommateurs concernés. | Backend et/ou frontend selon contrat impacté ; build de la surface concernée. | Oui si changement breaking, auth, tenant ou payload critique. |
| CI/GIT | Revue du workflow, triggers, permissions, absence de secrets et cohérence des commandes. | Checks locaux correspondant au workflow modifié ; vérifier GitHub Actions après push si applicable. | Oui si secrets, permissions, production, déploiement ou protection de branche. |
| FULLSTACK | Checks backend et frontend pertinents. | Builds backend et frontend ; DB opt-in si persistance impactée. | Oui si surface C ou changement transverse. |

## Fresh Evidence Pack

Reporter les checks réellement exécutés et leurs résultats dans le Fresh Evidence Pack final, conformément à `AGENTS.md`.

Si un check pertinent n’est pas exécuté, indiquer pourquoi.
