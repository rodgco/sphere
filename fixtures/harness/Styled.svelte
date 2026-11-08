<script lang="ts">
  let { label = 'styled' } = $props()
</script>

<p class="styled" data-testid="styled">{label}</p>

<style>
  p {
    color: rebeccapurple;
  }
</style>
