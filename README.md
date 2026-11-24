# FabriCS 2.0

Nova versão do site da [FabriCS](https://fabrics.rezo-rm.fr), associação de engenheiros de Metz.
Front-end em **Vite + React (JSX)** com visual inspirado na Apple, ícones **Font Awesome**, banco **Postgres no Supabase** e backend em **microserviços Node/Express que conversam por HTTP**. O site existe em francês, inglês e português.

## Arquitetura

```
Navegador ──HTTP──▶ gateway :4000 ──HTTP──▶ content :4001 ──▶ Supabase (Postgres + RLS)
  (Vite :5173)         │  CORS, helmet,      ├─▶ contact :4002 ──▶ Supabase
                       │  rate limit, auth   │        └──HTTP──▶ email :4003 ──▶ SMTP
                       └─ /api/health agrega o status de todos
```

| Serviço | Porta | Responsabilidade |
|---|---|---|
| `services/gateway` | 4000 | Única porta pública. Proxy para os serviços, CORS, `helmet`, rate limit no formulário, valida o JWT do Supabase e checa se é admin |
| `services/content` | 4001 | Intenções (serviços), actualités, projetos, parceiros; CRUD admin de actualités e caixa de mensagens |
| `services/contact` | 4002 | Recebe o formulário "Rejoindre", grava em `contact_messages` e pede ao serviço de email para avisar a equipe |
| `services/email` | 4003 | **Único** ponto que fala SMTP (nodemailer). Interno, protegido por `INTERNAL_TOKEN` |
| `services/fabrication` | 4004 | Pedidos de fabricação (impressão 3D, laser, CAD, eletrônica): upload para o Storage, estimativa, acompanhamento por token, triagem e orçamento da equipe |
| `packages/shared` | – | Clientes Supabase, validação zod, `createService()` (health + tratamento de erros) |

Rotas públicas da API (via gateway):

- `GET /api/content/intentions?locale=fr|en|pt`
- `GET /api/content/news?locale=&limit=`, `GET /api/content/news/:slug`
- `GET /api/content/projects/cshell`, `GET /api/content/partners`
- `POST /api/contact`: `{ name, email, intention, message, locale }`
- `GET /api/fabrication/catalog?locale=`, `POST /api/fabrication/requests` (multipart: `data` em JSON + `file`), `GET /api/fabrication/track/:token`
- `GET /api/auth/me`, `/api/admin/*` e `/api/admin/fabrication/*` (exigem `Authorization: Bearer <jwt>`)

## Módulo de fabricação

O layout segue as telas do Stitch, mas com o design do site.

| Página | Rota | Função |
|---|---|---|
| Catálogo e pedido | `/:lang/fabrication` | Escolha do serviço, 4 etapas (perfil, arquivo, parâmetros, consentimentos) e estimativa ao vivo |
| Acompanhamento | `/:lang/fabrication/suivi/:token` | Etapas, linha do tempo, orçamento e botão de pagamento HelloAsso |
| Fila | `/admin/fabrication` | KPIs, busca, filtros e tabela de pedidos |
| Inspeção e orçamento | `/admin/fabrication/:id` | Visualizador 3D, download, montagem do orçamento, mudança de status, pedido de esclarecimento e recusa |

- **Análise 3D no navegador:** arquivos STL, OBJ e 3MF são lidos com three.js. O site mede as dimensões, o volume e os triângulos e verifica se a malha é fechada. STEP é aceito, mas não tem pré-visualização.
- **Preço:** fica em `services/fabrication/src/pricing.js` (testado com `npm test`). Materiais, preços e descontos estão nas tabelas `fab_materials` e `fab_settings`. **Os preços do seed são provisórios: ajuste antes de abrir ao público.**
- **Pagamento:** a equipe cola o link HelloAsso no orçamento e marca o pedido como pago manualmente.
- **Arquivos:** ficam no bucket privado `fab-files`, com limite de 50 MB. Só o serviço e os admins conseguem lê-los.

## Banco de dados

Todo o schema está em [`supabase/migrations/`](supabase/migrations): tabelas, RLS e seed com os textos do site atual nos três idiomas. Os textos traduzíveis ficam em colunas `jsonb` no formato `{"fr": "...", "en": "...", "pt": "..."}`.

Projeto Supabase: `fabrics-cs` (`ircemdwccpjfrpyikwds`, região eu-west-3).

## Como rodar

```bash
bash scripts/start.sh            # confere o ambiente, instala dependências e sobe front + 5 serviços
bash scripts/start.sh docker     # backend em Docker, front com Vite
bash scripts/start.sh check      # só confere Node, .env e portas
bash scripts/start.sh stop       # para os containers
```

Na primeira vez o script cria o `.env` a partir do `.env.example` e diz o que falta preencher. O `INTERNAL_TOKEN` é gerado sozinho. Depois é só abrir http://localhost:5173.

No Windows, rode pelo Git Bash (ou `fabrics.cmd`). No Linux, veja o passo a passo completo em [LINUX.md](LINUX.md).

### Testar

```bash
bash scripts/test.sh            # testes unitários + build do front + smoke tests (sobe a stack se precisar e desliga no fim)
bash scripts/test.sh unit       # só as regras de preço
bash scripts/test.sh smoke      # só os smoke tests, contra o que já está rodando
bash scripts/test.sh --write    # também cria uma mensagem de contato e um pedido de impressão 3D reais
```

Os smoke tests cobrem:
- o health dos 5 serviços e o conteúdo nos três idiomas;
- o catálogo de fabricação;
- as proteções: admin sem login → 401, dados inválidos → 400, serviço de email sem token interno → 401;
- as páginas do front.

Por padrão eles **não gravam nada**. Com `--write`, criam registros "Smoke Test" no Supabase e conferem a estimativa e o acompanhamento.

O script termina com código 1 se algo falhar, então serve também para CI. Para testar o site em produção: `API_URL=https://seu-dominio/api WEB_URL=https://seu-dominio bash scripts/test.sh smoke`.

Sem credenciais SMTP, o serviço de email apenas **registra** a mensagem no console em vez de enviar, o que basta para desenvolver.

### Criar um admin

1. Supabase Dashboard → Authentication → Users → *Add user* (email + senha).
2. No SQL editor: `insert into public.admins (user_id) select id from auth.users where email = 'voce@exemplo.com';`
3. Entre em http://localhost:5173/admin.

## Colocar no ar (deploy via SSH)

> Infraestrutura completa do servidor (softwares, esquema, Postgres local com Supabase self-hosted, backups e segurança): [SERVEUR.md](SERVEUR.md).

Serve para qualquer servidor Linux com acesso SSH por chave (Ubuntu/Debian recomendados). No servidor, o Caddy é a única porta pública:
- serve o front já compilado;
- encaminha `/api` para o gateway;
- emite o certificado HTTPS sozinho.

Os microserviços e o banco (Supabase self-hosted, com PostgreSQL local) rodam em Docker, na rede interna.

```
Internet ─▶ Caddy :443 ─┬─ /                          → frontend (web/)
                        ├─ /api/*                     → gateway ─▶ content · contact · email · fabrication
                        └─ /auth/v1/*, /storage/v1/object/sign/*  → Supabase (login admin, downloads)
                                                         Supabase: PostgreSQL · Auth · REST · Storage
```

1. Aponte o domínio (registro A/AAAA) para o IP do servidor e garanta que `ssh usuario@servidor` entra sem senha (`ssh-copy-id usuario@servidor`).
2. Configure o deploy:
   ```bash
   cp deploy/deploy.env.example deploy/deploy.env   # host, usuário, pasta e domínio
   ```
3. Prepare o servidor. Isso instala o Docker e libera as portas 80/443 no `ufw`:
   ```bash
   bash scripts/deploy.sh setup
   ```
4. Instale o banco local (Supabase self-hosted em `/opt/supabase`):
   ```bash
   bash scripts/deploy.sh supabase
   ```
   Gera as chaves em `.env.supabase`, sobe PostgreSQL + Auth + REST + Storage, aplica `supabase/migrations/` e aponta o `.env.production` para esse banco.
5. Crie o primeiro admin (a senha é pedida no terminal):
   ```bash
   bash scripts/deploy.sh admin voce@exemplo.com
   ```
6. Publique:
   ```bash
   bash scripts/deploy.sh
   ```
   - Se o `.env.production` ainda não existir, o script cria a partir do seu `.env`, já com as URLs públicas (`VITE_API_URL=/api`, `PUBLIC_SITE_URL`, `CORS_ORIGINS`). Revise o arquivo, principalmente o SMTP, e rode de novo.
   - A partir daí, cada execução compila o front, envia o código, reconstrói os containers e testa o `/api/health`.

Outros comandos: `bash scripts/deploy.sh status`, `logs [serviço]`, `down`, `ssh`, `migrate` (aplica novas migrations) e `supabase update` (atualiza a versão do Supabase).

Mudanças de schema vão por migration em `supabase/migrations/` e chegam ao servidor com `bash scripts/deploy.sh migrate`.

`deploy/deploy.env`, `.env.production` e `.env.supabase` ficam fora do git. Guarde uma cópia do `.env.supabase` num cofre de senhas: ele contém a senha do banco.

## Estrutura do front-end

```
frontend/src/
  api/client.js        chamadas ao gateway
  i18n/                fr.json, en.json, pt.json + detecção de idioma
  styles/tokens.css    cores, raios, sombras (claro/escuro)
  styles/global.css    componentes (nav translúcida, hero, tiles, cards…)
  components/          Nav, Footer, Layout, Reveal (animação no scroll), Blocks
  pages/               Home, Services, News, NewsDetail, CShell, Join
  admin/               Login, actualités, mensagens
```
