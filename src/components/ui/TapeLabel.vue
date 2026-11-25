<script setup lang="ts">
/**
 * 胶带标签 —— 斜切半透明色块，用于 SAMPLE 标记、日期、分类。
 * 这是全站四件装饰母题之一。
 *
 * 用法：<TapeLabel>2026.11</TapeLabel>
 */
withDefaults(
  defineProps<{
    /** 配色：强调色 / 中性 / 警示 */
    tone?: 'accent' | 'neutral' | 'warn'
    /** 旋转角度（度），轻微歪一点更像手贴的 */
    tilt?: number
  }>(),
  { tone: 'accent', tilt: -1.5 },
)
</script>

<template>
  <span class="tape-label" :class="`tone-${tone}`" :style="{ '--tilt': `${tilt}deg` }">
    <slot />
  </span>
</template>

<style scoped>
.tape-label {
  display: inline-block;
  padding: 2px 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  line-height: 1.7;
  white-space: nowrap;
  transform: rotate(var(--tilt));
  /* 斜切的胶带两端 */
  clip-path: polygon(3% 0, 100% 2%, 97% 100%, 0 96%);
}

.tone-accent {
  background: var(--accent-soft);
  color: var(--accent);
}

.tone-neutral {
  background: var(--bg-soft);
  color: var(--ink-soft);
}

.tone-warn {
  background: #fff2c2;
  color: #8a6a00;
}

[data-theme='neon'] .tone-warn {
  background: #2e2410;
  color: #ffd166;
}
</style>
