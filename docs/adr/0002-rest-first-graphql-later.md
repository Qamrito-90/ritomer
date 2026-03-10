# ADR 0002 — REST first, GraphQL plus tard

## Statut
Accepté

## Décision
Utiliser REST pour la V1. Considérer GraphQL read-only plus tard si la composition des écrans devient un coût démontré.

## Pourquoi
- réduire la surface d’API au démarrage
- accélérer l’exécution des premières tranches
- garder la vision long terme d’un read-model flexible

## Conditions d’introduction GraphQL
- besoin front récurrent de composition multi-sources
- garde-fous prêts : persisted queries, complexity, depth, rate limiting, auth
