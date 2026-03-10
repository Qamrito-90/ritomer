# ADR 0003 — AI Gateway evidence-first

## Statut
Accepté

## Décision
Introduire une AI Gateway dès le départ via des ports applicatifs stables. Démarrer in-process avec Spring AI si possible. N’extraire vers Python que sur trigger explicite.

## Invariants
- structured outputs obligatoires pour les capacités critiques
- human-in-the-loop obligatoire
- logs, evals, model pinning, prompt pinning
- pas d’écriture directe en base par l’IA

## Triggers d’extraction Python
- OCR / tables PDF centraux
- besoin GPU / modèles locaux
- batch IA lourd
- cycle de déploiement IA indépendant nécessaire
