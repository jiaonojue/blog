<script setup lang="ts">
/**
 * 今天看什么 —— 从 174 条评分里抽一部。
 *
 * 【为什么是抽签而不是"推荐"】
 *   站主自己都还没看完一半，谈推荐太自作多情。
 *   抽签诚实得多：它只说明"这些是我打过分的，随手抽一部给你"。
 *
 * 【滚动名字的那 1.2 秒在做什么】
 *   老虎机的错觉靠三件事：名字在换、速度先快后慢、最后"咔"地落定。
 *   这里用 requestAnimationFrame 跑一段缓动，间隔从 60ms 逐渐拉到 220ms，
 *   所以是真的减速，不是固定频率跳 18 次。
 *   [data-motion='off'] 下不滚，直接出结果。
 *
 * 【为什么避开最近 3 部】
 *   174 条里抽到重复的概率不高，但真抽到同一个会让人觉得"没生效"。
 *   避开最近 3 部，成本几乎为零，体感好很多。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ArrowRight, Dices } from '@lucide/vue'
import { loadAnimeList, coverUrl, pickRandom, type AnimeEntry } from '@/composables/useAnimeList'
import { motionEnabled } from '@/composables/useSettings'

const list = ref<AnimeEntry[]>([])
const result = ref<AnimeEntry | null>(null)
const rolling = ref(false)
const shown = ref('')
const error = ref(false)
/** 清单正在加载 */
const loading = ref(true)

/** 最近抽到过的，避免连续重复 */
const recent: string[] = []

const canDraw = computed(() => list.value.length > 0 && !rolling.value)

async function ensureList(): Promise<AnimeEntry[]> {
  if (list.value.length) return list.value
  try {
    list.value = await loadAnimeList()
    error.value = false
  } catch {
    error.value = true
  }
  return list.value
}

/*
 * 挂载时就把清单拉下来。
 * 挂在首页附录里的组件，滚到这里时用户已经在看这一块了；
 * 等按下按钮才发请求，会有一段"按了没反应"的空窗。
 * loadAnimeList 有模块级缓存，和猜番共用同一个请求，不会下载两遍。
 */
onMounted(async () => {
  await ensureList()
  loading.value = false
})

/** 抽一部，尽量避开 recent 里的 */
function choose(pool: AnimeEntry[]): AnimeEntry | undefined {
  const fresh = pool.filter((x) => !recent.includes(x.name))
  return pickRandom(fresh.length ? fresh : pool)
}

async function draw() {
  if (rolling.value) return
  const pool = await ensureList()
  if (!pool.length) return

  const target = choose(pool)
  if (!target) return

  recent.push(target.name)
  if (recent.length > 3) recent.shift()

  if (!motionEnabled.value) {
    result.value = target
    shown.value = target.name
    return
  }

  rolling.value = true
  const started = performance.now()
  const duration = 1200

  const step = () => {
    const t = Math.min(1, (performance.now() - started) / duration)
    // ease-out：一开始飞快，最后慢慢停住
    const eased = 1 - Math.pow(1 - t, 2.4)

    if (t < 1) {
      shown.value = pickRandom(pool)?.name ?? ''
      // 间隔从 55ms 拉到 230ms
      window.setTimeout(step, 55 + eased * 175)
      return
    }

    shown.value = target.name
    result.value = target
    rolling.value = false
  }

  step()
}

onUnmounted(() => {
  rolling.value = false
})

/** 状态标签在卡片上的颜色倾向：看过的给强调色，没看的给灰 */
const statusTone = computed(() => {
  const s = result.value?.status ?? ''
  return /未看|未看完|云|忘了/.test(s) ? 'muted' : 'accent'
})
</script>

<template>
  <div class="gacha">
    <header class="gacha-head">
      <p class="gacha-kicker">random pick</p>
      <h3 class="gacha-title">今天看什么</h3>
      <p class="gacha-sub">
        {{
          loading
            ? '正在翻评分表……'
            : list.length
              ? `从 ${list.length} 部打过分的里随手抽一部`
              : '清单没加载出来'
        }}
      </p>
    </header>

    <!-- 抽签台：名字在滚，封面在底下淡出 -->
    <div class="gacha-slot" :class="{ 'is-rolling': rolling, 'has-result': result && !rolling }">
      <Transition name="fade" mode="out-in">
        <div v-if="result && !rolling" :key="result.name" class="slot-result">
          <div class="slot-cover">
            <img
              :src="coverUrl(result)"
              :alt="`${result.name} 封面`"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div class="slot-info">
            <p class="slot-name">{{ result.name }}</p>
            <p class="slot-meta">
              <span class="slot-score">{{ result.taste }}</span>
              <span class="slot-year">{{ result.year }}</span>
              <span class="slot-status" :class="`tone-${statusTone}`">{{ result.status }}</span>
            </p>
          </div>
        </div>

        <div v-else :key="rolling ? 'roll' : 'idle'" class="slot-idle">
          <p class="slot-name slot-name--roll">
            {{ rolling ? shown : loading ? '稍等一下……' : '按一下，交给运气' }}
          </p>
        </div>
      </Transition>
    </div>

    <div class="gacha-actions">
      <button type="button" class="gacha-btn" :disabled="!canDraw" @click="draw">
        <Dices :size="16" :stroke-width="1.9" aria-hidden="true" />
        {{ result ? '再抽一部' : '抽一部' }}
      </button>
      <RouterLink to="/tools" class="gacha-link">
        看完整清单
        <ArrowRight :size="13" :stroke-width="2" aria-hidden="true" />
      </RouterLink>
    </div>

    <p v-if="error" class="gacha-error">
      清单没加载出来。刷新一下，或者
      <RouterLink to="/tools">直接去工具页看</RouterLink>
      。
    </p>
  </div>
</template>

<style scoped>
.gacha {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  /* 附录里一页很宽，卡片收在中间，不然抽签台会拉成一条 */
  max-width: 720px;
  margin-inline: auto;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: var(--r-card);
  background: var(--surface);
}

.gacha-kicker {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.gacha-title {
  margin-top: 2px;
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1.3;
}

.gacha-sub {
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--ink-soft);
}

/* ── 抽签台 ─────────────────────────────────────────────── */
.gacha-slot {
  flex: 1;
  min-height: 132px;
  display: grid;
  align-items: center;
  padding: 12px;
  border-radius: var(--r-input);
  background: var(--bg-soft);
  overflow: hidden;
}

.slot-idle {
  display: grid;
  place-items: center;
  text-align: center;
}

.slot-name {
  font-family: var(--font-quote);
  font-size: 15px;
  line-height: 1.5;
  color: var(--ink);
}

.slot-name--roll {
  font-family: var(--font-mono);
  font-size: 14px;
  letter-spacing: 0.02em;
  color: var(--ink-soft);
}

.is-rolling .slot-name--roll {
  color: var(--accent);
}

/* 结果：封面左、信息右，整体居中 */
.slot-result {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.slot-cover {
  flex: 0 0 auto;
  width: 76px;
  aspect-ratio: 5 / 7;
  overflow: hidden;
  border-radius: 8px;
  background: var(--bg-soft);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--ink) 14%, transparent);
}

.slot-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.slot-info {
  min-width: 0;
  /* 名字最多两行，宽屏上别让它把卡片撑成一条 */
  max-width: 16em;
}

.slot-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.slot-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 7px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-soft);
}

.slot-score {
  font-size: 15px;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.slot-year {
  font-variant-numeric: tabular-nums;
}

.slot-status {
  padding: 1px 7px;
  border-radius: var(--r-pill);
  font-size: 10.5px;
}

.slot-status.tone-accent {
  background: var(--accent-soft);
  color: var(--accent);
}

.slot-status.tone-muted {
  background: color-mix(in srgb, var(--ink-soft) 14%, transparent);
  color: var(--ink-soft);
}

/* ── 按钮 ───────────────────────────────────────────────── */
.gacha-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.gacha-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: 0 18px;
  border-radius: var(--r-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 13px;
  transition:
    transform var(--t-fast) var(--ease-out),
    opacity var(--t-fast) var(--ease-out);
}

.gacha-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.gacha-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.gacha-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--ink-soft);
  transition: color var(--t-fast) var(--ease-out);
}

.gacha-link:hover {
  color: var(--accent);
}

.gacha-error {
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--ink-soft);
}

.gacha-error a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ── 结果淡入 ───────────────────────────────────────────── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 180ms var(--ease-out);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .gacha-btn:hover:not(:disabled) {
    transform: none;
  }

  .fade-enter-active,
  .fade-leave-active {
    transition: none;
  }
}

[data-motion='off'] .gacha-btn:hover:not(:disabled) {
  transform: none;
}

[data-motion='off'] .fade-enter-active,
[data-motion='off'] .fade-leave-active {
  transition: none;
}
</style>
