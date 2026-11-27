<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, onServerPrefetch } from 'vue'
import { useRoute } from 'vue-router'
import {
  findPost,
  adjacentPosts,
  loadBody,
  buildToc,
  categoryLabel,
} from '@/composables/useContent'
import { useSeo } from '@/composables/useSeo'
import { withBase } from '@/composables/useContent'
import { pageOf, issueOf, pad2, totalPages, markRead } from '@/composables/useBook'
import BackButton from '@/components/ui/BackButton.vue'
import TocSidebar from '@/components/content/TocSidebar.vue'
import TapeLabel from '@/components/ui/TapeLabel.vue'
import WashiDivider from '@/components/ui/WashiDivider.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageTabs from '@/components/content/PageTabs.vue'
import Colophon from '@/components/content/Colophon.vue'
import MarginNotes from '@/components/content/MarginNotes.vue'
import CodeCopy from '@/components/content/CodeCopy.vue'

const props = defineProps<{ year: string; slug: string }>()
const route = useRoute()

const bodyHtml = ref('')
const loading = ref(true)

const post = computed(() => findPost(props.year, props.slug))
const toc = computed(() => buildToc(bodyHtml.value))
const nav = computed(() => (post.value ? adjacentPosts(post.value) : {}))

useSeo({
  title: post.value?.title,
  description: post.value?.summary,
  image: post.value?.cover,
})

async function load() {
  loading.value = true
  bodyHtml.value = ''
  if (post.value) bodyHtml.value = await loadBody(post.value.path)
  loading.value = false
}

onMounted(load)
watch(() => route.fullPath, load)

/**
 * 预渲染时也要把正文灌进去。
 *
 * 【为什么必须有这一句】
 *   vite-ssg 用 SSR 渲染出每个页面的 HTML。如果正文只在 onMounted 里加载，
 *   构建出来的这篇文章就是一个空壳——搜索引擎抓到的是一段加载骨架，
 *   而不是文章内容，等于整站的 SEO 白做。
 *   onServerPrefetch 让构建阶段就把正文取好，HTML 里是真实文字。
 *   浏览器里 onMounted 仍然会跑一次（数据已经在，开销可以忽略）。
 */
onServerPrefetch(async () => {
  if (post.value) bodyHtml.value = await loadBody(post.value.path)
  loading.value = false
})

const dateText = computed(() => post.value?.date.replace(/-/g, '.') ?? '')
const updatedText = computed(() => post.value?.updated?.replace(/-/g, '.') ?? '')

/* ── 页码与读完盖章 ─────────────────────────────────────── */

const pageNo = computed(() => pageOf(post.value?.path ?? ''))
const issueNo = computed(() => issueOf(post.value?.path ?? ''))

/** 文末"本页完"那一行是否已经进入视野 */
const reachedEnd = ref(false)

let endObserver: IntersectionObserver | null = null
/** 兜底用的滚动监听，必须能被 watchEnd / onUnmounted 清掉，否则切换文章时会越积越多 */
let endScrollHandler: (() => void) | null = null

/** 清掉文末检测的所有监听 */
function clearEndWatchers(): void {
  endObserver?.disconnect()
  endObserver = null
  if (endScrollHandler) {
    window.removeEventListener('scroll', endScrollHandler)
    endScrollHandler = null
  }
}

/**
 * 只有滚到文末才盖既読印。
 *
 * 【为什么不在打开页面时就记】
 *   打开 ≠ 读完。如果一进来就标记，卡片上的「既読」会变成
 *   "点过链接"的同义词，那个章就没有任何意义了。
 *
 * 【为什么要等 nextTick】
 *   正文是异步加载的，DOM 里"本页完"这一行要等内容渲染出来才存在。
 *   直接 observe 会拿到 null。
 */
async function watchEnd() {
  clearEndWatchers()
  reachedEnd.value = false

  await nextTick()
  const el = document.querySelector('[data-post-end]')
  if (!el) return

  // 已经滚过去了（比如从锚点进来）：也算读完
  const rect = el.getBoundingClientRect()
  if (rect.top < window.innerHeight) {
    reachedEnd.value = true
    if (post.value) markRead(post.value.path)
    return
  }

  /*
   * 兜底：IntersectionObserver 在后台标签页、部分内嵌 WebView 里可能不回调。
   * 不回调的后果是这个章永远盖不上——比"多盖一次"更糟。
   * 所以同时挂一个滚动监听：用户自己滚到文末时照样盖章。
   */
  endScrollHandler = () => {
    const r = el.getBoundingClientRect()
    if (r.top >= window.innerHeight) return
    reachedEnd.value = true
    if (post.value) markRead(post.value.path)
    clearEndWatchers()
  }
  window.addEventListener('scroll', endScrollHandler, { passive: true })

  endObserver = new IntersectionObserver(
    (entries) => {
      if (!entries[0]?.isIntersecting) return
      reachedEnd.value = true
      if (post.value) markRead(post.value.path)
      // 盖过章就不用再看了
      clearEndWatchers()
    },
    { rootMargin: '0px 0px -8% 0px' },
  )
  endObserver.observe(el)
}

watch([post, loading], () => {
  if (!loading.value && post.value) void watchEnd()
})

onUnmounted(() => {
  clearEndWatchers()
})
</script>

<template>
  <div class="container post-page">
    <!-- 文章不存在：给一个友好的提示而不是白屏 -->
    <EmptyState
      v-if="!post"
      title="找不到这篇文章"
      desc="可能是地址打错了，或者这篇文章已经被我撤下。"
    >
      <RouterLink to="/posts" class="back-link">← 回到文章列表</RouterLink>
    </EmptyState>

    <template v-else>
      <div class="post-layout">
        <!-- ══ 正文列 ══════════════════════════════════════ -->
        <article class="post-article">
          <!-- 页签：贴在右上角的两枚书签，随时能跳上一篇 / 下一篇 -->
          <PageTabs :prev="nav.prev" :next="nav.next" />

          <header class="post-head">
            <BackButton />

            <div class="post-meta-top">
              <TapeLabel tone="accent">{{ categoryLabel(post.category) }}</TapeLabel>
              <TapeLabel v-if="post.sample" tone="warn">SAMPLE 示例内容</TapeLabel>
              <span class="post-folio">
                第 {{ pad2(issueNo) }} 話 · P.{{ pad2(pageNo) }} / {{ pad2(totalPages) }}
              </span>
            </div>

            <h1 class="post-title">{{ post.title }}</h1>

            <p class="post-sub">
              <time :datetime="post.date">{{ dateText }}</time>
              <span v-if="updatedText">· 更新于 {{ updatedText }}</span>
              <span>· {{ post.minutes }} 分钟</span>
            </p>

            <ul v-if="post.tags.length" class="post-tags">
              <li v-for="tag in post.tags" :key="tag">#{{ tag }}</li>
            </ul>
          </header>

          <!-- 封面 -->
          <figure v-if="post.cover" class="post-cover">
            <img
              :src="withBase(post.cover)"
              :alt="`${post.title} 的封面`"
              width="1600"
              height="900"
              fetchpriority="high"
              decoding="async"
            />
          </figure>

          <!-- 正文：HTML 由构建脚本生成，可信来源，故用 v-html -->
          <div class="prose-wrap">
            <div v-if="loading" class="post-loading" aria-hidden="true">
              <span class="loading-bar" />
              <span class="loading-bar" />
              <span class="loading-bar short" />
            </div>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div v-else id="post-body" class="prose" v-html="bodyHtml" />

            <!--
              页边批注：挂在正文右侧的空白里，不占排版宽度。
              内容来自 frontmatter 的 notes 字段，没写就不出现。
            -->
            <MarginNotes v-if="!loading" :notes="post.notes ?? []" target="#post-body" />

            <!-- 代码块右上角的「复制」按钮：脚本挂上去，不占正文结构 -->
            <CodeCopy v-if="!loading" target="#post-body" />
          </div>

          <!--
            文末的「本页完」：既是收尾，也是既読的触发点。
            这一行滚进视野时，才会给这篇文章盖印。
          -->
          <div class="post-end" data-post-end>
            <span class="end-rule" aria-hidden="true" />
            <span class="end-word">本页完</span>
            <span class="end-rule" aria-hidden="true" />
          </div>

          <!-- 余白：读完之后的空白页，一句话就够 -->
          <Colophon :closing="post.closing" />

          <!--
            页码角标：钉在正文列右下角，像实体书页脚。
            只有读完才亮起——没读的章，印章位置是空的。
          -->
          <div class="post-folio-foot">
            <Transition name="stamp">
              <span v-if="reachedEnd" class="folio-stamp">
                <span class="folio-stamp-text">既読</span>
              </span>
            </Transition>
            <span class="folio-num">— {{ pad2(pageNo) }} —</span>
          </div>

          <WashiDivider />

          <!-- 上一篇 / 下一篇 -->
          <!-- data-pagefind-ignore：另一篇文章的标题不属于本页内容 -->
          <nav class="post-nav" aria-label="相邻文章" data-pagefind-ignore>
            <RouterLink v-if="nav.prev" :to="nav.prev.path" class="nav-item">
              <span class="nav-dir">← 上一篇</span>
              <span class="nav-title">{{ nav.prev.title }}</span>
            </RouterLink>
            <span v-else class="nav-item is-empty" />

            <RouterLink v-if="nav.next" :to="nav.next.path" class="nav-item align-end">
              <span class="nav-dir">下一篇 →</span>
              <span class="nav-title">{{ nav.next.title }}</span>
            </RouterLink>
            <span v-else class="nav-item is-empty" />
          </nav>
        </article>

        <!-- ══ 侧边目录 ════════════════════════════════════ -->
        <!-- data-pagefind-ignore：目录是标题的重复，进索引会盖过正文 -->
        <aside v-if="toc.length" class="post-aside" data-pagefind-ignore>
          <TocSidebar :entries="toc" />
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.post-page {
  padding-top: 24px;
}

.post-layout {
  display: grid;
  grid-template-columns: minmax(0, var(--prose-max)) 220px;
  gap: 56px;
  justify-content: center;
  align-items: start;
}

/* 1100px 以下隐藏侧边目录 */
@media (max-width: 1099px) {
  .post-layout {
    grid-template-columns: minmax(0, var(--prose-max));
    gap: 0;
    justify-content: start;
  }

  .post-aside {
    display: none;
  }
}

/* ── 文章头 ─────────────────────────────────────────────── */
.post-head {
  margin-bottom: 34px;
}

.post-meta-top {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 22px;
}

.post-title {
  margin-top: 14px;
  font-family: var(--font-display);
  font-size: clamp(1.85rem, 4.2vw, 2.8rem);
  line-height: 1.24;
  letter-spacing: -0.015em;
}

.post-sub {
  margin-top: 14px;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
}

.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 14px;
  font-size: 12.5px;
  color: var(--accent);
}

/* 页眉里的「第 07 話 · P.08 / 14」 */
.post-folio {
  margin-left: auto;
  align-self: center;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 639px) {
  .post-folio {
    /* 窄屏上标签已经占满一行，页码自己换到下一行左对齐 */
    margin-left: 0;
    flex-basis: 100%;
  }
}

/* ── 文末「本页完」 ─────────────────────────────────────── */
.post-end {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 46px 0 18px;
}

.end-rule {
  flex: 1;
  height: 0;
  border-top: 1px solid var(--ink);
  opacity: 0.28;
}

.end-word {
  flex: 0 0 auto;
  font-family: var(--font-quote);
  font-size: 12.5px;
  letter-spacing: 0.4em;
  /* letter-spacing 会在最后一个字后面也留白，往右挪半格才居中 */
  padding-left: 0.4em;
  color: var(--ink-soft);
}

/* ── 页脚：页码 + 既読章 ───────────────────────────────── */
.post-folio-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  min-height: 44px;
  margin-bottom: 30px;
}

.folio-num {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.14em;
  font-variant-numeric: tabular-nums;
  color: var(--ink-soft);
}

/* 章本体：和 ReadStamp 同一套视觉，但这里要盖下去的动画 */
.folio-stamp {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  border: 1.5px solid var(--stamp-ink);
  border-radius: 50%;
  box-shadow:
    inset 0 0 0 3px var(--surface),
    inset 0 0 0 4px var(--stamp-ink);
  color: var(--stamp-ink);
  opacity: 0.86;
  transform: rotate(-11deg);
  filter: drop-shadow(0 0 0.5px var(--stamp-ink));
}

.folio-stamp-text {
  font-family: var(--font-quote);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  writing-mode: vertical-rl;
  text-orientation: upright;
}

/*
 * 盖章：从大落到原位、透明度淡入。
 * 印章是"砸"下去的，所以用 ease-out 而不是回弹——
 * 真的印章不会回弹，它只是压下、停住、留印。
 */
.stamp-enter-active {
  transition:
    transform 340ms var(--ease-out),
    opacity 240ms var(--ease-out);
}

.stamp-enter-from {
  transform: rotate(-11deg) scale(2.1);
  opacity: 0;
}

/* 减少动效：不出动画，直接出现 */
@media (prefers-reduced-motion: reduce) {
  .stamp-enter-active {
    transition: none;
  }

  .stamp-enter-from {
    transform: rotate(-11deg);
    opacity: 0.86;
  }
}

[data-motion='off'] .stamp-enter-active {
  transition: none;
}

[data-motion='off'] .stamp-enter-from {
  transform: rotate(-11deg);
  opacity: 0.86;
}

/* ── 封面 ───────────────────────────────────────────────── */
.post-cover {
  margin: 0 0 34px;
  border-radius: var(--r-card);
  overflow: hidden;
  border: 1px solid var(--line);
}

.post-cover img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

/* ── 正文加载占位（不是占位图，是加载态） ───────────────── */
/*
 * 批注层要相对正文定位，所以外面套一层 relative 容器。
 * 容器宽度就是正文宽度，批注用 left: calc(100% + 20px) 伸到右边留白里。
 */
.prose-wrap {
  position: relative;
}

.post-loading {
  display: grid;
  gap: 12px;
}

.loading-bar {
  height: 15px;
  border-radius: 4px;
  background: var(--bg-soft);
  animation: bar-pulse 1.1s var(--ease-in-out) infinite;
}

.loading-bar.short {
  width: 62%;
}

@keyframes bar-pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

/* ── 文章底部导航 ───────────────────────────────────────── */
.post-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.nav-item {
  display: grid;
  gap: 6px;
  padding: 16px 18px;
  border-radius: var(--r-input);
  border: 1px solid var(--line);
  background: var(--surface);
  transition:
    border-color var(--t-fast) var(--ease-out),
    transform var(--t-fast) var(--ease-out);
}

.nav-item:not(.is-empty):hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.nav-item.is-empty {
  border-style: dashed;
  background: transparent;
  opacity: 0.4;
}

.nav-item.align-end {
  text-align: right;
}

.nav-dir {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
}

.nav-title {
  font-size: 14px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 639px) {
  .post-nav {
    grid-template-columns: 1fr;
  }

  .nav-item.is-empty {
    display: none;
  }
}

.back-link {
  font-size: 14px;
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
