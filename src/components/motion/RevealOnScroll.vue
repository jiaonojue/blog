<script setup lang="ts">
/**
 * 滚动入场 —— 元素进入视口时淡入上移，只触发一次。
 *
 * 用法：把内容包在 <RevealOnScroll> 里，或加延迟 <RevealOnScroll :delay="120">
 * 减少动效时直接显示，不做位移。
 *
 * 【为什么"默认可见、按需隐藏"，而不是"默认隐藏、JS 显示"】
 *   这是这个组件最容易写错的地方。如果 CSS 默认 opacity: 0，那么
 *   内容的可见性就完全依赖 JS 和动画跑完：
 *     - JS 报错 → 永远看不见
 *     - IntersectionObserver 不回调（后台标签页被节流、部分内嵌 WebView
 *       没真正合成、省电模式暂停渲染）→ 永远看不见
 *     - 过渡动画的渲染循环被暂停 → 计算值一直停在 opacity: 0
 *   内容消失是不可接受的，少一次动画完全没关系。
 *
 *   所以：CSS 默认 opacity: 1（预渲染出来的静态 HTML 也是可见的），
 *   JS 只有在"确认元素在视口外、并且成功挂上观察器"时，才加上 is-armed 把它藏起来。
 *   一旦观察器失效，兜底计时器直接摘掉 is-armed —— 不经过任何过渡，立刻可见。
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { motionEnabled } from '@/composables/useSettings'

const props = withDefaults(defineProps<{ delay?: number; as?: string }>(), {
  delay: 0,
  as: 'div',
})

const el = ref<HTMLElement | null>(null)
/** 是否被临时藏起来（只有确认能观察时才为 true） */
const armed = ref(false)
/** 是否已经在播放入场 */
const shown = ref(false)

let observer: IntersectionObserver | null = null
let timer: number | null = null

function cleanup(): void {
  observer?.disconnect()
  observer = null
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
}

/** 正常入场：摘掉隐藏、进入过渡 */
function play(delay: number): void {
  cleanup()
  timer = window.setTimeout(() => {
    armed.value = false
    shown.value = true
    timer = null
  }, delay)
}

/** 兜底：跳过动画，立刻可见（不经过过渡，不受渲染暂停影响） */
function showInstantly(): void {
  cleanup()
  armed.value = false
  shown.value = false
}

onMounted(() => {
  // 用户关了动效：什么都不做，默认就是可见的
  if (!motionEnabled.value) return

  const node = el.value
  if (!node) return

  // 首屏元素不藏，直接显示
  const rect = node.getBoundingClientRect()
  if (rect.top < window.innerHeight && rect.bottom > 0) return

  // 浏览器没有 IntersectionObserver：不做动画，保持可见
  if (typeof IntersectionObserver === 'undefined') return

  // 视口外：这时才值得藏起来等滚动
  armed.value = true

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) play(props.delay)
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
  )
  observer.observe(node)

  // 兜底：观察器迟迟不回调，就直接显示内容
  timer = window.setTimeout(showInstantly, 2500)
})

onUnmounted(cleanup)
</script>

<template>
  <component :is="as" ref="el" class="reveal" :class="{ 'is-armed': armed, 'is-shown': shown }">
    <slot />
  </component>
</template>

<style scoped>
/*
 * 默认完全可见。预渲染出来的 HTML、禁用 JS、JS 出错，内容都在。
 * 过渡只挂在 is-shown 上，所以"摘掉 is-armed"这个动作是瞬时的。
 */
.reveal {
  opacity: 1;
}

/* 只有 JS 确认"在视口外 + 观察器已就绪"时才临时隐藏 */
.reveal.is-armed {
  opacity: 0;
  transform: translateY(12px);
}

/* 入场过渡：只在 armed → shown 这条路径上存在 */
.reveal.is-shown {
  transition:
    opacity var(--t-slow) var(--ease-out),
    transform var(--t-slow) var(--ease-out);
}

/* 减少动效时不做位移 */
@media (prefers-reduced-motion: reduce) {
  .reveal.is-armed {
    transform: none;
  }
}

[data-motion='off'] .reveal.is-armed {
  transform: none;
}
</style>
