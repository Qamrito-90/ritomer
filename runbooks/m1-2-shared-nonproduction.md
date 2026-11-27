# M1.2 — Qualification de l'environnement partagé

## État courant

Le 26 novembre 2026, la campagne B39 a satisfait le contrat `BROWSER_UI` dans l’environnement partagé de non-production. Ritomer a admis A, B puis A reconnecté avec Google. Les deux lectures de collecte à 60 secondes d’intervalle ont corrélé les mêmes 37 opérations. Pour A et B, le profil, la pièce et l’export ont chacun été servis par deux instances d’une même révision. Les quatre lectures hors tenant ont reçu HTTP 404.

Après révocation, A a reçu HTTP 403. Après restauration, le navigateur de A a reçu HTTP 401 jusqu’à sa reconnexion. La déconnexion normale a renvoyé HTTP 204 puis le profil de A a renvoyé HTTP 401. B a conservé ses trois accès. Le rail PostgreSQL local à deux JVM couvre le refus du cookie exact et de l’ancien CSRF. Le rejeu exact inter-instance après déconnexion reste non mesuré sur Cloud.

Le repos applicatif, le retrait des accès temporaires et la fermeture du navigateur ont été vérifiés. À 20 h 10 Zurich, Run était en mode manuel à zéro et SQL en `NEVER`. Les dix Jobs de B39 étaient terminés, pour 197 exécutions recensées. Les coûts de conservation persistent. Les reçus détaillés et les comptes de qualification sont conservés hors Git.
Le socle de la spécification [047](../specs/done/047-shared-oidc-session-v1.md)
a été livré par la PR #130 (`2188dd553f13ac8fda9019ebe391c2ec3bde171b`). La [PR #131](https://github.com/Qamrito-90/ritomer/pull/131) a intégré le complément qualifié dans `main` le 27 novembre.

Ce guide décrit le parcours actuel. Il ne renouvelle aucun mandat, budget,
créneau, droit ou autorisation consommée. Les paramètres de campagne restent
dans la configuration et les records applicables ; aucune date passée ne sert
de commande de reprise.

## Acquis à réutiliser

- FIX74 : Chromium et Spring HTTPS réels, 14 réponses corrélées à 14 événements
  serveur ; ancienne session refusée après révocation, restauration et reconnexion ;
  ancien CSRF refusé avant logout valide ; session déconnectée refusée ; B préservé.
- Le cas d'interruption après révocation ferme la famille de processus détenue,
  retire les bindings de la fixture et ne publie aucun export de réussite.
- Playwright 1.63.0, Chromium Headless Shell révision 1243, version 153.0.8010.12
  réellement vérifiés. Chromium 1200 ne constitue pas cette preuve.
- Le rail PostgreSQL à deux JVM conserve sa preuve distincte FIX72. Il n'a pas été
  relancé par FIX74 ; les résultats antérieurs gardent leur portée et leur date.

FIX74 utilisait un filtre de rétention du cookie. Le parcours actuel laisse
Spring émettre normalement ses expirations. Sur loopback, le client A conserve
uniquement sa propre session applicative, en mémoire, depuis le callback synthétique.
Le servlet observe l'identité de la session reçue sans modifier la réponse.
Les 30 requêtes comprennent 14 contrôles de session et 16 téléchargements via
les contrôleurs produit, avec un contenu distinct par tenant. Le client compare
la taille enregistrée, l'en-tête Content-Length, la longueur reçue et le SHA-256.
Le stockage de test est temporaire et local. Un seul servlet émet les événements.
Le résultat attendu du contrôle P7 à deux instances est `TWO_INSTANCES_NOT_PROVEN`.

## Reproduire le parcours local si une modification le nécessite

Depuis la racine du dépôt Windows, utiliser le Python local, le frontend construit
correspondant aux sources et le Chromium du lockfile. Le test compare la version
réellement lancée aux métadonnées Playwright. Aucun login Google n'est nécessaire.
Avec `RITOMER_M12_BROWSER_TEST=true`, les deux cas ci-dessous exercent une
session et une interruption à partir des sources du dépôt. Leurs résultats
Windows sont conservés séparément des rapports de la suite portable.

```powershell
$env:RITOMER_M12_FIXTURE_PYTHON = (Get-Command python.exe -ErrorAction Stop).Source
$env:RITOMER_M12_BROWSER_TEST = 'true'
$env:RITOMER_M12_RUN_ID = [guid]::NewGuid().ToString()
$env:RITOMER_M12_CHROMIUM = (Resolve-Path "$env:LOCALAPPDATA\ms-playwright\chromium_headless_shell-1243\chrome-headless-shell-win64\chrome-headless-shell.exe").Path
$env:RITOMER_M12_BROWSER_RESULT = (New-Item -ItemType Directory -Path ("out/recette-locale-" + [guid]::NewGuid())).FullName
# Les assets frontend/dist doivent correspondre au frontend courant.
Push-Location backend
try {
  .\gradlew.bat --offline --no-daemon test --rerun `
    --tests '*SharedOidcBrowserTest.browser-owned sessions*' `
    --tests '*SharedOidcBrowserTest.interruption after revocation*'
  if ($LASTEXITCODE) { throw 'Parcours local incomplet' }
}
finally { Pop-Location }
$env:RITOMER_M12_LOCAL_OBSERVATIONS = Join-Path $env:RITOMER_M12_BROWSER_RESULT 'local-browser-observations.json'
& $env:RITOMER_M12_FIXTURE_PYTHON -B backend/scripts/m12_qualification/test_browser_evidence.py -v
if ($LASTEXITCODE) { throw 'Reçus locaux refusés' }
```

Vérifier les codes de sortie et résultats réels des deux commandes, les scénarios
nominal et interrompu, les 30 corrélations et la cessation de la fixture.
Conserver l'identifiant fourni avant le lancement. La JVM publie le bilan
après vérification du côté serveur. Le collecteur relit séparément le reçu
du client par son SHA-256 et vérifie le candidat et cet identifiant.
Le collecteur ne doit pas qualifier deux instances à partir de ce montage local.
Le test ciblé du pilote fournisseur `DirectCampaignTests.test_current_servlet_output_traverses_native_publication_and_collection`
consomme également cet export et le même identifiant. Il exerce son éditeur et
son collecteur natifs avec les enveloppes de fournisseur et le repos simulés.
Réutiliser les preuves inchangées ; renouveler seulement celles affectées par un
changement. Une simulation, une absence de test ou un résultat rouge reste explicite.

## Campagne navigateur BROWSER_UI

Au prévol à l’arrêt, le pilote lit les identités des exécutions de Jobs, puis
chronomètre l’inventaire utilisé avant les changements de modèle du Job. Il
vérifie cet inventaire paginé contre celui du dernier arrêt, puis relit en
détail l’exécution de référence. Ces lectures partagent un maximum de sept
appels et de 120 secondes. La liste courante demande les identités, les
horodatages, les compteurs et les conditions de terminaison. Les exécutions de
la campagne et leurs tâches conservent leurs contrôles détaillés.

Le pilote fournisseur sous `out/m1-2-termination-20261011-01/recette-navigateur.py`
utilise `browser_campaign.py` et `frontend/e2e/shared-oidc-campaign.mjs`.
`RESOURCE_START` vérifie le runtime et le prévol hors ligne de Google Chrome standard. Le signal
READY du prévol est distinct des trois invitations personnelles. `ACTIVATE`
conduit préambule, bindings, invitations A/B/A2, cinq phases navigateur,
fermeture de la famille et repos. `OPEN` utilise le READY et l'autorisation de
la fenêtre personnelle exacte. Avant READY A, après les bindings et à proximité du créneau, vérifier la réponse anonyme
sur la révision du canari. Après les lectures fraîches de confidentialité et de révision, les transferts HTTP préparatoires et leur temporisation disposent ensemble de 65 s. Un seul second GET
avec un nouveau marqueur peut suivre une erreur DNS, de connexion ou une expiration
sans premier octet ni statut, après 2 s et si le budget restant suffit. Chaque tentative
garde son reçu. Un refus TLS, une réponse partielle ou une assertion en échec ferme la campagne.

Pour ces GET uniquement, le pilote lance le curl Windows lié par empreinte, avec le même
fichier de CA que le SDK, sans identité, proxy, redirection ni retry du transport.
Il mesure TCP, TLS et le premier octet, et borne chaque processus à 30 s, fermeture comprise.
Le refus anonyme du callback et la preuve de confidentialité du canari gardent leurs critères.
Après OPEN, chaque compte requiert un nouveau 401 client complet et le marqueur
correspondant dans les journaux de la révision et dans la fenêtre. Le départ garde 31 s
de marge. Un incident de transport à cette étape déclenche le repli. Une seconde mesure
d’horloge est permise seulement si la première réponse valide correspond à un événement
antérieur à OPEN. Le navigateur reçoit GO après validation.

Au signal GO, communiquer le compte prévu et l’adresse Ritomer. Dans la fenêtre
Chrome « Ritomer · campagne A », « B » ou « A2 », Luis choisit « Ouvrir
Ritomer », puis « Se connecter avec Google ». Il termine la connexion dans
l’onglet Google habituel et laisse les fenêtres ouvertes. L’adresse est un
repère pour reconnaître le service. Chaque compte utilise le profil ouvert
pour cette invitation. Le pilote vérifie d’abord le callback Spring de la
fenêtre et de la révision, puis le Workbench et les droits dans ce profil.
Le suivi `client_login:<acteur>` indique le dernier jalon et la condition attendue.

L’image non productive doit contenir le Workbench et le filtre Spring du même
candidat. L’activation introduit trois empreintes éphémères dans
`RITOMER_SHARED_BROWSER_COMMITMENTS` avec l’échéance de l’observateur.
Le retour au repos retire cette configuration. Une nouvelle image et le retour
à la référence antérieure requièrent un périmètre prospectif avant effet.

`COLLECT` utilise `expected_mode=BROWSER_UI`
et le reçu publié après repos. Conserver les contrôles VERIFY_FINAL et
RESOURCE_STOP, dont la vérification de Run MANUAL/0 et SQL NEVER.

Le fichier de campagne doit lier le runtime, le script et la sonde, les
identités attendues et les quatre fichiers des deux tenants. Il est référencé
par SHA-256 par la configuration de remise en service. Les nouveaux records
lient les artefacts, commandes, coûts, dates et avis indépendants. Toute commande
qui engagerait le fournisseur est soumise à ses gardes habituelles.

Lier `campaign_read_quota_project` au projet Ritomer dans le mandat, le prévol,
START et la configuration de campagne utilisée par ACTIVATE et COLLECT. Les
treize GET Org Policy conservent leur liste approuvée et son empreinte. Le SDK
prépare les lectures avec la même identité opérateur. Le prévol exige le droit
`serviceusage.services.use`, les droits de la cible et la présence du projet
attendu dans la requête préparée, y compris sur les pages suivantes.

Le contrôle couvre le GET du projet, les POST Resource Manager de vérification
des permissions du projet et de l’organisation, les deux vues Logging et leurs
droits, les entrées de journaux, les sinks et buckets des deux parents, et les
exclusions du projet. Un HTTP 429 Resource Manager ferme la lecture dès le
premier refus. Le reçu conserve le consommateur si Google le précise. Un
HTTP 200 atteste la disponibilité observée au moment du contrôle.

Pendant le repli intégré et REST séparé, le pilote renouvelle les observations
de confidentialité et SQL si le délai de départ d’un Job est à risque. Il
revérifie les autorisations, l’horloge et les 120 secondes après publication
de la tentative et immédiatement avant le transport. Un refus à cette frontière
conserve la réservation et l’état incertain pour le rapprochement.

Le pilote fournisseur et ses records sont des artefacts
privés de qualification. Une reproduction complète depuis un clone nécessite
ces artefacts et leurs empreintes revues.

Pour les deux cas Windows `normalBrowserCampaign*`, utiliser le poste de
qualification doté du pilote privé `out/m1-2-termination-20261011-01/recette-navigateur.py`
et de ses dépendances revues. Utiliser les variables locales du bloc
ci-dessus avec un nouveau dossier de résultats, la variable
`RITOMER_M12_BROWSER_UI_CONFIG` pointant sur le fragment local
`out/m1-2-termination-20261011-01/BROWSER-UI-CONFIG-78.json`, et le filtre Gradle
`--tests '*SharedOidcBrowserTest.normalBrowserCampaign*'`. La fixture fournit
l'IdP synthétique, les effets Cloud et le stockage local. Le navigateur, Spring
HTTPS, les contrôleurs de contenu et les événements de challenge sont exécutés.
Le reçu final de cette fixture contient les événements d'un seul servlet.

BROWSER_UI mesure le partage dans une révision. La persistance au remplacement
de révision (P5), le refus avant binding (P2) et le refus pour rôle insuffisant
(P3) gardent leurs preuves distinctes. Les verdicts historiques conservent leur date.

## Critères de qualification conservés

La source détaillée reste le [contrat de qualification](../contracts/qualification/shared-session-witness-v1.md).
Cette synthèse ne remplace ni ne réduit ses assertions et les compléments applicables.

| Porte | Résultat à établir sur le périmètre concerné |
|---|---|
| P1 | Réseau, origine HTTPS et callback exacts ; cookies, CSRF et frontières HTTP conservés. |
| P2 | Identités non liées non admises, puis admission après le seul binding autorisé ; absence de création implicite vérifiée. |
| P3 | Identité, tenant et rôles attendus ; A et B dans deux tenants distincts ; refus inter-tenant et droits insuffisants. |
| P4 | Deux `bootId` et deux `instanceId` natifs de la même révision, attribués aux requêtes concernées. |
| P5 | Mêmes pièces et exports relus sur l'autre instance puis après remplacement de révision, sans reconnexion. |
| P6 | Rail JDBC à deux JVM pour la session exacte et le CSRF. Sur Cloud, révocation visible, restauration du binding, nouvelle connexion et accès de B. |
| P7 | Sur Cloud, logout normal, retour anonyme et continuité de B. Le rejeu exact inter-instance Cloud reste non mesuré. |
| P8 | Confidentialité des destinations, journaux, données et stockages vérifiée. |
| P9 | Repos produit, probes désactivées, processus et Jobs cessés, inventaire et état économique conformes au mandat applicable. |

Chaque résultat utilisé pour attribuer une action à une instance est lié à son
propre challenge, événement serveur, statut, révision et instance. Absence, doublon
ou ambiguïté empêche cette attribution. Un refus frontal P1 sans événement
applicatif garde une couche indéterminée et ne constitue pas une preuve P4–P7.
`min2`, un nombre de requêtes, l'effacement du cookie ou l'écran de connexion ne
prouvent pas l'invalidation sur une autre instance. Une cessation réussie ne
transforme pas un scénario refusé ou interrompu en réussite fonctionnelle.

## Conditions techniques et confidentialité

- Conserver Spring Security, les sessions partagées et les protections produit.
  Origine canonique HTTPS, callback OIDC, Host/forwarded, Origin/CSRF et tracking
  COOKIE restent contrôlés ; un diagnostic ne donne aucun droit d'assouplir une garde.
- Conserver le réseau privé, TLS PostgreSQL `verify-full`, la CA et le hostname
  réels exacts, les migrations séparées et les droits runtime sans DDL ni écriture
  de binding ou modification d'audit. Voir le [contrat DB](../contracts/db/shared-oidc-session-v1.md).
- Utiliser le stockage partagé GCS et vérifier ses accès et sa lecture après
  redémarrage et depuis les instances concernées ; `LOCAL_FS` n'est pas admis.
- À l’arrêt, exécuter le prévol `OBSERVE CAMPAIGN_DEPENDENCIES` de la campagne.
  Après sa fermeture vérifiée, convenir du créneau Google. Avant sa première
  mutation, START compare le stock, les capacités et les configurations aux
  références approuvées. Une dérive hors de l’estimation datée et de ses
  réserves suspend l’engagement.
  Le même transport vérifie les droits de START et ACTIVATE, les comptes de service,
  les vues, la confidentialité, le réseau privé et le DNS. Le projet de quota
  Ritomer est transmis aux 13 GET exacts de `ROUTES-ORG-POLICY-NAVIGATEUR-78.json`.
  Les réponses des lectures de disponibilité et des treize contrôles Org Policy
  doivent être complètes dès leur première page. Pour le marqueur, le groupe
  vérifie Run MANUAL/0 et SQL NEVER avant et après la mesure. Dans l’intervalle
  fournisseur configuré, il retrouve l’insertId du témoin synthétique connu sur
  _Default et parcourt jusqu’au bout les deux vues pour un UUID témoin distinct.
  Les deux recherches négatives utilisent les filtres et la pagination du
  canari de campagne. La projection reste limitée aux insertId. Pour la recherche globale du marqueur, parcourir `_Required`
  du plus récent au plus ancien. Lier l’accord existant sur la tolérance de
  24 h au contrat et au pilote de la campagne.
  Pour `_Required`, exiger dans la même requête l’heure d’événement dans
  `[L − 24 h,H + 24 h]` et l’heure d’événement ou de réception dans `[L,H]`.
  Contrôler les bornes consignées dans le reçu. La recherche doit atteindre
  sa dernière page dans les limites de 20 pages et 180 s. `_Default` conserve
  la couverture des réceptions sans limite supplémentaire d’heure d’événement.
  Les lectures de cette vue et celles dédiées aux journaux HTTP gardent
  l’ordre chronologique.
  La présence, l’absence, l’état arrêté et la fermeture du
  groupe conditionnent START. Une erreur ou un résultat incomplet interrompt la
  reprise avant la demande de disponibilité Google. Le contrôle P8 du marqueur
  réellement émis reste obligatoire après activation (voir le contrat de qualification).
  Lier le terminal clos et le reçu de consommation à START. Recueillir ensuite
  la présence de Luis juste avant START et, dans la même réponse, sa disponibilité
  pour le créneau de 60 minutes. Lier ce reçu au prévol fermé, à l’accord et
  aux heures prévues. Le pilote le vérifie avant et après la sonde Chrome.
  Après READY, annoncer à Luis le compte et l’heure limite effective de réponse.
  Une réponse après cinq minutes reste recevable si la fenêtre permet encore
  la suite. Former OPEN sur le READY et la réponse correspondants. La racine
  renouvelle la confidentialité si nécessaire et vérifie la révision avant GO.
  Au signal GO, donner l’adresse et la consigne pour la connexion dans le profil Chrome de cet acteur.
  La transaction personnelle dispose de 300 secondes à partir d’OPEN. Pour une
  campagne configurée avec `limits.verification_seconds = 30`, le pilote réserve
  aussi 30 secondes par acteur pour recevoir la preuve Spring de cette tentative
  et vérifier la session affichée dans le Workbench. La connexion et la fin du
  callback doivent avoir eu lieu avant OPEN + 300 s. Le contrôle technique se
  termine strictement avant OPEN + 330 s, y compris en cas de lecture tardive.
  B attend la vérification de l’identité, du tenant et des droits de A.
  A2 suit la restauration observée dans la limite du bail en cours. En cas
  d’échéance, le conducteur ferme le client et engage la cessation réservée.
- Avant Google, vérifier les sinks projet et hérités, destinations, rétentions,
  exclusions exactes des request logs M12 et canari. Préserver `_Required` et les
  audits administratifs. Un accès refusé ne prouve pas l'absence d'une destination.
- Garder les logs sécurité/session/JDBC/HTTP hors DEBUG/TRACE. Aucun HAR, vidéo,
  état de session exporté, token, query de callback, identité fournisseur ni valeur
  ou empreinte SID/CSRF dans les traces et preuves.
- Upload et image ne contiennent que les octets nécessaires, contrôlés au dernier
  état : pas de preuve privée, environnement, secret, cache ou sortie locale.
  Les images et versions de secrets sont celles liées aux opérations approuvées.
- Les connexions Google restent personnelles, après préparation et signal prévus.
  Un refus fournisseur arrête la voie concernée ; aucune connexion implicite.

## Bornes, cessation et nettoyage

Contrôler l’état technique observé, les secondes Run et Jobs déjà réservées et
la projection datée liée à la décision avant engagement. Cette projection conserve
sa date et son incertitude de facturation.
Le plafond courant et les échéances proviennent du mandat prospectif applicable,
jamais d'un budget historique. Attentes, relances et agents ne remettent pas les
consommations à zéro. Les réserves protégées de repli, d'arrêt économique et de
restitution restent applicables ; ce nettoyage documentaire ne réduit notamment
ni les 330 minutes de repli ni les 30 minutes d'arrêt prévues dans le suivi.

Les contrôles d'expiration, fraîcheur, TTL, consommation, revue distincte et
autorisation applicable restent liés aux objets exacts. Aucun artefact présent
ne s'autorise lui-même.
Un état inconnu ou un délai dépassé appelle le repli applicable, sans rejeu aveugle.

La configuration de campagne peut référencer `job_allocation` par chemin et
SHA-256. Le registre `DIRECT31_JOBS_ALLOCATION` lie son prédécesseur, le record
TIME et la décision owner. Les conditions `Jobs` de cette décision désignent
l'identifiant du registre et le prédécesseur exact, puis les secondes historiques,
le supplément et le cumul. Les pins de configuration couvrent ces objets.
L'admission refuse une diminution des réservations historiques ou un total non
approuvé. Les reçus persistants gardent le registre et les secondes réservées,
y compris après une réponse perdue. Le cas historique sans ce registre conserve
sa limite de 76 500 secondes. Le registre seul ne donne aucune autorisation.

## Reprise de conduite après interruption

Terminer les modifications, tests, modèles de configuration et reviews locaux
avant de fixer l'exécution. Le départ opérationnel exige un principal présent.
Le mécanisme actuel ne fournit pas de réveil automatique à heure fixe. Une attente
dans le runtime du chat ne sert pas de condition pour commencer la préparation.
L'accord fixe une fenêtre d'entrée et les réserves. Après un prévol représentatif
positif et fermé, recueillir la disponibilité personnelle avant START.

Pour la sonde à l’arrêt, le champ `marker_probe_retry_500` exige une décision
liée à la proposition et une configuration OBSERVE de dépendances épinglée.
Le contrôle positif utilise l’identité de l’entrée stdout connue : projet, région,
service, révision, marqueur structuré, identifiant et horodatages fournisseur.
Le pilote valide chaque ligne de la page reçue. Dès que la page confirme
l’identité attendue, il consigne le résultat positif et passe aux recherches
négatives. Chacune doit atteindre sa dernière page sans occurrence.
Les lectures partagent un crédit HTTP 500 à 2 secondes. Seul le contrôle positif
peut utiliser un second crédit à 4 secondes. Un délai indiqué par le fournisseur
ou un diagnostic incomplet impose le report. Le réenvoi conserve la page et
ses paramètres. Les plafonds incluent 20 pages par recherche, 180 secondes
par recherche, 96 envois au total, 600 secondes de travail et 660 de supervision.

À la reprise, relire le suivi puis les chemins de sortie des configurations et
des AUTH concernées. Vérifier les identités de processus et leur résultat natif,
les fichiers `terminal`, `consumed`, les sorties, les intentions et les marqueurs
de tentative. Vérifier leurs empreintes et leur relation avant de former une
commande suivante. Un timeout d'observation ne prouve pas la fin du processus.
Une absence de reçu final ne prouve pas l'absence d'effet fournisseur.

La référence arrêtée de START se choisit dans sa configuration revue. Une
référence `CLOSED_RESOURCE_STOP` lie la source exécutée, la configuration,
l'autorité consommée et les quatre reçus exacts de la cessation précédente.
Le pilote exige leur cohérence, les opérations terminées et les confirmations
Run MANUAL/0 et SQL NEVER. La baseline complète sert à comparer l'état frais ;
la projection METADATA seule ne la remplace pas. Le changement de référence
ne réactive pas l'autorité précédente et ne relâche aucun contrôle de concurrence.

Un prédécesseur clos permet aux opérations REST, RECONCILE et VERIFY_FINAL de
reprendre ses effets, sa cause et ses réservations sous une nouvelle autorité
exacte. Une réponse perdue nécessite de lire l'état de la cible et de rapprocher
l'intention avant toute nouvelle mutation. Conserver les preuves incomplètes.
Le navigateur détenu est fermé par son superviseur ; ACTIVATE tente le repos
produit dans son worker. Le parent OS conserve les délais et publie les reçus
tant qu'il fonctionne. Une disparition forcée peut interrompre ces opérations.

RESOURCE_STOP demeure une invocation distincte, avec cause vérifiée, nouveau
binding et réserve de 1 800 secondes. Ses fichiers et le contrat de cessation
doivent être préparés avant START. La perte du contexte du chat laisse les
résultats sur disque utilisables pour cette reprise. La disparition du parent
OS ou du poste n'est pas couverte par une garantie d'arrêt automatique. La
supervision jusqu'à la cessation est une condition d'admission de la campagne.

Fermer et nettoyer uniquement les ressources détenues et identifiées. Vérifier
identité, propriété et cessation avant retrait ; base et rôle jetables exigent
les identifiants/OID du run. En cas d'ambiguïté, conserver ou mettre en quarantaine.
Aucune suppression globale, adoption par nom, terminaison SQL arbitraire,
restauration fictive ou réouverture publique implicite.

La fermeture du navigateur ne démontre pas l'arrêt des ressources Cloud ni un
coût nul. Vérifier séparément repos produit et arrêt économique. Le dernier état
Cloud historique ne devient pas une observation actuelle par relecture du suivi.

## Suivi et historique

Le suivi courant est `out/m1-2-termination-20261011-01/WORKING-PREFIX-M09-20-34.txt`,
avec les preuves locales FIX74/RACCORD76, le dernier reçu de cessation et la décision applicable.
Les contre-exemples RACCORD73 restent consignés ; ce guide ne les efface pas.
La stratégie générale de tests reste [TESTING_STRATEGY.md](../TESTING_STRATEGY.md).

L'ancienne version intégrale est conservée, octet pour octet, dans
`runbooks/archive/m1-2-shared-nonproduction-avant-nettoyage-20261114.txt`.
Elle est historique : ses commandes, programmes embarqués, horaires, budgets et
autorisations ne sont pas des instructions actives et ne sont pas à recharger
comme prérequis de chaque exécution. Les critères et contrôles actuels ci-dessus
restent obligatoires. Les contrats applicables restent les références pour leurs
domaines respectifs.
