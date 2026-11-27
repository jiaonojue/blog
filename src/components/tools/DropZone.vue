<script setup lang="ts">
/**
 * 拖放区 —— 四个本地工具共用的文件入口。
 *
 * 【为什么统一成一个组件】
 *   四个工具（番剧表导入、MD 阅读器、Word 转 PDF、图片压缩）都要"选一个文件"。
 *   如果每个页面各写一遍，拖放样式、键盘可达性、错误提示会四处不一样。
 *   这里写一次，四个工具都长一个样。
 *
 * 【为什么不用 <input type="file"> 直接裸露】
 *   原生的文件按钮又小又丑，而且"拖进来"是这类工具最自然的用法。
 *   但我们仍然保留一个真的 input（视觉上藏起来），因为键盘用户需要它。
 */
import { ref } from 'vue'

const props = defineProps<{
  /** 接受的文件类型，例如 '.xlsx' 或 'image/*' */
  accept: string
  /** 主提示语 */
  label: string
  /** 副提示语，说清楚能拖什么 */
  hint?: string
  /** 单文件模式（默认）还是多文件 */
  multiple?: boolean
}>()

const emit = defineEmits<{
  files: [files: File[]]
}>()

const over = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)

function pick() {
  inputEl.value?.click()
}

function onChange(e: Event) {
  const input = e.target as HTMLInputElement
  emitFiles(input.files)
  // 清空，否则选同一个文件第二次不会触发 change
  input.value = ''
}

function onDrop(e: DragEvent) {
  over.value = false
  emitFiles(e.dataTransfer?.files ?? null)
}

function emitFiles(list: FileList | null) {
  if (!list?.length) return
  emit('files', Array.from(list))
}
</script>

<template>
  <div
    class="drop-zone"
    :class="{ over }"
    role="button"
    tabindex="0"
    :aria-label="label"
    @click="pick"
    @keydown.enter.prevent="pick"
    @keydown.space.prevent="pick"
    @dragover.prevent="over = true"
    @dragleave.prevent="over = false"
    @drop.prevent="onDrop"
  >
    <input
      ref="inputEl"
      class="drop-input"
      type="file"
      :accept="props.accept"
      :multiple="props.multiple"
      @change="onChange"
    />

    <span class="drop-icon" aria-hidden="true">
      <slot name="icon" />
    </span>
    <span class="drop-label">{{ label }}</span>
    <span v-if="hint" class="drop-hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 24px;
  border-radius: var(--r-card);
  border: 1.5px dashed var(--line);
  background: var(--surface);
  text-align: center;
  cursor: pointer;
  transition:
    border-color var(--t-fast) var(--ease-out),
    background-color var(--t-fast) var(--ease-out);
}

.drop-zone:hover,
.drop-zone:focus-visible {
  border-color: var(--accent);
  outline: none;
}

.drop-zone.over {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.drop-input {
  /* 真的 input 要留着（键盘和读屏用），只是看不见 */
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.drop-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  transition: transform var(--t-base) var(--ease-out);
}

.drop-zone.over .drop-icon {
  transform: translateY(-3px) scale(1.06);
}

.drop-label {
  font-size: 14.5px;
  color: var(--ink);
}

.drop-hint {
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
}

[data-motion='off'] .drop-zone.over .drop-icon {
  transform: none;
}
</style>
