<script setup lang="ts">
/**
 * 代码块复制 —— 给正文里每个 <pre> 挂一个「复制」小按钮。
 *
 * 【为什么用脚本挂，而不是在 Markdown 里加组件】
 *   正文是构建期由 markdown-it 渲染成 HTML 字符串的，里面没有 Vue 组件的位置。
 *   与其改渲染管线（要动 Shiki、要处理 SSR），不如在文章渲染完之后，
 *   遍历一遍 <pre> 把按钮插进去。DOM 是现成的，逻辑也就十几行。
 *
 * 【为什么按钮用 DOM API 造，而不是 v-for】
 *   按钮要活在 v-html 生成的内容里，Vue 管不到那片 DOM。
 *   手写 createElement 反而是这里最直接的做法。
 *
 * 【失败怎么办】
 *   浏览器不给写剪贴板（非 HTTPS、无权限）时，退回到"选中文本"，
 *   让用户自己按 Ctrl+C —— 总比什么都不发生强。
 */
import { watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps<{ target: string }>()

/** 挂上去的按钮，卸载时要一起摘掉 */
let buttons: HTMLButtonElement[] = []
let observer: MutationObserver | null = null

const LABEL_COPY = '复制'
const LABEL_DONE = '已复制'
const LABEL_FAIL = '请手动复制'

/**
 * 把文本放进剪贴板。
 *
 * 【为什么有两条路】
 *   navigator.clipboard 是新标准，但它只在"安全上下文 + 用户授权"时才工作。
 *   有些内嵌浏览器、隐私模式、或者用户点了"阻止"之后，它就永远失败。
 *   execCommand('copy') 虽然被标记为废弃，但在这些环境里依然有效，
 *   所以作为第二选择。两个都不行，才退到"选中文本让用户自己按 Ctrl+C"。
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 继续试下一条路 */
  }

  try {
    const ta = document.createElement('textarea')
    ta.value = text
    // 放到视口外，避免页面跳动
    ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0'
    ta.setAttribute('readonly', '')
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

function makeButton(pre: HTMLElement): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'code-copy'
  btn.textContent = LABEL_COPY
  btn.setAttribute('aria-label', '复制这段代码')

  btn.addEventListener('click', async () => {
    const code = pre.querySelector('code')?.textContent ?? ''
    const ok = await copyText(code)

    if (ok) {
      btn.textContent = LABEL_DONE
      btn.classList.add('is-done')
    } else {
      // 两条路都不通：选中文本，让用户自己按 Ctrl+C
      const range = document.createRange()
      const codeEl = pre.querySelector('code')
      if (codeEl) {
        range.selectNodeContents(codeEl)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
      btn.textContent = LABEL_FAIL
    }

    window.setTimeout(() => {
      btn.textContent = LABEL_COPY
      btn.classList.remove('is-done')
    }, 1800)
  })

  return btn
}

function attach(): void {
  // 兜底：SSG 预渲染、或者别的地方在无 DOM 环境里调到，直接跳过
  if (typeof document === 'undefined') return
  detach()
  const root = document.querySelector(props.target)
  if (!root) return

  for (const pre of Array.from(root.querySelectorAll('pre'))) {
    const el = pre as HTMLElement
    // 已经加过就跳过（watch 可能重复触发）
    if (el.querySelector(':scope > .code-copy')) continue
    // <pre> 要能定位按钮
    el.classList.add('has-copy')
    const btn = makeButton(el)
    el.appendChild(btn)
    buttons.push(btn)
  }
}

function detach(): void {
  for (const btn of buttons) btn.remove()
  buttons = []
}

watch(
  () => props.target,
  async () => {
    // 预渲染时没有 document，这段只属于浏览器
    if (typeof document === 'undefined') return
    await nextTick()
    attach()
  },
)

/*
 * 首次挂载也要跑一遍：上面那个 watch 不设 immediate，
 * 就是为了避免在服务端渲染时执行 DOM 查询。
 */
onMounted(async () => {
  await nextTick()
  attach()
})

onUnmounted(() => {
  detach()
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <!-- 纯行为组件，不渲染任何东西 -->
  <span hidden aria-hidden="true" />
</template>

<style>
/*
 * 注意：这里不能用 scoped。
 * 按钮是脚本创建、插进 v-html 内容里的，拿不到 scoped 的 data 属性。
 * 所以用 .code-copy 这个足够独特的类名做隔离，并挂在 .prose 下面。
 */
.prose pre.has-copy {
  position: relative;
}

.code-copy {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 3px 9px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  backdrop-filter: blur(6px);
  color: var(--ink-soft);
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  opacity: 0;
  cursor: pointer;
  transition:
    opacity var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out),
    border-color var(--t-fast) var(--ease-out);
}

.prose pre.has-copy:hover .code-copy,
.code-copy:focus-visible {
  opacity: 1;
}

.code-copy:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.code-copy.is-done {
  color: var(--accent);
  border-color: var(--accent);
  opacity: 1;
}

/* 触屏没有 hover：常显，否则永远点不到 */
@media (hover: none) {
  .code-copy {
    opacity: 1;
  }
}

@media print {
  .code-copy {
    display: none;
  }
}
</style>
