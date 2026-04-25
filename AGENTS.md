# AGENTS.md

## Mission
Construire un SaaS suisse de closing comptable, multi-tenant, sécurisé, audit-ready, avec UX premium et IA evidence-first.

## Sources à lire avant toute implémentation
Toujours lire dans cet ordre :
1. `docs/product/documentation-governance.md`
2. `docs/present/README.md`
3. `docs/present/<cadrage>.md` concerne par la mission
4. `docs/adr/*.md`
5. `docs/product/v1-plan.md`
6. `specs/active/<feature>.md`
7. `contracts/*` impactes
8. `runbooks/*` impactes
9. `docs/ui/ui-foundations-v1.md` si la mission touche une verite UI durable
10. `README.md`
11. `docs/vision/*`
12. `docs/playbooks/*`

Référence UI documentaire : `docs/ui/ui-foundations-v1.md`

Couche canonique du present : `docs/present/README.md` puis les cadrages concernes dans `docs/present/*`

## Gouvernance documentaire
- Le repo Git est la source de verite vivante du projet.
- `docs/present/*` porte la synthese canonique du present UX / architecture / IA pour l'execution.
- Apres chaque spec validee, une mise a jour documentaire minimale obligatoire du repo doit etre faite sur les artefacts impactes.
- Les documents Word dans `docs/reference-word/` ne sont pas requis pour la fermeture normale d'une spec.
- Les documents Word ne remplacent jamais la documentation vivante du repo.
- Les documents Word ne sont modifies que lors d'une tache explicite de realignement documentaire ou de snapshot externe.
- En cas d'ecart, `docs/present/*` doit etre realigne sur les artefacts vivants de plus haute priorite du repo ; les Word ne priment jamais.
- `docs/present/*` n'est mis a jour qu'en cas de changement reel de la verite du present concernee.
- Reference de gouvernance documentaire : `docs/product/documentation-governance.md`

## Invariants produit
- L’utilisateur métier doit garder le contrôle sur toute décision engageante.
- L’IA suggère, explique, rédige ou prépare ; elle ne valide jamais seule un acte comptable, réglementaire ou financier.
- Toute action importante doit être traçable : qui, quoi, quand, pourquoi, sur quelles preuves.
- Le workflow de closing prime sur la sophistication de reporting.
- La V1 doit être utilisable en conditions réelles par des fiduciaires pilotes.

## Invariants UX
- Clarté avant sophistication.
- Feedback immédiat, autosave, statuts explicites.
- Recherche globale, bulk actions, navigation poste → note → preuve.
- Responsive adaptatif : cohérent entre desktop et mobile, sans clonage aveugle.
- Accessibilité et privacy by design non négociables.
- Le produit doit inspirer confiance : messages clairs, annulation quand possible, confirmation seulement sur l’irréversible.

## Invariants architecture
- Monolithe modulaire Kotlin/Spring Boot.
- Frontières de modules strictes.
- Interactions inter-modules via API explicites ou événements applicatifs.
- Clean Architecture : domaine pur, application, infrastructure.
- REST first en V1. GraphQL seulement si la composition front devient un coût réel.
- PostgreSQL est la base principale ; Cloud SQL for PostgreSQL est la cible de prod.
- Cible plateforme V1 : Google Cloud, Cloud Run depuis le code source, prod en `europe-west6`, Cloud SQL for PostgreSQL 17 Enterprise en HA régional / Private IP.
- Le développement local et les tests par défaut ne doivent pas dépendre de Docker, Docker Compose ou Testcontainers.
- Contrats techniques versionnés dans `contracts/`.

## Invariants IA
- Evidence-first : pas de réponse IA sans base factuelle exploitable.
- Sorties structurées strictes pour toute capacité IA qui influence une décision.
- Human-in-the-loop obligatoire pour les actions critiques.
- Model pinning, prompt pinning, evals et logs obligatoires.
- Mode dégradé obligatoire : si l’IA tombe, le closing continue.
- Pas d’écriture directe en base par l’IA sans validation humaine et couche métier.

## Sécurité et multi-tenancy
- Toutes les données métier sont scindées par `tenant_id`.
- Aucun accès cross-tenant sans mécanisme explicite, tracé et autorisé.
- Les repositories sont toujours tenant-scoped.
- Ne jamais contourner l’audit.
- Ne jamais exposer de secrets en dur.
- Les données sensibles ne partent pas en clair vers des services IA externes.

## Qualité attendue
- Ajouter ou ajuster les tests impactés.
- Vérifier les frontières modulaires.
- Mettre à jour les contrats si le comportement change.
- Mettre à jour la documentation impactée si une décision devient durable.
- Toute PR doit rester reviewable et limitée en périmètre.

## Definition of done
Une mission est terminée seulement si :
- le périmètre demandé est respecté
- les tests nécessaires existent et passent
- les règles de sécurité et d’isolation tenant sont respectées
- les audits requis sont émis
- les fichiers modifiés sont listés
- les points de vigilance restants sont signalés

## Fresh Evidence Pack obligatoire
À la fin de toute tâche Codex, fournir un Fresh Evidence Pack final, court, factuel, vérifiable et proportionné à la surface de mission.

Ne jamais inclure de secret, token, clé, cookie, DSN, credential ou valeur `.env` dans le Fresh Evidence Pack. Si une vérification dépend d’un secret local, indiquer seulement que le check n’a pas été exécuté et pourquoi.

Si un élément du Fresh Evidence Pack n’est pas applicable, écrire `AUCUN`. Si une information n’est pas déterminée, écrire `NON DÉTERMINÉ` sans l’inventer.

Surfaces possibles :
- `DOCS_ONLY` / `DOCS_GIT`
- `FRONTEND`
- `BACKEND`
- `DB/MIGRATION`
- `CI/GIT`
- `CONTRACTS`
- `FULLSTACK`

Le Fresh Evidence Pack final doit contenir :
1. Résumé métier ou documentaire.
2. Demande initiale ou plan validé.
3. Surface de mission.
4. Liste exacte des fichiers modifiés.
5. Résumé précis du diff par fichier.
6. Commandes réellement exécutées.
7. Sorties fraîches des tests/checks.
8. Statut Git final.
9. Tests ajoutés ou modifiés.
10. Tests non exécutés avec justification.
11. Écarts éventuels par rapport au plan validé.
12. Risques résiduels.
13. Revue humaine recommandée ou non si le changement touche :
    - migration DB ;
    - authentification ;
    - autorisation ;
    - séparation tenant ;
    - audit ;
    - données sensibles ;
    - suppression de données ;
    - règle métier critique ;
    - nouvelle dépendance ;
    - changement d’architecture ;
    - production ;
    - irréversibilité métier.

## Commandes de base
- Build backend :
```powershell
Push-Location backend
try {
  .\gradlew.bat build
} finally {
  Pop-Location
}
```
- Tests backend :
```powershell
Push-Location backend
try {
  .\gradlew.bat test
} finally {
  Pop-Location
}
```
- Tests DB optionnels avec une configuration PostgreSQL explicite :
```powershell
Push-Location backend
try {
  .\gradlew.bat dbIntegrationTest
} finally {
  Pop-Location
}
```
- Vérification modulith :
```powershell
Push-Location backend
try {
  .\gradlew.bat test --tests "*ApplicationModule*"
} finally {
  Pop-Location
}
```
- Lancer le backend en local :
```powershell
Push-Location backend
try {
  .\gradlew.bat bootRun --args='--spring.profiles.active=local'
} finally {
  Pop-Location
}
```
- Tests frontend CI :
```powershell
Push-Location frontend
try {
  pnpm test:ci
} finally {
  Pop-Location
}
```
- Lint frontend :
```powershell
Push-Location frontend
try {
  pnpm lint
} finally {
  Pop-Location
}
```
- Build frontend :
```powershell
Push-Location frontend
try {
  pnpm build
} finally {
  Pop-Location
}
```

## Interdits
- Ne pas introduire de microservice sans ADR ni trigger clair.
- Ne pas introduire GraphQL par confort théorique.
- Ne pas bypasser les couches métier pour “aller plus vite”.
- Ne pas coder l’IA en texte libre si un JSON Schema existe.
- Ne pas casser un contrat existant sans mise à jour explicite.
- Ne pas utiliser des données d’un tenant dans le contexte IA d’un autre tenant.
