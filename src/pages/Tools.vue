<script setup lang="ts">
import { computed } from 'vue'
import { tools } from '@/composables/useContent'
import { useSeo } from '@/composables/useSeo'
import type { Tool } from '@/types/content'
import TapeLabel from '@/components/ui/TapeLabel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import RevealOnScroll from '@/components/motion/RevealOnScroll.vue'
import { ExternalLink, PenTool, Palette, Code2, Coffee } from '@lucide/vue'

useSeo({ title: '工具箱', description: '我日常用的一些工具和资源。' })

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
</script>

<template>
  <div class="container tools-page">
    <header class="page-head">
      <TapeLabel>toolbox</TapeLabel>
      <h1 class="page-title t-display">工具箱</h1>
      <p class="page-desc">
        我日常在用的东西。加一个新工具只需要在 content/tools/ 放一个 md 文件，不用动代码。
      </p>
    </header>

    <EmptyState v-if="!tools.length" title="工具箱还是空的" desc="还没整理好。" />

    <section v-for="section in grouped" :key="section.group" class="tool-group">
      <h2 class="group-title">{{ section.group }}</h2>

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
    </section>
  </div>
</template>

<style scoped>
.tools-page {
  padding-top: 24px;
}

.page-head {
  max-width: 660px;
  margin-bottom: 44px;
}

.page-title {
  margin-top: 12px;
}

.page-desc {
  margin-top: 14px;
  color: var(--ink-soft);
  font-size: 15px;
}

.tool-group + .tool-group {
  margin-top: 46px;
}

.group-title {
  margin-bottom: 16px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-soft);
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
</style>
