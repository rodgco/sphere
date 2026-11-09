# 12 — Audit: security, correctness, and contract review (revised)

**Date:** 2026-11-08
**Revision audited:** `dbfa27b` (`master`), `sphere-plugin` 0.1.0
**Method:** read-only source review plus the repository's own commands. No code was changed to
produce the original document.
**Status:** findings **and remediation status**. The findings were reviewed afterwards; the
corrections below replace statements that were inaccurate or that mistook a spec conflict for a
code defect. Each finding says whether it is fixed, deferred, or not a defect.

## 1. Verdict

The happy path was polished and the suite green, but the security posture described in
`SECURITY.md` and `docs/09-security-and-privacy.md` was not the posture of the code. The most
important defects were not about an attacker reaching the dev server — they were about what the
tool puts in the clipboard, because the payload is handed to a remote model or agent by design.

Three classes were release blockers: the `/tmp` debug write (fixed), the degraded wrapper that
exported `undefined` (fixed), and the prompt data/injection problems (fixed). Two findings were
corrected after review:

- **`window.__SPHERE__`** was Medium, not a design choice; the global was removed rather than
  gated (a same-page script can read a same-page nonce).
- **`renders: 0`** is not a bug. The schema documents it as a placeholder and the formatter only
  prints it when `> 0`; the original finding pointed at the wrong file and described output that
  never appears.

## 2. Scope and calibration

This is a **dev-only** plugin. That was taken into account when assigning severity:

- **Reduced:** likelihood and blast radius of local attacks. The dev server is normally bound to
  loopback; a broken dev server is not a production outage; same-page scripts are usually the
  developer's own.
- **Not reduced:** what leaves the machine when the user copies a prompt. Dev environments are
  where real data concentrates — local `.env` files with live/staging keys, production dumps,
  seeded customer records, OAuth tokens from staging. The clipboard is the exfiltration channel,
  and the destination is an LLM.
- **Not reduced:** prompt injection, because the payload is explicitly consumed by an agent that
  can act on text.
- **Not reduced:** path portability and documentation contracts.

A note on "localhost": it is a weak boundary. `--host` (responsive testing on a phone), tunnels,
Codespaces/remote containers, and loopback DNS rebinding all break it. Treat it as lower
likelihood, not as trust.

## 3. Verification baseline

At the audited revision:

| Command | Result |
|---|---|
| `npm run lint` | pass |
| `npm run format:check` | pass |
| `npm run typecheck` | pass |
| `npm test` | 15 unit files / 123 tests; 17 harness files / 107 tests — pass |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm pack --dry-run` | 66 files, 63.2 kB packed; ships `src/` and `dist/` |

Environment: Node v26.11.1, npm 11.20.0, Svelte 5.57.3. The post-remediation suite is larger (see
§7); the counts above are the baseline that was audited.

The suite was green while §5.1 and §5.2 were present. That is a coverage statement, not a quality
statement: the tests did not exercise the failures that mattered most.

## 4. Findings — data that leaves the machine

These survive the dev-only caveat because the prompt is copied and pasted into a remote model.

### 4.1 Secrets and PII reach the prompt (High) — fixed

**Where:** `src/runtime/inspect.ts`, `src/runtime/budgets.ts`, `src/shared/redact.ts`,
`src/runtime/format.ts`.

**What (corrected):** the attribute-name regex was already case-insensitive, and inline `style`
was already dropped in both `attrs` and `markup` — the original finding overstated both. The real
gaps were:

- props and component state were cloned wholesale, so `props.apiToken` and `props.user.email`
  reached the prompt;
- `value` was kept for every input except a lowercase `type="password"`, so a hidden CSRF token,
  a prefilled email or `type="PASSWORD"` leaked;
- `href`/`src` were not inspected for credentials or query strings;
- `data-*`, `aria-label` and `title` were included unless their name matched the secret regex.

**Why it mattered:** `docs/01` §6 said the prompt MUST NOT contain tokens, and `docs/09` §3
promised the name filter. The product's purpose is to send this payload to a model; dev data is
frequently real data.

**Remediation:** `docs/decisions/0010-prompt-data-policy.md`; `REDACTED` keys in the bounded clone
and again in the formatter (defence in depth); every form `value` dropped; URL attributes
sanitised; credentials/PII keys redacted in props, state and named state. Tests in
`test/budgets.test.ts`, `test/format.test.ts`, `test/redact.test.ts` and
`test/harness/inspect-secrets.test.ts`.

**Status:** fixed (`dba2db3`).

### 4.2 The page URL and document title are included (High) — fixed

**Where:** `src/runtime/inspect.ts` (`pageInfo`), `src/runtime/format.ts` (`header`).

**What:** the full `location.href` (query, fragment, credentials) and `document.title` were written
into the prompt.

**Why it mattered:** URLs routinely carry OAuth `code`/`state`, magic-link emails, signed CDN
signatures, tenant IDs and search terms; titles can carry customer or account names. The original
audit cited `docs/09` §1 here, but the stronger contract conflict was `docs/05` (which specified
the URL and title) versus `docs/01` §6 (which forbade tokens). That is a spec decision, not only a
code bug.

**Remediation:** `sanitizePageUrl` keeps origin + pathname only; the formatter never emits the
title; `docs/05` and `docs/09` now say so. Tests cover query/fragment/credentials and the absent
title.

**Status:** fixed (`dba2db3`).

### 4.3 Prompt injection through unescaped code fences (High) — fixed

**Where:** `src/runtime/format.ts`.

**What (corrected):** the markup block was the real vector: attribute values are serialised with
newlines and backticks intact, so a value could close the `html` fence. The original audit also
named the source window and prop values; that was wrong. Source lines are prefixed with
`> 12 | `, so a backtick run in source cannot start a closing fence, and prop/state strings are
JSON-escaped, so they cannot introduce raw newlines. URLs, titles, headings and the `attributes`
bullet were still interpolated without escaping and could inject markdown.

**Remediation:** the markup fence is chosen longer than the longest backtick run; inline paths and
URLs use a safe code span; heading, attributes and notes are reduced to one line, with backticks
escaped. Tests feed triple/quadruple backticks and newline-bearing values.

**Status:** fixed (`85b3d6e`).

### 4.4 Machine paths leak (Medium) — fixed

**Where:** `src/shared/paths.ts`, `src/runtime/inspect.ts` (`componentName`),
`src/runtime/source.ts` (`sourceUrl`), `src/plugin/svelte-client.ts` (`isAppModule`).

**What:** `relativeTo` stripped only an exact POSIX root prefix. Windows paths were never
relativised, files outside the root stayed absolute, `componentName` basenamed only on `/`, and
`sourceUrl` treated a Windows drive path as relative (prepending the root) and built an `/@fs` URL
without the leading slash the drive form needs. `isAppModule` split on `path.sep`, while Vite ids
usually use `/` on Windows — the direction of that bug is that **dependency modules can be treated
as app modules**, not that app modules are skipped.

**Remediation:** browser-safe normalisation, case-insensitive drive comparison, both separators
in `baseName`/`isAppModule`, `external/<basename>` for files outside the root, and portable
`/@fs` URLs. Unit tests cover POSIX, Windows, UNC, root-relative and external paths.

**Status:** fixed (`4558098`).

### 4.5 `window.__SPHERE__` exposes props and state without a gesture (Medium) — fixed by removal

**Where:** `src/runtime/instrumentation.ts`, `src/runtime/inspect.ts`.

**What:** any same-page script could enumerate components and read props/state without a gesture.
A nonce in the same page is readable by the same scripts, so gating would not create a boundary.

**Remediation:** the global is gone (`docs/decisions/0011-no-page-global-api.md`). The overlay
imports `inspectElement`/`locateElement` directly; the instrumentation only wires their accessors.
The harness asserts `'__SPHERE__' in window === false`.

**Status:** fixed (`1bc463f`).

## 5. Findings — reliability and contract

### 5.1 The plugin writes to `/tmp` on every config hook (Medium) — fixed

**Where:** `src/plugin/inject.ts`, inside `usesSvelteKit`.

**What:** every `config`/`configResolved` call wrote resolved plugin names to a fixed path,
regardless of `enabled`. It breached `SECURITY.md:39` and `docs/07` §6, was a symlink/clobber
hazard, threw an unhandled rejection on Windows, and polluted `/tmp` on every test run.

**Remediation:** deleted. A regression test deletes the path, calls `usesSvelteKit`, and asserts it
is not recreated.

**Status:** fixed (`b339c36`).

### 5.2 Degraded instrumentation can crash the host app (High) — fixed

**Where:** `src/runtime/instrumentation.ts`, `src/plugin/svelte-client.ts`.

**What:** when a required export was missing, `installInstrumentation` returned `{}`; the wrapper's
local exports shadowed the star export with `undefined`, so compiled components called
`undefined`. This was the exact fallback scenario `docs/03` promised would not break the app.

**Correction to the fix direction:** the suggested “emit `export *` only” is not implementable in
a static ES module — the decision is made at runtime, when the wrapper imports the host's Svelte.
The chosen fix returns upstream's own functions for the fixed override set when the surface is
incomplete. The wrapper still shadows them locally, but they are callable; instrumentation is off.
The test uses a partial upstream and asserts each local export is the upstream function.

**Severity:** raised from Medium to High. It is the failure mode the fallback exists for.

**Status:** fixed (`baed518`).

### 5.3 The 60,000-character cap is not a cap (Medium) — fixed

**Where:** `src/runtime/format.ts`.

**What:** the notice was appended after slicing, so the result always exceeded `PROMPT_LIMIT`; the
test asserted that violation.

**Remediation:** reserve the notice, avoid splitting a surrogate pair, close a fence the cut
entered, and assert `<= PROMPT_LIMIT` in the test.

**Status:** fixed (`29cdc94`).

### 5.4 Location matching reports confident false positives (Medium) — fixed

**Where:** `src/runtime/location.ts`.

**What (corrected):** the original finding cited `docs/specs/location-resolution.md`, which
explicitly allowed classless verification by tag alone. The real conflict was with `docs/04` §3,
which requires an identifying attribute, and the code was weaker than both: any same-tag line
verified a classless element. `matchSourceLine` also used `includes`, so `data-id="x"` matched
`id="x"`; multiline tags failed single-line verification; script blocks were scanned as markup.

**Remediation:** classless verification requires an exact identifying attribute; attribute names
are matched at a real boundary; tags are joined across lines; script/style blocks are skipped. The
location spec and `docs/04` now agree and have the new cases in their test matrices.

**Status:** fixed (`5dea174`).

### 5.5 The source cache never invalidates on HMR (Medium) — fixed

**Where:** `src/runtime/source.ts`.

**What:** `/@fs` reads were cached for the page lifetime, so the prompt quoted stale source after
an edit.

**Remediation:** the loader clears its cache on Vite's `vite:afterUpdate` event. The docs now
describe a cache with HMR invalidation, not a page-lifetime cache.

**Status:** fixed (`4558098`).

### 5.6 Selector construction does not escape identifiers (Low) — fixed

**Where:** `src/runtime/inspect.ts` (`selectorOf`).

**What:** ids/classes were interpolated raw, so `foo:bar` or `123` produced an invalid selector.

**Remediation:** `CSS.escape`, with a small fallback when unavailable. Harness test covers
`a:b` / `x.y`.

**Status:** fixed (`7dbe0b7`).

### 5.7 `$derived` values can be stale (Low) — fixed

**Where:** `src/runtime/inspect.ts` (`stateValue`), `src/runtime/instrumentation.ts`.

**What:** reading `.v` directly does not refresh a dirty `$derived`.

**Remediation:** the instrumentation installs a `readSignal` accessor backed by Svelte's own
`get`; `.v` remains the fallback when `get` is unavailable or the source is not a signal.

**Status:** fixed (`7dbe0b7`).

### 5.8 Stored control position is not clamped (Low) — fixed

**Where:** `src/overlay/Overlay.svelte` / `src/overlay/storage.ts`.

**What:** `readControl` checked only finiteness; an off-screen stored value hid the control. The
original finding said there was no recovery path; double-click resets and resize clamps existed,
but neither is reachable when the control is fully off-screen.

**Remediation:** the stored position is clamped against the viewport and control size on mount;
resize and drag already clamp. Harness test covers an extreme value.

**Status:** fixed (`7dbe0b7`).

### 5.9 `safeStorage` writes a probe on every call (Low) — fixed

**Where:** `src/overlay/storage.ts`.

**What:** availability was tested by writing and removing a key, mutating the host app's storage
and firing `storage` events in other tabs.

**Remediation:** a read probe. Test asserts `setItem` is not called.

**Status:** fixed (`7dbe0b7`).

### 5.10 `legacyCopy` steals focus and selection (Low) — fixed

**Where:** `src/overlay/clipboard.ts` (the original finding said `Overlay.svelte`; the function
lives in `clipboard.ts`).

**What:** the fallback focused/selected a temporary textarea and left the developer's focus and
selection where the copy put them.

**Remediation:** save the active element and selection ranges, restore both in `finally`. Harness
test asserts focus returns to the control.

**Status:** fixed (`7dbe0b7`).

### 5.11 `renders` is always zero (Low) — not a defect

**Where:** `src/runtime/inspect.ts:383`, `src/runtime/format.ts:291`.

**Correction:** the field is set in `inspect.ts`, not `format.ts`, and the formatter only prints
`renders:` when `> 0`. `docs/specs/payload-schema.md` documents `0` as a deliberate placeholder
until template effects are wrapped. The original finding described output that never appears.
Keeping the schema field is a conscious choice; remove it only if the schema changes.

**Status:** no code change; finding withdrawn.

### 5.12 Overlay event handling is incomplete (Low) — partly fixed

**Where:** `src/overlay/picking.ts`, `src/overlay/Overlay.svelte`, `src/overlay/clipboard.ts`.

**What was right:** the overlay's `shield` stops bubble propagation only, so host capture listeners
still see overlay interactions; a drag had no `pointercancel` cleanup.

**Correction:** the Escape behaviour was not a code bug. `docs/specs/event-matrix.md` and
`e2e/picking.mjs` both require Escape to close the panel and leave picking, and `docs/06` line 65
says the same; only `docs/06` line 44 described an else-chain. “Unhandled keys reach the app” is
also explicitly required by the event matrix (“other keys reach the page”), not a defect. The doc
was fixed, not the handler.

**Remaining:** app capture listeners registered before Sphere still run before the overlay's
window/document capture handlers; the e2e suite does not prove that boundary. This is a documented
limitation, not a claim that the event matrix is absolute.

**Status:** pointercancel and the doc conflict fixed (`7dbe0b7`, this document); capture-order
limitation stays open.

### 5.13 Marks and pointer handling can jank a dev page (Low) — deferred

**Where:** `src/overlay/Overlay.svelte`, `src/overlay/picking.ts`, `src/overlay/marks.ts`.

**What:** a document `MutationObserver` with `attributes: true`, `getBoundingClientRect` and
`getComputedStyle` per ancestor on pointermove, and `locateElement` per move. The original said
“inspection per pointermove”; it is not `inspectElement`/prop cloning, but the per-move DOM work is
real.

**Remediation:** no benchmark yet. `docs/08` and `docs/10` now say the `perf/` gate is planned
for v1.1; the budgets are the current protection.

**Status:** deferred; docs reconciled.

## 6. Documentation vs implementation

The original table mixed real drift with spec-vs-spec conflicts. The corrected state:

| Claim | Location | State |
|---|---|---|
| “does no I/O” | `docs/07` §6 | true after the `/tmp` removal (`b339c36`) |
| “Nothing of yours is logged … to a file” | `SECURITY.md:39` | true after the `/tmp` removal |
| Rendered content not extracted / URL private | `docs/09` §1, §3 | title removed, URL sanitised; `docs/05` and `docs/09` aligned (`dba2db3`) |
| Sensitive attrs dropped | `docs/09` §3 | now covers every form value, URL attributes and sensitive/PII keys |
| Prompt MUST NOT contain tokens/PII | `docs/01` §6 | narrowed to the controllable channels in decision 0010; source/free-form text is explicit residual risk |
| Hard 60,000 cap | `docs/01` §6, `docs/05` §1 | true (`29cdc94`) |
| Tests assert Windows path leakage | `docs/09` §4 | unit tests cover Windows/UNC/external paths (`4558098`) |
| `sphere({ instrumentation: false })` | `docs/10` §1 | implemented (`181080b`) |
| `virtual:sphere/config` exports `{ root, base, options, version }` | `docs/07` §2 | corrected to `{ root, base, version }`; §4 already matched |
| Runtime injected via `virtual:sphere/runtime` | `docs/07` §3 | corrected: the page loads `virtual:sphere/overlay` |
| Coverage ≥ 95 % / ≥ 98 % | `docs/08` §7 | not enforced in 0.1; docs now say so |
| Benchmark suite in `perf/` | `docs/10` §3, `docs/08` §7 | not present; docs now call it a v1.1 gate |
| Escape closes list, **else** panel, **else** picking | `docs/06` | corrected to match the event matrix and e2e: panel and picking close together |
| State nodes ranked by name | `docs/03` | `docs/03` contradicted itself; both places now say creation order |
| `getRuntime()` accessor | `docs/02` | corrected to the installed accessors (`instanceOf`, `frameOf`, `readSignal`); no global |
| `SECURITY.md` “to be added at M1” | `docs/09` §8 | corrected; the file exists |
| Source failures remembered, one fetch per file | `docs/07` §5 | true; HMR now invalidates the cache |
| “a broken Sphere must not break the app” | `docs/03` | true after the fallback fix (`baed518`) |

## 7. Tests and CI

- **The two must-fix defects are now tested.** `test/svelte-client.test.ts` covers the partial
  upstream; `test/inject.test.ts` asserts `usesSvelteKit` writes nothing.
- **The cap test asserts the spec** (`<= PROMPT_LIMIT`), not the violation.
- **Redaction tests exist.** The original “No redaction tests” was wrong:
  `test/harness/inspect-secrets.test.ts` already covered sensitive attribute names and the
  password `value`. It now also covers every form value, uppercase `PASSWORD`, URL sanitising and
  PII/credential props/state. Unit tests cover `test/redact.test.ts` and `test/budgets.test.ts`.
- **Prompt-injection tests** cover dynamic fences and one-line fields.
- **Windows path tests** are unit tests (`test/paths.test.ts`, `test/location.test.ts`,
  `test/format.test.ts`); they do not require Windows to run.
- **CI is still not pinned.** `actions/checkout@v4`, `actions/setup-node@v4`,
  `changesets/action@v1` and `npm install --global npm@latest` remain mutable. This is open; pin
  to commit SHAs when the release process is next touched.
- **`release.yml` still passes `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`.** The workflow
  comment says it is a fallback and OIDC (`id-token: write`) is the primary path, so “either the
  secret exists or the workflow is broken” was too strong. Removing the fallback or documenting
  why it remains is still a cleanup.
- **Browser-only claims are unverified in the default path.** `npm run e2e` needs Chromium and is
  not part of `npm test`. That is a deliberate split, but CI is the only place the browser layer
  is exercised.
- **The package ships `src/` and `dist/`.** `docs/07` §2 documents why the sources are shipped;
  this is a conscious decision, not an accident.

## 8. Portability

- `isAppModule` now splits on both separators; the original direction of the bug was inverted
  (dependency modules could be treated as app modules on Windows).
- `relativeTo` handles POSIX/Windows/UNC and never prints a path outside the root.
- `sourceUrl` keeps Windows drive paths absolute and adds the leading slash `/@fs` needs.
- `/tmp/config-plugins.json` is gone.
- The README does not state supported operating systems; the code is now separator-aware, but a
  real Windows CI job is still missing. This is open.
- `truncate` preserves surrogate pairs and closes fences.
- `fileNameKey` and `installedOnce` are module-global, so two Svelte clients on one page
  (micro-frontends, multiple roots) share the first winner. This is still open; the behaviour is
  documented, not fixed.

## 9. What is done well

- The opt-in `enabled` switch, `apply: 'serve'`, and `applyToEnvironment` client gate are the
  right shape; `instrumentation: false` now gives the documented escape hatch.
- Source is shipped rather than inlined, and the virtual-module IDs avoid the SvelteKit `\0`
  pitfall; the reasoning in `src/plugin/inject.ts` is correct.
- `installInstrumentation` memoizes per upstream and warns once; the star-export-plus-narrow-
  override design is sound now that the degraded case re-exports upstream functions.
- The overlay's shadow DOM, `textContent`-only rendering, and explicit attribute setters are safe
  against XSS from page data; focus, selection and storage behaviour no longer disturb the app.
- The suite is broad and fast; the fixtures and golden scripts are a good foundation.
- `docs/learning/` cites Svelte internals with file, function, and version — rare and valuable.

## 10. Remediation status

Done, in commit order:

1. `b339c36` — delete the `/tmp` write.
2. `baed518` — fall back to upstream exports when instrumentation degrades.
3. `c7a9ebf` — decision 0010 and the aligned prompt-data docs.
4. `dba2db3` — redact form values, URLs, sensitive props/state; drop the title.
5. `85b3d6e` — dynamic fences and one-line fields.
6. `29cdc94` — hard 60,000-character cap.
7. `4558098` — portable paths, `/@fs` URLs and HMR cache invalidation.
8. `5dea174` — identity-based location verification.
9. `1bc463f` — remove the page global.
10. `7dbe0b7` — control clamp, storage probe, drag cancel, copy focus, `CSS.escape`, `readSignal`.
11. `181080b` — `instrumentation: false`.
12. Documentation reconciliation and this corrected audit.
13. `88b8f6e` — filesystem-root relative paths and guarded focus restoration.
14. `4888809` — quote prop/structure keys so a key cannot start a markdown line.
15. `0a74b59` — cover the drag `pointercancel` cleanup.

Still open, deliberately: CI action pinning, the NPM_TOKEN fallback, a real Windows CI job, a
`perf/` benchmark, coverage thresholds, the capture-order limitation in §5.12, and two Svelte
clients on one page (§8).

## 11. Reproduction notes

These were the original reproductions; the first four are now regression tests, not live defects.

- `/tmp` write: `test/inject.test.ts` now deletes the file, calls `usesSvelteKit`, and asserts it
  is not recreated.
- Degraded wrapper: `test/svelte-client.test.ts` uses a partial upstream and asserts the local
  exports are upstream's functions.
- Cap: `test/format.test.ts` asserts `result.text.length <= PROMPT_LIMIT`.
- Prompt injection: `test/format.test.ts` feeds backticks/newlines and asserts the fence length.
- Redaction: `test/harness/inspect-secrets.test.ts` inspects real DOM and a Svelte fixture.
- Paths: `test/paths.test.ts` covers POSIX, Windows, UNC and external roots.
