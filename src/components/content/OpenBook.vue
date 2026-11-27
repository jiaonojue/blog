<script setup lang="ts">
/**
 * 开卷 —— 进入一篇文章时，屏幕正中短暂浮出一个书名页。
 *
 * 【为什么要有这个】
 *   从列表点进文章，现在是一条平滑的转场。但"翻到一篇"这件事本身
 *   值得一点停顿：书的扉页、杂志的跨页、同人志的扉页——
 *   都会先给你一页只有标题的空白，再翻到正文。
 *   这里把这个停顿做成了 0.9 秒的过场，只在文章页出现。
 *
 * 【它为什么不会烦人】
 *   1. 只显示一次：同一篇文章在本次浏览里看过就不再出现（记在 sessionStorage）
 *   2. 可以点掉：任意点击 / 按键立刻结束
 *   3. 可以永久关：设置面板里有开关
 *   4. 减少动效时自动跳过
 *
 * 【它不挡住内容】
 *   遮罩只在最开始的 0.9 秒存在，之后完全移除（v-if），
 *   不是一直挂在上面的空 div，不会影响滚动和点击。
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { motionEnabled } from '@/composables/useSettings'
import { categoryLabel } from '@/composables/useContent'
import { pad2 } from '@/composables/useBook'
import type { CategoryKey } from '@/types/content'

const props = defineProps<{
  /** 文章标题 */
  title: string
  /** 分类 */
  category: CategoryKey
  /** 页码 */
  page: number
  /** 用于判断"这篇是否已经开过卷" */
  path: string
}>()

const STORAGE_KEY = 'site:opened:v1'
/** 一本书的扉页停 0.9 秒，够看清标题，又不至于等 */
const HOLD_MS = 900

const visible = ref(false)

function hasOpened(path: string): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const list: unknown = JSON.parse(raw)
    return Array.isArray(list) && list.includes(path)
  } catch {
    return false
  }
}

function markOpened(path: string): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    const next = Array.isArray(list) ? [...new Set([...list, path])] : [path]
    // 只留最近 60 条，别让 sessionStorage 无限长
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(-60)))
  } catch {
    /* 隐私模式写不进去，忽略 */
  }
}

let timer: ReturnType<typeof setTimeout> | null = null

function close(): void {
  visible.value = false
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

onMounted(() => {
  // 关掉动效、或者这篇已经开过卷，就不放
  if (!motionEnabled.value) return
  if (hasOpened(props.path)) return

  visible.value = true
  markOpened(props.path)
  timer = setTimeout(close, HOLD_MS)

  window.addEventListener('keydown', close, { once: true })
  window.addEventListener('wheel', close, { once: true, passive: true })
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
  window.removeEventListener('keydown', close)
  window.removeEventListener('wheel', close)
})
</script>

<template>
  <Transition name="open-book">
    <div v-if="visible" class="open-book no-print" @click="close">
      <div class="open-book-inner">
        <p class="ob-meta">
          <span class="ob-cat">{{ categoryLabel(category) }}</span>
          <span class="ob-page">P.{{ pad2(page) }}</span>
        </p>
        <h2 class="ob-title">{{ title }}</h2>
        <span class="ob-rule" aria-hidden="true" />
        <p class="ob-hint">点击任意处直接进入</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.open-book {
  position: fixed;
  inset: 0;
  z-index: var(--z-drawer);
  display: grid;
  place-items: center;
  padding: 24px;
  background: color-mix(in srgb, var(--bg) 94%, transparent);
  backdrop-filter: blur(6px);
  cursor: pointer;
}

.open-book-inner {
  max-width: 560px;
  text-align: center;
}

.ob-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.16em;
  color: var(--ink-soft);
  opacity: 0.8;
}

.ob-cat {
  padding: 2px 8px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
}

.ob-title {
  margin-top: 20px;
  font-family: var(--font-display);
  font-size: clamp(1.4rem, 3.6vw, 2.1rem);
  line-height: 1.5;
  color: var(--ink);
}

.ob-rule {
  display: block;
  width: 46px;
  height: 1px;
  margin: 22px auto 0;
  background: var(--accent);
  opacity: 0.6;
}

.ob-hint {
  margin-top: 18px;
  font-size: 11.5px;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
  opacity: 0.6;
}

/* ── 过场 ───────────────────────────────────────────────── */
.open-book-enter-active {
  transition: opacity 220ms var(--ease-out);
}

.open-book-leave-active {
  transition: opacity 320ms var(--ease-out);
}

.open-book-enter-from,
.open-book-leave-to {
  opacity: 0;
}

.open-book-enter-active .open-book-inner {
  transition:
    transform 420ms var(--ease-out),
    opacity 420ms var(--ease-out);
}

.open-book-enter-from .open-book-inner {
  transform: translateY(10px) scale(0.985);
  opacity: 0;
}

[data-motion='off'] .open-book-enter-from .open-book-inner {
  transform: none;
}

@media print {
  .open-book {
    display: none;
  }
}
</style>
