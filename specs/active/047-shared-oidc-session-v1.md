# 047 — Session partagée OIDC/JDBC (M1.2)

**Statut au 26.11.2026 — qualification Google BROWSER_UI acceptée en non-production, repos applicatif et arrêt configuré vérifiés.** La spécification reste active jusqu’à l’intégration du complément. Le socle OIDC/JDBC a été livré par la PR #130.
Risque C ; surfaces FULLSTACK, DB, CONTRACTS et DOCS ; preuves FULL.
Précédent : [046 Done, fondation locale](../done/046-authenticated-session-foundation-v1.md).
Décision : [ADR 0008](../../docs/adr/0008-shared-google-oidc-jdbc-session.md).

## Résultat et périmètre

Préparer l'environnement interne non-production avec Google OIDC direct, une
session serveur JDBC et un frontend servi à la même origine HTTPS que l'API.
Le workflow de closing, les rôles, l'isolation tenant et l'audit métier existants
restent les autorités. Aucune auto-inscription ni attribution de rôle par email.
La campagne B39 a vérifié les trois admissions Google, l’isolation des deux tenants, le partage sur deux instances, la révocation et le logout. Les résultats et leurs limites figurent dans le [runbook de qualification](../../runbooks/m1-2-shared-nonproduction.md).

### Historique des candidats et des essais d’octobre

La livraison du socle est le squash `2188dd553f13ac8fda9019ebe391c2ec3bde171b`.
Le mandat autonome du 08.10.2026 couvre un complément de 25 chemins : packaging,
garde précoce, opérateur fermé, helper d'identité et conducteur privé de recette
documenté dans le runbook. Il conserve les migrations et le protocole, sans
delivery Git ni production. Les cinq cas PostgreSQL historiques restent datés ;
les preuves Cloud P1–P9 doivent être acquises séparément, avec review et records
préalables, puis retour min0/probes off. Un résultat partiel ne clôture pas 047.

La reprise historique du 10.10.2026 reconduisait les 31 chemins exacts du
manifeste final précédent, les scripts privés et les mêmes ressources. Sa fenêtre
était de six heures dans le plafond de 100 CHF de cette période. Elle a expiré. Les trois fichiers frontend
conditionnels restent inchangés. Aucun droit de delivery Git ou de production.

La reprise TLS du 9–10 octobre conserve le FQDN Cloud SQL exact, point terminal
compris, et prouve la connexion privée `verify-full` ainsi que les refus pour
mauvais hostname et mauvaise CA. V1–V11, les droits runtime et l'administration
privée ont leurs preuves réelles distinctes. Le candidat CLOUD07 corrige le rejet
du header `Forwarded` observé sur Cloud Run ; ses 774 tests backend passent et
le canary réel retrouve le refus anonyme attendu sans fuite dans les destinations
examinées. L'URI OAuth a été confirmée par l'owner. Ces acquis ne prouvent pas un
login. Le 10 octobre, l'owner rapporte une page Google puis un retour refusé
pour A ; l'assertion de parcours échoue et ne distingue pas refus d'admission
et erreur OAuth. Lors du nouvel essai diagnostique, il rapporte un refus de
sécurité Google du navigateur. Cette voie est arrêtée sans contournement et
les navigateurs détenus sont fermés. La cause du premier échec reste indéterminée.
B, les bindings et les phases applicatives suivantes ne sont pas exécutés ;
P2 reste non concluant. Résultats, échecs conservés et retour au repos figurent
dans le runbook/FEP.

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
   `https` ; X-Forwarded-For n'est jamais une autorité. Seul un `Forwarded`
   optionnel unique est admis sous une grammaire fermée : deux paramètres uniques
   `for` et `proto=https`, aucun host/by/extension/liste, au plus 2 048 caractères
   ASCII imprimables sans virgule ni antislash. `for` est opaque, de 1 à 256
   caractères alphanumériques ou `._-`, éventuellement cité avec `:[]` également
   admis ; il ne détermine ni adresse de confiance, origine, redirection, tenant
   ou identité. Ce validateur est distinct du classificateur diagnostique. Les
   autres forwarded headers restent refusés. Les mutations exigent Origin canonique et CSRF ; un
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
Cette preuve locale historique reste datée. Pour le complément Cloud, l'arbitrage
du 09.10.2026 exige deux passes **standard** complètes sur le même candidat gelé.
Le finaliseur applique désormais une enveloppe monotone globale de 7500 ms,
incluant observations et travail synchrone. La fermeture native peut emprunter
le temps inutilisé des deux premières phases jusqu'à 4500 ms, en réservant
1500 ms à privacy et 1500 ms à l'attachment ; aucune deadline runner n'augmente.
Sortie normale détenue, identité/absence de liens, suppression et absence du
profil restent requises. Une fin tardive ou un timer retardé interdit PASS.
La règle1500 et le FAIL1304/1307 de l'objet04 sont conservés dans les preuves ;
ni la cause Chromium ni Google/Cloud ne sont qualifiés par ce changement.
Le premier standard du nouveau candidat reste FAIL (1322/1324, expiry/logout).
La passe instrumentée de diagnostic échoue aussi sur deux autres fermetures ;
elle ne remplace pas une validation du candidat final. Les 17 contre-exemples
ajoutés et les régressions de profil passent dans le ciblage déterministe,
lint/build passent, mais la confirmation standard et le Cloud restent non acquis.
L'instrumentation temporaire est retirée ; limites et preuves figurent dans le
runbook et le FEP privé. La spec reste Active.

L'avenant de stabilisation du 09.10.2026 autorise la comparaison des fixtures
synthétiques sur le Chromium153/r1243 associé au package Playwright1.63.0 déjà
verrouillé. Le navigateur historique143/r1200 et le binding D restent distincts ;
aucune preuve de campagne ne se transfère. Installation isolée, contrôle du
manifeste et de toute la distribution, version runtime et refus de substitution
précèdent la qualification. Les assertions et bornes de finalisation restent
inchangées. Deux exécutions complètes du même candidat/environnement, sans échec
ni skip Windows, lint/build et review exacte restent requis avant le Cloud.
L'alignement seul échoue à 1331/1334. Le diagnostic suivant, fichier complet
isolé, passe à 357/357 ; il ne remplace pas les deux suites complètes. Ce résultat
justifie le conducteur candidat `pnpm test:ci` en deux groupes successifs,
ordinaires puis Chromium, avec conservation du corpus, des multiplicités,
de l'isolation et des concurrences fonctionnelles internes. Chaque groupe reste
obligatoire et tout échec est propagé. Les dix skips natifs historiques hors
Windows demeurent des skips, jamais une preuve native. La cause du rejet de
nettoyage DRAIN antérieur reste inconnue. Voir les objets, comparaisons et
résultats complets dans le FEP privé ; aucune qualification Cloud n'en découle.

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
Marge indicative à la date du 06.10.2026 sur l’ancienne enveloppe de 100 CHF / 30 jours : 35,33 CHF.
C'est une estimation conditionnelle, pas une dépense observée, un devis ou un
plafond garanti. Les dépenses déjà engagées et les inconnues PITR/consommation
restent séparées. La restriction proposée à 21 jours n'est pas retenue.

La fin d'essai couvre aussi l'instance réaffectée : arrêt et suppression futurs
doivent être identifiés et autorisés séparément ; l'arrêt seul conserve des frais.
Aucune suppression à J30 n'est programmée. Voir le [runbook](../../runbooks/m1-2-shared-nonproduction.md).

## Preuve de session par client

Le rail synthétique PostgreSQL à deux JVM porte la preuve de non-résurrection et du refus inter-JVM de la session exacte après logout. La recette Cloud BROWSER_UI vérifie les connexions Google ordinaires, la révocation visible, le logout et la continuité de B. Le partage requiert des observations corrélées du même contexte sur deux instances. Le rejeu exact après logout inter-instance Cloud reste non mesuré. [Contrat de qualification](../../contracts/qualification/shared-session-witness-v1.md)
