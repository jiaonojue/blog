<script setup lang="ts">
/**
 * 卷末四格 —— 首页滚到最后，是一页漫画原稿。
 *
 * 【为什么是四格】
 *   站名「回声记录」，tagline 是「看番、写码、随手记一点什么」。
 *   四格漫画的起 / 承 / 转 / 合，正好是这三件事做完之后剩下的那点意思：
 *   第一格看番，第二格写码，第三格写字，第四格空着——留白本身就是结尾。
 *   所以它不是贴在站尾的特效，它是这个站的"最后一页"。
 *
 * 【它用的视觉语言】
 *   网点纸（screentone）、集中线、原稿格线、沾水笔描边、胶带、印章——
 *   全是站里已经在用的那套纸品语言，没有引入任何新东西。
 *   所有格子里的内容都来自真实文章，没有编造。
 *
 * 【技术上它做了什么】
 *   1. 滚动进度 → --p，四格依次"落笔"：格线先画出来，画面再浮现
 *   2. 集中线是纯 CSS 的 conic-gradient + mask，不用图片
 *   3. 网点是 repeating-radial-gradient，成本几乎为零
 *   4. 减少动效时四格直接全部显示，不做任何滚动劫持
 *
 * 【想改文案】改 panels 数组。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { motionEnabled } from '@/composables/useSettings'
import { posts, categoryLabel } from '@/composables/useContent'
import { totalPages, pad2 } from '@/composables/useBook'
import TapeLabel from '@/components/ui/TapeLabel.vue'

const root = ref<HTMLElement | null>(null)

/** 按分类偏好找一篇，并排除已经用掉的，避免两格重复同一篇 */
function findPost(cats: string[], used: Set<string>): (typeof posts)[number] | null {
  return (
    posts.find((p) => cats.includes(p.category) && !used.has(p.path)) ??
    posts.find((p) => !used.has(p.path)) ??
    null
  )
}

/**
 * 四格内容。
 * 起：最近在看的 / 承：写码 / 转：记一点什么 / 合：留白
 * 每格的文章都不同——同一篇出现两次会显得像没做。
 */
const panels = computed(() => {
  const used = new Set<string>()
  const take = (post: (typeof posts)[number] | null) => {
    if (post) used.add(post.path)
    return post
  }

  const newest = take(posts[0] ?? null)
  const code = take(findPost(['tech', 'fragment'], used))
  const essay = take(findPost(['essay', 'anime'], used))

  return [
    {
      no: '01',
      scene: '看',
      caption: newest ? newest.title : '还没写',
      meta: newest ? categoryLabel(newest.category) : '',
    },
    {
      no: '02',
      scene: '写',
      caption: code ? code.title : '还没有技术文',
      meta: code ? categoryLabel(code.category) : '',
    },
    {
      no: '03',
      scene: '记',
      caption: essay ? essay.title : '还没有随笔',
      meta: essay ? categoryLabel(essay.category) : '',
    },
    {
      no: '04',
      scene: '空',
      caption: '这一格还没画。等你下次来，可能就有了。',
      meta: '',
    },
  ]
})

let raf = 0
let running = false
let observer: IntersectionObserver | null = null
let smooth = 0

function tick() {
  const el = root.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const scrollable = rect.height - window.innerHeight
  const raw = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0
  smooth += (raw - smooth) * 0.16
  el.style.setProperty('--p', smooth.toFixed(4))
  raf = requestAnimationFrame(tick)
}

function start() {
  if (running || !motionEnabled.value) return
  running = true
  raf = requestAnimationFrame(tick)
}

function stop() {
  running = false
  cancelAnimationFrame(raf)
  raf = 0
}

onMounted(() => {
  if (!motionEnabled.value) return
  const node = root.value
  if (!node) return

  /*
   * 先量一次位置：如果页面打开时这一块已经（或快要）进入视口，
   * 就直接开始算滚动进度，不等观察器。
   * IntersectionObserver 在后台标签页、部分内嵌 WebView 里可能不回调，
   * 那时四格会永远停在空白状态——内容是装饰性的，但也不该凭空消失。
   */
  const rect = node.getBoundingClientRect()
  if (rect.top < window.innerHeight + 160 && rect.bottom > -160) start()

  observer = new IntersectionObserver(
    (entries) => {
      const e = entries[0]
      if (!e) return
      if (e.isIntersecting) start()
      else stop()
    },
    { rootMargin: '160px' },
  )
  observer.observe(node)
})

onUnmounted(() => {
  stop()
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <section ref="root" class="comic" aria-labelledby="comic-title">
    <div class="comic-stage">
      <div class="comic-paper">
        <!-- 原稿头：像同人志页眉 -->
        <header class="comic-head">
          <TapeLabel tone="accent" :tilt="-1.4">4-koma</TapeLabel>
          <h2 id="comic-title" class="comic-title">卷末四格</h2>
          <p class="comic-sub">起 · 承 · 转 · 合</p>
        </header>

        <!-- 四格 -->
        <div class="comic-grid">
          <figure v-for="(p, i) in panels" :key="p.no" class="panel" :class="`panel-${i + 1}`">
            <!-- 画格：网点 + 集中线 -->
            <div class="panel-art" aria-hidden="true">
              <span class="panel-tone" />
              <span class="panel-rays" />
              <span class="panel-char">{{ p.scene }}</span>
            </div>

            <!-- 格边编号 -->
            <span class="panel-no" aria-hidden="true">{{ p.no }}</span>

            <!-- 旁白框：从格子里伸出来 -->
            <figcaption class="panel-caption">
              <span v-if="p.meta" class="caption-meta">{{ p.meta }}</span>
              {{ p.caption }}
            </figcaption>
          </figure>
        </div>

        <!-- 页面右下角：页码 + 收尾 -->
        <footer class="comic-foot">
          <p class="comic-end">翻到这一页，就说明你已经把整本看完了。</p>
          <div class="comic-pageno">
            <span class="pageno-label">P.</span>
            <span class="pageno-num">{{ pad2(totalPages) }}</span>
          </div>
        </footer>
      </div>
    </div>
  </section>
</template>

<style scoped>
/*
 * 漫画原稿区。
 * 高度决定"落笔"的节奏：现在是 180vh，四格大约在 1/4、1/2、3/4、末尾依次出现。
 */
.comic {
  --p: 0;
  position: relative;
  height: 180vh;
  background: var(--bg);
}

.comic-stage {
  position: sticky;
  top: 0;
  display: grid;
  place-items: center;
  height: 100dvh;
  /*
   * 上下内边距要盖住固定导航（桌面 96px，移动 76px）。
   * 不然原稿纸会被顶部胶囊压住第一格。
   */
  padding: clamp(84px, 13vh, 112px) clamp(16px, 4vw, 40px) clamp(16px, 4vh, 40px);
  overflow: hidden;
}

/* ── 原稿纸 ─────────────────────────────────────────────── */
.comic-paper {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 880px;
  /*
   * 必须给一个确定的高度，否则里面的 .comic-grid 用 flex:1 分不到空间。
   * 四个格子的内容全是绝对定位的（画格、旁白框），本身撑不出高度；
   * 一旦父级高度是 auto，整个网格就会塌成 0。
   */
  height: 100%;
  padding: clamp(18px, 3.2vh, 32px) clamp(18px, 3.4vw, 36px);
  border-radius: 4px;
  /* 原稿纸是偏暖的白，比页面底色更"纸"一点 */
  background: var(--surface);
  border: var(--w-stroke) solid var(--ink);
  box-shadow:
    var(--shadow-lift),
    /* 右下角折角 */ 6px 6px 0 -1px var(--bg-soft);
}

.comic-head {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding-bottom: clamp(10px, 1.8vh, 16px);
  border-bottom: 1px dashed var(--line);
}

.comic-title {
  font-family: var(--font-display);
  font-size: clamp(1.15rem, 2.4vw, 1.5rem);
  line-height: 1.2;
}

.comic-sub {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.22em;
  color: var(--ink-soft);
}

/* ── 四格布局：标准的 2×2 分镜 ───────────────────────────── */
.comic-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  /*
   * 四格等大，2×2。
   * 一开始想做"第一格横跨两列"，但那样总行高被压成 1.15fr + 1fr + auto，
   * 第四格会被挤到只剩几像素。等比格子最稳，而且四格等大更像真正的四格漫画。
   */
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: clamp(8px, 1.4vh, 14px);
  margin-top: clamp(10px, 2vh, 18px);
}

.panel {
  position: relative;
  display: block;
  margin: 0;
  overflow: hidden;
  /*
   * 分镜稿的格线永远在：即使画面还没"落笔"，
   * 也要能看见四个空框——那才像一页原稿，而不是一张白纸。
   */
  border: var(--w-stroke) solid var(--ink);
  background: var(--surface);
  /*
   * 落笔节奏：每格有自己的入场进度。
   * 第 n 格在 --p 到达 (n-1)/4 附近开始出现，用 clamp 把它的局部进度卡在 0..1。
   */
  --local: clamp(0, calc(var(--p) * 4 - (var(--i) - 1)), 1);
}

.panel-1 {
  --i: 1;
}
.panel-2 {
  --i: 2;
}
.panel-3 {
  --i: 3;
}
.panel-4 {
  --i: 4;
}

/* 画面层从左往右"落笔"揭开。裁切放在内层，格线本身永远可见 */
.panel-art {
  position: absolute;
  inset: 0;
  overflow: hidden;
  clip-path: inset(0 calc((1 - var(--local)) * 100%) 0 0);
}

/* 网点纸：小圆点矩阵，透明度跟格子进度走 */
.panel-tone {
  position: absolute;
  inset: 0;
  /*
   * 两层网点叠加：一层正的，一层旋转 26°。
   * 单层正方向的小点看起来像"印刷错误"，两层错开才有原稿纸那种密度感。
   */
  background-image:
    radial-gradient(
      circle at 1px 1px,
      color-mix(in srgb, var(--ink) 34%, transparent) 1.1px,
      transparent 0
    ),
    radial-gradient(
      circle at 1px 1px,
      color-mix(in srgb, var(--ink) 22%, transparent) 0.9px,
      transparent 0
    );
  background-size:
    5px 5px,
    6px 6px;
  background-position:
    0 0,
    3px 3px;
  opacity: calc(0.22 + var(--local) * 0.42);
}

/* 集中线：conic-gradient 做放射状条纹，再从中心挖空 */
.panel-rays {
  position: absolute;
  inset: -25%;
  background: repeating-conic-gradient(
    from 0deg,
    color-mix(in srgb, var(--ink) 30%, transparent) 0deg 0.7deg,
    transparent 0.7deg 5.2deg
  );
  mask-image: radial-gradient(circle at 50% 48%, transparent 26%, #000 62%);
  opacity: calc((1 - var(--local)) * 0.55);
  transform: rotate(calc(var(--local) * 8deg)) scale(calc(0.85 + var(--local) * 0.2));
}

/* 格子里的大字：像漫画里的拟声词 */
.panel-char {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-size: clamp(2.4rem, 7vw, 4.4rem);
  line-height: 1;
  color: var(--ink);
  opacity: calc(var(--local) * 0.9);
  transform: translateY(calc((1 - var(--local)) * 14px)) rotate(-3deg);
  text-shadow: 3px 3px 0 var(--accent-soft);
}

/* 格边编号：像分镜稿上的框号 */
.panel-no {
  position: absolute;
  top: 6px;
  left: 8px;
  z-index: 2;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--ink-soft);
  opacity: 0.75;
}

/* ── 旁白框 ─────────────────────────────────────────────── */
.panel-caption {
  position: absolute;
  z-index: 2;
  left: 10px;
  right: 10px;
  bottom: 10px;
  padding: 8px 12px;
  border: 1.5px solid var(--ink);
  background: var(--surface);
  font-family: var(--font-quote);
  font-size: clamp(11.5px, 1.15vw, 13px);
  line-height: 1.6;
  color: var(--ink);
  /*
   * 旁白框自己的入场比画格晚一点：
   * 先看到画面，再看到说明——这是漫画的阅读顺序。
   */
  opacity: clamp(0, calc(var(--local) * 2 - 0.7), 1);
  transform: translateY(calc((1 - clamp(0, calc(var(--local) * 2 - 0.7), 1)) * 8px));
}

.caption-meta {
  display: inline-block;
  margin-right: 7px;
  padding: 0 6px;
  border-radius: var(--r-pill);
  background: var(--accent-soft);
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.06em;
  color: var(--accent);
  vertical-align: 1px;
}

/* ── 页脚 ───────────────────────────────────────────────── */
.comic-foot {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding-top: clamp(10px, 1.8vh, 16px);
  margin-top: clamp(8px, 1.4vh, 12px);
  border-top: 1px dashed var(--line);
}

.comic-end {
  font-family: var(--font-quote);
  font-size: clamp(11.5px, 1.2vw, 13.5px);
  line-height: 1.6;
  color: var(--ink-soft);
}

.comic-pageno {
  display: flex;
  align-items: baseline;
  gap: 2px;
  flex-shrink: 0;
  font-family: var(--font-mono);
  color: var(--ink-soft);
}

.pageno-label {
  font-size: 10px;
  opacity: 0.7;
}

.pageno-num {
  font-size: 15px;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

/* ── 窄屏：四格改成两行两列，全部缩小 ─────────────────────── */
@media (max-width: 639px) {
  .comic {
    /* 手机上不需要那么长的下潜距离 */
    height: 150vh;
  }

  .comic-grid {
    grid-template-rows: 1fr 1fr;
  }

  .panel-char {
    font-size: clamp(1.8rem, 9vw, 2.6rem);
  }

  .panel-caption {
    left: 6px;
    right: 6px;
    bottom: 6px;
    padding: 5px 7px;
    font-size: 10.5px;
    line-height: 1.45;
    /* 小屏空间紧，最多两行 */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .comic-sub {
    display: none;
  }
}

/* ── 极窄 / 矮屏：不再吸附，四格正常排下来 ─────────────────── */
@media (max-height: 560px) {
  .comic {
    height: auto;
  }

  .comic-stage {
    position: relative;
    height: auto;
    min-height: 0;
    padding-block: 48px;
  }

  .panel-art {
    clip-path: none;
  }
}

/*
 * 减少动效：不劫持滚动，四格直接全部显示。
 * 注意这里要同时清掉 clip-path 和所有由 --local 驱动的透明度/位移，
 * 否则 --p 恒为 0 会让四格全部隐形。
 */
@media (prefers-reduced-motion: reduce) {
  .comic {
    height: auto;
  }

  .comic-stage {
    position: relative;
    height: auto;
    min-height: 0;
    padding-block: 56px;
  }

  .panel-art {
    clip-path: none;
  }

  .panel-tone,
  .panel-rays,
  .panel-char,
  .panel-caption {
    opacity: 1;
    transform: none;
  }
}

/* 站内开关关掉动效时同样退化 */
:global([data-motion='off']) .comic {
  height: auto;
}

:global([data-motion='off']) .comic-stage {
  position: relative;
  height: auto;
  min-height: 0;
  padding-block: 56px;
}

:global([data-motion='off']) .panel-art {
  clip-path: none;
}

:global([data-motion='off']) .panel-tone,
:global([data-motion='off']) .panel-rays,
:global([data-motion='off']) .panel-char,
:global([data-motion='off']) .panel-caption {
  opacity: 1;
  transform: none;
}
</style>
