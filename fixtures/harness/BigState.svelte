<script lang="ts">
  const all = $state(
    Array.from({ length: 500 }, (_, id) => ({ id, label: `item ${id}`, tags: ['alpha', 'beta'] })),
  )

  let { limit = 500 } = $props()

  const shown = $derived(all.slice(0, limit))
</script>

<p data-testid="big">{shown.length} items</p>
