# Runbook local-dev

## Pré-requis
- JDK 21
- PostgreSQL local ou Docker
- Docker (pour Testcontainers et option PostgreSQL locale)
- accès GCP non requis pour le développement local initial

## Commandes
Depuis la racine du repo :

- `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'`
- `cd backend && ./gradlew test`
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

Option PostgreSQL via Docker :

```powershell
docker run --name ritomer-postgres `
  -e POSTGRES_DB=ritomer `
  -e POSTGRES_USER=ritomer `
  -e POSTGRES_PASSWORD=ritomer `
  -p 5432:5432 `
  -d postgres:17-alpine
```

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
