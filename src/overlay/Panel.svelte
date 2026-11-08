<script lang="ts">
  import { onChange, onInput, press } from './events.js'
  import type { OverlayOptions } from './storage.js'
  import type { PickEntry } from './picks.js'

  interface Props {
    picks: PickEntry[]
    options: OverlayOptions
    instructions: string
    status: { text: string; error: boolean } | null
    style: string
    focusInstructions: boolean
    onRemove(pick: PickEntry): void
    onClear(): void
    onClose(): void
    onOptionsChange(key: keyof OverlayOptions, value: boolean): void
    onInstructionsChange(value: string): void
  }

  let {
    picks,
    options,
    instructions,
    status,
    style,
    focusInstructions,
    onRemove,
    onClear,
    onClose,
    onOptionsChange,
    onInstructionsChange,
  }: Props = $props()

  const TOGGLES: Array<[keyof OverlayOptions, string]> = [
    ['state', '$state'],
    ['props', 'props'],
    ['source', 'source'],
    ['template', 'template'],
  ]

  let textarea: HTMLTextAreaElement | undefined = $state()

  // docs/06 §8: when the panel opens from a pick, the instruction box takes focus.
  $effect(() => {
    if (focusInstructions && textarea !== undefined) textarea.focus({ preventScroll: true })
  })
</script>

<div class="panel" role="dialog" aria-label="Build a prompt" {style}>
  <header class="panel-header">
    <h2>Prompt</h2>
    <p class="hint">{picks.length === 0 ? 'nothing picked' : `${picks.length} picked`}</p>
    <button class="panel-close" type="button" aria-label="Close panel" use:press={onClose}>✕</button>
  </header>

  <div class="panel-body">
    {#if picks.length === 0}
      <p class="empty">Click Inspect, then click an element in the page.</p>
    {:else}
      <ol class="picks">
        {#each picks as pick, index (pick.element)}
          <li class="pick">
            <span class="badge" aria-hidden="true">{index + 1}</span>
            <span class="name">{pick.label}</span>
            {#if pick.where !== ''}
              <span class="where">{pick.where}</span>
            {/if}
            <button
              class="remove"
              type="button"
              aria-label={`Remove ${pick.label}`}
              use:press={() => onRemove(pick)}
            >
              ✕
            </button>
          </li>
        {/each}
      </ol>
    {/if}

    <textarea
      bind:this={textarea}
      class="instructions"
      rows="3"
      aria-label="Instructions"
      placeholder="What should the agent do?"
      value={instructions}
      use:onInput={(event) => onInstructionsChange((event.target as HTMLTextAreaElement).value)}
    ></textarea>

    <div class="options">
      {#each TOGGLES as [key, label] (key)}
        <label>
          <input
            type="checkbox"
            checked={options[key]}
            use:onChange={(event) => onOptionsChange(key, (event.target as HTMLInputElement).checked)}
          />
          {label}
        </label>
      {/each}
    </div>
  </div>

  <footer class="panel-footer">
    <button class="primary" type="button" disabled title="The prompt format arrives in M3">
      Copy prompt
    </button>
    <button type="button" use:press={onClear}>Clear</button>
    <p class="status" class:error={status?.error === true} role="status" aria-live="polite">
      {status?.text ?? ''}
    </p>
  </footer>
</div>
