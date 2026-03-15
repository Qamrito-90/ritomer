# ADR 0006 — PostgreSQL, Cloud SQL target, no Docker requirement in V1

## Statut
Accepté

## Contexte

Le Jalon 1 de la spec 002 a introduit PostgreSQL et Flyway comme socle de persistance réel.  
Une première implémentation s'appuyait sur Testcontainers pour les tests base de données, ce qui réintroduisait une dépendance locale à Docker Desktop.

Le projet confirme maintenant les contraintes suivantes :
- PostgreSQL reste la base principale de la V1 ;
- Cloud SQL for PostgreSQL reste la cible de production ;
- le développement local doit fonctionner sans Docker, Docker Compose ou Testcontainers ;
- `./gradlew test` doit rester exécutable sans daemon Docker ni base PostgreSQL locale ;
- les tests base de données réels doivent rester possibles, mais de manière explicite et optionnelle.

## Décision

- Le backend reste PostgreSQL-first avec Flyway comme source de vérité du schéma.
- Les profils `local` et `dev` pointent vers une instance PostgreSQL accessible directement.
- Aucun flux local standard ne requiert Docker, Docker Compose, Testcontainers ou Dockerfile.
- Les tests exécutés par `./gradlew test` excluent les tests PostgreSQL réels.
- Les tests PostgreSQL réels sont regroupés dans une exécution dédiée `dbIntegrationTest`.
- Cette exécution dédiée ne s'active que lorsque la configuration PostgreSQL est fournie explicitement via variables d'environnement.

## Conséquences

- Le schéma Flyway initial du Jalon 1 est conservé.
- Les tests de smoke et de structure restent rapides et exécutables sans infrastructure locale supplémentaire.
- Les tests base de données peuvent cibler un PostgreSQL local, distant, ou un environnement contrôlé non Dockerisé.
- La documentation de développement local doit proscrire toute hypothèse Docker pour la V1.
