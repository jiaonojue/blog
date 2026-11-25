<script setup lang="ts">
/**
 * 既読印 —— 一个小小的朱色圆章，盖在已经读完的文章上。
 *
 * 【为什么是圆的】
 *   日本同人志和漫画单行本的「既読」标记、以及各种"完"字章，几乎都是圆章。
 *   方形会显得像系统标签，圆形才像真的盖上去的。
 *
 * 【它不会一闪一闪】
 *   印章是一次性的、静态的。它不应该有动画、不应该抢注意力，
 *   最好让访客过一会儿才注意到"哦，这篇我读过了"。
 */
defineProps<{
  /** 章里的字，默认「既読」 */
  text?: string
  /** 小一号的版本，用在卡片角上 */
  small?: boolean
}>()
</script>

<template>
  <span class="read-stamp" :class="{ 'is-small': small }" aria-hidden="true">
    <span class="stamp-text">{{ text ?? '既読' }}</span>
  </span>
</template>

<style scoped>
.read-stamp {
  display: inline-grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  /* 双圈：外圈细、内圈更细，像真的印章边 */
  border: 1.5px solid var(--stamp-ink);
  border-radius: 50%;
  box-shadow:
    inset 0 0 0 2.5px var(--surface),
    inset 0 0 0 3.5px var(--stamp-ink);
  color: var(--stamp-ink);
  /* 印泥不会盖得完美平行——微微歪一点才像手工盖的 */
  transform: rotate(-11deg);
  /* 印在纸上会有一点点透，不是纯色块 */
  opacity: 0.82;
  user-select: none;
  /* 略微不规则的边缘：用两枚柔和的阴影模拟墨迹渗开 */
  filter: drop-shadow(0 0 0.4px var(--stamp-ink));
}

.stamp-text {
  font-family: var(--font-quote);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.02em;
  /* 两个字上下排，更像印章 */
  writing-mode: vertical-rl;
  text-orientation: upright;
}

.read-stamp.is-small {
  width: 32px;
  height: 32px;
  border-width: 1.2px;
  box-shadow:
    inset 0 0 0 2px var(--surface),
    inset 0 0 0 2.8px var(--stamp-ink);
  transform: rotate(-11deg);
}

.read-stamp.is-small .stamp-text {
  font-size: 8px;
}

/* 减少动效与打印时都不需要特殊处理：它本来就是静态的。
 * 但打印时去掉阴影，省墨也更清楚。 */
@media print {
  .read-stamp {
    filter: none;
    opacity: 1;
  }
}
</style>
