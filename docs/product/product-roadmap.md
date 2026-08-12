# Product roadmap canonique

## Role et portee

Cette roadmap est la source canonique des outcomes, phases, workstreams et gates produit de Ritomer. Elle ne remplace pas la verite executable detaillee de `docs/product/v1-plan.md`, des specs, contrats, runbooks et artefacts de preuve.

Les phases sont des niveaux de maturite, pas un calendrier. Aucune date, capacite d'equipe ou promesse commerciale n'est inventee. Aucune progression n'est automatique et cette roadmap n'autorise aucun runtime.

## 1. North Star

Ritomer devient la plateforme suisse de production du closing fiduciaire :

**balance → closing → contrôles → preuves → workpapers → revue → états → annexe → pack final**

L'outcome vise un closing comprehensible, reproductible, tenant-scoped, evidence-first et pret pour une revue humaine responsable. Le metier garde le controle de toute decision engageante.

Le `pack final` est une cible de maturite. L'export actuellement livre reste un pack audit-ready non statutaire, soumis a revue humaine; il n'est ni un depot officiel ni une promesse de conformite finale.

## 2. Etat reel actuel

| Etat | Verite actuelle | Ce que cet etat ne permet pas de conclure |
| --- | --- | --- |
| Livre et prouve | Le coeur deterministe du closing, l'import, le mapping manuel, les controles, previews financieres, workpapers, preuves, revue, export audit-ready et annexe minimale sont livres par les specs Done. Les surfaces cockpit et les smokes internes jusqu'a `041` apportent des preuves de parcours. | Ni production commerciale, ni livrable statutaire final, ni pilote externe. |
| Local seulement | La demo integree PostgreSQL/JWT/Vite, les donnees demo synthetiques et la simulation offline `mapping-suggestion-v2` sont bornees au local et au POC interne. | Ni authentification SaaS durable, ni hebergement pilote, ni IA provider active. |
| Documente seulement | La cible Google Cloud, les gates IA/humains, les phases SaaS, les maturites MCP et la préparation documentaire de Phase 1 sont documentés mais non livrés par cette roadmap. La spec `043` est [terminalement close avec un résultat inconclusif](../../specs/done/043-controlled-fiduciary-pilot-readiness-v1.md) : 043a livré, 043b validé localement sur données synthétiques, 043c arrêté, R1/R2 non exécutés. | La documentation ne vaut ni implémentation, ni autorisation, ni preuve d’exploitation. La Phase 0 n’a pas obtenu de résultat complet positif. |
| Bloque | `042` reste en backlog avec collecte humaine, adjudication, golden set et provider toujours bloques. Toute invitation externe, toute donnee reelle et toute activation IA provider restent sous gates distincts. | Un artefact prepare ou un gate decrit ne vaut pas approbation. |
| Non commence | Site public exécuté, recrutement effectif de design partners, auth/onboarding SaaS durables, environnement pilote hébergé, pilote externe, première IA métier mesurée et runtime MCP. | Aucun de ces sujets n’est engagé par la clôture terminale de `043`. |

La synthese du present, le plan V1, les specs et les preuves Git gardent leur precedence pour tout fait executable. Cette roadmap rend la direction lisible sans requalifier un artefact local ou documentaire en capacite livree.

### Frontière courante vers la Phase 1

```text
NEXT_PRODUCT_DIRECTION=PHASE_1_DESIGN_PARTNER_READINESS
CURRENT_AUTHORIZATION=DOCS_ONLY_PREPARATION
PHASE_0_COMPLETE_PASS=NO

PHASE_1_PUBLICATION_AUTHORIZED=NO
PHASE_1_OUTREACH_AUTHORIZED=NO
PHASE_1_INTERVIEW_AUTHORIZED=NO
PHASE_1_COLLECTION_AUTHORIZED=NO
PHASE_1_EXTERNAL_ACCESS_AUTHORIZED=NO
PHASE_1_REAL_DATA_AUTHORIZED=NO
PHASE_1_RUNTIME_AUTHORIZED=NO
```

Cette direction autorise uniquement la préparation documentaire. Elle ne crée ni ne numérote une nouvelle spec et n’autorise aucune publication, prospection, interview, collecte, création d’accès externe, donnée réelle ou capacité runtime.

## 3. Maturite IA

### Aujourd'hui - AI-ready

Le produit possede un coeur deterministe, une architecture de gateway, des sorties structurees, des evals, des garde-fous evidence-first et une revue humaine. Le mapping assiste livre est no-provider ou offline/local. Ritomer est donc `AI-ready`, pas encore `AI-assisted`.

### Premiere IA metier mesuree - AI-assisted

Ritomer devient `AI-assisted` seulement lorsqu'une premiere capacite IA metier reelle est mesuree sur un perimetre autorise, avec preuves exploitables, sortie structuree stricte, model/prompt/schema pinning, cout et latence mesures, fallback, isolation tenant et decision humaine explicite.

### Plusieurs workflows centraux mesures - AI-native

Ritomer devient `AI-native` lorsque plusieurs workflows centraux utilisent des capacites IA mesurees et gouvernees, tout en conservant un coeur deterministe, le mode degrade, les preuves, l'audit et le human-in-the-loop. `AI-native` ne signifie jamais autonomie sur une decision comptable, reglementaire ou financiere engageante.

## 4. Six workstreams

| Workstream | Etat actuel | Outcome recherche | Prochain gate significatif |
| --- | --- | --- | --- |
| Produit fiduciaire | Cœur closing et cockpit internes livrés ; `043a` livré, `043b` validé localement sur données synthétiques et `043c` arrêté inconclusif. R1/R2 et la préparation externe ne sont pas établis. | Un closing complet, clair et reproductible, utilisable puis éprouvé par des fiduciaires sans perdre la preuve ni le contrôle humain. | Préparation documentaire de `PHASE_1_DESIGN_PARTNER_READINESS`, sans activité externe. |
| SaaS & identite | Tenancy/RBAC et auth locale prouves; onboarding SaaS durable non commence. | Acces heberge securise, onboarding explicite et isolation tenant prouvee pour chaque acteur. | Readiness interne, cadrage auth/identity et revue Security/Privacy. |
| Trust & operations | Audit, stockage prive et runbooks de base existent; exploitation pilote hebergee non prouvee. | Exploitation observable, recuperable et auditable avec incident, backup/restore, retention et support controles. | Revue d'architecture/operations avant environnement heberge. |
| Go-to-market | Positionnement produit documente; site public et recrutement non lances. | Recruter des design partners qualifies avec une promesse honnete, un protocole et des gates de participation explicites. | Cadrage CPO et Security/Privacy avant publication ou collecte. |
| IA-native | AI-ready; `042` en backlog et provider bloque. | Produire un gain metier IA mesure, evidence-first et human-in-the-loop, puis l'etendre a plusieurs workflows centraux. | Nouvelle decision CPO sur `042` et tous les gates IA/provider requis. |
| Agent Platform & MCP | Maturites documentees; aucun runtime MCP. | Exposer progressivement des capacites Ritomer aux clients IA et agents sans dupliquer ni contourner la logique metier. | Capability Catalog gouverne avant tout serveur ou tool MCP. |

## 5. Phases produit

| Phase | Outcome de phase |
| --- | --- |
| Phase 0 - alpha interne reproductible - `043` | Clôturée terminalement avec `STOPPED_INCONCLUSIVE` : 043a livré, 043b validé localement sur données synthétiques, 043c arrêté, R1/R2 non exécutés et aucune préparation externe prouvée. Aucun résultat complet positif de Phase 0 n’est établi. |
| Phase 1 - Design Partner Readiness | Rendre la proposition de valeur compréhensible et préparer documentairement un recrutement responsable. L’autorisation courante reste `DOCS_ONLY_PREPARATION`. |
| Phase 2 - authentification et onboarding SaaS | Permettre a des organisations et acteurs autorises d'entrer dans un tenant avec un onboarding securise et auditable. |
| Phase 3 - environnement pilote heberge | Exploiter un environnement pilote controle, observable, recuperable et tenant-isole. |
| Phase 4 - pilote fiduciaire synthetique externe | Observer des fiduciaires externes sur un protocole synthetique autorise, sans donnee client reelle. |
| Phase 5 - hardening pilot-driven et readiness donnees reelles | Corriger les problemes prouves par le pilote et preparer, sans l'autoriser implicitement, le traitement de donnees reelles. |
| Phase 6 - premiere IA metier assistee et mesuree | Demontrer un gain IA metier reel, borne, mesure, evidence-first et soumis a revue humaine. |
| Phase 7 - V1 commerciale IA-native | Livrer une V1 commercialement operable dans laquelle plusieurs workflows IA mesures renforcent le closing sans autonomie critique. |

## 6. Travail en parallele

- La préparation de Phase 1 peut uniquement être cadrée dans des documents. Elle ne vaut ni publication, ni outreach, ni interview, ni collecte, ni invitation, ni accès externe, ni donnée réelle, ni runtime.
- L'authentification SaaS et l'hebergement peuvent etre prepares en architecture et gouvernance, mais leur implementation depend de la readiness interne et de missions explicitement autorisees.
- `042` reste en backlog avec tous ses artefacts, preuves, états et blocages conservés. La clôture terminale de `043` ne l’approuve, ne le ferme et ne l’active pas.
- MCP est un workstream transverse, sans lien d’autorisation avec la clôture de `043`.

## 7. Agent Platform & MCP

MCP n'est ni le chat, ni le modele, ni l'orchestrateur. REST reste la surface des applications classiques. MCP sert les clients IA et agents; il expose des capacites controlees, pas une seconde logique metier.

La logique metier reste dans les services Ritomer. Tout tool futur reutilise les controles tenant, RBAC, validation et audit de l'application. Aucune mutation agentique n'est permise sans autorisation, confirmation humaine explicite et audit. `043a` ne livre aucune implementation MCP, aucun serveur, aucun tool, aucun agent et aucun chat.

| Maturite | Outcome et gate |
| --- | --- |
| M0 Capability Catalog | Inventorier les capacites candidates, contrats, donnees, droits, audits, risques et proprietaires; aucun serveur n'est livre. |
| M1 MCP local read-only | Exposer localement un sous-ensemble read-only, tenant-scope et audite, apres revue du catalog et tests d'isolation. |
| M2 Copilot Ritomer read-only | Permettre une exploration evidence-first dans un copilote Ritomer sans mutation, avec sources et mode degrade. |
| M3 outils de brouillon | Preparer notes ou actions non engageantes; aucune application automatique et toute action critique reste a confirmer. |
| M4 MCP distant prive | Exposer un MCP authentifie, prive, tenant-scoped, observable et revocable pour des clients IA autorises. |
| M5 workflows agentiques controles | Orchestrer des etapes bornees avec budgets, politiques, checkpoints humains, audit et arret fail-closed. |

L'etat courant du workstream est documentaire, avant M0 livre. Les niveaux M0 a M5 sont une echelle de maturite, pas un engagement d'implementation.

## 8. Criteres de passage

| Phase | Objectif | Preuve de sortie | Gate | Risques principaux | Ce qui reste interdit |
| --- | --- | --- | --- | --- | --- |
| 0 | Alpha interne reproductible. | Clôture terminale documentée : fixtures et preuve 043a, simulation locale 043b, arrêt inconclusif 043c, R1/R2 non exécutés et PR #114 forensique. | Décision terminale enregistrée ; aucune reprise autorisée. | Faux sentiment de readiness, surinterprétation de la simulation locale. | Fiduciaire externe, observation participante réelle, donnée réelle, reprise 043c, spec suivante automatique. |
| 1 | Design Partner Readiness en préparation documentaire. | Message, cible, protocole de contact, consentement et stop procedure préparés dans une future mission explicitement autorisée. | Nouvelle autorisation avant toute activité autre que docs-only ; CPO et Security/Privacy avant collecte. | Surpromesse, collecte prématurée, mauvais design partners. | Publication, outreach, interview, collecte, accès externe, donnée réelle et runtime. |
| 2 | Auth et onboarding SaaS securises. | Parcours d'acces, tenant membership, RBAC, recuperation et audit testes. | CTO, Security/Privacy et tests cross-tenant bloquants. | Account takeover, confusion tenant, droits excessifs. | Bypass auth, role porte par une source non autoritative, acces cross-tenant non trace. |
| 3 | Environnement pilote heberge operable. | Deploiement/rollback, monitoring, incident, backup/restore, secrets et isolation prouves. | Architecture, operations, Security/Privacy et readiness pilote. | Perte de donnees, indisponibilite, cout, mauvaise region ou retention. | Production commerciale, donnee reelle ou ouverture externe sans gate de phase. |
| 4 | Pilote externe synthetique. | Sessions autorisees, observations minimisees, preuves, incidents et decision de sortie consolides. | Nouvelle decision CPO, gate fiduciaire, Security/Privacy et protocole participant. | Donnee personnelle, biais d'observation, confusion avec production. | Donnee client reelle, acte statutaire, invitation hors cohorte approuvee. |
| 5 | Hardening guide par le pilote et readiness reelle. | Problemes prioritaires corriges, securite/tenancy/ops revalidees, politique data approuvee. | CPO, CTO, Security/Privacy, legal/compliance selon donnees et Expert Board si requis. | Generalisation prematuree, dette critique, exposition de donnees. | Donnee reelle tant que son gate propre n'est pas signe; contournement audit/tenant. |
| 6 | Premiere IA metier mesuree. | Evals autoritatives, gain metier mesure, structured output, preuves, cout/latence, fallback et revue humaine. | Gates IA, CPO, CTO, Security/Privacy, provider/network et gouvernance metier. | Hallucination, fuite, cout, biais, automatisation silencieuse. | Auto-apply, decision critique autonome, provider non autorise, donnee hors whitelist. |
| 7 | V1 commerciale IA-native operable. | Plusieurs workflows centraux mesures, SLO/ops/support, securite, audit et valeur client prouves. | Readiness commerciale, operations, security, product et governance reviews. | Fiabilite a l'echelle, support, conformite, economie unitaire. | Autonomie critique, promesse statutaire non prouvee, degradation sans fallback. |

Le passage d'une phase demande toutes ses preuves et gates. Un document, une implementation locale ou un seul check vert ne suffit jamais a lui seul.

La clôture de Phase 0 est un arrêt terminal inconclusif, pas un passage de gate ni une validation complète de la phase. Les détails forensiques de PR #114 restent dans la [spec 043 terminale](../../specs/done/043-controlled-fiduciary-pilot-readiness-v1.md).

## 9. Portefeuille indicatif

Tous les sujets ci-dessous sont `CANDIDATE / NON_ENGAGED`. Ce portefeuille de futures specs candidates ne cree, ne priorise et n'autorise aucune spec :

| Candidat | Phase/workstream pressenti | Outcome a prouver avant engagement |
| --- | --- | --- |
| Site public et design partners | Phase 1 / Go-to-market | Proposition de valeur et recrutement responsables. |
| Authentification et onboarding SaaS | Phase 2 / SaaS & identite | Acces organisationnel securise et tenant-isole. |
| Environnement pilote heberge | Phase 3 / Trust & operations | Exploitation pilote recuperable et observable. |
| Pilote fiduciaire externe synthetique | Phase 4 / Produit fiduciaire | Utilisabilite externe prouvee sans donnees reelles. |
| Hardening et readiness donnees reelles | Phase 5 / Produit fiduciaire + Trust | Risques pilotes corriges et gates data explicites. |
| Premiere IA metier mesuree | Phase 6 / IA-native | Gain mesure sans perte de preuve ni controle humain. |
| Capability Catalog et MCP local read-only | Transverse / Agent Platform & MCP | Capacites IA-client exposees sans duplication metier. |
| Readiness commerciale | Phase 7 / Tous workstreams | Produit, operations, support et economie coherents. |

`042` est une spec existante en backlog, pas une nouvelle candidate. Aucune spec `044` ou suivante n'est creee ou engagee par cette roadmap. Aucun numero futur n'est reserve.

## 10. Gouvernance

Chaque future spec doit declarer explicitement :

- la phase roadmap;
- le workstream principal et les workstreams de support;
- l'outcome utilisateur ou operationnel;
- la preuve de sortie attendue;
- le gate qu'elle cherche a debloquer.

Elle doit aussi borner surface, risque, donnees, tenancy, audit, human-in-the-loop, mode degrade et stop conditions selon son contexte.

Aucune spec n'est creee automatiquement. Une phase n'est ni une branche, ni une spec, ni une promesse de livraison. Tout engagement exige une decision explicite, une spec reviewable et les gates applicables.
