<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { navItems, site } from '@/data/site.config'
import { settings, motionEnabled, type ThemeName } from '@/composables/useSettings'
import { MOYU_TABS, moyuActive, moyuTab, setMoyuTab } from '@/composables/useMoyuZone'
import {
  dockSide,
  setDockSide,
  DOCK_SIDE_MIN_WIDTH,
  type DockSide,
} from '@/composables/useDockSide'
import SiteMark from '@/components/ui/SiteMark.vue'
import SearchPanel from '@/components/layout/SearchPanel.vue'
import { Ellipsis, Settings } from '@lucide/vue'

const emit = defineEmits<{ 'open-settings': [] }>()

/** 只显示没被隐藏的导航项 */
const visibleItems = computed(() =>
  navItems.filter((item) => !settings.value.hiddenNav.includes(item.key)),
)

/* ── 顶栏玩具：停靠位 ─────────────────────────────────────
 *
 * 点靠左的栏目，顶栏飞到屏幕左边竖成一条侧栏；靠右同理；
 * 点中间的栏目或左上角的印章，回到居中。
 * 真正的移动不是 CSS 过渡，而是 FLIP：先记录旧位置，
 * 换类让布局瞬间到位，再记录新位置，用 WAAPI 从旧位置飞过去，
 * 中途带一点空翻——布局永远是对的，动画只负责好看。
 */

const innerEl = ref<HTMLElement | null>(null)

/** 第 i 个栏目算出它该把顶栏拉到哪一侧 */
function dockForIndex(i: number, n: number): DockSide {
  const t = (i + 0.5) / Math.max(1, n)
  if (t < 0.42) return 'left'
  if (t > 0.58) return 'right'
  return 'center'
}

/** 从旧 rect 飞到新 rect，中途压缩 + 空翻一下 */
async function flyTo(side: DockSide) {
  const inner = innerEl.value
  const canFly = !!inner && motionEnabled.value && window.innerWidth >= DOCK_SIDE_MIN_WIDTH
  if (!canFly || !inner) {
    // 玩不了的环境（窄屏 / 动效关）：布局直接换，不做动画
    setDockSide(side)
    return
  }
  if (dockSide.value === side) return

  const first = inner.getBoundingClientRect()
  setDockSide(side)
  await nextTick()
  await new Promise((r) => requestAnimationFrame(r))
  const last = inner.getBoundingClientRect()

  // FLIP：让元素看起来"从旧位置出发"。位移按中心点算，缩放按尺寸比算
  const dx = first.left + first.width / 2 - (last.left + last.width / 2)
  const dy = first.top + first.height / 2 - (last.top + last.height / 2)
  const sx = first.width / last.width
  const sy = first.height / last.height

  inner.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(0deg)` },
      {
        // 途中收拢一点、翻一个小角度：像纸片被拎起来翻了个面
        transform: `translate(${dx * 0.28}px, ${dy * 0.26}px) scale(${((1 + sx) / 2) * 0.94}, ${((1 + sy) / 2) * 0.96}) rotate(-6deg)`,
        offset: 0.55,
      },
      { transform: 'translate(0, 0) scale(1, 1) rotate(0deg)' },
    ],
    { duration: 720, easing: 'cubic-bezier(0.34, 1.3, 0.48, 1)' },
  )
}

/**
 * 点了导航链接：按它在栏目里的位置决定飞往哪一侧。
 *
 * 【唯一的例外是「首页」】
 *   回首页 = 一切回到默认的样子，顶栏也回正中——
 *   它是"把玩具收回去"的那个按钮，跟点印章同一个意思。
 */
function onNavClick(i: number, item: { path: string }) {
  const side = item.path === '/' ? 'center' : dockForIndex(i, visibleItems.value.length)
  void flyTo(side)
}

/** 点印章回首页：顺便把顶栏送回居中 */
function onBrandClick() {
  void flyTo('center')
}

/*
 * 附录占着视口时，导航整体换成附录的五个栏目。
 *
 * 【为什么不是"多出一行"】
 *   胶囊里塞不下两套链接。既然读者此刻不在读正文，
 *   那五个入口就暂时没用，直接换掉比并排放着清楚。
 *   点附录里的栏目不会跳路由，只是把那一叠纸翻过去。
 */

/** 移动端最多显示 5 项 */
const dockItems = computed(() => visibleItems.value.slice(0, 5))

const themes: { key: ThemeName; label: string; glyph: string }[] = [
  { key: 'daylight', label: '日间', glyph: '日' },
  { key: 'neon', label: '霓虹', glyph: '夜' },
  { key: 'auto', label: '跟随系统', glyph: '随' },
]

function cycleTheme() {
  const order = themes.map((t) => t.key)
  const i = order.indexOf(settings.value.theme)
  const next = order[(i + 1) % order.length]
  if (next) settings.value.theme = next
}

const currentTheme = computed(
  () => themes.find((t) => t.key === settings.value.theme) ?? themes[0]!,
)
</script>

<template>
  <!--
    附录占着视口时，整个胶囊从顶部滑到底部，并换一套栏目。
    这是"从正文翻到附录"这件事在界面上的那一下：位置变了，内容也变了，
    读者立刻知道自己在另一叠纸上。
  -->
  <nav
    class="nav-dock"
    :class="{
      'is-appendix': moyuActive,
      'is-left': !moyuActive && dockSide === 'left',
      'is-right': !moyuActive && dockSide === 'right',
    }"
    aria-label="主导航"
  >
    <!-- 桌面：悬浮胶囊 -->
    <div ref="innerEl" class="dock-inner">
      <RouterLink to="/" class="dock-brand" aria-label="回到首页" @click="onBrandClick">
        <SiteMark :size="26" />
      </RouterLink>

      <span class="dock-divider" aria-hidden="true" />

      <ul class="dock-links">
        <!--
          两组链接叠在同一个格子里交叉淡入淡出。
          不用 v-if：v-if 会把旧节点直接摘掉，没有过渡可言。
          两组都常驻、只切 opacity / transform，才有"字在变"的感觉。
        -->
        <li class="dock-slot" :class="{ 'is-off': moyuActive }" :inert="moyuActive">
          <RouterLink
            v-for="(item, i) in visibleItems"
            :key="item.key"
            :to="item.path"
            class="dock-link"
            :style="{ '--i': i }"
            @click="onNavClick(i, item)"
          >
            {{ item.label }}
          </RouterLink>
        </li>

        <li
          class="dock-slot dock-slot--moyu"
          :class="{ 'is-off': !moyuActive }"
          :inert="!moyuActive"
        >
          <button
            v-for="(tab, i) in MOYU_TABS"
            :key="tab.key"
            type="button"
            class="dock-link"
            :class="{ 'is-moyu-current': i === moyuTab }"
            :aria-current="i === moyuTab ? 'true' : undefined"
            @click="setMoyuTab(i)"
          >
            {{ tab.label }}
          </button>
        </li>
      </ul>

      <span class="dock-divider" aria-hidden="true" />

      <!-- 搜索：只在 site.features.search 打开时出现 -->
      <SearchPanel v-if="site.features.search" />

      <button
        class="dock-icon"
        type="button"
        :title="`主题：${currentTheme.label}（点击切换）`"
        @click="cycleTheme"
      >
        <span class="sr-only">切换主题，当前 {{ currentTheme.label }}</span>
        <span class="theme-glyph" aria-hidden="true">{{ currentTheme.glyph }}</span>
      </button>

      <button class="dock-icon" type="button" title="打开设置" @click="emit('open-settings')">
        <span class="sr-only">打开设置</span>
        <Settings :size="17" :stroke-width="1.75" aria-hidden="true" />
      </button>
    </div>

    <!-- 移动：底部 Dock -->
    <div class="dock-mobile">
      <div class="dock-mobile-row" :class="{ 'is-off': moyuActive }" :inert="moyuActive">
        <RouterLink
          v-for="item in dockItems"
          :key="item.key"
          :to="item.path"
          class="dock-mobile-link"
        >
          {{ item.label }}
        </RouterLink>
        <button
          class="dock-mobile-link dock-mobile-more"
          type="button"
          title="打开设置"
          @click="emit('open-settings')"
        >
          <Ellipsis :size="18" :stroke-width="1.75" aria-hidden="true" />
          <span class="sr-only">打开设置</span>
        </button>
      </div>

      <div class="dock-mobile-row" :class="{ 'is-off': !moyuActive }" :inert="!moyuActive">
        <button
          v-for="(tab, i) in MOYU_TABS"
          :key="tab.key"
          type="button"
          class="dock-mobile-link"
          :class="{ 'is-moyu-current': i === moyuTab }"
          :aria-current="i === moyuTab ? 'true' : undefined"
          @click="setMoyuTab(i)"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
/* ── 桌面：悬浮胶囊 ─────────────────────────────────────── */
.nav-dock {
  position: fixed;
  top: 16px;
  left: 0;
  right: 0;
  z-index: var(--z-nav);
  display: flex;
  justify-content: center;
  padding-inline: 18px;
  pointer-events: none;
  /*
   * 附录区：整个胶囊滑到底部。
   * 用 top 的过渡而不是 transform —— 胶囊宽度由内容决定，
   * 用 transform 得算"从顶部到底部要移多少"，窗口一换高就得重算。
   * top 从 16px 到 (100% - 高 - 16px)，浏览器自己会插值。
   */
  transition: top 520ms var(--ease-out);
}

.nav-dock.is-appendix {
  top: calc(100dvh - 56px - 16px);
}

/*
 * 附录里胶囊换一层底色：正文那叠纸是浅的，附录这叠纸更深一点，
 * 胶囊跟过去的时候底色也得跟着变，否则会像一块贴错地方的白纸。
 */
.dock-inner {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 56px;
  padding: 0 10px 0 12px;
  max-width: 100%;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  box-shadow: var(--shadow);
  transition:
    background-color var(--t-slow) var(--ease-out),
    border-color var(--t-slow) var(--ease-out);
}

.nav-dock.is-appendix .dock-inner {
  background: color-mix(in srgb, var(--surface) 92%, var(--accent) 5%);
  border-color: color-mix(in srgb, var(--accent) 34%, var(--line));
}

/* ── 顶栏玩具：停靠到屏幕两侧，竖成一条侧栏 ───────────────
 *
 * 【布局为什么不用过渡】
 *   横胶囊变竖侧栏是布局变化（宽高、排列方向），
 *   width / flex-direction 都不能平滑过渡。
 *   所以布局切换是瞬间的，"飞过去"这件事交给脚本里的
 *   FLIP 动画（见 flyTo）：先量旧位置，切换，量新位置，
 *   再从旧位置飞到新位置。布局永远正确，动画只负责好看。
 *
 * 【为什么只在宽屏生效】
 *   1366px 以下正文会顶到屏幕边，竖在旁边的侧栏会压住标题。
 *   脚本里拦了宽度，这里再兜一层：窄屏就算类名挂上了也不显示异常——
 *   类名本来就挂不上（脚本不放行）。
 */
.nav-dock.is-left {
  justify-content: flex-start;
}

.nav-dock.is-right {
  justify-content: flex-end;
}

/* 竖侧栏本体：从横胶囊变成一条书签带 */
.nav-dock.is-left .dock-inner,
.nav-dock.is-right .dock-inner {
  flex-direction: column;
  height: auto;
  width: 76px;
  padding: 10px 8px;
  gap: 6px;
  /* 书签带的角比胶囊方正一点，但它还是"纸"做的 */
  border-radius: 18px;
}

/* 分隔线躺下来 */
.nav-dock.is-left .dock-divider,
.nav-dock.is-right .dock-divider {
  width: 24px;
  height: 1px;
  margin-inline: 0;
}

/* 链接竖着排。悬停横线转到字底下不变，底色逻辑原样生效 */
.nav-dock.is-left .dock-links,
.nav-dock.is-right .dock-links {
  padding-block: 0;
  margin-block: 0;
  overflow: visible;
}

.nav-dock.is-left .dock-slot,
.nav-dock.is-right .dock-slot {
  flex-direction: column;
  gap: 0;
}

.nav-dock.is-left .dock-link,
.nav-dock.is-right .dock-link {
  padding: 7px 0;
  text-align: center;
}

/* 侧栏状态下，当前页的胶囊底色收窄成一行一小块，跟横排时同宽 */
.nav-dock.is-left .dock-link.router-link-exact-active,
.nav-dock.is-right .dock-link.router-link-exact-active,
.nav-dock.is-left .dock-link.is-moyu-current,
.nav-dock.is-right .dock-link.is-moyu-current {
  border-radius: var(--r-pill);
}

.dock-brand {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border-radius: 8px;
}

.dock-divider {
  width: 1px;
  height: 20px;
  margin-inline: 6px;
  background: var(--line);
  flex: 0 0 auto;
}

/*
 * 两组链接叠在同一个格子里：容器宽度取两组里较宽的那一组，
 * 切换时只动 opacity 和一点点位移，胶囊宽度不会突然跳一下。
 *
 * 用 grid 的同一格（grid-area: 1 / 1）而不是绝对定位：
 * 绝对定位的那一组不参与尺寸计算，容器会塌；
 * 同一格里两组都在文档流里，宽度自然是两者的最大值。
 */
.dock-links {
  display: grid;
  align-items: center;
  /* ±4px 的位移不该被裁掉，用 padding 撑开再负 margin 收回 */
  padding-block: 8px;
  margin-block: -8px;
  overflow: hidden;
}

.dock-slot {
  grid-area: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition:
    opacity var(--t-base) var(--ease-out),
    transform var(--t-base) var(--ease-out);
}

.dock-slot.is-off {
  opacity: 0;
  pointer-events: none;
  /* 旧文字轻轻往上退，新文字从下面接上来 */
  transform: translateY(-4px);
}

.dock-slot--moyu.is-off {
  transform: translateY(4px);
}

.dock-link {
  display: block;
  position: relative;
  padding: 8px 14px;
  border-radius: var(--r-pill);
  font-size: 14px;
  color: var(--ink-soft);
  white-space: nowrap;
  transition:
    color var(--t-fast) var(--ease-out),
    background-color var(--t-fast) var(--ease-out);
}

/* 附录栏目是 <button>，得自己把浏览器的默认样式清掉 */
button.dock-link {
  font-family: inherit;
  line-height: inherit;
}

/*
 * 悬停时字底下长出一条短横线。
 * 整块换底色留给"当前页面"，悬停只加这一笔，
 * 两个状态才分得清。
 */
.dock-link::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 5px;
  width: 12px;
  height: 2px;
  margin-left: -6px;
  border-radius: 1px;
  background: var(--accent);
  transform: scaleX(0);
  transition: transform var(--t-base) var(--ease-out);
}

.dock-link:hover::before {
  transform: scaleX(1);
}

/* 当前页已经有实心底色，不再叠一条线 */
.dock-link.router-link-exact-active::before {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .dock-link::before {
    transition: none;
  }
}

[data-motion='off'] .dock-link::before {
  transition: none;
}

.dock-link:hover {
  color: var(--ink);
  background: var(--bg-soft);
}

/* 当前所在页面：樱粉底色 */
.dock-link.router-link-exact-active {
  color: var(--accent-ink);
  background: var(--accent);
}

/* 附录区里当前那一页：同一个强调色，但它是按钮不是链接 */
.dock-link.is-moyu-current {
  color: var(--accent-ink);
  background: var(--accent);
}

.dock-link.is-moyu-current::before {
  display: none;
}

.dock-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: var(--r-pill);
  color: var(--ink-soft);
  transition:
    color var(--t-fast) var(--ease-out),
    background-color var(--t-fast) var(--ease-out);
}

.dock-icon:hover {
  color: var(--ink);
  background: var(--bg-soft);
}

.theme-glyph {
  font-family: var(--font-display);
  font-size: 15px;
  line-height: 1;
}

/* ── 移动端 ─────────────────────────────────────────────── */
.dock-mobile {
  display: none;
}

@media (max-width: 767px) {
  .nav-dock {
    top: auto;
    bottom: 0;
    padding: 0 12px calc(10px + env(safe-area-inset-bottom));
  }

  /* 手机上导航本来就在底部，附录区不需要位移，只换内容 */
  .nav-dock.is-appendix {
    top: auto;
  }

  .dock-inner {
    display: none;
  }

  .dock-mobile {
    pointer-events: auto;
    position: relative;
    display: grid;
    width: 100%;
    height: 60px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line);
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    box-shadow: var(--shadow);
    transition:
      background-color var(--t-slow) var(--ease-out),
      border-color var(--t-slow) var(--ease-out);
  }

  .nav-dock.is-appendix .dock-mobile {
    background: color-mix(in srgb, var(--surface) 92%, var(--accent) 5%);
    border-color: color-mix(in srgb, var(--accent) 34%, var(--line));
  }

  /* 两组也叠在同一格，交叉淡入淡出 */
  .dock-mobile-row {
    grid-area: 1 / 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2px;
    padding: 0 8px;
    transition:
      opacity var(--t-base) var(--ease-out),
      transform var(--t-base) var(--ease-out);
  }

  .dock-mobile-row.is-off {
    opacity: 0;
    pointer-events: none;
    transform: translateY(-5px);
  }

  .dock-mobile-row:last-child.is-off {
    transform: translateY(5px);
  }

  .dock-mobile-link {
    flex: 1;
    display: grid;
    place-items: center;
    /* 最小点击区 44×44，手指才点得准 */
    min-height: 44px;
    border-radius: var(--r-pill);
    font-size: 13px;
    color: var(--ink-soft);
    transition:
      color var(--t-fast) var(--ease-out),
      background-color var(--t-fast) var(--ease-out);
  }

  /* 附录栏目在底部是 <button>，清掉默认字体与内边距 */
  button.dock-mobile-link {
    padding: 0;
    font-family: inherit;
  }

  .dock-mobile-link.router-link-exact-active {
    color: var(--accent-ink);
    background: var(--accent);
  }

  .dock-mobile-link.is-moyu-current {
    color: var(--accent-ink);
    background: var(--accent);
  }

  .dock-mobile-more {
    max-width: 52px;
  }
}

/* 平板：胶囊里缩小内边距，避免挤 */
@media (min-width: 768px) and (max-width: 1023px) {
  .dock-link {
    padding: 8px 10px;
    font-size: 13px;
  }
}
</style>
