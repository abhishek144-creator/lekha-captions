"""Download every supported export font during the render image build."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
from urllib.parse import urlparse

import requests

from .processor import BOLD_VARIANTS, GOOGLE_FONTS_MAP, INDIC_FONTS, SCRIPT_FONTS_MAP


ALLOWED_FONT_HOSTS = {"github.com", "raw.githubusercontent.com", "fonts.gstatic.com"}


def font_assets():
    unique = {}
    for mapping in (GOOGLE_FONTS_MAP, INDIC_FONTS, SCRIPT_FONTS_MAP, BOLD_VARIANTS):
        for item in mapping.values():
            filename = str(item["file"])
            url = str(item["url"])
            unique.setdefault(filename, url)
    return sorted(unique.items())


def css_font_faces():
    faces = {}
    for mapping in (GOOGLE_FONTS_MAP, INDIC_FONTS, SCRIPT_FONTS_MAP):
        for item in mapping.values():
            family = str(item.get("ass_name") or "").strip()
            filename = str(item.get("file") or "").strip()
            if family and filename:
                weight = str(item.get("weight") or "400")
                style = str(item.get("style") or "normal")
                faces[(family, weight, style)] = filename
    for family, item in BOLD_VARIANTS.items():
        filename = str(item.get("file") or "").strip()
        google_font = GOOGLE_FONTS_MAP.get(family) or {}
        display_family = str(google_font.get("ass_name") or family).strip()
        if display_family and filename:
            faces[(display_family, "700", "normal")] = filename
    rules = []
    for (family, weight, style), filename in sorted(faces.items()):
        rules.append(
            "@font-face{"
            f"font-family:{json.dumps(family, ensure_ascii=False)};"
            f"font-style:{style};font-weight:{weight};font-display:block;"
            f"src:url('__FONT_BASE_URL__/{filename}') format('truetype');"
            "}"
        )
    return "\n".join(rules) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fonts-dir", required=True)
    parser.add_argument("--system-fonts-dir", required=True)
    args = parser.parse_args()
    fonts_dir = Path(args.fonts_dir)
    system_fonts_dir = Path(args.system_fonts_dir)
    fonts_dir.mkdir(parents=True, exist_ok=True)
    system_fonts_dir.mkdir(parents=True, exist_ok=True)
    manifest = {}

    with requests.Session() as session:
        for filename, url in font_assets():
            target = fonts_dir / filename
            if not target.exists() or target.stat().st_size < 1_000:
                response = session.get(url, timeout=90, allow_redirects=True)
                response.raise_for_status()
                if urlparse(response.url).hostname not in ALLOWED_FONT_HOSTS:
                    raise RuntimeError(f"Untrusted redirect while fetching {filename}")
                valid_sfnt_signatures = (b"\x00\x01\x00\x00", b"OTTO", b"true", b"typ1")
                if len(response.content) < 1_000 or not response.content.startswith(valid_sfnt_signatures):
                    raise RuntimeError(f"Downloaded font is unexpectedly small: {filename}")
                temporary = target.with_suffix(target.suffix + ".tmp")
                temporary.write_bytes(response.content)
                temporary.replace(target)
            shutil.copy2(target, system_fonts_dir / filename)
            manifest[filename] = {
                "bytes": target.stat().st_size,
                "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            }

    (fonts_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (fonts_dir / "export-fonts.css").write_text(css_font_faces(), encoding="utf-8")
    print(f"Pre-baked {len(manifest)} unique production font files")


if __name__ == "__main__":
    main()
