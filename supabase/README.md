# Backend das candidaturas

O formulário grava em `public.studio_applications`. Um gatilho na base de
dados dispara (via `pg_net`) a Edge Function `notify-application`, que envia a
candidatura por e-mail através do [Resend](https://resend.com).

```
browser ─POST REST─▶ studio_applications ─trigger(pg_net)─▶ notify-application ─▶ Resend ─▶ e-mail
```

A chave publishable (anon) é a única coisa no browser. Todos os segredos
(chave do Resend, segredo do gatilho) vivem no **Supabase Vault** — nunca no
git, nunca no browser.

## Estado atual (2026-08-18)

- **RLS fechada.** O `anon` só pode `INSERT`. Não lê, não altera, não apaga.
- **Pipeline ligada e testada ponta-a-ponta.** Uma candidatura de teste gerou
  o `notified_at` na linha e o e-mail foi entregue.
- **Entrega limitada até verificar o domínio.** O Resend ainda está em modo de
  teste (sem domínio verificado): só entrega ao endereço do titular
  (`danilo@sevens.services`), a partir de `onboarding@resend.dev`. Por isso o
  `studio_alert_to` está, por agora, só com o titular. Ver o passo final.

## Como está montado

### 1. Fechar a leitura — [`migrations/0001_fix_rls.sql`](migrations/0001_fix_rls.sql)

Deixa o `anon` só com `INSERT`. Sem leitura, alteração ou remoção.

### 2. Pipeline de notificação — [`migrations/0002_notify_pipeline.sql`](migrations/0002_notify_pipeline.sql)

- `public.studio_secrets()` — RPC `security definer` que entrega os segredos do
  Vault à Edge Function. Só executável pelo `service_role`.
- `public.notificar_nova_candidatura()` + gatilho `on_nova_candidatura` — em
  cada `INSERT` faz `net.http_post` para a função, com o cabeçalho
  `x-hook-secret` lido do Vault.

### 3. Edge Function — [`functions/notify-application/index.ts`](functions/notify-application/index.ts)

Lê os segredos pela RPC (com a `SUPABASE_SERVICE_ROLE_KEY` injetada pelo
runtime), valida o `x-hook-secret`, monta o e-mail e envia pelo Resend.
Escreve `notified_at`/`notify_error` na própria linha, para que uma falha
fique visível na tabela. Publicada com `verify_jwt=false` (quem chama é a base
de dados, não um utilizador; a autenticação é o `x-hook-secret`).

Redeploy (precisa da [CLI](https://supabase.com/docs/guides/cli)):

```bash
supabase functions deploy notify-application --no-verify-jwt \
  --project-ref ywywcffulifkwbllgnts
```

### Segredos no Vault

Definidos uma vez, fora do git:

| Segredo (Vault)          | Para quê                                            |
| ------------------------ | --------------------------------------------------- |
| `studio_hook_secret`     | partilhado entre o gatilho e a função (`x-hook-secret`) |
| `studio_resend_api_key`  | autenticação em `api.resend.com`                    |
| `studio_alert_to`        | destinatários, separados por vírgula                |
| `studio_alert_from`      | remetente (tem de ser um domínio verificado)        |

Trocar um valor (sem redeploy):

```sql
select vault.update_secret(
  (select id from vault.secrets where name='studio_alert_to'),
  'danilo@sevens.services,thaynaoli55@gmail.com'
);
```

## Passo final — verificar o domínio no Resend

Enquanto o domínio não estiver verificado, só o titular recebe e-mail. Para
avisar também `thaynaoli55@gmail.com` (e enviar de `@sevens.services`):

1. Resend → **Domains** → *Add Domain* → `sevens.services`.
2. Adicionar no GoDaddy os registos DNS (TXT/MX/CNAME) que o Resend indicar.
3. Quando o Resend marcar **Verified**, atualizar o Vault:

   ```sql
   select vault.update_secret((select id from vault.secrets where name='studio_alert_to'),
     'danilo@sevens.services,thaynaoli55@gmail.com');
   select vault.update_secret((select id from vault.secrets where name='studio_alert_from'),
     'Candidaturas SEVEN Studio <candidaturas@sevens.services>');
   ```

Não é preciso redeploy — a função relê o Vault a cada chamada.

## Diagnóstico

Logs em painel → **Edge Functions** → `notify-application` → *Logs*, e a
coluna `notify_error` da tabela.

| Sintoma                              | Causa provável                                       |
| ------------------------------------ | ---------------------------------------------------- |
| Formulário mostra erro ao enviar     | RLS: o INSERT do anon foi revogado por engano        |
| Linha gravada, `notify_error` cheio  | ver a mensagem: normalmente Resend recusou o destinatário/remetente |
| `notify_error` = 403 do Resend       | domínio não verificado — só o titular recebe         |
| Função responde `401`                | `x-hook-secret` ≠ `studio_hook_secret` no Vault      |
| Função responde `500 Not configured` | falta `studio_resend_api_key` no Vault               |

> Nota: existe ainda uma função antiga `nova-candidatura` (versão anterior
> desta pipeline). O gatilho já não a usa; pode ser removida no painel.
