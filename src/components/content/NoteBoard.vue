<script setup lang="ts">
/**
 * 便条板 —— 摸鱼分区里那个"手机写、电脑取"的格子。
 *
 * 【为什么它长成三个格子，而不是一个列表】
 *   三个格子是刻意的容量上限（见 useNotes 的注释）。
 *   视觉上也按"三张便利贴贴在软木板上"来做：
 *   每张有点自己的倾斜角度、纸色、按钉——
 *   这样"只有三条"看起来是设计，而不是功能缺失。
 *
 * 【为什么要有密钥这道门】
 *   数据放在公共中转站上，谁知道主题名谁就能读。
 *   所以第一屏不是输入框，是一道锁：没有密钥就什么也看不到。
 *   这不是"登录"，是"知道门牌号才找得到这间房"。
 *   密钥只存在本机，不上传、不写进仓库。
 *
 * 【为什么手机端是"写"，电脑端是"取"】
 *   同一套界面，靠屏幕宽度决定主次：
 *   窄屏把输入框顶到最上面（你多半是来发的），
 *   宽屏把便条顶到最上面（你多半是来抄的）。
 *   不判断设备，只看宽度——平板横过来就当电脑用，这是对的。
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Check, Copy, KeyRound, Loader, Lock, Plus, Trash, X } from '@lucide/vue'
import {
  MAX_NOTES,
  ago,
  copyText,
  currentServer,
  deleteNote,
  fetchNotes,
  postImage,
  postNote,
  readKey,
  saveKey,
  saveServer,
  shareUrl,
  shrinkImage,
  topicOf,
  type Note,
} from '@/composables/useNotes'
import { site } from '@/data/site.config'

/*
 * 守在密钥门边的小插画——一个坐在桌前等你想好密钥的人。
 * 用径向遮罩把四周羽化成"印在纸上的一小圈画"，不带相框感。
 * 只在宽屏显示：手机上的门已经够窄了，再站个人就挤了。
 */
const deskGirlUrl = (() => {
  const b = site.base.endsWith('/') ? site.base.slice(0, -1) : site.base
  return `${b}/art/girls/notes-desk.webp`
})()

/** 已解锁：密钥有效、主题算出来了 */
const unlocked = ref(false)
/** 密钥输入框的内容 */
const keyInput = ref('')
/** 当前生效的主题名 */
const topic = ref('')
const notes = ref<Note[]>([])
const loading = ref(false)
const error = ref('')

/** 正在写的内容 */
const draft = ref('')
const posting = ref(false)
/** 刚复制走的那一条的 id，用来把按钮临时改成"已复制" */
const copiedId = ref('')
/** 刚删掉的那一条，用来做退场动画 */
const removingId = ref('')

const fileInput = ref<HTMLInputElement | null>(null)
/** 选好了但还没发的图 */
const pendingImage = ref<{ blob: Blob; name: string; preview: string } | null>(null)

const full = computed(() => notes.value.length >= MAX_NOTES)
const canSend = computed(
  () => !posting.value && (draft.value.trim().length > 0 || !!pendingImage.value),
)

let refreshTimer = 0
let copiedTimer = 0

/* ── 中转服务器 ─────────────────────────────────────────── */

/*
 * 跨设备互传走的是公网中转（ntfy 协议）。默认的 ntfy.sh
 * 在个别网络环境下可能连不通——换一台能连通的实例即可，
 * 密钥、消息全部照旧。地址只存在本机。
 */
const serverInput = ref('')
const serverOpen = ref(false)

function applyServer() {
  saveServer(serverInput.value)
  serverInput.value = currentServer()
  serverOpen.value = false
  error.value = ''
}

/* ── 解锁 ───────────────────────────────────────────────── */

async function unlock(key: string) {
  const trimmed = key.trim()
  if (!trimmed) return
  error.value = ''
  loading.value = true
  try {
    const t = await topicOf(trimmed)
    // 先拉一次：拉得通才算解锁，拉不通说明密钥/网络有问题
    const list = await fetchNotes(t)
    topic.value = t
    notes.value = list
    saveKey(trimmed)
    unlocked.value = true
    startRefresh()
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    error.value =
      msg === 'Failed to fetch'
        ? '连不上中转服务器。检查网络，或在下方「中转」里换一台 ntfy 实例。'
        : `连不上：${msg}`
  } finally {
    loading.value = false
  }
}

function onUnlock() {
  void unlock(keyInput.value)
}

/** 锁上：忘掉密钥，清掉屏幕上的内容 */
function lock() {
  stopRefresh()
  unlocked.value = false
  topic.value = ''
  notes.value = []
  draft.value = ''
  clearPending()
  saveKey('')
}

/* ── 读 ─────────────────────────────────────────────────── */

async function refresh(silent = true) {
  if (!topic.value) return
  if (!silent) loading.value = true
  try {
    notes.value = await fetchNotes(topic.value)
    error.value = ''
  } catch (err) {
    if (!silent) error.value = err instanceof Error ? err.message : '刷新失败'
  } finally {
    if (!silent) loading.value = false
  }
}

function startRefresh() {
  stopRefresh()
  /*
   * 20 秒刷一次。
   * 手机上写完，电脑上最多等 20 秒就能看到；
   * 再密一点就是白白耗电，毕竟这不是聊天。
   */
  refreshTimer = window.setInterval(() => void refresh(), 20000)
}

function stopRefresh() {
  window.clearInterval(refreshTimer)
  refreshTimer = 0
}

/* ── 写 ─────────────────────────────────────────────────── */

async function send() {
  if (!canSend.value || !topic.value) return
  posting.value = true
  error.value = ''
  try {
    const caption = draft.value.trim()
    if (pendingImage.value) {
      await postImage(topic.value, pendingImage.value.blob, pendingImage.value.name, caption)
    } else {
      await postNote(topic.value, caption)
    }

    draft.value = ''
    clearPending()
    await refresh()

    /*
     * 超过三条：把最旧的删掉。
     * 列表已经按时间倒序，多出来的都在尾部。
     */
    const extra = notes.value.slice(MAX_NOTES)
    for (const n of extra) await deleteNote(topic.value, n.id)
    if (extra.length) await refresh()
  } catch (err) {
    error.value = err instanceof Error ? `没发出去：${err.message}` : '没发出去'
  } finally {
    posting.value = false
  }
}

/** 删一条 */
async function remove(note: Note) {
  if (!topic.value) return
  removingId.value = note.id
  try {
    await deleteNote(topic.value, note.id)
    // 先从屏幕上拿掉，动画才有东西可演
    notes.value = notes.value.filter((n) => n.id !== note.id)
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '删不掉'
  } finally {
    removingId.value = ''
  }
}

/* ── 图 ─────────────────────────────────────────────────── */

async function onPickImage(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  error.value = ''
  try {
    const blob = await shrinkImage(file)
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    clearPending()
    pendingImage.value = { blob, name, preview: URL.createObjectURL(blob) }
  } catch {
    error.value = '这张图读不出来'
  } finally {
    // 允许再选同一张
    input.value = ''
  }
}

function clearPending() {
  if (pendingImage.value) URL.revokeObjectURL(pendingImage.value.preview)
  pendingImage.value = null
}

/* ── 复制 ───────────────────────────────────────────────── */

async function copy(note: Note) {
  const text = note.text || note.image || ''
  const ok = await copyText(text)
  if (!ok) {
    error.value = '浏览器不让写剪贴板，长按自己复制吧'
    return
  }
  copiedId.value = note.id
  window.clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => (copiedId.value = ''), 1600)
}

/* ── 生命周期 ───────────────────────────────────────────── */

onMounted(() => {
  serverInput.value = currentServer()
  const saved = readKey()
  if (saved) {
    keyInput.value = saved
    void unlock(saved)
  }
})

onUnmounted(() => {
  stopRefresh()
  window.clearTimeout(copiedTimer)
  clearPending()
})

// 从 #notes 锚点进来时，直接把焦点放到密钥框
watch(unlocked, (on) => {
  if (!on && location.hash === '#notes') {
    document.querySelector<HTMLInputElement>('.notes-key-input')?.focus()
  }
})
</script>

<template>
  <div class="notes">
    <header class="notes-head">
      <div>
        <p class="notes-kicker">note board</p>
        <h3 class="notes-title">便条板</h3>
        <p class="notes-sub">
          {{ unlocked ? `手机写一条，电脑上复制走 · 最多 ${MAX_NOTES} 条` : '一把钥匙，三格便条' }}
        </p>
      </div>
      <button v-if="unlocked" type="button" class="notes-lock" title="锁上" @click="lock">
        <Lock :size="13" :stroke-width="1.9" aria-hidden="true" />
        锁上
      </button>
    </header>

    <!-- ── 未解锁：一道锁 ─────────────────────────────────── -->
    <div v-if="!unlocked" class="notes-gate-row">
      <div class="notes-gate">
        <KeyRound :size="22" :stroke-width="1.6" aria-hidden="true" class="gate-icon" />
        <p class="gate-text">
          这块板子不对外。
          <br />
          输入你的密钥才打得开——手机和电脑用同一个。
        </p>
        <form class="gate-form" @submit.prevent="onUnlock">
          <input
            v-model="keyInput"
            class="notes-key-input"
            type="password"
            autocomplete="off"
            placeholder="密钥"
            :disabled="loading"
            aria-label="便条板密钥"
          />
          <button type="submit" class="gate-btn" :disabled="loading || !keyInput.trim()">
            <Loader v-if="loading" :size="14" class="spin" aria-hidden="true" />
            {{ loading ? '开门中' : '开' }}
          </button>
        </form>

        <p v-if="error" class="notes-error gate-error">{{ error }}</p>

        <p class="gate-note">
          消息走公网中转（ntfy），不走局域网——手机用流量、电脑用宽带也互传得到。
          密钥只存在这台设备的浏览器里，不上传、不进仓库。 手机第一次用，把这个地址存成书签：
          <code>{{ shareUrl() }}</code>
        </p>

        <!-- 中转服务器：默认 ntfy.sh，连不通时换一台 -->
        <button type="button" class="gate-relay-toggle" @click="serverOpen = !serverOpen">
          {{ serverOpen ? '收起中转设置' : '连不通？换一台中转' }}
        </button>
        <div v-if="serverOpen" class="gate-relay">
          <input
            v-model="serverInput"
            class="notes-key-input"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder="https://ntfy.sh"
            aria-label="ntfy 中转服务器地址"
          />
          <button type="button" class="gate-btn" @click="applyServer">记住了</button>
          <p class="gate-relay-hint">
            当前：{{ currentServer() }}。必须是 https:// 开头的 ntfy 兼容实例；
            换了服务器，两台设备要换成同一个，消息才碰得上。
          </p>
        </div>
      </div>

      <img
        class="gate-companion"
        :src="deskGirlUrl"
        alt=""
        width="931"
        height="1100"
        loading="lazy"
        decoding="async"
      />
    </div>

    <!-- ── 已解锁 ─────────────────────────────────────────── -->
    <template v-else>
      <!-- 写：窄屏在上，宽屏在下 -->
      <div class="notes-compose">
        <div v-if="pendingImage" class="compose-image">
          <img :src="pendingImage.preview" alt="待发送的图" />
          <button type="button" class="compose-image-x" title="去掉这张图" @click="clearPending">
            <X :size="12" :stroke-width="2.4" aria-hidden="true" />
          </button>
        </div>

        <div class="compose-row">
          <textarea
            v-model="draft"
            class="compose-input"
            rows="2"
            placeholder="要带走的字、一句话、或者只发一张图"
            :disabled="posting"
            aria-label="便条内容"
            @keydown.ctrl.enter.prevent="send"
            @keydown.meta.enter.prevent="send"
          />
          <div class="compose-side">
            <button
              type="button"
              class="compose-icon"
              title="选一张图"
              :disabled="posting"
              @click="fileInput?.click()"
            >
              <Plus :size="15" :stroke-width="2" aria-hidden="true" />
              <span class="sr-only">选一张图</span>
            </button>
            <button
              type="button"
              class="compose-send"
              :disabled="!canSend || full"
              :title="full ? '先删掉一条，最多三条' : '贴上去'"
              @click="send"
            >
              <Loader v-if="posting" :size="14" class="spin" aria-hidden="true" />
              <span v-else>贴</span>
            </button>
          </div>
        </div>

        <input ref="fileInput" type="file" accept="image/*" class="sr-only" @change="onPickImage" />

        <p class="compose-hint">
          <span v-if="full">板子满了，先撕掉一张。</span>
          <span v-else>Ctrl / ⌘ + Enter 也能贴。图会先压到 1600px。</span>
        </p>
      </div>

      <p v-if="error" class="notes-error">{{ error }}</p>

      <!-- 三格便条 -->
      <ul class="notes-grid" :class="{ 'is-empty': !notes.length }">
        <li
          v-for="(note, i) in notes"
          :key="note.id"
          class="note"
          :class="[`note--${i}`, { 'is-removing': removingId === note.id }]"
        >
          <!-- 按钉 -->
          <span class="note-pin" aria-hidden="true" />

          <div class="note-body">
            <a
              v-if="note.image"
              :href="note.image"
              class="note-image"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img :src="note.image" :alt="note.imageName ?? '便条上的图'" loading="lazy" />
            </a>
            <p v-if="note.text" class="note-text">{{ note.text }}</p>
          </div>

          <footer class="note-foot">
            <span class="note-time">{{ ago(note.time) }}</span>
            <div class="note-actions">
              <button type="button" class="note-act" title="复制" @click="copy(note)">
                <Check
                  v-if="copiedId === note.id"
                  :size="13"
                  :stroke-width="2.2"
                  aria-hidden="true"
                />
                <Copy v-else :size="13" :stroke-width="1.9" aria-hidden="true" />
                {{ copiedId === note.id ? '已复制' : '复制' }}
              </button>
              <button
                type="button"
                class="note-act note-act--del"
                title="撕掉"
                @click="remove(note)"
              >
                <Trash :size="13" :stroke-width="1.9" aria-hidden="true" />
                <span class="sr-only">撕掉这张</span>
              </button>
            </div>
          </footer>
        </li>

        <!-- 空格子：告诉你有几个位置，别让人以为是加载中 -->
        <li
          v-for="slot in Math.max(0, MAX_NOTES - notes.length)"
          :key="`empty-${slot}`"
          class="note note--empty"
          aria-hidden="true"
        >
          <span class="note-pin" />
          <span class="empty-mark">{{ slot === MAX_NOTES ? '空' : '' }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.notes {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  max-width: 720px;
  margin-inline: auto;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: var(--r-card);
  background: var(--surface);
}

.notes-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.notes-kicker {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.notes-title {
  margin-top: 2px;
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1.3;
}

.notes-sub {
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--ink-soft);
}

.notes-lock {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  padding: 0 10px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  font-size: 11px;
  color: var(--ink-soft);
  transition:
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.notes-lock:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ── 锁 ─────────────────────────────────────────────────── */
/* 横排：门 + 陪在门边的她。窄屏时她不出现，行为和原来一样 */
.notes-gate-row {
  flex: 1;
  display: flex;
  align-items: stretch;
  gap: 14px;
  min-height: 0;
}

.notes-gate {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 18px 10px;
  text-align: center;
  border: 1px dashed var(--line);
  border-radius: var(--r-input);
  background: var(--bg-soft);
}

/*
 * 她坐在桌前的那张画。
 * 图文件自带椭圆羽化的透明通道，四周平滑淡掉，
 * 不加边框也不见矩形边——像印在附录纸面上的一小笔。
 */
.gate-companion {
  display: none;
  flex: 0 0 auto;
  align-self: center;
  width: clamp(160px, 22%, 250px);
  height: auto;
  opacity: 0.9;
}

@media (min-width: 1024px) {
  .gate-companion {
    display: block;
  }
}

.gate-icon {
  color: var(--accent);
  opacity: 0.7;
}

.gate-text {
  font-family: var(--font-quote);
  font-size: 12.5px;
  line-height: 1.9;
  color: var(--ink-soft);
}

.gate-form {
  display: flex;
  gap: 6px;
  width: min(260px, 100%);
}

.notes-key-input {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 11px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  background: var(--surface);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--ink);
}

.notes-key-input:focus {
  outline: none;
  border-color: var(--accent);
}

.gate-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 16px;
  border-radius: var(--r-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 12px;
}

.gate-btn:disabled {
  opacity: 0.45;
}

.gate-note {
  max-width: 34em;
  font-size: 10.5px;
  line-height: 1.8;
  color: var(--ink-soft);
  opacity: 0.8;
}

.gate-note code {
  display: inline-block;
  margin-top: 3px;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--ink-soft) 12%, transparent);
  font-family: var(--font-mono);
  font-size: 10px;
  word-break: break-all;
}

.gate-error {
  border-radius: var(--r-input);
}

/* ── 中转服务器设置 ─────────────────────────────────────── */
.gate-relay-toggle {
  padding: 0;
  border: 0;
  background: none;
  font-size: 10.5px;
  color: var(--ink-soft);
  text-decoration: underline dashed;
  text-underline-offset: 3px;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease-out);
}

.gate-relay-toggle:hover {
  color: var(--accent);
}

.gate-relay {
  display: grid;
  gap: 6px;
  width: min(320px, 100%);
}

.gate-relay-hint {
  font-size: 10px;
  line-height: 1.7;
  color: var(--ink-soft);
  opacity: 0.8;
  word-break: break-all;
}

/* ── 写 ─────────────────────────────────────────────────── */
.notes-compose {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: var(--r-input);
  border: 1px solid var(--line);
  background: var(--bg-soft);
}

.compose-image {
  position: relative;
  width: 100%;
  max-height: 120px;
  overflow: hidden;
  border-radius: 8px;
}

.compose-image img {
  width: 100%;
  height: 100%;
  max-height: 120px;
  object-fit: cover;
}

.compose-image-x {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: color-mix(in srgb, #000 55%, transparent);
  color: #fff;
}

.compose-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.compose-input {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: var(--surface);
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--ink);
  resize: none;
}

.compose-input:focus {
  outline: none;
  border-color: var(--accent);
}

.compose-side {
  flex: 0 0 auto;
  display: flex;
  gap: 4px;
}

.compose-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  color: var(--ink-soft);
  transition:
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.compose-icon:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.compose-send {
  display: grid;
  place-items: center;
  min-width: 46px;
  height: 34px;
  padding: 0 12px;
  border-radius: var(--r-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-display);
  font-size: 12.5px;
}

.compose-send:disabled {
  opacity: 0.4;
}

.compose-hint {
  font-size: 10.5px;
  color: var(--ink-soft);
  opacity: 0.85;
}

.notes-error {
  padding: 7px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--stamp-ink) 12%, transparent);
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--stamp-ink);
}

/* ── 三格便条 ───────────────────────────────────────────── */
.notes-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-content: start;
}

.note {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 104px;
  padding: 14px 11px 9px;
  border-radius: 4px;
  /*
   * 三张纸色各不相同，像从三叠不同的便签上撕下来的。
   * 都用 color-mix 从 token 派生，不写死颜色，
   * 换主题时它们会跟着变。
   */
  background: color-mix(in srgb, var(--accent-soft) 62%, var(--surface));
  box-shadow: 0 4px 12px color-mix(in srgb, var(--ink) 9%, transparent);
  transition:
    opacity var(--t-base) var(--ease-out),
    transform var(--t-base) var(--ease-out);
}

/* 每张轻微歪一点：正的排三张太像表格 */
.note--0 {
  transform: rotate(-1.1deg);
}

.note--1 {
  transform: rotate(0.8deg);
  background: color-mix(in srgb, var(--bg-soft) 82%, var(--surface));
}

.note--2 {
  transform: rotate(-0.5deg);
  background: color-mix(in srgb, var(--accent-soft) 32%, var(--bg-soft));
}

.note.is-removing {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}

.note-pin {
  position: absolute;
  top: 5px;
  left: 50%;
  width: 6px;
  height: 6px;
  margin-left: -3px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent) 55%, var(--ink));
  opacity: 0.5;
}

.note-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.note-image {
  display: block;
  overflow: hidden;
  border-radius: 3px;
}

.note-image img {
  display: block;
  width: 100%;
  max-height: 96px;
  object-fit: cover;
}

.note-text {
  font-family: var(--font-quote);
  font-size: 12.5px;
  line-height: 1.75;
  color: var(--ink);
  /*
   * 便条上的字最多看六行。
   * 再多就该自己去别处存了——这本来是中转站，不是笔记应用。
   */
  display: -webkit-box;
  -webkit-line-clamp: 6;
  line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
}

.note-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed color-mix(in srgb, var(--ink-soft) 28%, transparent);
}

.note-time {
  font-family: var(--font-mono);
  font-size: 9.5px;
  color: var(--ink-soft);
  opacity: 0.85;
}

.note-actions {
  display: flex;
  gap: 2px;
}

.note-act {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 5px;
  border-radius: 5px;
  font-size: 10px;
  color: var(--ink-soft);
  transition:
    color var(--t-fast) var(--ease-out),
    background-color var(--t-fast) var(--ease-out);
}

.note-act:hover {
  color: var(--accent);
  background: color-mix(in srgb, var(--surface) 60%, transparent);
}

.note-act--del:hover {
  color: var(--stamp-ink);
}

/* 空格子：一张虚线，什么都没有 */
.note--empty {
  background: transparent;
  border: 1px dashed color-mix(in srgb, var(--line) 90%, transparent);
  box-shadow: none;
  transform: none;
  opacity: 0.55;
}

.note--empty .note-pin {
  background: var(--line);
}

.empty-mark {
  margin: auto;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--ink-soft);
  opacity: 0.5;
}

/* ── 窄屏：写在上，便条竖着排 ───────────────────────────── */
@media (max-width: 767px) {
  .notes {
    padding: 16px;
  }

  .notes-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  /* 手机上一列三张，歪着的排起来会互相挤，统一摆正 */
  .note--0,
  .note--1,
  .note--2 {
    transform: none;
  }

  .note {
    min-height: 0;
  }

  .note--empty {
    /* 手机上空格子只留一张，不然要滑半天才见到输入框 */
    display: none;
  }

  .note--empty:first-of-type:not(:only-child) {
    display: flex;
  }
}

/* ── 转圈 ───────────────────────────────────────────────── */
.spin {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spin {
    animation: none;
  }

  .note {
    transition: none;
  }
}

[data-motion='off'] .spin {
  animation: none;
}

[data-motion='off'] .note {
  transition: none;
}
</style>
