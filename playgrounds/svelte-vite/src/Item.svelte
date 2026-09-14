<script lang="ts">
  let { label, done = $bindable(false) }: { label: string; done?: boolean } = $props()
  // component-local $state inside an {#each}
  let highlighted = $state(false)
</script>

<li class:done class:highlighted onpointerenter={() => (highlighted = true)} onpointerleave={() => (highlighted = false)}>
  <label><input type="checkbox" bind:checked={done} /> {label}</label>
</li>
