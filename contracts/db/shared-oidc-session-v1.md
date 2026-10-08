# Contrat DB — OIDC et sessions partagées v1

Portée : [047](../../specs/active/047-shared-oidc-session-v1.md), migration V11 additive,
PostgreSQL 17. V11 et les cinq cas M12 sont qualifiés sur la campagne locale du
07.10.2026, avec IdP synthétique, cessation et nettoyage attestés. Le candidat
reste non livré ; cette preuve ne vaut ni qualification Google réel ni Cloud.

## Identité globale, autorité tenant séparée

`oidc_identity_binding` porte id UUID opaque, issuer/subject non vides (255 caractères
maximum), contrainte unique sur leur couple, app_user_id FK et active booléen.
Ce mapping global d'identité ne contient aucun rôle ni tenant. L'admission et
chaque requête relisent utilisateur, binding et appartenances actives via identity.
Les repositories métier conservent leur scope tenant et leur audit existants.

Le trigger `oidc_binding_reference_changed` remplace id par un UUID neuf si issuer,
subject, app_user_id ou active change. La session référence cette génération
opaque ; désactiver puis réactiver le même binding ne ressuscite aucune session
ancienne. La suppression du binding révoque de la même façon à la prochaine
requête. Aucune copie d'email Google, auto-inscription ou endpoint de provisioning.
`app_user.external_subject`, exposé par `/api/me`, reste un identifiant interne
synthétique distinct du subject fournisseur. Le provisionnement réel est une
opération ultérieure identifiée, revue et autorisée.

## Sessions

`spring_session` et `spring_session_attributes` reprennent le schéma PostgreSQL
Spring Session 3.5.5 embarqué : PRIMARY_ID, SID unique, temps de création/accès,
durée inactive, expiration, principal_name et attributs BYTEA en FK cascade.
Index SID unique, expiry_time et principal_name ; clé composée sur les attributs.
Les noms de tables sont fixes. La création est réservée à Flyway ; pas d'init SQL
automatique du profil partagé, pas de migration implicite au démarrage.

Les attributs autorisés sont le SecurityContext de l'acteur applicatif minimal
et le CSRF nécessaire au framework. Aucun OAuth2AuthorizedClient, OAuth2/OIDC
principal, access/refresh/ID token, email ou subject fournisseur. L'acteur durable
porte actorId, mécanisme OIDC, authenticatedAt, opaqueAuthCorrelation et
oidcBindingId ; aucun rôle figé ou tenant actif dans le principal.

Idle 1800 secondes, maximum absolu huit heures appliqué au kernel ; nettoyage
des sessions expirées par Spring Session. Login partagé : invalidation de l'ancien
SID/PRIMARY_ID, puis création d'une nouvelle ligne, avant saveContext minimal.
Logout : suppression de la session et cascade attributs. Les requêtes déjà en vol
ne sont pas une annulation transactionnelle de mutations métier déjà engagées.

## Transactions OIDC transitoires

`oidc_authorization_transaction` porte :

| Champ | Contrainte / sens |
|---|---|
| state_hash | CHAR(64), PK, SHA-256 du state |
| session_hash | CHAR(64), unique, SHA-256 du SID anonyme |
| nonce | Non vide, maximum 256 ; matériel protocolaire transitoire |
| code_verifier | 43 à 128 caractères, PKCE S256 |
| return_path | Maximum 100, `/` ou chemin dossier canonique validé par l'application |
| created_at / expires_at | Instants serveur DB ; durée strictement positive, au plus cinq minutes |

Index sur expires_at. Une nouvelle initiation remplace atomiquement l'essai
de la même session anonyme. Aucun state ou SID brut n'est persisté dans cette table.
La lecture valide les deux digests et l'expiration. La consommation utilise
`DELETE … RETURNING` sous `REQUIRES_NEW`, timeout transaction cinq secondes ;
le commit précède l'échange de code HTTP et ne dépend pas de sa réussite.
Au plus un callback gagne. Aucun rollback métier externe ne restaure l'essai.
Purge de 100 lignes expirées au plus, lors de l'initiation et chaque minute.
L'expiration interdit déjà l'usage, même avant la purge physique.

## Droits, rétention et preuve

Le futur rôle runtime doit lire les bindings/utilisateurs/appartenances, accéder
aux tables de session et de transaction, et garder ses seuls droits métier
nécessaires. Il ne reçoit pas le provisionnement des bindings ou les migrations
par le parcours login. Les droits exacts seront revus sur la base dédiée dans
l'instance existante réaffectée ; aucune connexion ni modification de droits ici.

Les tests hors DB vérifient le schéma embarqué, les paramètres/transactions et
le refus de persister un principal fournisseur. Les tests DB couvrent
unicité, rotation du binding, reprise entre repositories, session obsolète après
login/logout, consommation concurrente et TTL/purge. Les cinq cas ont réussi le
07.10.2026, sans échec, erreur ou skip. Le cas inter-JVM utilise A1/B puis A2/B, avec les vrais
repositories, filtres et sérialisations JDBC et un IdP synthétique loopback.
Il exige rotation SID/PRIMARY_ID/CSRF, lecture sur B, cessation A1 avant A2,
relecture après redémarrage, logout sur B constaté sur A2 et deuxième compte
inchangé. Les canaux privés portent le matériel synthétique ; les preuves
n'en publient aucune valeur. Avant chaque reset, une activité JVM/JDBC/IdP
encore présente ou inconnue interdit la destruction.
Les attentes historiques sont alignées exactement sur V1–V11. La sélection
FULL historique 12/55 précède la qualification séparée 1/5 ; leurs pools ne
se chevauchent pas. Toute session SQL survivante interdit le cleanup M12,
sans `pg_terminate_backend`. Une identité de provisionnement incomplète laisse
la quarantaine en place. La campagne locale a réussi targeted 13 et FULL 55
(13 inclus dans 55), puis M12 5 ; ses records sont clos. Les objets exacts et
limites figurent dans le [runbook](../../runbooks/m1-2-shared-nonproduction.md#résolution-autonome-locale-du-7-octobre-2026).
Chaque nouvelle exécution ou delivery exige ses propres autorisations applicables.
