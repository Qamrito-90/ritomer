# Runbook local-dev

## Pré-requis
- JDK 21
- une instance PostgreSQL accessible directement, locale ou distante
- aucun Docker Desktop requis
- accès GCP non requis pour le développement local initial
- la cible de production reste Cloud SQL for PostgreSQL

## Commandes
Depuis la racine du repo :

- `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'`
- `cd backend && ./gradlew test`
- `cd backend && ./gradlew dbIntegrationTest`
- `cd backend && ./gradlew build`

PowerShell pour un démarrage local complet :

```powershell
cd backend
$env:RITOMER_SECURITY_JWT_HMAC_SECRET='local-dev-only-jwt-hmac-secret-change-me'
$env:SPRING_DATASOURCE_URL='jdbc:postgresql://localhost:5432/ritomer'
$env:SPRING_DATASOURCE_USERNAME='ritomer'
$env:SPRING_DATASOURCE_PASSWORD='ritomer'
.\gradlew.bat bootRun --args="--spring.profiles.active=local"
```

## Tests

- `./gradlew test` exécute les tests unitaires, smoke et structure sans Docker et sans base PostgreSQL.
- `./gradlew dbIntegrationTest` exécute les tests PostgreSQL réels uniquement si une configuration explicite est fournie.

PowerShell pour les tests PostgreSQL optionnels :

```powershell
cd backend
$env:RITOMER_DB_TESTS_ENABLED='true'
$env:RITOMER_DB_TEST_JDBC_URL='jdbc:postgresql://localhost:5432/ritomer'
$env:RITOMER_DB_TEST_USERNAME='ritomer'
$env:RITOMER_DB_TEST_PASSWORD='ritomer'
.\gradlew.bat dbIntegrationTest
```

## Validation PostgreSQL réelle via cloud-sql-proxy

Pré-requis minimaux :

- binaire `cloud-sql-proxy` disponible localement
- authentification GCP déjà établie pour atteindre l'instance Cloud SQL cible
- nom d'instance au format `project:region:instance`

PowerShell Windows validé pour ouvrir le proxy :

```powershell
$env:CLOUD_SQL_INSTANCE='project:region:instance'
.\cloud-sql-proxy.exe --address 127.0.0.1 --port 5432 $env:CLOUD_SQL_INSTANCE
```

PowerShell Windows validé pour lancer `dbIntegrationTest` contre le proxy :

```powershell
cd backend
$env:RITOMER_DB_TESTS_ENABLED='true'
$env:RITOMER_DB_TEST_JDBC_URL='jdbc:postgresql://127.0.0.1:5432/ritomer'
$env:RITOMER_DB_TEST_USERNAME='ritomer'
$env:RITOMER_DB_TEST_PASSWORD='ritomer'
.\gradlew.bat dbIntegrationTest
```

Notes :

- gardez `cloud-sql-proxy` actif pendant toute l'exécution du task Gradle
- si l'environnement cible impose un autre nom de base, utilisateur ou mot de passe, adaptez uniquement les variables `RITOMER_DB_TEST_*`
- la recette reste compatible avec le principe V1 : aucun Docker local requis

## Vérification locale rapide
- `GET /actuator/health` doit répondre `200 OK`
- `GET /api/me` sans token doit répondre `401 Unauthorized`

Exemple PowerShell :

```powershell
Invoke-WebRequest http://localhost:8080/actuator/health | Select-Object -ExpandProperty StatusCode
try {
  Invoke-WebRequest http://localhost:8080/api/me -UseBasicParsing | Select-Object -ExpandProperty StatusCode
} catch {
  [int]$_.Exception.Response.StatusCode
}
```

## Contrôles avant PR
- tests verts
- pas de violation des frontières modulaires
- pas de régression cross-tenant
- contrats mis à jour si nécessaire
