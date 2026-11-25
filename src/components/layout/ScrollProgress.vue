<script setup lang="ts">
/** 阅读进度条 —— 只在文章详情页顶部显示 */
import { ref, onMounted, onUnmounted } from 'vue'

const progress = ref(0)

function update() {
  const doc = document.documentElement
  const max = doc.scrollHeight - doc.clientHeight
  progress.value = max > 0 ? Math.min(100, (doc.scrollTop / max) * 100) : 0
}

let ticking = false
function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    update()
    ticking = false
  })
}

onMounted(() => {
  update()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <div class="scroll-progress no-print" aria-hidden="true">
    <div class="scroll-progress-bar" :style="{ transform: `scaleX(${progress / 100})` }" />
  </div>
</template>

<style scoped>
.scroll-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: calc(var(--z-nav) + 1);
  height: 2px;
  background: transparent;
}

.scroll-progress-bar {
  height: 100%;
  background: var(--accent);
  transform-origin: left center;
  will-change: transform;
}
</style>
