/**
 * 便条板 —— 手机写一条，电脑上复制走。
 *
 * 【它解决的是什么】
 *   在手机上看到一段想抄的话、一张想存的图，要弄到电脑上，
 *   通常得发微信给自己、或者存相册再传网盘。
 *   这个板子就干一件事：让三个格子里临时躺着三条东西，
 *   电脑上打开网站就能复制。
 *
 * 【为什么没有条数上限】
 *   一开始只给三个格子，是想提醒"这是中转，不是存档"。
 *   真用起来三条明显不够——贴第三条就顶掉最旧的，等于丢东西。
 *   现在板上能躺多少躺多少，格子按行往下排；
 *   "不是存档"这件事交给 ntfy 自己的缓存期来提醒：
 *   旧消息过一阵就过期，想留的东西要自己复制走。
 *
 * 【为什么用 ntfy】
 *   纯静态站没有后端。要跨设备，就必须有一个公共中转。
 *   ntfy.sh 是个开源的推送服务，不需要注册、不需要 API key，
 *   发一条就是往一个"主题"里 POST 一段文本，读就是订阅那个主题。
 *   它有 CORS，浏览器可以直接调；也支持上传附件，图片能过。
 *   代价是：它的主题是公开的——谁知道主题名谁就能读。
 *   所以主题名不是随便起的，而是从密钥派生的（见 topicOf）。
 *
 * 【密钥是什么】
 *   就是"房间号"。同一个密钥 = 同一个板子。
 *   它不出现在仓库里，只存在你自己的浏览器 localStorage 里，
 *   手机上第一次用的时候手输一次（或扫同一个二维码）。
 *   别人不知道你的密钥，就找不到你的主题，也就读不到你的便条。
 *
 * 【三条是怎么数出来的】
 *   ntfy 会保留一段时间的历史消息。我们拉取时只取最近的若干条，
 *   免得一个用了很久的主题一次拉回几百条。
 *   贴新的不再删旧的——要清哪张，自己点「撕掉」。
 */
import { site } from '@/data/site.config'

/** 一张便条 */
export interface Note {
  /** ntfy 的消息 id，删除时要用 */
  id: string
  /** 发出时间（秒） */
  time: number
  /** 文字内容，可能为空（只发图时） */
  text: string
  /** 附件的直链，没有就是 null */
  image: string | null
  /** 附件的原始文件名 */
  imageName: string | null
}

/**
 * 一次最多取多少条。
 *
 * 不是"最多能贴几条"——贴多少都行，板子上都留着。
 * 这是单次拉取的上限：一个用了半年的主题可能攒了几百条，
 * 一次全拉回来既慢又没必要。50 条够翻很久了。
 */
export const FETCH_LIMIT = 50

/** 密钥存在这里。和站点其他设置分开，清缓存不会顺手清掉它 */
const KEY_STORAGE = 'site:notes:key'

/**
 * 中转服务器。
 *
 * 【为什么要可以换】
 *   默认是 ntfy.sh 的公共实例。但"跨设备互传"走的是公网中转——
 *   有的网络环境到 ntfy.sh 不通（被墙、超时），这时板子看起来就是"坏了"。
 *   换一台能连通的 ntfy 实例（公共镜像或自建），其它什么都不用变：
 *   密钥、主题名、消息格式全部一样。
 *
 *   服务器地址只存在本机 localStorage 里，不进仓库、不上传。
 */
const SERVER_STORAGE = 'site:notes:server'
const DEFAULT_SERVER = 'https://ntfy.sh'

/** 读本机设置的中转服务器（没设置过就是默认的） */
export function readServer(): string {
  try {
    const raw = localStorage.getItem(SERVER_STORAGE) ?? ''
    // 只认 https:// 开头的地址，防呆
    return /^https:\/\/[\w.-]+(\/[\w/-]*)?$/.test(raw) ? raw.replace(/\/$/, '') : DEFAULT_SERVER
  } catch {
    return DEFAULT_SERVER
  }
}

/** 记住中转服务器。空字符串 = 回到默认 */
export function saveServer(url: string): void {
  try {
    const clean = url.trim().replace(/\/$/, '')
    if (clean) localStorage.setItem(SERVER_STORAGE, clean)
    else localStorage.removeItem(SERVER_STORAGE)
  } catch {
    /* 隐私模式下写不进去，本轮仍然能用 */
  }
}

/** 当前用的中转服务器 */
export function currentServer(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_SERVER
  return readServer()
}

/**
 * 把密钥变成一个主题名。
 *
 * 【为什么不是直接用密钥当主题】
 *   ntfy 的主题名会出现在请求 URL 和它自己的日志里。
 *   直接拿密钥当主题，等于把"房间号"写在信封外面。
 *   这里做一次不可逆的摘要，主题名和密钥之间就没有直接对应关系了。
 *
 * 【为什么用 SHA-256 而不是自造的哈希】
 *   自造的哈希（比如把字符码加起来）很容易碰撞，
 *   两个不同的密钥可能落到同一个主题上。
 *   Web Crypto 的 SHA-256 是浏览器自带的，不用引第三方库。
 */
export async function topicOf(key: string): Promise<string> {
  const trimmed = key.trim().toLowerCase()
  if (!trimmed) throw new Error('empty key')
  const bytes = new TextEncoder().encode(`moyu-notes:${trimmed}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  // ntfy 主题名只能用 [A-Za-z0-9_-]，取前 40 位十六进制刚好够唯一
  return `moyu${hex.slice(0, 40)}`
}

/** 读本机存着的密钥 */
export function readKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

/** 记住密钥（空字符串 = 忘掉它） */
export function saveKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    /* 隐私模式下写不进去，本轮仍然能用 */
  }
}

/** ntfy 的一条原始消息，只取用得到的字段 */
interface RawMessage {
  id?: string
  time?: number
  event?: string
  message?: string
  attachment?: { url?: string; name?: string }
  /** 删除事件里指向"被删的那条"，见 fetchNotes 的墓碑说明 */
  sequence_id?: string
}

function toNote(raw: RawMessage): Note | null {
  if (!raw.id || raw.event === 'open' || raw.event === 'keepalive') return null
  const text = (raw.message ?? '').trim()
  const image = raw.attachment?.url ?? null
  // 既没字也没图（比如 ntfy 自己发的系统消息）就不算一张便条
  if (!text && !image) return null
  return {
    id: raw.id,
    time: raw.time ?? Math.floor(Date.now() / 1000),
    text,
    image,
    imageName: raw.attachment?.name ?? null,
  }
}

/**
 * 拉最近的便条。
 *
 * 【为什么用 ?poll=1 而不是 WebSocket】
 *   订阅（/sse 或 /ws）会一直挂着一条连接，首页只是"打开看一眼"，
 *   挂长连接不值得。poll=1 是一次性请求，拿完就断，
 *   配合组件自己的定时刷新就够了。
 *
 * 【为什么带 since=all】
 *   ntfy 默认只返回"从现在开始"的新消息。
 *   我们要的是"板子上现有的"，所以明确要全部历史，
 *   再自己截到 FETCH_LIMIT 条。
 *
 * 【为什么要先收集墓碑】
 *   ntfy 的删除不真删。DELETE 之后原消息还在历史里，
 *   只多出一条 event: 'message_delete' 的事件，
 *   它的 sequence_id 指向被删的那条。
 *   不先把这些 id 收集起来剔除，撕掉的便条下次刷新又会回来——
 *   用户看到的"删一个长一个"就是这么来的。
 */
export async function fetchNotes(topic: string): Promise<Note[]> {
  const res = await fetch(`${currentServer()}/${topic}/json?poll=1&since=all`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const body = await res.text()
  const rows: RawMessage[] = []
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      rows.push(JSON.parse(trimmed) as RawMessage)
    } catch {
      /* 单行坏了不影响其它行 */
    }
  }

  // 第一遍：记下所有墓碑指向的 id
  const dead = new Set<string>()
  for (const row of rows) {
    if (row.event === 'message_delete' && row.sequence_id) dead.add(row.sequence_id)
  }

  // 第二遍：墓碑本身、以及被墓碑点名的消息都不算便条
  const notes: Note[] = []
  for (const row of rows) {
    /*
     * 注意：ntfy 给普通消息也带 event: 'message'。
     * 所以这里不能写成"有 event 就跳过"，只能跳过
     * message_delete / open / keepalive 这些非便条事件。
     */
    if (row.event && row.event !== 'message') continue
    if (row.id && dead.has(row.id)) continue
    const note = toNote(row)
    if (note) notes.push(note)
  }

  // 新的在前
  notes.sort((a, b) => b.time - a.time)
  return notes.slice(0, FETCH_LIMIT)
}

/** 发一条文字。返回新消息的 id */
export async function postNote(topic: string, text: string): Promise<string> {
  const res = await fetch(`${currentServer()}/${topic}`, {
    method: 'POST',
    body: text,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as RawMessage
  return data.id ?? ''
}

/**
 * 发一张图。
 *
 * 【为什么图片要单独一个函数】
 *   ntfy 的附件是"把文件放进请求体，文件名放在头里"，
 *   不是 multipart。所以 Content-Type 要设成文件本身的类型。
 *
 * 【为什么文件名和说明走 query，不走请求头】
 *   ntfy 认 Filename / X-Message 两个头，但浏览器的请求头只能是
 *   ISO-8859-1（Latin-1）。中文文件名或中文说明放进去会直接抛
 *   "String contains non ISO-8859-1 code point"——发图失败。
 *   改成 query 参数（URLSearchParams 自动百分号编码）就没有这个限制，
 *   ntfy 一样认，中文文件名和中文说明都能过。
 *
 * 【大小上限】
 *   ntfy.sh 免费实例允许 15MB。手机上随手拍的照片常常超过，
 *   所以调用方要先把图压到合理尺寸再传（见 shrinkImage）。
 */
export async function postImage(
  topic: string,
  file: Blob,
  filename: string,
  caption = '',
): Promise<string> {
  const qs = new URLSearchParams()
  qs.set('filename', filename)
  if (caption) qs.set('message', caption)

  const res = await fetch(`${currentServer()}/${topic}?${qs.toString()}`, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as RawMessage
  return data.id ?? ''
}

/** 删掉一条 */
export async function deleteNote(topic: string, id: string): Promise<boolean> {
  /*
   * ntfy 的 DELETE 是留墓碑，不是真删：原消息还在历史里，
   * 只多出一条 message_delete 事件（实测立刻出现）。
   * 所以"删干净"靠的是 fetchNotes 过滤墓碑 + 调用方本地剔除，
   * 不是靠这个请求成功。
   *
   * 返回值只是"请求有没有被接受"：true 表示服务端认了这次删除。
   */
  try {
    const res = await fetch(`${currentServer()}/${topic}/${id}`, { method: 'DELETE' })
    return res.ok
  } catch {
    return false
  }
}

/**
 * 把手机拍的大图压到能传的尺寸。
 *
 * 【为什么在浏览器里压】
 *   手机照片动辄 4～8MB，直接传要么超限，要么让对面等半天。
 *   这里用 canvas 缩到最长边 1600、JPEG 0.82，
 *   通常能压到 300KB 上下，在手机上看起来仍然清楚。
 *   顺便把 EXIF 里的定位信息一起丢掉了——canvas 重绘不留元数据，
 *   这对"发到公共中转站"这件事来说是必要的。
 */
export async function shrinkImage(file: File, maxSide = 1600): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  // GIF 会动，重绘就变成一张静图了，原样传
  if (file.type === 'image/gif') return file

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82),
  )
  return blob ?? file
}

/** 这条便条是多久以前发的，用中文短说法 */
export function ago(time: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - time)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  return `${Math.floor(diff / 86400)} 天前`
}

/** 附件直链要补上站点 base 吗？不用——它在 ntfy 的域上，是绝对地址 */
export function noteImageUrl(note: Note): string {
  return note.image ?? ''
}

/** 复制一段文字到剪贴板，失败时退回到老办法 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

/** 站点根地址，分享给手机时用 */
export function shareUrl(): string {
  if (typeof location === 'undefined') return site.base
  return `${location.origin}${site.base}#notes`
}
