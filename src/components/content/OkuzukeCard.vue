<script setup lang="ts">
/**
 * 奥付 —— 钉在文章页右栏最上方的那块小卡片。
 *
 * 【奥付是什么】
 *   日文书印在最后一页的版权信息页：发行日期、印刷所、定价……
 *   这里借它的形，把一篇文章的"出版信息"摊开：
 *   什么时候发的、在第几页、多少字、几个小节、开本多大、初版还是改订。
 *
 * 【为什么这些数字不用算】
 *   字数和小节在构建期就算好写进了 content.json（见 build-content-index.mjs），
 *   页码来自 useBook 的页码表。卡片只负责把现成的值排出来，
 *   所以预渲染的 HTML 里就是真值，不会先显示 0 再跳成 1832。
 */
import { computed } from 'vue'
import type { Post } from '@/types/content'
import { pageOf, pad2, totalPages } from '@/composables/useBook'

const props = defineProps<{ post: Post }>()

/**
 * 开本对照表 —— 这块里唯一一个"设计选择"而不是事实的字段。
 *
 * 为什么这么配：文库本最小，对应最短的番剧感想；
 * 技术备忘步骤多、要摊开对照着敲，给 A5；
 * 随笔留白多，四六开（日本最常用的小说开本）；
 * 碎片只有几行，新书判（日本最小的常见开本）。
 * 想改就改这张表，别的都不用动。
 */
const FORMATS: Record<string, string> = {
  anime: '文库本',
  tech: 'A5',
  essay: '四六开',
  fragment: '新书',
}

/** 千分位。不用 toLocaleString：构建机和浏览器的 locale 可能不一样 */
function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const rows = computed(() => {
  const p = props.post
  return [
    { label: '发行', value: p.date.replace(/-/g, '.') },
    { label: '页码', value: `P.${pad2(pageOf(p.path))} / ${pad2(totalPages.value)}` },
    { label: '字数', value: p.chars ? group(p.chars) : '—' },
    { label: '小节', value: p.sections ? String(p.sections) : '—' },
    { label: '开本', value: FORMATS[p.category] ?? '文库本' },
    { label: '版次', value: p.updated ? '改订' : '初版' },
  ]
})

/**
 * 悬停时在底部展开的那一句。
 *
 * 按数据挑，不是随便配的文案：
 *   改订过 → 提一句"看差分就够了"，省得老读者重读一遍
 *   篇幅长 → 提醒一声要花点时间
 *   碎片   → 说明它本来就短，不是没写完
 *   其余   → 一句轻的收尾
 */
const footnote = computed(() => {
  const p = props.post
  if (p.updated) return '改订版。读过前一版的，看差分就够了。'
  if (p.minutes >= 5) return '篇幅不短，泡杯茶再进来。'
  if (p.category === 'fragment') return '随手记的，留白比字多。'
  return '一口气能读完的长度。'
})
</script>

<template>
  <section class="okuzuke no-print" tabindex="0" aria-label="本文的出版信息">
    <p class="okz-label">colophon</p>
    <h2 class="okz-title">奥付</h2>
    <span class="okz-rule" aria-hidden="true" />

    <dl class="okz-rows">
      <div v-for="row in rows" :key="row.label" class="okz-row">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>

    <!-- 展开的那一句。默认高度 0，悬停 / 聚焦时推开 -->
    <div class="okz-note-wrap">
      <p class="okz-note">{{ footnote }}</p>
    </div>
  </section>
</template>

<style scoped>
.okuzuke {
  /* 右栏是 flex 列，卡片不能被目录挤扁，永远保持自己的高度 */
  flex: 0 0 auto;
  padding: 16px 16px 4px;
  border: 1px solid var(--line);
  border-radius: var(--r-input);
  background: var(--surface);
  /* 顶部那条 2px 的强调线：用 inset 阴影画，不额外占一个元素 */
  box-shadow: inset 0 2px 0 var(--accent);
  transition: border-color var(--t-fast) var(--ease-out);
}

.okuzuke:hover,
.okuzuke:focus-visible {
  border-color: var(--accent);
}

.okuzuke:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.okz-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.okz-title {
  margin-top: 2px;
  font-family: var(--font-display);
  font-size: 17px;
  line-height: 1.3;
  letter-spacing: 0.06em;
}

.okz-rule {
  display: block;
  width: 26px;
  height: 1px;
  margin: 9px 0 10px;
  background: var(--line);
}

.okz-rows {
  display: grid;
  gap: 5px;
}

.okz-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.okz-row dt {
  flex: 0 0 auto;
  font-size: 11.5px;
  color: var(--ink-soft);
  letter-spacing: 0.04em;
}

.okz-row dd {
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
  text-align: right;
  /* 页码这类值不该被折行 */
  white-space: nowrap;
}

/* ── 底部那句小字 ─────────────────────────────────────── */
/*
 * grid-template-rows 从 0fr 到 1fr 可以真正"从零高度推开"，
 * 比 max-height 猜一个像素值可靠——猜小了字被切，猜大了动画会顿一下。
 */
.okz-note-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--t-base) var(--ease-out);
}

.okz-note-wrap > .okz-note {
  overflow: hidden;
  min-height: 0;
  opacity: 0;
  transition: opacity var(--t-base) var(--ease-out);
}

.okuzuke:hover .okz-note-wrap,
.okuzuke:focus-visible .okz-note-wrap {
  grid-template-rows: 1fr;
}

.okuzuke:hover .okz-note,
.okuzuke:focus-visible .okz-note {
  opacity: 1;
}

.okz-note {
  margin: 0;
  padding: 10px 0 12px;
  border-top: 1px solid var(--line);
  font-family: var(--font-quote);
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--ink-soft);
}

/* 动效关掉时直接展开，不留半截 */
@media (prefers-reduced-motion: reduce) {
  .okz-note-wrap,
  .okz-note {
    transition: none;
  }

  .okz-note-wrap {
    grid-template-rows: 1fr;
  }

  .okz-note {
    opacity: 1;
  }
}

[data-motion='off'] .okz-note-wrap,
[data-motion='off'] .okz-note {
  transition: none;
}

[data-motion='off'] .okz-note-wrap {
  grid-template-rows: 1fr;
}

[data-motion='off'] .okz-note {
  opacity: 1;
}
</style>
