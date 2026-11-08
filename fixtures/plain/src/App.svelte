<script lang="ts">
  let count = $state(0)
</script>

<main>
  <header class="app-header">
    <h1 data-testid="title">Sphere fixture</h1>
    <p class="subtitle">A plain Svelte + Vite app with the plugin in the array.</p>
  </header>

  <section class="actions">
    <a id="app-link" class="button primary" href="/?navigated=1" data-testid="link">
      go to the next page
    </a>

    <button id="app-button" class="button" onclick={() => (count += 1)} data-testid="counter">
      clicked {count} times
    </button>
  </section>

  <section class="cards">
    <article class="card">
      <h2>One element</h2>
      <p>Pick any element on this page with the pill in the corner.</p>
    </article>
    <article class="card">
      <h2>Its context</h2>
      <p>Location, template frames, the component chain and live state.</p>
    </article>
    <article class="card">
      <h2>A prompt</h2>
      <p>Describe the change, copy, paste it into your agent.</p>
    </article>
  </section>

  <div id="injected-host">{@html '<em data-testid="injected">rendered by the browser</em>'}</div>

  <div id="pane" class="pane">
    <div style="height: 600px; padding-top: 320px;">
      <p id="deep" data-testid="deep">deep inside a scroll pane</p>
    </div>
  </div>

  <div class="spacer" aria-hidden="true"></div>
</main>

<style>
  :global(body) {
    margin: 0;
    font: 15px/1.55 ui-sans-serif, system-ui, sans-serif;
    color: #0f172a;
    background: #f8fafc;
  }

  main {
    max-width: 760px;
    margin: 0 auto;
    padding: 48px 24px;
  }

  .app-header h1 {
    margin: 0 0 6px;
    font-size: 30px;
    letter-spacing: -0.02em;
  }

  .subtitle {
    margin: 0 0 28px;
    color: #64748b;
  }

  .actions {
    display: flex;
    gap: 12px;
    margin-bottom: 32px;
  }

  .button {
    display: inline-flex;
    align-items: center;
    height: 38px;
    padding: 0 16px;
    border-radius: 10px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #0f172a;
    font: inherit;
    text-decoration: none;
    cursor: pointer;
  }

  .button.primary {
    border-color: #2563eb;
    background: #2563eb;
    color: #ffffff;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin-bottom: 28px;
  }

  .card {
    padding: 16px;
    border-radius: 14px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
  }

  .card h2 {
    margin: 0 0 6px;
    font-size: 15px;
  }

  .card p {
    margin: 0;
    color: #64748b;
    font-size: 14px;
  }

  .pane {
    height: 120px;
    overflow: auto;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #ffffff;
  }

  .pane p {
    padding-left: 16px;
  }

  #injected-host {
    margin: 12px 0;
    color: #64748b;
  }

  .spacer {
    height: 900px;
  }

  @media (prefers-color-scheme: dark) {
    :global(body) {
      color: #e2e8f0;
      background: #0b1120;
    }

    .subtitle,
    .card p,
    #injected-host {
      color: #94a3b8;
    }

    .button {
      border-color: #334155;
      background: #111827;
      color: #e2e8f0;
    }

    .button.primary {
      border-color: #3b82f6;
      background: #2563eb;
      color: #ffffff;
    }

    .card,
    .pane {
      border-color: #1e293b;
      background: #0f172a;
    }
  }
</style>
