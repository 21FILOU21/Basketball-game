NBA SIM LAB — NOTES DE DONNÉES
Saison cible : 2025-2026

Le fichier HTML joint est un prototype local. Le bouton « Charger les joueurs de démo »
insère des exemples ILLUSTRATIFS uniquement; ils ne doivent pas être considérés comme
les statistiques officielles de la saison 2025-2026. La saison peut être incomplète
ou les statistiques réelles indisponibles au moment de l'utilisation.

Pour importer vos données, choisissez un fichier JSON contenant un tableau d'objets
ou un objet avec une propriété "players" qui contient ce tableau.

Champs recommandés par joueur :
- name : nom du joueur
- team : abréviation/nom d'équipe
- pos : poste
- pts, reb, ast : points, rebonds, passes décisives par match
- ts : True Shooting (soit décimal, ex. 0.615, soit pourcentage, ex. 61.5)
- three : pourcentage à 3 points (décimal ou pourcentage)
- mpg : minutes par match
- season : "2025-26"
- source : URL ou attribution de la source

Autres métriques recommandées pour un simulateur plus réaliste :
FG%, 3PA, FGA, FTA, FT%, ORB, DRB, STL, BLK, TOV, USG%, AST%, TOV%,
pace, offensive rating, defensive rating, on/off, fréquence de tirs par zone,
données par match (pour modéliser les séquences hot/cold) et minutes jouées.

Le navigateur ne peut pas aspirer proprement NBA.com directement depuis un fichier
HTML local dans tous les cas (CORS, accès API, conditions d'utilisation). Pour une
collecte fiable, utilisez une API ou un dataset autorisé, conservez la source et la
date d'extraction, et vérifiez les droits d'utilisation. Le prototype ne prétend pas
avoir récupéré les stats officielles automatiquement.
