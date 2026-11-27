<script setup lang="ts">
/**
 * 页面背景层 —— 一张淡淡的插画铺在内容后面，负责定气氛。
 *
 * 【为什么单独做成组件】
 *   每篇文章、每个栏目、每个标签都要用，样式和遮罩逻辑完全一样。
 *   抽出来之后，改一次透明度全站生效，也不会出现某页忘了加遮罩导致看不清字。
 *
 * 【怎么保证文字看得清】
 *   1. 图片本身压到很低的透明度
 *   2. 上面再盖一层从页面底色到透明的渐变
 *   3. 再叠一层极细的噪点（和站里其它纸片一致）
 *   三者叠加，背景只是"有颜色"，不会干扰阅读。
 */
import { computed } from 'vue'
import { backgroundFor } from '@/composables/useBackground'

const props = withDefaults(
  defineProps<{
    /** 决定用哪张图，同一个 key 永远同一张 */
    seed: string
    /** 图片整体强度，0 ~ 1。文章页低一点，栏目页可以高一点 */
    strength?: number
  }>(),
  { strength: 1 },
)

const style = computed(() => {
  const url = props.seed ? backgroundFor(props.seed) : ''
  return {
    backgroundImage: url ? `url("${url}")` : 'none',
    opacity: String(props.strength),
  }
})
</script>

<template>
  <div v-if="seed" class="page-bg no-print" aria-hidden="true">
    <div class="page-bg-img" :style="style" />
    <div class="page-bg-veil page-bg-veil--dim" aria-hidden="true" />
    <div class="page-bg-veil" aria-hidden="true" />
  </div>
</template>

<style scoped>
.page-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.page-bg-img {
  position: absolute;
  /* 比视口大一圈，滚动时不会露出白边 */
  inset: -4%;
  background-size: cover;
  background-position: center;
  /* 背景永远是虚的：虚化之后细节消失，只剩色块和光感 */
  filter: blur(3px) saturate(1.05);
  /* 极慢的呼吸位移，让页面"活着"，但几乎察觉不到 */
  animation: bg-drift 42s ease-in-out infinite alternate;
  will-change: transform;
}

@keyframes bg-drift {
  from {
    transform: scale(1.04) translate3d(0, 0, 0);
  }
  to {
    transform: scale(1.09) translate3d(-1.2%, -0.8%, 0);
  }
}

/*
 * 遮罩：从顶部到底部逐渐变实，保证正文区域（页面中下部）背景最淡。
 * 用 --bg 而不是写死白色，这样夜间主题自动跟着换。
 *
 * 【为什么有两层纱】
 *   白天这层纱很厚（插画几乎只剩光感）；到了暗场如果还是这么厚，
 *   插画就真的"一片黑"了——深色底 + 厚纱 + 压暗滤镜三层叠上去，
 *   图等于不存在。所以夜里换一层开孔大得多的薄纱。
 *   两层都用 opacity 淡入淡出（opacity 是天然可过渡的属性），
 *   切主题时纱跟着 520ms 一起变，不会闪。
 */
.page-bg-veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--bg) 62%, transparent) 0%,
    color-mix(in srgb, var(--bg) 80%, transparent) 34%,
    color-mix(in srgb, var(--bg) 92%, transparent) 68%,
    var(--bg) 100%
  );
  transition: opacity var(--t-slow) var(--ease-in-out);
}

/* 暗场用的薄纱：只压正文区，天空和画面主体透出来 */
.page-bg-veil--dim {
  opacity: 0;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--bg) 26%, transparent) 0%,
    color-mix(in srgb, var(--bg) 38%, transparent) 34%,
    color-mix(in srgb, var(--bg) 58%, transparent) 68%,
    var(--bg) 100%
  );
}

/*
 * 暗场（霓虹主题 / 摸鱼分区）换纱。
 * 为什么整条选择器都放进 :global()：主题属性挂在 <html> 上，
 * 不在本组件的 DOM 里，只把前缀放 :global() 会因为哈希对不上而永远匹配不到。
 */
:global([data-theme='neon'] .page-bg-veil),
:global([data-zone='moyu'] .page-bg-veil) {
  opacity: 0;
}

:global([data-theme='neon'] .page-bg-veil--dim),
:global([data-zone='moyu'] .page-bg-veil--dim) {
  opacity: 1;
}

/*
 * 暗场下的插画只轻轻压一点。
 * 以前是 brightness(0.72)：滤镜压暗 + 厚纱 + 深底三层叠加后，
 * 画面细节全被吃掉，看起来就是一整块黑。0.92 刚好——
 * 亮部还发亮，暗部沉得下去，和深紫底融成一体。
 */
:global([data-theme='neon'] .page-bg-img),
:global([data-zone='moyu'] .page-bg-img) {
  filter: blur(3px) saturate(1.02) brightness(0.92);
}

/* 关掉动效时不要那点呼吸位移 */
:global([data-motion='off'] .page-bg-img) {
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .page-bg-img {
    animation: none;
  }
}

/* 打印时背景纯属浪费墨水 */
@media print {
  .page-bg {
    display: none;
  }
}
</style>
