<script setup lang="ts">
import { ref, computed } from 'vue'
import { favorites, withBase } from '@/composables/useContent'
import { useSeo } from '@/composables/useSeo'
import type { Favorite } from '@/types/content'
import StickerCard from '@/components/ui/StickerCard.vue'
import TapeLabel from '@/components/ui/TapeLabel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import RevealOnScroll from '@/components/motion/RevealOnScroll.vue'
import { ExternalLink, Music, BookOpen } from '@lucide/vue'

useSeo({ title: '收藏', description: '看过的番、听过的歌、玩过的游戏、读过的书。' })

const groups = [
  { key: 'anime', label: '番剧' },
  { key: 'game', label: '游戏' },
  { key: 'music', label: '音乐' },
  { key: 'book', label: '书' },
] as const

const active = ref<string>('all')

const tabs = computed(() => [
  { key: 'all', label: '全部', count: favorites.length },
  ...groups.map((g) => ({
    key: g.key,
    label: g.label,
    count: favorites.filter((f) => f.type === g.key).length,
  })),
])

const filtered = computed(() =>
  active.value === 'all' ? favorites : favorites.filter((f) => f.type === active.value),
)

/** 卡片类（番剧 / 游戏）用卡片展示，条目类（音乐 / 书）用列表行 */
function isCardType(f: Favorite): boolean {
  return f.type === 'anime' || f.type === 'game'
}

const cardItems = computed(() => filtered.value.filter(isCardType))
const rowItems = computed(() => filtered.value.filter((f) => !isCardType(f)))
</script>

<template>
  <div class="container favorites-page">
    <header class="page-head">
      <TapeLabel>collection</TapeLabel>
      <h1 class="page-title t-display">收藏</h1>
      <p class="page-desc">
        我喜欢的番、玩过的游戏、循环过的音乐、读过的书。评分很主观，仅供参考。
      </p>
    </header>

    <nav class="filter-bar" aria-label="收藏分类">
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
    </nav>

    <EmptyState v-if="!filtered.length" title="这个分类还没有内容" desc="慢慢补。" />

    <!-- ══ 卡片区：番剧 / 游戏 ═════════════════════════════ -->
    <div v-if="cardItems.length" class="fav-grid">
      <RevealOnScroll v-for="(fav, i) in cardItems" :key="fav.slug" :delay="Math.min(i * 60, 240)">
        <StickerCard :tilt="i % 3 === 0 ? 0.7 : i % 3 === 1 ? -0.6 : 0.4">
          <div class="fav-cover">
            <img
              v-if="fav.cover"
              :src="withBase(fav.cover)"
              :alt="`${fav.title} 的封面`"
              loading="lazy"
              decoding="async"
            />
            <!-- 没有封面的条目（音乐、书）用版式封面：首字大字 + 类型标签 -->
            <div v-else class="fav-glyph-cover" aria-hidden="true">
              <span class="glyph-char">{{ fav.title.slice(0, 1) }}</span>
              <span class="glyph-kind">{{ fav.type === 'music' ? '音乐' : '书' }}</span>
            </div>
            <TapeLabel v-if="fav.sample" tone="warn" class="fav-sample">示例</TapeLabel>
          </div>

          <div class="fav-body">
            <h2 class="fav-title">{{ fav.title }}</h2>

            <div class="fav-meta">
              <span class="fav-score">{{ fav.score }}</span>
              <span class="fav-out">/10</span>
              <span class="fav-status">{{ fav.status }}</span>
            </div>

            <p v-if="fav.note" class="fav-note">{{ fav.note }}</p>

            <a
              v-if="fav.link"
              :href="fav.link"
              class="fav-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              去看看
              <ExternalLink :size="12" :stroke-width="2" aria-hidden="true" />
            </a>
          </div>
        </StickerCard>
      </RevealOnScroll>
    </div>

    <!-- ══ 列表区：音乐 / 书 ═══════════════════════════════ -->
    <div v-if="rowItems.length" class="row-list">
      <RevealOnScroll v-for="(fav, i) in rowItems" :key="fav.slug" :delay="Math.min(i * 50, 200)">
        <div class="fav-row">
          <span class="row-icon" aria-hidden="true">
            <Music v-if="fav.type === 'music'" :size="16" :stroke-width="1.75" />
            <BookOpen v-else :size="16" :stroke-width="1.75" />
          </span>

          <div class="row-main">
            <h3 class="row-title">{{ fav.title }}</h3>
            <p class="row-artist">{{ fav.artist }}</p>
          </div>

          <p v-if="fav.note" class="row-note">{{ fav.note }}</p>

          <span class="row-score">
            {{ fav.score }}
            <span class="row-out">/10</span>
          </span>

          <a
            v-if="fav.link"
            :href="fav.link"
            class="row-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="sr-only">打开 {{ fav.title }}</span>
            <ExternalLink :size="14" :stroke-width="1.75" aria-hidden="true" />
          </a>
        </div>
      </RevealOnScroll>
    </div>
  </div>
</template>

<style scoped>
.favorites-page {
  padding-top: 24px;
}

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

/* ── 筛选 ───────────────────────────────────────────────── */
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

/* ── 卡片区 ─────────────────────────────────────────────── */
.fav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 26px;
}

.fav-cover {
  position: relative;
  aspect-ratio: 5 / 7;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 12px;
  background: var(--bg-soft);
  margin-bottom: 12px;
}

.fav-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/*
 * 没有封面时的版式封面。
 * 音乐和书本来就不该硬塞一张插画，所以做成一本"书脊"的样子：
 * 底色 + 细斜纹 + 中间一个大字 + 底部类型标签。
 * 这样和旁边有图的卡片并排时，视觉重量差不多，不会显得像漏图。
 */
.fav-glyph-cover {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background:
    repeating-linear-gradient(
      135deg,
      transparent 0 9px,
      color-mix(in srgb, var(--accent) 7%, transparent) 9px 10px
    ),
    linear-gradient(160deg, var(--accent-soft), var(--bg-soft));
  /* 左边一道书脊 */
  box-shadow: inset 6px 0 0 color-mix(in srgb, var(--accent) 22%, transparent);
}

.glyph-char {
  font-family: var(--font-display);
  font-size: 3.4rem;
  line-height: 1;
  color: color-mix(in srgb, var(--accent) 72%, var(--ink));
  opacity: 0.92;
}

.glyph-kind {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--ink-soft);
  opacity: 0.8;
  padding-bottom: 2px;
}

.fav-sample {
  position: absolute;
  top: 7px;
  right: 7px;
}

.fav-title {
  font-size: 15px;
  line-height: 1.45;
}

.fav-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 7px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-soft);
}

.fav-score {
  font-size: 15px;
  color: var(--accent);
}

.fav-status {
  margin-left: auto;
  padding: 0 7px;
  border-radius: var(--r-pill);
  background: var(--bg-soft);
}

.fav-note {
  margin-top: 9px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink-soft);
}

.fav-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  font-size: 12.5px;
  color: var(--accent);
}

.fav-link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* ── 列表区 ─────────────────────────────────────────────── */
.row-list {
  display: grid;
  gap: 10px;
  margin-top: 34px;
}

.fav-row {
  display: grid;
  grid-template-columns: auto minmax(120px, 200px) 1fr auto auto;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  border-radius: var(--r-input);
  border: 1px solid var(--line);
  background: var(--surface);
  transition: border-color var(--t-fast) var(--ease-out);
}

.fav-row:hover {
  border-color: var(--accent);
}

.row-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
}

.row-title {
  font-size: 14.5px;
}

.row-artist {
  margin-top: 2px;
  font-size: 12px;
  color: var(--ink-soft);
}

.row-note {
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink-soft);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.row-score {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--accent);
  white-space: nowrap;
}

.row-out {
  font-size: 10px;
  opacity: 0.6;
}

.row-link {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: var(--ink-soft);
}

.row-link:hover {
  background: var(--bg-soft);
  color: var(--accent);
}

@media (max-width: 899px) {
  .fav-row {
    grid-template-columns: auto 1fr auto;
    row-gap: 6px;
  }

  .row-note {
    grid-column: 1 / -1;
  }

  .row-link {
    grid-row: 1;
    grid-column: 3;
  }

  .row-score {
    grid-row: 1;
    grid-column: 2;
    justify-self: end;
    padding-right: 44px;
  }
}
</style>
