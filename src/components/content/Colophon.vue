<script setup lang="ts">
/**
 * 余白 —— 文章读完之后那一屏。
 *
 * 【为什么要有】
 *   现在的文章结尾是「本页完」加一个印章，然后直接是上一篇/下一篇。
 *   但一本书翻完最后一页，剩下的是一张空白纸——那个空白是有用的，
 *   它让人停一下，把刚才读到的东西沉下去。
 *
 *   所以这里给文章加一屏几乎空白的区域：一句可以自己写的话，
 *   加上一条极细的装饰线。不是装饰，是呼吸。
 *
 * 【怎么改文案】
 *   每篇文章的 frontmatter 里可以写 `closing:`，不写就用下面这句默认的。
 *   想彻底关掉，把 frontmatter 里的 closing 设成空字符串即可。
 */
import { computed } from 'vue'

const props = defineProps<{
  /** 文章自定义的收尾语，可选 */
  closing?: string
}>()

const DEFAULT_LINE = '到这里就结束了。剩下的留给你自己。'

const line = computed(() => {
  const custom = props.closing?.trim()
  return custom || DEFAULT_LINE
})
</script>

<template>
  <section class="colophon no-print" aria-label="读完">
    <!-- 三条渐短的横线：像稿纸上收笔时留下的痕迹 -->
    <span class="colophon-rule" aria-hidden="true" />
    <span class="colophon-rule short" aria-hidden="true" />
    <span class="colophon-rule shorter" aria-hidden="true" />

    <p class="colophon-text">{{ line }}</p>
  </section>
</template>

<style scoped>
.colophon {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 上下都给足空间，这一屏的意义就是"空" */
  padding: 88px 0 72px;
}

.colophon-rule {
  width: 120px;
  height: 1px;
  background: var(--line);
  opacity: 0.9;
}

.colophon-rule.short {
  width: 64px;
  margin-top: 10px;
  opacity: 0.6;
}

.colophon-rule.shorter {
  width: 24px;
  margin-top: 10px;
  opacity: 0.35;
}

.colophon-text {
  margin-top: 30px;
  font-family: var(--font-quote);
  font-size: 13.5px;
  line-height: 1.9;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
  text-align: center;
  opacity: 0.72;
}

@media print {
  .colophon {
    display: none;
  }
}
</style>
