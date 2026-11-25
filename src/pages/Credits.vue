<script setup lang="ts">
/**
 * 素材来源页 —— 列出每一张插画的出处与许可。
 *
 * 数据来自 src/generated/credits.json（由 npm run content:index 从 public/art/CREDITS.md 解析）。
 * 这一页加了 noindex，不进 sitemap。
 */
import credits from '@/generated/credits.json'
import { useSeo } from '@/composables/useSeo'
import { site } from '@/data/site.config'
import TapeLabel from '@/components/ui/TapeLabel.vue'
import WashiDivider from '@/components/ui/WashiDivider.vue'

useSeo({ title: '素材来源', noindex: true })

interface CreditEntry {
  file: string
  title: string
  author: string
  source: string
  license: string
  date: string
  level: string
  note: string
}

const entries = credits as unknown as CreditEntry[]

/** 按级别分组，A 级直采、B 级署名、C 级清单 */
const levelLabel: Record<string, string> = {
  A: '可直接使用',
  B: '需署名',
  C: '清单采集',
}
</script>

<template>
  <div class="container credits-page">
    <header class="page-head">
      <TapeLabel>credits</TapeLabel>
      <h1 class="page-title t-display">素材来源</h1>
      <p class="page-desc">本站使用的每一张插画都在这里登记出处。感谢各位画师。</p>
    </header>

    <div v-if="!entries.length" class="credits-empty">还没有登记任何素材。</div>

    <ul v-else class="credit-list">
      <li v-for="entry in entries" :key="entry.file" class="credit-item">
        <div class="credit-head">
          <code class="credit-file">{{ entry.file }}</code>
          <span v-if="entry.level" class="credit-level">
            {{ entry.level }} · {{ levelLabel[entry.level] ?? entry.level }}
          </span>
        </div>

        <p class="credit-title">{{ entry.title }}</p>

        <dl class="credit-meta">
          <div v-if="entry.author">
            <dt>作者</dt>
            <dd>{{ entry.author }}</dd>
          </div>
          <div v-if="entry.source">
            <dt>出处</dt>
            <dd>
              <a :href="entry.source" target="_blank" rel="noopener noreferrer">
                {{ entry.source }}
              </a>
            </dd>
          </div>
          <div v-if="entry.license">
            <dt>许可</dt>
            <dd>{{ entry.license }}</dd>
          </div>
          <div v-if="entry.date">
            <dt>获取日期</dt>
            <dd>{{ entry.date }}</dd>
          </div>
          <div v-if="entry.note">
            <dt>备注</dt>
            <dd>{{ entry.note }}</dd>
          </div>
        </dl>
      </li>
    </ul>

    <WashiDivider />

    <!-- 权利方下架声明：不放任何个人联系方式 -->
    <section class="takedown">
      <h2 class="takedown-title">关于版权</h2>
      <p>
        本站插画版权归各原画师所有，仅作个人非商业展示，不提供任何形式的转载或商用授权。
        如您是权利方且不希望作品在此展示，请通过
        <a :href="site.issuesUrl" target="_blank" rel="noopener noreferrer">本仓库 Issues</a>
        告知，我会在 24 小时内移除。
      </p>
    </section>
  </div>
</template>

<style scoped>
.credits-page {
  padding-top: 24px;
  max-width: 820px;
}

.page-head {
  margin-bottom: 40px;
}

.page-title {
  margin-top: 12px;
}

.page-desc {
  margin-top: 14px;
  color: var(--ink-soft);
  font-size: 15px;
}

.credits-empty {
  padding: 32px;
  border-radius: var(--r-card);
  border: 1px dashed var(--line);
  text-align: center;
  color: var(--ink-soft);
  font-size: 14px;
}

.credit-list {
  display: grid;
  gap: 14px;
}

.credit-item {
  padding: 16px 18px;
  border-radius: var(--r-input);
  border: 1px solid var(--line);
  background: var(--surface);
}

.credit-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.credit-file {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent);
}

.credit-level {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.06em;
  padding: 1px 8px;
  border-radius: var(--r-pill);
  background: var(--bg-soft);
  color: var(--ink-soft);
}

.credit-title {
  margin-top: 8px;
  font-size: 14.5px;
}

.credit-meta {
  display: grid;
  gap: 4px;
  margin-top: 10px;
  font-size: 12.5px;
}

.credit-meta > div {
  display: grid;
  grid-template-columns: 62px 1fr;
  gap: 10px;
}

.credit-meta dt {
  color: var(--ink-soft);
}

.credit-meta dd {
  margin: 0;
  word-break: break-all;
}

.credit-meta a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ── 下架声明 ───────────────────────────────────────────── */
.takedown {
  padding: 22px 24px;
  border-radius: var(--r-card);
  border: 1px solid var(--line);
  background: var(--bg-soft);
}

.takedown-title {
  margin-bottom: 10px;
  font-family: var(--font-display);
  font-size: 1.05rem;
}

.takedown p {
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--ink-soft);
}

.takedown a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
