#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小说插图处理 —— 把 EPUB 里解出来的原图转成 WebP。

【为什么需要】
  EPUB 里的插图是出版方打包的 JPEG，有的能到 400KB。
  在线阅读时同时加载好几张，不压的话翻一章要等半天。

【为什么质量是"自适应"的】
  这本书的插图本身已经被压过一轮：835×1186，一张才 70KB 左右。
  这种情况下 WebP 用固定质量 82 去转，有几张反而会比原图更大——
  因为原图早就丢掉了 WebP 想省下来的那些细节。
  所以这里从 82 开始逐档往下降，取第一个比原图小的结果。
  压不动就停在 50，实际测下来这一档仍然比原图小。

【它做什么】
  扫描 raw/novels/<slug>/img/ 下的所有图片
  → 最长边超过 1200 就缩到 1200（不放大）
  → 转 WebP，质量自适应
  → 输出到 public/novels/<slug>/img/<同名>.webp

【怎么用】
  npm run novel 会先解包、再自动调用这个脚本。
  也可以单独跑：npm run novel:images
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("[小说图] 缺少 Pillow。请运行：py -m pip install pillow")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
RAW_ROOT = ROOT / "raw" / "novels"
OUT_ROOT = ROOT / "public" / "novels"

# 最长边。EPUB 里的插图通常是 1200×1800 左右，缩到 1200 足够清楚，
# 再大在手机上也看不出差别，只是白白多吃流量。
MAX_EDGE = 1200

# 质量阶梯。从高往低试，第一个"比原图小"的档位就留下。
# 原图本身压得很狠时，82 会反向膨胀，于是自动降到 70 / 60 / 50。
# 实测这本书里 50 仍然比原图小，所以阶梯到底一定不会变大。
QUALITY_STEPS = (82, 70, 60, 50)

# Pillow 能读的格式（EPUB 里偶尔会有 GIF / BMP，一并处理掉）
EXTS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tif", ".tiff"}


def convert(src: Path, dst: Path) -> tuple[int, int, int] | None:
    """转一张图，返回 (原大小KB, 新大小KB, 用的质量)。失败返回 None。"""
    try:
        with Image.open(src) as im:
            # 带透明通道的（封面 logo 之类）保留透明，转成 RGBA 再存 WebP
            has_alpha = im.mode in ("RGBA", "LA") or (
                im.mode == "P" and "transparency" in im.info
            )
            im = im.convert("RGBA" if has_alpha else "RGB")

            # 只缩不放：本来就不大的图保持原尺寸
            w, h = im.size
            longest = max(w, h)
            if longest > MAX_EDGE:
                scale = MAX_EDGE / longest
                im = im.resize(
                    (max(1, round(w * scale)), max(1, round(h * scale))),
                    Image.LANCZOS,
                )

            # 逐档试质量，取第一个比原图小的
            orig_size = src.stat().st_size
            buf = None
            used_quality = QUALITY_STEPS[-1]
            for quality in QUALITY_STEPS:
                candidate = io.BytesIO()
                im.save(candidate, "WEBP", quality=quality, method=6)
                buf = candidate
                used_quality = quality
                if candidate.tell() <= orig_size:
                    break

            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(buf.getvalue() if buf else b"")

        return orig_size // 1024, dst.stat().st_size // 1024, used_quality
    except Exception as err:  # noqa: BLE001 - 一张图坏了不该让整批停下
        print(f"[小说图] 跳过 {src.name}：{err}")
        return None


def main() -> None:
    if not RAW_ROOT.exists():
        print("[小说图] 没有 raw/novels/，先跑 npm run novel 解包。")
        return

    total_before = 0
    total_after = 0
    count = 0
    failed = 0

    for book_dir in sorted(p for p in RAW_ROOT.iterdir() if p.is_dir()):
        img_dir = book_dir / "img"
        if not img_dir.exists():
            continue

        out_dir = OUT_ROOT / book_dir.name / "img"
        print(f"[小说图] {book_dir.name}")

        for src in sorted(img_dir.iterdir()):
            if not src.is_file() or src.suffix.lower() not in EXTS:
                continue

            dst = out_dir / f"{src.stem}.webp"
            sizes = convert(src, dst)
            if sizes is None:
                failed += 1
                continue

            before, after, quality = sizes
            total_before += before
            total_after += after
            count += 1
            print(f"    {src.name:<14} {before:>5} KB → {after:>4} KB  (q{quality})")

    if not count:
        print("[小说图] 没有找到可转换的图片。")
        return

    saved = total_before - total_after
    pct = (saved / total_before * 100) if total_before else 0
    print(
        f"[小说图] 完成 {count} 张"
        + (f"，跳过 {failed} 张" if failed else "")
        + f" · {total_before} KB → {total_after} KB（省 {pct:.0f}%）"
    )


if __name__ == "__main__":
    main()
