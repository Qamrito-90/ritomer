# Architecture Playbook condensé

## Standards
- modules découplés
- tests d’architecture
- contrats explicites
- audit et observabilité dès le départ
- tenant_id partout
- object storage prive + download backend-only en V1, sans signed URL publique
- logs structurés
- tracing et métriques

## ADRs attendus
- monolithe modulaire
- REST first / GraphQL later
- multi-tenant + RLS progressive
- AI Gateway + structured outputs
- documents + object storage prive + download backend-only en V1
- cloud target V1

## Règle de conception
Une feature n’est pas “finie” sans :
- contrat
- tests
- sécurité
- observabilité
- critères d’acceptation
