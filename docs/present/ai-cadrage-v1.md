# IA Cadrage V1

## Role du document

Ce document est la synthese canonique de la verite IA du present pour la V1 executable.

Il ne remplace ni la vision IA, ni le playbook IA, ni les contrats et garde-fous IA du repo. Il fixe ce qui est active, prepare, differe et hors scope maintenant.

## Ce qui est vrai maintenant

- Le produit est AI-ready, pas AI-led.
- Le repo vivant est clos jusqu'a `027`, mais l'IA n'est toujours pas une capacite structurante du runtime courant.
- Le coeur metier reste deterministe, tenant-scoped, audit-ready et utilisable sans IA.
- L'IA future doit entrer via le backend et des ports applicatifs stables, pas par des appels modele directs depuis le frontend.
- Toute capacite IA metier du present ou du futur proche doit rester evidence-first, structured-output et human-in-the-loop.
- Aucune ecriture directe en base par l'IA n'est autorisee.
- Le produit doit continuer a fonctionner si l'IA est indisponible.
- Aucune spec livree jusqu'a `027` n'active de microservice IA obligatoire, de flux metier pilote par modele ou de generation IA runtime.
- La premiere capacite IA credible reste le mapping assiste, gouverne et candidat futur dans la sequence V1, pas une implementation runtime active, une conversation generale ni une autonomie agentique.
- Le repo porte deja les premiers artefacts vivants de gouvernance IA : schema contractuel, prompt guardrail, evals, retrieval policy et runbook d'incident.

## Ce qui est explicitement hors scope maintenant

- assistant conversationnel comme interface primaire du produit
- agent autonome qui modifie des donnees metier sans validation humaine
- sortie texte libre interpretee implicitement par le systeme
- appel modele direct depuis le frontend
- RAG ou vector store deploye par principe sans cas d'usage valide
- orchestration multi-agentes complexe dans le produit courant
- requirement GraphQL pour activer l'IA
- service IA dedie obligatoire dans la V1 courante

## Decisions non negociables du present

- Deterministic core first.
- Human-in-the-loop obligatoire sur toute action critique.
- Evidence-first sur toute suggestion utile au metier.
- Structured outputs obligatoires des qu'une sortie IA influence une decision ou un flux.
- Scoping tenant strict et aucune fuite cross-tenant.
- Model pinning, prompt pinning, evals et logs obligatoires.
- Feature flag et mode degrade obligatoires pour toute activation IA reelle.
- Les donnees sensibles ne partent pas en clair vers des services IA externes.

## Artefacts vivants detailles du repo

- `docs/adr/0003-ai-gateway-evidence-first.md`
- `docs/product/v1-plan.md`
- `contracts/ai/mapping-suggestion.schema.json`
- `prompts/guardrails/system-fr.md`
- `evals/mapping/README.md`
- `knowledge/retrieval-policy.md`
- `runbooks/ai-incident-response.md`
- `docs/ui/ui-foundations-v1.md`
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
