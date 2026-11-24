# Fabrics-CS 2.0 — Diretrizes do Projeto (Vite + Supabase)

## Economia de Tokens
- Nunca leia arquivos inteiros se precisar apenas de uma função. Use buscas direcionadas (Grep/Glob) e leia só o trecho necessário (offset/limit).

## Backend
- Toda a estrutura de dados deve passar pelas migrations do Supabase (`supabase/migrations/`).
- Nada de DDL solto (SQL editor, `execute_sql`): tabelas, colunas, índices, RLS e funções sempre via migration versionada.
- Após mudar o schema, regenere os tipos TypeScript do Supabase.

## Email
- Centralize o envio SMTP em uma Edge Function (ex.: `supabase/functions/send-email/`) ou em uma rota de API limpa.
- O front-end nunca fala com SMTP diretamente nem guarda credenciais de e-mail.
- Credenciais SMTP/IMAP ficam apenas em variáveis de ambiente / secrets (nunca commitadas).
