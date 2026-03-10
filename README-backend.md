# Backend Foundation (Spec 001)

Le backend Kotlin/Spring Boot de reference vit dans `backend/`.

L'ancien backend Node est conserve en legacy temporaire sous `backend/legacy-node/` et ne fait pas partie du scope actif de la spec 001.

## Pre-requis

- JDK 21

## Commandes backend (depuis la racine du repo)

- Build: `cd backend && ./gradlew build`
- Tests: `cd backend && ./gradlew test`
- Verification Modulith: `cd backend && ./gradlew test --tests *ApplicationModule*`

## Demarrage local prouve

PowerShell:

```powershell
cd backend
$env:RITOMER_SECURITY_JWT_HMAC_SECRET='local-dev-only-jwt-hmac-secret-change-me'
.\gradlew.bat bootRun --args="--spring.profiles.active=local"
```

## Verification HTTP locale

- Health public:
  - `GET http://localhost:8080/actuator/health`
  - attendu: HTTP 200 avec `{"status":"UP"}`
- Endpoint identite placeholder protege:
  - `GET http://localhost:8080/api/me` sans token
  - attendu: HTTP 401 Unauthorized

Exemple de verification rapide:

```powershell
Invoke-WebRequest http://localhost:8080/actuator/health | Select-Object -ExpandProperty StatusCode
try {
  Invoke-WebRequest http://localhost:8080/api/me -UseBasicParsing | Select-Object -ExpandProperty StatusCode
} catch {
  [int]$_.Exception.Response.StatusCode
}
```

## Profils et secret JWT

- `local`: fallback local non sensible autorise uniquement pour dev local (`application-local.yml`).
- `dev`: secret obligatoire via variable d'environnement `RITOMER_SECURITY_JWT_HMAC_SECRET`.
- `test`: secret de test dedie (`application-test.yml`) pour execution stable des tests.

Aucun secret sensible ne doit etre commite en dur.

Exemple de variables d'environnement: `backend/.env.example`.

## Endpoints foundation

- Health: `GET /actuator/health` (accessible sans auth)
- Placeholder utilisateur: `GET /api/me` (JWT requis)

## Structure modulaire cible

- `ai`
- `closing`
- `controls`
- `exports`
- `financials`
- `identity`
- `imports`
- `mapping`
- `shared`
- `workpapers`

Les frontieres sont verifiees via Spring Modulith (`ApplicationModuleStructureTest`).

## Securite et observabilite (base)

- Resource server JWT actif
- Extraction `tenant_id` depuis le JWT
- Enrichissement des logs avec `tenant_id` (MDC)
- Actuator + endpoint Prometheus exposes
