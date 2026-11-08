<script lang="ts">
  import type { Snippet } from 'svelte'

  let { children }: { children?: Snippet } = $props()
</script>

<article class="host" data-testid="host">
  <h3>host</h3>
  {@render children?.()}
</article>
