<script setup lang="ts">
/** 返回按钮 —— 优先回到上一页，没有历史就回文章列表 */
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'

const router = useRouter()

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/posts')
}
</script>

<template>
  <button class="back-btn no-print" type="button" @click="goBack">
    <ArrowLeft :size="15" :stroke-width="2" aria-hidden="true" />
    返回
  </button>
</template>

<style scoped>
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 13px 0 11px;
  border-radius: var(--r-pill);
  border: 1px solid var(--line);
  font-size: 13px;
  color: var(--ink-soft);
  transition:
    border-color var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out);
}

.back-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
