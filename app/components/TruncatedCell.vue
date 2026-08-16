<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <div class="text-truncate" style="max-width: 100%" :title="text">
    {{ text }}
  </div>
</template>
