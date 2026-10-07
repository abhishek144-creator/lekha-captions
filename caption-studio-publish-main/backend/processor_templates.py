"""Authored-template exports: routing to the DOM renderer and compositing its overlay.

Mixed into processor.VideoProcessor; methods use its instance state.
"""

import json
import os
import re
import subprocess
import time

try:
    from .media_commands import run_media_command
    from .render_scratch import RenderScratch
    from .processor_encoding import _disable_nvenc, _video_encoder_args
except ImportError:  # Direct execution from backend/ remains supported.
    from media_commands import run_media_command
    from render_scratch import RenderScratch
    from processor_encoding import _disable_nvenc, _video_encoder_args


class TemplateOverlayMixin:
    # Right-side "Basic" templates whose preview renders the authored `.btcard`
    # source markup (Iman, Light Streak, Green Neon Pulse, 3D Shadow, Pulse,
    # Horror, …). These must export through the DOM/CSS overlay so the burned
    # video matches the canvas — the ASS approximation cannot reproduce their
    # creative word layout / per-word motion.
    #
    # Canonical source: SOURCE_BASIC_TEMPLATE_IDS in
    # src/components/dashboard/basicTemplateInline.js — parsed at startup by
    # _load_source_basic_template_ids() so the three consumers (preview, export
    # overlay, this routing check) can never drift. This embedded set is only
    # the fallback for deployments where the frontend source tree is absent.
    _SOURCE_BASIC_TEMPLATE_IDS_FALLBACK = frozenset({
        't-106', 't-52', 't-T4', 't-WS1', 't-115',
        't-104', 't-109', 't-95', 't-102', 't-T5',
        't-T6', 't-103', 't-QW1', 't-36', 't-105',
        't-124', 't-110', 't-56', 't-119', 't-12',
    })

    def _load_source_basic_template_ids(self):
        inline_path = os.path.join(
            self.project_root, 'src', 'components', 'dashboard', 'basicTemplateInline.js',
        )
        try:
            with open(inline_path, encoding='utf-8') as f:
                source = f.read()
            match = re.search(r'SOURCE_BASIC_TEMPLATE_IDS\s*=\s*\[(.*?)\]', source, re.S)
            if match:
                ids = frozenset(re.findall(r"'([^']+)'", match.group(1)))
                if ids:
                    if ids != self._SOURCE_BASIC_TEMPLATE_IDS_FALLBACK:
                        print(
                            '[templates] basicTemplateInline.js id list differs from the '
                            'embedded fallback — using the frontend list; update '
                            '_SOURCE_BASIC_TEMPLATE_IDS_FALLBACK in processor.py.'
                        )
                    return ids
        except OSError:
            pass
        return self._SOURCE_BASIC_TEMPLATE_IDS_FALLBACK

    def _should_use_dom_template_renderer(self, style, captions=None):
        def _template_values(source):
            if not isinstance(source, dict):
                return '', ''
            applied = source.get('applied_template_style')
            if not isinstance(applied, dict):
                applied = {}
            return (
                str(source.get('template_id') or applied.get('template_id') or '').strip(),
                str(source.get('template_20_id') or applied.get('template_20_id') or '').strip(),
            )

        candidates = [_template_values(style)]
        for caption in captions or []:
            if isinstance(caption, dict) and not caption.get('is_text_element'):
                candidates.append(_template_values(caption))

        # ASS is intentionally retained for simple static captions because it is
        # much cheaper than browser frame capture. Rich editor features need the
        # DOM/CSS renderer: ASS cannot reproduce gradients, arbitrary text-box
        # geometry, or the dashboard's line/word animation timing faithfully.
        if any(
            isinstance(caption, dict) and (
                caption.get('is_text_element')
                or str(caption.get('animation') or 'none') != 'none'
                or bool(caption.get('word_styles'))
            )
            for caption in captions or []
        ):
            return True
        try:
            style_scale = float(style.get('scale', 1) or 1) if isinstance(style, dict) else 1
        except (TypeError, ValueError):
            style_scale = 1
        try:
            style_box_width = float(style.get('box_width', 0) or 0) if isinstance(style, dict) else 0
        except (TypeError, ValueError):
            style_box_width = 0
        try:
            style_line_spacing = float(style.get('line_spacing', 1.4) or 1.4) if isinstance(style, dict) else 1.4
        except (TypeError, ValueError):
            style_line_spacing = 1.4
        try:
            # `or 0` would be wrong here: an explicit 0 must stay 0 (it differs
            # from the default and needs the DOM renderer), while a missing or
            # null value must read as the neutral default so a plain caption
            # still takes the cheap ASS path.
            _raw_word_spacing = style.get('word_spacing') if isinstance(style, dict) else None
            style_word_spacing = float(1 if _raw_word_spacing is None else _raw_word_spacing)
        except (TypeError, ValueError):
            style_word_spacing = 1
        try:
            style_text_opacity = float(style.get('text_opacity', 1) if style.get('text_opacity') is not None else 1) if isinstance(style, dict) else 1
        except (TypeError, ValueError):
            style_text_opacity = 1
        if isinstance(style, dict) and (
            bool(style.get('text_gradient'))
            or bool(style.get('highlight_gradient'))
            or bool(style.get('highlight_color'))
            or str(style.get('text_decoration') or 'none') != 'none'
            or str(style.get('effect_type') or 'none') != 'none'
            or abs(style_scale - 1) > 0.001
            or style_box_width > 0
            or abs(style_line_spacing - 1.4) > 0.001
            or abs(style_word_spacing - 1) > 0.001
            or abs(style_text_opacity - 1) > 0.001
        ):
            return True

        if any(template_20_id for _, template_20_id in candidates):
            return True
        # No-hyphen advanced templates (t11–t40) need DOM/CSS rendering.
        if any(re.fullmatch(r"t\d{2}", template_id) for template_id, _ in candidates):
            return True
        # Source-markup Basic templates render their `.btcard` design in the
        # preview, so they export through the same DOM overlay for parity.
        return any(template_id in self._source_basic_template_ids for template_id, _ in candidates)

    def _render_dom_template_overlay(self, input_p, output_p, captions, style, video_w, video_h, crop_filter=""):
        quality = style.get('quality', '1080p')
        export_aspect_ratio = self._get_export_aspect_ratio(style)
        scale_filter, crf, audio_bitrate = self._get_quality_settings(quality, export_aspect_ratio)
        output_w, output_h = self._get_output_dimensions(
            video_w, video_h, quality, export_aspect_ratio
        )
        fps = self._get_export_fps(style)
        duration = self._get_video_duration(input_p)
        temp_root = os.path.join(self.project_root, ".render_tmp")
        scratch = RenderScratch(temp_root)
        temp_dir = scratch.path
        try:
            payload_path = os.path.join(temp_dir, "payload.json")
            overlay_dir = os.path.join(temp_dir, "overlay_frames")
            os.makedirs(overlay_dir, exist_ok=True)

            payload = {
                "captions": captions,
                "style": style,
                # Chromium renders directly at final export resolution. The old
                # path captured every overlay at source resolution and then
                # downscaled it, wasting most screenshot pixels on 720p jobs.
                "video_width": output_w,
                "video_height": output_h,
                "duration": duration,
                "output_dir": overlay_dir,
            }
            with open(payload_path, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=False)

            render_cmd = ["node", self.template_overlay_script, payload_path]
            print(f"[Template DOM] Rendering overlay frames with: {' '.join(render_cmd)}")
            overlay_started_at = time.perf_counter()
            render_result = subprocess.run(
                render_cmd,
                capture_output=True,
                text=True,
                cwd=self.project_root,
                timeout=15 * 60,
            )
            overlay_seconds = time.perf_counter() - overlay_started_at
            print(f"[Template DOM] Overlay frames completed in {overlay_seconds:.2f}s")
            if render_result.stdout:
                print(f"[Template DOM] stdout: {render_result.stdout[-1000:]}")
            if render_result.returncode != 0:
                return {
                    "success": False,
                    "error": f"Template renderer failed: {(render_result.stderr or render_result.stdout)[-800:]}"
                }

            frames_txt = os.path.join(overlay_dir, "frames.txt")
            if not os.path.exists(frames_txt):
                return {"success": False, "error": "Template renderer did not create frames.txt"}

            base_chain = "[0:v]"
            if crop_filter:
                base_chain += f"{crop_filter},"
            base_chain += f"{scale_filter},format=rgba[base]"
            filter_complex = f"{base_chain};[1:v]format=rgba[overlay];[base][overlay]overlay=0:0:format=auto,format=yuv420p[outv]"

            def _build_overlay_cmd(force_cpu=False):
                return [
                    "ffmpeg", "-y",
                    "-i", input_p.replace('\\', '/'),
                    "-f", "concat", "-safe", "0",
                    "-i", frames_txt.replace('\\', '/'),
                    "-filter_complex", filter_complex,
                    "-map", "[outv]",
                    "-map", "0:a?",
                    *_video_encoder_args(crf, force_cpu),
                    "-r", str(fps),
                    "-c:a", "aac",
                    "-b:a", audio_bitrate,
                    "-shortest",
                    output_p.replace('\\', '/'),
                ]

            cmd = _build_overlay_cmd()

            print(f"[Template DOM] Quality: {quality}, CRF: {crf}")
            print(f"[Template DOM] filter_complex: {filter_complex}")
            print(f"[Template DOM] Running FFmpeg: {' '.join(cmd)}")
            encode_started_at = time.perf_counter()
            result = run_media_command(cmd, capture_output=True, text=True)
            if result.stderr:
                print(f"[Template DOM] FFmpeg stderr (last 1000 chars): {result.stderr[-1000:]}")
            # Same GPU safety net as the ASS burn path — a failed NVENC encode
            # falls back to libx264 rather than failing the export.
            if result.returncode != 0 and "h264_nvenc" in cmd:
                _disable_nvenc("overlay encode failed at runtime")
                print("[Template DOM] NVENC encode failed — retrying on CPU (libx264).")
                result = run_media_command(_build_overlay_cmd(force_cpu=True), capture_output=True, text=True)
                if result.stderr:
                    print(f"[Template DOM] CPU retry stderr (last 1000 chars): {result.stderr[-1000:]}")
            if result.returncode != 0:
                return {"success": False, "error": "Video render failed"}
            encode_seconds = time.perf_counter() - encode_started_at
            print(f"[Template DOM] Video encode completed in {encode_seconds:.2f}s")

            if os.path.exists(output_p):
                print(f"[Template DOM] Output file size: {os.path.getsize(output_p)} bytes")
            return {"success": True}
        finally:
            scratch.close()
