#!/usr/bin/env bash
# Publishes FabriCS (frontend + microservices) to a Linux server over SSH.
#
#   bash scripts/deploy.sh setup     # first time: installs Docker on the server and prepares the folder
#   bash scripts/deploy.sh supabase  # installs/updates the local Supabase stack (PostgreSQL) + migrations
#   bash scripts/deploy.sh migrate   # applies supabase/migrations to the server's database
#   bash scripts/deploy.sh admin EMAIL # creates (or promotes) an admin account
#   bash scripts/deploy.sh           # build the frontend, upload, (re)start everything, check health
#   bash scripts/deploy.sh status    # container status on the server
#   bash scripts/deploy.sh logs [svc]# follow logs (e.g. logs fabrication)
#   bash scripts/deploy.sh down      # stop the site on the server
#   bash scripts/deploy.sh ssh       # open a shell on the server, in the project folder
#
# Server settings live in deploy/deploy.env (see deploy/deploy.env.example).
# Production secrets live in .env.production (never committed); it becomes .env on the server.
# Supabase secrets live in .env.supabase (never committed); a copy stays on the server.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CMD="${1:-deploy}"
CONFIG="deploy/deploy.env"
PROD_ENV=".env.production"
SUPA_ENV=".env.supabase"
NETWORK="fabrics_net"
# Name of the Supabase API gateway on $NETWORK (alias set in deploy/supabase/docker-compose.fabrics.yml).
SUPABASE_INTERNAL_URL="http://supabase-api:8000"
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
SUPABASE_PATH="$(env_value "$CONFIG" SUPABASE_PATH)"
DOMAIN="$(env_value "$CONFIG" DOMAIN)"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/fabrics}"
SUPABASE_PATH="${SUPABASE_PATH:-/opt/supabase}"
SUPA_DIR="$SUPABASE_PATH/docker"
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
create_prod_env() {
  [ -f .env ] || fail "Nem $PROD_ENV nem .env existem. Configure o .env primeiro (bash scripts/start.sh check)."
  sed -E \
    -e "s|^PUBLIC_SITE_URL=.*|PUBLIC_SITE_URL=$SITE_URL|" \
    -e "s|^CORS_ORIGINS=.*|CORS_ORIGINS=$SITE_URL|" \
    -e "s|^VITE_API_URL=.*|VITE_API_URL=/api|" \
    .env | tr -d '\r' >"$PROD_ENV"
  grep -q '^DOMAIN=' "$PROD_ENV" || printf '\n# Domínio servido pelo Caddy (HTTPS automático)\nDOMAIN=%s\n' "$DOMAIN" >>"$PROD_ENV"
}

prepare_prod_env() {
  if [ ! -f "$PROD_ENV" ]; then
    create_prod_env
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
  ensure_network
  remote"cd '$DEPLOY_PATH' && $SUDO $COMPOSE up -d --build --remove-orphans && $SUDO docker image prune -f >/dev/null"
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

# ---------- self-hosted Supabase (the database lives on the server, in Docker) ----------

ensure_network() {
  remote "$SUDO docker network inspect $NETWORK >/dev/null 2>&1 || $SUDO docker network create $NETWORK >/dev/null"
}

set_env() { # set_env FILE KEY VALUE — replaces the KEY= line, or appends it
  local file="$1" key="$2" value="$3" tmp
  tmp="$(mktemp)"
  if grep -qE "^$key=" "$file" 2>/dev/null; then
    awk -v k="$key" -v v="$value" 'index($0, k "=") == 1 { print k "=" v; next } { print }' "$file" >"$tmp"
  else
    { cat "$file" 2>/dev/null || true; printf '%s=%s\n' "$key" "$value"; } >"$tmp"
  fi
  cat "$tmp" >"$file" && rm -f "$tmp"
}

rand_hex() { node -e "console.log(require('crypto').randomBytes($1).toString('hex'))"; }

make_jwt() { # make_jwt SECRET ROLE — HS256 key valid for 10 years, as Supabase's own generator does
  node -e '
    const crypto = require("crypto");
    const [secret, role] = process.argv.slice(1);
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const iat = Math.floor(Date.now() / 1000);
    const body = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ role, iss: "supabase", iat, exp: iat + 10 * 365 * 24 * 3600 });
    console.log(body + "." + crypto.createHmac("sha256", secret).update(body).digest("base64url"));
  ' "$1" "$2"
}

# .env.supabase holds the stack's secrets. Generated once; POSTGRES_PASSWORD must never change afterwards.
prepare_supabase_env() {
  if [ ! -f "$SUPA_ENV" ]; then
    if remote "test -f '$SUPA_DIR/.env.fabrics'" 2>/dev/null; then
      remote "cat '$SUPA_DIR/.env.fabrics'" >"$SUPA_ENV"
      ok "$SUPA_ENV recuperado do servidor"
    else
      command -v node >/dev/null || fail "Node.js é necessário nesta máquina para gerar as chaves."
      local jwt
      jwt="$(rand_hex 32)"
      {
        printf '# Segredos do Supabase self-hosted (gerados por scripts/deploy.sh). Nunca commitar.\n'
        printf '# Nunca altere POSTGRES_PASSWORD depois da primeira instalação.\n'
        printf 'POSTGRES_PASSWORD=%s\n' "$(rand_hex 24)"
        printf 'JWT_SECRET=%s\n' "$jwt"
        printf 'ANON_KEY=%s\n' "$(make_jwt "$jwt" anon)"
        printf 'SERVICE_ROLE_KEY=%s\n' "$(make_jwt "$jwt" service_role)"
        printf 'DASHBOARD_USERNAME=admin\n'
        printf 'DASHBOARD_PASSWORD=%s\n' "$(rand_hex 16)"
        printf 'SECRET_KEY_BASE=%s\n' "$(rand_hex 48)"
        printf 'REALTIME_DB_ENC_KEY=%s\n' "$(rand_hex 8)"
        printf 'VAULT_ENC_KEY=%s\n' "$(rand_hex 16)"
        printf 'PG_META_CRYPTO_KEY=%s\n' "$(rand_hex 24)"
        printf 'LOGFLARE_PUBLIC_ACCESS_TOKEN=%s\n' "$(rand_hex 24)"
        printf 'LOGFLARE_PRIVATE_ACCESS_TOKEN=%s\n' "$(rand_hex 24)"
        printf 'S3_PROTOCOL_ACCESS_KEY_ID=%s\n' "$(rand_hex 16)"
        printf 'S3_PROTOCOL_ACCESS_KEY_SECRET=%s\n' "$(rand_hex 32)"
        printf 'POOLER_TENANT_ID=fabrics\n'
      } >"$SUPA_ENV"
      chmod 600 "$SUPA_ENV"
      ok "Chaves do Supabase geradas em $SUPA_ENV (guarde uma cópia num cofre de senhas)"
    fi
  fi
  # Settings that follow deploy/deploy.env; rewritten on every run.
  set_env "$SUPA_ENV" COMPOSE_FILE "docker-compose.yml:docker-compose.fabrics.yml"
  set_env "$SUPA_ENV" FABRICS_NETWORK "$NETWORK"
  set_env "$SUPA_ENV" SITE_URL "$SITE_URL"
  set_env "$SUPA_ENV" SUPABASE_PUBLIC_URL "$SITE_URL"
  set_env "$SUPA_ENV" API_EXTERNAL_URL "$SITE_URL/auth/v1"
  set_env "$SUPA_ENV" DISABLE_SIGNUP true
  set_env "$SUPA_ENV" ENABLE_PHONE_SIGNUP false
  set_env "$SUPA_ENV" ENABLE_ANONYMOUS_USERS false
  set_env "$SUPA_ENV" STUDIO_DEFAULT_ORGANIZATION FabriCS
  set_env "$SUPA_ENV" STUDIO_DEFAULT_PROJECT FabriCS
  ok "$SUPA_ENV pronto"
}

install_supabase() { # install_supabase [update]
  bold "Supabase self-hosted em $TARGET:$SUPABASE_PATH…"
  remote "command -v git >/dev/null" || remote "$SUDO apt-get update -qq && $SUDO apt-get install -y -qq git" ||
    fail "Instale o git no servidor."
  if ! remote "test -f '$SUPA_DIR/docker-compose.yml'"; then
    remote "$SUDO mkdir -p '$SUPABASE_PATH' && $SUDO chown \$(id -u):\$(id -g) '$SUPABASE_PATH' &&
      git clone -q --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase.git '$SUPABASE_PATH' &&
      cd '$SUPABASE_PATH' && git sparse-checkout set docker"
    ok "Configuração oficial baixada (supabase/supabase, pasta docker/)"
  elif [ "${1:-}" = "update" ]; then
    remote "cd '$SUPABASE_PATH' && git pull -q --ff-only"
    ok "Configuração oficial atualizada"
  fi

  remote "cat > '$SUPA_DIR/docker-compose.fabrics.yml'" <deploy/supabase/docker-compose.fabrics.yml
  tr -d '\r' <"$SUPA_ENV" | remote "umask 077 && cat > '$SUPA_DIR/.env.fabrics'"
  # .env = the official .env.example with our values on top (same keys replaced, new keys appended).
  remote "cd '$SUPA_DIR' && umask 077 && awk -f /dev/stdin .env.fabrics .env.example > .env" <<'AWK'
NR == FNR {
  if (match($0, /^[A-Za-z_][A-Za-z0-9_]*=/)) { key = substr($0, 1, RLENGTH - 1); ours[key] = $0 }
  next
}
match($0, /^[A-Za-z_][A-Za-z0-9_]*=/) {
  key = substr($0, 1, RLENGTH - 1)
  if (key in ours) { print ours[key]; done[key] = 1; next }
}
{ print }
END { for (key in ours) if (!(key in done)) print ours[key] }
AWK
  ok "Configuração enviada (.env e docker-compose.fabrics.yml)"

  ensure_network
  remote "cd '$SUPA_DIR' && $SUDO docker compose pull -q && $SUDO docker compose up -d"
  ok "Containers do Supabase iniciados"
}

db_sql() { # db_sql "SQL" — runs SQL in the server's database (password stays inside the container)
  printf '%s\n' "$1" |
    remote "$SUDO docker exec -i supabase-db sh -c 'PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -tA'"
}

wait_supabase() {
  printf '  aguardando o banco, o Auth e o Storage'
  for _ in $(seq 1 60); do
    if [ "$(db_sql "select (to_regclass('auth.users') is not null and to_regclass('storage.buckets') is not null)::int;" 2>/dev/null | tr -d '[:space:]')" = "1" ]; then
      printf '\n'
      ok "Supabase pronto"
      return 0
    fi
    printf '.'
    sleep 5
  done
  printf '\n'
  fail "O Supabase não ficou pronto em 5 minutos. Veja os logs: ssh $TARGET 'cd $SUPA_DIR && docker compose logs --tail=50'"
}

# Applies supabase/migrations with the Supabase CLI, through an SSH tunnel to 127.0.0.1:5432 on the server.
migrate() {
  bold "Aplicando supabase/migrations no banco do servidor…"
  command -v npx >/dev/null || fail "npx (Node.js) é necessário nesta máquina para aplicar as migrations."
  [ -f "$SUPA_ENV" ] || fail "$SUPA_ENV não existe. Rode antes: bash scripts/deploy.sh supabase"
  local pass port=54329 tunnel status=0
  pass="$(env_value "$SUPA_ENV" POSTGRES_PASSWORD)"
  ssh "${SSH_OPTS[@]}" -N -o ExitOnForwardFailure=yes -L "$port:127.0.0.1:5432" "$TARGET" &
  tunnel=$!
  for _ in $(seq 1 20); do
    (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null && break
    sleep 0.5
  done
  npx --yes supabase db push --yes --db-url "postgresql://postgres:$pass@127.0.0.1:$port/postgres" || status=$?
  kill "$tunnel" 2>/dev/null || true
  wait "$tunnel" 2>/dev/null || true
  [ "$status" -eq 0 ] || fail "As migrations falharam (veja a mensagem acima)."
  ok "Migrations aplicadas"
}

# Points .env.production at the local stack (internal URL for the services, public URL for the browser).
link_prod_env() {
  [ -f "$PROD_ENV" ] || create_prod_env
  local anon service
  anon="$(env_value "$SUPA_ENV" ANON_KEY)"
  service="$(env_value "$SUPA_ENV" SERVICE_ROLE_KEY)"
  set_env "$PROD_ENV" SUPABASE_URL "$SUPABASE_INTERNAL_URL"
  set_env "$PROD_ENV" SUPABASE_PUBLIC_URL "$SITE_URL"
  set_env "$PROD_ENV" SUPABASE_PUBLISHABLE_KEY "$anon"
  set_env "$PROD_ENV" SUPABASE_SERVICE_ROLE_KEY "$service"
  set_env "$PROD_ENV" VITE_SUPABASE_URL "$SITE_URL"
  set_env "$PROD_ENV" VITE_SUPABASE_PUBLISHABLE_KEY "$anon"
  ok "$PROD_ENV apontando para o Supabase do servidor"
}

create_admin() { # create_admin EMAIL — the password is asked here and sent over stdin only
  local email="${1:-}" password password2 code
  [[ "$email" =~ ^[^@\'[:space:]]+@[^@\'[:space:]]+$ ]] || fail "Uso: bash scripts/deploy.sh admin email@exemplo.com"
  email="$(printf '%s' "$email" | tr '[:upper:]' '[:lower:]')"
  read -rsp "  Senha para $email (mín. 8 caracteres): " password && printf '\n'
  read -rsp "  Repita a senha: " password2 && printf '\n'
  [ "$password" = "$password2" ] || fail "As senhas não conferem."
  [ ${#password} -ge 8 ] || fail "Senha curta demais."
  code="$(EMAIL="$email" PASSWORD="$password" node -e \
    'console.log(JSON.stringify({ email: process.env.EMAIL, password: process.env.PASSWORD, email_confirm: true }))' |
    remote "key=\$(grep '^SERVICE_ROLE_KEY=' '$SUPA_DIR/.env' | cut -d= -f2-) &&
      curl -sS -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:8000/auth/v1/admin/users \
        -H 'Content-Type: application/json' -H \"apikey: \$key\" -H \"Authorization: Bearer \$key\" --data-binary @-")"
  case "$code" in
    200 | 201) ok "Conta $email criada" ;;
    422) ok "Conta $email já existia (a senha não foi alterada)" ;;
    *) fail "O Auth respondeu HTTP $code ao criar a conta. Veja: bash scripts/deploy.sh ssh → cd $SUPA_DIR && docker compose logs auth" ;;
  esac
  [ "$(db_sql "insert into public.admins (user_id) select id from auth.users where email = '$email' on conflict do nothing;
    select count(*) from public.admins a join auth.users u on u.id = a.user_id where u.email = '$email';" | tail -n1 | tr -d '[:space:]')" = "1" ] ||
    fail "Não consegui registrar $email em public.admins."
  ok "$email é administrador. Entre em $SITE_URL/admin"
}

case "$CMD" in
  supabase)
    bold "Banco local (Supabase self-hosted) → $TARGET"
    check_ssh
    remote "command -v docker >/dev/null" || fail "Docker não está instalado no servidor. Rode antes: bash scripts/deploy.sh setup"
    prepare_supabase_env
    install_supabase "${2:-}"
    wait_supabase
    migrate
    link_prod_env
    bold "Supabase pronto."
    printf '  Studio (console do banco): ssh -N -L 8000:127.0.0.1:8000 %s → http://localhost:8000\n' "$TARGET"
    printf '  Usuário e senha do Studio: DASHBOARD_USERNAME / DASHBOARD_PASSWORD em %s\n' "$SUPA_ENV"
    printf '  Próximos passos: bash scripts/deploy.sh admin voce@exemplo.com  e  bash scripts/deploy.sh\n'
    ;;
  migrate)
    check_ssh
    migrate
    ;;
  admin)
    check_ssh
    create_admin "${2:-}"
    ;;
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
  *) sed -n '2,16p' "$0"; exit 1 ;;
esac
