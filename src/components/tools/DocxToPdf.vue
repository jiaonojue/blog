<script setup lang="ts">
/**
 * Word 本地转 PDF —— 纯前端，文件不出电脑。
 *
 * 【为什么不是真的"转 PDF"】
 *   浏览器里没有能把 .docx 真正编码成 PDF 的能力（那需要字体嵌入、
 *   排版引擎，几十 MB）。任何号称"纯前端转 PDF"的服务，要么把文件
 *   传到服务器，要么只是打印预览。
 *
 *   所以这里用的是最诚实、效果也最好的办法：**用浏览器的打印功能另存为 PDF**。
 *   Chrome / Edge 的"另存为 PDF"会保留文字（可选中、可搜索）、
 *   保留矢量图，而且不依赖任何第三方服务。
 *
 * 【流程】
 *   拖入 .docx → 浏览器里解析成 HTML（docx-preview）→ 显示预览 →
 *   点"打印 / 存为 PDF" → 在打印对话框里选"另存为 PDF"。
 *
 * 【为什么预览和打印分开】
 *   打印样式要专门写（去导航、去背景、页边距）。如果直接在预览区打印，
 *   会把工具的界面也印上去。
 */
import { ref, shallowRef, nextTick } from 'vue'
import { renderAsync } from 'docx-preview'
import DropZone from '@/components/tools/DropZone.vue'
import { FileType2, Printer, X, Loader2 } from '@lucide/vue'

const fileName = ref('')
const busy = ref(false)
const error = ref('')
const container = shallowRef<HTMLElement | null>(null)

/** 打印用的独立窗口：只放文档内容，不夹带工具界面 */
function printAsPdf() {
  const el = container.value
  if (!el) return

  const win = window.open('', '_blank')
  if (!win) {
    error.value = '浏览器拦住了新窗口。允许弹出窗口后再点一次。'
    return
  }

  // 把预览区的 HTML 和页面里已加载的样式一起搬过去
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((n) => n.outerHTML)
    .join('\n')

  win.document.write(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${fileName.value.replace(/\.docx?$/i, '')}</title>
${styles}
<style>
  /* 打印专用：去掉一切站点外壳，只留文档 */
  body { background: #fff !important; color: #000 !important; margin: 0; }
  .docx-wrapper { background: #fff !important; padding: 0 !important; }
  .docx-wrapper > section.docx { box-shadow: none !important; margin: 0 auto !important; }
  @page { margin: 18mm 16mm; }
</style>
</head>
<body></body>
</html>`)
  win.document.close()

  // 等样式生效再把节点搬进去
  win.onload = () => {
    win.document.body.innerHTML = el.innerHTML
    setTimeout(() => {
      win.focus()
      win.print()
    }, 300)
  }

  // 有些浏览器不触发 onload（因为文档是 write 出来的），兜一层
  setTimeout(() => {
    if (!win.document.body.innerHTML.trim()) {
      win.document.body.innerHTML = el.innerHTML
      win.focus()
      win.print()
    }
  }, 800)
}

async function open(files: File[]) {
  const file = files[0]
  if (!file) return
  error.value = ''

  if (!/\.docx$/i.test(file.name)) {
    error.value = '只支持 .docx。老的 .doc 格式请先用 Word 另存为 .docx。'
    return
  }
  if (file.size > 25 * 1024 * 1024) {
    error.value = '文件超过 25MB，浏览器解析会很慢。'
    return
  }

  busy.value = true
  fileName.value = file.name

  await nextTick()
  const host = container.value
  if (!host) {
    busy.value = false
    return
  }

  host.innerHTML = ''

  try {
    await renderAsync(file, host, undefined, {
      className: 'docx',
      inWrapper: true,
      // 断页交给 CSS，别让库自己算——它算出来的页高和纸张对不上
      breakPages: false,
      ignoreLastRenderedPageBreak: false,
      // 用 base64 内嵌图片，这样打印窗口里图片也能显示
      useBase64URL: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
    })
  } catch (e) {
    error.value = `解析失败：${e instanceof Error ? e.message : String(e)}。文件可能是加密的或损坏的。`
    fileName.value = ''
  } finally {
    busy.value = false
  }
}

function close() {
  if (container.value) container.value.innerHTML = ''
  fileName.value = ''
  error.value = ''
}
</script>

<template>
  <section class="docx-tool">
    <DropZone
      v-if="!fileName"
      accept=".docx"
      label="拖一个 Word 文档进来"
      hint=".docx 格式，25MB 以内。解析和打印都在本地完成，文件不会上传。"
      @files="open"
    >
      <template #icon><FileType2 :size="20" :stroke-width="1.7" /></template>
    </DropZone>

    <p v-if="error" class="docx-error">{{ error }}</p>

    <div v-if="fileName" class="docx-bar">
      <span class="docx-file">{{ fileName }}</span>

      <button type="button" class="docx-btn primary" :disabled="busy" @click="printAsPdf">
        <Printer :size="13" :stroke-width="2" aria-hidden="true" />
        打印 / 存为 PDF
      </button>

      <button type="button" class="docx-btn" @click="close">
        <X :size="13" :stroke-width="2" aria-hidden="true" />
        关闭
      </button>
    </div>

    <!-- 使用说明：只在没打开文件时显示，不打扰阅读 -->
    <ol v-if="!fileName" class="docx-steps">
      <li>
        拖入
        <code>.docx</code>
        ，浏览器本地解析成和 Word 里接近的排版。
      </li>
      <li>点「打印 / 存为 PDF」，在弹出的打印窗口里把目标改成「另存为 PDF」。</li>
      <li>页边距建议选「默认」，缩放选「默认」——文档本身的分页会被保留。</li>
    </ol>

    <div v-if="busy" class="docx-busy">
      <Loader2 :size="16" :stroke-width="2" class="spin" aria-hidden="true" />
      正在解析文档…
    </div>

    <!--
      预览容器：docx-preview 会把内容塞进这个 div。
      用 v-show 而不是 v-if，因为 v-if 会把节点从 DOM 里摘掉，
      库拿到的引用就失效了。
    -->
    <div ref="container" v-show="fileName" class="docx-preview" />
  </section>
</template>

<style scoped>
.docx-tool {
  display: grid;
  gap: 18px;
}

.docx-error {
  padding: 10px 14px;
  border-radius: var(--r-input);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 13px;
}

.docx-bar {
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
}

.docx-file {
  min-width: 0;
  max-width: 46%;
  font-family: var(--font-mono);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.docx-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink-soft);
  font-size: 11.5px;
  cursor: pointer;
  transition:
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out),
    background-color var(--t-fast) var(--ease-out);
}

.docx-btn.primary {
  margin-left: auto;
  border-color: var(--accent);
  color: var(--accent);
}

.docx-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.docx-btn.primary:hover:not(:disabled) {
  background: var(--accent-soft);
}

.docx-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

/* ── 说明步骤 ───────────────────────────────────────────── */
.docx-steps {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 20px;
  max-width: 620px;
  font-size: 13px;
  line-height: 1.75;
  color: var(--ink-soft);
}

.docx-steps code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--bg-soft);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--ink);
}

.docx-busy {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--ink-soft);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── 预览区 ─────────────────────────────────────────────── */
.docx-preview {
  /*
   * docx-preview 自己会生成 .docx-wrapper 和纸张。这里只负责给一个
   * 中性底色，让白纸有边界；具体纸张样式由库注入。
   */
  padding: 20px 0;
  border-radius: var(--r-card);
  background: var(--bg-soft);
  overflow-x: auto;
}

/* 让纸张在窄屏上也能横向滚动，而不是被压扁 */
.docx-preview :deep(.docx-wrapper) {
  padding: 0 20px;
  background: transparent;
}

.docx-preview :deep(.docx-wrapper > section.docx) {
  box-shadow: var(--shadow);
  margin-bottom: 20px;
}

[data-motion='off'] .spin {
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .spin {
    animation: none;
  }
}
</style>
