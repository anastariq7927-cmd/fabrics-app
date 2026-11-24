# Lancer FabriCS 2.0 sous Linux

Guide pas à pas pour lancer le projet sur une machine **Ubuntu/Debian** vierge.

## 1. Dépendances système

```bash
sudo apt update
sudo apt install -y git curl
```

Docker (facultatif, uniquement pour le mode `docker`) :

```bash
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER   # puis déconnectez-vous et reconnectez-vous
```

## 2. Node.js 20+ (via nvm)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
node -v   # doit afficher v20 ou plus
```

## 3. Cloner le projet

```bash
git clone -b fabricsV2 https://github.com/anastariq7927-cmd/fabrics-app.git
cd fabrics-app
```

## 4. Configurer le `.env`

```bash
cp .env.example .env
nano .env
```

Renseignez au minimum :

- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SMTP_*`, si vous voulez envoyer de vrais e-mails (sans SMTP, ils apparaissent seulement dans les logs)

`INTERNAL_TOKEN` peut rester vide : le script en génère un automatiquement. Les clés ne sont pas dans le dépôt git ; demandez-les à la personne qui administre le projet.

## 5. Vérifier et lancer

```bash
./run.sh check   # vérifie Node, le .env et les ports
./run.sh         # installe les dépendances et lance le front + les 5 microservices
```

- Front : <http://localhost:5173>
- API : <http://localhost:4000/api/health>

Ctrl+C pour arrêter.

## Autres façons de lancer

| Commande | Ce qu'elle fait |
|---|---|
| `./run.sh docker` | Backend dans Docker, front avec Vite |
| `./run.sh stop` | Arrête les conteneurs Docker |
| `./run.sh --host` | Expose Vite sur le réseau (ajoutez `http://<ip-de-la-machine>:5173` à `CORS_ORIGINS` dans le `.env`) |
| `./fabrics test unit` | Tests unitaires |
| `./fabrics test` | Tests unitaires + build + smoke tests |
| `./fabrics deploy status` | État du déploiement (voir le [README](README.md#colocar-no-ar-deploy-via-ssh)) |

## `run.sh` ou `fabrics` ?

- **`./run.sh`** prépare la machine avant de lancer le projet : il rend les scripts exécutables, convertit les fins de ligne CRLF → LF (fichiers venant de Windows), réinstalle `node_modules` s'il provient d'un autre système et vérifie Node. À utiliser la première fois ou si le dossier a été copié depuis Windows.
- **`./fabrics`** est l'équivalent Linux de `fabrics.cmd` : il accepte les mêmes commandes (`start`, `test`, `deploy`) et les transmet simplement aux scripts de `scripts/`.

Pour appeler `fabrics` depuis n'importe quel dossier (à lancer à la racine du projet) :

```bash
mkdir -p ~/.local/bin
ln -s "$PWD/fabrics" ~/.local/bin/fabrics
```

## Problèmes fréquents

- **`Permission denied`** en lançant `./run.sh` ou `./fabrics` : utilisez `bash run.sh` / `bash fabrics`, ou `chmod +x run.sh fabrics scripts/*.sh`.
- **`/usr/bin/env: 'bash\r'`** : les fichiers ont des fins de ligne Windows (dossier copié au lieu d'être cloné). Lancez `sed -i 's/\r$//' run.sh fabrics scripts/*.sh .env` puis réessayez.
- **Vite ne démarre pas / erreur `@rollup/rollup-linux-x64-gnu` ou `esbuild`** : `node_modules` vient d'un autre système. Lancez `./run.sh` (il le réinstalle tout seul) ou `rm -rf node_modules && npm install`.
- **Ports déjà utilisés (4000–4004, 5173)** : le projet tourne déjà dans un autre terminal ; fermez-le, ou utilisez `./run.sh stop` en mode Docker.
