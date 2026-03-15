# UI Foundations V1
Source of truth UI produit - SaaS suisse de clôture comptable IA-native

Version 1.0  
Statut : **authoritative for frontend foundations**  
Périmètre : **web app principale + déclinaisons mobiles adaptées + écrans data-heavy du closing + interactions IA soumises à validation humaine**

## 1. Mandat

Ce document traduit la vision UX, la vision d'architecture et la vision IA-native en règles **codables** pour le frontend.  
Il ne remplace pas Figma, Storybook ni les ADRs : il les alimente et les précède.

Il est **autoritaire** sur 4 sujets :
1. les tokens design et leurs usages ;
2. les conventions visuelles du financial workbench ;
3. les patterns IA evidence-first et audit-ready ;
4. les garde-fous de delivery UI.

## 2. North star

- Premium mais sobre
- Clair sous pression
- Confiance et auditabilité visibles

## 3. Principes produit non négociables

- **Less is more** : chaque écran montre l'essentiel pour la tâche en cours.
- **Confiance visible** : contexte client/dossier visible, états clairs, preuves accessibles, actions tracées, séparation stricte des tenants.
- **Vitesse sans panique** : hors actions irréversibles, préférer **Undo** à la multiplication des confirmations.
- **Cohérence multi-plateforme sans clonage** : mêmes concepts, termes et icônes ; mise en page adaptative.
- **Workbench financier, pas SaaS générique** : tableaux, preuves, formats financiers et statuts métier sont de premier rang.
- **IA au service de l'expert** : chaque suggestion IA doit être vérifiable, modifiable, rejetable et traçable.

### Lois de design system

- Jamais de raw hex dans le code applicatif.
- Jamais d'information critique codée par la couleur seule.
- Jamais d'icon button sans libellé accessible.
- Jamais de contenu critique caché derrière un hover-only pattern.
- Toujours afficher le contexte tenant / dossier sur les écrans sensibles.
- Toute action IA modifiant un livrable officiel passe par une revue humaine.

## 4. Stack front retenue

- **Tailwind CSS**
- **shadcn/ui**
- **Radix Primitives**
- **CSS variables** comme source de vérité du theming
- **TanStack Table** pour les grilles métier
- **React Hook Form + Zod** pour les formulaires

### Garde-fous

- Les composants système vivent dans `frontend/src/components/ui/*`
- Les composants métier workbench vivent dans `frontend/src/components/workbench/*`
- Les tokens sémantiques vivent dans `frontend/src/styles/tokens.css`
- Les helpers de format vivent dans `frontend/src/lib/format/*`
- Les écrans ne consomment jamais de couleur brute
- Les écrans n'inventent pas leurs propres variants

## 5. Système visuel

### Répartition d'expression

- **70% trust / navy / neutres**
- **20% indigo d'interaction**
- **10% accents sémantiques**

### Tokens sémantiques essentiels

#### Surfaces
- `surface.canvas`
- `surface.default`
- `surface.sunken`
- `surface.elevated`
- `surface.overlay`

#### Texte
- `text.default`
- `text.muted`
- `text.soft`
- `text.inverse`
- `text.link`

#### Bordures
- `border.default`
- `border.strong`
- `border.focus`
- `border.critical`

#### États
- `state.selected`
- `state.disabled`
- `state.loading`

#### Familles sémantiques
- `primary.*`
- `success.*`
- `warning.*`
- `error.*`
- `info.*`

#### Workflow
- `workflow.draft`
- `workflow.review`
- `workflow.validated`
- `workflow.finalized`
- `workflow.exported`

### Mapping Tailwind

Utiliser exclusivement les conventions sémantiques de type :
- `bg-background`
- `text-foreground`
- `border-border`

Interdits :
- `bg-[#xxxxxx]`
- `text-[#xxxxxx]`
- variants visuels improvisés au niveau écran

## 6. Typographie, formats et mouvement

### Typographie
- Font UI : **Inter** si disponible, sinon `ui-sans-serif`
- Tous les montants, pourcentages, colonnes chiffrées et dates en **tabular-nums**

### Hiérarchie
- Display : 32 px
- H1 : 24 px
- H2 : 20 px
- H3 : 18 px
- Body : 14 px
- Meta : 12 px

### Formats
- Monnaie : `CHF 12 345.67`
- Négatif : `-12 345.67`
- Pourcentage : `12.4 %`
- Date : `31.12.2025`
- Période : `FY25` / `Q4 2025`

### Layout
- Base spacing : 4 px
- Échelle : 4 / 8 / 12 / 16 / 24 / 32 / 48
- Radius : 8 / 12 / 16 / 24
- Ombres : discrètes
- Motion : 120 / 180 / 240 ms
- Respect strict de `prefers-reduced-motion`

## 7. Charts et visualisation de données

Les graphiques restent secondaires par rapport au tableau de preuve, mais leur sémantique est fixe.

- **Actual** : série de référence principale
- **Forecast / projection** : visuellement distinct de Actual
- **Période précédente** : comparaison historique
- **Anomaly / exception** : toujours couplée à icône ou badge
- **Critical risk** : jamais la couleur seule
- **Validated / OK** : peut être renforcé par coche ou marqueur
- **Confidence band** : surface légère, sans texte dedans

## 8. Règles du financial workbench

- Sidebar desktop : **5 à 7 entrées max**
- Header global + breadcrumb + contexte client/dossier toujours visible
- Mobile : adaptation intelligente, pas clone du desktop
- Densité : `comfortable` / `default` / `compact`
- Tables : header sticky, première colonne gelable, filtre visible, row actions, bulk actions, états empty/loading/error
- Seules les actions irréversibles ou officielles demandent confirmation
- Le reste doit privilégier **Undo**
- Maker / checker visible sans ouvrir plusieurs écrans
- L'audit visible doit exister dans l'interface, pas seulement en base

### Dictionnaire des statuts workflow

- **Brouillon**
- **Importé**
- **Mappage en cours**
- **Mappé**
- **EF générés**
- **À justifier**
- **À revoir**
- **En attente de validation**
- **Validé**
- **Retourné**
- **Prêt à finaliser**
- **Finalisé**
- **Exporté**

## 9. Contrats d'interaction IA-native

Toute interaction IA doit être :
- evidence-first
- explicable
- tracée
- revueable
- compatible human-in-the-loop

### Composants signature IA

#### AI Suggestion Card
Contient :
- titre
- statut
- proposition
- rational court
- niveau de confiance
- preuves
- actions accepter / modifier / rejeter

#### Evidence Block
Contient :
- source
- extrait
- période
- lien "voir plus"

#### Source Drawer
Contient :
- liste de sources
- métadonnées
- fragments
- navigation vers la pièce

#### Audit Timeline
Contient :
- qui
- quoi
- quand
- preuve
- statut

#### Review Panel
Contient :
- checklist
- commentaires reviewer
- décision maker/checker

#### File Evidence Card
Contient :
- nom de pièce
- type
- date
- source
- statut de vérification

### Safe failure obligatoire

- Si l'IA ne sait pas, elle le dit.
- Si la preuve est insuffisante, elle demande une clarification.
- Si la sortie est sensible, elle se met en attente de validation.
- Si une source est indisponible, l'interface le signale au lieu d'inventer.

## 10. Catalogue de composants V1

### Shell et navigation
- App Shell
- Command Palette
- Tabs
- Drawer / Side Panel

### Actions et feedback
- Button / Icon Button
- Toast + Undo
- Dialog / AlertDialog

### Saisie
- Input / Textarea
- Select / Combobox
- Date / Period Picker

### Data-heavy
- Data Table
- Filter Bar
- Empty / Error / Skeleton State
- Badge de workflow

### Gates minimales d'acceptation

Chaque composant doit documenter et implémenter :
- `default`
- `hover`
- `focus`
- `disabled`
- `loading`
- `error`

Et prouver :
- navigation clavier
- focus visible
- contrastes
- comportement mobile / desktop
- état empty / loading / error
- confirm vs undo explicite
- analytics si parcours clé
- audit event si action sensible ou IA
- source handling si composant IA

## 11. Gouvernance de delivery

### Definition of Done UI

Aucun composant ne passe en production sans :
- états minimaux documentés et implémentés
- accessibilité vérifiée
- comportement responsive explicite
- token mapping explicite
- story + test + référence token avant merge

### Règle de gouvernance

Toute nouvelle décision structurante frontend crée ou modifie un ADR dans `docs/adr/`.

## 12. Convention repo à appliquer

### Documentation
- `docs/ui/ui-foundations-v1.md` -> source de vérité UI
- `docs/adr/0005-front-ui-stack-and-design-system.md` -> décision structurante
- `specs/backlog/004-frontend-foundation-design-system.md` -> implémentation ultérieure

### Frontend
- `frontend/src/styles/tokens.css`
- `frontend/src/components/ui/*`
- `frontend/src/components/workbench/*`
- `frontend/src/lib/format/*`

## 13. Ce que ce document ne fait pas

Ce document :
- ne remplace pas Figma
- ne remplace pas Storybook
- ne remplace pas les specs d'implémentation
- ne doit pas être utilisé pour élargir le périmètre d'un sprint backend

## 14. Règle d'intégration projet

- **À intégrer immédiatement dans le repo comme source de vérité documentaire**
- **À utiliser dès maintenant comme contrainte de langage produit**
- **À implémenter techniquement dans une spec frontend dédiée, après la spec 002**
