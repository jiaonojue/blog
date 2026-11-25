<script setup lang="ts">
/**
 * 印章式站点标记 —— 全站唯一的"品牌符号"。
 * 一个红色方章，里面一个汉字。用于 favicon、导航、页脚、分享图角标。
 *
 * 【想换成别的字】改下面的 text 属性默认值。
 */
withDefaults(
  defineProps<{
    /** 印章里的字，建议单字 */
    text?: string
    /** 边长（px） */
    size?: number
    /** 是否带外框 */
    framed?: boolean
  }>(),
  { text: '記', size: 28, framed: true },
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 100 100"
    class="site-mark"
    role="img"
    :aria-label="`站点标记：${text}`"
  >
    <!-- 印章底座：手绘感的圆角方框 -->
    <rect
      v-if="framed"
      x="5"
      y="5"
      width="90"
      height="90"
      rx="14"
      fill="none"
      stroke="currentColor"
      stroke-width="7"
    />
    <!-- 印章里的字 -->
    <text
      x="50"
      y="50"
      text-anchor="middle"
      dominant-baseline="central"
      font-size="52"
      font-family="var(--font-display)"
      fill="currentColor"
    >
      {{ text }}
    </text>
  </svg>
</template>

<style scoped>
.site-mark {
  color: var(--accent);
  /* 印章微微压印的感觉 */
  filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.4));
}
</style>
