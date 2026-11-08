<script lang="ts">
  import Host from './Host.svelte'
</script>

<Host>
  {#snippet children()}
    <p data-testid="snippeted">from the caller</p>
  {/snippet}
</Host>
