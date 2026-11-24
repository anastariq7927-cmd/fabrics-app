-- Fabrication requests: who is asking (profile) and in which setting (project frame), plus a
-- catch-all "service ou conseil" service. The price tier is now derived from the profile and
-- the frame by the fabrication service, so it stays authoritative server-side.

create type public.fab_profile as enum (
  'etudiant_cotisant', 'etudiant_non_cotisant', 'personnel_interne', 'entreprise_collectivite', 'autre'
);
create type public.fab_project_frame as enum (
  'eleves', 'academique', 'associatif', 'personnel', 'externe', 'autre'
);

-- Nullable: requests sent before this migration have none.
alter table public.fab_requests
  add column profile           public.fab_profile,
  add column profile_other     text check (char_length(profile_other) <= 160),
  add column project_frame     public.fab_project_frame,
  add column frame_other       text check (char_length(frame_other) <= 300),
  add column association_name  text check (char_length(association_name) <= 160),
  add column service_other     text check (char_length(service_other) <= 300);

insert into public.fab_services (key, position, icon, title, summary, lead_time, has_estimator, accepted_formats) values
('conseil', 5, 'lightbulb',
  '{"fr":"Service ou conseil autre","en":"Other service or advice","pt":"Outro serviço ou consultoria"}',
  '{"fr":"Un besoin qui ne rentre dans aucune case ? Décrivez-le : nous vous orientons ou vous accompagnons.","en":"A need that fits no other box? Describe it: we will point you in the right direction or help you out.","pt":"Uma necessidade que não se encaixa em nenhuma opção? Descreva: orientamos ou acompanhamos você."}',
  '{"fr":"Réponse sous 72 h","en":"Reply within 72 h","pt":"Resposta em até 72 h"}',
  false, '{pdf,png,jpg,jpeg,zip,docx,step,stp,stl,svg,dxf}');
