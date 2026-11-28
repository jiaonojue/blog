#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字体子集化 —— 把中文字体里"这个站根本用不到的字"删掉。

【为什么需要】
  一个完整的中文字体有 6000～30000 个字形，几 MB 到十几 MB。
  但你的站一共可能只用得到一千多个不同的字。
  把用不到的删掉，字体文件能小到一百多 KB，首屏快很多。

【它做什么】
  1. 扫描 content/ 和 src/ 里所有文本，收集实际出现的每一个字符
  2. 补上 ASCII、数字、中英文标点（防止漏字变方块）
  3. 用 fonttools 的 pyftsubset 裁掉其余字形
  4. 输出到 public/fonts/

【什么时候跑】
  手动跑：npm run fonts
  dev / build **不会**自动跑它 —— 这是有意的：
  字体只在你改了文案、加了新字之后才需要重新裁一次，
  每次启动都扫一遍全项目、再调 fonttools 会白白多等十几秒。

【加了新文章 / 改了 UI 文案之后】
  如果出现了以前没写过的字，那个字会显示成"后备字体"的样子
  （通常是系统默认黑体），和标题的手写体不一致。
  跑一次 npm run fonts 就好。

【注意】
  这个脚本需要 Python 的 fonttools 和 brotli：
    py -m pip install fonttools brotli
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# 输出到 src/assets/ 而不是 public/：
#   放在 src 里，Vite 会给文件名加哈希（改了字体就不会读到旧的缓存），
#   而且会自动把 /blog/ 这个子路径前缀拼好。
OUT = ROOT / "src" / "assets" / "fonts"

# ── 字体清单 ─────────────────────────────────────────────────────────
# (源文件, 输出文件名, 体积上限 KB)
FONTS = [
    (
        ROOT / "node_modules/@fontsource/zcool-kuaile/files/zcool-kuaile-chinese-simplified-400-normal.woff2",
        "zcool-kuaile-subset.woff2",
        170,  # 站酷快乐体：标题用，字号大但字数少。0.3.1 加了猜番一轮的 UI 字，涨到 154
    ),
    (
        ROOT / "node_modules/@fontsource/lxgw-wenkai/files/lxgw-wenkai-latin-500-normal.woff2",
        "lxgw-wenkai-subset.woff2",
        340,  # 霞鹜文楷：引文用。它的字形比站酷多，压不到更小
    ),
    (
        ROOT / "node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2",
        "space-grotesk-subset.woff2",
        40,  # 拉丁字体本来就小
    ),
]

# ── 必须保留的字符 ───────────────────────────────────────────────────
BASE_CHARS = set()

# ASCII 可打印字符（代码块里的英文、数字、符号全靠它）
for code in range(0x20, 0x7F):
    BASE_CHARS.add(chr(code))

# 常用中文标点与全角符号
BASE_CHARS.update(
    "　、。〃々〈〉《》「」『』【】〔〕〖〗！＂＃＄％＆＇（）＊＋，－．／"
    "０１２３４５６７８９：；＜＝＞？＠［＼］＾＿｀｛｜｝～"
    "·—…‰′″€¥£°±×÷≈≠≤≥∞√∑√"
)

# 中文排版里会用到、但可能只在 CSS 里出现的符号
BASE_CHARS.update("✦✧★☆♪◇◆○●□■△▲▽▼→←↑↓✓✕")

# 扫描范围
SCAN_DIRS = ["content", "src", "index.html"]
SCAN_SUFFIXES = {
    ".md",
    ".vue",
    ".ts",
    ".js",
    ".mjs",
    ".css",
    ".html",
    ".json",
}
# 这些目录里的文件是自动生成的，字都是别处来的，扫了等于重复
SKIP_DIRS = {"generated", "node_modules"}


def collect_chars() -> set[str]:
    """扫描项目文件，收集所有出现过的字符。"""
    chars: set[str] = set(BASE_CHARS)
    file_count = 0

    for target in SCAN_DIRS:
        path = ROOT / target
        if not path.exists():
            continue

        if path.is_file():
            files = [path]
        else:
            files = []
            for dirpath, dirnames, filenames in os.walk(path):
                dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
                for name in filenames:
                    if Path(name).suffix in SCAN_SUFFIXES:
                        files.append(Path(dirpath) / name)

        for f in files:
            try:
                text = f.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            chars.update(text)
            file_count += 1

    # 去掉控制字符（换行、制表符之类不需要字形）
    chars = {c for c in chars if c.isprintable() or c == " "}
    print(f"[字体] 扫描了 {file_count} 个文件，共 {len(chars)} 个不同字符")
    return chars


def ensure_fonttools() -> str:
    """确认 fonttools 装了，返回 pyftsubset 的调用方式。"""
    try:
        import fontTools  # noqa: F401
        import brotli  # noqa: F401
    except ImportError as err:
        print(f"[字体] 缺少依赖：{err}")
        print("[字体] 请先运行：py -m pip install fonttools brotli")
        print("[字体] 跳过字体子集化，站点会用后备字体显示。")
        sys.exit(0)

    # 优先用 python -m fontTools.subset，避免 PATH 里找不到 pyftsubset.exe
    return sys.executable


def subset(src: Path, dst: Path, limit_kb: int, chars: set[str]) -> bool:
    """裁剪一个字体。返回是否成功。"""
    if not src.exists():
        print(f"[字体] 找不到源文件：{src}")
        return False

    OUT.mkdir(parents=True, exist_ok=True)

    # 写一份字符清单给 pyftsubset 读
    txt = OUT / "_chars.txt"
    txt.write_text("".join(sorted(chars)), encoding="utf-8")

    cmd = [
        ensure_fonttools(),
        "-m",
        "fontTools.subset",
        str(src),
        f"--text-file={txt}",
        f"--output-file={dst}",
        "--flavor=woff2",
        "--layout-features=*",
        "--no-hinting",
        "--desubroutinize",
        "--drop-tables+=DSIG",
        "--name-IDs=*",
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[字体] 裁剪失败：{dst.name}")
        print(result.stderr[-1200:])
        return False

    size_kb = dst.stat().st_size / 1024
    flag = "" if size_kb <= limit_kb else f"  ⚠ 超过预算 {limit_kb}KB"
    print(f"[字体] {dst.name} → {size_kb:.0f} KB{flag}")
    return True


def main() -> None:
    print("[字体] 开始子集化……")
    chars = collect_chars()

    ok = 0
    for src, name, limit in FONTS:
        if subset(src, OUT / name, limit, chars):
            ok += 1

    # 清掉临时文件
    tmp = OUT / "_chars.txt"
    if tmp.exists():
        tmp.unlink()

    print(f"[字体] 完成 {ok}/{len(FONTS)} 个")


if __name__ == "__main__":
    main()
