<script lang="ts">
  let count = $state(0)
</script>

<main>
  <h1>Sphere fixture</h1>
  <p>Plain Svelte + Vite, with the plugin in the array.</p>
  <button onclick={() => (count += 1)}>clicked {count} times</button>
</main>
