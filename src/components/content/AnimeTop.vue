<script setup lang="ts">
/**
 * 十佳 —— 174 条评分里排最前的十部，一屏列完。
 *
 * 【为什么是"十佳"而不是"推荐"】
 *   和抽签同一个道理：这不是推荐，是把分数最高的一截摊开给你看。
 *   分数怎么来的、权重多少，工具页里写着，这里不重复解释。
 *
 * 【为什么只放数字和番名】
 *   没有截图、没有台词。封面已经是能用的最小限度，
 *   这一页连封面都不放 —— 十行数字排下来反而更像榜单。
 */
import { ref, computed, onMounted } from 'vue'
import { ArrowRight } from '@lucide/vue'
import { loadAnimeList, type AnimeEntry } from '@/composables/useAnimeList'

const list = ref<AnimeEntry[]>([])
const loading = ref(true)
const error = ref(false)

onMounted(async () => {
  try {
    list.value = await loadAnimeList()
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})

/** 原始 score 是"权重 × 1000"的总和，换成十分制更像评分 */
function tenths(entry: AnimeEntry): string {
  const v = entry.score / 1800
  return (Math.round(v * 10) / 10).toFixed(1)
}

const top = computed(() =>
  [...list.value]
    .filter((x) => x.name && Number.isFinite(x.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10),
)

/** 第一名那条横条拉满，其余按比例 */
const peak = computed(() => top.value[0]?.score ?? 1)

/**
 * 横条的长度：从 8.5 分到第一名之间插值。
 *
 * 【为什么不直接用 分数/最高分】
 *   前十名都在 9.1～9.6 之间，除以最高分全是 95% 以上，
 *   十条横条一样长，等于没画。这里把基线抬到 8.5，
 *   0.1 分的差就变成 4% 的长度差，肉眼才分得出。
 */
const BASE = 8.5
function barPct(entry: AnimeEntry): string {
  const peakScore = peak.value / 1800
  const v = entry.score / 1800
  const span = Math.max(0.1, peakScore - BASE)
  const ratio = (v - BASE) / span
  return `${Math.min(100, Math.max(6, ratio * 100))}%`
}
</script>

<template>
  <div class="top">
    <header class="top-head">
      <p class="top-kicker">top ten</p>
      <h3 class="top-title">十佳</h3>
      <p class="top-sub">
        {{ loading ? '正在翻评分表……' : `从 ${list.length} 条评分里排在最前的十部` }}
      </p>
    </header>

    <p v-if="error" class="top-state">评分表没加载出来，刷新试试。</p>
    <p v-else-if="loading" class="top-state">正在翻评分表……</p>

    <ol v-else class="top-list">
      <li v-for="(entry, i) in top" :key="entry.name" class="top-row">
        <span class="row-no">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="row-main">
          <span class="row-name">{{ entry.name }}</span>
          <span class="row-bar" aria-hidden="true">
            <span class="row-fill" :style="{ width: barPct(entry) }" />
          </span>
        </span>
        <span class="row-year">{{ entry.year }}</span>
        <span class="row-score">{{ tenths(entry) }}</span>
      </li>
    </ol>

    <RouterLink to="/tools" class="top-link">
      完整评分表
      <ArrowRight :size="13" :stroke-width="2" aria-hidden="true" />
    </RouterLink>
  </div>
</template>

<style scoped>
.top {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  /* 附录里一页很宽，榜单收在中间，读起来才像一张表 */
  max-width: 720px;
  margin-inline: auto;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: var(--r-card);
  background: var(--surface);
}

.top-kicker {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.top-title {
  margin-top: 2px;
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1.3;
}

.top-sub {
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--ink-soft);
}

.top-state {
  font-size: 12px;
  color: var(--ink-soft);
}

/* ── 榜单 ───────────────────────────────────────────────── */
.top-list {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 2px;
  overflow-y: auto;
  /* 十行数字，滚动条细一点免得抢戏 */
  scrollbar-width: thin;
}

.top-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto 40px;
  align-items: center;
  gap: 10px;
  padding: 5px 6px;
  border-radius: 7px;
  transition: background-color var(--t-fast) var(--ease-out);
}

.top-row:hover {
  background: var(--bg-soft);
}

.row-no {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

/* 前三名给强调色，一眼看出头几名 */
.top-row:nth-child(-n + 3) .row-no {
  color: var(--accent);
}

.row-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.row-name {
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-bar {
  display: block;
  height: 2px;
  border-radius: 1px;
  background: color-mix(in srgb, var(--ink-soft) 16%, transparent);
  overflow: hidden;
}

.row-fill {
  display: block;
  height: 100%;
  background: var(--accent);
  opacity: 0.75;
}

.row-year {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

.row-score {
  font-family: var(--font-mono);
  font-size: 12.5px;
  text-align: right;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.top-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  font-size: 12px;
  color: var(--ink-soft);
  transition: color var(--t-fast) var(--ease-out);
}

.top-link:hover {
  color: var(--accent);
}
</style>
