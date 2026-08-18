# Backend das candidaturas

O formulário grava em `public.studio_applications` e um Database Webhook
dispara a Edge Function `notify-application`, que envia a candidatura por
e-mail via [Resend](https://resend.com).

```
browser  ──POST REST──▶  studio_applications  ──webhook──▶  notify-application  ──▶  Resend  ──▶  e-mail
```

A chave do Resend vive só nos secrets da função. O browser nunca a vê — a
página continua a usar apenas a chave publishable.

## Estado antes desta correção

O papel `anon` não tinha política de `INSERT`, então **todas** as
candidaturas eram rejeitadas com `42501 new row violates row-level security
policy` e nada era gravado. Não havia envio de e-mail em nenhuma forma.
Candidaturas submetidas antes da correção estão perdidas — não chegaram à
base de dados.

## Passo 1 — corrigir o acesso à tabela

No painel do Supabase → **SQL Editor**, correr
[`migrations/0001_fix_rls.sql`](migrations/0001_fix_rls.sql).

Deixa o `anon` com uma única capacidade: inserir. Sem leitura, alteração ou
remoção — o que importa porque a chave publishable está visível no JS da
página, e sem isto qualquer pessoa poderia ler todas as candidaturas.

Confirmar no fim:

```sql
select policyname, cmd, roles from pg_policies
where tablename = 'studio_applications';
```

Deve aparecer só a política de `INSERT` para `{anon}`.

## Passo 2 — chave do Resend

1. Criar conta em [resend.com](https://resend.com) e gerar uma API key.
2. **Verificar o domínio** `sevens.services` em Resend → Domains (adicionar
   os registos DNS que ele indica). Sem domínio verificado só se pode enviar
   de `onboarding@resend.dev`, que serve para testar mas cai facilmente em
   spam.

## Passo 3 — publicar a função

Com a [CLI do Supabase](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref ywywcffulifkwbllgnts

supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxxxxx \
  ALERT_FROM='Candidaturas SEVEN <candidaturas@sevens.services>' \
  WEBHOOK_SECRET="$(openssl rand -hex 24)"

supabase functions deploy notify-application --no-verify-jwt
```

`--no-verify-jwt` é necessário porque quem chama é o webhook da base de
dados, não um utilizador autenticado. O acesso fica protegido pelo
`WEBHOOK_SECRET` do passo 4 — guardar o valor gerado.

Os destinatários estão versionados no código (`DEFAULT_TO` em
`functions/notify-application/index.ts`): `danilo@sevens.services` e
`thaynaoli55@gmail.com`. Para mudar sem editar o código, definir o secret
`ALERT_TO` (vírgulas para vários), que substitui a lista padrão.

| Secret           | Obrigatório | Para quê                                  |
| ---------------- | ----------- | ----------------------------------------- |
| `RESEND_API_KEY` | sim         | autenticação em `api.resend.com`          |
| `ALERT_TO`       | não         | substitui os destinatários padrão do código  |
| `ALERT_FROM`     | não         | remetente; falha para `onboarding@resend.dev` |
| `WEBHOOK_SECRET` | recomendado | impede que estranhos disparem a função    |

## Passo 4 — ligar o webhook

Painel → **Database** → **Webhooks** → *Create a new hook*:

| Campo            | Valor                                                                     |
| ---------------- | ------------------------------------------------------------------------- |
| Name             | `notificar-candidatura`                                                   |
| Table            | `public.studio_applications`                                              |
| Events           | `Insert`                                                                  |
| Type             | HTTP Request → `POST`                                                     |
| URL              | `https://ywywcffulifkwbllgnts.supabase.co/functions/v1/notify-application` |
| HTTP Headers     | `x-webhook-secret: <o valor gerado no passo 3>`                           |

## Passo 5 — testar

Chamada directa à função (o corpo é aceite tal e qual, sem envelope):

```bash
curl -i -X POST \
  'https://ywywcffulifkwbllgnts.supabase.co/functions/v1/notify-application' \
  -H 'Content-Type: application/json' \
  -H 'x-webhook-secret: <o valor gerado no passo 3>' \
  -d '{"nome":"Teste","email":"teste@exemplo.pt","historia":"a testar","origem":"teste"}'
```

Esperado: `200 {"ok":true}` e o e-mail em `ALERT_TO`.

Ponta a ponta, preencher o formulário a sério. Deve deixar uma linha na
tabela **e** chegar o e-mail. Como o `anon` já não pode ler, contar as
linhas exige a service_role key ou o painel:

```sql
select count(*), max(created_at) from public.studio_applications;
```

## Se o e-mail não chegar

Logs em painel → **Edge Functions** → `notify-application` → *Logs*.

| Sintoma                              | Causa provável                                       |
| ------------------------------------ | ---------------------------------------------------- |
| Formulário mostra erro ao enviar     | Passo 1 não corrido — o INSERT continua barrado      |
| Linha gravada, sem e-mail            | Webhook não ligado (passo 4) ou URL errado           |
| Função responde `401`                | `x-webhook-secret` não coincide com o secret         |
| Função responde `500 Not configured` | Falta o secret `RESEND_API_KEY`                      |
| Função responde `500 Email failed`   | Resend recusou — normalmente `ALERT_FROM` não verificado |
| E-mail vai para spam                 | Domínio não verificado em Resend (passo 2)           |
