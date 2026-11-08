<script lang="ts">
  import Child from './Child.svelte'
</script>

<div data-testid="first">first</div>
<Child label="in between" />
<div data-testid="last">last</div>
