# Mapping Suggestion Decision V1 Persistence

## Scope

Convention de persistance introduite par `030f` pour les decisions humaines unitaires sur une suggestion de mapping IA.

La table ne donne aucune autorite a l'IA. Elle sert a rendre durable et idempotent le choix humain `ACCEPT`, `CORRECT` ou `REJECT`.

## Source of truth

- Migration executable : `backend/src/main/resources/db/migration/V10__spec_030f_mapping_suggestion_decision_request.sql`
- Contrat HTTP : `contracts/openapi/mapping-suggestions-api.yaml`
- SGBD cible : PostgreSQL
- Outil de migration : Flyway

## Table creee

- `mapping_suggestion_decision_request`

## Regles de modelisation

- `tenant_id` est obligatoire et reference `tenant`.
- La table est unique par `(tenant_id, closing_folder_id, account_code, idempotency_key)`.
- `canonical_payload_hash` et `suggestion_fingerprint` sont des SHA-256 hex lowercase de 64 caracteres.
- `decision` vaut uniquement `ACCEPT`, `CORRECT` ou `REJECT`.
- `target_code` est obligatoire pour `ACCEPT` / `CORRECT` et interdit pour `REJECT`.
- `review_comment` reste optionnel et borne a 600 caracteres.
- `actor_user_id` reference `app_user`.
- Le FK `(closing_folder_id, tenant_id)` scelle le rattachement tenant du dossier.
- `PENDING` est reserve a l'interieur de la transaction applicative et ne doit pas etre observe comme resultat commite.
- Les resultats terminaux `CONFLICT_*` sont conserves afin qu'un replay idempotent retourne le meme resultat metier sans dupliquer mapping ni audit.

## Autorite metier

- `ACCEPT` et `CORRECT` passent par la logique metier de mapping manuel existante.
- `REJECT` ne cree ni ne modifie aucun mapping manuel.
- Le mapping manuel reste l'autorite metier durable.
