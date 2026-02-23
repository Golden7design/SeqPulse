# Search Bar Implementation (Site Header)

## Contexte
La barre de recherche du `site-header` existe déjà visuellement, mais elle n'est pas branchée à une logique produit.

L'objectif n'est pas seulement "chercher", mais **réduire le temps entre incertitude et action utile** après un déploiement.

## Objectif Produit
Transformer la barre en **barre de décision** :
- rassurer l'utilisateur en lui montrant rapidement l'état live pertinent
- orienter vers la bonne action (investiguer, naviguer, corriger)
- éviter la navigation en aveugle

## Comportement Utilisateur Cible
- L'utilisateur ouvre la barre après un push/deploy ou un doute.
- En moins de 10 secondes, il doit:
- comprendre s'il y a un risque
- ouvrir la bonne page
- lancer l'action suivante

## Surface Ciblée
- `frontend/components/site-header.tsx`
- données depuis `frontend/lib/dashboard-client.ts`
- navigation via routes dashboard existantes

## Scope MVP (Phase 1)
### 1. UX d'ouverture
- Focus input + `Cmd/Ctrl + K`
- Popover sous l'input avec résultats
- fermeture via `Esc`, blur, clic extérieur

### 2. Groupes de résultats
- `Live` (prioritaire): déploiement actif (`pending|running|finished|analyzed récent`)
- `Go To`: pages clés (`Dashboard`, `Projects`, `Deployments`, `SDH`, `Settings`)
- `Projects`: noms projets les plus récents
- `Deployments`: derniers `dpl_*` + verdict
- `Diagnostics`: derniers SDH critiques/warning

### 3. Requêtes supportées
- texte libre (`checkout`, `prod`, `warning`)
- id de déploiement (`dpl_123`)
- filtres simples:
- `state:running|pending|finished|analyzed`
- `verdict:warning|rollback|ok`
- `project:<name>`

### 4. Règle d'affichage
- afficher max `7` résultats
- ordre: `Live` -> `Risk` -> `Navigation` -> `Historique`
- si aucun résultat: état vide avec 3 suggestions utiles

## Ranking (MVP)
Score simple:
- `+100` si `state in [pending, running, finished]`
- `+70` si `verdict in [rollback_recommended, warning]`
- `+40` match exact id (`dpl_*`)
- `+20` match préfixe
- `+10` match partiel
- `-agePenalty` sur éléments anciens

Tie-break:
- plus récent d'abord

## Etats Live (Cycle)
Le statut live doit suivre:
- `pending` -> `running` -> `finished` -> `analyzed`

Règle de visibilité:
- la section `Live` est visible uniquement si un cycle actif existe
- `analyzed` est gardé brièvement (10-15s) puis retiré

## Intents (Action rapide)
Chaque résultat doit avoir une action explicite:
- `Open Project` -> `/dashboard/projects/[projectName]`
- `Open Deployment` -> `/dashboard/deployments/[projectName]/[deploymentId]`
- `Open Deployments (filtered)` -> `/dashboard/deployments?verdict=...`
- `Open SDH` -> `/dashboard/SDH`

## Analytics Events (obligatoire)
Tracer au minimum:
- `search_opened`
- `search_query_changed` (debounced)
- `search_result_clicked` (type, rank, latency)
- `search_no_results`

KPIs de validation:
- `time_to_first_useful_click`
- `% sessions avec résultat cliqué < 10s`
- `% requêtes sans clic`

## Performance & UX Constraints
- debounce input: `150-200ms`
- polling data source: `5s` max pour live
- aucun blocage UI pendant fetch
- fallback sur dernier cache mémoire si requête échoue

## Accessibilité
- navigation clavier complète (`↑/↓`, `Enter`, `Esc`)
- `aria-expanded`, `aria-activedescendant`, `role=listbox/option`
- focus visible, labels screen-reader

## Guardrails (éthique)
- ne pas manipuler via faux signaux d'urgence
- timestamps visibles sur items sensibles
- pas de priorisation cachée "marketing"
- transparence sur "why this result"

## Plan d'implémentation
### Étape 1
- ajouter composant `HeaderSearch` réutilisable
- brancher `site-header` à ce composant

### Étape 2
- créer `use-header-search` (state + ranking + keyboard)
- intégrer sources `deployments/projects/sdh`

### Étape 3
- ajouter tracking analytics événements
- ajouter tests unitaires ranking + navigation clavier

### Étape 4
- ajuster ranking via données réelles (1 semaine)
- passer à index backend si volume augmente

## Critères d'acceptation
- la barre trouve un déploiement en cours en moins de 2 interactions
- aucun cycle actif => pas de bloc `Live`
- `Cmd/Ctrl + K` fonctionne partout dans dashboard
- navigation clavier 100% fonctionnelle
- build + lint + typecheck OK
