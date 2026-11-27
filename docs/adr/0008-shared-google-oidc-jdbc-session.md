# ADR 0008 — Google OIDC direct et sessions JDBC pour M1.2 interne

Date initiale : 06.10.2026. Socle livré par PR #130 (`2188dd553f13ac8fda9019ebe391c2ec3bde171b`).
Le complément [047](../../specs/active/047-shared-oidc-session-v1.md) a été qualifié en non-production le 26.11.2026 avec Google et deux instances de la même révision. La connexion SQL privée en `verify-full` et les migrations ont leurs preuves d’octobre. Voir les [résultats et limites](../../runbooks/m1-2-shared-nonproduction.md).
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
requête anonyme concurrente. La campagne PostgreSQL locale du 07.10.2026 a éprouvé
cette propriété et la reprise multi-JVM avec IdP synthétique. B39 complète cette preuve locale par les observations du navigateur sur Cloud. Le rejeu exact inter-instance après logout reste couvert par le rail local.

Le projet et l'unique instance SQL existants seront réutilisés : PostgreSQL 17
Enterprise zonal à Zurich, capacité initiale 1 vCPU/3,75 GiB et base logique dédiée.
Connectivité privée et retrait IPv4 publique seront séquencés séparément. La
disposabilité owner des données d'essai retire l'obligation de préserver ces jeux,
sans autoriser une opération réelle ni désactiver les sauvegardes futures.
Estimation historique du 06.10.2026 : **64,67 CHF / 30 jours**, conditionnelle aux mêmes volumes,
prix et TVA hypothétique que le FEP, dans une enveloppe de 100 CHF ; aucune deuxième
SQL ni durée de 21 jours dans le scénario retenu. Fin d'essai incluant cette instance.

Ces décisions ne changent pas la cible production Cloud SQL régionale HA/Private IP.
Google réel, DB, réseau/IAM, déploiement et coût observé ne sont pas prouvés ici.

## Route de qualification Cloud retenue le 8 octobre 2026

Une image commune est construite depuis les sources par Cloud Build régional,
avec Dockerfile multi-stage, bases épinglées par digest, pnpm 9.15.9, Gradle 8.14.4
inchangé avec SHA officiel et JRE 21 non-root. Docker reste absent des prérequis
locaux. L'opérateur se lance explicitement via PropertiesLauncher, sans Spring
Application ni endpoint d'administration ; le serveur reste l'entrée par défaut.

Le trafic SQL utilise Direct VPC egress, PSA et DNS privé, avec JDBC `verify-full`
et bundle CA public Zurich fixé avant le build. Le passage de la CA par instance
à `GOOGLE_MANAGED_CAS_CA` est irréversible vers le mode interne ; la qualification
du chemin privé précède le retrait IPv4. Ce choix de campagne ne modifie pas la
cible production HA ni n'établit son exécution.

La garde Cloud s'exécute après ConfigData et avant logs/beans : profil exclusif,
runtime DB borné, GCS, initialisation SQL/Flyway interdite, pool limité et logs
fermés. Les migrations passent séparément par le rôle NOLOGIN propriétaire,
activé sur chaque connexion Flyway. V1–V11 restent inchangées.

Un filtre temporaire default-off, placé avant Spring Session, émet seulement
challenge UUID, bootId, révision et statut sur quatre routes fermées. La recette
rapproche chaque requête de son instance Cloud native. Les logs HTTP de plateforme
doivent être exclus dans tous les routages applicables et éprouvés par canari
synthétique avant tout login ; les seuls réglages projet ne suffisent pas.
En qualification, le refus d'un `GET /api/me` anonyme avec challenge valide peut
également émettre un diagnostic distinct : challenge et raison parmi un enum
fermé. Aucun nom dynamique ni valeur d'en-tête n'est enregistré ; les décisions
de la frontière restent identiques et l'arrêt des probes désactive ce diagnostic.
Pour un refus d'en-têtes de transfert, une seconde observation fermée distingue
simultanément leurs présences et quelques formes attendues. Elle ne contient
aucune valeur, adresse IP ou autorité reçue, et n'accorde aucune confiance aux
en-têtes observés. Le diagnostic de forme ne participe jamais à l'admission.

Le modèle complet de préparation est 65,06 CHF / 30 jours, avec prix historiques,
volumes et TVA hypothétique explicités dans le plan privé du 08.10.2026. Il inclut
DNS, Jobs et provision de transfert privé ; l'enveloppe reste 100 CHF, dont 5 CHF
de cessation. Ces montants ne constituent pas une mesure fraîche de facturation.

Références techniques : [pipeline OAuth2 Spring Security 6.5.8](https://github.com/spring-projects/spring-security/blob/6.5.8/oauth2/oauth2-client/src/main/java/org/springframework/security/oauth2/client/web/OAuth2LoginAuthenticationFilter.java),
[schéma Session 3.5.5 PostgreSQL](https://github.com/spring-projects/spring-session/blob/3.5.5/spring-session-jdbc/src/main/resources/org/springframework/session/jdbc/schema-postgresql.sql),
[repository JDBC et concurrence](https://github.com/spring-projects/spring-session/blob/3.5.5/spring-session-jdbc/src/main/java/org/springframework/session/jdbc/JdbcIndexedSessionRepository.java).
