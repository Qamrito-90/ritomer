# Spec 013 - Exports Audit-Ready V1

## Statut

- done
- implemented
- code, contrats, migration et validations rapides livres

## Probleme / pourquoi maintenant

Le repo sait deja produire les briques deterministes necessaires a un handoff audit-ready minimal :

- `controls` pour le gate de readiness
- `financial-summary` pour la preview financiere synthetique
- `financial-statements-structured` pour la preview structuree
- `workpapers` pour la justification persistante anchor-driven
- `documents` pour les vraies pieces justificatives binaires privees
- `document_verification` et `documentVerificationSummary` pour la verification reviewer explicite

Le plan V1 place `Exports audit-ready` juste apres `010-workpapers-v1`, `011-document-storage-and-evidence-files-v1` et `012-evidence-review-and-verification-v1`.

La V1 a donc besoin d'un pack d'export backend-only, REST-first, tenant-scoped et audit-safe qui assemble ces briques en un snapshot telechargeable, sans introduire de nouvelle source de verite metier, sans front riche, sans GraphQL, sans PDF statutaire et sans runtime IA.

## Decisions V1 fermes

- Le slug exact est `013-exports-audit-ready-v1`.
- La capacite est backend-first, REST-first, sans scope frontend riche.
- Le pack d'export est un snapshot derive ; il n'est jamais une nouvelle source de verite metier.
- Le module proprietaire cible reste `exports`.
- La generation V1 est synchrone uniquement.
- Il n'y a ni background job, ni orchestration asynchrone, ni polling de statut.
- En l'absence de generation logique reussie deja persistee pour cette cle, la generation est autorisee uniquement si le closing folder n'est pas `ARCHIVED` et si `controls.readiness = READY`.
- Sur un closing folder `ARCHIVED`, la lecture et le telechargement d'un export pack deja genere restent autorises si le tenant et le RBAC sont valides.
- Le telechargement d'un export pack est une lecture : aucun `audit_event` metier n'est emis.
- Une generation reussie d'export pack est une mutation metier significative : exactement un `audit_event` est emis avec l'action `EXPORT_PACK.CREATED`.
- Les lectures restent silencieuses dans `audit_event`.
- Les refus et les echecs restent silencieux dans `audit_event`.
- La V1 n'introduit aucune signed URL publique.
- Le storage est prive.
- Le download est backend-only.
- Aucune `storage_object_key` n'est exposee au client.
- Le format d'export V1 est une archive `ZIP` unique avec manifest explicite et fichiers binaires documentaires inclus.
- Le pack V1 inclut les read-models deja presents dans le repo : `controls`, `financial-summary`, `financial-statements-structured`, et la vue courante des `workpapers` filtreee aux workpapers courants persistants uniquement.
- Les `staleWorkpapers[]` sont explicitement exclus du pack V1.
- Les current anchors sans `workpaper` persiste ne sont pas inclus comme workpapers du pack.
- Les documents visibles depuis les current workpapers sont inclus dans le pack V1.
- Les documents `UNVERIFIED`, `VERIFIED` et `REJECTED` sont tous inclus si visibles depuis les current workpapers.
- Le statut de verification de chaque document est expose explicitement dans le manifest.
- La generation du pack n'ecrit jamais sur `workpaper`, `workpaper_evidence`, `document` ou `document_verification`.
- La generation commence par figer un ensemble source compose des IDs et metadonnees inclus dans le pack, avant toute ecriture de l'objet d'export en storage ou en DB.
- Les binaires inclus correspondent exactement a cet ensemble source fige.
- Aucune mutation concurrente posterieure a ce gel ne peut modifier le contenu logique du pack en cours de generation.
- Le `ZIP`, le `manifest.json`, les fichiers JSON inclus et les `archivePath` sont produits de facon strictement deterministe.
- `workpapers[]` est trie par `anchorCode` puis `workpaperId`.
- `documents[]` est trie par `documentId`.
- Les chemins d'archive et les fichiers JSON inclus dans le `ZIP` sont tries lexicographiquement.
- Aucune partie du pack ne depend de l'ordre naturel d'une map, d'un listing storage ou d'une requete non ordonnee.
- La V1 n'introduit ni GraphQL, ni PDF statutaire, ni annexe generative, ni IA runtime.
- La future implementation ne modifie pas `V6`, `V7` ni `V8` ; une migration `V9` dediee sera necessaire.
- Une couture modulaire propre `workpapers::access` sera necessaire pour cette spec, mais n'est pas implemente par cette mission.
- Les vocabulaires RBAC et `storage_backend` reutilisent strictement les enums canoniques deja existants du repo au moment de l'implementation ; aucun vocabulaire parallele n'est autorise.
- Les roles canoniques reutilises par cette spec sont ceux de `TenantRole` :
  - `ACCOUNTANT`
  - `REVIEWER`
  - `MANAGER`
  - `ADMIN`
- Le RBAC V1 exact est :
  - `POST /api/closing-folders/{closingFolderId}/export-packs` : `ACCOUNTANT`, `MANAGER`, `ADMIN`
  - `GET /api/closing-folders/{closingFolderId}/export-packs` : `ACCOUNTANT`, `REVIEWER`, `MANAGER`, `ADMIN`
  - `GET /api/closing-folders/{closingFolderId}/export-packs/{exportPackId}` : `ACCOUNTANT`, `REVIEWER`, `MANAGER`, `ADMIN`
  - `GET /api/closing-folders/{closingFolderId}/export-packs/{exportPackId}/content` : `ACCOUNTANT`, `REVIEWER`, `MANAGER`, `ADMIN`
- `POST /api/closing-folders/{closingFolderId}/export-packs` exige un header `Idempotency-Key` non vide.
- Pour `POST /api/closing-folders/{closingFolderId}/export-packs`, `(tenantId, closingFolderId, Idempotency-Key)` identifie une seule generation logique cote serveur.
- L'idempotence de `POST /api/closing-folders/{closingFolderId}/export-packs` est persistee durablement en base ; aucune idempotence en memoire seule n'a de valeur contractuelle en V1.
- En V1, `export_pack` est la seule memoire durable d'idempotence.
- Le mecanisme minimal V1 repose sur la future persistance `export_pack` elle-meme, avec `idempotency_key` et `source_fingerprint` non nuls.
- `source_fingerprint` represente l'intention logique figee et est derive au minimum de l'ensemble source gele, `basisImportVersion` et `basisTaxonomyVersion`.
- `source_fingerprint` reste un artefact interne d'idempotence ; il n'est pas expose par le contrat API V1.
- Une contrainte d'unicite future existe sur `(tenant_id, closing_folder_id, idempotency_key)`.
- Apres validation de `auth`, `X-Tenant-Id`, RBAC et resolution tenant-safe du closing folder, le serveur verifie d'abord s'il existe deja une generation logique reussie pour `(tenant_id, closing_folder_id, idempotency_key)`.
- L'intention logique associee a cette cle est celle de la premiere generation acceptee pour ce triplet, incluant l'ensemble source fige et la paire `basisImportVersion` / `basisTaxonomyVersion` du pack.
- Une premiere generation logique reussie cree exactement un export pack immutable distinct.
- Un retry avec le meme `Idempotency-Key` sur le meme tenant et le meme closing folder, pour la meme intention logique, ne cree jamais une deuxieme ligne `export_pack`, un deuxieme objet storage ni un deuxieme `audit_event` metier.
- Un replay `200 OK` n'est autorise que si la meme cle retrouve le meme `exportPackId` et le meme `source_fingerprint` persiste.
- Ce replay `200 OK` reste valide meme si, depuis la premiere reussite, le closing est devenu `ARCHIVED` ou si `controls.readiness != READY`.
- Les gates metier courants `closing ARCHIVED` et `controls.readiness != READY` ne s'appliquent que s'il n'existe pas encore de generation logique reussie pour cette cle.
- Si une tentative echoue avant toute persistance durable de `export_pack`, la cle n'est pas reservee durablement en V1.
- Une reutilisation ulterieure de la meme cle apres un tel echec est traitee comme une nouvelle tentative.
- Pour deux `POST` concurrents equivalents avec le meme `tenant_id`, le meme `closing_folder_id`, le meme `Idempotency-Key` et le meme `source_fingerprint`, une seule requete peut executer la generation physique.
- Les autres requetes concurrentes equivalentes se resolvent en `200 OK` avec le meme `exportPackId` une fois le succes du gagnant persiste.
- Une nouvelle generation volontaire du meme closing folder reste autorisee, mais elle exige un nouveau `Idempotency-Key`.
- La reutilisation du meme `Idempotency-Key` avec une intention logique differente retourne `409 Conflict` seulement si une generation logique reussie deja persistee existe pour cette cle, ou si une requete concurrente finit par persister cette cle avant resolution.
- Garantir ce `409 Conflict` meme apres un echec sans ligne `export_pack` persistee requerrait un mecanisme durable distinct, hors scope V1.
- Des requetes concurrentes equivalentes ne doivent jamais produire plus d'une ligne `export_pack` persistee, plus d'un objet storage ni plus d'un `EXPORT_PACK.CREATED`.
- Exactly one successful logical generation = exactly one `EXPORT_PACK.CREATED`.

## In-scope

- module proprietaire `exports`
- generation synchrone d'un export pack audit-ready immutable
- lecture liste / metadata / contenu d'export packs existants
- assemblage deterministe d'une archive `ZIP`
- manifest explicite et stable
- inclusion des snapshots JSON des read-models existants :
  - `controls`
  - `financial-summary`
  - `financial-statements-structured`
  - `workpapers` courants persistants uniquement
- inclusion des binaires documentaires visibles depuis les current workpapers
- persistance future des metadata d'export pack, tenant-scopees
- storage prive et download backend-only
- audit `EXPORT_PACK.CREATED` sur generation reussie uniquement
- tests unitaires, API, storage, PostgreSQL optionnels et verification Modulith

## Out-of-scope

- frontend riche
- GraphQL
- IA active ou runtime IA
- PDF statutaire
- annexe generative
- stale workpapers dans le contenu du pack
- filtrage des documents selon `verificationStatus`
- signed URLs publiques
- exposition de `storage_object_key`
- suppression, edition, rename ou versioning d'un export pack
- background job, queue, retry asynchrone, polling de statut
- modification des migrations `V6`, `V7`, `V8`
- modification des read-models financiers, `workpapers` ou `documents` existants a l'occasion de cette spec

## Invariants metier

- Le pack represente le snapshot fige au moment du gel de l'ensemble source.
- Le pack reste derive des briques existantes du repo ; il ne recalcul pas de verite financiere additionnelle.
- Les previews financieres incluses restent explicitement non statutaires et non export final statutaire.
- La generation n'ajoute ni validation implicite ni approbation metier automatique.
- Le pack peut etre genere meme si zero current workpaper persiste ou zero document n'est present, tant que les preconditions de generation sont satisfaites.
- Seuls les current workpapers persistants sont inclus.
- Les current anchors sans `workpaper` persiste ne sont pas serialises comme workpapers du pack.
- Les documents attaches aux current workpapers sont inclus quels que soient leurs statuts `UNVERIFIED`, `VERIFIED` ou `REJECTED`.
- Les `staleWorkpapers[]` n'entrent jamais dans le pack, ni comme metadata, ni comme binaire, ni comme resume.
- Le pack est immutable apres creation.
- Toute mutation concurrente posterieure au gel ne modifie pas le contenu logique du pack.
- Au niveau `export_pack` et `manifest.json`, `basisImportVersion` et `basisTaxonomyVersion` sont derives du snapshot de closing fige utilise pour produire les snapshots inclus de `controls`, `financial-summary` et `financial-statements-structured`.
- La paire canonique du pack est donc celle du snapshot financier fige sous-jacent :
  - `basisImportVersion` correspond au `latestImportVersion` du meme snapshot
  - `basisTaxonomyVersion` correspond au `taxonomyVersion` du meme snapshot
- Dans un pack coherent :
  - `controls.latestImportVersion`
  - `financial-summary.latestImportVersion`
  - `financial-statements-structured.latestImportVersion`
  - `export_pack.basisImportVersion`
  - `manifest.json.basisImportVersion`
  doivent tous pointer vers la meme version d'import du snapshot fige
- Dans un pack coherent :
  - `financial-statements-structured.taxonomyVersion`
  - `export_pack.basisTaxonomyVersion`
  - `manifest.json.basisTaxonomyVersion`
  doivent tous pointer vers la meme version de taxonomie du snapshot fige

## Invariants securite / tenancy / audit

- Toute persistance future est tenant-scopee avec `tenant_id` obligatoire.
- Aucun acces cross-tenant n'est autorise.
- Aucun repository ne contourne le scoping tenant.
- Le closing folder et l'export pack doivent toujours etre resolves dans le meme tenant.
- Les documents inclus doivent toujours etre resolus via des current workpapers appartenant au meme tenant et au meme closing folder.
- Les binaires restent en storage prive.
- Le download reste backend-only.
- Aucune signed URL publique n'est exposee.
- Aucune `storage_object_key` n'est retournee au client.
- `GET` liste / metadata / contenu n'ecrivent aucun `audit_event`.
- Les refus de generation n'ecrivent aucun `audit_event`.
- Les echecs techniques de generation n'ecrivent aucun `audit_event` metier.
- Une generation reussie ecrit exactement un `audit_event` structure avec :
  - `action = EXPORT_PACK.CREATED`
  - `resource_type = EXPORT_PACK`
  - `resource_id = exportPackId`
  - `metadata` minimale :
    - `closingFolderId`
    - `basisImportVersion`
    - `basisTaxonomyVersion`
- Le pack n'ecrit jamais sur les aggregates source `financials`, `workpapers` ou `documents`.
- Le RBAC applique strictement la matrice explicite definie dans `Decisions V1 fermes` ; la spec n'introduit aucun vocabulaire de roles propre a `exports`.

## Boundaries modulaires / acces inter-modules

- `exports` reste un module proprietaire distinct.
- L'implementation future reste compatible avec le monolithe modulaire et `ApplicationModules.verify()`.
- `exports` ne doit pas appeler d'endpoint HTTP interne.
- `exports` ne doit pas acceder directement aux repositories d'autres modules.
- Les lectures de gating doivent passer par `controls::access`, deja present.
- Les lectures des read-models financiers doivent passer par des coutures explicites cote `financials`, pas par HTTP ni par repository cross-module.
- La couture `financials::access` existante pour `WorkpaperAnchorAccess` ne suffit pas a elle seule pour exposer les read-models financiers du pack ; l'implementation future devra rester dans une couture explicite.
- Une couture modulaire propre `workpapers::access` est requise pour exposer au module `exports` :
  - les current workpapers persistants uniquement
  - leurs `documents[]` visibles
  - leur `documentVerificationSummary`
  - un acces backend-safe au contenu binaire uniquement pour les `documentId` selectionnes dans l'ensemble source fige
  - jamais de `storage_object_key` expose hors du module proprietaire du storage
- Cette spec constate ce besoin et le fige, sans l'implementer maintenant.
- Les dependances modulaires futures attendues pour `exports` sont bornees a :
  - `shared::application`
  - `identity::access`
  - `closing::access`
  - `controls::access`
  - coutures explicites cote `financials`
  - future couture explicite `workpapers::access`

## API a introduire plus tard

Les contrats OpenAPI ne sont pas ecrits par cette mission. L'intention V1 a introduire plus tard est :

- `POST /api/closing-folders/{closingFolderId}/export-packs`
  - genere synchronement un nouveau pack immutable
  - roles autorises : `ACCOUNTANT`, `MANAGER`, `ADMIN`
  - header requis : `Idempotency-Key`
  - `400 Bad Request` si `Idempotency-Key` est absent ou vide
  - apres validation de `auth`, `X-Tenant-Id`, RBAC et resolution du closing folder dans le tenant, le serveur verifie d'abord s'il existe deja une generation logique reussie pour `(tenant_id, closing_folder_id, idempotency_key)`
  - `200 OK` pour un replay reussi avec le meme `Idempotency-Key` et le meme `exportPackId`, apres verification serveur du meme `source_fingerprint` persiste
  - `409 Conflict` si une generation logique reussie deja persistee existe pour cette cle avec un `source_fingerprint` different
  - ce controle fonde sur un succes deja persiste reste valide meme si le closing est devenu `ARCHIVED` ou si `controls.readiness != READY` depuis la premiere reussite
  - `source_fingerprint` reste interne et n'est pas expose dans le contrat API V1
  - si aucune generation logique reussie n'existe encore pour cette cle, `201` pour la premiere generation logique reussie
  - si aucune generation logique reussie n'existe encore pour cette cle, tout refus metier previsible retourne `409 Conflict`
  - cela couvre explicitement :
    - closing folder `ARCHIVED`
    - `controls.readiness != READY`
    - incoherence de `basisImportVersion` / `basisTaxonomyVersion` avec un current workpaper inclus
  - si une tentative precedente a echoue avant toute persistance durable de `export_pack`, la meme cle est traitee comme une nouvelle tentative
  - si une requete concurrente persiste la meme cle en premier avec un `source_fingerprint` different, l'autre requete se resout en `409 Conflict`
  - garantir ce `409 Conflict` meme apres un echec sans ligne `export_pack` persistee requerrait un mecanisme durable distinct, hors scope V1
  - ces refus metier n'emettent aucun `201` et aucun `audit_event` metier
- `GET /api/closing-folders/{closingFolderId}/export-packs`
  - liste les packs deja generes pour le closing folder
  - roles autorises : `ACCOUNTANT`, `REVIEWER`, `MANAGER`, `ADMIN`
  - lecture autorisee sur closing courant ou `ARCHIVED`
  - aucun audit
- `GET /api/closing-folders/{closingFolderId}/export-packs/{exportPackId}`
  - retourne les metadata du pack
  - roles autorises : `ACCOUNTANT`, `REVIEWER`, `MANAGER`, `ADMIN`
  - lecture autorisee sur closing courant ou `ARCHIVED`
  - aucun audit
- `GET /api/closing-folders/{closingFolderId}/export-packs/{exportPackId}/content`
  - telecharge l'archive `ZIP` via le backend
  - roles autorises : `ACCOUNTANT`, `REVIEWER`, `MANAGER`, `ADMIN`
  - lecture autorisee sur closing courant ou `ARCHIVED`
  - `Content-Disposition: attachment`
  - `Cache-Control: private, no-store`
  - contenu `application/zip`
  - aucun audit

## DB a introduire plus tard

Les contrats DB et la migration Flyway ne sont pas ecrits par cette mission. L'intention V1 a introduire plus tard est :

- une migration dediee `V9__spec_013_exports_audit_ready_v1.sql`
- une seule nouvelle table metier immutable `export_pack`
- aucun changement sur `V6`, `V7` ou `V8`

Colonnes minimales attendues cote `export_pack` :

- `id`
- `tenant_id`
- `closing_folder_id`
- `idempotency_key`
- `source_fingerprint`
- `storage_backend`
- `storage_object_key`
- `file_name`
- `media_type`
- `byte_size`
- `checksum_sha256`
- `basis_import_version`
- `basis_taxonomy_version`
- `created_at`
- `created_by_user_id`

Regles minimales attendues :

- `tenant_id` obligatoire
- `idempotency_key` obligatoire
- `source_fingerprint` obligatoire
- FK composite tenant-scopee vers `closing_folder`
- indexes commencant par `tenant_id`
- contrainte d'unicite sur `(tenant_id, closing_folder_id, idempotency_key)`
- `media_type = application/zip`
- `byte_size > 0`
- `checksum_sha256` normalise en hex lowercase sur 64 caracteres
- `source_fingerprint` represente l'intention logique figee et est derive au minimum de l'ensemble source gele, `basis_import_version` et `basis_taxonomy_version`
- l'idempotence de `POST /export-packs` est arbitree par cette persistance durable et jamais par un etat memoire seul
- en V1, `export_pack` est la seule memoire durable d'idempotence
- un replay `200 OK` n'est autorise que si la meme cle retrouve la meme ligne `export_pack`, le meme `exportPackId` et le meme `source_fingerprint` persiste
- `source_fingerprint` reste interne et n'est pas expose par le contrat API V1
- meme `(tenant_id, closing_folder_id, idempotency_key)` avec `source_fingerprint` different retourne `409 Conflict` seulement si une ligne `export_pack` existe deja pour cette cle, ou si une requete concurrente la persiste avant resolution
- si une tentative echoue avant creation de la ligne `export_pack`, aucune reservation durable de la cle n'existe en V1 ; une reutilisation ulterieure de cette cle est traitee comme une nouvelle tentative
- garantir ce `409 Conflict` au-dela de cette persistance requerrait un mecanisme durable distinct, hors scope V1
- `storage_backend` reemploie strictement l'enum canonique deja present dans le repo pour le storage prive ; aucun backend ou libelle parallele n'est introduit par `exports`
- une ligne `export_pack` n'est jamais modifiee apres creation
- aucun `storage_object_key` n'est expose aux clients

## Regles de generation du pack

- La generation est synchrone dans la requete HTTP qui la declenche.
- Preconditions obligatoires :
  - auth valide
  - `X-Tenant-Id` valide
  - closing folder resolu dans le tenant
  - role autorise
  - `Idempotency-Key` non vide
- La generation lit uniquement des read-models et des contenus binaires existants.
- La generation n'ecrit jamais sur `financial-summary`, `financial-statements-structured`, `workpaper`, `workpaper_evidence`, `document` ou `document_verification`.
- Apres validation de `auth`, `X-Tenant-Id`, RBAC et resolution du closing folder dans le tenant, le serveur verifie d'abord s'il existe deja une generation logique reussie pour `(tenant_id, closing_folder_id, idempotency_key)`.
- Si une generation logique reussie existe deja et que le `source_fingerprint` correspond, le serveur retourne `200 OK` avec le meme `exportPackId`.
- Si une generation logique reussie existe deja et que le `source_fingerprint` differe, le serveur retourne `409 Conflict`, sans nouveau pack ni audit.
- Ce controle fonde sur un succes deja persiste reste valide meme si, depuis la premiere reussite, le closing est devenu `ARCHIVED` ou si `controls.readiness != READY`.
- Les gates metier courants `closing ARCHIVED` et `controls.readiness != READY` ne s'appliquent que s'il n'existe pas encore de generation logique reussie pour cette cle.
- Si aucune generation logique reussie n'existe encore pour cette cle, toute impossibilite metier previsible de generer le pack retourne `HTTP 409 Conflict`.
- Cela couvre explicitement :
  - closing folder `ARCHIVED`
  - `controls.readiness != READY`
  - incoherence de `basisImportVersion` / `basisTaxonomyVersion` avec un current workpaper inclus
- Si une tentative precedente echoue avant toute persistance durable de `export_pack`, la meme cle est traitee comme une nouvelle tentative.
- Pour ces refus metier :
  - aucun `201`
  - aucun `audit_event` metier
- Les `5xx` sont reserves aux echecs techniques inattendus, jamais aux refus metier previsibles.
- Pour `POST /export-packs`, `(tenantId, closingFolderId, Idempotency-Key)` identifie une seule generation logique.
- La generation commence par figer un ensemble source compose :
  - des current workpapers persistants selectionnes
  - des `documentId` visibles depuis ces current workpapers
  - des metadonnees source et snapshots de read-models inclus dans le pack
- Ce gel intervient avant toute ecriture de l'objet d'export en storage ou en DB.
- L'idempotence de `POST /export-packs` est arbitree par persistance durable en base et jamais par un etat memoire seul.
- En V1, `export_pack` est la seule memoire durable d'idempotence.
- `source_fingerprint` est calcule de facon deterministe a partir de cet ensemble source fige, au minimum avec la paire `basisImportVersion` / `basisTaxonomyVersion`.
- L'intention logique associee a la cle d'idempotence est celle de la premiere generation acceptee pour ce triplet et inclut cet ensemble source fige ainsi que la paire `basisImportVersion` / `basisTaxonomyVersion` du pack.
- Le pack est ensuite assemble exclusivement a partir de cet ensemble source fige.
- `basisImportVersion` et `basisTaxonomyVersion` du pack sont derives de ce meme snapshot de closing fige utilise pour produire `controls`, `financial-summary` et `financial-statements-structured`.
- Les current workpapers inclus sont uniquement les `items[]` courants pour lesquels `workpaper != null`.
- Les `staleWorkpapers[]` sont ignores integralement.
- Les documents inclus sont uniquement ceux visibles depuis ces current workpapers persistants.
- Aucun document n'est filtre selon son `verificationStatus`.
- Tout current workpaper inclus doit verifier :
  - `workpaper.basisImportVersion = export_pack.basisImportVersion`
  - `workpaper.basisTaxonomyVersion = export_pack.basisTaxonomyVersion`
- Toute incoherence sur cette paire entre le pack et un current workpaper inclus fait echouer la generation.
- Les binaires inclus correspondent exactement aux `documentId` presents dans l'ensemble source fige.
- Aucune mutation concurrente posterieure au gel ne peut modifier le contenu logique du pack en cours de generation.
- `workpapers[]` est trie par `anchorCode` puis `workpaperId`.
- `documents[]` est trie par `documentId`.
- Les fichiers JSON et les chemins d'archive du `ZIP` sont emis en ordre lexicographique.
- Aucune partie de l'assemblage ne depend de l'ordre naturel d'une map, d'un listing storage ou d'une requete non ordonnee.
- La premiere generation logique reussie cree exactement une nouvelle archive et une nouvelle ligne `export_pack` portant `idempotency_key` et `source_fingerprint`.
- La contrainte d'unicite sur `(tenant_id, closing_folder_id, idempotency_key)` est le garde-fou minimal de concurrence et de retry cote base.
- Un replay avec le meme `Idempotency-Key` n'est autorise en `200 OK` que s'il retrouve le meme `exportPackId` et le meme `source_fingerprint` persiste ; dans ce cas il ne cree ni nouvelle archive, ni nouvelle ligne `export_pack`, ni nouvel `audit_event`.
- Ce replay `200 OK` est resolu avant evaluation des gates metier courants `closing ARCHIVED` et `controls.readiness != READY`.
- Pour deux requetes concurrentes equivalentes avec le meme `Idempotency-Key` et le meme `source_fingerprint`, une seule peut executer la generation physique ; les autres attendent le succes persiste puis retournent `200 OK` avec le meme `exportPackId`.
- Le meme `(tenantId, closingFolderId, Idempotency-Key)` avec un `source_fingerprint` different retourne `409 Conflict` seulement si une ligne `export_pack` a deja ete persistee pour cette cle, ou si une requete concurrente persiste cette cle avant resolution.
- Des requetes concurrentes equivalentes ne doivent jamais produire plus d'une ligne `export_pack` persistee, plus d'un objet storage ni plus d'un `EXPORT_PACK.CREATED`.
- Si la generation echoue avant la reponse de succes, aucun succes n'est retourne et aucun `audit_event` metier n'est emis.
- Si la generation echoue avant toute persistance durable de `export_pack`, la cle n'est pas reservee durablement ; une reutilisation ulterieure de cette cle est traitee comme une nouvelle tentative.
- Si `201` est retourne, la ligne `export_pack` et l'archive privee correspondante existent.
- Si `200 OK` est retourne sur replay, la meme ligne `export_pack` et la meme archive privee existent deja.
- Si l'ecriture storage reussit et que la persistance DB echoue, aucun `201` n'est retourne, aucun `audit_event` metier n'est emis et une suppression best-effort de l'objet storage est tentee.
- Tout objet storage orphelin eventuel reste purement technique, non reference en DB et inatteignable via l'API.

## Regles de contenu du manifest

Le pack `ZIP` contient obligatoirement :

- `manifest.json`
- `read-models/controls.json`
- `read-models/financial-summary.json`
- `read-models/financial-statements-structured.json`
- `read-models/workpapers-current.json`
- `documents/...` pour les binaires inclus

Le `manifest.json` expose obligatoirement :

- `exportPackId`
- `closingFolderId`
- `closingFolderStatus`
- `generatedAt`
- `generatedByUserId`
- `basisImportVersion`
- `basisTaxonomyVersion`
- `controlsReadiness`
- `includesStaleWorkpapers = false`
- `paths`
  - `controls`
  - `financialSummary`
  - `financialStatementsStructured`
  - `workpapersCurrent`
- `summary`
  - `currentWorkpapersCount`
  - `documentsCount`
  - `unverifiedDocumentsCount`
  - `verifiedDocumentsCount`
  - `rejectedDocumentsCount`
- `workpapers[]`

Chaque entree de `workpapers[]` expose obligatoirement :

- metadata d'anchor :
  - `anchorCode`
  - `anchorLabel`
  - `summaryBucketCode`
  - `statementKind`
  - `breakdownType`
- metadata du workpaper :
  - `workpaperId`
  - `status`
  - `noteText`
  - `reviewComment`
  - `basisImportVersion`
  - `basisTaxonomyVersion`
  - `createdAt`
  - `createdByUserId`
  - `updatedAt`
  - `updatedByUserId`
  - `reviewedAt`
  - `reviewedByUserId`
- `documentVerificationSummary`
- `evidences[]` legacy metadata-only, si presentes
- `documents[]`

Chaque entree de `documents[]` expose obligatoirement :

- `documentId`
- `fileName`
- `mediaType`
- `byteSize`
- `checksumSha256`
- `sourceLabel`
- `documentDate`
- `createdAt`
- `createdByUserId`
- `verificationStatus`
- `reviewComment`
- `reviewedAt`
- `reviewedByUserId`
- `archivePath`

Regles de manifest supplementaires :

- `verificationStatus` est toujours explicite pour chaque document.
- `workpapers[]` est trie par `anchorCode` puis `workpaperId`.
- Chaque `documents[]` est trie par `documentId`.
- `archivePath` suit la convention stable `documents/{workpaperId}/{documentId}-{sanitizedFileName}`.
- `sanitizedFileName` est derive uniquement de `fileName` en neutralisant les separateurs de chemin, les URLs et les caracteres de controle ; il reste independant de tout backend physique.
- `archivePath` est construit uniquement a partir d'identifiants metier internes du pack et de `sanitizedFileName`.
- `archivePath` ne contient jamais de `storage_object_key`, d'URL ni de chemin dependant d'un backend physique.
- `storage_object_key` n'apparait jamais dans le manifest.
- Les entrees du `ZIP` sont ordonnees lexicographiquement par chemin d'archive.
- `workpapers-current.json` ne contient que des current workpapers persistants et aucun `staleWorkpapers[]`.
- Les fichiers JSON du pack sont des snapshots derives des read-models existants, sans schema alternatif V1.
- Aucun fichier JSON du pack ne depend de l'ordre naturel d'une map ou d'une requete non ordonnee.
- `manifest.json.basisImportVersion` doit etre identique a `export_pack.basisImportVersion`.
- `manifest.json.basisTaxonomyVersion` doit etre identique a `export_pack.basisTaxonomyVersion`.
- `manifest.json.basisImportVersion` doit etre coherent avec `controls.latestImportVersion`, `financial-summary.latestImportVersion` et `financial-statements-structured.latestImportVersion` du meme pack.
- `manifest.json.basisTaxonomyVersion` doit etre coherent avec `financial-statements-structured.taxonomyVersion` du meme pack.

## Regles de storage et download

- Le pack est stocke en object storage prive uniquement.
- La V1 reutilise strictement l'enum canonique de storage backend deja present dans le repo pour le storage prive ; cette spec n'introduit aucun vocabulaire parallele.
- Le contenu du pack n'est jamais servi par URL publique.
- Le telechargement passe toujours par le backend.
- Le client ne recoit ni `storage_object_key`, ni URL signee, ni URL publique.
- Les lectures liste / metadata / contenu restent autorisees sur closing courant et `ARCHIVED`.
- La generation d'un nouveau pack est refusee sur closing `ARCHIVED`.
- Le download renvoie `Content-Disposition: attachment`.
- Le download renvoie `Cache-Control: private, no-store`.
- Le download du pack est une lecture silencieuse dans `audit_event`.

## Validation / tests attendus

### Unit tests

- gate `ARCHIVED` rejete a la generation
- gate `controls.readiness = READY` requis
- `Idempotency-Key` requis pour `POST /export-packs`
- gel de l'ensemble source avant toute ecriture storage ou DB
- `source_fingerprint` derive deterministement de l'ensemble source gele et de `basisImportVersion` / `basisTaxonomyVersion`
- derivation canonique de `basisImportVersion` / `basisTaxonomyVersion` depuis le meme snapshot de closing fige que `controls`, `financial-summary` et `financial-statements-structured`
- verification du replay idempotent reussi avant evaluation des gates metier courants
- le pack represente le snapshot fige au moment du gel de l'ensemble source
- current workpapers uniquement
- exclusion stricte de `staleWorkpapers[]`
- inclusion des documents `UNVERIFIED`, `VERIFIED`, `REJECTED`
- echec si un current workpaper inclus n'est pas coherent avec la paire `basisImportVersion` / `basisTaxonomyVersion` du pack
- meme tenant + meme closing folder + meme `Idempotency-Key` + meme intention logique = une seule generation logique
- replay avec meme `Idempotency-Key` = meme `exportPackId`, meme `source_fingerprint` persiste, aucune deuxieme ligne `export_pack`, aucun deuxieme objet storage, aucun deuxieme `audit_event`
- replay `200 OK` avec meme cle et meme `source_fingerprint` reste valide meme si le closing est devenu `ARCHIVED` ou si `controls.readiness != READY`
- deux `POST` concurrents equivalents = une seule generation physique, puis `200 OK` avec le meme `exportPackId` pour les autres une fois le succes persiste
- meme `Idempotency-Key` reutilise avec une intention logique differente apres succes persiste = `409 Conflict`, sans nouveau pack ni audit
- meme `Idempotency-Key` reutilise apres echec sans ligne `export_pack` persistee = nouvelle tentative, pas de conflit garanti sur l'ancienne intention
- aucune idempotence en memoire seule n'est acceptee
- manifest sans `storage_object_key`
- ordonnancement strict : `workpapers[]` par `anchorCode` puis `workpaperId`, `documents[]` par `documentId`, chemins d'archive et fichiers JSON par ordre lexicographique
- convention stable `archivePath = documents/{workpaperId}/{documentId}-{sanitizedFileName}`
- zero write sur `workpapers` et `documents`
- exactly one successful logical generation = exactly one `EXPORT_PACK.CREATED` avec `resource_type = EXPORT_PACK`, `resource_id = exportPackId` et metadata minimale attendue

### API tests

- auth / header / tenant / RBAC
- matrice RBAC exacte :
  - `POST /export-packs` : `ACCOUNTANT`, `MANAGER`, `ADMIN`
  - `GET /export-packs` : `ACCOUNTANT`, `REVIEWER`, `MANAGER`, `ADMIN`
  - `GET /export-packs/{exportPackId}` : `ACCOUNTANT`, `REVIEWER`, `MANAGER`, `ADMIN`
  - `GET /export-packs/{exportPackId}/content` : `ACCOUNTANT`, `REVIEWER`, `MANAGER`, `ADMIN`
- `POST /export-packs` retourne `400 Bad Request` si `Idempotency-Key` est absent ou vide
- `POST /export-packs` retourne `201` pour la premiere generation logique reussie
- `POST /export-packs` retourne `200 OK` sur replay reussi uniquement si le meme `Idempotency-Key` retrouve le meme `exportPackId` apres verification serveur du meme `source_fingerprint` persiste
- `POST /export-packs` verifie d'abord le replay idempotent reussi apres validation de `auth`, `X-Tenant-Id`, RBAC et resolution du closing folder
- `POST /export-packs` retourne `200 OK` sur replay reussi meme si le closing est devenu `ARCHIVED` depuis la premiere reussite
- `POST /export-packs` retourne `200 OK` sur replay reussi meme si `controls.readiness != READY` depuis la premiere reussite
- `POST /export-packs` n'expose pas `source_fingerprint` dans le contrat API
- sur deux `POST /export-packs` concurrents equivalents, une seule reponse peut etre `201` et les autres se resolvent en `200 OK` avec le meme `exportPackId` une fois le succes du gagnant persiste
- `POST /export-packs` retourne `409 Conflict` pour tout refus metier previsible seulement s'il n'existe pas deja de generation logique reussie pour cette cle
- `POST /export-packs` retourne `409 Conflict` sur closing `ARCHIVED` seulement s'il n'existe pas deja de generation logique reussie pour cette cle
- `POST /export-packs` retourne `409 Conflict` si `controls.readiness != READY` seulement s'il n'existe pas deja de generation logique reussie pour cette cle
- `POST /export-packs` retourne `409 Conflict` sans audit si incoherence `basisImportVersion` / `basisTaxonomyVersion` avec un current workpaper inclus
- `POST /export-packs` retourne `409 Conflict` sans nouveau pack ni audit si le meme `Idempotency-Key` rencontre un succes deja persiste avec un `source_fingerprint` different
- `POST /export-packs` traite la meme cle comme une nouvelle tentative si la tentative precedente a echoue avant toute ligne `export_pack` persistee
- `POST /export-packs` retourne `409 Conflict` si une requete concurrente persiste la meme cle en premier avec un `source_fingerprint` different
- `GET` liste / metadata / contenu autorises sur closing courant et `ARCHIVED`
- zero audit sur tous les `GET`
- zero audit sur refus et echecs
- les `5xx` sont reserves aux echecs techniques inattendus, jamais aux refus metier previsibles de `POST /export-packs`
- `EXPORT_PACK.CREATED` exact une seule fois par generation logique reussie avec `resource_type = EXPORT_PACK`, `resource_id = exportPackId` et metadata minimale attendue
- aucun champ de reponse n'expose `storage_object_key`
- download `application/zip`, `Content-Disposition`, `Cache-Control`

### DB integration tests

- Flyway from scratch jusqu'a `V9`
- FK composites tenant-scopees
- indexes commencant par `tenant_id`
- `idempotency_key` non nul
- `source_fingerprint` non nul
- contrainte d'unicite sur `(tenant_id, closing_folder_id, idempotency_key)`
- meme tenant + meme closing folder + meme `Idempotency-Key` ne persiste jamais une deuxieme ligne `export_pack`
- meme tenant + meme closing folder + meme `Idempotency-Key` + meme `source_fingerprint` retrouve la meme ligne `export_pack`
- meme tenant + meme closing folder + meme `Idempotency-Key` + `source_fingerprint` different retourne un conflit seulement si une ligne `export_pack` existe deja pour cette cle, ou si une requete concurrente la persiste avant resolution
- absence de ligne `export_pack` apres echec avant persistance = aucune reservation durable de la cle
- requetes concurrentes equivalentes avec le meme `Idempotency-Key` et le meme `source_fingerprint` ne produisent jamais plus d'une ligne `export_pack` persistee
- checks DB sur `byte_size`, `checksum_sha256`, `media_type`
- immutabilite de `export_pack`
- aucune regression sur `V6`, `V7`, `V8`

### Storage consistency tests

- si `201` est renvoye, la ligne DB et l'objet storage existent
- si un replay reussi est renvoye pour le meme `Idempotency-Key`, aucun deuxieme objet storage n'existe
- si des requetes concurrentes equivalentes utilisent le meme `Idempotency-Key` et le meme `source_fingerprint`, aucun deuxieme objet storage n'est cree
- si des requetes concurrentes equivalentes utilisent le meme `Idempotency-Key` et le meme `source_fingerprint`, les perdantes se resolvent en `200 OK` avec le meme `exportPackId` une fois le succes du gagnant persiste
- si le storage echoue avant la persistance DB, aucun succes n'est retourne
- si la persistance DB echoue apres ecriture storage, une compensation best-effort est tentee
- si la persistance DB echoue apres ecriture storage, aucun `201` ni aucun `audit_event` metier n'est emis
- tout objet storage orphelin eventuel reste non reference en DB et inatteignable via l'API
- aucun audit metier additionnel n'est emis par cette compensation

### Modulith

- dependances de `exports` bornees aux coutures explicites
- aucun acces repository direct cross-module
- aucune dependance HTTP interne
- presence d'une couture explicite `workpapers::access` exposant seulement les current workpapers persistants, leurs documents visibles, leur `documentVerificationSummary` et un acces backend-safe au contenu binaire des `documentId` selectionnes

## Risques et limites V1

- La generation synchrone peut devenir couteuse en temps ou en memoire sur de gros dossiers.
- La V1 n'apporte ni reprise sur incident, ni retry asynchrone, ni progression de job.
- Le pack reste non statutaire ; il ne remplace ni un export final CO, ni une annexe, ni un livrable PDF.
- Le pack exclut volontairement les `staleWorkpapers[]`, meme si ces traces restent lisibles ailleurs dans le produit.
- Plusieurs packs quasi identiques peuvent coexister pour un meme closing folder.
- Le pack reflete uniquement le snapshot fige au moment du gel de l'ensemble source.

## Criteres d'acceptation

- un fichier de spec actif `013-exports-audit-ready-v1.md` existe et borne fermement la V1
- la spec reste backend-first et REST-first
- la spec interdit explicitement GraphQL, frontend riche, IA runtime, PDF statutaire et annexe generative
- la spec traite le pack comme un snapshot derive et jamais comme une nouvelle source de verite
- la spec fixe une generation synchrone uniquement
- la spec fixe `closing non ARCHIVED` et `controls.readiness = READY` comme gates de premiere generation seulement s'il n'existe pas deja de generation logique reussie pour cette cle
- la spec rend `POST /export-packs` idempotent sur retry via un header `Idempotency-Key` requis
- la spec fixe `400 Bad Request` si `Idempotency-Key` est absent ou vide
- la spec fixe `meme tenant + meme closingFolderId + meme Idempotency-Key + meme intention logique = une seule generation logique`
- la spec impose que cette idempotence soit persistee durablement en base, jamais en memoire seule
- la spec fixe `idempotency_key` non nul et `source_fingerprint` non nul dans la future persistance `export_pack`
- la spec fixe `source_fingerprint` comme representation de l'intention logique figee, au minimum fondee sur l'ensemble source gele, `basisImportVersion` et `basisTaxonomyVersion`
- la spec fixe `source_fingerprint` comme artefact interne d'idempotence et non comme champ expose du contrat API
- la spec fixe une contrainte d'unicite sur `(tenant_id, closing_folder_id, idempotency_key)`
- la spec impose qu'un replay ne cree ni deuxieme ligne `export_pack`, ni deuxieme objet storage, ni deuxieme `audit_event`
- la spec fixe `200 OK` sur replay reussi uniquement si la meme cle retrouve le meme `exportPackId` et le meme `source_fingerprint` persiste
- la spec fixe que le replay idempotent reussi est verifie avant evaluation des gates metier courants
- la spec fixe que ce replay `200 OK` reste valide meme si le closing est devenu `ARCHIVED` ou si `controls.readiness != READY` depuis la premiere reussite
- la spec fixe que le pack represente le snapshot fige au moment du gel de l'ensemble source
- la spec autorise une nouvelle generation volontaire du meme closing folder uniquement avec un nouveau `Idempotency-Key`
- la spec fixe `HTTP 409 Conflict` comme semantique unique des refus metier previsibles de `POST /export-packs` lorsqu'aucune generation logique reussie n'existe deja pour cette cle, apres validation de `auth`, `X-Tenant-Id`, RBAC et resolution du closing folder
- la spec fixe le RBAC exact par operation avec les roles canoniques `ACCOUNTANT`, `REVIEWER`, `MANAGER`, `ADMIN`
- la spec fixe un gel explicite de l'ensemble source avant toute ecriture storage ou DB
- la spec fixe un determinisme strict du `ZIP`, du `manifest.json`, des tableaux et des chemins d'archive
- la spec autorise explicitement lecture et download d'un pack existant sur closing `ARCHIVED`
- la spec fixe l'audit exact : lectures sans audit, refus sans audit, succes avec `EXPORT_PACK.CREATED` unique, `resource_type = EXPORT_PACK`, `resource_id = exportPackId` et metadata minimale attendue
- la spec interdit signed URL, URL publique et exposition de `storage_object_key`
- la spec inclut les read-models financiers existants, les current workpapers persistants uniquement et les documents visibles depuis eux
- la spec exclut explicitement `staleWorkpapers[]` du pack
- la spec impose l'exposition explicite du `verificationStatus` des documents dans le manifest
- la spec fixe la source canonique et la coherence de `basisImportVersion` / `basisTaxonomyVersion` au niveau `export_pack`, `manifest.json` et current workpapers inclus
- la spec impose une convention stable et backend-agnostic pour `archivePath`
- la spec impose `tenant_id` partout cote persistance future et interdit tout cross-tenant
- la spec impose qu'aucune generation n'ecrive sur `workpapers` ou `documents`
- la spec ferme la semantique d'echec partiel storage / DB sans succes, sans audit et avec objet orphelin inatteignable via l'API
- la spec fixe `same key + different logical intention = 409 Conflict` seulement si un `export_pack` reussi existe deja pour cette cle, ou si une requete concurrente persiste cette cle avant resolution
- la spec fixe qu'un echec avant toute persistance durable de `export_pack` ne reserve pas durablement la cle et qu'une reutilisation ulterieure de cette cle est traitee comme une nouvelle tentative
- la spec fixe que garantir ce `409 Conflict` au-dela de `export_pack` requerrait un mecanisme durable distinct, hors scope V1
- la spec impose que des requetes concurrentes equivalentes avec la meme cle et le meme `source_fingerprint` ne produisent jamais plus d'une ligne `export_pack` persistee, plus d'un objet storage ni plus d'un `EXPORT_PACK.CREATED`
- la spec fixe que ces requetes concurrentes equivalentes se resolvent en `200 OK` avec le meme `exportPackId` une fois le succes du gagnant persiste
- la spec fixe `exactly one successful logical generation = exactly one EXPORT_PACK.CREATED`
- la spec prevoit une future migration `V9` dediee sans modifier `V6` a `V8`
- la spec mentionne explicitement la future couture modulaire `workpapers::access` et son contrat comportemental minimal
