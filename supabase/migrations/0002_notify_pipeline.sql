-- ============================================================
-- Candidatura SEVEN Studio — pipeline de notificação por e-mail
-- (aplicado no projeto ywywcffulifkwbllgnts).
--
--   INSERT em studio_applications
--     └─ gatilho on_nova_candidatura (pg_net, assíncrono)
--          └─ POST /functions/v1/notify-application  (cabeçalho x-hook-secret)
--               └─ Resend  ──▶  e-mail
--
-- Os SEGREDOS vivem no Supabase Vault, NÃO no git e NÃO em variáveis de
-- ambiente da Edge Function (que não são definíveis via MCP/conectores).
-- A Edge Function lê-os em runtime pela RPC public.studio_secrets(),
-- chamada com a service_role key.
--
-- Definir os segredos UMA VEZ (fora do controlo de versões), p. ex.:
--   select vault.create_secret('<openssl rand -hex 24>', 'studio_hook_secret',    'partilhado com o gatilho');
--   select vault.create_secret('re_xxxxxxxx',            'studio_resend_api_key',  'chave de sending do Resend');
--   select vault.create_secret('danilo@sevens.services', 'studio_alert_to',        'destinatarios, virgulas');
--   select vault.create_secret('Candidaturas SEVEN <candidaturas@sevens.services>', 'studio_alert_from', 'remetente verificado');
-- Trocar um valor depois: select vault.update_secret((select id from vault.secrets where name='studio_alert_to'), '<novo>');
-- ============================================================

-- --- RPC que entrega os segredos à Edge Function ------------------------
-- Devolve exactamente os campos necessários (nunca nomes arbitrários do
-- cofre) e só pode ser executada pelo service_role.
create or replace function public.studio_secrets()
returns jsonb
language sql
security definer
set search_path = public, vault
as $$
  select jsonb_build_object(
    'hook_secret',    (select decrypted_secret from vault.decrypted_secrets where name='studio_hook_secret'),
    'resend_api_key', (select decrypted_secret from vault.decrypted_secrets where name='studio_resend_api_key'),
    'alert_to',       (select decrypted_secret from vault.decrypted_secrets where name='studio_alert_to'),
    'alert_from',     (select decrypted_secret from vault.decrypted_secrets where name='studio_alert_from')
  );
$$;

revoke all on function public.studio_secrets() from public;
revoke all on function public.studio_secrets() from anon;
revoke all on function public.studio_secrets() from authenticated;
grant execute on function public.studio_secrets() to service_role;

-- --- gatilho: chama a Edge Function em cada INSERT ----------------------
create or replace function public.notificar_nova_candidatura()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'net', 'vault'
as $function$
declare
  segredo text;
begin
  select decrypted_secret into segredo
  from vault.decrypted_secrets
  where name = 'studio_hook_secret';

  if segredo is null then
    raise warning 'studio_hook_secret em falta no Vault; candidatura % gravada sem aviso', new.id;
    return new;
  end if;

  perform net.http_post(
    url     := 'https://ywywcffulifkwbllgnts.supabase.co/functions/v1/notify-application',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-hook-secret', segredo
               ),
    body    := jsonb_build_object('record', to_jsonb(new)),
    timeout_milliseconds := 5000
  );

  return new;
end $function$;

drop trigger if exists on_nova_candidatura on public.studio_applications;
create trigger on_nova_candidatura
  after insert on public.studio_applications
  for each row execute function public.notificar_nova_candidatura();
