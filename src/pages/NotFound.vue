<script setup lang="ts">
/**
 * 404 页 —— 点击飘落的星星 5 次，会出现一句隐藏台词。
 * 纯 CSS + 少量 JS，无依赖。
 */
import { ref, computed } from 'vue'
import { useSeo } from '@/composables/useSeo'
import SiteMark from '@/components/ui/SiteMark.vue'
import SpeechBubble from '@/components/ui/SpeechBubble.vue'

useSeo({ title: '迷路了', noindex: true })

/** 点击次数 */
const taps = ref(0)
const found = computed(() => taps.value >= 5)

/** 五颗星星的位置（百分比），写死保证每次布局一致 */
const stars = [
  { x: 14, y: 22, delay: 0 },
  { x: 78, y: 16, delay: 0.6 },
  { x: 32, y: 62, delay: 1.2 },
  { x: 88, y: 68, delay: 1.8 },
  { x: 56, y: 36, delay: 2.4 },
]

function tap() {
  taps.value += 1
}
</script>

<template>
  <div class="container notfound-page">
    <div class="nf-inner">
      <SiteMark :size="44" :framed="false" class="nf-mark" />

      <p class="nf-code t-display">404</p>

      <h1 class="nf-title">这一页不见了</h1>

      <p class="nf-desc">
        可能是地址打错了，也可能是我把文章撤了。
        <br />
        <span class="nf-hint">
          {{ found ? '你已经点完了，谢谢你陪我玩。' : '顺便：点一下飘着的星星，会有东西。' }}
        </span>
      </p>

      <!-- 可点的星星 -->
      <button
        v-for="(star, i) in stars"
        :key="i"
        type="button"
        class="nf-star"
        :style="{ left: `${star.x}%`, top: `${star.y}%`, animationDelay: `${star.delay}s` }"
        aria-hidden="true"
        tabindex="-1"
        @click="tap"
      >
        ✦
      </button>

      <div v-if="found" class="nf-reward">
        <SpeechBubble tail="none">
          既然都点到这儿了 —— 那说明你是个愿意花时间的人。
          <br />
          留个念想：
          <strong>下次来，说不定这里就有新东西了。</strong>
        </SpeechBubble>
      </div>

      <div class="nf-actions">
        <RouterLink to="/" class="nf-btn nf-btn-primary">回首页</RouterLink>
        <RouterLink to="/posts" class="nf-btn">看文章</RouterLink>
      </div>

      <p class="nf-count" aria-live="polite">
        <span class="sr-only">已点击 {{ taps }} 次</span>
        <span aria-hidden="true">{{ found ? '' : `${taps} / 5` }}</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.notfound-page {
  display: grid;
  place-items: center;
  min-height: 66dvh;
  padding-top: 24px;
}

.nf-inner {
  position: relative;
  max-width: 560px;
  text-align: center;
  padding: 20px;
}

.nf-mark {
  margin: 0 auto 6px;
  opacity: 0.7;
}

.nf-code {
  font-family: var(--font-display);
  color: var(--accent);
  opacity: 0.28;
  line-height: 0.9;
}

.nf-title {
  margin-top: -6px;
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 4vw, 2rem);
}

.nf-desc {
  margin-top: 16px;
  font-size: 14.5px;
  line-height: 1.9;
  color: var(--ink-soft);
}

.nf-hint {
  font-family: var(--font-quote);
  color: var(--accent);
}

/* ── 可点的星星 ─────────────────────────────────────────── */
.nf-star {
  position: absolute;
  font-size: 20px;
  line-height: 1;
  color: var(--accent);
  opacity: 0.55;
  animation: star-float 4.2s var(--ease-in-out) infinite;
  transition:
    transform var(--t-fast) var(--ease-out),
    opacity var(--t-fast) var(--ease-out);
}

.nf-star:hover {
  opacity: 1;
  transform: scale(1.25);
  cursor: pointer;
}

@keyframes star-float {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-10px) rotate(18deg);
  }
}

[data-motion='off'] .nf-star {
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .nf-star {
    animation: none;
  }
}

/* ── 隐藏台词 ───────────────────────────────────────────── */
.nf-reward {
  margin-top: 26px;
  text-align: left;
}

.nf-reward strong {
  color: var(--accent);
}

/* ── 按钮 ───────────────────────────────────────────────── */
.nf-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 30px;
}

.nf-btn {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 22px;
  border-radius: var(--r-pill);
  border: 1px solid var(--ink);
  font-size: 14px;
  transition:
    background-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.nf-btn:hover {
  background: var(--ink);
  color: var(--bg);
}

.nf-btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}

.nf-btn-primary:hover {
  background: color-mix(in srgb, var(--accent) 86%, black);
  border-color: color-mix(in srgb, var(--accent) 86%, black);
  color: var(--accent-ink);
}

.nf-count {
  margin-top: 18px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--ink-soft);
  opacity: 0.6;
  min-height: 1.6em;
}
</style>
