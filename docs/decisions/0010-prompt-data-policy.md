# 0010 — Prompt data policy: redact known channels, document the residual risk

## Context

The clipboard document is paste-ready for a remote model or agent, so anything it contains has
left the machine. The MVP spec (`docs/01` §6) said the prompt “MUST NOT contain tokens”, while the
prompt format (`docs/05`) included the full page URL, the document title, every attribute value and
the whole props/state clone; `docs/09` §6 deferred redaction to v1.1. The audit (`docs/12` §4)
showed the consequence: form values, URL query strings, `props.user.email` and similar values
reached the prompt. A blanket promise is not implementable — a source window or a free-form prop can
always contain a secret — but the tool can stop the channels it knows about.

## Decision

The formatter and the runtime redact the following **before** text reaches the clipboard. The rules
are name- and channel-based, not content classification:

1. **Page URL.** Emit `origin + pathname` only. Drop query, fragment and URL credentials. Do not
   emit the document title: it routinely carries account or customer names.
2. **Form values.** The `value` attribute is dropped for every `input`, `textarea`, `select` and
   `option`, not only for `type="password"`. Form *properties* were never read.
3. **Sensitive names.** Attribute names and object keys matching
   `token|secret|password|passwd|api[-_]?key|authorization|csrf|xsrf|session|cookie|access[-_]?key|private[-_]?key`
   are dropped from attributes/markup, and their values are replaced with `"<redacted>"` in props
   and state. PII-shaped keys (`email`, `phone`, `ssn`, `credit-card`, `cvv`, `iban`,
   `account-number`) are redacted the same way.
4. **URL-bearing attributes.** `href`, `src`, `action`, `formaction` and `poster` are printed
   without credentials, query or fragment; the path and origin remain useful for locating the UI.
5. **Fences.** A markup block uses a code fence longer than the longest backtick run it contains.
   Fields outside a fence (heading, attributes, URLs) are reduced to one line and cannot start a
   new markdown block.
6. **Source windows.** Source is quoted only when the `source` option is on. Its lines are
   prefixed, so source text cannot close the fence; the source itself is the developer's code and
   is not content-scanned.

The source window, free-form instructions and arbitrary string props may still contain secrets.
That residual risk is explicit: Sphere reduces the known channels, it does not claim to classify
secrets.

## Consequences

- `docs/01` §6, `docs/05`, `docs/09` and the payload schema now describe the same rules. The old
  absolute “MUST NOT contain tokens” sentence is narrowed to the channels above.
- The golden prompt and `docs/specs/clipboard-example.md` change: no title, no URL query, no email,
  no form value, and redacted sensitive keys.
- A future content classifier or a user-configured redact list can tighten this; the current rules
  are the floor, not a promise of completeness.
- `props.user.email` is still structurally visible (`email: "<redacted>"`), so the developer can
  see that the value existed without seeing it.

## Alternatives

- **Keep the full URL and title** and document the risk. Rejected: OAuth codes, magic-link emails
  and tenant IDs are exactly what a developer debugging auth will copy.
- **Drop props and state entirely** until a redact option exists. Rejected: the component chain is
  the product's main value.
- **Content-based secret detection.** Rejected for v1: false negatives are indistinguishable from
  success, and false positives hide the data the prompt exists to show.
