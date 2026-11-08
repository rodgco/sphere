<script lang="ts">
  let { open = true } = $props()
</script>

{#if open}
  <p data-testid="yes">conditional</p>
{:else}
  <p data-testid="no">hidden</p>
{/if}
