<script lang="ts">
  let { items = ['alpha', 'beta', 'gamma'] } = $props()
</script>

<ul>
  {#each items as item, index (item)}
    <li data-testid="item-{index}">{item}</li>
  {/each}
</ul>
