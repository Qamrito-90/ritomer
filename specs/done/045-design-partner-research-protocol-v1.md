# 045 — Design Partner Research Protocol V1

```text
STATUS=DONE
PHASE=PHASE_1_DESIGN_PARTNER_READINESS
SURFACE=DOCS
RISK_CLASS=C
EVIDENCE_LEVEL=FULL

PROTOCOL_DOCUMENTED=YES
PROTOCOL_VERSIONED=YES
PROTOCOL_REVIEWABLE=YES
PROTOCOL_FAIL_CLOSED=YES
REUSE_OF_044_TRACEABLE=YES
EVIDENCE_SCHEMAS_DEFINED_WITHOUT_REAL_RECORDS=YES

FINAL_OUTCOME=DOCS_ONLY_RESEARCH_PROTOCOL_DELIVERED
DOCUMENTARY_OUTCOME_ACHIEVED=YES
EXTERNAL_RESEARCH_EXECUTED=NO
EXTERNAL_ACTIVITY_READINESS=NO
X_01_STATUS=BLOCKING_EXTERNAL_ACTIVITY
```

## 1. Statut, phase, surface, risque et autorisations

La spec 045 n'est plus active : son outcome documentaire est livré. Aucune recherche, collecte, donnée réelle, activité externe ou exécution runtime n'a été exécutée ni autorisée. Les sections 2 à 22 conservent le protocole substantiel livré et ne constituent aucune autorisation courante. Aucune spec suivante n'est créée, réservée ou automatiquement autorisée.

```text
PROTOCOL_VERSION=045-DESIGN-PARTNER-RESEARCH-PROTOCOL-V1
PROTOCOL_HASH_BINDING=EXTERNAL_FULL_BUNDLE_MANIFEST
SOURCE_044_SHA256=18268eb2a4f3bddaca1c6ceb8edeefe9e4a582a955c03e3aa5795faaa1f39dd5

OWNER_DECISION_RECORD_ID=ODR-20260816-045-DESIGN-PARTNER-RESEARCH-PROTOCOL-ADOPTION
LOCAL_IMPLEMENTATION_AUTHORIZATION_RECORD_ID=AUTH-20260816-045-DESIGN-PARTNER-RESEARCH-PROTOCOL-LOCAL-IMPLEMENTATION

SPEC_SELF_IMPLEMENTATION_AUTHORITY=NO
SPEC_SELF_DELIVERY_AUTHORITY=NO
SPEC_SELF_MERGE_AUTHORITY=NO
SPEC_SELF_EXTERNAL_ACTIVITY_AUTHORITY=NO

PHASE_1_PUBLICATION_AUTHORIZED=NO
PHASE_1_OUTREACH_AUTHORIZED=NO
PHASE_1_INTERVIEW_AUTHORIZED=NO
PHASE_1_COLLECTION_AUTHORIZED=NO
PHASE_1_EXTERNAL_ACCESS_AUTHORIZED=NO
PHASE_1_REAL_DATA_AUTHORIZED=NO
PHASE_1_RUNTIME_AUTHORIZED=NO
```

La décision owner et l'autorisation d'implémentation locale sont des objets externes liés à la base et au plan exacts. Leur présence ne transforme pas cette spec en autorisation de staging, delivery, merge, gate, activité externe, exécution sensible ou production.

## 2. Problème, raison d'agir et outcome

Le paquet documentaire [044 gelé](../done/044-design-partner-readiness-v1.md) a établi une population de recherche, une vérité produit prudente, un walkthrough synthétique et un guide d'entretien futur. Il n'a ni recruté de participant, ni exécuté de recherche, ni fermé les décisions de consentement, custody, accès, rétention, retrait, suppression ou incident nécessaires à une future activité externe.

Agir maintenant réduit l'incertitude méthodologique avant tout contact réel, sans confondre préparation documentaire et readiness externe.

Outcome exact :

> Produire un protocole documentaire versionné, exact, reviewable et fail-closed pour un premier lot proposé de cinq conversations qualifiées, réutilisant le paquet 044, et définissant sélection, invitation, planification, consentement, session, minimisation, notes, codage, incident, preuves et décision de sortie, sans exécuter ni autoriser aucune activité externe.

## 3. Ce que la spec prouve et ne prouve pas

La spec prouve uniquement que le protocole candidat est documenté, versionné, reviewable, fail-closed, traçable vers 044 et accompagné de schémas de preuve futurs sans record réel.

```text
PARTICIPANT_RECRUITED=NO
OUTREACH_EXECUTED=NO
INTERVIEW_EXECUTED=NO
CONSENT_COLLECTED=NO
CONTACT_CHANNEL_APPROVED=NO
CONSENT_LINKAGE_APPROVED=NO
CUSTODY_APPROVED=NO
RETENTION_APPROVED=NO
DELETION_PROCEDURE_APPROVED=NO
VALUE_TERRAIN_PROVED=NO
VALUE_VALIDATED=NO
MARKET_VALIDATED=NO
STATISTICAL_VALIDITY=NO
PRIVACY_COMPLIANCE_CERTIFIED=NO
LEGAL_COMPLIANCE_CERTIFIED=NO
EXTERNAL_READINESS_PROVED=NO
```

Un protocole documenté ne prouve ni l'existence d'un besoin terrain, ni une permission de rechercher, contacter, inviter, planifier, interroger ou collecter.

## 4. Scope et hors-scope

Inclus : composition abstraite du lot ; canaux admissibles ; wording candidat ; planification future ; consentement et retrait sous gate ; ouverture ; référence au walkthrough ; questions ; règles de notes et de codage ; incident ; contrat candidat de custody ; schémas de preuve futurs ; décisions de sortie ; gates et stops.

Hors scope : toute personne, entreprise, liste, coordonnée ou invitation réelle ; sourcing, prospection, outreach, planification ou entretien ; collecte, consentement ou record réel ; enregistrement ; publication ; site, formulaire, CRM, analytics, cookie ou compte ; accès à Ritomer ; backend, frontend, contrat, runbook, policy, checker ou workflow ; provider IA, donnée réelle, runtime ou production ; modification de 042, 043, 044 ou de la roadmap ; création ou réservation de 046.

## 5. Version du protocole et manifeste de réutilisation 044

La seule source du contenu de recherche hérité est constituée des sections 2 à 13 de la [spec 044 gelée](../done/044-design-partner-readiness-v1.md). Les sections historiques 14 à 22 de 044 ne sont pas une source opérationnelle pour ce protocole.

| Matériau 044 | Traitement 045 | Source |
| --- | --- | --- |
| Population et casquettes `PREPARE / COORDINATE / REVIEW / SUPERVISE` | `REUSED_BY_REFERENCE` | 044 §4 |
| Trois attributs d'autorité | `REUSED_BY_REFERENCE` | 044 §4 |
| Question de recherche | `REUSED_BY_REFERENCE` | 044 §2 |
| Matrice de vérité produit et limites `READY / VERIFIED / REVIEWED` | `REUSED_BY_REFERENCE` | 044 §6 |
| Wording court et 30 secondes | `COPIED_BYTE_IDENTICALLY` | 044 §7 |
| Walkthrough synthétique neuf étapes | `REUSED_BY_REFERENCE_WITHOUT_EXECUTION_PARAPHRASE` | 044 §8 |
| Introduction, notice process-only et clôture | `COPIED_BYTE_IDENTICALLY` | 044 §9 |
| Six questions d'entretien | `COPIED_BYTE_IDENTICALLY_ORDER_UNCHANGED` | 044 §9 |
| Grille et critères de sélection | `REUSED_BY_REFERENCE` | 044 §10 |
| Contrôle opérationnel du quota | `ADAPTED_WITH_JUSTIFICATION` | 045 §§8–9 |
| Noyau incident/stop | `COPIED_BYTE_IDENTICALLY` | 044 §11 |
| Custody, suppression, preuve et escalade après incident | `ADAPTED_WITH_JUSTIFICATION_UNDER_CTO_GATE` | 045 §§18–20 |
| Seuils `5/4/1` | `COPIED_BYTE_IDENTICALLY` | 044 §12 |
| `CONTINUE / SIMPLIFY / REPOSITION / STOP` | `REUSED_BY_REFERENCE` | 044 §13 |
| CTA futur inactif | `ADAPTED_WITH_JUSTIFICATION` | 045 §10 |
| Notes, preuves et complétude | `ADAPTED_WITH_JUSTIFICATION` | 045 §§16–20 |
| 044 entière et preuves historiques | `FROZEN_NOT_MODIFIED` | blob/hash ci-dessus |

Wording court copié :

> Ritomer est aujourd'hui un POC local sous forme d'espace de travail de préparation et de revue partielle de dossiers de bouclement. Sur données synthétiques, il relie import de balance, mapping, contrôles techniques bornés, prévisualisations non statutaires, feuilles de travail, pièces justificatives et statuts de revue. Il ne couvre pas un bouclement complet, ne valide pas professionnellement le dossier et ne produit aucun livrable final ou statutaire.

Version 30 secondes copiée :

> Ritomer est aujourd'hui un POC local de préparation et de revue partielle de dossiers de bouclement sur données synthétiques. Il rend visibles l'état applicatif, les points bloquants détectés par Ritomer dans le périmètre affiché et la prochaine action proposée dans le périmètre affiché, à confirmer par la personne responsable, puis relie feuilles de travail, pièces justificatives et statuts de revue. Il ne couvre pas un bouclement complet, ne valide pas professionnellement le dossier et ne produit aucun livrable final ou statutaire.

Tout autre changement participant-facing exige une justification dans le manifeste de delta, puis la re-review de l'objet exact.

## 6. Population, casquettes et attributs d'autorité

La population normative, les définitions et les limites sont réutilisées exclusivement par référence à 044 §4.

```text
RESEARCH_POPULATION_SOURCE=044_SECTION_4
RESEARCH_HATS=PREPARE|COORDINATE|REVIEW|SUPERVISE
HATS_ARE_CUMULATIVE=YES
HATS_ARE_RBAC_OR_TITLES_OR_CERTIFICATIONS=NO

AUTHORITY_ATTRIBUTES=
DIRECT_WORK_PARTICIPATION
WORKFLOW_CHANGE_AUTHORITY
PURCHASE_AUTHORITY

AUTHORITY_ATTRIBUTES_INFERRED_FROM_ONE_ANOTHER=NO
PURCHASE_AUTHORITY_REQUIRED=NO
```

Seule une implication directe déclarée permet à une description abstraite de compter comme preuve de processus. Aucune casquette ne prouve un titre, une signature, une certification ou une validation professionnelle.

## 7. Question de recherche

La question de recherche normative est réutilisée par référence, sans variante, depuis 044 §2, paragraphe « Question de recherche non prouvée ». La matrice de vérité produit et les limites des statuts `READY`, `VERIFIED` et `REVIEWED` sont simultanément réutilisées par référence depuis 044 §6.

```text
RESEARCH_QUESTION_SOURCE=044_SECTION_2_EXACT_QUESTION
PRODUCT_TRUTH_SOURCE=044_SECTION_6
NEW_RESEARCH_QUESTION_WORDING=NO
PRODUCT_CLAIM_EXPANSION=NO
```

## 8. Lot `5/4/1` et limites de conclusion

Bloc de seuils 044 copié sans modification :

```text
QUALIFIED_CONVERSATIONS_PROPOSAL=5
PREPARE_OR_COORDINATE_MINIMUM=4
FIRST_HAND_PREPARE_REQUIREMENT=AT_LEAST_1_OR_CLAIMS_LIMITED_TO_COORDINATION_AND_REVIEW
REVIEW_OR_SUPERVISE_ONLY_COMPARISON_MAXIMUM=1
STATISTICAL_VALIDATION=NO
MARKET_FACT=NO
```

Application normalisée du protocole 045 :

```text
QUALIFIED_CONVERSATIONS=5
PREPARE_OR_COORDINATE_MINIMUM=4
FIRST_HAND_PREPARE_MINIMUM=1
REVIEW_OR_SUPERVISE_ONLY_MAXIMUM=1
STATISTICAL_GENERALIZATION=NO
PREPARE_CLAIM_WITHOUT_FIRST_HAND_PREPARE=FORBIDDEN
```

`5/4/1` est une règle de composition proposée, pas un échantillonnage statistique. Aucun lot réel, roster, slot attribué ou participant n'est créé. Pour 045, une absence de perspective `PREPARE` de première main impose `BATCH_COMPLETENESS=INCOMPLETE`, interdit toute recommandation de sortie fondée sur un lot qualifié et limite toute observation résiduelle à la coordination et à la revue.

## 9. Canaux abstraits et sélection, sans personne ni entreprise

Seuls trois canaux candidats abstraits peuvent être documentés :

- relation existante ;
- introduction individuelle volontaire ;
- intérêt entrant.

Ils ne sont ni sélectionnés pour un cas réel, ni activés. Scraping, listes achetées, outreach de masse, publication, base de contacts et répertoire réutilisable de participants sont interdits.

La grille et ses critères sont réutilisés par référence à 044 §10. L'adaptation opérationnelle se limite à vérifier les compteurs agrégés `5/4/1`, l'implication directe et les limites de claim, sans nom, entreprise, identifiant, coordonnée ni fiche individuelle. Cette adaptation est nécessaire pour rendre la complétude du lot vérifiable sans créer de liste réelle.

## 10. Invitation, droit de refuser et absence d'offre/pilote/accès

Le texte suivant est un delta participant-facing candidat, inactif et non approuvé :

> Ritomer prépare une recherche volontaire sur les étapes de préparation ou de revue partielle d'un dossier de bouclement, autour d'un walkthrough local utilisant uniquement des données synthétiques. Cette invitation n'est ni une offre, ni un pilote, ni une session produit et ne donne aucun accès à Ritomer. Vous pouvez refuser sans justification et sans conséquence. Ne partagez aucune donnée de client, de tiers ou de dossier. Aucune invitation ne peut être envoyée avant satisfaction des gates et avant obtention des décisions et autorisations distinctes.

```text
INVITATION_WORDING_STATUS=CANDIDATE_NOT_APPROVED_NOT_AUTHORIZED
VOLUNTARY_PARTICIPATION=REQUIRED
RIGHT_TO_REFUSE_WITHOUT_JUSTIFICATION=YES
COMMERCIAL_OFFER=NO
PILOT_OFFER=NO
PRODUCT_SESSION=NO
PRODUCT_ACCESS=NO
OUTREACH_EXECUTION=NO
```

L'introduction de session obligatoire reste distincte et est copiée en section 13. Aucune formulation de cette section ne vaut instruction de contact.

## 11. Planification et coordonnée éventuelle

Au plus une coordonnée volontaire de planification pourrait être envisagée dans une future activité autorisée. Elle resterait séparée des notes et limitée à la planification et au suivi explicitement consenti.

Cette coordonnée ne peut jamais servir d'identifiant, de clé de notes ou de moyen de reconstruire une conversation par heure, ordre ou position. Toute liaison conditionnelle future passerait exclusivement par la surface de linkage séparée définie en section 12, après les décisions et autorisations exactes applicables.

Wording candidat, inactif et non approuvé :

> Si vous choisissez volontairement de poursuivre après autorisation, une seule coordonnée de planification choisie par vous pourra être envisagée séparément des notes. Aucun type de coordonnée, outil ou canal n'est sélectionné ou autorisé à ce stade.

```text
CONTACT_COORDINATE_CURRENTLY_COLLECTED=NO
CONTACT_COORDINATE_STORAGE_AUTHORIZED=NO
CONTACT_COORDINATE_TYPE=NOT_SELECTED_NOT_AUTHORIZED
CONTACT_CHANNEL=NOT_SELECTED_NOT_AUTHORIZED
SCHEDULING_TOOL=NOT_SELECTED_NOT_AUTHORIZED
MAX_FUTURE_VOLUNTARY_SCHEDULING_COORDINATES=1
COORDINATE_SEPARATE_FROM_NOTES=REQUIRED_IF_FUTURE_ACTIVITY_AUTHORIZED
COORDINATE_CONSENT_LINKAGE_INCIDENT_NOTES_AGGREGATE_SEPARATED=YES
DIRECT_COORDINATE_TO_NOTES_JOIN=FORBIDDEN
COORDINATE_TO_CONVERSATION_TIME_OR_ORDER_JOIN=FORBIDDEN
REAL_SCHEDULING_AUTHORIZED=NO
```

Aucun fournisseur, outil, canal concret, adresse, numéro de téléphone ou durée n'est choisi par cette spec.

## 12. Consentement, retrait et décisions distinctes sous contraintes techniques

Wording candidat, inactif et non approuvé :

> Avant toute conversation autorisée, un texte final devra expliquer la portée
> du consentement, le droit de retrait, le traitement d'une demande de
> suppression et, si le protocole approuvé prévoit un unlinking irréversible,
> l'événement clairement divulgué après lequel une suppression individualisée
> n'est plus techniquement possible. Ce texte devra respecter les contraintes
> techniques du Technical Gate Record et recevoir les décisions, reviews et
> approbations distinctes applicables. Un avis ou un pass du CTO Gate ne vaut
> ni consentement valide, ni autorisation externe, ni certification juridique.
> Aucun consentement n'est demandé ni recueilli par ce document.

```text
CONSENT_LINKAGE=NON_DETERMINED_BLOCKING
CONSENT_PROOF_SCHEMA=NOT_SELECTED_NOT_AUTHORIZED
CUSTODY=NOT_APPROVED
ACCESS=NOT_APPROVED
RETENTION=NOT_APPROVED
WITHDRAWAL=NOT_APPROVED
DELETION=NOT_APPROVED
INCIDENT_PROCESS=NOT_APPROVED

EXTERNAL_ACTIVITY_AUTHORIZED=NO
```

Une surface de linkage distincte ne peut exister qu'après approbation future exacte de sa nécessité et seulement pour permettre un retrait ou une suppression ciblée avant l'unlinking. Le Technical Gate Record formule les contraintes techniques applicables ; il ne décide ni du consentement, ni d'une activité externe, ni d'une autorisation. La représentation, le format, le mécanisme, le provider et l'outil restent non sélectionnés et non autorisés.

```text
LINKAGE_SURFACE=SEPARATE_FROM_COORDINATE_CONSENT_NOTES_INCIDENT_AND_AGGREGATE
LINKAGE_NECESSITY=NON_DETERMINED_BLOCKING
LINKAGE_HANDLE_IF_APPROVED=BATCH_LOCAL_EPHEMERAL_NONSEMANTIC
LINKAGE_HANDLE_SEQUENTIAL=NO
LINKAGE_HANDLE_TIME_OR_ORDER_DERIVED=NO
LINKAGE_HANDLE_REUSED=NO
LINKAGE_HANDLE_CROSS_BATCH=NO
LINKAGE_HANDLE_IN_NOTES=NO
LINKAGE_HANDLE_IN_AGGREGATE=NO
DIRECT_COORDINATE_TO_NOTES_JOIN=FORBIDDEN
UNLINKING_EVENT=REQUIRED_BEFORE_FINAL_BATCH_SEALING
```

Si aucun linkage n'est approuvé, le futur texte de consentement doit divulguer la frontière événementielle après laquelle un retrait ou une suppression individualisée devient techniquement impossible. Aucune durée calendaire n'est choisie. Aucun identifiant pseudonyme, registre ou formulaire n'est présumé.

## 13. Ouverture et notice process-only

Introduction obligatoire copiée sans modification depuis 044 §9 :

> Cette conversation relève uniquement d'une recherche. Aucune offre, aucun pilote, aucune session produit ni aucun accès n'est ouvert, et vous n'avez aucune obligation de répondre, de poursuivre ou d'accepter un suivi.

Notice process-only obligatoire copiée sans modification depuis 044 §9 :

> Vous pouvez sauter toute question ou arrêter à tout moment. Décrivez uniquement des étapes, actions, rôles et critères de travail de manière abstraite. Ne partagez aucune caractéristique directe ou indirecte d'un client, d'une personne, d'une opération ou d'une situation, notamment secteur, localisation, date, transaction, événement inhabituel ou circonstance identifiable.

Ces textes restent inactifs tant qu'une future activité externe exacte n'a pas franchi ses gates et reçu ses autorisations distinctes.

## 14. Walkthrough synthétique guidé

Le walkthrough normatif est réutilisé intégralement et uniquement par référence à 044 §8, y compris ses neuf étapes, son persona fictif, ses limites de vérité produit et ses conditions d'arrêt.

```text
WALKTHROUGH_SOURCE=044_SECTION_8_EXACT
WALKTHROUGH_STEP_COUNT=9
WALKTHROUGH_EXECUTION_PARAPHRASE_IN_045=NO
WALKTHROUGH_EXECUTED_BY_045=NO
DATA=SYNTHETIC_ONLY
PARTICIPANT_ACCOUNT=NO
EXTERNAL_ACCESS=NO
```

Cette section ne réécrit aucune étape et n'autorise aucune exécution. Toute correction du walkthrough doit d'abord modifier un objet futur explicitement autorisé et déclenche une nouvelle Domain Review ; 044 reste gelée.

## 15. Six questions et clôture non commerciale

Les six lignes suivantes sont copiées sans modification et dans le même ordre depuis 044 §9 :

| Type | Question, prompt ou signal |
| --- | --- |
| `INTERVIEW_QUESTION` | « Lors d'un travail récent de préparation ou de revue, quelles étapes avez-vous suivies et quels outils ou supports avez-vous utilisés pour déterminer l'état du dossier ? Ne décrivez aucun client ou situation. » |
| `INTERVIEW_QUESTION` | « Quelles personnes ou casquettes intervenaient, dans quel ordre et selon quels critères ? Utilisez les termes de votre cabinet. » |
| `INTERVIEW_QUESTION` | « Le cas échéant, à quel moment une information, un statut ou l'étape suivante a demandé une vérification supplémentaire ? Sinon, qu'est-ce qui a rendu la situation claire ? » |
| `INTERVIEW_QUESTION` | « Le cas échéant, quelles actions ont dû être reprises ou retournées ? Sinon, qu'est-ce qui a évité une reprise ? » |
| `INTERVIEW_QUESTION` | « Quelles conséquences observables cela a-t-il eues, s'il y en a eu ? » |
| `INTERVIEW_QUESTION` | « Si vous pouvez l'estimer, à quelle fréquence l'événement décrit se produit-il ou quel effort représente-t-il ? `INCONNU` est une réponse valide. » |

Clôture obligatoire copiée sans modification depuis 044 §9 :

> La recherche s'arrête ici. Aucune offre, aucun pilote, aucune session produit ni aucun accès n'est ouvert, et aucun suivi n'est obligatoire. Un éventuel contact ultérieur exige votre accord séparé et une nouvelle autorisation de Ritomer.

Les questions ne peuvent être remplacées, réordonnées, enrichies par des relances inductives ou utilisées comme preuve de marché. La clôture ne vaut ni demande de suivi ni consentement futur.

## 16. Allowlist/denylist de notes et interdiction audio/vidéo

Les futures notes et métadonnées par conversation, si elles sont distinctement autorisées, sont classées comme potentiellement indirectement identifiantes. Aucune anonymisation irréversible n'est prouvée. Elles peuvent persister uniquement les champs fermés, typés et grossiers définis en section 17 : catégorie abstraite de processus, critère, classe d'outil générique, classe épistémique, signal ou contre-signal normalisé et compréhension du walkthrough sous forme catégorielle. La phrase source et tout commentaire libre sont exclus.

Elles doivent interdire :

- identifiant participant ;
- client ou entreprise ;
- localisation ;
- secteur ;
- date rare ;
- transaction ;
- montant ;
- fichier ;
- capture ;
- situation inhabituelle ;
- combinaison indirectement identifiable ;
- enregistrement audio ou vidéo.

```text
DATA_CLASSIFICATION=POTENTIALLY_INDIRECTLY_IDENTIFYING
PER_CONVERSATION_DATA_CLASSIFICATION=POTENTIALLY_INDIRECTLY_IDENTIFYING
IRREVERSIBLE_ANONYMIZATION_PROVED=NO

VERBATIM=FORBIDDEN
QUOTATION=FORBIDDEN
FREE_TEXT_UNNORMALIZED=FORBIDDEN
TIMESTAMP=FORBIDDEN
CLOCK_TIME=FORBIDDEN
DATE=FORBIDDEN
CONVERSATION_ORDER=FORBIDDEN
SEQUENTIAL_POSITION=FORBIDDEN
EXACT_VENDOR_OR_TOOL=FORBIDDEN
EXACT_HAT_COMBINATION=FORBIDDEN
RARE_PHRASE=FORBIDDEN
UNIQUE_CONTEXT_DETAIL=FORBIDDEN
QUASI_IDENTIFIER_COMBINATION=FORBIDDEN

PARTICIPANT_IDENTIFIER_IN_NOTES=FORBIDDEN
CLIENT_OR_THIRD_PARTY_DATA_IN_NOTES=FORBIDDEN
AUDIO_RECORDING=FORBIDDEN
VIDEO_RECORDING=FORBIDDEN
CONTENT_NORMALIZATION_REVIEW=REQUIRED
COORDINATE_CONSENT_LINKAGE_INCIDENT_NOTES_AGGREGATE_SEPARATED=YES
REAL_NOTE_CREATED=NO
REAL_EXAMPLE_ADDED=NO
```

## 17. Codage `FAIT / INTERPRÉTATION / ESTIMATION / INCONNU`

Chaque future unité de note autorisée doit être classée dans une seule catégorie primaire :

- `FAIT` : description directement rapportée ou comportement directement observé, sans extrapolation ;
- `INTERPRÉTATION` : lecture analytique explicitement attribuée au chercheur ;
- `ESTIMATION` : fréquence, effort ou conséquence approximative explicitement attribuée à la source ;
- `INCONNU` : information non disponible, non demandée, refusée ou impossible à conclure.

Cette classification porte sur une unité déjà normalisée et n'autorise jamais la persistance de la phrase source. Les notes et métadonnées candidates sont limitées au schéma fermé suivant :

```text
TYPED_COARSE_NOTE_UNIT_FIELDS=
research_hat_bucket
direct_work_participation_state
first_hand_prepare_state
epistemic_class
process_topic_category
generic_tool_class
signal_state
walkthrough_comprehension_category
estimate_band

RESEARCH_HAT_BUCKET=PREPARE_OR_COORDINATE|REVIEW_OR_SUPERVISE_ONLY|OTHER_REQUIRES_REVIEW|INCONNU
DIRECT_WORK_PARTICIPATION_STATE=YES|NO|INCONNU
FIRST_HAND_PREPARE_STATE=YES|NO|INCONNU
EPISTEMIC_CLASS=FAIT|INTERPRÉTATION|ESTIMATION|INCONNU
PROCESS_TOPIC_CATEGORY=PROCESS_STEP|CRITERION|HANDOFF|VERIFICATION|REWORK|CONSEQUENCE|OTHER_REQUIRES_REVIEW|INCONNU
GENERIC_TOOL_CLASS=SPREADSHEET|ACCOUNTING_SYSTEM|DOCUMENT_STORAGE|COMMUNICATION|MANUAL_SUPPORT|MULTIPLE_GENERIC_CLASSES|OTHER_REQUIRES_REVIEW|INCONNU
SIGNAL_STATE=SIGNAL|COUNTER_SIGNAL|NEUTRAL|INCONNU
WALKTHROUGH_COMPREHENSION_CATEGORY=UNDERSTOOD_WITHOUT_ORIENTED_HELP|PARTIAL|NOT_UNDERSTOOD|INCONNU
ESTIMATE_BAND=OCCASIONAL|RECURRING|FREQUENT|OTHER_REQUIRES_REVIEW|INCONNU
```

`OTHER_REQUIRES_REVIEW` ne porte aucun suffixe, commentaire ou texte libre et déclenche une revue humaine de normalisation sans conservation du texte source. Si aucun coarsening sûr n'est possible, l'unité est supprimée ou persistée comme `INCONNU`. Avant toute persistance, la combinaison complète des champs est contrôlée ; une combinaison rare ou reconstruisant un quasi-identifiant est rejetée ou grossie de nouveau.

```text
FACT_INTERPRETATION_ESTIMATE_UNKNOWN_SEPARATION=REQUIRED
UNLABELED_INFERENCE=FORBIDDEN
UNKNOWN_IS_VALID=YES
ESTIMATE_PRESENTED_AS_FACT=FORBIDDEN
AUTOMATIC_CODING_DECISION=NO
RARE_COMBINATION_CHECK=REQUIRED_BEFORE_PERSISTENCE
CONTENT_NORMALIZATION_REVIEW=REQUIRED
```

Signaux et contre-signaux restent distincts. Une interprétation ne transforme jamais une estimation en fait ni une absence de preuve en validation.

## 18. Incident/stop

Noyau incident/stop copié sans modification depuis 044 §11 :

Procédure incident/stop à soumettre au gate futur : interrompre immédiatement la conversation dès qu'une divulgation directe ou indirecte commence ; ne pas l'enregistrer, la copier, la résumer ni la conserver ; demander une reformulation abstraite limitée aux étapes, actions, rôles et critères du processus ; arrêter la conversation si une reformulation sûre n'est pas possible ; si un élément a malgré tout été capturé, appliquer la future procédure approuvée de suppression et d'incident.

La preuve d'incident candidate est une surface distincte et non sensible. Elle ne contient jamais le contenu interdit, une coordonnée, un handle, un identifiant, une heure, un ordre, une citation ou un détail contextuel. Ses états et champs sont finis :

```text
INCIDENT_STATE=NONE|STOPPED_BEFORE_CAPTURE|CAPTURE_SUSPECTED|CAPTURE_CONFIRMED_CONTAINED|DELETION_PENDING|DELETION_VERIFIED|DELETION_FAILED_UNRESOLVED

INCIDENT_PROOF_SCHEMA=
INCIDENT_STATE
AFFECTED_SURFACE_CATEGORY
CONTAINMENT_STATE
DELETION_RESULT
VERIFICATION_STATE
UNRESOLVED_BLOCKING

AFFECTED_SURFACE_CATEGORY=COORDINATE|CONSENT|CONDITIONAL_LINKAGE|PER_CONVERSATION_NOTES_AND_METADATA|INCIDENT_PROOF|BATCH_AGGREGATE|OTHER_REQUIRES_REVIEW|INCONNU
CONTAINMENT_STATE=NOT_REQUIRED|STOPPED_BEFORE_CAPTURE|CONTAINED|UNRESOLVED
DELETION_RESULT=NOT_REQUIRED|PENDING|VERIFIED|FAILED_UNRESOLVED
VERIFICATION_STATE=NOT_REQUIRED|PENDING|VERIFIED|FAILED_UNRESOLVED
UNRESOLVED_BLOCKING=YES|NO

INCIDENT_CLOSED_STATES=NONE|STOPPED_BEFORE_CAPTURE|DELETION_VERIFIED
INCIDENT_UNRESOLVED_STATES=CAPTURE_SUSPECTED|CAPTURE_CONFIRMED_CONTAINED|DELETION_PENDING|DELETION_FAILED_UNRESOLVED
FORBIDDEN_CONTENT_IN_INCIDENT_PROOF=FORBIDDEN
PER_BATCH_INCIDENT_EXPOSURE=AGGREGATE_COUNTS_AND_STATES_ONLY
```

`CAPTURE_CONFIRMED_CONTAINED` reste non clos tant que la suppression n'est pas vérifiée. Tout état non clos bloque l'usage des notes, l'agrégation, la complétude, la recommandation de sortie et le scellement final du lot, selon la section 20.

Stops supplémentaires du protocole candidat : provenance synthétique non prouvée ; apparition d'une donnée réelle ou d'un secret ; demande de compte ou d'accès ; besoin de document, fichier, capture, montant ou transaction ; wording de production, conformité ou statut professionnel ; outil ou rattachement non approuvé ; quota ou complétude non vérifiable ; incident dont la procédure approuvée n'est pas disponible.

```text
INCIDENT_OR_STOP_STATE_REQUIRED_IN_FUTURE_SCHEMA=YES
INCIDENT_EXECUTED=NO
INCIDENT_PROCESS=NOT_APPROVED
FAIL_CLOSED_ON_UNAPPROVED_INCIDENT_HANDLING=YES
```

## 19. Custody, ACL, rétention et suppression

Cette section définit seulement un contrat candidat dont les contraintes techniques seront soumises au CTO Gate consultatif et dont tout choix opérationnel exigera les décisions, reviews et autorisations distinctes applicables. Elle ne sélectionne aucun stockage, responsable opérationnel, groupe d'accès, juridiction, durée ou procédure.

```text
CUSTODY=NOT_APPROVED
ACCESS=NOT_APPROVED
ACL=NOT_APPROVED
RETENTION=NOT_APPROVED
WITHDRAWAL=NOT_APPROVED
DELETION=NOT_APPROVED
INCIDENT_PROCESS=NOT_APPROVED

STORAGE_PROVIDER=NOT_SELECTED_NOT_AUTHORIZED
STORAGE_JURISDICTION=NOT_SELECTED_NOT_AUTHORIZED
CUSTODIAN_OPERATOR=NOT_SELECTED_NOT_AUTHORIZED
RETENTION_DURATION=NOT_SELECTED_NOT_AUTHORIZED
CONSENT_PROOF_IMPLEMENTATION=NOT_SELECTED_NOT_AUTHORIZED
DELETION_OPERATOR=NOT_SELECTED_NOT_AUTHORIZED
INCIDENT_CHANNEL=NOT_SELECTED_NOT_AUTHORIZED
OPERATIONAL_TESTS=NOT_APPROVED
PARTICIPANT_REGISTRY=FORBIDDEN
CRM=FORBIDDEN
PUBLIC_FORM=FORBIDDEN
ANALYTICS=FORBIDDEN
COOKIE=FORBIDDEN
PRODUCT_ACCOUNT=FORBIDDEN
PRODUCT_ACCESS=FORBIDDEN
```

Coordonnée, consentement, linkage conditionnel, notes et métadonnées par conversation, preuve d'incident et agrégat de lot restent six surfaces séparées. Le contrat candidat exige, avant toute activité, une finalité exacte, la minimisation, les accès minimaux, le retrait, la suppression vérifiable et un traitement d'incident fail-closed. Tant que ces décisions ne sont pas approuvées sur l'objet exact, toute collecte est bloquée.

Le lifecycle candidat est événementiel et ne choisit aucune durée :

```text
WITHDRAWAL_WINDOW_OPEN
-> TARGETED_DELETION_IF_LINKAGE_APPROVED
-> DRAFT_AGGREGATE_RECALCULATION
-> PRIOR_AGGREGATE_AND_RECOMMENDATION_SUPERSEDED
-> NON_SENSITIVE_SUPERSESSION_PROOF
-> FINAL_UNLINKING_EVENT
-> FINAL_BATCH_SEALING
```

Avant le `FINAL_UNLINKING_EVENT`, un retrait supprime les données dérivées de la conversation encore ciblables de toutes les surfaces autorisées, exclut sa contribution, recalcule les comptes et la composition `5/4/1`, les signaux, les contre-signaux et la complétude, puis supersède l'agrégat et la recommandation antérieurs. Les octets participant-derived des versions antérieures sont supprimés ; seule une preuve de supersession non sensible, sans handle, identifiant, donnée participant-derived ni contenu de note, peut subsister.

Après le `FINAL_UNLINKING_EVENT`, une suppression individualisée est techniquement impossible. Cette frontière événementielle doit être divulguée avant consentement si ce modèle est ultérieurement approuvé. Aucun scellement final n'est possible tant qu'un retrait, une suppression ou un incident reste ouvert. L'unlinking ne prouve pas une anonymisation irréversible de l'agrégat.

## 20. Evidence contract par conversation et par lot, sans record réel

Le contrat distingue exactement six surfaces documentaires, sans record réel et sans jointure implicite :

```text
SEPARATED_SURFACES=
COORDINATE
CONSENT
CONDITIONAL_LINKAGE
PER_CONVERSATION_NOTES_AND_METADATA
INCIDENT_PROOF
BATCH_AGGREGATE

COORDINATE_CONSENT_LINKAGE_INCIDENT_NOTES_AGGREGATE_SEPARATED=YES
DIRECT_COORDINATE_TO_NOTES_JOIN=FORBIDDEN
```

Le schéma candidat par conversation est uniquement documentaire et ne contient ni consentement, ni incident, ni linkage :

```text
PER_CONVERSATION=
protocol_version/hash
research_hat_bucket_controlled
direct_work_participation_state
first_hand_prepare_state
typed_coarse_note_units
walkthrough_comprehension_category

PER_CONVERSATION_DATA_CLASSIFICATION=POTENTIALLY_INDIRECTLY_IDENTIFYING
PER_CONVERSATION_SLOT_INDEX_ORDER_TIMESTAMP=FORBIDDEN
PER_CONVERSATION_HANDLE=FORBIDDEN
```

La surface de linkage conditionnelle reste absente tant que sa nécessité n'est pas approuvée. Si elle l'est, elle sert uniquement au retrait ou à la suppression ciblée avant unlinking et respecte les invariants de la section 12 ; elle n'entre jamais dans la conversation, les notes ou l'agrégat. La preuve d'incident suit exclusivement le schéma fini et non sensible de la section 18.

Le schéma candidat par lot est uniquement documentaire :

```text
PER_BATCH=
protocol_and_gate_hashes
conversation_count_and_5_4_1_composition
completeness_state
signal_counter_signal_controlled_category_counts
incident_aggregate_counts_and_states_with_no_sensitive_content
unresolved_incident_present
residual_limit_categories_controlled
recommended_exit_decision
aggregate_lifecycle_state
recommendation_lifecycle_state
owner_decision_pending
```

```text
BATCH_COMPLETENESS=COMPLETE_OR_INCOMPLETE_OR_SAFETY_STOPPED
EXIT_DECISION=CONTINUE_OR_SIMPLIFY_OR_REPOSITION_OR_STOP
AGGREGATE_LIFECYCLE_STATE=DRAFT|SUPERSEDED|SEALED
RECOMMENDATION_LIFECYCLE_STATE=NONE|CANDIDATE|SUPERSEDED|ELIGIBLE_FOR_OWNER_DECISION
CONTROLLED_SIGNAL_AGGREGATION=COUNTS_BY_CLOSED_NORMALIZED_CATEGORY_ONLY
CONTROLLED_RESIDUAL_LIMIT_CATEGORIES=SMALL_BATCH_REIDENTIFICATION|SAFETY_STOP_BIAS|INCOMPLETE_COMPOSITION|UNRESOLVED_X01|OTHER_REQUIRES_REVIEW|INCONNU
UNRESOLVED_INCIDENT_PRESENT=YES|NO
OWNER_DECISION_PENDING=YES|NO
AGGREGATE_FREE_TEXT=FORBIDDEN
AGGREGATE_RARE_COMBINATION_CHECK=REQUIRED_BEFORE_PERSISTENCE
AGGREGATE_OTHER_REQUIRES_REVIEW_COMMENT=FORBIDDEN
NO_AUTOMATIC_TIE_BREAK=YES

UNRESOLVED_INCIDENT_BLOCKS=
NOTES_USE
BATCH_AGGREGATION
BATCH_COMPLETENESS
EXIT_RECOMMENDATION
FINAL_BATCH_SEALING

DELETION_VERIFIED_DATA_USE=ELIGIBLE_NORMALIZED_DATA_ONLY
WITHDRAWAL_ALWAYS_EXCLUDES_CONTRIBUTION=YES
SUPERSEDED_AGGREGATE_PARTICIPANT_DERIVED_BYTES=ABSENT_REQUIRED
FINAL_BATCH_SEALING_BLOCKED_WHILE_WITHDRAWAL_DELETION_OR_INCIDENT_OPEN=YES

REAL_PER_CONVERSATION_RECORD_CREATED=NO
REAL_PER_BATCH_RECORD_CREATED=NO
REAL_EVIDENCE_RECORD_CREATED=NO
```

La complétude du lot est distincte de la décision produit. Un état incomplet ou safety-stopped ne peut être maquillé en résultat, et aucun schéma ne vaut permission de collecte. Après une suppression d'incident vérifiée, seules les unités normalisées encore éligibles peuvent contribuer ; un retrait exclut toujours toute la contribution concernée.

## 21. Décision de sortie

Les définitions et seuils de `CONTINUE / SIMPLIFY / REPOSITION / STOP` sont réutilisés par référence à 044 §13, sans tie-break automatique et sans nouvelle catégorie produit.

```text
EXIT_DECISION_SOURCE=044_SECTION_13
ALLOWED_EXIT_DECISIONS=CONTINUE|SIMPLIFY|REPOSITION|STOP
OWNER_DECISION_REQUIRED_FOR_EVERY_EXIT=YES
BATCH_COMPLETENESS_IS_EXIT_DECISION=NO
NO_AUTOMATIC_TIE_BREAK=YES
```

`CONTINUE` ne signifie ni accès externe, ni pilote, ni construction automatique. `SIMPLIFY` borne un sous-problème. `REPOSITION` exige un nouveau lot borné. `STOP` ferme l'orientation évaluée. Toute décision reste future, evidence-first et prise par l'owner sur des preuves accessibles.

Une recommandation dérivée d'une contribution retirée est immédiatement `SUPERSEDED`. Elle et les octets participant-derived de l'agrégat antérieur ne peuvent plus servir de preuve ni d'entrée à une décision owner. Toute recommandation de sortie reste bloquée pendant un retrait, une suppression ou un incident ouvert et ne redevient éligible qu'après suppression ciblée le cas échéant, recalcul, supersession et scellement final valide.

Un stop opérationnel de sécurité reste toujours possible ; il ne constitue pas la décision produit `STOP` et ne transforme ni l'incident ni un lot incomplet en recommandation probante.

## 22. Gates, reviews, owner decisions, file-set, checks et conditions de stop

### Règle version-neutre des candidats d'instance

Un candidat d'instance de protocole n'est ni un Evidence Record ni un record
de gouvernance. Il ne porte aucun statut courant ou historique de gate,
review, autorisation, disposition CPO, prochaine action, version de bundle ou
version de review. Les résultats historiques appartiennent exclusivement aux
Evidence Packs, Technical Gate Records, Domain Review Records et décisions
CPO exacts. La route applicable est déterminée uniquement à partir des
records autoritatifs liés à l'objet courant exact, jamais depuis un snapshot
embarqué dans l'instance. Des hashes statiques ne peuvent être présents dans
l'instance que pour lier le protocole courant et une source gelée, sans
autorité de routage.

```text
INSTANCE_CANDIDATE_CONTAINS_ROUTING_STATE=NO
INSTANCE_CANDIDATE_DYNAMIC_GATE_REVIEW_STATUS_FIELDS_ALLOWED=NO
INSTANCE_CANDIDATE_CURRENT_OR_HISTORICAL_STATUS_FIELDS_ALLOWED=NO
INSTANCE_CANDIDATE_NEXT_ACTION_ALLOWED=NO
INSTANCE_CANDIDATE_VERSIONED_BUNDLE_OR_REVIEW_ROUTE_ALLOWED=NO
INSTANCE_CANDIDATE_CPO_DISPOSITION_ALLOWED=NO
INSTANCE_CANDIDATE_ROUTING_AUTHORITY=NO
HISTORICAL_RESULTS_LOCATION=EVIDENCE_PACKS_TECHNICAL_GATE_RECORDS_DOMAIN_REVIEW_RECORDS_CPO_DECISIONS
APPLICABLE_ROUTE_SOURCE=AUTHORITATIVE_RECORDS_BOUND_TO_EXACT_CURRENT_OBJECT
STATIC_HASHES_IN_INSTANCE=PROTOCOL_AND_FROZEN_SOURCE_BINDING_ONLY
```

### CTO Security/Privacy Gate

Question exacte :

> Le protocole 045 et son instance opérationnelle candidate peuvent-ils fonctionner sans donnée client ou tierce et sans identifiant participant dans les notes, avec au plus une coordonnée volontaire séparée, et — seulement si une preuve de consentement liée est nécessaire — un rattachement minimal, séparé et expressément approuvé, avec finalité, custody, accès, rétention, retrait, suppression et incident fermés et vérifiables, sans CRM, formulaire public, analytics, compte produit ni accès à Ritomer ?

Objet exact :

```text
exact 045 bytes
+ referenced 044 blob/hash
+ participant-facing delta
+ proposed notes/evidence schemas
+ exact protocol-instance candidate without real participant data
```

Moment exact : après l'implémentation locale docs-only ; après toute correction matérielle ; avant la CPO post-code review ; avant toute delivery ; avant tout outreach, invitation, planification ou collecte.

Livrable exact :

```text
CTO_GATE_OUTPUT=TECHNICAL_GATE_RECORD_READ_ONLY_ON_EXACT_OBJECT
```

### CO / Fiduciaire Domain Review

Question exacte :

> Le delta participant-facing de 045 conserve-t-il la population, la neutralité des questions, les limites du walkthrough et la vérité produit approuvées en 044, sans induction, surpromesse, offre implicite, promesse professionnelle/statutaire ou validation de marché ?

Objet exact : wording participant-facing final de 045, blocs 044 référencés ou copiés et manifeste de delta matériel. Moment exact : après les corrections éventuelles pilotées par le CTO Gate et avant CPO post-code review ou delivery.

Livrable exact :

```text
CO_REVIEW_OUTPUT=DOMAIN_REVIEW_RECORD_READ_ONLY_ON_EXACT_OBJECT
```

### Séquence et autorité

```text
CTO_GATE_IS_CONSULTATIVE_READ_ONLY=YES
CTO_GATE_AUTHORIZES_EXTERNAL_ACTIVITY=NO
CTO_GATE_CERTIFIES_CONSENT_OR_LEGAL_COMPLIANCE=NO
DISTINCT_OWNER_DECISION_AND_AUTHORIZATION_REQUIRED=YES
```

```text
LOCAL_IMPLEMENTATION
-> FULL_BUNDLE
-> CTO_SECURITY_PRIVACY_GATE
-> CTO_DRIVEN_CORRECTIONS_IF_ANY
-> REPEAT_CTO_GATE_AFTER_MATERIAL_CHANGE
-> CO_FIDUCIAIRE_DOMAIN_REVIEW
-> CPO_POST_CODE_REVIEW
-> POSSIBLE_DELIVERY_DECISION

EXPERT_REVIEW_BOARD=NOT_REQUIRED_AT_PROTOCOL_SPEC_STAGE
```

Aucun gate n'autorise une activité externe. Toute delivery, tout merge et toute future activité externe exigent leurs décisions owner et Authorization Records distincts, liés à l'objet exact. Un futur reviewer Codex séparé intervient à l'étape exigée par la doctrine C ; il n'est ni une signature humaine ni le CTO Gate.

### Source de vérité du file-set et de l'état courant

La spec ne porte aucun file-set d'implémentation ou de correction courant,
aucun nombre courant de commits, aucun état courant de branche ou de PR et
aucune identité courante de patch ou de bundle. Pour chaque mission, ces
éléments appartiennent exclusivement à l'Authorization Record exact, à
l'Evidence Pack exact et aux records Git/GitHub liés à l'objet courant exact.

```text
SPEC_DECLARES_CURRENT_IMPLEMENTATION_FILE_SET=NO
SPEC_DECLARES_CURRENT_CORRECTIVE_FILE_SET=NO
SPEC_DECLARES_CURRENT_COMMIT_BRANCH_OR_PR_STATE=NO
SPEC_DECLARES_CURRENT_PATCH_OR_BUNDLE_IDENTITY=NO
CURRENT_FILE_SET_SOURCE=EXACT_AUTHORIZATION_RECORD_BOUND_TO_CURRENT_OBJECT
CURRENT_DIFF_AND_GIT_STATE_SOURCE=EXACT_EVIDENCE_PACK_AND_GIT_GITHUB_RECORDS
```

Toute mission échoue fermée si son file-set, son diff, sa base, son head, sa
branche, sa PR ou ses artefacts divergent des records exacts qui l'autorisent.
Cette règle ne fixe aucun nombre permanent de chemins et n'autorise aucun scope
supplémentaire.

### Checks version-neutres de l'objet exact

Toute version exacte de 045 doit prouver, selon la phase et l'Authorization
Record applicables : structure et ordre des 22 sections ; UTF-8 strict sans
BOM, LF-only et LF terminal ; liens internes valides ; absence de conflit,
octet NUL, secret, credential, chemin de profil privé, donnée terrain ou record
réel ; aucune autorisation externe à `YES` ; identité des sources gelées
requises ; absence de régression des blocs hérités, du participant-facing, des
limites `5/4/1`, de D-01 à D-05 et de X-01 ; au plus une future coordonnée
séparée et non autorisée ; aucune liaison de consentement présumée ; aucune
approbation, certification ou autorisation attribuée au CTO Gate ; absence de
CRM, formulaire public, analytics, cookie, compte produit, accès externe ou
runtime autorisé par cette spec.

Les checks de Git, index, commits, branche, PR, patches, bundle, CI et
reproductibilité sont déterminés par l'Authorization Record et l'Evidence Pack
applicables à la phase courante. Ils ne constituent jamais des valeurs
courantes ou universelles embarquées dans la spec.

```text
SPEC_STRUCTURE_AND_ENCODING_CHECKS_REQUIRED=YES
NO_SECRET_PRIVATE_PATH_OR_REAL_DATA_REQUIRED=YES
PARTICIPANT_FACING_AND_D01_D05_X01_NON_REGRESSION_REQUIRED=YES
ALL_EXTERNAL_AUTHORIZATIONS_NO_UNTIL_SEPARATE_RECORD=YES
PHASE_SPECIFIC_GIT_GITHUB_PATCH_AND_BUNDLE_CHECKS_SOURCE=EXACT_CURRENT_AUTHORIZATION_AND_EVIDENCE
PHASE_SPECIFIC_CURRENT_STATE_EMBEDDED_IN_SPEC=NO
```

### Conditions de stop version-neutres

Stopper sans élargir le scope si : une identité ou une preuve décisive diverge
des records exacts applicables ; une modification sort du file-set autorisé ;
une donnée de personne, entreprise, coordonnée ou autre donnée réelle apparaît ;
une liaison de consentement est supposée ; un identifiant, outil, provider,
adresse, téléphone, durée, compte, formulaire, CRM, site, analytics ou runtime
doit être sélectionné sans décision distincte ; une autorisation externe passe
à `YES` sans Authorization Record exact ; un bloc hérité, le
participant-facing, D-01 à D-05 ou X-01 régresse ; une spec 046 ou un changement
de roadmap est introduit sans décision produit distincte ; l'objet exact ne
peut plus être reproduit ou reviewé.

```text
SPEC_045_CREATES_OR_AUTHORIZES_046=NO
FUTURE_046_REQUIRES_SEPARATE_PRODUCT_AND_OWNER_DECISION=YES

STOP_RITOMER_045_EXACT_OBJECT_IDENTITY_DRIFT
STOP_RITOMER_045_AUTHORIZED_SCOPE_DRIFT
STOP_RITOMER_045_PRIVACY_OR_EXTERNAL_ACTIVITY_CONTRADICTION
STOP_RITOMER_045_DECISIVE_EVIDENCE_INSUFFICIENT
```
