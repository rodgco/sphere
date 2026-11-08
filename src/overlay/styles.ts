/**
 * The overlay's own stylesheet.
 *
 * A string, not a `.css` import: the overlay lives in a shadow root, and Svelte's compiled component
 * styles are injected into `document.head` where the shadow root cannot see them. `entry.ts` puts
 * this inside the shadow root, which also keeps the app's CSS out (`docs/06-toolbar-ux.md` §7).
 *
 * Tokens are the source of truth in `docs/06-toolbar-ux.md` §9.
 */
export const OVERLAY_CSS = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  pointer-events: none;
  contain: layout style;
  font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  color-scheme: light dark;

  --sphere-bg: #ffffff;
  --sphere-fg: #111827;
  --sphere-muted: #6b7280;
  --sphere-border: #e5e7eb;
  --sphere-raised: #f9fafb;
  --sphere-accent: #2563eb;
  --sphere-picked: #22c55e;
  --sphere-hover: #3b82f6;
  --sphere-danger: #dc2626;
  --sphere-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
}

@media (prefers-color-scheme: dark) {
  :host {
    --sphere-bg: #111827;
    --sphere-fg: #f9fafb;
    --sphere-muted: #9ca3af;
    --sphere-border: #374151;
    --sphere-raised: #1f2937;
    --sphere-accent: #60a5fa;
    --sphere-danger: #f87171;
    --sphere-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
  }
}

*, *::before, *::after { box-sizing: border-box; }

/* The wrapper must not create a box: the marks, outline and panel are viewport-fixed. */
.overlay { display: contents; }

button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

:focus-visible {
  outline: 2px solid var(--sphere-accent);
  outline-offset: 2px;
}

.control {
  position: fixed;
  right: 18px;
  bottom: 18px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--sphere-border);
  background: var(--sphere-bg);
  color: var(--sphere-fg);
  box-shadow: var(--sphere-shadow);
  pointer-events: auto;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.control:active { cursor: grabbing; }
.control[aria-pressed='true'] { border-color: var(--sphere-accent); }
.control .label { font-weight: 600; }
.control .dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--sphere-muted);
}
.control[aria-pressed='true'] .dot { background: var(--sphere-accent); }

.chip {
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--sphere-raised);
  border: 1px solid var(--sphere-border);
  color: var(--sphere-muted);
  font-size: 12px;
  pointer-events: auto;
}
.chip:hover { color: var(--sphere-fg); }
.chip[aria-expanded='true'] { border-color: var(--sphere-accent); color: var(--sphere-fg); }

.panel {
  position: fixed;
  width: 420px;
  max-width: calc(100vw - 36px);
  max-height: min(70vh, 620px);
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  border: 1px solid var(--sphere-border);
  background: var(--sphere-bg);
  color: var(--sphere-fg);
  box-shadow: var(--sphere-shadow);
  pointer-events: auto;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--sphere-border);
}
.panel-header h2 { margin: 0; font-size: 13px; font-weight: 600; }
.panel-header .hint { margin: 0; color: var(--sphere-muted); font-size: 12px; }
.panel-close { margin-left: auto; padding: 2px 6px; border-radius: 8px; color: var(--sphere-muted); }
.panel-close:hover { background: var(--sphere-raised); color: var(--sphere-fg); }

.panel-body { padding: 10px 14px; overflow-y: auto; }

.picks { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 6px; }
.pick { display: flex; align-items: center; gap: 8px; }
.pick .badge {
  flex: none;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--sphere-picked);
  color: #052e16;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  line-height: 18px;
}
.pick .name { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pick .where { color: var(--sphere-muted); font-size: 12px; white-space: nowrap; }
.pick .remove { margin-left: auto; padding: 2px 6px; border-radius: 8px; color: var(--sphere-muted); }
.pick .remove:hover { background: var(--sphere-raised); color: var(--sphere-fg); }

.empty { margin: 0 0 10px; color: var(--sphere-muted); }

.options { display: flex; flex-wrap: wrap; gap: 10px 16px; padding: 10px 0; border-top: 1px solid var(--sphere-border); }
.options label { display: inline-flex; align-items: center; gap: 6px; color: var(--sphere-muted); }
.options input { accent-color: var(--sphere-accent); }

.status { min-height: 18px; margin: 0; color: var(--sphere-muted); font-size: 12px; }
.status.error { color: var(--sphere-danger); }

.mark {
  position: fixed;
  border: 2px solid var(--sphere-picked);
  border-radius: 2px;
  pointer-events: none;
}
.mark .badge {
  position: absolute;
  top: -10px;
  left: -10px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--sphere-picked);
  color: #052e16;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  line-height: 18px;
}

.hover-outline {
  position: fixed;
  border: 2px solid var(--sphere-hover);
  background: color-mix(in srgb, var(--sphere-hover) 14%, transparent);
  border-radius: 2px;
  pointer-events: none;
}

.tooltip {
  position: fixed;
  display: inline-flex;
  gap: 8px;
  max-width: 60vw;
  padding: 4px 8px;
  border-radius: 6px;
  background: #111827;
  color: #f9fafb;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.crosshair, .crosshair * { cursor: crosshair !important; }
`
