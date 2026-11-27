<script setup lang="ts">
import { ref, computed } from 'vue'
import { about, withBase } from '@/composables/useContent'
import { useSeo } from '@/composables/useSeo'
import { site } from '@/data/site.config'
import { settings } from '@/composables/useSettings'
import TapeLabel from '@/components/ui/TapeLabel.vue'
import SiteMark from '@/components/ui/SiteMark.vue'
import WashiDivider from '@/components/ui/WashiDivider.vue'
import { ChevronDown } from '@lucide/vue'

useSeo({ title: '关于', description: '关于我和这个站点。' })

const aboutUrl = withBase('/art/about.webp')

/** 问答手风琴：一次只开一个 */
const openIndex = ref<number>(0)
function toggle(i: number) {
  openIndex.value = openIndex.value === i ? -1 : i
}

const showIllustration = computed(
  () => site.features.aboutIllustration && settings.value.aboutIllustration,
)
</script>

<template>
  <div class="container about-page">
    <header class="page-head">
      <TapeLabel>about</TapeLabel>
      <h1 class="page-title t-display">关于</h1>
    </header>

    <!-- ══ 上：插画 + 自我介绍正文 ══════════════════════════ -->
    <section class="about-top" :class="{ 'no-illustration': !showIllustration }">
      <div v-if="showIllustration" class="about-illustration">
        <img
          :src="aboutUrl"
          alt="一张关于页插画"
          width="1200"
          height="1200"
          loading="eager"
          decoding="async"
        />
      </div>

      <!-- 正文来自 content/about.md 里 frontmatter 之后的部分 -->
      <div v-if="about.html" class="about-intro prose" v-html="about.html" />
    </section>

    <WashiDivider label="profile" />

    <!-- ══ 下：问答 + 时间线 ══════════════════════════════ -->
    <div class="about-grid">
      <!-- 问答手风琴 -->
      <section class="qa-section">
        <h2 class="col-title">问答</h2>

        <div v-if="!about.qa.length" class="qa-empty">
          还没写。在 content/about.md 的 qa 里加几条就会出现在这里。
        </div>

        <ul v-else class="qa-list">
          <li v-for="(item, i) in about.qa" :key="item.q" class="qa-item">
            <button type="button" class="qa-q" :aria-expanded="openIndex === i" @click="toggle(i)">
              <span class="qa-index">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="qa-text">{{ item.q }}</span>
              <ChevronDown
                :size="16"
                :stroke-width="2"
                class="qa-chevron"
                :class="{ open: openIndex === i }"
                aria-hidden="true"
              />
            </button>

            <div v-show="openIndex === i" class="qa-a">
              <p>{{ item.a }}</p>
            </div>
          </li>
        </ul>
      </section>

      <!-- 时间线 -->
      <section class="timeline-section">
        <h2 class="col-title">时间线</h2>

        <div v-if="!about.timeline.length" class="qa-empty">
          还没写。在 content/about.md 的 timeline 里加几条。
        </div>

        <ol v-else class="timeline">
          <li v-for="item in about.timeline" :key="`${item.year}-${item.text}`" class="tl-item">
            <span class="tl-year">{{ item.year }}</span>
            <span class="tl-dot" aria-hidden="true" />
            <span class="tl-text">{{ item.text }}</span>
          </li>
        </ol>
      </section>
    </div>

    <WashiDivider label="end" />

    <p class="about-sign">
      <SiteMark :size="22" :framed="false" />
    </p>
  </div>
</template>

<style scoped>
.about-page {
  padding-top: 24px;
}

.page-head {
  margin-bottom: 40px;
}

.page-title {
  margin-top: 12px;
}

/* ── 上部：插画 + 正文 ──────────────────────────────────── */
.about-top {
  display: grid;
  grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
  gap: 56px;
  align-items: center;
}

/* 关掉插画时正文独占一行，不要留一个空栏 */
.about-top.no-illustration {
  grid-template-columns: minmax(0, 1fr);
}

@media (max-width: 899px) {
  .about-top {
    grid-template-columns: 1fr;
    gap: 28px;
  }

  /* 堆叠之后插画会撑满整行，平板宽度下大得离谱，给个上限 */
  .about-illustration {
    max-width: 440px;
  }
}

.about-illustration {
  border-radius: var(--r-card);
  overflow: hidden;
  border: var(--w-stroke) solid var(--ink);
  background: var(--bg-soft);
}

.about-illustration img {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
}

/* 正文第一段不需要顶部空隙，否则和插画对不齐 */
.about-intro > :first-child {
  margin-top: 0;
}

.about-intro > :last-child {
  margin-bottom: 0;
}

/* ── 下部两栏 ───────────────────────────────────────────── */
.about-grid {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 56px;
  align-items: start;
}

@media (max-width: 899px) {
  .about-grid {
    grid-template-columns: 1fr;
    gap: 44px;
  }
}

.col-title {
  margin-bottom: 18px;
  font-family: var(--font-display);
  font-size: 1.25rem;
}

.qa-empty {
  padding: 18px;
  border-radius: var(--r-input);
  border: 1px dashed var(--line);
  font-size: 13.5px;
  color: var(--ink-soft);
}

/* ── 问答手风琴 ─────────────────────────────────────────── */
.qa-list {
  display: grid;
  gap: 0;
  border-top: 1px solid var(--line);
}

.qa-item {
  border-bottom: 1px solid var(--line);
}

.qa-q {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 54px;
  padding: 12px 4px;
  text-align: left;
  transition: color var(--t-fast) var(--ease-out);
}

.qa-q:hover {
  color: var(--accent);
}

.qa-index {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  opacity: 0.7;
  flex: 0 0 auto;
}

.qa-text {
  flex: 1;
  font-size: 15px;
  line-height: 1.5;
}

.qa-chevron {
  flex: 0 0 auto;
  color: var(--ink-soft);
  transition: transform var(--t-base) var(--ease-out);
}

.qa-chevron.open {
  transform: rotate(180deg);
  color: var(--accent);
}

.qa-a {
  padding: 0 4px 18px 27px;
  font-size: 14px;
  line-height: 1.85;
  color: var(--ink-soft);
}

/* ── 时间线 ─────────────────────────────────────────────── */
.timeline {
  position: relative;
  padding-left: 4px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 62px;
  top: 8px;
  bottom: 8px;
  width: 1px;
  background: var(--line);
}

.tl-item {
  position: relative;
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 22px;
  padding-bottom: 20px;
}

.tl-year {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--ink-soft);
  text-align: right;
  padding-top: 2px;
}

.tl-dot {
  position: absolute;
  left: 59px;
  top: 7px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--bg);
}

.tl-text {
  font-size: 14px;
  line-height: 1.7;
}

/* ── 签名 ───────────────────────────────────────────────── */
.about-sign {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--font-quote);
  font-size: 15px;
  color: var(--ink-soft);
}
</style>
