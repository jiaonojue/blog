<script setup lang="ts">
/**
 * 贴纸卡 —— 白底 + 2px 描边 + 轻微随机旋转。
 * 全站四件装饰母题之一，用于收藏卡、文章卡片。
 *
 * 【想要某张卡不旋转】传 tilt="0"
 */
withDefaults(
  defineProps<{
    /** 旋转角度（度） */
    tilt?: number
    /** 是否可点击（会加悬停描边绘制效果） */
    interactive?: boolean
  }>(),
  { tilt: 0, interactive: true },
)
</script>

<template>
  <div
    class="sticker-card"
    :class="{ 'is-interactive': interactive }"
    :style="{ '--tilt': `${tilt}deg` }"
  >
    <slot />
  </div>
</template>

<style scoped>
.sticker-card {
  position: relative;
  border-radius: var(--r-card);
  border: var(--w-stroke) solid var(--ink);
  background: var(--surface);
  padding: 18px;
  transform: rotate(var(--tilt));
  transition:
    transform var(--t-base) var(--ease-out),
    box-shadow var(--t-base) var(--ease-out),
    border-color var(--t-base) var(--ease-out);
}

/* 悬停：抬起 + 描边变强调色 */
.sticker-card.is-interactive:hover {
  transform: rotate(0deg) translateY(-4px);
  box-shadow: var(--shadow-lift);
  border-color: var(--accent);
}

/* 减少动效时不做位移 */
[data-motion='off'] .sticker-card.is-interactive:hover {
  transform: rotate(var(--tilt));
  box-shadow: var(--shadow);
}

@media (prefers-reduced-motion: reduce) {
  .sticker-card.is-interactive:hover {
    transform: rotate(var(--tilt));
  }
}
</style>
