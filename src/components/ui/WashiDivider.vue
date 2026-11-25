<script setup lang="ts">
/**
 * 和纸胶带分割线 —— 章节之间的分隔装饰。
 * 全站四件装饰母题之一。
 */
withDefaults(defineProps<{ label?: string }>(), { label: '' })
</script>

<template>
  <div class="washi-divider" role="separator">
    <span class="washi-line" aria-hidden="true" />
    <span v-if="label" class="washi-label">{{ label }}</span>
    <span v-if="label" class="washi-line" aria-hidden="true" />
  </div>
</template>

<style scoped>
.washi-divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 56px 0;
}

.washi-line {
  flex: 1;
  height: 8px;
  /* 半透明色带 + 斜纹，像一条和纸胶带 */
  background-image: repeating-linear-gradient(
    -45deg,
    color-mix(in srgb, var(--accent) 22%, transparent) 0 6px,
    transparent 6px 12px
  );
  border-radius: 2px;
}

.washi-label {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-soft);
  white-space: nowrap;
}
</style>
