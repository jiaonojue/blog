/**
 * 调用 Python 的小包装。
 *
 * 【为什么需要这个文件】
 *   Windows 上 `python` 这个名字经常被"应用商店占位程序"占着，
 *   直接写 python 会弹出微软商店，什么也不干。
 *   真正能用的是 `py`（Python Launcher）。
 *   macOS / Linux 上没有 py，用的是 python3。
 *
 *   这个脚本会依次试 py → python3 → python，谁先跑通就用谁。
 *
 * 【用法】（在 npm scripts 里）
 *   node scripts/run-py.mjs scripts/subset-font.py
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)

if (!args.length) {
  console.error('[python] 没有指定要运行的脚本')
  console.error('  例：node scripts/run-py.mjs scripts/subset-font.py')
  process.exit(1)
}

const candidates =
  process.platform === 'win32' ? ['py', 'python3', 'python'] : ['python3', 'python']

let lastError = null

for (const exe of candidates) {
  // 先测一下这个解释器能不能跑
  const probe = spawnSync(exe, ['-c', 'print(1)'], { encoding: 'utf8' })
  if (probe.status !== 0 || probe.stdout.trim() !== '1') {
    lastError = probe.error ?? new Error(`${exe} 不可用`)
    continue
  }

  // 真正运行目标脚本，工作目录固定为项目根，路径也转成绝对路径
  const result = spawnSync(exe, [resolve(ROOT, args[0]), ...args.slice(1)], {
    stdio: 'inherit',
    cwd: ROOT,
  })
  process.exit(result.status ?? 1)
}

console.error('[python] 没找到可用的 Python 解释器。')
console.error('  Windows 请确认装了 Python 并支持 py 命令。')
console.error('  macOS / Linux 请确认 python3 在 PATH 里。')
if (lastError) console.error('  最后一次尝试：', lastError.message)
process.exit(1)
