/* ============================================================
   notify-application — envia por e-mail cada candidatura nova.

   Disparada pelo gatilho `on_nova_candidatura` da tabela
   public.studio_applications (pg_net) em cada INSERT, que entrega
   { record } com a linha inserida.

   Segredos: NÃO vêm de variáveis de ambiente. Este projeto é gerido
   por conectores/MCP, onde os secrets de Edge Function não são
   definíveis. Em vez disso são lidos do Supabase Vault através da RPC
   `public.studio_secrets()`, chamada com a service_role key (injetada
   automaticamente pelo runtime). O browser nunca vê nada disto.

     studio_hook_secret      partilhado com o gatilho (cabeçalho x-hook-secret)
     studio_resend_api_key   chave de api.resend.com
     studio_alert_to         destinatários, separados por vírgula (opcional)
     studio_alert_from       remetente num domínio verificado (opcional)
   ============================================================ */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/* Usados só se o Vault não trouxer os respetivos valores. */
const DEFAULT_TO = "danilo@sevens.services,thaynaoli55@gmail.com";
const DEFAULT_FROM = "Candidaturas SEVEN Studio <onboarding@resend.dev>";

type Secrets = {
  hook_secret?: string | null;
  resend_api_key?: string | null;
  alert_to?: string | null;
  alert_from?: string | null;
};

async function carregarSegredos(): Promise<Secrets> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/studio_secrets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: "{}",
  });
  if (!r.ok) throw new Error(`RPC studio_secrets ${r.status}: ${await r.text()}`);
  return (await r.json()) as Secrets;
}

/* Rótulos e ordem iguais aos do formulário, para o e-mail ler-se
   como a candidatura e não como um dump de colunas. */
const CAMPOS: Array<[string, string]> = [
  ["nome", "Nome completo"],
  ["instagram", "Instagram"],
  ["whatsapp", "WhatsApp"],
  ["email", "E-mail"],
  ["cidade", "Cidade"],
  ["negocio", "Nome do negócio"],
  ["instagram_negocio", "Instagram do negócio"],
  ["area", "Área de atuação"],
  ["tempo", "Há quanto tempo"],
  ["equipa", "Equipa"],
  ["faturacao", "Faturamento/mês"],
  ["investe_hoje", "Investe hoje/mês"],
  ["disposto", "Disposto a investir/mês"],
  ["valor_justo", "Valor que considera justo"],
  ["impacto_esperado", "Impacto esperado"],
  ["prazo_inicio", "Quando quer começar"],
  ["interesse", "Condição de lançamento"],
  ["historia", "História"],
  ["obstaculo", "Maior obstáculo"],
  ["expectativa", "O que precisa mudar em 90 dias"],
  ["disponibilidade", "Disponibilidade para gravar"],
];

function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function simNao(v: unknown): string {
  return v === true ? "Sim" : "Não";
}

function montarHtml(r: Record<string, unknown>): string {
  const linhas = CAMPOS.map(([chave, rotulo]) => {
    const valor = String(r[chave] ?? "").trim();
    const mostrado = valor === ""
      ? '<em style="color:#8a94a6">(em branco)</em>'
      : escapeHtml(valor).replace(/\n/g, "<br>");
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #e6e9ef;
                   color:#5b6472;font-size:13px;vertical-align:top;
                   white-space:nowrap">${escapeHtml(rotulo)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e6e9ef;
                   color:#0B1524;font-size:14px">${mostrado}</td>
      </tr>`;
  }).join("");

  return `<!doctype html>
<html lang="pt"><body style="margin:0;padding:24px;background:#f4f6fa;
      font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:10px;
              overflow:hidden;border:1px solid #e6e9ef">
    <div style="background:#0B1524;padding:20px 24px">
      <div style="color:#fff;font-size:17px;font-weight:600">Nova candidatura — SEVEN Studio</div>
      <div style="color:#9aa6b8;font-size:13px;margin-top:4px">
        ${escapeHtml(r.nome ?? "sem nome")} · origem: ${escapeHtml(r.origem ?? "direto")}
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse">${linhas}
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #e6e9ef;
                   color:#5b6472;font-size:13px;white-space:nowrap">Uso de imagem</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e6e9ef;
                   color:#0B1524;font-size:14px">${simNao(r.imagem)}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;color:#5b6472;font-size:13px;
                   white-space:nowrap">Aceita contacto</td>
        <td style="padding:10px 14px;color:#0B1524;font-size:14px">${simNao(r.contacto)}</td>
      </tr>
    </table>
  </div>
</body></html>`;
}

function montarTexto(r: Record<string, unknown>): string {
  const linhas = CAMPOS.map(([chave, rotulo]) => {
    const valor = String(r[chave] ?? "").trim();
    return `${rotulo}: ${valor === "" ? "(em branco)" : valor}`;
  });
  linhas.push(`Uso de imagem: ${simNao(r.imagem)}`);
  linhas.push(`Aceita contacto: ${simNao(r.contacto)}`);
  linhas.push(`Origem: ${String(r.origem ?? "direto")}`);
  return `Nova candidatura — SEVEN Studio\n\n${linhas.join("\n")}\n`;
}

/* Regista o resultado na própria linha, para que uma falha de envio
   fique visível na tabela em vez de desaparecer. */
async function marcar(id: unknown, erro: string | null) {
  if (!id) return;
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/studio_applications?id=eq.${id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify(
          erro
            ? { notify_error: erro.slice(0, 500) }
            : { notified_at: new Date().toISOString(), notify_error: null },
        ),
      },
    );
  } catch (e) {
    console.error("não foi possível registar o resultado do aviso:", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let secrets: Secrets;
  try {
    secrets = await carregarSegredos();
  } catch (e) {
    console.error("Falha a ler segredos do Vault:", e);
    return new Response("Not configured (vault)", { status: 500 });
  }

  /* Só o gatilho, que conhece o segredo do Vault, deve poder disparar isto. */
  if (!secrets.hook_secret || req.headers.get("x-hook-secret") !== secrets.hook_secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!secrets.resend_api_key) {
    console.error("studio_resend_api_key em falta no Vault.");
    return new Response("Not configured (resend)", { status: 500 });
  }

  let record: Record<string, unknown>;
  try {
    const body = await req.json();
    /* Aceita o envelope do gatilho e também um POST directo do registo,
       o que torna a função testável com curl. */
    record = body?.record ?? body;
    if (!record || typeof record !== "object") throw new Error("sem registo");
  } catch (e) {
    console.error("Payload inválido:", e);
    return new Response("Bad request", { status: 400 });
  }

  const to = (secrets.alert_to ?? DEFAULT_TO)
    .split(",").map((e) => e.trim()).filter(Boolean);
  const from = secrets.alert_from ?? DEFAULT_FROM;
  const nome = String(record.nome ?? "").trim() || "sem nome";

  let erro: string | null = null;
  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secrets.resend_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: String(record.email ?? "").trim() || undefined,
        subject: `Nova candidatura — ${nome}`,
        html: montarHtml(record),
        text: montarTexto(record),
      }),
    });
    if (!resposta.ok) {
      erro = `Resend HTTP ${resposta.status}: ${await resposta.text()}`;
    }
  } catch (e) {
    erro = `falha a contactar o Resend: ${e}`;
  }

  await marcar(record.id, erro);

  if (erro) {
    console.error(erro);
    /* 502 para o Supabase registar a falha e permitir reenvio. */
    return new Response(erro, { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
