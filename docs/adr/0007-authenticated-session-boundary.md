# ADR 0007 — Frontière de session authentifiée process-local

## Statut

Accepté.

## Contexte

Le backend possédait déjà une identité authentifiée, une résolution de tenant et
une vérification d'autorité fraîche pour les requêtes bearer. M1.1B doit ajouter
le kernel de session nécessaire au futur BFF navigateur sans ouvrir le périmètre
OIDC, sans dépendance de session distribuée et sans modifier les données
d'authentification.

La première utilisation est un adaptateur de connexion réservé au développement
local et aux tests. Cet adaptateur doit exercer la même frontière de session que
le futur adaptateur OIDC, tout en restant absent d'une topologie partagée ou de
production. Les alias d'acteur locaux servent uniquement au transport : ils ne
sont ni des identifiants métier ni une nouvelle source d'autorité.

## Décision

### Kernel de session

- La session est une session HTTP opaque, stockée dans le processus backend. Le
  navigateur ne reçoit jamais l'identité, les rôles ou les appartenances dans le
  cookie.
- Le cookie porte exactement le nom `__Host-ritomer-session` et les attributs
  `Secure`, `HttpOnly`, `Path=/` et `SameSite=Lax`, sans `Domain`.
- Le suivi de session utilise uniquement le cookie. Les identifiants de session
  dans l'URL sont interdits.
- Le délai d'inactivité est de 30 minutes et la durée absolue de huit heures. Une
  expiration invalide la session côté serveur et expire le cookie.
- Les réponses de `/api/session/*` et `/api/me` portent `Cache-Control: no-store`.
- Le firewall HTTP strict reste actif. Une requête rejetée est rendue sous la
  forme d'erreur contractuelle `{code, message}` et ne traverse pas la chaîne
  applicative.

### Activation et confinement

- Le kernel est désactivé par défaut. La propriété de session l'instancie, mais
  sa capacité locale n'autorise une requête qu'avec un seul profil actif,
  exactement `local`, `test` ou `dbtest`.
- L'adaptateur de connexion locale n'est enregistré qu'avec la propriété de
  session et au moins un de ces profils. Sans profil admis, les routes sont
  absentes ; avec une combinaison de profils ou une topologie refusée, la
  frontière répond `403 ACCESS_DENIED` avant le contrôleur.
- Une requête vers `/api/session/*` est acceptée seulement sur la topologie
  locale attendue : adresse d'écoute loopback, adresse distante loopback, hôte
  local et port attendus. Les headers `Forwarded` et `X-Forwarded-*` sont refusés.
- La présence d'un marqueur connu d'environnement cloud ou partagé fait refuser
  toute requête à la capacité locale avec `403 ACCESS_DENIED`. Le confinement
  ne repose donc pas sur le seul nom de profil.

### Bootstrap, authentification et fermeture

- `GET /api/session/bootstrap` est anonyme. Il établit si nécessaire une session
  anonyme et un jeton CSRF, puis retourne un état minimal. Les options locales
  contiennent seulement un `actorKey` et un `displayLabel`, et seulement tant que
  la session est anonyme.
- Les valeurs et le nombre de ces alias ne font pas partie du contrat durable.
  Leur résolution effectue uniquement des lectures sur les utilisateurs et
  appartenances déjà présents. Elle n'insère, ne provisionne et ne modifie aucun
  enregistrement d'authentification.
- `POST /api/session/local` exige ensemble le cookie de session anonyme et le
  jeton CSRF courant. Après une résolution valide, le SID et le jeton CSRF sont
  renouvelés, puis le `SecurityContext` est sauvegardé explicitement. Une session
  déjà authentifiée n'est pas remplacée silencieusement.
- `POST /api/session/logout` exige ensemble le cookie authentifié et le jeton
  CSRF courant. Le mécanisme de logout Spring invalide la session, efface le
  contexte et expire le cookie ; la réponse réussie est un `204` sans corps.

### Autorité et coexistence bearer

- `/api/me` accepte soit le cookie de session, soit le bearer backend historique.
  Les deux présentés ensemble sont rejetés comme credentials ambigus.
- Un bearer est refusé sur toute route `/api/session/*`. Le support bearer reste
  conditionnel à la configuration HMAC existante et ne devient pas un mécanisme
  d'authentification navigateur.
- Le principal de session ne constitue pas une photographie durable de
  l'autorité. À chaque requête protégée, l'identité active, les appartenances
  tenant et les rôles effectifs sont relus depuis PostgreSQL. Une révocation
  invalide immédiatement la session.
- `X-Tenant-Id` sélectionne uniquement une appartenance active déjà autorisée.
  Il ne permet jamais de franchir une frontière tenant et n'est pas accepté sur
  les routes de session.

### Ordonnancement et enregistrement

La chaîne conserve un ordre déterministe : restauration du contexte, détection
des credentials ambigus, contrôle d'expiration, confinement local, résolution du
tenant, relecture d'autorité, CSRF, logout, bearer conditionnel, puis
autorisation. Les cinq filtres propres au kernel sont enregistrés une seule fois
dans la chaîne Spring Security ; leur enregistrement servlet automatique est
explicitement désactivé afin d'éviter une seconde exécution hors chaîne.

Le contrat HTTP durable est
[`contracts/openapi/auth-session-api.yaml`](../../contracts/openapi/auth-session-api.yaml).

## Conséquences

- Un redémarrage du processus invalide les sessions. Le multi-instance et le
  stockage distribué ne sont pas supportés par cette décision.
- M1.1B ne livre aucune intégration frontend ou navigateur, aucun OIDC, aucun
  provisioning, aucune migration, aucune nouvelle dépendance et aucune écriture
  dans les tables d'authentification.
- L'adaptateur OIDC et le déploiement partagé relèvent de M1.2. Ils pourront
  réutiliser le kernel seulement après une décision explicite sur le stockage de
  session, la topologie proxy et la politique d'origine.
- La liste locale d'acteurs demeure une donnée de fixture/configuration et non
  une vérité contractuelle. La base reste l'unique source d'autorité.
- Une erreur de sécurité est volontairement stable et minimale : un `code` et un
  `message`, sans secret, SID, cookie, token, détail de principal ou information
  facilitant l'énumération cross-tenant.

## Alternatives écartées

### JWT navigateur sans état

Écarté pour M1.1B : il exposerait davantage le navigateur aux tokens, compliquerait
la révocation fraîche et créerait une seconde frontière d'autorité.

### Session distribuée dès maintenant

Écartée : aucun besoin multi-instance n'est livré dans cette étape. L'ajouter
introduirait une dépendance et une exploitation non nécessaires au kernel local.

### Comptes locaux dédiés ou provisioning automatique

Écartés : ils créeraient une seconde source d'identité et des écritures hors du
workflow d'administration existant. L'adaptateur local doit seulement résoudre
des données déjà seedées.
