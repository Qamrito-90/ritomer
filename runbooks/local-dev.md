# Runbook local-dev

## Pré-requis
- JDK 21
- Docker (pour Testcontainers)
- accès GCP non requis pour le développement local initial

## Commandes
- `./gradlew bootRun`
- `./gradlew test`
- `./gradlew build`

## Contrôles avant PR
- tests verts
- pas de violation des frontières modulaires
- pas de régression cross-tenant
- contrats mis à jour si nécessaire
