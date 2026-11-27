/**
 * 小说构建入口 —— 把"解书"和"转图"两步串起来。
 *
 * 【为什么需要这个入口】
 *   package.json 里的一条 npm script 只是一条命令行。
 *   原来 novel = 解书 && 转图，`npm run novel -- xxx.txt` 传的参数
 *   会被 npm 挂到整条链的末尾——落在了"转图"上，而不是"解书"上。
 *   所以拆出这个入口：它自己接参数、自己按顺序调两步。
 *
 * 【用法】
 *   npm run novel                       ← 构建默认那本 EPUB
 *   npm run novel -- 我的书.epub        ← 构建自己的 EPUB
 *   npm run novel -- 我的书.txt         ← 构建自己的 TXT
 *   npm run novel -- a.epub b.txt --slug=xxx
 *
 * 【什么时候转图】
 *   只有这次构建里有 EPUB（或没传文件、走默认清单）时才转——
 *   TXT 没有插图，转图步骤对它无事可做，跳过省几秒。
 */
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const files = args.filter((a) => !a.startsWith('--'))
const hasEpub = files.length === 0 || files.some((f) => !f.toLowerCase().endsWith('.txt'))

function run(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run('node', ['scripts/build-novel.mjs', ...args])

if (hasEpub) {
  run('node', ['scripts/run-py.mjs', 'scripts/optimize-novel-images.py'])
} else {
  console.log('[小说] 这次只有 TXT，没有插图要转。')
}
