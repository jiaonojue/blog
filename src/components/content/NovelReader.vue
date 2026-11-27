<script setup lang="ts">
/**
 * 在线小说 —— 摸鱼分区里那一块能真的翻页的阅读器。
 *
 * 【翻页是怎么做的】
 *   不是"滚一屏"，是真的分页：正文用 CSS 多列（column）排，一列就是一页，
 *   列宽 = 可视区宽度。翻页时整条列阵横向平移一列的距离，
 *   于是页与页之间只会在"行与行之间"断开，不会把一行字劈成两半。
 *   总页数也是量出来的：scrollWidth ÷（列宽 + 列间距）。
 *
 *   竖排时不用多列。writing-mode: vertical-rl 自己就会从右往左排竖行，
 *   一屏正好是一页，只是平移方向反过来（往右移才是"下一页"）。
 *
 * 【为什么上下两条工具条默认藏着】
 *   纸面上不该一直压着两条工具栏。默认只留纸和页码，
 *   点纸面中间唤出工具条，点两侧翻页，键盘 ← → 也能翻。
 *   这样一屏里能多出近一百像素的正文高度。
 *
 * 【正文从哪来】
 *   npm run novel 会把 EPUB 拆成 public/novels/<slug>/ 下的
 *   index.json + ch-N.html + img/。这个组件运行时 fetch 它们，
 *   不经过 Vite 打包 —— 全文有 6 万多字，打进 JS 包会让首屏重几百 KB。
 *
 *   正文是跟着仓库一起上线的（你明确要求），所以线上也读得到。
 *   但 fetch 失败的情况仍然要兜：换一本书、或者哪天把 public/novels/
 *   删了，这里会显示"这本书只在本地版本里"，而不是一个红色报错。
 *
 * 【为什么正文用 --font-body 而不是 --font-quote】
 *   站点的楷体（LXGW WenKai）只子集化了站内用到的字，几千个。
 *   小说有六万多字，用楷体的话绝大部分字会掉回后备字体，
 *   结果是一句话里一半楷体一半黑体，比统一用系统字体难看得多。
 *   UI 标签（目录、上一章）的字是固定的，确定在子集里，可以用 --font-display。
 *
 * 【进度存在哪】
 *   localStorage 的 'site:novel:v1'，按书分键。
 *   只存章节号和"读到这一章的百分之几"，没有任何别的信息。
 *   存比例而不是页码：字号一变页数就变了，存页码会跳到别处。
 *
 * 【为什么竖排只在桌面】
 *   竖排需要给每一行留出固定宽度，手机上 375px 减去内边距只剩 340，
 *   竖排时一行只能放十来个字，读起来像在数格子。
 *   而且移动端浏览器对 writing-mode 下的滚动锚点支持并不一致。
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { ArrowLeft, ArrowRight, BookOpen } from '@lucide/vue'
import { site } from '@/data/site.config'

/** 一本书的索引结构，和 build-novel.mjs 的输出一一对应 */
interface Chapter {
  no: number
  title: string
  file: string
  chars: number
}
interface BookIndex {
  slug: string
  title: string
  authors: string[]
  language: string
  cover: string | null
  chapters: Chapter[]
  totalChars: number
}

const props = withDefaults(
  defineProps<{
    /** 书的短名，对应 public/novels/<slug>/ */
    slug?: string
  }>(),
  { slug: 'eromanga-13' },
)

function base(path: string): string {
  const b = site.base.endsWith('/') ? site.base.slice(0, -1) : site.base
  return `${b}${path.startsWith('/') ? path : `/${path}`}`
}

const bookDir = computed(() => base(`/novels/${props.slug}`))

/* ── 状态 ───────────────────────────────────────────────── */

const index = ref<BookIndex | null>(null)
const loading = ref(true)
/** 这本书在本地构建过吗。false = 线上没带正文，不是错误 */
const missing = ref(false)
const loadError = ref('')

const currentNo = ref(1)
const chapterHtml = ref('')
const chapterLoading = ref(false)

/** 已读过的章节正文，避免来回翻时重复请求 */
const htmlCache = new Map<number, string>()

/** 字号三档 */
const FONT_SIZES = [16, 17.5, 19] as const
const fontStep = ref(1)
const fontPx = computed(() => FONT_SIZES[fontStep.value] ?? 16.5)

/** 纸色 / 夜间 */
const night = ref(false)

/** 竖排：只在桌面开，默认关 */
const vertical = ref(false)
const wideEnough = ref(false)

/** 章节目录抽屉 */
const tocOpen = ref(false)
/** 上下工具条 */
const chromeOpen = ref(false)

/** 第一次翻开时给的提示，翻一页就收掉 */
const hint = ref(false)
let hintTimer = 0
let hintShown = false

const hasPrev = computed(() => currentNo.value > 1)
const hasNext = computed(
  () => !!index.value && currentNo.value < (index.value.chapters.length ?? 0),
)

/* ── 分页 ───────────────────────────────────────────────── */

const viewport = ref<HTMLElement | null>(null)
const flow = ref<HTMLElement | null>(null)

/** 当前最左边那一列的序号（0 起） */
const page = ref(0)
/** 一共多少列 */
const pageCount = ref(1)
const pageW = ref(0)
const pageGap = ref(0)
/** 一页的净高度（扣掉内边距），由 measure() 实测后写回 CSS */
const pageH = ref(0)
/** 一屏放几列：宽屏对开两列，窄屏一列 */
const perView = ref(1)
/** 重排期间关掉平移动画，免得尺寸变化被看成翻页 */
const animOn = ref(true)

let settleTimer = 0
function quiet() {
  animOn.value = false
  window.clearTimeout(settleTimer)
  settleTimer = window.setTimeout(() => (animOn.value = true), 90)
}

/**
 * 量一次：可视区多宽、正文被排成了几列。
 *
 * 【为什么宽屏要两列】
 *   一列 600 多字宽在 1200px 的纸上是浪费，单页读起来像网页。
 *   宽屏排两列、一屏摊开两页，才是书的样子：视线从左页走到右页，
 *   翻页时整对翻过去。窄屏（<880px）放不下两列，就退回单页。
 *
 * 【为什么先写 --page-w 再读 scrollWidth】
 *   写变量不会立刻重排，但紧接着读 scrollWidth 会强制浏览器先排一次，
 *   所以拿到的一定是"按新列宽排完之后"的宽度，不会差一帧。
 */
function measure() {
  const vp = viewport.value
  const el = flow.value
  if (!vp || !el) return

  const cs = getComputedStyle(vp)
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
  const w = vp.clientWidth - padX
  const h = vp.clientHeight - padY
  /*
   * 量不到就什么都不做，尤其不能把 --page-h 写成 0。
   * 写成 0 之后图片的 max-height 变成负数，整章会排成一列碎字，
   * 而且这个坏值会一直留着，直到下一次成功测量。
   */
  if (w <= 0 || h <= 0) return

  /*
   * 把"这一页到底有多高"写回 --page-h。
   * 图片的 max-height 和竖排的高度都引用它，
   * 所以必须先定下来再量列数，否则图片会按错的页高算。
   */
  if (Math.abs(h - pageH.value) > 1) {
    pageH.value = h
    el.style.setProperty('--page-h', `${h}px`)
  }

  // 竖排不靠多列，永远是单页
  const gap = vertical.value ? 0 : parseFloat(getComputedStyle(el).columnGap) || 0
  pageGap.value = gap

  // 够宽就摊两页。620px 是单页的舒适宽度，两页 + 书缝 ≈ 1290px
  const canSpread = !vertical.value && w >= 880
  perView.value = canSpread ? 2 : 1

  const colW = canSpread ? (w - gap) / 2 : w
  pageW.value = colW
  el.style.setProperty('--page-w', `${colW}px`)

  const step = colW + gap
  pageCount.value = Math.max(1, Math.round((el.scrollWidth + gap) / step))

  // 保证 page 落在某一"屏"的左边缘，并且不越过最后一屏
  const maxPage = Math.max(0, (Math.ceil(pageCount.value / perView.value) - 1) * perView.value)
  if (page.value > maxPage) page.value = maxPage
  if (page.value % perView.value !== 0) page.value -= page.value % perView.value
}

/**
 * 排一次版，排不出来就过一会儿再试。
 *
 * 【为什么需要重试】
 *   阅读器是懒挂载的：它出现的那一帧，父级可能还在从"骨架"换成真内容，
 *   可视区量出来是 0×0，measure() 直接返回，之后就再没人叫它了。
 *   桌面上 ResizeObserver 会兜住（宽度变化会回调），但它在元素首次可见前
 *   不一定回调；手机上更常出现"整本书只有 1 页、翻不动"。
 *
 * 【为什么用 setTimeout 而不是 requestAnimationFrame】
 *   rAF 依赖"浏览器要画下一帧"。标签页在后台、或者浏览器判定没有可见变化时，
 *   rAF 会被推迟甚至不触发，重试链就断在第一步。
 *   setTimeout 不受这个影响，间隔 40ms 也足够等布局稳定。
 */
let retryTimer = 0
function scheduleMeasure(after?: () => void, tries = 12) {
  window.clearTimeout(retryTimer)
  const attempt = (left: number) => {
    retryTimer = window.setTimeout(() => {
      const vp = viewport.value
      if (!vp || vp.clientWidth <= 0) {
        // 还没排进布局，再等一轮
        if (left > 0) attempt(left - 1)
        return
      }
      measure()
      // 量完还是没排出列宽，说明父级尺寸还在变，再补一次
      if (!pageW.value && left > 0) {
        attempt(left - 1)
        return
      }
      after?.()
    }, 40)
  }
  attempt(tries)
}

/** 重排后按比例回到原来的位置（字号、竖排、窗口变化都走这里） */
function repaginate(ratio?: number) {
  const views = Math.max(1, Math.ceil(pageCount.value / perView.value))
  const view = page.value / perView.value
  const r = ratio ?? (views > 1 ? view / (views - 1) : 0)
  quiet()
  measure()
  const nextViews = Math.max(1, Math.ceil(pageCount.value / perView.value))
  page.value = Math.round(r * (nextViews - 1)) * perView.value
}

/** 整条列阵平移。横向往左，竖排往右 */
const flowStyle = computed<Record<string, string>>(() => {
  const w = pageW.value
  const shift = !w ? 0 : vertical.value ? page.value * w : -page.value * (w + pageGap.value)
  return {
    transform: `translateX(${shift}px)`,
    '--reader-font': `${fontPx.value}px`,
  }
})

/** 当前这一屏显示第几到第几页（人看的页码，从 1 起） */
const pageLabel = computed(() => {
  const from = page.value + 1
  const to = Math.min(pageCount.value, page.value + perView.value)
  return from >= to ? `${from}` : `${from}–${to}`
})

/** 读完的比例，用于书口那条线 */
const bookProgress = computed(() => {
  const idx = index.value
  if (!idx || !idx.totalChars) return 0
  const last = Math.max(1, pageCount.value - 1)
  const inChapter = Math.min(1, page.value / last)
  let before = 0
  let cur = 0
  for (const c of idx.chapters) {
    if (c.no < currentNo.value) before += c.chars
    else if (c.no === currentNo.value) cur = c.chars
  }
  return Math.min(1, (before + cur * inChapter) / idx.totalChars)
})

function turn(delta: number) {
  hint.value = false
  const target = page.value + delta * perView.value

  // 翻过本章的边界就顺到相邻章：书本来就是连着的
  if (target < 0) {
    if (hasPrev.value) void goChapter(currentNo.value - 1, 1)
    return
  }
  if (target > pageCount.value - 1) {
    if (hasNext.value) void goChapter(currentNo.value + 1, 0)
    return
  }

  page.value = target
  saveProgress()
}

/* ── 进度存档 ───────────────────────────────────────────── */

const STORAGE_KEY = 'site:novel:v1'

interface Saved {
  no: number
  ratio: number
}

function saveProgress() {
  if (!index.value) return
  const views = Math.max(1, Math.ceil(pageCount.value / perView.value))
  const view = page.value / perView.value
  const ratio = views > 1 ? view / (views - 1) : 0
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Saved>
    all[props.slug] = { no: currentNo.value, ratio }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* 隐私模式下写不进去，本轮仍然能读 */
  }
}

function readSaved(): Saved | null {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Saved>
    const hit = all[props.slug]
    if (hit && Number.isInteger(hit.no) && hit.no > 0) return hit
  } catch {
    /* 数据坏了就当没存过 */
  }
  return null
}

/* ── 加载 ───────────────────────────────────────────────── */

/**
 * 把章节 HTML 里的相对图片路径改成绝对路径。
 *
 * 【为什么必须改】
 *   章节文件里写的是 `src="img/07.webp"`，这是相对 ch-N.html 的位置。
 *   但我们是用 v-html 把这段 HTML 插进首页的 DOM 里，
 *   浏览器的相对路径是相对"当前页面地址"（/blog/）解析的，
 *   于是会去请求 /blog/img/07.webp —— 404，图全裂。
 *   改成 `${bookDir}/img/07.webp`（带 /blog/ 前缀）就对了。
 *
 * 只动 src 和 href 里以 img/ 开头的，别的都不碰。
 */
function absolutize(html: string): string {
  return html.replace(/\b(src|href)="img\//g, `$1="${bookDir.value}/img/`)
}

async function loadIndex() {
  loading.value = true
  missing.value = false
  loadError.value = ''

  try {
    const res = await fetch(`${bookDir.value}/index.json`)
    if (res.status === 404) {
      missing.value = true
      return
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as BookIndex
    if (!data.chapters?.length) throw new Error('empty')
    index.value = data

    const saved = readSaved()
    const max = data.chapters.length
    /*
     * 第一次打开时跳过第 1 节（彩页 · 目录）。
     * 那一节只有几张图和一个目录页，作为"开始读"的落点很别扭；
     * 有存档就按存档来，别覆盖用户自己的位置。
     */
    const firstReadable = data.chapters.find((c) => c.chars > 200)?.no ?? 1
    const startNo = saved ? Math.min(Math.max(1, saved.no), max) : firstReadable
    await goChapter(startNo, saved?.ratio ?? 0)
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function goChapter(no: number, restoreRatio = 0) {
  if (!index.value) return
  const chapter = index.value.chapters.find((c) => c.no === no)
  if (!chapter) return

  currentNo.value = no
  tocOpen.value = false
  chapterLoading.value = true

  let html = htmlCache.get(no)
  if (!html) {
    try {
      const res = await fetch(`${bookDir.value}/${chapter.file}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      html = absolutize(await res.text())
      htmlCache.set(no, html)
    } catch (err) {
      if (currentNo.value === no) {
        chapterHtml.value = `<p>这一章没取到（${err instanceof Error ? err.message : '未知错误'}）。</p>`
        chapterLoading.value = false
      }
      return
    }
  }

  // 请求期间用户可能已经翻走了，别把旧内容盖上去
  if (currentNo.value !== no) return

  chapterHtml.value = html
  chapterLoading.value = false

  // 等 DOM 换成新章节，再量页数
  await nextTick()
  quiet()
  /*
   * 量完再落位置：页数依赖列宽，列宽是量出来的。
   * 反过来（先按旧页数算位置再量）会让"读到 60%"变成"读到第 1 页"。
   */
  scheduleMeasure(() => {
    const views = Math.max(1, Math.ceil(pageCount.value / perView.value))
    page.value = Math.round(restoreRatio * (views - 1)) * perView.value
  })

  watchImages()
  saveProgress()

  watchImages()
  saveProgress()

  if (!hintShown) {
    hintShown = true
    hint.value = true
    window.clearTimeout(hintTimer)
    hintTimer = window.setTimeout(() => (hint.value = false), 8000)
  }
}

/*
 * 图片是懒加载的：刚插进 DOM 时还没有尺寸，量出来的页数会偏少。
 * 每张图落地都重新量一次，按当前比例回到原处。
 */
let imgTimer = 0
function watchImages() {
  const el = flow.value
  if (!el) return
  el.querySelectorAll('img').forEach((img) => {
    if (img.complete) return
    img.addEventListener(
      'load',
      () => {
        window.clearTimeout(imgTimer)
        imgTimer = window.setTimeout(() => repaginate(), 60)
      },
      { once: true },
    )
  })
}

/* ── 交互 ───────────────────────────────────────────────── */

function onPaperClick(e: MouseEvent) {
  // 目录开着时，点纸面只是把它收起来
  if (tocOpen.value) {
    tocOpen.value = false
    return
  }

  // 正在划选文字就不要翻页
  const sel = window.getSelection()
  if (sel && !sel.isCollapsed) return

  const vp = viewport.value
  if (!vp) return
  const rect = vp.getBoundingClientRect()
  const x = e.clientX

  // 竖排时"下一页"在左边
  const nextDir = vertical.value ? -1 : 1

  if (x < rect.left) return turn(-nextDir)
  if (x > rect.right) return turn(nextDir)

  const rel = (x - rect.left) / rect.width
  if (rel < 0.16) turn(-nextDir)
  else if (rel > 0.84) turn(nextDir)
  else chromeOpen.value = !chromeOpen.value
}

function onKey(e: KeyboardEvent) {
  const nextDir = vertical.value ? -1 : 1

  if (e.key === 'ArrowRight' || e.key === 'PageDown') {
    e.preventDefault()
    turn(nextDir)
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault()
    turn(-nextDir)
  } else if (e.key === 'Escape') {
    chromeOpen.value = false
    tocOpen.value = false
  }
}

function bumpFont(delta: number) {
  const next = Math.min(FONT_SIZES.length - 1, Math.max(0, fontStep.value + delta))
  if (next === fontStep.value) return
  const views = Math.max(1, Math.ceil(pageCount.value / perView.value))
  const ratio = views > 1 ? page.value / perView.value / (views - 1) : 0
  fontStep.value = next
  void nextTick(() => repaginate(ratio))
}

function toggleVertical() {
  const views = Math.max(1, Math.ceil(pageCount.value / perView.value))
  const ratio = views > 1 ? page.value / perView.value / (views - 1) : 0
  vertical.value = !vertical.value
  void nextTick(() => repaginate(ratio))
}

/* ── 尺寸监听：竖排只在 ≥1024px 可用 ─────────────────────── */

let mql: MediaQueryList | null = null
let ro: ResizeObserver | null = null

function syncWide(e?: MediaQueryListEvent) {
  wideEnough.value = e ? e.matches : (mql?.matches ?? false)
  if (!wideEnough.value && vertical.value) toggleVertical()
}

watch(viewport, (el) => {
  ro?.disconnect()
  if (el) ro?.observe(el)
})

onMounted(async () => {
  mql = window.matchMedia('(min-width: 1024px)')
  syncWide()
  mql.addEventListener('change', syncWide)

  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      if (index.value) repaginate()
    })
    // 可视区可能还没渲染出来（章节在 fetch），watch 会在它出现时补挂
    if (viewport.value) ro.observe(viewport.value)
  }

  await loadIndex()
})

onUnmounted(() => {
  mql?.removeEventListener('change', syncWide)
  ro?.disconnect()
  ro = null
  window.clearTimeout(retryTimer)
  window.clearTimeout(settleTimer)
  window.clearTimeout(imgTimer)
  window.clearTimeout(hintTimer)
  saveProgress()
})

// 换书（理论上只有一个，但留着不亏）
watch(
  () => props.slug,
  () => {
    htmlCache.clear()
    index.value = null
    void loadIndex()
  },
)

/** 章节目录里显示的进度标记 */
function isCurrent(no: number): boolean {
  return no === currentNo.value
}
</script>

<template>
  <div
    class="reader"
    :class="{ 'is-night': night, 'is-vertical': vertical }"
    tabindex="0"
    role="region"
    aria-label="在线小说阅读器"
    @keydown="onKey"
  >
    <!-- 书口的进度线：2px，不挡字 -->
    <div class="reader-bar" aria-hidden="true">
      <span class="reader-bar-fill" :style="{ transform: `scaleX(${bookProgress})` }" />
    </div>

    <!-- 这一本书的正文不在（没构建，或者被删掉了） -->
    <div v-if="missing" class="reader-notice">
      <BookOpen :size="18" :stroke-width="1.7" aria-hidden="true" />
      <div>
        <p class="notice-title">这一册不在架上</p>
        <p class="notice-text">
          正文是构建时从 EPUB 拆出来的，本地跑一次
          <code>npm run novel</code>
          就有了。
        </p>
      </div>
    </div>

    <p v-else-if="loadError" class="reader-notice">正文没加载出来：{{ loadError }}</p>
    <p v-else-if="loading" class="reader-notice">正在翻书……</p>

    <!-- 纸面 -->
    <div
      v-else-if="index"
      class="reader-body"
      :class="{ 'is-spread': perView === 2 }"
      @click="onPaperClick"
    >
      <!-- 对开时中间那条书缝：一道极淡的暗线，两侧各一层柔光 -->
      <span v-if="perView === 2" class="gutter" aria-hidden="true" />

      <div ref="viewport" class="reader-viewport">
        <div ref="flow" class="reader-flow" :class="{ 'no-anim': !animOn }" :style="flowStyle">
          <article v-if="chapterLoading" class="reader-prose">正在取这一节……</article>
          <!-- 章节 HTML 由 build-novel.mjs 白名单清洗过，故可用 v-html -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <article v-else class="reader-prose" v-html="chapterHtml" />
        </div>
      </div>

      <!-- 页码：书页自己的东西，一直留着 -->
      <span v-if="!chromeOpen" class="page-no">{{ pageLabel }} / {{ pageCount }}</span>

      <!-- 第一次翻开时的提示 -->
      <Transition name="hint">
        <p v-if="hint && !chromeOpen" class="page-hint">点两侧翻页 · 点中间唤出工具条</p>
      </Transition>

      <!-- 书签舌：比工具栏更像书 -->
      <button
        type="button"
        class="bookmark"
        :aria-label="tocOpen ? '收起目录' : '打开目录'"
        :aria-expanded="tocOpen"
        @click.stop="tocOpen = !tocOpen"
      >
        <BookOpen :size="13" :stroke-width="1.8" aria-hidden="true" />
      </button>

      <!-- 目录抽屉 -->
      <nav class="toc-drawer" :class="{ open: tocOpen }" aria-label="章节目录" @click.stop>
        <div class="drawer-head">
          <p class="drawer-kicker">contents</p>
          <p class="drawer-title">{{ index.title }}</p>
          <p class="drawer-byline">
            {{ index.authors.join(' / ') || '未署名' }} · {{ index.chapters.length }} 节 ·
            {{ Math.round(index.totalChars / 1000) }}k 字
          </p>
        </div>
        <ol class="toc-list">
          <li v-for="c in index.chapters" :key="c.no">
            <button
              type="button"
              class="toc-item"
              :class="{ 'is-current': isCurrent(c.no) }"
              :aria-current="isCurrent(c.no) ? 'true' : undefined"
              @click="goChapter(c.no)"
            >
              <span class="toc-no">{{ String(c.no).padStart(2, '0') }}</span>
              <span class="toc-name">{{ c.title }}</span>
            </button>
          </li>
        </ol>
      </nav>

      <!-- 顶部工具条 -->
      <header class="chrome chrome-top" :class="{ open: chromeOpen }" @click.stop>
        <div class="chrome-id">
          <p class="chrome-kicker">reading</p>
          <p class="chrome-title">{{ index.title }}</p>
        </div>
        <div class="chrome-ctrl">
          <button type="button" class="ctrl-btn ctrl-wide" @click="tocOpen = !tocOpen">目录</button>
          <div class="ctrl-group" role="group" aria-label="字号">
            <button
              type="button"
              class="ctrl-btn ctrl-btn--font"
              :disabled="fontStep === 0"
              aria-label="缩小字号"
              @click="bumpFont(-1)"
            >
              小
            </button>
            <button
              type="button"
              class="ctrl-btn ctrl-btn--font"
              :disabled="fontStep === FONT_SIZES.length - 1"
              aria-label="放大字号"
              @click="bumpFont(1)"
            >
              大
            </button>
          </div>
          <button
            type="button"
            class="ctrl-btn ctrl-wide"
            :aria-label="night ? '切换到纸色（浅色）' : '切换到夜间（深色）'"
            :title="night ? '切换到纸色' : '切换到夜间'"
            @click="night = !night"
          >
            {{ night ? '纸色' : '夜间' }}
          </button>
          <button
            v-if="wideEnough"
            type="button"
            class="ctrl-btn ctrl-wide"
            :aria-pressed="vertical"
            @click="toggleVertical"
          >
            竖排
          </button>
        </div>
      </header>

      <!-- 底部工具条 -->
      <footer class="chrome chrome-bottom" :class="{ open: chromeOpen }" @click.stop>
        <button
          type="button"
          class="foot-btn"
          :disabled="!hasPrev"
          @click="goChapter(currentNo - 1, 0)"
        >
          <ArrowLeft :size="14" :stroke-width="2" aria-hidden="true" />
          上一章
        </button>
        <span class="foot-pos">
          第 {{ currentNo }} 节 / 共 {{ index.chapters.length }} 节 · {{ pageLabel }}/{{
            pageCount
          }}
          页
        </span>
        <button
          type="button"
          class="foot-btn"
          :disabled="!hasNext"
          @click="goChapter(currentNo + 1, 0)"
        >
          下一章
          <ArrowRight :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
/*
 * 阅读器自己定义一套局部变量，然后把 --paper / --text 这类名字
 * 在下面统一使用。这样切夜间只要换一组值，不用在几十条规则里改颜色。
 */
.reader {
  --paper: var(--reader-paper);
  --paper-hi: var(--reader-paper-hi);
  --text: var(--reader-ink);
  --text-soft: var(--reader-ink-soft);
  --rule: var(--reader-line);
  --mark: var(--reader-accent);
  /*
   * 外壳（工具条、目录抽屉）的颜色。
   *
   * 【为什么不借站点的 --surface】
   *   试过 --surface，结果站点切到霓虹主题时外壳变成深色，
   *   而纸色模式下正文字还是深墨色——头部标题直接看不见了。
   *   阅读器必须完全自洽：外壳从自己的纸色派生，跟站点主题无关。
   *   这样无论站点是哪套主题，阅读器里永远是"一张纸 + 一圈稍深的纸边"。
   */
  --chrome: color-mix(in srgb, var(--paper) 86%, var(--text) 8%);

  /*
   * 一页的高度。
   *
   * 【为什么要在 JS 里算，而不是写死 vh】
   *   阅读器被放进附录的卡片里，能有多高取决于卡片有多高，
   *   而卡片高度又由视口决定 —— 用 CSS 变量估一个值，
   *   估大了正文会被卡片裁掉，估小了页面下半截空着。
   *   measure() 里会读视口的实际内容高度，写回这个变量。
   *   这里的 480px 只是首帧的占位，用户看不到。
   */
  --page-h: 480px;

  display: flex;
  flex-direction: column;
  border: 1px solid var(--rule);
  border-radius: var(--r-card);
  background: var(--paper);
  overflow: hidden;
  outline: none;
  /* 撑满卡片；正文区自己再去分配剩下的高度 */
  height: 100%;
  min-height: 0;
  /*
   * 纸色 ↔ 夜间：整块纸淡过去，不是翻面。
   *
   * 【为什么在这里写，而不是靠 tokens.css 那条】
   *   那条管的是站点主题（data-theme / data-zone）换变量。
   *   阅读器的纸色是组件自己的状态（night 这个 ref），
   *   换的是 .reader 上这一组局部变量，得由它自己声明过渡。
   *   --paper 这些已经在 tokens.css 里登记成颜色类型，
   *   所以这里可以直接对变量名做 transition。
   */
  transition:
    --paper 460ms var(--ease-in-out),
    --paper-hi 460ms var(--ease-in-out),
    --text 460ms var(--ease-in-out),
    --text-soft 460ms var(--ease-in-out),
    --rule 460ms var(--ease-in-out),
    --mark 460ms var(--ease-in-out),
    background-color 460ms var(--ease-in-out),
    border-color 460ms var(--ease-in-out);
}

.reader:focus-visible {
  box-shadow: 0 0 0 2px var(--mark);
}

.reader.is-night {
  --paper: var(--reader-night);
  --paper-hi: var(--reader-night-hi);
  --text: var(--reader-night-ink);
  --text-soft: var(--reader-night-soft);
  --rule: var(--reader-night-line);
  --mark: var(--reader-night-accent);
  /* 夜间外壳比纸面亮一点点，不然整块糊成一片 */
  --chrome: color-mix(in srgb, var(--paper) 80%, var(--text) 13%);
}

/* ── 书口进度线 ─────────────────────────────────────────── */
.reader-bar {
  flex: 0 0 auto;
  height: 2px;
  background: var(--rule);
}

.reader-bar-fill {
  display: block;
  height: 100%;
  background: var(--mark);
  transform-origin: left center;
  transition: transform 160ms linear;
}

/* ── 纸面 ───────────────────────────────────────────────── */
.reader-body {
  position: relative;
  /* 剩下的高度全给正文：阅读器是纵向 flex，头部和进度线先占位 */
  flex: 1 1 auto;
  min-height: 0;
  /*
   * 纸面不是一块平涂的白。
   *
   * 【为什么加这层渐变】
   *   平涂的纸色贴在深色卡片上，边界是一道生硬的直线，
   *   看起来像"一个白色面板"而不是"一页纸"。
   *   给左上角一点更亮的光（--paper-hi），往右下自然落到纸色，
   *   纸就有了"被灯照着"的方向感，和整站的暖纸调接得上。
   *   渐变极淡（两个值只差一点点），不会干扰阅读——
   *   它的作用是让边缘不那么硬，不是让人看见渐变。
   *
   * 【夜间怎么办】
   *   夜间 --paper-hi 比 --paper 亮一档，同一个渐变就变成
   *   "暗处有一点微光"，而不是把深色纸刷成一块死黑。
   */
  background: radial-gradient(
    120% 100% at 18% 0%,
    var(--paper-hi) 0%,
    var(--paper) 58%,
    var(--paper) 100%
  );
  overflow: hidden;
  cursor: default;
}

/*
 * 书缝。
 * 对开时中间那 44px 的列间距看起来还是"两个盒子并排"；
 * 压一条由浅到深的渐变阴影进去，才像装订起来的书脊凹处。
 * 宽度跟着 --page-gap 走，翻页时它不动，视觉上像整本书在转。
 */
.gutter {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 60px;
  transform: translateX(-50%);
  pointer-events: none;
  background: linear-gradient(
    to right,
    transparent 0%,
    color-mix(in srgb, var(--text) 5%, transparent) 34%,
    color-mix(in srgb, var(--text) 9%, transparent) 50%,
    color-mix(in srgb, var(--text) 5%, transparent) 66%,
    transparent 100%
  );
}

/*
 * 正文视口。
 *
 * 【为什么 max-width 是 1320px】
 *   宽屏要对开摊两页，每页 620px + 中间书缝 44px ≈ 1284。
 *   窄屏时列宽自动退回一整条，这个上限不生效。
 *   两侧留白就是书的页边距。
 *
 * 【为什么左右内边距不对称】
 *   左页靠装订边、右页靠书口，两者本来就该不同；
 *   但对开之后每页两侧都有字，所以这里取对称值，
 *   真正的不对称交给中间那条书缝去表现。
 */
.reader-viewport {
  box-sizing: border-box;
  height: 100%;
  max-width: 1320px;
  margin-inline: auto;
  padding: clamp(28px, 4.5vh, 42px) clamp(24px, 3.4vw, 46px);
  overflow: hidden;
}

/*
 * 多列排版。column-width 由 JS 量出来后写进 --page-w，
 * 保证"一列正好等于一页正文的宽度"。
 * column-fill: auto —— 装满一列再开下一列，这是分页的关键。
 *
 * column-gap 就是书缝：44px 里放得下一条装订阴影，
 * 又不会宽到让左右两页失去联系。
 */
.reader-flow {
  height: 100%;
  column-width: var(--page-w, 100%);
  column-gap: 44px;
  column-fill: auto;
  transition: transform 300ms var(--ease-out);
  will-change: transform;
}

.reader-flow.no-anim {
  transition: none;
}

/* 竖排：不要多列，writing-mode 自己会从右往左排 */
.is-vertical .reader-flow {
  column-width: auto;
  column-gap: 0;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.reader-prose {
  /*
   * 必须用 --font-body。理由见组件顶部注释：
   * 楷体只子集化了站内用字，小说用它会导致大面积掉字。
   */
  font-family: var(--font-body);
  font-size: var(--reader-font, 17.5px);
  line-height: 2;
  color: var(--text);
  /* 中文正文两端对齐会拉出难看的字距，左对齐更耐读 */
  text-align: left;
  /*
   * 字距和词距各给一点。
   * 中文字体默认排满 em 框，密排时字挤在一起；
   * 0.02em 只是把每个字推开一丝，整段立刻松下来。
   */
  letter-spacing: 0.02em;
}

.is-vertical .reader-prose {
  line-height: 1.9;
  text-align: justify;
  letter-spacing: 0.04em;
}

/* 正文内部的排版。这些标签来自白名单，不会出现别的 */
.reader-prose :deep(p) {
  margin: 0 0 0.55em;
  text-indent: 2em;
}

/* 段落之间只留半行：中文小说靠首行缩进分段，不需要空行 */
.is-vertical .reader-prose :deep(p) {
  margin: 0 0 0 0.55em;
}

.reader-prose :deep(h1),
.reader-prose :deep(h2),
.reader-prose :deep(h3) {
  margin: 0.4em 0 0.7em;
  font-family: var(--font-body);
  font-size: 1.15em;
  font-weight: 700;
  line-height: 1.5;
  text-indent: 0;
}

/* 第一章的标题是章节开头，上面不用再留白 */
.reader-prose :deep(h1:first-child),
.reader-prose :deep(h2:first-child),
.reader-prose :deep(h3:first-child) {
  margin-top: 0;
}

.reader-prose :deep(h1 p),
.reader-prose :deep(h2 p),
.reader-prose :deep(h3 p) {
  margin: 0;
  text-indent: 0;
}

.reader-prose :deep(img) {
  display: block;
  max-width: 100%;
  /*
   * 图不能高过一页，否则会把整页撑破。
   * 留 40px 是给段间距和"下一段可能起在同一列"的余量：
   * 减太多会把图压得很小，减太少会让图片后面的文字挤到下一页。
   */
  max-height: calc(var(--page-h, 420px) - 40px);
  height: auto;
  width: auto;
  object-fit: contain;
  margin: 0 auto 0.6em;
}

.is-vertical .reader-prose :deep(img) {
  max-width: none;
  max-height: 100%;
}

/*
 * 夜间模式下的插图压一点亮度。
 *
 * 【为什么】
 *   漫画页本身就是白纸黑线，在深色纸面上是一块刺眼的白。
 *   整页翻过去时眼睛会猛地一缩，读两页就累。
 *   压到 0.82 之后它还是"白纸"，但不再比正文亮那么多。
 *   不用 invert：反色会把线稿变成照片底片，认不出画的是什么。
 */
.is-night .reader-prose :deep(img) {
  filter: brightness(0.82) contrast(0.96);
}

.reader-prose :deep(.right) {
  text-align: right;
}

.reader-prose :deep(.center) {
  text-align: center;
}

.reader-prose :deep(.illus) {
  text-align: center;
  text-indent: 0;
}

/* ── 页码与提示 ─────────────────────────────────────────── */
.page-no {
  position: absolute;
  bottom: 9px;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  color: var(--text-soft);
  opacity: 0.55;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.page-hint {
  position: absolute;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  padding: 5px 13px;
  border-radius: var(--r-pill);
  border: 1px solid var(--rule);
  background: color-mix(in srgb, var(--chrome) 94%, transparent);
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-soft);
  white-space: nowrap;
  pointer-events: none;
}

.hint-enter-active,
.hint-leave-active {
  transition: opacity 300ms var(--ease-out);
}

.hint-enter-from,
.hint-leave-to {
  opacity: 0;
}

/* ── 书签舌 ─────────────────────────────────────────────── */
.bookmark {
  position: absolute;
  left: 0;
  top: 50%;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 58px;
  transform: translateY(-50%);
  border: 1px solid var(--rule);
  border-left: none;
  border-radius: 0 9px 9px 0;
  background: color-mix(in srgb, var(--mark) 15%, var(--paper));
  color: var(--mark);
  transition: width 160ms var(--ease-out);
}

.bookmark:hover {
  width: 26px;
}

/* ── 目录抽屉 ───────────────────────────────────────────── */
.toc-drawer {
  position: absolute;
  inset-block: 0;
  left: 0;
  z-index: 7;
  display: flex;
  flex-direction: column;
  width: min(268px, 80%);
  background: var(--chrome);
  border-right: 1px solid var(--rule);
  box-shadow: 8px 0 28px color-mix(in srgb, var(--text) 12%, transparent);
  transform: translateX(-101%);
  transition: transform 280ms var(--ease-out);
}

.toc-drawer.open {
  transform: none;
}

.drawer-head {
  flex: 0 0 auto;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--rule);
}

.drawer-kicker {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-soft);
}

.drawer-title {
  margin-top: 3px;
  font-family: var(--font-display);
  font-size: 14px;
  line-height: 1.4;
  color: var(--text);
}

.drawer-byline {
  margin-top: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-soft);
}

.toc-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  align-content: start;
  gap: 1px;
  padding: 10px;
}

.toc-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border-radius: 7px;
  text-align: left;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-soft);
  transition:
    background-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.toc-item:hover {
  background: color-mix(in srgb, var(--paper) 60%, transparent);
  color: var(--text);
}

.toc-item.is-current {
  background: color-mix(in srgb, var(--mark) 14%, transparent);
  color: var(--text);
}

.toc-no {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 9.5px;
  color: var(--text-soft);
  opacity: 0.8;
}

.toc-item.is-current .toc-no {
  color: var(--mark);
  opacity: 1;
}

.toc-name {
  min-width: 0;
}

/* ── 上下工具条 ─────────────────────────────────────────── */
/*
 * 默认整体移出画面，opacity 0 + pointer-events: none，
 * 所以既不挡字，也不会误点。
 */
.chrome {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 8;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: color-mix(in srgb, var(--chrome) 92%, transparent);
  backdrop-filter: blur(10px);
  opacity: 0;
  pointer-events: none;
  transition:
    transform 240ms var(--ease-out),
    opacity 180ms var(--ease-out);
}

.chrome-top {
  top: 0;
  transform: translateY(-100%);
  border-bottom: 1px solid var(--rule);
}

.chrome-bottom {
  bottom: 0;
  transform: translateY(100%);
  border-top: 1px solid var(--rule);
}

.chrome.open {
  transform: none;
  opacity: 1;
  pointer-events: auto;
}

.chrome-id {
  flex: 1 1 auto;
  min-width: 0;
}

.chrome-kicker {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-soft);
}

.chrome-title {
  font-family: var(--font-display);
  font-size: 13.5px;
  line-height: 1.4;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chrome-ctrl {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 5px;
}

.ctrl-group {
  display: flex;
  gap: 2px;
}

.ctrl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-width: 34px;
  min-height: 30px;
  padding: 0 8px;
  border-radius: var(--r-pill);
  border: 1px solid var(--rule);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-soft);
  transition:
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out),
    background-color var(--t-fast) var(--ease-out);
}

.ctrl-btn:hover:not(:disabled) {
  border-color: var(--mark);
  color: var(--mark);
}

.ctrl-btn:disabled {
  opacity: 0.35;
}

.ctrl-btn[aria-pressed='true'] {
  border-color: var(--mark);
  background: color-mix(in srgb, var(--mark) 16%, transparent);
  color: var(--mark);
}

.ctrl-wide {
  font-size: 11.5px;
}

.ctrl-btn--font {
  font-family: var(--font-display);
  font-size: 12.5px;
}

.foot-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 32px;
  padding: 0 12px;
  border-radius: var(--r-pill);
  border: 1px solid var(--rule);
  font-family: var(--font-display);
  font-size: 12px;
  color: var(--text);
  transition:
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.foot-btn:hover:not(:disabled) {
  border-color: var(--mark);
  color: var(--mark);
}

.foot-btn:disabled {
  opacity: 0.32;
}

.foot-pos {
  flex: 1 1 auto;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.06em;
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}

/* ── 提示态 ─────────────────────────────────────────────── */
.reader-notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 18px;
  padding: 14px;
  border-radius: var(--r-input);
  background: color-mix(in srgb, var(--chrome) 70%, transparent);
  border: 1px solid var(--rule);
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-soft);
}

.notice-title {
  font-size: 12.5px;
  color: var(--text);
}

.notice-text {
  margin-top: 3px;
}

.reader-notice code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--chrome);
  font-family: var(--font-mono);
  font-size: 11px;
}

/* ── 窄屏 ───────────────────────────────────────────────── */
@media (max-width: 899px) {
  /* 书签舌会压到正文，窄屏收掉，用工具条里的"目录" */
  .bookmark {
    display: none;
  }
}

@media (max-width: 560px) {
  .reader-viewport {
    padding: 22px 20px;
  }

  .chrome {
    padding: 8px 12px;
  }

  .chrome-kicker {
    display: none;
  }

  .chrome-title {
    font-size: 12.5px;
  }

  .foot-pos {
    font-size: 10px;
  }

  .page-hint {
    font-size: 10.5px;
    bottom: 22px;
  }
}

/* ── 动效关掉 ───────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .reader-flow,
  .toc-drawer,
  .chrome,
  .bookmark {
    transition: none;
  }

  .reader-bar-fill {
    transition: none;
  }
}

[data-motion='off'] .reader-flow,
[data-motion='off'] .toc-drawer,
[data-motion='off'] .chrome,
[data-motion='off'] .bookmark {
  transition: none;
}

[data-motion='off'] .reader-bar-fill {
  transition: none;
}

/*
 * 动效关掉时纸色也直接换。
 * 这条必须写在最后：.reader 上那条 transition 优先级相同，
 * 靠"后写的赢"覆盖掉。
 */
[data-motion='off'] .reader {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .reader {
    transition: none;
  }
}
</style>
