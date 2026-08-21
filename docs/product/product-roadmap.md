# Product roadmap canonique M0–M8

## Rôle et portée

Cette roadmap est l'unique source canonique des outcomes, dépendances, gates et estimations relatives de Ritomer. `docs/product/v1-plan.md` porte la séquence immédiatement exécutable ; les specs, contrats, ADR, runbooks et preuves détaillent les incréments autorisés.

Les milestones sont des niveaux de maturité, pas des dates ni des autorisations. Aucun milestone ne crée, ne numérote ou ne réserve une spec et aucune progression n'est automatique.

## 1. North Star

Ritomer devient la plateforme suisse de production du closing fiduciaire, premium, multi-tenant, evidence-first et IA-native. Un utilisateur authentifié travaille dans son tenant, ouvre un dossier, confie un objectif borné à un agent, observe les outils et preuves, accepte, corrige ou rejette toute proposition engageante, puis retrouve l'exécution déterministe et l'audit.

Le métier garde toujours l'autorité. `IA-native` ne signifie ni chatbot omniprésent, ni autonomie comptable, réglementaire ou financière.

Le flux métier déterministe reste :

```text
balance → closing → contrôles → preuves → workpapers
→ revue → états → annexe → pack final
```

Le `pack final` actuel reste un export audit-ready non statutaire soumis à revue humaine ; il n'est ni un dépôt officiel ni une promesse de conformité finale.

## 2. État réel actuel

| Statut | Vérité actuelle | Limite |
| --- | --- | --- |
| `DELIVERED_AND_PROVED` | Cœur déterministe du closing, identity et memberships applicatifs, tenancy/RBAC, import, mapping manuel, contrôles, previews, workpapers, documents, export, annexe minimale, audit append-only et mapping assisté no-provider. | Preuves de repo et de delivery, sans hébergement SaaS ni validation professionnelle. |
| `LOCAL_OR_SYNTHETIC_ONLY` | Démo PostgreSQL/JWT/Vite, shell courant, fixtures et simulation offline `mapping-suggestion-v2`. | Pas de login/session SaaS durables, d'environnement partagé ni de donnée réelle. |
| `DOCUMENTED_NOT_IMPLEMENTED` | Cible Cloud Run/Cloud SQL, provider gateway réel, tracing/coûts IA, MCP client/serveur et préparation design-partner. | La documentation ne vaut ni runtime, ni autorisation, ni preuve d'exploitation. |
| `NOT_STARTED` | Goal/run agentique, registre d'outils exécutable, site public, bêta externe, support et production opérable. | Aucun de ces sujets n'est livré ou engagé par M0. |

Ritomer est `AI-ready, not yet AI-native in runtime`. Aucun provider réel, appel modèle réussi, agent runtime ou runtime MCP n'est actif.

## 3. Séquence canonique

```text
M0=CANONICAL_ROADMAP_REBASELINE
M1=AUTHENTICATED_PRODUCT_SHELL
M2=AI_RUNTIME_CORE
M3=AGENTIC_KERNEL_V1
M4=MAPPING_ASSISTANT_AGENT
M5=INTERNAL_ALPHA_HARDENING
M6=MCP_AND_MULTI_PROVIDER
M7=PUBLIC_WEBSITE_AND_GTM_READINESS
M8=EXTERNAL_BETA_AND_PRODUCTION_READINESS

CRITICAL_PATH=M0_TO_M5
FIRST_AI_NATIVE_VERTICAL_SLICE=MAPPING_ASSISTANT_AGENT
```

Le chemin critique produit s'arrête à l'alpha interne stable M5. M6 reste hors chemin critique et n'est déclenché que par un besoin d'interopérabilité ou de portabilité prouvé. M7 suit M5 après son gate produit ; M8 suit la readiness site et opérations.

## 4. Milestones

### M0 — Canonical Roadmap Rebaseline

- **Outcome :** une seule vérité M0–M8 et aucun ancien rail présenté comme exécutable.
- **Démo de sortie :** état réel, North Star, chemin critique, premier slice et gates se lisent sans contradiction ; le checker 042 ne contrôle que ses invariants historiques 042.
- **Dépendances majeures :** décision owner de roadmap, baseline propre, zéro spec active et statuts 042–045 établis.
- **Hors-scope :** code produit, auth, provider, runtime, nouvelle infrastructure, activité externe, Word et visions.
- **Gate :** cohérence README/roadmap/plan/cadrages, liens et checks documentaires verts, aucune spec 046.
- **Estimation relative :** 1–2 semaines ; maximum 1 incrément documentaire/checker.

### M1 — Authenticated Product Shell

- **Outcome :** un utilisateur authentifié entre dans son tenant, voit son rôle, reprend son travail, navigue et se déconnecte avec une session sûre.
- **Démo de sortie :** login → accueil → dossiers → workspace → paramètres → logout ; mauvais tenant, membership absent et session expirée sont refusés clairement et audités.
- **Dépendances majeures :** M0 terminé ; IdP, modèle de session, callbacks et threat model décidés.
- **Hors-scope :** onboarding self-service riche, billing, MFA entreprise généralisée, recherche universelle, mobile 11/10 et utilisateur externe.
- **Gate :** OIDC réel en environnement partagé ; membership Ritomer autoritaire ; session, logout, révocation, CSRF et isolation tenant prouvés.
- **Estimation relative :** 4–6 semaines ; maximum 3 specs bornées.

### M2 — AI Runtime Core

- **Outcome :** un provider réel produit une sortie structurée, observable et désactivable sur données synthétiques, sans mutation.
- **Démo de sortie :** appel backend avec modèle, prompt et schéma pinnés ; preuves, usage, coût et latence visibles ; timeout ou schéma invalide échoue explicitement ; mode manuel disponible provider coupé.
- **Dépendances majeures :** M1 stable ; posture provider/data/region/retention/logging ; dataset synthétique ; secrets et kill switch prêts.
- **Hors-scope :** orchestration agent, mutation, second provider actif, sélection provider par tenant, MCP runtime et données réelles.
- **Gate :** comparer Spring AI et le SDK Java officiel derrière le même port interne, puis retenir seulement la solution qui préserve strict schema, pinning, data controls, approbations et traces redacted.
- **Estimation relative :** 3–5 semaines ; maximum 2 specs bornées.

### M3 — Agentic Kernel V1

- **Outcome :** objectifs, runs, étapes, outils, budgets, approbations et audit sont persistés et lisibles.
- **Démo de sortie :** un run borné appelle des outils read-only, passe en attente d'approbation, accepte le rejet, le cancel et le timeout, puis expose son historique.
- **Dépendances majeures :** M2 stable ; schémas run/tool/approval, permissions et threat model des outils décidés.
- **Hors-scope :** swarm, planification ouverte, runtime MCP, provider routing et mutation comptable autonome.
- **Gate :** toute mutation reste impossible avant une décision humaine liée au même tenant, actor, rôle, run, proposition et version.
- **Estimation relative :** 3–5 semaines ; maximum 2 specs bornées.

### M4 — Mapping Assistant Agent

- **Outcome :** le premier slice IA-native exécute le parcours mapping complet sans remplacer l'autorité humaine.
- **Démo de sortie :** objectif → outils de lecture → proposition sourcée ou abstention → accept/correct/reject → mapping déterministe → vérification et audit liés au run.
- **Dépendances majeures :** M1–M3 verts ; dataset et taxonomie requalifiés ; seuils d'eval, règles de stale/conflict et UX de décision définis.
- **Hors-scope :** auto-apply, bulk autonome, donnée réelle, readiness globale, workpaper review, multi-agent et MCP.
- **Gate :** preuve ou abstention pour chaque proposition, décisions honorées exactement, stale et double-submit maîtrisés, zéro cross-tenant, fallback manuel.
- **Estimation relative :** 3–5 semaines ; maximum 2 specs bornées.

### M5 — Internal Alpha Hardening

- **Outcome :** l'alpha authentifiée est partagée en interne, stable, surveillée, récupérable et répétable sans session de debug.
- **Démo de sortie :** dix runs synthétiques consécutifs sur deux tenants/deux rôles, pannes provider, session expiry, rollback, restore et trois parcours owner de session fraîche.
- **Dépendances majeures :** M4 accepté ; ownership ops, environnement interne, threat model et politique de rétention synthétique.
- **Hors-scope :** utilisateur externe, production, SLA commercial, billing, données réelles et site public.
- **Gate :** zéro fuite tenant, décisions honorées, caps et kill switch appliqués, monitoring, incident, rollback, backup/restore et mode dégradé testés.
- **Estimation relative :** 4–6 semaines ; maximum 3 specs bornées.

### M6 — MCP and Multi-provider

- **Outcome :** Ritomer consomme une capacité externe ou qualifie un second provider seulement parce qu'un besoin concret le justifie.
- **Démo de sortie :** client MCP read-only authentifié sur une ressource ou un outil approuvé, ou même eval exécutée sur un second provider ; aucun serveur Ritomer sans client externe identifié.
- **Dépendances majeures :** abstraction provider M2, registre d'outils M3, au moins M4 et besoin documenté.
- **Hors-scope :** marketplace, serveur public par défaut, outil externe mutating sans confirmation, sélection provider libre et swarm.
- **Gate :** isolation, allowlist, auth, egress, revocation, timeout, audit et parity d'eval prouvés ; aucun fallback silencieux.
- **Estimation relative :** 4–7 semaines ; maximum 3 specs séparées par besoin.

### M7 — Public Website and GTM Readiness

- **Outcome :** un site public honnête présente le produit réellement disponible et permet un contact borné.
- **Démo de sortie :** pages produit, IA, sécurité et cas d'usage avec captures M5 réelles, claims vérifiables, responsive, accessibilité et privacy.
- **Dépendances majeures :** alpha M5 stable, positionnement et claims stables, provenance des captures et autorisations publication/collecte exactes.
- **Hors-scope :** faux dashboard, témoignage inventé, promesse de conformité ou de gain, onboarding bêta automatique et données réelles.
- **Gate :** les six conditions de la section site public sont prouvées ; légal/privacy et rollback publication sont prêts.
- **Estimation relative :** 3–5 semaines ; maximum 2 specs bornées.

### M8 — External Beta and Production Readiness

- **Outcome :** une cohorte externe bornée utilise Ritomer avec onboarding, support, sécurité, opérations, récupération et arrêt contrôlé.
- **Démo de sortie :** tenant bêta provisionné, parcours auth/closing/agent, support/incident, lifecycle data, rollback/restore et offboarding sans claim statutaire.
- **Dépendances majeures :** M5 et M7 réussis ; périmètre, participants, données, obligations et runbooks autorisés.
- **Hors-scope :** scale enterprise, conformité certifiée, autonomie comptable, expansion pays et billing complexe sans besoin prouvé.
- **Gate :** sécurité, tenant/data lifecycle, support, recovery et métriques valeur/sûreté permettent une décision de production exacte et séparée.
- **Estimation relative :** 6–10 semaines ; maximum 4 specs bornées.

## 5. Travail parallèle sûr et travail différé

Travail préparatoire parallèle permis sans activation : évaluation IdP et threat model ; fixtures et evals synthétiques ; exigences provider/data ; architecture de contenu et marque sans publication ; exigences secrets, incident, rollback, retention et support.

```text
SAFE_PARALLEL_WORK=IDENTITY_AND_THREAT_MODEL; SYNTHETIC_DATASET_AND_EVALS; BRAND_AND_CONTENT_ARCHITECTURE; LEGAL_PRIVACY_REQUIREMENTS; OPS_RUNBOOK_DRAFTS
DEFERRED_WORK=SECOND_ACTIVE_PROVIDER; TENANT_PROVIDER_CHOICE; MCP_SERVER; MULTI_AGENT_SWARM; UNIVERSAL_SEARCH; DEEP_MOBILE; BILLING; GRAPHQL; GENERALIZED_RLS; PYTHON_AI_SERVICE; FINAL_STATUTORY_OUTPUTS
```

## 6. Décisions structurantes

### Authentification

```text
AUTHENTICATION_SEQUENCE=M1_EARLY
LOCAL_DEV_AUTH_MODE=LOCAL_TEST_ONLY
LOCAL_DEV_AUTH_REPLACES_EXTERNAL_IDP_ONLY=YES
LOCAL_DEV_AUTHORIZATION_BYPASS=NO
LOCAL_DEV_MUST_USE_REAL_SYNTHETIC_USERS_MEMBERSHIPS_ROLES_AND_TENANTS=YES
SHARED_INTERNAL_ENVIRONMENT_REQUIRES_REAL_OIDC=YES
```

Le mode local simplifie seulement l'entrée. Claims, memberships, rôles, autorisations serveur et tenant-scoping suivent les mêmes frontières que l'OIDC réel.

### IA-native et agentique

```text
OPENAI_FIRST=YES
PROVIDER_ABSTRACTION_FROM_DAY_ONE=YES
ONE_BOUNDED_AGENT_FIRST=YES
MULTI_AGENT_SWARM_NOW=NO
READ_ONLY_TOOLS_BY_DEFAULT=YES
HUMAN_CONFIRMATION_BEFORE_MUTATION=YES
DIRECT_MODEL_DATABASE_ACCESS=NO
```

Le modèle n'a aucune autorité métier et n'accède jamais directement aux repositories ou à la base. Une approbation humaine déclenche une commande déterministe idempotente via la couche application.

### Model Context Protocol

MCP signifie `Model Context Protocol`. C'est un protocole host–client–server pour resources, prompts et tools ; ce n'est ni un modèle, ni un agent, ni un orchestrateur.

```text
MCP_STRATEGIC_PRIORITY=CONFIRMED
MCP_READINESS_FROM_M2_M3=YES
INTERNAL_TOOL_REGISTRY_MCP_ADAPTABLE=YES
MCP_RUNTIME_TARGET=M6
MCP_CLIENT_FIRST=YES
MCP_SERVER_ONLY_ON_PROVED_EXTERNAL_CLIENT_NEED=YES
```

```text
INTERNAL_TOOL_REGISTRY
→ MCP_CAPABILITY_CATALOG
→ MCP_CLIENT_READ_ONLY
→ AUTHORIZED_EXTERNAL_RESOURCES_AND_TOOLS
→ MCP_SERVER_ONLY_IF_A_REAL_EXTERNAL_CLIENT_NEED_EXISTS
```

`MCP_CAPABILITY_CATALOG` est un terme de gouvernance Ritomer, pas une primitive du protocole. M2/M3 préparent des ports, schémas et outils adaptables ; aucun runtime MCP n'arrive avant M6.

### Site public

```text
PRODUCT_FIRST=YES
PUBLIC_WEBSITE_AFTER_STABLE_INTERNAL_ALPHA=YES
PUBLIC_WEBSITE_BEFORE_EXTERNAL_BETA=YES

PUBLIC_WEBSITE_GATE_REQUIRES_STABLE_INTERNAL_ALPHA=YES
PUBLIC_WEBSITE_GATE_REQUIRES_REAL_PRODUCT_SCREENSHOTS=YES
PUBLIC_WEBSITE_GATE_REQUIRES_ONE_AI_NATIVE_VERTICAL_SLICE_WORKING=YES
PUBLIC_WEBSITE_GATE_REQUIRES_POSITIONING_STABLE=YES
PUBLIC_WEBSITE_GATE_REQUIRES_SECURITY_WORDING_HONEST=YES
PUBLIC_WEBSITE_GATE_REQUIRES_DEMO_PATH_REPEATABLE=YES
```

Ces six marqueurs décrivent les prérequis du gate avant le build/publication M7 ; ils ne décrivent pas l'état actuel du produit.

## 7. Architecture et confiance préservées

```text
MODULAR_MONOLITH_KOTLIN_SPRING_BOOT=PRESERVE
REST_FIRST=PRESERVE
POSTGRESQL_CLOUD_SQL=PRESERVE
CLOUD_RUN=PRESERVE
TENANT_SCOPING=PRESERVE
AUDIT_APPEND_ONLY=PRESERVE
NO_PREMATURE_MICROSERVICE=PRESERVE
```

M0 n'introduit ni microservice, ni GraphQL, ni RLS généralisée, ni nouvelle infrastructure. Les providers, runs et outils futurs restent dans le monolithe modulaire derrière des ports explicites tant qu'aucun trigger réel ne justifie une autre architecture.

## 8. Statuts historiques et gouvernance

```text
042=BACKLOG_OR_HISTORICAL_NOT_EXECUTABLE_AS_CURRENT_RAIL
043=STOPPED_INCONCLUSIVE
044=DONE_DOCS_ONLY
045=DONE_DOCS_ONLY
ACTIVE_SPEC=AUCUNE
ACTIVE_SPEC_COUNT=0
SPEC_046=ABSENT
```

- La [spec 042](../../specs/backlog/042-controlled-ai-mapping-runtime-pilot-v1.md) conserve ses artefacts et blocages historiques ; elle n'est ni reprise ni utilisée comme rail actuel.
- La [spec 043](../../specs/done/043-controlled-fiduciary-pilot-readiness-v1.md) reste terminalement close avec `STOPPED_INCONCLUSIVE / SUCCESSFULLY_DELIVERED=NO`; 043c ne reprend pas et R1/R2 n'ont pas été exécutés.
- Les specs [044](../../specs/done/044-design-partner-readiness-v1.md) et [045](../../specs/done/045-design-partner-research-protocol-v1.md) restent des livraisons documentaires Done, sans activité externe.

Une future spec doit porter un outcome démontrable de 1–2 semaines, un file-set fermé, ses risques, tests, gates et stop conditions. Une seule spec peut être active. Aucun numéro futur n'est réservé et M1 ne dispose d'aucune autorisation d'implémentation par cette roadmap.
