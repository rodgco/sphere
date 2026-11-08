# Spec — clipboard example (golden shape)

Two real cases from a SvelteKit app, rewritten in the v1 format. These are the reference for
`test/golden/prompt.md` and `docs/05-prompt-format.md`.

## Case A — a verified location, one selection

The user picked `div.connection-pill` (a small status pill), typed one sentence.

````md
# UI context from the running app

Page: `http://localhost:3000/dashboard` (Home · App)
Viewport: 1269×919

## What I need

Explain this component to me.

## Selection

### Selected element div.connection-pill

- markup: `src/lib/components/SystemStatus.svelte:41:0`
- DOM path: `aside.sidebar > div#sidebar-menu.sidebar-content > div.sidebar-bottom > div:nth-of-type(1).connection-pill`
- size: 219×37
- attributes: aria-live="polite" title="Live status of the app service"
```html
<div class="connection-pill" aria-live="polite" title="Live status of the app service"></div>
```

Template context (innermost first):
- <SystemStatus /> at `src/lib/components/AppSidebar.svelte:177:6`
- <AppSidebar /> at `src/routes/dashboard/+page.svelte:44:2`

Component chain (innermost first):
1. SystemStatus — `src/lib/components/SystemStatus.svelte`
  - rendered by `src/lib/components/AppSidebar.svelte:177:6`
  - renders: 1
  - props: {}
  - $state health = {status: "ok", service: "web", database: "ok", uptimeSeconds: 1234, latencyMs: 12}
  - $state error = null
  - $derived tone = "ok"
  - $derived label = "All systems online"
2. AppSidebar — `src/lib/components/AppSidebar.svelte`
  - rendered by `src/routes/dashboard/+page.svelte:44:2`
  - props: user={id, name, email, role, createdAt}, active="overview"
  - $derived initial = "R"
  - $state menuOpen = false
  - $derived primary = [4 items]
3. +page — `src/routes/dashboard/+page.svelte`
  - props: data={locale, user, channels, workspace, conversations, guestConversations}, form=null, params={}
  - $derived firstName = "Rodrigo"
  - $derived greeting = "Your workspace, assistant, and conversations are ready."

Source of `src/lib/components/SystemStatus.svelte`:
```svelte
  33 | 
  34 | onMount(() => {
  35 |   void refresh();
  36 |   const timer = window.setInterval(() => void refresh(), 30_000);
  37 |   return () => window.clearInterval(timer);
  38 | });
  39 | </script>
  40 | 
> 41 | <div
  42 |   class="connection-pill"
  43 |   title={error ?? i18n.t("status.liveTitle")}
  44 |   aria-live="polite"
  45 | >
  46 |   <span class="dot {tone}" aria-hidden="true"></span>
  47 |   <span>{label}</span>
  48 | </div>
```
````

Notes on the shape:

- No rendered text in the heading or the markup (`All systems online` is gone) — the class
  names, the location and the `$derived label` already identify it.
- `$state health` keeps its scalar values because they fit the budget; `primary` (a list of
  records) collapses to `[4 items]`.
- `+layout` is not in the chain: it is rendered through SvelteKit's root component, which is a
  `node_modules` frame, so the chain stops at the page. `template` likewise shows only project
  frames.
- `props` say what they are, not “at mount”: Svelte props are getters, so the values are current.

## Case B — a location the compiler only recorded for an ancestor

The user picked a CTA inside a big static markup block; Svelte's `loc` pointed at the enclosing
`<div>`.

````md
### Selected element a.button.button-quiet

- markup: `src/routes/dashboard/+page.svelte:55`
- location note: line matched by `class="button button-quiet"`; Svelte recorded the enclosing element at `src/routes/dashboard/+page.svelte:43`
- DOM path: `main.app-main > section.home-greeting > div:nth-of-type(2).page-actions > a:nth-of-type(1).button.button-quiet`
- size: 144×40
- attributes: href="/files"
```html
<a class="button button-quiet" href="/files"></a>
```

Template context (innermost first):
- {@render} at `src/routes/+layout.svelte:25:0`

Component chain (innermost first):
1. +page — `src/routes/dashboard/+page.svelte`
  - props: data={locale, user, channels, workspace, conversations, guestConversations}, form=null, params={}
  - $derived greeting = "Your workspace, assistant, and conversations are ready."

Source of `src/routes/dashboard/+page.svelte`:
```svelte
  47 | <section class="home-greeting">
  48 |   <div>
  49 |     <p class="eyebrow">{i18n.t("dashboard.eyebrow")}</p>
  50 |     <h1>{i18n.t("dashboard.welcome", { name: firstName })}</h1>
  51 |     <p>{greeting}</p>
  52 |   </div>
  53 | 
  54 |   <div class="page-actions">
> 55 |     <a class="button button-quiet" href="/files">
  56 |       <Icon name="folder" />
  57 |       {i18n.t("dashboard.openSpace")}
  58 |     </a>
  59 |     <a class="button" href="/agent">{i18n.t("dashboard.openChat")}</a>
  60 |   </div>
  61 | </section>
```
````

Notes:

- The line is the element's own line (55), found by matching `class="button button-quiet"`, and
  the note says what happened. The column is omitted in this case because the compiler's column
  belongs to the ancestor.
- `href="/files"` alone would not have been enough (the other CTA shares no class but does share
  the shape); the class needle is what makes the match exact.
- The chip in the panel shows the same line prefixed with `~`.

## Case C — no location at all

```md
### Selected element button

- DOM path: `main > form > button`
- size: 96×32
- attributes: type="submit"
```html
<button type="submit"></button>
```

Component chain (innermost first):
1. …
```

The `- markup:` line is absent: nothing reliable was recorded and nothing matched in the file.
The prompt still says which file's chain produced the element.
