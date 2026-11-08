<script lang="ts">
  let { name = 'Sphere', count = 0 } = $props()

  const doubled = $derived(count * 2)
  const label = $derived(`${name}: ${doubled}`)
</script>

<p data-testid="props">{label}</p>
