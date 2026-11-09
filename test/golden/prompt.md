# UI context from the running app

Page: `http://localhost:3000/dashboard`
Viewport: 1269×919

## What I need

Explain this component to me.

## Selection

### Selected element div.connection-pill

- markup: `src/lib/components/SystemStatus.svelte:37:0`
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
  - renders: 1
  - props: user={id: 1, name: "Rodrigo", email: "<redacted>", role: "owner", createdAt: "2026-01-01"}, active="overview"
  - $derived initial = "R"
  - $state menuOpen = false
3. +page — `src/routes/dashboard/+page.svelte`
  - renders: 1
  - props: data={locale: "pt-BR", user: {id: 1}, channels: [1, 2, 3], workspace: {id: 7}, conversations: [1, 2, 3, 4], guestConversations: []}, form=null, params={}
  - $derived firstName = "Rodrigo"
  - $derived greeting = "Your workspace, assistant, and conversa…"

Source of `src/lib/components/SystemStatus.svelte`:
```svelte
  29 |   onMount(() => {
  30 |     void refresh()
  31 |     const timer = window.setInterval(() => void refresh(), 30_000)
  32 |     return () => window.clearInterval(timer)
  33 |   })
  34 | </script>
  35 |
  36 | <!-- Quiet by design: a dot, a label, and a live region. -->
> 37 | <div class="connection-pill" aria-live="polite" title={i18n.t('status.liveTitle')}>
  38 |   <span class="dot {tone}" aria-hidden="true"></span>
  39 |   <span>{label}</span>
  40 | </div>
  41 |
  42 | <style>
  43 |   .connection-pill {
  44 |     display: inline-flex;
  45 |     gap: 6px;
```
---

### Selected element a.button.button-quiet

- markup: `src/routes/dashboard/+page.svelte:20`
- location note: `src/routes/dashboard/+page.svelte:20` is the enclosing element Svelte recorded; the element's own line was not found
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
  - renders: 1
  - props: data={locale: "pt-BR", user: {id: 1}, channels: [1, 2, 3], workspace: {id: 7}, conversations: [1, 2, 3, 4], guestConversations: []}, form=null, params={}
  - $derived greeting = "Your workspace, assistant, and conversa…"

Source of `src/routes/dashboard/+page.svelte`:
```svelte
  12 |   <section class="home-greeting">
  13 |     <div>
  14 |       <p class="eyebrow">{i18n.t('dashboard.eyebrow')}</p>
  15 |       <h1>{i18n.t('dashboard.welcome', { name: firstName })}</h1>
  16 |       <p>{greeting}</p>
  17 |     </div>
  18 |
  19 |     <!-- The actions wrap together on narrow screens. -->
> 20 |     <div class="page-actions">
  21 |       <a class="button button-quiet" href="/files">
  22 |         <Icon name="folder" />
  23 |         {i18n.t('dashboard.openSpace')}
  24 |       </a>
  25 |       <a class="button" href="/agent">{i18n.t('dashboard.openChat')}</a>
  26 |     </div>
  27 |   </section>
  28 | </main>
```
---

### Selected element button

- DOM path: `main > form > button`
- size: 96×32
- attributes: type="submit"

```html
<button type="submit"></button>
```

Component chain (innermost first):
1. +page — `src/routes/dashboard/+page.svelte`
  - props: {}
