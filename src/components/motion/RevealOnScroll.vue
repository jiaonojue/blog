<script setup lang="ts">
/**
 * 滚动入场 —— 元素进入视口时淡入上移，只触发一次。
 *
 * 用法：把内容包在 <RevealOnScroll> 里，或加延迟 <RevealOnScroll :delay="120">
 * 减少动效时直接显示，不做位移。
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { motionEnabled } from '@/composables/useSettings'

const props = withDefaults(defineProps<{ delay?: number; as?: string }>(), {
  delay: 0,
  as: 'div',
})

const el = ref<HTMLElement | null>(null)
const shown = ref(false)
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (!motionEnabled.value) {
    shown.value = true
    return
  }

  // 已经在视口内（首屏）就直接显示，不要等滚动
  if (!el.value) return

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          window.setTimeout(() => {
            shown.value = true
          }, props.delay)
          observer?.disconnect()
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
  )

  observer.observe(el.value)
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <component :is="as" ref="el" class="reveal" :class="{ 'is-shown': shown }">
    <slot />
  </component>
</template>

<style scoped>
.reveal {
  opacity: 0;
  transform: translateY(12px);
  transition:
    opacity var(--t-slow) var(--ease-out),
    transform var(--t-slow) var(--ease-out);
}

.reveal.is-shown {
  opacity: 1;
  transform: none;
}

/* 减少动效 / 无 JS 时保证内容可见 */
[data-motion='off'] .reveal {
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1;
    transform: none;
  }
}
</style>
