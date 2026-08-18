/* ============================================================
   Candidatura SEVEN Studio — application form
   Four blocks, validated one at a time, posted to Supabase.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- campaign copy ---------- */

  var CFG = {
    prazoCurto: '31 de agosto',
    prazoLongo: '31 de agosto de 2026, 23h59',
    perfis: ['@sevenstudiooffice', '@danilosantos7', '@thayoli7', '@danissantossj']
  };

  /* Publishable (anon) key — safe in the browser. The table must be
     locked down with RLS so this role can insert and nothing else. */
  var SUPABASE_URL = 'https://ywywcffulifkwbllgnts.supabase.co/rest/v1/studio_applications';
  var SUPABASE_KEY = 'sb_publishable_qJMesIhZLiphEawYv1YqaA_dMy29YUm';

  var BLOCOS = [
    { titulo: 'Quem é você', sub: 'Para sabermos quem está do outro lado e como falar com você.' },
    { titulo: 'Seu negócio', sub: 'O que faz, há quanto tempo e com quem.' },
    { titulo: 'Os números', sub: 'Servem para entendermos se conseguimos entregar resultado real.' },
    { titulo: 'Sua história', sub: 'A parte que decide a seleção.' }
  ];

  var DEFS = [
    [
      { name: 'nome', label: 'Nome completo', type: 'text', autoComplete: 'name' },
      { name: 'instagram', label: 'Seu Instagram', type: 'text', ph: '@' },
      { name: 'whatsapp', label: 'Seu WhatsApp', type: 'tel', ph: '+351 …', autoComplete: 'tel' },
      { name: 'email', label: 'Seu e-mail', type: 'email', autoComplete: 'email' },
      { name: 'cidade', label: 'Cidade onde vive', type: 'text', hint: 'Trabalhamos presencialmente no Algarve e online no resto.' }
    ],
    [
      { name: 'negocio', label: 'Nome do negócio', type: 'text' },
      { name: 'instagram_negocio', label: 'Instagram do negócio', type: 'text', ph: '@', opcional: true, hint: 'Se ainda não existe, deixe em branco.' },
      { name: 'area', label: 'Área de atuação', type: 'select', options: ['Beleza e estética', 'Alimentação e restaurantes', 'Construção, obras e reformas', 'Saúde e bem-estar', 'Imobiliário', 'Advocacia, contabilidade e consultoria', 'Comércio e loja', 'Transporte e TVDE', 'Mentoria, cursos e infoprodutos', 'Serviços em geral', 'Outra'] },
      { name: 'tempo', label: 'Há quanto tempo', type: 'select', options: ['Ainda não abri — está nascendo', 'Menos de 1 ano', '1 a 3 anos', '3 a 5 anos', 'Mais de 5 anos'] },
      { name: 'equipa', label: 'Quem trabalha com você', type: 'select', options: ['Só eu', '2 a 3 pessoas', '4 a 10 pessoas', 'Mais de 10 pessoas'] }
    ],
    [
      { name: 'faturacao', label: 'Faturamento médio por mês', type: 'radio', options: ['Até €2.000', '€2.001 a €5.000', '€5.001 a €10.000', '€10.001 a €25.000', 'Mais de €25.000', 'Prefiro não dizer'] },
      { name: 'investe_hoje', label: 'Quanto investe hoje, por mês, em imagem, conteúdo ou marketing', type: 'radio', options: ['Nada', 'Até €150', '€150 a €400', '€400 a €800', 'Mais de €800'] },
      { name: 'disposto', label: 'Quanto estaria disposto a investir por mês para mudar seu posicionamento', type: 'radio', options: ['Menos de €300', '€300 a €700', '€700 a €1.200', '€1.200 a €2.000', 'Mais de €2.000', 'Depende do retorno que for provado'] },
      { name: 'valor_justo', label: 'Na sua opinião, quanto vale um acompanhamento mensal completo', type: 'text', hint: 'Imagem, produção de conteúdo e direção estratégica, tudo incluído. Diga o valor que parece justo para você, mesmo que não possa pagar hoje.' },
      { name: 'impacto_esperado', label: 'Se o seu Instagram passasse de amador para profissional, quanto você acredita que o faturamento poderia crescer', type: 'radio', options: ['Pouco, meu negócio não vem daí', 'Até 20%', 'Entre 20% e 50%', 'Podia duplicar', 'Podia mais do que triplicar'] },
      { name: 'prazo_inicio', label: 'Quando quer começar', type: 'radio', options: ['Imediatamente, é urgente para mim', 'Nas próximas semanas', 'Daqui a 1 ou 2 meses', 'Ainda estou só explorando'] },
      { name: 'interesse', label: 'Se não for o escolhido, quer a condição de lançamento', type: 'radio', options: ['Sim, quero saber os valores', 'Talvez, dependendo da proposta', 'Não, só me candidato à vaga'] }
    ],
    [
      { name: 'historia', label: 'Sua história', type: 'textarea', rows: 8, min: 150, hint: 'Onde você começou, onde está hoje e o que ainda te trava. É por aqui que escolhemos — escreva como você falaria.' },
      { name: 'obstaculo', label: 'O maior obstáculo hoje', type: 'radio', options: ['Ninguém me conhece', 'Publico, mas não converte em cliente', 'Não sei o que dizer nem como aparecer', 'Minha imagem não sustenta o preço que quero cobrar', 'Não tenho tempo para tratar disto'] },
      { name: 'expectativa', label: 'O que precisa mudar em 90 dias para isso ter valido a pena', type: 'textarea', rows: 3 },
      { name: 'disponibilidade', label: 'Disponibilidade para gravar um dia de conteúdo', type: 'radio', options: ['Sim, consigo ir até o Algarve', 'Sim, se for gravado no meu espaço', 'Só consigo trabalhar online'] },
      { name: 'imagem', label: 'Autorizo o uso da minha imagem e das gravações caso seja o negócio escolhido.', type: 'check' },
      { name: 'contacto', label: 'Aceito ser contatado pela SEVEN sobre esta candidatura e a condição de lançamento.', type: 'check' },
      { name: 'rgpd', label: 'Autorizo o tratamento dos meus dados pela SEVEN para avaliar esta candidatura e para contacto comercial, conforme o aviso de privacidade no rodapé.', type: 'check', hint: 'Podes retirar o consentimento e pedir a eliminação a qualquer momento em danilo@sevens.services.' }
    ]
  ];

  var CAMPOS_ENVIADOS = [
    'nome', 'instagram', 'whatsapp', 'email', 'cidade',
    'negocio', 'instagram_negocio', 'area', 'tempo', 'equipa',
    'faturacao', 'investe_hoje', 'disposto', 'valor_justo', 'impacto_esperado', 'prazo_inicio', 'interesse',
    'historia', 'obstaculo', 'expectativa', 'disponibilidade'
  ];

  /* ---------- state ---------- */

  var state = { passo: 0, vals: {}, erros: {}, aEnviar: false, enviado: false };
  var origem = 'direto';

  var el = {
    form: document.getElementById('form'),
    fields: document.getElementById('fields'),
    stepCurrent: document.getElementById('step-current'),
    stepTitle: document.getElementById('step-title'),
    stepSub: document.getElementById('step-sub'),
    progress: document.getElementById('progress'),
    formError: document.getElementById('form-error'),
    submit: document.getElementById('submit'),
    back: document.getElementById('back'),
    honeypot: document.getElementById('honeypot'),
    done: document.getElementById('done'),
    doneTitle: document.querySelector('.done__title'),
    doneProfiles: document.getElementById('done-profiles')
  };

  /* ---------- small helpers ---------- */

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function fieldNode(name) {
    return el.fields.querySelector('[data-field="' + name + '"]');
  }

  /* ---------- field rendering ---------- */

  function renderField(def) {
    var wrap = make('div', 'field');
    wrap.dataset.field = def.name;

    var labelId = 'lbl-' + def.name;
    var hintId = 'hint-' + def.name;
    var errId = 'err-' + def.name;
    var described = [];

    /* A radio group gets a plain caption: a real <label for> would
       check the first option on click. Everything else gets a <label>. */
    if (def.type !== 'check') {
      var label = make(def.type === 'radio' ? 'span' : 'label', 'field__label');
      label.id = labelId;
      if (def.type !== 'radio') label.htmlFor = def.name;
      label.appendChild(document.createTextNode(def.label));
      if (def.opcional) label.appendChild(make('span', 'field__optional', ' (opcional)'));
      wrap.appendChild(label);
    }

    if (def.hint) {
      var hint = make('span', 'field__hint', def.hint);
      hint.id = hintId;
      described.push(hintId);
      wrap.appendChild(hint);
    }

    var value = state.vals[def.name];

    if (def.type === 'text' || def.type === 'email' || def.type === 'tel') {
      var input = make('input', 'control');
      input.id = def.name;
      input.name = def.name;
      input.type = def.type === 'email' ? 'email' : def.type === 'tel' ? 'tel' : 'text';
      input.value = value || '';
      input.placeholder = def.ph || '';
      input.autocomplete = def.autoComplete || 'off';
      input.addEventListener('input', function () { set(def.name, input.value); });
      wrap.appendChild(input);
    } else if (def.type === 'select') {
      var select = make('select', 'control');
      select.id = def.name;
      select.name = def.name;
      select.appendChild(new Option('Selecione…', ''));
      def.options.forEach(function (o) { select.appendChild(new Option(o, o)); });
      select.value = value || '';
      select.addEventListener('change', function () { set(def.name, select.value); });
      wrap.appendChild(select);
    } else if (def.type === 'textarea') {
      var area = make('textarea', 'control');
      area.id = def.name;
      area.name = def.name;
      area.rows = def.rows || 4;
      area.value = value || '';
      area.placeholder = def.ph || '';
      area.addEventListener('input', function () {
        set(def.name, area.value);
        if (def.min) updateCount(def);
      });
      wrap.appendChild(area);
    } else if (def.type === 'radio') {
      var group = make('div', 'options');
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-labelledby', labelId);
      def.options.forEach(function (o) {
        var opt = make('label', 'option');
        opt.dataset.value = o;
        var radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = def.name;
        radio.value = o;
        radio.checked = value === o;
        radio.addEventListener('change', function () {
          set(def.name, o);
          paintOptions(def);
        });
        opt.appendChild(radio);
        opt.appendChild(make('span', 'option__dot'));
        opt.appendChild(make('span', null, o));
        if (value === o) opt.classList.add('is-on');
        group.appendChild(opt);
      });
      wrap.appendChild(group);
    } else if (def.type === 'check') {
      var consent = make('label', 'consent');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.id = def.name;
      box.name = def.name;
      box.checked = value === true;
      box.addEventListener('change', function () {
        set(def.name, box.checked);
        paintCheck(def);
      });
      consent.appendChild(box);
      consent.appendChild(make('span', 'consent__box', value === true ? '✓' : ''));
      consent.appendChild(make('span', null, def.label));
      if (value === true) consent.classList.add('is-on');
      wrap.appendChild(consent);
    }

    if (def.min) {
      var count = make('span', 'field__count');
      wrap.appendChild(count);
    }

    var error = make('span', 'field__error');
    error.id = errId;
    error.hidden = true;
    wrap.appendChild(error);

    /* Point the control (or the whole radio group) at its hint and error slot. */
    var describedTarget = wrap.querySelector('.control, [role="radiogroup"], input[type="checkbox"]');
    if (describedTarget) {
      described.push(errId);
      describedTarget.setAttribute('aria-describedby', described.join(' '));
    }

    if (def.min) updateCount(def, wrap);
    return wrap;
  }

  function updateCount(def, scope) {
    var wrap = scope || fieldNode(def.name);
    if (!wrap) return;
    var count = wrap.querySelector('.field__count');
    if (!count) return;
    var n = String(state.vals[def.name] || '').trim().length;
    count.textContent = n + ' / ' + def.min + ' caracteres';
    count.classList.toggle('is-met', n >= def.min);
  }

  function paintOptions(def) {
    var wrap = fieldNode(def.name);
    if (!wrap) return;
    var value = state.vals[def.name];
    wrap.querySelectorAll('.option').forEach(function (opt) {
      opt.classList.toggle('is-on', opt.dataset.value === value);
    });
  }

  function paintCheck(def) {
    var wrap = fieldNode(def.name);
    if (!wrap) return;
    var on = state.vals[def.name] === true;
    var consent = wrap.querySelector('.consent');
    consent.classList.toggle('is-on', on);
    consent.querySelector('.consent__box').textContent = on ? '✓' : '';
  }

  /* ---------- error painting ---------- */

  function paintError(name) {
    var wrap = fieldNode(name);
    if (!wrap) return;
    var message = state.erros[name] || '';
    var error = wrap.querySelector('.field__error');
    error.textContent = message;
    error.hidden = !message;

    var invalid = Boolean(message);
    var control = wrap.querySelector('.control');
    if (control) control.classList.toggle('is-invalid', invalid);
    wrap.querySelectorAll('.option, .consent').forEach(function (node) {
      node.classList.toggle('is-invalid', invalid);
    });

    var flagged = wrap.querySelector('.control, [role="radiogroup"], input[type="checkbox"]');
    if (flagged) flagged.setAttribute('aria-invalid', invalid ? 'true' : 'false');
  }

  function paintAllErrors() {
    DEFS[state.passo].forEach(function (def) { paintError(def.name); });
  }

  function setErroGeral(message) {
    el.formError.textContent = message || '';
    el.formError.hidden = !message;
  }

  /* ---------- value updates ---------- */

  function set(name, value) {
    state.vals[name] = value;
    if (state.erros[name]) {
      delete state.erros[name];
      paintError(name);
    }
    setErroGeral('');
  }

  /* ---------- validation ---------- */

  function validar() {
    var erros = {};
    DEFS[state.passo].forEach(function (def) {
      var v = state.vals[def.name];
      if (def.opcional) return;

      if (def.type === 'check') {
        if (v !== true) erros[def.name] = 'Confirmação obrigatória para continuar.';
        return;
      }
      if (!v || !String(v).trim()) {
        erros[def.name] = (def.type === 'radio' || def.type === 'select')
          ? 'Escolha uma opção.'
          : 'Preencha este campo.';
        return;
      }
      if (def.name === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
        erros[def.name] = 'Confira o endereço de e-mail.';
      }
      if (def.name === 'whatsapp' && String(v).replace(/\D/g, '').length < 9) {
        erros[def.name] = 'Informe um número com DDD.';
      }
      if (def.min && String(v).trim().length < def.min) {
        erros[def.name] = 'Escreva pelo menos ' + def.min + ' caracteres — vão ' + String(v).trim().length + '.';
      }
    });

    state.erros = erros;
    paintAllErrors();

    var nomes = Object.keys(erros);
    if (nomes.length) {
      setErroGeral('Falta preencher alguma coisa neste bloco.');
      var first = fieldNode(nomes[0]);
      var focusable = first && first.querySelector('.control, input');
      if (focusable) focusable.focus();
      return false;
    }
    return true;
  }

  /* ---------- navigation ---------- */

  function topo(node) {
    var target = node || el.form;
    if (!target) return;
    var y = target.getBoundingClientRect().top + window.pageYOffset - 84;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  function renderStep() {
    var passo = state.passo;

    el.stepCurrent.textContent = '0' + (passo + 1);
    el.progress.style.width = ((passo + 1) / 4 * 100) + '%';
    el.stepTitle.textContent = BLOCOS[passo].titulo;
    el.stepSub.textContent = BLOCOS[passo].sub;

    el.fields.textContent = '';
    DEFS[passo].forEach(function (def) { el.fields.appendChild(renderField(def)); });
    paintAllErrors();

    el.back.hidden = passo === 0;
    updateSubmit();
  }

  function updateSubmit() {
    el.submit.disabled = state.aEnviar;
    el.submit.textContent = state.aEnviar
      ? 'A enviar…'
      : state.passo < 3 ? 'Continuar' : 'Enviar candidatura';
  }

  function avancar() {
    if (state.aEnviar) return;
    if (!validar()) return;
    if (state.passo < 3) {
      state.passo += 1;
      setErroGeral('');
      renderStep();
      topo();
      el.stepTitle.focus({ preventScroll: true });
    } else {
      enviar();
    }
  }

  function voltar() {
    if (state.passo === 0) return;
    state.passo -= 1;
    setErroGeral('');
    renderStep();
    topo();
    el.stepTitle.focus({ preventScroll: true });
  }

  /* ---------- submit ---------- */

  function concluir() {
    state.enviado = true;
    el.form.hidden = true;
    el.done.hidden = false;
    topo(el.done);
    el.doneTitle.focus({ preventScroll: true });
  }

  function enviar() {
    if (el.honeypot.value) { concluir(); return; }

    var v = state.vals;
    var payload = { origem: origem, imagem: v.imagem === true, contacto: v.contacto === true, rgpd: v.rgpd === true };
    CAMPOS_ENVIADOS.forEach(function (n) {
      payload[n] = v[n] ? String(v[n]).trim() : '';
    });

    state.aEnviar = true;
    setErroGeral('');
    updateSubmit();

    fetch(SUPABASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      state.aEnviar = false;
      updateSubmit();
      concluir();
    }).catch(function () {
      state.aEnviar = false;
      updateSubmit();
      setErroGeral('Não conseguimos enviar a candidatura. Nada do que você escreveu foi perdido — toque em enviar novamente.');
    });
  }

  /* ---------- boot ---------- */

  function init() {
    try {
      var p = new URLSearchParams(window.location.search).get('de');
      if (p && p.trim()) origem = p.trim().toLowerCase();
    } catch (e) { /* origem stays "direto" */ }

    document.querySelectorAll('[data-bind="prazoCurto"]').forEach(function (node) {
      node.textContent = CFG.prazoCurto;
    });

    CFG.perfis.forEach(function (handle) {
      var chip = make('a', 'done__profile', handle);
      chip.href = 'https://instagram.com/' + handle.replace(/^@/, '');
      chip.target = '_blank';
      chip.rel = 'noopener';
      el.doneProfiles.appendChild(chip);
    });

    el.form.addEventListener('submit', function (e) {
      e.preventDefault();
      avancar();
    });
    el.back.addEventListener('click', voltar);

    renderStep();
  }

  init();
})();
