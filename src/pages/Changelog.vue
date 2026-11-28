<script setup lang="ts">
/**
 * 更新日志 —— 书末的奥付，也是一册"改了些什么"的目次。
 *
 * 【为什么是目次而不是一长条文档】
 *   日志跟站点其余部分一样，用同一套同人志语言：每个版本是一"話"，
 *   印着話号、版本胶带和日期；修复 / 新增这些分类做成和纸小标签；
 *   条目之间用引导点连到話号，跟文章列表的目次视图是同一副骨架。
 *   这样它读起来像翻一本自己印的小册子的版权页，而不是后台维护记录。
 *
 * 【内容从哪来】
 *   构建脚本把 CHANGELOG.md 按版本拆好写进 content.json，
 *   和 now / about 同一条管线。改完 md 跑一次构建就更新。
 */
import { changelog } from '@/composables/useContent'
import { useSeo } from '@/composables/useSeo'
import TapeLabel from '@/components/ui/TapeLabel.vue'
import WashiDivider from '@/components/ui/WashiDivider.vue'
import GlowTitle from '@/components/motion/GlowTitle.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

useSeo({
  title: '更新日志',
  description: '这个站点每一次改动的记录，像书末的奥付。',
})

/** 分类名配一种胶带色，跟站点里既有的 tone 呼应 */
function toneOf(label: string): 'accent' | 'neutral' | 'warn' {
  if (/修复|fix/i.test(label)) return 'warn'
  if (/新增|feat/i.test(label)) return 'accent'
  return 'neutral'
}
</script>

<template>
  <div class="container changelog-page">
    <header class="page-head">
      <TapeLabel>奥付 · changelog</TapeLabel>
      <h1 class="cl-title t-display"><GlowTitle text="更新日志" /></h1>
      <p class="cl-sub">每一次改动都在这里留个记号，像书末那页密密的出版记录。</p>
      <p v-if="changelog.updated" class="cl-updated">
        最终刷印 {{ changelog.updated.replace(/-/g, '.') }}
      </p>
    </header>

    <!-- 顶部那两行格式说明，跟正文分开排 -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="changelog.html" class="cl-intro prose" v-html="changelog.html" />

    <EmptyState
      v-if="!changelog.entries.length"
      title="这一册还空着"
      desc="在仓库根目录的 CHANGELOG.md 里写几行就出现了。"
    />

    <ol v-else class="cl-issues">
      <li v-for="entry in changelog.entries" :key="entry.version" class="cl-issue">
        <!-- 話号 + 引导点，跟文章目次是同一副骨架 -->
        <div class="cl-issue-head">
          <span class="cl-chapter">第 {{ String(entry.chapter).padStart(2, '0') }} 話</span>
          <span class="cl-dots" aria-hidden="true" />
          <TapeLabel class="cl-version" tone="accent">{{ entry.version }}</TapeLabel>
        </div>

        <div class="cl-issue-body">
          <p class="cl-date">{{ entry.date.replace(/-/g, '.') }}</p>

          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-if="entry.lead" class="cl-lead prose" v-html="entry.lead" />

          <section v-for="group in entry.groups" :key="group.label" class="cl-group">
            <h2 class="cl-group-title">
              <TapeLabel :tone="toneOf(group.label)" :tilt="1">{{ group.label }}</TapeLabel>
            </h2>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="cl-group-body prose" v-html="group.html" />
          </section>
        </div>
      </li>
    </ol>

    <WashiDivider label="end of volume" />

    <footer class="cl-foot">
      <RouterLink to="/about">关于这一页 ↗</RouterLink>
    </footer>
  </div>
</template>

<style scoped>
.changelog-page {
  padding-top: 24px;
  max-width: 860px;
}

.page-head {
  margin-bottom: 28px;
}

.cl-title {
  margin-top: 14px;
}

.cl-sub {
  margin-top: 12px;
  font-family: var(--font-quote);
  font-size: 14px;
  color: var(--ink-soft);
}

.cl-updated {
  margin-top: 10px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
  opacity: 0.8;
}

/* 顶部的格式说明：小字、压窄，别抢目次的风头 */
.cl-intro {
  max-width: none;
  font-family: var(--font-quote);
  font-size: 13px;
  color: var(--ink-soft);
  margin-bottom: 8px;
}

.cl-intro > :first-child {
  margin-top: 0;
}

/* ── 目次：一話一条 ────────────────────────────────────── */
.cl-issues {
  list-style: none;
  padding: 0;
  margin: 0;
}

.cl-issue {
  position: relative;
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 20px;
  padding: 26px 0;
  border-bottom: 1px dashed var(--line);
}

@media (max-width: 640px) {
  .cl-issue {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

.cl-issue-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
}

.cl-chapter {
  font-family: var(--font-display);
  font-size: 15px;
  color: var(--ink);
  white-space: nowrap;
}

.cl-dots {
  flex: 1;
  min-width: 8px;
  height: 1px;
  border-bottom: 1px dotted var(--line);
}

.cl-version {
  flex: 0 0 auto;
}

.cl-issue-body {
  min-width: 0;
}

.cl-date {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--ink-soft);
  margin-bottom: 12px;
}

.cl-lead {
  max-width: none;
  font-family: var(--font-quote);
  font-size: 14px;
  color: var(--ink-soft);
}

.cl-lead > :first-child {
  margin-top: 0;
}

.cl-group {
  margin-top: 20px;
}

.cl-group-title {
  margin: 0 0 10px;
  font-size: 14px;
}

/* 分类下面的条目：收窄行距，条目之间用虚线轻分隔 */
.cl-group-body {
  max-width: none;
  font-size: 14px;
  line-height: 1.8;
  padding-left: 4px;
}

.cl-group-body > :first-child {
  margin-top: 0;
}

.cl-group-body ul {
  padding-left: 1.2em;
}

.cl-group-body li {
  padding-left: 0.2em;
}

.cl-group-body li::marker {
  color: var(--accent);
}

.cl-group-body code {
  font-family: var(--font-mono);
  font-size: 0.88em;
}

.cl-foot {
  font-size: 13px;
}

.cl-foot a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
