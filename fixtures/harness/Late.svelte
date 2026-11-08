<script lang="ts">
  let open = $state(false)

  $effect(() => {
    open = true
  })
</script>

{#if open}
  <p data-testid="late">rendered after init</p>
{/if}
