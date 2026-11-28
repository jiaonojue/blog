<script setup lang="ts">
/**
 * Markdown 在线阅读器 —— 把本地 .md 文件渲染成和站内文章一样的排版。
 *
 * 【为什么做成在线读】
 *   写文章之前总要先读一遍自己的稿子。用编辑器看是源码，用预览插件看
 *   样式又和站内不一样。这里直接用站点的 prose 样式渲染，
 *   看到的就是发布之后的样子。
 *
 * 【为什么不用现成的高亮库】
 *   站点的 Shiki 只在构建期跑（它很大，不能进浏览器包）。
 *   这里只需要"能读"，代码块用等宽字体 + 浅底就够了。
 *   真要高亮，等发布之后站内文章页自然会有。
 *
 * 【安全性】
 *   md 里的 HTML 一律不解析（html: false），链接外链自动加 rel。
 *   文件只在你的浏览器里读，不会上传。
 */
import { computed, ref, shallowRef, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import DropZone from '@/components/tools/DropZone.vue'
import { FileText, X, Copy, Check, ClipboardType } from '@lucide/vue'

const md = new MarkdownIt({ html: false, linkify: true, typographer: false })

/** 外链在新窗口打开 */
const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx]?.attrGet('href') ?? ''
  if (/^https?:\/\//i.test(String(href))) {
    tokens[idx]?.attrSet('target', '_blank')
    tokens[idx]?.attrSet('rel', 'noopener noreferrer')
  }
  return defaultLinkOpen(tokens, idx, options, env, self)
}

const fileName = ref('')
const source = ref('')
const error = ref('')
const copied = ref(false)

/** 渲染结果用 shallowRef：一整块 HTML 字符串不需要深层响应式 */
const html = shallowRef('')

/** 粘贴模式：不用文件，直接把 Markdown 文本贴进来读 */
const pasteOpen = ref(false)
const pasteText = ref('')
const pasteEl = ref<HTMLTextAreaElement | null>(null)

function openPaste() {
  pasteOpen.value = true
  error.value = ''
  // 下一帧把焦点放进文本框，直接 Ctrl + V 就能贴
  void nextTick(() => pasteEl.value?.focus())
}

function renderPaste() {
  const text = pasteText.value
  if (!text.trim()) {
    error.value = '先贴点内容进来。'
    return
  }
  error.value = ''
  fileName.value = '粘贴的内容'
  source.value = text
  html.value = md.render(text)
}

/** 从剪贴板直接贴进文本框（Ctrl + V 天然支持，这里给按钮一个兜底） */
async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText()
    if (!text) {
      error.value = '剪贴板是空的。先复制一段 Markdown 再来。'
      return
    }
    pasteText.value = text
    renderPaste()
  } catch {
    error.value = '浏览器不让直接读剪贴板，在下面的框里 Ctrl + V 就行。'
  }
}

async function open(files: File[]) {
  const file = files[0]
  if (!file) return
  error.value = ''

  if (file.size > 2 * 1024 * 1024) {
    error.value = '文件超过 2MB，这个工具是给普通文章用的，太大的文件会把浏览器卡住。'
    return
  }

  try {
    const text = await file.text()
    fileName.value = file.name
    source.value = text
    html.value = md.render(text)
  } catch {
    error.value = '读不了这个文件，确认它是 UTF-8 编码的 .md。'
  }
}

function close() {
  fileName.value = ''
  source.value = ''
  html.value = ''
  error.value = ''
  // 粘贴框留着不清：多半是要改一版再渲染
}

/** 统计：中文字数按字算，英文按词算 */
const stats = computed(() => {
  const text = source.value
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length
  const words = text
    .replace(/[\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  const lines = text.split(/\r?\n/).length
  const minutes = Math.max(1, Math.round(chinese / 400 + words / 200))
  return { chinese, words, lines, minutes }
})

/** 复制原文，方便粘到别处 */
async function copySource() {
  try {
    await navigator.clipboard.writeText(source.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    error.value = '浏览器不让复制，选中文字手动复制吧。'
  }
}
</script>

<template>
  <section class="md-tool">
    <DropZone
      v-if="!fileName && !pasteOpen"
      accept=".md,.markdown,.txt"
      label="拖一个 Markdown 文件进来"
      hint="支持 .md / .markdown / .txt，2MB 以内。文件只在浏览器里读，不会上传。"
      @files="open"
    >
      <template #icon><FileText :size="20" :stroke-width="1.7" /></template>
    </DropZone>

    <!-- 没打开任何东西的时候，给第二条路：贴文本 -->
    <div v-if="!fileName && !pasteOpen" class="paste-entry">
      <button type="button" class="md-btn" @click="openPaste">
        <ClipboardType :size="13" :stroke-width="2" aria-hidden="true" />
        或者直接粘贴 Markdown 文本
      </button>
    </div>

    <!-- 粘贴模式：文本框 + 渲染按钮。live 渲染会卡大稿子，点按钮才渲染 -->
    <div v-if="pasteOpen && !fileName" class="paste-box">
      <textarea
        ref="pasteEl"
        v-model="pasteText"
        class="paste-input"
        rows="10"
        placeholder="把 Markdown 粘到这里（Ctrl + V），标题、列表、代码块都会按站内文章的排版渲染。"
        spellcheck="false"
      />
      <div class="paste-actions">
        <button type="button" class="md-btn" @click="pasteFromClipboard">
          <ClipboardType :size="13" :stroke-width="2" aria-hidden="true" />
          读剪贴板
        </button>
        <button
          type="button"
          class="md-btn primary"
          :disabled="!pasteText.trim()"
          @click="renderPaste"
        >
          <FileText :size="13" :stroke-width="2" aria-hidden="true" />
          渲染
        </button>
        <button type="button" class="md-btn" @click="pasteOpen = false">收起</button>
      </div>
    </div>

    <p v-if="error" class="md-error">{{ error }}</p>

    <template v-if="fileName">
      <div class="md-bar">
        <span class="md-file">
          <FileText :size="13" :stroke-width="1.9" aria-hidden="true" />
          {{ fileName }}
        </span>

        <span class="md-stats">
          {{ stats.chinese + stats.words }} 字 · {{ stats.lines }} 行 · 约 {{ stats.minutes }} 分钟
        </span>

        <button type="button" class="md-btn" @click="copySource">
          <component :is="copied ? Check : Copy" :size="13" :stroke-width="2" aria-hidden="true" />
          {{ copied ? '已复制' : '复制原文' }}
        </button>

        <button type="button" class="md-btn" @click="close">
          <X :size="13" :stroke-width="2" aria-hidden="true" />
          关闭
        </button>
      </div>

      <!-- 渲染结果：样式沿用站内 .prose，看到的就是发布后的样子 -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="prose md-preview" v-html="html" />
    </template>
  </section>
</template>

<style scoped>
.md-tool {
  display: grid;
  gap: 18px;
}

.md-error {
  padding: 10px 14px;
  border-radius: var(--r-input);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 13px;
}

/* ── 粘贴模式 ───────────────────────────────────────────── */
.paste-entry {
  display: flex;
  justify-content: center;
  margin-top: -6px;
}

.paste-entry .md-btn {
  margin: 0;
}

.paste-box {
  display: grid;
  gap: 10px;
}

.paste-input {
  width: 100%;
  min-height: 220px;
  padding: 14px 16px;
  border-radius: var(--r-input);
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.75;
  resize: vertical;
}

.paste-input:focus {
  outline: none;
  border-color: var(--accent);
}

.paste-actions {
  display: flex;
  gap: 8px;
}

.paste-actions .md-btn {
  margin: 0;
}

.md-btn.primary {
  border-color: var(--accent);
  color: var(--accent);
}

.md-btn.primary:hover:not(:disabled) {
  background: var(--accent-soft);
}

.md-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

/* ── 顶部信息条 ─────────────────────────────────────────── */
.md-bar {
  position: sticky;
  top: 76px;
  z-index: var(--z-content);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  background: var(--surface);
  backdrop-filter: blur(8px);
}

.md-file {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 40%;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.md-stats {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

.md-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  padding: 4px 10px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink-soft);
  font-size: 11.5px;
  cursor: pointer;
  transition:
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.md-btn + .md-btn {
  margin-left: 0;
}

.md-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ── 预览区 ─────────────────────────────────────────────── */
.md-preview {
  max-width: var(--prose-max);
  /* 正文和站内文章一样的水平规则，但这里是"正在读的稿子"，
     加一条左侧细线，和已发布的文章区分开 */
  padding-left: 22px;
  border-left: 2px solid var(--line);
}

@media (max-width: 767px) {
  .md-bar {
    top: 68px;
  }

  .md-preview {
    padding-left: 14px;
  }
}
</style>
