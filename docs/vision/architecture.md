# Vision Architecture condensée

## North Star
Base modulaire, fiable, sécurisée, orientée UX et IA, capable d’évoluer sans dériver.

## Décisions structurantes
- Monolithe modulaire Kotlin/Spring Boot
- Spring Modulith pour valider les frontières
- Clean Architecture dans chaque module
- REST pour les commandes en V1
- GraphQL read-model comme cible possible, pas obligation Day 1
- Multi-tenant strict avec `tenant_id` partout
- Audit trail systématique
- Observabilité standardisée
- Cloud-first sur Google Cloud pour la V1

## Modules métier cibles
- identity
- closing
- imports
- mapping
- financials
- workpapers
- controls
- exports
- ai
- shared

## Règles d’interaction
- un module n’appelle pas l’intérieur d’un autre module
- échanges via API de module ou événements applicatifs
- domaine sans dépendance framework
- infrastructure dépend du domaine, jamais l’inverse

## Sécurité
- OIDC/JWT
- RBAC V1
- ABAC ciblé ensuite
- isolation cross-tenant prouvée par tests
- RLS progressive sur tables critiques
