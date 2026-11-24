#!/usr/bin/env bash
# Brings up FabriCS locally: the 5 microservices (gateway, content, contact, email, fabrication)
# and the Vite frontend.
#
#   bash scripts/start.sh            # dev: everything with hot reload (npm run dev)
#   bash scripts/start.sh docker     # backend in Docker, frontend with Vite
#   bash scripts/start.sh stop       # stops the Docker containers
#   bash scripts/start.sh check      # only checks the environment
#
# Works on Linux, macOS and Git Bash on Windows.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="${1:-dev}"
REQUIRED_VARS=(SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_SERVICE_ROLE_KEY INTERNAL_TOKEN
  VITE_API_URL VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY)
PORTS=(4000 4001 4002 4003 4004 5173)

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# Value of KEY in .env (ignores comments, Windows line endings and surrounding quotes).
env_value() {
  grep -E "^[[:space:]]*$1=" .env 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '\r' | sed -E 's/^"(.*)"$/\1/'
}

check_node() {
  command -v node >/dev/null || fail "Node.js não encontrado. Instale a versão 20 ou superior: https://nodejs.org"
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$major" -ge 20 ] || fail "Node.js $major encontrado; é preciso a versão 20 ou superior."
  ok "Node.js $(node -v)"
}

check_env() {
  if [ ! -f .env ]; then
    cp .env.example .env
    fail ".env não existia: criei a partir do .env.example. Preencha as chaves do Supabase e rode de novo."
  fi
  # A long random token between internal services; generated once if it is missing.
  if [ -z "$(env_value INTERNAL_TOKEN)" ]; then
    local token
    token="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
    if grep -qE '^INTERNAL_TOKEN=' .env; then
      sed -i.bak -E "s|^INTERNAL_TOKEN=.*|INTERNAL_TOKEN=$token|" .env && rm -f .env.bak
    else
      printf '\nINTERNAL_TOKEN=%s\n' "$token" >>.env
    fi
    ok "INTERNAL_TOKEN gerado no .env"
  fi
  local missing=()
  for var in "${REQUIRED_VARS[@]}"; do
    [ -n "$(env_value "$var")" ] || missing+=("$var")
  done
  [ ${#missing[@]} -eq 0 ] || fail "Preencha no .env: ${missing[*]}"
  ok ".env completo"
  [ -n "$(env_value SMTP_HOST)" ] && ok "SMTP configurado" || warn "SMTP vazio: os emails só aparecem no log"
}

check_ports() {
  local busy=()
  for port in "${PORTS[@]}"; do
    if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then busy+=("$port"); fi
  done
  [ ${#busy[@]} -eq 0 ] && ok "Portas ${PORTS[*]} livres" ||
    warn "Portas em uso: ${busy[*]} (o site já está rodando? use 'stop' ou feche o outro processo)"
}

install_deps() {
  if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
    bold "Instalando dependências…"
    npm install --no-audit --no-fund
  fi
  ok "Dependências instaladas"
}

wait_for_gateway() {
  printf '  aguardando o gateway'
  for _ in $(seq 1 60); do
    if curl -fs http://localhost:4000/api/health >/dev/null 2>&1; then
      printf '\n'
      ok "Backend no ar: $(curl -s http://localhost:4000/api/health)"
      return 0
    fi
    printf '.'
    sleep 2
  done
  printf '\n'
  fail "O gateway não respondeu em 2 minutos. Veja os logs: docker compose logs"
}

bold "FabriCS — $MODE"
case "$MODE" in
  check)
    check_node
    check_env
    check_ports
    ;;
  dev)
    check_node
    check_env
    check_ports
    install_deps
    bold "Subindo front (http://localhost:5173) e back (http://localhost:4000). Ctrl+C para parar."
    exec npm run dev
    ;;
  docker)
    check_node
    check_env
    command -v docker >/dev/null || fail "Docker não encontrado."
    docker info >/dev/null 2>&1 || fail "O Docker não está rodando. Abra o Docker Desktop e tente de novo."
    install_deps
    bold "Subindo o backend em Docker…"
    docker compose up -d --build
    wait_for_gateway
    bold "Subindo o front (http://localhost:5173). Ctrl+C para parar; o backend continua até 'stop'."
    exec npm run dev -w frontend
    ;;
  stop)
    command -v docker >/dev/null && docker compose down || true
    ok "Containers parados (processos do modo dev param com Ctrl+C)"
    ;;
  *)
    sed -n '2,10p' "$0"
    exit 1
    ;;
esac
