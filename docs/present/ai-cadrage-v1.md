# IA Cadrage V1

## Role du document

Ce document est la synthese canonique de la verite IA du present pour la V1 executable.

Il ne remplace ni la vision IA, ni le playbook IA, ni les contrats et garde-fous IA du repo. Il fixe ce qui est active, prepare, differe et hors scope maintenant.

## Ce qui est vrai maintenant

- Le produit est AI-ready, mais pas encore AI-native dans le runtime.
- La spec 046 est l'unique spec active. M1.1A avec son correctif M8 borne la fondation backend auth/tenant sans modification IA, agent ou MCP runtime ; M8 ferme l'exposition web Prometheus tandis que health et info restent exposes. L'outcome final M1.1 n'est pas livre et B, C et D ne sont pas implementees.
- Ce cadrage ne constitue aucune autorisation. Chaque slice future B, C ou D exige une autorisation distincte ; les etats de review, delivery, merge et decision owner vivent uniquement dans les Evidence Packs, la pull request et les records specialises.
- Le coeur metier reste deterministe, tenant-scoped, audit-ready et utilisable sans IA.
- `030` livre une capacite de mapping assiste no-provider, evidence-first et human-in-the-loop.
- La capacite livree expose des suggestions structurees de mapping, des preuves visibles et une decision humaine unitaire `ACCEPT`, `CORRECT` ou `REJECT`.
- Le mapping manuel et le backend restent l'autorite metier : l'IA suggere, mais ne valide pas et n'applique jamais seule un mapping.
- L'IA entre via le backend et des ports applicatifs stables, pas par des appels modele directs depuis le frontend.
- Toute capacite IA metier du present ou du futur proche doit rester evidence-first, structured-output et human-in-the-loop.
- Aucune ecriture directe en base par l'IA n'est autorisee.
- Le produit doit continuer a fonctionner si l'IA est indisponible.
- `029` livre des surfaces frontend de confiance E2E, pas une capacite IA : aucune IA runtime, aucune redaction IA d'annexe, aucune decision automatique et aucune action engageante sans revue humaine.
- La minimal annex preview exposee par `029` reste un read-model deterministe prepare pour revue humaine ; elle n'est pas une annexe redigee ou approuvee par IA.
- La premiere capacite IA livree est le mapping assiste no-provider : elle n'active ni provider IA reel, ni modele reel, ni SDK, ni prompt runtime actif, ni cout provider, ni appel reseau IA.
- Les artefacts `030d` et `042` restent des preuves historiques ou de backlog. Ils ne constituent pas le rail executable de M2, n'activent aucun provider et ne rendent pas les evals candidates autoritatives.
- Le read-model public de mapping expose `accountLabel` depuis la ligne originale tenant-scoped ; la frontiere interne `ai::access` utilise `sanitizedAccountLabel` minimise et ne remplace pas le contrat public.
- Le repo porte les artefacts vivants de gouvernance IA : schema contractuel, prompt guardrail, evals, retrieval policy, runbook d'incident, readiness policy, readiness record et dependency/security review.

## Trajectoire IA approuvee, non livree

- M2 cible une provider gateway OpenAI-first avec abstraction provider des le premier runtime. Un spike borne comparera Spring AI et le SDK Java officiel derriere le meme port interne ; M0 ne choisit aucune dependance, aucun modele, aucun endpoint et n'active aucun appel reseau.
- M3 cible un seul agent borne avant toute orchestration multi-agentes : goal/run state, budgets, arret, registre d'outils interne type et versionne, outils read-only par defaut et confirmation humaine avant toute mutation. Le modele n'accede jamais directement a la base.
- M4 cible le Mapping Assistant comme premier slice IA-native, en reutilisant les services deterministes de mapping et la revue humaine sans reprendre le rail 042.
- MCP signifie `Model Context Protocol`. Il n'est ni un modele, ni un agent, ni un orchestrateur. Sa sequence cible est `INTERNAL_TOOL_REGISTRY -> MCP_CAPABILITY_CATALOG -> MCP_CLIENT_READ_ONLY -> AUTHORIZED_EXTERNAL_RESOURCES_AND_TOOLS -> MCP_SERVER_ONLY_IF_A_REAL_EXTERNAL_CLIENT_NEED_EXISTS`.
- La readiness MCP commence en M2/M3 par des ports, schemas et un registre adaptables. Aucun runtime MCP n'est active avant M6 ; M6 est client-first et un serveur exige un besoin externe reel et prouve.
- Aucun provider, secret, SDK, appel reseau, agent runtime, runtime MCP ou multi-provider n'est active par M0.

## Ce qui est explicitement hors scope maintenant

- assistant conversationnel comme interface primaire du produit
- agent autonome qui modifie des donnees metier sans validation humaine
- sortie texte libre interpretee implicitement par le systeme
- appel modele direct depuis le frontend
- RAG ou vector store deploye par principe sans cas d'usage valide
- orchestration multi-agentes complexe dans le produit courant
- requirement GraphQL pour activer l'IA
- service IA dedie obligatoire dans la V1 courante
- redaction IA runtime d'une annexe
- provider IA reel, modele reel, SDK provider, prompt runtime actif, cout provider ou appel reseau IA dans le present
- agent runtime, runtime MCP, second provider actif ou orchestration multi-agentes dans le present
- decision automatique ou approbation par IA d'un acte comptable, reglementaire ou financier

## Decisions non negociables du present

- Deterministic core first.
- Human-in-the-loop obligatoire sur toute action critique.
- Evidence-first sur toute suggestion utile au metier.
- Structured outputs obligatoires des qu'une sortie IA influence une decision ou un flux.
- Scoping tenant strict et aucune fuite cross-tenant.
- Model pinning, prompt pinning, evals et logs obligatoires.
- Feature flag et mode degrade obligatoires pour toute activation IA reelle.
- Les donnees sensibles ne partent pas en clair vers des services IA externes.
- Le mapping assiste `030` reste no-provider ; M2 sera un futur scope distinct et ne reactive pas `042`.
- Le mapping manuel reste l'autorite metier durable.

## Artefacts vivants detailles du repo

- `docs/adr/0003-ai-gateway-evidence-first.md`
- `docs/product/product-roadmap.md`
- `docs/product/v1-plan.md`
- `contracts/ai/mapping-suggestion.schema.json`
- `contracts/openapi/mapping-suggestions-api.yaml`
- `contracts/db/mapping-suggestion-decision-v1.md`
- `prompts/guardrails/system-fr.md`
- `evals/mapping/README.md`
- `knowledge/retrieval-policy.md`
- `runbooks/ai-incident-response.md`
- `policies/ai-provider-readiness.md`
- `policies/ai-provider-readiness-record-030d1.md`
- `policies/dependency-security-review-030d1.md`
- `docs/ui/ui-foundations-v1.md`
- `specs/done/029-pilot-closing-workflow-e2e-confidence-hardening-v1.md`
- `specs/done/030-ia-mapping-assiste-suggestion-review-v1.md`
- `specs/backlog/042-controlled-ai-mapping-runtime-pilot-v1.md`
- `specs/done/043-controlled-fiduciary-pilot-readiness-v1.md`
- `specs/done/044-design-partner-readiness-v1.md`
- `specs/done/045-design-partner-research-protocol-v1.md`
- `specs/active/046-authenticated-session-foundation-v1.md`
- `docs/vision/ai-native.md`
- `docs/playbooks/ai.md`

## Regle de maintenance

Mettre a jour ce document seulement si la verite IA du present change reellement, par exemple :

- activation d'une capacite IA metier dans le produit
- changement durable du premier cas d'usage IA prioritaire
- changement durable des garde-fous d'activation, de gouvernance ou d'architecture IA
- sortie d'un hors-scope IA devenu reellement actif

Ne pas y recopier integralement les prompts, evals, schemas ou Word.

## References Word sources utilisees

- `docs/reference-word/3.3-IA-Cadrage-V1.docx`

Le Word `3.3` reste globalement alignable comme snapshot, mais le present canonique du repo est porte par ce markdown et par les artefacts vivants detailles qu'il reference.

## Note de precedence

En cas d'ecart, le markdown canonique du repo prime sur le Word de reference.
