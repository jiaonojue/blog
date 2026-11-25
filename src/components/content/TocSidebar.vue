<script setup lang="ts">
/** 文章侧边目录 —— 高亮当前正在读的章节 */
import { ref, onMounted, onUnmounted } from 'vue'
import type { TocEntry } from '@/composables/useContent'

const props = defineProps<{ entries: TocEntry[] }>()

const activeId = ref('')
let observer: IntersectionObserver | null = null

onMounted(() => {
  const headings = props.entries
    .map((e) => document.getElementById(e.id))
    .filter((el): el is HTMLElement => el !== null)

  if (!headings.length) return

  observer = new IntersectionObserver(
    (records) => {
      // 取最靠近视口顶部的那个标题
      const visible = records
        .filter((r) => r.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) activeId.value = visible[0].target.id
    },
    { rootMargin: '-90px 0px -70% 0px', threshold: 0 },
  )

  for (const h of headings) observer.observe(h)
})

onUnmounted(() => observer?.disconnect())

/** 点目录跳转：用 JS 滚动，这样能顺便更新地址栏的 hash */
function jumpTo(id: string, event: MouseEvent) {
  const el = document.getElementById(id)
  if (!el) return
  event.preventDefault()
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  history.replaceState(null, '', `#${id}`)
  activeId.value = id
}
</script>

<template>
  <nav class="toc no-print" aria-label="文章目录">
    <p class="toc-title">目录</p>
    <ul>
      <li v-for="entry in entries" :key="entry.id" :class="`lvl-${entry.level}`">
        <a
          :href="`#${entry.id}`"
          :class="{ active: activeId === entry.id }"
          @click="jumpTo(entry.id, $event)"
        >
          {{ entry.text }}
        </a>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.toc {
  position: sticky;
  top: 104px;
  max-height: calc(100dvh - 140px);
  overflow-y: auto;
  padding-left: 16px;
  border-left: 1px solid var(--line);
}

.toc-title {
  margin-bottom: 12px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.toc ul {
  display: grid;
  gap: 2px;
}

.toc a {
  display: block;
  padding: 5px 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--ink-soft);
  border-left: 2px solid transparent;
  padding-left: 10px;
  margin-left: -17px;
  transition:
    color var(--t-fast) var(--ease-out),
    border-color var(--t-fast) var(--ease-out);
}

.toc a:hover {
  color: var(--ink);
}

.toc a.active {
  color: var(--accent);
  border-left-color: var(--accent);
  font-weight: 600;
}

.lvl-3 a {
  padding-left: 22px;
  font-size: 12.5px;
  opacity: 0.9;
}
</style>
