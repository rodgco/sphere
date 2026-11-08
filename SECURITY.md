# Security policy

## What Sphere is, in one line

A dev-only Vite plugin that copies a markdown prompt describing a picked element to your
clipboard. It is not installed in production builds and it never sends anything anywhere.

## Reporting a vulnerability

Open a private report through GitHub:
<https://github.com/rodgco/sphere/security/advisories/new>

Please do not open a public issue for anything that writes data outside the page or more than the
clipboard. Include the version, the Svelte/Vite versions, and — if you can — a minimal reproduction
(a fixture or a snippet), never the app's real source.

You can expect an acknowledgement within seven days. This is a small project without a paid
on-call rota; fixes are prioritised by exposure, and a bypass of the "clipboard only" rule is
treated as the highest severity.

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | yes (the prompt format is documented as unstable until 1.0) |
| < 0.1 | no |

## The properties we test

- **No network.** Sphere has no HTTP endpoint of its own and never sends the payload anywhere.
  The only requests the browser makes are to the dev server it is already running on.
- **Clipboard only.** The prompt leaves the page through `navigator.clipboard` (with a
  `document.execCommand` fallback), and nowhere else.
- **Dev server only.** Every plugin is `apply: 'serve'`; `test/prod-noop.test.ts` builds the
  fixture and fails if a production bundle mentions Sphere.
- **No machine paths or rendered text in the prompt.** `src/runtime/format.ts` relativises paths
  and never uses rendered text as identity; the browser tests assert both.
- **Screenshots are scanned** for machine paths and token patterns before they are written.
- **Nothing of yours is logged** to the terminal or to a file by the plugin.

## Out of scope

- An app that deliberately publishes its own source or state (Sphere reads what the dev server
  already serves to the browser).
- `localStorage` contents in a browser profile (`sphere:control`, `sphere:options` — UI preferences
  only).
- The Svelte internals coupling: `svelte/internal/client` is not a public API. A Svelte release
  that changes it degrades Sphere (a warning, no component context) rather than breaking the app.
