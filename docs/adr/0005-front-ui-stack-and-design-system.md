# ADR 0005 - Front UI stack and design system source of truth

## Status
Accepted

## Context

Le produit vise une UX premium, sobre, audit-ready et IA-native, avec des écrans data-heavy de closing et des interactions evidence-first.  
Le frontend doit donc :
- absorber une forte densité de données ;
- rester accessible et rapide ;
- exposer clairement le contexte tenant / dossier ;
- rendre visibles l'audit, la preuve et la revue humaine ;
- éviter toute dérive visuelle ou prolifération de patterns incohérents.

## Decision

Nous retenons la combinaison suivante pour le frontend web :

- Tailwind CSS
- shadcn/ui
- Radix Primitives
- CSS variables pour les tokens sémantiques
- TanStack Table pour les grilles métier
- React Hook Form + Zod pour les formulaires

La source de vérité UI du repo est :

- `docs/ui/ui-foundations-v1.md`

## Consequences

### Positives
- vitesse d'exécution élevée ;
- contrôle visuel fin ;
- forte cohérence entre design system et produit métier ;
- excellente base pour workbenches data-heavy ;
- accessibilité plus maîtrisable ;
- theming light/dark stable.

### Guardrails
- pas de raw hex dans le code applicatif ;
- pas de variantes d'écran ad hoc ;
- les composants système sont centralisés dans `frontend/src/components/ui/*` ;
- les composants métier workbench vivent dans `frontend/src/components/workbench/*` ;
- les tokens sémantiques vivent dans `frontend/src/styles/tokens.css` ;
- les écrans critiques doivent toujours afficher le contexte tenant / dossier ;
- toute action IA sensible doit rester human-in-the-loop.

## Non-goals

Cette décision :
- ne lance pas immédiatement une implémentation frontend complète ;
- ne remplace pas une spec frontend dédiée ;
- ne modifie pas le périmètre de la spec backend en cours.

## Implementation timing

- Intégration documentaire : **immédiate**
- Implémentation technique du design system : **après la spec 002**, via une spec frontend dédiée
