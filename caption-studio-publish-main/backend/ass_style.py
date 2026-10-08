"""Style resolution and ASS headers shared by the event renderers."""
import os
import math
from dataclasses import dataclass
from typing import Any, Callable

try:
    from .processor_fonts import css_font_weight, detect_text_script, resolve_script_font_family
except ImportError:
    from processor_fonts import css_font_weight, detect_text_script, resolve_script_font_family

@dataclass(frozen=True)
class AssRenderContext:
    indic_y_corrections: dict[str, float]
    template_word_config: dict[str, tuple[float, float]]
    transform_text: Callable[[str], str]
    effect_tags: Callable[..., str]
    word_box_background: str
    word_box_padding: int
    ass_align: int
    ass_path: str
    back_c: str
    bg_h_mult: float
    bg_hex: str
    bg_opacity: float
    bg_padding: float
    bold_flag: int
    bord_factor: float
    border_style: int
    detected_script: str
    font_name: str
    global_eff: str
    has_bg: bool
    has_shadow_v: bool
    highlight_hex: str
    italic_flag: int
    letter_spacing: int
    outline_c: str
    outline_size: int
    pos_x: int
    pos_y: int
    primary_ass: str
    primary_hex: str
    scale_factor: float
    scaled_size: int
    ass_font_size: Callable[[float], int]
    secondary_hex: str
    shadow_blur_v: float
    shadow_color_hex: str
    shadow_ox_v: float
    shadow_oy_v: float
    shadow_size: int
    show_inactive: bool
    stroke_color_hex: str
    stroke_width_v: float
    style: dict[str, Any]
    template_id: str
    video_h: int
    video_w: int


def build_ass_context(processor, captions, style, font_info, video_w, video_h):
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
    def effect_tags(eff_type, base_color_hex, stroke_data, shadow_data, eff_props):
        base_c_ass = processor._hex_to_ass(base_color_hex)
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
        eff_c_ass = processor._hex_to_ass(eff_color, alpha_frac)
        if eff_type == 'shadow':
            tags.extend(["\\bord0", "\\shad4", f"\\xshad{ox}", f"\\yshad{oy}", f"\\blur{b_px}", f"\\4c{eff_c_ass}"])
        elif eff_type == 'lift':
            lift_b = round((eff_intens / 100.0) * 30 * scale_factor, 1)
            lift_c_ass = processor._hex_to_ass('#000000', (eff_intens / 100.0) * 0.8)
            tags.extend(["\\bord0", "\\shad4", "\\xshad0", f"\\yshad{round(15*scale_factor, 1)}", f"\\blur{lift_b}", f"\\4c{lift_c_ass}"])
        elif eff_type == 'hollow':
            stroke_px = max(1, round((eff_thick / 100.0) * 4 * scale_factor, 1))
            tags.extend(["\\1a&HFF&", f"\\bord{stroke_px}", f"\\3c{processor._hex_to_ass(eff_color)}", "\\shad0"])
        elif eff_type == 'splice':
            stroke_px = max(1, round((eff_thick / 100.0) * 4 * scale_factor, 1))
            tags.extend(["\\1a&HFF&", f"\\bord{stroke_px}", f"\\3c{base_c_ass}", "\\shad4", f"\\xshad{ox}", f"\\yshad{oy}", f"\\4c{processor._hex_to_ass(eff_color)}"])
        elif eff_type == 'outline':
            stroke_px = max(1, round((eff_thick / 100.0) * 8 * scale_factor, 1))
            tags.extend([f"\\bord{stroke_px}", f"\\3c{processor._hex_to_ass(eff_color)}", "\\shad0"])
        elif eff_type == 'echo':
            tags.extend(["\\bord0", "\\shad4", f"\\xshad{ox}", f"\\yshad{oy}", f"\\4c{eff_c_ass}"])
        elif eff_type == 'neon':
            glow_px = round((eff_intens / 100.0) * 20 * scale_factor, 1)
            tags.extend([f"\\bord{b_px}", f"\\3c{processor._hex_to_ass(eff_color)}", f"\\blur{glow_px}", "\\shad0"])
        elif stroke_data[0]:
            tags.extend([f"\\bord{max(int(stroke_data[1] * scale_factor), 1)}", f"\\3c{processor._hex_to_ass(stroke_data[2], 1.0)}"])
            if shadow_data[0]:
                sv = max(int(shadow_data[1] * scale_factor * 0.5), 1)
                tags.extend([f"\\shad{sv}", f"\\4c{processor._hex_to_ass(shadow_data[4], 1.0)}"])
                if shadow_data[2]: tags.append(f"\\xshad{int(shadow_data[2] * scale_factor)}")
                if shadow_data[3]: tags.append(f"\\yshad{int(shadow_data[3] * scale_factor)}")
            else:
                tags.append("\\shad0")
        elif shadow_data[0]:
            tags.extend(["\\bord0", f"\\shad{max(int(shadow_data[1] * scale_factor * 0.5), 1)}", f"\\4c{processor._hex_to_ass(shadow_data[4], 1.0)}"])
            if shadow_data[2]: tags.append(f"\\xshad{int(shadow_data[2] * scale_factor)}")
            if shadow_data[3]: tags.append(f"\\yshad{int(shadow_data[3] * scale_factor)}")
        else:
            tags.extend(["\\bord0", "\\shad0"])
        return "".join(tags)

    # ── Font ───────────────────────────────────────────────────────────
    font_name = font_info['ass_name']
    ass_font_info = font_info

    # ── Script detection + script font override ───────────────────────
    # Pick the face the editor and DOM renderer use for this text
    # (scriptFontResolver.js, ported as resolve_script_font_family), so a
    # static caption keeps its font once it is animated.
    all_text = " ".join(c.get('text', '') for c in captions)
    detected_script = processor._detect_script(all_text)
    requested_family = str(style.get('font_family') or font_name).strip()
    script_family = resolve_script_font_family(requested_family, all_text)
    if script_family.lower() not in {requested_family.lower(), font_name.lower()}:
        script_font_info = processor._ensure_font(script_family)
        if (
            script_font_info.get('ass_name', '').lower() != script_family.lower()
            or processor._font_lacks_text_glyphs(script_font_info, all_text)
        ):
            # Could not get a usable file for the resolver's face (offline,
            # unknown, or a Latin-only subset): use the bundled per-script
            # face rather than let libass substitute an arbitrary one.
            script_font_info = (processor._ensure_indic_font(detected_script) if detected_script else None) or script_font_info
        print(f"[ASS] Font '{font_name}' -> {script_font_info['ass_name']} for {detect_text_script(all_text)} text")
        font_name = script_font_info['ass_name']
        ass_font_info = script_font_info

    # ASS Fontsize is the face's cell height (winAscent + winDescent), CSS
    # font-size is its em square: convert so glyphs match the DOM renderer.
    cell_height_ratio = processor._ass_cell_height_ratio(ass_font_info)
    font_weight = css_font_weight(style.get('font_weight'), style.get('is_bold', False))
    weighted_family = processor._weighted_font_family(ass_font_info, font_weight)
    if weighted_family:
        print(f"[ASS] weight {font_weight}: {font_name!r} -> {weighted_family!r}")
        font_name = weighted_family

    def ass_font_size(css_px):
        return max(int(round(float(css_px) * scale_factor * cell_height_ratio)), 20)

    scaled_size = ass_font_size(font_size_source)
    print(f"[ASS] font={font_name!r} size={scaled_size} scale_factor={scale_factor:.2f} cell_ratio={cell_height_ratio:.3f}")
    indic_y_corrections = {}  # All scripts use the editor position without a vertical shift.
    bord_factor = 0.65 if detected_script else 0.85

    # ── Per-template word-state alpha config ──────────────────────────
    # (inactive_alpha, active_alpha)
    # inactive = not yet spoken, active = already spoken, current = now speaking
    template_word_config = {
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
    primary_ass = processor._hex_to_ass(primary_hex, _num(style.get('text_opacity'), 1.0))
    has_bg = bool(style.get('has_background', False))
    bg_hex = style.get('background_color', '#000000') or '#000000'
    bg_opacity = _num(style.get('background_opacity'), 0.7)
    bg_ass = processor._hex_to_ass(bg_hex, bg_opacity)
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
        global_eff = effect_tags(effect_type, primary_hex, g_stroke_data, g_shadow_data, g_eff_props)

    # ── Global caption position (video-% from ExportPanel containerToVideo) ──
    pos_x = int((float(style.get('position_x', 50) or 50) / 100) * video_w)
    pos_y = int((float(style.get('position_y', 75) or 75) / 100) * video_h)
    if detected_script in indic_y_corrections:
        pos_y = max(10, pos_y + int(indic_y_corrections[detected_script] * video_h))

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
        outline_c = processor._hex_to_ass(stroke_color_hex, 1.0)
        back_c = processor._hex_to_ass(shadow_color_hex, 1.0) if has_shadow_v else processor._hex_to_ass('#000000', 0.0)
    else:
        border_style = 1
        outline_size = 2
        shadow_size = max(int(shadow_blur_v * scale_factor * 0.5), 1) if has_shadow_v else 1
        outline_c = processor._hex_to_ass('#000000', 0.6)
        back_c = processor._hex_to_ass(shadow_color_hex, 1.0) if has_shadow_v else processor._hex_to_ass('#000000', 0.0)

    # ── Text transform helper ─────────────────────────────────────────
    def transform_text(t):
        if is_caps or text_case == 'uppercase': return t.upper()
        elif text_case == 'lowercase': return t.lower()
        elif text_case == 'capitalize': return t.title()
        return t

    # ── WordBox style dimensions (per-word background box, for primary path) ──
    word_box_padding = max(int(bg_padding * scale_factor * bg_h_mult), 2)
    word_box_background  = processor._hex_to_ass(bg_hex, bg_opacity) if has_bg else processor._hex_to_ass('#000000', 0.7)


    return AssRenderContext(
        indic_y_corrections=indic_y_corrections,
        template_word_config=template_word_config,
        transform_text=transform_text,
        effect_tags=effect_tags,
        word_box_background=word_box_background,
        word_box_padding=word_box_padding,
        ass_align=ass_align,
        ass_path=ass_path,
        back_c=back_c,
        bg_h_mult=bg_h_mult,
        bg_hex=bg_hex,
        bg_opacity=bg_opacity,
        bg_padding=bg_padding,
        bold_flag=bold_flag,
        bord_factor=bord_factor,
        border_style=border_style,
        detected_script=detected_script,
        font_name=font_name,
        global_eff=global_eff,
        has_bg=has_bg,
        has_shadow_v=has_shadow_v,
        highlight_hex=highlight_hex,
        italic_flag=italic_flag,
        letter_spacing=letter_spacing,
        outline_c=outline_c,
        outline_size=outline_size,
        pos_x=pos_x,
        pos_y=pos_y,
        primary_ass=primary_ass,
        primary_hex=primary_hex,
        scale_factor=scale_factor,
        scaled_size=scaled_size,
        ass_font_size=ass_font_size,
        secondary_hex=secondary_hex,
        shadow_blur_v=shadow_blur_v,
        shadow_color_hex=shadow_color_hex,
        shadow_ox_v=shadow_ox_v,
        shadow_oy_v=shadow_oy_v,
        shadow_size=shadow_size,
        show_inactive=show_inactive,
        stroke_color_hex=stroke_color_hex,
        stroke_width_v=stroke_width_v,
        style=style,
        template_id=template_id,
        video_h=video_h,
        video_w=video_w,
    )


def write_ass_header(f, style_context: AssRenderContext):
    f.write(
        f"[Script Info]\nScriptType: v4.00+\nPlayResX: {style_context.video_w}\nPlayResY: {style_context.video_h}\n"
        f"WrapStyle: 0\n\n"
        f"[V4+ Styles]\n"
        f"Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{style_context.font_name},{style_context.scaled_size},{style_context.primary_ass},&H000000FF,{style_context.outline_c},{style_context.back_c},{style_context.bold_flag},{style_context.italic_flag},0,0,100,100,{style_context.letter_spacing},0,{style_context.border_style},{style_context.outline_size},{style_context.shadow_size},{style_context.ass_align},10,10,10,1\n"
        f"Style: WordBox,{style_context.font_name},{style_context.scaled_size},{style_context.primary_ass},&H000000FF,{style_context.word_box_background},&H00000000,{style_context.bold_flag},{style_context.italic_flag},0,0,100,100,{style_context.letter_spacing},0,3,{style_context.word_box_padding},0,5,10,10,10,1\n\n"
        f"[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
