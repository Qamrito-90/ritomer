# AI Playbook condensé

## Patterns produit
- question de clarification si ambiguïté
- "je ne sais pas" plutôt qu’halluciner
- proposition d’action + validation
- résumé + sources + prochaines étapes
- mode expert encadré

## RAG
- indexer seulement les sources utiles
- filtrer strictement par tenant
- citations obligatoires
- retrieval mesuré et ajusté

## Orchestration
- chaîne simple si possible
- agent multi-étapes seulement si nécessaire
- tool-calling strictement cadré
- aucune action engageante sans validation

## Gouvernance
- masquage données sensibles
- logs prompts / réponses / sources / actions
- droits d’accès alignés sur l’application
- evals avant mise en prod
- fallback si IA lente ou indisponible
- feedback loop versionnée
