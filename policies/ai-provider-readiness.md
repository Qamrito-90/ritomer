# AI Provider Readiness Policy - 030d0

## Objectif et statut

`030d0` est un livrable de preparation provider IA, docs/config only, sans runtime.

Il conditionne toute activation future de provider IA pour le mapping assiste. Il formalise les exigences privacy, securite, gouvernance IA, dependance, pinning, logs, metrics, cout, latence, fallback et gates avant `030d`.

`030d0` ne livre aucun provider reel, aucun modele, aucun appel modele, aucun SDK, aucun secret, aucune valeur de configuration sensible et aucune activation runtime.

## Decision actuelle

- Provider reel : non approuve a ce stade.
- Provider candidat : `NON DETERMINE`. Un provider peut etre documente plus tard comme `CANDIDAT`, jamais comme approuve tant que les gates de cette policy ne sont pas passes.
- Modele candidat : `NON DETERMINE`. `030d` devra renseigner un identifiant exact de modele provider, sans alias auto-upgrade et sans resolution automatique vers une version plus recente.
- Region de traitement : obligatoire a documenter avant activation ; `NON DETERMINE` pour `030d0`.
- Retention provider : obligatoire a documenter avant activation ; `NON DETERMINE` pour `030d0`.
- Training / non-training des donnees : obligation de non-training ou option contractuelle equivalente a documenter avant activation ; `NON DETERMINE` pour `030d0`.
- Logging provider : obligatoire a documenter avant activation, incluant contenu loggue, duree, acces support et opt-out ; `NON DETERMINE` pour `030d0`.
- Sous-traitants, DPA, SCC, deletion et incident process : obligatoires a documenter avant activation ; `NON DETERMINE` pour `030d0`.

Aucune equipe ne peut traiter ces champs `NON DETERMINE` comme une approbation implicite.

## Provider readiness record obligatoire

Avant tout passage a `030d runtime`, le provider candidat doit avoir un record de readiness signe contenant :

- nom du provider logique et nom legal du fournisseur ;
- statut `CANDIDAT` ou `APPROUVE`, avec date et approbateurs ;
- region(s) de traitement et region(s) de stockage ;
- retention exacte des prompts, payloads, outputs, logs et traces provider ;
- politique training / non-training des donnees client et metadonnees ;
- logging provider exact, y compris acces support, sampling, debug logs et duree ;
- liste des sous-traitants, DPA, SCC ou mecanisme de transfert equivalent ;
- processus de deletion, delai de suppression et preuve attendue ;
- processus d'incident provider et delai de notification ;
- chiffrement en transit et au repos ;
- contacts escalation security/privacy/provider ;
- limites de cout, latence et rate limit retenues pour le pilote.

## Payload whitelist

Seuls les champs ci-dessous sont autorisables pour un appel provider futur, et uniquement si la minimisation decrite est appliquee.

| Champ | Source | Transformation / minimisation | Envoye au provider | Loggable | Justification |
| --- | --- | --- | --- | --- | --- |
| `accountCode` | derniere balance importee tenant-scopee | normaliser comme code de compte, longueur bornee | oui | non | cle metier necessaire pour produire une suggestion sur la ligne cible |
| `accountLabel` sanitise | derniere balance importee tenant-scopee | retirer noms, emails, identifiants client inutiles, normaliser espaces, tronquer | oui | non | signal principal de mapping, seulement sous forme minimisee |
| signal debit/credit minimise ou derive | derniere balance importee tenant-scopee | envoyer uniquement direction, signe, bucket ou indicateur derive ; jamais montant brut si non necessaire | oui | non | aide a distinguer actif, passif, produit ou charge sans exposer le montant |
| `latestImportVersion` | import courant autorise | version seulement, sans contenu CSV | oui | oui | ancrage anti-stale et reproductibilite |
| `taxonomyVersion` | referentiel de mapping publie | version seulement | oui | oui | ancrage de la cible selectable |
| target `code` | targets selectable non deprecated | filtrer selectable = true et deprecated = false | oui | oui | code cible candidat a selectionner |
| target `label` | targets selectable non deprecated | label public du referentiel, sans enrichissement client | oui | oui | libelle necessaire a la selection humaine et modele |
| target `statement` | targets selectable non deprecated | enum ou valeur publiee du referentiel | oui | oui | contexte de classement |
| target `bucket` / `section` | targets selectable non deprecated | envoyer uniquement bucket/section publies | oui | oui | contexte de granularite comptable |
| target `normalSide` | targets selectable non deprecated | valeur publiee du referentiel | oui | oui | signal debit/credit attendu |
| target `granularity` | targets selectable non deprecated | valeur publiee du referentiel | oui | oui | evite une cible trop large ou non selectable |
| evidence refs minimales non sensibles | sources tenant-scopees autorisees | refs courtes, typees, sans extrait sensible et sans chemin prive | oui | non | preuve exploitable par revue humaine sans exposer le document brut |
| `schemaVersion` | contrat IA versionne | valeur exacte, par exemple `mapping-suggestion-v1` | oui | oui | validation stricte et reproductibilite |
| `promptVersion` | prompt futur versionne | valeur exacte approuvee | oui | oui | audit de prompt pinning |
| model exact ID | provider readiness record futur | identifiant exact, sans alias | oui | oui | model pinning et cout/latence |
| request / trace id technique | observabilite applicative | id technique sans tenant/client en clair | non | oui | correlation interne sans fuite provider |
| tenant, client, actor identifiers | contexte applicatif | ne pas envoyer ; utiliser seulement pour auth/RBAC/scoping avant appel | non | non | separation tenant et minimisation |
| raw amounts | balance importee | preferer signal derive ; ne pas logger | non par defaut | non | limiter exposition de donnees financieres |
| prompt complet et payload complet | orchestration IA | jamais whiteliste comme contenu loggable | non applicable | non | evite fuite de donnees sensibles |

## Donnees interdites

Sont interdites dans tout prompt provider, payload provider, log provider, log applicatif detaille, trace detaillee, fixture d'eval ou support bundle :

- secrets, tokens, credentials, cookies, DSN et valeurs `.env` ;
- storage keys, signed URLs, chemins prives et identifiants d'object storage ;
- raw CSV complet ;
- documents ou binaires ;
- workpapers complets ;
- audit brut ;
- donnees cross-tenant ;
- user IDs, emails ou noms si non necessaires ;
- tenant names ou client names si non necessaires ;
- prompt brut en logs ;
- output brut en logs ;
- payload complet en logs ;
- account labels en clair dans les logs ;
- montants en clair dans les logs ;
- snippets evidence en clair dans les logs ;
- tenant/client identifiers non minimises ;
- toute donnee non validee, stale ou non autorisee par le backend.

## Strategie dependance

La strategie par defaut pour `030d` est :

- privilegier `RestClient` ou un client HTTP controle par l'application ;
- interdire tout SDK provider avant dependency/security review ;
- interdire toute librairie runtime JSON Schema avant dependency/security review ;
- n'ajouter aucune dependance pour contourner une validation ou un gate ;
- conserver les appels provider derriere un port applicatif testable et desactive par defaut.

Toute review de dependance doit couvrir :

- licence ;
- CVE connues et politique de correction ;
- maintenance, cadence de release et bus factor ;
- dependances transitives ;
- comportement de logging ;
- retry, timeout, backoff et idempotence ;
- telemetry, analytics, phone-home ou debug upload ;
- taille, bloat et impact cold start ;
- compatibilite avec Cloud Run et le no-Docker local.

## Prompt, schema et model pinning

Toute activation `030d` doit pinner explicitement :

- prompt file path futur : `prompts/mapping/mapping-suggestion-system-v1.md` ou chemin dedie approuve avant runtime ;
- prompt version : valeur exacte, versionnee et immutable pour le run ;
- schemaVersion : `mapping-suggestion-v1` ou version contractuelle approuvee ;
- schema hash : hash du schema contractuel exact utilise au runtime ;
- model exact ID : identifiant provider exact et date/version si le provider l'expose ;
- provider logical name : nom logique stable, distinct du nom commercial si necessaire.

Les alias auto-upgrade, familles de modeles generiques, valeurs `latest`, resolutions implicites vers une version plus recente et upgrades silencieux sont interdits.

## Feature flag off

Le flag backend dedie doit rester desactive par defaut, par exemple `ritomer.ai.mapping-suggestions.enabled=false`.

Quand le flag est off :

- aucune construction de prompt ;
- aucune construction de request provider ;
- zero appel reseau provider ;
- zero cout provider ;
- zero log provider ;
- aucun output modele attendu ;
- le mapping manuel reste intact et utilisable.

Un test runtime futur devra prouver ce comportement fail-closed avant toute activation.

## Validation de sortie modele

Si un provider est active plus tard, toute sortie modele doit etre validee fail-closed :

- JSON strict uniquement ;
- aucune recuperation depuis markdown, prose, bloc code ou texte libre ;
- JSON Schema complet obligatoire ;
- `additionalProperties=false` ;
- `requiresHumanReview=true` obligatoire ;
- `evidence[]` non vide ;
- `confidence` bornee entre `0` et `1` ;
- `riskLevel` enum strict ;
- target connu, selectable et non deprecated ;
- compte present dans le dernier import ;
- `latestImportVersion` et `taxonomyVersion` coherents ;
- rejet si le tenant, le closing folder, l'import ou le RBAC ne correspondent pas ;
- aucun mapping applique sans decision humaine explicite.

Toute violation produit `INVALID_MODEL_OUTPUT` ou l'etat plus precis documente, sans suggestion fiable exposee.

## Fallback

Les etats de degradation obligatoires sont :

- timeout provider => `TIMEOUT` ;
- provider unavailable => `UNAVAILABLE` ;
- JSON invalide ou hors schema => `INVALID_MODEL_OUTPUT` ;
- evidence absente ou insuffisante => `INSUFFICIENT_EVIDENCE` ;
- feature flag off => `DISABLED` ;
- aucun import courant => `NO_IMPORT`.

Dans tous les cas :

- le mapping manuel reste intact ;
- aucune suggestion partielle non validee n'est exposee comme fiable ;
- aucune ecriture automatique n'est faite ;
- les erreurs provider ne bloquent pas le closing.

## Logs et metrics autorises

Sont autorises, sous forme structuree et minimisee :

- request id / trace id ;
- state final ;
- provider logique ;
- `schemaVersion`, `promptVersion`, schema hash et model exact ID ;
- latence agregee, p50/p95 et timeout count ;
- nombre de comptes envoyes ;
- nombre de suggestions valides ;
- nombre d'outputs rejetes ;
- raison de rejet normalisee ;
- cout estime agrege ;
- taux de fallback ;
- taux accept/reject/correct apres decision humaine, agrege et tenant-safe.

## Logs interdits

Sont interdits :

- prompt brut ;
- output brut ;
- payload complet ;
- account labels en clair ;
- montants en clair ;
- snippets evidence en clair ;
- tenant/client identifiers non minimises ;
- secrets, tokens, credentials, cookies, DSN et valeurs `.env` ;
- storage keys, signed URLs et chemins prives ;
- donnees cross-tenant ;
- documents, CSV brut et workpapers complets.

## Cout et latence

Avant activation provider, le record de readiness doit fixer :

- timeout par appel ;
- budget latence p50/p95 pour le pilote ;
- cout maximal par generation ou par lot ;
- limite de comptes par request ;
- strategie de rate limit et backoff ;
- seuil de cost spike et action de kill switch ;
- mode de calcul du cout estime agrege, sans log de payload.

Un cost spike doit pouvoir etre traite sans redeployer : couper le flag, revenir au mapping manuel et escalader au owner.

## Gates pour passer a 030d runtime

`030d runtime` reste bloque tant que tous les gates suivants ne sont pas passes :

- CPO approval ;
- CTO Gate ;
- security/privacy review ;
- dependency review si une dependance est ajoutee ;
- IA governance review ;
- golden set 030c vert ;
- payload whitelist signee ;
- provider readiness record complet et signe ;
- runbook IA pret ;
- feature flag policy validee ;
- region, retention, training/non-training, logging provider, DPA/SCC, deletion et incident process documentes ;
- tests futurs de flag off prouvant zero prompt, zero request, zero reseau, zero cout et zero log provider.

Sans ces gates, le provider reste candidat ou non determine, jamais approuve.
