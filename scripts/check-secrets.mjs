/**
 * 密钥扫描 —— 在提交前和 CI 里自动检查，防止把私钥 / token 推到 GitHub。
 *
 * 【为什么需要它】
 *   仓库一旦公开，推上去的密钥就等于泄露了。GitHub 会扫到、机器人会抓走，
 *   而且 git 历史里删掉文件也没用——历史照样能翻出来。
 *   所以最可靠的做法是：不让它进提交。
 *
 * 【它在哪运行】
 *   1. 本地：git commit 时由 .githooks/pre-commit 调用，命中就拒绝提交
 *   2. CI：npm run check 里也会跑一遍，双保险
 *
 * 【误报了怎么办】
 *   确认那串东西真的不是密钥（比如是文档里的示例），
 *   把文件名加到下面的 ALLOW_FILES 里，或者在该行末尾加注释 // secret-scan-ignore
 *
 * 这个脚本本身不联网、不上传任何东西，只在本机读文件。
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, relative, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 不扫描的目录 —— 依赖和构建产物里全是别人写的代码，扫了没意义还慢 */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-ssg',
  'raw',
  'tmp',
  '.tmp',
  '.vite',
  '__pycache__',
  'pagefind',
  '.zcode',
])

/** 只扫这些后缀（其余二进制文件读了也是乱码） */
const TEXT_EXT = new Set([
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.vue',
  '.css',
  '.scss',
  '.html',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.txt',
  '.toml',
  '.ini',
  '.cfg',
  '.conf',
  '.py',
  '.sh',
  '.bash',
  '.ps1',
  '.xml',
  '.svg',
  '.env',
])

/** 文件名为这些的，一律不许进仓库 */
const DANGEROUS_NAMES = [
  /^\.env$/,
  /^\.env\.(?!example$).+/, // .env.local / .env.production —— 但 .env.example 放行
  /\.pem$/,
  /\.key$/,
  /\.p12$/,
  /\.pfx$/,
  /\.jks$/,
  /^id_rsa$/,
  /^id_ed25519$/,
  /^id_ecdsa$/,
  /^\.npmrc$/,
  /^\.netrc$/,
  /^credentials\.json$/,
  /^service[-_]account.*\.json$/,
]

/**
 * 密钥特征。
 * 每一组都是真实服务给密钥用的固定前缀或格式——正常文章内容不会碰上。
 */
const PATTERNS = [
  // 各类私钥文件头
  {
    name: '私钥文件（PEM）',
    re: /-----BEGIN (?:RSA |ENCRYPTED |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/,
  },
  // GitHub
  { name: 'GitHub Token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: 'GitHub 细粒度 Token', re: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/ },
  // 云服务
  { name: 'AWS Access Key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'AWS 临时凭证', re: /\bASIA[0-9A-Z]{16}\b/ },
  { name: 'Google API Key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: '阿里云 AccessKey', re: /\bLTAI[0-9A-Za-z]{12,}\b/ },
  { name: '腾讯云 SecretId', re: /\bAKID[0-9A-Za-z]{13,}\b/ },
  // 支付 / 消息
  { name: 'Stripe 密钥', re: /\bsk_live_[0-9A-Za-z]{20,}\b/ },
  { name: 'Slack Token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { name: 'SendGrid Key', re: /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/ },
  // AI 服务
  { name: 'OpenAI Key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/ },
  { name: 'Anthropic Key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  // npm
  { name: 'npm Token', re: /\bnpm_[A-Za-z0-9]{36}\b/ },
  // 通用写法：password = "..."，但排除明显的空值 / 占位符
  {
    name: '疑似写死的密码或密钥',
    re: /(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key)\s*[:=]\s*['"`]([^'"`\s]{12,})['"`]/i,
    // 值里出现这些词就当作占位符，不算泄露
    skipIfValueMatches:
      /^(your|xxx|placeholder|example|test|dummy|sample|change[-_]?me|todo|none|null|\*+)/i,
  },
  // JWT（以 eyJ 开头的三段式）
  { name: 'JWT Token', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  // 数据库连接串里带密码
  {
    name: '带密码的连接串',
    re: /\b(?:mongodb|postgres|postgresql|mysql|redis|amqp):\/\/[^\s:@/]+:[^\s:@/]{6,}@/i,
  },
]

/** 明确放行的文件（相对仓库根目录） */
const ALLOW_FILES = new Set([
  'scripts/check-secrets.mjs', // 就是本文件，里面全是规则字符串
  'docs/EDITING.md', // 教程里会出现 "password = ..." 这类示例
])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name.startsWith('.') &&
      entry.name !== '.env.example' &&
      entry.name !== '.gitignore'
    ) {
      // 隐藏目录/文件大多不需要扫，但 .env.example 值得看一眼
      if (entry.isDirectory()) continue
    }
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(full, out)
    } else {
      out.push(full)
    }
  }
  return out
}

/** 优先只看 git 会提交的文件；不是 git 仓库时退回全目录扫描 */
function listFiles() {
  try {
    const out = execSync('git ls-files -z --cached --others --exclude-standard', {
      cwd: ROOT,
      encoding: 'buffer',
      maxBuffer: 32 * 1024 * 1024,
    })
    return out
      .toString('utf8')
      .split('\0')
      .filter(Boolean)
      .map((p) => join(ROOT, p))
      .filter((p) => existsSync(p) && statSync(p).isFile())
  } catch {
    return walk(ROOT)
  }
}

const findings = []
const files = listFiles()

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/')
  const name = basename(file)

  // 1. 危险文件名：直接判死
  if (DANGEROUS_NAMES.some((re) => re.test(name))) {
    findings.push({ file: rel, line: 0, kind: '不该提交的文件', detail: name })
    continue
  }

  if (ALLOW_FILES.has(rel)) continue

  const ext = extname(file).toLowerCase()
  if (!TEXT_EXT.has(ext) && name !== '.env.example') continue

  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue
  }

  // 明显是二进制的跳过
  if (text.includes('\0')) continue

  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('secret-scan-ignore')) continue
    // 单行太长的不看（压缩后的文件）
    if (line.length > 4000) continue

    for (const { name: kind, re, skipIfValueMatches } of PATTERNS) {
      const m = re.exec(line)
      if (!m) continue
      if (skipIfValueMatches && m[1] && skipIfValueMatches.test(m[1])) continue

      // 输出里不要把密钥原样打全——日志也会被别人看到
      const hit = m[1] ?? m[0]
      const masked = hit.length > 8 ? `${hit.slice(0, 4)}…${hit.slice(-2)}` : '***'
      findings.push({ file: rel, line: i + 1, kind, detail: masked })
      break // 一行报一次就够了
    }
  }
}

if (findings.length === 0) {
  console.log(`[密钥扫描] 通过，检查了 ${files.length} 个文件。`)
  process.exit(0)
}

console.error('')
console.error('✖ 密钥扫描没通过 —— 下面这些东西不该进仓库：')
console.error('')
for (const f of findings) {
  const where = f.line ? `${f.file}:${f.line}` : f.file
  console.error(`  ${where}`)
  console.error(`    ${f.kind}：${f.detail}`)
}
console.error('')
console.error('处理办法：')
console.error('  1. 如果是真的密钥：从代码里删掉，改从环境变量读；已经提交过的还要换一把新密钥。')
console.error('  2. 如果是误报：在那一行末尾加 // secret-scan-ignore，或把文件名加进 ALLOW_FILES。')
console.error(
  '  3. 如果只是本地文件（.env、私钥）：确认它在 .gitignore 里，然后 git rm --cached 掉。',
)
console.error('')
process.exit(1)
