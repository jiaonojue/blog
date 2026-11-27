<script setup lang="ts">
import { computed } from 'vue'
import { navItems, site } from '@/data/site.config'
import { settings, type ThemeName } from '@/composables/useSettings'
import { MOYU_TABS, moyuActive, moyuTab, setMoyuTab } from '@/composables/useMoyuZone'
import SiteMark from '@/components/ui/SiteMark.vue'
import SearchPanel from '@/components/layout/SearchPanel.vue'
import { Ellipsis, Settings } from '@lucide/vue'

const emit = defineEmits<{ 'open-settings': [] }>()

/** 只显示没被隐藏的导航项 */
const visibleItems = computed(() =>
  navItems.filter((item) => !settings.value.hiddenNav.includes(item.key)),
)

/*
 * 附录占着视口时，导航整体换成附录的四个栏目。
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
  <nav class="nav-dock" :class="{ 'is-appendix': moyuActive }" aria-label="主导航">
    <!-- 桌面：悬浮胶囊 -->
    <div class="dock-inner">
      <RouterLink to="/" class="dock-brand" aria-label="回到首页">
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
            v-for="item in visibleItems"
            :key="item.key"
            :to="item.path"
            class="dock-link"
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
