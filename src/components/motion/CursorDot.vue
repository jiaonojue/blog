<script setup lang="ts">
/**
 * 自定义光标 —— 小圆点 + 延迟跟随的外环。
 *
 * 只在有真实指针的设备上启用。
 * 点击处会有一次扩散反馈。
 */
import { ref, onMounted, onUnmounted } from 'vue'

const dot = ref<HTMLDivElement | null>(null)
const ring = ref<HTMLDivElement | null>(null)

let rx = -100
let ry = -100
let tx = -100
let ty = -100
let raf = 0
let hovering = false

function onMove(e: PointerEvent) {
  tx = e.clientX
  ty = e.clientY
  if (dot.value) {
    dot.value.style.transform = `translate3d(${tx - 4}px, ${ty - 4}px, 0)`
  }
  // 悬停在可点击元素上时外环放大
  const el = e.target as HTMLElement | null
  hovering = !!el?.closest('a, button, input, summary, [role="button"]')
}

function loop() {
  rx += (tx - rx) * 0.18
  ry += (ty - ry) * 0.18
  if (ring.value) {
    const s = hovering ? 1.9 : 1
    ring.value.style.transform = `translate3d(${rx - 12}px, ${ry - 12}px, 0) scale(${s})`
    ring.value.style.opacity = hovering ? '0.75' : '0.4'
  }
  raf = requestAnimationFrame(loop)
}

function onClick(e: PointerEvent) {
  const pulse = document.createElement('span')
  pulse.className = 'cursor-pulse'
  pulse.style.left = `${e.clientX}px`
  pulse.style.top = `${e.clientY}px`
  document.body.appendChild(pulse)
  window.setTimeout(() => pulse.remove(), 520)
}

onMounted(() => {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
  document.documentElement.classList.add('has-custom-cursor')
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onClick, { passive: true })
  raf = requestAnimationFrame(loop)
})

onUnmounted(() => {
  document.documentElement.classList.remove('has-custom-cursor')
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerdown', onClick)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div ref="dot" class="cursor-dot no-print" aria-hidden="true" />
  <div ref="ring" class="cursor-ring no-print" aria-hidden="true" />
</template>

<style scoped>
.cursor-dot,
.cursor-ring {
  position: fixed;
  top: 0;
  left: 0;
  pointer-events: none;
  border-radius: 50%;
  will-change: transform;
}

.cursor-dot {
  width: 8px;
  height: 8px;
  z-index: calc(var(--z-cursor) + 1);
  background: var(--accent);
}

.cursor-ring {
  width: 24px;
  height: 24px;
  z-index: var(--z-cursor);
  border: 1.5px solid var(--accent);
  opacity: 0.4;
  transition: opacity var(--t-fast) var(--ease-out);
}

/*
 * 系统光标隐藏（但输入框保留，否则打字看不见插入点）
 *
 * 【整条选择器都要放进 :global()】
 *   Vue 的 scoped 编译只保留 :global() 括号里的那一段，括号外的部分会被丢掉。
 *   写成 `:global(.has-custom-cursor) a` 的话，产物会塌缩成裸的 `.has-custom-cursor`，
 *   `a` / `button` 这些后缀就没了——规则等于没写。
 */
:global(.has-custom-cursor),
:global(.has-custom-cursor a),
:global(.has-custom-cursor button) {
  cursor: none;
}

:global(.has-custom-cursor input),
:global(.has-custom-cursor textarea) {
  cursor: text;
}
</style>

<style>
/* 点击扩散反馈：用普通 style 块因为要挂到 body 上 */
.cursor-pulse {
  position: fixed;
  z-index: var(--z-cursor);
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  border: 1.5px solid var(--accent);
  pointer-events: none;
  animation: cursor-pulse 520ms var(--ease-out) forwards;
}

@keyframes cursor-pulse {
  from {
    transform: scale(0.6);
    opacity: 0.8;
  }
  to {
    transform: scale(3.4);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cursor-pulse {
    display: none;
  }
}
</style>
