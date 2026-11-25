<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import NavDock from '@/components/layout/NavDock.vue'
import SiteFooter from '@/components/layout/SiteFooter.vue'
import SettingsPanel from '@/components/layout/SettingsPanel.vue'
import ScrollProgress from '@/components/layout/ScrollProgress.vue'
import CursorGlow from '@/components/motion/CursorGlow.vue'
import CursorDot from '@/components/motion/CursorDot.vue'
import { settings, motionEnabled } from '@/composables/useSettings'
import { initReadMarks } from '@/composables/useBook'
import { site } from '@/data/site.config'

const route = useRoute()
const settingsOpen = ref(false)

/** 转场名字由设置决定 */
const transitionName = computed(() => (settings.value.transition === 'wipe' ? 'wipe' : 'slide'))

/** Konami 秘技：↑↑↓↓←→←→BA */
const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
]
let konamiIndex = 0

function onKeydown(e: KeyboardEvent) {
  // ESC 关闭设置面板
  if (e.key === 'Escape' && settingsOpen.value) {
    settingsOpen.value = false
    return
  }

  // 输入框里打字时不触发彩蛋
  const target = e.target as HTMLElement | null
  if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return

  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  if (key === KONAMI[konamiIndex]) {
    konamiIndex += 1
    if (konamiIndex === KONAMI.length) {
      konamiIndex = 0
      if (route.name !== 'secret') window.location.href = `${site.base}secret`
    }
  } else {
    konamiIndex = key === KONAMI[0] ? 1 : 0
  }
}

onMounted(() => {
  // 既読记录只能在浏览器里读：预渲染时 localStorage 不存在，
  // 提前读会让人工渲染的 HTML 和客户端首帧对不上，Vue 会报水合不一致。
  initReadMarks()
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="app-shell">
    <!-- 噪点层：全站统一的纸感，纯装饰，不挡点击 -->
    <div class="noise-layer" aria-hidden="true" />

    <!-- 读屏/键盘用户跳过导航 -->
    <a class="skip-link" href="#main">跳到正文</a>

    <ScrollProgress />
    <NavDock @open-settings="settingsOpen = true" />

    <!--
      data-pagefind-body 是给 Pagefind 的标记：
      只有标了它的元素里的文字才会进搜索索引。
      加在 main 上，就意味着导航、页脚、标题栏都不会被搜到——
      不然搜「文章」会把每个页面的导航条都命中一次，结果全是噪音。
    -->
    <main id="main" class="app-main" data-pagefind-body>
      <RouterView v-slot="{ Component }">
        <Transition :name="transitionName" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>

    <SiteFooter />

    <SettingsPanel v-model:open="settingsOpen" />

    <!-- 桌面端专属的指针装饰 -->
    <CursorGlow v-if="motionEnabled && settings.cursorGlow" />
    <CursorDot v-if="motionEnabled && settings.customCursor" />
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  padding-top: 96px;
  /* 移动端底部 Dock 会挡住内容，留出空间 */
  padding-bottom: 24px;
}

@media (max-width: 767px) {
  .app-main {
    padding-top: 76px;
    padding-bottom: calc(84px + env(safe-area-inset-bottom));
  }
}

/* ── 噪点层 ─────────────────────────────────────────────── */
.noise-layer {
  position: fixed;
  inset: 0;
  z-index: var(--z-noise);
  pointer-events: none;
  opacity: var(--noise-opacity);
  /* 用 SVG feTurbulence 生成噪点，不需要图片文件 */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ── 转场：默认横向滑动 ─────────────────────────────────── */
.slide-enter-active,
.slide-leave-active {
  transition:
    opacity var(--t-base) var(--ease-out),
    transform var(--t-base) var(--ease-out);
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(18px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-18px);
}

/* ── 转场：漫画分格（4 格依次揭开） ─────────────────────── */
.wipe-enter-active {
  transition: clip-path var(--t-wipe) steps(4, end);
}

.wipe-leave-active {
  transition: opacity var(--t-fast) var(--ease-out);
}

.wipe-enter-from {
  clip-path: polygon(0 0, 0 0, 0 0, 0 0);
}

.wipe-enter-to {
  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
}

.wipe-leave-to {
  opacity: 0;
}

/* 减少动效时，转场只留淡入 */
[data-motion='off'] .slide-enter-from,
[data-motion='off'] .slide-leave-to {
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .slide-enter-from,
  .slide-leave-to {
    transform: none;
  }

  .wipe-enter-from {
    clip-path: none;
  }
}
</style>
