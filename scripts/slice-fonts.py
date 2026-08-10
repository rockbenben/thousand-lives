#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
把两个大 CJK 字体切成 unicode-range 分片，浏览器只下用得到的那几片。

为什么不是「再子集化小一点」：正文是 AI 现场生成的，用字无界，事先赌不出一个够用
又够小的字表。分片把这件事反过来——字体仍覆盖全部 5595 / 4042 个码位，但按需取片，
渲染到哪个字就取哪一片，取过即缓存。这也是 Google Fonts 对 CJK 的做法。

切法（不是均匀切）：
  · 第 0 片：按项目语料词频排出的最常用 HEAD_SIZE 个字，**独占一片**。
    它几乎每页都要，合成一个文件比切成几片更省请求、压缩也更好。
  · 其余：按 TAIL_SIZE 一片切碎。这些是罕用字，切得细才不会为一个字拖下一大片。

产物：public/fonts/slices/*.woff2 与 src/fonts.css（都入库，构建时不跑本脚本）。
重跑：python scripts/slice-fonts.py（需要 fontTools/pyftsubset 与 brotli）。
"""
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
# 整体字体只作切片的输入，不放在 public/ 下——否则 2.3 MB 会跟着进 dist 却永远没人请求
FONT_SRC = ROOT / 'scripts' / 'fonts-src'
OUT_DIR = ROOT / 'public' / 'fonts' / 'slices'
CSS_OUT = SRC / 'fonts.css'

# head/tail 是实测调出来的，不是拍的。方法：量出首屏实际渲染的不同汉字（正文 501 个、
# 标题 54 个），对每组参数算出会命中哪几片、真实字节数是多少，再把 @font-face 条数的
# CSS 开销一并计入（CSS 是渲染阻塞的，切太碎会在这里赔回去）。两个字体的最优点不同：
#   · 正文每页用字多（500+），head 大一点划算，多数字一片包完；
#   · 标题每页只有几十个字且多是生僻字（缥缈、袭、谍、宦、锣…），head 大纯属浪费，
#     真正省的是把尾部切碎——为一个字拖下一大片是这里最大的漏。
# 纯字节最优是 (1000,20)/(0,20)，但请求数翻倍；下面这组只差约 20 KB，请求数减半。
FONTS = [
    ('lxgwwenkai-regular', 'LXGW WenKai', 1600, 30),
    ('zcoolxiaowei-regular', 'ZCOOL XiaoWei', 600, 30),
]
# mashanzheng(9 KB)与 cinzel(26 KB)本就极小，切了只剩开销，原样保留


def corpus_freq():
    """项目源码里所有 CJK 字符的出现次数——用来决定谁进第 0 片。"""
    cnt = Counter()
    for f in SRC.rglob('*'):
        if f.suffix not in ('.ts', '.tsx', '.css') or not f.is_file():
            continue
        cnt.update(ch for ch in f.read_text(encoding='utf-8') if '一' <= ch <= '鿿')
    return cnt


def font_codepoints(path):
    cps = set()
    font = TTFont(path)
    for t in font['cmap'].tables:
        cps |= set(t.cmap.keys())
    font.close()
    return cps


def ranges(cps):
    """码位集合 → 紧凑的 unicode-range 串（连续段合并成 U+a-b）。"""
    out, run = [], []
    for cp in sorted(cps):
        if run and cp == run[-1] + 1:
            run.append(cp)
        else:
            if run:
                out.append(run)
            run = [cp]
    if run:
        out.append(run)
    return ','.join(
        'U+%X' % r[0] if len(r) == 1 else 'U+%X-%X' % (r[0], r[-1]) for r in out
    )


def subset(src, dst, cps):
    cmd = [
        sys.executable, '-m', 'fontTools.subset', str(src),
        '--unicodes=' + ','.join('%X' % c for c in sorted(cps)),
        '--output-file=' + str(dst),
        '--flavor=woff2',
        '--no-hinting',
        '--drop-tables+=DSIG',
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit('pyftsubset 失败 %s\n%s' % (dst.name, r.stderr))


def main():
    freq = corpus_freq()
    print('项目语料：%d 个不同汉字，%d 字次' % (len(freq), sum(freq.values())))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob('*.woff2'):
        old.unlink()

    css = ['/* 本文件由 scripts/slice-fonts.py 生成，勿手改。见该脚本头部说明。 */\n']
    for stem, family, head_size, tail_size in FONTS:
        src = FONT_SRC / (stem + '.woff2')
        cps = font_codepoints(src)
        # 语料词频优先，词频相同或不在语料里的按码位排——尾部谁先谁后几乎无所谓
        ordered = sorted(cps, key=lambda c: (-freq.get(chr(c), 0), c))
        chunks = [ordered[:head_size]] + [
            ordered[i:i + tail_size] for i in range(head_size, len(ordered), tail_size)
        ]

        union, total = set(), 0
        for i, chunk in enumerate(chunks):
            dst = OUT_DIR / ('%s-%d.woff2' % (stem, i))
            subset(src, dst, chunk)
            union |= set(chunk)
            total += dst.stat().st_size
            css.append(
                '@font-face{font-family:"%s";src:url("/fonts/slices/%s") format("woff2");'
                'font-weight:400;font-style:normal;font-display:swap;unicode-range:%s}'
                % (family, dst.name, ranges(chunk))
            )

        # 分片的并集必须与原字体逐个码位相等，否则某些字会永远缺字形（豆腐块）
        assert union == cps, '码位丢失: %s' % sorted(cps - union)[:20]
        print('%-22s %d 片  原 %d KB → 分片合计 %d KB（第0片 %d KB）' % (
            stem, len(chunks), src.stat().st_size // 1024, total // 1024,
            (OUT_DIR / ('%s-0.woff2' % stem)).stat().st_size // 1024))

    CSS_OUT.write_text('\n'.join(css) + '\n', encoding='utf-8')
    print('写出 %s（%d 条 @font-face）' % (CSS_OUT.relative_to(ROOT), len(css) - 1))


if __name__ == '__main__':
    main()
