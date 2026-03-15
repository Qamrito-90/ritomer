# Spec 001 - Foundation bootstrap

## Objectif
Creer la fondation technique minimale pour lancer le developpement en gardant des frontieres saines.

## In scope
- bootstrap Spring Boot / Kotlin / Gradle
- configuration Spring Modulith
- endpoint health
- build local
- arborescence backend par modules
- base pour observabilite
- base securite JWT resource server
- CI minimale

## Out of scope
- logique metier closing
- import balance
- IA reelle
- deploiement production complet

## Livrables
- projet compilable
- test de verification des modules
- endpoint `/actuator/health`
- endpoint `/api/me` placeholder
- README technique de demarrage

## Criteres d'acceptation
- `cd backend && ./gradlew build` passe
- `cd backend && ./gradlew test` passe
- la structure modulaire est verifiee
- les modules cibles existent comme squelette
- le projet demarre localement

## Tests requis
- smoke test
- test de structure modulith

## Hardening final (sans extension de perimetre)
- Le backend Kotlin/Spring Boot de reference est dans `backend/`.
- Le backend Kotlin/Spring Boot devient la source de verite unique ; tout backend legacy peut etre retire apres audit des references.
- Le demarrage local passe via le profil `local`.
- `GET /actuator/health` est accessible sans authentification.
- `GET /api/me` est protege et renvoie `401 Unauthorized` sans token.
- Le secret JWT est fourni par variable d'environnement (`RITOMER_SECURITY_JWT_HMAC_SECRET`) et aucun secret sensible n'est committe en dur.
- Profils clarifies: `local`, `dev`, `test`.
