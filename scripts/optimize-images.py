#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图片处理 —— 把下载来的原图统一成 WebP，裁到该有的尺寸。

【为什么需要】
  从插画站下下来的图经常是 2000×3000 的 PNG，一张 8MB。
  网站上用不着那么大，直接放上去会让页面几秒钟都开不完。
  这个脚本把每张图缩到"实际显示尺寸"，转成 WebP，体积能降到原来的 5%。

【怎么用】
  1. 把下载的原图放进 raw/ 目录，文件名随意（见下方 SOURCES 清单）
  2. 运行：npm run images
  3. 处理好的图出现在 public/art/ 和 public/gallery/

【尺寸对照表】
  下面的 TASKS 列表就是"哪张原图 → 变成什么"的映射。
  想换一张图，只要把 raw/ 里的文件换掉再跑一次，不用改代码逻辑。

【依赖】
  py -m pip install pillow
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    print("[图片] 缺少 Pillow。请运行：py -m pip install pillow")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
ART = ROOT / "public" / "art"
GALLERY = ROOT / "public" / "gallery"

# ── 任务清单 ─────────────────────────────────────────────────────────
# (raw 里的文件名, 输出路径, 目标宽, 目标高, 裁剪方式, 质量)
#   裁剪方式 crop  = 填满目标框，多出来的部分裁掉（适合主视觉、封面）
#   裁剪方式 fit   = 整张塞进框里，不足的地方留背景色（适合有完整构图的图）
TASKS = [
    # ── 主视觉 ──
    ("hero.png", ART / "hero.webp", 2400, 1400, "crop", 82),
    ("about.png", ART / "about.webp", 1200, 1200, "crop", 82),

    # ── 文章封面（16:9） ──
    ("post-frieren.png", ART / "posts" / "frieren.webp", 1200, 675, "crop", 80),
    ("post-yurucamp.png", ART / "posts" / "yurucamp.webp", 1200, 675, "crop", 80),
    ("post-mob.png", ART / "posts" / "mob.webp", 1200, 675, "crop", 80),
    ("post-your-name.png", ART / "posts" / "your-name.webp", 1200, 675, "crop", 80),
    ("post-vue.png", ART / "posts" / "vue-ssg.webp", 1200, 675, "crop", 80),

    # ── 收藏封面（5:7 竖版） ──
    ("fav-frieren.png", ART / "favorites" / "frieren.webp", 500, 700, "crop", 80),
    ("fav-yurucamp.png", ART / "favorites" / "yurucamp.webp", 500, 700, "crop", 80),
    ("fav-mob.png", ART / "favorites" / "mob.webp", 500, 700, "crop", 80),
    ("fav-your-name.png", ART / "favorites" / "your-name.webp", 500, 700, "crop", 80),
    ("fav-stardew.png", ART / "favorites" / "stardew.webp", 500, 700, "crop", 80),
    ("fav-hollow-knight.png", ART / "favorites" / "hollow-knight.webp", 500, 700, "crop", 80),

    # ── 相册（保持竖幅，宽度统一 1200） ──
    ("gallery-1.png", GALLERY / "evening-train.webp", 1200, 1600, "crop", 82),
    ("gallery-2.png", GALLERY / "convenience-store.webp", 1200, 900, "crop", 82),
    ("gallery-3.png", GALLERY / "rainy-crossing.webp", 1200, 1500, "crop", 82),
    ("gallery-4.png", GALLERY / "summer-clouds.webp", 1200, 800, "crop", 82),
    ("gallery-5.png", GALLERY / "desk.webp", 1200, 1200, "crop", 82),
    ("gallery-6.png", GALLERY / "night-lamp.webp", 1200, 1500, "crop", 82),
    ("gallery-7.png", GALLERY / "seaside-dusk.webp", 1200, 800, "crop", 82),
    ("gallery-8.png", GALLERY / "window-afternoon.webp", 1200, 1400, "crop", 82),
]

# ── 背景插画（16:10 横版，压在正文下面） ─────────────────────────────
# 每篇文章 / 每个栏目 / 每个标签各挑一张，所以要多准备一些。
# 原图在 raw/bg/bg-01.jpg ~ bg-44.jpg，只用其中挑出来的 24 张。
# 背景会被模糊 + 压暗，所以不用给到 2400 宽，1600 就够，体积也小。
BG_PICK = [
    2, 3, 4, 6, 10, 12, 15, 16, 17, 19, 20, 21,
    24, 25, 26, 29, 33, 34, 35, 37, 39, 41, 42, 43,
]
for _n in BG_PICK:
    TASKS.append(
        (
            f"bg/bg-{_n:02d}.jpg",
            ART / "bg" / f"bg-{_n:02d}.webp",
            1600,
            1000,
            "crop",
            # 背景在页面上会被模糊 + 压到很淡，质量给低一点完全看不出来，
            # 但能让首屏少下载几百 KB。
            58,
        )
    )

# 体积上限（KB）。超了就自动降质量重压，最多试 3 次。
LIMIT_KB = {
    "hero": 420,
    "about": 200,
    "posts": 160,
    "favorites": 90,
    "gallery": 220,
    "bg": 160,
}


def resize_cover(im: Image.Image, tw: int, th: int) -> Image.Image:
    """按 crop 方式缩放：填满目标框，超出部分居中裁掉。"""
    return ImageOps.fit(im, (tw, th), method=Image.Resampling.LANCZOS, centering=(0.5, 0.42))


def resize_contain(im: Image.Image, tw: int, th: int, bg: tuple[int, int, int]) -> Image.Image:
    """按 fit 方式缩放：整张图塞进框，四周补背景色。"""
    im.thumbnail((tw, th), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (tw, th), bg)
    canvas.paste(im, ((tw - im.width) // 2, (th - im.height) // 2))
    return canvas


def get_limit(out: Path) -> int:
    """按输出目录决定体积上限。"""
    try:
        rel = out.relative_to(ROOT / "public")
    except ValueError:
        return 200
    parts = rel.parts
    if parts[0] == "gallery":
        return LIMIT_KB["gallery"]
    if len(parts) > 1 and parts[1] in LIMIT_KB:
        return LIMIT_KB[parts[1]]
    if parts[0] == "art":
        name = out.stem
        if name in ("hero", "about"):
            return LIMIT_KB[name]
        return LIMIT_KB["posts"]
    return 200

def process(src: Path, out: Path, tw: int, th: int, mode: str, quality: int) -> bool:
    if not src.exists():
        print(f"[图片] 跳过（没有原图）：{src.name}")
        return False

    out.parent.mkdir(parents=True, exist_ok=True)
    limit = get_limit(out)

    try:
        im = Image.open(src)
    except Exception as err:
        print(f"[图片] 打不开 {src.name}：{err}")
        return False

    # 统一成 RGB（PNG 的透明通道在 WebP 里会变成黑底）
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 248, 244))
        bg.paste(im, mask=im.split()[-1])
        im = bg
    elif im.mode != "RGB":
        im = im.convert("RGB")

    resized = (
        resize_cover(im, tw, th)
        if mode == "crop"
        else resize_contain(im, tw, th, (255, 248, 244))
    )

    # 压到预算内：不行就降质量
    q = quality
    for attempt in range(8):
        resized.save(out, "WEBP", quality=q, method=6)
        size_kb = out.stat().st_size / 1024
        # 背景图本来就会被模糊 + 压淡，质量可以一路降到 40 也不难看
        floor = 40 if out.parent.name == "bg" else 60
        if size_kb <= limit or q <= floor:
            break
        q -= 6

    size_kb = out.stat().st_size / 1024
    flag = "" if size_kb <= limit else f"  ! 超预算 {limit}KB"
    print(f"[图片] {src.name:<38} → {out.name:<26} {tw}×{th}  {size_kb:>6.0f} KB{flag}")
    return True


def main() -> None:
    if not RAW.exists():
        print(f"[图片] 没有 raw 目录。请把原图放进：{RAW}")
        print("[图片] 文件清单见 scripts/optimize-images.py 顶部的 TASKS。")
        return

    print("[图片] 开始处理……")
    ok = 0
    for name, out, tw, th, mode, quality in TASKS:
        if process(RAW / name, out, tw, th, mode, quality):
            ok += 1

    print(f"[图片] 完成 {ok}/{len(TASKS)} 张")

    if ok < len(TASKS):
        print("[图片] 有图片没处理，检查 raw/ 里缺了哪些文件。")


if __name__ == "__main__":
    main()
