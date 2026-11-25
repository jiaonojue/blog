#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成社交分享卡片（OG image）。

【它是什么】
  当有人把你的链接发到微信、QQ、Twitter、Discord 时，会显示一张预览图。
  没有这张图，链接就是一条干巴巴的文字。
  这张图固定 1200×630，是各平台通用尺寸。

【它怎么做的】
  拿 public/art/hero.webp 当底图 → 压暗 → 盖上站点名和一句话 → 右下角加印章。

【什么时候跑】
  只在你想换分享图的时候手动跑：
    py scripts/make-og.py
  构建时不会自动跑，因为底图不变结果就不变，没必要每次都算。

【改文字】
  改下面 TITLE / SUBTITLE / SEAL 三个变量，再跑一次。
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("[OG] 缺少 Pillow。请运行：py -m pip install pillow")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "public" / "art"

# ── 卡片上的文字（改这里） ───────────────────────────────────────────
TITLE = "回声记录"
SUBTITLE = "看番、写码、随手记一点什么"
SEAL = "記"

W, H = 1200, 630
ACCENT = (255, 92, 138)
CREAM = (255, 248, 244)


def find_cjk_font(size: int) -> ImageFont.FreeTypeFont:
    """找一个能显示中文的字体。找不到就用默认字体（中文会变方块）。"""
    candidates = [
        r"C:\Windows\Fonts\msyhbd.ttc",  # 微软雅黑 粗体
        r"C:\Windows\Fonts\msyh.ttc",  # 微软雅黑
        r"C:\Windows\Fonts\simhei.ttf",  # 黑体
        r"C:\Windows\Fonts\Deng.ttf",  # 等线
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    print("[OG] 警告：没找到中文字体，文字可能显示成方块")
    return ImageFont.load_default()


def find_latin_font(size: int) -> ImageFont.FreeTypeFont:
    """拉丁字体，用于副标题里可能的英文。"""
    for path in [r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\arial.ttf"]:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return find_cjk_font(size)


def main() -> None:
    base = ART / "hero.webp"
    if not base.exists():
        print(f"[OG] 找不到底图：{base}")
        print("[OG] 先跑 py scripts/optimize-images.py 生成 hero.webp")
        sys.exit(1)

    # 底图：裁成 1200×630 并压暗，保证白字看得清
    im = Image.open(base).convert("RGB")
    scale = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
    left = (im.width - W) // 2
    top = (im.height - H) // 2
    im = im.crop((left, top, left + W, top + H))

    # 压暗 + 往暖色偏一点
    dark = Image.new("RGB", (W, H), (28, 22, 30))
    im = Image.blend(im, dark, 0.42)

    draw = ImageDraw.Draw(im, "RGBA")

    # 左下到右上的柔和遮罩，让左侧文字区域更暗
    for i in range(W):
        alpha = int(120 * (1 - i / W) ** 1.4)
        draw.line([(i, 0), (i, H)], fill=(20, 16, 24, alpha))

    # ── 标题 ──
    title_font = find_cjk_font(86)
    draw.text((88, 210), TITLE, font=title_font, fill=CREAM)

    # ── 副标题 ──
    sub_font = find_cjk_font(32)
    draw.text((92, 330), SUBTITLE, font=sub_font, fill=(255, 240, 240, 220))

    # ── 一条强调色短线 ──
    draw.rounded_rectangle([92, 390, 92 + 96, 396], radius=3, fill=ACCENT)

    # ── 印章（右下角） ──
    seal_size = 118
    sx, sy = W - 88 - seal_size, H - 88 - seal_size
    draw.rounded_rectangle(
        [sx, sy, sx + seal_size, sy + seal_size],
        radius=20,
        outline=ACCENT,
        width=7,
    )
    seal_font = find_cjk_font(64)
    bbox = draw.textbbox((0, 0), SEAL, font=seal_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        (sx + (seal_size - tw) / 2 - bbox[0], sy + (seal_size - th) / 2 - bbox[1]),
        SEAL,
        font=seal_font,
        fill=ACCENT,
    )

    # 用 JPEG 而不是 PNG：底图是照片，PNG 存照片会到 800KB+，
    # 而各平台对分享图的体积上限通常只有 300KB 左右。JPEG 质量 82 肉眼几乎无差。
    out = ART / "og-default.jpg"
    im.save(out, "JPEG", quality=82, optimize=True, progressive=True, subsampling=1)
    print(f"[OG] 已生成 {out.name}  1200×630  {out.stat().st_size / 1024:.0f} KB")

    # 文章页和收藏页复用同一张，避免维护三份
    for name in ("og-posts.jpg", "og-favorites.jpg"):
        im.save(ART / name, "JPEG", quality=82, optimize=True, progressive=True, subsampling=1)
    print("[OG] 已生成 og-posts.jpg / og-favorites.jpg（与默认图相同）")


if __name__ == "__main__":
    main()
