# 047 — Session partagée OIDC/JDBC (M1.2)

Statut : **Active — candidat local qualifié sur PostgreSQL, non livré et non déployé** (07.10.2026).
Risque C ; surfaces FULLSTACK, DB, CONTRACTS et DOCS ; preuves FULL.
Précédent : [046 Done, fondation locale](../done/046-authenticated-session-foundation-v1.md).
Décision : [ADR 0008](../../docs/adr/0008-shared-google-oidc-jdbc-session.md).

## Résultat et périmètre

Préparer l'environnement interne non-production avec Google OIDC direct, une
session serveur JDBC et un frontend servi à la même origine HTTPS que l'API.
Le workflow de closing, les rôles, l'isolation tenant et l'audit métier existants
restent les autorités. Aucune auto-inscription ni attribution de rôle par email.
Le présent candidat ne ferme ni M1.2 ni M1 complet.

L'implémentation locale initiale couvrait les 42 chemins du mandat
`RITOMER-M1-2-LOCAL-IMPLEMENTATION-20261006-01`, sur sa base
`21564039f27be647e59023007682882701a40bf5`, plus le fichier de garde dans les
zones précises de l'amendement `AUTH-20261006-M1-2-LOCAL-GUARD-FIX-01`
(43 chemins autorisés, sans obligation de les modifier tous). Le mandat et ses amendements exacts
sont conservés dans les preuves privées. Cette tranche initiale ne couvrait
aucune exécution DB/Cloud, delivery, merge ou production.
La sous-étape `AUTH-20261006-M1-2-M12-IMPLEMENTATION-01` a ensuite autorisé
17 chemins précis pour préparer la qualification PostgreSQL, dont un seul
nouveau helper JVM, sans accès SQL. Les campagnes suivantes ont leurs mandats
distincts. La résolution `ODR-20261007-M12-AUTONOMOUS-RESOLUTION-01` a couvert
49 chemins bornés et une extension unique de 12 heures ; elle n'a réactivé
aucun record consommé ni autorisé rétroactivement l'ancien budget de 24 heures.
La campagne locale finale est réussie et ses records sont clos ; chronologie,
objets exécutés et preuves figurent dans le FEP privé et le runbook. Aucune
autorisation Cloud, delivery, merge ou production n'en découle.

## Contrat implémenté

1. `shared-internal` doit être le seul profil. Configuration HTTPS canonique,
   client OIDC, session activée et frontend explicitement embarqué requis.
   HMAC historique, profil local/test/dbtest conjoint, domaine cookie et
   transformation automatique des forwarded headers refusés.
2. Authorization Code, scope `openid` seul, state, nonce, PKCE S256, signature
   RS256, issuer, audience et expiration validés par Spring Security. Pas de
   UserInfo, pas de discovery réseau au démarrage, pas de provisioning.
3. Le binding exact `(issuer, subject)` doit être actif, lié à un `app_user`
   actif avec au moins une appartenance active. L'email fournisseur ne décide
   rien et n'est pas recopié. `app_user.external_subject` reste interne.
4. La transaction OIDC est en base, hors des attributs de session : digests
   state/SID, nonce, vérificateur PKCE et retour borné, TTL maximal cinq minutes.
   Une transaction remplace la précédente pour la même session anonyme.
   `DELETE … RETURNING` en transaction indépendante consomme avant l'échange
   token ; aucun échec ultérieur ne réactive la transaction. Purge bornée périodique.
5. L'acteur applicatif minimal remplace le résultat OIDC **avant** stratégie de
   session et sauvegarde du SecurityContext. L'AuthorizedClient n'est jamais
   sauvegardé. Aucun token Google ou profil fournisseur ne rejoint la session.
6. Le login partagé invalide l'ancienne session et en crée une nouvelle sans
   migrer les attributs applicatifs ; SID et CSRF changent. Le nouveau CSRF est
   lu au bootstrap. La recréation évite qu'une sauvegarde anonyme concurrente
   puisse remettre l'ancien SID sur la ligne JDBC authentifiée.
7. Cookie `__Host-ritomer-session`, Secure, HttpOnly, Path=/, SameSite=Lax, sans
   Domain ; transport cookie seul. Idle 30 minutes, maximum absolu huit heures.
   Logout invalide le stockage serveur et expire le cookie. Chaque requête
   authentifiée relit binding, utilisateur et appartenances ; une révocation
   retire la session. Changer l'identité ou l'état du binding change sa référence
   opaque, empêchant la réactivation d'anciennes sessions par réactivation du binding.
8. Mode direct : HTTPS réel, Host canonique, aucun forwarded header. Mode Cloud
   Run : service runtime attendu, Host canonique et unique X-Forwarded-Proto
   `https` ; X-Forwarded-For n'est jamais une autorité. Les autres forwarded
   headers sont refusés. Les mutations exigent Origin canonique et CSRF ; un
   callback GET légitime sans Origin reste admis sous les contrôles du protocole.
9. Bootstrap partagé strict : `localLoginAvailable=false`,
   `oidcLoginAvailable=true`, aucun acteur local. Le bundle production refuse
   tout bootstrap local et tout fallback legacy. Un coordinator ayant reconnu
   le partagé conserve cette frontière après erreur, expiration et logout.
10. Le lien Google est une navigation native. Les seuls retours admis sont `/`
    et `/closing-folders/{uuid canonique}`, sans query/fragment. Erreur fixe
    `/?login=failed`, sans détail fournisseur. Aucune donnée métier avant admission.
11. Seuls shell et assets nécessaires sont publics. Aucun fallback SPA pour
    `/api`, OAuth, chemins inconnus ou dossiers mal formés. Les règles backend
    protègent les API indépendamment du frontend. Pas de bearer en partagé.
12. V11 est additive. V1–V10 et CI inchangés ; les sélections B/D du rail sont
    conservées lors de l'ajout de la campagne M12. Deux dépendances gérées
    par Spring Boot : oauth2-client et spring-session-jdbc. Le packaging frontend
    est opt-in ; le build backend standard ne dépend pas de Node/pnpm.

## Acceptation et preuves séparées

| Critère | Preuve locale attendue | Limite à lever séparément |
|---|---|---|
| Admission et tenant | Tests métier de contre-exemples, aucun write implicite | Comptes Google réels et bindings préprovisionnés |
| Protocole | IdP loopback HTTP, RSA/JWKS en mémoire, vrai pipeline Spring ; fautes state/nonce/PKCE/signature/issuer/aud/exp, rejeu et concurrence | Google réel, client OAuth et HTTPS cible |
| Session minimale | Inspection des sauvegardes et tests locaux ; JDBC réel, A1/B/A2, logout et non-résurrection qualifiés | Environnement partagé déployé avec Google réel |
| Stockage | V11, contraintes, consommation concurrente, TTL/purge et nettoyage qualifiés sur PostgreSQL local | Migration et exploitation de la cible Cloud sous mandat distinct |
| UX | Bootstrap strict, erreurs, lien natif, retour sûr, purge, clavier/accessibilité automatisée | QA intégrée du déploiement partagé |
| Compatibilité | Suites backend portable et Windows, Modulith, frontend test/lint/build ; targeted 13 et FULL 55 sous V1–V11 | CI de delivery et environnement partagé déployé |
| Packaging | JAR opt-in avec assets puis JAR standard sans résidu | Déploiement source Cloud Run |

`SharedOidcSessionDbIntegrationTest` couvre cinq cas : V11/bindings ; sessions
et non-résurrection ; consommation atomique sur deux connexions ; TTL/purge ;
continuité A1/B/A2 et logout sans affecter le deuxième compte. La campagne locale
du 07.10.2026 a réussi targeted 13, FULL 55 puis M12 5, sans échec, erreur,
skip ou méthode absente ; cessation et nettoyage sont attestés. Les 13 ciblés
sont inclus dans les 55 historiques. Les quatre attentes de migrations dans
Documents/Exports/Workpapers sont alignées exactement sur V1–V11.
L'inventaire global reste de treize classes ; targeted conserve 2 classes/13 cas,
FULL conserve 12 classes/55 cas. `m1_2PostgresRailQualification` sélectionne les
cinq cas M12 dans une JVM pilote séparée. Seul le cinquième porte `m12-process` ;
`dbIntegrationTest` exclut ce tag de méthode, sans masquer la classe entière.
Les helpers et leurs classes internes restent dans le scanner de sécurité.
Les workers A/B ont le seul profil `shared-internal`, Flyway désactivé et V11
préalablement vérifié ; le pilote garde `dbtest` et Flyway. Les six pools
historiques (12 connexions + garde 1) doivent être libérés avant les pools M12
(pilote 2 + A 2 + B 2 + garde 1 = 7), sous la limite inchangée de 16.
MockMvc utilise les vrais filtres/repositories JDBC ; il n'est pas un serveur
HTTPS réseau. Les tests hors DB datés, la campagne PostgreSQL réelle et les reviews
sont distinctement consignés dans le FEP exact. Ils ne qualifient ni Google réel
ni Cloud et ne clôturent pas cette spec.
La validation frontend locale Windows retient explicitement le corpus complet en
mode sériel selon l'amendement. Les échecs historiques du mode standard sont
conservés et la CI garde sa commande actuelle ; voir le [runbook](../../runbooks/m1-2-shared-nonproduction.md).

## Cible Cloud et coût conditionnel

Une seule instance PostgreSQL existante est réaffectée dans `europe-west6`,
initialement 1 vCPU / 3,75 GiB, PostgreSQL 17 Enterprise zonal, avec une base
logique applicative dédiée. Aucune seconde instance permanente. Le réseau privé
et le retrait de l'IPv4 publique restent à préparer puis autoriser. Les identités,
comptes et cibles exactes sont dans les références privées d'exécution.

Luis a déclaré les anciennes données Cloud d'essai jetables, sans obligation
métier de sauvegarde avant leur éventuelle réinitialisation ciblée. Ce choix
n'autorise aucun nettoyage du compte, du projet entier, du workspace ou des
preuves. Il ne désactive pas les sauvegardes futures.

Le recalcul du FEP du 06.10.2026 conserve ses prix et volumes : 55,267678 CHF HT
pour l'instance/SSD/provision backups + 4,552248 CHF HT d'accessoires =
59,819926 CHF HT, soit **64,67 CHF** avec l'hypothèse budgétaire TVA 8,1 %.
Marge indicative 35,33 CHF sur l'enveloppe inchangée de 100 CHF / 30 jours.
C'est une estimation conditionnelle, pas une dépense observée, un devis ou un
plafond garanti. Les dépenses déjà engagées et les inconnues PITR/consommation
restent séparées. La restriction proposée à 21 jours n'est pas retenue.

La fin d'essai couvre aussi l'instance réaffectée : arrêt et suppression futurs
doivent être identifiés et autorisés séparément ; l'arrêt seul conserve des frais.
Aucune suppression à J30 n'est programmée. Voir le [runbook](../../runbooks/m1-2-shared-nonproduction.md).
