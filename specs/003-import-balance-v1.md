# Spec 003 — Import balance V1

## Objectif
Permettre l’import non destructif d’une balance canonique avec validations lisibles.

## In scope
- upload CSV
- parsing
- validations
- versioning d’import
- erreurs lisibles
- audit import

## Critères d’acceptation
- import non destructif
- diff version N / N-1 disponible
- erreurs exploitables par un utilisateur métier
- import 10k lignes dans le seuil défini

## Tests requis
- unit parsing / validation
- intégration import
- test perf dataset fixe
