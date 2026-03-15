# CODEX-HANDOFF

## Verdict d’alignement
Ce pack respecte la vision UX, la vision architecture, la vision IA-native et le plan V1, avec une lecture cohérente entre vision cible et séquencement d’exécution.

## Réconciliation des points potentiellement contradictoires
- Vision architecture : API bimodale REST + GraphQL.
- Plan V1 : REST first.
=> Ce pack encode REST first en V1 et GraphQL comme ADR / cible future conditionnelle.

- Vision architecture : microservice IA Python dédié.
- Plan V1 : AI Gateway + Spring AI in-process, extraction Python sous conditions.
=> Ce pack encode l’AI Gateway comme invariant, et l’extraction Python comme décision différée sur triggers explicites.

## Ce que Codex doit comprendre
- Les documents de vision sont la North Star.
- Les ADRs traduisent les arbitrages d’exécution.
- Les specs bornent le travail courant.
- Les contracts, evals, prompts et runbooks rendent l’IA réellement gouvernable.

## Première mission recommandée
Commencer par `specs/done/001-foundation-bootstrap.md`.
