<script lang="ts">
  /**
   * Panel geometry lab (`npm run lab`).
   *
   * Every tile is a pickable element, so the pill can be opened anywhere and dragged to any corner;
   * the dashed frame is the 18 px margin the panel must stay inside. The steps are on the page
   * because the lab is also the thing a reviewer opens by hand.
   */
  const COLUMNS = 6
  const ROWS = 4
  const tiles = Array.from({ length: COLUMNS * ROWS }, (_, index) => index + 1)
</script>

<main class="lab">
  <p class="steps">
    <strong>Panel geometry lab.</strong>
    1. Click <em>Inspect</em>. 2. Click any tile — the dialog opens. 3. Drag the pill to a corner:
    the panel follows, stays 10 px away, and flips side as the pill approaches an edge. Resize the
    window to see the width, the height cap and the margin adjust.
  </p>

  <div class="grid" style="--columns: {COLUMNS}">
    {#each tiles as tile (tile)}
      <button class="tile" type="button" data-tile={tile}>tile {tile}</button>
    {/each}
  </div>
</main>

<div class="margin" aria-hidden="true">
  <span>18 px viewport margin</span>
</div>

<style>
  :global(html, body) {
    height: 100%;
    margin: 0;
    overflow: hidden;
    font: 13px/1.5 ui-sans-serif, system-ui, sans-serif;
    background: #f8fafc;
    color: #0f172a;
  }

  .lab {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    padding: 44px 34px;
  }

  .steps {
    margin: 0;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px dashed #cbd5e1;
    background: #ffffff;
    color: #475569;
    max-width: 78ch;
  }
  .steps strong {
    color: #0f172a;
  }
  .steps em {
    font-style: normal;
    font-weight: 600;
    color: #1d4ed8;
  }

  .grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
    gap: 8px;
    min-height: 0;
  }

  .tile {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #64748b;
    font: inherit;
    cursor: pointer;
  }
  .tile:hover {
    border-color: #94a3b8;
    color: #334155;
  }

  /* The margin the panel must respect, drawn on the page instead of in the overlay. */
  .margin {
    position: fixed;
    inset: 18px;
    border: 1px dashed #c4b5fd;
    border-radius: 6px;
    pointer-events: none;
  }
  .margin span {
    position: absolute;
    top: -20px;
    left: 0;
    color: #7c3aed;
    font-size: 11px;
  }

  @media (prefers-color-scheme: dark) {
    :global(html, body) {
      background: #0b1120;
      color: #e2e8f0;
    }
    .steps {
      border-color: #1e293b;
      background: #0f172a;
      color: #94a3b8;
    }
    .steps strong {
      color: #e2e8f0;
    }
    .steps em {
      color: #93c5fd;
    }
    .tile {
      border-color: #1e293b;
      background: #0f172a;
      color: #94a3b8;
    }
    .tile:hover {
      border-color: #334155;
      color: #cbd5e1;
    }
    .margin {
      border-color: #4c1d95;
    }
    .margin span {
      color: #a78bfa;
    }
  }
</style>
