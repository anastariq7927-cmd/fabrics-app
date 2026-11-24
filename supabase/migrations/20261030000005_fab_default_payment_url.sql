-- Payment link pre-filled in every new staff quote (the association's HelloAsso page).
-- Staff can still replace it per quote; change the default here or in the table editor.

alter table public.fab_settings
  add column default_payment_url text
  check (default_payment_url is null or default_payment_url ~ '^https://');

update public.fab_settings
   set default_payment_url = 'https://www.helloasso.com/associations/fabrics-metz/adhesions/cotisation';
