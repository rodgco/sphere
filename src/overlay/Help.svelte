<script lang="ts">
  import { press } from './events.js'
  import { SHORTCUTS } from './keyboard.js'

  interface Props {
    style: string
    onClose(): void
  }

  let { style, onClose }: Props = $props()
</script>

<div class="help" role="dialog" aria-label="Keyboard shortcuts" {style}>
  <header class="help-header">
    <h2>Keyboard</h2>
    <button class="panel-close" type="button" aria-label="Close the shortcut list" use:press={onClose}>
      ✕
    </button>
  </header>

  <dl class="help-list">
    {#each SHORTCUTS as shortcut (shortcut.action)}
      <dt>
        {#each shortcut.keys as key, index (key)}
          {#if index > 0}<span class="help-sep">+</span>{/if}
          <kbd>{key}</kbd>
        {/each}
      </dt>
      <dd>{shortcut.action}</dd>
    {/each}
  </dl>
</div>
