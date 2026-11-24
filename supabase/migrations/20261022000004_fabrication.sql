-- Fabrication module: public requests for 3D printing, laser cutting, CAD and electronics,
-- tracked by a secret token and quoted by the staff.

create table public.fab_services (
  key               text primary key,
  position          smallint not null,
  icon              text not null,
  title             jsonb not null,
  summary           jsonb not null,
  lead_time         jsonb not null,
  has_estimator     boolean not null default false,
  accepted_formats  text[] not null
);

create table public.fab_materials (
  key             text primary key,
  service_key     text not null references public.fab_services (key) on delete cascade,
  position        smallint not null default 0,
  name            jsonb not null,
  hint            jsonb not null,
  price_per_unit  numeric(8, 3) not null check (price_per_unit >= 0),
  unit            text not null check (unit in ('g', 'ml', 'plaque')),
  density         numeric(5, 3),            -- g/cm³, used by the 3D estimator
  colors          jsonb not null default '[]'::jsonb, -- [{key, hex, name:{fr,en,pt}}]
  active          boolean not null default true
);

create table public.fab_settings (
  id                   boolean primary key default true check (id),
  setup_fee            numeric(8, 2) not null,
  discounts            jsonb not null,   -- {"etudiant":0.25,"association":0.15,"externe":0}
  quote_validity_days  smallint not null default 14
);

create type public.fab_tier as enum ('etudiant', 'association', 'externe');
create type public.fab_status as enum (
  'submitted', 'in_review', 'needs_info', 'quoted', 'paid', 'in_production', 'ready', 'delivered', 'rejected'
);

create sequence public.fab_reference_seq;

create table public.fab_requests (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique
                  default ('FAB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.fab_reference_seq')::text, 4, '0')),
  tracking_token  text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  service_key     text not null references public.fab_services (key),
  tier            public.fab_tier not null,
  name            text not null check (char_length(name) between 1 and 120),
  email           text not null check (char_length(email) between 3 and 254),
  phone           text check (char_length(phone) <= 40),
  organization    text check (char_length(organization) <= 160),
  file_path       text,
  file_name       text,
  file_size       integer,
  file_format     text,
  bbox            jsonb,            -- {x, y, z} in mm
  volume_cm3      numeric(12, 3),
  triangles       integer,
  watertight      boolean,
  material_key    text references public.fab_materials (key),
  color           text,
  infill          smallint check (infill between 0 and 100),
  layer_height    numeric(4, 2),
  quantity        smallint not null default 1 check (quantity between 1 and 500),
  deadline        date,
  notes           text check (char_length(notes) <= 5000),
  consent_at      timestamptz not null,
  locale          text not null default 'fr',
  status          public.fab_status not null default 'submitted',
  estimate_eur    numeric(10, 2),
  quote           jsonb,            -- {lines:[{label, amount}], gross, discount_rate, discount, total, valid_until}
  payment_url     text,
  staff_notes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index fab_requests_status_idx on public.fab_requests (status, created_at desc);

create table public.fab_request_events (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.fab_requests (id) on delete cascade,
  type        text not null,
  message     text,
  public      boolean not null default true,
  actor       text,
  created_at  timestamptz not null default now()
);
create index fab_request_events_request_idx on public.fab_request_events (request_id, created_at desc);

create trigger fab_requests_touch_updated_at before update on public.fab_requests
  for each row execute function public.touch_updated_at();

-- RLS: catalogue is public; requests are only reachable through the fabrication service
-- (service role) or by admins.
alter table public.fab_services       enable row level security;
alter table public.fab_materials      enable row level security;
alter table public.fab_settings       enable row level security;
alter table public.fab_requests       enable row level security;
alter table public.fab_request_events enable row level security;

create policy "public read fab services"  on public.fab_services  for select to anon, authenticated using (true);
create policy "public read fab materials" on public.fab_materials for select to anon, authenticated using (active or (select private.is_admin()));
create policy "public read fab settings"  on public.fab_settings  for select to anon, authenticated using (true);

create policy "admins manage fab requests" on public.fab_requests
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins manage fab events" on public.fab_request_events
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Private bucket for uploaded design files (50 MB, the free-plan limit).
insert into storage.buckets (id, name, public, file_size_limit)
values ('fab-files', 'fab-files', false, 52428800);

create policy "admins read fab files" on storage.objects
  for select to authenticated using (bucket_id = 'fab-files' and (select private.is_admin()));

-- Seed --------------------------------------------------------------------------------------

insert into public.fab_settings (setup_fee, discounts, quote_validity_days)
values (2.00, '{"etudiant": 0.25, "association": 0.15, "externe": 0}', 14);

insert into public.fab_services (key, position, icon, title, summary, lead_time, has_estimator, accepted_formats) values
('impression-3d', 1, 'cube',
  '{"fr":"Impression 3D","en":"3D printing","pt":"Impressão 3D"}',
  '{"fr":"Prototypes rapides et pièces fonctionnelles en PLA, PETG, ABS, résine ou nylon carbone.","en":"Rapid prototypes and functional parts in PLA, PETG, ABS, resin or carbon nylon.","pt":"Protótipos rápidos e peças funcionais em PLA, PETG, ABS, resina ou nylon com carbono."}',
  '{"fr":"24–48 h","en":"24–48 h","pt":"24–48 h"}',
  true, '{stl,obj,3mf,step,stp}'),
('laser', 2, 'crosshairs',
  '{"fr":"Découpe & gravure laser","en":"Laser cutting & engraving","pt":"Corte e gravação a laser"}',
  '{"fr":"Découpe vectorielle et gravure sur acrylique, contreplaqué, MDF ou carton jusqu''à 6 mm.","en":"Vector cutting and engraving on acrylic, plywood, MDF or cardboard up to 6 mm.","pt":"Corte vetorial e gravação em acrílico, compensado, MDF ou papelão até 6 mm."}',
  '{"fr":"Créneau sous 48 h","en":"Slot within 48 h","pt":"Horário em até 48 h"}',
  false, '{svg,dxf,pdf,ai}'),
('cad', 3, 'compass-drafting',
  '{"fr":"Conception CAO","en":"CAD design","pt":"Projeto CAD"}',
  '{"fr":"Vous avez une idée mais pas de fichier ? Nos étudiants modélisent votre pièce sur SolidWorks ou Onshape.","en":"Have an idea but no file? Our students model your part in SolidWorks or Onshape.","pt":"Tem uma ideia mas não tem o arquivo? Nossos estudantes modelam sua peça no SolidWorks ou Onshape."}',
  '{"fr":"3–5 jours ouvrés","en":"3–5 working days","pt":"3–5 dias úteis"}',
  false, '{pdf,png,jpg,jpeg,step,stp,stl,zip}'),
('electronique', 4, 'microchip',
  '{"fr":"Électronique & projets spéciaux","en":"Electronics & special projects","pt":"Eletrônica e projetos especiais"}',
  '{"fr":"Prototypage de cartes, soudure, microcontrôleurs et projets pluridisciplinaires.","en":"Board prototyping, soldering, microcontrollers and multidisciplinary projects.","pt":"Prototipagem de placas, solda, microcontroladores e projetos multidisciplinares."}',
  '{"fr":"Sur mesure","en":"Custom","pt":"Sob medida"}',
  false, '{zip,pdf,kicad_pcb,brd,sch,png,jpg,jpeg}');

insert into public.fab_materials (key, service_key, position, name, hint, price_per_unit, unit, density, colors) values
('pla', 'impression-3d', 1, '{"fr":"PLA","en":"PLA","pt":"PLA"}',
  '{"fr":"Polyvalent, rapide","en":"Versatile, fast","pt":"Versátil, rápido"}', 0.080, 'g', 1.240,
  '[{"key":"noir","hex":"#1d1d1f","name":{"fr":"Noir","en":"Black","pt":"Preto"}},{"key":"blanc","hex":"#f5f5f7","name":{"fr":"Blanc","en":"White","pt":"Branco"}},{"key":"bordeaux","hex":"#610721","name":{"fr":"Bordeaux","en":"Burgundy","pt":"Bordô"}},{"key":"gris","hex":"#8e8e93","name":{"fr":"Gris","en":"Grey","pt":"Cinza"}},{"key":"bleu","hex":"#1d4ed8","name":{"fr":"Bleu","en":"Blue","pt":"Azul"}}]'),
('petg', 'impression-3d', 2, '{"fr":"PETG","en":"PETG","pt":"PETG"}',
  '{"fr":"Résiste aux UV et produits chimiques","en":"UV and chemical resistant","pt":"Resiste a UV e químicos"}', 0.110, 'g', 1.270,
  '[{"key":"noir","hex":"#1d1d1f","name":{"fr":"Noir","en":"Black","pt":"Preto"}},{"key":"transparent","hex":"#d6e4ea","name":{"fr":"Translucide","en":"Translucent","pt":"Translúcido"}}]'),
('abs', 'impression-3d', 3, '{"fr":"ABS","en":"ABS","pt":"ABS"}',
  '{"fr":"Tient jusqu''à 95 °C","en":"Heat resistant up to 95 °C","pt":"Resiste até 95 °C"}', 0.130, 'g', 1.040,
  '[{"key":"noir","hex":"#1d1d1f","name":{"fr":"Noir","en":"Black","pt":"Preto"}},{"key":"blanc","hex":"#f5f5f7","name":{"fr":"Blanc","en":"White","pt":"Branco"}}]'),
('resine', 'impression-3d', 4, '{"fr":"Résine Tough","en":"Tough resin","pt":"Resina Tough"}',
  '{"fr":"SLA, détails très fins","en":"SLA, ultra-fine detail","pt":"SLA, detalhes muito finos"}', 0.220, 'ml', 1.100,
  '[{"key":"gris","hex":"#8e8e93","name":{"fr":"Gris","en":"Grey","pt":"Cinza"}}]'),
('pa12-cf', 'impression-3d', 5, '{"fr":"PA12-CF","en":"PA12-CF","pt":"PA12-CF"}',
  '{"fr":"Nylon chargé carbone","en":"Carbon-filled nylon","pt":"Nylon com fibra de carbono"}', 0.340, 'g', 1.150,
  '[{"key":"noir","hex":"#1d1d1f","name":{"fr":"Noir","en":"Black","pt":"Preto"}}]'),
('mdf-3', 'laser', 1, '{"fr":"MDF 3 mm","en":"MDF 3 mm","pt":"MDF 3 mm"}',
  '{"fr":"Plaque 600 × 400 mm","en":"600 × 400 mm sheet","pt":"Chapa 600 × 400 mm"}', 4.000, 'plaque', null, '[]'),
('acrylique-3', 'laser', 2, '{"fr":"Acrylique 3 mm","en":"Acrylic 3 mm","pt":"Acrílico 3 mm"}',
  '{"fr":"Plaque 600 × 400 mm","en":"600 × 400 mm sheet","pt":"Chapa 600 × 400 mm"}', 9.000, 'plaque', null,
  '[{"key":"transparent","hex":"#d6e4ea","name":{"fr":"Transparent","en":"Clear","pt":"Transparente"}},{"key":"noir","hex":"#1d1d1f","name":{"fr":"Noir","en":"Black","pt":"Preto"}}]');
