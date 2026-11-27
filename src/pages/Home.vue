<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { site } from '@/data/site.config'
import { useSeo } from '@/composables/useSeo'
import {
  posts,
  latestPosts,
  favorites,
  gallery,
  categoryLabel,
  withBase,
  type Post,
} from '@/composables/useContent'
import { settings, motionEnabled } from '@/composables/useSettings'
import { pageOf, pad2, isRead } from '@/composables/useBook'
import TypeLine from '@/components/motion/TypeLine.vue'
import RevealOnScroll from '@/components/motion/RevealOnScroll.vue'
import GlowTitle from '@/components/motion/GlowTitle.vue'
import PetalField from '@/components/motion/PetalField.vue'
import ComicEpilogue from '@/components/content/ComicEpilogue.vue'
import QuietPages from '@/components/content/QuietPages.vue'
import MoyuZone from '@/components/content/MoyuZone.vue'
import PostCard from '@/components/content/PostCard.vue'
import ReadStamp from '@/components/content/ReadStamp.vue'
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

/**
 * 一册的数据。
 * 字数从构建期算好的 chars 里加，阅读时长用构建期算好的 minutes，
 * 不在这里重新估——两处算出两个数会露馅。
 */
const totalChars = computed(() => posts.reduce((sum, p) => sum + (p.chars ?? 0), 0))
const totalMinutes = computed(() => posts.reduce((sum, p) => sum + (p.minutes ?? 0), 0))

/** 首页那一句自述 */
const selfNote = '这里放着我正在看的东西、踩过的坑，和一些没什么用但舍不得删的念头。'

/* ══ 中挿插画页 ═════════════════════════════════════════════
 * 同人志翻到一半会突然夹进来几页彩页——这一节就是那几页。
 * 六张插画横向排开（可滑动），每张是一页"插进书里的画"：
 * 纸框、胶带、页码、一句小字。它不承载任何信息，
 * 存在的意义就是"翻着翻着，有一页是画"。
 */
const INSERTS: { src: string; caption: string }[] = [
  { src: '/art/girls/insert-01.webp', caption: '三点钟，点心和茶都有。' },
  { src: '/art/girls/insert-02.webp', caption: '出门之前，伙伴先排好队。' },
  { src: '/art/girls/insert-03.webp', caption: '秋天，楼梯间刚好有光。' },
  { src: '/art/girls/insert-04.webp', caption: '放学路上稍微绕了点远。' },
  { src: '/art/girls/insert-05.webp', caption: '烟花升起来的时候，忘了要说什么。' },
  { src: '/art/girls/insert-06.webp', caption: '夏天最后一天，猫比我先睡着。' },
]

/* 插画页的悬停 tilt：光标在卡片上的位置 → 轻微 3D 转动 */
function onInsertTilt(e: MouseEvent) {
  if (!motionEnabled.value) return
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width - 0.5
  const y = (e.clientY - r.top) / r.height - 0.5
  el.style.setProperty('--tx', `${(-y * 7).toFixed(2)}deg`)
  el.style.setProperty('--ty', `${(x * 9).toFixed(2)}deg`)
}

function onInsertReset(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  el.style.setProperty('--tx', '0deg')
  el.style.setProperty('--ty', '0deg')
}

/**
 * 首屏标题文本。
 * 中文默认可以在任意两个字之间换行，窄屏上就会出现"随 / 手记"这样把词拆开的情况。
 * 这里在顿号、逗号、句号后面插入一个零宽空格（U+200B）——
 * 它不可见、不占宽度，只是告诉浏览器"这里可以断行"。
 * 于是窄屏会断成"看番、写码、/ 随手记一点什么"，而不是从词中间劈开。
 */
const heroTagline = site.tagline.replace(/([、，。！？：；])/g, '$1\u200B')

/* ══ 目次悬浮预览 ═══════════════════════════════════════════
 * 鼠标扫过目次的一行，一张小卡片从光标旁边浮起来：
 * 封面、标题、两行摘要、页码。卡片不跟得死死的——
 * 用缓动追光标，横向速度换成倾斜角，像一张被拎起来
 * 又被放下的小纸片。
 *
 * 【只在鼠标环境生效】触屏没有 hover，预览没有意义；
 * prefers-reduced-motion / 站内动效关闭时也不出现。
 */
const previewPost = ref<Post | null>(null)
const previewEl = ref<HTMLElement | null>(null)
const previewOn = ref(false)

const pvFine = () =>
  motionEnabled.value &&
  typeof matchMedia !== 'undefined' &&
  matchMedia('(hover: hover) and (pointer: fine)').matches

/* 目标位置（光标）/ 当前位置（缓动追）/ 上一帧位置（算速度） */
let pvTX = 0
let pvTY = 0
let pvX = 0
let pvY = 0
let pvLast = 0
let pvRaf = 0

function pvTick(now: number) {
  const el = previewEl.value
  if (!el) {
    pvRaf = 0
    return
  }
  const dt = Math.min(48, now - (pvLast || now))
  pvLast = now
  // 缓动系数按帧长归一：掉帧时也不会突然跳
  const k = 1 - Math.pow(0.0016, dt / 1000)
  const prevX = pvX
  pvX += (pvTX - pvX) * k
  pvY += (pvTY - pvY) * k
  // 横向速度 → 倾斜。速度越大纸片越"甩"
  const vx = pvX - prevX
  const rot = Math.max(-10, Math.min(10, vx * 0.28))
  // 锚点取光标右侧、垂直居中的位置：卡片悬浮在行旁边，不盖住正扫着的那几行
  el.style.transform = `translate(${pvX + 26}px, ${pvY - 140}px) rotate(${rot}deg)`
  pvRaf = requestAnimationFrame(pvTick)
}

function pvStart() {
  if (!pvRaf) {
    pvLast = 0
    pvRaf = requestAnimationFrame(pvTick)
  }
}

function pvStop() {
  if (pvRaf) {
    cancelAnimationFrame(pvRaf)
    pvRaf = 0
  }
}

function onRowEnter(e: MouseEvent, post: Post) {
  if (!pvFine()) return
  previewPost.value = post
  previewOn.value = true
  pvTX = pvX = e.clientX
  pvTY = pvY = e.clientY
  pvStart()
}

function onRowMove(e: MouseEvent) {
  pvTX = e.clientX
  pvTY = e.clientY
}

function onRowLeave() {
  previewOn.value = false
  previewPost.value = null
  pvStop()
}

/* ══ 胶带相册：跟着滚动跑 ═══════════════════════════════════
 * 相册条带本来匀速滚动。现在滚动页面的速度会注入给它：
 * 滑得越快它跑得越快，停手它就慢慢匀速回来。
 * 方向不变——改变方向会跳帧，变速才是顺滑的。
 */
const stripTrack = ref<HTMLElement | null>(null)
let stripRate = 1
let stripTarget = 1
let stripRaf = 0

function stripTick() {
  stripRate += (stripTarget - stripRate) * 0.08
  // 每次都往 1 收：滚动的冲动过去之后回到匀速
  stripTarget += (1 - stripTarget) * 0.05
  const anims = stripTrack.value?.getAnimations() ?? []
  for (const a of anims) a.updatePlaybackRate?.(stripRate)
  if (Math.abs(stripRate - 1) > 0.01 || Math.abs(stripTarget - 1) > 0.01) {
    stripRaf = requestAnimationFrame(stripTick)
  } else {
    stripRate = stripTarget = 1
    for (const a of anims) a.updatePlaybackRate?.(1)
    stripRaf = 0
  }
}

/* ══ 卡组景深 ═══════════════════════════════════════════════
 * 「最近在写」的三张卡片下面是一整块舞台。
 * 这一块滚进视口的过程中，整块平面从"稍微后仰"的角度
 * 慢慢立正（rotateX 7° → 0°）。滚动进度写进 CSS 变量，
 * 变换本身留在 CSS 里算。插画页横条用同一套进度，
 * 只不过它是绕竖轴轻轻侧一点头（rotateY 5° → 0°）。
 */
const postGrid = ref<HTMLElement | null>(null)
const insertStrip = ref<HTMLElement | null>(null)

let scrollRaf = 0
function onScrollFrame() {
  scrollRaf = 0
  const vh = window.innerHeight
  const grid = postGrid.value
  if (grid) {
    const r = grid.getBoundingClientRect()
    // 从"刚露头"到"过了视口 40%"之间走完立正
    const p = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.6)))
    grid.style.setProperty('--p', p.toFixed(3))
  }
  const strip = insertStrip.value
  if (strip) {
    const r = strip.getBoundingClientRect()
    const p = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.7)))
    strip.style.setProperty('--p', p.toFixed(3))
  }
}

function onScroll() {
  if (!scrollRaf) scrollRaf = requestAnimationFrame(onScrollFrame)
  if (motionEnabled.value && !stripRaf) stripRaf = requestAnimationFrame(stripTick)
}

let lastY = 0
function onScrollRaw() {
  // 变速的"冲动"来自滚动位移本身
  const y = window.scrollY
  const dy = Math.abs(y - lastY)
  lastY = y
  if (dy > 2) {
    stripTarget = Math.min(3.4, 1 + dy * 0.03)
    if (motionEnabled.value && !stripRaf) stripRaf = requestAnimationFrame(stripTick)
  }
  onScroll()
}

onMounted(() => {
  if (!motionEnabled.value) return
  window.addEventListener('scroll', onScrollRaw, { passive: true })
  onScrollRaw()
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScrollRaw)
  pvStop()
  if (stripRaf) cancelAnimationFrame(stripRaf)
})
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
          <h2 class="section-title"><GlowTitle text="最近在写" /></h2>
          <RouterLink to="/posts" class="section-more">
            全部文章
            <ArrowRight :size="14" :stroke-width="2" aria-hidden="true" />
          </RouterLink>
        </header>
      </RevealOnScroll>

      <div ref="postGrid" class="post-grid">
        <RevealOnScroll v-for="(post, i) in topPosts" :key="post.path" :delay="i * 80">
          <PostCard :post="post" :tilt="i === 1 ? 0.7 : i === 2 ? -0.6 : 0" />
        </RevealOnScroll>
      </div>
    </section>

    <!-- ══ 收藏精选 ════════════════════════════════════════ -->
    <section v-if="featuredFavorites.length" class="container section">
      <RevealOnScroll>
        <header class="section-head">
          <h2 class="section-title"><GlowTitle text="最近在看" /></h2>
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
      <div ref="stripTrack" class="strip-track" :class="{ 'is-animated': motionEnabled }">
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

    <!-- ══ 中挿插画页 ══════════════════════════════════════ -->
    <!--
      同人志翻到一半会突然夹进来几页彩页——这一节就是那几页。
      六张插画横向排开，可以左右滑；纸框、胶带、页码、一句小字。
      它不承载任何信息：翻着翻着，有一页是画，仅此而已。
    -->
    <section class="container section insert-section" data-pagefind-ignore>
      <RevealOnScroll>
        <header class="section-head">
          <h2 class="section-title"><GlowTitle text="插画页" /></h2>
          <span class="insert-kicker">color insert · 中间夹页</span>
        </header>
      </RevealOnScroll>

      <div ref="insertStrip" class="insert-strip">
        <figure
          v-for="(p, i) in INSERTS"
          :key="p.src"
          class="insert-page"
          :style="{ '--i': i }"
          @mousemove="onInsertTilt"
          @mouseleave="onInsertReset"
        >
          <span class="insert-tape" aria-hidden="true">插画 · {{ pad2(i + 1) }}</span>
          <img
            :src="withBase(p.src)"
            :alt="p.caption"
            loading="lazy"
            decoding="async"
            width="1200"
            height="800"
          />
          <figcaption class="insert-caption">
            <span class="insert-no">P.{{ pad2(17 + i * 3) }}</span>
            <span class="insert-text">{{ p.caption }}</span>
          </figcaption>
        </figure>
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

    <!-- ══ 目次：整本的目录页 ══════════════════════════════ -->
    <!--
      同人志翻过扉页就是目次。放在这里而不是顶部，
      是因为首页前半段是"逛"，走到这里的人往往已经想找某一篇了。
      页码用的是全站统一的那套（useBook），和文章页右上角的奥付对得上。
    -->
    <section class="container section contents-section">
      <RevealOnScroll>
        <header class="section-head">
          <h2 class="section-title"><GlowTitle text="目次" /></h2>
          <RouterLink to="/posts" class="section-more">
            全部 {{ posts.length }} 篇
            <ArrowRight :size="14" :stroke-width="2" aria-hidden="true" />
          </RouterLink>
        </header>
      </RevealOnScroll>

      <RevealOnScroll>
        <ol class="contents">
          <li v-for="post in posts" :key="post.path" class="contents-row">
            <RouterLink
              :to="post.path"
              class="row-link"
              @mouseenter="onRowEnter($event, post)"
              @mousemove="onRowMove"
              @mouseleave="onRowLeave"
            >
              <span class="row-page">{{ pad2(pageOf(post.path)) }}</span>
              <span class="row-title">{{ post.title }}</span>
              <span class="row-leader" aria-hidden="true" />
              <span class="row-cat">{{ categoryLabel(post.category) }}</span>
              <span class="row-date">{{ post.date.slice(5).replace('-', '.') }}</span>
              <ReadStamp v-if="isRead(post.path)" small />
            </RouterLink>
          </li>
        </ol>
      </RevealOnScroll>
    </section>

    <!-- ══ 一册的数据 ══════════════════════════════════════ -->
    <!--
      奥付式的收尾：这一册到底有多厚。
      所有数字都是构建期从真实内容里算的，不是写死的文案。
    -->
    <section class="container section stats-section">
      <RevealOnScroll>
        <div class="stats">
          <p class="stats-kicker">this volume</p>
          <dl class="stats-grid">
            <div class="stat">
              <dt>文章</dt>
              <dd>{{ posts.length }}</dd>
            </div>
            <div class="stat">
              <dt>字数</dt>
              <dd>{{ (totalChars / 1000).toFixed(1) }}k</dd>
            </div>
            <div class="stat">
              <dt>读完要</dt>
              <dd>{{ totalMinutes }} 分</dd>
            </div>
            <div class="stat">
              <dt>相片</dt>
              <dd>{{ gallery.length }}</dd>
            </div>
            <div class="stat">
              <dt>收藏</dt>
              <dd>{{ favorites.length }}</dd>
            </div>
          </dl>
          <p class="stats-note">
            写得慢，但每一篇都认真。
            <!-- 这一句和文章页说明同一个态度 -->
          </p>
        </div>
      </RevealOnScroll>
    </section>

    <!-- ══ 卷末四格：这一页是整本的结尾 ════════════════════ -->
    <ComicEpilogue />

    <!--
      ══ 空白页：正文结束到附录之间的那几页 ══════════════
      整站唯一的彩蛋。没有任何链接和按钮，只让页面说五句话，
      给"正文完了 → 还有附录"之间垫一段停顿。
    -->
    <QuietPages />

    <!-- ══ 附录：摸鱼分区 ══════════════════════════════════ -->
    <!-- 正文结束了，后面还有几页附录 —— 一本同人志本来就是这样装订的 -->
    <MoyuZone />

    <!--
      ══ 目次悬浮预览 ════════════════════════════════════
      常驻在 body 末尾的一张小卡片，只有扫过目次时才亮。
      transform 由脚本逐帧写（见 pvTick），这里只管内容与外观。
      aria-hidden：它跟着光标走，读屏用户用不上，目次本身已经把信息读全了。
    -->
    <div
      ref="previewEl"
      class="toc-preview"
      :class="{ 'is-on': previewOn }"
      aria-hidden="true"
      data-pagefind-ignore
    >
      <template v-if="previewPost">
        <div class="toc-preview-cover">
          <img
            v-if="previewPost.cover"
            :src="withBase(previewPost.cover)"
            alt=""
            loading="lazy"
            decoding="async"
          />
          <span v-else class="toc-preview-fallback">{{ previewPost.title.slice(0, 1) }}</span>
        </div>
        <p class="toc-preview-title">{{ previewPost.title }}</p>
        <p class="toc-preview-summary">{{ previewPost.summary }}</p>
        <p class="toc-preview-meta">
          <span>P.{{ pad2(pageOf(previewPost.path)) }}</span>
          <span>{{ categoryLabel(previewPost.category) }}</span>
          <span>{{ previewPost.minutes }} 分</span>
        </p>
      </template>
    </div>
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
 * 这里把画面压一点、提对比，让它变成"夜里还亮着的那幅画"——
 * 以前 brightness(0.55) 压得太狠，整个首屏就是一块黑，什么都看不见；
 * 0.78 保住了山的轮廓和天空的颜色，文字仍靠遮罩保证读得清。
 *
 * 为什么整条选择器都放进 :global()：
 *   主题属性挂在 <html> 上，不在本组件的 DOM 里。如果只把前缀写进 :global()，
 *   后半段 .hero-media 会被 Vue 加上组件哈希，而哈希在 <html> 那一层是没有的，
 *   这条规则就永远匹配不到。
 */
:global([data-theme='neon'] .hero-media) {
  filter: saturate(1.05) brightness(0.78) contrast(1.18);
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
/*
 * 卡组景深：滚进来之前整块平面稍微后仰（rotateX），
 * 滚动进度 --p 由脚本写进元素（见 onScrollFrame），
 * 从 0 走到 1，平面随之立正。窄屏与动效关闭时脚本不写 --p，
 * 默认值 1 = 完全立正，等于没有这一层。
 */
.post-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
  transform: perspective(1400px) rotateX(calc((1 - var(--p, 1)) * 7deg))
    translateZ(calc((1 - var(--p, 1)) * -70px));
  transform-origin: 50% 100%;
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

/* ── 中挿插画页 ─────────────────────────────────────────── */
/*
 * 横向滑动的"夹页"。每一页是一张带纸框的画。
 * 滚动进度 --p（脚本写入）让整条在进场时绕竖轴轻轻侧一下头；
 * hover 时每页按光标位置微微 3D 转动（--tx / --ty 由脚本写）。
 */
.insert-section {
  margin-top: 88px;
}

.insert-kicker {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.insert-strip {
  display: flex;
  gap: 26px;
  overflow-x: auto;
  padding: 26px 4px 10px;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  transform: perspective(1600px) rotateY(calc((1 - var(--p, 1)) * 5deg));
  transform-origin: 0 50%;
}

.insert-strip::-webkit-scrollbar {
  display: none;
}

.insert-page {
  position: relative;
  flex: 0 0 auto;
  scroll-snap-align: start;
  padding: 12px 12px 10px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--surface);
  box-shadow: var(--shadow);
  transform: rotateX(var(--tx, 0deg)) rotateY(var(--ty, 0deg));
  transform-style: preserve-3d;
  transition:
    transform 260ms var(--ease-out),
    box-shadow 260ms var(--ease-out);
}

.insert-page:hover {
  box-shadow: var(--shadow-lift);
}

/* 页脚：页码 + 一句话 */
.insert-caption {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 9px;
}

.insert-no {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.insert-text {
  font-family: var(--font-quote);
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink-soft);
}

/* 胶带：贴在每页左上角，微微歪着 */
.insert-tape {
  position: absolute;
  top: -9px;
  left: 14px;
  z-index: 1;
  padding: 2px 10px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--accent) 24%, white 10%);
  color: color-mix(in srgb, var(--accent-ink) 82%, var(--accent));
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.12em;
  transform: rotate(-4deg);
  opacity: 0.9;
  box-shadow: 0 1px 3px color-mix(in srgb, var(--ink) 18%, transparent);
}

/* 横条两端淡淡化掉，暗示"可以往两边滑" */
@media (min-width: 1024px) {
  .insert-strip {
    mask-image: linear-gradient(to right, transparent, black 3%, black 97%, transparent);
    -webkit-mask-image: linear-gradient(to right, transparent, black 3%, black 97%, transparent);
  }
}

.insert-page img {
  height: clamp(240px, 34vh, 400px);
  width: auto;
  border-radius: 6px;
  background: var(--bg-soft);
  display: block;
}

@media (max-width: 767px) {
  .insert-page img {
    height: 240px;
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

/* ── 目次 ───────────────────────────────────────────────── */
/*
 * 一行一篇：页码 · 标题 · 引导点 · 分类 · 日期。
 * 引导点用 flex + 虚线背景实现，标题多长都能把右边推到边上，
 * 这就是纸质目次的样子。
 */
.contents {
  display: grid;
  /*
   * 必须显式写 minmax(0, 1fr)。
   *
   * 【为什么】
   *   grid 的隐式列是 auto，宽度取"内容的最大宽度"。
   *   目次的标题是 nowrap 的，一长条能把整列撑到 414px，
   *   于是整个 ol 比容器宽，手机上直接横向溢出。
   *   minmax(0, 1fr) 把列宽锁在容器内，多出来的字由 ellipsis 收掉。
   */
  grid-template-columns: minmax(0, 1fr);
  border-top: 1px solid var(--line);
}

.contents-row {
  border-bottom: 1px solid var(--line);
  /* 同理：行本身也不许被里面的 nowrap 标题撑宽 */
  min-width: 0;
}

.row-link {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
  padding: 11px 4px;
  transition:
    background-color var(--t-fast) var(--ease-out),
    padding-left var(--t-fast) var(--ease-out);
}

.row-link:hover {
  background: var(--bg-soft);
  padding-left: 10px;
}

/* ── 目次悬浮预览卡 ─────────────────────────────────────── */
/*
 * 一张跟着光标走的小卡片。
 * 位置 transform 由脚本逐帧写（pvTick），这里只负责外观：
 * 出现/消失用 opacity + scale 的过渡，位移不参与过渡——
 * 位移是缓动追出来的，再叠一层过渡就会糊成一团。
 */
.toc-preview {
  position: fixed;
  top: 0;
  left: 0;
  z-index: var(--z-drawer);
  width: 236px;
  padding: 10px;
  border-radius: var(--r-input);
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  box-shadow: var(--shadow-lift);
  pointer-events: none;
  opacity: 0;
  scale: 0.88;
  transform-origin: 0 100%;
  transition:
    opacity 200ms var(--ease-out),
    scale 220ms var(--ease-out);
}

.toc-preview.is-on {
  opacity: 1;
  scale: 1;
}

.toc-preview-cover {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 8px;
  background: var(--bg-soft);
  display: grid;
  place-items: center;
}

.toc-preview-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.toc-preview-fallback {
  font-family: var(--font-display);
  font-size: 34px;
  color: var(--ink-soft);
  opacity: 0.5;
}

.toc-preview-title {
  margin-top: 9px;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--ink);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.toc-preview-summary {
  margin-top: 4px;
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--ink-soft);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.toc-preview-meta {
  margin-top: 8px;
  padding-top: 7px;
  border-top: 1px dashed var(--line);
  display: flex;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
}

/* 触屏上永不出现（脚本已经拦了，这里再兜一层） */
@media (hover: none), (pointer: coarse) {
  .toc-preview {
    display: none;
  }
}

.row-page {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.row-title {
  flex: 0 1 auto;
  min-width: 0;
  font-size: 14px;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 引导点：一条虚线，把标题和右边隔开 */
.row-leader {
  flex: 1 1 auto;
  min-width: 20px;
  height: 1px;
  margin-bottom: 4px;
  background-image: linear-gradient(
    to right,
    color-mix(in srgb, var(--ink-soft) 40%, transparent) 0 2px,
    transparent 2px 6px
  );
  background-size: 6px 1px;
  background-repeat: repeat-x;
}

.row-cat {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ink-soft);
}

.row-date {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

/* ── 一册的数据 ─────────────────────────────────────────── */
.stats {
  max-width: 720px;
  margin: 0 auto;
  padding: 22px clamp(18px, 3vw, 28px) 20px;
  border: 1px solid var(--line);
  border-radius: var(--r-card);
  background: color-mix(in srgb, var(--surface) 62%, transparent);
}

.stats-kicker {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.stat dt {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ink-soft);
}

.stat dd {
  margin-top: 3px;
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 1.2;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.stats-note {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
  font-family: var(--font-quote);
  font-size: 12px;
  line-height: 1.8;
  color: var(--ink-soft);
}

@media (max-width: 767px) {
  .row-title {
    font-size: 13px;
  }

  .row-cat {
    display: none;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
    gap: 10px;
  }

  .stat dd {
    font-size: 19px;
  }
}
</style>
