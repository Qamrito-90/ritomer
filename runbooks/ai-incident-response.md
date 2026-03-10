# Runbook IA — incident response

## Symptômes
- latence IA anormale
- hausse des timeouts
- réponses sans preuves
- drift de qualité
- coût anormal

## Réponses immédiates
1. activer le feature flag de fallback si nécessaire
2. vérifier logs, traces et métriques
3. identifier la version modèle / prompt / schéma
4. comparer avec les derniers evals
5. si doute, désactiver la capacité IA concernée

## Principe
Le closing doit continuer même si l’IA est dégradée.
