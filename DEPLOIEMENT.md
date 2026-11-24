# Mise en production de FabriCS 2.0 — pas à pas

Ce guide décrit, dans l'ordre, tout ce qu'il faut faire pour mettre le site **en ligne de façon définitive** sur un serveur Linux : site public en HTTPS, base de données PostgreSQL locale (Supabase auto-hébergé, dans Docker), redémarrage automatique et sauvegardes.

Pour comprendre l'architecture et la liste des logiciels, voir [SERVEUR.md](SERVEUR.md).

**Durée estimée :** 1 h à 1 h 30 la première fois.

---

## Vue d'ensemble

Deux machines interviennent :

| Machine | Rôle | Ce qu'on y fait |
|---|---|---|
| **Le serveur** | Héberge le site et la base | Seulement la préparation initiale (étapes 1 à 3) et les sauvegardes (étape 12) |
| **Le poste de déploiement** (votre ordinateur) | Pilote tout le reste par SSH | Toutes les commandes `bash scripts/deploy.sh …` |

| Étape | Où | Quoi |
|---|---|---|
| 1 | Serveur | Créer un utilisateur et une clé SSH |
| 2 | Serveur | Sécuriser SSH, pare-feu, mises à jour automatiques |
| 3 | Fournisseur DNS | Pointer le domaine vers le serveur |
| 4 | Poste | Préparer le poste de déploiement |
| 5 | Poste | Configurer `deploy/deploy.env` |
| 6 | Poste | Installer Docker sur le serveur |
| 7 | Poste | Installer la base de données locale |
| 8 | Poste | Compléter `.env.production` |
| 9 | Poste | Créer le premier administrateur |
| 10 | Poste | Mettre le site en ligne |
| 11 | Navigateur | Vérifier |
| 12 | Serveur | Sauvegardes automatiques |
| 13 | Serveur | Tester le redémarrage |

---

## Prérequis

- **Un serveur** Ubuntu 24.04 LTS (ou Debian 12) : 2 vCPU et 4 Go de RAM minimum, 4 vCPU et 8 Go recommandés, 40 Go de disque SSD ou plus.
- **Un accès root** au serveur (fourni par l'hébergeur).
- **Un nom de domaine**, par exemple `fabrics.exemple.org`.
- **Un compte SMTP** pour l'envoi des e-mails (hôte, port, identifiant, mot de passe).
- **Un poste de déploiement** sous Linux, macOS ou Windows (avec Git Bash), qui dispose de Git, Node.js 20+ et d'un client SSH.

Dans ce guide :
- `203.0.113.10` est l'adresse IP du serveur ;
- `fabrics.exemple.org` est le domaine ;
- `deploy` est l'utilisateur créé sur le serveur.

Remplacez-les par vos valeurs.

---

## Étape 1 — Créer un utilisateur et une clé SSH

**Sur le poste de déploiement**, créez une clé SSH si vous n'en avez pas :

```bash
ssh-keygen -t ed25519 -C "deploiement-fabrics"
```

Validez l'emplacement proposé (`~/.ssh/id_ed25519`).

**Connectez-vous au serveur en root** et créez l'utilisateur `deploy` :

```bash
ssh root@203.0.113.10
adduser deploy
usermod -aG sudo deploy
exit
```

**Depuis le poste**, autorisez votre clé pour cet utilisateur, puis testez :

```bash
ssh-copy-id deploy@203.0.113.10
ssh deploy@203.0.113.10
```

La connexion doit se faire **sans demander de mot de passe SSH**.

> `deploy.sh` utilise `sudo` sur le serveur. Pour qu'il ne s'arrête pas sur une demande de mot de passe, autorisez `sudo` sans mot de passe pour cet utilisateur. Sur le serveur :
> ```bash
> echo 'deploy ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/deploy
> ```

---

## Étape 2 — Sécuriser le serveur

Toujours connecté en `deploy` sur le serveur :

```bash
# Mises à jour du système
sudo apt update && sudo apt full-upgrade -y

# Outils de base, mises à jour de sécurité automatiques, protection contre les attaques SSH
sudo apt install -y git curl ufw fail2ban unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Pare-feu : uniquement SSH, HTTP et HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

**Désactivez la connexion par mot de passe et la connexion root.** Faites-le seulement après avoir vérifié que la connexion par clé fonctionne (étape 1).

```bash
sudo sed -i -E 's/^#?PasswordAuthentication .*/PasswordAuthentication no/; s/^#?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

> Gardez la session ouverte et testez une **nouvelle** connexion `ssh deploy@203.0.113.10` depuis un autre terminal avant de fermer, pour ne pas perdre l'accès.

---

## Étape 3 — Pointer le domaine vers le serveur

Chez votre fournisseur DNS, créez :

| Type | Nom | Valeur |
|---|---|---|
| `A` | `fabrics.exemple.org` | `203.0.113.10` |
| `AAAA` (si le serveur a une IPv6) | `fabrics.exemple.org` | adresse IPv6 du serveur |

Vérifiez depuis le poste :

```bash
ping -c 2 fabrics.exemple.org
```

La propagation peut prendre de quelques minutes à quelques heures. Le certificat HTTPS ne sera obtenu qu'une fois le domaine résolu correctement.

---

## Étape 4 — Préparer le poste de déploiement

```bash
git clone -b deployServer https://github.com/anastariq7927-cmd/fabrics-app.git
cd fabrics-app
npm install
cp .env.example .env
```

Le fichier `.env` sert de modèle au fichier de production. Vous n'avez pas besoin de le remplir pour la mise en production.

> **Sous Windows**, lancez toutes les commandes de ce guide dans **Git Bash**, à la racine du dépôt.

---

## Étape 5 — Configurer le déploiement

```bash
cp deploy/deploy.env.example deploy/deploy.env
```

Éditez `deploy/deploy.env` :

```ini
DEPLOY_HOST=203.0.113.10
DEPLOY_USER=deploy
DEPLOY_PORT=22
DEPLOY_SSH_KEY=
DEPLOY_PATH=/opt/fabrics
SUPABASE_PATH=/opt/supabase
DOMAIN=fabrics.exemple.org
```

Laissez `DEPLOY_SSH_KEY` vide pour utiliser la clé par défaut (`~/.ssh/id_ed25519`).

---

## Étape 6 — Installer Docker sur le serveur

```bash
bash scripts/deploy.sh setup
```

Le script :
- vérifie la connexion SSH ;
- installe Docker et Docker Compose (script officiel `get.docker.com`) ;
- ouvre les ports 80 et 443 dans le pare-feu ;
- crée le dossier `/opt/fabrics`.

**Résultat attendu :** `Pasta /opt/fabrics pronta`.

---

## Étape 7 — Installer la base de données locale

```bash
bash scripts/deploy.sh supabase
```

Le script :
1. **génère les clés** (mot de passe PostgreSQL, clés API, accès à Studio) dans `.env.supabase`, sur le poste ;
2. **télécharge la configuration officielle de Supabase** dans `/opt/supabase` sur le serveur ;
3. **démarre** PostgreSQL, Auth, l'API REST, Storage et Studio dans Docker ;
4. **attend** que la base soit prête ;
5. **applique les migrations** de `supabase/migrations/` (tables, règles d'accès, bucket de fichiers, données initiales) ;
6. **crée `.env.production`** et y écrit l'adresse et les clés de la base locale.

La première exécution prend plusieurs minutes, le temps de télécharger les images.

**Résultat attendu :** `Supabase pronto.`

> **Important :** copiez immédiatement `.env.supabase` dans un coffre de mots de passe (Bitwarden, KeePass…). Il contient le mot de passe de la base de données. **Ne modifiez jamais `POSTGRES_PASSWORD`** après cette étape.

---

## Étape 8 — Compléter `.env.production`

Ouvrez `.env.production` sur le poste et complétez :

| Variable | Valeur |
|---|---|
| `INTERNAL_TOKEN` | Une longue valeur aléatoire, à générer avec `openssl rand -hex 32` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Les informations de votre compte SMTP |
| `MAIL_FROM` | Adresse d'expédition, par ex. `FabriCS <contact@exemple.org>` |
| `MAIL_TO` | Boîte qui reçoit les messages du formulaire de contact |

Vérifiez aussi ces valeurs, normalement déjà remplies :

| Variable | Valeur attendue |
|---|---|
| `SUPABASE_URL` | `http://supabase-api:8000` |
| `SUPABASE_PUBLIC_URL`, `VITE_SUPABASE_URL`, `PUBLIC_SITE_URL`, `CORS_ORIGINS` | `https://fabrics.exemple.org` |
| `VITE_API_URL` | `/api` |
| `DOMAIN` | `fabrics.exemple.org` |

> **Ne remplacez pas** les variables `SUPABASE_*` et `VITE_SUPABASE_*` : elles ont été écrites par l'étape 7.

---

## Étape 9 — Créer le premier administrateur

```bash
bash scripts/deploy.sh admin vous@exemple.org
```

Le script demande un mot de passe (8 caractères minimum), crée le compte et lui donne les droits d'administration.

**Résultat attendu :** `vous@exemple.org é administrador`.

Répétez la commande pour chaque administrateur.

---

## Étape 10 — Mettre le site en ligne

```bash
bash scripts/deploy.sh
```

Le script :
- compile le front-end ;
- envoie le code et la configuration sur le serveur ;
- construit et démarre Caddy et les 5 microservices ;
- vérifie que l'API répond.

**Résultat attendu :** `Pronto: https://fabrics.exemple.org`.

> Si le script indique que le site public ne répond pas encore, c'est généralement que le DNS n'est pas encore propagé ou que le certificat HTTPS est en cours d'émission. Réessayez quelques minutes plus tard.

---

## Étape 11 — Vérifier

| Test | Résultat attendu |
|---|---|
| Ouvrir `https://fabrics.exemple.org` | Le site s'affiche, avec le cadenas HTTPS |
| Ouvrir `https://fabrics.exemple.org/api/health` | Une réponse JSON indiquant que l'API fonctionne |
| Se connecter sur `https://fabrics.exemple.org/admin` | Accès à l'espace d'administration |
| Envoyer le formulaire de contact | Le message apparaît dans l'admin et l'e-mail arrive dans `MAIL_TO` |
| Déposer une demande de fabrication avec un fichier, puis l'ouvrir dans l'admin | Le fichier se télécharge |

État des conteneurs :

```bash
bash scripts/deploy.sh status
```

---

## Étape 12 — Mettre en place les sauvegardes

**Sur le serveur**, créez le script de sauvegarde :

```bash
sudo tee /usr/local/bin/fabrics-backup.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
# Sauvegarde quotidienne de FabriCS : base PostgreSQL + fichiers déposés. Conserve 14 jours.
set -euo pipefail
DEST=/var/backups/fabrics
DAY=$(date +%F)
mkdir -p "$DEST"
docker exec supabase-db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h localhost -U postgres -Fc postgres' \
  > "$DEST/db-$DAY.dump"
tar -czf "$DEST/storage-$DAY.tgz" -C /opt/supabase/docker/volumes storage
find "$DEST" -type f -mtime +14 -delete
EOF
sudo chmod 700 /usr/local/bin/fabrics-backup.sh
```

Testez-le une première fois :

```bash
sudo /usr/local/bin/fabrics-backup.sh && ls -lh /var/backups/fabrics
```

Planifiez-le tous les jours à 3 h du matin :

```bash
echo '0 3 * * * root /usr/local/bin/fabrics-backup.sh' | sudo tee /etc/cron.d/fabrics-backup
```

> **Copie hors du serveur :** une sauvegarde qui reste sur le serveur ne protège pas d'une panne du serveur. Copiez régulièrement `/var/backups/fabrics` ailleurs, par exemple avec `rsync` vers une autre machine ou avec `rclone` vers un stockage en ligne.

**Restauration** (à tester au moins une fois par trimestre, sur une machine de test) :

```bash
docker exec -i supabase-db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -h localhost -U postgres -d postgres --clean --if-exists' \
  < /var/backups/fabrics/db-AAAA-MM-JJ.dump
sudo tar -xzf /var/backups/fabrics/storage-AAAA-MM-JJ.tgz -C /opt/supabase/docker/volumes
```

---

## Étape 13 — Tester le redémarrage

Tous les conteneurs sont configurés pour redémarrer automatiquement (`restart: unless-stopped`), et Docker démarre avec le système. Vérifiez-le une fois :

```bash
ssh deploy@203.0.113.10 sudo reboot
```

Attendez une à deux minutes, puis ouvrez `https://fabrics.exemple.org` : le site doit revenir tout seul.

**Le site est maintenant en production.**

---

## Au quotidien

Toutes ces commandes se lancent depuis le poste de déploiement, à la racine du dépôt.

| Besoin | Commande |
|---|---|
| Publier une nouvelle version du code | `git pull` puis `bash scripts/deploy.sh` |
| Appliquer une nouvelle migration de la base | `bash scripts/deploy.sh migrate` |
| Ajouter un administrateur | `bash scripts/deploy.sh admin email@exemple.org` |
| Voir l'état des conteneurs | `bash scripts/deploy.sh status` |
| Suivre les journaux d'un service | `bash scripts/deploy.sh logs fabrication` |
| Ouvrir un terminal sur le serveur | `bash scripts/deploy.sh ssh` |
| Arrêter le site | `bash scripts/deploy.sh down` |
| Mettre à jour Supabase (après une sauvegarde) | `bash scripts/deploy.sh supabase update` |

**Console de la base de données (Studio).** Ouvrez un tunnel SSH :

```bash
ssh -N -L 8000:127.0.0.1:8000 deploy@203.0.113.10
```

Puis allez sur <http://localhost:8000>. L'identifiant et le mot de passe sont `DASHBOARD_USERNAME` et `DASHBOARD_PASSWORD` dans `.env.supabase`.

**Si vous changez de poste de déploiement**, recopiez `deploy/deploy.env` et `.env.production` depuis votre coffre de mots de passe. `.env.supabase` est récupéré automatiquement depuis le serveur au prochain `bash scripts/deploy.sh supabase`.

---

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| `Não consegui conectar … por SSH` | Clé non autorisée, mauvais hôte ou mauvais utilisateur | Vérifiez `deploy/deploy.env`, puis `ssh-copy-id deploy@203.0.113.10` |
| Le script se bloque en demandant un mot de passe `sudo` | `sudo` exige un mot de passe | Voir la note de l'étape 1 (`NOPASSWD`) |
| `O Supabase não ficou pronto em 5 minutos` | Mémoire insuffisante ou image non téléchargée | `bash scripts/deploy.sh ssh`, puis `cd /opt/supabase/docker && docker compose ps` et `docker compose logs --tail=50` |
| `As migrations falharam` | Erreur SQL dans une migration | Lisez le message affiché, corrigez la migration dans `supabase/migrations/`, puis `bash scripts/deploy.sh migrate` |
| `Preencha em .env.production: …` | Variable obligatoire vide | Complétez la variable indiquée (étape 8) |
| Pas de HTTPS / erreur de certificat | DNS pas encore propagé, ou port 80/443 bloqué | `ping fabrics.exemple.org`, vérifiez le pare-feu de l'hébergeur, puis `bash scripts/deploy.sh logs web` |
| La connexion admin échoue | Compte absent ou mot de passe erroné | Relancez `bash scripts/deploy.sh admin vous@exemple.org` ; vérifiez `bash scripts/deploy.sh logs gateway` |
| Les e-mails n'arrivent pas | SMTP mal configuré | Vérifiez `SMTP_*` dans `.env.production`, redéployez, puis `bash scripts/deploy.sh logs email` |
| Le téléchargement d'un fichier échoue dans l'admin | `SUPABASE_PUBLIC_URL` incorrect | Il doit valoir `https://fabrics.exemple.org` dans `.env.production` ; redéployez |
