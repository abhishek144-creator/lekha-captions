"""ASS (Advanced SubStation Alpha) subtitle generation for FFmpeg burn-in.

Mixed into processor.VideoProcessor; methods use its instance state.
"""

import math
import os
import re

try:
    from .processor_fonts import detect_text_script, resolve_script_font_family
except ImportError:  # Direct execution from backend/ remains supported.
    from processor_fonts import detect_text_script, resolve_script_font_family


class AssSubtitleMixin:
    @staticmethod
    def _escape_ass_text(value):
        """Neutralize libass override syntax while preserving visible text."""
        return (
            str(value or "")
            .replace("\\", "＼")
            .replace("{", "｛")
            .replace("}", "｝")
            .replace("\r", "")
        )

    @staticmethod
    def _is_detached_pos(abs_x_pct, abs_y_pct):
        """Mirror the editor's isWordDetached(): abs 0,0 means the word's
        position was RESET, not dragged to the top-left corner."""
        try:
            return abs(float(abs_x_pct or 0)) > 0.01 or abs(float(abs_y_pct or 0)) > 0.01
        except (TypeError, ValueError):
            return False

    def _create_styled_ass(self, captions, style, font_info, video_w, video_h, word_layouts=None):
        """
        Generate an ASS subtitle file for FFmpeg burning.

        COMPATIBILITY PATH (when trusted internal word_layouts are supplied):
          Each word is rendered as an independent Dialogue line at the supplied position.
          Gives pixel-accurate positioning and per-word effects matching the CSS preview.

        FALLBACK PATH (no template or no word_layouts):
          Position-based with inline per-word style overrides (legacy behaviour).
        """
        import uuid as _uuid
        ass_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"_tmp_{_uuid.uuid4().hex[:8]}.ass")

        # ── Scale factor: preview coords → video coords ────────────────────
        # Same reference as the DOM template renderer (render_template_overlay.mjs
        # exportCssScale): style lengths are CSS px on a 360px-wide preview, the
        # phone editor's 360x640 frame for 9:16. The server strips browser
        # preview sizes, so preview_width is normally absent. A different
        # reference here made a caption change size once it was animated.
        base_size = int(style.get('font_size', 18))
        try:
            preview_w = float(style.get('preview_width') or 0)
        except (TypeError, ValueError):
            preview_w = 0.0
        scale_factor = max(1.0, min(8.0, video_w / (preview_w if preview_w > 0 else 360.0)))
        preview_font_px = 0.0
        try:
            preview_font_px = float(style.get('preview_template_font_px') or 0)
        except (TypeError, ValueError):
            preview_font_px = 0.0
        font_size_source = preview_font_px if preview_font_px > 0 else base_size

        # ── Effect/stroke/shadow override tag builder ──────────────────────
        def _get_effect_tags(eff_type, base_color_hex, stroke_data, shadow_data, eff_props):
            base_c_ass = self._hex_to_ass(base_color_hex)
            tags = []
            eff_offset = eff_props.get('offset', 50)
            eff_dir = eff_props.get('direction', -45)
            eff_blur = eff_props.get('blur', 50)
            eff_trans = eff_props.get('transparency', 40)
            eff_thick = eff_props.get('thickness', 50)
            eff_intens = eff_props.get('intensity', 50)
            eff_color = eff_props.get('color', '#000000')
            dist = (eff_offset / 100.0) * 15 * scale_factor
            ox = round(math.cos(math.radians(eff_dir)) * dist, 1)
            oy = round(math.sin(math.radians(eff_dir)) * dist, 1)
            b_px = round((eff_blur / 100.0) * 20 * scale_factor, 1)
            alpha_frac = max(0, min(1, 1.0 - (eff_trans / 100.0)))
            eff_c_ass = self._hex_to_ass(eff_color, alpha_frac)
            if eff_type == 'shadow':
                tags.extend([f"\\bord0", f"\\shad4", f"\\xshad{ox}", f"\\yshad{oy}", f"\\blur{b_px}", f"\\4c{eff_c_ass}"])
            elif eff_type == 'lift':
                lift_b = round((eff_intens / 100.0) * 30 * scale_factor, 1)
                lift_c_ass = self._hex_to_ass('#000000', (eff_intens / 100.0) * 0.8)
                tags.extend([f"\\bord0", f"\\shad4", f"\\xshad0", f"\\yshad{round(15*scale_factor, 1)}", f"\\blur{lift_b}", f"\\4c{lift_c_ass}"])
            elif eff_type == 'hollow':
                stroke_px = max(1, round((eff_thick / 100.0) * 4 * scale_factor, 1))
                tags.extend([f"\\1a&HFF&", f"\\bord{stroke_px}", f"\\3c{self._hex_to_ass(eff_color)}", f"\\shad0"])
            elif eff_type == 'splice':
                stroke_px = max(1, round((eff_thick / 100.0) * 4 * scale_factor, 1))
                tags.extend([f"\\1a&HFF&", f"\\bord{stroke_px}", f"\\3c{base_c_ass}", f"\\shad4", f"\\xshad{ox}", f"\\yshad{oy}", f"\\4c{self._hex_to_ass(eff_color)}"])
            elif eff_type == 'outline':
                stroke_px = max(1, round((eff_thick / 100.0) * 8 * scale_factor, 1))
                tags.extend([f"\\bord{stroke_px}", f"\\3c{self._hex_to_ass(eff_color)}", f"\\shad0"])
            elif eff_type == 'echo':
                tags.extend([f"\\bord0", f"\\shad4", f"\\xshad{ox}", f"\\yshad{oy}", f"\\4c{eff_c_ass}"])
            elif eff_type == 'neon':
                glow_px = round((eff_intens / 100.0) * 20 * scale_factor, 1)
                tags.extend([f"\\bord{b_px}", f"\\3c{self._hex_to_ass(eff_color)}", f"\\blur{glow_px}", f"\\shad0"])
            elif stroke_data[0]:
                tags.extend([f"\\bord{max(int(stroke_data[1] * scale_factor), 1)}", f"\\3c{self._hex_to_ass(stroke_data[2], 1.0)}"])
                if shadow_data[0]:
                    sv = max(int(shadow_data[1] * scale_factor * 0.5), 1)
                    tags.extend([f"\\shad{sv}", f"\\4c{self._hex_to_ass(shadow_data[4], 1.0)}"])
                    if shadow_data[2]: tags.append(f"\\xshad{int(shadow_data[2] * scale_factor)}")
                    if shadow_data[3]: tags.append(f"\\yshad{int(shadow_data[3] * scale_factor)}")
                else:
                    tags.append(f"\\shad0")
            elif shadow_data[0]:
                tags.extend([f"\\bord0", f"\\shad{max(int(shadow_data[1] * scale_factor * 0.5), 1)}", f"\\4c{self._hex_to_ass(shadow_data[4], 1.0)}"])
                if shadow_data[2]: tags.append(f"\\xshad{int(shadow_data[2] * scale_factor)}")
                if shadow_data[3]: tags.append(f"\\yshad{int(shadow_data[3] * scale_factor)}")
            else:
                tags.extend([f"\\bord0", f"\\shad0"])
            return "".join(tags)

        # ── Font ───────────────────────────────────────────────────────────
        font_name = font_info['ass_name']
        ass_font_info = font_info

        # ── Script detection + script font override ───────────────────────
        # Pick the face the editor and DOM renderer use for this text
        # (scriptFontResolver.js, ported as resolve_script_font_family), so a
        # static caption keeps its font once it is animated.
        all_text = " ".join(c.get('text', '') for c in captions)
        detected_script = self._detect_script(all_text)
        requested_family = str(style.get('font_family') or font_name).strip()
        script_family = resolve_script_font_family(requested_family, all_text)
        if script_family.lower() not in {requested_family.lower(), font_name.lower()}:
            script_font_info = self._ensure_font(script_family)
            if (
                script_font_info.get('ass_name', '').lower() != script_family.lower()
                or self._font_lacks_text_glyphs(script_font_info, all_text)
            ):
                # Could not get a usable file for the resolver's face (offline,
                # unknown, or a Latin-only subset): use the bundled per-script
                # face rather than let libass substitute an arbitrary one.
                script_font_info = (self._ensure_indic_font(detected_script) if detected_script else None) or script_font_info
            print(f"[ASS] Font '{font_name}' -> {script_font_info['ass_name']} for {detect_text_script(all_text)} text")
            font_name = script_font_info['ass_name']
            ass_font_info = script_font_info

        # ASS Fontsize is the face's cell height (winAscent + winDescent), CSS
        # font-size is its em square: convert so glyphs match the DOM renderer.
        cell_height_ratio = self._ass_cell_height_ratio(ass_font_info)

        def _ass_fs(css_px):
            return max(int(round(float(css_px) * scale_factor * cell_height_ratio)), 20)

        scaled_size = _ass_fs(font_size_source)
        print(f"[ASS] font={font_name!r} size={scaled_size} scale_factor={scale_factor:.2f} cell_ratio={cell_height_ratio:.3f}")
        bord_factor = 0.65 if detected_script else 0.85

        # ── Per-template word-state alpha config ──────────────────────────
        # (inactive_alpha, active_alpha)
        # inactive = not yet spoken, active = already spoken, current = now speaking
        TEMPLATE_WORD_CONFIG = {
            # Transparent inactive (word-reveal: only spoken words visible)
            't-106': (0.0, 1.0),  # Iman
            't-105': (0.0, 1.0),  # Daze
            't-52':  (0.0, 1.0),  # Light Streak
            't-124': (0.0, 1.0),  # Ghost Echo
            't-104': (0.0, 1.0),  # Pulse
            't-37':  (0.0, 1.0),  # Wipe Mask
            't-36':  (0.0, 1.0),  # Color Flash
            't-112': (0.15, 1.0), # Pink Gradient
            # Dim inactive (unspoken words dimmed)
            't-16':  (0.2, 0.85), # Ghost Focus
            't-9':   (0.3, 0.85), # Fire Words
            't-12':  (0.2, 1.0),  # Horror
            't-26':  (0.25, 1.0), # Bold Stroke
            't-102': (0.5, 1.0),  # Clarity
            't-103': (0.45, 1.0), # Nightfall
            't-110': (0.3, 1.0),  # Glow Dot
            't-119': (0.3, 1.0),  # Gradient Box
            't-95':  (0.15, 1.0), # Speed Lines
            't-T1':  (0.15, 1.0), # Stack & Flow
            't-T3':  (0.3, 1.0),  # Underline Fade
            't-T4':  (0.3, 1.0),  # Study With Me
            # All words always fully visible (current word gets secondary color)
            't-111': (1.0, 1.0),  # Red Tape
            't-115': (1.0, 1.0),  # Green Neon Pulse
            't-109': (1.0, 1.0),  # 3D Shadow
            't-T5':  (1.0, 1.0),  # Sentence Box
            't-57':  (1.0, 1.0),  # VHS Glitch
            # TemplatesTab2 templates (t01-t35)
            # wbw-rise/wbw-slide: word-reveal (inactive transparent)
            't01': (0.0, 1.0),  # Bebas Neue wbw-rise
            't03': (0.0, 1.0),  # Darker Grotesque wbw-rise
            't05': (0.0, 1.0),  # Dela Gothic One wbw-rise
            't06': (0.0, 1.0),  # Unbounded wbw-rise
            't07': (0.0, 1.0),  # Space Mono wbw-rise
            't08': (0.0, 1.0),  # Bodoni Moda wbw-rise
            't09': (0.0, 1.0),  # Crimson Text wbw-rise
            't10': (0.0, 1.0),  # Unbounded wbw-rise
            't11': (0.0, 1.0),  # Overpass Mono wbw-slide
            't13': (0.0, 1.0),  # Abril Fatface wbw-rise
            't14': (0.0, 1.0),  # Permanent Marker wbw-slide
            't16': (0.0, 1.0),  # Staatliches wbw-rise
            't17': (0.0, 1.0),  # Cinzel wbw-slide
            't18': (0.0, 1.0),  # Righteous wbw-rise
            't19': (0.0, 1.0),  # Bitter wbw-rise
            't21': (0.0, 1.0),  # Space Mono wbw-rise
            't23': (0.0, 1.0),  # Archivo Black wbw-rise
            't24': (0.0, 1.0),  # DM Serif Display wbw-rise
            't25': (0.0, 1.0),  # IBM Plex Mono wbw-slide
            't26': (0.0, 1.0),  # Bebas Neue wbw-rise
            't28': (0.0, 1.0),  # Unbounded wbw-rise
            't29': (0.0, 1.0),  # Cinzel wbw-rise
            't30': (0.0, 1.0),  # Silkscreen wbw-slide
            't31': (0.0, 1.0),  # Bebas Neue wbw-rise
            't33': (0.0, 1.0),  # Noto Sans wbw-rise
            't34': (0.0, 1.0),  # Playfair Display wbw-rise
            't35': (0.0, 1.0),  # Cinzel wbw-rise
            # Full-sentence / karaoke templates (all words visible)
            't02': (1.0, 1.0),  # Cormorant Garamond plain-s
            't04': (1.0, 1.0),  # Libre Baskerville karaoke
            't12': (1.0, 1.0),  # Lora plain-s
            't15': (1.0, 1.0),  # Questrial karaoke
            't20': (1.0, 1.0),  # Cormorant Garamond plain-s
            't22': (1.0, 1.0),  # Playfair Display plain-s
            't27': (1.0, 1.0),  # Caveat plain-s
            't32': (1.0, 1.0),  # Questrial plain-s
        }

        # ── Global style values ────────────────────────────────────────────
        def _num(value, default):
            if value is None or value == "":
                return default
            try:
                return float(value)
            except (TypeError, ValueError):
                return default

        primary_hex = style.get('text_color', '#FFFFFF') or '#FFFFFF'
        primary_ass = self._hex_to_ass(primary_hex, _num(style.get('text_opacity'), 1.0))
        has_bg = bool(style.get('has_background', False))
        bg_hex = style.get('background_color', '#000000') or '#000000'
        bg_opacity = _num(style.get('background_opacity'), 0.7)
        bg_ass = self._hex_to_ass(bg_hex, bg_opacity)
        bg_padding = _num(style.get('background_padding'), 6)
        bg_h_mult = _num(style.get('background_h_multiplier'), 0.99)
        has_stroke = bool(style.get('has_stroke', False))
        stroke_color_hex = style.get('stroke_color', '#000000') or '#000000'
        stroke_width_v = _num(style.get('stroke_width'), 1)
        has_shadow_v = bool(style.get('has_shadow', False))
        shadow_color_hex = style.get('shadow_color', '#000000') or '#000000'
        shadow_blur_v = _num(style.get('shadow_blur'), 4)
        shadow_ox_v = _num(style.get('shadow_offset_x'), 0)
        shadow_oy_v = _num(style.get('shadow_offset_y'), 2)
        bold_flag = 1 if (style.get('is_bold', False) or str(style.get('font_weight', '500') or '500') in ('bold', '700', '800', '900')) else 0
        italic_flag = 1 if (style.get('font_style', 'normal') or 'normal') == 'italic' else 0
        letter_spacing = int(float(style.get('letter_spacing', 0) or 0) * scale_factor)
        is_caps = bool(style.get('is_caps', False))
        text_case = (style.get('text_case', 'none') or 'none')
        text_align = (style.get('text_align', 'center') or 'center')
        ass_align = {'left': 4, 'center': 5, 'right': 6}.get(text_align, 5)
        highlight_hex = (style.get('highlight_color', '') or '').strip()
        secondary_hex = (style.get('secondary_color', '') or '').strip()
        template_id = (style.get('template_id', '') or '').strip()
        show_inactive = style.get('show_inactive', True)
        if show_inactive is None: show_inactive = True
        effect_type = (style.get('effect_type', 'none') or 'none')
        g_eff_props = {
            'offset': _num(style.get('effect_offset'), 50),
            'direction': _num(style.get('effect_direction'), -45),
            'blur': _num(style.get('effect_blur'), 50),
            'transparency': _num(style.get('effect_transparency'), 40),
            'thickness': _num(style.get('effect_thickness'), 50),
            'intensity': _num(style.get('effect_intensity'), 50),
            'color': style.get('effect_color', '#000000') or '#000000',
        }
        g_stroke_data = (has_stroke and not has_bg, stroke_width_v, stroke_color_hex)
        g_shadow_data = (has_shadow_v and not has_bg, shadow_blur_v, shadow_ox_v, shadow_oy_v, shadow_color_hex)
        # When has_bg=True with no special effect, skip inline \bord0 — it overrides BorderStyle=3 background box
        if has_bg and effect_type == 'none':
            global_eff = ''
        else:
            global_eff = _get_effect_tags(effect_type, primary_hex, g_stroke_data, g_shadow_data, g_eff_props)

        # ── Global caption position (video-% from ExportPanel containerToVideo) ──
        pos_x = int((float(style.get('position_x', 50) or 50) / 100) * video_w)
        # No per-script shift: the editor and the DOM renderer both centre the
        # caption at position_y for every script (the old INDIC_Y_CORR lifted
        # static Hindi captions ~2.5% of the frame above the animated ones).
        pos_y = int((float(style.get('position_y', 75) or 75) / 100) * video_h)

        # ── ASS Style header ───────────────────────────────────────────────
        # BorderStyle=3 = opaque background box, BorderStyle=1 = outline/shadow
        if has_bg:
            border_style = 3
            outline_size = max(int(bg_padding * scale_factor * bg_h_mult), 2)
            shadow_size = 0
            outline_c = bg_ass
            back_c = bg_ass
        elif has_stroke:
            border_style = 1
            outline_size = max(int(stroke_width_v * scale_factor), 1)
            shadow_size = max(int(shadow_blur_v * scale_factor * 0.5), 1) if has_shadow_v else 1
            outline_c = self._hex_to_ass(stroke_color_hex, 1.0)
            back_c = self._hex_to_ass(shadow_color_hex, 1.0) if has_shadow_v else self._hex_to_ass('#000000', 0.0)
        else:
            border_style = 1
            outline_size = 2
            shadow_size = max(int(shadow_blur_v * scale_factor * 0.5), 1) if has_shadow_v else 1
            outline_c = self._hex_to_ass('#000000', 0.6)
            back_c = self._hex_to_ass(shadow_color_hex, 1.0) if has_shadow_v else self._hex_to_ass('#000000', 0.0)

        # ── Text transform helper ─────────────────────────────────────────
        def _T(t):
            if is_caps or text_case == 'uppercase': return t.upper()
            elif text_case == 'lowercase': return t.lower()
            elif text_case == 'capitalize': return t.title()
            return t

        # ── WordBox style dimensions (per-word background box, for primary path) ──
        _word_box_pad = max(int(bg_padding * scale_factor * bg_h_mult), 2)
        _word_box_bg  = self._hex_to_ass(bg_hex, bg_opacity) if has_bg else self._hex_to_ass('#000000', 0.7)

        with open(ass_path, 'w', encoding='utf-8') as f:
            f.write(
                f"[Script Info]\nScriptType: v4.00+\nPlayResX: {video_w}\nPlayResY: {video_h}\n"
                f"WrapStyle: 0\n\n"
                f"[V4+ Styles]\n"
                f"Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
                f"Style: Default,{font_name},{scaled_size},{primary_ass},&H000000FF,{outline_c},{back_c},{bold_flag},{italic_flag},0,0,100,100,{letter_spacing},0,{border_style},{outline_size},{shadow_size},{ass_align},10,10,10,1\n"
                f"Style: WordBox,{font_name},{scaled_size},{primary_ass},&H000000FF,{_word_box_bg},&H00000000,{bold_flag},{italic_flag},0,0,100,100,{letter_spacing},0,3,{_word_box_pad},0,5,10,10,10,1\n\n"
                f"[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
            )

            for c in captions:
                st = float(c.get('start_time', 0))
                et = float(c.get('end_time', 0))
                if et <= st: continue
                raw_text = self._escape_ass_text(c.get('text', ''))
                if not raw_text.strip(): continue
                s = self._fmt(st)
                e = self._fmt(et)
                cid = str(c.get('id', ''))
                anim = (c.get('animation', 'none') or 'none')
                ws_map = c.get('word_styles') or {}
                if not isinstance(ws_map, dict): ws_map = {}
                words_timing = [
                    {**word, 'word': self._escape_ass_text(word.get('word', ''))}
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
                _pos_tokens = re.split(r'(\s+)', _T(raw_text).replace('\n', '\\N'))
                _pos_wi = 0
                for _pos_tok in _pos_tokens:
                    if not _pos_tok.strip():
                        continue
                    _pos_ws = ws_map.get(f"{cid}-{_pos_wi}", {})
                    if (
                        isinstance(_pos_ws, dict)
                        and _pos_ws.get('abs_x_pct') is not None
                        and self._is_detached_pos(_pos_ws.get('abs_x_pct'), _pos_ws.get('abs_y_pct'))
                    ):
                        positioned.append((_pos_wi, _pos_tok, _pos_ws))
                    _pos_wi += 1
                # Detached words render ONLY at their dragged position (Layer 1);
                # every sentence/karaoke line must leave their slot empty, or the
                # word shows twice: once in the line, once at the dragged spot.
                detached_wi = {_dwi for (_dwi, _dtok, _dws) in positioned}

                # ─── TEXT ELEMENT ─────────────────────────────────────────
                if is_te:
                    cs = c.get('custom_style') or {}
                    te_fi = self._ensure_font(cs.get('font_family', 'Inter') or 'Inter')
                    te_fn = te_fi['ass_name']
                    te_fs = _ass_fs(cs.get('font_size', 18) or 18)
                    te_c = self._hex_to_ass(cs.get('text_color', '#ffffff') or '#ffffff',
                                            float(cs.get('text_opacity', 1.0) or 1.0))
                    te_bold = 1 if str(cs.get('font_weight', '500') or '500') in ('bold', '700', '800', '900') else 0
                    te_italic = 1 if (cs.get('font_style', 'normal') or 'normal') == 'italic' else 0
                    te_lsp = int(float(cs.get('letter_spacing', 0) or 0) * scale_factor)
                    te_has_bg = bool(cs.get('has_background', True))
                    te_bg_a = self._hex_to_ass(cs.get('background_color', '#000000') or '#000000',
                                               float(cs.get('background_opacity', 0.6) or 0.6))
                    te_bord = max(int(float(cs.get('background_padding', 8) or 8) * scale_factor * bord_factor *
                                      float(cs.get('background_h_multiplier', 0.99) or 0.99)), 2) if te_has_bg else 2
                    te_align = {'left': 4, 'center': 5, 'right': 6}.get(cs.get('text_align', 'center'), 5)
                    te_px = int((float(cs.get('position_x', 50) or 50) / 100) * video_w)
                    te_py = int((float(cs.get('position_y', 50) or 50) / 100) * video_h)
                    te_tc = cs.get('text_transform', 'none') or 'none'
                    def _TT(t):
                        if te_tc == 'uppercase': return t.upper()
                        elif te_tc == 'lowercase': return t.lower()
                        elif te_tc == 'capitalize': return t.title()
                        return t
                    te_text = _TT(raw_text).replace('\n', '\\N')
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
                        te_style_str = _get_effect_tags(cs.get('effect_type', 'none') or 'none',
                                                        cs.get('text_color', '#ffffff') or '#ffffff',
                                                        te_sd, te_shd, te_ep)
                    # Build inline per-word overrides for text elements
                    te_words_list = te_text.split()
                    te_parts = []
                    te_sep = []
                    for wi2, tok2 in enumerate(te_words_list):
                        wsv2 = ws_map.get(f"{cid}-{wi2}", {})
                        if not isinstance(wsv2, dict): wsv2 = {}
                        ax2 = wsv2.get('abs_x_pct'); ay2 = wsv2.get('abs_y_pct')
                        if ax2 is not None and ay2 is not None and self._is_detached_pos(ax2, ay2):
                            te_sep.append((wi2, tok2, wsv2))
                        else:
                            ov2 = []; rv2 = []
                            if wsv2.get('color'):
                                ov2.append(f"\\1c{self._hex_to_ass(wsv2['color'])}"); rv2.append(f"\\1c{te_c}")
                            if wsv2.get('fontFamily'):
                                wfi2 = self._ensure_font(wsv2['fontFamily'])
                                ov2.append(f"\\fn{wfi2['ass_name']}"); rv2.append(f"\\fn{te_fn}")
                            if wsv2.get('fontSize'):
                                ov2.append(f"\\fs{_ass_fs(wsv2['fontSize'])}"); rv2.append(f"\\fs{te_fs}")
                            te_parts.append("{" + "".join(ov2) + "}" + tok2 + "{" + "".join(rv2) + "}" if ov2 else tok2)
                    te_main = " ".join(te_parts)
                    te_base = [f"\\fn{te_fn}", f"\\fs{te_fs}", f"\\1c{te_c}", f"\\an{te_align}", te_style_str]
                    if te_bold: te_base.append("\\b1")
                    if te_italic: te_base.append("\\i1")
                    if te_lsp: te_base.append(f"\\fsp{te_lsp}")
                    skip_p2 = False
                    if anim != 'none':
                        for at2 in self._get_animation_tags(anim, st, et, te_fs, te_px, te_py):
                            if at2 == '__skip_pos__': skip_p2 = True
                            else: te_base.append(at2)
                    if not skip_p2: te_base.append(f"\\pos({te_px},{te_py})")
                    f.write(f"Dialogue: 0,{s},{e},Default,,0,0,0,,{{{''.join(te_base)}}}{te_main}\n")
                    for _, tok3, wsv3 in te_sep:
                        wx3 = int((float(wsv3.get('abs_x_pct', 50)) / 100) * video_w)
                        wy3 = int((float(wsv3.get('abs_y_pct', 50)) / 100) * video_h)
                        wc3 = self._hex_to_ass(wsv3.get('color', cs.get('text_color', '#ffffff') or '#ffffff'))
                        wfn3 = self._ensure_font(wsv3['fontFamily'])['ass_name'] if wsv3.get('fontFamily') else te_fn
                        wfs3 = _ass_fs(wsv3['fontSize']) if wsv3.get('fontSize') else te_fs
                        pt3 = [f"\\fn{wfn3}", f"\\fs{wfs3}", f"\\1c{wc3}", f"\\an{te_align}", te_style_str, f"\\pos({wx3},{wy3})"]
                        if te_bold: pt3.append("\\b1")
                        if te_italic: pt3.append("\\i1")
                        f.write(f"Dialogue: 1,{s},{e},Default,,0,0,0,,{{{''.join(pt3)}}}{tok3}\n")
                    continue

                # ─── PRIMARY: WORD-LAYOUT TEMPLATE PATH ───────────────────
                # Compatibility path for trusted internal word positions.
                # Each word is its own Dialogue line at the exact captured position.
                # This matches the CSS preview: correct positions, per-word colors/effects.
                if template_id and words_timing and cap_word_layouts:
                    _ia, _aa = TEMPLATE_WORD_CONFIG.get(template_id, (0.3, 1.0))

                    # Templates where only the CURRENT word gets a snap background box
                    _CUR_BOX  = {'t-111', 't-119'}
                    # Templates where ALL words get a background box
                    _ALL_BOX  = {'t-102', 't-103', 't-T5', 't-26'}
                    _ucb = template_id in _CUR_BOX
                    _uab = template_id in _ALL_BOX

                    # Per-template extra ASS tags for the currently-speaking word
                    _gn = self._hex_to_ass
                    _t109_shadow_hex = secondary_hex or shadow_color_hex or "#FF2A00"
                    _t109_x = max(int(((shadow_ox_v if abs(shadow_ox_v) > 0 else 3) or 3) * scale_factor), 1)
                    _t109_y = max(int(((shadow_oy_v if abs(shadow_oy_v) > 0 else 3) or 3) * scale_factor), 1)
                    _CEFF = {
                        't-115': f'\\bord0\\shad6\\blur5\\4c{_gn(secondary_hex or "#39FF14")}',
                        't-109': f'\\bord0\\shad0\\blur0\\xshad{_t109_x}\\yshad{_t109_y}\\4c{_gn(_t109_shadow_hex, 1.0)}',
                        't-9':   f'\\bord0\\shad8\\blur5\\4c{_gn(shadow_color_hex if has_shadow_v else "#ff4500")}',
                        't-12':  f'\\bord0\\shad8\\blur5\\4c{_gn(shadow_color_hex if has_shadow_v else "#cc0000")}',
                        't-57':  f'\\bord0\\shad0\\xshad{max(int(2*scale_factor),1)}\\yshad0\\4c{_gn(shadow_color_hex if has_shadow_v else "#00ffff")}',
                        't-56':  '\\u1\\bord0\\shad0',
                        't-T3':  '\\u1\\bord0\\shad0',
                        't-124': f'\\bord0\\shad4\\xshad{max(int(4*scale_factor),1)}\\yshad{max(int(4*scale_factor),1)}\\blur0\\4c{_gn(shadow_color_hex if has_shadow_v else "#ffffff")}',
                        't-104': f'\\bord{max(int(stroke_width_v*scale_factor),1)}\\3c{_gn(secondary_hex or "#4F46FF",1.0)}\\shad3\\blur2\\4c{_gn(highlight_hex or "#FFF200",1.0)}',
                        't-110': f'\\bord0\\shad{max(int(4*scale_factor),2)}\\blur3\\4c{_gn(secondary_hex or "#0066FF")}',
                        't-105': f'\\bord{max(int(stroke_width_v*scale_factor),1)}\\3c{_gn(stroke_color_hex,1.0)}\\shad{max(int(shadow_blur_v*scale_factor*0.4),1)}\\4c{_gn(shadow_color_hex,1.0)}\\blur2',
                    }
                    _AEFF = {
                        't-109': f'\\bord0\\shad0\\blur0\\xshad{_t109_x}\\yshad{_t109_y}\\4c{_gn(_t109_shadow_hex, 0.4)}',
                    }
                    _cur_eff = _CEFF.get(template_id, '\\bord0\\shad0')

                    # Templates where active/current word text uses secondary color
                    _ACT_SEC = {'t-36', 't-37'}
                    _CUR_SEC = {'t-36', 't-37', 't-52', 't-112', 't-T1', 't-T4', 't-T3'}

                    _pa = float(style.get('text_opacity', 1.0) or 1.0)
                    _act_c   = _gn(secondary_hex if (secondary_hex and template_id in _ACT_SEC) else primary_hex, _aa * _pa)
                    _inact_c = _gn(primary_hex, _ia * _pa)
                    _cur_c   = _gn(secondary_hex if (secondary_hex and template_id in _CUR_SEC) else primary_hex, 1.0)

                    _cur_box_bg  = _gn(secondary_hex or '#DDAA03', 1.0)
                    _base_box_bg = _gn(bg_hex, bg_opacity)

                    # Base tags shared by every word line (no position/color — added per word)
                    _bt = f'\\fn{font_name}\\fs{scaled_size}\\an5'
                    if bold_flag:      _bt += '\\b1'
                    if italic_flag:    _bt += '\\i1'
                    if letter_spacing: _bt += f'\\fsp{letter_spacing}'

                    # Suppressor: hides outline/shadow/box from Default style (BoxStyle=1 or 3)
                    _nobox = '\\bord0\\shad0\\3a&HFF&\\4a&HFF&'
                    _act_eff = _AEFF.get(template_id, _nobox)

                    def _wxy(lyt):
                        _wx = int((float(lyt['x']) / 100) * video_w)
                        _wy = int((float(lyt['y']) / 100) * video_h)
                        return _wx, _wy

                    _aw = [_T((wt2.get('word') or '').strip()) for wt2 in words_timing]

                    # Gap before first word — write all inactive words
                    _fts = float(words_timing[0].get('start', st)) if words_timing else st
                    if _fts > st + 0.05 and _ia > 0.0:
                        for _wi2, _wd2 in enumerate(_aw):
                            if not _wd2: continue
                            if _wi2 in detached_wi: continue
                            _lyt2 = cap_word_layouts.get(_wi2)
                            if not _lyt2: continue
                            _wx2, _wy2 = _wxy(_lyt2)
                            if _uab:
                                _lt = f'{_bt}\\1c{_inact_c}\\3c{_gn(bg_hex, bg_opacity * _ia)}\\pos({_wx2},{_wy2})'
                                _sn = 'WordBox'
                            else:
                                _lt = f'{_bt}\\1c{_inact_c}{_nobox}\\pos({_wx2},{_wy2})'
                                _sn = 'Default'
                            f.write(f"Dialogue: 0,{self._fmt(st)},{self._fmt(_fts)},{_sn},,0,0,0,,{{{_lt}}}{_wd2}\n")

                    # Per-word timing windows
                    for _wi, _wt2 in enumerate(words_timing):
                        _ww = _aw[_wi]
                        if not _ww: continue
                        # NOTE: detached (abs-positioned) words still get a timing
                        # window here — skipping it blanked ALL words for that
                        # window. The word itself is excluded from rendering by
                        # the detached_wi check in the inner loop below.
                        _ws2 = float(_wt2.get('start', st))
                        _we2 = float(words_timing[_wi + 1].get('start', et) if _wi + 1 < len(words_timing) else et)
                        if _we2 <= _ws2: _we2 = _ws2 + 0.05
                        _ts_s = self._fmt(_ws2)
                        _ts_e = self._fmt(_we2)

                        for _wi2, _wd2 in enumerate(_aw):
                            if not _wd2: continue
                            if _wi2 in detached_wi: continue
                            _lyt2 = cap_word_layouts.get(_wi2)
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
                                    _lt = f'{_bt}\\1c{_gn(primary_hex,1.0)}\\3c{_cur_box_bg}{_pt}'
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
                                    _lt = f'{_bt}\\1c{_inact_c}\\3c{_gn(bg_hex, bg_opacity * _ia)}{_pt}'
                                    _sn = 'WordBox'
                                else:
                                    _lt = f'{_bt}\\1c{_inact_c}{_nobox}{_pt}'
                                    _sn = 'Default'
                                f.write(f"Dialogue: 0,{_ts_s},{_ts_e},{_sn},,0,0,0,,{{{_lt}}}{_wd2}\n")

                    # Separately-positioned (dragged) words — always rendered
                    for _, _tok_p, _ws_p in positioned:
                        _wx_p = int((float(_ws_p.get('abs_x_pct', 50)) / 100) * video_w)
                        _wy_p = int((float(_ws_p.get('abs_y_pct', 75)) / 100) * video_h)
                        _wc_p = _gn(_ws_p.get('color', primary_hex) or primary_hex, float(style.get('text_opacity', 1.0) or 1.0))
                        _wfn_p = self._ensure_font(_ws_p['fontFamily'])['ass_name'] if _ws_p.get('fontFamily') else font_name
                        _wfs_p = _ass_fs(_ws_p['fontSize']) if _ws_p.get('fontSize') else scaled_size
                        _weff_t = _ws_p.get('effectType', 'none') or 'none'
                        if _weff_t != 'none':
                            _weff_p = {'offset': float(_ws_p.get('effectOffset', 50) or 50), 'direction': float(_ws_p.get('effectDirection', -45) or -45), 'blur': float(_ws_p.get('effectBlur', 50) or 50), 'transparency': float(_ws_p.get('effectTransparency', 40) or 40), 'thickness': float(_ws_p.get('effectThickness', 50) or 50), 'intensity': float(_ws_p.get('effectIntensity', 50) or 50), 'color': _ws_p.get('effectColor', '#000000') or '#000000'}
                            _weff_str = _get_effect_tags(_weff_t, _ws_p.get('color', primary_hex) or primary_hex, (False, 0, '#000000'), (False, 0, 0, 0, '#000000'), _weff_p)
                        else:
                            _weff_str = '\\bord0\\shad0'
                        _pt_p = [f"\\fn{_wfn_p}", f"\\fs{_wfs_p}", f"\\1c{_wc_p}", "\\an5", _weff_str, f"\\pos({_wx_p},{_wy_p})"]
                        if bold_flag or str(_ws_p.get('fontWeight', '')) in ('bold', '700', '800', '900'): _pt_p.append("\\b1")
                        if italic_flag: _pt_p.append("\\i1")
                        if _ws_p.get('isEmphasis'): _pt_p.append("\\fscx115\\fscy115\\blur0.5")
                        f.write(f"Dialogue: 1,{s},{e},Default,,0,0,0,,{{{''.join(_pt_p)}}}{_tok_p}\n")

                    continue  # Skip legacy rendering paths

                # ─── REGULAR CAPTION ──────────────────────────────────────
                text = _T(raw_text).replace('\n', '\\N')

                # Split into tokens; words with abs_x/y are rendered as separate Dialogue lines
                tokens = re.split(r'(\s+)', text)
                word_idx = 0
                inline_parts = []
                positioned = []   # (word_idx, token, ws_dict) — rebuilt from tokens for legacy path

                for tok in tokens:
                    if not tok.strip():
                        inline_parts.append(tok)
                        continue
                    ws = ws_map.get(f"{cid}-{word_idx}", {})
                    if not isinstance(ws, dict): ws = {}
                    ax = ws.get('abs_x_pct'); ay = ws.get('abs_y_pct')
                    if ax is not None and ay is not None and self._is_detached_pos(ax, ay):
                        positioned.append((word_idx, tok, ws))
                    else:
                        ov = []; rv = []
                        if ws.get('color'):
                            ov.append(f"\\1c{self._hex_to_ass(ws['color'])}"); rv.append(f"\\1c{primary_ass}")
                        if ws.get('fontFamily'):
                            wfi = self._ensure_font(ws['fontFamily'])
                            ov.append(f"\\fn{wfi['ass_name']}"); rv.append(f"\\fn{font_name}")
                        if ws.get('fontSize'):
                            ov.append(f"\\fs{_ass_fs(ws['fontSize'])}"); rv.append(f"\\fs{scaled_size}")
                        if str(ws.get('fontWeight', '')) in ('bold', '700', '800', '900'):
                            ov.append("\\b1"); rv.append(f"\\b{bold_flag}")
                        if ws.get('fontStyle') == 'italic':
                            ov.append("\\i1"); rv.append(f"\\i{italic_flag}")
                        if ws.get('isEmphasis'):
                            ov.append("\\fscx115\\fscy115\\blur0.5"); rv.append("\\fscx100\\fscy100\\blur0")
                        inline_parts.append("{" + "".join(ov) + "}" + tok + "{" + "".join(rv) + "}" if ov else tok)
                    word_idx += 1

                main_text = "".join(inline_parts).strip()

                # Base override tags for this caption's Dialogue line
                tags = [f"\\fn{font_name}", f"\\fs{scaled_size}", f"\\1c{primary_ass}", f"\\an{ass_align}"]
                if bold_flag: tags.append("\\b1")
                if italic_flag: tags.append("\\i1")
                if letter_spacing: tags.append(f"\\fsp{letter_spacing}")
                if global_eff: tags.append(global_eff)

                # Animation tags
                skip_pos = False
                if anim != 'none':
                    for at in self._get_animation_tags(anim, st, et, scaled_size, pos_x, pos_y):
                        if at == '__skip_pos__': skip_pos = True
                        else: tags.append(at)
                if not skip_pos: tags.append(f"\\pos({pos_x},{pos_y})")

                # ─── TEMPLATE KARAOKE PATH ────────────────────────────────
                # Replaces Layer 0 + secondary karaoke for template captions.
                # Renders one Dialogue line per word window with inactive/active/current
                # states properly encoded — matching the CSS preview word states.
                #
                # KEY: Effects (shadow/glow/stroke) are applied PER-WORD-STATE,
                # not globally.  In CSS, only .word.active/.word.current get
                # template effects; inactive/done words are plain or dimmed.
                # This must match in the ASS output.
                used_template_karaoke = False
                if template_id and words_timing:
                    _ia_fb, _aa_fb = TEMPLATE_WORD_CONFIG.get(template_id, (0.3, 1.0))
                    _pa_fb = float(style.get('text_opacity', 1.0) or 1.0)
                    _gn_fb = self._hex_to_ass
                    _t109_shadow_hex_fb = secondary_hex or shadow_color_hex or "#FF2A00"
                    _t109_x_fb = max(int(((shadow_ox_v if abs(shadow_ox_v) > 0 else 3) or 3) * scale_factor), 1)
                    _t109_y_fb = max(int(((shadow_oy_v if abs(shadow_oy_v) > 0 else 3) or 3) * scale_factor), 1)

                    # Color logic matching the primary word-layout path
                    _ACT_SEC_FB = {'t-36', 't-37'}
                    _CUR_SEC_FB = {'t-36', 't-37', 't-52', 't-112', 't-T1', 't-T4', 't-T3'}
                    _act_c_fb  = _gn_fb(secondary_hex if (secondary_hex and template_id in _ACT_SEC_FB) else primary_hex, _aa_fb * _pa_fb)
                    _inact_c_fb = _gn_fb(primary_hex, _ia_fb * _pa_fb)
                    _cur_c_fb  = _gn_fb(secondary_hex if (secondary_hex and template_id in _CUR_SEC_FB) else primary_hex, 1.0)

                    all_tpl_words = [
                        '' if _twi in detached_wi else _T((wt.get('word') or '').strip())
                        for _twi, wt in enumerate(words_timing)
                    ]

                    # Build tpl_tag WITHOUT global_eff — effects go per-word-state below.
                    # For bg templates global_eff is already '' (has_bg + effect_type=none).
                    tpl_base = [f"\\fn{font_name}", f"\\fs{scaled_size}", f"\\an{ass_align}"]
                    if bold_flag: tpl_base.append("\\b1")
                    if italic_flag: tpl_base.append("\\i1")
                    if letter_spacing: tpl_base.append(f"\\fsp{letter_spacing}")
                    # Only include global_eff for bg templates (where it's already empty)
                    if has_bg and global_eff: tpl_base.append(global_eff)
                    tpl_base.append(f"\\pos({pos_x},{pos_y})")
                    tpl_tag = "".join(tpl_base)

                    # Per-template CURRENT-word effects (mirrors primary path _CEFF)
                    _CEFF_FB = {
                        't-115': f'\\bord0\\shad6\\blur5\\4c{_gn_fb(secondary_hex or "#39FF14")}',
                        't-109': f'\\bord0\\shad0\\blur0\\xshad{_t109_x_fb}\\yshad{_t109_y_fb}\\4c{_gn_fb(_t109_shadow_hex_fb, 1.0)}',
                        't-9':   f'\\bord0\\shad8\\blur5\\4c{_gn_fb(shadow_color_hex if has_shadow_v else "#ff4500")}',
                        't-12':  f'\\bord0\\shad8\\blur5\\4c{_gn_fb(shadow_color_hex if has_shadow_v else "#cc0000")}',
                        't-57':  f'\\bord0\\shad0\\xshad{max(int(2*scale_factor),1)}\\yshad0\\4c{_gn_fb(shadow_color_hex if has_shadow_v else "#00ffff")}',
                        't-56':  '\\u1\\bord0\\shad0',
                        't-T3':  '\\u1\\bord0\\shad0',
                        't-124': f'\\bord0\\shad4\\xshad{max(int(4*scale_factor),1)}\\yshad{max(int(4*scale_factor),1)}\\blur0\\4c{_gn_fb(shadow_color_hex if has_shadow_v else "#ffffff")}',
                        't-104': f'\\bord{max(int(stroke_width_v*scale_factor),1)}\\3c{_gn_fb(secondary_hex or "#4F46FF",1.0)}\\shad3\\blur2\\4c{_gn_fb(highlight_hex or "#FFF200",1.0)}',
                        't-110': f'\\bord0\\shad{max(int(4*scale_factor),2)}\\blur3\\4c{_gn_fb(secondary_hex or "#0066FF")}',
                        't-105': f'\\bord{max(int(stroke_width_v*scale_factor),1)}\\3c{_gn_fb(stroke_color_hex,1.0)}\\shad{max(int(shadow_blur_v*scale_factor*0.4),1)}\\4c{_gn_fb(shadow_color_hex,1.0)}\\blur2',
                    }
                    _AEFF_FB = {
                        't-109': f'\\bord0\\shad0\\blur0\\xshad{_t109_x_fb}\\yshad{_t109_y_fb}\\4c{_gn_fb(_t109_shadow_hex_fb, 0.4)}',
                    }
                    _cur_eff_fb = _CEFF_FB.get(template_id, '\\bord0\\shad0')
                    # Suppress effects for non-current words (no glow/shadow bleed)
                    _noeff_fb = '\\bord0\\shad0\\blur0'
                    _act_eff_fb = _AEFF_FB.get(template_id, _noeff_fb)

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
                                if has_bg:
                                    parts.append(f"{{\\1c{_act_c_fb}}}{tw}")
                                else:
                                    parts.append(f"{{\\1c{_act_c_fb}{_act_eff_fb}}}{tw}")
                            elif j == cur_wi:
                                # Currently speaking — template-specific effects
                                if has_bg:
                                    parts.append(f"{{\\1c{_cur_c_fb}}}{tw}")
                                else:
                                    parts.append(f"{{\\1c{_cur_c_fb}{_cur_eff_fb}}}{tw}")
                            else:
                                # Not yet spoken — inactive, no effects
                                parts.append(f"{{\\1c{_inact_c_fb}{_noeff_fb}}}{tw}")
                        f.write(f"Dialogue: 2,{self._fmt(w_s)},{self._fmt(w_e)},Default,,0,0,0,,{{{tpl_tag}}}{' '.join(parts)}\n")

                    # Gap before first word → all inactive
                    first_st = float(words_timing[0].get('start', st))
                    if first_st > st + 0.05:
                        _tpl_line(st, first_st, None)

                    # Per-word windows (extended to fill inter-word gaps)
                    for wi, wt in enumerate(words_timing):
                        ww = _T((wt.get('word') or '').strip())
                        if not ww: continue
                        # Detached words keep their timing window (they are blanked
                        # inside _tpl_line via all_tpl_words) so the rest of the
                        # sentence never disappears during that word's slot.
                        w_s2 = float(wt.get('start', st))
                        w_e2 = float(wt.get('end', et))
                        if w_e2 <= w_s2: continue
                        w_e2 = float(words_timing[wi + 1].get('start', w_e2)) if wi + 1 < len(words_timing) else et
                        if w_e2 <= w_s2: w_e2 = w_s2 + 0.05
                        _tpl_line(w_s2, w_e2, wi)

                    used_template_karaoke = True

                # ─── STANDARD PATH (no active template) ───────────────────
                if not used_template_karaoke:
                    if not show_inactive and words_timing:
                        for wi, wt in enumerate(words_timing):
                            ww = _T(wt.get('word', '').strip())
                            if not ww: continue
                            w_st = float(wt.get('start', st)); w_et = float(wt.get('end', et))
                            if w_et <= w_st: continue
                            ws2 = ws_map.get(f"{cid}-{wi}", {})
                            if not isinstance(ws2, dict): ws2 = {}
                            if wi in detached_wi: continue
                            w_tags = list(tags)
                            if ws2.get('color'):
                                w_tags = [t for t in w_tags if not t.startswith('\\1c')]
                                w_tags.insert(2, f"\\1c{self._hex_to_ass(ws2['color'])}")
                            if ws2.get('fontFamily'):
                                wfi3 = self._ensure_font(ws2['fontFamily'])
                                w_tags = [t for t in w_tags if not t.startswith('\\fn')]
                                w_tags.insert(0, f"\\fn{wfi3['ass_name']}")
                            if ws2.get('fontSize'):
                                w_tags = [t for t in w_tags if not t.startswith('\\fs')]
                                w_tags.insert(1, f"\\fs{_ass_fs(ws2['fontSize'])}")
                            f.write(f"Dialogue: 0,{self._fmt(w_st)},{self._fmt(w_et)},Default,,0,0,0,,{{{''.join(w_tags)}}}{ww}\n")
                    elif main_text:
                        f.write(f"Dialogue: 0,{s},{e},Default,,0,0,0,,{{{''.join(tags)}}}{main_text}\n")

                # Positioned (emphasis/dragged) words as separate Dialogue lines (always)
                for _, tok4, ws4 in positioned:
                    wx4 = int((float(ws4.get('abs_x_pct', 50)) / 100) * video_w)
                    wy4 = int((float(ws4.get('abs_y_pct', 75)) / 100) * video_h)
                    wc4 = self._hex_to_ass(ws4.get('color', primary_hex) or primary_hex,
                                           float(style.get('text_opacity', 1.0) or 1.0))
                    wfn4 = self._ensure_font(ws4['fontFamily'])['ass_name'] if ws4.get('fontFamily') else font_name
                    wfs4 = _ass_fs(ws4['fontSize']) if ws4.get('fontSize') else scaled_size
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
                        w_eff_str = _get_effect_tags(w_eff_type, ws4.get('color', primary_hex) or primary_hex,
                                                     (False, 0, '#000000'), (False, 0, 0, 0, '#000000'), w_eff_props)
                    else:
                        w_eff_str = '\\bord0\\shad0'
                    pt4 = [f"\\fn{wfn4}", f"\\fs{wfs4}", f"\\1c{wc4}", "\\an5", w_eff_str]
                    if str(ws4.get('fontWeight', '')) in ('bold', '700') or bold_flag: pt4.append("\\b1")
                    if italic_flag: pt4.append("\\i1")
                    if ws4.get('isEmphasis'): pt4.append("\\fscx115\\fscy115\\blur0.5")
                    # Per-word animation from floating popup
                    w_anim = ws4.get('animation', 'none') or 'none'
                    skip_pos_w = False
                    if w_anim != 'none':
                        for at in self._get_animation_tags(w_anim, st, et, wfs4, wx4, wy4):
                            if at == '__skip_pos__':
                                skip_pos_w = True
                            else:
                                pt4.append(at)
                    if not skip_pos_w:
                        pt4.append(f"\\pos({wx4},{wy4})")
                    f.write(f"Dialogue: 1,{s},{e},Default,,0,0,0,,{{{''.join(pt4)}}}{tok4}\n")

                # ─── HIGHLIGHT KARAOKE (standard/non-template captions only) ──
                if not used_template_karaoke and highlight_hex and words_timing:
                    h_ass = self._hex_to_ass(highlight_hex, 1.0)
                    h_bord = max(int(bg_padding * scale_factor * bord_factor * bg_h_mult), 2) if has_bg else max(int(scaled_size * 0.08), 2)
                    all_ww = [
                        '' if _hwi in detached_wi else _T(wt.get('word', '').strip())
                        for _hwi, wt in enumerate(words_timing)
                    ]
                    h_base = [f"\\fn{font_name}", f"\\fs{scaled_size}", f"\\an{ass_align}", f"\\pos({pos_x},{pos_y})"]
                    if bold_flag: h_base.append("\\b1")
                    if italic_flag: h_base.append("\\i1")
                    for wi, wt in enumerate(words_timing):
                        ww = _T(wt.get('word', '').strip())
                        if not ww: continue
                        w_st2 = float(wt.get('start', st)); w_et2 = float(wt.get('end', et))
                        if w_et2 <= w_st2: continue
                        ws5 = ws_map.get(f"{cid}-{wi}", {})
                        if not isinstance(ws5, dict): ws5 = {}
                        if ws5.get('isEmphasis') or wi in detached_wi: continue
                        parts_h = []
                        for j, tw in enumerate(all_ww):
                            if not tw: continue
                            if j == wi:
                                parts_h.append(f"{{\\1c{h_ass}\\3c{h_ass}\\4c{h_ass}\\bord{h_bord}\\shad0}}{tw}")
                            else:
                                parts_h.append(f"{{\\1c{primary_ass}\\3c{outline_c}\\4c{back_c}\\bord{outline_size}\\shad{shadow_size}}}{tw}")
                        h_str = "{" + "".join(h_base) + "}" + " ".join(parts_h)
                        f.write(f"Dialogue: 2,{self._fmt(w_st2)},{self._fmt(w_et2)},Default,,0,0,0,,{h_str}\n")

        # Log only aggregate render diagnostics; dialogue text may contain PII.
        try:
            with open(ass_path, 'r', encoding='utf-8') as _df:
                _lines = _df.readlines()
                _diags = [l.strip() for l in _lines if l.startswith('Dialogue:')]
                print(f"[ASS] Created: {len(_lines)} lines, {len(_diags)} Dialogue entries")
        except Exception:
            pass

        return ass_path

    def _get_animation_tags(self, animation, start, end, font_size, pos_x=None, pos_y=None):
        duration_ms = int((end - start) * 1000)
        fade_in = min(400, duration_ms // 3)
        fade_out = min(200, duration_ms // 4)
        move_px = max(int(font_size * 0.3), 15)

        if animation == 'fade':
            return [f"\\fad({fade_in},{fade_out})"]
        elif animation == 'pop':
            return [f"\\fscx50\\fscy50\\fad({fade_in},0)\\t(0,{fade_in},\\fscx105\\fscy105)\\t({fade_in},{fade_in + 100},\\fscx100\\fscy100)"]
        elif animation == 'rise':
            if pos_x is not None and pos_y is not None:
                return [f"\\move({pos_x},{pos_y + move_px},{pos_x},{pos_y},0,{fade_in})\\fad({fade_in},0)", "__skip_pos__"]
            return [f"\\fad({fade_in},0)\\fscx100\\fscy100"]
        elif animation == 'breathe':
            half = duration_ms // 2
            return [f"\\t(0,{half},\\fscx105\\fscy105)\\t({half},{duration_ms},\\fscx100\\fscy100)"]
        elif animation == 'blur':
            return [f"\\blur10\\t(0,{fade_in},\\blur0)\\fad({fade_in},0)"]
        elif animation == 'wipe':
            return [f"\\fad({fade_in},0)"]
        elif animation == 'pan':
            if pos_x is not None and pos_y is not None:
                return [f"\\move({pos_x - move_px * 2},{pos_y},{pos_x},{pos_y},0,{fade_in})\\fad({fade_in},0)", "__skip_pos__"]
            return [f"\\fad({fade_in},0)"]
        elif animation == 'succession':
            if pos_x is not None and pos_y is not None:
                sm = max(int(font_size * 0.15), 8)
                return [f"\\move({pos_x},{pos_y - sm},{pos_x},{pos_y},0,{fade_in})\\fad({fade_in},0)", "__skip_pos__"]
            return [f"\\fad({fade_in},0)"]
        elif animation == 'baseline':
            if pos_x is not None and pos_y is not None:
                sm = max(int(font_size * 0.08), 4)
                return [f"\\move({pos_x},{pos_y + sm},{pos_x},{pos_y},0,{fade_in})\\fad({fade_in},0)", "__skip_pos__"]
            return [f"\\fad({fade_in},0)"]
        elif animation == 'drift':
            if pos_x is not None and pos_y is not None:
                sm = max(int(font_size * 0.15), 8)
                return [f"\\move({pos_x - sm},{pos_y - sm},{pos_x},{pos_y},0,{fade_in})\\fad({fade_in},0)", "__skip_pos__"]
            return [f"\\fad({fade_in},{fade_out})"]
        elif animation == 'tectonic':
            if pos_x is not None and pos_y is not None:
                return [f"\\move({pos_x - move_px},{pos_y},{pos_x},{pos_y},0,{fade_in})\\frz-5\\t(0,{fade_in},\\frz0)\\fad({fade_in},0)", "__skip_pos__"]
            return [f"\\fscx90\\fscy90\\t(0,{fade_in},\\fscx100\\fscy100)\\frz-5\\t(0,{fade_in},\\frz0)\\fad({fade_in},0)"]
        elif animation == 'tumble':
            return [f"\\frz-180\\fscx50\\fscy50\\t(0,{fade_in},\\frz0\\fscx100\\fscy100)\\fad({fade_in},0)"]

        return []

    def _hex_to_ass(self, hex_c, alpha=1.0):
        if not hex_c or not isinstance(hex_c, str):
            return "&H00FFFFFF"

        hex_c = hex_c.strip().lstrip('#')

        if len(hex_c) == 3:
            hex_c = hex_c[0]*2 + hex_c[1]*2 + hex_c[2]*2

        if len(hex_c) != 6:
            return "&H00FFFFFF"

        try:
            r = hex_c[0:2]
            g = hex_c[2:4]
            b = hex_c[4:6]
        except Exception:
            return "&H00FFFFFF"

        ass_alpha_val = int(255 * (1.0 - min(max(alpha, 0), 1.0)))
        ass_alpha_hex = f"{ass_alpha_val:02X}"

        return f"&H{ass_alpha_hex}{b.upper()}{g.upper()}{r.upper()}"

    def _fmt(self, s):
        h = int(s // 3600)
        m = int((s % 3600) // 60)
        sec = s % 60
        return f"{h}:{m:02d}:{sec:05.2f}"
