<script setup lang="ts">
/**
 * 页签 —— 贴在正文右上角的两枚书签，指向上一篇 / 下一篇。
 *
 * 【为什么是页签】
 *   文章底部已经有"上一篇 / 下一篇"的卡片了，但那个必须滚到最底才看得见。
 *   读一半想跳走的时候，得先滚到底——这是所有博客都有的小摩擦。
 *   实体书用的是书签：从书页边缘探出来一小截，随时能抽。
 *   这里就做成那样：两枚小签，贴在正文右边，鼠标放上去才展开标题。
 *
 * 【为什么在右上而不是右下】
 *   右下角会被"回到顶部"和各种悬浮按钮占掉，而且视线不常去那里。
 *   右上角是目录和进度条的区域，读者本来就会往那儿看。
 */
import { computed, ref } from 'vue'
import type { Post } from '@/types/content'

const props = defineProps<{
  prev?: Post
  next?: Post
}>()

/** 哪一枚被展开了 */
const open = ref<'prev' | 'next' | null>(null)

const items = computed(() =>
  [
    props.prev ? { key: 'prev' as const, label: '上一篇', post: props.prev, arrow: '↑' } : null,
    props.next ? { key: 'next' as const, label: '下一篇', post: props.next, arrow: '↓' } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null),
)
</script>

<template>
  <nav v-if="items.length" class="page-tabs no-print" aria-label="相邻文章">
    <RouterLink
      v-for="item in items"
      :key="item.key"
      :to="item.post.path"
      class="page-tab"
      :class="{ open: open === item.key }"
      @mouseenter="open = item.key"
      @mouseleave="open = null"
      @focus="open = item.key"
      @blur="open = null"
    >
      <span class="tab-arrow" aria-hidden="true">{{ item.arrow }}</span>
      <span class="tab-label">{{ item.label }}</span>
      <span class="tab-title">{{ item.post.title }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.page-tabs {
  position: sticky;
  /* 贴在导航胶囊下面一点的位置 */
  top: 108px;
  z-index: var(--z-content);
  display: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  /* 不占布局宽度，靠负边距浮到正文外面 */
  height: 0;
  pointer-events: none;
}

@media (min-width: 1180px) {
  .page-tabs {
    display: flex;
  }
}

.page-tab {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 7px;
  max-width: 34px;
  padding: 7px 10px;
  border-radius: var(--r-pill) 0 0 var(--r-pill);
  border: 1px solid var(--line);
  border-right: 0;
  background: var(--surface);
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
  white-space: nowrap;
  overflow: hidden;
  transition:
    max-width var(--t-base) var(--ease-out),
    background-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

/* 展开：从一枚小签长成一条完整的标题 */
.page-tab.open {
  max-width: 260px;
  background: var(--accent-soft);
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
}

.tab-arrow {
  flex: 0 0 auto;
  font-size: 11px;
  opacity: 0.6;
}

.tab-label {
  flex: 0 0 auto;
}

.tab-title {
  /* 收起时藏起来，展开时才出现 */
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  transition:
    max-width var(--t-base) var(--ease-out),
    opacity var(--t-fast) var(--ease-out);
}

.page-tab.open .tab-title {
  max-width: 190px;
  opacity: 1;
}

/* 触摸设备没有 hover，直接把标题露出来 */
@media (hover: none) {
  .page-tab {
    max-width: 200px;
  }

  .page-tab .tab-title {
    max-width: 140px;
    opacity: 1;
  }
}

@media print {
  .page-tabs {
    display: none;
  }
}
</style>
