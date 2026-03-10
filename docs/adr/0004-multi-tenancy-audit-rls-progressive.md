# ADR 0004 — Multi-tenancy, audit, RLS progressive

## Statut
Accepté

## Décision
Appliquer `tenant_id` partout, imposer le scoping applicatif et les tests cross-tenant dès le départ, puis activer RLS progressivement sur les tables critiques.

## Invariants
- aucun repository non scoped par tenant
- audit_event append-only sur actions critiques
- accès support cross-tenant exceptionnel, explicite et tracé

## Tables critiques candidates RLS
- documents
- audit_event
- imports
- mappings
