-- FabriCS 2.0 — core schema. Translatable text lives in jsonb columns shaped {"fr": ..., "en": ..., "pt": ...}.

create table public.intentions (
  key          text primary key,
  position     smallint not null,
  icon         text not null,
  image_url    text,
  title        jsonb not null,
  summary      jsonb not null,
  description  jsonb not null,
  audience     jsonb not null,
  caption      jsonb
);

create type public.news_source as enum ('fabrics', 'linkedin', 'press');

create table public.news (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  published_at  date not null default current_date,
  source        public.news_source not null default 'fabrics',
  title         jsonb not null,
  summary       jsonb not null,
  body          jsonb,
  external_url  text,
  image_url     text,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index news_published_idx on public.news (is_published, published_at desc);

create table public.projects (
  slug        text primary key,
  title       jsonb not null,
  tagline     jsonb not null,
  summary     jsonb not null,
  image_url   text,
  pillars     jsonb not null default '[]'::jsonb,  -- [{icon, title:{..}, text:{..}}]
  objectives  jsonb not null default '[]'::jsonb,  -- [{title:{..}, text:{..}}]
  is_featured boolean not null default false
);

create table public.partners (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  url       text,
  logo_url  text,
  position  smallint not null default 0
);

create type public.message_status as enum ('new', 'read', 'archived');

create table public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null check (char_length(email) between 3 and 254),
  intention   text not null,
  message     text not null check (char_length(message) between 1 and 5000),
  locale      text not null default 'fr',
  status      public.message_status not null default 'new',
  created_at  timestamptz not null default now()
);
create index contact_messages_created_idx on public.contact_messages (created_at desc);

create table public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger news_touch_updated_at before update on public.news
  for each row execute function public.touch_updated_at();
