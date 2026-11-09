# 09 — Security and privacy

Sphere runs inside the developer's own dev page and touches their source. The threat model is
narrow but real: a dev server is reachable from the network, and a clipboard is easy to leak.

## 1. Assets

| Asset | Where it lives | Who may see it |
|---|---|---|
| Source files | disk, read by the browser through Vite `/@fs` | the developer, in the prompt |
| Component state | the running page | the developer, in the prompt |
| Rendered page content | the app's DOM | **nobody** — not extracted (see §3) |
| Project root path | the plugin | the developer; never written into the page or the prompt |

## 2. Boundaries

- **Dev only.** `apply: 'serve'`, client-only environment, and a CI grep of the production build.
  Neither the overlay nor the runtime may exist in a build artefact.
- **No network.** The runtime, overlay and formatter perform no `fetch` except Vite's `/@fs` for
  source files, which is same-origin and dev-server-only. No telemetry, no CDN, no remote fonts.
- **No server-side file reading.** Sphere has no HTTP endpoint of its own; it does not read files
  with `fs`. Everything the prompt contains was read by the browser from `/@fs` (allow-listed by
  Vite) or came from the page.
- **No host environment.** The plugin never forwards `process.env`, and the browser bundle never
  receives it. Options are validated and serialised explicitly; nothing else crosses.
- **Clipboard only, user-initiated.** The payload is written only when the user presses
  *Copy prompt*. There is no auto-copy, no download, no `localStorage` copy of the payload.

## 3. What is deliberately not extracted

- The text the app renders (`textContent`): page copy can contain personal data, tokens in
  messages, or customer names — and it does not help locate the element.
- Form **properties** (`input.value`, `textarea.value`, `select` state): attributes only — and
  the `value` *attribute* is dropped for every `input`, `textarea`, `select` and `option`, so a
  prefilled email or hidden CSRF token is not copied. Attribute names and prop/state keys
  matching `token|secret|password|passwd|api-key|authorization|csrf|xsrf|session|cookie|...`
  are dropped or redacted, and PII-shaped keys are redacted
  (`docs/decisions/0010-prompt-data-policy.md`).
- URL query strings, fragments and credentials, on the page URL and on `href`/`src`/`action`/
  `formaction`/`poster` attributes: stripped. The page title is not emitted.
- Cookies, `localStorage`, `sessionStorage`, `indexedDB`, headers, network responses.
- Computed styles and screenshots of the page (v1).

## 4. Paths

- Absolute paths appear in the payload (`file`) because Svelte reports them; the **formatter**
  relativises them against the project root before the text reaches the clipboard.
- The project root is never injected into the HTML, the URL or an attribute — it travels in a
  virtual module (`docs/07-delivery.md` §4).
- Unit and e2e tests assert the clipboard output contains no match for `/home/`, `/Users/`,
  `[A-Z]:\\Users\\`, a URL query/fragment, or the project root.

## 5. Rendering safety (the overlay is a guest in someone's page)

- All page-derived strings are inserted with `textContent` / attribute setters, never with
  `innerHTML`. The markup skeleton is shown as text inside a code block.
- The overlay uses a shadow root so the host page's CSS cannot restyle it and its CSS cannot leak
  into the page; the host element is the only node Sphere adds to the DOM (plus an optional
  `<style>` while picking, removed when picking stops).
- Event handlers are added/removed with the picking mode; no listener survives it.
- The overlay never calls `eval`, `new Function`, or injects a `<script>`.

## 6. Prompt-content hygiene

- Selection text is bounded (budgets in `docs/03-instrumentation.md` §5), so a copied payload
  cannot be megabytes pasted into a remote model by accident.
- Rendered text is excluded (§3), which also removes the most common source of sensitive content.
- Attribute values are included after the redaction rules above (they are part of the markup).
  The source window and arbitrary string values are not content-scanned; the developer chose to
  include them, and `docs/decisions/0010-prompt-data-policy.md` records that residual risk.
- A configurable extra redact list remains a v1.1 candidate; the name-based floor ships now.

## 7. Threat model, briefly

| Threat | Mitigation |
|---|---|
| Another device on the LAN opens the app page during dev | Sphere is off unless enabled in the config; when enabled, the overlay is inert until clicked; nothing is served that reveals more than the page itself already does |
| A malicious page in another origin reads the clipboard | Browser permission model; Sphere only writes on a user gesture |
| The prompt is pasted into a third-party model with secrets | Text/markup exclusions, budget caps, and documented rules (§3, §6) |
| Supply chain | One package, dev-only install, no runtime dependencies if avoidable, lockfile committed |

## 8. Reporting

Security issues go to the repository's `SECURITY.md` with a private channel;
the plugin's dev-only nature does not make path disclosure or clipboard bugs non-issues.
