-- ============================================================
-- Candidatura SEVEN Studio — consentimento RGPD
-- Guarda o consentimento de tratamento de dados dado no formulário.
-- ============================================================
alter table public.studio_applications
  add column if not exists rgpd boolean not null default false;

comment on column public.studio_applications.rgpd is
  'Consentimento RGPD dado no formulário (tratamento de dados + contacto).';
