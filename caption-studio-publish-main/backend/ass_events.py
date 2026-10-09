"""ASS dialogue emitters for text boxes, trusted layouts and caption timing.

Each emitter consumes explicit style/caption data and a writable text stream.
No emitter depends on the HTTP application or creates files itself.
"""
import re
from dataclasses import dataclass
from typing import Any

@dataclass(frozen=True)
class AssCaptionContext:
    c: dict[str, Any]
    anim: str
    cap_word_layouts: dict[int, dict[str, Any]]
    cid: str
    detached_wi: set[int]
    e: str
    et: float
    is_te: bool
    positioned: list[tuple[int, str, dict[str, Any]]]
    raw_text: str
    s: str
    st: float
    words_timing: list[dict[str, Any]]
    ws_map: dict[str, Any]


@dataclass(frozen=True)
class AssRegularContext:
    main_text: str
    positioned: list[tuple[int, str, dict[str, Any]]]
    tags: list[str]


def prepare_ass_caption(processor, c, style_context, word_layouts=None) -> AssCaptionContext | None:
    st = float(c.get('start_time', 0))
    et = float(c.get('end_time', 0))
    if et <= st: return None
    raw_text = processor._escape_ass_text(c.get('text', ''))
    if not raw_text.strip(): return None
    s = processor._fmt(st)
    e = processor._fmt(et)
    cid = str(c.get('id', ''))
    anim = (c.get('animation', 'none') or 'none')
    ws_map = c.get('word_styles') or {}
    if not isinstance(ws_map, dict): ws_map = {}
    words_timing = [
        {**word, 'word': processor._escape_ass_text(word.get('word', ''))}
        for word in (c.get('words') or [])
        if isinstance(word, dict)
    ]
    is_te = bool(c.get('is_text_element', False))

    # Extract word layouts for this caption (primary per-word path)
    cap_word_layouts = {}
    if word_layouts:
        for _wlk, _wlv in word_layouts.items():
            if _wlk.startswith(cid + '-'):
                try:
                    cap_word_layouts[int(_wlk[len(cid) + 1:])] = _wlv
                except ValueError:
                    pass

    # Pre-build positioned list (words with custom abs positions, dragged by user)
    # Needed by both the primary path and the fallback path.
    positioned = []
    _pos_tokens = re.split(r'(\s+)', style_context.transform_text(raw_text).replace('\n', '\\N'))
    _pos_wi = 0
    for _pos_tok in _pos_tokens:
        if not _pos_tok.strip():
            continue
        _pos_ws = ws_map.get(f"{cid}-{_pos_wi}", {})
        if (
            isinstance(_pos_ws, dict)
            and _pos_ws.get('abs_x_pct') is not None
            and processor._is_detached_pos(_pos_ws.get('abs_x_pct'), _pos_ws.get('abs_y_pct'))
        ):
            positioned.append((_pos_wi, _pos_tok, _pos_ws))
        _pos_wi += 1
    # Detached words render ONLY at their dragged position (Layer 1);
    # every sentence/karaoke line must leave their slot empty, or the
    # word shows twice: once in the line, once at the dragged spot.
    detached_wi = {_dwi for (_dwi, _dtok, _dws) in positioned}


    return AssCaptionContext(
        c=c,
        anim=anim,
        cap_word_layouts=cap_word_layouts,
        cid=cid,
        detached_wi=detached_wi,
        e=e,
        et=et,
        is_te=is_te,
        positioned=positioned,
        raw_text=raw_text,
        s=s,
        st=st,
        words_timing=words_timing,
        ws_map=ws_map,
    )


def write_text_element(processor, f, style_context, caption_context):
    cs = caption_context.c.get('custom_style') or {}
    te_fi = processor._ensure_font(cs.get('font_family', 'Inter') or 'Inter')
    te_fn = te_fi['ass_name']
    te_fs = style_context.ass_font_size(cs.get('font_size', 18) or 18)
    te_c = processor._hex_to_ass(cs.get('text_color', '#ffffff') or '#ffffff',
                            float(cs.get('text_opacity', 1.0) or 1.0))
    te_bold = 1 if str(cs.get('font_weight', '500') or '500') in ('bold', '700', '800', '900') else 0
    te_italic = 1 if (cs.get('font_style', 'normal') or 'normal') == 'italic' else 0
    te_lsp = int(float(cs.get('letter_spacing', 0) or 0) * style_context.scale_factor)
    te_has_bg = bool(cs.get('has_background', True))
    te_bg_a = processor._hex_to_ass(cs.get('background_color', '#000000') or '#000000',
                               float(cs.get('background_opacity', 0.6) or 0.6))
    te_bord = max(int(float(cs.get('background_padding', 8) or 8) * style_context.scale_factor * style_context.bord_factor *
                      float(cs.get('background_h_multiplier', 0.99) or 0.99)), 2) if te_has_bg else 2
    te_align = {'left': 4, 'center': 5, 'right': 6}.get(cs.get('text_align', 'center'), 5)
    te_px = int((float(cs.get('position_x', 50) or 50) / 100) * style_context.video_w)
    te_py = int((float(cs.get('position_y', 50) or 50) / 100) * style_context.video_h)
    if style_context.detected_script in style_context.indic_y_corrections:
        te_py = max(10, te_py + int(style_context.indic_y_corrections[style_context.detected_script] * style_context.video_h))
    te_tc = cs.get('text_transform', 'none') or 'none'
    def _TT(t):
        if te_tc == 'uppercase': return t.upper()
        elif te_tc == 'lowercase': return t.lower()
        elif te_tc == 'capitalize': return t.title()
        return t
    te_text = _TT(caption_context.raw_text).replace('\n', '\\N')
    if te_has_bg:
        te_style_str = f"\\3c{te_bg_a}\\4c{te_bg_a}\\bord{te_bord}\\shad0"
    else:
        te_sd = (cs.get('has_stroke', False), float(cs.get('stroke_width', 1) or 1), cs.get('stroke_color', '#000000') or '#000000')
        te_shd = (cs.get('has_shadow', False), float(cs.get('shadow_blur', 4) or 4),
                  float(cs.get('shadow_offset_x', 0) or 0), float(cs.get('shadow_offset_y', 2) or 2),
                  cs.get('shadow_color', '#000000') or '#000000')
        te_ep = {
            'offset': float(cs.get('effect_offset', 50) or 50),
            'direction': float(cs.get('effect_direction', -45) or -45),
            'blur': float(cs.get('effect_blur', 50) or 50),
            'transparency': float(cs.get('effect_transparency', 40) or 40),
            'thickness': float(cs.get('effect_thickness', 50) or 50),
            'intensity': float(cs.get('effect_intensity', 50) or 50),
            'color': cs.get('effect_color', '#000000') or '#000000',
        }
        te_style_str = style_context.effect_tags(cs.get('effect_type', 'none') or 'none',
                                        cs.get('text_color', '#ffffff') or '#ffffff',
                                        te_sd, te_shd, te_ep)
    # Build inline per-word overrides for text elements
    te_words_list = te_text.split()
    te_parts = []
    te_sep = []
    for wi2, tok2 in enumerate(te_words_list):
        wsv2 = caption_context.ws_map.get(f"{caption_context.cid}-{wi2}", {})
        if not isinstance(wsv2, dict): wsv2 = {}
        ax2 = wsv2.get('abs_x_pct'); ay2 = wsv2.get('abs_y_pct')
        if ax2 is not None and ay2 is not None and processor._is_detached_pos(ax2, ay2):
            te_sep.append((wi2, tok2, wsv2))
        else:
            ov2 = []; rv2 = []
            if wsv2.get('color'):
                ov2.append(f"\\1c{processor._hex_to_ass(wsv2['color'])}"); rv2.append(f"\\1c{te_c}")
            if wsv2.get('fontFamily'):
                wfi2 = processor._ensure_font(wsv2['fontFamily'])
                ov2.append(f"\\fn{wfi2['ass_name']}"); rv2.append(f"\\fn{te_fn}")
            if wsv2.get('fontSize'):
                ov2.append(f"\\fs{style_context.ass_font_size(wsv2['fontSize'])}"); rv2.append(f"\\fs{te_fs}")
            te_parts.append("{" + "".join(ov2) + "}" + tok2 + "{" + "".join(rv2) + "}" if ov2 else tok2)
    te_main = " ".join(te_parts)
    te_base = [f"\\fn{te_fn}", f"\\fs{te_fs}", f"\\1c{te_c}", f"\\an{te_align}", te_style_str]
    if te_bold: te_base.append("\\b1")
    if te_italic: te_base.append("\\i1")
    if te_lsp: te_base.append(f"\\fsp{te_lsp}")
    skip_p2 = False
    if caption_context.anim != 'none':
        for at2 in processor._get_animation_tags(caption_context.anim, caption_context.st, caption_context.et, te_fs, te_px, te_py):
            if at2 == '__skip_pos__': skip_p2 = True
            else: te_base.append(at2)
    if not skip_p2: te_base.append(f"\\pos({te_px},{te_py})")
    f.write(f"Dialogue: 0,{caption_context.s},{caption_context.e},Default,,0,0,0,,{{{''.join(te_base)}}}{te_main}\n")
    for _, tok3, wsv3 in te_sep:
        wx3 = int((float(wsv3.get('abs_x_pct', 50)) / 100) * style_context.video_w)
        wy3 = int((float(wsv3.get('abs_y_pct', 50)) / 100) * style_context.video_h)
        wc3 = processor._hex_to_ass(wsv3.get('color', cs.get('text_color', '#ffffff') or '#ffffff'))
        wfn3 = processor._ensure_font(wsv3['fontFamily'])['ass_name'] if wsv3.get('fontFamily') else te_fn
        wfs3 = style_context.ass_font_size(wsv3['fontSize']) if wsv3.get('fontSize') else te_fs
        pt3 = [f"\\fn{wfn3}", f"\\fs{wfs3}", f"\\1c{wc3}", f"\\an{te_align}", te_style_str, f"\\pos({wx3},{wy3})"]
        if te_bold: pt3.append("\\b1")
        if te_italic: pt3.append("\\i1")
        f.write(f"Dialogue: 1,{caption_context.s},{caption_context.e},Default,,0,0,0,,{{{''.join(pt3)}}}{tok3}\n")


def write_layout_caption(processor, f, style_context, caption_context):
    _ia, _aa = style_context.template_word_config.get(style_context.template_id, (0.3, 1.0))

    # Templates where only the CURRENT word gets a snap background box
    _CUR_BOX  = {'t-111', 't-119'}
    # Templates where ALL words get a background box
    _ALL_BOX  = {'t-102', 't-103', 't-T5', 't-26'}
    _ucb = style_context.template_id in _CUR_BOX
    _uab = style_context.template_id in _ALL_BOX

    # Per-template extra ASS tags for the currently-speaking word
    _gn = processor._hex_to_ass
    _t109_shadow_hex = style_context.secondary_hex or style_context.shadow_color_hex or "#FF2A00"
    _t109_x = max(int(((style_context.shadow_ox_v if abs(style_context.shadow_ox_v) > 0 else 3) or 3) * style_context.scale_factor), 1)
    _t109_y = max(int(((style_context.shadow_oy_v if abs(style_context.shadow_oy_v) > 0 else 3) or 3) * style_context.scale_factor), 1)
    _CEFF = {
        't-115': f'\\bord0\\shad6\\blur5\\4c{_gn(style_context.secondary_hex or "#39FF14")}',
        't-109': f'\\bord0\\shad0\\blur0\\xshad{_t109_x}\\yshad{_t109_y}\\4c{_gn(_t109_shadow_hex, 1.0)}',
        't-9':   f'\\bord0\\shad8\\blur5\\4c{_gn(style_context.shadow_color_hex if style_context.has_shadow_v else "#ff4500")}',
        't-12':  f'\\bord0\\shad8\\blur5\\4c{_gn(style_context.shadow_color_hex if style_context.has_shadow_v else "#cc0000")}',
        't-57':  f'\\bord0\\shad0\\xshad{max(int(2*style_context.scale_factor),1)}\\yshad0\\4c{_gn(style_context.shadow_color_hex if style_context.has_shadow_v else "#00ffff")}',
        't-56':  '\\u1\\bord0\\shad0',
        't-T3':  '\\u1\\bord0\\shad0',
        't-124': f'\\bord0\\shad4\\xshad{max(int(4*style_context.scale_factor),1)}\\yshad{max(int(4*style_context.scale_factor),1)}\\blur0\\4c{_gn(style_context.shadow_color_hex if style_context.has_shadow_v else "#ffffff")}',
        't-104': f'\\bord{max(int(style_context.stroke_width_v*style_context.scale_factor),1)}\\3c{_gn(style_context.secondary_hex or "#4F46FF",1.0)}\\shad3\\blur2\\4c{_gn(style_context.highlight_hex or "#FFF200",1.0)}',
        't-110': f'\\bord0\\shad{max(int(4*style_context.scale_factor),2)}\\blur3\\4c{_gn(style_context.secondary_hex or "#0066FF")}',
        't-105': f'\\bord{max(int(style_context.stroke_width_v*style_context.scale_factor),1)}\\3c{_gn(style_context.stroke_color_hex,1.0)}\\shad{max(int(style_context.shadow_blur_v*style_context.scale_factor*0.4),1)}\\4c{_gn(style_context.shadow_color_hex,1.0)}\\blur2',
    }
    _AEFF = {
        't-109': f'\\bord0\\shad0\\blur0\\xshad{_t109_x}\\yshad{_t109_y}\\4c{_gn(_t109_shadow_hex, 0.4)}',
    }
    _cur_eff = _CEFF.get(style_context.template_id, '\\bord0\\shad0')

    # Templates where active/current word text uses secondary color
    _ACT_SEC = {'t-36', 't-37'}
    _CUR_SEC = {'t-36', 't-37', 't-52', 't-112', 't-T1', 't-T4', 't-T3'}

    _pa = float(style_context.style.get('text_opacity', 1.0) or 1.0)
    _act_c   = _gn(style_context.secondary_hex if (style_context.secondary_hex and style_context.template_id in _ACT_SEC) else style_context.primary_hex, _aa * _pa)
    _inact_c = _gn(style_context.primary_hex, _ia * _pa)
    _cur_c   = _gn(style_context.secondary_hex if (style_context.secondary_hex and style_context.template_id in _CUR_SEC) else style_context.primary_hex, 1.0)

    _cur_box_bg  = _gn(style_context.secondary_hex or '#DDAA03', 1.0)
    _base_box_bg = _gn(style_context.bg_hex, style_context.bg_opacity)

    # Base tags shared by every word line (no position/color — added per word)
    _bt = f'\\fn{style_context.font_name}\\fs{style_context.scaled_size}\\an5'
    if style_context.bold_flag:      _bt += '\\b1'
    if style_context.italic_flag:    _bt += '\\i1'
    if style_context.letter_spacing: _bt += f'\\fsp{style_context.letter_spacing}'

    # Suppressor: hides outline/shadow/box from Default style (BoxStyle=1 or 3)
    _nobox = '\\bord0\\shad0\\3a&HFF&\\4a&HFF&'
    _act_eff = _AEFF.get(style_context.template_id, _nobox)

    def _wxy(lyt):
        _wx = int((float(lyt['x']) / 100) * style_context.video_w)
        _wy = int((float(lyt['y']) / 100) * style_context.video_h)
        if style_context.detected_script in style_context.indic_y_corrections:
            _wy = max(10, _wy + int(style_context.indic_y_corrections[style_context.detected_script] * style_context.video_h))
        return _wx, _wy

    _aw = [style_context.transform_text((wt2.get('word') or '').strip()) for wt2 in caption_context.words_timing]

    # Gap before first word — write all inactive words
    _fts = float(caption_context.words_timing[0].get('start', caption_context.st)) if caption_context.words_timing else caption_context.st
    if _fts > caption_context.st + 0.05 and _ia > 0.0:
        for _wi2, _wd2 in enumerate(_aw):
            if not _wd2: continue
            if _wi2 in caption_context.detached_wi: continue
            _lyt2 = caption_context.cap_word_layouts.get(_wi2)
            if not _lyt2: continue
            _wx2, _wy2 = _wxy(_lyt2)
            if _uab:
                _lt = f'{_bt}\\1c{_inact_c}\\3c{_gn(style_context.bg_hex, style_context.bg_opacity * _ia)}\\pos({_wx2},{_wy2})'
                _sn = 'WordBox'
            else:
                _lt = f'{_bt}\\1c{_inact_c}{_nobox}\\pos({_wx2},{_wy2})'
                _sn = 'Default'
            f.write(f"Dialogue: 0,{processor._fmt(caption_context.st)},{processor._fmt(_fts)},{_sn},,0,0,0,,{{{_lt}}}{_wd2}\n")

    # Per-word timing windows
    for _wi, _wt2 in enumerate(caption_context.words_timing):
        _ww = _aw[_wi]
        if not _ww: continue
        # NOTE: detached (abs-positioned) words still get a timing
        # window here — skipping it blanked ALL words for that
        # window. The word itself is excluded from rendering by
        # the detached_wi check in the inner loop below.
        _ws2 = float(_wt2.get('start', caption_context.st))
        _we2 = float(caption_context.words_timing[_wi + 1].get('start', caption_context.et) if _wi + 1 < len(caption_context.words_timing) else caption_context.et)
        if _we2 <= _ws2: _we2 = _ws2 + 0.05
        _ts_s = processor._fmt(_ws2)
        _ts_e = processor._fmt(_we2)

        for _wi2, _wd2 in enumerate(_aw):
            if not _wd2: continue
            if _wi2 in caption_context.detached_wi: continue
            _lyt2 = caption_context.cap_word_layouts.get(_wi2)
            if not _lyt2: continue
            _wx2, _wy2 = _wxy(_lyt2)
            _pt = f'\\pos({_wx2},{_wy2})'

            if _wi2 < _wi:
                # Already spoken — active color
                if _uab:
                    _lt = f'{_bt}\\1c{_act_c}\\3c{_base_box_bg}{_pt}'
                    _sn = 'WordBox'
                else:
                    _lt = f'{_bt}\\1c{_act_c}{_act_eff}{_pt}'
                    _sn = 'Default'
                f.write(f"Dialogue: 0,{_ts_s},{_ts_e},{_sn},,0,0,0,,{{{_lt}}}{_wd2}\n")

            elif _wi2 == _wi:
                # Currently speaking — template effects + current color
                if _ucb or _uab:
                    _lt = f'{_bt}\\1c{_gn(style_context.primary_hex,1.0)}\\3c{_cur_box_bg}{_pt}'
                    _sn = 'WordBox'
                else:
                    _lt = f'{_bt}\\1c{_cur_c}\\3a&HFF&\\4a&HFF&{_cur_eff}{_pt}'
                    _sn = 'Default'
                f.write(f"Dialogue: 2,{_ts_s},{_ts_e},{_sn},,0,0,0,,{{{_lt}}}{_wd2}\n")

            else:
                # Not yet spoken — inactive
                if _ia == 0.0:
                    continue
                if _uab:
                    _lt = f'{_bt}\\1c{_inact_c}\\3c{_gn(style_context.bg_hex, style_context.bg_opacity * _ia)}{_pt}'
                    _sn = 'WordBox'
                else:
                    _lt = f'{_bt}\\1c{_inact_c}{_nobox}{_pt}'
                    _sn = 'Default'
                f.write(f"Dialogue: 0,{_ts_s},{_ts_e},{_sn},,0,0,0,,{{{_lt}}}{_wd2}\n")

    # Separately-positioned (dragged) words — always rendered
    for _, _tok_p, _ws_p in caption_context.positioned:
        _wx_p = int((float(_ws_p.get('abs_x_pct', 50)) / 100) * style_context.video_w)
        _wy_p = int((float(_ws_p.get('abs_y_pct', 75)) / 100) * style_context.video_h)
        _wc_p = _gn(_ws_p.get('color', style_context.primary_hex) or style_context.primary_hex, float(style_context.style.get('text_opacity', 1.0) or 1.0))
        _wfn_p = processor._ensure_font(_ws_p['fontFamily'])['ass_name'] if _ws_p.get('fontFamily') else style_context.font_name
        _wfs_p = style_context.ass_font_size(_ws_p['fontSize']) if _ws_p.get('fontSize') else style_context.scaled_size
        _weff_t = _ws_p.get('effectType', 'none') or 'none'
        if _weff_t != 'none':
            _weff_p = {'offset': float(_ws_p.get('effectOffset', 50) or 50), 'direction': float(_ws_p.get('effectDirection', -45) or -45), 'blur': float(_ws_p.get('effectBlur', 50) or 50), 'transparency': float(_ws_p.get('effectTransparency', 40) or 40), 'thickness': float(_ws_p.get('effectThickness', 50) or 50), 'intensity': float(_ws_p.get('effectIntensity', 50) or 50), 'color': _ws_p.get('effectColor', '#000000') or '#000000'}
            _weff_str = style_context.effect_tags(_weff_t, _ws_p.get('color', style_context.primary_hex) or style_context.primary_hex, (False, 0, '#000000'), (False, 0, 0, 0, '#000000'), _weff_p)
        else:
            _weff_str = '\\bord0\\shad0'
        _pt_p = [f"\\fn{_wfn_p}", f"\\fs{_wfs_p}", f"\\1c{_wc_p}", "\\an5", _weff_str, f"\\pos({_wx_p},{_wy_p})"]
        if style_context.bold_flag or str(_ws_p.get('fontWeight', '')) in ('bold', '700', '800', '900'): _pt_p.append("\\b1")
        if style_context.italic_flag: _pt_p.append("\\i1")
        if _ws_p.get('isEmphasis'): _pt_p.append("\\fscx115\\fscy115\\blur0.5")
        f.write(f"Dialogue: 1,{caption_context.s},{caption_context.e},Default,,0,0,0,,{{{''.join(_pt_p)}}}{_tok_p}\n")



def prepare_regular_caption(processor, style_context, caption_context) -> AssRegularContext:
    text = style_context.transform_text(caption_context.raw_text).replace('\n', '\\N')

    # Split into tokens; words with abs_x/y are rendered as separate Dialogue lines
    tokens = re.split(r'(\s+)', text)
    word_idx = 0
    inline_parts = []
    positioned = []   # (word_idx, token, ws_dict) — rebuilt from tokens for legacy path

    for tok in tokens:
        if not tok.strip():
            inline_parts.append(tok)
            continue
        ws = caption_context.ws_map.get(f"{caption_context.cid}-{word_idx}", {})
        if not isinstance(ws, dict): ws = {}
        ax = ws.get('abs_x_pct'); ay = ws.get('abs_y_pct')
        if ax is not None and ay is not None and processor._is_detached_pos(ax, ay):
            positioned.append((word_idx, tok, ws))
        else:
            ov = []; rv = []
            if ws.get('color'):
                ov.append(f"\\1c{processor._hex_to_ass(ws['color'])}"); rv.append(f"\\1c{style_context.primary_ass}")
            if ws.get('fontFamily'):
                wfi = processor._ensure_font(ws['fontFamily'])
                ov.append(f"\\fn{wfi['ass_name']}"); rv.append(f"\\fn{style_context.font_name}")
            if ws.get('fontSize'):
                ov.append(f"\\fs{style_context.ass_font_size(ws['fontSize'])}"); rv.append(f"\\fs{style_context.scaled_size}")
            if str(ws.get('fontWeight', '')) in ('bold', '700', '800', '900'):
                ov.append("\\b1"); rv.append(f"\\b{style_context.bold_flag}")
            if ws.get('fontStyle') == 'italic':
                ov.append("\\i1"); rv.append(f"\\i{style_context.italic_flag}")
            if ws.get('isEmphasis'):
                ov.append("\\fscx115\\fscy115\\blur0.5"); rv.append("\\fscx100\\fscy100\\blur0")
            inline_parts.append("{" + "".join(ov) + "}" + tok + "{" + "".join(rv) + "}" if ov else tok)
        word_idx += 1

    main_text = "".join(inline_parts).strip()

    # Base override tags for this caption's Dialogue line
    tags = [f"\\fn{style_context.font_name}", f"\\fs{style_context.scaled_size}", f"\\1c{style_context.primary_ass}", f"\\an{style_context.ass_align}"]
    if style_context.bold_flag: tags.append("\\b1")
    if style_context.italic_flag: tags.append("\\i1")
    if style_context.letter_spacing: tags.append(f"\\fsp{style_context.letter_spacing}")
    if style_context.global_eff: tags.append(style_context.global_eff)

    # Animation tags
    skip_pos = False
    if caption_context.anim != 'none':
        for at in processor._get_animation_tags(caption_context.anim, caption_context.st, caption_context.et, style_context.scaled_size, style_context.pos_x, style_context.pos_y):
            if at == '__skip_pos__': skip_pos = True
            else: tags.append(at)
    if not skip_pos: tags.append(f"\\pos({style_context.pos_x},{style_context.pos_y})")


    return AssRegularContext(
        main_text=main_text,
        positioned=positioned,
        tags=tags,
    )


def write_template_karaoke(processor, f, style_context, caption_context):
    # This must match in the ASS output.
    used_template_karaoke = False
    if style_context.template_id and caption_context.words_timing:
        _ia_fb, _aa_fb = style_context.template_word_config.get(style_context.template_id, (0.3, 1.0))
        _pa_fb = float(style_context.style.get('text_opacity', 1.0) or 1.0)
        _gn_fb = processor._hex_to_ass
        _t109_shadow_hex_fb = style_context.secondary_hex or style_context.shadow_color_hex or "#FF2A00"
        _t109_x_fb = max(int(((style_context.shadow_ox_v if abs(style_context.shadow_ox_v) > 0 else 3) or 3) * style_context.scale_factor), 1)
        _t109_y_fb = max(int(((style_context.shadow_oy_v if abs(style_context.shadow_oy_v) > 0 else 3) or 3) * style_context.scale_factor), 1)

        # Color logic matching the primary word-layout path
        _ACT_SEC_FB = {'t-36', 't-37'}
        _CUR_SEC_FB = {'t-36', 't-37', 't-52', 't-112', 't-T1', 't-T4', 't-T3'}
        _act_c_fb  = _gn_fb(style_context.secondary_hex if (style_context.secondary_hex and style_context.template_id in _ACT_SEC_FB) else style_context.primary_hex, _aa_fb * _pa_fb)
        _inact_c_fb = _gn_fb(style_context.primary_hex, _ia_fb * _pa_fb)
        _cur_c_fb  = _gn_fb(style_context.secondary_hex if (style_context.secondary_hex and style_context.template_id in _CUR_SEC_FB) else style_context.primary_hex, 1.0)

        all_tpl_words = [
            '' if _twi in caption_context.detached_wi else style_context.transform_text((wt.get('word') or '').strip())
            for _twi, wt in enumerate(caption_context.words_timing)
        ]

        # Build tpl_tag WITHOUT global_eff — effects go per-word-state below.
        # For bg templates global_eff is already '' (has_bg + effect_type=none).
        tpl_base = [f"\\fn{style_context.font_name}", f"\\fs{style_context.scaled_size}", f"\\an{style_context.ass_align}"]
        if style_context.bold_flag: tpl_base.append("\\b1")
        if style_context.italic_flag: tpl_base.append("\\i1")
        if style_context.letter_spacing: tpl_base.append(f"\\fsp{style_context.letter_spacing}")
        # Only include global_eff for bg templates (where it's already empty)
        if style_context.has_bg and style_context.global_eff: tpl_base.append(style_context.global_eff)
        tpl_base.append(f"\\pos({style_context.pos_x},{style_context.pos_y})")
        tpl_tag = "".join(tpl_base)

        # Per-template CURRENT-word effects (mirrors primary path _CEFF)
        _CEFF_FB = {
            't-115': f'\\bord0\\shad6\\blur5\\4c{_gn_fb(style_context.secondary_hex or "#39FF14")}',
            't-109': f'\\bord0\\shad0\\blur0\\xshad{_t109_x_fb}\\yshad{_t109_y_fb}\\4c{_gn_fb(_t109_shadow_hex_fb, 1.0)}',
            't-9':   f'\\bord0\\shad8\\blur5\\4c{_gn_fb(style_context.shadow_color_hex if style_context.has_shadow_v else "#ff4500")}',
            't-12':  f'\\bord0\\shad8\\blur5\\4c{_gn_fb(style_context.shadow_color_hex if style_context.has_shadow_v else "#cc0000")}',
            't-57':  f'\\bord0\\shad0\\xshad{max(int(2*style_context.scale_factor),1)}\\yshad0\\4c{_gn_fb(style_context.shadow_color_hex if style_context.has_shadow_v else "#00ffff")}',
            't-56':  '\\u1\\bord0\\shad0',
            't-T3':  '\\u1\\bord0\\shad0',
            't-124': f'\\bord0\\shad4\\xshad{max(int(4*style_context.scale_factor),1)}\\yshad{max(int(4*style_context.scale_factor),1)}\\blur0\\4c{_gn_fb(style_context.shadow_color_hex if style_context.has_shadow_v else "#ffffff")}',
            't-104': f'\\bord{max(int(style_context.stroke_width_v*style_context.scale_factor),1)}\\3c{_gn_fb(style_context.secondary_hex or "#4F46FF",1.0)}\\shad3\\blur2\\4c{_gn_fb(style_context.highlight_hex or "#FFF200",1.0)}',
            't-110': f'\\bord0\\shad{max(int(4*style_context.scale_factor),2)}\\blur3\\4c{_gn_fb(style_context.secondary_hex or "#0066FF")}',
            't-105': f'\\bord{max(int(style_context.stroke_width_v*style_context.scale_factor),1)}\\3c{_gn_fb(style_context.stroke_color_hex,1.0)}\\shad{max(int(style_context.shadow_blur_v*style_context.scale_factor*0.4),1)}\\4c{_gn_fb(style_context.shadow_color_hex,1.0)}\\blur2',
        }
        _AEFF_FB = {
            't-109': f'\\bord0\\shad0\\blur0\\xshad{_t109_x_fb}\\yshad{_t109_y_fb}\\4c{_gn_fb(_t109_shadow_hex_fb, 0.4)}',
        }
        _cur_eff_fb = _CEFF_FB.get(style_context.template_id, '\\bord0\\shad0')
        # Suppress effects for non-current words (no glow/shadow bleed)
        _noeff_fb = '\\bord0\\shad0\\blur0'
        _act_eff_fb = _AEFF_FB.get(style_context.template_id, _noeff_fb)

        def _tpl_line(w_s, w_e, cur_wi):
            if w_e <= w_s: return
            parts = []
            for j, tw in enumerate(all_tpl_words):
                if not tw: continue
                if cur_wi is None:
                    # Gap before first word — all inactive, no effects
                    parts.append(f"{{\\1c{_inact_c_fb}{_noeff_fb}}}{tw}")
                elif j < cur_wi:
                    # Already spoken — active color, suppress template effects
                    if style_context.has_bg:
                        parts.append(f"{{\\1c{_act_c_fb}}}{tw}")
                    else:
                        parts.append(f"{{\\1c{_act_c_fb}{_act_eff_fb}}}{tw}")
                elif j == cur_wi:
                    # Currently speaking — template-specific effects
                    if style_context.has_bg:
                        parts.append(f"{{\\1c{_cur_c_fb}}}{tw}")
                    else:
                        parts.append(f"{{\\1c{_cur_c_fb}{_cur_eff_fb}}}{tw}")
                else:
                    # Not yet spoken — inactive, no effects
                    parts.append(f"{{\\1c{_inact_c_fb}{_noeff_fb}}}{tw}")
            f.write(f"Dialogue: 2,{processor._fmt(w_s)},{processor._fmt(w_e)},Default,,0,0,0,,{{{tpl_tag}}}{' '.join(parts)}\n")

        # Gap before first word → all inactive
        first_st = float(caption_context.words_timing[0].get('start', caption_context.st))
        if first_st > caption_context.st + 0.05:
            _tpl_line(caption_context.st, first_st, None)

        # Per-word windows (extended to fill inter-word gaps)
        for wi, wt in enumerate(caption_context.words_timing):
            ww = style_context.transform_text((wt.get('word') or '').strip())
            if not ww: continue
            # Detached words keep their timing window (they are blanked
            # inside _tpl_line via all_tpl_words) so the rest of the
            # sentence never disappears during that word's slot.
            w_s2 = float(wt.get('start', caption_context.st))
            w_e2 = float(wt.get('end', caption_context.et))
            if w_e2 <= w_s2: continue
            w_e2 = float(caption_context.words_timing[wi + 1].get('start', w_e2)) if wi + 1 < len(caption_context.words_timing) else caption_context.et
            if w_e2 <= w_s2: w_e2 = w_s2 + 0.05
            _tpl_line(w_s2, w_e2, wi)

        used_template_karaoke = True


    return used_template_karaoke


def write_standard_caption(processor, f, style_context, caption_context, regular_context):
    if not style_context.show_inactive and caption_context.words_timing:
        for wi, wt in enumerate(caption_context.words_timing):
            ww = style_context.transform_text(wt.get('word', '').strip())
            if not ww: continue
            w_st = float(wt.get('start', caption_context.st)); w_et = float(wt.get('end', caption_context.et))
            if w_et <= w_st: continue
            ws2 = caption_context.ws_map.get(f"{caption_context.cid}-{wi}", {})
            if not isinstance(ws2, dict): ws2 = {}
            if wi in caption_context.detached_wi: continue
            w_tags = list(regular_context.tags)
            if ws2.get('color'):
                w_tags = [t for t in w_tags if not t.startswith('\\1c')]
                w_tags.insert(2, f"\\1c{processor._hex_to_ass(ws2['color'])}")
            if ws2.get('fontFamily'):
                wfi3 = processor._ensure_font(ws2['fontFamily'])
                w_tags = [t for t in w_tags if not t.startswith('\\fn')]
                w_tags.insert(0, f"\\fn{wfi3['ass_name']}")
            if ws2.get('fontSize'):
                w_tags = [t for t in w_tags if not t.startswith('\\fs')]
                w_tags.insert(1, f"\\fs{style_context.ass_font_size(ws2['fontSize'])}")
            f.write(f"Dialogue: 0,{processor._fmt(w_st)},{processor._fmt(w_et)},Default,,0,0,0,,{{{''.join(w_tags)}}}{ww}\n")
    elif regular_context.main_text:
        f.write(f"Dialogue: 0,{caption_context.s},{caption_context.e},Default,,0,0,0,,{{{''.join(regular_context.tags)}}}{regular_context.main_text}\n")

    # Positioned (emphasis/dragged) words as separate Dialogue lines (always)


def write_positioned_words(processor, f, style_context, caption_context, regular_context):
    for _, tok4, ws4 in regular_context.positioned:
        wx4 = int((float(ws4.get('abs_x_pct', 50)) / 100) * style_context.video_w)
        wy4 = int((float(ws4.get('abs_y_pct', 75)) / 100) * style_context.video_h)
        wc4 = processor._hex_to_ass(ws4.get('color', style_context.primary_hex) or style_context.primary_hex,
                               float(style_context.style.get('text_opacity', 1.0) or 1.0))
        wfn4 = processor._ensure_font(ws4['fontFamily'])['ass_name'] if ws4.get('fontFamily') else style_context.font_name
        wfs4 = style_context.ass_font_size(ws4['fontSize']) if ws4.get('fontSize') else style_context.scaled_size
        # Per-word effects from floating popup (effectType, effectBlur, etc.)
        w_eff_type = ws4.get('effectType', 'none') or 'none'
        if w_eff_type != 'none':
            w_eff_props = {
                'offset': float(ws4.get('effectOffset', 50) or 50),
                'direction': float(ws4.get('effectDirection', -45) or -45),
                'blur': float(ws4.get('effectBlur', 50) or 50),
                'transparency': float(ws4.get('effectTransparency', 40) or 40),
                'thickness': float(ws4.get('effectThickness', 50) or 50),
                'intensity': float(ws4.get('effectIntensity', 50) or 50),
                'color': ws4.get('effectColor', '#000000') or '#000000',
            }
            w_eff_str = style_context.effect_tags(w_eff_type, ws4.get('color', style_context.primary_hex) or style_context.primary_hex,
                                         (False, 0, '#000000'), (False, 0, 0, 0, '#000000'), w_eff_props)
        else:
            w_eff_str = '\\bord0\\shad0'
        pt4 = [f"\\fn{wfn4}", f"\\fs{wfs4}", f"\\1c{wc4}", "\\an5", w_eff_str]
        if str(ws4.get('fontWeight', '')) in ('bold', '700') or style_context.bold_flag: pt4.append("\\b1")
        if style_context.italic_flag: pt4.append("\\i1")
        if ws4.get('isEmphasis'): pt4.append("\\fscx115\\fscy115\\blur0.5")
        # Per-word animation from floating popup
        w_anim = ws4.get('animation', 'none') or 'none'
        skip_pos_w = False
        if w_anim != 'none':
            for at in processor._get_animation_tags(w_anim, caption_context.st, caption_context.et, wfs4, wx4, wy4):
                if at == '__skip_pos__':
                    skip_pos_w = True
                else:
                    pt4.append(at)
        if not skip_pos_w:
            pt4.append(f"\\pos({wx4},{wy4})")
        f.write(f"Dialogue: 1,{caption_context.s},{caption_context.e},Default,,0,0,0,,{{{''.join(pt4)}}}{tok4}\n")



def write_highlight_karaoke(processor, f, style_context, caption_context):
    h_ass = processor._hex_to_ass(style_context.highlight_hex, 1.0)
    h_bord = max(int(style_context.bg_padding * style_context.scale_factor * style_context.bord_factor * style_context.bg_h_mult), 2) if style_context.has_bg else max(int(style_context.scaled_size * 0.08), 2)
    all_ww = [
        '' if _hwi in caption_context.detached_wi else style_context.transform_text(wt.get('word', '').strip())
        for _hwi, wt in enumerate(caption_context.words_timing)
    ]
    h_base = [f"\\fn{style_context.font_name}", f"\\fs{style_context.scaled_size}", f"\\an{style_context.ass_align}", f"\\pos({style_context.pos_x},{style_context.pos_y})"]
    if style_context.bold_flag: h_base.append("\\b1")
    if style_context.italic_flag: h_base.append("\\i1")
    for wi, wt in enumerate(caption_context.words_timing):
        ww = style_context.transform_text(wt.get('word', '').strip())
        if not ww: continue
        w_st2 = float(wt.get('start', caption_context.st)); w_et2 = float(wt.get('end', caption_context.et))
        if w_et2 <= w_st2: continue
        ws5 = caption_context.ws_map.get(f"{caption_context.cid}-{wi}", {})
        if not isinstance(ws5, dict): ws5 = {}
        if ws5.get('isEmphasis') or wi in caption_context.detached_wi: continue
        parts_h = []
        for j, tw in enumerate(all_ww):
            if not tw: continue
            if j == wi:
                parts_h.append(f"{{\\1c{h_ass}\\3c{h_ass}\\4c{h_ass}\\bord{h_bord}\\shad0}}{tw}")
            else:
                parts_h.append(f"{{\\1c{style_context.primary_ass}\\3c{style_context.outline_c}\\4c{style_context.back_c}\\bord{style_context.outline_size}\\shad{style_context.shadow_size}}}{tw}")
        h_str = "{" + "".join(h_base) + "}" + " ".join(parts_h)
        f.write(f"Dialogue: 2,{processor._fmt(w_st2)},{processor._fmt(w_et2)},Default,,0,0,0,,{h_str}\n")
