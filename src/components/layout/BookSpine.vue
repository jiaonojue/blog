<script setup lang="ts">
/**
 * 书脊 —— 贴在窗口左边缘的一条竖排信息栏。
 *
 * 【为什么是书脊】
 *   整个站点的隐喻是「一本同人志」：文章有第几話、有页码、读完了盖章。
 *   但这些东西都散在页面里，没有一处"你正翻到哪儿"的持续提示。
 *   实体书的书脊就干这个：合着的时候也能看见书名、期号和厚薄。
 *
 * 【上面有什么】
 *   站名 · 第 01 号 · 当前页码 —— 像印在书脊上的那三行小字。
 *   底下有一个骰子按钮：随便翻一页。这是纸质杂志最快乐的用法，
 *   也是给"不知道读什么"的时候准备的一个出口。
 *
 * 【为什么只在宽屏出现】
 *   窄屏上任何固定侧栏都会压住正文。这里用 min-width: 1280px 卡住，
 *   并且不参与布局（position: fixed），所以正文宽度一点不受影响。
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { posts } from '@/composables/useContent'
import { pageOf, pad2, totalPages } from '@/composables/useBook'
import { site } from '@/data/site.config'
import { Dices } from '@lucide/vue'

const route = useRoute()
const router = useRouter()

/** 当前页码：文章页显示该篇的页码，其它页显示前置页 P.01 */
const currentPage = computed(() => {
  if (
    route.name === 'post' &&
    typeof route.params.year === 'string' &&
    typeof route.params.slug === 'string'
  ) {
    const p = posts.find((x) => x.year === route.params.year && x.slug === route.params.slug)
    if (p) return pageOf(p.path)
  }
  return 1
})

const total = computed(() => totalPages.value)

/** 读到全书第几成，用来画书脊上那道进度 */
const ratio = computed(() => (total.value ? currentPage.value / total.value : 0))

/** 随便翻一页：随机挑一篇，避开当前这篇 */
function randomPage() {
  if (!posts.length) return
  const pool = posts.length > 1 ? posts.filter((p) => p.path !== route.path) : posts
  const pick = pool[Math.floor(Math.random() * pool.length)]
  if (pick) void router.push(pick.path)
}
</script>

<template>
  <aside class="book-spine no-print" aria-label="书脊信息">
    <div class="spine-progress" aria-hidden="true">
      <span class="spine-progress-fill" :style="{ transform: `scaleY(${ratio})` }" />
    </div>

    <p class="spine-line">
      <span class="spine-title">{{ site.title }}</span>
      <span class="spine-sep" aria-hidden="true">·</span>
      <span class="spine-issue">第 01 号</span>
    </p>

    <p class="spine-line spine-page">
      <span class="spine-p">P.</span>
      {{ pad2(currentPage) }}
      <span class="spine-total">/ {{ pad2(total) }}</span>
    </p>

    <button class="spine-dice" type="button" title="随便翻一页" @click="randomPage">
      <span class="sr-only">随便翻一页</span>
      <Dices :size="14" :stroke-width="1.75" aria-hidden="true" />
    </button>
  </aside>
</template>

<style scoped>
.book-spine {
  position: fixed;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  z-index: var(--z-content);
  display: none;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 22px 8px;
  /* 竖排：像真的印在书脊上 */
  writing-mode: vertical-rl;
  text-orientation: mixed;
  user-select: none;
}

@media (min-width: 1280px) {
  .book-spine {
    display: flex;
  }
}

/* ── 进度：一条细线，从下往上填 ────────────────────────── */
.spine-progress {
  position: relative;
  width: 1px;
  height: 84px;
  background: var(--line);
  overflow: hidden;
}

.spine-progress-fill {
  position: absolute;
  inset: 0;
  background: var(--accent);
  transform-origin: bottom;
  transition: transform var(--t-slow) var(--ease-out);
  opacity: 0.75;
}

/* ── 文字 ───────────────────────────────────────────────── */
.spine-line {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  color: var(--ink-soft);
  opacity: 0.72;
}

.spine-title {
  font-family: var(--font-display);
  font-size: 12px;
  letter-spacing: 0.3em;
  color: var(--ink);
}

.spine-sep {
  opacity: 0.5;
}

.spine-issue {
  letter-spacing: 0.16em;
}

.spine-page {
  display: flex;
  align-items: baseline;
  gap: 1px;
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--ink);
}

.spine-p {
  font-size: 8px;
  opacity: 0.55;
}

.spine-total {
  font-size: 8.5px;
  opacity: 0.45;
}

/* ── 骰子 ───────────────────────────────────────────────── */
.spine-dice {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid var(--line);
  color: var(--ink-soft);
  /* 竖排容器里图标要转回来，不然它自己也是躺着的 */
  writing-mode: horizontal-tb;
  transition:
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out),
    transform var(--t-base) var(--ease-out);
}

.spine-dice:hover {
  border-color: var(--accent);
  color: var(--accent);
  transform: rotate(-14deg);
}

.spine-dice:active {
  transform: rotate(-14deg) scale(0.92);
}

/* 打印时不需要书脊 */
@media print {
  .book-spine {
    display: none;
  }
}
</style>
