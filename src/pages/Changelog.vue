<script setup lang="ts">
/**
 * 更新日志 —— 每次改动都记一笔的附页。
 *
 * 【为什么单独成页】
 *   原来设置抽屉里塞了一段写死的占位文案，说"构建时注入最近几条"，
 *   其实根本没注入。日志是这块站点自己的编年史，值得有独立的一页：
 *   能翻、能搜、能分享链接，也跟"同人志"的设定对得上——这是它的奥付。
 *
 * 【内容从哪来】
 *   仓库根目录的 CHANGELOG.md，由构建脚本渲染好写进 content.json，
 *   和 now / about 同一条管线。改完 md 跑一次构建就更新。
 */
import { changelog } from '@/composables/useContent'
import { useSeo } from '@/composables/useSeo'
import TapeLabel from '@/components/ui/TapeLabel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

useSeo({
  title: '更新日志',
  description: '这个站点每一次改动的记录。',
})
</script>

<template>
  <div class="container changelog-page">
    <header class="page-head">
      <TapeLabel>changelog</TapeLabel>
      <h1 class="cl-title t-display">更新日志</h1>
      <p class="cl-sub">每一次改动都在这里留个记号，像书末的奥付。</p>
      <p v-if="changelog.updated" class="cl-updated">
        最后更新于 {{ changelog.updated.replace(/-/g, '.') }}
      </p>
    </header>

    <EmptyState
      v-if="!changelog.html"
      title="还没有记录"
      desc="在仓库根目录的 CHANGELOG.md 写几行就出现了。"
    />

    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-else class="prose cl-prose" v-html="changelog.html" />

    <footer class="cl-foot">
      <RouterLink to="/about">关于这一页 ↗</RouterLink>
    </footer>
  </div>
</template>

<style scoped>
.changelog-page {
  padding-top: 24px;
  max-width: 820px;
}

.page-head {
  margin-bottom: 36px;
}

.cl-title {
  margin-top: 12px;
}

.cl-sub {
  margin-top: 10px;
  font-family: var(--font-quote);
  font-size: 13.5px;
  color: var(--ink-soft);
}

.cl-updated {
  margin-top: 8px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.05em;
  color: var(--ink-soft);
  opacity: 0.8;
}

.cl-prose {
  max-width: none;
}

.cl-foot {
  margin-top: 46px;
  padding-top: 20px;
  border-top: 1px dashed var(--line);
  font-size: 13px;
}

.cl-foot a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* CHANGELOG 是长文，标题间距按同人志的"章"节奏放松一点 */
.cl-prose :deep(h2) {
  margin-top: 2.2em;
}

.cl-prose :deep(h3) {
  margin-top: 1.6em;
}
</style>
