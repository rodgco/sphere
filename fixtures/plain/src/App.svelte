<script lang="ts">
  let count = $state(0)
</script>

<main>
  <h1 data-testid="title">Sphere fixture</h1>
  <p>Plain Svelte + Vite, with the plugin in the array.</p>

  <a id="app-link" href="/?navigated=1" data-testid="link">go to the next page</a>

  <button id="app-button" onclick={() => (count += 1)} data-testid="counter">
    clicked {count} times
  </button>

  <div id="pane" style="height: 120px; overflow: auto; margin-top: 16px; border: 1px solid #ddd;">
    <div style="height: 600px; padding-top: 320px;">
      <p id="deep" data-testid="deep">deep inside a scroll pane</p>
    </div>
  </div>

  <div style="height: 1200px;" aria-hidden="true"></div>
</main>
