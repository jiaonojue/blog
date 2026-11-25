<script setup lang="ts">
/**
 * 对话气泡 —— 用于关于页和 404 页，内容是站主自己说的话。
 * 全站四件装饰母题之一。
 *
 * 【重要】气泡里不要说成"角色的台词"，这是站主对访客说话。
 */
withDefaults(
  defineProps<{
    /** 气泡尾巴朝哪边 */
    tail?: 'left' | 'right' | 'none'
  }>(),
  { tail: 'left' },
)
</script>

<template>
  <div class="speech-bubble" :class="`tail-${tail}`">
    <slot />
  </div>
</template>

<style scoped>
.speech-bubble {
  position: relative;
  padding: 14px 18px;
  border-radius: 16px;
  border: var(--w-stroke) solid var(--ink);
  background: var(--surface);
  font-family: var(--font-quote);
  font-size: 15px;
  line-height: 1.75;
  color: var(--ink);
}

/* 气泡尾巴：用两个伪元素叠出描边效果 */
.speech-bubble::before,
.speech-bubble::after {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
}

.tail-left::before {
  left: 22px;
  bottom: -18px;
  border-width: 18px 12px 0 0;
  border-color: var(--ink) transparent transparent transparent;
}

.tail-left::after {
  left: 24px;
  bottom: -14px;
  border-width: 14px 9px 0 0;
  border-color: var(--surface) transparent transparent transparent;
}

.tail-right::before {
  right: 22px;
  bottom: -18px;
  border-width: 18px 0 0 12px;
  border-color: var(--ink) transparent transparent transparent;
}

.tail-right::after {
  right: 24px;
  bottom: -14px;
  border-width: 14px 0 0 9px;
  border-color: var(--surface) transparent transparent transparent;
}
</style>
