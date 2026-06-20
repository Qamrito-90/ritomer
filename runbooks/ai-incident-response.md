# Runbook IA - incident response

## Statut

Ce runbook prepare l'exploitation IA future. `030d1` et le gate pack draft `042a1` ne livrent aucun provider reel, aucun modele, aucun secret et aucun appel modele.

Le principe permanent reste : le closing et le mapping manuel continuent meme si l'IA est desactivee, lente, indisponible ou invalide.

## Symptomes

- latence IA anormale ;
- hausse des timeouts ;
- provider unavailable ;
- sorties JSON invalides ou hors schema ;
- reponses sans evidence exploitable ;
- suspicion cross-tenant ;
- drift de qualite ;
- cout anormal ;
- suspicion d'exposition de donnees ;
- logs contenant payload, prompt, output ou donnees sensibles.

## Kill switch

Action immediate :

1. Pour un incident provider-runtime futur, desactiver d'abord le kill switch provider-runtime cible `ritomer.ai.mapping-suggestions.provider-runtime.enabled=false` lorsqu'il existe.
2. Si le flag provider-runtime n'existe pas encore ou si l'incident continue, desactiver le flag de capacite existant, par exemple `ritomer.ai.mapping-suggestions.enabled=false`.
3. Verifier qu'aucune construction de prompt/request provider n'est emise quand le flag concerne est off.
4. Confirmer zero appel reseau provider, zero cout provider et zero log provider apres coupure.
5. Servir le fallback no-provider si la capacite de suggestions reste activee sans provider.
6. Laisser le mapping manuel disponible dans tous les cas.
7. Notifier le owner IA et le owner security/privacy si l'incident touche des donnees sensibles.

Le flag provider-runtime est une cible `042b` et ne doit pas etre declare verifie avant son implementation effective.

## Provider outage

Etat attendu : `UNAVAILABLE`.

Actions :

1. Confirmer que l'indisponibilite vient du provider, du reseau ou d'un rate limit.
2. Ne pas retry sans borne ; appliquer timeout, backoff et limite de cout.
3. Servir un etat degrade sans suggestion fiable.
4. Basculer vers no-provider si ce mode est disponible et autorise.
5. Garder le mapping manuel intact.
6. Suivre la page incident provider seulement depuis des sources autorisees, sans partager de donnees client.

## Timeout

Etat attendu : `TIMEOUT`.

Actions :

1. Verifier les latences p50/p95 agregees.
2. Confirmer que la requete a ete abandonnee sans suggestion partielle exposee.
3. Si les timeouts depassent le seuil pilote, activer le kill switch.
4. Revenir au no-provider puis au mapping manuel si le no-provider ne peut pas produire une suggestion valide.
5. Ouvrir un suivi de capacite ou de budget latence avant reactivation.

## Invalid schema / output

Etat attendu : `INVALID_MODEL_OUTPUT`.

Actions :

1. Rejeter fail-closed toute sortie non JSON strict, markdown, texte libre ou hors schema.
2. Ne pas tenter de reparer un output depuis du texte libre.
3. Verifier `schemaVersion`, schema hash, `promptVersion` et model exact ID.
4. Comparer avec le dernier golden set approuve (`030c`, puis `042a2` lorsqu'il existera).
5. Rollback prompt/schema/model si le changement recent est suspect.
6. Ne journaliser ni output brut, ni payload complet, ni snippets evidence sensibles.

## No evidence

Etat attendu : `INSUFFICIENT_EVIDENCE`.

Actions :

1. Rejeter toute suggestion sans `evidence[]` non vide.
2. Ne pas exposer la suggestion comme fiable.
3. Verifier que les evidence refs sont tenant-scopees, minimales et non sensibles.
4. Revenir au mapping manuel.

## Cross-tenant suspicion

Actions immediates :

1. Activer le kill switch provider-runtime si le flux peut encore appeler un provider.
2. Ne pas rejouer la requete et ne pas copier le payload, le prompt ou l'output brut dans l'incident.
3. Preserver seulement les metadonnees minimales : state final, versions, schema hash, provider logique local, compte d'evenements et raison normalisee.
4. Verifier tenant, RBAC, closing folder, latest import et evidence refs avant toute reactivation.
5. Escalader au owner security/privacy, au CPO et au CTO.
6. Garder le mapping manuel disponible.

## Data exposure

Actions immediates :

1. Activer le kill switch.
2. Preserver les traces minimales necessaires a l'enquete sans copier payload, prompt, output brut, montant, label sensible ou evidence sensible.
3. Identifier le perimetre avec des metadonnees minimales : periode, provider logique local, versions, schema hash, champs exposes et volumes agreges.
4. Escalader au owner security/privacy et au CPO.
5. Declencher le processus incident provider si un fournisseur externe est implique.
6. Demander deletion provider selon le readiness record signe.
7. Documenter la cause et les mesures de prevention avant reactivation.

## Sensitive logs

Sont critiques en logs : prompt brut, output brut, payload complet, account labels en clair, montants en clair, snippets evidence en clair, tenant/client identifiers non minimises, secrets, tokens, credentials, cookies, DSN, valeurs `.env`, storage keys, signed URLs et chemins prives.

Actions :

1. Activer le kill switch si le flux IA peut continuer a produire ces logs.
2. Restreindre l'acces aux logs concernes.
3. Ouvrir une purge ou retention exception selon la politique de logs.
4. Corriger la redaction avant toute reactivation.
5. Verifier qu'aucun support bundle ne contient les donnees interdites.

## Cost spike

Actions :

1. Comparer le cout estime agrege au seuil pilote.
2. Identifier volume de comptes envoyes, retry, timeouts, rate limits et provider logique.
3. Activer le kill switch si le seuil est depasse ou non explique.
4. Verifier que les logs ne contiennent aucun payload, prompt, output, label, montant ou identifiant metier.
5. Reprendre seulement apres validation du budget, du rate limit et du timeout.

## Rollback model / prompt / schema

Rollback autorise uniquement vers une combinaison deja approuvee :

- prompt file path exact ;
- `promptVersion` exact ;
- `schemaVersion` exact ;
- schema hash exact ;
- model exact ID ;
- provider logical name.

Actions :

1. Couper le flag avant rollback si la qualite ou la securite est en doute.
2. Restaurer la derniere combinaison approuvee.
3. Rejouer les evals `030c`.
4. Verifier logs/metrics sans donnees sensibles.
5. Reactiver progressivement seulement apres accord owner IA et security/privacy si l'incident touchait des donnees sensibles.

## Escalation owner

- Incident qualite IA : owner IA.
- Incident privacy ou exposition de donnees : owner security/privacy + CPO.
- Incident cout ou latence : owner IA + owner plateforme.
- Incident provider externe : owner IA + owner security/privacy + contact provider documente.
- Incident pouvant bloquer le closing pilote : CPO + CTO.

Si le owner n'est pas determine, escalader au CTO et garder le kill switch actif.
