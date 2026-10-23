# Suivi de la mission PR #3 — NBA Sim Lab

Dernière vérification : 2026-10-23 (UTC; heure exacte non fournie par l'outil GitHub).
Branche audit : `fix/pr3-sync-audit`.
Branche historique demandée : `feature/automatic-nba-data-sync`.
Commit de base vérifié : `3423e694c506f5323b5f28d05dc92861af02f8f9` — commit de fusion de la PR #3 dans `main`.

## État de la PR et des branches

- PR #3 : **fermée et fusionnée**, confirmée par le message du commit de tête de `main`. La demande précédente de la laisser non fusionnée n'est plus réalisable rétroactivement sans réécrire l'historique; aucune tentative de revert ou de réouverture n'est faite.
- `feature/automatic-nba-data-sync` : identique à `main` pour `app.js`, `server.js` et `package.json`; compare de branches indique `ahead_by=0`, `behind_by=1`.
- PR #2 : fermée. Son état de fusion exact n'a pas été déterminé lors de cette vérification.
- Aucun commentaire ni review GitHub n'est retourné pour la PR #3.
- Le workflow existe dans `.github/workflows/test-data-sync.yml`, mais la recherche d'exécutions pour le commit de fusion n'a retourné aucun run via l'outil disponible. Un ancien run ne prouve pas l'état du commit courant.
- Le clone local du dépôt n'a pas été possible : `git clone https://github.com/21FILOU21/Basketball-game.git /tmp/basketball-audit` a échoué car le nom d'hôte `github.com` n'a pas pu être résolu dans cet environnement. Aucun test local `npm test` n'a donc été exécuté dans cette session.

## Objectif actuel

Auditer et rendre fiable le flux de synchronisation, en commençant par les défauts prouvés par le code, puis valider une source de données autorisée. La priorité n'est pas de faire apparaître un succès artificiel, mais de prouver la chaîne source → parsing → fusion → persistance → profils → simulation.

## État des domaines au début de la reprise

| Domaine | Statut | Preuve disponible | Prochaine action |
|---|---|---|---|
| Interface | IMPLÉMENTÉ — NON TESTÉ | `index.html` contient bouton, saison, intervalle, rapport et explorateur brut | Tester les interactions dans un navigateur |
| Backend | IMPLÉMENTÉ — NON TESTÉ | `server.js` expose `GET /api/health` et `GET /api/nba/stats` | Lancer le service et tester les routes |
| Source Basketball-Reference | BLOQUÉ | Tentatives antérieures consignées à HTTP 403; aucune donnée réelle confirmée | Ne pas contourner le refus; évaluer un fournisseur autorisé |
| Totals | BLOQUÉ | Adaptateur/table attendue présents, aucune réponse réelle confirmée | Essai séparé sur une source autorisée |
| Per Game | BLOQUÉ | Adaptateur/table attendue présents, aucune réponse réelle confirmée | Essai séparé sur une source autorisée |
| Per 36 Minutes | BLOQUÉ | Adaptateur/table attendue présents, aucune réponse réelle confirmée | Essai séparé sur une source autorisée |
| Per 100 Possessions | BLOQUÉ | Adaptateur/table attendue présents, aucune réponse réelle confirmée | Essai séparé sur une source autorisée |
| Advanced | BLOQUÉ | Adaptateur/table attendue présents, aucune réponse réelle confirmée | Essai séparé sur une source autorisée |
| Play-by-Play | BLOQUÉ | Adaptateur/table attendue présents, aucune réponse réelle confirmée | Vérifier disponibilité et définition exacte chez le fournisseur |
| Shooting | BLOQUÉ | Adaptateur/table attendue présents, aucune réponse réelle confirmée | Essai séparé sur une source autorisée |
| Adjusted Shooting | BLOQUÉ | Adaptateur/table attendue présents, aucune réponse réelle confirmée | Vérifier disponibilité chez le fournisseur |
| Parsing | TESTÉ AVEC DONNÉES FICTIVES | Trois tests dans `tests/data-sync.test.js` pour registre, URL, tableau HTML, entités et CSV | Ajouter cas limites et tests d'intégration |
| Fusion | IMPLÉMENTÉ — NON TESTÉ | Fusion par nom/équipe/saison; préservation de stats non vides | Tester identifiants externes, transferts, doublons et import partiel |
| Sauvegarde locale | IMPLÉMENTÉ — NON TESTÉ | `localStorage` et fichier lié présents dans `app.js` | Vérifier après rechargement et en cas de quota/échec |
| Profils joueurs | IMPLÉMENTÉ — NON TESTÉ | `renderTable` lit les stats normalisées | Valider avec données réelles |
| Explorateur brut | IMPLÉMENTÉ — NON TESTÉ | `renderRawStatsTable` lit `rawTables` | Vérifier données réelles et colonnes |
| Simulation | IMPLÉMENTÉ — NON TESTÉ | `simulateSide` consomme usage et points par match; moteur sans substitutions | Auditer les unités et mesurer contre des matchs réels |
| Amélioration de simulation | À AUDITER | Pas de fonction identifiée lors de l'audit partiel | Chercher le libellé et ses gestionnaires dans le code complet |
| CI | À AUDITER | Workflow présent; aucun run retourné pour le SHA de fusion par l'outil disponible | Vérifier Actions sur le commit courant |
| Hébergement | À FAIRE | README décrit service local/reverse proxy; aucune URL de production confirmée | Tester `npm start` et déterminer l'hébergement réel |

## Défauts identifiés par lecture du code

1. **Paramètre d'intervalle automatique pas réellement restauré** : `data-sync.js` sauvegarde `nbaSimLab.syncIntervalHours.v1`, mais `interval()` privilégie la valeur par défaut de l'élément HTML. Après rechargement, la préférence enregistrée peut être ignorée et l'interface ne restaure pas explicitement le choix sauvegardé.
2. **Identité de fusion fragile** : le gestionnaire de synchronisation construit l'identité avec nom + équipe + saison et n'utilise pas l'identifiant externe comme première clé. Risque de doublons ou de collisions si le nom/l'équipe changent.
3. **Pas de preuve de source réelle** : le parseur et les adaptateurs seuls ne prouvent aucune catégorie fonctionnelle.
4. **Couverture des tests réduite** : les tests existants ne couvrent pas les routes HTTP, les refus HTTP, les réponses de blocage, la persistance, les données manquantes ou la simulation.
5. **Déploiement non prouvé** : le backend écoute par défaut sur `127.0.0.1:8787`; une interface hébergée séparément doit être reliée par proxy et un backend accessible, mais sécurisé.

## Sources évaluées à ce stade

- Basketball-Reference : les tentatives précédentes ont été refusées en HTTP 403; ne pas réessayer par contournement. Les conditions d'utilisation de Sports-Reference limitent l'accès automatisé sans permission expresse : https://www.sports-reference.com/data_use.html
- NBA.com Stats : sa FAQ officielle indique que les statistiques ne sont pas disponibles au téléchargement/CSV pour usage personnel ou académique; ne pas supposer que le site autorise une API d'extraction : https://www.nba.com/stats/help/faq
- NBA Stat (`nbastat.io`) : documentation indique qu'une clé de compte est nécessaire, limite par défaut de 10 requêtes authentifiées par heure et usage personnel/non commercial; couvre joueurs, logs, matchs et box scores mais ne prouve pas les huit catégories demandées. Documentation : https://nbastat.io/developers/api
- NBA_Go API : documentation publique trouvée pour `/api/games`, `/api/playertotals`, `/api/playeradvancedstats` et `/api/playershotchart`, mais aucun appel réel ni licence/conditions suffisantes n'ont été validés. Documentation : https://api.server.nbaapi.com/swagger/index.html

Aucune source alternative n'est encore activée dans le code. Aucune statistique réelle n'a été récupérée dans cette reprise.

## Journal des tests et résultats

- Audit GitHub via outils du dépôt : **réussi**, commit `3423e694c506f5323b5f28d05dc92861af02f8f9` vérifié.
- Comparaison `main...feature/automatic-nba-data-sync` : `behind`, 0 commit en avance, 1 en retard.
- Comparaison SHA de `app.js`, `server.js`, `package.json` entre `main` et branche : identiques.
- Recherche d'exécutions GitHub Actions pour le commit de fusion : aucun run retourné; statut CI courant **NON CONFIRMÉ**.
- `git clone https://github.com/21FILOU21/Basketball-game.git /tmp/basketball-audit` : **ÉCHEC**, résolution DNS indisponible.
- `npm test` local : **NON EXÉCUTÉ**, dépôt non cloné.
- Tests unitaires avec fixtures existantes : présents dans le dépôt, mais pas réexécutés localement dans cette session.
- Tests réels de chacune des huit catégories : **NON TESTÉS**.
- Test navigateur, routes serveur, persistance après rechargement, profils et simulation avec source réelle : **NON TESTÉS**.

## Fichiers à modifier dans cette reprise

- `data-sync.js` : restaurer et appliquer la préférence d'intervalle sauvegardée; persister la saison sélectionnée.
- `tests/data-sync.test.js` ou nouveau test : ajouter une couverture de la restauration des réglages et du parsing/validation.
- `docs/PR3-ETAT-AVANCEMENT.md` : journal de référence, à mettre à jour à chaque étape.

## Actions nécessitant l'intervention du propriétaire

- Si la source retenue nécessite une clé, créer le compte et fournir le secret via une variable d'environnement de l'hébergement (jamais dans GitHub ni dans le navigateur).
- Confirmer/autoriser l'utilisation d'un fournisseur tiers si ses conditions le demandent; aucun frais ne sera engagé sans autorisation.
- Fournir ou confirmer l'hébergement Node.js si un endpoint public est nécessaire. Aucun hébergement de production n'a été prouvé.

## Prochaine étape exacte

Corriger la restauration des paramètres d'intervalle et de saison dans `data-sync.js`, ajouter un test ciblé, mettre à jour ce journal, puis vérifier la CI du commit de travail. Ensuite, poursuivre l'évaluation d'une source autorisée sans prétendre que les huit catégories sont couvertes tant que les réponses réelles ne le démontrent pas.

## Historique non effacé

- 2026-10-23 : les huit pages Basketball-Reference ont été rapportées HTTP 403 lors de tentatives antérieures; aucune donnée réelle confirmée.
- 2026-10-23 : la PR #3 a été trouvée fusionnée dans `main`, contrairement à l'état supposé dans le contexte précédent.
- 2026-10-23 : clone local impossible dans cet environnement à cause de la résolution DNS de `github.com`.


## Mise à jour de suivi — correctif des réglages (2026-10-23)

Cette section complète l'état initial ci-dessus; les échecs précédents sont conservés.

- Branche de suivi : `fix/pr3-sync-audit`.
- PR de suivi : https://github.com/21FILOU21/Basketball-game/pull/4 — ouverte, en brouillon, non fusionnée.
- Dernier commit de code testé par la CI en cours au moment de la mise à jour précédente : `8132398b862d20ac83d946f747640da7e2a55504`. Vérifier le nouveau SHA après cette mise à jour documentaire.
- Fichiers modifiés dans le suivi : `data-sync.js`, `tests/data-sync.test.js`, ce document.

### Correctif appliqué

- `data-sync.js` restaure maintenant le choix de l'intervalle enregistré dans `localStorage` vers le contrôle HTML au chargement, au lieu de simplement lire une valeur de formulaire par défaut.
- Les valeurs d'intervalle autorisées sont validées contre `0, 6, 24, 168`; une valeur inconnue retombe sur 24 h.
- La saison choisie est sauvegardée dans `nbaSimLab.syncSeasonYear.v1` et restaurée au chargement si elle est comprise entre 1947 et 2100.
- Les valeurs actuelles du formulaire restent prioritaires après restauration afin que la sélection active soit utilisée pour une synchronisation manuelle.
- Un test Node avec DOM et `localStorage` simulés a été ajouté pour vérifier la restauration de l'intervalle et de la saison ainsi que la persistance des changements.

### Validation après correctif

- Vérification GitHub du contenu de `data-sync.js` : le correctif et l'appel à `restoreSettings()` sont présents.
- Le test ciblé a été ajouté à `tests/data-sync.test.js`, mais n'a pas encore été exécuté localement car le clone GitHub a échoué par problème DNS.
- GitHub Actions pour le commit `8132398b862d20ac83d946f747640da7e2a55504` a été vu en état `in_progress` lors de la vérification; ce n'est pas encore une preuve de réussite. Le commit documentaire courant doit aussi être vérifié après push.
- Aucun test de navigateur, aucun test des routes backend et aucune récupération réelle des huit catégories n'ont été effectués.

### Source de données — évaluation toujours ouverte

- Les documents officiels NBA.com Stats indiquent que les statistiques ne sont pas proposées au téléchargement CSV pour usage personnel/académique : https://www.nba.com/stats/help/faq
- NBA Stat décrit une API nécessitant une clé, limitée par défaut à 10 requêtes authentifiées par heure et prévue pour un usage personnel non commercial; la documentation consultée ne prouve pas la disponibilité de toutes les huit catégories : https://nbastat.io/developers/api
- NBA_Go documente des endpoints publics de totaux joueurs, statistiques avancées, matchs et shot charts, mais les appels réels, la couverture des huit catégories et les conditions d'utilisation restent non vérifiés : https://api.server.nbaapi.com/swagger/index.html
- Aucune source alternative n'a été activée, aucune clé n'a été demandée et aucun frais n'a été engagé.

### Prochaine étape prioritaire

Vérifier le résultat final de GitHub Actions sur le SHA courant de la PR #4. Si les tests échouent, corriger la cause, pousser le correctif et recontrôler la CI. Ensuite seulement, poursuivre l'intégration d'une source alternative en testant d'abord un endpoint réel et ses conditions d'accès.


## Résultat CI confirmé — 2026-10-23

- Workflow : `Test NBA data sync`, run #10, ID `40040471796`.
- Référence exécutée par le runner : merge ref de PR #4, SHA `9e129bf075e781643179237906cb35fe4c4ab941`, intégrant le commit de code/tests `8132398b862d20ac83d946f747640da7e2a55504`.
- Job `node-tests` : **success**.
- Commande réellement exécutée : `npm test`, Node.js `v20.20.2`.
- Résultat TAP : **4 tests, 4 réussis, 0 échec, 0 ignoré**. Le test ajouté de restauration/persistance des paramètres a réussi.
- Le commit suivant `d8b32f2db4553caadda8566854482b6a2b58c8fa` ne modifie que le document de suivi; aucun run associé à ce SHA n'a été retourné. Le code et les tests couverts par le run #10 n'ont pas changé depuis le SHA de code/tests indiqué ci-dessus.
- Avertissement runner : les actions `checkout@v4` et `setup-node@v4` ont émis un avertissement de dépréciation concernant Node.js 20 forcé vers Node.js 24. Ce n'est pas un échec du test, mais la CI devra être revue avant que cet avertissement ne devienne bloquant.

### Statut actualisé

- Restauration de l'intervalle et de la saison : **TESTÉ AVEC DONNÉES FICTIVES** (CI).
- Parsing des tableaux source avec fixture : **TESTÉ AVEC DONNÉES FICTIVES** (CI).
- Synchronisation des huit catégories avec source réelle : **BLOQUÉ / NON TESTÉ**.
- Persistance de statistiques réelles après rechargement : **NON TESTÉ**.
- Utilisation des statistiques réelles par le simulateur : **NON TESTÉ**.
- Validation navigateur et hébergement : **NON TESTÉ**.

La prochaine priorité demeure l'évaluation d'un fournisseur autorisé et l'essai d'un endpoint réel, en vérifiant sa documentation et ses conditions avant d'intégrer un adaptateur.

## Audit complémentaire du backend — 2026-10-23

### Correctif supplémentaire

- `server.js` valide maintenant les paramètres de `GET /api/nba/stats` avant l'accès à la source.
- Une saison invalide et une catégorie inconnue retournent HTTP 400 (requête invalide), au lieu d'être présentées comme une panne de la source HTTP 502.
- `tests/data-sync.test.js` inclut maintenant un test Node d'intégration qui démarre le serveur local, vérifie `/api/health`, les paramètres invalides, une réponse HTML fixture et le maintien d'un refus HTTP 403.
- Le test utilise une réponse fixture et un `fetch` amont simulé : il ne constitue pas une récupération de données NBA réelles.

### Vérifications isolées sur le code GitHub courant

Sur les versions récupérées de la branche `fix/pr3-sync-audit` :
- Syntaxe par compilation `new Function(...)` de `app.js`, `data-sync.js`, `server.js` et `tests/data-sync.test.js` : **PASS**.
- Contrôle des IDs HTML : aucun ID dupliqué; aucune référence statique `$('id')` de `app.js` manquante dans `index.html` (hors compteurs gérés séparément) : **PASS**.
- Exécution isolée du gestionnaire de routes de `server.js` avec HTTP et source amont simulés : `/api/health` retourne 200 et huit catégories; catégorie inconnue retourne 400; saison invalide retourne 400; fixture retourne 200 avec 1 ligne et 4 colonnes; réponse amont 403 est préservée sans contournement : **PASS**.
- Cette exécution isolée n'est pas équivalente à `npm test` et ne remplace pas la CI sur le SHA actuel.

### CI après le correctif complémentaire

Le run #10 cité plus haut a validé quatre tests sur un commit antérieur aux modifications complémentaires de `server.js` et du test de routes. Le test de routes ajouté depuis n'a pas encore de résultat CI confirmé. Le clone local demeure impossible dans cet environnement à cause de la résolution DNS de `github.com`; `npm test` local reste NON EXÉCUTÉ.

### Problèmes restants prioritaires

1. Obtenir une source dont les conditions d'utilisation autorisent explicitement l'intégration et tester un endpoint réel.
2. Exécuter `npm test` sur le dernier SHA de la PR #4.
3. Ajouter les tests de fusion/persistance, doublons, joueurs transférés et import partiel.
4. Valider l'intégration avec navigateur et serveur hébergé avant de considérer le bouton fonctionnel de bout en bout.


## Reprise de mission — validation PR #4 et fournisseur réel (2026-10-23)

### État GitHub revérifié

- PR #4 : **fermée et fusionnée**, contrairement à l'état indiqué dans les anciennes sections ci-dessus. GitHub indique le commit de fusion `548b8f13ca2b57314bc6baf2a759a666e1dbeae6`. Cette fusion a eu lieu avant cette reprise; aucune fusion, fermeture, suppression de branche ou modification directe de `main` n'a été effectuée dans cette reprise.
- Tête de branche enregistrée pour la PR #4 : `b3a3562fd5aed2f20cfa51ac12c916f45b681b68`.
- La branche `fix/pr3-sync-audit` existe toujours lors de la vérification.
- PR #4 : https://github.com/21FILOU21/Basketball-game/pull/4
- Commit de fusion : https://github.com/21FILOU21/Basketball-game/commit/548b8f13ca2b57314bc6baf2a759a666e1dbeae6

### CI — SHA exact confirmé

- Workflow : `Test NBA data sync`, run #15, ID `40040686881`.
- URL : https://github.com/21FILOU21/Basketball-game/actions/runs/40040686881
- SHA de commit associé à l'exécution : `b3a3562fd5aed2f20cfa51ac12c916f45b681b68`.
- Job `node-tests` : **success**.
- Étape `Run npm test` : **success**.
- Le commit `b3a3562...` est celui de la tête de PR vérifiée. Le commit de fusion `548b8f1...` n'a pas retourné de run propre via l'outil GitHub consulté; la preuve CI disponible est le run #15 sur le SHA de tête de PR, pas un run distinct sur le SHA de fusion.
- Le test HTTP est bien inclus dans `tests/data-sync.test.js` : il lance le serveur local sur un port éphémère et vérifie `/api/health`, catégorie/saison invalides (400), une réponse de parsing fixture (200, une ligne, quatre colonnes, caractères accentués et virgule citée) et un refus amont simulé (403).
- **Limite de preuve :** le succès CI concerne les tests Node et leur source amont simulée. Il ne prouve pas une connexion réelle à un fournisseur NBA.

### Fournisseurs de statistiques réévalués

#### NBA Stat — candidat nécessitant une action du propriétaire

Documentation officielle : https://nbastat.io/developers/api
FAQ officielle : https://nbastat.io/faq

La documentation indique :
- Authentification obligatoire par jeton personnel transmis dans l'en-tête `Authorization: Bearer …`.
- Limite par défaut de 10 requêtes authentifiées par compte sur toute fenêtre glissante de 60 minutes.
- Usage limité au divertissement personnel non commercial; la redistribution ou l'intégration dans un produit commercial exige un accord écrit préalable et les autorisations tierces nécessaires.
- Endpoints documentés pour les listes de joueurs, logs de matchs par joueur, logs d'équipes, matchs et box scores historiques. Les logs de joueurs exposent minutes, tirs, rebonds, passes, statistiques défensives, plus/minus et mentions DNP.
- Les identifiants sont des identifiants internes NBA Stat, pas des identifiants officiels NBA.

**Test réel bloqué :** aucun jeton autorisé n'est configuré dans cet environnement. Une tentative d'ouverture de l'endpoint API via l'outil de consultation web n'a pas été acheminée au fournisseur (outil incapable d'accéder à l'URL API); elle ne fournit donc ni statut HTTP du fournisseur ni corps de réponse. Aucun faux statut HTTP ni aucune donnée réelle ne sont rapportés. Pour effectuer le test minimal réel, le propriétaire doit créer un jeton dans son compte NBA Stat puis le configurer côté serveur dans une variable d'environnement, par exemple `NBASTAT_API_TOKEN`; ne jamais le publier dans GitHub, le navigateur ou cette conversation. Aucune clé n'a été demandée dans le chat et aucun frais n'a été engagé.

#### NBA_Go API

Documentation : https://api.server.nbaapi.com/swagger/index.html

La documentation publique annonce des routes de totaux joueurs, statistiques avancées, matchs et shot charts. Cependant, la documentation consultée ne fournit pas de conditions d'utilisation/licence suffisamment claires pour confirmer le droit d'intégration et de redistribution; l'outil de consultation web n'a pas pu ouvrir l'endpoint directement. **Non retenue pour l'intégration à ce stade** : accessibilité, conditions et réponse réelle restent non vérifiées.

#### NBA.com Stats / stats.nba.com

La FAQ officielle NBA indique que les statistiques affichées ne sont pas disponibles au téléchargement en CSV pour usage personnel/académique : https://www.nba.com/stats/help/faq. Les endpoints non officiellement documentés et les protections d'accès ne sont pas traités comme une autorisation d'extraction. Aucune requête n'a été faite pour contourner une protection.

#### Fournisseurs commerciaux

STATS Perform/Sportradar documente une couverture statistique NBA riche, mais aucun compte, tarif, contrat ou droit d'utilisation n'est disponible dans le projet. Aucune inscription payante ni dépense n'a été engagée.

### Couverture des huit catégories — aucune donnée réelle récupérée

| Catégorie du projet | Couverture démontrée par NBA Stat | Statut de réponse réelle |
|---|---|---|
| Totals | Pas de route agrégée saison par joueur explicitement démontrée dans les endpoints consultés; les logs/box scores pourraient permettre une agrégation après validation | NON TESTÉ — jeton requis |
| Per Game | Calculable en principe à partir de totaux et matchs joués, mais agrégation non validée | NON TESTÉ — jeton requis |
| Per 36 Minutes | Dérivation possible si totaux et minutes sont présents; formule et champs exacts à valider sur une réponse | NON TESTÉ — jeton requis |
| Per 100 Possessions | Champs de possessions et définition d'agrégation non confirmés par les endpoints consultés | NON CONFIRMÉ |
| Advanced | Les statistiques avancées exactes requises par le projet ne sont pas listées comme un jeu de données dédié dans la documentation API consultée | NON CONFIRMÉ |
| Play-by-Play | Aucun endpoint play-by-play documenté dans les routes API examinées | NON CONFIRMÉ |
| Shooting | Les logs de joueurs exposent des statistiques de tirs, mais les champs réels et une extraction saison complète restent à valider | NON TESTÉ — jeton requis |
| Adjusted Shooting | Les statistiques ajustées exactes du projet ne sont pas confirmées par la documentation API consultée | NON CONFIRMÉ |

Aucun nombre de lignes, saison ou joueur n'est déclaré récupéré : **0 ligne réelle validée dans cette mission**, car aucune réponse API réelle n'a été obtenue. Les résultats fixtures de CI ne sont pas des données NBA.

### Intégration et simulateur

- Aucun fournisseur n'a été intégré : la règle de mission exige une première réponse réelle réussie et des conditions d'utilisation vérifiées.
- Le bouton « Prise de data », la persistance réelle, les profils joueurs et le moteur n'ont donc pas été validés de bout en bout.
- Les champs de statistiques et les formules de simulation restent à vérifier avec un jeu de données réel et documenté.
- Aucun gain de réalisme n'est revendiqué.

### Prochaine action prioritaire

1. Le propriétaire crée un jeton NBA Stat via son profil, confirme que l'usage envisagé reste personnel/non commercial, puis le configure **uniquement dans l'environnement du serveur** sous `NBASTAT_API_TOKEN` (ne pas envoyer le secret dans le chat).
2. Ajouter un adaptateur minimal côté serveur, sans modifier `main` directement, puis tester un endpoint historique documenté et consigner le statut HTTP réel, les champs, la saison, les joueurs et les lignes valides.
3. Si la réponse est valide, établir le mapping de colonnes avant toute fusion/sauvegarde; si les conditions d'utilisation ne conviennent pas, obtenir une permission écrite ou choisir un fournisseur licencié.
