<script setup lang="ts">
import { computed } from 'vue'
import { site } from '@/data/site.config'
import { useSeo } from '@/composables/useSeo'
import { latestPosts, favorites, gallery, withBase } from '@/composables/useContent'
import { settings, motionEnabled } from '@/composables/useSettings'
import TypeLine from '@/components/motion/TypeLine.vue'
import RevealOnScroll from '@/components/motion/RevealOnScroll.vue'
import PetalField from '@/components/motion/PetalField.vue'
import ComicEpilogue from '@/components/content/ComicEpilogue.vue'
import PostCard from '@/components/content/PostCard.vue'
import StickerCard from '@/components/ui/StickerCard.vue'
import WashiDivider from '@/components/ui/WashiDivider.vue'
import SiteMark from '@/components/ui/SiteMark.vue'
import TapeLabel from '@/components/ui/TapeLabel.vue'
import { ArrowDown, ArrowRight } from '@lucide/vue'

useSeo()

/** 首屏主视觉 */
const heroUrl = withBase('/art/hero.webp')

/** 最新 3 篇；不足 3 篇时用收藏补位，不允许出现空块 */
const topPosts = computed(() => latestPosts(3))
/**
 * 首页的收藏条只放"有封面"的条目。
 * 音乐和书在收藏页是用文字行展示的，本身没有封面；
 * 如果直接 slice(0, 6) 把它们拉进来，就会出现一块空白方块。
 */
const featuredFavorites = computed(() => {
  const withCover = favorites.filter((f) => f.cover)
  const rest = favorites.filter((f) => !f.cover)
  return [...withCover, ...rest].slice(0, 6)
})
const galleryStrip = computed(() => gallery.slice(0, 8))

/** 首页那一句自述 */
const selfNote = '这里放着我正在看的东西、踩过的坑，和一些没什么用但舍不得删的念头。'

/**
 * 首屏标题文本。
 * 中文默认可以在任意两个字之间换行，窄屏上就会出现"随 / 手记"这样把词拆开的情况。
 * 这里在顿号、逗号、句号后面插入一个零宽空格（U+200B）——
 * 它不可见、不占宽度，只是告诉浏览器"这里可以断行"。
 * 于是窄屏会断成"看番、写码、/ 随手记一点什么"，而不是从词中间劈开。
 */
const heroTagline = site.tagline.replace(/([、，。！？：；])/g, '$1\u200B')
</script>

<template>
  <div class="home">
    <!-- ══ 首屏主视觉 ══════════════════════════════════════ -->
    <section class="hero">
      <!--
        主视觉用 CSS 背景图画，不用 <img>。
        原因：这张图在 <img> + object-fit: cover 的路径下，部分渲染环境
        （包括某些 WebView / 内置浏览器）会把它画成一片空白。
        背景图是浏览器最成熟的绘制路径，稳定得多；首屏最重要的就是"一定能看到"。
        无障碍不受影响：这是纯装饰图，本来就不该被读屏软件念出来。
      -->
      <div
        class="hero-media"
        :style="{ backgroundImage: `url(${heroUrl})` }"
        role="presentation"
        aria-hidden="true"
      >
        <PetalField v-if="settings.petals && motionEnabled" />
      </div>
      <div class="hero-veil" aria-hidden="true" />

      <div class="container hero-content">
        <h1 class="hero-title t-display">
          <TypeLine :text="heroTagline" :speed="52" :start-delay="320" />
        </h1>

        <p class="hero-sub">{{ site.title }}</p>

        <div class="hero-actions">
          <RouterLink to="/posts" class="btn btn-primary">
            读文章
            <ArrowRight :size="16" :stroke-width="2" aria-hidden="true" />
          </RouterLink>
          <RouterLink to="/about" class="btn btn-ghost">关于我</RouterLink>
        </div>
      </div>

      <!-- 向下的箭头：只是视觉暗示，不做教程 -->
      <div class="hero-cue" aria-hidden="true">
        <ArrowDown :size="18" :stroke-width="1.75" />
      </div>
    </section>

    <!-- ══ 最新文章 ════════════════════════════════════════ -->
    <section class="container section">
      <RevealOnScroll>
        <header class="section-head">
          <h2 class="section-title">最近在写</h2>
          <RouterLink to="/posts" class="section-more">
            全部文章
            <ArrowRight :size="14" :stroke-width="2" aria-hidden="true" />
          </RouterLink>
        </header>
      </RevealOnScroll>

      <div class="post-grid">
        <RevealOnScroll v-for="(post, i) in topPosts" :key="post.path" :delay="i * 80">
          <PostCard :post="post" :tilt="i === 1 ? 0.7 : i === 2 ? -0.6 : 0" />
        </RevealOnScroll>
      </div>
    </section>

    <!-- ══ 收藏精选 ════════════════════════════════════════ -->
    <section v-if="featuredFavorites.length" class="container section">
      <RevealOnScroll>
        <header class="section-head">
          <h2 class="section-title">最近在看</h2>
          <RouterLink to="/favorites" class="section-more">
            全部收藏
            <ArrowRight :size="14" :stroke-width="2" aria-hidden="true" />
          </RouterLink>
        </header>
      </RevealOnScroll>

      <div class="fav-scroller">
        <RouterLink
          v-for="(fav, i) in featuredFavorites"
          :key="fav.slug"
          to="/favorites"
          class="fav-item"
        >
          <StickerCard :tilt="i % 2 === 0 ? 0.8 : -0.8">
            <div class="fav-cover">
              <img
                v-if="fav.cover"
                :src="withBase(fav.cover)"
                :alt="`${fav.title} 封面`"
                loading="lazy"
                decoding="async"
              />
              <div v-else class="fav-glyph-cover" aria-hidden="true">
                <span class="glyph-char">{{ fav.title.slice(0, 1) }}</span>
                <span class="glyph-kind">{{ fav.type === 'music' ? '音乐' : '书' }}</span>
              </div>
              <TapeLabel v-if="fav.sample" tone="warn" class="fav-sample">示例</TapeLabel>
            </div>
            <h3 class="fav-title">{{ fav.title }}</h3>
            <p class="fav-meta">
              <span class="fav-score">{{ fav.score }}</span>
              <span>/ 10</span>
              <span class="fav-status">{{ fav.status }}</span>
            </p>
          </StickerCard>
        </RouterLink>
      </div>
    </section>

    <!-- ══ 相册条带 ════════════════════════════════════════ -->
    <section v-if="galleryStrip.length >= 3" class="gallery-strip-section">
      <div class="strip-track" :class="{ 'is-animated': motionEnabled }">
        <!-- 复制一份实现无缝滚动 -->
        <template v-for="pass in 2" :key="pass">
          <RouterLink
            v-for="item in galleryStrip"
            :key="`${pass}-${item.image}`"
            to="/gallery"
            class="strip-item"
          >
            <img
              :src="withBase(item.image)"
              :alt="item.caption || item.title"
              loading="lazy"
              decoding="async"
            />
          </RouterLink>
        </template>
      </div>
    </section>

    <!-- ══ 一句话 ══════════════════════════════════════════ -->
    <section class="container section">
      <RevealOnScroll>
        <WashiDivider label="note" />
        <div class="one-line">
          <SiteMark :size="26" />
          <p>{{ selfNote }}</p>
        </div>
        <WashiDivider label="fin" />
      </RevealOnScroll>
    </section>

    <!-- ══ 卷末四格：这一页是整本的结尾 ════════════════════ -->
    <ComicEpilogue />
  </div>
</template>

<style scoped>
/* ══ 首屏 ═══════════════════════════════════════════════ */
.hero {
  position: relative;
  /* 用 dvh 而不是 vh，移动端地址栏收缩时不跳 */
  min-height: min(78dvh, 720px);
  display: flex;
  align-items: center;
  overflow: hidden;
  margin-top: -96px;
  padding-top: 96px;
  /* 图片溢出到 hero 外时不要露出来，否则底边会出现一条接缝 */
  isolation: isolate;
}

@media (max-width: 767px) {
  .hero {
    min-height: 60dvh;
    margin-top: -76px;
    padding-top: 76px;
  }
}

.hero-media {
  position: absolute;
  inset: 0;
  z-index: 0;
  /* 主视觉画在这一层：cover 裁切 + 焦点偏下，让山脊落在文字下方、不被遮罩吃掉 */
  background-size: cover;
  background-position: center 58%;
  background-repeat: no-repeat;
}

/* 渐变遮罩：让文字在任何图上都读得清 */
.hero-veil {
  position: absolute;
  /* 下边多伸出 2px，盖住底边合成时可能留下的那一像素暗线 */
  inset: 0 0 -2px 0;
  z-index: 1;
  pointer-events: none;
  background:
    /* 左侧压一层，保证标题在浅色天空上也够清楚 */
    linear-gradient(to right, color-mix(in srgb, var(--bg) 42%, transparent) 0%, transparent 52%),
    /* 顶部轻压，避免和导航撞色 */
    linear-gradient(to bottom, color-mix(in srgb, var(--bg) 38%, transparent) 0%, transparent 20%),
    /* 底部在最后三分之一渐隐到背景色，边界不会硬 */
    linear-gradient(to top, var(--veil-to) 0%, var(--veil-from) 34%);
}

/*
 * 暗色主题下的主视觉。
 * 原图是浅色水彩，直接放在黑底上要么糊成一团要么被遮罩吃干净。
 * 这里把画面压暗、提对比，让它变成"发光的剪纸"，只保留山的轮廓。
 *
 * 为什么整条选择器都放进 :global()：
 *   主题属性挂在 <html> 上，不在本组件的 DOM 里。如果只把前缀写进 :global()，
 *   后半段 .hero-media 会被 Vue 加上组件哈希，而哈希在 <html> 那一层是没有的，
 *   这条规则就永远匹配不到。
 */
:global([data-theme='neon'] .hero-media) {
  filter: saturate(0.9) brightness(0.55) contrast(1.25);
}

:global([data-theme='neon'] .hero-veil) {
  background:
    linear-gradient(to bottom, var(--veil-to) 0%, transparent 30%),
    linear-gradient(to top, var(--veil-to) 0%, var(--veil-from) 58%);
}

.hero-content {
  position: relative;
  z-index: 3;
  padding-block: 48px;
}

.hero-title {
  /*
   * 不要用 ch 做宽度上限。
   * ch 是按字体里 "0" 的宽度算的，而站酷快乐体的数字/拉丁字符很窄，
   * 16ch 只有约 767px，装不下 13 个全角汉字（72px × 13 ≈ 936px），
   * 结果就是"什么"被挤到第二行。
   * 用 min() 按可用宽度和"一行能放下的最大字号"来算，才不会中途断行。
   */
  max-width: min(100%, 21em);
  text-wrap: balance;
  /*
   * 中文默认任意两个字之间都能换行，窄屏就会把"随手"拆成两行。
   * keep-all 关掉这种"随处可断"，只允许在上面插了零宽空格的地方断；
   * break-word 是兜底：万一整句一个标点都没有，宁可词内断也不能溢出屏幕。
   */
  word-break: keep-all;
  overflow-wrap: break-word;
  /* 文字在图上要够重，否则被图吃掉 */
  color: var(--ink);
  text-shadow: 0 2px 20px color-mix(in srgb, var(--bg) 70%, transparent);
}

.hero-sub {
  margin-top: 14px;
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.hero-actions {
  display: flex;
  gap: 12px;
  margin-top: 30px;
}

/* ── 按钮 ───────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 22px;
  border-radius: var(--r-pill);
  font-size: 14px;
  transition:
    transform var(--t-fast) var(--ease-out),
    background-color var(--t-fast) var(--ease-out),
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.btn-primary {
  background: var(--accent);
  color: var(--accent-ink);
}

.btn-primary:hover {
  transform: translateY(-2px);
  background: color-mix(in srgb, var(--accent) 86%, black);
}

.btn-ghost {
  border: 1px solid var(--ink);
  color: var(--ink);
}

.btn-ghost:hover {
  background: var(--ink);
  color: var(--bg);
}

[data-motion='off'] .btn-primary:hover {
  transform: none;
}

.hero-cue {
  position: absolute;
  bottom: 26px;
  left: 50%;
  z-index: 3;
  translate: -50% 0;
  color: var(--ink-soft);
  animation: cue-float 2.8s var(--ease-in-out) infinite;
}

@keyframes cue-float {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.55;
  }
  50% {
    transform: translateY(6px);
    opacity: 1;
  }
}

[data-motion='off'] .hero-cue {
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .hero-cue {
    animation: none;
  }
}

/* ══ 通用区块 ═══════════════════════════════════════════ */
.section {
  margin-top: 88px;
}

@media (max-width: 767px) {
  .section {
    margin-top: 60px;
  }
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}

.section-title {
  font-family: var(--font-display);
  font-size: clamp(1.35rem, 2.8vw, 1.75rem);
}

.section-more {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--ink-soft);
  white-space: nowrap;
  transition: color var(--t-fast) var(--ease-out);
}

.section-more:hover {
  color: var(--accent);
}

/* ── 文章网格：1 / 2 / 3 列自适应 ──────────────────────── */
.post-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
}

@media (max-width: 1023px) {
  .post-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 639px) {
  .post-grid {
    grid-template-columns: 1fr;
  }
}

/* ── 收藏横向滚动条 ─────────────────────────────────────── */
.fav-scroller {
  display: flex;
  gap: 18px;
  overflow-x: auto;
  padding: 8px 4px 18px;
  scroll-snap-type: x mandatory;
  /* 隐藏滚动条但保留滚动能力 */
  scrollbar-width: thin;
}

.fav-scroller::-webkit-scrollbar {
  height: 6px;
}

.fav-scroller::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: var(--line);
}

.fav-item {
  flex: 0 0 auto;
  width: 172px;
  scroll-snap-align: start;
}

@media (min-width: 1024px) {
  /* 桌面显示 4 张 + 提示还有更多 */
  .fav-item {
    width: 196px;
  }
}

.fav-cover {
  position: relative;
  aspect-ratio: 5 / 7;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 12px;
  background: var(--bg-soft);
  margin-bottom: 10px;
}

.fav-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 没有封面时的版式封面（音乐、书），和收藏页保持同一套视觉 */
.fav-glyph-cover {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background:
    repeating-linear-gradient(
      135deg,
      transparent 0 9px,
      color-mix(in srgb, var(--accent) 7%, transparent) 9px 10px
    ),
    linear-gradient(160deg, var(--accent-soft), var(--bg-soft));
  box-shadow: inset 5px 0 0 color-mix(in srgb, var(--accent) 22%, transparent);
}

.glyph-char {
  font-family: var(--font-display);
  font-size: 2.8rem;
  line-height: 1;
  color: color-mix(in srgb, var(--accent) 72%, var(--ink));
  opacity: 0.92;
}

.glyph-kind {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--ink-soft);
  opacity: 0.8;
}

.fav-sample {
  position: absolute;
  top: 6px;
  right: 6px;
}

.fav-title {
  font-size: 14px;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.fav-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-soft);
}

.fav-score {
  color: var(--accent);
  font-size: 14px;
}

.fav-status {
  margin-left: auto;
  padding: 0 6px;
  border-radius: var(--r-pill);
  background: var(--bg-soft);
}

/* ── 相册条带 ───────────────────────────────────────────── */
.gallery-strip-section {
  margin-top: 88px;
  overflow: hidden;
  mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent);
  -webkit-mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent);
}

.strip-track {
  display: flex;
  gap: 14px;
  width: max-content;
  padding-block: 6px;
}

.strip-track.is-animated {
  animation: strip-scroll 46s linear infinite;
}

.strip-track.is-animated:hover {
  animation-play-state: paused;
}

@keyframes strip-scroll {
  from {
    transform: translateX(0);
  }
  to {
    /* 只滚过一半（因为内容复制了一份） */
    transform: translateX(-50%);
  }
}

.strip-item {
  flex: 0 0 auto;
  width: 240px;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid var(--line);
}

.strip-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--t-slow) var(--ease-out);
}

.strip-item:hover img {
  transform: scale(1.05);
}

@media (max-width: 767px) {
  .gallery-strip-section {
    margin-top: 60px;
  }

  .strip-item {
    width: 180px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .strip-track.is-animated {
    animation: none;
  }
}

/* ── 一句话区 ───────────────────────────────────────────── */
.one-line {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  max-width: 620px;
  margin: 0 auto;
  padding: 6px 0;
}

.one-line p {
  font-family: var(--font-quote);
  font-size: clamp(1rem, 2.4vw, 1.2rem);
  line-height: 1.9;
  color: var(--ink);
}
</style>
