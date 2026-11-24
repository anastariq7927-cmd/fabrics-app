#!/usr/bin/env bash
# Publishes FabriCS (frontend + microservices) to a Linux server over SSH.
#
#   bash scripts/deploy.sh setup     # first time: installs Docker on the server and prepares the folder
#   bash scripts/deploy.sh           # build the frontend, upload, (re)start everything, check health
#   bash scripts/deploy.sh status    # container status on the server
#   bash scripts/deploy.sh logs [svc]# follow logs (e.g. logs fabrication)
#   bash scripts/deploy.sh down      # stop the site on the server
#   bash scripts/deploy.sh ssh       # open a shell on the server, in the project folder
#
# Server settings live in deploy/deploy.env (see deploy/deploy.env.example).
# Production secrets live in .env.production (never committed); it becomes .env on the server.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CMD="${1:-deploy}"
CONFIG="deploy/deploy.env"
PROD_ENV=".env.production"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

env_value() { # env_value FILE KEY
  grep -E "^[[:space:]]*$2=" "$1" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '\r' | sed -E 's/^"(.*)"$/\1/'
}

# ---------- configuration ----------
if [ ! -f "$CONFIG" ]; then
  cp deploy/deploy.env.example "$CONFIG"
  fail "Criei $CONFIG a partir do exemplo. Preencha DEPLOY_HOST (e DOMAIN) e rode de novo."
fi
DEPLOY_HOST="$(env_value "$CONFIG" DEPLOY_HOST)"
DEPLOY_USER="$(env_value "$CONFIG" DEPLOY_USER)"
DEPLOY_PORT="$(env_value "$CONFIG" DEPLOY_PORT)"
DEPLOY_SSH_KEY="$(env_value "$CONFIG" DEPLOY_SSH_KEY)"
DEPLOY_PATH="$(env_value "$CONFIG" DEPLOY_PATH)"
DOMAIN="$(env_value "$CONFIG" DOMAIN)"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/fabrics}"
[ -n "$DEPLOY_HOST" ] || fail "Preencha DEPLOY_HOST em $CONFIG."

SSH_OPTS=(-p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
[ -n "$DEPLOY_SSH_KEY" ] && SSH_OPTS+=(-i "$DEPLOY_SSH_KEY")
TARGET="$DEPLOY_USER@$DEPLOY_HOST"
SUDO=""
[ "$DEPLOY_USER" = "root" ] || SUDO="sudo"

remote() { ssh "${SSH_OPTS[@]}" "$TARGET" "$@"; }
SITE_URL="${DOMAIN:+https://$DOMAIN}"
SITE_URL="${SITE_URL:-http://$DEPLOY_HOST}"

check_ssh() {
  command -v ssh >/dev/null || fail "ssh não encontrado."
  remote true 2>/dev/null || fail "Não consegui conectar em $TARGET:$DEPLOY_PORT por SSH. Confira host, usuário e chave (ssh-copy-id $TARGET)."
  ok "SSH ok ($TARGET)"
}

# .env.production = the local .env with the public URLs of the server. Created once, then yours to edit.
prepare_prod_env() {
  if [ ! -f "$PROD_ENV" ]; then
    [ -f .env ] || fail "Nem $PROD_ENV nem .env existem. Configure o .env primeiro (bash scripts/start.sh check)."
    sed -E \
      -e "s|^PUBLIC_SITE_URL=.*|PUBLIC_SITE_URL=$SITE_URL|" \
      -e "s|^CORS_ORIGINS=.*|CORS_ORIGINS=$SITE_URL|" \
      -e "s|^VITE_API_URL=.*|VITE_API_URL=/api|" \
      .env | tr -d '\r' >"$PROD_ENV"
    grep -q '^DOMAIN=' "$PROD_ENV" || printf '\n# Domínio servido pelo Caddy (HTTPS automático)\nDOMAIN=%s\n' "$DOMAIN" >>"$PROD_ENV"
    fail "Criei $PROD_ENV a partir do .env, com as URLs de $SITE_URL. Revise (SMTP, chaves) e rode de novo."
  fi
  local missing=()
  for var in SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_SERVICE_ROLE_KEY INTERNAL_TOKEN VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY; do
    [ -n "$(env_value "$PROD_ENV" "$var")" ] || missing+=("$var")
  done
  [ ${#missing[@]} -eq 0 ] || fail "Preencha em $PROD_ENV: ${missing[*]}"
  [ "$(env_value "$PROD_ENV" VITE_API_URL)" = "/api" ] || warn "VITE_API_URL em $PROD_ENV não é /api (o Caddy serve a API no mesmo domínio)."
  [ "$(env_value "$PROD_ENV" DOMAIN)" = "$DOMAIN" ] || warn "DOMAIN em $PROD_ENV difere de $CONFIG."
  ok "$PROD_ENV completo"
}

build_frontend() {
  bold "Build do frontend…"
  [ -d node_modules ] || npm install --no-audit --no-fund
  # `vite build` runs in production mode, so .env.production overrides .env (VITE_API_URL=/api).
  npm run build -w frontend
  [ -f frontend/dist/index.html ] || fail "Build sem frontend/dist/index.html"
  ok "Frontend gerado em frontend/dist"
}

upload() {
  bold "Enviando para $TARGET:$DEPLOY_PATH…"
  local stage
  stage="$(mktemp -d)"
  trap 'rm -rf "$stage"' RETURN
  mkdir -p "$stage/deploy"
  cp package.json package-lock.json docker-compose.yml docker-compose.prod.yml "$stage/"
  cp deploy/Caddyfile "$stage/deploy/"
  cp -R packages services "$stage/"
  cp -R frontend/dist "$stage/web"
  find "$stage" -name node_modules -prune -exec rm -rf {} + 2>/dev/null || true

  remote "$SUDO mkdir -p '$DEPLOY_PATH' && $SUDO chown \$(id -u):\$(id -g) '$DEPLOY_PATH'"
  # Replace code folders atomically-ish: old copies are removed right before extracting the new ones.
  tar -C "$stage" -czf - . | remote "cd '$DEPLOY_PATH' && rm -rf web services packages deploy && tar -xzf -"
  remote "umask 077 && cat > '$DEPLOY_PATH/.env'" <"$PROD_ENV"
  ok "Código, frontend e .env enviados"
}

start_remote() {
  bold "Subindo os containers no servidor…"
  remote "cd '$DEPLOY_PATH' && $SUDO $COMPOSE up -d --build --remove-orphans && $SUDO docker image prune -f >/dev/null"
  ok "Containers no ar"
}

health() {
  bold "Verificando…"
  local result=""
  for _ in $(seq 1 30); do
    result="$(remote "cd '$DEPLOY_PATH' && $SUDO $COMPOSE exec -T gateway node -e \"fetch('http://localhost:4000/api/health').then(r=>r.text()).then(t=>console.log(t)).catch(()=>process.exit(1))\"" 2>/dev/null || true)"
    [ -n "$result" ] && break
    sleep 3
  done
  [ -n "$result" ] || fail "O gateway não respondeu. Veja: bash scripts/deploy.sh logs"
  ok "Backend: $result"
  if curl -fsS --max-time 15 "$SITE_URL/api/health" >/dev/null 2>&1; then
    ok "Site público respondendo em $SITE_URL"
  else
    warn "$SITE_URL ainda não responde daqui (DNS propagando ou certificado sendo emitido). Tente em alguns minutos."
  fi
}

case "$CMD" in
  setup)
    bold "Preparando $TARGET"
    check_ssh
    remote "command -v docker >/dev/null && docker compose version >/dev/null 2>&1" && ok "Docker já instalado" || {
      bold "Instalando Docker (script oficial get.docker.com)…"
      remote "curl -fsSL https://get.docker.com | $SUDO sh"
      [ -n "$SUDO" ] && remote "$SUDO usermod -aG docker '$DEPLOY_USER'" || true
      ok "Docker instalado"
    }
    remote "command -v ufw >/dev/null && $SUDO ufw status | grep -q active && $SUDO ufw allow 80,443/tcp && $SUDO ufw allow 443/udp || true"
    remote "$SUDO mkdir -p '$DEPLOY_PATH' && $SUDO chown \$(id -u):\$(id -g) '$DEPLOY_PATH'"
    ok "Pasta $DEPLOY_PATH pronta. Agora rode: bash scripts/deploy.sh"
    ;;
  deploy)
    bold "Deploy FabriCS → $SITE_URL"
    check_ssh
    remote "command -v docker >/dev/null" || fail "Docker não está instalado no servidor. Rode antes: bash scripts/deploy.sh setup"
    prepare_prod_env
    build_frontend
    upload
    start_remote
    health
    bold "Pronto: $SITE_URL"
    ;;
  status) remote "cd '$DEPLOY_PATH' && $SUDO $COMPOSE ps" ;;
  logs) remote "cd '$DEPLOY_PATH' && $SUDO $COMPOSE logs -f --tail=100 ${2:-}" ;;
  down) remote "cd '$DEPLOY_PATH' && $SUDO $COMPOSE down" && ok "Site parado no servidor" ;;
  ssh) ssh -t "${SSH_OPTS[@]}" "$TARGET" "cd '$DEPLOY_PATH' 2>/dev/null; exec \$SHELL -l" ;;
  *) sed -n '2,13p' "$0"; exit 1 ;;
esac
