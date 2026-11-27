<script setup lang="ts">
/**
 * 花瓣粒子 —— 首页主视觉层的轻量 canvas 装饰。
 * 上限 18 个粒子，opacity ≤ 0.5，移动端与减少动效下自动关闭。
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { motionEnabled } from '@/composables/useSettings'

const canvas = ref<HTMLCanvasElement | null>(null)
let raf = 0
let ctx: CanvasRenderingContext2D | null = null

interface Petal {
  x: number
  y: number
  r: number
  vy: number
  vx: number
  rot: number
  vr: number
  alpha: number
}

const MAX_PETALS = 18

function createPetal(w: number, h: number, scatter = false): Petal {
  return {
    x: Math.random() * w,
    y: scatter ? Math.random() * h : -20,
    r: 3 + Math.random() * 5,
    vy: 0.25 + Math.random() * 0.45,
    vx: -0.2 + Math.random() * 0.4,
    rot: Math.random() * Math.PI * 2,
    vr: -0.01 + Math.random() * 0.02,
    alpha: 0.18 + Math.random() * 0.22,
  }
}

function resize() {
  const el = canvas.value
  if (!el) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  el.width = el.clientWidth * dpr
  el.height = el.clientHeight * dpr
  ctx = el.getContext('2d')
  ctx?.scale(dpr, dpr)
}

function drawPetal(p: Petal) {
  if (!ctx) return
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rot)
  ctx.globalAlpha = p.alpha

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  ctx.fillStyle = accent || '#ff5c8a'

  // 一片花瓣：两个圆弧拼出的椭圆
  ctx.beginPath()
  ctx.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

onMounted(() => {
  if (!motionEnabled.value) return
  // 移动端关闭，省电省性能
  if (!window.matchMedia('(min-width: 768px)').matches) return

  const el = canvas.value
  if (!el) return

  resize()
  const w = () => el.clientWidth
  const h = () => el.clientHeight
  const petals: Petal[] = Array.from({ length: MAX_PETALS }, () => createPetal(w(), h(), true))

  /*
   * 风：来自页面滚动本身。
   * 滚得越快，横向的风越大，花瓣被"吹"得横着飘；
   * 松手之后风慢慢停。方向跟滚动方向一致——
   * 往下滑等于风往下扫，花瓣就往右跑（下一页的意思）。
   */
  let wind = 0
  let lastY = window.scrollY
  const onWind = () => {
    const dy = window.scrollY - lastY
    lastY = window.scrollY
    wind += Math.max(-2.4, Math.min(2.4, dy * 0.012))
    wind = Math.max(-2.4, Math.min(2.4, wind))
  }
  window.addEventListener('scroll', onWind, { passive: true })

  const step = () => {
    if (!ctx) return
    ctx.clearRect(0, 0, w(), h())
    // 每帧衰减：冲动过去后回归无风
    wind *= 0.94
    for (const p of petals) {
      p.y += p.vy
      p.x += p.vx + wind
      p.rot += p.vr + wind * 0.004
      if (p.y > h() + 20) Object.assign(p, createPetal(w(), h()))
      // 被风吹出边界的那一侧，从另一边接回来
      if (p.x > w() + 24) p.x = -24
      if (p.x < -24) p.x = w() + 24
      drawPetal(p)
    }
    raf = requestAnimationFrame(step)
  }

  raf = requestAnimationFrame(step)
  window.addEventListener('resize', resize, { passive: true })
})

onUnmounted(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <canvas ref="canvas" class="petal-field no-print" aria-hidden="true" />
</template>

<style scoped>
.petal-field {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}
</style>
