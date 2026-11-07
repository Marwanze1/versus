# VERSUS — Tier lists, brackets & blind test

Site pour faire des **tier lists**, des **brackets** (duels « VS ») et des **blind tests multijoueur**, avec import direct depuis **Spotify**.

- Les données (collections, tier lists, tournois) sont sauvegardées dans le navigateur (localStorage).
- Import par lien (playlist, album, artiste, titre) : aucune clé API, aucun compte.
- Recherche dans tout Spotify : connexion du compte (optionnelle, voir plus bas).

## Lancer en local

```bash
python server.py
```

Puis ouvrir http://localhost:8123 (Python 3 suffit, aucune dépendance).

## 🎧 Blind test

1. Onglet **Éléments** ou **Blind test** : ajoute des sons depuis Spotify (coller un lien, « packs rapides » ou recherche).
2. Onglet **Blind test** → **Créer un salon multijoueur** (ou **Jouer ici** en solo).
3. Les joueurs ouvrent le lien d'invitation sur leur téléphone (ou « Rejoindre » + code à 5 caractères).
4. L'hôte lance la partie : l'extrait (30 s max) est joué sur l'écran de l'hôte, les joueurs écrivent le titre et/ou l'artiste.

- Réponses tolérantes : fautes de frappe, accents, majuscules, « feat. », « - Remastered »… ; on peut taper titre + artiste dans la même phrase.
- Points : 100 pts le titre, 50 l'artiste (100 si un seul des deux est demandé), + bonus de vitesse (jusqu'à +50 %) et +25 pour le premier à trouver.
- Réglages : nombre de manches, durée de l'extrait, titre/artiste/les deux, indices (lettres), début aléatoire, manche suivante automatique.
- Multijoueur : connexion directe navigateur ↔ navigateur (WebRTC, via PeerJS). L'hôte fait autorité (il valide les réponses). Les joueurs n'ont besoin d'aucun compte.
- **Pour jouer avec des amis**, le site doit être accessible en ligne (voir « Mettre en ligne »). En local, un 2ᵉ onglet permet de tester.

## 🔎 Rechercher dans tout Spotify (optionnel)

La recherche demande de connecter ton compte Spotify (PKCE, aucun secret stocké ; seul l'hôte se connecte) :

1. Va sur https://developer.spotify.com/dashboard → **Create app**.
2. **Redirect URI** : l'adresse affichée dans le site (ex. `http://127.0.0.1:8123/` en local, ou `https://ton-site.vercel.app/`). Spotify refuse `localhost` : en local, ouvre le site via `http://127.0.0.1:8123`.
3. Coche **Web API**, enregistre, copie le **Client ID** et colle-le dans le site (onglet Éléments ou Blind test → « Rechercher dans tout Spotify »).

Depuis 2026, Spotify demande un compte **Premium** pour les applications en mode Développement.

## Mettre en ligne sur GitHub Pages

1. Sur [github.com](https://github.com) : **New repository** (public, par ex. `versus`) → **uploading an existing file** → glisse tout le contenu du dossier (y compris `api/` et le fichier `.nojekyll`) → **Commit changes**.
2. Dans le dépôt : **Settings → Pages → Build and deployment → Source : Deploy from a branch**, branche **main**, dossier **/ (root)** → **Save**.
3. Après ~1 minute, le site est disponible sur `https://TON-PSEUDO.github.io/versus/` (lien affiché en haut de la page Pages).

Tout fonctionne sans serveur : tier list, bracket, multijoueur (PeerJS), recherche Spotify (connexion du compte).
Pour l'import par lien et les extraits audio, le navigateur lit lui-même les pages publiques de Spotify via des **relais publics gratuits** :

- **Playlists / albums** : un seul appel suffit (les extraits audio sont inclus dans la réponse, puis mémorisés dans le navigateur).
- **Titres ajoutés via la recherche** : l'extrait est récupéré titre par titre, en arrière-plan (3 à 5 s chacun).
- Les relais publics peuvent être **lents ou en panne** : si l'import échoue, réessaie un peu plus tard. Pour plus de fiabilité, voir ci-dessous.

Dans l'URI de redirection Spotify (recherche), mets l'adresse exacte du site, avec le `/` final.

### Option : plus de fiabilité avec Vercel (facultatif)

Sur [vercel.com](https://vercel.com) : **Add New → Project → Import** le dépôt GitHub, puis **Deploy** (aucun réglage).
Vercel exécute `api/spotify.py` comme fonction serverless : plus besoin de relais public, import et extraits instantanés.
Le site détecte automatiquement ce serveur (`api/spotify`) et l'utilise en priorité.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html`, `style.css` | page et DA |
| `app.js` | éléments, tier list, bracket |
| `spotify.js` | import Spotify (serveur du site ou relais publics), connexion du compte, recherche |
| `blind.js` | blind test (hôte, joueurs, scores, réseau) |
| `api/spotify.py` | lecture des pages publiques Spotify : titres + extraits audio (local + Vercel) |
| `server.py` | serveur local = site + `/api/spotify` |
