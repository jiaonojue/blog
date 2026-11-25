<script setup lang="ts">
/**
 * 文章卡片 —— 用于首页最新文章与文章列表。
 */
import { computed } from 'vue'
import type { Post } from '@/types/content'
import { categoryLabel, withBase } from '@/composables/useContent'
import { isRead } from '@/composables/useBook'
import TapeLabel from '@/components/ui/TapeLabel.vue'
import ReadStamp from '@/components/content/ReadStamp.vue'

const props = withDefaults(defineProps<{ post: Post; tilt?: number }>(), { tilt: 0 })

/** 日期显示成 2026.11.20 */
const dateText = computed(() => props.post.date.replace(/-/g, '.'))
const coverUrl = computed(() => (props.post.cover ? withBase(props.post.cover) : ''))
const category = computed(() => categoryLabel(props.post.category))
/** 读过的文章盖一个章 */
const read = computed(() => isRead(props.post.path))
</script>

<template>
  <RouterLink :to="post.path" class="post-card" :style="{ '--tilt': `${tilt}deg` }">
    <article>
      <!-- 封面：没有封面时用纯色块 + 印章，不留空白 -->
      <div class="card-cover" :class="{ 'no-image': !coverUrl }">
        <img
          v-if="coverUrl"
          :src="coverUrl"
          :alt="`${post.title} 的封面`"
          loading="lazy"
          decoding="async"
        />
        <span v-else class="cover-glyph" aria-hidden="true">記</span>

        <TapeLabel v-if="post.sample" tone="warn" class="card-sample">SAMPLE</TapeLabel>

        <!-- 既読：盖在封面右上角，微微压出边界一点，像随手盖上去的 -->
        <ReadStamp v-if="read" class="card-read" />
      </div>

      <div class="card-body">
        <div class="card-meta">
          <span class="card-cat">{{ category }}</span>
          <span class="card-date">{{ dateText }}</span>
        </div>

        <h3 class="card-title">{{ post.title }}</h3>
        <p class="card-summary">{{ post.summary }}</p>

        <div class="card-foot">
          <span>{{ post.minutes }} 分钟</span>
          <span v-if="post.tags.length" class="card-tags">
            {{ post.tags.slice(0, 2).join(' · ') }}
          </span>
        </div>
      </div>
    </article>
  </RouterLink>
</template>

<style scoped>
.post-card {
  display: block;
  border-radius: var(--r-card);
  border: 1px solid var(--line);
  background: var(--surface);
  overflow: hidden;
  transform: rotate(var(--tilt));
  box-shadow: var(--shadow);
  transition:
    transform var(--t-base) var(--ease-out),
    box-shadow var(--t-base) var(--ease-out),
    border-color var(--t-base) var(--ease-out);
}

.post-card:hover {
  transform: rotate(0deg) translateY(-5px);
  box-shadow: var(--shadow-lift);
  border-color: var(--accent);
}

[data-motion='off'] .post-card:hover {
  transform: rotate(var(--tilt));
}

@media (prefers-reduced-motion: reduce) {
  .post-card:hover {
    transform: rotate(var(--tilt));
  }
}

/* ── 封面 ───────────────────────────────────────────────── */
.card-cover {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--bg-soft);
}

.card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--t-slow) var(--ease-out);
}

.post-card:hover .card-cover img {
  transform: scale(1.04);
}

@media (prefers-reduced-motion: reduce) {
  .post-card:hover .card-cover img {
    transform: none;
  }
}

/* 没有封面时的替代：色块 + 印章字，不算占位，是一种设计 */
.card-cover.no-image {
  display: grid;
  place-items: center;
  background-image: radial-gradient(
    circle at 30% 30%,
    color-mix(in srgb, var(--accent-soft) 90%, transparent),
    var(--bg-soft)
  );
}

.cover-glyph {
  font-family: var(--font-display);
  font-size: 3rem;
  color: var(--accent);
  opacity: 0.45;
}

.card-sample {
  position: absolute;
  top: 10px;
  right: 10px;
}

/*
 * 既読章盖在封面左下：右上角被 SAMPLE 胶带占着，
 * 左下角是封面里最不重要的角落，章压住一点边也不碍事。
 */
.card-read {
  position: absolute;
  left: 10px;
  bottom: 10px;
  z-index: 2;
  /* 盖在图上要有点"印上去"的感觉：稍微变淡，别抢封面 */
  opacity: 0.9;
}

/* ── 卡片文字 ───────────────────────────────────────────── */
.card-body {
  padding: 16px 18px 18px;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--ink-soft);
}

.card-cat {
  padding: 1px 8px;
  border-radius: var(--r-pill);
  background: var(--accent-soft);
  color: var(--accent);
}

.card-title {
  font-size: 1.05rem;
  line-height: 1.45;
  /* 最多两行，超出省略 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-summary {
  margin-top: 7px;
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--ink-soft);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
  padding-top: 11px;
  border-top: 1px dashed var(--line);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-soft);
}

.card-tags {
  color: var(--accent);
  opacity: 0.85;
}
</style>
