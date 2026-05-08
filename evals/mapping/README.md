# Mapping evals 030c

## Objectif

030c rend mesurable une future activation IA de mapping avant tout provider reel.

Cette surface reste docs/evals only :

- golden set synthetique en JSON ;
- format verifiable localement ;
- check PowerShell sans nouvelle dependance ;
- aucune capacite IA runtime, aucun modele, aucun prompt runtime et aucun appel reseau.

## Format du golden set

Le fichier canonique est `evals/mapping/golden-set-v1.json`.

Chaque cas contient :

- `id` unique ;
- `tenantId` et `closingFolderId` synthetiques ;
- `latestImportVersion` et `taxonomyVersion` ;
- `input.accountCode`, `input.accountLabel`, `input.debit`, `input.credit` ;
- `context` optionnel, synthetique et sans donnee brute ;
- `expected.outcome` parmi `SUGGESTION`, `NO_SUGGESTION`, `REJECTED`, `DEFERRED` ;
- `expected.suggestion` uniquement pour les cas positifs ;
- `expected.rejectionReason` ou `expected.deferredReason` pour les rejets et reports ;
- `expected.evidenceConstraints` ;
- `tags`.

Les suggestions positives doivent respecter `contracts/ai/mapping-suggestion.schema.json` sur les champs critiques :

- `accountCode` ;
- `accountLabel` ;
- `suggestedTargetCode` ;
- `confidence` entre `0` et `1` ;
- `riskLevel` parmi `LOW`, `MEDIUM`, `HIGH` ;
- `rationale` non vide ;
- `evidence[]` non vide et bornee ;
- `requiresHumanReview = true` ;
- `schemaVersion = mapping-suggestion-v1` ;
- `promptVersion` non vide ;
- `modelVersion` non vide.

## Cas couverts

`golden-set-v1.json` couvre au minimum :

- `cash-bank-simple` : banque/caisse vers `BS.ASSET.CASH_AND_EQUIVALENTS` ;
- `revenue-simple` : ventes/revenue vers `PL.REVENUE.OPERATING_REVENUE` ;
- `receivable-simple` : debiteur/receivable vers `BS.ASSET.TRADE_RECEIVABLES` ;
- `payable-simple` : fournisseur/payable vers `BS.LIABILITY.TRADE_PAYABLES` ;
- `ambiguous-clearing` : cas ambigu avec `riskLevel` prudent et confidence plafonnee ;
- `no-suggestion-expected` : compte deja mappe ou hors dernier import ;
- `non-selectable-target-rejected` : cible section non selectable rejetee ;
- `legacy-target-deferred` : cible legacy documentee comme differee, non activee par 030c/030b strict ;
- `cross-tenant-history-forbidden` : historique hors tenant non utilisable et non cite en evidence ;
- `insufficient-evidence` : absence de preuve exploitable.

Le cas legacy reste volontairement non actif : les suggestions positives 030c doivent pointer uniquement vers une cible V2 connue, selectable et non deprecated dans `contracts/reference/manual-mapping-targets-v2.yaml`.

## Metriques

Les metriques 030c documentees par le golden set sont :

- schema validity des suggestions positives ;
- exact match sur `suggestedTargetCode` pour les cas positifs ;
- presence et bornage des preuves ;
- `requiresHumanReview = true` strict ;
- calibration `confidence` / `riskLevel`, notamment sur les cas ambigus ;
- rejet des cibles non selectable ou deprecated ;
- rejet/no suggestion pour insuffisance de preuve, compte non eligible et historique hors tenant.

Les metriques runtime futures comme latence, cout, taux accept/reject/correct et fallback restent des gates 030d+.

## Seuils minimaux avant provider reel

Avant toute activation de provider reel :

- 100 % schema validity sur les suggestions positives ;
- 100 % `requiresHumanReview = true` ;
- 100 % evidence non vide sur les suggestions positives ;
- 0 secret, donnee brute ou fuite cross-tenant dans les fixtures et evidences ;
- 0 cible non selectable exposee comme suggestion positive ;
- 0 cible deprecated exposee comme suggestion positive ;
- tous les cas de rejet attendus correctement marques `NO_SUGGESTION`, `REJECTED` ou `DEFERRED` ;
- aucune activation provider reel tant que le check local n'est pas vert.

## Regles donnees

Les fixtures doivent rester synthetiques. Elles ne doivent contenir :

- aucun secret, token, credential, cookie, DSN ou valeur `.env` ;
- aucune cle de stockage, storage object key, signed URL ou URI de stockage ;
- aucune donnee client brute ;
- aucun CSV brut ;
- aucune evidence hors tenant ;
- aucune donnee issue d'une fiduciaire reelle.

Les preuves doivent rester courtes, tenant-scoped et suffisantes pour une revue humaine.

## Check local

Depuis la racine du repo :

```powershell
.\evals\mapping\validate-golden-set.ps1
```

Le script verifie :

- JSON valide ;
- schema interne simple et champs critiques non libres ;
- unicite des ids ;
- ids synthetiques ;
- absence de valeurs sensibles dans le golden set ;
- absence d'evidence cross-tenant ;
- structure stricte des suggestions positives ;
- cible connue, selectable et non deprecated pour toute suggestion positive ;
- absence de suggestion positive dans les cas `NO_SUGGESTION`, `REJECTED` ou `DEFERRED`.

Le script affiche `Total cases`, `Passed` et `Failed`, puis sort avec un code non zero si une regle echoue.

## Gates avant 030d

030d ne doit pas brancher de modele reel tant que :

- le check local 030c est vert ;
- le golden set reste synthetique et sans donnee sensible ;
- les cas legacy restent differes tant que le backend 030b reste strict sur V2 selectable et non deprecated ;
- la revue IA/gouvernance valide model pinning, prompt pinning, schema pinning, logs et fallback ;
- la privacy/security review est faite avant tout envoi de donnees a un provider externe.
