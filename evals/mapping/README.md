# Evals mapping

## But
Mesurer la qualite reelle des suggestions de mapping.

## Jeux de donnees
- cas simples
- cas ambigus
- cas historiques connus
- cas de rejet attendu
- cas sans preuve suffisante
- cas multi-tenant synthetiques ou anonymises

## Metriques
- schema validity contre `contracts/ai/mapping-suggestion.schema.json`
- exact match sur `suggestedTargetCode`
- `requiresHumanReview = true` strict
- `evidence[]` obligatoire, non vide et exploitable
- taux accept / reject / correct
- calibration confidence / riskLevel
- latence
- cout estime

## Garde-fous fixtures
- aucune donnee client brute
- aucun secret, token, credential, cookie, DSN, storage key, signed URL ou valeur `.env`
- aucune donnee cross-tenant
- aucun prompt libre interprete comme contrat
