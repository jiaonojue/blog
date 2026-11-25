/**
 * 素材检索小工具（开发时用，不参与构建）
 *
 * 用法：
 *   node scripts/find-art.mjs "tag1 tag2" [数量]
 *
 * 例：
 *   node scripts/find-art.mjs "frieren landscape" 8
 *
 * 只返回 safe / general 级别的图，按尺寸从大到小排。
 * 找到合适的就把 file_url 抄下来，用 curl 下载到 raw/。
 *
 * 说明：这里用 curl 而不是 fetch —— safebooru 前面的防护会拦 Node 的请求头。
 */
import { execFileSync } from 'node:child_process'

const [, , rawTags = 'landscape scenery', rawLimit = '10'] = process.argv

const tags = rawTags.split(/\s+/).filter(Boolean).join('+')
const limit = Number(rawLimit)

const url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=100&tags=${tags}`

let text
try {
  text = execFileSync(
    'curl',
    [
      '-s',
      '-m',
      '30',
      '-A',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
      url,
    ],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
} catch (err) {
  console.error('curl 失败：', err.message)
  process.exit(1)
}

let list
try {
  list = JSON.parse(text)
} catch {
  console.error('返回不是 JSON：', text.slice(0, 200))
  process.exit(1)
}

const ok = list
  .filter((p) => p.rating === 'safe' || p.rating === 'general')
  .filter((p) => p.width >= 800 && p.height >= 600)
  .sort((a, b) => b.width * b.height - a.width * a.height)
  .slice(0, limit)

console.log(`[${rawTags}] 共 ${list.length} 条，筛出 ${ok.length} 条：\n`)
for (const p of ok) {
  console.log(`${p.id}\t${p.width}x${p.height}\t${p.rating}`)
  console.log(`  ${p.file_url}`)
  console.log(`  tags: ${p.tags.slice(0, 130)}`)
  console.log()
}
