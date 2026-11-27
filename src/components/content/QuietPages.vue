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
 *   每行进入视口时淡入，离开时淡出——像翻一页只有一句话的纸。
 *
 * 【为什么句子是这些】
 *   全部围绕"你正在做的这件事"（读到这里）和"这本书的性质"（同人志），
 *   不提站主本人、不编造经历、不承诺任何东西。
 *   最后一句收在"回去继续读"，把人送回正文，而不是留在这页空转。
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { site } from '@/data/site.config'

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

/*
 * 收尾那一页旁边的小插画。
 * 【为什么是这张】比心道别的少女——正好接住"谢谢你读完"这句话。
 * 【为什么用径向遮罩】图是带背景的 JPG 转过来的，没有透明通道；
 * 直接贴上去就是一块方纸片。用 mask 把四周羽化掉，
 * 它就变成了"印在纸上的一小圈画"，和这一页的淡纸色融在一起。
 */
const girlUrl = (() => {
  const b = site.base.endsWith('/') ? site.base.slice(0, -1) : site.base
  return `${b}/art/girls/quiet-end.webp`
})()

const root = ref<HTMLElement | null>(null)
/** 当前亮着的那一句。扫过屏幕正中时切换 */
const active = ref(0)

let sections: HTMLElement[] = []
let io: IntersectionObserver | null = null
let pollTimer = 0

/**
 * 用"距屏幕中心的距离"挑最该亮的那一句。
 *
 * 【为什么不用 IntersectionObserver 逐句切换】
 *   观察器在滚动快的时候会跳过中间状态，两句同时亮或者全灭。
 *   直接算距离是连续的：任何时刻都有一个最近值，永远只有一句亮。
 *   这段只有五行，每帧量五个矩形，开销可以忽略。
 */
function sync() {
  if (!sections.length) return
  const mid = window.innerHeight / 2
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
  })
  active.value = best
}

let raf = 0
function onScroll() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    sync()
  })
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
   * 顺便用它来决定"这一段要不要占满高度"：
   * 减少动效时不想要"一行一屏"的长滚动，交给 CSS 处理即可，
   * 这里只负责把每句的淡入淡出接上。
   */
  io = new IntersectionObserver(() => sync(), { threshold: [0, 0.5, 1] })
  if (root.value) io.observe(root.value)
})

onUnmounted(() => {
  io?.disconnect()
  io = null
  window.clearInterval(pollTimer)
  if (raf) cancelAnimationFrame(raf)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <section ref="root" class="quiet" aria-labelledby="quiet-label" data-pagefind-ignore>
    <h2 id="quiet-label" class="sr-only">空白页</h2>

    <!-- 每句一屏。最后一句之后留一段空白，让"翻到附录"有个间隙 -->
    <div
      v-for="(w, i) in WHISPERS"
      :key="w.text"
      class="whisper"
      :class="{ 'is-active': i === active }"
      :aria-hidden="i === active ? undefined : 'true'"
    >
      <p class="whisper-text">{{ w.text }}</p>
      <p v-if="w.note" class="whisper-note">{{ w.note }}</p>
    </div>

    <!--
      收尾的一笔：一枚极淡的「完」，和她。
      不放按钮、不放链接——彩蛋的出口是"继续往下滑"，
      不是"点这里"。想知道后面有什么，就自己滑下去。
    -->
    <div class="quiet-end-wrap" aria-hidden="true">
      <img
        class="quiet-girl"
        :src="girlUrl"
        alt=""
        width="1000"
        height="750"
        loading="lazy"
        decoding="async"
      />
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

/* ── 每一句 ─────────────────────────────────────────────── */
.whisper {
  /*
   * 一行一屏。
   * 用 min-height 而不是 height：字号被系统放大时，
   * 句子能自己撑高，不会被裁掉半行。
   */
  min-height: 62vh;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 10px;
  padding: 40px 24px;
  text-align: center;
  /*
   * 默认很淡。这一段的重点不是"读清楚"，
   * 是"视线扫过去刚好看见"。太黑会变成标题。
   */
  opacity: 0.18;
  transform: translateY(6px);
  transition:
    opacity 520ms var(--ease-out),
    transform 520ms var(--ease-out);
}

.whisper.is-active {
  opacity: 1;
  transform: none;
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
/* ── 收尾：完 + 她 ──────────────────────────────────────── */
.quiet-end-wrap {
  position: relative;
  display: grid;
  justify-items: center;
  padding: 0 0 96px;
}

/*
 * 比心的少女。压得很淡——
 * 她是"这页纸上淡淡印着的一小笔"，不是一张贴图。
 * 图文件自带椭圆羽化的透明通道，四边平滑淡出。
 */
.quiet-girl {
  position: absolute;
  right: 14%;
  bottom: 18px;
  width: clamp(120px, 12vw, 170px);
  height: auto;
  opacity: 0.55;
  pointer-events: none;
}

.quiet-end {
  position: relative;
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

  /* 手机上她只留小小的一笔，别和正文抢地方 */
  .quiet-girl {
    width: 110px;
    bottom: 20px;
  }
}

/*
 * 减少动效 / 站内关掉动效：
 * 不再做"淡入淡出"，五句直接全部可见、靠得更近。
 * 这段的效果全靠透明度变化，动效一关就什么都没了，
 * 与其留一堆看不清的淡字，不如老老实实排成几行。
 */
@media (prefers-reduced-motion: reduce) {
  .whisper {
    min-height: 0;
    padding: 22px 20px;
    opacity: 1;
    transform: none;
    transition: none;
  }

  .quiet {
    padding-block: 40px 8px;
  }
}

[data-motion='off'] .whisper {
  min-height: 0;
  padding: 22px 20px;
  opacity: 1;
  transform: none;
  transition: none;
}

[data-motion='off'] .quiet {
  padding-block: 40px 8px;
}
</style>
