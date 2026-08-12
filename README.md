# Candidatura SEVEN Studio

Landing page and four-step application form for the SEVEN Studio 90-day
selection. Static HTML/CSS/JS — no build step. Deploy by uploading the repo
root (minus `node_modules/`) to any static host.

Built from the Claude Design handoff of `Candidatura SEVEN Studio.dc.html`
(project *UI mockups para página de seleção*).

## Layout

```
index.html            the page
assets/
  tokens.css          SEVEN design system — brand variables + Bai Jamjuree faces (unmodified)
  styles.css          page styles, loaded after tokens.css
  app.js              form: steps, validation, Supabase submit
  fonts/              Bai Jamjuree, 12 weights (only 400/500/600/700 are used, so
                      only those four are ever downloaded)
  logo-seal.png       round mark — navy baked in, composited with mix-blend-mode: screen
  logo-lockup.png     horizontal lock-up, same treatment
verify.mjs            browser test suite (dev only)
```

`tokens.css` is the design system's own file, copied in as-is. Load order
matters: it supplies the base type rules that `styles.css` layers on top of.
Notably its global `h3` rule is what uppercases the card headings — that
cascade is intentional and matches the mockup.

## Configuration

Campaign copy lives at the top of `assets/app.js`:

| Key          | Used for                                                         |
| ------------ | ---------------------------------------------------------------- |
| `prazoCurto` | the deadline in the top bar                                        |
| `prazoLongo` | declared by the design as an editable prop, but nothing renders it |
| `perfis`     | the Instagram chips on the confirmation screen                     |

Traffic source: append `?de=<source>` to the URL (e.g. `?de=instagram-bio`) and
it is lower-cased and stored as `origem` on the submission. Defaults to
`direto`.

## Submissions

The form POSTs to the Supabase REST endpoint in `assets/app.js`, table
`studio_applications`. The key is a **publishable** key, so it is fine in the
browser — but it is only as safe as the table's row-level security. Make sure
RLS on `studio_applications` grants that role `INSERT` and nothing else;
otherwise anyone can read every application.

Columns written: `origem`, the boolean consents `imagem` and `contacto`, and 21
text answers (`nome`, `instagram`, `whatsapp`, `email`, `cidade`, `negocio`,
`instagram_negocio`, `area`, `tempo`, `equipa`, `faturacao`, `investe_hoje`,
`disposto`, `valor_justo`, `impacto_esperado`, `prazo_inicio`, `interesse`,
`historia`, `obstaculo`, `expectativa`, `disponibilidade`).

A hidden `empresa_extra` honeypot catches bots: if it is filled, the
confirmation screen is shown and nothing is sent.

Nothing is persisted client-side, so a reload loses a part-filled form — same
as the mockup.

## Notes on the implementation

The mockup is a prototype, so a few things were built properly rather than
copied literally:

- **Radios and checkboxes are real inputs**, visually hidden inside their
  styled `<label>`. The mockup used `<button>`s, which gave no group semantics
  or arrow-key navigation. Renders identically. (Buttons get
  `text-rendering: auto` from the UA sheet, so `.option, .consent` opts out of
  the `optimizeLegibility` that `tokens.css` sets on `body` to keep glyphs
  matching.)
- **The card is a real `<form>`**, so Enter submits natively instead of via a
  keydown handler.
- **Failed validation focuses the first bad field** and errors are wired up
  with `aria-describedby` / `aria-invalid`. Step changes move focus to the step
  heading.
- **A disabled submit button no longer lightens on hover.**

Everything else is a literal match: full-page renders at 1280px and 390px are
pixel-identical to the prototype, as are the form's step, error, and
confirmation states.

## Tests

```
npm install
npm test
```

`verify.mjs` drives the page in headless Chromium and asserts 63 behaviours:
per-step validation and messages, values surviving back-navigation, the
progress bar and step counter, the character counter, the exact submitted
payload, the honeypot path, the network-failure path, and no horizontal
overflow at 360/768/1440px. It stubs the Supabase endpoint, so running it never
writes a real application.

Set `CHROMIUM_PATH` if Playwright cannot find a browser.
