# IA Cadrage V1

## Role du document

Ce document est la synthese canonique de la verite IA du present pour la V1 executable.

Il ne remplace ni la vision IA, ni le playbook IA, ni les contrats et garde-fous IA du repo. Il fixe ce qui est active, prepare, differe et hors scope maintenant.

## Ce qui est vrai maintenant

- Le produit est AI-ready, pas AI-led.
- Le repo vivant est clos jusqu'a `030`.
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
- `030d runtime` provider reel reste non livre, non approuve et bloque par CPO approval, CTO Gate, security/privacy review, IA governance review, provider-readiness record signe, dependency/security review signee, payload whitelist signee, runbook pret et golden set vert.
- Le read-model public de mapping expose `accountLabel` depuis la ligne originale tenant-scoped ; la frontiere interne `ai::access` utilise `sanitizedAccountLabel` minimise et ne remplace pas le contrat public.
- Le repo porte les artefacts vivants de gouvernance IA : schema contractuel, prompt guardrail, evals, retrieval policy, runbook d'incident, readiness policy, readiness record et dependency/security review.

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
- provider IA reel pour le mapping assiste tant que les gates `030d runtime` ne sont pas signes
- modele reel, SDK provider, prompt runtime actif, cout provider ou appel reseau IA pour le mapping assiste courant
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
- Le mapping assiste `030` reste no-provider tant que `030d runtime` n'est pas approuve.
- Le mapping manuel reste l'autorite metier durable.

## Artefacts vivants detailles du repo

- `docs/adr/0003-ai-gateway-evidence-first.md`
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
