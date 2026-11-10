/**
 * The overlay's own stylesheet.
 *
 * A string, not a `.css` import: the overlay lives in a shadow root, and Svelte's compiled component
 * styles are injected into `document.head` where the shadow root cannot see them. `entry.ts` puts
 * this inside the shadow root, which also keeps the app's CSS out (`docs/06-toolbar-ux.md` §7).
 *
 * Tokens are the source of truth in `docs/06-toolbar-ux.md` §9.
 */
import { EDGE, PANEL_MAX_HEIGHT, PANEL_MAX_VIEWPORT_RATIO, PANEL_WIDTH } from './position.js'

export const OVERLAY_CSS = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  pointer-events: none;
  contain: layout style;
  color-scheme: light dark;
  font-family: var(--sphere-font);
  font-size: 13px;
  line-height: 1.45;

  /* Public token -> private token. A page declaration of --sphere-theme-* reaches the host by
     inheritance; the plugin's values are written to the host's inline style and win. The built-in
     value is only a fallback (docs/13-theming.md §3). */
  --sphere-font: var(--sphere-theme-font, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif);
  --sphere-mono: var(--sphere-theme-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  --sphere-radius: var(--sphere-theme-radius, 14px);
  --sphere-radius-sm: var(--sphere-theme-radius-sm, 8px);
  --sphere-radius-input: var(--sphere-theme-radius-input, 10px);
  --sphere-on-accent: var(--sphere-theme-on-accent, #ffffff);
  --sphere-on-picked: var(--sphere-theme-on-picked, #052e16);
  --sphere-picked: var(--sphere-theme-picked, #22c55e);
  --sphere-hover: var(--sphere-theme-hover, #3b82f6);
  --sphere-bg: var(--sphere-theme-bg, #ffffff);
  --sphere-fg: var(--sphere-theme-fg, #111827);
  --sphere-muted: var(--sphere-theme-muted, #6b7280);
  --sphere-border: var(--sphere-theme-border, #e5e7eb);
  --sphere-raised: var(--sphere-theme-raised, #f9fafb);
  --sphere-accent: var(--sphere-theme-accent, #2563eb);
  --sphere-danger: var(--sphere-theme-danger, #dc2626);
  --sphere-shadow: var(--sphere-theme-shadow, 0 12px 32px rgba(15, 23, 42, 0.18));
}

/* Only the mode-sensitive tokens are redeclared: the rest are mode-independent.
   theme.mode puts data-sphere-mode on the host; its attribute selector outranks this query. */
@media (prefers-color-scheme: dark) {
  :host {
    --sphere-bg: var(--sphere-theme-bg, #111827);
    --sphere-fg: var(--sphere-theme-fg, #f9fafb);
    --sphere-muted: var(--sphere-theme-muted, #9ca3af);
    --sphere-border: var(--sphere-theme-border, #374151);
    --sphere-raised: var(--sphere-theme-raised, #1f2937);
    --sphere-accent: var(--sphere-theme-accent, #60a5fa);
    --sphere-danger: var(--sphere-theme-danger, #f87171);
    --sphere-shadow: var(--sphere-theme-shadow, 0 12px 32px rgba(0, 0, 0, 0.55));
  }
}

:host([data-sphere-mode='light']) {
  --sphere-bg: var(--sphere-theme-bg, #ffffff);
  --sphere-fg: var(--sphere-theme-fg, #111827);
  --sphere-muted: var(--sphere-theme-muted, #6b7280);
  --sphere-border: var(--sphere-theme-border, #e5e7eb);
  --sphere-raised: var(--sphere-theme-raised, #f9fafb);
  --sphere-accent: var(--sphere-theme-accent, #2563eb);
  --sphere-danger: var(--sphere-theme-danger, #dc2626);
  --sphere-shadow: var(--sphere-theme-shadow, 0 12px 32px rgba(15, 23, 42, 0.18));
}

:host([data-sphere-mode='dark']) {
  --sphere-bg: var(--sphere-theme-bg, #111827);
  --sphere-fg: var(--sphere-theme-fg, #f9fafb);
  --sphere-muted: var(--sphere-theme-muted, #9ca3af);
  --sphere-border: var(--sphere-theme-border, #374151);
  --sphere-raised: var(--sphere-theme-raised, #1f2937);
  --sphere-accent: var(--sphere-theme-accent, #60a5fa);
  --sphere-danger: var(--sphere-theme-danger, #f87171);
  --sphere-shadow: var(--sphere-theme-shadow, 0 12px 32px rgba(0, 0, 0, 0.55));
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

/* The control draws its own ring on the pill, and only for keyboard use: the outline follows the
   pill's radius instead of boxing the label inside it. */
.inspect:focus,
.inspect:focus-visible {
  outline: none;
}

.control.focus-ring {
  outline: 2px solid var(--sphere-accent);
  outline-offset: 3px;
}

.control {
  position: fixed;
  right: ${EDGE}px;
  bottom: ${EDGE}px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 8px 0 12px;
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
.inspect {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  padding: 0;
  cursor: inherit;
}
.inspect .label { font-weight: 600; }
.inspect .dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--sphere-muted);
}
.inspect[aria-pressed='true'] .dot { background: var(--sphere-accent); }
.control:has(.inspect[aria-pressed='true']) { border-color: var(--sphere-accent); }

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
  width: ${PANEL_WIDTH}px;
  max-width: calc(100vw - ${2 * EDGE}px);
  max-height: min(${PANEL_MAX_VIEWPORT_RATIO * 100}vh, ${PANEL_MAX_HEIGHT}px);
  display: flex;
  flex-direction: column;
  border-radius: var(--sphere-radius);
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
.panel-close { margin-left: auto; padding: 2px 6px; border-radius: var(--sphere-radius-sm); color: var(--sphere-muted); }
.panel-close:hover { background: var(--sphere-raised); color: var(--sphere-fg); }

.panel-body { padding: 10px 14px; overflow-y: auto; }

.instructions {
  width: 100%;
  min-height: 58px;
  padding: 8px 10px;
  border-radius: var(--sphere-radius-input);
  border: 1px solid var(--sphere-border);
  background: var(--sphere-raised);
  color: var(--sphere-fg);
  font: inherit;
  resize: vertical;
}

.panel-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--sphere-border);
  flex-wrap: wrap;
}
.panel-footer .primary {
  height: 30px;
  padding: 0 12px;
  border-radius: var(--sphere-radius-sm);
  background: var(--sphere-accent);
  color: var(--sphere-on-accent);
  font-weight: 600;
}
.panel-footer .primary:disabled { opacity: 0.55; cursor: not-allowed; }
.panel-footer button:not(.primary) {
  height: 30px;
  padding: 0 10px;
  border-radius: var(--sphere-radius-sm);
  border: 1px solid var(--sphere-border);
}
.panel-footer button:not(.primary):hover { background: var(--sphere-raised); }

.picks { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 6px; }
.pick { display: flex; align-items: center; gap: 8px; }
.pick .badge {
  flex: none;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--sphere-picked);
  color: var(--sphere-on-picked);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  line-height: 18px;
}
.pick .name { font-family: var(--sphere-mono); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pick .where { color: var(--sphere-muted); font-size: 12px; white-space: nowrap; }
.pick .remove { margin-left: auto; padding: 2px 6px; border-radius: var(--sphere-radius-sm); color: var(--sphere-muted); }
.pick .remove:hover { background: var(--sphere-raised); color: var(--sphere-fg); }

.empty { margin: 0 0 10px; color: var(--sphere-muted); }

.options { display: flex; flex-wrap: wrap; gap: 10px 16px; padding: 10px 0; border-top: 1px solid var(--sphere-border); }
.options label { display: inline-flex; align-items: center; gap: 6px; color: var(--sphere-muted); }
.options input { accent-color: var(--sphere-accent); }

.status { min-height: 18px; margin: 0; color: var(--sphere-muted); font-size: 12px; }

.help {
  position: fixed;
  width: 300px;
  max-height: min(70vh, 520px);
  overflow-y: auto;
  padding: 12px 14px;
  border-radius: var(--sphere-radius);
  border: 1px solid var(--sphere-border);
  background: var(--sphere-bg);
  color: var(--sphere-fg);
  box-shadow: var(--sphere-shadow);
  pointer-events: auto;
}
.help-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.help-header h2 { margin: 0; font-size: 13px; font-weight: 600; }
.help-header .panel-close { margin-left: auto; }
.help-list { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 0; align-items: baseline; }
.help-list dt { display: flex; gap: 4px; align-items: center; white-space: nowrap; }
.help-list dd { margin: 0; color: var(--sphere-muted); font-size: 12px; }
.help-list kbd {
  display: inline-block;
  min-width: 18px;
  padding: 1px 5px;
  border-radius: 5px;
  border: 1px solid var(--sphere-border);
  background: var(--sphere-raised);
  font-family: var(--sphere-mono);
  font-size: 11px;
  text-align: center;
}
.help-sep { color: var(--sphere-muted); font-size: 11px; }
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
  color: var(--sphere-on-picked);
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
  font-family: var(--sphere-mono);
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.crosshair, .crosshair * { cursor: crosshair !important; }
`
