import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/user/studio';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(4173, r));

const CHROME = process.env.CHROMIUM_PATH
  || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const problems = [];
page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
page.on('pageerror', e => problems.push('pageerror: ' + e.message));
page.on('requestfailed', r => problems.push('reqfail: ' + r.url() + ' ' + r.failure()?.errorText));

// Intercept the Supabase insert so nothing real is written.
let captured = null;
await page.route('**/rest/v1/studio_applications', route => {
  captured = JSON.parse(route.request().postData());
  route.fulfill({ status: 201, body: '' });
});

await page.goto('http://localhost:4173/?de=Instagram%20Bio', { waitUntil: 'networkidle' });

const check = (name, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  <-- ' + extra}`);

// --- static shell ---
check('deadline bound', (await page.textContent('.topbar__deadline-value')) === '31 de agosto');
check('step 1 title', (await page.textContent('#step-title')) === 'Quem é você');
check('step counter 01', (await page.textContent('#step-current')) === '01');
check('progress 25%', (await page.$eval('#progress', n => n.style.width)) === '25%');
check('back hidden on step 1', await page.$eval('#back', n => n.hidden));
check('submit says Continuar', (await page.textContent('#submit')) === 'Continuar');
check('done panel hidden', await page.$eval('#done', n => n.hidden));
check('5 fields on step 1', (await page.$$('#fields .field')).length === 5);

// h3 uppercase inherited from tokens.css
const tt = await page.$eval('.offer__title', n => getComputedStyle(n).textTransform);
check('offer h3 uppercase (tokens.css cascade)', tt === 'uppercase', tt);
const fs21 = await page.$eval('.offer__title', n => getComputedStyle(n).fontSize);
check('offer h3 font-size 21px', fs21 === '21px', fs21);

// brand font actually resolved
const fam = await page.evaluate(() => document.fonts.check("600 16px 'Bai Jamjuree'"));
check('Bai Jamjuree loaded', fam);

// body colors
const bodyBg = await page.$eval('body', n => getComputedStyle(n).backgroundColor);
check('body bg #0B1524', bodyBg === 'rgb(11, 21, 36)', bodyBg);

// --- validation ---
await page.click('#submit');
check('block error shown', !(await page.$eval('#form-error', n => n.hidden)));
check('block error text', (await page.textContent('#form-error')) === 'Falta preencher alguma coisa neste bloco.');
check('nome error', (await page.textContent('[data-field="nome"] .field__error')) === 'Preencha este campo.');
check('nome aria-invalid', (await page.getAttribute('#nome', 'aria-invalid')) === 'true');

await page.fill('#nome', 'Danilo Teste');
check('error clears on input', await page.$eval('[data-field="nome"] .field__error', n => n.hidden));

await page.fill('#instagram', '@danilo.seven');
await page.fill('#whatsapp', '12345');
await page.fill('#email', 'nope');
await page.fill('#cidade', 'Faro');
await page.click('#submit');
check('email error', (await page.textContent('[data-field="email"] .field__error')) === 'Confira o endereço de e-mail.');
check('whatsapp error', (await page.textContent('[data-field="whatsapp"] .field__error')) === 'Informe um número com DDD.');
check('still on step 1', (await page.textContent('#step-current')) === '01');

await page.fill('#whatsapp', '+351 912 345 678');
await page.fill('#email', 'danilo@sevens.services');
await page.click('#submit');
await page.waitForTimeout(200);
check('advanced to step 2', (await page.textContent('#step-current')) === '02');
check('step 2 title', (await page.textContent('#step-title')) === 'Seu negócio');
check('progress 50%', (await page.$eval('#progress', n => n.style.width)) === '50%');
check('back visible', !(await page.$eval('#back', n => n.hidden)));

// values survive going back
await page.click('#back');
await page.waitForTimeout(150);
check('back to step 1', (await page.textContent('#step-current')) === '01');
check('nome preserved', (await page.inputValue('#nome')) === 'Danilo Teste');
await page.click('#submit');
await page.waitForTimeout(150);

// --- step 2: selects + optional field ---
check('optional marker', (await page.textContent('[data-field="instagram_negocio"] .field__optional')).trim() === '(opcional)');
await page.fill('#negocio', 'Padaria Central');
await page.selectOption('#area', 'Alimentação e restaurantes');
await page.selectOption('#tempo', '1 a 3 anos');
await page.selectOption('#equipa', '2 a 3 pessoas');
await page.click('#submit');
await page.waitForTimeout(200);
check('advanced to step 3 with optional blank', (await page.textContent('#step-current')) === '03');

// --- step 3: radios ---
check('7 fields on step 3', (await page.$$('#fields .field')).length === 7);
const radioLabelTag = await page.$eval('[data-field="faturacao"] .field__label', n => n.tagName);
check('radio caption is not a <label>', radioLabelTag === 'SPAN', radioLabelTag);

// clicking the caption must NOT select an option
await page.click('[data-field="faturacao"] .field__label');
check('caption click selects nothing', (await page.$$('[data-field="faturacao"] .option.is-on')).length === 0);

await page.click('[data-field="faturacao"] .option:nth-child(2)');
check('radio row marked on', await page.$eval('[data-field="faturacao"] .option:nth-child(2)', n => n.classList.contains('is-on')));
check('only one selected', (await page.$$('[data-field="faturacao"] .option.is-on')).length === 1);
const dotBg = await page.$eval('[data-field="faturacao"] .option.is-on .option__dot', n => getComputedStyle(n).backgroundColor);
check('selected dot gold', dotBg === 'rgb(201, 169, 97)', dotBg);

await page.click('[data-field="investe_hoje"] .option:nth-child(1)');
await page.click('[data-field="disposto"] .option:nth-child(3)');
await page.fill('#valor_justo', '€900');
await page.click('[data-field="impacto_esperado"] .option:nth-child(4)');
await page.click('[data-field="prazo_inicio"] .option:nth-child(1)');
await page.click('[data-field="interesse"] .option:nth-child(1)');
await page.click('#submit');
await page.waitForTimeout(200);
check('advanced to step 4', (await page.textContent('#step-current')) === '04');
check('progress 100%', (await page.$eval('#progress', n => n.style.width)) === '100%');
check('submit says Enviar candidatura', (await page.textContent('#submit')) === 'Enviar candidatura');

// --- step 4: counter, minimum length, consent ---
check('counter starts at 0', (await page.textContent('[data-field="historia"] .field__count')) === '0 / 200 caracteres');
await page.fill('#historia', 'curto demais');
check('counter updates', (await page.textContent('[data-field="historia"] .field__count')) === '12 / 200 caracteres');
await page.click('#submit');
check('min-length error', (await page.textContent('[data-field="historia"] .field__error')) === 'Escreva pelo menos 200 caracteres — vão 12.');
check('consent error', (await page.textContent('[data-field="imagem"] .field__error')) === 'Confirmação obrigatória para continuar.');

const historia = 'Comecei a vender bolos na cozinha de casa em 2019, sem nenhum plano e sem saber nada de gestao. Hoje tenho uma padaria pequena no centro de Faro com tres pessoas na equipa, mas continuo invisivel: quem passa na rua entra, quem nao passa nunca ouviu falar.';
await page.fill('#historia', historia);
check('counter gold when met', await page.$eval('[data-field="historia"] .field__count', n => n.classList.contains('is-met')));

await page.click('[data-field="obstaculo"] .option:nth-child(1)');
await page.fill('#expectativa', 'Quero aparecer e vender sem depender de quem passa na rua.');
await page.click('[data-field="disponibilidade"] .option:nth-child(1)');
await page.click('[data-field="imagem"] .consent');
check('consent ticked', (await page.textContent('[data-field="imagem"] .consent__box')) === '✓');
await page.click('[data-field="contacto"] .consent');

await page.click('#submit');
await page.waitForTimeout(600);

// --- submission ---
check('done panel shown', !(await page.$eval('#done', n => n.hidden)));
check('form hidden', await page.$eval('#form', n => n.hidden));
check('3 instagram chips', (await page.$$('.done__profile')).length === 3);
check('chip href', (await page.getAttribute('.done__profile', 'href')) === 'https://instagram.com/sevenstudio.pt');

check('payload captured', captured !== null);
if (captured) {
  check('origem from ?de', captured.origem === 'instagram bio', captured.origem);
  check('nome sent', captured.nome === 'Danilo Teste');
  check('optional field sent empty', captured.instagram_negocio === '');
  check('consents boolean true', captured.imagem === true && captured.contacto === true);
  check('historia sent', captured.historia === historia);
  check('valor_justo sent', captured.valor_justo === '€900');
  const expected = ['origem','imagem','contacto','nome','instagram','whatsapp','email','cidade','negocio','instagram_negocio','area','tempo','equipa','faturacao','investe_hoje','disposto','valor_justo','impacto_esperado','prazo_inicio','interesse','historia','obstaculo','expectativa','disponibilidade'];
  const keys = Object.keys(captured);
  check('payload keys exact', expected.length === keys.length && expected.every(k => keys.includes(k)), keys.join(','));
}

// --- honeypot path: filled trap must not POST ---
captured = null;
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { document.getElementById('honeypot').value = 'bot'; });
await page.evaluate(() => {
  const fill = (id, v) => { const n = document.getElementById(id); n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); };
  fill('nome', 'Bot'); fill('instagram', '@bot'); fill('whatsapp', '912345678'); fill('email', 'b@b.co'); fill('cidade', 'X');
});
await page.click('#submit'); await page.waitForTimeout(150);
await page.evaluate(() => {
  const fill = (id, v) => { const n = document.getElementById(id); n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); };
  const sel = (id, v) => { const n = document.getElementById(id); n.value = v; n.dispatchEvent(new Event('change', { bubbles: true })); };
  fill('negocio', 'B'); sel('area', 'Outra'); sel('tempo', 'Menos de 1 ano'); sel('equipa', 'Só eu');
});
await page.click('#submit'); await page.waitForTimeout(150);
await page.evaluate(() => {
  document.querySelectorAll('#fields .options').forEach(g => g.querySelector('input').click());
  const n = document.getElementById('valor_justo'); n.value = '1'; n.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.click('#submit'); await page.waitForTimeout(150);
await page.evaluate((h) => {
  const fill = (id, v) => { const n = document.getElementById(id); n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); };
  fill('historia', h); fill('expectativa', 'x');
  document.querySelectorAll('#fields .options').forEach(g => g.querySelector('input').click());
  document.querySelectorAll('#fields .consent input').forEach(c => c.click());
}, historia);
await page.click('#submit'); await page.waitForTimeout(500);
check('honeypot: fake success shown', !(await page.$eval('#done', n => n.hidden)));
check('honeypot: nothing posted', captured === null, JSON.stringify(captured));

// --- network failure path ---
await page.unroute('**/rest/v1/studio_applications');
await page.route('**/rest/v1/studio_applications', r => r.fulfill({ status: 500, body: '' }));
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.evaluate((h) => {
  const set = (id, v, ev) => { const n = document.getElementById(id); n.value = v; n.dispatchEvent(new Event(ev, { bubbles: true })); };
  window.__fastFill = () => {
    document.querySelectorAll('#fields .field').forEach(f => {
      const c = f.querySelector('.control');
      if (c && c.tagName === 'SELECT') { c.value = c.options[1].value; c.dispatchEvent(new Event('change', { bubbles: true })); }
      else if (c) { c.value = f.dataset.field === 'email' ? 'a@b.co' : f.dataset.field === 'whatsapp' ? '912345678' : f.dataset.field === 'historia' ? h : 'x'; c.dispatchEvent(new Event('input', { bubbles: true })); }
      const r = f.querySelector('.options input'); if (r) r.click();
      const k = f.querySelector('.consent input'); if (k) k.click();
    });
  };
}, historia);
for (let i = 0; i < 4; i++) { await page.evaluate(() => window.__fastFill()); await page.click('#submit'); await page.waitForTimeout(250); }
check('failure: error banner', (await page.textContent('#form-error')).startsWith('Não conseguimos enviar'));
check('failure: form still visible', !(await page.$eval('#form', n => n.hidden)));
check('failure: button re-enabled', !(await page.$eval('#submit', n => n.disabled)));
check('failure: answers kept', (await page.inputValue('#historia')) === historia);

// --- mobile layout sanity: no horizontal overflow ---
for (const w of [360, 768, 1440]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`no horizontal scroll @ ${w}px`, overflow <= 0, `overflow ${overflow}px`);
}

console.log(problems.length ? '\nPAGE PROBLEMS:\n' + problems.join('\n') : '\nNo console/page errors.');
await browser.close();
server.close();
