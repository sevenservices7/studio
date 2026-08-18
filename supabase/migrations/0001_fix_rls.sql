-- ============================================================
-- Candidatura SEVEN Studio — fecha a leitura da tabela
-- (aplicado no projeto ywywcffulifkwbllgnts).
--
-- O anon fica com exactamente uma capacidade: inserir candidaturas.
-- Não pode ler, alterar nem apagar. Isto importa porque a chave
-- publishable está visível no JS da página; sem revogar o SELECT,
-- e com uma política de leitura acidental, qualquer pessoa poderia
-- ler todas as candidaturas.
-- ============================================================

alter table public.studio_applications enable row level security;

-- Parte do zero: retira tudo do anon e devolve só o INSERT.
revoke all on public.studio_applications from anon;
grant insert on public.studio_applications to anon;

-- Se a coluna id for serial/bigserial, o INSERT também precisa da
-- sequência. Colunas identity/uuid não precisam — o bloco é no-op aí.
do $$
declare
  seq text := pg_get_serial_sequence('public.studio_applications', 'id');
begin
  if seq is not null then
    execute format('grant usage, select on sequence %s to anon', seq);
  end if;
end $$;

-- Garante uma (e só uma) política de INSERT para o anon.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='studio_applications' and cmd='INSERT'
  ) then
    create policy "public can submit application"
      on public.studio_applications
      for insert to anon
      with check (true);
  end if;
end $$;

-- De propósito NÃO existe política de select/update/delete para o anon.
-- As candidaturas leem-se no painel do Supabase ou com a service_role key.

-- Verificação (deve listar só a política de INSERT para {anon}):
--   select policyname, cmd, roles from pg_policies
--   where tablename = 'studio_applications';
