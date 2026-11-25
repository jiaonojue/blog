<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { gallery, withBase } from '@/composables/useContent'
import { useSeo } from '@/composables/useSeo'
import TapeLabel from '@/components/ui/TapeLabel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import RevealOnScroll from '@/components/motion/RevealOnScroll.vue'
import { X, ChevronLeft, ChevronRight } from '@lucide/vue'

useSeo({ title: '相册', description: '一些随手拍下的风景和日常。' })

/** 灯箱当前索引，-1 表示关闭 */
const current = ref(-1)

const currentItem = computed(() => (current.value >= 0 ? gallery[current.value] : undefined))

function open(i: number) {
  current.value = i
}

function close() {
  current.value = -1
}

function prev() {
  if (!gallery.length) return
  current.value = (current.value - 1 + gallery.length) % gallery.length
}

function next() {
  if (!gallery.length) return
  current.value = (current.value + 1) % gallery.length
}

function onKey(e: KeyboardEvent) {
  if (current.value < 0) return
  if (e.key === 'Escape') close()
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
}

/** 打开灯箱时锁住页面滚动 */
watch(current, (v) => {
  document.body.style.overflow = v >= 0 ? 'hidden' : ''
})

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="container gallery-page">
    <header class="page-head">
      <TapeLabel>album</TapeLabel>
      <h1 class="page-title t-display">相册</h1>
      <p class="page-desc">随手拍下的风景、桌面、街角。点开可以看大图。</p>
    </header>

    <EmptyState v-if="!gallery.length" title="相册还是空的" desc="等我拍到满意的一张。" />

    <!-- 瀑布流：用 CSS columns 最省事，图片高度不一也不会裂 -->
    <div v-else class="masonry">
      <RevealOnScroll v-for="(item, i) in gallery" :key="item.image" :delay="Math.min(i * 50, 250)">
        <button class="tile" type="button" @click="open(i)">
          <img
            :src="withBase(item.image)"
            :alt="item.caption || item.title"
            loading="lazy"
            decoding="async"
          />
          <span v-if="item.sample" class="tile-sample">示例</span>
          <span class="tile-caption">
            <span class="tile-title">{{ item.title }}</span>
            <span v-if="item.date" class="tile-date">{{ item.date.replace(/-/g, '.') }}</span>
          </span>
        </button>
      </RevealOnScroll>
    </div>

    <!-- ══ 灯箱 ═══════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition name="lightbox">
        <div
          v-if="currentItem"
          class="lightbox"
          role="dialog"
          aria-modal="true"
          :aria-label="currentItem.title"
          @click.self="close"
        >
          <button class="lb-btn lb-close" type="button" @click="close">
            <span class="sr-only">关闭</span>
            <X :size="20" :stroke-width="2" aria-hidden="true" />
          </button>

          <button class="lb-btn lb-prev" type="button" @click="prev">
            <span class="sr-only">上一张</span>
            <ChevronLeft :size="22" :stroke-width="2" aria-hidden="true" />
          </button>

          <figure class="lb-figure">
            <img
              :src="withBase(currentItem.image)"
              :alt="currentItem.caption || currentItem.title"
            />
            <figcaption>
              <strong>{{ currentItem.title }}</strong>
              <span v-if="currentItem.caption">· {{ currentItem.caption }}</span>
            </figcaption>
          </figure>

          <button class="lb-btn lb-next" type="button" @click="next">
            <span class="sr-only">下一张</span>
            <ChevronRight :size="22" :stroke-width="2" aria-hidden="true" />
          </button>

          <p class="lb-count">{{ current + 1 }} / {{ gallery.length }}</p>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.gallery-page {
  padding-top: 24px;
}

.page-head {
  max-width: 640px;
  margin-bottom: 40px;
}

.page-title {
  margin-top: 12px;
}

.page-desc {
  margin-top: 14px;
  color: var(--ink-soft);
  font-size: 15px;
}

/* ── 瀑布流 ─────────────────────────────────────────────── */
.masonry {
  columns: 3;
  column-gap: 16px;
}

@media (max-width: 1023px) {
  .masonry {
    columns: 2;
  }
}

@media (max-width: 479px) {
  .masonry {
    columns: 1;
  }
}

.masonry > * {
  break-inside: avoid;
  margin-bottom: 16px;
}

.tile {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: var(--bg-soft);
  text-align: left;
}

.tile img {
  width: 100%;
  transition: transform var(--t-slow) var(--ease-out);
}

.tile:hover img {
  transform: scale(1.03);
}

@media (prefers-reduced-motion: reduce) {
  .tile:hover img {
    transform: none;
  }
}

.tile-caption {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 26px 12px 10px;
  background: linear-gradient(to top, rgba(20, 12, 18, 0.62), transparent);
  color: #fff;
  font-size: 12.5px;
  opacity: 0;
  transition: opacity var(--t-base) var(--ease-out);
}

.tile:hover .tile-caption,
.tile:focus-visible .tile-caption {
  opacity: 1;
}

.tile-date {
  font-family: var(--font-mono);
  font-size: 10.5px;
  opacity: 0.8;
}

.tile-sample {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 1px 7px;
  border-radius: var(--r-pill);
  background: rgba(255, 242, 194, 0.94);
  color: #8a6a00;
  font-size: 10px;
}

/* ── 灯箱 ───────────────────────────────────────────────── */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 400;
  display: grid;
  place-items: center;
  gap: 0;
  background: rgba(12, 8, 14, 0.9);
  backdrop-filter: blur(6px);
  padding: 24px;
}

.lb-figure {
  max-width: min(1000px, 92vw);
  max-height: 84dvh;
  display: grid;
  gap: 12px;
}

.lb-figure img {
  max-width: 100%;
  max-height: 76dvh;
  margin: 0 auto;
  border-radius: 10px;
  object-fit: contain;
}

.lb-figure figcaption {
  text-align: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.82);
}

.lb-btn {
  position: absolute;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  transition: background-color var(--t-fast) var(--ease-out);
}

.lb-btn:hover {
  background: rgba(255, 255, 255, 0.24);
}

.lb-close {
  top: 20px;
  right: 20px;
}

.lb-prev {
  left: 18px;
  top: 50%;
  translate: 0 -50%;
}

.lb-next {
  right: 18px;
  top: 50%;
  translate: 0 -50%;
}

.lb-count {
  position: absolute;
  bottom: 22px;
  left: 50%;
  translate: -50% 0;
  font-family: var(--font-mono);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity var(--t-base) var(--ease-out);
}

.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}

@media (max-width: 767px) {
  .lb-prev {
    left: 8px;
  }

  .lb-next {
    right: 8px;
  }
}
</style>
