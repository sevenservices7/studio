-- ============================================================
-- Candidatura SEVEN Studio — corrige o acesso à tabela
-- Correr no SQL Editor do Supabase (uma vez).
--
-- Porquê: o papel publishable/anon não tinha política de INSERT,
-- então TODA candidatura era rejeitada com
--   42501 "new row violates row-level security policy"
-- e nada era gravado.
--
-- Este script deixa o anon com exactamente uma capacidade:
-- inserir candidaturas. Não pode ler, alterar nem apagar.
-- ============================================================

alter table public.studio_applications enable row level security;

-- --- privilégios de tabela -----------------------------------
-- Parte do zero: retira tudo do anon e devolve só o INSERT.
-- Sem isto, o anon pode conseguir SELECT e, como a chave
-- publishable está visível no JS da página, qualquer pessoa
-- conseguiria ler todas as candidaturas.
revoke all on public.studio_applications from anon;
grant insert on public.studio_applications to anon;

-- Se a coluna id for serial/bigserial, o INSERT também precisa
-- da sequência. Colunas "identity" ou uuid não precisam — este
-- bloco simplesmente não faz nada nesse caso.
do $$
declare
  seq text := pg_get_serial_sequence('public.studio_applications', 'id');
begin
  if seq is not null then
    execute format('grant usage, select on sequence %s to anon', seq);
  end if;
end $$;

-- --- políticas RLS -------------------------------------------
drop policy if exists "anon pode candidatar-se" on public.studio_applications;

create policy "anon pode candidatar-se"
  on public.studio_applications
  for insert
  to anon
  with check (true);

-- Nota: de propósito NÃO existe política de select/update/delete
-- para o anon. As candidaturas leem-se no painel do Supabase ou
-- com a service_role key (que nunca deve ir para o browser).

-- --- verificação ---------------------------------------------
-- Deve listar apenas a política de INSERT acima:
--   select policyname, cmd, roles from pg_policies
--   where tablename = 'studio_applications';
