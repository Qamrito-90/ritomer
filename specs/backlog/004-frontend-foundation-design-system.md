# 004 - Frontend foundation design system

## Status
Backlog

## Why now

La vision UX / architecture / IA-native impose un langage UI cohérent, audit-ready et evidence-first.  
Après la consolidation du socle backend (spec 002), il faut poser le châssis frontend pour éviter une dérive de composants et de patterns.

## Scope

Implémenter le socle frontend conforme à `docs/ui/ui-foundations-v1.md` :

- installation / vérification de Tailwind
- intégration shadcn/ui
- primitives Radix nécessaires
- `frontend/src/styles/tokens.css`
- base theming light/dark par CSS variables
- helpers `frontend/src/lib/format/*`
- wrappers `frontend/src/components/ui/*`
- premiers composants métier `frontend/src/components/workbench/*`
- app shell minimal
- Storybook ou équivalent si déjà prévu dans la stack
- règles de tests d'accessibilité de base

## Out of scope

- logique métier backend supplémentaire
- implémentation complète des écrans imports / mapping / closing
- logique IA runtime
- design détaillé de chaque feature métier

## Acceptance criteria

- aucun raw hex dans les composants applicatifs
- tenant / dossier visibles dans l'app shell sur les écrans sensibles
- tokens sémantiques utilisés de bout en bout
- Button / Input / Select / DataTable / WorkflowBadge / ToastUndo disponibles
- états default / hover / focus / disabled / loading / error implémentés
- formatters financiers disponibles
- composants critiques navigables au clavier
- documentation courte de consommation disponible

## Dependencies

- spec 002 terminée ou suffisamment stabilisée côté vocabulaire identité / tenancy / closing
- ADR 0005 accepté
- `docs/ui/ui-foundations-v1.md` présent dans le repo
