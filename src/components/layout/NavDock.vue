<script setup lang="ts">
import { computed } from 'vue'
import { navItems, site } from '@/data/site.config'
import { settings, type ThemeName } from '@/composables/useSettings'
import SiteMark from '@/components/ui/SiteMark.vue'
import SearchPanel from '@/components/layout/SearchPanel.vue'
import { Ellipsis, Settings } from '@lucide/vue'

const emit = defineEmits<{ 'open-settings': [] }>()

/** 只显示没被隐藏的导航项 */
const visibleItems = computed(() =>
  navItems.filter((item) => !settings.value.hiddenNav.includes(item.key)),
)

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
  <nav class="nav-dock" aria-label="主导航">
    <!-- 桌面：顶部悬浮胶囊 -->
    <div class="dock-inner">
      <RouterLink to="/" class="dock-brand" aria-label="回到首页">
        <SiteMark :size="26" />
      </RouterLink>

      <span class="dock-divider" aria-hidden="true" />

      <ul class="dock-links">
        <li v-for="item in visibleItems" :key="item.key">
          <RouterLink :to="item.path" class="dock-link">{{ item.label }}</RouterLink>
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
  </nav>
</template>

<style scoped>
/* ── 桌面：顶部悬浮胶囊 ─────────────────────────────────── */
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
}

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

.dock-links {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow: hidden;
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

  .dock-inner {
    display: none;
  }

  .dock-mobile {
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2px;
    width: 100%;
    height: 60px;
    padding: 0 8px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line);
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    backdrop-filter: blur(16px) saturate(1.4);
    -webkit-backdrop-filter: blur(16px) saturate(1.4);
    box-shadow: var(--shadow);
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

  .dock-mobile-link.router-link-exact-active {
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
