# ADR 0001 — Monolithe modulaire

## Statut
Accepté

## Décision
Commencer avec un monolithe modulaire Kotlin/Spring Boot, structuré par modules métier, avec vérification des frontières.

## Pourquoi
- accélère le time-to-market
- réduit la complexité ops
- permet une gouvernance forte des frontières
- prépare une extraction future sans la payer trop tôt

## Conséquences
- nécessité de tests d’architecture
- discipline stricte sur les dépendances inter-modules
- extraction microservice seulement sur trigger explicite
