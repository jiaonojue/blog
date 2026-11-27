<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import NavDock from '@/components/layout/NavDock.vue'
import SiteFooter from '@/components/layout/SiteFooter.vue'
import SettingsPanel from '@/components/layout/SettingsPanel.vue'
import ScrollProgress from '@/components/layout/ScrollProgress.vue'
import PageBackdrop from '@/components/layout/PageBackdrop.vue'
import BookSpine from '@/components/layout/BookSpine.vue'
import CursorGlow from '@/components/motion/CursorGlow.vue'
import CursorDot from '@/components/motion/CursorDot.vue'
import { settings, motionEnabled } from '@/composables/useSettings'
import { initReadMarks } from '@/composables/useBook'
import { activeBackdrop, setBackdrop } from '@/composables/useBackground'
import { site } from '@/data/site.config'

const route = useRoute()
const settingsOpen = ref(false)

/** 转场名字由设置决定 */
const transitionName = computed(() => (settings.value.transition === 'fade' ? 'fade' : 'drift'))

/**
 * 背景种子 —— 决定这一屏用哪张插画。
 *
 * 默认用完整路径：同一个网址永远同一张图，截图和分享都对得上；
 * 不同文章路径不同，自然就各自换了背景。
 * 页面如果主动指定了（比如列表页切分类），以页面为准。
 */
const bgSeed = computed(() => activeBackdrop.value || `route:${route.path}`)

/**
 * 换页时把页面的背景覆盖清掉。
 *
 * 列表页切分类时会指定背景，如果不清，跳到文章页后背景还停在列表页那张。
 * 用 route.path 做监听源：路径一变就清，页面自己会在 mounted 时重新指定。
 */
watch(
  () => route.path,
  () => setBackdrop(''),
)

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
    <!--
      背景插画：整站固定一层，跟着路由换图。
      放在最底下（z-index 0），正文和导航都在它上面。
    -->
    <PageBackdrop :seed="bgSeed" :strength="0.55" />

    <!-- 噪点层：全站统一的纸感，纯装饰，不挡点击 -->
    <div class="noise-layer" aria-hidden="true" />

    <!-- 读屏/键盘用户跳过导航 -->
    <a class="skip-link" href="#main">跳到正文</a>

    <ScrollProgress />
    <NavDock @open-settings="settingsOpen = true" />

    <!-- 书脊：宽屏左边缘的竖排信息条 + 随机翻页骰子 -->
    <BookSpine />

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
  /* 背景层用 --bg 铺底，页面本身不要有底色，否则背景图被盖住 */
  background: transparent;
}

.app-main {
  flex: 1;
  padding-top: 96px;
  /* 移动端底部 Dock 会挡住内容，留出空间 */
  padding-bottom: 24px;
  /*
   * 背景层是 position: fixed，必须把正文抬到它上面，
   * 否则整页文字会被压在背景下面看不见。
   */
  position: relative;
  z-index: var(--z-content);
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

/* ── 转场：drift（默认）───────────────────────────────────
 *
 * 【为什么这样能"和上一页有联系"】
 *   1. 背景层（PageBackdrop）是常驻的，切页时不重建，只是慢慢换图。
 *      所以新页面出来时，底色和气氛是接着上一页的，不会"白闪一下"。
 *   2. 旧页面向上飘走、新页面从下面浮上来，方向一致，像掀过一页纸。
 *      两边都在动，中间没有"两个都不在"的空档（mode="out-in" 会有一点，
 *      所以旧页面先淡到 0 之前新页面还没进来，靠背景层兜住）。
 *   3. 位移只有 12px，不是整屏滑动——大位移会让人觉得"跳了一下"。
 */
.drift-enter-active {
  transition:
    opacity var(--t-drift) var(--ease-out),
    transform var(--t-drift) var(--ease-out);
}

.drift-leave-active {
  transition:
    opacity var(--t-base) var(--ease-out),
    transform var(--t-base) var(--ease-out);
}

.drift-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.drift-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ── 转场：fade（最安静） ──────────────────────────────── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--t-base) var(--ease-out);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 关掉动效 / 系统要求减少动效：只留极短的淡入，位移全部取消 */
[data-motion='off'] .drift-enter-from,
[data-motion='off'] .drift-leave-to {
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .drift-enter-from,
  .drift-leave-to {
    transform: none;
  }
}
</style>
