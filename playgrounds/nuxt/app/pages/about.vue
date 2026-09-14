<script setup lang="ts">
definePageMeta({ name: 'about' })
</script>

<template>
  <main>
    <h1>About</h1>
    <p>Second page, reachable with <code>medula_router_navigate</code>.</p>
    <NuxtLink to="/">Back home</NuxtLink>
  </main>
</template>
