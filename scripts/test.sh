#!/usr/bin/env bash
# Runs FabriCS locally and tests it.
#
#   bash scripts/test.sh            # unit tests + frontend build + smoke tests (starts the stack if needed)
#   bash scripts/test.sh unit       # unit tests only (pricing rules)
#   bash scripts/test.sh smoke      # smoke tests only, against what is already running
#   bash scripts/test.sh --write    # also creates a real contact message and fabrication request
#
# Smoke tests are read-only by default: they only send requests the API must refuse.
# With --write they create test rows in Supabase (named "Smoke Test") and send emails to the log.
# Env: API_URL (default http://localhost:4000/api), WEB_URL (default http://localhost:5173).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="all"
WRITE=0
for arg in "$@"; do
  case "$arg" in
    unit | smoke | all) MODE="$arg" ;;
    --write) WRITE=1 ;;
    *) sed -n '2,12p' "$0"; exit 1 ;;
  esac
done

API_URL="${API_URL:-http://localhost:4000/api}"
WEB_URL="${WEB_URL:-http://localhost:5173}"
TMP="$(mktemp -d)"
STACK_PID=""
PASS=0
FAILS=()

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
pass() { PASS=$((PASS + 1)); printf '  \033[32m✓\033[0m %s\n' "$*"; }
failed() { FAILS+=("$1"); printf '  \033[31m✗\033[0m %s\n' "$*"; }

# Stops the dev stack this script started (whole process tree, also on Git Bash/Windows).
cleanup() {
  if [ -n "$STACK_PID" ]; then
    if [ -r "/proc/$STACK_PID/winpid" ]; then
      taskkill //F //T //PID "$(cat "/proc/$STACK_PID/winpid")" >/dev/null 2>&1
    else
      kill -- "-$STACK_PID" 2>/dev/null || kill "$STACK_PID" 2>/dev/null
    fi
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT

# expect NAME STATUS METHOD URL [CHECK_JS] [curl args…]
# CHECK_JS is a JS expression over `b` (parsed JSON body) that must be truthy.
expect() {
  local name="$1" want="$2" method="$3" url="$4" check="${5:-}"
  shift 5 2>/dev/null || shift $#
  local code
  code="$(curl -s -o "$TMP/body" -w '%{http_code}' -X "$method" --max-time 20 "$@" "$url")"
  if [ "$code" != "$want" ]; then
    failed "$name (HTTP $code, esperado $want): $(head -c 160 "$TMP/body")"
    return 1
  fi
  if [ -n "$check" ] && ! node -e "const b=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); if(!($check)) process.exit(1)" "$TMP/body" 2>/dev/null; then
    failed "$name (resposta inesperada): $(head -c 160 "$TMP/body")"
    return 1
  fi
  pass "$name"
}

json_field() { node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))[process.argv[2]] ?? '')" "$TMP/body" "$1"; }

up() { curl -fs --max-time 3 "$API_URL/health" >/dev/null 2>&1 && curl -fs --max-time 3 "$WEB_URL" >/dev/null 2>&1; }

start_stack() {
  if up; then
    pass "Stack já estava rodando ($API_URL, $WEB_URL)"
    return
  fi
  bash scripts/start.sh check >/dev/null || { failed "Ambiente incompleto: rode bash scripts/start.sh check"; return 1; }
  printf '  subindo front e back (log em %s)' "$TMP/stack.log"
  if command -v setsid >/dev/null; then setsid npm run dev >"$TMP/stack.log" 2>&1 &
  else npm run dev >"$TMP/stack.log" 2>&1 &
  fi
  STACK_PID=$!
  for _ in $(seq 1 60); do
    up && { printf '\n'; pass "Stack no ar"; return; }
    printf '.'
    sleep 2
  done
  printf '\n'
  failed "A stack não subiu em 2 minutos. Últimas linhas do log:"
  tail -n 20 "$TMP/stack.log"
  return 1
}

run_unit() {
  bold "Testes unitários"
  if (cd services/fabrication && node --test >"$TMP/unit.log" 2>&1); then
    pass "Regras de preço ($(grep -Eo 'pass [0-9]+' "$TMP/unit.log" | head -1))"
  else
    failed "Regras de preço"
    tail -n 20 "$TMP/unit.log"
  fi
}

run_build() {
  bold "Build do frontend"
  if npm run build -w frontend >"$TMP/build.log" 2>&1; then
    pass "vite build ($(grep -Eo 'built in [0-9.]+m?s' "$TMP/build.log" | head -1))"
  else
    failed "vite build"
    tail -n 20 "$TMP/build.log"
  fi
}

# Binary STL of a 20 mm cube (12 triangles), for the fabrication upload test.
make_cube_stl() {
  node -e "
    const s=20, v=[[0,0,0],[s,0,0],[s,s,0],[0,s,0],[0,0,s],[s,0,s],[s,s,s],[0,s,s]];
    const f=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
    const b=Buffer.alloc(84+f.length*50); b.writeUInt32LE(f.length,80);
    f.forEach((t,i)=>t.forEach((vi,j)=>v[vi].forEach((c,k)=>b.writeFloatLE(c,84+i*50+12+j*12+k*4))));
    require('fs').writeFileSync(process.argv[1], b);" "$1"
}

# Regression: the gateway once replaced multipart bodies with an empty form when the file arrived
# after the headers (as browsers send it), so real uploads failed with 504 while curl worked.
# This sends headers first and a 600 KB file 300 ms later; an intact body gets "missing consent".
check_delayed_upload() {
  local result
  result="$(UPLOAD_URL="$API_URL/fabrication/requests" node --input-type=module - <<'JS' 2>&1
import http from 'node:http';
const boundary = '----fabricsSmoke' + Date.now();
const data = JSON.stringify({ service_key: 'impression-3d', tier: 'etudiant', name: 'Smoke Test', email: 'smoke@example.com', quantity: 1, consent: false });
const body = Buffer.concat([
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="data"\r\n\r\n${data}\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="delayed.stl"\r\nContent-Type: application/octet-stream\r\n\r\n`),
  Buffer.alloc(600_000),
  Buffer.from(`\r\n--${boundary}--\r\n`),
]);
const req = http.request(process.env.UPLOAD_URL, {
  method: 'POST',
  headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': body.length },
});
req.setTimeout(20000, () => req.destroy(new Error('timeout')));
req.on('response', (res) => {
  let text = '';
  res.on('data', (c) => (text += c));
  res.on('end', () => console.log(res.statusCode === 400 && text.includes('consent') ? 'OK' : `HTTP ${res.statusCode} ${text.slice(0, 100)}`));
});
req.on('error', (e) => console.log(e.message));
req.flushHeaders();
setTimeout(() => req.end(body), 300);
JS
)"
  if [ "$result" = OK ]; then pass "Upload de 600 KB enviado em partes chega inteiro"
  else failed "Upload de 600 KB enviado em partes chegou corrompido: $result"
  fi
}

run_smoke() {
  bold "Smoke tests — API ($API_URL)"
  expect "Health de todos os serviços" 200 GET "$API_URL/health" \
    "['gateway','content','contact','email','fabrication'].every(k=>b[k]==='ok')"
  expect "Intenções em PT" 200 GET "$API_URL/content/intentions?locale=pt" "b.length===4 && b[0].title==='Construir'"
  expect "Actualités" 200 GET "$API_URL/content/news?locale=fr" "Array.isArray(b)"
  expect "Projeto CShell" 200 GET "$API_URL/content/projects/cshell?locale=en" "b.slug==='cshell' && b.pillars.length>0"
  expect "Projeto inexistente → 404" 404 GET "$API_URL/content/projects/nao-existe"
  expect "Parceiros" 200 GET "$API_URL/content/partners" "b.length>0"
  expect "Catálogo de fabricação" 200 GET "$API_URL/fabrication/catalog?locale=fr" \
    "b.services.length===4 && b.materials.length>0 && b.settings.setupFee>=0"
  expect "Acompanhamento com token inválido → 404" 404 GET "$API_URL/fabrication/track/token-invalido"

  bold "Smoke tests — segurança e validação"
  expect "Admin sem login → 401" 401 GET "$API_URL/admin/news"
  expect "Admin fabricação sem login → 401" 401 GET "$API_URL/admin/fabrication/requests"
  expect "Admin com token falso → 401" 401 GET "$API_URL/admin/fabrication/requests" "" -H "Authorization: Bearer falso"
  expect "Contato inválido → 400" 400 POST "$API_URL/contact" "b.details && b.details.email" \
    -H 'content-type: application/json' --data '{"name":"","email":"x","intention":"construire","message":"curta"}'
  expect "Pedido sem consentimento → 400" 400 POST "$API_URL/fabrication/requests" "b.details && b.details.consent" \
    -F 'data={"service_key":"impression-3d","tier":"etudiant","name":"Smoke Test","email":"smoke@example.com","quantity":1,"consent":false}'
  printf 'not a model' >"$TMP/bad.exe"
  expect "Laser com extensão errada → 400" 400 POST "$API_URL/fabrication/requests" "b.details && b.details.file" \
    -F 'data={"service_key":"laser","tier":"externe","name":"Smoke Test","email":"smoke@example.com","quantity":1,"consent":true}' \
    -F "file=@$TMP/bad.exe"
  check_delayed_upload
  if [[ "$API_URL" == *localhost* ]]; then
    expect "Serviço de email sem token interno → 401" 401 POST "http://localhost:4003/send" "" \
      -H 'content-type: application/json' --data '{"subject":"x","text":"y"}'
  fi

  bold "Smoke tests — frontend ($WEB_URL)"
  for path in / /fr /pt/fabrication /en/services /admin; do
    code="$(curl -s -o "$TMP/page" -w '%{http_code}' --max-time 20 "$WEB_URL$path")"
    if [ "$code" = 200 ] && grep -q 'id="root"' "$TMP/page"; then pass "Página $path"; else failed "Página $path (HTTP $code)"; fi
  done

  if [ "$WRITE" = 1 ]; then
    bold "Smoke tests — escrita (cria dados de teste no Supabase)"
    expect "Mensagem de contato" 201 POST "$API_URL/contact" "b.id" \
      -H 'content-type: application/json' \
      --data '{"name":"Smoke Test","email":"smoke@example.com","intention":"autre","message":"Mensagem automática do scripts/test.sh","locale":"pt"}'
    make_cube_stl "$TMP/cube.stl"
    local data='{"service_key":"impression-3d","tier":"etudiant","name":"Smoke Test","email":"smoke@example.com","material_key":"pla","color":"noir","infill":25,"layer_height":0.2,"quantity":1,"consent":true,"locale":"pt","analysis":{"bbox":{"x":20,"y":20,"z":20},"volume_cm3":8,"triangles":12,"watertight":true}}'
    if expect "Pedido de impressão 3D com STL" 201 POST "$API_URL/fabrication/requests" \
      "b.reference.startsWith('FAB-') && b.estimate.total===1.81" -F "data=$data" -F "file=@$TMP/cube.stl"; then
      local ref token
      ref="$(json_field reference)"
      token="$(json_field token)"
      expect "Acompanhamento de $ref" 200 GET "$API_URL/fabrication/track/$token?locale=pt" \
        "b.status==='submitted' && b.volumeCm3===8 && !('staff_notes' in b)"
      printf '    \033[2mCriado %s — apague pelo admin ou no Supabase se quiser.\033[0m\n' "$ref"
    fi
  fi
}

bold "FabriCS — testes ($MODE$([ "$WRITE" = 1 ] && echo ', com escrita'))"
case "$MODE" in
  unit) run_unit ;;
  smoke)
    # smoke never starts anything: say so plainly instead of failing every check.
    if up; then run_smoke
    else failed "Nada respondendo em $API_URL / $WEB_URL. Suba com 'fabrics start' (Windows) ou 'bash scripts/start.sh', ou rode o teste completo, que sobe sozinho."
    fi
    ;;
  all)
    run_unit
    run_build
    bold "Subindo a stack"
    start_stack && run_smoke
    ;;
esac

bold "Resultado: $PASS ok, ${#FAILS[@]} falha(s)"
for f in "${FAILS[@]}"; do printf '  \033[31m✗\033[0m %s\n' "$f"; done
[ ${#FAILS[@]} -eq 0 ]
