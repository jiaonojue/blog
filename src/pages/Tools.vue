<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { tools } from '@/composables/useContent'
import { useSeo } from '@/composables/useSeo'
import { setBackdrop } from '@/composables/useBackground'
import type { Tool } from '@/types/content'
import TapeLabel from '@/components/ui/TapeLabel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import RevealOnScroll from '@/components/motion/RevealOnScroll.vue'
import AnimeTable from '@/components/tools/AnimeTable.vue'
import MarkdownReader from '@/components/tools/MarkdownReader.vue'
import DocxToPdf from '@/components/tools/DocxToPdf.vue'
import ImageCompressor from '@/components/tools/ImageCompressor.vue'
import {
  ExternalLink,
  PenTool,
  Palette,
  Code2,
  Coffee,
  Star,
  FileText,
  FileType2,
  Image as ImageIcon,
  Link2,
} from '@lucide/vue'

useSeo({ title: '工具箱', description: '我日常用的一些工具，以及几个在浏览器里本地跑的小工具。' })

/** 分组顺序固定，方便你按习惯找 */
const groupOrder = ['写作', '设计', '开发', '生活'] as const

const grouped = computed(() => {
  return groupOrder
    .map((g) => ({
      group: g,
      items: tools.filter((t) => t.group === g),
    }))
    .filter((g) => g.items.length > 0)
})

/** 图标名映射到组件，改 md 里的 icon 字段就能换图标 */
const iconMap = {
  pen: PenTool,
  palette: Palette,
  code: Code2,
  coffee: Coffee,
  link: ExternalLink,
} as const

function iconFor(tool: Tool) {
  const key = tool.icon as keyof typeof iconMap
  return iconMap[key] ?? ExternalLink
}

/* ── 本地工具 ───────────────────────────────────────────── */

/**
 * 四个本地工具做成标签页。
 *
 * 【为什么是标签页而不是四张卡片】
 *   它们都不是"点一下就跳走"的链接，而是要在页面里待一会儿才用得完的
 *   工具。做成标签页，切换不用跳转，也不会有四个空页面。
 *
 * 【为什么只有被打开时才渲染】
 *   docx-preview 和 markdown-it 加起来有几百 KB。默认只挂番剧表，
 *   其余三个用 v-if 按需挂载——不点就不下载。
 */
const LOCAL_TABS = [
  { key: 'anime', label: '番剧评分表', icon: Star },
  { key: 'md', label: 'Markdown 阅读', icon: FileText },
  { key: 'docx', label: 'Word 转 PDF', icon: FileType2 },
  { key: 'image', label: '图片压缩', icon: ImageIcon },
] as const

type LocalTab = (typeof LOCAL_TABS)[number]['key']

const tab = ref<LocalTab>('anime')
/** 记录哪些标签被打开过：打开过就一直保留，避免来回切换时反复重新解析 */
const visited = ref<Set<LocalTab>>(new Set(['anime']))

function switchTab(key: LocalTab) {
  tab.value = key
  visited.value.add(key)
}

/** 工具页也换一张背景，和别的页面区分开 */
onMounted(() => setBackdrop('page:tools'))
</script>

<template>
  <div class="container tools-page">
    <header class="page-head">
      <TapeLabel>toolbox</TapeLabel>
      <h1 class="page-title t-display">工具箱</h1>
      <p class="page-desc">
        上面四个是本地工具：文件不离开你的电脑，全部在浏览器里跑。下面是我日常在用的外部站点。
      </p>
    </header>

    <!-- ══ 本地工具 ═══════════════════════════════════════ -->
    <section class="local-tools" aria-label="本地工具">
      <div class="tab-bar" role="tablist" aria-label="本地工具">
        <button
          v-for="t in LOCAL_TABS"
          :key="t.key"
          type="button"
          class="tab-btn"
          :class="{ active: tab === t.key }"
          role="tab"
          :aria-selected="tab === t.key"
          @click="switchTab(t.key)"
        >
          <component :is="t.icon" :size="14" :stroke-width="1.85" aria-hidden="true" />
          {{ t.label }}
        </button>
      </div>

      <div class="tab-panel" role="tabpanel">
        <AnimeTable v-if="tab === 'anime'" />
        <MarkdownReader v-else-if="tab === 'md' && visited.has('md')" />
        <DocxToPdf v-else-if="tab === 'docx' && visited.has('docx')" />
        <ImageCompressor v-else-if="tab === 'image' && visited.has('image')" />
      </div>
    </section>

    <!-- ══ 外部链接 ═══════════════════════════════════════ -->
    <section class="links-section" aria-label="常用站点">
      <h2 class="links-title">
        <Link2 :size="13" :stroke-width="2" aria-hidden="true" />
        常用站点
      </h2>

      <EmptyState v-if="!tools.length" title="还没有整理" desc="等我有空再加。" />

      <div v-for="section in grouped" :key="section.group" class="tool-group">
        <h3 class="group-title">{{ section.group }}</h3>

        <div class="tool-grid">
          <RevealOnScroll
            v-for="(tool, i) in section.items"
            :key="tool.name"
            :delay="Math.min(i * 50, 200)"
          >
            <a :href="tool.url" class="tool-card" target="_blank" rel="noopener noreferrer">
              <span class="tool-icon" aria-hidden="true">
                <component :is="iconFor(tool)" :size="17" :stroke-width="1.75" />
              </span>

              <span class="tool-main">
                <span class="tool-name">
                  {{ tool.name }}
                  <ExternalLink :size="11" :stroke-width="2" class="tool-ext" aria-hidden="true" />
                </span>
                <span class="tool-desc">{{ tool.desc }}</span>
              </span>

              <span v-if="tool.sample" class="tool-sample">示例</span>
            </a>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.tools-page {
  padding-top: 24px;
}

.page-head {
  max-width: 660px;
  margin-bottom: 34px;
}

.page-title {
  margin-top: 12px;
}

.page-desc {
  margin-top: 14px;
  color: var(--ink-soft);
  font-size: 15px;
}

/* ── 本地工具 ───────────────────────────────────────────── */
.local-tools {
  margin-bottom: 56px;
  padding: 22px 22px 26px;
  border-radius: var(--r-card);
  border: 1px solid var(--line);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.tab-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: var(--r-pill);
  border: 1px solid transparent;
  background: transparent;
  color: var(--ink-soft);
  font-size: 12.5px;
  cursor: pointer;
  transition:
    background-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out),
    border-color var(--t-fast) var(--ease-out);
}

.tab-btn:hover {
  color: var(--ink);
  background: var(--bg-soft);
}

.tab-btn.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

/* ── 外部链接 ───────────────────────────────────────────── */
.links-section {
  padding-top: 4px;
}

.links-title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 26px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.tool-group + .tool-group {
  margin-top: 34px;
}

.group-title {
  margin-bottom: 14px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  color: var(--ink-soft);
  opacity: 0.8;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(264px, 1fr));
  gap: 14px;
}

.tool-card {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  height: 100%;
  padding: 16px 18px;
  border-radius: var(--r-input);
  border: 1px solid var(--line);
  background: var(--surface);
  transition:
    border-color var(--t-fast) var(--ease-out),
    transform var(--t-fast) var(--ease-out);
}

.tool-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

[data-motion='off'] .tool-card:hover {
  transform: none;
}

.tool-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 9px;
  background: var(--accent-soft);
  color: var(--accent);
}

.tool-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.tool-name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 14.5px;
}

.tool-ext {
  color: var(--ink-soft);
  opacity: 0.6;
}

.tool-desc {
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--ink-soft);
}

.tool-sample {
  margin-left: auto;
  padding: 1px 7px;
  border-radius: var(--r-pill);
  background: #fff2c2;
  color: #8a6a00;
  font-size: 10px;
  white-space: nowrap;
}

[data-theme='neon'] .tool-sample {
  background: #2e2410;
  color: #ffd166;
}

@media (max-width: 767px) {
  .local-tools {
    padding: 16px 14px 20px;
  }

  .tab-bar {
    gap: 2px;
  }

  .tab-btn {
    padding: 6px 10px;
    font-size: 11.5px;
  }
}
</style>
