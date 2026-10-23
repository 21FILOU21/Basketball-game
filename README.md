# Basketball-game — NBA Sim Lab

Application web statique de simulation de basketball avec stockage local et import CSV/JSON. Le service optionnel Node.js ajoute une tentative de synchronisation automatique des huit tableaux de statistiques Basketball-Reference.

## Démarrage avec le service de synchronisation

Prérequis : Node.js 20 ou plus récent.

```sh
npm test
npm start
```

Le service écoute par défaut sur `http://127.0.0.1:8787`. Pour utiliser l'interface avec le service, servez également les fichiers statiques sur la même origine avec un reverse proxy qui transmet `/api/*` vers `http://127.0.0.1:8787`. Le navigateur ne peut pas exécuter un backend Node.js directement et GitHub Pages seul ne fournit pas cette API.

Variables d'environnement facultatives :
- `PORT` : port HTTP (défaut 8787).
- `HOST` : interface d'écoute (défaut 127.0.0.1; configurez explicitement l'hébergement si un accès externe est nécessaire).
- `NBA_CACHE_TTL_MS` : durée du cache serveur (défaut 6 heures).
- `NBA_SOURCE_USER_AGENT` : User-Agent descriptif pour la source.

## Sources prises en charge

Le registre centralisé cible les huit pages de la saison demandée :
- Totals — `NBA_YYYY_totals.html`
- Per Game — `NBA_YYYY_per_game.html`
- Per 36 Minutes — `NBA_YYYY_per_minute.html`
- Per 100 Possessions — `NBA_YYYY_per_poss.html`
- Advanced — `NBA_YYYY_advanced.html`
- Play-by-Play — `NBA_YYYY_play-by-play.html`
- Shooting — `NBA_YYYY_shooting.html`
- Adjusted Shooting — `NBA_YYYY_adj_shooting.html`

La table source est analysée à partir des en-têtes réellement reçus. Les valeurs brutes et les colonnes supplémentaires sont conservées dans `rawTables` pour consultation dans l'explorateur. Le service effectue des requêtes séquentielles, met en cache les réponses valides et n'essaie pas de contourner un refus HTTP, un CAPTCHA ou une protection d'accès.

## Limites importantes

La présence d'un adaptateur ne garantit pas que Basketball-Reference autorise ou serve la requête. Si la source répond 403/429, si une table manque ou si une page de blocage est détectée, la catégorie est signalée comme indisponible. La synchronisation partielle ne supprime pas les données locales existantes. Aucun nombre de lignes n'est annoncé comme récupéré tant qu'une réponse valide n'a pas été analysée.

Une application hébergée uniquement sur GitHub Pages ne peut pas exécuter `server.js`; il faut déployer le backend séparément et le relier à l'interface. La synchronisation automatique ne s'exécute qu'à l'ouverture du jeu lorsque ce service est joignable et que l'intervalle choisi a expiré; elle ne fonctionne pas en arrière-plan lorsque le navigateur est fermé.

L'import CSV/JSON existant reste disponible comme solution de repli. Les données simulées et les données officielles doivent rester distinctes.
