/* ============================================================
   notify-application — envia por e-mail cada candidatura nova.

   Disparada por um Database Webhook do Supabase em
   INSERT on public.studio_applications, que entrega
   { type, table, record, old_record }.

   Segredos (Edge Function secrets, nunca no browser):
     RESEND_API_KEY   chave de api.resend.com          (obrigatório)
     ALERT_TO         destino, separado por vírgulas    (obrigatório)
     ALERT_FROM       remetente num domínio verificado  (opcional)
     WEBHOOK_SECRET   partilhado com o webhook          (recomendado)
   ============================================================ */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ALERT_TO = Deno.env.get('ALERT_TO');
const ALERT_FROM = Deno.env.get('ALERT_FROM') ?? 'Candidaturas SEVEN <onboarding@resend.dev>';
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

/* Rótulos e ordem iguais aos do formulário, para o e-mail ler-se
   como a candidatura e não como um dump de colunas. */
const CAMPOS: Array<[string, string]> = [
  ['nome', 'Nome completo'],
  ['instagram', 'Instagram'],
  ['whatsapp', 'WhatsApp'],
  ['email', 'E-mail'],
  ['cidade', 'Cidade'],
  ['negocio', 'Nome do negócio'],
  ['instagram_negocio', 'Instagram do negócio'],
  ['area', 'Área de atuação'],
  ['tempo', 'Há quanto tempo'],
  ['equipa', 'Equipa'],
  ['faturacao', 'Faturamento/mês'],
  ['investe_hoje', 'Investe hoje/mês'],
  ['disposto', 'Disposto a investir/mês'],
  ['valor_justo', 'Valor que considera justo'],
  ['impacto_esperado', 'Impacto esperado'],
  ['prazo_inicio', 'Quando quer começar'],
  ['interesse', 'Condição de lançamento'],
  ['historia', 'História'],
  ['obstaculo', 'Maior obstáculo'],
  ['expectativa', 'O que precisa mudar em 90 dias'],
  ['disponibilidade', 'Disponibilidade para gravar'],
];

function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function simNao(v: unknown): string {
  return v === true ? 'Sim' : 'Não';
}

function montarHtml(r: Record<string, unknown>): string {
  const linhas = CAMPOS.map(([chave, rotulo]) => {
    const valor = String(r[chave] ?? '').trim();
    const mostrado = valor === ''
      ? '<em style="color:#8a94a6">(em branco)</em>'
      : escapeHtml(valor).replace(/\n/g, '<br>');
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #e6e9ef;
                   color:#5b6472;font-size:13px;vertical-align:top;
                   white-space:nowrap">${escapeHtml(rotulo)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e6e9ef;
                   color:#0B1524;font-size:14px">${mostrado}</td>
      </tr>`;
  }).join('');

  return `<!doctype html>
<html lang="pt"><body style="margin:0;padding:24px;background:#f4f6fa;
      font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:10px;
              overflow:hidden;border:1px solid #e6e9ef">
    <div style="background:#0B1524;padding:20px 24px">
      <div style="color:#fff;font-size:17px;font-weight:600">Nova candidatura — SEVEN Studio</div>
      <div style="color:#9aa6b8;font-size:13px;margin-top:4px">
        ${escapeHtml(r.nome ?? 'sem nome')} · origem: ${escapeHtml(r.origem ?? 'direto')}
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
    const valor = String(r[chave] ?? '').trim();
    return `${rotulo}: ${valor === '' ? '(em branco)' : valor}`;
  });
  linhas.push(`Uso de imagem: ${simNao(r.imagem)}`);
  linhas.push(`Aceita contacto: ${simNao(r.contacto)}`);
  linhas.push(`Origem: ${String(r.origem ?? 'direto')}`);
  return `Nova candidatura — SEVEN Studio\n\n${linhas.join('\n')}\n`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  /* Só o webhook deve poder disparar isto. */
  if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!RESEND_API_KEY || !ALERT_TO) {
    console.error('Falta RESEND_API_KEY ou ALERT_TO nos secrets da função.');
    return new Response('Not configured', { status: 500 });
  }

  let record: Record<string, unknown>;
  try {
    const body = await req.json();
    /* Aceita o formato do webhook e também um POST directo do registo,
       o que torna a função testável com curl. */
    record = body?.record ?? body;
    if (!record || typeof record !== 'object') throw new Error('sem registo');
  } catch (e) {
    console.error('Payload inválido:', e);
    return new Response('Bad request', { status: 400 });
  }

  const nome = String(record.nome ?? '').trim() || 'sem nome';

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: ALERT_FROM,
      to: ALERT_TO.split(',').map((e) => e.trim()).filter(Boolean),
      reply_to: String(record.email ?? '').trim() || undefined,
      subject: `Nova candidatura — ${nome}`,
      html: montarHtml(record),
      text: montarTexto(record),
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    console.error('Resend falhou:', resposta.status, detalhe);
    /* 500 para o Supabase registar a falha e permitir reenvio. */
    return new Response(`Email failed: ${detalhe}`, { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
