<script setup lang="ts">
/**
 * 猜番 —— 一张糊到认不出的封面，加一句话提示，猜这是哪一部。
 *
 * 【为什么用"糊掉的封面"而不是截图】
 *   截图是别人的画面，贴上来就是复制；封面糊到只剩色块之后，
 *   它传递的信息只有"色调"，不再是作品的一部分。
 *   而且这正是玩法本身：模糊到一定程度，颜色反而成了线索。
 *
 * 【两个难度不是"同一个玩法加难度"】
 *   简单是四选一——你只要在四个里认出来就行，
 *   本质上是"排除法"，适合手边没键盘的时候。
 *   困难要求自己把名字打出来，还要打对简称/别名，
 *   所以界面也一起换：方角、深色纸、等宽字、一道红边，
 *   像从"杂志彩页"翻到了"内部资料"。难度应该看得见。
 *
 * 【答案为什么接受别名】
 *   没人会把「辉夜大小姐想让我告白～天才们的恋爱头脑战～」打全。
 *   常见简称（春物、小圆、石头门、波奇）和"只打了前半截"都算对，
 *   判定逻辑在 useAnimeList 的 isTitleMatch 里，这里只负责调。
 *   考的是"认不认得出来"，不是"背不背得下全名"。
 *
 * 【为什么玩法零版权风险】
 *   题面只有：一张被处理过的封面、一句自己写的话、番名和数字。
 *   没有任何一帧原画、台词、角色立绘。
 */
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { ArrowRight, Eye, RotateCcw } from '@lucide/vue'
import {
  DIMENSIONS,
  coverUrl,
  isTitleMatch,
  loadAnimeList,
  loadHints,
  pickRandom,
  type AnimeEntry,
  type HintMap,
} from '@/composables/useAnimeList'

type Mode = 'easy' | 'hard'

const list = ref<AnimeEntry[]>([])
const hints = ref<HintMap>({})
const loading = ref(true)
const error = ref(false)

/** 简单 / 困难 */
const mode = ref<Mode>('easy')

/** 本题的正确答案 */
const answer = ref<AnimeEntry | null>(null)
/** 简单模式的四个选项（含正确答案） */
const options = ref<AnimeEntry[]>([])
/** 简单模式选中的番名；null = 还没答 */
const picked = ref<string | null>(null)

/** 困难模式输入的名字 */
const typed = ref('')
/** 困难模式答对了吗 */
const solved = ref(false)
/** 困难模式点了"看答案" */
const gaveUp = ref(false)
/** 困难模式答错次数，用来决定提示的口气 */
const misses = ref(0)
/** 输入框，答错时抖一下 */
const inputEl = ref<HTMLInputElement | null>(null)

const streak = ref(0)
/** 上一题的番名，下一题不重复出 */
let lastAnswer = ''

const answered = computed(() =>
  mode.value === 'easy' ? picked.value !== null : solved.value || gaveUp.value,
)
const correct = computed(() =>
  mode.value === 'easy' ? picked.value === answer.value?.name : solved.value,
)

/** 本题的一句话提示 */
const hint = computed(() => (answer.value ? (hints.value[answer.value.name]?.hint ?? '') : ''))
/** 本题接受的别名 */
const aliases = computed(() =>
  answer.value ? (hints.value[answer.value.name]?.aliases ?? []) : [],
)

/** 七维里最大的一档，用来算条形图长度 */
const maxDim = computed(() => {
  if (!answer.value) return 10
  const vals = DIMENSIONS.map((d) => Number(answer.value?.[d.key] ?? 0))
  return Math.max(10, ...vals)
})

function buildQuestion(pool: AnimeEntry[]) {
  const candidates = pool.filter((x) => x.name !== lastAnswer)
  const target = pickRandom(candidates.length ? candidates : pool)
  if (!target) return

  lastAnswer = target.name
  answer.value = target
  picked.value = null
  typed.value = ''
  solved.value = false
  gaveUp.value = false
  misses.value = 0

  /*
   * 干扰项：按 |总分差| 排序，从最接近的 12 部里抽 3 个。
   * 不用"分数完全相同"——那样玩家能靠排除法做出来。
   */
  const near = pool
    .filter((x) => x.name !== target.name)
    .sort((a, b) => Math.abs(a.score - target.score) - Math.abs(b.score - target.score))
    .slice(0, 12)

  const distractors: AnimeEntry[] = []
  const used = new Set([target.name])
  while (distractors.length < 3 && near.length) {
    const pick = pickRandom(near)
    if (!pick || used.has(pick.name)) {
      const next = near.find((x) => !used.has(x.name))
      if (!next) break
      used.add(next.name)
      distractors.push(next)
      continue
    }
    used.add(pick.name)
    distractors.push(pick)
  }

  options.value = [target, ...distractors].sort(() => Math.random() - 0.5)
}

function pickOption(name: string) {
  if (answered.value) return
  picked.value = name
  if (name === answer.value?.name) streak.value += 1
  else streak.value = 0
}

/** 困难模式：对答案 */
function check() {
  if (!answer.value || answered.value) return
  const input = typed.value.trim()
  if (!input) return

  if (isTitleMatch(input, answer.value.name, aliases.value)) {
    solved.value = true
    streak.value += 1
    return
  }

  misses.value += 1
  streak.value = 0
  // 抖一下，让人知道"按到了，只是不对"
  const el = inputEl.value
  if (el) {
    el.classList.remove('is-shake')
    void el.offsetWidth
    el.classList.add('is-shake')
  }
}

/** 困难模式：直接看答案，连对清零 */
function reveal() {
  if (!answer.value || answered.value) return
  gaveUp.value = true
  streak.value = 0
}

function next() {
  if (list.value.length) buildQuestion(list.value)
  void nextTick(() => inputEl.value?.focus())
}

/** 切难度：换一道新题，连对重新算 */
function setMode(m: Mode) {
  if (mode.value === m) return
  mode.value = m
  streak.value = 0
  next()
}

/** 输入法正在拼字时按回车不算提交 */
function onEnter(e: KeyboardEvent) {
  if (e.isComposing) return
  check()
}

onMounted(async () => {
  try {
    list.value = await loadAnimeList()
    if (!list.value.length) throw new Error('empty')
    buildQuestion(list.value)
  } catch {
    error.value = true
  }
  loading.value = false

  /*
   * 提示单独取。取不到不影响出题——题面还有封面和年份，
   * 只是少一句提示，比整块坏掉强。
   */
  try {
    hints.value = await loadHints()
  } catch {
    hints.value = {}
  }
})

/** 切到困难模式时把焦点放进输入框 */
watch(mode, (m) => {
  if (m === 'hard') void nextTick(() => inputEl.value?.focus())
})

/** 选项答完后要不要标出正确答案 */
function optionState(opt: AnimeEntry): 'idle' | 'right' | 'wrong' | 'dim' {
  if (!answered.value) return 'idle'
  if (opt.name === answer.value?.name) return 'right'
  if (opt.name === picked.value) return 'wrong'
  return 'dim'
}
</script>

<template>
  <div class="quiz" :class="{ 'is-hard': mode === 'hard' }">
    <!-- 困难模式的底纹：斜线 + 一枚大号水印。纯装饰 -->
    <span v-if="mode === 'hard'" class="hard-hatch" aria-hidden="true" />
    <span v-if="mode === 'hard'" class="hard-mark" aria-hidden="true">HARD</span>

    <header class="quiz-head">
      <div class="head-id">
        <p class="quiz-kicker">{{ mode === 'hard' ? 'hard · 手入力' : 'easy · 四选一' }}</p>
        <h3 class="quiz-title">猜番</h3>
        <p class="quiz-sub">
          {{
            mode === 'hard'
              ? '一张糊掉的封面，一句话。名字自己打。'
              : '一张糊掉的封面，一句话。四选一。'
          }}
        </p>
      </div>

      <div class="head-side">
        <div class="mode-switch" role="group" aria-label="难度">
          <button
            type="button"
            class="mode-btn"
            :class="{ 'is-on': mode === 'easy' }"
            :aria-pressed="mode === 'easy'"
            @click="setMode('easy')"
          >
            简单
          </button>
          <button
            type="button"
            class="mode-btn mode-btn--hard"
            :class="{ 'is-on': mode === 'hard' }"
            :aria-pressed="mode === 'hard'"
            @click="setMode('hard')"
          >
            困难
          </button>
        </div>
        <div class="quiz-streak" :class="{ 'is-hot': streak >= 3 }">
          <span class="streak-num">{{ streak }}</span>
          <span class="streak-label">连对</span>
        </div>
      </div>
    </header>

    <div class="quiz-scroll">
      <p v-if="loading" class="quiz-state">正在翻评分表……</p>
      <p v-else-if="error" class="quiz-state">评分表没加载出来，刷新试试。</p>

      <template v-else-if="answer">
        <!-- 题面：糊掉的封面 + 一句话 -->
        <div class="question">
          <div class="q-cover" :class="{ 'is-open': answered }">
            <img
              :src="coverUrl(answer)"
              :alt="answered ? `${answer.name} 封面` : '被模糊处理的封面'"
              loading="lazy"
              decoding="async"
            />
            <!-- 答完之后掀掉的那层"毛玻璃" -->
            <span v-if="!answered" class="q-veil" aria-hidden="true" />
          </div>

          <div class="q-info">
            <p class="q-hint">
              {{ hint || '这句提示暂时取不到，就看颜色吧。' }}
            </p>
            <p class="q-facts">
              <span class="q-year">{{ answer.year }}</span>
              <span class="q-sep" aria-hidden="true">·</span>
              <span>{{ answer.status || '未标注' }}</span>
            </p>
          </div>
        </div>

        <!-- ── 简单：四选一 ───────────────────────────── -->
        <ul v-if="mode === 'easy'" class="quiz-options">
          <li v-for="opt in options" :key="opt.name">
            <button
              type="button"
              class="quiz-opt"
              :class="`is-${optionState(opt)}`"
              :disabled="answered"
              @click="pickOption(opt.name)"
            >
              <span class="opt-name">{{ opt.name }}</span>
              <span v-if="optionState(opt) === 'right'" class="opt-mark">答对</span>
              <span v-else-if="optionState(opt) === 'wrong'" class="opt-mark">不是</span>
            </button>
          </li>
        </ul>

        <!-- ── 困难：自己打名字 ───────────────────────── -->
        <form v-else class="hard-form" @submit.prevent="check">
          <div class="hard-input-row">
            <input
              ref="inputEl"
              v-model="typed"
              class="hard-input"
              type="text"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              :placeholder="misses ? '再想想，简称也行' : '番名，或者常用简称'"
              :disabled="answered"
              aria-label="番名"
              @keydown.enter="onEnter"
            />
            <button type="submit" class="hard-submit" :disabled="answered || !typed.trim()">
              对
            </button>
          </div>

          <div class="hard-foot">
            <p v-if="misses && !answered" class="hard-miss">不是这个。已经错了 {{ misses }} 次。</p>
            <p v-else class="hard-tip">打全名、简称、别名都算对。</p>
            <button v-if="!answered" type="button" class="hard-giveup" @click="reveal">
              <Eye :size="12" :stroke-width="1.9" aria-hidden="true" />
              看答案
            </button>
          </div>
        </form>

        <!-- ── 揭晓 ───────────────────────────────────── -->
        <Transition name="reveal">
          <div v-if="answered" class="quiz-reveal">
            <div class="reveal-info">
              <p class="reveal-verdict" :class="correct ? 'is-right' : 'is-wrong'">
                {{ correct ? (mode === 'hard' ? '答对了。' : '答对了。') : '这次没中。' }}
              </p>
              <p class="reveal-name">{{ answer.name }}</p>
              <p class="reveal-meta">
                {{ answer.year }} · {{ answer.status || '未标注' }} · 私心 {{ answer.taste }}
              </p>
              <p v-if="aliases.length" class="reveal-alias">
                也算对：{{ aliases.slice(0, 4).join(' / ') }}
              </p>
            </div>
            <button type="button" class="reveal-next" @click="next">
              <RotateCcw :size="14" :stroke-width="2" aria-hidden="true" />
              下一题
              <ArrowRight :size="13" :stroke-width="2" aria-hidden="true" />
            </button>
          </div>
        </Transition>

        <!-- 评分条形图：答完才给，算是一种"解析" -->
        <ul v-if="answered" class="quiz-dims">
          <li v-for="d in DIMENSIONS" :key="d.key" class="dim-row">
            <span class="dim-label">{{ d.label }}</span>
            <span class="dim-track">
              <span
                class="dim-fill"
                :style="{ width: `${(Number(answer[d.key]) / maxDim) * 100}%` }"
              />
            </span>
            <span class="dim-val">{{ answer[d.key] }}</span>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>

<style scoped>
.quiz {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  /* 附录里一页很宽，卡片收在中间；选项也不该拉成一整行 */
  max-width: 720px;
  margin-inline: auto;
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: var(--r-card);
  background: var(--surface);
  overflow: hidden;
  /* 切难度时纸面和描边一起变，不要"啪"一下 */
  transition:
    background-color var(--t-slow) var(--ease-out),
    border-color var(--t-slow) var(--ease-out),
    border-radius var(--t-slow) var(--ease-out);
}

/* ── 困难模式的"另一张纸" ─────────────────────────────────
 *
 * 【为什么只换这一块，不换整站】
 *   难度是这道题自己的事。整站变暗会让人以为"切主题了"，
 *   只有这张卡片变成"内部资料"的样式，才像"这一关不一样"。
 *   底色往 --bg 方向压（附录里 --bg 比 --surface 深），
 *   全程只用 token，不写死颜色。
 */
.quiz.is-hard {
  border-radius: 4px;
  border-color: color-mix(in srgb, var(--stamp-ink) 40%, var(--line));
  background: color-mix(in srgb, var(--surface) 62%, var(--bg));
}

/* 斜线底纹：像复印过很多次的资料纸 */
.hard-hatch {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: repeating-linear-gradient(
    -45deg,
    color-mix(in srgb, var(--line) 55%, transparent) 0 1px,
    transparent 1px 7px
  );
  opacity: 0.5;
}

/* 水印：大号 HARD，压在右上角，几乎看不见 */
.hard-mark {
  position: absolute;
  right: -6px;
  top: 2px;
  font-family: var(--font-mono);
  font-size: 64px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
  color: var(--stamp-ink);
  opacity: 0.07;
  pointer-events: none;
  user-select: none;
}

/* ── 头 ─────────────────────────────────────────────────── */
.quiz-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.head-id {
  min-width: 0;
}

.quiz-kicker {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.is-hard .quiz-kicker {
  color: var(--stamp-ink);
  opacity: 0.9;
}

.quiz-title {
  margin-top: 2px;
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1.3;
}

.quiz-sub {
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--ink-soft);
}

.head-side {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 难度开关：两个小胶囊拼成一段 */
.mode-switch {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  background: var(--bg-soft);
  transition: border-radius var(--t-slow) var(--ease-out);
}

.is-hard .mode-switch {
  /* 困难模式连开关都变方：圆角是"友好"的形状 */
  border-radius: 4px;
}

.mode-btn {
  padding: 4px 10px;
  border-radius: var(--r-pill);
  font-size: 11px;
  line-height: 1.5;
  color: var(--ink-soft);
  white-space: nowrap;
  transition:
    color var(--t-fast) var(--ease-out),
    background-color var(--t-fast) var(--ease-out);
}

.is-hard .mode-btn {
  border-radius: 2px;
}

.mode-btn:hover {
  color: var(--ink);
}

.mode-btn.is-on {
  background: var(--accent);
  color: var(--accent-ink);
}

.mode-btn--hard.is-on {
  background: var(--stamp-ink);
  color: var(--accent-ink);
}

/* 连对计数：像计分牌 */
.quiz-streak {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  min-width: 46px;
  padding: 4px 6px;
  border-radius: var(--r-input);
  border: 1px solid var(--line);
  transition:
    border-color var(--t-fast) var(--ease-out),
    border-radius var(--t-slow) var(--ease-out);
}

.is-hard .quiz-streak {
  border-radius: 2px;
}

.quiz-streak.is-hot {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.streak-num {
  font-family: var(--font-mono);
  font-size: 16px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}

.quiz-streak.is-hot .streak-num {
  color: var(--accent);
}

.streak-label {
  margin-top: 2px;
  font-size: 9px;
  letter-spacing: 0.1em;
  color: var(--ink-soft);
}

/* ── 滚动区 ─────────────────────────────────────────────── */
/*
 * 舞台高度是固定的（clamp 400~640），困难模式多了输入框和解析，
 * 内容可能比卡片高。让中间这段自己滚，头一直留着。
 */
.quiz-scroll {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 11px;
  /* 细滚动条在暗色纸上很扎眼，收窄一点 */
  scrollbar-width: thin;
}

.quiz-state {
  padding: 14px 0;
  font-size: 12.5px;
  color: var(--ink-soft);
}

/* ── 题面 ───────────────────────────────────────────────── */
.question {
  display: flex;
  align-items: stretch;
  gap: 13px;
}

/* 封面：5:7 竖幅，糊到只剩色块 */
.q-cover {
  position: relative;
  flex: 0 0 auto;
  width: 84px;
  aspect-ratio: 5 / 7;
  overflow: hidden;
  border-radius: 6px;
  background: var(--bg-soft);
  transition: border-radius var(--t-slow) var(--ease-out);
}

.is-hard .q-cover {
  border-radius: 1px;
}

.q-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /*
   * 模糊。
   * scale 放大一圈是为了让模糊后的边缘不露出透明的一圈——
   * blur 会把像素往外扩，容器又裁掉了溢出，不放大就会看到白边。
   *
   * 简单档 14px：能看出是"暖色还是冷色、亮还是暗"，认不出人。
   * 困难档 30px：连色块边界都糊平，只剩一片色温。
   */
  filter: blur(14px) saturate(1.15);
  transform: scale(1.18);
  transition:
    filter var(--t-slow) var(--ease-out),
    transform var(--t-slow) var(--ease-out);
}

.is-hard .q-cover img {
  filter: blur(30px) saturate(1.3) brightness(0.82);
  transform: scale(1.3);
}

/* 答完：把糊的那层揭掉 */
.q-cover.is-open img {
  filter: none;
  transform: scale(1);
}

/* 没答之前，封面上压一层极淡的斜纹，暗示"被处理过" */
.q-veil {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    0deg,
    color-mix(in srgb, var(--ink) 14%, transparent) 0 1px,
    transparent 1px 3px
  );
  opacity: 0.35;
  pointer-events: none;
}

.q-info {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
}

.q-hint {
  font-family: var(--font-quote);
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--ink);
  /* 提示最多三行，再长就把下面的选项挤下去了 */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.q-facts {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ink-soft);
}

.q-year {
  font-size: 13px;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.is-hard .q-year {
  color: var(--stamp-ink);
}

.q-sep {
  opacity: 0.5;
}

/* ── 简单：选项 ─────────────────────────────────────────── */
.quiz-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

@media (max-width: 479px) {
  .quiz-options {
    grid-template-columns: 1fr;
  }
}

.quiz-opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 42px;
  padding: 7px 11px;
  border-radius: var(--r-input);
  border: 1px solid var(--line);
  background: var(--surface);
  font-size: 12.5px;
  line-height: 1.45;
  text-align: left;
  color: var(--ink);
  transition:
    border-color var(--t-fast) var(--ease-out),
    background-color var(--t-fast) var(--ease-out),
    opacity var(--t-fast) var(--ease-out);
}

.quiz-opt:not(:disabled):hover {
  border-color: var(--accent);
}

.quiz-opt.is-right {
  border-color: var(--stamp-ink);
  background: color-mix(in srgb, var(--stamp-ink) 10%, transparent);
}

.quiz-opt.is-wrong {
  border-color: var(--line);
  background: color-mix(in srgb, var(--ink-soft) 8%, transparent);
  text-decoration: line-through;
  text-decoration-color: var(--ink-soft);
  opacity: 0.72;
}

.quiz-opt.is-dim {
  opacity: 0.5;
}

.opt-name {
  min-width: 0;
}

.opt-mark {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.06em;
  color: var(--stamp-ink);
}

.is-wrong .opt-mark {
  color: var(--ink-soft);
}

/* ── 困难：输入 ─────────────────────────────────────────── */
.hard-form {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.hard-input-row {
  display: flex;
  gap: 6px;
}

.hard-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 40px;
  padding: 0 12px;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--stamp-ink) 32%, var(--line));
  background: color-mix(in srgb, var(--bg) 70%, var(--surface));
  font-family: var(--font-body);
  font-size: 13.5px;
  letter-spacing: 0.02em;
  color: var(--ink);
  transition: border-color var(--t-fast) var(--ease-out);
}

.hard-input::placeholder {
  color: var(--ink-soft);
  opacity: 0.7;
}

.hard-input:focus {
  outline: none;
  border-color: var(--stamp-ink);
}

.hard-input:disabled {
  opacity: 0.6;
}

/* 答错时抖一下：不是"错误弹窗"，是"按到了，不对" */
.hard-input.is-shake {
  animation: shake 260ms var(--ease-in-out);
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  22% {
    transform: translateX(-4px);
  }
  55% {
    transform: translateX(4px);
  }
  80% {
    transform: translateX(-2px);
  }
}

.hard-submit {
  flex: 0 0 auto;
  min-width: 48px;
  height: 40px;
  padding: 0 14px;
  border-radius: 4px;
  background: var(--stamp-ink);
  color: var(--accent-ink);
  font-family: var(--font-display);
  font-size: 13px;
  transition: opacity var(--t-fast) var(--ease-out);
}

.hard-submit:disabled {
  opacity: 0.4;
}

.hard-foot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-height: 18px;
}

.hard-tip,
.hard-miss {
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--ink-soft);
}

.hard-miss {
  color: var(--stamp-ink);
}

.hard-giveup {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 4px;
  font-size: 10.5px;
  color: var(--ink-soft);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: color-mix(in srgb, var(--ink-soft) 40%, transparent);
}

.hard-giveup:hover {
  color: var(--stamp-ink);
}

/* ── 揭晓 ───────────────────────────────────────────────── */
.quiz-reveal {
  display: flex;
  align-items: center;
  gap: 11px;
  padding-top: 10px;
  border-top: 1px dashed color-mix(in srgb, var(--line) 90%, transparent);
}

.reveal-info {
  min-width: 0;
  flex: 1 1 auto;
}

.reveal-verdict {
  font-family: var(--font-quote);
  font-size: 11.5px;
  letter-spacing: 0.04em;
}

.reveal-verdict.is-right {
  color: var(--stamp-ink);
}

.reveal-verdict.is-wrong {
  color: var(--ink-soft);
}

.reveal-name {
  margin-top: 2px;
  font-size: 13px;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.reveal-meta {
  margin-top: 3px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ink-soft);
}

.reveal-alias {
  margin-top: 3px;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--ink-soft);
  opacity: 0.85;
}

.reveal-next {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 0 12px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  font-size: 11.5px;
  color: var(--ink);
  transition:
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.is-hard .reveal-next {
  border-radius: 3px;
}

.reveal-next:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* ── 解析：七维条形图 ───────────────────────────────────── */
.quiz-dims {
  display: grid;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px dashed color-mix(in srgb, var(--line) 60%, transparent);
}

.dim-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dim-label {
  flex: 0 0 auto;
  width: 2.6em;
  font-size: 10px;
  color: var(--ink-soft);
}

.dim-track {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--bg-soft) 80%, transparent);
  overflow: hidden;
}

.dim-fill {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: color-mix(in srgb, var(--accent) 72%, var(--ink));
  transition: width var(--t-slow) var(--ease-out);
}

.is-hard .dim-fill {
  background: color-mix(in srgb, var(--stamp-ink) 70%, var(--ink));
}

.dim-val {
  flex: 0 0 auto;
  width: 1.9em;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--ink-soft);
}

/* ── 揭晓淡入 ───────────────────────────────────────────── */
.reveal-enter-active {
  transition:
    opacity var(--t-base) var(--ease-out),
    transform var(--t-base) var(--ease-out);
}

.reveal-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

/* ── 窄屏 ───────────────────────────────────────────────── */
@media (max-width: 560px) {
  .quiz {
    padding: 15px 16px;
  }

  .quiz-head {
    flex-direction: column;
    gap: 8px;
  }

  .head-side {
    width: 100%;
    justify-content: space-between;
  }

  .q-cover {
    width: 68px;
  }

  .q-hint {
    font-size: 12.5px;
    -webkit-line-clamp: 4;
    line-clamp: 4;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal-enter-active,
  .dim-fill,
  .quiz,
  .q-cover,
  .q-cover img {
    transition: none;
  }

  .reveal-enter-from {
    opacity: 1;
    transform: none;
  }

  .hard-input.is-shake {
    animation: none;
  }
}

[data-motion='off'] .reveal-enter-active,
[data-motion='off'] .dim-fill,
[data-motion='off'] .quiz,
[data-motion='off'] .q-cover,
[data-motion='off'] .q-cover img {
  transition: none;
}

[data-motion='off'] .reveal-enter-from {
  opacity: 1;
  transform: none;
}

[data-motion='off'] .hard-input.is-shake {
  animation: none;
}
</style>
