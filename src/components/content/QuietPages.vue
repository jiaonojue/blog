<script setup lang="ts">
/**
 * 空白页 —— 正片结束之后、附录之前那几页。
 *
 * 【这是整站唯一的彩蛋】
 *   参考了 Hearthly 那种"往下滑，页面开始跟你说话"的做法：
 *   不是再加一个业务板块，而是让页面本身对读者说几句。
 *   但那是恐怖调，这里换成同人志的调子——不是"我在看着你"，
 *   而是"这本书你翻到这儿了，谢谢你"。
 *
 * 【为什么全是短句、不承载信息】
 *   彩蛋的意义在于"没有用处"。一旦塞进链接、数据、按钮，
 *   它就变成又一个功能区，读者会开始找"我要做什么"。
 *   这里只做一件事：让读者停两秒。
 *
 * 【为什么一行一屏】
 *   一行一屏才有"停顿"的节奏。挤在一起读，就变成一段普通的文案。
 *
 * 【翻页是怎么做的】
 *   每一句话印在一张"纸"上。滚动时算每张纸离屏幕中心的距离，
 *   换算成翻页进度 --p（0 = 完全侧着，1 = 摆正）：
 *   纸从侧面立起来转正，走过中心后又慢慢翻回去——
 *   像有人在替你一页一页地翻这本没有字的册子。
 *   进度每帧写进 CSS 变量，变换本身留在 CSS 里算。
 *
 * 【萤火是怎么回事】
 *   夏夜翻书，纸边总该有一点光。canvas 上一小撮萤火
 *   慢慢地飘，滚动带来的"风"会让它们横着让一让。
 *   全部用的 --mark 色，白天是金粉，夜里是萤火。
 *
 * 【为什么句子是这些】
 *   全部围绕"你正在做的这件事"（读到这里）和"这本书的性质"（同人志），
 *   不提站主本人、不编造经历、不承诺任何东西。
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { motionEnabled } from '@/composables/useSettings'

interface Whisper {
  /** 主句 */
  text: string
  /** 小字注脚，可省 */
  note?: string
}

/*
 * 五句。数量是算过的：
 * 少于三句没有"翻页"的节奏，多于六句就开始像说教。
 * 每句都不超过 20 字，一屏里不用换行。
 */
const WHISPERS: Whisper[] = [
  { text: '你翻到这儿了。' },
  { text: '后面没有正文了。', note: '这一叠是附录' },
  { text: '这一册做得很慢。', note: '每一篇都是手排的' },
  { text: '慢到有些页，只有一句话。' },
  { text: '比如这一页。' },
]

const root = ref<HTMLElement | null>(null)
/** 当前亮着的那一句。扫过屏幕正中时切换 */
const active = ref(0)

let sections: HTMLElement[] = []
let pollTimer = 0
let raf = 0

/**
 * 每帧算两件事：
 *   1. 哪一句离屏幕中心最近（active，亮的那句）
 *   2. 每一张"纸"的翻页进度 --p（0 侧着 → 1 摆正）
 */
function sync() {
  if (!sections.length) return
  const mid = window.innerHeight / 2
  const span = window.innerHeight * 0.55
  let best = 0
  let bestDist = Infinity
  sections.forEach((el, i) => {
    const rect = el.getBoundingClientRect()
    const center = rect.top + rect.height / 2
    const dist = Math.abs(center - mid)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
    // 越靠近中心越"摆正"。这是连续的：任何时刻都有一个确定的进度
    const p = Math.max(0, Math.min(1, 1 - dist / span))
    el.style.setProperty('--p', p.toFixed(3))
  })
  active.value = best
}

function onScroll() {
  if (!raf)
    raf = requestAnimationFrame(() => {
      raf = 0
      sync()
    })
}

/* ── 萤火 ───────────────────────────────────────────────── */
const canvas = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let fireRaf = 0

interface Fly {
  x: number
  y: number
  r: number
  vy: number
  sway: number
  phase: number
  alpha: number
}

const flies: Fly[] = []

function makeFly(w: number, h: number, scatter = false): Fly {
  return {
    x: Math.random() * w,
    y: scatter ? Math.random() * h : h + 10,
    r: 1.2 + Math.random() * 2.2,
    vy: 0.18 + Math.random() * 0.3,
    sway: 12 + Math.random() * 26,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.25 + Math.random() * 0.45,
  }
}

let fireWind = 0
let fireLastY = 0

function onFireScroll() {
  const y = window.scrollY
  fireWind += (y - fireLastY) * 0.01
  fireWind = Math.max(-1.8, Math.min(1.8, fireWind))
  fireLastY = y
}

function fireTick(now: number) {
  const el = canvas.value
  // 重新取一次 context：TS 认不清「guard 之后不会再变」，这里直接收窄
  const c = ctx
  if (!c || !el) {
    fireRaf = 0
    return
  }
  const w = el.clientWidth
  const h = el.clientHeight
  /*
   * 挂载那一帧分区可能还没排进布局，画布会被初始化成 0×0。
   * 每帧对一下实际尺寸，变了就自己重设——不用依赖 resize 事件。
   */
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
    el.width = Math.round(w * dpr)
    el.height = Math.round(h * dpr)
    ctx = el.getContext('2d')
    ctx?.scale(dpr, dpr)
  }
  const t = now / 1000
  c.clearRect(0, 0, w, h)
  fireWind *= 0.96

  // 萤火的颜色取站点的"章"色——白天是金褐，夜里被暗场衬成萤火
  const color = getComputedStyle(el).getPropertyValue('--mark').trim() || '#b4713f'
  const [cr, cg, cb] = [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
  ]

  for (const f of flies) {
    f.y -= f.vy
    f.x += Math.sin(t * 0.6 + f.phase) * 0.18 + fireWind
    // 出界就从另一头接回来
    if (f.y < -12) Object.assign(f, makeFly(w, h))
    if (f.x > w + 12) f.x = -12
    if (f.x < -12) f.x = w + 12

    // 呼吸：每只萤火按自己的相位一明一灭
    const pulse = 0.55 + 0.45 * Math.sin(t * (1.4 + (f.phase % 1)) + f.phase)
    c.globalAlpha = f.alpha * pulse
    c.shadowColor = `rgba(${cr}, ${cg}, ${cb}, 0.9)`
    c.shadowBlur = f.r * 5
    c.fillStyle = `rgba(${Math.min(255, cr + 60)}, ${Math.min(255, cg + 50)}, ${cb}, 1)`
    c.beginPath()
    c.arc(f.x + Math.sin(t * 0.6 + f.phase) * f.sway * 0.1, f.y, f.r, 0, Math.PI * 2)
    c.fill()
  }
  c.globalAlpha = 1
  c.shadowBlur = 0
  fireRaf = requestAnimationFrame(fireTick)
}

onMounted(() => {
  sections = [...(root.value?.querySelectorAll<HTMLElement>('.whisper') ?? [])]
  sync()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  /*
   * 轮询兜底：和摸鱼分区同样的理由——程序化滚动、锚点跳转
   * 不一定派发 scroll 事件，而这一段的全部效果就是"跟着滚动变"，
   * 状态卡住的话整段会停在第一句。
   */
  pollTimer = window.setInterval(sync, 300)

  /*
   * 萤火只在"开着动效 + 桌面"时点。手机上省电；
   * 动效关掉时空白页就干干净净只剩字。
   */
  if (motionEnabled.value && window.matchMedia('(min-width: 768px)').matches) {
    const el = canvas.value
    if (el) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      el.width = el.clientWidth * dpr
      el.height = el.clientHeight * dpr
      ctx = el.getContext('2d')
      ctx?.scale(dpr, dpr)
      const w = el.clientWidth
      const h = el.clientHeight
      flies.push(...Array.from({ length: 22 }, () => makeFly(w, h, true)))
      fireLastY = window.scrollY
      window.addEventListener('scroll', onFireScroll, { passive: true })
      fireRaf = requestAnimationFrame(fireTick)
    }
  }
})

onUnmounted(() => {
  window.clearInterval(pollTimer)
  if (raf) cancelAnimationFrame(raf)
  if (fireRaf) cancelAnimationFrame(fireRaf)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  window.removeEventListener('scroll', onFireScroll)
})
</script>

<template>
  <section ref="root" class="quiet" aria-labelledby="quiet-label" data-pagefind-ignore>
    <h2 id="quiet-label" class="sr-only">空白页</h2>

    <!-- 萤火垫在最底下，句子和纸在它上面飘 -->
    <canvas ref="canvas" class="fireflies" aria-hidden="true" />

    <!-- 每句一屏，一张会翻的纸。最后一句之后留一段空白，让"翻到附录"有个间隙 -->
    <div
      v-for="(w, i) in WHISPERS"
      :key="w.text"
      class="whisper"
      :class="{ 'is-active': i === active }"
      :aria-hidden="i === active ? undefined : 'true'"
    >
      <div class="whisper-sheet">
        <p class="whisper-text">{{ w.text }}</p>
        <p v-if="w.note" class="whisper-note">{{ w.note }}</p>
      </div>
    </div>

    <!--
      收尾的一笔：一枚极淡的「完」。
      不放按钮、不放链接——彩蛋的出口是"继续往下滑"，
      不是"点这里"。想知道后面有什么，就自己滑下去。
    -->
    <div class="quiet-end-wrap" aria-hidden="true">
      <p class="quiet-end">完</p>
    </div>
  </section>
</template>

<style scoped>
.quiet {
  /*
   * 这一段的底色比正文深一点点，但还没到附录那么深。
   * 三步过渡：纸白（正文）→ 微暗（空白页）→ 暗场（附录）。
   * 一下跳到全黑会显得突兀，中间垫一层才像翻页时光线慢慢暗下去。
   */
  position: relative;
  background: color-mix(in srgb, var(--bg) 88%, var(--ink) 12%);
  border-top: 1px solid var(--line);
  /* 翻页的透视：所有"纸"共享同一个灭点 */
  perspective: 1400px;
  overflow: hidden;
}

/*
 * 暗场下这一层纱要透一点。
 * 白天它是"比纸深一档"的实底；夜里如果还是实底，
 * 这三屏就是三页纯黑，背景插画完全看不见。
 * 55% 的深色薄纱：底图透出来，上面的短句（--ink 亮色）仍然读得清。
 */
:global([data-theme='neon'] .quiet),
:global([data-zone='moyu'] .quiet) {
  background: color-mix(in srgb, var(--bg) 55%, transparent);
  border-top-color: color-mix(in srgb, var(--line) 60%, transparent);
}

/* ── 萤火 ───────────────────────────────────────────────── */
.fireflies {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

/* ── 每一句 ─────────────────────────────────────────────── */
.whisper {
  /*
   * 一行一屏。
   * 用 min-height 而不是 height：字号被系统放大时，
   * 句子能自己撑高，不会被裁掉半行。
   */
  position: relative;
  z-index: 1;
  min-height: 62vh;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 10px;
  padding: 40px 24px;
  text-align: center;
}

/*
 * 会翻的那张"纸"。
 * --p 由脚本每帧写入：0 = 侧着还没翻过来，1 = 摆正在面前。
 * 透明度跟着进度走——侧着的时候几乎看不见，转正了才亮起来，
 * 就像纸被翻过来的那一瞬间才看到字。
 */
.whisper-sheet {
  display: grid;
  justify-items: center;
  gap: 10px;
  opacity: calc(0.08 + 0.92 * var(--p, 1));
  transform: perspective(1400px) rotateY(calc((1 - var(--p, 1)) * -46deg))
    translateZ(calc((1 - var(--p, 1)) * -130px)) translateY(calc((1 - var(--p, 1)) * 14px));
  transform-origin: 100% 50%;
  will-change: transform, opacity;
}

.whisper.is-active .whisper-sheet {
  /* 摆正之后留一层很淡的影子，让"纸"有厚度 */
  filter: drop-shadow(0 6px 18px color-mix(in srgb, var(--ink) 14%, transparent));
}

.whisper-text {
  font-family: var(--font-quote);
  font-size: clamp(1.15rem, 2.6vw, 1.6rem);
  line-height: 1.7;
  letter-spacing: 0.06em;
  color: var(--ink);
  /* 中文长句在窄屏上断得难看，这里允许在任意字之间断 */
  word-break: break-word;
}

.whisper-note {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.16em;
  color: var(--ink-soft);
  /* 注脚永远比主句淡一档 */
  opacity: 0.75;
}

/* ── 收尾的「完」 ───────────────────────────────────────── */
.quiet-end-wrap {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  padding: 0 0 96px;
}

.quiet-end {
  padding: 24px 0 0;
  text-align: center;
  font-family: var(--font-display);
  font-size: 22px;
  letter-spacing: 0.4em;
  /* 印泥色，和文章末尾那枚章同一套语言 */
  color: var(--stamp-ink);
  opacity: 0.42;
}

/* ── 窄屏 ───────────────────────────────────────────────── */
@media (max-width: 767px) {
  .whisper {
    /* 手机上视口矮，一行一屏会滑得太久，缩到半屏多一点 */
    min-height: 52vh;
    padding: 32px 20px;
  }

  .quiet-end-wrap {
    padding-bottom: 72px;
  }
}

/*
 * 减少动效 / 站内关掉动效：
 * 不再翻页、不再放萤火，五句直接全部可见、靠得更近。
 * 这段的效果全靠滚动驱动，动效一关就什么都没了，
 * 与其留一堆看不清的淡字，不如老老实实排成几行。
 */
@media (prefers-reduced-motion: reduce) {
  .whisper {
    min-height: 0;
    padding: 22px 20px;
  }

  .whisper-sheet {
    opacity: 1;
    transform: none;
    filter: none;
  }

  .fireflies {
    display: none;
  }

  .quiet {
    padding-block: 40px 8px;
  }
}

[data-motion='off'] .whisper {
  min-height: 0;
  padding: 22px 20px;
}

[data-motion='off'] .whisper-sheet {
  opacity: 1;
  transform: none;
  filter: none;
}

[data-motion='off'] .fireflies {
  display: none;
}

[data-motion='off'] .quiet {
  padding-block: 40px 8px;
}
</style>
