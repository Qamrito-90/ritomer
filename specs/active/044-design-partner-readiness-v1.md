# 044 — Design Partner Readiness V1

## 1. Statut et classification

```text
STATUS=ACTIVE
PHASE=PHASE_1_DESIGN_PARTNER_READINESS
SURFACE=DOCS
RISK_CLASS=B
EVIDENCE_LEVEL=STANDARD

CURRENT_AUTHORIZATION=DOCS_ONLY_PREPARATION

PHASE_1_PUBLICATION_AUTHORIZED=NO
PHASE_1_OUTREACH_AUTHORIZED=NO
PHASE_1_INTERVIEW_AUTHORIZED=NO
PHASE_1_COLLECTION_AUTHORIZED=NO
PHASE_1_EXTERNAL_ACCESS_AUTHORIZED=NO
PHASE_1_REAL_DATA_AUTHORIZED=NO
PHASE_1_RUNTIME_AUTHORIZED=NO
```

Cette spec réduit une incertitude de valeur produit avant tout chantier SaaS, auth, hosting ou provider. Elle prépare un paquet documentaire unique et reviewable, n'autorise aucune activité externe et ne crée aucune capacité runtime.

## 2. Problème et raison d'agir maintenant

Le cœur déterministe et les principales surfaces d'un POC local de préparation et de revue partielle de dossiers de bouclement (closing), utilisé uniquement sur données synthétiques, sont livrés ; ce POC n'assure aucune validation professionnelle et ne produit aucun livrable final ou statutaire. Aucune douleur terrain, valeur externe ou disposition à poursuivre n'est prouvée. Construire l'accès SaaS, l'hébergement ou une IA provider avant d'avoir réduit cette incertitude augmenterait le coût sans établir que le problème prioritaire est réel.

Question de recherche non prouvée :

> Comment les professionnels ou collaborateurs fiduciaires directement impliqués préparent-ils ou revoient-ils aujourd'hui un dossier : quelles étapes, personnes ou casquettes, critères et outils utilisent-ils ; le cas échéant, où une vérification ou une reprise intervient-elle et avec quelles conséquences observables ; sinon, qu'est-ce qui rend le processus clair ? Comment interprètent-ils le walkthrough du POC local de Ritomer sur données synthétiques, limité à la préparation et à la revue partielle d'un dossier de bouclement (closing), sans validation professionnelle ni livrable final ou statutaire ?

## 3. Outcome

Produire un seul paquet documentaire cohérent qui permette une CO / Fiduciaire Domain Review exacte, puis une future décision owner sur une éventuelle activité de recherche.

L'outcome de 044 est documentaire : proposition de valeur, vérité produit, walkthrough synthétique guidé, guide d'entretien futur, grille de sélection, frontière Privacy/Security et politique de décision proposée. Il ne comprend ni publication, ni participant, ni collecte, ni compte, ni accès externe.

## 4. Population de recherche et casquettes cumulables

```text
RESEARCH_POPULATION=
professionnel ou collaborateur fiduciaire directement impliqué dans la
préparation, la coordination, la revue ou la supervision de dossiers de
bouclement de plusieurs clients PME

RESEARCH_HATS=
PREPARE
COORDINATE
REVIEW
SUPERVISE
```

- `PREPARE` : la personne qui prépare assemble et documente les éléments du dossier.
- `COORDINATE` : le responsable de dossier coordonne le dossier et prend ou organise la prochaine décision métier.
- `REVIEW` : la personne chargée de la revue examine, retourne ou accepte des éléments du flux de travail.
- `SUPERVISE` : le responsable d'équipe, de mandat ou associé, selon l'organisation déclarée, supervise le travail.

Une même personne peut cumuler plusieurs casquettes. Ces casquettes servent uniquement à la recherche : elles ne constituent ni des rôles RBAC, ni des titres protégés, ni des signatures, ni des certifications professionnelles et ne prouvent aucune validation professionnelle.

La grille distingue sans les déduire l'un de l'autre :

- `DIRECT_WORK_PARTICIPATION` : participation personnelle aux étapes décrites ;
- `WORKFLOW_CHANGE_AUTHORITY` : capacité déclarée à décider ou modifier l'organisation du flux de travail ;
- `PURCHASE_AUTHORITY` : capacité déclarée à décider ou approuver un achat.

Le premier lot proposé doit inclure au moins une perspective `PREPARE` de première main. Une personne retenue uniquement au titre de `REVIEW` ou `SUPERVISE` reste un cas de comparaison, au maximum un dans ce lot. Si aucune perspective `PREPARE` de première main n'est possible, les conclusions doivent être explicitement limitées à la coordination et à la revue, sans conclusion sur l'expérience de préparation. La taille de cabinet, le chiffre d'affaires et la maturité numérique ne sont pas utilisés comme faits de segmentation.

## 5. Hypothèses et éléments explicitement non prouvés

Hypothèse principale non prouvée : lors de la préparation ou de la revue, une personne directement impliquée peut devoir reconstruire manuellement l'état applicatif, les points bloquants et les étapes à reprendre entre balance, mapping, contrôles, pièces et revue.

| Priorité | Problème candidat | Pourquoi Ritomer peut le tester | Ce qui reste non prouvé |
| --- | --- | --- | --- |
| 1 — recommandé | Reconstruction manuelle de l'état applicatif, des points bloquants et de la reprise. | Le cockpit technique interne expose progression, points bloquants et prochaine action proposée. | Existence, fréquence, conséquence et importance externe. |
| 2 | Feuilles de travail et pièces justificatives potentiellement fragmentées. | Les rubriques relient feuilles de travail, documents et vérification. | Fragmentation réelle et coût de navigation. |
| 3 | Reprise ou perte de contexte possible lors d'un passage de relais. | Les mécanismes applicatifs sur documents et feuilles de travail sont montrables. | Reprise réelle et besoin de deux acteurs indépendants. |
| 4 | Réimport ou changement de mapping difficile à revérifier. | L'historique/diff d'import et le mapping manuel sont livrés. | Fréquence et impact des changements. |
| 5 | Absence possible d'un flux de bouclement partagé. | Ritomer structure un chemin commun dans un dossier. | Besoin terrain, adoption et avantage relatif. |

Sont explicitement non prouvés : taille de marché ; fréquence et intensité de la douleur ; volonté de payer ; disponibilité de partenaires ; budget ou autorité d'achat ; temps gagné ; réduction d'erreur ; adoption ; compréhension externe ; readiness externe ; répétabilité E2E ; sûreté pour données réelles ; validité juridique d'une rétention ou d'un consentement ; qualité d'un provider ou modèle IA ; validation professionnelle ou statutaire.

## 6. Matrice de vérité produit

```text
capability delivered
!= external readiness
!= production
!= professional/statutory validation
```

Légende normative complète des statuts de vérité produit :

- `DELIVERED_AND_PROVED` : la capacité applicative et son contrat borné sont livrés et prouvés ; ce statut ne prouve ni préparation externe ni validation professionnelle.
- `LOCAL_SYNTHETIC_ONLY` : capacité technique locale sur données synthétiques uniquement.
- `DOCUMENTED_ONLY` : cible ou conception documentée, sans comportement livré.
- `BACKLOG_OR_BLOCKED` : capacité non active et indisponible comme affirmation actuelle sur le produit.
- `NOT_STARTED` : capacité ni implémentée ni étayée par une preuve.
- `STOPPED_INCONCLUSIVE` : travail arrêté sans établir la preuve recherchée.

Limites des statuts applicatifs montrables :

- `READY` couvre uniquement les prérequis bornés actuellement implémentés, notamment la présence d'un import de balance valide et la complétude du mapping manuel ; il ne prouve pas la complétude métier, substantielle ou documentaire du dossier.
- `VERIFIED` est une décision applicative de workflow ; il ne prouve ni l'authenticité ni la suffisance d'une pièce justificative.
- `REVIEWED` est un statut applicatif de workflow ; il ne prouve ni qu'une revue humaine professionnelle a été accomplie ni que les documents sont complets. Une feuille de travail peut être `REVIEWED` sans document.
- Les rôles techniques internes `maker/reviewer`, le rôle technique `REVIEWER` et toute décision de revue simulée ne prouvent ni deux humains indépendants, ni séparation des fonctions, ni signature, ni validation professionnelle.

| Capacité | Statut | Source exacte | Ce qui peut être affirmé | Ce qui ne doit pas être affirmé | Éligibilité walkthrough |
| --- | --- | --- | --- | --- | --- |
| Dossier de bouclement (`closing`, nom technique interne) | `DELIVERED_AND_PROVED` | `specs/done/002-core-identity-tenancy-closing.md:6`; `contracts/openapi/closing-folders-api.yaml:6` | Dossiers tenant-scoped créables, listables, consultables, modifiables et archivables. | SaaS externe, onboarding durable ou auth production. | `YES_LOCAL_SYNTHETIC` |
| Import et historique de balance | `DELIVERED_AND_PROVED` | `specs/done/003-import-balance-v1.md:3`; `specs/done/034-pilot-balance-import-history-diff-ui-v1.md:68`; `contracts/openapi/import-balance-api.yaml:6` | Import CSV non destructif, versions, historique et diff N/N-1 read-only. | Compatibilité universelle, rollback ou gain de temps prouvé. | `YES_LOCAL_SYNTHETIC` |
| Mapping manuel | `DELIVERED_AND_PROVED` | `specs/done/005-manual-mapping-v1.md:3`; `contracts/openapi/manual-mapping-api.yaml:6` | Mapping unitaire tenant-scoped ; le mapping manuel reste l'autorité métier. | Automapping autonome, bulk auto-apply ou mapping certifié. | `YES_LOCAL_SYNTHETIC` |
| Contrôles/readiness | `DELIVERED_AND_PROVED` | `specs/done/006-controls-v1.md:3`; `contracts/openapi/controls-api.yaml:6` | Read-model déterministe `READY/BLOCKED`, points bloquants et prochaine action proposée, borné à l'import valide et à la complétude du mapping manuel. | Readiness des preuves, de la production, du CO ou des données réelles ; complétude métier, substantielle ou documentaire. | Oui, portée étroite expliquée |
| Prévisualisations financières | `DELIVERED_AND_PROVED` | `specs/done/007-financial-summary-v1.md:3`; `specs/done/009-financial-statements-structured-v1.md:3`; `contracts/openapi/financial-summary-api.yaml:6`; `contracts/openapi/financial-statements-structured-api.yaml:6` | Prévisualisations dérivées, read-only, tenant-scoped et non statutaires. | Comptes finaux, présentation CO complète ou export final. | `YES_LOCAL_SYNTHETIC` avec limites visibles |
| Feuilles de travail (`workpapers`, nom technique interne) | `DELIVERED_AND_PROVED` | `specs/done/010-workpapers-v1.md:3`; `contracts/openapi/workpapers-api.yaml:6` | Feuilles de travail persistantes anchor-driven, workflow technique interne `maker/checker` minimal, statuts et audit. Une feuille peut être `REVIEWED` sans document. | Génération automatique, complétude documentaire ou validation professionnelle/statutaire. | Oui, données synthétiques et gates courants |
| Documents et vérification | `DELIVERED_AND_PROVED` | `specs/done/011-document-storage-and-evidence-files-v1.md:3`; `specs/done/012-evidence-review-and-verification-v1.md:25`; `contracts/openapi/documents-api.yaml:6` | Documents immuables, stockage privé, download backend-only, décision du rôle technique interne `REVIEWER` et résumé de vérification. `VERIFIED` reste une décision applicative de workflow. | Signed URL publique, versioning, authenticité ou suffisance prouvée, ou sûreté pour données client réelles. | Oui, fichiers synthétiques seulement |
| Mécanismes locaux de décision préparant une revue humaine | `DELIVERED_AND_PROVED` | `specs/done/012-evidence-review-and-verification-v1.md:54`; `specs/done/029-pilot-closing-workflow-e2e-confidence-hardening-v1.md:89`; `specs/done/030-ia-mapping-assiste-suggestion-review-v1.md:149` | Mécanismes applicatifs explicites de décision sur documents, feuilles de travail et suggestions, exerçables localement sur données synthétiques. | Revue humaine professionnelle accomplie, deux humains indépendants, séparation réelle des fonctions, signature ou validation professionnelle. | Simulation par le même opérateur de rôles techniques uniquement |
| `Audit-ready export pack` — nom technique interne uniquement | `DELIVERED_AND_PROVED` | `specs/done/013-exports-audit-ready-v1.md:22`; `contracts/openapi/exports-api.yaml:6` | Archive ZIP privée, immuable, déterministe et idempotente. Toute formulation future est : « archive de transmission structurée et traçable des éléments disponibles et de leurs statuts de revue, non finale, non certifiée et soumise à revue humaine ». Elle peut contenir zéro feuille de travail ou zéro document et inclure des documents `UNVERIFIED`, `VERIFIED` ou `REJECTED`. | Elle n'est ni complète, ni certifiée, ni prête pour l'auditeur ou le CO, ni statutaire ou finale et ne prouve aucune validation professionnelle. | Oui, uniquement avec la formulation future et toutes ces limites visibles |
| Prévisualisation non statutaire d'annexe opérationnelle, préparée pour revue humaine | `DELIVERED_AND_PROVED` | `specs/done/027-annexe-minimale-v1.md:53`; `contracts/openapi/minimal-annex-api.yaml:6` | Read-model déterministe, read-only, `isStatutory=false`, `requiresHumanReview=true`. Son statut applicatif `READY` ne prouve ni complétude substantielle ni complétude documentaire, peut coexister avec zéro document et peut conserver un document `REJECTED` comme trace avec un avertissement. | Annexe officielle, finale ou statutaire, PDF final, certification, validation professionnelle ou rédaction IA. | Oui, avec toutes ces limites visibles |
| Cockpit/frontend | `DELIVERED_AND_PROVED` | `specs/done/038-local-demo-closing-workbench-ux-cockpit-v1.md:13`; `specs/done/041-internal-poc-blockers-ux-readiness-v1.md:17` | Espace de travail technique interne local avec tenant, dossier, statut, prochaine action proposée, points bloquants, progression et smoke interne documenté. | Frontend SaaS externe, expérience finale ou validation par design partners. | `YES_LOCAL_SYNTHETIC` |
| Harness 043b | `LOCAL_SYNTHETIC_ONLY` | `specs/done/043-controlled-fiduciary-pilot-readiness-v1.md:242`; `runbooks/local-dev.md:20` | Plomberie loopback mono-opérateur/deux rôles validant le comportement RBAC backend avec identités synthétiques. | Bouclement complet, deux humains, séparation réelle, auth production ou readiness externe. | Plomberie interne seulement |
| Assistance mapping 030 | `DELIVERED_AND_PROVED` | `specs/done/030-ia-mapping-assiste-suggestion-review-v1.md:82`; `contracts/openapi/mapping-suggestions-api.yaml:8` | Suggestions structurées no-provider, preuves visibles et mécanismes de décisions unitaires soumises à action humaine ; mapping manuel autoritaire. | Provider/modèle réel, appel réseau, qualité modèle, auto-apply ou bulk apply. | Facultatif et explicitement no-provider |
| POC 042 `mapping-suggestion-v2` | `BACKLOG_OR_BLOCKED` | `specs/backlog/042-controlled-ai-mapping-runtime-pilot-v1.md:3`; `contracts/openapi/mapping-suggestions-v2-api.yaml:8` | Un POC partiel local synthétique existe : moteur offline et endpoint/UI default-off sur allowlist. | 042 achevée, golden set autoritatif, provider réel ou décision v2. | Exclu par défaut |
| Auth/tenancy de démonstration | `LOCAL_SYNTHETIC_ONLY` | `specs/done/036-local-integrated-demo-real-backend-seed-v1.md:17`; `specs/done/037-local-integrated-demo-manual-business-smoke-v1.md:35` | JWT backend local, memberships PostgreSQL, tenant actif et mauvais tenant rejeté. | OIDC/SSO/MFA, onboarding SaaS, session durable, auth production ou accès externe. | Plomberie interne seulement |
| Cible Google Cloud | `DOCUMENTED_ONLY` | `docs/adr/0006-postgresql-cloud-sql-no-docker-v1.md:27`; `docs/product/product-roadmap.md:23` | Cible Cloud Run depuis le code source et Cloud SQL PostgreSQL 17 en `europe-west6`. | Environnement déployé, exploité, restaurable ou disponible. | Non |
| Hébergement, production et données réelles | `NOT_STARTED` | `docs/product/product-roadmap.md:27`; `docs/product/product-roadmap.md:80` | Phases futures distinctes et gouvernées. | Disponibilité, sûreté, exploitation ou autorisation actuelle. | Non |
| Provider IA actif | `BACKLOG_OR_BLOCKED` | `specs/done/030-ia-mapping-assiste-suggestion-review-v1.md:112`; `specs/backlog/042-controlled-ai-mapping-runtime-pilot-v1.md:55` | Provider candidat seulement ; réseau, adapter et runtime restent bloqués. | Provider actif/approuvé, appel réussi ou gain IA mesuré. | Non |
| Readiness externe / 043c | `STOPPED_INCONCLUSIVE` | `specs/done/043-controlled-fiduciary-pilot-readiness-v1.md:1` | 043a livré ; 043b local validé ; 043c arrêté ; R1/R2 non exécutés. | Phase 0 réussie, external readiness, reprise de 043c ou réutilisation de PR 114. | Non |

## 7. Proposition de valeur, bénéfices et wording

Phrase courte proposée, non validée :

> Ritomer est aujourd'hui un POC local sous forme d'espace de travail de préparation et de revue partielle de dossiers de bouclement. Sur données synthétiques, il relie import de balance, mapping, contrôles techniques bornés, prévisualisations non statutaires, feuilles de travail, pièces justificatives et statuts de revue. Il ne couvre pas un bouclement complet, ne valide pas professionnellement le dossier et ne produit aucun livrable final ou statutaire.

Version 30 secondes :

> Ritomer est aujourd'hui un POC local de préparation et de revue partielle de dossiers de bouclement sur données synthétiques. Il rend visibles l'état applicatif, les points bloquants détectés par Ritomer dans le périmètre affiché et la prochaine action proposée dans le périmètre affiché, à confirmer par la personne responsable, puis relie feuilles de travail, pièces justificatives et statuts de revue. Il ne couvre pas un bouclement complet, ne valide pas professionnellement le dossier et ne produit aucun livrable final ou statutaire.

Bénéfices à tester, sans les présenter comme acquis :

1. Dans un POC local sur données synthétiques, limité à la préparation et à la revue partielle d'un dossier de bouclement, sans validation professionnelle ni livrable final ou statutaire, tester si la lecture de l'état applicatif, des points bloquants détectés par Ritomer dans le périmètre affiché et de la prochaine action proposée dans le périmètre affiché, à confirmer par la personne responsable, facilite la reprise du dossier.
2. Dans un POC local sur données synthétiques, limité à la préparation et à la revue partielle d'un dossier de bouclement, sans validation professionnelle ni livrable final ou statutaire, tester si le lien entre rubriques, feuilles de travail, pièces justificatives et statuts de revue rend le contexte plus lisible.
3. Dans un POC local sur données synthétiques, limité à la préparation et à la revue partielle d'un dossier de bouclement, sans validation professionnelle ni livrable final ou statutaire, tester l'utilité d'une archive de transmission structurée et traçable des éléments disponibles et de leurs statuts de revue, non finale, non certifiée et soumise à revue humaine. Cette archive peut contenir zéro feuille de travail ou zéro document, inclure des documents `UNVERIFIED`, `VERIFIED` ou `REJECTED`, n'est ni complète, ni certifiée, ni prête pour l'auditeur ou le CO, ni statutaire ou finale, et ne prouve aucune validation professionnelle. La prévisualisation non statutaire d'annexe opérationnelle, préparée pour revue humaine, peut afficher `READY` avec zéro document ou conserver un document `REJECTED` comme trace avec un avertissement ; ce statut ne prouve ni complétude substantielle ni complétude documentaire.

Limites autonomes : Ritomer est un POC local sur données synthétiques, limité à la préparation et à la revue partielle d'un dossier de bouclement ; il ne valide pas professionnellement le dossier et ne produit aucun livrable final ou statutaire. Aucun accès externe, onboarding SaaS ou provider IA réel n'est disponible ; aucune promesse de temps gagné, de réduction d'erreur ou de conformité n'est faite ; toute revue humaine nécessaire reste à accomplir.

```text
MUST_NOT_CLAIM
AI autonomous
fully automated closing
full or complete closing coverage
closing complet
official annual accounts
CO-ready
statutory-ready
guaranteed compliant
production-ready
ready for real client data
human review no longer required
```

### Draft de landing future — texte non publié

```text
PUBLICATION_AUTHORIZED=NO
DOMAIN_OR_HOSTING_CHANGE=NO
FRONTEND_IMPLEMENTATION=NO
ANALYTICS=NO
FORM=NO
COOKIE=NO
```

- Titre : « POC local sur données synthétiques : préparation et revue partielle d'un dossier de bouclement, sans validation professionnelle ni livrable final ou statutaire. »
- Sous-titre : « Ritomer est aujourd'hui un POC local sous forme d'espace de travail de préparation et de revue partielle de dossiers de bouclement. Sur données synthétiques, il relie import de balance, mapping, contrôles techniques bornés, prévisualisations non statutaires, feuilles de travail, pièces justificatives et statuts de revue. Il ne couvre pas un bouclement complet, ne valide pas professionnellement le dossier et ne produit aucun livrable final ou statutaire. »
- Problème : « Dans une future recherche sur un POC local utilisant uniquement des données synthétiques et limité à la préparation et à la revue partielle d'un dossier de bouclement, sans validation professionnelle ni livrable final ou statutaire, Ritomer cherchera à vérifier si la dispersion de l'état applicatif, des justificatifs et des décisions du flux de travail rend moins claire l'étape suivante. »
- Bénéfices : « Dans ce POC local sur données synthétiques, limité à la préparation et à la revue partielle d'un dossier de bouclement, sans validation professionnelle ni livrable final ou statutaire : tester la lisibilité de l'état applicatif, des points bloquants détectés et de la prochaine action proposée à confirmer ; relier rubriques, feuilles de travail, pièces et statuts de revue ; présenter une archive de transmission structurée et traçable des éléments disponibles et de leurs statuts de revue, non finale, non certifiée et soumise à revue humaine. Cette archive peut contenir zéro feuille de travail ou zéro document, inclure des documents `UNVERIFIED`, `VERIFIED` ou `REJECTED`, n'est ni complète, ni certifiée, ni prête pour l'auditeur ou le CO, ni statutaire ou finale et ne prouve aucune validation professionnelle. La prévisualisation non statutaire d'annexe opérationnelle est préparée pour revue humaine ; son statut applicatif `READY` ne prouve ni complétude substantielle ni complétude documentaire, peut coexister avec zéro document et peut conserver un document `REJECTED` comme trace avec un avertissement. »
- Preuve honnête : « La seule preuve actuelle porte sur un POC local de préparation et de revue partielle de dossiers de bouclement, utilisé sur données synthétiques. Elle ne prouve ni usage externe ni répétabilité complète, n'apporte aucune validation professionnelle et ne produit aucun livrable final ou statutaire. »
- Limites : « Ce POC local utilise uniquement des données synthétiques et couvre seulement une préparation et une revue partielles d'un dossier de bouclement ; il n'apporte aucune validation professionnelle, aucun livrable final ou statutaire, aucun accès externe, aucune donnée client et aucun provider IA actif. »
- CTA projeté et inactif jusqu'à une autorisation distincte : « Recherche future sur la préparation et la revue partielle d'un dossier de bouclement : échange autour d'un POC local sur données synthétiques uniquement, sans pilote, session ouverte, accès produit ni collecte de document, sans validation professionnelle et sans livrable final ou statutaire. »

Aucun logo, témoignage, nombre de partenaires, claim de gain de temps ou de conformité, formulaire, analytics ou cookie n'est préparé.

## 8. Walkthrough synthétique guidé

```text
DEMO_TYPE=GUIDED_LOCAL_SYNTHETIC_WALKTHROUGH
DEMO_DURATION_HYPOTHESIS=8_TO_10_MINUTES
DEMO_OPERATOR=RITOMER_INTERNAL
PARTICIPANT_ACCOUNT=NO
EXTERNAL_ACCESS=NO
DATA=SYNTHETIC_ONLY
```

Ce walkthrough porte uniquement sur un POC local sur données synthétiques, limité à la préparation et à la revue partielle d'un dossier de bouclement ; il n'apporte aucune validation professionnelle ni livrable final ou statutaire et ne prouve ni un run E2E reproductible ni une readiness externe. Les statuts `READY`, `VERIFIED` et `REVIEWED` y conservent exclusivement les sens bornés définis dans la matrice de vérité produit ; aucune étape n'établit une revue humaine professionnelle accomplie.

Persona fictif : personne cumulant les casquettes de recherche `PREPARE` et `COORDINATE` pour le bouclement d'un exercice comptable 2025 entièrement fictif ; ces casquettes ne présument aucun titre professionnel.

1. Ouvrir le dossier et annoncer explicitement qu'il s'agit d'un POC local sur données synthétiques, limité à la préparation et à la revue partielle d'un dossier de bouclement, sans validation professionnelle ni livrable final ou statutaire.
2. Lire dans le cockpit technique interne le statut, la progression, le point bloquant détecté par Ritomer dans le périmètre affiché et la prochaine action proposée dans le périmètre affiché, à confirmer par la personne responsable.
3. Montrer la version d'import et le diff avec l'import précédent.
4. Montrer le mapping manuel ; une suggestion 030 no-provider peut être montrée séparément et facultativement.
5. Lire `controls.readiness` et préciser que `READY` constate seulement la présence d'un import valide et la complétude du mapping manuel, puis montrer les prévisualisations non statutaires.
6. Ouvrir une feuille de travail (workpaper), une pièce synthétique et son statut de vérification ; préciser que `VERIFIED` est une décision applicative de workflow qui ne prouve ni l'authenticité ni la suffisance de la pièce.
7. Faire simuler par le même opérateur interne une décision via le rôle technique interne `REVIEWER`. Si la feuille de travail prend le statut `REVIEWED`, préciser qu'elle peut ne comporter aucun document et que ce statut ne prouve ni complétude documentaire, ni revue humaine professionnelle accomplie, ni humains indépendants, ni séparation des fonctions, ni signature, ni validation professionnelle.
8. Montrer l'archive de transmission structurée et traçable des éléments disponibles et de leurs statuts de revue, non finale, non certifiée et soumise à revue humaine. Expliquer qu'elle peut contenir zéro feuille de travail ou zéro document, inclure des documents `UNVERIFIED`, `VERIFIED` ou `REJECTED`, n'est ni complète, ni certifiée, ni prête pour l'auditeur ou le CO, ni statutaire ou finale, et ne prouve aucune validation professionnelle. Montrer ensuite la prévisualisation non statutaire d'annexe opérationnelle, préparée pour revue humaine ; expliquer qu'un statut applicatif `READY` ne prouve ni complétude substantielle ni complétude documentaire, peut coexister avec zéro document et peut conserver un document `REJECTED` comme trace avec un avertissement.
9. Demander ce que la personne vérifierait ensuite et ce qui manquerait pour faire confiance.

Sont exclus : 043c, R1, R2, l'orchestrateur rejeté, provider ou modèle réel, auth production, hosting, données/documents clients, comptes ou annexe officiels. Le harness 043b n'est que de la plomberie locale ; les fixtures 043 restent `INTERNAL_ONLY` et non éligibles à une exposition externe.

Le walkthrough futur s'arrête si une surface requise est indisponible ou incohérente, si la provenance synthétique ne peut être prouvée, si une donnée réelle ou un secret apparaît, si un appel provider devient nécessaire, si un wording statutaire/de production apparaît, si une séparation réelle des fonctions est suggérée ou si 043c devrait être repris.

## 9. Guide d'entretien futur

Conversation de recherche proposée : 30 à 40 minutes, dont 8 à 10 minutes maximum de walkthrough. Ces durées restent des hypothèses. Séquence : introduction non commerciale, notice de description limitée au processus et droit de sauter toute question ou d'arrêter ; contexte de l'implication directe ; description abstraite des étapes, actions, personnes ou casquettes, critères et outils d'un travail récent de préparation ou de revue ; vérification supplémentaire le cas échéant ou facteurs de clarté sinon ; reprise ou retour le cas échéant ou facteurs l'ayant évité sinon ; conséquences observables et estimation facultative ou `INCONNU` ; walkthrough ; réaction et conditions de confiance ; clôture sans promesse et consentement séparé à un éventuel suivi.

Introduction obligatoire future, non commerciale :

> Cette conversation relève uniquement d'une recherche. Aucune offre, aucun pilote, aucune session produit ni aucun accès n'est ouvert, et vous n'avez aucune obligation de répondre, de poursuivre ou d'accepter un suivi.

Notice obligatoire à lire avant la première question future :

> Vous pouvez sauter toute question ou arrêter à tout moment. Décrivez uniquement des étapes, actions, rôles et critères de travail de manière abstraite. Ne partagez aucune caractéristique directe ou indirecte d'un client, d'une personne, d'une opération ou d'une situation, notamment secteur, localisation, date, transaction, événement inhabituel ou circonstance identifiable.

| Type | Question, prompt ou signal |
| --- | --- |
| `RESEARCH_QUESTION` | Comment les personnes directement impliquées décrivent-elles les étapes, les personnes ou casquettes, les critères et les outils utilisés pour déterminer l'état d'un dossier ? |
| `RESEARCH_QUESTION` | Le cas échéant, à quels moments une information ou une étape demande-t-elle une vérification supplémentaire ou une action est-elle reprise ou retournée ; sinon, qu'est-ce qui rend le processus clair ? |
| `RESEARCH_QUESTION` | Quelles conséquences observables, s'il y en a, et quelles estimations de fréquence ou d'effort — ou `INCONNU` — sont rapportées ? |
| `INTERVIEW_QUESTION` | « Lors d'un travail récent de préparation ou de revue, quelles étapes avez-vous suivies et quels outils ou supports avez-vous utilisés pour déterminer l'état du dossier ? Ne décrivez aucun client ou situation. » |
| `INTERVIEW_QUESTION` | « Quelles personnes ou casquettes intervenaient, dans quel ordre et selon quels critères ? Utilisez les termes de votre cabinet. » |
| `INTERVIEW_QUESTION` | « Le cas échéant, à quel moment une information, un statut ou l'étape suivante a demandé une vérification supplémentaire ? Sinon, qu'est-ce qui a rendu la situation claire ? » |
| `INTERVIEW_QUESTION` | « Le cas échéant, quelles actions ont dû être reprises ou retournées ? Sinon, qu'est-ce qui a évité une reprise ? » |
| `INTERVIEW_QUESTION` | « Quelles conséquences observables cela a-t-il eues, s'il y en a eu ? » |
| `INTERVIEW_QUESTION` | « Si vous pouvez l'estimer, à quelle fréquence l'événement décrit se produit-il ou quel effort représente-t-il ? `INCONNU` est une réponse valide. » |
| `DEMO_PROMPT` | « Dites à voix haute ce que vous pensez être l'état du dossier. » |
| `DEMO_PROMPT` | « Que vérifieriez-vous avant de faire confiance à ce statut ? » |
| `DEMO_PROMPT` | « Quelle partie correspond ou ne correspond pas à votre processus ? » |
| `DEMO_PROMPT` | « Qu'est-ce qui devrait être vrai pour accepter une autre session synthétique ? » |
| `DECISION_SIGNAL` | Description limitée au processus d'un travail récent : étapes, actions, personnes ou casquettes, critères et outils, sans information identifiable. |
| `DECISION_SIGNAL` | Besoin de vérification ou de reprise — ou absence de besoin — rapporté sans induction dans plusieurs descriptions indépendantes. |
| `DECISION_SIGNAL` | Conséquence observable distinguée de l'estimation du participant ; fréquence ou effort peut rester `INCONNU`. |
| `DECISION_SIGNAL` | Informations montrées pendant le walkthrough correctement interprétées sans aide orientée. |
| `DECISION_SIGNAL` | Opt-in explicite vers une seconde session séparément autorisée. |
| `DECISION_SIGNAL` | Absence de description limitée au processus ou nécessité de données réelles ou identifiables conservée comme contre-signal. |

Clôture obligatoire future, non commerciale :

> La recherche s'arrête ici. Aucune offre, aucun pilote, aucune session produit ni aucun accès n'est ouvert, et aucun suivi n'est obligatoire. Un éventuel contact ultérieur exige votre accord séparé et une nouvelle autorisation de Ritomer.

Sont interdits : tout identifiant ou caractéristique directe ou indirecte d'un client, d'une personne, d'une opération ou d'une situation — notamment nom, secteur, localisation, date, transaction, événement inhabituel ou circonstance identifiable — ainsi que balance, montant, donnée financière, document, fichier, capture, upload, accès à un environnement, promesse de pilote, collecte implicite et enregistrement audio/vidéo sans protocole séparé. La question « Utiliseriez-vous Ritomer ? » ne constitue pas une preuve.

## 10. Grille de sélection des design partners

Critères obligatoires : relever de la population de recherche déclarée ; déclarer au moins une casquette `PREPARE`, `COORDINATE`, `REVIEW` ou `SUPERVISE` ; avoir participé directement aux étapes d'un travail récent de préparation ou de revue et pouvoir en décrire abstraitement les étapes, actions, personnes ou casquettes, critères et outils sans identifiant ni caractéristique directe ou indirecte d'un client, d'une personne, d'une opération ou d'une situation ; accepter `SYNTHETIC_ONLY` sans compte, upload ni accès externe ; accepter une conversation volontaire ; fournir un feedback critique et concret.

La grille consigne séparément les attributs suivants, sans en déduire un autre :

| Champ | Valeurs admises | Usage de sélection |
| --- | --- | --- |
| Casquettes de recherche | une ou plusieurs parmi `PREPARE`, `COORDINATE`, `REVIEW`, `SUPERVISE` | Décrire l'activité exercée, jamais présumer un titre, une certification ou un rôle RBAC. |
| `DIRECT_WORK_PARTICIPATION` | `YES`, `NO`, `INCONNU` | `YES` est requis pour que les étapes décrites servent de preuve. |
| `WORKFLOW_CHANGE_AUTHORITY` | `YES`, `NO`, `INCONNU` | Attribut déclaré distinct, non requis pour une perspective de préparation de première main. |
| `PURCHASE_AUTHORITY` | `YES`, `NO`, `INCONNU` | `NOT_REQUIRED_NOT_INFERRED_NOT_VALIDATED` pour cette recherche. |

Composition du premier lot proposé : au moins une perspective `PREPARE` de première main ; au maximum une personne retenue uniquement comme comparaison `REVIEW` ou `SUPERVISE`. À défaut de perspective `PREPARE`, toute conclusion est limitée à la coordination et à la revue.

Critères favorables : cumul de plusieurs casquettes ; passages de relais réguliers ; expérience de plusieurs processus sans décrire aucun dossier, client, opération ni circonstance ; possibilité d'impliquer ultérieurement, sous autorisation séparée, une personne disposant de `WORKFLOW_CHANGE_AUTHORITY`, de `PURCHASE_AUTHORITY` ou d'une responsabilité Security/Privacy ; volonté explicite d'une seconde session synthétique.

Motifs d'exclusion : besoin immédiat de données ou documents réels ; environnement hébergé ou compte externe requis ; attente d'un livrable officiel/final ou d'une garantie de conformité ; intérêt limité à une IA autonome ; aucune description abstraite d'un travail récent ; participation conditionnée par une capacité non livrée ; conflit empêchant un feedback franc.

Interaction future éventuelle : une conversation de recherche et, le cas échéant, une seconde session synthétique uniquement sous nouvelle autorisation ; aucune offre ou session n'est actuellement ouverte, aucun engagement de pilote, d'achat ou de production n'est demandé, et aucune obligation de suivi n'existe.

Dans la phase actuelle de préparation documentaire 044, aucune coordonnée de participant n'est collectée, stockée ou utilisée.

Informations futures candidates, non autorisées à ce stade et soumises à un gate Security/Privacy réussi puis à une autorisation owner distincte et exacte : casquette de recherche et implication directe ; critères d'éligibilité grossiers ; une seule coordonnée de planification choisie par le participant et séparée des notes ; portée du consentement ; préférence explicite de suivi. Cette liste ne constitue pas une allowlist opérationnelle. 044 ne définit aucun identifiant participant ni aucun mécanisme de rattachement entre coordonnée, consentement et notes.

Dans la phase actuelle de préparation documentaire 044, toute information de participant et toute coordonnée sont interdites, tout comme tout identifiant ou contexte direct ou indirect relatif à un client, à une autre personne, à une opération ou à une situation, notamment nom, secteur, localisation, date, transaction, événement inhabituel ou circonstance identifiable ; balance, montants, documents, fichiers, captures, credentials, compte produit et données financières restent également interdits.

Dans toute future activité externe, seules les informations expressément approuvées par un gate Security/Privacy réussi et couvertes par une autorisation owner distincte et exacte peuvent être collectées. L'unique donnée de contact susceptible d'être envisagée est la coordonnée de planification choisie par le participant et déjà bornée par N-01. 044 n'autorise aucun identifiant participant, code stable inter-session ni répertoire réutilisable. Tout identifiant ou contexte direct ou indirect d'un client, d'une opération ou d'une situation, ainsi que toute information de participant hors de la future allowlist approuvée, restent interdits. Tout CRM, liste de contacts ou de prospects, donnée de contact en masse, répertoire réutilisable de participants, compte produit ou coordonnée sans lien avec cette planification restent interdits. Tant que le gate futur et l'autorisation owner exacte n'existent pas, la liste candidate est indisponible pour toute collecte.

Aucune personne ni entreprise n'a été recherchée ou listée par 044.

## 11. Privacy, Security, consentement et non-collecte

```text
DATA_CLASS=NO_CLIENT_DATA
DEMO_DATA=SYNTHETIC_ONLY
ACCOUNT_REQUIRED=NO
UPLOAD_REQUIRED=NO
EXTERNAL_ACCESS=NO
RECORDING=NO_BY_DEFAULT

CURRENT_044_MODE=DOCS_ONLY_PREPARATION
CURRENT_PARTICIPANT_COORDINATE_COLLECTION=NO
CURRENT_EXTERNAL_ACTIVITY=NO

FUTURE_EXTERNAL_RESEARCH=NOT_AUTHORIZED
FUTURE_SINGLE_SCHEDULING_COORDINATE=
REQUIRES_SUCCESSFUL_SECURITY_PRIVACY_GATE_AND_SEPARATE_EXACT_OWNER_AUTHORIZATION

FUTURE_PARTICIPANT_IDENTIFIER_DEFINED=NO
FUTURE_CONSENT_EVIDENCE_MODEL_DEFINED=NO
FUTURE_CONSENT_LINKAGE_DEFINED=NO
FUTURE_PARTICIPANT_REGISTRY_AUTHORIZED=NO

FUTURE_COORDINATE_PURPOSE_APPROVED=NO
FUTURE_COORDINATE_STORAGE_APPROVED=NO
FUTURE_COORDINATE_ACCESS_APPROVED=NO
FUTURE_COORDINATE_RETENTION_APPROVED=NO
FUTURE_COORDINATE_DELETION_APPROVED=NO
```

Dans une future activité externe distinctement autorisée, une seule coordonnée de planification choisie par le participant pourrait être collectée uniquement après un gate Security/Privacy réussi et une autorisation owner distincte couvrant exactement l'activité externe et cette collecte. Sa finalité serait limitée à la planification et au suivi explicitement consenti. Son stockage séparé des notes, ses accès, sa rétention et sa suppression devraient être approuvés avant toute collecte.

Ces conditions et approbations futures sont non satisfaites et bloquantes ; elles ne valent aucune permission actuelle.

044 prépare seulement les questions à résoudre avant toute activité externe : finalité exacte ; minimisation ; rétention `NON_DETERMINED` ; personnes autorisées ; stockage approuvé, juridiction et ACL ; suppression ; retrait ; enregistrement séparé ; procédure incident/stop ; preuve future de consentement.

Procédure incident/stop à soumettre au gate futur : interrompre immédiatement la conversation dès qu'une divulgation directe ou indirecte commence ; ne pas l'enregistrer, la copier, la résumer ni la conserver ; demander une reformulation abstraite limitée aux étapes, actions, rôles et critères du processus ; arrêter la conversation si une reformulation sûre n'est pas possible ; si un élément a malgré tout été capturé, appliquer la future procédure approuvée de suppression et d'incident.

Avant toute collecte, le gate Security/Privacy doit déterminer si une preuve de consentement doit être conservée et, le cas échéant, définir son contenu minimal, son éventuel mécanisme de rattachement, sa custody, ses accès, sa rétention, sa suppression et le traitement du retrait. 044 ne prescrit ni identifiant pseudonyme, ni schéma de consentement, ni formulaire, ni registre, ni record réel.

> Ne partagez aucun identifiant ni aucune caractéristique directe ou indirecte d'un client, d'une personne, d'une opération ou d'une situation, notamment nom, secteur, localisation, date, transaction, événement inhabituel ou circonstance identifiable ; aucun montant, fichier, document, capture d'écran ou information financière. Ritomer ne demande aucun accès à votre environnement et la démonstration utilise uniquement des données synthétiques.

Aucun formulaire, CRM, table ou fichier participant, compte, note réelle, coordonnée réelle ou consentement réel n'est créé par 044. Security/Privacy devient bloquant avant le premier outreach, invitation, entretien, enregistrement, stockage de coordonnées/notes, accès externe, formulaire, analytics ou cookie.

## 12. Signaux qualitatifs et seuils proposés

```text
QUALIFIED_CONVERSATIONS_PROPOSAL=5
PREPARE_OR_COORDINATE_MINIMUM=4
FIRST_HAND_PREPARE_REQUIREMENT=AT_LEAST_1_OR_CLAIMS_LIMITED_TO_COORDINATION_AND_REVIEW
REVIEW_OR_SUPERVISE_ONLY_COMPARISON_MAXIMUM=1
STATISTICAL_VALIDATION=NO
MARKET_FACT=NO
```

Le lot et les seuils `5/4/1` sont une politique de recherche proposée, non une validation statistique et non un fait de marché. Les futures unités de codage sont : description abstraite limitée au processus d'un travail récent ; étapes et actions ; personnes ou casquettes, critères et vocabulaire dans les termes du participant ; outils ou supports utilisés ; vérification supplémentaire le cas échéant ou facteurs de clarté sinon ; reprise ou retour le cas échéant ou facteurs l'ayant évité sinon ; conséquence observable ou aucune ; estimation de fréquence ou d'effort attribuée au participant, ou `INCONNU` ; compréhension du walkthrough ; besoin manquant ; opt-in ; point bloquant métier, Privacy/Security ou adoption.

Signaux favorables : besoin de vérification ou de reprise décrit sans induction à partir d'étapes et actions ; conséquence observable ; lecture correcte des informations du walkthrough ; condition de confiance formulée ; opt-in explicite et séparé. Une estimation `INCONNU` reste valide et n'est imputée à aucun signal.

Contre-signaux : processus décrit comme clair sans besoin de vérification ou de reprise ; absence de conséquence observable ; absence de description abstraite d'un travail récent ; intérêt poli sans comportement passé ; confusion persistante ; valeur concentrée sur une capacité non livrée ; nécessité de données réelles, hosting, livrable statutaire ou autonomie IA.

## 13. Décisions proposées `CONTINUE / SIMPLIFY / REPOSITION / STOP`

| Décision | Signal qualitatif | Seuil quantitatif proposé |
| --- | --- | --- |
| `CONTINUE` | Un besoin matériel de vérification ou de reprise ressort sans induction de descriptions limitées au processus, avec actions et conséquences observables ; walkthrough relié au processus ; suivi explicite. | Au moins 3 descriptions directes étayent ce besoin, 3 conséquences/actions correspondantes, 3 compréhensions correctes, 2 opt-ins synthétiques et aucun point bloquant critique ; toute conclusion sur la préparation exige au moins 1 perspective `PREPARE` de première main, faute de quoi elle reste limitée à la coordination et à la revue. |
| `SIMPLIFY` | Un besoin existe, mais la valeur se concentre sur un sous-problème commun. | Au moins 3 descriptions étayent ce besoin et au moins 2 concentrent la valeur sur le même périmètre. |
| `REPOSITION` | Le besoin principal est peu étayé, mais un autre besoin ou une autre casquette ressort sans induction de descriptions indépendantes. | Au moins 3 descriptions convergent sur l'alternative ; un nouveau lot borné est obligatoire. |
| `STOP` | Aucun besoin matériel n'est étayé, aucun suivi n'est souhaité, ou la valeur dépend de capacités interdites. | Au plus 1 description étaye un besoin matériel ; aucun opt-in ; ou besoin systématique de données réelles, hosting, livrable statutaire ou autonomie IA. |

Les seuils peuvent produire des signaux concurrents ; ils n'inventent aucun tie-break automatique. Chaque décision exige une future décision owner.

044 ne peut jamais autoriser à lui seul auth/onboarding, hosting, collecte structurée, site public, provider IA ou données réelles. Une construction supplémentaire exige au minimum la décision de recherche applicable et ses gates propres ; les gates 042 restent intégralement requis pour tout provider.

## 14. Scope documentaire strict

- créer une seule spec active docs-only 044 ;
- mettre à jour le statut de spec active dans `docs/product/v1-plan.md` ;
- mettre à jour minimalement le statut vivant dans `README.md` ;
- intégrer dans cette spec uniquement le cadrage de recherche demandé ;
- produire hors repo le Fresh Evidence Pack et le bundle de review STANDARD.

## 15. Hors scope

Activité externe, publication, contact/prospection, entretien exécuté, collecte, donnée participant, formulaire/CRM, compte ou accès, hosting, frontend/backend, contrat, migration, runtime, provider, donnée réelle, modification de 042 ou 043, reprise de 043c, nouveau checker, template séparé, landing publiée, analytics et cookie sont hors scope.

## 16. File-set exact et règle de non-extension

```text
A specs/active/044-design-partner-readiness-v1.md
M docs/product/v1-plan.md
M README.md

A=1
M=2
D=0
R=0
C=0
TOTAL_PATHS=3
```

Aucun quatrième chemin n'est autorisé. Toute nécessité d'étendre ce file-set invalide l'autorisation et déclenche un arrêt.

## 17. Critères d'acceptation documentaires

- exactement une spec active : 044 ; aucune autre spec active ;
- exactement `1A / 2M` sur les trois chemins autorisés ;
- 22 sections logiques présentes ;
- hypothèses, segments, problèmes, bénéfices et seuils étiquetés comme non prouvés/proposés ;
- matrice couvrant les 19 capacités et leurs limites ;
- quatre casquettes de recherche cumulables définies avec leurs responsabilités et leurs limites ;
- participation directe, autorité de changement du workflow et pouvoir d'achat distingués ;
- perspective `PREPARE` de première main requise, ou conclusions bornées à la coordination et à la revue ;
- légende complète des six statuts de vérité produit ;
- capacité renommée en « Mécanismes locaux de décision préparant une revue humaine » ;
- limites de `READY`, `VERIFIED` et `REVIEWED` explicites et reprises dans le walkthrough ;
- walkthrough local synthétique guidé de neuf étapes ;
- guide futur, sélection, Privacy/Security, non-collecte et draft non publié inclus dans la spec ;
- sept autorisations Phase 1 présentes à `NO`, aucune à `YES` ;
- aucun participant, personne, entreprise, coordonnée, donnée client/réelle ou consentement réel ;
- wording sensible limité au nom interne qualifié ou aux blocs explicitement négatifs ;
- CPO, CO Domain Review et Security/Privacy gates présents au bon moment ;
- roadmap, 042 et 043 inchangés ;
- index Git réel vide ; aucun commit, push, PR ou write GitHub.

## 18. Checks simples, sans nouveau checker

Depuis la racine du repo, sans test runtime :

```powershell
git --no-pager diff --stat
git --no-pager diff
git diff --check
git status --short --untracked-files=all
git diff --cached --quiet
git diff --quiet -- specs/backlog/042-controlled-ai-mapping-runtime-pilot-v1.md
git diff --quiet -- specs/done/043-controlled-fiduciary-pilot-readiness-v1.md
```

Assertions ponctuelles : file-set exact ; UTF-8 strict sans BOM ; LF-only ; LF terminal ; résolution des nouveaux liens internes ; absence de chemin utilisateur privé, donnée/contact réel, adresse e-mail, téléphone et signature de secret ; wording interdit seulement dans `MUST_NOT_CLAIM` ; présence des sept marqueurs Phase 1 à `NO` et absence de leur équivalent `YES` ; cohérence spec/v1-plan/README/roadmap ; 042 et 043 byte-identiques à la base.

Les tests backend, frontend, DB et runtime sont `NON_REQUIRED` parce que la surface est exclusivement `DOCS`.

## 19. Gates et décisions owner

```text
OWNER_DECISION_RECORD=ODR-20260812-044-DESIGN-PARTNER-READINESS-LOCAL-IMPLEMENTATION
IMPLEMENTATION_AUTHORIZATION_RECORD=AUTH-20260812-044-DESIGN-PARTNER-READINESS-LOCAL-IMPLEMENTATION

CO_DOMAIN_REVIEW_REQUIRED=YES_ON_EXACT_LOCAL_OBJECT
CO_DOMAIN_REVIEW_SCOPE=WORDING + GUIDED_WALKTHROUGH + INTERVIEW_GUIDE + PRODUCT_STATUS_TERMS
CO_DOMAIN_REVIEW_TIMING=AFTER_LOCAL_IMPLEMENTATION_BEFORE_DELIVERY_OR_CLOSURE

SECURITY_PRIVACY_GATE_REQUIRED=YES_BEFORE_ANY_EXTERNAL_ACTIVITY
CTO_GATE=NOT_REQUIRED_UNLESS_RUNTIME_OR_TECHNICAL_SURFACE_APPEARS
EXPERT_BOARD=NOT_REQUIRED
INDEPENDENT_CODEX_REVIEWER=NOT_REQUIRED_AT_THIS_STAGE
EXTERNAL_HUMAN_EXPERTISE=NO
VALIDATION_PROFESSIONNELLE_METIER=NON_APPLICABLE_TO_DOCS_ONLY_PREPARATION

DELIVERY_AUTHORIZED=NO
MERGE_AUTHORIZED=NO
SENSITIVE_EXECUTION_AUTHORIZED=NO
PRODUCTION_AUTHORIZED=NO
DELIVERY_COMPLETE=NO
```

La CO / Fiduciaire Domain Review examine l'objet local exact après implémentation. La CPO post-code review intervient après cette review et toute correction bornée. Toute publication, outreach, invitation, entretien, collecte, enregistrement, stockage de coordonnées/notes, accès externe, formulaire, analytics ou cookie exige une mission, des artefacts exacts, une review Security/Privacy et une décision owner distinctes.

## 20. Conditions de stop et triggers de reclassement C

Arrêter sans élargir le scope si : baseline ou artefact décisif divergent ; spec/branche/PR concurrente ; quatrième chemin ; walkthrough honnête impossible ; donnée réelle/personnelle nécessaire ; publication ou activité externe requise ; wording réglementaire/statutaire indispensable ; secret, CRM, liste de contacts ou environnement externe requis ; modification de 042, 043 ou matériel forensique ; check documentaire non corrigeable dans les trois chemins ; bundle incapable de reproduire l'objet exact.

Reclasser en C et arrêter avant toute action si apparaissent : publication ou collecte réelle ; compte, auth/onboarding, donnée personnelle/client ou accès externe ; environnement hébergé ou runtime ; provider IA ; gouvernance GitHub permanente ; engagement légal/professionnel substantiel ; promesse officielle, statutaire ou de conformité.

## 21. Fresh Evidence Pack STANDARD attendu

Le pack final doit contenir : verdict ; Owner Decision et autorisation consommée ; base, branche et identités du plan/de la review ; surface `DOCS` et risque B ; trois fichiers exacts et diff par fichier ; structure/marqueurs de la spec ; couverture de la matrice ; frontières de wording, walkthrough, entretien, sélection, Privacy/Security, non-collecte, seuils et gates ; commandes et sorties fraîches ; statut Git et index réel ; tests ajoutés/modifiés ou non exécutés avec justification ; absence de delivery/write GitHub ; écarts ; risques résiduels ; éléments non prouvés ; statut reviewer/expertise ; identités du diff et du bundle ; reproductibilité du patch ; autorisations et non-autorisations.

Il doit prouver `1A / 2M`, l'absence de quatrième chemin, l'encodage, le vocabulaire, les frontières Phase 1, l'intégrité de 042/043, l'absence de staging réel et l'absence de write GitHub.

```text
CO_FIDUCIAIRE_DOMAIN_REVIEW_REQUIRED_ON_EXACT_OBJECT=YES
CO_FIDUCIAIRE_DOMAIN_REVIEW_REQUIRED_AFTER_ANY_MATERIAL_CHANGE=YES
CPO_POST_CODE_REVIEW_REQUIRES=
DOMAIN_STATUS_PASS_OR_PASS_WITH_RESIDUAL_RISK_ON_EXACT_CURRENT_OBJECT
```

## 22. Route de delivery et interdiction d'activité externe

1. Implémentation locale docs-only et checks documentaires.
2. Bundle STANDARD exact hors repo.
3. CO / Fiduciaire Domain Review read-only sur l'objet exact.
4. Corrections strictement bornées, puis nouvelle review si l'objet change matériellement.
5. CPO post-code review.
6. Éventuelle autorisation de delivery distincte liée à la branche, à la base, au file-set et au diff exacts.
7. Seulement après cette autorisation : commit, push, PR et required checks selon la gouvernance active.

Toute mission corrective s'arrête après la production du bundle exact contenant les octets corrigés et avant la CO / Fiduciaire Domain Review requise sur cet objet exact. Toute modification matérielle ultérieure exige une nouvelle Domain Review avant la CPO post-code review ou toute delivery. Même après un éventuel merge futur, aucune activité externe n'est autorisée sans une mission et une autorisation exactes distinctes.
