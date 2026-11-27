<script setup lang="ts">
/**
 * 逐字点亮的栏目标题。
 *
 * 【它做什么】
 *   把标题拆成一个一个字。滚动到视口里的时候，
 *   字从左到右依次"点亮"：从半透明的墨色变成主色，
 *   同时有一道高光从字上扫过去——像荧光笔把标题划了一遍。
 *   只演一次，演完就静止，不打扰往下的阅读。
 *
 * 【为什么拆字而不是整体淡入】
 *   整块淡入太常见了，眼睛不会为它停下来。
 *   逐字点亮有"节奏"，读者能感觉到有人在写这个标题——
 *   这是同人志手排版的气质，也是"高技术力"该在的地方。
 *
 * 【减少动效】
 *   prefers-reduced-motion / 站内动效关闭时全部直接点亮，
 *   没有任何动画。
 */
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { motionEnabled } from '@/composables/useSettings'

const props = defineProps<{
  /** 标题文本。必传——没有它这个组件无事可做 */
  text: string
}>()

const root = ref<HTMLElement | null>(null)
const lit = ref(false)

const chars = computed(() => [...props.text])

let io: IntersectionObserver | null = null

onMounted(() => {
  // 动效关掉（或环境不支持）时直接点亮，不搭观察器
  if (!motionEnabled.value || typeof IntersectionObserver === 'undefined') {
    lit.value = true
    return
  }
  io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        lit.value = true
        io?.disconnect()
        io = null
      }
    },
    { threshold: 0.6 },
  )
  if (root.value) io.observe(root.value)
})

onUnmounted(() => {
  io?.disconnect()
  io = null
})
</script>

<template>
  <span ref="root" class="glow-title" :class="{ 'is-lit': lit }" aria-label="">
    <span
      v-for="(c, i) in chars"
      :key="i"
      class="glow-char"
      :style="{ '--d': `${i * 90}ms` }"
      aria-hidden="true"
    >
      {{ c }}
    </span>
    <span class="sr-only">{{ text }}</span>
  </span>
</template>

<style scoped>
.glow-title {
  display: inline-flex;
}

.glow-char {
  display: inline-block;
  color: var(--ink);
  opacity: 0.5;
  /* 高光层： lit 之后一道亮色从左往右扫过每个字 */
  background-image: linear-gradient(
    100deg,
    transparent 0%,
    transparent 42%,
    color-mix(in srgb, var(--accent) 85%, white) 50%,
    transparent 58%,
    transparent 100%
  );
  background-size: 260% 100%;
  background-position: 120% 0;
  background-clip: text;
  -webkit-background-clip: text;
  transition:
    opacity 300ms var(--ease-out),
    color 300ms var(--ease-out),
    background-position 520ms var(--ease-out);
  transition-delay: var(--d, 0ms), var(--d, 0ms), calc(var(--d, 0ms) + 120ms);
}

.glow-title.is-lit .glow-char {
  opacity: 1;
  color: var(--ink);
  background-position: -80% 0;
}

@media (prefers-reduced-motion: reduce) {
  .glow-char {
    opacity: 1 !important;
    transition: none !important;
  }
}

[data-motion='off'] .glow-char {
  opacity: 1 !important;
  transition: none !important;
}
</style>
