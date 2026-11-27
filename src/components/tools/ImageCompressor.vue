<script setup lang="ts">
/**
 * 图片压缩 —— 把任意图片压到"适合放进博客"的尺寸。
 *
 * 【为什么需要】
 *   手机随手拍的一张图 4MB，直接放进文章会让读者等十秒。
 *   博客正文里的图 1600px 宽就够了，封面 1600×900，相册 1200px。
 *   这个工具把这些判断都做掉：拖进来，选用途，下载压好的 WebP。
 *
 * 【为什么在浏览器里压】
 *   不需要装软件、不需要上传、不会压缩画质以外的东西。
 *   用 canvas 重绘 + WebP 编码，现代浏览器都支持。
 *
 * 【关于 WebP】
 *   体积通常比 JPG 小 25–35%，画质肉眼看不出差别。
 *   所有现代浏览器都支持，GitHub Pages 也能正常返回。
 */
import { computed, ref } from 'vue'
import DropZone from '@/components/tools/DropZone.vue'
import { Image as ImageIcon, Download, Trash2, Loader2 } from '@lucide/vue'

/** 三种预设：改这里就能调整输出规格 */
const PRESETS = [
  { key: 'post', label: '文章配图', width: 1600, height: 0, quality: 0.82 },
  { key: 'cover', label: '文章封面', width: 1600, height: 900, quality: 0.82 },
  { key: 'thumb', label: '缩略图', width: 640, height: 0, quality: 0.8 },
] as const

type PresetKey = (typeof PRESETS)[number]['key']

interface Item {
  id: number
  name: string
  before: number
  after: number
  url: string
  blob: Blob
  width: number
  height: number
  outName: string
}

const preset = ref<PresetKey>('post')
const items = ref<Item[]>([])
const busy = ref(false)
const error = ref('')

let seq = 0

const current = computed(() => PRESETS.find((p) => p.key === preset.value) ?? PRESETS[0])

function kb(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.round(n / 1024)} KB`
}

/** 压缩比例，用来显示"省了多少" */
function saved(item: Item): string {
  if (!item.before) return '—'
  const pct = Math.round((1 - item.after / item.before) * 100)
  return pct > 0 ? `省 ${pct}%` : '已是最优'
}

/** 用 canvas 重绘并编码成 WebP */
async function compress(file: File): Promise<Item> {
  const bitmap = await createImageBitmap(file)
  const p = current.value

  // 目标宽度：不超过预设宽度；原图更小就保持原尺寸，不放大
  const w = Math.min(bitmap.width, p.width)
  const h = Math.round((bitmap.height * w) / bitmap.width)

  // 有固定高宽比的预设（封面）：按 cover 逻辑裁切
  if (p.height > 0) {
    const targetRatio = p.width / p.height
    const srcRatio = bitmap.width / bitmap.height
    let sx = 0
    let sy = 0
    let sw = bitmap.width
    let sh = bitmap.height

    if (srcRatio > targetRatio) {
      // 原图更宽：左右裁掉
      sw = Math.round(bitmap.height * targetRatio)
      sx = Math.round((bitmap.width - sw) / 2)
    } else {
      // 原图更高：上下裁掉
      sh = Math.round(bitmap.width / targetRatio)
      sy = Math.round((bitmap.height - sh) / 2)
    }

    // 裁切后的画布直接就是预设尺寸，不用再算缩放
    const canvas = document.createElement('canvas')
    canvas.width = p.width
    canvas.height = p.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('浏览器不支持 canvas')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, p.width, p.height)
    bitmap.close()

    const blob = await toWebp(canvas, p.quality)
    return finish(file, blob, p.width, p.height)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器不支持 canvas')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await toWebp(canvas, p.quality)
  return finish(file, blob, w, h)
}

/** canvas → WebP Blob；浏览器不支持 WebP 时退回 JPEG */
function toWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        // 有些老浏览器不支持 WebP 编码，退回 JPEG
        canvas.toBlob(
          (jpg) => (jpg ? resolve(jpg) : reject(new Error('编码失败'))),
          'image/jpeg',
          quality,
        )
      },
      'image/webp',
      quality,
    )
  })
}

function finish(file: File, blob: Blob, width: number, height: number): Item {
  const base = file.name.replace(/\.[^.]+$/, '')
  const isWebp = blob.type === 'image/webp'
  return {
    id: ++seq,
    name: file.name,
    before: file.size,
    after: blob.size,
    url: URL.createObjectURL(blob),
    blob,
    width,
    height,
    outName: `${base}.${isWebp ? 'webp' : 'jpg'}`,
  }
}

async function onFiles(files: File[]) {
  error.value = ''
  busy.value = true

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      error.value = `「${file.name}」不是图片，跳过了。`
      continue
    }
    // SVG 是矢量的，压缩没意义（重绘反而会丢清晰度）
    if (file.type === 'image/svg+xml') {
      error.value = `「${file.name}」是 SVG，矢量图不需要压缩。`
      continue
    }
    try {
      items.value.push(await compress(file))
    } catch (e) {
      error.value = `「${file.name}」处理失败：${e instanceof Error ? e.message : String(e)}`
    }
  }

  busy.value = false
}

function download(item: Item) {
  const a = document.createElement('a')
  a.href = item.url
  a.download = item.outName
  a.click()
}

function downloadAll() {
  for (const item of items.value) download(item)
}

function remove(id: number) {
  const i = items.value.findIndex((x) => x.id === id)
  if (i < 0) return
  URL.revokeObjectURL(items.value[i].url)
  items.value.splice(i, 1)
}

const totalBefore = computed(() => items.value.reduce((s, i) => s + i.before, 0))
const totalAfter = computed(() => items.value.reduce((s, i) => s + i.after, 0))
</script>

<template>
  <section class="img-tool">
    <!-- 预设选择 -->
    <div class="img-presets" role="radiogroup" aria-label="输出规格">
      <button
        v-for="p in PRESETS"
        :key="p.key"
        type="button"
        class="img-preset"
        :class="{ active: preset === p.key }"
        role="radio"
        :aria-checked="preset === p.key"
        @click="preset = p.key"
      >
        <span class="preset-label">{{ p.label }}</span>
        <span class="preset-size">
          {{ p.height ? `${p.width}×${p.height}` : `宽 ${p.width}` }}
        </span>
      </button>
    </div>

    <DropZone
      accept="image/*"
      label="拖图片进来，或点击选择"
      hint="支持 JPG / PNG / WebP / GIF（静态帧），可以一次拖多张。图片不会上传。"
      multiple
      @files="onFiles"
    >
      <template #icon><ImageIcon :size="20" :stroke-width="1.7" /></template>
    </DropZone>

    <p v-if="error" class="img-error">{{ error }}</p>

    <div v-if="busy" class="img-busy">
      <Loader2 :size="15" :stroke-width="2" class="spin" aria-hidden="true" />
      正在压缩…
    </div>

    <!-- 结果 -->
    <template v-if="items.length">
      <div class="img-summary">
        <span>
          {{ items.length }} 张 · {{ kb(totalBefore) }} →
          <strong>{{ kb(totalAfter) }}</strong>
        </span>
        <button type="button" class="img-dl-all" @click="downloadAll">
          <Download :size="13" :stroke-width="2" aria-hidden="true" />
          全部下载
        </button>
      </div>

      <ul class="img-list">
        <li v-for="item in items" :key="item.id" class="img-row">
          <span class="img-thumb">
            <img :src="item.url" :alt="item.name" loading="lazy" decoding="async" />
          </span>

          <span class="img-main">
            <span class="img-name">{{ item.outName }}</span>
            <span class="img-meta">
              {{ item.width }}×{{ item.height }} · {{ kb(item.before) }} → {{ kb(item.after) }} ·
              <em>{{ saved(item) }}</em>
            </span>
          </span>

          <button type="button" class="img-act" title="下载" @click="download(item)">
            <Download :size="14" :stroke-width="1.9" aria-hidden="true" />
            <span class="sr-only">下载 {{ item.outName }}</span>
          </button>

          <button type="button" class="img-act" title="移除" @click="remove(item.id)">
            <Trash2 :size="14" :stroke-width="1.9" aria-hidden="true" />
            <span class="sr-only">移除 {{ item.outName }}</span>
          </button>
        </li>
      </ul>

      <p class="img-tip">
        下载后把文件放进
        <code>public/art/posts/</code>
        （或
        <code>public/gallery/</code>
        ）， 然后在文章的 frontmatter 里写
        <code>cover: /art/posts/文件名.webp</code>
        。 记得在
        <code>public/art/CREDITS.md</code>
        登记来源。
      </p>
    </template>
  </section>
</template>

<style scoped>
.img-tool {
  display: grid;
  gap: 16px;
}

/* ── 预设 ───────────────────────────────────────────────── */
.img-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.img-preset {
  display: grid;
  gap: 2px;
  padding: 9px 15px;
  border-radius: var(--r-input);
  border: 1px solid var(--line);
  background: var(--surface);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--t-fast) var(--ease-out),
    background-color var(--t-fast) var(--ease-out);
}

.img-preset.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.preset-label {
  font-size: 13px;
  color: var(--ink);
}

.img-preset.active .preset-label {
  color: var(--accent);
}

.preset-size {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.03em;
  color: var(--ink-soft);
}

/* ── 状态 ───────────────────────────────────────────────── */
.img-error {
  padding: 10px 14px;
  border-radius: var(--r-input);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 13px;
}

.img-busy {
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

/* ── 汇总 ───────────────────────────────────────────────── */
.img-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

.img-summary strong {
  color: var(--accent);
  font-weight: 600;
}

.img-dl-all {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  padding: 5px 12px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink-soft);
  font-size: 11.5px;
  cursor: pointer;
}

.img-dl-all:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ── 列表 ───────────────────────────────────────────────── */
.img-list {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.img-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: var(--r-input);
  transition: background-color var(--t-fast) var(--ease-out);
}

.img-row:hover {
  background: var(--bg-soft);
}

.img-thumb {
  width: 54px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-soft);
}

.img-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.img-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.img-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.img-meta {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.03em;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

.img-meta em {
  font-style: normal;
  color: var(--accent);
}

.img-act {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border-radius: 50%;
  border: 1px solid var(--line);
  color: var(--ink-soft);
  cursor: pointer;
  transition:
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.img-act:first-of-type {
  margin-left: auto;
}

.img-act:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ── 提示 ───────────────────────────────────────────────── */
.img-tip {
  padding: 12px 15px;
  border-radius: var(--r-input);
  border: 1px dashed var(--line);
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--ink-soft);
}

.img-tip code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--bg-soft);
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--ink);
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
