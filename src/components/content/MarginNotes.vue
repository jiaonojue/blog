<script setup lang="ts">
/**
 * 页边批注 —— 正文右侧那行小字，像旧书上的铅笔笔记。
 *
 * 【为什么是批注】
 *   站点的隐喻是「同人志」。同人志最私人化的东西不是排版，是批注：
 *   前一个读者在某个段落旁边写下的一句话，后面的人会看到。
 *   这里把它做成了文章 frontmatter 里的一个字段，你自己写。
 *
 * 【怎么用】
 *   在文章的 md 里加：
 *
 *   ```yaml
 *   notes:
 *     - after: 3          # 第几个段落之后（从 1 数）
 *       text: 这里我哭了半小时
 *   ```
 *
 *   就会在第三段右侧出现这条批注。没有 notes 字段就不显示，完全可选。
 *
 * 【为什么按段落序号定位而不是锚点】
 *   锚点要你在正文里手写 id，改一句话就得重排；段落序号更稳，
 *   而且删掉中间一段最多是批注挪一行，不会整块错位。
 */
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'

export interface Note {
  after: number
  text: string
}

const props = defineProps<{
  /** 批注列表 */
  notes: Note[]
  /** 正文容器，用来找段落 */
  target: string
}>()

interface PlacedNote extends Note {
  top: number
}

const placed = ref<PlacedNote[]>([])

/**
 * 把每条批注挂到对应段落的垂直位置上。
 * 段落高度会随字号、窗口宽度变，所以每次尺寸变化都要重算。
 */
function layout() {
  const container = document.querySelector(props.target)
  if (!container) {
    placed.value = []
    return
  }

  // 只取正文的直接段落，不要嵌套在引用/列表里的
  const paragraphs = Array.from(container.querySelectorAll(':scope > p'))
  const base = container.getBoundingClientRect().top + window.scrollY

  const next: PlacedNote[] = []
  for (const note of props.notes) {
    const p = paragraphs[note.after - 1]
    if (!p) continue
    const rect = p.getBoundingClientRect()
    next.push({
      ...note,
      // 贴着这一段的下沿，稍微往上收一点，看起来是"写在这一段旁边"
      top: rect.bottom + window.scrollY - base - 14,
    })
  }
  placed.value = next
}

let ro: ResizeObserver | null = null

onMounted(async () => {
  await nextTick()
  layout()
  // 图片加载完、字体替换完都会改变段落高度，观察容器尺寸最省事
  const container = document.querySelector(props.target)
  if (container && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => layout())
    ro.observe(container)
  }
  window.addEventListener('resize', layout, { passive: true })
})

onUnmounted(() => {
  ro?.disconnect()
  window.removeEventListener('resize', layout)
})

watch(() => props.notes, layout, { deep: true })

/** 容器高度由最后一条批注决定，留一点余量 */
const height = computed(() => {
  const last = placed.value[placed.value.length - 1]
  return last ? last.top + 40 : 0
})
</script>

<template>
  <div
    v-if="notes.length"
    class="margin-notes no-print"
    :style="{ height: `${height}px` }"
    aria-hidden="true"
  >
    <span
      v-for="(n, i) in placed"
      :key="i"
      class="margin-note"
      :style="{ top: `${n.top}px`, '--i': i }"
    >
      <span class="note-tick" />
      <span class="note-text">{{ n.text }}</span>
    </span>
  </div>
</template>

<style scoped>
/*
 * 绝对定位在一个覆盖正文的透明层里，不占正文宽度。
 * 这样批注可以伸到正文右边那片留白里，正文排版完全不受影响。
 */
.margin-notes {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
}

.margin-note {
  position: absolute;
  /* 贴到正文右边缘外：正文宽 680，这里从 700 开始 */
  left: calc(100% + 20px);
  width: 150px;
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-family: var(--font-quote);
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink-soft);
  opacity: 0;
  animation: note-in var(--t-slow) var(--ease-out) forwards;
  /* 每条错开 90ms 出现，像一句一句写上去 */
  animation-delay: calc(var(--i) * 90ms);
}

@keyframes note-in {
  from {
    opacity: 0;
    transform: translateX(-6px);
  }
  to {
    opacity: 0.78;
    transform: translateX(0);
  }
}

/* 一道短短的横线，连回正文 */
.note-tick {
  flex: 0 0 auto;
  width: 14px;
  height: 1px;
  margin-top: 9px;
  background: var(--accent);
  opacity: 0.5;
}

.note-text {
  flex: 1;
}

/* 屏幕不够宽时批注会跑出视口，直接不显示 */
@media (max-width: 1279px) {
  .margin-notes {
    display: none;
  }
}

/* 关掉动效时直接显示，不要那点滑入 */
[data-motion='off'] .margin-note {
  animation: none;
  opacity: 0.78;
}

@media (prefers-reduced-motion: reduce) {
  .margin-note {
    animation: none;
    opacity: 0.78;
  }
}

@media print {
  .margin-notes {
    display: none;
  }
}
</style>
