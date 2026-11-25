<script setup lang="ts">
/**
 * 打字机效果 —— 逐字显示文字，光标闪 3 次后消失。
 * 只用于首页 tagline 与 Now 页标题，不要到处用。
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { motionEnabled } from '@/composables/useSettings'

const props = withDefaults(
  defineProps<{
    text: string
    /** 每个字的间隔（毫秒） */
    speed?: number
    /** 开始前的延迟 */
    startDelay?: number
  }>(),
  { speed: 45, startDelay: 200 },
)

const shown = ref('')
const done = ref(false)
let timer = 0

onMounted(() => {
  // 减少动效时直接全部显示
  if (!motionEnabled.value) {
    shown.value = props.text
    done.value = true
    return
  }

  let i = 0
  const start = () => {
    timer = window.setInterval(() => {
      i += 1
      shown.value = props.text.slice(0, i)
      if (i >= props.text.length) {
        window.clearInterval(timer)
        done.value = true
      }
    }, props.speed)
  }

  timer = window.setTimeout(start, props.startDelay)
})

onUnmounted(() => {
  window.clearInterval(timer)
  window.clearTimeout(timer)
})
</script>

<template>
  <span class="type-line">
    <span class="type-text">{{ shown }}</span>
    <!-- 光标：打完后闪 3 次消失 -->
    <span class="type-caret" :class="{ 'is-done': done }" aria-hidden="true" />
    <!-- 读屏软件一次读完整文本；零宽空格要剃掉，否则某些读屏器会念出停顿 -->
    <span class="sr-only">{{ text.replace(/[\u200B-\u200D\uFEFF]/g, '') }}</span>
  </span>
</template>

<style scoped>
.type-line {
  position: relative;
  display: inline;
}

.type-text {
  white-space: pre-wrap;
}

.type-caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -0.12em;
  background: currentColor;
  animation: caret-blink 620ms step-end infinite;
}

/* 打完后再闪 3 次就停 */
.type-caret.is-done {
  animation: caret-final 620ms step-end 3;
  opacity: 0;
}

@keyframes caret-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

@keyframes caret-final {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .type-caret {
    display: none;
  }
}
</style>
