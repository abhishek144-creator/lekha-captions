# Caption Studio

## Overview
A video caption generation and editing studio. Users upload short-form videos, captions are generated using OpenAI Whisper (word-level timestamps), and users can style/animate/export captions burned into the video.

## Architecture
- **Frontend**: React + Vite (port 5000), TailwindCSS, Radix UI, Framer Motion
- **Backend**: Python FastAPI (port 8000), OpenAI Whisper, FFmpeg + ASS subtitles
- **Proxy**: Vite proxies `/api`, `/uploads`, `/exports` to backend

## Project Structure
```
/backend
  main.py          - FastAPI server (upload, process, export endpoints)
  processor.py     - VideoProcessor class (Whisper transcription, ASS generation, FFmpeg burn)
  flat_fonts/      - Downloaded Google Fonts TTF files
  uploads/         - Uploaded video files
  exports/         - Exported video files with burned captions
/src
  pages/Dashboard.jsx     - Main dashboard page
  components/dashboard/   - Video player, caption editor, style controls, export panel
  components/ui/          - Radix-based UI components
```

## Key Design Decisions
- ASS subtitle format for caption rendering (FFmpeg compatible)
- Google Fonts downloaded on-demand to backend/flat_fonts/
- Word-level timestamps from Whisper for precise speech sync
- BorderStyle 3 (opaque box) for caption background layers
- Video dimensions detected via ffprobe for accurate positioning
- Captions grouped 1-3 words based on speech pace analysis

## Recent Changes (Feb 2026)
- CRITICAL FIX: Animation background layer transparency - added explicit \1a&HFF& alpha tag alongside \1c for background layer text, ensuring truly invisible text (libass requires separate alpha tag). Fixes "static text merging with animated text" visual bug.
- CRITICAL FIX: All positions (caption, word, text element) now converted from container-space to video content-space at export time via containerToVideo(), accounting for object-contain letterboxing. Positions clamped to [0,100].
- CRITICAL FIX: scale_factor now uses actual preview container height (preview_height) instead of hardcoded 400px for accurate scaling
- CRITICAL FIX: Background border factor is script-aware: 0.65 for non-Latin scripts (larger font metrics), 0.85 for Latin scripts
- CRITICAL FIX: Re-drag positions always recalculated from DOM at mouseUp, overwriting previous abs_x_pct/abs_y_pct values. ExportPanel also queries DOM as backup for currently visible captions.
- CRITICAL FIX: Dragged word background border reduced from 8% of font size to half of bg_padding*scale_factor, better matching tight CSS preview padding.
- CRITICAL FIX: Animation + Background split - captions with both background AND animation now emit two ASS layers: Layer 0 = static background (transparent text, full border, static \pos), Layer 1 = animated text-only (\bord0, \move). Prevents background from moving with text.
- CRITICAL FIX: Dragged word backgrounds fixed - separated/dragged words no longer inherit main caption background unless they explicitly have backgroundColor set. Uses \bord0 by default.
- CRITICAL FIX: Font override removed - _detect_script() no longer overrides user's font choice. User-selected font always used in ASS output. Script detection only downloads Indic fallback fonts for glyph rendering.
- CRITICAL FIX: Background size now uses actual background_padding (default 6px) scaled to video resolution instead of 35% of font size
- ExportPanel now sends background_padding, background_h_multiplier, and text element padding to backend
- CRITICAL FIX: Dashboard now preserves `words` array from backend (was stripped, causing multi-word highlight)
- CRITICAL FIX: Font reverse lookup by ass_name + INDIC_FONTS in _ensure_font (fixes multi-word font names like 'Archivo Black')
- CRITICAL FIX: ExportPanel now sends per-word styles (wordStyles) to backend for per-word font/color in export
- CRITICAL FIX: Backend generates per-word ASS inline override tags (\1c, \fn, \fs, \b, \i, \3c) with proper reset tags
- CRITICAL FIX: Per-word drag positions now stored as percentages (x_pct, y_pct) and exported as separate ASS Dialogue lines
- CRITICAL FIX: Per-caption animation from Animate tab now properly applied in export
- CRITICAL FIX: Per-word animation from floating popup applied when words have custom positions
- CRITICAL FIX: Text elements (text boxes from TextTab) now included in video export with custom position, font, color, background, animation, and timing
- CRITICAL FIX: Text element alignment (left/center/right) mapped to ASS \an tags for visual fidelity
- Template styles flow through captionStyle -> ExportPanel -> backend, so future templates auto-work in export
- Fixed highlight color to apply to single active word instead of word group
- Fixed timeline playhead seek responsiveness (reduced sync threshold from 0.3s to 0.05s)
- Fixed shadow rendering in preview (removed hardcoded textShadow override)
- Changed default background_h_multiplier from 1.1 to 1.2
- Fixed export to include stroke_width, shadow_blur, shadow_offset_x/y in payload
- Fixed processor.py to use stroke_width/shadow properties with proper scaling and ASS xshad/yshad overrides
- Fixed upload flow: isGenerating state now checked before !videoUrl to show progress during re-upload
- Added GPT-4o translation support via `/api/translate` endpoint (OpenAI Replit integration)
- Added 20+ Indian languages (Hindi, Tamil, Telugu, etc.) and 30 international languages
- Words per line selection: 1-2 (Punchy), 2-3 (Standard), 3-5 (Long), Dynamic (Auto)
- Language-specific font system: Font dropdown shows native script fonts + 12 popular Latin fonts appended for all non-Latin languages
- scriptFontMap in fontUtils.jsx: native fonts per script + popularLatinFonts appended via getFontOptionsForScript() (deduplicates) giving 15-20+ fonts per language
- Backend SCRIPT_FONTS_MAP: 100+ font entries with Google Fonts GitHub download URLs and ASS font names
- Font key normalization: frontend "Tiro Devanagari Hindi" -> backend key "TiroDevanagariHindi" (spaces removed)
- Anek font family used for broader script coverage (Anek Gujarati, Anek Kannada, Anek Malayalam, etc.)
- Noto Serif variants added for serif options across all Indic scripts
- Script label badge shows language name (e.g., "Hindi / Marathi", "Tamil") next to Font Family label
- CRITICAL FIX: Highlight color export - generates per-word karaoke-style ASS overlay lines (Layer 2) with highlight background timed to each word's speech window, uses per-word positions for dragged words
- CRITICAL FIX: Text element stroke/shadow now rendered in preview (WebkitTextStroke, textShadow CSS) and export (ASS \bord, \shad, \xshad, \yshad)
- CRITICAL FIX: Text element stroke/shadow preserved even when background+animation are both enabled (separate bg layer + stroke/shadow on text layer)
- CRITICAL FIX: Text element styling controls fully mapped - background_color, background_padding, shadow_color/blur/offset_x/y all wired in both updateStyle and getCurrentValue keyMaps
- CRITICAL FIX: Text element letter_spacing exported to backend and rendered as ASS \fsp tag
- CRITICAL FIX: Highlight gradient support - backend extracts first color from CSS gradient via regex when highlight_color is empty
- CRITICAL FIX: Text element Background Thickness (H) - background_h_multiplier now in StyleControls updateStyle/getCurrentValue keyMaps for text elements
- CRITICAL FIX: Text element per-word styles in export - backend processes word_styles for per-word color, font, fontSize, animation, position; words with custom positions/animations render as separate ASS Dialogue lines; words with only style changes use inline overrides without \r reset (preserves background)
- CRITICAL FIX: Text element background_h_multiplier applied to ASS border calculation (te_bord scaled by h_mult)

## User Preferences
- Wants exact font/color/animation from preview to appear in exported video
- Wants caption background layer always present when enabled
- Wants speech-synced captions with no gap between audio and text appearance
- Wants GPT-4o translation for multiple languages with separate Indian/International dropdowns
