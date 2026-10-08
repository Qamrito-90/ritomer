# ADR 0008 — Google OIDC direct et sessions JDBC pour M1.2 interne

Date : 06.10.2026. Statut : décision retenue pour le candidat local de
[047 Active](../../specs/active/047-shared-oidc-session-v1.md), non livré/non déployé.
Complète [0007](0007-authenticated-session-boundary.md) sans réécrire la fondation locale.

## Contexte

L'entrée locale de 046 n'est pas adaptée à un environnement partagé. Il faut
authentifier des identités Google réelles tout en conservant l'autorité métier
dans Ritomer, supporter plusieurs processus et ne jamais conserver de token
fournisseur dans la session durable. La tranche autorisée produit le code et
les preuves hors DB ; elle n'exécute pas Google, PostgreSQL ou Cloud.

## Décision

- Profil exclusif `shared-internal`, fermé sans paramètres explicites. Google
  Authorization Code OIDC, PKCE S256, scope `openid`, endpoints fixes, pas de
  UserInfo. Spring Security valide le protocole et la cryptographie.
- Admission par binding exact issuer/subject vers un utilisateur existant actif
  et ses appartenances actives. Aucune décision fondée sur email, domaine ou
  claims de rôle. Port pur `shared::application/OidcActorAdmission`, implémenté
  dans identity ; les adaptateurs shared n'importent pas les internes identity.
- Spring Session JDBC, schéma PostgreSQL officiel de la version gérée 3.5.5,
  migration additive V11. Pas de Redis, nouvelle infrastructure de session ou
  microservice. La session contient le principal minimal et son opaque
  `oidcBindingId`, jamais les tokens/claims/identité fournisseur.
- Conversion du principal avant tout saveContext, AuthorizedClient non persistant,
  cookie sécurisé et CSRF conservé seulement en mémoire frontend. Recréation
  de session au login partagé, fraîcheur à chaque requête, logout serveur.
- Transaction d'autorisation JDBC séparée : état lié à l'anonyme, expiration
  maximale cinq minutes, consommation indépendante engagée avant échange HTTP.
  Un échec consomme son essai et impose une nouvelle initiation explicite.
- La référence opaque du binding tourne lors d'un changement d'identité ou de
  son état actif ; une ancienne session ne redevient pas valable à la réactivation.
- Frontend/API à la même origine HTTPS canonique ; topology proxy explicite.
  Bundle opt-in dans bootJar uniquement, sans copie dans processResources.
  API et callbacks ne sont jamais capturés par le fallback SPA.

## Conséquences et limites

La base porte sessions et transactions de login ; une panne DB ferme l'accès
authentifié au lieu de réactiver un mécanisme local. Le stockage contient du
matériel PKCE/nonce transitoire à protéger au même titre que les sessions ; il
est purgé après consommation/expiration. Aucun journal durable pré-tenant ni
audit comptable fictif n'est ajouté. L'audit métier existant reste après validation
du tenant. Les niveaux DEBUG/TRACE des bibliothèques de sécurité/session/JDBC
sont exclus de la configuration partagée pour ne pas journaliser le protocole.

La recréation de session retire les anciennes lignes JDBC, contrairement à une
simple modification du SID sur une ligne qui pourrait être réécrite par une
requête anonyme concurrente. La preuve de cette propriété en PostgreSQL et la
reprise multi-JVM restent requises. Les tests locaux inspectent l'ordre réel du
pipeline et chaque sauvegarde dans le stockage synthétique.

Le projet et l'unique instance SQL existants seront réutilisés : PostgreSQL 17
Enterprise zonal à Zurich, capacité initiale 1 vCPU/3,75 GiB et base logique dédiée.
Connectivité privée et retrait IPv4 publique seront séquencés séparément. La
disposabilité owner des données d'essai retire l'obligation de préserver ces jeux,
sans autoriser une opération réelle ni désactiver les sauvegardes futures.
Estimation recalculée : **64,67 CHF / 30 jours**, conditionnelle aux mêmes volumes,
prix et TVA hypothétique que le FEP, dans une enveloppe de 100 CHF ; aucune deuxième
SQL ni durée de 21 jours dans le scénario retenu. Fin d'essai incluant cette instance.

Ces décisions ne changent pas la cible production Cloud SQL régionale HA/Private IP.
Google réel, DB, réseau/IAM, déploiement et coût observé ne sont pas prouvés ici.

Références techniques : [pipeline OAuth2 Spring Security 6.5.8](https://github.com/spring-projects/spring-security/blob/6.5.8/oauth2/oauth2-client/src/main/java/org/springframework/security/oauth2/client/web/OAuth2LoginAuthenticationFilter.java),
[schéma Session 3.5.5 PostgreSQL](https://github.com/spring-projects/spring-session/blob/3.5.5/spring-session-jdbc/src/main/resources/org/springframework/session/jdbc/schema-postgresql.sql),
[repository JDBC et concurrence](https://github.com/spring-projects/spring-session/blob/3.5.5/spring-session-jdbc/src/main/java/org/springframework/session/jdbc/JdbcIndexedSessionRepository.java).
