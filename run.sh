#!/usr/bin/env bash
# Roda o FabriCS 2.0 em máquinas Linux.
#
#   ./run.sh              # dev: 5 microserviços + front Vite com hot reload
#   ./run.sh docker       # backend em Docker, front com Vite
#   ./run.sh check        # só verifica o ambiente
#   ./run.sh stop         # para os containers Docker
#   ./run.sh --host ...   # expõe o Vite na rede (útil em VM/servidor)
#
# Primeira vez:  chmod +x run.sh && ./run.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
cd "$ROOT"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# --host: o Vite escuta em 0.0.0.0 em vez de só localhost.
ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--host" ]; then export VITE_DEV_HOST=1; else ARGS+=("$arg"); fi
done
MODE="${ARGS[0]:-dev}"

case "$MODE" in
  dev | docker | check | stop) ;;
  -h | --help | help) sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "Uso: ./run.sh [dev|docker|check|stop] [--host]" >&2; exit 1 ;;
esac

bold "FabriCS — preparando o ambiente Linux"

[ "$(uname -s)" = "Linux" ] || warn "Este script é para Linux (detectado: $(uname -s)). No Windows use fabrics.cmd."

# Scripts copiados do Windows chegam sem permissão de execução e às vezes com CRLF.
for f in fabrics scripts/*.sh; do
  [ -f "$f" ] || continue
  if grep -q $'\r' "$f"; then sed -i 's/\r$//' "$f" && ok "Convertido CRLF → LF: $f"; fi
  chmod +x "$f"
done
ok "Scripts com permissão de execução"

# Dependências de sistema.
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  fail "Node.js/npm não encontrados. Instale a versão 20+ (ex.: https://github.com/nvm-sh/nvm → 'nvm install 20')."
fi
command -v curl >/dev/null || warn "curl não encontrado (necessário no modo docker): sudo apt install curl"

# node_modules vindo de outra máquina (ex.: copiado do Windows) tem binários nativos
# errados (esbuild/rollup win32) e o Vite não sobe. Nesse caso, reinstala do zero.
if [ -d node_modules ]; then
  arch="$(node -p 'process.arch')"
  if ! ls node_modules/@esbuild 2>/dev/null | grep -q "^linux-$arch$" ||
    ! ls node_modules/@rollup 2>/dev/null | grep -q "^rollup-linux-$arch"; then
    warn "node_modules não é de Linux ($arch): reinstalando dependências…"
    rm -rf node_modules frontend/node_modules packages/*/node_modules services/*/node_modules
  fi
fi

# O .env não vai para o git: na primeira execução o start.sh cria a partir do .env.example.
[ -f .env ] && sed -i 's/\r$//' .env

if [ "${VITE_DEV_HOST:-}" = "1" ] && [ "$MODE" = "dev" ]; then
  # Mesmo fluxo do start.sh, mas com o Vite exposto na rede.
  bash scripts/start.sh check
  [ -d node_modules ] || npm install --no-audit --no-fund
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  bold "Front em http://${ip:-<ip-da-maquina>}:5173 — lembre de incluir essa origem em CORS_ORIGINS no .env."
  exec npx concurrently -n gateway,content,contact,email,fab,web -c magenta,cyan,green,yellow,red,blue \
    "npm run dev -w services/gateway" "npm run dev -w services/content" "npm run dev -w services/contact" \
    "npm run dev -w services/email" "npm run dev -w services/fabrication" "npm run dev -w frontend -- --host"
fi

exec bash scripts/start.sh "$MODE"
