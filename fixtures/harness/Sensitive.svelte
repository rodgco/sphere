<script lang="ts">
  let {
    email = 'r@example.test',
    apiToken = 'sk-live-123',
    name = 'Sensitive',
  } = $props()

  let form = $state({ password: 'hunter2', count: 1 })
</script>

<p data-testid="sensitive">{name}</p>
<span hidden>{email}{apiToken}{form.password}{form.count}</span>
