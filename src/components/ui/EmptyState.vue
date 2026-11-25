<script setup lang="ts">
/**
 * 空状态 —— 没有内容时显示的友好提示，不留白板。
 */
import { FileQuestion } from '@lucide/vue'

withDefaults(defineProps<{ title?: string; desc?: string }>(), {
  title: '这里还是空的',
  desc: '内容还在路上。',
})
</script>

<template>
  <div class="empty-state">
    <FileQuestion :size="34" :stroke-width="1.5" class="empty-icon" aria-hidden="true" />
    <p class="empty-title">{{ title }}</p>
    <p class="empty-desc">{{ desc }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty-state {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 64px 20px;
  border-radius: var(--r-card);
  border: 1px dashed var(--line);
  background: var(--bg-soft);
  text-align: center;
}

.empty-icon {
  color: var(--accent);
  opacity: 0.6;
}

.empty-title {
  font-size: 15px;
  color: var(--ink);
}

.empty-desc {
  font-size: 13px;
  color: var(--ink-soft);
}
</style>
