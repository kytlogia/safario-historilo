<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <div class="text-truncate truncated-cell" :title="text">
    {{ text }}
  </div>
</template>

<style scoped>
.truncated-cell {
  max-width: 100%;
}
</style>
