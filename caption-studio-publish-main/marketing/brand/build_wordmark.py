"""Builds the Lekha Captions wordmark as fully outlined SVGs (no font dependency).

Concept "Subtitle lines": the name is set as two burned-in subtitle lines, stacked and
staggered the way captions sit on a video — "lekha" on an ink box, "captions" on a
day-theme amber box, framed by big ink quotation marks.

    PYTHONPATH=<dir with fontTools> python build_wordmark.py
"""
import json
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).parent
OUT = HERE / 'svg'
OUT.mkdir(exist_ok=True)

INK, PAPER = '#0C0B0F', '#FFFAF3'   # paper = landing day-theme background
AMBER = '#C27A29'                    # landing day-theme highlight (#C9720C), softened slightly


def set_text(font_file, text, x, baseline, size, track):
    """Outline `text` and return (svg path, ink bounds)."""
    font = TTFont(font_file)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font['head'].unitsPerEm
    pen = SVGPathPen(glyphs)
    bounds = BoundsPen(glyphs)
    cursor = x
    for ch in text:
        name = cmap[ord(ch)]
        t = (scale, 0, 0, -scale, cursor, baseline)
        glyphs[name].draw(TransformPen(pen, t))
        glyphs[name].draw(TransformPen(bounds, t))
        cursor += font['hmtx'][name][0] * scale + track
    return pen.getCommands(), bounds.bounds  # (xMin, yMin, xMax, yMax) in SVG space


def rect(x0, y0, x1, y1, r):
    return f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{x1 - x0:.1f}" height="{y1 - y0:.1f}" rx="{r}"/>'


SERIF = HERE / 'fonts' / 'Fraunces144pt-SemiBoldItalic.ttf'


def quote(ch, size, x_left=None, x_right=None, y_top=None, y_bottom=None):
    """Outline a big quotation mark positioned by its ink box."""
    _, (qx0, qy0, qx1, qy1) = set_text(SERIF, ch, 0, 0, size, 0)
    dx = (x_left - qx0) if x_left is not None else (x_right - qx1)
    dy = (y_top - qy0) if y_top is not None else (y_bottom - qy1)
    path, b = set_text(SERIF, ch, dx, dy, size, 0)
    return path, b


def build(quotes=None):
    bold = HERE / 'fonts' / 'BricolageGrotesque96pt-ExtraBold.ttf'
    mono = HERE / 'fonts' / 'JetBrainsMono-Bold.ttf'
    inline = quotes == 'inline'
    q_open = q_close = ''

    # line 1 — "lekha" on the ink box (inline variant: the opening quote leads the line)
    lead = 0
    if inline:
        q_open, (ox0, oy0, ox1, oy1) = quote('“', 1000, x_left=0, y_top=-700)
        lead = ox1 + 70
    word, (wx0, wy0, wx1, wy1) = set_text(bold, 'lekha', lead, 0, 1000, -32)
    if inline:
        wx0 = 0
    box1 = (wx0 - 210, wy0 - 70, wx1 + 210, wy1 + 150)  # pad like a subtitle box (more air below the baseline)

    # line 2 — "captions" on the golden box, staggered right and tucked under line 1
    cap_size, cap_track = 360, 76
    caps, (cx0, cy0, cx1, cy1) = set_text(mono, 'captions', 0, 0, cap_size, cap_track)
    pad_x, pad_y = 190, 92
    left = box1[0] + 1180
    top = box1[3] + 80
    dx = left + pad_x - cx0
    dy = top + pad_y - cy0
    caps, _ = set_text(mono, 'captions', dx, dy, cap_size, cap_track)
    box2 = [left, top, left + (cx1 - cx0) + 2 * pad_x - cap_track, top + (cy1 - cy0) + 2 * pad_y]
    if inline:  # closing quote ends the second line, inside the golden box
        q_close, (qx0, qy0, qx1, qy1) = quote('”', 560, x_left=box2[2] - pad_x + 40, y_top=box2[1] + pad_y - 30)
        box2[2] = qx1 + pad_x - 20

    x0, y0 = box1[0], box1[1]
    x1, y1 = max(box1[2], box2[2]), box2[3]
    if quotes in ('frame', 'overlap'):
        size = 1500 if quotes == 'frame' else 1750
        if quotes == 'frame':
            q_open, b = quote('“', size, x_right=box1[0] - 70, y_top=box1[1])
            q_close, c = quote('”', size, x_left=box2[2] + 70, y_bottom=box2[3])
        else:
            q_open, b = quote('“', size, x_left=box1[0] - 400, y_top=box1[1] - 360)
            q_close, c = quote('”', size, x_right=box2[2] + 400, y_bottom=box2[3] + 360)
        x0, y0 = min(x0, b[0]), min(y0, b[1])
        x1, y1 = max(x1, c[2]), max(y1, c[3])
    return {
        'inline': inline,
        'q_open': q_open,
        'q_close': q_close,
        'view': f'{x0:.1f} {y0:.1f} {x1 - x0:.1f} {y1 - y0:.1f}',
        'box1': rect(*box1, 70),
        'box2': rect(*box2, 64),
        'word': word,
        'caps': caps,
    }


def svg(view, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" role="img" aria-label="Lekha Captions">'
            f'<title>Lekha Captions</title>{body}</svg>\n')


def render(g, theme='light', quote_fill=None):
    """theme: light | dark | mono. Inline quotes take the colour that contrasts with their box."""
    box1_fill, word_fill = (INK, PAPER) if theme == 'light' else (PAPER, INK)
    quote_fill = quote_fill or (INK if theme == 'light' else AMBER)
    qo = qc = quote_fill
    if theme == 'mono':
        cut = f'<path d="{g["word"]}" fill="#000"/><path d="{g["caps"]}" fill="#000"/>'
        outer = f'<path d="{g["q_open"]}"/><path d="{g["q_close"]}"/>'
        return svg(g['view'], f'<mask id="lk-cut"><rect x="-99999" y="-99999" width="199999" height="199999" fill="#fff"/>{cut}</mask>'
                              f'<g fill="{INK}"><g mask="url(#lk-cut)">{g["box1"]}{g["box2"]}</g>{outer}</g>')
    return svg(g['view'], f'<g fill="{box1_fill}">{g["box1"]}</g><path d="{g["word"]}" fill="{word_fill}"/>'
                          f'<g fill="{AMBER}">{g["box2"]}</g><path d="{g["caps"]}" fill="{PAPER}"/>'
                          f'<path d="{g["q_open"]}" fill="{qo}"/><path d="{g["q_close"]}" fill="{qc}"/>')


QUOTES = 'frame'  # chosen (A2): big ink quotes framing the two lines
g = build(QUOTES)
files = {
    'lekha-wordmark-light.svg': render(g, 'light'),   # for light backgrounds
    'lekha-wordmark-dark.svg': render(g, 'dark'),     # for dark backgrounds
    'lekha-wordmark-mono.svg': render(g, 'mono'),     # single colour
}
for name, content in files.items():
    (OUT / name).write_text(content, encoding='utf-8')
    print('wrote', OUT / name)


# app icon / favicon: "le" with the big amber opening quote
bold = HERE / 'fonts' / 'BricolageGrotesque96pt-ExtraBold.ttf'
le_path, (lx0, ly0, lx1, ly1) = set_text(bold, 'le', 0, 0, 1000, -32)
sc = 520 / (ly1 - ly0)
tx = 585 - ((lx0 + lx1) / 2) * sc
ty = 610 - ((ly0 + ly1) / 2) * sc
q_path, _ = quote('“', 1000, x_left=0, y_top=0)
icon = svg('0 0 1024 1024',
           f'<rect width="1024" height="1024" rx="230" fill="{INK}"/>'
           f'<path transform="translate({tx:.1f} {ty:.1f}) scale({sc:.4f})" d="{le_path}" fill="{PAPER}"/>'
           f'<path transform="translate(96 112) scale(.8)" d="{q_path}" fill="{AMBER}"/>')
(OUT / 'lekha-icon.svg').write_text(icon, encoding='utf-8')
print('wrote', OUT / 'lekha-icon.svg')

(HERE / 'wordmark-paths.json').write_text(json.dumps(g), encoding='utf-8')
print('wrote', HERE / 'wordmark-paths.json')
