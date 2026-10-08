"""ASS (Advanced SubStation Alpha) subtitle generation for FFmpeg burn-in.

Mixed into processor.VideoProcessor; methods use its instance state.
"""

import math
import os
import re


try:
    from .ass_style import build_ass_context, write_ass_header
    from .ass_events import (
        prepare_ass_caption, write_text_element, write_layout_caption,
        prepare_regular_caption, write_template_karaoke, write_standard_caption,
        write_positioned_words, write_highlight_karaoke,
    )
except ImportError:
    from ass_style import build_ass_context, write_ass_header
    from ass_events import (
        prepare_ass_caption, write_text_element, write_layout_caption,
        prepare_regular_caption, write_template_karaoke, write_standard_caption,
        write_positioned_words, write_highlight_karaoke,
    )


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
        """Resolve style once, then emit the appropriate dialogue layers."""
        context = build_ass_context(self, captions, style, font_info, video_w, video_h)
        with open(context.ass_path, 'w', encoding='utf-8') as stream:
            write_ass_header(stream, context)
            for caption in captions:
                item = prepare_ass_caption(self, caption, context, word_layouts=word_layouts)
                if item is None:
                    continue
                if item.is_te:
                    write_text_element(self, stream, context, item)
                    continue
                if context.template_id and item.words_timing and item.cap_word_layouts:
                    write_layout_caption(self, stream, context, item)
                    continue
                regular = prepare_regular_caption(self, context, item)
                karaoke = write_template_karaoke(self, stream, context, item)
                if not karaoke:
                    write_standard_caption(self, stream, context, item, regular)
                write_positioned_words(self, stream, context, item, regular)
                if not karaoke and context.highlight_hex and item.words_timing:
                    write_highlight_karaoke(self, stream, context, item)
        # Aggregate diagnostics only; caption dialogue may contain private text.
        try:
            with open(context.ass_path, 'r', encoding='utf-8') as stream:
                rendered = stream.readlines()
            count = sum(line.startswith('Dialogue:') for line in rendered)
            print(f"[ASS] Created: {len(rendered)} lines, {count} Dialogue entries")
        except OSError:
            pass
        return context.ass_path

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
