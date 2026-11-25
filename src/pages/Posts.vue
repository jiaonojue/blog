<script setup lang="ts">
import { ref, computed } from 'vue'
import { posts, categoryLabel, withBase } from '@/composables/useContent'
import { categories } from '@/data/site.config'
import { useSeo } from '@/composables/useSeo'
import { issueOf, pageOf, pad2, isRead } from '@/composables/useBook'
import PostCard from '@/components/content/PostCard.vue'
import ReadStamp from '@/components/content/ReadStamp.vue'
import RevealOnScroll from '@/components/motion/RevealOnScroll.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TapeLabel from '@/components/ui/TapeLabel.vue'

useSeo({ title: '文章', description: '番剧感想、技术备忘与生活随笔的全部文章。' })

/** 当前筛选的分类：'all' 表示全部 */
const active = ref<string>('all')

/**
 * 视图：卡片（默认）或目次。
 *
 * 【为什么两种都留着】
 *   卡片适合随便逛逛，看封面和摘要；目次适合"我要找某一篇"，
 *   一屏能扫到十几条标题，像翻同人志前面的目次页。
 *   这也是同一站点的两种读法，不重复。
 */
const view = ref<'cards' | 'contents'>('cards')

/** 带数量的分类标签 */
const tabs = computed(() => [
  { key: 'all', label: '全部', count: posts.length },
  ...categories.map((c) => ({
    key: c.key,
    label: c.label,
    count: posts.filter((p) => p.category === c.key).length,
  })),
])

const filtered = computed(() =>
  active.value === 'all' ? posts : posts.filter((p) => p.category === active.value),
)

/** 按年份分组，给列表加一点归档感 */
const grouped = computed(() => {
  const map = new Map<string, typeof posts>()
  for (const post of filtered.value) {
    const list = map.get(post.year) ?? []
    list.push(post)
    map.set(post.year, list)
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
})

void categoryLabel
void withBase
</script>

<template>
  <div class="container posts-page">
    <header class="page-head">
      <TapeLabel>archive</TapeLabel>
      <h1 class="page-title t-display">文章</h1>
      <p class="page-desc">番剧感想、技术备忘、生活随笔。写得慢，但每一篇都认真。</p>
    </header>

    <!-- 分类筛选 -->
    <nav class="filter-bar" aria-label="文章分类">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="filter-btn"
        :class="{ active: active === tab.key }"
        :aria-pressed="active === tab.key"
        @click="active = tab.key"
      >
        {{ tab.label }}
        <span class="filter-count">{{ tab.count }}</span>
      </button>

      <!-- 视图切换：卡片 / 目次 -->
      <div class="view-switch" role="group" aria-label="切换视图">
        <button
          type="button"
          class="view-btn"
          :class="{ active: view === 'cards' }"
          :aria-pressed="view === 'cards'"
          title="卡片视图"
          @click="view = 'cards'"
        >
          <span class="sr-only">卡片视图</span>
          <span class="view-glyph" aria-hidden="true">▦</span>
        </button>
        <button
          type="button"
          class="view-btn"
          :class="{ active: view === 'contents' }"
          :aria-pressed="view === 'contents'"
          title="目次视图"
          @click="view = 'contents'"
        >
          <span class="sr-only">目次视图</span>
          <span class="view-glyph" aria-hidden="true">☰</span>
        </button>
      </div>
    </nav>

    <!-- 空状态 -->
    <EmptyState
      v-if="!filtered.length"
      title="这个分类还没有文章"
      desc="换个分类看看，或者等我慢慢写。"
    />

    <!-- ══ 卡片视图 ═══════════════════════════════════════ -->
    <template v-if="view === 'cards'">
      <section v-for="[year, list] in grouped" :key="year" class="year-group">
        <h2 class="year-title">
          <span class="year-num">{{ year }}</span>
          <span class="year-count">{{ list.length }} 篇</span>
        </h2>

        <div class="post-list">
          <RevealOnScroll v-for="(post, i) in list" :key="post.path" :delay="Math.min(i * 60, 240)">
            <PostCard :post="post" />
          </RevealOnScroll>
        </div>
      </section>
    </template>

    <!-- ══ 目次视图 ═══════════════════════════════════════ -->
    <template v-else>
      <section v-for="[year, list] in grouped" :key="year" class="contents-group">
        <h2 class="contents-year">
          <span class="contents-year-num">{{ year }}</span>
          <span class="contents-year-count">{{ list.length }} 篇</span>
        </h2>

        <ol class="contents-list">
          <li v-for="post in list" :key="post.path" class="contents-row-wrap">
            <RouterLink :to="post.path" class="contents-row">
              <span class="row-issue">第 {{ pad2(issueOf(post.path)) }} 話</span>

              <span class="row-title">
                {{ post.title }}
                <span v-if="post.sample" class="row-sample">SAMPLE</span>
              </span>

              <!-- 点线：目次的灵魂。用虚线框自己画，不依赖字符重复 -->
              <span class="row-leader" aria-hidden="true" />

              <span class="row-cat">{{ categoryLabel(post.category) }}</span>
              <span class="row-page">P.{{ pad2(pageOf(post.path)) }}</span>

              <ReadStamp v-if="isRead(post.path)" small class="row-stamp" />
            </RouterLink>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>

<style scoped>
.posts-page {
  padding-top: 24px;
}

/* ── 页头 ───────────────────────────────────────────────── */
.page-head {
  max-width: 640px;
  margin-bottom: 44px;
}

.page-title {
  margin-top: 12px;
}

.page-desc {
  margin-top: 14px;
  color: var(--ink-soft);
  font-size: 15px;
}

/* ── 分类筛选 ───────────────────────────────────────────── */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 44px;
  padding-bottom: 22px;
  border-bottom: 1px dashed var(--line);
}

.filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 0 16px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  font-size: 13.5px;
  color: var(--ink-soft);
  transition:
    border-color var(--t-fast) var(--ease-out),
    background-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.filter-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.filter-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}

.filter-count {
  font-family: var(--font-mono);
  font-size: 11px;
  opacity: 0.7;
}

/* ── 视图切换 ───────────────────────────────────────────── */
.view-switch {
  display: flex;
  gap: 2px;
  margin-left: auto;
  padding: 3px;
  border-radius: var(--r-pill);
  background: var(--bg-soft);
}

.view-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 32px;
  border-radius: var(--r-pill);
  color: var(--ink-soft);
  transition:
    background-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.view-btn:hover {
  color: var(--accent);
}

.view-btn.active {
  background: var(--accent);
  color: var(--accent-ink);
}

.view-glyph {
  font-size: 14px;
  line-height: 1;
}

/* ── 年份分组 ───────────────────────────────────────────── */
.year-group + .year-group {
  margin-top: 64px;
}

.year-title {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 22px;
}

.year-num {
  font-family: var(--font-display);
  font-size: 1.5rem;
  color: var(--ink);
}

.year-count {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--ink-soft);
}

.post-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
}

@media (max-width: 1023px) {
  .post-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 639px) {
  .post-list {
    grid-template-columns: 1fr;
  }
}

/* ══ 目次视图 ═══════════════════════════════════════════ */
.contents-group + .contents-group {
  margin-top: 46px;
}

.contents-year {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--ink);
}

.contents-year-num {
  font-family: var(--font-display);
  font-size: 1.15rem;
  letter-spacing: 0.06em;
}

.contents-year-count {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  color: var(--ink-soft);
}

.contents-list {
  /* 目次不要列表符号，数字在每一行自己带着 */
  list-style: none;
  margin: 0;
  padding: 0;
}

.contents-row-wrap + .contents-row-wrap {
  border-top: 1px dashed var(--line);
}

/*
 * 一行目次：話数 / 标题 / 点线 / 分类 / 页码
 * 点线用 flex:1 的虚线框把两边推开，
 * 这样无论标题多长，页码都稳稳贴在右边缘——这才是目次的样子。
 */
.contents-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 13px 6px 13px 2px;
  transition:
    background-color var(--t-fast) var(--ease-out),
    padding-left var(--t-fast) var(--ease-out);
}

.contents-row:hover {
  background: var(--accent-soft);
  padding-left: 10px;
}

.row-issue {
  flex: 0 0 auto;
  min-width: 62px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
}

.contents-row:hover .row-issue {
  color: var(--accent);
}

.row-title {
  flex: 0 1 auto;
  min-width: 0;
  font-size: 14.5px;
  line-height: 1.5;
  /* 标题太长时省略，而不是把页码顶出屏幕 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-sample {
  margin-left: 6px;
  padding: 0 4px;
  border: 1px solid var(--line);
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
  vertical-align: 1.5px;
}

/* 引导点线：一条贴着基线的虚线，自动吃掉所有剩余空间 */
.row-leader {
  flex: 1 1 auto;
  min-width: 18px;
  height: 0;
  align-self: center;
  border-bottom: 1px dotted var(--ink-soft);
  opacity: 0.45;
  /* 往下压一点，让它贴住文字基线而不是行框正中 */
  transform: translateY(3px);
}

.row-cat {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
}

.row-page {
  flex: 0 0 auto;
  min-width: 42px;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}

.row-stamp {
  /* 章比文字大，对齐到文字顶部才不像掉下去 */
  align-self: center;
  margin-left: 2px;
}

/* 窄屏：目次只留 話数 / 标题 / 页码，分类和点线让位给标题 */
@media (max-width: 639px) {
  .contents-row {
    gap: 8px;
    padding-block: 12px;
  }

  .row-issue {
    min-width: 0;
    font-size: 10px;
  }

  .row-title {
    font-size: 13.5px;
    /* 允许两行，不然半句标题就被切了 */
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .row-leader,
  .row-cat {
    display: none;
  }

  .row-page {
    margin-left: auto;
    min-width: 36px;
    font-size: 11px;
  }

  /*
   * 窄屏把章缩到 26px：一行本来就只有 324px，
   * 32px 的章会让标题只剩半行。缩小后仍然认得出是印章。
   * 选择器写全 .contents-row .row-stamp，才压得住子组件里的 .read-stamp。
   */
  .contents-row .row-stamp {
    margin-left: 0;
    width: 26px;
    height: 26px;
  }

  :deep(.row-stamp .stamp-text) {
    font-size: 7px;
  }
}
</style>
