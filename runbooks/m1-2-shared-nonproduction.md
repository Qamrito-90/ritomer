# M1.2 — Préparation de l'environnement interne partagé

État : candidat local de [047](../specs/active/047-shared-oidc-session-v1.md),
non livré et non déployé. Ce runbook n'est ni une autorisation Cloud ni une
commande de migration. Les records exacts et les comptes réels sont privés.

## Tranche locale initiale

Le mandat initial couvrait code, tests hors DB, compilation des tests DB,
documentation et review distincte, sans exécution SQL. Des mandats distincts ont
ensuite couvert les campagnes PostgreSQL locales datées ci-dessous. Google réel,
Cloud, production et commit/push/PR/merge restent hors de ces campagnes locales.
La sous-étape M12 ajoute une campagne distincte au
rail existant ; ses sélections B/D et records historiques restent séparés, sans
réactivation. Aucun nettoyage du poste ni des archives locales.

Depuis `frontend`, les checks de cette tranche locale Windows sont
`pnpm test:ci --no-file-parallelism`, `pnpm lint`, `pnpm build`, selon l'amendement
`AUTH-20261006-M1-2-LOCAL-GUARD-FIX-01`. Le corpus et les concurrences internes
restent complets ; aucun skip, délai ou assertion n'est modifié. Le mode standard
a des échecs natifs historiques conservés dans les preuves. La CI garde
`pnpm test:ci` et doit encore établir son propre succès lors d'une delivery autorisée.
Depuis `backend`, les checks hors DB sont :

```powershell
.\gradlew.bat test windowsTest build --no-daemon --rerun-tasks
.\gradlew.bat bootJar -PbundleFrontend=true --no-daemon
.\gradlew.bat bootJar --no-daemon
```

La dernière commande vérifie qu'un JAR standard après l'opt-in ne garde aucun
asset. Le build frontend doit précéder l'opt-in ; index absent, symlink ou chemin
sortant de dist sont refusés. Aucun Exec pnpm, copie dans les sources ou changement CI.
Contrôler les XML portable/Windows : tests présents, positifs, aucun échec, erreur
ou skipped ; preuve Modulith incluse. Les tests DB sont compilés dans testClasses
mais exclus de ces tâches ; les opérations DB sensibles passent uniquement par
le rail et les records exacts d'un mandat distinct, jamais par un lancement parallèle.

Si le JDK Windows refuse son socket temporaire avant la compilation, le correctif
de processus documenté par le FEP fixe `jdk.net.unixdomain.tmpdir` sur le répertoire
de preuves existant de cette mission, puis restaure JAVA_TOOL_OPTIONS. Aucun
changement système ou d'assertion n'est requis. Conserver la commande et sa sortie.

## Préparation PostgreSQL M12 — mandat initial sans exécution

Cette section décrit la préparation initiale du 6 octobre, conservée comme
historique. `AUTH-20261006-M1-2-M12-IMPLEMENTATION-01` couvrait les adaptations
locales et tests hors DB. Aucun Preflight, Lifecycle, CleanupOnly, psql ou cas
`m12-process` réel n'était exécuté dans cette sous-étape. Les résultats des
campagnes ultérieures sont consignés séparément ci-dessous, avec leurs FEP.

Depuis `backend`, les contrôles prescrits sont :

```powershell
.\gradlew.bat testClasses --no-daemon
.\gradlew.bat test --tests '*DemoSeedLocalSourceGuardTest*' --tests '*JdbcSessionConfigurationTest*' --tests '*SharedOidcSessionSecurityTest*' --no-daemon --rerun-tasks
.\gradlew.bat windowsTest --tests '*DemoSeedLocalSourceGuardTest*' --no-daemon --rerun-tasks
.\gradlew.bat test windowsTest build --no-daemon --rerun-tasks
```

| Sélection du dispositif | Classes / cas | Connexions maximales |
|---|---|---|
| targeted historique | 2 / 13 | Dans le budget historique |
| FULL historique | 12 / 55 | Six pools × 2 + garde 1 = 13 |
| `m1_2PostgresRailQualification` | 1 / 5 | Pilote 2 + A 2 + B 2 + garde 1 = 7 |

Les phases utilisent des Jobs Windows successifs. Les 13 classes de l'inventaire
global restent contrôlées ; le seul tag de méthode `m12-process` est exclu de
`dbIntegrationTest` et inclus dans la qualification M12. Le chevauchement de
19 connexions est interdit ; la limite du rôle reste 16. A1 doit être arrêté
avant A2. Les workers n'ont que `shared-internal`, Flyway false et un schéma V11
déjà vérifié ; le pilote conserve `dbtest`/Flyway. MockMvc et l'IdP loopback
éprouvent le pipeline servlet, pas un serveur HTTPS ou Google réel.

La qualification réalise des observations `pg_stat_activity` via le pool pilote
déjà détenu, avant chaque reset et aux frontières A1/B/A2. Les chiffres expurgés
ne sont pas un pic continu : le calcul gardé réserve toujours la septième connexion.
Une session inconnue ou masquée est refusée, y compris un backend dont le type est
invisible au rôle ; ce refus conservateur peut arrêter une campagne. La clôture de
l'IdP utilise un thread détenu et une attente bornée ; interruption, erreur ou fin
tardive laissent la barrière de reset active. Leurs résultats locaux sont datés
dans les sous-sections de campagne ci-dessous.

La cible locale du dispositif est PostgreSQL 17 sur `127.0.0.1:15432`, base
`ritomer_043b_test`, rôle `ritomer_043b_test_runner`, créés de novo après preuve
de leur absence. PostgreSQL 16/5432 est hors scope. L'observation datée de
listeners `0.0.0.0`/`::` n'établit pas une exclusivité loopback ; le Preflight
autorisé vérifie les conditions réelles. Aucun service, HBA, listener
ou pare-feu n'est changé par cette préparation.

Le dossier privé initial sous `out/m1-2-postgresql-implementation-20261006-01`
devait lier un seul RunId, les commandes absolues Preflight/Lifecycle/CleanupOnly,
les octets/hashes de scripts et exécutables, les manifests et les trois projets
de records distincts. Ces projets ne valent pas autorisation. Les valeurs de
cluster/OID encore inconnues doivent provenir de l'unique Preflight exact ;
elles ne sont ni inventées ni copiées d'un record consommé. La transition vers
Lifecycle est vérifiée directement entre principal et Reviewer selon les
conditions préalablement autorisées, sans modification du launcher.

Preflight est borné à 40 minutes, Lifecycle à 110 minutes, dont 7 réservées à
arrêt/nettoyage/contrôles, et CleanupOnly à 7 minutes. Lifecycle doit aussi se
terminer dans les 150 minutes depuis le début du Preflight, attente de
transition comprise. Toutes ces opérations, récupération comprise, expirent
avec les octets du mandat initial le **07.10.2026 à 11:19:27 UTC**. Cette échéance
est historique ; elle n'est pas celle de la résolution autonome ci-dessous.
Une campagne ultérieure exige
une nouvelle enveloppe explicite et le renouvellement des octets, contrôles,
review et bindings affectés ; la date ne peut pas être corrigée silencieusement
après review. Le secret administrateur fixe reste hors
Git ; seule son utilisation future autorisée par psql est prévue. Aucun agent
ne le lit, crée, affiche ou hashe dans cette sous-étape. Le secret runner reste
éphémère, limité aux processus autorisés, absent des logs et artefacts.

Un résultat rouge reste rouge même si le cleanup réussit. Aucune destruction
si reçu de provisionnement/OID/instance ou cessation sont inconnus : quarantaine
conservée, récupération distincte. CleanupOnly vérifie le contrôleur précédent,
les reçus, les Jobs et les sessions SQL ; il ne relance pas les tests. Toute
session SQL restante bloque le nettoyage, sans `pg_terminate_backend` M12.
Une relance conserve l'échec, justifie l'expérience, prouve cessation et cleanup
ou laisse la quarantaine, puis vérifie les bindings et droits encore valides.
Un changement matériel exige leur renouvellement ; aucun hash futur inconnu
n'est couvert implicitement.

### Résultat de la reprise locale r2 du 7 octobre 2026

Le mandat distinct `ODR-20261007-M1-2-M12-EXECUTION-02` a couvert une invocation
Preflight puis Lifecycle sur les seuls objets exacts alors revus. Preflight,
targeted 2/13 et FULL historique 12/55 passent. La qualification M12 reste
**FAIL** : V11/binding passe, le scénario deux JVM échoue ; un cas est skipped
et deux sont absents après fail-fast. Le nettoyage intégré et la cessation
sont attestés ; CleanupOnly n'a pas été nécessaire. Les deux droits invoqués
sont consommés et le droit de secours est fermé sans exécution. Les preuves
exactes et la review FAIL sont conservées dans le FEP privé de cette reprise.

Après préservation de l'objet exécuté et clôture de sa review, le correctif
hors DB garde l'erreur primaire et les échecs secondaires par étape sous forme
de codes fermés, sans cause, message ou suppressed privé. Tous les nettoyages
et le contrôle de quiescence restent tentés ; un échec reste bloquant.
La vérification de chaque fichier du runtime conserve ses contrôles d'ancêtres,
type et SHA-256, répartis entre au plus quatre lecteurs détenus. Leur executor
attend la fin de toutes les tâches de lecture avant tout retour, même sur erreur ou interruption ;
l'inventaire de structure est toujours contrôlé ensuite. Aucun délai ne change.
Les tests attendent séparément la mort des threads observés ; la fixture native
attend aussi le signal de fin du processus racine, distinct du Job vide, dans
le restant de son budget de terminaison initial de trois secondes.

Ce correctif et ses vérifications hors DB ne qualifient pas le scénario réel
et ne prouvent pas rétrospectivement sa cause initiale, masquée par l'ancien
finally. Toute nouvelle exécution sensible exige une review et des bindings
renouvelés ; aucun record consommé ni runtime corrigé n'autorise une relance.

### Résolution autonome locale du 7 octobre 2026

Le mandat `ODR-20261007-M12-AUTONOMOUS-RESOLUTION-01` a couvert les corrections
nécessaires dans les 49 chemins existants et une extension unique de 12 heures,
de **17:42 UTC le 7 octobre à 05:42 UTC le 8 octobre**. L'ancienne échéance et
le contrôle tardif après son expiration restent historiques, sans autorisation
rétroactive. La nouvelle échéance du rail a été vérifiée séparément ; les
plafonds 40/110/7 minutes, la fenêtre de 150 minutes, INIT et les oracles n'ont
pas été augmentés ou affaiblis.

La campagne `f6b31f2daadf44189bcb043cedcc9b3c` a terminé Preflight et Lifecycle
avec codes natifs 0. **Targeted 13/13, FULL historique 55/55 et M12 5/5** passent,
sans échec, erreur, skip ou méthode absente ; les 13 ciblés sont inclus dans
les 55 historiques. V11, consommation concurrente, TTL/purge, attributs minimaux
et non-résurrection sont qualifiés. Le scénario A1/B/A2 établit la reprise sans
nouveau login, le logout effectif depuis l'autre JVM et le second compte préservé.

Les observations de connexions donnent 2/4/6/4/6/2 aux frontières contrôlées,
sans connexion inconnue ni phase historique survivante. Le maximum **observé**
est 6 ; ce n'est pas une mesure continue du pic. Les pools et le budget M12 de 7
restent sous le plafond de rôle 16. Workers, IdP et activités JDBC sont cessés
avant reset/nettoyage ; les reçus et l'observation OS corroborent la cessation.
La base et le rôle propres au run ont été supprimés, les sessions résiduelles
sont nulles selon le rail et aucune quarantaine ne subsiste.

Lifecycle dure 29,747 minutes ; du début de Preflight à sa fin, 56,256 minutes.
La review distincte conclut **PASS_WITH_RESIDUAL_RISK**, sans finding bloquant,
sur l'objet exécuté. Les records Preflight/Lifecycle sont consommés ; CleanupOnly
est fermé `NOT_REQUIRED`, jamais activé ni invoqué. Les 735 tests hors DB réussis
le même jour entre 07:50 et 08:21 UTC sont réutilisés comme preuves datées du code
inchangé ; huit contrôles d'horloge et une compilation ont été renouvelés.

Les sources/diff exécutés, les runtimes, XML, reçus, commandes, clôtures et reviews
sont conservés dans le FEP privé `out/m12-resolution-autonome-20261007-01`.
Le cumul documentaire postérieur reste identifié séparément du diff exécuté.
L'échec r2 ci-dessus est conservé ; ce succès ne prouve pas rétrospectivement sa
cause primaire. La preuve reste locale servlet/PostgreSQL avec IdP synthétique :
Google réel, HTTPS réseau, Cloud, production, delivery et clôture complète de
M1.2/047 restent hors de ce verdict. Les reviews sont IA, sans signature humaine
ni séparation réelle des fonctions.

## Préconditions d'une future exécution Cloud

1. Établir le budget global du mandat explicite de l'exécution concernée et sa
   consommation réelle. Aucun budget local ou historique ne s'applique par défaut.
2. Identifier les artefacts exacts, hashes, environnement et opérations nécessaires,
   leurs permissions effectives et la review sensible requise. Ne pas fabriquer
   de commandes sensibles exactes avant observation des préconditions.
3. Cibler le projet existant et **une seule instance SQL réutilisée**, initialement
   PostgreSQL 17 Enterprise zonal, 1 vCPU/3,75 GiB, `europe-west6`. Préparer une base
   logique dédiée et les rôles appropriés dans cette instance. Aucun doublon SQL
   permanent ; remplacement seulement si une impossibilité concrète est établie,
   avec cibles et opérations explicitement revues et autorisées.
4. La déclaration owner rend les anciennes données d'essai jetables. Aucun export
   de conservation n'est exigé pour ces seules données. Elle n'autorise aucun
   nettoyage global et ne prouve pas une inspection de toutes les lignes SQL.
   Les sauvegardes futures restent provisionnées ; aucun changement de PITR,
   rétention ou protection contre suppression ne découle de cette déclaration.
5. Séquencer réseau privé, accès Cloud Run via Direct VPC egress, vérification de
   la nouvelle connectivité, puis retrait IPv4 publique de l'instance réaffectée.
   L'ordre exact dépend de l'état observé. Pas de NAT/connecteur permanent/load
   balancer ajouté dans le scénario chiffré. Cloud Run Zurich, min instances zéro,
   facturation à la requête, sous contrôle des limites réellement configurées.
6. Préparer origine canonique HTTPS, client OAuth dédié et callback exact, secrets
   runtime et bindings A/B explicites sans exposer leurs valeurs dans Git/FEP.
   `app_user.external_subject` reste interne ; aucun subject Google dans `/api/me`.
7. Profil partagé exclusif, service Cloud Run attendu, HMAC absent, TLS DB
   `verify-full` et CA, migrations séparées, frontend embarqué. Vérifier les
   en-têtes réellement remis par la plateforme ; aucun contournement permissif
   si la topologie observée ne respecte pas la frontière.
   Configurer explicitement `RITOMER_WORKPAPERS_DOCUMENTS_STORAGE_BACKEND=GCS`
   et le bucket privé via `RITOMER_WORKPAPERS_DOCUMENTS_STORAGE_GCS_BUCKET`, avec
   les accès runtime appropriés. Le défaut hérité reste `LOCAL_FS` : il ne convient
   pas aux pièces et exports Cloud Run. Vérifier leur lecture après redémarrage
   et depuis deux instances avant toute acceptation de l'environnement partagé.
8. Garder les logs sécurité/session/JDBC/client HTTP hors DEBUG/TRACE et refuser
   toute collecte de query de callback, tokens, SID ou identités fournisseur.
   Le candidat ne configure ni ne certifie une journalisation durable Cloud ;
   vérifier séparément les logs de requêtes/plateforme et leur rétention avant
   Google réel. Aucune promesse de preuve d'audit pré-tenant durable.

## État des validations et campagnes restantes

- Le correctif local autorisé distingue l'inventaire global exact de treize classes
  DB et la sélection historique exacte de douze. La différence est le seul test
  OIDC nouveau ; aucun filtrage hors scanner, métadonnées ou budget de connexions.
  L'unique exclusion admise de SessionAutoConfiguration est contrôlée par clé,
  valeur et provenance dans application.yml ; tout override reste refusé.
  Les preuves d'échec initiales restent historiques, les résultats du correctif
  et sa review sont conservés séparément dans le nouveau FEP.
- La campagne PostgreSQL locale ci-dessus qualifie V11, contraintes/repositories,
  expiration/purge, consommation concurrente, sauvegarde obsolète, sérialisation
  minimale et continuité A1/B/A2. Les attentes historiques restent V1–V11,
  FULL 12/55 puis M12 1/5 ; leurs résultats locaux ne qualifient pas la cible Cloud.
- Google réel A/B, callback légitime sans Origin, refus d'identité non liée,
  révocation, CSRF, cookie, safe return et audit de sélection tenant conservé.
- QA navigateur same-origin : closing autorisé, refus inter-tenant, expiration,
  reconnexion explicite, logout, focus/multi-tab, clavier et viewport étroit.

Un défaut local se corrige dans un mandat applicable ; une action hors scope,
un coût, une permission ou un file-set supplémentaire, ou un budget atteint,
marque une frontière à consolider. La campagne locale ne remplace pas les
campagnes Google/Cloud et navigateur restantes.

## Budget financier et fin d'essai

Scénario retenu : une seule instance réaffectée sur 30 jours. Recalcul des prix
et volumes du FEP du 06.10.2026, sans nouveau relevé billing :

| Poste | CHF HT |
|---|---:|
| Instance existante, SSD et provision backups | 55,267678 |
| Accessoires M1.2 hors seconde SQL | 4,552248 |
| Total | 59,819926 |

Avec l'hypothèse budgétaire TVA 8,1 % : 64,665340006 CHF, arrondi **64,67 CHF** ;
marge indicative **35,33 CHF** sur **100 CHF / 30 jours**. Ni nouvelle facture,
ni devis, ni plafond garanti. Dépenses déjà engagées distinctes. Localisation et
facturation des journaux PITR, consommation réelle et effets de reconfiguration
restent à confirmer. Pas de restriction à 21 jours, pas de deuxième SQL chiffrée
en parallèle. Aucun prix ou état réseau n'est présenté comme nouvellement observé.

La liste future de fin d'essai inclura l'instance réaffectée, même préexistante,
et les seuls nouveaux services utiles. Distinguer arrêt, suppression et frais
persistants de stockage/sauvegardes. Chaque opération exige ses cibles exactes,
review et autorisation ; aucune suppression à J30 n'est programmée ou annoncée.
Ne jamais supprimer l'instance en se fondant uniquement sur son nom historique.
