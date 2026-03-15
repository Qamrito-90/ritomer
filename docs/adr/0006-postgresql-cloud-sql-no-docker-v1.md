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

## Plateforme cible V1 figée

- Cloud provider : Google Cloud
- Runtime applicatif cible : Cloud Run
- Mode de déploiement cible : déploiement depuis le code source, sans hypothèse Dockerfile dans le flux nominal
- Région cible de production : `europe-west6` (Zürich)
- Moteur de base de données cible : PostgreSQL 17
- Service managé cible : Cloud SQL for PostgreSQL
- Édition cible : Cloud SQL Enterprise
- Disponibilité cible : regional HA
- Réseau cible entre application et base : Private IP
- Authentification base de données cible préférée : IAM DB authentication
- Protection des données et de l'exploitation : automatic backups activés, PITR activé, deletion protection activée

## Implications de delivery

- Les choix d'infrastructure et d'exploitation V1 doivent être compatibles avec Google Cloud et la région `europe-west6`.
- Les choix backend doivent rester compatibles avec PostgreSQL 17 et Cloud SQL for PostgreSQL comme cible de production.
- Le flux standard de livraison n'introduit pas Docker comme prérequis de développement local ni comme hypothèse de packaging applicatif.
- Les travaux ultérieurs sur la sécurité et l'accès DB doivent viser en priorité IAM DB authentication sur Cloud SQL.

## Conséquences

- Le schéma Flyway initial du Jalon 1 est conservé.
- Les tests de smoke et de structure restent rapides et exécutables sans infrastructure locale supplémentaire.
- Les tests base de données peuvent cibler un PostgreSQL local, distant, ou un environnement contrôlé non Dockerisé.
- La documentation de développement local doit proscrire toute hypothèse Docker pour la V1.
- La cible de production est désormais explicitement figée sur Google Cloud, Cloud Run et Cloud SQL for PostgreSQL 17 en `europe-west6`.
