# Qualification des sessions partagées M1.2

## Répartition des preuves pour M1.2/047

Le rail PostgreSQL à deux JVM exerce les cookies et CSRF synthétiques exacts. Il
vérifie la révocation, le refus après restauration et reconnexion, le rejet du
CSRF précédent, le logout puis le refus inter-JVM, et la continuité de B.
L'applicabilité dépend des sources produit et du témoin effectivement exécutés.

Dans le mode de qualification `BROWSER_UI`, Luis effectue trois connexions
Google ordinaires (A, B, A reconnecté) sur invitation READY/OPEN/GO. Chaque
contexte Chromium gère ses propres cookies. Les libellés ORIGINAL/REPLACEMENT
identifient le contexte d'observation. Le reçu conserve uniquement la phase,
l'acteur, ce libellé, l'opération, le départ et la fin UTC, le statut, le numéro
de séquence et le challenge. Les réponses d'identité sont validées dans la page.

Après GO, chaque acteur dispose de son propre profil temporaire dans Google Chrome
standard. Luis ouvre Ritomer dans la fenêtre de campagne puis suit le lien
normal de connexion Google. L’onglet Google est isolé de la fenêtre témoin.
Le pilote attend les événements Spring de la transaction sur la révision et
dans la fenêtre approuvées. Il demande alors au Workbench de relire la session.
Le texte visible « Session connectée » et le GET de `/api/me` doivent confirmer
l’utilisateur, l’unique appartenance, le tenant actif et les rôles exacts.
Ces deux preuves conditionnent le passage de A à B puis à A reconnecté.

Seule la révision de qualification reçoit les trois empreintes d’invitation
à usage de cette campagne. Chaque empreinte lie l’acteur, son invitation et
ses contrôles de lecture. Le témoin vérifie aussi l’origine et la fenêtre
appelantes, la révision, le délai et la phase. Les réponses, cookies et
valeurs CSRF restent dans le profil. Le reçu conserve le dernier jalon et
la condition attendue. Le repos retire les empreintes de la configuration.

| Étape | Observation sur le service déployé |
| --- | --- |
| Connexions A/B | Identité, tenant actif et rôles exacts. Chaque compte relit les pièces et exports attendus et se voit refuser les objets de l'autre tenant. |
| Partage | Pour chaque contexte authentifié A et B, attribuer ME, pièce et export à deux couples distincts de boot et instance sur la même révision, sans nouvelle connexion. |
| Révocation | Après confirmation du binding, la page A reçoit 403 ACCESS_REVOKED. B conserve ses accès. |
| Restauration | Avant la nouvelle connexion, la page A reçoit 401 AUTHENTICATION_REQUIRED. L'invalidation de la valeur exacte de la session est établie par le rail local. |
| Reconnexion | A est de nouveau admis, dans le tenant prévu avec les rôles attendus. A et B relisent leurs fichiers. |
| Logout | Le bouton de déconnexion déclenche le POST protégé (204, no-store). Le lien de connexion réapparaît, la page reçoit 401 et B conserve ses accès. |

La recette Cloud ne mesure pas directement le rejeu du cookie exact après logout
sur une autre instance. L'écran anonyme, le nombre d'instances configurées et
les résultats historiques P6/P7 ne peuvent valider cette assertion.

La transaction OIDC expire après 300 s. Les sessions gardent 30 minutes
d’inactivité et une limite absolue de 8 h. Le contrôle SQL reste frais 300 s,
la confidentialité 30 minutes et la connexion personnelle 300 s après OPEN. Dans une
campagne qui le prévoit, le pilote dispose ensuite de 30 s au maximum pour lire
les événements de cette tentative et vérifier le Workbench déjà ouvert. GO, le
clic Google et les événements Spring, y compris la fin du callback, doivent tous
précéder la fin des 300 s. Les deux horloges bornent la vérification à OPEN + 330 s.
La vérification complète de l’identité, de l’entreprise et des droits reste requise
avant l’acteur suivant. Le passage à deux instances dure au maximum 15 minutes. Luis confirme sa présence juste
avant START après le prévol fermé. À READY, le pilote calcule la dernière heure
d’ouverture compatible avec le créneau, l’observateur, le budget Run, le temps
nominal et le repli réservé. Il garde respectivement 45, 30 et 5 minutes pour
la suite personnelle en A, B et A reconnecté. Pour cette dernière admission, le
bail réel des deux instances et sa marge de 30 secondes bornent aussi la réponse.
Le temps mural et le temps monotone bornent l’attente. Les contrôles de
confidentialité sont renouvelés au besoin avant GO. Une vérification technique sur la révision
du canari précède READY A. Après les lectures fournisseur de confidentialité et de révision,
les deux GET préparatoires au plus et leur temporisation disposent ensemble de 65 s. Ils sont espacés d’au moins 2 s
si le premier échoue sans réponse HTTP ni premier octet. Les admissions conservent leur propre
401 complet et leur marqueur observé après OPEN. Chaque transfert anonyme dispose de 30 s
au total, fermeture comprise. Le départ doit laisser 31 s et la réponse précéder la borne.
Ces limites réservent le temps d’admission et de repli. Elles ne définissent pas une latence produit. Les contrôles distincts
de confidentialité, de cessation et de stabilité des journaux gardent leurs
observations espacées. Une échéance ou un échantillon insuffisant laisse la
preuve ouverte.

Le conducteur lit le calendrier référencé par la configuration, l’approbation
owner et les pièces liées à l’autorisation. Le SHA-256 littéral de cette
autorisation provient de la commande approuvée indépendamment. Un recalage
renouvelle les données et les pièces concernées. Les reçus de consommation
et les dates d’expiration restent applicables.

Le prévol vérifie Run et SQL à l’arrêt avant la contre-épreuve et à sa fermeture.
Sur le projet Ritomer, il vérifie le droit de consommer le quota, la lecture du
projet et les permissions demandées. Sur l’organisation de rattachement, le POST
Resource Manager demande exactement `logging.sinks.list`, `logging.buckets.get`
et `orgpolicy.customConstraints.list`. Les requêtes préparées par le SDK
utilisent le même projet de quota pour ces lectures, les lectures Logging des
vues, sinks, buckets et exclusions concernés, et les treize lectures Org Policy
approuvées. Les pages suivantes conservent cette attribution. Le reçu distingue
le projet demandé par le client du consommateur éventuellement indiqué par Google.

Pour un Job de qualification, la première utilisation des accès techniques doit
intervenir avant 120 secondes depuis le début des observations de confidentialité.
Le repli conserve ce délai jusque dans le dernier contrôle avant transport.

Le registre Jobs référencé par `job_allocation` est épinglé dans la configuration.
Son prédécesseur, son cumul, son supplément et les réservations historiques
doivent correspondre à la décision owner du même record temporel. L'admission,
chaque réservation de tâche et la reprise après interruption appliquent ce cumul.
Une tentative sans réponse conserve sa réservation. Une provision approuvée
n'autorise aucun effet hors de la commande et de sa fenêtre propres.

## Confidentialité du canari dans Cloud Logging

Avant Google, le pilote émet un marqueur synthétique neuf dans la requête de
canari. Il cherche cette valeur dans tous les champs, ressources et journaux
des vues projet `_Default/_AllLogs` et `_Required/_AllLogs`. Le contrôle
distinct des journaux HTTP de la révision activée reste en place.

Les heures natives de l’événement et de sa réception par Logging, pour le
challenge positif et les étapes corrélées du canari, bornent la recherche.
Le premier ensemble complet doit être observé dans les 300 secondes monotones
suivant la création du marqueur. Son étendue temporelle maximale est de 300 s.
La borne basse précède le premier de ces horodatages de 360 s ; la borne haute
suit le dernier de 1 860 s. Ces marges couvrent respectivement l’acquisition,
la durée maximale de 1 800 s de l’observation et une minute supplémentaire
de désaccord entre horloges dans chaque sens. Cet intervalle inclusif est
noté `[L,H]`. L’heure civile du poste ne détermine aucune des deux bornes.

Le critère approuvé pour B11 couvre, dans les deux vues, toute entrée dont
l’heure d’événement ou l’heure de réception appartient à `[L,H]`.
Le périmètre suivant exige une décision prospective explicite avant son
premier emploi. L’absence d’accord maintient la campagne à l’arrêt.

- Dans `_Default`, chercher le marqueur dès que l’heure d’événement ou de
  réception appartient à `[L,H]`.
- Dans `_Required`, appliquer le même prédicat et exiger aussi que l’heure
  d’événement appartienne à `[L − 24 h,H + 24 h]`, bornes incluses. Une copie
  antidatée d’un jour et reçue dans l’intervalle reste couverte. Une entrée
  dont l’heure d’événement appartient à `[L,H]` est couverte quelle que soit
  son heure de réception, si elle est visible lors d’un des deux passages.
- Une copie reçue dans `[L,H]` dont l’heure d’événement est antérieure à
  `L − 24 h` ou postérieure à `H + 24 h` sort du périmètre de `_Required`.
  Les 24 h sont une tolérance de qualification choisie pour conserver le
  scénario de copie antidatée testé. Le service ne garantit pas cet écart.

Les recherches négatives du prévol et du canari utilisent le même filtre par vue.
Le témoin positif du prévol est une preuve d’existence. La requête cible son
journal stdout, sa révision, son champ challenge, son insertId et ses deux
horodatages. Une page entièrement validée suffit pour constater sa présence.
Les contrôles négatifs doivent parcourir toutes leurs pages. Les reçus finaux
indiquent les deux bornes d’heure d’événement appliquées à `_Required`.

Le succès exige deux parcours complets de chaque vue, espacés d’au moins 60 s,
sur le même intervalle, avec des preuves positives stables. Une page vide avec
une continuation exige la page suivante. Une occurrence du marqueur, y compris
sur une page intermédiaire, provoque le refus. Une réponse partielle, un cycle,
une limite de 20 pages, de temps ou d’appels atteinte avant la fin laissent la
preuve incomplète. Le résultat vaut pour les entrées visibles aux observations.
Il ne couvre ni tout l’historique ni une indexation après le dernier passage.

## Contrôles du navigateur et du collecteur

Le navigateur normal conserve TLS, les contrôles d'origine, les cookies sécurisés
et le CSRF du produit. Aucune valeur de session ne quitte le navigateur. Les
accès sont limités à l'origine Ritomer et aux origines Google approuvées pour
l'admission. Seuls les identifiants des fixtures prévues sont utilisés. Le
contrôle des contenus vérifie taille, SHA-256 et cache privé/no-store. La photo
du fournisseur vérifie les objets GCS correspondants.

Les contrôles actifs sont liés au mode BROWSER_UI dans l'autorisation de collecte
et le reçu du producteur. Le collecteur relie chaque challenge à une seule entrée
de la bonne révision, du bon projet et du bon service, au même statut et dans
la fenêtre prévue. Il relit la preuve après 60 secondes et vérifie la
confidentialité. Au plus quatre tours de lecture BEFORE recherchent les
attributions manquantes. Une instance unique permet la cessation et la conservation
des observations mais laisse le partage multi-instance non démontré. Aucun logout,
binding, ni login n'est répété pour produire un échantillon.

Les anciens modes P5/P6 et leurs exigences de corrélation restent réservés à leurs
reçus historiques. Les compléments P1/P8/P9 de plan31, les réserves de repli,
l'acceptation indépendante et les vérifications finales restent applicables.

## Reprise bornée et cessation

`reset-ab` invalide exclusivement les bindings Google A/B exacts et leurs
sessions authentifiées après photo préalable et préservation des preuves.
Acteurs, tenants, audits et objets métier ne sont jamais supprimés. Les deux
memberships identifiés sont seulement restaurés ACTIVE. Les sujets restent des
données privées du processus ; les générations et sujets attendus doivent
correspondre exactement avant mutation. Une troisième identité ou un contexte
ambigu provoque un rollback. Un verrou transactionnel borné empêche une création
concurrente entre la sélection, les suppressions exactes et le readback zéro.
Les sessions anonymes et transactions d'autorisation ne sont pas supprimées.

Après une association partielle A seulement, la même recette accepte uniquement
`RESET_BINDING_B=ABSENT`, avec le binding A exact et les deux sujets vérifiés
distincts. Sous les mêmes verrous, elle prouve l'absence de tout binding B et
son membership unique ACTIVE. Elle ne crée ni ne modifie de binding ou membership
B. Un faux ABSENT, une génération A périmée ou une identité tierce arrête la
transaction ; les suppressions déjà tentées sont annulées par rollback.

Le retour au repos vérifie les seules exécutions détenues terminées, le template
Job neutre, le service min0/max2, les probes/observations retirées, l'absence de
trafic/tag/min sur anciennes révisions et le retrait des droits migrator/build.
L'extinction physique des instances reste distincte de cette preuve de
configuration. SQL et stockage continuent leur période déjà provisionnée.
