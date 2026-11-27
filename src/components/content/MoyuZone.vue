<script setup lang="ts">
/**
 * 附录（摸鱼分区）—— 首页滚到底之后横过来的一叠纸。
 *
 * 【为什么是横的】
 *   前面五屏都是竖着往下读，读到卷末四格，正文已经结束了。
 *   附录如果继续往下堆，就变成"又一个板块"，读者会以为正文还没完。
 *   横过来是一道明确的边界：这里开始不是正文，是一叠可以左右翻的附录页。
 *   也顺带解决了"首页太长"——五块内容只占一屏高。
 *
 * 【顶部导航为什么跟着变】
 *   附录占满视口的时候，页面已经不在"首页"了，
 *   顶上的首页/文章/收藏/相册/关于 在这里一个都用不上。
 *   这时候把导航换成附录的几个栏目（读本/抽签/猜番/十佳/便条），
 *   读者随时知道自己在哪一页、还能去哪个页。离开附录，导航自动换回来。
 *
 * 【为什么懒挂载】
 *   五块内容加起来不轻：阅读器要 fetch，抽签和榜单要 fetch 174 条评分。
 *   首页首屏一点都不该为它们付出代价。所以用 IntersectionObserver：
 *   滚到距离 400px 时才真正创建组件。
 *   IntersectionObserver 不回调的极端环境（后台标签页、某些 WebView）
 *   用兜底定时器兜住，免得那一块永远是空的。
 *
 * 【为什么用"轨道平移"而不是 scroll-snap】
 *   scroll-snap 要靠用户自己横向滑，鼠标用户得按 Shift + 滚轮；
 *   而且页与页之间的位置永远差一点，读起来像没对齐。
 *   用 transform 平移，位置是我们算的，一定对齐；
 *   横向滚动条也一并省掉。
 */
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { ArrowLeft, ArrowRight } from '@lucide/vue'
import { MOYU_TABS, moyuActive, moyuTab, setMoyuTab, stepMoyu } from '@/composables/useMoyuZone'
import { site } from '@/data/site.config'

/*
 * 角落里的看板娘。
 * 部署在 /blog/ 子路径下，图片路径得自己拼上 base。
 */
const girlUrl = (() => {
  const b = site.base.endsWith('/') ? site.base.slice(0, -1) : site.base
  return `${b}/art/girls/moyu-companion.webp`
})()

/*
 * 五块都异步加载。
 * 这样即使摸鱼分区被挂载，四个组件的代码也只在真正渲染时才下载。
 */
const NovelReader = defineAsyncComponent(() => import('@/components/content/NovelReader.vue'))
const AnimeGacha = defineAsyncComponent(() => import('@/components/content/AnimeGacha.vue'))
const AnimeQuiz = defineAsyncComponent(() => import('@/components/content/AnimeQuiz.vue'))
const AnimeTop = defineAsyncComponent(() => import('@/components/content/AnimeTop.vue'))
const NoteBoard = defineAsyncComponent(() => import('@/components/content/NoteBoard.vue'))

const root = ref<HTMLElement | null>(null)
/** 滚到附近了吗。false 时五块都不存在，页面里只有这个空壳 */
const live = ref(false)

const isFirst = computed(() => moyuTab.value === 0)
const isLast = computed(() => moyuTab.value === MOYU_TABS.length - 1)
const currentTab = computed(() => MOYU_TABS[moyuTab.value] ?? MOYU_TABS[0]!)

/**
 * 轨道几何。
 *
 * 【为什么这些数字不写死在 CSS 里】
 *   页数会变（这次就从四页变成了五页）。
 *   写死 400% / 25% 的话，每加一页都要同时改三处，
 *   漏一处就整排错位。这里由页数算出来，CSS 只负责用。
 *
 * 【为什么平移量是"页宽 × 页数"的百分比】
 *   translateX 的百分比按元素自己的宽度算。
 *   轨道是 N 页并排，所以一页 = 轨道的 100/N %。
 */
const pagePct = computed(() => 100 / MOYU_TABS.length)
const trackStyle = computed(() => ({
  '--page-pct': `${pagePct.value}%`,
  '--track-w': `${MOYU_TABS.length * 100}%`,
  transform: `translateX(-${moyuTab.value * pagePct.value}%)`,
}))

function onKey(e: KeyboardEvent) {
  // 只在附录占着视口时接管左右键
  if (!moyuActive.value) return
  const target = e.target as HTMLElement | null
  // 阅读器、输入框自己要用方向键，别抢
  if (target && target.closest('.reader, input, textarea, select')) return
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    stepMoyu(1)
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    stepMoyu(-1)
  }
}

let observer: IntersectionObserver | null = null
let fallback = 0
let scrollRaf = 0

/**
 * 这一区现在是不是"占着视口"。
 *
 * 【为什么用滚动位置算，不用 IntersectionObserver】
 *   试过 rootMargin: '-45% 0px -45% 0px' 的观察器，桌面浏览器上表现正常，
 *   但在内嵌 WebView / 后台标签页里回调会被合并甚至跳过，
 *   结果离开这一区之后整站还留在暗色里，切不回来。
 *   直接读 getBoundingClientRect 是最笨也最准的办法：
 *   只要这一节的上下边跨过屏幕中线，就算在里面。滚动和缩放时都重算一次。
 */
function syncActive() {
  const node = root.value
  if (!node) return
  const rect = node.getBoundingClientRect()
  const mid = window.innerHeight / 2
  moyuActive.value = rect.top <= mid && rect.bottom >= mid
}

/** 滚动时按帧节流：滚动事件一秒能来上百次，没必要每次都量 */
function onScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    syncActive()
  })
}

/*
 * 轮询兜底。
 *
 * 【为什么除了 scroll 事件还要轮询】
 *   scroll 事件只在"用户或浏览器真的滚了"时触发。
 *   路由跳转、锚点定位、以及某些内嵌浏览器里的程序化滚动
 *   都不一定会派发它。轮询 300ms 读一次 getBoundingClientRect，
 *   开销可以忽略（一次布局查询），但能保证状态永远跟得上画面。
 */
let pollTimer = 0

onMounted(() => {
  const node = root.value
  if (!node) return

  /*
   * 先量一次：如果打开页面时这一块已经在视口附近（比如短页面、
   * 或者从 #moyu 锚点直接跳进来），立刻挂载，不等观察器。
   */
  const rect = node.getBoundingClientRect()
  if (rect.top < window.innerHeight + 400) {
    live.value = true
  } else {
    observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        live.value = true
        observer?.disconnect()
        observer = null
      },
      // 提前 400px 挂载：等用户滚到，内容已经准备好了
      { rootMargin: '400px' },
    )
    observer.observe(node)
  }

  // 进没进这一区：滚动、滚轮、触摸、尺寸变化都算一次
  syncActive()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  window.addEventListener('wheel', onScroll, { passive: true })
  window.addEventListener('touchmove', onScroll, { passive: true })
  pollTimer = window.setInterval(syncActive, 300)

  /*
   * 兜底：观察器要是不回调，用户滚到这里会看到一片空白。
   * 8 秒后无条件挂载——宁可多下载一点，也不能让这一块空着。
   */
  fallback = window.setTimeout(() => {
    live.value = true
  }, 8000)

  window.addEventListener('keydown', onKey)
})

/*
 * 附录占着视口时，把整站切进暗场。
 *
 * 【为什么挂在 <html> 上】
 *   要暗下来的不只是这一块，还有背后的插画层、噪点、页脚——
 *   它们都不在这个组件里。只有挂在根元素上，才能一处生效、全站跟着变。
 *   tokens.css 里 [data-zone='moyu'] 那一组变量会覆盖当前主题的配色。
 */
watch(moyuActive, (on) => {
  if (typeof document === 'undefined') return
  if (on) document.documentElement.dataset.zone = 'moyu'
  else delete document.documentElement.dataset.zone
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
  window.clearTimeout(fallback)
  window.clearInterval(pollTimer)
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  scrollRaf = 0
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  window.removeEventListener('wheel', onScroll)
  window.removeEventListener('touchmove', onScroll)
  moyuActive.value = false
  if (typeof document !== 'undefined') delete document.documentElement.dataset.zone
  window.removeEventListener('keydown', onKey)
})

/** 切页时把焦点留在这一区，键盘用户不会掉出去 */
watch(moyuTab, () => {
  root.value?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
})
</script>

<template>
  <section id="moyu" ref="root" class="moyu" aria-labelledby="moyu-title" data-pagefind-ignore>
    <!--
      这一区自己的背景。
      它不是固定在视口上的那一层（那是全站的），而是贴着这一节走：
      滑进来时它才出现，滑出去就跟着走。深色底 + 一层斜向的光，
      和上半册的纸白形成"翻到了书的另一半"。
    -->
    <div class="moyu-bg" aria-hidden="true">
      <span class="moyu-glow moyu-glow--a" />
      <span class="moyu-glow moyu-glow--b" />
      <span class="moyu-grid" />
    </div>

    <!-- 骑马钉：一条装订线 + 三个孔 -->
    <div class="moyu-bind" aria-hidden="true">
      <span class="bind-line" />
      <span class="bind-hole" />
      <span class="bind-hole" />
      <span class="bind-hole" />
    </div>

    <!--
      缩在角落的看板娘。
      【为什么放在这一层的中间】她排在背景光效之后、正文之前，
      所以卡片会遮住她的边缘——是"躲在卡片后面探出身子"，
      不是"贴在页面上的贴图"。
      【图的形状】图片文件自带椭圆羽化的透明通道（导出时烘焙好了），
      四周平滑淡掉，直接贴上去也不会出现矩形边。
      手机上不显示：375px 宽的卡片后面藏不下一个人。
    -->
    <img
      class="moyu-girl"
      :src="girlUrl"
      alt=""
      width="643"
      height="900"
      loading="lazy"
      decoding="async"
    />

    <div class="container moyu-inner">
      <header class="moyu-head">
        <div>
          <p class="moyu-kicker">moyu zone · {{ moyuTab + 1 }} / {{ MOYU_TABS.length }}</p>
          <h2 id="moyu-title" class="moyu-title">{{ currentTab.label }}</h2>
        </div>

        <!-- 页签：同时是这一区的目录 -->
        <nav class="moyu-tabs" aria-label="摸鱼分区栏目">
          <button
            v-for="(tab, i) in MOYU_TABS"
            :key="tab.key"
            type="button"
            class="tab"
            :class="{ 'is-current': i === moyuTab }"
            :aria-current="i === moyuTab ? 'true' : undefined"
            @click="setMoyuTab(i)"
          >
            {{ tab.label }}
          </button>
        </nav>
      </header>

      <div class="moyu-stage">
        <!-- 上一页 -->
        <button
          type="button"
          class="stage-arrow stage-arrow--prev"
          :disabled="isFirst"
          aria-label="上一页附录"
          @click="stepMoyu(-1)"
        >
          <ArrowLeft :size="16" :stroke-width="2" aria-hidden="true" />
        </button>

        <!-- 横向轨道：五页并排，靠 transform 平移 -->
        <div class="stage-clip">
          <div class="stage-track" :style="trackStyle">
            <div class="stage-page">
              <div v-if="live" class="page-fill"><NovelReader /></div>
              <span v-else class="moyu-skeleton" aria-hidden="true" />
            </div>
            <div class="stage-page">
              <div v-if="live" class="page-fill"><AnimeGacha /></div>
              <span v-else class="moyu-skeleton short" aria-hidden="true" />
            </div>
            <div class="stage-page">
              <div v-if="live" class="page-fill"><AnimeQuiz /></div>
              <span v-else class="moyu-skeleton short" aria-hidden="true" />
            </div>
            <div class="stage-page">
              <div v-if="live" class="page-fill"><AnimeTop /></div>
              <span v-else class="moyu-skeleton short" aria-hidden="true" />
            </div>
            <div class="stage-page">
              <div v-if="live" class="page-fill"><NoteBoard /></div>
              <span v-else class="moyu-skeleton short" aria-hidden="true" />
            </div>
          </div>
        </div>

        <!-- 下一页 -->
        <button
          type="button"
          class="stage-arrow stage-arrow--next"
          :disabled="isLast"
          aria-label="下一页附录"
          @click="stepMoyu(1)"
        >
          <ArrowRight :size="16" :stroke-width="2" aria-hidden="true" />
        </button>
      </div>

      <footer class="moyu-foot">
        <p class="foot-note">这一页：{{ currentTab.unit }}。左右翻，或者点上面的栏目。</p>
        <div class="foot-dots" aria-hidden="true">
          <span
            v-for="(tab, i) in MOYU_TABS"
            :key="tab.key"
            class="dot"
            :class="{ 'is-current': i === moyuTab }"
          />
        </div>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.moyu {
  position: relative;
  margin-top: 72px;
  /*
   * 这一节的底色直接用 --bg。
   * 上面那一层 .moyu-bg 是它自己的插画/光效，
   * 底色负责兜住对比度，光效只负责气氛。
   */
  background: var(--bg);
  border-top: 1px solid var(--line);
  padding-block: 56px 56px;
  /* 光效和网格都要被裁在节内，不然会糊到页脚上去 */
  overflow: hidden;
  isolation: isolate;
}

/* ── 这一区自己的背景 ───────────────────────────────────── */
.moyu-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

/*
 * 两团光。
 * 一团偏粉、在上方偏右；一团偏紫、在左下。
 * 都用 radial-gradient，边缘自然散掉，不需要图片。
 */
.moyu-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
}

.moyu-glow--a {
  top: -12%;
  right: -6%;
  width: 46vw;
  height: 46vw;
  max-width: 620px;
  max-height: 620px;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--accent) 34%, transparent) 0%,
    transparent 68%
  );
}

.moyu-glow--b {
  bottom: -18%;
  left: -10%;
  width: 40vw;
  height: 40vw;
  max-width: 520px;
  max-height: 520px;
  background: radial-gradient(
    circle,
    color-mix(in srgb, #7b5cff 30%, transparent) 0%,
    transparent 70%
  );
}

/*
 * 极淡的方格。
 * 附录这一叠是"稿纸"的另一面，网格比网点更安静，
 * 也不会和上面四格的网点撞在一起。
 */
.moyu-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(
      to right,
      color-mix(in srgb, var(--line) 60%, transparent) 1px,
      transparent 1px
    ),
    linear-gradient(
      to bottom,
      color-mix(in srgb, var(--line) 60%, transparent) 1px,
      transparent 1px
    );
  background-size: 46px 46px;
  /* 从中间往外淡，避免整片格子抢戏 */
  mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, black 0%, transparent 78%);
  -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, black 0%, transparent 78%);
  opacity: 0.5;
}

.moyu-inner {
  position: relative;
  z-index: 1;
}

/* ── 看板娘 ─────────────────────────────────────────────── */
.moyu-girl {
  position: absolute;
  /*
   * 故意往分区外探出去一截：右、下两条硬边被 overflow: hidden 裁掉，
   * 露出来的只有左上那一侧——那一侧图里已经烘焙了羽化，
   * 于是她看起来是从纸的边缘探出身子，而不是一张贴上去的照片。
   */
  right: -56px;
  bottom: -64px;
  /* 排在背景光效之上、正文之下（.moyu-inner 是 z-index: 1） */
  z-index: 0;
  width: clamp(190px, 18vw, 280px);
  height: auto;
  pointer-events: none;
  user-select: none;
  opacity: 0.94;
  /* 附录的暗场比原图暗半档，跟着压一点 */
  filter: saturate(1.02) brightness(0.94);
}

@media (max-width: 1023px) {
  /* 手机和平板上没有给她留的角落 */
  .moyu-girl {
    display: none;
  }
}

/* ── 骑马钉装饰 ─────────────────────────────────────────── */
/*
 * 三个孔沿顶部排开，一条细线从它们中间穿过。
 * 纯 CSS，不用图片：三个小圆点 + 一条 1px 线，成本为零。
 */
.moyu-bind {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(28px, 12vw, 120px);
  pointer-events: none;
}

.bind-line {
  position: absolute;
  top: 50%;
  left: 6%;
  right: 6%;
  height: 1px;
  background: var(--line);
}

.bind-hole {
  position: relative;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--bg);
  box-shadow: inset 0 1px 1px color-mix(in srgb, var(--ink) 22%, transparent);
}

/* ── 标题与页签 ─────────────────────────────────────────── */
.moyu-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 18px;
}

.moyu-kicker {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.moyu-title {
  margin-top: 4px;
  font-family: var(--font-display);
  font-size: clamp(1.35rem, 3vw, 1.8rem);
  line-height: 1.3;
}

.moyu-tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
}

.tab {
  padding: 6px 14px;
  border-radius: var(--r-pill);
  font-size: 12.5px;
  color: var(--ink-soft);
  white-space: nowrap;
  transition:
    color var(--t-fast) var(--ease-out),
    background-color var(--t-fast) var(--ease-out);
}

.tab:hover {
  color: var(--ink);
}

.tab.is-current {
  background: var(--accent);
  color: var(--accent-ink);
}

/* ── 舞台：一页宽，两边留箭头 ───────────────────────────── */
.moyu-stage {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 8px;
}

.stage-arrow {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  color: var(--ink-soft);
  transition:
    color var(--t-fast) var(--ease-out),
    border-color var(--t-fast) var(--ease-out),
    opacity var(--t-fast) var(--ease-out);
}

.stage-arrow:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.stage-arrow:disabled {
  opacity: 0.28;
  cursor: default;
}

.stage-clip {
  overflow: hidden;
  /*
   * 舞台必须有确定的高度。
   *
   * 【为什么不能让它跟着内容长】
   *   里面的阅读器要用"自己能有多高"来算一页排多少字，
   *   而它又撑满这个舞台。如果舞台高度由内容决定，
   *   就变成"内容高度取决于容器、容器高度取决于内容"的死循环，
   *   浏览器会把高度一路撑到几万像素。
   *   这里钉死一个和视口相关的值，阅读器就知道自己该多高了。
   */
  height: clamp(400px, 62vh, 640px);
}

/*
 * 轨道的宽度和每页宽度由 JS 算好，放在 CSS 变量里（见 trackStyle）。
 * 加一页只需在 MOYU_TABS 里加一行，这里不用动。
 *
 * height: 100% 是为了把 .stage-clip 那个确定的高度传给每一页 ——
 * 少了这一行，页高又变回"由内容决定"，阅读器就又会把自己撑大。
 */
.stage-track {
  display: flex;
  width: var(--track-w, 500%);
  height: 100%;
  transition: transform 420ms var(--ease-out);
}

.stage-page {
  flex: 0 0 var(--page-pct, 20%);
  width: var(--page-pct, 20%);
  min-width: 0;
  /* 高度也从轨道继承：不然里面的 height:100% 会退化成 auto */
  height: 100%;
  padding-inline: 4px;
}

/* 五块内容高度不一，统一拉齐到这一屏的高度 */
.page-fill {
  height: 100%;
}

.page-fill > * {
  height: 100%;
}

/* ── 页脚 ───────────────────────────────────────────────── */
.moyu-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 14px;
}

.foot-note {
  font-family: var(--font-quote);
  font-size: 11.5px;
  color: var(--ink-soft);
}

.foot-dots {
  display: flex;
  gap: 5px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ink-soft) 32%, transparent);
  transition: background-color var(--t-fast) var(--ease-out);
}

.dot.is-current {
  background: var(--accent);
}

/* ── 骨架 ───────────────────────────────────────────────── */
.moyu-skeleton {
  display: block;
  /* 跟着舞台高度走，不再自己定高，免得和舞台对不上 */
  height: 100%;
  border-radius: var(--r-card);
  border: 1px dashed var(--line);
  background: color-mix(in srgb, var(--surface) 55%, transparent);
}

@media (max-width: 899px) {
  /*
   * 手机上把左右箭头收掉，舞台只留一列。
   *
   * 【为什么不只是缩小箭头】
   *   375px 减去页面内边距只剩 324，两根箭头加间距要吃掉 60 多，
   *   正文一页只剩 214px —— 一行十来个字，翻得手指疼。
   *   更要紧的是功能撞车：阅读器自己的"点右侧翻页"就在同一片区域，
   *   箭头浮在上面会变成"想翻页却换了栏目"。
   *   手机上切栏目本来就有两处入口（底部导航 + 上面那排页签），
   *   箭头是多余的那一个。
   */
  .moyu-stage {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  .stage-arrow {
    display: none;
  }

  .stage-page {
    padding-inline: 0;
  }
}

@media (max-width: 767px) {
  .moyu {
    margin-top: 52px;
    padding-block: 44px 48px;
  }

  .moyu-head {
    align-items: flex-start;
  }

  .moyu-tabs {
    width: 100%;
    overflow-x: auto;
  }

  .tab {
    flex: 1;
    padding: 7px 8px;
    text-align: center;
    font-size: 12px;
  }

  .moyu-foot {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

/* ── 动效关掉 ───────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .stage-track {
    transition: none;
  }
}

[data-motion='off'] .stage-track {
  transition: none;
}
</style>
