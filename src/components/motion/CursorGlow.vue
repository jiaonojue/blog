<script setup lang="ts">
/**
 * 桌面鼠标光斑 —— 跟随鼠标的柔和径向渐变。
 * 只在有真实指针的设备上启用（触屏设备不加载）。
 */
import { ref, onMounted, onUnmounted } from 'vue'

const el = ref<HTMLDivElement | null>(null)
const x = ref(-999)
const y = ref(-999)
let raf = 0
let targetX = -999
let targetY = -999

function onMove(e: PointerEvent) {
  targetX = e.clientX
  targetY = e.clientY
}

function loop() {
  // 缓动跟随，比直接跟手更"呼吸"
  x.value += (targetX - x.value) * 0.12
  y.value += (targetY - y.value) * 0.12
  if (el.value) {
    el.value.style.transform = `translate3d(${x.value - 160}px, ${y.value - 160}px, 0)`
  }
  raf = requestAnimationFrame(loop)
}

onMounted(() => {
  // 触屏设备不启用
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
  window.addEventListener('pointermove', onMove, { passive: true })
  raf = requestAnimationFrame(loop)
})

onUnmounted(() => {
  window.removeEventListener('pointermove', onMove)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div ref="el" class="cursor-glow no-print" aria-hidden="true" />
</template>

<style scoped>
.cursor-glow {
  position: fixed;
  top: 0;
  left: 0;
  width: 320px;
  height: 320px;
  z-index: var(--z-content);
  pointer-events: none;
  border-radius: 50%;
  background: radial-gradient(circle, var(--glow-color) 0%, transparent 68%);
  mix-blend-mode: var(--glow-blend);
  will-change: transform;
}
</style>
